// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, beforeEach, expect, it, vi } from "vitest";

import { usePdfViewerInitialZoom } from "./pdf-viewer";

const state = vi.hoisted(() => ({
  metrics: { clientWidth: 0, clientHeight: 0 },
  resize: null as null | (() => void),
  requestZoom: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock("@embedpdf/plugin-viewport/react", async (original) => ({
  ...(await original<object>()),
  useViewportCapability: () => ({ provides: viewport }),
}));
vi.mock("@embedpdf/plugin-zoom/react", async (original) => ({
  ...(await original<object>()),
  useZoom: () => ({ provides: zoom }),
}));
const zoom = { requestZoom: state.requestZoom };
const viewport = {
  forDocument: () => ({ getMetrics: () => state.metrics }),
  onViewportResize: (listener: (event: { documentId: string }) => void) => {
    state.resize = () => listener({ documentId: "doc-1" });
    return state.unsubscribe;
  },
};
describe("confirmation behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.metrics = { clientWidth: 0, clientHeight: 0 };
    state.resize = null;
  });

  it.each([true, false])(
    "waits for measured dimensions, then initializes once without resetting user zoom (fit width: %s)",
    (autoFitWidth) => {
      const { unmount } = renderHook(() =>
        usePdfViewerInitialZoom({
          documentId: "doc-1",
          loaded: true,
          autoFitWidth,
          defaultZoom: 1,
        })
      );
      expect(state.requestZoom).not.toHaveBeenCalled();
      act(() => {
        state.metrics = { clientWidth: 1200, clientHeight: 800 };
        state.resize?.();
      });
      expect(state.requestZoom).toHaveBeenCalledOnce();
      expect(state.requestZoom).toHaveBeenCalledWith(
        autoFitWidth ? "fit-width" : 1,
        autoFitWidth ? { vx: 600, vy: 0 } : undefined
      );
      act(() => state.resize?.());
      expect(state.requestZoom).toHaveBeenCalledOnce();
      unmount();
      expect(state.unsubscribe).toHaveBeenCalledWith();
    }
  );
});
