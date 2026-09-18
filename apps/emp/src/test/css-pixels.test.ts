import { describe, expect, it } from "vitest";

import { cssPercent, cssPixels } from "./css-pixels";

describe("CSS measurement unit contract", () => {
  it("retains numeric and signed fractional pixel measurements", () => {
    expect(cssPixels("12px")).toBe(12);
    expect(cssPixels("-2.5px")).toBe(-2.5);
    expect(cssPixels("0")).toBe(0);
    expect(cssPixels(1.25)).toBe(1.25);
  });

  it("rejects non-pixel units and absent measurements", () => {
    for (const value of ["12%", "2rem", "auto", "", undefined]) {
      expect(() => cssPixels(value)).toThrow(
        "Expected a CSS pixel measurement"
      );
    }
  });

  it("keeps relative document geometry distinct from pixel font sizes", () => {
    expect(cssPercent("25%")).toBe(25);
    expect(cssPercent("-2.5%")).toBe(-2.5);
    expect(() => cssPercent("25px")).toThrow("Expected a CSS percentage");
    expect(() => cssPixels("25%")).toThrow("Expected a CSS pixel");
  });
});
