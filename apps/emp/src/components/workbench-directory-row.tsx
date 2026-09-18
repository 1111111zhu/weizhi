"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  formatNumberWithoutDigitFour,
  normalizeCodeWithoutDigitFour,
} from "@project-wing/shared";
import type { WorkingPaperBucket } from "@project-wing/shared";
import {
  Button as MobileButton,
  Input as MobileInput,
  MobileActionSheet,
} from "@project-wing/ui";
import {
  Archive,
  ChevronRight,
  ClipboardCopy,
  ClipboardPaste,
  FileText,
  Folder,
  MoreHorizontal,
  Check,
  Pencil,
  Plus,
  Scissors,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode, Ref } from "react";

import { TreeItemLabel } from "@/components/reui/tree";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { WorkflowNode } from "../api/client";
import { getDirectoryMobileCopy } from "../i18n/directory-mobile";
import { formatDisplayName } from "../lib/project-layout";
import { cn } from "../lib/utils";
import {
  WORKBENCH_FILE_DIRECTORY_DROP_TYPE,
  getWorkbenchDirectoryDropId,
} from "../lib/workbench-file-dnd";
import {
  buildNextRootWorkflowFolderCode,
  buildNextWorkflowFolderCode,
  parseHierarchicalNumericCode,
} from "../lib/workbench-folder-upload";
import { SidebarMenuButton, SidebarMenuItem, SidebarMenuSub } from "./sidebar";
import type { WorkbenchDirectoryCopy } from "./workbench-directory";

import mobileStyles from "./workbench-directory-mobile.module.css";
import styles from "./workbench-directory-row.module.css";

const EMPTY_DEFAULT_ARRAY: never[] = [];

export type DirectoryNodeForm = { code: string; title: string };
export type DirectoryNodeRename = { code: string; title: string };

export type DirectoryNodeRowProps = {
  mobileLocale?: string;
  onBrowse?: () => void;
  mobileDescription?: string;
  mobileLabel?: string;
  copy: WorkbenchDirectoryCopy;
  node: WorkflowNode;
  parentNodeId?: string | null;
  siblingIndex?: number;
  parentDisplayCode?: string;
  selectedNodeId: string | null;
  ancestorNodeIds?: Set<string>;
  addNodeTarget: WorkflowNode | null;
  isCreatingDirectory?: boolean;
  expandedNodeIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleExpanded: (id: string) => void;
  onStartAdd: (node: WorkflowNode) => void;
  onCloseAdd: () => void;
  createNode: (values: DirectoryNodeForm) => void;
  createNodePending: boolean;
  onRename?: (node: WorkflowNode, values: DirectoryNodeRename) => void;
  renameNodePending?: boolean;
  onDelete: (node: WorkflowNode) => void;
  deleteNodePending: boolean;
  onUploadFile?: (
    node: WorkflowNode,
    bucket: WorkingPaperBucket,
    file: File
  ) => void;
  onExportNode?: (node: WorkflowNode) => void;
  onAfterUploadToBucket?: (bucket: WorkingPaperBucket) => void;
  uploadFilePending?: boolean;
  showFiles?: boolean;
  visibleFileBucket?: WorkingPaperBucket;
  selectedPaperId?: string | null;
  highlightedPaperId?: string | null;
  onSelectPaper?: (paperId: string, nodeId: string) => void;
  clipboardFile?: DirectoryFileClipboard | null;
  onSetClipboardFile?: (file: DirectoryFileClipboard) => void;
  clipboardNode?: DirectoryNodeClipboard | null;
  onSetClipboardNode?: (node: DirectoryNodeClipboard) => void;
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
    target: WorkflowNode
  ) => void;
  onMoveNodeToNode?: (
    source: DirectoryNodeTransfer,
    target: WorkflowNode
  ) => void;
  relocateFilePending?: boolean;
  multiSelectedItemIds?: Set<string>;
  onToggleMultiSelectItem?: (itemId: string) => void;
  onNodeContextMenuOpenChange?: (nodeId: string, open: boolean) => void;
  onClearSelection?: () => void;
  forceOpen?: boolean;
  flat?: boolean;
  isExpanded?: boolean;
  readOnly?: boolean;
};

type DirectoryWorkingPaper = WorkflowNode["workingPapers"][number];

export type DirectoryFileTransfer = {
  attachmentId: string;
  bucket: WorkingPaperBucket;
  fileName: string;
  nodeId: string;
  paperId: string;
};

export type DirectoryFileClipboard = {
  file: DirectoryFileTransfer;
  files?: DirectoryFileTransfer[];
  mode: "copy" | "move";
};

export type DirectoryNodeTransfer = {
  nodeId: string;
  parentId?: string | null;
  code: string;
  title: string;
};

export type DirectoryNodeClipboard = {
  node: WorkflowNode;
  mode: "copy" | "move";
};

export function DirectoryNodeRow(props: DirectoryNodeRowProps) {
  const { copy, node } = props;
  const displayNode = getDirectoryDisplayNode(
    node,
    props.siblingIndex,
    props.parentDisplayCode
  );
  const displayCode = displayNode.code;
  const currentRenameCode = displayNode.code;
  const currentRenameTitle =
    getVisibleNodeTitle(displayNode) || displayNode.code;
  const parentNodeId = node.parentId ?? props.parentNodeId ?? null;
  const isSelected = props.selectedNodeId === node.id;
  const isAncestorSelected = Boolean(
    !isSelected && props.ancestorNodeIds?.has(node.id)
  );
  const nodeSelectionId = `node:${node.id}`;
  const isMultiSelected = props.multiSelectedItemIds?.has(nodeSelectionId);
  const isPathActive = Boolean(
    !isMultiSelected && (isSelected || isAncestorSelected)
  );
  const canAddChild = !props.readOnly;
  const canDelete = !props.readOnly && node.level >= 1;
  const canRename = !props.readOnly && Boolean(props.onRename);
  const visibleFiles = getVisibleFiles(
    node.workingPapers ?? [],
    props.showFiles,
    props.visibleFileBucket
  );
  const hasNestedItems = Boolean(
    node.children?.length || visibleFiles.length > 0
  );
  const isExpanded =
    props.isExpanded ?? props.forceOpen ?? props.expandedNodeIds.has(node.id);
  const isAddingChild = props.addNodeTarget?.id === node.id && canAddChild;
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const pendingMobileAction = useRef<(() => void) | null>(null);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameCodeDraft, setRenameCodeDraft] = useState(currentRenameCode);
  const [renameTitleDraft, setRenameTitleDraft] = useState(currentRenameTitle);
  const isNodeActive = Boolean(
    isMultiSelected || isSelected || isContextMenuOpen
  );
  const canReceiveDraggedFile = Boolean(
    !props.readOnly && props.onMoveFileToNode
  );
  const { isOver: isDraggedFileOver, setNodeRef: setDropNodeRef } =
    useDroppable({
      id: getWorkbenchDirectoryDropId(node.id),
      disabled: !canReceiveDraggedFile,
      data: {
        type: WORKBENCH_FILE_DIRECTORY_DROP_TYPE,
        workflowNodeId: node.id,
      },
    });

  useEffect(() => {
    if (!isRenameDialogOpen) {
      setRenameCodeDraft(currentRenameCode);
      setRenameTitleDraft(currentRenameTitle);
    }
  }, [currentRenameCode, currentRenameTitle, isRenameDialogOpen]);

  const openRenameDialog = () => {
    setRenameCodeDraft(currentRenameCode);
    setRenameTitleDraft(currentRenameTitle);
    setIsRenameDialogOpen(true);
  };
  const submitRename = () => {
    const nextRename = {
      code: renameCodeDraft.trim(),
      title: renameTitleDraft.trim() || renameCodeDraft.trim(),
    };
    if (
      nextRename.code === currentRenameCode.trim() &&
      nextRename.title === currentRenameTitle.trim()
    ) {
      setRenameCodeDraft(currentRenameCode);
      setRenameTitleDraft(currentRenameTitle);
    } else if (
      nextRename.code &&
      (nextRename.code !== node.code || nextRename.title !== node.title)
    ) {
      props.onRename?.(node, nextRename);
    } else {
      setRenameCodeDraft(currentRenameCode);
      setRenameTitleDraft(currentRenameTitle);
    }
    setIsRenameDialogOpen(false);
  };
  const closeRenameDialog = () => {
    setRenameCodeDraft(currentRenameCode);
    setRenameTitleDraft(currentRenameTitle);
    setIsRenameDialogOpen(false);
  };
  const handleContextMenuOpenChange = (open: boolean) => {
    setIsContextMenuOpen(open);
    props.onNodeContextMenuOpenChange?.(node.id, open);
  };
  const canPasteClipboardFile = Boolean(
    !props.readOnly &&
    props.clipboardFile &&
    (props.clipboardFile.mode === "move"
      ? props.onMoveFileToNode
      : props.onCopyFileToNode)
  );
  const canReceiveClipboardFile = Boolean(
    !props.readOnly && (props.onCopyFileToNode || props.onMoveFileToNode)
  );
  const canSetClipboardNode = Boolean(
    !props.readOnly && props.onSetClipboardNode
  );
  const canPasteClipboardNode = Boolean(
    !props.readOnly &&
    props.clipboardNode &&
    props.clipboardNode.node.id !== node.id &&
    !containsWorkflowNode(props.clipboardNode.node, node.id) &&
    (props.clipboardNode.mode === "move"
      ? props.onMoveNodeToNode
      : props.onCopyNodeToNode)
  );
  const canReceiveClipboardNode = Boolean(
    !props.readOnly && (props.onCopyNodeToNode || props.onMoveNodeToNode)
  );
  const canOpenNodeMenu =
    Boolean(props.mobileLocale && (canAddChild || canDelete)) ||
    Boolean(props.onExportNode) ||
    canRename ||
    canSetClipboardNode ||
    canPasteClipboardFile ||
    canPasteClipboardNode ||
    canReceiveClipboardFile ||
    canReceiveClipboardNode;
  const nodeMenuItems = canOpenNodeMenu
    ? buildNodeMenuItems({
        clipboardFile: props.clipboardFile,
        clipboardNode: props.clipboardNode,
        closeMenu: () => {},
        node,
        onExportNode: props.onExportNode,
        exportFolderLabel: copy.exportFolderAction ?? "Export folder",
        onCopyFileToNode: props.onCopyFileToNode,
        onCopyNodeToNode: props.onCopyNodeToNode,
        onMoveFileToNode: props.onMoveFileToNode,
        onMoveNodeToNode: props.onMoveNodeToNode,
        onSetClipboardNode: props.onSetClipboardNode,
        copyLabel: copy.clipboardCopyAction ?? "Copy",
        moveLabel: copy.clipboardMoveAction ?? "Cut",
        pasteLabel: copy.clipboardPasteAction ?? "Paste",
        renameLabel: canRename ? getRenameLabel(copy, node) : undefined,
        onRename: canRename ? openRenameDialog : undefined,
        relocatePending: props.relocateFilePending,
        addChildLabel: canAddChild ? getAddChildLabel(copy) : undefined,
        addChildDisabled: props.createNodePending,
        onAddChild: canAddChild
          ? () => {
              props.onStartAdd(node);
              if (!isExpanded) {
                props.onToggleExpanded(node.id);
              }
            }
          : undefined,
        deleteLabel: canDelete ? getDeleteLabel(copy, node) : undefined,
        deleteDisabled: props.deleteNodePending,
        onDelete: canDelete ? () => props.onDelete(node) : undefined,
      })
    : [];
  const flatNodeLabel = (
    <span ref={setDropNodeRef} className="block w-full">
      <TreeItemLabel
        data-directory-ancestor-active={
          isAncestorSelected && !isMultiSelected ? "true" : undefined
        }
        data-directory-file-drop-target={canReceiveDraggedFile || undefined}
        data-directory-selectable-id={nodeSelectionId}
        data-directory-node-id={node.id}
        data-directory-node-level={node.level}
        data-directory-node-parent-id={parentNodeId ?? ""}
        data-directory-node-row="true"
        data-drag-over={isDraggedFileOver || undefined}
        data-active={isNodeActive}
        draggable={false}
        aria-expanded={hasNestedItems ? isExpanded : undefined}
        className={cn(
          "relative isolate z-0 w-full min-w-0 overflow-hidden bg-transparent hover:bg-transparent before:absolute before:inset-x-0 before:-inset-y-0.5 before:-z-10 before:bg-workbench-sidebar",
          styles.flatRow,
          isDraggedFileOver && styles.flatDropTarget
        )}
      >
        <span className="flex w-full min-w-0 flex-1 items-center gap-2">
          <NodeIcon
            node={node}
            isPathActive={isPathActive || isContextMenuOpen}
          />
          <DirectoryTruncatedTooltip
            content={formatNodeLabel(displayNode)}
            className="block min-w-0 flex-1 truncate"
          >
            <DirectoryNodeIdentity node={displayNode} />
          </DirectoryTruncatedTooltip>
        </span>
      </TreeItemLabel>
    </span>
  );
  const renameCancelLabel = props.mobileLocale
    ? getDirectoryMobileCopy(props.mobileLocale).cancel
    : (copy.cancelRename ?? "Cancel");
  const RenameInput = props.mobileLocale ? MobileInput : Input;
  const RenameButton = props.mobileLocale ? MobileButton : Button;
  const renameForm = (
    <form
      className={props.mobileLocale ? mobileStyles.rename : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        submitRename();
      }}
    >
      <FieldGroup>
        <div className="grid grid-cols-[10rem_minmax(0,1fr)] gap-3">
          <Field>
            <FieldLabel htmlFor={`rename-directory-code-${node.id}`}>
              {copy.referenceCode}
            </FieldLabel>
            <RenameInput
              autoFocus
              id={`rename-directory-code-${node.id}`}
              disabled={props.renameNodePending}
              value={renameCodeDraft}
              onChange={(event) => setRenameCodeDraft(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`rename-directory-title-${node.id}`}>
              {copy.directoryName}
            </FieldLabel>
            <RenameInput
              id={`rename-directory-title-${node.id}`}
              disabled={props.renameNodePending}
              value={renameTitleDraft}
              onChange={(event) => setRenameTitleDraft(event.target.value)}
            />
          </Field>
        </div>
      </FieldGroup>
      <DialogFooter className="mt-5">
        <ButtonGroup label={getRenameLabel(copy, node)}>
          <RenameButton
            type="button"
            variant="outline"
            disabled={props.renameNodePending}
            onClick={closeRenameDialog}
          >
            {renameCancelLabel}
          </RenameButton>
          <RenameButton
            type="submit"
            disabled={
              props.renameNodePending ||
              (Boolean(props.mobileLocale) && !renameCodeDraft.trim())
            }
          >
            {getRenameLabel(copy, node)}
          </RenameButton>
        </ButtonGroup>
      </DialogFooter>
    </form>
  );
  const handleRenameOpenChange = (open: boolean) => {
    if (!open && !props.renameNodePending) {
      closeRenameDialog();
    }
  };
  const renameDialog = canRename ? (
    props.mobileLocale ? (
      <MobileActionSheet
        open={isRenameDialogOpen}
        onOpenChange={handleRenameOpenChange}
        title={getRenameLabel(copy, node)}
        closeLabel={getDirectoryMobileCopy(props.mobileLocale).close}
      >
        {renameForm}
      </MobileActionSheet>
    ) : (
      <Dialog open={isRenameDialogOpen} onOpenChange={handleRenameOpenChange}>
        <DialogContent
          closeLabel={renameCancelLabel}
          showCloseButton={!props.renameNodePending}
        >
          <DialogHeader>
            <DialogTitle>{getRenameLabel(copy, node)}</DialogTitle>
          </DialogHeader>
          {renameForm}
        </DialogContent>
      </Dialog>
    )
  ) : null;

  if (props.mobileLocale) {
    const mobileCopy = getDirectoryMobileCopy(props.mobileLocale);
    const label = formatNodeLabel(displayNode);
    return (
      <>
        <div
          className={mobileStyles.row}
          data-current={isSelected || undefined}
        >
          <MobileButton
            variant="quiet"
            className={mobileStyles.entry}
            aria-current={isSelected ? "location" : undefined}
            aria-label={[
              props.mobileLabel ?? label,
              isSelected ? mobileCopy.current : props.mobileDescription,
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() =>
              props.onBrowse ? props.onBrowse() : props.onSelect(node.id)
            }
          >
            {props.mobileLabel ? (
              <FileText aria-hidden />
            ) : (
              <Folder aria-hidden />
            )}
            <span className={mobileStyles.identity}>
              <strong>{props.mobileLabel ?? label}</strong>
              {props.mobileDescription || isSelected ? (
                <small>
                  {isSelected ? mobileCopy.current : props.mobileDescription}
                </small>
              ) : null}
            </span>
            {isSelected ? <Check aria-hidden /> : null}
            {props.onBrowse ? <ChevronRight aria-hidden /> : null}
          </MobileButton>
          {nodeMenuItems.length > 0 && (
            <MobileButton
              className={mobileStyles.more}
              size="icon"
              variant="quiet"
              aria-label={`${mobileCopy.more}: ${label}`}
              onClick={() => handleContextMenuOpenChange(true)}
            >
              <MoreHorizontal aria-hidden />
            </MobileButton>
          )}
        </div>
        <MobileActionSheet
          title={label}
          closeLabel={mobileCopy.close}
          open={isContextMenuOpen}
          onOpenChange={handleContextMenuOpenChange}
          onOpenChangeComplete={(open) => {
            if (!open) {
              const action = pendingMobileAction.current;
              pendingMobileAction.current = null;
              action?.();
            }
          }}
        >
          <div className={mobileStyles.actions}>
            {nodeMenuItems.map((item) => (
              <MobileButton
                key={item.label}
                variant={
                  item.label === getDeleteLabel(copy, node) ? "danger" : "quiet"
                }
                disabled={item.disabled}
                onClick={() => {
                  pendingMobileAction.current = item.onSelect;
                  handleContextMenuOpenChange(false);
                }}
              >
                {item.icon}
                {item.label}
              </MobileButton>
            ))}
          </div>
        </MobileActionSheet>
        {renameDialog}
      </>
    );
  }

  if (props.flat) {
    return (
      <>
        {canOpenNodeMenu ? (
          <ContextMenu onOpenChange={handleContextMenuOpenChange}>
            <ContextMenuTrigger
              className="flex w-full min-w-0"
              render={<span>{flatNodeLabel}</span>}
            />
            <DirectoryContextMenuContent items={nodeMenuItems} />
          </ContextMenu>
        ) : (
          flatNodeLabel
        )}
        {renameDialog}
      </>
    );
  }

  const nodeButton = (
    <SidebarMenuButton
      type="button"
      variant="tree"
      size="treeItem"
      isActive={isSelected && !isMultiSelected}
      draggable={false}
      aria-expanded={hasNestedItems ? isExpanded : undefined}
      data-directory-ancestor-active={
        isAncestorSelected && !isMultiSelected ? "true" : undefined
      }
      data-directory-selectable-id={nodeSelectionId}
      className={cn(
        "relative overflow-hidden",
        isMultiSelected &&
          cn("text-foreground shadow-sm shadow-foreground/5", styles.tintedRow),
        isAncestorSelected &&
          !isMultiSelected &&
          "text-foreground hover:bg-workbench-row-hover",
        isSelected &&
          !isMultiSelected &&
          cn(
            "text-foreground shadow-sm shadow-foreground/5",
            styles.selectedNodeRow,
            styles.tintedRow
          )
      )}
      onClick={() => {
        props.onSelect(node.id);
        if (hasNestedItems) {
          props.onToggleExpanded(node.id);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Delete" && canDelete) {
          event.preventDefault();
          props.onDelete(node);
        }
      }}
    >
      <span className="pointer-events-none flex min-w-0 flex-1 items-center">
        <span
          data-directory-row-content="true"
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <TreeChevron
            hasChildren={hasNestedItems}
            isOpen={isExpanded}
            isPathActive={isPathActive || isContextMenuOpen}
          />
          <NodeIcon node={node} isPathActive={isPathActive} />
          <DirectoryTruncatedTooltip
            content={formatNodeTitle(displayNode)}
            className="block min-w-0 flex-1 truncate font-medium"
          >
            <DirectoryNodeIdentity node={displayNode} />
          </DirectoryTruncatedTooltip>
        </span>
      </span>
    </SidebarMenuButton>
  );

  return (
    <>
      <SidebarMenuItem className="group/menu-item grid gap-1">
        <div
          className="relative flex min-w-0 items-center"
          data-directory-node-row="true"
          data-directory-node-id={node.id}
          data-directory-node-parent-id={parentNodeId ?? ""}
          data-directory-node-level={node.level}
        >
          {canOpenNodeMenu ? (
            <ContextMenu onOpenChange={handleContextMenuOpenChange}>
              <ContextMenuTrigger render={nodeButton} />
              <DirectoryContextMenuContent items={nodeMenuItems} />
            </ContextMenu>
          ) : (
            nodeButton
          )}
        </div>

        {!props.flat && (hasNestedItems || isAddingChild) ? (
          <SidebarMenuSub
            className={cn(
              "grid gap-0.5 overflow-hidden tree-sub",
              !isExpanded && "pointer-events-none"
            )}
            data-expanded={isExpanded}
          >
            <div className="tree-sub-inner grid gap-0.5">
              {visibleFiles.map((paper, index) => (
                <DirectoryFileRow
                  key={paper.id}
                  copy={copy}
                  node={node}
                  paper={paper}
                  displayIndex={index + 1}
                  isSelected={props.selectedPaperId === paper.id}
                  isHighlighted={props.highlightedPaperId === paper.id}
                  multiSelectedItemIds={props.multiSelectedItemIds}
                  onToggleMultiSelectItem={props.onToggleMultiSelectItem}
                  onSelectPaper={props.onSelectPaper}
                  onSetClipboardFile={
                    props.readOnly ? undefined : props.onSetClipboardFile
                  }
                  clipboardFile={props.clipboardFile}
                  clipboardNode={props.clipboardNode}
                  onCopyFileToNode={
                    props.readOnly ? undefined : props.onCopyFileToNode
                  }
                  onMoveFileToNode={
                    props.readOnly ? undefined : props.onMoveFileToNode
                  }
                  onCopyNodeToNode={
                    props.readOnly ? undefined : props.onCopyNodeToNode
                  }
                  onMoveNodeToNode={
                    props.readOnly ? undefined : props.onMoveNodeToNode
                  }
                  relocateFilePending={props.relocateFilePending}
                  onClearSelection={props.onClearSelection}
                  readOnly={props.readOnly}
                />
              ))}
              {node.children?.map((child, index) => (
                <DirectoryNodeRow
                  key={child.id}
                  {...props}
                  node={child}
                  parentNodeId={node.id}
                  siblingIndex={index + 1}
                  parentDisplayCode={displayCode}
                />
              ))}
              {isAddingChild ? (
                <InlineCreateNodeRow
                  copy={copy}
                  parent={displayNode}
                  isPending={props.createNodePending}
                  onCreate={(values) => props.createNode(values)}
                  onClose={() => props.onCloseAdd()}
                />
              ) : null}
            </div>
          </SidebarMenuSub>
        ) : null}
      </SidebarMenuItem>
      {renameDialog}
    </>
  );
}

export function DirectoryFileRow({
  copy,
  isHighlighted,
  isSelected,
  node,
  onSetClipboardFile,
  clipboardFile,
  clipboardNode,
  onCopyFileToNode,
  onMoveFileToNode,
  onCopyNodeToNode,
  onMoveNodeToNode,
  relocateFilePending,
  onSelectPaper,
  onClearSelection: _unused_onClearSelection,
  paper,
  displayIndex,
  multiSelectedItemIds,
  onToggleMultiSelectItem: _unused_onToggleMultiSelectItem,
  flat = false,
  readOnly = false,
}: {
  copy: WorkbenchDirectoryCopy;
  isHighlighted: boolean;
  isSelected: boolean;
  node: WorkflowNode;
  multiSelectedItemIds?: Set<string>;
  onToggleMultiSelectItem?: (itemId: string) => void;
  flat?: boolean;
  onSetClipboardFile?: (file: DirectoryFileClipboard) => void;
  clipboardFile?: DirectoryFileClipboard | null;
  clipboardNode?: DirectoryNodeClipboard | null;
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
    target: WorkflowNode
  ) => void;
  onMoveNodeToNode?: (
    source: DirectoryNodeTransfer,
    target: WorkflowNode
  ) => void;
  relocateFilePending?: boolean;
  onSelectPaper?: (paperId: string, nodeId: string) => void;
  onClearSelection?: () => void;
  paper: DirectoryWorkingPaper;
  displayIndex: number;
  readOnly?: boolean;
}) {
  const paperSelectionId = `paper:${paper.id}`;
  const isMultiSelected = multiSelectedItemIds?.has(paperSelectionId);
  const showMultiHighlight = Boolean(isMultiSelected && !isHighlighted);
  const primaryAttachment = paper.attachments?.find(
    (attachment) => !attachment.deletedAt
  );
  const fileName = formatDisplayName(
    primaryAttachment?.originalName ?? paper.title
  );
  const displayCode = formatRollingFileCode(paper.code, displayIndex);
  const fileLabel = displayCode ? `${displayCode} - ${fileName}` : fileName;
  const isSpreadsheet = isSpreadsheetFileName(
    primaryAttachment?.originalName ??
      primaryAttachment?.fileName ??
      paper.title
  );
  const fileTransfer = primaryAttachment
    ? {
        attachmentId: primaryAttachment.id,
        bucket: paper.bucket ?? "CURRENT",
        fileName,
        nodeId: node.id,
        paperId: paper.id,
      }
    : null;
  const rowRef = useRef<HTMLButtonElement | null>(null);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const canOpenFileMenu = Boolean(
    !readOnly && fileTransfer && onSetClipboardFile
  );
  const pasteItems =
    clipboardFile || clipboardNode
      ? buildNodeMenuItems({
          clipboardFile,
          clipboardNode,
          closeMenu: () => {},
          node,
          onCopyFileToNode,
          onCopyNodeToNode,
          onMoveFileToNode,
          onMoveNodeToNode,
          copyLabel: copy.clipboardCopyAction ?? "Copy",
          moveLabel: copy.clipboardMoveAction ?? "Cut",
          pasteLabel: copy.clipboardPasteAction ?? "Paste",
          relocatePending: relocateFilePending,
        })
      : [];
  useEffect(() => {
    if (!isHighlighted) {
      return;
    }
    if (flat) {
      const row = document.querySelector<HTMLElement>(
        `[data-directory-selectable-id="${paperSelectionId}"]`
      );
      if (typeof row?.scrollIntoView === "function") {
        row.scrollIntoView({
          block: "center",
          inline: "nearest",
        });
      }
      return;
    }
    if (typeof rowRef.current?.scrollIntoView !== "function") {
      return;
    }
    rowRef.current.scrollIntoView({
      block: "center",
      inline: "nearest",
    });
  }, [flat, isHighlighted, paperSelectionId]);

  const flatFileLabel = (
    <TreeItemLabel
      data-directory-selectable-id={paperSelectionId}
      data-active={
        isSelected || isContextMenuOpen || showMultiHighlight || isHighlighted
      }
      draggable={false}
      className={cn(
        "relative isolate z-0 w-full min-w-0 overflow-hidden bg-transparent hover:bg-transparent before:absolute before:inset-x-0 before:-inset-y-0.5 before:-z-10 before:bg-workbench-sidebar",
        styles.flatRow
      )}
    >
      <span className="flex w-full min-w-0 flex-1 items-center gap-2">
        <FileText className="pointer-events-none size-4 text-muted-foreground" />
        <DirectoryTruncatedTooltip
          content={fileLabel}
          className="block min-w-0 flex-1 truncate"
        >
          {fileLabel}
        </DirectoryTruncatedTooltip>
      </span>
    </TreeItemLabel>
  );
  const fileMenuItems = [
    ...pasteItems,
    {
      icon: <ClipboardCopy className="h-4 w-4" />,
      label: copy.clipboardCopyAction ?? "Copy",
      onSelect: () => {
        if (!fileTransfer || !onSetClipboardFile) {
          return;
        }
        onSetClipboardFile({
          file: fileTransfer,
          files: [fileTransfer],
          mode: "copy",
        });
      },
    },
    {
      icon: <Scissors className="h-4 w-4" />,
      label: copy.clipboardMoveAction ?? "Cut",
      onSelect: () => {
        if (!fileTransfer || !onSetClipboardFile) {
          return;
        }
        onSetClipboardFile({
          file: fileTransfer,
          files: [fileTransfer],
          mode: "move",
        });
      },
    },
  ];

  if (flat) {
    return canOpenFileMenu && fileTransfer && onSetClipboardFile ? (
      <ContextMenu onOpenChange={setIsContextMenuOpen}>
        <ContextMenuTrigger
          className="flex w-full min-w-0"
          render={<span>{flatFileLabel}</span>}
        />
        <DirectoryContextMenuContent items={fileMenuItems} />
      </ContextMenu>
    ) : (
      flatFileLabel
    );
  }

  return (
    <SidebarMenuItem className="grid gap-1">
      {canOpenFileMenu && fileTransfer && onSetClipboardFile ? (
        <ContextMenu onOpenChange={setIsContextMenuOpen}>
          <ContextMenuTrigger
            render={(triggerProps) => (
              <SidebarMenuButton
                {...triggerProps}
                ref={(element) => {
                  assignRef(triggerProps.ref, element);
                  rowRef.current = element;
                }}
                type="button"
                variant="tree"
                size="treeItem"
                isActive={isSelected && !showMultiHighlight && !isHighlighted}
                draggable={false}
                data-directory-selectable-id={paperSelectionId}
                className={cn(
                  triggerProps.className,
                  "relative overflow-hidden pl-7",
                  (showMultiHighlight || isHighlighted) &&
                    cn(
                      "bg-transparent text-foreground shadow-sm shadow-foreground/5 hover:bg-transparent before:pointer-events-none before:absolute before:inset-0 before:rounded-md after:pointer-events-none after:absolute after:inset-y-1 after:left-0 after:w-0.5 after:rounded-full after:bg-primary",
                      styles.fileHighlight
                    )
                )}
                onClick={(event) => {
                  if (flat) {
                    event.stopPropagation();
                  }
                  onSelectPaper?.(paper.id, node.id);
                  triggerProps.onClick?.(event);
                }}
              >
                {renderDirectoryFileRowContent({
                  displayCode,
                  fileName,
                  isSpreadsheet,
                })}
              </SidebarMenuButton>
            )}
          />
          <DirectoryContextMenuContent items={fileMenuItems} />
        </ContextMenu>
      ) : (
        <SidebarMenuButton
          ref={rowRef}
          type="button"
          variant="tree"
          size="treeItem"
          isActive={isSelected && !showMultiHighlight && !isHighlighted}
          draggable={false}
          data-directory-selectable-id={paperSelectionId}
          className={cn(
            "relative overflow-hidden pl-7",
            (showMultiHighlight || isHighlighted) &&
              cn(
                "bg-transparent text-foreground shadow-sm shadow-foreground/5 hover:bg-transparent before:pointer-events-none before:absolute before:inset-0 before:rounded-md after:pointer-events-none after:absolute after:inset-y-1 after:left-0 after:w-0.5 after:rounded-full after:bg-primary",
                styles.fileHighlight
              )
          )}
          onClick={(event) => {
            if (flat) {
              event.stopPropagation();
            }
            onSelectPaper?.(paper.id, node.id);
          }}
        >
          {renderDirectoryFileRowContent({
            displayCode,
            fileName,
            isSpreadsheet,
          })}
        </SidebarMenuButton>
      )}
    </SidebarMenuItem>
  );
}

function containsWorkflowNode(root: WorkflowNode, nodeId: string): boolean {
  if (root.id === nodeId) {
    return true;
  }
  return (root.children ?? []).some((child) =>
    containsWorkflowNode(child, nodeId)
  );
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) {
    return;
  }
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  ref.current = value;
}

function renderDirectoryFileRowContent({
  displayCode,
  fileName,
  isSpreadsheet,
}: {
  displayCode: string;
  fileName: string;
  isSpreadsheet: boolean;
}) {
  return (
    <span className="pointer-events-none flex min-w-0 flex-1 items-center">
      <span
        data-directory-row-content="true"
        className="flex min-w-0 flex-1 items-center gap-2"
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground opacity-85">
          <FileText className={cn("h-4 w-4", isSpreadsheet && "opacity-90")} />
        </span>
        <span className="shrink-0 font-mono text-[0.72rem] font-semibold text-muted-foreground">
          {displayCode}
        </span>
        <DirectoryTruncatedTooltip
          content={fileName}
          className="block min-w-0 flex-1 truncate font-medium"
        >
          {fileName}
        </DirectoryTruncatedTooltip>
      </span>
    </span>
  );
}

export function DirectoryTruncatedTooltip({
  children,
  className,
  content,
}: {
  children: ReactNode;
  className?: string;
  content: ReactNode;
}) {
  const [labelElement, setLabelElement] = useState<HTMLSpanElement | null>(
    null
  );
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const measureTruncation = useCallback(() => {
    if (!labelElement) {
      return;
    }

    const panel = labelElement.closest<HTMLElement>(
      '[data-slot="resizable-panel"]'
    );
    const isMeasurable =
      panel?.dataset.collapsed !== "true" &&
      panel?.getAttribute("aria-hidden") !== "true" &&
      getComputedStyle(labelElement).visibility !== "hidden" &&
      labelElement.clientWidth > 0 &&
      labelElement.getClientRects().length > 0;
    const nextIsTruncated =
      isMeasurable &&
      [labelElement, ...labelElement.querySelectorAll<HTMLElement>("*")].some(
        (element) =>
          element.clientWidth > 0 && element.scrollWidth > element.clientWidth
      );

    setIsTruncated(nextIsTruncated);
    if (!nextIsTruncated) {
      setIsTooltipOpen(false);
    }
  }, [labelElement]);

  useLayoutEffect(() => {
    if (!labelElement) {
      return;
    }
    measureTruncation();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureTruncation);
      return () => window.removeEventListener("resize", measureTruncation);
    }

    const resizeObserver = new ResizeObserver(measureTruncation);
    const panel = labelElement.closest<HTMLElement>(
      '[data-slot="resizable-panel"]'
    );
    resizeObserver.observe(labelElement);
    if (panel) {
      resizeObserver.observe(panel);
    }

    const mutationObserver = panel
      ? new MutationObserver(measureTruncation)
      : null;
    if (mutationObserver && panel) {
      mutationObserver.observe(panel, {
        attributeFilter: ["aria-hidden", "data-collapsed"],
        attributes: true,
      });
    }

    return () => {
      resizeObserver.disconnect();
      mutationObserver?.disconnect();
    };
  }, [content, labelElement, measureTruncation]);

  const label = (
    <span
      ref={setLabelElement}
      data-directory-truncated={isTruncated || undefined}
      className={className}
    >
      {children}
    </span>
  );

  return (
    <Tooltip
      onOpenChange={setIsTooltipOpen}
      open={isTruncated && isTooltipOpen}
    >
      <TooltipTrigger render={label} />
      {isTruncated ? (
        <TooltipContent align="start" side="right">
          {content}
        </TooltipContent>
      ) : null}
    </Tooltip>
  );
}

function buildNodeMenuItems({
  clipboardFile,
  clipboardNode,
  closeMenu,
  node,
  onExportNode,
  exportFolderLabel,
  onCopyFileToNode,
  onCopyNodeToNode,
  onMoveFileToNode,
  onMoveNodeToNode,
  onSetClipboardNode,
  copyLabel,
  moveLabel,
  pasteLabel,
  renameLabel,
  onRename,
  relocatePending,
  addChildLabel,
  addChildDisabled,
  onAddChild,
  deleteLabel,
  deleteDisabled,
  onDelete,
}: {
  clipboardFile?: DirectoryFileClipboard | null;
  clipboardNode?: DirectoryNodeClipboard | null;
  closeMenu: () => void;
  node: WorkflowNode;
  onExportNode?: (node: WorkflowNode) => void;
  exportFolderLabel?: string;
  onCopyFileToNode?: (
    file: DirectoryFileTransfer,
    node: WorkflowNode,
    files?: DirectoryFileTransfer[]
  ) => void;
  onCopyNodeToNode?: (
    source: DirectoryNodeTransfer,
    target: WorkflowNode
  ) => void;
  onMoveFileToNode?: (
    file: DirectoryFileTransfer,
    node: WorkflowNode,
    files?: DirectoryFileTransfer[]
  ) => void;
  onMoveNodeToNode?: (
    source: DirectoryNodeTransfer,
    target: WorkflowNode
  ) => void;
  onSetClipboardNode?: (node: DirectoryNodeClipboard) => void;
  copyLabel: string;
  moveLabel: string;
  pasteLabel: string;
  renameLabel?: string;
  onRename?: () => void;
  relocatePending?: boolean;
  addChildLabel?: string;
  addChildDisabled?: boolean;
  onAddChild?: () => void;
  deleteLabel?: string;
  deleteDisabled?: boolean;
  onDelete?: () => void;
}) {
  const items: {
    disabled?: boolean;
    icon: ReactNode;
    label: string;
    onSelect: () => void;
  }[] = [];
  let hasPasteItem = false;
  const canReceivePaste = Boolean(
    onCopyFileToNode || onMoveFileToNode || onCopyNodeToNode || onMoveNodeToNode
  );

  if (onAddChild && addChildLabel) {
    items.push({
      disabled: addChildDisabled,
      icon: <Plus className="h-4 w-4" />,
      label: addChildLabel,
      onSelect: () => {
        onAddChild();
        closeMenu();
      },
    });
  }

  if (onExportNode && exportFolderLabel) {
    items.push({
      icon: <Archive className="h-4 w-4" />,
      label: exportFolderLabel,
      onSelect: () => {
        onExportNode(node);
        closeMenu();
      },
    });
  }

  if (clipboardFile) {
    const isMove = clipboardFile.mode === "move";
    const action = isMove ? onMoveFileToNode : onCopyFileToNode;
    const files = clipboardFile.files?.length
      ? clipboardFile.files
      : [clipboardFile.file];
    if (action) {
      items.push({
        disabled: relocatePending,
        icon: <ClipboardPaste className="h-4 w-4" />,
        label: pasteLabel,
        onSelect: () => {
          action(files[0] ?? clipboardFile.file, node, files);
          closeMenu();
        },
      });
      hasPasteItem = true;
    }
  }

  if (
    clipboardNode &&
    clipboardNode.node.id !== node.id &&
    !containsWorkflowNode(clipboardNode.node, node.id)
  ) {
    const isMove = clipboardNode.mode === "move";
    const action = isMove ? onMoveNodeToNode : onCopyNodeToNode;
    if (action) {
      items.push({
        disabled: relocatePending,
        icon: <ClipboardPaste className="h-4 w-4" />,
        label: pasteLabel,
        onSelect: () => {
          action(
            {
              nodeId: clipboardNode.node.id,
              code: clipboardNode.node.code,
              title: clipboardNode.node.title,
            },
            node
          );
          closeMenu();
        },
      });
      hasPasteItem = true;
    }
  }

  if (!hasPasteItem && canReceivePaste) {
    items.push({
      disabled: true,
      icon: <ClipboardPaste className="h-4 w-4" />,
      label: pasteLabel,
      onSelect: () => {},
    });
  }

  if (onSetClipboardNode) {
    items.push(
      {
        icon: <ClipboardCopy className="h-4 w-4" />,
        label: copyLabel,
        onSelect: () => {
          onSetClipboardNode({ node, mode: "copy" });
          closeMenu();
        },
      },
      {
        icon: <Scissors className="h-4 w-4" />,
        label: moveLabel,
        onSelect: () => {
          onSetClipboardNode({ node, mode: "move" });
          closeMenu();
        },
      }
    );
  }

  if (onRename && renameLabel) {
    items.push({
      icon: <Pencil className="h-4 w-4" />,
      label: renameLabel,
      onSelect: () => {
        onRename();
        closeMenu();
      },
    });
  }

  if (onDelete && deleteLabel) {
    items.push({
      disabled: deleteDisabled,
      icon: <Trash2 className="h-4 w-4" />,
      label: deleteLabel,
      onSelect: () => {
        onDelete();
        closeMenu();
      },
    });
  }

  return items;
}

function DirectoryContextMenuContent({
  items,
}: {
  items: {
    disabled?: boolean;
    icon: ReactNode;
    label: string;
    onSelect: () => void;
  }[];
}) {
  const selectItem = (item: { disabled?: boolean; onSelect: () => void }) => {
    if (item.disabled) {
      return;
    }
    item.onSelect();
  };

  return (
    <ContextMenuContent className="w-44">
      {items.map((item, index) => (
        <ContextMenuItem
          key={`${item.label}-${index}`}
          disabled={item.disabled}
          onPointerDownCapture={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            selectItem(item);
          }}
        >
          <span className="shrink-0 text-muted-foreground">{item.icon}</span>
          <span className="min-w-0 truncate">{item.label}</span>
        </ContextMenuItem>
      ))}
    </ContextMenuContent>
  );
}

function isSpreadsheetFileName(fileName: string) {
  return /\.(xlsx|xls|xlsm|xlsb|csv)$/i.test(fileName.trim());
}

function NodeIcon({
  node,
  isPathActive = false,
}: {
  node: WorkflowNode;
  isPathActive?: boolean;
}) {
  const className = cn(
    "flex h-4 w-4 shrink-0 items-center justify-center",
    isPathActive ? "text-foreground" : "text-muted-foreground",
    node.level > 1 && !isPathActive && "opacity-85"
  );
  return (
    <span className={className} data-directory-node-icon="true">
      <Folder className="h-4 w-4" />
    </span>
  );
}

function _unused_IconButton({
  label,
  children,
  disabled,
  destructive = false,
  onClick,
}: {
  label: string;
  children: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      tooltip={label}
      disabled={disabled}
      className={cn(
        iconButtonClassName(),
        destructive && "hover:text-destructive"
      )}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </Button>
  );
}

function iconButtonClassName() {
  return "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-[background-color,color,opacity] duration-[var(--motion-fast)] ease-[var(--motion-ease)] hover:bg-workbench-row-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";
}

export function InlineCreateNodeRow({
  mobileLocale,
  copy,
  parent,
  rootNodes = EMPTY_DEFAULT_ARRAY,
  isPending,
  onCreate,
  onClose,
}: {
  mobileLocale?: string;
  copy: WorkbenchDirectoryCopy;
  parent: WorkflowNode | null;
  rootNodes?: WorkflowNode[];
  isPending: boolean;
  onCreate: (values: DirectoryNodeForm) => void;
  onClose: () => void;
}) {
  const defaultCode = parent
    ? parseHierarchicalNumericCode(parent.code)
      ? buildNextWorkflowFolderCode(parent)
      : buildNextChildCode(parent)
    : buildNextRootWorkflowFolderCode(rootNodes);
  const [codeDraft, setCodeDraft] = useState(defaultCode);
  const [titleDraft, setTitleDraft] = useState("");
  const codeInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    codeInputRef.current?.setSelectionRange(
      defaultCode.length,
      defaultCode.length
    );
    const input = titleInputRef.current;
    input?.focus();
  }, [defaultCode.length]);

  useEffect(() => {
    if (!isPending) {
      committedRef.current = false;
    }
  }, [isPending]);

  const submit = useCallback(() => {
    if (committedRef.current) {
      return;
    }
    const code = normalizeNodeCode(codeDraft.trim());
    const title = titleDraft.trim() || code;
    if (!code) {
      return;
    }
    committedRef.current = true;
    onCreate({ code, title });
  }, [codeDraft, onCreate, titleDraft]);

  useEffect(() => {
    if (mobileLocale) {
      return;
    }
    const saveOnOutsidePointer = (event: PointerEvent) => {
      if (isPending || formRef.current?.contains(event.target as Node)) {
        return;
      }
      if (codeDraft.trim()) {
        submit();
      } else {
        onClose();
      }
    };

    document.addEventListener("pointerdown", saveOnOutsidePointer, true);
    return () => {
      document.removeEventListener("pointerdown", saveOnOutsidePointer, true);
    };
  }, [codeDraft, isPending, mobileLocale, onClose, submit]);

  if (mobileLocale) {
    const mobileCopy = getDirectoryMobileCopy(mobileLocale);
    return (
      <form
        className={mobileStyles.form}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Field>
          <FieldLabel htmlFor="mobile-directory-code">
            {copy.referenceCode ?? "Reference code"}
          </FieldLabel>
          <MobileInput
            id="mobile-directory-code"
            ref={codeInputRef}
            value={codeDraft}
            disabled={isPending}
            onChange={(event) => {
              committedRef.current = false;
              setCodeDraft(event.target.value);
            }}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="mobile-directory-title">
            {copy.directoryName ?? "Directory name"}
          </FieldLabel>
          <MobileInput
            id="mobile-directory-title"
            ref={titleInputRef}
            value={titleDraft}
            disabled={isPending}
            onChange={(event) => {
              committedRef.current = false;
              setTitleDraft(event.target.value);
            }}
          />
        </Field>
        <div className={mobileStyles.formActions}>
          <MobileButton
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={onClose}
          >
            {mobileCopy.cancel}
          </MobileButton>
          <MobileButton
            type="submit"
            variant="primary"
            loading={isPending}
            disabled={isPending || !codeDraft.trim()}
          >
            {mobileCopy.confirm}
          </MobileButton>
        </div>
      </form>
    );
  }

  return (
    <SidebarMenuItem className="grid gap-1">
      <form
        role="presentation"
        ref={formRef}
        className="flex h-8 min-w-0 items-center gap-1.5 rounded-md bg-workbench-active/70 px-2"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground opacity-35">
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground opacity-85">
          <Folder className="h-4 w-4" />
        </span>
        <Input
          ref={codeInputRef}
          label={getCreateLabel(copy, parent)}
          className="h-6 w-24 shrink-0 rounded-sm px-1.5 text-sm"
          disabled={isPending}
          placeholder={defaultCode}
          value={codeDraft}
          onChange={(event) => {
            committedRef.current = false;
            setCodeDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
          }}
        />
        <Input
          ref={titleInputRef}
          label={copy.directoryName ?? "Directory name"}
          className="h-6 min-w-0 flex-1 rounded-sm px-1.5 text-sm"
          disabled={isPending}
          placeholder={copy.directoryName ?? "Directory name"}
          value={titleDraft}
          onChange={(event) => {
            committedRef.current = false;
            setTitleDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
          }}
        />
      </form>
    </SidebarMenuItem>
  );
}

export function getVisibleFiles(
  papers: DirectoryWorkingPaper[],
  showFiles: boolean | undefined,
  visibleFileBucket: WorkingPaperBucket | undefined
) {
  if (!showFiles) {
    return [];
  }
  if (!visibleFileBucket) {
    return papers;
  }

  return papers.filter(
    (paper) => (paper.bucket ?? "CURRENT") === visibleFileBucket
  );
}

function getRenameLabel(copy: WorkbenchDirectoryCopy, node: WorkflowNode) {
  if (node.level === 1) {
    return copy.renamePhase ?? "Rename phase";
  }
  if (node.level === 2) {
    return copy.renameGroup;
  }
  return copy.renameWorkpaper;
}

function getAddChildLabel(copy: WorkbenchDirectoryCopy) {
  return copy.addGroup;
}

function getDeleteLabel(copy: WorkbenchDirectoryCopy, node: WorkflowNode) {
  if (node.level === 1) {
    return copy.deletePhase ?? "Delete phase";
  }
  if (node.level === 2) {
    return copy.deleteGroup;
  }
  return copy.deleteWorkpaper;
}

function getCreateLabel(
  copy: WorkbenchDirectoryCopy,
  parent: WorkflowNode | null
) {
  if (!parent) {
    return copy.newPhase ?? "New phase";
  }
  if (parent.level === 1) {
    return copy.newGroup;
  }
  return "New level";
}

function TreeChevron({
  hasChildren,
  isOpen,
  isPathActive = false,
}: {
  hasChildren: boolean;
  isOpen: boolean;
  isPathActive?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center",
        isPathActive ? "text-foreground" : "text-muted-foreground",
        !hasChildren && "opacity-35"
      )}
      data-directory-node-chevron="true"
      aria-hidden="true"
    >
      <ChevronRight
        className={cn(
          "h-3.5 w-3.5 transition-transform duration-[var(--motion-fast)] ease-[var(--motion-ease)] motion-reduce:transition-none",
          hasChildren && isOpen && "rotate-90"
        )}
      />
    </span>
  );
}

function buildNextChildCode(parent: WorkflowNode) {
  if (parent.level === 1) {
    return buildNextGroupCode(parent);
  }

  return buildNextPaperCode(parent);
}

function buildNextGroupCode(parent: WorkflowNode) {
  const children = parent.children ?? [];
  const prefix =
    inferPhasePrefix(parent.code) ?? inferGroupPrefix(children) ?? "A";
  const existingNumbers = children
    .map((child) =>
      normalizeCodeWithoutDigitFour(child.code).match(/^([A-Za-z]+)\s*(\d+)$/)
    )
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .filter((match) => match[1] === prefix)
    .map((match) => Number(match[2]));
  const nextValue =
    existingNumbers.length > 0
      ? Math.max(0, ...existingNumbers) + 1
      : children.length + 1;
  const nextNumber = formatNumberWithoutDigitFour(nextValue, 1);

  return `${prefix}${nextNumber}`;
}

function inferPhasePrefix(code: string) {
  const normalized = normalizeNodeCode(normalizeCodeWithoutDigitFour(code));
  const match = normalized.match(/^[A-Z]+$/);
  return match?.[0] ?? null;
}

function inferGroupPrefix(children: WorkflowNode[]) {
  for (const child of children) {
    const match = normalizeCodeWithoutDigitFour(child.code).match(
      /^([A-Za-z]+)\s*\d+$/
    );
    if (match) {
      return match[1];
    }
  }
  return null;
}

function buildNextPaperCode(parent: WorkflowNode) {
  const parentCode =
    parent.level <= 2
      ? getGeneratedPaperCodePrefix(parent.code)
      : normalizeNodeCode(normalizeCodeWithoutDigitFour(parent.code));
  const children = parent.children ?? [];
  const existingNumbers = children
    .map((child) =>
      normalizeNodeCode(normalizeCodeWithoutDigitFour(child.code)).match(
        new RegExp(`^${escapeRegExp(parentCode)}-(\\d+)$`)
      )
    )
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => Number(match[1]));
  const nextValue =
    existingNumbers.length > 0
      ? Math.max(0, ...existingNumbers) + 1000
      : (children.length + 1) * 1000;
  const nextNumber = formatNumberWithoutDigitFour(nextValue, 1, 1000);

  return `${parentCode}-${nextNumber}`;
}

function formatRollingFileCode(code: string, displayIndex: number) {
  const trimmed = code.trim().replaceAll(/\s*\.\s*/g, ".");
  if (/^(?:\d{1,4}|\d+(?:-\d+)+)\.\d+$/.test(trimmed)) {
    return trimmed;
  }
  const suffix = formatOrdinalWithoutDigitFour(displayIndex, 3);
  const normalized = normalizeCodeWithoutDigitFour(code);
  if (/-F\d+$/i.test(normalized)) {
    return normalized.replace(/-F\d+$/i, `-F${suffix}`);
  }
  return `${normalized}-F${suffix}`;
}

export function formatRollingNodeCode(node: WorkflowNode) {
  // Folder codes are user-controlled. Suggestions are generated only for new
  // Folders; existing nodes must always render the code stored by the API.
  return node.code;
}

export function getDirectoryDisplayNode(
  node: WorkflowNode,
  _siblingIndex?: number,
  _parentDisplayCode?: string
) {
  const canonicalNode = getCanonicalDirectoryNode(node);
  return canonicalNode;
}

function getCanonicalDirectoryNode(node: WorkflowNode) {
  const codeIsNumeric = Boolean(parseHierarchicalNumericCode(node.code));
  const titleIsNumeric = Boolean(parseHierarchicalNumericCode(node.title));
  if (codeIsNumeric || !titleIsNumeric) {
    return node;
  }

  return {
    ...node,
    code: node.title.trim(),
    title: node.code.trim(),
  };
}

function formatOrdinalWithoutDigitFour(
  ordinal: number,
  minLength: number,
  step = 1
) {
  const target = Math.max(1, Math.floor(ordinal));
  const increment = Math.max(1, Math.floor(step));
  let count = 0;
  let value = 0;
  while (count < target) {
    value += increment;
    if (!String(value).includes("4")) {
      count += 1;
    }
  }
  return String(value).padStart(minLength, "0");
}

function getGeneratedPaperCodePrefix(code: string) {
  const normalized = normalizeNodeCode(normalizeCodeWithoutDigitFour(code));
  const codeMatch = normalized.match(/^([A-Za-z]+\d+)/);
  if (codeMatch) {
    return codeMatch[1];
  }
  return normalized.split("-")[0] || normalized;
}

function normalizeNodeCode(code: string) {
  return code.replaceAll(/\s*-\s*/g, "-");
}

function escapeRegExp(value: string) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

export function formatNodeLabel(node: WorkflowNode) {
  return formatNodeTitle(node);
}

function DirectoryNodeIdentity({ node }: { node: WorkflowNode }) {
  const code = formatDisplayName(node.code);
  const title = getVisibleNodeTitle(node);
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-muted-foreground">{code}</span>
      {title ? <span className="truncate">{title}</span> : null}
    </span>
  );
}

function _unused_formatDirectoryCopy(
  template: string,
  values: Record<string, string>
) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template
  );
}

function formatNodeTitle(node: WorkflowNode) {
  const code = formatDisplayName(node.code);
  const title = getVisibleNodeTitle(node);
  if (!title) {
    return code;
  }

  return `${code} - ${title}`;
}

function getVisibleNodeTitle(node: WorkflowNode) {
  const code = formatDisplayName(node.code).trim();
  const title = formatDisplayName(node.title).trim();
  const titleWithoutCode = stripNodeTitleCodePrefix(title, code);
  if (titleWithoutCode !== title) {
    return titleWithoutCode;
  }
  if (!title || title === code || isDefaultPhaseTitle(title)) {
    return "";
  }
  return title;
}

function stripNodeTitleCodePrefix(title: string, code: string) {
  const prefix = `${code} - `;
  if (!title.startsWith(prefix)) {
    return title;
  }
  return title.slice(prefix.length).trim();
}

function isDefaultPhaseTitle(title: string) {
  return title === "\u65B0\u9636\u6BB5" || title === "New phase";
}

export function countNodes(nodes: WorkflowNode[]): number {
  return nodes.reduce(
    (total, node) => total + 1 + countNodes(node.children ?? []),
    0
  );
}
