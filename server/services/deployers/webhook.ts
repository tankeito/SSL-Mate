import { DeployTarget } from '../../db/schema.js';
import { TaskLogger } from '../logger.js';

export class WebhookDeployer {
  public static async deploy(
    target: DeployTarget,
    certData: {
      domains: string[];
      fullchainPem: string;
      privkeyPem: string;
      certPem: string;
      expiresAt: string;
    },
    logger: TaskLogger
  ) {
    const { webhookUrl, authHeader, customPayload } = target.config;

    if (!webhookUrl) throw new Error('未配置 Webhook 回调 URL');

    logger.info(`[Webhook部署] 正在触发回调: ${webhookUrl}`, 'DEPLOY_WEBHOOK');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    let bodyPayload: any = {
      event: 'ssl_deployed',
      domains: certData.domains,
      expires_at: certData.expiresAt,
      fullchain: certData.fullchainPem,
      private_key: certData.privkeyPem,
      cert: certData.certPem,
      timestamp: new Date().toISOString()
    };

    if (customPayload) {
      try {
        const parsed = JSON.parse(customPayload);
        bodyPayload = { ...bodyPayload, ...parsed };
      } catch (err) {
        // ignore
      }
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) {
      throw new Error(`Webhook 回调返回非正常状态码: HTTP ${res.status}`);
    }

    logger.success(`[Webhook部署] Webhook 回调成功 (HTTP ${res.status})`, 'DEPLOY_WEBHOOK');
  }
}
