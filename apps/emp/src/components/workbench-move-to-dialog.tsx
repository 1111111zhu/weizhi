"use client";

import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderTree,
  Info,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { WorkflowNode } from "../api/client";
import { formatDisplayName } from "../lib/project-layout";
import {
  formatNodeLabel,
  getDirectoryDisplayNode,
} from "./workbench-directory-row";
import type { DirectoryFileTransfer } from "./workbench-directory-row";

export type WorkbenchMoveToDialogCopy = {
  heading: string;
  instructions: string;
  searchPlaceholder: string;
  filesAreLocations: string;
  targetLocation: string;
  currentLocation: string;
  noResults: string;
  expandFolder: string;
  collapseFolder: string;
  cancel: string;
  moveHere: string;
  close: string;
};

type MoveToTreeNode = {
  node: WorkflowNode;
  label: string;
  files: { id: string; label: string }[];
  children: MoveToTreeNode[];
};

export function WorkbenchMoveToDialog({
  open,
  projectName,
  workflow,
  files,
  copy,
  disabled = false,
  onOpenChange,
  onMove,
}: {
  open: boolean;
  projectName: string;
  workflow: WorkflowNode[];
  files: DirectoryFileTransfer[];
  copy: WorkbenchMoveToDialogCopy;
  disabled?: boolean;
  onOpenChange: (open: boolean) => void;
  onMove: (node: WorkflowNode) => void;
}) {
  const tree = useMemo(() => buildMoveToTree(workflow), [workflow]);
  const nodeById = useMemo(() => indexMoveToNodes(tree), [tree]);
  const sourceNodeKey = files
    .map((file) => file.nodeId)
    .sort()
    .join("|");
  const sourceNodeIds = useMemo(
    () => new Set(sourceNodeKey ? sourceNodeKey.split("|") : []),
    [sourceNodeKey]
  );
  const [query, setQuery] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setQuery("");
    setSelectedNodeId(null);
    setExpandedNodeIds(getInitiallyExpandedNodeIds(tree, sourceNodeIds));
  }, [open, sourceNodeIds, tree]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleTree = useMemo(
    () => filterMoveToTree(tree, normalizedQuery),
    [normalizedQuery, tree]
  );
  const selectedEntry = selectedNodeId
    ? (nodeById.get(selectedNodeId) ?? null)
    : null;
  const targetPath = selectedEntry
    ? getMoveToPath(selectedEntry.node.id, nodeById, projectName)
    : [];
  const isCurrentLocation = (nodeId: string) =>
    sourceNodeIds.size === 1 && sourceNodeIds.has(nodeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={copy.close}
        className="grid h-[min(46rem,calc(100vh-2rem))] max-h-[calc(100vh-2rem)] grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-4xl"
      >
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FolderTree className="size-5 text-muted-foreground" />
            {copy.heading}
          </DialogTitle>
          <DialogDescription>{copy.instructions}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 border-b border-border/70 px-6 py-4 sm:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] sm:items-center">
          <div className="relative min-w-0">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label={copy.searchPlaceholder}
              className="pl-9"
              placeholder={copy.searchPlaceholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground sm:justify-end">
            <Info aria-hidden="true" className="size-4 shrink-0" />
            <span>{copy.filesAreLocations}</span>
          </p>
        </div>

        <div className="min-h-0 overflow-y-auto px-5 py-4">
          <div
            role="tree"
            aria-label={copy.instructions}
            className="min-h-full rounded-lg border border-border bg-background px-2 py-2"
          >
            <div className="flex min-h-10 items-center gap-2 rounded-md px-2 text-sm font-semibold text-foreground">
              <FolderTree className="size-4 text-muted-foreground" />
              <span className="min-w-0 truncate">
                {formatDisplayName(projectName)}
              </span>
            </div>
            {visibleTree.length > 0 ? (
              <div className="grid gap-0.5 pl-2">
                {visibleTree.map((entry) => (
                  <MoveToTreeRow
                    key={entry.node.id}
                    copy={copy}
                    entry={entry}
                    forceExpanded={Boolean(normalizedQuery)}
                    expandedNodeIds={expandedNodeIds}
                    selectedNodeId={selectedNodeId}
                    isCurrentLocation={isCurrentLocation}
                    onExpandedNodeIdsChange={setExpandedNodeIds}
                    onSelectNode={setSelectedNodeId}
                  />
                ))}
              </div>
            ) : (
              <div className="flex min-h-48 items-center justify-center px-4 text-sm text-muted-foreground">
                {copy.noResults}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="grid gap-4 border-t border-border bg-background px-6 pt-4 pb-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              {copy.targetLocation}
            </p>
            {targetPath.length > 0 ? (
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-foreground">
                {targetPath.map((segment, index) => (
                  <span key={`${segment}-${index}`} className="contents">
                    {index ? (
                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                    ) : null}
                    <span className="max-w-52 truncate">{segment}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">—</p>
            )}
          </div>
          <ButtonGroup aria-label={copy.heading}>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {copy.cancel}
            </Button>
            <Button
              type="button"
              disabled={disabled || !selectedEntry}
              onClick={() => {
                if (!selectedEntry) {
                  return;
                }
                onMove(selectedEntry.node);
                onOpenChange(false);
              }}
            >
              {copy.moveHere}
            </Button>
          </ButtonGroup>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MoveToTreeRow({
  entry,
  copy,
  forceExpanded,
  expandedNodeIds,
  selectedNodeId,
  isCurrentLocation,
  onExpandedNodeIdsChange,
  onSelectNode,
}: {
  entry: MoveToTreeNode;
  copy: WorkbenchMoveToDialogCopy;
  forceExpanded: boolean;
  expandedNodeIds: Set<string>;
  selectedNodeId: string | null;
  isCurrentLocation: (nodeId: string) => boolean;
  onExpandedNodeIdsChange: (nodeIds: Set<string>) => void;
  onSelectNode: (nodeId: string) => void;
}) {
  const hasChildren = Boolean(
    entry.children.length > 0 || entry.files.length > 0
  );
  const expanded = forceExpanded || expandedNodeIds.has(entry.node.id);
  const currentLocation = isCurrentLocation(entry.node.id);
  const selected = selectedNodeId === entry.node.id;
  const toggleExpanded = () => {
    const next = new Set(expandedNodeIds);
    if (next.has(entry.node.id)) {
      next.delete(entry.node.id);
    } else {
      next.add(entry.node.id);
    }
    onExpandedNodeIdsChange(next);
  };

  return (
    <div className="relative">
      <ButtonGroup className="relative z-10 flex w-full min-w-0">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`${
            expanded ? copy.collapseFolder : copy.expandFolder
          } ${entry.label}`}
          aria-expanded={hasChildren ? expanded : undefined}
          disabled={!hasChildren || forceExpanded}
          className="shrink-0 text-muted-foreground"
          onClick={toggleExpanded}
        >
          {expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </Button>
        <Button
          type="button"
          role="treeitem"
          variant="ghost"
          aria-selected={selected}
          aria-current={currentLocation ? "location" : undefined}
          disabled={currentLocation}
          className={cn(
            "h-9 min-w-0 flex-1 justify-start gap-2 border-l-0 px-2 text-left font-medium",
            selected && "bg-primary/12 text-primary hover:bg-primary/15",
            currentLocation && "opacity-60"
          )}
          onClick={() => onSelectNode(entry.node.id)}
        >
          <Folder
            className={cn(
              "size-4 shrink-0 text-muted-foreground",
              selected && "text-primary"
            )}
          />
          <span className="min-w-0 flex-1 truncate">{entry.label}</span>
          {currentLocation ? (
            <span className="shrink-0 text-[11px] font-normal text-muted-foreground">
              {copy.currentLocation}
            </span>
          ) : null}
        </Button>
      </ButtonGroup>

      {expanded && hasChildren ? (
        <div
          role="group"
          className="ml-3 grid gap-0.5 border-l border-border pl-2"
        >
          {entry.files.map((file) => (
            <div
              key={file.id}
              role="treeitem"
              aria-disabled="true"
              className="flex min-h-8 min-w-0 items-center gap-2 rounded-md px-9 text-xs text-muted-foreground"
            >
              <FileText className="size-3.5 shrink-0" />
              <span className="truncate">{file.label}</span>
            </div>
          ))}
          {entry.children.map((child) => (
            <MoveToTreeRow
              key={child.node.id}
              copy={copy}
              entry={child}
              forceExpanded={forceExpanded}
              expandedNodeIds={expandedNodeIds}
              selectedNodeId={selectedNodeId}
              isCurrentLocation={isCurrentLocation}
              onExpandedNodeIdsChange={onExpandedNodeIdsChange}
              onSelectNode={onSelectNode}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function buildMoveToTree(workflow: WorkflowNode[]): MoveToTreeNode[] {
  const buildNodes = (
    nodes: WorkflowNode[],
    parentDisplayCode?: string
  ): MoveToTreeNode[] =>
    nodes.map((node, index) => {
      const displayNode = getDirectoryDisplayNode(
        node,
        index + 1,
        parentDisplayCode
      );
      return {
        node,
        label: formatNodeLabel(displayNode),
        files: (node.workingPapers ?? [])
          .filter((paper) =>
            paper.attachments?.some((attachment) => !attachment.deletedAt)
          )
          .map((paper) => {
            const attachment = paper.attachments?.find(
              (item) => !item.deletedAt
            );
            const name = formatDisplayName(
              attachment?.originalName ?? attachment?.fileName ?? paper.title
            );
            return {
              id: paper.id,
              label: paper.code
                ? `${formatDisplayName(paper.code)} ${name}`
                : name,
            };
          }),
        children: buildNodes(node.children ?? [], displayNode.code),
      };
    });

  return buildNodes(workflow);
}

function indexMoveToNodes(tree: MoveToTreeNode[]) {
  const index = new Map<string, MoveToTreeNode>();
  const add = (entries: MoveToTreeNode[]) => {
    for (const entry of entries) {
      index.set(entry.node.id, entry);
      add(entry.children);
    }
  };
  add(tree);
  return index;
}

function getInitiallyExpandedNodeIds(
  tree: MoveToTreeNode[],
  sourceNodeIds: Set<string>
) {
  const expanded = new Set<string>();
  const visit = (entry: MoveToTreeNode): boolean => {
    const containsSource =
      sourceNodeIds.has(entry.node.id) || entry.children.some(visit);
    if (containsSource) {
      expanded.add(entry.node.id);
    }
    return containsSource;
  };
  tree.forEach(visit);
  return expanded;
}

function filterMoveToTree(tree: MoveToTreeNode[], query: string) {
  if (!query) {
    return tree;
  }
  const filter = (entries: MoveToTreeNode[]): MoveToTreeNode[] =>
    entries.flatMap((entry) => {
      const children = filter(entry.children);
      const files = entry.files.filter((file) =>
        file.label.toLocaleLowerCase().includes(query)
      );
      const matches = entry.label.toLocaleLowerCase().includes(query);
      if (!matches && children.length === 0 && files.length === 0) {
        return [];
      }
      return [{ ...entry, children, files: matches ? entry.files : files }];
    });
  return filter(tree);
}

function getMoveToPath(
  nodeId: string,
  nodeById: Map<string, MoveToTreeNode>,
  projectName: string
) {
  const path = [formatDisplayName(projectName)];
  const nodePath: string[] = [];
  let current = nodeById.get(nodeId);
  const visited = new Set<string>();
  while (current && !visited.has(current.node.id)) {
    visited.add(current.node.id);
    nodePath.unshift(current.label);
    current = current.node.parentId
      ? nodeById.get(current.node.parentId)
      : undefined;
  }
  return [...path, ...nodePath];
}
