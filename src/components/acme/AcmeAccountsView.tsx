import React, { useState, useEffect } from 'react';
import { ShieldAlert, Plus, Trash2, Edit3, RefreshCw, CheckCircle, X } from 'lucide-react';
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

  const fetchAccounts = async () => {
    try {
      const data = await api.getAcmeAccounts();
      setAccounts(data);
    } catch (err) {
      console.error('Failed to load acme accounts:', err);
    } finally {
      setLoading(false);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">ACME CA 机构账户</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">管理 Let's Encrypt / ZeroSSL / Google Trust Services 等权威 CA 证书颁发机构账号</p>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          <button
            onClick={fetchAccounts}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
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

      {/* Accounts List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accounts.map(acc => (
            <div
              key={acc.id}
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 shrink-0">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                        <span className="truncate">{acc.name}</span>
                        {acc.isDefault && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 font-normal shrink-0">
                            默认
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono truncate">{acc.email}</p>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase shrink-0">
                    {acc.caProvider}
                  </span>
                </div>

                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl truncate">
                  URL: {acc.directoryUrl}
                </div>

                {acc.eabKid && (
                  <div className="text-[11px] text-slate-400">
                    EAB 绑定: <span className="font-mono text-emerald-600">{acc.eabKid}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => openEditModal(acc)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(acc.id, acc.name)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white">
                {editingAccount ? '编辑 ACME 账户' : '添加 ACME CA 账户'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">账户显示名称</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">CA 服务商</label>
                <select
                  value={caProvider}
                  onChange={e => setCaProvider(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
                >
                  <option value="letsencrypt">Let's Encrypt (Production)</option>
                  <option value="letsencrypt_staging">Let's Encrypt (Staging 测试环境)</option>
                  <option value="zerossl">ZeroSSL (需配置 EAB)</option>
                  <option value="google">Google Trust Services (需配置 EAB)</option>
                  <option value="custom">自定义 ACME Directory URL / 私有 CA</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">注册通知邮箱</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono"
                />
              </div>

              {caProvider === 'custom' && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">ACME Directory URL</label>
                  <input
                    type="text"
                    value={directoryUrl}
                    onChange={e => setDirectoryUrl(e.target.value)}
                    placeholder="https://acme.myca.internal/directory"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono"
                  />
                </div>
              )}

              {(caProvider === 'zerossl' || caProvider === 'google' || caProvider === 'custom') && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                  <span className="font-bold block">EAB 凭证 (External Account Binding)</span>
                  <div>
                    <label className="block text-slate-500 mb-0.5">EAB Key Identifier (KID)</label>
                    <input
                      type="text"
                      value={eabKid}
                      onChange={e => setEabKid(e.target.value)}
                      placeholder="ZeroSSL / Google 提供的 EAB KID"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-0.5">EAB HMAC Key</label>
                    <input
                      type="password"
                      value={eabHmacKey}
                      onChange={e => setEabHmacKey(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isDefaultAccount"
                  checked={isDefault}
                  onChange={e => setIsDefault(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="isDefaultAccount" className="text-slate-700 dark:text-slate-300 cursor-pointer">
                  设为系统默认 CA 申请账户
                </label>
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
                onClick={handleSave}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md"
              >
                保存账户
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
