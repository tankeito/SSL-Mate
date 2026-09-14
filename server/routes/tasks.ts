import { Router, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/database.js';
import { CertTask } from '../db/schema.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../services/auth.js';
import { TaskOrchestrator } from '../services/orchestrator.js';

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

  const cleanDomains = domains.map((d: string) => d.trim().toLowerCase()).filter(Boolean);

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
    cronExpr,
    notifyChannelIds
  } = req.body;

  // ReloadCommand host execution requires admin role
  if (deployTargets !== undefined && hasLocalReloadCommand(deployTargets) && req.user?.role !== 'admin') {
    return res.status(403).json({ error: '权限不足：修改本地服务重载命令 (reloadCommand) 涉及宿主机系统执行权限，仅系统管理员 (admin) 允许配置' });
  }

  if (name) task.name = name;
  if (domains && Array.isArray(domains)) {
    task.domains = domains.map((d: string) => d.trim().toLowerCase()).filter(Boolean);
  }
  if (acmeAccountId) task.acmeAccountId = acmeAccountId;
  if (dnsCredentialId !== undefined) task.dnsCredentialId = dnsCredentialId;
  if (validationType) task.validationType = validationType;
  if (keyType) task.keyType = keyType;
  if (deployTargets !== undefined) task.deployTargets = deployTargets;
  if (autoRenew !== undefined) task.autoRenew = autoRenew;
  if (renewDaysBefore !== undefined) task.renewDaysBefore = Number(renewDaysBefore);
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

export default router;
