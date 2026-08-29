import tls from 'tls';
import { db } from '../db/database.js';
import { DomainMonitor } from '../db/schema.js';

export class DomainMonitorService {
  /**
   * Probe an online domain HTTPS certificate
   */
  public static async inspectDomain(domain: string, port: number = 443): Promise<{
    status: 'healthy' | 'warning' | 'expired' | 'unreachable';
    issuer?: string;
    expiresAt?: string;
    daysLeft?: number;
    error?: string;
  }> {
    const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];

    return new Promise((resolve) => {
      const socket = tls.connect({
        host: cleanDomain,
        port: port,
        servername: cleanDomain,
        rejectUnauthorized: false,
        timeout: 8000
      }, () => {
        const cert = socket.getPeerCertificate();
        socket.end();

        if (!cert || Object.keys(cert).length === 0) {
          return resolve({
            status: 'unreachable',
            error: '未能从目标服务器获取 TLS 证书'
          });
        }

        const validTo = new Date(cert.valid_to).getTime();
        const now = Date.now();
        const diffMs = validTo - now;
        const daysLeft = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        let status: 'healthy' | 'warning' | 'expired' | 'unreachable' = 'healthy';
        if (daysLeft <= 0) {
          status = 'expired';
        } else if (daysLeft <= 30) {
          status = 'warning';
        }

        const rawIssuer = typeof cert.issuer === 'object' ? (cert.issuer.O || cert.issuer.CN || 'Unknown') : String(cert.issuer);
        const issuerStr = Array.isArray(rawIssuer) ? rawIssuer.join(', ') : String(rawIssuer);

        resolve({
          status,
          issuer: issuerStr,
          expiresAt: new Date(cert.valid_to).toISOString(),
          daysLeft: Math.max(0, daysLeft)
        });
      });

      socket.on('error', (err) => {
        resolve({
          status: 'unreachable',
          error: `连接失败: ${err.message}`
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({
          status: 'unreachable',
          error: '连接探测超时 (8s)'
        });
      });
    });
  }

  /**
   * Run health checks for all configured monitors
   */
  public static async checkAll() {
    const monitors = db.getDomainMonitors();
    for (const monitor of monitors) {
      try {
        const result = await this.inspectDomain(monitor.domain, monitor.port || 443);
        monitor.status = result.status;
        monitor.issuer = result.issuer;
        monitor.expiresAt = result.expiresAt;
        monitor.daysLeft = result.daysLeft;
        monitor.lastCheckError = result.error;
        monitor.lastCheckAt = new Date().toISOString();
        db.upsertDomainMonitor(monitor);
      } catch (err: any) {
        monitor.status = 'unreachable';
        monitor.lastCheckError = err.message;
        monitor.lastCheckAt = new Date().toISOString();
        db.upsertDomainMonitor(monitor);
      }
    }
  }
}
