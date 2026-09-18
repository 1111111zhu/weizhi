// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { useCompactViewport } from "./use-compact-viewport";

describe("compact viewport state contract", () => {
  it("tracks both breakpoint directions and removes its listener", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    let listener: (() => void) | undefined;
    const query = {
      matches: true,
      addEventListener: vi.fn((_type: string, callback: () => void) => {
        listener = callback;
      }),
      removeEventListener: vi.fn(),
    };
    const matchMedia = vi
      .spyOn(window, "matchMedia")
      .mockReturnValue(query as unknown as MediaQueryList);
    function Specimen() {
      return <output>{useCompactViewport() ? "compact" : "wide"}</output>;
    }
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      await act(() => root.render(<Specimen />));
      expect(container.textContent).toBe("compact");
      expect(matchMedia).toHaveBeenCalledWith("(max-width: 1023px)");
      await act(() => {
        query.matches = false;
        listener?.();
      });
      expect(container.textContent).toBe("wide");
      await act(() => {
        query.matches = true;
        listener?.();
      });
      expect(container.textContent).toBe("compact");
    } finally {
      await act(() => root.unmount());
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
    expect(query.removeEventListener).toHaveBeenCalledWith("change", listener);
  });
});
