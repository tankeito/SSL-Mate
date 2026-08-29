import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  X, 
  Terminal, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Download, 
  Trash2, 
  ShieldCheck, 
  ExternalLink,
  Play,
  Layers,
  ArrowRight
} from 'lucide-react';
import { api } from '../../api/client';
import { CertTask } from '../../types';

interface TaskExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskName: string;
  onNavigateToCerts?: () => void;
  onRetryTask?: (taskId: string) => void;
}

interface LogItem {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  stage?: string;
}

type PipelineStage = 'INIT' | 'ACME_CSR' | 'DNS_VERIFY' | 'STORAGE_DEPLOY' | 'DONE' | 'FAILED';

export const TaskExecutionModal: React.FC<TaskExecutionModalProps> = ({
  isOpen,
  onClose,
  taskId,
  taskName,
  onNavigateToCerts,
  onRetryTask
}) => {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [status, setStatus] = useState<'running' | 'success' | 'failed'>('running');
  const [currentStage, setCurrentStage] = useState<PipelineStage>('INIT');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Determine stage and status based on log contents
  useEffect(() => {
    if (!logs.length) {
      setCurrentStage('INIT');
      setStatus('running');
      setErrorMessage(null);
      return;
    }

    const lastError = logs.slice().reverse().find(l => l.level === 'error');
    const isSuccess = logs.some(l => l.message.includes('证书已成功签发') || l.message.includes('证书资产已归档入库') || l.level === 'success' && l.message.includes('完成'));

    if (lastError) {
      setStatus('failed');
      setCurrentStage('FAILED');
      setErrorMessage(lastError.message);
    } else if (isSuccess) {
      setStatus('success');
      setCurrentStage('DONE');
      setErrorMessage(null);
    } else {
      setStatus('running');
      const latest = logs[logs.length - 1];
      if (latest.stage === 'DNS' || latest.message.includes('DNS') || latest.message.includes('TXT')) {
        setCurrentStage('DNS_VERIFY');
      } else if (latest.stage === 'CSR' || latest.stage === 'ACME' || latest.message.includes('CSR')) {
        setCurrentStage('ACME_CSR');
      } else if (latest.stage === 'STORAGE' || latest.stage === 'DEPLOY') {
        setCurrentStage('STORAGE_DEPLOY');
      } else {
        setCurrentStage('INIT');
      }
    }
  }, [logs]);

  // Connect SSE and fetch initial history
  useEffect(() => {
    if (isOpen && taskId) {
      setLogs([]);
      setStatus('running');
      setCurrentStage('INIT');
      setErrorMessage(null);

      // Fetch existing logs
      api.getTaskLogs(taskId).then(history => {
        if (history && history.length > 0) {
          const latest = history[0];
          if (latest.logs && Array.isArray(latest.logs)) {
            setLogs(latest.logs);
          }
        }
      }).catch(console.error);

      // Connect SSE
      const eventSource = new EventSource(`/events/tasks/${taskId}`);

      eventSource.onopen = () => {
        setConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as LogItem;
          setLogs(prev => [...prev, data]);
        } catch (err) {}
      };

      eventSource.onerror = () => {
        setConnected(false);
      };

      return () => {
        eventSource.close();
        setConnected(false);
      };
    }
  }, [isOpen, taskId]);

  // Auto scroll
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  if (!isOpen) return null;

  const downloadLogs = () => {
    const text = logs.map(l => `[${l.timestamp}] [${l.level.toUpperCase()}]${l.stage ? ` [${l.stage}]` : ''} ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `task_${taskId}_execution_log.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stages = [
    { key: 'INIT', label: '1. 初始化环境', desc: 'CA 账号与策略校验' },
    { key: 'ACME_CSR', label: '2. 私钥与 CSR', desc: '生成高强度私钥与订单' },
    { key: 'DNS_VERIFY', label: '3. DNS-01 验证', desc: 'TXT 写入与全球预检' },
    { key: 'STORAGE_DEPLOY', label: '4. 签发与归档', desc: 'CA 颁发与多端部署' }
  ];

  const getStageStatus = (stageKey: string) => {
    if (status === 'failed') {
      if (currentStage === stageKey || stageKey === 'DNS_VERIFY') return 'failed';
      return 'done';
    }
    if (status === 'success') return 'done';
    if (currentStage === stageKey) return 'active';
    const order = ['INIT', 'ACME_CSR', 'DNS_VERIFY', 'STORAGE_DEPLOY'];
    const currentIndex = order.indexOf(currentStage);
    const thisIndex = order.indexOf(stageKey);
    return thisIndex < currentIndex ? 'done' : 'pending';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shadow-md transition-all ${
              status === 'running' 
                ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white animate-pulse' 
                : status === 'success' 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-rose-500 text-white'
            }`}>
              {status === 'running' ? <RefreshCw className="w-5 h-5 animate-spin" /> : status === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {taskName}
                </h3>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                  status === 'running'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                    : status === 'success'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                }`}>
                  {status === 'running' ? '● 正在自动化执行中' : status === 'success' ? '✓ 签发已成功' : '✕ 执行遇到错误'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">任务 ID: {taskId} · 实时 SSE 事件流</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={downloadLogs}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="下载完整日志"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 4-Stage Visual Stepper */}
        <div className="px-6 py-4 bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {stages.map((st) => {
              const stStatus = getStageStatus(st.key);
              return (
                <div 
                  key={st.key}
                  className={`p-2.5 rounded-2xl border transition-all ${
                    stStatus === 'active'
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-sm'
                      : stStatus === 'done'
                        ? 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        : stStatus === 'failed'
                          ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 text-rose-700 dark:text-rose-300'
                          : 'bg-slate-100/60 dark:bg-slate-800/30 border-transparent text-slate-400 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    {stStatus === 'active' ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : stStatus === 'done' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : stStatus === 'failed' ? (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 inline-block shrink-0"></span>
                    )}
                    <span className="truncate">{st.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">{st.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Terminal Log Console */}
        <div className="p-5 font-mono text-xs overflow-y-auto flex-1 space-y-1.5 bg-slate-950 text-slate-200 selection:bg-emerald-500/30 selection:text-emerald-200 min-h-[260px]">
          {logs.length === 0 ? (
            <div className="text-slate-500 py-16 text-center flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
              <span>正在建立实时事件通道，等待任务输出...</span>
            </div>
          ) : (
            logs.map((log, idx) => {
              const isErr = log.level === 'error';
              const isSucc = log.level === 'success';
              const isWarn = log.level === 'warn';

              return (
                <div key={idx} className="flex items-start gap-2.5 leading-relaxed break-all">
                  <span className="text-slate-500 text-[11px] shrink-0 select-none">
                    {log.timestamp ? log.timestamp.split('T')[1]?.split('.')[0] || log.timestamp : '00:00:00'}
                  </span>

                  {log.stage && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-800 text-slate-300 shrink-0 select-none">
                      {log.stage}
                    </span>
                  )}

                  <span className={
                    isErr 
                      ? 'text-rose-400 font-semibold' 
                      : isSucc 
                        ? 'text-emerald-400 font-semibold' 
                        : isWarn 
                          ? 'text-amber-300' 
                          : 'text-slate-300'
                  }>
                    {log.message}
                  </span>
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* Footer Status & Action Buttons */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 text-xs">
            <label className="flex items-center gap-1.5 text-slate-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={e => setAutoScroll(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>自动滚动</span>
            </label>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-slate-400">共 {logs.length} 行输出</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {status === 'failed' && (
              <button
                type="button"
                onClick={() => onRetryTask && onRetryTask(taskId)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md transition-all active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>重新执行此任务</span>
              </button>
            )}

            {status === 'success' && onNavigateToCerts && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToCerts();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all active:scale-95"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>查看证书资产 ➔</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold"
            >
              关闭
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
