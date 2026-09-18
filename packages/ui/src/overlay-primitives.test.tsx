// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "./button";
import { Input } from "./input";
import { ConfirmDialog, Drawer, ModalDialog } from "./overlay-primitives";

function required<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) {
    throw new Error(`Missing ${selector}`);
  }
  return node;
}
describe("shared overlay focus and mutation contracts", () => {
  beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
  afterEach(() => vi.unstubAllGlobals());

  it.each([ModalDialog, Drawer])(
    "labels %s and closes with Escape while restoring focus",
    async (Overlay) => {
      const host = document.createElement("div");
      document.body.append(host);
      const root = createRoot(host);
      function Harness() {
        const [open, setOpen] = useState(false);
        return (
          <>
            <Button onClick={() => setOpen(true)}>Open</Button>
            <Overlay
              open={open}
              onOpenChange={setOpen}
              title="Edit item"
              description="Local form"
              closeLabel="Close"
            >
              <Input aria-label="Name" defaultValue="Draft" />
            </Overlay>
          </>
        );
      }
      try {
        act(() => root.render(<Harness />));
        const trigger = required<HTMLButtonElement>("button");
        act(() => {
          trigger.focus();
          trigger.click();
        });
        await vi.waitFor(() =>
          expect(document.querySelector('[role="dialog"]')).not.toBeNull()
        );
        const dialog = required<HTMLElement>('[role="dialog"]');
        expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
        act(() =>
          required<HTMLInputElement>('input[aria-label="Name"]').dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
          )
        );
        await vi.waitFor(() =>
          expect(document.querySelector('[role="dialog"]')).toBeNull()
        );
        await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
      } finally {
        act(() => root.unmount());
        host.remove();
      }
    }
  );

  it("focuses cancel, keeps a failed confirmation open and blocks duplicate pending actions", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const confirm = vi.fn();
    const change = vi.fn();
    const props = {
      open: true,
      onOpenChange: change,
      title: "Remove item?",
      description: "This action needs confirmation.",
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
      onConfirm: confirm,
      intent: "danger" as const,
    };
    try {
      act(() => root.render(<ConfirmDialog {...props} error="Try again" />));
      await vi.waitFor(() =>
        expect(document.activeElement?.textContent).toBe("Cancel")
      );
      const buttons = [
        ...document.querySelectorAll<HTMLButtonElement>(
          '[role="alertdialog"] button'
        ),
      ];
      const submit = buttons.find((button) => button.textContent === "Remove");
      if (!submit) {
        throw new Error("Missing confirmation action");
      }
      act(() => submit.click());
      expect(confirm).toHaveBeenCalledOnce();
      expect(change).toHaveBeenCalledTimes(0);
      expect(required<HTMLElement>('[role="alert"]').textContent).toBe(
        "Try again"
      );
      act(() => root.render(<ConfirmDialog {...props} loading />));
      act(() => submit.click());
      expect(confirm).toHaveBeenCalledOnce();
      expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });
});
