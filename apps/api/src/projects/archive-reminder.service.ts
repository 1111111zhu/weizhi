import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { backgroundJobsEnabled } from "../common/background-jobs";
import { InboxService } from "../inbox/inbox.service";
import { PrismaService } from "../prisma/prisma.service";

const REMINDER_DAYS = [10, 5, 1] as const;

@Injectable()
export class ArchiveReminderService {
  private readonly logger = new Logger(ArchiveReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inbox: InboxService
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendArchiveDeadlineReminders() {
    if (!backgroundJobsEnabled()) {
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const daysBefore of REMINDER_DAYS) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + daysBefore);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      try {
        const projects = await this.prisma.project.findMany({
          where: {
            status: "ACTIVE",
            archiveDeadline: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
          select: {
            id: true,
            projectCode: true,
            name: true,
            archiveDeadline: true,
            members: {
              select: { userId: true },
              where: { status: "ACTIVE" },
            },
          },
        });

        for (const project of projects) {
          const alreadySent = await this.prisma.inboxMessage.findFirst({
            where: {
              projectId: project.id,
              type: "SYSTEM_NOTIFICATION",
              body: { contains: `archive-reminder-${daysBefore}d` },
              createdAt: { gte: startOfDay },
            },
          });

          if (alreadySent) {
            this.logger.debug(
              `Reminder already sent for project ${project.projectCode} (${daysBefore}d)`
            );
            continue;
          }

          for (const member of project.members) {
            await this.inbox.createCollaborationMessage({
              type: "SYSTEM_NOTIFICATION",
              projectId: project.id,
              senderId: null,
              recipientId: member.userId,
              title: `Archive deadline reminder: ${project.projectCode}`,
              body: `archive-reminder-${daysBefore}d: The archive deadline for "${project.name}" (${project.projectCode}) is ${targetDate.toISOString().split("T")[0]}, in ${daysBefore} day(s). Please prepare for the archive submission.`,
              contentKey: "PROJECT_ARCHIVE_DEADLINE_REMINDER",
              contentParams: {
                projectCode: project.projectCode,
                projectName: project.name,
                deadline: targetDate.toISOString().split("T")[0],
                days: daysBefore,
              },
            });
          }

          this.logger.log(
            `Sent ${daysBefore}-day archive reminder for project ${project.projectCode} to ${project.members.length} members`
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to send ${daysBefore}-day archive reminders`,
          error
        );
      }
    }
  }
}
