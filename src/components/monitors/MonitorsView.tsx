import React, { useState, useEffect } from 'react';
import { Activity, Plus, Trash2, RefreshCw, ShieldCheck, AlertTriangle, XCircle, Globe, X } from 'lucide-react';
import { DomainMonitor } from '../../types';
import { api } from '../../api/client';
import { useModal } from '../../contexts/ModalContext';

export const MonitorsView: React.FC = () => {
  const { confirm, toast } = useModal();
  const [monitors, setMonitors] = useState<DomainMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [portInput, setPortInput] = useState(443);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const fetchMonitors = async () => {
    try {
      const data = await api.getMonitors();
      setMonitors(data);
    } catch (err) {
      console.error('Failed to load monitors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitors();
  }, []);

  const handleAddMonitor = async () => {
    if (!domainInput.trim()) {
      toast.warning('请输入待监控的有效域名');
      return;
    }
    try {
      await api.createMonitor({ domain: domainInput.trim(), port: portInput });
      setDomainInput('');
      setModalOpen(false);
      toast.success(`成功添加监控域名: ${domainInput.trim()}`);
      fetchMonitors();
    } catch (err: any) {
      toast.error(`添加探针失败: ${err.message}`);
    }
  };

  const handleCheck = async (id: string, domain: string) => {
    setCheckingId(id);
    try {
      const updated = await api.checkMonitor(id);
      setMonitors(monitors.map(m => m.id === id ? updated : m));
      toast.success(`[${domain}] 证书探针检查完成，状态正常`);
    } catch (err: any) {
      toast.error(`探测失败: ${err.message}`);
    } finally {
      setCheckingId(null);
    }
  };

  const handleDelete = async (id: string, domain: string) => {
    const ok = await confirm({
      title: '删除域名监控探针',
      message: `确定要删除域名探针 [${domain}] 吗？删除后将停止该站点的自动健康巡检。`,
      confirmText: '确认删除',
      type: 'danger'
    });
    if (!ok) return;

    try {
      await api.deleteMonitor(id);
      setMonitors(monitors.filter(m => m.id !== id));
      toast.success(`已删除域名探针 [${domain}]`);
    } catch (err: any) {
      toast.error(`删除失败: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">全网域名 TLS 探针</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">实时探测外部线上站点 HTTPS 证书有效期、证书链完备度与健康度</p>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          <button
            onClick={fetchMonitors}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setModalOpen(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>添加监控域名</span>
          </button>
        </div>
      </div>

      {/* Monitors List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      ) : monitors.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
            <Activity className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 dark:text-slate-200">暂无域名监控探针</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            添加您在公网上线运行的任何业务域名，系统每天自动检测其证书是否即将过期或被篡改。
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>立即添加监控</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {monitors.map(m => {
            const isChecking = checkingId === m.id;
            const isHealthy = m.status === 'healthy';
            const isWarning = m.status === 'warning';
            const isExpired = m.status === 'expired';

            return (
              <div
                key={m.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className={`p-2 rounded-xl shrink-0 ${
                        isHealthy ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600' :
                        isWarning ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600' :
                        'bg-rose-50 dark:bg-rose-950/60 text-rose-600'
                      }`}>
                        <Globe className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white font-mono truncate">{m.domain}</h3>
                        <p className="text-[10px] text-slate-400">端口: {m.port}</p>
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      isHealthy ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300' :
                      isWarning ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300' :
                      'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300'
                    }`}>
                      {isHealthy ? '正常有效' : isWarning ? '即将到期' : isExpired ? '已过期' : '不可达'}
                    </span>
                  </div>

                  {m.daysLeft !== undefined && (
                    <div className="flex items-baseline justify-between text-xs pt-1">
                      <span className="text-slate-400">证书剩余有效期:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                        {m.daysLeft} 天
                      </span>
                    </div>
                  )}

                  {m.issuer && (
                    <div className="text-[11px] text-slate-400 truncate">
                      颁发者: <span className="font-medium text-slate-600 dark:text-slate-300">{m.issuer}</span>
                    </div>
                  )}

                  {m.lastCheckError && (
                    <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[10px] truncate">
                      {m.lastCheckError}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
                  <span>{m.lastCheckAt ? `更新于 ${new Date(m.lastCheckAt).toLocaleTimeString()}` : '等待初检'}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCheck(m.id, m.domain)}
                      disabled={isChecking}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="立即发起 TLS 探针检测"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleDelete(m.id, m.domain)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      title="删除探针"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">添加域名 TLS 监控探针</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">域名 (无需加 https://)</label>
                <input
                  type="text"
                  value={domainInput}
                  onChange={e => setDomainInput(e.target.value)}
                  placeholder="api.example.com"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">HTTPS 端口 (默认 443)</label>
                <input
                  type="number"
                  value={portInput}
                  onChange={e => setPortInput(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-500 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleAddMonitor}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md"
              >
                添加并立即检测
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
