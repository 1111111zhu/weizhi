// @vitest-environment jsdom
import { Button } from "@project-wing/ui";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DocxToolbar } from "./docx-viewer";

type Props = ComponentProps<typeof DocxToolbar>;

function fixture(overrides: Partial<Props> = {}): Props {
  let page = 1;
  const listeners = new Set<() => void>();
  const store: Props["activePageStore"] = {
    getSnapshot: () => page,
    setActivePage: (valueOrUpdater) => {
      page =
        typeof valueOrUpdater === "function"
          ? valueOrUpdater(page)
          : valueOrUpdater;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return {
    activePageStore: store,
    controlsDisabled: false,
    fileName: "Bank confirmation.docx",
    isDark: false,
    isPreparingDownload: false,
    onDownload: vi.fn(),
    onIsDarkChange: vi.fn(),
    onPageChange: vi.fn((next) => store.setActivePage(next)),
    onShowCommentsChange: vi.fn(),
    onShowTrackedChangesChange: vi.fn(),
    onTogglePan: vi.fn(),
    onToggleSelection: vi.fn(),
    onToggleSidebar: vi.fn(),
    onUploadClick: vi.fn(),
    pageCount: 3,
    panModeEnabled: false,
    selectionModeEnabled: false,
    setZoomScale: vi.fn(),
    showComments: false,
    showNightRenderToggle: true,
    showPanControl: true,
    showSelectionControl: true,
    showTrackedChanges: false,
    zoomScale: 50,
    ...overrides,
  };
}

function mobile() {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe("DOCX mobile toolbar", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("preserves page navigation and bounded direct page entry", async () => {
    mobile();
    const props = fixture();
    render(<DocxToolbar {...props} />);
    expect(
      screen.getByRole("button", { name: "Previous page" })
    ).toBeDisabled();
    await userEvent.click(
      screen.getByRole("button", { name: "Toggle thumbnails" })
    );
    expect(props.onToggleSidebar).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(props.onPageChange).toHaveBeenLastCalledWith(2);
    await userEvent.click(
      screen.getByRole("button", { name: /Current page 2/ })
    );
    const sheet = await screen.findByRole("dialog", { name: "Go to page" });
    const pageInput = within(sheet).getByRole("textbox", {
      name: "Page number",
    });
    fireEvent.change(pageInput, { target: { value: "" } });
    expect(within(sheet).getByRole("button", { name: "Go" })).toBeDisabled();
    fireEvent.change(pageInput, { target: { value: "99" } });
    await userEvent.click(within(sheet).getByRole("button", { name: "Go" }));
    expect(props.onPageChange).toHaveBeenLastCalledWith(3);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("retains zoom, optional view controls and injected actions in the tools sheet", async () => {
    mobile();
    const extra = vi.fn();
    const props = fixture({
      toolbarActions: <Button onClick={extra}>External preview action</Button>,
    });
    render(<DocxToolbar {...props} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Zoom in" })).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Open DOCX actions" })
    );
    const sheet = await screen.findByRole("dialog", { name: "Document tools" });
    expect(sheet).toHaveClass("pw-mobile-sheet");
    await userEvent.click(within(sheet).getByRole("button", { name: "100%" }));
    expect(props.setZoomScale).toHaveBeenLastCalledWith(100);
    for (const [label, callback] of [
      ["Comments", props.onShowCommentsChange],
      ["Edits", props.onShowTrackedChangesChange],
      ["Dark mode", props.onIsDarkChange],
    ] as const) {
      await userEvent.click(within(sheet).getByRole("button", { name: label }));
      expect(callback).toHaveBeenLastCalledWith(true);
    }
    await userEvent.click(
      within(sheet).getByRole("button", { name: "Pan document" })
    );
    expect(props.onTogglePan).toHaveBeenCalledOnce();
    await userEvent.click(
      within(sheet).getByRole("button", { name: "Select fields" })
    );
    expect(props.onToggleSelection).toHaveBeenCalledOnce();
    await userEvent.click(
      within(sheet).getByRole("button", { name: "Download" })
    );
    expect(props.onDownload).toHaveBeenCalledOnce();
    await userEvent.click(
      within(sheet).getByRole("button", { name: "External preview action" })
    );
    expect(extra).toHaveBeenCalledOnce();
    await userEvent.click(
      within(sheet).getByRole("button", { name: "Upload" })
    );
    expect(props.onUploadClick).toHaveBeenCalledOnce();
  });

  it("keeps loading navigation disabled and respects hidden upload/download actions", async () => {
    mobile();
    render(
      <DocxToolbar
        {...fixture({
          controlsDisabled: true,
          pageCount: 0,
          showUploadButton: false,
          showDownloadButton: false,
        })}
      />
    );
    for (const name of ["Previous page", "Next page", "Toggle thumbnails"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
    await userEvent.click(
      screen.getByRole("button", { name: "Open DOCX actions" })
    );
    const sheet = await screen.findByRole("dialog", { name: "Document tools" });
    expect(
      within(sheet).getByRole("button", { name: "Zoom in" })
    ).toBeDisabled();
    expect(
      within(sheet).queryByRole("button", { name: "Download" })
    ).toBeNull();
    expect(within(sheet).queryByRole("button", { name: "Upload" })).toBeNull();
  });

  it("keeps the desktop toolbar in its original full layout", () => {
    const props = fixture();
    render(<DocxToolbar {...props} />);
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeVisible();
    expect(screen.getByRole("combobox")).toBeVisible();
    expect(document.querySelector("[data-docx-mobile-toolbar]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(props.setZoomScale).toHaveBeenCalledOnce();
  });
});
