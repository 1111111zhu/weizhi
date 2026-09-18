// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type {
  TmsApprovalProject,
  TmsApprovalRecord,
  TmsTimesheetQueryResponse,
} from "@project-wing/shared";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getTmsWorkspaceCopy,
  tmsSettingsCopyByLocale,
} from "@/i18n/dictionaries";
import * as api from "@/lib/api";
import { selectApprovalGroups } from "@/lib/approval-filter";
import { buildPeriodDays, calculateDashboard } from "@/lib/timesheet";
import type { TimesheetRow } from "@/lib/timesheet";

import { ApprovalMobile } from "./approval-mobile";
import { OverviewWorkspace } from "./overview-workspace";
import { QueryWorkspace } from "./query-workspace";
import { TimesheetMobile } from "./timesheet-mobile";
import { TmsMobileHeader } from "./tms-mobile-header";

const copy = getTmsWorkspaceCopy("en-US");
const days = buildPeriodDays(2026, 7, "first");
const row: TimesheetRow = {
  id: "row-1",
  type: "Non-Chargeable",
  details: "Internal Admin",
  workType: "Normal",
  periodScope: "first",
  description: "Office work",
  hoursByDate: { "2026-07-01": 2 },
  periodTotal: 2,
};
const user = {
  id: "manager",
  name: "Manager",
  email: "manager@example.test",
  globalRole: "MANAGER",
};
function mobileViewport(query: string): MediaQueryList {
  return {
    matches: query.includes("767"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}
function timesheet(
  overrides: Partial<Parameters<typeof TimesheetMobile>[0]> = {}
) {
  const dashboard = calculateDashboard([row], days);
  const props: Parameters<typeof TimesheetMobile>[0] = {
    rows: [row],
    days,
    locale: "en-US",
    year: 2026,
    month: 7,
    period: "first",
    yearOptions: [2026],
    onYearChange: vi.fn(),
    onMonthChange: vi.fn(),
    onPeriodChange: vi.fn(),
    typeFilter: "All",
    onTypeFilterChange: vi.fn(),
    deleteMode: false,
    selectedIds: new Set(),
    onToggleSelected: vi.fn(),
    onHourChange: vi.fn(),
    onDescriptionChange: vi.fn(),
    onAdd: vi.fn(),
    onDelete: vi.fn(),
    onCancelDelete: vi.fn(),
    onSubmit: vi.fn(),
    onSave: vi.fn(),
    saveState: "success",
    submitState: "idle",
    loading: false,
    feedback: "",
    feedbackError: false,
    descriptionEditable: true,
    dashboard: dashboard.dailyHours,
    progress: dashboard.completion,
    validation: [],
    ...overrides,
  };
  render(<TimesheetMobile {...props} />);
  return props;
}
describe("TMS mobile presentations", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 6, 1, 12));
    vi.stubGlobal("matchMedia", mobileViewport);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("labels the period fields and preserves selection callbacks and close focus", async () => {
    const props = timesheet();
    const periodTrigger = screen.getByRole("button", { name: "Choose period" });
    periodTrigger.focus();
    fireEvent.click(periodTrigger);
    const sheet = await screen.findByRole("dialog", { name: "Choose period" });
    for (const label of [copy.year, copy.month, copy.period]) {
      expect(within(sheet).getByText(label)).toBeVisible();
      expect(
        within(sheet).getByRole("combobox", { name: label })
      ).toBeEnabled();
    }
    fireEvent.click(within(sheet).getByRole("combobox", { name: copy.month }));
    const monthOption = await screen.findByRole("option", {
      name: "8",
      exact: true,
    });
    monthOption.focus();
    fireEvent.keyDown(monthOption, { key: "Enter" });
    expect(props.onMonthChange).toHaveBeenCalledExactlyOnceWith(8);
    expect(props.onSubmit).not.toHaveBeenCalled();
    fireEvent.click(within(sheet).getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Choose period" })
      ).not.toBeInTheDocument()
    );
    await waitFor(() => expect(periodTrigger).toHaveFocus());
  });

  it("edits the selected day through the original hours callback without a wide table", () => {
    const props = timesheet();
    expect(screen.queryByRole("table")).toBeNull();
    const hours = screen.getByRole("textbox", {
      name: /Internal Admin.*2026-07-01/,
    });
    fireEvent.change(hours, { target: { value: "3.5" } });
    expect(props.onHourChange).toHaveBeenCalledWith(row.id, days[0], "3.5");
    fireEvent.click(screen.getByRole("button", { name: "Next day" }));
    expect(
      screen.getByRole("textbox", { name: /Internal Admin.*2026-07-02/ })
    ).toHaveValue("0");
  });

  it("retains hour and description locks in the phone detail sheet", async () => {
    timesheet({ isHourEditable: () => false, descriptionEditable: false });
    expect(screen.getByRole("textbox", { name: /2026-07-01/ })).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: /Record details: Internal Admin/ })
    );
    const detail = await screen.findByRole("dialog", {
      name: "Internal Admin",
    });
    expect(
      within(detail).getByRole("textbox", { name: copy.description })
    ).toBeDisabled();
  });

  it("keeps row selection and explicit deletion separate from hour editing", () => {
    const props = timesheet({
      deleteMode: true,
      selectedIds: new Set([row.id]),
    });
    expect(screen.getByRole("textbox", { name: /2026-07-01/ })).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: `${copy.deleteSelectedRows} (1)` })
    );
    expect(props.onDelete).toHaveBeenCalledOnce();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it("keeps progress and daily verification reachable in the summary sheet", async () => {
    timesheet();
    fireEvent.click(screen.getByRole("button", { name: "Hours summary" }));
    const sheet = await screen.findByRole("dialog", { name: "Hours summary" });
    expect(within(sheet).getByText(copy.target)).toBeVisible();
    expect(within(sheet).getByText(/2026-07-01.*2 h/)).toBeVisible();
  });

  it("loads query cards, applies filters explicitly and retains all detail columns", async () => {
    const result: TmsTimesheetQueryResponse = {
      mode: "DETAIL",
      rows: [
        {
          jobCode: "JOB-1",
          staffNo: "001",
          staffName: "Amy",
          timesheetDate: "2026-07-01",
          rate: null,
          normal: 8,
          ot: 1,
          absent: 0,
          total: "900.00",
          clientName: "Client",
          netBudgetFee: "100",
          pic: "Partner",
          mic: "Manager",
          timesheetStatus: "SUBMITTED",
          activeStatus: "ACTIVE",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 50,
    };
    const query = vi
      .spyOn(api, "getTmsTimesheetQuery")
      .mockResolvedValue(result);
    render(
      <QueryWorkspace
        locale="en-US"
        user={user}
        renderHeader={false}
        onBack={vi.fn()}
        onSignOut={vi.fn()}
      />
    );
    const link = await screen.findByRole("link", { name: /Amy/ });
    expect(screen.queryByRole("table")).toBeNull();
    fireEvent.click(link);
    const detail = await screen.findByRole("dialog", { name: "Amy" });
    expect(within(detail).getByText(copy.netBudgetFee)).toBeVisible();
    fireEvent.click(within(detail).getByRole("button", { name: copy.cancel }));
    fireEvent.click(screen.getByRole("button", { name: "Query filters" }));
    const filters = await screen.findByRole("dialog", {
      name: "Query filters",
    });
    fireEvent.change(
      within(filters).getByRole("textbox", { name: copy.staffName }),
      { target: { value: "Amy" } }
    );
    expect(query).toHaveBeenCalledOnce();
    fireEvent.click(within(filters).getByRole("button", { name: copy.search }));
    await waitFor(() =>
      expect(query).toHaveBeenLastCalledWith(
        expect.objectContaining({ staffName: "Amy", page: 1 })
      )
    );
  });

  it("shows overview employees and daily totals in a narrow detail sheet", async () => {
    vi.spyOn(api, "getTmsOverview").mockResolvedValue({
      year: 2026,
      month: 7,
      period: "all",
      employees: [
        {
          userId: "employee",
          globalRole: "STAFF",
          name: "Amy",
          email: "amy@example.test",
          status: "SUBMITTED",
          normal: 8,
          ot: 1,
          leave: 0,
          warningCount: 1,
          errorCount: 0,
          daily: [
            {
              date: "2026-07-01",
              normal: 8,
              ot: 1,
              leave: 0,
              total: 9,
              state: "WARNING",
              isWorkday: true,
              isHoliday: false,
            },
          ],
        },
      ],
    });
    render(
      <OverviewWorkspace
        locale="en-US"
        user={{ ...user, globalRole: "HR" }}
        renderHeader={false}
        onBack={vi.fn()}
        onSignOut={vi.fn()}
      />
    );
    fireEvent.click(await screen.findByRole("link", { name: /Amy/ }));
    const sheet = await screen.findByRole("dialog", { name: "Amy" });
    expect(within(sheet).getByText("2026-07-01")).toBeVisible();
    expect(within(sheet).getByText(`${copy.total} 9 h`)).toBeVisible();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("keeps app navigation in one sheet and runs the existing workspace callback", async () => {
    const onApproval = vi.fn();
    render(
      <TmsMobileHeader
        title="Timesheet"
        locale="en-US"
        copy={tmsSettingsCopyByLocale["en-US"]}
        userName="Manager"
        userEmail={user.email}
        rank="Manager"
        actions={[
          {
            id: "approvals",
            label: "Approvals",
            icon: null,
            onClick: onApproval,
          },
        ]}
        settings={<p>Settings</p>}
        accounts={null}
        onSignOut={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: "Approvals" })).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Workspace navigation" })
    );
    fireEvent.click(await screen.findByRole("button", { name: "Approvals" }));
    await waitFor(() => expect(onApproval).toHaveBeenCalledOnce());
  });
});

describe("mobile approval navigation", () => {
  afterEach(cleanup);

  it("requires choosing a project and record before exposing review actions", () => {
    const project: TmsApprovalProject = {
      engagementId: "eng",
      engagementCode: "JOB-1",
      clientCode: "C1",
      clientName: "Client",
      pic: "Partner",
      mic: "Manager",
      status: "ACTIVE",
      pendingCount: 1,
      returnedCount: 0,
      projectCount: 1,
    };
    const record: TmsApprovalRecord = {
      id: "submission",
      ownerUserId: "amy",
      ownerName: "Amy",
      ownerEmail: "amy@example.test",
      year: 2026,
      month: 7,
      half: "FIRST_HALF",
      engagementId: "eng",
      engagementCode: "JOB-1",
      projectId: "p1",
      projectCode: "P1",
      projectName: "Audit",
      clientCode: "C1",
      clientName: "Client",
      revision: 1,
      status: "SUBMITTED",
      submittedRows: [],
      submittedAt: "2026-07-01T12:00:00Z",
      reviewedById: null,
      reviewedAt: null,
      returnReason: null,
    };
    const groups = selectApprovalGroups([record], "first", [], []);
    const approve = vi.fn();
    const onProject = vi.fn();
    render(
      <ApprovalMobile
        locale="en-US"
        projects={[project]}
        selectedProject={project}
        projectGroups={[{ id: "p1", code: "P1", name: "Audit", groups }]}
        loading={false}
        error={false}
        onRetry={vi.fn()}
        search=""
        onSearch={vi.fn()}
        pendingOnly={false}
        onPendingOnly={vi.fn()}
        onProject={onProject}
        periodControls={null}
        editing={false}
        busy={false}
        canEdit
        onEdit={vi.fn()}
        batchActions={[]}
        onApprove={approve}
        onReturn={vi.fn()}
        getCell={() => ({
          hours: 8,
          editable: false,
          unavailable: false,
          onChange: vi.fn(),
        })}
        getTotal={() => 8}
        days={days.slice(0, 2)}
        selectedIds={new Set()}
        onSelectProjectGroup={vi.fn()}
        feedback=""
        nameFilters={[]}
        onClearNameFilters={vi.fn()}
      />
    );
    expect(screen.queryByText("Amy")).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: /Client/ }));
    expect(onProject).toHaveBeenCalledWith(project);
    fireEvent.click(screen.getByRole("link", { name: /Amy/ }));
    expect(
      screen.getByText(`${copy.period}: 2026-07-01 – 2026-07-02`)
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: /Amy Normal 2026-07-01/ })
    ).toHaveAttribute("readonly");
    fireEvent.click(screen.getByRole("button", { name: copy.approve }));
    expect(approve).toHaveBeenCalledWith(groups[0]);
  });
});
