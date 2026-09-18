// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  readPreviewDarkMode,
  usePreviewDarkMode,
} from "./use-preview-dark-mode";

describe(usePreviewDarkMode, () => {
  afterEach(() => {
    cleanup();
    document.documentElement.classList.remove("dark");
  });

  it("tracks the application color theme", async () => {
    expect(readPreviewDarkMode()).toBeFalsy();
    const { result } = renderHook(() => usePreviewDarkMode());

    await act(async () => {
      document.documentElement.classList.add("dark");
      await Promise.resolve();
    });

    expect(result.current[0]).toBeTruthy();
  });

  it("still allows a viewer-specific override", () => {
    const { result } = renderHook(() => usePreviewDarkMode());

    act(() => result.current[1](true));

    expect(result.current[0]).toBeTruthy();
  });
});
