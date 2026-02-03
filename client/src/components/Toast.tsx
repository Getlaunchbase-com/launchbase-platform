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

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info", duration: number = 3000) => {
    const id = `toast_${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, type, duration }]);

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
      <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 999 }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              padding: "12px 16px",
              backgroundColor:
                toast.type === "success"
                  ? "rgba(34, 197, 94, 0.9)"
                  : toast.type === "error"
                  ? "rgba(239, 68, 68, 0.9)"
                  : "rgba(59, 130, 246, 0.9)",
              color: "#fff",
              borderRadius: "8px",
              marginBottom: "8px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              animation: "slideIn 0.3s ease-out",
            }}
          >
            {toast.type === "success" ? (
              <CheckCircle size={16} />
            ) : toast.type === "error" ? (
              <AlertCircle size={16} />
            ) : (
              <Info size={16} />
            )}
            {toast.message}
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                marginLeft: "auto",
                background: "none",
                border: "none",
                color: "inherit",
                cursor: "pointer",
                fontSize: "18px",
                padding: "0",
              }}
            >
              ×
            </button>
          </div>
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
