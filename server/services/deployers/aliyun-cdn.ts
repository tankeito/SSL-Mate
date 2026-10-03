import crypto from 'crypto';
import { DeployTarget, Credential } from '../../db/schema.js';
import { decryptObject } from '../crypto.js';
import { TaskLogger } from '../logger.js';

interface PopApiResponse {
  status: number;
  ok: boolean;
  data: any;
}

async function callAliyunPop(
  endpoint: string,
  action: string,
  version: string,
  params: Record<string, string>,
  accessKeyId: string,
  accessKeySecret: string
): Promise<PopApiResponse> {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const nonce = crypto.randomBytes(16).toString('hex');

  const fullParams: Record<string, string> = {
    Format: 'JSON',
    Version: version,
    AccessKeyId: accessKeyId.trim(),
    SignatureMethod: 'HMAC-SHA1',
    Timestamp: timestamp,
    SignatureVersion: '1.0',
    SignatureNonce: nonce,
    Action: action,
    ...params
  };

  const percentEncode = (str: string) =>
    encodeURIComponent(str)
      .replace(/\+/g, '%20')
      .replace(/\*/g, '%2A')
      .replace(/%7E/g, '~');

  const sortedKeys = Object.keys(fullParams).sort();
  const canonicalizedQuery = sortedKeys
    .map(k => `${percentEncode(k)}=${percentEncode(fullParams[k])}`)
    .join('&');

  const stringToSign = `POST&${percentEncode('/')}&${percentEncode(canonicalizedQuery)}`;
  const signature = crypto
    .createHmac('sha1', `${accessKeySecret.trim()}&`)
    .update(stringToSign)
    .digest('base64');

  const body = new URLSearchParams(fullParams);
  body.set('Signature', signature);

  const res = await fetch(`https://${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  const data = (await res.json().catch(() => ({}))) as any;
  return { status: res.status, ok: res.ok, data };
}

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
    const accessKeyId = config.accessKeyId?.trim();
    const accessKeySecret = config.accessKeySecret?.trim();

    if (!accessKeyId || !accessKeySecret) {
      throw new Error('阿里云凭据缺少 AccessKeyId 或 AccessKeySecret');
    }

    const domain = (target.config.domain || '').trim().replace(/^https?:\/\//, '').split('/')[0];
    const certName = target.config.certName || `sslmate_${domain.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    const product = target.config.product || 'auto'; // 'auto' | 'dcdn' | 'cdn'

    if (!domain) {
      throw new Error('未指定阿里云 CDN/DCDN 加速域名');
    }

    const deployDcdn = async () => {
      const res = await callAliyunPop(
        'dcdn.aliyuncs.com',
        'SetDcdnDomainSSLCertificate',
        '2018-01-15',
        {
          DomainName: domain,
          CertName: certName,
          CertType: 'upload',
          SSLProtocol: 'on',
          SSLPub: certData.fullchainPem,
          SSLPri: certData.privkeyPem
        },
        accessKeyId,
        accessKeySecret
      );

      if (!res.ok || res.data.Code) {
        throw new Error(`[${res.data.Code || res.status}]: ${res.data.Message || '全站加速配置失败'}`);
      }
      return res.data;
    };

    const deployCdn = async () => {
      const res = await callAliyunPop(
        'cdn.aliyuncs.com',
        'SetCdnDomainSSLCertificate',
        '2018-05-10',
        {
          DomainName: domain,
          CertName: certName,
          CertType: 'upload',
          SSLProtocol: 'on',
          SSLPub: certData.fullchainPem,
          SSLPri: certData.privkeyPem
        },
        accessKeyId,
        accessKeySecret
      );

      if (!res.ok || res.data.Code) {
        throw new Error(`[${res.data.Code || res.status}]: ${res.data.Message || '标准 CDN 配置失败'}`);
      }
      return res.data;
    };

    if (product === 'dcdn') {
      logger.info(`[阿里云全站加速 DCDN] 正在更新加速域名 [${domain}] 的 HTTPS 证书 (标识: ${certName})...`, 'DEPLOY_ALIYUN');
      await deployDcdn();
      logger.success(`[阿里云全站加速 DCDN] 加速域名 [${domain}] HTTPS 证书更新成功`, 'DEPLOY_ALIYUN');
      return;
    }

    if (product === 'cdn') {
      logger.info(`[阿里云标准 CDN] 正在更新加速域名 [${domain}] 的 HTTPS 证书 (标识: ${certName})...`, 'DEPLOY_ALIYUN');
      await deployCdn();
      logger.success(`[阿里云标准 CDN] 加速域名 [${domain}] HTTPS 证书更新成功`, 'DEPLOY_ALIYUN');
      return;
    }

    // Auto Mode: 自动尝试全站加速 (DCDN) 与标准 CDN (CDN)
    logger.info(`[阿里云 CDN/DCDN] 正在为加速域名 [${domain}] 自动匹配加速产品并部署证书 (标识: ${certName})...`, 'DEPLOY_ALIYUN');

    let dcdnError: string | null = null;
    try {
      await deployDcdn();
      logger.success(`[阿里云全站加速 DCDN] 成功识别加速域名 [${domain}] 并在 DCDN 全站加速上完成 HTTPS 证书部署`, 'DEPLOY_ALIYUN');
      return;
    } catch (err: any) {
      dcdnError = err.message;
      logger.info(`[阿里云 CDN/DCDN] 全站加速 (DCDN) 尝试未命中或受限 (${err.message})，继续尝试标准 CDN (cdn.aliyuncs.com)...`, 'DEPLOY_ALIYUN');
    }

    try {
      await deployCdn();
      logger.success(`[阿里云标准 CDN] 成功识别加速域名 [${domain}] 并在标准 CDN 上完成 HTTPS 证书部署`, 'DEPLOY_ALIYUN');
    } catch (cdnErr: any) {
      throw new Error(`阿里云 CDN/DCDN 证书部署均失败:\n - 全站加速 (DCDN): ${dcdnError}\n - 标准 CDN: ${cdnErr.message}`);
    }
  }
}
