// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HoursInput } from "@/components/hours-input";
import { getTmsWorkspaceCopy, tmsWorkspaceCopy } from "@/i18n/dictionaries";
import * as tmsApi from "@/lib/api";

import { buildPeriodDays, createInitialRows } from "../lib/timesheet";
import type { Engagement, TimesheetRow } from "../lib/timesheet";
import {
  DEFAULT_TIMESHEET_BOARD_LAYOUT,
  HoursVerificationTable,
  TimesheetAddFormContent,
  TimesheetBoard,
  TimesheetWorkspace,
  boardLayoutForTypeFilter,
  buildTimesheetYearOptions,
  createDefaultTimesheetFilters,
  createInitialTimesheetWorkspaceState,
  filterTimesheetRowsByColumns,
  getTimesheetProgressSegments,
  hoursVerificationClass,
  rankEngagementMatches,
  readSavedRows,
  readSavedTimesheetFilters,
  readTimesheetBoardLayout,
  replaceRowsForPeriod,
  resizeTimesheetBoardLayout,
  rowsForPeriod,
  saveRows,
  saveTimesheetBoardLayout,
  saveTimesheetFilters,
  shouldBlockTimesheetSubmit,
  shouldConfirmTimesheetSubmit,
  shouldDisableTimesheetHours,
  timesheetBoardLayoutStorageKey,
  timesheetColumnValues,
  timesheetFiltersStorageKey,
  timesheetSubmitMessageClass,
} from "./timesheet-workspace";

function expectPresent<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected value to be present");
  }
  return value;
}

describe("hours verification color contract", () => {
  it("marks short workdays with a vivid warning edge and readable number", () => {
    expect(hoursVerificationClass({ isWorkday: true }, 6)).toContain(
      "border-b-warning-accent"
    );
    expect(hoursVerificationClass({ isWorkday: true }, 6)).toContain(
      "bg-warning-subtle text-foreground"
    );
  });

  it("keeps invalid totals distinct from warnings and normal holiday totals", () => {
    expect(hoursVerificationClass({ isWorkday: true }, 25)).toContain(
      "border-b-destructive-accent"
    );
    expect(hoursVerificationClass({ isWorkday: false }, 0)).toBe(
      "bg-success-subtle text-foreground"
    );
    expect(hoursVerificationClass({ isWorkday: true }, 8)).toBe(
      "bg-success-subtle text-foreground"
    );
  });
});

vi.mock("@/components/theme-provider", () => ({
  useTheme: () => ({
    flavor: "latte",
    accent: "lime",
    fontSize: "md",
    setFlavor: vi.fn(),
    setFontSize: vi.fn(),
  }),
}));

describe(TimesheetWorkspace, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 6, 20));
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("autosaves mobile daily edits through the existing timesheet API", async () => {
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
    const row: TimesheetRow = {
      id: "mobile-row",
      type: "Non-Chargeable",
      details: "Internal Admin",
      workType: "Normal",
      periodScope: "first",
      description: "Office",
      hoursByDate: { "2026-07-01": 1 },
      periodTotal: 1,
    };
    const month = {
      year: 2026,
      month: 7,
      rows: [row],
      periods: {
        FIRST_HALF: { status: "DRAFT", revision: 0, editable: true },
        SECOND_HALF: { status: "DRAFT", revision: 0, editable: true },
      },
      approvalLocks: [],
      persistence: "SERVER",
    } as never;
    vi.spyOn(tmsApi, "loadTimesheetMonth").mockResolvedValue(month);
    const save = vi
      .spyOn(tmsApi, "saveTimesheetDraft")
      .mockResolvedValue(month);
    saveTimesheetFilters("mobile-user", {
      year: 2026,
      month: 7,
      period: "first",
      typeFilter: "All",
    });
    render(
      <TimesheetWorkspace
        renderHeader={false}
        locale="en-US"
        user={{
          id: "mobile-user",
          name: "Mobile",
          email: "mobile@example.test",
          globalRole: "STAFF",
        }}
        onSignOut={vi.fn()}
      />
    );
    await screen.findByTestId("timesheet-mobile");
    const input = await screen.findByRole("textbox", {
      name: /Internal Admin.*2026-07-01/,
    });
    fireEvent.change(input, { target: { value: "3" } });
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        2026,
        7,
        expect.objectContaining({
          rows: expect.arrayContaining([
            expect.objectContaining({
              id: "mobile-row",
              hoursByDate: expect.objectContaining({ "2026-07-01": 3 }),
            }),
          ]),
        })
      )
    );
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows the ghost save action, reveals Save on hover, and saves manually", async () => {
    expect(
      timesheetSubmitMessageClass("Submitted Successful", false)
    ).toContain("text-success");
    expect(
      timesheetSubmitMessageClass("Submitted Successful", false)
    ).not.toContain("text-warning");

    const month = {
      year: 2026,
      month: 7,
      rows: [],
      periods: {
        FIRST_HALF: { status: "DRAFT", revision: 0, editable: true },
        SECOND_HALF: { status: "DRAFT", revision: 0, editable: true },
      },
      persistence: "SERVER",
    } as never;
    vi.spyOn(tmsApi, "loadTimesheetMonth").mockResolvedValue(month);
    const save = vi
      .spyOn(tmsApi, "saveTimesheetDraft")
      .mockResolvedValue(month);

    render(
      <TimesheetWorkspace
        onSignOut={vi.fn()}
        user={{
          id: "user-1",
          email: "partner@projectwing.local",
          name: "Partner",
          globalRole: "PARTNER",
        }}
      />
    );

    const saveState = await screen.findByRole("button", { name: "Saved" });
    expect(saveState).toHaveAttribute("data-variant", "ghost");
    expect(saveState).toHaveAttribute("data-size", "sm");
    expect(saveState).toHaveClass("h-7", "px-2", "text-xs!");
    expect(saveState).not.toHaveClass("min-w-20");
    expect(saveState.querySelector(".lucide-circle-check")).toHaveClass(
      "text-success"
    );
    expect(saveState).not.toBeDisabled();

    fireEvent.mouseEnter(saveState);
    expect(saveState).toHaveAccessibleName("Save");
    expect(saveState.querySelector(".lucide-check")).toBeInTheDocument();
    expect(
      saveState.querySelector(".lucide-circle-check")
    ).not.toBeInTheDocument();
    fireEvent.click(saveState);
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
  });

  it("debounces edits before showing Saving and auto-saving", async () => {
    const engagement = engagementFixture("ORC-2026-AUD", "Orchid annual audit");
    const row: TimesheetRow = {
      ...engagement,
      id: "autosave-row",
      periodScope: "first",
      type: "Chargeable",
      details: "Normal",
      description: "Planning",
      hoursByDate: {},
      periodTotal: 0,
    };
    const month = {
      year: 2026,
      month: 7,
      rows: [row],
      periods: {
        FIRST_HALF: { status: "DRAFT", revision: 0, editable: true },
        SECOND_HALF: { status: "DRAFT", revision: 0, editable: true },
      },
      persistence: "SERVER",
    } as never;
    let resolveSave: (value: typeof month) => void = () => {};
    const pendingSave = new Promise<typeof month>((resolve) => {
      resolveSave = resolve;
    });
    vi.spyOn(tmsApi, "loadTimesheetMonth").mockResolvedValue(month);
    const save = vi
      .spyOn(tmsApi, "saveTimesheetDraft")
      .mockReturnValue(pendingSave);
    saveTimesheetFilters("user-1", {
      year: 2026,
      month: 7,
      period: "first",
      typeFilter: "All",
    });

    render(
      <TimesheetWorkspace
        onSignOut={vi.fn()}
        user={{
          id: "user-1",
          email: "partner@projectwing.local",
          name: "Partner",
          globalRole: "PARTNER",
        }}
      />
    );

    const hoursFields = await screen.findAllByRole("textbox", {
      name: "Hours",
    });
    const [firstHoursField] = hoursFields;
    const hours = expectPresent(firstHoursField);
    await expect(
      screen.findByRole("button", { name: "Saved" })
    ).resolves.toBeEnabled();
    fireEvent.change(hours, { target: { value: "2" } });
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Saved" })).toBeEnabled();

    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "Saving" })).toBeDisabled();
    act(() => {
      resolveSave(month);
    });
    await expect(
      screen.findByRole("button", { name: "Saved" })
    ).resolves.toBeEnabled();
  });

  it("shows the compact account actions without a search field", async () => {
    const onSignOut = vi.fn();
    const listDevelopmentAccounts = vi
      .spyOn(tmsApi, "listDevelopmentAccounts")
      .mockResolvedValue([]);

    render(
      <TimesheetWorkspace
        onSignOut={onSignOut}
        user={{
          id: "user-1",
          email: "partner@projectwing.local",
          name: "Partner",
          globalRole: "PARTNER",
        }}
      />
    );

    const accountTrigger = screen.getByRole("button", { name: "账号菜单" });
    fireEvent.pointerEnter(accountTrigger);

    const accountCard = screen.getByTestId("tms-account-card");
    expect(
      within(accountCard).getByText("Partner", {
        selector: ".project-wing-top-bar-account-name > div:first-child",
      })
    ).toBeInTheDocument();
    expect(
      within(accountCard).getByText("partner@projectwing.local")
    ).toBeInTheDocument();
    const signOut = within(accountCard).getByRole("button", {
      name: "退出登录",
    });
    expect(signOut).toHaveClass(
      "project-wing-top-bar-account-action--destructive"
    );
    await waitFor(() => expect(listDevelopmentAccounts).toHaveBeenCalledOnce());
    await Promise.resolve();
    expect(
      within(accountCard).queryByRole("button", { name: "切换账号" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();

    fireEvent.click(signOut);
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it("does not show project options before a user enters a search query", () => {
    const directory = [
      engagementFixture("ORC-2026-AUD", "Orchid annual audit"),
    ];

    expect(rankEngagementMatches(directory, "")).toStrictEqual([]);
  });

  it("prioritizes engagement-code matches and excludes unrelated results", () => {
    const codeMatch = engagementFixture(
      "ORC-2026-AUD",
      "Annual statutory audit"
    );
    const nameMatch = engagementFixture(
      "WKS-2026-AUD",
      "ORC internal controls review"
    );
    nameMatch.clientName = "ORC internal controls review";
    const unrelated = engagementFixture("HBR-2026-TAX", "Harbour tax return");

    expect(
      rankEngagementMatches([nameMatch, unrelated, codeMatch], "orc")
    ).toStrictEqual([codeMatch, nameMatch]);
  });

  it("matches previous codes and limits the autocomplete result set", () => {
    const directory = Array.from({ length: 10 }, (_, index) => ({
      ...engagementFixture(`CLIENT-2026-${index}`, `Engagement ${index}`),
      codeAliases: [`LEGACY-${index}`],
    }));
    const results = rankEngagementMatches(directory, "legacy");

    expect(results).toHaveLength(8);
    expect(results[0]?.codeAliases).toContain("LEGACY-0");
  });

  it("distinguishes EMP projects that belong to the same CMP business", () => {
    const groupProject = {
      ...engagementFixture("ORC-2026-AUD"),
      projectId: "project-group",
      projectCode: "ORC-2026-AUD-GROUP",
      projectName: "Group reporting",
    };
    const hkProject = {
      ...engagementFixture("ORC-2026-AUD"),
      projectId: "project-hk",
      projectCode: "ORC-2026-AUD-HK",
      projectName: "Hong Kong component",
    };

    expect(
      rankEngagementMatches([groupProject, hkProject], "AUD-HK")
    ).toStrictEqual([hkProject]);
  });

  it("disables hours only when the date or engagement is unavailable", () => {
    expect(shouldDisableTimesheetHours(true, false)).toBeTruthy();
    expect(shouldDisableTimesheetHours(true, true)).toBeFalsy();
    expect(shouldDisableTimesheetHours(false, true)).toBeTruthy();
  });

  it("shows a clear message when a Normal cell exceeds 8 hours", async () => {
    const engagement = engagementFixture("ORC-2026-AUD", "Orchid annual audit");
    const row: TimesheetRow = {
      ...engagement,
      id: "normal-row",
      periodScope: "first",
      type: "Chargeable",
      workType: "Normal",
      details: "Normal",
      description: "",
      hoursByDate: {},
      periodTotal: 0,
    };
    const month = {
      year: 2026,
      month: 7,
      rows: [row],
      periods: {
        FIRST_HALF: { status: "DRAFT", revision: 0, editable: true },
        SECOND_HALF: { status: "DRAFT", revision: 0, editable: true },
      },
      persistence: "SERVER",
    } as never;
    const load = vi
      .spyOn(tmsApi, "loadTimesheetMonth")
      .mockResolvedValue(month);
    vi.spyOn(tmsApi, "saveTimesheetDraft").mockResolvedValue(month);
    saveTimesheetFilters("user-1", {
      year: 2026,
      month: 7,
      period: "first",
      typeFilter: "All",
    });

    render(
      <TimesheetWorkspace
        onSignOut={() => {}}
        user={{
          id: "user-1",
          email: "staff@projectwing.local",
          name: "Staff",
          globalRole: "STAFF",
        }}
      />
    );

    await waitFor(() => expect(load).toHaveBeenCalledWith(2026, 7));
    fireEvent.change(
      expectPresent(screen.getAllByRole("textbox", { name: "Hours" })[0]),
      {
        target: { value: "9" },
      }
    );

    await expect(
      screen.findByText("Normal 工时每天不得超过 8 小时（2026-07-01）")
    ).resolves.toBeVisible();
  });

  it("reverts draft hours above the effective work type maximum", () => {
    const onChange = vi.fn();

    render(
      <div>
        <HoursInput
          aria-label="Normal hours"
          max={8}
          onChange={onChange}
          value={0}
        />
        <HoursInput
          aria-label="Leave hours"
          max={8}
          onChange={onChange}
          value={0}
        />
        <HoursInput
          aria-label="OT hours"
          max={24}
          onChange={onChange}
          value={0}
        />
        <HoursInput
          aria-label="Absent hours"
          max={24}
          onChange={onChange}
          value={0}
        />
      </div>
    );

    const normal = screen.getByRole("textbox", { name: "Normal hours" });
    const leave = screen.getByRole("textbox", { name: "Leave hours" });
    const ot = screen.getByRole("textbox", { name: "OT hours" });
    const absent = screen.getByRole("textbox", { name: "Absent hours" });

    fireEvent.change(normal, { target: { value: "9" } });
    fireEvent.blur(normal);
    expect(normal).toHaveValue("0");

    fireEvent.change(leave, { target: { value: "9" } });
    fireEvent.blur(leave);
    expect(leave).toHaveValue("0");

    fireEvent.change(normal, { target: { value: "8" } });
    fireEvent.blur(normal);
    expect(normal).toHaveValue("8.0");

    fireEvent.change(ot, { target: { value: "9" } });
    fireEvent.blur(ot);
    expect(ot).toHaveValue("9.0");

    fireEvent.change(absent, { target: { value: "9" } });
    fireEvent.blur(absent);
    expect(absent).toHaveValue("9.0");
  });

  it("passes the effective work type maximum to each timesheet row", () => {
    const base = {
      ...engagementFixture("ORC-2026-AUD", "Orchid annual audit"),
      periodScope: "first" as const,
      description: "",
      hoursByDate: {},
      periodTotal: 0,
    };
    const rows: TimesheetRow[] = [
      {
        ...base,
        id: "normal-max",
        type: "Chargeable",
        workType: "Normal",
        details: "Normal",
      },
      {
        ...base,
        id: "ot-max",
        type: "Chargeable",
        workType: "OT",
        details: "OT",
      },
      {
        ...base,
        id: "absent-max",
        type: "Chargeable",
        workType: "Absent",
        details: "Absent",
      },
    ];
    const leaveRow: TimesheetRow = {
      id: "leave-max",
      periodScope: "first",
      type: "Leave",
      details: "Annual Leave",
      description: "",
      hoursByDate: {},
      periodTotal: 0,
    };
    const boardProps = {
      days: [expectPresent(buildPeriodDays(2026, 7, "first")[0])],
      deleteMode: false,
      selectedIds: new Set<string>(),
      onDescriptionChange: () => {},
      onHourChange: () => {},
      onToggleSelected: () => {},
    };

    render(
      <>
        <TimesheetBoard {...boardProps} type="Chargeable" rows={rows} />
        <TimesheetBoard {...boardProps} type="Leave" rows={[leaveRow]} />
      </>
    );

    const rowHoursInput = (rowId: string) =>
      document.querySelector<HTMLInputElement>(
        `tr[data-timesheet-row-id="${rowId}"] input[aria-label="Hours"]`
      );

    expect(rowHoursInput("normal-max")).toHaveAttribute("max", "8");
    expect(rowHoursInput("leave-max")).toHaveAttribute("max", "8");
    expect(rowHoursInput("ot-max")).toHaveAttribute("max", "24");
    expect(rowHoursInput("absent-max")).toHaveAttribute("max", "24");
  });

  it("keeps weekend hour cells editable", () => {
    const days = buildPeriodDays(2026, 7, "first");
    const weekendIndex = days.findIndex((day) => day.date === "2026-07-04");
    const row: TimesheetRow = {
      ...engagementFixture("ORC-2026-AUD", "Orchid annual audit"),
      id: "charge-1",
      periodScope: "first",
      type: "Chargeable",
      workType: "Normal",
      details: "Normal",
      description: "",
      hoursByDate: {},
      periodTotal: 0,
    };

    render(
      <TimesheetBoard
        days={days}
        deleteMode={false}
        selectedIds={new Set()}
        onDescriptionChange={() => {}}
        onHourChange={() => {}}
        onToggleSelected={() => {}}
        type="Chargeable"
        rows={[row]}
      />
    );

    expect(screen.getAllByLabelText("Hours")[weekendIndex]).toBeEnabled();
  });

  it("locks approved non-zero Chargeable hours but keeps zero hours editable", () => {
    const row: TimesheetRow = {
      ...engagementFixture("ORC-2026-AUD", "Orchid annual audit"),
      id: "charge-approved",
      periodScope: "first",
      type: "Chargeable",
      details: "Normal",
      description: "",
      hoursByDate: { "2026-07-01": 4, "2026-07-02": 0 },
      periodTotal: 4,
    };

    render(
      <TimesheetBoard
        days={buildPeriodDays(2026, 7, "first")}
        deleteMode={false}
        selectedIds={new Set()}
        onDescriptionChange={() => {}}
        onHourChange={() => {}}
        onToggleSelected={() => {}}
        type="Chargeable"
        rows={[row]}
        isHourEditable={(currentRow, date) =>
          (currentRow.hoursByDate[date] ?? 0) === 0
        }
      />
    );

    const inputs = screen.getAllByLabelText("Hours");
    expect(inputs[0]).toBeDisabled();
    expect(inputs[1]).toBeEnabled();
  });

  it("distinguishes unchanged and approver-modified approved hours", () => {
    const row: TimesheetRow = {
      ...engagementFixture("ORC-2026-AUD", "Orchid annual audit"),
      id: "charge-approved-colors",
      periodScope: "first",
      type: "Chargeable",
      details: "Normal",
      description: "",
      hoursByDate: { "2026-07-01": 8, "2026-07-02": 6 },
      periodTotal: 14,
    };

    render(
      <TimesheetBoard
        days={buildPeriodDays(2026, 7, "first")}
        deleteMode={false}
        selectedIds={new Set()}
        onDescriptionChange={() => {}}
        onHourChange={() => {}}
        onToggleSelected={() => {}}
        type="Chargeable"
        rows={[row]}
        isHourEditable={() => false}
        getApprovalCellState={(_currentRow, date) =>
          date === "2026-07-01"
            ? "approved"
            : date === "2026-07-02"
              ? "modified"
              : null
        }
      />
    );

    const inputs = screen.getAllByLabelText("Hours");
    expect(inputs[0]).toHaveClass("disabled:text-success");
    expect(inputs[1]).toHaveClass("disabled:text-info");
  });

  it("marks the existing duplicate Chargeable row for highlighting", () => {
    const row: TimesheetRow = {
      ...engagementFixture("ORC-2026-AUD", "Orchid annual audit"),
      id: "charge-1",
      periodScope: "first",
      type: "Chargeable",
      details: "Normal",
      description: "Audit planning",
      hoursByDate: {},
      periodTotal: 0,
    };
    const html = renderToString(
      <TimesheetBoard
        days={buildPeriodDays(2026, 7, "first")}
        deleteMode={false}
        highlightedRowId="charge-1"
        selectedIds={new Set()}
        onDescriptionChange={() => {}}
        onHourChange={() => {}}
        onToggleSelected={() => {}}
        type="Chargeable"
        rows={[row]}
      />
    );

    expect(html).toContain('data-duplicate-highlight="true"');
    expect(html).toContain("ring-primary/40");
  });

  it("shows the generated pending TMS code and opens EMP linking from the row", () => {
    const onLinkRow = vi.fn();
    const row: TimesheetRow = {
      ...engagementFixture("DUMMY-TMS-000007"),
      id: "pending-tms-row",
      periodScope: "first",
      type: "Chargeable",
      source: "TMS_PENDING",
      projectId: null,
      engagementId: "",
      engagementCode: "DUMMY-TMS-000007",
      workType: "Normal",
      details: "Normal",
      description: "Dummy",
      hoursByDate: {},
      periodTotal: 0,
    };

    render(
      <TimesheetBoard
        days={buildPeriodDays(2026, 7, "first")}
        deleteMode={false}
        selectedIds={new Set()}
        onDescriptionChange={() => {}}
        onHourChange={() => {}}
        onToggleSelected={() => {}}
        onLinkRow={onLinkRow}
        type="Chargeable"
        rows={[row]}
      />
    );

    expect(screen.getByText("DUMMY-TMS-000007")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Link EMP project pending-tms-row" })
    );
    expect(onLinkRow).toHaveBeenCalledWith("pending-tms-row");
  });

  it("uses red feedback for every cell in a selected Chargeable row", () => {
    const row: TimesheetRow = {
      ...engagementFixture("ORC-2026-AUD", "Orchid annual audit"),
      id: "charge-1",
      periodScope: "first",
      type: "Chargeable",
      details: "Normal",
      description: "Audit planning",
      hoursByDate: {},
      periodTotal: 0,
    };
    const { container } = render(
      <TimesheetBoard
        days={buildPeriodDays(2026, 7, "first")}
        deleteMode
        selectedIds={new Set([row.id])}
        onDescriptionChange={() => {}}
        onHourChange={() => {}}
        onToggleSelected={() => {}}
        type="Chargeable"
        rows={[row]}
      />
    );
    const selectedRows = container.querySelectorAll(
      '[data-timesheet-row-id="charge-1"]'
    );
    expect(selectedRows).toHaveLength(2);
    selectedRows.forEach((selectedRow) => {
      expect(selectedRow).toHaveClass("[&>td]:bg-destructive/10");
      expect(selectedRow).not.toHaveClass("hover:[&>td]:bg-destructive/5");
    });
  });

  it("uses red hover feedback for an unselected delete control", () => {
    const row: TimesheetRow = {
      ...engagementFixture("ORC-2026-AUD", "Orchid annual audit"),
      id: "charge-1",
      periodScope: "first",
      type: "Chargeable",
      details: "Normal",
      description: "Audit planning",
      hoursByDate: {},
      periodTotal: 0,
    };
    const { container } = render(
      <TimesheetBoard
        days={buildPeriodDays(2026, 7, "first")}
        deleteMode
        selectedIds={new Set()}
        onDescriptionChange={() => {}}
        onHourChange={() => {}}
        onToggleSelected={() => {}}
        type="Chargeable"
        rows={[row]}
      />
    );

    for (const rowElement of container.querySelectorAll(
      '[data-timesheet-row-id="charge-1"]'
    )) {
      expect(rowElement).toHaveClass("hover:[&>td]:bg-destructive/5");
    }
  });

  it("places incomplete date badges directly inside the Open detail row", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 20));

    const html = renderToString(
      <TimesheetWorkspace
        onSignOut={() => {}}
        user={{
          id: "user-1",
          email: "partner@projectwing.local",
          name: "Partner",
          globalRole: "PARTNER",
        }}
      />
    );

    vi.useRealTimers();

    expect(
      html.match(/data-testid="dashboard-detail-separator"/g)
    ).toHaveLength(2);
    expect(html).toMatch(
      /data-testid="timesheet-progress-percent"[^>]*>0(?:<!-- -->)?%<\/span>/
    );
  });

  it("places four motion actions in the original order", () => {
    const html = renderToString(
      <TimesheetWorkspace
        onSignOut={() => {}}
        user={{
          id: "user-1",
          email: "partner@projectwing.local",
          name: "Partner",
          globalRole: "PARTNER",
        }}
      />
    );

    expect(html).not.toContain("Engagement hours matrix");
    expect(html).toContain('data-testid="timesheet-workspace-actions"');
    expect(html).toContain('data-action-id="add-row"');
    expect(html).toContain('data-action-id="delete-rows"');
    expect(html).toContain('data-stateful-motion-button="true"');
    expect(html).toContain('data-action-id="submit-timesheet"');
    expect(html).toContain('data-testid="timesheet-save-state"');
    expect(html).toContain('data-testid="timesheet-period-filter-group"');
    expect(html).toContain('data-testid="timesheet-type-filter-group"');
    expect(html).toContain('data-testid="timesheet-filter-controls"');
    expect(html).toContain("Timesheet period filters");
    expect(html).toContain("Timesheet type filter");
    expect(html).toContain(">All</span>");
    expect(html).not.toContain("All types");
    expect(html).toContain('aria-label="Add row"');
    expect(html).toContain('aria-label="Delete rows"');
    expect(html).toContain('aria-label="Submit"');
    expect(html.match(/cursor-pointer/g)).toHaveLength(8);
    expect(html.indexOf('data-action-id="save-timesheet"')).toBeLessThan(
      html.indexOf('data-action-id="add-row"')
    );
    expect(html).toMatch(/data-size="icon"[^>]*data-action-id="add-row"/);
    expect(html).toMatch(/data-size="icon"[^>]*data-action-id="delete-rows"/);
    expect(
      html.match(/data-variant="secondary"/g)?.length
    ).toBeGreaterThanOrEqual(3);
    expect(html).toMatch(
      /data-size="sm" data-variant="secondary"[^>]*data-action-id="submit-timesheet"/
    );
    expect(html.indexOf('data-action-id="add-row"')).toBeLessThan(
      html.indexOf('data-action-id="delete-rows"')
    );
    expect(html.indexOf('data-action-id="delete-rows"')).toBeLessThan(
      html.indexOf('data-action-id="submit-timesheet"')
    );
  });

  it("keeps official delete styling while selecting and collapses after deletion", async () => {
    const engagement = engagementFixture("ORC-2026-AUD", "Orchid annual audit");
    const row: TimesheetRow = {
      ...engagement,
      id: "charge-1",
      periodScope: "first",
      type: "Chargeable",
      details: "Normal",
      description: "Planning",
      hoursByDate: {},
      periodTotal: 0,
    };
    const month = {
      year: 2026,
      month: 7,
      rows: [row],
      periods: {
        FIRST_HALF: { status: "DRAFT", revision: 0, editable: true },
        SECOND_HALF: { status: "DRAFT", revision: 0, editable: true },
      },
      persistence: "SERVER",
    } as never;
    const load = vi
      .spyOn(tmsApi, "loadTimesheetMonth")
      .mockResolvedValue(month);
    vi.spyOn(tmsApi, "saveTimesheetDraft").mockResolvedValue(month);
    saveTimesheetFilters("user-1", {
      year: 2026,
      month: 7,
      period: "first",
      typeFilter: "All",
    });

    const { container } = render(
      <TimesheetWorkspace
        onSignOut={() => {}}
        user={{
          id: "user-1",
          email: "partner@projectwing.local",
          name: "Partner",
          globalRole: "PARTNER",
        }}
      />
    );

    await waitFor(() => expect(load).toHaveBeenCalledWith(2026, 7));
    await waitFor(() =>
      expect(
        container.querySelectorAll('[data-timesheet-row-id="charge-1"]')
      ).toHaveLength(2)
    );

    const deleteRows = screen.getByRole("button", { name: "Delete rows" });
    fireEvent.click(deleteRows);
    fireEvent.pointerDown(
      expectPresent(screen.getAllByRole("textbox", { name: "Hours" })[0])
    );
    fireEvent.pointerDown(
      screen.getByLabelText("Chargeable horizontal scroll")
    );
    expect(deleteRows.getAttribute("aria-pressed")).toBe("true");
    expect(
      screen.getByRole("button", { name: "Select row charge-1" })
    ).toBeInTheDocument();

    fireEvent.pointerDown(container);
    expect(deleteRows.getAttribute("aria-pressed")).toBe("false");
    expect(
      screen.queryByRole("button", { name: "Select row charge-1" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete rows" }));
    const cancelDelete = screen.getByRole("button", {
      name: "Delete selected rows",
    });
    cancelDelete.focus();
    fireEvent.click(cancelDelete);
    expect(deleteRows.getAttribute("aria-pressed")).toBe("false");
    expect(
      screen.queryByRole("button", { name: "Select row charge-1" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete rows" }));

    fireEvent.click(
      screen.getByRole("button", { name: "Select row charge-1" })
    );
    const deleteSelected = screen.getByRole("button", {
      name: "Delete selected rows",
    });
    expect(deleteSelected).toHaveClass(
      "border",
      "border-border",
      "bg-card",
      "rounded-md"
    );

    fireEvent.click(deleteSelected);
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Select row charge-1" })
      ).not.toBeInTheDocument()
    );
    expect(deleteRows.getAttribute("aria-pressed")).toBe("false");
  });

  it("freezes the engagement columns before the date columns", () => {
    const html = renderToString(
      <TimesheetWorkspace
        onSignOut={() => {}}
        user={{
          id: "user-1",
          email: "partner@projectwing.local",
          name: "Partner",
          globalRole: "PARTNER",
        }}
      />
    );

    expect(html).toContain("timesheet-frozen-pane");
    const frozenPane = html.match(
      /<div class="timesheet-frozen-pane[^"]*">([\s\S]*?)<\/div><div class="timesheet-date-scroll/
    )?.[1];
    expect(frozenPane).not.toContain("Client Code");
    expect(frozenPane).toContain("Type");
    expect(frozenPane).not.toContain("Description");
  });

  it("scopes the horizontal scrollbar to the date columns", () => {
    const html = renderToString(
      <TimesheetWorkspace
        onSignOut={() => {}}
        user={{
          id: "user-1",
          email: "partner@projectwing.local",
          name: "Partner",
          globalRole: "PARTNER",
        }}
      />
    );

    expect(html).toContain("timesheet-date-scroll");
    expect(html).not.toContain("--timesheet-scrollbar-offset");
  });

  it("keeps the Add fields in a stable order and disables unavailable Chargeable fields", () => {
    const props = {
      entryCode: "",
      entryDescription: "",
      entryDetails: "" as const,
      entryWorkType: "" as const,
      entryError: "",
      engagementDirectory: [] as Engagement[],
      engagementDirectoryLoading: false,
      isSubmitting: false,
      matchedEngagement: undefined,
      onCancel: () => {},
      onEngagementSelect: () => {},
      onEntryCodeChange: () => {},
      onEntryDescriptionChange: () => {},
      onEntryDetailsChange: () => {},
      onEntryWorkTypeChange: () => {},
      onEntryTypeChange: () => {},
    };
    const unselected = renderToString(
      <TimesheetAddFormContent {...props} entryType="" />
    );
    const chargeable = renderToString(
      <TimesheetAddFormContent
        {...props}
        entryType="Chargeable"
        entryWorkType="Normal"
      />
    );
    const nonChargeable = renderToString(
      <TimesheetAddFormContent
        {...props}
        entryType="Non-Chargeable"
        entryWorkType="Normal"
      />
    );
    const nonChargeableOt = renderToString(
      <TimesheetAddFormContent
        {...props}
        entryType="Non-Chargeable"
        entryWorkType="OT"
      />
    );
    const orderedLabels = [
      ">Category<",
      ">Type<",
      ">Details<",
      ">Description<",
      ">EMP Project<",
    ];
    for (let index = 1; index < orderedLabels.length; index += 1) {
      expect(chargeable.indexOf(orderedLabels[index - 1])).toBeLessThan(
        chargeable.indexOf(orderedLabels[index])
      );
    }
    expect(chargeable).toContain("Matching EMP projects");
    expect(chargeable).toContain("z-50");
    expect(chargeable).toContain("overflow-y-auto");
    expect(chargeable).toContain("Normal");
    expect(chargeable).not.toContain("Absent");
    expect(chargeable).toContain('data-chargeable-details="disabled"');
    expect(chargeable).not.toContain("Admin");
    expect(chargeable).toContain('data-chargeable-fields="enabled"');
    expect(nonChargeable).toContain("EMP Project");
    expect(nonChargeable).toContain("Normal");
    expect(nonChargeableOt).toContain("OT");
    expect(nonChargeable).toContain("Admin");
    expect(nonChargeable).not.toContain("Business context");
    expect(nonChargeable).toContain('data-chargeable-fields="disabled"');
    expect(unselected).toContain(">Category<");
    expect(unselected).toContain(">Type<");
    expect(unselected).toContain(">Details<");
    expect(unselected).toContain(">Description<");
    expect(unselected).toContain('data-chargeable-fields="disabled"');
    expect(unselected).toMatch(
      /data-chargeable-fields="disabled"[^>]*class="([^"]*)"/
    );
  });

  it("allows a Chargeable row with no code to be added as pending", () => {
    render(
      <TimesheetAddFormContent
        entryCode=""
        entryDescription="Unassigned fieldwork"
        entryDetails=""
        entryWorkType="Normal"
        entryError=""
        entryType="Chargeable"
        engagementDirectory={[]}
        engagementDirectoryLoading={false}
        isSubmitting={false}
        matchedEngagement={undefined}
        onCancel={() => {}}
        onEngagementSelect={() => {}}
        onEntryCodeChange={() => {}}
        onEntryDescriptionChange={() => {}}
        onEntryDetailsChange={() => {}}
        onEntryWorkTypeChange={() => {}}
        onEntryTypeChange={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
  });

  it("shows EMP project matches as a project table and merges the selected project context", () => {
    const groupProject: Engagement = {
      ...engagementFixture("ORC-2026-AUD"),
      projectId: "project-group",
      projectCode: "ORC-2026-AUD-GROUP",
      projectName: "Group reporting",
      clientName: "Orchid Technology Limited",
      clientCode: "C-ORC-2026",
      pic: "Jony Ma",
      mic: "Eden Chan",
    };
    const componentProject: Engagement = {
      ...groupProject,
      projectId: "project-hk",
      projectCode: "ORC-2026-AUD-HK",
      projectName: "Hong Kong component",
    };
    const onEngagementSelect = vi.fn();
    const props = {
      entryDescription: "",
      entryDetails: "" as const,
      entryWorkType: "Normal" as const,
      entryError: "",
      entryType: "Chargeable" as const,
      engagementDirectory: [groupProject, componentProject],
      engagementDirectoryLoading: false,
      isSubmitting: false,
      onCancel: () => {},
      onEngagementSelect,
      onEntryCodeChange: () => {},
      onEntryDescriptionChange: () => {},
      onEntryDetailsChange: () => {},
      onEntryWorkTypeChange: () => {},
      onEntryTypeChange: () => {},
    };

    const { rerender } = render(
      <TimesheetAddFormContent
        {...props}
        entryCode="ORC"
        matchedEngagement={undefined}
      />
    );

    const matches = screen.getByRole("table", {
      name: "Matching EMP projects",
    });
    for (const heading of [
      "EMP Project Code",
      "Project Name",
      "Client Name",
      "PIC",
      "MIC",
    ]) {
      expect(
        within(matches).getByRole("columnheader", { name: heading })
      ).toBeVisible();
    }
    fireEvent.click(
      within(matches).getByRole("button", { name: "ORC-2026-AUD-HK" })
    );
    expect(onEngagementSelect).toHaveBeenCalledWith(componentProject);

    rerender(
      <TimesheetAddFormContent
        {...props}
        entryCode="ORC-2026-AUD-GROUP"
        matchedEngagement={groupProject}
      />
    );

    const summary = screen.getByRole("region", {
      name: "Selected EMP project: ORC-2026-AUD-GROUP",
    });
    expect(summary).toHaveTextContent("Group reporting");
    expect(summary).toHaveTextContent("Business context ORC-2026-AUD");
    expect(summary).toHaveTextContent("Orchid Technology Limited");
    expect(summary).toHaveTextContent("C-ORC-2026");
    expect(summary).toHaveTextContent("Jony Ma");
    expect(summary).toHaveTextContent("Eden Chan");
    expect(screen.queryByText("Auto matched client")).not.toBeInTheDocument();
  });

  it("localizes selected Add field values in the trigger", () => {
    const html = renderToString(
      <TimesheetAddFormContent
        entryCode=""
        entryDescription=""
        entryDetails="Internal Admin"
        entryWorkType="OT"
        entryError=""
        entryType="Non-Chargeable"
        engagementDirectory={[]}
        engagementDirectoryLoading={false}
        isSubmitting={false}
        matchedEngagement={undefined}
        onCancel={() => {}}
        onEngagementSelect={() => {}}
        onEntryCodeChange={() => {}}
        onEntryDescriptionChange={() => {}}
        onEntryDetailsChange={() => {}}
        onEntryWorkTypeChange={() => {}}
        onEntryTypeChange={() => {}}
        copy={getTmsWorkspaceCopy("zh-CN")}
        locale="zh-CN"
      />
    );

    expect(html).toContain(">不可收费<");
    expect(html).toContain(">加班<");
    expect(html).toContain(">内部行政<");
    expect(html).not.toContain(">Non-Chargeable<");
    expect(html).not.toContain(">Internal Admin<");
  });

  it("uses a single-line Description input and omits Date and Hours", () => {
    const html = renderToString(
      <TimesheetAddFormContent
        entryCode=""
        entryDescription="Audit follow-up"
        entryDetails=""
        entryWorkType=""
        entryError=""
        entryType="Leave"
        engagementDirectory={[]}
        engagementDirectoryLoading={false}
        isSubmitting={false}
        matchedEngagement={undefined}
        onCancel={() => {}}
        onEngagementSelect={() => {}}
        onEntryCodeChange={() => {}}
        onEntryDescriptionChange={() => {}}
        onEntryDetailsChange={() => {}}
        onEntryWorkTypeChange={() => {}}
        onEntryTypeChange={() => {}}
      />
    );

    expect(html).not.toContain(">Date<");
    expect(html).not.toContain(">Hours<");
    expect(html).toContain(">Description<");
    expect(html).toContain('aria-label="Description"');
    expect(html).toContain('value="Audit follow-up"');
    expect(html).not.toContain("textarea");
    expect(html).toContain("Sick Leave");
    expect(html).toContain("No Pay Leave");
  });

  it("renders category-specific fixed columns and Description before Total", () => {
    const days = buildPeriodDays(2026, 7, "first");
    const chargeableRow: TimesheetRow = {
      ...engagementFixture("ORC-2026-AUD", "Orchid annual audit"),
      pic: "Jony Ma",
      mic: "Morgan Chen",
      id: "charge-1",
      periodScope: "first",
      type: "Chargeable",
      details: "Normal",
      description: "Audit planning",
      hoursByDate: {},
      periodTotal: 0,
    };
    const leaveRow: TimesheetRow = {
      id: "leave-1",
      periodScope: "first",
      type: "Leave",
      details: "Annual Leave",
      description: "",
      hoursByDate: {},
      periodTotal: 0,
    };
    const nonChargeableRow: TimesheetRow = {
      id: "non-chargeable-1",
      periodScope: "first",
      type: "Non-Chargeable",
      details: "Internal Admin",
      description: "",
      hoursByDate: {},
      periodTotal: 0,
    };
    const props = {
      days,
      deleteMode: false,
      selectedIds: new Set<string>(),
      onDescriptionChange: () => {},
      onHourChange: () => {},
      onToggleSelected: () => {},
    };
    const chargeable = renderToString(
      <TimesheetBoard {...props} type="Chargeable" rows={[chargeableRow]} />
    );
    const leave = renderToString(
      <TimesheetBoard {...props} type="Leave" rows={[leaveRow]} />
    );
    const nonChargeable = renderToString(
      <TimesheetBoard
        {...props}
        type="Non-Chargeable"
        rows={[nonChargeableRow]}
      />
    );
    const frozenPane = (html: string) =>
      html.match(
        /<div class="timesheet-frozen-pane[^"]*">([\s\S]*?)<\/div><div class="timesheet-date-scroll/
      )?.[1] ?? "";
    const chargeableFrozenPane = frozenPane(chargeable);
    const chargeableHeaderCells = Array.from(
      chargeableFrozenPane.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g),
      ([, content]) => content
    );

    for (const label of ["EMP Project Code", "Client Name", "Type"]) {
      expect(chargeableFrozenPane).toContain(label);
    }
    expect(chargeableHeaderCells).toHaveLength(3);
    for (const label of ["EMP Project Code", "Client Name", "Type"]) {
      expect(chargeable).not.toContain(`class="truncate">${label}</span>`);
    }
    expect(chargeable).toMatch(/w-\[144px\][^"]*text-center/);
    expect(chargeable).toMatch(/w-\[132px\][^"]*text-center[^"]*font-medium/);
    expect(chargeable).toMatch(/w-\[172px\][^"]*text-center/);
    for (const board of [nonChargeable, leave]) {
      expect(board).toMatch(/w-\[144px\][^"]*text-center/);
      expect(board).toMatch(/w-\[304px\][^"]*text-center/);
    }
    expect(leave.indexOf("timesheet-date-scroll")).toBeLessThan(
      leave.indexOf(">Description<")
    );
    expect(chargeable.indexOf("timesheet-date-scroll")).toBeLessThan(
      chargeable.indexOf(">Description<")
    );
    expect(chargeable).toMatch(
      /data-timesheet-vertical-scroll[^>]*class="[^"]*w-full[^"]*min-w-0[^"]*overflow-x-hidden[^"]*overflow-y-auto[^"]*"/
    );
    expect(
      chargeable.match(
        /data-timesheet-header-height="32"[^>]*class="h-8 border-b border-border"/g
      )
    ).toHaveLength(2);
    expect(
      chargeable.match(/data-timesheet-row-height="28"[^>]*class="[^"]*h-7/g)
    ).toHaveLength(1);
    expect(chargeable).toMatch(
      /data-timesheet-row-height="28"[^>]*data-timesheet-row-adjustment="0.6667"[^>]*class="[^"]*h-\[calc\(1\.75rem\+0\.6667px\)\]/
    );
    expect(chargeable).toMatch(
      /class="timesheet-frozen-pane[^"]*border-r border-border/
    );
    expect(chargeable.indexOf("timesheet-frozen-pane")).toBeGreaterThan(
      chargeable.indexOf("data-timesheet-vertical-scroll")
    );
    expect(chargeable.indexOf("timesheet-date-scroll")).toBeGreaterThan(
      chargeable.indexOf("timesheet-frozen-pane")
    );
    expect(chargeable.indexOf("data-timesheet-vertical-scroll")).toBeLessThan(
      chargeable.indexOf("data-timesheet-horizontal-rail")
    );
    expect(chargeable.indexOf(">15<")).toBeLessThan(
      chargeable.indexOf(">Description<")
    );
    expect(chargeable.indexOf(">Description<")).toBeLessThan(
      chargeable.indexOf(">Total<")
    );
  });

  it("distinguishes Normal, OT, and Absent Type pills", () => {
    const base = {
      ...engagementFixture("ORC-2026-AUD", "Orchid annual audit"),
      periodScope: "first" as const,
      type: "Chargeable" as const,
      description: "",
      hoursByDate: {},
      periodTotal: 0,
    };
    const rows: TimesheetRow[] = [
      { ...base, id: "normal", details: "Normal" },
      { ...base, id: "ot", details: "OT" },
      { ...base, id: "absent", details: "Absent" },
    ];
    const html = renderToString(
      <TimesheetBoard
        days={buildPeriodDays(2026, 7, "first")}
        deleteMode={false}
        selectedIds={new Set()}
        onDescriptionChange={() => {}}
        onHourChange={() => {}}
        onToggleSelected={() => {}}
        type="Chargeable"
        rows={rows}
      />
    );

    expect(html).toMatch(
      /data-timesheet-detail="Normal"[^>]*class="[^"]*bg-primary\/10/
    );
    expect(html).toMatch(
      /data-timesheet-detail="OT"[^>]*class="[^"]*bg-primary(?:\s|")/
    );
    expect(html).toMatch(
      /data-timesheet-detail="Absent"[^>]*class="[^"]*bg-warning-subtle/
    );
    expect(html).toMatch(
      /data-timesheet-detail="Absent"[^>]*class="[^"]*border-warning-accent/
    );
    expect(html.match(/data-timesheet-detail="Normal"/g)).toHaveLength(1);
    expect(html.match(/data-timesheet-detail="OT"/g)).toHaveLength(1);
    expect(html.match(/data-timesheet-detail="Absent"/g)).toHaveLength(1);
    expect(html).not.toContain("data-person-detail");
  });

  it("renders three resizable independent boards and replaces old dashboards", () => {
    const html = renderToString(
      <TimesheetWorkspace
        onSignOut={() => {}}
        user={{
          id: "user-1",
          email: "partner@projectwing.local",
          name: "Partner",
          globalRole: "PARTNER",
        }}
      />
    );

    for (const type of ["Chargeable", "Non-Chargeable", "Leave"]) {
      expect(html).toContain(`data-timesheet-board="${type}"`);
    }
    expect(html.match(/data-timesheet-resize-handle/g)).toHaveLength(2);
    const resizeSeparatorTags = [
      ...html.matchAll(/<button[^>]*data-timesheet-resize-handle[^>]*>/g),
    ].map((match) => match[0]);
    expect(resizeSeparatorTags).toHaveLength(2);
    expect(html.match(/data-timesheet-board=/g)).toHaveLength(3);
    expect(html.match(/data-independent-scroll="true"/g)).toHaveLength(3);
    expect(html.match(/data-timesheet-vertical-scroll/g)).toHaveLength(3);
    expect(html.match(/data-timesheet-vertical-rail/g) ?? []).toHaveLength(0);
    expect(html.match(/role="scrollbar"/g) ?? []).toHaveLength(0);
    expect(html.match(/data-timesheet-horizontal-rail/g)).toHaveLength(3);
    const boardTags = [
      ...html.matchAll(/<section[^>]*data-timesheet-board="[^"]+"[^>]*>/g),
    ].map((match) => match[0]);
    expect(boardTags).toHaveLength(3);
    expect(
      html.match(/rounded-lg border border-border bg-card shadow-sm/g)
    ).toHaveLength(1);
  });

  it("coalesces board drag work into one animation frame before committing", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    render(
      <TimesheetWorkspace
        onSignOut={() => {}}
        user={{
          id: "user-1",
          email: "partner@projectwing.local",
          name: "Partner",
          globalRole: "PARTNER",
        }}
      />
    );
    const grid = document.querySelector<HTMLElement>(
      "[data-timesheet-board-grid]"
    );
    expect(grid).not.toBeNull();
    vi.spyOn(expectPresent(grid), "getBoundingClientRect").mockReturnValue({
      top: 0,
      left: 0,
      right: 800,
      bottom: 100,
      width: 800,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const initialRows = expectPresent(grid).style.gridTemplateRows;
    frames.length = 0;

    const separator = expectPresent(
      document.querySelector<HTMLElement>("[data-timesheet-resize-handle]")
    );
    fireEvent.pointerDown(separator, {
      button: 0,
      clientY: 40,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, { clientY: 70, pointerId: 1 });
    fireEvent.pointerMove(window, { clientY: 80, pointerId: 1 });

    expect(frames).toHaveLength(1);
    expect(expectPresent(grid).style.gridTemplateRows).toBe(initialRows);
    expect(grid).toHaveAttribute("data-board-layout", "0.56,0.78");

    expectPresent(frames.shift())(0);
    expect(expectPresent(grid).style.gridTemplateRows).toContain("0.8fr");

    fireEvent.pointerUp(window, { clientY: 80, pointerId: 1 });
    await waitFor(() =>
      expect(grid).toHaveAttribute("data-board-layout", "0.8,0.8")
    );
  });

  it("blocks all validation issues before submission", () => {
    expect(shouldBlockTimesheetSubmit([{ severity: "warning" }])).toBeTruthy();
    expect(shouldBlockTimesheetSubmit([{ severity: "error" }])).toBeTruthy();
    expect(shouldConfirmTimesheetSubmit([{ severity: "warning" }])).toBeFalsy();
    expect(shouldConfirmTimesheetSubmit([{ severity: "error" }])).toBeFalsy();
    expect(shouldConfirmTimesheetSubmit([])).toBeFalsy();
  });

  it("keeps the actual completion segments when the center shows an alert", () => {
    expect(
      getTimesheetProgressSegments({ completed: 9, open: 2 }, tmsWorkspaceCopy)
    ).toStrictEqual([
      { label: tmsWorkspaceCopy.completed, value: 9, color: "var(--success)" },
      { label: tmsWorkspaceCopy.open, value: 2, color: "var(--muted)" },
    ]);
  });

  it("does not auto-save restored rows and opens a failure dialog when open dates remain", async () => {
    const month = {
      year: 2026,
      month: 7,
      rows: [],
      periods: {
        FIRST_HALF: { status: "DRAFT", revision: 0, editable: true },
        SECOND_HALF: { status: "DRAFT", revision: 0, editable: true },
      },
      persistence: "SERVER",
    } as never;
    const load = vi
      .spyOn(tmsApi, "loadTimesheetMonth")
      .mockResolvedValue(month);
    const save = vi
      .spyOn(tmsApi, "saveTimesheetDraft")
      .mockResolvedValue(month);
    const submit = vi.spyOn(tmsApi, "submitTimesheet").mockResolvedValue(month);

    render(
      <TimesheetWorkspace
        onSignOut={() => {}}
        user={{
          id: "user-1",
          email: "staff@projectwing.local",
          name: "Staff",
          globalRole: "STAFF",
        }}
      />
    );

    await waitFor(() => expect(load).toHaveBeenCalledWith(2026, 7));
    await new Promise((resolve) => {
      window.setTimeout(resolve, 600);
    });
    expect(save).not.toHaveBeenCalled();
    const submitButton = screen.getByRole("button", { name: "Submit" });
    expect(submitButton).not.toBeDisabled();
    expect(
      screen.queryByTestId("timesheet-submit-failure-feedback")
    ).toBeNull();
    fireEvent.click(submitButton);
    await expect(screen.findByRole("dialog")).resolves.toHaveTextContent(
      "Submit failed"
    );
    expect(
      screen.getByTestId("timesheet-submit-failure-feedback")
    ).toHaveTextContent("Hours=0");
    expect(save).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it("shows incomplete and abnormal submit reasons together for 20 seconds", async () => {
    const normalRow: TimesheetRow = {
      ...engagementFixture("ORC-2026-ABNORMAL"),
      id: "submit-failure-normal",
      periodScope: "first",
      type: "Chargeable",
      workType: "Normal",
      details: "Normal",
      description: "",
      hoursByDate: { "2026-07-01": 8 },
      periodTotal: 8,
    };
    const leaveRow: TimesheetRow = {
      ...normalRow,
      id: "submit-failure-leave",
      type: "Leave",
      workType: "Normal",
      details: "Annual Leave",
      hoursByDate: { "2026-07-01": 1 },
      periodTotal: 1,
    };
    const month = {
      year: 2026,
      month: 7,
      rows: [normalRow, leaveRow],
      periods: {
        FIRST_HALF: { status: "DRAFT", revision: 0, editable: true },
        SECOND_HALF: { status: "DRAFT", revision: 0, editable: true },
      },
      persistence: "SERVER",
    } as never;
    const load = vi
      .spyOn(tmsApi, "loadTimesheetMonth")
      .mockResolvedValue(month);
    const save = vi
      .spyOn(tmsApi, "saveTimesheetDraft")
      .mockResolvedValue(month);
    const submit = vi.spyOn(tmsApi, "submitTimesheet").mockResolvedValue(month);

    render(
      <TimesheetWorkspace
        onSignOut={() => {}}
        user={{
          id: "user-1",
          email: "staff@projectwing.local",
          name: "Staff",
          globalRole: "STAFF",
        }}
      />
    );

    await waitFor(() => expect(load).toHaveBeenCalledWith(2026, 7));
    const submitButton = await screen.findByRole("button", { name: "Submit" });
    expect(
      screen.queryByTestId("timesheet-submit-failure-feedback")
    ).toBeNull();

    vi.useFakeTimers();

    fireEvent.click(submitButton);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Hours=0");
    expect(dialog).toHaveTextContent("Normal+Leave>8H");
    const feedback = screen.getByTestId("timesheet-submit-failure-feedback");
    expect(feedback).toHaveTextContent("Hours=0");
    expect(feedback).toHaveTextContent("Normal+Leave>8H");
    expect(save).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(19_999);
    });
    expect(
      screen.getByTestId("timesheet-submit-failure-feedback")
    ).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(
      screen.queryByTestId("timesheet-submit-failure-feedback")
    ).toBeNull();
  });

  it("shows the server submission reason when the request is rejected", async () => {
    const row: TimesheetRow = {
      ...engagementFixture("ORC-2026-SERVER-ERROR"),
      id: "server-error-row",
      periodScope: "second",
      type: "Chargeable",
      workType: "Normal",
      details: "Normal",
      description: "",
      hoursByDate: {
        "2026-07-16": 8,
        "2026-07-17": 8,
        "2026-07-20": 8,
        "2026-07-21": 8,
        "2026-07-22": 8,
        "2026-07-23": 8,
        "2026-07-24": 8,
        "2026-07-27": 8,
        "2026-07-28": 8,
        "2026-07-29": 8,
        "2026-07-30": 8,
        "2026-07-31": 8,
      },
      periodTotal: 96,
    };
    const month = {
      year: 2026,
      month: 7,
      rows: [row],
      periods: {
        FIRST_HALF: { status: "DRAFT", revision: 0, editable: true },
        SECOND_HALF: { status: "DRAFT", revision: 0, editable: true },
      },
      persistence: "SERVER",
    } as never;
    vi.spyOn(tmsApi, "loadTimesheetMonth").mockResolvedValue(month);
    vi.spyOn(tmsApi, "saveTimesheetDraft").mockResolvedValue(month);
    const submit = vi.spyOn(tmsApi, "submitTimesheet").mockRejectedValue(
      Object.assign(new Error("2026-07-01 Normal + Leave 不能超过 8 小时"), {
        code: "VALIDATION_FAILED",
        status: 400,
      })
    );
    saveTimesheetFilters("user-1", {
      year: 2026,
      month: 7,
      period: "second",
      typeFilter: "All",
    });

    render(
      <TimesheetWorkspace
        onSignOut={() => {}}
        user={{
          id: "user-1",
          email: "staff@projectwing.local",
          name: "Staff",
          globalRole: "STAFF",
        }}
      />
    );

    await expect(
      screen.findByText("ORC-2026-SERVER-ERROR")
    ).resolves.toBeInTheDocument();
    const submitButton = await screen.findByRole("button", { name: "Submit" });
    fireEvent.click(submitButton);

    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    await expect(screen.findByRole("dialog")).resolves.toHaveTextContent(
      "2026-07-01 Normal + Leave 不能超过 8 小时"
    );
  });

  it("marks returned hours red and shows a persistent resubmission notice", async () => {
    const engagement = engagementFixture("ORC-2026-AUD", "Orchid annual audit");
    const row: TimesheetRow = {
      ...engagement,
      id: "returned-row",
      periodScope: "first",
      type: "Chargeable",
      details: "Normal",
      description: "Fieldwork",
      hoursByDate: { "2026-07-03": 8 },
      periodTotal: 8,
    };
    const month = {
      year: 2026,
      month: 7,
      rows: [row],
      periods: {
        FIRST_HALF: {
          status: "SUBMITTED",
          revision: 1,
          editable: true,
          approvalStatus: "RETURNED",
        },
        SECOND_HALF: {
          status: "DRAFT",
          revision: 0,
          editable: true,
          approvalStatus: "NOT_SUBMITTED",
        },
      },
      approvalLocks: [
        {
          engagementId: engagement.engagementId,
          half: "FIRST_HALF",
          status: "RETURNED",
          lockAll: false,
          lockedCells: [],
          returnedCells: [{ rowId: row.id, date: "2026-07-03" }],
          returnReason: "Please correct the hours.",
        },
      ],
      persistence: "SERVER",
    } as never;
    const load = vi
      .spyOn(tmsApi, "loadTimesheetMonth")
      .mockResolvedValue(month);
    vi.spyOn(tmsApi, "saveTimesheetDraft").mockResolvedValue(month);
    saveTimesheetFilters("user-1", {
      year: 2026,
      month: 7,
      period: "first",
      typeFilter: "All",
    });

    render(
      <TimesheetWorkspace
        onSignOut={() => {}}
        user={{
          id: "user-1",
          email: "staff@projectwing.local",
          name: "Staff",
          globalRole: "STAFF",
        }}
      />
    );

    await waitFor(() => expect(load).toHaveBeenCalledWith(2026, 7));
    const returnedCell = await screen.findByTestId(
      "timesheet-returned-cell-returned-row-2026-07-03"
    );
    expect(
      within(returnedCell).getByRole("textbox", { name: "Hours" })
    ).not.toBeDisabled();
  });

  it("renders filling progress with the app-local Recharts wrapper", () => {
    const { container } = render(
      <TimesheetWorkspace
        onSignOut={() => {}}
        user={{
          id: "user-1",
          email: "partner@projectwing.local",
          name: "Partner",
          globalRole: "PARTNER",
        }}
      />
    );

    expect(container.querySelector('[data-slot="chart"]')).toBeInTheDocument();
    expect(container.querySelector(".recharts-wrapper")).toBeInTheDocument();
    expect(container.querySelector(".donut-open")).not.toBeInTheDocument();
  });

  it("maps a fully collapsed lower layout back to Chargeable and persists it", () => {
    const user = {
      id: "user-1",
      email: "partner@projectwing.local",
      name: "Partner",
      globalRole: "PARTNER" as const,
    };
    const { container } = render(
      <TimesheetWorkspace onSignOut={() => {}} user={user} />
    );
    const boardGrid = container.querySelector(
      "[data-timesheet-board-grid]"
    ) as HTMLElement;
    const separators = [
      ...document.querySelectorAll<HTMLElement>(
        "[data-timesheet-resize-handle]"
      ),
    ];

    vi.spyOn(boardGrid, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 100,
      top: 100,
      left: 0,
      right: 1000,
      bottom: 600,
      width: 1000,
      height: 500,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(separators[1], { clientY: 600 });
    fireEvent.pointerMove(window, { clientY: 600 });
    fireEvent.pointerUp(window, { clientY: 600 });
    fireEvent.pointerDown(separators[0], { clientY: 600 });
    fireEvent.pointerMove(window, { clientY: 600 });
    fireEvent.pointerUp(window, { clientY: 600 });

    expect(boardGrid).toHaveAttribute("data-type-filter", "Chargeable");
    expect(
      window.localStorage.getItem(timesheetBoardLayoutStorageKey(user.id))
    ).toBe(JSON.stringify({ firstBoundary: 1, secondBoundary: 1 }));
  });

  it("renders daily Hours verification rows and thresholds", () => {
    const dailyHours = buildPeriodDays(2026, 7, "first").map((day) => ({
      ...day,
      chargeable: day.dayOfMonth === 1 ? 6 : 0,
      nonChargeable: day.dayOfMonth === 1 ? 2 : 0,
      leave: day.dayOfMonth === 1 ? 8 : 0,
      normal: day.dayOfMonth === 1 ? 16 : 0,
      overtime: 0,
      regularTotal: day.dayOfMonth === 1 ? 16 : 0,
      isHoliday: !day.isWorkday,
      explainedTotal: day.dayOfMonth === 1 ? 16 : 0,
      total: day.dayOfMonth === 1 ? 8 : 0,
    }));
    const html = renderToString(
      <HoursVerificationTable dailyHours={dailyHours} />
    );

    for (const row of ["Chargeable", "Non-Chargeable", "Leave", "Total"]) {
      expect(html).toContain(`data-hours-summary-row="${row}"`);
    }
  });

  describe("filter memory", () => {
    const now = new Date(2026, 6, 20);

    it("builds a rolling seven-year range", () => {
      expect(buildTimesheetYearOptions(2026)).toStrictEqual([
        2023, 2024, 2025, 2026, 2027, 2028, 2029,
      ]);
      expect(buildTimesheetYearOptions(2027)).toStrictEqual([
        2024, 2025, 2026, 2027, 2028, 2029, 2030,
      ]);
    });

    it("restores one complete valid record for the current account", () => {
      const storage = memoryStorage();
      storage.setItem(
        timesheetFiltersStorageKey("user-1"),
        JSON.stringify({
          year: 2027,
          month: 2,
          period: "all",
          typeFilter: "Leave",
        })
      );

      expect(readSavedTimesheetFilters("user-1", now, storage)).toStrictEqual({
        year: 2027,
        month: 2,
        period: "first",
        typeFilter: "Leave",
      });
      expect(readSavedTimesheetFilters("user-2", now, storage)).toStrictEqual(
        createDefaultTimesheetFilters(now)
      );
    });

    it("starts with the upper-half Period and keeps Type All available", () => {
      expect(createDefaultTimesheetFilters(now)).toMatchObject({
        period: "first",
        typeFilter: "All",
      });
    });

    it.each([
      "not-json",
      JSON.stringify({
        year: 2022,
        month: 7,
        period: "first",
        typeFilter: "All",
      }),
      JSON.stringify({
        year: 2026,
        month: 13,
        period: "first",
        typeFilter: "All",
      }),
      JSON.stringify({
        year: 2026,
        month: 7,
        period: "quarter",
        typeFilter: "All",
      }),
      JSON.stringify({
        year: 2026,
        month: 7,
        period: "first",
        typeFilter: "Unknown",
      }),
    ])("falls back completely for invalid storage: %s", (raw) => {
      const storage = memoryStorage();
      storage.setItem(timesheetFiltersStorageKey("user-1"), raw);

      expect(readSavedTimesheetFilters("user-1", now, storage)).toStrictEqual(
        createDefaultTimesheetFilters(now)
      );
    });

    it("keeps filters usable when storage access fails", () => {
      const deniedStorage = {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("quota");
        },
      };

      expect(
        readSavedTimesheetFilters("user-1", now, deniedStorage)
      ).toStrictEqual(createDefaultTimesheetFilters(now));
      expect(() =>
        saveTimesheetFilters(
          "user-1",
          {
            year: 2027,
            month: 2,
            period: "second",
            typeFilter: "Chargeable",
          },
          deniedStorage
        )
      ).not.toThrow();
    });

    it("writes one complete account-scoped record", () => {
      const storage = memoryStorage();
      const filters = {
        year: 2027,
        month: 2,
        period: "second" as const,
        typeFilter: "Chargeable" as const,
      };

      saveTimesheetFilters("user-1", filters, storage);

      expect(storage.getItem(timesheetFiltersStorageKey("user-1"))).toBe(
        JSON.stringify(filters)
      );
      expect(storage.getItem(timesheetFiltersStorageKey("user-2"))).toBeNull();
    });

    it("initializes rows from the restored period", () => {
      const storage = memoryStorage();
      storage.setItem(
        timesheetFiltersStorageKey("user-1"),
        JSON.stringify({
          year: 2026,
          month: 7,
          period: "first",
          typeFilter: "All",
        })
      );

      const state = createInitialTimesheetWorkspaceState(
        "user-1",
        now,
        storage
      );

      expect(state.filters).toStrictEqual({
        year: 2026,
        month: 7,
        period: "first",
        typeFilter: "All",
      });
      expect(state.rows).toStrictEqual(createInitialRows(2026, 7, "first"));
    });
  });

  describe("board layout memory", () => {
    it("uses 56:22:22 by default and maps canonical Type layouts", () => {
      const storage = memoryStorage();

      expect(DEFAULT_TIMESHEET_BOARD_LAYOUT).toStrictEqual({
        firstBoundary: 0.56,
        secondBoundary: 0.78,
      });
      expect(readTimesheetBoardLayout("user-1", storage)).toStrictEqual(
        DEFAULT_TIMESHEET_BOARD_LAYOUT
      );
      expect(boardLayoutForTypeFilter("All")).toStrictEqual(
        DEFAULT_TIMESHEET_BOARD_LAYOUT
      );
    });

    it("persists a valid layout per user and rejects invalid boundaries", () => {
      const storage = memoryStorage();
      const layout = { firstBoundary: 0.45, secondBoundary: 0.72 };

      saveTimesheetBoardLayout("user-1", layout, storage);

      expect(storage.getItem(timesheetBoardLayoutStorageKey("user-1"))).toBe(
        JSON.stringify(layout)
      );
      expect(readTimesheetBoardLayout("user-1", storage)).toStrictEqual(layout);
      expect(readTimesheetBoardLayout("user-2", storage)).toStrictEqual(
        DEFAULT_TIMESHEET_BOARD_LAYOUT
      );

      storage.setItem(
        timesheetBoardLayoutStorageKey("user-1"),
        JSON.stringify({ firstBoundary: 0.9, secondBoundary: 0.2 })
      );
      expect(readTimesheetBoardLayout("user-1", storage)).toStrictEqual(
        DEFAULT_TIMESHEET_BOARD_LAYOUT
      );
    });

    it("pushes the adjacent boundary instead of blocking a dragged separator", () => {
      expect(
        resizeTimesheetBoardLayout(
          { firstBoundary: 0.6, secondBoundary: 0.8 },
          "first",
          0.9
        )
      ).toStrictEqual({ firstBoundary: 0.9, secondBoundary: 0.9 });
      expect(
        resizeTimesheetBoardLayout(
          { firstBoundary: 0.6, secondBoundary: 0.8 },
          "second",
          0.4
        )
      ).toStrictEqual({ firstBoundary: 0.4, secondBoundary: 0.4 });
    });
  });

  it("migrates legacy saved rows once and keeps the result stable", () => {
    const storage = memoryStorage();
    vi.stubGlobal("window", { localStorage: storage });
    storage.setItem(
      "project-wing-tms-rows:2026:7:first",
      JSON.stringify([
        {
          ...engagementFixture("ORC-2026-AUD", "Orchid annual audit"),
          id: "legacy-normal",
          type: "Normal",
          hoursByDate: { "2026-07-01": 8 },
          periodTotal: 8,
        },
      ])
    );

    const firstRead = readSavedRows(2026, 7, "first");
    expect(firstRead?.[0]).toMatchObject({
      id: "legacy-normal",
      periodScope: "first",
      type: "Chargeable",
      details: "Normal",
      description: "",
      hoursByDate: { "2026-07-01": 8 },
      periodTotal: 8,
    });
    saveRows(2026, 7, "first", firstRead ?? []);
    expect(readSavedRows(2026, 7, "first")).toStrictEqual(firstRead);
  });

  it("keeps blank rows in their creation scope", () => {
    const firstRow: TimesheetRow = {
      id: "first-empty",
      periodScope: "first",
      type: "Non-Chargeable",
      details: "Internal Admin",
      description: "",
      hoursByDate: {},
      periodTotal: 0,
    };
    const allRow: TimesheetRow = {
      ...firstRow,
      id: "all-empty",
      periodScope: "all",
    };

    expect(rowsForPeriod([firstRow, allRow], 2026, 7, "first")).toHaveLength(2);
    expect(rowsForPeriod([firstRow, allRow], 2026, 7, "second")).toStrictEqual([
      allRow,
    ]);
    expect(rowsForPeriod([firstRow, allRow], 2026, 7, "all")).toHaveLength(2);
  });

  it("updates and deletes one all-scope identity without losing other-half hours", () => {
    const allRow: TimesheetRow = {
      ...engagementFixture("ORC-2026-AUD", "Orchid annual audit"),
      id: "all-row",
      periodScope: "all",
      type: "Chargeable",
      details: "Normal",
      description: "Original",
      hoursByDate: { "2026-07-01": 8, "2026-07-16": 6 },
      periodTotal: 14,
    };
    const firstView = rowsForPeriod([allRow], 2026, 7, "first").map((row) => ({
      ...row,
      description: "Updated",
      hoursByDate: { "2026-07-01": 7 },
      periodTotal: 7,
    }));
    const replaced = replaceRowsForPeriod(
      [allRow],
      firstView,
      buildPeriodDays(2026, 7, "first"),
      "first"
    );

    expect(replaced[0]).toMatchObject({
      id: "all-row",
      description: "Updated",
      hoursByDate: { "2026-07-01": 7, "2026-07-16": 6 },
      periodTotal: 13,
    });
    expect(
      replaceRowsForPeriod(
        replaced,
        [],
        buildPeriodDays(2026, 7, "first"),
        "first"
      )
    ).toStrictEqual([]);
  });
});

describe("timesheet column filters", () => {
  const chargeableRows: TimesheetRow[] = [
    {
      ...engagementFixture("100204", "WZ Holdings"),
      id: "row-1",
      periodScope: "first",
      type: "Chargeable",
      workType: "Normal",
      details: "Normal",
      clientName: "WZ Holdings Limited",
      pic: "CW",
      mic: "MC",
      description: "",
      hoursByDate: {},
      periodTotal: 0,
    },
    {
      ...engagementFixture("200118", "Lee Group"),
      id: "row-2",
      periodScope: "first",
      type: "Chargeable",
      workType: "OT",
      details: "OT",
      clientName: "Lee Group Limited",
      pic: "HN",
      mic: "MC",
      description: "Follow-up",
      hoursByDate: {},
      periodTotal: 0,
    },
  ];

  it("lists distinct column values and exposes blank descriptions", () => {
    expect(timesheetColumnValues(chargeableRows, "workType")).toStrictEqual([
      "Normal",
      "OT",
    ]);
    expect(timesheetColumnValues(chargeableRows, "description")).toStrictEqual([
      "(Blank)",
      "Follow-up",
    ]);
  });

  it("uses OR within a column and AND across columns without mutating rows", () => {
    const original = structuredClone(chargeableRows);

    expect(
      filterTimesheetRowsByColumns(chargeableRows, {
        clientName: ["WZ Holdings Limited", "Lee Group Limited"],
        workType: ["OT"],
      }).map((row) => row.id)
    ).toStrictEqual(["row-2"]);
    expect(chargeableRows).toStrictEqual(original);
  });

  it("searches and selects a column value to filter both board panes", () => {
    const { container } = render(
      <TimesheetBoard
        days={buildPeriodDays(2026, 7, "first")}
        deleteMode={false}
        selectedIds={new Set()}
        onDescriptionChange={() => {}}
        onHourChange={() => {}}
        onToggleSelected={() => {}}
        type="Chargeable"
        rows={chargeableRows}
      />
    );
    const trigger = screen.getByRole("button", {
      name: "Filter Client Name",
    });
    fireEvent.click(trigger);
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search Client Name" }),
      {
        target: { value: "Lee" },
      }
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Lee Group Limited" })
    );

    expect(trigger).toHaveAttribute("data-filter-active", "true");
    expect(trigger).toHaveClass(
      "size-6",
      "hover:border-primary/50",
      "data-[filter-active=true]:border-primary/60"
    );
    expect(
      container.querySelectorAll('[data-timesheet-row-id="row-1"]')
    ).toHaveLength(0);
    expect(
      container.querySelectorAll('[data-timesheet-row-id="row-2"]')
    ).toHaveLength(2);
  });

  it("uses the same weekend surface and trailing Description layout for every section", () => {
    const days = buildPeriodDays(2026, 7, "first");
    const nonChargeableRow: TimesheetRow = {
      id: "non-chargeable-1",
      periodScope: "first",
      type: "Non-Chargeable",
      workType: "OT",
      details: "Marketing",
      description: "",
      hoursByDate: {},
      periodTotal: 0,
    };
    const leaveRow: TimesheetRow = {
      id: "leave-1",
      periodScope: "first",
      type: "Leave",
      workType: "Normal",
      details: "Annual Leave",
      description: "",
      hoursByDate: {},
      periodTotal: 0,
    };
    const props = {
      days,
      deleteMode: false,
      selectedIds: new Set<string>(),
      onDescriptionChange: () => {},
      onHourChange: () => {},
      onToggleSelected: () => {},
    };
    const nonChargeable = renderToString(
      <TimesheetBoard
        {...props}
        type="Non-Chargeable"
        rows={[nonChargeableRow]}
      />
    );
    const leave = renderToString(
      <TimesheetBoard {...props} type="Leave" rows={[leaveRow]} />
    );

    for (const html of [nonChargeable, leave]) {
      expect(html.indexOf("timesheet-date-scroll")).toBeLessThan(
        html.indexOf(">Description<")
      );
    }
  });
});

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  } satisfies Storage;
}

function engagementFixture(
  engagementCode: string,
  _legacyEngagementName?: string
): Engagement {
  return {
    engagementId: engagementCode,
    engagementCode,
    clientCode: "C-001",
    clientName: "Demo Client Limited",
    budgetedHours: "100.00",
    agreedFee: "50000.00",
    recoveryRate: null,
    feeCurrency: "HKD",
    pic: "Partner",
    mic: "Manager",
    codeAliases: [],
    timesheetAccess: { allowed: true, reason: "ALLOWED" },
  };
}
