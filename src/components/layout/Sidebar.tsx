import React from 'react';
import { 
  LayoutDashboard, 
  Layers, 
  Award, 
  KeyRound, 
  ShieldAlert, 
  Activity, 
  Bell, 
  Settings, 
  Users,
  ChevronLeft,
  ChevronRight,
  X,
  LogOut,
  Key,
  Lock
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export type NavTab = 
  | 'overview'
  | 'tasks'
  | 'certs'
  | 'credentials'
  | 'acme'
  | 'monitors'
  | 'notify'
  | 'users'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  collapsed: boolean;
  setCollapsed: (val: boolean) => void;
  mobileOpen?: boolean;
  setMobileOpen?: (val: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  collapsed, 
  setCollapsed,
  mobileOpen = false,
  setMobileOpen
}) => {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'overview', label: '仪表概览', icon: LayoutDashboard },
    { id: 'tasks', label: '证书任务', icon: Layers },
    { id: 'certs', label: '证书资产', icon: Award },
    { id: 'credentials', label: '凭据中心', icon: KeyRound },
    { id: 'acme', label: 'CA 账户', icon: ShieldAlert },
    { id: 'monitors', label: '域名监控', icon: Activity },
    { id: 'notify', label: '告警通道', icon: Bell },
    { id: 'users', label: '用户管理', icon: Users },
    { id: 'settings', label: '系统与 SSO', icon: Settings }
  ];

  const handleSelectTab = (id: NavTab) => {
    setActiveTab(id);
    if (setMobileOpen) {
      setMobileOpen(false);
    }
  };

  const navContent = (
    <div className="p-3 space-y-1.5 flex-1 overflow-y-auto">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            onClick={() => handleSelectTab(item.id as NavTab)}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              isActive
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title={collapsed ? item.label : undefined}
          >
            <Icon className={`w-4.5 h-4.5 sm:w-5 sm:h-5 shrink-0 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`} />
            {(!collapsed || mobileOpen) && <span>{item.label}</span>}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen && setMobileOpen(false)}
        />
      )}

      {/* Mobile Slide-over Drawer */}
      <div className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between transform transition-transform duration-300 ease-in-out md:hidden ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="font-bold text-sm text-slate-900 dark:text-white">功能导航</span>
          <button 
            onClick={() => setMobileOpen && setMobileOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {navContent}

        {/* User Profile Card & Logout (Figure 2) */}
        {user && (
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                  {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">{user.username}</span>
                    {user.authSource === 'authmate' ? (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.2 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40 shrink-0">
                        <Key className="w-2 h-2" /> SSO
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                        <Lock className="w-2 h-2" /> 本地
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 truncate font-mono">{user.email}</p>
                </div>
              </div>

              <button
                onClick={logout}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0"
                title="退出登录"
              >
                <LogOut className="w-4 h-4 text-rose-500" />
              </button>
            </div>
          </div>
        )}

        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5 bg-white dark:bg-slate-900">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          <span>系统守护进程运行中</span>
        </div>
      </div>

      {/* Desktop Persistent Sidebar */}
      <aside className={`hidden md:flex flex-col justify-between bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800/80 transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'}`}>
        {navContent}

        {/* Collapse Toggle Footer */}
        <div className="p-3 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
          {!collapsed && (
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              <span>守护进程在线运行</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mx-auto"
            title={collapsed ? '展开侧边栏' : '折叠侧边栏'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>
    </>
  );
};
