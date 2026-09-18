import { Injectable } from "@nestjs/common";

import { InboxService } from "../inbox/inbox.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ArchiveNotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inbox: InboxService
  ) {}

  async notifyArchiveCompleted(input: {
    projectId: string;
    actorId: string;
    packageFileName: string;
  }) {
    const project = await this.prisma.project.findUnique({
      where: { id: input.projectId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: {
          where: { status: "ACTIVE" },
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    if (!project) {
      return;
    }

    const recipients = new Map([
      [project.owner.id, project.owner],
      ...project.members.map(
        (member) => [member.user.id, member.user] as const
      ),
    ]);

    const title = `Project successfully archived: ${project.projectCode}`;
    const body = `${project.name} has been successfully archived. Archive package: ${input.packageFileName}`;
    await Promise.all(
      [...recipients.values()].map(async (recipient) => {
        await this.inbox.createCollaborationMessage({
          recipientId: recipient.id,
          senderId: recipient.id === input.actorId ? null : input.actorId,
          projectId: project.id,
          type: "SYSTEM_NOTIFICATION",
          title,
          body,
          contentKey: "PROJECT_ARCHIVE_COMPLETED",
          contentParams: {
            projectCode: project.projectCode,
            projectName: project.name,
            packageFileName: input.packageFileName,
          },
          actionUrl: `/engagement/${project.id}`,
        });
      })
    );
  }
}
