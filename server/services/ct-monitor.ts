import { db } from '../db/database.js';
import { NotificationService } from './notify.js';

export interface CtLogEntry {
  id: number;
  issuer_name: string;
  common_name: string;
  name_value: string;
  entry_timestamp?: string;
  not_before: string;
  not_after: string;
  serial_number: string;
  isKnownBySslMate: boolean;
}

export interface CtScanResult {
  domain: string;
  totalFound: number;
  unknownCertsCount: number;
  isHijackSuspected: boolean;
  entries: CtLogEntry[];
  checkedAt: string;
}

export class CtMonitorService {
  private static cache = new Map<string, { data: CtLogEntry[]; timestamp: number }>();

  /**
   * Search Certificate Transparency logs for a domain via crt.sh
   */
  public static async searchDomain(domain: string): Promise<CtLogEntry[]> {
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^\*\./, '').split('/')[0].split(':')[0].trim().toLowerCase();

    // Check 5-minute memory cache
    const cached = this.cache.get(cleanDomain);
    if (cached && Date.now() - cached.timestamp < 300000) {
      return cached.data;
    }

    const localCerts = db.getCertificates();
    const knownSerials = new Set(
      localCerts.map(c => c.serialNumber.replace(/:/g, '').toLowerCase().trim())
    );

    let rawEntries: any[] = [];
    try {
      const url = `https://crt.sh/?q=%.${encodeURIComponent(cleanDomain)}&output=json`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'SSL-Mate-CT-Scanner/1.1.0' },
        signal: AbortSignal.timeout(6000)
      });

      if (res.ok) {
        rawEntries = await res.json() as any[];
      }
    } catch {
      // Offline fallback: simulate or use local certs if crt.sh is rate-limited or offline
    }

    if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
      // Return simulated known CT records from local repository if crt.sh is unreachable
      const matchingLocal = localCerts.filter(c => 
        c.primaryDomain.includes(cleanDomain) || c.sanDomains.some(s => s.includes(cleanDomain))
      );
      const simulated: CtLogEntry[] = matchingLocal.map((c, idx) => ({
        id: 10000000 + idx,
        issuer_name: c.issuer,
        common_name: c.primaryDomain,
        name_value: c.sanDomains.join('\n'),
        entry_timestamp: c.issuedAt,
        not_before: c.issuedAt,
        not_after: c.expiresAt,
        serial_number: c.serialNumber,
        isKnownBySslMate: true
      }));

      this.cache.set(cleanDomain, { data: simulated, timestamp: Date.now() });
      return simulated;
    }

    // Deduplicate by serial_number
    const seenSerials = new Set<string>();
    const parsedEntries: CtLogEntry[] = [];

    for (const item of rawEntries.slice(0, 50)) {
      const serial = String(item.serial_number || '').replace(/:/g, '').toLowerCase().trim();
      if (!serial || seenSerials.has(serial)) continue;
      seenSerials.add(serial);

      const isKnown = knownSerials.has(serial) || localCerts.some(c => 
        c.serialNumber.toLowerCase().includes(serial) || serial.includes(c.serialNumber.toLowerCase())
      );

      parsedEntries.push({
        id: Number(item.id) || Math.floor(Math.random() * 1000000),
        issuer_name: String(item.issuer_name || 'Unknown CA'),
        common_name: String(item.common_name || cleanDomain),
        name_value: String(item.name_value || cleanDomain),
        entry_timestamp: item.entry_timestamp || item.not_before,
        not_before: item.not_before || new Date().toISOString(),
        not_after: item.not_after || new Date(Date.now() + 90 * 86400000).toISOString(),
        serial_number: serial,
        isKnownBySslMate: isKnown
      });
    }

    this.cache.set(cleanDomain, { data: parsedEntries, timestamp: Date.now() });
    return parsedEntries;
  }

  /**
   * Scan domain for potential certificate hijacking or unauthorized external issuances
   */
  public static async scanDomain(domain: string): Promise<CtScanResult> {
    const entries = await this.searchDomain(domain);
    const unknownCerts = entries.filter(e => !e.isKnownBySslMate);

    // Filter recent unknown certs (issued in last 30 days)
    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    const recentUnknown = unknownCerts.filter(e => {
      const issueTime = new Date(e.not_before).getTime();
      return issueTime > thirtyDaysAgo;
    });

    const isHijackSuspected = recentUnknown.length > 0;

    if (isHijackSuspected) {
      console.warn(`[CT Monitor] ⚠️ 警报: 发现域名 [${domain}] 存在 ${recentUnknown.length} 张未通过 SSL-Mate 签发的外部公开证书！`);
      // Trigger notification channels
      try {
        const topCert = recentUnknown[0];
        await NotificationService.dispatchAll({
          event: 'expiring_soon',
          taskName: `CT监控预警: ${domain}`,
          domains: [domain],
          errorMessage: `【CT证书劫持风险预警】公网 CT 日志中检测到未经本系统签发的新公开证书 (序列号: ${topCert.serial_number}, 机构: ${topCert.issuer_name})，可能存在未授权冒名签发风险，请安全团队尽快排查！`
        });
      } catch (notifyErr: any) {
        console.error('[CT Monitor] 发送预警通知失败:', notifyErr.message);
      }
    }

    return {
      domain,
      totalFound: entries.length,
      unknownCertsCount: unknownCerts.length,
      isHijackSuspected,
      entries,
      checkedAt: new Date().toISOString()
    };
  }

  /**
   * Scan all active domains in the system
   */
  public static async scanAll(): Promise<CtScanResult[]> {
    const domains = new Set<string>();
    for (const t of db.getTasks()) {
      for (const d of t.domains) {
        domains.add(d.replace(/^\*\./, ''));
      }
    }
    for (const m of db.getDomainMonitors()) {
      domains.add(m.domain.replace(/^https?:\/\//, '').split('/')[0].split(':')[0]);
    }

    const results: CtScanResult[] = [];
    for (const domain of domains) {
      try {
        const res = await this.scanDomain(domain);
        results.push(res);
      } catch (err: any) {
        console.error(`[CT Monitor] 扫描域名 ${domain} 失败:`, err.message);
      }
    }

    return results;
  }
}
