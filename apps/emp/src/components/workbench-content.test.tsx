import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { DndContext } from "@dnd-kit/core";
// @vitest-environment jsdom
import {
  DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
  DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
  DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
  SMART_FORM_MIME_TYPE,
  getDesktopAgentCompatibilityStatus,
} from "@project-wing/shared";
import type {
  DesktopAgentSession,
  ProjectRole,
  WorkingPaperBucket,
} from "@project-wing/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, useState } from "react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../api/client";
import type {
  ProjectAttachment,
  ProjectMember,
  WorkflowNode,
  WorkingPaperQuestion,
} from "../api/client";
import * as desktopAgent from "../api/desktop-agent";
import { getDictionary } from "../i18n/dictionaries";
import { ToastProvider } from "./toast";
import { WorkbenchContent } from "./workbench-content";
import type { WorkbenchPaperForm } from "./workbench-content";
import {
  AttachmentRecycleBinPanel,
  ProjectFileIssueIndicator,
  ReviewQuestionsPanel,
  WorkbenchFilePreviewPane,
  getSingleAttachmentSignoffTarget,
  openAttachmentPreviewInNewWindow,
} from "./workbench-paper-section";
import { WorkbenchTemplateLibraryDialog } from "./workbench-template-library-dialog";

let mockSearchParams = new URLSearchParams();

describe(getSingleAttachmentSignoffTarget, () => {
  it("routes a one-file workpaper signoff to its attachment", () => {
    expect(
      getSingleAttachmentSignoffTarget({
        attachments: [{ id: "attachment-smart-form" }],
      } as never)
    ).toBe("attachment-smart-form");
    expect(
      getSingleAttachmentSignoffTarget({ attachments: [] } as never)
    ).toBeNull();
    expect(
      getSingleAttachmentSignoffTarget({
        attachments: [{ id: "attachment-1" }, { id: "attachment-2" }],
      } as never)
    ).toBeNull();
  });
});

describe("Project file review-note indicators", () => {
  const statusLabels = {
    OPEN: "Open",
    REPLIED: "Replied",
    CLEARED: "Cleared",
  } as const;

  it("shows reply evidence beside pending notes and keeps cleared notes resolved", () => {
    const { container } = render(
      <>
        <ProjectFileIssueIndicator
          count={1}
          state="open"
          status="pending"
          summary={{
            pending: 1,
            replied: 1,
            resolved: 0,
            workflowReplied: 0,
            replyEvidence: 1,
          }}
          statusLabels={statusLabels}
        />
        <ProjectFileIssueIndicator
          count={1}
          state="closed"
          status="resolved"
          summary={{
            pending: 0,
            replied: 1,
            resolved: 1,
            workflowReplied: 0,
            replyEvidence: 1,
          }}
          statusLabels={statusLabels}
        />
      </>
    );

    const indicators = container.querySelectorAll(
      "[data-review-question-status]"
    );
    expect(indicators[0]).toHaveAttribute(
      "data-review-question-reply-count",
      "1"
    );
    expect(indicators[0]).toHaveAttribute(
      "data-review-question-status",
      "pending"
    );
    expect(indicators[1]).toHaveAttribute(
      "data-review-question-state",
      "closed"
    );
    expect(indicators[1]).toHaveAttribute(
      "data-review-question-status",
      "resolved"
    );
  });
});

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

function stubObjectUrl(
  createObjectURL: () => string,
  revokeObjectURL: () => void
) {
  const mockedUrl = new Proxy(URL, {
    get(target, property, receiver) {
      if (property === "createObjectURL") {
        return createObjectURL;
      }
      if (property === "revokeObjectURL") {
        return revokeObjectURL;
      }
      return Reflect.get(target, property, receiver);
    },
  });
  vi.stubGlobal("URL", mockedUrl);
}

function enterReviewNoteContent(value: string) {
  const editor = screen.getByRole("textbox", {
    name: "Review note content",
  });
  editor.focus();
  fireEvent.paste(editor, {
    clipboardData: {
      files: [],
      getData: (type: string) => (type === "text/plain" ? value : ""),
      items: [],
      types: ["text/plain"],
    },
  });
  return editor;
}

vi.mock("next/navigation", () => ({
  usePathname: () => "/engagement/project-1",
  useSearchParams: () => mockSearchParams,
}));

vi.mock("./extend/csv-viewer", () => ({
  CsvViewer: ({ data }: { data: string }) =>
    createElement("div", { "data-testid": "extend-csv-viewer" }, data),
}));

vi.mock("./extend/docx-viewer", () => ({
  DocxViewerPreview: ({ fileName }: { fileName?: string }) =>
    createElement("div", { "data-testid": "extend-docx-viewer" }, fileName),
}));

vi.mock("./extend/pdf-viewer", () => ({
  PDFViewer: ({
    autoFitWidth,
    fileName,
    toolbarActions,
  }: {
    autoFitWidth?: boolean;
    fileName?: string;
    toolbarActions?: ReactNode;
  }) =>
    createElement(
      "div",
      {
        "data-auto-fit-width": String(autoFitWidth),
        "data-testid": "extend-pdf-viewer",
      },
      fileName,
      toolbarActions
    ),
}));

vi.mock("./extend/pptx-viewer", () => ({
  PptxViewerPreview: ({ fileName }: { fileName?: string }) =>
    createElement("div", { "data-testid": "extend-pptx-viewer" }, fileName),
}));

vi.mock("./extend/xlsx-viewer", () => ({
  XlsxViewerPreview: ({ fileName }: { fileName?: string }) =>
    createElement("div", { "data-testid": "extend-xlsx-viewer" }, fileName),
}));

const zhWorkbenchContentCopy = {
  selectPromptTitle: "Select a workpaper or file",
  selectPromptDescription:
    "Expand groups and select a workpaper to upload files or open existing files.",
  signoffStatus: {
    preparedLabel: "Prepared",
    preparedTitle: "Prepared signoff",
    reviewedLabel: "Reviewed",
    reviewedTitle: "Reviewed signoff",
  },
};

function breadcrumbPath(...labels: string[]) {
  return labels.map((label, index) => ({
    nodeId: `breadcrumb-node-${index + 1}`,
    label,
  }));
}

async function chooseSelectOption(
  container: HTMLElement,
  comboboxName: string | RegExp,
  optionName: string | RegExp
) {
  fireEvent.click(
    within(container).getByRole("combobox", { name: comboboxName })
  );
  fireEvent.click(await screen.findByRole("option", { name: optionName }));
}

const localizedDesktopAgentUpdateCopy = {
  title: "安装或更新 Desktop Agent",
  description:
    "Master 编辑需要 Desktop Agent 打开 Office/PDF 文件、跟踪文件关闭、上传新版本，并安全释放 Master。",
  waitingForStart: "正在等待 Desktop Agent 启动...",
  releasingAndUpdating: "正在安全释放未改动 Master 会话并开始更新...",
  startingUpdate: "正在开始 Desktop Agent 更新...",
  startingAgent: "正在启动 Desktop Agent...",
  startAgent: "启动 Desktop Agent",
  startFailed:
    "Desktop Agent 连续 3 次启动失败。它可能未安装、已损坏或被系统拦截。请下载并运行最新版安装包，然后重试 Master。",
  retryingMaster: "Desktop Agent 已启动，正在重新打开 Master...",
  retryMasterFailed:
    "Desktop Agent 已启动，但 Master 未能打开。请重试，或下载只读副本。",
  releaseAllAndUpdate: "安全释放未改动 Master 并更新",
  updateAgent: "更新 Desktop Agent",
  exit: "退出",
  installerUnavailable: "安装包不可用",
  downloadReadOnly: "下载只读副本",
  closeWorkbooks: "请先关闭已打开的 Office 文件，以继续 Desktop Agent 更新。",
  downloading: "正在下载 Desktop Agent 更新...",
  verifyingInstaller: "正在验证 Desktop Agent 安装包...",
  stoppingAgent: "正在停止旧 Desktop Agent...",
  repairingEnvironment: "正在修复 Desktop Agent 安装环境...",
  installing: "正在安装 Desktop Agent 更新...",
  startingAgentUpdate: "正在启动新版 Desktop Agent...",
  verifyingHealth: "正在验证新版 Desktop Agent...",
  restarting: "正在重启 Desktop Agent...",
  ready: "Desktop Agent 更新已就绪。",
  failed: "Desktop Agent 更新失败。",
  fallbackFailed: "无法开始 Desktop Agent 更新。",
  updateTimedOut:
    "Desktop Agent 更新等待超时。请下载并运行最新版安装包，然后重试 Master。",
  agentUnavailable:
    "Desktop Agent 未运行。请启动或安装最新版 Desktop Agent，然后重新尝试 Master。",
  selfUpdateUnavailable:
    "当前 Desktop Agent 版本过旧，无法自更新。请下载并运行最新版安装包，然后重新尝试 Master。",
  hiddenAutomationExcel:
    "检测到隐藏的 Excel 自动化进程（{count} 个）。请在任务管理器中关闭它们，或重启 Windows 后再重试 Master。",
  excelComUnavailable:
    "Excel 自动化能力异常。如果 Master 仍无法打开，请关闭隐藏的 Excel 进程或修复 Office。",
  excelMissing:
    "未检测到 Microsoft Excel。请安装 Microsoft 365 或 Office 后再重试 Master。你仍然可以下载只读副本。",
  wordMissing:
    "未检测到 Microsoft Word。请安装 Microsoft 365 或 Office 后再重试 Master。你仍然可以下载只读副本。",
  powerPointMissing:
    "未检测到 Microsoft PowerPoint。请安装 Microsoft 365 或 Office 后再重试 Master。你仍然可以下载只读副本。",
  pdfEditorMissing:
    "未检测到受支持的 PDF 编辑器。请安装 Adobe Acrobat、PDF-XChange Editor、Foxit PDF Editor 或 PDF Master Editor 后再重试 Master。你仍然可以下载只读副本。",
  windowsInstallDescription:
    "已检测到 Windows。请安装最新版 Desktop Agent，然后重新尝试 Master。",
  macosInstallDescription:
    "已检测到 macOS。请安装最新版 Desktop Agent，然后重新尝试 Master。",
  genericInstallDescription:
    "请安装适用于当前系统的最新版 Desktop Agent，然后重新尝试 Master。",
  downloadWindows: "下载 Windows 版 Desktop Agent",
  downloadMacos: "下载 macOS 版 Desktop Agent",
  downloadGeneric: "下载 Desktop Agent",
  localMasterSessionNeedsAttention:
    "{count} local Master session needs attention. Check in, discard, or recover it before updating Desktop Agent.",
  localMasterSessionsNeedAttention:
    "{count} local Master sessions need attention. Check in, discard, or recover them before updating Desktop Agent.",
  currentStatus: "当前状态",
  nextStep: "下一步",
  diagnosticDetails: "诊断详情",
  statusUpdateReady: "可以更新",
  statusInstallRequired: "需要安装",
  statusAgentStartRequired: "Agent 未运行",
  statusActionRequired: "需要处理",
  statusUpdating: "正在更新",
  statusWaitingForAgent: "正在等待 Agent",
  nextStepReleaseAndUpdate: "释放本地 Master 锁，然后更新。",
  nextStepUpdate: "更新 Desktop Agent，然后自动重试 Master。",
  nextStepInstall: "下载并运行最新版安装包，然后重试 Master。",
  nextStepStart: "启动 Desktop Agent，然后自动重试 Master。",
  nextStepResolveLocks: "请先签入、放弃或恢复本地 Master 会话，然后再更新。",
  nextStepFixOffice: "请先安装或修复所需的本地编辑程序，然后重试 Master。",
  nextStepWait: "等待 Desktop Agent 完成；Master 会自动重试。",
  platformLabel: "平台",
  agentStateLabel: "Agent 状态",
  agentVersionLabel: "Agent 版本",
  selfUpdateLabel: "自更新",
  localMasterLocksLabel: "可自动释放的 Master 锁",
  localMasterAttentionLabel: "需要处理的锁",
  officeBlockerLabel: "Master 阻断项",
  launchFailureLabel: "启动失败原因",
  lastErrorLabel: "最后错误",
  platformWindows: "Windows",
  platformMacos: "macOS",
  platformUnknown: "未知",
  agentStateNotRunning: "未运行",
  agentStateLegacy: "已安装，需要手动更新",
  agentStateSelfUpdate: "已安装，支持自更新",
  yes: "是",
  no: "否",
  unknown: "未知",
};
const templateLibraryCopy = {
  label: "Use template",
  dialogTitle: "Use template",
  targetLabel: "Current folder",
  targetPlaceholder: "Select a folder",
  targetHelp: "Select a workpaper folder before importing a template.",
  currentLocation: "Current location",
  templatesTitle: "Templates",
  projectTemplatesTitle: "Project templates",
  smartFormTemplatesTitle: "Smart Forms",
  templateUnit: "template",
  templateUnitPlural: "templates",
  searchPlaceholder: "Search templates, subjects, or workpapers",
  searchLabel: "Search templates",
  loadingTemplates: "Loading templates...",
  noMatchingTemplates: "No matching templates",
  noTemplates: "No templates available",
  previewTitle: "Use preview",
  chooseTemplate: "Choose a template from the library",
  chooseTarget: "Choose a target workpaper folder",
  applyTo: "Import into",
  suggested: "Suggested",
  selectAllItems: "Select all template workpapers",
  selectTemplateItem: "Select {title}",
  total: "Total",
  newItems: "New",
  existing: "Existing",
  code: "Code",
  fileColumn: "File",
  recommendedFrameworkColumn: "Recommended standard",
  selectColumn: "Selected",
  commonFramework: "General",
  title: "Title",
  type: "Type",
  bucket: "Bucket",
  status: "Status",
  newStatus: "New",
  existingStatus: "Existing",
  notSelectedStatus: "Not selected",
  workpaperType: "Workpaper",
  supplementType: "Supplement",
  smartFormType: "Smart Form",
  loadingPreview: "Loading preview...",
  noMatchingTemplatesSentence: "No matching templates.",
  noTemplatesSentence: "No templates available.",
  alreadyAppliedHint:
    "This template has already been applied to the selected directory.",
  noSelectedItemsHint: "Select at least one template item.",
  cancel: "Cancel",
  apply: "Use",
  applying: "Creating...",
  alreadyApplied: "Already applied",
  referenceCodeImportTitle: "Confirm reference codes",
  referenceCodeImportDescription:
    "Review or edit the reference code for each selected item before importing.",
  referenceCode: "Reference code",
  importSelectedItems: "Import items",
  appliedTitle: "Template used",
  createdDescription: "Created {count} workpaper(s).",
  noNewDescription: "No new workpapers were needed.",
  itemUnit: "workpaper",
  itemUnitPlural: "workpapers",
  selectTemplate: "Select {name}",
  willInsert: "Will be inserted",
  viewTemplateFile: "View template workpaper",
  languageLabel: "Language",
  chineseLanguage: "Chinese",
  englishLanguage: "English",
};

describe("Workbench content interactions", () => {
  beforeEach(() => {
    setViewportWidth(1440);
    vi.spyOn(api, "previewAttachmentContent").mockResolvedValue(
      new Blob(["preview"])
    );
    vi.spyOn(api, "previewAttachmentPdf").mockResolvedValue(
      new Blob(["preview pdf"], { type: "application/pdf" })
    );
    vi.spyOn(api, "previewAttachmentRasterPdfManifest").mockResolvedValue({
      attachmentId: "attachment-preview",
      version: 1,
      pageCount: 1,
      pageWidth: 595,
      pageHeight: 842,
      dpi: 150,
      mimeType: "image/png",
    });
    vi.spyOn(api, "previewAttachmentRasterPdfPage").mockResolvedValue(
      new Blob(["page"], { type: "image/png" })
    );
    vi.spyOn(api, "previewAttachment").mockImplementation(
      (_projectId, attachmentId, input) =>
        Promise.resolve({
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
        })
    );
    vi.spyOn(desktopAgent, "getDesktopAgentReleaseManifest").mockResolvedValue({
      version: "0.2.1",
      platform: "windows",
      architecture: "x64",
      downloadUrl:
        "http://localhost:3000/downloads/desktop-agent/windows/releases/0.2.1",
      sha256: "a".repeat(64),
      fileSize: 123_456,
      publishedAt: "2026-07-27T12:00:00.000Z",
      minimumSupportedVersion: "0.2.0",
      minimumSelfUpdateVersion: "0.1.10",
      signaturePolicy: "optional",
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    mockSearchParams = new URLSearchParams();
    window.localStorage.clear();
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  function mockProjectFileTableContainerWidth(width: number) {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
      width
    );
  }

  function setViewportWidth(width: number) {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: width,
    });
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

  function makeDesktopAgentSession(
    input: Partial<DesktopAgentSession> = {}
  ): DesktopAgentSession {
    const lifecycleState =
      input.lifecycleState ??
      (input.status === "CLOSED"
        ? "CLOSED"
        : input.status === "CHECKIN_FAILED"
          ? "CHECKIN_FAILED"
          : "OPEN");
    const contentState =
      input.contentState ??
      (input.status === "DIRTY_PENDING_CHECKIN" ||
      input.status === "CHECKIN_FAILED"
        ? "DIRTY"
        : "UNCHANGED");
    const status =
      input.status ??
      getDesktopAgentCompatibilityStatus({ lifecycleState, contentState });

    return {
      sessionId: "session-1",
      generation: 1,
      lockSessionId: "lock-session-1",
      mode: "MASTER",
      projectId: "project-1",
      attachmentId: "attachment-selected-current",
      fileName: "selected-current.pdf",
      localPath:
        "C:\\Users\\User\\AppData\\Local\\ProjectWing\\AgentCache\\selected-current.pdf",
      originalHash: "hash-1",
      lastKnownHash: contentState === "DIRTY" ? "hash-2" : "hash-1",
      grantSecret: "grant-secret",
      openSignalToken: "open-token-1",
      closeSignalToken: "close-token-1",
      status,
      lifecycleState,
      contentState,
      openedAt: "2026-06-05T02:00:00.000Z",
      launchStartedAt: "2026-06-05T02:00:00.000Z",
      openObservedAt:
        lifecycleState === "OPEN" ? "2026-06-05T02:01:00.000Z" : undefined,
      openObservedSource: lifecycleState === "OPEN" ? "WATCHER_COM" : undefined,
      lastSeenAt: "2026-06-05T02:05:00.000Z",
      retryCount: 0,
      ...input,
    };
  }

  function assertExtendedPreviewRequest(fileName: string) {
    expect(api.previewAttachmentContent).toHaveBeenCalledWith(
      "project-1",
      `attachment-${fileName}`,
      1
    );
  }

  function assertSpreadsheetPreviewRequest(fileName: string) {
    expect(api.previewAttachment).toHaveBeenCalledWith(
      "project-1",
      `attachment-${fileName}`,
      expect.objectContaining({
        limit: 200,
        columnLimit: 30,
      })
    );
  }

  function assertSpreadsheetPreviewLayout() {
    const spreadsheetCell = screen.getByText("Cell A1");
    expect(spreadsheetCell.closest(".extend-viewer-surface")).toBeTruthy();
    const downloadButton = screen.getByRole("button", {
      name: "Download",
    });
    const openInNewWindowButton = screen.getByRole("button", {
      name: "Open in new window",
    });
    expect(
      downloadButton.compareDocumentPosition(openInNewWindowButton) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      screen.queryByRole("tab", { name: "Sheet1" })
    ).not.toBeInTheDocument();
  }

  describe(WorkbenchContent, () => {
    it("opens mobile file actions in a sheet and keeps rename navigation and preview", async () => {
      vi.stubGlobal("matchMedia", () => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        makeProjectAttachment({
          id: "sheet-file",
          originalName: "sheet-file.pdf",
        }),
      ]);
      const onPreviewFile = vi.fn();
      renderContent({ selectedNode: thirdLevelNodeWithFile, onPreviewFile });
      const trigger = await screen.findByRole("button", {
        name: /File actions:.*sheet/i,
      });
      fireEvent.click(trigger);
      const sheet = await screen.findByRole("dialog", { name: /sheet.*file/i });
      expect(
        within(sheet).getByRole("button", { name: "Preview", exact: true })
      ).toBeVisible();
      fireEvent.click(
        within(sheet).getByRole("button", { name: "Rename", exact: true })
      );
      expect(within(sheet).getByRole("textbox")).toBeVisible();
      fireEvent.click(
        within(sheet).getByRole("button", { name: "Close", exact: true })
      );
      await waitFor(() =>
        expect(
          screen.queryByRole("dialog", { name: /sheet.*file/i })
        ).toBeNull()
      );
      fireEvent.click(trigger);
      const reopened = await screen.findByRole("dialog", {
        name: /sheet.*file/i,
      });
      fireEvent.click(
        within(reopened).getByRole("button", { name: "Preview", exact: true })
      );
      expect(onPreviewFile).toHaveBeenCalledWith("sheet-file");
      await waitFor(() =>
        expect(
          screen.queryByRole("dialog", { name: /sheet.*file/i })
        ).toBeNull()
      );
    });

    it("searches mobile files by name or reference and removes advanced sorting", async () => {
      vi.stubGlobal("matchMedia", () => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        {
          ...makeProjectAttachment({
            id: "find-cash",
            originalName: "cash-report.pdf",
          }),
          code: "BANK-101",
        },
        {
          ...makeProjectAttachment({
            id: "find-tax",
            originalName: "tax-report.pdf",
          }),
          code: "TAX-202",
        },
      ]);
      renderContent({ selectedNode: thirdLevelNodeWithFile });
      const search = await screen.findByRole("searchbox", {
        name: "Search files or reference",
      });
      await screen.findByRole("link", { name: /cash.*report/ });
      fireEvent.change(search, { target: { value: "CASH" } });
      expect(screen.getByRole("link", { name: /cash.*report/ })).toBeVisible();
      expect(screen.queryByRole("link", { name: /tax.*report/ })).toBeNull();
      fireEvent.change(search, { target: { value: "TAX-202" } });
      expect(screen.getByRole("link", { name: /tax.*report/ })).toBeVisible();
      expect(screen.queryByRole("link", { name: /cash.*report/ })).toBeNull();
      fireEvent.change(search, { target: { value: "no-match" } });
      expect(screen.getByText("No matching files")).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
      expect(screen.getByRole("link", { name: /cash.*report/ })).toBeVisible();
      const more = screen.getByRole("button", { name: "List actions" });
      expect(more).toHaveTextContent("");
      fireEvent.click(more);
      const sheet = await screen.findByRole("dialog", { name: "List actions" });
      expect(
        within(sheet).queryByRole("region", { name: "Sort and filter" })
      ).toBeNull();
    });

    it.each([true, false])(
      "shows mobile lock details without guessing the holder (known: %s)",
      async (known) => {
        vi.stubGlobal("matchMedia", () => ({
          matches: true,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }));
        vi.spyOn(api, "projectAttachments").mockResolvedValue([
          {
            ...makeProjectAttachment({
              id: "mobile-locked",
              originalName: "locked-file.pdf",
            }),
            lockedBy: "locker",
            lockedAt: "2026-06-01T08:30:00.000Z",
            lockHolder: known
              ? {
                  id: "locker",
                  name: "Actual Locker",
                  email: "locker@example.test",
                }
              : null,
            uploader: {
              id: "uploader",
              name: "Not The Locker",
              email: "uploader@example.test",
            },
          },
        ]);
        renderContent({ selectedNode: thirdLevelNodeWithFile });
        const trigger = await screen.findByRole("button", {
          name: /File occupancy:.*locked/i,
        });
        expect(trigger).toHaveTextContent("");
        fireEvent.click(trigger);
        const sheet = await screen.findByRole("dialog", {
          name: "File occupancy",
        });
        expect(
          within(sheet).getByText(known ? "Actual Locker" : "Unknown holder")
        ).toBeVisible();
        expect(within(sheet).queryByText("Not The Locker")).toBeNull();
        expect(
          within(sheet).getByText("Occupied by another member")
        ).toBeVisible();
        fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));
        await waitFor(() =>
          expect(
            screen.queryByRole("dialog", { name: "File occupancy" })
          ).toBeNull()
        );
      }
    );

    it("keeps mobile P and R separately permission-gated in the same signer row", async () => {
      vi.stubGlobal("matchMedia", () => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        makeProjectAttachment({
          id: "signoff-mobile",
          originalName: "signoff-layout.pdf",
        }),
      ]);
      renderContent({ selectedNode: thirdLevelNodeWithFile });
      const link = await screen.findByRole("link", { name: /signoff.*layout/ });
      const row = requireElement(link.closest("article"));
      const prepare = within(row).getByRole("button", {
        name: /add preparation signoff/i,
      });
      const review = within(row).getByRole("button", {
        name: /add review signoff/i,
      });
      const prepareGroup = requireElement(prepare.parentElement);
      const reviewGroup = requireElement(review.parentElement);
      expect(prepareGroup.parentElement).toBe(reviewGroup.parentElement);
      expect(
        within(row).getAllByRole("button", { name: /add .* signoff/i })
      ).toStrictEqual([prepare, review]);
      expect(prepare).toBeEnabled();
      expect(review).toBeDisabled();
      expect(
        within(row).queryByRole("button", { name: /File occupancy:/ })
      ).toBeNull();
      // Optional component fixture for real-browser geometry checks. Only
      // synthetic rendered data and the actual built CSS are written; no API
      // calls, app server or browser session credentials are involved.
      if (process.env.PW_CAPTURE_SIGNOFF_FIXTURE === "1") {
        const chunks = path.resolve(
          import.meta.dirname,
          "../../.next-walkthrough/static/chunks"
        );
        const css = readdirSync(chunks)
          .filter((file) => file.endsWith(".css"))
          .map((file) => readFileSync(path.join(chunks, file), "utf-8"))
          .find((source) => source.includes(".emp-mobile-file-signoffs"));
        if (!css) {
          throw new Error("Build EMP before capturing the signoff fixture");
        }
        const output = path.resolve(
          import.meta.dirname,
          "../../../../output/playwright"
        );
        mkdirSync(output, { recursive: true });
        writeFileSync(
          path.join(output, "signoff-component.html"),
          `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Signoff component regression fixture</title><style>${css}</style></head><body><main class="p-4">${row.outerHTML}</main></body></html>`
        );
      }
    });

    it("uses the mobile file list and preserves preview and list-operation entry points", async () => {
      vi.stubGlobal("matchMedia", () => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        makeProjectAttachment({
          id: "attachment-mobile",
          originalName: "mobile-check.pdf",
        }),
      ]);
      const onPreviewFile = vi.fn();
      renderContent({ selectedNode: thirdLevelNodeWithFile, onPreviewFile });
      const link = await screen.findByRole("link", { name: /mobile.*check/ });
      expect(screen.queryByRole("table")).toBeNull();
      const fileRow = link.closest("article");
      if (!fileRow) {
        throw new Error("Missing mobile file row");
      }
      expect(fileRow.querySelector(".pw-mobile-chevron")).toBeNull();
      expect(
        fileRow.querySelector(
          ".emp-mobile-file-metadata .emp-mobile-file-reference"
        )
      ).toHaveTextContent("F001");
      expect(
        within(fileRow).getByRole("button", { name: /notes for .*mobile/i })
      ).toBeInTheDocument();
      expect(
        within(fileRow).getByRole("button", {
          name: /add preparation signoff/i,
        })
      ).toBeEnabled();
      expect(
        within(fileRow).getByRole("button", { name: /add review signoff/i })
      ).toBeDisabled();
      fireEvent.click(link);
      expect(onPreviewFile).toHaveBeenCalledExactlyOnceWith(
        "attachment-mobile"
      );
      fireEvent.click(screen.getByRole("button", { name: "List actions" }));
      const dialog = await screen.findByRole("dialog", {
        name: "List actions",
      });
      expect(within(dialog).getByRole("tablist")).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
      await waitFor(() =>
        expect(
          screen.queryByRole("dialog", { name: "List actions" })
        ).toBeNull()
      );
      fireEvent.click(
        screen.getByRole("button", { name: /notes for .*mobile/i })
      );
      await expect(screen.findByRole("dialog")).resolves.toBeInTheDocument();
    });

    it("keeps mobile list tools connected to upload buckets and information visibility", async () => {
      vi.stubGlobal("matchMedia", () => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        makeProjectAttachment({
          id: "mobile-tools-file",
          originalName: "tools.pdf",
        }),
      ]);
      const uploadFilesToNode = vi.fn();
      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        uploadFilesToNode,
      });
      await screen.findByRole("link", { name: /tools.pdf/ });
      fireEvent.click(screen.getByRole("button", { name: "List actions" }));
      const dialog = await screen.findByRole("dialog", {
        name: "List actions",
      });
      expect(
        within(dialog).getByRole("button", { name: "Create and paste" })
      ).toBeVisible();
      expect(within(dialog).queryByText("Sort and filter")).toBeNull();
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Show information" })
      );
      const notes = await screen.findByRole("menuitemcheckbox", {
        name: "Note",
      });
      await userEvent.click(notes);
      expect(notes).toHaveAttribute("aria-checked", "false");
      await waitFor(() =>
        expect(
          document.querySelector(
            '.emp-mobile-file-cell[data-file-column="notes"]'
          )
        ).toBeNull()
      );
      expect(
        JSON.parse(
          window.localStorage.getItem(
            "project-wing-project-file-columns:project-1"
          ) ?? "{}"
        )
      ).toMatchObject({ notes: false });
      fireEvent.click(screen.getByRole("menuitem", { name: "Show all" }));
      await waitFor(() =>
        expect(
          document.querySelector(
            '.emp-mobile-file-cell[data-file-column="notes"]'
          )
        ).not.toBeNull()
      );
      if (screen.queryByRole("menuitemcheckbox", { name: "Note" })) {
        fireEvent.keyDown(document.activeElement ?? document.body, {
          key: "Escape",
        });
      }
      fireEvent.click(within(dialog).getByRole("tab", { name: "Prior" }));
      expect(
        within(dialog).getByRole("tab", { name: "Prior" })
      ).toHaveAttribute("aria-selected", "true");
      const file = new File(["evidence"], "prior.pdf", {
        type: "application/pdf",
      });
      fireEvent.change(
        within(dialog).getByLabelText("Upload", { selector: "input" }),
        { target: { files: [file] } }
      );
      expect(uploadFilesToNode).toHaveBeenCalledExactlyOnceWith(
        [file],
        "PRIOR"
      );
    });

    it("preserves mobile file order when searching without advanced sort controls", async () => {
      vi.stubGlobal("matchMedia", () => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        makeProjectAttachment({
          id: "zeta-mobile",
          originalName: "Zeta.pdf",
          workingPaper: {
            ...selectedWorkingPaperLocation,
            id: "zeta-paper",
            code: "A01-F002",
            title: "Zeta.pdf",
          },
        }),
        makeProjectAttachment({
          id: "alpha-mobile",
          originalName: "Alpha.pdf",
          workingPaper: {
            ...selectedWorkingPaperLocation,
            id: "alpha-paper",
            code: "A01-F001",
            title: "Alpha.pdf",
          },
        }),
        makeProjectAttachment({
          id: "beta-mobile",
          originalName: "Beta.pdf",
          workingPaper: {
            ...selectedWorkingPaperLocation,
            id: "beta-paper",
            code: "A01-F003",
            title: "Beta.pdf",
          },
        }),
      ]);
      renderContent({ selectedNode: thirdLevelNodeWithFile });
      await screen.findByRole("link", { name: /Zeta.pdf/ });
      const names = () =>
        [
          ...document.querySelectorAll(
            ".emp-mobile-file-row .pw-mobile-list-copy strong"
          ),
        ].map((el) => el.textContent);
      expect(names()).toStrictEqual(["Zeta.pdf", "Alpha.pdf", "Beta.pdf"]);
      fireEvent.click(screen.getByRole("button", { name: "List actions" }));
      const dialog = await screen.findByRole("dialog", {
        name: "List actions",
      });
      expect(
        within(dialog).queryByRole("button", { name: "File", exact: true })
      ).toBeNull();
      expect(
        within(dialog).queryByRole("button", { name: "Ref", exact: true })
      ).toBeNull();
      fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
      await waitFor(() =>
        expect(
          screen.queryByRole("dialog", { name: "List actions" })
        ).toBeNull()
      );
      const search = screen.getByRole("searchbox", {
        name: "Search files or reference",
      });
      fireEvent.change(search, { target: { value: "Alpha" } });
      expect(names()).toStrictEqual(["Alpha.pdf"]);
      fireEvent.change(search, { target: { value: "" } });
      expect(names()).toStrictEqual(["Zeta.pdf", "Alpha.pdf", "Beta.pdf"]);
    });

    it("keeps recycle bin rows focused on restore-relevant details", () => {
      render(
        createElement(AttachmentRecycleBinPanel, {
          attachments: [
            {
              id: "deleted-attachment-1",
              workingPaperId: null,
              fileKind: "SPREADSHEET",
              fileName: "stored.xlsx",
              originalName: "銆愮鐩綑棰濊〃銆?02605.xlsx",
              fileUrl: "working-papers/project-1/stored.xlsx",
              fileSize: 48_333,
              mimeType:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              version: 2,
              deletedAt: "2026-06-05T07:13:00.000Z",
              deletedBy: "user-1",
              deletedByUser: {
                id: "user-1",
                name: "Preparer",
                email: "preparer@projectwing.local",
              },
              deletedFromWorkingPaperId: "missing-paper",
              deletedFromWorkingPaperCode: "A01-0003-F001",
              deletedFromWorkingPaperTitle: "銆愮鐩綑棰濊〃銆?02605.xlsx",
              lastModifiedAt: "2026-06-05T07:09:00.000Z",
              lastModifier: {
                id: "modifier-1",
                name: "Modifier",
                email: "modifier@projectwing.local",
              },
            },
          ],
          loading: false,
          pending: false,
          restoreTargetNodes: [thirdLevelNode],
          restoreAttachment: vi.fn(),
        })
      );

      const row = screen.getByTestId("recycle-bin-row-deleted-attachment-1");
      expect(
        within(row).getByText("銆愮鐩綑棰濊〃銆?02605.xlsx")
      ).toBeTruthy();
      expect(within(row).getByText(/06\/05 \d{2}:13/)).toBeTruthy();
      expect(within(row).getAllByText(/A01-0003-F001/).length).toBeGreaterThan(
        0
      );
    });

    it("opens a full recycle bin dialog with deleted file paths", async () => {
      const recycleBinPathNodes: WorkflowNode[] = [
        {
          id: "phase-1",
          parentId: null,
          code: "Execution",
          title: "Execution",
          level: 1,
          nodeType: "PHASE",
          workingPapers: [],
          children: [
            {
              id: "account-1",
              parentId: "phase-1",
              code: "A01",
              title: "Assets",
              level: 2,
              nodeType: "ACCOUNT",
              workingPapers: [],
              children: [thirdLevelNodeWithFile],
            },
          ],
        },
      ];

      render(
        createElement(AttachmentRecycleBinPanel, {
          attachments: [
            {
              id: "deleted-attachment-1",
              workingPaperId: null,
              fileKind: "SPREADSHEET",
              fileName: "stored.xlsx",
              originalName: "cash.xlsx",
              fileUrl: "working-papers/project-1/stored.xlsx",
              fileSize: 48_333,
              mimeType:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              version: 2,
              deletedAt: "2026-06-05T07:13:00.000Z",
              deletedBy: "user-1",
              deletedFromWorkingPaperId: "working-paper-1",
              deletedFromWorkingPaperCode: "A01-0001-F001",
              deletedFromWorkingPaperTitle: "Cash",
            },
            {
              id: "deleted-attachment-2",
              workingPaperId: null,
              fileKind: "SUPPORTING",
              fileName: "stored.docx",
              originalName: "memo.docx",
              fileUrl: "working-papers/project-1/stored.docx",
              fileSize: 12_000,
              mimeType:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              version: 1,
              deletedAt: "2026-06-05T08:13:00.000Z",
              deletedBy: "user-1",
              deletedFromWorkingPaperId: "missing-paper",
              deletedFromWorkingPaperCode: "B01-F001",
              deletedFromWorkingPaperTitle: "Memo",
            },
          ],
          loading: false,
          pending: false,
          restoreTargetNodes: [thirdLevelNode],
          pathNodes: recycleBinPathNodes,
          restoreAttachment: vi.fn(),
        })
      );

      fireEvent.click(screen.getByRole("button", { name: "Manage" }));

      const dialog = screen.getByRole("dialog", { name: "Recycle bin" });
      expect(within(dialog).getByText("cash.xlsx")).toBeTruthy();
      expect(within(dialog).getAllByText(/Deleted from/)).toHaveLength(2);
      expect(within(dialog).getAllByText(/Execution/).length).toBeGreaterThan(
        0
      );
      expect(
        within(dialog).getAllByText("Execution / A01 / A01-0001").length
      ).toBeGreaterThan(0);
      expect(within(dialog).getByText(/B01-F001/)).toBeTruthy();

      const searchInput = within(dialog).getByLabelText("Search recycle bin");
      fireEvent.change(searchInput, { target: { value: "memo" } });
      expect(within(dialog).queryByText("cash.xlsx")).toBeNull();
      expect(within(dialog).getByText("memo.docx")).toBeTruthy();
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Clear recycle bin search" })
      );
      expect(within(dialog).getByText("cash.xlsx")).toBeTruthy();

      const firstRow = screen.getByTestId(
        "recycle-bin-dialog-row-deleted-attachment-1"
      );
      const restoreTargetLabel = "Restore target for cash.xlsx";
      await chooseSelectOption(
        firstRow,
        restoreTargetLabel,
        "Execution · Execution"
      );
      expect(
        within(firstRow).getAllByText("Restore to").length
      ).toBeGreaterThan(0);
      expect(within(firstRow).getAllByText(/Execution/).length).toBeGreaterThan(
        0
      );
      expect(
        within(firstRow).getByRole("combobox", { name: restoreTargetLabel })
      ).toBeTruthy();

      await chooseSelectOption(firstRow, restoreTargetLabel, "A01 · Assets");
      expect(within(firstRow).getByText("Execution / A01")).toBeTruthy();
      fireEvent.click(
        within(firstRow).getByRole("combobox", { name: restoreTargetLabel })
      );
      await expect(
        screen.findByRole("option", { name: /A01-0001/ })
      ).resolves.toBeTruthy();
    }, 15_000);

    it("prompts the user to select a workpaper when no node is selected", () => {
      renderContent();

      expect(screen.getByText("Select a workpaper or file")).toBeTruthy();
      expect(
        document.querySelector('[data-slot="project-wing-dev-logo"]')
      ).toBeTruthy();
    });

    it("uses provided English copy when no node is selected", () => {
      renderContent({
        copy: {
          selectPromptTitle: "Select a workpaper or file",
          selectPromptDescription:
            "The project structure starts collapsed. Expand groups and select a workpaper to upload files or open existing files.",
        },
      });

      expect(screen.getByText("Select a workpaper or file")).toBeTruthy();
      expect(
        screen.getByText(
          "The project structure starts collapsed. Expand groups and select a workpaper to upload files or open existing files."
        )
      ).toBeTruthy();
    });

    it("navigates to an ancestor when its breadcrumb is clicked", () => {
      const onSelectPathNode = vi.fn();
      const selectedPath = [
        { nodeId: "planning", label: "1000 - Planning" },
        { nodeId: "planning-stage", label: "1100 - Planning stage" },
        { nodeId: "cycle", label: "1110 - Understanding the cycle" },
        { nodeId: "ppe", label: "1111 - PPE" },
      ];

      renderContent({
        selectedNode: thirdLevelNode,
        selectedPath,
        onSelectPathNode,
      });

      fireEvent.click(
        screen.getByRole("button", { name: "1100 - Planning stage" })
      );

      expect(onSelectPathNode).toHaveBeenCalledWith("planning-stage");
      expect(screen.queryByRole("menu")).toBeNull();
      expect(screen.getByText("1111 - PPE")).toHaveAttribute(
        "aria-current",
        "page"
      );
    });

    it("shows a file area for a selected directory", async () => {
      vi.spyOn(api, "projectAttachments").mockResolvedValue([]);
      mockProjectFileTableContainerWidth(1200);

      const { container: _container } = renderContent({
        selectedNode: thirdLevelNode,
        selectedPath: breadcrumbPath("A - Planning", "A1"),
      });
      const emptyTray = await screen.findByTestId("project-file-empty-tray");
      const fileArea = screen.getByRole("region", { name: "Project files" });
      const projectFileTable = within(fileArea).getByRole(
        "table"
      ) as HTMLTableElement;
      await waitFor(() => {
        expect(projectFileTable).toHaveStyle({
          width: "calc(1200px + var(--data-grid-fill-size, 0px))",
        });
      });
      const _tableHeaderRow = projectFileTable.tHead?.querySelector("tr");
      const fileBucketTabs = screen.getByRole("tablist");
      const _fileSectionHeader = fileBucketTabs.closest(
        '[data-testid="workbench-file-section-header"]'
      );
      expect(within(fileBucketTabs).getAllByRole("separator")).toHaveLength(2);
      expect(
        screen
          .getByTestId("workbench-selected-path")
          .querySelector('[data-slot="breadcrumb"]')
      ).toBeTruthy();
      const _heroIcon = within(emptyTray).getByTestId(
        "project-file-empty-hero-icon"
      );
      expect(
        within(fileArea).getByRole("columnheader", { name: "Ref" })
      ).toBeTruthy();
    });

    it("customizes and persists optional project file columns per project", async () => {
      vi.spyOn(api, "projectAttachments").mockResolvedValue([]);
      mockProjectFileTableContainerWidth(1200);

      renderContent({
        projectId: "project-column-a",
        selectedNode: thirdLevelNode,
      });

      const fileArea = await screen.findByRole("region", {
        name: "Project files",
      });
      await screen.findByTestId("project-file-empty-tray");
      const columnButton = screen.getByRole("button", { name: "Columns" });
      const bucketTabs = screen.getByRole("tablist");
      expect(
        columnButton.compareDocumentPosition(bucketTabs) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(
        within(fileArea).getByRole("columnheader", { name: "Status" })
      ).toBeTruthy();

      fireEvent.click(columnButton);
      const statusColumn = await screen.findByRole("menuitemcheckbox", {
        name: "Status",
      });
      expect(statusColumn).toHaveAttribute("aria-checked", "true");
      expect(
        screen.getByRole("menuitemcheckbox", { name: "Note" })
      ).toBeTruthy();
      expect(
        screen.getByRole("menuitemcheckbox", { name: "Sign-offs" })
      ).toBeTruthy();
      expect(
        screen.queryByRole("menuitemcheckbox", { name: "Ref" })
      ).toBeNull();
      expect(
        screen.queryByRole("menuitemcheckbox", { name: "File" })
      ).toBeNull();

      fireEvent.click(statusColumn);

      await waitFor(() => {
        expect(
          within(fileArea).queryByRole("columnheader", { name: "Status" })
        ).toBeNull();
      });
      fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Note" }));
      fireEvent.click(
        screen.getByRole("menuitemcheckbox", { name: "Sign-offs" })
      );
      await waitFor(() => {
        expect(
          within(fileArea).queryByRole("columnheader", { name: "Note" })
        ).toBeNull();
        expect(
          within(fileArea).queryByRole("columnheader", { name: "Sign-offs" })
        ).toBeNull();
      });
      expect(
        JSON.parse(
          window.localStorage.getItem(
            "project-wing-project-file-columns:project-column-a"
          ) ?? "{}"
        )
      ).toMatchObject({ status: false, notes: false, signoffs: false });

      fireEvent.click(screen.getByRole("menuitem", { name: "Show all" }));

      await waitFor(() => {
        expect(
          within(fileArea).getByRole("columnheader", { name: "Status" })
        ).toBeTruthy();
        expect(
          within(fileArea).getByRole("columnheader", { name: "Note" })
        ).toBeTruthy();
        expect(
          within(fileArea).getByRole("columnheader", { name: "Sign-offs" })
        ).toBeTruthy();
      });
      expect(
        window.localStorage.getItem(
          "project-wing-project-file-columns:project-column-a"
        )
      ).toBeNull();
    });

    it("restores project-specific file column visibility without leaking it", async () => {
      vi.spyOn(api, "projectAttachments").mockResolvedValue([]);
      mockProjectFileTableContainerWidth(1200);
      window.localStorage.setItem(
        "project-wing-project-file-columns:project-column-a",
        JSON.stringify({ status: false, notes: true, signoffs: true })
      );

      renderContent({
        projectId: "project-column-a",
        selectedNode: thirdLevelNode,
      });

      const firstFileArea = await screen.findByRole("region", {
        name: "Project files",
      });
      await screen.findByTestId("project-file-empty-tray");
      await waitFor(() => {});
      expect(
        within(firstFileArea).getByRole("columnheader", { name: "Ref" })
      ).toBeTruthy();
      expect(
        within(firstFileArea).getByRole("columnheader", { name: "File" })
      ).toBeTruthy();

      cleanup();
      renderContent({
        projectId: "project-column-b",
        selectedNode: thirdLevelNode,
      });

      const secondFileArea = await screen.findByRole("region", {
        name: "Project files",
      });
      await screen.findByTestId("project-file-empty-tray");
      expect(
        within(secondFileArea).getByRole("columnheader", { name: "Status" })
      ).toBeTruthy();
    });

    it("falls back to all file columns when the saved preference is damaged", async () => {
      vi.spyOn(api, "projectAttachments").mockResolvedValue([]);
      mockProjectFileTableContainerWidth(1200);
      window.localStorage.setItem(
        "project-wing-project-file-columns:project-column-damaged",
        "{not-json"
      );

      renderContent({
        projectId: "project-column-damaged",
        selectedNode: thirdLevelNode,
      });

      const fileArea = await screen.findByRole("region", {
        name: "Project files",
      });
      await screen.findByTestId("project-file-empty-tray");
      for (const columnName of ["Status", "Note", "Sign-offs"]) {
        expect(
          within(fileArea).getByRole("columnheader", { name: columnName })
        ).toBeTruthy();
      }
    });

    it("uses the header upload action for an empty current workpaper tray", async () => {
      vi.spyOn(api, "projectAttachments").mockResolvedValue([]);
      mockProjectFileTableContainerWidth(1200);
      const uploadFilesToNode = vi.fn();

      renderContent({
        selectedNode: thirdLevelNode,
        uploadFilesToNode,
      });

      const emptyTray = await screen.findByTestId("project-file-empty-tray");
      expect(
        within(emptyTray).queryByRole("button", { name: "Choose file" })
      ).toBeNull();
      const header = screen.getByTestId("workbench-file-section-header");
      const fileInput = within(header).getByLabelText("Upload");
      expect(fileInput).toHaveAttribute("data-slot", "input");
      expect(fileInput).toHaveClass("hidden");
      const file = new File(["support"], "support.pdf", {
        type: "application/pdf",
      });
      fireEvent.change(fileInput as HTMLInputElement, {
        target: { files: [file] },
      });

      expect(uploadFilesToNode).toHaveBeenCalledWith([file], "CURRENT");
    });

    it("places bulk upload between the breadcrumb and bucket tabs", async () => {
      vi.spyOn(api, "projectAttachments").mockResolvedValue([]);
      mockProjectFileTableContainerWidth(1200);
      const uploadFilesToNode = vi.fn();

      renderContent({
        selectedNode: thirdLevelNode,
        uploadFilesToNode,
      });

      await screen.findByTestId("project-file-empty-tray");
      const header = screen.getByTestId("workbench-file-section-header");
      const selectedPath = screen.getByTestId("workbench-selected-path");
      const actions = screen.getByTestId("workbench-bulk-file-actions");
      const bucketTabs = screen.getByRole("tablist");
      const uploadButton = within(actions).getByRole("button", {
        name: "Upload",
      });
      const columnButton = within(header).getByRole("button", {
        name: "Columns",
      });
      const fileColumnHeader = screen.getByRole("columnheader", {
        name: "File",
      });

      expect(header).toHaveClass("grid-cols-[minmax(0,1fr)_auto]");
      expect(selectedPath.compareDocumentPosition(actions)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
      expect(actions.compareDocumentPosition(bucketTabs)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
      expect(actions.compareDocumentPosition(columnButton)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
      expect(columnButton.compareDocumentPosition(bucketTabs)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
      expect(uploadButton.querySelector("svg")).toBeTruthy();
      expect(uploadButton).toHaveClass(
        "bg-primary",
        "text-primary-foreground",
        "cursor-pointer",
        "h-6.5",
        "gap-1",
        "px-2",
        "text-[0.7rem]!",
        "font-medium!",
        "[&_svg]:size-3",
        "[&_svg]:stroke-[1.75]"
      );
      expect(columnButton).toHaveClass(
        "bg-card",
        "cursor-pointer",
        "size-6.5",
        "rounded-full",
        "px-0",
        "font-medium!",
        "[&_svg]:size-3",
        "[&_svg]:stroke-[1.75]"
      );
      expect(columnButton).not.toHaveClass("bg-primary");
      expect(columnButton.querySelector("svg")).toHaveClass(
        "lucide-list-filter"
      );
      expect(columnButton).toHaveTextContent("");
      expect(
        within(fileColumnHeader).queryByRole("button", { name: "Choose file" })
      ).toBeNull();

      const file = new File(["support"], "support.pdf", {
        type: "application/pdf",
      });
      const headerInput = within(header).getByLabelText("Upload");
      fireEvent.change(headerInput, { target: { files: [file] } });

      expect(uploadFilesToNode).toHaveBeenCalledWith([file], "CURRENT");
    });

    it("collapses intermediate breadcrumb segments when the path is too wide", async () => {
      const clientWidthSpy = vi
        .spyOn(HTMLElement.prototype, "clientWidth", "get")
        .mockReturnValue(96);
      const scrollWidthSpy = vi
        .spyOn(HTMLSpanElement.prototype, "scrollWidth", "get")
        .mockImplementation(function scrollWidthSpy(this: HTMLElement) {
          if (this.textContent?.includes("Audit › … › A1")) {
            return 80;
          }
          if (this.textContent?.includes("… › A1")) {
            return 40;
          }
          return 480;
        });

      try {
        renderContent({
          selectedNode: thirdLevelNode,
          selectedPath: breadcrumbPath(
            "Audit",
            "Planning",
            "Sampling",
            "Client acceptance",
            "A1"
          ),
        });

        await waitFor(() => {
          expect(
            screen
              .getByTestId("workbench-selected-path")
              .querySelector('[data-slot="breadcrumb-ellipsis"]')
          ).toBeTruthy();
        });

        fireEvent.click(
          screen.getByRole("button", { name: "Show hidden path" })
        );

        const hiddenPathMenu = await screen.findByRole("menu");
        expect(
          within(hiddenPathMenu).getByRole("menuitem", { name: "Planning" })
        ).toBeTruthy();
        expect(
          within(hiddenPathMenu).getByRole("menuitem", {
            name: "Client acceptance",
          })
        ).toBeTruthy();
      } finally {
        clientWidthSpy.mockRestore();
        scrollWidthSpy.mockRestore();
      }
    });

    it("uploads files dropped onto the empty current workpaper tray", async () => {
      vi.spyOn(api, "projectAttachments").mockResolvedValue([]);
      mockProjectFileTableContainerWidth(1200);
      const uploadFilesToNode = vi.fn();

      renderContent({
        selectedNode: thirdLevelNode,
        uploadFilesToNode,
      });

      const emptyTray = await screen.findByTestId("project-file-empty-tray");
      const file = new File(["support"], "support.pdf", {
        type: "application/pdf",
      });

      fireEvent.drop(emptyTray, {
        dataTransfer: {
          files: [file],
        },
      });

      expect(uploadFilesToNode).toHaveBeenCalledWith([file], "CURRENT");
    });

    it("uploads local files dropped onto populated file-list blank space", async () => {
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        makeProjectAttachment({
          id: "attachment-blank-drop-current",
          originalName: "existing-current.pdf",
        }),
      ]);
      const uploadFilesToNode = vi.fn();

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        uploadFilesToNode,
      });

      await screen.findByText(/existing\s+-\s+current\.pdf/);
      const blankDropZone = screen.getByTestId(
        "project-file-blank-context-target"
      );
      const file = new File(["support"], "dropped-support.pdf", {
        type: "application/pdf",
      });
      const dataTransfer = {
        dropEffect: "none",
        files: [file],
        types: ["Files"],
      };

      expect(blankDropZone).toHaveAttribute("data-dnd-droppable", "true");
      fireEvent.dragEnter(blankDropZone, { dataTransfer });
      expect(blankDropZone).toHaveAttribute("data-native-file-over", "true");
      expect(blankDropZone).toHaveClass("bg-primary/[0.04]", "ring-primary/30");

      fireEvent.drop(blankDropZone, { dataTransfer });

      expect(blankDropZone).not.toHaveAttribute("data-native-file-over");
      expect(uploadFilesToNode).toHaveBeenCalledWith([file], "CURRENT");
    });

    it("opens the shared upload picker only from the blank-space context menu", async () => {
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        makeProjectAttachment({
          id: "attachment-blank-upload-current",
          originalName: "existing-current.pdf",
        }),
      ]);

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        uploadFilesToNode: vi.fn(),
      });

      await screen.findByText(/existing\s+-\s+current\.pdf/);
      const header = screen.getByTestId("workbench-file-section-header");
      const fileInput = within(header).getByLabelText("Upload");
      const inputClick = vi.spyOn(fileInput, "click");
      const blankDropZone = screen.getByTestId(
        "project-file-blank-context-target"
      );

      expect(blankDropZone).not.toHaveClass("cursor-copy");
      fireEvent.click(blankDropZone);
      expect(inputClick).not.toHaveBeenCalled();

      fireEvent.contextMenu(blankDropZone);
      const uploadItem = screen.getByRole("menuitem", { name: "Upload files" });
      expect(uploadItem).toBeInTheDocument();
      fireEvent.click(uploadItem);

      expect(inputClick).toHaveBeenCalledOnce();
    });

    it("opens placeholder creation only from the blank-space context menu", async () => {
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        makeProjectAttachment({
          id: "attachment-blank-placeholder-current",
          originalName: "existing-current.pdf",
        }),
      ]);

      const createPlaceholderToNode = vi.fn();
      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        uploadFilesToNode: vi.fn(),
        createPlaceholderToNode,
        placeholderDefaultCode: "1000.1",
      });

      await screen.findByText(/existing\s+-\s+current\.pdf/);
      const blankDropZone = screen.getByTestId(
        "project-file-blank-context-target"
      );
      fireEvent.contextMenu(blankDropZone);
      fireEvent.click(
        await screen.findByRole("menuitem", { name: "New placeholder" })
      );

      const dialog = await screen.findByRole("dialog", {
        name: "New file placeholder",
      });
      const codeInput = within(dialog).getByLabelText("Reference code");
      expect(codeInput).toHaveValue("1000.1");
      expect(within(dialog).queryByLabelText("File type")).toBeNull();
      fireEvent.change(codeInput, { target: { value: "1000.7" } });
      fireEvent.change(within(dialog).getByLabelText("Placeholder name"), {
        target: { value: "Client representation" },
      });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Create placeholder" })
      );

      expect(createPlaceholderToNode).toHaveBeenCalledWith(
        "1000.7",
        "Client representation",
        "CURRENT"
      );
    });

    it("opens Smart Form and project template creation from the blank-space context menu", async () => {
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        makeProjectAttachment({
          id: "attachment-blank-library-current",
          originalName: "existing-current.pdf",
        }),
      ]);
      const onCreateSmartForm = vi.fn();
      const onCreateFromTemplate = vi.fn();

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        onCreateSmartForm,
        onCreateFromTemplate,
      });

      await screen.findByText(/existing\s+-\s+current\.pdf/);
      const blankDropZone = screen.getByTestId(
        "project-file-blank-context-target"
      );

      fireEvent.contextMenu(blankDropZone);
      fireEvent.click(
        await screen.findByRole("menuitem", { name: "New Smart Form" })
      );
      expect(onCreateSmartForm).toHaveBeenCalledOnce();

      fireEvent.contextMenu(blankDropZone);
      fireEvent.click(
        await screen.findByRole("menuitem", { name: "New from template" })
      );
      expect(onCreateFromTemplate).toHaveBeenCalledOnce();
    });

    it("offers folder upload for a phase and rejects dropped files", async () => {
      vi.spyOn(api, "projectAttachments").mockResolvedValue([]);
      mockProjectFileTableContainerWidth(1200);
      const uploadFilesToNode = vi.fn();
      const file = new File(["support"], "support.pdf", {
        type: "application/pdf",
      });
      Object.defineProperty(file, "webkitRelativePath", {
        configurable: true,
        value: "Upload/Support/support.pdf",
      });

      renderContent({
        selectedNode: {
          ...secondLevelNode,
          level: 1,
          nodeType: "PHASE",
          children: [],
        },
        uploadFilesToNode,
      });

      const emptyTray = await screen.findByTestId("project-file-empty-tray");
      expect(
        screen.getByTestId("project-file-blank-context-target")
      ).toHaveAttribute("data-dnd-droppable", "false");
      expect(emptyTray).toHaveTextContent("Select a folder");
      expect(
        within(emptyTray).queryByRole("button", { name: "Upload folder" })
      ).toBeNull();
      const header = screen.getByTestId("workbench-file-section-header");
      const input = within(header).getByLabelText("Upload");
      expect(input).toHaveAttribute("webkitdirectory");

      fireEvent.drop(emptyTray, {
        dataTransfer: { files: [file] },
      });
      expect(uploadFilesToNode).not.toHaveBeenCalled();

      fireEvent.change(input as HTMLInputElement, {
        target: { files: [file] },
      });
      expect(uploadFilesToNode).toHaveBeenCalledWith([file], "CURRENT");
    });

    it("renders the project file table without its extra title strip", async () => {
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        makeProjectAttachment({
          id: "attachment-visible-current",
          originalName: "visible-current.pdf",
        }),
      ]);
      mockProjectFileTableContainerWidth(1200);

      renderContent({ selectedNode: thirdLevelNodeWithFile });

      await expect(
        screen.findByText(/visible\s+-\s+current\.pdf/)
      ).resolves.toBeTruthy();
      const fileArea = screen.getByRole("region", { name: "Project files" });
      expect(fileArea).toHaveClass("bg-background");
      expect(fileArea).not.toHaveClass("rounded-lg");
      expect(fileArea).not.toHaveClass("border");
      expect(fileArea).not.toHaveClass("p-3");
      const projectFileTable = within(fileArea).getByRole(
        "table"
      ) as HTMLTableElement;
      expect(projectFileTable).toHaveClass("min-w-0", "table-fixed");
      await waitFor(() => {
        expect(projectFileTable).toHaveStyle({
          width: "calc(1200px + var(--data-grid-fill-size, 0px))",
        });
      });
      expect(
        within(fileArea).queryByRole("columnheader", {
          name: "Select all project files",
        })
      ).toBeNull();
      expect(
        within(fileArea).queryByRole("checkbox", {
          name: /Select visible\s+-\s+current\.pdf/,
        })
      ).toBeNull();
      expect(screen.queryByText("0 of 1 row(s) selected.")).toBeNull();
      expect(
        within(fileArea).queryByTestId("project-file-multi-select-toolbar")
      ).toBeNull();
      await openProjectFileContextMenu(/visible\s+-\s+current\.pdf/);
      fireEvent.click(screen.getByRole("menuitem", { name: "Multi-select" }));
      const multiSelectToolbar = await within(fileArea).findByTestId(
        "project-file-multi-select-toolbar"
      );
      expect(multiSelectToolbar).toHaveTextContent("1 of 1 row(s) selected.");
      const exitMultiSelectButton = within(multiSelectToolbar).getByRole(
        "button",
        {
          name: "Exit multi-select",
        }
      );
      expect(exitMultiSelectButton).toHaveClass("h-7", "shrink-0");
      expect(
        projectFileTable.querySelector("[data-slot='table-caption']")
      ).toBeNull();
      const selectHeader = await within(fileArea).findByRole("columnheader", {
        name: "Select all project files",
      });
      const tableHeader = projectFileTable.tHead;
      expect(tableHeader).toHaveClass("top-0");
      expect(tableHeader).not.toHaveClass("top-10");
      expect(selectHeader).toHaveStyle({
        width: "calc(var(--header-select-size) * 1px)",
      });
      expect(
        projectFileTable.style.getPropertyValue("--header-select-size")
      ).toBe("44");
      expect(within(selectHeader).queryByRole("separator")).toBeNull();
      expect(within(selectHeader).queryByRole("button")).toBeNull();
      const selectAllCheckbox = within(selectHeader).getByRole("checkbox", {
        name: "Select all project files",
      });
      expect(selectAllCheckbox).toBeTruthy();
      expect(selectAllCheckbox.parentElement).toHaveClass(
        "w-full",
        "justify-center"
      );
      expect(
        within(fileArea).queryByRole("columnheader", { name: "Actions" })
      ).toBeNull();
      const refCodeHeader = within(fileArea).getByRole("columnheader", {
        name: "Ref",
      });
      expect(refCodeHeader).not.toHaveAttribute("draggable");
      expect(refCodeHeader).not.toHaveAttribute("title");
      expect(
        within(refCodeHeader).getByRole("button", {
          name: "Sort Ref column",
        })
      ).toBeTruthy();
      expect(
        within(refCodeHeader).queryByRole("button", { name: "Ref" })
      ).toBeNull();
      expect(refCodeHeader.querySelector(".lucide-grip-vertical")).toBeNull();
      expect(refCodeHeader).toHaveStyle({
        width: "calc(var(--header-refCode-size) * 1px)",
      });
      const refCodeResizeHandle = within(refCodeHeader).getByRole("separator", {
        name: "Resize Ref column",
      });
      expect(refCodeResizeHandle).not.toHaveAttribute("title");
      expect(refCodeResizeHandle).toHaveAttribute(
        "aria-orientation",
        "vertical"
      );
      expect(refCodeResizeHandle).toHaveAttribute("tabindex", "0");
      expect(refCodeResizeHandle).toHaveAttribute("aria-valuemin", "128");
      expect(refCodeResizeHandle).toHaveAttribute("aria-valuemax");
      expect(refCodeResizeHandle).toHaveAttribute("aria-valuenow", "160");
      expect(refCodeResizeHandle).toHaveClass(
        "bg-transparent",
        "focus-visible:ring-2"
      );
      expect(refCodeResizeHandle).not.toHaveClass("hover:bg-muted/60");
      const displayRefCode = "A01-0001-F001";
      const refCodeCell = screen.getByText(displayRefCode).closest("td");
      expect(refCodeCell).not.toHaveAttribute("title");
      expect(refCodeCell).toHaveClass("min-w-0");
      expect(screen.getByText(displayRefCode)).toHaveClass("truncate");
      const fileHeader = within(fileArea).getByRole("columnheader", {
        name: "File",
      });
      const notesHeader = within(fileArea).getByRole("columnheader", {
        name: "Note",
      });
      const statusHeader = within(fileArea).getByRole("columnheader", {
        name: "Status",
      });
      const signoffsHeader = within(fileArea).getByRole("columnheader", {
        name: "Sign-offs",
      });
      expect(statusHeader).toHaveStyle({
        width: "calc(var(--header-status-size) * 1px)",
      });
      expect(notesHeader).toHaveClass("text-center");
      expect(notesHeader).toHaveStyle({
        width: "calc(var(--header-notes-size) * 1px)",
      });
      expect(signoffsHeader).toHaveStyle({
        width: "calc(var(--header-signoffs-size) * 1px)",
      });
      expect(
        Number(projectFileTable.style.getPropertyValue("--header-status-size"))
      ).toBeGreaterThanOrEqual(144);
      expect(
        projectFileTable.style.getPropertyValue("--header-notes-size")
      ).toBe("86");
      expect(
        projectFileTable.style.getPropertyValue("--header-signoffs-size")
      ).toBe("152");
      for (const [headerElement, label] of [
        [fileHeader, "File"],
        [statusHeader, "Status"],
        [notesHeader, "Note"],
        [signoffsHeader, "Sign-offs"],
      ] as const) {
        expect(headerElement.querySelector('[draggable="true"]')).toBeNull();
        expect(
          within(headerElement).getByRole("button", {
            name: `Sort ${label} column`,
          })
        ).toBeTruthy();
      }
      const statusResizeHandle = within(statusHeader).getByRole("separator", {
        name: "Resize Status column",
      });
      expect(statusResizeHandle).not.toHaveAttribute("title");
      expect(within(notesHeader).queryByRole("separator")).toBeNull();
      expect(within(signoffsHeader).queryByRole("separator")).toBeNull();
      expect(fileHeader).toHaveStyle({
        width: "calc(var(--header-title-size) * 1px)",
      });
      expect(
        Number(projectFileTable.style.getPropertyValue("--header-title-size"))
      ).toBeGreaterThanOrEqual(88);
      fireEvent.keyDown(refCodeResizeHandle, { key: "ArrowRight" });
      await waitFor(() => {
        expect(
          projectFileTable.style.getPropertyValue("--header-refCode-size")
        ).toBe("176");
        expect(refCodeResizeHandle).toHaveAttribute("aria-valuenow", "176");
        expect(
          Number(projectFileTable.style.width.slice(5).split("px")[0])
        ).toBeCloseTo(1200, 2);
      });
      fireEvent.keyDown(refCodeResizeHandle, { key: "ArrowRight" });
      await waitFor(() => {
        expect(
          projectFileTable.style.getPropertyValue("--header-refCode-size")
        ).toBe("192");
      });
      fireEvent.doubleClick(refCodeResizeHandle);
      await waitFor(() => {
        expect(
          projectFileTable.style.getPropertyValue("--header-refCode-size")
        ).toBe("160");
      });

      expect(
        within(fileArea).getByRole("separator", {
          name: "Resize File column",
        })
      ).toBeTruthy();
      expect(
        within(fileArea)
          .getAllByRole("columnheader")
          .map((header) => header.getAttribute("aria-label"))
      ).toStrictEqual([
        "Select all project files",
        "Ref",
        "File",
        "Status",
        "Note",
        "Sign-offs",
      ]);
      const fileCheckbox = within(fileArea).getByRole("checkbox", {
        name: /Select visible\s+-\s+current\.pdf/,
      });
      expect(fileCheckbox.closest("td")).toHaveClass("text-center");
      fireEvent.click(fileCheckbox);
      await waitFor(() => {
        expect(multiSelectToolbar).toHaveTextContent("0 of 1 row(s) selected.");
      });
      fireEvent.click(exitMultiSelectButton);
      await waitFor(() => {
        expect(
          within(fileArea).queryByRole("columnheader", {
            name: "Select all project files",
          })
        ).toBeNull();
        expect(
          within(fileArea).queryByTestId("project-file-multi-select-toolbar")
        ).toBeNull();
      });
      expect(screen.queryByText("0 of 1 row(s) selected.")).toBeNull();
      expect(
        screen.queryByRole("heading", { name: "Project files" })
      ).toBeNull();
      expect(screen.queryByText("1 active")).toBeNull();
    }, 20_000);

    it("requests a file preview by file id from the project file context menu", async () => {
      const previewFile = vi.fn();
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        makeProjectAttachment({
          id: "attachment-preview-current",
          originalName: "preview-current.xlsx",
        }),
      ]);

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        onPreviewFile: previewFile,
      });

      const fileCell = await screen.findByText(/preview\s+-\s+current\.xlsx/);
      fireEvent.contextMenu(requireElement(fileCell.closest("tr")));
      fireEvent.click(await screen.findByRole("menuitem", { name: "Preview" }));

      expect(previewFile).toHaveBeenCalledWith("attachment-preview-current");
    });

    it("exports the attachment ids selected in multi-select mode", async () => {
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        makeProjectAttachment({
          id: "attachment-batch-export-first",
          originalName: "batch-export-first.pdf",
        }),
        makeProjectAttachment({
          id: "attachment-batch-export-second",
          originalName: "batch-export-second.pdf",
        }),
      ]);
      mockProjectFileTableContainerWidth(1200);
      const onExportAttachments = vi.fn();

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        onExportAttachments,
      });

      await screen.findByText(/batch\s+-\s+export\s+-\s+first\.pdf/);
      await openProjectFileContextMenu(/batch\s+-\s+export\s+-\s+first\.pdf/);
      fireEvent.click(screen.getByRole("menuitem", { name: "Multi-select" }));
      fireEvent.click(
        await screen.findByRole("checkbox", {
          name: /Select batch\s+-\s+export\s+-\s+second\.pdf/,
        })
      );
      fireEvent.click(
        await screen.findByRole("button", { name: "Export selected (2)" })
      );

      expect(onExportAttachments).toHaveBeenCalledWith([
        "attachment-batch-export-first",
        "attachment-batch-export-second",
      ]);
    });

    it("exports every checked file from any multi-select context menu", async () => {
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        makeProjectAttachment({
          id: "attachment-context-export-first",
          originalName: "context-export-first.pdf",
        }),
        makeProjectAttachment({
          id: "attachment-context-export-second",
          originalName: "context-export-second.pdf",
        }),
        makeProjectAttachment({
          id: "attachment-context-export-unchecked",
          originalName: "context-export-unchecked.pdf",
        }),
      ]);
      mockProjectFileTableContainerWidth(1200);
      const onExportAttachments = vi.fn();

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        onExportAttachments,
      });

      await screen.findByText(/context\s+-\s+export\s+-\s+first\.pdf/);
      await openProjectFileContextMenu(/context\s+-\s+export\s+-\s+first\.pdf/);
      fireEvent.click(screen.getByRole("menuitem", { name: "Multi-select" }));
      fireEvent.click(
        await screen.findByRole("checkbox", {
          name: /Select context\s+-\s+export\s+-\s+second\.pdf/,
        })
      );
      await openProjectFileContextMenu(
        /context\s+-\s+export\s+-\s+unchecked\.pdf/
      );
      fireEvent.click(
        await screen.findByRole("menuitem", {
          name: "Export selected files (2)",
        })
      );

      expect(onExportAttachments).toHaveBeenCalledWith([
        "attachment-context-export-first",
        "attachment-context-export-second",
      ]);
    });

    it("disables context export when multi-select has no checked files", async () => {
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        makeProjectAttachment({
          id: "attachment-context-export-empty",
          originalName: "context-export-empty.pdf",
        }),
      ]);
      mockProjectFileTableContainerWidth(1200);
      const onExportAttachments = vi.fn();

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        onExportAttachments,
      });

      await screen.findByText(/context\s+-\s+export\s+-\s+empty\.pdf/);
      await openProjectFileContextMenu(/context\s+-\s+export\s+-\s+empty\.pdf/);
      fireEvent.click(screen.getByRole("menuitem", { name: "Multi-select" }));
      fireEvent.click(
        await screen.findByRole("checkbox", {
          name: /Select context\s+-\s+export\s+-\s+empty\.pdf/,
        })
      );
      await openProjectFileContextMenu(/context\s+-\s+export\s+-\s+empty\.pdf/);

      await expect(
        screen.findByRole("menuitem", {
          name: "Export selected files (0)",
        })
      ).resolves.toHaveAttribute("aria-disabled", "true");
      expect(
        screen.queryByRole("menuitem", { name: "Original format" })
      ).toBeNull();
      expect(onExportAttachments).not.toHaveBeenCalled();
    });

    it("previews an attachment when its project file row is clicked", async () => {
      const previewFile = vi.fn();
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        makeProjectAttachment({
          id: "attachment-preview-click",
          originalName: "preview-click.pdf",
        }),
      ]);

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        onPreviewFile: previewFile,
      });

      const fileCell = await screen.findByText(/preview\s+-\s+click\.pdf/);
      fireEvent.click(requireElement(fileCell.closest("tr")));

      expect(previewFile).toHaveBeenCalledWith("attachment-preview-click");
    });

    it("offers replacement actions for placeholders without previewing them", async () => {
      const previewFile = vi.fn();
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        {
          ...makeProjectAttachment({
            id: "attachment-placeholder-word",
            originalName: "Audit report.docx",
          }),
          placeholderType: "WORD",
          fileUrl: "",
          fileSize: 0,
          version: 0,
          headVersionId: null,
        },
      ]);

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        onPreviewFile: previewFile,
        createPlaceholderToNode: vi.fn(),
      });

      const fileCell = await screen.findByText(/Audit report\.docx/);
      const row = requireElement(fileCell.closest("tr"));
      expect(row).toHaveTextContent("Placeholder · Word");

      fireEvent.click(row);
      expect(previewFile).not.toHaveBeenCalled();

      fireEvent.contextMenu(row);
      await expect(
        screen.findByRole("menuitem", { name: "Replace file" })
      ).resolves.toBeInTheDocument();
      expect(
        screen.getByRole("menuitem", { name: "Rename" })
      ).toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: "Preview" })).toBeNull();
      expect(
        screen.queryByRole("menuitem", { name: "Version history" })
      ).toBeNull();
      expect(
        screen.queryByRole("menuitem", { name: "New placeholder" })
      ).toBeNull();
    });

    it("highlights the clicked project file row as the current context target", async () => {
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        makeProjectAttachment({
          id: "attachment-first-current",
          originalName: "first-current.pdf",
        }),
        makeProjectAttachment({
          id: "attachment-second-current",
          originalName: "second-current.pdf",
          workingPaper: {
            ...selectedWorkingPaperLocation,
            id: "working-paper-second",
            code: "A01-0002-F001",
            title: "Second paper",
          },
        }),
      ]);

      renderContent({ selectedNode: thirdLevelNodeWithFile });

      await screen.findByText(/first\s+-\s+current\.pdf/);
      const getFirstRow = () =>
        requireElement(
          screen.getByText(/first\s+-\s+current\.pdf/).closest("tr")
        );
      const getSecondRow = () =>
        requireElement(
          screen.getByText(/second\s+-\s+current\.pdf/).closest("tr")
        );
      expect(getFirstRow()).toBeTruthy();
      expect(getSecondRow()).toBeTruthy();
      const fileArea = screen.getByRole("region", { name: "Project files" });

      fireEvent.click(getFirstRow());

      expect(getFirstRow()).toHaveAttribute("data-state", "selected");
      expect(getSecondRow()).not.toHaveAttribute("data-state", "selected");

      fireEvent.click(getFirstRow());

      expect(getFirstRow()).not.toHaveAttribute("data-state", "selected");

      fireEvent.click(getFirstRow());

      expect(getFirstRow()).toHaveAttribute("data-state", "selected");

      fireEvent.pointerDown(fileArea);

      expect(getFirstRow()).not.toHaveAttribute("data-state", "selected");

      fireEvent.contextMenu(getSecondRow(), { clientX: 240, clientY: 320 });

      expect(getFirstRow()).not.toHaveAttribute("data-state", "selected");
      expect(getSecondRow()).toHaveAttribute("data-state", "selected");
    });

    it("clears project file multi-selection when a selected file moves folders", async () => {
      const otherWorkingPaper = {
        ...workingPaperNode,
        id: "working-paper-other",
        workflowNodeId: "node-other",
        code: "B01-0001-F001",
        title: "Other paper",
        attachments: [],
      };
      const otherNodeWithFile: WorkflowNode = {
        ...thirdLevelNode,
        id: "node-other",
        parentId: "node-other-2",
        code: "B01-0001",
        title: "Other",
        workingPapers: [otherWorkingPaper],
      };
      const sourceAttachment = makeProjectAttachment({
        id: "attachment-moving-current",
        originalName: "moving-current.pdf",
      });
      const targetAttachment = makeProjectAttachment({
        id: "attachment-moving-current",
        originalName: "moving-current.pdf",
        workingPaper: otherWorkingPaperLocation,
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([sourceAttachment]);

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      function SwitchingContent() {
        const [selectedNode, setSelectedNode] = useState<WorkflowNode>(
          thirdLevelNodeWithFile
        );
        const [activeBucket, setActiveBucket] =
          useState<WorkingPaperBucket>("CURRENT");
        const form = useForm<WorkbenchPaperForm>({
          defaultValues: {
            code: "",
            title: "",
            paperType: "WORKING_PAPER",
          },
        });

        return createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(
            DndContext,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(
                "button",
                {
                  type: "button",
                  onClick: () => {
                    queryClient.setQueryData(
                      ["project-attachments", "project-1"],
                      [targetAttachment]
                    );
                    setSelectedNode(otherNodeWithFile);
                  },
                },
                "Switch folder"
              ),
              createElement(WorkbenchContent, {
                projectId: "project-1",
                copy: zhWorkbenchContentCopy,
                currentProjectRole: "PREPARER" as ProjectRole,
                selectedNode,
                activeBucket,
                onActiveBucketChange: setActiveBucket,
                canDeleteSelected: false,
                deleteSelected: vi.fn(),
                deletePending: false,
                paperForm: form,
                createPaper: vi.fn(),
                createPaperPending: false,
                selectedPaperId: null,
                setSelectedPaperId: vi.fn(),
                workflow: [thirdLevelNodeWithFile, otherNodeWithFile],
              })
            )
          )
        );
      }

      render(createElement(SwitchingContent));

      await expect(
        screen.findByText(/moving\s+-\s+current\.pdf/)
      ).resolves.toBeTruthy();

      await openProjectFileContextMenu(/moving\s+-\s+current\.pdf/);
      fireEvent.click(screen.getByRole("menuitem", { name: "Multi-select" }));
      expect(
        screen.getByRole("checkbox", {
          name: /Select moving\s+-\s+current\.pdf/,
        })
      ).toBeChecked();

      fireEvent.click(screen.getByRole("button", { name: "Switch folder" }));

      await expect(
        screen.findByText(/moving\s+-\s+current\.pdf/)
      ).resolves.toBeTruthy();
      const fileArea = screen.getByRole("region", { name: "Project files" });
      await waitFor(() => {
        expect(
          within(fileArea).queryByRole("checkbox", {
            name: /Select moving\s+-\s+current\.pdf/,
          })
        ).toBeNull();
        expect(
          within(fileArea).queryByRole("button", { name: "Exit multi-select" })
        ).toBeNull();
      });
    }, 15_000);

    it("uses the header bulk action instead of a file column upload control", async () => {
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        makeProjectAttachment({
          id: "attachment-upload-header-current",
          originalName: "upload-header-current.pdf",
        }),
      ]);
      const uploadFilesToNode = vi.fn();

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        uploadFilesToNode,
      });

      await expect(
        screen.findByText(/upload\s+-\s+header\s+-\s+current\.pdf/)
      ).resolves.toBeTruthy();
      const fileArea = screen.getByRole("region", { name: "Project files" });
      const fileHeader = within(fileArea).getByRole("columnheader", {
        name: "File",
      });
      expect(
        within(fileHeader).queryByRole("button", { name: "Choose file" })
      ).toBeNull();
      expect(
        screen.queryByLabelText("Upload to Current workpapers")
      ).toBeNull();

      const header = screen.getByTestId("workbench-file-section-header");
      const fileInput = within(header).getByLabelText("Upload");
      expect(fileInput).toBeInstanceOf(HTMLInputElement);
      expect(fileInput).toHaveAttribute("data-slot", "input");
      expect(fileInput).toHaveClass("hidden");
      const file = new File(["header upload"], "support.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      fireEvent.change(fileInput as HTMLInputElement, {
        target: { files: [file] },
      });

      expect(uploadFilesToNode).toHaveBeenCalledWith([file], "CURRENT");
    });

    it("keeps project file rows in source order until the ref sort button is clicked", async () => {
      const zetaWorkingPaper = {
        ...selectedWorkingPaperLocation,
        id: "working-paper-zeta",
        code: "A01-0001-F002",
        title: "zeta-current.pdf",
      };
      const alphaWorkingPaper = {
        ...selectedWorkingPaperLocation,
        id: "working-paper-alpha",
        code: "A01-0001-F001",
        title: "alpha-current.pdf",
      };
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        makeProjectAttachment({
          id: "attachment-zeta-current",
          originalName: "zeta-current.pdf",
          workingPaper: zetaWorkingPaper,
        }),
        makeProjectAttachment({
          id: "attachment-alpha-current",
          originalName: "alpha-current.pdf",
          workingPaper: alphaWorkingPaper,
        }),
      ]);
      mockProjectFileTableContainerWidth(1200);

      renderContent({ selectedNode: thirdLevelNodeWithFile });

      await expect(
        screen.findByText(/zeta\s+-\s+current\.pdf/)
      ).resolves.toBeTruthy();
      const fileArea = screen.getByRole("region", { name: "Project files" });
      const getFileNames = () =>
        within(fileArea)
          .getAllByRole("button", { name: /Open .* as Master/ })
          .map((button) => button.textContent?.trim());

      expect(getFileNames()).toStrictEqual([
        "zeta - current.pdf",
        "alpha - current.pdf",
      ]);

      const fileHeader = within(fileArea).getByRole("columnheader", {
        name: "File",
      });
      expect(
        within(fileHeader).getByRole("button", { name: "Sort File column" })
      ).toBeTruthy();
      const refCodeHeader = within(fileArea).getByRole("columnheader", {
        name: "Ref",
      });
      fireEvent.click(
        within(refCodeHeader).getByRole("button", { name: "Sort Ref column" })
      );
      fireEvent.click(
        await screen.findByRole("menuitem", { name: "Sort ascending" })
      );
      await waitFor(() => {
        expect(refCodeHeader).toHaveAttribute("aria-sort", "ascending");
        expect(getFileNames()).toStrictEqual([
          "alpha - current.pdf",
          "zeta - current.pdf",
        ]);
      });

      fireEvent.click(
        within(refCodeHeader).getByRole("button", { name: "Sort Ref column" })
      );
      fireEvent.click(
        await screen.findByRole("menuitem", { name: "Sort descending" })
      );
      await waitFor(() => {
        expect(refCodeHeader).toHaveAttribute("aria-sort", "descending");
        expect(getFileNames()).toStrictEqual([
          "zeta - current.pdf",
          "alpha - current.pdf",
        ]);
      });
    }, 15_000);

    it("reveals the highlighted project file row", async () => {
      const scrollIntoView = vi.fn();
      Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: scrollIntoView,
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        makeProjectAttachment({
          id: "attachment-highlighted-current",
          originalName: "highlighted-current.pdf",
        }),
        makeProjectAttachment({
          id: "attachment-highlighted-sibling",
          originalName: "highlighted-sibling.pdf",
        }),
      ]);

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        highlightedPaperId: "working-paper-1",
      });

      await expect(
        screen.findByText(/highlighted\s+-\s+current\.pdf/)
      ).resolves.toBeTruthy();
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
      expect(new Set(scrollIntoView.mock.instances).size).toBe(1);
    });

    it("shows uploaded business activity for initial project files", async () => {
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        {
          ...makeProjectAttachment({
            id: "attachment-uploaded-current",
            originalName: "uploaded-current.pdf",
          }),
          createdAt: "2026-06-01T09:00:00.000Z",
          lastModifiedAt: "2026-06-01T09:00:00.000Z",
          uploader: {
            id: "uploader-1",
            name: "Uploader",
            email: "uploader@projectwing.local",
          },
        },
      ]);

      renderContent({
        projectLanguage: "en-US",
        selectedNode: thirdLevelNodeWithFile,
      });

      const fileCellElement = await screen.findByText(
        /uploaded\s+-\s+current\.pdf/
      );
      const fileCell = fileCellElement.closest("td");
      expect(fileCell).toBeTruthy();
      expect(
        within(fileCell as HTMLElement).queryByText(/Uploader/)
      ).toBeNull();
      const statusHeader = screen.getByRole("columnheader", {
        name: "Status",
      }) as HTMLTableCellElement;
      const fileRow = fileCell?.closest("tr");
      expect(fileRow).toBeTruthy();
      const statusCell = fileRow?.children[
        statusHeader.cellIndex
      ] as HTMLElement;
      expect(statusCell.textContent ?? "").not.toMatch(
        /uploaded|modified|editing|opened master/i
      );
      await waitFor(() => {
        expect(fileCell?.querySelector("img[src*='/pdf.svg']")).toBeTruthy();
      });
      expect(statusHeader).toBeTruthy();
    });

    it("previews and applies a project template from the selected directory", async () => {
      vi.spyOn(api, "projectAttachments").mockResolvedValue([]);
      const template = {
        id: "project-template-fixed-assets",
        code: "FA-AUDIT-ZH",
        name: "Fixed assets audit project",
        language: "zh-CN" as const,
        frameworkTemplateId: null,
        frameworkTemplate: null,
        description: "Fixed assets procedures",
        status: "PUBLISHED" as const,
        _count: { nodes: 1, files: 1 },
        nodes: [
          {
            id: "project-template-node-a01-0001",
            projectTemplateId: "project-template-fixed-assets",
            parentId: null,
            level: 3,
            code: "A01-0001",
            title: "Fixed assets",
            nodeType: "WORKING_PAPER" as const,
            sortOrder: 1,
            files: [
              {
                id: "project-template-file-rollforward",
                projectTemplateId: "project-template-fixed-assets",
                templateNodeId: "project-template-node-a01-0001",
                code: "A01-0001-F001",
                title: "Fixed assets rollforward",
                fileName: "fixed-assets-rollforward.xlsx",
                originalName: "fixed-assets-rollforward.xlsx",
                fileUrl: "mock://project-template/file.xlsx",
                fileSize: 4096,
                mimeType:
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                paperType: "WORKING_PAPER" as const,
                sortOrder: 1,
                templateItemId: "project-template-file-rollforward",
              },
            ],
          },
        ],
      };
      const preview = {
        template,
        targetNode: {
          id: thirdLevelNode.id,
          code: thirdLevelNode.code,
          title: thirdLevelNode.title,
          level: thirdLevelNode.level,
        },
        plan: {
          summary: { total: 1, create: 1, existing: 0 },
          items: [
            {
              templateFileId: "project-template-file-rollforward",
              templateNodeId: "project-template-node-a01-0001",
              sourceCode: "A01-0001-F001",
              title: "Fixed assets rollforward",
              originalName: "fixed-assets-rollforward.xlsx",
              paperType: "WORKING_PAPER" as const,
              bucket: "CURRENT" as const,
              status: "CREATE" as const,
              plannedCode: "A01-0001-F001",
              existingWorkingPaper: null,
            },
          ],
        },
      };
      const projectTemplates = vi
        .spyOn(api, "projectTemplates")
        .mockResolvedValue([{ ...template, nodes: undefined }]);
      vi.spyOn(api, "projectTemplate").mockResolvedValue(template);
      vi.spyOn(api, "previewProjectTemplate").mockResolvedValue(preview);
      const applyTemplate = vi
        .spyOn(api, "applyProjectTemplate")
        .mockResolvedValue({
          ...preview,
          createdWorkingPapers: [
            {
              id: "working-paper-template",
              projectId: "project-1",
              workflowNodeId: thirdLevelNode.id,
              templateItemId: "project-template-file-rollforward",
              code: "A01-0001-F001",
              title: "Fixed assets rollforward",
              paperType: "WORKING_PAPER",
              bucket: "CURRENT",
              attachments: [
                {
                  ...workingPaperNode.attachments[0],
                  id: "template-created-attachment",
                },
              ],
            },
          ],
          existingWorkingPapers: [],
          skippedTemplateFileIds: [],
        });
      const onApplied = vi.fn();
      const { queryClient, onOpenChange } = renderTemplateLibraryDialog({
        onApplied,
      });

      await expect(screen.findByText("Use template")).resolves.toBeTruthy();
      expect(projectTemplates).toHaveBeenCalledWith();
      const fixedAssetProjects = await screen.findAllByText(
        "Fixed assets audit project"
      );
      expect(fixedAssetProjects.length).toBeGreaterThan(0);
      expect(
        screen.getByRole("button", {
          name: "Select Fixed assets audit project",
        })
      ).toHaveClass("h-auto", "w-full", "whitespace-normal");
      fireEvent.click(
        await screen.findByRole("button", { name: "A01 - 0001" })
      );
      const referenceCodeLabel = await screen.findByText("A01-0001-F001");
      expect(referenceCodeLabel).toHaveClass("text-left");
      expect(referenceCodeLabel.nextElementSibling).toBe(
        screen.getByRole("button", { name: /Fixed assets rollforward/ })
      );
      expect(
        referenceCodeLabel.previousElementSibling?.querySelector("img")
      ).toBeTruthy();
      expect(screen.queryByText("Workpaper")).toBeNull();
      expect(
        screen.getByText(
          (content) =>
            content.startsWith("Current location: A01 - 0001") &&
            content.includes("Current workpapers")
        )
      ).toBeTruthy();
      expect(screen.queryByLabelText("Search templates")).toBeNull();
      expect(screen.queryByText("1 template")).toBeNull();
      expect(screen.queryByText("Import into")).toBeNull();
      expect(screen.queryByText("Total")).toBeNull();
      expect(
        screen.getByRole("checkbox", {
          name: "Select Fixed assets rollforward",
        })
      ).not.toBeChecked();
      expect(
        screen.getByRole("link", { name: "View template workpaper" })
      ).toHaveAttribute(
        "href",
        "/templates/project/project-template-fixed-assets/files/project-template-file-rollforward"
      );

      fireEvent.click(
        screen.getByRole("checkbox", {
          name: "Select Fixed assets rollforward",
        })
      );
      expect(screen.queryByLabelText("Will be inserted")).toBeNull();
      expect(
        screen.getByRole("checkbox", {
          name: "Select Fixed assets rollforward",
        })
      ).toBeChecked();
      fireEvent.click(
        await screen.findByRole("button", { name: "Use 1 workpaper" })
      );
      await expect(
        screen.findByText("Confirm reference codes")
      ).resolves.toBeTruthy();
      const referenceCode = screen.getByRole("textbox", {
        name: "Reference code: fixed-assets-rollforward.xlsx",
      });
      fireEvent.change(referenceCode, { target: { value: "A01-0001-F009" } });
      let finishRefresh: () => void = () => {};
      const refresh = new Promise<void>((resolve) => {
        finishRefresh = resolve;
      });
      vi.spyOn(queryClient, "invalidateQueries").mockReturnValue(refresh);
      fireEvent.click(screen.getByRole("button", { name: "Import items" }));

      await waitFor(() => {
        expect(applyTemplate).toHaveBeenCalledWith("project-1", template.id, {
          workflowNodeId: thirdLevelNode.id,
          bucket: "CURRENT",
          selectedTemplateFileIds: ["project-template-file-rollforward"],
          referenceCodeOverrides: [
            {
              itemId: "project-template-file-rollforward",
              code: "A01-0001-F009",
            },
          ],
        });
      });
      expect(onApplied).toHaveBeenCalledWith({
        targetNodeId: thirdLevelNode.id,
        bucket: "CURRENT",
        createdWorkingPaperCount: 1,
      });
      const imported = queryClient.getQueryData<ProjectAttachment[]>([
        "project-attachments",
        "project-1",
      ]);
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(
        imported?.some((item) => item.id === "template-created-attachment")
      ).toBeTruthy();
      queryClient.setQueryData(
        ["project-attachments", "project-1"],
        imported?.map((item) => ({ ...item, title: "Edited after import" }))
      );
      await act(async () => {
        finishRefresh();
        await refresh;
      });
      expect(
        queryClient.getQueryData<ProjectAttachment[]>([
          "project-attachments",
          "project-1",
        ])?.[0].title
      ).toBe("Edited after import");
    });

    it("creates a project Smart Form from published Smart Form templates", async () => {
      vi.spyOn(api, "projectTemplates").mockResolvedValue([]);
      vi.spyOn(api, "smartFormTemplates").mockResolvedValue([
        {
          id: "smart-form-template-independence",
          code: "SF-INDEP",
          name: "Independence confirmation",
          frameworkTemplateId: null,
          frameworkTemplate: null,
          description: null,
          status: "PUBLISHED",
          draftDefinitionJson: DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
          currentPublishedVersionId: "smart-form-template-version-1",
          currentPublishedVersion: {
            id: "smart-form-template-version-1",
            templateId: "smart-form-template-independence",
            version: 1,
            publishedAt: "2026-06-01T00:00:00.000Z",
            definitionJson: DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
          },
        },
        {
          id: "smart-form-template-tax",
          code: "SF-TAX",
          name: "Tax confirmation",
          description: null,
          status: "PUBLISHED",
          frameworkTemplateId: null,
          frameworkTemplate: null,
          draftDefinitionJson: DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
          currentPublishedVersionId: "smart-form-template-version-2",
          currentPublishedVersion: {
            id: "smart-form-template-version-2",
            templateId: "smart-form-template-tax",
            version: 1,
            publishedAt: "2026-06-01T00:00:00.000Z",
            definitionJson: DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
          },
        },
      ]);
      const createProjectSmartForm = vi
        .spyOn(api, "createProjectSmartForm")
        .mockImplementation((_projectId, _nodeId, values) =>
          Promise.resolve({
            id: `attachment-${values.smartFormTemplateVersionId}`,
            workingPaperId: `working-paper-${values.smartFormTemplateVersionId}`,
            workflowNodeId: thirdLevelNode.id,
            code: "A01-0001-F002",
            title: `${values.title}.sf`,
            fileKind: "SMART_FORM",
            fileName: `${values.title}.sf`,
            originalName: `${values.title}.sf`,
            fileUrl: `smart-forms/${values.smartFormTemplateVersionId}.json`,
            fileSize: 1024,
            mimeType: SMART_FORM_MIME_TYPE,
            version: 1,
            bucket: "CURRENT",
          })
        );
      const onApplied = vi.fn();
      const { queryClient } = renderTemplateLibraryDialog({
        mode: "smart-form",
        onApplied,
      });
      queryClient.setQueryData(["workflow", "project-1"], [thirdLevelNode]);
      queryClient.setQueryData<ProjectAttachment[]>(
        ["project-attachments", "project-1"],
        []
      );

      await waitFor(() => {
        expect(api.smartFormTemplates).toHaveBeenCalledWith({
          frameworkTemplateId: "framework-cas",
        });
      });
      await expect(
        screen.findByText("Independence confirmation")
      ).resolves.toBeTruthy();
      await expect(screen.findByText("Tax confirmation")).resolves.toBeTruthy();
      expect(screen.getAllByText("SF-INDEP")).toHaveLength(1);
      expect(screen.getByRole("columnheader", { name: "Code" })).toBeTruthy();
      expect(screen.getByRole("columnheader", { name: "File" })).toBeTruthy();
      expect(
        screen.getByRole("columnheader", { name: "Recommended standard" })
      ).toBeTruthy();
      expect(
        screen.getByRole("columnheader", { name: "Language" })
      ).toBeTruthy();
      expect(
        screen.getByRole("columnheader", { name: "Selected" })
      ).toBeTruthy();
      expect(screen.getAllByText("General")).toHaveLength(2);
      expect(
        screen.queryByRole("combobox", { name: "Smart Forms" })
      ).toBeNull();
      expect(
        screen.getAllByRole("tab", { name: "Chinese" })[0]
      ).toHaveAttribute("aria-selected", "true");
      await expect(
        screen.findByRole("button", { name: "Use" })
      ).resolves.toBeDisabled();
      fireEvent.click(screen.getAllByRole("tab", { name: "English" })[0]);
      const independenceOption = screen.getByRole("button", {
        name: "Select Independence confirmation",
      });
      const taxOption = screen.getByRole("button", {
        name: "Select Tax confirmation",
      });
      fireEvent.click(independenceOption);
      fireEvent.click(taxOption);

      fireEvent.click(
        await screen.findByRole("button", { name: "Use 2 workpapers" })
      );

      await waitFor(() => {
        expect(createProjectSmartForm).toHaveBeenNthCalledWith(
          1,
          "project-1",
          thirdLevelNode.id,
          {
            smartFormTemplateVersionId: "smart-form-template-version-1",
            title: "Independence confirmation",
            language: "en-US",
          }
        );
        expect(createProjectSmartForm).toHaveBeenNthCalledWith(
          2,
          "project-1",
          thirdLevelNode.id,
          {
            smartFormTemplateVersionId: "smart-form-template-version-2",
            title: "Tax confirmation",
            language: "zh-CN",
          }
        );
      });
      expect(onApplied).toHaveBeenCalledWith({
        targetNodeId: thirdLevelNode.id,
        bucket: "CURRENT",
        createdWorkingPaperCount: 2,
      });
      expect(
        queryClient
          .getQueryData<ProjectAttachment[]>([
            "project-attachments",
            "project-1",
          ])
          ?.map((attachment) => ({
            id: attachment.id,
            workingPaperId: attachment.workingPaper?.id,
            workflowNodeId: attachment.workingPaper?.workflowNodeId,
            path: attachment.workingPaper?.path.map((node) => node.id),
          }))
      ).toStrictEqual([
        {
          id: "attachment-smart-form-template-version-1",
          workingPaperId: "working-paper-smart-form-template-version-1",
          workflowNodeId: thirdLevelNode.id,
          path: [thirdLevelNode.id],
        },
        {
          id: "attachment-smart-form-template-version-2",
          workingPaperId: "working-paper-smart-form-template-version-2",
          workflowNodeId: thirdLevelNode.id,
          path: [thirdLevelNode.id],
        },
      ]);
      expect(
        queryClient
          .getQueryData<WorkflowNode[]>(["workflow", "project-1"])?.[0]
          ?.workingPapers?.map((paper) => paper.id) ?? []
      ).toStrictEqual([]);
    });

    it("renders the template preview tree collapsed with code-only directory labels", async () => {
      vi.spyOn(api, "projectAttachments").mockResolvedValue([]);
      const template = {
        id: "project-template-fixed-assets",
        code: "FA-AUDIT-ZH",
        name: "Fixed assets audit project",
        language: "zh-CN" as const,
        frameworkTemplateId: null,
        frameworkTemplate: null,
        description: "Fixed assets procedures",
        status: "PUBLISHED" as const,
        _count: { nodes: 3, files: 1 },
        nodes: [
          {
            id: "project-template-node-planning",
            projectTemplateId: "project-template-fixed-assets",
            parentId: null,
            level: 1,
            code: "Planning",
            title: "Planning phase title",
            nodeType: "PHASE" as const,
            sortOrder: 1,
            files: [],
          },
          {
            id: "project-template-node-a01",
            projectTemplateId: "project-template-fixed-assets",
            parentId: "project-template-node-planning",
            level: 2,
            code: "A01",
            title: "Assets title",
            nodeType: "ACCOUNT" as const,
            sortOrder: 1,
            files: [],
          },
          {
            id: "project-template-node-a01-0001",
            projectTemplateId: "project-template-fixed-assets",
            parentId: "project-template-node-a01",
            level: 3,
            code: "A01-0001",
            title: "Fixed assets title",
            nodeType: "WORKING_PAPER" as const,
            sortOrder: 1,
            files: [
              {
                id: "project-template-file-rollforward",
                projectTemplateId: "project-template-fixed-assets",
                templateNodeId: "project-template-node-a01-0001",
                code: "A01-0001-F001",
                title: "Fixed assets rollforward",
                fileName: "fixed-assets-rollforward.xlsx",
                originalName: "fixed-assets-rollforward.xlsx",
                fileUrl: "mock://project-template/file.xlsx",
                fileSize: 4096,
                mimeType:
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                paperType: "WORKING_PAPER" as const,
                sortOrder: 1,
                templateItemId: "project-template-file-rollforward",
              },
            ],
          },
        ],
      };
      const preview = {
        template,
        targetNode: {
          id: thirdLevelNode.id,
          code: thirdLevelNode.code,
          title: thirdLevelNode.title,
          level: thirdLevelNode.level,
        },
        plan: {
          summary: { total: 1, create: 1, existing: 0 },
          items: [
            {
              templateFileId: "project-template-file-rollforward",
              templateNodeId: "project-template-node-a01-0001",
              sourceCode: "A01-0001-F001",
              title: "Fixed assets rollforward",
              originalName: "fixed-assets-rollforward.xlsx",
              paperType: "WORKING_PAPER" as const,
              bucket: "CURRENT" as const,
              status: "CREATE" as const,
              plannedCode: "A01-0001-F001",
              existingWorkingPaper: null,
            },
          ],
        },
      };
      vi.spyOn(api, "projectTemplates").mockResolvedValue([
        { ...template, nodes: undefined },
      ]);
      vi.spyOn(api, "projectTemplate").mockResolvedValue(template);
      vi.spyOn(api, "previewProjectTemplate").mockResolvedValue(preview);

      renderTemplateLibraryDialog();

      const planning = await screen.findByRole(
        "button",
        { name: "Planning" },
        { timeout: 5000 }
      );
      expect(planning).toHaveClass(
        "w-full",
        "self-stretch",
        "justify-start",
        "text-left"
      );
      expect(screen.queryByText("Planning phase title")).toBeNull();
      expect(screen.queryByRole("button", { name: "A01" })).toBeNull();
      expect(screen.queryByText("A01-0001-F001")).toBeNull();

      fireEvent.click(planning);

      const account = await screen.findByRole(
        "button",
        { name: "A01" },
        { timeout: 5000 }
      );
      expect(screen.queryByText("Assets title")).toBeNull();
      expect(screen.queryByRole("button", { name: "A01 - 0001" })).toBeNull();

      fireEvent.click(account);
      fireEvent.click(
        await screen.findByRole("button", { name: "A01 - 0001" })
      );

      await expect(screen.findByText("A01-0001-F001")).resolves.toBeTruthy();
      expect(screen.queryByText("Fixed assets title")).toBeNull();
      expect(
        screen.getByRole("checkbox", {
          name: "Select Fixed assets rollforward",
        })
      ).not.toBeChecked();
      expect(
        screen.queryByRole("checkbox", {
          name: "Select all template workpapers",
        })
      ).toBeNull();
    });

    it("does not allow importing a folder-only project template", async () => {
      vi.spyOn(api, "projectAttachments").mockResolvedValue([]);
      const template = {
        id: "project-template-folder-only",
        code: "STRUCTURE-ZH",
        name: "Folder-only audit template",
        language: "zh-CN" as const,
        frameworkTemplateId: null,
        frameworkTemplate: null,
        description: "Folder-only procedures",
        status: "PUBLISHED" as const,
        _count: { nodes: 2, files: 0 },
        nodes: [
          {
            id: "project-template-node-planning",
            projectTemplateId: "project-template-folder-only",
            parentId: null,
            level: 1,
            code: "Planning",
            title: "Planning",
            nodeType: "PHASE" as const,
            sortOrder: 1,
            files: [],
          },
          {
            id: "project-template-node-a01",
            projectTemplateId: "project-template-folder-only",
            parentId: "project-template-node-planning",
            level: 2,
            code: "A01",
            title: "A01",
            nodeType: "ACCOUNT" as const,
            sortOrder: 1,
            files: [],
          },
        ],
      };
      const preview = {
        template,
        targetNode: {
          id: thirdLevelNode.id,
          code: thirdLevelNode.code,
          title: thirdLevelNode.title,
          level: thirdLevelNode.level,
        },
        plan: {
          summary: { total: 0, create: 0, existing: 0 },
          items: [],
        },
      };
      vi.spyOn(api, "projectTemplates").mockResolvedValue([
        { ...template, nodes: undefined },
      ]);
      vi.spyOn(api, "projectTemplate").mockResolvedValue(template);
      vi.spyOn(api, "previewProjectTemplate").mockResolvedValue(preview);
      const applyTemplate = vi.spyOn(api, "applyProjectTemplate");
      const onApplied = vi.fn();

      renderTemplateLibraryDialog({ onApplied });

      await expect(
        screen.findByText("Folder-only audit template")
      ).resolves.toBeTruthy();
      await expect(
        screen.findByRole("button", { name: "Planning" })
      ).resolves.toBeTruthy();

      expect(screen.getByRole("button", { name: "Use" })).toBeDisabled();
      expect(applyTemplate).not.toHaveBeenCalled();
      expect(onApplied).not.toHaveBeenCalled();
    });

    it("shows only one empty template hint without a redundant preview heading", async () => {
      vi.spyOn(api, "projectTemplates").mockResolvedValue([]);
      vi.spyOn(api, "smartFormTemplates").mockResolvedValue([]);
      const applyTemplate = vi.spyOn(api, "applyProjectTemplate");
      renderTemplateLibraryDialog();
      await expect(
        screen.findByText("No templates available")
      ).resolves.toBeInTheDocument();
      expect(screen.getAllByText("No templates available")).toHaveLength(1);
      expect(screen.queryByText("Use preview")).not.toBeInTheDocument();
      expect(
        screen.queryByText("Choose a template from the library")
      ).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Use" })).toBeDisabled();
      expect(
        screen.getByText((content) => content.startsWith("Current location:"))
      ).toHaveClass("sr-only");
      fireEvent.click(screen.getByRole("button", { name: "Use" }));
      expect(applyTemplate).toHaveBeenCalledTimes(0);
    });

    it("ignores non-V2 Smart Form definitions in the project selector", async () => {
      vi.spyOn(api, "projectTemplates").mockResolvedValue([]);
      vi.spyOn(api, "smartFormTemplates").mockResolvedValue([
        {
          id: "legacy-smart-form-template",
          code: "SF-LEGACY",
          name: "Legacy Smart Form",
          frameworkTemplateId: null,
          frameworkTemplate: null,
          description: null,
          status: "PUBLISHED",
          draftDefinitionJson: DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
          currentPublishedVersionId: "legacy-smart-form-version",
          currentPublishedVersion: {
            id: "legacy-smart-form-version",
            templateId: "legacy-smart-form-template",
            version: 1,
            publishedAt: "2026-06-01T00:00:00.000Z",
            definitionJson: { sections: [] } as never,
          },
        },
      ]);

      renderTemplateLibraryDialog({ mode: "smart-form" });

      await expect(
        screen.findByText("No templates available.")
      ).resolves.toBeInTheDocument();
      expect(screen.queryByText("Legacy Smart Form")).not.toBeInTheDocument();
    });

    it("uses Smart Form-only project templates instead of treating them as empty", async () => {
      vi.spyOn(api, "projectAttachments").mockResolvedValue([]);
      const template = {
        id: "project-template-smart-form-only",
        code: "SF-ZH",
        name: "Smart Form audit template",
        language: "zh-CN" as const,
        frameworkTemplateId: null,
        frameworkTemplate: null,
        description: "Smart Form procedures",
        status: "PUBLISHED" as const,
        _count: { nodes: 1, files: 0, smartForms: 1 },
        nodes: [
          {
            id: "project-template-node-a01-0001",
            projectTemplateId: "project-template-smart-form-only",
            parentId: null,
            level: 1,
            code: "A01-0001",
            title: "A01-0001",
            nodeType: "WORKING_PAPER" as const,
            sortOrder: 1,
            files: [],
            smartForms: [
              {
                id: "project-template-smart-form-risk",
                projectTemplateId: "project-template-smart-form-only",
                templateNodeId: "project-template-node-a01-0001",
                smartFormTemplateId: "smart-form-template-risk",
                smartFormTemplateVersionId: "smart-form-version-risk",
                code: "SF-RISK",
                title: "Risk assessment",
                fileName: "Risk assessment.sf",
                sortOrder: 1,
              },
            ],
          },
        ],
      };
      const preview = {
        template,
        targetNode: {
          id: thirdLevelNode.id,
          code: thirdLevelNode.code,
          title: thirdLevelNode.title,
          level: thirdLevelNode.level,
        },
        plan: {
          summary: {
            total: 1,
            files: 0,
            smartForms: 1,
            create: 1,
            existing: 0,
            createFiles: 0,
            createSmartForms: 1,
            existingFiles: 0,
            existingSmartForms: 0,
          },
          items: [],
          smartFormItems: [
            {
              smartFormReferenceId: "project-template-smart-form-risk",
              templateNodeId: "project-template-node-a01-0001",
              smartFormTemplateVersionId: "smart-form-version-risk",
              sourceCode: "SF-RISK",
              title: "Risk assessment",
              originalName: "Risk assessment.sf",
              paperType: "WORKING_PAPER" as const,
              bucket: "CURRENT" as const,
              status: "CREATE" as const,
              plannedCode: "A01-0001-F001",
              existingWorkingPaper: null,
            },
          ],
        },
      };
      vi.spyOn(api, "projectTemplates").mockResolvedValue([
        { ...template, nodes: undefined },
      ]);
      vi.spyOn(api, "projectTemplate").mockResolvedValue(template);
      vi.spyOn(api, "previewProjectTemplate").mockResolvedValue(preview);
      const applyTemplate = vi
        .spyOn(api, "applyProjectTemplate")
        .mockResolvedValue({
          ...preview,
          createdWorkingPapers: [],
          createdSmartForms: [
            {
              ...workingPaperNode.attachments[0],
              id: "attachment-smart-form-risk",
              workingPaperId: "working-paper-smart-form-risk",
              workflowNodeId: thirdLevelNode.id,
              code: "A01-0001-F001",
              title: "Risk assessment.sf",
              fileKind: "SMART_FORM",
              bucket: "CURRENT",
            },
          ],
          existingWorkingPapers: [],
          skippedTemplateFileIds: [],
          skippedSmartFormReferenceIds: [],
        });
      const onApplied = vi.fn();

      renderTemplateLibraryDialog({ onApplied });

      await expect(
        screen.findByText("Smart Form audit template")
      ).resolves.toBeTruthy();
      expect(screen.queryByText("No templates available.")).toBeNull();
      fireEvent.click(
        await screen.findByRole("button", { name: "A01 - 0001" })
      );

      await expect(screen.findByText("SF-RISK")).resolves.toBeTruthy();
      expect(screen.getByText("Risk assessment")).toBeTruthy();
      expect(screen.queryByText("Smart Form")).toBeNull();
      expect(
        screen.getByRole("checkbox", { name: "Select Risk assessment" })
      ).not.toBeChecked();

      fireEvent.click(
        screen.getByRole("checkbox", { name: "Select Risk assessment" })
      );
      await expect(screen.findByText("A01-0001-F001")).resolves.toBeTruthy();
      fireEvent.click(
        await screen.findByRole("button", { name: "Use 1 workpaper" })
      );
      await expect(
        screen.findByText("Confirm reference codes")
      ).resolves.toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Import items" }));

      await waitFor(() => {
        expect(applyTemplate).toHaveBeenCalledWith("project-1", template.id, {
          workflowNodeId: thirdLevelNode.id,
          bucket: "CURRENT",
          selectedTemplateFileIds: [],
          selectedSmartFormReferenceIds: ["project-template-smart-form-risk"],
          referenceCodeOverrides: [
            {
              itemId: "project-template-smart-form-risk",
              code: "A01-0001-F001",
            },
          ],
        });
      });
      expect(onApplied).toHaveBeenCalledWith({
        targetNodeId: thirdLevelNode.id,
        bucket: "CURRENT",
        createdWorkingPaperCount: 1,
      });
    });

    it("does not render template-created empty workpaper slots as project files", async () => {
      vi.spyOn(api, "projectAttachments").mockResolvedValue([]);
      const templatePaperNode: WorkflowNode = {
        ...thirdLevelNode,
        workingPapers: [
          {
            id: "working-paper-template",
            projectId: "project-1",
            workflowNodeId: thirdLevelNode.id,
            templateItemId: "template-item-rollforward",
            code: "A01-0001-F001",
            title: "Fixed assets rollforward",
            paperType: "WORKING_PAPER",
            bucket: "CURRENT",
            attachments: [],
            signoffs: [],
            reviewQuestions: [],
          },
        ],
      };

      renderContent({
        selectedNode: templatePaperNode,
      });

      const bucketTabs = screen.getByRole("tablist");
      expect(
        within(bucketTabs).getByRole("tab", { name: "Current" })
      ).toBeTruthy();
      expect(
        within(bucketTabs).getByRole("tab", { name: "Prior" })
      ).toBeTruthy();
      expect(
        within(bucketTabs).getByRole("tab", { name: "Temporary" })
      ).toBeTruthy();
      await expect(
        screen.findByText("Current workpapers")
      ).resolves.toBeTruthy();
    });

    it("shows a branded empty state for empty prior workpapers", async () => {
      vi.spyOn(api, "projectAttachments").mockResolvedValue([]);

      renderContent({ activeBucket: "PRIOR", selectedNode: thirdLevelNode });

      const bucketTabs = screen.getByRole("tablist");
      expect(
        within(bucketTabs).getByRole("tab", { name: "Current" })
      ).toBeTruthy();
      expect(
        within(bucketTabs).getByRole("tab", { name: "Prior" })
      ).toBeTruthy();
      expect(
        within(bucketTabs).getByRole("tab", { name: "Temporary" })
      ).toBeTruthy();
      await expect(screen.findByText("Prior workpapers")).resolves.toBeTruthy();
      expect(
        screen.getByText("Drag files here or upload prior-period workpapers.")
      ).toBeTruthy();
      const _emptyTray = await screen.findByTestId("project-file-empty-tray");
    });

    it("shows only current-bucket project files from the selected directory", async () => {
      const projectAttachments = vi
        .spyOn(api, "projectAttachments")
        .mockResolvedValue([
          makeProjectAttachment({
            id: "attachment-selected-current",
            originalName: "selected-current.pdf",
          }),
          makeProjectAttachment({
            id: "attachment-selected-prior",
            originalName: "selected-prior.pdf",
            workingPaper: {
              ...selectedWorkingPaperLocation,
              bucket: "PRIOR",
            },
          }),
          makeProjectAttachment({
            id: "attachment-other-current",
            originalName: "other-current.pdf",
            workingPaper: otherWorkingPaperLocation,
          }),
        ]);

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      await waitFor(() => {
        expect(projectAttachments).toHaveBeenCalledWith("project-1");
      });
      await expect(
        screen.findByRole("columnheader", { name: "Ref" })
      ).resolves.toBeTruthy();
      expect(screen.getByText(/selected\s+-\s+current\.pdf/)).toBeTruthy();
    });

    it("hides desktop agent tracking text while keeping manual check-in available", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.pdf",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([
        makeDesktopAgentSession({
          sessionId: "session-1",
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-selected-current",
          fileName: "selected-current.pdf",
          localPath:
            "C:\\Users\\User\\AppData\\Local\\ProjectWing\\AgentCache\\selected-current.pdf",
          originalHash: "hash-1",
          lastKnownHash: "hash-2",
          grantSecret: "grant-secret",
          status: "DIRTY_PENDING_CHECKIN",
          openedAt: "2026-06-05T02:00:00.000Z",
          lastSeenAt: "2026-06-05T02:05:00.000Z",
        }),
      ]);

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      await expect(
        screen.findByRole("button", {
          name: /Check in local changes for selected\s+-\s+current\.pdf/,
        })
      ).resolves.toBeTruthy();
    });

    it("does not show desktop agent tracking for unobserved launch sessions", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.pdf",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([
        makeDesktopAgentSession({
          sessionId: "session-1",
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-selected-current",
          fileName: "selected-current.pdf",
          localPath:
            "C:\\Users\\User\\AppData\\Local\\ProjectWing\\AgentCache\\selected-current.pdf",
          originalHash: "hash-1",
          lastKnownHash: "hash-1",
          grantSecret: "grant-secret",
          lifecycleState: "LAUNCH_FAILED",
          status: "OPEN_UNCHANGED",
          openObservedAt: undefined,
          openObservedSource: undefined,
          openedAt: "2026-06-05T02:00:00.000Z",
          lastSeenAt: "2026-06-05T02:05:00.000Z",
        }),
      ]);

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      await expect(
        screen.findByRole("button", {
          name: /Open selected\s+-\s+current\.pdf as Master/,
        })
      ).resolves.toBeTruthy();
    });

    it("does not show desktop agent tracking for revoked local sessions", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.pdf",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([
        makeDesktopAgentSession({
          sessionId: "session-1",
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-selected-current",
          fileName: "selected-current.pdf",
          localPath:
            "C:\\Users\\User\\AppData\\Local\\ProjectWing\\AgentCache\\selected-current.pdf",
          originalHash: "hash-1",
          lastKnownHash: "hash-1",
          grantSecret: "grant-secret",
          lifecycleState: "LOCK_REVOKED",
          status: "LOCK_REVOKED",
          openObservedAt: undefined,
          openObservedSource: undefined,
          openedAt: "2026-06-05T02:00:00.000Z",
          lastSeenAt: "2026-06-05T02:05:00.000Z",
        }),
      ]);

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      await expect(
        screen.findByRole("button", {
          name: /Open selected\s+-\s+current\.pdf as Master/,
        })
      ).resolves.toBeTruthy();
    });

    it("refreshes file lock attributes when desktop agent tracking disappears", async () => {
      const dateNowSpy = vi
        .spyOn(Date, "now")
        .mockReturnValue(Date.parse("2026-06-05T02:05:30.000Z"));
      const lockedProjectAttachment = {
        ...makeProjectAttachment({
          id: "attachment-selected-current",
          originalName: "selected-current.xlsx",
        }),
        lockedBy: "current-user",
        lockedAt: "2026-06-05T02:05:00.000Z",
        lockSessionId: "lock-session-current",
        lockHolder: {
          id: "current-user",
          name: "Current User",
          email: "current@projectwing.local",
        },
      };
      const unlockedProjectAttachment = {
        ...lockedProjectAttachment,
        lockedBy: null,
        lockSessionId: null,
        lockHolder: null,
      };
      const projectAttachments = vi
        .spyOn(api, "projectAttachments")
        .mockResolvedValueOnce([lockedProjectAttachment])
        .mockResolvedValue([unlockedProjectAttachment]);
      vi.spyOn(desktopAgent, "listDesktopAgentSessions")
        .mockResolvedValueOnce([
          makeDesktopAgentSession({
            sessionId: "session-current",
            lockSessionId: "lock-session-current",
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-selected-current",
            fileName: "selected-current.pdf",
            status: "OPEN_UNCHANGED",
            lifecycleState: "OPEN",
            contentState: "UNCHANGED",
            lastSeenAt: "2026-06-05T02:05:00.000Z",
          }),
        ])
        .mockResolvedValue([]);

      const view = renderContent({
        currentUserId: "current-user",
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      await expect(
        screen.findByLabelText("Current User opened Master within 1 minute")
      ).resolves.toBeTruthy();

      act(() => {
        view.queryClient.setQueryData(["desktop-agent-sessions"], []);
      });

      await waitFor(() => {
        expect(projectAttachments).toHaveBeenCalledTimes(2);
      });
      await waitFor(() => {});
      dateNowSpy.mockRestore();
    });

    it("checks in dirty desktop agent sessions from project files", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.pdf",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([
        makeDesktopAgentSession({
          sessionId: "session-1",
          lockSessionId: "lock-session-1",
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-selected-current",
          fileName: "selected-current.pdf",
          localPath:
            "C:\\Users\\User\\AppData\\Local\\ProjectWing\\AgentCache\\selected-current.pdf",
          originalHash: "hash-1",
          lastKnownHash: "hash-2",
          grantSecret: "grant-secret",
          status: "DIRTY_PENDING_CHECKIN",
          openedAt: "2026-06-05T02:00:00.000Z",
          lastSeenAt: "2026-06-05T02:05:00.000Z",
        }),
      ]);
      const checkIn = vi
        .spyOn(desktopAgent, "checkInDesktopAgentSession")
        .mockResolvedValue(
          makeDesktopAgentSession({
            sessionId: "session-1",
            lockSessionId: "lock-session-1",
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-selected-current",
            fileName: "selected-current.pdf",
            localPath:
              "C:\\Users\\User\\AppData\\Local\\ProjectWing\\AgentCache\\selected-current.pdf",
            originalHash: "hash-2",
            lastKnownHash: "hash-2",
            grantSecret: "grant-secret",
            status: "OPEN_UNCHANGED",
            openedAt: "2026-06-05T02:00:00.000Z",
            lastSeenAt: "2026-06-05T02:10:00.000Z",
          })
        );

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /Check in local changes for selected\s+-\s+current\.pdf/,
        })
      );

      await waitFor(() => {
        expect(checkIn).toHaveBeenCalledWith({
          sessionId: "session-1",
          lockSessionId: "lock-session-1",
          projectId: "project-1",
          attachmentId: "attachment-selected-current",
        });
      });
    });

    it("does not automatically check in dirty desktop agent sessions before the local file closes", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.pdf",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([
        makeDesktopAgentSession({
          sessionId: "session-1",
          lockSessionId: "lock-session-1",
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-selected-current",
          fileName: "selected-current.pdf",
          localPath:
            "C:\\Users\\User\\AppData\\Local\\ProjectWing\\AgentCache\\selected-current.pdf",
          originalHash: "hash-1",
          lastKnownHash: "hash-2",
          grantSecret: "grant-secret",
          status: "DIRTY_PENDING_CHECKIN",
          openedAt: "2026-06-05T02:00:00.000Z",
          lastSeenAt: "2026-06-05T02:05:00.000Z",
        }),
      ]);
      const checkIn = vi
        .spyOn(desktopAgent, "checkInDesktopAgentSession")
        .mockResolvedValue(
          makeDesktopAgentSession({
            sessionId: "session-1",
            lockSessionId: "lock-session-1",
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-selected-current",
            fileName: "selected-current.pdf",
            localPath:
              "C:\\Users\\User\\AppData\\Local\\ProjectWing\\AgentCache\\selected-current.pdf",
            originalHash: "hash-2",
            lastKnownHash: "hash-2",
            grantSecret: "grant-secret",
            status: "OPEN_UNCHANGED",
            openedAt: "2026-06-05T02:00:00.000Z",
            lastSeenAt: "2026-06-05T02:10:00.000Z",
          })
        );

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      await waitFor(() => {
        expect(desktopAgent.listDesktopAgentSessions).toHaveBeenCalledWith();
      });
      await new Promise((resolve) => {
        window.setTimeout(resolve, 100);
      });
      expect(checkIn).not.toHaveBeenCalled();
    });

    it("does not automatically check in legacy dirty sessions without a Master grant", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.pdf",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([
        makeDesktopAgentSession({
          sessionId: "legacy-session-1",
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-selected-current",
          fileName: "selected-current.pdf",
          localPath:
            "C:\\Users\\User\\AppData\\Local\\ProjectWing\\AgentCache\\selected-current.pdf",
          originalHash: "hash-1",
          lastKnownHash: "hash-2",
          status: "DIRTY_PENDING_CHECKIN",
          openedAt: "2026-06-05T02:00:00.000Z",
          lastSeenAt: "2026-06-05T02:05:00.000Z",
        }),
      ]);
      const checkIn = vi.spyOn(desktopAgent, "checkInDesktopAgentSession");

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      await waitFor(() => {
        expect(desktopAgent.listDesktopAgentSessions).toHaveBeenCalledWith();
      });
      expect(checkIn).not.toHaveBeenCalled();
    });

    it("does not automatically retry failed desktop agent check-ins", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.pdf",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([
        makeDesktopAgentSession({
          sessionId: "session-1",
          lockSessionId: "lock-session-1",
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-selected-current",
          fileName: "selected-current.pdf",
          localPath:
            "C:\\Users\\User\\AppData\\Local\\ProjectWing\\AgentCache\\selected-current.pdf",
          originalHash: "hash-1",
          lastKnownHash: "hash-2",
          grantSecret: "grant-secret",
          status: "CHECKIN_FAILED",
          openedAt: "2026-06-05T02:00:00.000Z",
          lastSeenAt: "2026-06-05T02:05:00.000Z",
          retryCount: 1,
        }),
      ]);
      const checkIn = vi
        .spyOn(desktopAgent, "checkInDesktopAgentSession")
        .mockResolvedValue(
          makeDesktopAgentSession({
            sessionId: "session-1",
            lockSessionId: "lock-session-1",
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-selected-current",
            fileName: "selected-current.pdf",
            localPath:
              "C:\\Users\\User\\AppData\\Local\\ProjectWing\\AgentCache\\selected-current.pdf",
            originalHash: "hash-2",
            lastKnownHash: "hash-2",
            grantSecret: "grant-secret",
            status: "CLOSED",
            openedAt: "2026-06-05T02:00:00.000Z",
            lastSeenAt: "2026-06-05T02:10:00.000Z",
            retryCount: 0,
          })
        );

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      await waitFor(() => {
        expect(desktopAgent.listDesktopAgentSessions).toHaveBeenCalledWith();
      });
      await new Promise((resolve) => {
        window.setTimeout(resolve, 100);
      });
      expect(checkIn).not.toHaveBeenCalled();
    });

    it("does not schedule retry loops for failed desktop agent check-ins", async () => {
      vi.useFakeTimers();
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.pdf",
      });
      const pendingSession = makeDesktopAgentSession({
        sessionId: "session-1",
        lockSessionId: "lock-session-1",
        mode: "MASTER",
        projectId: "project-1",
        attachmentId: "attachment-selected-current",
        fileName: "selected-current.pdf",
        localPath:
          "C:\\Users\\User\\AppData\\Local\\ProjectWing\\AgentCache\\selected-current.pdf",
        originalHash: "hash-1",
        lastKnownHash: "hash-2",
        grantSecret: "grant-secret",
        status: "CHECKIN_FAILED",
        openedAt: "2026-06-05T02:00:00.000Z",
        lastSeenAt: "2026-06-05T02:05:00.000Z",
        retryCount: 1,
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([
        { ...pendingSession },
      ]);
      const checkIn = vi
        .spyOn(desktopAgent, "checkInDesktopAgentSession")
        .mockResolvedValueOnce(null)
        .mockResolvedValue({
          ...pendingSession,
          originalHash: "hash-2",
          status: "CLOSED",
          lifecycleState: "CLOSED",
          contentState: "UNCHANGED",
          lastSeenAt: "2026-06-05T02:10:00.000Z",
          retryCount: 0,
        });

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      await vi.waitFor(() => {
        expect(desktopAgent.listDesktopAgentSessions).toHaveBeenCalledWith();
      });
      await vi.advanceTimersByTimeAsync(5000);

      expect(checkIn).not.toHaveBeenCalled();
    }, 10_000);

    it("opens project files through master and read-only actions", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.xlsx",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const openInAgent = vi
        .spyOn(desktopAgent, "openAttachmentInDesktopAgent")
        .mockImplementation((input) => {
          if (input.mode === "READ_ONLY") {
            return Promise.resolve(null);
          }
          return Promise.resolve({
            ok: true,
            sessionId: "session-1",
            localPath:
              "C:\\Users\\User\\AppData\\Local\\ProjectWing\\AgentCache\\selected-current.xlsx",
            openedAt: "2026-06-05T02:00:00.000Z",
          });
        });
      const downloadMaster = vi
        .spyOn(api, "downloadAttachment")
        .mockResolvedValue(new Blob(["master"]));
      const downloadReadOnly = vi
        .spyOn(api, "downloadAttachmentReadOnly")
        .mockResolvedValue(new Blob(["read-only"]));
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([]);
      const deleteAttachment = vi
        .spyOn(api, "deleteAttachment")
        .mockResolvedValue(projectAttachment);
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: vi.fn(() => "blob:download"),
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: vi.fn(),
      });
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
        function anchorClick(this: HTMLAnchorElement) {
          expect(this.download).toBe("A01-0001-F001 selected - current.xlsx");
        }
      );

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      const fileName = await screen.findByRole("button", {
        name: /Open selected\s+-\s+current\.xlsx as Master/,
      });
      fireEvent.click(fileName);
      await waitFor(() => {
        expect(openInAgent).toHaveBeenCalledWith({
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-selected-current",
          fileName: "A01-0001-F001 selected - current.xlsx",
        });
      });
      expect(downloadMaster).not.toHaveBeenCalled();

      await openProjectFileContextMenu(/selected\s+-\s+current\.xlsx/);
      const readOnlyItem = screen.getByRole("menuitem", {
        name: "Open (Read Only)",
      });
      await waitFor(() => {
        expect(readOnlyItem).not.toHaveAttribute("aria-disabled", "true");
      });
      fireEvent.click(readOnlyItem);
      await waitFor(() => {
        expect(openInAgent).toHaveBeenCalledWith({
          mode: "READ_ONLY",
          projectId: "project-1",
          attachmentId: "attachment-selected-current",
          fileName: "A01-0001-F001 selected - current.xlsx",
          baseVersion: 1,
          baseVersionId: undefined,
          cacheVersionId: "attachment-selected-current:v1",
          contentHash: undefined,
          contentToken: "attachment-selected-current:v1",
          fileSize: 2048,
        });
      });
      expect(downloadReadOnly).not.toHaveBeenCalled();
      await expect(
        screen.findByRole("heading", {
          name: "Install or update Desktop Agent",
        })
      ).resolves.toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Exit" }));
      await waitFor(() => {
        expect(
          screen.queryByRole("menuitem", { name: "Open (Read Only)" })
        ).toBeNull();
      });

      await openProjectFileContextMenu(/selected\s+-\s+current\.xlsx/);
      await expect(
        screen.findByRole("menuitem", { name: "Change Refcode" })
      ).resolves.not.toBeDisabled();
      expect(
        screen.queryByRole("menuitem", { name: "Add Review Note" })
      ).toBeNull();
      const deleteItem = screen.getByRole("menuitem", { name: "Delete" });
      await waitFor(() => {
        expect(deleteItem).not.toHaveAttribute("aria-disabled", "true");
      });
      fireEvent.click(deleteItem);
      await waitFor(() => {
        expect(deleteAttachment).toHaveBeenCalledWith(
          "project-1",
          "attachment-selected-current"
        );
      });
    }, 10_000);

    it("opens a searched attachment through the existing Master action", async () => {
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([]);
      const openInAgent = vi
        .spyOn(desktopAgent, "openAttachmentInDesktopAgent")
        .mockResolvedValue({
          ok: true,
          sessionId: "search-master-session",
          localPath: "C:\\ProjectWing\\stored.xlsx",
          openedAt: "2026-08-04T00:00:00.000Z",
        });

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
        fileActionRequest: {
          requestId: 1,
          attachmentId: "attachment-1",
          action: "MASTER",
        },
      });

      await waitFor(() => {
        expect(openInAgent).toHaveBeenCalledWith(
          expect.objectContaining({
            mode: "MASTER",
            attachmentId: "attachment-1",
          })
        );
      });
    });

    it("downloads a searched attachment through the existing file action", async () => {
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([]);
      const downloadReadOnly = vi
        .spyOn(api, "downloadAttachmentReadOnly")
        .mockResolvedValue(new Blob(["download"]));
      const anchorClick = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockReturnValue();

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
        fileActionRequest: {
          requestId: 1,
          attachmentId: "attachment-1",
          action: "DOWNLOAD",
        },
      });

      await waitFor(() => {
        expect(downloadReadOnly).toHaveBeenCalledWith(
          "project-1",
          "attachment-1"
        );
        expect(anchorClick).toHaveBeenCalledWith();
      });
    });

    it("only opens project files from the file name control", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-click-target",
        originalName: "click-target.xlsx",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const openInAgent = vi
        .spyOn(desktopAgent, "openAttachmentInDesktopAgent")
        .mockResolvedValue({
          ok: true,
          sessionId: "session-click-target",
          localPath:
            "C:\\Users\\User\\AppData\\Local\\ProjectWing\\AgentCache\\click-target.xlsx",
          openedAt: "2026-06-05T02:00:00.000Z",
        });
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([]);

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      const fileName = await screen.findByRole("button", {
        name: /Open click\s+-\s+target\.xlsx as Master/,
      });
      const row = requireElement(fileName.closest("tr"));
      const fileCell = fileName.closest("td");
      const actionButton = screen.getByRole("button", {
        name: /File actions for click\s+-\s+target\.xlsx/,
      });
      expect(row).toBeTruthy();
      expect(fileCell).toBeTruthy();
      expect(row).toHaveClass("cursor-pointer");
      expect(row).toHaveAttribute("data-dnd-sortable", "true");
      expect(fileName).not.toHaveClass("flex-1");
      expect(fileName).toHaveClass("inline-flex");
      expect(actionButton.closest("td")).toBe(fileCell);
      expect(actionButton.parentElement).toHaveClass("w-full");
      expect(actionButton.parentElement).toHaveAttribute(
        "data-slot",
        "button-group"
      );

      fireEvent.click(row);
      expect(openInAgent).not.toHaveBeenCalled();

      fireEvent.click(fileName);
      await waitFor(() => {
        expect(openInAgent).toHaveBeenCalledWith({
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-click-target",
          fileName: "A01-0001-F001 click - target.xlsx",
        });
      });
    });

    it("localizes project file action menu items from copy", async () => {
      const dateNowSpy = vi
        .spyOn(Date, "now")
        .mockReturnValue(Date.parse("2026-06-01T08:30:30.000Z"));
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        {
          ...makeProjectAttachment({
            id: "attachment-selected-current",
            originalName: "selected-current.xlsx",
          }),
          lockedBy: "locker-1",
          lockedAt: "2026-06-01T08:30:00.000Z",
          lockHolder: {
            id: "locker-1",
            name: "Locker",
            email: "locker@projectwing.local",
          },
        },
      ]);
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([]);

      renderContent({
        projectLanguage: "zh-CN",
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
        copy: {
          ...zhWorkbenchContentCopy,
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
            activity: {
              locale: "zh-CN",
              masterOpened: "{actor} opened master {time}",
              withinOneMinute: "1分钟内",
              retryCheckIn: "上传 {name} 的本地修改",
              retryTracking: "重试同步 {name}",
            },
            actionMenu: {
              preview: "预览",
              openMaster: "打开 Master",
              recoverMasterSession: "恢复 Master 会话",
              openReadOnly: "只读打开",
              export: "导出",
              exportTitle: "导出文件",
              exportOriginal: "原格式",
              exportPdf: "PDF",
              exportZip: "ZIP（保留目录）",
              exporting: "正在导出...",
              exportSuccessTitle: "文件已导出",
              exportSuccessDescription: "已导出 {name}",
              exportFailedTitle: "文件导出失败",
              releaseMaster: "释放 Master",
              changeRefcode: "修改编号",
              rename: "重命名",
              resetHead: "版本追溯",
              delete: "删除",
              triggerActionsFor: "{name} 的文件操作",
              actionsFor: "{name} 的操作",
              newRefcode: "新编号",
              saveRefcode: "保存编号",
              fileDisplayName: "文件显示名称",
              saveName: "保存名称",
              backToActions: "返回文件操作",
            },
          },
        },
      });

      await expect(
        screen.findByText("Locker opened master 1分钟内")
      ).resolves.toBeTruthy();

      await openProjectFileContextMenu(/selected\s+-\s+current\.xlsx/);

      expect(
        screen.getByRole("menuitem", { name: "打开 Master" })
      ).toBeTruthy();
      expect(screen.getByRole("menuitem", { name: "只读打开" })).toBeTruthy();
      expect(screen.getByRole("menuitem", { name: "导出" })).toBeTruthy();
      expect(screen.getByRole("menuitem", { name: "修改编号" })).toBeTruthy();
      expect(screen.getByRole("menuitem", { name: "重命名" })).toBeTruthy();
      expect(screen.getByRole("menuitem", { name: "版本追溯" })).toBeTruthy();
      expect(screen.getByRole("menuitem", { name: "删除" })).toBeTruthy();
      dateNowSpy.mockRestore();
    });

    it("does not show install guidance when the current agent opens Master successfully", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.xlsx",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const openResult = Promise.resolve({
        ok: true as const,
        sessionId: "session-1",
        localPath: "C:\\ProjectWing\\selected-current.xlsx",
        openedAt: "2026-06-05T02:00:00.000Z",
      });
      vi.spyOn(desktopAgent, "openAttachmentInDesktopAgent").mockReturnValue(
        openResult
      );

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /Open selected\s+-\s+current\.xlsx as Master/,
        })
      );

      await waitFor(() => {
        expect(desktopAgent.openAttachmentInDesktopAgent).toHaveBeenCalledWith(
          expect.objectContaining({
            attachmentId: "attachment-selected-current",
            fileName: "A01-0001-F001 selected - current.xlsx",
            mode: "MASTER",
            projectId: "project-1",
          })
        );
      });
      await act(async () => {
        await openResult;
      });
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.queryByText("Install or update Desktop Agent")).toBeNull();
    });

    it.each([
      [
        "selected-current.xlsm",
        /Open selected\s+-\s+current\.xlsm as Master/,
        /selected\s+-\s+current\.xlsm/,
      ],
      [
        "selected-current.xlsb",
        /Open selected\s+-\s+current\.xlsb as Master/,
        /selected\s+-\s+current\.xlsb/,
      ],
    ])(
      "enables desktop open actions for %s",
      async (originalName, masterActionName, fileNamePattern) => {
        const projectAttachment = makeProjectAttachment({
          id: "attachment-selected-current",
          originalName,
        });
        vi.spyOn(api, "projectAttachments").mockResolvedValue([
          projectAttachment,
        ]);
        vi.spyOn(
          desktopAgent,
          "openAttachmentInDesktopAgent"
        ).mockResolvedValue({
          ok: true,
          sessionId: "session-1",
          localPath: `C:\\Users\\User\\AppData\\Local\\ProjectWing\\AgentCache\\${originalName}`,
          openedAt: "2026-06-05T02:00:00.000Z",
        });
        vi.spyOn(api, "downloadAttachmentReadOnly").mockResolvedValue(
          new Blob(["read-only"])
        );

        renderContent({
          selectedNode: thirdLevelNodeWithFile,
          workflow: [secondLevelNode],
        });

        const fileName = await screen.findByRole("button", {
          name: masterActionName,
        });
        expect(fileName).not.toBeDisabled();

        await openProjectFileContextMenu(fileNamePattern);
        expect(
          screen.getByRole("menuitem", { name: "Open (Master)" })
        ).not.toBeDisabled();
        expect(
          screen.getByRole("menuitem", { name: "Open (Read Only)" })
        ).not.toBeDisabled();
      }
    );

    it.each([
      ["selected-current.pptx", /Open selected\s+-\s+current\.pptx as Master/],
    ])(
      "enables desktop Master and read-only actions for presentation file %s",
      async (originalName, masterActionName) => {
        const projectAttachment = {
          ...makeProjectAttachment({
            id: "attachment-selected-current",
            originalName,
          }),
          fileKind: "SUPPORTING" as const,
        };
        vi.spyOn(api, "projectAttachments").mockResolvedValue([
          projectAttachment,
        ]);
        const openInAgent = vi
          .spyOn(desktopAgent, "openAttachmentInDesktopAgent")
          .mockResolvedValue({
            ok: true,
            sessionId: "session-master",
            localPath: `C:\\Users\\User\\AppData\\Local\\ProjectWing\\AgentCache\\${originalName}`,
            openedAt: "2026-06-05T02:00:00.000Z",
          });
        const downloadReadOnly = vi.spyOn(api, "downloadAttachmentReadOnly");

        renderContent({
          selectedNode: thirdLevelNodeWithFile,
          workflow: [secondLevelNode],
        });

        await expect(
          screen.findByRole("button", { name: masterActionName })
        ).resolves.not.toBeDisabled();

        await openProjectFileContextMenu(/selected\s+-\s+current\.pptx/);
        const masterItem = screen.getByRole("menuitem", {
          name: "Open (Master)",
        });
        expect(masterItem).not.toBeDisabled();
        const readOnlyItem = screen.getByRole("menuitem", {
          name: "Open (Read Only)",
        });
        expect(readOnlyItem).not.toBeDisabled();
        fireEvent.click(masterItem);

        await waitFor(() => {
          expect(openInAgent).toHaveBeenCalledWith({
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-selected-current",
            fileName: "A01-0001-F001 selected - current.pptx",
          });
        });
        expect(downloadReadOnly).not.toHaveBeenCalled();
      }
    );

    it("allows PDFs as Master or read-only desktop copies", async () => {
      const projectAttachment = {
        ...makeProjectAttachment({
          id: "attachment-selected-current",
          originalName: "selected-current.pdf",
        }),
        fileKind: "SUPPORTING" as const,
        mimeType: "application/pdf",
      };
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const openInAgent = vi
        .spyOn(desktopAgent, "openAttachmentInDesktopAgent")
        .mockResolvedValue(null);
      const downloadReadOnly = vi
        .spyOn(api, "downloadAttachmentReadOnly")
        .mockResolvedValue(new Blob(["read-only pdf"]));
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: vi.fn(() => "blob:read-only-pdf"),
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: vi.fn(),
      });
      const anchorClick = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(function anchorClick(this: HTMLAnchorElement) {
          expect(this.download).toBe("A01-0001-F001 selected - current.pdf");
        });

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      await expect(
        screen.findByRole("button", {
          name: /Open selected\s+-\s+current\.pdf as Master/,
        })
      ).resolves.not.toBeDisabled();

      await openProjectFileContextMenu(/selected\s+-\s+current\.pdf/);
      expect(
        screen.getByRole("menuitem", { name: "Open (Master)" })
      ).not.toBeDisabled();
      expect(
        screen.getByRole("menuitem", { name: "Open (Read Only)" })
      ).not.toBeDisabled();
      fireEvent.click(
        screen.getByRole("menuitem", { name: "Open (Read Only)" })
      );
      await waitFor(() => {
        expect(openInAgent).toHaveBeenCalledWith({
          mode: "READ_ONLY",
          projectId: "project-1",
          attachmentId: "attachment-selected-current",
          fileName: "A01-0001-F001 selected - current.pdf",
          baseVersion: 1,
          baseVersionId: undefined,
          cacheVersionId: "attachment-selected-current:v1",
          contentHash: undefined,
          contentToken: "attachment-selected-current:v1",
          fileSize: 2048,
        });
      });
      expect(downloadReadOnly).not.toHaveBeenCalled();
      expect(anchorClick).not.toHaveBeenCalled();
      await expect(
        screen.findByRole("heading", {
          name: "Install or update Desktop Agent",
        })
      ).resolves.toBeTruthy();
    });

    it("opens ZIP project files in the internal Master editor", async () => {
      const projectAttachment = {
        ...makeProjectAttachment({
          id: "attachment-selected-current",
          originalName: "selected-current.zip",
        }),
        fileKind: "SUPPORTING" as const,
        mimeType: "application/zip",
      };
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const openInAgent = vi.spyOn(
        desktopAgent,
        "openAttachmentInDesktopAgent"
      );
      const openZipMaster = vi.spyOn(api, "openZipMaster").mockResolvedValue({
        ok: true,
        mode: "MASTER",
        sessionId: "zip-session-1",
        attachmentId: "attachment-selected-current",
        projectId: "project-1",
        lockSessionId: "lock-zip-1",
        fileName: "selected-current.zip",
        version: 3,
        state: "OPEN",
        dirty: false,
        entries: [
          {
            type: "folder",
            name: "docs",
            path: "docs/",
            children: [
              {
                type: "file",
                name: "support.txt",
                path: "docs/support.txt",
                size: 42,
              },
            ],
          },
        ],
      });
      const closeZipMaster = vi.spyOn(api, "closeZipMaster").mockResolvedValue({
        ok: true,
        checkedIn: true,
        discarded: false,
        attachmentId: "attachment-selected-current",
        projectId: "project-1",
        sessionId: "zip-session-1",
        lockSessionId: "lock-zip-1",
        version: 4,
      });

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      await expect(
        screen.findByRole("button", {
          name: /Open selected\s+-\s+current\.zip as Master/,
        })
      ).resolves.not.toBeDisabled();

      fireEvent.click(
        screen.getByRole("button", {
          name: /Open selected\s+-\s+current\.zip as Master/,
        })
      );

      await waitFor(() => {
        expect(openZipMaster).toHaveBeenCalledWith(
          "project-1",
          "attachment-selected-current"
        );
      });
      expect(openInAgent).not.toHaveBeenCalled();
      const dialog = await screen.findByRole("dialog", {
        name: "selected-current.zip",
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "docs" }));
      expect(within(dialog).getByText("support.txt")).toBeTruthy();

      fireEvent.click(
        within(dialog).getByRole("button", { name: "Close and check in" })
      );
      await waitFor(() => {
        expect(closeZipMaster).toHaveBeenCalledWith(
          "project-1",
          "zip-session-1"
        );
      });
      await waitFor(() => {
        expect(
          screen.queryByRole("dialog", { name: "selected-current.zip" })
        ).toBeNull();
      });
    });

    it("opens ZIP project files read-only in the internal archive viewer", async () => {
      const projectAttachment = {
        ...makeProjectAttachment({
          id: "attachment-selected-current",
          originalName: "selected-current.zip",
        }),
        fileKind: "SUPPORTING" as const,
        mimeType: "application/zip",
      };
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const openInAgent = vi.spyOn(
        desktopAgent,
        "openAttachmentInDesktopAgent"
      );
      const readZip = vi.spyOn(api, "readZip").mockResolvedValue({
        ok: true,
        mode: "READ_ONLY",
        attachmentId: "attachment-selected-current",
        projectId: "project-1",
        fileName: "selected-current.zip",
        version: 3,
        entries: [
          {
            type: "folder",
            name: "docs",
            path: "docs/",
            children: [
              {
                type: "file",
                name: "support.txt",
                path: "docs/support.txt",
                size: 42,
              },
            ],
          },
        ],
      });

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      await expect(
        screen.findByRole("button", {
          name: /Open selected\s+-\s+current\.zip as Master/,
        })
      ).resolves.not.toBeDisabled();

      await openProjectFileContextMenu(/selected\s+-\s+current\.zip/);
      expect(
        screen.getByRole("menuitem", { name: "Open (Master)" })
      ).not.toBeDisabled();
      expect(
        screen.getByRole("menuitem", { name: "Open (Read Only)" })
      ).not.toBeDisabled();
      fireEvent.click(
        screen.getByRole("menuitem", { name: "Open (Read Only)" })
      );

      await waitFor(() => {
        expect(readZip).toHaveBeenCalledWith(
          "project-1",
          "attachment-selected-current"
        );
      });
      expect(openInAgent).not.toHaveBeenCalled();
      fireEvent.click(await screen.findByRole("button", { name: "docs" }));
      await expect(screen.findByText("support.txt")).resolves.toBeTruthy();
    });

    it("opens Smart Form project files in the internal Master editor", async () => {
      const onSmartFormOpenChange = vi.fn();
      const scrollIntoView = vi.fn();
      Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: scrollIntoView,
      });
      const projectAttachment = {
        ...makeProjectAttachment({
          id: "attachment-selected-current",
          originalName: "selected-current.sf",
        }),
        fileKind: "SUPPORTING" as const,
        mimeType: SMART_FORM_MIME_TYPE,
      };
      const baseFormPackage = makeSmartFormPackage();
      const formPackage = {
        ...baseFormPackage,
        template: {
          ...baseFormPackage.template,
          language: "en-US" as const,
        },
      };
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const openInAgent = vi.spyOn(
        desktopAgent,
        "openAttachmentInDesktopAgent"
      );
      const openSmartForm = vi.spyOn(api, "openSmartForm").mockResolvedValue({
        attachment: projectAttachment,
        package: formPackage,
        lockSessionId: "lock-smart-form-1",
        completion: {
          complete: false,
          issues: [],
        },
      });
      const closeSmartForm = vi.spyOn(api, "closeSmartForm").mockResolvedValue({
        attachment: projectAttachment,
        package: {
          ...formPackage,
          response: formPackage.response,
        },
        lockSessionId: "lock-smart-form-1",
        completion: {
          complete: true,
          issues: [],
        },
      });
      const saveSmartForm = vi.spyOn(api, "saveSmartForm").mockResolvedValue({
        attachment: projectAttachment,
        package: {
          ...formPackage,
          response: formPackage.response,
        },
        lockSessionId: "lock-smart-form-1",
        completion: {
          complete: true,
          issues: [],
        },
      });

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
        onSmartFormOpenChange,
      });

      await openProjectFileContextMenu(/selected\s+-\s+current\.sf/);
      fireEvent.click(screen.getByRole("menuitem", { name: "Open (Master)" }));

      await waitFor(() => {
        expect(openSmartForm).toHaveBeenCalledWith(
          "project-1",
          "attachment-selected-current"
        );
      });
      expect(openInAgent).not.toHaveBeenCalled();
      const editor = await screen.findByRole("region", {
        name: /selected\s+-\s+current\.sf/,
      });
      await waitFor(() => {
        expect(onSmartFormOpenChange).toHaveBeenLastCalledWith(true);
      });
      expect(editor.parentElement).toHaveClass(
        "animate-workbench-surface-enter"
      );
      expect(
        screen.queryByRole("dialog", { name: /selected\s+-\s+current\.sf/ })
      ).toBeNull();
      expect(screen.queryByRole("navigation")).toBeNull();
      expect(scrollIntoView).not.toHaveBeenCalled();
      expect(within(editor).getByText("Audit objectives")).toBeTruthy();
      expect(within(editor).queryByText("审计目标")).toBeNull();
      fireEvent.click(
        within(editor).getAllByRole("button", {
          name: "Remove reference",
        })[0]
      );
      fireEvent.click(within(editor).getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(saveSmartForm).toHaveBeenCalledWith(
          "project-1",
          "attachment-selected-current",
          expect.objectContaining({
            lockSessionId: "lock-smart-form-1",
            package: expect.objectContaining({
              formatVersion: 2,
              response: expect.objectContaining({ schemaVersion: 2 }),
            }),
          })
        );
      });

      fireEvent.click(
        within(editor).getByRole("button", { name: "Save as draft" })
      );

      await waitFor(() => {
        expect(closeSmartForm).toHaveBeenCalledWith(
          "project-1",
          "attachment-selected-current",
          expect.objectContaining({
            lockSessionId: "lock-smart-form-1",
            package: expect.objectContaining({
              formatVersion: 2,
              response: expect.objectContaining({ schemaVersion: 2 }),
            }),
          })
        );
        expect(onSmartFormOpenChange).toHaveBeenLastCalledWith(false);
      });
    }, 60_000);

    it("discards Smart Form Master sessions from the workspace editor", async () => {
      const projectAttachment = {
        ...makeProjectAttachment({
          id: "attachment-selected-current",
          originalName: "selected-current.sf",
        }),
        fileKind: "SUPPORTING" as const,
        mimeType: SMART_FORM_MIME_TYPE,
      };
      const formPackage = makeSmartFormPackage();
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(api, "openSmartForm").mockResolvedValue({
        attachment: projectAttachment,
        package: formPackage,
        lockSessionId: "lock-smart-form-1",
        completion: {
          complete: false,
          issues: [],
        },
      });
      const discardSmartForm = vi
        .spyOn(api, "discardSmartForm")
        .mockResolvedValue({
          attachment: projectAttachment,
          package: formPackage,
          lockSessionId: "lock-smart-form-1",
          completion: {
            complete: false,
            issues: [],
          },
        });

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      await openProjectFileContextMenu(/selected\s+-\s+current\.sf/);
      fireEvent.click(screen.getByRole("menuitem", { name: "Open (Master)" }));

      const editor = await screen.findByRole("region", {
        name: /selected\s+-\s+current\.sf/,
      });
      fireEvent.click(within(editor).getByRole("button", { name: "Discard" }));

      await waitFor(() => {
        expect(discardSmartForm).toHaveBeenCalledWith(
          "project-1",
          "attachment-selected-current",
          {
            lockSessionId: "lock-smart-form-1",
          }
        );
        expect(
          screen.queryByRole("region", { name: /selected\s+-\s+current\.sf/ })
        ).toBeNull();
      });
    }, 30_000);

    it("opens Smart Form project files read-only without Desktop Agent", async () => {
      const onSmartFormOpenChange = vi.fn();
      const projectAttachment = {
        ...makeProjectAttachment({
          id: "attachment-selected-current",
          originalName: "selected-current.sf",
        }),
        fileKind: "SUPPORTING" as const,
        mimeType: SMART_FORM_MIME_TYPE,
      };
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const openInAgent = vi.spyOn(
        desktopAgent,
        "openAttachmentInDesktopAgent"
      );
      const readSmartForm = vi.spyOn(api, "readSmartForm").mockResolvedValue({
        attachment: projectAttachment,
        package: {
          ...makeSmartFormPackage(),
          response: DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
        },
        completion: {
          complete: true,
          issues: [],
        },
      });

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
        onSmartFormOpenChange,
      });

      await openProjectFileContextMenu(/selected\s+-\s+current\.sf/);
      expect(
        screen.getByRole("menuitem", { name: "Open (Read Only)" })
      ).not.toBeDisabled();
      fireEvent.click(
        screen.getByRole("menuitem", { name: "Open (Read Only)" })
      );

      await waitFor(() => {
        expect(readSmartForm).toHaveBeenCalledWith(
          "project-1",
          "attachment-selected-current"
        );
      });
      expect(openInAgent).not.toHaveBeenCalled();
      const editor = await screen.findByRole("region", {
        name: /selected\s+-\s+current\.sf/,
      });
      await waitFor(() => {
        expect(onSmartFormOpenChange).toHaveBeenLastCalledWith(true);
      });
      expect(
        screen.queryByRole("dialog", { name: /selected\s+-\s+current\.sf/ })
      ).toBeNull();
      expect(within(editor).getByText("审计目标")).toBeTruthy();
      fireEvent.click(within(editor).getByRole("button", { name: "Close" }));
      await waitFor(() => {
        expect(
          screen.queryByRole("region", { name: /selected\s+-\s+current\.sf/ })
        ).toBeNull();
        expect(onSmartFormOpenChange).toHaveBeenLastCalledWith(false);
      });
    });

    it("shows a newly created Smart Form review note immediately in its conversation", async () => {
      const createdQuestion = makeCurrentReviewQuestion({
        id: "question-smart-form-new",
        workingPaperId: "legacy-working-paper-smart-form",
        attachmentId: "attachment-smart-form",
        body: "Please retain the supporting evidence.",
        smartFormNodeId: "deferred-income-general-procedures",
        smartFormRowId: "deferred-income-procedure-2-a",
        smartFormTargetLabel: "将本期数据与以前期间数据进行比较；",
      });
      const createQuestion = vi.fn((_input: unknown) => createdQuestion);

      function ReviewQuestionHarness() {
        return (
          <ToastProvider>
            <ReviewQuestionsPanel
              canReview
              currentUserId="reviewer-current"
              members={[]}
              questions={[]}
              workflow={[]}
              defaultPaperId="working-paper-smart-form"
              defaultPaper={{
                id: "working-paper-smart-form",
                code: "1110.7",
                title: "Wrong fallback title.pdf",
              }}
              contextTitle="1110.7 Audit Programme — Deferred Income.sf"
              startInCreateMode
              autoOpen
              hideTrigger
              filterQuestionsByPaper={false}
              pending={false}
              createQuestion={createQuestion}
              replyQuestion={vi.fn()}
              uploadQuestionImage={vi.fn()}
              attachInitialQuestionFiles={vi.fn()}
              downloadQuestionImage={vi.fn()}
              markRepliedQuestion={vi.fn()}
              clearQuestion={vi.fn()}
              followUpQuestion={vi.fn()}
              reopenQuestion={vi.fn()}
            />
          </ToastProvider>
        );
      }

      render(<ReviewQuestionHarness />);

      await expect(
        screen.findByRole("heading", {
          name: "1110.7 Audit Programme — Deferred Income.sf",
        })
      ).resolves.toBeTruthy();
      enterReviewNoteContent("Please retain the supporting evidence.");
      fireEvent.click(screen.getByRole("button", { name: "Add review note" }));

      await waitFor(() => {
        expect(screen.queryByTestId("review-note-new-form")).toBeNull();
        expect(
          screen.getAllByText("Please retain the supporting evidence.").length
        ).toBeGreaterThan(0);
      });
      expect(createQuestion).toHaveBeenCalledWith({
        body: "Please retain the supporting evidence.",
        assignedToId: undefined,
        paperId: "working-paper-smart-form",
        referencedWorkingPaperIds: undefined,
      });
      expect(screen.queryByText("Wrong fallback title.pdf")).toBeNull();
    });

    it("localizes the review-note dialog and offers active project members for mentions", async () => {
      const dictionary = await getDictionary("zh-CN");
      const members: ProjectMember[] = [
        {
          id: "member-eden",
          projectRole: "REVIEWER",
          allowedProjectRoles: ["REVIEWER"],
          roleConsistent: true,
          declarationAccepted: true,
          user: {
            id: "eden",
            email: "eden@example.com",
            name: "Eden Chan",
            globalRole: "MANAGER",
            status: "ACTIVE",
          },
        },
      ];
      const statusQuestions = [
        makeCurrentReviewQuestion({
          id: "question-status-open",
          body: "Open review note",
          status: "OPEN",
          workingPaperId: "working-paper-smart-form",
        }),
        makeCurrentReviewQuestion({
          id: "question-status-replied",
          body: "Replied review note",
          status: "REPLIED",
          workingPaperId: "working-paper-smart-form",
        }),
        makeCurrentReviewQuestion({
          id: "question-status-cleared",
          body: "Cleared review note",
          status: "CLEARED",
          workingPaperId: "working-paper-smart-form",
        }),
      ];

      render(
        <ToastProvider>
          <ReviewQuestionsPanel
            autoOpen
            canReview
            copy={dictionary.workbench.reviewQuestions}
            currentUserId="reviewer-current"
            defaultPaper={{
              id: "working-paper-smart-form",
              code: "1100.14",
              title: "Audit Programme — Loans.sf",
            }}
            defaultPaperId="working-paper-smart-form"
            hideTrigger
            filterQuestionsByPaper={false}
            members={members}
            pending={false}
            questions={statusQuestions}
            startInCreateMode
            workflow={[]}
            createQuestion={vi.fn()}
            replyQuestion={vi.fn()}
            uploadQuestionImage={vi.fn()}
            attachInitialQuestionFiles={vi.fn()}
            downloadQuestionImage={vi.fn()}
            markRepliedQuestion={vi.fn()}
            clearQuestion={vi.fn()}
            followUpQuestion={vi.fn()}
            reopenQuestion={vi.fn()}
          />
        </ToastProvider>
      );

      await expect(
        screen.findByRole("button", { name: "新建复核注释" })
      ).resolves.toBeTruthy();
      expect(screen.getByText("共 3 条")).toBeTruthy();
      expect(screen.getByText("未解决 2 条")).toBeTruthy();
      expect(screen.getByRole("tab", { name: /待回复.*1/ })).toBeTruthy();
      expect(screen.getByText("Open review note")).toBeTruthy();
      expect(screen.queryByRole("img", { name: "待回复" })).toBeNull();
      fireEvent.click(screen.getByRole("tab", { name: /已回复.*1/ }));
      expect(screen.getByText("Replied review note")).toBeTruthy();
      expect(screen.queryByRole("img", { name: "已回复" })).toBeNull();
      fireEvent.click(screen.getByRole("tab", { name: /已解决/ }));
      expect(screen.getByText("Cleared review note")).toBeTruthy();
      expect(screen.queryByRole("img", { name: "已解决" })).toBeNull();
      fireEvent.click(screen.getByRole("tab", { name: /待回复.*1/ }));
      expect(
        screen.getByRole("button", { name: "添加复核注释" })
      ).toBeDisabled();
      const editor = screen.getByRole("textbox", { name: "复核注释内容" });
      expect(
        editor.querySelector('[data-placeholder="请描述需要补充或更正的内容"]')
      ).not.toBeNull();
      expect(screen.queryByText("New review note")).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "提及成员" }));
      await expect(
        screen.findByRole("menuitem", { name: /Eden Chan/ })
      ).resolves.toBeTruthy();
    });

    it("opens Smart Form review-question deep links in preview without taking Master", async () => {
      const scrollIntoView = vi.fn();
      Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: scrollIntoView,
      });
      const targetQuestion = makeCurrentReviewQuestion({
        id: "question-smart-form-row",
        workingPaperId: "working-paper-smart-form",
        attachmentId: "attachment-smart-form",
        smartFormNodeId: "deferred-income-general-procedures",
        smartFormRowId: "deferred-income-procedure-2-a",
        smartFormTargetLabel: "将本期数据与以前期间数据进行比较；",
        body: "Please explain the period-on-period movement.",
      });
      const earlierQuestion = makeCurrentReviewQuestion({
        id: "question-smart-form-row-earlier",
        workingPaperId: "working-paper-smart-form",
        attachmentId: "attachment-smart-form",
        smartFormNodeId: "deferred-income-general-procedures",
        smartFormRowId: "deferred-income-procedure-2-a",
        smartFormTargetLabel: "将本期数据与以前期间数据进行比较；",
        body: "Earlier question on the same Smart Form row.",
      });
      const projectAttachment = {
        ...smartFormWorkingPaperNode.attachments[0],
        reviewQuestions: [earlierQuestion, targetQuestion],
      };
      const selectedPaper = {
        ...smartFormWorkingPaperNode,
        attachments: [projectAttachment],
        reviewQuestions: [earlierQuestion, targetQuestion],
      };
      const params = new URLSearchParams({
        workingPaperId: selectedPaper.id,
        attachmentId: projectAttachment.id,
        reviewQuestionId: targetQuestion.id,
        focus: "q",
        smartFormPreview: "1",
        smartFormNodeId: requireValue(targetQuestion.smartFormNodeId),
        smartFormRowId: requireValue(targetQuestion.smartFormRowId),
        smartFormTargetLabel: requireValue(targetQuestion.smartFormTargetLabel),
      });
      mockSearchParams = params;
      window.history.replaceState({}, "", `/?${params}`);
      vi.spyOn(api, "workingPaper").mockResolvedValue(selectedPaper);
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const readSmartForm = vi.spyOn(api, "readSmartForm").mockResolvedValue({
        attachment: projectAttachment,
        package: {
          ...makeSmartFormPackage(),
          response: DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
        },
        completion: {
          complete: true,
          issues: [],
        },
      });
      const openSmartForm = vi.spyOn(api, "openSmartForm");
      const view = renderContent({
        currentUserId: "reviewer-current",
        currentProjectRole: "REVIEWER",
        readOnly: true,
        selectedNode: {
          ...thirdLevelNodeWithSmartFormFile,
          workingPapers: [selectedPaper],
        },
        selectedPaperId: selectedPaper.id,
        workflow: [secondLevelNode],
      });

      await waitFor(() => {
        expect(readSmartForm).toHaveBeenCalledWith(
          "project-1",
          "attachment-smart-form"
        );
      });
      expect(openSmartForm).not.toHaveBeenCalled();
      let editor: HTMLElement | null = null;
      await waitFor(() => {
        editor = screen.getByRole("region", {
          hidden: true,
          name: "independence.sf",
        });
        expect(editor).toBeTruthy();
      });
      await waitFor(() => {
        const target = requireElement(editor).querySelector(
          '[data-smart-form-node-id="deferred-income-general-procedures"]' +
            '[data-smart-form-row-id="deferred-income-procedure-2-a"]'
        );
        expect(target).toHaveClass("smart-form-v2-review-target");
      });
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "center",
      });
      await expect(
        screen.findAllByText("Please explain the period-on-period movement.")
      ).resolves.toHaveLength(2);
      expect(
        screen.getAllByText("Earlier question on the same Smart Form row.")
      ).toHaveLength(1);

      params.set("reviewQuestionId", earlierQuestion.id);
      mockSearchParams = new URLSearchParams(params);
      window.history.replaceState({}, "", `/?${params}`);
      view.rerenderContent();

      await expect(
        screen.findAllByText("Earlier question on the same Smart Form row.")
      ).resolves.toHaveLength(2);
      expect(
        screen.getAllByText("Please explain the period-on-period movement.")
      ).toHaveLength(1);
      expect(readSmartForm).toHaveBeenCalledOnce();

      fireEvent.click(
        within(requireElement<HTMLElement>(editor)).getByText("Close")
      );
      await waitFor(() => {
        expect(
          screen.queryByRole("region", {
            hidden: true,
            name: "independence.sf",
          })
        ).toBeNull();
      });
      expect(
        new URL(window.location.href).searchParams.get("smartFormPreview")
      ).toBeNull();
    }, 30_000);

    it("does not replace an active Smart Form Master when a review deep link arrives", async () => {
      const targetQuestion = makeCurrentReviewQuestion({
        id: "question-smart-form-row",
        workingPaperId: "working-paper-smart-form",
        attachmentId: "attachment-smart-form",
        smartFormNodeId: "deferred-income-general-procedures",
        smartFormRowId: "deferred-income-procedure-2-a",
        smartFormTargetLabel: "将本期数据与以前期间数据进行比较；",
        body: "Review the period-on-period movement.",
      });
      const projectAttachment = {
        ...smartFormWorkingPaperNode.attachments[0],
        workingPaper: {
          ...selectedWorkingPaperLocation,
          id: "working-paper-smart-form",
          title: "independence.sf",
        },
        reviewQuestions: [targetQuestion],
      };
      const selectedPaper = {
        ...smartFormWorkingPaperNode,
        attachments: [projectAttachment],
        reviewQuestions: [targetQuestion],
      };
      vi.spyOn(api, "workingPaper").mockResolvedValue(selectedPaper);
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const openSmartForm = vi.spyOn(api, "openSmartForm").mockResolvedValue({
        attachment: projectAttachment,
        package: makeSmartFormPackage(),
        lockSessionId: "lock-smart-form-active",
        completion: { complete: false, issues: [] },
      });
      const readSmartForm = vi.spyOn(api, "readSmartForm");
      const discardSmartForm = vi
        .spyOn(api, "discardSmartForm")
        .mockResolvedValue({
          attachment: projectAttachment,
          package: makeSmartFormPackage(),
          lockSessionId: "lock-smart-form-active",
          completion: { complete: false, issues: [] },
        });
      const view = renderContent({
        currentUserId: "reviewer-current",
        currentProjectRole: "REVIEWER",
        selectedNode: {
          ...thirdLevelNodeWithSmartFormFile,
          workingPapers: [selectedPaper],
        },
        workflow: [secondLevelNode],
      });

      await openProjectFileContextMenu(/independence\.sf/);
      fireEvent.click(screen.getByRole("menuitem", { name: "Open (Master)" }));
      await waitFor(() => expect(openSmartForm).toHaveBeenCalledOnce());

      mockSearchParams = new URLSearchParams({
        workingPaperId: selectedPaper.id,
        attachmentId: projectAttachment.id,
        reviewQuestionId: targetQuestion.id,
        focus: "q",
        smartFormPreview: "1",
        smartFormNodeId: requireValue(targetQuestion.smartFormNodeId),
        smartFormRowId: requireValue(targetQuestion.smartFormRowId),
        smartFormTargetLabel: requireValue(targetQuestion.smartFormTargetLabel),
      });
      window.history.replaceState({}, "", `/?${mockSearchParams}`);
      view.rerenderContent();

      await waitFor(() => {
        expect(
          screen
            .getByRole("region", { hidden: true, name: "independence.sf" })
            .querySelector(
              '[data-smart-form-node-id="deferred-income-general-procedures"]' +
                '[data-smart-form-row-id="deferred-income-procedure-2-a"]'
            )
        ).toHaveClass("smart-form-v2-review-target");
      });
      expect(readSmartForm).not.toHaveBeenCalled();
      expect(openSmartForm).toHaveBeenCalledOnce();
      await expect(
        screen.findAllByText("Review the period-on-period movement.")
      ).resolves.not.toHaveLength(0);
      const editor = screen.getByRole("region", {
        hidden: true,
        name: "independence.sf",
      });
      const discardButton = [
        ...editor.querySelectorAll<HTMLButtonElement>("button"),
      ].find((button) => button.textContent?.trim() === "Discard");
      expect(discardButton).toBeTruthy();
      fireEvent.click(requireElement(discardButton));
      await waitFor(() => {
        expect(discardSmartForm).toHaveBeenCalledWith(
          "project-1",
          "attachment-smart-form",
          {
            lockSessionId: "lock-smart-form-active",
          }
        );
        expect(
          new URL(window.location.href).searchParams.get("smartFormPreview")
        ).toBeNull();
      });
      expect(readSmartForm).not.toHaveBeenCalled();
    }, 30_000);

    it("exports Smart Form project files as PDF copies", async () => {
      const projectAttachment = {
        ...makeProjectAttachment({
          id: "attachment-selected-current",
          originalName: "selected-current.sf",
        }),
        fileKind: "SUPPORTING" as const,
        mimeType: SMART_FORM_MIME_TYPE,
      };
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const exportAttachment = vi
        .spyOn(api, "exportAttachment")
        .mockResolvedValue(new Blob(["%PDF-1.4"], { type: "application/pdf" }));
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: vi.fn(() => "blob:download"),
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: vi.fn(),
      });
      const anchorClick = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(function anchorClick(this: HTMLAnchorElement) {
          expect(this.download).toBe("A01-0001-F001 selected - current.pdf");
        });

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      await openProjectFileContextMenu(/selected\s+-\s+current\.sf/);
      fireEvent.click(screen.getByRole("menuitem", { name: "Export" }));
      expect(screen.getByText("Export file")).toBeTruthy();
      expect(
        screen.getByRole("menuitem", { name: "Original format" })
      ).toBeTruthy();
      expect(screen.getByRole("menuitem", { name: "PDF" })).toBeTruthy();
      expect(
        screen.getByRole("menuitem", { name: "ZIP with folder path" })
      ).toBeTruthy();
      fireEvent.click(
        screen.getByRole("menuitem", { name: "Original format" })
      );

      await waitFor(() => {
        expect(exportAttachment).toHaveBeenCalledWith(
          "project-1",
          "attachment-selected-current",
          "original"
        );
      });
      expect(anchorClick).toHaveBeenCalledWith();
      await expect(screen.findByText("File exported")).resolves.toBeTruthy();
    });

    it("hides PDF export for unsupported archive files", async () => {
      const archiveAttachment = {
        ...makeProjectAttachment({
          id: "attachment-selected-current",
          originalName: "selected-current.7z",
        }),
        fileKind: "SUPPORTING" as const,
        mimeType: "application/x-7z-compressed",
      };
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        archiveAttachment,
      ]);

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      await openProjectFileContextMenu(/selected\s+-\s+current\.7z/);
      fireEvent.click(screen.getByRole("menuitem", { name: "Export" }));

      expect(
        screen.getByRole("menuitem", { name: "Original format" })
      ).toBeTruthy();
      expect(
        screen.getByRole("menuitem", { name: "ZIP with folder path" })
      ).toBeTruthy();
      expect(screen.queryByRole("menuitem", { name: "PDF" })).toBeNull();
    });

    it("keeps unsupported archive formats disabled for internal and desktop open", async () => {
      const projectAttachment = {
        ...makeProjectAttachment({
          id: "attachment-selected-current",
          originalName: "selected-current.7z",
        }),
        fileKind: "SUPPORTING" as const,
        mimeType: "application/x-7z-compressed",
      };
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const openInAgent = vi.spyOn(
        desktopAgent,
        "openAttachmentInDesktopAgent"
      );
      const openZipMaster = vi.spyOn(api, "openZipMaster");
      const readZip = vi.spyOn(api, "readZip");

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      await expect(
        screen.findByRole("button", {
          name: /Open selected\s+-\s+current\.7z as Master/,
        })
      ).resolves.toBeDisabled();

      await openProjectFileContextMenu(/selected\s+-\s+current\.7z/);
      expect(
        screen.getByRole("menuitem", { name: "Open (Master)" })
      ).toHaveAttribute("aria-disabled", "true");
      expect(
        screen.getByRole("menuitem", { name: "Open (Read Only)" })
      ).toHaveAttribute("aria-disabled", "true");
      expect(openInAgent).not.toHaveBeenCalled();
      expect(openZipMaster).not.toHaveBeenCalled();
      expect(readZip).not.toHaveBeenCalled();
    });

    it("directs unavailable Master opening to settings without installing or downloading a copy", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.xlsx",
      });
      vi.stubEnv(
        "NEXT_PUBLIC_DESKTOP_AGENT_WINDOWS_DOWNLOAD_URL",
        "https://downloads.projectwing.test/agent/windows.exe"
      );
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        value:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const openInAgent = vi
        .spyOn(desktopAgent, "openAttachmentInDesktopAgent")
        .mockResolvedValue(null);
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([]);
      vi.spyOn(desktopAgent, "getDesktopAgentStatus").mockResolvedValue({
        health: null,
        isInstalled: false,
        isSupported: false,
        supportsSelfUpdate: false,
      });
      const downloadReadOnly = vi
        .spyOn(api, "downloadAttachmentReadOnly")
        .mockResolvedValue(new Blob(["read-only"]));
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: vi.fn(() => "blob:download"),
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: vi.fn(),
      });

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /Open selected\s+-\s+current\.xlsx as Master/,
        })
      );

      await waitFor(() => {
        expect(openInAgent).toHaveBeenCalledWith({
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-selected-current",
          fileName: "A01-0001-F001 selected - current.xlsx",
        });
      });
      expect(downloadReadOnly).not.toHaveBeenCalled();
      await expect(
        screen.findByRole("heading", {
          name: "Connect Desktop Agent",
        })
      ).resolves.toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Go to settings" })
      ).toBeTruthy();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
      expect(
        screen.queryByRole("link", {
          name: "Download Desktop Agent for Windows",
        })
      ).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Download read-only copy" })
      ).toBeNull();
      expect(downloadReadOnly).not.toHaveBeenCalled();
    });

    it("shows only update and exit as desktop agent update dialog actions", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.xlsx",
      });
      vi.stubEnv(
        "NEXT_PUBLIC_DESKTOP_AGENT_WINDOWS_DOWNLOAD_URL",
        "https://downloads.projectwing.test/agent/windows.exe"
      );
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        value:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "openAttachmentInDesktopAgent").mockResolvedValue(
        null
      );
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([]);
      vi.spyOn(desktopAgent, "getDesktopAgentStatus").mockResolvedValue({
        health: {
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.19",
        },
        isInstalled: true,
        isSupported: true,
        supportsSelfUpdate: true,
      });

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /Open selected\s+-\s+current\.xlsx as Master/,
        })
      );

      await expect(
        screen.findByRole("button", { name: "Update Desktop Agent" })
      ).resolves.toBeTruthy();
      expect(screen.getByRole("button", { name: "Exit" })).toBeTruthy();
      expect(
        screen.queryByRole("link", {
          name: "Download Desktop Agent for Windows",
        })
      ).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Download read-only copy" })
      ).toBeNull();
    });

    it("uses localized settings guidance without repeating a long Word filename", async () => {
      const dictionary = await getDictionary("zh-CN");
      const management =
        dictionary.workbench.settingsPanel.desktopAgentManagement;
      const longName =
        "word-master-update-dialog-with-a-very-long-unbroken-filename-that-should-wrap-inside-the-dialog-boundary.docx";
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: longName,
      });
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        value:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      });
      vi.stubEnv(
        "NEXT_PUBLIC_DESKTOP_AGENT_WINDOWS_DOWNLOAD_URL",
        "https://downloads.projectwing.test/agent/windows.exe"
      );
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "openAttachmentInDesktopAgent").mockResolvedValue(
        null
      );
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([]);
      vi.spyOn(desktopAgent, "getDesktopAgentStatus").mockResolvedValue({
        health: null,
        isInstalled: false,
        isSupported: false,
        supportsSelfUpdate: false,
      });

      renderContent({
        copy: {
          ...zhWorkbenchContentCopy,
          desktopAgentUpdate: localizedDesktopAgentUpdateCopy,
          settingsPanel: { desktopAgentManagement: management },
        },
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /Open word\s+-\s+master.*boundary\.docx as Master/,
        })
      );

      const dialog = await screen.findByRole("dialog");
      expect(
        within(dialog).getByText(management.settingsPromptDescription)
      ).toBeTruthy();
      expect(
        within(dialog).getByText(management.settingsPromptTitle)
      ).toBeTruthy();
      expect(
        within(dialog).getByRole("button", {
          name: management.goToSettings,
        })
      ).toBeTruthy();
      expect(
        within(dialog).getByRole("button", { name: management.cancel })
      ).toBeTruthy();
      expect(
        within(dialog).queryByRole("link", {
          name: "下载 Windows 版 Desktop Agent",
        })
      ).toBeNull();
      expect(within(dialog).queryByText(/Windows was detected/)).toBeNull();
      expect(within(dialog).queryByText(/Excel/)).toBeNull();
      expect(within(dialog).queryByText(longName)).toBeNull();
    });

    it("opens settings without polling or waking the Agent from the Master prompt", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.xlsx",
      });
      vi.stubEnv(
        "NEXT_PUBLIC_DESKTOP_AGENT_WINDOWS_DOWNLOAD_URL",
        "https://downloads.projectwing.test/agent/windows.exe"
      );
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        value:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "openAttachmentInDesktopAgent")
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          ok: true,
          sessionId: "session-1",
          localPath: "C:\\ProjectWing\\selected-current.xlsx",
          openedAt: "2026-06-16T08:00:00.000Z",
        });
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([]);
      vi.spyOn(desktopAgent, "getDesktopAgentStatus").mockResolvedValue({
        health: null,
        isInstalled: false,
        isSupported: false,
        supportsSelfUpdate: false,
      });
      const checkAvailability = vi
        .spyOn(desktopAgent, "checkDesktopAgentAvailability")
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /Open selected\s+-\s+current\.xlsx as Master/,
        })
      );
      const goToSettings = await screen.findByRole("button", {
        name: "Go to settings",
      });
      const onSettings = vi.fn();
      window.addEventListener(
        "project-wing:open-desktop-agent-settings",
        onSettings
      );
      fireEvent.click(goToSettings);
      await waitFor(() => expect(onSettings).toHaveBeenCalledOnce());
      expect(checkAvailability).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(
          screen.queryByRole("heading", { name: "Connect Desktop Agent" })
        ).toBeNull()
      );
      window.removeEventListener(
        "project-wing:open-desktop-agent-settings",
        onSettings
      );
    }, 10_000);

    it("cancels missing-Agent guidance without retrying Master", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.xlsx",
      });
      vi.stubEnv(
        "NEXT_PUBLIC_DESKTOP_AGENT_WINDOWS_DOWNLOAD_URL",
        "https://downloads.projectwing.test/agent/windows.exe"
      );
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        value:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const openInAgent = vi
        .spyOn(desktopAgent, "openAttachmentInDesktopAgent")
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([]);
      vi.spyOn(desktopAgent, "getDesktopAgentStatus").mockResolvedValue({
        health: null,
        isInstalled: false,
        isSupported: false,
        supportsSelfUpdate: false,
      });
      vi.spyOn(desktopAgent, "checkDesktopAgentAvailability")
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /Open selected\s+-\s+current\.xlsx as Master/,
        })
      );
      fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

      expect(openInAgent).toHaveBeenCalledOnce();
      await waitFor(() =>
        expect(
          screen.queryByRole("heading", { name: "Connect Desktop Agent" })
        ).toBeNull()
      );
    }, 10_000);

    it("starts a local self-update after asking to release local Master locks", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.xlsx",
      });
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        value:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "openAttachmentInDesktopAgent").mockResolvedValue(
        null
      );
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([
        makeDesktopAgentSession({
          sessionId: "session-current",
          lockSessionId: "lock-session-current",
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-selected-current",
          fileName: "selected-current.xlsx",
          lifecycleState: "OPEN",
        }),
      ]);
      vi.spyOn(desktopAgent, "getDesktopAgentStatus").mockResolvedValue({
        health: {
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.10",
        },
        isInstalled: true,
        isSupported: true,
        supportsSelfUpdate: true,
      });
      const updateAgent = vi
        .spyOn(desktopAgent, "updateDesktopAgent")
        .mockResolvedValue({
          ok: true,
          status: "STARTED",
          taskId: "update-task-1",
          downloadUrl:
            "http://localhost:3000/downloads/desktop-agent/windows/latest",
        });
      const updateStatus = vi
        .spyOn(desktopAgent, "getDesktopAgentUpdateStatus")
        .mockResolvedValue({
          ok: true,
          status: "VERIFYING_HEALTH",
          taskId: "update-task-1",
          message: "Waiting for Desktop Agent health.",
          expectedVersion: "0.1.19",
        });

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /Open selected\s+-\s+current\.xlsx as Master/,
        })
      );
      const updateButton = await screen.findByRole("button", {
        name: "Update Desktop Agent",
      });

      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(updateAgent).toHaveBeenCalledOnce();
      });
      await waitFor(() => {
        expect(updateStatus).toHaveBeenCalledWith();
      });
      expect(
        screen.getByText("Waiting for Desktop Agent health.")
      ).toBeTruthy();
    });

    it("recovers a stale update failure when the desktop agent is already ready", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.xlsx",
      });
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        value:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const openInAgent = vi
        .spyOn(desktopAgent, "openAttachmentInDesktopAgent")
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          ok: true,
          sessionId: "session-1",
          localPath: "C:\\ProjectWing\\selected-current.xlsx",
          openedAt: "2026-06-18T11:40:00.000Z",
        });
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([]);
      vi.spyOn(desktopAgent, "getDesktopAgentStatus").mockResolvedValue({
        health: {
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.10",
        },
        isInstalled: true,
        isSupported: true,
        supportsSelfUpdate: true,
      });
      vi.spyOn(desktopAgent, "updateDesktopAgent").mockResolvedValue({
        ok: true,
        status: "STARTED",
        taskId: "update-task-1",
        expectedVersion: "0.1.23",
        downloadUrl:
          "http://localhost:3000/downloads/desktop-agent/windows/latest",
      });
      vi.spyOn(desktopAgent, "getDesktopAgentUpdateStatus").mockResolvedValue({
        ok: true,
        status: "FAILED",
        taskId: "update-task-1",
        errorCode: "HEALTH_TIMEOUT",
        message: "Desktop Agent did not report the expected version.",
        expectedVersion: "0.1.23",
      });
      const checkAvailability = vi
        .spyOn(desktopAgent, "checkDesktopAgentAvailability")
        .mockResolvedValue(true);

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /Open selected\s+-\s+current\.xlsx as Master/,
        })
      );
      fireEvent.click(
        await screen.findByRole("button", { name: "Update Desktop Agent" })
      );

      await waitFor(() => {
        expect(checkAvailability).toHaveBeenCalledWith();
      });
      await waitFor(() => {
        expect(openInAgent).toHaveBeenCalledTimes(2);
      });
      await waitFor(() => {
        expect(
          screen.queryByRole("heading", { name: "Install Desktop Agent" })
        ).toBeNull();
      });
    });

    it("shows transparent desktop agent status and launch failure diagnostics", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.xlsx",
      });
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        value:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "openAttachmentInDesktopAgent").mockResolvedValue(
        null
      );
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([
        makeDesktopAgentSession({
          sessionId: "session-launch-failed",
          lockSessionId: "lock-session-launch-failed",
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-selected-current",
          fileName: "selected-current.xlsx",
          lifecycleState: "LAUNCH_FAILED",
          contentState: "UNCHANGED",
          launchFailedReason: "OPEN_OBSERVATION_TIMEOUT",
          lastError: "Open was not observed before timeout.",
        }),
      ]);
      vi.spyOn(desktopAgent, "getDesktopAgentStatus").mockResolvedValue({
        health: {
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.10",
        },
        isInstalled: true,
        isSupported: true,
        supportsSelfUpdate: true,
      });

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /Open selected\s+-\s+current\.xlsx as Master/,
        })
      );

      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText("Current status")).toBeTruthy();
      expect(within(dialog).getByText("Update ready")).toBeTruthy();
      expect(within(dialog).getByText("Next step")).toBeTruthy();
      expect(
        within(dialog).getByText("Release local Master locks, then update.")
      ).toBeTruthy();
      expect(within(dialog).getByText("Diagnostic details")).toBeTruthy();
      expect(within(dialog).getByText("Agent version")).toBeTruthy();
      expect(within(dialog).getByText("0.1.10")).toBeTruthy();
      expect(within(dialog).getByText("Launch failure")).toBeTruthy();
      expect(within(dialog).getByText("OPEN_OBSERVATION_TIMEOUT")).toBeTruthy();
      expect(within(dialog).getByText("Last error")).toBeTruthy();
      expect(
        within(dialog).getByText("Open was not observed before timeout.")
      ).toBeTruthy();
    });

    it("blocks one-click update when local Master sessions need attention", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.xlsx",
      });
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        value:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "openAttachmentInDesktopAgent").mockResolvedValue(
        null
      );
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([
        makeDesktopAgentSession({
          sessionId: "session-dirty",
          lockSessionId: "lock-session-dirty",
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-selected-current",
          fileName: "selected-current.xlsx",
          lifecycleState: "LAUNCH_FAILED",
          contentState: "DIRTY",
        }),
      ]);
      vi.spyOn(desktopAgent, "getDesktopAgentStatus").mockResolvedValue({
        health: {
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.10",
        },
        isInstalled: true,
        isSupported: true,
        supportsSelfUpdate: true,
      });
      const updateAgent = vi.spyOn(desktopAgent, "updateDesktopAgent");

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /Open selected\s+-\s+current\.xlsx as Master/,
        })
      );

      await expect(
        screen.findByText(
          "1 local Master session needs attention. Check in, discard, or recover it before updating Desktop Agent."
        )
      ).resolves.toBeTruthy();
      expect(
        screen.queryByRole("button", {
          name: "Release all Master locks and update",
        })
      ).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Update Desktop Agent" })
      ).toBeNull();
      expect(updateAgent).not.toHaveBeenCalled();
    });

    it("allows self-update when dirty local Master records are terminal recovery items", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.xlsx",
      });
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        value:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "openAttachmentInDesktopAgent").mockResolvedValue(
        null
      );
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([
        makeDesktopAgentSession({
          sessionId: "session-revoked-dirty",
          lockSessionId: "lock-session-revoked-dirty",
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-selected-current",
          fileName: "selected-current.xlsx",
          lifecycleState: "LOCK_REVOKED",
          contentState: "DIRTY",
        }),
        makeDesktopAgentSession({
          sessionId: "session-conflict-risk",
          lockSessionId: "lock-session-conflict-risk",
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-selected-current",
          fileName: "selected-current.xlsx",
          lifecycleState: "CONFLICT_RISK",
          contentState: "DIRTY",
        }),
      ]);
      vi.spyOn(desktopAgent, "getDesktopAgentStatus").mockResolvedValue({
        health: {
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.10",
        },
        isInstalled: true,
        isSupported: true,
        supportsSelfUpdate: true,
      });
      const updateAgent = vi
        .spyOn(desktopAgent, "updateDesktopAgent")
        .mockResolvedValue({
          ok: true,
          status: "STARTED",
          taskId: "update-task-1",
          downloadUrl:
            "http://localhost:3000/downloads/desktop-agent/windows/latest",
        });

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /Open selected\s+-\s+current\.xlsx as Master/,
        })
      );
      fireEvent.click(
        await screen.findByRole("button", { name: "Update Desktop Agent" })
      );

      await waitFor(() => {
        expect(updateAgent).toHaveBeenCalledOnce();
      });
      expect(
        screen.queryByText(
          "2 local Master sessions need attention. Check in, discard, or recover them before updating Desktop Agent."
        )
      ).toBeNull();
    });

    it("falls back to installer guidance when the local agent has no update endpoint", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.xlsx",
      });
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        value:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      });
      vi.stubEnv(
        "NEXT_PUBLIC_DESKTOP_AGENT_WINDOWS_DOWNLOAD_URL",
        "https://downloads.projectwing.test/agent/windows.exe"
      );
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "openAttachmentInDesktopAgent").mockResolvedValue(
        null
      );
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([]);
      vi.spyOn(desktopAgent, "getDesktopAgentStatus").mockResolvedValue({
        health: {
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.9",
        },
        isInstalled: true,
        isSupported: true,
        supportsSelfUpdate: false,
      });
      const updateAgent = vi.spyOn(desktopAgent, "updateDesktopAgent");

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /Open selected\s+-\s+current\.xlsx as Master/,
        })
      );

      await waitFor(() => {
        expect(screen.queryByText("Endpoint not found.")).toBeNull();
        expect(
          screen.getByRole("button", { name: "Update Desktop Agent" })
        ).toBeDisabled();
        expect(screen.getByRole("button", { name: "Exit" })).toBeTruthy();
        expect(
          screen.getByText(
            "This Desktop Agent is too old to update itself. Download and run the latest installer, then retry Master."
          )
        ).toBeTruthy();
      });
      expect(updateAgent).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("link", {
          name: "Download Desktop Agent for Windows",
        })
      ).toBeNull();
    });

    it("explains when the local agent is not running instead of showing legacy update guidance", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.xlsx",
      });
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        value:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      });
      vi.stubEnv(
        "NEXT_PUBLIC_DESKTOP_AGENT_WINDOWS_DOWNLOAD_URL",
        "https://downloads.projectwing.test/agent/windows.exe"
      );
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "openAttachmentInDesktopAgent").mockResolvedValue(
        null
      );
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([]);
      vi.spyOn(desktopAgent, "getDesktopAgentStatus").mockResolvedValue({
        health: null,
        isInstalled: false,
        isSupported: false,
        supportsSelfUpdate: false,
      });

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /Open selected\s+-\s+current\.xlsx as Master/,
        })
      );

      await waitFor(() => {
        expect(
          screen.getByText(
            "No available local service was detected. Connect it in Settings, then return to open your file."
          )
        ).toBeTruthy();
        expect(
          screen.queryByText(
            "This Desktop Agent is too old to update itself. Download and run the latest installer, then retry Master."
          )
        ).toBeNull();
        expect(
          screen.queryByRole("button", { name: "Update Desktop Agent" })
        ).toBeNull();
      });
      expect(
        screen.queryByRole("link", {
          name: "Download Desktop Agent for Windows",
        })
      ).toBeNull();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    });

    it("surfaces Excel automation diagnostics in the desktop agent fallback prompt", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.xlsx",
      });
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        value:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "openAttachmentInDesktopAgent").mockResolvedValue(
        null
      );
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([]);
      vi.spyOn(desktopAgent, "getDesktopAgentStatus").mockResolvedValue({
        health: {
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.10",
          diagnostics: {
            excel: {
              status: "NEEDS_ATTENTION",
              checkedAt: "2026-06-15T12:00:00.000Z",
              comAutomation: "UNAVAILABLE",
              hiddenAutomationProcessCount: 2,
              hiddenAutomationProcessIds: [1234, 5678],
              message: "Excel COM automation is unavailable.",
              recommendedAction:
                "Close hidden Excel automation processes or repair Office.",
            },
          },
        },
        isInstalled: true,
        isSupported: true,
        supportsSelfUpdate: true,
      });

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /Open selected\s+-\s+current\.xlsx as Master/,
        })
      );

      await expect(
        screen.findByText(
          "Hidden Excel automation processes were detected (2). Close them from Task Manager or restart Windows before retrying Master."
        )
      ).resolves.toBeTruthy();
    });

    it("explains missing Excel without prompting users to update the desktop agent", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.xlsx",
      });
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        value:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      });
      vi.stubEnv(
        "NEXT_PUBLIC_DESKTOP_AGENT_WINDOWS_DOWNLOAD_URL",
        "https://downloads.projectwing.test/agent/windows.exe"
      );
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "openAttachmentInDesktopAgent").mockResolvedValue(
        null
      );
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([]);
      vi.spyOn(desktopAgent, "getDesktopAgentStatus").mockResolvedValue({
        health: {
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.11",
          diagnostics: {
            excel: {
              status: "MISSING",
              installed: false,
              checkedAt: "2026-06-15T12:00:00.000Z",
              comAutomation: "UNAVAILABLE",
              hiddenAutomationProcessCount: 0,
              message: "Microsoft Excel is not installed or registered.",
              recommendedAction:
                "Install Microsoft Excel, then restart Desktop Agent.",
            },
          },
        },
        isInstalled: true,
        isSupported: true,
        supportsSelfUpdate: true,
      });

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /Open selected\s+-\s+current\.xlsx as Master/,
        })
      );

      await expect(
        screen.findByText(
          "Microsoft Excel was not detected. Install Microsoft 365 or Office, then retry Master. You can still download a read-only copy."
        )
      ).resolves.toBeTruthy();
      expect(
        screen.queryByRole("button", { name: "Update Desktop Agent" })
      ).toBeNull();
      expect(
        screen.queryByRole("link", {
          name: "Download Desktop Agent for Windows",
        })
      ).toBeNull();
    });

    it("explains missing Word without prompting users to update the desktop agent", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.docx",
      });
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        value:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      });
      vi.stubEnv(
        "NEXT_PUBLIC_DESKTOP_AGENT_WINDOWS_DOWNLOAD_URL",
        "https://downloads.projectwing.test/agent/windows.exe"
      );
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "openAttachmentInDesktopAgent").mockResolvedValue(
        null
      );
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([]);
      vi.spyOn(desktopAgent, "getDesktopAgentStatus").mockResolvedValue({
        health: {
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.11",
          diagnostics: {
            word: {
              status: "MISSING",
              installed: false,
              checkedAt: "2026-06-15T12:00:00.000Z",
              comAutomation: "UNAVAILABLE",
              hiddenAutomationProcessCount: 0,
              message: "Microsoft Word is not installed or registered.",
              recommendedAction:
                "Install Microsoft Word, then restart Desktop Agent.",
            },
          },
        },
        isInstalled: true,
        isSupported: true,
        supportsSelfUpdate: true,
      });

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /Open selected\s+-\s+current\.docx as Master/,
        })
      );

      await expect(
        screen.findByText(
          "Microsoft Word was not detected. Install Microsoft 365 or Office, then retry Master. You can still download a read-only copy."
        )
      ).resolves.toBeTruthy();
      expect(
        screen.queryByRole("button", { name: "Update Desktop Agent" })
      ).toBeNull();
      expect(
        screen.queryByRole("link", {
          name: "Download Desktop Agent for Windows",
        })
      ).toBeNull();
    });

    it("explains missing PowerPoint without prompting users to update the desktop agent", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.pptx",
      });
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        value:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      });
      vi.stubEnv(
        "NEXT_PUBLIC_DESKTOP_AGENT_WINDOWS_DOWNLOAD_URL",
        "https://downloads.projectwing.test/agent/windows.exe"
      );
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "openAttachmentInDesktopAgent").mockResolvedValue(
        null
      );
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([]);
      vi.spyOn(desktopAgent, "getDesktopAgentStatus").mockResolvedValue({
        health: {
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.11",
          diagnostics: {
            powerPoint: {
              status: "MISSING",
              installed: false,
              checkedAt: "2026-06-15T12:00:00.000Z",
              comAutomation: "UNAVAILABLE",
              hiddenAutomationProcessCount: 0,
              message: "Microsoft PowerPoint is not installed or registered.",
              recommendedAction:
                "Install Microsoft PowerPoint, then restart Desktop Agent.",
            },
          },
        },
        isInstalled: true,
        isSupported: true,
        supportsSelfUpdate: true,
      });

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /Open selected\s+-\s+current\.pptx as Master/,
        })
      );

      await expect(
        screen.findByText(
          "Microsoft PowerPoint was not detected. Install Microsoft 365 or Office, then retry Master. You can still download a read-only copy."
        )
      ).resolves.toBeTruthy();
      expect(
        screen.queryByRole("button", { name: "Update Desktop Agent" })
      ).toBeNull();
      expect(
        screen.queryByRole("link", {
          name: "Download Desktop Agent for Windows",
        })
      ).toBeNull();
    });

    it("explains missing Excel when the available agent rejects Master open", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.xlsx",
      });
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        value:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "openAttachmentInDesktopAgent").mockRejectedValue(
        new desktopAgent.DesktopAgentClientError(
          "EXCEL_NOT_INSTALLED",
          "Microsoft Excel is not installed or registered."
        )
      );
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([]);
      vi.spyOn(desktopAgent, "getDesktopAgentStatus").mockResolvedValue({
        health: {
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.11",
        },
        isInstalled: true,
        isSupported: true,
        supportsSelfUpdate: true,
      });

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /Open selected\s+-\s+current\.xlsx as Master/,
        })
      );

      await expect(
        screen.findByText(
          "Microsoft Excel was not detected. Install Microsoft 365 or Office, then retry Master. You can still download a read-only copy."
        )
      ).resolves.toBeTruthy();
      expect(
        screen.queryByText("Microsoft Excel is not installed or registered.")
      ).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Update Desktop Agent" })
      ).toBeNull();
      expect(
        screen.queryByRole("link", {
          name: "Download Desktop Agent for Windows",
        })
      ).toBeNull();
    });

    it("explains missing PDF editor when the available agent rejects PDF Master open", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.pdf",
      });
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        value:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "openAttachmentInDesktopAgent").mockRejectedValue(
        new desktopAgent.DesktopAgentClientError(
          "PDF_EDITOR_NOT_INSTALLED",
          "A supported PDF editor is required for PDF Master editing."
        )
      );
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([]);
      vi.spyOn(desktopAgent, "getDesktopAgentStatus").mockResolvedValue({
        health: {
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.11",
        },
        isInstalled: true,
        isSupported: true,
        supportsSelfUpdate: true,
      });

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /Open selected\s+-\s+current\.pdf as Master/,
        })
      );

      await expect(
        screen.findByText(
          "A supported PDF editor was not detected. Install Adobe Acrobat, PDF-XChange Editor, Foxit PDF Editor, or PDF Master Editor, then retry Master. You can still download a read-only copy."
        )
      ).resolves.toBeTruthy();
      expect(
        screen.queryByText(
          "A supported PDF editor is required for PDF Master editing."
        )
      ).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Update Desktop Agent" })
      ).toBeNull();
      expect(
        screen.queryByRole("link", {
          name: "Download Desktop Agent for Windows",
        })
      ).toBeNull();
    });

    it("prioritizes updating an outdated desktop agent over PDF editor guidance", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.pdf",
      });
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        value:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "openAttachmentInDesktopAgent").mockRejectedValue(
        new desktopAgent.DesktopAgentClientError(
          "PDF_EDITOR_NOT_INSTALLED",
          "A supported PDF editor is required for PDF Master editing."
        )
      );
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([]);
      vi.spyOn(desktopAgent, "getDesktopAgentStatus").mockResolvedValue({
        health: {
          ok: true,
          app: "project-wing-desktop-runtime",
          version: "0.1.23",
          managerVersion: "1.0.0",
          agentVersion: "0.1.23",
          agentState: "READY",
          updateState: "IDLE",
          restoreState: "READY",
          attentionCount: 0,
        },
        isInstalled: true,
        isSupported: false,
        supportsSelfUpdate: true,
      });
      const updateAgent = vi
        .spyOn(desktopAgent, "updateDesktopAgent")
        .mockResolvedValue({
          ok: true,
          status: "STARTED",
          taskId: "update-task-1",
          downloadUrl:
            "http://localhost:3000/downloads/desktop-agent/windows/latest",
        });

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /Open selected\s+-\s+current\.pdf as Master/,
        })
      );

      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText("Update ready")).toBeTruthy();
      expect(
        within(dialog).getByText(
          "Update Desktop Agent, then Master will retry."
        )
      ).toBeTruthy();
      expect(
        within(dialog).getByRole("button", { name: "Update Desktop Agent" })
      ).toBeTruthy();
      expect(
        within(dialog).queryByText(
          "A supported PDF editor was not detected. Install Adobe Acrobat, PDF-XChange Editor, Foxit PDF Editor, or PDF Master Editor, then retry Master. You can still download a read-only copy."
        )
      ).toBeNull();

      fireEvent.click(
        within(dialog).getByRole("button", { name: "Update Desktop Agent" })
      );

      await waitFor(() => {
        expect(updateAgent).toHaveBeenCalledOnce();
      });
    });

    it("omits installer actions when no Windows installer URL is configured", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.xlsx",
      });
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        value:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      });
      vi.stubEnv("NEXT_PUBLIC_DESKTOP_AGENT_WINDOWS_DOWNLOAD_URL", "");
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "openAttachmentInDesktopAgent").mockResolvedValue(
        null
      );
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([]);
      vi.spyOn(desktopAgent, "getDesktopAgentStatus").mockResolvedValue({
        health: null,
        isInstalled: false,
        isSupported: false,
        supportsSelfUpdate: false,
      });

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /Open selected\s+-\s+current\.xlsx as Master/,
        })
      );

      await expect(
        screen.findByRole("button", { name: "Go to settings" })
      ).resolves.toBeTruthy();
      expect(
        screen.queryByRole("button", { name: "Installer unavailable" })
      ).toBeNull();
      expect(
        screen.queryByRole("link", {
          name: "Download Desktop Agent for Windows",
        })
      ).toBeNull();
      expect(
        screen.getByText(
          "No available local service was detected. Connect it in Settings, then return to open your file."
        )
      ).toBeTruthy();
    });

    it("guides setup instead of downloading when the desktop agent rejects read-only open", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.xlsx",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const openInAgent = vi
        .spyOn(desktopAgent, "openAttachmentInDesktopAgent")
        .mockRejectedValue(new Error("Desktop agent request failed."));
      const downloadReadOnly = vi
        .spyOn(api, "downloadAttachmentReadOnly")
        .mockResolvedValue(new Blob(["read-only"]));

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      await openProjectFileContextMenu(/selected\s+-\s+current\.xlsx/);
      fireEvent.click(
        screen.getByRole("menuitem", { name: "Open (Read Only)" })
      );

      await waitFor(() => {
        expect(openInAgent).toHaveBeenCalledWith({
          mode: "READ_ONLY",
          projectId: "project-1",
          attachmentId: "attachment-selected-current",
          fileName: "A01-0001-F001 selected - current.xlsx",
          baseVersion: 1,
          baseVersionId: undefined,
          cacheVersionId: "attachment-selected-current:v1",
          contentHash: undefined,
          contentToken: "attachment-selected-current:v1",
          fileSize: 2048,
        });
      });
      expect(downloadReadOnly).not.toHaveBeenCalled();
      await expect(
        screen.findByRole("heading", {
          name: "Install or update Desktop Agent",
        })
      ).resolves.toBeTruthy();
    });

    it("edits project file refcode from the ref column", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.pdf",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const updateAttachmentIdentity = vi
        .spyOn(api, "updateAttachmentIdentity")
        .mockResolvedValue({
          ...projectAttachment,
          code: "A01-0001-F009",
        });

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /Edit refcode for selected\s+-\s+current\.pdf/,
        })
      );
      const refcodeInput = screen.getByRole("textbox", {
        name: /Edit refcode for selected\s+-\s+current\.pdf/,
      });
      fireEvent.change(refcodeInput, {
        target: { value: "A01-0001-F009" },
      });
      fireEvent.keyDown(refcodeInput, { key: "Enter", code: "Enter" });

      await waitFor(() => {
        expect(updateAttachmentIdentity).toHaveBeenCalledWith(
          "project-1",
          "attachment-selected-current",
          { code: "A01-0001-F009" }
        );
      });
      expect(
        screen.queryByRole("textbox", {
          name: /Edit refcode for selected\s+-\s+current\.pdf/,
        })
      ).toBeNull();
    }, 10_000);

    it("places project file copy/cut actions on the clipboard", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.pdf",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const setAttachmentClipboard = vi.fn();

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        onSetAttachmentClipboard: setAttachmentClipboard,
      });

      await screen.findByRole("columnheader", { name: "Ref" });

      await openProjectFileContextMenu(/selected\s+-\s+current\.pdf/);
      expect(
        screen.queryByRole("menuitem", { name: "Copy/Move To" })
      ).toBeNull();
      expect(screen.queryByRole("menuitem", { name: "Move" })).toBeNull();
      const copyItem = screen.getByRole("menuitem", { name: "Copy" });
      await waitFor(() => {
        expect(copyItem).not.toHaveAttribute("aria-disabled", "true");
      });
      fireEvent.click(copyItem);
      await waitFor(() => {
        expect(setAttachmentClipboard).toHaveBeenCalledWith({
          mode: "copy",
          file: {
            attachmentId: "attachment-selected-current",
            bucket: "CURRENT",
            fileName: "selected - current.pdf",
            nodeId: "node-3",
            paperId: "working-paper-1",
          },
          files: [
            {
              attachmentId: "attachment-selected-current",
              bucket: "CURRENT",
              fileName: "selected - current.pdf",
              nodeId: "node-3",
              paperId: "working-paper-1",
            },
          ],
        });
      });

      await openProjectFileContextMenu(/selected\s+-\s+current\.pdf/);
      const moveItem = screen.getByRole("menuitem", { name: "Cut" });
      await waitFor(() => {
        expect(moveItem).not.toHaveAttribute("aria-disabled", "true");
      });
      fireEvent.click(moveItem);
      await waitFor(() => {
        expect(setAttachmentClipboard).toHaveBeenLastCalledWith({
          mode: "move",
          file: {
            attachmentId: "attachment-selected-current",
            bucket: "CURRENT",
            fileName: "selected - current.pdf",
            nodeId: "node-3",
            paperId: "working-paper-1",
          },
          files: [
            {
              attachmentId: "attachment-selected-current",
              bucket: "CURRENT",
              fileName: "selected - current.pdf",
              nodeId: "node-3",
              paperId: "working-paper-1",
            },
          ],
        });
      });
    }, 10_000);

    it("moves selected project files through the project tree dialog", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.pdf",
      });
      const targetNode: WorkflowNode = {
        id: "node-reporting",
        parentId: null,
        code: "B",
        title: "Reporting",
        level: 1,
        nodeType: "PHASE",
        workingPapers: [],
        children: [],
      };
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const moveAttachmentsToNode = vi.fn();

      renderContent({
        projectName: "Orchid 2026 annual audit",
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode, targetNode],
        onMoveAttachmentsToNode: moveAttachmentsToNode,
      });

      await openProjectFileContextMenu(/selected\s+-\s+current\.pdf/);
      const moveToItem = screen.getByRole("menuitem", { name: "Move to" });
      await waitFor(() => {
        expect(moveToItem).not.toHaveAttribute("aria-disabled", "true");
      });
      fireEvent.click(moveToItem);

      const dialog = await screen.findByRole("dialog", { name: "Move to" });
      expect(within(dialog).getByText("Orchid 2026 annual audit")).toBeTruthy();
      expect(
        dialog.querySelector('[role="treeitem"][aria-disabled="true"]')
      ).toBeTruthy();
      expect(
        within(dialog).getByRole("treeitem", { name: /Current location/ })
      ).toBeDisabled();

      fireEvent.change(
        within(dialog).getByRole("textbox", {
          name: "Search folders or files",
        }),
        { target: { value: "Reporting" } }
      );
      expect(
        within(dialog).queryByRole("treeitem", { name: /Assets/ })
      ).toBeNull();
      fireEvent.click(
        within(dialog).getByRole("treeitem", { name: /Reporting/ })
      );
      const moveHere = within(dialog).getByRole("button", {
        name: "Move here",
      });
      await waitFor(() => expect(moveHere).not.toBeDisabled());
      fireEvent.click(moveHere);

      expect(moveAttachmentsToNode).toHaveBeenCalledWith(
        [
          {
            attachmentId: "attachment-selected-current",
            bucket: "CURRENT",
            fileName: "selected - current.pdf",
            nodeId: "node-3",
            paperId: "working-paper-1",
          },
        ],
        targetNode
      );
    }, 10_000);

    it("keeps project file paste visible but disabled without a clipboard item", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.pdf",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const pasteAttachmentClipboard = vi.fn();

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        onPasteAttachmentClipboard: pasteAttachmentClipboard,
      });

      await openProjectFileContextMenu(/selected\s+-\s+current\.pdf/);

      const pasteItem = screen.getByRole("menuitem", { name: "Paste" });
      expect(pasteItem).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(pasteItem);
      expect(pasteAttachmentClipboard).not.toHaveBeenCalled();
    });

    it("shows project file paste from populated list blank space", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.pdf",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const pasteAttachmentClipboard = vi.fn();

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        attachmentClipboard: {
          mode: "copy",
          file: {
            attachmentId: "attachment-selected-current",
            bucket: "CURRENT",
            fileName: "selected-current.pdf",
            nodeId: "node-3",
            paperId: "working-paper-1",
          },
        },
        onPasteAttachmentClipboard: pasteAttachmentClipboard,
      });

      const blankTarget = await screen.findByTestId(
        "project-file-blank-context-target"
      );
      fireEvent.contextMenu(blankTarget);

      const pasteItem = screen.getByRole("menuitem", { name: "Paste" });
      expect(pasteItem).not.toHaveAttribute("aria-disabled", "true");
      fireEvent.click(pasteItem);

      expect(pasteAttachmentClipboard).toHaveBeenCalledWith(
        thirdLevelNodeWithFile
      );
    });

    it("does not show a toast when project file refcode validation rejects", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.pdf",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const updateAttachmentIdentity = vi
        .spyOn(api, "updateAttachmentIdentity")
        .mockRejectedValue(
          new Error("File code must use A01-0001-F001 format")
        );

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
      });

      await screen.findByRole("columnheader", { name: "Ref" });
      await openProjectFileContextMenu(/selected\s+-\s+current\.pdf/);
      fireEvent.click(screen.getByRole("menuitem", { name: "Change Refcode" }));
      fireEvent.change(screen.getByLabelText("New refcode"), {
        target: { value: "A01-0001-F009" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save refcode" }));
      await waitFor(() => {
        expect(updateAttachmentIdentity).toHaveBeenCalledWith(
          "project-1",
          "attachment-selected-current",
          { code: "A01-0001-F009" }
        );
      });
      await act(async () => {
        await Promise.resolve();
      });

      const toasts = [...document.querySelectorAll(".cn-toast")];
      expect(
        toasts.some((toast) =>
          toast.textContent?.includes("File code must use A01-0001-F001 format")
        )
      ).toBeFalsy();
    }, 10_000);

    it("keeps printable keys inside the refcode and rename editors", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.pdf",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      renderContent({ selectedNode: thirdLevelNodeWithFile });

      await openProjectFileContextMenu(/selected\s+-\s+current\.pdf/);
      fireEvent.click(screen.getByRole("menuitem", { name: "Change Refcode" }));
      const refcode = screen.getByLabelText("New refcode");
      const leakedRefcodeKey = vi.fn();
      document.addEventListener("keydown", leakedRefcodeKey);
      fireEvent.keyDown(refcode, { key: "9", code: "Digit9" });
      fireEvent.change(refcode, { target: { value: "A01-0001-F009" } });
      expect(refcode).toHaveValue("A01-0001-F009");
      expect(leakedRefcodeKey).not.toHaveBeenCalled();
      document.removeEventListener("keydown", leakedRefcodeKey);

      fireEvent.click(
        screen.getByRole("button", { name: "Back to file actions" })
      );
      fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
      const displayName = screen.getByLabelText("File display name");
      const leakedNameKey = vi.fn();
      document.addEventListener("keydown", leakedNameKey);
      fireEvent.keyDown(displayName, { key: "x", code: "KeyX" });
      fireEvent.change(displayName, {
        target: { value: "selected-current-x.pdf" },
      });
      expect(displayName).toHaveValue("selected-current-x.pdf");
      expect(leakedNameKey).not.toHaveBeenCalled();
      document.removeEventListener("keydown", leakedNameKey);
    });

    it("restores an earlier version from the project file action menu", async () => {
      const projectAttachment = {
        ...makeProjectAttachment({
          id: "attachment-selected-current",
          originalName: "selected-current.pdf",
        }),
        version: 2,
      };
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(api, "attachmentHistory").mockResolvedValue({
        attachment: projectAttachment,
        events: [],
        versions: [
          {
            id: "version-1",
            attachmentId: "attachment-selected-current",
            projectId: "project-1",
            version: 1,
            fileKind: "SUPPORTING",
            fileName: "selected-current-v1.pdf",
            originalName: "selected-current-v1.pdf",
            fileUrl: "working-papers/project-1/selected-current-v1.pdf",
            fileSize: 1024,
            mimeType: "application/pdf",
            uploadedAt: "2026-06-01T08:00:00.000Z",
            archivedBy: "current-user",
            createdAt: "2026-06-01T09:00:00.000Z",
          },
        ],
      });
      const restoreAttachmentVersion = vi
        .spyOn(api, "restoreAttachmentVersion")
        .mockResolvedValue({
          ...projectAttachment,
          version: 3,
        });
      const downloadAttachmentVersion = vi
        .spyOn(api, "downloadAttachmentVersion")
        .mockResolvedValue(
          new Blob(["version-1"], { type: "application/pdf" })
        );

      renderContent({
        currentUserId: "current-user",
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      await screen.findByRole("columnheader", { name: "Ref" });
      await openProjectFileContextMenu(/selected\s+-\s+current\.pdf/);
      fireEvent.click(screen.getByRole("menuitem", { name: "Reset head" }));
      expect(
        screen.queryByRole("button", { name: "Preview selected version" })
      ).toBeNull();
      fireEvent.click(
        within(
          await screen.findByRole("radiogroup", {
            name: "Reset head versions",
          })
        ).getByRole("radio", { name: /1$/ })
      );
      expect(downloadAttachmentVersion).not.toHaveBeenCalled();
      fireEvent.click(
        await screen.findByRole(
          "button",
          { name: "Reset head to 1" },
          { timeout: 5000 }
        )
      );

      await waitFor(() => {
        expect(restoreAttachmentVersion).toHaveBeenCalledWith(
          "project-1",
          "attachment-selected-current",
          "version-1"
        );
      });
    });

    it("keeps reset head version rows focused on modifier and modified time", async () => {
      const projectAttachment = {
        ...makeProjectAttachment({
          id: "attachment-selected-current",
          originalName: "selected-current.pdf",
        }),
        version: 3,
        headVersionId: "version-3",
      };
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(api, "attachmentHistory").mockResolvedValue({
        attachment: projectAttachment,
        events: [],
        versions: [
          {
            id: "version-1",
            attachmentId: "attachment-selected-current",
            projectId: "project-1",
            version: 1,
            parentVersionId: null,
            sourceVersionId: null,
            fileKind: "SUPPORTING",
            fileName: "selected-current-v1.pdf",
            originalName: "selected-current-v1.pdf",
            fileUrl: "working-papers/project-1/selected-current-v1.pdf",
            fileSize: 1024,
            mimeType: "application/pdf",
            uploadedAt: "2026-06-01T08:00:00.000Z",
            archivedBy: "user-1",
            action: "INITIAL",
            isCurrent: false,
            createdAt: "2026-06-01T08:00:00.000Z",
            uploadedByUser: {
              id: "user-1",
              name: "椤圭洰鍛樺伐",
              email: "preparer@projectwing.local",
            },
          },
          {
            id: "version-2",
            attachmentId: "attachment-selected-current",
            projectId: "project-1",
            version: 2,
            parentVersionId: "version-1",
            sourceVersionId: null,
            fileKind: "SUPPORTING",
            fileName: "selected-current-v2.pdf",
            originalName: "selected-current-v2.pdf",
            fileUrl: "working-papers/project-1/selected-current-v2.pdf",
            fileSize: 2048,
            mimeType: "application/pdf",
            uploadedAt: "2026-06-01T09:00:00.000Z",
            archivedBy: "user-2",
            action: "UPLOAD",
            isCurrent: false,
            createdAt: "2026-06-01T09:00:00.000Z",
            uploadedByUser: {
              id: "user-2",
              name: "Project partner",
              email: "partner@projectwing.local",
            },
          },
          {
            id: "version-3",
            attachmentId: "attachment-selected-current",
            projectId: "project-1",
            version: 3,
            parentVersionId: "version-2",
            sourceVersionId: "version-1",
            fileKind: "SUPPORTING",
            fileName: "selected-current.pdf",
            originalName: "selected-current.pdf",
            fileUrl: "working-papers/project-1/selected-current.pdf",
            fileSize: 3072,
            mimeType: "application/pdf",
            uploadedAt: "2026-06-01T10:00:00.000Z",
            archivedBy: "user-1",
            action: "RESTORE",
            isCurrent: true,
            createdAt: "2026-06-01T10:00:00.000Z",
            uploadedByUser: {
              id: "user-1",
              name: "椤圭洰鍛樺伐",
              email: "preparer@projectwing.local",
            },
          },
        ],
      });

      renderContent({
        currentUserId: "current-user",
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      await screen.findByRole("columnheader", { name: "Ref" });
      await openProjectFileContextMenu(/selected\s+-\s+current\.pdf/);
      fireEvent.click(screen.getByRole("menuitem", { name: "Reset head" }));

      await expect(
        screen.findByRole("heading", { name: "Reset head" })
      ).resolves.toBeTruthy();
      const resetHeadVersions = await screen.findByRole("radiogroup", {
        name: "Reset head versions",
      });
      const versionRows = within(resetHeadVersions).getAllByRole("radio");
      expect(versionRows[0]).toHaveClass("bg-background");
      expect(versionRows[0]).not.toHaveClass("bg-workbench-active");
      expect(versionRows[1]).not.toHaveClass("bg-workbench-active");
      expect(versionRows[2]).not.toHaveClass("bg-workbench-active");
      expect(screen.getByText("Select a history entry to reset.")).toBeTruthy();
      expect(within(resetHeadVersions).getByText("3")).toBeTruthy();
      expect(within(resetHeadVersions).getByText("2")).toBeTruthy();
      expect(within(resetHeadVersions).getByText("1")).toBeTruthy();
      expect(within(resetHeadVersions).queryByText("001")).toBeNull();
      const preparerLabels = await screen.findAllByText("preparer");
      expect(preparerLabels.length).toBeGreaterThan(0);
      expect(screen.getByText("partner")).toBeTruthy();
      expect(screen.queryByText("branched from 1")).toBeNull();
      expect(screen.queryByText("HEAD")).toBeNull();
      expect(screen.queryByText("Root")).toBeNull();
      expect(screen.queryByText("After 1")).toBeNull();
      expect(screen.queryByText("selected-current-v1.pdf")).toBeNull();
      expect(screen.queryByText("1.0 KB")).toBeNull();
      expect(
        screen.queryByText(
          /If Master is changed after this reset, versions after this point will be replaced/
        )
      ).toBeNull();
    });

    it("renders reset head candidates as disabled stateful controls while Master is locked", async () => {
      const projectAttachment = {
        ...makeProjectAttachment({
          id: "attachment-selected-current",
          originalName: "selected-current.pdf",
        }),
        lockedBy: "current-user",
        lockSessionId: "lock-session-current",
        lockHolder: {
          id: "current-user",
          name: "Current User",
          email: "current@projectwing.local",
        },
        version: 2,
        headVersionId: "version-2",
      };
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(api, "attachmentHistory").mockResolvedValue({
        attachment: projectAttachment,
        events: [],
        versions: [
          {
            id: "version-1",
            attachmentId: "attachment-selected-current",
            projectId: "project-1",
            version: 1,
            parentVersionId: null,
            sourceVersionId: null,
            fileKind: "SUPPORTING",
            fileName: "selected-current-v1.pdf",
            originalName: "selected-current-v1.pdf",
            fileUrl: "working-papers/project-1/selected-current-v1.pdf",
            fileSize: 1024,
            mimeType: "application/pdf",
            uploadedAt: "2026-06-01T08:00:00.000Z",
            archivedBy: "current-user",
            action: "INITIAL",
            isCurrent: false,
            createdAt: "2026-06-01T09:00:00.000Z",
          },
          {
            id: "version-2",
            attachmentId: "attachment-selected-current",
            projectId: "project-1",
            version: 2,
            parentVersionId: "version-1",
            sourceVersionId: null,
            fileKind: "SUPPORTING",
            fileName: "selected-current.pdf",
            originalName: "selected-current.pdf",
            fileUrl: "working-papers/project-1/selected-current.pdf",
            fileSize: 2048,
            mimeType: "application/pdf",
            uploadedAt: "2026-06-01T09:00:00.000Z",
            archivedBy: "current-user",
            action: "UPLOAD",
            isCurrent: true,
            createdAt: "2026-06-01T10:00:00.000Z",
          },
        ],
      });

      renderContent({
        currentUserId: "current-user",
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      await screen.findByRole("columnheader", { name: "Ref" });
      await openProjectFileContextMenu(/selected\s+-\s+current\.pdf/);
      fireEvent.click(screen.getByRole("menuitem", { name: "Reset head" }));

      await expect(
        screen.findByText("Release Master before resetting the head.")
      ).resolves.toBeTruthy();
      expect(screen.getByRole("button", { name: "Reset head" })).toBeDisabled();
      expect(screen.queryByText("HEAD")).toBeNull();
      expect(
        screen.getByText("Release Master before resetting the head.")
      ).toBeTruthy();
      expect(
        screen.queryByText(/Open this file as Master before restoring/)
      ).toBeNull();
    });

    it("shows both signoff actions directly in the project file sign-offs column", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.pdf",
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const prepareAttachment = vi
        .spyOn(api, "prepareAttachment")
        .mockResolvedValue({
          ...projectAttachment,
          preparedAt: "2026-06-05T09:00:00.000Z",
        });

      renderContent({
        currentUserId: "preparer-index",
        currentProjectRole: "PREPARER",
        selectedNode: thirdLevelNodeWithFile,
      });

      const prepareButton = await screen.findByRole("button", {
        name: /Add preparation signoff for selected\s+-\s+current\.pdf/,
      });
      const signoffsHeader = screen.getByRole("columnheader", {
        name: "Sign-offs",
      }) as HTMLTableCellElement;
      expect(screen.queryByRole("columnheader", { name: "Review" })).toBeNull();
      expect(prepareButton.closest("td")?.cellIndex).toBe(
        signoffsHeader.cellIndex
      );
      expect(prepareButton).toHaveClass(
        "bg-success-accent",
        "text-success-accent-foreground"
      );
      expect(prepareButton.parentElement).toHaveClass(
        "h-7",
        "w-[3.75rem]",
        "min-w-[3.75rem]",
        "items-center",
        "gap-1"
      );
      expect(
        screen
          .getByRole("button", {
            name: /Add review signoff for selected\s+-\s+current\.pdf/,
          })
          .closest("td")?.cellIndex
      ).toBe(signoffsHeader.cellIndex);
      expect(
        screen.getByRole("button", {
          name: /Add review signoff for selected\s+-\s+current\.pdf/,
        })
      ).toBeTruthy();
      expect(
        screen.getByRole("button", {
          name: /Add review signoff for selected\s+-\s+current\.pdf/,
        }).parentElement
      ).toHaveClass(
        "h-7",
        "w-[3.75rem]",
        "min-w-[3.75rem]",
        "items-center",
        "gap-1"
      );
      fireEvent.click(prepareButton);

      expect(screen.queryByText("Confirm preparation signoff")).toBeNull();

      await waitFor(() => {
        expect(prepareAttachment).toHaveBeenCalledWith(
          "project-1",
          "attachment-selected-current"
        );
      });
    });

    it.each([390, 767])(
      "keeps phone file records readable with list tools and direct signoff actions at %ipx",
      async (viewportWidth) => {
        setViewportWidth(viewportWidth);
        mockProjectFileTableContainerWidth(viewportWidth);
        const mobileFileName =
          "mobile_document_with_a_fully_readable_file_name.pdf";
        const projectAttachment = {
          ...makeProjectAttachment({
            id: `attachment-mobile-signoff-${viewportWidth}`,
            originalName: mobileFileName,
            workingPaper: {
              ...selectedWorkingPaperLocation,
              signoffs: [
                {
                  id: "mobile-preparer-current",
                  type: "PREPARER" as const,
                  roundNumber: 2,
                  attachmentVersion: 3,
                  signedAt: "2026-06-05T09:00:00.000Z",
                  user: {
                    id: "mobile-preparer",
                    name: "Mobile Preparer",
                    email: "preparer@projectwing.local",
                  },
                },
              ],
            },
          }),
          code: "A01-0001-F001-ARCHIVE",
        };
        vi.spyOn(api, "projectAttachments").mockResolvedValue([
          projectAttachment,
        ]);

        renderContent({ selectedNode: thirdLevelNodeWithFile });

        await screen.findByText(mobileFileName);
        const fileArea = await screen.findByRole("region", {
          name: "Project files",
        });
        expect(within(fileArea).queryAllByRole("columnheader")).toHaveLength(0);
        const records = within(fileArea).getAllByRole("article");
        expect(records).toHaveLength(1);
        expect(
          within(fileArea).getByRole("link", { name: mobileFileName })
        ).toBeVisible();
        expect(
          within(records[0]).getByText(projectAttachment.code)
        ).toBeVisible();
        fireEvent.click(
          within(fileArea).getByRole("button", { name: "List actions" })
        );
        const tools = await screen.findByRole("dialog", {
          name: "List actions",
        });
        expect(
          within(tools).queryByRole("region", { name: "Sort and filter" })
        ).toBeNull();
        await userEvent.keyboard("{Escape}");
        await waitFor(() =>
          expect(
            screen.queryByRole("dialog", { name: "List actions" })
          ).not.toBeInTheDocument()
        );

        const preparationButton = await screen.findByRole("button", {
          name: `Add preparation signoff for ${mobileFileName}`,
        });
        const reviewButton = screen.getByRole("button", {
          name: `Add review signoff for ${mobileFileName}`,
        });
        expect(preparationButton).toHaveAccessibleDescription(
          "Prepared signoff"
        );
        expect(reviewButton).toHaveAccessibleDescription("Pending review");
        expect(
          screen.queryByRole("button", {
            name: `Open signoff for ${mobileFileName}`,
          })
        ).toBeNull();
        expect(
          within(fileArea).getByLabelText(/Signed by Mobile Preparer/)
        ).toBeInTheDocument();
        expect(screen.queryByText(/Round \d/)).toBeNull();
      }
    );

    it.each([768, 900])(
      "keeps the full file table and horizontal signoff controls at %ipx",
      async (viewportWidth) => {
        setViewportWidth(viewportWidth);
        const projectAttachment = makeProjectAttachment({
          id: `attachment-tablet-${viewportWidth}`,
          originalName: "tablet_current.pdf",
        });
        vi.spyOn(api, "projectAttachments").mockResolvedValue([
          projectAttachment,
        ]);

        renderContent({ selectedNode: thirdLevelNodeWithFile });

        await screen.findByText(projectAttachment.originalName);
        const fileArea = await screen.findByRole("region", {
          name: "Project files",
        });
        expect(
          within(fileArea).getByRole("columnheader", { name: "Status" })
        ).toBeInTheDocument();
        expect(
          within(fileArea).getByRole("columnheader", { name: "Sign-offs" })
        ).toBeInTheDocument();

        const preparationButton = await screen.findByRole("button", {
          name: /Add preparation signoff for/,
        });
        const reviewButton = screen.getByRole("button", {
          name: /Add review signoff for/,
        });
        const signoffsHeader = within(fileArea).getByRole("columnheader", {
          name: "Sign-offs",
        }) as HTMLTableCellElement;
        expect(
          (preparationButton.closest("td") as HTMLTableCellElement | null)
            ?.cellIndex
        ).toBe(signoffsHeader.cellIndex);
        expect(
          (reviewButton.closest("td") as HTMLTableCellElement | null)?.cellIndex
        ).toBe(signoffsHeader.cellIndex);
      }
    );

    it("allows preparation signoff on a placeholder before file upload", async () => {
      const placeholder = {
        ...makeProjectAttachment({
          id: "attachment-placeholder-word",
          originalName: "Engagement letter.docx",
        }),
        fileUrl: "",
        fileSize: 0,
        version: 0,
        placeholderType: "WORD" as const,
      };
      vi.spyOn(api, "projectAttachments").mockResolvedValue([placeholder]);
      const prepareAttachment = vi
        .spyOn(api, "prepareAttachment")
        .mockResolvedValue(placeholder);

      renderContent({
        currentUserId: "preparer-index",
        currentProjectRole: "PREPARER",
        selectedNode: thirdLevelNodeWithFile,
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /Add preparation signoff for.*Engagement letter\.docx/,
        })
      );

      await waitFor(() => {
        expect(prepareAttachment).toHaveBeenCalledWith(
          "project-1",
          "attachment-placeholder-word"
        );
      });
    });

    it("allows ordinary project members to review directly from the project file sign-offs column", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.pdf",
        workingPaper: {
          ...selectedWorkingPaperLocation,
          signoffs: [
            {
              id: "signoff-preparer-current",
              type: "PREPARER" as const,
              signedAt: "2026-06-05T09:00:00.000Z",
              user: {
                id: "other-preparer",
                name: "Other Preparer",
                email: "other-preparer@projectwing.local",
              },
            },
          ],
        },
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const reviewAttachment = vi
        .spyOn(api, "reviewAttachment")
        .mockResolvedValue({
          ...projectAttachment,
          reviewedAt: "2026-06-05T10:00:00.000Z",
        });

      renderContent({
        currentUserId: "preparer-index",
        currentProjectRole: "PREPARER",
        selectedNode: thirdLevelNodeWithFile,
      });

      const reviewButton = await screen.findByRole("button", {
        name: /Add review signoff for selected\s+-\s+current\.pdf/,
      });
      const signoffsHeader = screen.getByRole("columnheader", {
        name: "Sign-offs",
      }) as HTMLTableCellElement;
      expect(reviewButton.closest("td")?.cellIndex).toBe(
        signoffsHeader.cellIndex
      );
      expect(reviewButton).toHaveClass(
        "bg-warning-accent",
        "text-warning-accent-foreground"
      );
      fireEvent.click(reviewButton);

      expect(screen.queryByText("Confirm review approval")).toBeNull();

      await waitFor(() => {
        expect(reviewAttachment).toHaveBeenCalledWith(
          "project-1",
          "attachment-selected-current"
        );
      });
    });

    it("allows project file review signoff with open review notes", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.pdf",
        workingPaper: {
          ...selectedWorkingPaperLocation,
          signoffs: [
            {
              id: "signoff-preparer-current",
              type: "PREPARER" as const,
              signedAt: "2026-06-05T09:00:00.000Z",
              user: {
                id: "other-preparer",
                name: "Other Preparer",
                email: "other-preparer@projectwing.local",
              },
            },
          ],
          reviewQuestions: [
            {
              id: "question-open",
              projectId: "project-1",
              workingPaperId: "working-paper-1",
              body: "Explain the variance.",
              status: "OPEN" as const,
              assignedToId: "preparer-index",
              createdById: "reviewer-index",
              createdAt: "2026-06-01T11:00:00.000Z",
              updatedAt: "2026-06-01T11:00:00.000Z",
              createdBy: {
                id: "reviewer-index",
                name: "Reviewer One",
                email: "reviewer-one@projectwing.local",
              },
            },
          ],
        },
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const reviewAttachment = vi
        .spyOn(api, "reviewAttachment")
        .mockResolvedValue({
          ...projectAttachment,
          reviewedAt: "2026-06-05T10:00:00.000Z",
        });

      renderContent({
        currentUserId: "reviewer-index",
        currentProjectRole: "REVIEWER",
        selectedNode: thirdLevelNodeWithFile,
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /Add review signoff for selected\s+-\s+current\.pdf/,
        })
      );

      await waitFor(() => {
        expect(reviewAttachment).toHaveBeenCalledWith(
          "project-1",
          "attachment-selected-current"
        );
      });
    });

    it("keeps a preparation signoff status visible in the project file sign-offs column", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.pdf",
        workingPaper: {
          ...selectedWorkingPaperLocation,
          signoffs: [
            {
              id: "signoff-preparer-current",
              type: "PREPARER" as const,
              signedAt: "2026-06-05T09:00:00.000Z",
              user: {
                id: "preparer-index",
                name: "Jony Ma",
                email: "partner@projectwing.local",
              },
            },
          ],
        },
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);

      renderContent({
        currentUserId: "preparer-index",
        currentProjectRole: "PREPARER",
        selectedNode: thirdLevelNodeWithFile,
      });

      const signerHistory = await screen.findByLabelText(/Signed by Jony Ma/);
      const signerHistoryLabel = signerHistory.getAttribute("aria-label") ?? "";
      expect(signerHistoryLabel).toMatch(/Jony Ma · 2026\/06\/05/);
      expect(signerHistoryLabel).not.toMatch(/\d{2}:\d{2}/);
      expect(screen.getAllByText("JM").length).toBeGreaterThan(0);
      expect(
        screen.getByRole("button", {
          name: /Add preparation signoff for selected\s+-\s+current\.pdf/,
        })
      ).toBeTruthy();
    });

    it("keeps a review signoff status visible in the project file sign-offs column", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.pdf",
        workingPaper: {
          ...selectedWorkingPaperLocation,
          signoffs: [
            {
              id: "signoff-preparer-current",
              type: "PREPARER" as const,
              signedAt: "2026-06-05T09:00:00.000Z",
              user: {
                id: "other-preparer",
                name: "Other Preparer",
                email: "other-preparer@projectwing.local",
              },
            },
            {
              id: "signoff-reviewer-current",
              type: "REVIEWER" as const,
              signedAt: "2026-06-05T10:00:00.000Z",
              user: {
                id: "reviewer-index",
                name: "Reviewer One",
                email: "reviewer-one@projectwing.local",
              },
            },
          ],
        },
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);

      renderContent({
        currentUserId: "reviewer-index",
        currentProjectRole: "REVIEWER",
        selectedNode: thirdLevelNodeWithFile,
      });

      await expect(
        screen.findByLabelText(/Signed by Reviewer One/)
      ).resolves.toBeTruthy();
      expect(
        screen.getByRole("button", {
          name: /Add review signoff for selected\s+-\s+current\.pdf/,
        })
      ).toBeTruthy();
    });

    it("removes one preparation signoff from the hover detail", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.pdf",
        workingPaper: {
          ...selectedWorkingPaperLocation,
          signoffs: [
            {
              id: "signoff-preparer-current",
              type: "PREPARER" as const,
              signedAt: "2026-06-05T09:00:00.000Z",
              user: {
                id: "preparer-index",
                name: "Preparer One",
                email: "preparer-one@projectwing.local",
              },
            },
          ],
        },
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const prepareAttachment = vi
        .spyOn(api, "prepareAttachment")
        .mockResolvedValue(projectAttachment);
      const removeWorkingPaperSignoff = vi
        .spyOn(api, "removeWorkingPaperSignoff")
        .mockResolvedValue({ id: "signoff-preparer-current" });

      renderContent({
        currentUserId: "preparer-index",
        currentProjectRole: "PREPARER",
        selectedNode: thirdLevelNodeWithFile,
      });

      await expect(
        screen.findByRole("button", {
          name: /Add preparation signoff for selected\s+-\s+current\.pdf/,
        })
      ).resolves.toBeTruthy();
      const signers = await screen.findByLabelText(/Signed by Preparer One/);
      fireEvent.click(
        within(signers).getByRole("button", {
          name: /Remove this preparation signoff: Preparer One/,
          hidden: true,
        })
      );

      await waitFor(() => {
        expect(removeWorkingPaperSignoff).toHaveBeenCalledWith(
          "project-1",
          "signoff-preparer-current"
        );
      });
      expect(prepareAttachment).not.toHaveBeenCalled();
    });

    it("removes the current user's review signoff from the R hover detail", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.pdf",
        workingPaper: {
          ...selectedWorkingPaperLocation,
          signoffs: [
            {
              id: "signoff-preparer-current",
              type: "PREPARER" as const,
              signedAt: "2026-06-05T09:00:00.000Z",
              user: {
                id: "preparer-index",
                name: "Preparer One",
                email: "preparer-one@projectwing.local",
              },
            },
            {
              id: "signoff-reviewer-current",
              type: "REVIEWER" as const,
              signedAt: "2026-06-05T10:00:00.000Z",
              user: {
                id: "reviewer-index",
                name: "Reviewer One",
                email: "reviewer-one@projectwing.local",
              },
            },
          ],
        },
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const reviewAttachment = vi
        .spyOn(api, "reviewAttachment")
        .mockResolvedValue(projectAttachment);
      const removeWorkingPaperSignoff = vi
        .spyOn(api, "removeWorkingPaperSignoff")
        .mockResolvedValue({ id: "signoff-reviewer-current" });

      renderContent({
        currentUserId: "reviewer-index",
        currentProjectRole: "REVIEWER",
        selectedNode: thirdLevelNodeWithFile,
      });

      const signers = await screen.findByLabelText(/Signed by Reviewer One/);
      fireEvent.click(
        within(signers).getByRole("button", {
          name: /Remove this review signoff: Reviewer One/,
          hidden: true,
        })
      );

      await waitFor(() => {
        expect(removeWorkingPaperSignoff).toHaveBeenCalledWith(
          "project-1",
          "signoff-reviewer-current"
        );
      });
      expect(reviewAttachment).not.toHaveBeenCalled();
    });

    it("appends a review signoff after the current user has already reviewed", async () => {
      const projectAttachment = makeProjectAttachment({
        id: "attachment-selected-current",
        originalName: "selected-current.pdf",
        workingPaper: {
          ...selectedWorkingPaperLocation,
          signoffs: [
            {
              id: "signoff-preparer-current",
              type: "PREPARER" as const,
              signedAt: "2026-06-05T09:00:00.000Z",
              user: {
                id: "other-preparer",
                name: "Other Preparer",
                email: "other-preparer@projectwing.local",
              },
            },
            {
              id: "signoff-reviewer-current",
              type: "REVIEWER" as const,
              signedAt: "2026-06-05T10:00:00.000Z",
              user: {
                id: "reviewer-index",
                name: "Reviewer One",
                email: "reviewer-one@projectwing.local",
              },
            },
          ],
        },
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      const reviewAttachment = vi
        .spyOn(api, "reviewAttachment")
        .mockResolvedValue(projectAttachment);

      renderContent({
        currentUserId: "reviewer-index",
        currentProjectRole: "REVIEWER",
        selectedNode: thirdLevelNodeWithFile,
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /Add review signoff for selected\s+-\s+current\.pdf/,
        })
      );

      await waitFor(() => {
        expect(reviewAttachment).toHaveBeenCalledWith(
          "project-1",
          "attachment-selected-current"
        );
      });
    });

    it("does not open another Master session for the current user's locked project file", async () => {
      const projectAttachment = {
        ...makeProjectAttachment({
          id: "attachment-selected-current",
          originalName: "selected-current.pdf",
        }),
        lockedBy: "current-user",
        lockSessionId: "lock-session-current",
        lockHolder: {
          id: "current-user",
          name: "Current User",
          email: "current@projectwing.local",
        },
      };
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([
        makeDesktopAgentSession({
          sessionId: "session-current",
          lockSessionId: "lock-session-current",
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-selected-current",
          fileName: "selected-current.pdf",
          localPath:
            "C:\\Users\\User\\AppData\\Local\\ProjectWing\\AgentCache\\selected-current.pdf",
          originalHash: "hash-1",
          lastKnownHash: "hash-1",
          grantSecret: "grant-secret",
          status: "OPEN_UNCHANGED",
          openedAt: "2026-06-05T02:00:00.000Z",
          lastSeenAt: "2026-06-05T02:05:00.000Z",
        }),
      ]);
      const downloadMaster = vi
        .spyOn(api, "downloadAttachment")
        .mockResolvedValue(new Blob(["master"]));

      renderContent({
        currentUserId: "current-user",
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      const fileName = await screen.findByRole("button", {
        name: /Open selected\s+-\s+current\.pdf as Master/,
      });

      expect(fileName).toBeDisabled();
      fireEvent.click(fileName);
      expect(downloadMaster).not.toHaveBeenCalled();
    });

    it("releases the current user's Master from the project file action menu through the desktop agent", async () => {
      const projectAttachment = {
        ...makeProjectAttachment({
          id: "attachment-selected-current",
          originalName: "selected-current.pdf",
        }),
        lockedBy: "current-user",
        lockSessionId: "lock-session-current",
        lockHolder: {
          id: "current-user",
          name: "Current User",
          email: "current@projectwing.local",
        },
      };
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([
        makeDesktopAgentSession({
          sessionId: "session-current",
          lockSessionId: "lock-session-current",
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-selected-current",
          fileName: "selected-current.pdf",
          localPath:
            "C:\\Users\\User\\AppData\\Local\\ProjectWing\\AgentCache\\selected-current.pdf",
          originalHash: "hash-1",
          lastKnownHash: "hash-1",
          grantSecret: "grant-secret",
          status: "OPEN_UNCHANGED",
          openedAt: "2026-06-05T02:00:00.000Z",
          lastSeenAt: "2026-06-05T02:05:00.000Z",
        }),
      ]);
      const checkIn = vi.spyOn(desktopAgent, "checkInDesktopAgentSession");
      const release = vi
        .spyOn(desktopAgent, "releaseDesktopAgentSession")
        .mockResolvedValue(
          makeDesktopAgentSession({
            sessionId: "session-current",
            lockSessionId: "lock-session-current",
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-selected-current",
            fileName: "selected-current.pdf",
            localPath:
              "C:\\Users\\User\\AppData\\Local\\ProjectWing\\AgentCache\\selected-current.pdf",
            originalHash: "hash-1",
            lastKnownHash: "hash-1",
            grantSecret: "grant-secret",
            status: "CLOSED",
            openedAt: "2026-06-05T02:00:00.000Z",
            lastSeenAt: "2026-06-05T02:05:00.000Z",
          })
        );
      const unlockAttachment = vi.spyOn(api, "unlockAttachment");

      renderContent({
        currentUserId: "current-user",
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      await openProjectFileContextMenu(/selected\s+-\s+current\.pdf/);
      fireEvent.click(screen.getByRole("menuitem", { name: "Release Master" }));

      await waitFor(() => {
        expect(release).toHaveBeenCalledWith({
          sessionId: "session-current",
          lockSessionId: "lock-session-current",
          projectId: "project-1",
          attachmentId: "attachment-selected-current",
        });
      });
      expect(checkIn).not.toHaveBeenCalled();
      expect(unlockAttachment).not.toHaveBeenCalled();
    });

    it("offers Master recovery when the current user's lock has no local tracking session", async () => {
      const projectAttachment = {
        ...makeProjectAttachment({
          id: "attachment-selected-current",
          originalName: "selected-current.xlsx",
        }),
        lockedBy: "current-user",
        lockSessionId: "lock-session-current",
        lockHolder: {
          id: "current-user",
          name: "Current User",
          email: "current@projectwing.local",
        },
      };
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        projectAttachment,
      ]);
      vi.spyOn(desktopAgent, "listDesktopAgentSessions").mockResolvedValue([]);
      const openInAgent = vi
        .spyOn(desktopAgent, "openAttachmentInDesktopAgent")
        .mockResolvedValue({
          ok: true,
          sessionId: "session-recovered",
          localPath:
            "C:\\Users\\User\\AppData\\Local\\ProjectWing\\AgentCache\\selected-current.xlsx",
          openedAt: "2026-06-05T02:00:00.000Z",
        });

      renderContent({
        currentUserId: "current-user",
        selectedNode: thirdLevelNodeWithFile,
        workflow: [secondLevelNode],
      });

      await openProjectFileContextMenu(/selected\s+-\s+current\.xlsx/);
      fireEvent.click(
        screen.getByRole("menuitem", { name: "Recover Master session" })
      );

      await waitFor(() => {
        expect(openInAgent).toHaveBeenCalledWith({
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-selected-current",
          fileName: "A01-0001-F001 selected - current.xlsx",
        });
      });
    });

    it("shows only files that belong directly to the selected folder", async () => {
      const secondLevelWorkingPaperLocation = {
        ...selectedWorkingPaperLocation,
        id: "working-paper-second-level",
        code: "A01-F001",
        title: "A01 direct file",
        workflowNodeId: "node-2",
        workflowNodeCode: "A01",
        workflowNodeTitle: "Assets",
        path: [
          { id: "node-1", code: "Execution", title: "Execution", level: 1 },
          { id: "node-2", code: "A01", title: "Assets", level: 2 },
        ],
      };
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        makeProjectAttachment({
          id: "attachment-direct-a01",
          originalName: "direct-a01.pdf",
          workingPaper: secondLevelWorkingPaperLocation,
        }),
        makeProjectAttachment({
          id: "attachment-child-a01",
          originalName: "child-a01.pdf",
        }),
        makeProjectAttachment({
          id: "attachment-outside-a01",
          originalName: "outside-a01.pdf",
          workingPaper: otherWorkingPaperLocation,
        }),
      ]);

      renderContent({
        selectedNode: secondLevelNode,
        workflow: [secondLevelNode],
      });

      await expect(
        screen.findByText(/direct\s+-\s+a01\.pdf/)
      ).resolves.toBeTruthy();
    });

    it("uses the project file panel instead of the legacy signoff file list", async () => {
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        makeProjectAttachment({
          id: "attachment-signed-current",
          originalName: "signed-current.pdf",
        }),
      ]);

      renderContent({ selectedNode: thirdLevelNodeWithSignedFile });

      await expect(
        screen.findByText(/signed\s+-\s+current\.pdf/)
      ).resolves.toBeTruthy();
    });

    it("keeps signer records out of the signoff action panel", async () => {
      vi.spyOn(api, "workingPaper").mockResolvedValue(signedWorkingPaperNode);

      renderContent({
        selectedNode: thirdLevelNodeWithSignedFile,
        selectedPaperId: "working-paper-signed",
      });

      await openPaperTool("Signoff and review");
      expect(
        screen.getByRole("button", { name: "Prepared signoff" })
      ).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Reviewed signoff" })
      ).toBeTruthy();
    });

    it("does not duplicate full signer names in the signoff action panel", async () => {
      vi.spyOn(api, "workingPaper").mockResolvedValue(
        longSignerWorkingPaperNode
      );

      renderContent({
        selectedNode: thirdLevelNodeWithLongSigners,
        selectedPaperId: "working-paper-long-signers",
      });

      await openPaperTool("Signoff and review");
      expect(
        screen.getByRole("button", { name: "Prepared signoff" })
      ).toBeTruthy();
    });

    it("opens the selected attachment preview in a detached window", async () => {
      const openWindow = vi.spyOn(window, "open").mockReturnValue(null);
      const attachment = makeProjectAttachment({
        id: "attachment-detached-preview",
        originalName: "detached-preview.pdf",
      });

      render(
        createElement(
          QueryClientProvider,
          { client: new QueryClient() },
          createElement(WorkbenchFilePreviewPane, {
            projectId: "project-1",
            attachment,
          })
        )
      );

      fireEvent.click(
        await screen.findByRole("button", { name: "Open in new window" })
      );

      expect(openWindow).toHaveBeenCalledWith(
        expect.stringMatching(/\/en-US\/preview\?nonce=[^&]+$/),
        "_blank"
      );
    });

    it("orders PDF preview actions as fullscreen, presentation, then new window", async () => {
      const attachment = makeProjectAttachment({
        id: "attachment-pdf-preview-actions",
        originalName: "preview-actions.pdf",
      });

      render(
        createElement(
          QueryClientProvider,
          { client: new QueryClient() },
          createElement(WorkbenchFilePreviewPane, {
            projectId: "project-1",
            attachment,
            onTogglePreviewExpanded: vi.fn(),
          })
        )
      );

      const expand = await screen.findByRole("button", {
        name: "Expand preview",
      });
      const presentation = await screen.findByRole("button", {
        name: "Presentation mode",
      });
      const openInNewWindow = await screen.findByRole("button", {
        name: "Open in new window",
      });

      expect(
        expand.compareDocumentPosition(presentation) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(
        presentation.compareDocumentPosition(openInNewWindow) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });

    it("uses the browser PDF reader only when the preference is enabled", () => {
      const openWindow = vi.spyOn(window, "open").mockReturnValue(null);
      const attachment = makeProjectAttachment({
        id: "attachment-native-preview",
        originalName: "native-preview.pdf",
      });

      openAttachmentPreviewInNewWindow("project-1", attachment, {
        useNativePdfViewer: true,
      });

      expect(openWindow).toHaveBeenCalledWith(
        expect.stringContaining(
          "/engagement/project-1/workflow/attachments/attachment-native-preview/preview-pdf/"
        ),
        "_blank",
        "noopener"
      );
    });

    it("closes the preview from a visible pane action", () => {
      const onClose = vi.fn();
      render(
        createElement(
          QueryClientProvider,
          { client: new QueryClient() },
          createElement(WorkbenchFilePreviewPane, {
            projectId: "project-1",
            attachment: null,
            onClose,
            closeLabel: "Close preview",
          })
        )
      );
      fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("toggles preview expansion before opening a new window", async () => {
      const onTogglePreviewExpanded = vi.fn();
      const attachment = makeProjectAttachment({
        id: "attachment-expand-preview",
        originalName: "expand-preview.pdf",
      });

      render(
        createElement(
          QueryClientProvider,
          { client: new QueryClient() },
          createElement(WorkbenchFilePreviewPane, {
            projectId: "project-1",
            attachment,
            onTogglePreviewExpanded,
          })
        )
      );

      fireEvent.click(
        await screen.findByRole("button", { name: "Expand preview" })
      );

      expect(onTogglePreviewExpanded).toHaveBeenCalledOnce();
    });

    it.each([
      ["PDF", "report.pdf", "application/pdf", "extend-pdf-viewer"],
      [
        "DOCX",
        "minutes.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "extend-docx-viewer",
      ],
      ["legacy DOC", "minutes.doc", "application/msword", "extend-docx-viewer"],
      [
        "PPTX",
        "deck.pptx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "extend-pptx-viewer",
      ],
      [
        "legacy PPT",
        "deck.ppt",
        "application/vnd.ms-powerpoint",
        "extend-pptx-viewer",
      ],
      [
        "XLSX",
        "balance.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "spreadsheet",
      ],
      ["legacy XLS", "balance.xls", "application/vnd.ms-excel", "spreadsheet"],
      [
        "binary XLSB",
        "balance.xlsb",
        "application/vnd.ms-excel.sheet.binary.macroenabled.12",
        "spreadsheet",
      ],
      ["CSV", "balance.csv", "text/csv", "spreadsheet"],
      ["TSV", "balance.tsv", "text/tab-separated-values", "spreadsheet"],
    ])(
      "routes %s previews through the correct cached viewer adapter",
      async (_label, fileName, mimeType, previewType) => {
        expect.hasAssertions();
        const attachment = {
          ...makeProjectAttachment({
            id: `attachment-${fileName}`,
            originalName: fileName,
          }),
          mimeType,
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

        if (previewType.startsWith("extend-")) {
          await screen.findByTestId(previewType);
          assertExtendedPreviewRequest(fileName);
        } else {
          await screen.findByText("Cell A1");
          assertSpreadsheetPreviewLayout();
          assertSpreadsheetPreviewRequest(fileName);
        }
      }
    );

    it("reuses a versioned spreadsheet preview after the pane remounts", async () => {
      const attachment = {
        ...makeProjectAttachment({
          id: "attachment-cached-preview",
          originalName: "cached-preview.xlsx",
        }),
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        version: 7,
      };
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const renderPreview = () =>
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
      const firstRender = renderPreview();
      await screen.findByText("Cell A1");
      firstRender.unmount();
      renderPreview();
      await screen.findByText("Cell A1");
      expect(screen.getByRole("button", { name: "Zoom in" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Download" })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
      expect(
        screen.getByRole("combobox", { name: "Zoom level" })
      ).toHaveTextContent("110%");

      expect(api.previewAttachment).toHaveBeenCalledExactlyOnceWith(
        "project-1",
        "attachment-cached-preview",
        expect.objectContaining({
          sheetIndex: 0,
          offset: 0,
          columnOffset: 0,
        })
      );
    });

    it("renders Smart Form previews through their generated PDF cache", async () => {
      const readSmartForm = vi.spyOn(api, "readSmartForm");
      vi.spyOn(api, "workingPaper").mockResolvedValue(
        smartFormWorkingPaperNode
      );

      renderContent({
        selectedNode: thirdLevelNodeWithSmartFormFile,
        selectedPaperId: "working-paper-smart-form",
      });

      await screen.findByTestId("extend-pdf-viewer");
      expect(
        screen
          .getByTestId("extend-pdf-viewer")
          .closest(".extend-viewer-surface")
      ).toBeTruthy();
      expect(api.previewAttachmentPdf).toHaveBeenCalledWith(
        "project-1",
        "attachment-smart-form",
        2
      );
      expect(readSmartForm).not.toHaveBeenCalled();
    });

    it("opens the file status panel with lock and history details", async () => {
      const lockedAttachment = {
        ...workingPaperNode.attachments[0],
        version: 3,
        lockedBy: "lock-holder-1",
        lockedAt: "2026-06-01T08:30:00.000Z",
        lockExpiresAt: "2026-06-01T10:30:00.000Z",
        uploader: {
          id: "uploader-1",
          name: "Uploader",
          email: "uploader@projectwing.local",
        },
        lockHolder: {
          id: "lock-holder-1",
          name: "Lock Holder",
          email: "lock@projectwing.local",
        },
      };
      vi.spyOn(api, "workingPaper").mockResolvedValue({
        ...workingPaperNode,
        attachments: [lockedAttachment],
      });
      const attachmentHistory = vi
        .spyOn(api, "attachmentHistory")
        .mockResolvedValue({
          attachment: lockedAttachment,
          versions: [
            {
              id: "version-1",
              attachmentId: "attachment-1",
              projectId: "project-1",
              version: 1,
              parentVersionId: null,
              sourceVersionId: null,
              fileKind: "SPREADSHEET",
              fileName: "cash-v1.xlsx",
              originalName: "cash-v1.xlsx",
              fileUrl: "working-papers/project-1/cash-v1.xlsx",
              fileSize: 1024,
              mimeType:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              workDate: "2026-05-31T00:00:00.000Z",
              uploadedAt: "2026-06-01T08:00:00.000Z",
              archivedBy: "lock-holder-1",
              action: "INITIAL",
              isCurrent: false,
              createdAt: "2026-06-01T08:00:00.000Z",
              uploadedByUser: {
                id: "lock-holder-1",
                name: "Lock Holder",
                email: "lock@projectwing.local",
              },
            },
            {
              id: "version-2",
              attachmentId: "attachment-1",
              projectId: "project-1",
              version: 2,
              parentVersionId: "version-1",
              sourceVersionId: null,
              fileKind: "SPREADSHEET",
              fileName: "cash-v2.xlsx",
              originalName: "cash-v2.xlsx",
              fileUrl: "working-papers/project-1/cash-v2.xlsx",
              fileSize: 2048,
              mimeType:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              workDate: "2026-06-01T00:00:00.000Z",
              uploadedAt: "2026-06-01T09:00:00.000Z",
              archivedBy: "lock-holder-1",
              action: "UPLOAD",
              isCurrent: false,
              createdAt: "2026-06-01T09:00:00.000Z",
              uploadedByUser: {
                id: "lock-holder-1",
                name: "Lock Holder",
                email: "lock@projectwing.local",
              },
            },
            {
              id: "version-3",
              attachmentId: "attachment-1",
              projectId: "project-1",
              version: 3,
              parentVersionId: "version-1",
              sourceVersionId: "version-1",
              fileKind: "SPREADSHEET",
              fileName: "cash.xlsx",
              originalName: "cash.xlsx",
              fileUrl: "working-papers/project-1/cash.xlsx",
              fileSize: 3072,
              mimeType:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              workDate: "2026-06-01T00:00:00.000Z",
              uploadedAt: "2026-06-01T09:30:00.000Z",
              archivedBy: "lock-holder-1",
              action: "RESTORE",
              isCurrent: true,
              createdAt: "2026-06-01T09:30:00.000Z",
              uploadedByUser: {
                id: "lock-holder-1",
                name: "Lock Holder",
                email: "lock@projectwing.local",
              },
            },
          ],
          events: [
            {
              id: "log-1",
              action: "ATTACHMENT_LOCKED",
              targetType: "ATTACHMENT",
              targetId: "attachment-1",
              projectId: "project-1",
              description: "閿佸畾鏂囦欢 cash.xlsx",
              createdAt: "2026-06-01T08:30:00.000Z",
              actor: {
                id: "lock-holder-1",
                name: "Lock Holder",
                email: "lock@projectwing.local",
                globalRole: "SENIOR",
              },
            },
          ],
        });

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        selectedPaperId: "working-paper-1",
      });

      await expect(
        screen.findByTestId("extend-xlsx-viewer")
      ).resolves.toBeTruthy();
      await openPaperTool("File status");

      await waitFor(() => {
        expect(attachmentHistory).toHaveBeenCalledWith(
          "project-1",
          "attachment-1"
        );
      });
      const lockedLabels = await screen.findAllByText("Locked");
      expect(lockedLabels.length).toBeGreaterThan(0);
      expect(screen.getAllByText("lock").length).toBeGreaterThan(0);
      expect(screen.getAllByText("3").length).toBeGreaterThan(0);
      expect(screen.getByText("Current head")).toBeTruthy();
      expect(screen.getByText("branched from 1")).toBeTruthy();
      expect(screen.getByText("閿佸畾鏂囦欢 cash.xlsx")).toBeTruthy();
    });

    it("resets the head directly from the file status version history when Master is unlocked", async () => {
      const unlockedAttachment = {
        ...workingPaperNode.attachments[0],
        version: 3,
        headVersionId: "version-3",
        lastModifiedAt: "2026-06-01T09:30:00.000Z",
      };
      vi.spyOn(api, "workingPaper").mockResolvedValue({
        ...workingPaperNode,
        attachments: [unlockedAttachment],
      });
      const attachmentHistory = vi
        .spyOn(api, "attachmentHistory")
        .mockResolvedValue({
          attachment: unlockedAttachment,
          versions: [
            {
              id: "version-1",
              attachmentId: "attachment-1",
              projectId: "project-1",
              version: 1,
              parentVersionId: null,
              sourceVersionId: null,
              fileKind: "SPREADSHEET",
              fileName: "cash-v1.xlsx",
              originalName: "cash-v1.xlsx",
              fileUrl: "working-papers/project-1/cash-v1.xlsx",
              fileSize: 1024,
              mimeType:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              workDate: "2026-05-31T00:00:00.000Z",
              uploadedAt: "2026-06-01T08:00:00.000Z",
              archivedBy: "user-1",
              action: "INITIAL",
              isCurrent: false,
              createdAt: "2026-06-01T08:00:00.000Z",
            },
            {
              id: "version-3",
              attachmentId: "attachment-1",
              projectId: "project-1",
              version: 3,
              parentVersionId: "version-1",
              sourceVersionId: "version-1",
              fileKind: "SPREADSHEET",
              fileName: "cash.xlsx",
              originalName: "cash.xlsx",
              fileUrl: "working-papers/project-1/cash.xlsx",
              fileSize: 3072,
              mimeType:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              workDate: "2026-06-01T00:00:00.000Z",
              uploadedAt: "2026-06-01T09:30:00.000Z",
              archivedBy: "user-1",
              action: "RESTORE",
              isCurrent: true,
              createdAt: "2026-06-01T09:30:00.000Z",
            },
          ],
          events: [],
        });
      const restoreAttachmentVersion = vi
        .spyOn(api, "restoreAttachmentVersion")
        .mockResolvedValue({
          ...unlockedAttachment,
          version: 4,
          headVersionId: "version-4",
        });

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        selectedPaperId: "working-paper-1",
      });

      await expect(
        screen.findByTestId("extend-xlsx-viewer")
      ).resolves.toBeTruthy();
      await openPaperTool("File status");
      fireEvent.click(
        await screen.findByRole("button", { name: "Choose 1 for reset head" })
      );
      fireEvent.click(
        await screen.findByRole("button", { name: "Reset head to 1" })
      );

      await waitFor(() => {
        expect(restoreAttachmentVersion).toHaveBeenCalledWith(
          "project-1",
          "attachment-1",
          "version-1"
        );
      });
      await waitFor(() => {
        expect(attachmentHistory).toHaveBeenCalledTimes(2);
      });
    });

    it("lets the project PIC resolve a frozen desktop conflict from file history", async () => {
      const conflictedAttachment = {
        ...workingPaperNode.attachments[0],
        version: 3,
        headVersionId: "version-3",
        conflictFrozenAt: "2026-06-01T10:00:00.000Z",
        conflictCandidateVersionId: "version-4",
      };
      const serverVersion = {
        id: "version-3",
        attachmentId: "attachment-1",
        projectId: "project-1",
        version: 3,
        parentVersionId: "version-2",
        sourceVersionId: null,
        fileKind: "SPREADSHEET" as const,
        fileName: "cash.xlsx",
        originalName: "cash.xlsx",
        fileUrl: "working-papers/project-1/cash.xlsx",
        fileSize: 3072,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        uploadedAt: "2026-06-01T09:30:00.000Z",
        archivedBy: "user-1",
        action: "CHECK_IN",
        isCurrent: true,
        createdAt: "2026-06-01T09:30:00.000Z",
      };
      const candidateVersion = {
        ...serverVersion,
        id: "version-4",
        version: 4,
        parentVersionId: "version-2",
        fileName: "cash-conflict.xlsx",
        originalName: "cash-conflict.xlsx",
        fileUrl: "working-papers/project-1/cash-conflict.xlsx",
        fileSize: 4096,
        uploadedAt: "2026-06-01T10:00:00.000Z",
        createdAt: "2026-06-01T10:00:00.000Z",
        isCurrent: false,
        contentHash:
          "abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd",
        conflictState: "OPEN",
        conflictBaseVersionId: "version-2",
        conflictServerVersionId: "version-3",
      };
      vi.spyOn(api, "workingPaper").mockResolvedValue({
        ...workingPaperNode,
        attachments: [conflictedAttachment],
      });
      vi.spyOn(api, "attachmentHistory").mockResolvedValue({
        attachment: conflictedAttachment,
        versions: [serverVersion, candidateVersion],
        events: [],
      });
      vi.spyOn(api, "attachmentConflicts").mockResolvedValue({
        frozen: true,
        frozenAt: conflictedAttachment.conflictFrozenAt,
        headVersionId: "version-3",
        candidateVersionId: "version-4",
        candidates: [candidateVersion],
      });
      const resolveAttachmentConflict = vi
        .spyOn(api, "resolveAttachmentConflict")
        .mockResolvedValue({
          ...conflictedAttachment,
          version: 4,
          headVersionId: "version-4",
          conflictFrozenAt: null,
          conflictCandidateVersionId: null,
        });

      renderContent({
        currentProjectRole: "PARTNER",
        selectedNode: thirdLevelNodeWithFile,
        selectedPaperId: "working-paper-1",
      });

      await expect(
        screen.findByTestId("extend-xlsx-viewer")
      ).resolves.toBeTruthy();
      await openPaperTool("File status");
      await expect(
        screen.findByText("File version conflict detected")
      ).resolves.toBeTruthy();
      fireEvent.click(
        screen.getByRole("button", { name: "Use desktop candidate" })
      );
      fireEvent.click(
        await screen.findByRole("button", { name: "Confirm resolution" })
      );

      await waitFor(() => {
        expect(resolveAttachmentConflict).toHaveBeenCalledWith(
          "project-1",
          "attachment-1",
          "version-4",
          "USE_CANDIDATE"
        );
      });
    });

    it("shows project file status details in the status column", async () => {
      const dateNowSpy = vi
        .spyOn(Date, "now")
        .mockReturnValue(Date.parse("2026-06-01T08:30:30.000Z"));
      const lockedAttachment = {
        ...workingPaperNode.attachments[0],
        code: "1100.1",
        fileKind: "SMART_FORM" as const,
        fileName: "cash.xlsx",
        originalName: "cash.xlsx",
        mimeType: SMART_FORM_MIME_TYPE,
        smartFormInstance: { status: "INCOMPLETE" as const },
        lockedBy: "lock-holder-1",
        lockedAt: "2026-06-01T08:30:00.000Z",
        lockExpiresAt: "2026-06-01T10:30:00.000Z",
        lastModifiedAt: "2026-06-01T09:00:00.000Z",
        lockHolder: {
          id: "lock-holder-1",
          name: "Lock Holder",
          email: "lock@projectwing.local",
        },
        lastModifier: {
          id: "modifier-1",
          name: "Modifier",
          email: "modifier@projectwing.local",
        },
      };
      vi.spyOn(api, "workingPaper").mockResolvedValue({
        ...workingPaperNode,
        attachments: [lockedAttachment],
      });
      const projectAttachments = vi
        .spyOn(api, "projectAttachments")
        .mockResolvedValue([
          {
            ...lockedAttachment,
            workingPaper: {
              id: "working-paper-1",
              code: "A01-0001-F001",
              title: "Cash paper",
              bucket: "CURRENT",
              workflowNodeId: "node-3",
              workflowNodeCode: "A01-0001",
              workflowNodeTitle: "Cash",
              path: [
                { id: "node-1", code: "1000", title: "Execution", level: 1 },
                { id: "node-2", code: "A01", title: "Assets", level: 2 },
                { id: "node-3", code: "A01-0001", title: "Cash", level: 3 },
              ],
            },
          },
        ]);

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        selectedPaperId: "working-paper-1",
      });

      await expect(
        screen.findByRole("button", { name: "Open file tools" })
      ).resolves.toBeTruthy();
      await openPaperTool("Project files");

      await waitFor(() => {
        expect(projectAttachments).toHaveBeenCalledWith("project-1");
      });
      expect(screen.getAllByText("Project files").length).toBeGreaterThan(0);
      expect(screen.getByText("1100.1")).toBeTruthy();
      const fileName = screen
        .getAllByText(/cash\.xlsx/)
        .find((element) => element.closest("td"));
      const fileCell = fileName?.closest("td");
      expect(fileCell).toBeTruthy();
      expect(fileName?.closest("button")).toHaveClass("justify-start");
      expect(screen.getByRole("columnheader", { name: "Status" })).toBeTruthy();
      const statusText = screen.getByText(
        "Lock Holder opened Master within 1 minute"
      );
      expect(statusText.closest("td")).not.toBe(fileCell);
      expect(
        within(statusText.closest("td") as HTMLElement).getByText(
          "Lock Holder opened Master within 1 minute"
        )
      ).toBeTruthy();
      expect(screen.getByLabelText("SmartForm Incomplete").closest("td")).toBe(
        fileCell
      );
      dateNowSpy.mockRestore();
    });

    it("shows no second-level precision for recent Master locks", async () => {
      const dateNowSpy = vi
        .spyOn(Date, "now")
        .mockReturnValue(Date.parse("2026-06-01T08:30:45.000Z"));
      const lockedAttachment = {
        ...workingPaperNode.attachments[0],
        fileName: "cash.xlsx",
        originalName: "cash.xlsx",
        lockedBy: "lock-holder-1",
        lockedAt: "2026-06-01T08:30:10.000Z",
        lockExpiresAt: "2026-06-01T10:30:00.000Z",
        lockHolder: {
          id: "lock-holder-1",
          name: "Lock Holder",
          email: "lock@projectwing.local",
        },
      };
      vi.spyOn(api, "workingPaper").mockResolvedValue({
        ...workingPaperNode,
        attachments: [lockedAttachment],
      });
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        {
          ...lockedAttachment,
          workingPaper: {
            id: "working-paper-1",
            code: "A01-0001-F001",
            title: "Cash paper",
            bucket: "CURRENT",
            workflowNodeId: "node-3",
            workflowNodeCode: "A01-0001",
            workflowNodeTitle: "Cash",
            path: [
              { id: "node-1", code: "Execution", title: "Execution", level: 1 },
              { id: "node-2", code: "A01", title: "Assets", level: 2 },
              { id: "node-3", code: "A01-0001", title: "Cash", level: 3 },
            ],
          },
        },
      ]);

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        selectedPaperId: "working-paper-1",
      });

      await expect(
        screen.findByTestId("extend-xlsx-viewer")
      ).resolves.toBeTruthy();
      await openPaperTool("Project files");
      await expect(
        screen.findByText("Lock Holder opened Master within 1 minute")
      ).resolves.toBeTruthy();
      dateNowSpy.mockRestore();
    });

    it("renders project files as EY-style evidence rows with signoff columns", async () => {
      const signedIndexPaper = {
        ...workingPaperNode,
        id: "working-paper-signed-index",
        code: "A01-0001-F010",
        title: "Signed index paper",
        attachments: [],
        signoffs: [
          {
            id: "signoff-preparer-index",
            type: "PREPARER" as const,
            signedAt: "2026-06-01T08:00:00.000Z",
            user: {
              id: "preparer-index",
              name: "Preparer One",
              email: "preparer-one@projectwing.local",
            },
          },
          {
            id: "signoff-reviewer-index",
            type: "REVIEWER" as const,
            signedAt: "2026-06-01T09:00:00.000Z",
            user: {
              id: "reviewer-index",
              name: "Reviewer One",
              email: "reviewer-one@projectwing.local",
            },
          },
          {
            id: "signoff-reviewer-two-index",
            type: "REVIEWER" as const,
            signedAt: "2026-06-01T10:00:00.000Z",
            user: {
              id: "reviewer-two-index",
              name: "Reviewer Two",
              email: "reviewer-two@projectwing.local",
            },
          },
        ],
      };
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        {
          ...makeProjectAttachment({
            id: "attachment-signed-index",
            originalName: "signed-index.xlsx",
            workingPaper: {
              ...selectedWorkingPaperLocation,
              id: signedIndexPaper.id,
              code: signedIndexPaper.code,
              title: signedIndexPaper.title,
              signoffs: signedIndexPaper.signoffs,
              reviewQuestions: [
                {
                  id: "question-index",
                  projectId: "project-1",
                  workingPaperId: signedIndexPaper.id,
                  body: "Explain the variance.",
                  status: "CLEARED" as const,
                  assignedToId: "preparer-index",
                  createdById: "reviewer-index",
                  createdAt: "2026-06-01T11:00:00.000Z",
                  updatedAt: "2026-06-01T11:00:00.000Z",
                  messages: [
                    {
                      id: "message-index-question",
                      questionId: "question-index",
                      authorId: "reviewer-index",
                      messageType: "QUESTION",
                      body: "Explain the variance.",
                      createdAt: "2026-06-01T11:00:00.000Z",
                    },
                    {
                      id: "message-index-reply",
                      questionId: "question-index",
                      authorId: "preparer-index",
                      messageType: "REPLY",
                      body: "Variance support attached.",
                      createdAt: "2026-06-01T11:30:00.000Z",
                    },
                  ],
                },
              ],
            },
          }),
          workingPaperId: signedIndexPaper.id,
          version: 4,
          fileSize: 1_995_776,
        },
      ]);

      const signedIndexNode: WorkflowNode = {
        ...thirdLevelNode,
        workingPapers: [signedIndexPaper],
      };

      renderContent({
        selectedNode: signedIndexNode,
        workflow: [{ ...secondLevelNode, children: [signedIndexNode] }],
      });

      await expect(
        screen.findByRole("columnheader", { name: "Ref" })
      ).resolves.toBeTruthy();
      expect(screen.getByRole("columnheader", { name: "File" })).toBeTruthy();
      expect(screen.getByRole("columnheader", { name: "Status" })).toBeTruthy();
      expect(screen.getByRole("columnheader", { name: "Note" })).toBeTruthy();
      const signoffsHeader = screen.getByRole("columnheader", {
        name: "Sign-offs",
      }) as HTMLTableCellElement;
      expect(screen.queryByRole("columnheader", { name: "Review" })).toBeNull();
      expect(
        screen.queryByRole("columnheader", { name: "Attributes" })
      ).toBeNull();
      expect(signoffsHeader).toBeTruthy();
      expect(screen.getAllByText("A01-0001-F010").length).toBeGreaterThan(0);
      const titleCell = screen
        .getByText(/signed\s+-\s+index\.xlsx/)
        .closest("td");
      expect(titleCell).not.toHaveAttribute("title");
      const closedNotesButton = screen.getByLabelText(
        /1 note for signed\s+-\s+index\.xlsx/
      );
      expect(
        closedNotesButton.querySelector('[data-review-question-state="closed"]')
      ).toHaveClass("text-success-accent", "bg-success-subtle");
      expect(
        closedNotesButton.querySelector(
          '[data-review-question-state="closed"] span'
        )
      ).toHaveClass("text-foreground");
      expect(
        closedNotesButton.querySelector(
          '[data-review-question-status="resolved"]'
        )
      ).toHaveClass("text-success-accent", "bg-success-subtle");
      expect(
        closedNotesButton.querySelector("[data-review-question-reply-count]")
      ).toHaveAttribute("data-review-question-reply-count", "1");
      expect(screen.getByLabelText(/Signed by Preparer One/)).toBeTruthy();
      expect(
        screen.getByLabelText(/Signed by Reviewer One.*Reviewer Two/)
      ).toBeTruthy();
      expect(screen.queryByText("Preparer One")).toBeNull();
      expect(screen.queryByText("Reviewer One, Reviewer Two")).toBeNull();
      expect(screen.queryByText(/Modified by/)).toBeNull();
      expect(screen.queryByText(/Work date/)).toBeNull();
      expect(screen.queryByText("Spreadsheet")).toBeNull();
      expect(screen.queryByText("Available")).toBeNull();
      fireEvent.click(
        screen.getByRole("button", {
          name: /1 note for signed\s+-\s+index\.xlsx/,
        })
      );
    });

    it("creates review notes from the project file index without opening workbench", async () => {
      const signedIndexPaper = {
        ...workingPaperNode,
        id: "working-paper-signed-index",
        code: "A01-0001-F010",
        title: "Signed index paper",
        attachments: [],
      };
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        {
          ...makeProjectAttachment({
            id: "attachment-signed-index",
            originalName: "signed-index.xlsx",
            workingPaper: {
              ...selectedWorkingPaperLocation,
              id: signedIndexPaper.id,
              code: signedIndexPaper.code,
              title: signedIndexPaper.title,
              reviewQuestions: [],
            },
          }),
          workingPaperId: signedIndexPaper.id,
        },
      ]);
      vi.spyOn(api, "members").mockResolvedValue([
        {
          id: "member-preparer-index",
          projectRole: "PREPARER",
          allowedProjectRoles: ["PREPARER"],
          roleConsistent: true,
          declarationAccepted: true,
          user: {
            id: "preparer-index",
            name: "Preparer One",
            email: "preparer-one@projectwing.local",
            globalRole: "STAFF",
            status: "ACTIVE",
          },
        },
      ]);
      const createQuestion = vi
        .spyOn(api, "createAttachmentQuestion")
        .mockResolvedValue({
          id: "question-new-index",
          projectId: "project-1",
          workingPaperId: signedIndexPaper.id,
          attachmentId: "attachment-signed-index",
          body: "Please explain cutoff.",
          status: "OPEN",
          assignedToId: "preparer-index",
          createdById: "reviewer-index",
          createdAt: "2026-06-01T12:00:00.000Z",
          updatedAt: "2026-06-01T12:00:00.000Z",
        });
      const signedIndexNode: WorkflowNode = {
        ...thirdLevelNode,
        workingPapers: [],
      };
      renderContent({
        currentUserId: "reviewer-index",
        currentProjectRole: "REVIEWER",
        selectedNode: signedIndexNode,
        workflow: [{ ...secondLevelNode, children: [signedIndexNode] }],
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /No notes for signed\s+-\s+index\.xlsx/,
        })
      );

      await expect(
        screen.findByRole("button", { name: "New review note" })
      ).resolves.toBeTruthy();
      expect(screen.queryByLabelText("Search review notes")).toBeNull();
      expect(screen.queryByText("A01 Assets")).toBeNull();
      expect(
        screen.queryByText(/Execution.*A01.*Assets.*A01-0001.*Cash/)
      ).toBeNull();
      expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
      expect(screen.getAllByText("A01-0001-F010").length).toBeGreaterThan(0);
      expect(screen.getByText(/signed\s+-\s+index\.xlsx/)).toBeTruthy();
      expect(screen.queryByText("Working paper")).toBeNull();
      expect(
        screen.getByRole("toolbar", { name: "Formatting toolbar" })
      ).toBeTruthy();
      expect(screen.getByRole("dialog")).toHaveAttribute(
        "data-workbench-interaction-lock",
        "true"
      );
      expect(screen.getByTestId("review-note-new-form")).toHaveClass(
        "h-full",
        "min-h-0"
      );
      expect(
        screen
          .getByRole("textbox", { name: "Review note content" })
          .closest('[data-slot="review-note-rich-text-composer"]')
      ).toHaveClass("flex-1", "min-h-0");
      expect(screen.queryByText("Enter to send")).toBeNull();
      expect(screen.queryByText("Paste screenshot to attach")).toBeNull();
      enterReviewNoteContent("Please explain cutoff.");
      await chooseSelectOption(
        document.body,
        "Assign respondent",
        /Preparer One/
      );
      fireEvent.click(screen.getByRole("button", { name: "Add review note" }));

      await waitFor(() => {
        expect(createQuestion).toHaveBeenCalledWith(
          "project-1",
          "attachment-signed-index",
          {
            body: "Please explain cutoff.",
            assignedToId: "preparer-index",
          }
        );
      });
    });

    it("reports a stable file target only when the Notes control is clicked", async () => {
      const onOpenReviewNotes = vi.fn();
      const legacyQuestion = makeCurrentReviewQuestion({
        id: "question-legacy-notes-target",
        workingPaperId: "working-paper-notes-target",
        attachmentId: null,
      });
      const attachmentQuestion = makeCurrentReviewQuestion({
        id: "question-attachment-notes-target",
        workingPaperId: "working-paper-notes-target",
        attachmentId: "attachment-notes-target",
      });
      const paper = {
        ...workingPaperNode,
        id: "working-paper-notes-target",
        code: "A01-0001-F020",
        title: "Notes target paper",
        attachments: [],
      };
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        {
          ...makeProjectAttachment({
            id: "attachment-notes-target",
            originalName: "notes-target.xlsx",
            workingPaper: {
              ...selectedWorkingPaperLocation,
              id: paper.id,
              code: paper.code,
              title: paper.title,
              reviewQuestions: [legacyQuestion, attachmentQuestion],
            },
          }),
          workingPaperId: paper.id,
        },
      ]);
      const selectedNode: WorkflowNode = {
        ...thirdLevelNode,
        workingPapers: [],
      };

      renderContent({
        selectedNode,
        workflow: [{ ...secondLevelNode, children: [selectedNode] }],
        onOpenReviewNotes,
      });

      const fileName = await screen.findByText(/notes\s+-\s+target\.xlsx/);
      fireEvent.click(fileName);
      expect(onOpenReviewNotes).not.toHaveBeenCalled();

      fireEvent.click(
        screen.getByRole("button", {
          name: /2 notes for notes\s+-\s+target\.xlsx/,
        })
      );

      expect(
        screen
          .getByRole("button", { name: /2 notes for notes\s+-\s+target\.xlsx/ })
          .querySelector('[data-review-question-state="open"]')
      ).toHaveClass("text-warning-accent", "bg-warning-subtle");

      expect(onOpenReviewNotes).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          key: "attachment:attachment-notes-target",
          kind: "attachment",
          attachmentId: "attachment-notes-target",
          paperId: paper.id,
          bucket: "CURRENT",
          reference: paper.code,
        })
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("attaches selected images when creating review notes from the project file index", async () => {
      const signedIndexPaper = {
        ...workingPaperNode,
        id: "working-paper-signed-index",
        code: "A01-0001-F010",
        title: "Signed index paper",
        attachments: [],
      };
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        {
          ...makeProjectAttachment({
            id: "attachment-signed-index",
            originalName: "signed-index.xlsx",
            workingPaper: {
              ...selectedWorkingPaperLocation,
              id: signedIndexPaper.id,
              code: signedIndexPaper.code,
              title: signedIndexPaper.title,
              reviewQuestions: [],
            },
          }),
          workingPaperId: signedIndexPaper.id,
        },
      ]);
      vi.spyOn(api, "members").mockResolvedValue([]);
      const createQuestion = vi
        .spyOn(api, "createAttachmentQuestion")
        .mockResolvedValue({
          id: "question-new-index",
          projectId: "project-1",
          workingPaperId: signedIndexPaper.id,
          attachmentId: "attachment-signed-index",
          body: "Please explain cutoff.",
          status: "OPEN",
          assignedToId: null,
          createdById: "reviewer-index",
          createdAt: "2026-06-01T12:00:00.000Z",
          updatedAt: "2026-06-01T12:00:00.000Z",
        });
      const uploadedImage = {
        objectKey:
          "review-question-images/project-1/question-new-index/chart.png",
        fileName: "chart.png",
        fileSize: 7,
        mimeType: "image/png",
      };
      const uploadImage = vi
        .spyOn(api, "uploadReviewQuestionImage")
        .mockResolvedValue(uploadedImage);
      const attachInitial = vi
        .spyOn(api, "attachWorkingPaperQuestionInitialMessage")
        .mockResolvedValue({
          id: "question-new-index",
          projectId: "project-1",
          workingPaperId: signedIndexPaper.id,
          body: "Please explain cutoff.",
          status: "OPEN",
          assignedToId: null,
          createdById: "reviewer-index",
          createdAt: "2026-06-01T12:00:00.000Z",
          updatedAt: "2026-06-01T12:00:00.000Z",
        });
      const createObjectURL = vi.fn(() => "blob:new-review-note-image-preview");
      const revokeObjectURL = vi.fn();
      stubObjectUrl(createObjectURL, revokeObjectURL);

      const signedIndexNode: WorkflowNode = {
        ...thirdLevelNode,
        workingPapers: [],
      };

      renderContent({
        currentUserId: "reviewer-index",
        currentProjectRole: "REVIEWER",
        selectedNode: signedIndexNode,
        workflow: [{ ...secondLevelNode, children: [signedIndexNode] }],
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /No notes for signed\s+-\s+index\.xlsx/,
        })
      );

      const image = new File(["preview"], "chart.png", {
        type: "image/png",
      });
      enterReviewNoteContent("Please explain cutoff.");
      const attachInput = screen
        .getAllByLabelText("Attach file")
        .find(
          (element): element is HTMLInputElement =>
            element instanceof HTMLInputElement
        );
      fireEvent.change(requireElement(attachInput), {
        target: { files: [image] },
      });
      await expect(screen.findByText("chart.png")).resolves.toBeTruthy();
      fireEvent.click(
        await screen.findByRole("button", { name: "Add review note" })
      );

      await waitFor(() => {
        expect(createQuestion).toHaveBeenCalledWith(
          "project-1",
          "attachment-signed-index",
          {
            body: "Please explain cutoff.",
            assignedToId: "",
          }
        );
        expect(uploadImage).toHaveBeenCalledWith(
          "project-1",
          "question-new-index",
          image
        );
        expect(attachInitial).toHaveBeenCalledWith(
          "project-1",
          "question-new-index",
          [uploadedImage]
        );
      });
    });

    it("attaches pasted screenshots when creating review notes", async () => {
      const signedIndexPaper = {
        ...workingPaperNode,
        id: "working-paper-signed-index",
        code: "A01-0001-F010",
        title: "Signed index paper",
        attachments: [],
      };
      vi.spyOn(api, "projectAttachments").mockResolvedValue([
        {
          ...makeProjectAttachment({
            id: "attachment-signed-index",
            originalName: "signed-index.xlsx",
            workingPaper: {
              ...selectedWorkingPaperLocation,
              id: signedIndexPaper.id,
              code: signedIndexPaper.code,
              title: signedIndexPaper.title,
              reviewQuestions: [],
            },
          }),
          workingPaperId: signedIndexPaper.id,
        },
      ]);
      vi.spyOn(api, "members").mockResolvedValue([]);
      vi.spyOn(api, "createAttachmentQuestion").mockResolvedValue({
        id: "question-new-index",
        projectId: "project-1",
        workingPaperId: signedIndexPaper.id,
        attachmentId: "attachment-signed-index",
        body: "Please explain cutoff.",
        status: "OPEN",
        assignedToId: null,
        createdById: "reviewer-index",
        createdAt: "2026-06-01T12:00:00.000Z",
        updatedAt: "2026-06-01T12:00:00.000Z",
      });
      const uploadedImage = {
        objectKey:
          "review-question-images/project-1/question-new-index/pasted.png",
        fileName: "pasted.png",
        fileSize: 7,
        mimeType: "image/png",
      };
      const uploadImage = vi
        .spyOn(api, "uploadReviewQuestionImage")
        .mockResolvedValue(uploadedImage);
      const attachInitial = vi
        .spyOn(api, "attachWorkingPaperQuestionInitialMessage")
        .mockResolvedValue({
          id: "question-new-index",
          projectId: "project-1",
          workingPaperId: signedIndexPaper.id,
          body: "Please explain cutoff.",
          status: "OPEN",
          assignedToId: null,
          createdById: "reviewer-index",
          createdAt: "2026-06-01T12:00:00.000Z",
          updatedAt: "2026-06-01T12:00:00.000Z",
        });
      const createObjectURL = vi.fn(() => "blob:new-review-note-paste-preview");
      const revokeObjectURL = vi.fn();
      stubObjectUrl(createObjectURL, revokeObjectURL);

      const signedIndexNode: WorkflowNode = {
        ...thirdLevelNode,
        workingPapers: [],
      };

      renderContent({
        currentUserId: "reviewer-index",
        currentProjectRole: "REVIEWER",
        selectedNode: signedIndexNode,
        workflow: [{ ...secondLevelNode, children: [signedIndexNode] }],
      });

      fireEvent.click(
        await screen.findByRole("button", {
          name: /No notes for signed\s+-\s+index\.xlsx/,
        })
      );

      const pastedImage = new File(["preview"], "image.png", {
        type: "image/png",
      });
      const contentBox = enterReviewNoteContent("Please explain cutoff.");
      fireEvent.paste(contentBox, {
        clipboardData: {
          getData: (type: string) => (type === "text/plain" ? "" : ""),
          items: [
            {
              kind: "file",
              type: "image/png",
              getAsFile: () => pastedImage,
            },
          ],
          files: [],
        },
      });
      await expect(
        screen.findByText(/pasted-screenshot-.*\.png/)
      ).resolves.toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Add review note" }));

      await waitFor(() => {
        expect(uploadImage).toHaveBeenCalledWith(
          "project-1",
          "question-new-index",
          expect.objectContaining({
            name: expect.stringMatching(/^pasted-screenshot-.*\.png$/),
            type: "image/png",
          })
        );
        expect(attachInitial).toHaveBeenCalledWith(
          "project-1",
          "question-new-index",
          [uploadedImage]
        );
      });
    });

    it("does not expose the legacy versions and locks tool panel", async () => {
      vi.spyOn(api, "workingPaper").mockResolvedValue(docxWorkingPaperNode);

      renderContent({
        selectedNode: thirdLevelNodeWithDocxFile,
        selectedPaperId: "working-paper-docx",
      });

      await expect(
        screen.findByText("meeting - minutes.docx")
      ).resolves.toBeTruthy();
      fireEvent.click(
        await screen.findByRole("button", { name: "Open file tools" })
      );
      expect(
        screen.queryByRole("menuitem", { name: "Versions and locks" })
      ).toBeNull();
    });

    it("does not expose the project recycle bin from paper tools", async () => {
      vi.spyOn(api, "workingPaper").mockResolvedValue(workingPaperNode);

      renderContent({
        selectedNode: thirdLevelNodeWithFile,
        selectedPaperId: "working-paper-1",
      });

      fireEvent.click(
        await screen.findByRole("button", { name: "Open file tools" })
      );

      expect(
        screen.queryByRole("menuitem", { name: "Recycle bin" })
      ).toBeNull();
    });

    it("shows preparation and review actions to ordinary project members", async () => {
      vi.spyOn(api, "workingPaper").mockResolvedValue(workingPaperNode);

      renderContent({
        currentProjectRole: "PREPARER",
        selectedNode: thirdLevelNodeWithFile,
        selectedPaperId: "working-paper-1",
      });

      await openPaperTool("Signoff and review");
      expect(
        screen.getByRole("button", { name: "Prepared signoff" })
      ).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Reviewed signoff" })
      ).toBeTruthy();
      await openPaperTool("Review notes");
      await expect(screen.findByText("Add review note")).resolves.toBeTruthy();
    });

    it("allows a preparer to sign after reviewers have already signed", async () => {
      vi.spyOn(api, "workingPaper").mockResolvedValue(signedWorkingPaperNode);

      renderContent({
        currentUserId: "new-preparer",
        currentProjectRole: "PREPARER",
        selectedNode: thirdLevelNodeWithSignedFile,
        selectedPaperId: "working-paper-signed",
      });

      await openPaperTool("Signoff and review");
      expect(
        screen.getByRole("button", { name: "Prepared signoff" })
      ).not.toBeDisabled();
    });

    it("shows a disabled review action until a preparation signoff exists", async () => {
      vi.spyOn(api, "workingPaper").mockResolvedValue(workingPaperNode);

      renderContent({
        currentProjectRole: "REVIEWER",
        selectedNode: thirdLevelNodeWithFile,
        selectedPaperId: "working-paper-1",
      });

      await openPaperTool("Signoff and review");
      expect(
        screen.getByRole("button", { name: "Reviewed signoff" })
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Prepared signoff" })
      ).toBeTruthy();
      await openPaperTool("Review notes");
      await expect(screen.findByText("Add review note")).resolves.toBeTruthy();
    });

    it("scopes the review notes dialog to the current workpaper", async () => {
      vi.spyOn(api, "workingPaper").mockResolvedValue({
        ...workingPaperNode,
        reviewQuestions: [
          {
            id: "question-current-paper",
            projectId: "project-1",
            workingPaperId: "working-paper-1",
            body: "Current file needs support.",
            status: "OPEN",
            assignedToId: null,
            createdById: "reviewer-current",
            createdAt: "2026-06-01T11:00:00.000Z",
            updatedAt: "2026-06-01T11:00:00.000Z",
            createdBy: {
              id: "reviewer-current",
              name: "Reviewer Current",
              email: "reviewer-current@projectwing.local",
            },
            messages: [
              {
                id: "message-current-question",
                questionId: "question-current-paper",
                authorId: "reviewer-current",
                messageType: "QUESTION",
                body: "Current file needs support.",
                createdAt: "2026-06-01T11:00:00.000Z",
                author: {
                  id: "reviewer-current",
                  name: "Reviewer Current",
                  email: "reviewer-current@projectwing.local",
                },
              },
              {
                id: "message-current-reply",
                questionId: "question-current-paper",
                authorId: "preparer-current",
                messageType: "REPLY",
                body: "Support has been added.",
                createdAt: "2026-06-01T11:30:00.000Z",
                author: {
                  id: "preparer-current",
                  name: "Preparer Current",
                  email: "preparer-current@projectwing.local",
                },
              },
            ],
          },
          {
            id: "question-other-paper",
            projectId: "project-1",
            workingPaperId: "working-paper-other",
            body: "Other file should stay hidden.",
            status: "OPEN",
            assignedToId: null,
            createdById: "reviewer-other",
            createdAt: "2026-06-01T12:00:00.000Z",
            updatedAt: "2026-06-01T12:00:00.000Z",
          },
        ],
      });

      renderContent({
        currentProjectRole: "REVIEWER",
        selectedNode: thirdLevelNodeWithFile,
        selectedPaperId: "working-paper-1",
      });

      await openPaperTool("Review notes");

      const supportMessages = await screen.findAllByText(
        "Current file needs support."
      );
      expect(supportMessages.length).toBeGreaterThan(0);
      expect(screen.getAllByText("Open").length).toBeGreaterThan(0);
      const questionRow = screen
        .getAllByText("Current file needs support.")[0]
        ?.closest("button");
      expect(questionRow).toBeTruthy();
    });

    it("marks review notes as replied with an explicit action", async () => {
      const openQuestion = {
        id: "question-current-paper",
        projectId: "project-1",
        workingPaperId: "working-paper-1",
        body: "Current file needs support.",
        status: "OPEN" as const,
        assignedToId: "preparer-current",
        createdById: "reviewer-current",
        createdAt: "2026-06-01T11:00:00.000Z",
        updatedAt: "2026-06-01T11:00:00.000Z",
        assignedTo: {
          id: "preparer-current",
          name: "Preparer Current",
          email: "preparer-current@projectwing.local",
        },
        createdBy: {
          id: "reviewer-current",
          name: "Reviewer Current",
          email: "reviewer-current@projectwing.local",
        },
        messages: [
          {
            id: "message-current-question",
            questionId: "question-current-paper",
            authorId: "reviewer-current",
            messageType: "QUESTION" as const,
            body: "Current file needs support.",
            createdAt: "2026-06-01T11:00:00.000Z",
            author: {
              id: "reviewer-current",
              name: "Reviewer Current",
              email: "reviewer-current@projectwing.local",
            },
          },
        ],
      };
      vi.spyOn(api, "workingPaper").mockResolvedValue({
        ...workingPaperNode,
        reviewQuestions: [openQuestion],
      });
      const replyQuestion = vi.spyOn(api, "replyWorkingPaperQuestion");
      const markReplied = vi
        .spyOn(api, "markWorkingPaperQuestionReplied")
        .mockResolvedValue({
          ...openQuestion,
          status: "REPLIED",
          repliedById: "preparer-current",
          repliedAt: "2026-06-01T11:30:00.000Z",
        });

      renderContent({
        currentUserId: "preparer-current",
        currentProjectRole: "PREPARER",
        selectedNode: {
          ...thirdLevelNodeWithFile,
          workingPapers: [
            {
              ...workingPaperNode,
              reviewQuestions: [openQuestion],
            },
          ],
        },
        selectedPaperId: "working-paper-1",
      });

      await openPaperTool("Review notes");
      expect(
        screen.getByRole("toolbar", { name: "Formatting toolbar" })
      ).toBeTruthy();
      expect(screen.queryByText("Enter to send")).toBeNull();
      expect(screen.queryByText("Shift+Enter for a new line")).toBeNull();
      expect(screen.queryByText("Ctrl+Enter also sends")).toBeNull();
      expect(screen.queryByText("Paste screenshot to attach")).toBeNull();
      fireEvent.click(
        await screen.findByRole("button", { name: "Mark replied" })
      );

      await waitFor(() => {
        expect(markReplied).toHaveBeenCalledWith(
          "project-1",
          "question-current-paper"
        );
      });
      expect(replyQuestion).not.toHaveBeenCalled();
    });

    it("sends a reply once on Enter and ignores modified or composing Enter", async () => {
      const question = makeCurrentReviewQuestion();
      const replyQuestion = vi
        .spyOn(api, "replyWorkingPaperQuestion")
        .mockResolvedValue({
          ...question,
          messages: [
            ...(question.messages ?? []),
            {
              id: "message-current-reply",
              questionId: question.id,
              authorId: "preparer-current",
              messageType: "REPLY",
              body: "Reply body",
              createdAt: "2026-06-01T11:30:00.000Z",
            },
          ],
        });

      renderCurrentReviewQuestion(question);
      await openPaperTool("Review notes");
      const editor = await screen.findByRole("textbox", { name: "Message" });
      const user = userEvent.setup();
      await user.type(editor, "Reply body");

      fireEvent.keyDown(editor, {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        shiftKey: true,
      });
      fireEvent.keyDown(editor, {
        key: "Enter",
        code: "Enter",
        keyCode: 229,
        isComposing: true,
      });
      expect(replyQuestion).not.toHaveBeenCalled();

      fireEvent.keyDown(editor, {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        isComposing: false,
      });
      await waitFor(() => {
        expect(replyQuestion).toHaveBeenCalledOnce();
        expect(replyQuestion).toHaveBeenCalledWith("project-1", question.id, {
          replyBody: "Reply body",
        });
      });
    });

    it("renders review note replies as one left-aligned activity timeline", async () => {
      const question = makeCurrentReviewQuestion({
        messages: [
          {
            id: "message-current-question",
            questionId: "question-current-paper",
            authorId: "reviewer-current",
            messageType: "QUESTION",
            body: "Current file needs support.",
            createdAt: "2026-06-01T11:00:00.000Z",
            author: {
              id: "reviewer-current",
              name: "Reviewer Current",
              email: "reviewer-current@projectwing.local",
            },
          },
          {
            id: "message-preparer-reply",
            questionId: "question-current-paper",
            authorId: "preparer-current",
            messageType: "REPLY",
            body: "I attached the missing evidence.",
            createdAt: "2026-06-01T11:30:00.000Z",
            author: {
              id: "preparer-current",
              name: "Preparer Current",
              email: "preparer-current@projectwing.local",
            },
          },
          {
            id: "message-reviewer-follow-up",
            questionId: "question-current-paper",
            authorId: "reviewer-current",
            messageType: "FOLLOW_UP",
            body: "Please also confirm the reporting date.",
            createdAt: "2026-06-01T11:45:00.000Z",
            author: {
              id: "reviewer-current",
              name: "Reviewer Current",
              email: "reviewer-current@projectwing.local",
            },
          },
        ],
      });
      renderCurrentReviewQuestion(question);

      await openPaperTool("Review notes");

      const summary = await screen.findByTestId("review-note-question-summary");
      expect(summary).toBeTruthy();
      const messages = await screen.findAllByTestId("review-note-message");
      expect(messages).toHaveLength(2);
      expect(
        within(messages[0]).getByLabelText("Preparer Current")
      ).toBeTruthy();
      expect(
        within(messages[1]).getByLabelText("Reviewer Current")
      ).toBeTruthy();
    });

    it("shows a retry state when a review note image fails to load", async () => {
      const questionWithImage = {
        id: "question-current-paper",
        projectId: "project-1",
        workingPaperId: "working-paper-1",
        body: "Current file needs support.",
        status: "OPEN" as const,
        assignedToId: "preparer-current",
        createdById: "reviewer-current",
        createdAt: "2026-06-01T11:00:00.000Z",
        updatedAt: "2026-06-01T11:30:00.000Z",
        messages: [
          {
            id: "message-current-question",
            questionId: "question-current-paper",
            authorId: "reviewer-current",
            messageType: "QUESTION" as const,
            body: "Current file needs support.",
            createdAt: "2026-06-01T11:00:00.000Z",
            author: {
              id: "reviewer-current",
              name: "Reviewer Current",
              email: "reviewer-current@projectwing.local",
            },
            images: [
              {
                id: "image-1",
                messageId: "message-current-question",
                fileName: "evidence.png",
                originalName: "evidence.png",
                objectKey:
                  "review-question-images/project-1/question-current-paper/evidence.png",
                fileSize: 7,
                mimeType: "image/png",
                createdAt: "2026-06-01T11:00:00.000Z",
              },
            ],
          },
        ],
      };
      vi.spyOn(api, "workingPaper").mockResolvedValue({
        ...workingPaperNode,
        reviewQuestions: [questionWithImage],
      });
      const downloadImage = vi
        .spyOn(api, "downloadReviewQuestionImage")
        .mockRejectedValueOnce(new Error("Image request failed"));
      const createObjectURL = vi.fn(() => "blob:review-question-image");
      stubObjectUrl(createObjectURL, vi.fn());

      renderContent({
        currentUserId: "preparer-current",
        currentProjectRole: "PREPARER",
        selectedNode: {
          ...thirdLevelNodeWithFile,
          workingPapers: [
            {
              ...workingPaperNode,
              reviewQuestions: [questionWithImage],
            },
          ],
        },
        selectedPaperId: "working-paper-1",
      });

      await openPaperTool("Review notes");
      await expect(
        screen.findByText("Image unavailable")
      ).resolves.toBeTruthy();

      downloadImage.mockResolvedValueOnce(
        new Blob(["preview"], { type: "image/png" })
      );
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));

      await expect(
        screen.findByRole("img", { name: "evidence.png" })
      ).resolves.toHaveAttribute("src", "blob:review-question-image");
      expect(downloadImage).toHaveBeenCalledTimes(2);
    });

    it("sends image-only review note messages as message images", async () => {
      const openQuestion = {
        id: "question-current-paper",
        projectId: "project-1",
        workingPaperId: "working-paper-1",
        body: "Current file needs support.",
        status: "OPEN" as const,
        assignedToId: "preparer-current",
        createdById: "reviewer-current",
        createdAt: "2026-06-01T11:00:00.000Z",
        updatedAt: "2026-06-01T11:00:00.000Z",
        assignedTo: {
          id: "preparer-current",
          name: "Preparer Current",
          email: "preparer-current@projectwing.local",
        },
        createdBy: {
          id: "reviewer-current",
          name: "Reviewer Current",
          email: "reviewer-current@projectwing.local",
        },
        messages: [
          {
            id: "message-current-question",
            questionId: "question-current-paper",
            authorId: "reviewer-current",
            messageType: "QUESTION" as const,
            body: "Current file needs support.",
            createdAt: "2026-06-01T11:00:00.000Z",
            author: {
              id: "reviewer-current",
              name: "Reviewer Current",
              email: "reviewer-current@projectwing.local",
            },
          },
        ],
      };
      vi.spyOn(api, "workingPaper").mockResolvedValue({
        ...workingPaperNode,
        reviewQuestions: [openQuestion],
      });
      const uploadedImage = {
        objectKey:
          "review-question-images/project-1/question-current-paper/screenshot.png",
        fileName: "screenshot.png",
        fileSize: 7,
        mimeType: "image/png",
      };
      const uploadImage = vi
        .spyOn(api, "uploadReviewQuestionImage")
        .mockResolvedValue(uploadedImage);
      vi.spyOn(api, "downloadReviewQuestionImage").mockResolvedValue(
        new Blob(["preview"], { type: "image/png" })
      );
      const replyQuestion = vi
        .spyOn(api, "replyWorkingPaperQuestion")
        .mockResolvedValue({
          ...openQuestion,
          messages: [
            ...openQuestion.messages,
            {
              id: "message-image-only",
              questionId: "question-current-paper",
              authorId: "preparer-current",
              messageType: "REPLY" as const,
              body: "",
              createdAt: "2026-06-01T11:30:00.000Z",
              author: {
                id: "preparer-current",
                name: "Preparer Current",
                email: "preparer-current@projectwing.local",
              },
              images: [
                {
                  id: "image-1",
                  messageId: "message-image-only",
                  fileName: "screenshot.png",
                  originalName: "screenshot.png",
                  objectKey: uploadedImage.objectKey,
                  fileSize: uploadedImage.fileSize,
                  mimeType: uploadedImage.mimeType,
                  createdAt: "2026-06-01T11:30:00.000Z",
                },
              ],
            },
          ],
        });
      const createObjectURL = vi.fn(() => "blob:review-question-image-preview");
      const revokeObjectURL = vi.fn();
      stubObjectUrl(createObjectURL, revokeObjectURL);

      renderContent({
        currentUserId: "preparer-current",
        currentProjectRole: "PREPARER",
        selectedNode: {
          ...thirdLevelNodeWithFile,
          workingPapers: [
            {
              ...workingPaperNode,
              reviewQuestions: [openQuestion],
            },
          ],
        },
        selectedPaperId: "working-paper-1",
      });

      await openPaperTool("Review notes");
      const image = new File(["preview"], "screenshot.png", {
        type: "image/png",
      });
      const attachInput = screen
        .getAllByLabelText("Attach file")
        .find(
          (element): element is HTMLInputElement =>
            element instanceof HTMLInputElement
        );
      fireEvent.change(requireElement(attachInput), {
        target: { files: [image] },
      });
      await expect(screen.findByText("screenshot.png")).resolves.toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Send" }));

      await waitFor(() => {
        expect(uploadImage).toHaveBeenCalledWith(
          "project-1",
          "question-current-paper",
          image
        );
        expect(replyQuestion).toHaveBeenCalledWith(
          "project-1",
          "question-current-paper",
          {
            replyBody: "",
            images: [uploadedImage],
          }
        );
      });
    });

    it("attaches pasted screenshots to review note messages", async () => {
      const openQuestion = {
        id: "question-current-paper",
        projectId: "project-1",
        workingPaperId: "working-paper-1",
        body: "Current file needs support.",
        status: "OPEN" as const,
        assignedToId: "preparer-current",
        createdById: "reviewer-current",
        createdAt: "2026-06-01T11:00:00.000Z",
        updatedAt: "2026-06-01T11:00:00.000Z",
        assignedTo: {
          id: "preparer-current",
          name: "Preparer Current",
          email: "preparer-current@projectwing.local",
        },
        createdBy: {
          id: "reviewer-current",
          name: "Reviewer Current",
          email: "reviewer-current@projectwing.local",
        },
        messages: [
          {
            id: "message-current-question",
            questionId: "question-current-paper",
            authorId: "reviewer-current",
            messageType: "QUESTION" as const,
            body: "Current file needs support.",
            createdAt: "2026-06-01T11:00:00.000Z",
            author: {
              id: "reviewer-current",
              name: "Reviewer Current",
              email: "reviewer-current@projectwing.local",
            },
          },
        ],
      };
      vi.spyOn(api, "workingPaper").mockResolvedValue({
        ...workingPaperNode,
        reviewQuestions: [openQuestion],
      });
      const uploadedImage = {
        objectKey:
          "review-question-images/project-1/question-current-paper/pasted.png",
        fileName: "pasted.png",
        fileSize: 7,
        mimeType: "image/png",
      };
      const uploadImage = vi
        .spyOn(api, "uploadReviewQuestionImage")
        .mockResolvedValue(uploadedImage);
      vi.spyOn(api, "downloadReviewQuestionImage").mockResolvedValue(
        new Blob(["preview"], { type: "image/png" })
      );
      const replyQuestion = vi
        .spyOn(api, "replyWorkingPaperQuestion")
        .mockResolvedValue({
          ...openQuestion,
          messages: openQuestion.messages,
        });
      const createObjectURL = vi.fn(() => "blob:pasted-screenshot-preview");
      const revokeObjectURL = vi.fn();
      stubObjectUrl(createObjectURL, revokeObjectURL);

      renderContent({
        currentUserId: "preparer-current",
        currentProjectRole: "PREPARER",
        selectedNode: {
          ...thirdLevelNodeWithFile,
          workingPapers: [
            {
              ...workingPaperNode,
              reviewQuestions: [openQuestion],
            },
          ],
        },
        selectedPaperId: "working-paper-1",
      });

      await openPaperTool("Review notes");
      const pastedImage = new File(["preview"], "image.png", {
        type: "image/png",
      });
      fireEvent.paste(await screen.findByLabelText("Message"), {
        clipboardData: {
          getData: (type: string) => (type === "text/plain" ? "" : ""),
          items: [
            {
              kind: "file",
              type: "image/png",
              getAsFile: () => pastedImage,
            },
          ],
          files: [],
        },
      });
      await expect(
        screen.findByText(/pasted-screenshot-.*\.png/)
      ).resolves.toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Send" }));

      await waitFor(() => {
        expect(uploadImage).toHaveBeenCalledWith(
          "project-1",
          "question-current-paper",
          expect.objectContaining({
            name: expect.stringMatching(/^pasted-screenshot-.*\.png$/),
            type: "image/png",
          })
        );
        expect(replyQuestion).toHaveBeenCalledWith(
          "project-1",
          "question-current-paper",
          {
            replyBody: "",
            images: [uploadedImage],
          }
        );
      });
    });

    it("leaves text-only paste in review note messages to the textarea", async () => {
      const openQuestion = makeCurrentReviewQuestion();
      renderCurrentReviewQuestion(openQuestion);

      await openPaperTool("Review notes");
      const messageBox = await screen.findByLabelText("Message");
      const pasteEvent = createEvent.paste(messageBox);
      Object.defineProperty(pasteEvent, "clipboardData", {
        configurable: true,
        value: {
          getData: (type: string) =>
            type === "text/plain" ? "plain text" : "",
          items: [
            {
              kind: "string",
              type: "text/plain",
              getAsFile: () => null,
            },
          ],
          files: [],
          types: ["text/plain"],
        },
      });
      fireEvent(messageBox, pasteEvent);

      expect(messageBox).toHaveTextContent("plain text");
      expect(screen.queryByText(/pasted-screenshot-.*\.png/)).toBeNull();
    });

    it("ignores pasted images for cleared review note reopen messages", async () => {
      const clearedQuestion = makeCurrentReviewQuestion({
        status: "CLEARED",
      });
      renderCurrentReviewQuestion(clearedQuestion);

      await openPaperTool("Review notes");
      const image = new File(["preview"], "clipboard.png", {
        type: "image/png",
      });
      const messageBox = await screen.findByLabelText("Message");
      const pasteEvent = createEvent.paste(messageBox);
      Object.defineProperty(pasteEvent, "clipboardData", {
        configurable: true,
        value: {
          getData: () => "",
          items: [
            {
              kind: "file",
              type: "image/png",
              getAsFile: () => image,
            },
          ],
          files: [image],
          types: ["Files"],
        },
      });
      fireEvent(messageBox, pasteEvent);

      expect(screen.queryByText(/pasted-screenshot-.*\.png/)).toBeNull();
    });

    it("shows both signoff actions to reviewers on prepared files", async () => {
      vi.spyOn(api, "workingPaper").mockResolvedValue(preparedWorkingPaperNode);

      renderContent({
        currentProjectRole: "REVIEWER",
        selectedNode: thirdLevelNodeWithPreparedFile,
        selectedPaperId: "working-paper-prepared",
      });

      await openPaperTool("Signoff and review");
      expect(
        screen.getByRole("button", { name: "Reviewed signoff" })
      ).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Prepared signoff" })
      ).toBeTruthy();
      await openPaperTool("Review notes");
      await expect(screen.findByText("Add review note")).resolves.toBeTruthy();
    });
  });

  const thirdLevelNode: WorkflowNode = {
    id: "node-3",
    parentId: "node-2",
    code: "A01-0001",
    title: "閾惰鍑借瘉",
    level: 3,
    nodeType: "PAPER",
    workingPapers: [],
    children: [],
  };
  const workingPaperNode = {
    id: "working-paper-1",
    projectId: "project-1",
    workflowNodeId: "node-3",
    code: "A01-0001-F001",
    title: "銆愮鐩綑棰濊〃銆?02605.xlsx",
    paperType: "WORKING_PAPER" as const,
    attachments: [
      {
        id: "attachment-1",
        workingPaperId: "working-paper-1",
        fileKind: "SPREADSHEET" as const,
        fileName: "stored.xlsx",
        originalName: "銆愮鐩綑棰濊〃銆?02605.xlsx",
        fileUrl: "working-papers/project-1/stored.xlsx",
        fileSize: 2048,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        version: 1,
      },
    ],
  };
  const thirdLevelNodeWithFile: WorkflowNode = {
    ...thirdLevelNode,
    workingPapers: [workingPaperNode],
  };
  const selectedWorkingPaperLocation: NonNullable<
    ProjectAttachment["workingPaper"]
  > = {
    id: "working-paper-1",
    code: "A01-0001-F001",
    title: "Cash paper",
    bucket: "CURRENT" as const,
    workflowNodeId: "node-3",
    workflowNodeCode: "A01-0001",
    workflowNodeTitle: "Cash",
    path: [
      { id: "node-1", code: "Execution", title: "Execution", level: 1 },
      { id: "node-2", code: "A01", title: "Assets", level: 2 },
      { id: "node-3", code: "A01-0001", title: "Cash", level: 3 },
    ],
  };
  const otherWorkingPaperLocation: NonNullable<
    ProjectAttachment["workingPaper"]
  > = {
    id: "working-paper-other",
    code: "B01-0001-F001",
    title: "Other paper",
    bucket: "CURRENT" as const,
    workflowNodeId: "node-other",
    workflowNodeCode: "B01-0001",
    workflowNodeTitle: "Other",
    path: [
      { id: "node-other-1", code: "Execution", title: "Execution", level: 1 },
      { id: "node-other-2", code: "B01", title: "Liabilities", level: 2 },
      { id: "node-other", code: "B01-0001", title: "Other", level: 3 },
    ],
  };

  function makeSmartFormPackage() {
    return {
      packageType: "PROJECT_WING_SMART_FORM" as const,
      formatVersion: 2 as const,
      template: {
        id: "smart-form-template-1",
        versionId: "smart-form-version-1",
        code: "SF-DEFERRED-INCOME",
        title: "Deferred income",
        publishedAt: "2026-06-01T00:00:00.000Z",
      },
      definition: DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
      response: structuredClone(DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE),
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    };
  }

  function makeProjectAttachment({
    id,
    originalName,
    workingPaper = selectedWorkingPaperLocation,
  }: {
    id: string;
    originalName: string;
    workingPaper?: NonNullable<ProjectAttachment["workingPaper"]>;
  }) {
    return {
      ...workingPaperNode.attachments[0],
      id,
      fileName: originalName,
      originalName,
      lastModifiedAt: "2026-06-01T09:00:00.000Z",
      lastModifier: {
        id: "modifier-1",
        name: "Modifier",
        email: "modifier@projectwing.local",
      },
      workingPaper,
    };
  }

  const secondLevelNode: WorkflowNode = {
    id: "node-2",
    parentId: "node-1",
    code: "A01",
    title: "Assets",
    level: 2,
    nodeType: "ACCOUNT",
    workingPapers: [],
    children: [thirdLevelNodeWithFile],
  };
  const preparedWorkingPaperNode = {
    ...workingPaperNode,
    id: "working-paper-prepared",
    preparedAt: "2026-06-01T08:00:00.000Z",
    preparer: {
      id: "user-preparer",
      name: "寮犱笁",
      email: "preparer@projectwing.local",
    },
    attachments: [],
  };
  const thirdLevelNodeWithPreparedFile: WorkflowNode = {
    ...thirdLevelNode,
    workingPapers: [preparedWorkingPaperNode],
  };
  const signedWorkingPaperNode = {
    ...workingPaperNode,
    id: "working-paper-signed",
    preparedAt: "2026-06-01T08:00:00.000Z",
    reviewedAt: "2026-06-01T09:00:00.000Z",
    preparer: {
      id: "user-preparer",
      name: "寮犱笁",
      email: "preparer@projectwing.local",
    },
    reviewer: {
      id: "user-reviewer",
      name: "鏉庡洓",
      email: "reviewer@projectwing.local",
    },
    attachments: [],
  };
  const thirdLevelNodeWithSignedFile: WorkflowNode = {
    ...thirdLevelNode,
    workingPapers: [signedWorkingPaperNode],
  };
  const longSignerWorkingPaperNode = {
    ...signedWorkingPaperNode,
    id: "working-paper-long-signers",
    signoffs: [
      {
        id: "signoff-preparer-long",
        type: "PREPARER" as const,
        signedAt: "2026-06-01T08:00:00.000Z",
        user: {
          id: "user-preparer-long",
          name: "Project lead",
          email: "lead@projectwing.local",
        },
      },
      {
        id: "signoff-reviewer-long",
        type: "REVIEWER" as const,
        signedAt: "2026-06-01T09:00:00.000Z",
        user: {
          id: "user-reviewer-long",
          name: "Quality reviewer",
          email: "review@projectwing.local",
        },
      },
    ],
  };
  const thirdLevelNodeWithLongSigners: WorkflowNode = {
    ...thirdLevelNode,
    workingPapers: [longSignerWorkingPaperNode],
  };
  const docxWorkingPaperNode = {
    ...workingPaperNode,
    id: "working-paper-docx",
    title: "meeting-minutes.docx",
    attachments: [
      {
        id: "attachment-docx",
        workingPaperId: "working-paper-docx",
        fileKind: "SUPPORTING" as const,
        fileName: "stored.docx",
        originalName: "meeting-minutes.docx",
        fileUrl: "working-papers/project-1/stored.docx",
        fileSize: 4096,
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        version: 1,
      },
    ],
  };
  const thirdLevelNodeWithDocxFile: WorkflowNode = {
    ...thirdLevelNode,
    workingPapers: [docxWorkingPaperNode],
  };
  const smartFormWorkingPaperNode = {
    ...workingPaperNode,
    id: "working-paper-smart-form",
    title: "independence.sf",
    attachments: [
      {
        id: "attachment-smart-form",
        workingPaperId: "working-paper-smart-form",
        fileKind: "SMART_FORM" as const,
        fileName: "stored.sf",
        originalName: "independence.sf",
        fileUrl: "working-papers/project-1/stored.sf",
        fileSize: 4096,
        mimeType: SMART_FORM_MIME_TYPE,
        version: 2,
      },
    ],
  };
  const thirdLevelNodeWithSmartFormFile: WorkflowNode = {
    ...thirdLevelNode,
    workingPapers: [smartFormWorkingPaperNode],
  };

  function makeCurrentReviewQuestion(
    overrides: Partial<WorkingPaperQuestion> = {}
  ): WorkingPaperQuestion {
    return {
      id: "question-current-paper",
      projectId: "project-1",
      workingPaperId: "working-paper-1",
      body: "Current file needs support.",
      status: "OPEN",
      assignedToId: "preparer-current",
      createdById: "reviewer-current",
      createdAt: "2026-06-01T11:00:00.000Z",
      updatedAt: "2026-06-01T11:00:00.000Z",
      assignedTo: {
        id: "preparer-current",
        name: "Preparer Current",
        email: "preparer-current@projectwing.local",
      },
      createdBy: {
        id: "reviewer-current",
        name: "Reviewer Current",
        email: "reviewer-current@projectwing.local",
      },
      messages: [
        {
          id: "message-current-question",
          questionId: "question-current-paper",
          authorId: "reviewer-current",
          messageType: "QUESTION",
          body: "Current file needs support.",
          createdAt: "2026-06-01T11:00:00.000Z",
          author: {
            id: "reviewer-current",
            name: "Reviewer Current",
            email: "reviewer-current@projectwing.local",
          },
        },
      ],
      ...overrides,
    };
  }

  function renderCurrentReviewQuestion(question: WorkingPaperQuestion) {
    vi.spyOn(api, "workingPaper").mockResolvedValue({
      ...workingPaperNode,
      reviewQuestions: [question],
    });

    return renderContent({
      currentUserId: "preparer-current",
      currentProjectRole: "PREPARER",
      selectedNode: {
        ...thirdLevelNodeWithFile,
        workingPapers: [
          {
            ...workingPaperNode,
            reviewQuestions: [question],
          },
        ],
      },
      selectedPaperId: "working-paper-1",
    });
  }

  function renderContent(
    overrides: Partial<Parameters<typeof WorkbenchContent>[0]> = {}
  ) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    function ContentHarness() {
      const [activeBucket, setActiveBucket] =
        useState<WorkingPaperBucket>("CURRENT");
      const form = useForm<WorkbenchPaperForm>({
        defaultValues: {
          code: "",
          title: "",
          paperType: "WORKING_PAPER",
        },
      });

      return createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          DndContext,
          null,
          createElement(
            ToastProvider,
            null,
            createElement(WorkbenchContent, {
              projectId: "project-1",
              copy: zhWorkbenchContentCopy,
              currentProjectRole: "PREPARER" as ProjectRole,
              selectedNode: null,
              activeBucket,
              onActiveBucketChange: setActiveBucket,
              canDeleteSelected: false,
              deleteSelected: vi.fn(),
              deletePending: false,
              paperForm: form,
              createPaper: vi.fn(),
              createPaperPending: false,
              selectedPaperId: null,
              setSelectedPaperId: vi.fn(),
              ...overrides,
            })
          )
        )
      );
    }

    const rendered = render(createElement(ContentHarness));
    return {
      ...rendered,
      queryClient,
      rerenderContent: () => rendered.rerender(createElement(ContentHarness)),
    };
  }

  function renderTemplateLibraryDialog({
    mode,
    onApplied = vi.fn(),
  }: {
    mode?: Parameters<typeof WorkbenchTemplateLibraryDialog>[0]["mode"];
    onApplied?: Parameters<
      typeof WorkbenchTemplateLibraryDialog
    >[0]["onApplied"];
  } = {}) {
    if (!vi.isMockFunction(api.smartFormTemplates)) {
      vi.spyOn(api, "smartFormTemplates").mockResolvedValue([]);
    }
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const onOpenChange = vi.fn();

    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          ToastProvider,
          null,
          createElement(WorkbenchTemplateLibraryDialog, {
            open: true,
            onOpenChange,
            mode,
            projectId: "project-1",
            projectLanguage: "zh-CN",
            projectFrameworkTemplateId: "framework-cas",
            workflow: [thirdLevelNode],
            initialTargetNodeId: thirdLevelNode.id,
            initialBucket: "CURRENT",
            copy: templateLibraryCopy,
            templateFileDetailHref: (templateId, fileId) =>
              `/templates/project/${templateId}/files/${fileId}`,
            onApplied,
          })
        )
      )
    );

    return { queryClient, onOpenChange };
  }

  it("renders Smart Form previews through their generated PDF cache", async () => {
    const readSmartForm = vi.spyOn(api, "readSmartForm");
    vi.spyOn(api, "workingPaper").mockResolvedValue(smartFormWorkingPaperNode);

    renderContent({
      selectedNode: thirdLevelNodeWithSmartFormFile,
      selectedPaperId: "working-paper-smart-form",
    });

    await screen.findByTestId("extend-pdf-viewer");
    expect(
      screen.getByTestId("extend-pdf-viewer").closest(".extend-viewer-surface")
    ).toBeTruthy();
    expect(api.previewAttachmentPdf).toHaveBeenCalledWith(
      "project-1",
      "attachment-smart-form",
      expect.any(Number)
    );
    expect(readSmartForm).not.toHaveBeenCalled();
  });

  it("opens the file status panel with lock and history details", async () => {
    const lockedAttachment = {
      ...workingPaperNode.attachments[0],
      version: 3,
      lockedBy: "lock-holder-1",
      lockedAt: "2026-06-01T08:30:00.000Z",
      lockExpiresAt: "2026-06-01T10:30:00.000Z",
      uploader: {
        id: "uploader-1",
        name: "Uploader",
        email: "uploader@projectwing.local",
      },
      lockHolder: {
        id: "lock-holder-1",
        name: "Lock Holder",
        email: "lock@projectwing.local",
      },
    };
    vi.spyOn(api, "workingPaper").mockResolvedValue({
      ...workingPaperNode,
      attachments: [lockedAttachment],
    });
    const attachmentHistory = vi
      .spyOn(api, "attachmentHistory")
      .mockResolvedValue({
        attachment: lockedAttachment,
        versions: [
          {
            id: "version-1",
            attachmentId: "attachment-1",
            projectId: "project-1",
            version: 1,
            parentVersionId: null,
            sourceVersionId: null,
            fileKind: "SPREADSHEET",
            fileName: "cash-v1.xlsx",
            originalName: "cash-v1.xlsx",
            fileUrl: "working-papers/project-1/cash-v1.xlsx",
            fileSize: 1024,
            mimeType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            workDate: "2026-05-31T00:00:00.000Z",
            uploadedAt: "2026-06-01T08:00:00.000Z",
            archivedBy: "lock-holder-1",
            action: "INITIAL",
            isCurrent: false,
            createdAt: "2026-06-01T08:00:00.000Z",
            uploadedByUser: {
              id: "lock-holder-1",
              name: "Lock Holder",
              email: "lock@projectwing.local",
            },
          },
          {
            id: "version-2",
            attachmentId: "attachment-1",
            projectId: "project-1",
            version: 2,
            parentVersionId: "version-1",
            sourceVersionId: null,
            fileKind: "SPREADSHEET",
            fileName: "cash-v2.xlsx",
            originalName: "cash-v2.xlsx",
            fileUrl: "working-papers/project-1/cash-v2.xlsx",
            fileSize: 2048,
            mimeType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            workDate: "2026-06-01T00:00:00.000Z",
            uploadedAt: "2026-06-01T09:00:00.000Z",
            archivedBy: "lock-holder-1",
            action: "UPLOAD",
            isCurrent: false,
            createdAt: "2026-06-01T09:00:00.000Z",
            uploadedByUser: {
              id: "lock-holder-1",
              name: "Lock Holder",
              email: "lock@projectwing.local",
            },
          },
          {
            id: "version-3",
            attachmentId: "attachment-1",
            projectId: "project-1",
            version: 3,
            parentVersionId: "version-1",
            sourceVersionId: "version-1",
            fileKind: "SPREADSHEET",
            fileName: "cash.xlsx",
            originalName: "cash.xlsx",
            fileUrl: "working-papers/project-1/cash.xlsx",
            fileSize: 3072,
            mimeType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            workDate: "2026-06-01T00:00:00.000Z",
            uploadedAt: "2026-06-01T09:30:00.000Z",
            archivedBy: "lock-holder-1",
            action: "RESTORE",
            isCurrent: true,
            createdAt: "2026-06-01T09:30:00.000Z",
            uploadedByUser: {
              id: "lock-holder-1",
              name: "Lock Holder",
              email: "lock@projectwing.local",
            },
          },
        ],
        events: [
          {
            id: "log-1",
            action: "ATTACHMENT_LOCKED",
            targetType: "ATTACHMENT",
            targetId: "attachment-1",
            projectId: "project-1",
            description: "閿佸畾鏂囦欢 cash.xlsx",
            createdAt: "2026-06-01T08:30:00.000Z",
            actor: {
              id: "lock-holder-1",
              name: "Lock Holder",
              email: "lock@projectwing.local",
              globalRole: "SENIOR",
            },
          },
        ],
      });

    renderContent({
      selectedNode: thirdLevelNodeWithFile,
      selectedPaperId: "working-paper-1",
    });

    await expect(
      screen.findByTestId("extend-xlsx-viewer")
    ).resolves.toBeTruthy();
    await openPaperTool("File status");

    await waitFor(() => {
      expect(attachmentHistory).toHaveBeenCalledWith(
        "project-1",
        "attachment-1"
      );
    });
    const lockedLabels = await screen.findAllByText("Locked");
    expect(lockedLabels.length).toBeGreaterThan(0);
    expect(screen.getAllByText("lock").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
    expect(screen.getByText("Current head")).toBeTruthy();
    expect(screen.getByText("branched from 1")).toBeTruthy();
    expect(screen.getByText("閿佸畾鏂囦欢 cash.xlsx")).toBeTruthy();
  });

  it("resets the head directly from the file status version history when Master is unlocked", async () => {
    const unlockedAttachment = {
      ...workingPaperNode.attachments[0],
      version: 3,
      headVersionId: "version-3",
      lastModifiedAt: "2026-06-01T09:30:00.000Z",
    };
    vi.spyOn(api, "workingPaper").mockResolvedValue({
      ...workingPaperNode,
      attachments: [unlockedAttachment],
    });
    const attachmentHistory = vi
      .spyOn(api, "attachmentHistory")
      .mockResolvedValue({
        attachment: unlockedAttachment,
        versions: [
          {
            id: "version-1",
            attachmentId: "attachment-1",
            projectId: "project-1",
            version: 1,
            parentVersionId: null,
            sourceVersionId: null,
            fileKind: "SPREADSHEET",
            fileName: "cash-v1.xlsx",
            originalName: "cash-v1.xlsx",
            fileUrl: "working-papers/project-1/cash-v1.xlsx",
            fileSize: 1024,
            mimeType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            workDate: "2026-05-31T00:00:00.000Z",
            uploadedAt: "2026-06-01T08:00:00.000Z",
            archivedBy: "user-1",
            action: "INITIAL",
            isCurrent: false,
            createdAt: "2026-06-01T08:00:00.000Z",
          },
          {
            id: "version-3",
            attachmentId: "attachment-1",
            projectId: "project-1",
            version: 3,
            parentVersionId: "version-1",
            sourceVersionId: "version-1",
            fileKind: "SPREADSHEET",
            fileName: "cash.xlsx",
            originalName: "cash.xlsx",
            fileUrl: "working-papers/project-1/cash.xlsx",
            fileSize: 3072,
            mimeType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            workDate: "2026-06-01T00:00:00.000Z",
            uploadedAt: "2026-06-01T09:30:00.000Z",
            archivedBy: "user-1",
            action: "RESTORE",
            isCurrent: true,
            createdAt: "2026-06-01T09:30:00.000Z",
          },
        ],
        events: [],
      });
    const restoreAttachmentVersion = vi
      .spyOn(api, "restoreAttachmentVersion")
      .mockResolvedValue({
        ...unlockedAttachment,
        version: 4,
        headVersionId: "version-4",
      });

    renderContent({
      selectedNode: thirdLevelNodeWithFile,
      selectedPaperId: "working-paper-1",
    });

    await expect(
      screen.findByTestId("extend-xlsx-viewer")
    ).resolves.toBeTruthy();
    await openPaperTool("File status");
    fireEvent.click(
      await screen.findByRole("button", { name: "Choose 1 for reset head" })
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Reset head to 1" })
    );

    await waitFor(() => {
      expect(restoreAttachmentVersion).toHaveBeenCalledWith(
        "project-1",
        "attachment-1",
        "version-1"
      );
    });
    await waitFor(() => {
      expect(attachmentHistory).toHaveBeenCalledTimes(2);
    });
  });

  it("lets the project PIC resolve a frozen desktop conflict from file history", async () => {
    const conflictedAttachment = {
      ...workingPaperNode.attachments[0],
      version: 3,
      headVersionId: "version-3",
      conflictFrozenAt: "2026-06-01T10:00:00.000Z",
      conflictCandidateVersionId: "version-4",
    };
    const serverVersion = {
      id: "version-3",
      attachmentId: "attachment-1",
      projectId: "project-1",
      version: 3,
      parentVersionId: "version-2",
      sourceVersionId: null,
      fileKind: "SPREADSHEET" as const,
      fileName: "cash.xlsx",
      originalName: "cash.xlsx",
      fileUrl: "working-papers/project-1/cash.xlsx",
      fileSize: 3072,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      uploadedAt: "2026-06-01T09:30:00.000Z",
      archivedBy: "user-1",
      action: "CHECK_IN",
      isCurrent: true,
      createdAt: "2026-06-01T09:30:00.000Z",
    };
    const candidateVersion = {
      ...serverVersion,
      id: "version-4",
      version: 4,
      parentVersionId: "version-2",
      fileName: "cash-conflict.xlsx",
      originalName: "cash-conflict.xlsx",
      fileUrl: "working-papers/project-1/cash-conflict.xlsx",
      fileSize: 4096,
      uploadedAt: "2026-06-01T10:00:00.000Z",
      createdAt: "2026-06-01T10:00:00.000Z",
      isCurrent: false,
      contentHash:
        "abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd",
      conflictState: "OPEN",
      conflictBaseVersionId: "version-2",
      conflictServerVersionId: "version-3",
    };
    vi.spyOn(api, "workingPaper").mockResolvedValue({
      ...workingPaperNode,
      attachments: [conflictedAttachment],
    });
    vi.spyOn(api, "attachmentHistory").mockResolvedValue({
      attachment: conflictedAttachment,
      versions: [serverVersion, candidateVersion],
      events: [],
    });
    vi.spyOn(api, "attachmentConflicts").mockResolvedValue({
      frozen: true,
      frozenAt: conflictedAttachment.conflictFrozenAt,
      headVersionId: "version-3",
      candidateVersionId: "version-4",
      candidates: [candidateVersion],
    });
    const resolveAttachmentConflict = vi
      .spyOn(api, "resolveAttachmentConflict")
      .mockResolvedValue({
        ...conflictedAttachment,
        version: 4,
        headVersionId: "version-4",
        conflictFrozenAt: null,
        conflictCandidateVersionId: null,
      });

    renderContent({
      currentProjectRole: "PARTNER",
      selectedNode: thirdLevelNodeWithFile,
      selectedPaperId: "working-paper-1",
    });

    await expect(
      screen.findByTestId("extend-xlsx-viewer")
    ).resolves.toBeTruthy();
    await openPaperTool("File status");
    await expect(
      screen.findByText("File version conflict detected")
    ).resolves.toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Use desktop candidate" })
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Confirm resolution" })
    );

    await waitFor(() => {
      expect(resolveAttachmentConflict).toHaveBeenCalledWith(
        "project-1",
        "attachment-1",
        "version-4",
        "USE_CANDIDATE"
      );
    });
  });

  it("shows project file status details in the status column", async () => {
    const dateNowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValue(Date.parse("2026-06-01T08:30:30.000Z"));
    const lockedAttachment = {
      ...workingPaperNode.attachments[0],
      code: "1100.1",
      fileName: "cash.xlsx",
      originalName: "cash.xlsx",
      lockedBy: "lock-holder-1",
      lockedAt: "2026-06-01T08:30:00.000Z",
      lockExpiresAt: "2026-06-01T10:30:00.000Z",
      lastModifiedAt: "2026-06-01T09:00:00.000Z",
      lockHolder: {
        id: "lock-holder-1",
        name: "Lock Holder",
        email: "lock@projectwing.local",
      },
      lastModifier: {
        id: "modifier-1",
        name: "Modifier",
        email: "modifier@projectwing.local",
      },
    };
    vi.spyOn(api, "workingPaper").mockResolvedValue({
      ...workingPaperNode,
      attachments: [lockedAttachment],
    });
    const projectAttachments = vi
      .spyOn(api, "projectAttachments")
      .mockResolvedValue([
        {
          ...lockedAttachment,
          workingPaper: {
            id: "working-paper-1",
            code: "A01-0001-F001",
            title: "Cash paper",
            bucket: "CURRENT",
            workflowNodeId: "node-3",
            workflowNodeCode: "A01-0001",
            workflowNodeTitle: "Cash",
            path: [
              { id: "node-1", code: "1000", title: "Execution", level: 1 },
              { id: "node-2", code: "A01", title: "Assets", level: 2 },
              { id: "node-3", code: "A01-0001", title: "Cash", level: 3 },
            ],
          },
        },
      ]);

    renderContent({
      selectedNode: thirdLevelNodeWithFile,
      selectedPaperId: "working-paper-1",
    });

    await expect(
      screen.findByTestId("extend-xlsx-viewer")
    ).resolves.toBeTruthy();
    await openPaperTool("Project files");

    await waitFor(() => {
      expect(projectAttachments).toHaveBeenCalledWith("project-1");
    });
    expect(screen.getAllByText("Project files").length).toBeGreaterThan(0);
    expect(screen.getByText("1100.1")).toBeTruthy();
    const fileCell = screen
      .getAllByText(/cash\.xlsx/)
      .find((element) => element.closest("td"))
      ?.closest("td");
    expect(fileCell).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeTruthy();
    const statusText = screen.getByText(
      "Lock Holder opened Master within 1 minute"
    );
    expect(statusText.closest("td")).not.toBe(fileCell);
    expect(
      within(statusText.closest("td") as HTMLElement).getByText(
        "Lock Holder opened Master within 1 minute"
      )
    ).toBeTruthy();
    dateNowSpy.mockRestore();
  });

  it("shows no second-level precision for recent Master locks", async () => {
    const dateNowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValue(Date.parse("2026-06-01T08:30:45.000Z"));
    const lockedAttachment = {
      ...workingPaperNode.attachments[0],
      fileName: "cash.xlsx",
      originalName: "cash.xlsx",
      lockedBy: "lock-holder-1",
      lockedAt: "2026-06-01T08:30:10.000Z",
      lockExpiresAt: "2026-06-01T10:30:00.000Z",
      lockHolder: {
        id: "lock-holder-1",
        name: "Lock Holder",
        email: "lock@projectwing.local",
      },
    };
    vi.spyOn(api, "workingPaper").mockResolvedValue({
      ...workingPaperNode,
      attachments: [lockedAttachment],
    });
    vi.spyOn(api, "projectAttachments").mockResolvedValue([
      {
        ...lockedAttachment,
        workingPaper: {
          id: "working-paper-1",
          code: "A01-0001-F001",
          title: "Cash paper",
          bucket: "CURRENT",
          workflowNodeId: "node-3",
          workflowNodeCode: "A01-0001",
          workflowNodeTitle: "Cash",
          path: [
            { id: "node-1", code: "Execution", title: "Execution", level: 1 },
            { id: "node-2", code: "A01", title: "Assets", level: 2 },
            { id: "node-3", code: "A01-0001", title: "Cash", level: 3 },
          ],
        },
      },
    ]);

    renderContent({
      selectedNode: thirdLevelNodeWithFile,
      selectedPaperId: "working-paper-1",
    });

    await expect(
      screen.findByTestId("extend-xlsx-viewer")
    ).resolves.toBeTruthy();
    await openPaperTool("Project files");
    await expect(
      screen.findByText("Lock Holder opened Master within 1 minute")
    ).resolves.toBeTruthy();
    dateNowSpy.mockRestore();
  });

  it("renders project files as EY-style evidence rows with signoff columns", async () => {
    const signedIndexPaper = {
      ...workingPaperNode,
      id: "working-paper-signed-index",
      code: "A01-0001-F010",
      title: "Signed index paper",
      attachments: [],
      signoffs: [
        {
          id: "signoff-preparer-index",
          type: "PREPARER" as const,
          signedAt: "2026-06-01T08:00:00.000Z",
          user: {
            id: "preparer-index",
            name: "Preparer One",
            email: "preparer-one@projectwing.local",
          },
        },
        {
          id: "signoff-reviewer-index",
          type: "REVIEWER" as const,
          signedAt: "2026-06-01T09:00:00.000Z",
          user: {
            id: "reviewer-index",
            name: "Reviewer One",
            email: "reviewer-one@projectwing.local",
          },
        },
        {
          id: "signoff-reviewer-two-index",
          type: "REVIEWER" as const,
          signedAt: "2026-06-01T10:00:00.000Z",
          user: {
            id: "reviewer-two-index",
            name: "Reviewer Two",
            email: "reviewer-two@projectwing.local",
          },
        },
      ],
    };
    vi.spyOn(api, "projectAttachments").mockResolvedValue([
      {
        ...makeProjectAttachment({
          id: "attachment-signed-index",
          originalName: "signed-index.xlsx",
          workingPaper: {
            ...selectedWorkingPaperLocation,
            id: signedIndexPaper.id,
            code: signedIndexPaper.code,
            title: signedIndexPaper.title,
            signoffs: signedIndexPaper.signoffs,
            reviewQuestions: [
              {
                id: "question-index",
                projectId: "project-1",
                workingPaperId: signedIndexPaper.id,
                body: "Explain the variance.",
                status: "CLEARED" as const,
                assignedToId: "preparer-index",
                createdById: "reviewer-index",
                createdAt: "2026-06-01T11:00:00.000Z",
                updatedAt: "2026-06-01T11:00:00.000Z",
              },
            ],
          },
        }),
        workingPaperId: signedIndexPaper.id,
        version: 4,
        fileSize: 1_995_776,
      },
    ]);

    const signedIndexNode: WorkflowNode = {
      ...thirdLevelNode,
      workingPapers: [signedIndexPaper],
    };

    renderContent({
      selectedNode: signedIndexNode,
      workflow: [{ ...secondLevelNode, children: [signedIndexNode] }],
    });

    await expect(
      screen.findByRole("columnheader", { name: "Ref" })
    ).resolves.toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "File" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Note" })).toBeTruthy();
    const signoffsHeader = screen.getByRole("columnheader", {
      name: "Sign-offs",
    }) as HTMLTableCellElement;
    expect(screen.queryByRole("columnheader", { name: "Review" })).toBeNull();
    expect(
      screen.queryByRole("columnheader", { name: "Attributes" })
    ).toBeNull();
    expect(signoffsHeader).toBeTruthy();
    expect(screen.getAllByText("A01-0001-F010").length).toBeGreaterThan(0);
    const titleCell = screen
      .getByText(/signed\s+-\s+index\.xlsx/)
      .closest("td");
    expect(titleCell).not.toHaveAttribute("title");
    const closedNotesButton = screen.getByLabelText(
      /1 note for signed\s+-\s+index\.xlsx/
    );
    expect(
      closedNotesButton.querySelector('[data-review-question-state="closed"]')
    ).toHaveClass("text-success-accent", "bg-success-subtle");
    expect(
      closedNotesButton.querySelector(
        '[data-review-question-state="closed"] span'
      )
    ).toHaveClass("text-foreground");
    expect(screen.getByLabelText(/Signed by Preparer One/)).toBeTruthy();
    expect(
      screen.getByLabelText(/Signed by Reviewer One.*Reviewer Two/)
    ).toBeTruthy();
    expect(screen.queryByText("Preparer One")).toBeNull();
    expect(screen.queryByText("Reviewer One, Reviewer Two")).toBeNull();
    expect(screen.queryByText(/Modified by/)).toBeNull();
    expect(screen.queryByText(/Work date/)).toBeNull();
    expect(screen.queryByText("Spreadsheet")).toBeNull();
    expect(screen.queryByText("Available")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: /1 note for signed\s+-\s+index\.xlsx/,
      })
    );
  });

  it("creates review notes from the project file index without opening workbench", async () => {
    const signedIndexPaper = {
      ...workingPaperNode,
      id: "working-paper-signed-index",
      code: "A01-0001-F010",
      title: "Signed index paper",
      attachments: [],
    };
    vi.spyOn(api, "projectAttachments").mockResolvedValue([
      {
        ...makeProjectAttachment({
          id: "attachment-signed-index",
          originalName: "signed-index.xlsx",
          workingPaper: {
            ...selectedWorkingPaperLocation,
            id: signedIndexPaper.id,
            code: signedIndexPaper.code,
            title: signedIndexPaper.title,
            reviewQuestions: [],
          },
        }),
        workingPaperId: signedIndexPaper.id,
      },
    ]);
    vi.spyOn(api, "members").mockResolvedValue([
      {
        id: "member-preparer-index",
        projectRole: "PREPARER",
        allowedProjectRoles: ["PREPARER"],
        roleConsistent: true,
        declarationAccepted: true,
        user: {
          id: "preparer-index",
          name: "Preparer One",
          email: "preparer-one@projectwing.local",
          globalRole: "STAFF",
          status: "ACTIVE",
        },
      },
    ]);
    const createQuestion = vi
      .spyOn(api, "createAttachmentQuestion")
      .mockResolvedValue({
        id: "question-new-index",
        projectId: "project-1",
        workingPaperId: signedIndexPaper.id,
        attachmentId: "attachment-signed-index",
        body: "Please explain cutoff.",
        status: "OPEN",
        assignedToId: "preparer-index",
        createdById: "reviewer-index",
        createdAt: "2026-06-01T12:00:00.000Z",
        updatedAt: "2026-06-01T12:00:00.000Z",
      });

    const signedIndexNode: WorkflowNode = {
      ...thirdLevelNode,
      workingPapers: [],
    };
    renderContent({
      currentUserId: "reviewer-index",
      currentProjectRole: "REVIEWER",
      selectedNode: signedIndexNode,
      workflow: [{ ...secondLevelNode, children: [signedIndexNode] }],
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: /No notes for signed\s+-\s+index\.xlsx/,
      })
    );

    await expect(
      screen.findByRole("button", { name: "New review note" })
    ).resolves.toBeTruthy();
    expect(screen.queryByLabelText("Search review notes")).toBeNull();
    expect(screen.queryByText("A01 Assets")).toBeNull();
    expect(screen.getAllByText("A01-0001-F010").length).toBeGreaterThan(0);
    expect(screen.getByText(/signed\s+-\s+index\.xlsx/)).toBeTruthy();
    expect(screen.queryByText("Working paper")).toBeNull();
    expect(
      screen.getByRole("toolbar", { name: "Formatting toolbar" })
    ).toBeTruthy();
    expect(screen.getByRole("dialog")).toHaveAttribute(
      "data-workbench-interaction-lock",
      "true"
    );
    expect(screen.getByTestId("review-note-new-form")).toHaveClass(
      "h-full",
      "min-h-0"
    );
    expect(
      screen
        .getByRole("textbox", { name: "Review note content" })
        .closest('[data-slot="review-note-rich-text-composer"]')
    ).toHaveClass("flex-1", "min-h-0");
    expect(screen.queryByText("Enter to send")).toBeNull();
    expect(screen.queryByText("Paste screenshot to attach")).toBeNull();
    enterReviewNoteContent("Please explain cutoff.");
    await chooseSelectOption(
      document.body,
      "Assign respondent",
      /Preparer One/
    );
    fireEvent.click(screen.getByRole("button", { name: "Add review note" }));

    await waitFor(() => {
      expect(createQuestion).toHaveBeenCalledWith(
        "project-1",
        "attachment-signed-index",
        {
          body: "Please explain cutoff.",
          assignedToId: "preparer-index",
        }
      );
    });
  });

  it("reports a stable file target only when the Notes control is clicked", async () => {
    const onOpenReviewNotes = vi.fn();
    const legacyQuestion = makeCurrentReviewQuestion({
      id: "question-legacy-notes-target",
      workingPaperId: "working-paper-notes-target",
      attachmentId: null,
    });
    const attachmentQuestion = makeCurrentReviewQuestion({
      id: "question-attachment-notes-target",
      workingPaperId: "working-paper-notes-target",
      attachmentId: "attachment-notes-target",
    });
    const paper = {
      ...workingPaperNode,
      id: "working-paper-notes-target",
      code: "A01-0001-F020",
      title: "Notes target paper",
      attachments: [],
    };
    vi.spyOn(api, "projectAttachments").mockResolvedValue([
      {
        ...makeProjectAttachment({
          id: "attachment-notes-target",
          originalName: "notes-target.xlsx",
          workingPaper: {
            ...selectedWorkingPaperLocation,
            id: paper.id,
            code: paper.code,
            title: paper.title,
            reviewQuestions: [legacyQuestion, attachmentQuestion],
          },
        }),
        workingPaperId: paper.id,
      },
    ]);
    const selectedNode: WorkflowNode = {
      ...thirdLevelNode,
      workingPapers: [],
    };

    renderContent({
      selectedNode,
      workflow: [{ ...secondLevelNode, children: [selectedNode] }],
      onOpenReviewNotes,
    });

    const fileName = await screen.findByText(/notes\s+-\s+target\.xlsx/);
    fireEvent.click(fileName);
    expect(onOpenReviewNotes).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", {
        name: /2 notes for notes\s+-\s+target\.xlsx/,
      })
    );

    expect(
      screen
        .getByRole("button", { name: /2 notes for notes\s+-\s+target\.xlsx/ })
        .querySelector('[data-review-question-state="open"]')
    ).toHaveClass("text-warning-accent", "bg-warning-subtle");

    expect(onOpenReviewNotes).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        key: "attachment:attachment-notes-target",
        kind: "attachment",
        attachmentId: "attachment-notes-target",
        paperId: paper.id,
        bucket: "CURRENT",
        reference: paper.code,
      })
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not preview a file when opening or clicking inside its review notes dialog", async () => {
    vi.spyOn(api, "projectAttachments").mockResolvedValue([
      makeProjectAttachment({
        id: "notes-preview-test",
        originalName: "notes-preview.xlsx",
      }),
    ]);
    vi.spyOn(api, "members").mockResolvedValue([]);
    const onPreviewFile = vi.fn();
    renderContent({
      currentUserId: "reviewer-index",
      currentProjectRole: "REVIEWER",
      selectedNode: { ...thirdLevelNode, workingPapers: [] },
      onPreviewFile,
    });
    fireEvent.click(
      await screen.findByRole("button", {
        name: /No notes for notes\s*-\s*preview.xlsx/,
      })
    );
    const dialog = await screen.findByRole("dialog");
    expect(onPreviewFile).not.toHaveBeenCalled();
    fireEvent.click(dialog);
    expect(onPreviewFile).not.toHaveBeenCalled();
  });

  it("attaches selected images when creating review notes from the project file index", async () => {
    const signedIndexPaper = {
      ...workingPaperNode,
      id: "working-paper-signed-index",
      code: "A01-0001-F010",
      title: "Signed index paper",
      attachments: [],
    };
    vi.spyOn(api, "projectAttachments").mockResolvedValue([
      {
        ...makeProjectAttachment({
          id: "attachment-signed-index",
          originalName: "signed-index.xlsx",
          workingPaper: {
            ...selectedWorkingPaperLocation,
            id: signedIndexPaper.id,
            code: signedIndexPaper.code,
            title: signedIndexPaper.title,
            reviewQuestions: [],
          },
        }),
        workingPaperId: signedIndexPaper.id,
      },
    ]);
    vi.spyOn(api, "members").mockResolvedValue([]);
    const createQuestion = vi
      .spyOn(api, "createAttachmentQuestion")
      .mockResolvedValue({
        id: "question-new-index",
        projectId: "project-1",
        workingPaperId: signedIndexPaper.id,
        attachmentId: "attachment-signed-index",
        body: "Please explain cutoff.",
        status: "OPEN",
        assignedToId: null,
        createdById: "reviewer-index",
        createdAt: "2026-06-01T12:00:00.000Z",
        updatedAt: "2026-06-01T12:00:00.000Z",
      });
    const uploadedImage = {
      objectKey:
        "review-question-images/project-1/question-new-index/chart.png",
      fileName: "chart.png",
      fileSize: 7,
      mimeType: "image/png",
    };
    const uploadImage = vi
      .spyOn(api, "uploadReviewQuestionImage")
      .mockResolvedValue(uploadedImage);
    const attachInitial = vi
      .spyOn(api, "attachWorkingPaperQuestionInitialMessage")
      .mockResolvedValue({
        id: "question-new-index",
        projectId: "project-1",
        workingPaperId: signedIndexPaper.id,
        body: "Please explain cutoff.",
        status: "OPEN",
        assignedToId: null,
        createdById: "reviewer-index",
        createdAt: "2026-06-01T12:00:00.000Z",
        updatedAt: "2026-06-01T12:00:00.000Z",
      });
    const createObjectURL = vi.fn(() => "blob:new-review-note-image-preview");
    const revokeObjectURL = vi.fn();
    stubObjectUrl(createObjectURL, revokeObjectURL);

    const signedIndexNode: WorkflowNode = {
      ...thirdLevelNode,
      workingPapers: [],
    };

    renderContent({
      currentUserId: "reviewer-index",
      currentProjectRole: "REVIEWER",
      selectedNode: signedIndexNode,
      workflow: [{ ...secondLevelNode, children: [signedIndexNode] }],
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: /No notes for signed\s+-\s+index\.xlsx/,
      })
    );

    const image = new File(["preview"], "chart.png", {
      type: "image/png",
    });
    enterReviewNoteContent("Please explain cutoff.");
    const attachInput = screen
      .getAllByLabelText("Attach file")
      .find(
        (element): element is HTMLInputElement =>
          element instanceof HTMLInputElement
      );
    fireEvent.change(requireElement(attachInput), {
      target: { files: [image] },
    });
    await expect(screen.findByText("chart.png")).resolves.toBeTruthy();
    fireEvent.click(
      await screen.findByRole("button", { name: "Add review note" })
    );

    await waitFor(() => {
      expect(createQuestion).toHaveBeenCalledWith(
        "project-1",
        "attachment-signed-index",
        {
          body: "Please explain cutoff.",
          assignedToId: "",
        }
      );
      expect(uploadImage).toHaveBeenCalledWith(
        "project-1",
        "question-new-index",
        image
      );
      expect(attachInitial).toHaveBeenCalledWith(
        "project-1",
        "question-new-index",
        [uploadedImage]
      );
    });
  });

  it("attaches pasted screenshots when creating review notes", async () => {
    const signedIndexPaper = {
      ...workingPaperNode,
      id: "working-paper-signed-index",
      code: "A01-0001-F010",
      title: "Signed index paper",
      attachments: [],
    };
    vi.spyOn(api, "projectAttachments").mockResolvedValue([
      {
        ...makeProjectAttachment({
          id: "attachment-signed-index",
          originalName: "signed-index.xlsx",
          workingPaper: {
            ...selectedWorkingPaperLocation,
            id: signedIndexPaper.id,
            code: signedIndexPaper.code,
            title: signedIndexPaper.title,
            reviewQuestions: [],
          },
        }),
        workingPaperId: signedIndexPaper.id,
      },
    ]);
    vi.spyOn(api, "members").mockResolvedValue([]);
    vi.spyOn(api, "createAttachmentQuestion").mockResolvedValue({
      id: "question-new-index",
      projectId: "project-1",
      workingPaperId: signedIndexPaper.id,
      attachmentId: "attachment-signed-index",
      body: "Please explain cutoff.",
      status: "OPEN",
      assignedToId: null,
      createdById: "reviewer-index",
      createdAt: "2026-06-01T12:00:00.000Z",
      updatedAt: "2026-06-01T12:00:00.000Z",
    });
    const uploadedImage = {
      objectKey:
        "review-question-images/project-1/question-new-index/pasted.png",
      fileName: "pasted.png",
      fileSize: 7,
      mimeType: "image/png",
    };
    const uploadImage = vi
      .spyOn(api, "uploadReviewQuestionImage")
      .mockResolvedValue(uploadedImage);
    const attachInitial = vi
      .spyOn(api, "attachWorkingPaperQuestionInitialMessage")
      .mockResolvedValue({
        id: "question-new-index",
        projectId: "project-1",
        workingPaperId: signedIndexPaper.id,
        body: "Please explain cutoff.",
        status: "OPEN",
        assignedToId: null,
        createdById: "reviewer-index",
        createdAt: "2026-06-01T12:00:00.000Z",
        updatedAt: "2026-06-01T12:00:00.000Z",
      });
    const createObjectURL = vi.fn(() => "blob:new-review-note-paste-preview");
    const revokeObjectURL = vi.fn();
    stubObjectUrl(createObjectURL, revokeObjectURL);

    const signedIndexNode: WorkflowNode = {
      ...thirdLevelNode,
      workingPapers: [],
    };

    renderContent({
      currentUserId: "reviewer-index",
      currentProjectRole: "REVIEWER",
      selectedNode: signedIndexNode,
      workflow: [{ ...secondLevelNode, children: [signedIndexNode] }],
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: /No notes for signed\s+-\s+index\.xlsx/,
      })
    );

    const pastedImage = new File(["preview"], "image.png", {
      type: "image/png",
    });
    const contentBox = enterReviewNoteContent("Please explain cutoff.");
    fireEvent.paste(contentBox, {
      clipboardData: {
        getData: (type: string) => (type === "text/plain" ? "" : ""),
        items: [
          {
            kind: "file",
            type: "image/png",
            getAsFile: () => pastedImage,
          },
        ],
        files: [],
      },
    });
    await expect(
      screen.findByText(/pasted-screenshot-.*\.png/)
    ).resolves.toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add review note" }));

    await waitFor(() => {
      expect(uploadImage).toHaveBeenCalledWith(
        "project-1",
        "question-new-index",
        expect.objectContaining({
          name: expect.stringMatching(/^pasted-screenshot-.*\.png$/),
          type: "image/png",
        })
      );
      expect(attachInitial).toHaveBeenCalledWith(
        "project-1",
        "question-new-index",
        [uploadedImage]
      );
    });
  });

  it("does not expose the legacy versions and locks tool panel", async () => {
    vi.spyOn(api, "workingPaper").mockResolvedValue(docxWorkingPaperNode);

    renderContent({
      selectedNode: thirdLevelNodeWithDocxFile,
      selectedPaperId: "working-paper-docx",
    });

    await expect(
      screen.findByText("meeting - minutes.docx")
    ).resolves.toBeTruthy();
    fireEvent.click(
      await screen.findByRole("button", { name: "Open file tools" })
    );
    expect(
      screen.queryByRole("menuitem", { name: "Versions and locks" })
    ).toBeNull();
  });

  it("does not expose the project recycle bin from paper tools", async () => {
    vi.spyOn(api, "workingPaper").mockResolvedValue(workingPaperNode);

    renderContent({
      selectedNode: thirdLevelNodeWithFile,
      selectedPaperId: "working-paper-1",
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Open file tools" })
    );

    expect(screen.queryByRole("menuitem", { name: "Recycle bin" })).toBeNull();
  });

  it("shows preparation and review actions to ordinary project members", async () => {
    vi.spyOn(api, "workingPaper").mockResolvedValue(workingPaperNode);

    renderContent({
      currentProjectRole: "PREPARER",
      selectedNode: thirdLevelNodeWithFile,
      selectedPaperId: "working-paper-1",
    });

    await openPaperTool("Signoff and review");
    expect(
      screen.getByRole("button", { name: "Prepared signoff" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Reviewed signoff" })
    ).toBeTruthy();
    await openPaperTool("Review notes");
    await expect(screen.findByText("Add review note")).resolves.toBeTruthy();
  });

  it("allows a preparer to sign after reviewers have already signed", async () => {
    vi.spyOn(api, "workingPaper").mockResolvedValue(signedWorkingPaperNode);

    renderContent({
      currentUserId: "new-preparer",
      currentProjectRole: "PREPARER",
      selectedNode: thirdLevelNodeWithSignedFile,
      selectedPaperId: "working-paper-signed",
    });

    await openPaperTool("Signoff and review");
    expect(
      screen.getByRole("button", { name: "Prepared signoff" })
    ).not.toBeDisabled();
  });

  it("shows a disabled review action until a preparation signoff exists", async () => {
    vi.spyOn(api, "workingPaper").mockResolvedValue(workingPaperNode);

    renderContent({
      currentProjectRole: "REVIEWER",
      selectedNode: thirdLevelNodeWithFile,
      selectedPaperId: "working-paper-1",
    });

    await openPaperTool("Signoff and review");
    expect(
      screen.getByRole("button", { name: "Reviewed signoff" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Prepared signoff" })
    ).toBeTruthy();
    await openPaperTool("Review notes");
    await expect(screen.findByText("Add review note")).resolves.toBeTruthy();
  });

  it("scopes the review notes dialog to the current workpaper", async () => {
    vi.spyOn(api, "workingPaper").mockResolvedValue({
      ...workingPaperNode,
      reviewQuestions: [
        {
          id: "question-current-paper",
          projectId: "project-1",
          workingPaperId: "working-paper-1",
          body: "Current file needs support.",
          status: "OPEN",
          assignedToId: null,
          createdById: "reviewer-current",
          createdAt: "2026-06-01T11:00:00.000Z",
          updatedAt: "2026-06-01T11:00:00.000Z",
          createdBy: {
            id: "reviewer-current",
            name: "Reviewer Current",
            email: "reviewer-current@projectwing.local",
          },
          messages: [
            {
              id: "message-current-question",
              questionId: "question-current-paper",
              authorId: "reviewer-current",
              messageType: "QUESTION",
              body: "Current file needs support.",
              createdAt: "2026-06-01T11:00:00.000Z",
              author: {
                id: "reviewer-current",
                name: "Reviewer Current",
                email: "reviewer-current@projectwing.local",
              },
            },
            {
              id: "message-current-reply",
              questionId: "question-current-paper",
              authorId: "preparer-current",
              messageType: "REPLY",
              body: "Support has been added.",
              createdAt: "2026-06-01T11:30:00.000Z",
              author: {
                id: "preparer-current",
                name: "Preparer Current",
                email: "preparer-current@projectwing.local",
              },
            },
          ],
        },
        {
          id: "question-other-paper",
          projectId: "project-1",
          workingPaperId: "working-paper-other",
          body: "Other file should stay hidden.",
          status: "OPEN",
          assignedToId: null,
          createdById: "reviewer-other",
          createdAt: "2026-06-01T12:00:00.000Z",
          updatedAt: "2026-06-01T12:00:00.000Z",
        },
      ],
    });

    renderContent({
      currentProjectRole: "REVIEWER",
      selectedNode: thirdLevelNodeWithFile,
      selectedPaperId: "working-paper-1",
    });

    await openPaperTool("Review notes");

    const currentFileQuestions = await screen.findAllByText(
      "Current file needs support."
    );
    expect(currentFileQuestions.length).toBeGreaterThan(0);
    expect(screen.getAllByText("Open").length).toBeGreaterThan(0);
  });

  it("marks review notes as replied with an explicit action", async () => {
    const openQuestion = {
      id: "question-current-paper",
      projectId: "project-1",
      workingPaperId: "working-paper-1",
      body: "Current file needs support.",
      status: "OPEN" as const,
      assignedToId: "preparer-current",
      createdById: "reviewer-current",
      createdAt: "2026-06-01T11:00:00.000Z",
      updatedAt: "2026-06-01T11:00:00.000Z",
      assignedTo: {
        id: "preparer-current",
        name: "Preparer Current",
        email: "preparer-current@projectwing.local",
      },
      createdBy: {
        id: "reviewer-current",
        name: "Reviewer Current",
        email: "reviewer-current@projectwing.local",
      },
      messages: [
        {
          id: "message-current-question",
          questionId: "question-current-paper",
          authorId: "reviewer-current",
          messageType: "QUESTION" as const,
          body: "Current file needs support.",
          createdAt: "2026-06-01T11:00:00.000Z",
          author: {
            id: "reviewer-current",
            name: "Reviewer Current",
            email: "reviewer-current@projectwing.local",
          },
        },
      ],
    };
    vi.spyOn(api, "workingPaper").mockResolvedValue({
      ...workingPaperNode,
      reviewQuestions: [openQuestion],
    });
    const replyQuestion = vi.spyOn(api, "replyWorkingPaperQuestion");
    const markReplied = vi
      .spyOn(api, "markWorkingPaperQuestionReplied")
      .mockResolvedValue({
        ...openQuestion,
        status: "REPLIED",
        repliedById: "preparer-current",
        repliedAt: "2026-06-01T11:30:00.000Z",
      });

    renderContent({
      currentUserId: "preparer-current",
      currentProjectRole: "PREPARER",
      selectedNode: {
        ...thirdLevelNodeWithFile,
        workingPapers: [
          {
            ...workingPaperNode,
            reviewQuestions: [openQuestion],
          },
        ],
      },
      selectedPaperId: "working-paper-1",
    });

    await openPaperTool("Review notes");
    expect(
      screen.getByRole("toolbar", { name: "Formatting toolbar" })
    ).toBeTruthy();
    expect(screen.queryByText("Enter to send")).toBeNull();
    expect(screen.queryByText("Shift+Enter for a new line")).toBeNull();
    expect(screen.queryByText("Ctrl+Enter also sends")).toBeNull();
    expect(screen.queryByText("Paste screenshot to attach")).toBeNull();
    fireEvent.click(
      await screen.findByRole("button", { name: "Mark replied" })
    );

    await waitFor(() => {
      expect(markReplied).toHaveBeenCalledWith(
        "project-1",
        "question-current-paper"
      );
    });
    expect(replyQuestion).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "creates a mobile Q with permitted respondent and selected workpaper references (authorization revoked: %s)",
    async (authorizationRevoked) => {
      vi.stubGlobal("matchMedia", () => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      const member = (
        id: string,
        overrides: Partial<ProjectMember> = {}
      ): ProjectMember => ({
        id: `membership-${id}`,
        projectRole: "PREPARER",
        allowedProjectRoles: ["PREPARER"],
        roleConsistent: true,
        declarationAccepted: true,
        user: {
          id,
          name: `Member ${id}`,
          email: `${id}@example.com`,
          globalRole: "STAFF",
          status: "ACTIVE",
        },
        ...overrides,
      });
      const disabled = member("disabled");
      disabled.user.status = "DISABLED";
      const members = [
        member("current"),
        member("allowed"),
        disabled,
        member("suspended", {
          authorizationSuspendedAt: "2026-09-01T00:00:00Z",
        }),
        member("inconsistent", { roleConsistent: false }),
      ];
      const body = "Mobile issue with evidence.";
      const createQuestion = vi.fn(() => makeCurrentReviewQuestion({ body }));
      const panel = (currentMembers: ProjectMember[]) => (
        <ToastProvider>
          <ReviewQuestionsPanel
            canReview
            currentUserId="current"
            members={currentMembers}
            questions={[]}
            workflow={[
              {
                ...thirdLevelNode,
                workingPapers: [
                  {
                    ...workingPaperNode,
                    id: "paper-ref",
                    code: "A-REF",
                    title: "Reference paper",
                  },
                ],
              },
            ]}
            defaultPaperId="working-paper-1"
            defaultPaper={{
              id: "working-paper-1",
              code: "A-1",
              title: "Current paper",
            }}
            autoOpen
            hideTrigger
            startInCreateMode
            pending={false}
            createQuestion={createQuestion}
            replyQuestion={vi.fn()}
            uploadQuestionImage={vi.fn()}
            attachInitialQuestionFiles={vi.fn()}
            downloadQuestionImage={vi.fn()}
            markRepliedQuestion={vi.fn()}
            clearQuestion={vi.fn()}
            followUpQuestion={vi.fn()}
            reopenQuestion={vi.fn()}
          />
        </ToastProvider>
      );
      const { rerender } = render(panel(members));
      const footer = await screen.findByTestId("emp-mobile-q-create-footer");
      expect(
        within(footer).getByRole("button", { name: "Add review note" })
      ).toBeDisabled();
      fireEvent.click(
        within(footer).getByRole("button", { name: /Assign respondent:/ })
      );
      const people = await screen.findByRole("dialog", {
        name: "Assign respondent",
      });
      expect(
        within(people).getByRole("button", { name: /Member allowed/ })
      ).toBeVisible();
      for (const id of ["current", "disabled", "suspended", "inconsistent"]) {
        expect(
          within(people).queryByRole("button", {
            name: new RegExp(`Member ${id}`),
          })
        ).toBeNull();
      }
      fireEvent.click(
        within(people).getByRole("button", { name: /Member allowed/ })
      );
      await waitFor(() =>
        expect(
          screen.queryByRole("dialog", { name: "Assign respondent" })
        ).toBeNull()
      );
      fireEvent.click(
        within(footer).getByRole("button", { name: "Reference workpaper" })
      );
      const references = await screen.findByRole("dialog", {
        name: "Reference workpaper",
      });
      fireEvent.click(
        within(references).getByRole("checkbox", { name: /A-REF/ })
      );
      fireEvent.click(
        within(references).getByRole("button", { name: "Close" })
      );
      await waitFor(() =>
        expect(
          screen.queryByRole("dialog", { name: "Reference workpaper" })
        ).toBeNull()
      );
      if (authorizationRevoked) {
        rerender(
          panel(
            members.map((item) =>
              item.user.id === "allowed"
                ? { ...item, authorizationSuspendedAt: "2026-09-02T00:00:00Z" }
                : item
            )
          )
        );
      }
      expect(
        within(footer).getByRole("button", {
          name: `Assign respondent: ${authorizationRevoked ? "Unassigned" : "Member allowed"}`,
        })
      ).toBeVisible();
      enterReviewNoteContent(body);
      expect(createQuestion).not.toHaveBeenCalled();
      fireEvent.click(
        within(footer).getByRole("button", { name: "Add review note" })
      );
      await waitFor(() =>
        expect(createQuestion).toHaveBeenCalledExactlyOnceWith({
          body,
          assignedToId: authorizationRevoked ? undefined : "allowed",
          paperId: "working-paper-1",
          referencedWorkingPaperIds: ["paper-ref"],
        })
      );
    }
  );

  it("separates mobile Q selection from details and preserves drafts on back", async () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const question = makeCurrentReviewQuestion();
    render(
      <ToastProvider>
        <ReviewQuestionsPanel
          canReview
          currentUserId={question.createdById}
          members={[]}
          questions={[question]}
          workflow={[]}
          defaultPaperId={question.workingPaperId}
          autoOpen
          hideTrigger
          pending={false}
          createQuestion={vi.fn()}
          replyQuestion={vi.fn()}
          uploadQuestionImage={vi.fn()}
          attachInitialQuestionFiles={vi.fn()}
          downloadQuestionImage={vi.fn()}
          markRepliedQuestion={vi.fn()}
          clearQuestion={vi.fn()}
          followUpQuestion={vi.fn()}
          reopenQuestion={vi.fn()}
        />
      </ToastProvider>
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).queryByRole("textbox", { name: "Message" })
    ).toBeNull();
    let questionButton = within(dialog).getByRole("button", {
      name: /Current file needs support/,
    });
    const search = within(dialog).getByRole("searchbox", {
      name: "Search notes",
    });
    expect(within(dialog).queryByText("1 total", { exact: true })).toBeNull();
    expect(
      within(questionButton).getByText("Reviewer Current → Preparer Current")
    ).toBeVisible();
    fireEvent.change(search, { target: { value: "no matching note" } });
    expect(
      within(dialog).queryByRole("button", {
        name: /Current file needs support/,
      })
    ).toBeNull();
    expect(within(dialog).getByText("No matching notes")).toBeVisible();
    fireEvent.change(search, { target: { value: "needs support" } });
    expect(
      within(dialog).getByRole("button", { name: /Current file needs support/ })
    ).toBeVisible();
    for (const person of ["Reviewer Current", "Preparer Current"]) {
      fireEvent.change(search, { target: { value: person } });
      expect(
        within(dialog).getByRole("button", {
          name: /Current file needs support/,
        })
      ).toBeVisible();
    }
    fireEvent.click(within(dialog).getByRole("tab", { name: /Replied/ }));
    expect(
      within(dialog).queryByRole("button", {
        name: /Current file needs support/,
      })
    ).toBeNull();
    fireEvent.click(within(dialog).getByRole("tab", { name: /Open/ }));
    fireEvent.change(search, { target: { value: "" } });
    questionButton = within(dialog).getByRole("button", {
      name: /Current file needs support/,
    });
    const listScroll = dialog.querySelector("[data-notes-list-scroll]");
    if (!(listScroll instanceof HTMLElement)) {
      throw new Error("Missing Q list");
    }
    listScroll.scrollTop = 72;
    fireEvent.click(questionButton);
    expect(within(dialog).queryByRole("tablist")).toBeNull();
    const editor = await within(dialog).findByRole("textbox", {
      name: "Message",
    });
    expect(
      editor.closest('[data-slot="review-note-rich-text-composer"]')
    ).toHaveAttribute("data-toolbar-density", "compact");
    expect(
      within(dialog).getByRole("button", { name: "Send", exact: true })
    ).toBeVisible();
    expect(
      within(dialog).queryByRole("button", {
        name: "Mark replied",
        exact: true,
      })
    ).toBeNull();
    expect(
      within(dialog).queryByText("No more messages", { exact: true })
    ).toBeNull();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Note actions", exact: true })
    );
    const actions = await screen.findByRole("dialog", {
      name: "Note actions",
      exact: true,
    });
    expect(
      within(actions).getByRole("button", { name: "Mark replied", exact: true })
    ).toBeVisible();
    expect(
      within(actions).getByRole("button", { name: "Clear", exact: true })
    ).toBeVisible();
    fireEvent.click(
      within(actions).getByRole("button", { name: "Close", exact: true })
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Note actions", exact: true })
      ).toBeNull()
    );
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Add to message",
        exact: true,
      })
    );
    const tools = await screen.findByRole("dialog", {
      name: "Add to message",
      exact: true,
    });
    expect(
      within(tools).getByRole("button", {
        name: "Reference workpaper",
        exact: true,
      })
    ).toBeVisible();
    fireEvent.click(
      within(tools).getByRole("button", { name: "Close", exact: true })
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Add to message", exact: true })
      ).toBeNull()
    );
    fireEvent.paste(editor, {
      clipboardData: {
        files: [],
        items: [],
        types: ["text/plain"],
        getData: (type: string) =>
          type === "text/plain" ? "Keep my mobile draft" : "",
      },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Back" }));
    expect(within(dialog).getByRole("tablist")).toBeVisible();
    expect(listScroll.scrollTop).toBe(72);
    expect(questionButton).toHaveFocus();
    fireEvent.click(questionButton);
    await expect(
      within(dialog).findByRole("textbox", { name: "Message" })
    ).resolves.toHaveTextContent("Keep my mobile draft");
    fireEvent.click(within(dialog).getByRole("button", { name: "Back" }));
    fireEvent.click(
      within(dialog).getByRole("button", { name: "New review note" })
    );
    expect(screen.getByTestId("review-note-new-form")).toBeVisible();
    expect(
      screen
        .getByTestId("review-note-new-form")
        .querySelector('[data-slot="review-note-rich-text-composer"]')
    ).toHaveAttribute("data-toolbar-density", "compact");
    expect(within(dialog).queryByRole("tablist")).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Back" }));
    expect(within(dialog).getByRole("tablist")).toBeVisible();
  });

  it("keeps a reply row mounted through stale refreshes and server acknowledgement", async () => {
    const question = makeCurrentReviewQuestion();
    let finishReply: (value: WorkingPaperQuestion) => void = () => {};
    const reply = new Promise<WorkingPaperQuestion>((resolve) => {
      finishReply = resolve;
    });
    const props = {
      canReview: true,
      currentUserId: question.createdById,
      members: [],
      questions: [question],
      workflow: [],
      defaultPaperId: question.workingPaperId,
      autoOpen: true,
      hideTrigger: true,
      pending: false,
      createQuestion: vi.fn(),
      replyQuestion: vi.fn(() => reply),
      uploadQuestionImage: vi.fn(),
      attachInitialQuestionFiles: vi.fn(),
      downloadQuestionImage: vi.fn(),
      markRepliedQuestion: vi.fn(),
      clearQuestion: vi.fn(),
      followUpQuestion: vi.fn(),
      reopenQuestion: vi.fn(),
    };
    const { rerender } = render(
      <ToastProvider>
        <ReviewQuestionsPanel {...props} />
      </ToastProvider>
    );
    const editor = await screen.findByRole("textbox", { name: "Message" });
    fireEvent.paste(editor, {
      clipboardData: {
        files: [],
        items: [],
        types: ["text/plain"],
        getData: (type: string) =>
          type === "text/plain" ? "Stable reply" : "",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    const row = await screen.findByTestId("review-note-message");
    expect(row).toHaveTextContent("Stable reply");
    rerender(
      <ToastProvider>
        <ReviewQuestionsPanel
          {...props}
          questions={[{ ...question }]}
          pending
        />
      </ToastProvider>
    );
    expect(screen.getByTestId("review-note-message")).toBe(row);
    const updated = {
      ...question,
      updatedAt: "2026-09-07T12:00:00Z",
      messages: [
        ...(question.messages ?? []),
        {
          id: "confirmed-reply",
          questionId: question.id,
          authorId: question.createdById,
          messageType: "REPLY" as const,
          body: "Stable reply",
          createdAt: "2026-09-07T12:00:00Z",
          author: null,
        },
      ],
    };
    await act(async () => {
      finishReply(updated);
      await reply;
    });
    expect(screen.getByTestId("review-note-message")).toBe(row);
    rerender(
      <ToastProvider>
        <ReviewQuestionsPanel {...props} questions={[updated]} />
      </ToastProvider>
    );
    expect(screen.getAllByTestId("review-note-message")).toHaveLength(1);
    expect(screen.getByTestId("review-note-message")).toBe(row);
    props.replyQuestion.mockRejectedValueOnce(new Error("Reply unavailable"));
    fireEvent.paste(screen.getByRole("textbox", { name: "Message" }), {
      clipboardData: {
        files: [],
        items: [],
        types: ["text/plain"],
        getData: (type: string) =>
          type === "text/plain" ? "Keep this draft" : "",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Message" })
      ).toHaveTextContent("Keep this draft")
    );
    expect(screen.getAllByTestId("review-note-message")).toHaveLength(1);
    expect(screen.getByTestId("review-note-message")).toBe(row);
  });

  it("renders review note replies as one left-aligned activity timeline", async () => {
    const question = makeCurrentReviewQuestion({
      messages: [
        {
          id: "message-current-question",
          questionId: "question-current-paper",
          authorId: "reviewer-current",
          messageType: "QUESTION",
          body: "Current file needs support.",
          createdAt: "2026-06-01T11:00:00.000Z",
          author: {
            id: "reviewer-current",
            name: "Reviewer Current",
            email: "reviewer-current@projectwing.local",
          },
        },
        {
          id: "message-preparer-reply",
          questionId: "question-current-paper",
          authorId: "preparer-current",
          messageType: "REPLY",
          body: "I attached the missing evidence.",
          createdAt: "2026-06-01T11:30:00.000Z",
          author: {
            id: "preparer-current",
            name: "Preparer Current",
            email: "preparer-current@projectwing.local",
          },
        },
        {
          id: "message-reviewer-follow-up",
          questionId: "question-current-paper",
          authorId: "reviewer-current",
          messageType: "FOLLOW_UP",
          body: "Please also confirm the reporting date.",
          createdAt: "2026-06-01T11:45:00.000Z",
          author: {
            id: "reviewer-current",
            name: "Reviewer Current",
            email: "reviewer-current@projectwing.local",
          },
        },
      ],
    });
    renderCurrentReviewQuestion(question);

    await openPaperTool("Review notes");

    const messages = await screen.findAllByTestId("review-note-message");
    expect(messages).toHaveLength(2);
    expect(
      within(messages[0]).getByRole("img", { name: "Preparer Current" })
    ).toBeTruthy();
    expect(
      within(messages[1]).getByRole("img", { name: "Reviewer Current" })
    ).toBeTruthy();
  });

  it("shows a retry state when a review note image fails to load", async () => {
    const questionWithImage = {
      id: "question-current-paper",
      projectId: "project-1",
      workingPaperId: "working-paper-1",
      body: "Current file needs support.",
      status: "OPEN" as const,
      assignedToId: "preparer-current",
      createdById: "reviewer-current",
      createdAt: "2026-06-01T11:00:00.000Z",
      updatedAt: "2026-06-01T11:30:00.000Z",
      messages: [
        {
          id: "message-current-question",
          questionId: "question-current-paper",
          authorId: "reviewer-current",
          messageType: "QUESTION" as const,
          body: "Current file needs support.",
          createdAt: "2026-06-01T11:00:00.000Z",
          author: {
            id: "reviewer-current",
            name: "Reviewer Current",
            email: "reviewer-current@projectwing.local",
          },
          images: [
            {
              id: "image-1",
              messageId: "message-current-question",
              fileName: "evidence.png",
              originalName: "evidence.png",
              objectKey:
                "review-question-images/project-1/question-current-paper/evidence.png",
              fileSize: 7,
              mimeType: "image/png",
              createdAt: "2026-06-01T11:00:00.000Z",
            },
          ],
        },
      ],
    };
    vi.spyOn(api, "workingPaper").mockResolvedValue({
      ...workingPaperNode,
      reviewQuestions: [questionWithImage],
    });
    const downloadImage = vi
      .spyOn(api, "downloadReviewQuestionImage")
      .mockRejectedValueOnce(new Error("Image request failed"));
    const createObjectURL = vi.fn(() => "blob:review-question-image");
    stubObjectUrl(createObjectURL, vi.fn());

    renderContent({
      currentUserId: "preparer-current",
      currentProjectRole: "PREPARER",
      selectedNode: {
        ...thirdLevelNodeWithFile,
        workingPapers: [
          {
            ...workingPaperNode,
            reviewQuestions: [questionWithImage],
          },
        ],
      },
      selectedPaperId: "working-paper-1",
    });

    await openPaperTool("Review notes");
    await expect(screen.findByText("Image unavailable")).resolves.toBeTruthy();

    downloadImage.mockResolvedValueOnce(
      new Blob(["preview"], { type: "image/png" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await expect(
      screen.findByRole("img", { name: "evidence.png" })
    ).resolves.toHaveAttribute("src", "blob:review-question-image");
    expect(downloadImage).toHaveBeenCalledTimes(2);
  });

  it("sends image-only review note messages as message images", async () => {
    const openQuestion = {
      id: "question-current-paper",
      projectId: "project-1",
      workingPaperId: "working-paper-1",
      body: "Current file needs support.",
      status: "OPEN" as const,
      assignedToId: "preparer-current",
      createdById: "reviewer-current",
      createdAt: "2026-06-01T11:00:00.000Z",
      updatedAt: "2026-06-01T11:00:00.000Z",
      assignedTo: {
        id: "preparer-current",
        name: "Preparer Current",
        email: "preparer-current@projectwing.local",
      },
      createdBy: {
        id: "reviewer-current",
        name: "Reviewer Current",
        email: "reviewer-current@projectwing.local",
      },
      messages: [
        {
          id: "message-current-question",
          questionId: "question-current-paper",
          authorId: "reviewer-current",
          messageType: "QUESTION" as const,
          body: "Current file needs support.",
          createdAt: "2026-06-01T11:00:00.000Z",
          author: {
            id: "reviewer-current",
            name: "Reviewer Current",
            email: "reviewer-current@projectwing.local",
          },
        },
      ],
    };
    vi.spyOn(api, "workingPaper").mockResolvedValue({
      ...workingPaperNode,
      reviewQuestions: [openQuestion],
    });
    const uploadedImage = {
      objectKey:
        "review-question-images/project-1/question-current-paper/screenshot.png",
      fileName: "screenshot.png",
      fileSize: 7,
      mimeType: "image/png",
    };
    const uploadImage = vi
      .spyOn(api, "uploadReviewQuestionImage")
      .mockResolvedValue(uploadedImage);
    vi.spyOn(api, "downloadReviewQuestionImage").mockResolvedValue(
      new Blob(["preview"], { type: "image/png" })
    );
    const replyQuestion = vi
      .spyOn(api, "replyWorkingPaperQuestion")
      .mockResolvedValue({
        ...openQuestion,
        messages: [
          ...openQuestion.messages,
          {
            id: "message-image-only",
            questionId: "question-current-paper",
            authorId: "preparer-current",
            messageType: "REPLY" as const,
            body: "",
            createdAt: "2026-06-01T11:30:00.000Z",
            author: {
              id: "preparer-current",
              name: "Preparer Current",
              email: "preparer-current@projectwing.local",
            },
            images: [
              {
                id: "image-1",
                messageId: "message-image-only",
                fileName: "screenshot.png",
                originalName: "screenshot.png",
                objectKey: uploadedImage.objectKey,
                fileSize: uploadedImage.fileSize,
                mimeType: uploadedImage.mimeType,
                createdAt: "2026-06-01T11:30:00.000Z",
              },
            ],
          },
        ],
      });
    const createObjectURL = vi.fn(() => "blob:review-question-image-preview");
    const revokeObjectURL = vi.fn();
    stubObjectUrl(createObjectURL, revokeObjectURL);

    renderContent({
      currentUserId: "preparer-current",
      currentProjectRole: "PREPARER",
      selectedNode: {
        ...thirdLevelNodeWithFile,
        workingPapers: [
          {
            ...workingPaperNode,
            reviewQuestions: [openQuestion],
          },
        ],
      },
      selectedPaperId: "working-paper-1",
    });

    await openPaperTool("Review notes");
    const image = new File(["preview"], "screenshot.png", {
      type: "image/png",
    });
    const attachInput = screen
      .getAllByLabelText("Attach file")
      .find(
        (element): element is HTMLInputElement =>
          element instanceof HTMLInputElement
      );
    fireEvent.change(requireElement(attachInput), {
      target: { files: [image] },
    });
    await expect(screen.findByText("screenshot.png")).resolves.toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(uploadImage).toHaveBeenCalledWith(
        "project-1",
        "question-current-paper",
        image
      );
      expect(replyQuestion).toHaveBeenCalledWith(
        "project-1",
        "question-current-paper",
        {
          replyBody: "",
          images: [uploadedImage],
        }
      );
    });
  });

  it("attaches pasted screenshots to review note messages", async () => {
    const openQuestion = {
      id: "question-current-paper",
      projectId: "project-1",
      workingPaperId: "working-paper-1",
      body: "Current file needs support.",
      status: "OPEN" as const,
      assignedToId: "preparer-current",
      createdById: "reviewer-current",
      createdAt: "2026-06-01T11:00:00.000Z",
      updatedAt: "2026-06-01T11:00:00.000Z",
      assignedTo: {
        id: "preparer-current",
        name: "Preparer Current",
        email: "preparer-current@projectwing.local",
      },
      createdBy: {
        id: "reviewer-current",
        name: "Reviewer Current",
        email: "reviewer-current@projectwing.local",
      },
      messages: [
        {
          id: "message-current-question",
          questionId: "question-current-paper",
          authorId: "reviewer-current",
          messageType: "QUESTION" as const,
          body: "Current file needs support.",
          createdAt: "2026-06-01T11:00:00.000Z",
          author: {
            id: "reviewer-current",
            name: "Reviewer Current",
            email: "reviewer-current@projectwing.local",
          },
        },
      ],
    };
    vi.spyOn(api, "workingPaper").mockResolvedValue({
      ...workingPaperNode,
      reviewQuestions: [openQuestion],
    });
    const uploadedImage = {
      objectKey:
        "review-question-images/project-1/question-current-paper/pasted.png",
      fileName: "pasted.png",
      fileSize: 7,
      mimeType: "image/png",
    };
    const uploadImage = vi
      .spyOn(api, "uploadReviewQuestionImage")
      .mockResolvedValue(uploadedImage);
    vi.spyOn(api, "downloadReviewQuestionImage").mockResolvedValue(
      new Blob(["preview"], { type: "image/png" })
    );
    const replyQuestion = vi
      .spyOn(api, "replyWorkingPaperQuestion")
      .mockResolvedValue({
        ...openQuestion,
        messages: openQuestion.messages,
      });
    const createObjectURL = vi.fn(() => "blob:pasted-screenshot-preview");
    const revokeObjectURL = vi.fn();
    stubObjectUrl(createObjectURL, revokeObjectURL);

    renderContent({
      currentUserId: "preparer-current",
      currentProjectRole: "PREPARER",
      selectedNode: {
        ...thirdLevelNodeWithFile,
        workingPapers: [
          {
            ...workingPaperNode,
            reviewQuestions: [openQuestion],
          },
        ],
      },
      selectedPaperId: "working-paper-1",
    });

    await openPaperTool("Review notes");
    const pastedImage = new File(["preview"], "image.png", {
      type: "image/png",
    });
    fireEvent.paste(await screen.findByLabelText("Message"), {
      clipboardData: {
        getData: (type: string) => (type === "text/plain" ? "" : ""),
        items: [
          {
            kind: "file",
            type: "image/png",
            getAsFile: () => pastedImage,
          },
        ],
        files: [],
      },
    });
    await expect(
      screen.findByText(/pasted-screenshot-.*\.png/)
    ).resolves.toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(uploadImage).toHaveBeenCalledWith(
        "project-1",
        "question-current-paper",
        expect.objectContaining({
          name: expect.stringMatching(/^pasted-screenshot-.*\.png$/),
          type: "image/png",
        })
      );
      expect(replyQuestion).toHaveBeenCalledWith(
        "project-1",
        "question-current-paper",
        {
          replyBody: "",
          images: [uploadedImage],
        }
      );
    });
  });

  it("leaves text-only paste in review note messages to the textarea", async () => {
    const openQuestion = makeCurrentReviewQuestion();
    renderCurrentReviewQuestion(openQuestion);

    await openPaperTool("Review notes");
    const messageBox = await screen.findByLabelText("Message");
    const pasteEvent = createEvent.paste(messageBox);
    Object.defineProperty(pasteEvent, "clipboardData", {
      configurable: true,
      value: {
        getData: (type: string) => (type === "text/plain" ? "plain text" : ""),
        items: [
          {
            kind: "string",
            type: "text/plain",
            getAsFile: () => null,
          },
        ],
        files: [],
        types: ["text/plain"],
      },
    });
    fireEvent(messageBox, pasteEvent);

    expect(messageBox).toHaveTextContent("plain text");
    expect(screen.queryByText(/pasted-screenshot-.*\.png/)).toBeNull();
  });

  it("ignores pasted images for cleared review note reopen messages", async () => {
    const clearedQuestion = makeCurrentReviewQuestion({
      status: "CLEARED",
    });
    renderCurrentReviewQuestion(clearedQuestion);

    await openPaperTool("Review notes");
    const image = new File(["preview"], "clipboard.png", {
      type: "image/png",
    });
    const messageBox = await screen.findByLabelText("Message");
    const pasteEvent = createEvent.paste(messageBox);
    Object.defineProperty(pasteEvent, "clipboardData", {
      configurable: true,
      value: {
        getData: () => "",
        items: [
          {
            kind: "file",
            type: "image/png",
            getAsFile: () => image,
          },
        ],
        files: [image],
        types: ["Files"],
      },
    });
    fireEvent(messageBox, pasteEvent);

    expect(screen.queryByText(/pasted-screenshot-.*\.png/)).toBeNull();
  });

  it("shows both signoff actions to reviewers on prepared files", async () => {
    vi.spyOn(api, "workingPaper").mockResolvedValue(preparedWorkingPaperNode);

    renderContent({
      currentProjectRole: "REVIEWER",
      selectedNode: thirdLevelNodeWithPreparedFile,
      selectedPaperId: "working-paper-prepared",
    });

    await openPaperTool("Signoff and review");
    expect(
      screen.getByRole("button", { name: "Reviewed signoff" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Prepared signoff" })
    ).toBeTruthy();
    await openPaperTool("Review notes");
    await expect(screen.findByText("Add review note")).resolves.toBeTruthy();
  });

  async function openPaperTool(label: string) {
    fireEvent.click(
      await screen.findByRole("button", { name: "Open file tools" })
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: label }));
  }

  async function openProjectFileContextMenu(fileName: RegExp | string) {
    const fileCellElement = await screen.findByText(fileName);
    const fileCell = fileCellElement.closest("td");
    expect(fileCell).toBeTruthy();
    const fileRow = fileCell?.closest("tr");
    expect(fileRow).toBeTruthy();
    fireEvent.contextMenu(fileRow as HTMLTableRowElement, {
      clientX: 240,
      clientY: 320,
    });
  }
});
