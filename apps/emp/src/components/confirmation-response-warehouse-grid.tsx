"use client";

import {
  DataGridColumnHeader,
  CollectionState,
  ProjectWingMasterDataGrid,
  ProjectWingPaginationFooter,
  useCompactViewport,
} from "@project-wing/ui";
import type { ProjectWingMasterDataGridProps } from "@project-wing/ui";
import {
  Download,
  Eye,
  FolderKanban,
  Search,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { ConfirmationResponseLibraryFile } from "../api/client";
import { ConfirmationColumnFilter } from "./confirmations/confirmation-column-filter";
import {
  ConfirmationLibraryMobile,
  ConfirmationLibraryRecord,
} from "./confirmations/confirmation-library-mobile";
import { getAvatarColorClassName, getAvatarInitials } from "./header-avatar";
import { ResponseWarehouseDateRange } from "./response-warehouse-date-range";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import { ButtonGroup } from "./ui/button-group";
import { Checkbox } from "./ui/checkbox";
import { InputGroup, InputGroupAddon, InputGroupInput } from "./ui/input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

const RESPONSE_WAREHOUSE_COLUMNS = [
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

type ResponseWarehouseColumn = (typeof RESPONSE_WAREHOUSE_COLUMNS)[number];
type FilterColumn = Exclude<ResponseWarehouseColumn, "actions">;

type ResponseWarehouseGridCopy = {
  title: string;
  moreActions: string;
  rowsPerPage: string;
  rowsPerPageSuffix: string;
  searchPlaceholder: string;
  resultCount: string;
  upload: string;
  loadError: string;
  noFiles: string;
  noResults: string;
  download: string;
  preview: string;
  filterColumnPlaceholder: string;
  filterNoOptions: string;
  clearColumnFilter: string;
  clearDateRange: string;
  dateRangeLabel: string;
  dateFromLabel: string;
  dateToLabel: string;
  dateRangeLimit: string;
  importToProjectDirectory: string;
  importUnavailable: string;
  archiveSelected: string;
  selectAll: string;
  selectRow: string;
  selectedCount: string;
  columns: Record<ResponseWarehouseColumn, string>;
};

type FilterOptions = Record<FilterColumn, { value: string; label: string }[]>;

type ColumnFilters = Partial<Record<FilterColumn, string[]>>;

function responseColumn(
  column: ProjectWingMasterDataGridProps<ConfirmationResponseLibraryFile>["columns"][number]
) {
  return column;
}

function formatDateOnly(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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

function ClaimantName({ name }: { name?: string | null }) {
  if (!name) {
    return <>—</>;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="inline-flex cursor-default">
            <Avatar
              aria-label={name}
              className={`size-6 shadow-none ${getAvatarColorClassName(name)}`}
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- The Avatar primitive renders initials, not an image resource.
              role="img"
              size="sm"
            >
              <AvatarFallback className="bg-transparent !text-[0.5rem] leading-none font-bold text-inherit">
                {getAvatarInitials(name)}
              </AvatarFallback>
            </Avatar>
          </span>
        }
      />
      <TooltipContent
        side="bottom"
        align="start"
        className="border border-border bg-popover text-popover-foreground shadow-xl shadow-foreground/15 [&>div]:hidden"
      >
        {name}
      </TooltipContent>
    </Tooltip>
  );
}

export function ConfirmationResponseWarehouseGrid({
  allSelectableRowsSelected,
  archiveSelectionMode,
  cancelLabel,
  columnFilters,
  contextLabel,
  copy,
  claimLabel,
  claimedByOtherLabel,
  compactDetails,
  currentUserId,
  dateFrom,
  dateTo,
  dateRangeError,
  maximumReceivedDate,
  minimumReceivedDate,
  filterOptions,
  isError,
  isLoading,
  onRetry,
  isRowArchivable,
  locale,
  onArchiveAction,
  onCancelArchiveSelection,
  onColumnFilterChange,
  onDownload,
  onOpenDetail,
  onPreview,
  onQueryChange,
  onReceivedDateRangeChange,
  onRoute,
  onSelectAll,
  onSelectRow,
  onUpload,
  onReturnToConfirmationCenter,
  query,
  returnToConfirmationCenterLabel,
  returnToCenterPending,
  canReturnToConfirmationCenter,
  routeLabel,
  rows,
  selectedIds,
  selectedRowCount,
  selectionActionLabel,
  selectionSelectedLabel,
  selectionActionPending = false,
  showDateRange,
  showArchiveAction,
  showUploadAction,
  useFixedClaimActions,
}: {
  allSelectableRowsSelected: boolean;
  archiveSelectionMode: boolean;
  cancelLabel: string;
  columnFilters: ColumnFilters;
  contextLabel?: string;
  copy: ResponseWarehouseGridCopy;
  claimLabel: string;
  claimedByOtherLabel: string;
  compactDetails: boolean;
  currentUserId?: string;
  dateFrom: string;
  dateTo: string;
  dateRangeError: string;
  maximumReceivedDate: Date;
  minimumReceivedDate: Date;
  filterOptions: FilterOptions;
  isError: boolean;
  isLoading: boolean;
  onRetry?: () => void;
  isRowArchivable: (item: ConfirmationResponseLibraryFile) => boolean;
  locale: string;
  onArchiveAction?: () => void;
  onCancelArchiveSelection: () => void;
  onColumnFilterChange: (column: FilterColumn, values: string[]) => void;
  onDownload: (item: ConfirmationResponseLibraryFile) => void;
  onOpenDetail: (item: ConfirmationResponseLibraryFile) => void;
  onPreview: (item: ConfirmationResponseLibraryFile) => void;
  onQueryChange: (value: string) => void;
  onReceivedDateRangeChange: (from: string, to: string) => void;
  onRoute: (item: ConfirmationResponseLibraryFile) => void;
  onSelectAll: () => void;
  onSelectRow: (
    item: ConfirmationResponseLibraryFile,
    checked: boolean
  ) => void;
  onUpload: () => void;
  onReturnToConfirmationCenter?: (
    item: ConfirmationResponseLibraryFile
  ) => void;
  query: string;
  returnToConfirmationCenterLabel?: string;
  returnToCenterPending?: boolean;
  canReturnToConfirmationCenter?: (
    item: ConfirmationResponseLibraryFile
  ) => boolean;
  routeLabel: string;
  routingStatusLabel: (item: ConfirmationResponseLibraryFile) => string;
  rows: ConfirmationResponseLibraryFile[];
  selectedIds: Set<string>;
  selectedRowCount: number;
  selectionActionLabel: string;
  selectionSelectedLabel: string;
  selectionActionPending?: boolean;
  showDateRange: boolean;
  showArchiveAction: boolean;
  showUploadAction: boolean;
  useFixedClaimActions: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [retainSelectionColumn, setRetainSelectionColumn] =
    useState(archiveSelectionMode);
  const [previousSelectionMode, setPreviousSelectionMode] =
    useState(archiveSelectionMode);
  if (previousSelectionMode !== archiveSelectionMode) {
    setPreviousSelectionMode(archiveSelectionMode);
    if (archiveSelectionMode) {
      setRetainSelectionColumn(true);
    }
  }
  useEffect(() => {
    if (archiveSelectionMode) {
      return;
    }
    const timeout = window.setTimeout(
      () => setRetainSelectionColumn(false),
      reduceMotion ? 0 : 200
    );
    return () => window.clearTimeout(timeout);
  }, [archiveSelectionMode, reduceMotion]);
  const showSelectionColumn = archiveSelectionMode || retainSelectionColumn;
  const selectionMotionClass = archiveSelectionMode
    ? "mx-auto motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-2 motion-safe:duration-150"
    : "mx-auto pointer-events-none motion-safe:animate-out motion-safe:fade-out motion-safe:slide-out-to-left-2 motion-safe:duration-200";
  const phone = useCompactViewport(767.98);
  const [pageSize, setPageSize] = useState(30);
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visibleRows = rows.slice(
    safePage * pageSize,
    (safePage + 1) * pageSize
  );
  const handleQueryChange = useCallback(
    (value: string) => {
      setPage(0);
      onQueryChange(value);
    },
    [onQueryChange]
  );
  const handleColumnFilterChange = useCallback(
    (column: FilterColumn, values: string[]) => {
      setPage(0);
      onColumnFilterChange(column, values);
    },
    [onColumnFilterChange]
  );
  const handleReceivedDateRangeChange = useCallback(
    (from: string, to: string) => {
      setPage(0);
      onReceivedDateRangeChange(from, to);
    },
    [onReceivedDateRangeChange]
  );

  useEffect(() => {
    if (safePage < 0) {
      return;
    }
    const viewport = document.querySelector<HTMLElement>(
      '[data-testid="confirmation-response-warehouse-data-grid"] [data-slot="scroll-area-viewport"]'
    );
    if (typeof viewport?.scrollTo === "function") {
      viewport.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [safePage]);

  const filterLabels = useMemo(
    () => ({
      triggerLabel: copy.filterColumnPlaceholder,
      searchLabel: copy.filterColumnPlaceholder,
      clearLabel: copy.clearColumnFilter,
      emptyLabel: copy.filterNoOptions,
    }),
    [copy.clearColumnFilter, copy.filterColumnPlaceholder, copy.filterNoOptions]
  );
  const renderRowActions = useCallback(
    (item: ConfirmationResponseLibraryFile) => {
      const claimedByCurrentUser =
        Boolean(item.routedById) && item.routedById === currentUserId;
      const claimedByOtherUser =
        Boolean(item.routedById) && !claimedByCurrentUser;
      const claimedByOtherMessage = claimedByOtherLabel.replace(
        "{name}",
        item.routedBy?.name || "—"
      );

      return (
        <ButtonGroup className="gap-1">
          {useFixedClaimActions ? (
            claimedByCurrentUser &&
            canReturnToConfirmationCenter?.(item) &&
            onReturnToConfirmationCenter &&
            returnToConfirmationCenterLabel ? (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={returnToConfirmationCenterLabel}
                disabled={returnToCenterPending}
                title={returnToConfirmationCenterLabel}
                onClick={() => onReturnToConfirmationCenter(item)}
              >
                <Undo2 />
              </Button>
            ) : claimedByOtherUser ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="group/disabled-action inline-flex cursor-not-allowed rounded-lg">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="group-hover/disabled-action:bg-muted group-hover/disabled-action:text-muted-foreground group-focus-visible/disabled-action:bg-muted"
                        aria-label={claimLabel}
                        disabled
                      >
                        <FolderKanban />
                      </Button>
                    </span>
                  }
                />
                <TooltipContent side="bottom">
                  {claimedByOtherMessage}
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={claimLabel}
                onClick={() => onRoute(item)}
              >
                <FolderKanban />
              </Button>
            )
          ) : (
            <>
              {item.routingStatus === "MATCHED" ? null : (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={routeLabel}
                  onClick={() => onRoute(item)}
                >
                  <FolderKanban />
                </Button>
              )}
              {canReturnToConfirmationCenter?.(item) &&
              onReturnToConfirmationCenter &&
              returnToConfirmationCenterLabel ? (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={returnToConfirmationCenterLabel}
                  disabled={returnToCenterPending}
                  title={returnToConfirmationCenterLabel}
                  onClick={() => onReturnToConfirmationCenter(item)}
                >
                  <Undo2 />
                </Button>
              ) : null}
            </>
          )}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={copy.preview}
            onClick={() => onPreview(item)}
          >
            <Eye />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={copy.download}
            onClick={() => onDownload(item)}
          >
            <Download />
          </Button>
        </ButtonGroup>
      );
    },
    [
      currentUserId,
      claimedByOtherLabel,
      useFixedClaimActions,
      canReturnToConfirmationCenter,
      onReturnToConfirmationCenter,
      returnToConfirmationCenterLabel,
      returnToCenterPending,
      claimLabel,
      onRoute,
      routeLabel,
      copy,
      onPreview,
      onDownload,
    ]
  );

  const columns = useMemo<
    ProjectWingMasterDataGridProps<ConfirmationResponseLibraryFile>["columns"]
  >(() => {
    const filterHeader = (column: FilterColumn) => ({
      id: column,
      header: () => (
        <ConfirmationColumnFilter
          label={copy.columns[column]}
          options={filterOptions[column]}
          selectedValues={columnFilters[column] ?? []}
          onChange={(values) => handleColumnFilterChange(column, values)}
          labels={filterLabels}
        />
      ),
      meta: { headerTitle: copy.columns[column] },
    });
    const result = [
      responseColumn({
        ...filterHeader("code"),
        accessorFn: (item) => item.code,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.code}
          </span>
        ),
        minSize: 150,
        size: 190,
      }),
      responseColumn({
        ...filterHeader("title"),
        accessorFn: (item) => item.title,
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate font-medium">{row.original.title}</div>
            <div className="truncate text-xs text-muted-foreground">
              {row.original.clientName} · {row.original.respondingEntity}
            </div>
          </div>
        ),
        minSize: 260,
        size: 380,
      }),
      responseColumn({
        ...filterHeader("receivedAt"),
        accessorFn: (item) => formatDateOnly(item.receivedAt, locale),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDateOnly(row.original.receivedAt, locale)}
          </span>
        ),
        minSize: 140,
        size: 170,
      }),
      responseColumn({
        ...filterHeader("claimedBy"),
        accessorFn: (item) => item.routedBy?.name || "—",
        cell: ({ row }) => <ClaimantName name={row.original.routedBy?.name} />,
        minSize: 150,
        size: 180,
      }),
      responseColumn({
        ...filterHeader("claimedAt"),
        accessorFn: (item) =>
          item.routedAt ? formatDateTime(item.routedAt, locale) : "—",
        cell: ({ row }) =>
          row.original.routedAt
            ? formatDateTime(row.original.routedAt, locale)
            : "—",
        minSize: 170,
        size: 200,
      }),
      responseColumn({
        ...filterHeader("courierTrackingNumber"),
        accessorFn: (item) => item.courierTrackingNumber || "—",
        cell: ({ row }) => row.original.courierTrackingNumber || "—",
        minSize: 160,
        size: 200,
      }),
      responseColumn({
        ...filterHeader("referenceNumber"),
        accessorFn: (item) => item.referenceNumber || "—",
        cell: ({ row }) => row.original.referenceNumber || "—",
        minSize: 150,
        size: 180,
      }),
      responseColumn({
        ...filterHeader("clientName"),
        accessorFn: (item) => item.clientName,
        cell: ({ row }) => row.original.clientName,
        minSize: 180,
        size: 230,
      }),
      responseColumn({
        ...filterHeader("respondingEntity"),
        accessorFn: (item) => item.respondingEntity,
        cell: ({ row }) => row.original.respondingEntity,
        minSize: 180,
        size: 230,
      }),
      responseColumn({
        ...filterHeader("notes"),
        accessorFn: (item) => item.notes || "—",
        cell: ({ row }) => (
          <span className="block max-w-72 truncate">
            {row.original.notes || "—"}
          </span>
        ),
        minSize: 180,
        size: 250,
      }),
      responseColumn({
        ...filterHeader("file"),
        accessorFn: (item) => item.fileName,
        cell: ({ row }) => (
          <div className="max-w-72 truncate">
            <div className="truncate">{row.original.fileName}</div>
            <div className="truncate text-xs text-muted-foreground">
              {formatFileSize(row.original.fileSize)} ·{" "}
              {row.original.uploader.name}
            </div>
          </div>
        ),
        minSize: 220,
        size: 300,
      }),
      responseColumn({
        id: "actions",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={copy.columns.actions} />
        ),
        cell: ({ row }) => renderRowActions(row.original),
        enableSorting: false,
        meta: {
          headerTitle: copy.columns.actions,
          headerClassName: compactDetails ? "text-left" : "text-right",
          cellClassName: compactDetails ? "text-left" : "text-right",
        },
        minSize: 150,
        size: 180,
      }),
    ];

    if (showSelectionColumn) {
      result.unshift(
        responseColumn({
          id: "selection",
          header: () => (
            <Checkbox
              aria-label={copy.selectAll}
              className={selectionMotionClass}
              checked={allSelectableRowsSelected}
              indeterminate={Boolean(
                selectedRowCount && !allSelectableRowsSelected
              )}
              disabled={!archiveSelectionMode || !rows.some(isRowArchivable)}
              onCheckedChange={onSelectAll}
            />
          ),
          cell: ({ row }) => {
            const archivable = isRowArchivable(row.original);
            return (
              <Checkbox
                aria-label={copy.selectRow.replace(
                  "{title}",
                  row.original.title
                )}
                className={selectionMotionClass}
                checked={selectedIds.has(row.original.id)}
                disabled={!archiveSelectionMode || !archivable}
                title={archivable ? undefined : copy.importUnavailable}
                onCheckedChange={(checked) =>
                  archivable && onSelectRow(row.original, checked === true)
                }
              />
            );
          },
          enableHiding: false,
          enableResizing: false,
          enableSorting: false,
          meta: { headerTitle: copy.selectAll },
          size: 44,
        })
      );
    }

    return compactDetails
      ? result.filter((column) =>
          [
            "selection",
            "code",
            "title",
            "receivedAt",
            "claimedBy",
            "file",
            "actions",
          ].includes(String(column.id))
        )
      : result;
  }, [
    allSelectableRowsSelected,
    archiveSelectionMode,
    showSelectionColumn,
    selectionMotionClass,
    compactDetails,
    columnFilters,
    copy,
    filterLabels,
    filterOptions,
    isRowArchivable,
    locale,
    handleColumnFilterChange,
    renderRowActions,
    onSelectAll,
    onSelectRow,
    rows,
    selectedIds,
    selectedRowCount,
  ]);
  const persistentActions = (
    <InputGroup className="w-[34rem] max-w-[42rem] min-w-[32rem] flex-none">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        aria-label={copy.searchPlaceholder}
        placeholder={copy.searchPlaceholder}
        value={query}
        onChange={(event) => handleQueryChange(event.target.value)}
      />
    </InputGroup>
  );

  const actions = (
    <>
      {showDateRange ? (
        <div className="flex items-center gap-2">
          <ResponseWarehouseDateRange
            clearLabel={copy.clearDateRange}
            from={dateFrom}
            fromLabel={copy.dateFromLabel}
            locale={locale}
            maximumDate={maximumReceivedDate}
            minimumDate={minimumReceivedDate}
            onChange={handleReceivedDateRangeChange}
            rangeLabel={copy.dateRangeLabel}
            to={dateTo}
            toLabel={copy.dateToLabel}
          />
          {dateRangeError ? (
            <span
              role="alert"
              className="text-xs whitespace-nowrap text-destructive"
            >
              {dateRangeError}
            </span>
          ) : null}
        </div>
      ) : null}
      <span className="text-sm whitespace-nowrap text-muted-foreground tabular-nums">
        {copy.resultCount.replace("{count}", String(rows.length))}
      </span>
      <AnimatePresence initial={false}>
        {archiveSelectionMode ? (
          <motion.span
            initial={{ opacity: 0, x: reduceMotion ? 0 : 6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reduceMotion ? 0 : 6 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
            aria-live="polite"
            className="text-sm whitespace-nowrap text-muted-foreground tabular-nums"
          >
            {copy.selectedCount.replace("{count}", String(selectedRowCount))}
          </motion.span>
        ) : null}
      </AnimatePresence>
      <ButtonGroup>
        {showArchiveAction && onArchiveAction ? (
          <div
            className={`inline-flex items-center overflow-hidden rounded-lg border ${selectedRowCount ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}
          >
            <Button
              type="button"
              disabled={
                selectionActionPending ||
                (archiveSelectionMode
                  ? selectedRowCount === 0
                  : !rows.some(isRowArchivable))
              }
              variant="ghost"
              className="rounded-none border-0 shadow-none hover:bg-foreground/10 hover:text-inherit"
              onClick={onArchiveAction}
            >
              <FolderKanban />
              {selectedRowCount ? selectionSelectedLabel : selectionActionLabel}
            </Button>
            <AnimatePresence initial={false}>
              {archiveSelectionMode ? (
                <motion.div
                  className="flex shrink-0 overflow-hidden"
                  initial={{ width: 0, opacity: 0, x: reduceMotion ? 0 : -6 }}
                  animate={{ width: 28, opacity: 1, x: 0 }}
                  exit={{ width: 0, opacity: 0, x: reduceMotion ? 0 : -6 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.18,
                    ease: "easeOut",
                  }}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="w-7 rounded-none border-0 shadow-none hover:bg-foreground/10 hover:text-inherit"
                    aria-label={cancelLabel}
                    title={cancelLabel}
                    disabled={selectionActionPending}
                    onClick={onCancelArchiveSelection}
                  >
                    <X />
                  </Button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}
        {showUploadAction ? (
          <Button type="button" onClick={onUpload}>
            <Upload />
            {copy.upload}
          </Button>
        ) : null}
      </ButtonGroup>
    </>
  );

  if (phone) {
    return (
      <ConfirmationLibraryMobile
        locale={locale}
        title={copy.title}
        search={persistentActions}
        actions={actions}
        filters={RESPONSE_WAREHOUSE_COLUMNS.filter(
          (column) => column !== "actions"
        ).map((column) => (
          <ConfirmationColumnFilter
            key={column}
            label={copy.columns[column]}
            options={filterOptions[column]}
            selectedValues={columnFilters[column] ?? []}
            onChange={(values) => handleColumnFilterChange(column, values)}
            labels={filterLabels}
          />
        ))}
        loading={isLoading}
        error={isError}
        onRetry={onRetry}
        count={visibleRows.length}
        empty={query ? copy.noResults : copy.noFiles}
        footer={
          rows.length > pageSize ? (
            <ProjectWingPaginationFooter
              locale={locale === "zh-CN" ? "zh-CN" : "en-US"}
              label={copy.rowsPerPage}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(0);
              }}
              page={safePage}
              pageSize={pageSize}
              pageSizeOptionSuffix={copy.rowsPerPageSuffix}
              recordCount={rows.length}
            />
          ) : undefined
        }
      >
        {visibleRows.map((item) => (
          <ConfirmationLibraryRecord
            key={item.id}
            id={item.id}
            locale={locale}
            title={item.title}
            description={`${item.code} · ${item.respondingEntity}`}
            meta={`${formatDateOnly(item.receivedAt, locale)} · ${item.routedBy?.name || "—"}`}
            onOpen={() =>
              compactDetails ? onOpenDetail(item) : onPreview(item)
            }
            actions={renderRowActions(item)}
            selection={
              archiveSelectionMode ? (
                <Checkbox
                  aria-label={copy.selectRow.replace("{title}", item.title)}
                  checked={selectedIds.has(item.id)}
                  disabled={!isRowArchivable(item)}
                  onCheckedChange={(checked) =>
                    onSelectRow(item, checked === true)
                  }
                />
              ) : undefined
            }
          />
        ))}
      </ConfirmationLibraryMobile>
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <ProjectWingMasterDataGrid
        locale={locale === "zh-CN" ? "zh-CN" : "en-US"}
        actions={actions}
        showRecordCount={!isLoading && !isError}
        columns={columns}
        content={
          isLoading ? (
            <CollectionState
              kind="loading"
              locale={locale === "zh-CN" ? "zh-CN" : "en-US"}
            />
          ) : isError ? (
            <CollectionState
              kind="error"
              locale={locale === "zh-CN" ? "zh-CN" : "en-US"}
              title={copy.loadError}
              onRetry={onRetry}
            />
          ) : undefined
        }
        data={visibleRows}
        emptyMessage={query.trim() ? copy.noResults : copy.noFiles}
        getRowId={(item) => item.id}
        overflowLabel={copy.moreActions}
        persistentActions={persistentActions}
        onRowClick={compactDetails ? onOpenDetail : onPreview}
        rowClassName={(item) =>
          selectedIds.has(item.id) ? "bg-primary/5" : undefined
        }
        showRowSelection={false}
        tableLayout={
          compactDetails
            ? { width: "fixed", columnsResizable: false }
            : undefined
        }
        tableLabel={copy.title}
        testId="confirmation-response-warehouse-data-grid"
        toolbarTestId="confirmation-response-warehouse-toolbar"
        titleAdornment={contextLabel ? `· ${contextLabel}` : undefined}
        title={copy.title}
        footer={
          isLoading || isError ? undefined : (
            <ProjectWingPaginationFooter
              locale={locale === "zh-CN" ? "zh-CN" : "en-US"}
              label={copy.rowsPerPage}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(0);
              }}
              page={safePage}
              pageSize={pageSize}
              pageSizeOptionSuffix={copy.rowsPerPageSuffix}
              recordCount={rows.length}
            />
          )
        }
      />
    </div>
  );
}

export type {
  ColumnFilters as ConfirmationResponseWarehouseColumnFilters,
  FilterColumn as ConfirmationResponseWarehouseFilterColumn,
  FilterOptions as ConfirmationResponseWarehouseFilterOptions,
};
