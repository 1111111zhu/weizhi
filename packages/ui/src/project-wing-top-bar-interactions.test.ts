import { describe, expect, it } from "vitest";

import { shouldKeepTopBarSearchExpanded } from "./project-wing-top-bar-interactions";

describe(shouldKeepTopBarSearchExpanded, () => {
  it("releases an empty focused search without results", () => {
    expect(
      shouldKeepTopBarSearchExpanded({
        hasQuery: false,
        hasResultsOpen: false,
      })
    ).toBeFalsy();
  });

  it("keeps a populated search expanded", () => {
    expect(
      shouldKeepTopBarSearchExpanded({
        hasQuery: true,
        hasResultsOpen: false,
      })
    ).toBeTruthy();
  });

  it("keeps visible search results expanded", () => {
    expect(
      shouldKeepTopBarSearchExpanded({
        hasQuery: false,
        hasResultsOpen: true,
      })
    ).toBeTruthy();
  });
});
