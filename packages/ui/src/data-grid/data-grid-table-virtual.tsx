"use client";
"use no memo";

import { flexRender } from "@tanstack/react-table";
import type { Column, Row, Table } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type {
  VirtualItem,
  Virtualizer,
  VirtualizerOptions,
} from "@tanstack/react-virtual";
import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactNode } from "react";

import { ProjectWingLoadingProgress } from "../project-wing-loading-progress";
import { cn } from "../utils";
import { useDataGrid } from "./data-grid";
import {
  DATA_GRID_LAYOUT_RESIZE_END_EVENT,
  DataGridTableBase,
  DataGridTableBody,
  DataGridTableEmpty,
  DataGridTableFillBodyCell,
  DataGridTableFillHeadCell,
  DataGridTableFoot,
  DataGridTableHead,
  DataGridTableHeadRow,
  DataGridTableHeadRowCell,
  DataGridTableHeadRowCellResize,
  DataGridTableRenderedRow,
  DataGridTableRowSpacer,
  DataGridTableViewport,
  getDataGridLayoutResizeRoot,
  getDataGridScrollAreaViewport,
  getDataGridTableMergedHeaderGroups,
  getDataGridTableRowSections,
  getPinningStyles,
  hasDataGridTableRightPinnedColumns,
} from "./data-grid-table";

function observeDataGridVirtualizerRect(
  instance: Virtualizer<HTMLElement, HTMLTableRowElement>,
  callback: (rect: { height: number; width: number }) => void
) {
  const { scrollElement } = instance;
  if (!scrollElement) {
    return;
  }

  const layoutResizeRoot = getDataGridLayoutResizeRoot(scrollElement);
  let hasDeferredMeasurement = false;
  const measure = () => {
    if (layoutResizeRoot?.dataset.dataGridLayoutResizing === "true") {
      hasDeferredMeasurement = true;
      return;
    }
    callback({
      height: scrollElement.offsetHeight,
      width: scrollElement.offsetWidth,
    });
  };
  const flushDeferredMeasurement = () => {
    if (!hasDeferredMeasurement) {
      return;
    }
    hasDeferredMeasurement = false;
    measure();
  };

  measure();
  if (typeof ResizeObserver === "undefined") {
    return;
  }
  const observer = new ResizeObserver(measure);
  observer.observe(scrollElement);
  layoutResizeRoot?.addEventListener(
    DATA_GRID_LAYOUT_RESIZE_END_EVENT,
    flushDeferredMeasurement
  );

  return () => {
    observer.disconnect();
    layoutResizeRoot?.removeEventListener(
      DATA_GRID_LAYOUT_RESIZE_END_EVENT,
      flushDeferredMeasurement
    );
  };
}

type DataGridTableVirtualScrollElements = {
  containerElement: HTMLDivElement | null;
  scrollElement: HTMLElement | null;
};

type DataGridTableVirtualizerInstance = Virtualizer<
  HTMLElement,
  HTMLTableRowElement
>;

type DataGridTableVirtualScrollAlignment = "auto" | "center" | "start" | "end";

type DataGridTableVirtualScrollRequest = {
  align: DataGridTableVirtualScrollAlignment;
  behavior: ScrollBehavior;
  containerElement: HTMLDivElement;
  headerSticky: boolean;
  isVirtualizationEnabled: boolean;
  rowId: string | undefined;
  rowIndex: number;
  scrollElement: HTMLElement;
};

function isSameDataGridTableScrollRequest(
  previous: DataGridTableVirtualScrollRequest | null,
  next: DataGridTableVirtualScrollRequest
) {
  return (
    previous?.align === next.align &&
    previous.behavior === next.behavior &&
    previous.containerElement === next.containerElement &&
    previous.headerSticky === next.headerSticky &&
    previous.isVirtualizationEnabled === next.isVirtualizationEnabled &&
    previous.rowId === next.rowId &&
    previous.rowIndex === next.rowIndex &&
    previous.scrollElement === next.scrollElement
  );
}

function getDataGridTableScrollTarget({
  align,
  clientHeight,
  rowBottom,
  rowHeight,
  rowTop,
  scrollHeight,
  scrollTop,
  viewportTopOffset = 0,
}: {
  align: DataGridTableVirtualScrollAlignment;
  clientHeight: number;
  rowBottom: number;
  rowHeight: number;
  rowTop: number;
  scrollHeight: number;
  scrollTop: number;
  viewportTopOffset?: number;
}) {
  const visibleHeight = Math.max(0, clientHeight - viewportTopOffset);
  const viewportTop = scrollTop + viewportTopOffset;
  const viewportBottom = scrollTop + clientHeight;
  const targetTop =
    align === "auto"
      ? rowTop < viewportTop
        ? rowTop - viewportTopOffset
        : rowBottom > viewportBottom
          ? rowBottom - clientHeight
          : null
      : align === "start"
        ? rowTop - viewportTopOffset
        : align === "end"
          ? rowBottom - clientHeight
          : rowTop -
            viewportTopOffset -
            Math.max(0, (visibleHeight - rowHeight) / 2);

  if (targetTop === null) {
    return null;
  }

  return Math.min(
    Math.max(0, targetTop),
    Math.max(0, scrollHeight - clientHeight)
  );
}

function getDataGridTableHeaderOffset({
  containerElement,
  headerSticky,
  scrollElement,
}: {
  containerElement: HTMLDivElement;
  headerSticky: boolean;
  scrollElement: HTMLElement;
}) {
  if (!headerSticky) {
    return 0;
  }

  const headerElement = containerElement.querySelector<HTMLElement>(
    ':scope > [data-slot="data-grid-table"] > thead'
  );

  if (!headerElement) {
    return 0;
  }

  const scrollRect = scrollElement.getBoundingClientRect();
  const headerRect = headerElement.getBoundingClientRect();
  const headerBottomOffset = headerRect.bottom - scrollRect.top;
  const overlapsViewportTop =
    headerRect.top <= scrollRect.top + 0.5 && headerBottomOffset > 0;

  if (!overlapsViewportTop) {
    return 0;
  }

  return Math.min(scrollElement.clientHeight, Math.max(0, headerBottomOffset));
}

function scrollDataGridTableToOffset({
  behavior,
  scrollElement,
  targetTop,
  virtualizer,
}: {
  behavior: ScrollBehavior;
  scrollElement: HTMLElement;
  targetTop: number;
  virtualizer?: DataGridTableVirtualizerInstance;
}) {
  if (virtualizer) {
    virtualizer.scrollToOffset(targetTop, { align: "start", behavior });
  } else if (typeof scrollElement.scrollTo === "function") {
    scrollElement.scrollTo({ behavior, top: targetTop });
  } else {
    scrollElement.scrollTop = targetTop;
  }
}

function scrollDataGridTableRowIntoView({
  align,
  behavior,
  cancelPendingScroll = false,
  containerElement,
  headerSticky,
  rowIndex,
  scrollElement,
  virtualizer,
}: {
  align: DataGridTableVirtualScrollAlignment;
  behavior: ScrollBehavior;
  cancelPendingScroll?: boolean;
  containerElement: HTMLDivElement | null;
  headerSticky: boolean;
  rowIndex: number;
  scrollElement: HTMLElement | null;
  virtualizer?: DataGridTableVirtualizerInstance;
}) {
  if (!containerElement || !scrollElement) {
    return false;
  }

  const rowElement = containerElement.querySelector<HTMLTableRowElement>(
    `:scope > [data-slot="data-grid-table"] > tbody > tr[data-index="${rowIndex}"]`
  );

  if (!rowElement) {
    return false;
  }

  const scrollRect = scrollElement.getBoundingClientRect();
  const rowRect = rowElement.getBoundingClientRect();
  const viewportTopOffset = getDataGridTableHeaderOffset({
    containerElement,
    headerSticky,
    scrollElement,
  });
  const rowTop = scrollElement.scrollTop + rowRect.top - scrollRect.top;
  const rowBottom = scrollElement.scrollTop + rowRect.bottom - scrollRect.top;
  const targetTop = getDataGridTableScrollTarget({
    align,
    clientHeight: scrollElement.clientHeight,
    rowBottom,
    rowHeight: rowRect.height || rowElement.offsetHeight,
    rowTop,
    scrollHeight: scrollElement.scrollHeight,
    scrollTop: scrollElement.scrollTop,
    viewportTopOffset,
  });

  if (
    targetTop === null ||
    Math.abs(targetTop - scrollElement.scrollTop) < 0.5
  ) {
    if (cancelPendingScroll) {
      scrollDataGridTableToOffset({
        behavior: "auto",
        scrollElement,
        targetTop: scrollElement.scrollTop,
        virtualizer,
      });
    }

    return true;
  }

  scrollDataGridTableToOffset({
    behavior,
    scrollElement,
    targetTop,
    virtualizer,
  });

  return true;
}

type DataGridTableVirtualizerOptions<TData> = Partial<
  Omit<
    VirtualizerOptions<HTMLElement, HTMLTableRowElement>,
    "count" | "estimateSize" | "getItemKey" | "getScrollElement"
  >
> & {
  estimateSize?: (index: number, row: Row<TData>) => number;
  getItemKey?: (index: number, row: Row<TData>) => string | number;
  getScrollElement?: (
    elements: DataGridTableVirtualScrollElements
  ) => HTMLElement | null;
};

interface DataGridTableVirtualProps<TData> {
  height?: number | string;
  estimateSize?: number;
  overscan?: number;
  /** Scroll animation used when revealing a controlled target row. */
  scrollBehavior?: ScrollBehavior;
  /** Alignment used when revealing a controlled target row. Defaults to auto. */
  scrollToRowAlign?: DataGridTableVirtualScrollAlignment;
  /** Index within the center (non-pinned) row section to reveal. */
  scrollToRowIndex?: number;
  footerContent?: ReactNode;
  /** Replaces the standard table header while retaining virtualized rows. */
  headerContent?: ReactNode;
  /** Wraps virtualized rows, for example with a SortableContext. */
  wrapBody?: (body: ReactNode) => ReactNode;
  /** Renders a virtualized table row while retaining the shared viewport. */
  renderRow?: DataGridTableVirtualRowRenderer<TData>;
  /** Replaces the empty-state table row. */
  renderEmptyState?: () => ReactNode;
  /** Appends rows after virtualized data, for example a drop target. */
  bodyFooter?: ReactNode;
  renderHeader?: boolean;
  onFetchMore?: () => void;
  isFetchingMore?: boolean;
  hasMore?: boolean;
  fetchMoreOffset?: number;
  visibleRowCount?: number;
  virtualizerOptions?: DataGridTableVirtualizerOptions<TData>;
}

type DataGridTableVirtualRowRenderer<TData> = (input: {
  pinnedBoundary?: "bottom" | "top";
  row: Row<TData>;
  rowIndex: number;
  rowRef?: (element: HTMLTableRowElement | null) => void;
}) => ReactNode;

interface VirtualBodyProps<TData> {
  table: Table<TData>;
  topRows: Row<TData>[];
  centerRows: Row<TData>[];
  bottomRows: Row<TData>[];
  virtualItems: VirtualItem[];
  totalSize: number;
  isVirtualizationEnabled: boolean;
  isInfiniteMode: boolean;
  isFetchingMore: boolean;
  hasMore?: boolean;
  allRowsLoadedMessage: ReactNode;
  measureRowRef?: (element: HTMLTableRowElement | null) => void;
  renderEmptyState?: () => ReactNode;
  renderRow?: DataGridTableVirtualRowRenderer<TData>;
}

function DataGridTableVirtualPinnedPlaceholderCell<TData>({
  column,
}: {
  column: Column<TData>;
}) {
  const { props } = useDataGrid();
  const isPinned = column.getIsPinned();
  const isLastLeftPinned =
    isPinned === "left" && column.getIsLastColumn("left");
  const isFirstRightPinned =
    isPinned === "right" && column.getIsFirstColumn("right");

  return (
    <td
      aria-hidden="true"
      style={{
        ...(props.tableLayout?.columnsPinnable &&
          column.getCanPin() &&
          getPinningStyles(column)),
        ...(props.tableLayout?.columnsResizable && {
          width: `calc(var(--col-${column.id}-size) * 1px)`,
        }),
      }}
      data-pinned={isPinned || undefined}
      data-last-col={
        isLastLeftPinned ? "left" : isFirstRightPinned ? "right" : undefined
      }
      className={cn(
        "p-0",
        props.tableLayout?.cellBorder && "border-e",
        props.tableLayout?.columnsPinnable &&
          column.getCanPin() &&
          "data-pinned:bg-card data-pinned:isolate [&[data-pinned=left][data-last-col=left]]:shadow-[inset_-1px_0_0_0_var(--border)] [&[data-pinned=right][data-last-col=right]]:shadow-[inset_1px_0_0_0_var(--border)]"
      )}
    />
  );
}

function DataGridTableVirtualUtilityRow<TData>({
  table,
  children,
  centerCellClassName,
  centerCellStyle,
  rowClassName,
  ariaHidden,
}: {
  table: Table<TData>;
  children: ReactNode;
  centerCellClassName?: string;
  centerCellStyle?: CSSProperties;
  rowClassName?: string;
  ariaHidden?: boolean;
}) {
  const { props } = useDataGrid();
  const leftVisibleColumns = table.getLeftVisibleLeafColumns();
  const centerVisibleColumns = table.getCenterVisibleLeafColumns();
  const rightVisibleColumns = table.getRightVisibleLeafColumns();
  const hasRightPinnedColumns = hasDataGridTableRightPinnedColumns(table);

  return (
    <tr aria-hidden={ariaHidden || undefined} className={rowClassName}>
      {leftVisibleColumns.map((column) => (
        <DataGridTableVirtualPinnedPlaceholderCell
          column={column}
          key={column.id}
        />
      ))}
      <td
        colSpan={Math.max(centerVisibleColumns.length, 1)}
        className={centerCellClassName}
        style={centerCellStyle}
      >
        {children}
      </td>
      {props.tableLayout?.columnsResizable && hasRightPinnedColumns ? (
        <DataGridTableFillBodyCell />
      ) : null}
      {rightVisibleColumns.map((column) => (
        <DataGridTableVirtualPinnedPlaceholderCell
          column={column}
          key={column.id}
        />
      ))}
      {props.tableLayout?.columnsResizable && !hasRightPinnedColumns ? (
        <DataGridTableFillBodyCell />
      ) : null}
    </tr>
  );
}

function DataGridTableVirtualSpacer<TData>({
  table,
  height,
}: {
  table: Table<TData>;
  height: number;
}) {
  if (height <= 0) {
    return null;
  }

  return (
    <DataGridTableVirtualUtilityRow
      table={table}
      ariaHidden
      centerCellClassName="p-0"
      centerCellStyle={{ height, padding: 0 }}
    >
      {null}
    </DataGridTableVirtualUtilityRow>
  );
}

function DataGridTableVirtualStatusRow<TData>({
  table,
  children,
  className,
}: {
  table: Table<TData>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <DataGridTableVirtualUtilityRow
      table={table}
      centerCellClassName={cn(
        "text-muted-foreground py-4 text-center text-sm",
        className
      )}
    >
      {children}
    </DataGridTableVirtualUtilityRow>
  );
}

function DataGridTableVirtualBody<TData>({
  table,
  topRows,
  centerRows,
  bottomRows,
  virtualItems,
  totalSize,
  isVirtualizationEnabled,
  isInfiniteMode,
  isFetchingMore,
  hasMore,
  allRowsLoadedMessage,
  measureRowRef,
  renderEmptyState,
  renderRow,
}: VirtualBodyProps<TData>) {
  const { isLoading } = useDataGrid();
  const totalRows = topRows.length + centerRows.length + bottomRows.length;

  if (!totalRows) {
    // Initial load must not flash the empty state as if the query returned
    // Nothing.
    if (isLoading) {
      return (
        <DataGridTableVirtualStatusRow table={table}>
          <ProjectWingLoadingProgress />
        </DataGridTableVirtualStatusRow>
      );
    }

    return renderEmptyState?.() ?? <DataGridTableEmpty />;
  }

  const hasCenterRows = centerRows.length > 0;
  const showFetchingRow = isInfiniteMode && isFetchingMore;
  const showCompleteRow = isInfiniteMode && hasMore === false && totalRows > 0;
  const hasMiddleSection = hasCenterRows || showFetchingRow || showCompleteRow;
  const leadingSpacerHeight =
    isVirtualizationEnabled && hasCenterRows && virtualItems.length > 0
      ? (virtualItems[0]?.start ?? 0)
      : 0;
  const trailingSpacerHeight =
    isVirtualizationEnabled && hasCenterRows && virtualItems.length > 0
      ? Math.max(
          0,
          totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0)
        )
      : 0;
  const renderedRows: ReactNode[] = [];
  const appendRow = ({
    row,
    rowIndex,
    rowRef,
    pinnedBoundary,
  }: {
    pinnedBoundary?: "bottom" | "top";
    row: Row<TData>;
    rowIndex: number;
    rowRef?: (element: HTMLTableRowElement | null) => void;
  }) => {
    renderedRows.push(
      renderRow ? (
        <Fragment key={row.id}>
          {renderRow({ row, rowIndex, rowRef, pinnedBoundary })}
        </Fragment>
      ) : (
        <DataGridTableRenderedRow
          key={row.id}
          pinnedBoundary={pinnedBoundary}
          row={row}
          rowIndex={rowIndex}
          rowRef={rowRef}
        />
      )
    );
  };

  topRows.forEach((row, index) => {
    appendRow({
      row,
      rowIndex: index,
      pinnedBoundary:
        index === topRows.length - 1 && hasMiddleSection ? "top" : undefined,
    });
  });

  if (isVirtualizationEnabled) {
    if (leadingSpacerHeight > 0) {
      renderedRows.push(
        <DataGridTableVirtualSpacer
          key="virtual-spacer-start"
          table={table}
          height={leadingSpacerHeight}
        />
      );
    }

    virtualItems.forEach((virtualRow) => {
      const row = centerRows[virtualRow.index];

      if (!row) {
        return;
      }

      appendRow({
        row,
        rowIndex: virtualRow.index,
        rowRef: measureRowRef,
      });
    });

    if (trailingSpacerHeight > 0) {
      renderedRows.push(
        <DataGridTableVirtualSpacer
          key="virtual-spacer-end"
          table={table}
          height={trailingSpacerHeight}
        />
      );
    }
  } else {
    centerRows.forEach((row, rowIndex) => {
      appendRow({ row, rowIndex });
    });
  }

  if (showFetchingRow) {
    renderedRows.push(
      <DataGridTableVirtualStatusRow key="virtual-status-loading" table={table}>
        <ProjectWingLoadingProgress />
      </DataGridTableVirtualStatusRow>
    );
  }

  if (showCompleteRow) {
    renderedRows.push(
      <DataGridTableVirtualStatusRow
        key="virtual-status-complete"
        table={table}
        className="py-3 text-xs"
      >
        {allRowsLoadedMessage}
      </DataGridTableVirtualStatusRow>
    );
  }

  bottomRows.forEach((row, index) => {
    appendRow({
      row,
      rowIndex: index,
      pinnedBoundary:
        index === 0 && (topRows.length > 0 || hasMiddleSection)
          ? "bottom"
          : undefined,
    });
  });

  return renderedRows;
}

/**
 * Memoized virtual body: skip re-renders during active column resize.
 * Column widths update via CSS variables on the <table> element,
 * so the browser handles width changes without React re-renders.
 */
const MemoizedVirtualBody = memo(DataGridTableVirtualBody, (_prev, next) =>
  Boolean(next.table.getState().columnSizingInfo.isResizingColumn)
) as typeof DataGridTableVirtualBody;

function DataGridTableVirtual<TData>({
  height,
  estimateSize = 48,
  overscan = 10,
  scrollBehavior = "auto",
  scrollToRowAlign = "auto",
  scrollToRowIndex,
  footerContent,
  headerContent,
  wrapBody,
  renderRow,
  renderEmptyState,
  bodyFooter,
  renderHeader = true,
  onFetchMore,
  isFetchingMore = false,
  hasMore,
  fetchMoreOffset = 0,
  visibleRowCount,
  virtualizerOptions,
}: DataGridTableVirtualProps<TData>) {
  const { table, props } = useDataGrid();
  const mergedHeaderGroups = getDataGridTableMergedHeaderGroups(table);
  const hasRightPinnedColumns = hasDataGridTableRightPinnedColumns(table);
  const {
    topRows,
    centerRows: allCenterRows,
    bottomRows,
  } = getDataGridTableRowSections(table, props.tableLayout?.rowsPinnable);
  const centerRows =
    visibleRowCount === undefined
      ? allCenterRows
      : allCenterRows.slice(0, visibleRowCount);
  const isInfiniteMode = typeof onFetchMore === "function";
  const [viewportElements, setViewportElements] =
    useState<DataGridTableVirtualScrollElements>({
      containerElement: null,
      scrollElement: null,
    });
  const {
    estimateSize: customEstimateSize,
    getItemKey: customGetItemKey,
    getScrollElement: customGetScrollElement,
    measureElement: customMeasureElement,
    observeElementRect: customObserveElementRect,
    overscan: customOverscan,
    ...virtualizerOptionsRest
  } = virtualizerOptions ?? {};
  const isVirtualizationEnabled = virtualizerOptions?.enabled !== false;
  const allRowsLoadedMessage =
    props.allRowsLoadedMessage || "All records loaded";
  const resolvedHeaderContent =
    headerContent ??
    (renderHeader ? (
      <DataGridTableHead>
        {mergedHeaderGroups.map((headerGroup) => (
          <DataGridTableHeadRow key={headerGroup.id} rowId={headerGroup.id}>
            {headerGroup.headers
              .filter((header) => header.column.getIsPinned() !== "right")
              .map((header) => {
                const { column } = header;

                return (
                  <DataGridTableHeadRowCell header={header} key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    {props.tableLayout?.columnsResizable &&
                      column.getCanResize() && (
                        <DataGridTableHeadRowCellResize header={header} />
                      )}
                  </DataGridTableHeadRowCell>
                );
              })}
            {props.tableLayout?.columnsResizable && hasRightPinnedColumns ? (
              <DataGridTableFillHeadCell />
            ) : null}
            {headerGroup.headers
              .filter((header) => header.column.getIsPinned() === "right")
              .map((header) => {
                const { column } = header;

                return (
                  <DataGridTableHeadRowCell header={header} key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    {props.tableLayout?.columnsResizable &&
                      column.getCanResize() && (
                        <DataGridTableHeadRowCellResize header={header} />
                      )}
                  </DataGridTableHeadRowCell>
                );
              })}
            {props.tableLayout?.columnsResizable && !hasRightPinnedColumns ? (
              <DataGridTableFillHeadCell />
            ) : null}
          </DataGridTableHeadRow>
        ))}
      </DataGridTableHead>
    ) : null);
  const handleViewportRef = useCallback((node: HTMLDivElement | null) => {
    setViewportElements({
      containerElement: node,
      scrollElement: node
        ? (getDataGridScrollAreaViewport(node) ?? node)
        : null,
    });
  }, []);
  const usesExternalScrollArea =
    viewportElements.scrollElement !== null &&
    viewportElements.scrollElement !== viewportElements.containerElement;
  const resolveScrollElement = useCallback(() => {
    if (customGetScrollElement) {
      return customGetScrollElement(viewportElements);
    }

    return viewportElements.scrollElement;
  }, [customGetScrollElement, viewportElements]);
  const resolveItemKey = useCallback(
    (index: number) => {
      const row = centerRows[index];

      if (!row) {
        return index;
      }

      return customGetItemKey?.(index, row) ?? row.id ?? index;
    },
    [centerRows, customGetItemKey]
  );
  const resolveEstimateSize = useCallback(
    (index: number) => {
      const row = centerRows[index];

      return row
        ? (customEstimateSize?.(index, row) ?? estimateSize)
        : estimateSize;
    },
    [centerRows, customEstimateSize, estimateSize]
  );
  const virtualizer = useVirtualizer({
    count: centerRows.length,
    getScrollElement: resolveScrollElement,
    getItemKey: resolveItemKey,
    estimateSize: resolveEstimateSize,
    overscan: customOverscan ?? overscan,
    measureElement: customMeasureElement,
    observeElementRect:
      customObserveElementRect ?? observeDataGridVirtualizerRect,
    ...virtualizerOptionsRest,
  }) as DataGridTableVirtualizerInstance;
  const virtualItems = isVirtualizationEnabled
    ? virtualizer.getVirtualItems()
    : [];
  const totalSize = isVirtualizationEnabled ? virtualizer.getTotalSize() : 0;
  const measureRowRef =
    isVirtualizationEnabled && customMeasureElement
      ? virtualizer.measureElement
      : undefined;
  const resolvedFetchMoreOffset = Math.max(0, fetchMoreOffset);
  const scrollToRowId =
    scrollToRowIndex === undefined
      ? undefined
      : centerRows[scrollToRowIndex]?.id;
  const scrollToRowVirtualItem =
    isVirtualizationEnabled && scrollToRowIndex !== undefined
      ? virtualItems.find((item) => item.index === scrollToRowIndex)
      : undefined;
  const pendingScrollToRowIndexRef = useRef<number | null>(null);
  const lastScrollRequestRef = useRef<DataGridTableVirtualScrollRequest | null>(
    null
  );
  // Latch onFetchMore per row count: virtualItems gets a new identity every
  // Scroll frame, so without it the effect fires duplicate page requests
  // Before the consumer flips isFetchingMore, and loops at end-of-data when
  // HasMore is never set.
  const fetchMoreFiredAtCountRef = useRef<number | null>(null);

  // Resolve after every commit so a stable getter can expose a replaced ref;
  // The request signature prevents duplicate scrolling on ordinary renders.
  const lastVirtualItemIndex = virtualItems[virtualItems.length - 1]?.index;

  useEffect(() => {
    const previousRequest = lastScrollRequestRef.current;

    if (
      scrollToRowIndex === undefined ||
      scrollToRowIndex < 0 ||
      scrollToRowIndex >= centerRows.length
    ) {
      pendingScrollToRowIndexRef.current = null;
      lastScrollRequestRef.current = null;

      if (previousRequest) {
        const scrollElement = resolveScrollElement();

        if (scrollElement) {
          scrollDataGridTableToOffset({
            behavior: "auto",
            scrollElement,
            targetTop: scrollElement.scrollTop,
            virtualizer: isVirtualizationEnabled ? virtualizer : undefined,
          });
        }
      }

      return;
    }

    const scrollElement = resolveScrollElement();
    const { containerElement } = viewportElements;
    if (!containerElement || !scrollElement) {
      return;
    }

    const headerSticky =
      renderHeader && Boolean(props.tableLayout?.headerSticky);
    const nextRequest: DataGridTableVirtualScrollRequest = {
      align: scrollToRowAlign,
      behavior: scrollBehavior,
      containerElement,
      headerSticky,
      isVirtualizationEnabled,
      rowId: scrollToRowId,
      rowIndex: scrollToRowIndex,
      scrollElement,
    };

    if (isSameDataGridTableScrollRequest(previousRequest, nextRequest)) {
      return;
    }

    pendingScrollToRowIndexRef.current = null;

    const rowWasHandled = scrollDataGridTableRowIntoView({
      align: scrollToRowAlign,
      behavior: scrollBehavior,
      cancelPendingScroll: previousRequest !== null,
      containerElement,
      headerSticky,
      rowIndex: scrollToRowIndex,
      scrollElement,
      virtualizer: isVirtualizationEnabled ? virtualizer : undefined,
    });

    if (rowWasHandled) {
      lastScrollRequestRef.current = nextRequest;
      return;
    }

    if (!isVirtualizationEnabled) {
      return;
    }

    pendingScrollToRowIndexRef.current = scrollToRowIndex;
    lastScrollRequestRef.current = nextRequest;
    virtualizer.scrollToIndex(scrollToRowIndex, {
      align: scrollToRowAlign,
      behavior: scrollBehavior,
    });
  });

  useEffect(() => {
    if (
      !isVirtualizationEnabled ||
      scrollToRowIndex === undefined ||
      pendingScrollToRowIndexRef.current !== scrollToRowIndex ||
      !scrollToRowVirtualItem
    ) {
      return;
    }

    const rowWasHandled = scrollDataGridTableRowIntoView({
      align: scrollToRowAlign,
      behavior: "auto",
      cancelPendingScroll: true,
      containerElement: viewportElements.containerElement,
      headerSticky: renderHeader && Boolean(props.tableLayout?.headerSticky),
      rowIndex: scrollToRowIndex,
      scrollElement: resolveScrollElement(),
      virtualizer,
    });

    if (rowWasHandled) {
      pendingScrollToRowIndexRef.current = null;
    }
  }, [
    isVirtualizationEnabled,
    props.tableLayout?.headerSticky,
    renderHeader,
    resolveScrollElement,
    scrollToRowAlign,
    scrollToRowIndex,
    scrollToRowVirtualItem,
    virtualizer,
    viewportElements.containerElement,
  ]);

  useEffect(() => {
    if (
      !isVirtualizationEnabled ||
      !isInfiniteMode ||
      hasMore === false ||
      isFetchingMore
    ) {
      return;
    }

    if (lastVirtualItemIndex === undefined) {
      return;
    }

    if (fetchMoreFiredAtCountRef.current === centerRows.length) {
      return;
    }

    if (
      lastVirtualItemIndex >=
      centerRows.length - 1 - resolvedFetchMoreOffset
    ) {
      fetchMoreFiredAtCountRef.current = centerRows.length;
      onFetchMore?.();
    }
  }, [
    centerRows.length,
    hasMore,
    isFetchingMore,
    isInfiniteMode,
    isVirtualizationEnabled,
    onFetchMore,
    resolvedFetchMoreOffset,
    lastVirtualItemIndex,
  ]);

  const virtualBody = (
    <MemoizedVirtualBody
      allRowsLoadedMessage={allRowsLoadedMessage}
      bottomRows={bottomRows}
      centerRows={centerRows}
      hasMore={hasMore}
      isFetchingMore={isFetchingMore}
      isInfiniteMode={isInfiniteMode}
      isVirtualizationEnabled={isVirtualizationEnabled}
      measureRowRef={measureRowRef}
      renderEmptyState={renderEmptyState}
      renderRow={renderRow}
      table={table}
      topRows={topRows}
      totalSize={totalSize}
      virtualItems={virtualItems}
    />
  );

  return (
    <DataGridTableViewport
      viewportRef={handleViewportRef}
      className={usesExternalScrollArea ? undefined : "block"}
      style={
        usesExternalScrollArea
          ? undefined
          : {
              height,
              overflow: "auto",
              position: "relative",
              // Standalone mode: this node IS the scroll container, so it
              // Must stay at its parent's width (not the resizable table
              // Width) or horizontal scrolling becomes impossible.
              width: "auto",
            }
      }
    >
      <DataGridTableBase>
        {resolvedHeaderContent}

        {resolvedHeaderContent &&
          (props.tableLayout?.stripped || !props.tableLayout?.rowBorder) && (
            <DataGridTableRowSpacer />
          )}

        <DataGridTableBody>
          {wrapBody ? wrapBody(virtualBody) : virtualBody}
          {bodyFooter}
        </DataGridTableBody>

        {footerContent && (
          <DataGridTableFoot>{footerContent}</DataGridTableFoot>
        )}
      </DataGridTableBase>
    </DataGridTableViewport>
  );
}

export { DataGridTableVirtual };
export type {
  DataGridTableVirtualScrollAlignment,
  DataGridTableVirtualProps,
  DataGridTableVirtualRowRenderer,
  DataGridTableVirtualScrollElements,
  DataGridTableVirtualizerOptions,
};
