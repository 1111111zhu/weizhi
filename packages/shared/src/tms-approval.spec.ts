import { describe, expect, it } from "vitest";

import {
  GlobalRoleSchema,
  TmsApprovalActionInputSchema,
  TmsApprovalEditInputSchema,
  TmsApprovalLockSchema,
  TmsApprovalProjectSchema,
  TmsApprovalRecordSchema,
  TmsApprovalReturnInputSchema,
  TmsApprovalStatusSchema,
} from "./index.js";

describe("tMS project approval contracts", () => {
  it("removes Senior Manager from the global role contract", () => {
    expect(GlobalRoleSchema.safeParse("SENIOR_MANAGER").success).toBeFalsy();
    expect(GlobalRoleSchema.parse("MANAGER")).toBe("MANAGER");
  });

  it("accepts a project-scoped submitted approval snapshot", () => {
    const record = TmsApprovalRecordSchema.parse({
      id: "approval-1",
      ownerUserId: "staff-1",
      ownerName: "Staff One",
      ownerEmail: "staff@example.com",
      year: 2026,
      month: 7,
      half: "FIRST_HALF",
      engagementId: "engagement-1",
      engagementCode: "HBR-2026-AUD",
      projectId: "project-1",
      projectCode: "HBR-AUD-01",
      projectName: "Annual audit",
      clientCode: "HBR-2026",
      clientName: "Harbour Retail Limited",
      revision: 1,
      status: "SUBMITTED",
      submittedRows: [],
      submittedAt: "2026-07-15T10:00:00.000Z",
      reviewedById: null,
      reviewedAt: null,
      returnReason: null,
    });

    expect(record.engagementId).toBe("engagement-1");
    expect(record.status).toBe("SUBMITTED");
  });

  it("exposes the engagement lifecycle on approval project cards", () => {
    expect(
      TmsApprovalProjectSchema.parse({
        engagementId: "engagement-1",
        engagementCode: "HBR-2026-AUD",
        clientCode: "HBR-2026",
        clientName: "Harbour Retail Limited",
        pic: "Partner",
        mic: "Manager",
        status: "ARCHIVED",
        pendingCount: 0,
        returnedCount: 0,
        projectCount: 2,
      }).status
    ).toBe("ARCHIVED");
  });

  it("allows a return without a reason", () => {
    expect(
      TmsApprovalReturnInputSchema.parse({ expectedRevision: 1 })
    ).toStrictEqual({ expectedRevision: 1 });
    expect(
      TmsApprovalReturnInputSchema.parse({ expectedRevision: 1, reason: "  " })
    ).toStrictEqual({ expectedRevision: 1, reason: "" });
    expect(
      TmsApprovalReturnInputSchema.parse({
        expectedRevision: 1,
        reason: "Please correct the hours on 7 July.",
      })
    ).toStrictEqual({
      expectedRevision: 1,
      reason: "Please correct the hours on 7 July.",
    });
  });

  it("requires an expected revision for approval", () => {
    expect(TmsApprovalActionInputSchema.safeParse({}).success).toBeFalsy();
    expect(
      TmsApprovalActionInputSchema.parse({ expectedRevision: 2 })
    ).toStrictEqual({
      expectedRevision: 2,
    });
  });

  it("accepts a restore status when undoing an approval", () => {
    expect(
      TmsApprovalActionInputSchema.parse({
        expectedRevision: 2,
        restoreStatus: "PENDING_CONFIRMATION",
      })
    ).toStrictEqual({
      expectedRevision: 2,
      restoreStatus: "PENDING_CONFIRMATION",
    });
  });

  it("accepts baseline and pending-confirmation approval states", () => {
    expect(TmsApprovalStatusSchema.parse("NOT_SUBMITTED")).toBe(
      "NOT_SUBMITTED"
    );
    expect(TmsApprovalStatusSchema.parse("PENDING_CONFIRMATION")).toBe(
      "PENDING_CONFIRMATION"
    );
    expect(TmsApprovalStatusSchema.safeParse("UNKNOWN").success).toBeFalsy();
  });

  it("defaults return feedback fields on approval locks", () => {
    const lock = TmsApprovalLockSchema.parse({
      engagementId: "engagement-1",
      half: "FIRST_HALF",
      status: "RETURNED",
      lockAll: false,
      lockedCells: [],
    });

    expect(lock.returnedCells).toStrictEqual([]);
    expect(lock.returnReason).toBeNull();
    expect(
      TmsApprovalLockSchema.parse({
        ...lock,
        returnedCells: [{ rowId: "row-1", date: "2026-07-03" }],
        returnReason: "Please correct the hours.",
      })
    ).toMatchObject({
      returnedCells: [{ rowId: "row-1", date: "2026-07-03" }],
      returnReason: "Please correct the hours.",
    });
  });

  it("accepts an edited submitted snapshot with the expected revision", () => {
    expect(
      TmsApprovalEditInputSchema.parse({
        expectedRevision: 3,
        rows: [
          {
            id: "row-1",
            periodScope: "first",
            type: "Chargeable",
            details: "Normal",
            description: "Fieldwork",
            hoursByDate: { "2026-07-03": 7.5 },
            periodTotal: 7.5,
          },
        ],
      })
    ).toMatchObject({ expectedRevision: 3, rows: [{ id: "row-1" }] });
  });
});
