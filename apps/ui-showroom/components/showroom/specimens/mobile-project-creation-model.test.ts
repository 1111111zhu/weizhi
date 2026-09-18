import { describe, expect, it } from "vitest";

import {
  filterProjectCreationBusinesses,
  mobileCreationHash,
  parseMobileCreationStage,
  pushMobileCreationStage,
} from "./mobile-project-creation-model";
import { advanceMobileTrail } from "./mobile-workspace-model";

describe("mobile creation flow", () => {
  it("roundtrips stages and safely defaults unknown fragments", () => {
    for (const stage of ["source", "business", "setup", "review"] as const) {
      expect(parseMobileCreationStage(mobileCreationHash(stage))).toBe(stage);
    }
    expect(parseMobileCreationStage("#invalid")).toBe("source");
    expect(parseMobileCreationStage("")).toBe("source");
  });

  it("finds a business by customer or code without case/whitespace surprises", () => {
    expect(
      filterProjectCreationBusinesses(" ORC-2026 ").map((x) => x.value)
    ).toStrictEqual(["orchid"]);
    expect(
      filterProjectCreationBusinesses("harbour").map((x) => x.value)
    ).toStrictEqual(["harbour"]);
    expect(filterProjectCreationBusinesses("unmatched")).toStrictEqual([]);
    expect(filterProjectCreationBusinesses(" ")).toHaveLength(2);
  });

  it("returns along the selected creation path and drops abandoned forward steps", () => {
    let trail = { entries: [] as string[], index: 0 };
    for (const hash of ["#source", "#business", "#setup"]) {
      trail = advanceMobileTrail(trail, hash, hash);
    }
    expect(trail.entries[trail.index - 1]).toBe("#business");
    trail = advanceMobileTrail(trail, "#business", "#business");
    trail = advanceMobileTrail(trail, "#source", "#source");
    trail = pushMobileCreationStage(trail, "setup");
    expect(trail.entries).toStrictEqual(["#source", "#setup"]);
    expect(trail.index).toBe(1);
    // A quick path from a fresh entry has no business selection step.
    let quick = advanceMobileTrail(
      { entries: [], index: 0 },
      "#source",
      "#source"
    );
    quick = advanceMobileTrail(quick, "#setup", "#setup");
    expect(quick.entries).toStrictEqual(["#source", "#setup"]);
  });
});
