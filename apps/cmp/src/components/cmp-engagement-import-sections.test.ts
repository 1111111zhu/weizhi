import { describe, expect, it } from "vitest";

import {
  DEFAULT_ENGAGEMENT_IMPORT_SECTIONS,
  parseEngagementImportSections,
  serializeEngagementImportSections,
} from "./cmp-engagement-import-sections";

describe("Engagement import sections", () => {
  it("keeps legacy source URLs as full imports", () => {
    expect(parseEngagementImportSections()).toStrictEqual(
      DEFAULT_ENGAGEMENT_IMPORT_SECTIONS
    );
  });

  it("preserves an explicit empty selection and filters unknown values", () => {
    expect(parseEngagementImportSections("none")).toStrictEqual([]);
    expect(
      parseEngagementImportSections("commercial,unknown,commercial")
    ).toStrictEqual(["commercial"]);
    expect(serializeEngagementImportSections([])).toBe("none");
  });
});
