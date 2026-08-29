import React from 'react';
import { ShieldCheck, Lock, Radio } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md mt-auto py-3 px-4 sm:px-8 text-xs text-slate-500 dark:text-slate-400 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Brand + Detailed Platform Description */}
        <div className="flex items-center gap-2.5 flex-wrap justify-center md:justify-start">
          <div className="w-5 h-5 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px] shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
            SSL-Mate (证书伴侣)
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono font-bold border border-emerald-200/80 dark:border-emerald-800/60">
            v1.0.0 Enterprise
          </span>
          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
            企业级自动化 SSL/TLS 证书全生命周期智能中枢 · RFC 8555 (ACME) & DNS-01 自动化签发
          </span>
        </div>

        {/* Right: Security Badge + Engine Status + Copyright */}
        <div className="flex items-center gap-3 text-[11px] flex-wrap justify-center md:justify-end">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span>7x24h 自动续期守护巡检中</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>AES-256-GCM 硬件密文存储</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700 hidden lg:inline">·</span>
          <span className="text-slate-400 dark:text-slate-500">
            © {new Date().getFullYear()} SSL-Mate & AuthMate SSO
          </span>
        </div>
      </div>
    </footer>
  );
};
