import { describe, expect, it } from "vitest";

import { findTextPreviewSearchResults } from "./text-preview-search";

describe(findTextPreviewSearchResults, () => {
  it("finds case-insensitive matches and their source offsets", () => {
    expect(
      findTextPreviewSearchResults("Alpha beta ALPHA", " alpha ")
    ).toStrictEqual([
      { start: 0, end: 5 },
      { start: 11, end: 16 },
    ]);
  });

  it("does not return overlapping matches", () => {
    expect(findTextPreviewSearchResults("aaaa", "aa")).toStrictEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ]);
  });

  it("returns no matches for blank queries", () => {
    expect(findTextPreviewSearchResults("some text", "   ")).toStrictEqual([]);
  });
});
