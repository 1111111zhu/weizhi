import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../components/toast";
import { MembersPage } from "./members";

const mockRouter = vi.hoisted(() => ({
  replace: vi.fn(),
}));
const mockApi = vi.hoisted(() => ({
  me: vi.fn(),
  project: vi.fn(),
  members: vi.fn(),
  projectMemberDirectory: vi.fn(),
  userDirectory: vi.fn(),
  createInvitation: vi.fn(),
  updateProjectMemberRole: vi.fn(),
  removeProjectMember: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/engagement/project-1/members",
}));

vi.mock("../api/client", () => ({
  api: mockApi,
}));

vi.mock("../i18n/client", () => ({
  useI18n: () => ({
    locale: "en-US",
    dictionary: {
      common: {
        back: "Back",
        cancel: "Cancel",
      },
      projects: {
        memberManagementTitle: "Member management",
        inviteMember: "Invite member",
        inviteProjectMembers: "Invite project members",
        loadingAvailableUsers: "Loading available users...",
        noInviteableUsers: "No inviteable users.",
        inviteAction: "Invite",
        memberSearch: "Search members",
        memberSearchPlaceholder: "Search or invite...",
        memberCount: "{count} members",
        memberCountOne: "{count} member",
        cancelInvitation: "Cancel",
        cancelInvitationDescription: "Cancel the invitation to {name}?",
        activeStatus: "Active",
        invitedStatus: "Invited",
        notInvitedStatus: "Not invited",
        memberColumn: "Member",
        rankColumn: "Rank",
        roleInEngagementColumn: "Role in engagement",
        independenceColumn: "Independence",
        statusColumn: "Status",
        actionsColumn: "Actions",
        independenceSigned: "Signed",
        independenceNotSigned: "Not signed",
        independenceSigner: "Signer",
        independenceSigningMethod: "Signing method",
        independenceElectronicSignOff: "Electronic sign-off",
        independencePendingSignOff: "Pending sign-off",
        independenceSignedAt: "Signed at",
        removeAction: "Remove",
      },
    },
    localizedPath: (pathname: string) => pathname,
  }),
}));

describe("lint test setup", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe(MembersPage, () => {
    it("allows an administrator without membership to invite project members", async () => {
      setupApi();
      mockApi.me.mockResolvedValue({
        id: "admin",
        email: "admin@example.test",
        name: "Admin",
        globalRole: "SUPER_ADMIN",
        status: "ACTIVE",
      });
      renderMembersPage();
      fireEvent.change(
        await screen.findByRole("searchbox", { name: "Search members" }),
        { target: { value: "Sam" } }
      );
      await expect(
        screen.findByRole("button", { name: /Invite Sam Lu/ })
      ).resolves.toBeEnabled();
    });

    it("uses a single-column mobile member list and keeps rank distinct from engagement role", async () => {
      setMobileViewport();
      setupApi();
      const members = await mockApi.projectMemberDirectory();
      members[0].inChargeRole = "PARTNER_IN_CHARGE";
      members[1].authorizationSuspendedAt = "2026-09-12T00:00:00.000Z";
      mockApi.projectMemberDirectory.mockResolvedValue(members);
      renderMembersPage();

      const list = await screen.findByTestId("emp-mobile-member-list");
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      const partner = within(list)
        .getByText("Jony Ma")
        .closest("li") as HTMLElement;
      expect(
        within(partner).getByText("partner@projectwing.local")
      ).toBeInTheDocument();
      expect(within(partner).getByText("Rank")).toBeInTheDocument();
      expect(
        within(partner).getByText("Role in engagement")
      ).toBeInTheDocument();
      expect(within(partner).getByText("Partner")).toBeInTheDocument();
      expect(
        within(partner).getByText("Partner in Charge")
      ).toBeInTheDocument();
      expect(screen.getByText("Reauthorization required")).toBeInTheDocument();
      expect(screen.getByText("Invited")).toBeInTheDocument();
      expect(screen.getByText("4 members")).toBeInTheDocument();

      expect(
        screen.queryByRole("button", { name: "Set project leadership" })
      ).not.toBeInTheDocument();
      fireEvent.click(
        screen.getByRole("button", { name: "Member management · Actions" })
      );
      await expect(
        screen.findByRole("dialog", { name: "Member management" })
      ).resolves.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Set project leadership" })
      ).toBeInTheDocument();
      expect(vi.mocked(mockApi.updateProjectMemberRole)).toHaveBeenCalledTimes(
        0
      );
    });

    it("keeps mobile search, invitation and row permissions on their existing handlers", async () => {
      setMobileViewport();
      setupApi();
      mockApi.createInvitation.mockResolvedValue({
        inviteUrl: "https://wing.example/invitations/token",
        delivery: null,
      });
      renderMembersPage();

      await screen.findByTestId("emp-mobile-member-list");
      fireEvent.click(
        screen.getByRole("button", { name: "Jony Ma · Actions" })
      );
      const details = await screen.findByRole("dialog", { name: "Jony Ma" });
      expect(within(details).getByText("Active")).toBeInTheDocument();
      expect(
        within(details).getByRole("button", {
          name: "IndependenceStatus：Jony Ma",
        })
      ).toBeInTheDocument();
      expect(
        within(details).queryByRole("button", { name: "Remove Jony Ma" })
      ).not.toBeInTheDocument();
      fireEvent.click(within(details).getByRole("button", { name: "Close" }));
      fireEvent.change(
        screen.getByRole("searchbox", { name: "Search members" }),
        { target: { value: "Sam Lu" } }
      );
      fireEvent.click(
        await screen.findByRole("button", { name: "Sam Lu · Actions" })
      );
      fireEvent.click(
        await screen.findByRole("button", { name: "Invite Sam Lu" })
      );
      await waitFor(() =>
        expect(mockApi.createInvitation).toHaveBeenCalledWith("project-1", {
          recipientUserId: "user-staff-2",
          invitedRole: "PREPARER",
          expiresInDays: 7,
        })
      );
    });

    it("keeps mobile searches recoverable when no member matches", async () => {
      setMobileViewport();
      setupApi();
      renderMembersPage();
      fireEvent.change(
        await screen.findByRole("searchbox", { name: "Search members" }),
        { target: { value: "no-such-member" } }
      );
      await expect(
        screen.findByText("No matching results")
      ).resolves.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Back" }));
      await expect(screen.findByText("Jony Ma")).resolves.toBeInTheDocument();
    });

    it("renders joined and invited project members without listing unrelated directory users", async () => {
      setupApi();
      renderMembersPage();

      const table = await screen.findByRole("table", {
        name: "Member management",
      });
      expect(table).toBeInTheDocument();
      expect(
        screen.queryByRole("columnheader", { name: "Alias" })
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("columnheader", { name: "Rank" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("columnheader", { name: "Role in engagement" })
      ).toBeInTheDocument();
      expect(screen.getByText("Jony Ma")).toBeInTheDocument();
      expect(screen.getByText("Ivy Ng")).toBeInTheDocument();
      expect(screen.queryByText("Sam Lu")).not.toBeInTheDocument();
      expect(
        screen.queryByText("staff2@projectwing.local")
      ).not.toBeInTheDocument();
      expect(screen.getAllByText("Staff").length).toBeGreaterThan(0);
      expect(screen.queryByText("Preparer")).not.toBeInTheDocument();
      expect(screen.queryByText("Tax Reviewer")).not.toBeInTheDocument();
      expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
      expect(screen.getByText("Invited")).toBeInTheDocument();
      expect(screen.queryByText("Not invited")).not.toBeInTheDocument();
      expect(
        screen.getByRole("searchbox", { name: "Search members" })
      ).toBeInTheDocument();
      expect(screen.queryByText("Valid days")).not.toBeInTheDocument();
      expect(screen.queryByText(/先选择系统人员/)).not.toBeInTheDocument();
      expect(
        screen.queryByText(/EQCR 和 Tax Reviewer/)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Project roles are project-level state/)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Partner \/ Manager can maintain/)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Select a recipient from/)
      ).not.toBeInTheDocument();
    }, 15_000);

    it("shows independence sign-off details from the badge hover card", async () => {
      setupApi();
      renderMembersPage();

      await screen.findByRole("table", { name: "Member management" });
      fireEvent.mouseEnter(
        screen.getByRole("button", {
          name: "IndependenceStatus：Jony Ma",
        })
      );

      await expect(screen.findByText("Signer")).resolves.toBeInTheDocument();
      expect(screen.getByText("Electronic sign-off")).toBeInTheDocument();
      expect(screen.queryByText(/09:00/)).toBeNull();
    });

    it("shows firm rank separately from role in engagement", async () => {
      setupApi();
      mockApi.projectMemberDirectory.mockResolvedValue([
        {
          id: "member-partner",
          projectRole: "PARTNER",
          inChargeRole: "PARTNER_IN_CHARGE",
          allowedProjectRoles: ["PARTNER", "EQCR"],
          roleConsistent: true,
          declarationAccepted: true,
          declarationAcceptedAt: "2026-05-28T09:00:00.000Z",
          user: {
            id: "user-partner",
            email: "partner@projectwing.local",
            name: "Jony Ma",
            globalRole: "PARTNER",
            status: "ACTIVE",
          },
        },
        {
          id: "member-tax",
          projectRole: "TAX_REVIEWER",
          inChargeRole: null,
          allowedProjectRoles: ["TAX_REVIEWER"],
          roleConsistent: true,
          declarationAccepted: true,
          user: {
            id: "user-tax",
            email: "tax@projectwing.local",
            name: "Yina Gao",
            globalRole: "TAX_EXPERT",
            status: "ACTIVE",
          },
        },
      ]);
      renderMembersPage();

      const partnerCell = await screen.findByText("Jony Ma", {
        selector: ":not([hidden])",
      });
      const partnerRow = partnerCell.closest('[role="row"]');
      expect(partnerRow).not.toBeNull();
      expect(
        within(partnerRow as HTMLElement).getByText("Partner")
      ).toBeInTheDocument();
      expect(
        within(partnerRow as HTMLElement).getByText("Partner")
      ).toBeInTheDocument();

      const expertRow = screen.getByText("Yina Gao").closest('[role="row"]');
      expect(expertRow).not.toBeNull();
      expect(
        within(expertRow as HTMLElement).getByText("N/A")
      ).toBeInTheDocument();
      expect(
        within(expertRow as HTMLElement).getByText("Expert")
      ).toBeInTheDocument();
    });

    it("invites ordinary members without asking for a preparer or reviewer role", async () => {
      setupApi();
      mockApi.createInvitation.mockResolvedValue({
        inviteUrl: "https://wing.example/invitations/token",
        delivery: null,
      });
      renderMembersPage();

      expect(screen.queryByLabelText("Project role")).toBeNull();
      fireEvent.change(
        await screen.findByRole("searchbox", { name: "Search members" }),
        {
          target: { value: "Sam Lu" },
        }
      );
      fireEvent.click(
        await screen.findByRole(
          "button",
          { name: /Invite Sam Lu/ },
          { timeout: 5000 }
        )
      );

      await waitFor(() => {
        expect(mockApi.createInvitation).toHaveBeenCalledWith("project-1", {
          recipientUserId: "user-staff-2",
          invitedRole: "PREPARER",
          expiresInDays: 7,
        });
      });
    }, 15_000);

    it("defaults Tax Expert invitations to the tax reviewer project role", async () => {
      setupApi();
      mockApi.createInvitation.mockResolvedValue({
        inviteUrl: "https://wing.example/invitations/tax-token",
        delivery: null,
      });
      renderMembersPage();

      fireEvent.change(
        await screen.findByRole("searchbox", { name: "Search members" }),
        {
          target: { value: "Yina Gao" },
        }
      );
      fireEvent.click(
        await screen.findByRole(
          "button",
          { name: /Invite Yina Gao/ },
          { timeout: 5000 }
        )
      );

      await waitFor(() => {
        expect(mockApi.createInvitation).toHaveBeenCalledWith("project-1", {
          recipientUserId: "user-tax",
          invitedRole: "TAX_REVIEWER",
          expiresInDays: 7,
        });
      });
    }, 15_000);
  });

  function renderMembersPage() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    return render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          ToastProvider,
          null,
          createElement(MembersPage, {
            projectId: "project-1",
            workspaceId: "workspace-1",
            presentation: "sheet",
          })
        )
      )
    );
  }

  function setMobileViewport() {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(max-width: 767px)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );
  }

  function setupApi() {
    mockApi.me.mockResolvedValue({
      id: "user-partner",
      email: "partner@projectwing.local",
      name: "Jony Ma",
      globalRole: "PARTNER",
      status: "ACTIVE",
    });
    mockApi.project.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-1",
      projectCode: "AUD-2026-0001",
      name: "Company Name",
      frameworkTemplateId: "framework-hkfrs",
      frameworkTemplate: {
        id: "framework-hkfrs",
        code: "HKFRS",
        name: "HKFRS audit framework",
        language: "zh-CN",
        isActive: true,
      },
      reportingDate: "2026-12-31T00:00:00.000Z",
      status: "ACTIVE",
    });
    const members = [
      {
        id: "member-partner",
        projectRole: "PARTNER",
        inChargeRole: null as string | null,
        allowedProjectRoles: ["PARTNER"],
        roleConsistent: true,
        declarationAccepted: true,
        declarationAcceptedAt: "2026-05-28T09:00:00.000Z",
        user: {
          id: "user-partner",
          email: "partner@projectwing.local",
          name: "Jony Ma",
          globalRole: "PARTNER",
          status: "ACTIVE",
        },
      },
      {
        id: "member-manager",
        projectRole: "PREPARER",
        inChargeRole: null as string | null,
        allowedProjectRoles: ["PREPARER"],
        roleConsistent: true,
        declarationAccepted: true,
        user: {
          id: "user-manager",
          email: "manager@projectwing.local",
          name: "Mia Wong",
          globalRole: "MANAGER",
          status: "ACTIVE",
        },
      },
      {
        id: "member-staff",
        projectRole: "PREPARER",
        inChargeRole: null as string | null,
        allowedProjectRoles: ["PREPARER"],
        roleConsistent: true,
        declarationAccepted: true,
        user: {
          id: "user-staff",
          email: "staff@projectwing.local",
          name: "King Su",
          globalRole: "STAFF",
          status: "ACTIVE",
        },
      },
      {
        id: "invitation-initial",
        membershipStatus: "INVITED",
        invitationId: "invite-1",
        invitationExpiresAt: "2026-06-30T00:00:00.000Z",
        invitedAt: "2026-06-01T00:00:00.000Z",
        projectRole: "PREPARER",
        inChargeRole: null as string | null,
        allowedProjectRoles: ["PREPARER"],
        roleConsistent: true,
        declarationAccepted: false,
        declarationAcceptedAt: null,
        user: {
          id: "user-invited",
          email: "ivy@projectwing.local",
          name: "Ivy Ng",
          globalRole: "SENIOR",
          status: "ACTIVE",
        },
      },
    ];
    mockApi.members.mockResolvedValue(
      members.filter((member) => member.membershipStatus !== "INVITED")
    );
    mockApi.projectMemberDirectory.mockResolvedValue(members);
    mockApi.userDirectory.mockResolvedValue([
      {
        id: "user-tax",
        email: "tax@projectwing.local",
        name: "Yina Gao",
        globalRole: "TAX_EXPERT",
        status: "ACTIVE",
      },
      {
        id: "user-staff-2",
        email: "staff2@projectwing.local",
        name: "Sam Lu",
        globalRole: "STAFF",
        status: "ACTIVE",
      },
    ]);
  }
});
