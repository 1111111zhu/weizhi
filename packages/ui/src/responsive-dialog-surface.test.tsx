import { Dialog } from "@base-ui/react/dialog";
// @vitest-environment happy-dom
import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { ResponsiveDialogSurface } from "./responsive-dialog-surface";
import { Select, SelectContent, SelectItem, SelectTrigger } from "./select";

describe("responsive overlay contracts", () => {
  it("forwards the actual dialog node, native events and accessible name", () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const host = document.createElement("div");
    const root = createRoot(host);
    const ref = createRef<HTMLDivElement>();
    const clicked = vi.fn();
    try {
      act(() =>
        root.render(
          <Dialog.Root defaultOpen>
            <Dialog.Portal container={host}>
              <Dialog.Popup
                render={<ResponsiveDialogSurface ref={ref} />}
                aria-label="Edit"
                className="original-dialog"
                onClick={clicked}
              >
                Content
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        )
      );
      expect(ref.current).toBe(host.querySelector("[data-responsive-dialog]"));
      expect(ref.current?.className).toBe("original-dialog");
      expect(ref.current?.getAttribute("aria-label")).toBe("Edit");
      act(() => ref.current?.click());
      expect(clicked).toHaveBeenCalledOnce();
    } finally {
      act(() => root.unmount());
      expect(ref.current).toBeNull();
      vi.unstubAllGlobals();
    }
  });

  it.each([false, true])(
    "keeps selection behavior with mobile=%s",
    (mobile) => {
      vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
      vi.stubGlobal("matchMedia", () => ({
        matches: mobile,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      const host = document.createElement("div");
      document.body.append(host);
      const root = createRoot(host);
      const changed = vi.fn();
      try {
        act(() =>
          root.render(
            <Select defaultOpen value="a" onValueChange={changed}>
              <SelectTrigger aria-label="Category" />
              <SelectContent mobilePresentation="sheet">
                <SelectItem value="a">A</SelectItem>
                <SelectItem value="b">B</SelectItem>
              </SelectContent>
            </Select>
          )
        );
        expect(
          Boolean(document.querySelector(".pw-mobile-select-positioner"))
        ).toBe(mobile);
        const option = [
          ...document.querySelectorAll<HTMLElement>('[role="option"]'),
        ].find((node) => node.textContent?.includes("B"));
        expect(option).toBeDefined();
        act(() => option?.click());
        expect(changed).toHaveBeenCalledWith("b", expect.anything());
      } finally {
        act(() => root.unmount());
        host.remove();
        vi.unstubAllGlobals();
      }
    }
  );
});
