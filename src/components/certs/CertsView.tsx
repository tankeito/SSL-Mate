import React, { useState, useEffect, useRef } from 'react';
import { 
  Award, 
  Trash2, 
  Download, 
  FileSearch, 
  RefreshCw, 
  ShieldCheck, 
  ExternalLink, 
  Copy, 
  Check, 
  X, 
  Search,
  Eye,
  KeyRound,
  FileCode,
  Lock,
  ChevronLeft,
  ChevronRight,
  Upload,
  ClipboardPaste,
  RotateCcw,
  LayoutGrid,
  List,
  Globe,
  Tag
} from 'lucide-react';
import { Certificate } from '../../types';
import { api } from '../../api/client';
import { useModal } from '../../contexts/ModalContext';

type CertStatusFilter = 'all' | 'healthy' | 'warning' | 'expired';

export const CertsView: React.FC = () => {
  const { confirm, toast } = useModal();
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CertStatusFilter>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [refreshing, setRefreshing] = useState(false);

  // Pagination (12 items per page = 4 cols x 3 rows)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  // Selected Cert for detail / download
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  const [downloadModalCert, setDownloadModalCert] = useState<Certificate | null>(null);
  const [pfxPassword, setPfxPassword] = useState('');
  
  // Inspect Modal
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [inspectPemInput, setInspectPemInput] = useState('');
  const [inspectResult, setInspectResult] = useState<any>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const inspectFileInputRef = useRef<HTMLInputElement>(null);

  // Copied state
  const [copied, setCopied] = useState<string | null>(null);

  const fetchCerts = async (showToast = false) => {
    if (showToast) setRefreshing(true);
    try {
      const data = await api.getCerts();
      setCerts(data);
      if (showToast) {
        toast.success('证书资产台账已刷新');
      }
    } catch (err) {
      console.error('Failed to load certs:', err);
    } finally {
      setLoading(false);
      if (showToast) {
        setTimeout(() => setRefreshing(false), 500);
      }
    }
  };

  useEffect(() => {
    fetchCerts();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, pageSize]);

  const handleDeleteCert = async (id: string, domain: string) => {
    const ok = await confirm({
      title: '删除证书归档资产',
      message: `确定要删除证书记录 [${domain}] 吗？删除后本地将不再留存此私钥与物理证书文件。`,
      confirmText: '确认删除',
      type: 'danger'
    });
    if (!ok) return;

    try {
      await api.deleteCert(id);
      setCerts(certs.filter(c => c.id !== id));
      toast.success(`已删除证书归档 [${domain}]`);
    } catch (err: any) {
      toast.error(`删除失败: ${err.message}`);
    }
  };

  const handleDownloadFormat = async (certId: string, format: string) => {
    try {
      let url = `/api/certs/${certId}/download?format=${format}`;
      if (format === 'pfx' && pfxPassword) {
        url += `&pfxPassword=${encodeURIComponent(pfxPassword)}`;
      }
      
      const token = localStorage.getItem('sslmate_token') || localStorage.getItem('token');
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || '下载失败');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const filename = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || `certificate.${format}`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success(`已开始下载 ${filename}`);
    } catch (err: any) {
      toast.error(`下载失败: ${err.message}`);
    }
  };

  const handleInspectSubmit = async () => {
    if (!inspectPemInput.trim()) {
      toast.warning('请输入或粘贴证书 PEM 文本');
      return;
    }
    setInspectLoading(true);
    setInspectError(null);
    setInspectResult(null);

    try {
      const res = await api.inspectCert(inspectPemInput.trim());
      setInspectResult(res);
      toast.success('X.509 证书深度解析成功');
    } catch (err: any) {
      setInspectError(err.message || '解析失败，请确保提供的是有效的 X.509 PEM 证书');
      toast.error(`解析失败: ${err.message}`);
    } finally {
      setInspectLoading(false);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInspectPemInput(text);
        toast.info('已粘贴剪贴板内容');
      }
    } catch (err) {
      toast.warning('无法自动读取剪贴板，请手动按 Ctrl+V 粘贴');
    }
  };

  const handleInspectFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setInspectPemInput(content);
        toast.info(`已成功载入文件: ${file.name}`);
      }
    };
    reader.readAsText(file);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success('已复制到剪贴板');
    setTimeout(() => setCopied(null), 2000);
  };

  // Filter & Search Logic
  const filteredCerts = certs.filter(c => {
    const days = c.daysLeft ?? 90;
    const isExpiring = days <= 30;
    const isExpired = days <= 0 || Boolean(c.isExpired);

    const matchSearch = 
      c.primaryDomain.toLowerCase().includes(search.toLowerCase()) ||
      (c.issuer && c.issuer.toLowerCase().includes(search.toLowerCase())) ||
      (c.sanDomains && c.sanDomains.some((d: string) => d.toLowerCase().includes(search.toLowerCase())));

    if (!matchSearch) return false;

    if (statusFilter === 'all') return true;
    if (statusFilter === 'healthy') return !isExpired && days > 30;
    if (statusFilter === 'warning') return !isExpired && isExpiring && days > 0;
    if (statusFilter === 'expired') return isExpired;

    return true;
  });

  // Statistics
  const countAll = certs.length;
  const countHealthy = certs.filter(c => !c.isExpired && (c.daysLeft ?? 90) > 30).length;
  const countWarning = certs.filter(c => {
    const d = c.daysLeft ?? 90;
    return !c.isExpired && d > 0 && d <= 30;
  }).length;
  const countExpired = certs.filter(c => c.isExpired || (c.daysLeft ?? 90) <= 0).length;

  // Pagination
  const totalPages = Math.ceil(filteredCerts.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedCerts = filteredCerts.slice(startIndex, startIndex + pageSize);

  return (
    <div className="flex-1 flex flex-col justify-between space-y-6">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>证书资产台账</span>
              <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 font-mono">
                {certs.length} 证书
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">所有自动化签发及归档的物理 SSL 证书仓库，支持全格式导出与在线解析体检</p>
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
              onClick={() => setInspectModalOpen(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <FileSearch className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>证书在线体检</span>
            </button>

            <button
              onClick={() => fetchCerts(true)}
              disabled={refreshing}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 shrink-0"
              title="刷新列表"
            >
              <RefreshCw className={`w-4 h-4 transition-transform duration-500 ${refreshing ? 'animate-spin text-emerald-500' : ''}`} />
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
            {countExpired > 0 && (
              <button
                onClick={() => setStatusFilter('expired')}
                className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                  statusFilter === 'expired'
                    ? 'bg-rose-600 text-white font-bold shadow-sm'
                    : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                <span>已过期 ({countExpired})</span>
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
              placeholder="搜索域名或签发机构..."
              className="w-full pl-9 pr-3.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Certificates Content: Grid or Table */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : filteredCerts.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200">
              {search || statusFilter !== 'all' ? '未找到符合条件的证书资产' : '暂无证书资产'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {search || statusFilter !== 'all' 
                ? '请尝试更换搜索关键词或重置状态过滤项' 
                : '当自动化任务执行成功后，签发出来的全套证书与私钥将自动入库并在此归档。'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* ================= 1. Modern 4-Column Certificate Card Grid ================= */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedCerts.map(cert => {
              const days = cert.daysLeft ?? 90;
              const isExpiring = days <= 30;
              const isExpired = days <= 0 || Boolean(cert.isExpired);
              const progressPercent = Math.min(Math.max((days / 90) * 100, 4), 100);
              const hasSAN = cert.sanDomains && cert.sanDomains.length > 1;

              return (
                <div
                  key={cert.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-500/50 dark:hover:border-emerald-500/40 rounded-3xl p-4 sm:p-4.5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group relative overflow-hidden flex flex-col justify-between"
                >
                  {/* Top Status Gradient Bar */}
                  <div className={`absolute top-0 left-0 right-0 h-1 ${
                    isExpired ? 'bg-gradient-to-r from-rose-500 to-pink-500' :
                    isExpiring ? 'bg-gradient-to-r from-amber-500 to-orange-400' :
                    'bg-gradient-to-r from-emerald-500 to-teal-400'
                  }`}></div>

                  <div className="space-y-3 pt-1">
                    {/* Card Header: ShieldCheck + Primary Domain + Status Tag */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className={`w-9 h-9 rounded-2xl shrink-0 flex items-center justify-center relative mt-0.5 shadow-sm ${
                          isExpired ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400' :
                          isExpiring ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400' :
                          'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                        }`}>
                          <ShieldCheck className="w-4 h-4" />
                          <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                            isExpired ? 'bg-rose-500' : isExpiring ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}></span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white font-mono truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" title={cert.primaryDomain}>
                            {cert.primaryDomain}
                          </h3>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 flex-wrap">
                            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-slate-500 dark:text-slate-400">
                              {cert.keyType?.toUpperCase() || 'ECC'}
                            </span>
                            {hasSAN && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                                +{cert.sanDomains.length - 1} 备用域名
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status Pill */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${
                        isExpired ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border-rose-200 dark:border-rose-800/50' :
                        isExpiring ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800/50' :
                        'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
                      }`}>
                        {isExpired ? '已过期' : `剩余 ${days} 天`}
                      </span>
                    </div>

                    {/* Validity Countdown Pill & Visual Mini Progress Bar */}
                    <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 text-[11px]">证书剩余有效期</span>
                        <span className={`font-bold font-mono text-sm ${
                          isExpired ? 'text-rose-500' : isExpiring ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {isExpired ? '已过期' : `${days} 天`}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            isExpired ? 'bg-rose-500' :
                            isExpiring ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                            'bg-gradient-to-r from-emerald-500 to-teal-500'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                        <span>到期时间</span>
                        <span className="font-mono">{new Date(cert.expiresAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Issuer and Serial info */}
                    <div className="space-y-1 text-[11px] text-slate-400">
                      <div className="flex items-center justify-between">
                        <span>签发机构:</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[130px]" title={cert.issuer}>
                          {cert.issuer || 'Let\'s Encrypt'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span>序列号:</span>
                        <span className="font-mono text-slate-500 dark:text-slate-400 truncate max-w-[130px]" title={cert.serialNumber}>
                          {cert.serialNumber ? `SN: ${cert.serialNumber.slice(0, 12)}...` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <button
                      onClick={() => setDownloadModalCert(cert)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-xs font-semibold transition-colors"
                      title="一键导出多格式证书"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>导出证书</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={async () => {
                          const full = await api.getCert(cert.id);
                          setSelectedCert(full);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="查看完整 PEM 内容"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCert(cert.id, cert.primaryDomain)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        title="删除证书归档"
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
                    <th className="py-3 px-4">主域名 & SAN</th>
                    <th className="py-3 px-4">签发 CA 机构</th>
                    <th className="py-3 px-4">有效期剩余</th>
                    <th className="py-3 px-4">到期时间</th>
                    <th className="py-3 px-4">算法 / 序列号</th>
                    <th className="py-3 px-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedCerts.map(cert => {
                    const days = cert.daysLeft ?? 90;
                    const isExpiring = days <= 30;

                    return (
                      <tr key={cert.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span>{cert.primaryDomain}</span>
                          </div>
                          {cert.sanDomains?.length > 1 && (
                            <span className="text-[10px] text-slate-400 block font-normal">
                              +{cert.sanDomains.length - 1} 个备用域名
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span className="text-slate-800 dark:text-slate-200 font-medium truncate max-w-[160px] block" title={cert.issuer}>
                            {cert.issuer}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className={`font-bold px-2 py-0.5 rounded-full ${
                            days <= 10 
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300' 
                              : isExpiring 
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300' 
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300'
                          }`}>
                            {days <= 0 ? '已过期' : `剩余 ${days} 天`}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-mono text-[11px]">
                          {new Date(cert.expiresAt).toLocaleDateString()}
                        </td>

                        <td className="py-3 px-4 font-mono text-[10px] text-slate-400">
                          <span>{cert.keyType?.toUpperCase() || 'ECC'}</span>
                          <span className="block truncate max-w-[120px]" title={cert.serialNumber}>
                            SN: {cert.serialNumber || 'N/A'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setDownloadModalCert(cert)}
                              className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
                              title="下载多格式证书文件"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={async () => {
                                const full = await api.getCert(cert.id);
                                setSelectedCert(full);
                              }}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                              title="查看完整 PEM 内容"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteCert(cert.id, cert.primaryDomain)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                              title="删除证书"
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
      {filteredCerts.length > 0 && (
        <div className="mt-auto pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm text-xs text-slate-500 dark:text-slate-400">
            <div>
              显示第 {filteredCerts.length === 0 ? 0 : `${startIndex + 1}-${Math.min(startIndex + pageSize, filteredCerts.length)}`} 项，共 {filteredCerts.length} 项
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

      {/* Download Modal */}
      {downloadModalCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white">一键导出 SSL 证书格式</h3>
              <button onClick={() => setDownloadModalCert(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              当前域名: <strong className="font-mono text-emerald-600">{downloadModalCert.primaryDomain}</strong>
            </p>

            <div className="space-y-2">
              <button
                onClick={() => handleDownloadFormat(downloadModalCert.id, 'fullchain')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-colors"
              >
                <span>Nginx / Caddy 证书 (fullchain.pem)</span>
                <Download className="w-4 h-4 text-emerald-600" />
              </button>

              <button
                onClick={() => handleDownloadFormat(downloadModalCert.id, 'key')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-colors"
              >
                <span>私钥文件 (privkey.pem)</span>
                <Download className="w-4 h-4 text-emerald-600" />
              </button>

              <button
                onClick={() => handleDownloadFormat(downloadModalCert.id, 'json')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-colors"
              >
                <span>API 结构化数据 (JSON)</span>
                <Download className="w-4 h-4 text-emerald-600" />
              </button>

              {/* PFX format */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>IIS / Tomcat 格式 (.pfx / .p12)</span>
                  <button
                    onClick={() => handleDownloadFormat(downloadModalCert.id, 'pfx')}
                    className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  type="password"
                  value={pfxPassword}
                  onChange={e => setPfxPassword(e.target.value)}
                  placeholder="PFX 导出密码 (默认留空)"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Full PEM Modal */}
      {selectedCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto animate-scaleUp">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">证书详情 & PEM 源码</h3>
                <p className="text-xs text-slate-400 font-mono">{selectedCert.primaryDomain}</p>
              </div>
              <button onClick={() => setSelectedCert(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">完整证书链 (Fullchain PEM)</label>
                  <button
                    onClick={() => copyToClipboard(selectedCert.fullchainPem || '', 'fullchain')}
                    className="text-xs text-emerald-600 flex items-center gap-1 hover:underline"
                  >
                    {copied === 'fullchain' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied === 'fullchain' ? '已复制' : '复制证书'}</span>
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={8}
                  value={selectedCert.fullchainPem || ''}
                  className="w-full p-3 rounded-2xl bg-slate-950 text-emerald-400 font-mono text-[11px] border border-slate-800 focus:outline-none select-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">私钥 (Private Key PEM)</label>
                  <button
                    onClick={() => copyToClipboard(selectedCert.privkeyPem || '', 'privkey')}
                    className="text-xs text-emerald-600 flex items-center gap-1 hover:underline"
                  >
                    {copied === 'privkey' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied === 'privkey' ? '已复制' : '复制私钥'}</span>
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={6}
                  value={selectedCert.privkeyPem || ''}
                  className="w-full p-3 rounded-2xl bg-slate-950 text-amber-400 font-mono text-[11px] border border-slate-800 focus:outline-none select-all"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Online Inspector Modal (Expanded & Height Enhanced as per User Request) */}
      {inspectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl p-6 sm:p-7 space-y-4 shadow-2xl max-h-[90vh] flex flex-col animate-scaleUp">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <FileSearch className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">在线 X.509 证书体检与深度解析</h3>
                  <p className="text-xs text-slate-400">支持多级证书链 PEM 解析，即时提取有效期、SAN 扩展域名、签名算法与 SHA-256 指纹</p>
                </div>
              </div>
              <button onClick={() => setInspectModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Action Toolbar */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">请在下方文本框输入或上传 SSL 证书内容 (PEM 格式):</span>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={inspectFileInputRef}
                  onChange={handleInspectFileUpload}
                  accept=".pem,.crt,.cer,.txt"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium"
                >
                  <ClipboardPaste className="w-3.5 h-3.5 text-emerald-600" />
                  <span>粘贴剪贴板</span>
                </button>
                <button
                  type="button"
                  onClick={() => inspectFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-600" />
                  <span>上传文件</span>
                </button>
                {inspectPemInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setInspectPemInput('');
                      setInspectResult(null);
                      setInspectError(null);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-slate-400 hover:text-rose-600 font-medium"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>清空</span>
                  </button>
                )}
              </div>
            </div>

            {/* Large Height Textarea (Height Expanded for Full PEM content) */}
            <textarea
              rows={9}
              value={inspectPemInput}
              onChange={e => setInspectPemInput(e.target.value)}
              placeholder={`-----BEGIN CERTIFICATE-----\nMIIFajCCBFKgAwIBAgIQD...\n...\n-----END CERTIFICATE-----`}
              className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed text-slate-800 dark:text-slate-200 min-h-[190px] sm:min-h-[220px]"
            />

            {inspectError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                {inspectError}
              </div>
            )}

            <button
              onClick={handleInspectSubmit}
              disabled={inspectLoading || !inspectPemInput.trim()}
              className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all active:scale-[0.99] disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
            >
              <FileSearch className={`w-4 h-4 ${inspectLoading ? 'animate-spin' : ''}`} />
              <span>{inspectLoading ? '正在深度解密与解析证书...' : '立即解析证书'}</span>
            </button>

            {/* Inspection Results */}
            {inspectResult && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-3 overflow-y-auto max-h-60 animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-slate-400 block text-[11px]">通用主体 (Subject):</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white truncate block">{inspectResult.subject}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-slate-400 block text-[11px]">签发 CA 机构 (Issuer):</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white truncate block">{inspectResult.issuer}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-slate-400 block text-[11px]">剩余有效期:</span>
                    <span className={`font-bold font-mono text-sm ${
                      inspectResult.daysRemaining <= 7 ? 'text-rose-500' : inspectResult.daysRemaining <= 30 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {inspectResult.daysRemaining} 天
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-slate-400 block text-[11px]">到期时间:</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{new Date(inspectResult.validTo).toLocaleString()}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-slate-400 block text-[11px]">加密算法:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{inspectResult.keyType?.toUpperCase()}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-slate-400 block text-[11px]">SHA-256 指纹:</span>
                    <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400 truncate block select-all" title={inspectResult.fingerprintSha256}>
                      {inspectResult.fingerprintSha256}
                    </span>
                  </div>
                </div>

                {inspectResult.sanDomains?.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
                    <span className="text-slate-400 font-bold text-[11px]">SAN 包含域名清单 ({inspectResult.sanDomains.length}):</span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {inspectResult.sanDomains.map((d: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] border border-emerald-200/60 dark:border-emerald-800/60">
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
