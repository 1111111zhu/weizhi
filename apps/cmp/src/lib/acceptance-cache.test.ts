import { describe, expect, it } from "vitest";

import {
  getActiveAcceptanceApproverId,
  reconcileApprovalQueue,
  upsertAcceptanceRequest,
} from "./acceptance-cache";

const request = {
  id: "request-1",
  requestNo: "CA-001",
  type: "CLIENT" as const,
  status: "PENDING_PIC" as const,
  currentStep: "PIC" as const,
  submittedById: "staff-1",
  submittedBy: {
    id: "staff-1",
    name: "Staff",
    email: "staff@example.com",
    globalRole: "STAFF" as const,
  },
  micApproverId: "mic-1",
  micApprover: {
    id: "mic-1",
    name: "MIC",
    email: "mic@example.com",
    globalRole: "MANAGER" as const,
  },
  picApproverId: "pic-1",
  picApprover: {
    id: "pic-1",
    name: "PIC",
    email: "pic@example.com",
    globalRole: "PARTNER" as const,
  },
  itApproverId: "it-1",
  itApprover: {
    id: "it-1",
    name: "IT",
    email: "it@example.com",
    globalRole: "SUPER_ADMIN" as const,
  },
  workflowVersion: 2,
  draftAssigneeId: null,
  draftAssignee: null,
  draftCompletedAt: null,
  draftCompletedById: null,
  draftCompletedBy: null,
  returnedFromStep: null,
  picApprovedAt: null,
  targetClientId: null,
  targetEngagementId: null,
  clientPayload: { clientCode: "C-001", nameEn: "Example Limited" },
  engagementPayload: null,
  returnReason: null,
  submittedAt: "2026-07-23T00:00:00.000Z",
  approvedAt: null,
  returnedAt: null,
  createdAt: "2026-07-23T00:00:00.000Z",
  updatedAt: "2026-07-23T00:00:00.000Z",
  approvalSteps: [],
};

describe("acceptance cache reconciliation", () => {
  it("keeps the current approver queue in sync with an updated request", () => {
    const response = { requests: [request] };
    const updated = {
      ...request,
      status: "PENDING_IT" as const,
      currentStep: "IT" as const,
    };

    expect(getActiveAcceptanceApproverId(updated)).toBe("it-1");
    expect(
      reconcileApprovalQueue(response, updated, "pic-1")?.requests
    ).toStrictEqual([]);
    expect(
      reconcileApprovalQueue(response, updated, "it-1")?.requests
    ).toStrictEqual([updated]);
  });

  it("upserts the changed request into the all-requests cache", () => {
    const updated = {
      ...request,
      status: "PENDING_IT" as const,
      currentStep: "IT" as const,
    };

    expect(
      upsertAcceptanceRequest({ requests: [request] }, updated)
    ).toStrictEqual({
      requests: [updated],
    });
  });
});
