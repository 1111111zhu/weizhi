"use client";

import type {
  CmpAmlCandidate,
  CmpAmlHit,
  CmpAmlLatestResponse,
  CmpAmlReviewStatus,
  CmpAmlScreeningStatus,
  CmpAmlScreeningSubject,
  CmpAmlSubjectRole,
} from "@project-wing/shared";
import {
  Checkbox,
  SelectField,
  Badge,
  Button,
  Input,
  projectWingToast as toast,
} from "@project-wing/ui";
import {
  AlertTriangle,
  CheckSquare,
  Clipboard,
  RefreshCw,
  Search,
  SearchCheck,
  ShieldAlert,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";

import { amlCopy } from "@/i18n/aml-screening";

import { api } from "../api/client";
import { useCmpI18n } from "../i18n/client";
import type { CmpFormSectionStatus } from "./cmp-form-controls";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

const REVIEW_OPTIONS: CmpAmlReviewStatus[] = [
  "UNREVIEWED",
  "CONFIRMED_MATCH",
  "FALSE_POSITIVE",
  "INCONCLUSIVE",
];

type SubjectFilter = "ALL" | "COMPANY" | "PERSON";
type ConfirmationKind = "selection" | "rerun" | null;
type AmlTableRow = {
  candidate: CmpAmlCandidate;
  subject?: CmpAmlScreeningSubject;
  removed?: boolean;
};
const UNINITIALIZED_ACCEPTANCE = Symbol("uninitialized-aml-acceptance");

export function CmpAmlScreeningSection({
  acceptanceId,
  active = true,
  onEnsureDraft,
  onStatusChange,
}: {
  acceptanceId?: string | null;
  active?: boolean;
  onEnsureDraft: () => Promise<string | null>;
  onStatusChange?: (status: CmpFormSectionStatus, summary: string) => void;
}) {
  const { locale } = useCmpI18n();
  const zh = locale === "zh-CN";
  const copy = amlCopy(zh);
  const [result, setResult] = useState<CmpAmlLatestResponse | null>(null);
  const [resolvedAcceptanceId, setResolvedAcceptanceId] = useState<
    string | null
  >(acceptanceId ?? null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SubjectFilter>("ALL");
  const [search, setSearch] = useState("");
  const [selectedSubjectKeys, setSelectedSubjectKeys] = useState<Set<string>>(
    new Set()
  );
  const [expandedSubjectKeys, setExpandedSubjectKeys] = useState<Set<string>>(
    new Set()
  );
  const [reviewDrafts, setReviewDrafts] = useState<
    Record<string, { status: CmpAmlReviewStatus; comment: string }>
  >({});
  const [reviewingHitId, setReviewingHitId] = useState<string | null>(null);
  const [confirmationKind, setConfirmationKind] =
    useState<ConfirmationKind>(null);
  const initializedAcceptanceRef = useRef<
    string | null | typeof UNINITIALIZED_ACCEPTANCE
  >(UNINITIALIZED_ACCEPTANCE);
  const selectionSeedRef = useRef<string | null>(null);

  const loadLatest = useCallback(
    async (id: string) => {
      try {
        const response = await api.cmpAmlLatest(id);
        setResult(response);
        setLoadError(null);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : copy.loadFailed);
      }
    },
    [copy.loadFailed]
  );
  const ensureDraft = useEffectEvent(onEnsureDraft);
  const showSavedResultsWarning = useEffectEvent(() => {
    setLoadError(copy.showingSavedResults);
  });

  useEffect(() => {
    if (!active) {
      initializedAcceptanceRef.current = UNINITIALIZED_ACCEPTANCE;
      return;
    }
    const knownId = acceptanceId ?? resolvedAcceptanceId;
    if (initializedAcceptanceRef.current === knownId) {
      return;
    }
    let current = true;
    initializedAcceptanceRef.current = knownId;
    if (knownId) {
      void Promise.resolve().then(() => loadLatest(knownId));
    }
    void ensureDraft()
      .then(async (id) => {
        if (!current || !id) {
          if (current && !id) {
            if (knownId) {
              await loadLatest(knownId);
              if (current) {
                showSavedResultsWarning();
              }
            } else {
              setLoadError(copy.saveRequired);
            }
          }
          return;
        }
        initializedAcceptanceRef.current = id;
        setResolvedAcceptanceId(id);
        return loadLatest(id);
      })
      .catch((error: unknown) => {
        if (current) {
          setLoadError(
            error instanceof Error ? error.message : copy.loadFailed
          );
        }
      });
    return () => {
      current = false;
    };
  }, [
    acceptanceId,
    active,
    copy.loadFailed,
    copy.saveRequired,
    loadLatest,
    resolvedAcceptanceId,
  ]);

  const batch = result?.batch;
  const rows = useMemo(() => tableRows(result), [result]);
  const selectableRows = useMemo(
    () => rows.filter((row) => !row.removed),
    [rows]
  );
  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return rows.filter((row) => {
      if (filter !== "ALL" && row.candidate.entityType !== filter) {
        return false;
      }
      return (
        !query ||
        row.candidate.displayName.toLocaleLowerCase().includes(query) ||
        row.candidate.roles.some((role) =>
          roleLabel(role, zh).toLocaleLowerCase().includes(query)
        )
      );
    });
  }, [filter, rows, search, zh]);
  const visibleSelectableRows = useMemo(
    () => filteredRows.filter((row) => !row.removed),
    [filteredRows]
  );

  useEffect(() => {
    if (!result) {
      return;
    }
    const seed = `${batch?.id ?? "new"}:${selectableRows
      .map((row) => row.candidate.subjectKey)
      .join("|")}`;
    if (selectionSeedRef.current === seed) {
      return;
    }
    selectionSeedRef.current = seed;
    const available = new Set(
      selectableRows.map((row) => row.candidate.subjectKey)
    );
    const priorSelection = batch?.subjects
      .map((subject) => subject.subjectKey)
      .filter((key) => available.has(key));
    const rootKey = selectableRows.find(
      (row) => row.candidate.subjectKey === "ROOT"
    )?.candidate.subjectKey;
    setSelectedSubjectKeys(
      new Set(
        priorSelection?.length ? priorSelection : rootKey ? [rootKey] : []
      )
    );
  }, [batch?.id, batch?.subjects, result, selectableRows]);

  const summary = useMemo(() => amlSummary(result, copy), [copy, result]);
  useEffect(() => {
    onStatusChange?.(batch ? "complete" : "not-started", summary);
  }, [batch, onStatusChange, summary]);

  const selectedKeys = useMemo(
    () => [...selectedSubjectKeys].sort(),
    [selectedSubjectKeys]
  );
  const batchHasSameSelection = Boolean(
    batch &&
    sameKeys(
      batch.subjects.map((subject) => subject.subjectKey),
      selectedKeys
    )
  );

  function toggleSubject(subjectKey: string) {
    setSelectedSubjectKeys((current) => {
      const next = new Set(current);
      if (next.has(subjectKey)) {
        next.delete(subjectKey);
      } else {
        next.add(subjectKey);
      }
      return next;
    });
  }

  function toggleVisibleSubjects() {
    setSelectedSubjectKeys((current) => {
      const next = new Set(current);
      const allVisibleSelected = visibleSelectableRows.every((row) =>
        current.has(row.candidate.subjectKey)
      );
      for (const row of visibleSelectableRows) {
        if (allVisibleSelected) {
          next.delete(row.candidate.subjectKey);
        } else {
          next.add(row.candidate.subjectKey);
        }
      }
      return next;
    });
  }

  async function run(force: boolean) {
    if (selectedKeys.length === 0) {
      setLoadError(copy.selectAtLeastOne);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const id = await onEnsureDraft();
      if (!id) {
        setLoadError(copy.saveRequired);
        return;
      }
      setResolvedAcceptanceId(id);
      initializedAcceptanceRef.current = id;
      const response = await api.runCmpAmlScreening(id, {
        force,
        subjectKeys: selectedKeys,
      });
      setResult(response);
      toast[response.batch?.errorCount ? "warning" : "success"](
        force ? copy.rerunComplete : copy.runComplete
      );
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : copy.runFailed);
    } finally {
      setLoading(false);
      setConfirmationKind(null);
    }
  }

  async function review(screeningId: string, hit: CmpAmlHit) {
    const draft = reviewDrafts[hit.id] ?? {
      status: hit.reviewStatus,
      comment: hit.reviewComment ?? "",
    };
    setReviewingHitId(hit.id);
    try {
      await api.reviewCmpAmlHit(screeningId, hit.id, {
        reviewStatus: draft.status,
        comment: draft.comment.trim() || undefined,
      });
      const id =
        batch?.acceptanceRequestId ?? acceptanceId ?? resolvedAcceptanceId;
      if (id) {
        await loadLatest(id);
      }
      toast.success(copy.reviewSaved);
    } catch (error) {
      toast.error(copy.reviewFailed, {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setReviewingHitId(null);
    }
  }

  const hasWarnings = Boolean(
    result?.isStale ||
    batch?.status === "RUNNING" ||
    batch?.attentionCount ||
    batch?.errorCount
  );
  const visibleAllSelected =
    visibleSelectableRows.length > 0 &&
    visibleSelectableRows.every((row) =>
      selectedSubjectKeys.has(row.candidate.subjectKey)
    );

  return (
    <div
      className="cmp-form-span-full space-y-5"
      data-cmp-aml-screening-section
    >
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/20 p-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <SearchCheck className="size-6 text-primary" aria-hidden="true" />
            <h3 className="text-lg font-semibold">{copy.title}</h3>
            <Badge variant="secondary" radius="full">
              {copy.optional}
            </Badge>
          </div>
          <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
            {copy.description}
          </p>
          <p className="text-sm text-muted-foreground">{copy.nonBlocking}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            disabled={loading || selectedKeys.length === 0}
            onClick={() => {
              if (batch && !batchHasSameSelection) {
                setConfirmationKind("selection");
              } else {
                void run(false);
              }
            }}
          >
            <SearchCheck className={loading ? "animate-pulse" : undefined} />
            {loading
              ? copy.running
              : copy.runSelected.replace(
                  "{count}",
                  String(selectedKeys.length)
                )}
          </Button>
          {batch ? (
            <Button
              type="button"
              variant="outline"
              disabled={loading || selectedKeys.length === 0}
              onClick={() => setConfirmationKind("rerun")}
            >
              <RefreshCw className={loading ? "animate-spin" : undefined} />
              {copy.rerun}
            </Button>
          ) : null}
        </div>
      </div>

      {!result?.enabled || !result?.configured ? (
        <WarningMessage>{copy.notConfigured}</WarningMessage>
      ) : null}
      {result?.isStale ? <WarningMessage>{copy.stale}</WarningMessage> : null}
      {loadError ? <WarningMessage>{loadError}</WarningMessage> : null}

      {result ? (
        <div className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="flex flex-col gap-4 border-b border-border bg-muted/20 p-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-base font-semibold">{summary}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {batch
                  ? `${copy.screenedAt}${formatDate(batch.completedAt ?? batch.createdAt)}`
                  : copy.notRun}
              </p>
            </div>
            {batch ? (
              <Badge
                variant={hasWarnings ? "warning-light" : "success-light"}
                radius="full"
              >
                {hasWarnings ? copy.requiresAttention : copy.clear}
              </Badge>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
            <fieldset className="flex flex-wrap gap-2">
              <legend className="sr-only">{copy.subjectFilter}</legend>
              {(["ALL", "COMPANY", "PERSON"] as const).map((option) => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={filter === option ? "default" : "outline"}
                  onClick={() => setFilter(option)}
                >
                  {option === "ALL"
                    ? copy.all
                    : option === "COMPANY"
                      ? copy.company
                      : copy.person}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={toggleVisibleSubjects}
              >
                <CheckSquare aria-hidden="true" />
                {visibleAllSelected ? copy.clearVisible : copy.selectVisible}
              </Button>
            </fieldset>
            <label
              className="relative block w-full lg:w-80"
              htmlFor="aml-subject-search"
            >
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label={copy.searchSubjects}
                className="pl-9"
                id="aml-subject-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={copy.searchSubjects}
              />
            </label>
          </div>

          <div className="max-h-[44rem] overflow-auto">
            <table className="w-full min-w-[82rem] border-collapse text-base">
              <thead className="sticky top-0 z-10 bg-muted shadow-sm">
                <tr className="border-b border-border text-left text-base font-semibold">
                  <th className="w-14 px-4 py-4">{copy.select}</th>
                  <th className="min-w-28 px-4 py-4">{copy.entityType}</th>
                  <th className="min-w-48 px-4 py-4">{copy.roles}</th>
                  <th className="min-w-56 px-4 py-4">{copy.name}</th>
                  <th className="min-w-32 px-4 py-4">{copy.status}</th>
                  <th className="min-w-28 px-4 py-4">{copy.score}</th>
                  <th className="min-w-28 px-4 py-4">{copy.hits}</th>
                  <th className="min-w-56 px-4 py-4">{copy.requestId}</th>
                  <th className="min-w-80 px-4 py-4">{copy.errorsWarnings}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const key = row.candidate.subjectKey;
                  const { subject } = row;
                  const messages = [
                    ...new Set([
                      ...row.candidate.warnings,
                      ...(subject?.warnings ?? []),
                      ...(subject?.errorMessage ? [subject.errorMessage] : []),
                      ...(row.removed ? [copy.removedSubject] : []),
                    ]),
                  ];
                  return (
                    <SubjectTableRows
                      key={key}
                      row={row}
                      expanded={expandedSubjectKeys.has(key)}
                      selected={selectedSubjectKeys.has(key)}
                      canReview={result.canReviewHits}
                      copy={copy}
                      zh={zh}
                      messages={messages}
                      reviewingHitId={reviewingHitId}
                      reviewDrafts={reviewDrafts}
                      onToggle={() => toggleSubject(key)}
                      onToggleHits={() =>
                        setExpandedSubjectKeys((current) => {
                          const next = new Set(current);
                          if (next.has(key)) {
                            next.delete(key);
                          } else {
                            next.add(key);
                          }
                          return next;
                        })
                      }
                      onCopyRequestId={() =>
                        copyRequestId(subject?.diditRequestId, copy)
                      }
                      onReviewDraftChange={(hitId, draft) =>
                        setReviewDrafts((current) => ({
                          ...current,
                          [hitId]: draft,
                        }))
                      }
                      onReview={review}
                    />
                  );
                })}
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      {copy.noSubjects}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <ShieldAlert className="mx-auto mb-3 size-8" aria-hidden="true" />
          {copy.saveToLoad}
        </div>
      )}

      <AlertDialog
        open={confirmationKind !== null}
        onOpenChange={(open) => !open && setConfirmationKind(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmationKind === "rerun"
                ? copy.rerunTitle
                : copy.selectionTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmationKind === "rerun"
                ? copy.rerunConfirm
                : copy.selectionConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                run(confirmationKind === "rerun");
              }}
            >
              {confirmationKind === "rerun"
                ? copy.confirmRerun
                : copy.confirmSelection}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SubjectTableRows({
  row,
  expanded,
  selected,
  canReview,
  copy,
  zh,
  messages,
  reviewingHitId,
  reviewDrafts,
  onToggle,
  onToggleHits,
  onCopyRequestId,
  onReviewDraftChange,
  onReview,
}: {
  row: AmlTableRow;
  expanded: boolean;
  selected: boolean;
  canReview: boolean;
  copy: ReturnType<typeof amlCopy>;
  zh: boolean;
  messages: string[];
  reviewingHitId: string | null;
  reviewDrafts: Record<string, { status: CmpAmlReviewStatus; comment: string }>;
  onToggle: () => void;
  onToggleHits: () => void;
  onCopyRequestId: () => void;
  onReviewDraftChange: (
    hitId: string,
    draft: { status: CmpAmlReviewStatus; comment: string }
  ) => void;
  onReview: (screeningId: string, hit: CmpAmlHit) => Promise<void>;
}) {
  const { subject } = row;
  return (
    <>
      <tr className="border-b border-border align-top hover:bg-muted/20">
        <td className="px-4 py-4">
          <Checkbox
            aria-label={`${copy.select} ${row.candidate.displayName}`}
            checked={selected}
            disabled={row.removed}
            onCheckedChange={onToggle}
            className="size-4 accent-primary"
          />
        </td>
        <td className="px-4 py-4 font-medium">
          {row.candidate.entityType === "COMPANY" ? copy.company : copy.person}
        </td>
        <td className="px-4 py-4 leading-6">
          {row.candidate.roles.map((role) => roleLabel(role, zh)).join(", ")}
        </td>
        <td className="px-4 py-4 leading-6 font-medium">
          {row.candidate.displayName}
        </td>
        <td className="px-4 py-4">
          {subject ? (
            <StatusBadge status={subject.status} zh={zh} />
          ) : (
            <span className="text-muted-foreground">{copy.notScreened}</span>
          )}
        </td>
        <td className="px-4 py-4 tabular-nums">{subject?.score ?? "—"}</td>
        <td className="px-4 py-4">
          {subject?.totalHits ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onToggleHits}
            >
              {subject.totalHits} {expanded ? copy.hideHits : copy.viewHits}
            </Button>
          ) : subject ? (
            0
          ) : (
            "—"
          )}
        </td>
        <td className="px-4 py-4">
          {subject?.diditRequestId ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="max-w-52 justify-start gap-2 px-0 font-mono text-sm"
              title={subject.diditRequestId}
              onClick={onCopyRequestId}
            >
              <Clipboard className="size-3.5 shrink-0" />
              <span className="truncate">{subject.diditRequestId}</span>
            </Button>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-4 py-4 leading-6 text-muted-foreground">
          {messages.length ? (
            <ul className="space-y-1 whitespace-pre-wrap">
              {messages.map((message, index) => (
                <li
                  key={`${message}-${index}`}
                  className={
                    subject?.errorMessage === message
                      ? "text-destructive"
                      : undefined
                  }
                >
                  {message}
                </li>
              ))}
            </ul>
          ) : (
            <span>—</span>
          )}
        </td>
      </tr>
      {expanded && subject?.hits.length ? (
        <tr className="border-b border-border bg-muted/25">
          <td colSpan={9} className="p-5">
            <div className="space-y-3">
              {subject.hits.map((hit) => (
                <HitReviewRow
                  key={hit.id}
                  hit={hit}
                  screeningId={subject.id}
                  canReview={canReview}
                  copy={copy}
                  zh={zh}
                  reviewing={reviewingHitId === hit.id}
                  draft={
                    reviewDrafts[hit.id] ?? {
                      status: hit.reviewStatus,
                      comment: hit.reviewComment ?? "",
                    }
                  }
                  onDraftChange={(draft) => onReviewDraftChange(hit.id, draft)}
                  onReview={onReview}
                />
              ))}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function HitReviewRow({
  hit,
  screeningId,
  canReview,
  copy,
  zh,
  reviewing,
  draft,
  onDraftChange,
  onReview,
}: {
  hit: CmpAmlHit;
  screeningId: string;
  canReview: boolean;
  copy: ReturnType<typeof amlCopy>;
  zh: boolean;
  reviewing: boolean;
  draft: { status: CmpAmlReviewStatus; comment: string };
  onDraftChange: (draft: {
    status: CmpAmlReviewStatus;
    comment: string;
  }) => void;
  onReview: (screeningId: string, hit: CmpAmlHit) => Promise<void>;
}) {
  return (
    <div className="rounded-md border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{hitDisplayName(hit, copy.hit)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {copy.matchScore}: {hit.matchScore ?? "—"} · {copy.riskScore}:{" "}
            {hit.riskScore ?? "—"}
          </p>
        </div>
        <Badge variant="warning-light" radius="full">
          {reviewLabel(hit.reviewStatus, zh)}
        </Badge>
      </div>
      {canReview ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-[14rem_minmax(0,1fr)_auto]">
          <SelectField
            label={copy.reviewStatus}
            labelVisibility="hidden"
            value={draft.status}
            onValueChange={(value) =>
              onDraftChange({
                ...draft,
                status: value as CmpAmlReviewStatus,
              })
            }
            options={REVIEW_OPTIONS.map((option) => ({
              value: option,
              label: reviewLabel(option, zh),
            }))}
          />
          <Input
            aria-label={copy.comment}
            maxLength={1000}
            placeholder={copy.comment}
            value={draft.comment}
            onChange={(event) =>
              onDraftChange({ ...draft, comment: event.target.value })
            }
          />
          <Button
            type="button"
            variant="outline"
            disabled={reviewing}
            onClick={() => {
              onReview(screeningId, hit);
            }}
          >
            {reviewing ? copy.saving : copy.saveReview}
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {copy.readOnlyReview}
        </p>
      )}
    </div>
  );
}

function tableRows(result: CmpAmlLatestResponse | null): AmlTableRow[] {
  if (!result) {
    return [];
  }
  const subjectsByKey = new Map(
    result.batch?.subjects.map((subject) => [subject.subjectKey, subject])
  );
  const rows: AmlTableRow[] = result.availableSubjects.map((candidate) => ({
    candidate,
    subject: subjectsByKey.get(candidate.subjectKey),
  }));
  const availableKeys = new Set(
    result.availableSubjects.map((candidate) => candidate.subjectKey)
  );
  for (const subject of result.batch?.subjects ?? []) {
    if (!availableKeys.has(subject.subjectKey)) {
      rows.push({
        candidate: {
          subjectKey: subject.subjectKey,
          entityType: subject.entityType,
          roles: subject.roles,
          displayName: subject.displayName,
          ready: false,
          warnings: [],
        },
        subject,
        removed: true,
      });
    }
  }
  return rows;
}

function sameKeys(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    [...left].sort().every((key, index) => key === right[index])
  );
}
function copyRequestId(
  value: string | null | undefined,
  copy: ReturnType<typeof amlCopy>
) {
  if (!value || typeof navigator === "undefined") {
    return;
  }
  void navigator.clipboard
    ?.writeText(value)
    .then(() => toast.success(copy.requestIdCopied));
}
function WarningMessage({ children }: { children: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
      <span>{children}</span>
    </div>
  );
}
function StatusBadge({
  status,
  zh,
}: {
  status: CmpAmlScreeningStatus;
  zh: boolean;
}) {
  const label = {
    APPROVED: zh ? "通过" : "Approved",
    IN_REVIEW: zh ? "待复核" : "In Review",
    DECLINED: zh ? "高风险提示" : "Declined",
    ERROR: zh ? "未完成" : "Error",
  }[status];
  return (
    <Badge
      variant={
        status === "APPROVED"
          ? "success-light"
          : status === "ERROR" || status === "DECLINED"
            ? "destructive-light"
            : "warning-light"
      }
      radius="full"
    >
      {label}
    </Badge>
  );
}
function amlSummary(
  result: CmpAmlLatestResponse | null,
  copy: ReturnType<typeof amlCopy>
) {
  const batch = result?.batch;
  return batch
    ? copy.summary
        .replace("{subjects}", String(batch.subjectCount))
        .replace("{attention}", String(batch.attentionCount))
        .replace("{errors}", String(batch.errorCount))
    : copy.notRunSummary;
}
function hitDisplayName(hit: CmpAmlHit, fallback: string) {
  const candidate = [
    hit.details.name,
    hit.details.full_name,
    hit.details.caption,
  ].find((value) => typeof value === "string" && value.trim());
  return typeof candidate === "string"
    ? candidate
    : `${fallback} ${hit.diditHitId}`;
}
function roleLabel(role: CmpAmlSubjectRole, zh: boolean) {
  return {
    CLIENT: zh ? "客户公司" : "Client",
    GROUP_COMPANY: zh ? "集团公司" : "Group company",
    OWNER: zh ? "所有人" : "Owner",
    BENEFICIAL_OWNER: zh ? "最终实益拥有人" : "Beneficial owner",
    DIRECTOR: zh ? "董事" : "Director",
    CONTROLLER: zh ? "控制人" : "Controller",
  }[role];
}
function reviewLabel(status: CmpAmlReviewStatus, zh: boolean) {
  return {
    UNREVIEWED: zh ? "未复核" : "Unreviewed",
    CONFIRMED_MATCH: zh ? "确认匹配" : "Confirmed Match",
    FALSE_POSITIVE: zh ? "误报" : "False Positive",
    INCONCLUSIVE: zh ? "无法判断" : "Inconclusive",
  }[status];
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
