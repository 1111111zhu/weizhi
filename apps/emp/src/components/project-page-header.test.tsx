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
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Project, User } from "../api/client";
import { ProjectPageHeader } from "./project-page-header";

function createIntegrationsCopy() {
  return {
    title: "连接与集成",
    description: "一次连接，全局复用。",
    mailTitle: "企业微信邮箱",
    mailDescription: "使用注册邮箱发送邮件。",
    loading: "正在加载...",
    connected: "已连接",
    notConnected: "尚未连接",
    disconnected: "已断开",
    connectionError: "连接异常",
    clientPassword: "客户端专用密码",
    clientPasswordHelp: "请在企业微信邮箱设置中生成。",
    passwordGuide: "如何获取？",
    passwordGuideTitle: "获取客户端专用密码",
    passwordGuideSteps: ["登录邮箱", "打开设置", "生成并粘贴"],
    openWebmail: "打开企业邮箱",
    connect: "连接邮箱",
    test: "测试连接",
    testSuccess: "连接正常",
    disconnect: "断开连接",
  };
}

const mockRouter = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
const mockApi = vi.hoisted(() => ({
  me: vi.fn(),
  listDevelopmentAccounts: vi.fn(),
  impersonateDevelopmentAccount: vi.fn(),
  inboxMessages: vi.fn(),
  workItems: vi.fn(),
  signOut: vi.fn(),
  userMailConnection: vi.fn(),
  connectUserMail: vi.fn(),
  testUserMailConnection: vi.fn(),
  disconnectUserMail: vi.fn(),
}));
const mockI18n = vi.hoisted(() => ({
  dictionary: {
    nav: {
      workspace: "工作区",
      inbox: "消息",
      admin: "管理",
      signOut: "退出",
      account: "当前账号",
      accountMenu: "账号菜单",
    },
    common: {
      settings: "设置",
      systemManagement: "系统管理",
      userManagement: "用户管理",
      rolePermissions: "角色权限",
      avatarSuffix: "头像",
    },
    language: {
      label: "语言",
      zhCN: "中文",
      enUS: "English",
    },
    workItems: {
      empTitle: "EMP 待办",
      opsTitle: "OPS 待办",
      projectTitle: "项目待办",
      resizeEmp: "调整 EMP 待办侧栏宽度",
      resizeProject: "调整项目待办侧栏宽度",
    },
    inboxPopover: {
      triggerLabel: "收件箱",
      pendingTitle: "待处理邀请",
      pendingDescription: "打开邀请后选择工作区即可加入项目。",
      emptyDescription: "暂无待处理邀请。",
      openInvitation: "打开邀请",
      openMessage: "查看消息",
      viewAll: "查看全部消息",
    },
    projects: {
      fallbackProjectName: "项目名称",
      fallbackClientName: "客户名称",
      fallbackProject: "项目",
      projectList: "项目列表",
      unassignedClient: "未关联客户",
      identityBreadcrumbLabel: "项目路径",
      viewClientProjects: "查看该客户的项目",
      archivedStatus: "已归档",
      cmpArchivedStatus: "CMP 已归档",
      pendingFinalCheckStatus: "待归档审核",
      settingsTitle: "项目设置",
      settingsDescription: "管理当前项目和选中的工作台节点。",
      actionsLabel: "项目快捷操作",
      members: "成员与邀请",
      tabs: {
        overview: "总览",
        auditLogs: "日志",
      },
      reviewQuestions: {
        trigger: "注释",
        title: "项目注释清单",
        description: "集中查看当前项目内所有注释，点击后进入对应底稿处理。",
        stats: {
          all: "全部注释",
          unresolved: "未关闭",
          replied: "已回复",
          cleared: "已关闭",
        },
        filters: {
          all: "全部",
          unresolved: "未关闭",
          replied: "已回复",
          cleared: "已关闭",
        },
        statusLabels: {
          OPEN: "Open",
          REPLIED: "Replied",
          CLEARED: "Cleared",
        },
        timeline: {
          today: "今天",
          yesterday: "昨天",
          lastSevenDays: "近 7 天",
          earlier: "更早",
        },
        assignee: "负责人",
        unassigned: "未分配",
        createdBy: "创建人",
        updatedAt: "更新",
        openQuestion: "前往",
        emptyTitle: "当前项目暂无注释",
        emptyDescription: "项目里创建注释后，会在这里集中展示。",
        noMatchesTitle: "当前筛选暂无匹配注释",
        noMatchesDescription: "切换筛选条件后可以查看其他状态的注释。",
      },
    },
    workbench: {
      settingsPanel: {
        menu: {
          title: "设置菜单",
          description: "选择分类",
          navAriaLabel: "设置导航",
        },
        sections: {
          personal: {
            label: "个性化",
            description: "语言、字号和外观",
          },
          integrations: {
            label: "连接与集成",
            description: "连接个人服务",
          },
        },
        integrations: createIntegrationsCopy(),
        personal: {
          darkMode: "日夜模式",
          day: "日间",
          night: "夜间",
          fontSize: "字号",
        },
        fontSizeOptions: {
          sm: "小",
          md: "中",
          lg: "大",
        },
      },
    },
    workspaces: {
      title: "工作区",
      breadcrumbLabel: "面包屑",
      back: "返回工作区",
    },
  },
  locale: "zh-CN",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/zh-CN/workspaces/workspace-1/projects/project-1",
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../api/client", () => ({ api: mockApi }));

vi.mock("../i18n/client", () => ({
  useI18n: () => ({
    dictionary: mockI18n.dictionary,
    locale: mockI18n.locale,
    localizedPath: (pathname: string) => pathname,
  }),
}));

vi.mock("./language-switcher", () => ({
  LanguageSwitcher: () => createElement("div", null, "语言设置"),
}));

vi.mock("./theme-provider", () => ({
  useTheme: () => ({
    flavor: "latte",
    accent: "lime",
    fontSize: "md",
    setFlavor: vi.fn(),
    setFontSize: vi.fn(),
  }),
}));

vi.mock("./toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe("lint test setup", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
    mockI18n.dictionary.inboxPopover.triggerLabel = "收件箱";
    mockI18n.dictionary.projects.fallbackProjectName = "项目名称";
    mockI18n.dictionary.projects.fallbackClientName = "客户名称";
    mockI18n.dictionary.projects.fallbackProject = "项目";
    mockI18n.dictionary.projects.projectList = "项目列表";
    mockI18n.dictionary.projects.unassignedClient = "未关联客户";
    mockI18n.dictionary.projects.identityBreadcrumbLabel = "项目路径";
    mockI18n.dictionary.projects.viewClientProjects = "查看该客户的项目";
    mockI18n.dictionary.projects.archivedStatus = "已归档";
    mockI18n.dictionary.projects.settingsTitle = "项目设置";
    mockI18n.dictionary.projects.settingsDescription =
      "管理当前项目和选中的工作台节点。";
    mockI18n.dictionary.projects.actionsLabel = "项目快捷操作";
    mockI18n.dictionary.projects.members = "成员与邀请";
    mockI18n.dictionary.projects.tabs = {
      overview: "总览",
      auditLogs: "日志",
    };
    mockI18n.dictionary.workspaces = {
      title: "工作区",
      breadcrumbLabel: "面包屑",
      back: "返回工作区",
    };
    mockI18n.locale = "zh-CN";
  });

  describe(ProjectPageHeader, () => {
    afterEach(() => {
      mockI18n.locale = "zh-CN";
    });

    it("identifies the project by its own code rather than the linked engagement code", () => {
      renderWithProviders(
        createElement(ProjectPageHeader, {
          project: {
            ...project,
            projectCode: "EMP-MANUAL-001",
            cmpEngagement: {
              id: "eng-1",
              clientId: "client-1",
              engagementCode: "CMP-2026-AUD",
              serviceType: "ANNUAL_AUDIT",
              yearEndDate: null,
              reportDate: null,
              pic: null,
              mic: null,
              status: "ACTIVE",
            },
          },
        })
      );
      expect(screen.getByText("EMP-MANUAL-001")).toBeTruthy();
      expect(screen.queryByText("CMP-2026-AUD")).not.toBeInTheDocument();
    });

    it("finishes search exit before switching to project confirmations", async () => {
      const navigate = vi.fn();
      renderWithProviders(
        createElement(ProjectPageHeader, {
          project,
          centerSlot: createElement("input", {
            "aria-label": "Project search",
          }),
          controlActionItems: [
            {
              id: "confirmations",
              label: "Project confirmations",
              onClick: navigate,
            },
          ],
        })
      );
      const shell = screen.getByTestId("project-header-center-slot");
      let finish!: () => void;
      Object.defineProperty(shell, "getClientRects", {
        value: () => [new DOMRect()],
      });
      Object.defineProperty(shell, "animate", {
        value: vi.fn(() => ({
          finished: new Promise<void>((resolve) => {
            finish = resolve;
          }),
          cancel: vi.fn(),
        })),
      });
      fireEvent.click(
        screen.getByRole("button", { name: "Project confirmations" })
      );
      expect(navigate).not.toHaveBeenCalled();
      await act(() => {
        finish();
      });
      expect(navigate).toHaveBeenCalledOnce();
      expect(shell.style.opacity).toBe("0");
      expect(shell.style.visibility).toBe("hidden");
    });

    it("returns to the parent page even when browser history exists", () => {
      vi.spyOn(window.history, "length", "get").mockReturnValue(2);

      renderWithProviders(
        createElement(ProjectPageHeader, {
          project,
          backHref: "/confirmations",
          backLabel: "返回函证中心",
        })
      );

      fireEvent.click(screen.getByRole("button", { name: "返回函证中心" }));
      expect(mockRouter.back).not.toHaveBeenCalled();
      expect(mockRouter.push).toHaveBeenCalledWith("/confirmations");
    });

    it("uses the supplied return target when there is no previous page", () => {
      vi.spyOn(window.history, "length", "get").mockReturnValue(1);

      renderWithProviders(
        createElement(ProjectPageHeader, {
          project,
          backHref: "/confirmations",
          backLabel: "返回函证中心",
        })
      );

      fireEvent.click(screen.getByRole("button", { name: "返回函证中心" }));
      expect(mockRouter.back).not.toHaveBeenCalled();
      expect(mockRouter.push).toHaveBeenCalledWith("/confirmations");
    });

    it("renders project context as a compact single-row toolbar", () => {
      const { container } = renderWithProviders(
        createElement(ProjectPageHeader, {
          project,
          backHref: "/engagement",
          activeTab: "overview",
          onTabChange: vi.fn(),
        })
      );
      const _header = container.querySelector("header");
      const projectSelector = screen.getByTestId(
        "project-header-project-segment"
      );
      const _codeSelector = screen.getByTestId("project-header-code-segment");
      expect(projectSelector).toHaveAttribute("aria-current", "page");
      expect(
        screen.getByRole("button", {
          name: mockI18n.dictionary.workspaces.back,
        })
      ).toBeTruthy();
    });

    it("shows project context without the old logo or folder breadcrumb", () => {
      const { container: _container } = renderWithProviders(
        createElement(ProjectPageHeader, {
          project,
          activeTab: "overview",
          onTabChange: vi.fn(),
        })
      );

      expect(screen.getByText("Audit Company")).toBeTruthy();
      expect(screen.getByText("AUD-2026-0001")).toBeTruthy();
      expect(screen.getAllByText("Audit Company")).toHaveLength(1);
    });

    it("shows archived status for archived projects", () => {
      renderWithProviders(
        createElement(ProjectPageHeader, {
          project: { ...project, status: "ARCHIVED" },
          backHref: "/engagement",
          activeTab: "overview",
          onTabChange: vi.fn(),
        })
      );

      expect(screen.getByText("已归档")).toBeInTheDocument();
    });

    it("shows the CMP archive badge without changing EMP project status", () => {
      renderWithProviders(
        createElement(ProjectPageHeader, {
          project: {
            ...project,
            status: "ACTIVE",
            cmpEngagement: {
              ...(project.cmpEngagement ?? {
                id: "cmp-engagement-1",
                clientId: "cmp-client-1",
                engagementCode: "AUD-2026-0001",
                serviceType: "ANNUAL_AUDIT",
                yearEndDate: null,
                reportDate: null,
                pic: null,
                mic: null,
              }),
              status: "ARCHIVED",
            },
          },
          backHref: "/projects",
        })
      );

      expect(screen.getByTestId("cmp-engagement-archived-badge")).toBe(
        screen.getByText(mockI18n.dictionary.projects.cmpArchivedStatus)
      );
      expect(screen.queryByText("已归档")).not.toBeInTheDocument();
    });

    it("shows pending final check status for pending projects", () => {
      renderWithProviders(
        createElement(ProjectPageHeader, {
          project: { ...project, status: "PENDING_FINAL_CHECK" },
          backHref: "/engagement",
          activeTab: "overview",
          onTabChange: vi.fn(),
        })
      );

      expect(screen.getByText("待归档审核")).toBeInTheDocument();
    });

    it("renders the project name without identifier or framework metadata", () => {
      renderWithProviders(
        createElement(ProjectPageHeader, {
          project,
          activeTab: "overview",
          onTabChange: vi.fn(),
        })
      );

      expect(screen.getByText("Audit Company")).toBeTruthy();
      expect(screen.getByText("AUD-2026-0001")).toBeTruthy();
      expect(screen.getAllByText("Audit Company")).toHaveLength(1);
    });

    it("prefers the project desktop folder over legacy workspace labels", () => {
      const projectInDesktopFolder = {
        ...project,
        name: "TereC",
        desktopFolder: {
          id: "folder-abc",
          ownerId: "user-1",
          name: "ABC Group",
          sortOrder: 1,
          isDefault: false,
        },
      } as Project;

      renderWithProviders(
        createElement(ProjectPageHeader, {
          project: projectInDesktopFolder,
          folderName: "Workspace",
          activeTab: "overview",
          onTabChange: vi.fn(),
        })
      );

      expect(screen.getByText("TereC")).toBeTruthy();
      expect(screen.getByText("AUD-2026-0001")).toBeTruthy();
    });

    it("puts project actions in settings without redundant header shortcuts", () => {
      const { container } = renderWithProviders(
        createElement(ProjectPageHeader, {
          project,
          activeTab: "overview",
          onTabChange: vi.fn(),
          settingsActions: createElement(
            "button",
            { type: "button" },
            "Delete project"
          ),
        })
      );

      expect(container.querySelector(".lucide-settings")).toBeTruthy();
      expect(container.querySelector(".lucide-clipboard-list")).toBeTruthy();
      expect(container.querySelector(".lucide-users")).toBeNull();
      const actionGroup = screen.getByRole("toolbar", {
        name: mockI18n.dictionary.projects.actionsLabel,
      });
      expect(actionGroup).toContainElement(
        screen.getByRole("button", {
          name: mockI18n.dictionary.workItems.empTitle,
        })
      );
      expect(actionGroup).toContainElement(
        screen.getByRole("button", {
          name: mockI18n.dictionary.common.settings,
        })
      );
      expect(actionGroup.querySelector(".lucide-clipboard-list")).toBeTruthy();
      expect(
        actionGroup.querySelector(
          '[data-action-id="settings"] .lucide-settings'
        )
      ).toBeTruthy();
      expect(actionGroup.className).not.toContain("shadow");
      expect(
        screen.getByRole("button", {
          name: mockI18n.dictionary.common.settings,
        }).className
      ).not.toContain("bg-card");
      expect(
        screen.queryByRole("link", {
          name: mockI18n.dictionary.projects.members,
        })
      ).toBeNull();
      expect(
        screen.queryByRole("button", {
          name: mockI18n.dictionary.projects.members,
        })
      ).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Delete project" })
      ).toBeNull();

      fireEvent.click(
        screen.getByRole("button", {
          name: mockI18n.dictionary.common.settings,
        })
      );

      expect(screen.getByRole("dialog")).toBeTruthy();
      expect(screen.getByRole("dialog")).toHaveClass("overflow-hidden");
      expect(screen.getByRole("dialog")).toHaveClass("p-0");
      expect(screen.getByRole("dialog")).toHaveClass("rounded-[10px]");
      expect(screen.getByRole("dialog")).toHaveClass("border-border");
      expect(screen.getByRole("dialog")).toHaveClass(
        "h-[80dvh]",
        "w-[80vw]",
        "max-h-[80dvh]",
        "max-w-[80vw]"
      );
      expect(
        screen.queryByText(mockI18n.dictionary.projects.settingsDescription)
      ).toBeNull();
      expect(screen.queryByText("Current page")).toBeNull();
      const overlay = document.querySelector('[data-slot="dialog-overlay"]');
      expect(overlay).toHaveClass("bg-black/50", "backdrop-blur-none");
      expect(overlay?.className).not.toContain("backdrop-blur-[2px]");
      expect(screen.getByRole("dialog")).toHaveClass(
        "[&>[data-slot=dialog-close]]:top-2",
        "[&>[data-slot=dialog-close]]:right-2",
        "[&>[data-slot=dialog-close]]:size-8",
        "[&>[data-slot=dialog-close]]:rounded-[8px]",
        "[&>[data-slot=dialog-close]]:border-0",
        "[&>[data-slot=dialog-close]]:opacity-70"
      );
      expect(
        screen.getByRole("button", { name: "Delete project" })
      ).toBeTruthy();
    });

    it("renders project-specific header actions beside settings", () => {
      renderWithProviders(
        createElement(ProjectPageHeader, {
          project,
          activeTab: "overview",
          onTabChange: vi.fn(),
          extraActions: createElement("button", { type: "button" }, "注释"),
        })
      );

      expect(screen.getByRole("button", { name: "注释" })).toBeTruthy();
      expect(
        screen.getByRole("button", {
          name: mockI18n.dictionary.projects.settingsTitle,
        })
      ).toBeTruthy();
    });

    it("does not show system administration shortcuts in project settings", () => {
      renderWithProviders(
        createElement(ProjectPageHeader, {
          project,
          activeTab: "overview",
          onTabChange: vi.fn(),
        }),
        {
          user: {
            id: "user-admin",
            email: "admin@projectwing.local",
            name: "系统管理员",
            globalRole: "SUPER_ADMIN",
          },
        }
      );

      fireEvent.click(screen.getByRole("button", { name: "项目设置" }));

      expect(screen.queryByText("admin@projectwing.local")).toBeNull();
      expect(screen.queryByText("系统管理")).toBeNull();
      expect(screen.queryByRole("link", { name: "用户管理" })).toBeNull();
      expect(screen.queryByRole("link", { name: "角色权限" })).toBeNull();
    });

    it("does not show system administration shortcuts to project users", () => {
      renderWithProviders(
        createElement(ProjectPageHeader, {
          project,
          activeTab: "overview",
          onTabChange: vi.fn(),
        })
      );

      fireEvent.click(screen.getByRole("button", { name: "项目设置" }));

      expect(screen.queryByRole("link", { name: "用户管理" })).toBeNull();
      expect(screen.queryByRole("link", { name: "角色权限" })).toBeNull();
    });

    it("shows the EMP work item shortcut and only adds a red dot for active items", async () => {
      renderWithProviders(
        createElement(ProjectPageHeader, {
          project,
          activeTab: "overview",
          onTabChange: vi.fn(),
        })
      );

      const emptyWorkItemButton = await screen.findByRole("button", {
        name: mockI18n.dictionary.workItems.empTitle,
      });
      expect(
        emptyWorkItemButton.querySelector(
          '[data-slot="project-wing-top-bar-inbox-unread-dot"]'
        )
      ).toBeNull();

      cleanup();

      renderWithProviders(
        createElement(ProjectPageHeader, {
          project,
          activeTab: "overview",
          onTabChange: vi.fn(),
        }),
        {
          workItems: [
            {
              id: "EMP-003:project-1",
              ruleId: "EMP-003",
              domain: "EMP",
              view: "PERSONAL",
              category: "PROJECT",
              state: "OPEN",
              severity: "ACTION_REQUIRED",
              priority: "NORMAL",
              title: "Confirm project declaration",
              description: "Declaration pending",
              subjectType: "PROJECT",
              subjectId: "project-1",
              reference: null,
              objectLabel: "Orchid Holdings",
              responsibleLabel: "Jony Ma",
              assignedTo: null,
              createdBy: null,
              dueAt: null,
              openedAt: "2026-08-31T08:00:00.000Z",
              updatedAt: "2026-08-31T08:00:00.000Z",
              project: null,
              actionTarget: {
                app: "EMP",
                resourceType: "SYSTEM_DECLARATION",
                resourceId: "project-1",
                params: {},
              },
            },
          ],
        }
      );

      const workItemButton = await screen.findByRole("button", {
        name: mockI18n.dictionary.workItems.empTitle,
      });
      await waitFor(() => {
        expect(
          workItemButton.querySelector(
            '[data-slot="project-wing-top-bar-inbox-unread-dot"]'
          )
        ).toBeTruthy();
      });
      const indicator = workItemButton.querySelector(
        '[data-slot="project-wing-top-bar-inbox-unread-dot"]'
      );
      expect(indicator).toBeTruthy();
      expect(workItemButton).toContainElement(indicator as HTMLElement);
      expect(
        workItemButton.querySelector(".lucide-clipboard-list")
      ).toBeTruthy();
    });

    it("opens EMP work items from the header shortcut", async () => {
      renderWithProviders(
        createElement(ProjectPageHeader, {
          project,
          activeTab: "overview",
          onTabChange: vi.fn(),
        })
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: mockI18n.dictionary.workItems.empTitle,
        })
      );

      await expect(
        screen.findByRole("dialog", {
          name: mockI18n.dictionary.workItems.empTitle,
        })
      ).resolves.toBeTruthy();
      await expect(screen.findByText("当前没有待办")).resolves.toBeTruthy();
    });

    it("shows account details from the upper-right avatar hover card", async () => {
      renderWithProviders(
        createElement(ProjectPageHeader, {
          project,
          activeTab: "overview",
          onTabChange: vi.fn(),
        })
      );

      const accountMenuButton = await screen.findByRole("button", {
        name: "账号菜单",
      });
      const avatar = within(accountMenuButton).getByRole("img", {
        name: "当前账号",
      });
      expect(avatar).toBeTruthy();
      expect(avatar).toHaveClass("project-wing-top-bar-avatar");
      expect(avatar).not.toHaveAttribute("title");

      fireEvent.pointerEnter(accountMenuButton);

      const accountName = await screen.findByText("Jony Ma");
      const accountRank = screen.getByText("Partner");

      expect(accountName.parentElement).toContainElement(accountRank);
      expect(accountName.parentElement).toHaveClass(
        "project-wing-top-bar-account-name"
      );
      expect(accountName).not.toHaveClass("truncate", "flex-1");
      expect(accountName.nextElementSibling).toBe(accountRank);
      expect(accountName.closest('[role="dialog"]')).toHaveClass("w-max");
      const hoverCard = accountName.closest('[role="dialog"]');
      const hoverAvatar = within(hoverCard as HTMLElement).getByRole("img", {
        name: "当前账号",
      });

      expect(hoverAvatar).toHaveClass(
        "project-wing-top-bar-avatar",
        "project-wing-top-bar-avatar--sm"
      );
      await expect(
        screen.findByText("partner@projectwing.local")
      ).resolves.toBeTruthy();
      expect(screen.queryByText("当前账号")).toBeNull();
      expect(screen.queryByText("partner")).toBeNull();
    });

    it("keeps account details out of settings and signs out from the avatar hover card", async () => {
      renderWithProviders(
        createElement(ProjectPageHeader, {
          project,
          activeTab: "overview",
          onTabChange: vi.fn(),
        })
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: mockI18n.dictionary.projects.settingsTitle,
        })
      );

      expect(screen.queryByText(mockI18n.dictionary.nav.account)).toBeNull();
      expect(screen.queryByText("partner@projectwing.local")).toBeNull();
      expect(
        screen.queryByRole("button", { name: mockI18n.dictionary.nav.signOut })
      ).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Close" }));

      fireEvent.pointerEnter(
        screen.getByRole("button", {
          name: mockI18n.dictionary.nav.accountMenu,
        })
      );

      await expect(screen.findByText("Jony Ma")).resolves.toBeTruthy();
      await expect(
        screen.findByText("partner@projectwing.local")
      ).resolves.toBeTruthy();

      const signOutButton = screen.getByRole("button", { name: "退出" });
      expect(signOutButton.parentElement).toHaveClass(
        "project-wing-top-bar-account-actions"
      );
      expect(signOutButton).not.toHaveTextContent("退出");
      expect(signOutButton.querySelector("svg")).toBeTruthy();

      fireEvent.click(signOutButton);

      expect(mockRouter.replace).not.toHaveBeenCalledWith("/login");
    });

    it("keeps the back arrow beside the project title", () => {
      renderWithProviders(
        createElement(ProjectPageHeader, {
          project,
          backHref: "/workspaces/workspace-1",
          activeTab: "overview",
          onTabChange: vi.fn(),
        })
      );

      const backButton = screen.getByRole("button", { name: "返回工作区" });
      const header = backButton.closest("header");

      expect(
        header?.querySelector(".project-wing-top-bar-brand")?.nextElementSibling
      ).toBe(backButton);
      expect(header).toContainElement(screen.getByText("Audit Company"));
    });

    it("adds the compact workspace header without changing the desktop identity", () => {
      renderWithProviders(
        createElement(ProjectPageHeader, {
          project,
          backHref: "/workspaces/workspace-1",
          responsiveProjectWorkspace: true,
        })
      );

      const compactProjectLabel = screen.getByTestId(
        "project-header-mobile-project-label"
      );
      expect(compactProjectLabel).toHaveTextContent(project.name);
      expect(
        screen.getByTestId("project-header-breadcrumb")
      ).toBeInTheDocument();
    });

    it("filters selectable projects after choosing a client", async () => {
      const otherClientProject: Project = {
        ...project,
        id: "project-2",
        name: "Orchid Audit",
        projectCode: "ORC-2026-AUD",
        cmpClientId: "cmp-client-2",
        cmpClient: {
          ...projectWithClient.cmpClient,
          id: "cmp-client-2",
          clientCode: "ORC",
          nameZh: "兰花控股",
          nameEn: "Orchid Holdings",
        } as NonNullable<Project["cmpClient"]>,
      };
      renderWithProviders(
        createElement(ProjectPageHeader, {
          project: projectWithClient,
          projectSwitcherProjects: [projectWithClient, otherClientProject],
        })
      );

      const clientSelector = screen.getByTestId(
        "project-header-client-segment"
      );

      expect(clientSelector.tagName).toBe("BUTTON");
      expect(clientSelector).toHaveTextContent("海港会计有限公司");
      const breadcrumb = screen.getByRole("navigation", { name: "项目路径" });
      expect(breadcrumb).toContainElement(clientSelector);
      expect(breadcrumb).toHaveAttribute("data-slot", "breadcrumb");
      expect(
        breadcrumb.querySelector('[data-slot="breadcrumb-list"]')
      ).toBeTruthy();
      expect(
        breadcrumb.querySelectorAll('[data-slot="breadcrumb-item"]')
      ).toHaveLength(3);
      expect(
        breadcrumb.querySelector('[data-slot="breadcrumb-separator"]')
      ).toBeNull();
      expect(screen.getByTestId("project-header-project-segment")).toHaveClass(
        "bg-background",
        "min-w-0",
        "max-w-full",
        "overflow-hidden",
        "whitespace-nowrap",
        "shadow-sm"
      );
      expect(screen.getByTestId("project-header-project-label")).toHaveClass(
        "truncate"
      );
      expect(
        screen
          .getByTestId("project-header-client-segment")
          .closest('[data-slot="breadcrumb-item"]')
      ).toHaveClass("project-wing-top-bar-identity-side");
      expect(
        screen
          .getByTestId("project-header-code-segment")
          .closest('[data-slot="breadcrumb-item"]')
      ).toHaveClass("project-wing-top-bar-identity-side");
      expect(
        screen
          .getByTestId("project-header-client-segment")
          .querySelector("span")
      ).toHaveClass("truncate");
      expect(
        screen.getByTestId("project-header-code-segment").querySelector("span")
      ).toHaveClass("truncate");
      expect(
        screen.getByTestId("project-header-global-navigation")
      ).toHaveClass("project-wing-top-bar-context");
      expect(screen.getByRole("banner")).toHaveClass("project-wing-top-bar");
      expect(screen.queryByTestId("project-header-center-slot")).toBeNull();

      fireEvent.click(clientSelector);
      fireEvent.click(
        await screen.findByRole("menuitemradio", {
          name: "兰花控股",
        })
      );
      expect(mockRouter.push).not.toHaveBeenCalled();
      expect(clientSelector).toHaveTextContent("兰花控股");

      expect(screen.getByTestId("project-header-project-segment").tagName).toBe(
        "SPAN"
      );
      fireEvent.click(screen.getByTestId("project-header-code-segment"));
      await expect(
        screen.findByRole("menuitemradio", { name: /Orchid Audit/ })
      ).resolves.toBeTruthy();
      expect(
        screen.queryByRole("menuitemradio", { name: /Audit Company/ })
      ).toBeNull();
      fireEvent.click(
        screen.getByRole("menuitemradio", { name: /Orchid Audit/ })
      );
      expect(mockRouter.push).toHaveBeenCalledWith("/engagement/project-2");
    });

    it("keeps the client ahead of the project name without stealing aria-current", () => {
      renderWithProviders(
        createElement(ProjectPageHeader, { project: projectWithClient })
      );

      const nav = screen.getByRole("navigation", { name: "项目路径" });
      const clientSegment = screen.getByTestId("project-header-client-segment");
      const projectSegment = screen.getByTestId(
        "project-header-project-segment"
      );
      const projectName = screen.getByText("Audit Company");

      expect(
        clientSegment.compareDocumentPosition(projectName) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(clientSegment).not.toHaveAttribute("aria-current");
      expect(projectSegment).toHaveAttribute("aria-current", "page");
      expect(projectSegment).toHaveAttribute("role", "tab");
      expect(projectSegment).toHaveAttribute("aria-selected", "true");
      expect(projectSegment).not.toHaveAttribute("aria-haspopup");
      expect(projectName).not.toHaveAttribute("aria-haspopup");
      expect(nav).toContainElement(projectSegment);
    });

    it("renders English client copy under en-US", () => {
      mockI18n.dictionary.projects.unassignedClient = "Unassigned client";
      mockI18n.dictionary.projects.identityBreadcrumbLabel =
        "Project breadcrumb";
      mockI18n.locale = "en-US";

      renderWithProviders(createElement(ProjectPageHeader, { project }));

      expect(
        screen.getByRole("navigation", { name: "Project breadcrumb" })
      ).toBeTruthy();
    });
  });

  const project: Project = {
    id: "project-1",
    projectNumber: 1_000_001,
    workspaceId: "workspace-1",
    projectCode: "AUD-2026-0001",
    name: "Audit Company",
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
    desktopFolder: {
      id: "folder-abc",
      ownerId: "user-1",
      name: "ABC Group",
      sortOrder: 1,
      isDefault: false,
    },
  };
  const projectWithClient: Project = {
    ...project,
    cmpClientId: "cmp-client-1",
    cmpClient: {
      id: "cmp-client-1",
      clientCode: "HBR",
      nameZh: "海港会计有限公司",
      nameEn: "Harbour Accounting Ltd",
      status: "ACTIVE",
      clientPartnerPic: null,
      clientManagerMic: null,
    },
  };

  function _withClient(overrides: { nameZh: string; nameEn: string }): Project {
    return {
      ...projectWithClient,
      cmpClient: {
        ...projectWithClient.cmpClient,
        ...overrides,
      } as NonNullable<Project["cmpClient"]>,
    };
  }

  type RenderOptions = {
    user?: Pick<User, "id" | "email" | "name" | "globalRole">;
    inboxMessages?: unknown[];
    workItems?: unknown[];
  };

  function renderWithProviders(
    element: React.ReactElement,
    options: RenderOptions = {}
  ) {
    const { user, inboxMessages = [], workItems = [] } = options;

    mockApi.me.mockResolvedValue({
      id: "user-1",
      email: "partner@projectwing.local",
      name: "Jony Ma",
      globalRole: "PARTNER",
      ...user,
    });
    mockApi.inboxMessages.mockResolvedValue(inboxMessages);
    mockApi.workItems.mockResolvedValue({
      items: workItems,
      categories: [],
      counts: { total: 0, EMP: 0, PROJECT: 0, CMP: 0, TMS: 0, OPS: 0 },
    });
    mockApi.listDevelopmentAccounts.mockResolvedValue([]);
    mockApi.userMailConnection.mockResolvedValue({
      emailAddress: "partner@projectwing.local",
      connected: false,
      provider: "WECOM_EXMAIL",
      status: null,
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    return render(
      createElement(QueryClientProvider, { client: queryClient }, element)
    );
  }
});
