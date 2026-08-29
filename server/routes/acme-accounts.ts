import { Router, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/database.js';
import { AcmeAccount } from '../db/schema.js';
import { requireAuth, AuthenticatedRequest } from '../services/auth.js';
import { encrypt, maskSecret } from '../services/crypto.js';

const router = Router();

router.use(requireAuth);

const CA_DIRECTORIES: Record<string, string> = {
  letsencrypt: 'https://acme-v02.api.letsencrypt.org/directory',
  letsencrypt_staging: 'https://acme-staging-v02.api.letsencrypt.org/directory',
  zerossl: 'https://acme.zerossl.com/v2/DV90',
  google: 'https://dv.acme-v02.api.pki.goog/directory'
};

/**
 * List all ACME CA accounts
 */
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  const accounts = db.getAcmeAccounts().map(a => ({
    id: a.id,
    name: a.name,
    caProvider: a.caProvider,
    email: a.email,
    directoryUrl: a.directoryUrl,
    eabKid: a.eabKid ? maskSecret(a.eabKid) : undefined,
    hasEabHmac: !!a.eabHmacKey,
    isDefault: a.isDefault,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt
  }));

  return res.json(accounts);
});

/**
 * Create ACME Account
 */
router.post('/', (req: AuthenticatedRequest, res: Response) => {
  const { name, caProvider, email, directoryUrl, eabKid, eabHmacKey, isDefault } = req.body;

  if (!name || !caProvider || !email) {
    return res.status(400).json({ error: '账户名称、CA 服务商和邮箱为必填项' });
  }

  const resolvedDirUrl = directoryUrl || CA_DIRECTORIES[caProvider] || CA_DIRECTORIES.letsencrypt;

  const newAccount: AcmeAccount = {
    id: `acme_${crypto.randomBytes(8).toString('hex')}`,
    name,
    caProvider,
    email,
    directoryUrl: resolvedDirUrl,
    eabKid: eabKid ? eabKid.trim() : undefined,
    eabHmacKey: eabHmacKey ? encrypt(eabHmacKey.trim()) : undefined,
    isDefault: Boolean(isDefault),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.upsertAcmeAccount(newAccount);

  return res.status(201).json(newAccount);
});

/**
 * Update ACME Account
 */
router.put('/:id', (req: AuthenticatedRequest, res: Response) => {
  const account = db.findAcmeAccountById(String(req.params.id));
  if (!account) {
    return res.status(404).json({ error: 'ACME 账户不存在' });
  }

  const { name, caProvider, email, directoryUrl, eabKid, eabHmacKey, isDefault } = req.body;

  if (name) account.name = name;
  if (caProvider) account.caProvider = caProvider;
  if (email) account.email = email;
  if (directoryUrl) account.directoryUrl = directoryUrl;
  if (eabKid !== undefined && !eabKid.includes('****')) account.eabKid = eabKid;
  if (eabHmacKey) account.eabHmacKey = encrypt(eabHmacKey.trim());
  if (isDefault !== undefined) account.isDefault = Boolean(isDefault);

  db.upsertAcmeAccount(account);

  return res.json(account);
});

/**
 * Delete ACME Account
 */
router.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  const success = db.deleteAcmeAccount(String(req.params.id));
  if (!success) {
    return res.status(404).json({ error: 'ACME 账户不存在' });
  }
  return res.json({ success: true, message: 'ACME 账户已成功删除' });
});

export default router;
