import { describe, expect, it } from "vitest";

import {
  formatPreviewZoomPercentage,
  PREVIEW_ZOOM_OPTIONS,
  previewZoomContentClassName,
} from "./preview-zoom-control";

describe("preview zoom control", () => {
  it("provides a content zoom class for every selectable level", () => {
    expect(Object.keys(previewZoomContentClassName).map(Number)).toStrictEqual(
      PREVIEW_ZOOM_OPTIONS
    );
  });

  it("uses a compact percentage for actual-size PDF zoom", () => {
    expect(formatPreviewZoomPercentage(1)).toBe("100%");
    expect(formatPreviewZoomPercentage(1.25)).toBe("125%");
  });
});
