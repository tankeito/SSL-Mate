import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Play, 
  FileText, 
  Edit3, 
  Trash2, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Layers, 
  Server, 
  ShieldCheck,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Globe,
  Tag,
  ExternalLink,
  Zap
} from 'lucide-react';
import { CertTask } from '../../types';
import { api } from '../../api/client';
import { useModal } from '../../contexts/ModalContext';

type TaskStatusFilter = 'all' | 'running' | 'healthy' | 'warning' | 'expired_unissued';

interface TasksViewProps {
  onOpenNewTask: () => void;
  onEditTask: (task: CertTask) => void;
  onOpenLiveLogs: (taskId: string, taskName: string) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  onOpenNewTask,
  onEditTask,
  onOpenLiveLogs
}) => {
  const { confirm, toast } = useModal();
  const [tasks, setTasks] = useState<CertTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Pagination (12 items per page = 4 cols x 3 rows)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const fetchTasks = async (showToast = false) => {
    if (showToast) setRefreshing(true);
    try {
      const data = await api.getTasks();
      setTasks(data);
      if (showToast) {
        toast.success('自动化任务列表已刷新');
      }
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
      if (showToast) {
        setTimeout(() => setRefreshing(false), 500);
      }
    }
  };

  useEffect(() => {
    fetchTasks();
    const timer = setInterval(fetchTasks, 5000); // Polling status every 5s
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, pageSize]);

  const handleRunTask = async (task: CertTask) => {
    try {
      setRunningTaskId(task.id);
      await api.runTask(task.id);
      toast.info(`已启动任务 [${task.name}] 执行流水线`);
      onOpenLiveLogs(task.id, task.name);
      fetchTasks();
    } catch (err: any) {
      toast.error(`启动任务失败: ${err.message}`);
    } finally {
      setRunningTaskId(null);
    }
  };

  const handleDeleteTask = async (id: string, name: string) => {
    const ok = await confirm({
      title: '删除证书流水线任务',
      message: `确定要删除任务 [${name}] 吗？删除后将停止该证书的自动续期与部署。`,
      confirmText: '确认删除',
      type: 'danger'
    });
    if (!ok) return;

    try {
      await api.deleteTask(id);
      setTasks(tasks.filter(t => t.id !== id));
      toast.success(`已成功删除任务 [${name}]`);
    } catch (err: any) {
      toast.error(`删除失败: ${err.message}`);
    }
  };

  // Filter Logic
  const filteredTasks = tasks.filter(t => {
    const isRunning = t.lastRunStatus === 'running' || runningTaskId === t.id;
    const days = t.daysRemaining;

    const matchSearch = 
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.domains.some(d => d.toLowerCase().includes(search.toLowerCase()));

    if (!matchSearch) return false;

    if (statusFilter === 'all') return true;
    if (statusFilter === 'running') return isRunning;
    if (statusFilter === 'healthy') return !isRunning && days !== null && days !== undefined && days > 30;
    if (statusFilter === 'warning') return !isRunning && days !== null && days !== undefined && days > 0 && days <= 30;
    if (statusFilter === 'expired_unissued') return !isRunning && (days === null || days === undefined || days <= 0);

    return true;
  });

  // Statistics
  const countAll = tasks.length;
  const countRunning = tasks.filter(t => t.lastRunStatus === 'running' || runningTaskId === t.id).length;
  const countHealthy = tasks.filter(t => (t.daysRemaining ?? -1) > 30 && t.lastRunStatus !== 'running').length;
  const countWarning = tasks.filter(t => {
    const d = t.daysRemaining;
    return d !== null && d !== undefined && d > 0 && d <= 30 && t.lastRunStatus !== 'running';
  }).length;
  const countExpiredOrUnissued = tasks.filter(t => {
    const d = t.daysRemaining;
    return (d === null || d === undefined || d <= 0) && t.lastRunStatus !== 'running';
  }).length;

  // Pagination slicing
  const totalPages = Math.ceil(filteredTasks.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedTasks = filteredTasks.slice(startIndex, startIndex + pageSize);

  return (
    <div className="flex-1 flex flex-col justify-between space-y-6">
      <div className="space-y-5">
        {/* Header with Search, Switcher and Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>证书自动化任务</span>
              <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 font-mono">
                {countAll} 任务
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">已配置的域名申请与自动部署流水线</p>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            {/* View mode toggle */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl gap-1 shrink-0">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                title="卡片矩阵视图"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                title="紧凑表格视图"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => fetchTasks(true)}
              disabled={refreshing}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 shrink-0"
              title="刷新列表"
            >
              <RefreshCw className={`w-4 h-4 transition-transform duration-500 ${refreshing ? 'animate-spin text-emerald-500' : ''}`} />
            </button>

            <button
              onClick={onOpenNewTask}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all active:scale-95 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>新建 3 步任务</span>
            </button>
          </div>
        </div>

        {/* Filter Chips & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-3 rounded-2xl shadow-sm">
          {/* Status Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              全部 ({countAll})
            </button>
            {countRunning > 0 && (
              <button
                onClick={() => setStatusFilter('running')}
                className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                  statusFilter === 'running'
                    ? 'bg-blue-600 text-white font-bold shadow-sm'
                    : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                }`}
              >
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>执行中 ({countRunning})</span>
              </button>
            )}
            <button
              onClick={() => setStatusFilter('healthy')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                statusFilter === 'healthy'
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>正常有效 ({countHealthy})</span>
            </button>
            <button
              onClick={() => setStatusFilter('warning')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                statusFilter === 'warning'
                  ? 'bg-amber-500 text-white font-bold shadow-sm'
                  : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>即将到期 ({countWarning})</span>
            </button>
            {countExpiredOrUnissued > 0 && (
              <button
                onClick={() => setStatusFilter('expired_unissued')}
                className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                  statusFilter === 'expired_unissued'
                    ? 'bg-rose-600 text-white font-bold shadow-sm'
                    : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                <span>已过期/未签发 ({countExpiredOrUnissued})</span>
              </button>
            )}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索任务或域名..."
              className="w-full pl-9 pr-3.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Task List: Grid or Table */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">
                {search || statusFilter !== 'all' ? '未找到符合条件的任务' : '暂无证书任务'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                {search || statusFilter !== 'all' 
                  ? '请尝试清除搜索关键词或重置状态过滤项' 
                  : '只需 3 步即可配置一个自动为您的域名申请 Let\'s Encrypt / ZeroSSL 证书并部署到 Nginx / CDN 的自动化任务。'}
              </p>
            </div>
            {!search && statusFilter === 'all' && (
              <button
                onClick={onOpenNewTask}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>立即创建第一个任务</span>
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* ================= 1. Modern 4-Column Card Grid (1 Row 4 Cards) ================= */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedTasks.map(task => {
              const isRunning = task.lastRunStatus === 'running' || runningTaskId === task.id;
              const days = task.daysRemaining;
              const hasDays = days !== null && days !== undefined;
              const isHealthy = hasDays && days > 30;
              const isWarning = hasDays && days > 0 && days <= 30;
              const isExpired = hasDays && days <= 0;
              const progressPercent = hasDays ? Math.min(Math.max((days / 90) * 100, 4), 100) : 0;
              const primaryDomain = task.domains[0] || '未绑定域名';
              const otherDomainsCount = task.domains.length - 1;

              return (
                <div
                  key={task.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-500/50 dark:hover:border-emerald-500/40 rounded-3xl p-4 sm:p-4.5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group relative overflow-hidden flex flex-col justify-between"
                >
                  {/* Top Status Gradient Bar */}
                  <div className={`absolute top-0 left-0 right-0 h-1 ${
                    isRunning ? 'bg-gradient-to-r from-blue-500 to-indigo-500 animate-pulse' :
                    isHealthy ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                    isWarning ? 'bg-gradient-to-r from-amber-500 to-orange-400' :
                    isExpired ? 'bg-gradient-to-r from-rose-500 to-pink-500' :
                    'bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-700 dark:to-slate-600'
                  }`}></div>

                  <div className="space-y-3 pt-1">
                    {/* Card Header: Icon + Task Name + Status Pill */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className={`w-9 h-9 rounded-2xl shrink-0 flex items-center justify-center relative mt-0.5 shadow-sm ${
                          isRunning ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400' :
                          isHealthy ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400' :
                          isWarning ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400' :
                          isExpired ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400' :
                          'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          <Layers className="w-4 h-4" />
                          <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                            isRunning ? 'bg-blue-500 animate-ping' :
                            isHealthy ? 'bg-emerald-500' :
                            isWarning ? 'bg-amber-500' :
                            isExpired ? 'bg-rose-500' :
                            'bg-slate-400'
                          }`}></span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" title={task.name}>
                            {task.name}
                          </h3>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 flex-wrap">
                            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-slate-500 dark:text-slate-400">
                              {task.keyType?.toUpperCase() || 'EC256'}
                            </span>
                            {task.autoRenew && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-medium">
                                <Zap className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                                <span>自动续期</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status Pill Badge */}
                      {isRunning ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 animate-pulse shrink-0 border border-blue-200 dark:border-blue-800/50">
                          <RefreshCw className="w-3 h-3 animate-spin" /> 执行中
                        </span>
                      ) : hasDays ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${
                          isHealthy ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50' :
                          isWarning ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800/50' :
                          'bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border-rose-200 dark:border-rose-800/50'
                        }`}>
                          {days <= 0 ? '已过期' : `剩余 ${days} 天`}
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                          未签发
                        </span>
                      )}
                    </div>

                    {/* Domain Box */}
                    <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 truncate" title={primaryDomain}>
                            {primaryDomain}
                          </span>
                        </div>
                        {otherDomainsCount > 0 && (
                          <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                            +{otherDomainsCount}
                          </span>
                        )}
                      </div>

                      {/* Mini Progress Bar if certificate issued */}
                      {hasDays && (
                        <div className="pt-1 space-y-1">
                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                isExpired ? 'bg-rose-500' :
                                isWarning ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                                'bg-gradient-to-r from-emerald-500 to-teal-500'
                              }`}
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Deploy targets and Last Run Status */}
                    <div className="space-y-1 text-[11px] text-slate-400">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Server className="w-3 h-3 text-slate-400" />
                          <span>部署目标:</span>
                        </span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {task.deployTargets?.length || 0} 个节点
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span>上次运行:</span>
                        {task.lastRunAt ? (
                          <span className={`inline-flex items-center gap-1 font-medium ${
                            task.lastRunStatus === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${task.lastRunStatus === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                            <span>{new Date(task.lastRunAt).toLocaleDateString()} ({task.lastRunStatus === 'success' ? '成功' : '失败'})</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">未执行</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer Action Bar */}
                  <div className="flex items-center justify-between pt-2.5 mt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <button
                      onClick={() => handleRunTask(task)}
                      disabled={isRunning}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50"
                      title="立即执行证书申请与部署流水线"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>{isRunning ? '执行中...' : '立即运行'}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onOpenLiveLogs(task.id, task.name)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="实时日志"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onEditTask(task)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="编辑任务"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id, task.name)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        title="删除任务"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ================= 2. Compact Table View ================= */
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="py-3 px-4">任务名称</th>
                    <th className="py-3 px-4">域名清单</th>
                    <th className="py-3 px-4">证书有效期</th>
                    <th className="py-3 px-4">自动续期</th>
                    <th className="py-3 px-4">部署目标</th>
                    <th className="py-3 px-4">上次运行</th>
                    <th className="py-3 px-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedTasks.map(task => {
                    const isRunning = task.lastRunStatus === 'running' || runningTaskId === task.id;
                    const days = task.daysRemaining;
                    const hasDays = days !== null && days !== undefined;

                    return (
                      <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span>{task.name}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 font-mono font-medium">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-slate-900 dark:text-white">{task.domains[0]}</span>
                            {task.domains.length > 1 && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                                +{task.domains.length - 1} 域名
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          {isRunning ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 animate-pulse">
                              <RefreshCw className="w-3 h-3 animate-spin" /> 执行中
                            </span>
                          ) : hasDays ? (
                            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                              days <= 10 
                                ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300' 
                                : days <= 30 
                                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300' 
                                  : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                            }`}>
                              {days <= 0 ? '已过期' : `剩余 ${days} 天`}
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                              未签发证书
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {task.autoRenew ? (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                              开启
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">关闭</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span className="text-slate-700 dark:text-slate-300 font-medium">
                            {task.deployTargets?.length || 0} 个节点
                          </span>
                        </td>

                        <td className="py-3 px-4 text-[11px] text-slate-400">
                          {task.lastRunAt ? (
                            <span>{new Date(task.lastRunAt).toLocaleDateString()} ({task.lastRunStatus === 'success' ? '成功' : '失败'})</span>
                          ) : (
                            <span>未执行</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleRunTask(task)}
                              disabled={isRunning}
                              className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors disabled:opacity-50"
                              title="立即执行流水线"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </button>
                            <button
                              onClick={() => onOpenLiveLogs(task.id, task.name)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                              title="实时日志"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onEditTask(task)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="编辑任务"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTask(task.id, task.name)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                              title="删除任务"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Pagination Footer Bar (Always at bottom on PC) */}
      {filteredTasks.length > 0 && (
        <div className="mt-auto pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm text-xs text-slate-500 dark:text-slate-400">
            <div>
              显示第 {filteredTasks.length === 0 ? 0 : `${startIndex + 1}-${Math.min(startIndex + pageSize, filteredTasks.length)}`} 项，共 {filteredTasks.length} 项
            </div>

            {/* Page Navigation */}
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent flex items-center justify-center transition-colors"
                title="上一页"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => {
                  const pNum = i + 1;
                  if (totalPages > 6 && Math.abs(pNum - currentPage) > 2 && pNum !== 1 && pNum !== totalPages) {
                    if (Math.abs(pNum - currentPage) === 3) {
                      return <span key={pNum} className="px-1 text-slate-400">...</span>;
                    }
                    return null;
                  }

                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => setCurrentPage(pNum)}
                      className={`min-w-[28px] h-7 px-2 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center ${
                        currentPage === pNum
                          ? 'bg-teal-600 dark:bg-emerald-600 text-white shadow-sm'
                          : 'border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent flex items-center justify-center transition-colors"
                title="下一页"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
