import type {
  GlobalRole,
  InChargeRole,
  ProjectRole,
} from "@project-wing/shared";
// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { requiredFixture } from "@/test/required-fixture";

import { ApiError as ProjectApiError } from "../api/client";
import type { Attachment, WorkflowNode } from "../api/client";
import type * as ConfirmationPanelModule from "../components/project-confirmations-panel";
import { ThemeProvider } from "../components/theme-provider";
import { ToastProvider } from "../components/toast";
import { WorkbenchDirectory } from "../components/workbench-directory";
import { WorkbenchFilePreviewPane } from "../components/workbench-paper-section";
import {
  WorkspacePage,
  isInFlightFileExportJob,
  shouldAllowWorkbenchPointerDrag,
  shouldSnapReviewNotesPanelClosed,
} from "./workspace";

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);

vi.mock("border-beam", () => {
  const MockBorderBeam = ({ children }: { children: ReactNode }) => children;
  return {
    BorderBeam: MockBorderBeam,
  };
});

const WORKSPACE_ASYNC_TIMEOUT_MS = 10_000;

function requireElement<T extends Element>(element: T | null | undefined): T {
  if (!element) {
    throw new Error("Expected test element to be present");
  }
  return element;
}

function requireValue<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected test value to be present");
  }
  return value;
}

describe(isInFlightFileExportJob, () => {
  it.each(["QUEUED", "RUNNING"] as const)(
    "treats %s as restorable",
    (status) => {
      expect(isInFlightFileExportJob({ status } as never)).toBeTruthy();
    }
  );

  it.each(["COMPLETED", "FAILED", "DOWNLOADED"] as const)(
    "does not restore terminal %s jobs",
    (status) => {
      expect(isInFlightFileExportJob({ status } as never)).toBeFalsy();
    }
  );
});

describe(shouldSnapReviewNotesPanelClosed, () => {
  it("uses a narrow bottom-edge snap range", () => {
    expect(shouldSnapReviewNotesPanelClosed(47)).toBeTruthy();
    expect(shouldSnapReviewNotesPanelClosed(48)).toBeFalsy();
    expect(shouldSnapReviewNotesPanelClosed(104)).toBeFalsy();
  });
});

const mockRouter = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
const mockNavigation = vi.hoisted(() => ({
  searchParams: "",
}));
const mockApi = vi.hoisted(() => ({
  auditLogs: vi.fn(),
  project: vi.fn(),
  projectDeclarationStatus: vi.fn(),
  acceptProjectDeclaration: vi.fn(),
  createWorkingPaper: vi.fn(),
  createWorkflowNode: vi.fn(),
  deleteWorkflowNode: vi.fn(),
  deletedAttachments: vi.fn(),
  frameworkTemplates: vi.fn(),
  copyAttachment: vi.fn(),
  projectAttachments: vi.fn(),
  moveAttachment: vi.fn(),
  updateProject: vi.fn(),
  readZip: vi.fn(),
  downloadAttachment: vi.fn(),
  downloadAttachmentReadOnly: vi.fn(),
  previewAttachmentContent: vi.fn(),
  previewAttachment: vi.fn(),
  previewAttachmentRasterPdfManifest: vi.fn(),
  previewAttachmentRasterPdfPage: vi.fn(),
  workflow: vi.fn(),
  activeProjectFileExportJob: vi.fn(),
  workingPaper: vi.fn(),
  uploadWorkingPaperAttachment: vi.fn(),
  workspaces: vi.fn(),
  me: vi.fn(),
  members: vi.fn(),
  userDirectory: vi.fn(),
  workItems: vi.fn(),
  inboxMessages: vi.fn(),
  markInboxRead: vi.fn(),
  markInboxUnread: vi.fn(),
  restoreAttachment: vi.fn(),
  deleteWorkingPaper: vi.fn(),
  startArchiveCheckJob: vi.fn(),
  archiveCheckJob: vi.fn(),
  exportArchiveCheck: vi.fn(),
  submitArchive: vi.fn(),
  confirmProjectArchive: vi.fn(),
  archiveJob: vi.fn(),
  desktop: vi.fn(),
  confirmationTemplateLibrary: vi.fn(),
  userMailConnection: vi.fn(),
}));

const confirmationPanelStub = vi.hoisted(() => ({ enabled: false }));
vi.mock("../components/project-confirmations-panel", async (importOriginal) => {
  const actual = await importOriginal<typeof ConfirmationPanelModule>();
  return {
    ...actual,
    ProjectConfirmationsPanel: (
      props: Parameters<typeof actual.ProjectConfirmationsPanel>[0]
    ) =>
      confirmationPanelStub.enabled
        ? createElement(
            "button",
            { type: "button", onClick: props.onViewProjectFiles },
            "在项目中查看"
          )
        : createElement(actual.ProjectConfirmationsPanel, props),
  };
});
vi.mock("next/navigation", () => ({
  usePathname: () => "/zh-CN/workspaces/workspace-1/projects/project-1",
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(mockNavigation.searchParams),
}));

vi.mock("../api/client", () => ({
  ApiError: class ApiError extends Error {
    code: string;
    requestId: string;

    constructor(code: string, message: string, requestId: string) {
      super(message);
      this.name = "ApiError";
      this.code = code;
      this.requestId = requestId;
    }
  },
  getAttachmentPreviewPdfUrl: vi.fn(
    (projectId: string, attachmentId: string, displayName?: string) =>
      `http://localhost:3000/engagement/${projectId}/workflow/attachments/${attachmentId}/preview-pdf/${encodeURIComponent(displayName ?? "")}`
  ),
  api: mockApi,
}));

vi.mock("../components/extend/xlsx-viewer", () => ({
  XlsxViewerPreview: ({ fileName }: { fileName?: string }) =>
    createElement("div", { "data-testid": "extend-xlsx-viewer" }, fileName),
}));

vi.mock("../components/extend/archive-viewer", () => ({
  ArchiveViewer: ({ fileName }: { fileName: string }) =>
    createElement("div", { "data-testid": "archive-viewer" }, fileName),
}));

vi.mock("../i18n/client", () => ({
  useI18n: () => ({
    dictionary: {
      common: {
        back: "返回",
        cancel: "取消",
        avatarSuffix: "头像",
        actionsLabel: "页面快捷操作",
        currentPage: "当前页面",
        settings: "设置",
        settingsDescription: "管理当前页面的低频操作。",
      },
      language: {
        label: "语言",
        zhCN: "中文",
        zhCNShort: "简",
        zhHKShort: "繁",
        enUS: "English",
        enUSShort: "EN",
      },
      pdfViewer: {
        annotations: "批注",
        closeAnnotations: "关闭批注",
        emptyAnnotations: "此 PDF 中没有批注",
        fitPage: "适合页面",
        fitWidth: "适合宽度",
        actualSize: "实际大小",
        print: "打印",
        enterPresentationMode: "进入演示模式",
        exitPresentationMode: "退出演示模式",
        pagePrefix: "第",
        pageSuffix: " 页",
        untitledAnnotation: "批注",
        unknownAuthor: "未知作者",
      },
      nav: {
        account: "当前账号",
        accountMenu: "账号菜单",
        signOut: "退出",
        workspace: "工作区",
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
      inbox: {
        title: "通知",
        description: "项目邀请、签署动态和系统通知会投递到这里。",
        loading: "正在加载消息...",
        emptyTitle: "暂无通知",
        emptyDescription: "当前项目暂无通知。",
        newMessage: "新消息",
        genericMessage: "普通消息",
        joined: "已加入",
        expired: "已过期",
        pending: "待处理",
        allTab: "全部",
        actionTab: "待处理",
        reviewTab: "注释",
        signoffTab: "签署",
        readTab: "已读",
        markAllRead: "全部标为已读",
        searchPlaceholder: "搜索消息...",
        noSearchResults: "没有匹配的消息",
        clearSearch: "清除搜索",
        hideList: "隐去",
        quickActions: "快捷操作",
        today: "今天",
        yesterday: "昨天",
        thisWeek: "本周",
        earlier: "更早",
        expires: "到期",
        workspaceLabel: "工作区",
        projectLabel: "项目",
        senderLabel: "发送人",
        workingPaperLabel: "底稿",
        reviewQuestionLabel: "复核注释",
        invitedRoleLabel: "邀请角色",
        expiresAtLabel: "有效期至",
        sentAt: "发送于",
        sentByAt: "发送于",
        openInvitation: "打开邀请",
        openProject: "打开项目",
        openWorkpaper: "打开底稿",
        openMessageTarget: "打开",
        markRead: "标为已读",
        markUnread: "标为未读",
        deleteMessage: "删除",
        clearExpired: "清空已过期",
        summaryTitle: "通知概览",
        emptyDetail: "请选择一条消息查看详情。",
        actionRequiredStatus: "需要处理",
        unreadStatus: "未读",
        readStatus: "已读",
        resolvedStatus: "已解决",
        typeLabels: {
          PROJECT_INVITATION: "邀请",
          REVIEW_QUESTION: "复核注释",
          REVIEW_REPLY: "复核回复",
          REVIEW_FOLLOW_UP: "继续追问",
          REVIEW_REOPENED: "重新打开",
          SIGNOFF: "签署",
          SYSTEM_NOTIFICATION: "系统",
        },
      },
      workspaces: {
        breadcrumbLabel: "面包屑",
        title: "工作区",
        back: "返回工作区",
      },
      confirmationCenter: {
        intranet: {
          title: "函证中心",
        },
      },
      projects: {
        fallbackProjectName: "项目名称",
        fallbackClientName: "客户名称",
        fallbackProject: "项目",
        projectList: "项目列表",
        archivedStatus: "已归档",
        pendingFinalCheckStatus: "待归档审核",
        adminReviewBanner:
          "该项目已提交归档终审。普通成员当前只读，你可以确认归档或打回修改。",
        reopenProject: "打回修改",
        reopenProjectDialogTitle: "打回修改",
        reopenProjectDialogDescription:
          "项目将回到可编辑状态，项目成员会收到通知。",
        reopenReason: "打回原因",
        reopenReasonPlaceholder: "可选，便于项目成员了解需要修改的内容。",
        confirmArchive: "确认完成归档",
        finalArchiveReview: "最终检查并归档",
        confirmArchiveDialogTitle: "确认归档",
        confirmArchiveDialogDescription:
          "将重新运行归档检查，确认后启动归档流程。项目归档后所有成员只读。",
        name: "项目名称",
        projectCode: "项目代码",
        language: "语言",
        frameworkTemplate: "适用准则",
        folderSelectPlaceholder: "选择文件夹",
        yearEndDate: "年末日期",
        reportDate: "报告日期",
        archiveDeadline: "归档截止日",
        reportingDate: "报表日期",
        notes: "备注",
        languages: {
          "zh-CN": "简体中文",
          "en-US": "英文",
        },
        settingsTitle: "项目设置",
        settingsDescription: "管理当前项目和选中的工作台节点。",
        actionsLabel: "项目快捷操作",
        members: "成员与邀请",
        memberManagementTitle: "成员管理",
        inviteMember: "邀请",
        inviteProjectMembers: "邀请项目成员",
        loadingAvailableUsers: "正在加载可邀请成员...",
        noInviteableUsers: "没有可邀请成员。",
        memberSearch: "搜索成员",
        memberSearchPlaceholder: "搜索或邀请 ...",
        memberCount: "{count} 名成员",
        inviteAction: "邀请",
        cancelInvitation: "取消",
        cancelInvitationDescription: "确定取消对 {name} 的邀请吗？",
        activeStatus: "活跃",
        invitedStatus: "已邀请",
        notInvitedStatus: "未邀请",
        memberColumn: "成员",
        rankColumn: "职级",
        roleInEngagementColumn: "项目角色",
        independenceColumn: "独立性",
        statusColumn: "状态",
        actionsColumn: "操作",
        independenceSigned: "已签署",
        independenceNotSigned: "未签署",
        independenceSigner: "签署人",
        independenceSigningMethod: "签署方式",
        independenceElectronicSignOff: "电子签署",
        independencePendingSignOff: "待签署",
        independenceSignedAt: "签署日期",
        removeAction: "移除",
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
        searchLabel: "查找组或底稿",
        loadingStructureTitle: "正在加载项目结构",
        loadingStructureDescription: "请稍候。",
        noMatchesTitle: "没有匹配的组或底稿",
        noMatchesDescription: "换一个关键字再试。",
        directoryShowLabel: "显示文件树",
        directoryHideLabel: "隐藏文件树",
        directoryResizeLabel: "调整文件树面板宽度",
        filePreview: {
          title: "文件预览",
          drawerTitle: "预览",
          showLabel: "显示文件预览",
          hideLabel: "隐藏文件预览",
          resizeLabel: "调整文件预览面板宽度",
          emptyTitle: "预览",
          emptyDescription: "点击或拖动文件条",
          unsupportedTitle: "该文件暂不支持在线预览",
          unsupportedDescription: "请使用文件操作菜单在预览外打开。",
          download: "下载",
          pageIndicator: "第 {page} / {count} 页",
          zoomOut: "缩小",
          zoomIn: "放大",
          fitToWidth: "适配宽度",
          loadingPreview: "正在加载预览...",
          loadingArchive: "正在加载压缩包...",
        },
        fileExport: {
          preparingTitle: "正在准备导出",
          collecting: "正在收集文件",
          packaging: "正在生成 ZIP",
          uploading: "正在上传",
          ready: "导出文件已准备好",
          progress: "已完成 {completed} / {total}",
          download: "下载导出文件",
          retry: "重新导出",
          failedTitle: "导出失败",
          completedTitle: "导出完成",
          completedDescription: "已生成 {name}",
          downloadStartedTitle: "下载已开始",
          downloadStartedDescription: "正在下载 {name}",
          starting: "正在创建导出任务...",
          selectedStarted: "正在导出所选文件",
          folderStarted: "正在导出文件夹 {name}",
          activeExists: "已有导出任务正在进行",
          downloadFailed: "无法下载导出文件",
          close: "关闭",
        },
        emptyStructureTitle: "项目结构为空",
        emptyStructureDescription: "项目创建后会自动生成默认组和底稿。",
        selectPromptTitle: "选择一个底稿或文件",
        selectPromptDescription:
          "左侧项目结构默认折叠。展开组并选择底稿后，可上传文件或打开已有文件。",
        group: "组",
        workpaper: "底稿",
        renameGroup: "重命名组",
        renameWorkpaper: "重命名底稿",
        addGroup: "新增组",
        addWorkpaper: "新增底稿",
        deleteGroup: "删除组",
        deleteWorkpaper: "删除底稿",
        nodeCreatedGroup: "组已创建",
        nodeCreatedWorkpaper: "底稿已创建",
        deleted: "已删除",
        paperCreated: "底稿已创建",
        fileUploaded: "文件已上传",
        deleteGroupDescription:
          "删除组会同时删除其下所有底稿和文件，是否继续？",
        deleteWorkpaperDescription: "删除该底稿会同时删除其下文件，是否继续？",
        confirmDeleteGroup: "确认删除组",
        confirmDeleteWorkpaper: "确认删除底稿",
        confirmDelete: "确认删除",
        enteringWorkbench: "正在进入工作区项目工作台...",
        loadingWorkbench: "正在加载项目工作台...",
        workbenchLoadFailed: "项目工作台暂时无法加载。请检查连接后重试。",
        workbenchAccessDenied:
          "当前账号没有访问此项目的权限。请返回工作区，或联系项目负责人确认访问权限。",
        workbenchUnavailable:
          "该项目不存在或已不可访问。请返回工作区选择其他项目。",
        workbenchRetry: "重试",
        confirmDeleteProject: "确认删除项目",
        deleteProjectDescription:
          "删除后项目会从工作台归档隐藏，历史审计记录仍会保留。只有项目 Partner 可以执行该操作。",
        deleteProject: "删除项目",
        membersSheetTitle: "成员与邀请",
        checkingDeclaration: "正在检查本项目独立性声明...",
        declarationFallbackProject: "项目",
        declarationTitle: "进入项目前请签署独立性声明",
        declarationFallbackClient: "该项目",
        declarationDescription:
          "会单独记录每位参与者的独立性声明状态。首次进入本项目时必须确认，签署后再次进入不会重复弹出。",
        declarationStatement:
          "我确认本人已阅读并理解本项目的独立性要求，并承诺在项目执行期间持续遵守相关职业道德与独立性规定。如出现影响独立性的事项，我将及时向项目负责人报告。",
        confirming: "正在确认...",
        confirmAndEnterProject: "确认并进入项目",
        uploadFileTo: "上传文件到",
        uploadToBucket: "上传到",
        fileInput: "文件选择",
        fileUploadEmpty: "File is empty",
        referenceCode: "参考编号",
        referenceCodeImportTitle: "确认参考编号",
        referenceCodeImportDescription:
          "导入前可逐个确认或修改文件的参考编号。",
        importFiles: "导入文件",
        otherMember: "其他成员",
        locked: "锁定中",
        newGroup: "新组",
        newWorkpaper: "新底稿",
        bucketLabels: {
          CURRENT: "当前底稿",
          PRIOR: "前期底稿",
          TEMPORARY: "临时资料",
        },
        bucketShortLabels: {
          CURRENT: "当前",
          PRIOR: "前期",
          TEMPORARY: "临时",
        },
        bucketDescriptions: {
          CURRENT: "上传并管理本期审计底稿文件。",
          PRIOR: "上传上期底稿文件，便于本期参考。",
          TEMPORARY: "上传临时支持性文件。",
        },
        attachmentRelocation: {
          chooseBucketTitle: "选择文件分类",
          chooseBucketDescription: "{action} {file} 到 {target}",
          copyAction: "Copy",
          moveAction: "Cut",
          working: "正在处理...",
        },
        fileCategoriesLabel: "文件分类",
        folderFileActionsLabel: "底稿文件操作",
        noFilesInBucket: "{bucket}中暂无文件",
        projectFileIndex: {
          title: "项目文件",
          activeSuffix: "个有效文件",
          loading: "正在加载项目文件...",
          headers: {
            refCode: "编号",
            title: "文件",
            actions: "操作",
            status: "状态",
            notes: "注释",
            signoffs: "签核",
            attributes: "属性",
            review: "复核",
          },
          noFile: "无文件",
          openWorkpaper: "打开底稿 {name}",
          openAsMaster: "以 Master 打开 {name}",
          reviewButton: "复核",
          reviewApproved: "{name} 复核通过",
          reviewBlocked: "复核受阻，请先查看注释",
          emptyTray: {
            currentTitle: "当前底稿",
            priorTitle: "前期底稿",
            temporaryTitle: "临时资料",
            currentDescription: "拖拽文件到此处，或上传本期底稿文件。",
            priorDescription: "拖拽文件到此处，或上传前期底稿文件。",
            temporaryDescription: "将支持文件拖到这里，再归入正式目录。",
            uploadFiles: "上传文件",
            unavailableDescription:
              "当前目录不可直接上传。请选择下级底稿目录后添加文件。",
          },
          actionMenu: {
            preview: "Preview",
            openMaster: "Open Master",
          },
          relocation: {
            copy: "Copy",
            move: "Cut",
            copying: "Copying {name}",
            moving: "Cutting {name}",
            chooseTarget: "选择左侧目标目录",
            cancel: "取消",
          },
        },
        templateLibrary: {
          label: "导入模板",
          dialogTitle: "导入模板",
          targetLabel: "当前目录",
          targetPlaceholder: "请选择目录",
          targetHelp: "请选择具体底稿目录后再导入模板。",
          templatesTitle: "模板",
          smartFormTemplatesTitle: "Smart Form",
          templateUnit: "个模板",
          templateUnitPlural: "个模板",
          searchPlaceholder: "搜索模板、科目或底稿",
          searchLabel: "搜索模板",
          loadingTemplates: "正在加载模板...",
          noMatchingTemplates: "没有匹配的模板",
          noTemplates: "暂无可用模板",
          previewTitle: "导入预览",
          chooseTemplate: "从左侧选择一个模板",
          chooseTarget: "请选择目标目录",
          applyTo: "导入到",
          suggested: "建议",
          total: "合计",
          newItems: "新增",
          existing: "已存在",
          code: "编号",
          title: "标题",
          type: "类型",
          bucket: "分类",
          status: "状态",
          newStatus: "新增",
          existingStatus: "已存在",
          workpaperType: "底稿",
          supplementType: "支持文件",
          loadingPreview: "正在生成预览...",
          noMatchingTemplatesSentence: "没有匹配的模板。",
          noTemplatesSentence: "暂无可用模板。",
          alreadyAppliedHint: "该模板在所选目录下已经全部存在。",
          cancel: "取消",
          apply: "导入",
          applying: "正在导入...",
          alreadyApplied: "已应用",
          appliedTitle: "模板已导入",
          createdDescription: "已生成 {count} 份底稿。",
          noNewDescription: "没有需要新增的底稿。",
          itemUnit: "份底稿",
          itemUnitPlural: "份底稿",
          selectTemplate: "选择 {name}",
        },
        paperTools: {
          labels: {
            history: "文件状态",
            projectFiles: "项目文件",
            signoff: "签核与复核",
            questions: "复核注释",
          },
          backToFiles: "返回文件列表",
          openFileTools: "打开文件工具",
          close: "关闭",
        },
        archiveCheck: {
          title: "归档文件检查",
          checking: "正在检查项目文件",
          checkedAt: "{projectCode} 检查时间：{time}",
          confirmArchiveTitle: "确认归档项目信息",
          confirmArchiveDescription:
            "归档包将包含当前底稿文件，确认后项目会进入只读归档状态。",
          archivePackage: "归档包",
          archiveJobPhases: {
            fileCheck: "正在运行归档检查",
            packaging: "正在打包归档文件",
            uploading: "正在上传归档包",
            finalizing: "正在完成归档",
          },
          progress: {
            label: "检查进度",
            complete: "{completed} / {total} 项检查完成",
            current: "正在检查：{label}",
          },
          metrics: {
            workpapers: "底稿",
            blockers: "阻断项",
            warnings: "提醒项",
            lockedFiles: "锁定文件",
          },
          table: {
            severity: "级别",
            issue: "问题",
            workpaper: "底稿",
            detail: "详情",
          },
          severityLabels: {
            BLOCKER: "阻断",
            WARNING: "提醒",
          },
          issueTypes: {
            MISSING_PREPARER_SIGNOFF: "缺少编制人签核",
            MISSING_REVIEWER_SIGNOFF: "缺少复核人签核",
            REVIEW_SIGNOFF_BEFORE_PREPARER: "复核早于编制",
            SELF_REVIEWED_WORKING_PAPER: "自我复核",
            UNREVIEWED_WORKING_PAPER: "底稿未复核",
            OPEN_REVIEW_QUESTION: "存在未关闭复核问题",
            EMPTY_WORKING_PAPER: "空底稿",
            LOCKED_ATTACHMENT: "文件仍被锁定",
            SMART_FORM_INCOMPLETE: "智能表单未完成",
            DOCX_TRACK_CHANGES: "Word 修订未接受",
            DOCX_UNRESOLVED_COMMENT: "Word 注释未解决",
            XLSX_UNRESOLVED_COMMENT: "Excel 注释未解决",
            XLSX_ERROR_VALUE: "Excel 错误值",
            OFFICE_FILE_CHECK_FAILED: "Office 文件检查失败",
          },
          groupTitles: {
            signoffs: "签核检查",
            reviewQuestions: "复核问题检查",
            workpaperFiles: "底稿文件检查",
            smartForms: "智能表单检查",
            officeFiles: "Office 文件检查",
            excelHints: "Excel 提示",
          },
          groupStatusLabels: {
            passed: "通过",
            blockers: "需要处理",
            warnings: "提醒",
          },
          reviewQuestionStatusLabels: {
            OPEN: "待回复",
            REPLIED: "已回复待确认",
            CLEARED: "已关闭",
          },
          details: {
            unreviewed: "{code} 尚未完成复核。",
            openReviewQuestion: "复核问题状态：{status}。",
            openReviewQuestionWithAssignee:
              "复核问题状态：{status}，当前指派给 {assignee}。",
            empty: "{code} 暂无有效附件。",
            lockedAttachment: "{file} 当前由 {holder} 持有。",
            incompleteSmartForm: "{file} 未完成。",
            selfReviewed: "{member} 同时完成编制和复核。",
            commentAuthor: "作者：{author}",
            unknownHolder: "未知成员",
          },
          actions: {
            goTo: "前往",
            exportWord: "导出 Word",
            downloadArchive: "下载归档包",
            downloading: "正在下载...",
          },
          navigator: {
            title: "文件检查清单",
            searchPlaceholder: "搜索问题、文件或位置",
            clearSearch: "清除搜索",
            all: "全部",
            blockers: "阻断",
            warnings: "提醒",
            noMatches: "没有符合条件的检查项。",
            previous: "上一项",
            next: "下一项",
            position: "第 {current}/{total} 项",
            minimize: "最小化文件检查清单",
            restore: "展开文件检查清单",
            close: "关闭文件检查清单",
          },
          noIssues: "未发现归档问题。",
          close: "关闭",
          emptyValue: "-",
        },
        settingsPanel: {
          menu: {
            title: "设置菜单",
            description: "先选择一个分类，再在右侧查看和调整具体内容。",
            navAriaLabel: "设置导航",
          },
          sections: {
            general: {
              label: "常规",
              description: "项目基础信息和报告日期",
            },
            archive: {
              label: "归档",
              description: "归档时间、保护和审核流程",
            },
            members: {
              label: "成员",
              description: "邀请成员、调整职责和查看签署状态",
            },
            cmpEngagement: {
              label: "CMP 项目",
              description: "查看已关联的客户和项目",
            },
            tmsLinks: {
              label: "TMS 关联",
              description: "将已保存的 TMS 工时行关联到本项目",
            },
            personal: {
              label: "个性化",
              description: "语言、字号、外观和主题色",
            },
            integrations: {
              label: "连接与集成",
              description: "管理邮箱等连接。",
            },
          },
          appearance: {
            title: "工作台外观",
            description:
              "当前配色和版式保持不变，这里只调整当前账号的显示偏好。",
            flavorLabel: "风格：",
            fontSizeLabel: "字号：",
            accentLabel: "主题色：",
          },
          personal: {
            title: "个人偏好",
            description: "这些设置只影响当前账号，不会改动其他成员的工作台。",
            darkMode: "外观",
            day: "日间",
            night: "夜间",
            fontSize: "字号",
            flavor: "界面风格",
            accent: "主题色",
          },
          members: {
            description: "邀请项目成员、调整职责和查看独立性声明状态。",
          },
          tmsLinks: {
            title: "TMS 项目关联",
            description: "查看已关联工时并关联未归属工时。",
            add: "关联工时",
            pickerTitle: "关联 TMS 工时",
            pickerDescription: "这里只显示未归属项目的可收费行。",
            loading: "正在加载待关联的 TMS 工时...",
            loadingLinked: "正在加载已关联工时...",
            searchPlaceholder: "搜索描述、员工或 TMS 编码",
            searchHint: "",
            pending: "待关联 TMS 工时",
            noPending: "暂无待关联的 TMS 工时。",
            noLinked: "本项目尚未关联 TMS 工时。",
            link: "关联",
            unlink: "解除关联",
            linked: "已关联工时",
            owner: "员工",
            period: "时间段",
            type: "类型",
            timeEntries: "工时日期",
            descriptionColumn: "描述",
            totalHours: "合计",
            actions: "操作",
            tableLabel: "TMS 工时关联",
            firstHalf: "上半月",
            secondHalf: "下半月",
            fullMonth: "整月",
            normal: "正常",
            ot: "加班",
            absent: "缺勤",
            noHours: "尚未填写工时",
            close: "关闭",
            periodConflict: "同一周期不能关联两条工时行，请先解除当前关联。",
            error: "TMS 关联操作失败，请刷新后重试。",
          },
          project: {
            description: "这里保留低频操作，避免它们占用工作台顶部按钮。",
            loading: "正在加载项目基本信息...",
            recycleBinTitle: "回收站",
            recycleBinDescription: "查看并恢复本项目已删除的文件。",
            deletedCountLabel: "已删除",
            deleteGroup: "删除组",
            deletePaper: "删除底稿",
            deleteProject: "删除项目",
            generalSettings: "常规设置",
            projectSchedule: "报告时间",
            archiveProject: "提交归档审核",
            archiveSchedule: "归档时间",
            archiveProtection: "归档保护",
            archiveProtectionDescription:
              "用于保护导出的归档包。留空则使用系统默认归档策略。",
            archiveWorkflow: "归档流程",
            archiveWorkflowDescription:
              "先运行归档文件检查，通过后提交项目进入最终归档审核。",
            archivePassword: "归档包密码",
            archivePasswordPlaceholder: "输入归档密码",
            showArchivePassword: "显示归档密码",
            hideArchivePassword: "隐藏归档密码",
            dangerZone: "危险区域",
            dangerZoneDescription:
              "删除项目会将其移入项目回收站，并从当前桌面移除。",
          },
          fontSizeOptions: {
            sm: "小",
            md: "中",
            lg: "大",
          },
        },
      },
      auditLogs: {
        actor: "操作者",
        allActors: "全部操作者",
        role: "职级",
        allRoles: "全部职级",
        clearFilters: "清除筛选",
        recordSuffix: "条记录",
        time: "时间",
        action: "动作",
        description: "描述",
        noMatches: "没有匹配的记录",
        empty: "暂无审计日志",
        system: "系统",
        roleLabels: {
          PRINCIPAL: "Principal",
          TAX_EXPERT: "N/A",
          ASSISTANT: "Assistant",
          EQCR: "N/A",
          SUPER_ADMIN: "系统管理员",
          PARTNER: "合伙人",
          MANAGER: "经理",
          SENIOR: "高级审计员",
          STAFF: "审计员",
        },
        actionLabels: {
          PROJECT_CREATED: "项目已创建",
        },
      },
    },
    locale: "zh-CN",
    localizedPath: (pathname: string) =>
      pathname.startsWith("/acceptance") ? `/zh-CN${pathname}` : pathname,
  }),
}));

describe("WorkspacePage interactions", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
    mockNavigation.searchParams = "";
    window.history.replaceState(
      null,
      "",
      "/zh-CN/workspaces/workspace-1/projects/project-1"
    );
  });

  describe(WorkspacePage, () => {
    it("blocks workpaper dragging while an interaction-locking modal is open", () => {
      const row = document.createElement("div");
      const modal = document.createElement("div");
      modal.dataset.workbenchInteractionLock = "true";
      document.body.append(row, modal);

      expect(shouldAllowWorkbenchPointerDrag(row)).toBeFalsy();

      row.remove();
      modal.remove();
    });

    it("keeps project navigation in the top bar while project libraries stay in the workspace", async () => {
      setupApi({
        currentGlobalRole: "SUPER_ADMIN",
        includeCurrentMember: false,
      });
      renderWorkspace({ route: "project-first" });

      await expect(
        screen.findByRole("tab", { name: "Company Name" })
      ).resolves.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Smart Form" })
      ).not.toBeInTheDocument();
    });

    it("does not start workpaper dragging from rich-text controls", () => {
      const editor = document.createElement("div");
      editor.setAttribute("contenteditable", "true");
      const toolbarButton = document.createElement("button");

      expect(shouldAllowWorkbenchPointerDrag(editor)).toBeFalsy();
      expect(shouldAllowWorkbenchPointerDrag(toolbarButton)).toBeFalsy();
    });

    it("starts file-row dragging from refcode and file controls", () => {
      const row = document.createElement("tr");
      row.dataset.dndSortable = "true";
      const refCodeButton = document.createElement("button");
      const fileButton = document.createElement("button");
      const editInput = document.createElement("input");
      row.append(refCodeButton, fileButton, editInput);

      expect(shouldAllowWorkbenchPointerDrag(refCodeButton)).toBeTruthy();
      expect(shouldAllowWorkbenchPointerDrag(fileButton)).toBeTruthy();
      expect(shouldAllowWorkbenchPointerDrag(editInput)).toBeFalsy();
    });

    it("opens project-first routes without redirecting back to legacy workspace routes", async () => {
      setupApi();
      mockApi.workflow.mockResolvedValue([]);
      renderWorkspace({ route: "project-first" });

      await expect(
        screen.findByRole("tab", { name: "Company Name" })
      ).resolves.toHaveAttribute("aria-selected", "true");
      expect(vi.mocked(mockRouter.replace)).toHaveBeenCalledTimes(0);
    });

    it("marks project-entry queries as locally handled", async () => {
      setupApi();
      mockApi.workflow.mockResolvedValue([]);
      const { queryClient } = renderWorkspace({ route: "project-first" });

      await screen.findByRole("tab", { name: "Company Name" });
      await waitFor(() => expect(mockApi.inboxMessages).toHaveBeenCalledOnce());

      const expectedQueryRoots = new Set([
        "deleted-attachments",
        "desktop",
        "inbox",
        "me",
        "project",
        "project-attachments",
        "project-file-export-job-active",
        "projectDeclaration",
        "workflow",
      ]);
      const projectEntryQueries = queryClient
        .getQueryCache()
        .getAll()
        .filter((query) => expectedQueryRoots.has(String(query.queryKey[0])));

      expect(
        new Set(projectEntryQueries.map((query) => String(query.queryKey[0])))
      ).toStrictEqual(expectedQueryRoots);
      for (const query of projectEntryQueries) {
        expect(query.meta).toMatchObject({ suppressGlobalErrorToast: true });
      }
    });

    it("retries a failed project query from the local error state", async () => {
      setupApi();
      mockApi.project.mockRejectedValueOnce(
        new Error("Network request failed")
      );
      renderWorkspace({ route: "project-first" });

      await expect(
        screen.findByText("项目工作台暂时无法加载。请检查连接后重试。")
      ).resolves.toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "重试" }));

      await expect(
        screen.findByRole("tab", { name: "Company Name" })
      ).resolves.toHaveAttribute("aria-selected", "true");
      expect(mockApi.project).toHaveBeenCalledTimes(2);
    });

    it.each([
      [
        "FORBIDDEN",
        "当前账号没有访问此项目的权限。请返回工作区，或联系项目负责人确认访问权限。",
      ],
      [
        "PROJECT_NOT_FOUND",
        "该项目不存在或已不可访问。请返回工作区选择其他项目。",
      ],
      ["NOT_FOUND", "该项目不存在或已不可访问。请返回工作区选择其他项目。"],
    ])(
      "does not present %s as a retryable network failure",
      async (code, message) => {
        setupApi();
        mockApi.project.mockRejectedValue(
          new ProjectApiError(code, "Internal diagnostic", "request-1")
        );
        renderWorkspace({ route: "project-first" });
        await expect(screen.findByText(message)).resolves.toBeVisible();
        expect(
          screen.queryByRole("button", { name: "重试" })
        ).not.toBeInTheDocument();
        expect(
          screen.queryByText("Internal diagnostic")
        ).not.toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: "返回工作区" })
        ).toBeEnabled();
        expect(mockApi.project).toHaveBeenCalledOnce();
      }
    );

    it("returns to the folder from which the project was opened", async () => {
      mockNavigation.searchParams =
        "returnTo=%2Fengagement%3FfolderId%3Dfolder-abc";
      setupApi();
      renderWorkspace({ route: "project-first" });

      await screen.findByRole("tab", { name: "Company Name" });
      const backButton = screen.getByRole("button", {
        name: "返回工作区",
      });
      fireEvent.click(backButton);
      expect(mockRouter.push).toHaveBeenCalledWith(
        "/engagement?folderId=folder-abc"
      );
    });

    it("switches to project files from the confirmation project shortcut", async () => {
      mockNavigation.searchParams =
        "workspace=confirmations&returnTo=%2Fconfirmations&confirmationId=confirmation-1&confirmationStage=review";
      setupApi();
      renderWorkspace({ route: "project-first" });
      const toolbar = await screen.findByRole("toolbar", {
        name: "项目快捷操作",
      });
      fireEvent.click(
        await within(toolbar).findByRole("button", { name: "Engagement" })
      );
      await waitFor(() =>
        expect(
          within(toolbar).getByRole("button", { name: "Engagement" })
        ).toHaveAttribute("data-active", "true")
      );
      expect(mockRouter.push).not.toHaveBeenCalled();
      expect(new URL(window.location.href).searchParams.get("workspace")).toBe(
        "files"
      );
    });

    it("returns confirmation workspaces to the confirmation center by default", async () => {
      mockNavigation.searchParams = "workspace=confirmations";
      setupApi();
      renderWorkspace({ route: "project-first" });

      const backButton = await screen.findByRole("button", {
        name: "函证中心",
      });
      fireEvent.click(backButton);
      expect(mockRouter.push).toHaveBeenCalledWith("/confirmations");
    });

    it("preserves the mobile confirmation selection in the return URL", async () => {
      const returnTo =
        "/confirmations#confirmations?view=ALL&project=project-1&scope=all";
      mockNavigation.searchParams = `workspace=confirmations&returnTo=${encodeURIComponent(returnTo)}`;
      setupApi();
      renderWorkspace({ route: "project-first" });
      fireEvent.click(await screen.findByRole("button", { name: "函证中心" }));
      expect(mockRouter.push).toHaveBeenCalledWith(returnTo);
    });

    it("switches to confirmations when the route changes on a mounted project workspace", async () => {
      setupApi();
      const { queryClient } = renderWorkspace({ route: "project-first" });
      await screen.findByRole("tab", { name: "Company Name" });
      expect(screen.getByText("选择一个底稿或文件")).toBeInTheDocument();
      mockNavigation.searchParams =
        "workspace=confirmations&returnTo=%2Fconfirmations";
      act(() => {
        queryClient.setQueryData(
          ["project", "project-1"],
          (project: Record<string, unknown> | undefined) => ({
            ...project,
            name: "Updated project",
          })
        );
      });
      await waitFor(() =>
        expect(screen.queryByText("选择一个底稿或文件")).not.toBeInTheDocument()
      );
      await waitFor(() =>
        expect(mockApi.confirmationTemplateLibrary).toHaveBeenCalledWith(
          expect.objectContaining({
            queryKey: ["confirmation-template-library"],
          })
        )
      );
    });

    it("opens the current project confirmations and keeps repeated shortcut clicks there", async () => {
      setupApi();
      confirmationPanelStub.enabled = true;
      try {
        renderWorkspace({ route: "project-first" });
        await screen.findByRole("tab", { name: "Company Name" });
        const toolbar = screen.getByRole("toolbar", { name: "项目快捷操作" });
        const shortcut = within(toolbar).getByRole("button", {
          name: "Confirmation",
        });
        fireEvent.click(shortcut);
        await screen.findByRole("button", { name: "在项目中查看" });
        expect(vi.mocked(mockRouter.push)).toHaveBeenCalledTimes(0);
        fireEvent.click(shortcut);
        expect(
          screen.getByRole("button", { name: "在项目中查看" })
        ).toBeInTheDocument();
        const projectShortcut = within(toolbar).getByRole("button", {
          name: "Engagement",
        });
        fireEvent.click(projectShortcut);
        await waitFor(() =>
          expect(projectShortcut).toHaveAttribute("data-active", "true")
        );
        expect(
          new URL(window.location.href).searchParams.get("workspace")
        ).toBe("files");
        expect(mockRouter.push).not.toHaveBeenCalled();
        fireEvent.click(shortcut);
        await screen.findByRole("button", { name: "在项目中查看" });
        expect(
          new URL(window.location.href).searchParams.get("workspace")
        ).toBe("confirmations");
        const back = screen
          .getAllByRole("button", { name: "函证中心" })
          .find((button) => !toolbar.contains(button));
        fireEvent.click(requiredFixture(back));
        expect(mockRouter.push).toHaveBeenCalledWith("/confirmations");
      } finally {
        confirmationPanelStub.enabled = false;
      }
    });

    it("opens project tasks over confirmations and dismisses them for another header action", async () => {
      mockNavigation.searchParams =
        "workspace=confirmations&confirmationId=confirmation-1";
      setupApi();
      confirmationPanelStub.enabled = true;
      try {
        renderWorkspace({ route: "project-first" });
        await screen.findByRole("button", { name: "在项目中查看" });
        fireEvent.click(screen.getByRole("button", { name: "项目待办" }));
        await screen.findByRole("complementary", { name: "项目待办" });
        expect(
          screen.getByRole("button", { name: "在项目中查看" })
        ).toBeInTheDocument();
        expect(mockRouter.push).not.toHaveBeenCalled();
        expect(mockApi.workflow).not.toHaveBeenCalled();
        fireEvent.click(
          requiredFixture(
            document.querySelector('[data-action-id="engagement"]')
          )
        );
        await waitFor(() =>
          expect(
            screen.queryByRole("complementary", { name: "项目待办" })
          ).toBeNull()
        );
      } finally {
        confirmationPanelStub.enabled = false;
      }
    });

    it("loads project files when viewing an import from the confirmation workspace", async () => {
      mockNavigation.searchParams = "workspace=confirmations";
      setupApi();
      confirmationPanelStub.enabled = true;
      try {
        renderWorkspace({ route: "project-first" });
        const viewFiles = await screen.findByRole("button", {
          name: "在项目中查看",
        });
        expect(vi.mocked(mockApi.workflow)).toHaveBeenCalledTimes(0);
        expect(mockApi.projectAttachments).toHaveBeenCalledTimes(0);
        fireEvent.click(viewFiles);
        await waitFor(() => {
          expect(mockApi.workflow).toHaveBeenCalledWith("project-1");
          expect(mockApi.projectAttachments).toHaveBeenCalledWith("project-1");
          expect(mockApi.activeProjectFileExportJob).toHaveBeenCalledWith(
            "project-1"
          );
        });
        expect(mockNavigation.searchParams).toBe("workspace=confirmations");
      } finally {
        confirmationPanelStub.enabled = false;
      }
    });

    it("does not load project file APIs for the confirmation workspace", async () => {
      mockNavigation.searchParams = "workspace=confirmations";
      setupApi({
        currentGlobalRole: "CONFIRMATION_OFFICER",
        includeCurrentMember: false,
      });
      renderWorkspace({ route: "project-first" });

      await screen.findByRole("button", { name: "函证中心" });

      expect(vi.mocked(mockApi.workflow)).toHaveBeenCalledTimes(0);
      expect(vi.mocked(mockApi.projectAttachments)).toHaveBeenCalledTimes(0);
      expect(
        vi.mocked(mockApi.activeProjectFileExportJob)
      ).toHaveBeenCalledTimes(0);
    });

    it("does not force the default A1 title into the workbench header", async () => {
      setupApi();
      mockApi.workflow.mockResolvedValue([
        {
          id: "planning",
          code: "Planning",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          workingPapers: [],
          children: [
            {
              id: "a1",
              parentId: "planning",
              code: "A1",
              title: "A1",
              level: 2,
              nodeType: "ACCOUNT",
              workingPapers: [],
              children: [],
            },
          ],
        },
        {
          id: "execution",
          code: "Execution",
          title: "Execution",
          level: 1,
          nodeType: "PHASE",
          workingPapers: [],
          children: [
            {
              id: "execution-a1",
              parentId: "execution",
              code: "A1",
              title: "A1",
              level: 2,
              nodeType: "ACCOUNT",
              workingPapers: [],
              children: [],
            },
          ],
        },
      ]);

      renderWorkspace({ route: "project-first" });

      await ensureDirectoryNodeExpanded("planning");
      fireEvent.click(
        await screen.findByRole("treeitem", { name: "A1" }, { timeout: 5000 })
      );

      await waitFor(() =>
        expect(screen.getByTestId("workbench-selected-path")).toHaveTextContent(
          "A - Planning"
        )
      );
      expect(screen.getByTestId("workbench-selected-path")).toHaveTextContent(
        "A1"
      );
      expect(
        screen.getByTestId("workbench-selected-path")
      ).not.toHaveTextContent("Client acceptance or continuance");

      cleanup();
      renderWorkspace({ route: "project-first" });

      await ensureDirectoryNodeExpanded("execution");
      fireEvent.click(await findDirectoryNodeButton("execution-a1"));

      await waitFor(() =>
        expect(screen.getByTestId("workbench-selected-path")).toHaveTextContent(
          "B - Execution"
        )
      );
      expect(screen.getByTestId("workbench-selected-path")).toHaveTextContent(
        "B1"
      );
      expect(
        screen.getByTestId("workbench-selected-path")
      ).not.toHaveTextContent("B - Execution \u203A B1 - A1");
    }, 20_000);

    it("shows archived projects as read-only workspaces", async () => {
      setupApi({ projectStatus: "ARCHIVED" });
      mockApi.workflow.mockResolvedValue([]);
      renderWorkspace({ route: "project-first" });

      await expect(screen.findByText("已归档")).resolves.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "新增底稿 A01" })
      ).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "设置" }));
      expect(
        screen.queryByRole("button", { name: "归档项目" })
      ).not.toBeInTheDocument();
      await act(async () => {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 0);
        });
      });
    });

    it("allows SUPER_ADMIN insertion actions without project membership", async () => {
      setupApi({
        currentGlobalRole: "SUPER_ADMIN",
        includeCurrentMember: false,
      });
      renderWorkspace({ route: "project-first" });

      const blankDropZone = await screen.findByTestId(
        "project-file-blank-context-target"
      );
      fireEvent.contextMenu(blankDropZone);

      expect(
        screen.queryByRole("menuitem", { name: "New Smart Form" })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("menuitem", { name: "New from template" })
      ).toBeInTheDocument();
    });

    it("shows pending-final-check projects as read-only workspaces", async () => {
      setupApi({ projectStatus: "PENDING_FINAL_CHECK" });
      renderWorkspace({ route: "project-first" });

      await expect(
        screen.findByText("待归档审核")
      ).resolves.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "鏂板搴曠 A01" })
      ).not.toBeInTheDocument();
    });

    it("confirms final archive from settings after a clean secondary file check", async () => {
      setupApi({
        projectStatus: "PENDING_FINAL_CHECK",
        currentGlobalRole: "SUPER_ADMIN",
      });
      renderWorkspace({ route: "project-first" });

      await expect(
        screen.findByText("待归档审核")
      ).resolves.toBeInTheDocument();
      fireEvent.click(
        await screen.findByRole("button", { name: "最终检查并归档" })
      );

      const dialog = await screen.findByRole("region", {
        name: "归档文件检查",
      });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "确认完成归档" })
      );
      await expect(
        within(dialog).findByText("确认归档项目信息")
      ).resolves.toBeInTheDocument();
      fireEvent.click(
        within(dialog).getByRole("button", { name: "确认完成归档" })
      );

      await waitFor(() => {
        expect(mockApi.confirmProjectArchive).toHaveBeenCalledWith("project-1");
      });
      expect(vi.mocked(mockApi.submitArchive)).toHaveBeenCalledTimes(0);
    });

    it("opens the hidden file preview pane for the clicked project file row", async () => {
      setupApi();
      const previewPaper = {
        id: "paper-preview",
        projectId: "project-1",
        workflowNodeId: "a1-1000",
        code: "A01-0001-F001",
        title: "preview.xlsx",
        paperType: "WORKING_PAPER" as const,
        bucket: "CURRENT" as const,
        reviewQuestions: [],
        signoffs: [],
      };
      const previewAttachment = {
        id: "attachment-preview",
        projectId: "project-1",
        workingPaperId: "paper-preview",
        fileKind: "SPREADSHEET" as const,
        fileName: "preview.xlsx",
        originalName: "preview.xlsx",
        fileUrl: "uploads/preview.xlsx",
        fileSize: 128,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        version: 1,
        createdAt: "2026-06-01T08:00:00.000Z",
        lastModifiedAt: "2026-06-01T08:00:00.000Z",
        lockedBy: null,
        lockExpiresAt: null,
        lockSessionId: null,
        workingPaper: {
          ...previewPaper,
          workflowNodeCode: "A01-0001",
          workflowNodeTitle: "银行凭据",
        },
      };
      mockApi.workflow.mockResolvedValue([
        {
          id: "planning",
          code: "Planning",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          workingPapers: [],
          children: [
            {
              id: "a1",
              parentId: "planning",
              code: "A01",
              title: "银行存款",
              level: 2,
              nodeType: "ACCOUNT",
              workingPapers: [],
              children: [
                {
                  id: "a1-1000",
                  parentId: "a1",
                  code: "A01-0001",
                  title: "银行凭据",
                  level: 3,
                  nodeType: "FOLDER",
                  workingPapers: [
                    { ...previewPaper, attachments: [previewAttachment] },
                  ],
                },
              ],
            },
          ],
        },
      ]);
      mockApi.projectAttachments.mockResolvedValue([previewAttachment]);

      renderWorkspace({ route: "project-first" });

      await expect(
        screen.findByTestId("project-header-project-label")
      ).resolves.toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "文件预览" })).toBeNull();

      const fileName = await screen.findByText(/preview\.xlsx/);
      fireEvent.click(requireElement(fileName.closest("tr")));

      await expect(
        screen.findByRole("region", { name: "文件预览" })
      ).resolves.toBeInTheDocument();
      await waitFor(() =>
        expect(mockApi.previewAttachment).toHaveBeenCalledWith(
          "project-1",
          "attachment-preview",
          expect.objectContaining({
            limit: 200,
            columnLimit: 30,
          })
        )
      );
    }, 15_000);

    it("keeps the file tree open when the preview pane is shown", async () => {
      setupApi();
      renderWorkspace();

      await expect(
        screen.findByTestId("project-header-project-label")
      ).resolves.toBeInTheDocument();
      await expect(
        screen.findByTestId("directory-resize-rail")
      ).resolves.toHaveAttribute("data-state", "expanded");

      fireEvent.click(await screen.findByTestId("preview-resize-rail"));

      await expect(
        screen.findByRole("region", { name: "文件预览" })
      ).resolves.toBeInTheDocument();
      expect(screen.getByTestId("directory-resize-rail")).toHaveAttribute(
        "data-state",
        "expanded"
      );
      expect(screen.getByTestId("directory-resize-rail")).toHaveAccessibleName(
        "调整文件树面板宽度"
      );
    });

    it("keeps the preview and project work item sidebars mutually exclusive", async () => {
      setupApi();
      renderWorkspace();

      await expect(
        screen.findByTestId("project-header-project-label")
      ).resolves.toBeInTheDocument();
      fireEvent.click(await screen.findByTestId("preview-resize-rail"));
      await expect(
        screen.findByRole("region", { name: "文件预览" })
      ).resolves.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "项目待办" }));
      await expect(
        screen.findByRole("complementary", { name: "项目待办" })
      ).resolves.toBeInTheDocument();
      expect(mockApi.workItems).toHaveBeenCalledWith({
        view: "PERSONAL",
        scope: "PROJECT",
        projectId: "project-1",
        locale: "zh-CN",
      });
      expect(screen.queryByRole("region", { name: "文件预览" })).toBeNull();
      expect(screen.queryByTestId("preview-resize-rail")).toBeNull();
      expect(
        document.querySelector('[data-slot="resizable-handle"]')
      ).not.toBeNull();

      const taskPanel = document.querySelector("#project-team-work-items");
      fireEvent.click(screen.getByRole("button", { name: "关闭项目待办" }));
      expect(document.querySelector("#project-team-work-items")).toBe(
        taskPanel
      );
      expect(document.querySelector("#project-file-preview")).toHaveAttribute(
        "data-collapsed",
        "true"
      );
      expect(
        document.querySelector("#project-team-work-items")
      ).toHaveAttribute("data-collapsed", "true");
      fireEvent.click(await screen.findByTestId("preview-resize-rail"));
      await expect(
        screen.findByRole("region", { name: "文件预览" })
      ).resolves.toBeInTheDocument();
      expect(
        screen.queryByRole("complementary", { name: "项目待办" })
      ).toBeNull();
    });

    it("previews the selected file after the preview pane is shown", async () => {
      setupApi();
      const previewPaper = {
        id: "paper-preview",
        projectId: "project-1",
        workflowNodeId: "a1-1000",
        code: "A01-0001-F001",
        title: "preview.xlsx",
        paperType: "WORKING_PAPER" as const,
        bucket: "CURRENT" as const,
        reviewQuestions: [],
        signoffs: [],
      };
      const previewAttachment = {
        id: "attachment-preview",
        projectId: "project-1",
        workingPaperId: "paper-preview",
        fileKind: "SPREADSHEET" as const,
        fileName: "preview.xlsx",
        originalName: "preview.xlsx",
        fileUrl: "uploads/preview.xlsx",
        fileSize: 128,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        version: 1,
        createdAt: "2026-06-01T08:00:00.000Z",
        lastModifiedAt: "2026-06-01T08:00:00.000Z",
        lockedBy: null,
        lockExpiresAt: null,
        lockSessionId: null,
        workingPaper: {
          ...previewPaper,
          workflowNodeCode: "A01-0001",
          workflowNodeTitle: "银行凭据",
        },
      };
      mockApi.workflow.mockResolvedValue([
        {
          id: "planning",
          code: "Planning",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          workingPapers: [],
          children: [
            {
              id: "a1",
              parentId: "planning",
              code: "A01",
              title: "银行存款",
              level: 2,
              nodeType: "ACCOUNT",
              workingPapers: [],
              children: [
                {
                  id: "a1-1000",
                  parentId: "a1",
                  code: "A01-0001",
                  title: "银行凭据",
                  level: 3,
                  nodeType: "FOLDER",
                  workingPapers: [
                    { ...previewPaper, attachments: [previewAttachment] },
                  ],
                },
              ],
            },
          ],
        },
      ]);
      mockApi.projectAttachments.mockResolvedValue([previewAttachment]);

      renderWorkspace({ route: "project-first" });

      await expect(
        screen.findByTestId("project-header-project-label")
      ).resolves.toBeInTheDocument();
      const previewRail = await screen.findByTestId("preview-resize-rail");
      expect(previewRail).toHaveAttribute("data-slot", "splitter-rail");
      expect(previewRail).toHaveAccessibleName("调整文件预览面板宽度");
      expect(previewRail.parentElement).toHaveAttribute(
        "data-slot",
        "resizable-panel-group"
      );
      expect(
        screen.queryByRole("region", { name: "文件预览" })
      ).not.toBeInTheDocument();

      const fileName = await screen.findByText(/preview\.xlsx/);
      fireEvent.contextMenu(requireElement(fileName.closest("tr")));
      fireEvent.click(await screen.findByRole("menuitem", { name: "Preview" }));

      const previewPane = await screen.findByRole("region", {
        name: "文件预览",
      });
      expect(previewPane).toHaveAttribute(
        "data-testid",
        "file-preview-dropzone"
      );
      expect(previewPane).toHaveClass("relative", "bg-workbench-sidebar");
      expect(previewPane.parentElement).toHaveClass(
        "rounded-lg",
        "border",
        "border-border"
      );
      expect(
        within(previewPane).queryByRole("button", { name: "隐藏文件预览" })
      ).not.toBeInTheDocument();
      const hidePreviewRail = screen.getByTestId("preview-resize-rail");
      expect(hidePreviewRail).toHaveAttribute("data-state", "expanded");
      expect(hidePreviewRail).toHaveAccessibleName("调整文件预览面板宽度");
      await waitFor(() =>
        expect(mockApi.previewAttachment).toHaveBeenCalledWith(
          "project-1",
          "attachment-preview",
          expect.objectContaining({
            limit: 200,
            columnLimit: 30,
          })
        )
      );
      expect(previewPane).toHaveClass("bg-workbench-sidebar");

      fireEvent.click(hidePreviewRail);
      await waitFor(() =>
        expect(screen.queryByRole("region", { name: "文件预览" })).toBeNull()
      );
      const showPreviewRail = screen.getByTestId("preview-resize-rail");
      expect(showPreviewRail).toHaveAttribute("data-state", "collapsed");

      fireEvent.click(showPreviewRail);
      const reopenedPreviewPane = await screen.findByTestId(
        "file-preview-dropzone"
      );
      expect(
        within(reopenedPreviewPane).getByText("preview.xlsx")
      ).toBeVisible();
    });

    it("shows a retryable error instead of an endless loader when a cached preview fails", async () => {
      setupApi();
      mockApi.previewAttachment.mockRejectedValue(
        new Error("Storage unavailable")
      );
      const attachment: Attachment = {
        id: "attachment-preview-error",
        fileKind: "SPREADSHEET",
        fileName: "failing.xlsx",
        originalName: "failing.xlsx",
        fileUrl: "uploads/failing.xlsx",
        fileSize: 128,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        version: 1,
      };
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(WorkbenchFilePreviewPane, {
            projectId: "project-1",
            attachment,
          })
        )
      );

      const previewAlert = await screen.findByRole(
        "alert",
        {},
        { timeout: 5000 }
      );
      expect(
        within(previewAlert).getByRole("button", { name: "Retry" })
      ).toBeVisible();
      expect(screen.getByRole("alert")).not.toHaveTextContent(
        "Storage unavailable"
      );
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

      mockApi.previewAttachment.mockResolvedValue(makeSpreadsheetPreview());
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      await waitFor(() =>
        expect(mockApi.previewAttachment).toHaveBeenCalledTimes(4)
      );
    }, 10_000);

    it("streams the next cached spreadsheet block when the preview nears the end", async () => {
      setupApi();
      mockApi.previewAttachment.mockImplementation(
        (_projectId, attachmentId, input) => {
          const offset = input?.offset ?? 0;
          const rowCount = offset === 0 ? 200 : 1;
          return {
            ...makeSpreadsheetPreview(attachmentId, input),
            totalRows: 201,
            rows: Array.from({ length: rowCount }, (_, index) => ({
              rowNumber: offset + index + 1,
              cells: [`Cell A${offset + index + 1}`],
            })),
            hasMore: offset === 0,
          };
        }
      );
      const attachment: Attachment = {
        id: "attachment-streaming-preview",
        fileKind: "SPREADSHEET",
        fileName: "large.xlsx",
        originalName: "large.xlsx",
        fileUrl: "uploads/large.xlsx",
        fileSize: 128,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        version: 1,
      };
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(WorkbenchFilePreviewPane, {
            projectId: "project-1",
            attachment,
          })
        )
      );

      const scroller = await screen.findByTestId(
        "spreadsheet-preview-scroller"
      );
      await waitFor(() =>
        expect(mockApi.previewAttachment).toHaveBeenCalledWith(
          "project-1",
          "attachment-streaming-preview",
          expect.objectContaining({ offset: 0, limit: 200 })
        )
      );
      Object.defineProperties(scroller, {
        clientHeight: { configurable: true, value: 600 },
        scrollHeight: { configurable: true, value: 6000 },
        scrollTop: { configurable: true, value: 5500 },
      });
      fireEvent.scroll(scroller);

      await waitFor(() =>
        expect(mockApi.previewAttachment).toHaveBeenCalledWith(
          "project-1",
          "attachment-streaming-preview",
          expect.objectContaining({ offset: 200, limit: 200 })
        )
      );
    });

    it("renders the cached spreadsheet with adaptive overflow and resizable rows and columns", async () => {
      setupApi();
      const longDescription = "A".repeat(100);
      mockApi.previewAttachment.mockResolvedValue({
        ...makeSpreadsheetPreview("attachment-extend-grid", {
          offset: 0,
          limit: 200,
          columnLimit: 30,
        }),
        totalRows: 1,
        totalColumns: 3,
        sheetNames: ["README", "Data"],
        rows: [
          {
            rowNumber: 1,
            cells: [longDescription, "", "Boundary"],
          },
        ],
      });
      const attachment: Attachment = {
        id: "attachment-extend-grid",
        fileKind: "SPREADSHEET",
        fileName: "extend-grid.xlsx",
        originalName: "extend-grid.xlsx",
        fileUrl: "uploads/extend-grid.xlsx",
        fileSize: 128,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        version: 1,
      };
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(WorkbenchFilePreviewPane, {
            projectId: "project-1",
            attachment,
          })
        )
      );

      const firstHeader = await screen.findByRole("columnheader", {
        name: "A",
      });
      expect(screen.getByRole("tab", { name: "README" })).toHaveAttribute(
        "aria-selected",
        "true"
      );
      expect(screen.getByRole("tab", { name: "Data" })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Move left" })
      ).not.toBeInTheDocument();
      const overflowingText = screen.getByTestId("spreadsheet-cell-text-1-0");
      expect(firstHeader).toHaveStyle({ width: "320px" });
      expect(overflowingText).toHaveStyle({ width: "416px" });

      const firstCell = screen.getByTestId("spreadsheet-cell-1-0");
      fireEvent.click(firstCell);
      expect(firstCell).toHaveAttribute("aria-selected", "true");
      expect(
        screen.queryByTestId("spreadsheet-formula-value")
      ).not.toBeInTheDocument();

      fireEvent.keyDown(
        screen.getByRole("separator", { name: "Resize A column" }),
        {
          key: "ArrowRight",
        }
      );
      expect(firstHeader).toHaveStyle({ width: "330px" });

      const firstRow = screen.getByTestId("spreadsheet-preview-row");
      fireEvent.keyDown(
        screen.getByRole("separator", { name: "Resize row 1" }),
        {
          key: "ArrowDown",
        }
      );
      await waitFor(() => expect(firstRow).toHaveStyle({ height: "35px" }));
    });

    it("previews the clicked zip file instead of another file on the same workpaper", async () => {
      setupApi();
      const sharedPaper = {
        id: "paper-shared",
        projectId: "project-1",
        workflowNodeId: "a1-1000",
        code: "A01-0001-F005",
        title: "shared attachments",
        paperType: "WORKING_PAPER" as const,
        bucket: "CURRENT" as const,
        reviewQuestions: [],
        signoffs: [],
      };
      const pdfAttachment = {
        id: "attachment-pdf",
        projectId: "project-1",
        workingPaperId: "paper-shared",
        fileKind: "SUPPORTING" as const,
        fileName: "report.pdf",
        originalName: "report.pdf",
        fileUrl: "uploads/report.pdf",
        fileSize: 128,
        mimeType: "application/pdf",
        version: 1,
        createdAt: "2026-06-01T08:00:00.000Z",
        lastModifiedAt: "2026-06-01T08:00:00.000Z",
        lockedBy: null,
        lockExpiresAt: null,
        lockSessionId: null,
        workingPaper: {
          ...sharedPaper,
          workflowNodeCode: "A01-0001",
          workflowNodeTitle: "银行凭据",
        },
      };
      const zipAttachment = {
        ...pdfAttachment,
        id: "attachment-zip",
        fileKind: "SUPPORTING" as const,
        fileName: "archive.zip",
        originalName: "archive.zip",
        fileUrl: "uploads/archive.zip",
        mimeType: "application/zip",
      };
      mockApi.workflow.mockResolvedValue([
        {
          id: "planning",
          code: "Planning",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          workingPapers: [],
          children: [
            {
              id: "a1",
              parentId: "planning",
              code: "A01",
              title: "银行存款",
              level: 2,
              nodeType: "ACCOUNT",
              workingPapers: [],
              children: [
                {
                  id: "a1-1000",
                  parentId: "a1",
                  code: "A01-0001",
                  title: "银行凭据",
                  level: 3,
                  nodeType: "FOLDER",
                  workingPapers: [
                    {
                      ...sharedPaper,
                      attachments: [pdfAttachment, zipAttachment],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ]);
      mockApi.projectAttachments.mockResolvedValue([
        zipAttachment,
        pdfAttachment,
      ]);

      renderWorkspace({ route: "project-first" });

      await expect(
        screen.findByTestId("project-header-project-label")
      ).resolves.toBeInTheDocument();
      const zipFileName = await screen.findByText(/archive\.zip/);
      fireEvent.contextMenu(requireElement(zipFileName.closest("tr")));
      fireEvent.click(await screen.findByRole("menuitem", { name: "Preview" }));
      const previewPane = await screen.findByRole("region", {
        name: "文件预览",
      });

      await waitFor(() =>
        expect(mockApi.previewAttachmentContent).toHaveBeenCalledWith(
          "project-1",
          "attachment-zip",
          1
        )
      );
      await expect(
        within(previewPane).findByTestId("archive-viewer")
      ).resolves.toHaveTextContent("archive.zip");
      expect(vi.mocked(mockApi.readZip)).toHaveBeenCalledTimes(0);
    });

    it("shows an animated loading state while zip preview is loading", async () => {
      setupApi();
      const sharedPaper = {
        id: "paper-shared",
        projectId: "project-1",
        workflowNodeId: "a1-1000",
        code: "A01-0001-F005",
        title: "shared attachments",
        paperType: "WORKING_PAPER" as const,
        bucket: "CURRENT" as const,
        reviewQuestions: [],
        signoffs: [],
      };
      const zipAttachment = {
        id: "attachment-zip",
        projectId: "project-1",
        workingPaperId: "paper-shared",
        fileKind: "SUPPORTING" as const,
        fileName: "archive.zip",
        originalName: "archive.zip",
        fileUrl: "uploads/archive.zip",
        fileSize: 128,
        mimeType: "application/zip",
        version: 1,
        createdAt: "2026-06-01T08:00:00.000Z",
        lastModifiedAt: "2026-06-01T08:00:00.000Z",
        lockedBy: null,
        lockExpiresAt: null,
        lockSessionId: null,
        workingPaper: {
          ...sharedPaper,
          workflowNodeCode: "A01-0001",
          workflowNodeTitle: "银行凭据",
        },
      };
      mockApi.workflow.mockResolvedValue([
        {
          id: "planning",
          code: "Planning",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          workingPapers: [],
          children: [
            {
              id: "a1",
              parentId: "planning",
              code: "A01",
              title: "银行存款",
              level: 2,
              nodeType: "ACCOUNT",
              workingPapers: [],
              children: [
                {
                  id: "a1-1000",
                  parentId: "a1",
                  code: "A01-0001",
                  title: "银行凭据",
                  level: 3,
                  nodeType: "FOLDER",
                  workingPapers: [
                    {
                      ...sharedPaper,
                      attachments: [zipAttachment],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ]);
      mockApi.projectAttachments.mockResolvedValue([zipAttachment]);
      mockApi.previewAttachmentContent.mockReturnValue(new Promise(() => {}));

      renderWorkspace({ route: "project-first" });

      await expect(
        screen.findByTestId("project-header-project-label")
      ).resolves.toBeInTheDocument();
      const zipFileName = await screen.findByText(/archive\.zip/);
      fireEvent.contextMenu(requireElement(zipFileName.closest("tr")));
      fireEvent.click(await screen.findByRole("menuitem", { name: "Preview" }));
      const previewPane = await screen.findByRole("region", {
        name: "文件预览",
      });
      const progress = await within(previewPane).findByRole("progressbar", {
        name: "正在加载预览...",
      });
      expect(progress).toHaveClass("animate-spin");
      expect(within(previewPane).getByText("正在加载预览...")).toBeTruthy();
    });

    it("does not expose an Inbox entry in the project toolbar", async () => {
      setupApi();
      renderWorkspace({ route: "project-first" });

      await expect(
        screen.findByTestId("project-header-project-label")
      ).resolves.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "收件箱" })
      ).not.toBeInTheDocument();
      await expect(
        screen.findByRole("button", { name: "项目待办" })
      ).resolves.toBeInTheDocument();
    });

    it("hides temporary files, notifications, recycle bin, and libraries for EQR", async () => {
      setupApi({ currentProjectRole: "EQCR", currentInChargeRole: null });
      mockApi.workflow.mockResolvedValue([
        {
          id: "planning",
          code: "Planning",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          workingPapers: [],
          children: [
            {
              id: "a1-1000",
              parentId: "planning",
              code: "A01-0001",
              title: "Cash",
              level: 3,
              nodeType: "FOLDER",
              workingPapers: [
                {
                  id: "temporary-paper",
                  projectId: "project-1",
                  workflowNodeId: "a1-1000",
                  code: "TMP001",
                  title: "temporary.xlsx",
                  paperType: "WORKING_PAPER",
                  bucket: "TEMPORARY",
                  attachments: [],
                },
              ],
              children: [],
            },
          ],
        },
      ]);

      renderWorkspace({ route: "project-first" });

      await expect(
        screen.findByTestId("project-header-project-label")
      ).resolves.toBeInTheDocument();
      await waitFor(() =>
        expect(mockApi.workflow).toHaveBeenCalledWith("project-1")
      );
      expect(vi.mocked(mockApi.deletedAttachments)).toHaveBeenCalledTimes(0);
    }, 10_000);

    it("keeps denied file mutation actions visible but disabled for EQR", async () => {
      setupApi({ currentProjectRole: "EQCR", currentInChargeRole: null });
      const sourcePaper = {
        id: "paper-source-menu",
        projectId: "project-1",
        workflowNodeId: "source-node",
        code: "A01-0001-F001",
        title: "selected-current.pdf",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
        reviewQuestions: [],
        signoffs: [],
      };
      const sourceAttachment = {
        id: "attachment-selected-current",
        projectId: "project-1",
        workingPaperId: "paper-source-menu",
        fileKind: "SUPPORTING",
        fileName: "selected-current.pdf",
        originalName: "selected-current.pdf",
        fileUrl: "uploads/selected-current.pdf",
        fileSize: 128,
        mimeType: "application/pdf",
        version: 1,
        createdAt: "2026-06-01T08:00:00.000Z",
        lastModifiedAt: "2026-06-01T08:00:00.000Z",
        lockedBy: null,
        lockExpiresAt: null,
        lockSessionId: null,
        workingPaper: sourcePaper,
      };
      mockApi.workflow.mockResolvedValue([
        {
          id: "planning",
          code: "Planning",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          workingPapers: [],
          children: [
            {
              id: "source-node",
              parentId: "planning",
              code: "A01-0001",
              title: "Source",
              level: 3,
              nodeType: "FOLDER",
              workingPapers: [
                {
                  ...sourcePaper,
                  attachments: [sourceAttachment],
                },
              ],
              children: [],
            },
          ],
        },
      ]);
      mockApi.projectAttachments.mockResolvedValue([sourceAttachment]);

      renderWorkspace({ route: "project-first" });

      const sourceName = await screen.findByText(
        /selected\s+-\s+current\.pdf/,
        undefined,
        { timeout: 10_000 }
      );
      const sourceRow = requireElement(sourceName.closest("tr"));
      expect(sourceRow).toBeTruthy();
      fireEvent.contextMenu(sourceRow as HTMLTableRowElement, {
        clientX: 96,
        clientY: 96,
      });

      await expect(
        screen.findByRole("menuitem", { name: "Export" })
      ).resolves.not.toHaveAttribute("aria-disabled", "true");
      for (const label of [
        "Change Refcode",
        "Rename",
        "Reset head",
        "Copy",
        "Cut",
        "Delete",
      ]) {
        expect(screen.getByRole("menuitem", { name: label })).toHaveAttribute(
          "aria-disabled",
          "true"
        );
      }
    }, 10_000);

    it("defaults to the overview workbench without audit log tabs", async () => {
      setupApi();
      renderWorkspace();

      await expect(
        screen.findByRole("tab", { name: "Company Name" })
      ).resolves.toHaveAttribute("aria-selected", "true");
      expect(
        screen.queryByRole("tab", { name: "总览" })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("tab", { name: "日志" })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("创建项目 AUD - 2026 - 0001")
      ).not.toBeInTheDocument();
    });

    it("hides and restores the file tree panel from the quick handler", async () => {
      setupApi();
      renderWorkspace();

      await expect(
        screen.findByTestId("project-header-project-label")
      ).resolves.toBeInTheDocument();

      const panelToggle = await screen.findByTestId("directory-resize-rail");
      expect(panelToggle).toHaveAttribute("data-slot", "splitter-rail");
      expect(panelToggle).toHaveAttribute("data-state", "expanded");
      expect(panelToggle).toHaveAccessibleName("调整文件树面板宽度");
      expect(panelToggle).toHaveClass("w-3", "mx-0", "z-20");
      expect(panelToggle).not.toHaveClass("mx-1.5");
      expect(panelToggle).toHaveClass("bg-transparent", "cursor-pointer");

      fireEvent.click(panelToggle);

      await waitFor(() =>
        expect(screen.getByTestId("directory-resize-rail")).toHaveAttribute(
          "data-state",
          "collapsed"
        )
      );
      const restoreRail = screen.getByTestId("directory-resize-rail");
      expect(restoreRail).toHaveAccessibleName("调整文件树面板宽度");
      expect(restoreRail).toHaveClass(
        "w-3",
        "-translate-x-1/2",
        "bg-transparent"
      );

      fireEvent.click(screen.getByTestId("preview-resize-rail"));
      await expect(
        screen.findByRole("region", { name: "文件预览" })
      ).resolves.toBeInTheDocument();
      expect(screen.getByTestId("directory-resize-rail")).toHaveAttribute(
        "data-state",
        "collapsed"
      );
      fireEvent.click(restoreRail);

      await waitFor(() =>
        expect(screen.getByTestId("directory-resize-rail")).toHaveAttribute(
          "data-state",
          "expanded"
        )
      );
    });

    it("locates file search results without opening the workpaper preview", async () => {
      setupApi();
      const searchPaper = {
        id: "paper-search",
        projectId: "project-1",
        workflowNodeId: "search-folder",
        code: "A1000",
        title: "searchtarget.xlsx",
        paperType: "WORKING_PAPER",
        bucket: "PRIOR",
        reviewQuestions: [],
        signoffs: [],
      };
      const searchAttachment = {
        id: "attachment-search",
        projectId: "project-1",
        workingPaperId: "paper-search",
        fileKind: "SPREADSHEET",
        fileName: "searchtarget.xlsx",
        originalName: "searchtarget.xlsx",
        fileUrl: "uploads/searchtarget.xlsx",
        fileSize: 128,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        version: 1,
        createdAt: "2026-06-01T08:00:00.000Z",
        lastModifiedAt: "2026-06-01T08:00:00.000Z",
        lockedBy: null,
        lockExpiresAt: null,
        lockSessionId: null,
        workingPaper: searchPaper,
      };
      const siblingAttachment = {
        ...searchAttachment,
        id: "attachment-sibling",
        fileName: "sibling.pdf",
        originalName: "sibling.pdf",
        fileUrl: "uploads/sibling.pdf",
        mimeType: "application/pdf",
      };
      mockApi.workflow.mockResolvedValue([
        {
          id: "planning",
          code: "Planning",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          workingPapers: [],
          children: [
            {
              id: "search-folder",
              parentId: "planning",
              code: "A01",
              title: "Search folder",
              level: 2,
              nodeType: "FOLDER",
              workingPapers: [
                {
                  ...searchPaper,
                  attachments: [searchAttachment, siblingAttachment],
                },
              ],
              children: [],
            },
          ],
        },
      ]);
      mockApi.projectAttachments.mockResolvedValue([
        searchAttachment,
        siblingAttachment,
      ]);

      renderWorkspace({ route: "project-first" });

      await expect(
        screen.findByTestId("project-header-project-label")
      ).resolves.toBeInTheDocument();
      const planningNode = await findDirectoryNodeButton("planning");
      expect(planningNode).toBeInTheDocument();

      const searchInput = screen.getByRole("combobox", {
        name: "查找组或底稿",
      });
      fireEvent.focus(searchInput);
      fireEvent.change(searchInput, {
        target: { value: "searchtarget" },
      });
      expect(searchInput).toHaveValue("searchtarget");
      const searchMenu = await screen.findByRole("listbox");
      const searchResult =
        await within(searchMenu).findByText("searchtarget.xlsx");
      fireEvent.click(requireElement(searchResult.closest("[role='option']")));

      expect(vi.mocked(mockApi.workingPaper)).toHaveBeenCalledTimes(0);
      expect(planningNode).toHaveAttribute("data-active", "false");
      const highlightedFileRow = await findProjectFileRow("searchtarget.xlsx");
      expect(highlightedFileRow).toBeTruthy();
      expect(highlightedFileRow.className).toContain("ring-primary");
      const siblingFileRow = await findProjectFileRow("sibling.pdf");
      expect(siblingFileRow).toBeTruthy();
      expect(siblingFileRow.className).not.toContain("ring-primary");
      expect(vi.mocked(mockApi.workingPaper)).toHaveBeenCalledTimes(0);
      expect(screen.queryByRole("tab", { name: "前期底稿 1" })).toBeNull();
      expect(screen.queryByRole("tablist", { name: "文件分类" })).toBeNull();
    });

    it("cuts project files by pasting into a target folder menu", async () => {
      setupApi();
      const sourcePaper = {
        id: "paper-source",
        projectId: "project-1",
        workflowNodeId: "source-node",
        code: "A01-0001-F001",
        title: "selected-current.pdf",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
        reviewQuestions: [],
        signoffs: [],
      };
      const projectAttachment = {
        id: "attachment-selected-current",
        projectId: "project-1",
        workingPaperId: "paper-source",
        fileKind: "SUPPORTING",
        fileName: "selected-current.pdf",
        originalName: "selected-current.pdf",
        fileUrl: "uploads/selected-current.pdf",
        fileSize: 128,
        mimeType: "application/pdf",
        version: 1,
        createdAt: "2026-06-01T08:00:00.000Z",
        lastModifiedAt: "2026-06-01T08:00:00.000Z",
        lockedBy: null,
        lockExpiresAt: null,
        lockSessionId: null,
        workingPaper: sourcePaper,
      };
      mockApi.workflow.mockResolvedValue([
        {
          id: "planning",
          code: "Planning",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          workingPapers: [],
          children: [
            {
              id: "a1",
              parentId: "planning",
              code: "A01",
              title: "Cash",
              level: 2,
              nodeType: "ACCOUNT",
              workingPapers: [],
              children: [
                {
                  id: "source-node",
                  parentId: "a1",
                  code: "A01-0001",
                  title: "Source",
                  level: 3,
                  nodeType: "FOLDER",
                  workingPapers: [
                    {
                      ...sourcePaper,
                      attachments: [projectAttachment],
                    },
                  ],
                  children: [],
                },
                {
                  id: "target-node",
                  parentId: "a1",
                  code: "B01-0001",
                  title: "Target",
                  level: 3,
                  nodeType: "FOLDER",
                  workingPapers: [],
                  children: [],
                },
              ],
            },
          ],
        },
      ]);
      const currentAttachments: Record<string, unknown>[] = [projectAttachment];
      function readCurrentAttachments() {
        return Promise.resolve([...currentAttachments]);
      }
      mockApi.projectAttachments.mockImplementation(readCurrentAttachments);
      mockApi.createWorkingPaper.mockResolvedValue({
        ...sourcePaper,
        id: "paper-created-in-target",
        workflowNodeId: "target-node",
        code: "B01-0001-F001",
        title: "selected - current.pdf",
      });
      mockApi.moveAttachment.mockImplementation(() => {
        const movedPaper = {
          ...sourcePaper,
          id: "paper-created-in-target",
          workflowNodeId: "target-node",
          code: "B01-0001-F001",
        };
        const movedAttachment = {
          ...projectAttachment,
          workingPaperId: undefined,
          workingPaper: movedPaper,
        };
        currentAttachments.splice(
          0,
          currentAttachments.length,
          movedAttachment
        );
        return movedAttachment;
      });

      renderWorkspace({ route: "project-first" });

      await expect(
        screen.findByTestId("project-header-project-label")
      ).resolves.toBeInTheDocument();
      const fileName = await screen.findByText(/selected\s+-\s+current\.pdf/);
      const fileRow = requireElement(fileName.closest("tr"));
      expect(fileRow).toBeTruthy();
      fireEvent.contextMenu(fileRow as HTMLTableRowElement, {
        clientX: 96,
        clientY: 96,
      });
      const menu = screen.getByRole("menu", {
        name: /Actions for selected\s+-\s+current\.pdf/,
      });
      expect(
        within(menu).queryByRole("menuitem", { name: "Copy/Move To" })
      ).toBeNull();
      expect(within(menu).getByRole("menuitem", { name: "Copy" })).toBeTruthy();
      fireEvent.click(within(menu).getByRole("menuitem", { name: "Cut" }));

      const targetFolder = await findDirectoryNodeButton("target-node");
      fireEvent.contextMenu(targetFolder);
      fireEvent.click(await screen.findByRole("menuitem", { name: "Paste" }));

      await waitFor(() => {
        expect(mockApi.moveAttachment).toHaveBeenCalledWith(
          "project-1",
          "attachment-selected-current",
          {
            workflowNodeId: "target-node",
            bucket: "CURRENT",
          }
        );
      });
      await waitFor(() => {
        const rows = screen
          .getAllByText(/selected\s+-\s+current\.pdf/)
          .map((element) => element.closest("tr"))
          .filter((element): element is HTMLTableRowElement =>
            Boolean(element)
          );
        expect(
          rows.some((row) => row.className.includes("ring-primary"))
        ).toBeTruthy();
      });
    }, 10_000);

    it("clears copied project file clipboard after pasting from a target folder menu", async () => {
      setupApi();
      const sourcePaper = {
        id: "paper-source-copy",
        projectId: "project-1",
        workflowNodeId: "source-node",
        code: "A01-0001-F001",
        title: "selected-current.pdf",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
        reviewQuestions: [],
        signoffs: [],
      };
      const projectAttachment = {
        id: "attachment-selected-current",
        projectId: "project-1",
        workingPaperId: "paper-source-copy",
        fileKind: "SUPPORTING",
        fileName: "selected-current.pdf",
        originalName: "selected-current.pdf",
        fileUrl: "uploads/selected-current.pdf",
        fileSize: 128,
        mimeType: "application/pdf",
        version: 1,
        createdAt: "2026-06-01T08:00:00.000Z",
        lastModifiedAt: "2026-06-01T08:00:00.000Z",
        lockedBy: null,
        lockExpiresAt: null,
        lockSessionId: null,
        workingPaper: sourcePaper,
      };
      mockApi.workflow.mockResolvedValue([
        {
          id: "planning",
          code: "Planning",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          workingPapers: [],
          children: [
            {
              id: "a1",
              parentId: "planning",
              code: "A01",
              title: "Cash",
              level: 2,
              nodeType: "ACCOUNT",
              workingPapers: [],
              children: [
                {
                  id: "source-node",
                  parentId: "a1",
                  code: "A01-0001",
                  title: "Source",
                  level: 3,
                  nodeType: "FOLDER",
                  workingPapers: [
                    {
                      ...sourcePaper,
                      attachments: [projectAttachment],
                    },
                  ],
                  children: [],
                },
                {
                  id: "target-node",
                  parentId: "a1",
                  code: "B01-0001",
                  title: "Target",
                  level: 3,
                  nodeType: "FOLDER",
                  workingPapers: [],
                  children: [],
                },
              ],
            },
          ],
        },
      ]);
      const currentAttachments = [projectAttachment];
      function readCurrentAttachments() {
        return Promise.resolve([...currentAttachments]);
      }
      mockApi.projectAttachments.mockImplementation(readCurrentAttachments);
      mockApi.createWorkingPaper.mockResolvedValue({
        ...sourcePaper,
        id: "paper-created-in-target",
        workflowNodeId: "target-node",
        code: "B01-0001-F001",
        title: "selected - current.pdf",
      });
      mockApi.copyAttachment.mockResolvedValue({
        ...projectAttachment,
        id: "attachment-copied-current",
        workingPaperId: "paper-created-in-target",
      });

      renderWorkspace({ route: "project-first" });

      await expect(
        screen.findByTestId("project-header-project-label")
      ).resolves.toBeInTheDocument();
      const fileName = await screen.findByText(/selected\s+-\s+current\.pdf/);
      const fileRow = requireElement(fileName.closest("tr"));
      expect(fileRow).toBeTruthy();
      fireEvent.contextMenu(fileRow as HTMLTableRowElement, {
        clientX: 96,
        clientY: 96,
      });
      const fileMenu = screen.getByRole("menu", {
        name: /Actions for selected\s+-\s+current\.pdf/,
      });
      fireEvent.click(within(fileMenu).getByRole("menuitem", { name: "Copy" }));

      const targetFolder = await findDirectoryNodeButton("target-node");
      fireEvent.contextMenu(targetFolder);
      const pasteItem = await screen.findByRole("menuitem", { name: "Paste" });
      await waitFor(() => {
        expect(pasteItem).not.toHaveAttribute("aria-disabled", "true");
      });
      fireEvent.click(pasteItem);

      await waitFor(() => {
        expect(mockApi.copyAttachment).toHaveBeenCalledWith(
          "project-1",
          "attachment-selected-current",
          {
            workflowNodeId: "target-node",
            bucket: "CURRENT",
          }
        );
      });

      fireEvent.contextMenu(targetFolder);
      const disabledPasteItem = await screen.findByRole("menuitem", {
        name: "Paste",
      });
      expect(disabledPasteItem).toHaveAttribute("aria-disabled", "true");
    }, 10_000);

    it("pastes cut project files from the workspace file menu", async () => {
      setupApi();
      const sourcePaper = {
        id: "paper-source-menu",
        projectId: "project-1",
        workflowNodeId: "source-node",
        code: "A01-0001-F001",
        title: "selected-current.pdf",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
        reviewQuestions: [],
        signoffs: [],
      };
      const targetPaper = {
        id: "paper-target-menu",
        projectId: "project-1",
        workflowNodeId: "target-node",
        code: "B01-0001-F001",
        title: "target-existing.pdf",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
        reviewQuestions: [],
        signoffs: [],
      };
      const sourceAttachment = {
        id: "attachment-selected-current",
        projectId: "project-1",
        workingPaperId: "paper-source-menu",
        fileKind: "SUPPORTING",
        fileName: "selected-current.pdf",
        originalName: "selected-current.pdf",
        fileUrl: "uploads/selected-current.pdf",
        fileSize: 128,
        mimeType: "application/pdf",
        version: 1,
        createdAt: "2026-06-01T08:00:00.000Z",
        lastModifiedAt: "2026-06-01T08:00:00.000Z",
        lockedBy: null,
        lockExpiresAt: null,
        lockSessionId: null,
        workingPaper: sourcePaper,
      };
      const targetAttachment = {
        id: "attachment-target-existing",
        projectId: "project-1",
        workingPaperId: "paper-target-menu",
        fileKind: "SUPPORTING",
        fileName: "target-existing.pdf",
        originalName: "target-existing.pdf",
        fileUrl: "uploads/target-existing.pdf",
        fileSize: 128,
        mimeType: "application/pdf",
        version: 1,
        createdAt: "2026-06-01T08:00:00.000Z",
        lastModifiedAt: "2026-06-01T08:00:00.000Z",
        lockedBy: null,
        lockExpiresAt: null,
        lockSessionId: null,
        workingPaper: targetPaper,
      };
      mockApi.workflow.mockResolvedValue([
        {
          id: "planning",
          code: "Planning",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          workingPapers: [],
          children: [
            {
              id: "a1",
              parentId: "planning",
              code: "A01",
              title: "Cash",
              level: 2,
              nodeType: "ACCOUNT",
              workingPapers: [],
              children: [
                {
                  id: "source-node",
                  parentId: "a1",
                  code: "A01-0001",
                  title: "Source",
                  level: 3,
                  nodeType: "FOLDER",
                  workingPapers: [
                    {
                      ...sourcePaper,
                      attachments: [sourceAttachment],
                    },
                  ],
                  children: [],
                },
                {
                  id: "target-node",
                  parentId: "a1",
                  code: "B01-0001",
                  title: "Target",
                  level: 3,
                  nodeType: "FOLDER",
                  workingPapers: [
                    {
                      ...targetPaper,
                      attachments: [targetAttachment],
                    },
                  ],
                  children: [],
                },
              ],
            },
          ],
        },
      ]);
      const currentAttachments: Record<string, unknown>[] = [
        sourceAttachment,
        targetAttachment,
      ];
      function readCurrentAttachments() {
        return Promise.resolve([...currentAttachments]);
      }
      mockApi.projectAttachments.mockImplementation(readCurrentAttachments);
      mockApi.moveAttachment.mockImplementation(() => {
        const movedPaper = {
          ...sourcePaper,
          id: "paper-created-in-target",
          workflowNodeId: "target-node",
          code: "B01-0001-F002",
        };
        const movedAttachment = {
          ...sourceAttachment,
          workingPaperId: undefined,
          workingPaper: movedPaper,
        };
        currentAttachments.splice(
          0,
          currentAttachments.length,
          targetAttachment,
          movedAttachment
        );
        return movedAttachment;
      });

      renderWorkspace({ route: "project-first" });

      await expect(
        screen.findByTestId("project-header-project-label")
      ).resolves.toBeInTheDocument();
      const sourceName = await screen.findByText(/selected\s+-\s+current\.pdf/);
      const sourceRow = requireElement(sourceName.closest("tr"));
      expect(sourceRow).toBeTruthy();
      fireEvent.click(sourceRow as HTMLTableRowElement);
      expect(sourceRow).toHaveClass("bg-[var(--brand-tint)]");
      fireEvent.contextMenu(sourceRow as HTMLTableRowElement, {
        clientX: 96,
        clientY: 96,
      });
      fireEvent.click(await screen.findByRole("menuitem", { name: "Cut" }));

      fireEvent.click(await screen.findByRole("treeitem", { name: /Target/ }));
      const targetName = await screen.findByText(/target\s+-\s+existing\.pdf/);
      expect(targetName.closest("tr")).toBeTruthy();
      const targetFileArea = screen.getByRole("region", {
        name: "Project files",
      });
      const blankWorkspaceRow = targetFileArea.querySelector(
        "tr[aria-hidden='true']"
      );
      expect(blankWorkspaceRow).toBeTruthy();
      fireEvent.contextMenu(blankWorkspaceRow as HTMLTableRowElement, {
        clientX: 128,
        clientY: 128,
      });
      fireEvent.click(await screen.findByRole("menuitem", { name: "Paste" }));

      await waitFor(() => {
        expect(mockApi.moveAttachment).toHaveBeenCalledWith(
          "project-1",
          "attachment-selected-current",
          {
            workflowNodeId: "target-node",
            bucket: "CURRENT",
          }
        );
      });
      const movedRow = requireValue(
        await waitFor(() => {
          const row = screen
            .getAllByText(/selected\s+-\s+current\.pdf/)
            .map((element) => element.closest("tr"))
            .find((element): element is HTMLTableRowElement =>
              Boolean(element)
            );
          expect(row).toBeTruthy();
          return row;
        })
      );
      expect(movedRow.className).toContain("ring-primary");

      fireEvent.click(await screen.findByRole("treeitem", { name: /Source/ }));
      const sourceFileArea = screen.getByRole("region", {
        name: "Project files",
      });
      await waitFor(() => {
        expect(
          within(sourceFileArea).queryByText(/selected\s+-\s+current\.pdf/)
        ).toBeNull();
      });
    }, 30_000);

    it("clears the directory highlight after deleting the selected folder", async () => {
      setupApi();
      const workflowWithTarget = [
        {
          id: "planning",
          code: "Planning",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          workingPapers: [],
          children: [
            {
              id: "cash-node",
              parentId: "planning",
              code: "A1",
              title: "Cash",
              level: 2,
              nodeType: "ACCOUNT",
              workingPapers: [],
              children: [],
            },
          ],
        },
        {
          id: "reporting",
          code: "Reporting",
          title: "Reporting",
          level: 1,
          nodeType: "PHASE",
          workingPapers: [],
          children: [
            {
              id: "report-target",
              parentId: "reporting",
              code: "R1",
              title: "Report",
              level: 2,
              nodeType: "ACCOUNT",
              workingPapers: [],
              children: [],
            },
          ],
        },
      ];
      const workflowWithoutTarget = [
        workflowWithTarget[0],
        {
          ...workflowWithTarget[1],
          children: [],
        },
      ];
      const currentWorkflow = workflowWithTarget;
      function readCurrentWorkflow() {
        return Promise.resolve([...currentWorkflow]);
      }
      mockApi.workflow.mockImplementation(readCurrentWorkflow);
      mockApi.deleteWorkflowNode.mockImplementation(() => {
        currentWorkflow.splice(
          0,
          currentWorkflow.length,
          ...workflowWithoutTarget
        );
        return {};
      });

      renderWorkspace({ route: "project-first" });

      await expect(
        screen.findByTestId("project-header-project-label")
      ).resolves.toBeInTheDocument();
      await ensureDirectoryNodeExpanded("reporting");
      const targetNode = await findDirectoryNodeButton("report-target");
      fireEvent.click(targetNode);
      expect(targetNode).toHaveAttribute("data-active", "true");
      fireEvent.contextMenu(targetNode);
      fireEvent.click(await screen.findByRole("menuitem", { name: "删除组" }));
      fireEvent.click(await screen.findByRole("button", { name: "确认删除" }));

      await waitFor(() => {
        expect(mockApi.deleteWorkflowNode).toHaveBeenCalledWith(
          "project-1",
          "report-target"
        );
      });
      await waitFor(() => {
        expect(queryDirectoryNodeButton("report-target")).toBeNull();
      });
      expect(
        screen.getByRole("treeitem", { name: /A1 - Cash/ })
      ).not.toHaveAttribute("data-active", "true");
    }, 10_000);

    it("keeps multi-pasted project files highlighted after blank workspace paste", async () => {
      setupApi();
      const makePaper = (
        id: string,
        workflowNodeId: string,
        code: string,
        title: string
      ) => ({
        id,
        projectId: "project-1",
        workflowNodeId,
        code,
        title,
        paperType: "WORKING_PAPER" as const,
        bucket: "CURRENT" as const,
        reviewQuestions: [],
        signoffs: [],
      });
      const makeAttachment = (
        id: string,
        paper: ReturnType<typeof makePaper>
      ) => ({
        id,
        projectId: "project-1",
        workingPaperId: paper.id,
        fileKind: "SUPPORTING" as const,
        fileName: paper.title,
        originalName: paper.title,
        fileUrl: `uploads/${paper.title}`,
        fileSize: 128,
        mimeType: "application/pdf",
        version: 1,
        createdAt: "2026-06-01T08:00:00.000Z",
        lastModifiedAt: "2026-06-01T08:00:00.000Z",
        lockedBy: null,
        lockExpiresAt: null,
        lockSessionId: null,
        workingPaper: paper,
      });
      const firstPaper = makePaper(
        "paper-first",
        "source-node",
        "A01-F001",
        "alpha.pdf"
      );
      const secondPaper = makePaper(
        "paper-second",
        "source-node",
        "A01-F002",
        "beta.pdf"
      );
      const thirdPaper = makePaper(
        "paper-third",
        "source-node",
        "A01-F003",
        "gamma.pdf"
      );
      const firstAttachment = makeAttachment("attachment-first", firstPaper);
      const secondAttachment = makeAttachment("attachment-second", secondPaper);
      const thirdAttachment = makeAttachment("attachment-third", thirdPaper);
      let currentAttachments = [
        firstAttachment,
        secondAttachment,
        thirdAttachment,
      ];

      mockApi.workflow.mockResolvedValue([
        {
          id: "planning",
          code: "Planning",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          workingPapers: [],
          children: [
            {
              id: "a1",
              parentId: "planning",
              code: "A01",
              title: "Cash",
              level: 2,
              nodeType: "ACCOUNT",
              workingPapers: [],
              children: [
                {
                  id: "source-node",
                  parentId: "a1",
                  code: "A01-0001",
                  title: "Source",
                  level: 3,
                  nodeType: "FOLDER",
                  workingPapers: [
                    { ...firstPaper, attachments: [firstAttachment] },
                    { ...secondPaper, attachments: [secondAttachment] },
                    { ...thirdPaper, attachments: [thirdAttachment] },
                  ],
                  children: [],
                },
                {
                  id: "target-node",
                  parentId: "a1",
                  code: "B01-0001",
                  title: "Target",
                  level: 3,
                  nodeType: "FOLDER",
                  workingPapers: [],
                  children: [],
                },
              ],
            },
          ],
        },
      ]);
      function readCurrentAttachments() {
        return Promise.resolve([...currentAttachments]);
      }
      mockApi.projectAttachments.mockImplementation(readCurrentAttachments);
      mockApi.moveAttachment.mockImplementation(
        (
          _projectId: string,
          attachmentId: string,
          input: { workflowNodeId: string; bucket: "CURRENT" }
        ) => {
          const source = requireValue(
            currentAttachments.find(
              (attachment) => attachment.id === attachmentId
            )
          );
          const nextPaper =
            attachmentId === "attachment-first"
              ? makePaper(
                  "paper-target-first",
                  input.workflowNodeId,
                  "B01-F001",
                  "alpha.pdf"
                )
              : attachmentId === "attachment-second"
                ? makePaper(
                    "paper-target-second",
                    input.workflowNodeId,
                    "B01-F002",
                    "beta.pdf"
                  )
                : makePaper(
                    "paper-target-third",
                    input.workflowNodeId,
                    "B01-F003",
                    "gamma.pdf"
                  );
          const movedAttachment = {
            ...source,
            workingPaperId: nextPaper.id,
            workingPaper: nextPaper,
          };
          const movedResponse = {
            ...movedAttachment,
            workingPaperId: source.workingPaperId,
            workingPaper: undefined,
          };
          currentAttachments = [
            ...currentAttachments.filter(
              (attachment) => attachment.id !== attachmentId
            ),
            movedAttachment,
          ];
          return movedResponse;
        }
      );

      renderWorkspace({ route: "project-first" });

      await expect(
        screen.findByTestId("project-header-project-label")
      ).resolves.toBeInTheDocument();
      const firstFile = await screen.findByText("alpha.pdf");
      const firstRow = firstFile.closest("tr");
      expect(firstRow).toBeTruthy();
      fireEvent.contextMenu(firstRow as HTMLTableRowElement);
      fireEvent.click(
        await screen.findByRole("menuitem", { name: "Multi-select" })
      );
      fireEvent.click(await screen.findByLabelText("Select beta.pdf"));
      fireEvent.click(await screen.findByLabelText("Select gamma.pdf"));

      fireEvent.contextMenu(firstRow as HTMLTableRowElement);
      fireEvent.click(await screen.findByRole("menuitem", { name: "Cut" }));

      fireEvent.click(await screen.findByRole("treeitem", { name: /Target/ }));
      const emptyState = await screen.findByTestId("project-file-empty-tray");
      expect(emptyState).toHaveTextContent("当前底稿");
      expect(screen.queryByTestId("project-file-empty-watermark")).toBeNull();
      expect(
        within(emptyState)
          .getByTestId("project-file-empty-hero-icon")
          .querySelector('[data-slot="project-wing-dev-logo"]')
      ).toHaveClass("h-36", "w-36", "opacity-[0.18]", "dark:opacity-[0.24]");
      const blankWorkspaceRow = emptyState.closest("tr");
      expect(blankWorkspaceRow).toBeTruthy();
      fireEvent.contextMenu(blankWorkspaceRow as HTMLTableRowElement);
      fireEvent.click(await screen.findByRole("menuitem", { name: "Paste" }));

      await waitFor(() =>
        expect(mockApi.moveAttachment).toHaveBeenCalledTimes(3)
      );
      const pastedFirstRow = await findProjectFileRow("alpha.pdf");
      const pastedSecondRow = await findProjectFileRow("beta.pdf");
      const pastedThirdRow = await findProjectFileRow("gamma.pdf");
      expect(pastedFirstRow.className).toContain("ring-primary");
      expect(pastedSecondRow.className).toContain("ring-primary");
      expect(pastedThirdRow.className).toContain("ring-primary");
      expect(screen.getByLabelText("Select alpha.pdf")).toBeChecked();
      expect(screen.getByLabelText("Select beta.pdf")).toBeChecked();
      expect(screen.getByLabelText("Select gamma.pdf")).toBeChecked();

      fireEvent.click(
        screen.getByRole("button", { name: "Exit multi-select" })
      );

      await waitFor(() => {
        expect(screen.queryByLabelText("Select alpha.pdf")).toBeNull();
        expect(screen.queryByLabelText("Select beta.pdf")).toBeNull();
        expect(screen.queryByLabelText("Select gamma.pdf")).toBeNull();
      });
    }, 60_000);

    it("pastes selected project files one at a time from a target folder menu", async () => {
      setupApi();
      const makePaper = (
        id: string,
        workflowNodeId: string,
        code: string,
        title: string
      ) => ({
        id,
        projectId: "project-1",
        workflowNodeId,
        code,
        title,
        paperType: "WORKING_PAPER" as const,
        bucket: "CURRENT" as const,
        reviewQuestions: [],
        signoffs: [],
      });
      const makeAttachment = (
        id: string,
        paper: ReturnType<typeof makePaper>
      ) => ({
        id,
        projectId: "project-1",
        workingPaperId: paper.id,
        fileKind: "SUPPORTING" as const,
        fileName: paper.title,
        originalName: paper.title,
        fileUrl: `uploads/${paper.title}`,
        fileSize: 128,
        mimeType: "application/pdf",
        version: 1,
        createdAt: "2026-06-01T08:00:00.000Z",
        lastModifiedAt: "2026-06-01T08:00:00.000Z",
        lockedBy: null,
        lockExpiresAt: null,
        lockSessionId: null,
        workingPaper: paper,
      });
      const firstPaper = makePaper(
        "paper-first",
        "source-node",
        "A01-F001",
        "alpha.pdf"
      );
      const secondPaper = makePaper(
        "paper-second",
        "source-node",
        "A01-F002",
        "beta.pdf"
      );
      const firstAttachment = makeAttachment("attachment-first", firstPaper);
      const secondAttachment = makeAttachment("attachment-second", secondPaper);
      let currentAttachments = [firstAttachment, secondAttachment];
      let resolveFirstMove: (() => void) | null = null;

      mockApi.workflow.mockResolvedValue([
        {
          id: "planning",
          code: "Planning",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          workingPapers: [],
          children: [
            {
              id: "a1",
              parentId: "planning",
              code: "A01",
              title: "Cash",
              level: 2,
              nodeType: "ACCOUNT",
              workingPapers: [],
              children: [
                {
                  id: "source-node",
                  parentId: "a1",
                  code: "A01-0001",
                  title: "Source",
                  level: 3,
                  nodeType: "FOLDER",
                  workingPapers: [
                    { ...firstPaper, attachments: [firstAttachment] },
                    { ...secondPaper, attachments: [secondAttachment] },
                  ],
                  children: [],
                },
                {
                  id: "target-node",
                  parentId: "a1",
                  code: "B01-0001",
                  title: "Target",
                  level: 3,
                  nodeType: "FOLDER",
                  workingPapers: [],
                  children: [],
                },
              ],
            },
          ],
        },
      ]);
      mockApi.projectAttachments.mockResolvedValue(currentAttachments);
      mockApi.moveAttachment.mockImplementation(
        (
          _projectId: string,
          attachmentId: string,
          input: { workflowNodeId: string; bucket: "CURRENT" }
        ) => {
          const completeMove = () => {
            const source = requireValue(
              currentAttachments.find(
                (attachment) => attachment.id === attachmentId
              )
            );
            const nextPaper =
              attachmentId === "attachment-first"
                ? makePaper(
                    "paper-target-first",
                    input.workflowNodeId,
                    "B01-F001",
                    "alpha.pdf"
                  )
                : makePaper(
                    "paper-target-second",
                    input.workflowNodeId,
                    "B01-F002",
                    "beta.pdf"
                  );
            const movedAttachment = {
              ...source,
              workingPaperId: nextPaper.id,
              workingPaper: nextPaper,
            };
            currentAttachments = [
              ...currentAttachments.filter(
                (attachment) => attachment.id !== attachmentId
              ),
              movedAttachment,
            ];
            return movedAttachment;
          };
          if (attachmentId === "attachment-first") {
            return new Promise((resolve) => {
              resolveFirstMove = () => resolve(completeMove());
            });
          }
          return Promise.resolve(completeMove());
        }
      );

      renderWorkspace({ route: "project-first" });

      await expect(
        screen.findByTestId("project-header-project-label")
      ).resolves.toBeInTheDocument();
      const firstFile = await screen.findByText("alpha.pdf");
      const firstRow = firstFile.closest("tr");
      expect(firstRow).toBeTruthy();
      fireEvent.contextMenu(firstRow as HTMLTableRowElement);
      fireEvent.click(
        await screen.findByRole("menuitem", { name: "Multi-select" })
      );
      fireEvent.click(await screen.findByLabelText("Select beta.pdf"));
      fireEvent.contextMenu(firstRow as HTMLTableRowElement);
      fireEvent.click(await screen.findByRole("menuitem", { name: "Cut" }));

      const targetFolder = await findDirectoryNodeButton("target-node");
      fireEvent.contextMenu(targetFolder);
      fireEvent.click(await screen.findByRole("menuitem", { name: "Paste" }));

      await waitFor(() =>
        expect(mockApi.moveAttachment).toHaveBeenCalledOnce()
      );
      expect(mockApi.moveAttachment.mock.calls[0]?.[1]).toBe(
        "attachment-first"
      );

      await act(() => {
        resolveFirstMove?.();
      });

      await waitFor(() =>
        expect(mockApi.moveAttachment).toHaveBeenCalledTimes(2)
      );
      expect(mockApi.moveAttachment.mock.calls[1]?.[1]).toBe(
        "attachment-second"
      );
    }, 60_000);

    it("keeps multi-pasted project files highlighted from a target folder menu", async () => {
      setupApi();
      const makePaper = (
        id: string,
        workflowNodeId: string,
        code: string,
        title: string
      ) => ({
        id,
        projectId: "project-1",
        workflowNodeId,
        code,
        title,
        paperType: "WORKING_PAPER" as const,
        bucket: "CURRENT" as const,
        reviewQuestions: [],
        signoffs: [],
      });
      const makeAttachment = (
        id: string,
        paper: ReturnType<typeof makePaper>
      ) => ({
        id,
        projectId: "project-1",
        workingPaperId: paper.id,
        fileKind: "SUPPORTING" as const,
        fileName: paper.title,
        originalName: paper.title,
        fileUrl: `uploads/${paper.title}`,
        fileSize: 128,
        mimeType: "application/pdf",
        version: 1,
        createdAt: "2026-06-01T08:00:00.000Z",
        lastModifiedAt: "2026-06-01T08:00:00.000Z",
        lockedBy: null,
        lockExpiresAt: null,
        lockSessionId: null,
        workingPaper: paper,
      });
      const firstPaper = makePaper(
        "paper-menu-first",
        "source-node",
        "A01-F001",
        "alpha.pdf"
      );
      const secondPaper = makePaper(
        "paper-menu-second",
        "source-node",
        "A01-F002",
        "beta.pdf"
      );
      const thirdPaper = makePaper(
        "paper-menu-third",
        "source-node",
        "A01-F003",
        "gamma.pdf"
      );
      const firstAttachment = makeAttachment(
        "attachment-menu-first",
        firstPaper
      );
      const secondAttachment = makeAttachment(
        "attachment-menu-second",
        secondPaper
      );
      const thirdAttachment = makeAttachment(
        "attachment-menu-third",
        thirdPaper
      );
      let currentAttachments = [
        firstAttachment,
        secondAttachment,
        thirdAttachment,
      ];

      mockApi.workflow.mockResolvedValue([
        {
          id: "planning",
          code: "Planning",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          workingPapers: [],
          children: [
            {
              id: "a1",
              parentId: "planning",
              code: "A01",
              title: "Cash",
              level: 2,
              nodeType: "ACCOUNT",
              workingPapers: [],
              children: [
                {
                  id: "source-node",
                  parentId: "a1",
                  code: "A01-0001",
                  title: "Source",
                  level: 3,
                  nodeType: "FOLDER",
                  workingPapers: [
                    { ...firstPaper, attachments: [firstAttachment] },
                    { ...secondPaper, attachments: [secondAttachment] },
                    { ...thirdPaper, attachments: [thirdAttachment] },
                  ],
                  children: [],
                },
                {
                  id: "target-node",
                  parentId: "a1",
                  code: "B01-0001",
                  title: "Target",
                  level: 3,
                  nodeType: "FOLDER",
                  workingPapers: [],
                  children: [],
                },
              ],
            },
          ],
        },
      ]);
      function readCurrentAttachments() {
        return Promise.resolve([...currentAttachments]);
      }
      mockApi.projectAttachments.mockImplementation(readCurrentAttachments);
      mockApi.moveAttachment.mockImplementation(
        (
          _projectId: string,
          attachmentId: string,
          input: { workflowNodeId: string; bucket: "CURRENT" }
        ) => {
          const source = requireValue(
            currentAttachments.find(
              (attachment) => attachment.id === attachmentId
            )
          );
          const nextPaper =
            attachmentId === "attachment-menu-first"
              ? makePaper(
                  "paper-menu-target-first",
                  input.workflowNodeId,
                  "B01-F001",
                  "alpha.pdf"
                )
              : attachmentId === "attachment-menu-second"
                ? makePaper(
                    "paper-menu-target-second",
                    input.workflowNodeId,
                    "B01-F002",
                    "beta.pdf"
                  )
                : makePaper(
                    "paper-menu-target-third",
                    input.workflowNodeId,
                    "B01-F003",
                    "gamma.pdf"
                  );
          const movedAttachment = {
            ...source,
            workingPaperId: nextPaper.id,
            workingPaper: nextPaper,
          };
          currentAttachments = [
            ...currentAttachments.filter(
              (attachment) => attachment.id !== attachmentId
            ),
            movedAttachment,
          ];
          return movedAttachment;
        }
      );

      renderWorkspace({ route: "project-first" });

      await expect(
        screen.findByTestId("project-header-project-label")
      ).resolves.toBeInTheDocument();
      const firstFile = await screen.findByText("alpha.pdf");
      const firstRow = firstFile.closest("tr");
      expect(firstRow).toBeTruthy();
      fireEvent.contextMenu(firstRow as HTMLTableRowElement);
      fireEvent.click(
        await screen.findByRole("menuitem", { name: "Multi-select" })
      );
      fireEvent.click(await screen.findByLabelText("Select beta.pdf"));
      fireEvent.click(await screen.findByLabelText("Select gamma.pdf"));

      fireEvent.contextMenu(firstRow as HTMLTableRowElement);
      fireEvent.click(await screen.findByRole("menuitem", { name: "Cut" }));

      const targetFolder = await findDirectoryNodeButton("target-node");
      fireEvent.contextMenu(targetFolder);
      fireEvent.click(await screen.findByRole("menuitem", { name: "Paste" }));

      await waitFor(() =>
        expect(mockApi.moveAttachment).toHaveBeenCalledTimes(3)
      );
      const pastedFirstRow = await findProjectFileRow("alpha.pdf");
      const pastedSecondRow = await findProjectFileRow("beta.pdf");
      const pastedThirdRow = await findProjectFileRow("gamma.pdf");
      expect(pastedFirstRow.className).toContain("ring-primary");
      expect(pastedSecondRow.className).toContain("ring-primary");
      expect(pastedThirdRow.className).toContain("ring-primary");
    }, 30_000);

    it("renders declaration checks as a workbench panel instead of the old Card", async () => {
      setupApi();
      mockApi.projectDeclarationStatus.mockReturnValue(new Promise(() => {}));
      renderWorkspace();

      const message = await screen.findByText("正在检查本项目独立性声明...");

      expect(message.closest("section")).toBeNull();
    });

    it("opens Desktop Agent settings directly from a Master setup request", async () => {
      setupApi();
      renderWorkspace();
      await screen.findByRole("tab", { name: "Company Name" });
      act(() =>
        window.dispatchEvent(
          new Event("project-wing:open-desktop-agent-settings")
        )
      );
      const settings = await screen.findByRole("complementary", {
        name: "设置导航",
      });
      expect(
        within(settings).getByRole("button", { name: "Desktop Agent" })
      ).toHaveAttribute("aria-current", "page");
      await expect(
        screen.findByRole("region", {
          name: "Desktop Agent",
        })
      ).resolves.toBeTruthy();
    });

    it("opens member settings from the nested settings panel", async () => {
      setupApi();
      renderWorkspace();

      await expect(
        screen.findByRole("tab", { name: "Company Name" })
      ).resolves.toHaveAttribute("aria-selected", "true");

      fireEvent.click(screen.getByRole("button", { name: "设置" }));
      fireEvent.click(
        within(
          await screen.findByRole("complementary", { name: "设置导航" })
        ).getByRole("button", {
          name: "成员",
        })
      );

      await expect(
        screen.findByRole("table", { name: "成员管理" })
      ).resolves.toBeInTheDocument();
      expect(
        screen.queryByText("管理项目成员职责，并向系统人员发送项目邀请。")
      ).not.toBeInTheDocument();
    });

    it("keeps account details out of the project settings sidebar", async () => {
      setupApi();
      renderWorkspace();

      await expect(
        screen.findByRole("tab", { name: "Company Name" })
      ).resolves.toHaveAttribute("aria-selected", "true");

      const settingsButton = screen.getByRole("button", { name: "设置" });
      expect(settingsButton).toBeTruthy();
      fireEvent.click(settingsButton);

      expect(screen.queryByTestId("settings-sidebar-account")).toBeNull();
      await expect(
        screen.findByTestId("settings-content-panel")
      ).resolves.not.toHaveTextContent("partner@projectwing.local");
    });

    it("keeps independence declaration details inside member management", async () => {
      setupApi();
      renderWorkspace();

      await expect(
        screen.findByRole("tab", { name: "Company Name" })
      ).resolves.toHaveAttribute("aria-selected", "true");

      fireEvent.click(screen.getByRole("button", { name: "设置" }));

      expect(
        screen.queryByRole("button", { name: "独立性签署报告" })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("INDIVIDUAL INDEPENDENCE DECLARATION")
      ).not.toBeInTheDocument();

      fireEvent.click(
        within(
          await screen.findByRole("complementary", { name: "设置导航" })
        ).getByRole("button", {
          name: "成员",
        })
      );

      await expect(
        screen.findByRole("table", { name: "成员管理" })
      ).resolves.toBeInTheDocument();
    }, 10_000);

    it("shows the project recycle bin between members and personalization in settings", async () => {
      setupApi();
      mockApi.workflow.mockResolvedValue([
        {
          id: "planning",
          code: "Planning",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          workingPapers: [],
          children: [
            {
              id: "a1",
              parentId: "planning",
              code: "A01",
              title: "Bank",
              level: 2,
              nodeType: "ACCOUNT",
              workingPapers: [],
              children: [
                {
                  id: "a1-1000",
                  parentId: "a1",
                  code: "A01-0001",
                  title: "Bank credentials",
                  level: 3,
                  nodeType: "FOLDER",
                  workingPapers: [
                    {
                      id: "paper-1",
                      workflowNodeId: "a1-1000",
                      code: "A01-0001-F001",
                      title: "Original paper",
                      paperType: "WORKING_PAPER",
                      bucket: "CURRENT",
                      attachments: [],
                    },
                    {
                      id: "paper-2",
                      workflowNodeId: "a1-1000",
                      code: "A01-0001-F002",
                      title: "Existing workpaper",
                      paperType: "WORKING_PAPER",
                      bucket: "CURRENT",
                      attachments: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ]);
      mockApi.deletedAttachments.mockResolvedValue([
        {
          id: "deleted-attachment-1",
          workingPaperId: null,
          fileKind: "SUPPORTING",
          fileName: "stored/deleted-ledger.pdf",
          originalName: "deleted-ledger.pdf",
          fileUrl: "working-papers/project-1/deleted-ledger.pdf",
          fileSize: 1024,
          mimeType: "application/pdf",
          version: 1,
          deletedAt: "2026-06-01T10:00:00.000Z",
          deletedBy: "user-partner",
          deletedByUser: {
            id: "user-partner",
            name: "Jony Ma",
            email: "partner@projectwing.local",
          },
          deletedFromWorkingPaperId: "paper-1",
          deletedFromWorkingPaperCode: "A01-0001",
          deletedFromWorkingPaperTitle: "Bank support",
        },
      ]);
      renderWorkspace();

      await expect(
        screen.findByRole("tab", { name: "Company Name" })
      ).resolves.toHaveAttribute("aria-selected", "true");

      fireEvent.click(screen.getByRole("button", { name: "设置" }));
      const navigation = await screen.findByRole("complementary", {
        name: "设置导航",
      });
      expect(
        within(navigation)
          .getAllByRole("button")
          .map((button) => button.textContent)
      ).toStrictEqual([
        "常规",
        "归档",
        "成员",
        "CMP 项目",
        "TMS 关联",
        "回收站",
        "个性化",
        "Desktop Agent",
        "连接与集成",
      ]);
      fireEvent.click(
        within(navigation).getByRole("button", { name: "回收站" })
      );

      await waitFor(() => {
        expect(mockApi.deletedAttachments).toHaveBeenCalledWith("project-1");
      });
      fireEvent.click(screen.getByRole("button", { name: "Manage" }));
      const dialog = await screen.findByRole("dialog", { name: "Recycle bin" });
      const row = within(dialog).getByTestId(
        "recycle-bin-dialog-row-deleted-attachment-1"
      );
      expect(
        within(row).getByText(/deleted\s+-\s+ledger\.pdf/)
      ).toBeInTheDocument();
      expect(
        within(row).queryByRole("button", { name: "Original" })
      ).not.toBeInTheDocument();
      fireEvent.click(within(row).getByRole("button", { name: /Restore/ }));
      await waitFor(() => {
        expect(mockApi.restoreAttachment).toHaveBeenCalledWith(
          "project-1",
          "deleted-attachment-1",
          {}
        );
      });
      expect(dialog).toBeInTheDocument();
    }, 10_000);

    it("requires a folder when the original recycle-bin location is gone", async () => {
      setupApi();
      mockApi.deletedAttachments.mockResolvedValue([
        {
          id: "deleted-attachment-1",
          workingPaperId: null,
          fileKind: "SUPPORTING",
          fileName: "stored/deleted-ledger.pdf",
          originalName: "deleted-ledger.pdf",
          fileUrl: "working-papers/project-1/deleted-ledger.pdf",
          fileSize: 1024,
          mimeType: "application/pdf",
          version: 1,
          deletedAt: "2026-06-01T10:00:00.000Z",
          deletedBy: "user-partner",
          deletedByUser: {
            id: "user-partner",
            name: "Jony Ma",
            email: "partner@projectwing.local",
          },
          deletedFromWorkingPaperId: "missing-paper",
          deletedFromWorkingPaperCode: "A01-0001-F001",
          deletedFromWorkingPaperTitle: "Missing original paper",
        },
      ]);
      renderWorkspace();

      await expect(
        screen.findByRole("tab", { name: "Company Name" })
      ).resolves.toHaveAttribute("aria-selected", "true");

      fireEvent.click(screen.getByRole("button", { name: "设置" }));
      fireEvent.click(
        within(
          await screen.findByRole("complementary", { name: "设置导航" })
        ).getByRole("button", {
          name: "回收站",
        })
      );
      fireEvent.click(screen.getByRole("button", { name: "Manage" }));

      const dialog = await screen.findByRole("dialog", { name: "Recycle bin" });
      const row = within(dialog).getByTestId(
        "recycle-bin-dialog-row-deleted-attachment-1"
      );
      expect(
        within(row)
          .queryAllByRole("button")
          .map((button) => button.textContent)
      ).not.toContain("Original");
      const restoreButton = within(row).getByRole("button", {
        name: /Restore/,
      });
      expect(restoreButton).toBeDisabled();

      fireEvent.click(
        within(row).getByRole("combobox", {
          name: /Restore target for deleted\s+-\s+ledger\.pdf/,
        })
      );
      await expect(
        screen.findByRole("option", { name: "Planning · Planning" })
      ).resolves.toBeInTheDocument();
    }, 10_000);

    it("selects the newly created directory node", async () => {
      setupApi();
      const createdNode = {
        id: "a1-2000",
        parentId: "planning",
        code: "A02",
        title: "A02",
        level: 2,
        nodeType: "ACCOUNT",
        workingPapers: [],
        children: [],
      };
      let workflowState: WorkflowNode[] = [
        {
          id: "planning",
          code: "Planning",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          workingPapers: [],
          children: [
            {
              id: "a1",
              parentId: "planning",
              code: "A01",
              title: "银行存款",
              level: 2,
              nodeType: "ACCOUNT",
              workingPapers: [],
              children: [
                {
                  id: "a1-1000",
                  parentId: "a1",
                  code: "A01-0001",
                  title: "银行凭据",
                  level: 3,
                  nodeType: "FOLDER",
                  workingPapers: [],
                  children: [],
                },
              ],
            },
          ],
        },
      ];
      mockApi.workflow.mockImplementation(() => workflowState);
      mockApi.createWorkflowNode.mockImplementation(() => {
        const [planningNode] = workflowState;
        workflowState = [
          {
            ...planningNode,
            children: [...(planningNode.children ?? []), createdNode],
          },
        ];
        return createdNode;
      });
      renderWorkspace();

      const planningButton = await findDirectoryNodeButton("planning");
      fireEvent.contextMenu(planningButton);
      fireEvent.click(await screen.findByRole("menuitem", { name: "新增组" }));

      const input = await screen.findByRole("textbox", { name: "新组" });
      fireEvent.change(input, { target: { value: "A02" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(mockApi.createWorkflowNode).toHaveBeenCalledWith("project-1", {
          parentId: "planning",
          code: "A02",
          title: "A02",
        });
      });
      const createdNodeButton = await findDirectoryNodeButton("a1-2000");
      expect(createdNodeButton).toHaveAttribute("data-active", "true");
      expect(screen.queryByRole("tablist", { name: "文件分类" })).toBeNull();
      expect(screen.queryByRole("heading", { name: "A02" })).toBeNull();
    });

    it("copies a directory file to a target node from the context menu", async () => {
      const onCopyFileToNode = vi.fn();
      const workflow = [
        {
          id: "planning",
          parentId: null,
          code: "Planning",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          workingPapers: [],
          children: [
            {
              id: "source-node",
              parentId: "planning",
              code: "A01-0001",
              title: "Source",
              level: 2,
              nodeType: "FOLDER",
              workingPapers: [
                {
                  id: "paper-source",
                  projectId: "project-1",
                  workflowNodeId: "source-node",
                  code: "A01-0001-F001",
                  title: "source.xlsx",
                  paperType: "WORKING_PAPER" as const,
                  bucket: "CURRENT" as const,
                  attachments: [
                    {
                      id: "attachment-source",
                      workingPaperId: "paper-source",
                      fileKind: "SPREADSHEET" as const,
                      fileName: "stored/source.xlsx",
                      originalName: "source.xlsx",
                      fileUrl: "working-papers/project-1/source.xlsx",
                      fileSize: 1024,
                      mimeType:
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                      version: 1,
                    },
                  ],
                },
              ],
              children: [],
            },
            {
              id: "target-node",
              parentId: "planning",
              code: "B01-0001",
              title: "Target",
              level: 2,
              nodeType: "FOLDER",
              workingPapers: [],
              children: [],
            },
          ],
        },
      ];

      render(
        createElement(WorkbenchDirectory, {
          workflow,
          selectedNodeId: null,
          addNodeTarget: null,
          setSelectedNodeId: vi.fn(),
          openAddNode: vi.fn(),
          closeAddNode: vi.fn(),
          createNode: vi.fn(),
          createNodePending: false,
          deleteNode: vi.fn(),
          deleteNodePending: false,
          showFiles: true,
          onCopyFileToNode,
        })
      );

      await ensureDirectoryNodeExpanded("planning");
      await ensureDirectoryNodeExpanded("source-node");
      fireEvent.contextMenu(screen.getByText(/source\.xlsx/));
      fireEvent.click(await screen.findByRole("menuitem", { name: /Copy/ }));
      fireEvent.contextMenu(getDirectoryNodeButton("planning"));
      fireEvent.click(await screen.findByRole("menuitem", { name: "Paste" }));

      expect(onCopyFileToNode).toHaveBeenCalledWith(
        expect.objectContaining({
          attachmentId: "attachment-source",
          fileName: "source.xlsx",
          paperId: "paper-source",
        }),
        expect.objectContaining({ id: "planning" }),
        expect.arrayContaining([
          expect.objectContaining({
            attachmentId: "attachment-source",
            paperId: "paper-source",
          }),
        ])
      );
    });

    it("cuts a directory file to a target node from the context menu", async () => {
      const onMoveFileToNode = vi.fn();
      const workflow = [
        {
          id: "planning",
          parentId: null,
          code: "Planning",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          workingPapers: [],
          children: [
            {
              id: "source-node",
              parentId: "planning",
              code: "A01-0001",
              title: "Source",
              level: 2,
              nodeType: "FOLDER",
              workingPapers: [
                {
                  id: "paper-source",
                  projectId: "project-1",
                  workflowNodeId: "source-node",
                  code: "A01-0001-F001",
                  title: "source.xlsx",
                  paperType: "WORKING_PAPER" as const,
                  bucket: "CURRENT" as const,
                  attachments: [
                    {
                      id: "attachment-source",
                      workingPaperId: "paper-source",
                      fileKind: "SPREADSHEET" as const,
                      fileName: "stored/source.xlsx",
                      originalName: "source.xlsx",
                      fileUrl: "working-papers/project-1/source.xlsx",
                      fileSize: 1024,
                      mimeType:
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                      version: 1,
                    },
                  ],
                },
              ],
              children: [],
            },
            {
              id: "target-node",
              parentId: "planning",
              code: "B01-0001",
              title: "Target",
              level: 2,
              nodeType: "FOLDER",
              workingPapers: [],
              children: [],
            },
          ],
        },
      ];

      render(
        createElement(WorkbenchDirectory, {
          workflow,
          selectedNodeId: null,
          addNodeTarget: null,
          setSelectedNodeId: vi.fn(),
          openAddNode: vi.fn(),
          closeAddNode: vi.fn(),
          createNode: vi.fn(),
          createNodePending: false,
          deleteNode: vi.fn(),
          deleteNodePending: false,
          showFiles: true,
          onMoveFileToNode,
        })
      );

      await ensureDirectoryNodeExpanded("planning");
      await ensureDirectoryNodeExpanded("source-node");
      fireEvent.contextMenu(screen.getByText(/source\.xlsx/));
      fireEvent.click(await screen.findByRole("menuitem", { name: "Cut" }));
      fireEvent.contextMenu(getDirectoryNodeButton("planning"));
      fireEvent.click(await screen.findByRole("menuitem", { name: "Paste" }));

      expect(onMoveFileToNode).toHaveBeenCalledWith(
        expect.objectContaining({
          attachmentId: "attachment-source",
          fileName: "source.xlsx",
          paperId: "paper-source",
        }),
        expect.objectContaining({ id: "planning" }),
        expect.arrayContaining([
          expect.objectContaining({
            attachmentId: "attachment-source",
            paperId: "paper-source",
          }),
        ])
      );
    });

    it("hides directory file rows after their active attachment is moved away", () => {
      render(
        createElement(WorkbenchDirectory, {
          workflow: [
            {
              id: "planning",
              parentId: null,
              code: "Planning",
              title: "Planning",
              level: 1,
              nodeType: "PHASE",
              workingPapers: [
                {
                  id: "paper-empty-after-move",
                  projectId: "project-1",
                  workflowNodeId: "planning",
                  code: "Planning-F001",
                  title: "moved-away.xlsx",
                  paperType: "WORKING_PAPER" as const,
                  bucket: "CURRENT" as const,
                  attachments: [],
                },
              ],
              children: [],
            },
          ],
          selectedNodeId: null,
          addNodeTarget: null,
          setSelectedNodeId: vi.fn(),
          openAddNode: vi.fn(),
          closeAddNode: vi.fn(),
          createNode: vi.fn(),
          createNodePending: false,
          deleteNode: vi.fn(),
          deleteNodePending: false,
          showFiles: true,
        })
      );

      fireEvent.click(getDirectoryNodeButton("planning"));

      expect(screen.queryByText("moved-away.xlsx")).toBeNull();
    });

    it("keeps the selected folder open and updates project files after upload", async () => {
      setupApi();
      mockApi.createWorkingPaper.mockResolvedValue({
        id: "paper-uploaded",
        projectId: "project-1",
        workflowNodeId: "a1-1000",
        code: "A01-0001",
        title: "support.xlsx",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
        attachments: [],
      });
      mockApi.uploadWorkingPaperAttachment.mockResolvedValue({
        id: "attachment-uploaded",
        workingPaperId: "paper-uploaded",
        fileKind: "SUPPORTING",
        fileName: "support.xlsx",
        originalName: "support.xlsx",
        fileUrl: "uploads/support.xlsx",
        fileSize: 12,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        version: 1,
        uploadedBy: "user-partner",
        uploader: {
          id: "user-partner",
          name: "Jony Ma",
          email: "partner@projectwing.local",
        },
      });
      renderWorkspace();

      const file = new File(["test"], "support.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      fireEvent.change(
        await findFileInputByAriaLabel(matchesDefaultWorkpaperUploadLabel),
        {
          target: { files: [file] },
        }
      );
      await confirmReferenceCodeImport();

      await waitFor(() =>
        expect(mockApi.uploadWorkingPaperAttachment).toHaveBeenCalledWith(
          "project-1",
          "paper-uploaded",
          file
        )
      );
      expect(vi.mocked(mockApi.workingPaper)).toHaveBeenCalledTimes(0);
      await waitFor(
        () => {
          expect(
            screen.getByRole("button", {
              name: "以 Master 打开 support.xlsx",
            })
          ).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it("uses a temporary sequence when uploading files to the temporary bucket", async () => {
      setupApi();
      mockApi.workflow.mockResolvedValue([
        {
          id: "planning",
          code: "Planning",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          workingPapers: [],
          children: [
            {
              id: "a1",
              parentId: "planning",
              code: "A01",
              title: "银行存款",
              level: 2,
              nodeType: "ACCOUNT",
              workingPapers: [],
              children: [
                {
                  id: "a1-1000",
                  parentId: "a1",
                  code: "A01-0001",
                  title: "银行凭据",
                  level: 3,
                  nodeType: "FOLDER",
                  workingPapers: [
                    {
                      id: "current-paper",
                      projectId: "project-1",
                      workflowNodeId: "a1-1000",
                      code: "A01-0001-F001",
                      title: "current.xlsx",
                      paperType: "WORKING_PAPER",
                      bucket: "CURRENT",
                      attachments: [],
                    },
                    {
                      id: "temporary-paper",
                      projectId: "project-1",
                      workflowNodeId: "a1-1000",
                      code: "TMP001",
                      title: "temporary.xlsx",
                      paperType: "WORKING_PAPER",
                      bucket: "TEMPORARY",
                      attachments: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ]);
      mockApi.createWorkingPaper.mockResolvedValue({
        id: "paper-uploaded",
        projectId: "project-1",
        workflowNodeId: "a1-1000",
        code: "TMP002",
        title: "temp-support.xlsx",
        paperType: "WORKING_PAPER",
        bucket: "TEMPORARY",
        attachments: [],
      });
      mockApi.uploadWorkingPaperAttachment.mockResolvedValue({
        id: "attachment-uploaded",
        workingPaperId: "paper-uploaded",
        fileKind: "SUPPORTING",
        fileName: "temp-support.xlsx",
        originalName: "temp-support.xlsx",
        fileUrl: "uploads/temp-support.xlsx",
        fileSize: 12,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        version: 1,
      });
      renderWorkspace();

      fireEvent.click(
        await screen.findByRole(
          "tab",
          { name: "临时" },
          { timeout: WORKSPACE_ASYNC_TIMEOUT_MS }
        )
      );

      const file = new File(["test"], "temp-support.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      fireEvent.change(
        await findFileInputByAriaLabel((label) => label.includes("临时")),
        {
          target: { files: [file] },
        }
      );
      await confirmReferenceCodeImport();

      await waitFor(() =>
        expect(mockApi.createWorkingPaper).toHaveBeenCalledWith("project-1", {
          workflowNodeId: "a1-1000",
          code: "TMP002",
          title: "temp-support.xlsx",
          paperType: "WORKING_PAPER",
          bucket: "TEMPORARY",
        })
      );
      expect(mockApi.uploadWorkingPaperAttachment).toHaveBeenCalledWith(
        "project-1",
        "paper-uploaded",
        file
      );
    });

    it.each([
      [
        "PPTX",
        "board-deck.pptx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ],
      ["PDF", "lease-contract.pdf", "application/pdf"],
    ])(
      "uploads %s files as desktop-editable working papers",
      async (_label, fileName, mimeType) => {
        setupApi();
        mockApi.createWorkingPaper.mockResolvedValue({
          id: "paper-uploaded",
          projectId: "project-1",
          workflowNodeId: "a1-1000",
          code: "A01-0001",
          title: fileName,
          paperType: "WORKING_PAPER",
          bucket: "CURRENT",
          attachments: [],
        });
        mockApi.uploadWorkingPaperAttachment.mockResolvedValue({
          id: "attachment-uploaded",
          workingPaperId: "paper-uploaded",
          fileKind: "SUPPORTING",
          fileName,
          originalName: fileName,
          fileUrl: `uploads/${fileName}`,
          fileSize: 12,
          mimeType,
          version: 1,
          uploadedBy: "user-partner",
          uploader: {
            id: "user-partner",
            name: "Jony Ma",
            email: "partner@projectwing.local",
          },
        });
        renderWorkspace();

        const file = new File(["test"], fileName, { type: mimeType });
        const uploadInput = await findFileInputByAriaLabel(
          matchesDefaultWorkpaperUploadLabel
        );
        fireEvent.change(uploadInput, {
          target: { files: [file] },
        });
        await confirmReferenceCodeImport();

        await waitFor(() =>
          expect(mockApi.createWorkingPaper).toHaveBeenCalledWith("project-1", {
            workflowNodeId: "a1-1000",
            code: "1110.1",
            title: fileName,
            paperType: "WORKING_PAPER",
            bucket: "CURRENT",
          })
        );
        expect(mockApi.uploadWorkingPaperAttachment).toHaveBeenCalledWith(
          "project-1",
          "paper-uploaded",
          file
        );
      }
    );

    it("cleans up the empty workpaper when attachment upload fails after creation", async () => {
      setupApi();
      mockApi.createWorkingPaper.mockResolvedValue({
        id: "paper-uploaded",
        projectId: "project-1",
        workflowNodeId: "a1-1000",
        code: "A01-0001-F001",
        title: "broken-deck.pptx",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
        attachments: [],
      });
      mockApi.uploadWorkingPaperAttachment.mockRejectedValue(
        new Error("附件上传信息无效")
      );
      renderWorkspace();

      const file = new File(["test"], "broken-deck.pptx", {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      });
      const uploadInput = await findFileInputByAriaLabel(
        matchesDefaultWorkpaperUploadLabel
      );
      fireEvent.change(uploadInput, {
        target: { files: [file] },
      });
      await confirmReferenceCodeImport();

      await waitFor(() =>
        expect(mockApi.deleteWorkingPaper).toHaveBeenCalledWith(
          "project-1",
          "paper-uploaded"
        )
      );
      expect(screen.queryByText("附件上传信息无效")).not.toBeInTheDocument();
    });

    it("rejects empty PPTX files before creating a workpaper", async () => {
      setupApi();
      renderWorkspace();

      const file = new File([], "empty-deck.pptx", {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      });
      const uploadInput = await findFileInputByAriaLabel(
        matchesDefaultWorkpaperUploadLabel
      );
      fireEvent.change(uploadInput, {
        target: { files: [file] },
      });
      await confirmReferenceCodeImport();

      expect(screen.queryByText("File is empty")).not.toBeInTheDocument();
      expect(vi.mocked(mockApi.createWorkingPaper)).toHaveBeenCalledTimes(0);
      expect(
        vi.mocked(mockApi.uploadWorkingPaperAttachment)
      ).toHaveBeenCalledTimes(0);
    });

    it("uploads files from the workspace into a second-level folder", async () => {
      setupApi();
      mockApi.createWorkingPaper.mockResolvedValue({
        id: "paper-uploaded-to-folder",
        projectId: "project-1",
        workflowNodeId: "a1",
        code: "A01-F001",
        title: "folder-support.xlsx",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
        attachments: [],
      });
      mockApi.uploadWorkingPaperAttachment.mockResolvedValue({
        id: "attachment-folder-uploaded",
        workingPaperId: "paper-uploaded-to-folder",
        fileKind: "SUPPORTING",
        fileName: "folder-support.xlsx",
        originalName: "folder-support.xlsx",
        fileUrl: "uploads/folder-support.xlsx",
        fileSize: 12,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        version: 1,
        uploadedBy: "user-partner",
        uploader: {
          id: "user-partner",
          name: "Jony Ma",
          email: "partner@projectwing.local",
        },
      });
      renderWorkspace();

      await ensureDirectoryNodeExpanded("planning");
      fireEvent.click(await findDirectoryNodeButton("a1"));

      const file = new File(["test"], "folder-support.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      fireEvent.change(
        await findFileInputByAriaLabel(matchesDefaultFolderUploadLabel),
        {
          target: { files: [file] },
        }
      );
      await confirmReferenceCodeImport();

      await waitFor(() =>
        expect(mockApi.createWorkingPaper).toHaveBeenCalledWith("project-1", {
          workflowNodeId: "a1",
          code: "1100.1",
          title: "folder-support.xlsx",
          paperType: "WORKING_PAPER",
          bucket: "CURRENT",
        })
      );
    });

    it.each([
      ["1-10-00", false],
      ["1-10-10-0", true],
    ])(
      "uploads directly into an overflow-numbered folder %s",
      async (folderCode, hasGrandchild) => {
        setupApi();
        const overflowFolder = {
          id: "overflow-folder",
          parentId: hasGrandchild ? "overflow-parent" : "planning",
          code: folderCode,
          title: "Overflow folder",
          level: hasGrandchild ? 3 : 2,
          nodeType: "WORKING_PAPER" as const,
          workingPapers: [],
          children: [],
        };
        mockApi.workflow.mockResolvedValue([
          {
            id: "planning",
            code: "1000",
            title: "Planning",
            level: 1,
            nodeType: "PHASE",
            workingPapers: [],
            children: hasGrandchild
              ? [
                  {
                    id: "overflow-parent",
                    parentId: "planning",
                    code: "1-10-00",
                    title: "Overflow parent",
                    level: 2,
                    nodeType: "ACCOUNT",
                    workingPapers: [],
                    children: [overflowFolder],
                  },
                ]
              : [overflowFolder],
          },
        ]);
        mockApi.createWorkingPaper.mockResolvedValue({
          id: "paper-overflow-uploaded",
          projectId: "project-1",
          workflowNodeId: "overflow-folder",
          code: `${folderCode}.1`,
          title: "overflow-support.xlsx",
          paperType: "WORKING_PAPER",
          bucket: "CURRENT",
          attachments: [],
        });
        mockApi.uploadWorkingPaperAttachment.mockResolvedValue({
          id: "attachment-overflow-uploaded",
          workingPaperId: "paper-overflow-uploaded",
          fileKind: "SUPPORTING",
          fileName: "overflow-support.xlsx",
          originalName: "overflow-support.xlsx",
          fileUrl: "uploads/overflow-support.xlsx",
          fileSize: 12,
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          version: 1,
          uploadedBy: "user-partner",
          uploader: {
            id: "user-partner",
            name: "Jony Ma",
            email: "partner@projectwing.local",
          },
        });
        renderWorkspace();

        await ensureDirectoryNodeExpanded("planning");
        if (hasGrandchild) {
          await ensureDirectoryNodeExpanded("overflow-parent");
        }
        fireEvent.click(await findDirectoryNodeButton("overflow-folder"));

        const file = new File(["test"], "overflow-support.xlsx", {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        fireEvent.change(
          await findFileInputByAriaLabel(matchesDefaultFolderUploadLabel),
          {
            target: { files: [file] },
          }
        );
        await confirmReferenceCodeImport();

        await waitFor(() =>
          expect(mockApi.createWorkingPaper).toHaveBeenCalledWith("project-1", {
            workflowNodeId: "overflow-folder",
            code: `${folderCode}.1`,
            title: "overflow-support.xlsx",
            paperType: "WORKING_PAPER",
            bucket: "CURRENT",
          })
        );
      }
    );

    it("creates second-level folders from a phase folder upload", async () => {
      setupApi();
      mockApi.workflow.mockResolvedValue([
        {
          id: "planning",
          code: "Planning",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          workingPapers: [],
          children: [],
        },
      ]);
      mockApi.createWorkflowNode
        .mockResolvedValueOnce({
          id: "bank-node",
          parentId: "planning",
          code: "A1",
          title: "Bank",
          level: 2,
          nodeType: "ACCOUNT",
          workingPapers: [],
          children: [],
        })
        .mockResolvedValueOnce({
          id: "payroll-node",
          parentId: "planning",
          code: "A2",
          title: "Payroll",
          level: 2,
          nodeType: "ACCOUNT",
          workingPapers: [],
          children: [],
        });
      mockApi.createWorkingPaper.mockResolvedValue({
        id: "paper-uploaded-to-folder",
        projectId: "project-1",
        workflowNodeId: "bank-node",
        code: "A1-F001",
        title: "folder-support.xlsx",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
        attachments: [],
      });
      mockApi.uploadWorkingPaperAttachment.mockResolvedValue({
        id: "attachment-folder-uploaded",
        workingPaperId: "paper-uploaded-to-folder",
        fileKind: "SUPPORTING",
        fileName: "folder-support.xlsx",
        originalName: "folder-support.xlsx",
        fileUrl: "uploads/folder-support.xlsx",
        fileSize: 12,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        version: 1,
        uploadedBy: "user-partner",
        uploader: {
          id: "user-partner",
          name: "Jony Ma",
          email: "partner@projectwing.local",
        },
      });
      renderWorkspace();

      const bankFile = directoryFile("Upload/Bank/bank.xlsx", "bank.xlsx");
      const nestedBankFile = directoryFile(
        "Upload/Bank/Archive/old.xlsx",
        "old.xlsx"
      );
      const payrollFile = directoryFile(
        "Upload/Payroll/payroll.xlsx",
        "payroll.xlsx"
      );
      const rootFile = directoryFile("Upload/readme.txt", "readme.txt");

      fireEvent.click(await findDirectoryNodeButton("planning"));
      fireEvent.change(await findPhaseFolderInput(), {
        target: {
          files: [bankFile, nestedBankFile, payrollFile, rootFile],
        },
      });
      await confirmReferenceCodeImport();
      await confirmReferenceCodeImport();

      await waitFor(
        () => {
          expect(mockApi.createWorkflowNode).toHaveBeenNthCalledWith(
            1,
            "project-1",
            {
              parentId: "planning",
              code: "A1",
              title: "Bank",
            }
          );
          expect(mockApi.createWorkflowNode).toHaveBeenNthCalledWith(
            2,
            "project-1",
            {
              parentId: "planning",
              code: "A2",
              title: "Payroll",
            }
          );
          expect(mockApi.createWorkflowNode).toHaveBeenCalledTimes(2);
          expect(mockApi.createWorkingPaper).toHaveBeenCalledWith(
            "project-1",
            expect.objectContaining({
              workflowNodeId: "bank-node",
              code: "1100.1",
              title: "bank.xlsx",
            })
          );
          expect(mockApi.createWorkingPaper).toHaveBeenCalledWith(
            "project-1",
            expect.objectContaining({
              workflowNodeId: "bank-node",
              code: "1100.2",
              title: "old.xlsx",
            })
          );
          expect(mockApi.createWorkingPaper).toHaveBeenCalledWith(
            "project-1",
            expect.objectContaining({
              workflowNodeId: "payroll-node",
              code: "1200.1",
              title: "payroll.xlsx",
            })
          );
        },
        { timeout: WORKSPACE_ASYNC_TIMEOUT_MS }
      );
      expect(mockApi.createWorkingPaper).not.toHaveBeenCalledWith(
        "project-1",
        expect.objectContaining({ title: "readme.txt" })
      );
    });

    it("surfaces a phase folder creation failure in the workbench", async () => {
      setupApi();
      mockApi.workflow.mockResolvedValue([
        {
          id: "planning",
          code: "Planning",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          workingPapers: [],
          children: [],
        },
      ]);
      mockApi.createWorkflowNode.mockRejectedValue(
        new Error("子文件夹创建失败")
      );
      renderWorkspace();

      fireEvent.click(await findDirectoryNodeButton("planning"));
      fireEvent.change(await findPhaseFolderInput(), {
        target: {
          files: [directoryFile("Upload/Bank/bank.xlsx", "bank.xlsx")],
        },
      });
      await waitFor(() =>
        expect(mockApi.createWorkflowNode).toHaveBeenCalledWith(
          "project-1",
          expect.objectContaining({ title: "Bank" })
        )
      );
      expect(screen.getByText("子文件夹创建失败")).toBeInTheDocument();
    });

    it("refreshes and retries a partial folder upload without duplicates", async () => {
      setupApi();
      const phase: WorkflowNode = {
        id: "planning",
        code: "Planning",
        title: "Planning",
        level: 1,
        nodeType: "PHASE",
        workingPapers: [],
        children: [],
      };
      const bankNode: WorkflowNode = {
        id: "bank-node",
        parentId: "planning",
        code: "A1",
        title: "Bank",
        level: 2,
        nodeType: "ACCOUNT",
        workingPapers: [],
        children: [],
      };
      let workflowState: WorkflowNode[] = [phase];
      const file = directoryFile("Upload/Bank/bank.xlsx", "bank.xlsx");
      const updateBankNode = (update: (node: WorkflowNode) => WorkflowNode) => {
        const [currentPhase] = workflowState;
        workflowState = [
          {
            ...currentPhase,
            children: (currentPhase.children ?? []).map((node) =>
              node.id === bankNode.id ? update(node) : node
            ),
          },
        ];
      };

      mockApi.workflow.mockImplementation(() => workflowState);
      mockApi.createWorkflowNode.mockImplementationOnce(() => {
        workflowState = [{ ...phase, children: [bankNode] }];
        return bankNode;
      });
      mockApi.createWorkingPaper.mockImplementation(
        (
          _projectId: string,
          input: {
            workflowNodeId: string;
            code: string;
            title: string;
            paperType: "WORKING_PAPER";
            bucket: "CURRENT";
          }
        ) => {
          const paper = {
            id: `paper-${input.title}`,
            projectId: "project-1",
            workflowNodeId: input.workflowNodeId,
            code: input.code,
            title: input.title,
            paperType: input.paperType,
            bucket: input.bucket,
            attachments: [],
          };
          updateBankNode((node) => ({
            ...node,
            workingPapers: [...node.workingPapers, paper],
          }));
          return paper;
        }
      );
      mockApi.deleteWorkingPaper.mockImplementation(
        (_projectId: string, paperId: string) => {
          updateBankNode((node) => ({
            ...node,
            workingPapers: node.workingPapers.filter(
              (paper) => paper.id !== paperId
            ),
          }));
        }
      );
      mockApi.uploadWorkingPaperAttachment
        .mockRejectedValueOnce(new Error("附件上传失败"))
        .mockResolvedValue({
          id: "attachment-folder-uploaded",
          workingPaperId: "paper-bank.xlsx",
          fileKind: "SUPPORTING",
          fileName: "bank.xlsx",
          originalName: "bank.xlsx",
          fileUrl: "uploads/bank.xlsx",
          fileSize: 12,
          mimeType: "text/plain",
          version: 1,
          uploadedBy: "user-partner",
          uploader: {
            id: "user-partner",
            name: "Jony Ma",
            email: "partner@projectwing.local",
          },
        });
      renderWorkspace();

      fireEvent.click(await findDirectoryNodeButton("planning"));
      fireEvent.change(await findPhaseFolderInput(), {
        target: { files: [file] },
      });
      await confirmReferenceCodeImport();

      await waitFor(() =>
        expect(mockApi.uploadWorkingPaperAttachment).toHaveBeenCalledOnce()
      );
      expect(screen.queryByText("附件上传失败")).not.toBeInTheDocument();
      await ensureDirectoryNodeExpanded("planning");
      await findDirectoryNodeButton("bank-node");

      fireEvent.click(await findDirectoryNodeButton("planning"));
      fireEvent.change(await findPhaseFolderInput(), {
        target: { files: [file] },
      });
      await confirmReferenceCodeImport();
      await waitFor(() =>
        expect(mockApi.uploadWorkingPaperAttachment).toHaveBeenCalledTimes(2)
      );

      fireEvent.click(await findDirectoryNodeButton("planning"));
      fireEvent.change(await findPhaseFolderInput(), {
        target: { files: [file] },
      });
      await waitFor(() =>
        expect(mockApi.createWorkingPaper).toHaveBeenCalledTimes(2)
      );
      expect(mockApi.createWorkflowNode).toHaveBeenCalledOnce();
      expect(mockApi.uploadWorkingPaperAttachment).toHaveBeenCalledTimes(2);
    });

    it("keeps the uploaded folder highlighted without expanding it", async () => {
      setupApi();
      mockApi.createWorkingPaper.mockResolvedValue({
        id: "paper-uploaded-to-folder",
        projectId: "project-1",
        workflowNodeId: "a1",
        code: "A01-F001",
        title: "folder-support.xlsx",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
        attachments: [],
      });
      mockApi.uploadWorkingPaperAttachment.mockResolvedValue({
        id: "attachment-folder-uploaded",
        workingPaperId: "paper-uploaded-to-folder",
        fileKind: "SUPPORTING",
        fileName: "folder-support.xlsx",
        originalName: "folder-support.xlsx",
        fileUrl: "uploads/folder-support.xlsx",
        fileSize: 12,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        version: 1,
        uploadedBy: "user-partner",
        uploader: {
          id: "user-partner",
          name: "Jony Ma",
          email: "partner@projectwing.local",
        },
      });
      renderWorkspace();

      await ensureDirectoryNodeExpanded("planning");
      const folderButton = await findDirectoryNodeButton("a1");
      await waitFor(() =>
        expect(folderButton).toHaveAttribute("aria-expanded", "true")
      );
      fireEvent.click(folderButton);
      await waitFor(() =>
        expect(folderButton).toHaveAttribute("aria-expanded", "false")
      );

      const file = new File(["test"], "folder-support.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const uploadInput = await findFileInputByAriaLabel(
        matchesDefaultFolderUploadLabel
      );
      fireEvent.change(uploadInput, {
        target: { files: [file] },
      });
      await confirmReferenceCodeImport();

      await waitFor(() =>
        expect(mockApi.uploadWorkingPaperAttachment).toHaveBeenCalledWith(
          "project-1",
          "paper-uploaded-to-folder",
          file
        )
      );
      await waitFor(() => {
        expect(folderButton).toHaveAttribute("data-active", "true");
        expect(folderButton).toHaveAttribute("aria-expanded", "false");
      });
    });
  });

  function renderWorkspace({
    route = "legacy-workspace",
  }: { route?: "legacy-workspace" | "project-first" } = {}) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    return Object.assign(
      render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(
            ThemeProvider,
            { initialTheme: { fontSize: "md" } } as unknown as Parameters<
              typeof ThemeProvider
            >[0],
            createElement(
              ToastProvider,
              null,
              createElement(WorkspacePage, {
                workspaceId:
                  route === "legacy-workspace" ? "workspace-1" : undefined,
                projectId: "project-1",
              })
            )
          )
        )
      ),
      { queryClient }
    );
  }

  function findProjectFileRow(fileName: string) {
    return waitFor(() => {
      const row = screen
        .queryAllByText(
          (_content, element) =>
            element?.textContent?.includes(fileName) ?? false
        )
        .map((element) => element.closest("tr"))
        .find((element): element is HTMLTableRowElement => Boolean(element));
      return requireElement(row);
    }).then(requireValue);
  }

  function findDirectoryNodeButton(nodeId: string) {
    return waitFor(
      () => {
        const button = queryDirectoryNodeButton(nodeId);
        return requireElement(button);
      },
      { timeout: WORKSPACE_ASYNC_TIMEOUT_MS }
    );
  }

  function getDirectoryNodeButton(nodeId: string) {
    const button = queryDirectoryNodeButton(nodeId);
    return requireElement(button);
  }

  function queryDirectoryNodeButton(nodeId: string) {
    return document.querySelector<HTMLElement>(
      `[data-directory-selectable-id="node:${nodeId}"]`
    );
  }

  async function ensureDirectoryNodeExpanded(nodeId: string) {
    const label = await findDirectoryNodeButton(nodeId);
    const node = requireElement(
      label.closest<HTMLElement>('[role="treeitem"]')
    );
    if (node.getAttribute("aria-expanded") !== "true") {
      fireEvent.click(node);
    }
    await waitFor(() => expect(node).toHaveAttribute("aria-expanded", "true"), {
      timeout: WORKSPACE_ASYNC_TIMEOUT_MS,
    });
    return node;
  }

  function findFileInputByAriaLabel(matches: (label: string) => boolean) {
    return waitFor(
      () => {
        const inputs = [
          ...document.querySelectorAll<HTMLInputElement>('input[type="file"]'),
        ];
        const input =
          inputs.find((element) =>
            matches(element.getAttribute("aria-label") ?? "")
          ) ??
          inputs.find((element) => {
            const label = element.getAttribute("aria-label") ?? "";
            return label !== "Attach file" && !element.disabled;
          });
        return requireValue(input);
      },
      { timeout: WORKSPACE_ASYNC_TIMEOUT_MS }
    );
  }

  async function confirmReferenceCodeImport() {
    const dialog = await screen.findByRole("dialog", { name: "确认参考编号" });
    fireEvent.click(within(dialog).getByRole("button", { name: "导入文件" }));
  }

  function findPhaseFolderInput() {
    return waitFor(
      () => {
        const input = [
          ...document.querySelectorAll<HTMLInputElement>('input[type="file"]'),
        ].find((element) => element.hasAttribute("webkitdirectory"));
        return requireValue(input);
      },
      { timeout: WORKSPACE_ASYNC_TIMEOUT_MS }
    );
  }

  function directoryFile(relativePath: string, name: string) {
    const file = new File([name], name, { type: "text/plain" });
    Object.defineProperty(file, "webkitRelativePath", {
      configurable: true,
      value: relativePath,
    });
    return file;
  }

  function matchesDefaultWorkpaperUploadLabel(label: string) {
    return (
      label === "Choose file" ||
      label.includes("选择文件") ||
      (/A0?1/.test(label) && /(?:0001|1000)/.test(label))
    );
  }

  function matchesDefaultFolderUploadLabel(label: string) {
    return (
      label === "Choose file" ||
      label.includes("选择文件") ||
      (/A0?1/.test(label) && !/(?:0001|1000)/.test(label))
    );
  }

  function makeSpreadsheetPreview(
    attachmentId = "attachment-preview",
    input: {
      sheetIndex?: number;
      offset?: number;
      limit?: number;
      columnOffset?: number;
      columnLimit?: number;
    } = {}
  ) {
    return {
      attachmentId,
      fileName: "preview.xlsx",
      sheetNames: ["Sheet1"],
      sheetIndex: input.sheetIndex ?? 0,
      sheetName: "Sheet1",
      offset: input.offset ?? 0,
      limit: input.limit ?? 50,
      columnOffset: input.columnOffset ?? 0,
      columnLimit: input.columnLimit ?? 30,
      totalRows: 1,
      totalColumns: 1,
      rows: [{ rowNumber: 1, cells: ["Cell A1"] }],
      hasMore: false,
      hasMoreColumns: false,
    };
  }

  function setupApi({
    projectStatus = "ACTIVE",
    currentGlobalRole = "PARTNER",
    currentProjectRole = "PARTNER",
    currentInChargeRole = "PARTNER_IN_CHARGE",
    includeCurrentMember = true,
  }: {
    projectStatus?: "ACTIVE" | "PENDING_FINAL_CHECK" | "ARCHIVED";
    currentGlobalRole?: GlobalRole;
    currentProjectRole?: ProjectRole;
    currentInChargeRole?: InChargeRole | null;
    includeCurrentMember?: boolean;
  } = {}) {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
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
      status: projectStatus,
      desktopFolder: {
        id: "folder-abc",
        ownerId: "user-partner",
        name: "ABC Group",
        sortOrder: 1,
        isDefault: false,
      },
      members: includeCurrentMember
        ? [
            {
              id: "member-current",
              projectId: "project-1",
              userId: "user-partner",
              projectRole: currentProjectRole,
              inChargeRole: currentInChargeRole,
              independenceStatus: "SIGNED",
              invitationStatus: "ACCEPTED",
              invitedAt: "2026-05-28T09:00:00.000Z",
              joinedAt: "2026-05-28T09:00:00.000Z",
              createdAt: "2026-05-28T09:00:00.000Z",
              updatedAt: "2026-05-28T09:00:00.000Z",
              user: {
                id: "user-partner",
                email: "partner@projectwing.local",
                name: "Jony Ma",
                globalRole: currentGlobalRole,
                status: "ACTIVE",
              },
            },
          ]
        : [],
    });
    mockApi.projectDeclarationStatus.mockResolvedValue({ accepted: true });
    mockApi.activeProjectFileExportJob.mockResolvedValue(null);
    mockApi.acceptProjectDeclaration.mockResolvedValue({});
    mockApi.createWorkflowNode.mockResolvedValue({});
    mockApi.deleteWorkflowNode.mockResolvedValue({});
    mockApi.createWorkingPaper.mockResolvedValue({});
    mockApi.copyAttachment.mockResolvedValue({});
    mockApi.uploadWorkingPaperAttachment.mockResolvedValue({});
    mockApi.moveAttachment.mockResolvedValue({});
    mockApi.copyAttachment.mockResolvedValue({});
    mockApi.deleteWorkingPaper.mockResolvedValue({ id: "paper-uploaded" });
    mockApi.frameworkTemplates.mockResolvedValue([
      {
        id: "framework-hkfrs",
        code: "HKFRS",
        name: "HKFRS audit framework",
        language: "zh-CN",
        isActive: true,
      },
    ]);
    mockApi.updateProject.mockResolvedValue({});
    mockApi.projectAttachments.mockResolvedValue([]);
    mockApi.moveAttachment.mockResolvedValue({});
    mockApi.deletedAttachments.mockResolvedValue([]);
    mockApi.restoreAttachment.mockResolvedValue({});
    const archiveCheckReport = {
      project: {
        id: "project-1",
        projectCode: "AUD-2026-0001",
        name: "Company Name",
      },
      generatedAt: "2026-06-12T09:00:00.000Z",
      ready: true,
      summary: {
        workingPapers: 0,
        blockers: 0,
        warnings: 0,
        unreviewedWorkingPapers: 0,
        unresolvedReviewQuestions: 0,
        emptyWorkingPapers: 0,
        lockedAttachments: 0,
      },
      issues: [],
    };
    const archiveCheckJob = {
      jobId: "archive-check-job-1",
      projectId: "project-1",
      status: "completed",
      currentPhase: "finalizing",
      progress: {
        completedUnits: 5,
        totalUnits: 5,
        groups: [
          { id: "signoffs", label: "signoffs", status: "completed" },
          {
            id: "reviewQuestions",
            label: "reviewQuestions",
            status: "completed",
          },
          {
            id: "workpaperFiles",
            label: "workpaperFiles",
            status: "completed",
          },
          { id: "officeFiles", label: "officeFiles", status: "completed" },
          { id: "finalizing", label: "finalizing", status: "completed" },
        ],
      },
      report: archiveCheckReport,
      createdAt: "2026-06-12T09:00:00.000Z",
      updatedAt: "2026-06-12T09:00:00.000Z",
    };
    const archiveJob = {
      jobId: "archive-job-1",
      projectId: "project-1",
      status: "completed",
      currentPhase: "finalizing",
      progress: {
        completedUnits: 4,
        totalUnits: 4,
      },
      createdAt: "2026-06-12T09:00:00.000Z",
      updatedAt: "2026-06-12T09:01:00.000Z",
    };
    mockApi.startArchiveCheckJob.mockResolvedValue(archiveCheckJob);
    mockApi.archiveCheckJob.mockResolvedValue(archiveCheckJob);
    mockApi.exportArchiveCheck.mockResolvedValue(new Blob(["file-check"]));
    mockApi.submitArchive.mockResolvedValue({
      id: "project-1",
      status: "PENDING_FINAL_CHECK",
    });
    mockApi.confirmProjectArchive.mockResolvedValue(archiveJob);
    mockApi.archiveJob.mockResolvedValue(archiveJob);
    mockApi.workingPaper.mockResolvedValue({});
    mockApi.previewAttachmentContent.mockResolvedValue(new Blob(["preview"]));
    mockApi.previewAttachment.mockImplementation(
      (_projectId, attachmentId, input) =>
        makeSpreadsheetPreview(attachmentId, input)
    );
    mockApi.readZip.mockResolvedValue({
      ok: true,
      mode: "READ_ONLY",
      projectId: "project-1",
      attachmentId: "attachment-zip",
      fileName: "archive.zip",
      version: 1,
      entries: [
        {
          type: "file",
          name: "support.pdf",
          path: "support.pdf",
          size: 128,
          modifiedAt: "2026-06-01T08:00:00.000Z",
        },
      ],
    });
    mockApi.downloadAttachment.mockResolvedValue(new Blob(["file"]));
    mockApi.downloadAttachmentReadOnly.mockResolvedValue(new Blob(["file"]));
    mockApi.previewAttachmentContent.mockResolvedValue(new Blob(["file"]));
    mockApi.inboxMessages.mockResolvedValue([]);
    mockApi.markInboxRead.mockResolvedValue({});
    mockApi.markInboxUnread.mockResolvedValue({});
    mockApi.desktop.mockResolvedValue({ folders: [], placements: [] });
    mockApi.confirmationTemplateLibrary.mockResolvedValue([]);
    mockApi.userMailConnection.mockResolvedValue({ connected: false });
    mockApi.me.mockResolvedValue({
      id: "user-partner",
      email: "partner@projectwing.local",
      name: "Jony Ma",
      globalRole: currentGlobalRole,
      status: "ACTIVE",
    });
    mockApi.members.mockResolvedValue([]);
    mockApi.userDirectory.mockResolvedValue([]);
    mockApi.workItems.mockResolvedValue({ categories: [], items: [] });
    mockApi.workflow.mockResolvedValue([
      {
        id: "planning",
        code: "Planning",
        title: "Planning",
        level: 1,
        nodeType: "PHASE",
        workingPapers: [],
        children: [
          {
            id: "a1",
            parentId: "planning",
            code: "A01",
            title: "银行存款",
            level: 2,
            nodeType: "ACCOUNT",
            workingPapers: [],
            children: [
              {
                id: "a1-1000",
                parentId: "a1",
                code: "A01-0001",
                title: "银行凭据",
                level: 3,
                nodeType: "FOLDER",
                workingPapers: [],
              },
            ],
          },
        ],
      },
    ]);
    mockApi.workspaces.mockResolvedValue([
      {
        id: "workspace-1",
        name: "Workspace",
        clientName: "Client Name",
        projects: [],
      },
    ]);
    mockApi.auditLogs.mockResolvedValue([
      {
        id: "log-1",
        action: "PROJECT_CREATED",
        targetType: "PROJECT",
        targetId: "project-1",
        projectId: "project-1",
        ipAddress: "192.0.2.10",
        userAgent: "ProjectWing Test Browser",
        description: "创建项目 AUD-2026-0001",
        createdAt: "2026-05-28T09:00:00.000Z",
        actor: {
          id: "user-partner",
          name: "Jony Ma",
          email: "partner@projectwing.local",
          globalRole: "PARTNER",
        },
      },
    ]);
  }
});
