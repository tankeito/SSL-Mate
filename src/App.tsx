import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { OverviewView } from './components/dashboard/OverviewView';
import { TasksView } from './components/tasks/TasksView';
import { TaskWizardModal } from './components/tasks/TaskWizardModal';
import { CertsView } from './components/certs/CertsView';
import { CredentialsView } from './components/credentials/CredentialsView';
import { AcmeAccountsView } from './components/acme/AcmeAccountsView';
import { MonitorsView } from './components/monitors/MonitorsView';
import { NotifyView } from './components/notify/NotifyView';
import { UsersView } from './components/users/UsersView';
import { SettingsView } from './components/settings/SettingsView';
import { TaskExecutionModal } from './components/tasks/TaskExecutionModal';
import { LoginView } from './components/auth/LoginView';
import { OAuthCallback } from './components/auth/OAuthCallback';
import { Footer } from './components/layout/Footer';
import { CertTask } from './types';
import { api } from './api/client';

export const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    const saved = localStorage.getItem('sslmate_active_tab') as NavTab;
    return saved || 'tasks';
  });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('sslmate_dark_mode');
    return saved !== null ? saved === 'true' : true;
  });

  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab);
    localStorage.setItem('sslmate_active_tab', tab);
  };

  // Modals state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CertTask | null>(null);
  
  // Terminal / Execution Modal state
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalTaskId, setTerminalTaskId] = useState('');
  const [terminalTaskName, setTerminalTaskName] = useState('');

  // Handle Dark mode class
  useEffect(() => {
    localStorage.setItem('sslmate_dark_mode', darkMode.toString());
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Handle OAuth Callback route
  if (window.location.pathname === '/oauth/callback') {
    return <OAuthCallback />;
  }

  // Handle Login
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const handleOpenNewTask = () => {
    setEditingTask(null);
    setWizardOpen(true);
  };

  const handleEditTask = (task: CertTask) => {
    setEditingTask(task);
    setWizardOpen(true);
  };

  const handleOpenLiveLogs = (taskId: string, taskName: string) => {
    setTerminalTaskId(taskId);
    setTerminalTaskName(taskName);
    setTerminalOpen(true);
  };

  const handleRetryTask = async (taskId: string) => {
    try {
      await api.runTask(taskId);
    } catch (err) {
      console.error('Failed to retry task:', err);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Navbar (Fixed at top) */}
      <Navbar
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onOpenNewTask={handleOpenNewTask}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      {/* Body: Sidebar + Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={handleSelectTab}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          mobileOpen={mobileMenuOpen}
          setMobileOpen={setMobileMenuOpen}
        />

        <main className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col justify-between p-3 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col pb-6">
            {activeTab === 'overview' && (
              <OverviewView
                onOpenNewTask={handleOpenNewTask}
                onNavigateToTasks={() => setActiveTab('tasks')}
                onNavigateToCerts={() => setActiveTab('certs')}
                onOpenInspectModal={() => setActiveTab('certs')}
                onOpenLiveLogs={handleOpenLiveLogs}
              />
            )}

            {activeTab === 'tasks' && (
              <TasksView
                onOpenNewTask={handleOpenNewTask}
                onEditTask={handleEditTask}
                onOpenLiveLogs={handleOpenLiveLogs}
              />
            )}

            {activeTab === 'certs' && (
              <CertsView />
            )}

            {activeTab === 'credentials' && (
              <CredentialsView />
            )}

            {activeTab === 'acme' && (
              <AcmeAccountsView />
            )}

            {activeTab === 'monitors' && (
              <MonitorsView />
            )}

            {activeTab === 'notify' && (
              <NotifyView />
            )}

            {activeTab === 'users' && (
              <UsersView />
            )}

            {activeTab === 'settings' && (
              <SettingsView />
            )}
          </div>

          {/* Enterprise Footer */}
          <Footer />
        </main>
      </div>

      {/* 3-Step Wizard Modal */}
      <TaskWizardModal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        initialTask={editingTask}
        onSuccess={(taskId, runNow) => {
          setWizardOpen(false);
          if (runNow && taskId) {
            setTimeout(() => {
              handleOpenLiveLogs(taskId, editingTask ? editingTask.name : '自动化证书任务');
            }, 100);
          }
        }}
      />

      {/* Modern Dynamic Pipeline Execution Pop Modal */}
      <TaskExecutionModal
        isOpen={terminalOpen}
        onClose={() => setTerminalOpen(false)}
        taskId={terminalTaskId}
        taskName={terminalTaskName}
        onNavigateToCerts={() => {
          setActiveTab('certs');
        }}
        onRetryTask={handleRetryTask}
      />
    </div>
  );
};
