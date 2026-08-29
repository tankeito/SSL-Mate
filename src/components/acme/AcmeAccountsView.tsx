import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Edit3, 
  RefreshCw, 
  CheckCircle, 
  X, 
  ShieldAlert, 
  ExternalLink, 
  KeyRound, 
  Check, 
  Copy, 
  Star, 
  Layers, 
  Info,
  Server,
  Zap,
  Globe
} from 'lucide-react';
import { AcmeAccount, CAProvider } from '../../types';
import { api } from '../../api/client';
import { useModal } from '../../contexts/ModalContext';

export const AcmeAccountsView: React.FC = () => {
  const { confirm, toast } = useModal();
  const [accounts, setAccounts] = useState<AcmeAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AcmeAccount | null>(null);
  const [name, setName] = useState('');
  const [caProvider, setCaProvider] = useState<CAProvider>('letsencrypt');
  const [email, setEmail] = useState('');
  const [directoryUrl, setDirectoryUrl] = useState('');
  const [eabKid, setEabKid] = useState('');
  const [eabHmacKey, setEabHmacKey] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAccounts = async (showToast = false) => {
    if (showToast) setRefreshing(true);
    try {
      const data = await api.getAcmeAccounts();
      setAccounts(data);
      if (showToast) {
        toast.success('CA 机构账户列表已刷新');
      }
    } catch (err) {
      console.error('Failed to load acme accounts:', err);
    } finally {
      setLoading(false);
      if (showToast) {
        setTimeout(() => setRefreshing(false), 500);
      }
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const openAddModal = () => {
    setEditingAccount(null);
    setName('');
    setCaProvider('letsencrypt');
    setEmail('admin@sslmate.local');
    setDirectoryUrl('');
    setEabKid('');
    setEabHmacKey('');
    setIsDefault(false);
    setModalOpen(true);
  };

  const openEditModal = (acc: AcmeAccount) => {
    setEditingAccount(acc);
    setName(acc.name);
    setCaProvider(acc.caProvider);
    setEmail(acc.email);
    setDirectoryUrl(acc.directoryUrl);
    setEabKid(acc.eabKid || '');
    setEabHmacKey('');
    setIsDefault(acc.isDefault);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) {
      toast.warning('请填写 CA 账户名称和联系邮箱');
      return;
    }

    try {
      if (editingAccount) {
        await api.updateAcmeAccount(editingAccount.id, {
          name,
          caProvider,
          email,
          directoryUrl: directoryUrl || undefined,
          eabKid: eabKid || undefined,
          eabHmacKey: eabHmacKey || undefined,
          isDefault
        });
        toast.success(`已更新 CA 账户 [${name}]`);
      } else {
        await api.createAcmeAccount({
          name,
          caProvider,
          email,
          directoryUrl: directoryUrl || undefined,
          eabKid: eabKid || undefined,
          eabHmacKey: eabHmacKey || undefined,
          isDefault
        });
        toast.success(`已创建 CA 账户 [${name}]`);
      }
      setModalOpen(false);
      fetchAccounts();
    } catch (err: any) {
      toast.error(`保存失败: ${err.message}`);
    }
  };

  const handleSetDefault = async (acc: AcmeAccount) => {
    try {
      await api.updateAcmeAccount(acc.id, {
        ...acc,
        isDefault: true
      });
      toast.success(`已将 [${acc.name}] 设为默认证书签发机构`);
      fetchAccounts();
    } catch (err: any) {
      toast.error(`设置失败: ${err.message}`);
    }
  };

  const handleDelete = async (id: string, accName: string) => {
    const ok = await confirm({
      title: '删除 ACME CA 机构账户',
      message: `确定要删除 CA 账户 [${accName}] 吗？删除后关联此机构账号的任务将无法继续申请证书。`,
      confirmText: '确认删除',
      type: 'danger'
    });
    if (!ok) return;

    try {
      await api.deleteAcmeAccount(id);
      setAccounts(accounts.filter(a => a.id !== id));
      toast.success(`已删除 CA 账户 [${accName}]`);
    } catch (err: any) {
      toast.error(`删除失败: ${err.message}`);
    }
  };

  const handleCopyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success('ACME Directory URL 已复制到剪贴板');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper for CA Brand Metas
  const getProviderMeta = (provider: CAProvider) => {
    switch (provider) {
      case 'letsencrypt':
        return {
          badgeBg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
          cardBorder: 'hover:border-emerald-500/50',
          iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white',
          tag: '生产推荐 · 免 EAB',
          highlights: ['全球浏览器 100% 信任', '免 EAB 快速签发', '90天自动轮换'],
          defaultUrl: 'https://acme-v02.api.letsencrypt.org/directory'
        };
      case 'letsencrypt_staging':
        return {
          badgeBg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
          cardBorder: 'hover:border-amber-500/50',
          iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white',
          tag: '沙箱联调 · 宽松限流',
          highlights: ['高频限流免封锁', '联调验证首选', '不受每周50张限制'],
          defaultUrl: 'https://acme-staging-v02.api.letsencrypt.org/directory'
        };
      case 'zerossl':
        return {
          badgeBg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
          cardBorder: 'hover:border-blue-500/50',
          iconBg: 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white',
          tag: '支持 EAB · IP证书',
          highlights: ['支持公网 IP 证书', '与 ZeroSSL 控制台同步', '双线灾备主力'],
          defaultUrl: 'https://acme.zerossl.com/v2/DV90'
        };
      case 'google':
        return {
          badgeBg: 'bg-sky-50 text-sky-700 dark:bg-sky-950/80 dark:text-sky-300 border-sky-200 dark:border-sky-800/60',
          cardBorder: 'hover:border-sky-500/50',
          iconBg: 'bg-gradient-to-br from-sky-500 via-indigo-500 to-blue-600 text-white',
          tag: '极速 OCSP · 谷歌骨干网',
          highlights: ['超低 OCSP 握手延迟', 'Google 全球基础设施', '高可用签发保障'],
          defaultUrl: 'https://dv.acme-v02.api.pki.goog/directory'
        };
      default:
        return {
          badgeBg: 'bg-purple-50 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200 dark:border-purple-800/60',
          cardBorder: 'hover:border-purple-500/50',
          iconBg: 'bg-gradient-to-br from-purple-500 to-violet-600 text-white',
          tag: '自建私有 PKI',
          highlights: ['支持 Smallstep / Vault', '内网隔离环境专享', 'RFC 8555 标准兼容'],
          defaultUrl: ''
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>ACME CA 机构账户</span>
            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60">
              RFC 8555 标准
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            管理 Let's Encrypt / Google GTS / ZeroSSL 等权威 CA 证书颁发机构，支持多机构自动故障转移（Failover）
          </p>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          <button
            onClick={() => fetchAccounts(true)}
            disabled={refreshing}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 shrink-0"
            title="刷新列表"
          >
            <RefreshCw className={`w-4 h-4 transition-transform duration-500 ${refreshing ? 'animate-spin text-emerald-500' : ''}`} />
          </button>

          <button
            onClick={openAddModal}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>添加 CA 账户</span>
          </button>
        </div>
      </div>

      {/* Modern 1 Row 3-4 Grid */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {accounts.map(acc => {
            const meta = getProviderMeta(acc.caProvider);

            return (
              <div
                key={acc.id}
                className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between transition-all duration-200 ${meta.cardBorder} hover:shadow-md relative overflow-hidden`}
              >
                {/* Default CA Corner Ribbon */}
                {acc.isDefault && (
                  <div className="absolute -right-8 top-3 bg-emerald-500 text-white text-[9px] font-bold px-8 py-0.5 rotate-45 shadow-sm">
                    默认 CA
                  </div>
                )}

                <div className="space-y-3.5">
                  {/* Card Brand Header */}
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-2xl ${meta.iconBg} flex items-center justify-center shadow-md shrink-0`}>
                      <ShieldCheck className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1 pr-4">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate" title={acc.name}>
                        {acc.name}
                      </h3>
                      <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.2 rounded-full border ${meta.badgeBg}`}>
                        {meta.tag}
                      </span>
                    </div>
                  </div>

                  {/* Highlights feature chips */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {meta.highlights.map((h, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-medium">
                        ✓ {h}
                      </span>
                    ))}
                  </div>

                  {/* Account Metadata Details */}
                  <div className="space-y-2 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>注册/告警邮箱:</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[150px]" title={acc.email}>
                        {acc.email}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>EAB 绑定状态:</span>
                      {acc.eabKid ? (
                        <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded">
                          已配置 EAB
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-normal">免 EAB 凭证</span>
                      )}
                    </div>

                    {/* Directory Endpoint with 1-click copy */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>ACME Directory Endpoint</span>
                        <button
                          type="button"
                          onClick={() => handleCopyUrl(acc.directoryUrl, acc.id)}
                          className="hover:text-emerald-600 flex items-center gap-0.5"
                        >
                          {copiedId === acc.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedId === acc.id ? '已复制' : '复制'}</span>
                        </button>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-xl truncate select-all">
                        {acc.directoryUrl}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div>
                    {!acc.isDefault ? (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(acc)}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-emerald-600 font-medium py-1 px-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                      >
                        <Star className="w-3.5 h-3.5" />
                        <span>设为默认</span>
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold px-2 py-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>当前默认</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(acc)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="编辑账户 / 配置 EAB"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(acc.id, acc.name)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      title="删除账户"
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

      {/* Edit / Add Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {editingAccount ? `编辑 CA 账户 [${editingAccount.name}]` : '添加 ACME CA 机构账户'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">CA 机构服务商类型</label>
                <select
                  value={caProvider}
                  onChange={e => {
                    const prov = e.target.value as CAProvider;
                    setCaProvider(prov);
                    const meta = getProviderMeta(prov);
                    if (meta.defaultUrl) setDirectoryUrl(meta.defaultUrl);
                    if (!editingAccount) {
                      if (prov === 'letsencrypt') setName("Let's Encrypt (Production)");
                      else if (prov === 'letsencrypt_staging') setName("Let's Encrypt (Staging / 测试环境)");
                      else if (prov === 'zerossl') setName("ZeroSSL (需要 EAB 凭证)");
                      else if (prov === 'google') setName("Google Trust Services (需要 EAB 凭证)");
                      else setName("自定义私有 ACME CA");
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-medium"
                >
                  <option value="letsencrypt">Let's Encrypt (Production) - 全球第一权威，免 EAB 即用</option>
                  <option value="letsencrypt_staging">Let's Encrypt (Staging) - 沙箱测试，宽松限流联调</option>
                  <option value="zerossl">ZeroSSL - 支持公网 IP 证书与双线灾备 (需 EAB)</option>
                  <option value="google">Google Trust Services (GTS) - 谷歌全球骨干网，超低 OCSP 延迟 (需 EAB)</option>
                  <option value="custom">自定义 ACME CA - 企业内网 Smallstep / Vault / CFSSL</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">账户显示名称</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="例如: Let's Encrypt 生产账户"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">联系电子邮箱 (用于接收证书到期通知)</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">ACME Directory Endpoint (目录服务地址)</label>
                <input
                  type="text"
                  value={directoryUrl}
                  onChange={e => setDirectoryUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono text-xs"
                />
              </div>

              {/* EAB Credentials (ZeroSSL / Google GTS) */}
              {(caProvider === 'zerossl' || caProvider === 'google' || caProvider === 'custom') && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                      <span>EAB (External Account Binding) 外部绑定凭证</span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {caProvider === 'zerossl' ? '从 ZeroSSL 开发者中心获取' : '从 Google Cloud 安全中心获取'}
                    </span>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">EAB Key ID (KID)</label>
                    <input
                      type="text"
                      value={eabKid}
                      onChange={e => setEabKid(e.target.value)}
                      placeholder="eab-kid-..."
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">EAB HMAC Key (密文安全存储)</label>
                    <input
                      type="password"
                      value={eabHmacKey}
                      onChange={e => setEabHmacKey(e.target.value)}
                      placeholder={editingAccount?.eabKid ? '•••••••• (留空保持原 HMAC Key)' : 'Base64 或 Hex 格式 HMAC 密钥'}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="caIsDefault"
                  checked={isDefault}
                  onChange={e => setIsDefault(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <label htmlFor="caIsDefault" className="text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                  设为系统全局默认 CA（新建证书任务时默认选用此机构）
                </label>
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
                onClick={handleSave}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md transition-all active:scale-95"
              >
                {editingAccount ? '保存修改' : '确认创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
