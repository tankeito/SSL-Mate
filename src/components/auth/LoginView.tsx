import React, { useState } from 'react';
import { ShieldCheck, Key, Lock, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const LoginView: React.FC = () => {
  const { loginLocal, loginSSO } = useAuth();
  const [showLocalLogin, setShowLocalLogin] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLocalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await loginLocal(username.trim(), password);
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || '用户名或密码错误');
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
      setError(err.message || '连接 AuthMate SSO 失败。若在本地开发，请确保已在 AuthMate 目录启动后端服务 (npm run dev:api)');
      setSsoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background glow ambient */}
      <div className="absolute w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -top-20 -left-20"></div>
      <div className="absolute w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-3xl pointer-events-none -bottom-20 -right-20"></div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative z-10 mx-2">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20 text-white">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">SSL-Mate (证书伴侣)</h1>
          <p className="text-xs text-slate-400">自动化 SSL 证书生命周期管理平台</p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Primary Auth: AuthMate SSO Button */}
        <div className="space-y-3">
          <button
            onClick={handleSsoClick}
            disabled={ssoLoading}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm shadow-xl shadow-emerald-950/40 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <Key className="w-4 h-4" />
            <span>{ssoLoading ? '正在连接 AuthMate IdP...' : '使用 AuthMate 账号一键登录'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-[11px] text-center text-slate-500">
            基于 OIDC + PKCE S256 标准单点登录协议
          </p>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-800 w-full"></div>
          <span className="bg-slate-900 px-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
            或
          </span>
        </div>

        {/* Dual-Track: Local Break-glass Emergency Login */}
        <div className="space-y-3">
          {!showLocalLogin ? (
            <button
              onClick={() => setShowLocalLogin(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700/60 transition-colors flex items-center justify-center gap-2"
            >
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>使用本地灾备管理员登录 (Break-Glass)</span>
            </button>
          ) : (
            <form onSubmit={handleLocalSubmit} className="space-y-3.5 text-xs animate-in fade-in duration-200">
              <div>
                <label className="block text-slate-400 font-bold mb-1">管理员邮箱 / 用户名</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="请输入登录邮箱或用户名"
                  required
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">登录密码</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowLocalLogin(false)}
                  className="w-1/3 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 bg-slate-800/40 text-xs font-semibold"
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
      <div className="text-center text-[11px] text-slate-600 mt-6">
        SSL-Mate (证书伴侣) · 企业级全自动证书生命周期管理平台
      </div>
    </div>
  );
};
