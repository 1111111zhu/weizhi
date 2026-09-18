// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ComboboxField } from "./combobox-field";

const options = [
  { value: "", label: "Unassigned" },
  { value: "alpha", label: "Alpha team" },
  { value: "blocked", label: "Blocked team", disabled: true },
  { value: "gamma", label: "Gamma team" },
];

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing control: ${selector}`);
  }
  return element;
}

describe("combobox semantic selection contract", () => {
  beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
  afterEach(() => vi.unstubAllGlobals());

  it("filters without changing selection, selects by value, resets search and restores focus", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const changed = vi.fn();
    function Harness() {
      const [value, setValue] = useState("alpha");
      return (
        <form>
          <ComboboxField
            name="destination"
            label="Destination"
            searchLabel="Search teams"
            emptyMessage="No teams"
            value={value}
            options={options}
            onValueChange={(next) => {
              changed(next);
              setValue(next);
            }}
          />
        </form>
      );
    }
    try {
      act(() => root.render(<Harness />));
      const trigger = required<HTMLButtonElement>(
        'button[aria-label="Destination"]'
      );
      expect(
        new FormData(required<HTMLFormElement>("form")).get("destination")
      ).toBe("alpha");
      act(() => trigger.click());
      await vi.waitFor(() =>
        expect(document.querySelector('[role="listbox"]')).not.toBeNull()
      );
      const input = required<HTMLInputElement>(
        'input[aria-label="Search teams"]'
      );
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      if (!setter) {
        throw new Error("Missing native input value setter");
      }
      act(() => {
        setter.call(input, "Gamma");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await vi.waitFor(() =>
        expect(document.querySelectorAll('[role="option"]')).toHaveLength(1)
      );
      expect(changed).toHaveBeenCalledTimes(0);
      act(() => {
        input.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
        );
        input.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
        );
      });
      await vi.waitFor(() => expect(changed).toHaveBeenCalledWith("gamma"));
      await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
      expect(
        new FormData(required<HTMLFormElement>("form")).get("destination")
      ).toBe("gamma");
      act(() => trigger.click());
      await vi.waitFor(() =>
        expect(
          required<HTMLInputElement>('input[aria-label="Search teams"]').value
        ).toBe("")
      );
      act(() =>
        required<HTMLInputElement>(
          'input[aria-label="Search teams"]'
        ).dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
        )
      );
      await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
      expect(changed).toHaveBeenCalledOnce();
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("keeps disabled choices inert and associates validation with the trigger", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const changed = vi.fn();
    try {
      act(() =>
        root.render(
          <>
            <ComboboxField
              label="Destination"
              searchLabel="Search teams"
              emptyMessage="No teams"
              descriptionId="destination-error"
              invalid
              value="alpha"
              options={options}
              onValueChange={changed}
            />
            <p id="destination-error">Choose an available team</p>
          </>
        )
      );
      const trigger = required<HTMLButtonElement>(
        'button[aria-label="Destination"]'
      );
      expect(trigger.getAttribute("aria-invalid")).toBe("true");
      expect(trigger.getAttribute("aria-describedby")).toBe(
        "destination-error"
      );
      act(() => trigger.click());
      await vi.waitFor(() =>
        expect(document.querySelectorAll('[role="option"]')).toHaveLength(4)
      );
      const blocked = [
        ...document.querySelectorAll<HTMLElement>('[role="option"]'),
      ].find((option) => option.textContent?.includes("Blocked team"));
      if (!blocked) {
        throw new Error("Missing disabled option");
      }
      expect(blocked.getAttribute("aria-disabled")).toBe("true");
      act(() => blocked.click());
      expect(changed).toHaveBeenCalledTimes(0);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("prevents changes while loading or read-only without turning read-only into disabled", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const changed = vi.fn();
    const props = {
      label: "Destination",
      searchLabel: "Search teams",
      emptyMessage: "No teams",
      value: "alpha",
      options,
      onValueChange: changed,
    };
    try {
      act(() => root.render(<ComboboxField {...props} loading />));
      const trigger = required<HTMLButtonElement>(
        'button[aria-label="Destination"]'
      );
      expect(trigger.disabled === true).toBeTruthy();
      expect(trigger.getAttribute("aria-busy")).toBe("true");
      act(() => trigger.click());
      expect(changed).toHaveBeenCalledTimes(0);
      act(() => root.render(<ComboboxField {...props} readOnly />));
      expect(trigger.disabled === false).toBeTruthy();
      act(() => trigger.focus());
      expect(document.activeElement).toBe(trigger);
      act(() => trigger.click());
      expect(changed).toHaveBeenCalledTimes(0);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });
});
