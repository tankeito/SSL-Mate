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
  HelpCircle
} from 'lucide-react';
import { CertTask, AcmeAccount, Credential, DeployTarget, DeployTargetType, NotifyChannel } from '../../types';
import { api } from '../../api/client';

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
        setSelectedNotifyChannels(notifs.filter(n => n.isEnabled).map(n => n.id));
      }
      setStep(1);
      setError(null);
    } catch (err) {
      console.error('Failed to load modal data:', err);
    }
  };

  if (!isOpen) return null;

  const dnsCredentials = credentials.filter(c => c.type.startsWith('dns_'));
  const sshCredentials = credentials.filter(c => c.type === 'ssh_host');
  const cloudCredentials = credentials.filter(c => c.type === 'aliyun_cloud' || c.type === 'tencent_cloud' || c.type === 'cloudflare_zone');

  const addDeployTarget = (type: DeployTargetType) => {
    const newTarget: DeployTarget = {
      id: `target_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      name: type === 'local_file' ? '本地文件目录' :
            type === 'ssh' ? '远程 SSH 主机' :
            type === 'aliyun_cdn' ? '阿里云 CDN/HTTPS' :
            type === 'cloudflare' ? 'Cloudflare Custom SSL' :
            type === 'bt_panel' ? '宝塔面板站点' : '通用 Webhook',
      enabled: true,
      config: {
        targetPath: type === 'ssh' ? '/etc/nginx/ssl' : '/etc/ssl/certs',
        certFileName: 'cert.pem',
        keyFileName: 'privkey.pem',
        fullchainFileName: 'fullchain.pem',
        reloadCommand: 'nginx -s reload'
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

  const handleSave = async () => {
    const domains = domainsInput
      .split(/[\n,;\s]+/)
      .map(d => d.trim().toLowerCase())
      .filter(Boolean);

    if (!taskName.trim()) {
      setError('请输入任务名称');
      setStep(1);
      return;
    }

    if (domains.length === 0) {
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
      domains,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {initialTask ? '编辑证书自动化任务' : '创建自动化证书任务 (3-Step Wizard)'}
              </h3>
              <p className="text-xs text-slate-400">无脑配置 · 告别复杂连线</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Bar */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          {[
            { num: 1, label: '1. 域名与 CA 申请' },
            { num: 2, label: '2. 部署目标分发' },
            { num: 3, label: '3. 续期策略与通知' }
          ].map(s => (
            <button
              key={s.num}
              onClick={() => setStep(s.num as any)}
              className={`flex items-center gap-2 text-xs font-bold transition-colors ${
                step === s.num
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : step > s.num
                    ? 'text-slate-800 dark:text-slate-200'
                    : 'text-slate-400'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                step === s.num
                  ? 'bg-emerald-600 text-white'
                  : step > s.num
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600'
              }`}>
                {step > s.num ? <Check className="w-3 h-3" /> : s.num}
              </span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        {/* Error alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* STEP 1: Domain & ACME */}
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
                  placeholder="例如: 官网主站证书 / API 泛域名证书"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  域名列表 (一行一个，支持泛域名 *.example.com) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={domainsInput}
                  onChange={e => setDomainsInput(e.target.value)}
                  placeholder="example.com&#10;*.example.com&#10;api.example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">自动识别泛域名与多 SAN 域名合并签发在一张证书内</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ACME CA 机构 <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={acmeAccountId}
                    onChange={e => setAcmeAccountId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {acmeAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.caProvider})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    DNS 云厂商凭据 (DNS-01 自动化验证) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={dnsCredentialId}
                    onChange={e => setDnsCredentialId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- 请选择已保存的 DNS API 凭据 --</option>
                    {dnsCredentials.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type.replace('dns_', '').toUpperCase()})
                      </option>
                    ))}
                  </select>
                  {dnsCredentials.length === 0 && (
                    <p className="text-[11px] text-amber-500 mt-1">⚠️ 尚未添加 DNS 凭据，请先在【凭据中心】添加 Cloudflare/阿里云/腾讯云 API</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  私钥加密算法
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'ec256', label: 'ECC P-256 (推荐)' },
                    { id: 'ec384', label: 'ECC P-384' },
                    { id: 'rsa2048', label: 'RSA 2048' },
                    { id: 'rsa4096', label: 'RSA 4096' }
                  ].map(k => (
                    <button
                      type="button"
                      key={k.id}
                      onClick={() => setKeyType(k.id as any)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                        keyType === k.id
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Deploy Targets */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">部署目标配置</h4>
                  <p className="text-xs text-slate-400">证书签发成功后，自动并行分发至以下配置的目标节点</p>
                </div>

                {/* Add Target Dropdown */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => addDeployTarget('local_file')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    <FolderDown className="w-3.5 h-3.5" />
                    <span>+ 本地目录</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addDeployTarget('ssh')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    <Server className="w-3.5 h-3.5" />
                    <span>+ SSH 主机</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addDeployTarget('aliyun_cdn')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>+ 阿里云CDN</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addDeployTarget('webhook')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>+ Webhook</span>
                  </button>
                </div>
              </div>

              {/* Targets List */}
              {deployTargets.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center">
                  <p className="text-sm text-slate-500 dark:text-slate-400">尚未添加任何部署目标</p>
                  <p className="text-xs text-slate-400 mt-1">（如果仅需生成证书并在平台内下载，可跳过此步）</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {deployTargets.map(target => (
                    <div key={target.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                            {target.type.toUpperCase()}
                          </span>
                          <input
                            type="text"
                            value={target.name}
                            onChange={e => updateDeployTarget(target.id, { name: e.target.value })}
                            className="text-sm font-semibold bg-transparent border-b border-dashed border-slate-300 dark:border-slate-600 focus:outline-none"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => removeDeployTarget(target.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

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
                              className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 mb-1">写入后重载命令 (可选)</label>
                            <input
                              type="text"
                              value={target.config.reloadCommand || ''}
                              onChange={e => updateDeployTargetConfig(target.id, { reloadCommand: e.target.value })}
                              placeholder="systemctl reload nginx"
                              className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
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
                              className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
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
                              className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 mb-1">远程重载命令</label>
                            <input
                              type="text"
                              value={target.config.reloadCommand || 'nginx -s reload'}
                              onChange={e => updateDeployTargetConfig(target.id, { reloadCommand: e.target.value })}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
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
                              className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
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
                              className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                            />
                          </div>
                        </div>
                      )}

                      {target.type === 'webhook' && (
                        <div className="space-y-2 text-xs">
                          <div>
                            <label className="block text-slate-500 mb-1">Webhook URL</label>
                            <input
                              type="text"
                              value={target.config.webhookUrl || ''}
                              onChange={e => updateDeployTargetConfig(target.id, { webhookUrl: e.target.value })}
                              placeholder="https://api.example.com/webhooks/ssl"
                              className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Auto-renew & Notification */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">自动化续期开关</h4>
                    <p className="text-xs text-slate-400">守护进程每日自动检测证书有效期并在阈值前自动续发</p>
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
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        检测 Cron 表达式
                      </label>
                      <input
                        type="text"
                        value={cronExpr}
                        onChange={e => setCronExpr(e.target.value)}
                        placeholder="0 2 * * *"
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Notification channels picker */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">异常与续期告警通道</h4>
                {notifyChannels.length === 0 ? (
                  <p className="text-xs text-slate-400">暂未配置告警通道，可前往【告警通道】添加钉钉/飞书/企微机器人</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                          className={`p-3 rounded-xl border text-left text-xs transition-all ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold">{channel.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                          </div>
                          <span className="text-[10px] text-slate-400 uppercase">{channel.type}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Immediate execution checkbox */}
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="runImmediately"
                  checked={runImmediately}
                  onChange={e => setRunImmediately(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <label htmlFor="runImmediately" className="text-xs text-emerald-800 dark:text-emerald-300 cursor-pointer">
                  <strong className="font-bold">立即触发首次证书申请与部署</strong>（保存后即刻在后台执行 ACME 申请）
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>上一步</span>
            </button>
          ) : <div></div>}

          <div className="flex gap-2">
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((step + 1) as any)}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md transition-all active:scale-95"
              >
                <span>下一步</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
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
