// @vitest-environment jsdom
import { ProjectWingThemeProvider } from "@project-wing/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectConfirmation } from "@/api/client";
import { defaultConfirmationsCopy as copy } from "@/i18n/dictionaries";

import { ConfirmationRegisterDataGrid } from "./confirmation-register-data-grid";
import {
  DEFAULT_CONFIRMATION_REGISTER_FILTERS,
  matchesConfirmationRegisterFilters,
} from "./confirmation-register-model";
import type { ConfirmationRegisterFilters } from "./confirmation-register-model";

type Props = Parameters<typeof ConfirmationRegisterDataGrid>[0];
function record(
  id: string,
  overrides: Partial<ProjectConfirmation> = {}
): ProjectConfirmation {
  return {
    id,
    projectId: "project",
    type: "BANK",
    status: "DRAFT",
    counterpartyName: `Bank ${id}`,
    respondingEntityName: "Client company",
    confirmationCode: `YH-${id}`,
    teamConfirmStatus: "PENDING",
    createdBy: "user",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-02T00:00:00Z",
    ...overrides,
  };
}
const first = record("001");
function setup(overrides: Partial<Props> = {}) {
  const props: Props = {
    confirmations: [first],
    filterConfirmations: [first],
    copy,
    locale: "en-US",
    editingName: "",
    editingNameId: null,
    hasSearchOrFilters: false,
    isRecycleBin: false,
    nameQuery: "",
    readOnly: false,
    filters: DEFAULT_CONFIRMATION_REGISTER_FILTERS,
    title: "All confirmations",
    onEditName: vi.fn(),
    onEditingNameChange: vi.fn(),
    onEditingNameCommit: vi.fn(),
    onEditingNameCancel: vi.fn(),
    onNameQueryChange: vi.fn(),
    showNew: true,
    onNew: vi.fn(),
    onOpen: vi.fn(),
    onVoidMany: vi.fn(),
    onRestoreMany: vi.fn(),
    isVoiding: false,
    isRestoring: false,
    lifecycleActionResetKey: 0,
    onFiltersChange: vi.fn(),
    onResetFilters: vi.fn(),
    ...overrides,
  };
  function Harness() {
    const [filters, setFilters] = useState<ConfirmationRegisterFilters>(
      props.filters
    );
    const [query, setQuery] = useState(props.nameQuery);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState("");
    return (
      <ProjectWingThemeProvider>
        <ConfirmationRegisterDataGrid
          {...props}
          filters={filters}
          nameQuery={query}
          editingNameId={editingId}
          editingName={name}
          confirmations={props.confirmations.filter(
            (row) =>
              matchesConfirmationRegisterFilters(row, filters) &&
              [row.counterpartyName, row.confirmationCode].some((value) =>
                value?.toLowerCase().includes(query.toLowerCase())
              )
          )}
          onFiltersChange={(value) => {
            props.onFiltersChange(value);
            setFilters(value);
          }}
          onNameQueryChange={(value) => {
            props.onNameQueryChange(value);
            setQuery(value);
          }}
          onEditName={(row) => {
            props.onEditName(row);
            setEditingId(row.id);
            setName(row.counterpartyName);
          }}
          onEditingNameChange={(value) => {
            props.onEditingNameChange(value);
            setName(value);
          }}
          onEditingNameCommit={(row) => {
            props.onEditingNameCommit(row);
            setEditingId(null);
          }}
          onEditingNameCancel={() => {
            props.onEditingNameCancel();
            setEditingId(null);
          }}
        />
      </ProjectWingThemeProvider>
    );
  }
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  client.setQueryData(["me"], null);
  render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>
  );
  return props;
}
function openControls() {
  fireEvent.click(screen.getByRole("button", { name: "List actions" }));
  return screen.findByRole("dialog", { name: "List actions" });
}
describe("mobile project confirmation register", () => {
  beforeEach(() => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query.includes("767"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("uses a full-width record instead of a table, without pagination for one page", async () => {
    const props = setup();
    const row = await screen.findByRole("link", { name: /Bank 001/ });
    expect(screen.queryByRole("table")).toBeNull();
    expect(
      screen.queryByRole("navigation", { name: "Confirmation pages" })
    ).toBeNull();
    expect(row).toHaveTextContent("Client company");
    expect(row).toHaveTextContent("YH-001");
    fireEvent.click(row);
    expect(props.onOpen).toHaveBeenCalledWith(first);
  });

  it("keeps details and explicit rename/save actions in a bottom sheet", async () => {
    const props = setup();
    fireEvent.click(
      await screen.findByRole("button", { name: "More actions: Bank 001" })
    );
    const sheet = await screen.findByRole("dialog", { name: "Bank 001" });
    expect(
      within(sheet).getByText(copy.register.columns.updatedAt)
    ).toBeVisible();
    expect(props.onOpen).not.toHaveBeenCalled();
    fireEvent.click(within(sheet).getByRole("button", { name: "Rename" }));
    fireEvent.change(
      await within(sheet).findByRole("textbox", {
        name: copy.renameInputLabel,
      }),
      { target: { value: "New bank name" } }
    );
    fireEvent.click(within(sheet).getByRole("button", { name: copy.save }));
    expect(props.onEditingNameChange).toHaveBeenCalledWith("New bank name");
    expect(props.onEditingNameCommit).toHaveBeenCalledWith(first);
  });

  it("cancels a rename when its sheet closes", async () => {
    const props = setup();
    fireEvent.click(
      await screen.findByRole("button", { name: "More actions: Bank 001" })
    );
    const sheet = await screen.findByRole("dialog", { name: "Bank 001" });
    fireEvent.click(within(sheet).getByRole("button", { name: "Rename" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    expect(props.onEditingNameCancel).toHaveBeenCalledOnce();
    expect(props.onEditingNameCommit).not.toHaveBeenCalled();
  });

  it("offers only simple status selection and keeps it wired to the register model", async () => {
    const sent = record("002", { status: "AWAITING_RESPONSE" });
    const props = setup({
      confirmations: [first, sent],
      filterConfirmations: [first, sent],
    });
    await screen.findByTestId("confirmation-register-mobile");
    const controls = await openControls();
    expect(within(controls).queryByRole("combobox")).toBeNull();
    expect(
      within(controls).queryByRole("button", { name: /Filter|Ascending|Reset/ })
    ).toBeNull();
    expect(
      within(controls).getByRole("button", { name: copy.newConfirmation })
    ).toBeVisible();
    fireEvent.click(within(controls).getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Status" }));
    const filter = await screen.findByRole("dialog", {
      name: "Status",
    });
    fireEvent.click(
      within(filter).getByRole("button", {
        name: copy.overview.matrix.columns.sent,
      })
    );
    expect(props.onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ currentStatus: ["SENT"] })
    );
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: /Bank 001/ })).toBeNull()
    );
    expect(screen.getByRole("link", { name: /Bank 002/ })).toBeVisible();
    expect(
      screen.queryByRole("button", {
        name: `Clear filter: ${copy.overview.matrix.columns.sent}`,
      })
    ).toBeNull();
    const selectedStatus = screen.getByRole("button", {
      name: `Status: ${copy.overview.matrix.columns.sent}`,
    });
    expect(selectedStatus).toHaveTextContent(copy.overview.matrix.columns.sent);
    fireEvent.click(selectedStatus);
    const selectedSheet = await screen.findByRole("dialog", { name: "Status" });
    fireEvent.click(
      within(selectedSheet).getByRole("button", { name: "All statuses" })
    );
    expect(props.onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ currentStatus: [] })
    );
  });

  it("closes the controls before entering selection and sends only selected rows", async () => {
    const props = setup();
    await screen.findByTestId("confirmation-register-mobile");
    const controls = await openControls();
    fireEvent.click(
      within(controls).getByRole("button", { name: copy.register.deleteMode })
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: copy.register.selectRow.replace("{name}", "Bank 001"),
      })
    );
    expect(screen.queryByRole("dialog", { name: "List actions" })).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: copy.register.deleteSelected })
    );
    expect(props.onVoidMany).toHaveBeenCalledWith([first]);
    expect(props.onOpen).not.toHaveBeenCalled();
  });

  it("retains restore mode and honors read-only restrictions", async () => {
    const recycled = record("001", { status: "VOIDED" });
    const props = setup({
      confirmations: [recycled],
      filterConfirmations: [recycled],
      isRecycleBin: true,
      showNew: false,
    });
    await screen.findByTestId("confirmation-register-mobile");
    const controls = await openControls();
    expect(
      within(controls).queryByRole("button", { name: copy.newConfirmation })
    ).toBeNull();
    fireEvent.click(
      within(controls).getByRole("button", { name: copy.register.restoreMode })
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: copy.register.selectRow.replace("{name}", "Bank 001"),
      })
    );
    fireEvent.click(
      screen.getByRole("button", { name: copy.register.restoreSelected })
    );
    expect(props.onRestoreMany).toHaveBeenCalledWith([recycled]);
    cleanup();
    setup({ readOnly: true });
    await screen.findByTestId("confirmation-register-mobile");
    const readOnlyControls = await openControls();
    expect(
      within(readOnlyControls).getByRole("button", {
        name: copy.newConfirmation,
      })
    ).toBeDisabled();
    expect(
      within(readOnlyControls).getByRole("button", {
        name: copy.register.deleteMode,
      })
    ).toBeDisabled();
  });

  it("loads more without discarding visible rows or selection and keeps search working", async () => {
    const rows = Array.from({ length: 31 }, (_, index) =>
      record(String(index + 1).padStart(3, "0"))
    );
    const props = setup({ confirmations: rows, filterConfirmations: rows });
    await screen.findByTestId("confirmation-register-mobile");
    const controls = await openControls();
    fireEvent.click(
      within(controls).getByRole("button", { name: copy.register.deleteMode })
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: copy.register.selectRow.replace("{name}", "Bank 001"),
      })
    );
    expect(screen.queryByRole("link", { name: /Bank 031/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(
      screen.getByRole("button", { name: copy.register.deleteSelected })
    ).toBeEnabled();
    expect(screen.getByRole("link", { name: /Bank 001/ })).toBeVisible();
    expect(screen.getByRole("link", { name: /Bank 031/ })).toBeVisible();
    fireEvent.change(
      screen.getByRole("textbox", { name: copy.filter.searchLabel }),
      { target: { value: "YH-002" } }
    );
    expect(props.onNameQueryChange).toHaveBeenCalledWith("YH-002");
    expect(screen.getByRole("link", { name: /Bank 002/ })).toBeVisible();
  });

  it("orders mobile rows by latest update without exposing sort controls", async () => {
    const second = record("002", { updatedAt: "2026-07-02T08:00:00Z" });
    setup({
      confirmations: [first, second],
      filterConfirmations: [first, second],
    });
    await screen.findByTestId("confirmation-register-mobile");
    await waitFor(() =>
      expect(
        screen.getAllByRole("link").map((link) => link.textContent)
      ).toStrictEqual([
        expect.stringContaining("Bank 002"),
        expect.stringContaining("Bank 001"),
      ])
    );
    const controls = await openControls();
    expect(within(controls).queryByRole("combobox")).toBeNull();
  });

  it("shows inherited overview and desktop conditions and clears only the chosen condition", async () => {
    const filters = {
      ...DEFAULT_CONFIRMATION_REGISTER_FILTERS,
      type: ["BANK"],
      waitingTime: ["46_PLUS" as const],
      responseOutcome: ["MISMATCH" as const],
      baseDate: ["2026-07-01"],
    };
    const props = setup({ filters });
    await screen.findByTestId("confirmation-register-mobile");
    expect(
      screen.getByRole("button", { name: "Clear filter: Response mismatch" })
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", {
        name: `Clear filter: ${copy.register.bank}`,
      })
    );
    expect(props.onFiltersChange).toHaveBeenLastCalledWith({
      ...filters,
      type: [],
    });
    expect(
      screen.getByRole("button", { name: /Clear filter:.*46/ })
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Clear filter:.*2026/ })
    ).toBeVisible();
  });
});
