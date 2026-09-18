// @vitest-environment jsdom
import { renderHook, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useSmartFormV2MobileAppearance } from "./smart-form-v2-mobile-appearance";

describe("SmartForm mobile appearance scope", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.classList.remove("pw-mobile-theme", "dark");
  });

  it("includes portals while narrow and restores desktop without changing dark preference", () => {
    document.documentElement.classList.add("dark");
    const { rerender } = renderHook(
      ({ mobile }) => useSmartFormV2MobileAppearance(mobile),
      { initialProps: { mobile: true } }
    );
    expect(document.documentElement).toHaveClass("pw-mobile-theme", "dark");
    rerender({ mobile: false });
    expect(document.documentElement).not.toHaveClass("pw-mobile-theme");
    expect(document.documentElement).toHaveClass("dark");
  });

  it("does not remove a mobile theme owned by the surrounding shell", () => {
    document.documentElement.classList.add("pw-mobile-theme");
    const { unmount } = renderHook(() => useSmartFormV2MobileAppearance(true));
    unmount();
    expect(document.documentElement).toHaveClass("pw-mobile-theme");
  });
});
