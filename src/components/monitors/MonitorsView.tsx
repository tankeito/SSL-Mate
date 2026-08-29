import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Plus, 
  Trash2, 
  RefreshCw, 
  ShieldCheck, 
  AlertTriangle, 
  XCircle, 
  Globe, 
  X, 
  Search, 
  Tag, 
  FileText, 
  Upload, 
  Layers, 
  Check, 
  Edit2
} from 'lucide-react';
import { DomainMonitor } from '../../types';
import { api } from '../../api/client';
import { useModal } from '../../contexts/ModalContext';

export const MonitorsView: React.FC = () => {
  const { confirm, toast } = useModal();
  const [monitors, setMonitors] = useState<DomainMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [checkingId, setCheckingId] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'single' | 'batch_text' | 'file_upload'>('single');
  
  // Single Add form
  const [domainInput, setDomainInput] = useState('');
  const [portInput, setPortInput] = useState(443);
  const [remarkInput, setRemarkInput] = useState('');

  // Batch Text form
  const [batchTextInput, setBatchTextInput] = useState('');
  const [defaultBatchPort, setDefaultBatchPort] = useState(443);

  // File Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit Remark Modal
  const [editRemarkMonitor, setEditRemarkMonitor] = useState<DomainMonitor | null>(null);
  const [editRemarkValue, setEditRemarkValue] = useState('');

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

  const openAddModal = () => {
    setModalTab('single');
    setDomainInput('');
    setPortInput(443);
    setRemarkInput('');
    setBatchTextInput('');
    setFileName(null);
    setModalOpen(true);
  };

  // Parse text into domain items
  const parseDomainsFromText = (rawText: string, defaultPort = 443): Array<{ domain: string; port: number; remark?: string }> => {
    const lines = rawText.split(/[\r\n]+/);
    const results: Array<{ domain: string; port: number; remark?: string }> = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

      // Match comma or whitespace separator e.g. "api.example.com:8443,支付网关" or "api.example.com 生产API"
      const parts = trimmed.split(/[\s,，|\t]+/);
      let rawDomainPart = parts[0] ? parts[0].replace(/^https?:\/\//, '').split('/')[0] : '';
      let remark = parts.slice(1).join(' ').trim() || undefined;

      let port = defaultPort;
      if (rawDomainPart.includes(':')) {
        const domainParts = rawDomainPart.split(':');
        rawDomainPart = domainParts[0];
        const parsedPort = parseInt(domainParts[1], 10);
        if (!isNaN(parsedPort)) {
          port = parsedPort;
        }
      }

      if (rawDomainPart && rawDomainPart.includes('.')) {
        results.push({ domain: rawDomainPart, port, remark });
      }
    }

    return results;
  };

  // Single Add
  const handleAddSingle = async () => {
    if (!domainInput.trim()) {
      toast.warning('请输入待监控的有效域名');
      return;
    }
    setSubmitting(true);
    try {
      await api.createMonitor({ 
        domain: domainInput.trim(), 
        port: portInput,
        remark: remarkInput.trim() || undefined
      });
      setDomainInput('');
      setRemarkInput('');
      setModalOpen(false);
      toast.success(`成功添加并探测监控域名: ${domainInput.trim()}`);
      fetchMonitors();
    } catch (err: any) {
      toast.error(`添加探针失败: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Batch Text Add
  const handleAddBatch = async () => {
    const parsed = parseDomainsFromText(batchTextInput, defaultBatchPort);
    if (parsed.length === 0) {
      toast.warning('未识别到有效的公网域名，请检查输入格式');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createBatchMonitors(parsed);
      setModalOpen(false);
      toast.success(`成功批量导入并立即检测 ${res.totalAdded} 个域名探针！${res.duplicatesSkipped > 0 ? `(跳过 ${res.duplicatesSkipped} 个已存在)` : ''}`);
      fetchMonitors();
    } catch (err: any) {
      toast.error(`批量导入失败: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle File Upload (.txt / .csv)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setBatchTextInput(content);
        setModalTab('batch_text');
        toast.info(`已成功读取文件 [${file.name}]，请确认导入列表`);
      }
    };
    reader.readAsText(file);
  };

  // Re-check single monitor
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

  // Delete monitor
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

  // Edit Remark
  const handleSaveRemark = async () => {
    if (!editRemarkMonitor) return;
    try {
      await api.updateMonitor(editRemarkMonitor.id, { remark: editRemarkValue.trim() });
      setMonitors(monitors.map(m => m.id === editRemarkMonitor.id ? { ...m, remark: editRemarkValue.trim() || undefined } : m));
      toast.success(`已更新 [${editRemarkMonitor.domain}] 备注`);
      setEditRemarkMonitor(null);
    } catch (err: any) {
      toast.error(`保存失败: ${err.message}`);
    }
  };

  const parsedBatchCount = parseDomainsFromText(batchTextInput, defaultBatchPort).length;

  const filteredMonitors = monitors.filter(m => 
    m.domain.toLowerCase().includes(search.toLowerCase()) ||
    (m.remark && m.remark.toLowerCase().includes(search.toLowerCase())) ||
    (m.issuer && m.issuer.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">全网域名 TLS 探针</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">实时探测外部线上站点 HTTPS 证书有效期、证书链完备度，支持批量导入与业务备注管理</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索域名、备注或颁发者..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchMonitors}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
              title="刷新列表"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={openAddModal}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all active:scale-95 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>添加 / 批量导入探针</span>
            </button>
          </div>
        </div>
      </div>

      {/* Monitors List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      ) : filteredMonitors.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
            <Activity className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 dark:text-slate-200">
            {search ? '未找到匹配的域名探针' : '暂无域名监控探针'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {search ? '请尝试修改搜索关键词' : '支持单条添加、多行粘贴批量导入或上传 TXT 域名列表，系统每日自动检测证书健康度与到期预警。'}
          </p>
          {!search && (
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>立即添加监控探针</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMonitors.map(m => {
            const isChecking = checkingId === m.id;
            const isHealthy = m.status === 'healthy';
            const isWarning = m.status === 'warning';
            const isExpired = m.status === 'expired';

            return (
              <div
                key={m.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 flex flex-col justify-between hover:border-emerald-500/40 transition-colors"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                        isHealthy ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600' :
                        isWarning ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600' :
                        'bg-rose-50 dark:bg-rose-950/60 text-rose-600'
                      }`}>
                        <Globe className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white font-mono truncate" title={m.domain}>
                          {m.domain}
                        </h3>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                          <span>端口: {m.port}</span>
                          {m.remark && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-normal truncate max-w-[120px]" title={m.remark}>
                              <Tag className="w-2.5 h-2.5 text-emerald-500" />
                              <span className="truncate">{m.remark}</span>
                            </span>
                          )}
                        </div>
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
                    <div className="flex items-baseline justify-between text-xs pt-1 border-t border-slate-50 dark:border-slate-800/60">
                      <span className="text-slate-400">证书剩余有效期:</span>
                      <span className={`font-bold font-mono text-sm ${
                        m.daysLeft <= 7 ? 'text-rose-500' : m.daysLeft <= 20 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {m.daysLeft} 天
                      </span>
                    </div>
                  )}

                  {m.issuer && (
                    <div className="text-[11px] text-slate-400 truncate">
                      颁发机构: <span className="font-medium text-slate-600 dark:text-slate-300">{m.issuer}</span>
                    </div>
                  )}

                  {m.lastCheckError && (
                    <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[10px] truncate" title={m.lastCheckError}>
                      {m.lastCheckError}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
                  <span>{m.lastCheckAt ? `更新于 ${new Date(m.lastCheckAt).toLocaleTimeString()}` : '等待初检'}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditRemarkMonitor(m);
                        setEditRemarkValue(m.remark || '');
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="修改备注"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
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

      {/* Add / Batch Import Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">添加域名 TLS 监控探针</h3>
                <p className="text-[11px] text-slate-400">支持单条添加、多行文本批量追加及 TXT 文件导入</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl gap-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setModalTab('single')}
                className={`flex-1 py-2 rounded-xl transition-all ${
                  modalTab === 'single'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                单条添加
              </button>
              <button
                type="button"
                onClick={() => setModalTab('batch_text')}
                className={`flex-1 py-2 rounded-xl transition-all ${
                  modalTab === 'batch_text'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                批量输入
              </button>
              <button
                type="button"
                onClick={() => setModalTab('file_upload')}
                className={`flex-1 py-2 rounded-xl transition-all ${
                  modalTab === 'file_upload'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                TXT 文件导入
              </button>
            </div>

            {/* Tab 1: Single Domain */}
            {modalTab === 'single' && (
              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">域名 (无需前缀 https://)</label>
                  <input
                    type="text"
                    value={domainInput}
                    onChange={e => setDomainInput(e.target.value)}
                    placeholder="例如: api.example.com"
                    autoFocus
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">HTTPS 端口 (默认 443)</label>
                    <input
                      type="number"
                      value={portInput}
                      onChange={e => setPortInput(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">业务备注 (可选)</label>
                    <input
                      type="text"
                      value={remarkInput}
                      onChange={e => setRemarkInput(e.target.value)}
                      placeholder="例如: 生产支付网关"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-medium"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="w-1/3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleAddSingle}
                    disabled={submitting}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
                  >
                    {submitting ? '检测中...' : '添加并立即检测'}
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: Batch Text Input */}
            {modalTab === 'batch_text' && (
              <div className="space-y-3.5 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300">批量域名列表 (一行一个)</label>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                      已识别 {parsedBatchCount} 个目标
                    </span>
                  </div>
                  <textarea
                    rows={6}
                    value={batchTextInput}
                    onChange={e => setBatchTextInput(e.target.value)}
                    placeholder={`支持格式示例:\napi.example.com\nauth.example.com:8443\npay.example.com 生产支付通道\ncdn.example.com:443,静态资源库`}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono text-xs leading-relaxed"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    提示：支持域名后跟端口（如 <code>:8443</code>）或空格/逗号分隔备注信息。
                  </p>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">未指定端口时的默认端口:</span>
                  <input
                    type="number"
                    value={defaultBatchPort}
                    onChange={e => setDefaultBatchPort(Number(e.target.value))}
                    className="w-20 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-center"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="w-1/3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleAddBatch}
                    disabled={submitting || parsedBatchCount === 0}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
                  >
                    {submitting ? '批量导入检测中...' : `批量导入并检测 (${parsedBatchCount})`}
                  </button>
                </div>
              </div>
            )}

            {/* Tab 3: TXT / CSV File Upload */}
            {modalTab === 'file_upload' && (
              <div className="space-y-4 text-xs">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".txt,.csv"
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-3xl p-8 text-center cursor-pointer transition-colors space-y-3 bg-slate-50/50 dark:bg-slate-800/30"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                      {fileName ? `已选择文件: ${fileName}` : '点击或拖拽上传 TXT / CSV 文件'}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1">
                      文本文件内每行一个域名，支持包含端口与备注
                    </p>
                  </div>
                  <button
                    type="button"
                    className="px-4 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-bold"
                  >
                    选择文件
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Remark Modal */}
      {editRemarkMonitor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">修改探针备注</h3>
              <button onClick={() => setEditRemarkMonitor(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">监控域名</label>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-200 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  {editRemarkMonitor.domain}:{editRemarkMonitor.port}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">业务备注名称</label>
                <input
                  type="text"
                  value={editRemarkValue}
                  onChange={e => setEditRemarkValue(e.target.value)}
                  placeholder="例如: 生产支付回调网关"
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-medium"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditRemarkMonitor(null)}
                  className="w-1/3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveRemark}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md transition-all active:scale-95"
                >
                  保存备注
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
