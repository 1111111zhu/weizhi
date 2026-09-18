import { describe, expect, it } from "vitest";

import {
  formatDesktopAgentStatus,
  getDesktopAgentCopy,
  normalizeDesktopAgentLocale,
} from "./i18n";

describe(normalizeDesktopAgentLocale, () => {
  it.each([
    ["zh-CN", "zh-CN"],
    ["zh-HK", "zh-CN"],
    ["en-US", "en-US"],
    ["fr-FR", "en-US"],
    [null, "en-US"],
  ])("normalizes %s to %s", (value, expected) => {
    expect(normalizeDesktopAgentLocale(value)).toBe(expected);
  });
});

describe("Desktop Agent copy", () => {
  it("localizes actions and session states", () => {
    const copy = getDesktopAgentCopy("zh-CN");

    expect(copy.checkForUpdates).toBeTruthy();
    expect(copy.actionsFor("Audit.xlsx")).not.toBe(
      copy.actionsFor("Audit.docx")
    );
    expect(formatDesktopAgentStatus("LEASE_LOST", copy)).not.toBe(
      formatDesktopAgentStatus("READY", copy)
    );
  });
});
