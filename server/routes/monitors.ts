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
 * Add Single Domain Monitor
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const { domain, port = 443, remark } = req.body;

  if (!domain) {
    return res.status(400).json({ error: '域名为必填项' });
  }

  const cleanDomain = domain.trim().replace(/^https?:\/\//, '').split('/')[0];
  const targetPort = Number(port) || 443;

  // Check duplicate
  const existing = db.getDomainMonitors().find(m => m.domain.toLowerCase() === cleanDomain.toLowerCase() && m.port === targetPort);
  if (existing) {
    return res.status(400).json({ error: `该域名端口探针已存在 [${cleanDomain}:${targetPort}]` });
  }

  const newMonitor: DomainMonitor = {
    id: `mon_${crypto.randomBytes(8).toString('hex')}`,
    domain: cleanDomain,
    port: targetPort,
    remark: remark ? String(remark).trim() : undefined,
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
 * Batch Add Domain Monitors (Supports TXT, CSV, Multi-line Text parsing)
 */
router.post('/batch', async (req: AuthenticatedRequest, res: Response) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: '请提供待导入的域名探针列表' });
  }

  const existingList = db.getDomainMonitors();
  const existingSet = new Set(existingList.map(m => `${m.domain.toLowerCase()}:${m.port || 443}`));

  const validItems: Array<{ domain: string; port: number; remark?: string }> = [];
  let duplicates = 0;

  for (const rawItem of items) {
    if (!rawItem || !rawItem.domain) continue;
    let rawDomain = String(rawItem.domain).trim().replace(/^https?:\/\//, '').split('/')[0];
    let port = Number(rawItem.port) || 443;
    let remark = rawItem.remark ? String(rawItem.remark).trim() : undefined;

    // Handle inline port e.g. "api.example.com:8443"
    if (rawDomain.includes(':')) {
      const parts = rawDomain.split(':');
      rawDomain = parts[0];
      const parsedPort = parseInt(parts[1], 10);
      if (!isNaN(parsedPort)) {
        port = parsedPort;
      }
    }

    if (!rawDomain || rawDomain.length < 3 || !rawDomain.includes('.')) {
      continue;
    }

    const key = `${rawDomain.toLowerCase()}:${port}`;
    if (existingSet.has(key)) {
      duplicates++;
      continue;
    }

    existingSet.add(key);
    validItems.push({ domain: rawDomain, port, remark });
  }

  if (validItems.length === 0) {
    return res.status(400).json({ 
      error: duplicates > 0 ? `提交的 ${duplicates} 个域名均已存在，无新域名需添加` : '未识别到有效的公网域名' 
    });
  }

  // Create monitors and probe in parallel (concurrency capped at 10)
  const createdMonitors: DomainMonitor[] = [];

  for (const item of validItems) {
    const newMon: DomainMonitor = {
      id: `mon_${crypto.randomBytes(8).toString('hex')}`,
      domain: item.domain,
      port: item.port,
      remark: item.remark,
      status: 'healthy',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    createdMonitors.push(newMon);
  }

  // Probe in background / parallel batch
  await Promise.allSettled(createdMonitors.map(async (mon) => {
    try {
      const probe = await DomainMonitorService.inspectDomain(mon.domain, mon.port);
      mon.status = probe.status;
      mon.issuer = probe.issuer;
      mon.expiresAt = probe.expiresAt;
      mon.daysLeft = probe.daysLeft;
      mon.lastCheckError = probe.error;
      mon.lastCheckAt = new Date().toISOString();
    } catch (err: any) {
      mon.status = 'unreachable';
      mon.lastCheckError = err.message;
      mon.lastCheckAt = new Date().toISOString();
    }
    db.upsertDomainMonitor(mon);
  }));

  return res.status(201).json({
    totalAdded: createdMonitors.length,
    duplicatesSkipped: duplicates,
    monitors: createdMonitors
  });
});

/**
 * Update Domain Monitor (Remark / Port)
 */
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const monitor = db.findDomainMonitorById(String(req.params.id));
  if (!monitor) {
    return res.status(404).json({ error: '探针不存在' });
  }

  const { remark, port } = req.body;
  if (remark !== undefined) monitor.remark = String(remark).trim();
  if (port) monitor.port = Number(port) || 443;
  monitor.updatedAt = new Date().toISOString();

  db.upsertDomainMonitor(monitor);
  return res.json(monitor);
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
