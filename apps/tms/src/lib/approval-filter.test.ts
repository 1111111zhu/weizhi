import type {
  TmsApprovalProject,
  TmsApprovalRecord,
  TmsTimesheetRow,
} from "@project-wing/shared";
import { describe, expect, it } from "vitest";

import {
  recommendApprovalPeriod,
  selectApprovalGroups,
  selectApprovalProjects,
} from "./approval-filter";
import { buildPeriodDays } from "./timesheet";

function project(
  engagementId: string,
  overrides: Partial<TmsApprovalProject> = {}
): TmsApprovalProject {
  return {
    engagementId,
    engagementCode: engagementId.toUpperCase(),
    clientCode: `C-${engagementId}`,
    clientName: `${engagementId} client`,
    pic: null,
    mic: null,
    status: "ACTIVE",
    pendingCount: 0,
    returnedCount: 0,
    ...overrides,
  };
}

function completeRow(id: string, periodScope: "first" | "second") {
  const hoursByDate = Object.fromEntries(
    buildPeriodDays(2026, 7, periodScope)
      .filter((day) => day.isWorkday)
      .map((day) => [day.date, 8])
  );
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
  } satisfies TmsTimesheetRow;
}

function record(
  id: string,
  ownerUserId: string,
  ownerName: string,
  half: TmsApprovalRecord["half"],
  status: TmsApprovalRecord["status"],
  submittedRows: TmsApprovalRecord["submittedRows"] = []
): TmsApprovalRecord {
  return {
    id,
    ownerUserId,
    ownerName,
    ownerEmail: `${ownerUserId}@example.com`,
    year: 2026,
    month: 7,
    half,
    engagementId: "engagement-1",
    engagementCode: "HBR-2026-ACC",
    projectId: "project-1",
    projectCode: "HBR-PROJECT-01",
    projectName: "Annual audit",
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

describe("approval filter model", () => {
  it("keeps the same employee in separate EMP project approval groups", () => {
    const firstProject = record(
      "jony-project-1",
      "jony",
      "Jony Ma",
      "FIRST_HALF",
      "SUBMITTED"
    );
    const secondProject = {
      ...record("jony-project-2", "jony", "Jony Ma", "FIRST_HALF", "SUBMITTED"),
      projectId: "project-2",
      projectCode: "HBR-PROJECT-02",
      projectName: "Tax support",
    };

    const groups = selectApprovalGroups(
      [firstProject, secondProject],
      "first",
      [],
      []
    );

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.projectId)).toStrictEqual([
      "project-1",
      "project-2",
    ]);
  });

  it("excludes archived CMP engagements from approval", () => {
    const projects = [
      {
        engagementId: "active",
        engagementCode: "ACTIVE",
        clientCode: "C-ACTIVE",
        clientName: "Active client",
        pic: null,
        mic: null,
        status: "ACTIVE",
        pendingCount: 0,
        returnedCount: 0,
      },
      {
        engagementId: "pending",
        engagementCode: "PENDING",
        clientCode: "C-PENDING",
        clientName: "Pending client",
        pic: null,
        mic: null,
        status: "COMPLETED",
        pendingCount: 2,
        returnedCount: 0,
      },
      {
        engagementId: "returned",
        engagementCode: "RETURNED",
        clientCode: "C-RETURNED",
        clientName: "Returned client",
        pic: null,
        mic: null,
        status: "INACTIVE",
        pendingCount: 0,
        returnedCount: 1,
      },
      {
        engagementId: "archived",
        engagementCode: "ARCHIVED",
        clientCode: "C-ARCHIVED",
        clientName: "Archived client",
        pic: null,
        mic: null,
        status: "ARCHIVED",
        pendingCount: 1,
        returnedCount: 1,
      },
    ] satisfies TmsApprovalProject[];

    expect(
      selectApprovalProjects(projects).map(
        (candidate) => candidate.engagementId
      )
    ).toStrictEqual(["active", "pending", "returned"]);
  });

  it("uses pendingCount as the pending-only boundary, not returnedCount", () => {
    const projects = [
      project("pending-one", { pendingCount: 1, returnedCount: 0 }),
      project("returned-one", { pendingCount: 0, returnedCount: 1 }),
      project("empty", { pendingCount: 0, returnedCount: 0 }),
      project("archived-pending", {
        status: "ARCHIVED",
        pendingCount: 1,
        returnedCount: 1,
      }),
    ];
    const activeProjects = selectApprovalProjects(projects);
    expect(activeProjects.map((item) => item.engagementId)).toStrictEqual([
      "pending-one",
      "returned-one",
      "empty",
    ]);
    expect(
      activeProjects
        .filter((item) => item.pendingCount > 0)
        .map((item) => item.engagementId)
    ).toStrictEqual(["pending-one"]);
  });

  it("preserves the input order for visible CMP engagements", () => {
    const projects = [
      project("zulu"),
      project("archived", { status: "ARCHIVED" }),
      project("alpha"),
      project("alpha-2"),
      project("bravo"),
    ];

    expect(
      selectApprovalProjects(projects).map((item) => item.engagementId)
    ).toStrictEqual(["zulu", "alpha", "alpha-2", "bravo"]);
    expect(projects.map((item) => item.engagementId)).toStrictEqual([
      "zulu",
      "archived",
      "alpha",
      "alpha-2",
      "bravo",
    ]);
  });

  it("filters each employee half independently while keeping All", () => {
    const records = [
      record("jony-first", "jony", "Jony Ma", "FIRST_HALF", "NOT_SUBMITTED"),
      record("jony-second", "jony", "Jony Ma", "SECOND_HALF", "SUBMITTED", [
        completeRow("jony-second-row", "second"),
      ]),
      record("amy-first", "amy", "Amy Chan", "FIRST_HALF", "SUBMITTED", [
        completeRow("amy-first-row", "first"),
      ]),
      record("amy-second", "amy", "Amy Chan", "SECOND_HALF", "NOT_SUBMITTED"),
    ];

    expect(recommendApprovalPeriod(records, ["NOT_SUBMITTED"], [])).toBe("all");
    const groups = selectApprovalGroups(records, "all", ["NOT_SUBMITTED"], []);

    expect(groups).toHaveLength(2);
    expect(
      groups.map((group) => group.records.map((item) => item.id))
    ).toStrictEqual([["jony-first"], ["amy-second"]]);
    expect(groups.map((group) => group.matchedHalves)).toStrictEqual([
      ["FIRST_HALF"],
      ["SECOND_HALF"],
    ]);
  });

  it("recommends the only matching half for any single or multi-status selection", () => {
    const records = [
      record("jony-first", "jony", "Jony Ma", "FIRST_HALF", "SUBMITTED", [
        completeRow("jony-first-row", "first"),
      ]),
      record("jony-second", "jony", "Jony Ma", "SECOND_HALF", "APPROVED"),
    ];

    expect(recommendApprovalPeriod(records, ["SUBMITTED"], [])).toBe("first");
    expect(
      recommendApprovalPeriod(records, ["SUBMITTED", "APPROVED"], [])
    ).toBe("all");
  });

  it("treats a missing half record as an unsubmitted half", () => {
    const records = [
      record("jony-first", "jony", "Jony Ma", "FIRST_HALF", "SUBMITTED", [
        completeRow("jony-first-row", "first"),
      ]),
    ];

    expect(recommendApprovalPeriod(records, ["NOT_SUBMITTED"], [])).toBe(
      "second"
    );
    const groups = selectApprovalGroups(records, "all", ["NOT_SUBMITTED"], []);
    expect(groups).toHaveLength(1);
    expect(groups[0].records).toHaveLength(0);
    expect(groups[0].matchedHalves).toStrictEqual(["SECOND_HALF"]);
    expect(
      selectApprovalGroups(records, "second", ["NOT_SUBMITTED"], [])
    ).toMatchObject([
      {
        allRecords: [],
        matchedHalves: ["SECOND_HALF"],
      },
    ]);
  });

  it("treats workdays with zero submitted hours as unsubmitted", () => {
    const records = [
      record("jony-second", "jony", "Jony Ma", "SECOND_HALF", "SUBMITTED", [
        {
          id: "row-second",
          periodScope: "second",
          type: "Chargeable",
          details: "Normal",
          description: "Fieldwork",
          hoursByDate: { "2026-07-16": 8 },
          periodTotal: 8,
        },
      ]),
    ];

    expect(recommendApprovalPeriod(records, ["NOT_SUBMITTED"], [])).toBe("all");
    expect(
      selectApprovalGroups(records, "second", ["NOT_SUBMITTED"], [])
    ).toMatchObject([
      {
        records: [{ id: "jony-second" }],
        matchedHalves: ["SECOND_HALF"],
      },
    ]);
  });

  it("does not let a missing other half escape a selected Period", () => {
    const records = [
      record("jony-first", "jony", "Jony Ma", "FIRST_HALF", "SUBMITTED", [
        completeRow("jony-first-row", "first"),
      ]),
    ];

    expect(
      selectApprovalGroups(records, "first", ["NOT_SUBMITTED"], [])
    ).toHaveLength(0);
  });
});
