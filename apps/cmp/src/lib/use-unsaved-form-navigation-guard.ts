"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

type NavigationOperation = () => void;

export function useUnsavedFormNavigationGuard({
  isDirty,
  message,
}: {
  isDirty: boolean;
  message: string;
}) {
  const router = useRouter();
  const currentHrefRef = useRef<string | null>(null);
  const bypassNextNavigationRef = useRef(false);
  const confirmAndRun = useCallback(
    (operation: NavigationOperation) => {
      if (bypassNextNavigationRef.current) {
        bypassNextNavigationRef.current = false;
        operation();
        return true;
      }
      if (isDirty && !window.confirm(message)) {
        return false;
      }
      operation();
      return true;
    },
    [isDirty, message]
  );
  const guardedNavigate = useCallback(
    (url: string) => confirmAndRun(() => router.push(url)),
    [confirmAndRun, router]
  );
  const guardedReplace = useCallback(
    (url: string) => confirmAndRun(() => router.replace(url)),
    [confirmAndRun, router]
  );
  const guardedAction = useCallback(
    (operation: NavigationOperation) => confirmAndRun(operation),
    [confirmAndRun]
  );
  const allowNextNavigation = useCallback(() => {
    bypassNextNavigationRef.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    currentHrefRef.current = window.location.href;
    const currentState = window.history.state ?? {};
    const guardState = {
      ...(typeof currentState === "object" && currentState ? currentState : {}),
      __cmpFormGuard: true,
    };
    window.history.replaceState(guardState, "", window.location.href);

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };
    const onPopState = () => {
      if (!isDirty) {
        return;
      }
      if (bypassNextNavigationRef.current) {
        bypassNextNavigationRef.current = false;
        return;
      }
      const currentHref = currentHrefRef.current;
      if (currentHref) {
        window.history.pushState(guardState, "", currentHref);
      }
      if (!window.confirm(message)) {
        return;
      }
      bypassNextNavigationRef.current = true;
      window.history.back();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
    };
  }, [isDirty, message]);

  return {
    guardedNavigate,
    guardedReplace,
    guardedAction,
    allowNextNavigation,
  };
}
