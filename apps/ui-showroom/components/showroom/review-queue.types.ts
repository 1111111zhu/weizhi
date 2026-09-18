export type ReviewDecision =
  | "unreviewed"
  | "candidate"
  | "technical-debt"
  | "reject";

export interface ReviewQueueItem {
  family: string;
  file: string;
  id: string;
  kind: string;
  libraries: string[];
  name: string;
  reasons: string[];
  replacement: string | null;
  scope: string;
  suggestedDisposition: ReviewDecision;
}

export interface ReviewInventoryIdentity {
  inventoryHash: string;
  sourceRevision: string | null;
}
