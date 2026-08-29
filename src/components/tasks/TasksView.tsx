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
  ShieldCheck
} from 'lucide-react';
import { CertTask } from '../../types';
import { api } from '../../api/client';
import { useModal } from '../../contexts/ModalContext';

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
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      const data = await api.getTasks();
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const timer = setInterval(fetchTasks, 5000); // Polling status every 5s
    return () => clearInterval(timer);
  }, []);

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

  const filteredTasks = tasks.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.domains.some(d => d.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header with Search and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">证书自动化任务</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">已配置的域名申请与自动部署流水线</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索任务或域名..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchTasks}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
              title="刷新列表"
            >
              <RefreshCw className="w-4 h-4" />
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
      </div>

      {/* Task List Table / Cards */}
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
            <h3 className="font-bold text-slate-800 dark:text-slate-200">暂无证书任务</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              只需 3 步即可配置一个自动为您的域名申请 Let's Encrypt / ZeroSSL 证书并部署到 Nginx / CDN 的自动化任务。
            </p>
          </div>
          <button
            onClick={onOpenNewTask}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>立即创建第一个任务</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredTasks.map(task => {
            const isRunning = task.lastRunStatus === 'running' || runningTaskId === task.id;
            const days = task.daysRemaining;

            return (
              <div
                key={task.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left info */}
                <div className="space-y-2 max-w-xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">{task.name}</h3>
                    
                    {/* Status Badge */}
                    {isRunning ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 animate-pulse">
                        <RefreshCw className="w-3 h-3 animate-spin" /> 执行中
                      </span>
                    ) : days !== null && days !== undefined ? (
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

                    {task.autoRenew && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                        自动续期开启
                      </span>
                    )}
                  </div>

                  {/* Domain Badges */}
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {task.domains.map((domain, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono font-medium"
                      >
                        {domain}
                      </span>
                    ))}
                    <span className="text-xs text-slate-400 ml-1">
                      ({task.keyType?.toUpperCase() || 'EC256'})
                    </span>
                  </div>

                  {/* Deploy targets summary */}
                  <div className="flex items-center gap-3 text-xs text-slate-400 pt-1">
                    <div className="flex items-center gap-1">
                      <Server className="w-3.5 h-3.5" />
                      <span>部署目标: {task.deployTargets?.length || 0} 个</span>
                    </div>
                    {task.lastRunAt && (
                      <div>
                        上次运行: {new Date(task.lastRunAt).toLocaleString()} ({task.lastRunStatus === 'success' ? '成功' : '失败'})
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Action buttons */}
                <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => handleRunTask(task)}
                    disabled={isRunning}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                    title="立即执行证书申请与部署"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>立即运行</span>
                  </button>

                  <button
                    onClick={() => onOpenLiveLogs(task.id, task.name)}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
                    title="实时日志"
                  >
                    <FileText className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onEditTask(task)}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
                    title="编辑任务"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteTask(task.id, task.name)}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 text-xs font-medium transition-colors"
                    title="删除任务"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
