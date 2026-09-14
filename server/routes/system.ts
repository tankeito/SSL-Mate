import { Router, Response } from 'express';
import { db } from '../db/database.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../services/auth.js';

const router = Router();

/**
 * Public endpoint to check system status & SSO enabled state
 */
router.get('/info', (req, res) => {
  const settings = db.getSettings();
  return res.json({
    name: 'SSL-Mate (证书伴侣)',
    version: '1.1.0',
    ssoEnabled: settings.authmate.enabled,
    issuerUrl: settings.authmate.issuerUrl
  });
});

router.use(requireAuth);

/**
 * Dashboard Statistics
 */
router.get('/stats', (req: AuthenticatedRequest, res: Response) => {
  const tasks = db.getTasks();
  const certs = db.getCertificates();
  const monitors = db.getDomainMonitors();
  const logs = db.getExecutionLogs();
  const now = Date.now();

  let activeCertsCount = 0;
  let expiringSoonCount = 0;
  let expiredCount = 0;

  for (const cert of certs) {
    const expMs = new Date(cert.expiresAt).getTime();
    const days = Math.floor((expMs - now) / 86400000);
    if (days <= 0) {
      expiredCount++;
    } else if (days <= 30) {
      expiringSoonCount++;
      activeCertsCount++;
    } else {
      activeCertsCount++;
    }
  }

  const tasksSuccessCount = tasks.filter(t => t.lastRunStatus === 'success').length;
  const tasksFailedCount = tasks.filter(t => t.lastRunStatus === 'failed').length;
  const tasksRunningCount = tasks.filter(t => t.lastRunStatus === 'running').length;

  const healthyMonitorsCount = monitors.filter(m => m.status === 'healthy').length;
  const warningMonitorsCount = monitors.filter(m => m.status === 'warning' || m.status === 'expired').length;

  return res.json({
    totalTasks: tasks.length,
    activeTasks: tasks.filter(t => t.autoRenew).length,
    totalCerts: certs.length,
    activeCerts: activeCertsCount,
    expiringSoonCerts: expiringSoonCount,
    expiredCerts: expiredCount,
    tasksSuccessCount,
    tasksFailedCount,
    tasksRunningCount,
    totalMonitors: monitors.length,
    healthyMonitors: healthyMonitorsCount,
    warningMonitors: warningMonitorsCount,
    recentLogs: logs.slice(0, 10)
  });
});

/**
 * Get System Settings
 */
router.get('/settings', (req: AuthenticatedRequest, res: Response) => {
  const settings = db.getSettings();
  return res.json(settings);
});

import { clearOIDCDiscoveryCache } from '../services/sso.js';

/**
 * Update System Settings (including AuthMate OIDC SSO configuration)
 */
router.put('/settings', requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const { authmate, globalRenewCheckCron, defaultRenewDaysBefore } = req.body;

  const patch: any = {};
  if (authmate !== undefined) patch.authmate = authmate;
  if (globalRenewCheckCron !== undefined) patch.globalRenewCheckCron = globalRenewCheckCron;
  if (defaultRenewDaysBefore !== undefined) patch.defaultRenewDaysBefore = Number(defaultRenewDaysBefore);

  const updated = db.updateSettings(patch);

  clearOIDCDiscoveryCache();

  return res.json(updated);
});

export default router;
