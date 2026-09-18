"use client";

import {
  buildLocalizedLoginPath,
  resolveSafeNextPath,
} from "@project-wing/shared";
import {
  AuthBoundary,
  ProjectWingLoadingProgress,
  getAuthBoundaryCopy,
} from "@project-wing/ui";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

import { api } from "../api/client";
import { useI18n } from "../i18n/client";
import {
  canAccessAdmin,
  requiresSystemDeclaration,
} from "../lib/access-control";

function currentPath(pathname: string, search: string) {
  const params = new URLSearchParams(search);
  params.delete("from");
  const nextSearch = params.toString();
  return nextSearch ? `${pathname}?${nextSearch}` : pathname;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { locale } = useI18n();
  const search = searchParams.toString();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    retry: false,
  });
  const nextPath = resolveSafeNextPath(
    currentPath(pathname, search),
    `/${locale}/engagement`
  );
  const redirectToLogin = useCallback(
    () => router.replace(buildLocalizedLoginPath(locale, nextPath)),
    [locale, nextPath, router]
  );

  useEffect(() => {
    if (me.isError || me.isLoading || me.data) {
      return;
    }
    redirectToLogin();
  }, [me.data, me.isError, me.isLoading, redirectToLogin]);

  useEffect(() => {
    if (!me.isLoading && !me.isError && requiresSystemDeclaration(me.data)) {
      router.replace(
        `/${locale}/declaration?redirect=${encodeURIComponent(nextPath)}`
      );
    }
  }, [locale, me.data, me.isError, me.isLoading, nextPath, router]);

  if (me.isLoading || me.isError || !me.data) {
    return (
      <AuthBoundary
        copy={getAuthBoundaryCopy(locale)}
        hasSession={Boolean(me.data)}
        isError={me.isError}
        isLoading={me.isLoading}
        onRetry={() => me.refetch()}
        onUnauthenticated={redirectToLogin}
      >
        {null}
      </AuthBoundary>
    );
  }

  if (requiresSystemDeclaration(me.data)) {
    return <ProjectWingLoadingProgress />;
  }

  return children;
}

export function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { localizedPath } = useI18n();
  const me = useQuery({ queryKey: ["me"], queryFn: api.me, retry: false });

  useEffect(() => {
    if (!me.isLoading && !canAccessAdmin(me.data)) {
      router.replace(localizedPath("/engagement"));
    }
  }, [localizedPath, me.data, me.isLoading, router]);

  if (me.isLoading) {
    return <ProjectWingLoadingProgress />;
  }

  if (!canAccessAdmin(me.data)) {
    return <ProjectWingLoadingProgress />;
  }

  return children;
}
