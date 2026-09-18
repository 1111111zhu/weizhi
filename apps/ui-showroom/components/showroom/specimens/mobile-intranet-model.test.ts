import { describe, expect, it } from "vitest";

import {
  getIntranetDocuments,
  intranetHref,
  parseIntranetRoute,
  resolveIntranetPath,
} from "./mobile-intranet-model";

describe("Intranet mobile navigation prototype", () => {
  it("resolves each level independently and rejects invalid deep links", () => {
    expect(
      resolveIntranetPath(["qm"])?.children.map((item) => item.id)
    ).toStrictEqual(["technical", "quality-management", "risk-alerts"]);
    expect(
      resolveIntranetPath(["qm", "technical"])?.children.map((item) => item.id)
    ).toStrictEqual(["audit", "accounting", "tax"]);
    expect(parseIntranetRoute("#/knowledge/qm/not-real")).toStrictEqual({
      kind: "home",
    });
    expect(parseIntranetRoute("#/document/missing")).toStrictEqual({
      kind: "home",
    });
  });

  it("round trips nested routes and searches only within the selected branch", () => {
    const route = parseIntranetRoute(intranetHref(["it", "systems"]));
    expect(route).toStrictEqual({ kind: "knowledge", path: ["it", "systems"] });
    expect(
      getIntranetDocuments(route, "Outlook").map((item) => item.id)
    ).toStrictEqual(["outlook"]);
    expect(getIntranetDocuments(route, "审计")).toStrictEqual([]);
  });

  it("keeps archived content out of normal search and orders recent items", () => {
    expect(
      getIntranetDocuments({ kind: "collection", collection: "all" }, "旧版")
    ).toStrictEqual([]);
    expect(
      getIntranetDocuments(
        { kind: "collection", collection: "recycle" },
        "旧版"
      ).map((item) => item.id)
    ).toStrictEqual(["archive"]);
    expect(
      getIntranetDocuments({ kind: "collection", collection: "recent" }, "")[0]
        .id
    ).toBe("maintenance");
  });
});
