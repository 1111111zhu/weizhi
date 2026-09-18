// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectWingWorkItemOverlay } from "./work-item-board";

describe("work item overlay accessibility contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("closes on a handle click, but preserves the panel when dragging its width", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const close = vi.fn();
    try {
      await act(() =>
        root.render(
          <ProjectWingWorkItemOverlay title="Tasks" onClose={close}>
            Tasks
          </ProjectWingWorkItemOverlay>
        )
      );
      const handle = container.querySelector<HTMLInputElement>(
        '[data-slot="project-wing-work-item-dock-resize-handle"]'
      );
      if (!handle) {
        throw new Error("Expected the work item resize handle");
      }
      await act(() => {
        handle.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            button: 0,
            pointerId: 1,
            clientX: 800,
          })
        );
        window.dispatchEvent(
          new PointerEvent("pointerup", { pointerId: 1, clientX: 800 })
        );
      });
      expect(close).toHaveBeenCalledOnce();
      close.mockClear();
      await act(() => {
        handle.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            button: 0,
            pointerId: 2,
            clientX: 800,
          })
        );
      });
      expect(handle.dataset.resizeState).toBe("idle");
      await act(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 200);
        });
      });
      expect(handle.dataset.resizeState).toBe("dragging");
      await act(() => {
        window.dispatchEvent(
          new PointerEvent("pointermove", { pointerId: 2, clientX: 760 })
        );
        window.dispatchEvent(
          new PointerEvent("pointerup", { pointerId: 2, clientX: 760 })
        );
      });
      expect(close).not.toHaveBeenCalled();
      expect(Number(handle.value)).toBe(Math.min(528, Number(handle.max)));
      await act(() =>
        handle.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
        )
      );
      expect(close).toHaveBeenCalledOnce();
    } finally {
      await act(() => root.unmount());
      container.remove();
    }
  });

  it("uses a modal without reserving workspace width on compact screens and handles Escape cancellation", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    } as unknown as MediaQueryList);
    const modal = new WeakSet<Element>();
    const originalMatches = Element.prototype.matches;
    vi.spyOn(Element.prototype, "matches").mockImplementation(
      function matchModal(this: Element, selector) {
        return selector === ":modal"
          ? modal.has(this)
          : originalMatches.call(this, selector);
      }
    );
    const originalShowModal = Object.getOwnPropertyDescriptor(
      HTMLDialogElement.prototype,
      "showModal"
    );
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = true;
        modal.add(this);
      },
    });
    const container = document.createElement("div");
    const opener = document.createElement("button");
    opener.textContent = "Open tasks";
    document.body.append(opener, container);
    opener.focus();
    const close = vi.fn();
    const root = createRoot(container);
    try {
      await act(() =>
        root.render(
          <ProjectWingWorkItemOverlay title="Tasks" onClose={close}>
            <button type="button">Close tasks</button>
          </ProjectWingWorkItemOverlay>
        )
      );
      const dialog = container.querySelector("dialog");
      if (!dialog) {
        throw new Error("Expected the task dialog to render");
      }
      dialog.querySelector("button")?.focus();
      expect(dialog.getAttribute("aria-modal")).toBe("true");
      expect(dialog.open).toBeTruthy();
      expect(
        document.documentElement.style.getPropertyValue(
          "--project-wing-work-item-dock-reserved-width"
        )
      ).toBe("0px");
      expect(
        container.querySelector(
          '[data-slot="project-wing-work-item-dock-resize-handle"]'
        )?.parentElement?.hidden
      ).toBeTruthy();
      await act(() => {
        dialog.dispatchEvent(
          new Event("cancel", { bubbles: true, cancelable: true })
        );
      });
      expect(close).toHaveBeenCalledOnce();
    } finally {
      await act(() => root.unmount());
      await Promise.resolve();
      expect(document.activeElement).toBe(opener);
      container.remove();
      opener.remove();
      if (originalShowModal) {
        Object.defineProperty(
          HTMLDialogElement.prototype,
          "showModal",
          originalShowModal
        );
      } else {
        Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
      }
    }
    expect(
      document.documentElement.style.getPropertyValue(
        "--project-wing-work-item-dock-reserved-width"
      )
    ).toBe("");
  });
});
