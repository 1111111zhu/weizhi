import { Injectable } from "@nestjs/common";
import type { ConfirmationStatus, Prisma } from "@prisma/client";

import type { RequestUser } from "../auth/request-user";
import { PrismaService } from "../prisma/prisma.service";

const PROJECT_VISIBLE_STATUSES = [
  "ACTIVE",
  "PENDING_FINAL_CHECK",
] as const;
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

@Injectable()
export class ConfirmationWorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: RequestUser): Promise<ConfirmationWorkspaceSummary[]> {
    const where: Prisma.ProjectWhereInput = hasConfirmationOfficeAccess(user)
      ? { status: { in: [...PROJECT_VISIBLE_STATUSES] } }
      : {
          status: { in: [...PROJECT_VISIBLE_STATUSES] },
          members: {
            some: {
              userId: user.id,
              status: "ACTIVE",
            },
          },
        };
    const projects = await this.prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        projectCode: true,
        reportDate: true,
        confirmations: {
          select: {
            status: true,
            createdBy: true,
          },
        },
      },
    });

    return projects.map((project) => {
      const statusCounts = createEmptyStatusCounts();
      let ownConfirmationCount = 0;
      for (const confirmation of project.confirmations) {
        statusCounts[confirmation.status] += 1;
        if (confirmation.createdBy === user.id) {
          ownConfirmationCount += 1;
        }
      }
      return {
        projectId: project.id,
        projectName: project.name,
        projectCode: project.projectCode,
        reportDate: project.reportDate?.toISOString() ?? null,
        totalConfirmationCount: project.confirmations.length,
        ownConfirmationCount,
        awaitingResponseCount: statusCounts.AWAITING_RESPONSE,
        statusCounts,
      };
    });
  }
}

function createEmptyStatusCounts() {
  return Object.fromEntries(
    CONFIRMATION_STATUSES.map((status) => [status, 0])
  ) as Record<ConfirmationStatus, number>;
}

function hasConfirmationOfficeAccess(user: RequestUser) {
  return (
    user.globalRole === "CONFIRMATION_OFFICER" ||
    user.globalRole === "SUPER_ADMIN"
  );
}
