// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  NumberInput,
  RadioGroup,
  Slider,
  Switch,
  ToggleButton,
} from "./choice-controls";

function required<T extends Element>(host: ParentNode, selector: string): T {
  const node = host.querySelector<T>(selector);
  if (!node) {
    throw new Error(`Missing ${selector}`);
  }
  return node;
}

describe("choice control keyboard and value contracts", () => {
  beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
  afterEach(() => vi.unstubAllGlobals());

  it("toggles a switch through its label and preserves read-only value and form identity", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const changed = vi.fn();
    function Harness({ readOnly = false }: { readOnly?: boolean }) {
      const [checked, setChecked] = useState(false);
      return (
        <form>
          <Switch
            label="Notifications"
            name="notifications"
            checked={checked}
            readOnly={readOnly}
            onCheckedChange={(next) => {
              changed(next);
              setChecked(next);
            }}
          />
        </form>
      );
    }
    try {
      act(() => root.render(<Harness />));
      act(() => required<HTMLElement>(host, "label span:last-child").click());
      expect(changed).toHaveBeenCalledExactlyOnceWith(true);
      expect(
        required<HTMLElement>(host, '[role="switch"]').getAttribute(
          "aria-checked"
        )
      ).toBe("true");
      expect(
        new FormData(required<HTMLFormElement>(host, "form")).has(
          "notifications"
        ) === true
      ).toBeTruthy();
      act(() => root.render(<Harness readOnly />));
      act(() => required<HTMLElement>(host, '[role="switch"]').click());
      expect(changed).toHaveBeenCalledOnce();
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("moves radio selection by keyboard and skips disabled choices", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const changed = vi.fn();
    function Harness() {
      const [value, setValue] = useState("a");
      return (
        <RadioGroup
          label="Category"
          value={value}
          options={[
            { value: "a", label: "Alpha" },
            { value: "disabled", label: "Disabled", disabled: true },
            { value: "b", label: "Beta" },
          ]}
          onValueChange={(next) => {
            changed(next);
            setValue(next);
          }}
        />
      );
    }
    try {
      act(() => root.render(<Harness />));
      const radio = required<HTMLElement>(host, '[role="radio"]');
      act(() => {
        radio.focus();
        radio.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
        );
      });
      await vi.waitFor(() => expect(changed).toHaveBeenCalledWith("b"));
      expect(
        host.querySelectorAll('[role="radio"]')[2]?.getAttribute("aria-checked")
      ).toBe("true");
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("enforces numeric bounds for stepping and retains read-only fields", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const changed = vi.fn();
    function Harness({ readOnly = false }: { readOnly?: boolean }) {
      const [value, setValue] = useState<number | null>(1);
      return (
        <NumberInput
          label="Hours"
          name="hours"
          value={value}
          min={0}
          max={2}
          decrementLabel="Decrease hours"
          incrementLabel="Increase hours"
          readOnly={readOnly}
          onValueChange={(next) => {
            changed(next);
            setValue(next);
          }}
        />
      );
    }
    try {
      act(() => root.render(<Harness />));
      const increment = required<HTMLButtonElement>(
        host,
        '[aria-label="Increase hours"]'
      );
      act(() => increment.click());
      expect(changed).toHaveBeenCalledExactlyOnceWith(2);
      act(() => increment.click());
      expect(changed).toHaveBeenCalledOnce();
      act(() => root.render(<Harness readOnly />));
      act(() =>
        required<HTMLButtonElement>(
          host,
          '[aria-label="Decrease hours"]'
        ).click()
      );
      expect(changed).toHaveBeenCalledOnce();
    } finally {
      act(() => root.unmount());
    }
  });

  it("supports slider keyboard steps and keeps disabled toggle actions inert", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const changed = vi.fn();
    const toggle = vi.fn();
    function Harness() {
      const [value, setValue] = useState(20);
      return (
        <>
          <Slider
            label="Scale"
            value={value}
            min={0}
            max={100}
            step={10}
            onValueChange={(next) => {
              changed(next);
              setValue(next);
            }}
          />
          <ToggleButton
            label="Unavailable"
            pressed={false}
            disabled
            onPressedChange={toggle}
          />
        </>
      );
    }
    try {
      act(() => root.render(<Harness />));
      const slider = required<HTMLInputElement>(host, 'input[type="range"]');
      act(() => {
        slider.focus();
        slider.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
        );
      });
      await vi.waitFor(() => expect(changed).toHaveBeenCalledWith(30));
      expect(slider.valueAsNumber).toBe(30);
      act(() => required<HTMLButtonElement>(host, "button[disabled]").click());
      expect(toggle).toHaveBeenCalledTimes(0);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });
});
