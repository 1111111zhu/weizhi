import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, it, expect, vi } from "vitest";

import type { ProjectMember } from "@/api/client";

import { ProjectReauthorizationControls } from "./project-reauthorization-controls";

const restore = vi.hoisted(() => vi.fn());
vi.mock("@/api/client", () => ({ api: { reauthorizeProjectMember: restore } }));
vi.mock("@/i18n/client", () => ({ useI18n: () => ({ locale: "en-US" }) }));
const members = [
  {
    id: "pic",
    projectRole: "PARTNER",
    inChargeRole: "PARTNER_IN_CHARGE",
    user: { id: "pic", name: "PIC", globalRole: "PARTNER", status: "ACTIVE" },
  },
  {
    id: "member",
    projectRole: "PARTNER",
    inChargeRole: "PARTNER_IN_CHARGE",
    authorizationSuspendedAt: "2026-09-10",
    user: {
      id: "user",
      name: "Former manager",
      globalRole: "STAFF",
      status: "ACTIVE",
    },
  },
] as ProjectMember[];
function show(userId: string, isAdmin = false) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <ProjectReauthorizationControls
        projectId="p"
        members={members}
        userId={userId}
        isAdmin={isAdmin}
      />
    </QueryClientProvider>
  );
}
async function choose(field: string, option: string) {
  await userEvent.click(screen.getByRole("combobox", { name: field }));
  await userEvent.keyboard("{ArrowDown}");
  await userEvent.click(await screen.findByRole("option", { name: option }));
}
describe("explicit project reauthorization", () => {
  it("allows an administrator without membership to restore authorization", () => {
    show("admin", true);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("does not let a paused member or administrator restore business access", () => {
    const view = show("user");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    view.unmount();
    show("admin");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("requires the PIC to select a currently eligible role and provide a reason", async () => {
    restore.mockResolvedValue({});
    show("pic");
    await userEvent.click(
      screen.getByRole("button", { name: "Reauthorize access" })
    );
    await choose("Project member", "Former manager");
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    await choose("Project role", "Staff");
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    await userEvent.type(
      screen.getByRole("textbox", { name: "Authorization reason" }),
      "Confirmed access after grade change"
    );
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(restore).toHaveBeenCalledWith("p", "member", {
        projectRole: "PREPARER",
        reason: "Confirmed access after grade change",
      })
    );
  });
});
