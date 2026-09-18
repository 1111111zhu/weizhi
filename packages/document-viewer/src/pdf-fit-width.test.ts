import { describe, expect, it } from "vitest";

import { pdfFitWidth } from "./pdf-fit-width";

describe("PDF fit-width calculation", () => {
  it("fits an A4 page within a narrow viewport including both gutters", () => {
    expect(pdfFitWidth(412, 595, 24)).toBeCloseTo(364 / 595);
  });

  it("respects the zoom bounds", () => {
    expect(pdfFitWidth(5000, 595, 24)).toBe(2);
    expect(pdfFitWidth(49, 595, 24)).toBe(0.1);
  });

  it.each([
    [0, 595],
    [48, 595],
    [412, 0],
    [Number.NaN, 595],
    [412, Number.POSITIVE_INFINITY],
  ])("ignores invalid dimensions %s / %s", (viewport, page) => {
    expect(pdfFitWidth(viewport, page, 24)).toBeNull();
  });
});
