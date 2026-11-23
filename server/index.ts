import dns from 'dns';
import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config, verifyLoginEntryToken, getExpectedLoginToken } from './config.js';

// Prioritize IPv4 to avoid hanging on unroutable IPv6 routes in cloud environments
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}
import { logBroadcaster } from './services/logger.js';
import { SchedulerService } from './services/scheduler.js';

import authRouter from './routes/auth.js';
import tasksRouter from './routes/tasks.js';
import credentialsRouter from './routes/credentials.js';
import acmeAccountsRouter from './routes/acme-accounts.js';
import certsRouter from './routes/certs.js';
import monitorsRouter from './routes/monitors.js';
import notifyRouter from './routes/notify.js';
import systemRouter from './routes/system.js';
import usersRouter from './routes/users.js';
import backupRouter from './routes/backup.js';
import ctMonitorRouter from './routes/ct-monitor.js';
import probesRouter from './routes/probes.js';
import { HttpChallengeStore } from './services/acme/http-challenge.js';

const app = express();

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ACME RFC 8555 HTTP-01 Challenge Endpoint
app.get('/.well-known/acme-challenge/:token', (req: Request, res: Response) => {
  const token = String(req.params.token || '').trim();
  const keyAuth = HttpChallengeStore.getChallenge(token);
  if (keyAuth) {
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(keyAuth);
  }
  return res.status(404).send('ACME challenge token not found or expired');
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/credentials', credentialsRouter);
app.use('/api/acme-accounts', acmeAccountsRouter);
app.use('/api/certs', certsRouter);
app.use('/api/monitors', monitorsRouter);
app.use('/api/notify', notifyRouter);
app.use('/api/system', systemRouter);
app.use('/api/backup', backupRouter);
app.use('/api/ct-monitor', ctMonitorRouter);
app.use('/api/probes', probesRouter);

// SSE Live Log Streaming Endpoint
app.get('/events/tasks/:taskId', (req: Request, res: Response) => {
  const taskId = String(req.params.taskId);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial ping
  res.write(`data: ${JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', message: '已连接实时日志流...' })}\n\n`);

  logBroadcaster.subscribe(taskId, res);
});

// SEO: robots.txt & sitemap.xml
app.get('/robots.txt', (req: Request, res: Response) => {
  const host = req.headers.host || 'ssl.ap1x.xyz';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(
`User-agent: *
Allow: /
Disallow: /api/
Disallow: /events/
Disallow: /login
Disallow: /oauth/

Sitemap: ${protocol}://${host}/sitemap.xml
`
  );
});

app.get('/sitemap.xml', (req: Request, res: Response) => {
  const host = req.headers.host || 'ssl.ap1x.xyz';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const baseUrl = `${protocol}://${host}`;
  const today = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.send(
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`
  );
});

// Production Static Serving (Robust path detection)
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = fs.existsSync(path.resolve(__dirname, '../dist'))
  ? path.resolve(__dirname, '../dist')
  : path.resolve(process.cwd(), 'dist');

/**
 * Helper to extract login token from /login or /login/:token request
 */
function extractLoginRequestToken(req: Request): string {
  const pathMatch = req.path.match(/^\/login\/([^/]+)\/?$/);
  if (pathMatch && pathMatch[1]) {
    return decodeURIComponent(pathMatch[1]).trim();
  }
  const qToken = req.query.token || req.query.t;
  if (typeof qToken === 'string' && qToken.trim()) {
    return qToken.trim();
  }
  const queryKeys = Object.keys(req.query);
  if (queryKeys.length === 1 && req.query[queryKeys[0]] === '') {
    return queryKeys[0].trim();
  }
  return '';
}

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req: Request, res: Response, next) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/events')) {
      // Intercept /login and /login/* when token is missing or invalid
      if (req.path === '/login' || req.path.startsWith('/login/')) {
        const candidateToken = extractLoginRequestToken(req);
        if (!verifyLoginEntryToken(candidateToken)) {
          res.status(403);
        }
      }
      res.sendFile(path.join(distDir, 'index.html'));
    } else {
      next();
    }
  });
}

// Start Scheduler
SchedulerService.init();

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  🛡️ 云签盾 - 全自动 SSL 证书生命周期管理平台已启动             ║
║  📡 服务端口: http://127.0.0.1:${config.port}                        ║
║  🔑 登录安全入口: /login?token=${getExpectedLoginToken().padEnd(27)} ║
║  🔐 AuthMate SSO IdP: ${config.authmate.issuerUrl.padEnd(30)} ║
║  💾 数据存储: ${config.dbPath.padEnd(38)} ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

export default app;
