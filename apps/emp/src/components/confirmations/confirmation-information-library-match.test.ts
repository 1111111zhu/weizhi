import { describe, expect, it } from "vitest";

import {
  buildConfirmationInformationLibraryBindingChoices,
  buildConfirmationInformationLibraryDraftPatch,
  canUseConfirmationInformationLibrary,
  clearConfirmationInformationLibraryDraftValuesForTemplate,
  getConfirmationInformationLibraryDisplayName,
  matchesConfirmationInformationLibraryEntry,
} from "./confirmation-information-library-match";

const bankOfChina = {
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
  effectiveMailingAddress:
    "3/F, Bank of China Centre, Olympian City, 11 Hoi Fai Road, West Kowloon",
  historicalMailingAddress:
    "Bank of China Tower, 1 Garden Road, Central, Hong Kong\nOld confirmation office",
};
const hsbc = {
  id: "hk-bank-004",
  bankCode: "004",
  bankNameEn: "The Hongkong and Shanghai Banking Corporation Limited",
  bankNameZh: "香港上海汇丰银行有限公司",
  bankType: "本地注册银行",
  businessAddress: "1 Queen's Road Central, Central, Hong Kong",
  mailingAddress:
    "1/F, Tower 2, HSBC Centre\n1 Sham Mong Road, Kowloon, Hong Kong",
  mailingAddressSameAsBusiness: false,
  contactName: "HSBC Audit Confirmation Team",
  attention: null,
  effectiveMailingAddress:
    "1/F, Tower 2, HSBC Centre\n1 Sham Mong Road, Kowloon, Hong Kong",
};

describe("confirmation information library matching", () => {
  it.each([
    "012",
    "bank of china",
    "中国银行",
    "olympian city",
    "bank confirmation",
  ])("matches a bank by %s", (query) => {
    expect(
      matchesConfirmationInformationLibraryEntry(bankOfChina, query)
    ).toBeTruthy();
  });

  it("uses the Chinese bank name for the restored original template", () => {
    expect(
      buildConfirmationInformationLibraryDraftPatch(
        bankOfChina,
        "STANDARD_FINANCIAL_INSTITUTION"
      )
    ).toStrictEqual({
      confirmationInformationLibraryEntryId: "hk-bank-012",
      bankName: "中国银行（香港）有限公司",
      counterpartyAddress:
        "3/F, Bank of China Centre, Olympian City, 11 Hoi Fai Road, West Kowloon",
      counterpartyAttention: "Bank confirmation",
      counterpartyContact: "Bank of China (Hong Kong) Limited",
      recipientAddress:
        "3/F, Bank of China Centre, Olympian City, 11 Hoi Fai Road, West Kowloon",
      recipientName: "Bank of China (Hong Kong) Limited",
    });
  });

  it("uses the English bank name for the new HK English template", () => {
    expect(
      buildConfirmationInformationLibraryDraftPatch(
        bankOfChina,
        "BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
      ).bankName
    ).toBe("Bank of China (Hong Kong) Limited");
  });

  it("uses the interface language for the applied bank name", () => {
    expect(
      buildConfirmationInformationLibraryDraftPatch(
        bankOfChina,
        "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
        "zh-CN"
      ).bankName
    ).toBe("中国银行（香港）有限公司");
  });

  it.each([
    ["zh-CN", "中国银行（香港）有限公司"],
    ["en-US", "Bank of China (Hong Kong) Limited"],
  ])("uses the %s bank name in compact search results", (locale, name) => {
    expect(
      getConfirmationInformationLibraryDisplayName(bankOfChina, locale)
    ).toBe(name);
  });

  it("offers only bank name, contact, and current plus historical mailing addresses", () => {
    expect(
      buildConfirmationInformationLibraryBindingChoices(bankOfChina, "zh-CN")
    ).toEqual({
      bankName: ["中国银行（香港）有限公司"],
      recipientName: ["Bank of China (Hong Kong) Limited"],
      recipientAddress: [
        "3/F, Bank of China Centre, Olympian City, 11 Hoi Fai Road, West Kowloon",
        "Bank of China Tower, 1 Garden Road, Central, Hong Kong",
        "Old confirmation office",
      ],
    });
  });

  it.each([
    "STANDARD_FINANCIAL_INSTITUTION",
    "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
    "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
    "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
  ])("maps the HSBC library snapshot for %s", (templateCode) => {
    const patch = buildConfirmationInformationLibraryDraftPatch(
      hsbc,
      templateCode
    );

    expect(patch).toStrictEqual({
      confirmationInformationLibraryEntryId: "hk-bank-004",
      bankName:
        templateCode === "STANDARD_FINANCIAL_INSTITUTION"
          ? "香港上海汇丰银行有限公司"
          : "The Hongkong and Shanghai Banking Corporation Limited",
      counterpartyAddress: hsbc.effectiveMailingAddress,
      counterpartyAttention: "HSBC Audit Confirmation Team",
      counterpartyContact: "HSBC Audit Confirmation Team",
      recipientAddress: hsbc.effectiveMailingAddress,
      recipientName: "HSBC Audit Confirmation Team",
    });
    expect(patch.bankName).not.toBe(hsbc.contactName);
  });

  it.each([
    [
      "contact before attention",
      "Attention Desk",
      "Contact Desk",
      "Contact Desk",
    ],
    ["contact", null, "Contact Desk", "Contact Desk"],
    ["no contact", null, null, undefined],
  ])(
    "uses %s as the Type1/Type2 recipient name fallback",
    (_label, attention, contactName, recipientName) => {
      for (const templateCode of [
        "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
        "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
      ]) {
        expect(
          buildConfirmationInformationLibraryDraftPatch(
            {
              ...hsbc,
              attention,
              contactName,
            },
            templateCode
          ).recipientName
        ).toBe(recipientName);
      }
    }
  );

  it.each([
    "STANDARD_FINANCIAL_INSTITUTION",
    "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
  ])(
    "maps the bank contact into the visible linked contact field for %s",
    (templateCode) => {
      expect(
        buildConfirmationInformationLibraryDraftPatch(bankOfChina, templateCode)
          .recipientName
      ).toBe("Bank of China (Hong Kong) Limited");
    }
  );
  it("does not clear hand-entered fields when the library has no value", () => {
    expect(
      buildConfirmationInformationLibraryDraftPatch(
        {
          ...bankOfChina,
          mailingAddress: null,
          effectiveMailingAddress: null,
          contactName: null,
          attention: null,
        },
        "BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
      )
    ).toStrictEqual({
      confirmationInformationLibraryEntryId: "hk-bank-012",
      bankName: "Bank of China (Hong Kong) Limited",
    });
  });

  it.each([
    "PRC_BANK_TEMPLATE_1",
    "PRC_BANK_TEMPLATE_2",
    "SHINEWING_ENG_BANK",
    "STANDARD_FINANCIAL_INSTITUTION",
    "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
    "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
    "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
  ])("enables library matching for bank template %s", (templateCode) => {
    expect(canUseConfirmationInformationLibrary(templateCode)).toBeTruthy();
  });

  it.each(["UPLOADED_DOCUMENT", "OTHER_TEMPLATE"])(
    "does not offer bank matching for non-bank template %s",
    (templateCode) => {
      expect(canUseConfirmationInformationLibrary(templateCode)).toBeFalsy();
    }
  );

  it("clears mapped bank values and mapped securities recipients", () => {
    expect(
      clearConfirmationInformationLibraryDraftValuesForTemplate(
        {
          clientName: "Example Client",
          confirmationInformationLibraryEntryId: "hk-bank-012",
          bankName: "中国银行（香港）有限公司",
          counterpartyAddress: "3/F, Bank of China Centre",
          counterpartyAttention: "Bank confirmation",
          counterpartyContact: "Confirmation desk",
          recipientAddress: "3/F, Bank of China Centre",
          recipientName: "Bank confirmation",
        },
        "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1"
      )
    ).toStrictEqual({
      clientName: "Example Client",
    });
  });

  it("preserves manually different securities recipients while clearing bank values", () => {
    expect(
      clearConfirmationInformationLibraryDraftValuesForTemplate(
        {
          clientName: "Example Client",
          confirmationInformationLibraryEntryId: "hk-bank-012",
          bankName: "中国银行（香港）有限公司",
          counterpartyAddress: "3/F, Bank of China Centre",
          counterpartyAttention: "Bank confirmation",
          counterpartyContact: "Confirmation desk",
          recipientAddress: "Manual securities address",
          recipientName: "Example Broker",
        },
        "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1"
      )
    ).toStrictEqual({
      clientName: "Example Client",
      recipientAddress: "Manual securities address",
      recipientName: "Example Broker",
    });
  });

  it("preserves all hand-entered bank fields when the draft has no library source", () => {
    const manualDraft = {
      bankName: "Manual Bank",
      counterpartyAddress: "Manual Bank Address",
      counterpartyAttention: "Manual Attention",
      counterpartyContact: "Manual Contact",
      recipientAddress: "Manual Recipient Address",
      recipientName: "Manual Recipient",
    };

    expect(
      clearConfirmationInformationLibraryDraftValuesForTemplate(
        manualDraft,
        "BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
      )
    ).toStrictEqual(manualDraft);
  });
});
