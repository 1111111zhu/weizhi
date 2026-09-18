"use client";

import { formatNumberWithoutDigitFour } from "@project-wing/shared";
import { SelectField } from "@project-wing/ui";
import { AlertCircle, CheckCircle2, FileText, FolderOpen } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { showErrorToast } from "@/lib/error-toast";
import { cn } from "@/lib/utils";

import { api, canUseConfirmationEmpDirectory } from "../../api/client";
import type {
  ConfirmationEmpDirectory,
  ConfirmationEmpImportClient,
  ConfirmationEmpImportJob,
  ConfirmationEmpImportMode,
  ConfirmationEmpImportPreview,
  ConfirmationEmpImportPreviewItem,
  WorkflowNode,
} from "../../api/client";
import type { Dictionary } from "../../i18n/dictionaries";
import {
  ConfirmationGroupedImportDataGrid,
  ConfirmationImportedFilesDataGrid,
} from "./confirmation-emp-import-grids";
import { MATRIX_REDUCED_REVEAL_DURATION_CLASS } from "./confirmation-overview-matrix";

type ResponseWarehouseCopy =
  Dictionary["confirmationCenter"]["intranet"]["responseWarehousePanel"];

export type ConfirmationResponseWarehouseProps = {
  copy: ResponseWarehouseCopy;
  client?: ConfirmationEmpImportClient;
  projectId?: string;
  projectName?: string;
  projectCode?: string;
  clientName?: string;
  confirmationId?: string;
  confirmationIds?: string[];
  onCompleted?: (job: ConfirmationEmpImportJob) => void;
  onBusyChange?: (busy: boolean) => void;
  onClose?: () => void;
  onViewProject?: () => void;
};

function flattenDirectories(
  nodes: WorkflowNode[],
  parents: string[] = []
): ConfirmationEmpDirectory[] {
  return nodes.flatMap((node) => {
    const path = [...parents, node.title].join(" / ");
    return [
      {
        id: node.id,
        code: node.code,
        title: node.title,
        path,
        level: node.level,
        canAcceptWorkflow: true,
      },
      ...flattenDirectories(node.children ?? [], [...parents, node.title]),
    ];
  });
}

function createIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `emp-import-${Date.now()}`;
}

function sourceProposal(item: ConfirmationEmpImportPreviewItem) {
  return (
    item.sourceProposal ?? {
      sourceConfirmationId: item.sourceConfirmationId ?? item.confirmationId,
      empCode: item.proposedCode,
      businessName: item.proposedName,
    }
  );
}

function formatFileSize(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatProgress(job: ConfirmationEmpImportJob) {
  if (!job.total) {
    return 100;
  }
  return Math.round((job.completed / job.total) * 100);
}

function groupedChildCode(folderCode: string, index: number) {
  const prefix = folderCode.trim();
  return prefix
    ? `${prefix}.${formatNumberWithoutDigitFour(index + 1, 2)}`
    : "";
}

export function ConfirmationResponseWarehouse({
  copy,
  client = api,
  projectId = "",
  projectName,
  projectCode,
  clientName,
  confirmationId,
  confirmationIds,
  onCompleted,
  onBusyChange,
  onClose,
  onViewProject,
}: ConfirmationResponseWarehouseProps) {
  const initialView = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.history.state?.confirmationArchiveView?.projectId === projectId
        ? window.history.state.confirmationArchiveView
        : null,
    [projectId]
  );
  const restoredView = useRef(initialView);
  const [requestedReimport, setRequestedReimport] = useState<string | null>(
    initialView?.requestedReimport ?? null
  );
  const [directories, setDirectories] = useState<ConfirmationEmpDirectory[]>(
    []
  );
  const [targetDirectoryId, setTargetDirectoryId] = useState<string>(
    initialView?.targetDirectoryId ?? ""
  );
  const [mode, setMode] = useState<ConfirmationEmpImportMode>(
    initialView?.mode ?? "FLAT"
  );
  const [containerCode, setContainerCode] = useState("");
  const [containerName, setContainerName] = useState("");
  const [preview, setPreview] = useState<ConfirmationEmpImportPreview | null>(
    null
  );
  const [editedItems, setEditedItems] = useState<
    Record<string, { code: string; name: string }>
  >({});
  const [job, setJob] = useState<ConfirmationEmpImportJob | null>(null);
  const [isLoadingDirectories, setIsLoadingDirectories] = useState(true);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const scrollRegionRef = useRef<HTMLDivElement>(null);
  const pendingScrollTopRef = useRef<number | null>(
    initialView?.scrollTop ?? null
  );
  const [minimumContentHeight, setMinimumContentHeight] = useState(0);
  useLayoutEffect(() => {
    if (scrollRegionRef.current && pendingScrollTopRef.current !== null) {
      scrollRegionRef.current.scrollTop = pendingScrollTopRef.current;
      if (!isPreviewing && preview?.mode === mode) {
        pendingScrollTopRef.current = null;
      }
    }
  }, [mode, isPreviewing, preview]);
  const [withdrawItems, setWithdrawItems] = useState<
    ConfirmationEmpImportPreviewItem[] | null
  >(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [importSelection, setImportSelection] = useState<string>(
    initialView?.importSelection ?? "all"
  );
  const [completionOpen, setCompletionOpen] = useState(false);
  const completedJobIdRef = useRef<string | null>(null);
  const jobIsActive = Boolean(
    job && ["QUEUED", "RUNNING"].includes(job.status)
  );
  const isBusy = isImporting || jobIsActive || isWithdrawing;
  const selectedConfirmationIds = useMemo(
    () =>
      [
        ...(confirmationIds ?? []),
        ...(confirmationId ? [confirmationId] : []),
      ].filter((id, index, values) => values.indexOf(id) === index),
    [confirmationId, confirmationIds]
  );

  useEffect(() => {
    onBusyChange?.(isBusy);
    return () => onBusyChange?.(false);
  }, [isBusy, onBusyChange]);

  const modeDirectories = useMemo(
    () =>
      directories.filter((directory) =>
        canUseConfirmationEmpDirectory(mode, directory)
      ),
    [directories, mode]
  );
  const selectedDirectory = useMemo(
    () =>
      modeDirectories.find((directory) => directory.id === targetDirectoryId) ??
      null,
    [modeDirectories, targetDirectoryId]
  );
  const eligibleItems = useMemo(
    () =>
      preview?.items.filter(
        (item) =>
          item.status === "ELIGIBLE" &&
          (!item.reimportTargetDirectoryId || requestedReimport === item.id)
      ) ?? [],
    [preview, requestedReimport]
  );
  const deletedItems =
    preview?.items.filter(
      (item) =>
        item.status === "ELIGIBLE" &&
        item.reimportTargetDirectoryId &&
        item.id !== requestedReimport
    ) ?? [];
  function viewProject() {
    window.history.replaceState(
      {
        ...window.history.state,
        confirmationArchiveView: {
          projectId,
          confirmationIds: selectedConfirmationIds,
          mode,
          targetDirectoryId,
          importSelection,
          requestedReimport,
          scrollTop: scrollRegionRef.current?.scrollTop ?? 0,
          editedItems,
          containerCode,
          containerName,
        },
      },
      ""
    );
    onViewProject?.();
  }
  const importedItems = useMemo(
    () => preview?.items.filter((item) => item.status === "IMPORTED") ?? [],
    [preview]
  );
  const blockedItems = useMemo(
    () => preview?.items.filter((item) => item.status === "BLOCKED") ?? [],
    [preview]
  );
  const allImported = Boolean(
    preview &&
    eligibleItems.length === 0 &&
    (importedItems.length > 0 || deletedItems.length > 0) &&
    blockedItems.length === 0
  );
  const itemCodeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of eligibleItems) {
      const code = (editedItems[item.id]?.code ?? item.proposedCode)
        .trim()
        .toLocaleLowerCase();
      if (code) {
        counts.set(code, (counts.get(code) ?? 0) + 1);
      }
    }
    return counts;
  }, [editedItems, eligibleItems]);
  const invalidItemIds = useMemo(
    () =>
      new Set(
        eligibleItems
          .filter((item) => {
            const edited = editedItems[item.id] ?? {
              code: item.proposedCode,
              name: item.proposedName,
            };
            return !edited.code.trim() || !edited.name.trim();
          })
          .map((item) => item.id)
      ),
    [editedItems, eligibleItems]
  );
  const canImport = Boolean(
    preview &&
    eligibleItems.length > 0 &&
    selectedDirectory &&
    !job &&
    !isImporting &&
    !isWithdrawing &&
    invalidItemIds.size === 0 &&
    (mode === "FLAT" || (containerCode.trim() && containerName.trim()))
  );

  useEffect(() => {
    if (!projectId) {
      setDirectories([]);
      setTargetDirectoryId("");
      setIsLoadingDirectories(false);
      return;
    }
    let cancelled = false;
    setIsLoadingDirectories(true);
    client
      .workflow(projectId)
      .then((workflow) => {
        if (cancelled) {
          return;
        }
        const nextDirectories = flattenDirectories(workflow);
        setDirectories(nextDirectories);
        setTargetDirectoryId((current) =>
          nextDirectories.some((directory) => directory.id === current)
            ? current
            : (nextDirectories[0]?.id ?? "")
        );
      })
      .catch((error) => {
        if (!cancelled) {
          showErrorToast(error, copy.previewError);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingDirectories(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client, copy.previewError, projectId]);

  useEffect(() => {
    if (
      targetDirectoryId &&
      modeDirectories.some((directory) => directory.id === targetDirectoryId)
    ) {
      return;
    }
    setTargetDirectoryId(modeDirectories[0]?.id ?? "");
  }, [modeDirectories, targetDirectoryId]);

  // A completed import/withdrawal invalidates the preview even when its selection is unchanged.
  const previewScope = useMemo(
    () => ({
      projectId,
      targetDirectoryId,
      mode,
      selectedConfirmationIds,
      revision: previewRevision,
    }),
    [
      projectId,
      targetDirectoryId,
      mode,
      selectedConfirmationIds,
      previewRevision,
    ]
  );
  useEffect(() => {
    if (
      !previewScope.projectId ||
      !previewScope.targetDirectoryId ||
      previewScope.selectedConfirmationIds.length === 0
    ) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setIsPreviewing(true);
    setPreview(null);
    const confirmationSelection =
      previewScope.selectedConfirmationIds.length === 1
        ? { confirmationId: previewScope.selectedConfirmationIds[0] }
        : { confirmationIds: previewScope.selectedConfirmationIds };
    client
      .confirmationEmpPreview(previewScope.projectId, {
        mode: previewScope.mode,
        targetDirectoryId: previewScope.targetDirectoryId,
        ...confirmationSelection,
      })
      .then((nextPreview) => {
        if (cancelled) {
          return;
        }
        setPreview(nextPreview);
        const nextContainerCode =
          nextPreview.batchDirectory?.code ??
          nextPreview.zipWorkingPaper?.code ??
          "";
        setContainerCode(nextContainerCode);
        setContainerName(
          nextPreview.batchDirectory?.name ??
            nextPreview.zipWorkingPaper?.name ??
            ""
        );
        setEditedItems(
          Object.fromEntries(
            nextPreview.items
              .filter((item) => item.status === "ELIGIBLE")
              .map((item, index) => [
                item.id,
                {
                  code:
                    nextPreview.mode === "FLAT"
                      ? item.proposedCode
                      : groupedChildCode(nextContainerCode, index),
                  name: item.proposedName,
                },
              ])
          )
        );
        if (restoredView.current) {
          setEditedItems(restoredView.current.editedItems ?? {});
          setContainerCode(
            restoredView.current.containerCode ?? nextContainerCode
          );
          setContainerName(restoredView.current.containerName ?? "");
          restoredView.current = null;
        }
      })
      .catch((error) => {
        if (!cancelled) {
          showErrorToast(error, copy.previewError);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsPreviewing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client, copy.previewError, previewScope]);

  useEffect(() => {
    if (
      !projectId ||
      !targetDirectoryId ||
      !selectedConfirmationIds.length ||
      isBusy
    ) {
      return;
    }
    let cancelled = false;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing || document.visibilityState === "hidden") {
        return;
      }
      refreshing = true;
      try {
        const next = await client.confirmationEmpPreview(projectId, {
          mode,
          targetDirectoryId,
          ...(selectedConfirmationIds.length === 1
            ? { confirmationId: selectedConfirmationIds[0] }
            : { confirmationIds: selectedConfirmationIds }),
        });
        if (!cancelled) {
          setPreview(next);
        }
      } catch {
        if (!cancelled) {
          setPreview((current) =>
            current
              ? {
                  ...current,
                  items: current.items.map((item) =>
                    item.status === "IMPORTED"
                      ? { ...item, targetState: "UNVERIFIED" }
                      : item
                  ),
                }
              : current
          );
        }
      } finally {
        refreshing = false;
      }
    };
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [
    client,
    projectId,
    targetDirectoryId,
    selectedConfirmationIds,
    mode,
    isBusy,
  ]);

  useEffect(() => {
    if (!job || !projectId) {
      return;
    }
    if (["COMPLETED", "PARTIAL_FAILURE"].includes(job.status)) {
      if (completedJobIdRef.current !== job.id) {
        completedJobIdRef.current = job.id;
        if (job.status === "COMPLETED") {
          setCompletionOpen(true);
        }
        onCompleted?.(job);
      }
      return;
    }
    if (!["QUEUED", "RUNNING"].includes(job.status)) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      client
        .confirmationEmpImportJob(projectId, job.id)
        .then((nextJob) => {
          if (!cancelled) {
            setJob(nextJob);
          }
        })
        .catch(() => {
          if (!cancelled) {
            showErrorToast(new Error(copy.importError), copy.importError);
          }
        });
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [client, copy.importError, job, onCompleted, projectId]);

  async function handleWithdraw() {
    if (!withdrawItems?.length) {
      return;
    }
    setIsWithdrawing(true);
    let lastResult: ConfirmationEmpImportJob | undefined;
    let failed = 0;
    for (const item of withdrawItems) {
      if (!item.existingJobId || !item.existingItemId || !item.existingMode) {
        failed += 1;
        continue;
      }
      try {
        lastResult = await client.withdrawConfirmationEmpImport(
          projectId,
          item.existingJobId,
          {
            mode: item.existingMode,
            scope: "ITEM",
            itemId: item.existingItemId,
          }
        );
      } catch {
        failed += 1;
      }
    }
    setWithdrawItems(null);
    if (lastResult) {
      setJob(null);
      setCompletionOpen(false);
      onCompleted?.(lastResult);
    }
    setPreviewRevision((value) => value + 1);
    setIsWithdrawing(false);
    if (failed) {
      showErrorToast(
        new Error(copy.withdrawPartial.replace("{count}", String(failed))),
        copy.withdrawError
      );
    }
  }

  const selectedReimportDirectory = preview?.items.find(
    (item) =>
      item.reimportTargetDirectoryId &&
      (importSelection === "all" || importSelection === item.id)
  )?.reimportTargetDirectoryId;
  useEffect(() => {
    if (
      selectedReimportDirectory &&
      selectedReimportDirectory !== targetDirectoryId
    ) {
      setTargetDirectoryId(selectedReimportDirectory);
    }
  }, [selectedReimportDirectory, targetDirectoryId]);

  function updateItem(
    item: ConfirmationEmpImportPreviewItem,
    field: "code" | "name",
    value: string
  ) {
    setEditedItems((current) => ({
      ...current,
      [item.id]: {
        code: current[item.id]?.code ?? item.proposedCode,
        name: current[item.id]?.name ?? item.proposedName,
        [field]: value,
      },
    }));
  }

  function updateContainerCode(value: string) {
    const previousCode = containerCode;
    setContainerCode(value);
    if (mode === "FLAT") {
      return;
    }
    setEditedItems((current) =>
      Object.fromEntries(
        eligibleItems.map((item, index) => {
          const currentItem = current[item.id] ?? {
            code: item.proposedCode,
            name: item.proposedName,
          };
          const previousGeneratedCode = groupedChildCode(previousCode, index);
          return [
            item.id,
            {
              ...currentItem,
              code:
                !currentItem.code || currentItem.code === previousGeneratedCode
                  ? groupedChildCode(value, index)
                  : currentItem.code,
            },
          ];
        })
      )
    );
  }

  async function handleImport() {
    if (!preview || !projectId || !targetDirectoryId || !canImport) {
      return;
    }
    const chosenItems = eligibleItems.filter(
      (item) => importSelection === "all" || item.id === importSelection
    );
    if (!chosenItems.length) {
      return;
    }
    setIsImporting(true);
    try {
      const selectedPreview = await client.confirmationEmpPreview(projectId, {
        mode,
        targetDirectoryId,
        activeLinkKeys: chosenItems.map((item) => item.id),
      });
      const nextJob = await client.createConfirmationEmpImport(projectId, {
        mode,
        targetDirectoryId,
        previewFingerprint: selectedPreview.fingerprint,
        ...(mode === "GROUPED"
          ? {
              batchDirectory: {
                code: containerCode.trim(),
                name: containerName.trim(),
              },
            }
          : mode === "ZIP"
            ? {
                zipWorkingPaper: {
                  code: containerCode.trim(),
                  name: containerName.trim(),
                },
              }
            : {}),
        items: chosenItems.map((item) => {
          const proposal = sourceProposal(item);
          return {
            id: item.id,
            sourceConfirmationId:
              proposal.sourceConfirmationId ?? item.confirmationId,
            empCode: editedItems[item.id]?.code ?? proposal.empCode,
            businessName: editedItems[item.id]?.name ?? proposal.businessName,
          };
        }),
        idempotencyKey: createIdempotencyKey(),
      });
      setJob(nextJob);
    } catch (error) {
      showErrorToast(error, copy.importError);
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <section
      aria-label={copy.title}
      className="flex min-h-0 flex-col bg-background"
    >
      <div
        ref={scrollRegionRef}
        data-testid="confirmation-emp-import-scroll-region"
        className="h-full min-h-0 flex-1 overflow-y-auto [overflow-anchor:none]"
      >
        <div
          className="space-y-5 px-6 py-5"
          style={{ minHeight: minimumContentHeight }}
        >
          <div className="flex items-center gap-3 rounded-xl bg-muted/55 px-4 py-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FolderOpen className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium">
                {projectCode || projectId || copy.noProjects}
              </div>
              {projectName ? (
                <div className="truncate text-sm text-muted-foreground">
                  {projectName}
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{copy.targetClient}</Label>
            <div className="flex h-10 items-center rounded-md border bg-background px-3 text-sm">
              {clientName || copy.unlinkedClient}
            </div>
          </div>

          {allImported ? null : (
            <>
              <div className="space-y-2">
                <Label>{copy.mode}</Label>
                <Tabs
                  value={mode}
                  label={copy.mode}
                  onValueChange={(value) => {
                    if (job) {
                      return;
                    }
                    const scrollRegion = scrollRegionRef.current;
                    if (scrollRegion) {
                      pendingScrollTopRef.current = scrollRegion.scrollTop;
                      setMinimumContentHeight(
                        scrollRegion.scrollTop + scrollRegion.clientHeight
                      );
                    }
                    setJob(null);
                    completedJobIdRef.current = null;
                    setMode(value as ConfirmationEmpImportMode);
                  }}
                >
                  <TabsList
                    aria-label={copy.mode}
                    data-testid="confirmation-emp-import-mode-toggle"
                    className="relative grid h-10 w-full grid-cols-3 overflow-hidden rounded-full border border-border bg-muted/50 p-0.5"
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0.5 grid grid-cols-3 rounded-full"
                    >
                      <span
                        data-testid="confirmation-emp-import-mode-active-indicator"
                        aria-hidden="true"
                        className={cn(
                          `block w-full rounded-full bg-primary shadow-sm transition-[translate] duration-[var(--motion-fast)] ease-[var(--motion-ease)] will-change-[translate] ${MATRIX_REDUCED_REVEAL_DURATION_CLASS}`,
                          mode === "GROUPED"
                            ? "translate-x-full"
                            : mode === "ZIP"
                              ? "translate-x-[200%]"
                              : "translate-x-0"
                        )}
                      />
                    </span>
                    <TabsTrigger
                      value="FLAT"
                      disabled={Boolean(job)}
                      className="z-10 flex-1 justify-center text-center text-xs !shadow-none after:hidden focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-0 data-active:bg-transparent data-active:text-primary-foreground data-active:shadow-none"
                    >
                      {copy.flat}
                    </TabsTrigger>
                    <TabsTrigger
                      value="GROUPED"
                      disabled={Boolean(job)}
                      className="z-10 flex-1 justify-center text-center text-xs !shadow-none after:hidden focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-0 data-active:bg-transparent data-active:text-primary-foreground data-active:shadow-none"
                    >
                      {copy.grouped}
                    </TabsTrigger>
                    <TabsTrigger
                      value="ZIP"
                      disabled={Boolean(job)}
                      className="z-10 flex-1 justify-center text-center text-xs !shadow-none after:hidden focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-0 data-active:bg-transparent data-active:text-primary-foreground data-active:shadow-none"
                    >
                      {copy.zip}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmation-archive-directory">
                  {copy.directory}
                </Label>
                <Select
                  value={targetDirectoryId}
                  onValueChange={(value) => setTargetDirectoryId(value ?? "")}
                  disabled={
                    Boolean(job) ||
                    Boolean(selectedReimportDirectory) ||
                    isLoadingDirectories ||
                    modeDirectories.length === 0
                  }
                >
                  <SelectTrigger
                    id="confirmation-archive-directory"
                    aria-label={copy.directory}
                    className="w-full"
                  >
                    <SelectValue>
                      {selectedDirectory
                        ? `${selectedDirectory.path} · ${selectedDirectory.code}`
                        : copy.directoryPlaceholder}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent
                    align="start"
                    side="bottom"
                    alignItemWithTrigger={false}
                    collisionAvoidance={{
                      side: "none",
                      align: "shift",
                      fallbackAxisSide: "none",
                    }}
                  >
                    {modeDirectories.map((directory) => (
                      <SelectItem key={directory.id} value={directory.id}>
                        <span>{directory.path}</span>
                        <span className="text-muted-foreground">
                          {directory.code}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {mode === "GROUPED" || mode === "ZIP" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="confirmation-archive-container-code">
                      {mode === "ZIP" ? copy.zipCode : copy.batchCode}
                    </Label>
                    <Input
                      id="confirmation-archive-container-code"
                      value={containerCode}
                      disabled={Boolean(job)}
                      onChange={(event) =>
                        updateContainerCode(event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmation-archive-container-name">
                      {mode === "ZIP" ? copy.zipName : copy.batchName}
                    </Label>
                    <Input
                      id="confirmation-archive-container-name"
                      value={containerName}
                      disabled={Boolean(job)}
                      onChange={(event) => setContainerName(event.target.value)}
                    />
                  </div>
                </div>
              ) : null}
            </>
          )}

          <div className="space-y-3">
            {mode === "FLAT" ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <h2 className="shrink-0 font-semibold">
                    {copy.importFileList}
                  </h2>
                  {!isPreviewing && preview ? (
                    <span className="truncate text-sm text-muted-foreground">
                      {copy.pendingCount.replace(
                        "{count}",
                        String(eligibleItems.length)
                      )}
                      {importedItems.length > 0
                        ? ` · ${copy.importedCount.replace(
                            "{count}",
                            String(importedItems.length)
                          )}`
                        : ""}
                    </span>
                  ) : null}
                </div>
                {eligibleItems.length > 0 ? (
                  <Badge variant="secondary">{eligibleItems.length}</Badge>
                ) : null}
              </div>
            ) : null}

            {eligibleItems.length > 0 && !job ? (
              <label className="flex items-center gap-3 text-sm">
                {copy.importSelection}
                <SelectField
                  label={copy.importSelection}
                  labelVisibility="hidden"
                  value={importSelection}
                  onValueChange={setImportSelection}
                  options={[
                    { value: "all", label: copy.importAllPending },
                    ...eligibleItems.map((item) => ({
                      value: item.id,
                      label: `${copy.importSelection}: ${item.sourceFileName}`,
                    })),
                  ]}
                />
              </label>
            ) : null}
            {isPreviewing ? (
              <div
                aria-busy="true"
                aria-label={copy.loading}
                className="space-y-3 rounded-xl border bg-card p-6"
              >
                <div className="flex items-center justify-between border-b pb-4">
                  <Skeleton className="h-4 w-32 rounded-md" />
                  <Skeleton className="h-4 w-20 rounded-md" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full rounded-md" />
                  <Skeleton className="h-8 w-full rounded-md" />
                  <Skeleton className="h-8 w-full rounded-md" />
                </div>
              </div>
            ) : eligibleItems.length > 0 && mode !== "FLAT" ? (
              <div className="min-h-64">
                <ConfirmationGroupedImportDataGrid
                  copy={
                    mode === "ZIP"
                      ? { ...copy, folderContents: copy.importFileList }
                      : copy
                  }
                  disabled={Boolean(job)}
                  editedItems={editedItems}
                  invalidItemIds={invalidItemIds}
                  itemCodeCounts={itemCodeCounts}
                  items={eligibleItems}
                  onCodeChange={(item, value) =>
                    updateItem(item, "code", value)
                  }
                />
              </div>
            ) : eligibleItems.length > 0 ? (
              <div className="space-y-2">
                {eligibleItems.map((item) => {
                  const edited = editedItems[item.id] ?? {
                    code: item.proposedCode,
                    name: item.proposedName,
                  };
                  const normalizedCode = edited.code.trim().toLocaleLowerCase();
                  const invalid = invalidItemIds.has(item.id);
                  const willRename =
                    !invalid &&
                    normalizedCode.length > 0 &&
                    (itemCodeCounts.get(normalizedCode) ?? 0) > 1;
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border bg-card p-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <FileText className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {item.sourceFileName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.counterparty} ·{" "}
                            {formatFileSize(item.sourceFileSize)}
                          </div>
                        </div>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1.5 text-sm font-medium",
                            invalid
                              ? "text-destructive"
                              : willRename
                                ? "text-amber-600"
                                : "text-emerald-600"
                          )}
                        >
                          {invalid ? (
                            <AlertCircle className="size-4" />
                          ) : (
                            <CheckCircle2 className="size-4" />
                          )}
                          {invalid
                            ? copy.invalidIdentity
                            : willRename
                              ? copy.willAutoRename
                              : copy.ready}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-[11rem_minmax(0,1fr)]">
                        <Input
                          label={`${copy.code}: ${item.sourceFileName}`}
                          value={edited.code}
                          disabled={Boolean(job)}
                          onChange={(event) =>
                            updateItem(item, "code", event.target.value)
                          }
                        />
                        <Input
                          label={`${copy.name}: ${item.sourceFileName}`}
                          value={edited.name}
                          disabled={Boolean(job)}
                          onChange={(event) =>
                            updateItem(item, "name", event.target.value)
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          {deletedItems.length > 0 ? (
            <div className="space-y-2 rounded-lg border p-4">
              <div className="font-medium text-amber-600">
                {copy.targetRecycled} · {deletedItems.length}
              </div>
              {deletedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 py-2"
                >
                  <span className="min-w-0 break-all">
                    {item.sourceFileName}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => {
                      if (!item.reimportTargetDirectoryId) {
                        return;
                      }
                      setRequestedReimport(item.id);
                      setImportSelection(item.id);
                      setTargetDirectoryId(item.reimportTargetDirectoryId);
                    }}
                  >
                    {copy.reimportFile}
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
          {importedItems.length > 0 ? (
            <div className="min-h-56">
              <ConfirmationImportedFilesDataGrid
                key={previewRevision}
                copy={copy}
                items={importedItems}
                disabled={isWithdrawing}
                onWithdraw={setWithdrawItems}
              />
            </div>
          ) : null}

          {blockedItems.length > 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-1">
                {blockedItems
                  .flatMap((item) => item.blockingIssues)
                  .map((issue) => (
                    <p key={issue}>{issue}</p>
                  ))}
              </div>
            </div>
          ) : null}

          {job ? (
            <div
              className={cn(
                "space-y-2 rounded-xl border px-4 py-3",
                job.status === "COMPLETED" &&
                  "border-emerald-200 bg-emerald-50/60"
              )}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {job.status === "COMPLETED"
                    ? copy.statusCompleted
                    : copy.progress}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {job.completed}/{job.total}
                </span>
              </div>
              <Progress value={formatProgress(job)} label={copy.progress} />
            </div>
          ) : null}
        </div>
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t bg-muted/25 px-6 py-4">
        {allImported ? (
          <>
            <Button type="button" variant="outline" onClick={onClose}>
              {copy.close}
            </Button>
            <Button type="button" onClick={viewProject}>
              <FolderOpen />
              {copy.viewInProject}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            onClick={() => handleImport()}
            disabled={!canImport}
          >
            {isImporting ? (
              <Skeleton className="size-4 rounded-full" />
            ) : (
              <FolderOpen />
            )}
            {isImporting ? copy.importing : copy.importAction}
          </Button>
        )}
      </footer>
      <Dialog
        open={withdrawItems !== null}
        onOpenChange={(open) => {
          if (!open && !isWithdrawing) {
            setWithdrawItems(null);
          }
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{copy.withdrawAction}</DialogTitle>
            <DialogDescription>
              {copy.withdrawMessage.replace(
                "{name}",
                withdrawItems?.map((item) => item.sourceFileName).join("、") ??
                  ""
              )}
              {withdrawItems?.some((item) => item.existingMode === "ZIP")
                ? copy.withdrawZipMessage
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isWithdrawing}
              onClick={() => setWithdrawItems(null)}
            >
              {copy.close}
            </Button>
            <Button disabled={isWithdrawing} onClick={handleWithdraw}>
              {copy.withdrawAction}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={completionOpen} onOpenChange={setCompletionOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <CheckCircle2 className="size-8 text-emerald-600" />
            <DialogTitle>{copy.completionTitle}</DialogTitle>
            <DialogDescription>
              {copy.completionMessage.replace(
                "{count}",
                String(job?.completed ?? 0)
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompletionOpen(false)}>
              {copy.completionAcknowledge}
            </Button>
            {onViewProject ? (
              <Button
                onClick={() => {
                  setCompletionOpen(false);
                  viewProject();
                }}
              >
                {copy.viewInProject}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
