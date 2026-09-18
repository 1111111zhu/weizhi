import { useTheme } from "next-themes";
import { useCallback, useMemo } from "react";

import { META_THEME_COLORS } from "@/constants/site";

export const useMetaColor = () => {
  const { resolvedTheme } = useTheme();

  const metaColor = useMemo(
    () =>
      resolvedTheme === "dark"
        ? META_THEME_COLORS.dark
        : META_THEME_COLORS.light,
    [resolvedTheme]
  );

  const setMetaColor = useCallback((color: string) => {
    for (const element of document.querySelectorAll(
      'meta[name="theme-color"]'
    )) {
      element.setAttribute("content", color);
    }
  }, []);

  return {
    metaColor,
    setMetaColor,
  };
};
