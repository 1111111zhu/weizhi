import type { ConfirmationStatus } from "@project-wing/shared";

import type { Project, ProjectConfirmation } from "./client";
import { ApiError, api } from "./client";
import { getApiMode, isMockApiMode } from "./mode";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
const HAS_CONFIGURED_API_BASE_URL = Boolean(
  process.env.NEXT_PUBLIC_API_BASE_URL
);
const CONFIRMATION_STATUSES: ConfirmationStatus[] = [
  "DRAFT",
  "PREPARED",
  "AWAITING_RESPONSE",
  "RESPONSE_RECEIVED",
  "CLOSED",
  "VOIDED",
];

export type ConfirmationWorkspaceSummary = {
  projectId: string;
  projectName: string;
  projectCode: string;
  reportDate: string | null;
  totalConfirmationCount: number;
  ownConfirmationCount: number;
  awaitingResponseCount: number;
  statusCounts: Record<ConfirmationStatus, number>;
};

export async function fetchConfirmationWorkspaceSummary() {
  if (shouldUseMockApi()) {
    const [me, projects, confirmations] = await Promise.all([
      api.me(),
      api.projects(),
      api.confirmations(),
    ]);
    if (!me) {
      throw new ApiError("UNAUTHORIZED", "Authentication is required", "mock");
    }
    return aggregateMockWorkspace(projects, confirmations, me.id);
  }

  const response = await fetch(
    `${API_BASE_URL}/confirmations/workspace-summary`,
    {
      credentials: "include",
    }
  ).catch((_unused_error: unknown) => {
    throw new ApiError("NETWORK_FAILED", "Network request failed", "client");
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
      requestId?: string;
    } | null;
    throw new ApiError(
      body?.code ?? "REQUEST_FAILED",
      body?.message ?? "Request failed",
      body?.requestId ?? "unknown"
    );
  }
  return response.json() as Promise<ConfirmationWorkspaceSummary[]>;
}

function shouldUseMockApi() {
  return (
    isMockApiMode(getApiMode()) ||
    (!HAS_CONFIGURED_API_BASE_URL && isLocalHostname())
  );
}

function isLocalHostname() {
  if (typeof window === "undefined") {
    return false;
  }
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function aggregateMockWorkspace(
  projects: Project[],
  confirmations: ProjectConfirmation[],
  userId: string
): ConfirmationWorkspaceSummary[] {
  const byProject = new Map<string, ProjectConfirmation[]>();
  for (const confirmation of confirmations) {
    const rows = byProject.get(confirmation.projectId) ?? [];
    rows.push(confirmation);
    byProject.set(confirmation.projectId, rows);
  }
  return projects
    .filter(
      (project) =>
        project.status === "ACTIVE" || project.status === "PENDING_FINAL_CHECK"
    )
    .map((project) => {
      const projectConfirmations = byProject.get(project.id) ?? [];
      const statusCounts = createEmptyStatusCounts();
      let ownConfirmationCount = 0;
      for (const confirmation of projectConfirmations) {
        statusCounts[confirmation.status] += 1;
        if (confirmation.createdBy === userId) {
          ownConfirmationCount += 1;
        }
      }
      return {
        projectId: project.id,
        projectName: project.name,
        projectCode: project.projectCode,
        reportDate: project.reportDate ?? null,
        totalConfirmationCount: projectConfirmations.length,
        ownConfirmationCount,
        awaitingResponseCount: statusCounts.AWAITING_RESPONSE,
        statusCounts,
      };
    });
}

function createEmptyStatusCounts() {
  return Object.fromEntries(
    CONFIRMATION_STATUSES.map((status) => [status, 0])
  ) as Record<ConfirmationStatus, number>;
}
