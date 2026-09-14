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

    // Check and recover interrupted tasks on boot
    this.recoverInterruptedTasks().catch(err => {
      console.error('[Scheduler] 恢复中断任务异常:', err);
    });

    // Also run an initial lightweight health scan
    setTimeout(async () => {
      await DomainMonitorService.checkAll();
    }, 5000);
  }

  /**
   * Check for interrupted renewing tasks caused by service reboot or crash,
   * recover their execution states, alert administrators, and re-enqueue if autoRenew is enabled.
   */
  public static async recoverInterruptedTasks() {
    const tasks = db.getTasks();
    const interruptedTasks = tasks.filter(t => t.status === 'renewing' || t.lastRunStatus === 'running');

    if (interruptedTasks.length === 0) {
      return;
    }

    console.log(`[Scheduler] 🔍 检测到 ${interruptedTasks.length} 个服务重启前处于运行中的中断任务，启动自愈容灾恢复机制...`);

    for (const task of interruptedTasks) {
      const interruptedStage = task.stage || 'INIT';
      console.warn(`[Scheduler] ⚠️ 发现中断任务 [${task.name}] (ID: ${task.id}, 中断阶段: ${interruptedStage})`);

      // 1. Close any hanging execution logs
      const hangingLogs = db.getExecutionLogs(task.id).filter(l => l.status === 'running');
      for (const hLog of hangingLogs) {
        hLog.status = 'failed';
        hLog.stage = 'FAILED';
        hLog.errorMessage = `服务异常重启导致任务中断于 [${interruptedStage}] 阶段`;
        hLog.finishedAt = new Date().toISOString();
        db.updateExecutionLog(hLog);
      }

      // 2. Dispatch failure notification alert if channels configured
      if (task.notifyChannelIds && task.notifyChannelIds.length > 0) {
        NotificationService.dispatch(task.notifyChannelIds, {
          event: 'renew_failed',
          taskName: task.name,
          domains: task.domains,
          errorMessage: `服务重启导致任务中断于 [${interruptedStage}] 阶段，调度器已触发自愈排队处理`
        });
      }

      // 3. Auto recover or reset state
      if (task.autoRenew) {
        task.status = 'pending';
        task.lastRunStatus = 'failed';
        task.lastRunMessage = `服务中断于 [${interruptedStage}] 阶段，已安排自愈重试`;
        db.upsertTask(task);

        console.log(`[Scheduler] 🔄 任务 [${task.name}] 开启了自动续期，安排 5 秒后自动重新触发签发...`);
        setTimeout(() => {
          TaskOrchestrator.executeTask(task.id, 'auto_cron').catch(err => {
            console.error(`[Scheduler] 任务 [${task.name}] 自愈重试失败:`, err);
          });
        }, 5000);
      } else {
        task.status = 'error';
        task.lastRunStatus = 'failed';
        task.lastRunMessage = `服务异常重启中断于 [${interruptedStage}] 阶段，请手动重新触发`;
        db.upsertTask(task);
        console.log(`[Scheduler] ℹ️ 任务 [${task.name}] 为手动模式，已重置状态解除锁定`);
      }
    }
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

          // 1. Expiring soon alert (dispatched when remaining days <= 7)
          if (diffDays <= 7 && diffDays > 0) {
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

          // 2. Automatic renewal trigger check
          if (diffDays <= renewDaysThreshold) {
            needRenew = true;
            reason = `证书剩余有效期为 ${diffDays} 天 (阈值: <= ${renewDaysThreshold} 天)`;
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
