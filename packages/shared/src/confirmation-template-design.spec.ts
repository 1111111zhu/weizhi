import { describe, expect, it } from "vitest";

import { CONFIRMATION_TEMPLATE_FONT_SIZES } from "./confirmation-template-design";
import {
  ConfirmationCustomTemplateCodeSchema,
  isConfirmationCustomTemplateCode,
} from "./index";

describe("confirmation template text sizes", () => {
  it("supports the common document font-size range while keeping legacy sizes", () => {
    expect(CONFIRMATION_TEMPLATE_FONT_SIZES).toEqual([
      8, 10, 12, 14, 16, 18, 20, 24, 28, 32,
    ]);
  });
});

describe("confirmation template codes", () => {
  it("accepts structured codes and keeps legacy codes readable", () => {
    expect(
      ConfirmationCustomTemplateCodeSchema.safeParse("CTPL-BANK-2026-000001")
        .success
    ).toBe(true);
    expect(isConfirmationCustomTemplateCode("CTPL-42EE80005D40")).toBe(true);
    expect(isConfirmationCustomTemplateCode("CTPL-BANK-26-000001")).toBe(false);
    expect(isConfirmationCustomTemplateCode("CTPL-BANK-2026-00001")).toBe(
      false
    );
  });
});
