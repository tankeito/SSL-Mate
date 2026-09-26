import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Key, 
  Lock, 
  ShieldCheck, 
  Save, 
  Zap, 
  Check, 
  AlertCircle, 
  ExternalLink,
  RefreshCw,
  Download,
  Upload,
  Database,
  Archive
} from 'lucide-react';
import { SystemSettings } from '../../types';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';

export const SettingsView: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { toast } = useModal();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Backup & Disaster Recovery (REC-06)
  const [backupPassword, setBackupPassword] = useState('');
  const [restorePassword, setRestorePassword] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [backupNotice, setBackupNotice] = useState<{ success: boolean; message: string } | null>(null);

  // Local admin password form
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState<{ success: boolean; message: string } | null>(null);

  const fetchSettings = async () => {
    try {
      const data = await api.getSettings();
      setSettings(data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      await api.updateSettings(settings);
      setSaveSuccess(true);
      toast.success('全局设置已成功保存并即时生效');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      toast.error(`保存失败: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwdMsg({ success: false, message: '两次输入的新密码不一致' });
      return;
    }

    try {
      const res = await api.changePassword({ oldPassword, newPassword });
      setPwdMsg({ success: true, message: res.message || '密码修改成功' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwdMsg({ success: false, message: err.message || '修改密码失败' });
    }
  };

  const handleExportBackup = async () => {
    setIsBackingUp(true);
    setBackupNotice(null);
    try {
      const data = await api.exportBackup(backupPassword);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sslmate-backup-${new Date().toISOString().slice(0, 10)}${data.isEncrypted ? '-encrypted' : ''}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupNotice({ success: true, message: `✅ 灾备归档包已成功导出下载！包含 ${data.stats?.tasks || 0} 个任务、${data.stats?.credentials || 0} 个凭据。` });
      toast.success('全量灾备包已成功生成并下载');
    } catch (err: any) {
      setBackupNotice({ success: false, message: `灾备导出失败: ${err.message}` });
      toast.error(err.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!restoreFile) {
      toast.warning('请先选择备份文件 (.json)');
      return;
    }

    setIsRestoring(true);
    setBackupNotice(null);
    try {
      const fileText = await restoreFile.text();
      const res = await api.restoreBackup(fileText, restorePassword);
      setBackupNotice({ success: true, message: `✅ 数据恢复成功！还原了 ${res.stats?.tasks || 0} 个任务、${res.stats?.credentials || 0} 个凭据。` });
      toast.success('全量灾备数据已成功还原');
      fetchSettings();
    } catch (err: any) {
      setBackupNotice({ success: false, message: `还原失败: ${err.message}` });
      toast.error(err.message);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCreateSnapshot = async () => {
    try {
      const res = await api.createSnapshot('manual-snapshot');
      toast.success(`本地即时快照已创建: ${res.filename}`);
    } catch (err: any) {
      toast.error(`创建快照失败: ${err.message}`);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">系统设置与 AuthMate SSO</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">配置全局自动化续期守护进程参数及 AuthMate OIDC 单点登录</p>
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-200 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            只读提示：当前登录角色为【{user?.role === 'operator' ? '运维操作员' : '只读审计员'}】，全局核心运维规则与 SSO 鉴权信息仅供查阅。配置变更仅限系统管理员 (Admin) 授权操作。
          </span>
        </div>
      )}

      {/* AuthMate OIDC SSO Integration Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">AuthMate OIDC SSO 单点登录对接</h3>
              <p className="text-xs text-slate-400">基于 OIDC / OAuth2 + PKCE S256 标准单点登录协议深度联动</p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.authmate.enabled}
              onChange={e => setSettings({
                ...settings,
                authmate: { ...settings.authmate, enabled: e.target.checked }
              })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              AuthMate IdP 身份服务器地址 (Issuer URL)
            </label>
            <input
              type="text"
              value={settings.authmate.issuerUrl}
              onChange={e => setSettings({
                ...settings,
                authmate: { ...settings.authmate, issuerUrl: e.target.value }
              })}
              placeholder="http://127.0.0.1:8787 或 https://auth.yourdomain.com"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              客户端 Client ID
            </label>
            <input
              type="text"
              value={settings.authmate.clientId}
              onChange={e => setSettings({
                ...settings,
                authmate: { ...settings.authmate, clientId: e.target.value }
              })}
              placeholder="sslmate-app"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              客户端 Client Secret
            </label>
            <input
              type="password"
              value={settings.authmate.clientSecret}
              onChange={e => setSettings({
                ...settings,
                authmate: { ...settings.authmate, clientSecret: e.target.value }
              })}
              placeholder="••••••••"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              OAuth 回调地址 (Redirect URI)
            </label>
            <input
              type="text"
              value={settings.authmate.redirectUri}
              onChange={e => setSettings({
                ...settings,
                authmate: { ...settings.authmate, redirectUri: e.target.value }
              })}
              placeholder="例如: http://localhost:5173/oauth/callback 或 https://ssl.yourdomain.com/oauth/callback"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono"
            />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 text-xs text-blue-800 dark:text-blue-300 space-y-1">
          <p className="font-bold">💡 AuthMate 双轨登录机制说明：</p>
          <p>开启 SSO 后，登录界面将默认优先展示【使用 AuthMate 一键登录】按钮。同时保留“本地灾备管理员登录”入口，确保在外部 SSO 离线时系统依然可控。</p>
        </div>
      </div>

      {/* Global Scheduler & Engine Config */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">全局自动续期与引擎参数策略</h3>
            <p className="text-xs text-slate-400">配置全局证书扫描周期、临期预警窗口、并发调度池及权威 DNS 预检池</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">默认提前续期天数 (天)</label>
            <input
              type="number"
              value={settings.defaultRenewDaysBefore}
              onChange={e => setSettings({
                ...settings,
                defaultRenewDaysBefore: Number(e.target.value)
              })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">默认临期预警通知阈值 (天)</label>
            <input
              type="number"
              value={settings.defaultAlertDaysBefore || 7}
              onChange={e => setSettings({
                ...settings,
                defaultAlertDaysBefore: Number(e.target.value)
              })}
              placeholder="默认: 7 天"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">全局巡检 Cron 表达式</label>
            <input
              type="text"
              value={settings.globalRenewCheckCron}
              onChange={e => setSettings({
                ...settings,
                globalRenewCheckCron: e.target.value
              })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">ACME 签发最大并发数</label>
            <input
              type="number"
              min="1"
              max="10"
              value={settings.acmeConcurrency || 3}
              onChange={e => setSettings({
                ...settings,
                acmeConcurrency: Number(e.target.value)
              })}
              placeholder="默认: 3"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">探针探测并发工作池大小 (Workers)</label>
            <input
              type="number"
              min="2"
              max="20"
              value={settings.monitorConcurrency || 6}
              onChange={e => setSettings({
                ...settings,
                monitorConcurrency: Number(e.target.value)
              })}
              placeholder="默认: 6"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">自定义权威 DNS / DoH 端点 (可选)</label>
            <input
              type="text"
              value={settings.dnsResolverUrl || ''}
              onChange={e => setSettings({
                ...settings,
                dnsResolverUrl: e.target.value
              })}
              placeholder="留空则自动选用 (阿里/腾讯/Cloudflare/Google) 冗余探测池"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono text-[11px]"
            />
          </div>
        </div>
      </div>

      {/* Save Settings Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        {saveSuccess ? (
          <div className="text-xs px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            <span>设置已成功保存并即时生效</span>
          </div>
        ) : <div className="hidden sm:block"></div>}

        <button
          onClick={handleSaveSettings}
          disabled={saving || !isAdmin}
          className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            isAdmin
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
          }`}
          title={!isAdmin ? '仅系统管理员允许保存设置' : undefined}
        >
          <Save className="w-4 h-4" />
          <span>{saving ? '保存中...' : !isAdmin ? '仅管理员允许修改全局设置' : '保存全局设置'}</span>
        </button>
      </div>

      {/* Disaster Recovery & Encrypted Backup Panel (REC-06) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">系统全量加密灾备与归档恢复 (REC-06)</h3>
              <p className="text-xs text-slate-400">支持基于 PBKDF2-SHA512 + AES-256-GCM 硬件级密文一键打包导出与无损热还原</p>
            </div>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={handleCreateSnapshot}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all active:scale-95"
            >
              <Database className="w-3.5 h-3.5" />
              <span>创建即时本地快照</span>
            </button>
          )}
        </div>

        {backupNotice && (
          <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            backupNotice.success ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
          }`}>
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{backupNotice.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Export Box */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <Download className="w-4 h-4 text-emerald-600" />
              <span>导出全量系统灾备包</span>
            </div>
            <p className="text-[11px] text-slate-400">
              包含全量账号、任务、加密凭据、私钥及监控探针。可选输入专属密码进行强加密保护。
            </p>
            <div>
              <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                加密密码 (可选，建议生产环境配置)
              </label>
              <input
                type="password"
                value={backupPassword}
                onChange={e => setBackupPassword(e.target.value)}
                placeholder="留空则以标准明文 JSON 导出"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs"
              />
            </div>
            <button
              type="button"
              onClick={handleExportBackup}
              disabled={isBackingUp || !isAdmin}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isBackingUp ? '正在打包加密...' : '生成并下载灾备归档 (.json)'}</span>
            </button>
          </div>

          {/* Restore Box */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <Upload className="w-4 h-4 text-blue-600" />
              <span>从灾备包热还原系统</span>
            </div>
            <p className="text-[11px] text-slate-400">
              导入之前已导出的备份文件，自动核验数据完整性哈希，并在应用前自动生成安全快照。
            </p>
            <div>
              <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">选择备份文件 (.json)</label>
              <input
                type="file"
                accept=".json"
                onChange={e => setRestoreFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">解密密码 (若文件已加密)</label>
              <input
                type="password"
                value={restorePassword}
                onChange={e => setRestorePassword(e.target.value)}
                placeholder="若导出时设置了密码请输入"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs"
              />
            </div>
            <button
              type="button"
              onClick={handleRestoreBackup}
              disabled={isRestoring || !isAdmin || !restoreFile}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>{isRestoring ? '正在校验解密并还原...' : '开始校验并执行全量还原'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Break-glass Local Admin Security */}
      {user?.authSource === 'local' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">修改本地灾备管理员密码</h3>
              <p className="text-xs text-slate-400">仅用于在无 SSO 或紧急断网时的本地灾备账号</p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-3 max-w-md text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">当前原密码</label>
              <input
                type="password"
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">新密码</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">确认新密码</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
              />
            </div>

            {pwdMsg && (
              <p className={`text-xs ${pwdMsg.success ? 'text-emerald-600' : 'text-rose-500'}`}>
                {pwdMsg.message}
              </p>
            )}

            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white font-bold text-xs"
            >
              确认更新密码
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
