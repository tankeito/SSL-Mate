import React, { useState, useEffect } from 'react';
import { 
  Award, 
  Download, 
  Search, 
  FileText, 
  Trash2, 
  Key, 
  ShieldCheck, 
  RefreshCw, 
  Eye, 
  FileSearch, 
  Check, 
  Copy,
  X
} from 'lucide-react';
import { Certificate } from '../../types';
import { api } from '../../api/client';
import { useModal } from '../../contexts/ModalContext';

export const CertsView: React.FC = () => {
  const { confirm, toast } = useModal();
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  const [downloadModalCert, setDownloadModalCert] = useState<Certificate | null>(null);
  const [pfxPassword, setPfxPassword] = useState('');
  
  // Inspect Modal
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [inspectPemInput, setInspectPemInput] = useState('');
  const [inspectResult, setInspectResult] = useState<any>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);

  // Copied state
  const [copied, setCopied] = useState<string | null>(null);

  const fetchCerts = async () => {
    try {
      const data = await api.getCerts();
      setCerts(data);
    } catch (err) {
      console.error('Failed to load certs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCerts();
  }, []);

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
      toast.success(`已删除证书资产 [${domain}]`);
    } catch (err: any) {
      toast.error(`删除失败: ${err.message}`);
    }
  };

  const handleDownloadFormat = (certId: string, format: string) => {
    const token = localStorage.getItem('sslmate_token');
    const url = `/api/certs/${certId}/download/${format}${format === 'pfx' ? `?password=${encodeURIComponent(pfxPassword)}` : ''}`;
    
    // Create hidden anchor with auth header or open in tab
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    // Append token if needed via fetch or standard download
    fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const blobUrl = window.URL.createObjectURL(blob);
        a.href = blobUrl;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
      });
  };

  const handleInspectSubmit = async () => {
    if (!inspectPemInput.trim()) return;
    setInspectLoading(true);
    setInspectError(null);
    try {
      const res = await api.inspectCert(inspectPemInput.trim());
      setInspectResult(res);
    } catch (err: any) {
      setInspectError(err.message || '证书解析失败');
    } finally {
      setInspectLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const filteredCerts = certs.filter(c => 
    c.primaryDomain.toLowerCase().includes(search.toLowerCase()) ||
    c.issuer.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">证书资产台账</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">所有自动化签发及归档的物理 SSL 证书仓库</p>
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
              onClick={fetchCerts}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
              title="刷新列表"
            >
              <RefreshCw className="w-4 h-4" />
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
          <h3 className="font-bold text-slate-800 dark:text-slate-200">暂无证书资产</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            当自动化任务执行成功后，签发出来的全套证书与私钥将自动入库并在此归档。
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
                {filteredCerts.map(cert => {
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
                        <span className="text-slate-800 dark:text-slate-200 font-medium truncate max-w-[160px] block">
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

      {/* Download Modal */}
      {downloadModalCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
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
                <span>全套 JSON 综合打包 (ssl_bundle.json)</span>
                <Download className="w-4 h-4 text-emerald-600" />
              </button>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">IIS / Windows (.pfx / .p12 格式)</span>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={pfxPassword}
                    onChange={e => setPfxPassword(e.target.value)}
                    placeholder="可选 PFX 提取密码"
                    className="flex-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                  <button
                    onClick={() => handleDownloadFormat(downloadModalCert.id, 'pfx')}
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                  >
                    下载 PFX
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full PEM Details View Modal */}
      {selectedCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white">证书与私钥详细文本 (PEM)</h3>
              <button onClick={() => setSelectedCert(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">完整证书链 (Fullchain PEM)</label>
                  <button
                    onClick={() => copyToClipboard(selectedCert.fullchainPem || '', 'fullchain')}
                    className="text-xs text-emerald-600 flex items-center gap-1"
                  >
                    {copied === 'fullchain' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied === 'fullchain' ? '已复制' : '复制证书'}</span>
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={6}
                  value={selectedCert.fullchainPem || ''}
                  className="w-full p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] border border-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">私钥 (Private Key PEM)</label>
                  <button
                    onClick={() => copyToClipboard(selectedCert.privkeyPem || '', 'privkey')}
                    className="text-xs text-emerald-600 flex items-center gap-1"
                  >
                    {copied === 'privkey' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied === 'privkey' ? '已复制' : '复制私钥'}</span>
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={6}
                  value={selectedCert.privkeyPem || ''}
                  className="w-full p-3 rounded-xl bg-slate-900 text-amber-400 font-mono text-[11px] border border-slate-800 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Online Inspector Modal */}
      {inspectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSearch className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 dark:text-white">在线 X.509 证书体检与解析</h3>
              </div>
              <button onClick={() => setInspectModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">粘贴任何标准的 SSL 证书 PEM 格式文本，实时提取生效时间、SAN 域名、签名算法与指纹。</p>

            <textarea
              rows={4}
              value={inspectPemInput}
              onChange={e => setInspectPemInput(e.target.value)}
              placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            {inspectError && (
              <p className="text-xs text-rose-500">{inspectError}</p>
            )}

            <button
              onClick={handleInspectSubmit}
              disabled={inspectLoading || !inspectPemInput.trim()}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all disabled:opacity-50"
            >
              {inspectLoading ? '正在深度解析...' : '立即解析证书'}
            </button>

            {inspectResult && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2 overflow-y-auto max-h-56">
                <div className="grid grid-cols-2 gap-2">
                  <div><strong>主题 (Subject):</strong> <span className="font-mono block truncate">{inspectResult.subject}</span></div>
                  <div><strong>签发者 (Issuer):</strong> <span className="font-mono block truncate">{inspectResult.issuer}</span></div>
                  <div><strong>剩余天数:</strong> <span className="font-bold text-emerald-600">{inspectResult.daysRemaining} 天</span></div>
                  <div><strong>过期时间:</strong> <span className="font-mono">{new Date(inspectResult.validTo).toLocaleString()}</span></div>
                  <div><strong>加密算法:</strong> <span>{inspectResult.keyType?.toUpperCase()}</span></div>
                  <div><strong>指纹:</strong> <span className="font-mono truncate block">{inspectResult.fingerprintSha256}</span></div>
                </div>
                <div>
                  <strong>SAN 扩展域名:</strong>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {inspectResult.sanDomains?.map((d: string, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[10px]">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
