import { Cron } from 'croner';
import { db } from '../db/database.js';
import { TaskOrchestrator } from './orchestrator.js';
import { DomainMonitorService } from './monitor.js';
import { NotificationService } from './notify.js';

export class SchedulerService {
  private static globalJob: Cron | null = null;

  public static init() {
    const settings = db.getSettings();
    const cronPattern = settings.globalRenewCheckCron || '0 2 * * *';

    console.log(`[Scheduler] 启动全局自动化巡检计划，Cron 表达式: ${cronPattern}`);

    if (this.globalJob) {
      this.globalJob.stop();
    }

    this.globalJob = new Cron(cronPattern, async () => {
      console.log('[Scheduler] ⏰ 触发每日证书生命周期巡检与自动续期任务...');
      await this.runAutoRenewalCheck();
      await DomainMonitorService.checkAll();
    });

    // Also run an initial lightweight health scan
    setTimeout(async () => {
      await DomainMonitorService.checkAll();
    }, 5000);
  }

  public static async runAutoRenewalCheck() {
    const tasks = db.getTasks().filter(t => t.autoRenew);
    const now = Date.now();

    for (const task of tasks) {
      const renewDaysThreshold = task.renewDaysBefore || 30;

      let needRenew = false;
      let reason = '';

      if (!task.currentCertId) {
        needRenew = true;
        reason = '任务尚未签发任何初始证书';
      } else {
        const cert = db.findCertificateById(task.currentCertId);
        if (!cert) {
          needRenew = true;
          reason = '关联的历史证书记录丢失';
        } else {
          const expiresTime = new Date(cert.expiresAt).getTime();
          const diffDays = Math.floor((expiresTime - now) / (1000 * 60 * 60 * 24));

          if (diffDays <= renewDaysThreshold) {
            needRenew = true;
            reason = `证书剩余有效期为 ${diffDays} 天 (阈值: <= ${renewDaysThreshold} 天)`;
          } else if (diffDays <= 7) {
            // Expiring soon alert
            if (task.notifyChannelIds && task.notifyChannelIds.length > 0) {
              NotificationService.dispatch(task.notifyChannelIds, {
                event: 'expiring_soon',
                taskName: task.name,
                domains: task.domains,
                expiresAt: cert.expiresAt,
                daysLeft: diffDays
              });
            }
          }
        }
      }

      if (needRenew) {
        console.log(`[Scheduler] 任务 [${task.name}] 触发自动续期，原因: ${reason}`);
        // Execute asynchronously
        TaskOrchestrator.executeTask(task.id, 'auto_cron').catch(err => {
          console.error(`[Scheduler] 任务 [${task.name}] 自动续期异常:`, err);
        });
      }
    }
  }
}
