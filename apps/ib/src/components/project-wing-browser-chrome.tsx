"use client";

import { usePathname } from "next/navigation";
import { Suspense, useEffect } from "react";
import type { ReactNode } from "react";

const apiMode = process.env.NEXT_PUBLIC_API_MODE?.toLowerCase();

function getEnvironmentPrefix(hostname: string) {
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(hostname);
  if (apiMode === "mock") {
    return "[Mock]";
  }
  if (isLocal) {
    return "[Local]";
  }
  return "";
}

function TitleSync() {
  const pathname = usePathname();
  useEffect(() => {
    const pageTitle = pathname?.startsWith("/en-US")
      ? "IB · Requests"
      : "IB · 资料请求";
    const title = [getEnvironmentPrefix(window.location.hostname), pageTitle]
      .filter(Boolean)
      .join(" ");
    document.title = title;
    const frame = window.requestAnimationFrame(() => {
      document.title = title;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);
  return null;
}

export function ProjectWingBrowserChrome({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <Suspense fallback={null}>
        <TitleSync />
      </Suspense>
      {children}
    </>
  );
}
