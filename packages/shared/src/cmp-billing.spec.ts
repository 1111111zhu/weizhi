import { describe, expect, it } from "vitest";

import {
  CmpBillingCollectionOverviewSchema,
  CmpBillingClientPaymentClaimSchema,
  CmpBillingFinanceReceiptSchema,
  CmpBillingMarkSentSchema,
  CmpBillingStatusSchema,
  CreateCmpBillingSchema,
} from "./index";

describe("CMP billing contracts", () => {
  it("accepts a bound draft with independent bilingual line descriptions", () => {
    expect(
      CreateCmpBillingSchema.parse({
        engagementId: "engagement-1",
        issueDate: "2026-08-28",
        currency: "HKD",
        lineItems: [
          {
            descriptionZh: "审计服务",
            descriptionEn: "Audit services",
            amount: "1200.00",
          },
        ],
      })
    ).toMatchObject({
      engagementId: "engagement-1",
      lineItems: [
        {
          descriptionZh: "审计服务",
          descriptionEn: "Audit services",
          amount: "1200.00",
        },
      ],
    });
  });

  it("requires concrete business fields while allowing the server to own finance exchange rates", () => {
    expect(
      CreateCmpBillingSchema.safeParse({
        engagementId: "engagement-1",
        lineItems: [],
      }).success
    ).toBeFalsy();
    expect(
      CmpBillingMarkSentSchema.safeParse({ expectedVersion: 1, method: "" })
        .success
    ).toBeFalsy();
    expect(
      CmpBillingClientPaymentClaimSchema.safeParse({
        expectedVersion: 1,
        amount: "100.00",
        currency: "HKD",
        paidAt: "2026-08-28",
        reference: "",
      }).success
    ).toBeFalsy();
    expect(
      CmpBillingFinanceReceiptSchema.safeParse({
        expectedVersion: 1,
        amount: "100.00",
        currency: "HKD",
        receiptDate: "2026-08-28",
        bankReference: "BANK-1",
        exchangeRateToBill: "not-a-rate",
      }).success
    ).toBeFalsy();
    expect(
      CmpBillingFinanceReceiptSchema.safeParse({
        expectedVersion: 1,
        amount: "100.00",
        currency: "HKD",
        receiptDate: "2026-08-28",
        bankReference: "BANK-1",
      }).success
    ).toBeTruthy();
  });

  it("keeps the workflow state machine closed to the six billing states", () => {
    expect(CmpBillingStatusSchema.options).toStrictEqual([
      "DRAFT",
      "SUBMITTED",
      "APPROVED",
      "SENT",
      "CLIENT_PAID",
      "RECONCILED",
    ]);
    expect(CmpBillingStatusSchema.safeParse("VOIDED").success).toBeFalsy();
  });

  it("describes a collection overview with a nullable ratio for zero agreed fees", () => {
    expect(
      CmpBillingCollectionOverviewSchema.parse({
        scope: "ENGAGEMENT",
        currency: "HKD",
        agreedFee: "0.00",
        actualReceived: "0.00",
        outstanding: "0.00",
        receivedRate: null,
        overReceived: "0.00",
        engagement: {
          id: "engagement-1",
          engagementCode: "ENG-2026-001",
          clientCode: "CL-001",
          clientName: "Example Client",
          serviceType: "AUDIT",
          status: "ACTIVE",
        },
      })
    ).toMatchObject({
      scope: "ENGAGEMENT",
      receivedRate: null,
    });
  });
});
