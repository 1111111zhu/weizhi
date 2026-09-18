import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConfirmationWorkspaceSummary } from "../api/confirmation-workspace";
import { ConfirmationsPage } from "./confirmations";

// @vitest-environment jsdom

const mockFetchConfirmationWorkspaceSummary = vi.hoisted(() => vi.fn());
const mockMe = vi.hoisted(() => vi.fn());
const mockConfirmations = vi.hoisted(() => vi.fn());
const mockWorkflow = vi.hoisted(() => vi.fn());
const mockConfirmationEmpProjects = vi.hoisted(() => vi.fn());
const mockConfirmationEmpPreview = vi.hoisted(() => vi.fn());
const mockCreateConfirmationEmpImport = vi.hoisted(() => vi.fn());
const mockConfirmationEmpImportJob = vi.hoisted(() => vi.fn());
const mockConfirmationEmpImportHistory = vi.hoisted(() => vi.fn());
const mockRetryConfirmationEmpImport = vi.hoisted(() => vi.fn());
const mockWithdrawConfirmationEmpImport = vi.hoisted(() => vi.fn());
const mockInboxMessages = vi.hoisted(() => vi.fn());
const mockWorkItems = vi.hoisted(() => vi.fn());
const mockConfirmationResponseLibrary = vi.hoisted(() => vi.fn());
const mockConfirmationInformationLibrary = vi.hoisted(() => vi.fn());
const mockPush = vi.hoisted(() => vi.fn());

vi.mock("../api/confirmation-workspace", () => ({
  fetchConfirmationWorkspaceSummary: mockFetchConfirmationWorkspaceSummary,
}));

vi.mock("../api/client", () => ({
  api: {
    me: mockMe,
    confirmations: mockConfirmations,
    workflow: mockWorkflow,
    confirmationEmpProjects: mockConfirmationEmpProjects,
    confirmationEmpPreview: mockConfirmationEmpPreview,
    createConfirmationEmpImport: mockCreateConfirmationEmpImport,
    confirmationEmpImportJob: mockConfirmationEmpImportJob,
    confirmationEmpImportHistory: mockConfirmationEmpImportHistory,
    retryConfirmationEmpImport: mockRetryConfirmationEmpImport,
    withdrawConfirmationEmpImport: mockWithdrawConfirmationEmpImport,
    inboxMessages: mockInboxMessages,
    workItems: mockWorkItems,
    confirmationResponseLibrary: mockConfirmationResponseLibrary,
    confirmationInformationLibrary: mockConfirmationInformationLibrary,
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("../components/confirmations/confirmation-status-overview", () => ({
  ConfirmationDetailPane: ({
    title,
    confirmations,
    onClose,
    onOpen,
  }: {
    title: string;
    confirmations: { id: string; projectId: string }[];
    onClose: () => void;
    onOpen: (confirmation: { id: string; projectId: string }) => void;
  }) => (
    <aside data-testid="confirmation-detail-pane">
      <span>{title}</span>
      <span>{confirmations.length} detail rows</span>
      {confirmations.map((confirmation) => (
        <button
          key={confirmation.id}
          type="button"
          onClick={() => onOpen(confirmation)}
        >
          Open {confirmation.id}
        </button>
      ))}
      <button type="button" onClick={onClose}>
        Close details
      </button>
    </aside>
  ),
}));

vi.mock("../components/project-confirmations-panel", () => ({
  ConfirmationTemplateLibrary: () => (
    <div data-testid="confirmation-template-library" />
  ),
}));

vi.mock("../components/confirmations/confirmation-information-library", () => ({
  ConfirmationInformationLibrary: () => (
    <div data-testid="confirmation-information-library" />
  ),
}));

vi.mock("../components/confirmation-response-warehouse", () => ({
  ConfirmationResponseWarehouse: ({
    copy,
  }: {
    copy: { title: string; description: string };
  }) => (
    <div data-testid="confirmation-response-workspace">
      <h2>{copy.title}</h2>
      <p>{copy.description}</p>
    </div>
  ),
}));

vi.mock("../components/confirmations/confirmation-response-warehouse", () => ({
  ConfirmationResponseWarehouse: ({
    copy,
  }: {
    copy: {
      title: string;
      project: string;
      eligible: string;
      imported: string;
      blocked: string;
      directory: string;
      flat: string;
      grouped: string;
      zip: string;
    };
  }) => (
    <div data-testid="confirmation-response-warehouse">
      <h2>{copy.title}</h2>
      <span>{copy.project}</span>
      <span>{copy.eligible}</span>
      <span>{copy.imported}</span>
      <span>{copy.blocked}</span>
      <span>{copy.directory}</span>
      <button type="button">{copy.flat}</button>
      <button type="button">{copy.grouped}</button>
      <button type="button">{copy.zip}</button>
    </div>
  ),
}));

vi.mock("../i18n/client", () => ({
  useI18n: () => ({
    locale: "en-US",
    localizedPath: (path: string) => `/en-US${path}`,
    dictionary: {
      desktop: {
        apps: {
          home: "Home",
          templates: "Templates",
          smartForms: "Smart Forms",
        },
      },
      confirmationCenter: {
        title: "Confirmation Center",
        intranet: {
          title: "Confirmation Center",
          description: "Confirmation summary",
          shortcut: "Confirmation",
          navigationLabel: "Confirmation center navigation",
          allConfirmations: "All confirmations",
          templateLibrary: "Confirmation templates",
          informationLibrary: {
            title: "Confirmation information library",
          },
          responseWarehouse: "Response warehouse",
          responseWarehouseDescription:
            "Responses that have not been matched to a project",
          responseWarehousePanel: {
            title: "Confirmation response import warehouse",
            description:
              "Import reviewed confirmation responses into an eligible EMP project.",
            project: "Eligible project",
            mode: "Import mode",
            preview: "Preview import",
            flat: "Flat",
            grouped: "Grouped",
            zip: "ZIP",
            eligible: "Eligible",
            imported: "Imported",
            blocked: "Blocked",
            directory: "Workflow directory",
          },
          responseWarehouseWorkspace: {
            title: "Response warehouse",
            description: "Responses that have not been matched to a project",
          },
          project: "Project",
          searchPlaceholder: "Search project name or code",
          rowsPerPage: "Rows per page",
          rowsPerPageSuffix: " / page",
          sortBy: "Sort projects",
          sortOptions: {
            reportDateAscending: "Report date: earliest first",
            reportDateDescending: "Report date: latest first",
            awaitingResponse: "Most awaiting responses",
            projectName: "Project name A–Z",
          },
          projectCount: "{count} projects",
          reportDate: "Report date",
          reportTimeline: "Report date",
          confirmationProgress: "Confirmation progress",
          awaitingResponse: "Awaiting response",
          myCreated: "Created by me",
          detailTitle: "{project} · {selection}",
          detailLoadError: "Detail load failed",
          totalConfirmations: "{count} confirmations",
          today: "Today",
          daysUntilReport: "{days} days to report",
          daysOverdue: "{days} days overdue",
          reportDay: "Report day",
          noReportDate: "Report date not set",
          openProject: "Open project confirmation center",
          loadError: "Load failed",
          emptyTitle: "No accessible projects",
          emptyDescription: "Join a project first",
          noSearchResults: "No matching projects",
          noSearchResultsDescription: "Adjust search criteria",
        },
      },
      confirmations: {
        shortcutLabel: "Confirmation Center",
        statusLabels: {
          DRAFT: "Draft",
          PREPARED: "Frozen",
          AWAITING_RESPONSE: "Awaiting response",
          RESPONSE_RECEIVED: "Received",
          CLOSED: "Closed",
          VOIDED: "Voided",
        },
        overview: {
          stages: {
            draft: "Draft",
            prepared: "Frozen",
            sent: "Sent",
            received: "Received",
            completed: "Completed",
          },
        },
      },
      common: {
        actionsLabel: "Page shortcuts",
        engagement: "Engagement",
        returnToPortal: "Return to portal",
        settings: "Settings",
        userManagement: "User management",
      },
      nav: {
        account: "Current account",
        accountMenu: "Account menu",
        signOut: "Sign out",
      },
      workItems: {
        empTitle: "EMP work items",
        opsTitle: "OPS work items",
        projectTitle: "Project work items",
        resizeEmp: "Resize EMP work item sidebar",
        resizeProject: "Resize project work item sidebar",
      },
      inboxPopover: {
        triggerLabel: "Inbox",
        pendingTitle: "Pending invitations",
        pendingDescription: "Open an invitation and choose a folder to join.",
        emptyDescription: "No pending invitations.",
        openInvitation: "Open invitation",
        openMessage: "View message",
        viewAll: "View all messages",
      },
    },
  }),
}));

const EMPTY_STATUS_COUNTS: ConfirmationWorkspaceSummary["statusCounts"] = {
  DRAFT: 0,
  PREPARED: 0,
  AWAITING_RESPONSE: 0,
  RESPONSE_RECEIVED: 0,
  CLOSED: 0,
  VOIDED: 0,
};

function createSummary(
  input: Pick<
    ConfirmationWorkspaceSummary,
    "projectId" | "projectName" | "projectCode" | "reportDate"
  > &
    Partial<ConfirmationWorkspaceSummary>
): ConfirmationWorkspaceSummary {
  return {
    totalConfirmationCount: 0,
    ownConfirmationCount: 0,
    awaitingResponseCount: 0,
    statusCounts: { ...EMPTY_STATUS_COUNTS },
    ...input,
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ConfirmationsPage />
    </QueryClientProvider>
  );
}

async function selectSortOption(optionName: string) {
  const trigger = await screen.findByLabelText("Sort projects");
  fireEvent.pointerDown(trigger);
  fireEvent.mouseDown(trigger);
  fireEvent.click(trigger);
  if (screen.queryAllByRole("listbox").length === 0) {
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
  }
  await waitFor(() =>
    expect(screen.getAllByRole("listbox").length).toBeGreaterThan(0)
  );
  const listboxes = screen.getAllByRole("listbox");
  const listbox = listboxes[listboxes.length - 1];
  const option = await within(listbox).findByRole("option", {
    name: optionName,
  });
  fireEvent.pointerDown(option);
  fireEvent.mouseDown(option);
  fireEvent.click(option);
  await waitFor(() => expect(trigger).toHaveTextContent(optionName));
}

describe(ConfirmationsPage, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMe.mockResolvedValue({
      id: "user-1",
      email: "user-1@projectwing.local",
      name: "User One",
      globalRole: "PARTNER",
    });
    mockInboxMessages.mockResolvedValue([]);
    mockWorkItems.mockResolvedValue({
      items: [],
      categories: [],
      counts: { total: 0, EMP: 0, PROJECT: 0, CMP: 0, TMS: 0, OPS: 0 },
    });
    mockWorkflow.mockResolvedValue([
      {
        id: "directory-1",
        code: "A1",
        title: "Planning",
        level: 1,
        nodeType: "PHASE",
        workingPapers: [],
        children: [],
      },
    ]);
    mockConfirmationEmpProjects.mockResolvedValue([
      {
        id: "project-1",
        projectCode: "AUD-001",
        name: "Orchid Audit",
        reportDate: "2026-12-31",
        status: "ACTIVE",
      },
    ]);
    mockConfirmationEmpPreview.mockResolvedValue({
      projectId: "project-1",
      targetDirectories: [],
      counts: { eligible: 1, imported: 0, blocked: 0 },
      items: [],
      fingerprint: "preview-1",
    });
    mockCreateConfirmationEmpImport.mockResolvedValue({
      id: "job-1",
      status: "QUEUED",
      completed: 0,
      total: 1,
    });
    mockConfirmationEmpImportJob.mockResolvedValue(null);
    mockConfirmationEmpImportHistory.mockResolvedValue([]);
    mockRetryConfirmationEmpImport.mockResolvedValue(null);
    mockWithdrawConfirmationEmpImport.mockResolvedValue(null);
    mockConfirmations.mockResolvedValue([
      {
        id: "confirmation-1",
        projectId: "project-1",
        status: "DRAFT",
        createdBy: "user-1",
      },
      {
        id: "confirmation-2",
        projectId: "project-1",
        status: "PREPARED",
        createdBy: "user-2",
      },
    ]);
    mockConfirmationResponseLibrary.mockResolvedValue([
      { id: "response-1" },
      { id: "response-2" },
    ]);
    mockFetchConfirmationWorkspaceSummary.mockResolvedValue([
      createSummary({
        projectId: "project-1",
        projectName: "Orchid Audit",
        projectCode: "AUD-001",
        reportDate: "2026-12-31T00:00:00.000Z",
        totalConfirmationCount: 2,
        ownConfirmationCount: 1,
        statusCounts: {
          ...EMPTY_STATUS_COUNTS,
          DRAFT: 1,
          PREPARED: 1,
        },
      }),
      createSummary({
        projectId: "project-2",
        projectName: "Empty Project",
        projectCode: "AUD-002",
        reportDate: "2026-06-30T00:00:00.000Z",
      }),
    ]);
  });

  afterEach(cleanup);

  it("shows a recoverable workspace error while retaining search", async () => {
    mockFetchConfirmationWorkspaceSummary.mockRejectedValueOnce(
      new Error("Unavailable")
    );
    renderPage();
    await expect(screen.findByRole("alert")).resolves.toHaveTextContent(
      "Load failed"
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await expect(screen.findByText("Orchid Audit")).resolves.toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the confirmation center and shared home shortcuts in the header", async () => {
    renderPage();

    await expect(screen.findByText("Orchid Audit")).resolves.toBeVisible();

    const header = screen.getByRole("banner");
    const pageShell = header.parentElement;
    const main = pageShell?.querySelector("main");

    expect(
      within(header).getByRole("button", { name: "Return to portal" })
    ).toBeVisible();
    expect(
      within(header).getByRole("button", { name: "EMP work items" })
    ).toBeVisible();
    expect(
      within(header).getByRole("button", { name: "Settings" })
    ).toBeVisible();
    expect(
      within(header).getByRole("button", { name: "Account menu" })
    ).toBeVisible();
    expect(
      within(header).getByRole("button", { name: "Confirmation" })
    ).toBeVisible();
    expect(within(header).getByRole("button", { name: "Home" })).toBeVisible();
    const actionBar = within(header).getByRole("toolbar", {
      name: "Page shortcuts",
    });
    expect(
      within(actionBar)
        .getAllByRole("button")
        .map((button) => button.dataset.actionId)
    ).toStrictEqual(["home", "confirmation-center", "tasks", "settings"]);
    expect(
      within(header).getByRole("button", { name: "Back to Intranet" })
    ).toBeVisible();
    expect(within(header).getAllByRole("button")).toHaveLength(7);
    fireEvent.click(
      within(header).getByRole("button", { name: "Confirmation" })
    );
    expect(mockPush).toHaveBeenCalledWith("/en-US/confirmations");
    fireEvent.click(within(header).getByRole("button", { name: "Home" }));
    expect(mockPush).toHaveBeenCalledWith("/en-US/engagement");

    expect(pageShell).toHaveClass("h-full", "min-h-0", "overflow-hidden");
    expect(main).not.toBeNull();
    expect(main?.parentElement).toHaveClass(
      "flex-col",
      "lg:flex-row",
      "lg:gap-0",
      "p-3"
    );
    expect(main).toHaveClass("overflow-y-auto", "rounded-xl", "border");
    expect(
      screen
        .getByRole("navigation", { name: "Confirmation center navigation" })
        .closest("aside")
    ).toHaveClass("rounded-xl", "border", "shadow-sm");
    expect(main).not.toHaveClass("overflow-hidden", "p-4");
  });

  it("uses the shared confirmation navigation rail for click, drag, and keyboard", async () => {
    renderPage();

    await expect(screen.findByText("Orchid Audit")).resolves.toBeVisible();

    const rail = screen.getByRole("separator", {
      name: "Confirmation center navigation",
    });
    const navigation = screen
      .getByRole("navigation", { name: "Confirmation center navigation" })
      .closest("aside");
    expect(navigation).not.toBeNull();
    expect(navigation).not.toHaveAttribute("style");
    expect(navigation).toHaveAttribute("data-navigation-width", "256");
    expect(rail).toHaveAttribute("aria-valuemin", "184");
    expect(rail).toHaveAttribute("aria-valuemax", "320");
    expect(rail).toHaveAttribute("aria-valuenow", "256");
    expect(
      screen.getByTestId("confirmation-navigation-splitter-hit-area")
    ).toHaveClass("-inset-x-3", "cursor-pointer");

    fireEvent.click(
      screen.getByTestId("confirmation-navigation-splitter-hit-area")
    );
    expect(rail).toHaveAttribute("aria-expanded", "false");
    expect(rail).toHaveAttribute("data-state", "collapsed");
    expect(rail).toHaveClass("bg-transparent");
    expect(navigation).toHaveAttribute("data-navigation-width", "0");
    fireEvent.click(rail);
    expect(navigation).toHaveAttribute("data-navigation-width", "256");
    fireEvent.keyDown(rail, { key: "Enter" });
    expect(navigation).toHaveAttribute("data-navigation-width", "0");
    fireEvent.keyDown(rail, { key: " " });
    expect(rail).toHaveAttribute("aria-expanded", "true");
    expect(navigation).toHaveAttribute("data-navigation-width", "256");

    fireEvent.pointerDown(rail, {
      button: 0,
      clientX: 256,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, { clientX: 356, pointerId: 1 });
    expect(rail).toHaveAttribute("aria-valuenow", "320");
    expect(navigation).toHaveAttribute("data-navigation-width", "320");
    fireEvent.pointerUp(window, { pointerId: 1 });
    fireEvent.click(rail);
    expect(rail).toHaveAttribute("aria-expanded", "true");

    fireEvent.pointerDown(rail, {
      button: 0,
      clientX: 356,
      pointerId: 2,
    });
    fireEvent.pointerMove(window, { clientX: 100, pointerId: 2 });
    expect(rail).toHaveAttribute("aria-expanded", "true");
    expect(rail).toHaveAttribute("aria-valuenow", "64");
    expect(navigation).toHaveAttribute("data-navigation-width", "184");
    fireEvent.pointerMove(window, { clientX: 0, pointerId: 2 });
    expect(rail).toHaveAttribute("aria-expanded", "true");
    expect(navigation).not.toHaveAttribute("data-navigation-width", "0");
    fireEvent.pointerUp(window, { pointerId: 2 });
    expect(rail).toHaveAttribute("aria-expanded", "false");
    expect(rail).toHaveAttribute("aria-valuenow", "0");
    expect(navigation).toHaveAttribute("data-navigation-width", "0");

    fireEvent.pointerDown(rail, {
      button: 0,
      clientX: 0,
      pointerId: 3,
    });
    fireEvent.pointerMove(window, { clientX: 60, pointerId: 3 });
    expect(rail).toHaveAttribute("aria-expanded", "true");
    expect(navigation).toHaveAttribute("data-navigation-width", "184");
    fireEvent.pointerUp(window, { pointerId: 3 });
    expect(rail).toHaveAttribute("aria-expanded", "true");
    expect(navigation).toHaveAttribute("data-navigation-width", "184");
  });

  it("keeps durable administrator shortcuts live from the confirmation shell", async () => {
    mockMe.mockResolvedValue({
      id: "admin-1",
      email: "admin@projectwing.local",
      name: "System Admin",
      globalRole: "SUPER_ADMIN",
    });
    renderPage();

    await expect(screen.findByText("Orchid Audit")).resolves.toBeVisible();
    const header = screen.getByRole("banner");
    expect(within(header).getAllByRole("button")).toHaveLength(10);
    fireEvent.click(
      within(header).getByRole("button", { name: "Confirmation" })
    );
    expect(mockPush).toHaveBeenCalledWith("/en-US/confirmations");
    fireEvent.click(within(header).getByRole("button", { name: "Home" }));
    expect(mockPush).toHaveBeenCalledWith("/en-US/engagement");

    fireEvent.click(await screen.findByRole("button", { name: "Templates" }));
    expect(mockPush).toHaveBeenCalledWith(
      "/en-US/engagement?templateLibrary=1"
    );

    fireEvent.click(screen.getByRole("button", { name: "Smart Forms" }));
    expect(mockPush).toHaveBeenCalledWith("/en-US/engagement?smartForms=1");

    fireEvent.click(screen.getByRole("button", { name: "User management" }));
    expect(mockPush).toHaveBeenCalledWith("/en-US/admin/users");
  });

  it("lists projects by report date and exposes compact confirmation risk summaries", async () => {
    renderPage();

    await expect(screen.findByText("Orchid Audit")).resolves.toBeVisible();
    expect(screen.getByText("Empty Project")).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "Report date" })
    ).toBeVisible();
    expect(screen.getByLabelText(/^Report date: Dec 31, 2026\./)).toBeVisible();
    const progressHeader = screen.getByRole("columnheader", {
      name: /Draft.*Frozen.*Sent.*Received.*Completed/,
    });
    expect(progressHeader).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "All confirmations" })
    ).toBeVisible();
    const grid = screen.getByTestId("confirmation-center-project-data-grid");
    expect(grid).toHaveAttribute("data-slot", "frame");
    expect(grid).toHaveClass("overflow-hidden");
    expect(screen.getByText("1-2 / 2")).toBeVisible();
    const pageSize = screen.getByRole("combobox", { name: "Rows per page" });
    expect(pageSize).toHaveTextContent("30 / page");
    expect(
      screen
        .getByRole("button", { name: "Page 1" })
        .compareDocumentPosition(pageSize) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Empty Project");
    expect(rows[2]).toHaveTextContent("Orchid Audit");
    expect(
      screen.getByRole("link", {
        name: "Open project confirmation center: Orchid Audit",
      })
    ).toHaveAttribute(
      "href",
      "/en-US/engagement/project-1?workspace=confirmations&returnTo=%2Fconfirmations"
    );
  });

  it("opens the shared detail pane from a stage, all, and own count", async () => {
    renderPage();
    await expect(screen.findByText("Orchid Audit")).resolves.toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Draft 1" }));
    await expect(
      screen.findByText("Orchid Audit · Draft")
    ).resolves.toBeVisible();
    await expect(screen.findByText("1 detail rows")).resolves.toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "All confirmations: Orchid Audit",
      })
    );
    await expect(
      screen.findByText("Orchid Audit · All confirmations")
    ).resolves.toBeVisible();
    await expect(screen.findByText("2 detail rows")).resolves.toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Created by me: Orchid Audit" })
    );
    await expect(
      screen.findByText("Orchid Audit · Created by me")
    ).resolves.toBeVisible();
    await expect(screen.findByText("1 detail rows")).resolves.toBeVisible();
  });

  it("opens the selected confirmation directly from the detail action", async () => {
    renderPage();
    await expect(screen.findByText("Orchid Audit")).resolves.toBeVisible();

    fireEvent.click(
      screen.getByRole("button", {
        name: "All confirmations: Orchid Audit",
      })
    );
    await expect(screen.findByText("2 detail rows")).resolves.toBeVisible();
    fireEvent.click(
      await screen.findByRole("button", { name: "Open confirmation-1" })
    );

    expect(mockPush).toHaveBeenCalledWith(
      "/en-US/engagement/project-1?workspace=confirmations&confirmationId=confirmation-1&returnTo=%2Fconfirmations"
    );
  });

  it("keeps the global confirmation center focused on the register, templates, and response warehouse", async () => {
    renderPage();

    await expect(screen.findByText("Orchid Audit")).resolves.toBeVisible();
    expect(
      screen.getByRole("button", { name: "Response warehouse" })
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Response warehouse" }));
    expect(screen.getByTestId("confirmation-response-workspace")).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "Confirmation templates" })
    );
    expect(screen.getByTestId("confirmation-template-library")).toBeVisible();
  });

  it("opens the confirmation information library from the global center", async () => {
    renderPage();

    await expect(screen.findByText("Orchid Audit")).resolves.toBeVisible();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Confirmation information library",
      })
    );

    expect(
      screen.getByTestId("confirmation-information-library")
    ).toBeVisible();
  });

  it("does not expose project EMP imports in the global confirmation center", async () => {
    renderPage();

    await expect(screen.findByText("Orchid Audit")).resolves.toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Response warehouse",
      })
    ).toBeVisible();
    expect(
      screen.queryByRole("button", {
        name: "Confirmation response import warehouse",
      })
    ).not.toBeInTheDocument();
  });

  it("keeps projects without report dates last in descending order", async () => {
    mockFetchConfirmationWorkspaceSummary.mockResolvedValue([
      createSummary({
        projectId: "project-1",
        projectName: "Latest Project",
        projectCode: "AUD-001",
        reportDate: "2026-12-31T00:00:00.000Z",
      }),
      createSummary({
        projectId: "project-2",
        projectName: "Earlier Project",
        projectCode: "AUD-002",
        reportDate: "2026-06-30T00:00:00.000Z",
      }),
      createSummary({
        projectId: "project-3",
        projectName: "Undated Project",
        projectCode: "AUD-003",
        reportDate: null,
      }),
    ]);
    renderPage();

    await selectSortOption("Report date: latest first");

    await waitFor(() => {
      const rows = within(screen.getByRole("table")).getAllByRole("row");
      expect(rows[1]).toHaveTextContent("Latest Project");
      expect(rows[2]).toHaveTextContent("Earlier Project");
      expect(rows[3]).toHaveTextContent("Undated Project");
    });
  });
});
