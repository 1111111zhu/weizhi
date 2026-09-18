"use client";

import type { ProjectRole } from "@project-wing/shared";
import {
  ProjectWingMasterDataGrid,
  ProjectWingMasterDataGridColumnHeader,
  projectWingSelectedValuesFilter,
} from "@project-wing/ui";
import type { ProjectWingMasterDataGridProps } from "@project-wing/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye, MessageSquarePlus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { api } from "../api/client";
import type {
  ProjectAttachment,
  WorkflowNode,
  WorkingPaper,
  WorkingPaperQuestion,
} from "../api/client";
import { formatDisplayName } from "../lib/project-layout";
import { collectProjectReviewQuestionItems } from "./project-review-questions-dialog";
import type { ProjectReviewQuestionItem } from "./project-review-questions-dialog";
import { ReviewQuestionsPanel } from "./workbench-paper-section";
import type {
  ReviewQuestionReplyPayload,
  WorkbenchReviewQuestionsCopy,
} from "./workbench-paper-section";
import type {
  WorkbenchResolvedReviewNotesTarget,
  WorkbenchReviewNotesPanelCopy,
  WorkbenchReviewNotesTarget,
} from "./workbench-review-notes-types";

const EMPTY_DEFAULT_ARRAY: never[] = [];

type ReviewNotesDialogRequest = {
  key: number;
  mode: "create" | "open";
  questionId?: string;
  target: WorkbenchResolvedReviewNotesTarget;
};

export function WorkbenchReviewNotesPanel({
  projectId,
  target,
  unavailableTarget,
  currentUserId,
  currentProjectRole,
  workflow,
  attachments = EMPTY_DEFAULT_ARRAY,
  locale,
  readOnly,
  copy,
  reviewQuestionsCopy,
  onChanged,
  onShowAll,
  onLocateQuestion,
}: {
  projectId: string;
  target: WorkbenchResolvedReviewNotesTarget | null;
  unavailableTarget: WorkbenchReviewNotesTarget | null;
  currentUserId: string | null;
  currentProjectRole: ProjectRole | null;
  workflow: WorkflowNode[];
  attachments?: ProjectAttachment[];
  locale: string;
  readOnly: boolean;
  copy: WorkbenchReviewNotesPanelCopy;
  reviewQuestionsCopy: WorkbenchReviewQuestionsCopy;
  onChanged: () => void | Promise<void>;
  onShowAll?: () => void;
  onLocateQuestion?: (item: ProjectReviewQuestionItem) => boolean;
}) {
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "" | WorkingPaperQuestion["status"]
  >("");
  const [dialogRequest, setDialogRequest] =
    useState<ReviewNotesDialogRequest | null>(null);
  const [locatedQuestionId, setLocatedQuestionId] = useState<string | null>(
    null
  );
  const projectItems = useMemo(
    () => collectProjectReviewQuestionItems(workflow, attachments),
    [attachments, workflow]
  );
  const projectItemByQuestionId = useMemo(
    () => new Map(projectItems.map((item) => [item.question.id, item])),
    [projectItems]
  );
  const activeLocatedQuestionId =
    locatedQuestionId && projectItemByQuestionId.has(locatedQuestionId)
      ? locatedQuestionId
      : null;
  const projectScope = !target && !unavailableTarget;
  const questions =
    target?.questions ?? projectItems.map((item) => item.question);
  const displayName = target?.displayName ?? copy.projectScopeTitle;
  const questionReference = useCallback(
    (question: WorkingPaperQuestion) =>
      target?.reference ??
      projectItemByQuestionId.get(question.id)?.attachment?.code ??
      projectItemByQuestionId.get(question.id)?.paper.code ??
      "",
    [projectItemByQuestionId, target?.reference]
  );
  const questionFile = useCallback(
    (question: WorkingPaperQuestion) => {
      if (target?.displayName) {
        return target.displayName;
      }
      const item = projectItemByQuestionId.get(question.id);
      return (
        item?.attachment?.originalName ||
        item?.attachment?.title ||
        item?.attachment?.fileName ||
        item?.paper.title ||
        ""
      );
    },
    [projectItemByQuestionId, target]
  );
  const openQuestion = useCallback(
    (question: WorkingPaperQuestion) => {
      const dialogTarget =
        target ??
        resolveProjectQuestionTarget(
          projectItemByQuestionId.get(question.id),
          projectItems,
          workflow
        );
      if (!dialogTarget) {
        return;
      }
      setDialogRequest((current) => ({
        key: (current?.key ?? 0) + 1,
        mode: "open",
        questionId: question.id,
        target: dialogTarget,
      }));
    },
    [projectItemByQuestionId, projectItems, target, workflow]
  );
  const locateQuestion = useCallback(
    (question: WorkingPaperQuestion) => {
      const item = projectItemByQuestionId.get(question.id);
      if (item && onLocateQuestion?.(item)) {
        setLocatedQuestionId(question.id);
        return true;
      }
      return false;
    },
    [onLocateQuestion, projectItemByQuestionId]
  );
  const activateQuestion = useCallback(
    (question: WorkingPaperQuestion) => {
      if (!locateQuestion(question)) {
        openQuestion(question);
      }
    },
    [locateQuestion, openQuestion]
  );
  const viewQuestion = useCallback(
    (question: WorkingPaperQuestion) => {
      locateQuestion(question);
      openQuestion(question);
    },
    [locateQuestion, openQuestion]
  );
  const counts = useMemo(
    () => ({
      all: questions.length,
      open: questions.filter((question) => question.status === "OPEN").length,
      replied: questions.filter((question) => question.status === "REPLIED")
        .length,
      cleared: questions.filter((question) => question.status === "CLEARED")
        .length,
    }),
    [questions]
  );
  const filteredQuestions = useMemo(() => {
    const normalizedSearch = searchFilter.trim().toLocaleLowerCase();
    return questions.filter((question) => {
      if (
        normalizedSearch &&
        ![
          formatQuestionSubject(question),
          questionReference(question),
          questionFile(question),
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalizedSearch)
      ) {
        return false;
      }
      return !statusFilter || question.status === statusFilter;
    });
  }, [questions, searchFilter, statusFilter, questionFile, questionReference]);
  const columns = useMemo<
    ProjectWingMasterDataGridProps<WorkingPaperQuestion>["columns"]
  >(
    () => [
      {
        id: "actions",
        header: copy.columns.actions,
        cell: ({ row }) => (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`${copy.view}: ${formatQuestionSubject(row.original)}`}
            onClick={(event) => {
              event.stopPropagation();
              viewQuestion(row.original);
            }}
          >
            <Eye aria-hidden="true" />
          </Button>
        ),
        enableColumnFilter: false,
        enableHiding: false,
        enableResizing: false,
        enableSorting: false,
        size: 64,
      },
      {
        id: "reference",
        accessorFn: questionReference,
        header: ({ column }) => (
          <ProjectWingMasterDataGridColumnHeader
            column={column}
            copy={copy.columnMenu}
            title={copy.columns.reference}
          />
        ),
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {String(getValue() ?? "")}
          </span>
        ),
        enableSorting: true,
        filterFn: projectWingSelectedValuesFilter,
        meta: { headerTitle: copy.columns.reference },
        size: 132,
      },
      {
        id: "file",
        accessorFn: questionFile,
        header: ({ column }) => (
          <ProjectWingMasterDataGridColumnHeader
            column={column}
            copy={copy.columnMenu}
            title={copy.columns.file}
          />
        ),
        cell: ({ getValue }) => (
          <span className="line-clamp-2 break-words text-muted-foreground">
            {String(getValue() ?? "")}
          </span>
        ),
        enableSorting: true,
        filterFn: projectWingSelectedValuesFilter,
        meta: { headerTitle: copy.columns.file },
        minSize: 220,
        size: 320,
      },
      {
        id: "subject",
        accessorFn: formatQuestionSubject,
        header: ({ column }) => (
          <ProjectWingMasterDataGridColumnHeader
            column={column}
            copy={copy.columnMenu}
            title={copy.columns.subject}
          />
        ),
        cell: ({ getValue }) => (
          <span className="font-medium text-foreground">
            {String(getValue() ?? "")}
          </span>
        ),
        enableSorting: true,
        filterFn: projectWingSelectedValuesFilter,
        meta: { headerTitle: copy.columns.subject },
        minSize: 180,
        size: 260,
      },
      {
        id: "status",
        accessorFn: (question) => question.status,
        header: ({ column }) => (
          <ProjectWingMasterDataGridColumnHeader
            column={column}
            copy={copy.columnMenu}
            title={copy.columns.status}
          />
        ),
        cell: ({ row }) => (
          <ReviewQuestionStatusBadge
            status={row.original.status}
            label={copy.statusLabels[row.original.status]}
          />
        ),
        enableSorting: true,
        filterFn: projectWingSelectedValuesFilter,
        meta: {
          filterValueLabel: (value) =>
            copy.statusLabels[
              String(value) as WorkingPaperQuestion["status"]
            ] ?? String(value),
          headerTitle: copy.columns.status,
        },
        size: 124,
      },
      {
        id: "createdBy",
        accessorFn: (question) => personName(question.createdBy),
        header: ({ column }) => (
          <ProjectWingMasterDataGridColumnHeader
            column={column}
            copy={copy.columnMenu}
            title={copy.columns.createdBy}
          />
        ),
        enableSorting: true,
        filterFn: projectWingSelectedValuesFilter,
        meta: { headerTitle: copy.columns.createdBy },
        size: 160,
      },
      {
        id: "createdOn",
        accessorFn: (question) => question.createdAt,
        header: ({ column }) => (
          <ProjectWingMasterDataGridColumnHeader
            column={column}
            copy={copy.columnMenu}
            title={copy.columns.createdOn}
          />
        ),
        cell: ({ getValue }) => (
          <time className="whitespace-nowrap text-muted-foreground">
            {formatDateTime(String(getValue() ?? ""), locale)}
          </time>
        ),
        enableSorting: true,
        filterFn: projectWingSelectedValuesFilter,
        meta: {
          filterValueLabel: (value) => formatDateTime(String(value), locale),
          headerTitle: copy.columns.createdOn,
        },
        size: 184,
      },
      {
        id: "assignedTo",
        accessorFn: (question) =>
          question.assignedTo
            ? personName(question.assignedTo)
            : copy.unassigned,
        header: ({ column }) => (
          <ProjectWingMasterDataGridColumnHeader
            column={column}
            copy={copy.columnMenu}
            title={copy.columns.assignedTo}
          />
        ),
        enableSorting: true,
        filterFn: projectWingSelectedValuesFilter,
        meta: { headerTitle: copy.columns.assignedTo },
        size: 160,
      },
    ],
    [copy, locale, questionFile, questionReference, viewQuestion]
  );

  if (!target && unavailableTarget) {
    return (
      <ReviewNotesPanelEmpty
        title={copy.unavailableTitle}
        description={copy.unavailableDescription}
        testId="review-notes-file-unavailable"
      />
    );
  }

  const hasFilters = Boolean(searchFilter || statusFilter);
  const canReview = Boolean(currentProjectRole) && !readOnly;

  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden bg-workbench-panel"
      aria-label={`${copy.title}: ${displayName}`}
    >
      <div className="grid shrink-0 grid-cols-[auto_minmax(12rem,32rem)_minmax(0,1fr)] items-center gap-4 border-b border-border/60 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-foreground">{copy.title}</h2>
        <Input
          type="search"
          className="h-8 w-full justify-self-center"
          value={searchFilter}
          placeholder={copy.filters.search}
          aria-label={copy.filters.search}
          onChange={(event) => setSearchFilter(event.target.value)}
        />
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
          <CountFilterButton
            active={!statusFilter}
            label={copy.counts.all}
            count={counts.all}
            onClick={() => setStatusFilter("")}
          />
          <CountFilterButton
            active={statusFilter === "OPEN"}
            label={copy.counts.open}
            count={counts.open}
            onClick={() => setStatusFilter("OPEN")}
          />
          <CountFilterButton
            active={statusFilter === "REPLIED"}
            label={copy.counts.replied}
            count={counts.replied}
            onClick={() => setStatusFilter("REPLIED")}
          />
          <CountFilterButton
            active={statusFilter === "CLEARED"}
            label={copy.counts.cleared}
            count={counts.cleared}
            onClick={() => setStatusFilter("CLEARED")}
          />
          {target && onShowAll ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onShowAll}
            >
              {copy.showAllProjectNotes}
            </Button>
          ) : null}
          {canReview && target ? (
            <Button
              type="button"
              size="sm"
              onClick={() =>
                setDialogRequest((current) => ({
                  key: (current?.key ?? 0) + 1,
                  mode: "create",
                  target,
                }))
              }
            >
              <MessageSquarePlus data-icon="inline-start" />
              {copy.newReviewNote}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <ProjectWingMasterDataGrid
          columns={columns}
          data={filteredQuestions}
          emptyMessage={
            hasFilters
              ? copy.noMatches
              : projectScope
                ? copy.projectEmptyDescription
                : copy.emptyDescription
          }
          getRowId={(question) => question.id}
          onRowClick={activateQuestion}
          rowClassName={(question) =>
            question.id === activeLocatedQuestionId
              ? "transition-[background-color,box-shadow] duration-[var(--motion-fast)] motion-reduce:transition-none bg-[var(--brand-tint)] ring-1 ring-inset ring-primary/25"
              : "transition-[background-color,box-shadow] duration-[var(--motion-fast)] motion-reduce:transition-none"
          }
          showToolbar={false}
          tableLabel={`${copy.title}: ${displayName}`}
          testId="workbench-review-notes-data-grid"
          title={copy.title}
        />
      </div>

      {dialogRequest ? (
        <FileReviewQuestionDialogController
          key={dialogRequest.key}
          projectId={projectId}
          target={dialogRequest.target}
          request={dialogRequest}
          currentUserId={currentUserId}
          currentProjectRole={currentProjectRole}
          workflow={workflow}
          readOnly={readOnly}
          copy={reviewQuestionsCopy}
          onChanged={onChanged}
        />
      ) : null}
    </section>
  );
}

function resolveProjectQuestionTarget(
  item: ProjectReviewQuestionItem | undefined,
  projectItems: ProjectReviewQuestionItem[],
  workflow: WorkflowNode[]
): WorkbenchResolvedReviewNotesTarget | null {
  if (!item) {
    return null;
  }
  const paper = findWorkflowPaper(workflow, item.paper.id);
  if (!paper) {
    return null;
  }

  const attachmentId = item.question.attachmentId ?? undefined;
  const attachment =
    item.attachment ??
    (attachmentId
      ? paper.attachments?.find((candidate) => candidate.id === attachmentId)
      : undefined);
  const questions = projectItems
    .filter((candidate) => {
      if (candidate.paper.id !== item.paper.id) {
        return false;
      }
      return attachmentId
        ? candidate.question.attachmentId === attachmentId
        : !candidate.question.attachmentId;
    })
    .map((candidate) => candidate.question);

  return {
    key: attachmentId
      ? `attachment:${attachmentId}`
      : `workpaper:${item.paper.id}`,
    kind: attachmentId ? "attachment" : "workpaper",
    paperId: item.paper.id,
    attachmentId,
    workflowNodeId: item.nodeId,
    bucket: paper.bucket ?? "CURRENT",
    reference: attachment?.code || item.paper.code,
    displayName:
      attachment?.originalName ||
      attachment?.title ||
      attachment?.fileName ||
      item.paper.title,
    questions,
  };
}

function findWorkflowPaper(
  nodes: WorkflowNode[],
  paperId: string
): WorkingPaper | null {
  for (const node of nodes) {
    const paper = node.workingPapers?.find(
      (candidate) => candidate.id === paperId
    );
    if (paper) {
      return paper;
    }
    const nested = findWorkflowPaper(node.children ?? [], paperId);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function FileReviewQuestionDialogController({
  projectId,
  target,
  request,
  currentUserId,
  currentProjectRole,
  workflow,
  readOnly,
  copy,
  onChanged,
}: {
  projectId: string;
  target: WorkbenchResolvedReviewNotesTarget;
  request: ReviewNotesDialogRequest;
  currentUserId: string | null;
  currentProjectRole: ProjectRole | null;
  workflow: WorkflowNode[];
  readOnly: boolean;
  copy: WorkbenchReviewQuestionsCopy;
  onChanged: () => void | Promise<void>;
}) {
  const canReview = Boolean(currentProjectRole) && !readOnly;
  const members = useQuery({
    queryKey: ["members", projectId],
    queryFn: () => api.members(projectId),
    enabled: Boolean(currentUserId),
  });
  const refresh = () => {
    Promise.resolve(onChanged()).catch((error) => {
      console.error("Failed to refresh file review notes", error);
    });
  };
  const guardMutation = <T,>(operation: () => Promise<T>) => {
    if (readOnly) {
      return Promise.reject(new Error("Archived projects are read-only."));
    }
    return operation();
  };
  const createQuestion = useMutation({
    mutationFn: (input: {
      body: string;
      assignedToId?: string;
      paperId?: string;
      referencedWorkingPaperIds?: string[];
    }) =>
      guardMutation(() =>
        target.attachmentId
          ? api.createAttachmentQuestion(projectId, target.attachmentId, {
              body: input.body,
              assignedToId: input.assignedToId ?? "",
              referencedWorkingPaperIds: input.referencedWorkingPaperIds,
            })
          : api.createWorkingPaperQuestion(
              projectId,
              input.paperId || target.paperId,
              {
                body: input.body,
                assignedToId: input.assignedToId ?? "",
                referencedWorkingPaperIds: input.referencedWorkingPaperIds,
              }
            )
      ),
    onSuccess: refresh,
  });
  const replyQuestion = useMutation({
    mutationFn: ({
      questionId,
      payload,
    }: {
      questionId: string;
      payload: ReviewQuestionReplyPayload;
    }) =>
      guardMutation(() =>
        api.replyWorkingPaperQuestion(projectId, questionId, payload)
      ),
    onSuccess: refresh,
  });
  const markRepliedQuestion = useMutation({
    mutationFn: (questionId: string) =>
      guardMutation(() =>
        api.markWorkingPaperQuestionReplied(projectId, questionId)
      ),
    onSuccess: refresh,
  });
  const clearQuestion = useMutation({
    mutationFn: (questionId: string) =>
      guardMutation(() => api.clearWorkingPaperQuestion(projectId, questionId)),
    onSuccess: refresh,
  });
  const followUpQuestion = useMutation({
    mutationFn: ({ questionId, body }: { questionId: string; body: string }) =>
      guardMutation(() =>
        api.followUpWorkingPaperQuestion(projectId, questionId, { body })
      ),
    onSuccess: refresh,
  });
  const reopenQuestion = useMutation({
    mutationFn: ({ questionId, body }: { questionId: string; body: string }) =>
      guardMutation(() =>
        api.reopenWorkingPaperQuestion(projectId, questionId, { body })
      ),
    onSuccess: refresh,
  });
  const pending =
    createQuestion.isPending ||
    replyQuestion.isPending ||
    markRepliedQuestion.isPending ||
    clearQuestion.isPending ||
    followUpQuestion.isPending ||
    reopenQuestion.isPending;

  return (
    <ReviewQuestionsPanel
      copy={copy}
      canReview={canReview}
      currentUserId={currentUserId}
      members={members.data ?? []}
      questions={target.questions}
      workflow={workflow}
      defaultPaperId={target.paperId || undefined}
      defaultPaper={{
        id: target.paperId,
        code: target.reference,
        title: target.displayName,
        workflowNodeId: target.workflowNodeId,
      }}
      contextTitle={target.displayName}
      contextCode={target.reference}
      startInCreateMode={request.mode === "create"}
      initialQuestionId={request.questionId}
      autoOpen
      hideTrigger
      filterQuestionsByPaper={false}
      pending={pending}
      createQuestion={(input) => createQuestion.mutateAsync(input)}
      replyQuestion={(questionId, payload) =>
        replyQuestion.mutateAsync({ questionId, payload })
      }
      uploadQuestionImage={(questionId, file) =>
        guardMutation(() =>
          api.uploadReviewQuestionImage(projectId, questionId, file)
        )
      }
      attachInitialQuestionFiles={(questionId, images) =>
        guardMutation(() =>
          api.attachWorkingPaperQuestionInitialMessage(
            projectId,
            questionId,
            images
          )
        ).then((question) => {
          refresh();
          return question;
        })
      }
      downloadQuestionImage={(imageId) =>
        api.downloadReviewQuestionImage(projectId, imageId)
      }
      markRepliedQuestion={(questionId) =>
        markRepliedQuestion.mutate(questionId)
      }
      clearQuestion={(questionId) => clearQuestion.mutate(questionId)}
      followUpQuestion={(questionId, body) =>
        followUpQuestion.mutate({ questionId, body })
      }
      reopenQuestion={(questionId, body) =>
        reopenQuestion.mutateAsync({ questionId, body })
      }
    />
  );
}

function CountFilterButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="sm"
      className="gap-1.5"
      aria-pressed={active}
      onClick={onClick}
    >
      <span>{label}</span>
      <Badge variant="outline" className="min-w-5 justify-center px-1">
        {count}
      </Badge>
    </Button>
  );
}

function ReviewQuestionStatusBadge({
  status,
  label,
}: {
  status: WorkingPaperQuestion["status"];
  label: string;
}) {
  return (
    <Badge
      variant="outline"
      className={
        status === "CLEARED"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
          : status === "REPLIED"
            ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
            : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
      }
    >
      {label}
    </Badge>
  );
}

function ReviewNotesPanelEmpty({
  title,
  description,
  testId,
}: {
  title: string;
  description: string;
  testId: string;
}) {
  return (
    <div
      className="flex h-full min-h-40 flex-col items-center justify-center bg-workbench-panel px-6 text-center"
      data-testid={testId}
    >
      <MessageSquarePlus className="size-8 text-muted-foreground" />
      <h2 className="mt-3 text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function formatQuestionSubject(question: WorkingPaperQuestion) {
  const plain = stripMarkup(question.body);
  const firstLine = plain.split(/\r?\n/).find((line) => line.trim());
  return firstLine?.trim() || "Review note";
}

function _unused_formatQuestionDescription(question: WorkingPaperQuestion) {
  const plain = stripMarkup(question.body);
  return question.smartFormTargetLabel
    ? `${question.smartFormTargetLabel}: ${plain}`
    : plain;
}

function stripMarkup(value: string) {
  return value
    .replaceAll(/<[^>]*>/g, " ")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function personName(
  person?: { id: string; name: string | null; email: string } | null
) {
  return (
    (person?.name ? formatDisplayName(person.name) : "") || person?.email || "-"
  );
}

function formatDateTime(value: string, locale: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(date);
}
