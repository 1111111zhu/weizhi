import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../components/toast";
import { WorkspacesPage } from "./workspaces";

const mockRouter = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));
const mockApi = vi.hoisted(() => ({
  createWorkspace: vi.fn(),
  inboxMessages: vi.fn(),
  me: vi.fn(),
  workspaces: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/en-US/workspaces",
  useRouter: () => mockRouter,
}));

vi.mock("../api/client", () => ({
  api: mockApi,
}));

vi.mock("../i18n/client", () => ({
  useI18n: () => ({
    dictionary: {
      common: {
        returnToPortal: "Intranet",
      },
      nav: {
        account: "Current account",
        accountMenu: "Account menu",
        signOut: "Sign out",
      },
      inboxPopover: {
        pendingTitle: "Pending invitations",
        pendingDescription:
          "Open an invitation and choose a Workspace to join.",
        emptyDescription: "No pending invitations.",
        openInvitation: "Open invitation",
        openMessage: "View message",
        viewAll: "View all messages",
      },
      workItems: {
        empTitle: "EMP work items",
        opsTitle: "OPS work items",
        resizeEmp: "Resize EMP work items sidebar",
        resizeProject: "Resize project work items sidebar",
      },
      workspaces: {
        title: "Workspace",
        createTitle: "Create Workspace",
        createDescription: "Create a new client Workspace.",
        name: "Workspace name",
        namePlaceholder: "Example: Client Group",
        clientName: "Client name",
        clientNamePlaceholder: "Example: ABC Holdings",
        descriptionLabel: "Description",
        optional: "Optional",
        create: "New",
        folder: "Client folder",
        projectCountSuffix: "projects",
        emptyTitle: "No Workspaces yet",
        emptyDescription: "Nothing to show yet.",
      },
    },
    localizedPath: (pathname: string) => pathname,
  }),
}));

describe("lint test setup", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe(WorkspacesPage, () => {
    it("uses the active locale for the workspace shell copy", async () => {
      mockApi.me.mockResolvedValue({
        id: "user-partner",
        email: "partner@projectwing.local",
        name: "Jony Ma",
        globalRole: "PARTNER",
        status: "ACTIVE",
      });
      mockApi.inboxMessages.mockResolvedValue([]);
      mockApi.workspaces.mockResolvedValue([]);

      renderWorkspaces();

      await expect(
        screen.findByText("Create Workspace")
      ).resolves.toBeInTheDocument();
      expect(
        screen.getByText("Create a new client Workspace.")
      ).toBeInTheDocument();
      await waitFor(() =>
        expect(mockApi.workspaces).toHaveBeenCalledWith(expect.anything())
      );

      expect(screen.queryByText("工作区")).not.toBeInTheDocument();
      expect(screen.queryByText("创建工作区")).not.toBeInTheDocument();
      expect(
        screen.queryByText("创建新的客户工作区。")
      ).not.toBeInTheDocument();
    });
  });

  function renderWorkspaces() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    return render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(ToastProvider, null, createElement(WorkspacesPage))
      )
    );
  }
});
