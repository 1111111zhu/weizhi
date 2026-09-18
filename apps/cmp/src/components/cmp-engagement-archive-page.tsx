"use client";

import {
  CMP_BUDGET_CURRENCIES,
  getCmpFixedBudgetExchangeRate,
} from "@project-wing/shared";
import type {
  CmpEngagement,
  CmpEngagementArchivePayload,
  CmpEngagementArchiveReadinessCheck,
  CmpEngagementFeePlanGrade,
  CmpBillingListResponse,
  TmsEngagementSummary,
  TmsEngagementSummaryRow,
} from "@project-wing/shared";
import {
  Button as SharedButton,
  Checkbox,
  SelectField,
  useCompactViewport,
} from "@project-wing/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Archive,
  CheckCircle2,
  CircleAlert,
  Clock,
  Download,
  Loader2,
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  api,
  ApiError,
  downloadCmpEngagementArchiveExport,
  downloadCmpEngagementBudgetWorkbook,
} from "@/api/client";
import { CmpEngagementImportDialog } from "@/components/cmp-engagement-import-dialog";
import { CmpTmsSummary } from "@/components/cmp-tms-summary";
import { CmpTmsTimesheetWorksheet } from "@/components/cmp-tms-timesheet-worksheet";
import { useCmpToast } from "@/components/cmp-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getBillingScheduleCopy } from "@/i18n/billing-schedule";
import { useCmpI18n } from "@/i18n/client";
import { getEngagementArchiveCopy } from "@/i18n/engagement-archive";

import {
  EngagementDeliverablesField,
  formatEngagementDeliverables,
} from "./cmp-engagement-deliverables";
import {
  calculateFeePlanningTotals,
  CmpEngagementFeePlanningTable,
} from "./cmp-engagement-fee-planning-table";
import type { CmpFeePlanningFormLine } from "./cmp-engagement-fee-planning-table";

import mobileStyles from "./cmp-mobile.module.css";

type ArchiveMemberCost = {
  userId: string;
  name: string;
  grade: string;
  historical: boolean;
  budgetNormal: string;
  budgetOt: string;
  actualNormal: string;
  actualOt: string;
  absent: string;
  hourlyRate: string;
  budgetCost: string;
  actualCost: string;
};

type ArchiveTotals = {
  currency: string;
  budgetCost: string;
  actualCost: string;
};

type TmsSummaryState = {
  data?: TmsEngagementSummary;
  isLoading: boolean;
  isError: boolean;
};

export type ArchiveWorkflowMode = "edit" | "review" | "confirm";

export function CmpEngagementArchivePage({
  engagementId,
  reviewMode = false,
  mode,
  demo = false,
}: {
  engagementId: string;
  reviewMode?: boolean;
  mode?: ArchiveWorkflowMode;
  demo?: boolean;
}) {
  const { dictionary, locale, localizedPath } = useCmpI18n();
  const archiveCopy = dictionary.workspace.archive;
  const archiveActionCopy = getEngagementArchiveCopy(locale);
  const { toast } = useCmpToast();
  const router = useRouter();
  const currentMode: ArchiveWorkflowMode =
    mode ?? (reviewMode ? "review" : "edit");
  const isEditStep = currentMode === "edit";
  const isReviewStep = currentMode === "review";
  const isConfirmStep = currentMode === "confirm";
  const [payload, setPayload] = useState<CmpEngagementArchivePayload | null>(
    null
  );
  const [draftId, setDraftId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [createFromArchiveOpen, setCreateFromArchiveOpen] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | "budget" | null>(
    null
  );
  const lastAutosavedPayload = useRef<string | null>(null);
  const [lastSavedPayload, setLastSavedPayload] = useState<string | null>(null);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const engagement = useQuery({
    queryKey: ["cmp-engagement", engagementId],
    queryFn: () => api.cmpEngagement(engagementId),
    enabled: !demo,
  });
  const snapshot = useQuery({
    queryKey: ["cmp-engagement-archive-snapshot", engagementId],
    queryFn: () => api.cmpEngagementArchiveSnapshot(engagementId),
    enabled: !demo && engagement.data?.status === "ARCHIVED",
  });
  const review = useQuery({
    queryKey: ["cmp-engagement-archive-review", engagementId],
    queryFn: () => api.cmpEngagementArchiveReview(engagementId),
    enabled:
      !demo &&
      Boolean(engagement.data && engagement.data.status !== "ARCHIVED"),
  });
  const users = useQuery({
    // The general user directory is restricted to user-administration roles.
    // Archive preparation needs the CMP staff roster instead, which every CMP
    // user who can open an engagement is allowed to read. Using the scoped
    // endpoint prevents a harmless name-lookup from raising a global request
    // failure toast on the archive screen.
    queryKey: ["cmp-users"],
    queryFn: () => api.cmpUsers(),
    enabled: !demo,
  });
  const exchangeRates = useQuery({
    queryKey: ["cmp-budget-exchange-rates"],
    queryFn: () => api.cmpBudgetExchangeRates(),
    enabled: !demo,
  });
  const tmsSummary = useQuery({
    queryKey: ["cmp-engagement-tms-summary", engagementId],
    queryFn: () => api.cmpTmsEngagementSummary(engagementId),
    enabled: !demo,
  });
  const billing = useQuery({
    queryKey: ["cmp-engagement-billings", engagementId],
    queryFn: () => api.cmpEngagementBillings(engagementId),
    enabled: !demo && Boolean(engagementId),
  });

  const [loadedReview, setLoadedReview] = useState<typeof review.data>();
  if (review.data && loadedReview !== review.data) {
    setLoadedReview(review.data);
    setPayload(
      review.data.draft?.payload ??
        payloadFromEngagement(review.data.engagement)
    );
    setDraftId(review.data.draft?.id ?? null);
  }

  const saveInput = (input: {
    payload: CmpEngagementArchivePayload;
    sourceUpdatedAt: string;
    tmsFingerprint: string;
  }) => api.saveCmpEngagementArchiveDraft(engagementId, input);

  const afterFirstSave = (saved: { id: string }) => {
    setDraftId(saved.id);
    // The submit button derives from review.data.workflow.canSubmit, which is
    // false until the first draft exists — refresh once so it unlocks without
    // requiring a page reload.
    if (!review.data?.draft) {
      void review.refetch();
    }
  };
  const autosave = useMutation({
    mutationFn: saveInput,
    onSuccess: afterFirstSave,
  });
  const save = useMutation({
    mutationFn: saveInput,
    onSuccess: (saved) => {
      afterFirstSave(saved);
      toast({ title: archiveCopy.saveDraft, variant: "success" });
    },
    onError: (error) => {
      const info = describeArchiveError(error);
      toast({
        title: archiveErrorTitle(info, archiveCopy),
        description: info.detail,
        variant: "destructive",
      });
    },
  });

  const queueSave = (
    value: CmpEngagementArchivePayload,
    mutation: typeof save
  ) => {
    if (!review.data) {
      return Promise.reject(new Error("Archive review is not ready"));
    }
    const input = {
      payload: value,
      sourceUpdatedAt: review.data.engagement.updatedAt,
      tmsFingerprint: review.data.tmsFingerprint,
    };
    const queued = saveChain.current.then(() => mutation.mutateAsync(input));
    saveChain.current = queued.then(
      () => {},
      () => {}
    );
    void queued.then(() => {
      lastAutosavedPayload.current = JSON.stringify(value);
      setLastSavedPayload(lastAutosavedPayload.current);
    });
    return queued;
  };

  const savePayload = (value: CmpEngagementArchivePayload) =>
    queueSave(value, save);

  useEffect(() => {
    if (!payload || !review.data || !review.data.workflow.canEdit) {
      return;
    }
    const serialized = JSON.stringify(payload);
    if (serialized === lastAutosavedPayload.current) {
      return;
    }
    const timer = window.setTimeout(() => {
      void queueSave(payload, autosave).catch(() => {
        // Autosave failures surface through the readiness rail, not toasts.
      });
    }, 900);
    return () => window.clearTimeout(timer);
  });

  const finalize = useMutation({
    mutationFn: async () => {
      if (!draftId || !review.data) {
        throw new Error("Save the archive draft before confirming");
      }
      return await api.archiveCmpEngagement(engagementId, {
        draftId,
        sourceUpdatedAt: review.data.engagement.updatedAt,
        tmsFingerprint: review.data.tmsFingerprint,
        acknowledgedWarnings: review.data.readiness
          .filter((item) => item.severity === "WARNING")
          .map((item) => item.code),
        approvalNote: approvalNote.trim() || undefined,
        overrideReason: review.data.workflow.overrideRequired
          ? overrideReason.trim()
          : undefined,
      });
    },
    onSuccess: () => {
      toast({ title: archiveCopy.archivedTitle, variant: "success" });
      void engagement.refetch();
      void snapshot.refetch();
      setConfirmOpen(false);
    },
    onError: (error) => {
      handleWorkflowError(error);
      setConfirmOpen(false);
    },
  });
  const submit = useMutation({
    mutationFn: async () => {
      if (!review.data || !payload) {
        throw new Error("Archive review is not ready");
      }
      const saved = await savePayload(payload);
      setDraftId(saved.id);
      return api.submitCmpEngagementArchive(engagementId, {
        sourceUpdatedAt: review.data.engagement.updatedAt,
        tmsFingerprint: review.data.tmsFingerprint,
        overrideReason: review.data.workflow.overrideRequired
          ? overrideReason.trim()
          : undefined,
      });
    },
    onSuccess: async () => {
      await review.refetch();
      router.push(reviewHref);
    },
    onError: (error) => handleWorkflowError(error),
  });
  const returnForRevision = useMutation({
    mutationFn: () => {
      if (!review.data) {
        throw new Error("Archive review is not ready");
      }
      return api.returnCmpEngagementArchive(engagementId, {
        sourceUpdatedAt: review.data.engagement.updatedAt,
        tmsFingerprint: review.data.tmsFingerprint,
        reason: returnReason.trim(),
        overrideReason: review.data.workflow.overrideRequired
          ? overrideReason.trim()
          : undefined,
      });
    },
    onSuccess: async () => {
      setReturnReason("");
      await review.refetch();
      toast({ title: archiveCopy.statusReturned, variant: "success" });
    },
    onError: (error) => handleWorkflowError(error),
  });
  const remove = useMutation({
    mutationFn: () => api.deleteCmpEngagementArchiveDraft(engagementId),
    onSuccess: () => {
      setDraftId(null);
      setDeleteOpen(false);
    },
  });

  const isFrozen = engagement.data?.status === "ARCHIVED";
  const totals = review.data?.totals ?? snapshot.data?.totals;
  const rows = review.data?.memberCosts ?? snapshot.data?.memberCosts ?? [];
  const blockers = review.data?.blockers ?? [];
  const readiness = review.data?.readiness ?? [];
  const workflow = review.data?.workflow;
  const draft = review.data?.draft ?? null;
  const archiveEngagement =
    snapshot.data?.engagement ?? review.data?.engagement ?? engagement.data;
  const reviewHref = localizedPath(
    `/engagement/${engagementId}/archive/review`
  );
  const confirmHref = localizedPath(
    `/engagement/${engagementId}/archive/confirm`
  );

  const handleWorkflowError = (error: unknown) => {
    const info = describeArchiveError(error);
    if (info.kind === "sourceConflict" || info.kind === "tmsConflict") {
      void review.refetch();
    }
    toast({
      title: archiveErrorTitle(info, archiveCopy),
      description: info.detail,
      variant: "destructive",
    });
  };

  const handleExport = async (kind: "pdf" | "xlsx" | "budget") => {
    if (exporting) {
      return;
    }
    setExporting(kind);
    try {
      await (kind === "budget"
        ? downloadCmpEngagementBudgetWorkbook(engagementId, locale)
        : downloadCmpEngagementArchiveExport(engagementId, kind));
      toast({ title: archiveCopy.exportStarted, variant: "success" });
    } catch {
      toast({ title: archiveCopy.exportFailed, variant: "destructive" });
    } finally {
      setExporting(null);
    }
  };

  const hasUnsavedChanges =
    Boolean(payload) &&
    workflow?.canEdit &&
    (JSON.stringify(payload) !== lastSavedPayload ||
      autosave.isPending ||
      save.isPending);
  const railSaveState =
    save.isPending || autosave.isPending
      ? archiveCopy.saving
      : save.isError || autosave.isError
        ? archiveCopy.saveFailed
        : archiveCopy.autosaveEnabled;
  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  if (demo) {
    return (
      <main className="p-6">{archiveActionCopy.reviewExampleUnavailable}</main>
    );
  }
  if (
    engagement.isLoading ||
    (!isFrozen && review.isLoading) ||
    (isFrozen && snapshot.isLoading)
  ) {
    return <main className="p-6">{archiveCopy.loading}</main>;
  }
  if (engagement.isError || review.isError || (isFrozen && snapshot.isError)) {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-8">
        <section className="rounded-xl border bg-card p-6 text-center">
          <h1 className="text-lg font-semibold">{archiveCopy.unavailable}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {archiveCopy.unavailableDescription}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button
              nativeButton={false}
              render={
                <a
                  aria-label={dictionary.workspace.formPrevious}
                  href={localizedPath(`/engagement/${engagementId}`)}
                />
              }
              variant="outline"
            >
              {dictionary.workspace.formPrevious}
            </Button>
            <Button
              onClick={() => {
                void engagement.refetch();
                void review.refetch();
                void snapshot.refetch();
              }}
            >
              {archiveCopy.retry}
            </Button>
          </div>
        </section>
      </main>
    );
  }

  const reviewArchive = () => submit.mutate();
  const previousStepHref = localizedPath(
    isConfirmStep
      ? `/engagement/${engagementId}/archive/review`
      : isReviewStep
        ? `/engagement/${engagementId}/archive`
        : "/engagement"
  );

  return (
    <main className="cmp-archive-page mx-auto max-w-[112rem] p-4 pb-24 sm:p-6 sm:pb-24 lg:pb-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-5">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            aria-label={dictionary.workspace.formPrevious}
            className="mt-0.5 shrink-0"
            nativeButton={false}
            render={
              <a
                aria-label={dictionary.workspace.formPrevious}
                href={previousStepHref}
              />
            }
            size="icon"
            variant="outline"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">
              {isFrozen
                ? archiveCopy.archivedTitle
                : isConfirmStep
                  ? archiveCopy.stepConfirm
                  : isReviewStep
                    ? archiveCopy.reviewTitle
                    : archiveCopy.title}
            </p>
            <h1 className="text-2xl font-semibold">
              {archiveEngagement?.engagementCode}
            </h1>
            {archiveEngagement ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {archiveEngagement.client.nameZh ||
                  archiveEngagement.client.nameEn ||
                  archiveEngagement.client.clientCode}
              </p>
            ) : null}
          </div>
        </div>
        <div className={`flex flex-wrap gap-2 ${isFrozen ? "" : "lg:hidden"}`}>
          {isFrozen ? (
            <>
              <Button
                onClick={() => setCreateFromArchiveOpen(true)}
                variant="outline"
              >
                {archiveActionCopy.createFromArchive}
              </Button>
              <Button
                disabled={exporting !== null}
                onClick={() => {
                  handleExport("pdf");
                }}
                variant="outline"
              >
                {exporting === "pdf" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {archiveActionCopy.pdf}
              </Button>
              <Button
                disabled={exporting !== null}
                onClick={() => {
                  handleExport("xlsx");
                }}
                variant="outline"
              >
                {exporting === "xlsx" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {archiveActionCopy.excel}
              </Button>
              <Button
                disabled={exporting !== null}
                onClick={() => {
                  handleExport("budget");
                }}
                variant="outline"
              >
                {exporting === "budget" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {archiveActionCopy.budgetWorkbook}
              </Button>
            </>
          ) : (
            <>
              {isEditStep ? null : (
                <Button
                  nativeButton={false}
                  render={
                    <a
                      aria-label={archiveCopy.editDetails}
                      href={localizedPath(
                        `/engagement/${engagementId}/archive`
                      )}
                    />
                  }
                  variant="outline"
                >
                  {archiveCopy.editDetails}
                </Button>
              )}
              {isEditStep ? (
                <>
                  <Button
                    disabled={!payload || save.isPending || !workflow?.canEdit}
                    onClick={() => {
                      if (payload) {
                        void savePayload(payload);
                      }
                    }}
                    variant="outline"
                  >
                    <Save className="size-4" /> {archiveCopy.saveDraft}
                  </Button>
                  <Button
                    disabled={
                      !payload ||
                      submit.isPending ||
                      !workflow?.canSubmit ||
                      (workflow?.overrideRequired && !overrideReason.trim())
                    }
                    onClick={reviewArchive}
                  >
                    {archiveCopy.review}
                  </Button>
                </>
              ) : null}
              {draftId && isEditStep ? (
                <>
                  <Button
                    disabled={
                      remove.isPending ||
                      workflow?.status === "PENDING_PIC" ||
                      !workflow?.canEdit
                    }
                    onClick={() => setDeleteOpen(true)}
                    variant="outline"
                  >
                    <Trash2 className="size-4" /> {archiveCopy.deleteDraft}
                  </Button>
                  <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {archiveCopy.deleteTitle}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {archiveCopy.deleteDescription}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>
                          {archiveCopy.confirmCancel}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            setDeleteOpen(false);
                            remove.mutate();
                          }}
                        >
                          {archiveCopy.deleteAction}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : null}
              {isReviewStep ? (
                <>
                  {workflow?.canReturn ? (
                    <label className="grid gap-2 border-l-2 border-muted px-3 text-sm">
                      <span className="font-medium">
                        {archiveCopy.returnSectionTitle}
                      </span>
                      <Textarea
                        value={returnReason}
                        onChange={(event) =>
                          setReturnReason(event.target.value)
                        }
                        placeholder={archiveCopy.returnPlaceholder}
                      />
                      <Button
                        variant="outline"
                        disabled={
                          !returnReason.trim() ||
                          returnForRevision.isPending ||
                          (workflow?.overrideRequired && !overrideReason.trim())
                        }
                        onClick={() => returnForRevision.mutate()}
                      >
                        <Undo2 className="size-4" /> {archiveCopy.returnToMic}
                      </Button>
                    </label>
                  ) : null}
                  <Button
                    disabled={
                      !draftId ||
                      blockers.length > 0 ||
                      !workflow?.canApprove ||
                      (workflow?.overrideRequired && !overrideReason.trim())
                    }
                    nativeButton={false}
                    render={
                      <a
                        aria-label={archiveCopy.stepConfirm}
                        href={confirmHref}
                      />
                    }
                  >
                    <Archive className="size-4" /> {archiveCopy.stepConfirm}
                  </Button>
                </>
              ) : null}
              {isConfirmStep ? (
                <>
                  <Button
                    disabled={
                      !draftId ||
                      blockers.length > 0 ||
                      finalize.isPending ||
                      !workflow?.canApprove ||
                      (readiness.some((item) => item.severity === "WARNING") &&
                        !warningsAcknowledged) ||
                      (workflow?.overrideRequired && !overrideReason.trim())
                    }
                    onClick={() => setConfirmOpen(true)}
                  >
                    <Archive className="size-4" /> {archiveCopy.confirm}
                  </Button>
                  <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {archiveCopy.confirmTitle}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {archiveCopy.confirmDescription}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      {readiness.some((item) => item.severity === "WARNING") ? (
                        <ul className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                          {readiness
                            .filter((item) => item.severity === "WARNING")
                            .map((item) => (
                              <li className="flex gap-2" key={item.code}>
                                <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                                <span>
                                  {formatReadinessText(item, archiveCopy)}
                                </span>
                              </li>
                            ))}
                        </ul>
                      ) : null}
                      <AlertDialogFooter>
                        <AlertDialogCancel>
                          {archiveCopy.confirmCancel}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => finalize.mutate()}
                          variant="default"
                        >
                          {archiveCopy.confirmAction}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : null}
            </>
          )}
        </div>
      </header>

      {isFrozen ? null : (
        <>
          {workflow?.status === "RETURNED" ? (
            <section className="border-l-2 border-destructive bg-destructive/5 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <CircleAlert className="size-4 text-destructive" />
                <strong className="text-destructive">
                  {archiveCopy.returnBannerTitle}
                </strong>
                {draft?.returnedAt ? (
                  <span className="text-muted-foreground">
                    {formatArchiveDateTime(draft.returnedAt, locale)}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 whitespace-pre-wrap">
                {draft?.returnReason?.trim() ||
                  archiveCopy.returnBannerEmptyReason}
              </p>
            </section>
          ) : null}
          <div className="sticky top-0 z-10 -mx-4 flex items-center gap-3 border-b bg-background/95 px-4 py-2 text-xs backdrop-blur lg:hidden">
            <span className="font-medium">
              {workflowStatusLabel(workflow?.status ?? "DRAFT", archiveCopy)}
            </span>
            {blockers.length ? (
              <span className="text-destructive">
                {archiveCopy.openItems.replace(
                  "{count}",
                  String(blockers.length)
                )}
              </span>
            ) : (
              <span className="text-emerald-700">
                {archiveCopy.readyForReview}
              </span>
            )}
            <span className="ml-auto text-muted-foreground">
              {railSaveState}
            </span>
          </div>
        </>
      )}

      <CmpEngagementImportDialog
        open={createFromArchiveOpen}
        sourceEngagementCode={archiveEngagement?.engagementCode ?? null}
        onOpenChange={setCreateFromArchiveOpen}
        onConfirm={(importSections) => {
          if (!archiveEngagement) {
            return;
          }
          setCreateFromArchiveOpen(false);
          router.push(
            localizedPath(
              `/engagement/new?clientId=${encodeURIComponent(archiveEngagement.clientId)}&sourceEngagementId=${encodeURIComponent(archiveEngagement.id)}&sourceArchived=1&importSections=${encodeURIComponent(importSections)}`
            )
          );
        }}
      />

      <div className="cmp-archive-workbench mt-6 grid gap-0 lg:grid-cols-[12rem_minmax(0,1fr)_18rem]">
        {isFrozen ? null : (
          <ArchiveWorkflowNavigation
            currentMode={currentMode}
            engagementId={engagementId}
          />
        )}
        <div
          className={`min-w-0 space-y-0 lg:border-x lg:px-8 ${isFrozen ? "lg:col-span-3" : ""}`}
        >
          {!isFrozen &&
          isEditStep &&
          workflow?.canEdit &&
          payload &&
          archiveEngagement ? (
            <ArchiveForm
              engagement={archiveEngagement}
              exchangeRate={(() => {
                const systemRate =
                  exchangeRates.data?.rates.find(
                    (rate) => rate.id === payload.feeExchangeRateSnapshotId
                  ) ?? getCmpFixedBudgetExchangeRate(payload.feeCurrency);
                return payload.feeExchangeRateSource === "MANUAL" &&
                  payload.feeExchangeRateHkdPerUnit
                  ? {
                      ...systemRate,
                      hkdPerUnit: payload.feeExchangeRateHkdPerUnit,
                    }
                  : systemRate;
              })()}
              isPrivateClient={false}
              memberCosts={rows}
              payload={payload}
              totals={totals}
              users={users.data ?? []}
              approvedTmsRows={tmsSummary.data?.approved.rows ?? []}
              billing={billing.data}
              billingLoading={billing.isLoading}
              tmsSummary={tmsSummary}
              onChange={setPayload}
            />
          ) : null}
          {(isFrozen || !isEditStep || (!workflow?.canEdit && !isFrozen)) &&
          archiveEngagement ? (
            <ArchiveReadOnlyDetails
              engagement={archiveEngagement}
              memberCosts={rows}
              payload={
                isFrozen ? payloadFromEngagement(archiveEngagement) : payload
              }
              review={!isEditStep && !isFrozen}
              submittedByName={
                draft?.submittedById
                  ? ((users.data ?? []).find(
                      (user) => user.id === draft.submittedById
                    )?.name ?? draft.submittedById)
                  : null
              }
              submittedAt={draft?.submittedAt ?? null}
              tmsSummary={tmsSummary}
              totals={totals}
              billing={billing.data}
              billingLoading={billing.isLoading}
            />
          ) : null}
          {isFrozen && snapshot.data ? (
            <ArchiveApprovalMetadata
              snapshot={snapshot.data}
              users={users.data ?? []}
            />
          ) : null}
          {!isFrozen && workflow?.overrideRequired ? (
            <section className="border-l-2 border-amber-500 bg-amber-500/5 px-4 py-4">
              <h2 className="font-semibold">{archiveCopy.overrideTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {archiveCopy.overrideDescription}
              </p>
              <Textarea
                className="mt-3"
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
                placeholder={archiveCopy.overridePlaceholder}
              />
            </section>
          ) : null}
        </div>
        {isFrozen ? null : (
          <ArchiveReadinessRail
            blockers={blockers}
            readiness={readiness}
            saveState={railSaveState}
            workflowStatus={workflow?.status ?? "DRAFT"}
          >
            <div className="cmp-archive-rail-actions mt-6 grid gap-2 border-t pt-5">
              {isEditStep ? (
                <>
                  <Button
                    disabled={!payload || save.isPending || !workflow?.canEdit}
                    onClick={() => {
                      if (payload) {
                        void savePayload(payload);
                      }
                    }}
                    variant="outline"
                  >
                    <Save className="size-4" /> {archiveCopy.saveDraft}
                  </Button>
                  <Button
                    disabled={
                      !payload ||
                      submit.isPending ||
                      !workflow?.canSubmit ||
                      (workflow?.overrideRequired && !overrideReason.trim())
                    }
                    onClick={reviewArchive}
                  >
                    {archiveCopy.review}
                  </Button>
                  {draftId ? (
                    <Button
                      disabled={
                        remove.isPending ||
                        workflow?.status === "PENDING_PIC" ||
                        !workflow?.canEdit
                      }
                      onClick={() => setDeleteOpen(true)}
                      variant="ghost"
                    >
                      <Trash2 className="size-4" /> {archiveCopy.deleteDraft}
                    </Button>
                  ) : null}
                </>
              ) : null}
              {isReviewStep ? (
                <>
                  <Button
                    nativeButton={false}
                    render={
                      <a
                        aria-label={archiveCopy.editDetails}
                        href={localizedPath(
                          `/engagement/${engagementId}/archive`
                        )}
                      />
                    }
                    variant="outline"
                  >
                    {archiveCopy.editDetails}
                  </Button>
                  <Button
                    disabled={
                      !draftId ||
                      blockers.length > 0 ||
                      !workflow?.canApprove ||
                      (workflow?.overrideRequired && !overrideReason.trim())
                    }
                    nativeButton={false}
                    render={
                      <a
                        aria-label={archiveCopy.stepConfirm}
                        href={confirmHref}
                      />
                    }
                  >
                    <Archive className="size-4" /> {archiveCopy.stepConfirm}
                  </Button>
                </>
              ) : null}
              {isConfirmStep ? (
                <>
                  <div className="border-l-2 border-amber-500 bg-amber-500/10 px-3 py-3 text-sm">
                    <p className="font-medium text-amber-900 dark:text-amber-100">
                      {archiveCopy.confirmTitle}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {archiveCopy.confirmDescription}
                    </p>
                    {readiness.some((item) => item.severity === "WARNING") ? (
                      <>
                        <p className="mt-4 font-medium text-amber-900 dark:text-amber-100">
                          {archiveCopy.warningsConfirmTitle}
                        </p>
                        <ul className="mt-2 space-y-1">
                          {readiness
                            .filter((item) => item.severity === "WARNING")
                            .map((item) => (
                              <li className="flex gap-2" key={item.code}>
                                <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                                <span>
                                  {formatReadinessText(item, archiveCopy)}
                                </span>
                              </li>
                            ))}
                        </ul>
                        <label className="mt-3 flex gap-3">
                          <Checkbox
                            checked={warningsAcknowledged}
                            onCheckedChange={(checked) =>
                              setWarningsAcknowledged(checked === true)
                            }
                          />
                          <span>{archiveCopy.acknowledgeWarnings}</span>
                        </label>
                      </>
                    ) : null}
                  </div>
                  <Textarea
                    value={approvalNote}
                    onChange={(event) => setApprovalNote(event.target.value)}
                    placeholder={archiveCopy.approvalNotePlaceholder}
                  />
                  <Button
                    disabled={
                      !draftId ||
                      blockers.length > 0 ||
                      finalize.isPending ||
                      !workflow?.canApprove ||
                      (readiness.some((item) => item.severity === "WARNING") &&
                        !warningsAcknowledged) ||
                      (workflow?.overrideRequired && !overrideReason.trim())
                    }
                    onClick={() => setConfirmOpen(true)}
                  >
                    <Archive className="size-4" /> {archiveCopy.confirm}
                  </Button>
                </>
              ) : null}
            </div>
          </ArchiveReadinessRail>
        )}
      </div>
      <a
        className="text-sm text-primary underline"
        href={localizedPath("/engagement/archive")}
      >
        {archiveCopy.viewArchived}
      </a>
      {isFrozen ? null : (
        <div className="cmp-archive-mobile-action lg:hidden">
          {isEditStep ? (
            <Button
              disabled={
                !payload ||
                submit.isPending ||
                !workflow?.canSubmit ||
                (workflow?.overrideRequired && !overrideReason.trim())
              }
              onClick={reviewArchive}
            >
              {archiveCopy.review}
            </Button>
          ) : null}
          {isReviewStep ? (
            <Button
              disabled={
                !draftId ||
                blockers.length > 0 ||
                !workflow?.canApprove ||
                (workflow?.overrideRequired && !overrideReason.trim())
              }
              nativeButton={false}
              render={
                <a aria-label={archiveCopy.stepConfirm} href={confirmHref} />
              }
            >
              <Archive className="size-4" /> {archiveCopy.stepConfirm}
            </Button>
          ) : null}
          {isConfirmStep ? (
            <Button
              disabled={
                !draftId ||
                blockers.length > 0 ||
                finalize.isPending ||
                !workflow?.canApprove ||
                (readiness.some((item) => item.severity === "WARNING") &&
                  !warningsAcknowledged) ||
                (workflow?.overrideRequired && !overrideReason.trim())
              }
              onClick={() => setConfirmOpen(true)}
            >
              <Archive className="size-4" /> {archiveCopy.confirm}
            </Button>
          ) : null}
        </div>
      )}
    </main>
  );
}

export function ArchiveWorkflowNavigation({
  currentMode,
  engagementId,
}: {
  currentMode: ArchiveWorkflowMode;
  engagementId: string;
}) {
  const { dictionary, localizedPath } = useCmpI18n();
  const archiveCopy = dictionary.workspace.archive;
  const steps: {
    href: string;
    label: string;
    mode: ArchiveWorkflowMode;
  }[] = [
    {
      href: localizedPath(`/engagement/${engagementId}/archive`),
      label: archiveCopy.stepFill,
      mode: "edit",
    },
    {
      href: localizedPath(`/engagement/${engagementId}/archive/review`),
      label: archiveCopy.stepReview,
      mode: "review",
    },
    {
      href: localizedPath(`/engagement/${engagementId}/archive/confirm`),
      label: archiveCopy.stepConfirm,
      mode: "confirm",
    },
  ];
  const currentIndex = steps.findIndex((step) => step.mode === currentMode);
  const sections = [
    { href: "#archive-overview", label: archiveCopy.projectOverview },
    { href: "#archive-report", label: archiveCopy.reportInformation },
    { href: "#archive-budget", label: archiveCopy.peopleAndBudget },
    { href: "#archive-remarks", label: dictionary.workspace.remarks },
  ];

  return (
    <aside className="cmp-archive-flow-nav lg:sticky lg:top-5 lg:h-fit lg:pr-6">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {archiveCopy.closeoutStatus}
      </p>
      <ol className="mt-3 grid gap-1 border-l">
        {steps.map((step, index) => (
          <li key={step.mode}>
            <a
              aria-current={step.mode === currentMode ? "step" : undefined}
              className={`cmp-archive-flow-step ${step.mode === currentMode ? "is-active" : ""} ${index < currentIndex ? "is-complete" : ""}`}
              href={step.href}
            >
              {index < currentIndex ? (
                <CheckCircle2 className="size-3.5" />
              ) : (
                <span className="cmp-archive-flow-marker">{index + 1}</span>
              )}
              <span>{step.label}</span>
            </a>
          </li>
        ))}
      </ol>
      <nav
        className="mt-7 hidden border-l lg:block"
        aria-label={archiveCopy.title}
      >
        <p className="mb-2 pl-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {archiveCopy.projectOverview}
        </p>
        {sections.map((section) => (
          <a
            className="cmp-archive-section-link"
            href={section.href}
            key={section.href}
          >
            {section.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}

function ArchiveReadinessRail({
  blockers,
  children,
  readiness,
  saveState,
  workflowStatus,
}: {
  blockers: string[];
  children?: ReactNode;
  readiness: CmpEngagementArchiveReadinessCheck[];
  saveState: string;
  workflowStatus: "DRAFT" | "PENDING_PIC" | "RETURNED";
}) {
  const { dictionary } = useCmpI18n();
  const archiveCopy = dictionary.workspace.archive;
  const targetFor = (code: string) =>
    code.includes("TMS") || code.includes("BUDGET") || code.includes("TBC")
      ? "archive-budget"
      : code.includes("REPORT") || code.includes("DELIVERABLE")
        ? "archive-report"
        : "archive-overview";
  const jump = (code: string) => {
    const target = document.querySelector(`#${targetFor(code)}`);
    target?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    target?.classList.remove("cmp-archive-anchor-highlight");
    window.setTimeout(
      () => target?.classList.add("cmp-archive-anchor-highlight"),
      0
    );
    window.setTimeout(
      () => target?.classList.remove("cmp-archive-anchor-highlight"),
      720
    );
  };
  const unrepresentedBlockers = blockers.filter(
    () => !readiness.some((item) => item.severity === "BLOCKER")
  );
  return (
    <aside
      className="cmp-archive-rail h-fit border-t pt-5 lg:sticky lg:top-5 lg:border-t-0 lg:pl-6"
      aria-live="polite"
    >
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {archiveCopy.closeoutStatus}
      </p>
      <p className="mt-1 font-semibold">
        {workflowStatusLabel(workflowStatus, archiveCopy)}
      </p>
      <p
        className={`mt-3 text-xs ${
          saveState === archiveCopy.saveFailed
            ? "text-destructive"
            : "text-muted-foreground"
        }`}
      >
        {saveState}
      </p>
      <div className="mt-5 divide-y border-y">
        {readiness.map((item) => (
          <SharedButton
            variant="quiet"
            fullWidth
            size="sm"
            className={`cmp-archive-readiness block w-full border-l-2 px-3 py-3 text-left text-xs ${item.severity === "BLOCKER" ? "border-destructive bg-destructive/5" : "border-transparent hover:bg-muted/50"}`}
            key={item.code}
            onClick={() => jump(item.code)}
            type="button"
          >
            <span
              className={`font-medium ${item.severity === "BLOCKER" ? "text-destructive" : ""}`}
            >
              {item.severity === "BLOCKER"
                ? archiveCopy.severityBlocker
                : archiveCopy.severityWarning}
            </span>
            <span className="ml-2 text-muted-foreground">
              {formatReadinessText(item, archiveCopy)}
            </span>
          </SharedButton>
        ))}
        {!readiness.length && !blockers.length ? (
          <p className="border-l-2 border-emerald-600 bg-emerald-500/10 px-3 py-3 text-xs text-emerald-800">
            <CheckCircle2 className="mr-1 inline size-3" />
            {archiveCopy.readyForReview}
          </p>
        ) : null}
        {unrepresentedBlockers.length ? (
          <div className="border-l-2 border-destructive bg-destructive/5 px-3 py-3 text-xs">
            <p className="font-medium text-destructive">
              {archiveCopy.errorBlockers}
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
              {unrepresentedBlockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {children}
    </aside>
  );
}

function ArchiveForm({
  engagement,
  exchangeRate,
  isPrivateClient,
  memberCosts,
  onChange,
  payload,
  totals,
  users,
  approvedTmsRows,
  billing,
  billingLoading,
  tmsSummary,
}: {
  engagement: CmpEngagement;
  exchangeRate: ReturnType<typeof getCmpFixedBudgetExchangeRate>;
  isPrivateClient: boolean;
  memberCosts: ArchiveMemberCost[];
  onChange: (value: CmpEngagementArchivePayload) => void;
  payload: CmpEngagementArchivePayload;
  totals?: ArchiveTotals;
  users: Awaited<ReturnType<typeof api.userDirectory>>;
  approvedTmsRows: TmsEngagementSummaryRow[];
  billing?: CmpBillingListResponse;
  billingLoading: boolean;
  tmsSummary?: TmsSummaryState;
}) {
  const { dictionary, locale } = useCmpI18n();
  const serializedPayloadLines = JSON.stringify(payload.feePlanningLines ?? []);
  const lastPersistedLines = useRef(serializedPayloadLines);
  const [formLines, setFormLines] = useState(() =>
    archiveFeePlanningFormLines(payload.feePlanningLines)
  );

  // Archive drafts use the formal fee-plan schema, which intentionally does
  // not accept an incomplete row. Keep a newly added empty row locally until
  // the user supplies its required grade, then persist the completed rows.
  useEffect(() => {
    if (lastPersistedLines.current === serializedPayloadLines) {
      return;
    }
    lastPersistedLines.current = serializedPayloadLines;
    setFormLines(archiveFeePlanningFormLines(payload.feePlanningLines));
  }, [payload.feePlanningLines, serializedPayloadLines]);

  const patchPayload = (patch: Partial<CmpEngagementArchivePayload>) =>
    onChange({ ...payload, ...patch });
  const updateBudget = (feePlanningLines: CmpFeePlanningFormLine[]) => {
    const summary = calculateFeePlanningTotals(feePlanningLines);
    const persistedLines = archiveFeePlanningPayloadLines(feePlanningLines);
    lastPersistedLines.current = JSON.stringify(persistedLines);
    setFormLines(feePlanningLines);
    patchPayload({
      feePlanningLines: persistedLines,
      budgetedHours:
        summary.totalHours > 0 ? summary.totalHours.toFixed(2) : "",
    });
  };

  return (
    <div className="space-y-0">
      <ArchiveOverview
        engagement={engagement}
        payload={payload}
        onChange={patchPayload}
      />
      <ArchiveReportInformation
        editable
        payload={payload}
        onChange={patchPayload}
      />
      <ArchivePeopleAndBudget
        editable
        approvedTmsRows={approvedTmsRows}
        engagement={engagement}
        exchangeRate={exchangeRate}
        formLines={formLines}
        isPrivateClient={isPrivateClient}
        memberCosts={memberCosts}
        payload={payload}
        totals={totals}
        users={users}
        tmsSummary={tmsSummary}
        onBudgetChange={updateBudget}
        onPayloadChange={patchPayload}
      />
      <ArchiveTmsCoverage payload={payload} approvedRows={approvedTmsRows} />
      <ArchiveBillingSummary
        billing={billing}
        engagementId={engagement.id}
        feeNotes={engagement.feeNotes}
        loading={billingLoading}
        phase={getBillingScheduleCopy(locale).draftPhase}
      />
      <section
        className="cmp-archive-document-section border-t py-7"
        id="archive-remarks"
      >
        <label className="grid gap-1 text-sm">
          <span>{dictionary.workspace.remarks}</span>
          <Textarea
            value={payload.remarks ?? ""}
            onChange={(event) => patchPayload({ remarks: event.target.value })}
          />
        </label>
      </section>
    </div>
  );
}

function ArchiveApprovalMetadata({
  snapshot,
  users,
}: {
  snapshot: Awaited<ReturnType<typeof api.cmpEngagementArchiveSnapshot>>;
  users: Awaited<ReturnType<typeof api.cmpUsers>>;
}) {
  const { dictionary, locale } = useCmpI18n();
  const archiveCopy = dictionary.workspace.archive;
  const byId = new Map(users.map((user) => [user.id, user.name]));
  const name = (id: string | null) => (id ? (byId.get(id) ?? id) : "—");
  return (
    <section className="cmp-archive-document-section border-t py-7 text-sm">
      <h2 className="font-semibold">{archiveCopy.approvalRecordTitle}</h2>
      {snapshot.workflowVersion === 1 ? (
        <p className="mt-2 text-muted-foreground">
          {archiveCopy.legacyArchive}
        </p>
      ) : null}
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ArchiveDefinition
          label={archiveCopy.preparedBy}
          value={name(snapshot.preparedById)}
        />
        <ArchiveDefinition
          label={archiveCopy.submittedAtLabel}
          value={
            snapshot.submittedAt
              ? formatArchiveDateTime(snapshot.submittedAt, locale)
              : "—"
          }
        />
        <ArchiveDefinition
          label={archiveCopy.approvedBy}
          value={name(snapshot.approvedById ?? snapshot.archivedById)}
        />
        <ArchiveDefinition
          label={archiveCopy.archivedAtLabel}
          value={formatArchiveDateTime(snapshot.archivedAt, locale)}
        />
      </dl>
      {snapshot.approvalNote ? (
        <p className="mt-4 whitespace-pre-wrap text-muted-foreground">
          {snapshot.approvalNote}
        </p>
      ) : null}
      {snapshot.acknowledgedWarnings.length ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {archiveCopy.ackWarningsPrefix}
          {": "}
          {snapshot.acknowledgedWarnings
            .map((code) =>
              formatReadinessText({ code, params: {} }, archiveCopy)
            )
            .join("；")}
        </p>
      ) : null}
    </section>
  );
}

function ArchiveBillingSummary({
  billing,
  engagementId,
  feeNotes,
  loading,
  phase,
}: {
  billing?: CmpBillingListResponse;
  engagementId: string;
  feeNotes: CmpEngagement["feeNotes"];
  loading: boolean;
  phase: string;
}) {
  const phone = useCompactViewport(767.98);
  const { localizedPath, locale } = useCmpI18n();
  const mobileCopy = getBillingScheduleCopy(locale);
  const overview = billing?.collectionOverview;
  return (
    <section
      className="cmp-archive-document-section border-t py-7"
      id="archive-billing"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{mobileCopy.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{phase}</p>
        </div>
        <Button
          nativeButton={false}
          render={
            <a
              aria-label={mobileCopy.viewBills}
              href={localizedPath(`/engagement/${engagementId}/billing`)}
            />
          }
          size="sm"
          variant="outline"
        >
          {mobileCopy.viewBills}
        </Button>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold">{mobileCopy.schedule}</h3>
        {feeNotes.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {mobileCopy.emptySchedule}
          </p>
        ) : phone ? (
          <div>
            {feeNotes.map((note) => (
              <section
                className={mobileStyles.record}
                key={note.id ?? note.periodNumber}
              >
                <h4>
                  {mobileCopy.period} {note.periodNumber}
                </h4>
                <dl className={mobileStyles.metrics}>
                  {[
                    [mobileCopy.plannedDate, note.plannedIssueDate || "—"],
                    [
                      mobileCopy.plannedAmount,
                      formatArchiveCurrency(note.plannedAmount, note.currency),
                    ],
                    [mobileCopy.number, note.feeNoteNumber || "—"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{mobileCopy.period}</th>
                  <th className="px-3 py-2 font-medium">
                    {mobileCopy.plannedDate}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {mobileCopy.plannedAmount}
                  </th>
                  <th className="px-3 py-2 font-medium">{mobileCopy.number}</th>
                </tr>
              </thead>
              <tbody>
                {feeNotes.map((note) => (
                  <tr className="border-t" key={note.id ?? note.periodNumber}>
                    <td className="px-3 py-2">
                      {mobileCopy.periodLabel(note.periodNumber)}
                    </td>
                    <td className="px-3 py-2">{note.plannedIssueDate}</td>
                    <td className="px-3 py-2">
                      {formatArchiveCurrency(note.plannedAmount, note.currency)}
                    </td>
                    <td className="px-3 py-2">{note.feeNoteNumber || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold">{mobileCopy.liveCollections}</h3>
        {loading ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {mobileCopy.loading}
          </p>
        ) : !billing || billing.billings.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {mobileCopy.emptyBills}
          </p>
        ) : (
          <>
            {overview ? (
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <ArchiveMetric
                  label={mobileCopy.agreedFee}
                  value={formatArchiveCurrency(
                    overview.agreedFee,
                    overview.currency
                  )}
                />
                <ArchiveMetric
                  label={mobileCopy.received}
                  value={formatArchiveCurrency(
                    overview.actualReceived,
                    overview.currency
                  )}
                />
                <ArchiveMetric
                  label={mobileCopy.outstanding}
                  value={formatArchiveCurrency(
                    overview.outstanding,
                    overview.currency
                  )}
                />
              </dl>
            ) : null}
            {phone ? (
              <div>
                {billing.billings.map((item) => (
                  <section className={mobileStyles.record} key={item.id}>
                    <h4>{item.billNumber}</h4>
                    <dl className={mobileStyles.metrics}>
                      {[
                        [mobileCopy.issueDate, item.issueDate],
                        [
                          mobileCopy.amount,
                          formatArchiveCurrency(
                            item.totalAmount,
                            item.currency
                          ),
                        ],
                        [
                          mobileCopy.received,
                          formatArchiveCurrency(
                            item.receiptTotalInBillCurrency,
                            item.currency
                          ),
                        ],
                        [
                          mobileCopy.outstanding,
                          formatArchiveCurrency(
                            item.remainingAmount,
                            item.currency
                          ),
                        ],
                        [mobileCopy.status, item.status],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[700px] text-sm">
                  <thead className="bg-muted/40 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">
                        {mobileCopy.billNumber}
                      </th>
                      <th className="px-3 py-2 font-medium">
                        {mobileCopy.issueDate}
                      </th>
                      <th className="px-3 py-2 font-medium">
                        {mobileCopy.amount}
                      </th>
                      <th className="px-3 py-2 font-medium">
                        {mobileCopy.received}
                      </th>
                      <th className="px-3 py-2 font-medium">
                        {mobileCopy.outstanding}
                      </th>
                      <th className="px-3 py-2 font-medium">
                        {mobileCopy.status}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {billing.billings.map((item) => (
                      <tr className="border-t" key={item.id}>
                        <td className="px-3 py-2 font-medium">
                          {item.billNumber}
                        </td>
                        <td className="px-3 py-2">{item.issueDate}</td>
                        <td className="px-3 py-2">
                          {formatArchiveCurrency(
                            item.totalAmount,
                            item.currency
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {formatArchiveCurrency(
                            item.receiptTotalInBillCurrency,
                            item.currency
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {formatArchiveCurrency(
                            item.remainingAmount,
                            item.currency
                          )}
                        </td>
                        <td className="px-3 py-2">{item.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export function ArchiveReadOnlyDetails({
  engagement,
  memberCosts,
  payload,
  review,
  billing,
  billingLoading,
  submittedAt = null,
  submittedByName = null,
  tmsSummary,
  totals,
}: {
  engagement: CmpEngagement;
  memberCosts: ArchiveMemberCost[];
  payload: CmpEngagementArchivePayload | null;
  review: boolean;
  billing?: CmpBillingListResponse;
  billingLoading: boolean;
  submittedAt?: string | null;
  submittedByName?: string | null;
  tmsSummary?: TmsSummaryState;
  totals?: ArchiveTotals;
}) {
  const { dictionary, locale } = useCmpI18n();
  const archiveCopy = dictionary.workspace.archive;
  if (!payload) {
    return null;
  }
  return (
    <div className="space-y-0">
      {review ? (
        <section className="border-l-2 border-amber-500 bg-amber-500/5 px-4 py-3 text-sm">
          <strong className="text-amber-900 dark:text-amber-100">
            {archiveCopy.readyForConfirmation}
          </strong>
          {submittedByName ? (
            <p className="mt-1 text-muted-foreground">
              {archiveCopy.submittedByLabel}
              {": "}
              {submittedByName}
              {submittedAt
                ? ` · ${formatArchiveDateTime(submittedAt, locale)}`
                : ""}
            </p>
          ) : null}
        </section>
      ) : null}
      <ArchiveOverview engagement={engagement} payload={payload} />
      <ArchiveReportInformation payload={payload} />
      <ArchivePeopleAndBudget
        engagement={engagement}
        memberCosts={memberCosts}
        payload={payload}
        tmsSummary={tmsSummary}
        totals={totals}
      />
      <ArchiveBillingSummary
        billing={billing}
        engagementId={engagement.id}
        feeNotes={engagement.feeNotes}
        loading={billingLoading}
        phase={getBillingScheduleCopy(locale).frozenPhase}
      />
      {payload.remarks ? (
        <section
          className="cmp-archive-document-section border-t py-7 text-sm"
          id="archive-remarks"
        >
          <h2 className="font-semibold">{dictionary.workspace.remarks}</h2>
          <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
            {payload.remarks}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function ArchiveOverview({
  engagement,
  onChange,
  payload,
}: {
  engagement: CmpEngagement;
  onChange?: (patch: Partial<CmpEngagementArchivePayload>) => void;
  payload: CmpEngagementArchivePayload;
}) {
  const { dictionary } = useCmpI18n();
  const copy = dictionary.workspace;
  const archiveCopy = copy.archive;
  const person = (name: string | null | undefined) =>
    name?.trim() || archiveCopy.notSet;
  const clientName =
    engagement.client.nameZh ||
    engagement.client.nameEn ||
    engagement.client.clientCode;

  return (
    <section
      className="cmp-archive-section cmp-archive-document-section border-t py-7"
      id="archive-overview"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">
            {archiveCopy.projectOverview}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{clientName}</p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          {engagement.status}
        </span>
      </div>
      <dl className="mt-5 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <ArchiveDefinition label={archiveCopy.clientName} value={clientName} />
        <ArchiveDefinition
          label={archiveCopy.clientCode}
          value={engagement.client.clientCode || archiveCopy.notSet}
        />
        <ArchiveDefinition label={copy.pic} value={person(payload.pic)} />
        <ArchiveDefinition label={copy.mic} value={person(payload.mic)} />
        <ArchiveDefinition
          label={copy.eqReviewer}
          value={person(payload.eqReviewer)}
        />
        {onChange ? (
          <>
            <ArchiveDefinitionInput
              label={copy.engagementCode}
              value={payload.engagementCode}
              onChange={(value) => onChange({ engagementCode: value })}
            />
            <ArchiveDefinitionInput
              label={copy.serviceType}
              value={payload.serviceType}
              onChange={(value) =>
                onChange({
                  serviceType:
                    value as CmpEngagementArchivePayload["serviceType"],
                })
              }
            />
            <ArchiveDefinitionInput
              label={archiveCopy.yearEnd}
              type="date"
              value={payload.yearEndDate ?? ""}
              onChange={(value) => onChange({ yearEndDate: value })}
            />
          </>
        ) : (
          <>
            <ArchiveDefinition
              label={copy.engagementCode}
              value={payload.engagementCode}
            />
            <ArchiveDefinition
              label={copy.serviceType}
              value={payload.serviceType}
            />
            <ArchiveDefinition
              label={archiveCopy.yearEnd}
              value={payload.yearEndDate || archiveCopy.notSet}
            />
          </>
        )}
      </dl>
      {onChange ? (
        <div className="mt-5 border-t pt-5">
          <label className="grid gap-1 text-sm">
            <span>{archiveCopy.otherServiceDescription}</span>
            <Textarea
              value={payload.otherServiceDescription ?? ""}
              onChange={(event) =>
                onChange({ otherServiceDescription: event.target.value })
              }
            />
          </label>
        </div>
      ) : null}
    </section>
  );
}

function ArchiveDefinition({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium break-words">{value}</dd>
    </div>
  );
}

function ArchiveDefinitionInput({
  label,
  onChange,
  type,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1">
        <Input
          aria-label={label}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </dd>
    </div>
  );
}

function ArchiveReportInformation({
  editable = false,
  onChange,
  payload,
}: {
  editable?: boolean;
  onChange?: (patch: Partial<CmpEngagementArchivePayload>) => void;
  payload: CmpEngagementArchivePayload;
}) {
  const { dictionary, locale } = useCmpI18n();
  const copy = dictionary.workspace;
  const archiveCopy = copy.archive;
  const deliverables = payload.deliverables ?? [];
  const visibleDeliverables = formatEngagementDeliverables(
    deliverables,
    locale
  );
  return (
    <section
      className="cmp-archive-section cmp-archive-document-section border-t py-7"
      id="archive-report"
    >
      <h2 className="text-lg font-semibold">{archiveCopy.reportInformation}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {copy.engagementDeliverablesDescription}
      </p>
      {editable && onChange ? (
        <div className="mt-5 grid gap-4">
          <label className="grid max-w-sm gap-1 text-sm">
            <span>{copy.reportDate}</span>
            <Input
              type="date"
              value={payload.reportDate ?? ""}
              onChange={(event) => onChange({ reportDate: event.target.value })}
            />
          </label>
          <EngagementDeliverablesField
            locale={locale}
            serviceType={payload.serviceType}
            value={deliverables}
            onChange={(next) => onChange({ deliverables: next })}
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-5">
          <ArchiveDefinition
            label={copy.reportDate}
            value={payload.reportDate || archiveCopy.notSet}
          />
          {visibleDeliverables.length ? (
            <ul className="grid gap-2 text-sm">
              {visibleDeliverables.map((item) => (
                <li
                  className="rounded-lg border bg-muted/20 px-3 py-2"
                  key={item}
                >
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {archiveCopy.reportsEmpty}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

const EMPTY_APPROVED_TMS_ROWS: TmsEngagementSummaryRow[] = [];

function ArchivePeopleAndBudget({
  approvedTmsRows = EMPTY_APPROVED_TMS_ROWS,
  editable = false,
  engagement,
  exchangeRate,
  formLines,
  isPrivateClient,
  memberCosts,
  onBudgetChange,
  onPayloadChange,
  payload,
  tmsSummary,
  totals,
  users,
}: {
  approvedTmsRows?: TmsEngagementSummaryRow[];
  editable?: boolean;
  engagement: CmpEngagement;
  exchangeRate?: ReturnType<typeof getCmpFixedBudgetExchangeRate>;
  formLines?: CmpFeePlanningFormLine[];
  isPrivateClient?: boolean;
  memberCosts: ArchiveMemberCost[];
  onBudgetChange?: (lines: CmpFeePlanningFormLine[]) => void;
  onPayloadChange?: (patch: Partial<CmpEngagementArchivePayload>) => void;
  payload: CmpEngagementArchivePayload;
  tmsSummary?: TmsSummaryState;
  totals?: ArchiveTotals;
  users?: Awaited<ReturnType<typeof api.userDirectory>>;
}) {
  const { dictionary } = useCmpI18n();
  const copy = dictionary.workspace;
  const archiveCopy = copy.archive;
  const normalizedLines =
    formLines ?? archiveFeePlanningFormLines(payload.feePlanningLines);
  const budget = calculateFeePlanningTotals(normalizedLines);
  const agreedFee = Number(payload.agreedFee || 0);
  const effectiveHourlyRate =
    Number.isFinite(agreedFee) && budget.totalHours > 0
      ? agreedFee / budget.totalHours
      : null;
  const names = useMemo(() => {
    const result = new Map<string, string>();
    for (const row of memberCosts) {
      if (row.name) {
        result.set(row.userId, row.name);
      }
    }
    for (const line of engagement.feePlanningLines) {
      if (line.staff) {
        result.set(line.staff.id, line.staff.name);
      }
    }
    return result;
  }, [engagement.feePlanningLines, memberCosts]);

  return (
    <section
      className="cmp-archive-section cmp-archive-document-section border-t py-7"
      id="archive-budget"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {archiveCopy.peopleAndBudget}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {archiveCopy.budgetPersonnelDescription}
          </p>
        </div>
        <span className="text-sm text-muted-foreground">
          {archiveCopy.personnelRows.replace(
            "{count}",
            String(normalizedLines.length)
          )}
        </span>
      </div>
      {editable && onPayloadChange ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span>{copy.agreedFee}</span>
            <Input
              min="0"
              step="0.01"
              type="number"
              value={payload.agreedFee}
              onChange={(event) =>
                onPayloadChange({ agreedFee: event.target.value })
              }
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span>{copy.currency}</span>
            <SelectField
              label={copy.currency}
              labelVisibility="hidden"
              value={payload.feeCurrency}
              onValueChange={(value) => {
                const feeCurrency =
                  value as CmpEngagementArchivePayload["feeCurrency"];
                const systemRate = getCmpFixedBudgetExchangeRate(feeCurrency);
                onPayloadChange({
                  feeCurrency,
                  feeExchangeRateSnapshotId:
                    feeCurrency === "HKD" ? "" : systemRate.id,
                  feeExchangeRateHkdPerUnit: systemRate.hkdPerUnit,
                  feeExchangeRateSource: "SYSTEM",
                });
              }}
              options={CMP_BUDGET_CURRENCIES.map((currency) => ({
                value: currency,
                label: currency,
              }))}
            />
          </label>
          {payload.feeCurrency === "HKD" ? null : (
            <label className="grid gap-1 text-sm">
              <span>{`Exchange rate (1 ${payload.feeCurrency} = X HKD)`}</span>
              <Input
                min="0.00000001"
                step="0.00000001"
                type="number"
                value={payload.feeExchangeRateHkdPerUnit ?? ""}
                onChange={(event) =>
                  onPayloadChange({
                    feeExchangeRateHkdPerUnit: event.target.value,
                    feeExchangeRateSource: "MANUAL",
                  })
                }
              />
            </label>
          )}
        </div>
      ) : null}
      <ArchiveBudgetMetrics
        actualCost={totals?.actualCost}
        agreedFee={payload.agreedFee}
        budgetCost={totals?.budgetCost}
        currency={payload.feeCurrency}
        effectiveHourlyRate={effectiveHourlyRate}
        standardValue={budget.standardValue}
        totalHours={budget.totalHours}
      />
      {editable && onBudgetChange && users ? (
        <div className="mt-5 border-t pt-5">
          <CmpEngagementFeePlanningTable
            value={normalizedLines}
            onChange={onBudgetChange}
            currency={payload.feeCurrency}
            exchangeRate={exchangeRate}
            users={users}
            isPrivateClient={Boolean(isPrivateClient)}
            allowTbc={false}
            eligibleStaffIds={
              new Set(
                approvedTmsRows
                  .filter(
                    (row) =>
                      row.userId !== "total" &&
                      (Number(row.finalNormal ?? 0) > 0 ||
                        Number(row.finalOt ?? 0) > 0)
                  )
                  .map((row) => row.userId)
              )
            }
          />
        </div>
      ) : (
        <ArchiveBudgetPersonnelTable
          lines={normalizedLines}
          names={names}
          currency={payload.feeCurrency}
        />
      )}
      <ArchiveCostTable
        engagementCode={engagement.engagementCode}
        rows={memberCosts}
        tmsSummary={tmsSummary}
        totals={totals}
      />
    </section>
  );
}

function ArchiveBudgetMetrics({
  actualCost,
  agreedFee,
  budgetCost,
  currency,
  effectiveHourlyRate,
  standardValue,
  totalHours,
}: {
  actualCost?: string;
  agreedFee: string;
  budgetCost?: string;
  currency: string;
  effectiveHourlyRate: number | null;
  standardValue: number;
  totalHours: number;
}) {
  const { dictionary } = useCmpI18n();
  const copy = dictionary.workspace;
  const archiveCopy = copy.archive;
  return (
    <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <ArchiveMetric
        label={copy.agreedFee}
        value={formatArchiveCurrency(agreedFee, currency)}
      />
      <ArchiveMetric
        label={copy.budgetedHours}
        value={formatArchiveHours(totalHours)}
      />
      <ArchiveMetric
        label={archiveCopy.standardRateValue}
        value={formatArchiveCurrency(standardValue, currency)}
      />
      <ArchiveMetric
        label={archiveCopy.effectiveHourlyRate}
        value={
          effectiveHourlyRate === null
            ? archiveCopy.notSet
            : formatArchiveCurrency(effectiveHourlyRate, currency)
        }
      />
      <ArchiveMetric
        label={archiveCopy.budgetCost}
        value={
          budgetCost
            ? formatArchiveCurrency(budgetCost, currency)
            : archiveCopy.notSet
        }
      />
      <ArchiveMetric
        label={archiveCopy.actualCost}
        value={
          actualCost
            ? formatArchiveCurrency(actualCost, currency)
            : archiveCopy.notSet
        }
      />
    </dl>
  );
}

function ArchiveMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function ArchiveBudgetPersonnelTable({
  currency,
  lines,
  names,
}: {
  currency: string;
  lines: CmpFeePlanningFormLine[];
  names: Map<string, string>;
}) {
  const phone = useCompactViewport(767.98);
  const { dictionary } = useCmpI18n();
  const copy = dictionary.workspace;
  const archiveCopy = copy.archive;
  return (
    <section className="mt-5 border-t pt-5">
      <h3 className="text-sm font-semibold">{archiveCopy.budgetPersonnel}</h3>
      {lines.length && phone ? (
        <div>
          {lines.map((line) => {
            const staffName = line.staffUserId
              ? (names.get(line.staffUserId) ?? archiveCopy.notSet)
              : "TBC";
            return (
              <section className={mobileStyles.record} key={line.key}>
                <h4>{staffName}</h4>
                <dl className={mobileStyles.metrics}>
                  {[
                    [copy.feePlanningGrade, line.grade || archiveCopy.notSet],
                    [copy.feePlanningDateFrom, line.dateFrom || "—"],
                    [copy.feePlanningDateTo, line.dateTo || "—"],
                    [
                      copy.feePlanningFixedHourlyRate,
                      formatArchiveCurrency(line.hourlyRate, currency),
                    ],
                    [
                      copy.feePlanningRequiredHoursPerPerson,
                      formatArchiveHours(Number(line.budgetHours || 0)),
                    ],
                    [
                      copy.feePlanningTotal,
                      formatArchiveCurrency(
                        Number(line.hourlyRate || 0) *
                          Number(line.budgetHours || 0),
                        currency
                      ),
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
          <p>
            {copy.feePlanningTotal}:{" "}
            {formatArchiveCurrency(
              calculateFeePlanningTotals(lines).standardValue,
              currency
            )}
          </p>
        </div>
      ) : lines.length ? (
        <div className="mt-3 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">
                  {copy.feePlanningGrade}
                </th>
                <th className="px-3 py-2 font-medium">
                  {copy.feePlanningStaffName}
                </th>
                <th className="px-3 py-2 font-medium">
                  {copy.feePlanningDateFrom}
                </th>
                <th className="px-3 py-2 font-medium">
                  {copy.feePlanningDateTo}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {copy.feePlanningFixedHourlyRate}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {copy.feePlanningRequiredHoursPerPerson}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {copy.feePlanningTotal}
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const hours = Number(line.budgetHours || 0);
                const amount = Number(line.hourlyRate || 0) * hours;
                const { staffUserId } = line;
                const staffName = staffUserId
                  ? (names.get(staffUserId) ?? archiveCopy.notSet)
                  : "TBC";
                return (
                  <tr className="border-t" key={line.key}>
                    <td className="px-3 py-2">
                      {line.grade || archiveCopy.notSet}
                    </td>
                    <td className="px-3 py-2 font-medium">{staffName}</td>
                    <td className="px-3 py-2">{line.dateFrom || "—"}</td>
                    <td className="px-3 py-2">{line.dateTo || "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {formatArchiveCurrency(line.hourlyRate, currency)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatArchiveHours(hours)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatArchiveCurrency(amount, currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t bg-muted/20">
              <tr>
                <td className="px-3 py-2 font-semibold" colSpan={6}>
                  {copy.feePlanningTotal}
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {formatArchiveCurrency(
                    calculateFeePlanningTotals(lines).standardValue,
                    currency
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {archiveCopy.noBudgetPersonnel}
        </p>
      )}
    </section>
  );
}

function ArchiveCostTable({
  rows,
  engagementCode,
  tmsSummary,
  totals,
}: {
  rows: ArchiveMemberCost[];
  engagementCode: string;
  tmsSummary?: TmsSummaryState;
  totals?: ArchiveTotals;
}) {
  const phone = useCompactViewport(767.98);
  const { dictionary } = useCmpI18n();
  const copy = dictionary.workspace;
  const archiveCopy = copy.archive;
  const currency = totals?.currency ?? "HKD";
  const [tmsDialogOpen, setTmsDialogOpen] = useState(false);
  const [tmsTab, setTmsTab] = useState<"summary" | "worksheet">("summary");
  const worksheetQuery = useQuery({
    queryKey: ["cmp-tms-timesheet-records", engagementCode],
    queryFn: () => api.cmpTmsTimesheetRecords(engagementCode),
    enabled: tmsDialogOpen && tmsTab === "worksheet",
  });
  const worksheetRows =
    worksheetQuery.data?.mode === "DETAIL"
      ? worksheetQuery.data.rows
      : undefined;
  return (
    <section className="mt-5 border-t pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {archiveCopy.actualCostDetail}
        </h3>
        <Button
          disabled={!tmsSummary || tmsSummary.isLoading || tmsSummary.isError}
          onClick={() => setTmsDialogOpen(true)}
          size="sm"
          variant="outline"
        >
          <Clock className="size-4" /> {archiveCopy.viewTmsRecords}
        </Button>
      </div>
      <Dialog onOpenChange={setTmsDialogOpen} open={tmsDialogOpen}>
        <DialogContent
          className="max-w-[calc(100vw-3rem)] sm:max-w-6xl"
          closeLabel={archiveCopy.close}
        >
          <DialogHeader>
            <DialogTitle>{archiveCopy.actualCostDetail}</DialogTitle>
            <p className="text-sm font-normal text-muted-foreground">
              {archiveCopy.viewTmsRecordsDescription}
            </p>
          </DialogHeader>
          <Tabs
            onValueChange={(value) =>
              setTmsTab(value === "worksheet" ? "worksheet" : "summary")
            }
            value={tmsTab}
          >
            <TabsList>
              <TabsTrigger value="summary">
                {archiveCopy.tmsSummaryTab}
              </TabsTrigger>
              <TabsTrigger value="worksheet">
                {archiveCopy.tmsWorksheetTab}
              </TabsTrigger>
            </TabsList>
            <div className="max-h-[70vh] overflow-y-auto">
              <TabsContent value="summary">
                {tmsSummary?.data ? (
                  <CmpTmsSummary summary={tmsSummary.data} />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {tmsSummary?.isError
                      ? archiveCopy.unavailable
                      : archiveCopy.loading}
                  </p>
                )}
              </TabsContent>
              <TabsContent value="worksheet">
                {worksheetQuery.isLoading ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {archiveCopy.loading}
                  </p>
                ) : worksheetQuery.isError ? (
                  <p className="py-8 text-center text-sm text-destructive">
                    {worksheetQuery.error instanceof ApiError
                      ? worksheetQuery.error.message
                      : archiveCopy.unavailable}
                  </p>
                ) : worksheetRows ? (
                  <CmpTmsTimesheetWorksheet rows={worksheetRows} />
                ) : null}
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
      {rows.length && phone ? (
        <div>
          {rows.map((row) => (
            <section className={mobileStyles.record} key={row.userId}>
              <h4>
                {row.name || archiveCopy.notSet}
                {row.historical ? ` (${archiveCopy.historical})` : ""}
              </h4>
              <dl className={mobileStyles.metrics}>
                {[
                  [copy.feePlanningGrade, row.grade],
                  [
                    `${copy.tmsSummaryBudgetNormal} / ${copy.tmsSummaryBudgetOt}`,
                    `${row.budgetNormal} / ${row.budgetOt}`,
                  ],
                  [
                    `${copy.tmsSummaryFinalNormal} / ${copy.tmsSummaryFinalOt}`,
                    `${row.actualNormal} / ${row.actualOt}`,
                  ],
                  [copy.tmsSummaryAbsent, String(row.absent)],
                  [
                    copy.tmsSummaryRate,
                    formatArchiveCurrency(row.hourlyRate, currency),
                  ],
                  [
                    copy.tmsSummaryBudgetCost,
                    formatArchiveCurrency(row.budgetCost, currency),
                  ],
                  [
                    copy.tmsSummaryActualCost,
                    formatArchiveCurrency(row.actualCost, currency),
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <section className={mobileStyles.record}>
            <h4>{archiveCopy.totalRow}</h4>
            <dl className={mobileStyles.metrics}>
              {[
                [
                  `${copy.tmsSummaryBudgetNormal} / ${copy.tmsSummaryBudgetOt}`,
                  `${sumHours(rows, "budgetNormal")} / ${sumHours(rows, "budgetOt")}`,
                ],
                [
                  `${copy.tmsSummaryFinalNormal} / ${copy.tmsSummaryFinalOt}`,
                  `${sumHours(rows, "actualNormal")} / ${sumHours(rows, "actualOt")}`,
                ],
                [copy.tmsSummaryAbsent, String(sumHours(rows, "absent"))],
                [
                  copy.tmsSummaryBudgetCost,
                  formatArchiveCurrency(sumMoney(rows, "budgetCost"), currency),
                ],
                [
                  copy.tmsSummaryActualCost,
                  formatArchiveCurrency(sumMoney(rows, "actualCost"), currency),
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      ) : rows.length ? (
        <div className="mt-3 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">{copy.tmsSummaryName}</th>
                <th className="px-3 py-2">{copy.feePlanningGrade}</th>
                <th className="px-3 py-2">
                  {copy.tmsSummaryBudgetNormal} / {copy.tmsSummaryBudgetOt}
                </th>
                <th className="px-3 py-2">
                  {copy.tmsSummaryFinalNormal} / {copy.tmsSummaryFinalOt}
                </th>
                <th className="px-3 py-2">{copy.tmsSummaryAbsent}</th>
                <th className="px-3 py-2 text-right">{copy.tmsSummaryRate}</th>
                <th className="px-3 py-2 text-right">
                  {copy.tmsSummaryBudgetCost}
                </th>
                <th className="px-3 py-2 text-right">
                  {copy.tmsSummaryActualCost}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="border-t" key={row.userId}>
                  <td className="px-3 py-2 font-medium">
                    {row.name || archiveCopy.notSet}
                    {row.historical ? ` (${archiveCopy.historical})` : ""}
                  </td>
                  <td className="px-3 py-2">{row.grade}</td>
                  <td className="px-3 py-2">
                    {row.budgetNormal} / {row.budgetOt}
                  </td>
                  <td className="px-3 py-2">
                    {row.actualNormal} / {row.actualOt}
                  </td>
                  <td className="px-3 py-2">{row.absent}</td>
                  <td className="px-3 py-2 text-right">
                    {formatArchiveCurrency(row.hourlyRate, currency)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatArchiveCurrency(row.budgetCost, currency)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatArchiveCurrency(row.actualCost, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length ? (
              <tfoot className="border-t bg-muted/20">
                <tr>
                  <td className="px-3 py-2 font-semibold" colSpan={2}>
                    {archiveCopy.totalRow}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {sumHours(rows, "budgetNormal")} /{" "}
                    {sumHours(rows, "budgetOt")}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {sumHours(rows, "actualNormal")} /{" "}
                    {sumHours(rows, "actualOt")}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {sumHours(rows, "absent")}
                  </td>
                  <td aria-label="—" />
                  <td className="px-3 py-2 text-right font-semibold">
                    {formatArchiveCurrency(
                      sumMoney(rows, "budgetCost"),
                      currency
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {formatArchiveCurrency(
                      sumMoney(rows, "actualCost"),
                      currency
                    )}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {archiveCopy.notSet}
        </p>
      )}
    </section>
  );
}

function ArchiveTmsCoverage({
  payload,
  approvedRows,
}: {
  payload: CmpEngagementArchivePayload;
  approvedRows: TmsEngagementSummaryRow[];
}) {
  const { dictionary } = useCmpI18n();
  const archiveCopy = dictionary.workspace.archive;
  const assignedIds = new Set(
    (payload.feePlanningLines ?? [])
      .map((line) => line.staffUserId)
      .filter((userId): userId is string => Boolean(userId))
  );
  const unassigned = approvedRows.filter(
    (row) =>
      row.userId !== "total" &&
      (Number(row.finalNormal ?? 0) > 0 || Number(row.finalOt ?? 0) > 0) &&
      !assignedIds.has(row.userId)
  );
  return (
    <section className="cmp-archive-document-section border-t py-7 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">{archiveCopy.approvedTmsCoverage}</h2>
          <p className="mt-1 text-muted-foreground">
            {archiveCopy.tmsCoverageDescription}
          </p>
        </div>
        <span
          className={
            unassigned.length ? "text-destructive" : "text-emerald-700"
          }
        >
          {unassigned.length
            ? archiveCopy.coverageUnassigned.replace(
                "{count}",
                String(unassigned.length)
              )
            : archiveCopy.coverageComplete}
        </span>
      </div>
      {unassigned.length ? (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {unassigned.map((row) => (
            <li
              className="border-l-2 border-muted bg-muted/30 px-3 py-2"
              key={row.userId}
            >
              <span className="font-medium">
                {row.name || archiveCopy.notSet}
              </span>
              <span className="ml-2 text-muted-foreground">
                {Number(row.finalNormal ?? 0).toFixed(2)}{" "}
                {archiveCopy.normalHours} ·{" "}
                {Number(row.finalOt ?? 0).toFixed(2)}{" "}
                {archiveCopy.overtimeHours}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function archiveFeePlanningFormLines(
  lines: CmpEngagementArchivePayload["feePlanningLines"]
): CmpFeePlanningFormLine[] {
  return (lines ?? []).map((line) => ({
    key: line.key,
    grade: line.grade,
    assignmentType: line.assignmentType,
    staffUserId: line.staffUserId ?? "",
    hourlyRate: line.hourlyRate,
    budgetHours: line.budgetHours,
    dateFrom: line.dateFrom ?? "",
    dateTo: line.dateTo ?? "",
  }));
}

export function archiveFeePlanningPayloadLines(
  lines: CmpFeePlanningFormLine[]
): NonNullable<CmpEngagementArchivePayload["feePlanningLines"]> {
  return lines
    .filter((line) => line.grade)
    .map((line, sortOrder) => ({
      key: line.key,
      grade: line.grade as CmpEngagementFeePlanGrade,
      assignmentType: line.assignmentType as "STAFF" | "TBC",
      staffUserId: line.staffUserId || null,
      hourlyRate: line.hourlyRate,
      budgetHours: line.budgetHours,
      dateFrom: line.dateFrom,
      dateTo: line.dateTo,
      sortOrder,
    }));
}

function formatArchiveCurrency(value: string | number, currency: string) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) {
    return "—";
  }
  return `${currency} ${amount.toLocaleString("en-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatArchiveHours(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(2) : "0.00"} h`;
}

type ArchiveCopy = ReturnType<
  typeof useCmpI18n
>["dictionary"]["workspace"]["archive"];

function formatReadinessText(
  item: Pick<CmpEngagementArchiveReadinessCheck, "code" | "params">,
  archiveCopy: ArchiveCopy
) {
  const template = archiveCopy.readiness[item.code];
  return template.replaceAll("{count}", item.params.count ?? "0");
}

function workflowStatusLabel(
  status: "DRAFT" | "PENDING_PIC" | "RETURNED",
  archiveCopy: ArchiveCopy
) {
  if (status === "PENDING_PIC") {
    return archiveCopy.statusPendingPic;
  }
  if (status === "RETURNED") {
    return archiveCopy.statusReturned;
  }
  return archiveCopy.statusDraft;
}

function formatArchiveDateTime(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(locale === "zh-CN" ? "zh-CN" : "en-HK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type ArchiveErrorKind =
  | "sourceConflict"
  | "tmsConflict"
  | "pendingReview"
  | "blockers"
  | "generic";

function describeArchiveError(error: unknown): {
  kind: ArchiveErrorKind;
  blockerCodes?: string[];
  detail?: string;
} {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "CMP_ENGAGEMENT_ARCHIVE_SOURCE_CONFLICT": {
        return { kind: "sourceConflict" };
      }
      case "CMP_ENGAGEMENT_ARCHIVE_TMS_CONFLICT": {
        return { kind: "tmsConflict" };
      }
      case "CMP_ENGAGEMENT_ARCHIVE_PENDING_REVIEW": {
        return { kind: "pendingReview" };
      }
      case "VALIDATION_FAILED": {
        const blockerCodes = error.message
          .split(",")
          .map((code) => code.trim())
          .filter((code) => code in readinessCodeSet);
        if (blockerCodes.length) {
          return { kind: "blockers", blockerCodes };
        }
        break;
      }
      default: {
        break;
      }
    }
    if (error.status >= 500) {
      return { kind: "generic", detail: error.message };
    }
  }
  return { kind: "generic" };
}

const readinessCodeSet: Record<string, true> = {
  ENGAGEMENT_NOT_ELIGIBLE: true,
  RESPONSIBLE_USERS_INVALID: true,
  REPORT_DATE_INVALID: true,
  UNRESOLVED_TBC: true,
  DUPLICATE_BUDGET_PERSON: true,
  UNASSIGNED_APPROVED_TMS_PERSON: true,
  UNAPPROVED_TMS_TIME: true,
  SOURCE_CHANGED: true,
  TMS_CHANGED: true,
  NO_DELIVERABLES: true,
  ACTUAL_HOURS_OVER_BUDGET: true,
  ACTUAL_COST_OVER_BUDGET: true,
  ACTUAL_COST_OVER_FEE: true,
  HISTORICAL_MEMBER: true,
  RECOVERY_RATE_EXCEPTION: true,
};

function archiveErrorTitle(
  info: ReturnType<typeof describeArchiveError>,
  archiveCopy: ArchiveCopy
) {
  switch (info.kind) {
    case "sourceConflict": {
      return archiveCopy.errorSourceConflict;
    }
    case "tmsConflict": {
      return archiveCopy.errorTmsConflict;
    }
    case "pendingReview": {
      return archiveCopy.errorPendingReview;
    }
    case "blockers": {
      return archiveCopy.errorBlockers;
    }
    default: {
      return archiveCopy.unavailable;
    }
  }
}

function sumHours(
  rows: ArchiveMemberCost[],
  field: "budgetNormal" | "budgetOt" | "actualNormal" | "actualOt" | "absent"
) {
  const total = rows.reduce((sum, row) => sum + Number(row[field] || 0), 0);
  return total.toFixed(2);
}

function sumMoney(
  rows: ArchiveMemberCost[],
  field: "budgetCost" | "actualCost"
) {
  return rows.reduce((sum, row) => sum + Number(row[field] || 0), 0);
}

function payloadFromEngagement(
  engagement: CmpEngagement
): CmpEngagementArchivePayload {
  return {
    clientId: engagement.clientId,
    engagementCode: engagement.engagementCode,
    serviceType: engagement.serviceType,
    otherServiceDescription: engagement.otherServiceDescription ?? "",
    deliverables: engagement.deliverables ?? [],
    yearEndDate: engagement.yearEndDate ?? "",
    reportDate: engagement.reportDate ?? "",
    approvalReferenceNumber: engagement.approvalReferenceNumber ?? "",
    budgetedHours: engagement.budgetedHours,
    agreedFee: engagement.agreedFee,
    recoveryRate: engagement.recoveryRate ?? "",
    feeCurrency: engagement.feeCurrency,
    feeExchangeRateSnapshotId: engagement.feeExchangeRateSnapshot?.id ?? "",
    feeExchangeRateHkdPerUnit: engagement.feeExchangeRateHkdPerUnit ?? "",
    feeExchangeRateSource: engagement.feeExchangeRateSource ?? "SYSTEM",
    amlRiskClassification: engagement.amlRiskClassification,
    engagementRiskClassification: engagement.engagementRiskClassification,
    picUserId: engagement.picUserId ?? "",
    micUserId: engagement.micUserId ?? "",
    ...(engagement.eqReviewerUserId
      ? { eqReviewerUserId: engagement.eqReviewerUserId }
      : {}),
    pic: engagement.pic ?? "",
    mic: engagement.mic ?? "",
    eqReviewer: engagement.eqReviewer ?? "",
    remarks: engagement.remarks ?? "",
    feePlanningLines: engagement.feePlanningLines.map((line) => ({
      key: line.id,
      grade: line.grade,
      assignmentType: line.assignmentType,
      staffUserId: line.staff?.id ?? null,
      hourlyRate: line.hourlyRate,
      budgetHours: line.budgetHours,
      dateFrom: line.dateFrom ?? "",
      dateTo: line.dateTo ?? "",
      sortOrder: line.sortOrder,
    })),
  };
}
