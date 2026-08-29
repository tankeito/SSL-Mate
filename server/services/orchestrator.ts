import crypto from 'crypto';
import { db } from '../db/database.js';
import { CertTask, Certificate, TaskExecutionLog } from '../db/schema.js';
import { AcmeService } from './acme/client.js';
import { DeployOrchestrator } from './deployers/index.js';
import { TaskLogger } from './logger.js';
import { NotificationService } from './notify.js';
import { encrypt } from './crypto.js';

export class TaskOrchestrator {
  public static async executeTask(
    taskId: string,
    triggerType: 'auto_cron' | 'manual' | 'webhook' = 'manual'
  ): Promise<{ success: boolean; error?: string }> {
    const task = db.findTaskById(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    const startTime = Date.now();
    const logger = new TaskLogger(taskId);

    const executionLog: TaskExecutionLog = {
      id: `log_${crypto.randomBytes(8).toString('hex')}`,
      taskId: task.id,
      taskName: task.name,
      triggerType,
      status: 'running',
      stage: 'INIT',
      logs: [],
      durationMs: 0,
      startedAt: new Date().toISOString()
    };

    db.addExecutionLog(executionLog);

    task.status = 'renewing';
    task.lastRunStatus = 'running';
    task.lastRunAt = new Date().toISOString();
    db.upsertTask(task);

    logger.info(`=======================================================`);
    logger.info(`🚀 启动证书自动化任务 [${task.name}] (触发方式: ${triggerType})`, 'INIT');
    logger.info(`目标域名: ${task.domains.join(', ')}`, 'INIT');
    logger.info(`=======================================================`);

    try {
      // 1. Fetch ACME Account
      const acmeAccount = db.findAcmeAccountById(task.acmeAccountId);
      if (!acmeAccount) {
        throw new Error(`未找到关联的 ACME CA 账户 (ID: ${task.acmeAccountId})`);
      }

      // 2. Fetch DNS Credential
      let dnsCredential = task.dnsCredentialId ? db.findCredentialById(task.dnsCredentialId) : undefined;

      // 3. Issue Certificate via ACME
      executionLog.stage = 'ACME_ISSUE';
      const certResult = await AcmeService.issueCertificate({
        domains: task.domains,
        acmeAccount,
        dnsCredential,
        keyType: task.keyType || 'ec256',
        logger
      });

      // 4. Save Certificate Asset to Repository
      const certId = `cert_${crypto.randomBytes(8).toString('hex')}`;
      const certAsset: Certificate = {
        id: certId,
        taskId: task.id,
        primaryDomain: task.domains[0],
        sanDomains: certResult.sanDomains,
        issuer: certResult.issuer,
        serialNumber: certResult.serialNumber,
        certPem: certResult.certPem,
        privkeyPem: encrypt(certResult.privkeyPem),
        fullchainPem: certResult.fullchainPem,
        fingerprintSha256: certResult.fingerprintSha256,
        keyType: task.keyType,
        issuedAt: certResult.issuedAt,
        expiresAt: certResult.expiresAt,
        isRevoked: false,
        createdAt: new Date().toISOString()
      };

      db.upsertCertificate(certAsset);
      task.currentCertId = certId;
      logger.success(`证书资产已归档入库 (ID: ${certId})，有效期至: ${new Date(certResult.expiresAt).toLocaleDateString()}`, 'STORAGE');

      // 5. Multi-Target Deployment
      executionLog.stage = 'DEPLOY';
      if (task.deployTargets && task.deployTargets.length > 0) {
        await DeployOrchestrator.executeAll(
          task.deployTargets,
          {
            domains: task.domains,
            certPem: certResult.certPem,
            privkeyPem: certResult.privkeyPem,
            fullchainPem: certResult.fullchainPem,
            expiresAt: certResult.expiresAt
          },
          logger
        );
      }

      // 6. Complete Task
      const durationMs = Date.now() - startTime;
      task.status = 'active';
      task.lastRunStatus = 'success';
      task.lastRunMessage = '证书签发与全量部署成功';
      db.upsertTask(task);

      executionLog.status = 'success';
      executionLog.stage = 'COMPLETED';
      executionLog.durationMs = durationMs;
      executionLog.finishedAt = new Date().toISOString();
      executionLog.logs = logger.entries;
      db.updateExecutionLog(executionLog);

      logger.success(`🎉 任务全流程执行成功！总耗时: ${(durationMs / 1000).toFixed(1)} 秒`, 'FINISH');

      // 7. Dispatch Success Notification
      if (task.notifyChannelIds && task.notifyChannelIds.length > 0) {
        NotificationService.dispatch(task.notifyChannelIds, {
          event: 'renew_success',
          taskName: task.name,
          domains: task.domains,
          expiresAt: certResult.expiresAt
        });
      }

      return { success: true };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      logger.error(`任务执行失败: ${err.message}`, 'ERROR');

      task.status = 'error';
      task.lastRunStatus = 'failed';
      task.lastRunMessage = err.message;
      db.upsertTask(task);

      executionLog.status = 'failed';
      executionLog.stage = 'FAILED';
      executionLog.errorMessage = err.message;
      executionLog.durationMs = durationMs;
      executionLog.finishedAt = new Date().toISOString();
      executionLog.logs = logger.entries;
      db.updateExecutionLog(executionLog);

      // Dispatch Failure Alert
      if (task.notifyChannelIds && task.notifyChannelIds.length > 0) {
        NotificationService.dispatch(task.notifyChannelIds, {
          event: 'renew_failed',
          taskName: task.name,
          domains: task.domains,
          errorMessage: err.message
        });
      }

      return { success: false, error: err.message };
    }
  }
}
