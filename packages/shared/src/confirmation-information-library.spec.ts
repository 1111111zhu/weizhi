import { describe, expect, it } from "vitest";

import {
  ConfirmationInformationLibraryCreateInputSchema,
  ConfirmationInformationLibraryEntrySchema,
  ConfirmationInformationLibraryUpdateInputSchema,
} from "./confirmation-information-library";

const entry = {
  id: "hk-bank-012",
  bankCode: "012",
  bankNameEn: "Bank of China (Hong Kong) Limited",
  bankNameZh: "中国银行（香港）有限公司",
  bankType: "本地注册银行",
  businessAddress: "Bank of China Tower, 1 Garden Road, Central, Hong Kong",
  mailingAddress:
    "3/F, Bank of China Centre, Olympian City, 11 Hoi Fai Road, West Kowloon",
  mailingAddressSameAsBusiness: false,
  contactName: "Bank of China (Hong Kong) Limited",
  attention: "Bank confirmation",
  notes: null,
  background: "发函证常用银行",
  sourceLabel: "香港银行函证信息库.xlsx",
  sourceRow: 9,
  isActive: true,
  effectiveMailingAddress:
    "3/F, Bank of China Centre, Olympian City, 11 Hoi Fai Road, West Kowloon",
  isReadyForDispatch: true,
  createdAt: "2026-08-13T00:00:00.000Z",
  updatedAt: "2026-08-13T00:00:00.000Z",
};

describe("confirmation information library schemas", () => {
  it("parses an API entry without discarding computed fields", () => {
    expect(
      ConfirmationInformationLibraryEntrySchema.parse(entry)
    ).toStrictEqual(entry);
  });

  it("normalizes a one-digit bank code and blank optional fields", () => {
    expect(
      ConfirmationInformationLibraryCreateInputSchema.parse({
        bankCode: "3",
        bankNameEn: " Standard Chartered Bank (Hong Kong) Limited ",
        bankNameZh: " 渣打银行（香港）有限公司 ",
        bankType: " 本地注册银行 ",
        businessAddress: " 4-4A Des Voeux Road Central ",
        mailingAddress: " ",
        contactName: " ",
      })
    ).toStrictEqual(
      expect.objectContaining({
        bankCode: "003",
        bankNameEn: "Standard Chartered Bank (Hong Kong) Limited",
        bankNameZh: "渣打银行（香港）有限公司",
        bankType: "本地注册银行",
        businessAddress: "4-4A Des Voeux Road Central",
        mailingAddress: null,
        contactName: null,
      })
    );
  });

  it("rejects an empty update", () => {
    expect(
      ConfirmationInformationLibraryUpdateInputSchema.safeParse({}).success
    ).toBeFalsy();
  });

  it("rejects non-numeric bank codes", () => {
    expect(
      ConfirmationInformationLibraryCreateInputSchema.safeParse({
        bankCode: "HK12",
        bankNameEn: "Bank",
        bankNameZh: "银行",
        bankType: "本地注册银行",
        businessAddress: "Hong Kong",
      }).success
    ).toBeFalsy();
  });

  it("rejects provenance and status fields from create and update inputs", () => {
    const createInput = {
      bankCode: "012",
      bankNameEn: "Bank",
      bankNameZh: "银行",
      bankType: "Local",
      businessAddress: "Hong Kong",
    };

    for (const field of [
      "sourceDescription",
      "sourceLabel",
      "sourceRow",
      "isActive",
    ]) {
      expect(
        ConfirmationInformationLibraryCreateInputSchema.safeParse({
          ...createInput,
          [field]:
            field === "sourceRow" ? 9 : field === "isActive" ? false : "x",
        }).success
      ).toBeFalsy();
      expect(
        ConfirmationInformationLibraryUpdateInputSchema.safeParse({
          bankNameEn: "Updated",
          [field]:
            field === "sourceRow" ? 9 : field === "isActive" ? false : "x",
        }).success
      ).toBeFalsy();
    }
  });
});
