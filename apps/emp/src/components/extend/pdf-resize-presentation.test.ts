import { describe, expect, it } from "vitest";

import { getPdfResizePresentation } from "./pdf-resize-presentation";

describe(getPdfResizePresentation, () => {
  it("tracks viewport growth one-to-one", () => {
    const presentation = getPdfResizePresentation({
      availableWidth: 1000,
      baseZoom: 0.8,
      contentInset: 0,
      contentWidth: 1000,
      maxZoom: 2,
      minZoom: 0.1,
      offsetLeft: 0,
      offsetTop: 0,
      scrollTop: 0,
    });

    expect(presentation?.scale).toBeCloseTo(1.25);
    expect(presentation?.translateX).toBeCloseTo(0);
    expect(presentation?.translateY).toBeCloseTo(0);
  });

  it("keeps the current scroll-top content anchored", () => {
    const presentation = getPdfResizePresentation({
      availableWidth: 800,
      baseZoom: 1,
      contentInset: 0,
      contentWidth: 1000,
      maxZoom: 2,
      minZoom: 0.1,
      offsetLeft: 0,
      offsetTop: 0,
      scrollTop: 400,
    });

    expect(presentation?.scale).toBeCloseTo(0.8);
    expect(presentation?.translateY).toBeCloseTo(80);
  });

  it("matches the native zoom limits during large resizes", () => {
    const presentation = getPdfResizePresentation({
      availableWidth: 1600,
      baseZoom: 0.8,
      contentInset: 24,
      contentWidth: 600,
      maxZoom: 2,
      minZoom: 0.1,
      offsetLeft: 560,
      offsetTop: 0,
      scrollTop: 0,
    });

    expect(presentation?.scale).toBeCloseTo(2.5);
    expect(presentation?.translateX).toBeCloseTo(-336);
  });

  it("rejects unavailable viewport measurements", () => {
    expect(
      getPdfResizePresentation({
        availableWidth: 0,
        baseZoom: 1,
        contentInset: 0,
        contentWidth: 800,
        maxZoom: 2,
        minZoom: 0.1,
        offsetLeft: 0,
        offsetTop: 0,
        scrollTop: 0,
      })
    ).toBeNull();
  });
});
