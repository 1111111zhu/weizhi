import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
// @vitest-environment happy-dom

import { ThemeProvider, useTheme } from "./theme-provider";

function ThemeProbe() {
  const {
    fontSize,
    mounted,
    setTheme,
    setUseNativePdfViewer,
    useNativePdfViewer,
  } = useTheme();
  return (
    <div>
      <div data-testid="theme">{fontSize}</div>
      <div data-testid="mounted">{String(mounted)}</div>
      <div data-testid="native-pdf-viewer">{String(useNativePdfViewer)}</div>
      <button type="button" onClick={() => setTheme("dark")}>
        Dark
      </button>
      <button type="button" onClick={() => setUseNativePdfViewer(true)}>
        Use browser PDF viewer
      </button>
    </div>
  );
}

describe("lint test setup", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("style");
    window.localStorage.clear();
  });

  describe(ThemeProvider, () => {
    it("does not render an inline script from a client component", () => {
      const { container } = render(
        <ThemeProvider>
          <ThemeProbe />
        </ThemeProvider>
      );

      expect(container.querySelector("script")).toBeNull();
    });

    it("applies color mode and keeps font size separate", async () => {
      render(
        <ThemeProvider initialTheme={{ fontSize: "lg" }}>
          <ThemeProbe />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(document.documentElement).toHaveClass("font-size-lg");
        expect(screen.getByTestId("mounted")).toHaveTextContent("true");
      });
      expect(screen.getByTestId("theme")).toHaveTextContent("lg");
      expect(screen.getByTestId("native-pdf-viewer")).toHaveTextContent(
        "false"
      );

      fireEvent.click(screen.getByRole("button", { name: "Dark" }));
      await waitFor(() => {
        expect(document.documentElement).toHaveClass("dark");
      });
    });

    it("persists the browser PDF viewer preference", async () => {
      render(
        <ThemeProvider>
          <ThemeProbe />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("mounted")).toHaveTextContent("true");
      });
      expect(screen.getByTestId("native-pdf-viewer")).toHaveTextContent(
        "false"
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Use browser PDF viewer" })
      );

      expect(screen.getByTestId("native-pdf-viewer")).toHaveTextContent("true");
      expect(document.cookie).toContain("project-wing-native-pdf-viewer=true");
    });
  });
});
