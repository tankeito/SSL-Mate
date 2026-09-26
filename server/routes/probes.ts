import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../services/auth.js';
import { ProbeMatrixService } from '../services/probe-matrix.js';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/probes/nodes
 * List all available probe nodes in the matrix
 */
router.get('/nodes', (req: Request, res: Response) => {
  const nodes = ProbeMatrixService.listNodes();
  return res.json({ total: nodes.length, nodes });
});

/**
 * POST /api/probes/matrix-check
 * Trigger multi-region distributed probe check for a domain
 */
router.post('/matrix-check', async (req: Request, res: Response) => {
  const { domain, port } = req.body;
  if (!domain) {
    return res.status(400).json({ error: '域名 (domain) 不能为空' });
  }

  try {
    const report = await ProbeMatrixService.probeDomainMatrix(domain, Number(port) || 443);
    return res.json(report);
  } catch (err: any) {
    return res.status(500).json({ error: `探针矩阵探测失败: ${err.message}` });
  }
});

/**
 * POST /api/probes/register
 * Register an external probe node
 */
router.post('/register', requireRole(['admin']), (req: Request, res: Response) => {
  const { name, region, endpoint } = req.body;
  if (!name || !region) {
    return res.status(400).json({ error: '探针节点名称及所属地域不能为空' });
  }

  const newNode = ProbeMatrixService.registerNode({ name, region, endpoint });
  return res.status(201).json(newNode);
});

/**
 * POST /api/probes/heartbeat
 * Heartbeat ping from an external agent node
 */
router.post('/heartbeat', (req: Request, res: Response) => {
  const { nodeId, latencyMs } = req.body;
  if (!nodeId) return res.status(400).json({ error: 'nodeId 必填' });

  const ok = ProbeMatrixService.heartbeat(nodeId, latencyMs ? Number(latencyMs) : undefined);
  if (ok) return res.json({ success: true, message: '心跳接收成功' });
  return res.status(404).json({ error: '未找到该探针节点' });
});

export default router;
