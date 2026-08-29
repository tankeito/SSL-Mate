import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm mt-auto py-5 px-4 sm:px-8 text-xs text-slate-500 dark:text-slate-400 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Brand & Version */}
        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
          <div className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px]">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-slate-800 dark:text-slate-200">SSL-Mate (证书伴侣)</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
            v1.0.0
          </span>
          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
          <span className="text-[11px] text-slate-400">企业级自动化 SSL 证书全流程管理平台</span>
        </div>

        {/* Status & Copyright */}
        <div className="flex items-center gap-3 text-[11px] flex-wrap justify-center sm:justify-end">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span>自动续期守护中</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <span>© {new Date().getFullYear()} SSL-Mate & AuthMate SSO</span>
        </div>
      </div>
    </footer>
  );
};
