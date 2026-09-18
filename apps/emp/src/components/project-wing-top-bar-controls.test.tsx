import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultDesktopAgentManagementCopy } from "../i18n/dictionaries";
import { EmpTopBarControls } from "./project-wing-top-bar-controls";

function createIntegrationsCopy() {
  return {
    title: "Connections & integrations",
    description: "Connect once and reuse integrations.",
    mailTitle: "WeCom Mail",
    mailDescription: "Send mail from the registered address.",
    loading: "Loading...",
    connected: "Connected",
    notConnected: "Not connected",
    disconnected: "Disconnected",
    connectionError: "Connection error",
    clientPassword: "Client-specific password",
    clientPasswordHelp: "Generate it in WeCom Mail settings.",
    passwordGuide: "Get password",
    passwordGuideTitle: "Get a client-specific password",
    passwordGuideSteps: ["Open webmail", "Open settings", "Generate and paste"],
    openWebmail: "Open WeCom Mail",
    connect: "Connect mailbox",
    test: "Test connection",
    testSuccess: "Connection healthy",
    disconnect: "Disconnect",
  };
}

const mockRouter = vi.hoisted(() => ({
  replace: vi.fn(),
}));
const mockApi = vi.hoisted(() => ({
  me: vi.fn(),
  listDevelopmentAccounts: vi.fn(),
  impersonateDevelopmentAccount: vi.fn(),
  signOut: vi.fn(),
  workItems: vi.fn(),
  inboxMessages: vi.fn(),
  userMailConnection: vi.fn(),
  connectUserMail: vi.fn(),
  testUserMailConnection: vi.fn(),
  disconnectUserMail: vi.fn(),
  tracking17TrackConnection: vi.fn(),
  connectTracking17Track: vi.fn(),
  testTracking17TrackConnection: vi.fn(),
  disconnectTracking17Track: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/en-US/engagement",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../api/client", () => ({
  api: mockApi,
}));

const mockTheme = vi.hoisted(() => ({
  setTheme: vi.fn(),
  setFontSize: vi.fn(),
}));

vi.mock("./theme-provider", () => ({
  useTheme: () => ({
    resolvedTheme: "light",
    mounted: true,
    fontSize: "sm",
    setTheme: mockTheme.setTheme,
    setFontSize: mockTheme.setFontSize,
  }),
}));

const mockToast = vi.hoisted(() => vi.fn());
vi.mock("./toast", () => ({
  useOptionalToast: () => null,
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("../i18n/client", () => ({
  useI18n: () => ({
    locale: "en-US",
    localizedPath: (pathname: string) =>
      pathname.startsWith("/acceptance") ? `/zh-CN${pathname}` : pathname,
    dictionary: {
      common: {
        actionsLabel: "Page shortcuts",
        moreActions: "More actions",
        returnToPortal: "返回内网门户",
        settings: "Settings",
        settingsDescription: "Page actions.",
        avatarSuffix: "avatar",
      },
      nav: {
        account: "Current account",
        accountMenu: "Account menu",
        signOut: "Sign out",
        switchAccount: "Switch account",
      },
      language: {
        label: "Language",
        zhCN: "Chinese",
        enUS: "English",
      },
      workItems: {
        empTitle: "EMP work items",
        opsTitle: "OPS work items",
        projectTitle: "Project work items",
        resizeEmp: "Resize EMP work item sidebar",
        resizeProject: "Resize project work item sidebar",
      },
      inboxPopover: {
        triggerLabel: "Inbox",
        pendingTitle: "Pending invitations",
        pendingDescription: "Open an invitation and choose a folder to join.",
        emptyDescription: "No pending invitations.",
        openInvitation: "Open invitation",
        openMessage: "View message",
        viewAll: "View all messages",
      },
      auditLogs: {
        roleLabels: {
          PRINCIPAL: "Principal",
          TAX_EXPERT: "N/A",
          ASSISTANT: "Assistant",
          EQCR: "N/A",
          SUPER_ADMIN: "System administrator",
          PARTNER: "Partner",
          MANAGER: "Manager",
          SENIOR: "Senior",
          STAFF: "Staff",
        },
      },
      workbench: {
        settingsPanel: {
          menu: {
            title: "Settings menu",
            description: "Choose a category.",
            navAriaLabel: "Settings navigation",
          },
          sections: {
            personal: {
              label: "Personalization",
              description: "Language, font size, and appearance",
            },
            integrations: {
              label: "Connections & integrations",
              description: "Connect personal services",
            },
            desktopAgent: {
              label: "Desktop Agent",
              description: "Manage Desktop Agent",
            },
            systemConnections: {
              label: "System Connections",
              description: "Shared services",
            },
          },
          desktopAgentManagement: defaultDesktopAgentManagementCopy,
          integrations: createIntegrationsCopy(),
          systemConnections: {
            title: "System Connections",
            providerName: "17TRACK",
            trackingService: "Shipment tracking",
            connected: "Connected",
            notConnected: "Not connected",
            disconnected: "17TRACK disconnected",
            connectionError: "17TRACK connection error",
            apiKey: "API Key",
            getApiKey: "Get API Key",
            connect: "Connect 17TRACK",
            test: "Test connection",
            testSuccess: "17TRACK connection healthy",
            disconnect: "Disconnect",
            quotaTotal: "Total quota",
            quotaUsed: "Used",
            quotaRemain: "Remaining",
          },
          personal: {
            darkMode: "Appearance",
            day: "Day",
            night: "Night",
            system: "System",
            fontSize: "Font size",
          },
          fontSizeOptions: { sm: "Small", md: "Medium", lg: "Large" },
        },
      },
    },
  }),
}));

describe(EmpTopBarControls, () => {
  beforeEach(() => {
    setViewportWidth(1440);
    mockApi.me.mockResolvedValue({
      id: "user-partner",
      email: "partner@projectwing.local",
      name: "Jony Ma",
      globalRole: "PARTNER",
      status: "ACTIVE",
    });
    mockApi.inboxMessages.mockResolvedValue([]);
    mockApi.workItems.mockResolvedValue({
      items: [],
      categories: [],
      counts: { total: 0, EMP: 0, PROJECT: 0, CMP: 0, TMS: 0, OPS: 0 },
    });
    mockApi.listDevelopmentAccounts.mockResolvedValue([
      {
        email: "staff@projectwing.local",
        name: "Staff",
        role: "STAFF",
      },
    ]);
    mockApi.impersonateDevelopmentAccount.mockResolvedValue({
      id: "user-staff",
      email: "staff@projectwing.local",
      name: "Staff",
      globalRole: "STAFF",
      status: "ACTIVE",
    });
    mockApi.userMailConnection.mockResolvedValue({
      emailAddress: "partner@projectwing.local",
      connected: false,
      provider: "WECOM_EXMAIL",
      status: null,
    });
    mockApi.tracking17TrackConnection.mockResolvedValue({
      provider: "TRACKING_17TRACK",
      connected: false,
      status: null,
      quotaTotal: null,
      quotaUsed: null,
      quotaRemain: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the current account rank in the shared account popover", async () => {
    renderControls();

    const accountMenuButton = await screen.findByRole("button", {
      name: "Account menu",
    });
    fireEvent.pointerEnter(accountMenuButton);

    const accountMenu = await screen.findByText("Jony Ma");
    const menuContent = accountMenu.closest(
      '[data-slot="project-wing-top-bar-account-popover"]'
    );

    expect(menuContent).not.toBeNull();
    expect(
      within(menuContent as HTMLElement).getByText("Partner")
    ).toBeTruthy();
    expect(
      within(menuContent as HTMLElement).getByText("partner@projectwing.local")
    ).toBeTruthy();
    const portal = accountMenu.closest("[data-popover-portal]");
    expect(portal).toHaveClass("project-wing-motion-popover-portal");
    expect(
      portal?.querySelector(".project-wing-motion-popover-content-layer")
    ).not.toBeNull();
    expect(
      portal?.querySelector(".project-wing-motion-popover-clip")
    ).not.toBeNull();
    expect(portal?.querySelector("feGaussianBlur")).not.toBeNull();
    expect(portal?.querySelector("feColorMatrix")).not.toBeNull();
  });

  it("keeps hover open across the portal gap and reopens after closing", async () => {
    renderControls();

    const accountMenuButton = await screen.findByRole("button", {
      name: "Account menu",
    });
    fireEvent.pointerEnter(accountMenuButton);

    const accountMenu = await screen.findByText("Jony Ma");
    const accountPopover = accountMenu.closest(
      '[data-slot="project-wing-top-bar-account-popover"]'
    );
    const popoverRoot = accountMenuButton.parentElement;
    expect(accountPopover).not.toBeNull();
    expect(popoverRoot).not.toBeNull();
    expect((accountPopover as HTMLElement).style.pointerEvents).toBe("auto");
    expect(accountPopover?.parentElement?.style.pointerEvents).toBe("none");

    fireEvent.pointerLeave(popoverRoot as HTMLElement);
    fireEvent.pointerEnter(accountPopover as HTMLElement);
    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 140);
        })
    );
    expect(screen.getByText("Jony Ma")).toBeTruthy();

    fireEvent.pointerLeave(accountPopover as HTMLElement);
    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 140);
        })
    );
    expect(screen.getByText("Jony Ma")).toBeTruthy();

    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 500);
        })
    );
    expect(screen.queryByText("Jony Ma")).toBeNull();

    fireEvent.mouseEnter(accountMenuButton);
    await expect(screen.findByText("Jony Ma")).resolves.toBeTruthy();
  });

  it("centers the account details alongside the shared avatar", async () => {
    renderControls();

    const accountMenuButton = await screen.findByRole("button", {
      name: "Account menu",
    });
    fireEvent.pointerEnter(accountMenuButton);

    const accountName = await screen.findByText("Jony Ma");
    const accountContent = accountName.closest(
      ".project-wing-top-bar-account-content"
    );

    expect(accountContent).toHaveClass("project-wing-top-bar-account-content");
    expect(accountName).toHaveClass(
      "project-wing-top-bar-account-display-name"
    );
    expect(accountContent).not.toHaveClass("min-h-15");
  });

  it("opens the shared development account selector from the account popover", async () => {
    renderControls();

    const accountMenuButton = await screen.findByRole("button", {
      name: "Account menu",
    });
    fireEvent.pointerEnter(accountMenuButton);
    expect(accountMenuButton).toHaveAttribute("aria-expanded", "true");

    const signOutButton = await screen.findByRole("button", {
      name: "Sign out",
    });
    const switchAccountButton = screen.getByRole("button", {
      name: "Switch account",
    });
    await waitFor(() =>
      expect(mockApi.listDevelopmentAccounts).toHaveBeenCalledOnce()
    );
    expect(switchAccountButton).toBeEnabled();
    expect(signOutButton).toHaveClass(
      "project-wing-top-bar-account-action",
      "project-wing-top-bar-account-action--destructive"
    );
    expect(switchAccountButton).toHaveClass(
      "project-wing-top-bar-account-action"
    );
    fireEvent.click(switchAccountButton);

    const developmentAccount = await screen.findByRole("button", {
      name: /staff@projectwing\.local/,
    });
    fireEvent.click(developmentAccount);

    await waitFor(() =>
      expect(mockApi.impersonateDevelopmentAccount).toHaveBeenCalledWith(
        "staff@projectwing.local"
      )
    );
    expect(signOutButton.parentElement).toHaveClass(
      "project-wing-top-bar-account-actions"
    );
  });

  it("does not show identity simulation when the API has no development accounts", async () => {
    mockApi.listDevelopmentAccounts.mockResolvedValue([]);
    renderControls();

    const accountMenuButton = await screen.findByRole("button", {
      name: "Account menu",
    });
    fireEvent.pointerEnter(accountMenuButton);

    await waitFor(() =>
      expect(mockApi.listDevelopmentAccounts).toHaveBeenCalledOnce()
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Switch account" })
      ).not.toBeInTheDocument()
    );
  });

  it("returns to the localized login screen after signing out", async () => {
    renderControls();

    const accountMenuButton = await screen.findByRole("button", {
      name: "Account menu",
    });
    fireEvent.pointerEnter(accountMenuButton);
    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(mockApi.signOut).toHaveBeenCalledOnce());
    expect(mockRouter.replace).toHaveBeenCalledWith("/en-US/login");
  });

  it("keeps desktop navigation expanded regardless of hover", () => {
    renderControls();

    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    const actionBars = screen.getAllByRole("toolbar", {
      name: "Page shortcuts",
    });

    expect(actionBars).toHaveLength(1);
    expect(actionBars[0]).toHaveAttribute("data-expanded", "true");
    expect(actionBars[0]).toHaveAttribute("data-motion", "animated");

    fireEvent.mouseEnter(actionBars[0]);
    fireEvent.mouseLeave(actionBars[0]);
    expect(actionBars[0]).toHaveAttribute("data-expanded", "true");
  });

  it("keeps home, confirmation, inbox, and settings in order", () => {
    renderControls({
      actionItems: [
        { id: "confirmation-center", label: "Confirmation Center", icon: null },
      ],
    });

    const actionBar = screen.getByRole("toolbar", { name: "Page shortcuts" });
    expect(
      within(actionBar)
        .getAllByRole("button")
        .map((button) => button.dataset.actionId)
    ).toStrictEqual(["home", "confirmation-center", "tasks", "settings"]);
  });

  it("places custom settings after work items", () => {
    renderControls({
      showSettingsButton: false,
      actionItems: [
        { id: "engagement", label: "Projects", icon: null },
        { id: "settings", label: "Project settings", icon: null },
      ],
    });

    const actionBar = screen.getByRole("toolbar", { name: "Page shortcuts" });
    expect(
      within(actionBar)
        .getAllByRole("button")
        .map((button) => button.dataset.actionId)
    ).toStrictEqual(["home", "engagement", "tasks", "settings"]);
    expect(
      within(actionBar).getByRole("button", { name: "Project settings" })
    ).toBeInTheDocument();
  });

  it("keeps tablet actions as icons and opens the labelled chevron menu", async () => {
    setViewportWidth(900);
    renderControls({
      responsiveProjectHome: true,
      actionItems: [
        { id: "confirmation-center", label: "Confirmation Center", icon: null },
      ],
    });

    const actionBar = await screen.findByRole("toolbar", {
      name: "Page shortcuts",
    });
    expect(actionBar).toHaveAttribute("data-expanded", "false");
    expect(
      within(actionBar)
        .getAllByRole("button")
        .map((button) => button.dataset.actionId)
    ).toStrictEqual(["home", "confirmation-center", "tasks", "settings"]);

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    const menu = await screen.findByRole("menu");
    expect(
      within(menu).getByRole("menuitem", { name: "Confirmation Center" })
    ).toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", { name: "EMP work items" })
    ).toBeInTheDocument();
  });

  it("moves phone actions into the bottom action sheet", async () => {
    setViewportWidth(390);
    const onSearch = vi.fn();
    renderControls({
      responsiveProjectHome: true,
      compactSearchAction: {
        id: "search",
        label: "Search projects",
        icon: null,
        onClick: onSearch,
      },
      actionItems: [
        { id: "confirmation-center", label: "Confirmation Center", icon: null },
      ],
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Search projects" })
    );
    expect(onSearch).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("toolbar", { name: "Page shortcuts" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    const menu = await screen.findByRole("dialog", { name: "More actions" });
    expect(
      within(menu).getByRole("button", { name: "Confirmation Center" })
    ).toBeInTheDocument();
  });

  it.each([768, 900, 1023])(
    "uses the avatar menu for the compact project workspace at %ipx",
    async (viewportWidth) => {
      setViewportWidth(viewportWidth);
      const onProject = vi.fn();

      renderControls({
        responsiveProjectWorkspace: true,
        inboxAction: false,
        mobileSearchContent: <input aria-label="Search project files" />,
        mobileWorkspaceActionItems: [
          { id: "projects", label: "Projects", icon: null, onClick: onProject },
          { id: "confirmations", label: "Confirmation Center", icon: null },
        ],
      });

      const trigger = await screen.findByTestId(
        "mobile-workspace-avatar-menu-trigger"
      );
      fireEvent.click(trigger);

      const menu = await screen.findByTestId("mobile-workspace-avatar-menu");
      expect(
        within(menu).getByRole("button", { name: "Search files" })
      ).toBeInTheDocument();
      expect(
        within(menu).getByRole("menuitem", { name: "Projects" })
      ).toBeInTheDocument();
      expect(
        within(menu).getByRole("menuitem", { name: "Confirmation Center" })
      ).toBeInTheDocument();
      expect(
        within(menu).getByRole("menuitem", { name: "EMP work items" })
      ).toBeInTheDocument();
      expect(
        within(menu).getByRole("menuitem", { name: "Settings" })
      ).toBeInTheDocument();
      expect(within(menu).queryByText("Switch account")).toBeNull();
      expect(within(menu).queryByText("Staff")).toBeNull();

      fireEvent.click(
        within(menu).getByRole("button", { name: "Search files" })
      );
      await expect(
        screen.findByRole("textbox", { name: "Search project files" })
      ).resolves.toBeInTheDocument();

      fireEvent.click(trigger);
      await waitFor(() => {
        expect(
          screen.queryByTestId("mobile-workspace-avatar-menu")
        ).not.toBeInTheDocument();
      });
      expect(onProject).not.toHaveBeenCalled();
    }
  );

  it("restores the desktop workspace actions at 1024px", async () => {
    setViewportWidth(1024);
    renderControls({
      responsiveProjectWorkspace: true,
      inboxAction: false,
      mobileWorkspaceActionItems: [
        { id: "projects", label: "Projects", icon: null },
      ],
    });

    await waitFor(() => {
      expect(
        screen.queryByTestId("mobile-workspace-avatar-menu-trigger")
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole("toolbar", { name: "Page shortcuts" })
    ).toBeInTheDocument();
  });

  it("keeps the shared home shortcut visible after pointer leave", () => {
    renderControls();

    const homeButton = screen.getByRole("button", { name: "Home" });
    const homeIcon = within(homeButton).getByTestId("emp-home-icon");
    const actionBar = screen.getByRole("toolbar", {
      name: "Page shortcuts",
    });

    fireEvent.mouseEnter(homeButton);
    expect(actionBar).toHaveAttribute("data-expanded", "true");
    expect(homeIcon).not.toHaveClass("text-muted-foreground/70");

    fireEvent.mouseLeave(actionBar);
    expect(actionBar).toHaveAttribute("data-expanded", "true");
  });

  it("opens EMP work items in a right-side drawer", async () => {
    const now = "2026-08-31T08:00:00.000Z";
    mockApi.workItems.mockResolvedValue({
      items: [
        {
          id: "EMP-001:user-partner",
          ruleId: "EMP-001",
          domain: "EMP",
          view: "PERSONAL",
          category: "DECLARATION",
          state: "OPEN",
          severity: "BLOCKER",
          priority: "URGENT",
          title: "Sign the system declaration",
          description: "Complete the declaration",
          subjectType: "USER_DECLARATION",
          subjectId: "user-partner",
          reference: null,
          objectLabel: "Jony Ma",
          responsibleLabel: "Jony Ma",
          assignedTo: {
            id: "user-partner",
            name: "Jony Ma",
            email: "partner@projectwing.local",
          },
          createdBy: null,
          dueAt: null,
          openedAt: now,
          updatedAt: now,
          project: null,
          actionTarget: {
            app: "EMP",
            resourceType: "SYSTEM_DECLARATION",
            resourceId: "user-partner",
            params: {},
          },
        },
      ],
      categories: [],
      counts: { total: 1, EMP: 1, PROJECT: 0, CMP: 0, TMS: 0, OPS: 0 },
    });
    renderControls();

    fireEvent.click(
      await screen.findByRole("button", { name: "EMP work items" })
    );

    await expect(
      screen.findByRole("dialog", { name: "EMP work items" })
    ).resolves.toBeInTheDocument();
    await expect(
      screen.findByText("Sign the system declaration")
    ).resolves.toBeInTheDocument();
    expect(mockApi.workItems).toHaveBeenCalledWith({
      view: "PERSONAL",
      scope: "EMP",
      locale: "en-US",
    });
  });

  it("keeps failures isolated to the selected work item scope", async () => {
    mockApi.me.mockResolvedValue({
      id: "admin-1",
      email: "admin@projectwing.local",
      name: "System Admin",
      globalRole: "SUPER_ADMIN",
      status: "ACTIVE",
    });
    mockApi.workItems.mockImplementation((input: { scope?: "EMP" | "OPS" }) =>
      input.scope === "OPS"
        ? Promise.reject(new Error("OPS unavailable"))
        : Promise.resolve({
            items: [],
            categories: [],
            counts: {
              total: 0,
              EMP: 0,
              PROJECT: 0,
              CMP: 0,
              TMS: 0,
              OPS: 0,
            },
          })
    );
    renderControls();

    fireEvent.click(
      await screen.findByRole("button", { name: "EMP work items" })
    );

    await expect(
      screen.findByText("No active work items")
    ).resolves.toBeTruthy();
    expect(screen.queryByText("Unable to load work items.")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "OPS work items0" }));
    await expect(
      screen.findByText("Unable to load work items.")
    ).resolves.toBeTruthy();
  });

  it("keeps account integrations in the global settings navigation", async () => {
    renderControls();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    const settingsPanel = await screen.findByTestId("global-settings-panel");
    expect(
      within(settingsPanel).getByRole("tab", { name: "Chinese" })
    ).toBeInTheDocument();
    expect(
      within(settingsPanel).getByRole("tab", { name: "English" })
    ).toBeInTheDocument();
    expect(
      within(settingsPanel).getByRole("radio", { name: "System" })
    ).toBeInTheDocument();
    expect(
      within(settingsPanel).getByRole("radio", { name: "Day" })
    ).toBeChecked();
    fireEvent.click(
      within(settingsPanel).getByRole("radio", { name: "Night" })
    );
    expect(mockTheme.setTheme).toHaveBeenCalledWith("dark");
    fireEvent.click(
      within(settingsPanel).getByRole("radio", { name: "System" })
    );
    expect(mockTheme.setTheme).toHaveBeenCalledWith("system");
    fireEvent.click(within(settingsPanel).getByRole("tab", { name: "Large" }));
    expect(mockTheme.setFontSize).toHaveBeenCalledWith("lg");
    const navigation = within(settingsPanel).getByRole("complementary", {
      name: "Settings navigation",
    });
    expect(
      within(navigation)
        .getAllByRole("button")
        .map((tab) => tab.textContent)
    ).toStrictEqual([
      "Personalization",
      "Desktop Agent",
      "Connections & integrations",
    ]);

    fireEvent.click(
      within(navigation).getByRole("button", {
        name: "Connections & integrations",
      })
    );

    await expect(
      screen.findByTestId("user-integrations-settings")
    ).resolves.toBeTruthy();
    await expect(
      within(screen.getByTestId("user-integrations-settings")).findByText(
        "partner@projectwing.local"
      )
    ).resolves.toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Get password" }));
    await expect(
      screen.findByRole("link", {
        name: "Open webmail",
      })
    ).resolves.toHaveAttribute("href", "https://exmail.qq.com/");
  });

  it("shows shared system connections only to Super Admins", async () => {
    mockApi.me.mockResolvedValue({
      id: "admin-1",
      email: "admin@projectwing.local",
      name: "System Admin",
      globalRole: "SUPER_ADMIN",
      status: "ACTIVE",
    });
    renderControls();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const settingsPanel = await screen.findByTestId("global-settings-panel");
    const navigation = within(settingsPanel).getByRole("complementary", {
      name: "Settings navigation",
    });
    await waitFor(() =>
      expect(
        within(navigation)
          .getAllByRole("button")
          .map((tab) => tab.textContent)
      ).toStrictEqual([
        "Personalization",
        "Desktop Agent",
        "Connections & integrations",
        "System Connections",
      ])
    );

    fireEvent.click(
      within(navigation).getByRole("button", {
        name: "System Connections",
      })
    );
    await expect(
      screen.findByTestId("system-connections-settings")
    ).resolves.toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Connect 17TRACK" })
    ).toBeDisabled();
    mockApi.connectTracking17Track.mockRejectedValue(
      new Error("17TRACK 连接失败，请检查 API Key")
    );
    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "invalid-test-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect 17TRACK" }));
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({
        title: "17TRACK connection error",
        description: "17TRACK 连接失败，请检查 API Key",
        variant: "destructive",
      })
    );
  });
});

function renderControls(
  props: Partial<Parameters<typeof EmpTopBarControls>[0]> = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <EmpTopBarControls {...props} />
    </QueryClientProvider>
  );
}

function setViewportWidth(width: number) {
  vi.mocked(window.matchMedia).mockImplementation((query: string) => {
    const maxWidth = /max-width:\s*([\d.]+)px/.exec(query)?.[1];
    const minWidth = /min-width:\s*([\d.]+)px/.exec(query)?.[1];
    return {
      matches:
        Boolean(maxWidth || minWidth) &&
        (!maxWidth || width <= Number(maxWidth)) &&
        (!minWidth || width >= Number(minWidth)),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });
}
