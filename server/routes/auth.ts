import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/database.js';
import { verifyPassword, hashPassword, generateToken, requireAuth, AuthenticatedRequest } from '../services/auth.js';
import { buildSSOAuthorizationUrl, exchangeCodeForTokens, fetchUserInfo, provisionSSOUser, generatePKCE } from '../services/sso.js';

import { verifyTotpToken } from '../services/totp.js';
import { decrypt } from '../services/crypto.js';

const router = Router();

// Store PKCE verifiers in memory for state correlation
const pkceStore = new Map<string, { verifier: string; timestamp: number }>();

// Clean up expired PKCE states every 10 mins
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of pkceStore.entries()) {
    if (now - data.timestamp > 600000) {
      pkceStore.delete(state);
    }
  }
}, 600000);

/**
 * Local Admin Login (Break-Glass / 灾备应急登录，支持 TOTP 2FA)
 */
router.post('/login', (req: Request, res: Response) => {
  const { username, password, totpCode } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }

  const user = db.findUserByUsername(username) || db.findUserByEmail(username);
  if (!user) {
    return res.status(401).json({ error: '用户名或邮箱不存在' });
  }

  if (!user.isActive) {
    return res.status(403).json({ error: '该账户已被停用' });
  }

  if (!user.passwordHash) {
    return res.status(401).json({ 
      error: '该账号为 AuthMate SSO 托管账号，未设置本地应急密码，请使用上方的【使用 AuthMate 账号一键登录】' 
    });
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: '密码输入不正确，请重新输入' });
  }

  // Check if user has 2FA enabled
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    if (!totpCode) {
      return res.json({
        requiresTwoFactor: true,
        userId: user.id,
        username: user.username,
        message: '该账号已开启双因素身份验证 (2FA)，请输入身份验证器 6 位动态验证码'
      });
    }

    const plainSecret = decrypt(user.twoFactorSecret);
    const isTotpValid = verifyTotpToken(plainSecret, String(totpCode));
    if (!isTotpValid) {
      return res.status(401).json({ error: '2FA 双因素动态验证码错误或已过期，请重新输入' });
    }
  }

  user.lastLoginAt = new Date().toISOString();
  db.upsertUser(user);

  const token = generateToken(user);

  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      authSource: user.authSource,
      avatarUrl: user.avatarUrl
    }
  });
});

/**
 * Get AuthMate SSO Authorization URL
 */
router.get('/sso/url', async (req: Request, res: Response) => {
  try {
    const settings = db.getSettings().authmate;
    if (!settings.enabled) {
      return res.status(400).json({ error: 'AuthMate SSO 未启用' });
    }

    const { verifier, challenge } = generatePKCE();
    const state = crypto.randomBytes(16).toString('hex');

    pkceStore.set(state, { verifier, timestamp: Date.now() });

    const authUrl = await buildSSOAuthorizationUrl(state, challenge);

    return res.json({
      authUrl,
      state
    });
  } catch (err: any) {
    return res.status(500).json({ error: `生成 SSO 登录链接失败: ${err.message}` });
  }
});

/**
 * Handle AuthMate SSO Callback with Authorization Code
 */
router.post('/sso/callback', async (req: Request, res: Response) => {
  const { code, state } = req.body;

  if (!code || !state) {
    return res.status(400).json({ error: '缺少 Authorization Code 或 State 参数' });
  }

  const pkceData = pkceStore.get(state);
  const codeVerifier = pkceData?.verifier;
  pkceStore.delete(state);

  try {
    const tokens = await exchangeCodeForTokens(code, codeVerifier);
    const profile = await fetchUserInfo(tokens.access_token);
    const user = provisionSSOUser(profile);

    const token = generateToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        authSource: user.authSource,
        avatarUrl: user.avatarUrl
      }
    });
  } catch (err: any) {
    console.error('SSO Callback error:', err);
    return res.status(400).json({ error: `AuthMate SSO 登录校验失败: ${err.message}` });
  }
});

/**
 * Get Current User Profile
 */
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = db.findUserById(req.user!.userId);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  return res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    authSource: user.authSource,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt
  });
});

/**
 * Change Local Admin Password
 */
router.post('/change-password', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { oldPassword, newPassword } = req.body;
  const user = db.findUserById(req.user!.userId);

  if (!user || user.authSource !== 'local') {
    return res.status(400).json({ error: '仅支持修改本地账号密码，SSO 账号请前往 AuthMate 管理中心' });
  }

  if (!user.passwordHash || !verifyPassword(oldPassword, user.passwordHash)) {
    return res.status(400).json({ error: '原密码输入不正确' });
  }

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: '新密码长度至少需要 6 个字符' });
  }

  user.passwordHash = hashPassword(newPassword);
  db.upsertUser(user);

  return res.json({ success: true, message: '密码修改成功' });
});

export default router;
