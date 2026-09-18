import type { WorkItem } from "@project-wing/shared";

import type { RequestUser } from "../auth/request-user";
import type { PrismaService } from "../prisma/prisma.service";
import { copy, person, workItem } from "./work-item-common";
import type { WorkItemLocale } from "./work-item-common";

export async function buildCmpPersonalWorkItems(
  prisma: PrismaService,
  user: RequestUser,
  locale: WorkItemLocale
): Promise<WorkItem[]> {
  const [acceptanceRequests, archiveDrafts, billings] = await Promise.all([
    prisma.cmpAcceptanceRequest.findMany({
      where: {
        status: {
          in: [
            "DRAFT",
            "STAFF_EDITING",
            "PENDING_MIC",
            "PENDING_PIC",
            "PENDING_IT",
            "RETURNED",
          ],
        },
        OR: [
          { submittedById: user.id },
          { draftAssigneeId: user.id },
          { micApproverId: user.id },
          { picApproverId: user.id },
          { itApproverId: user.id },
        ],
      },
      include: {
        submittedBy: { select: { id: true, name: true, email: true } },
        draftAssignee: { select: { id: true, name: true, email: true } },
        micApprover: { select: { id: true, name: true, email: true } },
        picApprover: { select: { id: true, name: true, email: true } },
        itApprover: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.cmpEngagementArchiveDraft.findMany({
      where: {
        OR: [
          { editorUserId: user.id },
          { submittedById: user.id },
          {
            engagement: {
              OR: [{ picUserId: user.id }, { micUserId: user.id }],
            },
          },
        ],
      },
      include: {
        engagement: {
          include: {
            client: {
              select: { clientCode: true, nameEn: true, nameZh: true },
            },
            picUser: { select: { id: true, name: true, email: true } },
            micUser: { select: { id: true, name: true, email: true } },
          },
        },
      },
    }),
    prisma.cmpBilling.findMany({
      where: {
        status: { not: "RECONCILED" },
        ...(isFinance(user)
          ? {}
          : {
              OR: [
                { createdById: user.id },
                {
                  engagement: {
                    OR: [{ picUserId: user.id }, { micUserId: user.id }],
                  },
                },
              ],
            }),
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        engagement: {
          include: {
            client: {
              select: { clientCode: true, nameEn: true, nameZh: true },
            },
            picUser: { select: { id: true, name: true, email: true } },
            micUser: { select: { id: true, name: true, email: true } },
          },
        },
        financeReceipts: true,
      },
    }),
  ]);

  const items: WorkItem[] = [];
  for (const request of acceptanceRequests) {
    const task = acceptanceTaskForUser(request, user.id);
    if (!task) {
      continue;
    }
    const subject = acceptanceSubject(request, locale);
    items.push(
      workItem({
        id: `${task.ruleId}:${request.id}`,
        ruleId: task.ruleId,
        domain: "CMP",
        view: "PERSONAL",
        category: "ACCEPTANCE",
        state: task.state,
        severity: task.severity,
        priority: task.priority,
        title: contextualTaskTitle(
          locale,
          task.titleZh,
          task.titleEn,
          subject,
          request.requestNo
        ),
        description:
          task.ruleId === "CMP-006" && request.returnReason
            ? request.returnReason
            : cmpTaskExplanation(locale, task.ruleId),
        subjectType: "CMP_ACCEPTANCE",
        subjectId: request.id,
        project: null,
        reference: request.requestNo,
        objectLabel: subject,
        responsibleLabel: task.person?.name ?? user.name,
        assignedTo: person(task.person),
        createdBy: person(request.submittedBy),
        dueAt: null,
        openedAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
        actionTarget: {
          app: "CMP",
          resourceType: "CMP_ACCEPTANCE",
          resourceId: request.id,
          params: { requestId: request.id },
        },
      })
    );
  }

  for (const draft of archiveDrafts) {
    const task = archiveTaskForUser(draft, user.id);
    if (!task) {
      continue;
    }
    const client =
      draft.engagement.client.nameZh ??
      draft.engagement.client.nameEn ??
      draft.engagement.client.clientCode;
    items.push(
      workItem({
        id: `${task.ruleId}:${draft.id}`,
        ruleId: task.ruleId,
        domain: "CMP",
        view: "PERSONAL",
        category: "ENGAGEMENT_ARCHIVE",
        state: task.state,
        severity: "ACTION_REQUIRED",
        priority: task.priority,
        title: contextualTaskTitle(
          locale,
          task.titleZh,
          task.titleEn,
          client,
          draft.engagement.engagementCode
        ),
        description: cmpTaskExplanation(locale, task.ruleId),
        subjectType: "CMP_ENGAGEMENT_ARCHIVE",
        subjectId: draft.id,
        project: null,
        reference: draft.engagement.engagementCode,
        objectLabel: client,
        responsibleLabel: task.person?.name ?? user.name,
        assignedTo: person(task.person),
        createdBy: null,
        dueAt: null,
        openedAt: draft.createdAt.toISOString(),
        updatedAt: draft.updatedAt.toISOString(),
        actionTarget: {
          app: "CMP",
          resourceType: "CMP_ENGAGEMENT_ARCHIVE",
          resourceId: draft.engagementId,
          params: { engagementId: draft.engagementId },
        },
      })
    );
  }

  for (const billing of billings) {
    const task = billingTaskForUser(billing, user);
    if (!task) {
      continue;
    }
    const client =
      billing.engagement.client.nameZh ??
      billing.engagement.client.nameEn ??
      billing.engagement.client.clientCode;
    items.push(
      workItem({
        id: `${task.ruleId}:${billing.id}`,
        ruleId: task.ruleId,
        domain: "CMP",
        view: "PERSONAL",
        category: "BILLING",
        state: task.state,
        severity: task.severity,
        priority: task.priority,
        title: contextualTaskTitle(
          locale,
          task.titleZh,
          task.titleEn,
          client,
          billing.billNumber
        ),
        description:
          billing.returnReason ?? cmpTaskExplanation(locale, task.ruleId),
        subjectType: "CMP_BILLING",
        subjectId: billing.id,
        project: null,
        reference: billing.billNumber,
        objectLabel: client,
        responsibleLabel: task.responsibleLabel,
        assignedTo: null,
        createdBy: person(billing.createdBy),
        dueAt: null,
        openedAt: billing.createdAt.toISOString(),
        updatedAt: billing.updatedAt.toISOString(),
        actionTarget: {
          app: "CMP",
          resourceType: "CMP_BILLING",
          resourceId: billing.id,
          params: { billingId: billing.id, engagementId: billing.engagementId },
        },
      })
    );
  }

  await addExchangeRateTask(prisma, user, locale, items);
  return items;
}

function acceptanceTaskForUser(
  request: {
    status: string;
    submittedAt: Date | null;
    draftCompletedAt: Date | null;
    submittedById: string;
    draftAssigneeId: string | null;
    micApproverId: string;
    picApproverId: string | null;
    itApproverId: string | null;
    submittedBy: Person;
    draftAssignee: Person | null;
    micApprover: Person;
    picApprover: Person | null;
    itApprover: Person | null;
  },
  userId: string
) {
  if (
    request.status === "STAFF_EDITING" &&
    request.draftAssigneeId === userId
  ) {
    return cmpTask(
      "CMP-001",
      "完成受派承接草稿",
      "Complete assigned acceptance draft",
      request.draftAssignee
    );
  }
  if (
    request.status === "DRAFT" &&
    request.draftCompletedAt &&
    !request.submittedAt &&
    request.submittedById === userId
  ) {
    return cmpTask(
      "CMP-002",
      "复核并提交承接草稿",
      "Review and submit acceptance draft",
      request.submittedBy
    );
  }
  if (request.status === "PENDING_MIC" && request.micApproverId === userId) {
    return cmpTask(
      "CMP-003",
      "审批承接申请",
      "Approve acceptance request",
      request.micApprover
    );
  }
  if (request.status === "PENDING_PIC" && request.picApproverId === userId) {
    return cmpTask(
      "CMP-004",
      "审批承接申请",
      "Approve acceptance request",
      request.picApprover
    );
  }
  if (request.status === "PENDING_IT" && request.itApproverId === userId) {
    return cmpTask(
      "CMP-005",
      "审批承接申请",
      "Approve acceptance request",
      request.itApprover
    );
  }
  const returnRecipient = request.draftAssigneeId ?? request.submittedById;
  if (request.status === "RETURNED" && returnRecipient === userId) {
    return cmpTask(
      "CMP-006",
      "承接申请已退回修改",
      "Acceptance request was returned for revision",
      request.draftAssignee ?? request.submittedBy,
      "BLOCKED",
      "HIGH",
      "BLOCKER"
    );
  }
  return null;
}

function archiveTaskForUser(
  draft: {
    workflowStatus: string;
    editorUserId: string;
    submittedById: string | null;
    engagement: {
      picUserId: string | null;
      micUserId: string | null;
      picUser: Person | null;
      micUser: Person | null;
    };
  },
  userId: string
) {
  if (
    draft.workflowStatus === "DRAFT" &&
    (draft.editorUserId === userId || draft.engagement.micUserId === userId)
  ) {
    return cmpTask(
      "CMP-007",
      "完成 Engagement 归档草稿",
      "Complete the Engagement archive draft",
      draft.engagement.micUser
    );
  }
  if (
    draft.workflowStatus === "PENDING_PIC" &&
    draft.engagement.picUserId === userId
  ) {
    return cmpTask(
      "CMP-008",
      "审批 Engagement 归档",
      "Approve the Engagement archive",
      draft.engagement.picUser
    );
  }
  if (
    draft.workflowStatus === "RETURNED" &&
    (draft.submittedById === userId || draft.engagement.micUserId === userId)
  ) {
    return cmpTask(
      "CMP-009",
      "修改被退回的 Engagement 归档",
      "Revise returned Engagement archive",
      draft.engagement.micUser,
      "BLOCKED",
      "HIGH",
      "BLOCKER"
    );
  }
  return null;
}

function billingTaskForUser(
  billing: {
    status: string;
    returnedAt: Date | null;
    createdById: string;
    totalAmount: { toNumber: () => number };
    financeReceipts: { billCurrencyAmount: { toNumber: () => number } }[];
    engagement: {
      picUserId: string | null;
      micUserId: string | null;
      picUser: Person | null;
      micUser: Person | null;
    };
  },
  user: RequestUser
) {
  const engagementOwners = [
    billing.engagement.picUser,
    billing.engagement.micUser,
  ]
    .flatMap((item) => (item ? [item.name] : []))
    .join("、");
  if (
    billing.status === "SUBMITTED" &&
    billing.engagement.picUserId === user.id
  ) {
    return billingTask(
      "CMP-010",
      "审批账单",
      "Approve billing",
      billing.engagement.picUser?.name ?? user.name
    );
  }
  if (
    billing.status === "DRAFT" &&
    billing.returnedAt &&
    (billing.createdById === user.id ||
      billing.engagement.micUserId === user.id)
  ) {
    return billingTask(
      "CMP-011",
      "修改被退回的账单",
      "Revise returned billing",
      engagementOwners,
      "BLOCKED",
      "HIGH",
      "BLOCKER"
    );
  }
  if (
    billing.status === "APPROVED" &&
    [billing.engagement.picUserId, billing.engagement.micUserId].includes(
      user.id
    )
  ) {
    return billingTask(
      "CMP-012",
      "发送已批准账单",
      "Send approved billing",
      engagementOwners
    );
  }
  if (
    billing.status === "SENT" &&
    [billing.engagement.picUserId, billing.engagement.micUserId].includes(
      user.id
    )
  ) {
    return billingTask(
      "CMP-013",
      "跟进客户付款",
      "Follow up client payment",
      engagementOwners,
      "WAITING"
    );
  }
  if (billing.status === "CLIENT_PAID" && isFinance(user)) {
    const received = billing.financeReceipts.reduce(
      (total, receipt) => total + receipt.billCurrencyAmount.toNumber(),
      0
    );
    if (
      billing.financeReceipts.length === 0 ||
      Math.abs(received - billing.totalAmount.toNumber()) > 0.01
    ) {
      return billingTask(
        "CMP-015",
        "补齐或核对到账凭证",
        "Complete or reconcile payment evidence",
        "Finance",
        "BLOCKED",
        "HIGH",
        "BLOCKER"
      );
    }
    return billingTask(
      "CMP-014",
      "核销客户付款",
      "Reconcile client payment",
      "Finance"
    );
  }
  return null;
}

async function addExchangeRateTask(
  prisma: PrismaService,
  user: RequestUser,
  locale: WorkItemLocale,
  items: WorkItem[]
) {
  if (!isFinance(user)) {
    return;
  }
  const latest = await prisma.cmpExchangeRateBatch.findFirst({
    orderBy: [{ sourceDate: "desc" }, { fetchedAt: "desc" }],
  });
  const stale =
    !latest || Date.now() - latest.fetchedAt.getTime() > 7 * 86_400_000;
  if (!stale) {
    return;
  }
  const openedAt = latest?.fetchedAt ?? new Date(0);
  items.push(
    workItem({
      id: "CMP-017:exchange-rates",
      ruleId: "CMP-017",
      domain: "CMP",
      view: "PERSONAL",
      category: "EXCHANGE_RATE",
      state: "BLOCKED",
      severity: "ACTION_REQUIRED",
      priority: "HIGH",
      title: copy(
        locale,
        "CMP 最新汇率已超过七天或尚未建立，请刷新汇率或录入受控 fallback。",
        "CMP exchange rates are missing or more than seven days old. Please refresh them or enter a controlled fallback."
      ),
      description: copy(
        locale,
        "最新汇率已超过七天或尚未建立",
        "The latest exchange rates are over seven days old or missing"
      ),
      subjectType: "CMP_EXCHANGE_RATE",
      subjectId: "latest",
      project: null,
      reference: null,
      objectLabel: null,
      responsibleLabel: copy(
        locale,
        "财务与系统管理员",
        "Finance and system administrators"
      ),
      assignedTo: null,
      createdBy: null,
      dueAt: null,
      openedAt: openedAt.toISOString(),
      updatedAt: openedAt.toISOString(),
      actionTarget: {
        app: "CMP",
        resourceType: "CMP_EXCHANGE_RATE",
        resourceId: "latest",
        params: {},
      },
    })
  );
}

type Person = { id: string; name: string; email: string };

function cmpTask(
  ruleId: WorkItem["ruleId"],
  titleZh: string,
  titleEn: string,
  value: Person | null,
  state: "OPEN" | "WAITING" | "BLOCKED" = "OPEN",
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT" = "HIGH",
  severity: "ACTION_REQUIRED" | "WARNING" | "BLOCKER" = "ACTION_REQUIRED"
) {
  return { ruleId, titleZh, titleEn, person: value, state, priority, severity };
}

function billingTask(
  ruleId: WorkItem["ruleId"],
  titleZh: string,
  titleEn: string,
  responsibleLabel: string,
  state: "OPEN" | "WAITING" | "BLOCKED" = "OPEN",
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT" = "HIGH",
  severity: "ACTION_REQUIRED" | "WARNING" | "BLOCKER" = "ACTION_REQUIRED"
) {
  return {
    ruleId,
    titleZh,
    titleEn,
    responsibleLabel,
    state,
    priority,
    severity,
  };
}

function acceptanceSubject(
  request: {
    draftName: string | null;
    requestNo: string;
    type: string;
  },
  locale: WorkItemLocale
) {
  const draftName = request.draftName?.trim();
  if (
    draftName &&
    !new RegExp(`^${request.type}\\s+${request.requestNo}$`, "i").test(
      draftName
    )
  ) {
    return draftName;
  }
  const labels: Record<string, readonly [string, string]> = {
    CLIENT: ["客户承接申请", "Client acceptance request"],
    CLIENT_CHANGE: ["客户资料变更申请", "Client change request"],
    ENGAGEMENT: ["Engagement 承接申请", "Engagement acceptance request"],
    ENGAGEMENT_CHANGE: ["Engagement 资料变更申请", "Engagement change request"],
  };
  const label = labels[request.type] ?? [request.type, request.type];
  return copy(locale, label[0], label[1]);
}

function contextualTaskTitle(
  locale: WorkItemLocale,
  actionZh: string,
  actionEn: string,
  objectLabel: string,
  reference: string | null
) {
  const context =
    reference && !objectLabel.includes(reference)
      ? copy(
          locale,
          `${objectLabel}，${reference}`,
          `${objectLabel}, ${reference}`
        )
      : objectLabel;
  return copy(locale, `${actionZh}（${context}）`, `${actionEn} (${context})`);
}

function cmpTaskExplanation(
  locale: WorkItemLocale,
  ruleId: WorkItem["ruleId"]
) {
  const explanations: Record<string, readonly [string, string]> = {
    "CMP-001": [
      "这份承接草稿已分配给你，请完成后交回发起人复核。",
      "This acceptance draft is assigned to you. Complete it for the requester to review.",
    ],
    "CMP-002": [
      "承接草稿已经完成，正在等待你复核并正式提交。",
      "The acceptance draft is complete and waiting for you to review and submit it.",
    ],
    "CMP-003": [
      "该申请正在等待你的 MIC 审批。",
      "This request is waiting for your approval as MIC.",
    ],
    "CMP-004": [
      "该申请正在等待你的 PIC 审批。",
      "This request is waiting for your approval as PIC.",
    ],
    "CMP-005": [
      "该申请正在等待你的 IT 审批。",
      "This request is waiting for your approval as IT reviewer.",
    ],
    "CMP-006": [
      "你提交或负责的申请已被退回，请按退回意见修改后重新提交。",
      "A request you submitted or own was returned. Revise it using the return comments and submit it again.",
    ],
    "CMP-007": [
      "你是当前编辑人或该业务的 MIC；归档草稿尚未完成，需要你继续填写。",
      "You are the current editor or this Engagement's MIC. The archive draft is incomplete and needs your input.",
    ],
    "CMP-008": [
      "该 Engagement 归档正在等待你的 PIC 审批。",
      "This Engagement archive is waiting for your approval as PIC.",
    ],
    "CMP-009": [
      "你提交或负责的 Engagement 归档已被退回，请修改后重新提交。",
      "An Engagement archive you submitted or own was returned. Revise it and submit it again.",
    ],
    "CMP-010": [
      "你是该业务的 PIC；账单正在等待你的审批。",
      "You are this Engagement's PIC. The billing is waiting for your approval.",
    ],
    "CMP-011": [
      "你创建或负责的账单已被退回，请按退回意见修改。",
      "A billing you created or own was returned. Revise it using the return comments.",
    ],
    "CMP-012": [
      "你是该业务的 PIC 或 MIC；账单已经批准，下一步需要发送给客户。",
      "You are this Engagement's PIC or MIC. The billing is approved and ready to be sent to the client.",
    ],
    "CMP-013": [
      "你是该业务的 PIC 或 MIC；账单已经发送，下一步需要跟进客户付款。",
      "You are this Engagement's PIC or MIC. The billing was sent and now requires payment follow-up.",
    ],
    "CMP-014": [
      "你具有财务处理职责；客户付款与到账凭证一致，可以进行核销。",
      "You have finance responsibility. The client payment matches the receipt evidence and is ready to reconcile.",
    ],
    "CMP-015": [
      "你具有财务处理职责；到账凭证缺失或金额不一致，需要补齐或核对。",
      "You have finance responsibility. Receipt evidence is missing or does not match the amount and must be completed or reconciled.",
    ],
  };
  const explanation = explanations[ruleId] ?? [
    "请处理该事项。",
    "Review and process this item.",
  ];
  return copy(locale, explanation[0], explanation[1]);
}

function isFinance(user: RequestUser) {
  return ["PARTNER", "SENIOR_MANAGER", "MANAGER", "SUPER_ADMIN"].includes(
    user.globalRole
  );
}
