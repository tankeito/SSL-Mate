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
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Layers,
  Lock,
  Globe,
  Tag
} from 'lucide-react';
import { Credential, CredentialType } from '../../types';
import { api } from '../../api/client';
import { useModal } from '../../contexts/ModalContext';
import { 
  CloudflareLogo, 
  AliyunLogo, 
  TencentCloudLogo, 
  HuaweiCloudLogo, 
  SSHHostLogo,
  BaotaLogo,
  OnePanelLogo
} from '../common/BrandIcons';

type CredCategoryFilter = 'all' | 'dns' | 'ssh' | 'panel' | 'other';

export const CredentialsView: React.FC = () => {
  const { confirm, toast } = useModal();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search, Filter & Pagination
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CredCategoryFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

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

  // Baota Panel
  const [btApiUrl, setBtApiUrl] = useState('');
  const [btApiKey, setBtApiKey] = useState('');
  const [btIgnoreSsl, setBtIgnoreSsl] = useState(false);

  // 1Panel
  const [onePanelUrl, setOnePanelUrl] = useState('');
  const [onePanelApiKey, setOnePanelApiKey] = useState('');

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, pageSize]);

  const openAddModal = () => {
    setEditingCred(null);
    setCredName('Cloudflare');
    setCredType('dns_cloudflare');
    setCredRemark('');
    setCfApiToken('');
    setCfAuthEmail('tqd354@gmail.com');
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
    setBtApiUrl('http://192.168.1.100:8888');
    setBtApiKey('');
    setBtIgnoreSsl(false);
    setOnePanelUrl('http://192.168.1.100:10000');
    setOnePanelApiKey('');
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
    setBtApiUrl(cfg.apiUrl || cfg.url || '');
    setBtApiKey(cfg.apiKey || '');
    setBtIgnoreSsl(Boolean(cfg.ignoreSsl));
    setOnePanelUrl(cfg.apiUrl || cfg.url || '');
    setOnePanelApiKey(cfg.apiKey || '');
    setTestResult(null);
    setModalOpen(true);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      let config: any = {};
      if (credType === 'dns_cloudflare') {
        config = { apiToken: cfApiToken, authEmail: cfAuthEmail, authKey: cfAuthKey };
      } else if (credType === 'dns_aliyun') {
        config = { accessKeyId: aliAccessKeyId, accessKeySecret: aliAccessKeySecret };
      } else if (credType === 'dns_tencent') {
        config = { secretId: txSecretId, secretKey: txSecretKey };
      } else if (credType === 'ssh_host') {
        config = { host: sshHost, port: sshPort, username: sshUsername, password: sshPassword, privateKey: sshPrivateKey };
      } else if (credType === 'bt_panel') {
        config = { apiUrl: btApiUrl, apiKey: btApiKey, ignoreSsl: btIgnoreSsl };
      } else if (credType === 'one_panel') {
        config = { apiUrl: onePanelUrl, apiKey: onePanelApiKey };
      }

      const res = await api.testCredential({ type: credType, config });
      setTestResult(res);
      if (res.success) {
        toast.success(res.message || '连接连通性测试成功！');
      } else {
        toast.error(`连通性测试失败: ${res.message}`);
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || '测试失败' });
      toast.error(`测试失败: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!credName.trim()) {
      toast.warning('请输入凭据名称');
      return;
    }

    let config: any = {};
    if (credType === 'dns_cloudflare') {
      config = { apiToken: cfApiToken, authEmail: cfAuthEmail, authKey: cfAuthKey };
    } else if (credType === 'dns_aliyun') {
      config = { accessKeyId: aliAccessKeyId, accessKeySecret: aliAccessKeySecret };
    } else if (credType === 'dns_tencent') {
      config = { secretId: txSecretId, secretKey: txSecretKey };
    } else if (credType === 'ssh_host') {
      config = { host: sshHost, port: sshPort, username: sshUsername, password: sshPassword, privateKey: sshPrivateKey };
    } else if (credType === 'bt_panel') {
      config = { apiUrl: btApiUrl, apiKey: btApiKey, ignoreSsl: btIgnoreSsl };
    } else if (credType === 'one_panel') {
      config = { apiUrl: onePanelUrl, apiKey: onePanelApiKey };
    }

    try {
      if (editingCred) {
        await api.updateCredential(editingCred.id, {
          name: credName.trim(),
          type: credType,
          remark: credRemark.trim() || undefined,
          config
        });
        toast.success(`已更新凭据 [${credName.trim()}]`);
      } else {
        await api.createCredential({
          name: credName.trim(),
          type: credType,
          remark: credRemark.trim() || undefined,
          config
        });
        toast.success(`已保存凭据 [${credName.trim()}]`);
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
      message: `确定要删除凭据 [${name}] 吗？删除后使用该凭据的证书自动化任务将无法继续验证或部署。`,
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

  // Filter & Search Logic
  const filteredCredentials = credentials.filter(c => {
    const matchSearch = 
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.remark && c.remark.toLowerCase().includes(search.toLowerCase())) ||
      c.type.toLowerCase().includes(search.toLowerCase());

    if (!matchSearch) return false;

    if (categoryFilter === 'all') return true;
    if (categoryFilter === 'dns') return c.type.startsWith('dns_');
    if (categoryFilter === 'ssh') return c.type === 'ssh_host';
    if (categoryFilter === 'panel') return c.type === 'bt_panel' || c.type === 'one_panel';
    if (categoryFilter === 'other') return !c.type.startsWith('dns_') && c.type !== 'ssh_host' && c.type !== 'bt_panel' && c.type !== 'one_panel';
    return true;
  });

  // Statistics
  const countAll = credentials.length;
  const countDns = credentials.filter(c => c.type.startsWith('dns_')).length;
  const countSsh = credentials.filter(c => c.type === 'ssh_host').length;
  const countPanel = credentials.filter(c => c.type === 'bt_panel' || c.type === 'one_panel').length;
  const countOther = countAll - countDns - countSsh - countPanel;

  // Pagination
  const totalPages = Math.ceil(filteredCredentials.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedCredentials = filteredCredentials.slice(startIndex, startIndex + pageSize);

  // Helper for Credential Brand Meta with Real SVG Logo
  const getCredMeta = (type: CredentialType) => {
    switch (type) {
      case 'dns_cloudflare':
        return {
          label: 'Cloudflare DNS',
          badge: 'bg-orange-50 text-orange-700 dark:bg-orange-950/80 dark:text-orange-300 border-orange-200 dark:border-orange-800/60',
          LogoComponent: CloudflareLogo,
          typeText: 'DNS-01 验证'
        };
      case 'dns_aliyun':
      case 'aliyun_cloud':
        return {
          label: '阿里云 DNS',
          badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
          LogoComponent: AliyunLogo,
          typeText: 'DNS-01 验证'
        };
      case 'dns_tencent':
      case 'tencent_cloud':
        return {
          label: '腾讯云 DNSPod',
          badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
          LogoComponent: TencentCloudLogo,
          typeText: 'DNS-01 验证'
        };
      case 'dns_huawei':
        return {
          label: '华为云 DNS',
          badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
          LogoComponent: HuaweiCloudLogo,
          typeText: 'DNS-01 验证'
        };
      case 'ssh_host':
        return {
          label: 'SSH 远程主机',
          badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
          LogoComponent: SSHHostLogo,
          typeText: '远程部署'
        };
      case 'bt_panel':
        return {
          label: '宝塔面板 (BT Panel)',
          badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
          LogoComponent: BaotaLogo,
          typeText: '面板自动化部署'
        };
      case 'one_panel':
        return {
          label: '1Panel 运维面板',
          badge: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/80 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/60',
          LogoComponent: OnePanelLogo,
          typeText: '容器热载部署'
        };
      default:
        return {
          label: '通用凭据',
          badge: 'bg-purple-50 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200 dark:border-purple-800/60',
          LogoComponent: SSHHostLogo,
          typeText: '扩展服务'
        };
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between space-y-6">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>安全凭据中心 (Credential Vault)</span>
              <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 font-mono">
                {countAll} 凭据
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              所有第三方云平台 API 密钥与主机私钥均经 AES-256-GCM 硬件加密存储
            </p>
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
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all active:scale-95 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>添加安全凭据</span>
            </button>
          </div>
        </div>

        {/* Filter Chips & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-3 rounded-2xl shadow-sm">
          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                categoryFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              全部 ({countAll})
            </button>
            <button
              onClick={() => setCategoryFilter('dns')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                categoryFilter === 'dns'
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>DNS 验证云厂商 ({countDns})</span>
            </button>
            <button
              onClick={() => setCategoryFilter('panel')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                categoryFilter === 'panel'
                  ? 'bg-teal-600 text-white font-bold shadow-sm'
                  : 'text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>宝塔 / 1Panel 面板 ({countPanel})</span>
            </button>
            <button
              onClick={() => setCategoryFilter('ssh')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                categoryFilter === 'ssh'
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>SSH 远程主机 ({countSsh})</span>
            </button>
            {countOther > 0 && (
              <button
                onClick={() => setCategoryFilter('other')}
                className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                  categoryFilter === 'other'
                    ? 'bg-purple-600 text-white font-bold shadow-sm'
                    : 'text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>其它凭据 ({countOther})</span>
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
              placeholder="检索凭据名称、类型或备注..."
              className="w-full pl-9 pr-3.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Credentials Grid (1 row 3-4 compact cards) */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : filteredCredentials.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200">
              {search || categoryFilter !== 'all' ? '未找到匹配的安全凭据' : '暂无安全凭据'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {search || categoryFilter !== 'all' ? '请尝试重置关键词或分类筛选' : '添加 Cloudflare API Token、阿里云 AccessKey 或腾讯云 SecretId，供 DNS-01 验证及多端部署复用。'}
            </p>
            {!search && categoryFilter === 'all' && (
              <button
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>立即添加凭据</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedCredentials.map(c => {
              const meta = getCredMeta(c.type);

              return (
                <div
                  key={c.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-500/40 rounded-2xl p-4 shadow-sm space-y-3 flex flex-col justify-between transition-all hover:shadow-md group"
                >
                  <div className="space-y-3">
                    {/* Header with Authentic Brand SVG Logo */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center p-1.5 shadow-sm shrink-0 mt-0.5">
                        <meta.LogoComponent className="w-6 h-6 object-contain" size={24} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate" title={c.name}>
                          {c.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${meta.badge}`}>
                            {meta.label}
                          </span>
                          {c.remark && (
                            <span className="text-[10px] text-slate-400 truncate max-w-[100px]" title={c.remark}>
                              {c.remark}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Metadata Content */}
                    <div className="space-y-1.5 text-xs pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
                      {c.type === 'dns_cloudflare' && (
                        <div className="flex items-center justify-between">
                          <span>Token 状态:</span>
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">● 已安全加密</span>
                        </div>
                      )}
                      {c.type === 'dns_aliyun' && (
                        <div className="flex items-center justify-between">
                          <span>AccessKey ID:</span>
                          <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                            {c.config?.accessKeyId ? `${c.config.accessKeyId.slice(0, 6)}...` : '已配置'}
                          </span>
                        </div>
                      )}
                      {c.type === 'dns_tencent' && (
                        <div className="flex items-center justify-between">
                          <span>SecretId:</span>
                          <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                            {c.config?.secretId ? `${c.config.secretId.slice(0, 6)}...` : '已配置'}
                          </span>
                        </div>
                      )}
                      {c.type === 'ssh_host' && (
                        <div className="flex items-center justify-between">
                          <span>主机目标:</span>
                          <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                            {c.config?.username}@{c.config?.host}:{c.config?.port || 22}
                          </span>
                        </div>
                      )}
                      {c.type === 'bt_panel' && (
                        <div className="flex items-center justify-between">
                          <span>宝塔地址:</span>
                          <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[140px]" title={c.config?.apiUrl || c.config?.url}>
                            {c.config?.apiUrl || c.config?.url || '已配置'}
                          </span>
                        </div>
                      )}
                      {c.type === 'one_panel' && (
                        <div className="flex items-center justify-between">
                          <span>1Panel 地址:</span>
                          <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[140px]" title={c.config?.apiUrl || c.config?.url}>
                            {c.config?.apiUrl || c.config?.url || '已配置'}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                        <span>加密等级</span>
                        <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                          <ShieldCheck className="w-3 h-3" />
                          <span>AES-256-GCM</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <span className="text-[10px] text-slate-400">{meta.typeText}</span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(c)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="编辑凭据"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        title="删除凭据"
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
      </div>

      {/* Pagination Footer Bar (Always at bottom on PC) */}
      {filteredCredentials.length > 0 && (
        <div className="mt-auto pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm text-xs text-slate-500 dark:text-slate-400">
            <div>
              显示第 {filteredCredentials.length === 0 ? 0 : `${startIndex + 1}-${Math.min(startIndex + pageSize, filteredCredentials.length)}`} 项，共 {filteredCredentials.length} 项
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

      {/* Edit / Add Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-scaleUp max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {editingCred ? `编辑安全凭据 [${editingCred.name}]` : '添加安全凭据'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-rose-500">*</span> 名称
                </label>
                <input
                  type="text"
                  value={credName}
                  onChange={e => setCredName(e.target.value)}
                  placeholder="Cloudflare"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-medium text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-rose-500">*</span> 类型
                </label>
                <select
                  value={credType}
                  onChange={e => {
                    const newType = e.target.value as any;
                    setCredType(newType);
                    if (!editingCred) {
                      if (newType === 'dns_cloudflare') setCredName('Cloudflare');
                      else if (newType === 'dns_aliyun') setCredName('阿里云 DNS');
                      else if (newType === 'dns_tencent') setCredName('腾讯云 DNSPod');
                      else if (newType === 'bt_panel') setCredName('宝塔面板');
                      else if (newType === 'one_panel') setCredName('1Panel 面板');
                      else if (newType === 'ssh_host') setCredName('SSH 主机');
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-medium text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <optgroup label="DNS 验证提供商 (DNS-01)">
                    <option value="dns_cloudflare">Cloudflare</option>
                    <option value="dns_aliyun">阿里云 DNS (AccessKey)</option>
                    <option value="dns_tencent">腾讯云 DNSPod (SecretId/SecretKey)</option>
                  </optgroup>
                  <optgroup label="自动化部署运维面板">
                    <option value="bt_panel">宝塔面板 (BT Panel / aaPanel)</option>
                    <option value="one_panel">1Panel 运维面板 (OpenResty)</option>
                  </optgroup>
                  <optgroup label="远程主机部署">
                    <option value="ssh_host">SSH 远程主机凭据</option>
                  </optgroup>
                </select>
              </div>

              {/* Cloudflare Config (1Panel Style) */}
              {credType === 'dns_cloudflare' && (
                <div className="space-y-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      EMAIL
                    </label>
                    <input
                      type="email"
                      value={cfAuthEmail}
                      onChange={e => setCfAuthEmail(e.target.value)}
                      placeholder="tqd354@gmail.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      <span className="text-rose-500">*</span> API Token
                    </label>
                    <input
                      type="password"
                      value={cfApiToken}
                      onChange={e => setCfApiToken(e.target.value)}
                      placeholder="Cloudflare API 令牌"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      请勿使用 Global API Key（请在 Cloudflare 控制台创建具有 Zone.DNS.Edit 权限的 API 令牌）
                    </p>
                  </div>
                </div>
              )}

              {/* Baota BT Panel Config */}
              {credType === 'bt_panel' && (
                <div className="space-y-3.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">宝塔面板 (BT Panel / aaPanel) API 配置</span>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1 font-bold">
                      <span className="text-rose-500">*</span> 面板访问地址 (URL)
                    </label>
                    <input
                      type="url"
                      value={btApiUrl}
                      onChange={e => setBtApiUrl(e.target.value)}
                      placeholder="http://192.168.1.100:8888"
                      required
                      className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      支持内网/公网 IP 或域名，带端口号（如 http://192.168.1.100:8888 或 https://bt.example.com:8888）
                    </p>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1 font-bold">
                      <span className="text-rose-500">*</span> API 接口密钥 (Token)
                    </label>
                    <input
                      type="password"
                      value={btApiKey}
                      onChange={e => setBtApiKey(e.target.value)}
                      placeholder="32位宝塔接口密钥"
                      required
                      className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      请在宝塔面板【面板设置】➔【API 接口】中开启并获取（<span className="text-amber-500 font-bold">务必将 SSL-Mate 服务器 IP 加入白名单</span>）
                    </p>
                  </div>

                  <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={btIgnoreSsl}
                      onChange={e => setBtIgnoreSsl(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-slate-600 dark:text-slate-400 text-xs">忽略自签名 HTTPS 证书验证 (自签证书面板建议勾选)</span>
                  </label>
                </div>
              )}

              {/* 1Panel Config */}
              {credType === 'one_panel' && (
                <div className="space-y-3.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">1Panel 运维面板 API 配置</span>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1 font-bold">
                      <span className="text-rose-500">*</span> 1Panel 面板访问地址 (URL)
                    </label>
                    <input
                      type="url"
                      value={onePanelUrl}
                      onChange={e => setOnePanelUrl(e.target.value)}
                      placeholder="http://192.168.1.100:10000"
                      required
                      className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1 font-bold">
                      <span className="text-rose-500">*</span> API Key
                    </label>
                    <input
                      type="password"
                      value={onePanelApiKey}
                      onChange={e => setOnePanelApiKey(e.target.value)}
                      placeholder="1Panel API 密钥"
                      required
                      className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      请在 1Panel【面板设置】➔【API 接口】中生成并获取 API Key
                    </p>
                  </div>
                </div>
              )}

              {/* Aliyun Config */}
              {credType === 'dns_aliyun' && (
                <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">阿里云 RAM AccessKey 配置</span>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">AccessKey ID</label>
                    <input
                      type="text"
                      value={aliAccessKeyId}
                      onChange={e => setAliAccessKeyId(e.target.value)}
                      placeholder="LTAI..."
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">AccessKey Secret</label>
                    <input
                      type="password"
                      value={aliAccessKeySecret}
                      onChange={e => setAliAccessKeySecret(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Tencent Config */}
              {credType === 'dns_tencent' && (
                <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">腾讯云 DNSPod API 配置</span>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">SecretId</label>
                    <input
                      type="text"
                      value={txSecretId}
                      onChange={e => setTxSecretId(e.target.value)}
                      placeholder="AKID..."
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">SecretKey</label>
                    <input
                      type="password"
                      value={txSecretKey}
                      onChange={e => setTxSecretKey(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* SSH Host Config */}
              {credType === 'ssh_host' && (
                <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">SSH 主机连接配置</span>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-slate-600 dark:text-slate-400 mb-1">主机 IP / 域名</label>
                      <input
                        type="text"
                        value={sshHost}
                        onChange={e => setSshHost(e.target.value)}
                        placeholder="192.168.1.100"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 mb-1">SSH 端口</label>
                      <input
                        type="number"
                        value={sshPort}
                        onChange={e => setSshPort(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">登录用户名</label>
                    <input
                      type="text"
                      value={sshUsername}
                      onChange={e => setSshUsername(e.target.value)}
                      placeholder="root"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">密码认证</label>
                    <input
                      type="password"
                      value={sshPassword}
                      onChange={e => setSshPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">或 SSH 私钥 (OpenSSH / RSA)</label>
                    <textarea
                      rows={3}
                      value={sshPrivateKey}
                      onChange={e => setSshPrivateKey(e.target.value)}
                      placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[11px]"
                    />
                  </div>
                </div>
              )}

              {/* Test button & result */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="w-full py-2.5 rounded-xl border border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition-colors flex items-center justify-center gap-2"
                >
                  <Zap className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
                  <span>{testing ? '正在测试连通性...' : '测试连通性'}</span>
                </button>

                {testResult && (
                  <div className={`mt-2 p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                    testResult.success 
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  }`}>
                    {testResult.success ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>{testResult.message}</span>
                  </div>
                )}
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
                {editingCred ? '保存修改' : '确认创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
