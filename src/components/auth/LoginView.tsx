import React, { useState } from 'react';
import { ShieldCheck, Key, Lock, ArrowRight, AlertCircle, Smartphone, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const LoginView: React.FC = () => {
  const { loginLocal, loginSSO } = useAuth();
  const [showLocalLogin, setShowLocalLogin] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLocalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res: any = await loginLocal(username.trim(), password, totpCode ? totpCode.trim() : undefined);
      if (res && res.requiresTwoFactor) {
        setRequiresTwoFactor(true);
        setLoading(false);
        return;
      }
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || '用户名、密码或 2FA 动态码错误');
    } finally {
      setLoading(false);
    }
  };

  const handleSsoClick = async () => {
    setSsoLoading(true);
    setError(null);
    try {
      await loginSSO();
    } catch (err: any) {
      setError(err.message || '连接 AuthMate SSO 失败。若在本地开发，请确保已启动 AuthMate 服务');
      setSsoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Light Background Ambient Mesh */}
      <div className="absolute w-[600px] h-[600px] bg-gradient-to-br from-emerald-100/60 via-teal-100/40 to-transparent rounded-full blur-3xl pointer-events-none -top-24 -left-24"></div>
      <div className="absolute w-[500px] h-[500px] bg-gradient-to-tl from-teal-100/60 via-emerald-50/40 to-transparent rounded-full blur-3xl pointer-events-none -bottom-24 -right-24"></div>

      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/60 space-y-6 relative z-10 mx-2">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/25 text-white">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">SSL-Mate (证书伴侣)</h1>
          <p className="text-xs text-slate-500">自动化 SSL 证书生命周期管理平台</p>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 shadow-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Primary Auth: AuthMate SSO Button */}
        {!requiresTwoFactor && (
          <div className="space-y-3">
            <button
              onClick={handleSsoClick}
              disabled={ssoLoading}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Key className="w-4 h-4" />
              <span>{ssoLoading ? '正在连接 AuthMate IdP...' : '使用 AuthMate 账号一键登录'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-[11px] text-center text-slate-400">
              基于 OIDC + PKCE S256 标准单点登录协议
            </p>
          </div>
        )}

        {/* Divider */}
        {!requiresTwoFactor && (
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full"></div>
            <span className="bg-white px-3 text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
              或
            </span>
          </div>
        )}

        {/* Dual-Track: Local Break-glass Emergency Login / 2FA Verification */}
        <div className="space-y-3">
          {!showLocalLogin ? (
            <button
              onClick={() => setShowLocalLogin(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200 transition-colors flex items-center justify-center gap-2"
            >
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>使用本地灾备管理员登录 (Break-Glass)</span>
            </button>
          ) : requiresTwoFactor ? (
            /* Step 2: 2FA Verification Form */
            <form onSubmit={handleLocalSubmit} className="space-y-4 text-xs animate-fadeIn">
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
                <Smartphone className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
                <div>
                  <div className="font-bold text-emerald-900 mb-0.5">安全双因素认证 (2FA)</div>
                  <div className="text-[11px] text-emerald-700 leading-relaxed">
                    已检测到该账号启用了 2FA 保护。请打开手机身份验证器应用 (Google Authenticator / 1Password) 并输入 6 位动态验证码。
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5 flex items-center justify-between">
                  <span>6 位动态身份验证码</span>
                  <span className="text-[10px] text-slate-400 font-normal">30秒刷新一次</span>
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="例如: 123456"
                  required
                  autoFocus
                  className="w-full text-center tracking-[0.5em] text-lg font-mono px-3.5 py-3 rounded-xl bg-slate-50 border border-emerald-500 text-emerald-800 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setRequiresTwoFactor(false);
                    setTotpCode('');
                  }}
                  className="w-1/3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 border border-slate-200 text-xs font-semibold flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>返回</span>
                </button>
                <button
                  type="submit"
                  disabled={loading || totpCode.length !== 6}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? '验证中...' : '确认并登录'}
                </button>
              </div>
            </form>
          ) : (
            /* Step 1: Username & Password Form */
            <form onSubmit={handleLocalSubmit} className="space-y-3.5 text-xs animate-fadeIn">
              <div>
                <label className="block text-slate-700 font-bold mb-1">管理员邮箱 / 用户名</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="请输入登录邮箱或用户名"
                  required
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">登录密码</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowLocalLogin(false)}
                  className="w-1/3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 border border-slate-200 text-xs font-semibold"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? '验证中...' : '本地登录'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Footer copyright */}
      <div className="text-center text-[11px] text-slate-400 mt-6">
        SSL-Mate (证书伴侣) · 企业级全自动证书生命周期管理平台
      </div>
    </div>
  );
};
