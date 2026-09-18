import type { WorkflowNodeType } from "@prisma/client";

export type DefaultWorkflowNode = {
  code: string;
  title: string;
  level: number;
  nodeType: WorkflowNodeType;
  sortOrder: number;
  children?: DefaultWorkflowNode[];
};

export const DEFAULT_WORKFLOW: DefaultWorkflowNode[] = [
  {
    code: "1000",
    title: "Planning",
    level: 1,
    nodeType: "PHASE",
    sortOrder: 1,
  },
  {
    code: "2000",
    title: "Execution",
    level: 1,
    nodeType: "PHASE",
    sortOrder: 2,
  },
  {
    code: "3000",
    title: "Reporting",
    level: 1,
    nodeType: "PHASE",
    sortOrder: 3,
  },
];
