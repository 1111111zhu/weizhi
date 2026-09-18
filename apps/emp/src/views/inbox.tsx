"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bell,
  Check,
  CheckCheck,
  ClipboardCheck,
  ExternalLink,
  FileText,
  FileWarning,
  FolderKanban,
  Inbox,
  MailOpen,
  MessageSquare,
  MessageSquareReply,
  PanelLeftClose,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { createElement, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { api } from "../api/client";
import type { InboxMessage, InboxMessageType } from "../api/client";
import { EmptyState } from "../components/empty-state";
import { StatusBadge as Badge } from "../components/status-badge";
import { useI18n } from "../i18n/client";
import type { Locale } from "../i18n/settings";
import { getUserScopedQueryKey } from "../lib/access-control";
import {
  appendInboxReviewQuestionActionParams,
  resolveInboxActionHref,
} from "../lib/inbox-action-url";
import { localizeInboxMessage } from "../lib/inbox-message-content";
import { formatDisplayName } from "../lib/project-layout";
import { cn } from "../lib/utils";
import { useSurfaceTransition } from "../lib/use-surface-transition";

type FilterTab = "all" | "action" | "review" | "signoff" | "read";
type InboxDictionary = ReturnType<typeof useI18n>["dictionary"]["inbox"];

const REVIEW_MESSAGE_TYPES: InboxMessageType[] = [
  "REVIEW_QUESTION",
  "REVIEW_REPLY",
  "REVIEW_FOLLOW_UP",
  "REVIEW_REOPENED",
];
const ACTION_REQUIRED_CONTENT_KEYS = new Set([
  "PROJECT_ARCHIVE_DEADLINE_REMINDER",
  "PROJECT_ARCHIVE_REVIEW_REQUESTED",
  "PROJECT_ARCHIVE_REVIEW_RETURNED",
  "TMS_TIMESHEET_RETURNED",
]);
const DETAIL_ACTION_CLASS =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium leading-none text-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4";

function formatDateTime(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCompactDateTime(
  value: string,
  locale: Locale,
  dictionary: Pick<InboxDictionary, "today" | "yesterday">
) {
  const date = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  if (date >= today) {
    return `${dictionary.today} ${time}`;
  }
  if (date >= yesterday) {
    return `${dictionary.yesterday} ${time}`;
  }
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateLabel(
  value: string,
  locale: Locale,
  dict: Record<string, string>
) {
  const date = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  const weekAgo = new Date(today.getTime() - 7 * 86_400_000);

  if (date >= today) {
    return dict.today;
  }
  if (date >= yesterday) {
    return dict.yesterday;
  }
  if (date >= weekAgo) {
    return dict.lastSevenDays;
  }
  return dict.earlier;
}

function getMessageProject(message: InboxMessage) {
  return message.project ?? message.projectInvitation?.project ?? null;
}

function isInvitationPending(message: InboxMessage) {
  const invitation = message.projectInvitation;
  if (!invitation || invitation.status !== "PENDING") {
    return false;
  }
  return new Date(invitation.expiresAt).getTime() >= Date.now();
}

function isActionRequired(message: InboxMessage) {
  if (isInvitationPending(message)) {
    return true;
  }
  if (message.type === "ATTACHMENT_CONFLICT") {
    return true;
  }
  if (
    message.contentKey &&
    ACTION_REQUIRED_CONTENT_KEYS.has(message.contentKey)
  ) {
    return true;
  }
  if (
    ["REVIEW_QUESTION", "REVIEW_FOLLOW_UP", "REVIEW_REOPENED"].includes(
      message.type
    )
  ) {
    return message.reviewQuestion?.status !== "CLEARED";
  }
  return false;
}

function isReviewMessage(message: InboxMessage) {
  return REVIEW_MESSAGE_TYPES.includes(message.type);
}

function getMessageIcon(type: InboxMessageType): LucideIcon {
  if (type === "PROJECT_INVITATION") {
    return UserPlus;
  }
  if (type === "SIGNOFF") {
    return ClipboardCheck;
  }
  if (type === "REVIEW_REPLY") {
    return MessageSquareReply;
  }
  if (REVIEW_MESSAGE_TYPES.includes(type)) {
    return MessageSquare;
  }
  if (type === "ATTACHMENT_CONFLICT") {
    return FileWarning;
  }
  if (type === "SYSTEM_NOTIFICATION") {
    return Bell;
  }
  return Inbox;
}

function getMessageStatus(message: InboxMessage, dictionary: InboxDictionary) {
  const invitation = message.projectInvitation;
  if (invitation) {
    if (invitation.status === "USED") {
      return { label: dictionary.joined, tone: "green" as const };
    }
    if (new Date(invitation.expiresAt).getTime() < Date.now()) {
      return { label: dictionary.expired, tone: "slate" as const };
    }
    return { label: dictionary.pending, tone: "sky" as const };
  }
  if (message.reviewQuestion?.status === "CLEARED") {
    return { label: dictionary.resolvedStatus, tone: "green" as const };
  }
  if (isActionRequired(message)) {
    return { label: dictionary.actionRequiredStatus, tone: "amber" as const };
  }
  if (!message.readAt) {
    return { label: dictionary.unreadStatus, tone: "sky" as const };
  }
  return { label: dictionary.readStatus, tone: "slate" as const };
}

function getActionLabel(message: InboxMessage, dictionary: InboxDictionary) {
  if (message.type === "PROJECT_INVITATION") {
    return dictionary.openInvitation;
  }
  if (isReviewMessage(message)) {
    return dictionary.openProject;
  }
  if (message.type === "SIGNOFF") {
    return dictionary.openWorkpaper;
  }
  return dictionary.openMessageTarget;
}

function InboxSkeleton() {
  return (
    <div className="grid gap-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-md border border-border p-3">
          <div className="animate-pulse space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-md bg-muted" />
              <div className="h-5 w-52 rounded bg-muted" />
              <div className="h-5 w-16 rounded bg-muted" />
            </div>
            <div className="h-4 w-full max-w-xl rounded bg-muted" />
            <div className="h-4 w-64 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function InboxPage() {
  const queryClient = useQueryClient();
  const { dictionary, locale, localizedPath } = useI18n();
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const inboxQueryKey = getUserScopedQueryKey("inbox", me.data);
  const messages = useQuery({
    queryKey: inboxQueryKey,
    queryFn: api.inboxMessages,
    enabled: Boolean(me.data),
  });
  const markRead = useMutation({
    mutationFn: api.markInboxRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inboxQueryKey }),
  });
  const markUnread = useMutation({
    mutationFn: api.markInboxUnread,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inboxQueryKey }),
  });
  const markAllRead = useMutation({
    mutationFn: api.markAllInboxRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inboxQueryKey }),
  });
  const deleteMessage = useMutation({
    mutationFn: api.deleteInboxMessage,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inboxQueryKey }),
  });
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [filterOrientation, setFilterOrientation] = useState<
    "horizontal" | "vertical"
  >("horizontal");
  const [listPanelOpen, setListPanelOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null
  );
  const allMessages = useMemo(
    () =>
      (messages.data ?? []).map((message) =>
        localizeInboxMessage(message, dictionary.inbox)
      ),
    [dictionary.inbox, messages.data]
  );

  const filteredMessages = useMemo(() => {
    let result = allMessages;

    if (filterTab === "action") {
      result = result.filter(isActionRequired);
    } else if (filterTab === "review") {
      result = result.filter(isReviewMessage);
    } else if (filterTab === "signoff") {
      result = result.filter((message) => message.type === "SIGNOFF");
    } else if (filterTab === "read") {
      result = result.filter((message) => message.readAt);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((message) => {
        const project = getMessageProject(message);
        const searchable = [
          message.title,
          message.body,
          message.sender?.name,
          project?.projectCode,
          project?.name,
          message.workingPaper?.code,
          message.workingPaper?.title,
          message.reviewQuestion?.body,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchable.includes(query);
      });
    }

    return result;
  }, [allMessages, filterTab, searchQuery]);

  const selectedMessage =
    allMessages.find((message) => message.id === selectedMessageId) ??
    allMessages[0] ??
    null;
  const detailSurfaceRef = useSurfaceTransition<HTMLElement>(
    selectedMessage?.id ?? "empty"
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const mediaQuery = window.matchMedia("(min-width: 64rem)");
    const updateOrientation = () => {
      setFilterOrientation(mediaQuery.matches ? "vertical" : "horizontal");
    };
    updateOrientation();
    mediaQuery.addEventListener("change", updateOrientation);
    return () => mediaQuery.removeEventListener("change", updateOrientation);
  }, []);

  const tallies = useMemo(() => {
    const list = messages.data ?? [];
    return {
      all: list.length,
      action: list.filter(isActionRequired).length,
      review: list.filter(isReviewMessage).length,
      signoff: list.filter((message) => message.type === "SIGNOFF").length,
      read: list.filter((message) => message.readAt).length,
    };
  }, [messages.data]);
  const unreadCount =
    messages.data?.filter((message) => !message.readAt).length ?? 0;
  const groupedMessages = useMemo(() => {
    const groups = new Map<string, InboxMessage[]>();
    for (const message of filteredMessages) {
      const label = formatDateLabel(message.createdAt, locale, {
        today: dictionary.inbox.today,
        yesterday: dictionary.inbox.yesterday,
        lastSevenDays: dictionary.inbox.lastSevenDays,
        earlier: dictionary.inbox.earlier,
      });
      if (!groups.has(label)) {
        groups.set(label, []);
      }
      groups.get(label)?.push(message);
    }
    return [...groups.entries()];
  }, [filteredMessages, locale, dictionary.inbox]);
  const tabs: {
    id: FilterTab;
    label: string;
    count: number;
    icon: LucideIcon;
  }[] = [
    {
      id: "all",
      label: dictionary.inbox.allTab,
      count: tallies.all,
      icon: Inbox,
    },
    {
      id: "action",
      label: dictionary.inbox.actionTab,
      count: tallies.action,
      icon: Bell,
    },
    {
      id: "review",
      label: dictionary.inbox.reviewTab,
      count: tallies.review,
      icon: MessageSquareReply,
    },
    {
      id: "signoff",
      label: dictionary.inbox.signoffTab,
      count: tallies.signoff,
      icon: ClipboardCheck,
    },
    {
      id: "read",
      label: dictionary.inbox.readTab,
      count: tallies.read,
      icon: MailOpen,
    },
  ];
  const selectedTab = tabs.find((tab) => tab.id === filterTab) ?? tabs[0];
  const handleDeleteSelected = () => {
    if (!selectedMessage) {
      return;
    }
    deleteMessage.mutate(selectedMessage.id);
  };
  const handleToggleSelectedReadState = () => {
    if (!selectedMessage) {
      return;
    }
    if (selectedMessage.readAt) {
      markUnread.mutate(selectedMessage.id);
    } else {
      markRead.mutate(selectedMessage.id);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-3 px-4 py-2 md:px-6 md:py-3">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Link
            href={localizedPath("/engagement")}
            className="inline-flex h-8 items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {dictionary.common.back}
          </Link>
          <div className="h-5 w-px bg-border" />
          <h1 className="text-xl font-semibold text-foreground">
            {dictionary.inbox.title}
          </h1>
          <Badge tone={unreadCount ? "sky" : "slate"}>
            {unreadCount} {dictionary.common.unreadSuffix}
          </Badge>
        </div>
        {unreadCount > 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <CheckCheck className="h-4 w-4" />
            {dictionary.inbox.markAllRead}
          </Button>
        ) : null}
      </header>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm shadow-foreground/5">
        <div
          className={cn(
            "grid min-h-[34rem] min-w-0 lg:h-[calc(100dvh-8rem)] lg:min-h-[28rem] lg:overflow-hidden",
            listPanelOpen
              ? "lg:grid-cols-[10rem_minmax(18rem,0.8fr)_minmax(0,1.2fr)] lg:grid-rows-1 xl:grid-cols-[11.5rem_minmax(22rem,0.8fr)_minmax(0,1.2fr)]"
              : "lg:grid-cols-[11.5rem_minmax(0,1fr)] lg:grid-rows-1"
          )}
        >
          <nav
            className={cn(
              "min-w-0 border-b border-border bg-surface/40 p-2.5 lg:border-b-0 lg:border-r"
            )}
          >
            <Tabs
              value={filterTab}
              onValueChange={(value) => {
                setFilterTab(value as FilterTab);
                setListPanelOpen(true);
              }}
              orientation={filterOrientation}
              className="min-w-0"
            >
              <TabsList className="flex w-full max-w-full min-w-0 justify-start gap-2 overflow-x-auto bg-transparent p-0 group-data-[orientation=horizontal]/tabs:h-auto group-data-[orientation=vertical]/tabs:grid group-data-[orientation=vertical]/tabs:gap-1 group-data-[orientation=vertical]/tabs:overflow-x-visible">
                {tabs.map((tab) => {
                  const TabIcon = tab.icon;

                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="grid h-auto min-w-[8rem] shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center justify-start gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium group-data-[orientation=vertical]/tabs:min-w-0 data-active:bg-background data-active:text-foreground data-active:shadow-sm"
                    >
                      <TabIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{tab.label}</span>
                      <span
                        className={cn(
                          "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs",
                          filterTab === tab.id
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {tab.count}
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </nav>

          {listPanelOpen ? (
            <section className="flex min-h-[26rem] min-w-0 flex-col overflow-hidden border-b border-border bg-card lg:min-h-0 lg:border-r lg:border-b-0">
              <div className="grid gap-3 border-b border-border bg-surface/40 p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="truncate text-sm font-semibold text-foreground">
                      {selectedTab.label}
                    </h2>
                    <Badge tone="slate">{selectedTab.count}</Badge>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="text-muted-foreground"
                    tooltip={dictionary.inbox.hideList}
                    onClick={() => setListPanelOpen(false)}
                  >
                    <PanelLeftClose className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="relative">
                  <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    className="h-9 bg-background pr-8 pl-9"
                    placeholder={dictionary.inbox.searchPlaceholder}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                  {searchQuery ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setSearchQuery("")}
                      tooltip={dictionary.inbox.clearSearch}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>

              <div
                className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain p-2.5"
                data-testid="inbox-message-list-scroll"
              >
                {messages.isLoading ? <InboxSkeleton /> : null}

                {!messages.isLoading &&
                filteredMessages.length === 0 &&
                !messages.error ? (
                  searchQuery.trim() ? (
                    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border p-8 text-center">
                      <Search className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {dictionary.inbox.noSearchResults}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSearchQuery("")}
                      >
                        <X className="h-4 w-4" />
                        {dictionary.inbox.clearSearch}
                      </Button>
                    </div>
                  ) : (
                    <EmptyState
                      title={dictionary.inbox.emptyTitle}
                      description={dictionary.inbox.emptyDescription}
                    />
                  )
                ) : null}

                {!messages.isLoading && groupedMessages.length > 0 ? (
                  <div className="grid gap-3">
                    {groupedMessages.map(([dateLabel, items]) => (
                      <div key={dateLabel} className="grid gap-1">
                        <div className="flex items-center gap-3 px-2 py-1">
                          <span className="text-xs font-semibold text-muted-foreground uppercase">
                            {dateLabel}
                          </span>
                          <div className="h-px flex-1 bg-border" />
                        </div>
                        <div className="grid gap-1">
                          {items.map((message) => (
                            <MessageListItem
                              key={message.id}
                              message={message}
                              dictionary={dictionary.inbox}
                              locale={locale}
                              selected={selectedMessage?.id === message.id}
                              onSelect={() => setSelectedMessageId(message.id)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <aside
            className={cn(
              "h-full min-h-[24rem] w-full min-w-0 overflow-hidden bg-card lg:min-h-0",
              listPanelOpen
                ? ""
                : "lg:col-start-2 lg:col-end-3 lg:row-start-1 lg:row-end-2"
            )}
            data-testid="inbox-detail-pane"
            ref={detailSurfaceRef}
          >
            {selectedMessage ? (
              <MessageDetail
                message={selectedMessage}
                dictionary={dictionary.inbox}
                locale={locale}
                localizedPath={localizedPath}
                markRead={() => markRead.mutate(selectedMessage.id)}
                toggleReadState={handleToggleSelectedReadState}
                deleteMessage={handleDeleteSelected}
                readStatePending={markRead.isPending || markUnread.isPending}
                deletePending={deleteMessage.isPending}
              />
            ) : (
              <div className="grid h-full min-h-[22rem] place-items-center p-6 text-center text-sm text-muted-foreground">
                <div className="grid justify-items-center gap-3">
                  <MailOpen className="h-6 w-6" />
                  <p>{dictionary.inbox.emptyDetail}</p>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function MessageListItem({
  message,
  dictionary,
  locale,
  selected,
  onSelect,
}: {
  message: InboxMessage;
  dictionary: InboxDictionary;
  locale: Locale;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = getMessageIcon(message.type);
  const status = getMessageStatus(message, dictionary);
  const project = getMessageProject(message);
  const context = message.workingPaper
    ? `${message.workingPaper.code} ${message.workingPaper.title}`
    : project
      ? formatDisplayName(project.projectCode)
      : null;

  return (
    <Button
      type="button"
      variant="ghost"
      data-testid={`inbox-message-${message.id}`}
      aria-pressed={selected}
      className={cn(
        "group/message relative grid h-auto w-full justify-start overflow-hidden whitespace-normal rounded-lg border px-3.5 py-3 text-left transition-[background-color,border-color,box-shadow]",
        selected
          ? "border-primary/35 bg-primary/[0.065] shadow-sm shadow-primary/5"
          : message.readAt
            ? "border-transparent hover:border-border hover:bg-surface/70"
            : "border-border/70 bg-surface/55 hover:border-primary/25 hover:bg-primary/[0.045]"
      )}
      onClick={onSelect}
    >
      <span
        className={cn(
          "absolute inset-y-2 left-0 w-0.5 rounded-full transition-colors",
          selected
            ? "bg-primary"
            : message.readAt
              ? "bg-transparent"
              : status.tone === "amber"
                ? "bg-warning"
                : "bg-primary"
        )}
      />
      <span className="grid min-w-0 gap-2">
        <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
              message.readAt
                ? "border-border bg-background text-muted-foreground"
                : "border-primary/20 bg-primary/10 text-primary"
            )}
          >
            {createElement(Icon, { className: "h-3.5 w-3.5" })}
          </span>
          <span className="truncate font-medium">
            {dictionary.typeLabels[message.type]}
          </span>
          {message.readAt ? null : (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          )}
          <time className="ml-auto shrink-0 tabular-nums">
            {formatCompactDateTime(message.createdAt, locale, dictionary)}
          </time>
        </span>

        <span className="min-w-0 text-sm leading-5 font-semibold text-foreground">
          {message.title}
        </span>
        <span className="line-clamp-2 block text-sm leading-5 text-muted-foreground">
          {message.body}
        </span>
        <span className="flex min-w-0 items-center gap-2 pt-0.5 text-xs text-muted-foreground">
          <Badge
            className="shrink-0 rounded-full px-2 py-0 text-[0.6875rem]"
            tone={status.tone}
          >
            {status.label}
          </Badge>
          {message.sender?.name ? (
            <span className="shrink-0">{message.sender.name}</span>
          ) : null}
          {message.sender?.name && context ? (
            <span className="text-border">·</span>
          ) : null}
          {context ? (
            <span className="truncate font-medium text-foreground/75">
              {context}
            </span>
          ) : null}
        </span>
      </span>
    </Button>
  );
}

function MessageDetail({
  message,
  dictionary,
  locale,
  localizedPath,
  markRead,
  toggleReadState,
  deleteMessage,
  readStatePending,
  deletePending,
}: {
  message: InboxMessage;
  dictionary: InboxDictionary;
  locale: Locale;
  localizedPath: (pathname: string) => string;
  markRead: () => void;
  toggleReadState: () => void;
  deleteMessage: () => void;
  readStatePending: boolean;
  deletePending: boolean;
}) {
  const project = getMessageProject(message);
  const status = getMessageStatus(message, dictionary);
  const Icon = getMessageIcon(message.type);
  const ReadStateIcon = message.readAt ? MailOpen : Check;
  const { actionUrl } = message;
  const primaryContext = message.workingPaper
    ? {
        icon: FileText,
        label: dictionary.workingPaperLabel,
        value: `${message.workingPaper.code} ${message.workingPaper.title}`,
        secondary: project
          ? `${formatDisplayName(project.projectCode)} · ${project.name}`
          : null,
      }
    : project
      ? {
          icon: FolderKanban,
          label: dictionary.projectLabel,
          value: `${formatDisplayName(project.projectCode)} · ${project.name}`,
          secondary: project.workspace?.name ?? null,
        }
      : null;
  const PrimaryContextIcon = primaryContext?.icon;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border bg-surface/30 px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
              message.readAt
                ? "border-border bg-background text-muted-foreground"
                : "border-primary/25 bg-primary/10 text-primary"
            )}
          >
            {createElement(Icon, { className: "h-4 w-4" })}
          </span>
          <span className="truncate font-medium">
            {dictionary.typeLabels[message.type]}
          </span>
          {message.readAt ? null : (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          )}
          <time className="ml-auto shrink-0 text-xs tabular-nums">
            {formatDateTime(message.createdAt, locale)}
          </time>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Badge className="rounded-full" tone={status.tone}>
            {status.label}
          </Badge>
          {message.sender?.name ? (
            <span className="text-xs text-muted-foreground">
              {dictionary.senderLabel} · {message.sender.name}
            </span>
          ) : null}
        </div>
        <h2 className="mt-3 text-lg leading-7 font-semibold tracking-tight text-foreground">
          {message.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {message.body}
        </p>

        {primaryContext && PrimaryContextIcon ? (
          <div className="mt-5 flex min-w-0 items-center gap-3 rounded-lg border border-border bg-background/70 px-3.5 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              {createElement(PrimaryContextIcon, { className: "h-4 w-4" })}
            </span>
            <span className="min-w-0">
              <span className="block text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">
                {primaryContext.label}
              </span>
              <span className="block truncate text-sm font-medium text-foreground">
                {primaryContext.value}
              </span>
              {primaryContext.secondary ? (
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {primaryContext.secondary}
                </span>
              ) : null}
            </span>
          </div>
        ) : null}
      </div>

      <div
        className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain px-5 py-3 sm:px-6"
        data-testid="inbox-message-detail-scroll"
      >
        <dl className="divide-y divide-border text-sm">
          {project && message.workingPaper ? (
            <DetailRow
              label={dictionary.projectLabel}
              value={`${formatDisplayName(project.projectCode)} / ${project.name}`}
            />
          ) : null}
          {project?.workspace ? (
            <DetailRow
              label={dictionary.workspaceLabel}
              value={project.workspace.name}
            />
          ) : null}
          {message.projectInvitation ? (
            <>
              <DetailRow
                label={dictionary.invitedRoleLabel}
                value={message.projectInvitation.invitedRole}
              />
              <DetailRow
                label={dictionary.expiresAtLabel}
                value={formatDateTime(
                  message.projectInvitation.expiresAt,
                  locale
                )}
              />
            </>
          ) : null}
          {message.reviewQuestion ? (
            <DetailRow
              label={dictionary.reviewQuestionLabel}
              value={message.reviewQuestion.body}
            />
          ) : null}
        </dl>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border bg-surface/30 px-5 py-4 sm:px-6">
        {actionUrl ? (
          <Link
            className={cn(
              DETAIL_ACTION_CLASS,
              "border-transparent bg-transparent px-2 hover:border-transparent hover:bg-muted"
            )}
            href={resolveInboxActionHref(
              message.reviewQuestion?.id
                ? appendInboxReviewQuestionActionParams(actionUrl, {
                    reviewQuestionId: message.reviewQuestion.id,
                    attachmentId: message.reviewQuestion.attachmentId,
                    smartFormNodeId: message.reviewQuestion.smartFormNodeId,
                    smartFormRowId: message.reviewQuestion.smartFormRowId,
                    smartFormTargetLabel:
                      message.reviewQuestion.smartFormTargetLabel,
                  })
                : actionUrl,
              localizedPath
            )}
            onClick={() => {
              if (!message.readAt) {
                markRead();
              }
            }}
          >
            <ExternalLink className="h-4 w-4" />
            {getActionLabel(message, dictionary)}
          </Link>
        ) : null}
        <ButtonGroup>
          <Button
            type="button"
            variant="outline"
            className={DETAIL_ACTION_CLASS}
            disabled={readStatePending}
            onClick={toggleReadState}
          >
            {createElement(ReadStateIcon, { className: "h-4 w-4" })}
            {message.readAt ? dictionary.markUnread : dictionary.markRead}
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn(
              DETAIL_ACTION_CLASS,
              "text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            )}
            disabled={deletePending}
            onClick={deleteMessage}
          >
            <Trash2 className="h-4 w-4" />
            {dictionary.deleteMessage}
          </Button>
        </ButtonGroup>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words text-foreground">{value}</dd>
    </div>
  );
}
