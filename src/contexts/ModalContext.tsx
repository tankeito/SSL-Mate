import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, X, Trash2 } from 'lucide-react';

export type ModalType = 'danger' | 'warning' | 'info' | 'success';
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: ModalType;
}

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ModalContextType {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  showToast: (message: string, type?: ToastType) => void;
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    warning: (msg: string) => void;
    info: (msg: string) => void;
  };
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Confirm Dialog State
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    options: ConfirmDialogOptions;
    resolve: (val: boolean) => void;
  } | null>(null);

  // Toasts State
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const confirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        options: {
          confirmText: options.confirmText || (options.type === 'danger' ? '确认删除' : '确认'),
          cancelText: options.cancelText || '取消',
          type: options.type || 'danger',
          ...options
        },
        resolve
      });
    });
  }, []);

  const handleDialogClose = (result: boolean) => {
    if (dialogState) {
      dialogState.resolve(result);
      setDialogState(null);
    }
  };

  const toastHelpers = {
    success: (msg: string) => showToast(msg, 'success'),
    error: (msg: string) => showToast(msg, 'error'),
    warning: (msg: string) => showToast(msg, 'warning'),
    info: (msg: string) => showToast(msg, 'info'),
  };

  return (
    <ModalContext.Provider value={{ confirm, showToast, toast: toastHelpers }}>
      {children}

      {/* Modern Confirm Dialog Modal */}
      {dialogState && dialogState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Frosted Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-fadeIn"
            onClick={() => handleDialogClose(false)}
          />

          {/* Modal Container */}
          <div className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 p-6 space-y-4 transform transition-all animate-scaleUp">
            {/* Header with Icon */}
            <div className="flex items-start gap-3.5">
              <div className={`p-3 rounded-2xl shrink-0 ${
                dialogState.options.type === 'danger'
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50'
                  : dialogState.options.type === 'warning'
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50'
                  : dialogState.options.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50'
                  : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50'
              }`}>
                {dialogState.options.type === 'danger' && <Trash2 className="w-5 h-5" />}
                {dialogState.options.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
                {dialogState.options.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
                {dialogState.options.type === 'info' && <Info className="w-5 h-5" />}
              </div>

              <div className="space-y-1 min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  {dialogState.options.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed break-words">
                  {dialogState.options.message}
                </p>
              </div>

              <button
                onClick={() => handleDialogClose(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => handleDialogClose(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
              >
                {dialogState.options.cancelText}
              </button>

              <button
                type="button"
                onClick={() => handleDialogClose(true)}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-all active:scale-95 ${
                  dialogState.options.type === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                    : dialogState.options.type === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                }`}
              >
                {dialogState.options.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Modern Toasts Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-2xl shadow-xl border backdrop-blur-md transition-all animate-slideInRight ${
              t.type === 'success'
                ? 'bg-emerald-50/95 dark:bg-emerald-950/90 text-emerald-900 dark:text-emerald-100 border-emerald-200 dark:border-emerald-800/60 shadow-emerald-900/10'
                : t.type === 'error'
                ? 'bg-rose-50/95 dark:bg-rose-950/90 text-rose-900 dark:text-rose-100 border-rose-200 dark:border-rose-800/60 shadow-rose-900/10'
                : t.type === 'warning'
                ? 'bg-amber-50/95 dark:bg-amber-950/90 text-amber-900 dark:text-amber-100 border-amber-200 dark:border-amber-800/60 shadow-amber-900/10'
                : 'bg-slate-900/95 dark:bg-slate-800/95 text-white border-slate-700 shadow-black/20'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="shrink-0">
                {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                {t.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
                {t.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                {t.type === 'info' && <Info className="w-4 h-4 text-blue-400" />}
              </div>
              <span className="text-xs font-semibold leading-tight break-words">{t.message}</span>
            </div>

            <button
              onClick={() => removeToast(t.id)}
              className="p-1 rounded-lg opacity-70 hover:opacity-100 transition-opacity shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};
