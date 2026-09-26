import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../services/auth.js';
import { CtMonitorService } from '../services/ct-monitor.js';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/ct-monitor/logs?domain=example.com
 * Query public CT logs for a domain
 */
router.get('/logs', async (req: Request, res: Response) => {
  const domain = String(req.query.domain || '').trim();
  if (!domain) {
    return res.status(400).json({ error: '请指定待查询的域名 (domain)' });
  }

  try {
    const logs = await CtMonitorService.searchDomain(domain);
    return res.json({ domain, total: logs.length, logs });
  } catch (err: any) {
    return res.status(500).json({ error: `CT 日志查询失败: ${err.message}` });
  }
});

/**
 * POST /api/ct-monitor/scan
 * Trigger on-demand CT scan for a specific domain or all monitored domains
 */
router.post('/scan', requireRole(['admin', 'operator']), async (req: Request, res: Response) => {
  const domain = String(req.body.domain || '').trim();

  try {
    if (domain) {
      const result = await CtMonitorService.scanDomain(domain);
      return res.json(result);
    } else {
      const allResults = await CtMonitorService.scanAll();
      return res.json({ totalDomainsScanned: allResults.length, results: allResults });
    }
  } catch (err: any) {
    return res.status(500).json({ error: `CT 扫描执行失败: ${err.message}` });
  }
});

export default router;
