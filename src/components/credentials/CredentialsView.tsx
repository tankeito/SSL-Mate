import React, { useState, useEffect } from 'react';
import { 
  KeyRound, 
  Plus, 
  Trash2, 
  Edit3, 
  ShieldCheck, 
  RefreshCw, 
  Server, 
  Cloud, 
  Zap, 
  Check, 
  AlertCircle,
  X
} from 'lucide-react';
import { Credential, CredentialType } from '../../types';
import { api } from '../../api/client';
import { useModal } from '../../contexts/ModalContext';

export const CredentialsView: React.FC = () => {
  const { confirm, toast } = useModal();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCred, setEditingCred] = useState<Credential | null>(null);
  const [credName, setCredName] = useState('');
  const [credType, setCredType] = useState<CredentialType>('dns_cloudflare');
  const [credRemark, setCredRemark] = useState('');
  
  // Specific config fields
  const [cfApiToken, setCfApiToken] = useState('');
  const [cfAuthEmail, setCfAuthEmail] = useState('');
  const [cfAuthKey, setCfAuthKey] = useState('');
  const [aliAccessKeyId, setAliAccessKeyId] = useState('');
  const [aliAccessKeySecret, setAliAccessKeySecret] = useState('');
  const [txSecretId, setTxSecretId] = useState('');
  const [txSecretKey, setTxSecretKey] = useState('');
  const [sshHost, setSshHost] = useState('');
  const [sshPort, setSshPort] = useState(22);
  const [sshUsername, setSshUsername] = useState('root');
  const [sshPassword, setSshPassword] = useState('');
  const [sshPrivateKey, setSshPrivateKey] = useState('');

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCredentials = async (showToast = false) => {
    if (showToast) setRefreshing(true);
    try {
      const data = await api.getCredentials();
      setCredentials(data);
      if (showToast) {
        toast.success('安全凭据列表已刷新');
      }
    } catch (err) {
      console.error('Failed to load credentials:', err);
    } finally {
      setLoading(false);
      if (showToast) {
        setTimeout(() => setRefreshing(false), 500);
      }
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  const openAddModal = () => {
    setEditingCred(null);
    setCredName('');
    setCredType('dns_cloudflare');
    setCredRemark('');
    setCfApiToken('');
    setCfAuthEmail('');
    setCfAuthKey('');
    setAliAccessKeyId('');
    setAliAccessKeySecret('');
    setTxSecretId('');
    setTxSecretKey('');
    setSshHost('');
    setSshPort(22);
    setSshUsername('root');
    setSshPassword('');
    setSshPrivateKey('');
    setTestResult(null);
    setModalOpen(true);
  };

  const openEditModal = (c: Credential) => {
    setEditingCred(c);
    setCredName(c.name);
    setCredType(c.type);
    setCredRemark(c.remark || '');
    const cfg = c.config || {};
    setCfApiToken(cfg.apiToken || '');
    setCfAuthEmail(cfg.authEmail || '');
    setCfAuthKey(cfg.authKey || '');
    setAliAccessKeyId(cfg.accessKeyId || '');
    setAliAccessKeySecret(cfg.accessKeySecret || '');
    setTxSecretId(cfg.secretId || '');
    setTxSecretKey(cfg.secretKey || '');
    setSshHost(cfg.host || '');
    setSshPort(cfg.port || 22);
    setSshUsername(cfg.username || 'root');
    setSshPassword(cfg.password || '');
    setSshPrivateKey(cfg.privateKey || '');
    setTestResult(null);
    setModalOpen(true);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      let config: Record<string, any> = {};
      if (credType === 'dns_cloudflare') {
        config = { apiToken: cfApiToken, authEmail: cfAuthEmail, authKey: cfAuthKey };
      } else if (credType === 'dns_aliyun' || credType === 'aliyun_cloud') {
        config = { accessKeyId: aliAccessKeyId, accessKeySecret: aliAccessKeySecret };
      } else if (credType === 'dns_tencent' || credType === 'tencent_cloud') {
        config = { secretId: txSecretId, secretKey: txSecretKey };
      }

      const res = await api.testCredential({ type: credType, config });
      setTestResult(res);
      if (res.success) {
        toast.success('连通性校验成功！API 权限完整有效');
      } else {
        toast.error(`连通性校验失败: ${res.message}`);
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || '连接校验失败' });
      toast.error(`连通性校验失败: ${err.message || '网络或凭据异常'}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!credName.trim()) {
      toast.warning('请输入安全凭据名称');
      return;
    }

    let config: Record<string, any> = {};
    if (credType === 'dns_cloudflare') {
      config = { apiToken: cfApiToken, authEmail: cfAuthEmail, authKey: cfAuthKey };
    } else if (credType === 'dns_aliyun' || credType === 'aliyun_cloud') {
      config = { accessKeyId: aliAccessKeyId, accessKeySecret: aliAccessKeySecret };
    } else if (credType === 'dns_tencent' || credType === 'tencent_cloud') {
      config = { secretId: txSecretId, secretKey: txSecretKey };
    } else if (credType === 'ssh_host') {
      config = { host: sshHost, port: sshPort, username: sshUsername, password: sshPassword, privateKey: sshPrivateKey };
    }

    try {
      if (editingCred) {
        await api.updateCredential(editingCred.id, { name: credName, type: credType, config, remark: credRemark });
        toast.success(`已更新安全凭据 [${credName}]`);
      } else {
        await api.createCredential({ name: credName, type: credType, config, remark: credRemark });
        toast.success(`已保存安全凭据 [${credName}]`);
      }
      setModalOpen(false);
      fetchCredentials();
    } catch (err: any) {
      toast.error(`保存失败: ${err.message}`);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: '删除安全凭据',
      message: `确定要删除凭据 [${name}] 吗？删除后关联该凭据的自动化任务将无法调用相关云服务 API。`,
      confirmText: '确认删除',
      type: 'danger'
    });
    if (!ok) return;

    try {
      await api.deleteCredential(id);
      setCredentials(credentials.filter(c => c.id !== id));
      toast.success(`已删除凭据 [${name}]`);
    } catch (err: any) {
      toast.error(`删除失败: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">安全凭据中心 (Credential Vault)</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">所有第三方云平台 API 密钥与主机私钥均经 AES-256-GCM 硬件加密存储</p>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          <button
            onClick={() => fetchCredentials(true)}
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
            <span>添加安全凭据</span>
          </button>
        </div>
      </div>

      {/* Credentials Grid */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      ) : credentials.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <KeyRound className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 dark:text-slate-200">暂无安全凭据</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            添加 Cloudflare API Token、阿里云 AccessKey 或腾讯云 SecretId，供 DNS-01 验证及多端部署复用。
          </p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>立即添加</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {credentials.map(c => {
            const isDns = c.type.startsWith('dns_');
            const isSsh = c.type === 'ssh_host';

            return (
              <div
                key={c.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className={`p-2 rounded-xl shrink-0 ${
                        isDns ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600' :
                        isSsh ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600' :
                        'bg-purple-50 dark:bg-purple-950/60 text-purple-600'
                      }`}>
                        {isDns ? <Cloud className="w-4 h-4" /> : isSsh ? <Server className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
                      </div>
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">{c.name}</h3>
                    </div>

                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                      {c.type}
                    </span>
                  </div>

                  {c.remark && (
                    <p className="text-xs text-slate-400">{c.remark}</p>
                  )}

                  {/* Masked details summary */}
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl space-y-1">
                    {c.config.apiToken && <div>Token: {c.config.apiToken}</div>}
                    {c.config.accessKeyId && <div>AK: {c.config.accessKeyId}</div>}
                    {c.config.secretId && <div>SecretID: {c.config.secretId}</div>}
                    {c.config.host && <div>Host: {c.config.host}:{c.config.port || 22}</div>}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400">
                    AES-256 密文封存
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditModal(c)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(c.id, c.name)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
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

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {editingCred ? '编辑安全凭据' : '添加安全凭据'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  凭据标识名称 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={credName}
                  onChange={e => setCredName(e.target.value)}
                  placeholder="例如: Cloudflare - 主账号 / 阿里云 - 运维组"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  凭据类型
                </label>
                <select
                  value={credType}
                  onChange={e => setCredType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <optgroup label="DNS API 凭据 (用于申请 SSL)">
                    <option value="dns_cloudflare">Cloudflare API Token</option>
                    <option value="dns_aliyun">阿里云 DNS (AccessKey)</option>
                    <option value="dns_tencent">腾讯云 DNSPod (SecretId/Key)</option>
                    <option value="dns_huawei">华为云 DNS</option>
                  </optgroup>
                  <optgroup label="主机与部署凭据">
                    <option value="ssh_host">远程 Linux SSH 主机</option>
                    <option value="aliyun_cloud">阿里云云产品 (CDN/CAS/WAF)</option>
                    <option value="tencent_cloud">腾讯云云产品 (CDN/SSL)</option>
                  </optgroup>
                </select>
              </div>

              {/* Dynamic Type Configs */}
              {credType === 'dns_cloudflare' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Cloudflare API Token (推荐)
                    </label>
                    <input
                      type="password"
                      value={cfApiToken}
                      onChange={e => setCfApiToken(e.target.value)}
                      placeholder="包含 Zone:DNS:Edit 权限的 API Token"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                    />
                  </div>
                  <div className="text-[11px] text-slate-400">或者使用 Global API Key:</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={cfAuthEmail}
                      onChange={e => setCfAuthEmail(e.target.value)}
                      placeholder="Auth Email"
                      className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs"
                    />
                    <input
                      type="password"
                      value={cfAuthKey}
                      onChange={e => setCfAuthKey(e.target.value)}
                      placeholder="Global API Key"
                      className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              {(credType === 'dns_aliyun' || credType === 'aliyun_cloud') && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">AccessKey ID</label>
                    <input
                      type="text"
                      value={aliAccessKeyId}
                      onChange={e => setAliAccessKeyId(e.target.value)}
                      placeholder="LTAI5t..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">AccessKey Secret</label>
                    <input
                      type="password"
                      value={aliAccessKeySecret}
                      onChange={e => setAliAccessKeySecret(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              {(credType === 'dns_tencent' || credType === 'tencent_cloud') && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">SecretId</label>
                    <input
                      type="text"
                      value={txSecretId}
                      onChange={e => setTxSecretId(e.target.value)}
                      placeholder="AKID..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">SecretKey</label>
                    <input
                      type="password"
                      value={txSecretKey}
                      onChange={e => setTxSecretKey(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              {credType === 'ssh_host' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">主机 IP / 域名</label>
                      <input
                        type="text"
                        value={sshHost}
                        onChange={e => setSshHost(e.target.value)}
                        placeholder="192.168.1.100"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">端口</label>
                      <input
                        type="number"
                        value={sshPort}
                        onChange={e => setSshPort(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">SSH 用户名</label>
                      <input
                        type="text"
                        value={sshUsername}
                        onChange={e => setSshUsername(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">密码 (可选)</label>
                      <input
                        type="password"
                        value={sshPassword}
                        onChange={e => setSshPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">SSH 私钥 (可选)</label>
                    <textarea
                      rows={3}
                      value={sshPrivateKey}
                      onChange={e => setSshPrivateKey(e.target.value)}
                      placeholder="-----BEGIN RSA PRIVATE KEY-----..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">备注说明</label>
                <input
                  type="text"
                  value={credRemark}
                  onChange={e => setCredRemark(e.target.value)}
                  placeholder="用于主站集群自动同步..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>

              {/* Test result message */}
              {testResult && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  testResult.success 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                }`}>
                  {testResult.success ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>{testing ? '测试中...' : '测试连通性'}</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all active:scale-95"
                >
                  保存凭据
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
