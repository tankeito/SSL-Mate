import { DeployTarget } from '../../db/schema.js';
import { db } from '../../db/database.js';
import { TaskLogger } from '../logger.js';
import { LocalFileDeployer } from './local-file.js';
import { SshDeployer } from './ssh.js';
import { AliyunCdnDeployer } from './aliyun-cdn.js';
import { PanelDeployer, CloudflareDeployer } from './panel.js';
import { WebhookDeployer } from './webhook.js';

export interface DeployCertificatePayload {
  domains: string[];
  certPem: string;
  privkeyPem: string;
  fullchainPem: string;
  expiresAt: string;
}

export class DeployOrchestrator {
  public static async executeAll(
    targets: DeployTarget[],
    certData: DeployCertificatePayload,
    logger: TaskLogger
  ): Promise<{ targetId: string; success: boolean; error?: string }[]> {
    const results: { targetId: string; success: boolean; error?: string }[] = [];

    const activeTargets = targets.filter(t => t.enabled !== false);
    if (activeTargets.length === 0) {
      logger.info('未配置或未启用任何部署目标，跳过部署阶段。', 'DEPLOY');
      return results;
    }

    logger.info(`开始执行多目标证书部署，共有 ${activeTargets.length} 个部署目标...`, 'DEPLOY');

    for (const target of activeTargets) {
      try {
        const credential = target.credentialId ? db.findCredentialById(target.credentialId) : undefined;

        switch (target.type) {
          case 'local_file':
            await LocalFileDeployer.deploy(target, certData, logger);
            break;

          case 'ssh':
            if (!credential) throw new Error(`SSH 目标 [${target.name}] 缺少绑定的主机凭据`);
            await SshDeployer.deploy(target, credential, certData, logger);
            break;

          case 'aliyun_cdn':
            await AliyunCdnDeployer.deploy(target, credential, certData, logger);
            break;

          case 'cloudflare':
            await CloudflareDeployer.deploy(target, credential, certData, logger);
            break;

          case 'bt_panel':
            await PanelDeployer.deployBaota(target, credential, certData, logger);
            break;

          case 'one_panel':
            await PanelDeployer.deploy1Panel(target, credential, certData, logger);
            break;

          case 'safeline':
            await PanelDeployer.deploySafeLine(target, credential, certData, logger);
            break;

          case 'webhook':
            await WebhookDeployer.deploy(target, certData, logger);
            break;

          default:
            logger.warn(`未知的部署目标类型: ${target.type}`, 'DEPLOY');
            break;
        }

        results.push({ targetId: target.id, success: true });
      } catch (err: any) {
        logger.error(`部署目标 [${target.name}] 执行失败: ${err.message}`, 'DEPLOY');
        results.push({ targetId: target.id, success: false, error: err.message });
      }
    }

    return results;
  }
}
