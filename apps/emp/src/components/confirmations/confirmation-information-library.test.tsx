import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfirmationInformationLibrary } from "./confirmation-information-library";

// @vitest-environment jsdom

const mockConfirmationInformationLibrary = vi.hoisted(() => vi.fn());
const mockCreateConfirmationInformationLibrary = vi.hoisted(() => vi.fn());
const mockUpdateConfirmationInformationLibrary = vi.hoisted(() => vi.fn());
const mockDeleteConfirmationInformationLibrary = vi.hoisted(() => vi.fn());
const mockRestoreConfirmationInformationLibrary = vi.hoisted(() => vi.fn());

vi.mock("../../api/client", () => ({
  api: {
    confirmationInformationLibrary: mockConfirmationInformationLibrary,
    createConfirmationInformationLibrary:
      mockCreateConfirmationInformationLibrary,
    updateConfirmationInformationLibrary:
      mockUpdateConfirmationInformationLibrary,
    deleteConfirmationInformationLibrary:
      mockDeleteConfirmationInformationLibrary,
    restoreConfirmationInformationLibrary:
      mockRestoreConfirmationInformationLibrary,
  },
}));

const copy = {
  title: "Confirmation information library",
  description: "Maintain bank information used by confirmation templates.",
  add: "Add bank",
  moreActions: "More actions",
  actions: "Actions",
  columnMenu: {
    clear: "Clear filter",
    empty: "No values found",
    filter: "Filter",
    search: "Search",
  },
  actionError: "The bank information operation failed. Please retry.",
  rowsPerPage: "Rows per page",
  rowsPerPageSuffix: " / page",
  searchPlaceholder: "Search bank code, name, address, or contact",
  resultCount: "{count} banks",
  showInactive: "Show inactive",
  loading: "Loading information library...",
  loadError: "The information library could not load. Please retry.",
  empty: "No bank information",
  noResults: "No matching banks",
  emptyValue: "—",
  code: "Bank code",
  sourceLabel: "Source",
  sourceRow: "Source row",
  bankNameEn: "English name",
  bankNameZh: "Chinese name",
  bankType: "Bank type",
  effectiveMailingAddress: "Effective mailing address",
  businessAddress: "Business address",
  mailingAddress: "Confirmation mailing address",
  notes: "Notes",
  cautions: "Cautions",
  completeness: "Information status",
  ready: "Complete",
  incomplete: "Incomplete",
  active: "Active",
  inactive: "Inactive",
  edit: "Edit",
  deactivate: "Deactivate",
  restore: "Restore",
  form: {
    createTitle: "Add bank information",
    editTitle: "Edit bank information",
    description: "Keep the bank's confirmation contact details current.",
    bankCode: "Bank code",
    bankCodePlaceholder: "Three digits, for example 012",
    bankNameEn: "English name",
    bankNameZh: "Chinese name",
    bankType: "Bank type",
    businessAddress: "Business address",
    mailingAddress: "Confirmation mailing address",
    mailingAddressSameAsBusiness:
      "Mailing address is the same as business address",
    contactName: "Contact",
    attention: "Attn",
    notes: "Notes",
    background: "Background",
    sourceLabel: "Source",
    sourceRow: "Source row",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving...",
    saveError: "The bank information could not be saved.",
  },
};
const accessCopy = {
  complete: "Complete information",
  readOnlyTitle: "Read-only access",
  readOnlyDescription:
    "Management actions require SUPER_ADMIN permission. This account can view and search only.",
};
const bankOfChina = {
  id: "hk-bank-012",
  bankCode: "012",
  bankNameEn: "Bank of China (Hong Kong) Limited",
  bankNameZh: "中国银行（香港）有限公司",
  bankType: "Local registered bank",
  businessAddress: "Bank of China Tower, 1 Garden Road, Central, Hong Kong",
  mailingAddress:
    "3/F, Bank of China Centre, Olympian City, 11 Hoi Fai Road, West Kowloon",
  mailingAddressSameAsBusiness: false,
  contactName: "Bank confirmation team",
  attention: "Bank confirmation",
  notes: null,
  background: null,
  sourceLabel: "Hong Kong bank confirmation workbook",
  sourceRow: 9,
  effectiveMailingAddress:
    "3/F, Bank of China Centre, Olympian City, 11 Hoi Fai Road, West Kowloon",
  isReadyForDispatch: true,
  isActive: true,
  createdAt: "2026-08-13T00:00:00.000Z",
  updatedAt: "2026-08-13T00:00:00.000Z",
};

function renderLibrary(canManage = true, locale: "zh-CN" | "en-US" = "en-US") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ConfirmationInformationLibrary
        copy={copy}
        canManage={canManage}
        accessCopy={accessCopy}
        locale={locale}
      />
    </QueryClientProvider>
  );
  return { queryClient, ...view };
}

function informationRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    ...bankOfChina,
    id: `hk-bank-${String(index + 1).padStart(3, "0")}`,
    bankCode: String(index + 1).padStart(3, "0"),
    bankNameEn: `Bank ${index + 1}`,
    bankNameZh: `银行 ${index + 1}`,
  }));
}

describe(ConfirmationInformationLibrary, () => {
  it("saves the bank own-format restriction for administrators", async () => {
    renderLibrary();
    fireEvent.click(await screen.findByText(bankOfChina.bankNameEn));
    fireEvent.click(screen.getByRole("checkbox", { name: "Requires bank-provided format" }));
    await waitFor(() => expect(mockUpdateConfirmationInformationLibrary).toHaveBeenCalledWith(
      bankOfChina.id, { requiresBankTemplate: true }
    ));
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirmationInformationLibrary.mockResolvedValue([bankOfChina]);
    mockCreateConfirmationInformationLibrary.mockResolvedValue(bankOfChina);
    mockUpdateConfirmationInformationLibrary.mockResolvedValue(bankOfChina);
    mockDeleteConfirmationInformationLibrary.mockResolvedValue({
      ...bankOfChina,
      isActive: false,
    });
    mockRestoreConfirmationInformationLibrary.mockResolvedValue(bankOfChina);
  });

  afterEach(cleanup);

  it("fits the library into five localized columns without a horizontal table width", async () => {
    renderLibrary(false, "zh-CN");

    await expect(screen.findByText("012")).resolves.toBeVisible();
    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent)
    ).toStrictEqual([
      expect.stringContaining(copy.code),
      expect.stringContaining(copy.bankNameZh),
      expect.stringContaining(copy.bankType),
      expect.stringContaining(copy.mailingAddress),
      expect.stringContaining(copy.businessAddress),
    ]);
    expect(screen.getByText(bankOfChina.bankNameZh)).toBeVisible();
    expect(screen.queryByText(bankOfChina.bankNameEn)).not.toBeInTheDocument();

    const grid = screen.getByTestId(
      "confirmation-information-library-data-grid"
    );
    const table = grid.querySelector('[data-slot="data-grid-table"]');
    expect(table).toHaveClass("w-full", "min-w-full", "table-fixed");
    expect(table).not.toHaveAttribute("style");
  });

  it("offers 30, 40, and 50 rows per page and resets to the first page", async () => {
    const user = userEvent.setup();
    mockConfirmationInformationLibrary.mockResolvedValue(informationRows(51));
    renderLibrary();

    const grid = await screen.findByTestId(
      "confirmation-information-library-data-grid"
    );
    await expect(within(grid).findByText("Bank 1")).resolves.toBeVisible();
    expect(within(grid).getAllByRole("row")).toHaveLength(31);
    expect(screen.getByText("1-30 / 51")).toBeVisible();

    const pageSize = screen.getByRole("combobox", { name: "Rows per page" });
    await user.click(pageSize);
    const pageSizeOptions = await screen.findAllByRole("option");
    expect(pageSizeOptions.map((option) => option.textContent)).toStrictEqual([
      "30 / page",
      "40 / page",
      "50 / page",
    ]);
    expect(screen.queryByText("Rows per page")).not.toBeInTheDocument();
    expect(
      screen
        .getByRole("button", { name: "Page 1" })
        .compareDocumentPosition(pageSize) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    const librarySection = grid.closest("section");
    expect(librarySection).toHaveClass("h-full", "min-h-0");
    expect(librarySection).not.toHaveClass("min-h-full");

    await user.click(screen.getByRole("option", { name: "40 / page" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("option", { name: "40 / page" })
      ).not.toBeInTheDocument()
    );
    await waitFor(() =>
      expect(within(grid).getAllByRole("row")).toHaveLength(41)
    );
    expect(screen.getByText("1-40 / 51")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Page 2" }));
    await waitFor(() =>
      expect(within(grid).getAllByRole("row")).toHaveLength(12)
    );
    expect(screen.getByText("41-51 / 51")).toBeVisible();

    await user.click(screen.getByRole("combobox", { name: "Rows per page" }));
    await user.click(await screen.findByRole("option", { name: "50 / page" }));
    await waitFor(() =>
      expect(within(grid).getAllByRole("row")).toHaveLength(51)
    );
    expect(screen.getByText("1-50 / 51")).toBeVisible();
  });

  it("filters the complete information library before paginating", async () => {
    const user = userEvent.setup();
    mockConfirmationInformationLibrary.mockResolvedValue(informationRows(51));
    renderLibrary();

    const grid = await screen.findByTestId(
      "confirmation-information-library-data-grid"
    );
    await expect(within(grid).findByText("Bank 1")).resolves.toBeVisible();
    const codeFilter = within(grid).getByRole("button", {
      name: `${copy.columnMenu.filter} ${copy.code}`,
    });
    await user.click(codeFilter);
    const filter = screen
      .getByRole("searchbox", { name: copy.columnMenu.search })
      .closest('[data-slot="popover-content"]') as HTMLElement;
    await user.click(within(filter).getByRole("checkbox", { name: "051" }));

    await expect(within(grid).findByText("Bank 51")).resolves.toBeVisible();
    expect(within(grid).getAllByRole("row")).toHaveLength(2);
    expect(screen.queryByText("1-30 / 51")).not.toBeInTheDocument();
  });

  it("derives the confirmation mailing column only from the same-address choice", async () => {
    const separateAddress = {
      ...bankOfChina,
      id: "separate",
      bankCode: "101",
      mailingAddressSameAsBusiness: false,
      mailingAddress: "Separate confirmation address",
      effectiveMailingAddress: "Incorrect effective fallback",
    };
    const sameAddress = {
      ...bankOfChina,
      id: "same",
      bankCode: "102",
      mailingAddressSameAsBusiness: true,
      mailingAddress: "Stale separate address",
      effectiveMailingAddress: "Incorrect effective fallback",
    };
    const emptyAddress = {
      ...bankOfChina,
      id: "empty",
      bankCode: "103",
      mailingAddressSameAsBusiness: false,
      mailingAddress: null,
      effectiveMailingAddress: bankOfChina.businessAddress,
    };
    mockConfirmationInformationLibrary.mockResolvedValue([
      separateAddress,
      sameAddress,
      emptyAddress,
    ]);

    renderLibrary(false);

    await expect(
      screen.findByText("Separate confirmation address")
    ).resolves.toBeVisible();
    expect(screen.getAllByText(bankOfChina.businessAddress)).toHaveLength(4);
    expect(screen.getByText(copy.emptyValue)).toBeVisible();
    expect(
      screen.queryByText("Incorrect effective fallback")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Stale separate address")
    ).not.toBeInTheDocument();
  });

  it("shows read-only notes only as a conditional top caution", async () => {
    mockConfirmationInformationLibrary.mockResolvedValue([
      { ...bankOfChina, notes: "Use the bank's own format" },
    ]);
    renderLibrary(false);

    fireEvent.click(await screen.findByText("012"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(copy.cautions)).toBeVisible();
    expect(within(dialog).getByText("Use the bank's own format")).toBeVisible();
    expect(within(dialog).queryByText(copy.notes)).not.toBeInTheDocument();
  });

  it("omits the read-only caution and note field when notes are empty", async () => {
    renderLibrary(false);

    fireEvent.click(await screen.findByText("012"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByText(copy.cautions)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(copy.notes)).not.toBeInTheDocument();
  });

  it("shows bank 012 in the reduced information view", async () => {
    renderLibrary();

    await expect(screen.findByText("012")).resolves.toBeVisible();
    expect(screen.getByText(bankOfChina.bankNameEn)).toBeVisible();
    expect(screen.getByText(bankOfChina.mailingAddress)).toBeVisible();
    expect(screen.getByText(bankOfChina.businessAddress)).toBeVisible();
    expect(screen.queryByText(bankOfChina.bankNameZh)).not.toBeInTheDocument();
    expect(screen.queryByText(bankOfChina.sourceLabel)).not.toBeInTheDocument();
    expect(screen.queryByText(copy.ready)).not.toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: `${copy.columnMenu.filter} ${copy.code}`,
      })
    ).toBeVisible();
  });

  it("opens administrator maintenance by clicking the bank row", async () => {
    renderLibrary();

    fireEvent.click(await screen.findByText(bankOfChina.bankNameEn));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByLabelText(copy.form.notes)).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: copy.deactivate })
    ).toBeVisible();
  });

  it("keeps ordinary users read-only while retaining search and list access", async () => {
    mockConfirmationInformationLibrary.mockImplementation(
      ({ includeInactive }: { includeInactive: boolean }) =>
        Promise.resolve(
          includeInactive
            ? [{ ...bankOfChina, isActive: false }]
            : [bankOfChina]
        )
    );
    renderLibrary(false);

    await expect(screen.findByText("012")).resolves.toBeVisible();
    await expect(screen.findByRole("status")).resolves.toHaveTextContent(
      accessCopy.readOnlyDescription
    );
    expect(
      screen.queryByRole("button", { name: copy.add })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: `${copy.edit}: ${bankOfChina.bankNameEn}`,
      })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: `${copy.deactivate}: ${bankOfChina.bankNameEn}`,
      })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: copy.showInactive }));

    await expect(screen.findByText("012")).resolves.toBeVisible();
    expect(
      screen.queryByRole("button", {
        name: `${copy.restore}: ${bankOfChina.bankNameEn}`,
      })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("passes the search query and active filter to the information-library API", async () => {
    mockConfirmationInformationLibrary.mockImplementation(
      ({ query }: { query: string }) =>
        Promise.resolve(query === "012" ? [bankOfChina] : [])
    );
    renderLibrary();

    const search = screen.getByRole("textbox", {
      name: copy.searchPlaceholder,
    });
    fireEvent.change(search, { target: { value: "012" } });

    await waitFor(() =>
      expect(mockConfirmationInformationLibrary).toHaveBeenLastCalledWith({
        query: "012",
        includeInactive: false,
      })
    );
  });

  it("saves a new bank from the maintenance sheet", async () => {
    renderLibrary();
    fireEvent.click(await screen.findByRole("button", { name: copy.add }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeVisible();
    fireEvent.change(within(dialog).getByLabelText(copy.form.bankCode), {
      target: { value: "013" },
    });
    fireEvent.change(within(dialog).getByLabelText(copy.form.bankNameEn), {
      target: { value: "New Bank Limited" },
    });
    fireEvent.change(within(dialog).getByLabelText(copy.form.bankNameZh), {
      target: { value: "新银行有限公司" },
    });
    fireEvent.change(within(dialog).getByLabelText(copy.form.bankType), {
      target: { value: "Local registered bank" },
    });
    fireEvent.change(within(dialog).getByLabelText(copy.form.businessAddress), {
      target: { value: "1 New Street, Hong Kong" },
    });
    fireEvent.click(screen.getByRole("button", { name: copy.form.save }));

    await waitFor(() =>
      expect(mockCreateConfirmationInformationLibrary).toHaveBeenCalledWith(
        expect.objectContaining({
          bankCode: "013",
          bankNameEn: "New Bank Limited",
          bankNameZh: "新银行有限公司",
          businessAddress: "1 New Street, Hong Kong",
        })
      )
    );
    const [[input]] = mockCreateConfirmationInformationLibrary.mock.calls;
    expect(input).not.toHaveProperty("sourceDescription");
    expect(input).not.toHaveProperty("sourceLabel");
    expect(input).not.toHaveProperty("sourceRow");
  });

  it("updates an existing bank without allowing source metadata edits", async () => {
    renderLibrary();
    fireEvent.click(await screen.findByText(bankOfChina.bankNameEn));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).queryByText(/Hong Kong bank confirmation workbook/)
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("textbox", { name: copy.form.sourceLabel })
    ).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(copy.form.bankNameEn), {
      target: { value: "Updated Bank Limited" },
    });

    await waitFor(() =>
      expect(mockUpdateConfirmationInformationLibrary).toHaveBeenCalledWith(
        bankOfChina.id,
        expect.objectContaining({ bankNameEn: "Updated Bank Limited" })
      )
    );
    const [[, input]] = mockUpdateConfirmationInformationLibrary.mock.calls;
    expect(input).not.toHaveProperty("sourceDescription");
    expect(input).not.toHaveProperty("sourceLabel");
    expect(input).not.toHaveProperty("sourceRow");
  });

  it("allows an incomplete bank record to be opened and completed", async () => {
    const incompleteBank = {
      ...bankOfChina,
      bankNameEn: "Incomplete Bank Limited",
      mailingAddress: null,
      effectiveMailingAddress: null,
      contactName: null,
      attention: null,
      isReadyForDispatch: false,
    };
    mockConfirmationInformationLibrary.mockResolvedValue([incompleteBank]);
    mockUpdateConfirmationInformationLibrary.mockResolvedValue({
      ...incompleteBank,
      businessAddress: "Updated business address",
      isReadyForDispatch: true,
    });

    renderLibrary();
    fireEvent.click(await screen.findByText(incompleteBank.bankNameEn));

    fireEvent.change(
      within(screen.getByRole("dialog")).getByLabelText(
        copy.form.businessAddress
      ),
      {
        target: { value: "Updated business address" },
      }
    );

    await waitFor(() =>
      expect(mockUpdateConfirmationInformationLibrary).toHaveBeenCalledWith(
        incompleteBank.id,
        expect.objectContaining({
          businessAddress: "Updated business address",
        })
      )
    );
    const [[, patch]] = mockUpdateConfirmationInformationLibrary.mock.calls;
    expect(patch).not.toHaveProperty("mailingAddress");
  });

  it("shows the form save error while keeping the edit sheet open", async () => {
    mockUpdateConfirmationInformationLibrary.mockRejectedValue(
      new Error("validation failed")
    );
    renderLibrary();
    fireEvent.click(await screen.findByText(bankOfChina.bankNameEn));
    fireEvent.change(
      within(screen.getByRole("dialog")).getByLabelText(copy.form.bankNameEn),
      {
        target: { value: "Updated Bank Limited" },
      }
    );

    await waitFor(() =>
      expect(mockUpdateConfirmationInformationLibrary).toHaveBeenCalledWith(
        bankOfChina.id,
        expect.objectContaining({
          bankNameEn: "Updated Bank Limited",
        })
      )
    );
    expect(
      screen.getByTestId("confirmation-information-library-auto-save")
    ).toHaveTextContent(copy.form.saveError);
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("clears the separate mailing address when same-as-business is selected", async () => {
    renderLibrary();
    fireEvent.click(await screen.findByText(bankOfChina.bankNameEn));

    const mailingAddress = within(screen.getByRole("dialog")).getByLabelText(
      copy.form.mailingAddress
    );
    expect(mailingAddress).toHaveValue(bankOfChina.mailingAddress);

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: copy.form.mailingAddressSameAsBusiness,
      })
    );

    expect(mailingAddress).toBeDisabled();
    expect(mailingAddress).toHaveValue("");

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: copy.form.mailingAddressSameAsBusiness,
      })
    );

    expect(mailingAddress).toBeEnabled();
    expect(mailingAddress).toHaveValue(bankOfChina.mailingAddress);
  });

  it("soft-deactivates an active bank", async () => {
    renderLibrary();
    fireEvent.click(await screen.findByText(bankOfChina.bankNameEn));
    fireEvent.click(screen.getByRole("button", { name: copy.deactivate }));

    await waitFor(() =>
      expect(mockDeleteConfirmationInformationLibrary).toHaveBeenCalledWith(
        bankOfChina.id
      )
    );
  });

  it("shows the maintenance action error when deactivation fails", async () => {
    mockDeleteConfirmationInformationLibrary.mockRejectedValue(
      new Error("permission denied")
    );
    renderLibrary();
    fireEvent.click(await screen.findByText(bankOfChina.bankNameEn));
    fireEvent.click(screen.getByRole("button", { name: copy.deactivate }));

    await expect(screen.findByRole("alert")).resolves.toHaveTextContent(
      copy.actionError
    );
  });

  it("invalidates all information-library consumers after a mutation", async () => {
    const { queryClient } = renderLibrary();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    fireEvent.click(await screen.findByText(bankOfChina.bankNameEn));
    fireEvent.click(screen.getByRole("button", { name: copy.deactivate }));

    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["confirmation-information-library"],
      })
    );
  });

  it("restores an inactive bank after the inactive filter is enabled", async () => {
    mockConfirmationInformationLibrary.mockImplementation(
      ({ includeInactive }: { includeInactive: boolean }) =>
        Promise.resolve(
          includeInactive ? [{ ...bankOfChina, isActive: false }] : []
        )
    );
    renderLibrary();
    fireEvent.click(screen.getByRole("checkbox", { name: copy.showInactive }));

    fireEvent.click(await screen.findByText(bankOfChina.bankNameEn));
    fireEvent.click(screen.getByRole("button", { name: copy.restore }));

    await waitFor(() =>
      expect(mockRestoreConfirmationInformationLibrary).toHaveBeenCalledWith(
        bankOfChina.id
      )
    );
  });
});
