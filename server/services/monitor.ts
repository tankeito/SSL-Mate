import tls from 'tls';
import { db } from '../db/database.js';
import { DomainMonitor } from '../db/schema.js';
import { OcspService } from './ocsp.js';
import { NotificationService } from './notify.js';

export class DomainMonitorService {
  /**
   * Probe an online domain HTTPS certificate with OCSP Stapling & Revocation inspection
   */
  public static async inspectDomain(domain: string, port: number = 443): Promise<{
    status: 'healthy' | 'warning' | 'expired' | 'unreachable';
    issuer?: string;
    expiresAt?: string;
    daysLeft?: number;
    ocspStapling?: boolean;
    ocspStatus?: 'good' | 'revoked' | 'unknown' | 'no_stapling';
    ocspResponseSize?: number;
    error?: string;
  }> {
    const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];

    // Concurrently trigger OCSP Stapling detector
    const ocspPromise = OcspService.checkDomainOcsp(cleanDomain, port);

    const tlsResult = await new Promise<{
      status: 'healthy' | 'warning' | 'expired' | 'unreachable';
      issuer?: string;
      expiresAt?: string;
      daysLeft?: number;
      error?: string;
    }>((resolve) => {
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

    let ocspRes: { ocspStapling: boolean; status: 'good' | 'revoked' | 'unknown' | 'no_stapling'; responseSize: number } = {
      ocspStapling: false,
      status: 'no_stapling',
      responseSize: 0
    };
    try {
      const r = await ocspPromise;
      ocspRes = {
        ocspStapling: r.ocspStapling,
        status: r.status,
        responseSize: r.responseSize || 0
      };
    } catch {}

    // If revoked, escalate status
    let finalStatus = tlsResult.status;
    if (ocspRes.status === 'revoked') {
      finalStatus = 'expired';
    }

    return {
      ...tlsResult,
      status: finalStatus,
      ocspStapling: ocspRes.ocspStapling,
      ocspStatus: ocspRes.status,
      ocspResponseSize: ocspRes.responseSize
    };
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
        monitor.ocspStapling = result.ocspStapling;
        monitor.ocspStatus = result.ocspStatus;
        monitor.ocspCheckedAt = new Date().toISOString();
        monitor.ocspResponseSize = result.ocspResponseSize;
        monitor.lastCheckError = result.error;
        monitor.lastCheckAt = new Date().toISOString();
        db.upsertDomainMonitor(monitor);

        // Emergency notification if certificate is revoked by CA
        if (result.ocspStatus === 'revoked') {
          console.error(`[Monitor] 🚨 域名 [${monitor.domain}] 证书已被 CA 机构正式吊销 (Revoked)！`);
          try {
            await NotificationService.dispatchAll({
              event: 'expiring_soon',
              taskName: `证书吊销紧急告警: ${monitor.domain}`,
              domains: [monitor.domain],
              errorMessage: `【严重告警：证书已被吊销】监控巡检发现域名 ${monitor.domain} 的线上 SSL 证书已被 CA 机构吊销 (Revoked)！浏览器将出现拦截红屏，请立即重新签发部署！`
            });
          } catch {}
        }
      } catch (err: any) {
        monitor.status = 'unreachable';
        monitor.lastCheckError = err.message;
        monitor.lastCheckAt = new Date().toISOString();
        db.upsertDomainMonitor(monitor);
      }
    }
  }
}
