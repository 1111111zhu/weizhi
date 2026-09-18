"use client";

import { projectWingToast as sonnerToast } from "@project-wing/ui";
import { createContext, useCallback, useContext, useMemo } from "react";
import type { ReactNode } from "react";

import { Toaster } from "./ui/sonner";

type ToastVariant = "info" | "success" | "destructive";

type ToastMessage = {
  title: string;
  description?: string;
  duration?: number | null;
  variant?: ToastVariant;
  trustedDescription?: boolean;
};

type ToastContextValue = {
  toast: (message: ToastMessage) => void;
  dismiss: (id: string | number) => void;
};

function safeErrorDescription(description?: string) {
  if (!description) {
    return;
  }
  if (
    /failed to fetch|network|load failed|cors|econn|enotfound|timeout|500|502|503|504/i.test(
      description
    )
  ) {
    return "Network connection failed. Check your connection and try again.";
  }
  return "Something went wrong. Please try again.";
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function CmpToastProvider({ children }: { children: ReactNode }) {
  const dismiss = useCallback((id: string | number) => {
    sonnerToast.dismiss(id);
  }, []);
  const toast = useCallback((message: ToastMessage) => {
    const {
      title,
      description,
      duration = 4000,
      variant = "info",
      trustedDescription = false,
    } = message;
    const options = {
      description:
        variant === "destructive"
          ? trustedDescription
            ? description
            : safeErrorDescription(description)
          : description,
      duration: duration ?? Infinity,
    };

    if (variant === "success") {
      sonnerToast.success(title, options);
      return;
    }
    if (variant === "destructive") {
      sonnerToast.error(title, options);
      return;
    }
    sonnerToast.info(title, options);
  }, []);
  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster />
    </ToastContext.Provider>
  );
}

export function useCmpToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useCmpToast must be used within CmpToastProvider");
  }
  return context;
}
