import { afterEach, describe, expect, it, vi } from "vitest";

import { createCmpQueryClient } from "./query-client";

const errorToast = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: {
    error: errorToast,
  },
}));

describe(createCmpQueryClient, () => {
  afterEach(() => {
    errorToast.mockClear();
  });

  it("shows the specific service reason for a failed mutation", async () => {
    const queryClient = createCmpQueryClient();

    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationKey: ["query-client-test", "specific-error"],
      mutationFn: () => {
        throw Object.assign(
          new Error("The engagement is already linked to another project."),
          {
            code: "PROJECT_ENGAGEMENT_ALREADY_LINKED",
            requestId: "request-link-1",
          }
        );
      },
    });

    await expect(mutation.execute({})).rejects.toThrow("already linked");

    expect(errorToast).toHaveBeenCalledExactlyOnceWith(
      "Engagement already linked",
      expect.objectContaining({
        description:
          "The engagement is already linked to another project. Reference: request-link-1",
      })
    );
  });

  it("uses a safe explanation for an internal error", async () => {
    const queryClient = createCmpQueryClient();

    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationKey: ["query-client-test", "internal-error"],
      mutationFn: () => {
        throw Object.assign(new Error("Prisma connection failed"), {
          code: "INTERNAL_SERVER_ERROR",
        });
      },
    });

    await expect(mutation.execute({})).rejects.toThrow(
      "Prisma connection failed"
    );

    expect(errorToast).toHaveBeenCalledExactlyOnceWith(
      "Server error",
      expect.objectContaining({
        description:
          "The server could not complete the request. Please try again.",
      })
    );
  });
});
