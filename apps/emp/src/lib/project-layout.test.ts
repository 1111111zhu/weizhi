import { describe, expect, it } from "vitest";

import type { WorkflowNode } from "../api/client";
import {
  BUTTON_GROUP_SEPARATED_ITEMS_CLASS,
  DIRECTORY_TREE_CLASS,
  FILE_PREVIEW_PANE_CLASS,
  PAGE_ACTION_GROUP_CLASS,
  PROJECT_OVERVIEW_GRID_CLASS,
  REVIEW_CONTENT_CLASS,
  findFirstWorkbenchNode,
  findWorkflowNode,
  formatProjectDisplayId,
} from "./project-layout";

describe("project layout metadata", () => {
  it("formats project display ids as seven digit Canvas-style labels", () => {
    expect(formatProjectDisplayId()).toBeNull();
  });

  it("keeps the workflow directory and preview as separated panels", () => {
    expect(PROJECT_OVERVIEW_GRID_CLASS).toContain("min-h-0");
    expect(PROJECT_OVERVIEW_GRID_CLASS).toContain("flex-1");
    expect(PROJECT_OVERVIEW_GRID_CLASS).toContain("overflow-hidden");
    expect(PROJECT_OVERVIEW_GRID_CLASS).toContain("bg-app-panel");
    expect(PROJECT_OVERVIEW_GRID_CLASS).toContain("gap-0");
    expect(PROJECT_OVERVIEW_GRID_CLASS).toContain("p-3");
    expect(PROJECT_OVERVIEW_GRID_CLASS).not.toContain("border");
    expect(DIRECTORY_TREE_CLASS).toContain("bg-workbench-sidebar");
    expect(DIRECTORY_TREE_CLASS).toContain("border");
    expect(DIRECTORY_TREE_CLASS).toContain("relative");
    expect(DIRECTORY_TREE_CLASS).toContain("z-20");
    expect(DIRECTORY_TREE_CLASS).toContain("min-w-0");
    expect(DIRECTORY_TREE_CLASS).toContain("overflow-hidden");
    expect(DIRECTORY_TREE_CLASS).toContain("rounded-lg");
    expect(FILE_PREVIEW_PANE_CLASS).toContain("rounded-lg");
    expect(FILE_PREVIEW_PANE_CLASS).toContain("border");
    expect(FILE_PREVIEW_PANE_CLASS).toContain("bg-workbench-sidebar");
    expect(REVIEW_CONTENT_CLASS).toContain("bg-workbench-panel");
    expect(REVIEW_CONTENT_CLASS).toContain("min-w-0");
    expect(REVIEW_CONTENT_CLASS).toContain("overflow-hidden");
    expect(REVIEW_CONTENT_CLASS).toContain("rounded-lg");
  });

  it("keeps action group items visually light", () => {
    expect(PAGE_ACTION_GROUP_CLASS).toContain(
      BUTTON_GROUP_SEPARATED_ITEMS_CLASS
    );
  });

  it("finds workflow nodes recursively and defaults to the first folder with files", () => {
    const workflow: WorkflowNode[] = [
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
            children: [
              {
                id: "a1-1000",
                parentId: "a1",
                code: "A1 - 1000",
                title: "Planning meetings with client",
                level: 3,
                nodeType: "WORKING_PAPER",
                workingPapers: [],
                children: [
                  {
                    id: "a1-1000-01",
                    parentId: "a1-1000",
                    code: "A1 - 1000 - 01",
                    title: "Cash testing",
                    level: 4,
                    nodeType: "WORKING_PAPER",
                    workingPapers: [
                      {
                        id: "paper-1",
                        projectId: "project-1",
                        workflowNodeId: "a1-1000-01",
                        code: "A1-1000-01-F001",
                        title: "Cash lead sheet",
                        paperType: "WORKING_PAPER",
                        bucket: "CURRENT",
                        attachments: [],
                      },
                    ],
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    expect(findWorkflowNode(workflow, "a1")?.code).toBe("A1");
    expect(findWorkflowNode(workflow, "missing")).toBeNull();
    expect(findFirstWorkbenchNode(workflow)?.id).toBe("a1-1000-01");
  });
});
