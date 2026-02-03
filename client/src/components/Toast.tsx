import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { CheckCircle, AlertCircle, Info } from "./Icons";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info", duration: number = 3000) => {
    const id = `toast_${Date.now()}`;
    const toast: Toast = { id, message, type, duration };

    setToasts((prev) => [...prev, toast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 999,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const bgColor =
    toast.type === "success"
      ? "rgba(34, 197, 94, 0.9)"
      : toast.type === "error"
      ? "rgba(239, 68, 68, 0.9)"
      : "rgba(59, 130, 246, 0.9)";

  const icon =
    toast.type === "success" ? (
      <CheckCircle size={16} />
    ) : toast.type === "error" ? (
      <AlertCircle size={16} />
    ) : (
      <Info size={16} />
    );

  return (
    <div
      style={{
        padding: "12px 16px",
        backgroundColor: bgColor,
        color: "#000",
        borderRadius: "8px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "13px",
        fontWeight: "500",
        animation: "slideIn 0.3s ease-out",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
      }}
    >
      {icon}
      {toast.message}
      <button
        onClick={onClose}
        style={{
          marginLeft: "auto",
          background: "none",
          border: "none",
          color: "currentColor",
          cursor: "pointer",
          padding: "0",
          display: "flex",
          alignItems: "center",
          fontSize: "18px",
        }}
      >
        ×
      </button>
    </div>
  );
}
