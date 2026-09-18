"use client";

import { usePathname } from "next/navigation";

import { useSurfaceTransition } from "../lib/use-surface-transition";
import { cn } from "../lib/utils";
import { EmpTopBarProvider } from "./emp-persistent-top-bar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mainRef = useSurfaceTransition<HTMLElement>(pathname, {
    initial: true,
    target: "route-content",
    variant: "page",
  });
  const pathnameWithoutLocale = pathname.replace(
    /^\/(zh-CN|en-US)(?=\/|$)/,
    ""
  );
  const isProjectPage =
    pathnameWithoutLocale === "/engagement" ||
    /^\/(?:workspaces\/[^/]+\/)?engagement\/(?!new$)[^/]+$/.test(
      pathnameWithoutLocale
    );
  const isFixedHeightAppPage =
    isProjectPage || pathnameWithoutLocale === "/confirmations";

  return (
    <div
      className={cn(
        "min-h-screen bg-background",
        isFixedHeightAppPage && "flex h-screen flex-col overflow-hidden"
      )}
    >
      <EmpTopBarProvider enabled={isFixedHeightAppPage}>
        <main
          ref={mainRef}
          className={cn(
            isFixedHeightAppPage
              ? "min-h-0 flex-1 overflow-hidden"
              : "min-h-screen"
          )}
        >
          {children}
        </main>
      </EmpTopBarProvider>
    </div>
  );
}
