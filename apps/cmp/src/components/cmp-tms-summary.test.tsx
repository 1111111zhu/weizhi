import type { TmsEngagementSummary } from "@project-wing/shared";
// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CmpTmsSummary } from "./cmp-tms-summary";

const emptyRow = (userId: string, name: string) => ({
  userId,
  name,
  budgetNormal: null,
  budgetOt: null,
  finalNormal: null,
  finalOt: null,
  absent: null,
  rate: null,
  budgetCost: null,
  actualCost: null,
  diff: null,
});
const summary: TmsEngagementSummary = {
  approved: {
    rows: [
      {
        ...emptyRow("user-1", "King Su"),
        finalNormal: 8,
      },
    ],
    total: {
      ...emptyRow("total", "Total"),
      finalNormal: 8,
    },
  },
  draft: {
    rows: [
      {
        ...emptyRow("user-1", "King Su"),
        finalNormal: 4,
        finalOt: 2,
      },
    ],
    total: {
      ...emptyRow("total", "Total"),
      finalNormal: 4,
      finalOt: 2,
    },
  },
  periods: [
    {
      userId: "user-1",
      name: "King Su",
      year: 2026,
      month: 8,
      half: "FIRST_HALF",
      revision: 1,
      status: "APPROVED",
      bucket: "APPROVED",
      normal: 8,
      ot: 0,
      absent: 0,
      total: 8,
    },
    {
      userId: "user-1",
      name: "King Su",
      year: 2026,
      month: 8,
      half: "SECOND_HALF",
      revision: 1,
      status: "SUBMITTED",
      bucket: "DRAFT",
      normal: 4,
      ot: 2,
      absent: 0,
      total: 6,
    },
  ],
};

describe(CmpTmsSummary, () => {
  it("renders one person-first table with period status and a personal subtotal", () => {
    render(<CmpTmsSummary summary={summary} />);

    expect(
      screen.getByRole("table", {
        name: "TMS contribution by person and period",
      })
    ).toBeInTheDocument();
    for (const header of [
      "Name",
      "Period",
      "Status",
      "Normal hours",
      "OT hours",
      "Absent",
      "Hours total",
    ]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeVisible();
    }
    expect(screen.getAllByText("King Su")).toHaveLength(1);
    expect(screen.getByText("2026/08 · First half")).toBeVisible();
    expect(screen.getByText("2026/08 · Second half")).toBeVisible();
    expect(screen.getAllByText("Approved")).toHaveLength(2);
    expect(screen.getByText("Submitted")).toBeVisible();
    expect(
      screen.getByRole("row", {
        name: "Approved subtotal Approved 8.0 0.0 0.0 8.0",
      })
    ).toBeVisible();
    expect(
      screen.getByRole("row", {
        name: "Unapproved subtotal Unapproved 4.0 2.0 0.0 6.0",
      })
    ).toBeVisible();
  });

  it("shows a dash for null cells", () => {
    render(<CmpTmsSummary summary={summary} />);

    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});
