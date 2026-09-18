"use client";

import {
  DataGridColumnHeader,
  Button as MobileButton,
  Input as MobileInput,
  ProjectWingMasterDataGrid,
  ProjectWingPaginationFooter,
  useCompactViewport,
  MobileActionSheet,
} from "@project-wing/ui";
import type { ProjectWingMasterDataGridProps } from "@project-wing/ui";
import {
  Check,
  ChevronRight,
  ChevronDown,
  ListRestart,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { getConfirmationRegisterMobileCopy } from "@/i18n/confirmation-register-mobile";
import { getEmpMobileNavigationCopy } from "@/i18n/mobile-navigation";
import { cn } from "@/lib/utils";

import type { ProjectConfirmation } from "../../api/client";
import type { Dictionary } from "../../i18n/dictionaries";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ButtonGroup } from "../ui/button-group";
import { Input } from "../ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../ui/input-group";
import { getConfirmationTypeTone } from "./confirmation-category-tone";
import { ConfirmationColumnFilter } from "./confirmation-column-filter";
import {
  ConfirmationLibraryMobile,
  ConfirmationLibraryRecord,
} from "./confirmation-library-mobile";
import { LogisticsUnreadDot } from "./confirmation-logistics-unread";
import { ConfirmationMobileHeading } from "./confirmation-mobile-heading";
import type {
  ConfirmationPresentationStage,
  ConfirmationSentAgeBucket,
} from "./confirmation-presentation";
import {
  getConfirmationCounterpartyFilterValue,
  getConfirmationDateFilterKey,
  getConfirmationRegisterRow,
} from "./confirmation-register-model";
import type { ConfirmationRegisterFilters } from "./confirmation-register-model";

import mobileStyles from "./confirmation-register-mobile.module.css";

type Copy = Dictionary["confirmations"];

function column(
  value: ProjectWingMasterDataGridProps<ProjectConfirmation>["columns"][number]
) {
  return value;
}

function uniqueOptions(options: { value: string; label: string }[]) {
  return [
    ...new Map(options.map((option) => [option.value, option])).values(),
  ].filter((option) => option.value);
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale).format(date);
}

function getDisplayName(confirmation: ProjectConfirmation, copy: Copy) {
  return (
    confirmation.displayName?.trim() ||
    confirmation.counterpartyName.trim() ||
    copy.newConfirmation
  );
}

function getRegisterStatusLabel(
  copy: Copy,
  status: ConfirmationPresentationStage
) {
  if (status === "DRAFT") {
    return copy.overview.stages.draft;
  }
  if (status === "PREPARED") {
    return copy.overview.stages.prepared;
  }
  if (status === "SENT") {
    return copy.overview.stages.sent;
  }
  if (status === "RECEIVED") {
    return copy.overview.stages.received;
  }
  if (status === "PROCESSED") {
    return copy.overview.matrix.columns.processed;
  }
  if (status === "PENDING_ARCHIVE") {
    return copy.tracking.pendingArchive;
  }
  if (status === "COMPLETED") {
    return copy.overview.stages.completed;
  }
  if (status === "VOIDED") {
    return copy.statusLabels.VOIDED;
  }
  return status;
}

function getWaitingBucketLabel(
  copy: Copy,
  bucket: ConfirmationSentAgeBucket | null
) {
  if (!bucket) {
    return "—";
  }
  const labels: Record<ConfirmationSentAgeBucket, string> = {
    "0_7": copy.overview.ageBuckets.days0To7,
    "8_14": copy.overview.ageBuckets.days8To14,
    "15_21": copy.overview.ageBuckets.days15To21,
    "22_30": copy.overview.ageBuckets.days22To30,
    "31_45": copy.overview.ageBuckets.days31To45,
    "46_PLUS": copy.overview.ageBuckets.days46Plus,
    UNKNOWN: "—",
  };
  return labels[bucket];
}

function getSubtypeLabel(copy: Copy, type: string) {
  const labels: Record<string, string> = {
    BANK: copy.register.bank,
    INTERMEDIARY: copy.register.otherFinancialInstitution,
    BALANCE: copy.register.thirdParty,
    RELATED_PARTY: copy.register.relatedParty,
    LAWYER: copy.register.lawyer,
    INVENTORY: copy.register.inventory,
    OTHER: copy.register.miscellaneous,
    UNCLASSIFIED: copy.register.unclassified,
  };
  return labels[type] ?? copy.register.unclassified;
}

function getColumnFilterLabels(copy: Copy) {
  return {
    triggerLabel: copy.register.filterTrigger,
    searchLabel: copy.register.filterSearch,
    clearLabel: copy.register.clearFilter,
    emptyLabel: copy.register.noFilterOptions,
  };
}

export function ConfirmationRegisterDataGrid({
  confirmations,
  filterConfirmations,
  copy,
  editingName,
  editingNameId,
  hasSearchOrFilters,
  isRecycleBin,
  locale,
  nameQuery,
  readOnly,
  filters,
  title,
  onEditName,
  onEditingNameChange,
  onEditingNameCommit,
  onEditingNameCancel,
  onNameQueryChange,
  showNew,
  onNew,
  onOpen,
  onVoidMany,
  onRestoreMany,
  isVoiding,
  isRestoring,
  lifecycleActionResetKey,
  onFiltersChange,
  onResetFilters,
}: {
  confirmations: ProjectConfirmation[];
  filterConfirmations: ProjectConfirmation[];
  copy: Copy;
  editingName: string;
  editingNameId: string | null;
  hasSearchOrFilters: boolean;
  isRecycleBin: boolean;
  locale: string;
  nameQuery: string;
  readOnly: boolean;
  filters: ConfirmationRegisterFilters;
  title: string;
  onEditName: (confirmation: ProjectConfirmation) => void;
  onEditingNameChange: (value: string) => void;
  onEditingNameCommit: (confirmation: ProjectConfirmation) => void;
  onEditingNameCancel: () => void;
  onNameQueryChange: (value: string) => void;
  showNew: boolean;
  onNew: () => void;
  onOpen: (confirmation: ProjectConfirmation) => void;
  onVoidMany: (confirmations: ProjectConfirmation[]) => void;
  onRestoreMany: (confirmations: ProjectConfirmation[]) => void;
  isVoiding: boolean;
  isRestoring: boolean;
  lifecycleActionResetKey: number;
  onFiltersChange: (filters: ConfirmationRegisterFilters) => void;
  onResetFilters: () => void;
}) {
  const phone = useCompactViewport(767.98);
  const mobileCopy = getConfirmationRegisterMobileCopy(locale);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const pendingMobileAction = useRef<(() => void) | null>(null);
  const orderedConfirmations = useMemo(() => {
    if (!phone) {
      return confirmations;
    }
    return [...confirmations].sort((a, b) => {
      const left = Date.parse(a.updatedAt) || 0;
      const right = Date.parse(b.updatedAt) || 0;
      return right - left;
    });
  }, [confirmations, phone]);
  const [pageSize, setPageSize] = useState(30);
  const [page, setPage] = useState(0);
  const [actionMode, setActionMode] = useState<"DELETE" | "RESTORE" | null>(
    null
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const pendingNameOpenRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mode = isRecycleBin ? "RESTORE" : "DELETE";
  const pageCount = Math.max(1, Math.ceil(confirmations.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visibleRows = orderedConfirmations.slice(
    phone ? 0 : safePage * pageSize,
    (safePage + 1) * pageSize
  );
  const columnFilterLabels = useMemo(() => getColumnFilterLabels(copy), [copy]);
  const selectableConfirmations = useMemo(
    () =>
      visibleRows.filter((confirmation) =>
        isRecycleBin
          ? confirmation.status === "VOIDED"
          : confirmation.status !== "VOIDED"
      ),
    [isRecycleBin, visibleRows]
  );
  const selectableIds = useMemo(
    () =>
      new Set(selectableConfirmations.map((confirmation) => confirmation.id)),
    [selectableConfirmations]
  );
  const selectedConfirmations = useMemo(
    () =>
      selectableConfirmations.filter((confirmation) =>
        selectedIds.has(confirmation.id)
      ),
    [selectableConfirmations, selectedIds]
  );
  const visibleSelectedIds = useMemo(
    () =>
      new Set(
        [...selectedIds].filter((confirmationId) =>
          selectableIds.has(confirmationId)
        )
      ),
    [selectableIds, selectedIds]
  );

  useEffect(() => {
    setActionMode(null);
    setSelectedIds(new Set());
  }, [isRecycleBin, lifecycleActionResetKey]);

  useEffect(() => {
    setPage(0);
    setSelectedIds(new Set());
  }, [isRecycleBin]);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  useEffect(() => {
    const viewport = document.querySelector<HTMLElement>(
      '[data-testid="confirmation-register-data-grid"] [data-slot="scroll-area-viewport"]'
    );
    if (typeof viewport?.scrollTo === "function") {
      viewport.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [safePage]);

  useEffect(
    () => () => {
      if (pendingNameOpenRef.current) {
        clearTimeout(pendingNameOpenRef.current);
      }
    },
    []
  );

  const cancelPendingNameOpen = useCallback(() => {
    if (!pendingNameOpenRef.current) {
      return;
    }
    clearTimeout(pendingNameOpenRef.current);
    pendingNameOpenRef.current = null;
  }, []);
  const handlePageChange = (nextPage: number) => {
    setSelectedIds(new Set());
    setPage(nextPage);
  };
  const handlePageSizeChange = (nextPageSize: number) => {
    setSelectedIds(new Set());
    setPageSize(nextPageSize);
    setPage(0);
  };
  const scheduleNameOpen = useCallback(
    (confirmation: ProjectConfirmation) => {
      cancelPendingNameOpen();
      pendingNameOpenRef.current = setTimeout(() => {
        pendingNameOpenRef.current = null;
        onOpen(confirmation);
      }, 180);
    },
    [cancelPendingNameOpen, onOpen]
  );
  const filterOptions = useMemo(
    () => ({
      counterparty: uniqueOptions(
        filterConfirmations.map((confirmation) => {
          const value = getConfirmationCounterpartyFilterValue(confirmation);
          return { value, label: value };
        })
      ),
      type: uniqueOptions(
        filterConfirmations.map((confirmation) => ({
          value: confirmation.type,
          label: getSubtypeLabel(copy, confirmation.type),
        }))
      ),
      currentStatus: uniqueOptions(
        filterConfirmations.map((confirmation) => {
          const status = getConfirmationRegisterRow(confirmation).currentStatus;
          return {
            value: status,
            label: getRegisterStatusLabel(copy, status),
          };
        })
      ),
      baseDate: uniqueOptions(
        filterConfirmations
          .map((confirmation) => {
            const { baseDate } = getConfirmationRegisterRow(confirmation);
            return {
              value: getConfirmationDateFilterKey(baseDate),
              label: baseDate ? formatDate(baseDate, locale) : "—",
            };
          })
          .filter((option) => option.value)
      ),
      waitingTime: uniqueOptions(
        filterConfirmations
          .map((confirmation) => {
            const value =
              getConfirmationRegisterRow(confirmation).sentAgeBucket;
            return {
              value: value ?? "",
              label: getWaitingBucketLabel(copy, value),
            };
          })
          .filter((option) => option.value)
      ),
      updatedAt: uniqueOptions(
        filterConfirmations.map((confirmation) => ({
          value: getConfirmationDateFilterKey(confirmation.updatedAt),
          label: formatDate(confirmation.updatedAt, locale),
        }))
      ),
    }),
    [copy, filterConfirmations, locale]
  );
  const updateFilter = useCallback(
    <K extends keyof ConfirmationRegisterFilters>(key: K, values: string[]) => {
      setPage(0);
      if (phone) {
        setSelectedIds(new Set());
      }
      onFiltersChange({
        ...filters,
        [key]: values,
      } as ConfirmationRegisterFilters);
    },
    [filters, onFiltersChange, phone]
  );
  const handleNameQueryChange = useCallback(
    (value: string) => {
      setPage(0);
      if (phone) {
        setSelectedIds(new Set());
      }
      onNameQueryChange(value);
    },
    [onNameQueryChange, phone]
  );
  const handleResetFilters = useCallback(() => {
    setPage(0);
    onResetFilters();
  }, [onResetFilters]);
  const columns = useMemo<
    ProjectWingMasterDataGridProps<ProjectConfirmation>["columns"]
  >(() => {
    const result = [
      column({
        id: "code",
        accessorFn: (confirmation) => confirmation.confirmationCode ?? "—",
        header: ({ column: current }) => (
          <DataGridColumnHeader
            column={current}
            title={copy.register.columns.code}
          />
        ),
        cell: ({ row }) => (
          <span
            aria-label={row.original.confirmationCode ?? "—"}
            className="block font-mono text-xs break-all text-muted-foreground"
          >
            {row.original.confirmationCode ?? "—"}
          </span>
        ),
        meta: { headerTitle: copy.register.columns.code },
        minSize: 144,
        size: 200,
      }),
      column({
        id: "counterparty",
        accessorFn: (confirmation) => getDisplayName(confirmation, copy),
        header: () => (
          <ConfirmationColumnFilter
            label={copy.register.columns.counterparty}
            options={filterOptions.counterparty}
            selectedValues={filters.counterparty}
            onChange={(values) => updateFilter("counterparty", values)}
            labels={columnFilterLabels}
          />
        ),
        cell: ({ row }) => {
          const confirmation = row.original;
          const displayName = getDisplayName(confirmation, copy);
          return (
            <div className="min-w-0">
              {editingNameId === confirmation.id ? (
                <Input
                  autoFocus
                  aria-label={copy.renameInputLabel}
                  className="h-8"
                  value={editingName}
                  onBlur={() => onEditingNameCommit(confirmation)}
                  onChange={(event) => onEditingNameChange(event.target.value)}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onEditingNameCommit(confirmation);
                    }
                    if (event.key === "Escape") {
                      onEditingNameCancel();
                    }
                  }}
                />
              ) : (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto max-w-full justify-start p-0 text-left font-medium"
                  onClick={(event) => {
                    event.stopPropagation();
                    scheduleNameOpen(confirmation);
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    cancelPendingNameOpen();
                    onEditName(confirmation);
                  }}
                >
                  <span className="break-words whitespace-normal">
                    {displayName}
                  </span>
                </Button>
              )}
              {confirmation.respondingEntityName &&
              confirmation.respondingEntityName !== displayName ? (
                <span className="mt-1 block text-xs break-words whitespace-normal text-muted-foreground">
                  {confirmation.respondingEntityName}
                </span>
              ) : null}
            </div>
          );
        },
        meta: { headerTitle: copy.register.columns.counterparty },
        minSize: 160,
        size: 260,
      }),
      column({
        id: "type",
        accessorFn: (confirmation) => getSubtypeLabel(copy, confirmation.type),
        header: () => (
          <ConfirmationColumnFilter
            label={copy.register.columns.type}
            options={filterOptions.type}
            selectedValues={filters.type}
            onChange={(values) => updateFilter("type", values)}
            labels={columnFilterLabels}
          />
        ),
        cell: ({ row }) => {
          const tone = getConfirmationTypeTone(row.original.type);
          return (
            <Badge
              variant="outline"
              data-category-tone={tone.key}
              className={cn("max-w-full truncate", tone.badge)}
            >
              {getSubtypeLabel(copy, row.original.type)}
            </Badge>
          );
        },
        meta: { headerTitle: copy.register.columns.type },
        minSize: 100,
        size: 140,
      }),
      column({
        id: "currentStatus",
        accessorFn: (confirmation) =>
          getRegisterStatusLabel(
            copy,
            getConfirmationRegisterRow(confirmation).currentStatus
          ),
        header: () => (
          <ConfirmationColumnFilter
            label={copy.register.columns.currentStatus}
            options={filterOptions.currentStatus}
            selectedValues={filters.currentStatus}
            onChange={(values) =>
              updateFilter(
                "currentStatus",
                values as ConfirmationPresentationStage[]
              )
            }
            labels={columnFilterLabels}
          />
        ),
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            {getRegisterStatusLabel(
              copy,
              getConfirmationRegisterRow(row.original).currentStatus
            )}
            <LogisticsUnreadDot confirmationId={row.original.id} />
          </span>
        ),
        meta: { headerTitle: copy.register.columns.currentStatus },
        minSize: 120,
        size: 170,
      }),
      column({
        id: "baseDate",
        accessorFn: (confirmation) =>
          getConfirmationDateFilterKey(
            getConfirmationRegisterRow(confirmation).baseDate
          ),
        header: () => (
          <ConfirmationColumnFilter
            label={copy.register.columns.baseDate}
            options={filterOptions.baseDate}
            selectedValues={filters.baseDate}
            onChange={(values) => updateFilter("baseDate", values)}
            labels={columnFilterLabels}
          />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">
            {formatDate(
              getConfirmationRegisterRow(row.original).baseDate,
              locale
            )}
          </span>
        ),
        meta: { headerTitle: copy.register.columns.baseDate },
        minSize: 110,
        size: 150,
      }),
      column({
        id: "waitingTime",
        accessorFn: (confirmation) =>
          getConfirmationRegisterRow(confirmation).sentAgeBucket ?? "",
        header: () => (
          <ConfirmationColumnFilter
            label={copy.register.columns.waitingTime}
            options={filterOptions.waitingTime}
            selectedValues={filters.waitingTime}
            onChange={(values) =>
              updateFilter("waitingTime", values as ConfirmationSentAgeBucket[])
            }
            labels={columnFilterLabels}
          />
        ),
        cell: ({ row }) => {
          const { waitingDays } = getConfirmationRegisterRow(row.original);
          return (
            <span className="text-muted-foreground tabular-nums">
              {waitingDays === null
                ? "—"
                : copy.overview.days.replace("{count}", String(waitingDays))}
            </span>
          );
        },
        meta: { headerTitle: copy.register.columns.waitingTime },
        minSize: 110,
        size: 150,
      }),
      column({
        id: "updatedAt",
        accessorFn: (confirmation) =>
          getConfirmationDateFilterKey(confirmation.updatedAt),
        header: () => (
          <ConfirmationColumnFilter
            label={copy.register.columns.updatedAt}
            options={filterOptions.updatedAt}
            selectedValues={filters.updatedAt}
            onChange={(values) => updateFilter("updatedAt", values)}
            labels={columnFilterLabels}
          />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">
            {formatDate(row.original.updatedAt, locale)}
          </span>
        ),
        meta: { headerTitle: copy.register.columns.updatedAt },
        minSize: 110,
        size: 150,
      }),
      column({
        id: "actions",
        header: ({ column: current }) => (
          <DataGridColumnHeader
            column={current}
            title={copy.register.columns.actions}
          />
        ),
        cell: ({ row }) => {
          const displayName = getDisplayName(row.original, copy);
          return (
            <ButtonGroup className="ml-auto">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`${copy.register.open}: ${displayName}`}
                onClick={() => onOpen(row.original)}
              >
                <ChevronRight />
              </Button>
            </ButtonGroup>
          );
        },
        enableSorting: false,
        meta: {
          headerTitle: copy.register.columns.actions,
          headerClassName: "text-right",
          cellClassName: "text-right",
        },
        minSize: 64,
        size: 80,
      }),
    ];

    if (actionMode === mode) {
      result.unshift(
        column({
          id: "selection",
          header: () => (
            <span className="sr-only">{copy.register.selectionColumn}</span>
          ),
          cell: ({ row }) => {
            if (!selectableIds.has(row.original.id)) {
              return null;
            }
            return (
              <Button
                type="button"
                size="icon-sm"
                variant={
                  visibleSelectedIds.has(row.original.id)
                    ? "destructive"
                    : "outline"
                }
                aria-label={copy.register.selectRow.replace(
                  "{name}",
                  getDisplayName(row.original, copy)
                )}
                aria-pressed={visibleSelectedIds.has(row.original.id)}
                onClick={() =>
                  setSelectedIds((current) => {
                    const next = new Set(current);
                    if (next.has(row.original.id)) {
                      next.delete(row.original.id);
                    } else {
                      next.add(row.original.id);
                    }
                    return next;
                  })
                }
              >
                <Check />
              </Button>
            );
          },
          enableHiding: false,
          enableResizing: false,
          enableSorting: false,
          meta: { headerTitle: copy.register.selectionColumn },
          size: 48,
        })
      );
    }

    return result;
  }, [
    actionMode,
    columnFilterLabels,
    copy,
    editingName,
    editingNameId,
    filterOptions,
    filters,
    locale,
    mode,
    onEditName,
    onEditingNameCancel,
    onEditingNameChange,
    onEditingNameCommit,
    onOpen,
    scheduleNameOpen,
    cancelPendingNameOpen,
    selectableIds,
    visibleSelectedIds,
    updateFilter,
  ]);
  const actionLabel =
    actionMode === mode && selectedConfirmations.length > 0
      ? isRecycleBin
        ? copy.register.restoreSelected
        : copy.register.deleteSelected
      : isRecycleBin
        ? copy.register.restoreMode
        : copy.register.deleteMode;
  const lifecyclePending = isVoiding || isRestoring;
  const toggleMobileSelection = (id: string) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  const runToolbarAction = (action: () => void) => {
    if (phone) {
      pendingMobileAction.current = action;
      setMobileControlsOpen(false);
    } else {
      action();
    }
  };
  const toggleActionMode = () => {
    if (actionMode !== mode) {
      setActionMode(mode);
      setSelectedIds(new Set());
      return;
    }
    if (selectedConfirmations.length === 0) {
      setActionMode(null);
      setSelectedIds(new Set());
      return;
    }
    if (isRecycleBin) {
      onRestoreMany(selectedConfirmations);
    } else {
      onVoidMany(selectedConfirmations);
    }
  };
  const persistentActions = (
    <InputGroup className="w-full max-w-md min-w-40">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        aria-label={copy.filter.searchLabel}
        placeholder={copy.register.searchPlaceholder}
        value={nameQuery}
        onChange={(event) => handleNameQueryChange(event.target.value)}
      />
    </InputGroup>
  );
  const actions = (
    <>
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        onClick={handleResetFilters}
        aria-label={copy.register.resetFilters}
      >
        <ListRestart />
      </Button>
      <ButtonGroup>
        {showNew ? (
          <Button
            type="button"
            disabled={readOnly}
            onClick={() => runToolbarAction(onNew)}
          >
            <Plus />
            {copy.newConfirmation}
          </Button>
        ) : null}
        <Button
          type="button"
          disabled={
            readOnly ||
            lifecyclePending ||
            (actionMode !== mode && selectableConfirmations.length === 0)
          }
          variant={
            actionMode === mode && selectedConfirmations.length > 0
              ? "destructive"
              : actionMode === mode
                ? "secondary"
                : "default"
          }
          onClick={() => runToolbarAction(toggleActionMode)}
        >
          {isRecycleBin ? <RotateCcw /> : <Trash2 />}
          {actionLabel}
        </Button>
      </ButtonGroup>
    </>
  );

  if (phone) {
    const activeConditions = (
      Object.keys(filters) as (keyof ConfirmationRegisterFilters)[]
    )
      .filter((key) => key !== "currentStatus" || isRecycleBin)
      .flatMap((key) =>
        filters[key].map((value) => {
          let label: string;
          if (key === "responseOutcome") {
            label =
              mobileCopy.responseOutcomes[
                value as keyof typeof mobileCopy.responseOutcomes
              ];
          } else if (key === "type") {
            label = getSubtypeLabel(copy, value);
          } else if (key === "currentStatus") {
            label = getRegisterStatusLabel(
              copy,
              value as ConfirmationPresentationStage
            );
          } else if (key === "waitingTime") {
            label = getWaitingBucketLabel(
              copy,
              value as ConfirmationSentAgeBucket
            );
          } else {
            label = `${copy.register.columns[key]}: ${filterOptions[key].find((option) => option.value === value)?.label ?? value}`;
          }
          return { key, value, label };
        })
      );
    return (
      <div
        className={mobileStyles.root}
        data-testid="confirmation-register-mobile"
      >
        <div className={mobileStyles.summary}>
          <ConfirmationMobileHeading
            title={title}
            count={confirmations.length}
            action={
              isRecycleBin ? undefined : (
                <MobileRegisterStatus
                  copy={copy}
                  locale={locale}
                  selectedValues={filters.currentStatus}
                  onChange={(values) => updateFilter("currentStatus", values)}
                />
              )
            }
          />
        </div>
        {activeConditions.length > 0 && (
          <div
            className={mobileStyles.conditions}
            aria-label={mobileCopy.activeFilters}
          >
            {activeConditions.map(({ key, value, label }) => (
              <MobileButton
                key={`${key}-${value}`}
                variant="secondary"
                className={mobileStyles.condition}
                aria-label={`${mobileCopy.clearCondition}: ${label}`}
                onClick={() =>
                  updateFilter(
                    key,
                    filters[key].filter((item) => item !== value)
                  )
                }
              >
                {label}
                <X aria-hidden />
              </MobileButton>
            ))}
          </div>
        )}
        <div className={mobileStyles.body}>
          <ConfirmationLibraryMobile
            locale={locale}
            title={title}
            search={persistentActions}
            actionsLabel={mobileCopy.actions}
            actions={
              <div className={mobileStyles.listActions}>
                {showNew && (
                  <MobileButton
                    variant="primary"
                    disabled={readOnly}
                    onClick={() => runToolbarAction(onNew)}
                  >
                    <Plus />
                    {copy.newConfirmation}
                  </MobileButton>
                )}
                <MobileButton
                  variant={isRecycleBin ? "outline" : "danger"}
                  disabled={
                    readOnly ||
                    lifecyclePending ||
                    (actionMode !== mode &&
                      selectableConfirmations.length === 0)
                  }
                  onClick={() => runToolbarAction(toggleActionMode)}
                >
                  {isRecycleBin ? <RotateCcw /> : <Trash2 />}
                  {actionLabel}
                </MobileButton>
              </div>
            }
            loading={false}
            count={visibleRows.length}
            empty={
              hasSearchOrFilters ? copy.filter.noMatches : copy.emptyDescription
            }
            actionsOpen={mobileControlsOpen}
            onActionsOpenChange={setMobileControlsOpen}
            onActionsOpenChangeComplete={(open) => {
              if (!open) {
                const action = pendingMobileAction.current;
                pendingMobileAction.current = null;
                action?.();
              }
            }}
            footer={
              visibleRows.length < confirmations.length ? (
                <div className={mobileStyles.pagination}>
                  <MobileButton
                    variant="outline"
                    onClick={() => setPage(safePage + 1)}
                  >
                    {mobileCopy.loadMore}
                  </MobileButton>
                  <span>
                    {visibleRows.length} / {confirmations.length}
                  </span>
                </div>
              ) : undefined
            }
          >
            {visibleRows.map((confirmation) => (
              <MobileRegisterRow
                key={confirmation.id}
                confirmation={confirmation}
                copy={copy}
                locale={locale}
                readOnly={readOnly || lifecyclePending}
                onOpen={onOpen}
                onEditName={onEditName}
                editingName={editingName}
                editingNameId={editingNameId}
                onEditingNameChange={onEditingNameChange}
                onEditingNameCommit={onEditingNameCommit}
                onEditingNameCancel={onEditingNameCancel}
                selection={
                  actionMode === mode && selectableIds.has(confirmation.id) ? (
                    <MobileButton
                      variant={
                        visibleSelectedIds.has(confirmation.id)
                          ? "secondary"
                          : "outline"
                      }
                      size="icon"
                      disabled={readOnly || lifecyclePending}
                      aria-label={copy.register.selectRow.replace(
                        "{name}",
                        getDisplayName(confirmation, copy)
                      )}
                      aria-pressed={visibleSelectedIds.has(confirmation.id)}
                      onClick={() => toggleMobileSelection(confirmation.id)}
                    >
                      <Check />
                    </MobileButton>
                  ) : undefined
                }
              />
            ))}
          </ConfirmationLibraryMobile>
        </div>
        {actionMode === mode ? (
          <div className={mobileStyles.selection}>
            <span>
              {mobileCopy.selected.replace(
                "{count}",
                String(selectedConfirmations.length)
              )}
            </span>
            <div className={mobileStyles.editActions}>
              <MobileButton
                variant="outline"
                disabled={lifecyclePending}
                onClick={() => {
                  setActionMode(null);
                  setSelectedIds(new Set());
                }}
              >
                {mobileCopy.cancel}
              </MobileButton>
              <MobileButton
                variant={isRecycleBin ? "primary" : "danger"}
                disabled={
                  readOnly ||
                  lifecyclePending ||
                  selectedConfirmations.length === 0
                }
                onClick={toggleActionMode}
              >
                {isRecycleBin
                  ? copy.register.restoreSelected
                  : copy.register.deleteSelected}
              </MobileButton>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <ProjectWingMasterDataGrid
        locale={locale === "zh-CN" ? "zh-CN" : "en-US"}
        actions={actions}
        columns={columns}
        data={visibleRows}
        emptyMessage={
          hasSearchOrFilters ? copy.filter.noMatches : copy.emptyDescription
        }
        getRowId={(confirmation) => confirmation.id}
        overflowLabel={copy.register.moreActions}
        persistentActions={persistentActions}
        onRowClick={onOpen}
        rowClassName={() => "cursor-pointer"}
        showRowSelection={false}
        tableLabel={title}
        testId="confirmation-register-data-grid"
        toolbarTestId="confirmation-register-toolbar"
        title={title}
        tableLayout={{ width: "auto", columnsResizable: false }}
        footer={
          <ProjectWingPaginationFooter
            locale={locale === "zh-CN" ? "zh-CN" : "en-US"}
            label={copy.register.rowsPerPage}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            page={safePage}
            pageSize={pageSize}
            pageSizeOptionSuffix={copy.register.rowsPerPageSuffix}
            recordCount={confirmations.length}
          />
        }
      />
    </div>
  );
}

function MobileRegisterRow({
  confirmation,
  copy,
  locale,
  readOnly,
  onOpen,
  selection,
  editingName,
  editingNameId,
  onEditName,
  onEditingNameChange,
  onEditingNameCommit,
  onEditingNameCancel,
}: {
  confirmation: ProjectConfirmation;
  copy: Copy;
  locale: string;
  readOnly: boolean;
  selection?: ReactNode;
  onOpen: (confirmation: ProjectConfirmation) => void;
  editingName: string;
  editingNameId: string | null;
  onEditName: (confirmation: ProjectConfirmation) => void;
  onEditingNameChange: (value: string) => void;
  onEditingNameCommit: (confirmation: ProjectConfirmation) => void;
  onEditingNameCancel: () => void;
}) {
  const mobileCopy = getConfirmationRegisterMobileCopy(locale);
  const title = getDisplayName(confirmation, copy);
  const row = getConfirmationRegisterRow(confirmation);
  const status = getRegisterStatusLabel(copy, row.currentStatus);
  const waiting =
    row.waitingDays === null
      ? "—"
      : copy.overview.days.replace("{count}", String(row.waitingDays));
  const editing = editingNameId === confirmation.id;
  return (
    <ConfirmationLibraryRecord
      id={confirmation.id}
      title={title}
      locale={locale}
      description={
        confirmation.respondingEntityName &&
        confirmation.respondingEntityName !== title
          ? confirmation.respondingEntityName
          : undefined
      }
      onOpen={() => onOpen(confirmation)}
      selection={selection}
      onActionsClose={() => {
        if (editing) {
          onEditingNameCancel();
        }
      }}
      meta={
        <span className={mobileStyles.meta}>
          <span className={mobileStyles.code}>
            {confirmation.confirmationCode || "—"}
          </span>
          <span className={mobileStyles.type}>
            {getSubtypeLabel(copy, confirmation.type)}
          </span>
          <span>{status}</span>
        </span>
      }
      actions={
        editing ? (
          <div className={mobileStyles.edit}>
            <MobileInput
              autoFocus
              aria-label={copy.renameInputLabel}
              value={editingName}
              disabled={readOnly}
              onChange={(event) => onEditingNameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (!readOnly && editingName.trim()) {
                    onEditingNameCommit(confirmation);
                  }
                }
                if (event.key === "Escape") {
                  event.stopPropagation();
                  onEditingNameCancel();
                }
              }}
            />
            <div className={mobileStyles.editActions}>
              <MobileButton variant="outline" onClick={onEditingNameCancel}>
                {mobileCopy.cancel}
              </MobileButton>
              <MobileButton
                disabled={readOnly || !editingName.trim()}
                onClick={() => onEditingNameCommit(confirmation)}
              >
                {copy.save}
              </MobileButton>
            </div>
          </div>
        ) : (
          <>
            <dl className={mobileStyles.details}>
              <dt>{copy.register.columns.code}</dt>
              <dd>{confirmation.confirmationCode || "—"}</dd>
              <dt>{copy.register.columns.type}</dt>
              <dd>{getSubtypeLabel(copy, confirmation.type)}</dd>
              <dt>{copy.register.columns.currentStatus}</dt>
              <dd>{status}</dd>
              <dt>{copy.register.columns.baseDate}</dt>
              <dd>{formatDate(row.baseDate, locale) || "—"}</dd>
              <dt>{copy.register.columns.waitingTime}</dt>
              <dd>{waiting}</dd>
              <dt>{copy.register.columns.updatedAt}</dt>
              <dd>{formatDate(confirmation.updatedAt, locale) || "—"}</dd>
            </dl>
            <MobileButton
              variant="quiet"
              disabled={readOnly}
              onClick={() => onEditName(confirmation)}
            >
              {mobileCopy.rename}
            </MobileButton>
          </>
        )
      }
    />
  );
}

function MobileRegisterStatus({
  copy,
  selectedValues,
  onChange,
  locale,
}: {
  copy: Copy;
  selectedValues: ConfirmationPresentationStage[];
  onChange: (values: ConfirmationPresentationStage[]) => void;
  locale: string;
}) {
  const [open, setOpen] = useState(false);
  const mobileCopy = getConfirmationRegisterMobileCopy(locale);
  const navigationCopy = getEmpMobileNavigationCopy(locale);
  const selectedLabels = selectedValues.map((value) =>
    getRegisterStatusLabel(copy, value)
  );
  const triggerLabel =
    selectedValues.length === 1
      ? selectedLabels[0]
      : selectedValues.length > 1
        ? mobileCopy.statusCount.replace(
            "{count}",
            String(selectedValues.length)
          )
        : mobileCopy.status;
  const stages: ConfirmationPresentationStage[] = [
    "DRAFT",
    "PREPARED",
    "SENT",
    "RECEIVED",
    "PROCESSED",
    "COMPLETED",
  ];
  return (
    <>
      <MobileButton
        variant="quiet"
        className={mobileStyles.statusTrigger}
        aria-label={
          selectedLabels.length
            ? `${mobileCopy.status}: ${selectedLabels.join(", ")}`
            : mobileCopy.status
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-pressed={selectedValues.length > 0}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
        <ChevronDown />
      </MobileButton>
      <MobileActionSheet
        open={open}
        onOpenChange={setOpen}
        title={mobileCopy.status}
        closeLabel={navigationCopy.close}
      >
        <div className={mobileStyles.statusOptions}>
          {[
            { value: null, label: mobileCopy.allStatuses },
            ...stages.map((value) => ({
              value,
              label: getRegisterStatusLabel(copy, value),
            })),
          ].map(({ value, label }) => {
            const selected =
              value === null
                ? selectedValues.length === 0
                : selectedValues.includes(value);
            return (
              <MobileButton
                key={value ?? "ALL"}
                variant={selected ? "secondary" : "quiet"}
                aria-pressed={selected}
                onClick={() => {
                  onChange(value ? [value] : []);
                  setOpen(false);
                }}
              >
                {label}
                {selected ? <Check aria-hidden /> : null}
              </MobileButton>
            );
          })}
        </div>
      </MobileActionSheet>
    </>
  );
}
