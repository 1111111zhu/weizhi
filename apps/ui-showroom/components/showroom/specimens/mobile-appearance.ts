"use client";

import { useLayoutEffect } from "react";

import type { MobileDemoState } from "./mobile-workspace-model";

export function useMobilePreferences(
  preferences: MobileDemoState["preferences"]
) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousMobile = root.classList.contains("pw-mobile-theme");
    const previousDark = root.classList.contains("dark");
    const previousSize = root.style.fontSize;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      root.classList.add("pw-mobile-theme");
      root.classList.toggle(
        "dark",
        preferences.theme === "dark" ||
          (preferences.theme === "system" && media.matches)
      );
      root.style.fontSize = preferences.textSize === "large" ? "18px" : "16px";
    };
    apply();
    media.addEventListener("change", apply);
    return () => {
      media.removeEventListener("change", apply);
      root.classList.toggle("pw-mobile-theme", previousMobile);
      root.classList.toggle("dark", previousDark);
      root.style.fontSize = previousSize;
    };
  }, [preferences.theme, preferences.textSize]);
}
