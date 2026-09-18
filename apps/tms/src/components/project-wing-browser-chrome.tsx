"use client";

import { ProjectWingBrowserChrome as SharedBrowserChrome } from "@project-wing/ui";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import type { ReactNode } from "react";

const environment = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  apiMode: process.env.NEXT_PUBLIC_API_MODE,
  localBackend: true,
};

function InnerChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <SharedBrowserChrome
      app="TMS"
      environment={environment}
      pathname={pathname}
    >
      {children}
    </SharedBrowserChrome>
  );
}

export function ProjectWingBrowserChrome({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <SharedBrowserChrome
          app="TMS"
          environment={environment}
          pathname={null}
        >
          {children}
        </SharedBrowserChrome>
      }
    >
      <InnerChrome>{children}</InnerChrome>
    </Suspense>
  );
}
