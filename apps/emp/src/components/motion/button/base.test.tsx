import { MotionButton } from "@project-wing/ui";
// @vitest-environment happy-dom
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "./base";

vi.mock("motion/react", async () => {
  const React = await import("react");
  const MockMotionButton = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
      whileTap?: unknown;
      whileHover?: unknown;
      transition?: unknown;
    }
  >(
    (
      {
        children,
        transition: _transition,
        whileHover: _whileHover,
        whileTap: _whileTap,
        ...props
      },
      ref
    ) =>
      React.createElement(
        "button",
        {
          ...props,
          ref,
          type: "button",
          tabIndex:
            props.tabIndex ?? (typeof window === "undefined" ? 0 : undefined),
        },
        children
      )
  );
  MockMotionButton.displayName = "MockMotionButton";
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: { button: MockMotionButton, span: "span" },
    useReducedMotion: () => false,
  };
});

describe("lint test setup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  describe("motion Button hydration", () => {
    it("does not let an undefined forwarded tabIndex reintroduce the SSR mismatch", async () => {
      const serverWindow = globalThis.window;
      Reflect.deleteProperty(globalThis, "window");
      const html = renderToString(<Button tabIndex={undefined}>Save</Button>);
      Object.assign(globalThis, { window: serverWindow });
      const container = document.createElement("div");
      container.innerHTML = html;
      document.body.append(container);
      const hydrationErrors: unknown[] = [];
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation((...args) => hydrationErrors.push(args));

      await act(() => {
        hydrateRoot(container, <Button tabIndex={undefined}>Save</Button>);
      });

      expect(consoleError).not.toHaveBeenCalled();
      expect(hydrationErrors).toStrictEqual([]);
    });

    it("keeps the motion button focusability stable across hydration", async () => {
      const serverWindow = globalThis.window;
      Reflect.deleteProperty(globalThis, "window");
      const html = renderToString(<Button>Save</Button>);
      Object.assign(globalThis, { window: serverWindow });
      const container = document.createElement("div");
      container.innerHTML = html;
      document.body.append(container);
      const hydrationErrors: unknown[] = [];
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation((...args) => hydrationErrors.push(args));

      await act(() => {
        hydrateRoot(container, <Button>Save</Button>);
      });

      expect(consoleError).not.toHaveBeenCalled();
      expect(hydrationErrors).toStrictEqual([]);
    });

    it("keeps the shared motion button focusability stable across hydration", async () => {
      const serverWindow = globalThis.window;
      Reflect.deleteProperty(globalThis, "window");
      const html = renderToString(<MotionButton>Save</MotionButton>);
      Object.assign(globalThis, { window: serverWindow });
      const container = document.createElement("div");
      container.innerHTML = html;
      document.body.append(container);
      const hydrationErrors: unknown[] = [];
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation((...args) => hydrationErrors.push(args));

      await act(() => {
        hydrateRoot(container, <MotionButton>Save</MotionButton>);
      });

      expect(consoleError).not.toHaveBeenCalled();
      expect(hydrationErrors).toStrictEqual([]);
    });
  });
});
