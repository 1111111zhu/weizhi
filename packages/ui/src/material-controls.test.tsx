// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import {
  FloatingActionButton,
  MaterialSurface,
  SegmentedButtonGroup,
} from "./material-controls";

describe("mobile Material controls", () => {
  it("blocks selection while loading and exposes invalid description context", () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const host = document.createElement("div");
    const root = createRoot(host);
    const changed = vi.fn();
    try {
      act(() =>
        root.render(
          <SegmentedButtonGroup
            label="Loading state"
            value="a"
            options={[
              { value: "a", label: "A" },
              { value: "b", label: "B" },
            ]}
            onValueChange={changed}
            loading
            invalid
            descriptionId="error-context"
          />
        )
      );
      const group = host.querySelector('[role="group"]');
      expect(group?.getAttribute("aria-busy")).toBe("true");
      expect(group?.getAttribute("aria-invalid")).toBe("true");
      expect(group?.getAttribute("aria-describedby")).toBe("error-context");
      act(() => host.querySelectorAll("button")[1].click());
      expect(changed).not.toHaveBeenCalled();
    } finally {
      act(() => root.unmount());
      vi.unstubAllGlobals();
    }
  });

  it("retains controlled selection, roving focus and disabled options", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const onChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState("all");
      return (
        <SegmentedButtonGroup
          label="Status"
          value={value}
          options={[
            { value: "all", label: "All" },
            { value: "pending", label: "Pending" },
            { value: "locked", label: "Locked", disabled: true },
          ]}
          onValueChange={(next) => {
            setValue(next);
            onChange(next);
          }}
        />
      );
    }
    try {
      act(() => root.render(<Harness />));
      const buttons = host.querySelectorAll("button");
      act(() => {
        buttons[0].focus();
        buttons[0].dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
        );
      });
      await vi.waitFor(() => expect(document.activeElement).toBe(buttons[1]));
      act(() => buttons[1].click());
      expect(buttons[1].getAttribute("aria-pressed")).toBe("true");
      act(() => buttons[2].click());
      expect(onChange).toHaveBeenCalledExactlyOnceWith("pending");
    } finally {
      act(() => root.unmount());
      host.remove();
      vi.unstubAllGlobals();
    }
  });

  it("keeps accessible naming and disabled behavior on the floating action", () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const host = document.createElement("div");
    const root = createRoot(host);
    const click = vi.fn();
    try {
      act(() =>
        root.render(
          <MaterialSurface as="article" aria-label="Actions">
            <FloatingActionButton
              label="Create"
              icon="+"
              disabled
              onClick={click}
            />
          </MaterialSurface>
        )
      );
      const button = host.querySelector("button");
      expect(button?.getAttribute("aria-label")).toBe("Create");
      expect(button?.disabled).toBeTruthy();
      act(() => button?.click());
      expect(click).not.toHaveBeenCalled();
      expect(host.querySelector("article")?.getAttribute("aria-label")).toBe(
        "Actions"
      );
    } finally {
      act(() => root.unmount());
      vi.unstubAllGlobals();
    }
  });
});
