"use client";

import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { MouseEvent } from "react";

import {
  decodeMobileState,
  advanceMobileTrail,
  emptyMobileState,
  mobileRouteHref,
  parseMobileRoute,
} from "./mobile-workspace-model";
import type { MobileDemoState, MobileRoute } from "./mobile-workspace-model";

const key = "project-wing-mobile-specimen-v2";
const eventName = "pw-mobile-specimen-state";
const initial = JSON.stringify(emptyMobileState());
let memoryOverride: string | null = null;
function snapshot() {
  try {
    return memoryOverride ?? sessionStorage.getItem(key) ?? initial;
  } catch {
    return memoryOverride ?? initial;
  }
}
function subscribe(listener: () => void) {
  window.addEventListener(eventName, listener);
  return () => window.removeEventListener(eventName, listener);
}
export function updateMobileState(
  update: (state: MobileDemoState) => MobileDemoState,
  notify = true
) {
  const next = update(decodeMobileState(snapshot()));
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ ...next, storageLimited: false })
    );
    memoryOverride = null;
  } catch {
    memoryOverride = JSON.stringify({ ...next, storageLimited: true });
  }
  if (notify) {
    window.dispatchEvent(new Event(eventName));
  }
}
const serverSnapshot = () => initial;
const routeSnapshot = () => window.location.hash;
const serverRoute = () => "";
function routeSubscribe(listener: () => void) {
  window.addEventListener("hashchange", listener);
  window.addEventListener("popstate", listener);
  return () => {
    window.removeEventListener("hashchange", listener);
    window.removeEventListener("popstate", listener);
  };
}
export function useMobileStoredState() {
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return useMemo(() => decodeMobileState(raw), [raw]);
}
export function useMobileWorkspaceState() {
  const state = useMobileStoredState();
  const hash = useSyncExternalStore(routeSubscribe, routeSnapshot, serverRoute);
  const route = useMemo(() => parseMobileRoute(hash), [hash]);
  const routeKey = mobileRouteHref(route);
  const scrollRef = useRef<HTMLDivElement>(null);
  const trail = useRef<string[]>([]);
  const trailIndex = useRef(0);
  useLayoutEffect(() => {
    const next = advanceMobileTrail(
      { entries: trail.current, index: trailIndex.current },
      routeKey,
      mobileRouteHref(parseMobileRoute(window.location.hash))
    );
    trail.current = next.entries;
    trailIndex.current = next.index;
  }, [routeKey]);
  useLayoutEffect(() => {
    if (routeKey !== mobileRouteHref(parseMobileRoute(window.location.hash))) {
      return;
    }
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    let top = decodeMobileState(snapshot()).scroll[routeKey] ?? 0;
    element.scrollTop = top;
    const remember = () => {
      top = element.scrollTop;
    };
    element.addEventListener("scroll", remember, { passive: true });
    return () => {
      element.removeEventListener("scroll", remember);
      updateMobileState(
        (current) => ({
          ...current,
          scroll: { ...current.scroll, [routeKey]: top },
        }),
        false
      );
    };
  }, [routeKey]);
  const preserveScroll = () => {
    const top = scrollRef.current?.scrollTop ?? 0;
    updateMobileState((current) => ({
      ...current,
      scroll: { ...current.scroll, [routeKey]: top },
    }));
  };
  const navigate = (next: MobileRoute, replace = false) => {
    preserveScroll();
    const href = mobileRouteHref(next);
    if (href === routeKey) {
      return;
    }
    // Fragment navigation stays browser-native; do not race the app router's
    // asynchronous canonical-URL restoration with custom history state.
    if (replace) {
      trail.current = [href];
      trailIndex.current = 0;
      window.location.replace(href);
    } else {
      window.location.hash = href;
    }
  };
  const follow =
    (next: MobileRoute) => (event: MouseEvent<HTMLAnchorElement>) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      event.preventDefault();
      navigate(next);
    };
  const back = (fallback: MobileRoute) => {
    preserveScroll();
    if (trailIndex.current > 0) {
      window.history.back();
    } else {
      navigate(fallback, true);
    }
  };
  return {
    state,
    route,
    routeKey,
    scrollRef,
    navigate,
    follow,
    back,
    preserveScroll,
  };
}
export type MobileWorkspaceContext = ReturnType<typeof useMobileWorkspaceState>;
