import { getConfirmationLogisticsDeliveryVersion } from "@project-wing/shared/confirmation-logistics";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProjectConfirmation } from "../../api/client";
import { requiredFixture } from "../../test/required-fixture";
import {
  ConfirmationLogisticsReadMarker,
  LogisticsUnreadDot,
} from "./confirmation-logistics-unread";
import type { LogisticsUnreadEntry } from "./confirmation-logistics-unread";

vi.mock("../../api/client", () => ({
  api: { me: vi.fn().mockResolvedValue({ id: "reader-1" }) },
}));
const confirmation = {
  id: "confirmation-1",
  projectId: "project-1",
  type: "BANK",
  dispatches: [
    {
      id: "dispatch-1",
      method: "COURIER",
      trackingStatus: "Delivered",
      deliveredAt: "2026-09-14T08:30:00Z",
    },
  ],
  followUpEvents: [],
} as unknown as ProjectConfirmation;
function setup(entries: LogisticsUnreadEntry[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(["me"], { id: "reader-1" });
  client.setQueryData(["confirmationLogisticsUnread", "reader-1"], entries);
  let serverEntries = entries;
  const request = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (_url, options) => {
      if (options?.method === "POST") {
        const { version } = JSON.parse(String(options.body));
        serverEntries = serverEntries.filter(
          (entry) =>
            entry.confirmationId !== "confirmation-1" ||
            entry.version !== version
        );
        return await Promise.resolve(
          Response.json(
            { acknowledged: true },
            {
              status: 200,
            }
          )
        );
      }
      return await Promise.resolve(
        Response.json(serverEntries, { status: 200 })
      );
    });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, request, client };
}
describe("logistics unread acknowledgement", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows only small dots across the matching hierarchy, with no visible copy", () => {
    const { wrapper } = setup([
      {
        confirmationId: "confirmation-1",
        projectId: "project-1",
        type: "BANK",
        version: "v1",
      },
    ]);
    const view = render(
      <>
        <LogisticsUnreadDot />
        <LogisticsUnreadDot projectId="project-1" />
        <LogisticsUnreadDot confirmationIds={["confirmation-1"]} />
        <LogisticsUnreadDot confirmationId="confirmation-1" />
        <LogisticsUnreadDot projectId="project-2" />
        <LogisticsUnreadDot confirmationIds={[]} />
      </>,
      { wrapper }
    );
    expect(screen.getAllByTestId("logistics-unread-dot")).toHaveLength(4);
    expect(view.container.textContent).toBe("");
    expect(view.container.querySelector("[title]")).toBeNull();
    view.rerender(<LogisticsUnreadDot projectId="project-2" />);
    expect(screen.queryAllByTestId("logistics-unread-dot")).toHaveLength(0);
    expect(view.container.textContent).toBe("");
    expect(view.container.querySelector("[title]")).toBeNull();
  });

  it("clears the viewed version only and keeps the parent dot for another unread letter", async () => {
    const version = requiredFixture(
      getConfirmationLogisticsDeliveryVersion(confirmation)
    );
    const { wrapper, request } = setup([
      {
        confirmationId: "confirmation-1",
        projectId: "project-1",
        type: "BANK",
        version,
      },
      {
        confirmationId: "confirmation-2",
        projectId: "project-1",
        type: "BANK",
        version: "other",
      },
    ]);
    render(
      <>
        <LogisticsUnreadDot projectId="project-1" />
        <LogisticsUnreadDot confirmationId="confirmation-1" />
        <ConfirmationLogisticsReadMarker confirmation={confirmation} />
      </>,
      { wrapper }
    );
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        expect.stringContaining("/logistics-read"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ version }),
        })
      )
    );
    await waitFor(() =>
      expect(screen.getAllByTestId("logistics-unread-dot")).toHaveLength(1)
    );
  });

  it("does not mark a newer update read while an older tracking record is displayed", async () => {
    const { wrapper, request } = setup([
      {
        confirmationId: "confirmation-1",
        projectId: "project-1",
        type: "BANK",
        version: "newer-version",
      },
    ]);
    render(<ConfirmationLogisticsReadMarker confirmation={confirmation} />, {
      wrapper,
    });
    await waitFor(() =>
      expect(
        request.mock.calls.filter(([, options]) => options?.method === "POST")
      ).toHaveLength(0)
    );
  });
});
