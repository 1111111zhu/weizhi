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

import { completeWithoutResult } from "@/test/async-noop";
import { requiredFixture } from "@/test/required-fixture";

import { ConfirmationResponseWarehouse } from "./confirmation-response-warehouse";
import { ResponseBatchClaimDialog } from "./response-batch-claim-dialog";
import { ToastProvider } from "./toast";

// @vitest-environment jsdom

const mockApi = vi.hoisted(() => ({
  confirmationResponseLibrary: vi.fn(),
  projectConfirmationResponseWarehouse: vi.fn(),
  projectPendingConfirmationResponses: vi.fn(),
  confirmationResponseLibraryDownloadUrl: vi.fn(),
  previewConfirmationResponseLibraryFile: vi.fn(),
  uploadConfirmationResponseLibraryFile: vi.fn(),
  projects: vi.fn(),
  projectConfirmations: vi.fn(),
  routeConfirmationResponseLibraryFile: vi.fn(),
}));

vi.mock("../api/client", () => ({ api: mockApi }));
vi.mock("@/api/client", () => ({ api: mockApi }));
vi.mock("./file-preview-pane", () => ({
  BlobFilePreviewPane: ({
    ariaLabel,
    toolbarActions,
  }: {
    ariaLabel: string;
    toolbarActions?: React.ReactNode;
  }) => (
    <section aria-label={ariaLabel} data-testid="file-preview">
      {toolbarActions}
    </section>
  ),
}));

const copy = {
  title: "Response warehouse",
  description: "Shared response files",
  moreActions: "More actions",
  rowsPerPage: "Rows per page",
  rowsPerPageSuffix: " / page",
  searchPlaceholder: "Search responses",
  resultCount: "{count} responses",
  upload: "Upload response",
  uploadTitle: "Upload response file",
  uploadDescription: "Upload up to 50 MB",
  titleLabel: "Title",
  titlePlaceholder: "Response register",
  receivedAtLabel: "Received date",
  receivedAtPlaceholder: "Select received date",
  dateRangeLabel: "Received date range",
  dateFromLabel: "From",
  dateToLabel: "To",
  dateRangeLimit: "The date range cannot exceed six months",
  clearDateRange: "Clear date range",
  today: "Today",
  courierTrackingNumberLabel: "Courier tracking number",
  courierTrackingNumberPlaceholder: "Tracking number",
  referenceNumberLabel: "Reference number",
  referenceNumberPlaceholder: "Reference number",
  clientNameLabel: "Client name",
  clientNamePlaceholder: "Client name",
  respondingEntityLabel: "Responding entity",
  respondingEntityPlaceholder: "Responding entity",
  notesLabel: "Notes",
  notesPlaceholder: "Optional notes",
  fileLabel: "Response file",
  chooseFile: "Choose file",
  noFile: "No file selected",
  uploadConfirm: "Upload",
  uploadSuccess: "Response uploaded",
  uploadError: "Upload failed",
  loadError: "Could not load responses",
  noFiles: "No response files",
  noResults: "No matching response files",
  download: "Download",
  preview: "Preview",
  claim: "Claim",
  claimedByOther: "Claimed by {name}; you cannot claim this response",
  batchClaim: "Batch claim",
  claimSelected: "Claim selected",
  batchClaimTitle: "Batch claim responses",
  batchClaimConfirm: "Confirm batch claim",
  batchClaimSuccess: "Responses claimed",
  batchClaimError: "Could not claim responses",
  detailTitle: "Response details",
  closePreview: "Close preview",
  expandPreview: "Expand preview",
  exitExpandedPreview: "Exit expanded preview",
  openPreviewInNewWindow: "Open in new window",
  loadingPreview: "Loading preview",
  previewFailedTitle: "Preview failed",
  retryPreview: "Retry",
  unsupportedPreview: "Unsupported preview",
  resizePreview: "Resize response preview",
  filterColumnPlaceholder: "Filter this column",
  filterNoOptions: "No matching filter options",
  clearColumnFilter: "Clear filter",
  importToProjectDirectory: "Archive to project",
  importUnavailable: "Complete response review before archiving",
  archiveSelected: "Archive selected",
  selectAll: "Select all archivable responses",
  selectRow: "Select response: {title}",
  selectedCount: "{count} selected",
  returnToConfirmationCenter: "Return to confirmation center",
  columns: {
    code: "Response code",
    title: "Title",
    receivedAt: "Received date",
    claimedBy: "Claimed by",
    claimedAt: "Claimed at",
    courierTrackingNumber: "Tracking number",
    referenceNumber: "Reference number",
    clientName: "Client name",
    respondingEntity: "Responding entity",
    notes: "Notes",
    file: "File",
    actions: "Actions",
  },
};

function renderWarehouse(
  projectId?: string,
  onImportToEmp?: (confirmationIds: string[]) => void,
  currentUserId = "staff-2",
  currentUserGlobalRole = "CONFIRMATION_OFFICER",
  unmatchedOnly = false
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <ConfirmationResponseWarehouse
          cancelLabel="Cancel"
          copy={copy}
          locale="en-US"
          currentUserId={currentUserId}
          currentUserGlobalRole={currentUserGlobalRole}
          projectId={projectId}
          unmatchedOnly={unmatchedOnly}
          projectName={projectId ? "Example audit 2026" : undefined}
          projectCode={projectId ? "EX-2026" : undefined}
          onImportToEmp={onImportToEmp}
        />
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe(ConfirmationResponseWarehouse, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-28T12:00:00.000Z"));
    vi.clearAllMocks();
    mockApi.confirmationResponseLibrary.mockResolvedValue([
      {
        id: "response-1",
        code: "CRSP-123456789ABC",
        title: "2025 confirmation response register",
        receivedAt: "2026-08-01T00:00:00.000Z",
        courierTrackingNumber: "SF123456",
        referenceNumber: "REF-001",
        clientName: "Example Client",
        respondingEntity: "Example Bank",
        notes: "Original received",
        fileName: "responses.xlsx",
        fileSize: 65_536,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        uploadedById: "staff-1",
        routingStatus: "UNASSIGNED_PROJECT",
        uploader: { id: "staff-1", name: "Jony Ma" },
        createdAt: "2026-08-03T08:00:00.000Z",
        updatedAt: "2026-08-03T08:00:00.000Z",
      },
    ]);
    mockApi.projectPendingConfirmationResponses.mockResolvedValue([
      {
        id: "response-project-1",
        code: "CRSP-PROJECT-1",
        title: "Project response register",
        receivedAt: "2026-08-01T00:00:00.000Z",
        courierTrackingNumber: null,
        referenceNumber: "REF-PROJECT-1",
        clientName: "Example Client",
        respondingEntity: "Example Bank",
        notes: null,
        fileName: "project-response.xlsx",
        fileSize: 65_536,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        uploadedById: "staff-1",
        projectId: "project-1",
        routingStatus: "PENDING_MATCH",
        uploader: { id: "staff-1", name: "Jony Ma" },
        createdAt: "2026-08-03T08:00:00.000Z",
        updatedAt: "2026-08-03T08:00:00.000Z",
      },
    ]);
    mockApi.projectConfirmationResponseWarehouse.mockResolvedValue([
      {
        id: "response-project-1",
        code: "CRSP-PROJECT-1",
        title: "Project response register",
        receivedAt: "2026-08-01T00:00:00.000Z",
        courierTrackingNumber: null,
        referenceNumber: "REF-PROJECT-1",
        clientName: "Example Client",
        respondingEntity: "Example Bank",
        notes: null,
        fileName: "project-response.xlsx",
        fileSize: 65_536,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        uploadedById: "staff-1",
        projectId: "project-1",
        routingStatus: "PENDING_MATCH",
        uploader: { id: "staff-1", name: "Jony Ma" },
        createdAt: "2026-08-03T08:00:00.000Z",
        updatedAt: "2026-08-03T08:00:00.000Z",
      },
    ]);
    mockApi.confirmationResponseLibraryDownloadUrl.mockReturnValue(
      "https://api.example.test/confirmations/response-library/response-1/download"
    );
    mockApi.previewConfirmationResponseLibraryFile.mockResolvedValue(
      new Blob(["preview"])
    );
    mockApi.projects.mockResolvedValue([
      {
        id: "project-1",
        name: "Example audit 2026",
        projectCode: "EX-2026",
        status: "ACTIVE",
        cmpClient: { nameZh: "示例客户", nameEn: "Example Client" },
      },
    ]);
    mockApi.projectConfirmations.mockResolvedValue([]);
    mockApi.routeConfirmationResponseLibraryFile.mockResolvedValue({
      id: "response-1",
      routingStatus: "PENDING_MATCH",
      projectId: "project-1",
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("archives the selected reviewed response from the full project warehouse", async () => {
    const onImportToEmp = vi.fn();
    mockApi.projectConfirmationResponseWarehouse.mockResolvedValue([
      {
        id: "response-library-1",
        code: "CRSP-001",
        title: "Reviewed response",
        receivedAt: "2026-07-17T08:30:00.000Z",
        clientName: "Example Client",
        respondingEntity: "HSBC Hong Kong",
        fileName: "bank-response.pdf",
        fileSize: 18,
        mimeType: "application/pdf",
        uploadedById: "user-1",
        uploader: { id: "user-1", name: "Bonnie Su" },
        projectId: "project-1",
        confirmationId: "confirmation-1",
        routingStatus: "PENDING_MATCH",
        confirmation: {
          id: "confirmation-1",
          confirmationCode: "AUD-2026-0001-YH-001",
          counterpartyName: "HSBC Hong Kong",
          displayName: "HSBC Hong Kong",
          type: "BANK",
          status: "CLOSED",
          differenceStatus: "MATCHED",
        },
        createdAt: "2026-07-17T08:30:00.000Z",
        updatedAt: "2026-07-17T08:30:00.000Z",
      },
    ]);
    renderWarehouse("project-1", onImportToEmp);
    await screen.findByText("Reviewed response");
    fireEvent.click(
      await screen.findByRole("button", { name: "Archive to project" })
    );
    fireEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select response: Reviewed response",
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Archive selected" }));
    await waitFor(() =>
      expect(onImportToEmp).toHaveBeenCalledWith(["confirmation-1"])
    );
  });

  it("passes all selected unique confirmation IDs from the full project warehouse", async () => {
    const onImportToEmp = vi.fn();
    const response = {
      id: "response-library-1",
      code: "CRSP-001",
      title: "Reviewed response",
      receivedAt: "2026-07-17T08:30:00.000Z",
      clientName: "Example Client",
      respondingEntity: "HSBC Hong Kong",
      fileName: "bank-response.pdf",
      fileSize: 18,
      mimeType: "application/pdf",
      uploadedById: "user-1",
      uploader: { id: "user-1", name: "Bonnie Su" },
      projectId: "project-1",
      confirmationId: "confirmation-1",
      routingStatus: "PENDING_MATCH",
      confirmation: {
        id: "confirmation-1",
        confirmationCode: "AUD-2026-0001-YH-001",
        counterpartyName: "HSBC Hong Kong",
        displayName: "HSBC Hong Kong",
        type: "BANK",
        status: "CLOSED",
        differenceStatus: "MATCHED",
      },
      createdAt: "2026-07-17T08:30:00.000Z",
      updatedAt: "2026-07-17T08:30:00.000Z",
    };
    mockApi.projectConfirmationResponseWarehouse.mockResolvedValue([
      response,
      {
        ...response,
        id: "response-library-2",
        code: "CRSP-002",
        title: "Reviewed securities response",
        respondingEntity: "Example Securities",
        fileName: "securities-response.pdf",
        confirmationId: "confirmation-2",
        confirmation: {
          ...response.confirmation,
          id: "confirmation-2",
          confirmationCode: "AUD-2026-0001-YH-002",
          counterpartyName: "Example Securities",
          displayName: "Example Securities",
        },
      },
      {
        ...response,
        id: "response-library-duplicate",
        code: "CRSP-003",
        title: "Reviewed response duplicate",
        fileName: "bank-response-duplicate.pdf",
      },
    ]);
    renderWarehouse("project-1", onImportToEmp);
    await screen.findByText("Reviewed securities response");
    fireEvent.click(
      await screen.findByRole("button", { name: "Archive to project" })
    );
    fireEvent.click(
      within(screen.getByRole("table")).getByRole("checkbox", {
        name: "Select all archivable responses",
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Archive selected" }));
    await waitFor(() =>
      expect(onImportToEmp).toHaveBeenCalledWith([
        "confirmation-1",
        "confirmation-2",
      ])
    );
  });

  it("uses one DataGrid toolbar and keeps upload for confirmation officers", async () => {
    renderWarehouse();

    const toolbar = await screen.findByTestId(
      "confirmation-response-warehouse-toolbar"
    );
    expect(
      within(toolbar).getByRole("heading", { name: "Response warehouse" })
    ).toBeVisible();
    await expect(
      within(toolbar).findByLabelText("Response warehouse: 1")
    ).resolves.toHaveTextContent("1");
    expect(
      within(toolbar).getByRole("button", { name: "Upload response" })
    ).toBeVisible();
    expect(
      within(toolbar).queryByRole("button", { name: "Batch claim" })
    ).toBeNull();
  });

  it("shows only key columns and opens full response details from the row", async () => {
    renderWarehouse();

    const table = await screen.findByRole("table", {
      name: "Response warehouse",
    });
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((header) => header.textContent);
    expect(headers).toStrictEqual([
      "Response code",
      "Title",
      "Received date",
      "Claimed by",
      "File",
      "Actions",
    ]);
    expect(within(table).getAllByRole("columnheader").at(-1)).toHaveClass(
      "text-left"
    );
    expect(
      within(requiredFixture(within(table).getAllByRole("row")[1]))
        .getAllByRole("cell")
        .at(-1)
    ).toHaveClass("text-left");

    fireEvent.click(
      await screen.findByText("2025 confirmation response register")
    );
    const details = screen.getByRole("dialog", { name: "Response details" });
    expect(within(details).getByText("REF-001")).toBeVisible();
    expect(within(details).getByText("SF123456")).toBeVisible();
    expect(within(details).getByText("Original received")).toBeVisible();
    expect(screen.queryByTestId("file-preview")).toBeNull();
  });

  it("opens the selected file in the preview pane from the preview action", async () => {
    renderWarehouse();

    fireEvent.click(await screen.findByRole("button", { name: "Preview" }));
    expect(
      screen.getByRole("region", {
        name: "Preview: 2025 confirmation response register",
      })
    ).toBeVisible();
  });

  it("offers 30, 40, and 50 responses per page", async () => {
    const user = userEvent.setup();
    const [response] = await mockApi.confirmationResponseLibrary();
    mockApi.confirmationResponseLibrary.mockResolvedValue(
      Array.from({ length: 51 }, (_, index) => ({
        ...response,
        id: `response-${index + 1}`,
        code: `CRSP-${String(index + 1).padStart(3, "0")}`,
        title: `Response ${String(index + 1).padStart(3, "0")}`,
      }))
    );

    renderWarehouse();

    await expect(
      screen.findByRole("textbox", { name: "Search responses" })
    ).resolves.toBeVisible();
    await expect(screen.findByText("1-30 / 51")).resolves.toBeVisible();
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      31
    );

    const pageSize = screen.getByRole("combobox", { name: "Rows per page" });
    await user.click(pageSize);
    expect(pageSize).toHaveTextContent("30 / page");
    expect(
      screen.getAllByRole("option").map((option) => option.textContent)
    ).toStrictEqual(["30 / page", "40 / page", "50 / page"]);
    await user.click(screen.getByRole("option", { name: "40 / page" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("option", { name: "40 / page" })
      ).not.toBeInTheDocument()
    );
    await waitFor(() =>
      expect(
        within(screen.getByRole("table")).getAllByRole("row")
      ).toHaveLength(41)
    );
    expect(screen.getByText("1-40 / 51")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Page 2" }));

    await waitFor(() => {
      expect(
        within(screen.getByRole("table")).getAllByRole("row")
      ).toHaveLength(12);
    });
    expect(screen.getByText("41-51 / 51")).toBeVisible();

    await user.click(screen.getByRole("combobox", { name: "Rows per page" }));
    await user.click(await screen.findByRole("option", { name: "50 / page" }));
    await waitFor(() =>
      expect(
        within(screen.getByRole("table")).getAllByRole("row")
      ).toHaveLength(51)
    );
    expect(screen.getByText("1-50 / 51")).toBeVisible();
  });

  it("uses a fixed table layout without column resize handles", async () => {
    renderWarehouse();

    await screen.findByText("2025 confirmation response register");
    const grid = screen.getByTestId(
      "confirmation-response-warehouse-data-grid"
    );
    expect(within(grid).getByRole("table")).toBeVisible();
    expect(within(grid).getByRole("table")).toHaveClass("table-fixed");
    expect(within(grid).queryAllByRole("separator")).toHaveLength(0);
  });

  it("shows claimant initials with the full name available on hover", async () => {
    const user = userEvent.setup();
    const [response] = await mockApi.confirmationResponseLibrary();
    mockApi.confirmationResponseLibrary.mockResolvedValue([
      { ...response, routedBy: { id: "staff-2", name: "Leo Li" } },
    ]);

    renderWarehouse();

    await screen.findByText("2025 confirmation response register");
    expect(screen.getByText("LL")).toBeVisible();
    const claimant = screen.getByRole("img", { name: "Leo Li" });
    expect(claimant).toBeVisible();
    await user.hover(claimant);
    await expect(screen.findByText("Leo Li")).resolves.toBeVisible();
  });

  it("offers filters for every visible information column", async () => {
    const user = userEvent.setup();
    const [response] = await mockApi.confirmationResponseLibrary();
    mockApi.confirmationResponseLibrary.mockResolvedValue([
      response,
      {
        ...response,
        id: "response-2",
        code: "CRSP-OTHER",
        title: "Other response register",
      },
    ]);
    renderWarehouse();

    await screen.findByText("2025 confirmation response register");
    for (const label of [
      "Response code",
      "Title",
      "Received date",
      "Claimed by",
      "File",
    ]) {
      expect(
        screen.getByRole("button", {
          name: `Filter this column ${label}`,
        })
      ).toBeVisible();
    }
    expect(
      screen.queryByRole("button", { name: "Filter this column Actions" })
    ).not.toBeInTheDocument();

    const codeFilter = screen.getByRole("button", {
      name: "Filter this column Response code",
    });
    fireEvent.click(codeFilter);
    const filter = screen
      .getByRole("searchbox", { name: "Filter this column" })
      .closest('[data-slot="popover-content"]') as HTMLElement;
    expect(filter).toHaveClass("h-72", "w-60");
    await user.click(
      within(filter).getByRole("checkbox", {
        name: "CRSP-123456789ABC",
      })
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Filter this column Response code",
        })
      ).toHaveAttribute("data-filter-active", "true")
    );
    expect(
      screen.getByText("2025 confirmation response register")
    ).toBeVisible();
    expect(
      screen.queryByText("Other response register")
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: "Filter this column Response code",
      })
    );
    await user.click(screen.getByRole("button", { name: "Clear filter" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Filter this column Response code",
        })
      ).toHaveAttribute("data-filter-active", "false")
    );
    expect(
      screen.getByText("2025 confirmation response register")
    ).toBeVisible();
  });

  it("keeps claimed and matched responses visible in the global warehouse", async () => {
    const [response] = await mockApi.confirmationResponseLibrary();
    mockApi.confirmationResponseLibrary.mockResolvedValue([
      {
        ...response,
        id: "response-unassigned",
        title: "Unassigned response",
        projectId: null,
        routingStatus: "UNASSIGNED_PROJECT",
      },
      {
        ...response,
        id: "response-pending",
        title: "Claimed response",
        projectId: "project-1",
        routingStatus: "PENDING_MATCH",
      },
      {
        ...response,
        id: "response-matched",
        title: "Matched response",
        projectId: "project-1",
        confirmationId: "confirmation-1",
        matchedResponseId: "project-response-1",
        routingStatus: "MATCHED",
      },
    ]);

    renderWarehouse();

    await screen.findByText("Unassigned response");
    expect(screen.getByText("Claimed response")).toBeVisible();
    expect(screen.getByText("Matched response")).toBeVisible();
    expect(
      screen.getByRole("group", { name: "Received date range" })
    ).toBeVisible();
    expect(screen.getByLabelText("From")).toBeVisible();
    expect(screen.getByLabelText("To")).toBeVisible();
  });

  it("keeps exactly claim, preview, and download actions for an unclaimed response", async () => {
    renderWarehouse();

    const awaitedFixture1 = await screen.findByText(
      "2025 confirmation response register"
    );
    const row = awaitedFixture1.closest("tr") as HTMLElement;
    const buttons = within(row).getAllByRole("button");

    expect(buttons).toHaveLength(3);
    expect(within(row).getByRole("button", { name: "Claim" })).toBeEnabled();
    expect(within(row).getByRole("button", { name: "Preview" })).toBeEnabled();
    expect(within(row).getByRole("button", { name: "Download" })).toBeEnabled();
  });

  it("replaces claim with return after the current user claims a response", async () => {
    const [response] = await mockApi.confirmationResponseLibrary();
    mockApi.confirmationResponseLibrary.mockResolvedValue([
      {
        ...response,
        projectId: "project-1",
        routingStatus: "PENDING_MATCH",
        routedById: "staff-2",
        routedBy: { id: "staff-2", name: "Ava Chen" },
      },
    ]);

    renderWarehouse();

    const awaitedFixture2 = await screen.findByText(
      "2025 confirmation response register"
    );
    const row = awaitedFixture2.closest("tr") as HTMLElement;

    expect(within(row).getAllByRole("button")).toHaveLength(3);
    expect(
      within(row).getByRole("button", { name: "Return to confirmation center" })
    ).toBeEnabled();
    expect(within(row).queryByRole("button", { name: "Claim" })).toBeNull();
  });

  it("disables another user's claim action and explains the disabled state on hover", async () => {
    const user = userEvent.setup();
    const [response] = await mockApi.confirmationResponseLibrary();
    mockApi.confirmationResponseLibrary.mockResolvedValue([
      {
        ...response,
        projectId: "project-1",
        routingStatus: "PENDING_MATCH",
        routedById: "staff-3",
        routedBy: { id: "staff-3", name: "Leo Li" },
      },
    ]);

    renderWarehouse();

    const awaitedFixture3 = await screen.findByText(
      "2025 confirmation response register"
    );
    const row = awaitedFixture3.closest("tr") as HTMLElement;
    const claim = within(row).getByRole("button", { name: "Claim" });

    expect(within(row).getAllByRole("button")).toHaveLength(3);
    expect(claim).toBeDisabled();
    await user.hover(claim.parentElement as HTMLElement);
    await expect(
      screen.findByText("Claimed by Leo Li; you cannot claim this response")
    ).resolves.toBeVisible();
  });

  it("defaults the global warehouse to the most recent month", async () => {
    const today = new Date();
    const recent = new Date(today);
    recent.setDate(recent.getDate() - 10);
    const older = new Date(today);
    older.setDate(older.getDate() - 40);
    const formatDate = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const awaitedFixture4 = await mockApi.confirmationResponseLibrary();
    const awaitedFixture5 = await mockApi.confirmationResponseLibrary();
    mockApi.confirmationResponseLibrary.mockResolvedValue([
      {
        ...awaitedFixture4[0],
        id: "response-recent",
        title: "Recent response",
        receivedAt: `${formatDate(recent)}T00:00:00.000Z`,
      },
      {
        ...awaitedFixture5[0],
        id: "response-old",
        title: "Older response",
        receivedAt: `${formatDate(older)}T00:00:00.000Z`,
      },
    ]);

    renderWarehouse();

    await expect(screen.findByText("Recent response")).resolves.toBeVisible();
    expect(screen.queryByText("Older response")).not.toBeInTheDocument();
    expect(screen.getByLabelText("To")).toHaveValue(formatDate(today));
  });

  it("opens the themed calendar from the date field and accepts typed dates", async () => {
    const user = userEvent.setup();
    renderWarehouse();

    const from = screen.getByLabelText("From");
    expect(from).toHaveAttribute("type", "text");
    await user.click(
      screen.getByRole("button", { name: "Received date range" })
    );
    expect(screen.getByTestId("response-date-range-calendar")).toBeVisible();

    await user.click(from);
    await user.clear(from);
    await user.type(from, "2026-08-01");
    fireEvent.blur(from);
    expect(from).toHaveValue("2026-08-01");
  });

  it("filters the global warehouse by a received-date range no longer than six months", async () => {
    const [response] = await mockApi.confirmationResponseLibrary();
    mockApi.confirmationResponseLibrary.mockResolvedValue([
      {
        ...response,
        id: "response-recent",
        title: "Recent response",
        receivedAt: "2026-08-01T00:00:00.000Z",
      },
      {
        ...response,
        id: "response-old",
        title: "Older response",
        receivedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    renderWarehouse();

    await screen.findByText("Recent response");
    fireEvent.change(screen.getByLabelText("From"), {
      target: { value: "2026-02-28" },
    });
    fireEvent.change(screen.getByLabelText("To"), {
      target: { value: "2026-08-28" },
    });

    expect(screen.getByText("Recent response")).toBeVisible();
    expect(screen.queryByText("Older response")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("From"), {
      target: { value: "2026-01-01" },
    });
    await waitFor(() =>
      expect(
        screen.getByText("The date range cannot exceed six months")
      ).toBeVisible()
    );
  });

  it("keeps routed rows visible in the project warehouse and sorts newest responses first", async () => {
    const [response] = await mockApi.confirmationResponseLibrary();
    mockApi.projectConfirmationResponseWarehouse.mockResolvedValue([
      {
        ...response,
        id: "response-older",
        code: "CRSP-OLDER",
        title: "Older response register",
        projectId: "project-1",
        receivedAt: "2026-08-01T00:00:00.000Z",
      },
      {
        ...response,
        id: "response-newer",
        code: "CRSP-NEWER",
        title: "Newer response register",
        projectId: "project-1",
        receivedAt: "2026-08-01T00:00:00.000Z",
      },
      {
        ...response,
        id: "response-routed",
        code: "CRSP-ROUTED",
        title: "Routed response register",
        projectId: "project-1",
        receivedAt: "2026-08-18T00:00:00.000Z",
        routingStatus: "MATCHED",
        routedBy: { id: "staff-2", name: "Ava Chen" },
        routedAt: "2026-08-19T10:20:00.000Z",
      },
    ]);

    renderWarehouse("project-1");

    await screen.findByText("Routed response register");
    const pageText = document.body.textContent ?? "";
    expect(pageText.indexOf("Newer response register")).toBeGreaterThanOrEqual(
      0
    );
    expect(pageText.indexOf("Routed response register")).toBeGreaterThanOrEqual(
      0
    );
    expect(pageText.indexOf("Older response register")).toBeGreaterThanOrEqual(
      0
    );
    expect(pageText.indexOf("Newer response register")).toBeLessThan(
      pageText.indexOf("Older response register")
    );
    expect(pageText.indexOf("Routed response register")).toBeLessThan(
      pageText.indexOf("Older response register")
    );
    expect(screen.getByText("AC")).toBeVisible();
    expect(screen.getByRole("img", { name: "Ava Chen" })).toBeVisible();
    expect(screen.getByText(/Aug 19, 2026/)).toBeVisible();
  });

  it("keeps the project warehouse focused on unmatched responses without a date range", async () => {
    const [response] = await mockApi.confirmationResponseLibrary();
    mockApi.projectConfirmationResponseWarehouse.mockResolvedValue([
      {
        ...response,
        id: "response-in-range",
        title: "In-range response",
        projectId: "project-1",
        receivedAt: "2026-08-01T00:00:00.000Z",
      },
      {
        ...response,
        id: "response-out-of-range",
        title: "Out-of-range response",
        projectId: "project-1",
        receivedAt: "2026-05-31T00:00:00.000Z",
      },
    ]);

    renderWarehouse(
      "project-1",
      undefined,
      "staff-2",
      "CONFIRMATION_OFFICER",
      true
    );

    await screen.findByText("In-range response");
    expect(screen.getByText("In-range response")).toBeVisible();
    expect(screen.getByText("Out-of-range response")).toBeVisible();
    expect(screen.getAllByRole("columnheader")).toHaveLength(6);
    expect(
      screen.queryByRole("columnheader", { name: /Claimed at/ })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /File/ })).toBeVisible();
    expect(
      screen.queryByLabelText("Received date range")
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("From")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("To")).not.toBeInTheDocument();
  });

  it.each([false, true])(
    "batch returns pending responses and preserves failures: %s",
    async (partialFailure) => {
      const [response] = await mockApi.confirmationResponseLibrary();
      let pending = ["first", "second"].map((id) => ({
        ...response,
        id,
        title: id,
        projectId: "project-1",
        routingStatus: "PENDING_MATCH",
      }));
      mockApi.projectConfirmationResponseWarehouse.mockImplementation(
        async () => {
          await Promise.resolve();
          return pending;
        }
      );
      mockApi.routeConfirmationResponseLibraryFile.mockImplementation((id) =>
        Promise.resolve().then(() => {
          if (partialFailure && id === "second") {
            throw new Error("Failed");
          }
          pending = pending.filter((item) => item.id !== id);
          return {
            ...response,
            id,
            projectId: null,
            routingStatus: "UNASSIGNED_PROJECT",
          };
        })
      );
      renderWarehouse(
        "project-1",
        undefined,
        "staff-2",
        "CONFIRMATION_OFFICER",
        true
      );
      await screen.findByText("first");
      fireEvent.click(screen.getByRole("button", { name: "Batch return" }));
      fireEvent.click(
        screen.getByRole("checkbox", {
          name: "Select all returnable responses",
        })
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Return selected responses" })
      );
      await waitFor(() =>
        expect(
          mockApi.routeConfirmationResponseLibraryFile
        ).toHaveBeenCalledWith("second", { action: "UNASSIGN_PROJECT" })
      );
      await waitFor(() =>
        expect(screen.queryByText("first")).not.toBeInTheDocument()
      );
      await expect(
        screen.findByText(
          partialFailure
            ? "Returned 1 responses; 1 failed. Please retry."
            : "Returned 2 responses"
        )
      ).resolves.toBeVisible();
      const secondCheckbox = screen.queryByRole("checkbox", {
        name: "Select response: second",
      });
      expect({
        present: screen.queryByText("second") !== null,
        checked: secondCheckbox?.getAttribute("aria-checked") ?? null,
      }).toStrictEqual(
        partialFailure
          ? { present: true, checked: "true" }
          : { present: false, checked: null }
      );
    }
  );

  it("returns a pending routed response to the confirmation center", async () => {
    const [response] = await mockApi.confirmationResponseLibrary();
    mockApi.projectConfirmationResponseWarehouse.mockResolvedValue([
      {
        ...response,
        id: "response-pending",
        title: "Claimed response",
        projectId: "project-1",
        routingStatus: "PENDING_MATCH",
        routedBy: { id: "staff-2", name: "Ava Chen" },
        routedAt: "2026-08-19T10:20:00.000Z",
      },
    ]);
    mockApi.routeConfirmationResponseLibraryFile.mockResolvedValue({
      ...response,
      id: "response-pending",
      title: "Claimed response",
      projectId: null,
      routingStatus: "UNASSIGNED_PROJECT",
      routedBy: null,
      routedAt: null,
    });

    renderWarehouse("project-1");

    await screen.findByText("Claimed response");
    fireEvent.click(
      screen.getByRole("button", { name: "Return to confirmation center" })
    );

    await waitFor(() =>
      expect(mockApi.routeConfirmationResponseLibraryFile).toHaveBeenCalledWith(
        "response-pending",
        { action: "UNASSIGN_PROJECT" }
      )
    );
    expect(screen.getByText("Claimed response")).toBeVisible();
  });

  it("offers the same return action for a response already matched to a confirmation", async () => {
    const [response] = await mockApi.confirmationResponseLibrary();
    mockApi.projectConfirmationResponseWarehouse.mockResolvedValue([
      {
        ...response,
        id: "response-matched",
        title: "Matched response",
        projectId: "project-1",
        confirmationId: "confirmation-1",
        matchedResponseId: "project-response-1",
        routingStatus: "MATCHED",
        project: {
          id: "project-1",
          name: "Example audit 2026",
          projectCode: "EX-2026",
        },
      },
    ]);
    mockApi.routeConfirmationResponseLibraryFile.mockResolvedValue({
      ...response,
      id: "response-matched",
      projectId: null,
      confirmationId: null,
      matchedResponseId: null,
      routingStatus: "UNASSIGNED_PROJECT",
    });

    renderWarehouse("project-1");

    await screen.findByText("Matched response");
    fireEvent.click(
      screen.getByRole("button", { name: "Return to confirmation center" })
    );

    const warning = await screen.findByRole("alertdialog");
    expect(warning).toHaveTextContent(
      "will remove the wrong response from the project and return the outgoing confirmation flow to Register dispatch"
    );
    expect(
      vi.mocked(mockApi.routeConfirmationResponseLibraryFile)
    ).toHaveBeenCalledTimes(0);
    fireEvent.click(within(warning).getByRole("button", { name: "Cancel" }));
    expect(
      vi.mocked(mockApi.routeConfirmationResponseLibraryFile)
    ).toHaveBeenCalledTimes(0);

    fireEvent.click(
      screen.getByRole("button", { name: "Return to confirmation center" })
    );
    const reopenedWarning = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(reopenedWarning).getByRole("button", { name: "Return response" })
    );

    await waitFor(() =>
      expect(mockApi.routeConfirmationResponseLibraryFile).toHaveBeenCalledWith(
        "response-matched",
        { action: "UNASSIGN_PROJECT" }
      )
    );
  });

  it("lets a confirmation officer select and upload a response file", async () => {
    const uploaded = {
      id: "response-2",
      title: "July responses",
    };
    mockApi.uploadConfirmationResponseLibraryFile.mockResolvedValue(uploaded);
    renderWarehouse();

    fireEvent.click(screen.getByRole("button", { name: "Upload response" }));
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    const file = new File(["sheet"], "July responses.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText("Courier tracking number"), {
      target: { value: "SF123456" },
    });
    fireEvent.change(screen.getByLabelText("Reference number"), {
      target: { value: "REF-001" },
    });
    fireEvent.change(screen.getByLabelText("Client name"), {
      target: { value: "Example Client" },
    });
    fireEvent.change(screen.getByLabelText("Responding entity"), {
      target: { value: "Example Bank" },
    });
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "Original received" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    await waitFor(() =>
      expect(
        mockApi.uploadConfirmationResponseLibraryFile
      ).toHaveBeenCalledWith({
        title: "July responses",
        receivedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        courierTrackingNumber: "SF123456",
        referenceNumber: "REF-001",
        clientName: "Example Client",
        respondingEntity: "Example Bank",
        notes: "Original received",
        file,
      })
    );
  });

  it("uses a compact form for one file and expands only for multiple files", () => {
    renderWarehouse();
    fireEvent.click(screen.getByRole("button", { name: "Upload response" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-upload-mode", "single");
    const input = requiredFixture(document.querySelector('input[type="file"]'));
    fireEvent.change(input, {
      target: { files: [new File(["one"], "first.pdf")] },
    });
    fireEvent.change(screen.getByLabelText("Client name"), {
      target: { value: "Retained client" },
    });
    expect(
      screen.queryByRole("checkbox", { name: "Select all pending files" })
    ).toBeNull();
    fireEvent.change(input, {
      target: { files: [new File(["two"], "second.pdf")] },
    });
    expect(dialog).toHaveAttribute("data-upload-mode", "batch");
    expect(screen.getByLabelText("Client name")).toHaveValue("Retained client");
    fireEvent.click(screen.getByRole("button", { name: "Remove: second.pdf" }));
    expect(dialog).toHaveAttribute("data-upload-mode", "single");
    expect(screen.getByLabelText("Client name")).toHaveValue("Retained client");
  });

  it("keeps independent batch metadata and retries only failed files", async () => {
    mockApi.uploadConfirmationResponseLibraryFile
      .mockResolvedValueOnce({ id: "uploaded-first" })
      .mockRejectedValueOnce(new Error("Connection lost"))
      .mockResolvedValueOnce({ id: "uploaded-second" });
    renderWarehouse();
    fireEvent.click(screen.getByRole("button", { name: "Upload response" }));
    const first = new File(["one"], "first.pdf", { type: "application/pdf" });
    const second = new File(["two"], "second.pdf", { type: "application/pdf" });
    fireEvent.change(
      requiredFixture(document.querySelector('input[type="file"]')),
      {
        target: { files: [first, second] },
      }
    );
    fireEvent.change(screen.getByLabelText("Reference number"), {
      target: { value: "FIRST-REF" },
    });
    fireEvent.change(screen.getByLabelText("Courier tracking number"), {
      target: { value: "KEEP-TRACKING" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Edit: second.pdf" }));
    expect(screen.getByLabelText("Reference number")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Reference number"), {
      target: { value: "SECOND-REF" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select all pending files" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Fill selected" }));
    expect(
      screen.getByRole("button", { name: "Batch Received date" })
    ).toHaveTextContent("Select received date");
    fireEvent.click(
      screen.getByRole("button", { name: "Batch Received date" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(
      screen.getByRole("button", { name: "Apply to selected files" })
    ).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(
      screen.getByRole("button", { name: "Batch Received date" })
    ).toHaveTextContent("Select received date");
    expect(
      screen.getByRole("button", { name: "Apply to selected files" })
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Batch Courier tracking number"), {
      target: { value: "   " },
    });
    expect(
      screen.getByRole("button", { name: "Apply to selected files" })
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Batch Client name"), {
      target: { value: "Shared client" },
    });
    fireEvent.change(screen.getByLabelText("Batch Responding entity"), {
      target: { value: "Shared bank" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Apply to selected files" })
    );
    expect(screen.getByLabelText("Reference number")).toHaveValue("SECOND-REF");
    fireEvent.click(screen.getByRole("button", { name: "Edit: first.pdf" }));
    expect(screen.getByLabelText("Reference number")).toHaveValue("FIRST-REF");
    expect(screen.getByLabelText("Client name")).toHaveValue("Shared client");
    fireEvent.click(screen.getByRole("button", { name: "Upload all" }));
    await screen.findByRole("button", { name: "Retry unfinished" });
    expect(
      mockApi.uploadConfirmationResponseLibraryFile
    ).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        file: first,
        title: "first",
        referenceNumber: "FIRST-REF",
        courierTrackingNumber: "KEEP-TRACKING",
        clientName: "Shared client",
        respondingEntity: "Shared bank",
      })
    );
    expect(
      mockApi.uploadConfirmationResponseLibraryFile
    ).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        file: second,
        title: "second",
        referenceNumber: "SECOND-REF",
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry unfinished" }));
    await screen.findByRole("button", { name: "Done" });
    expect(mockApi.uploadConfirmationResponseLibraryFile).toHaveBeenCalledTimes(
      3
    );
    expect(
      mockApi.uploadConfirmationResponseLibraryFile
    ).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ file: second, referenceNumber: "SECOND-REF" })
    );
  });

  it("validates every batch entry before sending any file", () => {
    renderWarehouse();
    fireEvent.click(screen.getByRole("button", { name: "Upload response" }));
    fireEvent.change(
      requiredFixture(document.querySelector('input[type="file"]')),
      {
        target: {
          files: [
            new File(["one"], "first.pdf"),
            new File(["two"], "second.pdf"),
          ],
        },
      }
    );
    fireEvent.change(screen.getByLabelText("Client name"), {
      target: { value: "Client" },
    });
    fireEvent.change(screen.getByLabelText("Responding entity"), {
      target: { value: "Bank" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload all" }));
    expect(screen.getByLabelText("Title")).toHaveValue("second");
    expect(
      screen.getByText(
        "Complete title, received date, client and responding entity before uploading."
      )
    ).toBeVisible();
    expect(
      vi.mocked(mockApi.uploadConfirmationResponseLibraryFile)
    ).toHaveBeenCalledTimes(0);
  });

  it("replaces global upload with a working batch-claim flow for regular users", async () => {
    const user = userEvent.setup();
    renderWarehouse(undefined, undefined, "staff-2", "STAFF");

    await expect(
      screen.findByRole("button", { name: "Batch claim" })
    ).resolves.toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Upload response" })
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: "Batch claim" }));
    await user.click(
      screen.getByRole("checkbox", {
        name: "Select response: 2025 confirmation response register",
      })
    );
    await user.click(screen.getByRole("button", { name: "Claim selected" }));

    const dialog = screen.getByRole("dialog", {
      name: "Batch claim responses",
    });
    await user.click(
      within(dialog).getByRole("combobox", { name: "Select project" })
    );
    const search = await screen.findByRole("combobox", {
      name: "Search project or client",
    });
    await user.type(search, "no-match-project");
    expect(
      screen.queryByRole("option", { name: /Example audit 2026/ })
    ).toBeNull();
    await user.clear(search);
    await user.type(search, "Example");
    await user.click(
      await screen.findByRole("option", { name: /Example audit 2026/ })
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm batch claim" })
    );

    await waitFor(() =>
      expect(mockApi.routeConfirmationResponseLibraryFile).toHaveBeenCalledWith(
        "response-1",
        {
          action: "PENDING_MATCH",
          projectId: "project-1",
          provisionalType: "OTHER",
        }
      )
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Batch claim responses" })
      ).toBeNull()
    );
    await expect(
      screen.findByText("Claimed 1 responses")
    ).resolves.toBeVisible();
    expect(screen.getByRole("button", { name: "Go to" })).toBeVisible();
  });

  it("keeps separate claim projects and retries only failed responses", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onCompleted = vi.fn();
    const [base] = await mockApi.confirmationResponseLibrary();
    mockApi.projects.mockResolvedValue([
      {
        id: "project-1",
        name: "First project",
        projectCode: "ONE",
        status: "ACTIVE",
      },
      {
        id: "project-2",
        name: "Second project",
        projectCode: "TWO",
        status: "ACTIVE",
      },
    ]);
    mockApi.routeConfirmationResponseLibraryFile
      .mockResolvedValueOnce({ ...base, projectId: "project-1" })
      .mockRejectedValueOnce(new Error("Try again"))
      .mockResolvedValueOnce({
        ...base,
        id: "response-2",
        projectId: "project-2",
      });
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <ResponseBatchClaimDialog
          responses={[
            base,
            { ...base, id: "response-2", title: "Second response" },
          ]}
          locale="en-US"
          copy={copy}
          onClose={onClose}
          onCompleted={onCompleted}
          onClaimed={vi.fn().mockImplementation(completeWithoutResult)}
        />
      </QueryClientProvider>
    );
    await user.click(
      screen.getByRole("checkbox", { name: "Select all pending responses" })
    );
    await user.click(screen.getByRole("button", { name: "Shared settings" }));
    await user.click(screen.getByRole("combobox", { name: "Select project" }));
    await user.click(
      await screen.findByRole("option", { name: "First project · ONE" })
    );
    await user.click(
      screen.getByRole("button", { name: "Apply to selected responses" })
    );
    await user.click(
      screen.getByRole("button", { name: "Configure: Second response" })
    );
    await user.click(screen.getByRole("combobox", { name: "Select project" }));
    await user.click(
      await screen.findByRole("option", { name: "Second project · TWO" })
    );
    await user.click(
      screen.getByRole("button", { name: `Configure: ${base.title}` })
    );
    expect(
      screen.getByRole("combobox", { name: "Select project" })
    ).toHaveTextContent("First project");
    await user.click(
      screen.getByRole("button", { name: "Confirm batch claim" })
    );
    await screen.findByRole("button", { name: "Retry unfinished" });
    expect(
      mockApi.routeConfirmationResponseLibraryFile
    ).toHaveBeenNthCalledWith(1, "response-1", {
      action: "PENDING_MATCH",
      projectId: "project-1",
      provisionalType: "OTHER",
    });
    expect(
      mockApi.routeConfirmationResponseLibraryFile
    ).toHaveBeenNthCalledWith(2, "response-2", {
      action: "PENDING_MATCH",
      projectId: "project-2",
      provisionalType: "OTHER",
    });
    expect(vi.mocked(onClose)).toHaveBeenCalledTimes(0);
    expect(vi.mocked(onCompleted)).toHaveBeenCalledTimes(0);
    await user.click(screen.getByRole("button", { name: "Retry unfinished" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onCompleted).toHaveBeenCalledWith(
      [
        {
          href: "/en-US/engagement/project-1?workspace=confirmations&confirmationView=unmatched",
          label: "First project · Unmatched responses",
        },
        {
          href: "/en-US/engagement/project-2?workspace=confirmations&confirmationView=unmatched",
          label: "Second project · Unmatched responses",
        },
      ],
      2
    );
    expect(mockApi.routeConfirmationResponseLibraryFile).toHaveBeenCalledTimes(
      3
    );
    expect(
      mockApi.routeConfirmationResponseLibraryFile
    ).toHaveBeenNthCalledWith(3, "response-2", {
      action: "PENDING_MATCH",
      projectId: "project-2",
      provisionalType: "OTHER",
    });
  });

  it("clears the old confirmation when a claim project changes", async () => {
    const user = userEvent.setup();
    const [base] = await mockApi.confirmationResponseLibrary();
    const onCompleted = vi.fn();
    mockApi.routeConfirmationResponseLibraryFile.mockResolvedValue({
      ...base,
      projectId: "project-2",
      confirmationId: "confirmation-1",
    });
    mockApi.projects.mockResolvedValue([
      {
        id: "project-1",
        name: "First project",
        projectCode: "ONE",
        status: "ACTIVE",
      },
      {
        id: "project-2",
        name: "Second project",
        projectCode: "TWO",
        status: "ACTIVE",
      },
    ]);
    mockApi.projectConfirmations.mockResolvedValue([
      {
        id: "confirmation-1",
        confirmationCode: "BANK-001",
        displayName: "Bank request",
        type: "BANK",
        status: "AWAITING_RESPONSE",
      },
    ]);
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <ResponseBatchClaimDialog
          responses={[base]}
          locale="en-US"
          copy={copy}
          onClose={vi.fn()}
          onCompleted={onCompleted}
          onClaimed={vi.fn().mockImplementation(completeWithoutResult)}
        />
      </QueryClientProvider>
    );
    await user.click(screen.getByRole("combobox", { name: "Select project" }));
    await user.click(
      await screen.findByRole("option", { name: "First project · ONE" })
    );
    await user.click(screen.getByRole("combobox", { name: "Matching method" }));
    await user.click(
      await screen.findByRole("option", {
        name: "Match an outgoing confirmation",
      })
    );
    await user.click(
      await screen.findByRole("button", { name: /Bank request/ })
    );
    expect(screen.getByText("Selected: BANK-001")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Clear selected confirmation" })
    );
    expect(screen.queryByText("Selected: BANK-001")).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Confirm batch claim" })
    );
    expect(
      vi.mocked(mockApi.routeConfirmationResponseLibraryFile)
    ).toHaveBeenCalledTimes(0);
    await user.click(screen.getByRole("button", { name: /Bank request/ }));
    expect(screen.getByText("Selected: BANK-001")).toBeVisible();
    await user.click(screen.getByRole("combobox", { name: "Select project" }));
    await user.click(
      screen.getByRole("option", { name: "Second project · TWO" })
    );
    expect(screen.queryByText("Selected: BANK-001")).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Confirm batch claim" })
    );
    expect(
      vi.mocked(mockApi.routeConfirmationResponseLibraryFile)
    ).toHaveBeenCalledTimes(0);
    await user.click(screen.getByRole("button", { name: /Bank request/ }));
    await user.click(
      screen.getByRole("button", { name: "Confirm batch claim" })
    );
    await waitFor(() =>
      expect(mockApi.routeConfirmationResponseLibraryFile).toHaveBeenCalledWith(
        "response-1",
        {
          action: "MATCH_CONFIRMATION",
          projectId: "project-2",
          confirmationId: "confirmation-1",
        }
      )
    );
    await waitFor(() =>
      expect(onCompleted).toHaveBeenCalledWith(
        [
          {
            href: "/en-US/engagement/project-2?workspace=confirmations&confirmationId=confirmation-1&confirmationStage=draft",
            label: `Second project · ${base.title}`,
          },
        ],
        1
      )
    );
  });

  it("opens a guided project matching drawer from the response row", async () => {
    const user = userEvent.setup();
    renderWarehouse();

    await screen.findByText("2025 confirmation response register");
    const claimButton = await screen.findByRole("button", {
      name: "Claim",
    });
    expect(claimButton.textContent).toBe("");
    claimButton.focus();
    await user.keyboard("{Enter}");

    await expect(
      screen.findByRole("heading", { name: "Assign and match response" })
    ).resolves.toBeVisible();
    expect(screen.getByText("Select project")).toBeVisible();
    await expect(
      screen.findByText("Example audit 2026")
    ).resolves.toBeVisible();

    fireEvent.click(screen.getByText("Example audit 2026"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.queryByText("No outgoing request")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Assign to project, match later"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    mockApi.confirmationResponseLibrary.mockReturnValue(new Promise(() => {}));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() =>
      expect(mockApi.routeConfirmationResponseLibraryFile).toHaveBeenCalledWith(
        "response-1",
        {
          action: "PENDING_MATCH",
          projectId: "project-1",
          provisionalType: "OTHER",
        }
      )
    );
    await expect(
      screen.findByText("2025 confirmation response register")
    ).resolves.toBeVisible();
  });

  it("binds the warehouse list and upload to the current project", async () => {
    mockApi.uploadConfirmationResponseLibraryFile.mockResolvedValue({
      id: "response-project-2",
      title: "July project responses",
    });
    renderWarehouse("project-1");

    await expect(
      screen.findByText("Project response register")
    ).resolves.toBeVisible();
    expect(screen.getByText(/Example audit 2026 · EX-2026/)).toBeVisible();
    expect(mockApi.projectConfirmationResponseWarehouse).toHaveBeenCalledWith(
      "project-1"
    );
    expect(
      vi.mocked(mockApi.projectPendingConfirmationResponses)
    ).toHaveBeenCalledTimes(0);
    expect(
      vi.mocked(mockApi.confirmationResponseLibrary)
    ).toHaveBeenCalledTimes(0);

    fireEvent.click(screen.getByRole("button", { name: "Upload response" }));
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]');
    const file = new File(["sheet"], "July project responses.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
    fireEvent.change(
      screen.getByLabelText("Client name", { selector: "input" }),
      {
        target: { value: "Example Client" },
      }
    );
    fireEvent.change(
      screen.getByLabelText("Responding entity", { selector: "input" }),
      {
        target: { value: "Example Bank" },
      }
    );
    fireEvent.change(screen.getByLabelText("Title", { selector: "input" }), {
      target: { value: "July project responses" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    await waitFor(() =>
      expect(
        mockApi.uploadConfirmationResponseLibraryFile
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "project-1",
          title: "July project responses",
          file,
        })
      )
    );
  });

  it("opens matching directly in the current project", async () => {
    renderWarehouse("project-1");

    await screen.findByText("Project response register");
    const continueMatching = await screen.findByRole("button", {
      name: "Continue matching",
    });
    continueMatching.focus();
    await userEvent.setup().keyboard("{Enter}");

    await expect(
      screen.findByRole("heading", { name: "Assign and match response" })
    ).resolves.toBeVisible();
    expect(screen.queryByText("Select project")).not.toBeInTheDocument();
    expect(screen.getByText("Match an outgoing confirmation")).toBeVisible();
  });

  it("matches a project response to the selected awaiting confirmation", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      {
        id: "confirmation-1",
        status: "AWAITING_RESPONSE",
        confirmationCode: "CONF-001",
        preparedDispatchReference: "REF-PROJECT-1",
        counterpartyName: "Example Bank",
        respondingEntityName: "Example Bank",
        displayName: "Example Bank response",
        type: "BANK",
      },
      {
        id: "confirmation-2",
        status: "RESPONDED",
        confirmationCode: "CONF-002",
        counterpartyName: "Closed Bank",
        displayName: "Closed Bank response",
        type: "BANK",
      },
    ]);
    mockApi.projectConfirmationResponseWarehouse.mockResolvedValue([
      {
        id: "response-project-1",
        code: "CRSP-PROJECT-1",
        title: "Project response register",
        receivedAt: "2026-08-01T00:00:00.000Z",
        courierTrackingNumber: null,
        referenceNumber: "REF-PROJECT-1",
        clientName: "Example Client",
        respondingEntity: "Example Bank",
        notes: null,
        fileName: "project-response.xlsx",
        fileSize: 65_536,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        uploadedById: "staff-1",
        projectId: "project-1",
        routingStatus: "PENDING_MATCH",
        uploader: { id: "staff-1", name: "Jony Ma" },
        createdAt: "2026-08-03T08:00:00.000Z",
        updatedAt: "2026-08-03T08:00:00.000Z",
      },
    ]);
    mockApi.routeConfirmationResponseLibraryFile.mockResolvedValue({
      id: "response-project-1",
      routingStatus: "MATCHED",
      projectId: "project-1",
      confirmationId: "confirmation-1",
    });
    renderWarehouse("project-1");

    await screen.findByText("Project response register");
    fireEvent.click(
      await screen.findByRole("button", { name: "Continue matching" })
    );
    fireEvent.click(screen.getByText("Match an outgoing confirmation"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(await screen.findByText("Example Bank response"));
    expect(screen.queryByText("Closed Bank response")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() =>
      expect(mockApi.routeConfirmationResponseLibraryFile).toHaveBeenCalledWith(
        "response-project-1",
        {
          action: "MATCH_CONFIRMATION",
          projectId: "project-1",
          confirmationId: "confirmation-1",
        }
      )
    );
    expect(screen.queryByText("Select project")).not.toBeInTheDocument();
  });

  it("moves archiving to the toolbar and disables non-archivable row checkboxes", async () => {
    const onImportToEmp = vi.fn();
    mockApi.projectConfirmationResponseWarehouse.mockResolvedValue([
      {
        id: "response-matched-1",
        code: "CRSP-MATCHED-1",
        title: "Reviewed bank response",
        receivedAt: "2026-08-01T00:00:00.000Z",
        clientName: "Example Client",
        respondingEntity: "Example Bank",
        fileName: "reviewed-response.pdf",
        fileSize: 12_345,
        mimeType: "application/pdf",
        uploadedById: "staff-1",
        projectId: "project-1",
        confirmationId: "confirmation-closed-1",
        routingStatus: "MATCHED",
        uploader: { id: "staff-1", name: "Jony Ma" },
        confirmation: {
          id: "confirmation-closed-1",
          confirmationCode: "CONF-001",
          counterpartyName: "Example Bank",
          displayName: "Example Bank response",
          type: "BANK",
          status: "CLOSED",
          differenceStatus: "MATCHED",
        },
        createdAt: "2026-08-03T08:00:00.000Z",
        updatedAt: "2026-08-03T08:00:00.000Z",
      },
      {
        id: "response-reviewing-1",
        code: "CRSP-REVIEWING-1",
        title: "Response under review",
        receivedAt: "2026-08-02T00:00:00.000Z",
        clientName: "Example Client",
        respondingEntity: "Example Bank",
        fileName: "response-under-review.pdf",
        fileSize: 12_345,
        mimeType: "application/pdf",
        uploadedById: "staff-1",
        projectId: "project-1",
        confirmationId: "confirmation-reviewing-1",
        routingStatus: "MATCHED",
        uploader: { id: "staff-1", name: "Jony Ma" },
        confirmation: {
          id: "confirmation-reviewing-1",
          confirmationCode: "CONF-002",
          counterpartyName: "Example Bank",
          displayName: "Example Bank response",
          type: "BANK",
          status: "RESPONSE_RECEIVED",
          differenceStatus: null,
        },
        createdAt: "2026-08-03T08:00:00.000Z",
        updatedAt: "2026-08-03T08:00:00.000Z",
      },
    ]);

    renderWarehouse("project-1", onImportToEmp);

    const warehouse = await screen.findByTestId(
      "confirmation-response-warehouse-data-grid"
    );
    const user = userEvent.setup();
    await within(warehouse).findByText("Reviewed bank response");
    const archive = within(warehouse).getByRole("button", {
      name: "Archive to project",
    });
    expect(archive).toBeEnabled();
    expect(
      within(screen.getByRole("table")).queryByRole("button", {
        name: "Archive to project",
      })
    ).not.toBeInTheDocument();
    await user.click(archive);
    await waitFor(() =>
      expect(within(warehouse).getByText("0 selected")).toBeVisible()
    );
    expect(
      within(warehouse).getByRole("button", { name: "Cancel" })
    ).toBeVisible();
    const selectedBeforeCancel = within(screen.getByRole("table")).getByRole(
      "checkbox",
      {
        name: "Select response: Reviewed bank response",
      }
    );
    await user.click(selectedBeforeCancel);
    expect(within(warehouse).getByText("1 selected")).toBeVisible();
    await user.click(within(warehouse).getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(
        within(screen.getByRole("table")).queryByRole("checkbox", {
          name: "Select response: Reviewed bank response",
        })
      ).not.toBeInTheDocument()
    );
    await user.click(
      within(warehouse).getByRole("button", { name: "Archive to project" })
    );
    await waitFor(() =>
      expect(within(warehouse).getByText("0 selected")).toBeVisible()
    );
    expect(
      within(warehouse).getByRole("button", { name: "Archive to project" })
    ).toBeDisabled();

    const table = screen.getByRole("table");
    const selectAll = within(table).getByRole("checkbox", {
      name: "Select all archivable responses",
    });
    expect(selectAll).toHaveClass("mx-auto");
    const selectableResponse = within(table).getByRole("checkbox", {
      name: "Select response: Reviewed bank response",
    });
    expect(selectableResponse).toBeEnabled();
    expect(selectableResponse).toHaveClass("mx-auto");
    const blockedResponse = within(screen.getByRole("table")).getByRole(
      "checkbox",
      {
        name: "Select response: Response under review",
      }
    );
    expect(blockedResponse).toHaveAttribute("aria-disabled", "true");
    expect(blockedResponse).toHaveAttribute("data-disabled", "");
    await user.click(
      within(screen.getByRole("table")).getByRole("checkbox", {
        name: "Select response: Reviewed bank response",
      })
    );
    const selectedResponse = within(screen.getByRole("table")).getByRole(
      "checkbox",
      {
        name: "Select response: Reviewed bank response",
      }
    );
    expect(selectedResponse).toBeChecked();
    expect(within(warehouse).getByText("1 selected")).toBeVisible();
    expect(
      screen.queryByRole("region", {
        name: "Preview: Reviewed bank response",
      })
    ).not.toBeInTheDocument();
    await user.click(
      within(warehouse).getByRole("button", { name: "Archive selected" })
    );

    expect(onImportToEmp).toHaveBeenCalledWith(["confirmation-closed-1"]);
  });

  it("passes every selected archivable confirmation when selecting all", async () => {
    mockApi.projectConfirmationResponseWarehouse.mockResolvedValue([
      {
        id: "response-matched-1",
        code: "CRSP-MATCHED-1",
        title: "Reviewed bank response",
        receivedAt: "2026-08-01T00:00:00.000Z",
        clientName: "Example Client",
        respondingEntity: "Example Bank",
        fileName: "reviewed-response.pdf",
        fileSize: 12_345,
        mimeType: "application/pdf",
        uploadedById: "staff-1",
        projectId: "project-1",
        confirmationId: "confirmation-closed-1",
        routingStatus: "MATCHED",
        uploader: { id: "staff-1", name: "Jony Ma" },
        confirmation: {
          id: "confirmation-closed-1",
          confirmationCode: "CONF-001",
          counterpartyName: "Example Bank",
          displayName: "Example Bank response",
          type: "BANK",
          status: "CLOSED",
          differenceStatus: "MATCHED",
        },
        createdAt: "2026-08-03T08:00:00.000Z",
        updatedAt: "2026-08-03T08:00:00.000Z",
      },
      {
        id: "response-matched-2",
        code: "CRSP-MATCHED-2",
        title: "Reviewed securities response",
        receivedAt: "2026-08-02T00:00:00.000Z",
        clientName: "Example Client",
        respondingEntity: "Example Securities",
        fileName: "reviewed-securities-response.pdf",
        fileSize: 22_345,
        mimeType: "application/pdf",
        uploadedById: "staff-1",
        projectId: "project-1",
        confirmationId: "confirmation-closed-2",
        routingStatus: "MATCHED",
        uploader: { id: "staff-1", name: "Jony Ma" },
        confirmation: {
          id: "confirmation-closed-2",
          confirmationCode: "CONF-002",
          counterpartyName: "Example Securities",
          displayName: "Example Securities response",
          type: "BANK",
          status: "CLOSED",
          differenceStatus: "MATCHED",
        },
        createdAt: "2026-08-03T08:00:00.000Z",
        updatedAt: "2026-08-03T08:00:00.000Z",
      },
      {
        id: "response-reviewing-1",
        code: "CRSP-REVIEWING-1",
        title: "Response under review",
        receivedAt: "2026-08-03T00:00:00.000Z",
        clientName: "Example Client",
        respondingEntity: "Example Bank",
        fileName: "response-under-review.pdf",
        fileSize: 12_345,
        mimeType: "application/pdf",
        uploadedById: "staff-1",
        projectId: "project-1",
        confirmationId: "confirmation-reviewing-1",
        routingStatus: "MATCHED",
        uploader: { id: "staff-1", name: "Jony Ma" },
        confirmation: {
          id: "confirmation-reviewing-1",
          confirmationCode: "CONF-003",
          counterpartyName: "Example Bank",
          displayName: "Example Bank response",
          type: "BANK",
          status: "RESPONSE_RECEIVED",
          differenceStatus: null,
        },
        createdAt: "2026-08-03T08:00:00.000Z",
        updatedAt: "2026-08-03T08:00:00.000Z",
      },
    ]);

    const onImportToEmp = vi.fn();
    renderWarehouse("project-1", onImportToEmp);

    const warehouse = await screen.findByTestId(
      "confirmation-response-warehouse-data-grid"
    );
    await within(warehouse).findByText("Reviewed bank response");
    fireEvent.click(
      within(warehouse).getByRole("button", {
        name: "Archive to project",
      })
    );
    const table = screen.getByRole("table");
    const selectAll = within(table).getByRole("checkbox", {
      name: "Select all archivable responses",
    });
    expect(selectAll).toBeEnabled();
    fireEvent.click(selectAll);
    expect(
      within(table).getByRole("checkbox", {
        name: "Select response: Response under review",
      })
    ).not.toBeChecked();
    fireEvent.click(
      within(warehouse).getByRole("button", { name: "Archive selected" })
    );

    expect(onImportToEmp).toHaveBeenCalledWith([
      "confirmation-closed-2",
      "confirmation-closed-1",
    ]);
  });

  it("selects only visible archivable rows after filtering", async () => {
    const onImportToEmp = vi.fn();
    const baseResponse = {
      receivedAt: "2026-08-01T00:00:00.000Z",
      clientName: "Example Client",
      fileName: "reviewed-response.pdf",
      fileSize: 12_345,
      mimeType: "application/pdf",
      uploadedById: "staff-1",
      projectId: "project-1",
      routingStatus: "MATCHED" as const,
      uploader: { id: "staff-1", name: "Jony Ma" },
      createdAt: "2026-08-03T08:00:00.000Z",
      updatedAt: "2026-08-03T08:00:00.000Z",
    };
    mockApi.projectConfirmationResponseWarehouse.mockResolvedValue([
      {
        ...baseResponse,
        id: "response-visible",
        code: "CRSP-VISIBLE",
        title: "Visible archivable response",
        respondingEntity: "Example Bank",
        confirmationId: "confirmation-visible",
        confirmation: {
          id: "confirmation-visible",
          confirmationCode: "CONF-VISIBLE",
          counterpartyName: "Example Bank",
          displayName: "Visible archivable response",
          type: "BANK",
          status: "CLOSED" as const,
          differenceStatus: "MATCHED" as const,
        },
      },
      {
        ...baseResponse,
        id: "response-hidden",
        code: "CRSP-HIDDEN",
        title: "Hidden archivable response",
        respondingEntity: "Other Bank",
        confirmationId: "confirmation-hidden",
        confirmation: {
          id: "confirmation-hidden",
          confirmationCode: "CONF-HIDDEN",
          counterpartyName: "Other Bank",
          displayName: "Hidden archivable response",
          type: "BANK",
          status: "CLOSED" as const,
          differenceStatus: "MATCHED" as const,
        },
      },
      {
        ...baseResponse,
        id: "response-blocked",
        code: "CRSP-BLOCKED",
        title: "Blocked non-archivable response",
        respondingEntity: "Example Bank",
        confirmationId: "confirmation-blocked",
        confirmation: {
          id: "confirmation-blocked",
          confirmationCode: "CONF-BLOCKED",
          counterpartyName: "Example Bank",
          displayName: "Blocked non-archivable response",
          type: "BANK",
          status: "RESPONSE_RECEIVED" as const,
          differenceStatus: null,
        },
      },
    ]);

    renderWarehouse("project-1", onImportToEmp);

    const warehouse = await screen.findByTestId(
      "confirmation-response-warehouse-data-grid"
    );
    const user = userEvent.setup();
    await within(warehouse).findByText("Visible archivable response");
    await user.click(
      within(warehouse).getByRole("button", {
        name: "Archive to project",
      })
    );
    await user.type(
      within(warehouse).getByRole("textbox", { name: "Search responses" }),
      "Example Bank"
    );

    expect(screen.getByText("Visible archivable response")).toBeVisible();
    expect(screen.getByText("Blocked non-archivable response")).toBeVisible();
    expect(
      screen.queryByText("Hidden archivable response")
    ).not.toBeInTheDocument();

    const table = screen.getByRole("table");
    const selectAll = within(table).getByRole("checkbox", {
      name: "Select all archivable responses",
    });
    const blockedResponse = within(table).getByRole("checkbox", {
      name: "Select response: Blocked non-archivable response",
    });
    expect(selectAll).toBeEnabled();
    expect(blockedResponse).toHaveAttribute("aria-disabled", "true");
    await user.click(selectAll);

    expect(
      within(table).getByRole("checkbox", {
        name: "Select response: Visible archivable response",
      })
    ).toBeChecked();
    expect(blockedResponse).not.toBeChecked();
    expect(within(warehouse).getByText("1 selected")).toBeVisible();
    await user.click(
      within(warehouse).getByRole("button", { name: "Archive selected" })
    );

    expect(onImportToEmp).toHaveBeenCalledWith(["confirmation-visible"]);
  });

  it("keeps the archive toolbar action disabled when no row is archivable", async () => {
    mockApi.projectConfirmationResponseWarehouse.mockResolvedValue([
      {
        id: "response-reviewing-1",
        code: "CRSP-REVIEWING-1",
        title: "Response under review",
        receivedAt: "2026-08-01T00:00:00.000Z",
        clientName: "Example Client",
        respondingEntity: "Example Bank",
        fileName: "response-under-review.pdf",
        fileSize: 12_345,
        mimeType: "application/pdf",
        uploadedById: "staff-1",
        projectId: "project-1",
        confirmationId: "confirmation-reviewing-1",
        routingStatus: "MATCHED",
        uploader: { id: "staff-1", name: "Jony Ma" },
        confirmation: {
          id: "confirmation-reviewing-1",
          confirmationCode: "CONF-002",
          counterpartyName: "Example Bank",
          displayName: "Example Bank response",
          type: "BANK",
          status: "RESPONSE_RECEIVED",
          differenceStatus: null,
        },
        createdAt: "2026-08-03T08:00:00.000Z",
        updatedAt: "2026-08-03T08:00:00.000Z",
      },
    ]);

    renderWarehouse("project-1", vi.fn());

    const archive = await screen.findByRole("button", {
      name: "Archive to project",
    });
    expect(archive).toBeDisabled();
  });
});
