import { describe, expect, it } from "vitest";

import {
  buildApplicationHomePath,
  buildLocalizedLoginPath,
  resolveSafeNextPath,
} from "./auth-navigation.js";

describe("auth navigation", () => {
  it("only accepts same-origin paths as the next destination", () => {
    expect(resolveSafeNextPath("/zh-CN/engagement?tab=active")).toBe(
      "/zh-CN/engagement?tab=active"
    );
    expect(resolveSafeNextPath("https://evil.example/login")).toBe("/");
    expect(resolveSafeNextPath("//evil.example/login")).toBe("/");
    expect(resolveSafeNextPath("/projects\nredirect")).toBe("/");
  });

  it("builds one localized login URL", () => {
    expect(buildLocalizedLoginPath("zh-CN", "/engagement?tab=recent")).toBe(
      "/zh-CN/login?next=%2Fengagement%3Ftab%3Drecent"
    );
    expect(buildLocalizedLoginPath("en-US")).toBe("/en-US/login");
  });

  it("keeps application home decisions in one contract", () => {
    expect(buildApplicationHomePath("emp", "zh-CN")).toBe("/zh-CN/engagement");
    expect(buildApplicationHomePath("cmp", "zh-CN", "SUPER_ADMIN")).toBe(
      "/zh-CN/dashboard"
    );
    expect(buildApplicationHomePath("cmp", "zh-CN", "PARTNER")).toBe(
      "/zh-CN/client"
    );
    expect(buildApplicationHomePath("tms", "en-US")).toBe("/en-US/timesheet");
  });
});
