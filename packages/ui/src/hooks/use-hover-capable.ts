"use client";

import { useEffect, useLayoutEffect, useState } from "react";

export function useHoverCapable() {
  const [canHover, setCanHover] = useState(false);

  const useMountedLayoutEffect =
    typeof window === "undefined" ? useEffect : useLayoutEffect;

  useMountedLayoutEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setCanHover(mediaQuery.matches);
    update();
    mediaQuery.addEventListener?.("change", update);
    return () => mediaQuery.removeEventListener?.("change", update);
  }, []);

  return canHover;
}
