import { describe, expect, it, vi } from "vitest";

import { CmpBillingService } from "./cmp-billing.service";

describe("CmpBillingService collection overview", () => {
  it("converts all visible engagement fees and bank receipts into HKD", async () => {
    const prisma = {
      cmpEngagement: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "eng-cny",
            engagementCode: "ENG-CNY",
            agreedFee: "100.00",
            feeCurrency: "CNY",
            serviceType: "AUDIT",
            status: "ACTIVE",
            client: {
              clientCode: "CL-CNY",
              nameZh: "人民币客户",
              nameEn: "CNY Client",
            },
          },
          {
            id: "eng-usd",
            engagementCode: "ENG-USD",
            agreedFee: "100.00",
            feeCurrency: "USD",
            serviceType: "AUDIT",
            status: "ACTIVE",
            client: {
              clientCode: "CL-USD",
              nameZh: "美元客户",
              nameEn: "USD Client",
            },
          },
        ]),
      },
      cmpBilling: {
        findMany: vi.fn().mockResolvedValue([
          {
            currency: "CNY",
            financeReceipts: [{ billCurrencyAmount: "50.00" }],
            engagement: {
              feeCurrency: "CNY",
              feeExchangeRateHkdPerUnit: null,
            },
          },
          {
            currency: "USD",
            financeReceipts: [{ billCurrencyAmount: "50.00" }],
            engagement: {
              feeCurrency: "USD",
              feeExchangeRateHkdPerUnit: null,
            },
          },
        ]),
      },
    };
    const service = new CmpBillingService(
      prisma as never,
      { log: vi.fn() } as never,
      {} as never,
      {} as never
    );

    const overview = await (
      service as unknown as {
        collectionOverview: (user: {
          id: string;
          globalRole: string;
        }) => Promise<{
          scope: string;
          currency: string;
          agreedFee: string;
          actualReceived: string;
          outstanding: string;
          receivedRate: string | null;
        }>;
      }
    ).collectionOverview({ id: "finance-1", globalRole: "MANAGER" });

    expect(overview).toMatchObject({
      scope: "ALL",
      currency: "HKD",
      agreedFee: "893.44",
      actualReceived: "446.72",
      outstanding: "446.72",
      receivedRate: "50.00",
    });
  });

  it("keeps one selected Engagement in its own fee currency", async () => {
    const selectedEngagement = {
      id: "eng-cny",
      engagementCode: "ENG-CNY",
      agreedFee: "100.00",
      feeCurrency: "CNY",
      serviceType: "AUDIT",
      status: "ACTIVE",
      picUserId: null,
      micUserId: null,
      client: {
        clientCode: "CL-CNY",
        nameZh: "人民币客户",
        nameEn: "CNY Client",
      },
    };
    const prisma = {
      cmpEngagement: {
        findUnique: vi.fn().mockResolvedValue(selectedEngagement),
      },
      cmpBilling: {
        findMany: vi.fn().mockResolvedValue([
          {
            currency: "CNY",
            financeReceipts: [{ billCurrencyAmount: "50.00" }],
          },
        ]),
      },
    };
    const service = new CmpBillingService(
      prisma as never,
      { log: vi.fn() } as never,
      {} as never,
      {} as never
    );

    const overview = await (
      service as unknown as {
        collectionOverview: (
          user: { id: string; globalRole: string },
          engagementId: string
        ) => Promise<{
          scope: string;
          currency: string;
          agreedFee: string;
          actualReceived: string;
          outstanding: string;
          receivedRate: string | null;
          engagement: { engagementCode: string } | null;
        }>;
      }
    ).collectionOverview({ id: "finance-1", globalRole: "MANAGER" }, "eng-cny");

    expect(overview).toMatchObject({
      scope: "ENGAGEMENT",
      currency: "CNY",
      agreedFee: "100.00",
      actualReceived: "50.00",
      outstanding: "50.00",
      receivedRate: "50.00",
      engagement: { engagementCode: "ENG-CNY" },
    });
  });
});

describe("CmpBillingService billing import audit", () => {
  it("only records template fields when their active source template is identified", async () => {
    const prisma = {
      cmpBillingFirmTemplate: {
        findUnique: vi.fn().mockResolvedValue({ status: "ACTIVE" }),
      },
      cmpBillingBankTemplate: {
        findUnique: vi.fn(),
      },
    };
    const service = new CmpBillingService(
      prisma as never,
      { log: vi.fn() } as never,
      {} as never,
      {} as never
    );
    const validate = (
      service as unknown as {
        validateImportAudit: (input: unknown) => Promise<void>;
      }
    ).validateImportAudit.bind(service);

    await expect(
      validate({
        sources: ["CMP", "FIRM_TEMPLATE"],
        fieldKeys: ["recipientName", "firm.phone"],
        firmTemplateId: "firm-1",
      })
    ).resolves.toBeUndefined();
    expect(prisma.cmpBillingFirmTemplate.findUnique).toHaveBeenCalledWith({
      where: { id: "firm-1" },
      select: { status: true },
    });
  });

  it("rejects a field that claims a source it did not use", async () => {
    const service = new CmpBillingService(
      {} as never,
      { log: vi.fn() } as never,
      {} as never,
      {} as never
    );
    const validate = (
      service as unknown as {
        validateImportAudit: (input: unknown) => Promise<void>;
      }
    ).validateImportAudit.bind(service);

    await expect(
      validate({
        sources: ["CMP"],
        fieldKeys: ["bank.hkdSwiftCode"],
      })
    ).rejects.toThrow("Bank fields require a bank template source");
  });
});
