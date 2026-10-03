import { Router, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/database.js';
import { CertTask } from '../db/schema.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../services/auth.js';
import { TaskOrchestrator } from '../services/orchestrator.js';
import { sanitizeDomain, isValidDomain } from '../services/domain-sanitizer.js';

function hasLocalReloadCommand(deployTargets: any[]): boolean {
  if (!Array.isArray(deployTargets)) return false;
  return deployTargets.some(t => t?.type === 'local' && t?.config?.reloadCommand && String(t.config.reloadCommand).trim().length > 0);
}

const router = Router();

router.use(requireAuth);

/**
 * List all certificate tasks
 */
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  const tasks = db.getTasks();
  const certs = db.getCertificates();
  const now = Date.now();

  const enrichedTasks = tasks.map(task => {
    let daysRemaining = null;
    let certExpiresAt = null;
    let certIssuer = null;

    if (task.currentCertId) {
      const cert = certs.find(c => c.id === task.currentCertId);
      if (cert) {
        certExpiresAt = cert.expiresAt;
        certIssuer = cert.issuer;
        const diffMs = new Date(cert.expiresAt).getTime() - now;
        daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      }
    }

    return {
      ...task,
      daysRemaining,
      certExpiresAt,
      certIssuer
    };
  });

  return res.json(enrichedTasks);
});

/**
 * Get Task by ID
 */
router.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  const task = db.findTaskById(String(req.params.id));
  if (!task) {
    return res.status(404).json({ error: '任务不存在' });
  }
  return res.json(task);
});

/**
 * Create Task (3-Step Wizard payload)
 */
router.post('/', requireRole(['admin', 'operator']), (req: AuthenticatedRequest, res: Response) => {
  const {
    name,
    domains,
    acmeAccountId,
    dnsCredentialId,
    validationType = 'dns-01',
    keyType = 'ec256',
    deployTargets = [],
    autoRenew = true,
    renewDaysBefore = 30,
    alertDaysBefore,
    cronExpr = '0 2 * * *',
    notifyChannelIds = []
  } = req.body;

  if (!name || !domains || !Array.isArray(domains) || domains.length === 0) {
    return res.status(400).json({ error: '任务名称及至少一个域名为必填项' });
  }

  if (!acmeAccountId) {
    return res.status(400).json({ error: '请选择关联的 ACME CA 账户' });
  }

  // ReloadCommand host execution requires admin role
  if (hasLocalReloadCommand(deployTargets) && req.user?.role !== 'admin') {
    return res.status(403).json({ error: '权限不足：配置本地服务重载命令 (reloadCommand) 涉及宿主机系统执行权限，仅系统管理员 (admin) 允许配置' });
  }

  const cleanDomains = domains.map((d: string) => sanitizeDomain(d)).filter(Boolean);

  if (cleanDomains.length === 0) {
    return res.status(400).json({ error: '请至少提供一个有效的申请域名' });
  }

  for (const d of cleanDomains) {
    if (!isValidDomain(d)) {
      return res.status(400).json({
        error: `域名格式不符合 ACME 规范: [${d}]。请填写纯域名（例如 key.btc354.com 或 *.btc354.com），无需包含 http:// 或路径。`
      });
    }
  }

  const newTask: CertTask = {
    id: `task_${crypto.randomBytes(8).toString('hex')}`,
    name,
    domains: cleanDomains,
    acmeAccountId,
    dnsCredentialId,
    validationType,
    keyType,
    deployTargets,
    autoRenew,
    renewDaysBefore: Number(renewDaysBefore) || 30,
    alertDaysBefore: alertDaysBefore !== undefined ? Number(alertDaysBefore) : undefined,
    cronExpr,
    notifyChannelIds,
    status: 'pending',
    lastRunStatus: 'idle',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.upsertTask(newTask);

  return res.status(201).json(newTask);
});

/**
 * Update Task
 */
router.put('/:id', requireRole(['admin', 'operator']), (req: AuthenticatedRequest, res: Response) => {
  const task = db.findTaskById(String(req.params.id));
  if (!task) {
    return res.status(404).json({ error: '任务不存在' });
  }

  const {
    name,
    domains,
    acmeAccountId,
    dnsCredentialId,
    validationType,
    keyType,
    deployTargets,
    autoRenew,
    renewDaysBefore,
    alertDaysBefore,
    cronExpr,
    notifyChannelIds
  } = req.body;

  // ReloadCommand host execution requires admin role
  if (deployTargets !== undefined && hasLocalReloadCommand(deployTargets) && req.user?.role !== 'admin') {
    return res.status(403).json({ error: '权限不足：修改本地服务重载命令 (reloadCommand) 涉及宿主机系统执行权限，仅系统管理员 (admin) 允许配置' });
  }

  if (name) task.name = name;
  if (domains && Array.isArray(domains)) {
    const cleanDomains = domains.map((d: string) => sanitizeDomain(d)).filter(Boolean);
    if (cleanDomains.length === 0) {
      return res.status(400).json({ error: '请至少提供一个有效的申请域名' });
    }
    for (const d of cleanDomains) {
      if (!isValidDomain(d)) {
        return res.status(400).json({
          error: `域名格式不符合 ACME 规范: [${d}]。请填写纯域名（例如 key.btc354.com 或 *.btc354.com），无需包含 http:// 或路径。`
        });
      }
    }
    task.domains = cleanDomains;
  }
  if (acmeAccountId) task.acmeAccountId = acmeAccountId;
  if (dnsCredentialId !== undefined) task.dnsCredentialId = dnsCredentialId;
  if (validationType) task.validationType = validationType;
  if (keyType) task.keyType = keyType;
  if (deployTargets !== undefined) task.deployTargets = deployTargets;
  if (autoRenew !== undefined) task.autoRenew = autoRenew;
  if (renewDaysBefore !== undefined) task.renewDaysBefore = Number(renewDaysBefore);
  if (alertDaysBefore !== undefined) task.alertDaysBefore = Number(alertDaysBefore);
  if (cronExpr) task.cronExpr = cronExpr;
  if (notifyChannelIds !== undefined) task.notifyChannelIds = notifyChannelIds;

  db.upsertTask(task);

  return res.json(task);
});

/**
 * Delete Task
 */
router.delete('/:id', requireRole(['admin', 'operator']), (req: AuthenticatedRequest, res: Response) => {
  const success = db.deleteTask(String(req.params.id));
  if (!success) {
    return res.status(404).json({ error: '任务不存在' });
  }
  return res.json({ success: true, message: '任务已成功删除' });
});

/**
 * Trigger Immediate Manual Execution of Task
 */
router.post('/:id/run', requireRole(['admin', 'operator']), async (req: AuthenticatedRequest, res: Response) => {
  const task = db.findTaskById(String(req.params.id));
  if (!task) {
    return res.status(404).json({ error: '任务不存在' });
  }

  if (task.lastRunStatus === 'running') {
    return res.status(409).json({ error: '当前任务正在执行中，请勿重复触发' });
  }

  // Execute in background
  TaskOrchestrator.executeTask(task.id, 'manual').catch(err => {
    console.error(`Task ${task.id} execution error:`, err);
  });

  return res.json({
    success: true,
    message: '任务已启动，正在后台自动化执行',
    taskId: task.id
  });
});

/**
 * Get Task Execution Logs
 */
router.get('/:id/logs', (req: AuthenticatedRequest, res: Response) => {
  const logs = db.getExecutionLogs(String(req.params.id));
  return res.json(logs);
});

/**
 * Delete a single execution log by ID
 */
router.delete('/logs/:logId', requireRole(['admin', 'operator']), (req: AuthenticatedRequest, res: Response) => {
  const logId = String(req.params.logId);
  const success = db.deleteExecutionLog(logId);
  if (!success) {
    return res.status(404).json({ error: '执行记录不存在或已被删除' });
  }
  return res.json({ success: true, message: '执行日志记录已成功删除' });
});

/**
 * Clear execution logs (e.g., status=failed or by taskId)
 */
router.delete('/logs', requireRole(['admin', 'operator']), (req: AuthenticatedRequest, res: Response) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const taskId = req.query.taskId ? String(req.query.taskId) : undefined;
  const count = db.clearExecutionLogs({ status, taskId });
  return res.json({ success: true, count, message: `已成功清空 ${count} 条执行记录` });
});

export default router;
