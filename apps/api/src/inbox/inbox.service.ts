import { Injectable, Logger, Optional } from "@nestjs/common";
import type { InboxMessageType, Prisma } from "@prisma/client";
import type {
  InboxContentKey,
  InboxContentParameter,
  InboxStructuredContent,
} from "@project-wing/shared";

import { ApiNotFoundException } from "../common/api-error";
import { renderSystemEmail } from "../mail/system-email-template";
import { SystemEmailService } from "../mail/system-email.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  normalizeInboxLocale,
  resolveInboxEmailContent,
} from "./inbox-email-content";
import { resolveInboxEmailPresentation } from "./inbox-email-presentation";

const USER_SUMMARY_SELECT = {
  id: true,
  name: true,
  email: true,
  globalRole: true,
} as const;
const PROJECT_CONTEXT_SELECT = {
  id: true,
  projectCode: true,
  name: true,
  workspace: {
    select: { id: true, name: true, clientName: true },
  },
} as const;
const WORKING_PAPER_CONTEXT_SELECT = {
  id: true,
  code: true,
  title: true,
} as const;
const REVIEW_QUESTION_CONTEXT_SELECT = {
  id: true,
  workingPaperId: true,
  attachmentId: true,
  smartFormNodeId: true,
  smartFormRowId: true,
  smartFormTargetLabel: true,
  status: true,
  body: true,
  assignedTo: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} as const;
const INBOX_MESSAGE_INCLUDE = {
  sender: { select: USER_SUMMARY_SELECT },
  project: { select: PROJECT_CONTEXT_SELECT },
  workingPaper: { select: WORKING_PAPER_CONTEXT_SELECT },
  reviewQuestion: { select: REVIEW_QUESTION_CONTEXT_SELECT },
  projectInvitation: {
    include: {
      project: {
        select: PROJECT_CONTEXT_SELECT,
      },
    },
  },
} as const;

type CreateInboxCollaborationMessageBase = {
  recipientId: string;
  senderId?: string | null;
  projectId?: string | null;
  workingPaperId?: string | null;
  reviewQuestionId?: string | null;
  type: InboxMessageType;
  title: string;
  body: string;
  actionUrl?: string | null;
  suppressEmail?: boolean;
};

export type InboxEmailDeliveryInput = {
  recipientId?: string;
  recipientEmail?: string | null;
  title: string;
  body: string;
  actionUrl?: string | null;
  contentKey?: InboxContentKey | null;
  contentParams?: Record<string, InboxContentParameter> | null;
  preferredLocale?: string | null;
};

export type CreateInboxCollaborationMessageInput =
  CreateInboxCollaborationMessageBase &
    (InboxStructuredContent | { contentKey?: null; contentParams?: undefined });

export type InboxScope = "EMP" | "CMP";

function inboxScopeWhere(scope: InboxScope): Prisma.InboxMessageWhereInput {
  if (scope === "CMP") {
    return { actionUrl: { startsWith: "/cmp/" } };
  }

  return {
    OR: [{ actionUrl: null }, { actionUrl: { not: { startsWith: "/cmp/" } } }],
  };
}

@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly email?: SystemEmailService
  ) {}

  list(userId: string, scope: InboxScope = "EMP") {
    return this.prisma.inboxMessage.findMany({
      where: { recipientId: userId, ...inboxScopeWhere(scope) },
      orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
      include: INBOX_MESSAGE_INCLUDE,
    });
  }

  async markRead(messageId: string, userId: string, scope: InboxScope = "EMP") {
    const message = await this.findOwnedMessage(messageId, userId, scope);

    return this.prisma.inboxMessage.update({
      where: { id: messageId },
      data: { readAt: message.readAt ?? new Date() },
      include: INBOX_MESSAGE_INCLUDE,
    });
  }

  async markUnread(
    messageId: string,
    userId: string,
    scope: InboxScope = "EMP"
  ) {
    await this.findOwnedMessage(messageId, userId, scope);

    return this.prisma.inboxMessage.update({
      where: { id: messageId },
      data: { readAt: null },
      include: INBOX_MESSAGE_INCLUDE,
    });
  }

  async markAllRead(userId: string, scope: InboxScope = "EMP") {
    const readAt = new Date();
    const result = await this.prisma.inboxMessage.updateMany({
      where: {
        recipientId: userId,
        readAt: null,
        ...inboxScopeWhere(scope),
      },
      data: { readAt },
    });
    return { count: result.count, readAt };
  }

  async delete(messageId: string, userId: string, scope: InboxScope = "EMP") {
    await this.findOwnedMessage(messageId, userId, scope);

    await this.prisma.inboxMessage.delete({ where: { id: messageId } });
    return { id: messageId };
  }

  async createCollaborationMessage(
    input: CreateInboxCollaborationMessageInput
  ) {
    if (input.senderId && input.senderId === input.recipientId) {
      return null;
    }

    const actionUrl =
      input.actionUrl ??
      (input.projectId ? `/engagement/${input.projectId}` : null);
    const message = await this.prisma.inboxMessage.create({
      data: {
        recipientId: input.recipientId,
        senderId: input.senderId ?? null,
        projectId: input.projectId ?? null,
        workingPaperId: input.workingPaperId ?? null,
        reviewQuestionId: input.reviewQuestionId ?? null,
        type: input.type,
        title: input.title,
        body: input.body,
        contentKey: input.contentKey ?? null,
        ...(input.contentParams === undefined
          ? {}
          : { contentParams: input.contentParams }),
        actionUrl,
      },
      include: INBOX_MESSAGE_INCLUDE,
    });
    if (!input.suppressEmail) {
      await this.deliverMessageEmail({
        recipientId: input.recipientId,
        title: input.title,
        body: input.body,
        actionUrl,
        contentKey: input.contentKey ?? null,
        contentParams: input.contentParams ?? null,
      });
    }
    return message;
  }

  async deliverMessageEmail(input: InboxEmailDeliveryInput) {
    if (!this.email) {
      return { skipped: true };
    }
    const recipient = input.recipientId
      ? await this.prisma.user.findUnique({
          where: { id: input.recipientId },
          select: { email: true, preferredLocale: true },
        })
      : null;
    const recipientEmail =
      input.recipientEmail?.trim() || recipient?.email || null;
    if (!recipientEmail) {
      return { skipped: true };
    }

    const preferredLocale = input.preferredLocale ?? recipient?.preferredLocale;
    const content = resolveInboxEmailContent(
      {
        contentKey: input.contentKey,
        contentParams: input.contentParams,
        fallbackTitle: input.title,
        fallbackBody: input.body,
      },
      preferredLocale
    );
    const detailUrl = resolveInboxEmailActionUrl(
      input.actionUrl,
      content.locale
    );
    const presentation = resolveInboxEmailPresentation({
      contentKey: input.contentKey,
      contentParams: input.contentParams,
      locale: content.locale,
    });
    const text = [
      content.body,
      detailUrl
        ? `\n${content.locale === "en-US" ? "View details" : "查看详情"}：${detailUrl}`
        : null,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n");
    const rendered = renderSystemEmail({
      action: detailUrl
        ? { label: presentation.actionLabel, url: detailUrl }
        : undefined,
      body: content.body,
      brandName: "Project Wing",
      eyebrow: presentation.eyebrow,
      facts: presentation.facts,
      locale: content.locale,
      preheader: content.body,
      productName: "Project Wing",
      title: content.title,
      tone: presentation.tone,
    });
    try {
      return await this.email.send({
        html: rendered.html,
        to: recipientEmail,
        subject: `[Project Wing] ${sanitizeEmailSubject(content.title)}`,
        text,
      });
    } catch (error) {
      this.logger.warn(
        `Inbox email failed for recipient ${input.recipientId ?? recipientEmail}: ${getErrorMessage(error)}`
      );
      return { skipped: true };
    }
  }

  private async findOwnedMessage(
    messageId: string,
    userId: string,
    scope: InboxScope
  ) {
    const message = await this.prisma.inboxMessage.findFirst({
      where: {
        id: messageId,
        recipientId: userId,
        ...inboxScopeWhere(scope),
      },
    });
    if (!message) {
      throw new ApiNotFoundException(
        "MESSAGE_NOT_FOUND",
        "消息不存在或无权访问"
      );
    }
    return message;
  }
}

function resolveInboxEmailActionUrl(
  actionUrl: string | null | undefined,
  preferredLocale: string | null | undefined
) {
  if (!actionUrl?.startsWith("/")) {
    return null;
  }
  const locale = normalizeInboxLocale(preferredLocale);
  const localizedActionUrl = /^\/(?:zh-CN|en-US)(?:\/|$)/.test(actionUrl)
    ? actionUrl
    : `/${locale}${actionUrl}`;
  try {
    return new URL(
      localizedActionUrl,
      process.env.FRONTEND_URL ?? "http://localhost:3001"
    ).toString();
  } catch {
    return null;
  }
}

function sanitizeEmailSubject(subject: string) {
  return subject.replaceAll(/[\r\n]+/g, " ").trim();
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
