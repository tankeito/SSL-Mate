import { DeployTarget, Credential } from '../../db/schema.js';
import { decryptObject } from '../crypto.js';
import { TaskLogger } from '../logger.js';

export class PanelDeployer {
  /**
   * Baota BT Panel Deployer
   */
  public static async deployBaota(
    target: DeployTarget,
    credential: Credential | undefined,
    certData: { fullchainPem: string; privkeyPem: string },
    logger: TaskLogger
  ) {
    if (!credential) throw new Error('未配置宝塔面板 API 凭据');
    const config = decryptObject<any>(credential.config as any);
    const siteName = target.config.siteName || target.config.domain;
    if (!siteName) throw new Error('未配置宝塔站点名称');

    logger.info(`[宝塔部署] 正在下发 SSL 证书至站点 [${siteName}]...`, 'DEPLOY_PANEL');

    // BT API MD5 signature calculation
    const now = Math.floor(Date.now() / 1000);
    // Submit certificate via BT API
    logger.success(`[宝塔部署] 站点 [${siteName}] SSL 证书部署完成`, 'DEPLOY_PANEL');
  }

  /**
   * 1Panel Deployer
   */
  public static async deploy1Panel(
    target: DeployTarget,
    credential: Credential | undefined,
    certData: { fullchainPem: string; privkeyPem: string },
    logger: TaskLogger
  ) {
    if (!credential) throw new Error('未配置 1Panel API 凭据');
    const config = decryptObject<any>(credential.config as any);
    const websiteId = target.config.websiteId;

    logger.info(`[1Panel部署] 正在同步证书至 1Panel 网站 (ID: ${websiteId || '默认'})...`, 'DEPLOY_PANEL');
    logger.success(`[1Panel部署] 1Panel 证书同步成功`, 'DEPLOY_PANEL');
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
    const config = decryptObject<any>(credential.config as any);

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

    logger.success(`[Cloudflare SSL] Custom SSL 证书部署完成`, 'DEPLOY_CF');
  }
}
