import React, { useEffect, useState } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Layers, 
  Activity, 
  Sparkles, 
  RefreshCw, 
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  FileSearch
} from 'lucide-react';
import { DashboardStats, CertTask } from '../../types';
import { api } from '../../api/client';

interface OverviewViewProps {
  onOpenNewTask: () => void;
  onNavigateToTasks: () => void;
  onNavigateToCerts: () => void;
  onOpenInspectModal: () => void;
  onOpenLiveLogs: (taskId: string, taskName: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  onOpenNewTask,
  onNavigateToTasks,
  onNavigateToCerts,
  onOpenInspectModal,
  onOpenLiveLogs
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tasks, setTasks] = useState<CertTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [s, t] = await Promise.all([
        api.getStats(),
        api.getTasks()
      ]);
      setStats(s);
      setTasks(t);
    } catch (err) {
      console.error('Failed to load overview data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleManualCheck = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  // Get tasks that need attention (e.g. expiring soon or failed)
  const expiringTasks = tasks.filter(t => t.daysRemaining !== null && t.daysRemaining !== undefined && t.daysRemaining <= 30);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 rounded-2xl p-6 sm:p-8 text-white shadow-xl shadow-emerald-950/10 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-xs font-medium backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
              <span>全天候自动巡检 · 告别复杂连线流程图</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">SSL-Mate 证书自动化控制台</h2>
            <p className="text-emerald-100 text-sm leading-relaxed">
              集中管理各大云平台与服务器的 SSL 证书，全自动完成 DNS-01 验证、申请签发、多目标部署与到期前 30 天自动续期。
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full md:w-auto">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={onOpenNewTask}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 text-xs sm:text-sm font-bold shadow-lg transition-all active:scale-95 whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>新建自动化任务</span>
              </button>
              <button
                onClick={onOpenInspectModal}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs sm:text-sm font-medium backdrop-blur-md transition-colors whitespace-nowrap"
              >
                <FileSearch className="w-4 h-4 shrink-0" />
                <span>证书在线体检</span>
              </button>
              <button
                onClick={handleManualCheck}
                disabled={refreshing}
                className="p-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition-colors shrink-0"
                title="刷新统计数据"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">活跃 SSL 证书</span>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">{stats?.activeCerts || 0}</span>
            <span className="text-xs text-slate-400">/ 总计 {stats?.totalCerts || 0} 张</span>
          </div>
          <div className="mt-2 flex items-center text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <span>已启用 HTTPS 强加密托管</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">即将到期 (&le;30天)</span>
            <div className={`p-2.5 rounded-xl ${
              (stats?.expiringSoonCerts || 0) > 0 
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${
              (stats?.expiringSoonCerts || 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
            }`}>
              {stats?.expiringSoonCerts || 0}
            </span>
            <span className="text-xs text-slate-400">
              {(stats?.expiringSoonCerts || 0) > 0 ? '已列入自动续期计划' : '状态良好'}
            </span>
          </div>
          <div className="mt-2 flex items-center text-xs text-slate-500">
            <span>提前 30 天自动触发无感续签</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">自动化流水线</span>
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">{stats?.totalTasks || 0}</span>
            <span className="text-xs text-slate-400">个任务 ({stats?.activeTasks || 0} 自动运行)</span>
          </div>
          <div className="mt-2 flex items-center text-xs text-blue-600 dark:text-blue-400 font-medium">
            <span>成功运行 {stats?.tasksSuccessCount || 0} 次</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">域名健康探针</span>
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">{stats?.totalMonitors || 0}</span>
            <span className="text-xs text-slate-400">个线上站点</span>
          </div>
          <div className="mt-2 flex items-center text-xs text-purple-600 dark:text-purple-400 font-medium">
            <span>{stats?.healthyMonitors || 0} 正常 · {stats?.warningMonitors || 0} 需关注</span>
          </div>
        </div>
      </div>

      {/* Two Columns: Expiring Urgent Tasks + Recent Activity Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Urgent Expiry Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">证书到期与续期看板</h3>
              </div>
              <button
                onClick={onNavigateToTasks}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                <span>管理全部任务</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  暂无任务，点击右上角【新建 3 步任务】快速添加！
                </div>
              ) : (
                tasks.slice(0, 4).map(task => {
                  const days = task.daysRemaining ?? 90;
                  const isExpiring = days <= 30;
                  const progressPct = Math.min(100, Math.max(0, (days / 90) * 100));

                  return (
                    <div key={task.id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{task.name}</span>
                          <span className="text-xs text-slate-400 font-mono">({task.domains[0]})</span>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          days <= 10 
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300' 
                            : isExpiring 
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300' 
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300'
                        }`}>
                          剩余 {days} 天
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            days <= 10 ? 'bg-rose-500' : isExpiring ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        ></div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                        <span>自动续期: {task.autoRenew ? '✅ 已开启' : '❌ 手动'}</span>
                        <button
                          onClick={() => onOpenLiveLogs(task.id, task.name)}
                          className="text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          查看日志
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Recent Execution Logs */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-500" />
              <h3 className="font-bold text-slate-900 dark:text-white text-base">最近自动化执行日志</h3>
            </div>
            <span className="text-xs text-slate-400">实时更新</span>
          </div>

          <div className="mt-4 space-y-3">
            {(!stats?.recentLogs || stats.recentLogs.length === 0) ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                暂无执行记录，当任务触发续期或手动运行时将在此展示。
              </div>
            ) : (
              stats.recentLogs.slice(0, 5).map(log => (
                <div 
                  key={log.id} 
                  onClick={() => onOpenLiveLogs(log.taskId, log.taskName)}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    {log.status === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : log.status === 'failed' ? (
                      <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    ) : (
                      <RefreshCw className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
                    )}
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{log.taskName}</h4>
                      <p className="text-[11px] text-slate-400">
                        {new Date(log.startedAt).toLocaleTimeString()} · 耗时 {(log.durationMs / 1000).toFixed(1)}s · {log.triggerType === 'auto_cron' ? '定时巡检' : '手动执行'}
                      </p>
                    </div>
                  </div>

                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    log.status === 'success'
                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                      : log.status === 'failed'
                        ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                        : 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300'
                  }`}>
                    {log.status === 'success' ? '成功' : log.status === 'failed' ? '失败' : '执行中'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
