import { describe, expect, it } from "vitest";

import { getDesktopAgentVersionPolicy } from "./desktop-agent";

describe("desktop Agent version policy", () => {
  it("requires the cross-platform desktop release by default", () => {
    expect(getDesktopAgentVersionPolicy().minimumSupportedVersion).toBe(
      "0.2.0"
    );
  });
});
