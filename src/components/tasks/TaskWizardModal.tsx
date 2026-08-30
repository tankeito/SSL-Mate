import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Check, 
  Server, 
  FolderDown, 
  Cloud, 
  Globe, 
  Send,
  HelpCircle,
  ShieldCheck,
  Zap,
  Activity,
  Layers,
  Bell,
  Clock,
  Radio,
  CheckCircle2
} from 'lucide-react';
import { CertTask, AcmeAccount, Credential, DeployTarget, DeployTargetType, NotifyChannel } from '../../types';
import { api } from '../../api/client';
import { BaotaLogo, OnePanelLogo } from '../common/BrandIcons';

interface TaskWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (taskId?: string, runNow?: boolean) => void;
  initialTask?: CertTask | null;
}

export const TaskWizardModal: React.FC<TaskWizardModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialTask
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // External data
  const [acmeAccounts, setAcmeAccounts] = useState<AcmeAccount[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [notifyChannels, setNotifyChannels] = useState<NotifyChannel[]>([]);

  // Form State
  const [taskName, setTaskName] = useState('');
  const [domainsInput, setDomainsInput] = useState('');
  const [acmeAccountId, setAcmeAccountId] = useState('');
  const [dnsCredentialId, setDnsCredentialId] = useState('');
  const [validationType, setValidationType] = useState<'dns-01' | 'http-01'>('dns-01');
  const [keyType, setKeyType] = useState<'ec256' | 'ec384' | 'rsa2048' | 'rsa4096'>('ec256');

  // Deploy Targets
  const [deployTargets, setDeployTargets] = useState<DeployTarget[]>([]);

  // Auto-renew & Notification
  const [autoRenew, setAutoRenew] = useState(true);
  const [renewDaysBefore, setRenewDaysBefore] = useState(30);
  const [cronExpr, setCronExpr] = useState('0 2 * * *');
  const [selectedNotifyChannels, setSelectedNotifyChannels] = useState<string[]>([]);
  const [runImmediately, setRunImmediately] = useState(true);

  // Load supporting data on mount
  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen, initialTask]);

  const loadInitialData = async () => {
    try {
      const [accs, creds, notifs] = await Promise.all([
        api.getAcmeAccounts(),
        api.getCredentials(),
        api.getChannels()
      ]);
      setAcmeAccounts(accs);
      setCredentials(creds);
      setNotifyChannels(notifs);

      if (initialTask) {
        setTaskName(initialTask.name);
        setDomainsInput(initialTask.domains.join('\n'));
        setAcmeAccountId(initialTask.acmeAccountId);
        setDnsCredentialId(initialTask.dnsCredentialId || '');
        setValidationType(initialTask.validationType || 'dns-01');
        setKeyType(initialTask.keyType || 'ec256');
        setDeployTargets(initialTask.deployTargets || []);
        setAutoRenew(initialTask.autoRenew);
        setRenewDaysBefore(initialTask.renewDaysBefore || 30);
        setCronExpr(initialTask.cronExpr || '0 2 * * *');
        setSelectedNotifyChannels(initialTask.notifyChannelIds || []);
      } else {
        // Reset defaults
        setTaskName('');
        setDomainsInput('');
        const defaultAcme = accs.find(a => a.isDefault) || accs[0];
        if (defaultAcme) setAcmeAccountId(defaultAcme.id);
        const defaultDns = creds.find(c => c.type.startsWith('dns_'));
        if (defaultDns) setDnsCredentialId(defaultDns.id);
        setDeployTargets([]);
        setAutoRenew(true);
        setRenewDaysBefore(30);
        setCronExpr('0 2 * * *');
        setSelectedNotifyChannels([]);
        setStep(1);
      }
    } catch (err) {
      console.error('Failed to load wizard initial data:', err);
    }
  };

  if (!isOpen) return null;

  const dnsCredentials = credentials.filter(c => c.type.startsWith('dns_'));
  const sshCredentials = credentials.filter(c => c.type === 'ssh_host');

  const addDeployTarget = (type: DeployTargetType) => {
    const newTarget: DeployTarget = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      name: type === 'local_file' ? '本地文件目录' :
            type === 'ssh' ? '远程 SSH 主机' :
            type === 'bt_panel' ? '宝塔面板站点' :
            type === 'one_panel' ? '1Panel 网站' :
            type === 'aliyun_cdn' ? '阿里云 CDN/HTTPS' :
            type === 'cloudflare' ? 'Cloudflare Custom SSL' :
            type === 'webhook' ? '通用 Webhook' : '自定义目标',
      enabled: true,
      config: {
        targetPath: type === 'ssh' ? '/etc/nginx/ssl' : '/etc/ssl/certs',
        certFileName: 'cert.pem',
        keyFileName: 'privkey.pem',
        fullchainFileName: 'fullchain.pem',
        reloadCommand: 'nginx -s reload',
        siteName: ''
      }
    };
    setDeployTargets([...deployTargets, newTarget]);
  };

  const removeDeployTarget = (id: string) => {
    setDeployTargets(deployTargets.filter(t => t.id !== id));
  };

  const updateDeployTarget = (id: string, updates: Partial<DeployTarget>) => {
    setDeployTargets(deployTargets.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const updateDeployTargetConfig = (id: string, configUpdates: Record<string, any>) => {
    setDeployTargets(deployTargets.map(t => t.id === id ? { ...t, config: { ...t.config, ...configUpdates } } : t));
  };

  const parsedDomains = domainsInput
    .split(/[\n,;\s]+/)
    .map(d => d.trim().toLowerCase())
    .filter(Boolean);

  const handleSave = async () => {
    if (!taskName.trim()) {
      setError('请输入任务名称');
      setStep(1);
      return;
    }

    if (parsedDomains.length === 0) {
      setError('请至少填写一个主域名');
      setStep(1);
      return;
    }

    if (!acmeAccountId) {
      setError('请选择 ACME CA 账户');
      setStep(1);
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      name: taskName.trim(),
      domains: parsedDomains,
      acmeAccountId,
      dnsCredentialId: dnsCredentialId || undefined,
      validationType,
      keyType,
      deployTargets,
      autoRenew,
      renewDaysBefore: Number(renewDaysBefore) || 30,
      cronExpr,
      notifyChannelIds: selectedNotifyChannels
    };

    try {
      let savedTask: CertTask;
      if (initialTask) {
        savedTask = await api.updateTask(initialTask.id, payload);
      } else {
        savedTask = await api.createTask(payload);
      }

      if (runImmediately) {
        await api.runTask(savedTask.id);
        onSuccess(savedTask.id, true);
      } else {
        onSuccess(savedTask.id, false);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || '保存任务失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl p-6 space-y-6 shadow-2xl animate-scaleUp max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {initialTask ? '编辑证书任务流水线' : '创建自动化证书任务 (3-Step Wizard)'}
              </h3>
              <p className="text-xs text-slate-400">一键配置 ACME 签发、多目标部署与 7x24h 自动续期</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Steps Indicator */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { num: 1, title: '1. 域名与 CA 策略', sub: '域名与 DNS-01 验证' },
            { num: 2, title: '2. 多目标并行部署', sub: '宝塔/1Panel/SSH/CDN' },
            { num: 3, title: '3. 续期与告警', sub: '自动守护与通道通知' }
          ].map(s => (
            <div
              key={s.num}
              onClick={() => setStep(s.num as any)}
              className={`cursor-pointer p-3 rounded-2xl border transition-all text-left ${
                step === s.num
                  ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 shadow-sm'
                  : step > s.num
                    ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/20 text-emerald-600 dark:text-emerald-400'
                    : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:border-slate-300'
              }`}
            >
              <div className="font-bold text-xs flex items-center gap-1.5">
                {step > s.num ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : null}
                <span>{s.title}</span>
              </div>
              <p className="text-[11px] opacity-70 truncate mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <X className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP CONTENT */}
        <div className="space-y-4">
          {/* STEP 1: Domains & ACME */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  任务名称 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={taskName}
                  onChange={e => setTaskName(e.target.value)}
                  placeholder="例如: 我的主站 SSL 自动化签发"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  申请域名 (Domains) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={domainsInput}
                  onChange={e => setDomainsInput(e.target.value)}
                  placeholder="example.com&#10;*.example.com&#10;api.example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  支持多域名证书与通配符泛域名 (如 *.ap1x.xyz)，每行一个域名或逗号隔开
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ACME CA 权威机构 <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={acmeAccountId}
                    onChange={e => setAcmeAccountId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    {acmeAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} {acc.isDefault ? '(系统默认)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    DNS 云厂商 API 凭据 <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={dnsCredentialId}
                    onChange={e => setDnsCredentialId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    <option value="">-- 请选择已保存的 DNS API 凭据 --</option>
                    {dnsCredentials.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type.replace('dns_', '').toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  私钥加密算法 (Key Algorithm)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: 'ec256', label: 'ECC P-256' },
                    { id: 'ec384', label: 'ECC P-384' },
                    { id: 'rsa2048', label: 'RSA 2048' },
                    { id: 'rsa4096', label: 'RSA 4096' }
                  ].map(k => (
                    <button
                      type="button"
                      key={k.id}
                      onClick={() => setKeyType(k.id as any)}
                      className={`p-2.5 rounded-xl text-center border transition-all ${
                        keyType === k.id
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold text-xs font-mono">{k.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Deploy Targets */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">部署目标节点配置</h4>
                  <p className="text-xs text-slate-400">证书签发成功后，自动并行分发至以下节点并执行平滑重载</p>
                </div>

                {/* Add Target Buttons */}
                <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap shrink-0">
                  <button
                    type="button"
                    onClick={() => addDeployTarget('bt_panel')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 transition-all shrink-0 whitespace-nowrap"
                  >
                    <BaotaLogo className="w-3.5 h-3.5" size={14} />
                    <span>+ 宝塔面板</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addDeployTarget('one_panel')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 hover:bg-cyan-100 text-xs font-bold text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60 transition-all shrink-0 whitespace-nowrap"
                  >
                    <OnePanelLogo className="w-3.5 h-3.5" size={14} />
                    <span>+ 1Panel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addDeployTarget('ssh')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 transition-all shrink-0 whitespace-nowrap"
                  >
                    <Server className="w-3.5 h-3.5 text-blue-600" />
                    <span>+ SSH 主机</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addDeployTarget('local_file')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all shrink-0 whitespace-nowrap"
                  >
                    <FolderDown className="w-3.5 h-3.5 text-emerald-600" />
                    <span>+ 本地目录</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addDeployTarget('aliyun_cdn')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-amber-600 transition-all shrink-0 whitespace-nowrap"
                  >
                    <Cloud className="w-3.5 h-3.5 text-amber-600" />
                    <span>+ CDN</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addDeployTarget('webhook')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-purple-600 transition-all shrink-0 whitespace-nowrap"
                  >
                    <Send className="w-3.5 h-3.5 text-purple-600" />
                    <span>+ Webhook</span>
                  </button>
                </div>
              </div>

              {/* Targets List */}
              <div className="space-y-3">
                {deployTargets.map(target => (
                  <div key={target.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 uppercase">
                          {target.type}
                        </span>
                        <input
                          type="text"
                          value={target.name}
                          onChange={e => updateDeployTarget(target.id, { name: e.target.value })}
                          className="text-xs sm:text-sm font-semibold bg-transparent border-b border-dashed border-slate-300 dark:border-slate-600 focus:outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeDeployTarget(target.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Baota BT Panel Config Form */}
                    {target.type === 'bt_panel' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-slate-500 mb-1 font-bold">选择宝塔面板凭据</label>
                          <select
                            value={target.credentialId || ''}
                            onChange={e => updateDeployTarget(target.id, { credentialId: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-xs"
                          >
                            <option value="">-- 选择宝塔面板凭据 --</option>
                            {credentials.filter(c => c.type === 'bt_panel').map(c => (
                              <option key={c.id} value={c.id}>{c.name} ({c.config?.apiUrl || c.config?.url})</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1 font-bold">
                            宝塔目标站点名称 (多站逗号隔开)
                          </label>
                          <input
                            type="text"
                            value={target.config.siteName || ''}
                            onChange={e => updateDeployTargetConfig(target.id, { siteName: e.target.value })}
                            placeholder="如: gemini.ap1x.xyz, api.ap1x.xyz"
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs"
                          />
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            泛域名证书可填写多个站点，自动批量绑定并执行 Nginx 平滑热重载
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 1Panel Config Form */}
                    {target.type === 'one_panel' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-slate-500 mb-1 font-bold">选择 1Panel 凭据</label>
                          <select
                            value={target.credentialId || ''}
                            onChange={e => updateDeployTarget(target.id, { credentialId: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-xs"
                          >
                            <option value="">-- 选择 1Panel 凭据 --</option>
                            {credentials.filter(c => c.type === 'one_panel').map(c => (
                              <option key={c.id} value={c.id}>{c.name} ({c.config?.apiUrl || c.config?.url})</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1 font-bold">1Panel 目标网站名称/域名</label>
                          <input
                            type="text"
                            value={target.config.siteName || ''}
                            onChange={e => updateDeployTargetConfig(target.id, { siteName: e.target.value })}
                            placeholder="如: gemini.ap1x.xyz"
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {/* Config details according to type */}
                    {target.type === 'local_file' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-slate-500 mb-1">本地目标路径</label>
                          <input
                            type="text"
                            value={target.config.targetPath || ''}
                            onChange={e => updateDeployTargetConfig(target.id, { targetPath: e.target.value })}
                            placeholder="/etc/nginx/ssl"
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1">重载命令 (可选)</label>
                          <input
                            type="text"
                            value={target.config.reloadCommand || ''}
                            onChange={e => updateDeployTargetConfig(target.id, { reloadCommand: e.target.value })}
                            placeholder="systemctl reload nginx"
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {target.type === 'ssh' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="block text-slate-500 mb-1">选择 SSH 主机凭据</label>
                          <select
                            value={target.credentialId || ''}
                            onChange={e => updateDeployTarget(target.id, { credentialId: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-xs"
                          >
                            <option value="">-- 请选择 SSH 凭据 --</option>
                            {sshCredentials.map(s => (
                              <option key={s.id} value={s.id}>{s.name} ({s.config.host})</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1">远程目录</label>
                          <input
                            type="text"
                            value={target.config.targetPath || '/etc/nginx/ssl'}
                            onChange={e => updateDeployTargetConfig(target.id, { targetPath: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1">远程重载命令</label>
                          <input
                            type="text"
                            value={target.config.reloadCommand || 'nginx -s reload'}
                            onChange={e => updateDeployTargetConfig(target.id, { reloadCommand: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {target.type === 'aliyun_cdn' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-slate-500 mb-1">阿里云 API 凭据</label>
                          <select
                            value={target.credentialId || ''}
                            onChange={e => updateDeployTarget(target.id, { credentialId: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-xs"
                          >
                            <option value="">-- 选择阿里云凭据 --</option>
                            {credentials.filter(c => c.type === 'aliyun_cloud' || c.type === 'dns_aliyun').map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1">CDN 加速域名</label>
                          <input
                            type="text"
                            value={target.config.domain || ''}
                            onChange={e => updateDeployTargetConfig(target.id, { domain: e.target.value })}
                            placeholder="cdn.example.com"
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {target.type === 'webhook' && (
                      <div className="space-y-2 text-xs">
                        <div>
                          <label className="block text-slate-500 mb-1">Webhook 推送 URL</label>
                          <input
                            type="text"
                            value={target.config.webhookUrl || ''}
                            onChange={e => updateDeployTargetConfig(target.id, { webhookUrl: e.target.value })}
                            placeholder="https://api.example.com/webhooks/ssl"
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: Auto-renew & Notification */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      <span>自动化续期策略 (7x24h 守护)</span>
                    </h4>
                    <p className="text-xs text-slate-400">守护进程每日自动巡检并在证书即将到期前静默轮换续发</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoRenew}
                      onChange={e => setAutoRenew(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {autoRenew && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200/80 dark:border-slate-700/80">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        提前触发天数 (天)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={renewDaysBefore}
                        onChange={e => setRenewDaysBefore(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-mono font-bold text-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        检测 Cron 表达式 (默认每日凌晨 2:00)
                      </label>
                      <input
                        type="text"
                        value={cronExpr}
                        onChange={e => setCronExpr(e.target.value)}
                        placeholder="0 2 * * *"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Notification channels picker */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-emerald-600" />
                    <span>异常与续期告警即时通知</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">支持钉钉 · 飞书 · 企微 · Webhook</span>
                </div>

                {notifyChannels.length === 0 ? (
                  <p className="text-xs text-slate-400 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                    暂未配置告警通道，可前往【告警通道】添加钉钉/飞书/企业微信机器人或 Webhook。
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {notifyChannels.map(channel => {
                      const isSelected = selectedNotifyChannels.includes(channel.id);
                      return (
                        <button
                          type="button"
                          key={channel.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedNotifyChannels(selectedNotifyChannels.filter(id => id !== channel.id));
                            } else {
                              setSelectedNotifyChannels([...selectedNotifyChannels, channel.id]);
                            }
                          }}
                          className={`p-3 rounded-2xl border text-left text-xs transition-all ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold ring-2 ring-emerald-500/20'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold truncate">{channel.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                          </div>
                          <span className="text-[10px] text-slate-400 uppercase block mt-1">{channel.type}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Immediate execution checkbox */}
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="runImmediately"
                  checked={runImmediately}
                  onChange={e => setRunImmediately(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="runImmediately" className="text-xs text-emerald-800 dark:text-emerald-300 cursor-pointer select-none">
                  <strong className="font-bold">立即触发首次证书申请与部署</strong>（保存后即刻在后台执行 ACME 自动化签发流水线）
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((step - 1) as any)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>上一步</span>
            </button>
          ) : <div></div>}

          <div className="flex gap-2.5">
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((step + 1) as any)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all active:scale-95"
              >
                <span>下一步</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{loading ? '正在保存与启动...' : initialTask ? '保存更改' : '完成并创建任务'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
