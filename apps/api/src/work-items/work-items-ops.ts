import type { WorkItem } from "@project-wing/shared";

import type { RequestUser } from "../auth/request-user";
import type { PrismaService } from "../prisma/prisma.service";
import { PREVIEW_JOB_MAX_ATTEMPTS } from "../workflow/attachment-preview.constants";
import { copy, person, projectSummary, workItem } from "./work-item-common";
import type { WorkItemLocale } from "./work-item-common";

const ABNORMAL_ZIP_STATES = [
  "CHECKIN_FAILED",
  "RELEASE_FAILED",
  "RECOVERABLE",
  "BASE_VERSION_CONFLICT",
] as const;

export async function buildOpsWorkItems(
  prisma: PrismaService,
  user: RequestUser,
  locale: WorkItemLocale
): Promise<WorkItem[]> {
  if (user.globalRole !== "SUPER_ADMIN") {
    return [];
  }
  const [
    mailConnections,
    systemConnections,
    archiveJobs,
    exportJobs,
    sessions,
    previewFailures,
  ] = await Promise.all([
    prisma.userMailConnection.findMany({
      where: { status: "ERROR" },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.systemConnection.findMany({
      where: { status: "ERROR" },
      include: {
        updatedBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.projectArchiveJob.findMany({
      where: { status: "FAILED" },
      include: {
        project: { select: { id: true, projectCode: true, name: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.projectFileExportJob.findMany({
      where: { status: "FAILED" },
      include: {
        project: { select: { id: true, projectCode: true, name: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.zipMasterSession.findMany({
      where: {
        state: { in: [...ABNORMAL_ZIP_STATES] },
        attachment: { deletedAt: null },
      },
      include: {
        project: { select: { id: true, projectCode: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
        attachment: { select: { id: true, fileName: true, title: true } },
      },
    }),
    prisma.attachment.findMany({
      where: {
        previewStatus: "FAILED",
        previewAttemptCount: { gte: PREVIEW_JOB_MAX_ATTEMPTS },
        deletedAt: null,
      },
      include: {
        project: { select: { id: true, projectCode: true, name: true } },
        lastModifier: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  const items: WorkItem[] = [];
  for (const connection of mailConnections) {
    items.push(
      workItem({
        id: `OPS-001:${connection.id}`,
        ruleId: "OPS-001",
        domain: "OPS",
        view: "OPS",
        category: "CONNECTION",
        state: "BLOCKED",
        severity: "ACTION_REQUIRED",
        priority: "HIGH",
        title: copy(
          locale,
          `${connection.user.name} 的邮件连接（${connection.emailAddress}）验证失败，请检查连接设置。`,
          `The mail connection for ${connection.user.name} (${connection.emailAddress}) failed validation. Please inspect the connection settings.`
        ),
        description: connection.lastError ?? connection.emailAddress,
        subjectType: "USER_MAIL_CONNECTION",
        subjectId: connection.id,
        project: null,
        reference: connection.emailAddress,
        objectLabel: connection.user.name,
        responsibleLabel: copy(locale, "系统管理员", "System administrators"),
        assignedTo: null,
        createdBy: person(connection.user),
        dueAt: null,
        openedAt: (
          connection.lastTestedAt ?? connection.updatedAt
        ).toISOString(),
        updatedAt: connection.updatedAt.toISOString(),
        actionTarget: {
          app: "OPS",
          resourceType: "USER_MAIL_CONNECTION",
          resourceId: connection.id,
          params: { userId: connection.userId },
        },
      })
    );
  }
  for (const connection of systemConnections) {
    items.push(
      workItem({
        id: `OPS-002:${connection.id}`,
        ruleId: "OPS-002",
        domain: "OPS",
        view: "OPS",
        category: "CONNECTION",
        state: "BLOCKED",
        severity: "BLOCKER",
        priority: "URGENT",
        title: copy(
          locale,
          `系统连接 ${connection.provider} 验证失败，请检查凭据和服务状态。`,
          `The ${connection.provider} system connection failed validation. Please inspect its credentials and service status.`
        ),
        description: connection.lastError ?? connection.provider,
        subjectType: "SYSTEM_CONNECTION",
        subjectId: connection.id,
        project: null,
        reference: connection.provider,
        objectLabel: connection.provider,
        responsibleLabel: copy(locale, "系统管理员", "System administrators"),
        assignedTo: null,
        createdBy: person(connection.updatedBy),
        dueAt: null,
        openedAt: (
          connection.lastTestedAt ?? connection.updatedAt
        ).toISOString(),
        updatedAt: connection.updatedAt.toISOString(),
        actionTarget: {
          app: "OPS",
          resourceType: "SYSTEM_CONNECTION",
          resourceId: connection.id,
          params: { provider: connection.provider },
        },
      })
    );
  }
  for (const job of [...archiveJobs, ...exportJobs]) {
    const archive = "currentPhase" in job && "artifactId" in job;
    items.push(
      workItem({
        id: `OPS-003:${archive ? "archive" : "export"}:${job.id}`,
        ruleId: "OPS-003",
        domain: "OPS",
        view: "OPS",
        category: "BACKGROUND_JOB",
        state: "BLOCKED",
        severity: "ACTION_REQUIRED",
        priority: "HIGH",
        title: copy(
          locale,
          archive
            ? `项目“${job.project.name}”（${job.project.projectCode}）的归档后台任务失败，请检查原因并安全重试。`
            : `项目“${job.project.name}”（${job.project.projectCode}）的导出后台任务失败，请检查原因并安全重试。`,
          archive
            ? `The archive background job for ${job.project.name} (${job.project.projectCode}) failed. Please inspect the cause and retry safely.`
            : `The export background job for ${job.project.name} (${job.project.projectCode}) failed. Please inspect the cause and retry safely.`
        ),
        description:
          job.errorMessage ??
          copy(
            locale,
            "请检查任务并安全重试",
            "Inspect and safely retry the job"
          ),
        subjectType: archive
          ? "PROJECT_ARCHIVE_JOB"
          : "PROJECT_FILE_EXPORT_JOB",
        subjectId: job.id,
        project: projectSummary(job.project),
        reference: job.project.projectCode,
        objectLabel: job.project.name,
        responsibleLabel: copy(locale, "系统管理员", "System administrators"),
        assignedTo: null,
        createdBy: person(job.creator),
        dueAt: null,
        openedAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        actionTarget: {
          app: "OPS",
          resourceType: archive
            ? "PROJECT_ARCHIVE_JOB"
            : "PROJECT_FILE_EXPORT_JOB",
          resourceId: job.id,
          params: { projectId: job.project.id },
        },
      })
    );
  }
  for (const session of sessions) {
    items.push(
      workItem({
        id: `OPS-004:${session.id}`,
        ruleId: "OPS-004",
        domain: "OPS",
        view: "OPS",
        category: "MASTER_SESSION",
        state: "BLOCKED",
        severity: "BLOCKER",
        priority: "HIGH",
        title: copy(
          locale,
          `文件“${session.attachment.fileName}”的 Master 会话处于 ${session.state} 状态，请恢复、释放或受控关闭。`,
          `The Master session for ${session.attachment.fileName} is in state ${session.state}. Please recover, release, or close it under control.`
        ),
        description: session.lastError ?? session.state,
        subjectType: "ZIP_MASTER_SESSION",
        subjectId: session.id,
        project: projectSummary(session.project),
        reference: session.project.projectCode,
        objectLabel: session.attachment.title ?? session.attachment.fileName,
        responsibleLabel: copy(locale, "系统管理员", "System administrators"),
        assignedTo: null,
        createdBy: person(session.user),
        dueAt: null,
        openedAt: session.updatedAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        actionTarget: {
          app: "OPS",
          resourceType: "ZIP_MASTER_SESSION",
          resourceId: session.id,
          params: {
            projectId: session.projectId,
            attachmentId: session.attachmentId,
          },
        },
      })
    );
  }
  for (const attachment of previewFailures) {
    items.push(
      workItem({
        id: `OPS-005:${attachment.id}`,
        ruleId: "OPS-005",
        domain: "OPS",
        view: "OPS",
        category: "INSPECTION",
        state: "BLOCKED",
        severity: "ACTION_REQUIRED",
        priority: "NORMAL",
        title: copy(
          locale,
          `文件“${attachment.fileName}”在系统完成 ${PREVIEW_JOB_MAX_ATTEMPTS} 次尝试后仍无法预览或检查，请处理基础设施问题。`,
          `The system could not preview or inspect ${attachment.fileName} after ${PREVIEW_JOB_MAX_ATTEMPTS} attempts. Please resolve the infrastructure issue.`
        ),
        description:
          attachment.previewError ??
          copy(
            locale,
            "系统重试后仍未成功",
            "The system still failed after retrying"
          ),
        subjectType: "ATTACHMENT_PREVIEW",
        subjectId: attachment.id,
        project: projectSummary(attachment.project),
        reference: attachment.project.projectCode,
        objectLabel: attachment.title ?? attachment.fileName,
        responsibleLabel: copy(locale, "系统管理员", "System administrators"),
        assignedTo: null,
        createdBy: person(attachment.lastModifier),
        dueAt: null,
        openedAt: (
          attachment.previewUpdatedAt ?? attachment.updatedAt
        ).toISOString(),
        updatedAt: attachment.updatedAt.toISOString(),
        actionTarget: {
          app: "OPS",
          resourceType: "ATTACHMENT",
          resourceId: attachment.id,
          params: { projectId: attachment.projectId },
        },
      })
    );
  }
  return items;
}
