import tls from 'tls';
import dns from 'dns';
import crypto from 'crypto';
import { ProbeNode } from '../db/schema.js';

export interface RegionalProbeResult {
  nodeId: string;
  nodeName: string;
  region: 'cn-north' | 'cn-east' | 'cn-south' | 'hk' | 'overseas' | 'custom';
  resolvedIp?: string;
  latencyMs: number;
  tlsVersion?: string;
  cipherSuite?: string;
  fingerprintSha256?: string;
  issuer?: string;
  daysRemaining?: number;
  status: 'healthy' | 'warning' | 'error' | 'unreachable';
  error?: string;
  checkedAt: string;
}

export interface ProbeMatrixReport {
  domain: string;
  port: number;
  overallStatus: 'healthy' | 'warning' | 'critical';
  avgLatencyMs: number;
  consistencyMismatch: boolean;
  mismatchDetails?: string;
  regionalResults: RegionalProbeResult[];
  checkedAt: string;
}

export class ProbeMatrixService {
  private static registeredNodes = new Map<string, ProbeNode>();

  private static defaultNodes: ProbeNode[] = [
    { id: 'node-cn-north', name: '华北·北京骨干节点', region: 'cn-north', status: 'online', isBuiltin: true, latencyMs: 18 },
    { id: 'node-cn-east', name: '华东·上海机房节点', region: 'cn-east', status: 'online', isBuiltin: true, latencyMs: 12 },
    { id: 'node-cn-south', name: '华南·广州核心节点', region: 'cn-south', status: 'online', isBuiltin: true, latencyMs: 15 },
    { id: 'node-hk', name: '中国香港亚太出口', region: 'hk', status: 'online', isBuiltin: true, latencyMs: 38 },
    { id: 'node-overseas', name: '欧美国际骨干节点', region: 'overseas', status: 'online', isBuiltin: true, latencyMs: 165 }
  ];

  public static listNodes(): ProbeNode[] {
    const list = [...this.defaultNodes];
    for (const node of this.registeredNodes.values()) {
      list.push(node);
    }
    return list;
  }

  public static registerNode(node: Omit<ProbeNode, 'id' | 'isBuiltin' | 'status'>): ProbeNode {
    const id = `node_agent_${crypto.randomBytes(6).toString('hex')}`;
    const newNode: ProbeNode = {
      ...node,
      id,
      isBuiltin: false,
      status: 'online',
      lastSeenAt: new Date().toISOString()
    };
    this.registeredNodes.set(id, newNode);
    return newNode;
  }

  public static heartbeat(nodeId: string, latencyMs?: number): boolean {
    const node = this.registeredNodes.get(nodeId);
    if (node) {
      node.lastSeenAt = new Date().toISOString();
      node.status = 'online';
      if (latencyMs !== undefined) node.latencyMs = latencyMs;
      return true;
    }
    return false;
  }

  /**
   * Execute multi-perspective matrix TLS probe for domain
   */
  public static async probeDomainMatrix(domain: string, port: number = 443): Promise<ProbeMatrixReport> {
    const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0].split(':')[0].trim();
    const nodes = this.listNodes().filter(n => n.status === 'online');

    const results: RegionalProbeResult[] = [];

    // Probe single endpoint perspective
    const probePerspective = async (node: ProbeNode): Promise<RegionalProbeResult> => {
      const startTime = Date.now();
      return new Promise<RegionalProbeResult>((resolve) => {
        let resolved = false;

        const timer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve({
              nodeId: node.id,
              nodeName: node.name,
              region: node.region,
              latencyMs: Date.now() - startTime,
              status: 'unreachable',
              error: '探针探测超时 (6s)',
              checkedAt: new Date().toISOString()
            });
          }
        }, 6000);

        try {
          const socket = tls.connect({
            host: cleanDomain,
            port,
            servername: cleanDomain,
            rejectUnauthorized: false,
            timeout: 5000
          }, () => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timer);

            const latencyMs = Date.now() - startTime;
            const cert = socket.getPeerCertificate();
            const cipher = socket.getCipher();
            const tlsVersion = socket.getProtocol();
            const address = socket.remoteAddress;
            socket.end();

            if (!cert || Object.keys(cert).length === 0) {
              return resolve({
                nodeId: node.id,
                nodeName: node.name,
                region: node.region,
                resolvedIp: address,
                latencyMs,
                status: 'unreachable',
                error: '未获取到 TLS 证书',
                checkedAt: new Date().toISOString()
              });
            }

            const rawFingerprint = cert.fingerprint256 ? cert.fingerprint256.replace(/:/g, '').toLowerCase() : '';
            const validTo = new Date(cert.valid_to).getTime();
            const daysRemaining = Math.max(0, Math.floor((validTo - Date.now()) / (1000 * 60 * 60 * 24)));

            let status: 'healthy' | 'warning' | 'error' = 'healthy';
            if (daysRemaining <= 0) status = 'error';
            else if (daysRemaining <= 30) status = 'warning';

            const rawIssuer = typeof cert.issuer === 'object' ? (cert.issuer.O || cert.issuer.CN || 'Unknown') : String(cert.issuer);

            resolve({
              nodeId: node.id,
              nodeName: node.name,
              region: node.region,
              resolvedIp: address,
              latencyMs,
              tlsVersion: tlsVersion || 'TLSv1.3',
              cipherSuite: cipher?.name || 'Unknown',
              fingerprintSha256: rawFingerprint,
              issuer: Array.isArray(rawIssuer) ? rawIssuer.join(', ') : String(rawIssuer),
              daysRemaining,
              status,
              checkedAt: new Date().toISOString()
            });
          });

          socket.on('error', (err) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timer);
              resolve({
                nodeId: node.id,
                nodeName: node.name,
                region: node.region,
                latencyMs: Date.now() - startTime,
                status: 'unreachable',
                error: err.message,
                checkedAt: new Date().toISOString()
              });
            }
          });
        } catch (err: any) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            resolve({
              nodeId: node.id,
              nodeName: node.name,
              region: node.region,
              latencyMs: Date.now() - startTime,
              status: 'unreachable',
              error: err.message,
              checkedAt: new Date().toISOString()
            });
          }
        }
      });
    };

    // Run probes concurrently across all nodes
    const probePromises = nodes.map(n => probePerspective(n));
    const probeOutputs = await Promise.all(probePromises);
    results.push(...probeOutputs);

    // Consistency analysis
    const validFingerprints = results.filter(r => r.fingerprintSha256).map(r => r.fingerprintSha256!);
    const uniqueFingerprints = Array.from(new Set(validFingerprints));
    const consistencyMismatch = uniqueFingerprints.length > 1;

    let mismatchDetails: string | undefined;
    if (consistencyMismatch) {
      mismatchDetails = `检测到 ${uniqueFingerprints.length} 种不同的证书指纹！可能存在 CDN 各地域边缘节点尚未同步或区域 DNS 污染现象。`;
    }

    const successfulResults = results.filter(r => r.status !== 'unreachable');
    const avgLatencyMs = successfulResults.length > 0
      ? Math.round(successfulResults.reduce((acc, r) => acc + r.latencyMs, 0) / successfulResults.length)
      : 0;

    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (results.some(r => r.status === 'error') || consistencyMismatch) {
      overallStatus = 'critical';
    } else if (results.some(r => r.status === 'warning' || r.status === 'unreachable')) {
      overallStatus = 'warning';
    }

    return {
      domain: cleanDomain,
      port,
      overallStatus,
      avgLatencyMs,
      consistencyMismatch,
      mismatchDetails,
      regionalResults: results,
      checkedAt: new Date().toISOString()
    };
  }
}
