"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { getAuthCopy } from "./auth-copy";
import type { AuthLocale } from "./auth-copy";
import { MotionButton } from "./motion-button";
import { ProjectWingLoadingProgress } from "./project-wing-loading-progress";

export type AuthBoundaryCopy = Pick<
  ReturnType<typeof getAuthCopy>,
  "authSessionRetry" | "authSessionUnavailable"
>;

export function getAuthBoundaryCopy(locale: AuthLocale): AuthBoundaryCopy {
  const copy = getAuthCopy(locale);
  return {
    authSessionRetry: copy.authSessionRetry,
    authSessionUnavailable: copy.authSessionUnavailable,
  };
}

export function AuthBoundary({
  children,
  copy,
  hasSession,
  isError,
  isLoading,
  isPublic = false,
  onRetry,
  onUnauthenticated,
}: {
  children: ReactNode;
  copy: AuthBoundaryCopy;
  hasSession: boolean;
  isError: boolean;
  isLoading: boolean;
  isPublic?: boolean;
  onRetry: () => void;
  onUnauthenticated: () => void;
}) {
  const unauthenticatedNotifiedRef = useRef(false);

  useEffect(() => {
    if (isPublic || isLoading || isError || hasSession) {
      unauthenticatedNotifiedRef.current = false;
      return;
    }

    if (unauthenticatedNotifiedRef.current) {
      return;
    }
    unauthenticatedNotifiedRef.current = true;
    onUnauthenticated();
  }, [hasSession, isError, isLoading, isPublic, onUnauthenticated]);

  if (isPublic) {
    return children;
  }
  if (isError) {
    return (
      <main className="bg-background grid min-h-dvh place-items-center px-6 text-center">
        <section className="flex max-w-sm flex-col items-center gap-3">
          <p className="text-muted-foreground text-sm">
            {copy.authSessionUnavailable}
          </p>
          <MotionButton variant="outline" onClick={onRetry}>
            {copy.authSessionRetry}
          </MotionButton>
        </section>
      </main>
    );
  }
  if (isLoading || !hasSession) {
    return <ProjectWingLoadingProgress />;
  }

  return children;
}

export function useAuthSignOut({
  clearSession,
  navigate,
  redirectTo,
  signOut,
}: {
  clearSession: () => void;
  navigate: (url: string) => void;
  redirectTo: string;
  signOut: () => Promise<void>;
}) {
  return useCallback(async () => {
    try {
      await signOut();
    } catch {
      // The local session must still be cleared when the server is unavailable.
    } finally {
      clearSession();
      navigate(redirectTo);
    }
  }, [clearSession, navigate, redirectTo, signOut]);
}
