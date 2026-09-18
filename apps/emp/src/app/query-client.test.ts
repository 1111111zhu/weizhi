import { afterEach, describe, expect, it, vi } from "vitest";

import { createEmpQueryClient } from "./query-client";

const errorToast = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: {
    error: errorToast,
  },
}));

describe(createEmpQueryClient, () => {
  afterEach(() => {
    errorToast.mockClear();
  });

  it("keeps network query failures out of the global toast queue", async () => {
    const queryClient = createEmpQueryClient();

    await expect(
      queryClient.fetchQuery({
        queryKey: ["query-client-test", "network"],
        retry: false,
        queryFn: () => {
          throw new TypeError("Failed to fetch");
        },
      })
    ).rejects.toThrow("Failed to fetch");

    expect(errorToast).not.toHaveBeenCalled();
  });

  it.each(["REQUEST_FAILED", "INTERNAL_SERVER_ERROR"])(
    "keeps non-actionable %s query failures out of the global toast queue",
    async (code) => {
      const queryClient = createEmpQueryClient();

      await expect(
        queryClient.fetchQuery({
          queryKey: ["query-client-test", code],
          retry: false,
          queryFn: () => {
            throw Object.assign(new Error("Request failed"), { code });
          },
        })
      ).rejects.toThrow("Request failed");

      expect(errorToast).not.toHaveBeenCalled();
    }
  );

  it("still shows actionable query failures", async () => {
    const queryClient = createEmpQueryClient();

    await expect(
      queryClient.fetchQuery({
        queryKey: ["query-client-test", "forbidden"],
        retry: false,
        queryFn: () => {
          throw Object.assign(new Error("Forbidden"), { code: "FORBIDDEN" });
        },
      })
    ).rejects.toThrow("Forbidden");

    expect(errorToast).toHaveBeenCalledExactlyOnceWith(
      "Permission denied",
      expect.objectContaining({
        description: "You do not have permission to perform this action.",
      })
    );
  });

  it("keeps background integration failures out of the global toast queue", async () => {
    const queryClient = createEmpQueryClient();

    await expect(
      queryClient.fetchQuery({
        queryKey: ["desktop-agent-sessions"],
        meta: { suppressGlobalErrorToast: true },
        retry: false,
        queryFn: () => {
          throw new Error("Desktop agent request failed.");
        },
      })
    ).rejects.toThrow("Desktop agent request failed.");

    expect(errorToast).not.toHaveBeenCalled();
  });
});
