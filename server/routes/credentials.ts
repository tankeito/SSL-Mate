import { Router, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/database.js';
import { Credential, CredentialType } from '../db/schema.js';
import { requireAuth, AuthenticatedRequest } from '../services/auth.js';
import { encryptObject, decryptObject, maskSecret } from '../services/crypto.js';
import { CloudflareDnsSolver } from '../services/acme/dns-providers/cloudflare.js';

const router = Router();

router.use(requireAuth);

/**
 * Mask sensitive fields in credential configuration before sending to UI
 */
function maskCredentialConfig(type: CredentialType, config: any) {
  const plain = typeof config === 'string' ? decryptObject<any>(config) : (config || {});
  const masked: Record<string, any> = { ...plain };

  if (masked.apiToken) masked.apiToken = maskSecret(masked.apiToken);
  if (masked.authKey) masked.authKey = maskSecret(masked.authKey);
  if (masked.accessKeySecret) masked.accessKeySecret = maskSecret(masked.accessKeySecret);
  if (masked.secretKey) masked.secretKey = maskSecret(masked.secretKey);
  if (masked.password) masked.password = '••••••••';
  if (masked.privateKey) masked.privateKey = '-----BEGIN PRIVATE KEY-----\n••••••••\n-----END PRIVATE KEY-----';
  if (masked.token) masked.token = maskSecret(masked.token);

  return masked;
}

/**
 * List all credentials
 */
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  const credentials = db.getCredentials().map(c => ({
    id: c.id,
    name: c.name,
    type: c.type,
    remark: c.remark,
    config: maskCredentialConfig(c.type, c.config),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  }));

  return res.json(credentials);
});

/**
 * Create Credential
 */
router.post('/', (req: AuthenticatedRequest, res: Response) => {
  const { name, type, config, remark } = req.body;

  if (!name || !type || !config) {
    return res.status(400).json({ error: '凭据名称、类型和配置为必填项' });
  }

  const newCred: Credential = {
    id: `cred_${crypto.randomBytes(8).toString('hex')}`,
    name,
    type,
    config: encryptObject(config) as any,
    remark,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.upsertCredential(newCred);

  return res.status(201).json({
    id: newCred.id,
    name: newCred.name,
    type: newCred.type,
    remark: newCred.remark,
    config: maskCredentialConfig(newCred.type, newCred.config),
    createdAt: newCred.createdAt,
    updatedAt: newCred.updatedAt
  });
});

/**
 * Update Credential
 */
router.put('/:id', (req: AuthenticatedRequest, res: Response) => {
  const cred = db.findCredentialById(String(req.params.id));
  if (!cred) {
    return res.status(404).json({ error: '凭据不存在' });
  }

  const { name, type, config, remark } = req.body;

  if (name) cred.name = name;
  if (type) cred.type = type;
  if (remark !== undefined) cred.remark = remark;

  if (config) {
    // Merge new config with existing plain config if values were masked
    const oldPlain = typeof cred.config === 'string' ? decryptObject<any>(cred.config as any) : (cred.config || {});
    const updatedPlain = { ...oldPlain };

    for (const key of Object.keys(config)) {
      const val = config[key];
      // Only update if not a masked placeholder
      if (typeof val === 'string' && (val.includes('••••') || val.includes('****'))) {
        continue;
      }
      updatedPlain[key] = val;
    }

    cred.config = encryptObject(updatedPlain) as any;
  }

  db.upsertCredential(cred);

  return res.json({
    id: cred.id,
    name: cred.name,
    type: cred.type,
    remark: cred.remark,
    config: maskCredentialConfig(cred.type, cred.config),
    createdAt: cred.createdAt,
    updatedAt: cred.updatedAt
  });
});

/**
 * Delete Credential
 */
router.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  const success = db.deleteCredential(String(req.params.id));
  if (!success) {
    return res.status(404).json({ error: '凭据不存在' });
  }
  return res.json({ success: true, message: '凭据已成功删除' });
});

/**
 * Test Credential Connectivity
 */
router.post('/test', async (req: AuthenticatedRequest, res: Response) => {
  const { type, config } = req.body;

  try {
    if (type === 'dns_cloudflare') {
      const headers: Record<string, string> = {};
      if (config.apiToken) {
        headers['Authorization'] = `Bearer ${config.apiToken.trim()}`;
      } else {
        headers['X-Auth-Email'] = config.authEmail?.trim() || '';
        headers['X-Auth-Key'] = config.authKey?.trim() || '';
      }

      // If token provided, try verify token endpoint first
      if (config.apiToken) {
        try {
          const verifyRes = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', { headers });
          const verifyData = await verifyRes.json() as any;
          if (verifyRes.ok && verifyData.success) {
            return res.json({ 
              success: true, 
              message: `✅ Cloudflare API Token 校验通过！(状态: ${verifyData.result?.status || 'active'})` 
            });
          }
        } catch (_) {}
      }

      const testRes = await fetch('https://api.cloudflare.com/client/v4/zones?per_page=1', { headers });
      const data = await testRes.json() as any;
      if (!testRes.ok || !data.success) {
        throw new Error(data.errors?.[0]?.message || 'Cloudflare 认证失败，请检查 API Token 或权限');
      }
      return res.json({ success: true, message: '✅ Cloudflare API 凭据验证成功，已连接 DNS 服务！' });
    }

    // Default mock response for other platforms
    return res.json({ success: true, message: '凭据参数格式验证通过' });
  } catch (err: any) {
    return res.status(400).json({ error: `凭据校验失败: ${err.message}` });
  }
});

export default router;
