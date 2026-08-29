import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const config = {
  port: parseInt(process.env.PORT || '8989', 10),
  jwtSecret: process.env.JWT_SECRET || 'sslmate_super_secret_jwt_key_2026_x89a',
  masterKey: process.env.MASTER_KEY || 'sslmate_master_encryption_key_32bytes_sec',
  dataDir: DATA_DIR,
  dbPath: path.join(DATA_DIR, 'sslmate.json'),
  
  // AuthMate OIDC SSO Default Configuration
  authmate: {
    issuerUrl: process.env.AUTHMATE_ISSUER_URL || 'http://127.0.0.1:8787',
    clientId: process.env.AUTHMATE_CLIENT_ID || 'sslmate-app',
    clientSecret: process.env.AUTHMATE_CLIENT_SECRET || 'authmate-client-secret-sslmate',
    redirectUri: process.env.AUTHMATE_REDIRECT_URI || 'http://localhost:5174/oauth/callback',
    enabled: process.env.AUTHMATE_ENABLED !== 'false'
  }
};
