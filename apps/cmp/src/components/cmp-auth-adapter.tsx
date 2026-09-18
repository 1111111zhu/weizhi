"use client";

import {
  buildLocalizedLoginPath,
  resolveSafeNextPath,
} from "@project-wing/shared";
import {
  AuthBoundary,
  getAuthBoundaryCopy,
  useAuthSignOut,
} from "@project-wing/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { api } from "@/api/client";
import { useCmpI18n } from "@/i18n/client";

const PUBLIC_PATHS = new Set(["/login", "/preview"]);

export function CmpAuthAdapter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { locale } = useCmpI18n();
  const routePath = `${pathname}${searchParams.toString() ? `?${searchParams}` : ""}`;
  const isPublic = PUBLIC_PATHS.has(stripLocale(pathname));
  const me = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    enabled: !isPublic,
    retry: false,
  });
  const onUnauthenticated = useCallback(
    () =>
      router.replace(
        buildLocalizedLoginPath(locale, resolveSafeNextPath(routePath))
      ),
    [locale, routePath, router]
  );

  return (
    <AuthBoundary
      copy={getAuthBoundaryCopy(locale)}
      hasSession={Boolean(me.data)}
      isError={me.isError}
      isLoading={me.isLoading}
      isPublic={isPublic}
      onRetry={() => void me.refetch()}
      onUnauthenticated={onUnauthenticated}
    >
      {children}
    </AuthBoundary>
  );
}

export function useCmpSignOut() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { locale } = useCmpI18n();

  return useAuthSignOut({
    clearSession: () => queryClient.clear(),
    navigate: router.replace,
    redirectTo: buildLocalizedLoginPath(locale),
    signOut: api.signOut,
  });
}

function stripLocale(pathname: string) {
  const [, locale, ...rest] = pathname.split("/");
  if (locale === "zh-CN" || locale === "en-US") {
    return `/${rest.join("/")}`.replace(/\/$/, "") || "/";
  }
  return pathname || "/";
}
