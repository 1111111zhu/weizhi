import { describe, expect, it } from "vitest";

import { getRecoveryGuidance } from "./recovery-guidance";

describe("native recovery guidance", () => {
  it("distinguishes a running update from an interrupted update", () => {
    expect(
      getRecoveryGuidance(new Error("An update is in progress."), "zh-CN")
        .detail
    ).toContain("完成后服务会自动恢复");
    expect(
      getRecoveryGuidance(
        new Error("A previous local update was interrupted"),
        "zh-CN"
      ).detail
    ).toContain("检查更新");
  });

  it("keeps internal exception details out of the user dialog", () => {
    const guidance = getRecoveryGuidance(
      new Error("permission denied at private-internal-path"),
      "en-US"
    );
    expect(guidance.detail).not.toContain("private-internal-path");
    expect(guidance.detail).toContain("working files are retained");
    expect(guidance.openLabel).toBe("Open local app");
  });

  it("does not recommend downloading or force-stopping when another service is active", () => {
    const guidance = getRecoveryGuidance(
      new Error("The local port belongs to an unrecognized service."),
      "zh-TW"
    );
    expect(guidance.detail).toContain("没有强制停止");
    expect(guidance.detail).not.toContain("下载");
  });
});
