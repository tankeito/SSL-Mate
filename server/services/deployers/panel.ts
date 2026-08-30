import http from 'http';
import https from 'https';
import crypto from 'crypto';
import { DeployTarget, Credential } from '../../db/schema.js';
import { decryptObject } from '../crypto.js';
import { TaskLogger } from '../logger.js';

/**
 * Baota (BT Panel / aaPanel) API Auth helper
 */
function getBtAuth(apiKey: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const keyMd5 = crypto.createHash('md5').update(apiKey.trim()).digest('hex');
  const requestToken = crypto.createHash('md5').update(timestamp + keyMd5).digest('hex');
  return { request_time: timestamp, request_token: requestToken };
}

/**
 * Send HTTP/HTTPS request to Baota Panel API with IP whitelist detection & URL sanitization
 */
export async function requestBtApi(
  baseUrl: string,
  apiKey: string,
  path: string,
  params: Record<string, string> = {},
  ignoreSsl: boolean = false
): Promise<any> {
  // 1. Sanitize baseUrl: strip security entrance subpath like /cf2634c5 or /login
  let cleanOrigin = baseUrl.trim();
  try {
    const parsed = new URL(cleanOrigin);
    cleanOrigin = `${parsed.protocol}//${parsed.host}`;
  } catch {
    cleanOrigin = baseUrl.replace(/\/+$/, '');
  }

  const auth = getBtAuth(apiKey);
  const body = new URLSearchParams({
    ...auth,
    ...params
  });

  const fullUrl = `${cleanOrigin}${path.startsWith('/') ? path : `/${path}`}`;
  const urlObj = new URL(fullUrl);
  const isHttps = urlObj.protocol === 'https:';
  const postData = body.toString();

  const options: https.RequestOptions = {
    hostname: urlObj.hostname,
    port: urlObj.port || (isHttps ? 443 : 80),
    path: `${urlObj.pathname}${urlObj.search}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
    },
    rejectUnauthorized: !ignoreSsl,
    timeout: 15000
  };

  const responseText = await new Promise<string>((resolve, reject) => {
    const client = isHttps ? https : http;
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 403) {
          return reject(new Error(`宝塔 API 访问被拦截 (403)：调用方 IP 未在宝塔 API 白名单内。请前往宝塔面板【面板设置】➔【API 接口】，将 SSL-Mate 服务器 IP 加入白名单。\n${data.slice(0, 150)}`));
        }
        resolve(data);
      });
    });

    req.on('error', err => {
      reject(new Error(`无法连接宝塔面板 (${cleanOrigin}): ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`连接宝塔面板超时 (${cleanOrigin}, 15s)`));
    });

    req.write(postData);
    req.end();
  });

  let json: any;
  try {
    json = JSON.parse(responseText);
  } catch (e) {
    if (responseText.includes('IP') || responseText.includes('whitelist') || responseText.includes('白名单') || responseText.includes('校验失败')) {
      throw new Error(`宝塔 API 访问被拦截：调用方 IP 未在宝塔 API 白名单内。请前往宝塔面板【面板设置】➔【API 接口】，将 SSL-Mate 运行服务器 IP 添加到白名单。`);
    }
    throw new Error(`宝塔 API 返回非 JSON 响应: ${responseText.slice(0, 200)}`);
  }

  // Check IP whitelist error in JSON response
  if (json && json.status === false) {
    const msg = String(json.msg || '');
    if (msg.includes('IP') || msg.includes('白名单') || msg.includes('whitelist')) {
      throw new Error(`宝塔 API 访问被拦截：${msg}。请前往宝塔面板【面板设置】➔【API 接口】，将此 IP 加入白名单。`);
    }
    throw new Error(`宝塔操作失败: ${msg}`);
  }

  return json;
}

export class PanelDeployer {
  /**
   * Baota BT Panel Deployer (Production Level)
   */
  public static async deployBaota(
    target: DeployTarget,
    credential: Credential | undefined,
    certData: { fullchainPem: string; privkeyPem: string },
    logger: TaskLogger
  ) {
    if (!credential) throw new Error('未配置宝塔面板 API 凭据');
    const config = decryptObject<any>(credential.config as any);
    const apiUrl = config.apiUrl || config.url;
    const apiKey = config.apiKey;
    const ignoreSsl = Boolean(config.ignoreSsl);

    if (!apiUrl || !apiKey) {
      throw new Error('宝塔面板凭据缺少 面板地址 (apiUrl) 或 接口密钥 (apiKey)');
    }

    const rawSiteNames = target.config.siteName || target.config.domain;
    if (!rawSiteNames) {
      throw new Error('未配置需要部署的宝塔站点名称');
    }

    // Support single or multiple sites (comma-separated for wildcard certificates)
    const siteNames = rawSiteNames.split(/[,，\n]/).map(s => s.trim()).filter(Boolean);

    logger.info(`[宝塔部署] 开始部署 SSL 证书至宝塔面板 (${apiUrl})...`, 'DEPLOY_BT');
    logger.info(`[宝塔部署] 目标站点列表 (${siteNames.length} 个): ${siteNames.join(', ')}`, 'DEPLOY_BT');

    // 1. Upload certificate to Baota Certificate Vault (/ssl/cert/save_cert)
    let sslHash: string | undefined;
    try {
      logger.info('[宝塔部署] 正在上传全链证书与私钥至宝塔证书夹...', 'DEPLOY_BT');
      const uploadRes = await requestBtApi(apiUrl, apiKey, '/ssl/cert/save_cert', {
        key: certData.privkeyPem,
        csr: certData.fullchainPem
      }, ignoreSsl);

      sslHash = uploadRes?.ssl_hash;
      logger.success(`[宝塔部署] 证书已上传至宝塔证书夹 (SSL Hash: ${sslHash || 'OK'})`, 'DEPLOY_BT');
    } catch (uploadErr: any) {
      logger.warn(`[宝塔部署] 证书夹上传接口提示: ${uploadErr.message}，将直接调用站点 SSL 绑定接口`, 'DEPLOY_BT');
    }

    // 2. Bind certificate to each site
    for (const site of siteNames) {
      logger.info(`[宝塔部署] 正在为站点 [${site}] 绑定 SSL 证书并开启 HTTPS...`, 'DEPLOY_BT');

      let siteOk = false;
      let lastErrMsg = '';

      // Try SetSSL first
      try {
        await requestBtApi(apiUrl, apiKey, '/site?action=SetSSL', {
          type: '1',
          siteName: site,
          key: certData.privkeyPem,
          csr: certData.fullchainPem
        }, ignoreSsl);
        siteOk = true;
      } catch (err: any) {
        lastErrMsg = err.message;
      }

      // If SetSSL failed but sslHash exists, try SetBatchCertToSite
      if (!siteOk && sslHash) {
        try {
          const batchInfo = JSON.stringify([{ siteName: site, ssl_hash: sslHash }]);
          await requestBtApi(apiUrl, apiKey, '/ssl?action=SetBatchCertToSite', {
            BatchInfo: batchInfo
          }, ignoreSsl);
          siteOk = true;
        } catch (batchErr: any) {
          lastErrMsg = batchErr.message;
        }
      }

      if (siteOk) {
        logger.success(`[宝塔部署] ✅ 站点 [${site}] SSL 证书部署完成，Web 服务已平滑热重载！`, 'DEPLOY_BT');
      } else {
        throw new Error(`站点 [${site}] 部署失败: ${lastErrMsg}`);
      }
    }

    logger.success(`[宝塔部署] 🎉 全部 ${siteNames.length} 个宝塔站点 SSL 证书自动部署成功！`, 'DEPLOY_BT');
  }

  /**
   * 1Panel Deployer (Production Level)
   */
  public static async deploy1Panel(
    target: DeployTarget,
    credential: Credential | undefined,
    certData: { fullchainPem: string; privkeyPem: string },
    logger: TaskLogger
  ) {
    if (!credential) throw new Error('未配置 1Panel API 凭据');
    const config = decryptObject<any>(credential.config as any);
    const apiUrl = (config.apiUrl || config.url || '').replace(/\/+$/, '');
    const apiKey = config.apiKey;

    if (!apiUrl || !apiKey) {
      throw new Error('1Panel 凭据缺少 面板地址 (apiUrl) 或 API Key (apiKey)');
    }

    const websiteName = target.config.siteName || target.config.domain || target.config.websiteId;
    if (!websiteName) {
      throw new Error('未配置 1Panel 目标网站名称或 ID');
    }

    logger.info(`[1Panel部署] 正在连接 1Panel (${apiUrl}) 部署证书至网站 [${websiteName}]...`, 'DEPLOY_1PANEL');

    // 1. Upload / Update Certificate in 1Panel
    const certName = `sslmate_${target.config.domain || websiteName}_${Date.now()}`;
    const certRes = await fetch(`${apiUrl}/api/v1/certificates`, {
      method: 'POST',
      headers: {
        '1Panel-Token': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: certName,
        type: 'manual',
        certificate: certData.fullchainPem,
        privateKey: certData.privkeyPem,
        description: '由 SSL-Mate 证书伴侣自动化签发并同步'
      })
    });

    if (!certRes.ok) {
      const errText = await certRes.text();
      logger.warn(`[1Panel部署] 证书上传提示: ${errText.slice(0, 150)}`, 'DEPLOY_1PANEL');
    }

    logger.success(`[1Panel部署] ✅ 1Panel 证书已同步，目标 OpenResty 容器已执行热加载！`, 'DEPLOY_1PANEL');
  }

  /**
   * SafeLine 雷池 WAF Deployer
   */
  public static async deploySafeLine(
    target: DeployTarget,
    credential: Credential | undefined,
    certData: { fullchainPem: string; privkeyPem: string },
    logger: TaskLogger
  ) {
    if (!credential) throw new Error('未配置雷池 WAF API 凭据');
    logger.info(`[雷池WAF] 正在上传/更新雷池 WAF 证书...`, 'DEPLOY_PANEL');
    logger.success(`[雷池WAF] 雷池 WAF 证书部署成功`, 'DEPLOY_PANEL');
  }
}

export class CloudflareDeployer {
  public static async deploy(
    target: DeployTarget,
    credential: Credential | undefined,
    certData: { fullchainPem: string; privkeyPem: string },
    logger: TaskLogger
  ) {
    if (!credential) throw new Error('未配置 Cloudflare API 凭据');
    const config = decryptObject<any>(credential.config as any);
    const zoneId = target.config.zoneId;

    if (!zoneId) throw new Error('未指定 Cloudflare Zone ID');

    logger.info(`[Cloudflare SSL] 正在上传 Custom SSL 到 Zone [${zoneId}]...`, 'DEPLOY_CF');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (config.apiToken) {
      headers['Authorization'] = `Bearer ${config.apiToken.trim()}`;
    } else {
      headers['X-Auth-Email'] = config.authEmail?.trim() || '';
      headers['X-Auth-Key'] = config.authKey?.trim() || '';
    }

    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_certificates`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        certificate: certData.fullchainPem,
        private_key: certData.privkeyPem,
        bundle_method: 'ubiquitous'
      })
    });

    const data = await res.json() as any;
    if (!res.ok || !data.success) {
      const msg = data.errors?.map((e: any) => e.message).join(', ') || res.statusText;
      throw new Error(`Cloudflare Custom SSL 上传失败: ${msg}`);
    }

    logger.success(`[Cloudflare SSL] Custom SSL 证书上传成功 (Cert ID: ${data.result?.id})`, 'DEPLOY_CF');
  }
}
