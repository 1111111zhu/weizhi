import { describe, expect, it } from "vitest";

import {
  TmsApproveInputSchema,
  TmsSaveDraftInputSchema,
  TmsSubmitInputSchema,
  TmsTimesheetMonthSchema,
  TmsTimesheetRowSchema,
} from "./index.js";

describe("tMS server persistence contracts", () => {
  it("accepts editable submitted periods and locked approved periods", () => {
    const month = TmsTimesheetMonthSchema.parse({
      year: 2026,
      month: 7,
      rows: [],
      persistence: "SERVER",
      periods: {
        FIRST_HALF: { status: "SUBMITTED", revision: 2, editable: true },
        SECOND_HALF: { status: "APPROVED", revision: 1, editable: false },
      },
    });
    expect(month.periods.FIRST_HALF.editable).toBeTruthy();
    expect(month.periods.SECOND_HALF.editable).toBeFalsy();
  });

  it("requires explicit submit scope and approval revision", () => {
    expect(TmsSubmitInputSchema.parse({ scope: "ALL" })).toStrictEqual({
      scope: "ALL",
    });
    expect(
      TmsApproveInputSchema.parse({ expectedSubmittedRevision: 2 })
    ).toStrictEqual({
      expectedSubmittedRevision: 2,
    });
  });

  it("requires a complete rows payload for draft replacement", () => {
    expect(TmsSaveDraftInputSchema.parse({ rows: [] })).toStrictEqual({
      rows: [],
    });
  });

  it("rejects Normal daily hours above 8 but allows 8 and non-Normal hours above 8", () => {
    const normalRow = {
      id: "normal-row",
      periodScope: "first" as const,
      type: "Chargeable" as const,
      workType: "Normal" as const,
      details: "Normal",
      description: "",
      hoursByDate: { "2026-07-01": 8 },
      periodTotal: 8,
    };

    expect(() => TmsTimesheetRowSchema.parse(normalRow)).not.toThrow(/./);
    expect(() =>
      TmsTimesheetRowSchema.parse({
        ...normalRow,
        hoursByDate: { "2026-07-01": 9 },
        periodTotal: 9,
      })
    ).toThrow("Normal 工时每天不得超过 8 小时");
    expect(() =>
      TmsTimesheetRowSchema.parse({
        ...normalRow,
        workType: "OT",
        details: "OT",
        hoursByDate: { "2026-07-01": 9 },
        periodTotal: 9,
      })
    ).not.toThrow(/./);
  });

  it("rejects legacy Normal and implicit Leave hours above 8 while allowing OT", () => {
    expect(() =>
      TmsTimesheetRowSchema.parse({
        id: "legacy-normal-row",
        periodScope: "first" as const,
        type: "Chargeable" as const,
        workType: undefined,
        details: "Normal",
        description: "",
        hoursByDate: { "2026-07-01": 9 },
        periodTotal: 9,
      })
    ).toThrow("Normal 工时每天不得超过 8 小时");

    expect(() =>
      TmsTimesheetRowSchema.parse({
        id: "leave-row",
        periodScope: "first" as const,
        type: "Leave" as const,
        workType: undefined,
        details: "Annual Leave",
        description: "",
        hoursByDate: { "2026-07-01": 9 },
        periodTotal: 9,
      })
    ).toThrow("Normal 工时每天不得超过 8 小时");

    expect(() =>
      TmsTimesheetRowSchema.parse({
        id: "ot-row",
        periodScope: "first" as const,
        type: "Chargeable" as const,
        workType: "OT" as const,
        details: "OT",
        description: "",
        hoursByDate: { "2026-07-01": 9 },
        periodTotal: 9,
      })
    ).not.toThrow(/./);
  });
});
