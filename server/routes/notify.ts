import { Router, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/database.js';
import { NotifyChannel } from '../db/schema.js';
import { requireAuth, AuthenticatedRequest } from '../services/auth.js';
import { encryptObject, decryptObject, maskSecret } from '../services/crypto.js';
import { NotificationService } from '../services/notify.js';

const router = Router();

router.use(requireAuth);

function maskChannelConfig(config: any) {
  const plain = decryptObject<any>(config);
  const masked = { ...plain };
  if (masked.secret) masked.secret = maskSecret(masked.secret);
  if (masked.botToken) masked.botToken = maskSecret(masked.botToken);
  if (masked.password) masked.password = '••••••••';
  return masked;
}

/**
 * List all notification channels
 */
router.get('/channels', (req: AuthenticatedRequest, res: Response) => {
  const channels = db.getNotifyChannels().map(c => ({
    id: c.id,
    name: c.name,
    type: c.type,
    isEnabled: c.isEnabled,
    events: c.events,
    config: maskChannelConfig(c.config),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  }));

  return res.json(channels);
});

/**
 * Create notification channel
 */
router.post('/channels', (req: AuthenticatedRequest, res: Response) => {
  const { name, type, isEnabled = true, events = ['renew_success', 'renew_failed', 'expiring_soon'], config } = req.body;

  if (!name || !type || !config) {
    return res.status(400).json({ error: '通道名称、类型和配置为必填项' });
  }

  const newChannel: NotifyChannel = {
    id: `notify_${crypto.randomBytes(8).toString('hex')}`,
    name,
    type,
    isEnabled: Boolean(isEnabled),
    events,
    config: encryptObject(config) as any,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.upsertNotifyChannel(newChannel);

  return res.status(201).json({
    ...newChannel,
    config: maskChannelConfig(newChannel.config)
  });
});

/**
 * Update notification channel
 */
router.put('/channels/:id', (req: AuthenticatedRequest, res: Response) => {
  const channel = db.findNotifyChannelById(String(req.params.id));
  if (!channel) {
    return res.status(404).json({ error: '通知通道不存在' });
  }

  const { name, type, isEnabled, events, config } = req.body;

  if (name) channel.name = name;
  if (type) channel.type = type;
  if (isEnabled !== undefined) channel.isEnabled = Boolean(isEnabled);
  if (events) channel.events = events;

  if (config) {
    const oldPlain = decryptObject<any>(channel.config as any);
    const updatedPlain = { ...oldPlain };
    for (const key of Object.keys(config)) {
      const val = config[key];
      if (typeof val === 'string' && (val.includes('••••') || val.includes('****'))) {
        continue;
      }
      updatedPlain[key] = val;
    }
    channel.config = encryptObject(updatedPlain) as any;
  }

  db.upsertNotifyChannel(channel);

  return res.json({
    ...channel,
    config: maskChannelConfig(channel.config)
  });
});

/**
 * Delete notification channel
 */
router.delete('/channels/:id', (req: AuthenticatedRequest, res: Response) => {
  const success = db.deleteNotifyChannel(String(req.params.id));
  if (!success) {
    return res.status(404).json({ error: '通知通道不存在' });
  }
  return res.json({ success: true, message: '通知通道已删除' });
});

/**
 * Test send notification
 */
router.post('/test', async (req: AuthenticatedRequest, res: Response) => {
  const { type, config } = req.body;

  const mockChannel: NotifyChannel = {
    id: 'test_temp',
    name: '测试通道',
    type,
    config: encryptObject(config) as any,
    isEnabled: true,
    events: ['renew_success'],
    createdAt: '',
    updatedAt: ''
  };

  try {
    await NotificationService.sendToChannel(mockChannel, {
      event: 'renew_success',
      taskName: '测试任务 (Test Task)',
      domains: ['test.example.com'],
      expiresAt: new Date(Date.now() + 90 * 86400000).toISOString()
    });

    return res.json({ success: true, message: '测试通知已成功发送！请在对应客户端查收' });
  } catch (err: any) {
    return res.status(400).json({ error: `测试发送失败: ${err.message}` });
  }
});

export default router;
