import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

import crypto from 'crypto';

dotenv.config();

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function resolveSecret(envKey: string, fileName: string, description: string): string {
  if (process.env[envKey] && process.env[envKey]!.trim()) {
    return process.env[envKey]!.trim();
  }
  const filePath = path.join(DATA_DIR, fileName);
  if (fs.existsSync(filePath)) {
    try {
      const saved = fs.readFileSync(filePath, 'utf8').trim();
      if (saved) return saved;
    } catch {}
  }
  const generated = crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(filePath, generated, 'utf8');
    console.log(`[Security] ${description} 已自动生成高熵密钥并持久化至: ${fileName}`);
  } catch (err) {
    console.warn(`[Security] 无法写入 ${fileName}:`, err);
  }
  return generated;
}

export const config = {
  port: parseInt(process.env.PORT || '8989', 10),
  jwtSecret: resolveSecret('JWT_SECRET', '.jwt_secret', 'JWT 签名密钥'),
  masterKey: resolveSecret('MASTER_KEY', '.master_key', '数据加密主密钥'),
  dataDir: DATA_DIR,
  dbPath: path.join(DATA_DIR, 'sslmate.json'),
  
  // Concurrency Limits
  acmeConcurrency: parseInt(process.env.ACME_CONCURRENCY || '3', 10),
  monitorConcurrency: parseInt(process.env.MONITOR_CONCURRENCY || '6', 10),

  // AuthMate OIDC SSO Default Configuration
  authmate: {
    issuerUrl: process.env.AUTHMATE_ISSUER_URL || 'http://127.0.0.1:8787',
    clientId: process.env.AUTHMATE_CLIENT_ID || 'sslmate-app',
    clientSecret: process.env.AUTHMATE_CLIENT_SECRET || '',
    redirectUri: process.env.AUTHMATE_REDIRECT_URI || 'http://localhost:5173/oauth/callback',
    enabled: process.env.AUTHMATE_ENABLED !== 'false'
  }
};
