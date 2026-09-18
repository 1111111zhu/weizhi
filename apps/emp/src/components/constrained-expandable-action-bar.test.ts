import { calculateExpansionCapacity } from "@project-wing/ui";
import { describe, expect, it } from "vitest";

describe(calculateExpansionCapacity, () => {
  it("keeps the search unchanged when the expanded toolbar already fits", () => {
    expect(
      calculateExpansionCapacity({
        availableWidth: 352,
        centerWidth: 512,
        requiredWidth: 312,
      })
    ).toStrictEqual({ allowed: true, yieldWidth: 0 });
  });

  it("yields exactly the missing toolbar width when the search can absorb it", () => {
    expect(
      calculateExpansionCapacity({
        availableWidth: 352,
        centerWidth: 512,
        requiredWidth: 731,
      })
    ).toStrictEqual({ allowed: true, yieldWidth: 379 });
  });

  it("forbids expansion only when the whole search width is insufficient", () => {
    expect(
      calculateExpansionCapacity({
        availableWidth: 298,
        centerWidth: 240,
        requiredWidth: 731,
      })
    ).toStrictEqual({ allowed: false, yieldWidth: 433 });
  });
});
