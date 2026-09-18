// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DocumentTextSearchPopover } from "./document-text-search-popover";

describe("document text search surfaces", () => {
  afterEach(cleanup);

  it("preserves search, result cycling, clear and reopen state in the mobile sheet", async () => {
    const onSearch = vi.fn((query: string) =>
      query === "bank" ? ["page-1", "page-3"] : []
    );
    const onNavigate = vi.fn();
    const onClear = vi.fn();
    render(
      <DocumentTextSearchPopover
        controlsDisabled={false}
        mobilePresentation="sheet"
        onSearch={onSearch}
        onNavigate={onNavigate}
        onClear={onClear}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Search text" }));
    const sheet = await screen.findByRole("dialog", { name: "Search text" });
    expect(sheet).toHaveClass("pw-mobile-sheet");
    const input = within(sheet).getByRole("searchbox", { name: "Search text" });
    fireEvent.change(input, { target: { value: "bank" } });
    expect(onSearch).toHaveBeenLastCalledWith("bank");
    expect(onNavigate).toHaveBeenLastCalledWith("page-1");
    await userEvent.click(
      within(sheet).getByRole("button", { name: "Next result" })
    );
    expect(onNavigate).toHaveBeenLastCalledWith("page-3");
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onNavigate).toHaveBeenLastCalledWith("page-1");
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Search text" })).toBeNull()
    );
    await userEvent.click(screen.getByRole("button", { name: "Search text" }));
    const reopened = await screen.findByRole("dialog", { name: "Search text" });
    expect(
      within(reopened).getByRole("searchbox", { name: "Search text" })
    ).toHaveValue("bank");
    await userEvent.click(
      within(reopened).getByRole("button", { name: "Clear" })
    );
    expect(onClear).toHaveBeenCalledOnce();
    expect(
      within(reopened).getByRole("button", { name: "Next result" })
    ).toBeDisabled();
    fireEvent.change(
      within(reopened).getByRole("searchbox", { name: "Search text" }),
      { target: { value: "missing" } }
    );
    expect(within(reopened).getByText("No results")).toBeVisible();
    expect(
      within(reopened).getByRole("button", { name: "Previous result" })
    ).toBeDisabled();
  });

  it("does not opt other callers into a bottom sheet", async () => {
    render(
      <DocumentTextSearchPopover
        controlsDisabled={false}
        onSearch={() => []}
        onNavigate={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Search text" }));
    await expect(
      screen.findByRole("textbox", { name: "Search text" })
    ).resolves.toBeVisible();
    expect(document.querySelector(".pw-mobile-sheet")).toBeNull();
  });

  it("prevents opening a mobile search before the document is ready", () => {
    const onSearch = vi.fn(() => []);
    render(
      <DocumentTextSearchPopover
        controlsDisabled
        mobilePresentation="sheet"
        onSearch={onSearch}
        onNavigate={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Search text" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Search text" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onSearch).toHaveBeenCalledTimes(0);
  });
});
