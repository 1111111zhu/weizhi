import { describe, expect, it } from "vitest";

import type { KnowledgeItem } from "./knowledge-catalog";
import {
  filterMobileKnowledge,
  mobileLocationHash,
  mobileSystemHref,
  parentMobileLocation,
  parseMobileLocation,
} from "./mobile-navigation";
import type { IntranetMobileLocation } from "./mobile-navigation";

describe("Intranet mobile navigation", () => {
  it.each<IntranetMobileLocation>([
    { screen: "home" },
    { screen: "knowledge" },
    { screen: "recycle" },
    { screen: "knowledge", department: "qm", category: "technical" },
    {
      screen: "items",
      department: "qm",
      category: "technical",
      subcategory: "audit",
    },
    { screen: "items", department: "hr", category: "learning" },
    { screen: "items", department: "all" },
  ])("round trips $screen $department $category $subcategory", (location) => {
    expect(parseMobileLocation(mobileLocationHash(location))).toStrictEqual(
      location
    );
  });

  it("rejects unknown departments and nested directory ids", () => {
    expect(parseMobileLocation("#knowledge?department=secret")).toStrictEqual({
      screen: "knowledge",
    });
    expect(
      parseMobileLocation(
        "#knowledge?department=qm&category=technical&subcategory=secret"
      )
    ).toStrictEqual({
      screen: "knowledge",
      department: "qm",
      category: "technical",
    });
    expect(parseMobileLocation("#external")).toStrictEqual({ screen: "home" });
  });

  it("returns through each hierarchy level including view-all collections", () => {
    expect(
      parentMobileLocation({
        screen: "items",
        department: "qm",
        category: "technical",
        subcategory: "audit",
      })
    ).toStrictEqual({
      screen: "knowledge",
      department: "qm",
      category: "technical",
    });
    expect(
      parentMobileLocation({
        screen: "items",
        department: "qm",
        category: "technical",
      })
    ).toStrictEqual({
      screen: "knowledge",
      department: "qm",
      category: "technical",
    });
    expect(
      parentMobileLocation({
        screen: "items",
        department: "hr",
        category: "learning",
      })
    ).toStrictEqual({ screen: "knowledge", department: "hr" });
    expect(
      parentMobileLocation({ screen: "items", department: "recent" })
    ).toStrictEqual({ screen: "knowledge" });
  });

  it("keeps direct documents discoverable while filtering descendants and search", () => {
    const base: KnowledgeItem = {
      title: "Audit guide",
      department: "qm",
      type: "guide",
      owner: "Alex",
      updatedAt: "2026-09-01",
    };
    const direct = { ...base, id: "direct" };
    const nested = {
      ...base,
      id: "nested",
      secondaryCategory: "technical",
      tertiaryCategory: "audit",
    };
    expect(
      filterMobileKnowledge(
        [direct, nested],
        { screen: "items", department: "qm" },
        "Alex"
      )
    ).toHaveLength(2);
    expect(
      filterMobileKnowledge(
        [direct, nested],
        {
          screen: "items",
          department: "qm",
          category: "technical",
          subcategory: "audit",
        },
        "AUDIT"
      )
    ).toStrictEqual([nested]);
    expect(
      filterMobileKnowledge(
        [direct, nested],
        { screen: "items", department: "hr" },
        ""
      )
    ).toHaveLength(0);
    expect(
      filterMobileKnowledge(
        [direct, nested],
        { screen: "items", department: "recent" },
        "",
        new Date("2027-01-01")
      )
    ).toHaveLength(0);
  });

  it("uses the emulator host only for local subsystem links", () => {
    expect(
      mobileSystemHref("http://localhost:3048/zh-CN/engagement", "10.0.2.2")
    ).toBe("http://10.0.2.2:3048/zh-CN/engagement");
    expect(
      mobileSystemHref("https://emp.example.com/zh-CN/engagement", "10.0.2.2")
    ).toBe("https://emp.example.com/zh-CN/engagement");
  });
});
