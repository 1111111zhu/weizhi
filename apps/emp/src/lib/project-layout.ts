import type { WorkflowNode } from "../api/client";

export const PROJECT_PAGE_SHELL_CLASS =
  "app-surface flex h-full min-h-0 flex-col overflow-hidden bg-app-panel";

export const PAGE_SHELL_CLASS =
  "app-surface flex min-h-screen flex-col bg-app-panel";

export const PAGE_CONTENT_CLASS = "flex flex-col gap-6 p-6";

export const BUTTON_GROUP_SEPARATED_ITEMS_CLASS =
  "[&>[data-slot=button]]:rounded-md! [&>[data-slot=button]~[data-slot=button]]:border-l!";

export const PAGE_ACTION_GROUP_CLASS = `gap-1 ${BUTTON_GROUP_SEPARATED_ITEMS_CLASS}`;

export const PROJECT_OVERVIEW_GRID_CLASS =
  "emp-workspace-panels min-h-0 flex-1 gap-0 overflow-hidden bg-app-panel p-3";

export const DIRECTORY_TREE_CLASS =
  "relative z-20 min-h-0 min-w-0 overflow-hidden rounded-lg border border-border bg-workbench-sidebar";

export const FILE_PREVIEW_PANE_CLASS =
  "relative z-20 min-h-0 overflow-hidden rounded-lg border border-border bg-workbench-sidebar";

export const REVIEW_CONTENT_CLASS =
  "h-full w-full min-h-0 min-w-0 overflow-hidden rounded-lg bg-workbench-panel";

export function formatDisplayName(value: string) {
  return value.replaceAll(/\s*-\s*/g, " - ");
}

export function formatProjectDisplayId(projectNumber?: number | null) {
  if (projectNumber === undefined || projectNumber === null) {
    return null;
  }
  return `ID: ${String(projectNumber).padStart(7, "0")}`;
}

export function findWorkflowNode(
  nodes: WorkflowNode[],
  id: string | null
): WorkflowNode | null {
  if (!id) {
    return null;
  }

  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }

    const child = findWorkflowNode(node.children ?? [], id);
    if (child) {
      return child;
    }
  }

  return null;
}

export function findFirstWorkbenchNode(
  nodes: WorkflowNode[]
): WorkflowNode | null {
  return (
    findFirstNodeWithWorkingPapers(nodes) ??
    findFirstLeafNode(nodes) ??
    nodes[0] ??
    null
  );
}

function findFirstNodeWithWorkingPapers(
  nodes: WorkflowNode[]
): WorkflowNode | null {
  for (const node of nodes) {
    if ((node.workingPapers?.length ?? 0) > 0) {
      return node;
    }

    const child = findFirstNodeWithWorkingPapers(node.children ?? []);
    if (child) {
      return child;
    }
  }

  return null;
}

function findFirstLeafNode(nodes: WorkflowNode[]): WorkflowNode | null {
  for (const node of nodes) {
    if (!(node.children?.length ?? 0)) {
      return node;
    }

    const child = findFirstLeafNode(node.children ?? []);
    if (child) {
      return child;
    }
  }

  return null;
}
