import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm mt-auto py-2.5 px-4 sm:px-6 text-[11px] text-slate-500 dark:text-slate-400 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        {/* Brand & Status */}
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-emerald-600 text-white flex items-center justify-center font-bold text-[9px]">
            <ShieldCheck className="w-3 h-3" />
          </div>
          <span className="font-bold text-slate-700 dark:text-slate-300">SSL-Mate</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono">
            v1.0.0
          </span>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <div className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span>自动续期守护中</span>
          </div>
        </div>

        {/* Copyright */}
        <div className="text-slate-400 dark:text-slate-500">
          © {new Date().getFullYear()} SSL-Mate & AuthMate SSO
        </div>
      </div>
    </footer>
  );
};
