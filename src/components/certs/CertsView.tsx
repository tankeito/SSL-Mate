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
  RotateCcw
} from 'lucide-react';
import { Certificate } from '../../types';
import { api } from '../../api/client';
import { useModal } from '../../contexts/ModalContext';

export const CertsView: React.FC = () => {
  const { confirm, toast } = useModal();
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
  }, [search, pageSize]);

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
      
      const token = localStorage.getItem('token');
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

  const filteredCerts = certs.filter(c => 
    c.primaryDomain.toLowerCase().includes(search.toLowerCase()) ||
    (c.issuer && c.issuer.toLowerCase().includes(search.toLowerCase())) ||
    (c.sanDomains && c.sanDomains.some((d: string) => d.toLowerCase().includes(search.toLowerCase())))
  );

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

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索域名或签发机构..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2">
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
        </div>

        {/* Certificates Table */}
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
              {search ? '未找到符合条件的证书资产' : '暂无证书资产'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {search ? '请尝试更换搜索关键词' : '当自动化任务执行成功后，签发出来的全套证书与私钥将自动入库并在此归档。'}
            </p>
          </div>
        ) : (
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
