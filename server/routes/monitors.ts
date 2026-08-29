import { Router, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/database.js';
import { DomainMonitor } from '../db/schema.js';
import { requireAuth, AuthenticatedRequest } from '../services/auth.js';
import { DomainMonitorService } from '../services/monitor.js';

const router = Router();

router.use(requireAuth);

/**
 * List all domain TLS health monitors
 */
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  const monitors = db.getDomainMonitors();
  return res.json(monitors);
});

/**
 * Add Domain Monitor
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const { domain, port = 443 } = req.body;

  if (!domain) {
    return res.status(400).json({ error: '域名为必填项' });
  }

  const cleanDomain = domain.trim().replace(/^https?:\/\//, '').split('/')[0];

  const newMonitor: DomainMonitor = {
    id: `mon_${crypto.randomBytes(8).toString('hex')}`,
    domain: cleanDomain,
    port: Number(port) || 443,
    status: 'healthy',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Run immediate inspection
  try {
    const probe = await DomainMonitorService.inspectDomain(newMonitor.domain, newMonitor.port);
    newMonitor.status = probe.status;
    newMonitor.issuer = probe.issuer;
    newMonitor.expiresAt = probe.expiresAt;
    newMonitor.daysLeft = probe.daysLeft;
    newMonitor.lastCheckError = probe.error;
    newMonitor.lastCheckAt = new Date().toISOString();
  } catch (err: any) {
    newMonitor.status = 'unreachable';
    newMonitor.lastCheckError = err.message;
    newMonitor.lastCheckAt = new Date().toISOString();
  }

  db.upsertDomainMonitor(newMonitor);

  return res.status(201).json(newMonitor);
});

/**
 * Trigger immediate health check for a domain monitor
 */
router.post('/:id/check', async (req: AuthenticatedRequest, res: Response) => {
  const monitor = db.findDomainMonitorById(String(req.params.id));
  if (!monitor) {
    return res.status(404).json({ error: '探针不存在' });
  }

  try {
    const probe = await DomainMonitorService.inspectDomain(monitor.domain, monitor.port || 443);
    monitor.status = probe.status;
    monitor.issuer = probe.issuer;
    monitor.expiresAt = probe.expiresAt;
    monitor.daysLeft = probe.daysLeft;
    monitor.lastCheckError = probe.error;
    monitor.lastCheckAt = new Date().toISOString();
    db.upsertDomainMonitor(monitor);

    return res.json(monitor);
  } catch (err: any) {
    monitor.status = 'unreachable';
    monitor.lastCheckError = err.message;
    monitor.lastCheckAt = new Date().toISOString();
    db.upsertDomainMonitor(monitor);

    return res.json(monitor);
  }
});

/**
 * Delete Domain Monitor
 */
router.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  const success = db.deleteDomainMonitor(String(req.params.id));
  if (!success) {
    return res.status(404).json({ error: '探针不存在' });
  }
  return res.json({ success: true, message: '域名探针已删除' });
});

export default router;
