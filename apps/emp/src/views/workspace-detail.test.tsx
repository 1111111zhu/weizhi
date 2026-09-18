import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceDetailPage } from "./workspace-detail";

const mockRouter = vi.hoisted(() => ({
  push: vi.fn(),
}));
const mockApi = vi.hoisted(() => ({
  workspaces: vi.fn(),
  updateWorkspace: vi.fn(),
  createWorkspace: vi.fn(),
  moveProjectPlacement: vi.fn(),
  me: vi.fn(),
  inboxMessages: vi.fn(),
}));
const mockI18n = vi.hoisted(() => ({
  dictionary: {
    common: {
      actionsLabel: "页面快捷操作",
      back: "返回",
      cancel: "取消",
      currentPage: "当前页面",
      settings: "设置",
      settingsDescription: "页面操作。",
    },
    nav: {
      account: "当前账号",
      accountMenu: "账号菜单",
      signOut: "退出",
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
    workItems: {
      empTitle: "EMP 待办",
      opsTitle: "OPS 待办",
      resizeEmp: "调整 EMP 待办侧栏宽度",
      resizeProject: "调整项目待办侧栏宽度",
    },
    workspaces: {
      title: "工作区",
      breadcrumbLabel: "面包屑",
      name: "工作区名称",
      clientName: "客户名称",
      descriptionLabel: "说明",
      loading: "正在加载工作区...",
      back: "返回工作区",
      notFoundTitle: "找不到工作区",
      notFoundDescription: "该工作区不存在，或当前账号没有访问权限。",
      newProject: "新建项目",
      reset: "重置",
      save: "保存",
      projectCountLabel: "项目数量",
      clientLabel: "客户",
      projectsTitle: "项目",
      reportingDate: "报表日期",
      openProject: "打开项目",
      moveProject: "移动项目",
      emptyProjectsTitle: "这个工作区还没有项目",
      emptyProjectsDescription: "先在当前工作区下创建第一个审计项目。",
      moveProjectToWorkspace: "移动项目到工作区",
      moveProjectDescription:
        "这个操作只会改变你自己的项目收纳位置，不会影响其他成员、项目权限、审计日志、底稿或邀请。",
      close: "关闭",
      current: "当前",
      cancelCreate: "取消新建",
      createAndMove: "创建并移动",
      createWorkspaceAndMove: "新建工作区并移动",
      move: "移动",
      selectProjectToMoveError: "请选择要移动的项目",
    },
    projects: {},
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("../api/client", () => ({
  api: mockApi,
}));

vi.mock("../i18n/client", () => ({
  useI18n: () => ({
    dictionary: mockI18n.dictionary,
    localizedPath: (pathname: string) => pathname,
  }),
}));

describe("lint test setup", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockI18n.dictionary = createZhDictionary();
  });

  describe(WorkspaceDetailPage, () => {
    it("uses the active locale on the empty workspace detail page", async () => {
      mockI18n.dictionary = createEnDictionary();
      setupApi({ projects: [] });

      renderWorkspaceDetail();

      await expect(
        screen.findByText("Project count")
      ).resolves.toBeInTheDocument();
      expect(screen.getByText("Client")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Projects" })
      ).toBeInTheDocument();
      expect(
        screen.getByText("No projects in this Workspace yet")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Create the first audit project under this Workspace.")
      ).toBeInTheDocument();

      expect(screen.queryByText("工作区")).not.toBeInTheDocument();
      expect(screen.queryByText("新建项目")).not.toBeInTheDocument();
      expect(screen.queryByText("项目数量")).not.toBeInTheDocument();
      expect(screen.queryByText("客户")).not.toBeInTheDocument();
      expect(screen.queryByText("项目")).not.toBeInTheDocument();
      expect(
        screen.queryByText("这个工作区还没有项目")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("先在当前工作区下创建第一个审计项目。")
      ).not.toBeInTheDocument();
    });

    it("uses dialog dismissal semantics for moving a project", async () => {
      setupApi();
      renderWorkspaceDetail();

      await screen.findByText("AUD - 2026 - 0001");
      const trigger = screen.getByRole("button", { name: "移动项目" });
      fireEvent.click(trigger);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("data-slot", "dialog-content");

      fireEvent.keyDown(document.body, { key: "Escape" });

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
      expect(document.activeElement).toBe(trigger);
    });

    it("moves a project to another workspace from the project card", async () => {
      setupApi();
      mockApi.moveProjectPlacement.mockResolvedValue({
        ...project,
        workspaceId: "workspace-2",
      });

      renderWorkspaceDetail();

      await screen.findByText("AUD - 2026 - 0001");
      fireEvent.click(screen.getByRole("button", { name: "移动项目" }));
      fireEvent.click(screen.getByRole("radio", { name: /Archive Workspace/ }));
      fireEvent.click(screen.getByRole("button", { name: "移动" }));

      await waitFor(() => {
        expect(mockApi.moveProjectPlacement).toHaveBeenCalledWith("project-1", {
          folderId: "workspace-2",
        });
      });
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith("/workspaces/workspace-2");
      });
    });

    it("creates a workspace before moving a project there", async () => {
      setupApi();
      mockApi.createWorkspace.mockResolvedValue({
        id: "workspace-3",
        name: "New Workspace",
        clientName: "New Client",
        projects: [],
      });
      mockApi.moveProjectPlacement.mockResolvedValue({
        ...project,
        workspaceId: "workspace-3",
      });

      renderWorkspaceDetail();

      await screen.findByText("AUD - 2026 - 0001");
      fireEvent.click(screen.getByRole("button", { name: "移动项目" }));
      fireEvent.click(screen.getByRole("button", { name: "新建工作区并移动" }));
      fireEvent.change(
        screen.getAllByLabelText("工作区名称").at(-1) as HTMLElement,
        {
          target: { value: "New Workspace" },
        }
      );
      fireEvent.change(
        screen.getAllByLabelText("客户名称").at(-1) as HTMLElement,
        {
          target: { value: "New Client" },
        }
      );
      fireEvent.click(screen.getByRole("button", { name: "创建并移动" }));

      await waitFor(() => {
        expect(mockApi.createWorkspace).toHaveBeenCalledWith({
          name: "New Workspace",
          clientName: "New Client",
          description: "",
        });
      });
      await waitFor(() => {
        expect(mockApi.moveProjectPlacement).toHaveBeenCalledWith("project-1", {
          folderId: "workspace-3",
        });
      });
      expect(mockRouter.push).toHaveBeenCalledWith("/workspaces/workspace-3");
    });
  });

  function renderWorkspaceDetail() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    return render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(WorkspaceDetailPage, { workspaceId: "workspace-1" })
      )
    );
  }

  function setupApi({
    projects = [project],
  }: { projects?: (typeof project)[] } = {}) {
    mockApi.me.mockResolvedValue({
      id: "user-1",
      email: "partner@projectwing.local",
      name: "Jony Ma",
      globalRole: "PARTNER",
    });
    mockApi.inboxMessages.mockResolvedValue([]);
    mockApi.workspaces.mockResolvedValue([
      {
        id: "workspace-1",
        name: "Current Workspace",
        clientName: "Client Name",
        projects,
      },
      {
        id: "workspace-2",
        name: "Archive Workspace",
        clientName: "Client Name",
        projects: [],
      },
    ]);
  }

  function createZhDictionary() {
    return {
      ...mockI18n.dictionary,
      common: {
        actionsLabel: "页面快捷操作",
        back: "返回",
        cancel: "取消",
        currentPage: "当前页面",
        settings: "设置",
        settingsDescription: "页面操作。",
      },
      nav: {
        account: "当前账号",
        accountMenu: "账号菜单",
        signOut: "退出",
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
      workspaces: {
        ...mockI18n.dictionary.workspaces,
        title: "工作区",
        breadcrumbLabel: "面包屑",
        name: "工作区名称",
        clientName: "客户名称",
        descriptionLabel: "说明",
        back: "返回工作区",
        newProject: "新建项目",
        projectCountLabel: "项目数量",
        clientLabel: "客户",
        projectsTitle: "项目",
        moveProject: "移动项目",
        createWorkspaceAndMove: "新建工作区并移动",
        createAndMove: "创建并移动",
        move: "移动",
      },
      projects: {},
    };
  }

  function createEnDictionary() {
    return {
      ...createZhDictionary(),
      common: {
        actionsLabel: "Page shortcuts",
        back: "Back",
        cancel: "Cancel",
        currentPage: "Current page",
        settings: "Settings",
        settingsDescription: "Page actions.",
      },
      nav: {
        account: "Current account",
        accountMenu: "Account menu",
        signOut: "Sign out",
      },
      inboxPopover: {
        triggerLabel: "Inbox",
        pendingTitle: "Pending invitations",
        pendingDescription:
          "Open an invitation and choose a Workspace to join.",
        emptyDescription: "No pending invitations.",
        openInvitation: "Open invitation",
        openMessage: "View message",
        viewAll: "View all messages",
      },
      workspaces: {
        ...createZhDictionary().workspaces,
        title: "Workspace",
        breadcrumbLabel: "Breadcrumb",
        name: "Workspace name",
        clientName: "Client name",
        descriptionLabel: "Description",
        loading: "Loading Workspace...",
        back: "Back to Workspace",
        notFoundTitle: "Workspace not found",
        notFoundDescription:
          "This Workspace does not exist, or your account does not have access.",
        newProject: "New project",
        reset: "Reset",
        save: "Save",
        projectCountLabel: "Project count",
        clientLabel: "Client",
        projectsTitle: "Projects",
        reportingDate: "Reporting date",
        openProject: "Open project",
        moveProject: "Move project",
        emptyProjectsTitle: "No projects in this Workspace yet",
        emptyProjectsDescription:
          "Create the first audit project under this Workspace.",
        moveProjectToWorkspace: "Move project to Workspace",
        moveProjectDescription:
          "This only changes where you organize your project. It does not affect other members, project permissions, audit logs, working papers, or invitations.",
        close: "Close",
        current: "Current",
        cancelCreate: "Cancel new Workspace",
        createAndMove: "Create and move",
        createWorkspaceAndMove: "Create Workspace and move",
        move: "Move",
        selectProjectToMoveError: "Select a project to move",
      },
      projects: {},
    };
  }

  const project = {
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
    status: "ACTIVE" as const,
  };
});
