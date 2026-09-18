import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, it, expect, vi } from "vitest";

import type { ProjectMember } from "@/api/client";

import { ProjectLeadershipControls } from "./project-leadership-controls";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  recover: vi.fn(),
  invite: vi.fn(),
  directory: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/api/client", () => ({
  api: {
    updateProjectMemberInChargeRole: mocks.update,
    recoverProjectPic: mocks.recover,
    createPicRecoveryInvitation: mocks.invite,
    userDirectory: mocks.directory,
  },
}));
vi.mock("@/i18n/client", () => ({ useI18n: () => ({ locale: "en-US" }) }));
const members: ProjectMember[] = [
  {
    id: "pic",
    projectRole: "PARTNER",
    inChargeRole: "PARTNER_IN_CHARGE",
    user: {
      id: "pic",
      name: "Current PIC",
      globalRole: "PARTNER",
      status: "ACTIVE",
    },
  },
  {
    id: "manager",
    projectRole: "REVIEWER",
    inChargeRole: null,
    user: {
      id: "manager",
      name: "Manager",
      globalRole: "MANAGER",
      status: "ACTIVE",
    },
  },
  {
    id: "principal",
    projectRole: "REVIEWER",
    inChargeRole: null,
    user: {
      id: "principal",
      name: "Principal",
      globalRole: "PRINCIPAL",
      status: "ACTIVE",
    },
  },
] as ProjectMember[];
function show(userId: string, isAdmin = false, rows = members) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <ProjectLeadershipControls
        projectId="p"
        userId={userId}
        isAdmin={isAdmin}
        members={rows}
      />
    </QueryClientProvider>
  );
}
describe("project leadership controls", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it("allows administrators to manage leadership while ordinary managers cannot", () => {
    const view = show("manager");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    view.unmount();
    show("admin", true);
    expect(
      screen.getByRole("button", { name: "Set project leadership" })
    ).toBeInTheDocument();
  });

  it("allows the effective PIC to select an eligible MIC", async () => {
    mocks.update.mockResolvedValue(members[1]);
    show("pic");
    await userEvent.click(
      screen.getByRole("button", { name: "Set project leadership" })
    );
    await userEvent.click(
      screen.getByRole("combobox", { name: "Leadership role" })
    );
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.click(await screen.findByRole("option", { name: "MIC" }));
    await userEvent.click(
      screen.getByRole("combobox", { name: "Project member" })
    );
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.click(
      await screen.findByRole("option", { name: "Manager" })
    );
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(mocks.update).toHaveBeenCalledWith("p", "manager", {
      inChargeRole: "MANAGER_IN_CHARGE",
    });
    expect(mocks.recover).not.toHaveBeenCalled();
  });

  it("requires a reason for explicit administrator recovery and permits eligible Principal members", async () => {
    mocks.recover.mockResolvedValue(members[2]);
    show("admin", true, members.slice(1));
    await userEvent.click(
      screen.getByRole("button", { name: "Recover project PIC" })
    );
    await userEvent.click(
      screen.getByRole("combobox", { name: "Project member" })
    );
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.click(
      await screen.findByRole("option", { name: "Principal" })
    );
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    await userEvent.type(
      screen.getByRole("textbox", { name: "Recovery reason" }),
      "Previous PIC unavailable"
    );
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(mocks.recover).toHaveBeenCalledWith("p", "principal", {
      reason: "Previous PIC unavailable",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not allow removal of the last PIC or offer self assignment", async () => {
    show("pic");
    await userEvent.click(
      screen.getByRole("button", { name: "Set project leadership" })
    );
    await userEvent.click(
      screen.getByRole("combobox", { name: "Project member" })
    );
    expect(
      screen.queryByRole("option", { name: "Current PIC" })
    ).not.toBeInTheDocument();
  });

  it("sends an invitation, not a PIC assignment, when no joined candidate is available", async () => {
    mocks.directory.mockResolvedValue([{ ...members[2].user, id: "unjoined" }]);
    mocks.invite.mockResolvedValue({ id: "invitation" });
    show("admin", true, [members[1]]);
    await userEvent.click(
      screen.getByRole("button", { name: "Recover project PIC" })
    );
    expect(
      screen.getByRole("heading", { name: "Invite a PIC recovery candidate" })
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("combobox", { name: "Project member" })
    );
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.click(
      await screen.findByRole("option", { name: "Principal" })
    );
    expect(
      screen.getByRole("button", { name: "Invite to join" })
    ).toBeDisabled();
    await userEvent.type(
      screen.getByRole("textbox", { name: "Recovery reason" }),
      "No eligible joined member"
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Invite to join" })
    );
    expect(mocks.invite).toHaveBeenCalledWith("p", {
      recipientUserId: "unjoined",
      reason: "No eligible joined member",
    });
    expect(mocks.recover).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
