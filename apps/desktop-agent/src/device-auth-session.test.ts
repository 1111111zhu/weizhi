import { describe, expect, it, vi } from "vitest";

import { createDeviceAuthSession } from "./device-auth-session.js";

describe("device auth session", () => {
  it("keeps an approved device credential only in memory", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json(
        {
          access_token: "test-device-session-token",
          token_type: "Bearer",
          expires_in: 3600,
        },
        { status: 200 }
      )
    );
    const session = createDeviceAuthSession({
      fetcher,
      now: () => new Date("2026-07-13T00:00:00.000Z"),
    });

    await session.startPair({
      clientId: "project-wing-desktop-agent",
      deviceCode: "device-code",
      authBaseUrl: "https://auth.wzcpa.hk",
      expiresInSeconds: 1800,
      intervalSeconds: 5,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://auth.wzcpa.hk/auth/device/token",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: "device-code",
          client_id: "project-wing-desktop-agent",
        }),
      })
    );
    expect(session.status()).toStrictEqual({
      authenticated: true,
      pairing: false,
    });
    expect(session.getAuthorization()).toBe("Bearer test-device-session-token");
  });
});
