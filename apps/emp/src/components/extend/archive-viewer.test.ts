import { describe, expect, it } from "vitest";

import { filterArchiveEntries } from "./archive-viewer";

describe(filterArchiveEntries, () => {
  const entries = [
    { lastModified: 0, name: "readme.txt", path: "docs/readme.txt", size: 4 },
    { lastModified: 0, name: "budget.xlsx", path: "data/budget.xlsx", size: 8 },
  ];

  it("matches archive paths case-insensitively", () => {
    expect(filterArchiveEntries(entries, "BUDGET")).toStrictEqual([entries[1]]);
  });

  it("restores all entries when the search is empty", () => {
    expect(filterArchiveEntries(entries, "  ")).toStrictEqual(entries);
  });
});
