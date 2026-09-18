import { describe, expect, it } from "vitest";

import {
  CreateCmpEngagementFeeNoteSchema,
  CmpEngagementFeeNoteCollectionStatusEnum,
} from "./index.js";

describe("CMP fee note periods", () => {
  it("requires a numbered period, planned date, and non-negative planned amount", () => {
    expect(
      CreateCmpEngagementFeeNoteSchema.safeParse({
        periodNumber: 2,
        plannedIssueDate: "2026-09-30",
        plannedAmount: "12000.00",
      }).success
    ).toBe(true);
    expect(
      CreateCmpEngagementFeeNoteSchema.safeParse({
        periodNumber: 0,
        plannedIssueDate: "",
        plannedAmount: "-1.00",
      }).success
    ).toBe(false);
    expect(CmpEngagementFeeNoteCollectionStatusEnum.options).toEqual([
      "UNISSUED",
      "UNRECORDED",
      "OUTSTANDING",
      "PARTIALLY_RECEIVED",
      "RECEIVED",
    ]);
  });
});
