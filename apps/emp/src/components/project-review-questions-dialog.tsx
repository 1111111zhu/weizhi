"use client";

import {
  ChevronRight,
  FileText,
  FolderOpen,
  LocateFixed,
  MessageSquareText,
  Paperclip,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type {
  Attachment,
  ProjectAttachment,
  WorkflowNode,
  WorkingPaper,
  WorkingPaperQuestion,
} from "../api/client";
import type { Dictionary } from "../i18n/dictionaries";
import { formatDisplayName } from "../lib/project-layout";
import { useSurfaceTransition } from "../lib/use-surface-transition";

const EMPTY_DEFAULT_ARRAY: never[] = [];

type ProjectQListCopy = Dictionary["projects"]["reviewQuestions"];

export type ProjectReviewQuestionItem = {
  question: WorkingPaperQuestion;
  paper: Pick<WorkingPaper, "id" | "code" | "title">;
  attachment?: Pick<
    Attachment,
    "id" | "code" | "title" | "fileName" | "originalName"
  >;
  nodeId: string;
  path: string;
};

type ProjectReviewQuestionFilter = "all" | "unresolved" | "replied" | "cleared";

export function ProjectReviewQuestionsDialog({
  workflow,
  attachments = EMPTY_DEFAULT_ARRAY,
  copy,
  locale,
  onOpenQuestion,
}: {
  workflow: WorkflowNode[];
  attachments?: ProjectAttachment[];
  copy: ProjectQListCopy;
  locale: string;
  onOpenQuestion: (item: ProjectReviewQuestionItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const items = useMemo(
    () => collectProjectReviewQuestionItems(workflow, attachments),
    [attachments, workflow]
  );
  const counts = useMemo(() => getProjectReviewQuestionCounts(items), [items]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="relative gap-1 rounded-full px-2"
        onClick={() => setOpen(true)}
        tooltip={copy.trigger}
      >
        <MessageSquareText className="h-4 w-4" />
        {counts.unresolved > 0 ? (
          <span className="ml-0.5 min-w-4 rounded-full bg-primary px-1.5 py-0.5 text-center text-[10px] leading-none font-semibold text-primary-foreground">
            {counts.unresolved}
          </span>
        ) : null}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-[min(54rem,calc(100vw-1rem))] max-w-none gap-0 overflow-hidden p-0 sm:max-w-none"
        >
          <SheetHeader className="border-b border-border/70 bg-muted/30 px-5 py-4">
            <div className="flex items-start justify-between gap-4 pr-8">
              <div className="min-w-0">
                <SheetTitle>{copy.title}</SheetTitle>
              </div>
            </div>
          </SheetHeader>

          <ProjectReviewQuestionsPanel
            workflow={workflow}
            attachments={attachments}
            copy={copy}
            locale={locale}
            onOpenQuestion={(item) => {
              setOpen(false);
              onOpenQuestion(item);
            }}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

export function ProjectReviewQuestionsPanel({
  workflow,
  attachments = EMPTY_DEFAULT_ARRAY,
  copy,
  locale,
  onOpenQuestion,
  className = "",
}: {
  workflow: WorkflowNode[];
  attachments?: ProjectAttachment[];
  copy: ProjectQListCopy;
  locale: string;
  onOpenQuestion: (item: ProjectReviewQuestionItem) => void;
  className?: string;
}) {
  const [filter, setFilter] = useState<ProjectReviewQuestionFilter>("all");
  const questionListSurfaceRef = useSurfaceTransition<HTMLDivElement>(filter);
  const items = useMemo(
    () => collectProjectReviewQuestionItems(workflow, attachments),
    [attachments, workflow]
  );
  const counts = useMemo(() => getProjectReviewQuestionCounts(items), [items]);
  const filteredItems = useMemo(
    () => filterProjectReviewQuestionItems(items, filter),
    [filter, items]
  );
  const timelineGroups = useMemo(
    () => groupReviewQuestionItemsByTimeline(filteredItems, copy),
    [copy, filteredItems]
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [locale]
  );

  return (
    <div
      className={`grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] ${className}`}
    >
      <Tabs
        value={filter}
        onValueChange={(value) =>
          setFilter(value as ProjectReviewQuestionFilter)
        }
        className="border-b border-border/60 px-4 py-3"
      >
        <TabsList className="grid h-8 w-full grid-cols-4 rounded-lg bg-muted/60 p-0.5">
          {(["all", "unresolved", "replied", "cleared"] as const).map(
            (filterId) => (
              <TabsTrigger
                key={filterId}
                value={filterId}
                aria-label={`${copy.filters[filterId]} ${counts[filterId]}`}
                className="h-[calc(100%-1px)] min-w-0 gap-1.5 px-2 text-xs sm:text-sm"
              >
                <span className="truncate">{copy.filters[filterId]}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {counts[filterId]}
                </span>
              </TabsTrigger>
            )
          )}
        </TabsList>
      </Tabs>

      <ScrollArea className="min-h-0 bg-background" scrollFade scrollbarGutter>
        <div ref={questionListSurfaceRef} className="min-h-full">
          {filteredItems.length ? (
            <div className="grid gap-5 p-3.5">
              {timelineGroups.map(([label, groupedItems]) => (
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
                    {groupedItems.map((item) => (
                      <ProjectReviewQuestionCard
                        key={item.question.id}
                        item={item}
                        copy={copy}
                        dateFormatter={dateFormatter}
                        onOpenQuestion={onOpenQuestion}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="p-4">
              <ProjectReviewQuestionsEmptyState
                hasItems={items.length > 0}
                copy={copy}
              />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ProjectReviewQuestionCard({
  item,
  copy,
  dateFormatter,
  onOpenQuestion,
}: {
  item: ProjectReviewQuestionItem;
  copy: ProjectQListCopy;
  dateFormatter: Intl.DateTimeFormat;
  onOpenQuestion: (item: ProjectReviewQuestionItem) => void;
}) {
  return (
    <article className="group grid gap-3.5 rounded-xl bg-muted/70 px-4 py-3.5 transition-colors duration-[var(--motion-fast)] hover:bg-muted/90 dark:bg-muted/40 dark:hover:bg-muted/60">
      <div className="flex min-w-0 items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-2">
          <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary dark:bg-primary/15">
            <MessageSquareText className="size-3.5" />
          </span>
          <span className="truncate font-medium text-foreground/75">
            {copy.trigger}
          </span>
          <span aria-hidden="true">·</span>
          <span className="truncate">
            {copy.statusLabels[item.question.status]}
          </span>
        </span>
        <time className="shrink-0" dateTime={item.question.updatedAt}>
          {formatDate(dateFormatter, item.question.updatedAt)}
        </time>
      </div>

      <Button
        type="button"
        variant="ghost"
        className="grid h-auto w-full min-w-0 shrink justify-stretch gap-0 rounded-lg p-0 text-left whitespace-normal hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
        onClick={() => onOpenQuestion(item)}
      >
        <span className="line-clamp-2 min-w-0 text-base leading-6 font-semibold text-foreground">
          {item.question.body}
        </span>
      </Button>

      <div className="grid w-full gap-1.5 rounded-lg bg-background/70 px-3 py-2.5 text-xs text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate text-sm font-medium text-foreground">
            {formatPaperLabel(item.paper)}
          </span>
        </span>
        {item.attachment ? (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {formatAttachmentLabel(item.attachment)}
            </span>
          </span>
        ) : null}
        {item.path ? (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{item.path}</span>
          </span>
        ) : null}
        {item.question.smartFormTargetLabel ? (
          <span className="inline-flex min-w-0 items-center gap-1.5 text-primary/85">
            <LocateFixed className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {item.question.smartFormTargetLabel}
            </span>
          </span>
        ) : null}
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <UserRound className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {item.question.assignedTo?.name ?? copy.unassigned}
          </span>
        </span>
      </div>

      <div className="border-t border-border/60 pt-2.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-between px-1 text-sm"
          onClick={() => onOpenQuestion(item)}
        >
          {copy.openQuestion}
          <ChevronRight data-icon="inline-end" />
        </Button>
      </div>
    </article>
  );
}

function ProjectReviewQuestionsEmptyState({
  hasItems,
  copy,
}: {
  hasItems: boolean;
  copy: ProjectQListCopy;
}) {
  return (
    <div className="flex min-h-[12rem] items-center gap-3 rounded-xl bg-muted/70 px-4 py-4 text-left dark:bg-muted/40">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/15">
        <MessageSquareText className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">
          {hasItems ? copy.noMatchesTitle : copy.emptyTitle}
        </p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {hasItems ? copy.noMatchesDescription : copy.emptyDescription}
        </p>
      </div>
    </div>
  );
}

export function collectProjectReviewQuestionItems(
  nodes: WorkflowNode[],
  projectAttachments: ProjectAttachment[] = []
): ProjectReviewQuestionItem[] {
  const itemsByQuestionId = new Map<string, ProjectReviewQuestionItem>();
  const paperLocations = new Map<
    string,
    {
      paper: WorkingPaper;
      nodeId: string;
      path: string;
    }
  >();

  function addItem(item: ProjectReviewQuestionItem) {
    const existing = itemsByQuestionId.get(item.question.id);
    if (!existing || (!existing.attachment && item.attachment)) {
      itemsByQuestionId.set(item.question.id, item);
    }
  }

  function visit(
    node: WorkflowNode,
    ancestors: { code: string; title: string }[]
  ) {
    const currentPath = [...ancestors, { code: node.code, title: node.title }];
    const path = currentPath.map(formatPathSegment).filter(Boolean).join(" / ");
    for (const paper of node.workingPapers ?? []) {
      paperLocations.set(paper.id, { paper, nodeId: node.id, path });
      for (const question of paper.reviewQuestions ?? []) {
        const attachment = question.attachmentId
          ? paper.attachments?.find(
              (candidate) => candidate.id === question.attachmentId
            )
          : undefined;
        addItem({
          question,
          paper: {
            id: paper.id,
            code: paper.code,
            title: paper.title,
          },
          attachment,
          nodeId: node.id,
          path,
        });
      }
      for (const attachment of paper.attachments ?? []) {
        for (const question of attachment.reviewQuestions ?? []) {
          addItem({
            question,
            paper: {
              id: paper.id,
              code: paper.code,
              title: paper.title,
            },
            attachment,
            nodeId: node.id,
            path,
          });
        }
      }
    }

    for (const child of node.children ?? []) {
      visit(child, currentPath);
    }
  }

  for (const node of nodes) {
    visit(node, []);
  }

  for (const attachment of projectAttachments) {
    const paperId = attachment.workingPaper?.id ?? attachment.workingPaperId;
    if (!paperId) {
      continue;
    }

    const location = paperLocations.get(paperId);
    const paper = location?.paper ?? attachment.workingPaper;
    if (!paper) {
      continue;
    }

    const nodeId =
      location?.nodeId ??
      attachment.workingPaper?.workflowNodeId ??
      attachment.workflowNodeId ??
      "";
    const path =
      location?.path ??
      attachment.workingPaper?.path
        ?.map(formatPathSegment)
        .filter(Boolean)
        .join(" / ") ??
      "";
    const attachmentQuestions = new Map<string, WorkingPaperQuestion>();
    for (const question of attachment.reviewQuestions ?? []) {
      attachmentQuestions.set(question.id, question);
    }
    for (const question of attachmentQuestions.values()) {
      addItem({
        question,
        paper: {
          id: paper.id,
          code: paper.code,
          title: paper.title,
        },
        attachment,
        nodeId,
        path,
      });
    }
  }

  return [...itemsByQuestionId.values()].sort((left, right) => {
    const timeDiff =
      Date.parse(right.question.updatedAt) -
      Date.parse(left.question.updatedAt);
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return formatPaperLabel(left.paper).localeCompare(
      formatPaperLabel(right.paper)
    );
  });
}

function getProjectReviewQuestionCounts(items: ProjectReviewQuestionItem[]) {
  return {
    all: items.length,
    unresolved: items.filter((item) => item.question.status !== "CLEARED")
      .length,
    replied: items.filter((item) => item.question.status === "REPLIED").length,
    cleared: items.filter((item) => item.question.status === "CLEARED").length,
  };
}

function filterProjectReviewQuestionItems(
  items: ProjectReviewQuestionItem[],
  filter: ProjectReviewQuestionFilter
) {
  return items.filter((item) => {
    if (filter === "unresolved") {
      return item.question.status !== "CLEARED";
    }
    if (filter === "replied") {
      return item.question.status === "REPLIED";
    }
    if (filter === "cleared") {
      return item.question.status === "CLEARED";
    }
    return true;
  });
}

function groupReviewQuestionItemsByTimeline(
  items: ProjectReviewQuestionItem[],
  copy: ProjectQListCopy
) {
  const groups = new Map<string, ProjectReviewQuestionItem[]>();
  for (const item of items) {
    const label = getReviewQuestionTimelineLabel(item.question.updatedAt, copy);
    const group = groups.get(label);
    if (group) {
      group.push(item);
    } else {
      groups.set(label, [item]);
    }
  }
  return [...groups.entries()];
}

function getReviewQuestionTimelineLabel(value: string, copy: ProjectQListCopy) {
  const date = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86_400_000);

  if (date >= today) {
    return copy.timeline.today;
  }
  if (date >= yesterday) {
    return copy.timeline.yesterday;
  }
  if (date >= sevenDaysAgo) {
    return copy.timeline.lastSevenDays;
  }
  return copy.timeline.earlier;
}

function formatPathSegment(node: { code: string; title: string }) {
  const code = formatDisplayName(node.code);
  const title = formatDisplayName(node.title);
  if (!code) {
    return title;
  }
  if (!title || title === code) {
    return code;
  }
  return `${code} ${title}`;
}

function formatPaperLabel(paper: Pick<WorkingPaper, "code" | "title">) {
  const code = formatDisplayName(paper.code);
  const title = formatDisplayName(paper.title);
  if (!code) {
    return title;
  }
  if (!title || title === code) {
    return code;
  }
  return `${code} ${title}`;
}

function formatAttachmentLabel(
  attachment: Pick<Attachment, "code" | "title" | "fileName" | "originalName">
) {
  const code = formatDisplayName(attachment.code ?? "");
  const name = formatDisplayName(
    attachment.originalName ?? attachment.title ?? attachment.fileName
  );
  if (!code) {
    return name;
  }
  if (!name || name === code) {
    return code;
  }
  return `${code} ${name}`;
}

function formatDate(formatter: Intl.DateTimeFormat, value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return formatter.format(date);
}
