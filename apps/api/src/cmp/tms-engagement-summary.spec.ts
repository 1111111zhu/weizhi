import type {
  TmsEngagementSummaryRow,
  TmsTimesheetRow,
} from "@project-wing/shared";

import { buildTmsEngagementSummary } from "./tms-engagement-summary";
import type {
  TmsSummaryApprovalRecord,
  TmsSummaryMember,
} from "./tms-engagement-summary";

function row(
  id: string,
  details: "Normal" | "OT" | "Absent",
  hoursByDate: Record<string, number>,
  engagementId = "engagement-1"
) {
  return {
    id,
    engagementId,
    periodScope: "all" as const,
    type: "Chargeable" as const,
    details,
    description: "",
    hoursByDate,
    periodTotal: Object.values(hoursByDate).reduce(
      (total, hours) => total + hours,
      0
    ),
  } as TmsTimesheetRow & { engagementId: string };
}

function approvalRecord(
  overrides: Partial<TmsSummaryApprovalRecord>
): TmsSummaryApprovalRecord {
  return {
    userId: "staff-1",
    name: "Staff One",
    year: 2026,
    month: 7,
    half: "FIRST_HALF",
    revision: 1,
    status: "APPROVED",
    rows: [],
    ...overrides,
  };
}

const members: TmsSummaryMember[] = [
  { userId: "staff-1", name: "Staff One" },
  { userId: "staff-2", name: "Staff Two" },
];

describe("tMS engagement summary aggregation", () => {
  it("uses only the latest revision and keeps the same employee in both sections", () => {
    const result = buildTmsEngagementSummary({
      engagementId: "engagement-1",
      members,
      approvalRecords: [
        approvalRecord({
          userId: "staff-1",
          revision: 1,
          status: "APPROVED",
          rows: [row("approved-old", "Normal", { "2026-07-01": 8 })],
        }),
        approvalRecord({
          userId: "staff-1",
          revision: 2,
          status: "SUBMITTED",
          rows: [
            row("draft-current", "Normal", { "2026-07-01": 10 }),
            row("draft-ot", "OT", { "2026-07-02": 2 }),
          ],
        }),
        approvalRecord({
          userId: "staff-1",
          half: "SECOND_HALF",
          revision: 1,
          status: "APPROVED",
          rows: [row("approved-second", "Normal", { "2026-07-16": 6 })],
        }),
      ],
      directSubmissions: [],
    });

    expect(
      result.approved.rows.find(
        (item: TmsEngagementSummaryRow) => item.userId === "staff-1"
      )
    ).toMatchObject({
      finalNormal: 6,
      finalOt: null,
    });
    expect(
      result.draft.rows.find(
        (item: TmsEngagementSummaryRow) => item.userId === "staff-1"
      )
    ).toMatchObject({
      finalNormal: 10,
      finalOt: 2,
    });
    expect(result.periods).toStrictEqual([
      expect.objectContaining({
        userId: "staff-1",
        half: "FIRST_HALF",
        revision: 2,
        status: "SUBMITTED",
        bucket: "DRAFT",
        normal: 10,
        ot: 2,
        total: 12,
      }),
      expect.objectContaining({
        userId: "staff-1",
        half: "SECOND_HALF",
        status: "APPROVED",
        bucket: "APPROVED",
        normal: 6,
        total: 6,
      }),
    ]);
  });

  it("sums Normal, OT, and Absent and keeps members without data as dashes", () => {
    const result = buildTmsEngagementSummary({
      engagementId: "engagement-1",
      members,
      approvalRecords: [
        approvalRecord({
          rows: [
            row("normal", "Normal", { "2026-07-01": 8, "2026-07-02": 2 }),
            row("ot", "OT", { "2026-07-03": 1 }),
            row("absent", "Absent", { "2026-07-04": 4 }),
          ],
        }),
      ],
      directSubmissions: [],
    });

    expect(
      result.approved.rows.find(
        (item: TmsEngagementSummaryRow) => item.userId === "staff-1"
      )
    ).toMatchObject({
      finalNormal: 10,
      finalOt: 1,
      absent: 4,
    });
    expect(
      result.approved.rows.find(
        (item: TmsEngagementSummaryRow) => item.userId === "staff-2"
      )
    ).toMatchObject({
      finalNormal: null,
      finalOt: null,
      absent: null,
    });
    expect(result.approved.total).toMatchObject({
      finalNormal: 10,
      finalOt: 1,
      absent: 4,
    });
  });

  it("prefers workType over legacy details when aggregating", () => {
    const result = buildTmsEngagementSummary({
      engagementId: "engagement-1",
      members,
      approvalRecords: [
        approvalRecord({
          rows: [
            {
              ...row("work-type", "Normal", { "2026-07-01": 8 }),
              workType: "OT",
            },
          ],
        }),
      ],
      directSubmissions: [],
    });

    expect(result.approved.total).toMatchObject({
      finalNormal: null,
      finalOt: 8,
      absent: null,
    });
  });

  it("puts direct submitted rows into Approved", () => {
    const result = buildTmsEngagementSummary({
      engagementId: "engagement-1",
      members,
      approvalRecords: [],
      directSubmissions: [
        approvalRecord({
          userId: "staff-2",
          name: "Staff Two",
          status: "SUBMITTED",
          rows: [row("direct", "Normal", { "2026-07-10": 8 })],
        }),
      ],
    });

    expect(
      result.approved.rows.find(
        (item: TmsEngagementSummaryRow) => item.userId === "staff-2"
      )
    ).toMatchObject({
      finalNormal: 8,
    });
    expect(
      result.draft.rows.find(
        (item: TmsEngagementSummaryRow) => item.userId === "staff-2"
      )
    ).toMatchObject({
      finalNormal: null,
    });
    expect(result.periods).toContainEqual(
      expect.objectContaining({
        userId: "staff-2",
        status: "SUBMITTED",
        bucket: "APPROVED",
        total: 8,
      })
    );
  });

  it("does not include rows from another or missing engagement", () => {
    const otherEngagement = approvalRecord({
      userId: "other-project-user",
      name: "Other Project User",
      rows: [row("other", "Normal", { "2026-07-01": 99 }, "engagement-2")],
    });
    const unscopedRow = row("unscoped", "Normal", { "2026-07-02": 77 });
    delete (unscopedRow as { engagementId?: string }).engagementId;

    const result = buildTmsEngagementSummary({
      engagementId: "engagement-1",
      members,
      approvalRecords: [otherEngagement],
      directSubmissions: [
        approvalRecord({
          userId: "unscoped-user",
          name: "Unscoped User",
          status: "SUBMITTED",
          rows: [unscopedRow],
        }),
      ],
    });

    expect(result.approved.rows.map((item) => item.userId)).not.toStrictEqual(
      expect.arrayContaining(["other-project-user", "unscoped-user"])
    );
    expect(result.approved.total).toMatchObject({
      finalNormal: null,
      finalOt: null,
      absent: null,
    });
  });
});
