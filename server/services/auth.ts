import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db/database.js';
import { User, Role } from '../db/schema.js';

export interface JwtPayload {
  userId: string;
  username: string;
  email: string;
  role: Role;
  authSource: string;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return hash === originalHash;
}

export function generateToken(user: User): string {
  const payload: JwtPayload = {
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    authSource: user.authSource
  };

  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授权：请提供有效的 Bearer 访问令牌' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    
    // Check if user still active in DB
    const user = db.findUserById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: '用户已停用或不存在' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: '令牌已失效或过期，请重新登录' });
  }
}

export function requireRole(roles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: '权限不足：当前角色无权执行此操作' });
    }
    next();
  };
}
