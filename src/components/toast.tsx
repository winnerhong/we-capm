"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type ToastType = "success" | "error" | "info";
type Toast = { id: string; message: string; type: ToastType };
type ToastContextValue = { show: (message: string, type?: ToastType) => void };

const ToastCtx = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      3000,
    );
  }, []);

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <div
        className="fixed top-4 right-4 z-[9999] space-y-2"
        role="region"
        aria-live="polite"
        aria-label="알림"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === "error" ? "alert" : "status"}
            className={`rounded-xl px-4 py-3 shadow-lg text-sm font-medium animate-slide-in ${
              t.type === "success"
                ? "bg-[#2D5A3D] text-white"
                : t.type === "error"
                  ? "bg-red-600 text-white"
                  : "bg-white text-[#2C2C2C] border border-[#D4E4BC]"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("ToastProvider required");
  return c;
}
