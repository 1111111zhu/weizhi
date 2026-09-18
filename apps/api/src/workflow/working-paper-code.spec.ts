import { buildNextWorkingPaperCode } from "./working-paper-code";

describe(buildNextWorkingPaperCode, () => {
  it("uses a dot-separated sequence for numeric hierarchical folders", () => {
    expect(buildNextWorkingPaperCode("1000", [])).toBe("1000.1");
    expect(
      buildNextWorkingPaperCode("1-10", [
        { code: "1-10.1" },
        { code: "1-10.3" },
        { code: "1000-F001" },
      ])
    ).toBe("1-10.4");
  });

  it("skips digit 4 when generating file reference suffixes", () => {
    expect(buildNextWorkingPaperCode("A3-3000", [])).toBe("A3-3000-F001");
    expect(
      buildNextWorkingPaperCode("A3-3000", [{ code: "A3-3000-F003" }])
    ).toBe("A3-3000-F005");
    expect(
      buildNextWorkingPaperCode("A3-3000", [{ code: "A3-3000-F039" }])
    ).toBe("A3-3000-F050");
  });
});
