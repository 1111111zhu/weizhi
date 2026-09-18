import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
// @vitest-environment jsdom
import { createElement, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkflowNode } from "../api/client";
import {
  WorkbenchDirectory,
  WorkbenchProjectSearch,
} from "./workbench-directory";
import type { WorkbenchDirectoryCopy } from "./workbench-directory";
import {
  InlineCreateNodeRow,
  getDirectoryDisplayNode,
} from "./workbench-directory-row";

import rowStyles from "./workbench-directory-row.module.css";

function requireValue<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected test fixture value to be present");
  }
  return value;
}

function requireElement<T extends Element>(element: T | null | undefined): T {
  return requireValue(element);
}

const zhWorkbenchCopy: WorkbenchDirectoryCopy = {
  searchLabel: "搜索目录或文件",
  loadingStructureTitle: "正在加载项目结构",
  loadingStructureDescription: "请稍候。",
  noMatchesTitle: "没有匹配的组或底稿",
  noMatchesDescription: "换一个关键字再试。",
  searchResultsLabel: "搜索结果",
  searchNoResults: "没有匹配结果",
  searchDirectoryKind: "目录",
  searchFileKind: "文件",
  emptyStructureTitle: "项目结构为空",
  emptyStructureDescription: "项目创建后会自动生成默认组和底稿。",
  temporaryFilesEmptyTitle: "暂无临时文件",
  temporaryFilesEmptyDescription:
    "切回年审年度查看主文件树，或在底稿下上传临时文件。",
  group: "组",
  workpaper: "底稿",
  renameGroup: "重命名组",
  renameWorkpaper: "重命名底稿",
  referenceCode: "参考编号",
  directoryName: "目录名称",
  addGroup: "新增组",
  addWorkpaper: "新增底稿",
  newPhase: "新建阶段",
  deleteGroup: "删除组",
  deleteWorkpaper: "删除底稿",
  uploadFileTo: "上传文件到",
  uploadToBucket: "上传到",
  fileInput: "文件选择",
  otherMember: "其他成员",
  locked: "锁定中",
  newGroup: "新组",
  newWorkpaper: "新底稿",
  bucketLabels: {
    CURRENT: "当前底稿",
    PRIOR: "前期底稿",
    TEMPORARY: "临时资料",
  },
};
const enWorkbenchCopy: WorkbenchDirectoryCopy = {
  searchLabel: "Search directories or files",
  loadingStructureTitle: "Loading project structure",
  loadingStructureDescription: "Please wait.",
  noMatchesTitle: "No matching groups or workpapers",
  noMatchesDescription: "Try another keyword.",
  searchResultsLabel: "Search results",
  searchNoResults: "No search results",
  searchDirectoryKind: "Directory",
  searchFileKind: "File",
  emptyStructureTitle: "Project structure is empty",
  emptyStructureDescription:
    "Default groups and workpapers are generated automatically after project creation.",
  temporaryFilesEmptyTitle: "No temporary files",
  temporaryFilesEmptyDescription:
    "Switch back to the audit year to view the main file tree, or upload temporary files from a workpaper.",
  phase: "Phase",
  group: "Group",
  workpaper: "Workpaper",
  renamePhase: "Rename phase",
  renameGroup: "Rename group",
  renameWorkpaper: "Rename workpaper",
  referenceCode: "Reference code",
  directoryName: "Directory name",
  addPhase: "Add phase",
  addGroup: "Add group",
  addWorkpaper: "Add workpaper",
  deletePhase: "Delete phase",
  deleteGroup: "Delete group",
  deleteWorkpaper: "Delete workpaper",
  uploadFileTo: "Upload file to",
  uploadToBucket: "Upload to ",
  fileInput: "file input",
  otherMember: "another member",
  locked: "Locked",
  newPhase: "New phase",
  newGroup: "New group",
  newWorkpaper: "New workpaper",
  fileBucketFilterLabel: "File bucket filter",
  fileBucketFilterTitle: "Visible files",
  bucketLabels: {
    CURRENT: "Current workpapers",
    PRIOR: "Prior workpapers",
    TEMPORARY: "Temporary files",
  },
  bucketShortLabels: {
    CURRENT: "Current",
    PRIOR: "Prior",
    TEMPORARY: "Temp",
  },
};
const workflow: WorkflowNode[] = [
  {
    id: "phase-1",
    code: "A",
    title: "计划阶段",
    level: 1,
    nodeType: "PHASE",
    workingPapers: [],
    children: [
      {
        id: "subject-1",
        parentId: "phase-1",
        code: "A01",
        title: "现金与银行",
        level: 2,
        nodeType: "FOLDER",
        workingPapers: [],
        children: [
          {
            id: "paper-1",
            parentId: "subject-1",
            code: "A01-0001",
            title: "银行存款",
            level: 3,
            nodeType: "PAPER",
            workingPapers: [
              {
                id: "working-paper-1",
                projectId: "project-1",
                workflowNodeId: "paper-1",
                code: "A01-0001-F001",
                title: "银行函证控制表.xlsx",
                paperType: "WORKING_PAPER",
                attachments: [
                  {
                    id: "attachment-1",
                    workingPaperId: "working-paper-1",
                    fileKind: "SPREADSHEET",
                    fileName: "stored-4.xlsx",
                    originalName: "银行函证控制表.xlsx",
                    fileUrl: "working-papers/project-1/stored.xlsx",
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
        ],
      },
    ],
  },
];
const workflowPhase = requireValue(workflow[0]);
const workflowSubject = requireValue(workflowPhase.children?.[0]);
const workflowPaperFolder = requireValue(workflowSubject.children?.[0]);
const workflowPaper = requireValue(workflowPaperFolder.workingPapers[0]);
const workflowAttachment = requireValue(workflowPaper.attachments?.[0]);
const lockedWorkflow: WorkflowNode[] = [
  {
    ...workflowPhase,
    children: [
      {
        ...workflowSubject,
        children: [
          {
            ...workflowPaperFolder,
            workingPapers: [
              {
                ...workflowPaper,
                attachments: [
                  {
                    ...workflowAttachment,
                    lockedBy: "user-reviewer",
                    lockedAt: "2026-06-02T02:16:00.000Z",
                    lockHolder: {
                      id: "user-reviewer",
                      name: "李四",
                      email: "reviewer@projectwing.local",
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

describe("lint test setup", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe(WorkbenchDirectory, () => {
    it("renders the panel collapse rail when the workspace enables it", () => {
      const onPanelToggle = vi.fn();
      renderDirectory({
        onPanelToggle,
        panelToggleLabel: "Hide directory",
      });

      const rail = screen.getByTestId("directory-panel-rail");
      expect(screen.getByTestId("directory-panel-waterdrop")).toBeVisible();
      expect(rail).toHaveAccessibleName("Hide directory");
      expect(rail).toHaveClass("right-0");
      expect(rail).not.toHaveClass("translate-x-full");
      expect(rail.closest('[data-slot="sidebar"]')).toHaveClass(
        "min-w-0",
        "overflow-hidden"
      );
      expect(rail.closest('[data-slot="sidebar-wrapper"]')).toHaveClass(
        "min-w-0",
        "overflow-hidden"
      );
      fireEvent.click(rail);
      expect(onPanelToggle).toHaveBeenCalledOnce();
    });

    it("marks the selected node with the official tree active state", () => {
      const { container } = renderDirectory({ selectedNodeId: "subject-1" });
      const selectedButton = getNodeButton("subject-1");
      const selectedTreeItem = selectedButton.closest('[role="treeitem"]');
      const _tree = container.querySelector('[data-slot="tree"]');

      expect(selectedTreeItem).toHaveClass(
        "relative",
        "z-10",
        "before:w-(--tree-padding)"
      );
      expect(selectedButton).toHaveClass(rowStyles.flatRow);
    });

    it("keeps a code-only root directory name unchanged", () => {
      renderDirectory({
        workflow: [
          {
            ...workflowPhase,
            code: "Planning",
            title: "Planning",
            children: [
              {
                ...workflowSubject,
                code: "A1",
                title: "A1",
                children: [],
              },
            ],
          },
        ],
      });

      fireEvent.click(screen.getByRole("treeitem", { name: "Planning" }));

      expect(
        screen.getByRole("treeitem", {
          name: "A1",
        })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", {
          name: "A1 - Client acceptance or continuance",
        })
      ).toBeNull();
    });

    it("renders stored top-level directory codes with their titles", () => {
      renderDirectory({
        copy: enWorkbenchCopy,
        workflow: [
          {
            ...workflowPhase,
            code: "Planning",
            title: "Planning",
            children: [],
          },
          {
            ...workflowPhase,
            id: "phase-2",
            code: "Execution",
            title: "Execution",
            children: [],
          },
        ],
      });

      expect(
        screen.getByRole("treeitem", { name: "Planning" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("treeitem", { name: "Execution" })
      ).toBeInTheDocument();
    });

    it("renders template sibling codes without duplicating skipped digit four", () => {
      renderDirectory({
        copy: enWorkbenchCopy,
        workflow: [
          {
            id: "phase-planning",
            code: "Planning",
            title: "Planning",
            level: 1,
            nodeType: "PHASE",
            workingPapers: [],
            children: [
              {
                id: "node-a1",
                parentId: "phase-planning",
                code: "A1",
                title: "Client acceptance or continuance",
                level: 2,
                nodeType: "ACCOUNT",
                workingPapers: [],
                children: [],
              },
              {
                id: "node-a2",
                parentId: "phase-planning",
                code: "A2",
                title: "Engagement letter",
                level: 2,
                nodeType: "ACCOUNT",
                workingPapers: [],
                children: [],
              },
              {
                id: "node-a3",
                parentId: "phase-planning",
                code: "A3",
                title: "Understanding the entity and its environment",
                level: 2,
                nodeType: "ACCOUNT",
                workingPapers: [],
                children: [],
              },
              {
                id: "node-a5",
                parentId: "phase-planning",
                code: "A5",
                title: "Planning materiality",
                level: 2,
                nodeType: "ACCOUNT",
                workingPapers: [],
                children: [],
              },
              {
                id: "node-a6",
                parentId: "phase-planning",
                code: "A6",
                title: "Audit planning programme",
                level: 2,
                nodeType: "ACCOUNT",
                workingPapers: [],
                children: [],
              },
              {
                id: "node-a7",
                parentId: "phase-planning",
                code: "A7",
                title: "Understand the business cycles",
                level: 2,
                nodeType: "ACCOUNT",
                workingPapers: [],
                children: [],
              },
            ],
          },
        ],
      });

      fireEvent.click(screen.getByRole("treeitem", { name: "Planning" }));

      expect(
        screen.getByRole("treeitem", { name: "A5 - Planning materiality" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("treeitem", { name: "A6 - Audit planning programme" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("treeitem", {
          name: "A7 - Understand the business cycles",
        })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "A5 - Audit planning programme" })
      ).toBeNull();
    });

    it("calls selection handler when a child node is clicked", () => {
      const setSelectedNodeId = vi.fn();
      renderDirectory({ setSelectedNodeId });

      fireEvent.click(getNodeButton("phase-1"));
      fireEvent.click(getNodeButton("subject-1"));

      expect(setSelectedNodeId).toHaveBeenCalledWith("subject-1");
    });

    it("keeps modified clicks on directory rows as normal tree clicks", async () => {
      const setSelectedNodeId = vi.fn();
      renderDirectory({ setSelectedNodeId });

      const phaseButton = getNodeButton("phase-1");
      fireEvent.click(phaseButton, { ctrlKey: true });

      expect(setSelectedNodeId).toHaveBeenCalledWith("phase-1");
      await waitFor(() =>
        expect(phaseButton.closest('[role="treeitem"]')).toHaveAttribute(
          "aria-expanded",
          "true"
        )
      );
    });

    it("uses official tree labels for directory and file rows", () => {
      renderDirectory({ showFiles: true });

      fireEvent.click(getNodeButton("phase-1"));
      fireEvent.click(getNodeButton("subject-1"));
      fireEvent.click(getNodeButton("paper-1"));

      const nodeLabel = getNodeButton("paper-1");
      const fileLabel = getPaperButton("working-paper-1");

      expect(nodeLabel).toHaveAttribute("data-slot", "tree-item-label");
      expect(fileLabel).toHaveAttribute("data-slot", "tree-item-label");
      expect(nodeLabel).toHaveClass(
        "w-full",
        "min-w-0",
        "bg-transparent",
        "hover:bg-transparent",
        "before:bg-workbench-sidebar"
      );
      expect(fileLabel).toHaveClass(
        "w-full",
        "min-w-0",
        "bg-transparent",
        "hover:bg-transparent",
        "before:bg-workbench-sidebar"
      );
      expect(nodeLabel).toHaveTextContent("A01 - 0001");
      expect(nodeLabel).toHaveTextContent("银行存款");
      expect(fileLabel.querySelector(".truncate")).toHaveTextContent(
        "银行函证控制表.xlsx"
      );
      expect(
        nodeLabel.closest('[data-slot="context-menu-trigger"]')
      ).toHaveClass("flex", "w-full", "min-w-0");
      expect(
        fileLabel.closest('[data-slot="context-menu-trigger"]')
      ).toHaveClass("flex", "w-full", "min-w-0");
    });

    it("collapses directory children by default", () => {
      const { container } = renderDirectory();

      expect(getNodeButton("phase-1")).toBeTruthy();
      expect(container.querySelector('[role="tree"]')).toBeTruthy();
      expect(getNodeButton("phase-1")).toHaveAttribute(
        "aria-expanded",
        "false"
      );
      expect(queryNodeButton("subject-1")).toBeNull();
    });

    it("restores pointer interaction when directory children expand", () => {
      const { container: _container } = renderDirectory();

      fireEvent.click(getNodeButton("phase-1"));

      expect(getNodeButton("phase-1")).toHaveAttribute("aria-expanded", "true");
      expect(getNodeButton("subject-1")).toBeTruthy();
    });

    it("lets a selected parent directory collapse with files visible", async () => {
      function DirectoryHarness() {
        const [selectedNodeId, setSelectedNodeId] = useState("subject-1");
        const [addNodeTarget, setAddNodeTarget] = useState<WorkflowNode | null>(
          null
        );

        return createElement(WorkbenchDirectory, {
          workflow,
          copy: zhWorkbenchCopy,
          selectedNodeId,
          addNodeTarget,
          setSelectedNodeId,
          openAddNode: setAddNodeTarget,
          closeAddNode: () => setAddNodeTarget(null),
          createNode: vi.fn(),
          createNodePending: false,
          deleteNode: vi.fn(),
          showFiles: true,
        });
      }

      render(createElement(DirectoryHarness));

      const phaseButton = getNodeButton("phase-1");
      await waitFor(() =>
        expect(phaseButton).toHaveAttribute("aria-expanded", "true")
      );

      fireEvent.click(phaseButton);

      await waitFor(() =>
        expect(phaseButton).toHaveAttribute("aria-expanded", "false")
      );
    });

    it("keeps files out of the collapsed directory tree", () => {
      const onSelectPaper = vi.fn();
      renderDirectory({ onSelectPaper });

      fireEvent.click(getNodeButton("phase-1"));
      fireEvent.click(getNodeButton("subject-1"));
      fireEvent.click(getNodeButton("paper-1"));

      expect(screen.queryByText("银行函证控制表.xlsx")).toBeNull();
      expect(screen.queryByText("DRAFT")).toBeNull();
      expect(screen.queryByText("v1")).toBeNull();
      expect(onSelectPaper).not.toHaveBeenCalled();
    });

    it("shows files in the directory tree when file rows are enabled", () => {
      const onSelectPaper = vi.fn();
      renderDirectory({ onSelectPaper, showFiles: true });

      fireEvent.click(getNodeButton("phase-1"));
      fireEvent.click(getNodeButton("subject-1"));
      fireEvent.click(getNodeButton("paper-1"));

      const fileButton = screen.getByRole("treeitem", {
        name: /银行函证控制表\.xlsx/,
      });
      expect(fileButton).toBeTruthy();

      fireEvent.click(fileButton);

      expect(onSelectPaper).toHaveBeenCalledWith("working-paper-1", "paper-1");
    });

    it("pastes a copied file from the target directory context menu", () => {
      const onCopyFileToNode = vi.fn();
      renderDirectory({
        copy: enWorkbenchCopy,
        showFiles: true,
        workflow: buildBucketWorkflow(),
        onCopyFileToNode,
      });

      fireEvent.click(getNodeButton("bucket-phase"));
      const bucketFolder = getNodeButton("bucket-folder");
      fireEvent.click(bucketFolder);
      fireEvent.contextMenu(getPaperButton("current-paper"));
      fireEvent.click(screen.getByRole("menuitem", { name: "Copy" }));

      fireEvent.contextMenu(bucketFolder);
      fireEvent.click(screen.getByRole("menuitem", { name: "Paste" }));

      expect(onCopyFileToNode).toHaveBeenCalledWith(
        {
          attachmentId: "current-paper-attachment",
          bucket: "CURRENT",
          fileName: "current.xlsx",
          nodeId: "bucket-folder",
          paperId: "current-paper",
        },
        expect.objectContaining({ id: "bucket-folder" }),
        expect.arrayContaining([
          expect.objectContaining({
            attachmentId: "current-paper-attachment",
            paperId: "current-paper",
          }),
        ])
      );
    });

    it("pastes a copied file from a populated target directory file row menu", () => {
      const onCopyFileToNode = vi.fn();
      renderDirectory({
        copy: enWorkbenchCopy,
        showFiles: true,
        workflow: buildBucketWorkflow(),
        onCopyFileToNode,
      });

      fireEvent.click(getNodeButton("bucket-phase"));
      const bucketFolder = getNodeButton("bucket-folder");
      fireEvent.click(bucketFolder);
      fireEvent.contextMenu(getPaperButton("current-paper"));
      fireEvent.click(screen.getByRole("menuitem", { name: "Copy" }));

      fireEvent.contextMenu(getPaperButton("current-paper"));
      fireEvent.click(screen.getByRole("menuitem", { name: "Paste" }));

      expect(onCopyFileToNode).toHaveBeenCalledWith(
        {
          attachmentId: "current-paper-attachment",
          bucket: "CURRENT",
          fileName: "current.xlsx",
          nodeId: "bucket-folder",
          paperId: "current-paper",
        },
        expect.objectContaining({ id: "bucket-folder" }),
        expect.arrayContaining([
          expect.objectContaining({
            attachmentId: "current-paper-attachment",
            paperId: "current-paper",
          }),
        ])
      );
    });

    it("shows a disabled paste item in the target directory context menu without a clipboard file", () => {
      renderDirectory({
        copy: enWorkbenchCopy,
        showFiles: true,
        workflow: buildBucketWorkflow(),
        onCopyFileToNode: vi.fn(),
      });

      fireEvent.click(getNodeButton("bucket-phase"));
      const bucketFolder = getNodeButton("bucket-folder");

      fireEvent.contextMenu(bucketFolder);

      expect(screen.getByRole("menuitem", { name: "Paste" })).toHaveAttribute(
        "aria-disabled",
        "true"
      );
    });

    it("highlights the target directory while its context menu is open", async () => {
      renderDirectory({
        copy: enWorkbenchCopy,
        showFiles: true,
        workflow: buildBucketWorkflow(),
        onCopyFileToNode: vi.fn(),
      });

      fireEvent.click(getNodeButton("bucket-phase"));
      const bucketFolder = getNodeButton("bucket-folder");

      fireEvent.contextMenu(bucketFolder);

      await waitFor(() =>
        expect(bucketFolder).toHaveAttribute("data-active", "true")
      );
      expect(bucketFolder).toHaveClass(rowStyles.flatRow);
    });

    it("keeps the target directory context menu open after the opening event settles", async () => {
      renderDirectory({
        copy: enWorkbenchCopy,
        showFiles: true,
        workflow: buildBucketWorkflow(),
        onCopyFileToNode: vi.fn(),
      });

      fireEvent.click(getNodeButton("bucket-phase"));
      const bucketFolder = getNodeButton("bucket-folder");

      fireEvent.contextMenu(bucketFolder);
      await new Promise((resolve) => {
        window.setTimeout(resolve, 0);
      });

      expect(screen.getByRole("menuitem", { name: "Paste" })).toHaveAttribute(
        "aria-disabled",
        "true"
      );
    });

    it("offers nested creation from a second-level directory", () => {
      renderDirectory();

      fireEvent.click(getNodeButton("phase-1"));
      fireEvent.contextMenu(getNodeButton("subject-1"));

      expect(
        screen.getByRole("menuitem", { name: "\u65B0\u589E\u7EC4" })
      ).toBeTruthy();
    });

    it("filters expanded tree files to current workpapers by default", () => {
      renderDirectory({
        copy: enWorkbenchCopy,
        showFiles: true,
        workflow: buildBucketWorkflow(),
      });

      fireEvent.click(getNodeButton("bucket-phase"));
      fireEvent.click(getNodeButton("bucket-folder"));

      expect(getPaperButton("current-paper")).toBeTruthy();
      expect(queryPaperButton("prior-paper")).toBeNull();
      expect(queryPaperButton("temporary-paper")).toBeNull();
    });

    it("switches prior files in the tree and temporary files outside the main tree", () => {
      renderDirectory({
        copy: enWorkbenchCopy,
        showFiles: true,
        visibleFileBucket: "PRIOR",
        workflow: buildBucketWorkflow(),
      });

      fireEvent.click(getNodeButton("bucket-phase"));
      fireEvent.click(getNodeButton("bucket-folder"));

      expect(queryPaperButton("current-paper")).toBeNull();
      expect(getPaperButton("prior-paper")).toBeTruthy();
      expect(queryPaperButton("temporary-paper")).toBeNull();

      cleanup();
      renderDirectory({
        copy: enWorkbenchCopy,
        showFiles: true,
        visibleFileBucket: "TEMPORARY",
        workflow: buildBucketWorkflow(),
      });

      expect(
        screen.queryByRole("treeitem", { name: /Bucket phase/ })
      ).toBeNull();
      expect(queryNodeButton("bucket-folder")).toBeNull();
      expect(queryPaperButton("current-paper")).toBeNull();
      expect(queryPaperButton("prior-paper")).toBeNull();
      expect(
        screen.getByRole("button", { name: /temporary\.xlsx/ })
      ).toBeTruthy();
      expect(screen.getByText("Temporary files")).toBeTruthy();
      expect(
        screen.queryByText("Temporary files / Bucket phase / Bucket folder")
      ).toBeNull();
    });

    it("shows a dedicated empty state for temporary files", () => {
      renderDirectory({
        copy: enWorkbenchCopy,
        showFiles: true,
        visibleFileBucket: "TEMPORARY",
        workflow,
      });

      expect(queryNodeButton("phase-1")).toBeNull();
      expect(screen.getByText("No temporary files")).toBeTruthy();
    });

    it("shows a folder's direct files before its child folders when expanded", () => {
      const workflowWithMixedFolder: WorkflowNode[] = [
        {
          ...workflowPhase,
          children: [
            {
              ...workflowSubject,
              workingPapers: [
                {
                  ...workflowPaper,
                  id: "working-paper-direct",
                  workflowNodeId: "subject-1",
                  title: "A01 direct file.xlsx",
                  attachments: [
                    {
                      ...workflowAttachment,
                      id: "attachment-direct",
                      originalName: "A01 direct file.xlsx",
                    },
                  ],
                },
              ],
              children: [workflowPaperFolder],
            },
          ],
        },
      ];
      renderDirectory({
        showFiles: true,
        workflow: workflowWithMixedFolder,
      });

      fireEvent.click(getNodeButton("phase-1"));
      fireEvent.click(getNodeButton("subject-1"));

      const directFile = getPaperButton("working-paper-direct");
      const childFolder = getNodeButton("paper-1");

      expect(
        directFile.compareDocumentPosition(childFolder) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });

    it("keeps locked files and lock details out of the left tree", () => {
      renderDirectory({ workflow: lockedWorkflow, onSelectPaper: vi.fn() });

      fireEvent.click(getNodeButton("phase-1"));
      fireEvent.click(getNodeButton("subject-1"));
      fireEvent.click(getNodeButton("paper-1"));

      expect(screen.queryByText("银行函证控制表.xlsx")).toBeNull();
      expect(screen.queryByText("锁定中")).toBeNull();
      expect(screen.queryByTitle("李四 锁定中")).toBeNull();
    });

    it("shows directories and files in one search dropdown", () => {
      const onSelectPaper = vi.fn();
      const onLocatePaper = vi.fn();
      const onSearchChange = vi.fn();
      const setSelectedNodeId = vi.fn();
      const { container } = renderProjectSearch({
        searchValue: "银行",
        onSearchChange,
        onSelectPaper,
        onLocatePaper,
        setSelectedNodeId,
      });
      const menu = screen.getByRole("listbox");
      expect(
        container.querySelector(".project-wing-top-bar-search")
      ).toHaveAttribute("data-top-bar-search", "");
      const directoryText = within(menu).getByText("A01 - 现金与银行");
      const _fileText = within(menu).getByText("银行函证控制表.xlsx");
      expect(directoryText.closest("[role='option']")).toHaveClass(
        "cursor-pointer"
      );

      expect(screen.queryByText("当前底稿")).toBeNull();

      fireEvent.click(requireElement(directoryText.closest("[role='option']")));

      expect(setSelectedNodeId).toHaveBeenCalledWith("subject-1");
      expect(onLocatePaper).not.toHaveBeenCalled();
      expect(onSelectPaper).not.toHaveBeenCalled();
      expect(onSearchChange).not.toHaveBeenCalled();
    });

    it("shows a clear button and clears only on explicit request", () => {
      const onSearchChange = vi.fn();
      const { container } = renderProjectSearch({
        searchValue: "银行",
        onSearchChange,
      });
      const clearButton = container.querySelector(
        '[data-slot="autocomplete-clear"]'
      );

      expect(clearButton).toBeInstanceOf(HTMLButtonElement);
      fireEvent.click(requireElement(clearButton));

      expect(onSearchChange).toHaveBeenCalledWith("");
    });

    it("locates a searched file with the locate handler and keeps preview closed", () => {
      const onSelectPaper = vi.fn();
      const onLocatePaper = vi.fn();
      const setSelectedNodeId = vi.fn();
      const asciiWorkflow: WorkflowNode[] = [
        {
          id: "phase-a",
          code: "A",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          workingPapers: [],
          children: [
            {
              id: "folder-a1",
              parentId: "phase-a",
              code: "A1",
              title: "Cash",
              level: 2,
              nodeType: "FOLDER",
              workingPapers: [
                {
                  id: "paper-cash",
                  projectId: "project-1",
                  workflowNodeId: "folder-a1",
                  code: "A1-1000",
                  title: "Cash schedule",
                  paperType: "WORKING_PAPER",
                  attachments: [
                    {
                      id: "attachment-cash",
                      workingPaperId: "paper-cash",
                      fileKind: "SPREADSHEET",
                      fileName: "stored.xlsx",
                      originalName: "cash.xlsx",
                      fileUrl: "working-papers/cash.xlsx",
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
          ],
        },
      ];

      renderProjectSearch({
        workflow: asciiWorkflow,
        copy: enWorkbenchCopy,
        searchValue: "cash",
        onSelectPaper,
        onLocatePaper,
        setSelectedNodeId,
      });

      const menu = screen.getByRole("listbox");
      const fileText = within(menu).getByText("cash.xlsx");

      fireEvent.click(requireElement(fileText.closest("[role='option']")));

      expect(setSelectedNodeId).toHaveBeenCalledWith("folder-a1");
      expect(onLocatePaper).toHaveBeenCalledWith(
        "paper-cash",
        "folder-a1",
        "attachment-cash"
      );
      expect(onSelectPaper).not.toHaveBeenCalled();
    });

    it("runs file actions without triggering the search result row", () => {
      const onFileAction = vi.fn();
      const setSelectedNodeId = vi.fn();
      renderProjectSearch({
        searchValue: "银行",
        setSelectedNodeId,
        fileActionCopy: {
          preview: "预览",
          openMaster: "打开 Master",
          download: "下载",
        },
        onFileAction,
      });

      const fileOption = screen
        .getByText("银行函证控制表.xlsx")
        .closest<HTMLElement>("[role='option']");
      expect(fileOption).toHaveClass("cursor-pointer");

      const previewButton = within(requireElement(fileOption)).getByRole(
        "button",
        {
          name: "预览",
        }
      );
      fireEvent.pointerDown(previewButton);
      fireEvent.mouseDown(previewButton);
      fireEvent.pointerUp(previewButton);
      fireEvent.click(previewButton, { detail: 1 });
      expect(onFileAction).toHaveBeenLastCalledWith(
        "PREVIEW",
        expect.objectContaining({ attachmentId: "attachment-1" })
      );
      expect(setSelectedNodeId).not.toHaveBeenCalled();

      fireEvent.pointerDown(previewButton, { ctrlKey: true });
      expect(onFileAction).toHaveBeenLastCalledWith(
        "PREVIEW_NEW_WINDOW",
        expect.objectContaining({ attachmentId: "attachment-1" })
      );
      expect(previewButton).toHaveAttribute("data-slot", "button");

      const masterButton = within(requireElement(fileOption)).getByRole(
        "button",
        {
          name: "打开 Master",
        }
      );
      expect(masterButton.querySelector(".lucide-download")).not.toBeNull();
      fireEvent.pointerDown(masterButton);
      expect(onFileAction).toHaveBeenLastCalledWith(
        "MASTER",
        expect.objectContaining({ attachmentId: "attachment-1" })
      );
      expect(setSelectedNodeId).not.toHaveBeenCalled();
    });

    it("offers download when the searched file cannot open as Master", () => {
      const imageWorkflow = structuredClone(workflow);
      const imageWorkflowRoot = requireValue(imageWorkflow[0]);
      const imageWorkflowSubject = requireValue(
        imageWorkflowRoot.children?.[0]
      );
      const imageWorkflowFolder = requireValue(
        imageWorkflowSubject.children?.[0]
      );
      const imageWorkflowPaper = requireValue(
        imageWorkflowFolder.workingPapers[0]
      );
      const attachment = requireValue(imageWorkflowPaper.attachments?.[0]);
      attachment.originalName = "银行截图.png";
      attachment.fileName = "stored.png";
      attachment.mimeType = "image/png";
      const onFileAction = vi.fn();
      renderProjectSearch({
        workflow: imageWorkflow,
        searchValue: "截图",
        fileActionCopy: {
          preview: "预览",
          openMaster: "打开 Master",
          download: "下载",
        },
        onFileAction,
      });

      const fileOption = screen
        .getByText("银行截图.png")
        .closest<HTMLElement>("[role='option']");
      expect(
        within(requireElement(fileOption)).queryByRole("button", {
          name: "打开 Master",
        })
      ).toBeNull();
      fireEvent.click(
        within(requireElement(fileOption)).getByRole("button", { name: "下载" })
      );

      expect(onFileAction).toHaveBeenCalledWith(
        "DOWNLOAD",
        expect.objectContaining({ attachmentId: "attachment-1" })
      );
    });

    it("centers the highlighted file row in the directory tree", () => {
      const scrollIntoView = vi.fn();
      Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: scrollIntoView,
      });

      renderDirectory({
        highlightedPaperId: "working-paper-1",
        showFiles: true,
      });

      expect(getPaperButton("working-paper-1")).toBeInTheDocument();
      expect(scrollIntoView).toHaveBeenCalledWith({
        block: "center",
        inline: "nearest",
      });
    });

    it("does not match descendants only because their path contains the query", () => {
      renderProjectSearch({ searchValue: "计划阶段", onSelectPaper: vi.fn() });

      const menu = screen.getByRole("listbox");

      expect(within(menu).getByText("A - 计划阶段")).toBeTruthy();
      expect(within(menu).getByText("目录")).toBeTruthy();
    });

    it("matches files by their displayed working paper code", () => {
      renderProjectSearch({ searchValue: "F001", onSelectPaper: vi.fn() });

      const menu = screen.getByRole("listbox");

      expect(within(menu).getByText("银行函证控制表.xlsx")).toBeTruthy();
    });

    it("does not match files by hidden paper title when an upload name is shown", () => {
      renderProjectSearch({ searchValue: "银行存款", onSelectPaper: vi.fn() });

      const menu = screen.getByRole("listbox");

      expect(within(menu).getByText(/银行存款/)).toBeTruthy();
    });

    it("offers child-folder creation below the second level", () => {
      renderDirectory();

      fireEvent.click(getNodeButton("phase-1"));
      fireEvent.click(getNodeButton("subject-1"));

      fireEvent.contextMenu(getNodeButton("paper-1"));

      expect(screen.getByRole("menuitem", { name: "新增组" })).toBeTruthy();
    });

    it("creates an inline virtual row", () => {
      const createNode = vi.fn();
      renderDirectory({ createNode });

      fireEvent.contextMenu(getNodeButton("phase-1"));
      fireEvent.click(screen.getByRole("menuitem", { name: "新增组" }));

      const inlineInput = screen.getByRole("textbox", { name: "新组" });
      const titleInput = screen.getByRole("textbox", { name: "目录名称" });
      expect(inlineInput).toHaveClass("w-24");
      expect(titleInput).toHaveClass("flex-1");
      fireEvent.change(inlineInput, { target: { value: "A02" } });
      fireEvent.change(titleInput, { target: { value: "银行存款" } });
      fireEvent.keyDown(inlineInput, { key: "Enter" });

      expect(createNode).toHaveBeenCalledWith({
        code: "A02",
        title: "银行存款",
      });
      expect(screen.queryByText("创建新组")).toBeNull();
    });

    it("creates a top-level phase inline", () => {
      const createNode = vi.fn();
      renderDirectory({ copy: enWorkbenchCopy, createNode });

      openRootContextMenu();
      fireEvent.click(screen.getByRole("menuitem", { name: "Add phase" }));

      const inlineInput = screen.getByRole("textbox", { name: "New phase" });
      fireEvent.change(inlineInput, { target: { value: "Completion" } });
      fireEvent.keyDown(inlineInput, { key: "Enter" });

      expect(createNode).toHaveBeenCalledWith({
        code: "Completion",
        title: "Completion",
      });
    });

    it("creates a top-level phase when the directory is empty", () => {
      const createNode = vi.fn();
      renderDirectory({ copy: enWorkbenchCopy, workflow: [], createNode });

      openRootContextMenu();
      fireEvent.click(screen.getByRole("menuitem", { name: "Add phase" }));

      const inlineInput = screen.getByRole("textbox", { name: "New phase" });
      fireEvent.change(inlineInput, { target: { value: "Planning" } });
      fireEvent.keyDown(inlineInput, { key: "Enter" });

      expect(createNode).toHaveBeenCalledWith({
        code: "Planning",
        title: "Planning",
      });
    });

    it("renames and deletes top-level phases", () => {
      const renameNode = vi.fn();
      const deleteNode = vi.fn();
      renderDirectory({
        copy: enWorkbenchCopy,
        renameNode,
        deleteNode,
      });

      openNodeRenameDialog("phase-1", "Rename phase");
      const renameInput = screen.getByRole("textbox", {
        name: "Reference code",
      });
      fireEvent.change(renameInput, { target: { value: "Planning" } });
      submitNodeRenameDialog("Rename phase");

      expect(renameNode).toHaveBeenCalledWith(
        expect.objectContaining({ id: "phase-1" }),
        {
          code: "Planning",
          title: workflowPhase.title,
        }
      );

      fireEvent.contextMenu(getNodeButton("phase-1"));
      fireEvent.click(screen.getByRole("menuitem", { name: "Delete phase" }));

      expect(deleteNode).toHaveBeenCalledWith(
        expect.objectContaining({ id: "phase-1" })
      );
    });

    it("keeps an inline node draft when it loses focus", () => {
      const createNode = vi.fn();
      renderDirectory({ addNodeTarget: workflow[0], createNode });

      const inlineInput = screen.getByRole("textbox", { name: "新组" });
      fireEvent.change(inlineInput, { target: { value: "A02" } });
      fireEvent.blur(inlineInput);

      expect(createNode).not.toHaveBeenCalled();
      expect(inlineInput).toHaveValue("A02");
    });

    it("saves a directory draft when another directory is clicked", () => {
      const createNode = vi.fn();
      const setSelectedNodeId = vi.fn();
      renderDirectory({
        addNodeTarget: workflow[0],
        createNode,
        setSelectedNodeId,
        workflow: [
          workflow[0],
          {
            ...workflow[0],
            id: "phase-2",
            code: "B",
            title: "执行阶段",
            children: [],
          },
        ],
      });

      const inlineInput = screen.getByRole("textbox", { name: "新组" });
      fireEvent.change(inlineInput, { target: { value: "A02" } });
      fireEvent.pointerDown(getNodeButton("phase-2"));

      expect(createNode).toHaveBeenCalledWith({ code: "A02", title: "A02" });
      expect(setSelectedNodeId).not.toHaveBeenCalled();
    });

    it("suggests A1 as the first group code", () => {
      const createNode = vi.fn();
      renderDirectory({
        createNode,
        workflow: [
          {
            ...workflow[0],
            children: [],
          },
        ],
      });

      fireEvent.contextMenu(getNodeButton("phase-1"));
      fireEvent.click(screen.getByRole("menuitem", { name: "新增组" }));

      const inlineInput = screen.getByRole("textbox", { name: "新组" });
      expect(inlineInput).toHaveValue("A1");
      expect(inlineInput).toHaveProperty("selectionStart", 2);
      expect(inlineInput).toHaveProperty("selectionEnd", 2);
      fireEvent.keyDown(inlineInput, { key: "Enter" });

      expect(createNode).toHaveBeenCalledWith({ code: "A1", title: "A1" });
    });

    it("suggests B1 as the first group code under the B phase", () => {
      const createNode = vi.fn();
      renderDirectory({
        copy: enWorkbenchCopy,
        createNode,
        workflow: [
          {
            ...workflow[0],
            code: "Planning",
            title: "Planning",
            children: [],
          },
          {
            ...workflow[0],
            id: "phase-2",
            code: "Execution",
            title: "Execution",
            children: [],
          },
        ],
      });

      fireEvent.contextMenu(getNodeButton("phase-2"));
      fireEvent.click(screen.getByRole("menuitem", { name: "Add group" }));

      const inlineInput = screen.getByRole("textbox", { name: "New group" });
      expect(inlineInput).toHaveValue("A1");
      fireEvent.keyDown(inlineInput, { key: "Enter" });

      expect(createNode).toHaveBeenCalledWith({ code: "A1", title: "A1" });
    });

    it("suggests a second-level group code from existing siblings", () => {
      renderDirectory({
        workflow: buildNumberingWorkflow(),
      });

      fireEvent.click(getNodeButton("phase-1"));
      fireEvent.contextMenu(getNodeButton("phase-1"));
      fireEvent.click(screen.getByRole("menuitem", { name: "新增组" }));

      const groupInput = screen.getByRole("textbox", { name: "新组" });
      expect(groupInput).toHaveValue("A2");
      fireEvent.keyDown(groupInput, { key: "Escape" });

      fireEvent.contextMenu(getNodeButton("group-a1"));
      expect(screen.getByRole("menuitem", { name: "新增组" })).toBeTruthy();
    });

    it("suggests a nested child code from the full parent code", () => {
      const parent: WorkflowNode = {
        id: "paper-a1-1000",
        parentId: "group-a1",
        code: "A1-1000",
        title: "A1-1000",
        level: 3,
        nodeType: "WORKING_PAPER",
        workingPapers: [],
        children: [],
      };

      render(
        createElement(InlineCreateNodeRow, {
          copy: enWorkbenchCopy,
          parent,
          isPending: false,
          onCreate: vi.fn(),
          onClose: vi.fn(),
        })
      );

      expect(screen.getByRole("textbox", { name: "New level" })).toHaveValue(
        "A1-1000-1000"
      );
    });

    it("saves an inline directory draft when clicking elsewhere", () => {
      const onCreate = vi.fn();
      const onClose = vi.fn();
      render(
        createElement(InlineCreateNodeRow, {
          copy: enWorkbenchCopy,
          parent: workflowSubject,
          isPending: false,
          onCreate,
          onClose,
        })
      );

      expect(
        screen.queryByRole("button", { name: "Create directory" })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Cancel" })
      ).not.toBeInTheDocument();

      fireEvent.pointerDown(document.body);

      expect(onCreate).toHaveBeenCalledOnce();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("preserves a custom folder code instead of displaying a rolling code", () => {
      const customCodeNode: WorkflowNode = {
        ...workflowSubject,
        code: "PLN-CUSTOM-77",
        title: "PLN-CUSTOM-77",
      };

      expect(getDirectoryDisplayNode(customCodeNode, 1, "A")).toMatchObject({
        code: "PLN-CUSTOM-77",
        title: "PLN-CUSTOM-77",
      });
    });

    it("keeps existing third-level directories visible and allows a child", () => {
      const emptyThirdLevel: WorkflowNode = {
        ...workflowPaperFolder,
        workingPapers: [],
        children: [],
      };
      const nestedWorkflow: WorkflowNode[] = [
        {
          ...workflowPhase,
          children: [
            {
              ...workflowSubject,
              children: [emptyThirdLevel],
            },
          ],
        },
      ];

      renderDirectory({
        workflow: nestedWorkflow,
      });

      fireEvent.click(getNodeButton("phase-1"));
      fireEvent.click(getNodeButton("subject-1"));
      fireEvent.contextMenu(getNodeButton("paper-1"));
      expect(getNodeButton("paper-1")).toBeTruthy();
      expect(screen.getByRole("menuitem", { name: "新增组" })).toBeTruthy();
    });

    it("skips digit 4 when suggesting second-level group codes", () => {
      renderDirectory({
        copy: enWorkbenchCopy,
        workflow: buildFourAvoidanceWorkflow(),
      });

      fireEvent.click(getNodeButton("phase-1"));
      fireEvent.contextMenu(getNodeButton("phase-1"));
      fireEvent.click(screen.getByRole("menuitem", { name: "Add group" }));

      const groupInput = screen.getByRole("textbox", { name: "New group" });
      expect(groupInput).toHaveValue("A6");
      fireEvent.keyDown(groupInput, { key: "Escape" });

      fireEvent.contextMenu(getNodeButton("group-a3"));
      expect(screen.getByRole("menuitem", { name: "Add group" })).toBeTruthy();
    });

    it("renames editable tree nodes from the context menu", () => {
      const renameNode = vi.fn();
      renderDirectory({ renameNode });

      fireEvent.click(getNodeButton("phase-1"));
      fireEvent.doubleClick(getNodeButton("subject-1"));
      expect(screen.queryByRole("dialog")).toBeNull();
      openNodeRenameDialog("subject-1", "重命名组");

      const input = screen.getByRole("textbox", { name: "参考编号" });
      fireEvent.change(input, { target: { value: "A02" } });
      submitNodeRenameDialog("重命名组");

      expect(renameNode).toHaveBeenCalledWith(
        expect.objectContaining({ id: "subject-1" }),
        {
          code: "A02",
          title: workflowSubject.title,
        }
      );
    });

    it("exports a folder from the context menu even in read-only mode", () => {
      const onExportNode = vi.fn();
      renderDirectory({
        copy: { ...enWorkbenchCopy, exportFolderAction: "Export folder" },
        readOnly: true,
        onExportNode,
        visibleFileBucket: "PRIOR",
      });

      fireEvent.contextMenu(getNodeButton("phase-1"));
      fireEvent.click(screen.getByRole("menuitem", { name: "Export folder" }));

      expect(onExportNode).toHaveBeenCalledWith(
        expect.objectContaining({ id: "phase-1" }),
        "PRIOR"
      );
    });

    it("exports the clicked child folder from the currently visible bucket", () => {
      const onExportNode = vi.fn();
      renderDirectory({
        copy: { ...enWorkbenchCopy, exportFolderAction: "Export folder" },
        onExportNode,
        visibleFileBucket: "TEMPORARY",
      });

      fireEvent.click(getNodeButton("phase-1"));
      fireEvent.click(getNodeButton("subject-1"));
      fireEvent.contextMenu(getNodeButton("paper-1"));
      fireEvent.click(screen.getByRole("menuitem", { name: "Export folder" }));

      expect(onExportNode).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ id: "paper-1" }),
        "TEMPORARY"
      );
    });

    it("keeps the current folder label visible while renaming", () => {
      const renameNode = vi.fn();
      renderDirectory({ renameNode });

      fireEvent.click(getNodeButton("phase-1"));
      openNodeRenameDialog("subject-1", "重命名组");

      const codeInput = screen.getByRole("textbox", { name: "参考编号" });
      const titleInput = screen.getByRole("textbox", { name: "目录名称" });
      expect(codeInput).toHaveValue("A01");
      expect(titleInput).toHaveValue("现金与银行");

      submitNodeRenameDialog("重命名组");

      expect(renameNode).not.toHaveBeenCalled();
    });

    it("shows hierarchical reference numbers before legacy-swapped names", () => {
      const renameNode = vi.fn();
      renderDirectory({
        copy: enWorkbenchCopy,
        renameNode,
        workflow: [
          {
            ...workflow[0],
            id: "phase-swapped",
            code: "A",
            title: "1000",
            children: [],
          },
        ],
      });

      openNodeRenameDialog("phase-swapped", "Rename phase");
      expect(
        screen.getByRole("textbox", { name: "Reference code" })
      ).toHaveValue("1000");
      expect(
        screen.getByRole("textbox", { name: "Directory name" })
      ).toHaveValue("A");

      submitNodeRenameDialog("Rename phase");
      expect(renameNode).not.toHaveBeenCalled();
    });

    it("renames directory codes and names independently", () => {
      const renameNode = vi.fn();
      renderDirectory({ copy: enWorkbenchCopy, renameNode });

      fireEvent.click(getNodeButton("phase-1"));
      openNodeRenameDialog("subject-1", "Rename group");

      fireEvent.change(
        screen.getByRole("textbox", { name: "Reference code" }),
        {
          target: { value: "A2" },
        }
      );
      fireEvent.change(
        screen.getByRole("textbox", { name: "Directory name" }),
        {
          target: { value: "Review plan" },
        }
      );
      submitNodeRenameDialog("Rename group");

      expect(renameNode).toHaveBeenCalledWith(
        expect.objectContaining({ id: "subject-1" }),
        {
          code: "A2",
          title: "Review plan",
        }
      );
    });

    it("renames workpaper codes and names independently", () => {
      const renameNode = vi.fn();
      renderDirectory({ copy: enWorkbenchCopy, renameNode });

      fireEvent.click(getNodeButton("phase-1"));
      fireEvent.click(getNodeButton("subject-1"));
      openNodeRenameDialog("paper-1", "Rename workpaper");

      fireEvent.change(
        screen.getByRole("textbox", { name: "Reference code" }),
        {
          target: { value: "A1-1000" },
        }
      );
      fireEvent.change(
        screen.getByRole("textbox", { name: "Directory name" }),
        {
          target: { value: "No" },
        }
      );
      submitNodeRenameDialog("Rename workpaper");

      expect(renameNode).toHaveBeenCalledWith(
        expect.objectContaining({ id: "paper-1" }),
        {
          code: "A1-1000",
          title: "No",
        }
      );
    });

    it.each(["No", "XX"])(
      "preserves workpaper reference codes when renaming to %s",
      (expectedTitle) => {
        const renameNode = vi.fn();
        renderDirectory({ copy: enWorkbenchCopy, renameNode });

        fireEvent.click(getNodeButton("phase-1"));
        fireEvent.click(getNodeButton("subject-1"));
        openNodeRenameDialog("paper-1", "Rename workpaper");

        fireEvent.change(
          screen.getByRole("textbox", { name: "Directory name" }),
          {
            target: { value: expectedTitle },
          }
        );
        submitNodeRenameDialog("Rename workpaper");

        expect(renameNode).toHaveBeenCalledWith(
          expect.objectContaining({ id: "paper-1" }),
          {
            code: "A01-0001",
            title: expectedTitle,
          }
        );
      }
    );

    it("does not duplicate the rolling code when old state saved it in the title", () => {
      renderDirectory({
        copy: enWorkbenchCopy,
        workflow: [
          {
            ...workflowPhase,
            children: [
              {
                ...workflowSubject,
                id: "subject-a1",
                code: "A1",
                title: "A1",
                children: [],
              },
              {
                ...workflowSubject,
                id: "subject-a2",
                code: "A2",
                title: "A2",
                children: [],
              },
              {
                ...workflowSubject,
                id: "subject-a3",
                code: "A3",
                title: "A3",
                children: [
                  {
                    ...workflowPaperFolder,
                    code: "A3-1000-No",
                    title: "A3-1000-No",
                    workingPapers: [],
                  },
                ],
              },
            ],
          },
        ],
      });

      fireEvent.click(screen.getByRole("treeitem", { name: /^A - / }));
      const subjectButton = screen
        .getAllByRole("treeitem", { name: /^A3/ })
        .find((button) => !button.textContent?.includes("1000"));
      expect(subjectButton).toBeTruthy();
      fireEvent.click(requireElement(subjectButton));

      expect(
        screen.getByRole("treeitem", { name: "A3 - 1000 - No" })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "A3 - 1000 - A3 - 1000 - No" })
      ).toBeNull();
    });

    it("deletes the focused tree node when Delete is pressed", () => {
      const deleteNode = vi.fn();
      renderDirectory({ deleteNode });

      fireEvent.click(getNodeButton("phase-1"));
      const groupButton = getNodeButton("subject-1");
      fireEvent.keyDown(groupButton, { key: "Delete" });

      expect(deleteNode).toHaveBeenCalledWith(
        expect.objectContaining({ id: "subject-1" })
      );
    });

    it("keeps nested directory rows in the ReUI tree indentation", () => {
      renderDirectory({ onUploadFile: vi.fn() });

      fireEvent.click(getNodeButton("phase-1"));
      fireEvent.click(getNodeButton("subject-1"));

      const thirdLevelText = getNodeButton("paper-1");
      const treeItem = thirdLevelText.closest('[role="treeitem"]');

      expect(treeItem).toHaveAttribute("aria-level", "3");
      expect(treeItem).toHaveAttribute("data-slot", "tree-item");
      expect(treeItem).toHaveClass("w-full", "min-w-0");
      expect(thirdLevelText).toHaveAttribute("data-slot", "tree-item-label");
      expect(thirdLevelText).toHaveClass("flex", "items-center", "gap-1");
    });

    it("renders the add-directory input as an inline virtual row", () => {
      renderDirectory({ addNodeTarget: workflow[0] });

      const input = screen.getByRole("textbox", { name: "新组" });

      expect(input).toHaveValue("A2");
      expect(input.closest("li")).toBeTruthy();
    });

    it("renders the empty state for an empty workflow", () => {
      renderDirectory({ workflow: [] });

      expect(screen.getByText("项目结构为空")).toBeTruthy();
    });

    it("uses provided English copy for search and empty states", () => {
      renderDirectory({
        workflow: [],
        copy: enWorkbenchCopy,
      });

      renderProjectSearch({
        workflow: [],
        copy: enWorkbenchCopy,
      });

      expect(
        screen.getByRole("combobox", { name: "Search directories or files" })
      ).toBeTruthy();
      expect(screen.getByText("Project structure is empty")).toBeTruthy();
    });

    it("keeps directory and file icons neutral", () => {
      const { container } = renderDirectory();
      fireEvent.click(getNodeButton("phase-1"));
      fireEvent.click(getNodeButton("subject-1"));

      expect(container.querySelectorAll(".lucide-folder-lock")).toHaveLength(0);
      expect(container.querySelectorAll(".lucide-folder")).toHaveLength(3);
      expect(container.querySelectorAll(".lucide-file-text")).toHaveLength(0);
      expect(container.querySelectorAll(".text-primary")).toHaveLength(0);
      expect(container.querySelectorAll(".text-success")).toHaveLength(0);
    });

    it("renders the directory as a ReUI tree inside the sidebar", () => {
      const { container } = renderDirectory();

      expect(
        container.querySelector('[data-slot="sidebar-wrapper"]')
      ).toBeTruthy();
      expect(container.querySelector('[data-slot="tree"]')).toBeTruthy();
      expect(container.querySelector('[role="tree"]')).toBeTruthy();
    });
  });

  function renderDirectory(
    overrides: Partial<Parameters<typeof WorkbenchDirectory>[0]> = {}
  ) {
    function DirectoryHarness() {
      const [addNodeTarget, setAddNodeTarget] = useState<WorkflowNode | null>(
        null
      );

      return createElement(WorkbenchDirectory, {
        workflow,
        copy: zhWorkbenchCopy,
        selectedNodeId: null,
        addNodeTarget,
        setSelectedNodeId: vi.fn(),
        openAddNode: setAddNodeTarget,
        closeAddNode: () => setAddNodeTarget(null),
        createNode: vi.fn(),
        createNodePending: false,
        deleteNode: vi.fn(),
        ...overrides,
      });
    }

    return render(createElement(DirectoryHarness));
  }

  function getNodeButton(nodeId: string) {
    const button = queryNodeButton(nodeId);
    if (!button) {
      throw new Error(`Directory node button not found: ${nodeId}`);
    }
    return button;
  }

  function queryNodeButton(nodeId: string) {
    return document.querySelector<HTMLElement>(
      `[data-directory-selectable-id="node:${nodeId}"]`
    );
  }

  function _getNodeChevron(button: HTMLElement) {
    const icon = button.querySelector('[data-directory-node-chevron="true"]');
    if (!(icon instanceof HTMLElement)) {
      throw new Error("Directory node chevron not found");
    }
    return icon;
  }

  function _getNodeIcon(button: HTMLElement) {
    const icon = button.querySelector('[data-directory-node-icon="true"]');
    if (!(icon instanceof HTMLElement)) {
      throw new Error("Directory node icon not found");
    }
    return icon;
  }

  function getPaperButton(paperId: string) {
    const button = queryPaperButton(paperId);
    if (!button) {
      throw new Error(`Directory paper button not found: ${paperId}`);
    }
    return button;
  }

  function queryPaperButton(paperId: string) {
    return document.querySelector<HTMLElement>(
      `[data-directory-selectable-id="paper:${paperId}"]`
    );
  }

  function openRootContextMenu() {
    const content = document.querySelector('[data-slot="sidebar-content"]');
    if (!(content instanceof HTMLElement)) {
      throw new Error("Directory content not found");
    }
    fireEvent.contextMenu(content, { clientX: 24, clientY: 24 });
  }

  function openNodeRenameDialog(nodeId: string, renameLabel: string) {
    fireEvent.contextMenu(getNodeButton(nodeId));
    fireEvent.click(screen.getByRole("menuitem", { name: renameLabel }));
  }

  function submitNodeRenameDialog(renameLabel: string) {
    fireEvent.click(screen.getByRole("button", { name: renameLabel }));
  }

  function renderProjectSearch(
    overrides: Partial<Parameters<typeof WorkbenchProjectSearch>[0]> = {}
  ) {
    const result = render(
      createElement(WorkbenchProjectSearch, {
        workflow,
        copy: zhWorkbenchCopy,
        setSelectedNodeId: vi.fn(),
        ...overrides,
      })
    );
    fireEvent.focus(screen.getByRole("combobox"));
    return result;
  }

  function buildNumberingWorkflow(): WorkflowNode[] {
    return [
      {
        ...workflow[0],
        children: [
          {
            id: "group-a1",
            parentId: "phase-1",
            code: "A1",
            title: "A1",
            level: 2,
            nodeType: "ACCOUNT",
            workingPapers: [],
            children: [
              {
                id: "paper-a1-1000",
                parentId: "group-a1",
                code: "A1-1000",
                title: "A1-1000",
                level: 3,
                nodeType: "WORKING_PAPER",
                workingPapers: [],
                children: [],
              },
            ],
          },
        ],
      },
    ];
  }

  function buildFourAvoidanceWorkflow(): WorkflowNode[] {
    return [
      {
        ...workflow[0],
        children: [
          {
            id: "group-a3",
            parentId: "phase-1",
            code: "A3",
            title: "A3",
            level: 2,
            nodeType: "ACCOUNT",
            workingPapers: [],
            children: [
              {
                id: "paper-a3-3000",
                parentId: "group-a3",
                code: "A3-3000",
                title: "A3-3000",
                level: 3,
                nodeType: "WORKING_PAPER",
                workingPapers: [],
                children: [],
              },
              {
                id: "paper-a3-4000",
                parentId: "group-a3",
                code: "A3-4000",
                title: "A3-4000",
                level: 3,
                nodeType: "WORKING_PAPER",
                workingPapers: [],
                children: [],
              },
            ],
          },
          {
            id: "group-a4",
            parentId: "phase-1",
            code: "A4",
            title: "A4",
            level: 2,
            nodeType: "ACCOUNT",
            workingPapers: [],
            children: [],
          },
        ],
      },
    ];
  }

  function buildBucketWorkflow(): WorkflowNode[] {
    const makePaper = (
      id: string,
      bucket: "CURRENT" | "PRIOR" | "TEMPORARY",
      fileName: string
    ): WorkflowNode["workingPapers"][number] => ({
      id,
      projectId: "project-1",
      workflowNodeId: "bucket-folder",
      code: `${id}-code`,
      title: fileName,
      paperType: "WORKING_PAPER",
      bucket,
      attachments: [
        {
          id: `${id}-attachment`,
          workingPaperId: id,
          fileKind: "SPREADSHEET",
          fileName,
          originalName: fileName,
          fileUrl: `working-papers/project-1/${fileName}`,
          fileSize: 1024,
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          version: 1,
        },
      ],
    });

    return [
      {
        id: "bucket-phase",
        code: "Bucket phase",
        title: "Bucket phase",
        level: 1,
        nodeType: "PHASE",
        workingPapers: [],
        children: [
          {
            id: "bucket-folder",
            parentId: "bucket-phase",
            code: "Bucket folder",
            title: "Bucket folder",
            level: 2,
            nodeType: "FOLDER",
            workingPapers: [
              makePaper("current-paper", "CURRENT", "current.xlsx"),
              makePaper("prior-paper", "PRIOR", "prior.xlsx"),
              makePaper("temporary-paper", "TEMPORARY", "temporary.xlsx"),
            ],
            children: [],
          },
        ],
      },
    ];
  }
});
