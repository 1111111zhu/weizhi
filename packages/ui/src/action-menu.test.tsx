// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ActionMenu, ContextMenu } from "./action-menu";

function required<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) {
    throw new Error(`Missing ${selector}`);
  }
  return node;
}
describe("semantic menu actions", () => {
  beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
  afterEach(() => vi.unstubAllGlobals());

  it("keeps checkbox state controlled and dispatches an action without library event details", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const action = vi.fn();
    const check = vi.fn();
    function Harness() {
      const [checked, setChecked] = useState(false);
      return (
        <ActionMenu
          label="Actions"
          items={[
            {
              kind: "checkbox",
              id: "pin",
              label: "Pin",
              checked,
              onCheckedChange: (next) => {
                check(next);
                setChecked(next);
              },
            },
            {
              kind: "action",
              id: "open",
              label: "Open item",
              onSelect: action,
            },
          ]}
        />
      );
    }
    try {
      act(() => root.render(<Harness />));
      act(() =>
        required<HTMLButtonElement>('button[aria-label="Actions"]').click()
      );
      await vi.waitFor(() =>
        expect(
          document.querySelector('[role="menuitemcheckbox"]')
        ).not.toBeNull()
      );
      act(() => required<HTMLElement>('[role="menuitemcheckbox"]').click());
      expect(check).toHaveBeenCalledExactlyOnceWith(true);
      expect(
        required<HTMLElement>('[role="menuitemcheckbox"]').getAttribute(
          "aria-checked"
        )
      ).toBe("true");
      act(() => required<HTMLElement>('[role="menuitem"]').click());
      expect(action).toHaveBeenCalledExactlyOnceWith();
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("opens context actions from the keyboard and keeps disabled commands inert", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const action = vi.fn();
    try {
      act(() =>
        root.render(
          <ContextMenu
            label="Record"
            target={<div>Record contents</div>}
            items={[
              {
                kind: "action",
                id: "locked",
                label: "Locked",
                disabled: true,
                onSelect: action,
              },
            ]}
          />
        )
      );
      const trigger = required<HTMLElement>('[aria-label="Record"]');
      act(() => {
        trigger.focus();
        trigger.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "F10",
            shiftKey: true,
            bubbles: true,
          })
        );
      });
      // Happy DOM does not synthesize the browser's contextmenu default action.
      act(() =>
        trigger.dispatchEvent(
          new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: 20,
            clientY: 20,
          })
        )
      );
      await vi.waitFor(() =>
        expect(document.querySelector('[role="menu"]')).not.toBeNull()
      );
      act(() => required<HTMLElement>('[role="menuitem"]').click());
      expect(action).toHaveBeenCalledTimes(0);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });
});
