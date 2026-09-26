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
  Upload, 
  Check, 
  Edit2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Clock,
  Filter,
  CheckCircle2,
  ShieldAlert
} from 'lucide-react';
import { DomainMonitor } from '../../types';
import { api } from '../../api/client';
import { useModal } from '../../contexts/ModalContext';

type StatusFilter = 'all' | 'healthy' | 'warning' | 'expired' | 'unreachable';

export const MonitorsView: React.FC = () => {
  const { confirm, toast } = useModal();
  const [monitors, setMonitors] = useState<DomainMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  // Search, Filter & View
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

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

  // Probe Matrix Modal
  const [probeMatrixModalOpen, setProbeMatrixModalOpen] = useState(false);
  const [probeDomainInput, setProbeDomainInput] = useState('');
  const [probePortInput, setProbePortInput] = useState(443);
  const [probeLoading, setProbeLoading] = useState(false);
  const [probeReport, setProbeReport] = useState<any | null>(null);

  // CT Monitor Modal
  const [ctModalOpen, setCtModalOpen] = useState(false);
  const [ctDomainInput, setCtDomainInput] = useState('');
  const [ctLoading, setCtLoading] = useState(false);
  const [ctLogs, setCtLogs] = useState<any[]>([]);

  const handleOpenProbeMatrix = async (domain: string, port = 443) => {
    setProbeDomainInput(domain);
    setProbePortInput(port);
    setProbeMatrixModalOpen(true);
    setProbeLoading(true);
    setProbeReport(null);
    try {
      const rep = await api.probeMatrix(domain, port);
      setProbeReport(rep);
    } catch (err: any) {
      toast.error(`探针矩阵探测失败: ${err.message}`);
    } finally {
      setProbeLoading(false);
    }
  };

  const handleOpenCtLogs = async (domain: string) => {
    setCtDomainInput(domain);
    setCtModalOpen(true);
    setCtLoading(true);
    setCtLogs([]);
    try {
      const res = await api.getCtLogs(domain);
      setCtLogs(res.logs || []);
    } catch (err: any) {
      toast.error(`CT 日志查询失败: ${err.message}`);
    } finally {
      setCtLoading(false);
    }
  };

  const fetchMonitors = async (showToast = false) => {
    if (showToast) setRefreshing(true);
    try {
      const data = await api.getMonitors();
      setMonitors(data);
      if (showToast) {
        toast.success('域名探针监控列表已刷新');
      }
    } catch (err) {
      console.error('Failed to load monitors:', err);
    } finally {
      setLoading(false);
      if (showToast) {
        setTimeout(() => setRefreshing(false), 500);
      }
    }
  };

  useEffect(() => {
    fetchMonitors();
  }, []);

  // Reset page to 1 on search or filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, pageSize]);

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

  // Filter and Search
  const filteredMonitors = monitors.filter(m => {
    const matchSearch = 
      m.domain.toLowerCase().includes(search.toLowerCase()) ||
      (m.remark && m.remark.toLowerCase().includes(search.toLowerCase())) ||
      (m.issuer && m.issuer.toLowerCase().includes(search.toLowerCase()));

    if (!matchSearch) return false;

    if (statusFilter === 'all') return true;
    if (statusFilter === 'healthy') return m.status === 'healthy';
    if (statusFilter === 'warning') return m.status === 'warning';
    if (statusFilter === 'expired') return m.status === 'expired' || m.status === 'unreachable';
    return true;
  });

  // Statistics Counts
  const countAll = monitors.length;
  const countHealthy = monitors.filter(m => m.status === 'healthy').length;
  const countWarning = monitors.filter(m => m.status === 'warning').length;
  const countExpiredOrError = monitors.filter(m => m.status === 'expired' || m.status === 'unreachable').length;

  // Pagination slicing
  const totalPages = Math.ceil(filteredMonitors.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedMonitors = filteredMonitors.slice(startIndex, startIndex + pageSize);

  const parsedBatchCount = parseDomainsFromText(batchTextInput, defaultBatchPort).length;

  return (
    <div className="flex-1 flex flex-col justify-between space-y-6">
      <div className="space-y-5">
        {/* Header & Main Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>全网域名 TLS 探针</span>
              <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 font-mono">
                {countAll} 目标
              </span>
            </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            全自动 7x24h 检测外部公网站点 HTTPS 证书有效期、握手延迟与证书链状态
          </p>
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
            onClick={() => fetchMonitors(true)}
            disabled={refreshing}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 shrink-0"
            title="刷新探针状态"
          >
            <RefreshCw className={`w-4 h-4 transition-transform duration-500 ${refreshing ? 'animate-spin text-emerald-500' : ''}`} />
          </button>

          <button
            onClick={() => {
              const defaultDomain = monitors[0]?.domain || 'example.com';
              handleOpenProbeMatrix(defaultDomain, monitors[0]?.port || 443);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60 text-xs font-bold transition-all active:scale-95 shrink-0"
            title="多地域探针矩阵"
          >
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">探针矩阵</span>
          </button>

          <button
            onClick={() => {
              const defaultDomain = monitors[0]?.domain || 'example.com';
              handleOpenCtLogs(defaultDomain);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60 text-xs font-bold transition-all active:scale-95 shrink-0"
            title="CT 证书透明度日志监控"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
            <span className="hidden sm:inline">CT 日志</span>
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
          <button
            onClick={() => setStatusFilter('expired')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
              statusFilter === 'expired'
                ? 'bg-rose-600 text-white font-bold shadow-sm'
                : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            <span>已过期/不可达 ({countExpiredOrError})</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="检索域名、业务备注或机构..."
            className="w-full pl-9 pr-3.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Content View (Grid or Table) */}
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
            {search || statusFilter !== 'all' ? '未找到符合筛选条件的域名探针' : '暂无域名监控探针'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {search || statusFilter !== 'all' ? '请尝试清除搜索关键词或重置状态过滤项' : '支持单条添加、多行批量粘贴或直接上传 TXT 域名清单。'}
          </p>
          {!search && statusFilter === 'all' && (
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>立即添加探针</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* ================= 1. Modern Compact Card Grid (3-4 per row) ================= */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedMonitors.map(m => {
            const isChecking = checkingId === m.id;
            const isHealthy = m.status === 'healthy';
            const isWarning = m.status === 'warning';
            const isExpired = m.status === 'expired';
            const days = m.daysLeft ?? 0;
            const progressPercent = Math.min(Math.max((days / 90) * 100, 4), 100);

            return (
              <div
                key={m.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-500/50 dark:hover:border-emerald-500/40 rounded-3xl p-4 sm:p-4.5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group relative overflow-hidden flex flex-col justify-between"
              >
                {/* Top Status Gradient Bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${
                  isHealthy ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                  isWarning ? 'bg-gradient-to-r from-amber-500 to-orange-400' :
                  'bg-gradient-to-r from-rose-500 to-pink-500'
                }`}></div>

                <div className="space-y-3 pt-1">
                  {/* Card Header: Globe + Domain + Status Tag */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className={`w-9 h-9 rounded-2xl shrink-0 flex items-center justify-center relative mt-0.5 shadow-sm ${
                        isHealthy ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400' :
                        isWarning ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400' :
                        'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                      }`}>
                        <Globe className="w-4 h-4" />
                        <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                          isHealthy ? 'bg-emerald-500' : isWarning ? 'bg-amber-500' : 'bg-rose-500'
                        }`}></span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 group/link">
                          <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white font-mono truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" title={m.domain}>
                            {m.domain}
                          </h3>
                          <a
                            href={`https://${m.domain}${m.port !== 443 ? `:${m.port}` : ''}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-400 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            title="打开 HTTPS 站点"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 flex-wrap">
                          <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-slate-500 dark:text-slate-400">
                            端口:{m.port}
                          </span>
                          {m.remark && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-medium truncate max-w-[110px]" title={m.remark}>
                              <Tag className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                              <span className="truncate">{m.remark}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${
                      isHealthy ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50' :
                      isWarning ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800/50' :
                      'bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border-rose-200 dark:border-rose-800/50'
                    }`}>
                      {isHealthy ? '正常有效' : isWarning ? '即将到期' : isExpired ? '已过期' : '不可达'}
                    </span>
                  </div>

                  {/* Validity Countdown Pill & Visual Mini Progress Bar */}
                  {m.daysLeft !== undefined && (
                    <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 text-[11px]">证书剩余有效期</span>
                        <span className={`font-bold font-mono text-sm ${
                          m.daysLeft <= 7 ? 'text-rose-500' : m.daysLeft <= 30 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {m.daysLeft} 天
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            m.daysLeft <= 7 ? 'bg-gradient-to-r from-rose-500 to-rose-600' :
                            m.daysLeft <= 30 ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                            'bg-gradient-to-r from-emerald-500 to-teal-500'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Issuer info */}
                  {m.issuer && (
                    <div className="text-[11px] text-slate-400 truncate flex items-center justify-between pt-0.5">
                      <span>颁发机构:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[140px]" title={m.issuer}>
                        {m.issuer}
                      </span>
                    </div>
                  )}

                  {/* OCSP Stapling Status */}
                  <div className="text-[11px] text-slate-400 truncate flex items-center justify-between pt-0.5">
                    <span>OCSP 装订:</span>
                    {m.ocspStatus === 'good' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" />
                        <span>正常装订</span>
                      </span>
                    ) : m.ocspStatus === 'revoked' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded animate-pulse">
                        <AlertTriangle className="w-3 h-3 text-rose-500" />
                        <span>已吊销!</span>
                      </span>
                    ) : m.ocspStatus === 'no_stapling' ? (
                      <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        未装订
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">未知</span>
                    )}
                  </div>

                  {/* Error if any */}
                  {m.lastCheckError && (
                    <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[10px] truncate" title={m.lastCheckError}>
                      {m.lastCheckError}
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
                  <span className="font-mono">{m.lastCheckAt ? new Date(m.lastCheckAt).toLocaleTimeString() : '等待初检'}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenProbeMatrix(m.domain, m.port)}
                      className="p-1.5 rounded-lg text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                      title="多地域探针矩阵"
                    >
                      <Globe className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleOpenCtLogs(m.domain)}
                      className="p-1.5 rounded-lg text-purple-500 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors"
                      title="CT 证书透明度日志监控"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setEditRemarkMonitor(m);
                        setEditRemarkValue(m.remark || '');
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="修改业务备注"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleCheck(m.id, m.domain)}
                      disabled={isChecking}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="立即发起 TLS 探针检测"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-emerald-500' : ''}`} />
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
      ) : (
        /* ================= 2. Compact Table View ================= */
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-300 font-bold">
                <tr>
                  <th className="py-3 px-4">监控域名</th>
                  <th className="py-3 px-4">端口</th>
                  <th className="py-3 px-4">业务备注</th>
                  <th className="py-3 px-4">健康状态</th>
                  <th className="py-3 px-4">OCSP 装订</th>
                  <th className="py-3 px-4">剩余有效天数</th>
                  <th className="py-3 px-4">颁发 CA 机构</th>
                  <th className="py-3 px-4">上次巡检</th>
                  <th className="py-3 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedMonitors.map(m => {
                  const isChecking = checkingId === m.id;
                  const isHealthy = m.status === 'healthy';
                  const isWarning = m.status === 'warning';
                  const isExpired = m.status === 'expired';

                  return (
                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white font-mono">{m.domain}</span>
                          <a
                            href={`https://${m.domain}${m.port !== 443 ? `:${m.port}` : ''}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-400 hover:text-emerald-600"
                            title="打开 HTTPS 站点"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono">{m.port}</td>

                      <td className="py-3 px-4">
                        {m.remark ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px]">
                            <Tag className="w-3 h-3 text-emerald-500" />
                            <span>{m.remark}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isHealthy ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300' :
                          isWarning ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300' :
                          'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300'
                        }`}>
                          {isHealthy ? '正常有效' : isWarning ? '即将到期' : isExpired ? '已过期' : '不可达'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {m.ocspStatus === 'good' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                            <ShieldCheck className="w-3 h-3 text-emerald-500" />
                            <span>已装订</span>
                          </span>
                        ) : m.ocspStatus === 'revoked' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded animate-pulse">
                            <AlertTriangle className="w-3 h-3 text-rose-500" />
                            <span>已吊销!</span>
                          </span>
                        ) : m.ocspStatus === 'no_stapling' ? (
                          <span className="text-[10px] text-slate-400">未装订</span>
                        ) : (
                          <span className="text-[10px] text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {m.daysLeft !== undefined ? (
                          <span className={`font-bold font-mono ${
                            m.daysLeft <= 7 ? 'text-rose-500' : m.daysLeft <= 30 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {m.daysLeft} 天
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 truncate max-w-[160px]" title={m.issuer}>
                        {m.issuer || '-'}
                      </td>

                      <td className="py-3 px-4 text-[11px] text-slate-400">
                        {m.lastCheckAt ? new Date(m.lastCheckAt).toLocaleTimeString() : '等待初检'}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenProbeMatrix(m.domain, m.port)}
                            className="p-1.5 rounded-lg text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                            title="多地域探针矩阵"
                          >
                            <Globe className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenCtLogs(m.domain)}
                            className="p-1.5 rounded-lg text-purple-500 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors"
                            title="CT 证书透明度日志监控"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </button>
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
                            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-emerald-500' : ''}`} />
                          </button>
                          <button
                            onClick={() => handleDelete(m.id, m.domain)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                            title="删除探针"
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
      {filteredMonitors.length > 0 && (
        <div className="mt-auto pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm text-xs text-slate-500 dark:text-slate-400">
            <div>
              显示第 {filteredMonitors.length === 0 ? 0 : `${startIndex + 1}-${Math.min(startIndex + pageSize, filteredMonitors.length)}`} 项，共 {filteredMonitors.length} 项
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
      {/* Probe Matrix Modal */}
      {probeMatrixModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl p-6 space-y-5 shadow-2xl animate-scaleUp max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    多地域 TLS 探针矩阵巡检
                  </h3>
                  <p className="text-xs text-slate-400">
                    从华北、华东、华南、香港与欧美 5 大分布式边缘节点并发握手探测，校验指纹一致性与网络延迟
                  </p>
                </div>
              </div>
              <button onClick={() => setProbeMatrixModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target input row */}
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={probeDomainInput}
                  onChange={e => setProbeDomainInput(e.target.value)}
                  placeholder="请输入需要巡检的域名 (如 example.com)"
                  className="w-full pl-3 pr-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                />
              </div>
              <input
                type="number"
                value={probePortInput}
                onChange={e => setProbePortInput(Number(e.target.value))}
                className="w-20 px-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono text-center"
                placeholder="443"
              />
              <button
                type="button"
                onClick={() => handleOpenProbeMatrix(probeDomainInput, probePortInput)}
                disabled={probeLoading || !probeDomainInput.trim()}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${probeLoading ? 'animate-spin' : ''}`} />
                <span>{probeLoading ? '矩阵探测中...' : '并发探测'}</span>
              </button>
            </div>

            {/* Results Area */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {probeLoading ? (
                <div className="py-16 text-center space-y-3">
                  <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="text-xs text-slate-400">正在并发调度 5 个边缘节点向目标发起真实 TLS 握手...</p>
                </div>
              ) : probeReport ? (
                <div className="space-y-4">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                      <div className="text-[11px] text-slate-400">综合网络健康度</div>
                      <div className="flex items-center gap-2">
                        <span className={`text-base font-bold font-mono ${
                          probeReport.overallStatus === 'healthy' ? 'text-emerald-600 dark:text-emerald-400' :
                          probeReport.overallStatus === 'warning' ? 'text-amber-500' : 'text-rose-500'
                        }`}>
                          {probeReport.overallStatus === 'healthy' ? '全节点正常' :
                           probeReport.overallStatus === 'warning' ? '部分节点告警' : '节点不可达'}
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                      <div className="text-[11px] text-slate-400">全网平均 TLS 握手延迟</div>
                      <div className="text-base font-bold font-mono text-blue-600 dark:text-blue-400">
                        {probeReport.avgLatencyMs} <span className="text-xs font-normal text-slate-400">ms</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                      <div className="text-[11px] text-slate-400">证书指纹跨域一致性</div>
                      <div className="flex items-center gap-1.5">
                        {!probeReport.consistencyMismatch ? (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>100% 一致 (无篡改)</span>
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>发现指纹差异 (警惕劫持)</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {probeReport.mismatchDetails && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-700 dark:text-amber-300">
                      ⚠️ 提示: {probeReport.mismatchDetails}
                    </div>
                  )}

                  {/* Regional Node Results Table */}
                  <div className="border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-300 font-bold">
                        <tr>
                          <th className="py-2.5 px-3">探针节点</th>
                          <th className="py-2.5 px-3">地域</th>
                          <th className="py-2.5 px-3">状态</th>
                          <th className="py-2.5 px-3">解析 IP</th>
                          <th className="py-2.5 px-3">延迟</th>
                          <th className="py-2.5 px-3">协议 & 套件</th>
                          <th className="py-2.5 px-3 font-mono">证书 SHA-256 指纹</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {probeReport.regionalResults?.map((node: any) => (
                          <tr key={node.nodeId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                              {node.nodeName}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px]">
                                {node.region}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                node.status === 'healthy' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300' :
                                node.status === 'warning' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300' :
                                'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300'
                              }`}>
                                {node.status === 'healthy' ? '正常' : node.status === 'warning' ? '告警' : '失败'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px]">
                              {node.resolvedIp || '-'}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                              {node.latencyMs} ms
                            </td>
                            <td className="py-2.5 px-3 text-[11px]">
                              <div>{node.tlsVersion || '-'}</div>
                              <div className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]" title={node.cipherSuite}>
                                {node.cipherSuite || '-'}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500" title={node.fingerprintSha256}>
                              {node.fingerprintSha256 ? `${node.fingerprintSha256.substring(0, 16)}...` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-xs text-slate-400">
                  请输入域名并点击“并发探测”发起多节点测试
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setProbeMatrixModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CT Logs & Anti-Hijack Modal */}
      {ctModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl p-6 space-y-5 shadow-2xl animate-scaleUp max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Certificate Transparency (CT) 证书透明度审计
                  </h3>
                  <p className="text-xs text-slate-400">
                    检索公开 crt.sh 归档记录并核验本地已知证书库，主动防范未授权颁发或伪造劫持
                  </p>
                </div>
              </div>
              <button onClick={() => setCtModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target input row */}
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={ctDomainInput}
                  onChange={e => setCtDomainInput(e.target.value)}
                  placeholder="请输入需要查询 CT 归档的域名 (如 example.com)"
                  className="w-full pl-3 pr-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                />
              </div>
              <button
                type="button"
                onClick={() => handleOpenCtLogs(ctDomainInput)}
                disabled={ctLoading || !ctDomainInput.trim()}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{ctLoading ? '查询中...' : '检索 CT 日志'}</span>
              </button>
            </div>

            {/* Results Area */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {ctLoading ? (
                <div className="py-16 text-center space-y-3">
                  <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-purple-500 mx-auto"></div>
                  <p className="text-xs text-slate-400">正在向全球 CT 归档节点检索该域名的公信证书记录...</p>
                </div>
              ) : ctLogs.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div>
                      检索到 <span className="font-bold text-slate-900 dark:text-white font-mono">{ctLogs.length}</span> 条公信 CT 归档记录
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        本地已知: {ctLogs.filter(e => e.isKnownBySslMate).length}
                      </span>
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        外部签发: {ctLogs.filter(e => !e.isKnownBySslMate).length}
                      </span>
                    </div>
                  </div>

                  <div className="border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-300 font-bold">
                        <tr>
                          <th className="py-2.5 px-3">CT 记录 ID</th>
                          <th className="py-2.5 px-3">证书域名 (CN / SANs)</th>
                          <th className="py-2.5 px-3">签发 CA 机构</th>
                          <th className="py-2.5 px-3">有效期区间</th>
                          <th className="py-2.5 px-3">SSL-Mate 鉴别</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {ctLogs.slice(0, 50).map((entry: any) => (
                          <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-2.5 px-3 font-mono text-[11px]">
                              <a
                                href={`https://crt.sh/?id=${entry.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                              >
                                <span>{entry.id}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                                {entry.common_name}
                              </div>
                              {entry.name_value && entry.name_value !== entry.common_name && (
                                <div className="text-[10px] text-slate-400 truncate max-w-[200px]" title={entry.name_value}>
                                  {entry.name_value}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] truncate max-w-[160px]" title={entry.issuer_name}>
                              {entry.issuer_name || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-[10px] font-mono text-slate-500 whitespace-nowrap">
                              <div>{entry.not_before ? new Date(entry.not_before).toLocaleDateString() : '-'}</div>
                              <div>~ {entry.not_after ? new Date(entry.not_after).toLocaleDateString() : '-'}</div>
                            </td>
                            <td className="py-2.5 px-3">
                              {entry.isKnownBySslMate ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>本地已知</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300" title="非当前 SSL-Mate 系统记录的序列号，请核验是否为您其他团队或渠道签发">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>外部签发</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-xs text-slate-400">
                  暂无 CT 记录显示，请输入域名查询。
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCtModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
