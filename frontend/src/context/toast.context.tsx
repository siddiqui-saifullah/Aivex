import { createContext, useContext, useState, useCallback, useMemo, useRef, type ReactNode } from "react";
import type { ToastType } from "../types";

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (message: string, type?: ToastType, duration?: number) => number;
  removeToast: (id: number) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // Date.now() alone collides when two toasts fire in the same millisecond
  const nextIdRef = useRef(0);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = "info", duration = 3000) => {
      const id = Date.now() * 1000 + (nextIdRef.current++ % 1000);
      setToasts((prev) => [...prev, { id, message, type }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast],
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  const { addToast } = context;

  // Stable object so callers can safely list it in hook dependencies
  return useMemo(
    () => ({
      success: (message: string, duration?: number) =>
        addToast(message, "success", duration),
      error: (message: string, duration?: number) =>
        addToast(message, "error", duration),
      info: (message: string, duration?: number) =>
        addToast(message, "info", duration),
      warning: (message: string, duration?: number) =>
        addToast(message, "warning", duration),
    }),
    [addToast],
  );
};
