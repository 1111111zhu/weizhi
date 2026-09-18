"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";

import { ThemeProvider } from "../components/theme-provider";
import { ToastProvider } from "../components/toast";
import type { ThemeSettings } from "../lib/theme";
import { createEmpQueryClient } from "./query-client";

export function Providers({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme: ThemeSettings;
}) {
  const [queryClient, setQueryClient] = useState(() => createEmpQueryClient());
  void setQueryClient;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider initialTheme={initialTheme}>
        <TooltipProvider delay={0}>
          <ToastProvider>{children}</ToastProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
