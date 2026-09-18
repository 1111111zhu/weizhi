import {
  getAssignableProjectRolesForGlobalRole,
  renderWorkItemSentence,
} from "@project-wing/shared";
import type {
  GlobalRoleInput,
  ProjectRole,
  WorkItem,
} from "@project-wing/shared";

import type { RequestUser } from "../auth/request-user";
import type { PrismaService } from "../prisma/prisma.service";
import { copy, person, projectSummary, workItem } from "./work-item-common";
import type { WorkItemLocale } from "./work-item-common";

const ABNORMAL_ZIP_STATES = [
  "CHECKIN_FAILED",
  "RELEASE_FAILED",
  "RECOVERABLE",
  "BASE_VERSION_CONFLICT",
] as const;

const REVIEW_QUESTION_SENTENCE = {
  "zh-CN":
    "文件 {{file}} 下，主题为“{{topic}}”、发起人为 {{creator}} 的复核问题尚未被关闭，请关注。",
  "en-US":
    "The review question titled “{{topic}}” under file {{file}}, raised by {{creator}}, has not been cleared. Please review it.",
} as const;

export async function buildProjectTeamWorkItems(
  prisma: PrismaService,
  _user: RequestUser,
  projectId: string,
  locale: WorkItemLocale
): Promise<WorkItem[]> {
  const [
    project,
    attachments,
    questions,
    zipSessions,
    auditLogs,
    pendingLinks,
  ] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        projectCode: true,
        name: true,
        status: true,
        archiveDeadline: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        members: {
          where: { status: "ACTIVE" },
          select: {
            projectRole: true,
            inChargeRole: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                globalRole: true,
              },
            },
          },
        },
      },
    }),
    prisma.attachment.findMany({
      where: { projectId, bucket: "CURRENT", deletedAt: null },
      include: {
        workingPaper: { select: { id: true, code: true, title: true } },
        preparer: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true, email: true } },
        lockHolder: { select: { id: true, name: true, email: true } },
        lastModifier: { select: { id: true, name: true, email: true } },
        smartFormInstance: {
          select: {
            status: true,
            lastSavedAt: true,
            lastSaver: { select: { id: true, name: true, email: true } },
          },
        },
        signoffs: {
          where: { isCurrent: true, revokedAt: null },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { signedAt: "desc" },
        },
      },
    }),
    prisma.workingPaperQuestion.findMany({
      where: {
        projectId,
        status: { not: "CLEARED" },
        OR: [
          { attachmentId: null },
          { attachment: { is: { deletedAt: null } } },
        ],
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        workingPaper: { select: { id: true, code: true, title: true } },
        attachment: {
          select: { id: true, code: true, title: true, fileName: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.zipMasterSession.findMany({
      where: {
        projectId,
        state: { in: [...ABNORMAL_ZIP_STATES] },
        attachment: { deletedAt: null },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        attachment: {
          select: { id: true, code: true, title: true, fileName: true },
        },
      },
    }),
    prisma.auditLog.findMany({
      where: {
        projectId,
        action: { in: ["PROJECT_REOPENED", "PROJECT_SUBMITTED_FOR_ARCHIVE"] },
      },
      select: { action: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 1,
    }),
    prisma.tmsPendingLinkSubmission.findMany({
      where: { projectId, status: "PENDING_LINK" },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  if (!project) {
    return [];
  }
  const summary = projectSummary(project);
  const items: WorkItem[] = [];

  for (const question of questions) {
    const questionReference =
      question.attachment?.code ?? question.workingPaper.code ?? null;
    const questionObject =
      question.attachment?.title ??
      question.attachment?.fileName ??
      question.workingPaper.title;
    const questionTargetZh = questionReference
      ? `${questionReference}（${questionObject}）`
      : questionObject;
    const questionTargetEn = questionReference
      ? `${questionReference} (${questionObject})`
      : questionObject;
    items.push(
      workItem({
        id: `PRJ-005:${question.id}`,
        ruleId: "PRJ-005",
        domain: "PROJECT",
        view: "TEAM",
        category: "REVIEW",
        state: question.status === "OPEN" ? "OPEN" : "WAITING",
        severity: "BLOCKER",
        priority: "HIGH",
        title: renderWorkItemSentence(locale, REVIEW_QUESTION_SENTENCE, {
          file: locale === "zh-CN" ? questionTargetZh : questionTargetEn,
          topic: question.body,
          creator: question.createdBy.name,
        }),
        description: copy(
          locale,
          question.status === "OPEN"
            ? "复核问题尚未回复或清除"
            : "复核问题已回复，等待提出者确认并清除",
          question.status === "OPEN"
            ? "Review question is still open"
            : "Review reply is waiting for confirmation and clearance"
        ),
        subjectType: "REVIEW_QUESTION",
        subjectId: question.id,
        project: summary,
        reference: questionReference,
        objectLabel: questionObject,
        responsibleLabel: question.createdBy.name,
        assignedTo: person(question.assignedTo),
        createdBy: person(question.createdBy),
        dueAt: null,
        openedAt: question.createdAt.toISOString(),
        updatedAt: question.updatedAt.toISOString(),
        actionTarget: {
          app: "PROJECT",
          resourceType: "REVIEW_QUESTION",
          resourceId: question.id,
          params: {
            projectId,
            workingPaperId: question.workingPaperId,
            attachmentId: question.attachmentId,
          },
        },
      })
    );
  }

  for (const attachment of attachments) {
    const label = attachmentLabel(attachment);
    const reference = attachment.code ?? attachment.workingPaper?.code ?? null;
    const preparer = latestSignoff(attachment.signoffs, "PREPARER");
    const reviewer = latestSignoff(attachment.signoffs, "REVIEWER");
    const base = {
      domain: "PROJECT" as const,
      view: "TEAM" as const,
      project: summary,
      subjectType: "ATTACHMENT",
      subjectId: attachment.id,
      reference,
      objectLabel: label,
      createdBy: null,
      dueAt: null,
      openedAt: attachment.createdAt.toISOString(),
      updatedAt: attachment.updatedAt.toISOString(),
      actionTarget: {
        app: "PROJECT" as const,
        resourceType: "ATTACHMENT",
        resourceId: attachment.id,
        params: {
          projectId,
          workingPaperId: attachment.workingPaperId,
        },
      },
    };
    if (!preparer) {
      items.push(
        workItem({
          ...base,
          id: `PRJ-001:${attachment.id}`,
          ruleId: "PRJ-001",
          category: "SIGNOFF",
          state: "BLOCKED",
          severity: "BLOCKER",
          priority: "HIGH",
          title: copy(
            locale,
            `文件“${label}”尚未完成编制签核，请尽快完成。`,
            `The file “${label}” does not have a preparer sign-off. Please complete it as soon as possible.`
          ),
          description: copy(
            locale,
            "当前文件尚未完成编制签核",
            "The current file has no preparer sign-off"
          ),
          responsibleLabel:
            attachment.preparer?.name ??
            copy(locale, "项目团队", "Project team"),
          assignedTo: person(attachment.preparer),
        })
      );
    }
    if (!reviewer) {
      items.push(
        workItem({
          ...base,
          id: `PRJ-002:${attachment.id}`,
          ruleId: "PRJ-002",
          category: "SIGNOFF",
          state: "BLOCKED",
          severity: "BLOCKER",
          priority: "HIGH",
          title: copy(
            locale,
            `文件“${label}”尚未完成复核签核，请尽快完成。`,
            `The file “${label}” does not have a reviewer sign-off. Please complete it as soon as possible.`
          ),
          description: copy(
            locale,
            "当前文件尚未完成复核签核",
            "The current file has no reviewer sign-off"
          ),
          responsibleLabel:
            attachment.reviewer?.name ??
            copy(locale, "项目团队", "Project team"),
          assignedTo: person(attachment.reviewer),
        })
      );
    }
    if (preparer && reviewer && reviewer.signedAt <= preparer.signedAt) {
      items.push(
        workItem({
          ...base,
          id: `PRJ-003:${attachment.id}`,
          ruleId: "PRJ-003",
          category: "SIGNOFF",
          state: "BLOCKED",
          severity: "BLOCKER",
          priority: "HIGH",
          title: copy(
            locale,
            `文件“${label}”的复核签核未晚于编制签核，请重新形成有效的签核顺序。`,
            `The reviewer sign-off for “${label}” is not later than the preparer sign-off. Please create a valid sign-off sequence.`
          ),
          description: copy(
            locale,
            "复核签核必须晚于编制签核",
            "Reviewer sign-off must be later than preparer sign-off"
          ),
          responsibleLabel: reviewer.user.name,
          assignedTo: person(reviewer.user),
        })
      );
    }
    if (preparer && reviewer && preparer.userId === reviewer.userId) {
      items.push(
        workItem({
          ...base,
          id: `PRJ-004:${attachment.id}`,
          ruleId: "PRJ-004",
          category: "SIGNOFF",
          state: "BLOCKED",
          severity: "BLOCKER",
          priority: "URGENT",
          title: copy(
            locale,
            `文件“${label}”由同一成员完成编制和复核签核，请更换独立复核人并重新签核。`,
            `The same member prepared and reviewed “${label}”. Please assign an independent reviewer and sign it again.`
          ),
          description: copy(
            locale,
            "同一成员完成了编制和复核签核",
            "The same member prepared and reviewed the file"
          ),
          responsibleLabel: projectRoleLabel(project, locale),
          assignedTo: null,
        })
      );
    }
    if (attachment.lockedBy) {
      items.push(
        workItem({
          ...base,
          id: `PRJ-008:${attachment.id}`,
          ruleId: "PRJ-008",
          category: "FILE_VERSION",
          state: "BLOCKED",
          severity: "BLOCKER",
          priority: "HIGH",
          title: copy(
            locale,
            `文件“${label}”仍被 Master 锁定，请完成 Check-in 或释放 Master 会话。`,
            `The file “${label}” is still locked by Master. Please check it in or release the Master session.`
          ),
          description: copy(
            locale,
            "请完成 Check-in 或释放 Master 会话",
            "Check in or release the Master session"
          ),
          responsibleLabel:
            attachment.lockHolder?.name ??
            copy(locale, "项目团队", "Project team"),
          assignedTo: person(attachment.lockHolder),
        })
      );
    }
    if (attachment.conflictFrozenAt) {
      items.push(
        workItem({
          ...base,
          id: `PRJ-009:${attachment.id}`,
          ruleId: "PRJ-009",
          category: "FILE_VERSION",
          state: "BLOCKED",
          severity: "BLOCKER",
          priority: "URGENT",
          title: copy(
            locale,
            `文件“${label}”存在版本冲突并已被冻结，请由 PIC 或 Partner 选择保留版本。`,
            `The file “${label}” is frozen because of a version conflict. A PIC or Partner must select the retained version.`
          ),
          description: copy(
            locale,
            "文件被冻结，PIC/Partner 需要选择保留版本",
            "The file is frozen until a PIC or Partner resolves the version conflict"
          ),
          responsibleLabel: projectRoleLabel(project, locale),
          assignedTo: null,
          openedAt: attachment.conflictFrozenAt.toISOString(),
        })
      );
    }
    if (attachment.smartFormInstance?.status === "INCOMPLETE") {
      items.push(
        workItem({
          ...base,
          id: `PRJ-010:${attachment.id}`,
          ruleId: "PRJ-010",
          category: "SMART_FORM",
          state: "BLOCKED",
          severity: "BLOCKER",
          priority: "HIGH",
          title: copy(
            locale,
            `SmartForm“${label}”仍有必填规则未通过，请尽快补充完整。`,
            `The SmartForm “${label}” still has incomplete required rules. Please complete it as soon as possible.`
          ),
          description: copy(
            locale,
            "必填规则尚未全部通过",
            "Required SmartForm rules are not complete"
          ),
          responsibleLabel: copy(locale, "项目团队", "Project team"),
          assignedTo: null,
          updatedAt: (
            attachment.smartFormInstance.lastSavedAt ?? attachment.updatedAt
          ).toISOString(),
        })
      );
    }
    // Preview infrastructure failures belong exclusively to OPS-005. A file's
    // preparer/last modifier cannot repair conversion or storage infrastructure.
  }

  for (const session of zipSessions) {
    items.push(
      workItem({
        id: `PRJ-016:${session.id}`,
        ruleId: "PRJ-016",
        domain: "PROJECT",
        view: "TEAM",
        category: "FILE_VERSION",
        state: "BLOCKED",
        severity: "BLOCKER",
        priority: "HIGH",
        title: copy(
          locale,
          `文件“${session.attachment.fileName}”的 Master 会话处于 ${session.state} 状态，请恢复、解决冲突或受控关闭。`,
          `The Master session for “${session.attachment.fileName}” is in state ${session.state}. Please recover it, resolve the conflict, or close it under control.`
        ),
        description: copy(
          locale,
          `当前状态：${session.state}`,
          `Current state: ${session.state}`
        ),
        subjectType: "ZIP_MASTER_SESSION",
        subjectId: session.id,
        project: summary,
        reference: session.attachment.code ?? null,
        objectLabel: session.attachment.title ?? session.attachment.fileName,
        responsibleLabel: session.user.name,
        assignedTo: person(session.user),
        createdBy: person(session.user),
        dueAt: null,
        openedAt: session.updatedAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        actionTarget: {
          app: "PROJECT",
          resourceType: "ATTACHMENT",
          resourceId: session.attachmentId,
          params: { projectId },
        },
      })
    );
  }

  addProjectProcessItems(items, project, auditLogs[0], pendingLinks, locale);
  return items;
}

export async function buildProjectPersonalWorkItems(
  prisma: PrismaService,
  user: RequestUser,
  locale: WorkItemLocale,
  projectId?: string
) {
  const memberships = projectId
    ? [{ projectId }]
    : await prisma.projectMember.findMany({
        where: {
          userId: user.id,
          status: "ACTIVE",
          project: { status: { not: "DELETED" } },
        },
        select: { projectId: true },
      });
  const groups = await Promise.all(
    memberships.map((membership) =>
      buildProjectTeamWorkItems(prisma, user, membership.projectId, locale)
    )
  );
  return groups.flatMap((items) =>
    items
      .filter((item) => isPersonalProjectItem(item, user.id))
      .map((item) => projectPersonalProjection(item, locale, user.id))
  );
}

export function projectPersonalProjection(
  item: WorkItem,
  locale: WorkItemLocale,
  userId: string
): WorkItem {
  const label = item.objectLabel ?? item.reference ?? item.title;
  const createdByCurrentUser = item.createdBy?.id === userId;
  const personalTitle =
    item.ruleId === "PRJ-001"
      ? copy(
          locale,
          `文件“${label}”需要你的编制签核，请完成签核。`,
          `The file “${label}” requires your preparer sign-off. Please complete it as soon as possible.`
        )
      : item.ruleId === "PRJ-002"
        ? copy(
            locale,
            `文件“${label}”需要你的复核签核，请完成签核。`,
            `The file “${label}” requires your reviewer sign-off. Please complete it as soon as possible.`
          )
        : item.ruleId === "PRJ-003"
          ? copy(
              locale,
              `你已复核签核的文件“${label}”签核顺序已失效，请重新完成复核签核。`,
              `The sign-off sequence for “${label}”, which you reviewed, is no longer valid. Please complete the reviewer sign-off again.`
            )
          : item.ruleId === "PRJ-005"
            ? createdByCurrentUser
              ? item.state === "WAITING"
                ? copy(
                    locale,
                    `你在文件“${label}”下发起的复核问题已有回复，请确认并清除。`,
                    `The review question you opened under “${label}” has a reply. Please confirm and clear it.`
                  )
                : copy(
                    locale,
                    `你在文件“${label}”下发起的复核问题尚未关闭，请关注。`,
                    `The review question you opened under “${label}” has not been cleared. Please review it.`
                  )
              : copy(
                  locale,
                  `文件“${label}”下有一条复核问题已分配给你，请处理。`,
                  `A review question under “${label}” is assigned to you. Please address it.`
                )
            : item.ruleId === "PRJ-008"
              ? copy(
                  locale,
                  `你打开的 Master 文件“${label}”仍处于锁定状态，请完成 Check-in 或释放会话。`,
                  `The Master file “${label}” that you opened is still locked. Please check it in or release the session.`
                )
              : item.ruleId === "PRJ-016"
                ? copy(
                    locale,
                    `你打开的文件“${label}”仍有未正常结束的 Master 会话，请恢复、解决冲突或受控关闭。`,
                    `The file “${label}” that you opened still has an unfinished Master session. Please recover it, resolve the conflict, or close it under control.`
                  )
                : item.title;
  return { ...item, view: "PERSONAL", title: personalTitle };
}

export function isPersonalProjectItem(item: WorkItem, userId: string) {
  if (item.ruleId === "PRJ-010" || item.ruleId === "PRJ-015") {
    return false;
  }
  if (item.ruleId === "PRJ-005") {
    return (
      item.createdBy?.id === userId ||
      (item.state === "OPEN" && item.assignedTo?.id === userId)
    );
  }
  return item.assignedTo?.id === userId;
}

function latestSignoff<T extends { type: string }>(items: T[], type: string) {
  return items.find((item) => item.type === type);
}

function attachmentLabel(attachment: {
  code: string | null;
  title: string | null;
  originalName: string | null;
  fileName: string;
  workingPaper: { code: string; title: string } | null;
}) {
  return (
    attachment.title ??
    attachment.originalName ??
    attachment.workingPaper?.title ??
    attachment.fileName
  );
}

function projectRoleLabel(
  project: {
    members: { inChargeRole: string | null; user: { name: string } }[];
  },
  locale: WorkItemLocale
) {
  const names = project.members
    .filter((member) => Boolean(member.inChargeRole))
    .map((member) => member.user.name);
  return names.length > 0
    ? names.join("、")
    : copy(locale, "项目 PIC/MIC", "Project PIC/MIC");
}

function addProjectProcessItems(
  items: WorkItem[],
  project: {
    id: string;
    projectCode: string;
    name: string;
    status: string;
    archiveDeadline: Date;
    createdAt: Date;
    updatedAt: Date;
    members: {
      projectRole: ProjectRole;
      inChargeRole: string | null;
      user: {
        id: string;
        name: string;
        email: string;
        globalRole: GlobalRoleInput;
      };
    }[];
  },
  latestArchiveAudit: { action: string; createdAt: Date } | undefined,
  pendingLinks: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    owner: { id: string; name: string; email: string };
  }[],
  locale: WorkItemLocale
) {
  const summary = projectSummary(project);
  const baseTarget = {
    app: "EMP" as const,
    resourceType: "PROJECT",
    resourceId: project.id,
    params: {},
  };
  const inconsistent = project.members.filter(
    (member) =>
      !getAssignableProjectRolesForGlobalRole(member.user.globalRole).includes(
        member.projectRole
      )
  );
  for (const member of inconsistent) {
    items.push(
      workItem({
        id: `EMP-004:${project.id}:${member.user.id}`,
        ruleId: "EMP-004",
        domain: "EMP",
        view: "TEAM",
        category: "PROJECT_PROCESS",
        state: "BLOCKED",
        severity: "BLOCKER",
        priority: "HIGH",
        title: copy(
          locale,
          `${member.user.name} 在项目“${project.name}”中的职责与账号职级不一致，请调整成员职责。`,
          `${member.user.name}'s role in “${project.name}” is inconsistent with their global rank. Please update the project role.`
        ),
        description: copy(
          locale,
          `账号职级 ${member.user.globalRole} 不允许项目职责 ${member.projectRole}`,
          `Global role ${member.user.globalRole} cannot hold project role ${member.projectRole}`
        ),
        subjectType: "PROJECT_MEMBER",
        subjectId: member.user.id,
        project: summary,
        reference: project.projectCode,
        objectLabel: project.name,
        responsibleLabel: projectRoleLabel(project, locale),
        assignedTo: null,
        createdBy: null,
        dueAt: null,
        openedAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        actionTarget: baseTarget,
      })
    );
  }

  const hasPartner = project.members.some(
    (member) => member.projectRole === "PARTNER"
  );
  const hasPic = project.members.some(
    (member) => member.inChargeRole === "PARTNER_IN_CHARGE"
  );
  const hasMic = project.members.some(
    (member) => member.inChargeRole === "MANAGER_IN_CHARGE"
  );
  if (!hasPartner || !hasPic || !hasMic) {
    items.push(
      workItem({
        id: `EMP-005:${project.id}`,
        ruleId: "EMP-005",
        domain: "EMP",
        view: "TEAM",
        category: "PROJECT_PROCESS",
        state: "BLOCKED",
        severity: "BLOCKER",
        priority: "HIGH",
        title: copy(
          locale,
          `项目“${project.name}”缺少有效的 Partner、PIC 或 MIC，请补齐责任结构。`,
          `The project “${project.name}” does not have a complete Partner, PIC, and MIC structure. Please complete it.`
        ),
        description: copy(
          locale,
          "项目需要有效的 Partner、PIC 和 MIC",
          "The project needs an active Partner, PIC, and MIC"
        ),
        subjectType: "PROJECT",
        subjectId: project.id,
        project: summary,
        reference: project.projectCode,
        objectLabel: project.name,
        responsibleLabel: projectRoleLabel(project, locale),
        assignedTo: null,
        createdBy: null,
        dueAt: null,
        openedAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        actionTarget: baseTarget,
      })
    );
  }

  const days = Math.ceil(
    (project.archiveDeadline.getTime() - Date.now()) / 86_400_000
  );
  if (project.status === "ACTIVE" && days <= 10) {
    const overdue = days < 0;
    items.push(
      workItem({
        id: `${overdue ? "EMP-008" : "EMP-007"}:${project.id}`,
        ruleId: overdue ? "EMP-008" : "EMP-007",
        domain: "EMP",
        view: "TEAM",
        category: "PROJECT_PROCESS",
        state: overdue ? "BLOCKED" : "OPEN",
        severity: overdue ? "BLOCKER" : "ACTION_REQUIRED",
        priority: overdue ? "URGENT" : days <= 1 ? "HIGH" : "NORMAL",
        title: copy(
          locale,
          overdue
            ? `完成逾期归档（${project.name}，${project.projectCode}，已逾期 ${Math.abs(days)} 天）`
            : `准备项目归档（${project.name}，${project.projectCode}，距截止 ${days} 天）`,
          overdue
            ? `Complete overdue archive (${project.name}, ${project.projectCode}, ${Math.abs(days)} day(s) overdue)`
            : `Prepare project archive (${project.name}, ${project.projectCode}, due in ${days} day(s))`
        ),
        description: copy(
          locale,
          overdue ? `已逾期 ${Math.abs(days)} 天` : `距离归档截止日 ${days} 天`,
          overdue
            ? `${Math.abs(days)} day(s) overdue`
            : `${days} day(s) until the archive deadline`
        ),
        subjectType: "PROJECT",
        subjectId: project.id,
        project: summary,
        reference: project.projectCode,
        objectLabel: project.name,
        responsibleLabel: copy(locale, "项目全体", "Project team"),
        assignedTo: null,
        createdBy: null,
        dueAt: project.archiveDeadline.toISOString(),
        openedAt: new Date(
          project.archiveDeadline.getTime() - 10 * 86_400_000
        ).toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        actionTarget: baseTarget,
      })
    );
  }

  if (
    project.status === "ACTIVE" &&
    latestArchiveAudit?.action === "PROJECT_REOPENED"
  ) {
    items.push(
      workItem({
        id: `EMP-010:${project.id}:${latestArchiveAudit.createdAt.toISOString()}`,
        ruleId: "EMP-010",
        domain: "EMP",
        view: "TEAM",
        category: "PROJECT_PROCESS",
        state: "OPEN",
        severity: "ACTION_REQUIRED",
        priority: "HIGH",
        title: copy(
          locale,
          `项目“${project.name}”的归档审核已被退回，请修正问题后重新提交。`,
          `The archive review for “${project.name}” was returned. Please resolve the issues and resubmit it.`
        ),
        description: copy(
          locale,
          "请修正问题后重新提交归档",
          "Resolve the issues and resubmit the project for archive"
        ),
        subjectType: "PROJECT",
        subjectId: project.id,
        project: summary,
        reference: project.projectCode,
        objectLabel: project.name,
        responsibleLabel: copy(locale, "项目全体", "Project team"),
        assignedTo: null,
        createdBy: null,
        dueAt: project.archiveDeadline.toISOString(),
        openedAt: latestArchiveAudit.createdAt.toISOString(),
        updatedAt: latestArchiveAudit.createdAt.toISOString(),
        actionTarget: baseTarget,
      })
    );
  }

  for (const link of pendingLinks) {
    items.push(
      workItem({
        id: `TMS-008:${link.id}`,
        ruleId: "TMS-008",
        domain: "TMS",
        view: "TEAM",
        category: "PROJECT_PROCESS",
        state: "BLOCKED",
        severity: "ACTION_REQUIRED",
        priority: "NORMAL",
        title: copy(
          locale,
          `关联 TMS 工时与 Engagement（${project.name}，${project.projectCode}）`,
          `Link TMS time to Engagement (${project.name}, ${project.projectCode})`
        ),
        description: copy(
          locale,
          `${link.owner.name} 提交的 TMS 工时尚未关联 Engagement。`,
          `TMS time submitted by ${link.owner.name} is not linked to an Engagement.`
        ),
        subjectType: "TMS_PENDING_LINK",
        subjectId: link.id,
        project: summary,
        reference: project.projectCode,
        objectLabel: project.name,
        responsibleLabel: copy(locale, "项目全体", "Project team"),
        assignedTo: null,
        createdBy: person(link.owner),
        dueAt: null,
        openedAt: link.createdAt.toISOString(),
        updatedAt: link.updatedAt.toISOString(),
        actionTarget: baseTarget,
      })
    );
  }
}
