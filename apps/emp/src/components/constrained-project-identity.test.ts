import { calculateTopBarIdentityCapacity } from "@project-wing/ui";
import { describe, expect, it } from "vitest";

describe(calculateTopBarIdentityCapacity, () => {
  it("keeps all identity tabs visible when their text fits", () => {
    expect(
      calculateTopBarIdentityCapacity({
        availableWidth: 420,
        centerWidth: 512,
        requiredWidth: 400,
      })
    ).toStrictEqual({ allowed: true, collapsed: false, yieldWidth: 0 });
  });

  it("collapses to the middle tab when any full tab would truncate", () => {
    expect(
      calculateTopBarIdentityCapacity({
        availableWidth: 310,
        centerWidth: 512,
        requiredWidth: 438,
      })
    ).toStrictEqual({ allowed: true, collapsed: true, yieldWidth: 128 });
  });

  it("forbids hover expansion when the search cannot absorb the shortage", () => {
    expect(
      calculateTopBarIdentityCapacity({
        availableWidth: 188,
        centerWidth: 200,
        requiredWidth: 438,
      })
    ).toStrictEqual({ allowed: false, collapsed: true, yieldWidth: 250 });
  });
});
