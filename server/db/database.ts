import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config.js';
import { DatabaseSchema, User, Credential, AcmeAccount, CertTask, Certificate, NotifyChannel, DomainMonitor, TaskExecutionLog, SystemSettings } from './schema.js';
import { encrypt, decrypt, encryptObject, decryptObject } from '../services/crypto.js';

class Database {
  private filePath: string;
  private data: DatabaseSchema;
  private isSaving: boolean = false;
  private saveQueued: boolean = false;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.data = this.loadData();
  }

  private getDefaultData(): DatabaseSchema {
    // Generate default admin password hash (tqd354@gmail.com / aaAA1122)
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync('aaAA1122', salt, 100000, 64, 'sha512').toString('hex');
    const passwordHash = `${salt}:${hash}`;

    const defaultAdmin: User = {
      id: 'usr_admin_default',
      username: 'tqd354',
      email: 'tqd354@gmail.com',
      passwordHash: passwordHash,
      authSource: 'local',
      role: 'admin',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const defaultAcmeAccounts: AcmeAccount[] = [
      {
        id: 'acme_letsencrypt_prod',
        name: "Let's Encrypt (Production)",
        caProvider: 'letsencrypt',
        email: 'tqd354@gmail.com',
        directoryUrl: 'https://acme-v02.api.letsencrypt.org/directory',
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'acme_letsencrypt_staging',
        name: "Let's Encrypt (Staging / 测试环境)",
        caProvider: 'letsencrypt_staging',
        email: 'tqd354@gmail.com',
        directoryUrl: 'https://acme-staging-v02.api.letsencrypt.org/directory',
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'acme_zerossl',
        name: 'ZeroSSL (需要 EAB 凭证)',
        caProvider: 'zerossl',
        email: 'tqd354@gmail.com',
        directoryUrl: 'https://acme.zerossl.com/v2/DV90',
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'acme_google_trust',
        name: 'Google Trust Services (需要 EAB 凭证)',
        caProvider: 'google',
        email: 'tqd354@gmail.com',
        directoryUrl: 'https://dv.acme-v02.api.pki.goog/directory',
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    const defaultSettings: SystemSettings = {
      authmate: {
        issuerUrl: config.authmate.issuerUrl,
        clientId: config.authmate.clientId,
        clientSecret: config.authmate.clientSecret,
        redirectUri: config.authmate.redirectUri,
        enabled: config.authmate.enabled
      },
      globalRenewCheckCron: '0 2 * * *',
      defaultRenewDaysBefore: 30
    };

    return {
      users: [defaultAdmin],
      credentials: [],
      acmeAccounts: defaultAcmeAccounts,
      tasks: [],
      certificates: [],
      notifyChannels: [],
      domainMonitors: [],
      executionLogs: [],
      settings: defaultSettings
    };
  }

  private loadData(): DatabaseSchema {
    if (!fs.existsSync(this.filePath)) {
      const defaults = this.getDefaultData();
      this.saveFileSync(defaults);
      return defaults;
    }

    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        ...this.getDefaultData(),
        ...parsed
      };
    } catch (err) {
      console.error('Failed to load database file, falling back to defaults:', err);
      const defaults = this.getDefaultData();
      this.saveFileSync(defaults);
      return defaults;
    }
  }

  private saveFileSync(data: DatabaseSchema): void {
    const tempPath = `${this.filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, this.filePath);
  }

  public save(): void {
    if (this.isSaving) {
      this.saveQueued = true;
      return;
    }

    this.isSaving = true;
    const tempPath = `${this.filePath}.tmp.${Date.now()}`;
    const payload = JSON.stringify(this.data, null, 2);

    fs.writeFile(tempPath, payload, 'utf8', (err) => {
      if (!err) {
        fs.rename(tempPath, this.filePath, (renameErr) => {
          this.isSaving = false;
          if (this.saveQueued) {
            this.saveQueued = false;
            this.save();
          }
        });
      } else {
        this.isSaving = false;
        console.error('Failed to write database temp file:', err);
      }
    });
  }

  // Generic Getters
  public getUsers(): User[] { return this.data.users; }
  public getCredentials(): Credential[] { return this.data.credentials; }
  public getAcmeAccounts(): AcmeAccount[] { return this.data.acmeAccounts; }
  public getTasks(): CertTask[] { return this.data.tasks; }
  public getCertificates(): Certificate[] { return this.data.certificates; }
  public getNotifyChannels(): NotifyChannel[] { return this.data.notifyChannels; }
  public getDomainMonitors(): DomainMonitor[] { return this.data.domainMonitors; }
  public getExecutionLogs(taskId?: string): TaskExecutionLog[] {
    if (!taskId) return this.data.executionLogs;
    return this.data.executionLogs.filter(l => l.taskId === taskId);
  }
  public getSettings(): SystemSettings { return this.data.settings; }

  // User methods
  public findUserById(id: string): User | undefined {
    return this.data.users.find(u => u.id === id);
  }

  public findUserByUsername(username: string): User | undefined {
    return this.data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  }

  public findUserBySsoSub(ssoSub: string): User | undefined {
    return this.data.users.find(u => u.ssoSub === ssoSub);
  }

  public findUserByEmail(email: string): User | undefined {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  public upsertUser(user: User): User {
    const idx = this.data.users.findIndex(u => u.id === user.id);
    user.updatedAt = new Date().toISOString();
    if (idx >= 0) {
      this.data.users[idx] = user;
    } else {
      this.data.users.push(user);
    }
    this.save();
    return user;
  }

  public deleteUser(id: string): boolean {
    const idx = this.data.users.findIndex(u => u.id === id);
    if (idx >= 0) {
      this.data.users.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  // Credential Methods
  public findCredentialById(id: string): Credential | undefined {
    return this.data.credentials.find(c => c.id === id);
  }

  public upsertCredential(credential: Credential): Credential {
    credential.updatedAt = new Date().toISOString();
    const idx = this.data.credentials.findIndex(c => c.id === credential.id);
    if (idx >= 0) {
      this.data.credentials[idx] = credential;
    } else {
      this.data.credentials.push(credential);
    }
    this.save();
    return credential;
  }

  public deleteCredential(id: string): boolean {
    const idx = this.data.credentials.findIndex(c => c.id === id);
    if (idx >= 0) {
      this.data.credentials.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  // Acme Account Methods
  public findAcmeAccountById(id: string): AcmeAccount | undefined {
    return this.data.acmeAccounts.find(a => a.id === id);
  }

  public upsertAcmeAccount(account: AcmeAccount): AcmeAccount {
    account.updatedAt = new Date().toISOString();
    if (account.isDefault) {
      this.data.acmeAccounts.forEach(a => { a.isDefault = false; });
    }
    const idx = this.data.acmeAccounts.findIndex(a => a.id === account.id);
    if (idx >= 0) {
      this.data.acmeAccounts[idx] = account;
    } else {
      this.data.acmeAccounts.push(account);
    }
    this.save();
    return account;
  }

  public deleteAcmeAccount(id: string): boolean {
    const idx = this.data.acmeAccounts.findIndex(a => a.id === id);
    if (idx >= 0) {
      this.data.acmeAccounts.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  // Task Methods
  public findTaskById(id: string): CertTask | undefined {
    return this.data.tasks.find(t => t.id === id);
  }

  public upsertTask(task: CertTask): CertTask {
    task.updatedAt = new Date().toISOString();
    const idx = this.data.tasks.findIndex(t => t.id === task.id);
    if (idx >= 0) {
      this.data.tasks[idx] = task;
    } else {
      this.data.tasks.push(task);
    }
    this.save();
    return task;
  }

  public deleteTask(id: string): boolean {
    const idx = this.data.tasks.findIndex(t => t.id === id);
    if (idx >= 0) {
      this.data.tasks.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  // Certificate Methods
  public findCertificateById(id: string): Certificate | undefined {
    return this.data.certificates.find(c => c.id === id);
  }

  public findCertificateByTaskId(taskId: string): Certificate | undefined {
    return this.data.certificates.find(c => c.taskId === taskId);
  }

  public upsertCertificate(cert: Certificate): Certificate {
    const idx = this.data.certificates.findIndex(c => c.id === cert.id);
    if (idx >= 0) {
      this.data.certificates[idx] = cert;
    } else {
      this.data.certificates.push(cert);
    }
    this.save();
    return cert;
  }

  public deleteCertificate(id: string): boolean {
    const idx = this.data.certificates.findIndex(c => c.id === id);
    if (idx >= 0) {
      this.data.certificates.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  // Notify Channels
  public findNotifyChannelById(id: string): NotifyChannel | undefined {
    return this.data.notifyChannels.find(n => n.id === id);
  }

  public upsertNotifyChannel(channel: NotifyChannel): NotifyChannel {
    channel.updatedAt = new Date().toISOString();
    const idx = this.data.notifyChannels.findIndex(n => n.id === channel.id);
    if (idx >= 0) {
      this.data.notifyChannels[idx] = channel;
    } else {
      this.data.notifyChannels.push(channel);
    }
    this.save();
    return channel;
  }

  public deleteNotifyChannel(id: string): boolean {
    const idx = this.data.notifyChannels.findIndex(n => n.id === id);
    if (idx >= 0) {
      this.data.notifyChannels.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  // Domain Monitors
  public findDomainMonitorById(id: string): DomainMonitor | undefined {
    return this.data.domainMonitors.find(m => m.id === id);
  }

  public upsertDomainMonitor(monitor: DomainMonitor): DomainMonitor {
    monitor.updatedAt = new Date().toISOString();
    const idx = this.data.domainMonitors.findIndex(m => m.id === monitor.id);
    if (idx >= 0) {
      this.data.domainMonitors[idx] = monitor;
    } else {
      this.data.domainMonitors.push(monitor);
    }
    this.save();
    return monitor;
  }

  public deleteDomainMonitor(id: string): boolean {
    const idx = this.data.domainMonitors.findIndex(m => m.id === id);
    if (idx >= 0) {
      this.data.domainMonitors.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  // Execution Logs
  public addExecutionLog(log: TaskExecutionLog): TaskExecutionLog {
    this.data.executionLogs.unshift(log);
    // Keep max 500 logs
    if (this.data.executionLogs.length > 500) {
      this.data.executionLogs = this.data.executionLogs.slice(0, 500);
    }
    this.save();
    return log;
  }

  public updateExecutionLog(log: TaskExecutionLog): void {
    const idx = this.data.executionLogs.findIndex(l => l.id === log.id);
    if (idx >= 0) {
      this.data.executionLogs[idx] = log;
      this.save();
    }
  }

  // Settings
  public updateSettings(settings: Partial<SystemSettings>): SystemSettings {
    this.data.settings = {
      ...this.data.settings,
      ...settings,
      authmate: {
        ...this.data.settings.authmate,
        ...(settings.authmate || {})
      }
    };
    this.save();
    return this.data.settings;
  }
}

export const db = new Database(config.dbPath);
