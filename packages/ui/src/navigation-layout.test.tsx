// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AppShell,
  NavigationList,
  ScrollArea,
  SearchResults,
} from "./navigation-layout";
import { TreeView } from "./tree-view";

function required<T extends Element>(host: ParentNode, selector: string): T {
  const node = host.querySelector<T>(selector);
  if (!node) {
    throw new Error(`Missing ${selector}`);
  }
  return node;
}

describe("shared navigation activation and focus contracts", () => {
  beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
  afterEach(() => vi.unstubAllGlobals());

  it("expands the tree with the keyboard, skips disabled items and selects the focused leaf", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const select = vi.fn();
    try {
      act(() =>
        root.render(
          <TreeView
            label="Directories"
            items={[
              {
                id: "planning",
                label: "Planning",
                children: [
                  { id: "disabled", label: "Unavailable", disabled: true },
                  { id: "bank", label: "Bank" },
                ],
              },
              { id: "reports", label: "Reports" },
            ]}
            onSelect={select}
            expandLabel="Expand"
            collapseLabel="Collapse"
            emptyMessage="No directories"
          />
        )
      );
      const parent = required<HTMLElement>(host, '[role="treeitem"]');
      act(() => {
        parent.focus();
        parent.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
        );
      });
      expect(parent.getAttribute("aria-expanded")).toBe("true");
      act(() =>
        parent.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
        )
      );
      const leaf = document.activeElement;
      expect(leaf?.textContent).toBe("Bank");
      act(() =>
        leaf?.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
        )
      );
      expect(select).toHaveBeenCalledExactlyOnceWith("bank");
      act(() =>
        leaf?.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
        )
      );
      expect(document.activeElement).toBe(parent);
      act(() =>
        parent.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
        )
      );
      expect(parent.getAttribute("aria-expanded")).toBe("false");
      expect(host.querySelectorAll('[role="treeitem"]')).toHaveLength(2);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("preserves modified link navigation and rejects disabled destinations", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const select = vi.fn();
    try {
      act(() =>
        root.render(
          <NavigationList
            label="Workspace"
            selectedId="files"
            onSelect={select}
            items={[
              { id: "files", label: "Files", href: "/files" },
              {
                id: "restricted",
                label: "Restricted",
                href: "/restricted",
                disabled: true,
              },
            ]}
          />
        )
      );
      const link = required<HTMLAnchorElement>(host, "a");
      const modified = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
      });
      act(() => link.dispatchEvent(modified));
      expect(modified.defaultPrevented === false).toBeTruthy();
      expect(select).toHaveBeenCalledTimes(0);
      act(() => link.click());
      expect(select).toHaveBeenCalledExactlyOnceWith("files");
      expect(link.getAttribute("aria-current")).toBe("page");
      act(() =>
        required<HTMLAnchorElement>(host, '[aria-disabled="true"]').click()
      );
      expect(select).toHaveBeenCalledOnce();
    } finally {
      act(() => root.unmount());
    }
  });

  it("opens mobile navigation and dismisses it after selecting a destination", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const navigate = vi.fn();
    try {
      act(() =>
        root.render(
          <AppShell
            label="Firm workspace"
            navigationLabel="Open navigation"
            closeNavigationLabel="Close navigation"
            navigation={[{ id: "files", label: "Files" }]}
            onNavigate={navigate}
          >
            Current workspace
          </AppShell>
        )
      );
      const trigger = required<HTMLButtonElement>(
        host,
        'button[aria-label="Open navigation"]'
      );
      act(() => {
        trigger.focus();
        trigger.click();
      });
      await vi.waitFor(() =>
        expect(document.querySelector('[role="dialog"]')).not.toBeNull()
      );
      act(() =>
        required<HTMLButtonElement>(
          required(document, '[role="dialog"]'),
          "nav button"
        ).click()
      );
      expect(navigate).toHaveBeenCalledExactlyOnceWith("files");
      await vi.waitFor(() =>
        expect(document.querySelector('[role="dialog"]')).toBeNull()
      );
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("offers retry for failed search and keeps its scroll region keyboard reachable", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const retry = vi.fn();
    try {
      act(() =>
        root.render(
          <ScrollArea label="Search area">
            <SearchResults label="Results" items={[]} error onRetry={retry} />
          </ScrollArea>
        )
      );
      act(() => required<HTMLButtonElement>(host, "button").click());
      expect(retry).toHaveBeenCalledExactlyOnceWith();
      act(() =>
        required<HTMLElement>(host, 'section[aria-label="Search area"]').focus()
      );
      expect(document.activeElement).toBe(host.firstElementChild);
      act(() =>
        root.render(
          <ScrollArea label="Search area">
            <SearchResults
              label="Results"
              items={[{ id: "file", label: "Found file", href: "/file" }]}
            />
          </ScrollArea>
        )
      );
      expect(host.querySelector('[role="alert"]')).toBeNull();
      expect(required<HTMLAnchorElement>(host, "a").getAttribute("href")).toBe(
        "/file"
      );
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });
});
