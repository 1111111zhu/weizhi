"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

const MOBILE_QUERY = "(width < 48rem)";
function subscribeMobileLayout(listener: () => void) {
  if (typeof window.matchMedia !== "function") {
    return () => {};
  }
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

/** Keep desktop disclosure state, but never hide document content on phones. */
export function useSmartFormV2MobileLayout() {
  return useSmartFormV2Viewport() ?? false;
}

/** Null during SSR/hydration: retain CSS-responsive content until the viewport is known. */
export function useSmartFormV2Viewport(): boolean | null {
  return useSyncExternalStore(
    subscribeMobileLayout,
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia(MOBILE_QUERY).matches,
    () => null
  );
}

export type SmartFormV2ExpansionCommand = {
  expanded: boolean;
  version: number;
};

const DEFAULT_EXPANSION_COMMAND: SmartFormV2ExpansionCommand = {
  expanded: true,
  version: 0,
};
const SmartFormV2ExpansionContext = createContext(DEFAULT_EXPANSION_COMMAND);

export const SmartFormV2ExpansionProvider =
  SmartFormV2ExpansionContext.Provider;

export function useSmartFormV2ExpansionCommand() {
  return useContext(SmartFormV2ExpansionContext);
}
