import acme from 'acme-client';
import crypto from 'crypto';
import { AcmeAccount, Credential, KeyType, TaskStage } from '../../db/schema.js';
import { decryptObject } from '../crypto.js';
import { CloudflareDnsSolver } from './dns-providers/cloudflare.js';
import { AliyunDnsSolver } from './dns-providers/aliyun.js';
import { TencentDnsSolver } from './dns-providers/tencent.js';
import { HuaweiDnsSolver } from './dns-providers/huawei.js';
import dns from 'dns';
import { db } from '../../db/database.js';
import { TaskLogger } from '../logger.js';
import { HttpChallengeStore } from './http-challenge.js';

function resolveAcmeEmail(providedEmail?: string, domainFallback?: string): string {
  if (providedEmail && providedEmail.includes('@') && providedEmail.includes('.') && !providedEmail.endsWith('.local')) {
    return providedEmail.trim();
  }
  try {
    const admin = db.getUsers().find(u => u.role === 'admin' && u.email && u.email.includes('@') && !u.email.endsWith('.local'));
    if (admin?.email) return admin.email.trim();
  } catch {}
  if (process.env.DEFAULT_ACME_EMAIL && process.env.DEFAULT_ACME_EMAIL.includes('@')) {
    return process.env.DEFAULT_ACME_EMAIL.trim();
  }
  const cleanDomain = domainFallback ? domainFallback.replace(/^\*\./, '') : 'sslmate.local';
  return `admin@${cleanDomain}`;
}

async function checkTxtRecord(recordName: string, expectedVal: string, customResolver?: string): Promise<boolean> {
  // 1. First probe local DNS (fastest, 0-10ms)
  try {
    const records = await dns.promises.resolveTxt(recordName);
    const combined = records.flat().join(' ');
    if (combined.includes(expectedVal)) {
      return true;
    }
  } catch {}

  // 2. Multi-channel DoH provider pool (AliDNS, DNSPod, Cloudflare, Google)
  const endpoints: string[] = [];
  if (customResolver) {
    endpoints.push(customResolver.includes('?') ? `${customResolver}&name=${encodeURIComponent(recordName)}&type=TXT` : `${customResolver}?name=${encodeURIComponent(recordName)}&type=TXT`);
  }
  endpoints.push(
    `https://dns.alidns.com/resolve?name=${encodeURIComponent(recordName)}&type=TXT`,
    `https://doh.pub/dns-query?name=${encodeURIComponent(recordName)}&type=TXT`,
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(recordName)}&type=TXT`,
    `https://dns.google/resolve?name=${encodeURIComponent(recordName)}&type=TXT`
  );

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/dns-json' },
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const data = await res.json() as any;
        const answers = data.Answer || [];
        const found = answers.some((a: any) => a.data && a.data.includes(expectedVal));
        if (found) return true;
      }
    } catch {}
  }
  return false;
}

export interface IssueCertOptions {
  domains: string[];
  acmeAccount: AcmeAccount;
  dnsCredential?: Credential;
  validationType?: 'dns-01' | 'http-01';
  keyType: KeyType;
  logger: TaskLogger;
  onStageChange?: (stage: TaskStage) => void;
}

export interface IssuedCertificateResult {
  certPem: string;
  privkeyPem: string;
  fullchainPem: string;
  issuer: string;
  serialNumber: string;
  issuedAt: string;
  expiresAt: string;
  fingerprintSha256: string;
  sanDomains: string[];
}

export class AcmeService {
  /**
   * Instantiate the appropriate DNS solver based on credential type
   */
  private static getDnsSolver(credential?: Credential) {
    if (!credential) {
      throw new Error('DNS-01 验证模式需要选择并配置 DNS 云厂商凭据');
    }

    const decryptedConfig = decryptObject(credential.config as any);

    switch (credential.type) {
      case 'dns_cloudflare':
        return new CloudflareDnsSolver(decryptedConfig);
      case 'dns_aliyun':
        return new AliyunDnsSolver(decryptedConfig);
      case 'dns_tencent':
        return new TencentDnsSolver(decryptedConfig);
      case 'dns_huawei':
        return new HuaweiDnsSolver(decryptedConfig);
      default:
        throw new Error(`不支持的 DNS 凭据类型: ${credential.type}`);
    }
  }

  /**
   * Create or load ACME Account with Key & optional EAB
   */
  public static async getOrCreateClient(account: AcmeAccount, logger: TaskLogger): Promise<acme.Client> {
    logger.info(`初始化 ACME 客户端 [${account.name}] -> ${account.directoryUrl}`, 'ACME');

    let accountKey: Buffer;
    if (account.accountPrivateKeyPem) {
      const pem = decryptObject<string>(account.accountPrivateKeyPem, '');
      if (pem) {
        accountKey = Buffer.from(pem);
      } else {
        accountKey = await acme.crypto.createPrivateKey();
      }
    } else {
      accountKey = await acme.crypto.createPrivateKey();
    }

    const clientOptions: any = {
      directoryUrl: account.directoryUrl,
      accountKey
    };

    // Handle EAB (External Account Binding) for ZeroSSL / Google Trust
    if (account.eabKid && account.eabHmacKey) {
      const hmacKey = decryptObject<string>(account.eabHmacKey, account.eabHmacKey);
      clientOptions.externalAccountBinding = {
        kid: account.eabKid.trim(),
        hmacKey: hmacKey.trim()
      };
      logger.info(`应用 EAB 凭证绑定 (KID: ${account.eabKid})`, 'ACME');
    }

    const client = new acme.Client(clientOptions);

    let safeEmail = resolveAcmeEmail(account.email);

    try {
      // Register or fetch existing account
      await client.createAccount({
        termsOfServiceAgreed: true,
        contact: [`mailto:${safeEmail}`]
      });
      logger.success(`ACME 账户就绪 (${safeEmail})`, 'ACME');
    } catch (err: any) {
      // Account might already exist, which is fine
      if (!err.message?.includes('already exists') && !err.message?.includes('Account exists')) {
        logger.warn(`创建账户通知: ${err.message}`, 'ACME');
      }
    }

    return client;
  }

  /**
   * Request & Issue SSL Certificate for given domains
   */
  public static async issueCertificate(options: IssueCertOptions): Promise<IssuedCertificateResult> {
    const { domains, acmeAccount, dnsCredential, keyType, logger } = options;

    if (!domains || domains.length === 0) {
      throw new Error('未指定任何域名');
    }

    const validationType = options.validationType || 'dns-01';
    logger.info(`开始自动化申请 SSL 证书，目标域名: [${domains.join(', ')}]，密钥算法: ${keyType}，验证协议: ${validationType.toUpperCase()}`, 'INIT');

    const client = await this.getOrCreateClient(acmeAccount, logger);
    const dnsSolver = validationType === 'dns-01' ? this.getDnsSolver(dnsCredential) : null;

    let safeEmail = resolveAcmeEmail(acmeAccount.email, domains[0]);

    // 1. Generate Domain Private Key & CSR
    logger.info('生成域名专属私钥与证书签名请求 (CSR)...', 'CSR');
    let certKey: Buffer;
    if (keyType === 'ec384') {
      certKey = await acme.crypto.createPrivateKey(); // fallback or custom curve
    } else if (keyType.startsWith('rsa')) {
      const modulusLength = keyType === 'rsa4096' ? 4096 : 2048;
      certKey = await acme.crypto.createPrivateKey(modulusLength);
    } else {
      // Default ECC P-256
      certKey = await acme.crypto.createPrivateKey();
    }

    const primaryDomain = domains[0].replace(/^\*\./, '');
    const [certificateKey, certificateCsr] = await acme.crypto.createCsr({
      commonName: domains[0],
      altNames: domains
    }, certKey);

    logger.success('私钥与 CSR 创建成功', 'CSR');

    // 2. Issue Certificate via Challenge
    const challengePriority = validationType === 'http-01' ? ['http-01', 'dns-01'] : ['dns-01', 'http-01'];
    logger.info(`向 ACME CA 创建证书申请订单并处理 ${validationType.toUpperCase()} 验证...`, 'CHALLENGE');

    const pems = await client.auto({
      csr: certificateCsr,
      email: safeEmail,
      termsOfServiceAgreed: true,
      skipChallengeVerification: true,
      challengePriority,
      challengeCreateFn: async (authz, challenge, keyAuthorization) => {
        if (challenge.type === 'http-01') {
          options.onStageChange?.('CHALLENGE_SET');
          const domain = authz.identifier.value;
          logger.info(`[HTTP-01] 注册 HTTP-01 验证端点: /.well-known/acme-challenge/${challenge.token} (域名: ${domain})`, 'CHALLENGE_SET');
          HttpChallengeStore.registerChallenge(challenge.token, keyAuthorization);

          // Active Preflight test
          options.onStageChange?.('PREFLIGHT_WAITING');
          logger.info(`[HTTP-01] 执行本地与公网 HTTP-01 预检 (http://${domain}/.well-known/acme-challenge/${challenge.token})...`, 'PREFLIGHT_WAITING');
          try {
            const resp = await fetch(`http://${domain}/.well-known/acme-challenge/${challenge.token}`, { signal: AbortSignal.timeout(3000) });
            if (resp.ok) {
              const text = (await resp.text()).trim();
              if (text === keyAuthorization.trim()) {
                logger.success(`[HTTP-01] ✅ 公网 HTTP-01 预检通过！目标服务器正确响应挑战令牌`, 'PREFLIGHT_WAITING');
              }
            }
          } catch {
            const stored = HttpChallengeStore.getChallenge(challenge.token);
            if (stored === keyAuthorization.trim()) {
              logger.info(`[HTTP-01] 内部挑战存储就绪，已注册令牌等待 ACME CA 请求...`, 'PREFLIGHT_WAITING');
            }
          }
          await new Promise(r => setTimeout(r, 2000));
          options.onStageChange?.('ISSUING');
        } else if (challenge.type === 'dns-01' && dnsSolver) {
          options.onStageChange?.('CHALLENGE_SET');
          const domain = authz.identifier.value;
          const recordName = `_acme-challenge.${domain.replace(/^\*\./, '')}`;
          logger.info(`[DNS-01] 正在向 DNS 提供商添加 TXT 记录: ${recordName} -> ${keyAuthorization}`, 'CHALLENGE_SET');
          await dnsSolver.setRecord(domain, challenge.token, keyAuthorization);
          logger.success(`[DNS-01] TXT 记录写入成功，开始执行权威 DNS 广播预检...`, 'CHALLENGE_SET');

          // Active Pre-flight poll via multi-channel DNS resolver (Local + AliDNS + DNSPod + Cloudflare)
          options.onStageChange?.('PREFLIGHT_WAITING');
          let preflightOk = false;
          const customResolver = db.getSettings()?.dnsResolverUrl;
          for (let attempt = 1; attempt <= 12; attempt++) {
            logger.info(`[DNS-01] 正在轮询全球权威 DNS 节点 (第 ${attempt}/12 次多源探测)...`, 'PREFLIGHT_WAITING');
            try {
              const found = await checkTxtRecord(recordName, keyAuthorization, customResolver);
              if (found) {
                logger.success(`[DNS-01] ✅ 权威 DNS 预检通过！已成功探测到 TXT 挑战记录`, 'PREFLIGHT_WAITING');
                preflightOk = true;
                break;
              }
            } catch (_) {}
            await new Promise(r => setTimeout(r, 4000));
          }

          if (!preflightOk) {
            logger.warn(`[DNS-01] 权威 DNS 节点同步较慢，追加 8 秒安全缓冲后提交 ACME CA 校验...`, 'PREFLIGHT_WAITING');
            await new Promise(r => setTimeout(r, 8000));
          } else {
            // Buffer for CA multi-perspective validation
            await new Promise(r => setTimeout(r, 4000));
          }

          options.onStageChange?.('ISSUING');
        }
      },
      challengeRemoveFn: async (authz, challenge, keyAuthorization) => {
        if (challenge.type === 'http-01') {
          logger.info(`[HTTP-01] 释放 HTTP-01 验证端点令牌: ${challenge.token}`, 'HTTP');
          HttpChallengeStore.removeChallenge(challenge.token);
        } else if (challenge.type === 'dns-01' && dnsSolver) {
          const domain = authz.identifier.value;
          logger.info(`[DNS-01] 正在清理临时 TXT 记录: _acme-challenge.${domain}`, 'DNS');
          await dnsSolver.removeRecord(domain, challenge.token, keyAuthorization);
        }
      }
    });

    options.onStageChange?.('ISSUING');
    logger.success('🎉 CA 机构校验成功，SSL 证书已成功签发！', 'ISSUING');

    // 3. Extract Certificate Details
    const certString = Array.isArray(pems) ? pems.join('\n') : pems.toString();
    const certKeyString = certificateKey.toString();

    // Parse X509 to get dates and issuer
    const x509 = new crypto.X509Certificate(certString);
    const fingerprint = x509.fingerprint256.replace(/:/g, '').toLowerCase();

    return {
      certPem: certString.split('-----END CERTIFICATE-----')[0] + '-----END CERTIFICATE-----',
      privkeyPem: certKeyString,
      fullchainPem: certString,
      issuer: x509.issuer,
      serialNumber: x509.serialNumber,
      issuedAt: new Date(x509.validFrom).toISOString(),
      expiresAt: new Date(x509.validTo).toISOString(),
      fingerprintSha256: fingerprint,
      sanDomains: domains
    };
  }
}
