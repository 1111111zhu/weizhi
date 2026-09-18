import { describe, expect, it } from "vitest";

import { getResponsiveColumnVisibility } from "./data-grid-column-preferences";

describe(getResponsiveColumnVisibility, () => {
  it("hides optional columns by default in a compact viewport", () => {
    expect(
      getResponsiveColumnVisibility({}, ["clientCode", "lastOpened"])
    ).toStrictEqual({ clientCode: false, lastOpened: false });
  });

  it("honors an explicit show choice instead of silently hiding the column again", () => {
    expect(
      getResponsiveColumnVisibility({ clientCode: true, systemId: false }, [
        "clientCode",
        "lastOpened",
      ])
    ).toStrictEqual({ clientCode: true, systemId: false, lastOpened: false });
  });

  it("preserves the saved preferences when moving back to a wide viewport", () => {
    const preferences = { clientCode: true, systemId: false };
    getResponsiveColumnVisibility(preferences, ["clientCode"]);
    expect(getResponsiveColumnVisibility(preferences, [])).toStrictEqual(
      preferences
    );
    expect(preferences).toStrictEqual({ clientCode: true, systemId: false });
  });
});
