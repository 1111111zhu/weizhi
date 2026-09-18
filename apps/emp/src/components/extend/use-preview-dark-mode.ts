"use client";

import * as React from "react";

export function readPreviewDarkMode() {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
  );
}

export function usePreviewDarkMode() {
  const [isDark, setIsDark] = React.useState(readPreviewDarkMode);

  React.useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const syncWithApplicationTheme = () => setIsDark(readPreviewDarkMode());
    syncWithApplicationTheme();

    if (typeof MutationObserver === "undefined") {
      return;
    }

    const observer = new MutationObserver(syncWithApplicationTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return [isDark, setIsDark] as const;
}
