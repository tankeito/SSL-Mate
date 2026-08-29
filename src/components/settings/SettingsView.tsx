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
  RefreshCw
} from 'lucide-react';
import { SystemSettings } from '../../types';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';

export const SettingsView: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useModal();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
              placeholder="http://localhost:5174/oauth/callback"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono"
            />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 text-xs text-blue-800 dark:text-blue-300 space-y-1">
          <p className="font-bold">💡 AuthMate 双轨登录机制说明：</p>
          <p>开启 SSO 后，登录界面将默认优先展示【使用 AuthMate 一键登录】按钮。同时保留“本地灾备管理员登录”入口，确保在外部 SSO 离线时系统依然可控。</p>
        </div>
      </div>

      {/* Global Scheduler Config */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">全局自动续期巡检策略</h3>
            <p className="text-xs text-slate-400">后台定时扫描所有证书资产并触发即将到期的自动化任务</p>
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
          disabled={saving}
          className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? '保存中...' : '保存全局设置'}</span>
        </button>
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
