import React from 'react';
import { ShieldCheck, LogOut, Moon, Sun, User as UserIcon, Lock, Sparkles, Key, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface NavbarProps {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  onOpenNewTask: () => void;
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  darkMode, 
  setDarkMode, 
  onOpenNewTask,
  onToggleMobileMenu 
}) => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 h-16 flex items-center justify-between px-4 sm:px-6 transition-colors">
      {/* Brand & Mobile Menu Toggle */}
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Button */}
        <button
          onClick={onToggleMobileMenu}
          className="p-2 -ml-1 rounded-xl md:hidden text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="打开菜单"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white shrink-0">
          <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">SSL-Mate</h1>
            <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
              证书伴侣 v1.0
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">极简自动化 SSL 证书生命周期管理平台</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick New Task Button */}
        <button
          onClick={onOpenNewTask}
          className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-emerald-600/20 transition-all active:scale-95"
        >
          <Sparkles className="w-4 h-4" />
          <span>新建 3 步任务</span>
        </button>

        {/* Dark Mode Toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/60 transition-all active:scale-95"
          title={darkMode ? '切换明亮模式 (Light)' : '切换深色模式 (Dark)'}
        >
          {darkMode ? (
            <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 fill-amber-400/20" />
          ) : (
            <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 fill-indigo-600/20" />
          )}
        </button>

        {/* User Profile / SSO Tag (Desktop only, mobile moved to drawer menu) */}
        {user && (
          <div className="hidden md:flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-slate-200 dark:border-slate-800">
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5">
                <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">{user.username}</span>
                {user.authSource === 'authmate' ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40">
                    <Key className="w-2.5 h-2.5" /> AuthMate SSO
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <Lock className="w-2.5 h-2.5" /> 本地灾备
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate max-w-[150px] font-mono">{user.email}</p>
            </div>

            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
              {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
            </div>

            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              title="退出登录"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
