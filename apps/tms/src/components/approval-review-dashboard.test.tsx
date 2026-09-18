import type { TmsApprovalRecord, TmsTimesheetRow } from "@project-wing/shared";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { buildPeriodDays } from "@/lib/timesheet";

import { ApprovalReviewDashboard } from "./approval-review-dashboard";

function row(
  id: string,
  periodScope: "first" | "second",
  hoursByDate: Record<string, number>
): TmsTimesheetRow {
  return {
    id,
    periodScope,
    type: "Chargeable",
    details: "Normal",
    description: "Fieldwork",
    hoursByDate,
    periodTotal: Object.values(hoursByDate).reduce(
      (total, hours) => total + hours,
      0
    ),
  };
}

function record(
  ownerUserId: string,
  ownerName: string,
  half: "FIRST_HALF" | "SECOND_HALF",
  status: TmsApprovalRecord["status"],
  submittedRows: TmsTimesheetRow[] = []
): TmsApprovalRecord {
  return {
    id: `${ownerUserId}-${half}`,
    ownerUserId,
    ownerName,
    ownerEmail: `${ownerUserId}@projectwing.local`,
    year: 2026,
    month: 7,
    half,
    engagementId: "engagement-1",
    engagementCode: "HBR-2026-ACC",
    clientCode: "C-HBR-2026",
    clientName: "Harbour Retail Limited",
    revision: 1,
    status,
    submittedRows,
    submittedAt: null,
    reviewedById: null,
    reviewedAt: null,
    returnReason: null,
  };
}

describe(ApprovalReviewDashboard, () => {
  afterEach(cleanup);

  it("shows submission status and date-level missing or underfilled work", () => {
    render(
      <ApprovalReviewDashboard
        userId="manager-1"
        period="all"
        days={buildPeriodDays(2026, 7, "all")}
        records={[
          record("king", "King Su", "FIRST_HALF", "SUBMITTED", [
            row("king-first", "first", { "2026-07-02": 4 }),
          ]),
          record("amy", "Amy Chan", "FIRST_HALF", "NOT_SUBMITTED"),
          record("amy", "Amy Chan", "SECOND_HALF", "APPROVED", [
            row("amy-second", "second", { "2026-07-16": 8 }),
          ]),
        ]}
      />
    );

    expect(screen.getByTestId("approval-review-dashboard")).toBeInTheDocument();
    expect(screen.getByText("提交概览")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Filter Name" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("未提交").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Amy Chan").length).toBeGreaterThan(0);
    expect(screen.getAllByText("未交").length).toBeGreaterThan(0);
    expect(screen.getByText("4.0")).toBeInTheDocument();
    const _detailTable = screen.getByTestId("approval-review-detail-table");
  });

  it("uses only the selected Name filter for review data", () => {
    render(
      <ApprovalReviewDashboard
        userId="manager-1"
        period="first"
        nameFilters={["Amy Chan"]}
        days={buildPeriodDays(2026, 7, "first")}
        records={[
          record("king", "King Su", "FIRST_HALF", "SUBMITTED"),
          record("amy", "Amy Chan", "FIRST_HALF", "NOT_SUBMITTED"),
        ]}
      />
    );

    expect(screen.getAllByText("Amy Chan").length).toBeGreaterThan(0);
  });

  it("updates review rows from the shared Name filter", async () => {
    function Harness() {
      const [nameFilters, setNameFilters] = useState<string[]>([]);
      return (
        <ApprovalReviewDashboard
          userId="manager-1"
          period="first"
          nameFilters={nameFilters}
          onNameFiltersChange={setNameFilters}
          days={buildPeriodDays(2026, 7, "first")}
          records={[
            record("king", "King Su", "FIRST_HALF", "SUBMITTED"),
            record("amy", "Amy Chan", "FIRST_HALF", "NOT_SUBMITTED"),
          ]}
        />
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Filter Name" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Amy Chan" }));

    const detail = screen.getByTestId("approval-review-detail");
    await waitFor(() => expect(detail).not.toHaveTextContent("King Su"));
    expect(detail).toHaveTextContent("Amy Chan");
  });

  it("uses the stronger shared surface for weekend days only", () => {
    const days = buildPeriodDays(2026, 7, "first");
    const saturday = days.find((day) => day.date === "2026-07-04");
    const thursday = days.find((day) => day.date === "2026-07-02");

    expect(saturday).toBeDefined();
    expect(thursday).toBeDefined();
  });

  it("preserves warning and destructive surfaces for workday exceptions", () => {
    render(
      <ApprovalReviewDashboard
        userId="manager-1"
        period="first"
        days={buildPeriodDays(2026, 7, "first")}
        records={[
          record("king", "King Su", "FIRST_HALF", "SUBMITTED", [
            row("king-first", "first", {
              "2026-07-02": 4,
              "2026-07-03": 25,
            }),
          ]),
        ]}
      />
    );

    const underfilledCell = screen.getByTestId(
      "approval-review-cell-king-2026-07-02"
    );
    expect(underfilledCell).toHaveAttribute(
      "data-review-cell-state",
      "underfilled"
    );

    const overfilledCell = screen.getByTestId(
      "approval-review-cell-king-2026-07-03"
    );
    expect(overfilledCell).toHaveAttribute(
      "data-review-cell-state",
      "overfilled"
    );
  });
});
