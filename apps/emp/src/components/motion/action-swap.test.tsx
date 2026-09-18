import { ActionSwapButton } from "@project-wing/ui";
// @vitest-environment happy-dom
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);

const reducedMotion = vi.hoisted(() => ({ value: false }));

vi.mock("motion/react", async () => {
  const React = await import("react");
  const MotionButton = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
      transition?: unknown;
      whileTap?: unknown;
    }
  >(
    (
      { children, transition: _transition, whileTap: _whileTap, ...props },
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
  MotionButton.displayName = "MotionButton";
  const MotionSpan = React.forwardRef<
    HTMLSpanElement,
    React.HTMLAttributes<HTMLSpanElement> & {
      animate?: unknown;
      exit?: unknown;
      initial?: unknown;
      variants?: unknown;
    }
  >(
    (
      {
        animate: _animate,
        exit: _exit,
        initial: _initial,
        variants: _variants,
        ...props
      },
      ref
    ) => React.createElement("span", { ...props, ref }, props.children)
  );
  MotionSpan.displayName = "MotionSpan";

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: { button: MotionButton, span: MotionSpan },
    useReducedMotion: () => reducedMotion.value,
  };
});

const items = [
  { id: "sign-in", label: "登录" },
  { id: "send-code", label: "发送验证码" },
];

describe("lint test setup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  describe("actionSwapButton hydration", () => {
    it("keeps the submit button focusability stable across hydration", async () => {
      const serverWindow = globalThis.window;
      Reflect.deleteProperty(globalThis, "window");
      const html = renderToString(<ActionSwapButton items={items} />);
      Object.assign(globalThis, { window: serverWindow });

      const container = document.createElement("div");
      container.innerHTML = html;
      document.body.append(container);
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await act(() => {
        hydrateRoot(container, <ActionSwapButton items={items} />);
      });

      expect(consoleError).not.toHaveBeenCalled();
    });

    it("keeps the initial markup stable when reduced motion differs on the client", async () => {
      reducedMotion.value = false;
      const serverWindow = globalThis.window;
      Reflect.deleteProperty(globalThis, "window");
      const html = renderToString(<ActionSwapButton items={items} />);
      Object.assign(globalThis, { window: serverWindow });

      reducedMotion.value = true;
      const container = document.createElement("div");
      container.innerHTML = html;
      document.body.append(container);
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await act(() => {
        hydrateRoot(container, <ActionSwapButton items={items} />);
      });

      expect(consoleError).not.toHaveBeenCalled();
    });
  });
});
