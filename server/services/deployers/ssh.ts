import { Client } from 'ssh2';
import path from 'path';
import { DeployTarget, Credential } from '../../db/schema.js';
import { decryptObject } from '../crypto.js';
import { TaskLogger } from '../logger.js';

export interface SshConfig {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export class SshDeployer {
  public static async deploy(
    target: DeployTarget,
    credential: Credential,
    certData: { fullchainPem: string; privkeyPem: string; certPem: string },
    logger: TaskLogger
  ): Promise<void> {
    const { targetPath = '/etc/nginx/ssl', certFileName = 'cert.pem', keyFileName = 'privkey.pem', fullchainFileName = 'fullchain.pem', reloadCommand } = target.config;

    const sshConfig = decryptObject<SshConfig>(credential.config as any);

    if (!sshConfig.host || !sshConfig.username) {
      throw new Error('SSH 主机地址或用户名未配置');
    }

    logger.info(`[SSH部署] 正在连接远程主机 ${sshConfig.username}@${sshConfig.host}:${sshConfig.port || 22}...`, 'DEPLOY_SSH');

    return new Promise((resolve, reject) => {
      const conn = new Client();

      conn.on('ready', () => {
        logger.success(`[SSH部署] 远程连接成功，准备传输证书文件到 ${targetPath}`, 'DEPLOY_SSH');

        conn.sftp((err, sftp) => {
          if (err) {
            conn.end();
            return reject(new Error(`SFTP 启动失败: ${err.message}`));
          }

          // Ensure remote directory exists
          const mkdirCmd = `mkdir -p "${targetPath}"`;
          conn.exec(mkdirCmd, (execErr, stream) => {
            if (execErr) {
              conn.end();
              return reject(new Error(`创建远程目录失败: ${execErr.message}`));
            }

            stream.on('close', () => {
              // Write files via SFTP
              const fullchainRemote = path.posix.join(targetPath, fullchainFileName);
              const keyRemote = path.posix.join(targetPath, keyFileName);
              const certRemote = path.posix.join(targetPath, certFileName);

              const writeFullchain = sftp.createWriteStream(fullchainRemote);
              const writeKey = sftp.createWriteStream(keyRemote);
              const writeCert = sftp.createWriteStream(certRemote);

              writeFullchain.end(certData.fullchainPem);
              writeKey.end(certData.privkeyPem);
              writeCert.end(certData.certPem);

              let completed = 0;
              const checkDone = () => {
                completed++;
                if (completed === 3) {
                  logger.success(`[SSH部署] 证书文件已成功上传至远程服务器`, 'DEPLOY_SSH');

                  if (reloadCommand && reloadCommand.trim()) {
                    logger.info(`[SSH部署] 执行远程服务重载命令: ${reloadCommand}`, 'DEPLOY_SSH');
                    conn.exec(reloadCommand, (cmdErr, cmdStream) => {
                      if (cmdErr) {
                        conn.end();
                        return reject(new Error(`远程执行命令失败: ${cmdErr.message}`));
                      }

                      let cmdOutput = '';
                      cmdStream.on('data', (data: Buffer) => {
                        cmdOutput += data.toString();
                      });

                      cmdStream.on('close', (code: number) => {
                        conn.end();
                        if (code === 0) {
                          if (cmdOutput.trim()) logger.info(`[SSH输出] ${cmdOutput.trim()}`, 'DEPLOY_SSH');
                          logger.success(`[SSH部署] 远程服务重载完成`, 'DEPLOY_SSH');
                          resolve();
                        } else {
                          logger.error(`[SSH部署] 远程命令执行退出码异常: ${code} - ${cmdOutput}`, 'DEPLOY_SSH');
                          reject(new Error(`远程命令执行失败 (Exit Code ${code}): ${cmdOutput}`));
                        }
                      });
                    });
                  } else {
                    conn.end();
                    resolve();
                  }
                }
              };

              writeFullchain.on('finish', checkDone);
              writeKey.on('finish', checkDone);
              writeCert.on('finish', checkDone);

              writeFullchain.on('error', (e: any) => { conn.end(); reject(e); });
              writeKey.on('error', (e: any) => { conn.end(); reject(e); });
              writeCert.on('error', (e: any) => { conn.end(); reject(e); });
            });
          });
        });
      });

      conn.on('error', (err) => {
        logger.error(`[SSH部署] SSH 连接错误: ${err.message}`, 'DEPLOY_SSH');
        reject(err);
      });

      const connectOptions: any = {
        host: sshConfig.host,
        port: sshConfig.port || 22,
        username: sshConfig.username,
        readyTimeout: 10000
      };

      if (sshConfig.password) {
        connectOptions.password = sshConfig.password;
      }
      if (sshConfig.privateKey) {
        connectOptions.privateKey = sshConfig.privateKey;
        if (sshConfig.passphrase) {
          connectOptions.passphrase = sshConfig.passphrase;
        }
      }

      conn.connect(connectOptions);
    });
  }
}
