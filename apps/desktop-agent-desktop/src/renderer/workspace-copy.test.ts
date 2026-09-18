import { describe, expect, it } from "vitest";

import { formatCacheBytes, issueStates, workspaceCopy } from "./workspace-copy";

describe("desktop workspace information hierarchy", () => {
  it("keeps ordinary open states out of the issues view", () => {
    for (const state of [
      "OPEN",
      "OPEN_UNCHANGED",
      "LAUNCHING",
      "CLOSE_DETECTED",
    ]) {
      expect(issueStates.has(state) === false).toBeTruthy();
    }
    for (const state of [
      "LEASE_LOST",
      "LOCAL_FILE_MISSING",
      "CHECKIN_FAILED",
      "CONFLICT_RISK",
    ]) {
      expect(issueStates.has(state) === true).toBeTruthy();
    }
  });

  it("preserves the bilingual cache navigation and configuration naming contract", () => {
    expect(workspaceCopy("zh-CN").cache).toBe("缓存");
    expect(workspaceCopy("en-US").cache).toBe("Cache");
    expect(workspaceCopy("zh-CN").location).toBe("缓存位置");
  });

  it("formats cache totals without NaN or misleading negative counts", () => {
    expect(formatCacheBytes(0)).toBe("0 B");
    expect(formatCacheBytes(1024 ** 2)).toBe("1.0 MB");
    expect(formatCacheBytes(10 * 1024 ** 3)).toBe("10 GB");
    expect(formatCacheBytes(Number.NaN)).toBe("—");
    expect(formatCacheBytes(-1)).toBe("—");
  });
});
