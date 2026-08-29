import { Router, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/database.js';
import { User, Role } from '../db/schema.js';
import { requireAuth, requireRole, AuthenticatedRequest, hashPassword } from '../services/auth.js';

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
  const { username, email, password, role = 'operator', isActive = true } = req.body;

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

  db.upsertUser(user);

  return res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    authSource: user.authSource,
    role: user.role,
    isActive: user.isActive,
    updatedAt: user.updatedAt
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
