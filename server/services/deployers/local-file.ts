import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { DeployTarget } from '../../db/schema.js';
import { TaskLogger } from '../logger.js';

const execAsync = util.promisify(exec);

// Standard safe web-server reload commands whitelist
export const SAFE_RELOAD_COMMANDS = [
  'nginx -s reload',
  'systemctl reload nginx',
  'systemctl restart nginx',
  'systemctl reload openresty',
  'systemctl reload caddy',
  'caddy reload',
  'apachectl graceful',
  'systemctl reload apache2',
  'systemctl reload httpd',
  'docker exec nginx nginx -s reload'
];

export function isSafeReloadCommand(cmd: string): boolean {
  const normalized = cmd.trim().toLowerCase();
  return SAFE_RELOAD_COMMANDS.some(safeCmd => safeCmd.toLowerCase() === normalized);
}

export class LocalFileDeployer {
  public static async deploy(
    target: DeployTarget,
    certData: { fullchainPem: string; privkeyPem: string; certPem: string },
    logger: TaskLogger
  ) {
    const { targetPath, certFileName = 'cert.pem', keyFileName = 'privkey.pem', fullchainFileName = 'fullchain.pem', reloadCommand } = target.config;

    if (!targetPath) {
      throw new Error('未配置本地目标部署目录');
    }

    logger.info(`[本地部署] 目标目录: ${targetPath}`, 'DEPLOY_LOCAL');

    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    const fullchainPath = path.join(targetPath, fullchainFileName);
    const keyPath = path.join(targetPath, keyFileName);
    const certPath = path.join(targetPath, certFileName);

    fs.writeFileSync(fullchainPath, certData.fullchainPem, 'utf8');
    fs.writeFileSync(keyPath, certData.privkeyPem, 'utf8');
    fs.writeFileSync(certPath, certData.certPem, 'utf8');

    logger.success(`[本地部署] 证书文件已写入: ${fullchainFileName}, ${keyFileName}, ${certFileName}`, 'DEPLOY_LOCAL');

    if (reloadCommand && reloadCommand.trim()) {
      const trimmedCmd = reloadCommand.trim();
      const isWhitelisted = isSafeReloadCommand(trimmedCmd);

      if (isWhitelisted) {
        logger.info(`[本地部署] 执行安全白名单重载命令: ${trimmedCmd}`, 'DEPLOY_LOCAL');
      } else {
        logger.warn(`[安全审计] 执行自定义宿主机系统命令: "${trimmedCmd}" (已通过系统管理员身份授权)`, 'AUDIT_CMD');
      }

      try {
        const { stdout, stderr } = await execAsync(trimmedCmd, { timeout: 15000 });
        if (stdout) logger.info(`[重载输出] ${stdout.trim()}`, 'DEPLOY_LOCAL');
        if (stderr) logger.warn(`[重载提示] ${stderr.trim()}`, 'DEPLOY_LOCAL');
        logger.success(`[本地部署] 服务重载成功`, 'DEPLOY_LOCAL');
      } catch (err: any) {
        logger.error(`[本地部署] 服务重载失败: ${err.message}`, 'DEPLOY_LOCAL');
        throw new Error(`本地重载命令执行失败: ${err.message}`);
      }
    }
  }
}
