"use client";

import { useEffect, useState } from "react";

/** Hydration-safe breakpoint for layouts that require more than a CSS rearrangement. */
export function useCompactViewport(maxWidth = 1023) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const query = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [maxWidth]);
  return compact;
}
