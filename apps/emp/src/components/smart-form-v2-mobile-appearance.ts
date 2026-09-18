"use client";

import { useLayoutEffect } from "react";

/** Include portaled fields in the shared mobile palette; never change theme preference. */
export function useSmartFormV2MobileAppearance(enabled: boolean) {
  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }
    const root = document.documentElement;
    const alreadyMobile = root.classList.contains("pw-mobile-theme");
    root.classList.add("pw-mobile-theme");
    return () => {
      root.classList.toggle("pw-mobile-theme", alreadyMobile);
    };
  }, [enabled]);
}
