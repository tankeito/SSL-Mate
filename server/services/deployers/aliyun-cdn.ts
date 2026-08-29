import crypto from 'crypto';
import { DeployTarget, Credential } from '../../db/schema.js';
import { decryptObject } from '../crypto.js';
import { TaskLogger } from '../logger.js';

export class AliyunCdnDeployer {
  public static async deploy(
    target: DeployTarget,
    credential: Credential | undefined,
    certData: { fullchainPem: string; privkeyPem: string },
    logger: TaskLogger
  ): Promise<void> {
    if (!credential) {
      throw new Error('未配置阿里云 AccessKey 凭据');
    }

    const config = decryptObject<any>(credential.config as any);
    const domain = target.config.domain;
    const certName = target.config.certName || `sslmate_${domain?.replace(/\./g, '_')}_${Date.now()}`;

    if (!domain) {
      throw new Error('未指定阿里云 CDN 加速域名');
    }

    logger.info(`[阿里云CDN] 正在更新加速域名 [${domain}] 的 HTTPS 证书 (证书标识: ${certName})...`, 'DEPLOY_ALIYUN');

    // Make POP API call to SetCdnDomainSSLCertificate
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const nonce = crypto.randomBytes(16).toString('hex');

    const params: Record<string, string> = {
      Format: 'JSON',
      Version: '2018-05-10',
      AccessKeyId: config.accessKeyId.trim(),
      SignatureMethod: 'HMAC-SHA1',
      Timestamp: timestamp,
      SignatureVersion: '1.0',
      SignatureNonce: nonce,
      Action: 'SetCdnDomainSSLCertificate',
      DomainName: domain,
      CertName: certName,
      CertType: 'upload',
      SSLProtocol: 'on',
      SSLPub: certData.fullchainPem,
      SSLPri: certData.privkeyPem
    };

    const percentEncode = (str: string) => encodeURIComponent(str).replace(/\+/g, '%20').replace(/\*/g, '%2A').replace(/%7E/g, '~');
    const sortedKeys = Object.keys(params).sort();
    const canonicalizedQuery = sortedKeys.map(k => `${percentEncode(k)}=${percentEncode(params[k])}`).join('&');
    const stringToSign = `POST&${percentEncode('/')}&${percentEncode(canonicalizedQuery)}`;
    const signature = crypto.createHmac('sha1', `${config.accessKeySecret.trim()}&`).update(stringToSign).digest('base64');

    const body = new URLSearchParams(params);
    body.set('Signature', signature);

    const res = await fetch('https://cdn.aliyuncs.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    const data = await res.json() as any;
    if (!res.ok || data.Code) {
      throw new Error(`阿里云 CDN 证书设置失败 [${data.Code || res.status}]: ${data.Message || res.statusText}`);
    }

    logger.success(`[阿里云CDN] 加速域名 [${domain}] HTTPS 证书更新成功`, 'DEPLOY_ALIYUN');
  }
}
