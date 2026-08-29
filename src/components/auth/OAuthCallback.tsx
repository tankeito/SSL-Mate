import React, { useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';
import { api } from '../../api/client';

export const OAuthCallback: React.FC = () => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (!code || !state) {
      setError('缺少授权码 (code) 或状态参数 (state)');
      return;
    }

    const savedState = sessionStorage.getItem('authmate_sso_state');
    if (savedState && savedState !== state) {
      setError('安全校验失败：State 参数不匹配，可能存在 CSRF 风险');
      return;
    }

    api.ssoCallback(code, state)
      .then(res => {
        localStorage.setItem('sslmate_token', res.token);
        sessionStorage.removeItem('authmate_sso_state');
        window.location.href = '/';
      })
      .catch(err => {
        setError(err.message || 'AuthMate SSO 授权码换取令牌失败');
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Light Background Ambient Mesh */}
      <div className="absolute w-[500px] h-[500px] bg-gradient-to-br from-emerald-100/60 via-teal-100/40 to-transparent rounded-full blur-3xl pointer-events-none -top-20 -left-20"></div>

      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-3xl p-8 shadow-xl shadow-slate-200/60 text-center space-y-4 relative z-10">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
          {error ? <AlertCircle className="w-8 h-8 text-rose-500" /> : <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />}
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {error ? 'AuthMate SSO 单点登录失败' : '正在完成 AuthMate 统一身份认证...'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {error ? error : '正在与 IdP 服务器安全交换令牌并建立安全会话，请稍候'}
          </p>
        </div>

        {error && (
          <a
            href="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors mt-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回登录页</span>
          </a>
        )}
      </div>
    </div>
  );
};
