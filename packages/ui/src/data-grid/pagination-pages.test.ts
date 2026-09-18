import { describe, expect, it } from "vitest";

import { getPaginationPages } from "./pagination-pages";

describe(getPaginationPages, () => {
  it("keeps small page sets directly reachable", () => {
    expect(getPaginationPages(0, 3)).toStrictEqual([0, 1, 2]);
  });

  it("keeps first, last and adjacent pages without rendering the entire dataset", () => {
    expect(getPaginationPages(50, 1000)).toStrictEqual([
      0,
      "start-gap",
      49,
      50,
      51,
      "end-gap",
      999,
    ]);
  });

  it("exposes pages near either end without a redundant gap", () => {
    expect(getPaginationPages(0, 100)).toStrictEqual([
      0,
      1,
      2,
      3,
      4,
      "end-gap",
      99,
    ]);
    expect(getPaginationPages(99, 100)).toStrictEqual([
      0,
      "start-gap",
      95,
      96,
      97,
      98,
      99,
    ]);
  });
});
