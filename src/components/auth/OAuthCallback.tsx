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
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
          {error ? <AlertCircle className="w-8 h-8 text-rose-500" /> : <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />}
        </div>

        <div>
          <h2 className="text-lg font-bold text-white">
            {error ? 'AuthMate SSO 单点登录失败' : '正在完成 AuthMate 统一身份认证...'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {error ? error : '正在与 IdP 服务器安全交换令牌并建立会话，请稍候'}
          </p>
        </div>

        {error && (
          <a
            href="/login"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors mt-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回登录页</span>
          </a>
        )}
      </div>
    </div>
  );
};
