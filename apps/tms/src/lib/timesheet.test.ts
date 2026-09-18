import { describe, expect, test } from "vitest";

import {
  DETAILS_BY_TYPE,
  WORK_TYPES_BY_TYPE,
  addTimesheetRow,
  buildPeriodDays,
  calculateDailyHours,
  calculateDashboard,
  createInitialRows,
  createPendingTmsEngagement,
  findDuplicateChargeableRow,
  findEngagement,
  isDemoTimesheetRow,
  isTmsDemoPeriod,
  migrateTimesheetRows,
  syncRowsWithEngagementDirectory,
  updateTimesheetDescription,
  updateTimesheetHours,
  validateTimesheet,
} from "./timesheet";
import type { Engagement, TimesheetRow } from "./timesheet";

function expectPresent<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected value to be present");
  }
  return value;
}

const engagement: Engagement = {
  engagementId: "engagement-1",
  engagementCode: "ORC-2026-AUD",
  clientCode: "C-ORC-2026",
  clientName: "Orchid Technology Limited",
  budgetedHours: "420.00",
  agreedFee: "180000.00",
  recoveryRate: null,
  feeCurrency: "HKD",
  pic: "Jony Ma",
  mic: "Eden Chan",
  codeAliases: ["ORC-2025-AUD"],
  timesheetAccess: { allowed: true, reason: "ALLOWED" },
};

function legacyRow(
  id: string,
  type: "Normal" | "OT" | "Absent" | "Non-Chargeable" | "Leave",
  hoursByDate: Record<string, number>
) {
  return {
    ...engagement,
    id,
    type,
    hoursByDate,
    periodTotal: Object.values(hoursByDate).reduce(
      (total, hours) => total + hours,
      0
    ),
  };
}

describe("timesheet classified row model", () => {
  test("defines the approved Details for each Type", () => {
    expect(DETAILS_BY_TYPE).toStrictEqual({
      Chargeable: ["Normal", "OT", "Absent"],
      "Non-Chargeable": [
        "Internal Admin",
        "Business Development",
        "HR Function",
        "Idle or Unassigned",
        "Internal Event",
        "Technical & Training Dept Only",
        "Marketing",
        "Internal Training",
        "Others PRC Training",
        "PRC Training",
        "Resignation",
        "Others",
      ],
      Leave: [
        "Annual Leave",
        "Examination Leave",
        "O.T. Leave",
        "No Pay Leave",
        "Special Leave",
        "Public Holiday",
        "Sick Leave",
        "Study Leave",
      ],
    });
  });

  test("defines work Types separately from category Details", () => {
    expect(WORK_TYPES_BY_TYPE).toStrictEqual({
      Chargeable: ["Normal", "OT"],
      "Non-Chargeable": ["Normal", "OT"],
      Leave: ["Normal"],
    });
  });

  test("normalizes work Type independently from Non-Chargeable and Leave Details", () => {
    const rows = addTimesheetRow(
      addTimesheetRow([], {
        id: "marketing-ot",
        periodScope: "first",
        type: "Non-Chargeable",
        workType: "OT",
        details: "Marketing",
      }),
      {
        id: "leave-ot",
        periodScope: "first",
        type: "Leave",
        workType: "OT",
        details: "Annual Leave",
      }
    );

    expect(
      rows.map(({ workType, details }) => ({ workType, details }))
    ).toStrictEqual([
      { workType: "OT", details: "Marketing" },
      { workType: "Normal", details: "Annual Leave" },
    ]);
  });

  test("migrates explicit work Types with category-specific fallbacks", () => {
    const migrated = migrateTimesheetRows(
      [
        {
          ...legacyRow("charge-absent", "Normal", {}),
          type: "Chargeable",
          details: "Normal",
          workType: "Absent",
        },
        {
          ...legacyRow("nonchargeable-invalid", "Non-Chargeable", {}),
          details: "Marketing",
          workType: "Absent",
        },
        {
          ...legacyRow("leave-invalid", "Leave", {}),
          details: "Annual Leave",
          workType: "OT",
        },
      ],
      "first"
    );

    expect(
      migrated.map(({ type, workType, details }) => ({
        type,
        workType,
        details,
      }))
    ).toStrictEqual([
      { type: "Chargeable", workType: "Absent", details: "Normal" },
      { type: "Non-Chargeable", workType: "Normal", details: "Marketing" },
      { type: "Leave", workType: "Normal", details: "Annual Leave" },
    ]);
  });

  test("maps legacy Non-Chargeable and Leave details to the approved types", () => {
    const migrated = migrateTimesheetRows(
      [
        { ...legacyRow("admin", "Non-Chargeable", {}), details: "Admin" },
        { ...legacyRow("training", "Non-Chargeable", {}), details: "Training" },
        { ...legacyRow("outing", "Non-Chargeable", {}), details: "Outing" },
        { ...legacyRow("leave", "Leave", {}), details: "Non-pay leave" },
        {
          ...legacyRow("special-leave", "Leave", {}),
          details: "Special leave",
          description: "Typhoon",
        },
      ],
      "first"
    );

    expect(migrated.map((row) => [row.id, row.details])).toStrictEqual([
      ["admin", "Internal Admin"],
      ["training", "Internal Training"],
      ["outing", "Others"],
      ["leave", "No Pay Leave"],
      ["special-leave", "Special Leave"],
    ]);
  });

  test("keeps the existing Chargeable row when an exact duplicate is added", () => {
    const first = addTimesheetRow([], {
      id: "row-1",
      periodScope: "first",
      type: "Chargeable",
      details: "Normal",
      engagement,
    });
    const withHours = updateTimesheetHours(first, "row-1", "2026-07-01", 8);
    const rows = addTimesheetRow(withHours, {
      id: "row-2",
      periodScope: "first",
      type: "Chargeable",
      details: "Normal",
      engagement,
    });

    expect(rows).toBe(withHours);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "row-1",
      hoursByDate: { "2026-07-01": 8 },
      periodTotal: 8,
    });
  });

  test("finds an exact duplicate Chargeable row without changing it", () => {
    const rows = addTimesheetRow([], {
      id: "row-1",
      periodScope: "first",
      type: "Chargeable",
      details: "Normal",
      description: "Audit planning",
      engagement,
    });
    const duplicate = findDuplicateChargeableRow(rows, {
      id: "row-2",
      periodScope: "first",
      type: "Chargeable",
      details: "Normal",
      description: " Audit planning ",
      engagement,
    });

    expect(duplicate).toBe(rows[0]);
    expect(rows).toHaveLength(1);
  });

  test("keeps distinct Chargeable identity fields separate", () => {
    const rows = addTimesheetRow([], {
      id: "row-1",
      periodScope: "first",
      type: "Chargeable",
      details: "Normal",
      description: "Audit planning",
      engagement,
    });
    const input = {
      id: "row-2",
      periodScope: "first" as const,
      type: "Chargeable" as const,
      details: "Normal" as const,
      description: "Audit planning",
      engagement,
    };

    expect(
      findDuplicateChargeableRow(rows, { ...input, periodScope: "second" })
    ).toBeUndefined();
    expect(
      findDuplicateChargeableRow(rows, {
        ...input,
        engagement: { ...engagement, engagementId: "engagement-2" },
      })
    ).toBeUndefined();
    expect(
      findDuplicateChargeableRow(rows, { ...input, details: "OT" })
    ).toBeUndefined();
    expect(
      findDuplicateChargeableRow(rows, {
        ...input,
        description: "Audit fieldwork",
      })
    ).toMatchObject({ id: "row-1" });
  });

  test("adds Non-Chargeable and Leave rows without engagement data", () => {
    const rows = addTimesheetRow(
      addTimesheetRow([], {
        id: "admin-1",
        periodScope: "first",
        type: "Non-Chargeable",
        details: "Internal Admin",
      }),
      {
        id: "leave-1",
        periodScope: "first",
        type: "Leave",
        details: "Sick Leave",
      }
    );

    expect(rows[0]).toStrictEqual({
      id: "admin-1",
      periodScope: "first",
      type: "Non-Chargeable",
      workType: "Normal",
      details: "Internal Admin",
      description: "",
      hoursByDate: {},
      periodTotal: 0,
    });
    expect(rows[1]).toStrictEqual({
      id: "leave-1",
      periodScope: "first",
      type: "Leave",
      workType: "Normal",
      details: "Sick Leave",
      description: "",
      hoursByDate: {},
      periodTotal: 0,
    });
  });

  test("migrates old row types without losing ids or hours", () => {
    const legacy = [
      legacyRow("normal-1", "Normal", { "2026-07-01": 8 }),
      legacyRow("ot-1", "OT", { "2026-07-02": 2 }),
      legacyRow("absent-1", "Absent", { "2026-07-03": 8 }),
      legacyRow("admin-1", "Non-Chargeable", { "2026-07-06": 8 }),
      legacyRow("leave-1", "Leave", { "2026-07-07": 8 }),
    ];
    const migrated = migrateTimesheetRows(legacy, "first");

    expect(
      migrated.map(
        ({
          id,
          periodScope,
          type,
          workType,
          details,
          periodTotal,
          description,
        }) => ({
          id,
          periodScope,
          type,
          workType,
          details,
          periodTotal,
          description,
        })
      )
    ).toStrictEqual([
      {
        id: "normal-1",
        periodScope: "first",
        type: "Chargeable",
        workType: "Normal",
        details: "Normal",
        periodTotal: 8,
        description: "",
      },
      {
        id: "ot-1",
        periodScope: "first",
        type: "Chargeable",
        workType: "OT",
        details: "OT",
        periodTotal: 2,
        description: "",
      },
      {
        id: "absent-1",
        periodScope: "first",
        type: "Chargeable",
        workType: "Absent",
        details: "Absent",
        periodTotal: 8,
        description: "",
      },
      {
        id: "admin-1",
        periodScope: "first",
        type: "Non-Chargeable",
        workType: "Normal",
        details: "Internal Admin",
        periodTotal: 8,
        description: "",
      },
      {
        id: "leave-1",
        periodScope: "first",
        type: "Leave",
        workType: "Normal",
        details: "Annual Leave",
        periodTotal: 8,
        description: "",
      },
    ]);
    expect(migrateTimesheetRows(migrated, "first")).toStrictEqual(migrated);
  });

  test("infers legacy row scope and uses storage period as fallback", () => {
    const rows = migrateTimesheetRows(
      [
        legacyRow("second", "Normal", { "2026-07-16": 8 }),
        legacyRow("all", "Normal", {
          "2026-07-15": 8,
          "2026-07-16": 8,
        }),
        legacyRow("empty", "Normal", {}),
      ],
      "second"
    );

    expect(rows.map(({ id, periodScope }) => [id, periodScope])).toStrictEqual([
      ["second", "second"],
      ["all", "all"],
      ["empty", "second"],
    ]);
  });

  test("canonicalizes duplicate row ids while preserving hours from both copies", () => {
    const rows = migrateTimesheetRows(
      [
        legacyRow("duplicate", "Normal", { "2026-07-01": 8 }),
        legacyRow("duplicate", "Normal", { "2026-07-02": 7.5 }),
      ],
      "first"
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "duplicate",
      hoursByDate: { "2026-07-01": 8, "2026-07-02": 7.5 },
      periodTotal: 15.5,
    });
  });
});

describe("timesheet shared domain behavior", () => {
  test("builds first and second half month day lists", () => {
    expect(buildPeriodDays(2026, 7, "first")).toHaveLength(15);
    expect(buildPeriodDays(2026, 2, "second")).toHaveLength(13);
  });

  test("starts a period with no demonstration rows", () => {
    expect(createInitialRows(2026, 7, "first")).toStrictEqual([]);
  });

  test("creates a Chargeable row before a project code exists", () => {
    const pending = createPendingTmsEngagement();
    const rows = addTimesheetRow([], {
      id: "pending-1",
      periodScope: "first",
      type: "Chargeable",
      details: "Normal",
      engagement: pending,
    });

    expect(pending).toMatchObject({
      source: "TMS_PENDING",
      engagementId: "",
      projectId: null,
      engagementCode: "",
    });
    expect(rows[0]).toMatchObject({
      id: "pending-1",
      type: "Chargeable",
      source: "TMS_PENDING",
      engagementCode: "",
      clientName: "",
    });

    const second = addTimesheetRow(rows, {
      id: "pending-2",
      periodScope: "first",
      type: "Chargeable",
      details: "Normal",
      engagement: pending,
    });
    expect(second).toHaveLength(2);
  });

  test("keeps the July preview period and legacy demo rows identifiable", () => {
    expect(isTmsDemoPeriod(2026, 7, "first")).toBeTruthy();
    expect(isTmsDemoPeriod(2026, 7, "second")).toBeFalsy();
    expect(
      isDemoTimesheetRow({
        id: "100204-Normal",
        type: "Chargeable",
        engagementCode: "100204",
      } as TimesheetRow)
    ).toBeTruthy();
  });

  test("matches both the current CMP code and its previous-code alias", () => {
    expect(findEngagement("orc-2026-aud", [engagement])).toBe(engagement);
    expect(findEngagement("ORC-2025-AUD", [engagement])).toBe(engagement);
  });

  test("syncs only Chargeable rows with the CMP directory", () => {
    const rows = addTimesheetRow(
      addTimesheetRow([], {
        id: "charge-1",
        periodScope: "first",
        type: "Chargeable",
        details: "Normal",
        engagement,
      }),
      {
        id: "admin-1",
        periodScope: "first",
        type: "Non-Chargeable",
        details: "Internal Admin",
      }
    );
    const synced = syncRowsWithEngagementDirectory(rows, [
      { ...engagement, agreedFee: "200000.00" },
    ]);

    expect(synced[0]).toMatchObject({ agreedFee: "200000.00" });
    expect(synced[1]).toStrictEqual(rows[1]);
  });

  test("keeps denied Chargeable rows unchanged when hours are edited", () => {
    const rows = addTimesheetRow([], {
      id: "charge-1",
      periodScope: "first",
      type: "Chargeable",
      details: "Normal",
      engagement,
    }).map((row) =>
      row.type === "Chargeable"
        ? {
            ...row,
            timesheetAccess: {
              allowed: false,
              reason: "INDEPENDENCE_DECLARATION_REQUIRED" as const,
            },
          }
        : row
    );

    expect(updateTimesheetHours(rows, "charge-1", "2026-07-03", 8)).toBe(rows);
  });
});

describe("timesheet daily editing and validation", () => {
  const days = buildPeriodDays(2026, 7, "first");

  function rowsWithHours(
    chargeableHours = 6,
    nonChargeableHours = 2,
    leaveHours = 8
  ): TimesheetRow[] {
    return [
      {
        ...engagement,
        id: "charge-1",
        periodScope: "first" as const,
        type: "Chargeable" as const,
        details: "Normal" as const,
        description: "",
        hoursByDate: { "2026-07-01": chargeableHours },
        periodTotal: chargeableHours,
      },
      {
        id: "admin-1",
        periodScope: "first" as const,
        type: "Non-Chargeable" as const,
        details: "Internal Admin" as const,
        description: "",
        hoursByDate: { "2026-07-01": nonChargeableHours },
        periodTotal: nonChargeableHours,
      },
      {
        id: "leave-1",
        periodScope: "first" as const,
        type: "Leave" as const,
        details: "Annual Leave" as const,
        description: "",
        hoursByDate: { "2026-07-01": leaveHours },
        periodTotal: leaveHours,
      },
    ] satisfies TimesheetRow[];
  }

  function absentRow(hours: number): TimesheetRow {
    return {
      ...rowsWithHours()[0],
      id: "absent-1",
      details: "Absent",
      hoursByDate: { "2026-07-01": hours },
      periodTotal: hours,
    } as TimesheetRow;
  }

  test("edits only the target row Description", () => {
    const rows = rowsWithHours();
    const updated = updateTimesheetDescription(
      rows,
      "admin-1",
      "Internal planning"
    );

    expect(updated.find((row) => row.id === "admin-1")?.description).toBe(
      "Internal planning"
    );
    expect(updated.find((row) => row.id === "charge-1")?.description).toBe("");
  });

  test.each([
    ["8h Leave", rowsWithHours(0, 0, 8), 8],
    ["4h Chargeable and 4h Leave", rowsWithHours(4, 0, 4), 8],
    ["8h Absent", [absentRow(8)], 0],
    [
      "4h Chargeable and 4h Absent",
      [...rowsWithHours(4, 0, 0), absentRow(4)],
      4,
    ],
  ])(
    "includes leave in the daily total without counting absent hours",
    (_, rows, total) => {
      expect(calculateDailyHours(rows, days)[0]).toMatchObject({
        date: "2026-07-01",
        total,
        explainedTotal: 8,
      });
      expect(
        calculateDashboard(rows, days).completion.openDays
      ).not.toContainEqual(expect.objectContaining({ date: "2026-07-01" }));
    }
  );

  test("excludes explicit Absent hours from daily total while retaining explanation", () => {
    const rows: TimesheetRow[] = [
      {
        ...rowsWithHours()[0],
        details: "Normal" as const,
        workType: "Absent" as const,
        hoursByDate: { "2026-07-01": 8 },
        periodTotal: 8,
      } as TimesheetRow,
    ];

    expect(calculateDailyHours(rows, days)[0]).toMatchObject({
      total: 0,
      explainedTotal: 8,
      chargeable: 0,
    });
  });

  test.each([
    [7.75, true, "warning"],
    [8, false, undefined],
    [24, true, "warning"],
    [24.25, true, "error"],
  ] as const)(
    "validates counted daily hours at %s",
    (hours, shouldFail, severity) => {
      const rows = rowsWithHours().map<TimesheetRow>((row) => {
        const countedHours = row.id === "charge-1" ? hours : 0;
        const hoursByDate: Record<string, number> = {};
        if (countedHours) {
          hoursByDate["2026-07-01"] = countedHours;
        }
        if (row.type === "Chargeable" && row.id === "charge-1" && hours >= 24) {
          return {
            ...row,
            workType: "OT" as const,
            details: "OT" as const,
            hoursByDate,
            periodTotal: countedHours,
          };
        }
        return {
          ...row,
          hoursByDate,
          periodTotal: countedHours,
        };
      });
      const warning = validateTimesheet(rows, days).find(
        (item) => item.date === "2026-07-01"
      );
      expect(Boolean(warning)).toBe(shouldFail);
      expect(warning?.severity).toBe(severity);
    }
  );

  test("rejects Normal plus Leave above 8 hours on the same day", () => {
    const rows = rowsWithHours(8, 0, 1);

    expect(validateTimesheet(rows, days)).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: "2026-07-01",
          severity: "error",
          message: expect.stringContaining("Normal + Leave"),
        }),
      ])
    );
  });

  test("does not warn for a public holiday outside the 8-12 hour band", () => {
    const rows = rowsWithHours(0, 0, 2).map((row) =>
      row.id === "leave-1"
        ? { ...row, details: "Public Holiday" as const }
        : row
    ) as TimesheetRow[];

    expect(validateTimesheet(rows, days)).not.toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: "2026-07-01", severity: "warning" }),
      ])
    );
  });

  test("allows Non-Chargeable and Leave hours without CMP metadata", () => {
    const rows = rowsWithHours();
    const admin = updateTimesheetHours(rows, "admin-1", "2026-07-02", 4);
    const leave = updateTimesheetHours(admin, "leave-1", "2026-07-02", 8);

    expect(leave[1]?.hoursByDate["2026-07-02"]).toBe(4);
    expect(leave[2]?.hoursByDate["2026-07-02"]).toBe(8);
  });

  test("rejects Normal hours above 8 while allowing 8 and OT above 8", () => {
    const rows = rowsWithHours();
    const rejected = updateTimesheetHours(rows, "charge-1", "2026-07-02", 9);
    expect(rejected).toBe(rows);

    const accepted = updateTimesheetHours(rows, "charge-1", "2026-07-02", 8);
    expect(
      accepted.find((row) => row.id === "charge-1")?.hoursByDate["2026-07-02"]
    ).toBe(8);

    const otRow = {
      ...expectPresent(rows[0]),
      workType: "OT" as const,
      details: "OT" as const,
    } as TimesheetRow;
    const otRows = updateTimesheetHours([otRow], "charge-1", "2026-07-02", 9);
    expect(otRows[0]?.hoursByDate["2026-07-02"]).toBe(9);
  });

  test.each(["charge-1", "admin-1", "leave-1"])(
    "allows weekend hours for %s",
    (rowId) => {
      const updated = updateTimesheetHours(
        rowsWithHours(),
        rowId,
        "2026-07-04",
        4
      );

      expect(
        updated.find((row) => row.id === rowId)?.hoursByDate["2026-07-04"]
      ).toBe(4);
    }
  );
});
