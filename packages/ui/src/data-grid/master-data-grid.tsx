"use client";
"use no memo";

import type {
  Column,
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  Row,
  RowModel,
  RowSelectionState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import {
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, Ellipsis, Settings2 } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { Button } from "../button";
import { Frame, FramePanel } from "../frame";
import { MotionButton } from "../motion-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../select";
import { cn } from "../utils";
import { DataGrid } from "./data-grid";
import type { DataGridProps } from "./data-grid";
import { DataGridColumnHeader } from "./data-grid-column-header";
import { DataGridColumnHeaderFilter } from "./data-grid-column-header-filter";
import { getResponsiveColumnVisibility } from "./data-grid-column-preferences";
import { DataGridColumnVisibility } from "./data-grid-column-visibility";
import { getDataGridCopy } from "./data-grid-copy";
import type { DataGridLocale } from "./data-grid-copy";
import { DataGridScrollArea } from "./data-grid-scroll-area";
import {
  DataGridTable,
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
} from "./data-grid-table";
import { ProjectWingDataGridToolbar } from "./data-grid-toolbar";
import { getPaginationPages } from "./pagination-pages";

type DataGridColumnMenuCopy = {
  clear: string;
  empty: string;
  filter: string;
  search: string;
};

type ProjectWingMasterDataGridProps<TData extends object> = {
  locale?: DataGridLocale;
  actions?: ReactNode;
  primaryAction?: ReactNode;
  footer?: ReactNode;
  content?: ReactNode;
  columns: ColumnDef<TData>[];
  columnVisibilityCompact?: boolean;
  columnVisibilityIconOnly?: boolean;
  columnVisibilityLabel?: string;
  columnVisibilityPosition?: "before-actions" | "after-actions";
  compactHiddenColumnIds?: string[];
  data: TData[];
  emptyMessage: string;
  getRowId?: (row: TData, index: number) => string;
  initialColumnFilters?: ColumnFiltersState;
  initialSorting?: SortingState;
  initialVisibility?: VisibilityState;
  isRowSelectable?: (row: TData) => boolean;
  keepRowsAtEnd?: (row: TData) => boolean;
  leadingActions?: ReactNode;
  onRowClick?: (row: TData) => void;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  overflowLabel?: string;
  paginationPageSize?: number;
  paginationPageSizeLabel?: string;
  paginationPageSizeOptionSuffix?: string;
  paginationPageSizeOptions?: readonly number[];
  paginationResetKey?: string | number | boolean;
  persistentActions?: ReactNode;
  rowProps?: DataGridProps<TData>["rowProps"];
  rowClassName?: (row: TData) => string | undefined;
  rowSelection?: RowSelectionState;
  recordCount?: number;
  selectionSummary?: string;
  showRecordCount?: boolean;
  showToolbar?: boolean;
  showRowSelection?: boolean;
  tableLabel?: string;
  tableClassNames?: DataGridProps<TData>["tableClassNames"];
  tableLayout?: DataGridProps<TData>["tableLayout"];
  testId: string;
  title: string;
  titleAdornment?: ReactNode;
  toolbarTestId?: string;
  trailingActions?: ReactNode;
};

type ProjectWingPaginationFooterProps = {
  locale?: DataGridLocale;
  label: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  page: number;
  pageSize: number;
  pageSizeOptionSuffix?: string;
  pageSizeOptions?: readonly number[];
  recordCount: number;
};

export function createRowModelWithTrailingRows<TData extends object>(
  getRowModel: () => RowModel<TData>,
  keepRowsAtEnd: (row: TData) => boolean
) {
  let previousModel: RowModel<TData> | null = null;
  let previousResult: RowModel<TData> | null = null;

  return () => {
    const model = getRowModel();
    if (model === previousModel && previousResult) {
      return previousResult;
    }

    const trailingRows = model.rows.filter((row) =>
      keepRowsAtEnd(row.original)
    );
    previousModel = model;
    previousResult = {
      ...model,
      rows: [
        ...model.rows.filter((row) => !keepRowsAtEnd(row.original)),
        ...trailingRows,
      ],
    };
    return previousResult;
  };
}

export function getSortedRowModelWithTrailingRows<TData extends object>(
  keepRowsAtEnd: (row: TData) => boolean
): ReturnType<typeof getSortedRowModel<TData>> {
  const getBaseSortedRowModel = getSortedRowModel<TData>();
  return (table) =>
    createRowModelWithTrailingRows(getBaseSortedRowModel(table), keepRowsAtEnd);
}

const EMPTY_COMPACT_HIDDEN_COLUMN_IDS: string[] = [];
const EMPTY_COLUMN_FILTERS: ColumnFiltersState = [];
const EMPTY_SORTING: SortingState = [];
const DEFAULT_PAGE_SIZE_OPTIONS = [30, 40, 50];

function ProjectWingPaginationFooter({
  locale,
  label,
  onPageChange,
  onPageSizeChange,
  page,
  pageSize,
  pageSizeOptionSuffix = "",
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  recordCount,
}: ProjectWingPaginationFooterProps) {
  const copy = getDataGridCopy(locale);
  const pageCount = Math.max(1, Math.ceil(recordCount / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const from = recordCount === 0 ? 0 : safePage * pageSize + 1;
  const to = Math.min((safePage + 1) * pageSize, recordCount);

  return (
    <div
      data-slot="data-grid-pagination"
      className="border-border bg-card text-muted-foreground @container/pagination flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs"
    >
      <span className="shrink-0 tabular-nums">{`${from}-${to} / ${recordCount}`}</span>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
        <Button
          aria-label={copy.previousPage}
          disabled={safePage === 0}
          onClick={() => onPageChange(safePage - 1)}
          size="sm"
          type="button"
          variant="ghost"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <div className="hidden items-center gap-1 @[28rem]/pagination:flex">
          {getPaginationPages(safePage, pageCount).map((index) =>
            typeof index === "string" ? (
              <span
                key={index}
                aria-hidden="true"
                className="grid size-6 place-items-center"
              >
                <Ellipsis className="size-4" />
              </span>
            ) : (
              <Button
                aria-current={safePage === index ? "page" : undefined}
                aria-label={copy.page(index + 1)}
                className="min-w-8 font-semibold"
                key={index}
                onClick={() => onPageChange(index)}
                size="sm"
                type="button"
                variant={safePage === index ? "secondary" : "ghost"}
              >
                {index + 1}
              </Button>
            )
          )}
        </div>
        <span className="px-1 tabular-nums @[28rem]/pagination:hidden">
          {safePage + 1} / {pageCount}
        </span>
        <Button
          aria-label={copy.nextPage}
          disabled={safePage >= pageCount - 1}
          onClick={() => onPageChange(safePage + 1)}
          size="sm"
          type="button"
          variant="ghost"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
        <Select
          onValueChange={(value) => onPageSizeChange(Number(value))}
          value={`${pageSize}`}
        >
          <SelectTrigger
            aria-label={label}
            className="bg-background text-foreground ml-2 min-w-24 font-medium shadow-none"
            size="sm"
          >
            <SelectValue>{`${pageSize}${pageSizeOptionSuffix}`}</SelectValue>
          </SelectTrigger>
          <SelectContent align="end" alignItemWithTrigger={false} className="project-wing-pagination-size-popup">
            {pageSizeOptions.map((option) => (
              <SelectItem key={option} value={`${option}`}>
                {`${option}${pageSizeOptionSuffix}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function projectWingSelectedValuesFilter<TData extends object>(
  row: Row<TData>,
  columnId: string,
  filterValue: unknown
) {
  const selected = Array.isArray(filterValue) ? filterValue : [];
  return (
    selected.length === 0 ||
    selected.includes(String(row.getValue(columnId) ?? ""))
  );
}

function ProjectWingMasterDataGridColumnHeader<TData extends object, TValue>({
  accessibleName,
  column,
  copy,
  title,
}: {
  accessibleName?: string;
  column: Column<TData, TValue>;
  copy: DataGridColumnMenuCopy;
  title: string;
}) {
  return (
    <DataGridColumnHeader
      accessibleName={accessibleName}
      column={column}
      filter={
        <DataGridColumnHeaderFilter column={column} copy={copy} title={title} />
      }
      title={title}
    />
  );
}

function ProjectWingMasterDataGrid<TData extends object>({
  locale,
  actions,
  primaryAction,
  footer,
  content,
  columns,
  columnVisibilityCompact = false,
  columnVisibilityIconOnly = false,
  columnVisibilityLabel,
  columnVisibilityPosition = "after-actions",
  compactHiddenColumnIds = EMPTY_COMPACT_HIDDEN_COLUMN_IDS,
  data,
  emptyMessage,
  getRowId,
  initialColumnFilters = EMPTY_COLUMN_FILTERS,
  initialSorting = EMPTY_SORTING,
  initialVisibility,
  isRowSelectable,
  keepRowsAtEnd,
  leadingActions,
  onRowClick,
  onRowSelectionChange,
  overflowLabel,
  paginationPageSize,
  paginationPageSizeLabel,
  paginationPageSizeOptionSuffix,
  paginationPageSizeOptions,
  paginationResetKey,
  persistentActions,
  rowProps,
  rowClassName,
  rowSelection: controlledRowSelection,
  recordCount,
  selectionSummary,
  showRecordCount = true,
  showToolbar = true,
  showRowSelection = true,
  tableLabel,
  tableClassNames,
  tableLayout,
  testId,
  title,
  titleAdornment,
  toolbarTestId,
  trailingActions,
}: ProjectWingMasterDataGridProps<TData>) {
  const copy = getDataGridCopy(locale);
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: paginationPageSize ?? 50,
  });
  const [columnFilters, setColumnFilters] =
    useState<ColumnFiltersState>(initialColumnFilters);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    initialVisibility ?? {}
  );
  const [internalRowSelection, setInternalRowSelection] =
    useState<RowSelectionState>({});
  const rowSelection = controlledRowSelection ?? internalRowSelection;
  const [isCompact, setIsCompact] = useState(false);
  const compactHiddenColumnSignature = compactHiddenColumnIds.join("|");
  const compactHiddenColumns = useMemo(
    () => compactHiddenColumnSignature.split("|").filter(Boolean),
    [compactHiddenColumnSignature]
  );

  const useMountedLayoutEffect =
    typeof window === "undefined" ? useEffect : useLayoutEffect;

  useEffect(() => {
    if (!paginationPageSize) {
      return;
    }
    setPagination({
      pageIndex: 0,
      pageSize: paginationPageSize,
    });
  }, [paginationPageSize]);

  useEffect(() => {
    if (!paginationPageSize) {
      return;
    }
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }, [paginationPageSize, paginationResetKey]);

  useMountedLayoutEffect(() => {
    if (
      !compactHiddenColumnSignature ||
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }
    const query = window.matchMedia("(max-width: 80rem)");
    const sync = () => setIsCompact(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [compactHiddenColumnSignature]);

  const effectiveColumnVisibility = useMemo(
    () =>
      isCompact
        ? getResponsiveColumnVisibility(columnVisibility, compactHiddenColumns)
        : columnVisibility,
    [columnVisibility, compactHiddenColumns, isCompact]
  );
  const tableColumns = useMemo<ColumnDef<TData>[]>(
    () =>
      showRowSelection
        ? [
            {
              id: "select",
              header: () => <DataGridTableRowSelectAll />,
              cell: ({ row }) => <DataGridTableRowSelect row={row} />,
              enableHiding: false,
              enablePinning: false,
              enableResizing: false,
              enableSorting: false,
              size: 36,
            },
            ...columns,
          ]
        : columns,
    [columns, showRowSelection]
  );
  const sortedRowModel = useMemo(
    () =>
      keepRowsAtEnd
        ? getSortedRowModelWithTrailingRows(keepRowsAtEnd)
        : getSortedRowModel<TData>(),
    [keepRowsAtEnd]
  );
  const table = useReactTable({
    // Pagination is controlled below; do not enqueue reset updates during render.
    autoResetPageIndex: false,
    columns: tableColumns,
    data,
    initialState: { columnVisibility: initialVisibility ?? {} },
    enableRowSelection: showRowSelection
      ? isRowSelectable
        ? (row) => isRowSelectable(row.original)
        : true
      : false,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(paginationPageSize
      ? { getPaginationRowModel: getPaginationRowModel() }
      : {}),
    getSortedRowModel: sortedRowModel,
    onColumnFiltersChange: (updater) => {
      setColumnFilters(updater);
      if (paginationPageSize) {
        setPagination((current) => ({ ...current, pageIndex: 0 }));
      }
    },
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: (updater) => {
      const nextSelection =
        typeof updater === "function" ? updater(rowSelection) : updater;
      if (controlledRowSelection === undefined) {
        setInternalRowSelection(nextSelection);
      }
      onRowSelectionChange?.(nextSelection);
    },
    onSortingChange: (updater) => {
      setSorting(updater);
      if (paginationPageSize) {
        setPagination((current) => ({ ...current, pageIndex: 0 }));
      }
    },
    ...(paginationPageSize ? { onPaginationChange: setPagination } : {}),
    state: {
      columnFilters,
      columnVisibility: effectiveColumnVisibility,
      ...(paginationPageSize ? { pagination } : {}),
      rowSelection,
      sorting,
    },
  });
  const filteredRowCount = table.getFilteredRowModel().rows.length;
  const activePageSize = pagination.pageSize;
  const pageCount = paginationPageSize
    ? Math.max(1, Math.ceil(filteredRowCount / activePageSize))
    : 1;
  const safePageIndex = Math.min(pagination.pageIndex, pageCount - 1);

  useEffect(() => {
    if (!paginationPageSize || pagination.pageIndex === safePageIndex) {
      return;
    }
    setPagination((current) => ({
      ...current,
      pageIndex: safePageIndex,
    }));
  }, [pagination.pageIndex, paginationPageSize, safePageIndex]);

  useEffect(() => {
    if (!paginationPageSize || typeof document === "undefined") {
      return;
    }
    const viewport = document.querySelector<HTMLElement>(
      `[data-testid="${testId}"] [data-slot="scroll-area-viewport"]`
    );
    viewport?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
  }, [paginationPageSize, safePageIndex, testId]);
  const columnVisibilityControl = columnVisibilityLabel ? (
    <DataGridColumnVisibility
      locale={locale}
      label={columnVisibilityLabel}
      showChevron={!columnVisibilityIconOnly}
      table={table}
      trigger={
        columnVisibilityIconOnly && columnVisibilityCompact ? (
          <MotionButton
            aria-label={columnVisibilityLabel}
            className="size-6 cursor-pointer rounded-md"
            size="icon"
            variant="secondary"
          >
            <Settings2 aria-hidden="true" className="size-3.5" />
          </MotionButton>
        ) : (
          <Button
            accessibleName={columnVisibilityLabel}
            className={
              !columnVisibilityIconOnly && columnVisibilityCompact
                ? "h-8 gap-1.5 rounded-md px-2.5 text-[0.8rem]! font-semibold!"
                : undefined
            }
            size={
              columnVisibilityIconOnly
                ? "icon-sm"
                : columnVisibilityCompact
                  ? "sm"
                  : "default"
            }
            variant="outline"
          >
            <Settings2
              data-icon={columnVisibilityIconOnly ? undefined : "inline-start"}
            />
            {columnVisibilityIconOnly ? null : columnVisibilityLabel}
          </Button>
        )
      }
    />
  ) : null;

  return (
    <DataGrid
      locale={locale}
      emptyMessage={emptyMessage}
      onRowClick={onRowClick}
      rowProps={rowProps}
      rowClassName={rowClassName}
      recordCount={recordCount ?? table.getFilteredRowModel().rows.length}
      table={table}
      tableClassNames={tableClassNames}
      tableLayout={{
        cellBorder: false,
        headerSticky: true,
        rowRounded: false,
        stripped: false,
        columnsDraggable: false,
        columnsMovable: false,
        columnsPinnable: false,
        columnsResizable: true,
        columnsResizeMode: "onChange",
        columnsVisibility: true,
        rowBorder: true,
        rowsDraggable: false,
        rowsPinnable: false,
        width: "fixed",
        ...tableLayout,
      }}
    >
      <Frame
        className="[&_td]:border-border [&_th]:border-border h-full min-h-0 w-full max-w-full min-w-0 overflow-hidden"
        data-testid={testId}
        dense
        stacked
      >
        {showToolbar ? (
          <ProjectWingDataGridToolbar
            locale={locale}
            primaryAction={primaryAction}
            actions={
              actions || columnVisibilityLabel ? (
                <>
                  {columnVisibilityPosition === "before-actions"
                    ? columnVisibilityControl
                    : null}
                  {actions ?? leadingActions}
                  {columnVisibilityPosition === "after-actions"
                    ? columnVisibilityControl
                    : null}
                  {actions ? null : trailingActions}
                </>
              ) : undefined
            }
            recordCount={recordCount ?? table.getFilteredRowModel().rows.length}
            overflowLabel={overflowLabel ?? copy.moreActions}
            persistentActions={persistentActions}
            selectionSummary={selectionSummary}
            showRecordCount={showRecordCount}
            table={table}
            testId={toolbarTestId}
            title={title}
            titleAdornment={titleAdornment}
          />
        ) : null}
        <FramePanel
          className={cn(
            "min-h-0 p-0 shadow-none",
            showToolbar && "rounded-t-none",
            (footer ||
              (paginationPageSize &&
                ((paginationPageSizeOptions?.length ?? 0) > 0 ||
                  filteredRowCount > activePageSize))) &&
              "rounded-b-none border-b-0"
          )}
        >
          {content ?? (
            <DataGridScrollArea orientation="both" className="h-full min-h-0">
              <DataGridTable label={tableLabel} />
            </DataGridScrollArea>
          )}
        </FramePanel>
        {footer ??
          (paginationPageSize &&
          ((paginationPageSizeOptions?.length ?? 0) > 0 ||
            filteredRowCount > activePageSize) ? (
            <ProjectWingPaginationFooter
              locale={locale}
              label={paginationPageSizeLabel ?? copy.rowsPerPage}
              onPageChange={(nextPage) => table.setPageIndex(nextPage)}
              onPageSizeChange={(nextPageSize) =>
                setPagination({ pageIndex: 0, pageSize: nextPageSize })
              }
              page={safePageIndex}
              pageSize={activePageSize}
              pageSizeOptionSuffix={paginationPageSizeOptionSuffix}
              pageSizeOptions={paginationPageSizeOptions}
              recordCount={filteredRowCount}
            />
          ) : null)}
      </Frame>
    </DataGrid>
  );
}

export {
  ProjectWingMasterDataGrid,
  ProjectWingMasterDataGridColumnHeader,
  ProjectWingPaginationFooter,
  projectWingSelectedValuesFilter,
};
export type {
  DataGridColumnMenuCopy,
  ProjectWingMasterDataGridProps,
  ProjectWingPaginationFooterProps,
};
