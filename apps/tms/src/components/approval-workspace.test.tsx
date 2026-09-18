// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/lib/api";
import {
  approveTmsSubmission,
  editTmsSubmission,
  getTmsApprovalProjects,
  getTmsApprovalRecords,
  returnTmsSubmission,
} from "@/lib/api";
import { buildPeriodDays } from "@/lib/timesheet";

import {
  ApprovalWorkspace,
  buildApprovalYearOptions,
  getApprovalRowType,
  getApprovalFilterStorageKey,
} from "./approval-workspace";

vi.mock("@/lib/api", () => ({
  approveTmsSubmission: vi.fn(),
  editTmsSubmission: vi.fn(),
  getTmsApprovalProjects: vi.fn(),
  getTmsApprovalRecords: vi.fn(),
  returnTmsSubmission: vi.fn(),
}));

vi.mock("@/components/tms-header", () => ({
  TmsHeader: ({ approvalActive }: { approvalActive?: boolean }) => (
    <header>{approvalActive ? "TMS Approval" : "TMS Home"}</header>
  ),
}));

const toastError = vi.hoisted(() => vi.fn());
const toastWarning = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  Toaster: () => null,
  toast: { error: toastError, warning: toastWarning },
}));

const manager: User = {
  id: "manager-1",
  email: "manager@projectwing.local",
  name: "Manager",
  globalRole: "MANAGER",
};

const project = {
  engagementId: "engagement-1",
  engagementCode: "HBR-2026-ACC",
  clientCode: "C-HBR-2026",
  clientName: "Harbour Retail Limited",
  pic: "Manager",
  mic: "Jony Ma",
  status: "ACTIVE" as const,
  pendingCount: 1,
  returnedCount: 0,
  projectCount: 1,
};

const firstRecord = {
  id: "submission-first",
  ownerUserId: "employee-1",
  ownerName: "Jony Ma",
  ownerEmail: "jony.ma@projectwing.local",
  year: 2026,
  month: 7,
  half: "FIRST_HALF" as const,
  engagementId: "engagement-1",
  engagementCode: "HBR-2026-ACC",
  projectId: "project-1",
  projectCode: "HBR-PROJECT-01",
  projectName: "Annual audit",
  clientCode: "C-HBR-2026",
  clientName: "Harbour Retail Limited",
  revision: 2,
  status: "SUBMITTED" as const,
  submittedRows: [
    {
      id: "row-first",
      engagementId: "engagement-1",
      engagementCode: "HBR-2026-ACC",
      clientCode: "C-HBR-2026",
      clientName: "Harbour Retail Limited",
      budgetedHours: "100",
      agreedFee: "100",
      recoveryRate: null,
      feeCurrency: "HKD" as const,
      pic: "Manager",
      mic: "Jony Ma",
      codeAliases: [],
      timesheetAccess: { allowed: true, reason: "ALLOWED" as const },
      periodScope: "first" as const,
      type: "Chargeable" as const,
      details: "Normal" as const,
      description: "Fieldwork",
      hoursByDate: { "2026-07-03": 8, "2026-07-10": 4 },
      periodTotal: 12,
    },
  ],
  submittedAt: "2026-07-16T09:00:00.000Z",
  reviewedById: null,
  reviewedAt: null,
  returnReason: null,
};

const secondRecord = {
  ...firstRecord,
  id: "submission-second",
  ownerUserId: "employee-2",
  ownerName: "Amy Chan",
  ownerEmail: "amy.chan@projectwing.local",
  half: "SECOND_HALF" as const,
  revision: 1,
  submittedRows: [],
};

function completeWorkdayHours(period: "first" | "second") {
  return Object.fromEntries(
    buildPeriodDays(2026, 7, period)
      .filter((day) => day.isWorkday)
      .map((day) => [day.date, 8])
  );
}

describe(ApprovalWorkspace, () => {
  beforeEach(() => {
    toastError.mockClear();
    toastWarning.mockClear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 6, 20));
    window.localStorage.clear();
    vi.mocked(getTmsApprovalProjects).mockResolvedValue({
      projects: [project],
    });
    vi.mocked(getTmsApprovalRecords).mockResolvedValue({
      records: [firstRecord, secondRecord],
    });
    vi.mocked(approveTmsSubmission).mockResolvedValue(firstRecord);
    vi.mocked(returnTmsSubmission).mockResolvedValue({
      ...firstRecord,
      status: "RETURNED",
    });
    vi.mocked(editTmsSubmission).mockResolvedValue({
      ...firstRecord,
      revision: 3,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("connects the mobile project and record drilldown to the existing approval action", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("767"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    window.localStorage.setItem(
      getApprovalFilterStorageKey(manager.id),
      JSON.stringify({ year: 2026, month: 7, period: "first" })
    );
    vi.mocked(approveTmsSubmission).mockClear();
    render(
      <ApprovalWorkspace
        renderHeader={false}
        locale="en-US"
        user={manager}
        onBack={vi.fn()}
        onSignOut={vi.fn()}
      />
    );
    const projectLink = await screen.findByRole("link", {
      name: /Harbour Retail Limited/,
    });
    expect(screen.queryByRole("table")).toBeNull();
    fireEvent.click(projectLink);
    fireEvent.click(await screen.findByRole("link", { name: /Jony Ma/ }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() =>
      expect(approveTmsSubmission).toHaveBeenCalledWith(
        firstRecord.id,
        expect.objectContaining({ expectedRevision: firstRecord.revision })
      )
    );
  });

  it("prefers workType for approval row classification and keeps legacy fallback", () => {
    expect(
      getApprovalRowType({
        type: "Chargeable",
        details: "Normal",
        workType: "OT",
      })
    ).toBe("OT");
    expect(
      getApprovalRowType({
        type: "Leave",
        details: "Annual Leave",
        workType: "Normal",
      })
    ).toBe("Leave");
    expect(getApprovalRowType({ type: "Chargeable", details: "OT" })).toBe(
      "OT"
    );
  });

  it("does not read approval filters during the server render", () => {
    window.localStorage.setItem(
      "project-wing:tms:approval-filters:manager-1",
      JSON.stringify({ year: 2025, month: 8, period: "second" })
    );
    const getItem = vi.spyOn(window.localStorage, "getItem");

    try {
      renderToString(
        <ApprovalWorkspace
          user={manager}
          onBack={vi.fn()}
          onSignOut={vi.fn()}
        />
      );

      expect(getItem).not.toHaveBeenCalled();
    } finally {
      getItem.mockRestore();
    }
  });

  it("excludes archived projects and supports the pending project filter", async () => {
    vi.mocked(getTmsApprovalProjects).mockResolvedValue({
      projects: [
        {
          ...project,
          engagementId: "engagement-archived",
          engagementCode: "ARC-2025",
          status: "ARCHIVED",
          pendingCount: 2,
        },
        project,
        {
          ...project,
          engagementId: "engagement-2",
          engagementCode: "WKS-2026-AUD",
          pendingCount: 0,
          status: "INACTIVE",
          returnedCount: 1,
        },
      ],
    });

    const onApprovalPendingChange = vi.fn();
    render(
      <ApprovalWorkspace
        user={manager}
        onBack={vi.fn()}
        onSignOut={vi.fn()}
        onApprovalPendingChange={onApprovalPendingChange}
      />
    );

    const workshopMatches = await screen.findAllByText("WKS-2026-AUD");
    expect(workshopMatches.length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(onApprovalPendingChange).toHaveBeenLastCalledWith(true)
    );
    await waitFor(() =>
      expect(getTmsApprovalRecords).toHaveBeenCalledWith(
        "engagement-1",
        2026,
        7
      )
    );
    expect(getTmsApprovalRecords).not.toHaveBeenCalledWith(
      "engagement-archived",
      2026,
      7
    );
    expect(screen.queryByText("ARC-2025")).toBeNull();
    expect(screen.getAllByText("HBR-2026-ACC").length).toBeGreaterThan(0);
    const projectFilter = screen.getByRole("button", { name: "业务审批筛选" });
    fireEvent.click(projectFilter);
    expect(
      screen.getByRole("button", { name: "仅待审批" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "仅待审批" }));

    expect(screen.getAllByText("HBR-2026-ACC").length).toBeGreaterThan(0);
    expect(screen.queryByText("WKS-2026-AUD")).toBeNull();

    fireEvent.click(projectFilter);
    fireEvent.click(screen.getByRole("button", { name: "全部" }));
    expect(screen.getAllByText("WKS-2026-AUD").length).toBeGreaterThan(0);
  });

  it("follows the period filter and renders employee daily hours without the duplicate heading", async () => {
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await expect(
      screen.findByTestId("approval-row-submission-first-normal")
    ).resolves.toBeInTheDocument();
    expect(screen.queryByTestId("approval-review-dashboard")).toBeNull();
    expect(
      screen.queryByRole("separator", { name: "调整复核看板高度" })
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "全部批准" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("approval-workspace-shell")).toHaveClass(
      "w-full",
      "max-w-none"
    );
    await waitFor(() =>
      expect(screen.getAllByTestId(/approval-row-/)).toHaveLength(4)
    );
    expect(screen.queryByRole("heading", { name: "项目工时审批" })).toBeNull();
    expect(
      screen.getByTestId("approval-total-detail-submission-first-normal")
    ).toHaveTextContent("12.0h");
    expect(
      screen.getByRole("textbox", { name: "Jony Ma Normal 2026-07-03 hours" })
    ).toHaveValue("8.0");

    fireEvent.click(screen.getByRole("combobox", { name: "Period" }));
    const firstHalfOption = await screen.findByRole("option", {
      name: "1st - 15th",
    });
    fireEvent.pointerDown(firstHalfOption);
    fireEvent.click(firstHalfOption);
    await waitFor(() => expect(screen.queryByText("Amy Chan")).toBeNull());
    expect(
      screen.getAllByRole("columnheader", { name: /^3Fri$/ }).length
    ).toBeGreaterThan(0);
  });

  it("fits below the persistent TMS header when rendered without its own header", async () => {
    render(
      <ApprovalWorkspace
        renderHeader={false}
        user={manager}
        onBack={vi.fn()}
        onSignOut={vi.fn()}
      />
    );

    await screen.findByTestId("approval-row-submission-first-normal");

    expect(screen.getByRole("main")).toHaveClass("h-[calc(100vh-3.5rem)]");
    expect(screen.getByRole("main")).not.toHaveClass("h-screen");
    expect(screen.getByTestId("approval-workspace-shell")).toHaveClass(
      "h-full"
    );
    expect(screen.getByTestId("approval-workspace-shell")).not.toHaveClass(
      "h-[calc(100vh-3.5rem)]"
    );
  });

  it("does not render the review dashboard", async () => {
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await screen.findByTestId("approval-row-submission-first-normal");

    expect(screen.queryByTestId("approval-review-dashboard")).toBeNull();
    expect(
      screen.queryByRole("separator", { name: "调整复核看板高度" })
    ).toBeNull();
  });

  it("merges the same employee's two half records into one All-period row", async () => {
    vi.mocked(getTmsApprovalRecords).mockResolvedValueOnce({
      records: [
        firstRecord,
        {
          ...firstRecord,
          id: "submission-second-same-owner",
          half: "SECOND_HALF" as const,
          submittedRows: [],
        },
      ],
    });

    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await waitFor(() =>
      expect(screen.getAllByTestId(/approval-row-/)).toHaveLength(2)
    );
  });

  it("keeps approved submissions editable for the approver and keeps the matrix viewport stable", async () => {
    vi.mocked(getTmsApprovalRecords).mockResolvedValueOnce({
      records: [{ ...firstRecord, status: "APPROVED" as const }],
    });

    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    const row = await screen.findByTestId(
      "approval-row-submission-first-normal"
    );
    expect(row).not.toHaveAttribute("data-locked");
    expect(row).toHaveClass("bg-muted/20");
    const summaryInput = screen.getByRole("textbox", {
      name: "Jony Ma Normal 2026-07-03 hours",
    });
    expect(summaryInput).toHaveAttribute("readonly");
    fireEvent.click(screen.getByRole("button", { name: "修改" }));
    await expect(
      screen.findByRole("textbox", {
        name: "Jony Ma Normal 2026-07-03 hours",
      })
    ).resolves.not.toHaveAttribute("readonly");
    const matrix = screen.getByTestId("approval-timesheet-matrix");
    expect(matrix).toHaveClass("overflow-x-auto", "overflow-y-hidden");
    expect(matrix.parentElement).toHaveClass(
      "isolate",
      "overflow-hidden",
      "rounded-lg"
    );
    expect(screen.getByTestId("approval-results-frame")).toHaveClass(
      "min-h-0",
      "flex-1",
      "overflow-y-auto"
    );
    expect(screen.getByText("Year")).toBeInTheDocument();
    expect(screen.getByText("Month")).toBeInTheDocument();
    expect(screen.getByText("Period")).toBeInTheDocument();
    expect(screen.getByText("Jul", { exact: true })).toBeInTheDocument();
  });

  it("keeps the fixed Name layer opaque and separated from date columns", async () => {
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    const row = await screen.findByTestId(
      "approval-row-submission-first-normal"
    );
    const nameHeader = screen
      .getAllByRole("button", { name: "Filter Name" })[0]
      .closest("th");

    expect(nameHeader).toHaveClass("bg-muted", "w-[112px]", "min-w-[112px]");
    expect(row.querySelector("td")).toHaveClass("w-[112px]", "min-w-[112px]");
  });

  it("uses the homepage continuous grid lines for approval date cells", async () => {
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    const row = await screen.findByTestId(
      "approval-row-submission-first-normal"
    );
    const table = within(
      screen.getByTestId("approval-timesheet-matrix")
    ).getByRole("table");
    const firstDateHeader = within(table).getByRole("columnheader", {
      name: /^1Wed$/,
    });
    const firstDateCell = row.querySelectorAll("td").item(4);
    if (!firstDateCell) {
      throw new Error("Expected the first approval date cell");
    }

    expect(table).toHaveClass(
      "table-fixed",
      "border-collapse",
      "border-spacing-0",
      "min-w-[1990px]"
    );
    expect(firstDateHeader).toHaveClass("border-r", "border-border");
    expect(firstDateCell).toHaveClass("border-r", "border-border", "p-0");
    expect(row).toHaveClass("last:border-b");
  });

  it("matches the compact homepage row geometry and shows submitted descriptions", async () => {
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    const firstRow = await screen.findByTestId(
      "approval-row-submission-first-normal"
    );
    const table = within(
      screen.getByTestId("approval-timesheet-matrix")
    ).getByRole("table");
    const headers = [...table.querySelectorAll("th")];
    const columns = [...table.querySelectorAll("col")];

    expect(
      within(table).getByRole("columnheader", { name: "Description" })
    ).toHaveClass("w-[222px]");
    expect(columns.slice(0, 4).map((column) => column.className)).toStrictEqual(
      ["w-[112px]", "w-[104px]", "w-[88px]", "w-[64px] approval-type-column"]
    );
    expect(
      headers.slice(0, 6).map((header) => header.textContent?.trim())
    ).toStrictEqual(["Name", "操作", "Status", "Type", "1Wed", "2Thu"]);
    expect(headers[1]).toHaveClass("sticky", "left-[112px]");
    expect(headers[2]).toHaveClass("sticky", "left-[216px]");
    expect(headers[3]).toHaveClass("sticky", "left-[304px]");
    expect(screen.getByText("Status").parentElement).toHaveClass(
      "relative",
      "pr-6",
      "text-center"
    );
    expect(screen.getByText("Status").nextElementSibling).toHaveClass(
      "absolute",
      "right-1"
    );
    expect(headers[3]).not.toHaveClass("shadow-[2px_0_0_var(--border)]");
    expect(firstRow.querySelectorAll("td")[3]).toHaveClass(
      "sticky",
      "left-[304px]"
    );
    expect(firstRow.querySelectorAll("td")[3]).not.toHaveClass(
      "shadow-[2px_0_0_var(--border)]"
    );
    const matrix = screen.getByTestId("approval-timesheet-matrix");
    expect(matrix).toHaveClass("overflow-x-auto", "overflow-y-hidden");
    expect(matrix).toHaveAccessibleName(
      "Approval horizontal scroll: Annual audit"
    );
    expect(
      screen.queryByLabelText("Approval horizontal scroll")
    ).not.toBeInTheDocument();

    expect(firstRow).toHaveClass("h-7");
    expect(firstRow.querySelector("td")).toHaveClass("p-0");
    expect(firstRow.querySelector("td")).toHaveTextContent("Jony Ma");
    expect(firstRow.querySelector("td")).not.toHaveTextContent("上 · r2");
    expect(
      screen.getByTestId("approval-description-submission-first-normal")
    ).toHaveTextContent("Fieldwork");
    expect(
      screen.getByTestId("approval-description-submission-second-normal")
    ).toBeEmptyDOMElement();
  });

  it("keeps the Normal/OT pair in a closed compact grid", async () => {
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    const normalRow = await screen.findByTestId(
      "approval-row-submission-first-normal"
    );
    const table = within(
      screen.getByTestId("approval-timesheet-matrix")
    ).getByRole("table");
    const otRow = screen.getByTestId("approval-row-submission-first-ot");

    expect(table).toHaveClass(
      "table-fixed",
      "border-collapse",
      "border-spacing-0"
    );
    expect(
      [...normalRow.querySelectorAll("td")]
        .slice(0, 3)
        .map((cell) => cell.getAttribute("rowspan"))
    ).toStrictEqual([null, null, null]);
    const normalTotalCell = screen
      .getByTestId("approval-total-detail-submission-first-normal")
      .closest("td");
    const otTotalCell = screen
      .getByTestId("approval-total-detail-submission-first-ot")
      .closest("td");
    expect(normalTotalCell).toBe(normalRow.querySelectorAll("td")[35]);
    expect(otTotalCell).toBe(otRow.querySelectorAll("td")[35]);
    expect(normalTotalCell).not.toHaveAttribute("rowspan");
    expect(otTotalCell).not.toHaveAttribute("rowspan");
    expect(normalRow.querySelectorAll("td")[3]).toHaveTextContent("Normal");
    expect(otRow.querySelectorAll("td")[3]).toHaveTextContent("OT");
    expect(
      screen.queryByTestId("approval-row-submission-first-leave")
    ).toBeNull();
    expect(
      screen.queryByTestId("approval-total-aggregate-submission-first")
    ).toBeNull();
    expect(normalTotalCell).toHaveClass("h-7");
    expect(otTotalCell).toHaveClass("h-7");
    expect(otRow).toHaveClass("last:border-b");
  });

  it("gives every expanded EMP project its own clipped horizontal scroller", async () => {
    const taxRecord = {
      ...firstRecord,
      id: "submission-tax-first",
      projectId: "project-2",
      projectCode: "HBR-PROJECT-02",
      projectName: "Tax support",
      submittedRows: [
        {
          ...firstRecord.submittedRows[0],
          id: "row-tax-first",
          projectId: "project-2",
        },
      ],
    };
    vi.mocked(getTmsApprovalProjects).mockResolvedValueOnce({
      projects: [{ ...project, projectCount: 2 }],
    });
    vi.mocked(getTmsApprovalRecords).mockResolvedValueOnce({
      records: [firstRecord, taxRecord],
    });

    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await screen.findByTestId("approval-timesheet-matrix");
    fireEvent.click(screen.getByRole("button", { name: "展开 Tax support" }));
    const matrices = await screen.findAllByTestId("approval-timesheet-matrix");

    expect(matrices).toHaveLength(2);
    expect(
      matrices.every((matrix) => matrix.classList.contains("overflow-x-auto"))
    ).toBeTruthy();
    expect(
      new Set(matrices.map((matrix) => matrix.closest("article"))).size
    ).toBe(2);
  });

  it("keeps only two evenly spaced review actions and moves Edit below Approve all", async () => {
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await screen.findByTestId("approval-row-submission-first-normal");
    const actions = screen.getByTestId("approval-actions-submission-first");
    const approveButton = screen.getByRole("button", {
      name: "批准 Jony Ma",
    });
    const returnButton = screen.getByRole("button", {
      name: "退回 Jony Ma",
    });
    const editButton = screen.getByRole("button", { name: "修改" });

    expect(actions).toHaveClass("flex", "gap-1.5", "h-14");
    expect(actions).not.toHaveClass("grid", "grid-rows-2");
    expect(approveButton).toHaveClass("size-7");
    expect(returnButton).toHaveClass("size-7");
    expect(within(actions).queryByRole("button", { name: /修改/ })).toBeNull();
    const approveAllButton = screen.getByRole("button", { name: "全部批准" });
    expect(approveAllButton.parentElement).toContainElement(editButton);
    expect(approveAllButton.parentElement).toHaveClass(
      "flex",
      "items-center",
      "gap-1.5"
    );
    expect(approveAllButton.parentElement).not.toHaveClass("flex-col");
    expect(screen.getByTestId("approval-header-controls")).toHaveClass(
      "items-end",
      "gap-2"
    );
    const saveState = screen.getByTestId("approval-save-status");
    expect(saveState).toHaveAttribute("data-stateful-motion-button", "true");
    expect(saveState).toHaveAttribute("data-variant", "ghost");
    expect(saveState).toHaveClass("h-7", "px-2", "text-xs!");
    expect(
      saveState.closest("[data-testid='approval-project-heading']")
    ).toBeInTheDocument();
    expect(screen.queryByText("当前项目")).toBeNull();
    expect(screen.getByTestId("approval-project-heading")).not.toHaveClass(
      "mt-1"
    );
    expect(screen.getByTestId("approval-results-frame")).toHaveClass("mt-2");
  });

  it("matches the timesheet value styling while editing Normal and OT hours", async () => {
    const otRow = {
      ...firstRecord.submittedRows[0],
      id: "row-first-ot",
      details: "OT" as const,
      description: "Overtime",
      hoursByDate: { "2026-07-03": 4 },
      periodTotal: 4,
    };
    vi.mocked(getTmsApprovalRecords).mockResolvedValueOnce({
      records: [
        {
          ...firstRecord,
          submittedRows: [...firstRecord.submittedRows, otRow],
        },
      ],
    });

    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    const normalInput = await screen.findByRole("textbox", {
      name: "Jony Ma Normal 2026-07-03 hours",
    });
    const overtimeInput = await screen.findByRole("textbox", {
      name: "Jony Ma OT 2026-07-03 hours",
    });
    const emptyOvertimeInput = screen.getByRole("textbox", {
      name: "Jony Ma OT 2026-07-10 hours",
    });
    const editButton = screen.getByRole("button", { name: "修改" });

    expect(normalInput).toHaveAttribute("readonly");
    expect(overtimeInput).toHaveAttribute("readonly");
    expect(normalInput).toHaveClass("bg-muted", "text-muted-foreground");
    expect(overtimeInput).toHaveClass("bg-muted", "text-muted-foreground");

    fireEvent.click(editButton);

    expect(normalInput).not.toHaveAttribute("readonly");
    expect(overtimeInput).not.toHaveAttribute("readonly");
    expect(normalInput).toHaveClass(
      "border-primary/30",
      "bg-primary/10",
      "text-primary"
    );
    expect(overtimeInput).toHaveClass(
      "border-primary/30",
      "bg-primary/10",
      "text-primary"
    );
    expect(emptyOvertimeInput).toHaveClass(
      "border-input",
      "bg-background",
      "text-foreground"
    );

    fireEvent.click(screen.getByRole("button", { name: "确认修改" }));

    expect(normalInput).toHaveAttribute("readonly");
    expect(overtimeInput).toHaveAttribute("readonly");
    expect(normalInput).toHaveClass("bg-muted", "text-muted-foreground");
    expect(overtimeInput).toHaveClass("bg-muted", "text-muted-foreground");
  });

  it("uses compact header filters and leaves one batch approval action", async () => {
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await screen.findByTestId("approval-row-submission-first-normal");
    const [nameFilter] = screen.getAllByRole("button", {
      name: "Filter Name",
    });
    if (!nameFilter) {
      throw new Error("Expected the approval name filter");
    }
    expect(nameFilter).toHaveClass(
      "size-6",
      "hover:border-primary/50",
      "data-[filter-active=true]:border-primary/60"
    );
    expect(nameFilter.parentElement).not.toHaveAttribute(
      "data-slot",
      "tooltip-trigger"
    );
    expect(
      screen.getByRole("button", { name: "Filter Status" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "全部批准" })
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("搜索员工")).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Status" })).toBeNull();
  });

  it("keeps the CMP navigation list to business code and client name", async () => {
    vi.mocked(getTmsApprovalProjects).mockResolvedValue({
      projects: [
        project,
        {
          ...project,
          engagementId: "engagement-2",
          engagementCode: "ARC-2025",
          status: "INACTIVE",
        },
      ],
    });
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    const navigation = screen.getByTestId("approval-project-pane");
    await expect(
      within(navigation).findByText("HBR-2026-ACC")
    ).resolves.toBeInTheDocument();
    expect(
      within(navigation).getAllByText("Harbour Retail Limited")
    ).toHaveLength(2);
    expect(within(navigation).queryByText("C-HBR-2026")).toBeNull();
    expect(within(navigation).queryByText("进行中")).toBeNull();
    expect(within(navigation).queryByText("已暂停")).toBeNull();
    const approveButton = await screen.findByRole("button", {
      name: "批准 Jony Ma",
    });
    expect(approveButton).toHaveClass(
      "size-7",
      "border",
      "hover:bg-success/10",
      "hover:text-success"
    );
    expect(screen.getByRole("button", { name: "退回 Jony Ma" })).toHaveClass(
      "size-7",
      "border",
      "hover:bg-destructive/10",
      "hover:text-destructive"
    );
    expect(screen.getByTestId("approval-actions-submission-first")).toHaveClass(
      "flex",
      "items-center",
      "gap-1.5",
      "h-14",
      "rounded-md"
    );
    expect(
      screen.getByTestId("approval-actions-submission-first")
    ).not.toHaveClass("border-border/70");
    expect(
      screen.getByRole("button", { name: "批准 Jony Ma" }).dataset
        .baseUiTooltipTrigger
    ).toBeUndefined();
    expect(
      screen.getByRole("button", { name: "退回 Jony Ma" }).dataset
        .baseUiTooltipTrigger
    ).toBeUndefined();
    expect(screen.queryByText("退回", { selector: "button" })).toBeNull();
  });

  it("approves one submitted row from its check action", async () => {
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "批准 Jony Ma" })
    );

    await waitFor(() =>
      expect(approveTmsSubmission).toHaveBeenCalledWith("submission-first", {
        expectedRevision: 2,
      })
    );
    expect(screen.queryByText("Jony Ma 的提交已批准")).toBeNull();
  });

  it("refreshes the project pending count after approving a submission", async () => {
    const onApprovalPendingChange = vi.fn();
    vi.mocked(getTmsApprovalProjects).mockReset();
    vi.mocked(getTmsApprovalProjects)
      .mockResolvedValueOnce({ projects: [project] })
      .mockResolvedValueOnce({
        projects: [{ ...project, pendingCount: 0 }],
      });

    render(
      <ApprovalWorkspace
        user={manager}
        onApprovalPendingChange={onApprovalPendingChange}
        onBack={vi.fn()}
        onSignOut={vi.fn()}
      />
    );

    await waitFor(() =>
      expect(onApprovalPendingChange).toHaveBeenLastCalledWith(true)
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "批准 Jony Ma" })
    );

    await waitFor(() => {
      expect(getTmsApprovalProjects).toHaveBeenCalledTimes(2);
      expect(onApprovalPendingChange).toHaveBeenLastCalledWith(false);
    });
  });

  it("keeps the original approval panel motion token", async () => {
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    const shell = await screen.findByTestId("approval-table-motion-shell");
    expect(shell).not.toHaveClass("duration-[var(--motion-panel)]");
    await expect(
      screen.findByTestId("approval-row-submission-first-normal")
    ).resolves.toHaveClass("duration-[var(--motion-panel)]");
  });

  it("wraps fetched approval records in a soft refresh transition", async () => {
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    const transition = await screen.findByTestId("approval-records-transition");
    expect(transition).toHaveClass("approval-records-transition");
  });

  it("keeps both original review buttons mounted while a review is pending", async () => {
    type ApprovalResult = Awaited<ReturnType<typeof approveTmsSubmission>>;
    let resolveApproval!: (record: ApprovalResult) => void;
    vi.mocked(approveTmsSubmission).mockReturnValueOnce(
      new Promise<ApprovalResult>((resolve) => {
        resolveApproval = resolve;
      })
    );
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "批准 Jony Ma" })
    );

    const actions = screen.getByTestId("approval-actions-submission-first");
    expect(actions).not.toHaveAttribute("data-review-selection");
    expect(
      screen.getByRole("button", { name: "批准 Jony Ma" })
    ).not.toHaveAttribute("aria-pressed");
    expect(
      screen.getByRole("button", { name: "退回 Jony Ma" })
    ).toBeInTheDocument();

    resolveApproval({ ...firstRecord, status: "APPROVED" as const });
    await waitFor(() =>
      expect(approveTmsSubmission).toHaveBeenCalledWith("submission-first", {
        expectedRevision: 2,
      })
    );
  });

  it("keeps the column filter popup at a fixed scrollable size", async () => {
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await screen.findByTestId("approval-row-submission-first-normal");
    fireEvent.click(screen.getAllByRole("button", { name: "Filter Name" })[0]);
    const searchbox = await screen.findByRole("searchbox", {
      name: "Search Name",
    });
    const popup = searchbox.closest<HTMLElement>(
      '[data-slot="popover-content"]'
    );

    expect(popup).toHaveClass("h-72", "w-60");
    expect(popup?.querySelector(".overflow-y-auto")).toHaveClass(
      "min-h-0",
      "flex-1"
    );
  });

  it("filters approval rows from the Name header filter", async () => {
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await screen.findByTestId("approval-row-submission-first-normal");
    fireEvent.click(screen.getAllByRole("button", { name: "Filter Name" })[0]);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Amy Chan" }));

    await waitFor(() => {
      expect(
        screen.queryByTestId("approval-row-submission-first-normal")
      ).toBeNull();
      expect(
        screen.getByTestId("approval-row-submission-second-normal")
      ).toBeInTheDocument();
    });
  });

  it("opens the project pane at its minimum width with a persistent rail", async () => {
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await screen.findByTestId("approval-row-submission-first-normal");
    const pane = screen.getByTestId("approval-project-pane");
    const grid = pane.parentElement as HTMLElement;
    const controls = screen.getByTestId("approval-project-pane-controls");
    expect(grid).toHaveClass(
      "gap-1",
      "lg:grid-cols-[var(--project-pane-width)_8px_minmax(0,1fr)]"
    );
    expect(controls.className.split(/\s+/)).toStrictEqual(
      expect.arrayContaining([
        "h-full",
        "w-full",
        "cursor-pointer",
        "active:cursor-col-resize",
      ])
    );
    expect(controls).not.toHaveClass(
      "border",
      "rounded-md",
      "bg-muted/40",
      "hover:bg-muted",
      "active:bg-primary/10"
    );
    expect(controls.className.split(/\s+/)).not.toContain("rounded-lg");
    expect(controls.className.split(/\s+/)).not.toContain(
      "aria-expanded:bg-muted"
    );
    const frame = controls;
    expect(frame).toHaveAttribute("data-project-pane-frame");
    expect(screen.getByTestId("approval-project-pane-hit-area")).toHaveClass(
      "absolute",
      "inset-y-0",
      "-inset-x-3",
      "cursor-pointer",
      "active:cursor-col-resize",
      "touch-none",
      "select-none"
    );
    expect(controls).toHaveClass("touch-none", "select-none");
    expect(
      frame.querySelector('[data-testid="approval-project-pane-grip"]')
    ).toHaveClass(
      "h-12",
      "w-1",
      "bg-muted-foreground/35",
      "group-hover:bg-primary"
    );
    expect(pane).toHaveAttribute("data-project-pane-width", "280");
    const projectCard = screen.getByRole("button", {
      name: /HBR-2026-ACC.*Harbour Retail Limited/,
    });
    expect(projectCard).toHaveClass("w-full", "min-w-0", "overflow-hidden");
    expect(projectCard.querySelector("div.mt-3")).toBeNull();
    expect(screen.getAllByRole("separator", { name: "拉动伸缩" })).toHaveLength(
      1
    );
    expect(screen.getByRole("separator", { name: "拉动伸缩" })).toHaveAttribute(
      "aria-orientation",
      "vertical"
    );
    expect(screen.queryByRole("button", { name: "向右侧微调" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "向右/左侧拉出/收缩到底" })
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "向左侧微调" })).toBeNull();
  });

  it("toggles the project pane from the resize handle and shows a collapsed rail", async () => {
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await screen.findByTestId("approval-row-submission-first-normal");
    const pane = screen.getByTestId("approval-project-pane");
    const controls = screen.getByRole("separator", { name: "拉动伸缩" });

    fireEvent.click(controls);

    expect(pane).toHaveAttribute("data-project-pane-width", "0");
    expect(controls).toHaveAttribute("aria-valuenow", "0");
    const frame = controls;
    expect(frame).toHaveAttribute("data-state", "collapsed");
    expect(frame).toHaveAttribute("data-project-pane-frame");
    expect(frame).toHaveClass("h-full", "w-full");
    expect(frame).not.toHaveClass(
      "border",
      "rounded-md",
      "bg-muted/40",
      "data-[state=collapsed]:border-primary/35",
      "data-[state=collapsed]:bg-primary/10"
    );
    expect(
      frame.querySelector('[data-testid="approval-project-pane-grip"]')
    ).toHaveClass(
      "h-12",
      "w-1",
      "bg-muted-foreground/35",
      "group-hover:bg-primary",
      "group-data-[state=collapsed]:bg-primary/80"
    );
    expect(screen.queryByTestId("approval-project-pane-chevron")).toBeNull();

    fireEvent.click(controls);
    expect(pane).toHaveAttribute("data-project-pane-width", "280");
    expect(controls).toHaveAttribute("aria-valuenow", "1");
  });

  it("renders the approval matrix without a review board", async () => {
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await screen.findByTestId("approval-row-submission-first-normal");
    const matrixCard = screen.getByTestId("approval-matrix-card");

    expect(matrixCard).toHaveClass("rounded-lg", "border", "bg-card");
    expect(screen.queryByTestId("approval-review-dashboard")).toBeNull();
  });

  it("resizes the project pane by dragging the handle", async () => {
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await screen.findByTestId("approval-row-submission-first-normal");
    const pane = screen.getByTestId("approval-project-pane");
    fireEvent.pointerDown(
      screen.getByTestId("approval-project-pane-hit-area"),
      { button: 0, clientX: 400 }
    );
    fireEvent.pointerMove(window, { clientX: 452 });
    fireEvent.pointerUp(window, { clientX: 452 });

    expect(pane).toHaveAttribute("data-project-pane-width", "332");
  });

  it("coalesces project pane drag paints and commits the final width on release", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    try {
      render(
        <ApprovalWorkspace
          user={manager}
          onBack={vi.fn()}
          onSignOut={vi.fn()}
        />
      );

      await screen.findByTestId("approval-row-submission-first-normal");
      const pane = screen.getByTestId("approval-project-pane");
      const grid = pane.parentElement as HTMLElement;
      const hitArea = screen.getByTestId("approval-project-pane-hit-area");
      fireEvent.pointerDown(hitArea, {
        button: 0,
        clientX: 400,
        pointerId: 1,
      });
      fireEvent.pointerMove(window, { clientX: 452, pointerId: 1 });
      fireEvent.pointerMove(window, { clientX: 460, pointerId: 1 });

      expect(frames).toHaveLength(1);
      expect(grid.style.getPropertyValue("--project-pane-width")).toBe("280px");

      const paintFrame = frames.shift();
      if (!paintFrame) {
        throw new Error("Expected a scheduled resize frame");
      }
      paintFrame(0);
      expect(grid.style.getPropertyValue("--project-pane-width")).toBe("340px");

      fireEvent.pointerUp(window, { clientX: 460, pointerId: 1 });
      expect(pane).toHaveAttribute("data-project-pane-width", "340");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("follows the horizontal drag width before applying the minimum on release", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    try {
      render(
        <ApprovalWorkspace
          user={manager}
          onBack={vi.fn()}
          onSignOut={vi.fn()}
        />
      );

      await screen.findByTestId("approval-row-submission-first-normal");
      const pane = screen.getByTestId("approval-project-pane");
      const grid = pane.parentElement as HTMLElement;
      const hitArea = screen.getByTestId("approval-project-pane-hit-area");

      fireEvent.pointerDown(hitArea, {
        button: 0,
        clientX: 400,
        pointerId: 1,
      });

      expect(grid).toHaveAttribute("data-project-pane-dragging", "true");
      expect(grid.style.transition).toBe("none");

      fireEvent.pointerMove(window, { clientX: 370, pointerId: 1 });
      const paintFrame = frames.shift();
      if (!paintFrame) {
        throw new Error("Expected a scheduled resize frame");
      }
      paintFrame(0);

      expect(grid.style.getPropertyValue("--project-pane-width")).toBe("250px");
      expect(pane).toHaveAttribute("data-project-pane-width", "250");

      fireEvent.pointerUp(window, { clientX: 370, pointerId: 1 });

      expect(pane).toHaveAttribute("data-project-pane-width", "280");
      expect(grid).not.toHaveAttribute("data-project-pane-dragging");
      expect(grid.style.transition).toBe("");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("previews an expansion while dragging the collapsed project pane", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    try {
      render(
        <ApprovalWorkspace
          user={manager}
          onBack={vi.fn()}
          onSignOut={vi.fn()}
        />
      );

      await screen.findByTestId("approval-row-submission-first-normal");
      const controls = screen.getByTestId("approval-project-pane-controls");
      const hitArea = screen.getByTestId("approval-project-pane-hit-area");
      const grid = controls.closest("section") as HTMLElement;

      fireEvent.click(controls);
      expect(controls).toHaveAttribute("aria-valuenow", "0");

      fireEvent.pointerDown(hitArea, {
        button: 0,
        clientX: 400,
        pointerId: 2,
      });
      fireEvent.pointerMove(window, { clientX: 460, pointerId: 2 });
      const paintFrame = frames.shift();
      if (!paintFrame) {
        throw new Error("Expected a scheduled resize frame");
      }
      paintFrame(0);

      expect(grid.style.getPropertyValue("--project-pane-width")).toBe("60px");
      expect(controls).toHaveAttribute("aria-valuenow", "1");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("starts resizing after a short intentional movement", async () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    try {
      render(
        <ApprovalWorkspace
          user={manager}
          onBack={vi.fn()}
          onSignOut={vi.fn()}
        />
      );

      await screen.findByTestId("approval-row-submission-first-normal");
      const pane = screen.getByTestId("approval-project-pane");
      const hitArea = screen.getByTestId("approval-project-pane-hit-area");
      fireEvent.pointerDown(hitArea, { button: 0, clientX: 400 });
      fireEvent.pointerMove(window, { clientX: 402 });

      expect(pane).toHaveAttribute("data-project-pane-width", "282");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("restores the starting width when a captured drag is cancelled", async () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    try {
      render(
        <ApprovalWorkspace
          user={manager}
          onBack={vi.fn()}
          onSignOut={vi.fn()}
        />
      );

      await screen.findByTestId("approval-row-submission-first-normal");
      const pane = screen.getByTestId("approval-project-pane");
      const controls = screen.getByTestId("approval-project-pane-controls");
      fireEvent.pointerDown(controls, {
        button: 0,
        clientX: 400,
        pointerId: 1,
      });
      fireEvent.pointerMove(controls, { clientX: 452, pointerId: 1 });
      expect(pane).toHaveAttribute("data-project-pane-width", "332");

      fireEvent.pointerCancel(controls, { pointerId: 1 });

      expect(pane).toHaveAttribute("data-project-pane-width", "280");
      expect(controls.closest("section")).not.toHaveClass("transition-none");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("snaps the project pane closed below the minimum and expands by dragging out", async () => {
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await screen.findByTestId("approval-row-submission-first-normal");
    const pane = screen.getByTestId("approval-project-pane");
    const hitArea = screen.getByTestId("approval-project-pane-hit-area");
    fireEvent.pointerDown(hitArea, { button: 0, clientX: 400 });
    fireEvent.pointerMove(window, { clientX: 100 });
    fireEvent.pointerUp(window, { clientX: 100 });
    expect(pane).toHaveAttribute("data-project-pane-width", "0");

    fireEvent.pointerDown(hitArea, { button: 0, clientX: 100 });
    fireEvent.pointerMove(window, { clientX: 380 });
    fireEvent.pointerUp(window, { clientX: 380 });
    expect(pane).toHaveAttribute("data-project-pane-width", "280");
  });

  it("opens from the collapsed rail after a short intentional outward drag", async () => {
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await screen.findByTestId("approval-row-submission-first-normal");
    const pane = screen.getByTestId("approval-project-pane");
    const controls = screen.getByRole("separator", { name: "拉动伸缩" });
    const hitArea = screen.getByTestId("approval-project-pane-hit-area");
    fireEvent.click(controls);
    expect(pane).toHaveAttribute("data-project-pane-width", "0");

    fireEvent.pointerDown(hitArea, { button: 0, clientX: 400 });
    fireEvent.pointerMove(window, { clientX: 460 });
    fireEvent.pointerUp(window, { clientX: 460 });

    expect(pane).toHaveAttribute("data-project-pane-width", "280");
  });

  it("does not collapse the project pane until the drag crosses the collapse threshold", async () => {
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await screen.findByTestId("approval-row-submission-first-normal");
    const pane = screen.getByTestId("approval-project-pane");
    const hitArea = screen.getByTestId("approval-project-pane-hit-area");
    fireEvent.pointerDown(hitArea, { button: 0, clientX: 400 });
    fireEvent.pointerMove(window, { clientX: 300 });
    fireEvent.pointerUp(window, { clientX: 300 });

    expect(pane).toHaveAttribute("data-project-pane-width", "280");
  });

  it("keeps a narrowed project pane open until it reaches the collapse threshold", async () => {
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await screen.findByTestId("approval-row-submission-first-normal");
    const pane = screen.getByTestId("approval-project-pane");
    const hitArea = screen.getByTestId("approval-project-pane-hit-area");

    fireEvent.pointerDown(hitArea, { button: 0, clientX: 400 });
    fireEvent.pointerMove(window, { clientX: 312 });
    fireEvent.pointerUp(window, { clientX: 312 });
    expect(pane).toHaveAttribute("data-project-pane-width", "280");

    fireEvent.pointerDown(hitArea, { button: 0, clientX: 400 });
    fireEvent.pointerMove(window, { clientX: 300 });
    fireEvent.pointerUp(window, { clientX: 300 });
    expect(pane).toHaveAttribute("data-project-pane-width", "280");

    fireEvent.pointerDown(hitArea, { button: 0, clientX: 400 });
    fireEvent.pointerMove(window, { clientX: 200 });
    fireEvent.pointerUp(window, { clientX: 200 });
    expect(pane).toHaveAttribute("data-project-pane-width", "280");

    fireEvent.pointerDown(hitArea, { button: 0, clientX: 400 });
    fireEvent.pointerMove(window, { clientX: 167 });
    fireEvent.pointerUp(window, { clientX: 167 });
    expect(pane).toHaveAttribute("data-project-pane-width", "0");
  });

  it("does not resize from a non-primary pointer", async () => {
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await screen.findByTestId("approval-row-submission-first-normal");
    const pane = screen.getByTestId("approval-project-pane");
    const hitArea = screen.getByTestId("approval-project-pane-hit-area");
    fireEvent.pointerDown(hitArea, { button: 2, clientX: 400 });
    fireEvent.pointerMove(window, { clientX: 452 });
    fireEvent.pointerUp(window, { clientX: 452 });

    expect(pane).toHaveAttribute("data-project-pane-width", "280");
  });

  it("provides a rolling two-year approval range", () => {
    expect(buildApprovalYearOptions(2026)).toStrictEqual([
      2024, 2025, 2026, 2027, 2028,
    ]);
    expect(buildApprovalYearOptions(2028)).toStrictEqual([
      2026, 2027, 2028, 2029, 2030,
    ]);
  });

  it("restores only the Year, Month, and Period approval filters", async () => {
    window.localStorage.setItem(
      "project-wing:tms:approval-filters:manager-1",
      JSON.stringify({ year: 2025, month: 8, period: "second" })
    );

    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await screen.findByTestId("approval-row-submission-second-normal");
    expect(screen.getByRole("combobox", { name: "Year" })).toHaveTextContent(
      "2025"
    );
    expect(screen.getByRole("combobox", { name: "Month" })).toHaveTextContent(
      "Aug"
    );
    expect(screen.getByRole("combobox", { name: "Period" })).toHaveTextContent(
      "16th - end"
    );
  });

  it("keeps reversible approval actions after approval", async () => {
    vi.mocked(getTmsApprovalRecords).mockResolvedValueOnce({
      records: [{ ...firstRecord, status: "APPROVED" as const }],
    });
    vi.mocked(approveTmsSubmission).mockResolvedValueOnce({
      ...firstRecord,
      status: "SUBMITTED" as const,
    });

    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    const approveButton = await screen.findByRole("button", {
      name: "批准 Jony Ma",
    });
    expect(approveButton).toHaveClass(
      "bg-success",
      "text-success-foreground",
      "hover:bg-success/85",
      "hover:text-success-foreground"
    );
    fireEvent.click(approveButton);
    await waitFor(() =>
      expect(approveTmsSubmission).toHaveBeenCalledWith("submission-first", {
        expectedRevision: 2,
      })
    );
  });

  it("keeps the approval table host mounted while refreshed records replace its data", async () => {
    vi.mocked(getTmsApprovalRecords).mockClear();
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );
    const table = await screen.findByTestId("approval-records-transition");
    fireEvent.click(
      await screen.findByRole("button", { name: "批准 Jony Ma" })
    );

    await waitFor(() => expect(getTmsApprovalRecords).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("approval-records-transition")).toBe(table);
  });

  it("crossfades refreshed approval data through a browser layout transition", async () => {
    window.localStorage.setItem(
      "project-wing:tms:approval-filters:manager-1",
      JSON.stringify({ year: 2026, month: 7, period: "all" })
    );
    vi.mocked(getTmsApprovalRecords).mockClear();
    const transitionDocument = document as Document & {
      startViewTransition?: (update: () => void) => { finished: Promise<void> };
    };
    const originalStartViewTransition = transitionDocument.startViewTransition;
    const startViewTransition = vi.fn((update: () => void) => {
      update();
      return { finished: Promise.resolve() };
    });
    Object.defineProperty(transitionDocument, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });

    try {
      render(
        <ApprovalWorkspace
          user={manager}
          onBack={vi.fn()}
          onSignOut={vi.fn()}
        />
      );
      await screen.findByTestId("approval-row-submission-first-normal");
      startViewTransition.mockClear();

      fireEvent.click(screen.getByRole("button", { name: "批准 Jony Ma" }));

      await waitFor(() =>
        expect(getTmsApprovalRecords).toHaveBeenCalledTimes(2)
      );
      expect(startViewTransition).toHaveBeenCalledOnce();
    } finally {
      if (originalStartViewTransition) {
        Object.defineProperty(transitionDocument, "startViewTransition", {
          configurable: true,
          value: originalStartViewTransition,
        });
      } else {
        Reflect.deleteProperty(transitionDocument, "startViewTransition");
      }
    }
  });

  it("keeps the whole results frame steady during a background records refresh", async () => {
    type ApprovalRecordsResult = Awaited<
      ReturnType<typeof getTmsApprovalRecords>
    >;
    let resolveRefresh!: (result: ApprovalRecordsResult) => void;
    vi.mocked(getTmsApprovalRecords).mockReset();
    vi.mocked(getTmsApprovalRecords)
      .mockResolvedValueOnce({ records: [firstRecord, secondRecord] })
      .mockReturnValueOnce(
        new Promise<ApprovalRecordsResult>((resolve) => {
          resolveRefresh = resolve;
        })
      );

    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    const frame = await screen.findByTestId("approval-results-frame");
    expect(frame).toHaveAttribute("data-approval-results-state", "ready");
    fireEvent.click(
      await screen.findByRole("button", { name: "批准 Jony Ma" })
    );

    await waitFor(() => expect(getTmsApprovalRecords).toHaveBeenCalledTimes(2));
    expect(frame).toHaveAttribute("data-approval-results-state", "ready");

    resolveRefresh({ records: [firstRecord, secondRecord] });
    await waitFor(() =>
      expect(screen.getByTestId("approval-results-frame")).toBe(frame)
    );
  });

  it("releases project pane dragging when the pointer is cancelled or the window loses focus", async () => {
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await screen.findByTestId("approval-row-submission-first-normal");
    const controls = screen.getByTestId("approval-project-pane-controls");
    const hitArea = screen.getByTestId("approval-project-pane-hit-area");
    const frame = controls.closest("section") as HTMLElement;

    fireEvent.pointerDown(hitArea, { button: 0, clientX: 400 });
    fireEvent.pointerMove(window, { clientX: 452 });
    expect(frame).toHaveAttribute("data-project-pane-dragging", "true");
    expect(frame.style.transition).toBe("none");
    fireEvent.pointerCancel(window);
    expect(frame).not.toHaveAttribute("data-project-pane-dragging");
    expect(frame.style.transition).toBe("");

    fireEvent.pointerDown(hitArea, { button: 0, clientX: 452 });
    fireEvent.pointerMove(window, { clientX: 420 });
    expect(frame).toHaveAttribute("data-project-pane-dragging", "true");
    expect(frame.style.transition).toBe("none");
    fireEvent.blur(window);
    expect(frame).not.toHaveAttribute("data-project-pane-dragging");
    expect(frame.style.transition).toBe("");
  });

  it("allows the project list to scroll vertically without a horizontal scrollbar", async () => {
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await screen.findByTestId("approval-row-submission-first-normal");
    const list = screen
      .getByTestId("approval-project-pane")
      .querySelector("div.min-h-0.flex-1.overflow-y-auto");
    expect(list).toHaveClass("overflow-y-auto", "overflow-x-hidden");
  });

  it("shows approval failures through the top Sonner warning", async () => {
    vi.mocked(approveTmsSubmission).mockRejectedValueOnce(
      new Error("没有审批权限")
    );
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "批准 Jony Ma" })
    );

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("批准失败"));
    expect(screen.queryByTestId("approval-feedback")).not.toBeInTheDocument();
  });

  it("approves all visible submissions and returns a row with a reason", async () => {
    vi.mocked(approveTmsSubmission).mockClear();
    vi.mocked(getTmsApprovalRecords).mockResolvedValue({
      records: [firstRecord, { ...secondRecord, status: "RETURNED" as const }],
    });
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );
    await screen.findByTestId("approval-row-submission-first-normal");
    await waitFor(() =>
      expect(screen.getAllByTestId(/approval-row-/)).toHaveLength(4)
    );

    fireEvent.click(screen.getByRole("button", { name: "全部批准" }));
    await waitFor(() => expect(approveTmsSubmission).toHaveBeenCalledOnce());
    expect(approveTmsSubmission).toHaveBeenNthCalledWith(
      1,
      "submission-first",
      { expectedRevision: 2 }
    );
    expect(screen.queryByText("已批准 1 条提交")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "退回 Jony Ma" }));
    const returnDialog = await screen.findByRole("dialog");
    fireEvent.change(
      within(returnDialog).getByRole("textbox", { name: "退回理由" }),
      { target: { value: "请补充工时说明" } }
    );
    fireEvent.click(within(returnDialog).getByRole("button", { name: "退回" }));
    await waitFor(() =>
      expect(returnTmsSubmission).toHaveBeenCalledWith("submission-first", {
        expectedRevision: 2,
        reason: "请补充工时说明",
      })
    );
  });

  it("undoes only the records approved by the last batch", async () => {
    vi.mocked(approveTmsSubmission).mockClear();
    vi.mocked(approveTmsSubmission)
      .mockResolvedValueOnce({ ...firstRecord, status: "APPROVED" as const })
      .mockResolvedValueOnce({ ...firstRecord, status: "SUBMITTED" as const });
    vi.mocked(getTmsApprovalRecords)
      .mockResolvedValueOnce({ records: [firstRecord] })
      .mockResolvedValueOnce({
        records: [{ ...firstRecord, status: "APPROVED" as const }],
      })
      .mockResolvedValueOnce({ records: [firstRecord] });

    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await screen.findByTestId("approval-row-submission-first-normal");
    fireEvent.click(await screen.findByRole("button", { name: "全部批准" }));
    await waitFor(() => expect(approveTmsSubmission).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "撤销批准" })).toBeEnabled()
    );
    expect(approveTmsSubmission).toHaveBeenNthCalledWith(
      1,
      "submission-first",
      { expectedRevision: 2 }
    );

    fireEvent.click(screen.getByRole("button", { name: "撤销批准" }));
    await waitFor(() =>
      expect(approveTmsSubmission).toHaveBeenNthCalledWith(
        2,
        "submission-first",
        { expectedRevision: 2, restoreStatus: "SUBMITTED" }
      )
    );
    await expect(
      screen.findByRole("button", { name: "全部批准" })
    ).resolves.toBeInTheDocument();
  });

  it("restores pending confirmation records when undoing a batch approval", async () => {
    vi.mocked(approveTmsSubmission).mockClear();
    const pendingConfirmation = {
      ...firstRecord,
      status: "PENDING_CONFIRMATION" as const,
    };
    vi.mocked(approveTmsSubmission)
      .mockResolvedValueOnce({ ...pendingConfirmation, status: "APPROVED" })
      .mockResolvedValueOnce(pendingConfirmation);
    vi.mocked(getTmsApprovalRecords)
      .mockResolvedValueOnce({ records: [pendingConfirmation] })
      .mockResolvedValueOnce({
        records: [{ ...pendingConfirmation, status: "APPROVED" as const }],
      })
      .mockResolvedValueOnce({ records: [pendingConfirmation] });

    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await screen.findByTestId("approval-row-submission-first-normal");
    fireEvent.click(await screen.findByRole("button", { name: "全部批准" }));
    await waitFor(() => expect(approveTmsSubmission).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "撤销批准" })).toBeEnabled()
    );
    fireEvent.click(screen.getByRole("button", { name: "撤销批准" }));

    await waitFor(() =>
      expect(approveTmsSubmission).toHaveBeenNthCalledWith(
        2,
        "submission-first",
        { expectedRevision: 2, restoreStatus: "PENDING_CONFIRMATION" }
      )
    );
  });

  it("shows Normal and OT immediately and requires Edit before changing hours", async () => {
    vi.mocked(editTmsSubmission).mockImplementationOnce((_, input) =>
      Promise.resolve({
        ...firstRecord,
        revision: 3,
        status: "PENDING_CONFIRMATION",
        submittedRows: input.rows,
      })
    );
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await screen.findByTestId("approval-row-submission-first-normal");
    expect(screen.queryByTestId("approval-expand-all")).toBeNull();
    expect(
      screen.queryByTestId("approval-name-trigger-submission-first")
    ).toBeNull();
    expect(screen.getAllByTestId(/approval-row-/)).toHaveLength(4);
    expect(
      screen.getByTestId("approval-row-submission-first-ot")
    ).toBeInTheDocument();

    const normalInput = await screen.findByRole("textbox", {
      name: "Jony Ma Normal 2026-07-03 hours",
    });
    expect(screen.getByTestId("approval-save-status")).toHaveTextContent(
      "已保存"
    );
    expect(normalInput).toHaveAttribute("readonly");

    const editButton = screen.getByRole("button", { name: "修改" });
    expect(editButton).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(editButton);
    expect(editButton).toHaveAttribute("aria-pressed", "true");
    expect(normalInput).not.toHaveAttribute("readonly");

    fireEvent.change(normalInput, { target: { value: "7" } });
    expect(screen.getByTestId("approval-save-status")).toHaveTextContent(
      "待保存"
    );
    await new Promise((resolve) => {
      window.setTimeout(resolve, 650);
    });
    expect(editTmsSubmission).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "确认修改" }));
    await waitFor(() =>
      expect(editTmsSubmission).toHaveBeenCalledWith(
        "submission-first",
        expect.objectContaining({ expectedRevision: 2 })
      )
    );
    await screen.findByText("待确认");
    expect(screen.getByTestId("approval-save-status")).toHaveTextContent(
      "已保存"
    );
  });

  it("creates an OT row when the employee submitted only Normal hours", async () => {
    vi.mocked(editTmsSubmission).mockImplementationOnce((_, input) =>
      Promise.resolve({
        ...firstRecord,
        revision: 3,
        status: "PENDING_CONFIRMATION",
        submittedRows: input.rows,
      })
    );
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await screen.findByTestId("approval-row-submission-first-normal");
    fireEvent.click(screen.getByRole("button", { name: "修改" }));
    const otInput = await screen.findByRole("textbox", {
      name: "Jony Ma OT 2026-07-03 hours",
    });
    fireEvent.change(otInput, { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "确认修改" }));

    await waitFor(() =>
      expect(editTmsSubmission).toHaveBeenCalledWith(
        firstRecord.id,
        expect.objectContaining({
          rows: expect.arrayContaining([
            expect.objectContaining({
              id: "row-first-approval-ot",
              workType: "OT",
              hoursByDate: { "2026-07-03": 2 },
            }),
          ]),
        })
      )
    );
  });

  it("does not autosave when a detail hours input blurs without changing its value", async () => {
    vi.mocked(editTmsSubmission).mockClear();
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    const summaryInput = await screen.findByRole("textbox", {
      name: "Jony Ma Normal 2026-07-03 hours",
    });
    fireEvent.click(screen.getByRole("button", { name: "修改" }));
    const detailInput = summaryInput;

    fireEvent.blur(detailInput);
    await new Promise((resolve) => {
      window.setTimeout(resolve, 650);
    });

    expect(editTmsSubmission).not.toHaveBeenCalled();
  });

  it("does not save when edited hours are restored before confirmation", async () => {
    vi.mocked(editTmsSubmission).mockClear();
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    const input = await screen.findByRole("textbox", {
      name: "Jony Ma Normal 2026-07-03 hours",
    });
    fireEvent.click(screen.getByRole("button", { name: "修改" }));
    fireEvent.change(input, { target: { value: "7" } });
    expect(screen.getByTestId("approval-save-status")).toHaveTextContent(
      "待保存"
    );
    fireEvent.change(input, { target: { value: "8" } });
    expect(screen.getByTestId("approval-save-status")).toHaveTextContent(
      "已保存"
    );

    fireEvent.click(screen.getByRole("button", { name: "确认修改" }));

    expect(editTmsSubmission).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("readonly");
  });

  it("keeps only the matrix Name filter when the review board is absent", async () => {
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await screen.findByTestId("approval-row-submission-first-normal");
    const nameFilters = screen.getAllByRole("button", { name: "Filter Name" });
    expect(nameFilters).toHaveLength(1);
    expect(screen.queryByTestId("approval-review-dashboard")).toBeNull();
  });

  it("switches All to the only half that matches a Status filter", async () => {
    const secondHalf = {
      ...firstRecord,
      id: "submission-second-half",
      half: "SECOND_HALF" as const,
      submittedRows: [
        {
          ...firstRecord.submittedRows[0],
          id: "row-second-half",
          periodScope: "second" as const,
          hoursByDate: completeWorkdayHours("second"),
          periodTotal: 96,
        },
      ],
    };
    vi.mocked(getTmsApprovalRecords).mockResolvedValueOnce({
      records: [
        { ...firstRecord, status: "NOT_SUBMITTED" as const, submittedRows: [] },
        secondHalf,
      ],
    });

    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await screen.findByTestId(
      "approval-row-approval-group-project-1-employee-1-normal"
    );
    fireEvent.click(screen.getByRole("button", { name: "Filter Status" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "未提交" }));

    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Period" })
      ).toHaveTextContent("1st - 15th")
    );
    expect(
      screen.queryByRole("textbox", { name: "Jony Ma Normal 2026-07-16 hours" })
    ).toBeNull();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("textbox", { name: "Jony Ma Normal 2026-07-03 hours" })
    ).toBeNull();
  });

  it("classifies zero workdays inside a submitted half as unsubmitted", async () => {
    const submittedSecondHalf = {
      ...firstRecord,
      id: "submission-second-half-complete",
      half: "SECOND_HALF" as const,
      submittedRows: [
        {
          ...firstRecord.submittedRows[0],
          id: "row-second-half-complete",
          periodScope: "second" as const,
          hoursByDate: { "2026-07-16": 10, "2026-07-17": 8 },
          periodTotal: 18,
        },
      ],
    };
    vi.mocked(getTmsApprovalRecords).mockResolvedValueOnce({
      records: [submittedSecondHalf],
    });

    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await screen.findByRole("textbox", {
      name: "Jony Ma Normal 2026-07-16 hours",
    });
    fireEvent.click(screen.getByRole("combobox", { name: "Period" }));
    fireEvent.click(await screen.findByRole("option", { name: "16th - end" }));
    fireEvent.click(screen.getByRole("button", { name: "Filter Status" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "未提交" }));

    await waitFor(() =>
      expect(
        screen.getByTestId(
          "approval-row-submission-second-half-complete-normal"
        )
      ).toBeInTheDocument()
    );
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("textbox", { name: "Jony Ma Normal 2026-07-20 hours" })
    ).toBeNull();
  });

  it("keeps All and masks unmatched halves when different employees match different halves", async () => {
    const jonySecondHalf = {
      ...firstRecord,
      id: "submission-jony-second",
      half: "SECOND_HALF" as const,
      submittedRows: [
        {
          ...firstRecord.submittedRows[0],
          id: "row-jony-second",
          periodScope: "second" as const,
          hoursByDate: completeWorkdayHours("second"),
          periodTotal: 96,
        },
      ],
    };
    const amyFirstHalf = {
      ...secondRecord,
      id: "submission-amy-first",
      half: "FIRST_HALF" as const,
      status: "SUBMITTED" as const,
      submittedRows: [
        {
          ...firstRecord.submittedRows[0],
          id: "row-amy-first",
          periodScope: "first" as const,
          hoursByDate: completeWorkdayHours("first"),
          periodTotal: 88,
        },
      ],
    };
    const amySecondHalf = {
      ...secondRecord,
      id: "submission-amy-second",
      half: "SECOND_HALF" as const,
      status: "NOT_SUBMITTED" as const,
      submittedRows: [],
    };
    vi.mocked(getTmsApprovalRecords).mockResolvedValueOnce({
      records: [
        { ...firstRecord, status: "NOT_SUBMITTED" as const, submittedRows: [] },
        jonySecondHalf,
        amyFirstHalf,
        amySecondHalf,
      ],
    });

    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await screen.findByTestId(
      "approval-row-approval-group-project-1-employee-1-normal"
    );
    fireEvent.click(screen.getByRole("button", { name: "Filter Status" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "未提交" }));

    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Period" })
      ).toHaveTextContent("All")
    );
    expect(
      screen.getByTestId(
        "approval-row-approval-group-project-1-employee-1-normal"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(
        "approval-row-approval-group-project-1-employee-2-normal"
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Jony Ma Normal 2026-07-16 hours" })
    ).toBeNull();
    expect(
      screen.queryByRole("textbox", {
        name: "Amy Chan Normal 2026-07-03 hours",
      })
    ).toBeNull();
  });

  it("renders dashes for an unsubmitted record and prevents editing", async () => {
    const emptyRow = {
      ...firstRecord.submittedRows[0],
      hoursByDate: {},
      periodTotal: 0,
    };
    vi.mocked(getTmsApprovalRecords).mockResolvedValueOnce({
      records: [
        {
          ...firstRecord,
          status: "NOT_SUBMITTED" as const,
          submittedRows: [emptyRow],
        },
      ],
    });

    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await expect(
      screen.findByTestId(
        "approval-unsubmitted-cell-submission-first-normal-2026-07-03"
      )
    ).resolves.toHaveTextContent("—");
    expect(
      screen.queryByRole("textbox", { name: "Jony Ma Normal 2026-07-03 hours" })
    ).toBeNull();
    expect(
      screen.queryByRole("textbox", {
        name: "Jony Ma Normal 2026-07-03 hours",
      })
    ).toBeNull();
  });

  it("renders a dash instead of a zero input for a submitted weekend with zero hours", async () => {
    render(
      <ApprovalWorkspace user={manager} onBack={vi.fn()} onSignOut={vi.fn()} />
    );

    await expect(
      screen.findByRole("textbox", {
        name: "Jony Ma Normal 2026-07-03 hours",
      })
    ).resolves.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Jony Ma Normal 2026-07-05 hours" })
    ).toBeNull();
    expect(
      screen.getByTestId(
        "approval-unsubmitted-cell-submission-first-normal-2026-07-05"
      )
    ).toHaveTextContent("—");
  });
});
