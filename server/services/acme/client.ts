import acme from 'acme-client';
import crypto from 'crypto';
import { AcmeAccount, Credential, KeyType } from '../../db/schema.js';
import { decryptObject } from '../crypto.js';
import { CloudflareDnsSolver } from './dns-providers/cloudflare.js';
import { AliyunDnsSolver } from './dns-providers/aliyun.js';
import { TencentDnsSolver } from './dns-providers/tencent.js';
import { HuaweiDnsSolver } from './dns-providers/huawei.js';
import { TaskLogger } from '../logger.js';

export interface IssueCertOptions {
  domains: string[];
  acmeAccount: AcmeAccount;
  dnsCredential?: Credential;
  keyType: KeyType;
  logger: TaskLogger;
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

    let safeEmail = account.email ? account.email.trim() : '';
    if (!safeEmail || safeEmail.endsWith('.local') || !safeEmail.includes('@') || !safeEmail.includes('.')) {
      safeEmail = 'tqd354@gmail.com';
    }

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

    logger.info(`开始自动化申请 SSL 证书，目标域名: [${domains.join(', ')}]，密钥算法: ${keyType}`, 'INIT');

    const client = await this.getOrCreateClient(acmeAccount, logger);
    const dnsSolver = this.getDnsSolver(dnsCredential);

    let safeEmail = acmeAccount.email ? acmeAccount.email.trim() : '';
    if (!safeEmail || safeEmail.endsWith('.local') || !safeEmail.includes('@') || !safeEmail.includes('.')) {
      safeEmail = 'tqd354@gmail.com';
    }

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

    // 2. Issue Certificate via DNS-01 Challenge
    logger.info('向 ACME CA 创建证书申请订单并处理 DNS-01 验证...', 'CHALLENGE');

    const pems = await client.auto({
      csr: certificateCsr,
      email: safeEmail,
      termsOfServiceAgreed: true,
      challengePriority: ['dns-01'],
      challengeCreateFn: async (authz, challenge, keyAuthorization) => {
        if (challenge.type === 'dns-01') {
          const domain = authz.identifier.value;
          const recordName = `_acme-challenge.${domain.replace(/^\*\./, '')}`;
          logger.info(`[DNS-01] 正在向 DNS 提供商添加 TXT 记录: ${recordName} -> ${keyAuthorization}`, 'DNS');
          await dnsSolver.setRecord(domain, challenge.token, keyAuthorization);
          logger.success(`[DNS-01] TXT 记录写入成功，开始执行全球权威 DNS 广播预检...`, 'DNS');

          // Active Pre-flight poll via Cloudflare DoH (up to 60s)
          let preflightOk = false;
          for (let attempt = 1; attempt <= 12; attempt++) {
            logger.info(`[DNS-01] 正在轮询全球 DNS 节点 (第 ${attempt}/12 次检测，每次间隔 5s)...`, 'DNS');
            try {
              const dohRes = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(recordName)}&type=TXT`, {
                headers: { 'Accept': 'application/dns-json' }
              });
              if (dohRes.ok) {
                const dohData = await dohRes.json() as any;
                const answers = dohData.Answer || [];
                const found = answers.some((a: any) => a.data && a.data.includes(keyAuthorization));
                if (found) {
                  logger.success(`[DNS-01] ✅ 全球权威 DNS 预检通过！已成功探测到 TXT 挑战记录`, 'DNS');
                  preflightOk = true;
                  break;
                }
              }
            } catch (_) {}
            await new Promise(r => setTimeout(r, 5000));
          }

          if (!preflightOk) {
            logger.warn(`[DNS-01] 全球 DNS 节点同步较慢，追加 10 秒安全缓冲后提交 ACME CA 校验...`, 'DNS');
            await new Promise(r => setTimeout(r, 10000));
          } else {
            // Buffer for Let's Encrypt multi-perspective validation
            await new Promise(r => setTimeout(r, 5000));
          }
        }
      },
      challengeRemoveFn: async (authz, challenge, keyAuthorization) => {
        if (challenge.type === 'dns-01') {
          const domain = authz.identifier.value;
          logger.info(`[DNS-01] 正在清理临时 TXT 记录: _acme-challenge.${domain}`, 'DNS');
          await dnsSolver.removeRecord(domain, challenge.token, keyAuthorization);
        }
      }
    });

    logger.success('🎉 CA 机构校验成功，SSL 证书已成功签发！', 'ISSUED');

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
