// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Accordion, Breadcrumbs, Link, Tabs } from "./content-primitives";
import { Input } from "./input";

function required<T extends Element>(host: ParentNode, selector: string): T {
  const node = host.querySelector<T>(selector);
  if (!node) {
    throw new Error(`Missing ${selector}`);
  }
  return node;
}
describe("content navigation and persistence contracts", () => {
  beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
  afterEach(() => vi.unstubAllGlobals());

  it("rejects executable links, preserves secure external relations and identifies the current breadcrumb", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const click = vi.fn();
    try {
      act(() =>
        root.render(
          <>
            {/* Deliberately unsafe input verifies that navigation is rejected. */}
            {/* eslint-disable-next-line no-script-url */}
            <Link href="javascript:alert(1)" onClick={click}>
              Unsafe
            </Link>
            <Link href="https://example.com" target="_blank">
              External
            </Link>
            <Breadcrumbs
              label="Location"
              items={[
                { id: "home", label: "Home", href: "/" },
                { id: "current", label: "Current" },
              ]}
            />
          </>
        )
      );
      const unsafe = required<HTMLAnchorElement>(host, "a");
      act(() => unsafe.click());
      expect(click).toHaveBeenCalledTimes(0);
      expect(unsafe.getAttribute("href")).toBeNull();
      expect(required<HTMLAnchorElement>(host, '[target="_blank"]').rel).toBe(
        "noopener noreferrer"
      );
      expect(
        required<HTMLElement>(host, '[aria-current="page"]').textContent
      ).toBe("Current");
    } finally {
      act(() => root.unmount());
    }
  });

  it("changes tabs with the keyboard without discarding a mounted draft", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    function Harness() {
      const [value, setValue] = useState("a");
      return (
        <Tabs
          label="Sections"
          activation="automatic"
          value={value}
          onValueChange={setValue}
          tabs={[
            {
              value: "a",
              label: "First",
              content: <Input aria-label="Draft" defaultValue="Keep me" />,
            },
            { value: "b", label: "Second", content: "Details" },
          ]}
        />
      );
    }
    try {
      act(() => root.render(<Harness />));
      const input = required<HTMLInputElement>(host, "input");
      const first = required<HTMLElement>(host, '[role="tab"]');
      await act(() => {
        first.focus();
      });
      await act(() => {
        first.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
        );
      });
      await vi.waitFor(() =>
        expect(
          host
            .querySelectorAll('[role="tab"]')[1]
            ?.getAttribute("aria-selected")
        ).toBe("true")
      );
      expect(required<HTMLInputElement>(host, "input")).toBe(input);
      expect(input.value).toBe("Keep me");
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("keeps accordion IDs isolated and toggles only the requested section", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const change = vi.fn();
    const items = [{ id: "one", title: "One", content: "Body" }];
    try {
      act(() =>
        root.render(
          <>
            <Accordion items={items} expanded={[]} onExpandedChange={change} />
            <Accordion items={items} expanded={[]} onExpandedChange={change} />
          </>
        )
      );
      const buttons = host.querySelectorAll("button");
      expect(buttons[0].getAttribute("aria-controls")).not.toBe(
        buttons[1].getAttribute("aria-controls")
      );
      act(() => buttons[0].click());
      expect(change).toHaveBeenCalledExactlyOnceWith(["one"]);
    } finally {
      act(() => root.unmount());
    }
  });
});
