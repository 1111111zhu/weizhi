"use client";

import { isProjectWingMasterSupportedFileName } from "@project-wing/shared";
import type { WorkingPaperBucket } from "@project-wing/shared";
import {
  ChevronLeft,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderPlus,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

import {
  Autocomplete,
  AutocompleteCollection,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteGroupLabel,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from "@/components/reui/autocomplete";
import { Button } from "@/components/ui/button";
import { DynamicBox } from "@/components/ui/dynamic-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { WorkflowNode } from "../api/client";
import { findWorkflowNode, formatDisplayName } from "../lib/project-layout";
import { cn } from "../lib/utils";
import { EmptyState } from "./empty-state";
import { ProjectFileTypeIcon } from "./project-file-type-icon";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
} from "./sidebar";
import { WorkbenchDirectoryMobile } from "./workbench-directory-mobile";
import {
  DirectoryTruncatedTooltip,
  InlineCreateNodeRow,
} from "./workbench-directory-row";
import type {
  DirectoryFileClipboard,
  DirectoryFileTransfer,
  DirectoryNodeClipboard,
  DirectoryNodeForm,
  DirectoryNodeRename,
  DirectoryNodeTransfer,
} from "./workbench-directory-row";
import { WorkbenchDirectoryTree } from "./workbench-directory-tree";
import { WorkbenchSearchFileActions } from "./workbench-search-file-actions";
import type {
  WorkbenchSearchFileAction,
  WorkbenchSearchFileActionCopy,
} from "./workbench-search-file-actions";

export type { DirectoryNodeForm } from "./workbench-directory-row";
export type {
  DirectoryFileClipboard,
  DirectoryFileTransfer,
  DirectoryNodeClipboard,
  DirectoryNodeRename,
  DirectoryNodeTransfer,
} from "./workbench-directory-row";

export type WorkbenchDirectoryProps = {
  mobileLocale?: string;
  copy?: WorkbenchDirectoryCopy;
  workflow: WorkflowNode[];
  selectedNodeId: string | null;
  selectedNodeHighlightId?: string | null;
  revealNodeId?: string | null;
  addNodeTarget: WorkflowNode | null;
  setSelectedNodeId: (id: string) => void;
  openAddNode: (node: WorkflowNode) => void;
  closeAddNode: () => void;
  createNode: (values: DirectoryNodeForm) => void;
  createNodePending: boolean;
  renameNode?: (node: WorkflowNode, values: DirectoryNodeRename) => void;
  renameNodePending?: boolean;
  deleteNode: (node: WorkflowNode) => void;
  deleteNodePending?: boolean;
  selectedPaperId?: string | null;
  highlightedPaperId?: string | null;
  showFiles?: boolean;
  showFileRows?: boolean;
  useTemporaryFilesView?: boolean;
  showTemporaryFiles?: boolean;
  onSelectPaper?: (paperId: string, nodeId: string) => void;
  onLocatePaper?: (
    paperId: string,
    nodeId: string,
    highlightId?: string
  ) => void;
  fileClipboard?: DirectoryFileClipboard | null;
  onFileClipboardChange?: (clipboard: DirectoryFileClipboard | null) => void;
  onCopyFileToNode?: (
    file: DirectoryFileTransfer,
    node: WorkflowNode,
    files?: DirectoryFileTransfer[]
  ) => void;
  onMoveFileToNode?: (
    file: DirectoryFileTransfer,
    node: WorkflowNode,
    files?: DirectoryFileTransfer[]
  ) => void;
  onCopyNodeToNode?: (
    source: DirectoryNodeTransfer,
    node: WorkflowNode
  ) => void;
  onMoveNodeToNode?: (
    source: DirectoryNodeTransfer,
    node: WorkflowNode
  ) => void;
  onUploadFile?: (
    node: WorkflowNode,
    bucket: WorkingPaperBucket,
    file: File
  ) => void;
  onExportNode?: (node: WorkflowNode, bucket: WorkingPaperBucket) => void;
  visibleFileBucket?: WorkingPaperBucket;
  onVisibleFileBucketChange?: (bucket: WorkingPaperBucket) => void;
  auditYear?: number;
  onMultiSelectedItemIdsChange?: (itemIds: string[]) => void;
  onClearSelection?: () => void;
  multiSelectionResetKey?: number;
  uploadFilePending?: boolean;
  relocateFilePending?: boolean;
  isLoading?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  panelCollapsed?: boolean;
  panelToggleLabel?: string;
  onPanelToggle?: () => void;
  readOnly?: boolean;
  className?: string;
};

export type WorkbenchDirectoryCopy = {
  searchLabel: string;
  loadingStructureTitle: string;
  loadingStructureDescription: string;
  noMatchesTitle: string;
  noMatchesDescription: string;
  searchResultsLabel: string;
  searchNoResults: string;
  searchDirectoryKind: string;
  searchFileKind: string;
  emptyStructureTitle: string;
  emptyStructureDescription: string;
  temporaryFilesEmptyTitle?: string;
  temporaryFilesEmptyDescription?: string;
  phase?: string;
  group: string;
  workpaper: string;
  renamePhase?: string;
  renameGroup: string;
  renameWorkpaper: string;
  cancelRename?: string;
  referenceCode?: string;
  directoryName?: string;
  addPhase?: string;
  addGroup: string;
  addWorkpaper: string;
  deletePhase?: string;
  deleteGroup: string;
  deleteWorkpaper: string;
  uploadFileTo: string;
  uploadToBucket: string;
  fileInput: string;
  otherMember: string;
  locked: string;
  newPhase?: string;
  newGroup: string;
  newWorkpaper: string;
  fileBucketFilterLabel?: string;
  fileBucketFilterTitle?: string;
  clipboardCopyAction?: string;
  clipboardMoveAction?: string;
  clipboardPasteAction?: string;
  exportFolderAction?: string;
  bucketLabels: Record<WorkingPaperBucket, string>;
  bucketShortLabels?: Record<WorkingPaperBucket, string>;
};

const defaultCopy: WorkbenchDirectoryCopy = {
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
  cancelRename: "Cancel",
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
  clipboardCopyAction: "Copy",
  clipboardMoveAction: "Cut",
  clipboardPasteAction: "Paste",
  exportFolderAction: "Export folder",
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
const DEFAULT_FILE_BUCKET: WorkingPaperBucket = "CURRENT";

export function WorkbenchDirectory({
  mobileLocale,
  copy = defaultCopy,
  workflow,
  selectedNodeId,
  selectedNodeHighlightId,
  revealNodeId,
  addNodeTarget,
  setSelectedNodeId,
  openAddNode,
  closeAddNode,
  createNode,
  createNodePending,
  renameNode,
  renameNodePending = false,
  deleteNode,
  deleteNodePending = false,
  selectedPaperId = null,
  highlightedPaperId = null,
  showFiles = false,
  showFileRows,
  useTemporaryFilesView = true,
  showTemporaryFiles = true,
  onSelectPaper,
  fileClipboard,
  onFileClipboardChange,
  onCopyFileToNode,
  onMoveFileToNode,
  onCopyNodeToNode,
  onMoveNodeToNode,
  onUploadFile,
  onExportNode,
  visibleFileBucket: controlledVisibleFileBucket,
  onVisibleFileBucketChange,
  auditYear: _unused_auditYear,
  onMultiSelectedItemIdsChange,
  onClearSelection,
  multiSelectionResetKey = 0,
  uploadFilePending = false,
  relocateFilePending = false,
  isLoading = false,
  panelCollapsed = false,
  panelToggleLabel,
  onPanelToggle,
  readOnly = false,
  className,
}: WorkbenchDirectoryProps) {
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(
    () => new Set()
  );
  const [isAddingRoot, setIsAddingRoot] = useState(false);
  const [rootMenuPosition, setRootMenuPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [contextMenuNodeId, setContextMenuNodeId] = useState<string | null>(
    null
  );
  const [clipboardFile, setClipboardFile] =
    useState<DirectoryFileClipboard | null>(null);
  const [clipboardNode, setClipboardNode] =
    useState<DirectoryNodeClipboard | null>(null);
  const [uncontrolledVisibleFileBucket, setUncontrolledVisibleFileBucket] =
    useState<WorkingPaperBucket>(DEFAULT_FILE_BUCKET);
  const visibleFileBucket =
    controlledVisibleFileBucket ?? uncontrolledVisibleFileBucket;
  const isTemporaryFileView =
    showTemporaryFiles &&
    showFiles &&
    useTemporaryFilesView &&
    visibleFileBucket === "TEMPORARY";
  const showDirectoryFiles = showFileRows ?? showFiles;
  const isFileClipboardControlled = fileClipboard !== undefined;
  const activeClipboardFile = isFileClipboardControlled
    ? fileClipboard
    : clipboardFile;
  const setActiveClipboardFile = useCallback(
    (nextClipboard: DirectoryFileClipboard | null) => {
      if (isFileClipboardControlled) {
        onFileClipboardChange?.(nextClipboard);
        return;
      }
      setClipboardFile(nextClipboard);
    },
    [isFileClipboardControlled, onFileClipboardChange]
  );
  const setVisibleFileBucket = useCallback(
    (bucket: WorkingPaperBucket) => {
      const nextBucket =
        bucket === "TEMPORARY" && !showTemporaryFiles
          ? DEFAULT_FILE_BUCKET
          : bucket;
      if (controlledVisibleFileBucket === undefined) {
        setUncontrolledVisibleFileBucket(nextBucket);
      }
      onVisibleFileBucketChange?.(nextBucket);
    },
    [controlledVisibleFileBucket, onVisibleFileBucketChange, showTemporaryFiles]
  );
  const showBucketFilter = showFiles;
  const selectionContainerRef = useRef<HTMLDivElement | null>(null);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const selectionStartedOnItemRef = useRef(false);
  const selectionDraggingRef = useRef(false);
  const ignoreNextClickRef = useRef(false);
  const previousMultiSelectionResetKeyRef = useRef(multiSelectionResetKey);
  const [selectionRect, setSelectionRect] =
    useState<DirectorySelectionRect | null>(null);
  const [multiSelectedItemIds, setMultiSelectedItemIds] = useState<string[]>(
    []
  );
  const multiSelectedItemIdSet = useMemo(
    () => new Set(multiSelectedItemIds),
    [multiSelectedItemIds]
  );
  const updateMultiSelectedItemIds = useCallback(
    (itemIds: string[]) => {
      setMultiSelectedItemIds(itemIds);
      onMultiSelectedItemIdsChange?.(itemIds);
    },
    [onMultiSelectedItemIdsChange]
  );
  const clearMultiSelectedItemIds = () => {
    if (multiSelectedItemIds.length === 0) {
      return;
    }
    updateMultiSelectedItemIds([]);
  };
  useEffect(() => {
    if (previousMultiSelectionResetKeyRef.current === multiSelectionResetKey) {
      return;
    }
    previousMultiSelectionResetKeyRef.current = multiSelectionResetKey;
    updateMultiSelectedItemIds([]);
  }, [multiSelectionResetKey, updateMultiSelectedItemIds]);

  useEffect(() => {
    const targetPaperId = highlightedPaperId ?? selectedPaperId;
    const path = targetPaperId
      ? findPathToPaper(workflow, targetPaperId)
      : findPathToNode(workflow, selectedNodeId);
    if (path.length === 0) {
      return;
    }
    const selectedNode = targetPaperId
      ? null
      : findWorkflowNode(workflow, selectedNodeId);
    const shouldExpandSelectedNodeFiles = Boolean(
      showDirectoryFiles &&
      selectedNode?.workingPapers?.length &&
      !selectedNode.children?.length
    );
    setExpandedNodeIds((current) => {
      const next = new Set(current);
      const expandedPath =
        targetPaperId && selectedNodeId !== path[path.length - 1]
          ? path
          : path.slice(0, -1);
      for (const nodeId of expandedPath) {
        next.add(nodeId);
      }
      if (!targetPaperId && shouldExpandSelectedNodeFiles) {
        next.add(path[path.length - 1]);
      }
      return next;
    });
  }, [
    highlightedPaperId,
    selectedNodeId,
    selectedPaperId,
    showDirectoryFiles,
    workflow,
  ]);

  useEffect(() => {
    if (!revealNodeId) {
      return;
    }
    const path = findPathToNode(workflow, revealNodeId);
    if (path.length === 0) {
      return;
    }
    setExpandedNodeIds((current) => {
      const next = new Set(current);
      for (const id of path) {
        next.add(id);
      }
      return next;
    });
  }, [revealNodeId, workflow]);

  useEffect(() => {
    if (addNodeTarget) {
      setIsAddingRoot(false);
      setExpandedNodeIds((current) => new Set(current).add(addNodeTarget.id));
    }
  }, [addNodeTarget]);

  useEffect(() => {
    if (!readOnly) {
      return;
    }
    setIsAddingRoot(false);
    setRootMenuPosition(null);
    setActiveClipboardFile(null);
    setClipboardNode(null);
  }, [readOnly, setActiveClipboardFile]);

  useEffect(() => {
    if (showTemporaryFiles || visibleFileBucket !== "TEMPORARY") {
      return;
    }
    setVisibleFileBucket(DEFAULT_FILE_BUCKET);
  }, [setVisibleFileBucket, showTemporaryFiles, visibleFileBucket]);

  useEffect(() => {
    if (isFileClipboardControlled && fileClipboard) {
      setClipboardNode(null);
    }
  }, [fileClipboard, isFileClipboardControlled]);

  useEffect(() => {
    if (!isTemporaryFileView) {
      return;
    }
    setIsAddingRoot(false);
    setRootMenuPosition(null);
  }, [isTemporaryFileView]);

  useEffect(() => {
    if (!rootMenuPosition) {
      return;
    }

    const close = (event: PointerEvent) => {
      const { target } = event;
      if (
        target instanceof Element &&
        target.closest('[data-workbench-directory-context-menu="true"]')
      ) {
        return;
      }
      setRootMenuPosition(null);
    };
    const closeOnKeyDown = () => setRootMenuPosition(null);
    const listenerTimer = window.setTimeout(() => {
      document.addEventListener("pointerdown", close);
      document.addEventListener("keydown", closeOnKeyDown);
    }, 0);
    return () => {
      window.clearTimeout(listenerTimer);
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", closeOnKeyDown);
    };
  }, [rootMenuPosition]);

  const toggleExpanded = (nodeId: string) => {
    setExpandedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };
  const startAddingRootNode = () => {
    closeAddNode();
    if (isTemporaryFileView) {
      setVisibleFileBucket(DEFAULT_FILE_BUCKET);
    }
    setIsAddingRoot(true);
    setRootMenuPosition(null);
  };
  const openRootContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (readOnly || isTemporaryFileView) {
      return;
    }
    const { target } = event;
    if (
      target instanceof HTMLElement &&
      (target.closest("input,label,a,button") ||
        target.closest("[data-directory-selectable-id]"))
    ) {
      return;
    }
    event.preventDefault();
    setContextMenuNodeId(null);
    setRootMenuPosition({
      left: event.clientX,
      top: event.clientY,
    });
  };
  const toggleMultiSelectItem = (itemId: string) => {
    setMultiSelectedItemIds((current) => {
      const next = current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId];
      onMultiSelectedItemIdsChange?.(next);
      return next;
    });
  };
  const updateBoxSelection = (rect: DirectorySelectionRect) => {
    const container = selectionContainerRef.current;
    if (!container) {
      return;
    }
    const selectedIds = [
      ...container.querySelectorAll<HTMLElement>(
        "[data-directory-selectable-id]"
      ),
    ]
      .filter((element) => !element.closest('[data-expanded="false"]'))
      .filter((element) =>
        doDirectoryRectsIntersect(rect, element.getBoundingClientRect())
      )
      .map((element) => element.dataset.directorySelectableId)
      .filter((id): id is string => Boolean(id));
    updateMultiSelectedItemIds(selectedIds);
  };
  const visualSelectedNodeId =
    contextMenuNodeId ??
    (selectedNodeHighlightId === undefined
      ? selectedNodeId
      : selectedNodeHighlightId);
  const visualSelectedPath = useMemo(() => {
    const targetPaperId = highlightedPaperId ?? selectedPaperId;
    return targetPaperId
      ? findPathToPaper(workflow, targetPaperId)
      : findPathToNode(workflow, visualSelectedNodeId);
  }, [highlightedPaperId, selectedPaperId, visualSelectedNodeId, workflow]);
  const ancestorNodeIds = useMemo(
    () => new Set(visualSelectedPath.slice(0, -1)),
    [visualSelectedPath]
  );
  const rowProps = {
    copy,
    selectedNodeId: visualSelectedNodeId,
    ancestorNodeIds,
    addNodeTarget,
    isCreatingDirectory: Boolean(addNodeTarget) || isAddingRoot,
    expandedNodeIds,
    onSelect: (id: string) => {
      if (addNodeTarget || isAddingRoot) {
        return;
      }
      clearMultiSelectedItemIds();
      setSelectedNodeId(id);
    },
    onToggleExpanded: toggleExpanded,
    onStartAdd: openAddNode,
    onCloseAdd: closeAddNode,
    createNode,
    createNodePending,
    onRename: renameNode,
    renameNodePending,
    onDelete: deleteNode,
    deleteNodePending,
    readOnly,
    onUploadFile: readOnly ? undefined : onUploadFile,
    onExportNode:
      onExportNode && visibleFileBucket
        ? (node: WorkflowNode) => onExportNode(node, visibleFileBucket)
        : undefined,
    onAfterUploadToBucket: setVisibleFileBucket,
    uploadFilePending,
    showFiles: showDirectoryFiles,
    visibleFileBucket: showBucketFilter ? visibleFileBucket : undefined,
    selectedPaperId,
    highlightedPaperId,
    onSelectPaper: (paperId: string, nodeId: string) => {
      clearMultiSelectedItemIds();
      onSelectPaper?.(paperId, nodeId);
    },
    clipboardFile: activeClipboardFile,
    onSetClipboardFile: readOnly
      ? undefined
      : (file: DirectoryFileClipboard) => {
          setActiveClipboardFile(file);
          setClipboardNode(null);
        },
    clipboardNode,
    onSetClipboardNode: readOnly
      ? undefined
      : (node: DirectoryNodeClipboard) => {
          setClipboardNode(node);
          setActiveClipboardFile(null);
        },
    onCopyFileToNode: readOnly ? undefined : onCopyFileToNode,
    onMoveFileToNode: readOnly ? undefined : onMoveFileToNode,
    onCopyNodeToNode: readOnly ? undefined : onCopyNodeToNode,
    onMoveNodeToNode: readOnly ? undefined : onMoveNodeToNode,
    relocateFilePending,
    multiSelectedItemIds: multiSelectedItemIdSet,
    onToggleMultiSelectItem: toggleMultiSelectItem,
    onNodeContextMenuOpenChange: (nodeId: string, open: boolean) => {
      setContextMenuNodeId((current) => {
        if (open) {
          return nodeId;
        }
        return current === nodeId ? null : current;
      });
    },
    onClearSelection,
  };

  if (mobileLocale) {
    return (
      <WorkbenchDirectoryMobile
        workflow={workflow}
        rowProps={{
          ...rowProps,
          selectedNodeId,
          createNode: (values) => {
            if (isAddingRoot) {
              setIsAddingRoot(false);
            }
            createNode(values);
          },
        }}
        initialNodeId={selectedNodeId}
        locale={mobileLocale}
        loading={isLoading}
        addingRoot={isAddingRoot}
        onAddRoot={startAddingRootNode}
        onCloseRoot={() => setIsAddingRoot(false)}
      />
    );
  }

  return (
    <SidebarProvider
      className="h-full min-w-0 overflow-hidden"
      open={!panelCollapsed}
      onOpenChange={(open) => {
        if (!open) {
          onPanelToggle?.();
        }
      }}
    >
      <Sidebar
        className={cn(
          "relative min-w-0 overflow-hidden rounded-r-[12px]",
          className
        )}
      >
        {panelCollapsed ? null : (
          <SidebarContent
            className="flex h-full flex-col overflow-hidden px-2 py-3"
            onContextMenu={openRootContextMenu}
          >
            <div
              ref={selectionContainerRef}
              data-testid="workbench-directory-scroll-area"
              className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto select-none"
              onClickCapture={(event) => {
                if (!ignoreNextClickRef.current) {
                  return;
                }
                event.preventDefault();
                event.stopPropagation();
                ignoreNextClickRef.current = false;
              }}
              onPointerDown={(event) => {
                if (event.button !== 0) {
                  return;
                }
                const { target } = event;
                if (
                  target instanceof HTMLElement &&
                  (target.closest("input,label,a,button") ||
                    target.closest("[data-directory-selectable-id]"))
                ) {
                  selectionStartedOnItemRef.current = true;
                  return;
                }
                selectionStartedOnItemRef.current = false;
                selectionStartRef.current = {
                  x: event.clientX,
                  y: event.clientY,
                };
                selectionDraggingRef.current = false;
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                const start = selectionStartRef.current;
                if (!start) {
                  return;
                }
                const rect = makeDirectorySelectionRect(
                  start.x,
                  start.y,
                  event.clientX,
                  event.clientY
                );
                if (rect.width < 4 && rect.height < 4) {
                  return;
                }
                selectionDraggingRef.current = true;
                setSelectionRect(rect);
                updateBoxSelection(rect);
              }}
              onPointerUp={(event) => {
                const hadSelectionStart = Boolean(selectionStartRef.current);
                if (selectionDraggingRef.current) {
                  ignoreNextClickRef.current = true;
                  window.setTimeout(() => {
                    ignoreNextClickRef.current = false;
                  }, 0);
                } else if (
                  hadSelectionStart &&
                  !selectionStartedOnItemRef.current
                ) {
                  clearMultiSelectedItemIds();
                  onClearSelection?.();
                }
                selectionStartRef.current = null;
                selectionStartedOnItemRef.current = false;
                selectionDraggingRef.current = false;
                setSelectionRect(null);
                if (
                  hadSelectionStart &&
                  event.currentTarget.hasPointerCapture(event.pointerId)
                ) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
              }}
            >
              {isLoading ? (
                <div
                  className="space-y-2 p-3"
                  aria-busy="true"
                  aria-label={copy.loadingStructureTitle}
                >
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-4 rounded-sm" />
                    <Skeleton className="h-4 w-28 rounded-sm" />
                  </div>
                  <div className="flex items-center gap-2 pl-4">
                    <Skeleton className="size-4 rounded-sm" />
                    <Skeleton className="h-4 w-36 rounded-sm" />
                  </div>
                  <div className="flex items-center gap-2 pl-8">
                    <Skeleton className="size-4 rounded-sm" />
                    <Skeleton className="h-4 w-24 rounded-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-4 rounded-sm" />
                    <Skeleton className="h-4 w-32 rounded-sm" />
                  </div>
                </div>
              ) : null}
              {!isLoading && isTemporaryFileView ? (
                <TemporaryFilesView
                  copy={copy}
                  workflow={workflow}
                  selectedPaperId={selectedPaperId}
                  highlightedPaperId={highlightedPaperId}
                  onSelect={(item) => {
                    clearMultiSelectedItemIds();
                    setSelectedNodeId(item.nodeId);
                    onSelectPaper?.(item.id, item.nodeId);
                  }}
                />
              ) : null}
              {!isLoading &&
              !isTemporaryFileView &&
              (workflow.length > 0 || isAddingRoot) ? (
                <SidebarGroup className="min-w-0 py-0">
                  <SidebarGroupContent className="min-w-0 overflow-hidden">
                    {isAddingRoot ? (
                      <SidebarMenu className="grid min-w-0 gap-0.5 overflow-x-hidden">
                        <InlineCreateNodeRow
                          copy={copy}
                          parent={null}
                          rootNodes={workflow}
                          isPending={createNodePending}
                          onCreate={(values) => {
                            setIsAddingRoot(false);
                            createNode(values);
                          }}
                          onClose={() => setIsAddingRoot(false)}
                        />
                      </SidebarMenu>
                    ) : null}
                    {workflow.length > 0 ? (
                      <WorkbenchDirectoryTree
                        workflow={workflow}
                        expandedNodeIds={expandedNodeIds}
                        rowProps={rowProps}
                        onExpandedNodeIdsChange={setExpandedNodeIds}
                      />
                    ) : null}
                  </SidebarGroupContent>
                </SidebarGroup>
              ) : null}
              {!isLoading &&
              !isTemporaryFileView &&
              workflow.length === 0 &&
              !isAddingRoot ? (
                <EmptyState
                  title={copy.emptyStructureTitle}
                  description={copy.emptyStructureDescription}
                />
              ) : null}
              <div className="min-h-8 flex-1" aria-hidden="true" />
              {selectionRect ? (
                <DirectorySelectionBox rect={selectionRect} />
              ) : null}
              {rootMenuPosition ? (
                <RootDirectoryContextMenu
                  copy={copy}
                  disabled={createNodePending}
                  left={rootMenuPosition.left}
                  top={rootMenuPosition.top}
                  onAddPhase={startAddingRootNode}
                />
              ) : null}
            </div>
          </SidebarContent>
        )}
        {!panelCollapsed && onPanelToggle ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={panelToggleLabel}
            aria-expanded="true"
            data-slot="sidebar-rail"
            data-testid="directory-panel-rail"
            data-state="expanded"
            className="group/rail absolute !top-1/2 right-0 !bottom-auto z-30 flex !h-12 w-5 -translate-y-1/2 cursor-pointer items-center justify-end rounded-none border-0 bg-transparent p-0 text-foreground shadow-none transition-colors duration-200 ease-out hover:bg-transparent hover:text-foreground focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none aria-expanded:bg-transparent aria-expanded:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5"
            onClick={onPanelToggle}
          >
            <span
              data-testid="directory-panel-waterdrop"
              className="pointer-events-none relative flex h-11 w-5 items-center justify-center rounded-l-md rounded-r-none border border-r-0 border-primary/35 bg-primary/15 text-primary opacity-100 shadow-sm shadow-primary/15 transition-[background-color,border-color,box-shadow,color] duration-200 ease-out group-hover/rail:border-primary/45 group-hover/rail:bg-primary/20 group-hover/rail:text-primary group-focus-visible/rail:border-primary/45 group-focus-visible/rail:bg-primary/20 group-focus-visible/rail:text-primary group-focus-visible/rail:ring-3 group-focus-visible/rail:ring-primary/20 motion-reduce:transition-none"
            >
              <ChevronLeft className="opacity-85" />
            </span>
          </Button>
        ) : null}
      </Sidebar>
    </SidebarProvider>
  );
}

function RootDirectoryContextMenu({
  copy,
  disabled,
  left,
  top,
  onAddPhase,
}: {
  copy: WorkbenchDirectoryCopy;
  disabled: boolean;
  left: number;
  top: number;
  onAddPhase: () => void;
}) {
  return (
    <DynamicBox
      role="menu"
      data-workbench-directory-context-menu="true"
      position={{ x: left, y: top }}
      className="fixed z-[80] min-w-44 rounded-md border border-border bg-popover p-1.5 text-sm text-popover-foreground shadow-xl shadow-foreground/15"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Button
        type="button"
        variant="ghost"
        size="default"
        role="menuitem"
        disabled={disabled}
        className="flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left transition hover:bg-workbench-row-hover disabled:cursor-not-allowed disabled:opacity-50"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!disabled) {
            onAddPhase();
          }
        }}
        onClick={onAddPhase}
      >
        <FolderPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 truncate">
          {copy.addPhase ?? defaultCopy.addPhase}
        </span>
      </Button>
    </DynamicBox>
  );
}

export function WorkbenchProjectSearch({
  copy,
  workflow,
  searchValue,
  onSearchChange,
  setSelectedNodeId,
  onSelectPaper,
  onLocatePaper,
  fileActionCopy,
  onFileAction,
  className,
}: {
  copy?: WorkbenchDirectoryCopy;
  workflow: WorkflowNode[];
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  setSelectedNodeId: (id: string) => void;
  onSelectPaper?: (paperId: string, nodeId: string) => void;
  onLocatePaper?: (
    paperId: string,
    nodeId: string,
    highlightId?: string
  ) => void;
  fileActionCopy?: WorkbenchSearchFileActionCopy;
  onFileAction?: (
    action: WorkbenchSearchFileAction,
    file: DirectoryFileListItem
  ) => void;
  className?: string;
}) {
  const resolvedCopy = copy ?? defaultCopy;
  const [localQuery, setLocalQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchShellRef = useRef<HTMLDivElement>(null);
  const query = searchValue ?? localQuery;
  const hasQuery = query.trim().length > 0;
  const searchResults = useMemo(
    () => searchWorkflow(workflow, query),
    [workflow, query]
  );
  const groupedSearchResults = useMemo(
    () => groupDirectorySearchResults(searchResults, resolvedCopy),
    [resolvedCopy, searchResults]
  );
  const updateQuery = (value: string) => {
    setIsSearchActive(true);
    if (onSearchChange) {
      onSearchChange(value);
    } else {
      setLocalQuery(value);
    }
  };
  const selectSearchResult = (result: DirectorySearchResult) => {
    if (result.kind === "directory") {
      setSelectedNodeId(result.id);
    } else {
      setSelectedNodeId(result.nodeId);
      if (onLocatePaper) {
        onLocatePaper(result.paperId, result.nodeId, result.id);
      } else {
        onSelectPaper?.(result.paperId, result.nodeId);
      }
    }
  };

  return (
    <div
      ref={searchContainerRef}
      className={cn("relative isolate w-full", className)}
    >
      <Autocomplete
        filter={null}
        itemToStringValue={(item: unknown) =>
          (item as DirectorySearchResult).label
        }
        items={groupedSearchResults}
        onOpenChange={(nextOpen) => setIsSearchActive(nextOpen)}
        onValueChange={(nextValue, details) => {
          if (details.reason !== "item-press") {
            updateQuery(nextValue);
          }
        }}
        open={hasQuery && isSearchActive}
        value={query}
      >
        <div
          ref={searchShellRef}
          className="project-wing-top-bar-search relative z-10 data-[open=true]:bg-card data-[open=true]:!shadow-md"
          data-open={hasQuery && isSearchActive}
          data-top-bar-search=""
          role="group"
        >
          <span aria-hidden="true" className="project-wing-top-bar-search-icon">
            <Search />
          </span>
          <AutocompleteInput
            aria-label={resolvedCopy.searchLabel}
            className="h-full rounded-full border-0 bg-transparent px-2.5 shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
            containerClassName="min-w-0 flex-1"
            onFocus={() => setIsSearchActive(true)}
            showClear
          />
        </div>
        {hasQuery && isSearchActive ? (
          <AutocompleteContent
            anchor={searchShellRef}
            className="rounded-t-[calc(var(--anchor-height)/2)] rounded-b-2xl border border-input bg-popover pt-(--anchor-height) ring-0"
            portalContainer={searchContainerRef}
            positionerClassName="z-0"
            positionMethod="fixed"
            sideOffset={({ anchor }) => -anchor.height}
          >
            {groupedSearchResults.length === 0 ? (
              <AutocompleteEmpty>
                {resolvedCopy.searchNoResults}
              </AutocompleteEmpty>
            ) : (
              <AutocompleteList
                className="not-empty:pt-0 not-empty:pb-4"
                scrollFade
              >
                {(group: DirectorySearchGroup) => (
                  <AutocompleteGroup
                    className="py-0"
                    items={group.items}
                    key={group.key}
                  >
                    <AutocompleteGroupLabel className="me-1.5 pt-2.5 pb-0.5 text-xs font-medium text-muted-foreground">
                      {group.group}
                    </AutocompleteGroupLabel>
                    <AutocompleteCollection>
                      {(result: DirectorySearchResult) => (
                        <AutocompleteItem
                          className="flex cursor-pointer items-center gap-2.5 rounded-lg"
                          key={`${result.kind}-${result.id}`}
                          onClick={() => selectSearchResult(result)}
                          value={result}
                        >
                          <SearchResultTypeIcon result={result} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate">{result.label}</div>
                          </div>
                          {result.kind === "file" &&
                          result.attachmentId &&
                          fileActionCopy &&
                          onFileAction ? (
                            <WorkbenchSearchFileActions
                              copy={fileActionCopy}
                              supportsMaster={result.supportsMaster}
                              onAction={(action) =>
                                onFileAction(action, result)
                              }
                            />
                          ) : null}
                        </AutocompleteItem>
                      )}
                    </AutocompleteCollection>
                  </AutocompleteGroup>
                )}
              </AutocompleteList>
            )}
          </AutocompleteContent>
        ) : null}
      </Autocomplete>
    </div>
  );
}

function _unused_DirectoryFileBucketTabs({
  copy,
  workflow,
  currentYear,
  value,
  onChange,
}: {
  copy: WorkbenchDirectoryCopy;
  workflow: WorkflowNode[];
  currentYear?: number;
  value: WorkingPaperBucket;
  onChange: (bucket: WorkingPaperBucket) => void;
}) {
  const _unused_resolvedCurrentYear = currentYear ?? new Date().getFullYear();
  const hasPriorFiles = hasWorkingPapersInBucket(workflow, "PRIOR");
  const shortLabels = copy.bucketShortLabels ??
    defaultCopy.bucketShortLabels ?? {
      CURRENT: "Current",
      PRIOR: "Prior",
      TEMPORARY: "Temp",
    };
  const filterLabel =
    copy.fileBucketFilterLabel ?? defaultCopy.fileBucketFilterLabel;
  const tabs = [
    { bucket: "CURRENT" as const, label: shortLabels.CURRENT },
    ...(hasPriorFiles
      ? [{ bucket: "PRIOR" as const, label: shortLabels.PRIOR }]
      : []),
    { bucket: "TEMPORARY" as const, label: shortLabels.TEMPORARY },
  ];

  return (
    <Tabs
      label={filterLabel}
      className="min-w-0 flex-1 rounded-lg border border-border/70 bg-background/80 p-0.5 shadow-sm shadow-foreground/5"
      value={value}
      onValueChange={(bucket) => onChange(bucket as WorkingPaperBucket)}
    >
      <TabsList className="grid h-7 w-full auto-cols-fr grid-flow-col rounded-md bg-muted/60 p-0.5">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.bucket}
            value={tab.bucket}
            className={cn(
              "relative inline-flex h-6 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap text-foreground/60 transition-all hover:text-foreground    focus-visible:outline-1 ",
              value === tab.bucket && "bg-background text-foreground shadow-sm"
            )}
          >
            <span className="truncate">{tab.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

function TemporaryFilesView({
  copy,
  highlightedPaperId,
  onSelect,
  selectedPaperId,
  workflow,
}: {
  copy: WorkbenchDirectoryCopy;
  highlightedPaperId?: string | null;
  onSelect: (item: DirectoryFileListItem) => void;
  selectedPaperId?: string | null;
  workflow: WorkflowNode[];
}) {
  const temporaryRootLabel = copy.bucketLabels.TEMPORARY;
  const files = useMemo(
    () =>
      collectBucketFileItems(workflow, "TEMPORARY", [temporaryRootLabel], {
        includeWorkflowPath: false,
      }),
    [temporaryRootLabel, workflow]
  );

  if (files.length === 0) {
    return (
      <EmptyState
        title={
          copy.temporaryFilesEmptyTitle ??
          defaultCopy.temporaryFilesEmptyTitle ??
          "No temporary files"
        }
        description={
          copy.temporaryFilesEmptyDescription ??
          defaultCopy.temporaryFilesEmptyDescription ??
          "Switch back to the audit year to view the main file tree."
        }
      />
    );
  }

  return (
    <SidebarGroup className="py-0">
      <SidebarGroupContent>
        <SidebarMenu className="grid gap-1">
          {files.map((item) => (
            <TemporaryFileRow
              key={item.id}
              item={item}
              isActive={selectedPaperId === item.id}
              isHighlighted={highlightedPaperId === item.id}
              onSelect={onSelect}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function TemporaryFileRow({
  isActive,
  isHighlighted,
  item,
  onSelect,
}: {
  isActive: boolean;
  isHighlighted: boolean;
  item: DirectoryFileListItem;
  onSelect: (item: DirectoryFileListItem) => void;
}) {
  const Icon = item.isSpreadsheet ? FileSpreadsheet : FileText;

  return (
    <SidebarMenuItem>
      <Button
        type="button"
        variant="ghost"
        size="default"
        data-active={isActive ? "true" : undefined}
        className={cn(
          "relative grid min-h-9 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition hover:bg-workbench-row-hover",
          isActive && "bg-workbench-active",
          isHighlighted &&
            "bg-[var(--brand-tint)]    hover:bg-[var(--brand-tint)]"
        )}
        onClick={() => onSelect(item)}
      >
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0">
          <DirectoryTruncatedTooltip
            content={item.label}
            className="block truncate font-normal"
          >
            {item.label}
          </DirectoryTruncatedTooltip>
          <DirectoryTruncatedTooltip
            content={item.path}
            className="mt-0.5 block truncate text-xs text-muted-foreground"
          >
            {item.path}
          </DirectoryTruncatedTooltip>
        </span>
      </Button>
    </SidebarMenuItem>
  );
}

function hasWorkingPapersInBucket(
  nodes: WorkflowNode[],
  bucket: WorkingPaperBucket
): boolean {
  return nodes.some(
    (node) =>
      node.workingPapers?.some(
        (paper) => (paper.bucket ?? DEFAULT_FILE_BUCKET) === bucket
      ) || hasWorkingPapersInBucket(node.children ?? [], bucket)
  );
}

type DirectorySelectionRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

function makeDirectorySelectionRect(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): DirectorySelectionRect {
  const left = Math.min(startX, endX);
  const right = Math.max(startX, endX);
  const top = Math.min(startY, endY);
  const bottom = Math.max(startY, endY);
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

function doDirectoryRectsIntersect(
  rect: DirectorySelectionRect,
  target: DOMRect
) {
  return (
    rect.left <= target.right &&
    rect.right >= target.left &&
    rect.top <= target.bottom &&
    rect.bottom >= target.top
  );
}

function DirectorySelectionBox({ rect }: { rect: DirectorySelectionRect }) {
  return (
    <DynamicBox
      className="pointer-events-none fixed z-40 border border-primary/70 bg-primary/10"
      position={{ x: rect.left, y: rect.top }}
      width={rect.width}
      height={rect.height}
    />
  );
}

function findPathToNode(
  nodes: WorkflowNode[],
  nodeId: string | null
): string[] {
  if (!nodeId) {
    return [];
  }
  for (const node of nodes) {
    if (node.id === nodeId) {
      return [node.id];
    }
    const childPath = findPathToNode(node.children ?? [], nodeId);
    if (childPath.length > 0) {
      return [node.id, ...childPath];
    }
  }
  return [];
}

type DirectorySearchResult =
  | {
      kind: "directory";
      id: string;
      label: string;
      path: string;
    }
  | {
      kind: "file";
      id: string;
      paperId: string;
      nodeId: string;
      label: string;
      path: string;
      isSpreadsheet: boolean;
      attachmentId: string | null;
      supportsMaster: boolean;
    };

type DirectorySearchGroup = {
  key: "directories" | "files";
  group: string;
  items: DirectorySearchResult[];
};

type DirectoryFileListItem = Extract<DirectorySearchResult, { kind: "file" }>;

function groupDirectorySearchResults(
  results: DirectorySearchResult[],
  copy: WorkbenchDirectoryCopy
): DirectorySearchGroup[] {
  return [
    {
      key: "directories" as const,
      group: copy.searchDirectoryKind ?? defaultCopy.searchDirectoryKind,
      items: results.filter((result) => result.kind === "directory"),
    },
    {
      key: "files" as const,
      group: copy.searchFileKind ?? defaultCopy.searchFileKind,
      items: results.filter((result) => result.kind === "file"),
    },
  ].filter((group) => group.items.length > 0);
}

function SearchResultTypeIcon({ result }: { result: DirectorySearchResult }) {
  if (result.kind === "file") {
    return <ProjectFileTypeIcon fileName={result.label} />;
  }

  return <Folder aria-hidden="true" className="size-4 text-muted-foreground" />;
}

function searchWorkflow(
  nodes: WorkflowNode[],
  query: string
): DirectorySearchResult[] {
  const normalizedQuery = normalizeSearchQuery(query);
  const compactQuery = normalizeSearchCompact(query);
  if (!normalizedQuery) {
    return [];
  }
  return collectSearchResults(nodes, normalizedQuery, compactQuery, []);
}

function collectSearchResults(
  nodes: WorkflowNode[],
  query: string,
  compactQuery: string,
  ancestors: string[]
): DirectorySearchResult[] {
  return nodes.flatMap((node) => {
    const pathSegments = [...ancestors, formatPathSegment(node)];
    const path = pathSegments.join(" / ");
    const nodeLabel = formatNodeSearchLabel(node);
    const directoryResults: DirectorySearchResult[] = matchesSearch(
      [node.code, node.title, nodeLabel],
      query,
      compactQuery
    )
      ? [
          {
            kind: "directory",
            id: node.id,
            label: nodeLabel,
            path: ancestors.join(" / "),
          },
        ]
      : [];
    const fileResults: DirectorySearchResult[] = (
      node.workingPapers ?? []
    ).flatMap((paper) => {
      const primaryAttachment = paper.attachments?.[0] ?? null;
      const paperCode = formatDisplayName(paper.code);
      const fileName = formatDisplayName(
        primaryAttachment?.originalName ?? paper.title
      );
      if (!matchesSearch([paperCode, fileName, path], query, compactQuery)) {
        return [];
      }
      return [
        {
          kind: "file" as const,
          id: primaryAttachment?.id ?? paper.id,
          paperId: paper.id,
          nodeId: node.id,
          label: fileName,
          path,
          isSpreadsheet: isSpreadsheetFileName(
            primaryAttachment?.originalName ??
              primaryAttachment?.fileName ??
              paper.title
          ),
          attachmentId: primaryAttachment?.id ?? null,
          supportsMaster: isProjectWingMasterSupportedFileName(
            primaryAttachment?.originalName ??
              primaryAttachment?.fileName ??
              paper.title
          ),
        },
      ];
    });

    return [
      ...directoryResults,
      ...fileResults,
      ...collectSearchResults(
        node.children ?? [],
        query,
        compactQuery,
        pathSegments
      ),
    ];
  });
}

function collectBucketFileItems(
  nodes: WorkflowNode[],
  bucket: WorkingPaperBucket,
  ancestors: string[],
  options: { includeWorkflowPath?: boolean } = {}
): DirectoryFileListItem[] {
  const includeWorkflowPath = options.includeWorkflowPath ?? true;
  return nodes.flatMap((node) => {
    const pathSegments = includeWorkflowPath
      ? [...ancestors, formatPathSegment(node)]
      : ancestors;
    const path = pathSegments.join(" / ");
    const nodeFiles: DirectoryFileListItem[] = (node.workingPapers ?? [])
      .filter((paper) => (paper.bucket ?? DEFAULT_FILE_BUCKET) === bucket)
      .map((paper) => {
        const primaryAttachment = paper.attachments?.find(
          (attachment) => !attachment.deletedAt
        );
        const fileName = formatDisplayName(
          primaryAttachment?.originalName ?? paper.title
        );
        return {
          kind: "file",
          id: paper.id,
          paperId: paper.id,
          nodeId: node.id,
          label: fileName,
          path,
          isSpreadsheet: isSpreadsheetFileName(
            primaryAttachment?.originalName ??
              primaryAttachment?.fileName ??
              paper.title
          ),
          attachmentId: primaryAttachment?.id ?? null,
          supportsMaster: isProjectWingMasterSupportedFileName(
            primaryAttachment?.originalName ??
              primaryAttachment?.fileName ??
              paper.title
          ),
        };
      });

    return [
      ...nodeFiles,
      ...collectBucketFileItems(node.children ?? [], bucket, pathSegments, {
        includeWorkflowPath,
      }),
    ];
  });
}

function matchesSearch(fields: string[], query: string, compactQuery: string) {
  return fields.some((field) => {
    const normalizedField = normalizeSearchQuery(field);
    return (
      normalizedField.includes(query) ||
      normalizeSearchCompact(normalizedField).includes(compactQuery)
    );
  });
}

function isSpreadsheetFileName(fileName: string) {
  return /\.(xlsx|xls|xlsm|xlsb|csv)$/i.test(fileName.trim());
}

function normalizeSearchQuery(value: string) {
  return value.trim().toLowerCase();
}

function normalizeSearchCompact(value: string) {
  return normalizeSearchQuery(value).replaceAll(/\s+/g, "");
}

function formatPathSegment(node: WorkflowNode) {
  return formatDisplayName(node.code);
}

function formatNodeSearchLabel(node: WorkflowNode) {
  if (!node.title || node.title === node.code) {
    return formatDisplayName(node.code);
  }

  return `${formatDisplayName(node.code)} - ${formatDisplayName(node.title)}`;
}

function findPathToPaper(nodes: WorkflowNode[], paperId: string): string[] {
  for (const node of nodes) {
    if (
      node.workingPapers?.some(
        (paper) =>
          paper.id === paperId ||
          paper.attachments?.some((attachment) => attachment.id === paperId)
      )
    ) {
      return [node.id];
    }
    const childPath = findPathToPaper(node.children ?? [], paperId);
    if (childPath.length > 0) {
      return [node.id, ...childPath];
    }
  }
  return [];
}
