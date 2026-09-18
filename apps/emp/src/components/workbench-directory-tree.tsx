"use client";

import { hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { useMemo } from "react";

import { Tree, TreeItem } from "@/components/reui/tree";

import type { WorkflowNode } from "../api/client";
import {
  DirectoryFileRow,
  DirectoryNodeRow,
  InlineCreateNodeRow,
  formatNodeLabel,
  getDirectoryDisplayNode,
  getVisibleFiles,
} from "./workbench-directory-row";
import type { DirectoryNodeRowProps } from "./workbench-directory-row";

const NODE_ITEM_PREFIX = "node:";
const PAPER_ITEM_PREFIX = "paper:";
const ROOT_ITEM_ID = "workbench-directory-root";

type DirectoryTreeEntry = {
  children: string[];
  name: string;
} & (
  | { kind: "root" }
  | {
      kind: "node";
      displayNode: WorkflowNode;
      node: WorkflowNode;
      parentDisplayCode?: string;
      parentNodeId?: string | null;
      siblingIndex: number;
    }
  | {
      kind: "paper";
      node: WorkflowNode;
      paper: WorkflowNode["workingPapers"][number];
      siblingIndex: number;
    }
);

type DirectoryTreeRowProps = Omit<
  DirectoryNodeRowProps,
  | "flat"
  | "isExpanded"
  | "node"
  | "parentDisplayCode"
  | "parentNodeId"
  | "siblingIndex"
>;

function resolveExpandedItems(
  next: string[] | ((items: string[]) => string[]),
  current: string[]
) {
  if (typeof next === "function") {
    return next(current);
  }
  return next;
}

export function WorkbenchDirectoryTree({
  workflow,
  expandedNodeIds,
  rowProps,
  onExpandedNodeIdsChange,
}: {
  workflow: WorkflowNode[];
  expandedNodeIds: Set<string>;
  rowProps: DirectoryTreeRowProps;
  onExpandedNodeIdsChange: (nodeIds: Set<string>) => void;
}) {
  const entries = useMemo(
    () =>
      buildDirectoryTreeEntries(
        workflow,
        rowProps.showFiles,
        rowProps.visibleFileBucket
      ),
    [rowProps.showFiles, rowProps.visibleFileBucket, workflow]
  );
  const expandedItems = useMemo(
    () => Array.from(expandedNodeIds, toNodeItemId),
    [expandedNodeIds]
  );
  const tree = useTree<DirectoryTreeEntry>({
    state: { expandedItems },
    setExpandedItems: (next) => {
      const current = Array.from(expandedNodeIds, toNodeItemId);
      const nextItems = resolveExpandedItems(next, current);
      return onExpandedNodeIdsChange(
        new Set(
          nextItems
            .filter((itemId) => itemId.startsWith(NODE_ITEM_PREFIX))
            .map((itemId) => itemId.slice(NODE_ITEM_PREFIX.length))
        )
      );
    },
    rootItemId: ROOT_ITEM_ID,
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => item.getItemData().children.length > 0,
    dataLoader: {
      getItem: (itemId) => {
        const entry = entries.get(itemId);
        if (!entry) {
          throw new Error(`Unknown directory tree item: ${itemId}`);
        }
        return entry;
      },
      getChildren: (itemId) => entries.get(itemId)?.children ?? [],
    },
    features: [syncDataLoaderFeature, hotkeysCoreFeature],
  });

  return (
    <Tree
      className="relative w-full min-w-0 overflow-hidden"
      indent={20}
      tree={tree}
    >
      {tree.getItems().map((item) => {
        const entry = entries.get(item.getId());
        if (!entry) {
          return null;
        }

        return (
          <TreeItem
            key={item.getId()}
            className="relative z-10 w-full min-w-0 before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:-ms-1 before:w-(--tree-padding) before:bg-[repeating-linear-gradient(to_right,transparent_0,transparent_calc(var(--tree-indent)-1px),var(--border)_calc(var(--tree-indent)-1px),var(--border)_calc(var(--tree-indent)))]"
            item={item}
            data-active={
              entry.kind === "node"
                ? rowProps.selectedNodeId === entry.node.id
                : entry.kind === "paper"
                  ? rowProps.selectedPaperId === entry.paper.id
                  : undefined
            }
            data-directory-ancestor-active={
              entry.kind === "node" &&
              rowProps.ancestorNodeIds?.has(entry.node.id)
                ? "true"
                : undefined
            }
            draggable={false}
            onClick={(event) => {
              if (entry.kind === "node") {
                if (rowProps.isCreatingDirectory) {
                  if (rowProps.addNodeTarget?.id === entry.node.id) {
                    return;
                  }
                  if (item.isExpanded()) {
                    item.collapse();
                  } else if (entry.children.length > 0) {
                    item.expand();
                  }
                  return;
                }
                rowProps.onSelect(entry.node.id);
                if (event.ctrlKey || event.metaKey || event.shiftKey) {
                  if (item.isExpanded()) {
                    item.collapse();
                  } else {
                    item.expand();
                  }
                }
              } else if (entry.kind === "paper") {
                rowProps.onSelectPaper?.(entry.paper.id, entry.node.id);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Delete" && entry.kind === "node") {
                event.preventDefault();
                rowProps.onDelete(entry.node);
              }
            }}
          >
            {entry.kind === "node" ? (
              <DirectoryNodeRow
                {...rowProps}
                flat
                isExpanded={item.isExpanded()}
                node={entry.node}
                parentDisplayCode={entry.parentDisplayCode}
                parentNodeId={entry.parentNodeId}
                siblingIndex={entry.siblingIndex}
              />
            ) : entry.kind === "paper" ? (
              <DirectoryFileRow
                {...rowProps}
                clipboardFile={rowProps.clipboardFile}
                clipboardNode={rowProps.clipboardNode}
                copy={rowProps.copy}
                displayIndex={entry.siblingIndex}
                flat
                isHighlighted={rowProps.highlightedPaperId === entry.paper.id}
                isSelected={rowProps.selectedPaperId === entry.paper.id}
                multiSelectedItemIds={rowProps.multiSelectedItemIds}
                node={entry.node}
                paper={entry.paper}
                readOnly={rowProps.readOnly}
                relocateFilePending={rowProps.relocateFilePending}
              />
            ) : null}
            {entry.kind === "node" &&
            rowProps.addNodeTarget?.id === entry.node.id &&
            item.isExpanded() ? (
              <div className="grid gap-1 pl-5">
                <InlineCreateNodeRow
                  copy={rowProps.copy}
                  parent={entry.displayNode}
                  isPending={rowProps.createNodePending}
                  onCreate={(values) => rowProps.createNode(values)}
                  onClose={() => rowProps.onCloseAdd()}
                />
              </div>
            ) : null}
          </TreeItem>
        );
      })}
    </Tree>
  );
}

function buildDirectoryTreeEntries(
  workflow: WorkflowNode[],
  showFiles: boolean | undefined,
  visibleFileBucket: DirectoryNodeRowProps["visibleFileBucket"]
) {
  const entries = new Map<string, DirectoryTreeEntry>();
  const root: DirectoryTreeEntry = {
    kind: "root",
    children: [],
    name: "Project directory",
  };
  entries.set(ROOT_ITEM_ID, root);

  const addNodes = (
    nodes: WorkflowNode[],
    parentItemId: string,
    parentDisplayCode?: string
  ) => {
    const parent = entries.get(parentItemId);

    nodes.forEach((node, index) => {
      const siblingIndex = index + 1;
      const displayNode = getDirectoryDisplayNode(
        node,
        siblingIndex,
        parentDisplayCode
      );
      const itemId = toNodeItemId(node.id);
      const files = getVisibleFiles(
        node.workingPapers ?? [],
        showFiles,
        visibleFileBucket
      );
      const entry: DirectoryTreeEntry = {
        kind: "node",
        children: [],
        displayNode,
        name: formatNodeLabel(displayNode),
        node,
        parentDisplayCode,
        parentNodeId: node.parentId ?? null,
        siblingIndex,
      };

      entries.set(itemId, entry);
      if (!parent) {
        throw new Error(`Unknown directory tree parent: ${parentItemId}`);
      }
      parent.children.push(itemId);
      files.forEach((paper, fileIndex) => {
        const paperItemId = toPaperItemId(node.id, paper.id);
        entries.set(paperItemId, {
          kind: "paper",
          children: [],
          name: paper.title,
          node,
          paper,
          siblingIndex: fileIndex + 1,
        });
        entry.children.push(paperItemId);
      });
      addNodes(node.children ?? [], itemId, displayNode.code);
    });
  };

  addNodes(workflow, ROOT_ITEM_ID);
  return entries;
}

function toNodeItemId(nodeId: string) {
  return `${NODE_ITEM_PREFIX}${nodeId}`;
}

function toPaperItemId(nodeId: string, paperId: string) {
  return `${PAPER_ITEM_PREFIX}${nodeId}:${paperId}`;
}
