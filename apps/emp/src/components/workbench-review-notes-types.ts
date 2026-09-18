import type { WorkingPaperBucket } from "@project-wing/shared";

import type { WorkingPaperQuestion } from "../api/client";

export type WorkbenchReviewNotesTarget = {
  key: string;
  kind: "attachment" | "workpaper";
  paperId: string;
  attachmentId?: string;
  workflowNodeId?: string | null;
  bucket: WorkingPaperBucket;
  reference: string;
  displayName: string;
};

export type WorkbenchResolvedReviewNotesTarget = WorkbenchReviewNotesTarget & {
  questions: WorkingPaperQuestion[];
};

export type WorkbenchReviewNotesPanelCopy = {
  title: string;
  projectScopeTitle: string;
  showAllProjectNotes: string;
  resizeLabel: string;
  counts: {
    all: string;
    open: string;
    replied: string;
    cleared: string;
  };
  filters: {
    search: string;
    subject: string;
    reference: string;
    createdBy: string;
    assignedTo: string;
    status: string;
    allCreators: string;
    allAssignees: string;
    allStatuses: string;
    clear: string;
  };
  columns: {
    actions: string;
    file: string;
    subject: string;
    reference: string;
    createdBy: string;
    createdOn: string;
    assignedTo: string;
    status: string;
  };
  columnMenu: {
    clear: string;
    empty: string;
    filter: string;
    search: string;
  };
  statusLabels: Record<WorkingPaperQuestion["status"], string>;
  unassigned: string;
  locate: string;
  view: string;
  newReviewNote: string;
  emptyTitle: string;
  emptyDescription: string;
  projectEmptyTitle: string;
  projectEmptyDescription: string;
  noMatches: string;
  noSelectionTitle: string;
  noSelectionDescription: string;
  unavailableTitle: string;
  unavailableDescription: string;
};
