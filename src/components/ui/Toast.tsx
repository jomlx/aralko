import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto dismiss
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-xl border border-token bg-surface p-3 shadow-lg shadow-black/20 animate-in slide-in-from-right-5 fade-in duration-300 min-w-[250px]
              ${toast.type === 'success' ? 'border-success/30' : toast.type === 'error' ? 'border-danger/30' : ''}`}
          >
            {toast.type === 'success' && <CheckCircle2 size={18} className="text-success shrink-0" />}
            {toast.type === 'error' && <XCircle size={18} className="text-danger shrink-0" />}
            {toast.type === 'info' && <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 ml-1.5" />}
            
            <p className="text-sm text-primary flex-1">{toast.message}</p>
            
            <button 
              onClick={() => removeToast(toast.id)}
              className="text-muted hover:text-primary transition-colors p-1"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

