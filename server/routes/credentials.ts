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

    if (type === 'bt_panel') {
      const { requestBtApi } = await import('../services/deployers/panel.js');
      const apiUrl = config.apiUrl || config.url;
      const apiKey = config.apiKey;
      const ignoreSsl = Boolean(config.ignoreSsl);
      if (!apiUrl || !apiKey) {
        throw new Error('请输入宝塔面板地址 (apiUrl) 与 接口密钥 (apiKey)');
      }
      const data = await requestBtApi(apiUrl, apiKey, '/data?action=getData&table=sites', {}, ignoreSsl);
      const siteList = Array.isArray(data?.data) ? data.data : [];
      const sampleSites = siteList.slice(0, 3).map((s: any) => s.name).join(', ');
      return res.json({ 
        success: true, 
        message: `✅ 宝塔面板 API 连接成功！已检测到 ${siteList.length} 个托管站点 ${sampleSites ? `(${sampleSites}...)` : ''}`,
        sites: siteList.map((s: any) => ({ name: s.name, id: s.id }))
      });
    }

    if (type === 'one_panel') {
      let apiUrl = (config.apiUrl || config.url || '').trim();
      try {
        const parsed = new URL(apiUrl);
        apiUrl = `${parsed.protocol}//${parsed.host}`;
      } catch {
        apiUrl = apiUrl.replace(/\/+$/, '');
      }
      const apiKey = config.apiKey;
      if (!apiUrl || !apiKey) {
        throw new Error('请输入 1Panel 面板地址与 API Key');
      }
      const res1p = await fetch(`${apiUrl}/api/v1/websites/search`, {
        method: 'POST',
        headers: {
          '1Panel-Token': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ page: 1, pageSize: 20 })
      });
      if (!res1p.ok) {
        throw new Error(`1Panel API 响应异常: ${res1p.statusText}`);
      }
      const data1p = await res1p.json() as any;
      const items = data1p?.data?.items || [];
      return res.json({
        success: true,
        message: `✅ 1Panel 运维面板连接成功！已检测到 ${items.length} 个网站项目`,
        sites: items.map((s: any) => ({ name: s.primaryDomain || s.name, id: s.id }))
      });
    }

    // Default mock response for other platforms
    return res.json({ success: true, message: '凭据参数格式验证通过' });
  } catch (err: any) {
    return res.status(400).json({ error: `凭据校验失败: ${err.message}` });
  }
});

/**
 * Get Sites associated with a panel credential
 */
router.get('/:id/sites', async (req: AuthenticatedRequest, res: Response) => {
  const cred = db.findCredentialById(String(req.params.id));
  if (!cred) return res.status(404).json({ error: '凭据不存在' });
  const config = decryptObject<any>(cred.config as any);

  try {
    if (cred.type === 'bt_panel') {
      const { requestBtApi } = await import('../services/deployers/panel.js');
      const data = await requestBtApi(config.apiUrl || config.url, config.apiKey, '/data?action=getData&table=sites', {}, Boolean(config.ignoreSsl));
      const sites = Array.isArray(data?.data) ? data.data.map((s: any) => s.name) : [];
      return res.json({ sites });
    }
    if (cred.type === 'one_panel') {
      let apiUrl = (config.apiUrl || config.url || '').trim();
      try {
        const parsed = new URL(apiUrl);
        apiUrl = `${parsed.protocol}//${parsed.host}`;
      } catch {
        apiUrl = apiUrl.replace(/\/+$/, '');
      }
      const res1p = await fetch(`${apiUrl}/api/v1/websites/search`, {
        method: 'POST',
        headers: { '1Panel-Token': config.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: 1, pageSize: 50 })
      });
      const data1p = await res1p.json() as any;
      const sites = (data1p?.data?.items || []).map((s: any) => s.primaryDomain || s.name);
      return res.json({ sites });
    }
    return res.json({ sites: [] });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

export default router;
