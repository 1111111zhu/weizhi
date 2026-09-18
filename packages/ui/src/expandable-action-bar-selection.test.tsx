// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { ExpandableActionBar } from "./expandable-action-bar";

describe("expandable action bar selection", () => {
  it("moves selection on click before navigation completes and keeps only one active item", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const items = [
      { id: "home", label: "Home", icon: null, active: true },
      {
        id: "confirmation",
        label: "Confirmation",
        icon: null,
        onClick: vi.fn(),
      },
      { id: "tasks", label: "Tasks", icon: null, active: true },
    ];
    try {
      await act(() =>
        root.render(
          <ExpandableActionBar
            items={items}
            activeId="tasks"
            selectOnAction
            expanded
          />
        )
      );
      expect(container.querySelectorAll('[data-active="true"]')).toHaveLength(
        1
      );
      expect(
        container.querySelector('[data-active="true"]')?.dataset.actionId
      ).toBe("tasks");
      const confirmationButton = container.querySelector<HTMLButtonElement>(
        '[data-action-id="confirmation"]'
      );
      if (!confirmationButton) {
        throw new Error("Expected the confirmation action button");
      }
      await act(() => confirmationButton.click());
      expect(container.querySelectorAll('[data-active="true"]')).toHaveLength(
        1
      );
      expect(
        container.querySelector('[data-active="true"]')?.dataset.actionId
      ).toBe("confirmation");
      await act(() =>
        root.render(
          <ExpandableActionBar
            items={items}
            activeId="home"
            selectOnAction
            expanded
          />
        )
      );
      expect(
        container.querySelector('[data-active="true"]')?.dataset.actionId
      ).toBe("home");
    } finally {
      await act(() => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
    }
  });
});
