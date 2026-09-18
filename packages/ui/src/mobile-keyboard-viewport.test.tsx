// @vitest-environment happy-dom
import { act, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { useMobileKeyboardViewport } from "./mobile-keyboard-viewport";

describe("mobile keyboard viewport", () => {
  it("attaches when a portal surface mounts after the owning component", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const previous = Object.getOwnPropertyDescriptor(window, "visualViewport");
    const viewport = Object.assign(new EventTarget(), {
      height: 800,
      offsetTop: 0,
      scale: 1,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport,
    });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    function Harness() {
      const ref = useRef<HTMLElement>(null);
      const [mounted, setMounted] = useState(false);
      useMobileKeyboardViewport(ref);
      return (
        <>
          <button type="button" onClick={() => setMounted(true)}>
            Open
          </button>
          {mounted ? (
            <section ref={ref}>
              <textarea aria-label="Reply" />
            </section>
          ) : null}
        </>
      );
    }
    try {
      act(() => root.render(<Harness />));
      act(() => host.querySelector("button")?.click());
      const field = host.querySelector("textarea");
      const surface = host.querySelector("section");
      if (!field || !surface) {
        throw new Error("Missing delayed surface");
      }
      field.focus();
      viewport.height = 360;
      viewport.dispatchEvent(new Event("resize"));
      await vi.waitFor(() =>
        expect(
          surface.style.getPropertyValue("--pw-mobile-viewport-height")
        ).toBe("360px")
      );
      act(() => root.render(null));
      expect(
        surface.style.getPropertyValue("--pw-mobile-viewport-height")
      ).toBe("");
    } finally {
      act(() => root.unmount());
      host.remove();
      if (previous) {
        Object.defineProperty(window, "visualViewport", previous);
      } else {
        Reflect.deleteProperty(window, "visualViewport");
      }
      vi.unstubAllGlobals();
    }
  });

  it("tracks focused visual viewport, ignores pinch zoom, and restores on blur", () => {
    vi.useFakeTimers();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const previous = Object.getOwnPropertyDescriptor(window, "visualViewport");
    const viewport = Object.assign(new EventTarget(), {
      height: 800,
      offsetTop: 0,
      scale: 1,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport,
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    function Harness() {
      const ref = useRef<HTMLElement>(null);
      useMobileKeyboardViewport(ref);
      return (
        <section ref={ref}>
          <div className="pw-mobile-content" />
          <textarea aria-label="Reply" />
          <button type="button">Format</button>
        </section>
      );
    }
    const tick = () =>
      act(() => {
        viewport.dispatchEvent(new Event("resize"));
        vi.advanceTimersByTime(50);
      });
    try {
      act(() => root.render(<Harness />));
      const section = container.querySelector("section");
      const textarea = container.querySelector("textarea");
      if (!section || !textarea) {
        throw new Error("Missing keyboard harness");
      }
      act(() => {
        textarea.focus();
        vi.advanceTimersByTime(50);
      });
      viewport.height = 360;
      tick();
      expect(
        section.style.getPropertyValue("--pw-mobile-viewport-height")
      ).toBe("360px");
      expect(section.dataset.keyboardOpen).toBe("true");
      expect(section.style.getPropertyValue("--pw-mobile-keyboard-inset")).toBe(
        `${Math.max(0, window.innerHeight - 360)}px`
      );
      const action = container.querySelector("button");
      if (!action) {
        throw new Error("Missing toolbar action");
      }
      act(() => {
        action.focus();
        vi.advanceTimersByTime(50);
      });
      expect(
        section.style.getPropertyValue("--pw-mobile-viewport-height")
      ).toBe("360px");
      expect(section.dataset.keyboardOpen).toBe("true");
      act(() => {
        textarea.focus();
        vi.advanceTimersByTime(50);
      });
      expect(
        section.style.getPropertyValue("--pw-mobile-viewport-height")
      ).toBe("360px");
      viewport.scale = 2;
      tick();
      expect(
        section.style.getPropertyValue("--pw-mobile-viewport-height")
      ).toBe("");
      expect(section.style.getPropertyValue("--pw-mobile-keyboard-inset")).toBe(
        ""
      );
      viewport.scale = 1;
      viewport.height = 800;
      tick();
      expect(section.dataset.keyboardOpen).toBe("false");
      act(() => {
        textarea.blur();
        vi.advanceTimersByTime(50);
      });
      expect(
        section.style.getPropertyValue("--pw-mobile-viewport-height")
      ).toBe("");
    } finally {
      act(() => root.unmount());
      container.remove();
      if (previous) {
        Object.defineProperty(window, "visualViewport", previous);
      } else {
        Reflect.deleteProperty(window, "visualViewport");
      }
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});
