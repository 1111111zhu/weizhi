import { renderWorkItemSentence } from "@project-wing/shared";
import type { WorkItem } from "@project-wing/shared";

import type { RequestUser } from "../auth/request-user";
import type { PrismaService } from "../prisma/prisma.service";
import { copy, person, projectSummary, workItem } from "./work-item-common";
import type { WorkItemLocale } from "./work-item-common";

const EMP_DECLARATION_SENTENCES = {
  system: {
    "zh-CN": "完成系统独立性声明",
    "en-US": "Complete system independence declaration",
  },
  project: {
    "zh-CN": "确认项目独立性声明（{{projectName}}，{{projectCode}}）",
    "en-US":
      "Confirm project independence declaration ({{projectName}}, {{projectCode}})",
  },
} as const;

export async function buildEmpPersonalWorkItems(
  prisma: PrismaService,
  user: RequestUser,
  locale: WorkItemLocale
): Promise<WorkItem[]> {
  const [
    systemDeclaration,
    memberships,
    declarations,
    invitations,
    failedArchives,
    failedExports,
  ] = await Promise.all([
    prisma.independenceDeclaration.findFirst({
      where: { userId: user.id, projectId: null, declarationVersion: "v1" },
      select: { id: true },
    }),
    prisma.projectMember.findMany({
      where: {
        userId: user.id,
        status: "ACTIVE",
        project: { status: { in: ["ACTIVE", "PENDING_FINAL_CHECK"] } },
      },
      include: {
        project: { select: { id: true, projectCode: true, name: true } },
      },
    }),
    prisma.independenceDeclaration.findMany({
      where: {
        userId: user.id,
        projectId: { not: null },
        declarationVersion: "v1",
      },
      select: { projectId: true, acceptedAt: true },
    }),
    prisma.inboxMessage.findMany({
      where: {
        recipientId: user.id,
        projectInvitation: { status: "PENDING", expiresAt: { gt: new Date() } },
      },
      include: {
        projectInvitation: {
          include: {
            project: { select: { id: true, projectCode: true, name: true } },
          },
        },
        sender: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.projectArchiveJob.findMany({
      where: { createdBy: user.id, status: "FAILED" },
      include: {
        project: { select: { id: true, projectCode: true, name: true } },
      },
    }),
    prisma.projectFileExportJob.findMany({
      where: { createdBy: user.id, status: "FAILED" },
      include: {
        project: { select: { id: true, projectCode: true, name: true } },
      },
    }),
  ]);

  const items: WorkItem[] = [];
  if (!systemDeclaration) {
    items.push(
      workItem({
        id: `EMP-001:${user.id}`,
        ruleId: "EMP-001",
        domain: "EMP",
        view: "PERSONAL",
        category: "DECLARATION",
        state: "BLOCKED",
        severity: "BLOCKER",
        priority: "URGENT",
        title: renderWorkItemSentence(
          locale,
          EMP_DECLARATION_SENTENCES.system,
          {}
        ),
        description: copy(
          locale,
          "完成声明后才能进入受保护的 EMP 工作区",
          "Complete the declaration before entering protected EMP workspaces"
        ),
        subjectType: "USER_DECLARATION",
        subjectId: user.id,
        project: null,
        reference: null,
        objectLabel: user.name,
        responsibleLabel: user.name,
        assignedTo: person(user),
        createdBy: null,
        dueAt: null,
        openedAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
        actionTarget: {
          app: "EMP",
          resourceType: "SYSTEM_DECLARATION",
          resourceId: user.id,
          params: {},
        },
      })
    );
  }

  const declarationMap = new Map(
    declarations.flatMap((declaration) =>
      declaration.projectId
        ? ([[declaration.projectId, declaration.acceptedAt]] as const)
        : []
    )
  );
  for (const membership of memberships) {
    const acceptedAt = declarationMap.get(membership.projectId);
    if (acceptedAt && acceptedAt >= membership.joinedAt) {
      continue;
    }
    items.push(
      workItem({
        id: `EMP-003:${membership.projectId}:${user.id}:${membership.joinedAt.toISOString()}`,
        ruleId: "EMP-003",
        domain: "EMP",
        view: "PERSONAL",
        category: "DECLARATION",
        state: "BLOCKED",
        severity: "BLOCKER",
        priority: "HIGH",
        title: renderWorkItemSentence(
          locale,
          EMP_DECLARATION_SENTENCES.project,
          {
            projectName: membership.project.name,
            projectCode: membership.project.projectCode,
          }
        ),
        description: copy(
          locale,
          "你是该项目的成员，因此需要确认项目独立性声明。",
          "You are a member of this project and must confirm its independence declaration."
        ),
        subjectType: "PROJECT_DECLARATION",
        subjectId: membership.projectId,
        project: projectSummary(membership.project),
        reference: membership.project.projectCode,
        objectLabel: membership.project.name,
        responsibleLabel: user.name,
        assignedTo: person(user),
        createdBy: null,
        dueAt: null,
        openedAt: membership.joinedAt.toISOString(),
        updatedAt: membership.joinedAt.toISOString(),
        actionTarget: {
          app: "EMP",
          resourceType: "PROJECT_DECLARATION",
          resourceId: membership.projectId,
          params: { projectId: membership.projectId },
        },
      })
    );
  }

  for (const message of invitations) {
    const invitation = message.projectInvitation;
    if (!invitation) {
      continue;
    }
    const inviter =
      message.sender?.name ??
      copy(locale, "项目管理员", "A project administrator");
    items.push(
      workItem({
        id: `EMP-002:${invitation.id}`,
        ruleId: "EMP-002",
        domain: "EMP",
        view: "PERSONAL",
        category: "INVITATION",
        state: "OPEN",
        severity: "ACTION_REQUIRED",
        priority: "HIGH",
        title: copy(
          locale,
          `处理项目邀请（${invitation.project.name}，${invitation.project.projectCode}）`,
          `Respond to project invitation (${invitation.project.name}, ${invitation.project.projectCode})`
        ),
        description: copy(
          locale,
          `${inviter}邀请你加入该项目。`,
          `${inviter} invited you to join this project.`
        ),
        subjectType: "PROJECT_INVITATION",
        subjectId: invitation.id,
        project: projectSummary(invitation.project),
        reference: invitation.project.projectCode,
        objectLabel: invitation.project.name,
        responsibleLabel: user.name,
        assignedTo: person(user),
        createdBy: person(message.sender),
        dueAt: invitation.expiresAt.toISOString(),
        openedAt: invitation.createdAt.toISOString(),
        updatedAt: message.createdAt.toISOString(),
        actionTarget: {
          app: "EMP",
          resourceType: "PROJECT_INVITATION",
          resourceId: invitation.id,
          params: { path: message.actionUrl },
        },
      })
    );
  }

  await addEngagementProjectTasks(prisma, user, locale, items);

  if (user.globalRole === "SUPER_ADMIN") {
    const projects = await prisma.project.findMany({
      where: { status: "PENDING_FINAL_CHECK" },
      select: { id: true, projectCode: true, name: true, updatedAt: true },
    });
    for (const project of projects) {
      items.push(
        workItem({
          id: `EMP-009:${project.id}`,
          ruleId: "EMP-009",
          domain: "EMP",
          view: "PERSONAL",
          category: "ARCHIVE",
          state: "OPEN",
          severity: "ACTION_REQUIRED",
          priority: "HIGH",
          title: copy(
            locale,
            `审核项目归档（${project.name}，${project.projectCode}）`,
            `Review project archive (${project.name}, ${project.projectCode})`
          ),
          description: copy(
            locale,
            "你具有系统管理员职责；该项目正在等待最终归档审核。",
            "You have system administrator responsibility. This project is waiting for final archive review."
          ),
          subjectType: "PROJECT",
          subjectId: project.id,
          project: projectSummary(project),
          reference: project.projectCode,
          objectLabel: project.name,
          responsibleLabel: copy(
            locale,
            "所有系统管理员",
            "All system administrators"
          ),
          assignedTo: null,
          createdBy: null,
          dueAt: null,
          openedAt: project.updatedAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
          actionTarget: {
            app: "EMP",
            resourceType: "PROJECT_ARCHIVE_REVIEW",
            resourceId: project.id,
            params: { projectId: project.id },
          },
        })
      );
    }
  }

  for (const job of failedArchives) {
    items.push(
      failedJobItem(locale, user, job, "EMP-011", "PROJECT_ARCHIVE_JOB")
    );
  }
  for (const job of failedExports) {
    items.push(
      failedJobItem(locale, user, job, "EMP-012", "PROJECT_FILE_EXPORT_JOB")
    );
  }
  return items;
}

async function addEngagementProjectTasks(
  prisma: PrismaService,
  user: RequestUser,
  locale: WorkItemLocale,
  items: WorkItem[]
) {
  const engagements = await prisma.cmpEngagement.findMany({
    where: {
      status: "ACTIVE",
      projects: { none: { status: { not: "DELETED" } } },
      OR: [{ picUserId: user.id }, { micUserId: user.id }],
    },
    include: {
      client: { select: { clientCode: true, nameEn: true, nameZh: true } },
      picUser: { select: { id: true, name: true, email: true } },
      micUser: { select: { id: true, name: true, email: true } },
    },
  });
  for (const engagement of engagements) {
    const approved = await prisma.cmpAcceptanceRequest.findFirst({
      where: { status: "APPROVED", targetEngagementId: engagement.id },
      select: { approvedAt: true },
      orderBy: { approvedAt: "desc" },
    });
    if (!approved) {
      continue;
    }
    items.push(
      workItem({
        id: `EMP-006:${engagement.id}`,
        ruleId: "EMP-006",
        domain: "EMP",
        view: "PERSONAL",
        category: "PROJECT_CREATION",
        state: "OPEN",
        severity: "ACTION_REQUIRED",
        priority: "HIGH",
        title: copy(
          locale,
          `建立并关联 EMP 项目（${engagement.client.nameZh ?? engagement.client.nameEn ?? engagement.client.clientCode}，${engagement.engagementCode}）`,
          `Create and link EMP project (${engagement.client.nameEn ?? engagement.client.nameZh ?? engagement.client.clientCode}, ${engagement.engagementCode})`
        ),
        description: copy(
          locale,
          "你是该业务的 PIC 或 MIC；承接申请已获批准，但尚未关联 EMP 项目。",
          "You are this Engagement's PIC or MIC. Its acceptance request is approved but it is not linked to an EMP project."
        ),
        subjectType: "CMP_ENGAGEMENT",
        subjectId: engagement.id,
        project: null,
        reference: engagement.engagementCode,
        objectLabel: engagement.client.nameZh ?? engagement.client.nameEn,
        responsibleLabel: [engagement.picUser?.name, engagement.micUser?.name]
          .filter(Boolean)
          .join("、"),
        assignedTo: null,
        createdBy: null,
        dueAt: null,
        openedAt: (approved.approvedAt ?? engagement.updatedAt).toISOString(),
        updatedAt: engagement.updatedAt.toISOString(),
        actionTarget: {
          app: "EMP",
          resourceType: "CMP_ENGAGEMENT",
          resourceId: engagement.id,
          params: { engagementId: engagement.id },
        },
      })
    );
  }
}

function failedJobItem(
  locale: WorkItemLocale,
  user: RequestUser,
  job: {
    id: string;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
    project: { id: string; projectCode: string; name: string };
  },
  ruleId: "EMP-011" | "EMP-012",
  subjectType: string
) {
  const archive = ruleId === "EMP-011";
  return workItem({
    id: `${ruleId}:${job.id}`,
    ruleId,
    domain: "EMP",
    view: "PERSONAL",
    category: archive ? "ARCHIVE" : "EXPORT",
    state: "BLOCKED",
    severity: "ACTION_REQUIRED",
    priority: "HIGH",
    title: copy(
      locale,
      archive
        ? `你发起的项目归档失败，请重试（${job.project.name}，${job.project.projectCode}）`
        : `你发起的项目文件导出失败，请重新导出（${job.project.name}，${job.project.projectCode}）`,
      archive
        ? `The project archive you started failed. Please retry it (${job.project.name}, ${job.project.projectCode})`
        : `The project file export you started failed. Please export it again (${job.project.name}, ${job.project.projectCode})`
    ),
    description:
      job.errorMessage ??
      copy(locale, "请重试或检查失败原因", "Retry or inspect the failure"),
    subjectType,
    subjectId: job.id,
    project: projectSummary(job.project),
    reference: job.project.projectCode,
    objectLabel: job.project.name,
    responsibleLabel: user.name,
    assignedTo: person(user),
    createdBy: person(user),
    dueAt: null,
    openedAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    actionTarget: {
      app: "EMP",
      resourceType: subjectType,
      resourceId: job.id,
      params: { projectId: job.project.id },
    },
  });
}
