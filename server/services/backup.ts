import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from '../db/database.js';
import { config } from '../config.js';
import { DatabaseSchema } from '../db/schema.js';

export interface BackupEnvelope {
  sslmateBackup: true;
  version: string;
  isEncrypted: boolean;
  kdf?: string;
  iterations?: number;
  salt?: string;
  iv?: string;
  tag?: string;
  payload: string; // Plaintext JSON string or AES-256-GCM hex/base64
  checksumSha256: string;
  exportedAt: string;
  stats?: {
    users: number;
    tasks: number;
    credentials: number;
    certificates: number;
    monitors: number;
  };
}

export interface RestoreResult {
  success: boolean;
  message: string;
  restoredAt: string;
  stats: {
    users: number;
    tasks: number;
    credentials: number;
    certificates: number;
    monitors: number;
  };
}

export class BackupService {
  private static backupsDir = path.resolve(config.dataDir, 'backups');

  private static ensureBackupsDir(): void {
    if (!fs.existsSync(this.backupsDir)) {
      try {
        fs.mkdirSync(this.backupsDir, { recursive: true });
      } catch {}
    }
  }

  /**
   * Export full system disaster recovery backup with optional password-derived AES-256-GCM encryption
   */
  public static exportBackup(password?: string): BackupEnvelope {
    const rawData = db.getAllData();

    // Read stored secrets if present
    let jwtSecret = config.jwtSecret;
    let masterKey = config.masterKey;

    const jwtSecretFile = path.resolve(config.dataDir, '.jwt_secret');
    if (fs.existsSync(jwtSecretFile)) {
      try { jwtSecret = fs.readFileSync(jwtSecretFile, 'utf8').trim(); } catch {}
    }
    const masterKeyFile = path.resolve(config.dataDir, '.master_key');
    if (fs.existsSync(masterKeyFile)) {
      try { masterKey = fs.readFileSync(masterKeyFile, 'utf8').trim(); } catch {}
    }

    const backupPayloadObj = {
      data: rawData,
      secrets: {
        jwtSecret,
        masterKey
      },
      exportedAt: new Date().toISOString()
    };

    const payloadJson = JSON.stringify(backupPayloadObj);
    const checksumSha256 = crypto.createHash('sha256').update(payloadJson).digest('hex');

    const stats = {
      users: rawData.users?.length || 0,
      tasks: rawData.tasks?.length || 0,
      credentials: rawData.credentials?.length || 0,
      certificates: rawData.certificates?.length || 0,
      monitors: rawData.domainMonitors?.length || 0
    };

    if (password && password.trim().length > 0) {
      // PBKDF2-SHA512 + AES-256-GCM
      const salt = crypto.randomBytes(16);
      const iv = crypto.randomBytes(12);
      const key = crypto.pbkdf2Sync(password.trim(), salt, 100000, 32, 'sha512');

      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let encrypted = cipher.update(payloadJson, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const tag = cipher.getAuthTag();

      return {
        sslmateBackup: true,
        version: '1.2.0',
        isEncrypted: true,
        kdf: 'pbkdf2-sha512',
        iterations: 100000,
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        payload: encrypted,
        checksumSha256,
        exportedAt: new Date().toISOString(),
        stats
      };
    } else {
      return {
        sslmateBackup: true,
        version: '1.2.0',
        isEncrypted: false,
        payload: payloadJson,
        checksumSha256,
        exportedAt: new Date().toISOString(),
        stats
      };
    }
  }

  /**
   * Restore full system disaster recovery backup
   */
  public static restoreBackup(envelopeJson: string, password?: string): RestoreResult {
    let envelope: BackupEnvelope;
    try {
      envelope = JSON.parse(envelopeJson);
    } catch {
      throw new Error('无效的备份数据：必须是合法的 JSON 格式');
    }

    if (!envelope || envelope.sslmateBackup !== true) {
      throw new Error('无效的备份文件：非 SSL-Mate 标准灾备归档包');
    }

    let payloadJson: string;

    if (envelope.isEncrypted) {
      if (!password || password.trim().length === 0) {
        throw new Error('该备份包已受密码加密保护，请提供解密密码');
      }

      if (!envelope.salt || !envelope.iv || !envelope.tag) {
        throw new Error('备份包加密元数据不完整');
      }

      try {
        const salt = Buffer.from(envelope.salt, 'hex');
        const iv = Buffer.from(envelope.iv, 'hex');
        const tag = Buffer.from(envelope.tag, 'hex');
        const iterations = envelope.iterations || 100000;
        const key = crypto.pbkdf2Sync(password.trim(), salt, iterations, 32, 'sha512');

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(envelope.payload, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        payloadJson = decrypted;
      } catch (err: any) {
        throw new Error('解密失败：提供的解密密码错误或备份数据已遭篡改');
      }
    } else {
      payloadJson = envelope.payload;
    }

    // Verify integrity
    const computedChecksum = crypto.createHash('sha256').update(payloadJson).digest('hex');
    if (computedChecksum !== envelope.checksumSha256) {
      throw new Error('数据完整性校验失败：内容哈希与摘要不匹配');
    }

    const payloadObj = JSON.parse(payloadJson);
    const restoredData = payloadObj.data as DatabaseSchema;

    if (!restoredData || !Array.isArray(restoredData.users) || !Array.isArray(restoredData.tasks)) {
      throw new Error('备份包数据损坏：缺失核心架构实体');
    }

    // Create safety snapshot before overwriting
    this.createLocalSnapshot('pre-restore-auto-snapshot');

    // Replace database content atomically
    db.replaceAllData(restoredData);

    // Restore secrets if present
    if (payloadObj.secrets) {
      try {
        if (payloadObj.secrets.jwtSecret) {
          fs.writeFileSync(path.resolve(config.dataDir, '.jwt_secret'), payloadObj.secrets.jwtSecret.trim(), 'utf8');
        }
        if (payloadObj.secrets.masterKey) {
          fs.writeFileSync(path.resolve(config.dataDir, '.master_key'), payloadObj.secrets.masterKey.trim(), 'utf8');
        }
      } catch (e: any) {
        console.warn('[Backup] 恢复机密私钥文件提示:', e.message);
      }
    }

    const stats = {
      users: restoredData.users.length,
      tasks: restoredData.tasks.length,
      credentials: restoredData.credentials?.length || 0,
      certificates: restoredData.certificates?.length || 0,
      monitors: restoredData.domainMonitors?.length || 0
    };

    return {
      success: true,
      message: '全系统数据已安全成功还原！',
      restoredAt: new Date().toISOString(),
      stats
    };
  }

  /**
   * Create a local backup snapshot in data/backups/
   */
  public static createLocalSnapshot(label?: string): string {
    this.ensureBackupsDir();
    const backup = this.exportBackup();
    const filename = `sslmate-snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}${label ? `-${label}` : ''}.json`;
    const filePath = path.join(this.backupsDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(backup, null, 2), 'utf8');

    // Prune old snapshots, keep latest 10
    this.pruneOldSnapshots(10);

    return filename;
  }

  /**
   * List all saved local snapshots
   */
  public static listLocalSnapshots(): Array<{ filename: string; size: number; createdAt: string }> {
    this.ensureBackupsDir();
    try {
      const files = fs.readdirSync(this.backupsDir).filter(f => f.endsWith('.json'));
      return files.map(filename => {
        const filePath = path.join(this.backupsDir, filename);
        const stat = fs.statSync(filePath);
        return {
          filename,
          size: stat.size,
          createdAt: stat.mtime.toISOString()
        };
      }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return [];
    }
  }

  private static pruneOldSnapshots(keepCount: number): void {
    try {
      const snapshots = this.listLocalSnapshots();
      if (snapshots.length > keepCount) {
        const toDelete = snapshots.slice(keepCount);
        for (const s of toDelete) {
          try {
            fs.unlinkSync(path.join(this.backupsDir, s.filename));
          } catch {}
        }
      }
    } catch {}
  }
}
