import { describe, expect, it } from "vitest";

import {
  CreateCmpBillingBankTemplateSchema,
  CreateCmpBillingFirmTemplateSchema,
  UpdateCmpBillingSchema,
  UpdateCmpBillingBankTemplateSchema,
  UpdateCmpBillingFirmTemplateSchema,
} from "./index";

describe("CMP billing template contracts", () => {
  it("normalizes named firm and bank templates without retaining a fax field", () => {
    const firm = CreateCmpBillingFirmTemplateSchema.parse({
      name: "  WZ Hong Kong  ",
      firmLegalNameZh: "维致（香港）会计师事务所",
      firmLegalNameEn: "Wing Zenith",
    });
    const bank = CreateCmpBillingBankTemplateSchema.parse({
      name: "Primary Accounts",
      hkdAccountNumber: "001-123456-001",
      hkdSwiftCode: "WZHKHKHH",
    });

    expect(firm.name).toBe("WZ Hong Kong");
    expect(firm).not.toHaveProperty("fax");
    expect(bank.hkdSwiftCode).toBe("WZHKHKHH");
    expect(bank).not.toHaveProperty("fax");
  });

  it("requires a changed field as well as a version for concurrent updates", () => {
    expect(
      UpdateCmpBillingFirmTemplateSchema.safeParse({ expectedVersion: 2 })
        .success
    ).toBe(false);
    expect(
      UpdateCmpBillingBankTemplateSchema.safeParse({
        expectedVersion: 2,
        isDefault: true,
      }).success
    ).toBe(true);
  });

  it("keeps template provenance separate from the editable billing document", () => {
    const input = UpdateCmpBillingSchema.safeParse({
      expectedVersion: 3,
      localizedContent: {
        "zh-CN": {
          recipientName: "維致客戶",
          recipientAttention: "董事",
          recipientSalutation: "貴公司",
          recipientAddress: "香港",
          serviceDescription: "",
          lineItemDescriptions: {},
          signatoryName: "Jony Ma",
          bankPayeeName: "",
          bankName: "",
          firmLegalName: "Wing Zenith",
          firmAddress: "香港",
        },
        "en-US": {
          recipientName: "Wing Zenith Client",
          recipientAttention: "Director",
          recipientSalutation: "Your company",
          recipientAddress: "Hong Kong",
          serviceDescription: "",
          lineItemDescriptions: {},
          signatoryName: "Jony Ma",
          bankPayeeName: "",
          bankName: "",
          firmLegalName: "Wing Zenith",
          firmAddress: "Hong Kong",
        },
      },
      importAudit: {
        sources: ["CMP", "FIRM_TEMPLATE"],
        fieldKeys: ["recipientName", "firm.firmLegalNameEn"],
        firmTemplateId: "firm-1",
      },
    });

    expect(input.success).toBe(true);
    if (input.success) {
      expect(input.data).not.toHaveProperty("templateValues");
      expect(input.data.importAudit?.firmTemplateId).toBe("firm-1");
    }
  });
});
