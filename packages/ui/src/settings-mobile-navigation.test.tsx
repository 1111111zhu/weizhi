import { Settings } from "lucide-react";
// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsDialogShell } from "./settings-dialog-shell";

function required<E extends Element>(root: ParentNode, selector: string): E {
  const element = root.querySelector<E>(selector);
  if (!element) {
    throw new Error(`Missing ${selector}`);
  }
  return element;
}

const items = [
  { id: "personal", label: "Personalization", icon: Settings },
  { id: "integrations", label: "Connections", icon: Settings },
];
describe("mobile settings list and detail", () => {
  beforeEach(() =>
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
  afterEach(() => vi.unstubAllGlobals());

  it("opens every supplied destination, returns focus and keeps the mounted draft", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const changed = vi.fn();
    function Harness() {
      const [active, setActive] = useState("personal");
      return (
        <SettingsDialogShell
          activeId={active}
          items={items}
          breadcrumbRoot="Settings"
          navigationLabel="Categories"
          mobileNavigation="pages"
          mobileBackLabel="Back to settings"
          onActiveIdChange={(id) => {
            changed(id);
            setActive(id);
          }}
        >
          <input aria-label="Draft" defaultValue="Unsaved" />
        </SettingsDialogShell>
      );
    }
    try {
      act(() => root.render(<Harness />));
      const index = required<HTMLElement>(
        container,
        '[data-slot="settings-mobile-index"]'
      );
      const destinations = index.querySelectorAll("button");
      expect(destinations).toHaveLength(2);
      const draft = required<HTMLInputElement>(container, "input");
      act(() => (destinations[1] as HTMLButtonElement).click());
      expect(changed).toHaveBeenLastCalledWith("integrations");
      expect(document.activeElement?.textContent).toBe("Connections");
      draft.value = "Keep my unsaved input";
      act(() =>
        (
          container.querySelector(
            '[aria-label="Back to settings"]'
          ) as HTMLButtonElement
        ).click()
      );
      expect(document.activeElement).toBe(destinations[1]);
      act(() => (destinations[1] as HTMLButtonElement).click());
      expect(container.querySelector("input")).toBe(draft);
      expect(draft.value).toBe("Keep my unsaved input");
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it("opens contextual destinations and a repeated external request after returning", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const view = (key: number) => (
      <SettingsDialogShell
        activeId="personal"
        items={items}
        breadcrumbRoot="Settings"
        navigationLabel="Categories"
        mobileNavigation="pages"
        mobileInitialDetail
        mobileDetailRequestKey={key}
        mobileBackLabel="Back"
        onActiveIdChange={() => {}}
      >
        Existing business panel
      </SettingsDialogShell>
    );
    try {
      act(() => root.render(view(1)));
      const index = required<HTMLElement>(
        container,
        '[data-slot="settings-mobile-index"]'
      );
      expect(index.classList.contains("hidden")).toBeTruthy();
      act(() =>
        (
          container.querySelector('[aria-label="Back"]') as HTMLButtonElement
        ).click()
      );
      expect(index.classList.contains("hidden")).toBeFalsy();
      act(() => root.render(view(2)));
      expect(index.classList.contains("hidden")).toBeTruthy();
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it("does not invent privileged destinations absent from the caller inventory", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onActiveIdChange = vi.fn();
    try {
      act(() =>
        root.render(
          <SettingsDialogShell
            activeId="personal"
            items={items.slice(0, 1)}
            breadcrumbRoot="Settings"
            navigationLabel="Categories"
            mobileNavigation="pages"
            onActiveIdChange={onActiveIdChange}
          >
            Content
          </SettingsDialogShell>
        )
      );
      expect(
        container.querySelectorAll('[data-slot="settings-mobile-index"] button')
      ).toHaveLength(1);
      expect(container.textContent).not.toContain("Connections");
      act(() =>
        required<HTMLButtonElement>(
          container,
          '[data-slot="settings-mobile-index"] button'
        ).click()
      );
      expect(onActiveIdChange).toHaveBeenCalledExactlyOnceWith("personal");
      expect(container.textContent).not.toContain("Connections");
    } finally {
      act(() => root.unmount());
    }
  });
});
