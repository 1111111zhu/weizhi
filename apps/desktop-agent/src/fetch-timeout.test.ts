import { describe, expect, it, vi } from "vitest";

import { fetchWithDesktopAgentTimeout } from "./fetch-timeout.js";

describe("desktop agent fetch timeout", () => {
  it("adds a timeout signal while preserving fetch init options", async () => {
    const response = new Response("ok");
    const fetchImpl = vi.fn().mockResolvedValue(response);

    await expect(
      fetchWithDesktopAgentTimeout(
        fetchImpl,
        "https://wing.superfx.cn/download",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
        5000
      )
    ).resolves.toBe(response);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://wing.superfx.cn/download",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("composes caller cancellation with the timeout signal", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn().mockImplementation(async (_url, init) => {
      await Promise.resolve();
      controller.abort();
      expect(init.signal.aborted).toBeTruthy();
      return new Response("ok");
    });

    await fetchWithDesktopAgentTimeout(
      fetchImpl,
      "https://wing.superfx.cn/download",
      {
        signal: controller.signal,
      },
      5000
    );
  });
});
