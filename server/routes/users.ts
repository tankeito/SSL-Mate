import { Router, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/database.js';
import { User, Role } from '../db/schema.js';
import { requireAuth, requireRole, AuthenticatedRequest, hashPassword } from '../services/auth.js';
import { generateTotpSecret, verifyTotpToken } from '../services/totp.js';
import { encrypt, decrypt } from '../services/crypto.js';

const router = Router();

router.use(requireAuth);

/**
 * List all users
 */
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  const users = db.getUsers().map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    authSource: u.authSource,
    role: u.role,
    ssoSub: u.ssoSub,
    avatarUrl: u.avatarUrl,
    isActive: u.isActive,
    twoFactorEnabled: Boolean(u.twoFactorEnabled),
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt
  }));

  return res.json(users);
});

/**
 * Create new user
 */
router.post('/', requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const { username, email, password, role = 'operator', isActive = true, twoFactorEnabled = false } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: '邮箱和初始密码为必填项' });
  }

  const existingEmail = db.findUserByEmail(email);
  if (existingEmail) {
    return res.status(400).json({ error: '该邮箱已被注册使用' });
  }

  const userDisplayName = (username || email.split('@')[0]).trim();
  const passwordHash = hashPassword(password);

  const newUser: User = {
    id: `usr_${crypto.randomBytes(8).toString('hex')}`,
    username: userDisplayName,
    email: email.trim().toLowerCase(),
    passwordHash,
    authSource: 'local',
    role: role as Role,
    isActive: Boolean(isActive),
    twoFactorEnabled: Boolean(twoFactorEnabled),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.upsertUser(newUser);

  return res.status(201).json({
    id: newUser.id,
    username: newUser.username,
    email: newUser.email,
    authSource: newUser.authSource,
    role: newUser.role,
    isActive: newUser.isActive,
    twoFactorEnabled: newUser.twoFactorEnabled,
    createdAt: newUser.createdAt
  });
});

/**
 * Update user (Role, Active Status, or Reset Password)
 */
router.put('/:id', requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const targetId = String(req.params.id);
  const user = db.findUserById(targetId);

  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  const { username, role, isActive, password } = req.body;

  // Prevent disabling self
  if (targetId === req.user?.userId && isActive === false) {
    return res.status(400).json({ error: '禁止停用当前正在登录的管理员自身账号' });
  }

  if (username) user.username = username.trim();
  if (role) user.role = role as Role;
  if (isActive !== undefined) user.isActive = Boolean(isActive);
  if (password && password.trim()) {
    user.passwordHash = hashPassword(password.trim());
  }
  user.updatedAt = new Date().toISOString();

  db.upsertUser(user);

  return res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    authSource: user.authSource,
    role: user.role,
    isActive: user.isActive,
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    updatedAt: user.updatedAt
  });
});

/**
 * Generate 2FA Secret & Setup details
 */
router.post('/:id/2fa/setup', (req: AuthenticatedRequest, res: Response) => {
  const targetId = String(req.params.id);
  const user = db.findUserById(targetId);

  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  // Only admin or self can setup 2FA
  if (req.user?.role !== 'admin' && req.user?.userId !== targetId) {
    return res.status(403).json({ error: '无权操作此账号的 2FA 设置' });
  }

  const { secret, otpauthUrl } = generateTotpSecret(user.email, 'SSL-Mate');

  return res.json({
    secret,
    otpauthUrl,
    email: user.email
  });
});

/**
 * Confirm and Enable 2FA with verification code
 */
router.post('/:id/2fa/verify', (req: AuthenticatedRequest, res: Response) => {
  const targetId = String(req.params.id);
  const user = db.findUserById(targetId);

  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  if (req.user?.role !== 'admin' && req.user?.userId !== targetId) {
    return res.status(403).json({ error: '无权操作此账号的 2FA 设置' });
  }

  const { secret, code } = req.body;
  if (!secret || !code) {
    return res.status(400).json({ error: '缺少密钥或 6 位动态验证码' });
  }

  const isValid = verifyTotpToken(secret, String(code));
  if (!isValid) {
    return res.status(400).json({ error: '动态验证码错误，请重新在身份验证器中查看 6 位数字' });
  }

  user.twoFactorEnabled = true;
  user.twoFactorSecret = encrypt(secret);
  user.updatedAt = new Date().toISOString();

  db.upsertUser(user);

  return res.json({
    success: true,
    message: '双因素身份验证 (2FA) 已成功启用！下次登录时需输入验证码。'
  });
});

/**
 * Disable 2FA
 */
router.post('/:id/2fa/disable', (req: AuthenticatedRequest, res: Response) => {
  const targetId = String(req.params.id);
  const user = db.findUserById(targetId);

  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  if (req.user?.role !== 'admin' && req.user?.userId !== targetId) {
    return res.status(403).json({ error: '无权操作此账号的 2FA 设置' });
  }

  user.twoFactorEnabled = false;
  user.twoFactorSecret = undefined;
  user.updatedAt = new Date().toISOString();

  db.upsertUser(user);

  return res.json({
    success: true,
    message: '双因素身份验证 (2FA) 已关闭'
  });
});

/**
 * Delete user
 */
router.delete('/:id', requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const targetId = String(req.params.id);

  if (targetId === req.user?.userId) {
    return res.status(400).json({ error: '禁止删除当前正在登录的账号' });
  }

  const success = db.deleteUser(targetId);
  if (!success) {
    return res.status(404).json({ error: '用户不存在' });
  }

  return res.json({ success: true, message: '用户已成功删除' });
});

export default router;
