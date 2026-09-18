import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import type { AuditLogSource } from "./audit-log-source";

export type AuditLogInput = {
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string;
  projectId?: string;
  description: string;
  source?: AuditLogSource;
};

type AuditLogClient = Pick<Prisma.TransactionClient, "auditLog">;

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  log(input: AuditLogInput) {
    return this.logInTransaction(this.prisma, input);
  }

  logInTransaction(client: AuditLogClient, input: AuditLogInput) {
    return client.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        projectId: input.projectId,
        description: input.description,
        ipAddress: input.source?.ipAddress,
        userAgent: input.source?.userAgent,
      },
    });
  }

  async listForProject(projectId: string) {
    await Promise.resolve();
    return this.prisma.auditLog.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        actor: {
          select: { id: true, name: true, email: true, globalRole: true },
        },
      },
    });
  }
}
