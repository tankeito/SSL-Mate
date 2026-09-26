import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../services/auth.js';
import { BackupService } from '../services/backup.js';

const router = Router();

router.use(requireAuth);

/**
 * POST /api/backup/export
 * Download encrypted full disaster recovery backup package (Admin only)
 */
router.post('/export', requireRole(['admin']), (req: Request, res: Response) => {
  const password = typeof req.body.password === 'string' ? req.body.password : undefined;

  try {
    const backupEnvelope = BackupService.exportBackup(password);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `sslmate-backup-${dateStr}${backupEnvelope.isEncrypted ? '-encrypted' : ''}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(JSON.stringify(backupEnvelope, null, 2));
  } catch (err: any) {
    return res.status(500).json({ error: `灾备导出失败: ${err.message}` });
  }
});

/**
 * POST /api/backup/restore
 * Restore full system from backup payload (Admin only)
 */
router.post('/restore', requireRole(['admin']), (req: Request, res: Response) => {
  const { backupContent, password } = req.body;

  if (!backupContent || typeof backupContent !== 'string') {
    return res.status(400).json({ error: '请提供待还原的备份数据内容' });
  }

  try {
    const result = BackupService.restoreBackup(backupContent, password);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/backup/snapshots
 * List local snapshots
 */
router.get('/snapshots', requireRole(['admin']), (req: Request, res: Response) => {
  try {
    const snapshots = BackupService.listLocalSnapshots();
    return res.json({ total: snapshots.length, snapshots });
  } catch (err: any) {
    return res.status(500).json({ error: `获取快照列表失败: ${err.message}` });
  }
});

/**
 * POST /api/backup/snapshots
 * Manually trigger local snapshot creation
 */
router.post('/snapshots', requireRole(['admin']), (req: Request, res: Response) => {
  try {
    const filename = BackupService.createLocalSnapshot(req.body.label);
    return res.status(201).json({ success: true, filename, message: '本地快照已成功创建' });
  } catch (err: any) {
    return res.status(500).json({ error: `创建快照失败: ${err.message}` });
  }
});

export default router;
