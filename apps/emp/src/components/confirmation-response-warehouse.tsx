"use client";
import { useCompactViewport } from "@project-wing/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { subMonths } from "date-fns";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { api } from "../api/client";
import type { ConfirmationResponseLibraryFile } from "../api/client";
import { confirmationResponseRoutingCopy } from "../i18n/confirmation-response-routing-copy";
import { showErrorToast } from "../lib/error-toast";
import { openAuthorizedPreviewWindow } from "../lib/open-preview-window";
import { ConfirmationResponseWarehouseGrid } from "./confirmation-response-warehouse-grid";
import { ConfirmationResponseRoutingSheet } from "./confirmations/confirmation-response-routing-sheet";
import { PreviewPanelActions } from "./extend/preview-panel-actions";
import { BlobFilePreviewPane } from "./file-preview-pane";
import { useToast } from "./toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { ResponseBatchClaimDialog, type ClaimDestination } from "./response-batch-claim-dialog";
import { ResponseBatchUploadDialog } from "./response-batch-upload-dialog";

export type ConfirmationResponseWarehouseCopy = {
  title: string;
  description: string;
  moreActions: string;
  rowsPerPage: string;
  rowsPerPageSuffix: string;
  searchPlaceholder: string;
  resultCount: string;
  upload: string;
  uploadTitle: string;
  uploadDescription: string;
  titleLabel: string;
  titlePlaceholder: string;
  receivedAtLabel: string;
  receivedAtPlaceholder: string;
  dateRangeLabel: string;
  dateFromLabel: string;
  dateToLabel: string;
  dateRangeLimit: string;
  clearDateRange: string;
  today: string;
  courierTrackingNumberLabel: string;
  courierTrackingNumberPlaceholder: string;
  referenceNumberLabel: string;
  referenceNumberPlaceholder: string;
  clientNameLabel: string;
  clientNamePlaceholder: string;
  respondingEntityLabel: string;
  respondingEntityPlaceholder: string;
  notesLabel: string;
  notesPlaceholder: string;
  fileLabel: string;
  chooseFile: string;
  noFile: string;
  uploadConfirm: string;
  uploadSuccess: string;
  uploadError: string;
  loadError: string;
  noFiles: string;
  noResults: string;
  download: string;
  preview: string;
  claim: string;
  claimedByOther: string;
  batchClaim: string;
  claimSelected: string;
  batchClaimTitle: string;
  batchClaimConfirm: string;
  batchClaimSuccess: string;
  batchClaimError: string;
  detailTitle: string;
  closePreview: string;
  expandPreview: string;
  exitExpandedPreview: string;
  openPreviewInNewWindow: string;
  loadingPreview: string;
  previewFailedTitle: string;
  retryPreview: string;
  unsupportedPreview: string;
  resizePreview: string;
  filterColumnPlaceholder: string;
  filterNoOptions: string;
  clearColumnFilter: string;
  importToProjectDirectory: string;
  importUnavailable: string;
  archiveSelected: string;
  selectAll: string;
  selectRow: string;
  selectedCount: string;
  returnToConfirmationCenter?: string;
  columns: {
    code: string;
    title: string;
    receivedAt: string;
    claimedBy: string;
    claimedAt: string;
    courierTrackingNumber: string;
    referenceNumber: string;
    clientName: string;
    respondingEntity: string;
    notes: string;
    file: string;
    actions: string;
  };
};

const WAREHOUSE_COLUMN_KEYS = [
  "code",
  "title",
  "receivedAt",
  "claimedBy",
  "claimedAt",
  "courierTrackingNumber",
  "referenceNumber",
  "clientName",
  "respondingEntity",
  "notes",
  "file",
  "actions",
] as const;

type WarehouseColumnKey = (typeof WAREHOUSE_COLUMN_KEYS)[number];
type WarehouseColumnFilterKey = Exclude<WarehouseColumnKey, "actions">;

export function ConfirmationResponseWarehouse({
  allowNoSourceRequest = false,
  cancelLabel,
  copy,
  currentUserId,
  currentUserGlobalRole,
  locale,
  onRouted,
  projectId,
  projectName,
  projectCode,
  unmatchedOnly = false,
  onImportToEmp,
}: {
  allowNoSourceRequest?: boolean;
  cancelLabel: string;
  copy: ConfirmationResponseWarehouseCopy;
  currentUserId?: string;
  currentUserGlobalRole?: string;
  locale: string;
  onRouted?: (
    response: ConfirmationResponseLibraryFile,
    action: "MATCH_CONFIRMATION" | "PENDING_MATCH" | "NO_SOURCE_REQUEST"
  ) => void | Promise<void>;
  projectId?: string;
  projectName?: string;
  projectCode?: string;
  unmatchedOnly?: boolean;
  onImportToEmp?: (confirmationIds: string[]) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const routingCopy =
    confirmationResponseRoutingCopy[
      locale.startsWith("zh") ? "zh-CN" : "en-US"
    ];
  const returnToConfirmationCenterLabel =
    copy.returnToConfirmationCenter ?? routingCopy.returnToConfirmationCenter;
  const [query, setQuery] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const compact = useCompactViewport();
  const [previewingFile, setPreviewingFile] =
    useState<ConfirmationResponseLibraryFile | null>(null);
  const [detailFile, setDetailFile] =
    useState<ConfirmationResponseLibraryFile | null>(null);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [routingFile, setRoutingFile] =
    useState<ConfirmationResponseLibraryFile | null>(null);
  const [returnConfirmationFile, setReturnConfirmationFile] =
    useState<ConfirmationResponseLibraryFile | null>(null);
  const [columnFilters, setColumnFilters] = useState<
    Partial<Record<WarehouseColumnFilterKey, string[]>>
  >({});
  const [archiveSelectionMode, setArchiveSelectionMode] = useState(false);
  const [batchClaimSelectionMode, setBatchClaimSelectionMode] = useState(false);
  const [batchClaimOpen, setBatchClaimOpen] = useState(false);
  const [claimDestinations, setClaimDestinations] = useState<ClaimDestination[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const canUploadGlobalResponses =
    currentUserGlobalRole === "CONFIRMATION_OFFICER" ||
    currentUserGlobalRole === "SUPER_ADMIN";
  const isBatchReturnContext = Boolean(projectId && unmatchedOnly);
  const isBatchClaimContext = !projectId && !canUploadGlobalResponses;
  const receivedDateBounds = useMemo(() => {
    const maximum = startOfLocalDay(new Date());
    return {
      maximum,
      minimum: subMonths(maximum, 6),
      defaultFrom: subMonths(maximum, 1),
    };
  }, []);
  const [receivedFrom, setReceivedFrom] = useState(() =>
    formatIsoDate(receivedDateBounds.defaultFrom)
  );
  const [receivedTo, setReceivedTo] = useState(() =>
    formatIsoDate(receivedDateBounds.maximum)
  );
  const dateRangeTooWide =
    !projectId &&
    isReceivedDateRangeInvalid(
      receivedFrom,
      receivedTo,
      receivedDateBounds.minimum,
      receivedDateBounds.maximum
    );
  const files = useQuery({
    queryKey: projectId
      ? ["project-confirmation-response-warehouse", projectId]
      : ["confirmation-response-library"],
    queryFn: () =>
      projectId
        ? api.projectConfirmationResponseWarehouse(projectId)
        : api.confirmationResponseLibrary(),
  });
  const visibleFiles = useMemo(
    () =>
      (files.data ?? []).filter(
        (item) => !unmatchedOnly || item.routingStatus !== "MATCHED"
      ),
    [files.data, unmatchedOnly]
  );
  const filterOptions = useMemo(() => {
    const sourceRows = visibleFiles;
    return Object.fromEntries(
      WAREHOUSE_COLUMN_KEYS.filter(
        (column): column is WarehouseColumnFilterKey => column !== "actions"
      ).map((column) => [
        column,
        uniqueWarehouseOptions(
          sourceRows.map((item) => {
            const value = warehouseColumnValue(item, column, locale);
            return { value, label: value };
          })
        ),
      ])
    ) as Record<WarehouseColumnFilterKey, { value: string; label: string }[]>;
  }, [locale, visibleFiles]);
  useEffect(() => {
    if (files.error) {
      showErrorToast(files.error, copy.loadError);
    }
  }, [copy.loadError, files.error]);
  useEffect(() => {
    if (
      previewingFile &&
      files.data &&
      !files.data.some((item) => item.id === previewingFile.id)
    ) {
      setPreviewingFile(null);
      setPreviewExpanded(false);
    }
  }, [files.data, previewingFile]);
  const rows = useMemo(() => {
    if (dateRangeTooWide) {
      return [];
    }
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    return [...visibleFiles]
      .filter((item) => {
        const receivedDate = item.receivedAt.slice(0, 10);
        if (!projectId && receivedFrom && receivedDate < receivedFrom) {
          return false;
        }
        if (!projectId && receivedTo && receivedDate > receivedTo) {
          return false;
        }
        const globalMatch =
          !normalizedQuery ||
          [
            item.code,
            item.title,
            item.fileName,
            item.courierTrackingNumber ?? "",
            item.referenceNumber ?? "",
            item.clientName,
            item.respondingEntity,
            item.notes ?? "",
          ].some((value) =>
            value.toLocaleLowerCase(locale).includes(normalizedQuery)
          );
        if (!globalMatch) {
          return false;
        }

        if (
          !projectId &&
          receivedFrom &&
          item.receivedAt.slice(0, 10) < receivedFrom
        ) {
          return false;
        }
        if (
          !projectId &&
          receivedTo &&
          item.receivedAt.slice(0, 10) > receivedTo
        ) {
          return false;
        }

        const values = warehouseColumnValues(item, locale);
        return (
          Object.entries(columnFilters) as [
            WarehouseColumnFilterKey,
            string[] | undefined,
          ][]
        ).every(
          ([column, selectedValues]) =>
            !selectedValues?.length || selectedValues.includes(values[column])
        );
      })
      .sort(compareResponsesByReceivedAt);
  }, [
    columnFilters,
    dateRangeTooWide,
    locale,
    projectId,
    query,
    receivedFrom,
    receivedTo,
    visibleFiles,
  ]);

  const dateRangeError = dateRangeTooWide ? copy.dateRangeLimit : "";
  const selectableRows = useMemo(
    () =>
      rows.filter(
        isBatchReturnContext ? canReturnToConfirmationCenter : isBatchClaimContext ? canBatchClaimResponse : canImportResponseToEmp
      ),
    [isBatchReturnContext, isBatchClaimContext, rows]
  );
  const selectableIds = useMemo(
    () => new Set(selectableRows.map((item) => item.id)),
    [selectableRows]
  );
  const selectedRows = useMemo(
    () => selectableRows.filter((item) => selectedIds.has(item.id)),
    [selectableRows, selectedIds]
  );
  const visibleSelectedIds = useMemo(
    () =>
      new Set(
        [...selectedIds].filter((responseId) => selectableIds.has(responseId))
      ),
    [selectableIds, selectedIds]
  );
  const allSelectableRowsSelected = Boolean(
    selectableRows.length > 0 &&
    selectableRows.every((item) => selectedIds.has(item.id))
  );
  const exitArchiveSelectionMode = () => {
    setArchiveSelectionMode(false);
    setBatchClaimSelectionMode(false);
    setSelectedIds(new Set());
  };
  const toggleArchiveSelectionMode = () => {
    if (!archiveSelectionMode) {
      setArchiveSelectionMode(true);
      setSelectedIds(new Set());
      return;
    }
    if (selectedRows.length === 0) {
      return;
    }
    const confirmationIds = [
      ...new Set(
        selectedRows.flatMap((item) =>
          item.confirmationId ? [item.confirmationId] : []
        )
      ),
    ];
    if (confirmationIds.length === 0) {
      return;
    }
    onImportToEmp?.(confirmationIds);
    exitArchiveSelectionMode();
  };
  const toggleBatchClaimSelectionMode = () => {
    if (!batchClaimSelectionMode) {
      setArchiveSelectionMode(false);
      setBatchClaimSelectionMode(true);
      setSelectedIds(new Set());
      return;
    }
    if (selectedRows.length > 0) {
      setBatchClaimOpen(true);
    }
  };
  const toggleSelectAll = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allSelectableRowsSelected) {
        selectableRows.forEach((item) => next.delete(item.id));
      } else {
        selectableRows.forEach((item) => next.add(item.id));
      }
      return next;
    });
  };
  const returnToCenter = useMutation({
    mutationFn: (item: ConfirmationResponseLibraryFile) =>
      api.routeConfirmationResponseLibraryFile(item.id, {
        action: "UNASSIGN_PROJECT",
      }),
    onSuccess: async (updated, item) => {
      queryClient.setQueryData<ConfirmationResponseLibraryFile[]>(
        ["confirmation-response-library"],
        (current) => mergeWarehouseResponse(current, updated)
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["project-confirmations", item.projectId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["project-confirmation-response-warehouse", item.projectId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["project-pending-confirmation-responses", item.projectId],
        }),
      ]);
      setReturnConfirmationFile(null);
      toast({ title: routingCopy.updateSuccess });
    },
    onError: () =>
      toast({
        title: routingCopy.updateError,
        variant: "destructive",
      }),
  });
  const batchReturn = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(selectedRows.map((item) =>
        api.routeConfirmationResponseLibraryFile(item.id, { action: "UNASSIGN_PROJECT" })
      ));
      return results.map((result, index) => ({result, item: selectedRows[index]}));
    },
    onSuccess: async (results) => {
      const failed = results.filter(({result}) => result.status === "rejected");
      for (const {result} of results) {
        if (result.status === "fulfilled") {
          queryClient.setQueryData<ConfirmationResponseLibraryFile[]>(
            ["confirmation-response-library"], (current) => mergeWarehouseResponse(current, result.value)
          );
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({queryKey:["project-confirmations", projectId]}),
        queryClient.invalidateQueries({queryKey:["project-confirmation-response-warehouse", projectId]}),
        queryClient.invalidateQueries({queryKey:["project-pending-confirmation-responses", projectId]}),
      ]);
      setSelectedIds(new Set(failed.map(({item}) => item.id)));
      if (!failed.length) exitArchiveSelectionMode();
      toast({
        title: locale.startsWith("zh")
          ? `已退回 ${results.length - failed.length} 份回函${failed.length ? `，${failed.length} 份失败，请重试` : ""}`
          : `Returned ${results.length - failed.length} responses${failed.length ? `; ${failed.length} failed. Please retry.` : ""}`,
        variant: failed.length ? "destructive" : "success",
      });
    },
  });
  const toggleBatchReturn = () => {
    if (batchReturn.isPending) return;
    if (!archiveSelectionMode) {
      setArchiveSelectionMode(true);
      setSelectedIds(new Set());
    } else if (selectedRows.length) batchReturn.mutate();
  };

  const requestReturnToConfirmationCenter = (
    item: ConfirmationResponseLibraryFile
  ) => {
    if (item.routingStatus === "MATCHED") {
      setReturnConfirmationFile(item);
      return;
    }
    returnToCenter.mutate(item);
  };

  return (
    <ResizablePanelGroup
      orientation={compact ? "vertical" : "horizontal"}
      className="h-full min-h-0 overflow-hidden rounded-xl"
    >
      <ResizablePanel
        minSize={compact ? (previewingFile ? "30%" : 0) : "32rem"}
        className="h-full min-w-0 overflow-hidden"
      >
        <div className="h-full min-h-0 min-w-0">
          <ConfirmationResponseWarehouseGrid
            allSelectableRowsSelected={allSelectableRowsSelected}
            archiveSelectionMode={
              archiveSelectionMode || batchClaimSelectionMode
            }
            cancelLabel={cancelLabel}
            columnFilters={columnFilters}
            contextLabel={
              projectId
                ? [projectName || undefined, projectCode || undefined]
                    .filter(Boolean)
                    .join(" · ")
                : undefined
            }
            copy={isBatchReturnContext ? {...copy, selectAll: locale.startsWith("zh") ? "全选可退回回函" : "Select all returnable responses"} : copy}
            claimLabel={copy.claim}
            claimedByOtherLabel={copy.claimedByOther}
            compactDetails={!projectId || unmatchedOnly}
            currentUserId={currentUserId}
            dateRangeError={dateRangeError}
            dateFrom={receivedFrom}
            dateTo={receivedTo}
            maximumReceivedDate={receivedDateBounds.maximum}
            minimumReceivedDate={receivedDateBounds.minimum}
            filterOptions={filterOptions}
            isError={files.isError}
            isLoading={files.isLoading}
            onRetry={() => {
              void files.refetch();
            }}
            isRowArchivable={
              isBatchReturnContext ? canReturnToConfirmationCenter : isBatchClaimContext
                ? canBatchClaimResponse
                : canImportResponseToEmp
            }
            locale={locale}
            onArchiveAction={
              isBatchReturnContext ? toggleBatchReturn : batchClaimSelectionMode || isBatchClaimContext
                ? toggleBatchClaimSelectionMode
                : projectId && onImportToEmp
                  ? toggleArchiveSelectionMode
                  : undefined
            }
            onCancelArchiveSelection={() => { if (!batchReturn.isPending) exitArchiveSelectionMode(); }}
            onColumnFilterChange={(column, values) =>
              setColumnFilters((current) => ({
                ...current,
                [column]: values,
              }))
            }
            onDownload={(item) =>
              window.open(
                api.confirmationResponseLibraryDownloadUrl(item.id),
                "_blank",
                "noopener,noreferrer"
              )
            }
            onOpenDetail={setDetailFile}
            onPreview={(item) => {
              setDetailFile(null);
              setPreviewingFile(item);
            }}
            onQueryChange={setQuery}
            onReceivedDateRangeChange={(from, to) => {
              setReceivedFrom(from);
              setReceivedTo(to);
            }}
            onRoute={setRoutingFile}
            onSelectAll={toggleSelectAll}
            onSelectRow={(item, checked) =>
              setSelectedIds((current) => {
                const next = new Set(current);
                if (checked) {
                  next.add(item.id);
                } else {
                  next.delete(item.id);
                }
                return next;
              })
            }
            onUpload={() => setUploadOpen(true)}
            onReturnToConfirmationCenter={requestReturnToConfirmationCenter}
            query={query}
            returnToConfirmationCenterLabel={returnToConfirmationCenterLabel}
            returnToCenterPending={returnToCenter.isPending || batchReturn.isPending}
            canReturnToConfirmationCenter={canReturnToConfirmationCenter}
            routeLabel={
              projectId
                ? routingCopy.continueMatching
                : routingCopy.assignToProject
            }
            routingStatusLabel={(item) => routingStatusLabel(item, locale)}
            rows={rows}
            selectedIds={visibleSelectedIds}
            selectedRowCount={selectedRows.length}
            selectionActionPending={batchReturn.isPending}
            selectionActionLabel={
              isBatchReturnContext ? (locale.startsWith("zh") ? "批量退回" : "Batch return") : batchClaimSelectionMode || isBatchClaimContext
                ? copy.batchClaim
                : copy.importToProjectDirectory
            }
            selectionSelectedLabel={
              isBatchReturnContext ? (locale.startsWith("zh") ? "退回所选回函" : "Return selected responses") : batchClaimSelectionMode
                ? copy.claimSelected
                : copy.archiveSelected
            }
            showDateRange={!projectId}
            showArchiveAction={
              isBatchReturnContext || isBatchClaimContext || Boolean(projectId && onImportToEmp)
            }
            showUploadAction={Boolean(projectId) || canUploadGlobalResponses}
            useFixedClaimActions={!projectId}
          />
        </div>
      </ResizablePanel>

      {previewingFile ? (
        <>
          <ResizableHandle
            label={copy.resizePreview}
            className="z-20 bg-border hover:bg-primary/30 focus-visible:bg-primary/30"
          />
          <ResizablePanel
            defaultSize={compact ? "50%" : "42rem"}
            minSize={compact ? "30%" : "28rem"}
            groupResizeBehavior="preserve-pixel-size"
            className={`h-full min-h-0 min-w-0 overflow-hidden border-y border-r border-border bg-workbench-sidebar ${
              previewExpanded ? "fixed inset-0 z-50 border-0" : ""
            }`}
          >
            <BlobFilePreviewPane
              key={previewingFile.id}
              ariaLabel={`${copy.preview}: ${previewingFile.title}`}
              fileName={previewingFile.fileName}
              mimeType={previewingFile.mimeType}
              queryKey={[
                "confirmation-response-library",
                "preview",
                previewingFile.id,
                previewingFile.updatedAt,
              ]}
              loadFile={() =>
                api.previewConfirmationResponseLibraryFile(previewingFile.id)
              }
              copy={{
                loading: copy.loadingPreview,
                failedTitle: copy.previewFailedTitle,
                retry: copy.retryPreview,
                unsupported: copy.unsupportedPreview,
              }}
              toolbarActions={
                <>
                  <PreviewPanelActions
                    expandLabel={copy.expandPreview}
                    exitExpandedLabel={copy.exitExpandedPreview}
                    isPreviewExpanded={previewExpanded}
                    onTogglePreviewExpanded={() =>
                      setPreviewExpanded((current) => !current)
                    }
                    openInNewWindowLabel={copy.openPreviewInNewWindow}
                    onOpenInNewWindow={() =>
                      openAuthorizedPreviewWindow({
                        fileName: previewingFile.fileName,
                        mimeType: previewingFile.mimeType,
                        loadBlob: () =>
                          api.previewConfirmationResponseLibraryFile(
                            previewingFile.id
                          ),
                      })
                    }
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={copy.closePreview}
                    onClick={() => {
                      setPreviewingFile(null);
                      setPreviewExpanded(false);
                    }}
                  >
                    <X />
                  </Button>
                </>
              }
            />
          </ResizablePanel>
        </>
      ) : null}

      <Sheet
        open={Boolean(detailFile)}
        onOpenChange={(open) => !open && setDetailFile(null)}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-xl"
        >
          <SheetHeader className="border-b">
            <SheetTitle>{copy.detailTitle}</SheetTitle>
            <SheetDescription>
              {detailFile ? `${detailFile.title} · ${detailFile.code}` : ""}
            </SheetDescription>
          </SheetHeader>
          {detailFile ? (
            <dl className="grid gap-4 px-4 py-4 text-sm">
              {[
                [
                  copy.columns.receivedAt,
                  formatDateOnly(detailFile.receivedAt, locale),
                ],
                [copy.columns.claimedBy, detailFile.routedBy?.name || "—"],
                [
                  copy.columns.claimedAt,
                  detailFile.routedAt
                    ? formatDateTime(detailFile.routedAt, locale)
                    : "—",
                ],
                [
                  copy.columns.courierTrackingNumber,
                  detailFile.courierTrackingNumber || "—",
                ],
                [
                  copy.columns.referenceNumber,
                  detailFile.referenceNumber || "—",
                ],
                [copy.columns.clientName, detailFile.clientName],
                [copy.columns.respondingEntity, detailFile.respondingEntity],
                [copy.columns.notes, detailFile.notes || "—"],
                [
                  copy.columns.file,
                  `${detailFile.fileName} · ${formatFileSize(detailFile.fileSize)} · ${detailFile.uploader.name}`,
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="grid gap-1 border-b border-border/60 pb-3"
                >
                  <dt className="font-medium text-muted-foreground">{label}</dt>
                  <dd className="break-words whitespace-pre-wrap">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={claimDestinations !== null} onOpenChange={(open) => { if (!open) setClaimDestinations(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{locale.startsWith("zh") ? "前往认领结果" : "Go to claimed responses"}</DialogTitle>
            <DialogDescription>{locale.startsWith("zh") ? "这些回函已归入不同位置，请选择要查看的记录。" : "These responses have different destinations. Choose one to view."}</DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
            {claimDestinations?.map((target) => <Button key={target.href} variant="outline" className="h-auto justify-start whitespace-normal text-left" onClick={() => window.location.assign(target.href)}>{target.label}</Button>)}
          </div>
        </DialogContent>
      </Dialog>
      {batchClaimOpen && <ResponseBatchClaimDialog
        responses={selectedRows} locale={locale} copy={copy}
        allowNoSourceRequest={allowNoSourceRequest}
        onClose={() => {setBatchClaimOpen(false); exitArchiveSelectionMode();}}
        onCompleted={(destinations, count) => {
          toast({
            title: locale.startsWith("zh") ? `成功认领 ${count} 份回函` : `Claimed ${count} responses`,
            variant: "success", duration: 5000, closeButton: true, dismissOnNavigation: true,
            actions: [{ label: locale.startsWith("zh") ? "前往" : "Go to", onClick: () => {
              if (destinations.length === 1) window.location.assign(destinations[0].href);
              else setClaimDestinations(destinations);
            } }],
          });
        }}
        onClaimed={async (updatedRows) => {
          queryClient.setQueryData<ConfirmationResponseLibraryFile[]>(["confirmation-response-library"], current => updatedRows.reduce((merged, updated) => mergeWarehouseResponse(merged, updated), current));
          await Promise.all([
            queryClient.invalidateQueries({queryKey:["confirmation-response-library"]}),
            queryClient.invalidateQueries({queryKey:["project-confirmations"]}),
            queryClient.invalidateQueries({queryKey:["project-confirmation-response-warehouse"]}),
            queryClient.invalidateQueries({queryKey:["project-pending-confirmation-responses"]}),
          ]);
        }}
      />}

      <ResponseBatchUploadDialog open={uploadOpen} onOpenChange={setUploadOpen}
        projectId={projectId} copy={copy} locale={locale} cancelLabel={cancelLabel}
        onUploaded={async () => {
          await Promise.all([
            queryClient.invalidateQueries({queryKey:["confirmation-response-library"]}),
            ...(projectId ? [
              queryClient.invalidateQueries({queryKey:["project-confirmation-response-warehouse", projectId]}),
              queryClient.invalidateQueries({queryKey:["project-pending-confirmation-responses", projectId]}),
            ] : []),
          ]);
        }} />
      <ConfirmationResponseRoutingSheet
        allowNoSourceRequest={allowNoSourceRequest}
        response={routingFile}
        open={Boolean(routingFile)}
        onOpenChange={(open) => {
          if (!open) {
            setRoutingFile(null);
          }
        }}
        locale={locale}
        initialProjectId={projectId}
        onRouted={onRouted}
      />
      <AlertDialog
        open={Boolean(returnConfirmationFile)}
        onOpenChange={(open) => {
          if (!open && !returnToCenter.isPending) {
            setReturnConfirmationFile(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {routingCopy.returnMatchedTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {routingCopy.returnMatchedDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={returnToCenter.isPending}
              onClick={() => {
                if (returnConfirmationFile) {
                  returnToCenter.mutate(returnConfirmationFile);
                }
              }}
            >
              {routingCopy.returnMatchedConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ResizablePanelGroup>
  );
}

function warehouseColumnValues(
  item: ConfirmationResponseLibraryFile,
  locale: string
): Record<WarehouseColumnFilterKey, string> {
  return {
    code: item.code,
    title: `${item.title} ${routingStatusLabel(item, locale)}`,
    receivedAt: formatDateOnly(item.receivedAt, locale),
    claimedBy: item.routedBy?.name || "—",
    claimedAt: item.routedAt ? formatDateTime(item.routedAt, locale) : "—",
    courierTrackingNumber: item.courierTrackingNumber || "—",
    referenceNumber: item.referenceNumber || "—",
    clientName: item.clientName,
    respondingEntity: item.respondingEntity,
    notes: item.notes || "—",
    file: `${item.fileName} ${item.uploader.name} ${formatFileSize(item.fileSize)}`,
  };
}

function warehouseColumnValue(
  item: ConfirmationResponseLibraryFile,
  column: WarehouseColumnFilterKey,
  locale: string
) {
  return warehouseColumnValues(item, locale)[column];
}

function uniqueWarehouseOptions(options: { value: string; label: string }[]) {
  return [...new Map(options.map((option) => [option.value, option])).values()];
}

function compareResponsesByReceivedAt(
  left: ConfirmationResponseLibraryFile,
  right: ConfirmationResponseLibraryFile
) {
  const receivedDifference =
    Date.parse(right.receivedAt) - Date.parse(left.receivedAt);
  return (
    receivedDifference ||
    Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
    left.id.localeCompare(right.id)
  );
}

function isReceivedDateRangeInvalid(
  from: string,
  to: string,
  minimumDate: Date,
  maximumDate: Date
) {
  if (!from || !to) {
    return false;
  }
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false;
  }
  const minimum = new Date(
    Date.UTC(
      minimumDate.getFullYear(),
      minimumDate.getMonth(),
      minimumDate.getDate()
    )
  );
  const maximumAllowed = new Date(
    Date.UTC(
      maximumDate.getFullYear(),
      maximumDate.getMonth(),
      maximumDate.getDate()
    )
  );
  if (start < minimum || end > maximumAllowed) {
    return true;
  }
  if (end < start) {
    return true;
  }
  const maximum = new Date(start);
  maximum.setUTCMonth(maximum.getUTCMonth() + 6);
  return end > maximum;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function canReturnToConfirmationCenter(item: ConfirmationResponseLibraryFile) {
  return Boolean(item.projectId);
}

function canBatchClaimResponse(item: ConfirmationResponseLibraryFile) {
  return !item.routedById && item.routingStatus === "UNASSIGNED_PROJECT";
}

function mergeWarehouseResponse(
  current: ConfirmationResponseLibraryFile[] | undefined,
  updated: ConfirmationResponseLibraryFile
) {
  return current?.map((item) => {
    if (item.id !== updated.id) {
      return item;
    }
    const merged = { ...item, ...updated };
    if (updated.projectId === null) {
      merged.project = null;
      merged.confirmation = null;
      merged.confirmationId = null;
      merged.matchedResponseId = null;
    }
    return merged;
  });
}

function _unused_shouldIgnoreWarehouseRowPreview(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(target.closest('[role="checkbox"], input'))
  );
}

function routingStatusLabel(
  item: ConfirmationResponseLibraryFile,
  locale: string
) {
  const zh = locale.startsWith("zh");
  const text = confirmationResponseRoutingCopy[zh ? "zh-CN" : "en-US"];
  if (item.routingStatus === "MATCHED") {
    return `${text.matched} · ${item.project?.name ?? "—"}`;
  }
  if (item.routingStatus === "PENDING_MATCH") {
    return `${text.pendingMatch} · ${item.project?.name ?? "—"}`;
  }
  if (item.routingStatus === "NO_SOURCE_REQUEST") {
    return `${text.noSourceRequest} · ${item.project?.name ?? "—"}`;
  }
  return text.projectUnassigned;
}

function canImportResponseToEmp(item: ConfirmationResponseLibraryFile) {
  return Boolean(
    item.confirmationId &&
    item.confirmation?.status === "CLOSED" &&
    item.confirmation.differenceStatus === "MATCHED"
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }
  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function formatDateOnly(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
