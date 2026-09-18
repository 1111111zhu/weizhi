import { describe, expect, it } from "vitest";

import { cssPixels } from "../../test/css-pixels";
import { getConfirmationTemplateFieldTextStyleCss } from "./confirmation-template-field-style";

describe("persisted confirmation document text-style serialization contract", () => {
  it.each(["short", "x".repeat(200), "line\n".repeat(30)])(
    "keeps the configured size and wraps multiline content: %s",
    (value) => {
      const style = getConfirmationTemplateFieldTextStyleCss(
        undefined,
        900,
        1,
        600,
        0.1,
        0.2,
        value,
        true
      );
      expect(style.fontSize).toBe("12px");
      expect(style.whiteSpace).toBe("pre-wrap");
      expect(style.overflowWrap).toBe("anywhere");
    }
  );

  it("retains single-line fitting", () => {
    const style = getConfirmationTemplateFieldTextStyleCss(
      undefined,
      900,
      1,
      600,
      0.03,
      0.2,
      "x".repeat(200)
    );
    expect(cssPixels(String(style.fontSize))).toBeLessThan(12);
  });
});
