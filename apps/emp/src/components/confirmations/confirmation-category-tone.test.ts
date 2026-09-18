import { describe, expect, it } from "vitest";

import {
  getConfirmationCategoryTone,
  getConfirmationTypeTone,
} from "./confirmation-category-tone";

describe("confirmation category tones", () => {
  it.each([
    ["FINANCIAL", "financial"],
    ["CORRESPONDENCE", "correspondence"],
    ["OTHER", "other"],
    ["UNCLASSIFIED", "unclassified"],
    ["RECYCLE_BIN", "neutral"],
  ] as const)("maps %s to the %s tone", (value, tone) => {
    expect(getConfirmationCategoryTone(value)).toMatchObject({ key: tone });
  });

  it("maps known types to the same category tone and unknown types to coral", () => {
    expect(getConfirmationTypeTone("BANK").key).toBe("financial");
    expect(getConfirmationTypeTone("RELATED_PARTY").key).toBe("correspondence");
    expect(getConfirmationTypeTone("OTHER").key).toBe("other");
    expect(getConfirmationTypeTone("MYSTERY").key).toBe("unclassified");
  });
});
