"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

type Variant = "default" | "destructive" | "success";

export interface ToastPayload {
  id: number;
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: Variant;
  duration?: number;
}

type ToastContextValue = {
  toast: (t: Omit<ToastPayload, "id">) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <Toaster>");
  return ctx;
}

export function Toaster({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastPayload[]>([]);

  const toast = React.useCallback((t: Omit<ToastPayload, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((arr) => [...arr, { id, ...t }]);
  }, []);

  const value = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastProvider swipeDirection="right">
        {children}
        {toasts.map((t) => (
          <Toast
            key={t.id}
            variant={t.variant}
            duration={t.duration ?? 4000}
            onOpenChange={(open) => {
              if (!open) {
                setToasts((arr) => arr.filter((x) => x.id !== t.id));
              }
            }}
          >
            <div className="mt-0.5">
              {t.variant === "destructive" ? (
                <AlertTriangle className="h-5 w-5" />
              ) : t.variant === "success" ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <Info className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="flex-1">
              {t.title ? <ToastTitle>{t.title}</ToastTitle> : null}
              {t.description ? (
                <ToastDescription>{t.description}</ToastDescription>
              ) : null}
            </div>
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>
    </ToastContext.Provider>
  );
}
