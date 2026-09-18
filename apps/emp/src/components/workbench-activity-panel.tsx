"use client";

import {
  Bell,
  BriefcaseBusiness,
  ChevronRight,
  CircleQuestionMark,
  FileCheck2,
  FileText,
  Info,
  Mail,
  MailOpen,
  MessageCircleQuestion,
  MessageCircleReply,
  TriangleAlert,
  UserPlus,
  X,
} from "lucide-react";
import type { ReactNode, Ref } from "react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type {
  InboxMessage,
  ProjectAttachment,
  WorkflowNode,
} from "../api/client";
import type { Dictionary } from "../i18n/dictionaries";
import type { Locale } from "../i18n/settings";
import { localizeInboxMessage } from "../lib/inbox-message-content";
import {
  getInboxMessageProjectId,
  isNotificationInboxMessage,
} from "../lib/inbox-messages";
import { formatDisplayName } from "../lib/project-layout";
import { useSurfaceTransition } from "../lib/use-surface-transition";
import { cn } from "../lib/utils";
import { EmptyState } from "./empty-state";
import { ProjectReviewQuestionsPanel } from "./project-review-questions-dialog";
import type { ProjectReviewQuestionItem } from "./project-review-questions-dialog";

const EMPTY_DEFAULT_ARRAY: never[] = [];

type WorkbenchActivityTab = "q-list" | "messages";
type MessageFilterTab = "all" | "todo";
type InboxCopy = Dictionary["inbox"];
type ReviewQuestionsCopy = Dictionary["projects"]["reviewQuestions"];

const ACTION_REQUIRED_CONTENT_KEYS = new Set([
  "PROJECT_ARCHIVE_DEADLINE_REMINDER",
  "PROJECT_ARCHIVE_REVIEW_REQUESTED",
  "PROJECT_ARCHIVE_REVIEW_RETURNED",
  "TMS_TIMESHEET_RETURNED",
]);

export function WorkbenchActivityPanel({
  workflow = EMPTY_DEFAULT_ARRAY,
  attachments = EMPTY_DEFAULT_ARRAY,
  projectId,
  reviewQuestionsCopy,
  showQuestions = true,
  showMessages = true,
  inboxCopy,
  locale,
  messages,
  messagesLoading,
  readStatePending,
  onOpenQuestion,
  onOpenMessage,
  onToggleMessageRead,
  onClose,
  className,
}: {
  workflow?: WorkflowNode[];
  attachments?: ProjectAttachment[];
  projectId?: string;
  reviewQuestionsCopy?: ReviewQuestionsCopy;
  showQuestions?: boolean;
  showMessages?: boolean;
  inboxCopy: InboxCopy;
  locale: Locale;
  messages: InboxMessage[];
  messagesLoading: boolean;
  readStatePending: boolean;
  onOpenQuestion?: (item: ProjectReviewQuestionItem) => void;
  onOpenMessage: (message: InboxMessage) => void;
  onToggleMessageRead: (message: InboxMessage) => void;
  onClose: () => void;
  className?: string;
}) {
  const shouldShowQuestions = Boolean(
    showQuestions && reviewQuestionsCopy && onOpenQuestion
  );
  const [activeTab, setActiveTab] = useState<WorkbenchActivityTab>(
    shouldShowQuestions ? "q-list" : "messages"
  );
  const [messageFilter, setMessageFilter] = useState<MessageFilterTab>("all");
  const visibleActiveTab =
    showMessages || activeTab === "q-list" ? activeTab : "q-list";
  const activitySurfaceRef = useSurfaceTransition<HTMLDivElement>(
    shouldShowQuestions ? visibleActiveTab : messageFilter
  );
  const visibleMessages = useMemo(
    () =>
      showMessages
        ? getVisibleMessages(messages, projectId)
            .filter(isNotificationInboxMessage)
            .map((message) => localizeInboxMessage(message, inboxCopy))
        : [],
    [inboxCopy, messages, projectId, showMessages]
  );
  const hasUnreadMessages = visibleMessages.some((message) => !message.readAt);
  const todoMessages = useMemo(
    () => visibleMessages.filter(isNotificationActionRequired),
    [visibleMessages]
  );

  if (!shouldShowQuestions && !showMessages) {
    return null;
  }

  if (!shouldShowQuestions) {
    return (
      <ActivityPanelShell className={className} surfaceRef={activitySurfaceRef}>
        <Tabs
          value={messageFilter}
          onValueChange={(value) => setMessageFilter(value as MessageFilterTab)}
          className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-0"
        >
          <ActivityPanelFilterHeader
            copy={inboxCopy}
            allCount={visibleMessages.length}
            todoCount={todoMessages.length}
            onClose={onClose}
          />
          <TabsContent
            value="all"
            className="min-h-0 overflow-hidden bg-background"
          >
            <WorkbenchMessagesPanel
              copy={inboxCopy}
              locale={locale}
              messages={visibleMessages}
              loading={messagesLoading}
              readStatePending={readStatePending}
              onOpenMessage={onOpenMessage}
              onToggleMessageRead={onToggleMessageRead}
            />
          </TabsContent>
          <TabsContent
            value="todo"
            className="min-h-0 overflow-hidden bg-background"
          >
            <WorkbenchMessagesPanel
              copy={inboxCopy}
              locale={locale}
              messages={todoMessages}
              loading={messagesLoading}
              readStatePending={readStatePending}
              emptyTitle={inboxCopy.todoEmptyTitle}
              emptyDescription={inboxCopy.todoEmptyDescription}
              onOpenMessage={onOpenMessage}
              onToggleMessageRead={onToggleMessageRead}
            />
          </TabsContent>
        </Tabs>
      </ActivityPanelShell>
    );
  }

  if (!reviewQuestionsCopy || !onOpenQuestion) {
    return null;
  }

  return (
    <ActivityPanelShell className={className} surfaceRef={activitySurfaceRef}>
      <h2 className="sr-only">{inboxCopy.title}</h2>
      <Tabs
        value={visibleActiveTab}
        onValueChange={(value) => setActiveTab(value as WorkbenchActivityTab)}
        className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-0"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border/70 bg-workbench-sidebar px-3 py-3">
          <TabsList
            className={cn(
              "grid h-8 w-full rounded-md border border-border/70 bg-card/80",
              showMessages ? "grid-cols-2" : "grid-cols-1"
            )}
          >
            <ActivityTabTrigger value="q-list">
              <CircleQuestionMark className="h-4 w-4" />
              <span>{reviewQuestionsCopy.trigger}</span>
            </ActivityTabTrigger>
            {showMessages ? (
              <ActivityTabTrigger value="messages">
                <span className="relative inline-flex items-center">
                  <Info className="h-4 w-4" />
                  {hasUnreadMessages ? (
                    <UnreadDot className="absolute -top-0.5 -right-1" />
                  ) : null}
                </span>
                <span>{inboxCopy.title}</span>
              </ActivityTabTrigger>
            ) : null}
          </TabsList>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            tooltip="Close"
            className="shrink-0"
            onClick={onClose}
          >
            <X data-icon="inline-start" />
          </Button>
        </div>

        <TabsContent
          value="q-list"
          className="min-h-0 overflow-hidden bg-background"
        >
          <ProjectReviewQuestionsPanel
            workflow={workflow}
            attachments={attachments}
            copy={reviewQuestionsCopy}
            locale={locale}
            onOpenQuestion={onOpenQuestion}
          />
        </TabsContent>

        {showMessages ? (
          <TabsContent
            value="messages"
            className="min-h-0 overflow-hidden bg-background"
          >
            <WorkbenchMessagesPanel
              copy={inboxCopy}
              locale={locale}
              messages={visibleMessages}
              loading={messagesLoading}
              readStatePending={readStatePending}
              onOpenMessage={onOpenMessage}
              onToggleMessageRead={onToggleMessageRead}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </ActivityPanelShell>
  );
}

function ActivityPanelShell({
  className,
  children,
  surfaceRef,
}: {
  className?: string;
  children: ReactNode;
  surfaceRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={surfaceRef}
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden bg-workbench-sidebar",
        className
      )}
    >
      {children}
    </div>
  );
}

function ActivityPanelFilterHeader({
  copy,
  allCount,
  todoCount,
  onClose,
}: {
  copy: InboxCopy;
  allCount: number;
  todoCount: number;
  onClose: () => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/70 bg-workbench-sidebar px-4 py-3.5">
      <h2 className="sr-only">{copy.title}</h2>
      <TabsList className="grid h-8 w-full max-w-60 grid-cols-2 rounded-lg bg-muted/60 p-0.5">
        <TabsTrigger
          value="all"
          aria-label={`${copy.allTab} ${allCount}`}
          className="min-w-0 gap-2 px-3"
        >
          <span>{copy.allTab}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {allCount}
          </span>
        </TabsTrigger>
        <TabsTrigger
          value="todo"
          aria-label={`${copy.todoTab} ${todoCount}`}
          className="min-w-0 gap-2 px-3"
        >
          <span>{copy.todoTab}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {todoCount}
          </span>
        </TabsTrigger>
      </TabsList>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        tooltip="Close"
        className="shrink-0"
        onClick={onClose}
      >
        <X data-icon="inline-start" />
      </Button>
    </div>
  );
}

function ActivityTabTrigger({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) {
  return (
    <TabsTrigger value={value} className="min-w-0 gap-1 px-2">
      {children}
    </TabsTrigger>
  );
}

function WorkbenchMessagesPanel({
  copy,
  locale,
  messages,
  loading,
  readStatePending,
  emptyTitle,
  emptyDescription,
  onOpenMessage,
  onToggleMessageRead,
}: {
  copy: InboxCopy;
  locale: Locale;
  messages: InboxMessage[];
  loading: boolean;
  readStatePending: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onOpenMessage: (message: InboxMessage) => void;
  onToggleMessageRead: (message: InboxMessage) => void;
}) {
  if (loading) {
    return <MessageSkeleton />;
  }
  if (messages.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          title={emptyTitle ?? copy.emptyTitle}
          description={emptyDescription ?? copy.emptyDescription}
        />
      </div>
    );
  }
  const timelineGroups = groupMessagesByTimeline(messages, copy);

  return (
    <ScrollArea className="h-full min-h-0" scrollFade scrollbarGutter>
      <div className="grid gap-5 p-3.5">
        {timelineGroups.map(([label, groupedMessages]) => (
          <section key={label} className="grid gap-2.5">
            <div className="flex items-center gap-2 px-1">
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-full bg-primary"
              />
              <h3 className="shrink-0 text-xs font-semibold text-muted-foreground">
                {label}
              </h3>
              <span
                aria-hidden="true"
                className="h-px min-w-4 flex-1 bg-border/70"
              />
            </div>
            <div className="relative grid gap-2.5 pl-3 before:absolute before:top-0 before:bottom-0 before:left-[3px] before:w-px before:bg-border/60">
              {groupedMessages.map((message) => (
                <WorkbenchMessageCard
                  key={message.id}
                  message={message}
                  copy={copy}
                  locale={locale}
                  readStatePending={readStatePending}
                  onOpenMessage={onOpenMessage}
                  onToggleMessageRead={onToggleMessageRead}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </ScrollArea>
  );
}

function WorkbenchMessageCard({
  message,
  copy,
  locale,
  readStatePending,
  onOpenMessage,
  onToggleMessageRead,
}: {
  message: InboxMessage;
  copy: InboxCopy;
  locale: Locale;
  readStatePending: boolean;
  onOpenMessage: (message: InboxMessage) => void;
  onToggleMessageRead: (message: InboxMessage) => void;
}) {
  const ReadStateIcon = message.readAt ? MailOpen : Mail;
  const context = getMessageContext(message);

  return (
    <article className="group grid gap-3.5 rounded-xl bg-muted/70 px-4 py-3.5 transition-colors duration-[var(--motion-fast)] hover:bg-muted/90 dark:bg-muted/40 dark:hover:bg-muted/60">
      <div className="flex min-w-0 items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-2">
          <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary dark:bg-primary/15">
            <MessageTypeIcon type={message.type} />
          </span>
          <span className="truncate font-medium text-foreground/75">
            {copy.typeLabels[message.type]}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <time dateTime={message.createdAt}>
            {formatDateTime(message.createdAt, locale)}
          </time>
          {message.readAt === null ? <UnreadDot /> : null}
        </span>
      </div>

      <Button
        type="button"
        variant="ghost"
        className="grid h-auto w-full min-w-0 shrink justify-stretch gap-0 rounded-lg p-0 text-left whitespace-normal hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
        onClick={() => onOpenMessage(message)}
      >
        <span className="line-clamp-2 text-base leading-6 font-semibold text-foreground">
          {message.title}
        </span>
        <span className="mt-1.5 line-clamp-2 text-sm leading-5 break-words text-muted-foreground">
          {message.body}
        </span>
      </Button>

      {context ? (
        <div className="flex min-w-0 items-center gap-2.5 rounded-lg bg-background/70 px-3 py-2.5 text-xs text-muted-foreground">
          {context.kind === "project" ? (
            <BriefcaseBusiness className="size-4 shrink-0" />
          ) : (
            <FileText className="size-4 shrink-0" />
          )}
          <span className="truncate font-medium">{context.label}</span>
        </div>
      ) : null}

      <ButtonGroup
        label={copy.quickActions}
        className="w-full items-center gap-1 border-t border-border/60 pt-2.5"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-w-0 flex-1 justify-between px-1 text-sm"
          onClick={() => onOpenMessage(message)}
        >
          <span className="truncate">{getActionLabel(message, copy)}</span>
          <ChevronRight data-icon="inline-end" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="opacity-50 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          disabled={readStatePending}
          tooltip={message.readAt ? copy.markUnread : copy.markRead}
          onClick={() => onToggleMessageRead(message)}
        >
          <ReadStateIcon />
        </Button>
      </ButtonGroup>
    </article>
  );
}

function MessageSkeleton() {
  return (
    <div className="grid gap-2.5 p-3.5">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="rounded-xl bg-muted/70 px-4 py-3.5 dark:bg-muted/40"
        >
          <div className="animate-pulse space-y-3">
            <div className="h-3 w-2/5 rounded bg-muted-foreground/10" />
            <div className="h-5 w-4/5 rounded bg-muted-foreground/10" />
            <div className="h-4 w-full rounded bg-muted-foreground/10" />
            <div className="h-9 w-full rounded-lg bg-background/60" />
          </div>
        </div>
      ))}
    </div>
  );
}

function UnreadDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("h-2 w-2 shrink-0 rounded-full bg-destructive", className)}
    />
  );
}

function getVisibleMessages(messages: InboxMessage[], projectId?: string) {
  return [
    ...(projectId
      ? messages.filter(
          (message) => getInboxMessageProjectId(message) === projectId
        )
      : messages),
  ].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)
  );
}

function groupMessagesByTimeline(messages: InboxMessage[], copy: InboxCopy) {
  const groups = new Map<string, InboxMessage[]>();
  for (const message of messages) {
    const label = getMessageTimelineLabel(message.createdAt, copy);
    const group = groups.get(label);
    if (group) {
      group.push(message);
    } else {
      groups.set(label, [message]);
    }
  }
  return [...groups.entries()];
}

function getMessageTimelineLabel(value: string, copy: InboxCopy) {
  const date = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86_400_000);

  if (date >= today) {
    return copy.today;
  }
  if (date >= yesterday) {
    return copy.yesterday;
  }
  if (date >= sevenDaysAgo) {
    return copy.lastSevenDays;
  }
  return copy.earlier;
}

function isNotificationActionRequired(message: InboxMessage) {
  const invitation = message.projectInvitation;
  if (
    invitation?.status === "PENDING" &&
    new Date(invitation.expiresAt).getTime() >= Date.now()
  ) {
    return true;
  }
  if (message.type === "ATTACHMENT_CONFLICT") {
    return true;
  }
  return Boolean(
    message.contentKey && ACTION_REQUIRED_CONTENT_KEYS.has(message.contentKey)
  );
}

function getActionLabel(message: InboxMessage, copy: InboxCopy) {
  if (message.type === "PROJECT_INVITATION") {
    return copy.openInvitation;
  }
  if (message.type === "SIGNOFF") {
    return copy.openWorkpaper;
  }
  return copy.openProject;
}

function MessageTypeIcon({ type }: { type: InboxMessage["type"] }) {
  const className = "size-3.5";
  switch (type) {
    case "PROJECT_INVITATION": {
      return <UserPlus className={className} />;
    }
    case "REVIEW_QUESTION":
    case "REVIEW_FOLLOW_UP":
    case "REVIEW_REOPENED": {
      return <MessageCircleQuestion className={className} />;
    }
    case "REVIEW_REPLY": {
      return <MessageCircleReply className={className} />;
    }
    case "SIGNOFF": {
      return <FileCheck2 className={className} />;
    }
    case "ATTACHMENT_CONFLICT": {
      return <TriangleAlert className={className} />;
    }
    default: {
      return <Bell className={className} />;
    }
  }
}

function getMessageContext(message: InboxMessage) {
  if (message.workingPaper) {
    return {
      kind: "workingPaper" as const,
      label: `${formatDisplayName(
        message.workingPaper.code
      )} ${formatDisplayName(message.workingPaper.title)}`,
    };
  }
  const project = message.project ?? message.projectInvitation?.project;
  if (!project) {
    return null;
  }
  return {
    kind: "project" as const,
    label: `${formatDisplayName(project.projectCode)} · ${formatDisplayName(
      project.name
    )}`,
  };
}

function formatDateTime(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
