import { describe, expect, it } from "vitest";

import { ConfirmationDraftPayloadSchema } from "./index";

describe("confirmation information-library draft snapshot", () => {
  it("preserves the source entry and copied dispatch fields", () => {
    expect(
      ConfirmationDraftPayloadSchema.parse({
        confirmationInformationLibraryEntryId: "hk-bank-012",
        bankName: "中国银行（香港）有限公司",
        counterpartyAddress: "3/F, Bank of China Centre",
        counterpartyAttention: "Bank confirmation",
        counterpartyContact: "Bank of China (Hong Kong) Limited",
      })
    ).toStrictEqual({
      confirmationInformationLibraryEntryId: "hk-bank-012",
      bankName: "中国银行（香港）有限公司",
      counterpartyAddress: "3/F, Bank of China Centre",
      counterpartyAttention: "Bank confirmation",
      counterpartyContact: "Bank of China (Hong Kong) Limited",
    });
  });
});
