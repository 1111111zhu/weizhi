import type { TmsTimesheetQueryResponse } from "@project-wing/shared";
// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, vi, describe, expect, it } from "vitest";

import { getTmsWorkspaceCopy } from "@/i18n/dictionaries";
import type * as TmsApi from "@/lib/api";
import type { User } from "@/lib/api";

import { QueryWorkspace } from "./query-workspace";

type TmsApiModule = typeof TmsApi;

const getTmsTimesheetQuery = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<TmsApiModule>("@/lib/api");
  return { ...actual, getTmsTimesheetQuery };
});

vi.mock("@/components/tms-header", () => ({
  TmsHeader: ({ onReturn }: { onReturn?: () => void }) => (
    <header>
      <button type="button" onClick={onReturn ?? (() => {})}>
        Back
      </button>
    </header>
  ),
}));

describe(QueryWorkspace, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 6, 20));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("loads the default detail query and renders results with the shared DataGrid", async () => {
    getTmsTimesheetQuery.mockResolvedValue({
      mode: "DETAIL",
      rows: [
        {
          jobCode: "HBR-2026-ACC",
          staffNo: null,
          staffName: "Jony Ma",
          timesheetDate: "2026-07-16",
          rate: null,
          normal: 8,
          ot: 0,
          absent: 0,
          total: null,
          clientName: "Harbour Retail Limited",
          netBudgetFee: "0.00",
          pic: "Edric Han",
          mic: "Leo Li",
          timesheetStatus: "DRAFT",
          activeStatus: "ACTIVE",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    render(
      <QueryWorkspace
        user={
          {
            id: "manager-1",
            name: "Manager",
            email: "manager@example.com",
            globalRole: "MANAGER",
          } satisfies User
        }
        onBack={() => {}}
        onSignOut={() => {}}
      />
    );

    expect(screen.getByLabelText("Staff Name")).toBeTruthy();
    const queryCopy = getTmsWorkspaceCopy("en-US");
    expect(screen.getByLabelText(queryCopy.engagementCode)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export Excel" })).toBeTruthy();
    await waitFor(() =>
      expect(
        screen.getByRole("columnheader", { name: queryCopy.engagementCode })
      ).toBeTruthy()
    );
    expect(screen.getByTestId("tms-query-data-grid")).toBeTruthy();
    expect(
      screen.getByRole("separator", {
        name: `Resize ${queryCopy.engagementCode} column`,
      })
    ).toBeTruthy();
    expect(screen.getByRole("cell", { name: "2026-07-16" })).toBeTruthy();
    await waitFor(() =>
      expect(getTmsTimesheetQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "DETAIL",
          page: 1,
          pageSize: 50,
        })
      )
    );
  });

  it("uses compact tabs and visibly slides the active mode indicator", async () => {
    getTmsTimesheetQuery.mockReset();
    getTmsTimesheetQuery.mockResolvedValue({
      mode: "DETAIL",
      rows: [],
      total: 0,
      page: 1,
      pageSize: 50,
    });

    render(
      <QueryWorkspace
        user={
          {
            id: "manager-1",
            name: "Manager",
            email: "manager@example.com",
            globalRole: "MANAGER",
          } satisfies User
        }
        onBack={() => {}}
        onSignOut={() => {}}
      />
    );

    const toggle = screen.getByTestId("query-mode-toggle");
    expect(toggle.dataset.queryMode).toBe("DETAIL");
    expect(toggle.className).toContain("h-7");
    expect(toggle.className).toContain("w-24");
    expect(screen.getByRole("tab", { name: "明细" })).toBeTruthy();
    expect(
      screen.getByTestId("query-mode-active-indicator").className
    ).toContain("query-mode-active-indicator");
    expect(
      screen.getByTestId("query-mode-active-indicator").className
    ).toContain("translate-x-0");

    fireEvent.click(screen.getByRole("tab", { name: "汇总" }));

    expect(toggle.dataset.queryMode).toBe("SUMMARY");
    expect(
      screen.getByTestId("query-mode-active-indicator").className
    ).toContain("translate-x-full");
    await waitFor(() =>
      expect(getTmsTimesheetQuery).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "SUMMARY", page: 1 })
      )
    );
  });

  it("keeps the current results visible while the next mode softly enters", async () => {
    const detailResponse = {
      mode: "DETAIL",
      rows: [
        {
          jobCode: "HBR-2026-ACC",
          staffNo: "001",
          staffName: "Jony Ma",
          timesheetDate: "2026-07-16",
          rate: "4500.00",
          normal: 8,
          ot: 0,
          absent: 0,
          total: "36000.00",
          clientName: "Harbour Retail Limited",
          netBudgetFee: "0.00",
          pic: "Edric Han",
          mic: "Leo Li",
          timesheetStatus: "DRAFT",
          activeStatus: "ACTIVE",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 50,
    } satisfies TmsTimesheetQueryResponse;
    let resolveSummary = (_value: TmsTimesheetQueryResponse) => {};
    const summaryPromise = new Promise<TmsTimesheetQueryResponse>((resolve) => {
      resolveSummary = resolve;
    });
    getTmsTimesheetQuery.mockReset();
    getTmsTimesheetQuery
      .mockResolvedValueOnce(detailResponse)
      .mockReturnValueOnce(summaryPromise);

    render(
      <QueryWorkspace
        user={
          {
            id: "manager-1",
            name: "Manager",
            email: "manager@example.com",
            globalRole: "MANAGER",
          } satisfies User
        }
        onBack={() => {}}
        onSignOut={() => {}}
      />
    );

    await waitFor(() => expect(screen.getByText("Jony Ma")).toBeTruthy());
    fireEvent.click(screen.getByRole("tab", { name: "汇总" }));

    await waitFor(() =>
      expect(
        screen.getByTestId("query-results-frame").dataset.queryResultsState
      ).toBe("leaving")
    );
    expect(screen.getByText("Jony Ma")).toBeTruthy();

    resolveSummary({
      mode: "SUMMARY",
      rows: [
        {
          jobCode: "HBR-2026-ACC",
          staffNo: "001",
          staffName: "Summary Manager",
          dateFrom: "2026-07-01",
          dateTo: "2026-07-31",
          rate: "4500.00",
          normal: 8,
          ot: 0,
          absent: 0,
          total: "36000.00",
          clientName: "Harbour Retail Limited",
          netBudgetFee: "0.00",
          pic: "Edric Han",
          mic: "Leo Li",
          timesheetStatus: "DRAFT",
          activeStatus: "ACTIVE",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 50,
    });

    await waitFor(() => {
      expect(screen.getByText("Summary Manager")).toBeTruthy();
      expect(
        screen.getByTestId("query-results-frame").dataset.queryResultsState
      ).toBe("ready");
    });
  });

  it("opens an editable project calendar from the date field", () => {
    getTmsTimesheetQuery.mockResolvedValue({
      mode: "DETAIL",
      rows: [],
      total: 0,
      page: 1,
      pageSize: 50,
    });

    render(
      <QueryWorkspace
        user={
          {
            id: "manager-1",
            name: "Manager",
            email: "manager@example.com",
            globalRole: "MANAGER",
          } satisfies User
        }
        onBack={() => {}}
        onSignOut={() => {}}
      />
    );

    const dateFrom = screen.getByLabelText("Date From");
    expect(dateFrom.getAttribute("type")).toBe("text");
    fireEvent.change(dateFrom, { target: { value: "2026-07-20" } });
    expect((dateFrom as HTMLInputElement).value).toBe("2026-07-20");
    fireEvent.focus(dateFrom);
    fireEvent.pointerDown(dateFrom);
    fireEvent.mouseDown(dateFrom);
    fireEvent.mouseUp(dateFrom);
    fireEvent.click(dateFrom);
    expect(
      screen.getByRole("dialog", { name: "Date From calendar" })
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /July 20/ }));
    expect((dateFrom as HTMLInputElement).value).toBe("2026-07-20");
  });
});
