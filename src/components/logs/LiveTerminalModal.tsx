import React, { useState, useEffect, useRef } from 'react';
import { Terminal, X, RefreshCw, CheckCircle2, AlertCircle, Trash2, Download } from 'lucide-react';
import { api } from '../../api/client';

interface LiveTerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskName: string;
}

interface LogItem {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  stage?: string;
}

export const LiveTerminalModal: React.FC<LiveTerminalModalProps> = ({
  isOpen,
  onClose,
  taskId,
  taskName
}) => {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Fetch initial history logs
  useEffect(() => {
    if (isOpen && taskId) {
      setLogs([]);
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
        } catch (err) {
          // ignore
        }
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
    a.download = `task_${taskId}_logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col h-[80vh]">
        {/* Terminal Header */}
        <div className="px-5 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
            </div>

            <div className="flex items-center gap-2 pl-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="font-mono font-bold text-xs text-slate-200">{taskName} (ID: {taskId})</span>
              <span className={`text-[10px] font-mono px-2 py-0.2 rounded-full ${
                connected ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60' : 'bg-slate-800 text-slate-400'
              }`}>
                {connected ? '● LIVE SSE' : '○ 离线/就绪'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLogs([])}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="清空当前屏幕"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={downloadLogs}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="下载完整日志"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Terminal Body */}
        <div className="p-5 font-mono text-xs overflow-y-auto flex-1 space-y-1.5 bg-black/50 selection:bg-emerald-500/30 selection:text-emerald-200">
          {logs.length === 0 ? (
            <div className="text-slate-500 py-12 text-center flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-slate-600" />
              <span>等待任务执行输出日志...</span>
            </div>
          ) : (
            logs.map((log, idx) => {
              const levelColor = 
                log.level === 'error' ? 'text-rose-400' :
                log.level === 'warn' ? 'text-amber-400' :
                log.level === 'success' ? 'text-emerald-400 font-bold' :
                'text-slate-300';

              return (
                <div key={idx} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-slate-600 shrink-0 text-[11px]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  {log.stage && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400 shrink-0 uppercase">
                      {log.stage}
                    </span>
                  )}
                  <span className={`${levelColor} whitespace-pre-wrap break-all`}>
                    {log.message}
                  </span>
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* Terminal Footer */}
        <div className="px-5 py-2.5 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={e => setAutoScroll(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-emerald-500"
            />
            <span>自动向下滚动</span>
          </label>
          <span>共 {logs.length} 行输出</span>
        </div>
      </div>
    </div>
  );
};
