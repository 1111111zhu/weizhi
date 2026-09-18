"use client";
"use no memo";

import { flexRender } from "@tanstack/react-table";
import type { Cell, Column, Header, Row, Table } from "@tanstack/react-table";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import type {
  CSSProperties,
  ComponentPropsWithoutRef,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  TouchEvent as ReactTouchEvent,
  Ref,
  RefObject,
} from "react";

import { Checkbox } from "../checkbox";
import { CollectionState } from "../collection-state";
import { cn } from "../utils";
import { getColumnHeaderLabel, useDataGrid } from "./data-grid";
import {
  getDataGridColumnResizeCompensation,
  getDataGridColumnResizeMaxDeltaPercentage,
} from "./data-grid-column-resize";
import { getDataGridCopy } from "./data-grid-copy";

// Static spacing lookups; called once per cell, so they stay plain string
// Picks instead of runtime variant machinery.
const headerCellSpacingVariants = ({ size }: { size?: "dense" | "default" }) =>
  size === "dense" ? "px-2 h-8" : "px-3";
const bodyCellSpacingVariants = ({ size }: { size?: "dense" | "default" }) =>
  size === "dense" ? "px-2 py-1.5" : "px-3 py-2";
const footerCellSpacingVariants = ({ size }: { size?: "dense" | "default" }) =>
  size === "dense" ? "px-2 py-1.5" : "px-3 py-2";
/**
 * A parent layout may set this attribute while it moves panels outside React.
 * Grid measurement is deferred until the matching event so a horizontal
 * workbench resize cannot restart column sizing for every pointer frame.
 */
const DATA_GRID_LAYOUT_RESIZE_END_EVENT = "data-grid-layout-resize-end";
const DATA_GRID_LAYOUT_RESIZE_ROOT_ATTRIBUTE = "data-data-grid-layout-root";

function getDataGridLayoutResizeRoot(node: HTMLElement) {
  return node.closest<HTMLElement>(
    `[${DATA_GRID_LAYOUT_RESIZE_ROOT_ATTRIBUTE}]`
  );
}

function getPinningStyles<TData>(column: Column<TData>): CSSProperties {
  const isPinned = column.getIsPinned();

  return {
    // Logical offsets: TanStack's "left"/"right" buckets are start/end
    // Semantics, so pinned columns stick to the correct edge in RTL too
    // (identical to left/right in LTR).
    insetInlineStart:
      isPinned === "left" ? `${column.getStart("left")}px` : undefined,
    insetInlineEnd:
      isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
    position: isPinned ? "sticky" : undefined,
    transform: isPinned ? "translateZ(0)" : undefined,
    contain: isPinned ? "paint" : undefined,
    width: column.getSize(),
    zIndex: isPinned ? 30 : undefined,
    backgroundClip: isPinned ? "padding-box" : undefined,
  };
}

// Shared indent contract for tree rows: DataGridTableRowExpand consumes it,
// And fully custom cells can reuse it for depth alignment without the
// Built-in toggle.
function getDataGridTreeIndentStyle<TData>(
  row: Row<TData>,
  indent = 20
): CSSProperties {
  return {
    "--data-grid-tree-padding": `${row.depth * indent}px`,
  } as CSSProperties;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) {
    return;
  }

  if (typeof ref === "function") {
    ref(value);
    return;
  }

  (ref as { current: T | null }).current = value;
}

/**
 * Nearest scroll-area viewport that belongs to THIS grid. A viewport outside
 * the grid's own container (e.g. a page-level ScrollArea) would make the
 * width measurement - and the virtualizer - bind the wrong box.
 */
function getDataGridScrollAreaViewport(node: HTMLElement): HTMLElement | null {
  const scrollViewport = node.closest(
    '[data-slot="scroll-area-viewport"]'
  ) as HTMLElement | null;

  if (!scrollViewport) {
    return null;
  }

  const gridContainer = node.closest('[data-slot="data-grid"]');
  if (gridContainer && !gridContainer.contains(scrollViewport)) {
    return null;
  }

  return scrollViewport;
}

type DataGridResizeStartEvent =
  | ReactMouseEvent<HTMLDivElement>
  | ReactTouchEvent<HTMLDivElement>;

type DataGridResizeDocumentEvent =
  | globalThis.MouseEvent
  | globalThis.TouchEvent;

function isDataGridTouchEvent(
  event: DataGridResizeStartEvent | DataGridResizeDocumentEvent
): event is ReactTouchEvent<HTMLDivElement> | globalThis.TouchEvent {
  return "touches" in event;
}

type DataGridTouchListLike = {
  length: number;
  item: (index: number) => { identifier: number; clientX: number } | null;
};

function findTouchClientX(list: DataGridTouchListLike, identifier: number) {
  for (let i = 0; i < list.length; i += 1) {
    const touch = list.item(i);
    if (touch && touch.identifier === identifier) {
      return touch.clientX;
    }
  }
}

function getDataGridResizeEventClientX(
  event: DataGridResizeStartEvent | DataGridResizeDocumentEvent,
  touchIdentifier?: number
) {
  if (isDataGridTouchEvent(event)) {
    if (typeof touchIdentifier === "number") {
      return (
        findTouchClientX(event.touches, touchIdentifier) ??
        findTouchClientX(event.changedTouches, touchIdentifier)
      );
    }

    return event.touches[0]?.clientX ?? event.changedTouches[0]?.clientX;
  }

  return event.clientX;
}

function getDataGridColumnResizeViewportWidth(element: HTMLElement) {
  const tableViewport = element.closest<HTMLElement>(
    '[data-slot="data-grid-table-viewport"]'
  );
  if (!tableViewport) {
    return;
  }

  const measurementTarget =
    getDataGridScrollAreaViewport(tableViewport) ?? tableViewport.parentElement;
  const viewportWidth = measurementTarget?.clientWidth;
  return typeof viewportWidth === "number" && viewportWidth > 0
    ? viewportWidth
    : undefined;
}

function getDataGridResizeCompensationColumns<TData>(
  table: Table<TData>,
  resizedColumnIds: Set<string>
) {
  const visibleColumns = table.getVisibleLeafColumns();
  const lastResizedIndex = visibleColumns.reduce(
    (lastIndex, column, index) =>
      resizedColumnIds.has(column.id) ? index : lastIndex,
    -1
  );

  return visibleColumns
    .slice(lastResizedIndex + 1)
    .filter((column) => column.getCanResize())
    .map((column) => ({
      id: column.id,
      minSize: column.columnDef.minSize ?? 20,
      size: column.getSize(),
    }))
    .filter((column) => column.size > column.minSize);
}

function startDataGridColumnResize<TData>(
  event: DataGridResizeStartEvent,
  header: Header<TData, unknown>,
  table: Table<TData>,
  resizeMode: "onChange" | "onEnd"
): (() => void) | undefined {
  const column = table.getColumn(header.column.id);

  if (!column || !column.getCanResize()) {
    return;
  }
  const isTouchSession = isDataGridTouchEvent(event);
  if (isTouchSession && event.touches.length > 1) {
    return;
  }

  event.persist?.();

  const { ownerDocument } = event.currentTarget;
  const ownerWindow = ownerDocument.defaultView;
  const previousBodyCursor = ownerDocument.body.style.cursor;
  const previousDocumentCursor = ownerDocument.documentElement.style.cursor;
  const startSize = header.getSize();
  // Track the initiating finger so a second touch cannot move or commit the
  // Resize with the wrong clientX.
  const touchIdentifier = isTouchSession
    ? event.touches[0]?.identifier
    : undefined;
  const dragStartClientX = getDataGridResizeEventClientX(
    event,
    touchIdentifier
  );
  const headerCell = event.currentTarget.closest("th");
  const headerRect = headerCell?.getBoundingClientRect();
  const startOffset =
    headerRect &&
    Number.isFinite(
      table.options.columnResizeDirection === "rtl"
        ? headerRect.left
        : headerRect.right
    )
      ? table.options.columnResizeDirection === "rtl"
        ? headerRect.left
        : headerRect.right
      : dragStartClientX;

  if (typeof dragStartClientX !== "number" || typeof startOffset !== "number") {
    return;
  }

  ownerDocument.body.style.cursor = "col-resize";
  ownerDocument.documentElement.style.cursor = "col-resize";

  const columnSizingStart = header
    .getLeafHeaders()
    .map(
      (leafHeader) =>
        [leafHeader.column.id, leafHeader.column.getSize()] as [string, number]
    );
  const directionMultiplier =
    table.options.columnResizeDirection === "rtl" ? -1 : 1;
  const resizedColumnsWidth = columnSizingStart.reduce(
    (total, [, headerSize]) => total + headerSize,
    0
  );
  const resizedColumnIds = new Set(
    columnSizingStart.map(([columnId]) => columnId)
  );
  const compensationColumns = getDataGridResizeCompensationColumns(
    table,
    resizedColumnIds
  );
  const currentTableWidth = table.getTotalSize();
  const viewportWidth = getDataGridColumnResizeViewportWidth(
    event.currentTarget
  );

  // Clamp the drag to the leaf columns' min/max sizes so the preview
  // Indicator matches what the commit will produce (no overshoot followed by
  // A snap-back on release). columnDef always carries resolved defaults.
  let minDeltaPercentage = -0.999999;
  let maxDeltaPercentage = Number.POSITIVE_INFINITY;
  columnSizingStart.forEach(([columnId, headerSize]) => {
    if (headerSize <= 0) {
      return;
    }

    const leafColumn = table.getColumn(columnId);
    const minSize = leafColumn?.columnDef.minSize;
    const maxSize = leafColumn?.columnDef.maxSize;

    if (typeof minSize === "number") {
      minDeltaPercentage = Math.max(
        minDeltaPercentage,
        minSize / headerSize - 1
      );
    }
    if (typeof maxSize === "number" && Number.isFinite(maxSize)) {
      maxDeltaPercentage = Math.min(
        maxDeltaPercentage,
        maxSize / headerSize - 1
      );
    }
  });
  maxDeltaPercentage = getDataGridColumnResizeMaxDeltaPercentage({
    columnMaxDeltaPercentage: maxDeltaPercentage,
    compensationColumns,
    currentTableWidth,
    resizedColumnsWidth,
    viewportWidth,
  });

  let lastClientX = dragStartClientX;
  let ended = false;
  const stopListeners: (() => void)[] = [];
  const updateOffset = (clientXPos?: number, commit = false) => {
    if (typeof clientXPos !== "number") {
      return;
    }

    lastClientX = clientXPos;

    const nextColumnSizing: Record<string, number> = {};
    const deltaPercentage = Math.min(
      Math.max(
        ((clientXPos - dragStartClientX) * directionMultiplier) / startSize,
        minDeltaPercentage
      ),
      maxDeltaPercentage
    );
    const deltaOffset = deltaPercentage * startSize;

    columnSizingStart.forEach(([columnId, headerSize]) => {
      nextColumnSizing[columnId] =
        Math.round(
          Math.max(headerSize + headerSize * deltaPercentage, 0) * 100
        ) / 100;
    });
    Object.assign(
      nextColumnSizing,
      getDataGridColumnResizeCompensation({
        compensationColumns,
        currentTableWidth,
        deltaOffset,
        viewportWidth,
      })
    );

    table.setColumnSizingInfo((old) => ({
      ...old,
      startOffset,
      startSize,
      deltaOffset,
      deltaPercentage,
      columnSizingStart,
      isResizingColumn: column.id,
    }));

    if (commit || resizeMode === "onChange") {
      table.setColumnSizing((old) => ({
        ...old,
        ...nextColumnSizing,
      }));
    }
  };
  // Single teardown path: commits at the given position, removes every
  // Document/window listener, and restores cursors. Safe to call more than
  // Once (blur + mouseup + unmount can race).
  const endResize = (clientXPos?: number) => {
    if (ended) {
      return;
    }
    ended = true;

    stopListeners.forEach((stop) => stop());
    updateOffset(clientXPos, true);
    table.setColumnSizingInfo((old) => ({
      ...old,
      isResizingColumn: false,
      startOffset: null,
      startSize: null,
      deltaOffset: null,
      deltaPercentage: null,
      columnSizingStart: [],
    }));
    ownerDocument.body.style.cursor = previousBodyCursor;
    ownerDocument.documentElement.style.cursor = previousDocumentCursor;
  };
  const mouseMoveHandler = (moveEvent: globalThis.MouseEvent) => {
    updateOffset(moveEvent.clientX);
  };
  const mouseUpHandler = (upEvent: globalThis.MouseEvent) => {
    endResize(upEvent.clientX);
  };
  const touchMoveHandler = (moveEvent: globalThis.TouchEvent) => {
    if (moveEvent.cancelable) {
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
    }

    updateOffset(getDataGridResizeEventClientX(moveEvent, touchIdentifier));
  };
  const touchEndHandler = (endEvent: globalThis.TouchEvent) => {
    // Ignore other fingers lifting; only the initiating touch ends the drag.
    const clientXPos =
      typeof touchIdentifier === "number"
        ? findTouchClientX(endEvent.changedTouches, touchIdentifier)
        : getDataGridResizeEventClientX(endEvent);

    if (typeof clientXPos !== "number") {
      return;
    }

    if (endEvent.cancelable) {
      endEvent.preventDefault();
      endEvent.stopPropagation();
    }

    endResize(clientXPos);
  };
  // System-interrupted gestures and window focus loss would otherwise leave
  // The session (and its document listeners) live with no pointer held.
  const touchCancelHandler = () => {
    endResize(lastClientX);
  };
  const windowBlurHandler = () => {
    endResize(lastClientX);
  };
  const passiveIfSupported = { passive: false } as const;

  if (isTouchSession) {
    ownerDocument.addEventListener(
      "touchmove",
      touchMoveHandler,
      passiveIfSupported
    );
    ownerDocument.addEventListener(
      "touchend",
      touchEndHandler,
      passiveIfSupported
    );
    ownerDocument.addEventListener("touchcancel", touchCancelHandler);
    stopListeners.push(() => {
      ownerDocument.removeEventListener("touchmove", touchMoveHandler);
      ownerDocument.removeEventListener("touchend", touchEndHandler);
      ownerDocument.removeEventListener("touchcancel", touchCancelHandler);
    });
  } else {
    ownerDocument.addEventListener(
      "mousemove",
      mouseMoveHandler,
      passiveIfSupported
    );
    ownerDocument.addEventListener(
      "mouseup",
      mouseUpHandler,
      passiveIfSupported
    );
    stopListeners.push(() => {
      ownerDocument.removeEventListener("mousemove", mouseMoveHandler);
      ownerDocument.removeEventListener("mouseup", mouseUpHandler);
    });
  }

  if (ownerWindow) {
    ownerWindow.addEventListener("blur", windowBlurHandler);
    stopListeners.push(() =>
      ownerWindow.removeEventListener("blur", windowBlurHandler)
    );
  }

  table.setColumnSizingInfo((old) => ({
    ...old,
    startOffset,
    startSize,
    deltaOffset: 0,
    deltaPercentage: 0,
    columnSizingStart,
    isResizingColumn: column.id,
  }));

  return () => endResize(lastClientX);
}

type DataGridTablePinnedBoundary = "top" | "bottom";

function getDataGridTableRowSections<TData>(
  table: Table<TData>,
  rowsPinnable?: boolean
) {
  if (!rowsPinnable) {
    return {
      topRows: [] as Row<TData>[],
      centerRows: table.getRowModel().rows as Row<TData>[],
      bottomRows: [] as Row<TData>[],
    };
  }

  return {
    topRows: table.getTopRows() as Row<TData>[],
    centerRows: table.getCenterRows() as Row<TData>[],
    bottomRows: table.getBottomRows() as Row<TData>[],
  };
}

function getDataGridTableResolvedRows<TData>(
  table: Table<TData>,
  rowsPinnable?: boolean
) {
  const { topRows, centerRows, bottomRows } = getDataGridTableRowSections(
    table,
    rowsPinnable
  );
  const resolvedRows: {
    row: Row<TData>;
    pinnedBoundary?: DataGridTablePinnedBoundary;
  }[] = [];

  topRows.forEach((row, index) => {
    resolvedRows.push({
      row,
      pinnedBoundary:
        index === topRows.length - 1 &&
        (centerRows.length > 0 || bottomRows.length > 0)
          ? "top"
          : undefined,
    });
  });

  centerRows.forEach((row) => {
    resolvedRows.push({ row });
  });

  bottomRows.forEach((row, index) => {
    resolvedRows.push({
      row,
      pinnedBoundary:
        index === 0 && (centerRows.length > 0 || topRows.length > 0)
          ? "bottom"
          : undefined,
    });
  });

  return resolvedRows;
}

function getDataGridTableOrderedVisibleColumns<TData>(table: Table<TData>) {
  return [
    ...table.getLeftVisibleLeafColumns(),
    ...table.getCenterVisibleLeafColumns(),
    ...table.getRightVisibleLeafColumns(),
  ] as Column<TData>[];
}

function getDataGridTableOrderedVisibleCells<TData>(row: Row<TData>) {
  return [
    ...row.getLeftVisibleCells(),
    ...row.getCenterVisibleCells(),
    ...row.getRightVisibleCells(),
  ] as Cell<TData, unknown>[];
}

function getDataGridTableMergedHeaderGroups<TData>(table: Table<TData>) {
  const leftHeaderGroups = table.getLeftHeaderGroups();
  const centerHeaderGroups = table.getCenterHeaderGroups();
  const rightHeaderGroups = table.getRightHeaderGroups();
  const headerGroupCount = Math.max(
    leftHeaderGroups.length,
    centerHeaderGroups.length,
    rightHeaderGroups.length
  );

  return Array.from({ length: headerGroupCount }, (_, index) => {
    const leftGroup = leftHeaderGroups[index];
    const centerGroup = centerHeaderGroups[index];
    const rightGroup = rightHeaderGroups[index];

    return {
      id:
        [leftGroup?.id, centerGroup?.id, rightGroup?.id]
          .filter(Boolean)
          .join(":") || `header-group-${index}`,
      headers: [
        ...(leftGroup?.headers ?? []),
        ...(centerGroup?.headers ?? []),
        ...(rightGroup?.headers ?? []),
      ] as Header<TData, unknown>[],
    };
  });
}

function hasDataGridTableRightPinnedColumns<TData>(table: Table<TData>) {
  return (table.getState().columnPinning.right?.length ?? 0) > 0;
}

function DataGridTableFillCol() {
  const { props } = useDataGrid();

  if (!props.tableLayout?.columnsResizable) {
    return null;
  }

  return (
    <col
      data-slot="data-grid-table-fill-col"
      style={{ width: "var(--data-grid-fill-size, 0px)" }}
    />
  );
}

function DataGridTableFillHeadCell() {
  const { props } = useDataGrid();

  if (!props.tableLayout?.columnsResizable) {
    return null;
  }

  return (
    <th
      aria-hidden="true"
      data-slot="data-grid-table-fill-head-cell"
      style={{ width: "var(--data-grid-fill-size, 0px)" }}
      className={cn("p-0", props.tableLayout?.headerBackground && "bg-muted")}
    />
  );
}

function DataGridTableFillBodyCell() {
  const { props } = useDataGrid();

  if (!props.tableLayout?.columnsResizable) {
    return null;
  }

  return (
    <td
      aria-hidden="true"
      data-slot="data-grid-table-fill-body-cell"
      style={{ width: "var(--data-grid-fill-size, 0px)" }}
      className="p-0"
    />
  );
}

function DataGridTableFillFootCell() {
  const { props } = useDataGrid();

  if (!props.tableLayout?.columnsResizable) {
    return null;
  }

  return (
    <td
      aria-hidden="true"
      data-slot="data-grid-table-fill-foot-cell"
      style={{ width: "var(--data-grid-fill-size, 0px)" }}
      className="p-0"
    />
  );
}

function DataGridTableBase({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}) {
  const { props, table } = useDataGrid();
  const leftVisibleColumns = table.getLeftVisibleLeafColumns();
  const centerVisibleColumns = table.getCenterVisibleLeafColumns();
  const rightVisibleColumns = table.getRightVisibleLeafColumns();
  const hasRightPinnedColumns = hasDataGridTableRightPinnedColumns(table);
  /**
   * Compute column widths as CSS custom properties once upfront (memoized).
   * Cells reference these via calc(var(--col-X-size) * 1px) so the browser
   * handles width propagation without per-cell getSize() calls or React
   * re-renders of the body.
   */
  const columnSizeVars = useMemo(() => {
    if (!props.tableLayout?.columnsResizable) {
      return;
    }
    const headers = table.getFlatHeaders();
    const colSizes: Record<string, number> = {};
    for (const header of headers) {
      colSizes[`--header-${header.id}-size`] = header.getSize();
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
    }
    return colSizes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    props.tableLayout?.columnsResizable,
    // Visibility/order/pinning change the flat header set, so a column shown
    // After mount must get its size variable even though sizing is untouched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    table.getState().columnSizing,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    table.getState().columnVisibility,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    table.getState().columnOrder,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    table.getState().columnPinning,
  ]);

  return (
    <table
      aria-label={label}
      data-slot="data-grid-table"
      className={cn(
        "text-foreground caption-bottom text-left align-middle text-sm font-normal rtl:text-right",
        props.tableLayout?.columnsResizable ? "min-w-0" : "w-full min-w-full",
        props.tableLayout?.width === "auto" ? "table-auto" : "table-fixed",
        !props.tableLayout?.columnsResizable && "",
        !props.tableLayout?.columnsDraggable &&
          "border-separate border-spacing-0",
        props.tableClassNames?.base
      )}
      style={
        props.tableLayout?.columnsResizable
          ? {
              ...columnSizeVars,
              width: `calc(${table.getTotalSize()}px + var(--data-grid-fill-size, 0px))`,
            }
          : undefined
      }
    >
      <colgroup>
        {[...leftVisibleColumns, ...centerVisibleColumns].map((column) => (
          <col
            key={column.id}
            style={
              props.tableLayout?.columnsResizable
                ? { width: `calc(var(--col-${column.id}-size) * 1px)` }
                : props.tableLayout?.width === "fixed"
                  ? { width: column.getSize() }
                  : undefined
            }
          />
        ))}
        {hasRightPinnedColumns ? <DataGridTableFillCol /> : null}
        {rightVisibleColumns.map((column) => (
          <col
            key={column.id}
            style={
              props.tableLayout?.columnsResizable
                ? { width: `calc(var(--col-${column.id}-size) * 1px)` }
                : props.tableLayout?.width === "fixed"
                  ? { width: column.getSize() }
                  : undefined
            }
          />
        ))}
        {hasRightPinnedColumns ? null : <DataGridTableFillCol />}
      </colgroup>
      {children}
    </table>
  );
}

function DataGridTableViewport({
  children,
  className,
  viewportRef,
  style,
}: {
  children: ReactNode;
  className?: string;
  viewportRef?: Ref<HTMLDivElement>;
  style?: CSSProperties;
}) {
  const { props, table, autoSize } = useDataGrid();
  const isColumnsResizable = Boolean(props.tableLayout?.columnsResizable);
  const viewportNodeRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(false);
  const fillStateRef = useRef({ containerWidth: 0, appliedFill: -1 });
  const stopContainerObserverRef = useRef<(() => void) | null>(null);
  // Free space is written as a CSS variable directly on the viewport node
  // Instead of React state, so container resizes and column-size commits
  // Reach the fill column without re-rendering the grid.
  const syncFillWidth = useCallback(() => {
    const node = viewportNodeRef.current;
    if (!node) {
      return;
    }

    const fillWidth = Math.max(
      0,
      fillStateRef.current.containerWidth - table.getTotalSize()
    );

    if (fillStateRef.current.appliedFill !== fillWidth) {
      fillStateRef.current.appliedFill = fillWidth;
      node.style.setProperty("--data-grid-fill-size", `${fillWidth}px`);
    }
  }, [table]);
  const syncAutoSizeWidth = useCallback(() => {
    const changed = autoSize?.apply(fillStateRef.current.containerWidth);
    if (changed) {
      viewportNodeRef.current?.style.setProperty(
        "--data-grid-fill-size",
        "0px"
      );
      return;
    }
    syncFillWidth();
  }, [autoSize, syncFillWidth]);
  const handleViewportRef = useCallback(
    (node: HTMLDivElement | null) => {
      stopContainerObserverRef.current?.();
      stopContainerObserverRef.current = null;
      viewportNodeRef.current = node;
      assignRef(viewportRef, node);

      if (!node) {
        return;
      }

      if (!isColumnsResizable) {
        fillStateRef.current.appliedFill = -1;
        node.style.removeProperty("--data-grid-fill-size");
        return;
      }

      const scrollViewport =
        getDataGridScrollAreaViewport(node) ?? node.parentElement;
      const measurementTarget = scrollViewport ?? node;
      const layoutResizeRoot = getDataGridLayoutResizeRoot(measurementTarget);
      let hasDeferredMeasurement = false;

      const measure = () => {
        if (layoutResizeRoot?.dataset.dataGridLayoutResizing === "true") {
          hasDeferredMeasurement = true;
          return;
        }
        fillStateRef.current.containerWidth = measurementTarget.clientWidth;
        if (mountedRef.current) {
          syncAutoSizeWidth();
        } else {
          syncFillWidth();
        }
      };
      const flushDeferredMeasurement = () => {
        if (!hasDeferredMeasurement) {
          return;
        }
        hasDeferredMeasurement = false;
        measure();
      };

      // Measure the fill column during the mount commit. Auto-size state is
      // Applied from the layout effect after the parent table has mounted.
      measure();

      if (typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(measure);
        observer.observe(measurementTarget);
        layoutResizeRoot?.addEventListener(
          DATA_GRID_LAYOUT_RESIZE_END_EVENT,
          flushDeferredMeasurement
        );
        stopContainerObserverRef.current = () => {
          observer.disconnect();
          layoutResizeRoot?.removeEventListener(
            DATA_GRID_LAYOUT_RESIZE_END_EVENT,
            flushDeferredMeasurement
          );
        };
      }
    },
    [isColumnsResizable, syncAutoSizeWidth, syncFillWidth, viewportRef]
  );

  // Column sizing/order/visibility commits alter the table without moving the
  // Container, so ResizeObserver does not fire. Run after every table render;
  // The controller distinguishes authoritative user resizing from genuine
  // Layout changes and never redistributes neighbouring columns after a drag.
  useLayoutEffect(() => {
    mountedRef.current = true;
    if (!isColumnsResizable) {
      return;
    }
    syncAutoSizeWidth();
  });

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  return (
    <div
      data-slot="data-grid-table-viewport"
      ref={handleViewportRef}
      className={cn("relative min-w-full align-top", className)}
      style={{
        ...(isColumnsResizable
          ? {
              width: `calc(${table.getTotalSize()}px + var(--data-grid-fill-size, 0px))`,
            }
          : undefined),
        ...style,
      }}
    >
      {children}
      <DataGridTableResizeIndicator viewportNodeRef={viewportNodeRef} />
    </div>
  );
}

function DataGridTableHead({ children }: { children: ReactNode }) {
  const { props } = useDataGrid();

  return (
    <thead
      className={cn(
        props.tableClassNames?.header,
        props.tableLayout?.headerSticky && props.tableClassNames?.headerSticky
      )}
    >
      {children}
    </thead>
  );
}

function DataGridTableHeadRow({
  children,
  rowId: _rowId,
}: {
  children: ReactNode;
  rowId: string;
}) {
  const { props } = useDataGrid();

  return (
    <tr
      className={cn(
        props.tableLayout?.headerBorder && "[&>th]:border-b",
        props.tableLayout?.cellBorder && "*:last:border-e-0",
        props.tableLayout?.stripped && "bg-transparent",
        props.tableLayout?.headerBackground === false && "bg-transparent",
        props.tableClassNames?.headerRow
      )}
    >
      {children}
    </tr>
  );
}

function DataGridTableHeadRowCell<TData>({
  children,
  header,
  dndRef,
  dndStyle,
}: {
  children: ReactNode;
  header: Header<TData, unknown>;
  dndRef?: React.Ref<HTMLTableCellElement>;
  dndStyle?: CSSProperties;
}) {
  const { props } = useDataGrid();
  const { column } = header;
  const isPinned = column.getIsPinned();
  const isFirstLeftPinned =
    isPinned === "left" && column.getIsFirstColumn("left");
  const isLastLeftPinned =
    isPinned === "left" && column.getIsLastColumn("left");
  const isFirstRightPinned =
    isPinned === "right" && column.getIsFirstColumn("right");
  const isLastRightPinned =
    isPinned === "right" && column.getIsLastColumn("right");
  const isLastVisibleColumn =
    column.getIndex() ===
    header.getContext().table.getVisibleLeafColumns().length - 1;
  const headerCellSpacing = headerCellSpacingVariants({
    size: props.tableLayout?.dense ? "dense" : "default",
  });
  const sortDirection = column.getIsSorted();

  return (
    <th
      ref={dndRef}
      scope="col"
      aria-label={getColumnHeaderLabel(column)}
      colSpan={header.colSpan > 1 ? header.colSpan : undefined}
      aria-sort={
        sortDirection === "asc"
          ? "ascending"
          : sortDirection === "desc"
            ? "descending"
            : undefined
      }
      style={{
        ...(props.tableLayout?.width === "fixed" &&
          !props.tableLayout?.columnsResizable && {
            width: header.getSize(),
          }),
        ...(props.tableLayout?.columnsPinnable &&
          column.getCanPin() &&
          getPinningStyles(column)),
        ...(props.tableLayout?.columnsResizable && {
          width: `calc(var(--header-${header.id}-size) * 1px)`,
        }),
        ...(dndStyle || null),
      }}
      data-pinned={isPinned || undefined}
      data-outer-pinned-col={
        isFirstLeftPinned ? "left" : isLastRightPinned ? "right" : undefined
      }
      data-last-col={
        isLastLeftPinned ? "left" : isFirstRightPinned ? "right" : undefined
      }
      className={cn(
        "text-foreground relative h-10 text-left align-middle font-medium rtl:text-right [&:has([role=checkbox])]:pe-0",
        headerCellSpacing,
        props.tableLayout?.headerBackground && "bg-muted",
        props.tableLayout?.cellBorder && "border-e",
        props.tableLayout?.columnsResizable &&
          column.getCanResize() &&
          (isPinned ? "overflow-hidden" : "overflow-visible"),
        props.tableLayout?.columnsResizable &&
          column.getCanResize() &&
          isLastVisibleColumn &&
          "pe-8",
        props.tableLayout?.columnsPinnable &&
          column.getCanPin() &&
          cn(
            "data-pinned:bg-muted data-outer-pinned-col:bg-clip-padding data-pinned:isolate",
            "[&[data-pinned=left][data-last-col=left]]:shadow-[inset_-1px_0_0_0_var(--border)] [&[data-pinned=right]:last-child_div.cursor-col-resize:last-child]:opacity-0 [&[data-pinned=right][data-last-col=right]]:shadow-[inset_1px_0_0_0_var(--border)]",
            "[&:not([data-pinned]):has(+[data-pinned])_div.cursor-col-resize:last-child]:opacity-0 [&[data-last-col=left]_div.cursor-col-resize:last-child]:opacity-0"
          ),
        header.column.columnDef.meta?.headerClassName,
        // Edge detection spans the full visible leaf order; the header's own
        // Group only covers one pinning bucket.
        column.getIndex() === 0 || isLastVisibleColumn
          ? props.tableClassNames?.edgeCell
          : ""
      )}
    >
      {children}
    </th>
  );
}

function DataGridTableHeadRowCellResize<TData>({
  header,
}: {
  header: Header<TData, unknown>;
}) {
  const { props, table } = useDataGrid();
  const { column } = header;
  const isPinned = column.getIsPinned();
  const isLastVisibleColumn =
    column.getIndex() ===
    header.getContext().table.getVisibleLeafColumns().length - 1;
  const isResizeModeOnEnd =
    (props.tableLayout?.columnsResizeMode ?? table.options.columnResizeMode) ===
    "onEnd";
  const resizeMode = isResizeModeOnEnd ? "onEnd" : "onChange";
  const stopResizeSessionRef = useRef<(() => void) | null>(null);
  const columnLabel = getColumnHeaderLabel(column);
  const minSize = column.columnDef.minSize ?? 20;
  const maxSize = column.columnDef.maxSize ?? Number.MAX_SAFE_INTEGER;
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const direction = table.options.columnResizeDirection === "rtl" ? -1 : 1;
    const delta = (event.key === "ArrowRight" ? 16 : -16) * direction;
    const compensationColumns = getDataGridResizeCompensationColumns(
      table,
      new Set([column.id])
    );
    const currentTableWidth = table.getTotalSize();
    const viewportWidth = getDataGridColumnResizeViewportWidth(
      event.currentTarget
    );
    const maxDeltaPercentage = getDataGridColumnResizeMaxDeltaPercentage({
      columnMaxDeltaPercentage:
        maxSize === Number.MAX_SAFE_INTEGER
          ? Number.POSITIVE_INFINITY
          : maxSize / column.getSize() - 1,
      compensationColumns,
      currentTableWidth,
      resizedColumnsWidth: column.getSize(),
      viewportWidth,
    });
    const viewportMaxSize =
      column.getSize() * (1 + Math.max(0, maxDeltaPercentage));
    const nextSize = Math.min(
      maxSize,
      viewportMaxSize,
      Math.max(minSize, column.getSize() + delta)
    );
    table.setColumnSizing((current) => ({
      ...current,
      ...getDataGridColumnResizeCompensation({
        compensationColumns,
        currentTableWidth,
        deltaOffset: nextSize - column.getSize(),
        viewportWidth,
      }),
      [column.id]: nextSize,
    }));
  };

  // End a live drag if the handle unmounts mid-resize so document listeners
  // And the app-wide col-resize cursor don't outlive the grid.
  useEffect(
    () => () => {
      stopResizeSessionRef.current?.();
      stopResizeSessionRef.current = null;
    },
    []
  );

  const handleMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    // Only the primary button starts a resize; guard before preventDefault so
    // Right-click still opens the context menu.
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    stopResizeSessionRef.current?.();
    stopResizeSessionRef.current =
      startDataGridColumnResize(event, header, table, resizeMode) ?? null;
  };
  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    stopResizeSessionRef.current?.();
    stopResizeSessionRef.current =
      startDataGridColumnResize(event, header, table, resizeMode) ?? null;
  };

  return (
    <div
      {...{
        "aria-label": getDataGridCopy(props.locale).resizeColumn(columnLabel),
        "aria-orientation": "vertical",
        "aria-valuemax": maxSize,
        "aria-valuemin": minSize,
        "aria-valuenow": column.getSize(),
        onDoubleClick: () => column.resetSize(),
        onKeyDown: handleKeyDown,
        onMouseDown: handleMouseDown,
        onTouchStart: handleTouchStart,
        role: "separator",
        tabIndex: 0,
        className: cn(
          "absolute top-0 h-full cursor-col-resize user-select-none touch-none z-10 flex bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isLastVisibleColumn
            ? "end-0 w-5 justify-end before:hidden"
            : isPinned
              ? cn(
                  // A pinned column is sticky, so the handle sits inside the
                  // Cell instead of straddling the boundary, where the next
                  // Sticky cell would paint over it.
                  "end-0 w-5 justify-end",
                  // With the pin affordance on, the pinned edge already draws
                  // Its own separator and a resize line would double it. But
                  // Pinning is also usable purely as an ordering lock, with no
                  // Affordance and no separator -- and there this line is the
                  // Only thing marking the edge, so hiding it left a resizable
                  // Column showing a resize cursor and no indicator at all.
                  props.tableLayout?.columnsPinnable
                    ? "before:hidden"
                    : "before:absolute before:inset-y-0 before:end-0 before:w-px before:bg-border"
                )
              : "-end-2 w-5 justify-center before:absolute before:inset-y-0 before:w-px before:-translate-x-px before:bg-border",
          column.getIsResizing() &&
            (isResizeModeOnEnd
              ? "opacity-100"
              : isLastVisibleColumn
                ? "before:absolute before:end-0 before:block before:inset-y-0 before:w-0.5 before:bg-primary opacity-100"
                : "before:block before:bg-primary before:w-0.5 opacity-100")
        ),
      }}
    />
  );
}

function DataGridTableResizeIndicator({
  viewportNodeRef,
}: {
  viewportNodeRef: RefObject<HTMLDivElement | null>;
}) {
  const { props, table } = useDataGrid();
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const indicatorHeadRef = useRef<HTMLDivElement | null>(null);
  // Header height is stable for the duration of a drag; caching it per
  // Session avoids a forced layout (querySelector + getBoundingClientRect)
  // On every mousemove.
  const headerHeightCacheRef = useRef<{
    key: string | false;
    value: number;
  }>({ key: false, value: 0 });
  const { columnSizingInfo } = table.getState();
  const resizingColumnId = columnSizingInfo.isResizingColumn;
  const resizeMode =
    props.tableLayout?.columnsResizeMode ?? table.options.columnResizeMode;
  const isActive = Boolean(
    props.tableLayout?.columnsResizable &&
    resizeMode === "onEnd" &&
    resizingColumnId
  );

  // Positioning happens imperatively after each drag-frame render: layout
  // Reads (viewport rect, thead height) and ref access belong outside render,
  // And writing styles directly avoids holding the viewport node in React
  // State, which would cost every grid a second render pass at mount.
  useLayoutEffect(() => {
    const indicator = indicatorRef.current;
    const indicatorHead = indicatorHeadRef.current;
    const viewportElement = viewportNodeRef.current;

    if (!isActive || !indicator || !indicatorHead || !resizingColumnId) {
      return;
    }

    const resizingHeader = table
      .getFlatHeaders()
      .find(
        (header) =>
          header.column.id === resizingColumnId ||
          header.id === resizingColumnId
      );

    if (!resizingHeader) {
      return;
    }

    // DeltaOffset is a logical delta (already direction-adjusted); translate
    // By the physical pointer movement so the indicator follows the cursor
    // In RTL instead of mirroring it.
    const directionMultiplier =
      table.options.columnResizeDirection === "rtl" ? -1 : 1;
    const deltaOffset =
      (columnSizingInfo.deltaOffset ?? 0) * directionMultiplier;

    if (headerHeightCacheRef.current.key !== resizingColumnId) {
      headerHeightCacheRef.current = {
        key: resizingColumnId,
        value:
          viewportElement
            ?.querySelector('[data-slot="data-grid-table"] thead')
            ?.getBoundingClientRect().height ?? 0,
      };
    }

    const headerHeight = headerHeightCacheRef.current.value;
    const indicatorLeft =
      typeof columnSizingInfo.startOffset === "number" && viewportElement
        ? columnSizingInfo.startOffset -
          viewportElement.getBoundingClientRect().left
        : resizingHeader.getStart() + resizingHeader.getSize();

    indicator.style.left = `${indicatorLeft}px`;
    indicator.style.transform = `translateX(${deltaOffset}px)`;
    indicatorHead.style.height = `${Math.max(headerHeight, 6)}px`;
  });

  if (!isActive) {
    return null;
  }

  return (
    <div
      ref={indicatorRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 z-50"
    >
      <div className="bg-primary/85 absolute inset-y-0 left-0 w-px -translate-x-1/2" />
      <div
        ref={indicatorHeadRef}
        className="bg-primary absolute top-0 left-0 -translate-x-1/2 rounded-b-sm shadow-xs"
        style={{ width: 5 }}
      />
    </div>
  );
}

function DataGridTableRowSpacer() {
  return (
    <tbody
      aria-hidden="true"
      className="h-2"
      data-slot="data-grid-table-body-spacer"
    />
  );
}

function DataGridTableBody({ children }: { children: ReactNode }) {
  const { props } = useDataGrid();

  return (
    <tbody
      data-slot="data-grid-table-body"
      className={cn(
        props.tableLayout?.rowRounded && "[&_td:first-child]:rounded-l-lg",
        props.tableLayout?.rowRounded && "[&_td:last-child]:rounded-r-lg",
        props.tableClassNames?.body
      )}
    >
      {children}
    </tbody>
  );
}

function DataGridTableFoot({ children }: { children: ReactNode }) {
  const { props } = useDataGrid();
  return (
    <tfoot
      data-slot="data-grid-table-foot"
      className={cn(props.tableClassNames?.footer)}
    >
      {children}
    </tfoot>
  );
}

function DataGridTableFootRow({ children }: { children: ReactNode }) {
  const { props } = useDataGrid();
  const footRowBottomBorderClasses = "[&:not(:last-child)>td]:border-b";

  return (
    <tr
      data-slot="data-grid-table-foot-row"
      className={cn(
        props.tableLayout?.footerBackground && "bg-muted/40 dark:bg-background",
        props.tableLayout?.rowBorder && footRowBottomBorderClasses,
        props.tableLayout?.cellBorder && "*:last:border-e-0"
      )}
    >
      {children}
      <DataGridTableFillFootCell />
    </tr>
  );
}

function DataGridTableFootRowCell({
  children,
  colSpan,
  className,
}: {
  children?: ReactNode;
  colSpan?: number;
  className?: string;
}) {
  const { props } = useDataGrid();
  const spacing = footerCellSpacingVariants({
    size: props.tableLayout?.dense ? "dense" : "default",
  });
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "text-secondary-foreground/80 align-middle font-medium",
        spacing,
        props.tableLayout?.footerBackground && "bg-muted/40 dark:bg-background",
        props.tableLayout?.cellBorder && "border-e",
        className
      )}
    >
      {children}
    </td>
  );
}

const DATA_GRID_ROW_INTERACTIVE_SELECTOR = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "[contenteditable=true]",
  "[role=button]",
  "[role=checkbox]",
  "[role=link]",
  "[role=menuitem]",
  "[role=menuitemcheckbox]",
  "[role=radio]",
  "[role=switch]",
  "[data-row-click-ignore]",
].join(",");

function isDataGridRowInteractiveTarget(
  event: ReactMouseEvent<HTMLTableRowElement>
) {
  const { target } = event;
  return (
    target instanceof Element &&
    Boolean(target.closest(DATA_GRID_ROW_INTERACTIVE_SELECTOR))
  );
}

function DataGridTableBodyRow<TData>({
  children,
  row,
  pinnedBoundary,
  rowRef,
  dndRef,
  dndStyle,
  dataIndex,
  ref: forwardedRef,
  className,
  style,
  onClick,
  onKeyDown,
  tabIndex,
  "data-state": controlledState,
  ...nativeRowProps
}: {
  children: ReactNode;
  row: Row<TData>;
  pinnedBoundary?: DataGridTablePinnedBoundary;
  rowRef?: React.Ref<HTMLTableRowElement>;
  dndRef?: React.Ref<HTMLTableRowElement>;
  dndStyle?: CSSProperties;
  dataIndex?: number;
  ref?: Ref<HTMLTableRowElement>;
} & Omit<ComponentPropsWithoutRef<"tr">, "children"> & {
    "data-state"?: string;
  }) {
  const { props, table } = useDataGrid();
  const isRowPinned = row.getIsPinned();
  const canActivateRow =
    Boolean(props.onRowClick) &&
    nativeRowProps["aria-disabled"] !== true &&
    nativeRowProps["aria-disabled"] !== "true";
  const bodyRowBottomBorderClasses =
    "[&:not(:last-child)>td]:border-b [tbody:has(+tfoot)_&:last-child>td]:border-b [*:has(>[data-slot=data-grid]+[data-slot=data-grid-pagination])_[data-slot=data-grid]_&:last-child>td]:border-b";

  return (
    <tr
      {...nativeRowProps}
      ref={(node) => {
        assignRef(forwardedRef, node);
        assignRef(rowRef, node);
        assignRef(dndRef, node);
      }}
      style={{ ...style, ...(dndStyle || null) }}
      data-state={
        controlledState ??
        (table.options.enableRowSelection && row.getIsSelected()
          ? "selected"
          : undefined)
      }
      data-index={dataIndex}
      data-row-id={row.id}
      data-depth={row.depth || undefined}
      data-row-pinned={isRowPinned || undefined}
      data-row-pinned-boundary={pinnedBoundary}
      tabIndex={tabIndex ?? (canActivateRow ? 0 : undefined)}
      aria-keyshortcuts={
        nativeRowProps["aria-keyshortcuts"] ??
        (canActivateRow ? "Enter Space" : undefined)
      }
      aria-description={
        nativeRowProps["aria-description"] ??
        (canActivateRow ? getDataGridCopy(props.locale).rowAction : undefined)
      }
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (
          event.defaultPrevented ||
          !canActivateRow ||
          event.target !== event.currentTarget ||
          event.repeat ||
          event.nativeEvent.isComposing ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          (event.key !== "Enter" && event.key !== " ")
        ) {
          return;
        }
        event.preventDefault();
        props.onRowClick?.(row.original);
      }}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) {
          return;
        }
        if (!canActivateRow || isDataGridRowInteractiveTarget(event)) {
          return;
        }
        props.onRowClick?.(row.original);
      }}
      className={cn(
        "hover:bg-muted/60 data-[state=selected]:bg-accent",
        canActivateRow &&
          "cursor-pointer outline-none focus-visible:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        !props.tableLayout?.stripped &&
          props.tableLayout?.rowBorder &&
          bodyRowBottomBorderClasses,
        props.tableLayout?.cellBorder &&
          `*:last:border-e-0 ${bodyRowBottomBorderClasses}`,
        // Virtualized rows stripe by absolute row index (CSS :nth-child
        // Parity flips as spacer rows resize while scrolling).
        props.tableLayout?.stripped &&
          (typeof dataIndex === "number"
            ? cn(
                "hover:bg-transparent",
                dataIndex % 2 === 0 && "bg-muted/90 hover:bg-muted"
              )
            : "odd:bg-muted/90 odd:hover:bg-muted hover:bg-transparent"),
        table.options.enableRowSelection && "*:first:relative",
        props.tableLayout?.rowsPinnable &&
          isRowPinned &&
          "bg-muted/30 hover:bg-muted/50",
        props.rowClassName?.(row.original),
        pinnedBoundary === "top" &&
          "[&>td]:shadow-[0_2px_0_rgba(0,0,0,0.03)] dark:[&>td]:shadow-[0_2px_0_rgba(255,255,255,0.06)]",
        pinnedBoundary === "bottom" &&
          "[&>td]:shadow-[0_2px_0_rgba(0,0,0,0.03)] dark:[&>td]:shadow-[0_2px_0_rgba(255,255,255,0.06)]",
        props.tableClassNames?.bodyRow,
        className
      )}
    >
      {children}
    </tr>
  );
}

function DataGridTableBodyRowExpandded<TData>({ row }: { row: Row<TData> }) {
  const { props, table } = useDataGrid();
  const expandedContent = table
    .getAllColumns()
    .find((column) => column.columnDef.meta?.expandedContent)?.columnDef
    .meta?.expandedContent;

  // Tree and grouped rows share row.getIsExpanded() with detail expansion.
  // Without a detail column there is nothing to render, and an empty <tr>
  // Would break striping parity, rowBorder, and virtual row measurement.
  if (!expandedContent) {
    return null;
  }

  const bodyRowBottomBorderClasses =
    "[&:not(:last-child)>td]:border-b [tbody:has(+tfoot)_&:last-child>td]:border-b [*:has(>[data-slot=data-grid]+[data-slot=data-grid-pagination])_[data-slot=data-grid]_&:last-child>td]:border-b";

  return (
    <tr
      className={cn(props.tableLayout?.rowBorder && bodyRowBottomBorderClasses)}
    >
      <td
        colSpan={
          getDataGridTableOrderedVisibleCells(row).length +
          (props.tableLayout?.columnsResizable ? 1 : 0)
        }
      >
        {expandedContent(row.original)}
      </td>
    </tr>
  );
}

function DataGridTableBodyRowCell<TData>({
  children,
  cell,
  dndRef,
  dndStyle,
}: {
  children: ReactNode;
  cell: Cell<TData, unknown>;
  dndRef?: React.Ref<HTMLTableCellElement>;
  dndStyle?: CSSProperties;
}) {
  const { props } = useDataGrid();
  const { column, row } = cell;
  const isPinned = column.getIsPinned();
  const isLastLeftPinned =
    isPinned === "left" && column.getIsLastColumn("left");
  const isFirstRightPinned =
    isPinned === "right" && column.getIsFirstColumn("right");
  const bodyCellSpacing = bodyCellSpacingVariants({
    size: props.tableLayout?.dense ? "dense" : "default",
  });

  return (
    <td
      ref={dndRef}
      style={{
        ...(props.tableLayout?.columnsPinnable &&
          column.getCanPin() &&
          getPinningStyles(column)),
        ...(props.tableLayout?.columnsResizable && {
          width: `calc(var(--col-${column.id}-size) * 1px)`,
        }),
        ...(dndStyle || null),
      }}
      data-pinned={isPinned || undefined}
      data-last-col={
        isLastLeftPinned ? "left" : isFirstRightPinned ? "right" : undefined
      }
      className={cn(
        "align-middle",
        bodyCellSpacing,
        props.tableLayout?.cellBorder && "border-e",
        props.tableLayout?.columnsResizable &&
          column.getCanResize() &&
          "truncate",
        cell.column.columnDef.meta?.cellClassName,
        props.tableLayout?.columnsPinnable &&
          column.getCanPin() &&
          cn(
            "data-pinned:bg-card data-pinned:isolate",
            "[&[data-pinned=left][data-last-col=left]]:shadow-[inset_-1px_0_0_0_var(--border)]",
            "[&[data-pinned=right][data-last-col=right]]:shadow-[inset_1px_0_0_0_var(--border)]"
          ),
        column.getIndex() === 0 ||
          column.getIndex() === row.getVisibleCells().length - 1
          ? props.tableClassNames?.edgeCell
          : ""
      )}
    >
      {children}
    </td>
  );
}

function DataGridTableRenderedRow<TData>({
  row,
  pinnedBoundary,
  rowRef,
  rowIndex,
}: {
  row: Row<TData>;
  pinnedBoundary?: DataGridTablePinnedBoundary;
  rowRef?: React.Ref<HTMLTableRowElement>;
  /** Virtualized list index, rendered as data-index for measureElement. */
  rowIndex?: number;
}) {
  const { props, table } = useDataGrid();
  const leftVisibleCells = row.getLeftVisibleCells();
  const centerVisibleCells = row.getCenterVisibleCells();
  const rightVisibleCells = row.getRightVisibleCells();
  const hasRightPinnedColumns = hasDataGridTableRightPinnedColumns(table);
  const rowProps = props.rowProps?.(row.original);

  return (
    <>
      <DataGridTableBodyRow
        {...rowProps}
        row={row}
        pinnedBoundary={pinnedBoundary}
        rowRef={rowRef}
        dataIndex={rowIndex}
      >
        {[...leftVisibleCells, ...centerVisibleCells].map(
          (cell: Cell<TData, unknown>) => (
            <DataGridTableBodyRowCell cell={cell} key={cell.id}>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </DataGridTableBodyRowCell>
          )
        )}
        {props.tableLayout?.columnsResizable && hasRightPinnedColumns ? (
          <DataGridTableFillBodyCell />
        ) : null}
        {rightVisibleCells.map((cell: Cell<TData, unknown>) => (
          <DataGridTableBodyRowCell cell={cell} key={cell.id}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </DataGridTableBodyRowCell>
        ))}
        {props.tableLayout?.columnsResizable && !hasRightPinnedColumns ? (
          <DataGridTableFillBodyCell />
        ) : null}
      </DataGridTableBodyRow>
      {row.getIsExpanded() && <DataGridTableBodyRowExpandded row={row} />}
    </>
  );
}

function DataGridTableEmpty() {
  const { table, props } = useDataGrid();
  const visibleColumnCount =
    getDataGridTableOrderedVisibleColumns(table).length +
    (props.tableLayout?.columnsResizable ? 1 : 0);

  return (
    <tr>
      <td
        colSpan={Math.max(visibleColumnCount, 1)}
        className="text-muted-foreground py-6 text-center text-sm"
      >
        {props.emptyMessage || getDataGridCopy(props.locale).empty}
      </td>
    </tr>
  );
}

export function DataGridTableLoadingRow({ colSpan }: { colSpan: number }) {
  const { props } = useDataGrid();
  return (
    <tr>
      <td colSpan={colSpan} className="p-8">
        <CollectionState
          kind="loading"
          locale={props.locale}
          title={getDataGridCopy(props.locale).loading}
        />
      </td>
    </tr>
  );
}

function DataGridTableRowPin<TData>({
  row,
  pinLabel,
  unpinLabel,
}: {
  row: Row<TData>;
  pinLabel?: string;
  unpinLabel?: string;
}) {
  const { props } = useDataGrid();
  const copy = getDataGridCopy(props.locale);
  const isPinned = row.getIsPinned();

  return (
    <button
      type="button"
      aria-label={
        isPinned ? (unpinLabel ?? copy.unpinRow) : (pinLabel ?? copy.pinRow)
      }
      onClick={(event) => {
        // Pinning must not bubble into the row's onRowClick handler.
        event.stopPropagation();

        if (isPinned) {
          row.pin(false);
        } else {
          row.pin("top");
        }
      }}
      className={cn(
        "text-muted-foreground hover:text-foreground rounded-lg inline-flex size-7 items-center justify-center transition-colors",
        isPinned && "text-primary hover:text-primary/80"
      )}
    >
      {isPinned ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
          stroke="none"
        >
          <path d="M16 2l4.585 4.586-2.122 2.121L17.05 7.293l-3.535 3.536 1.413 5.658-2.12 2.121-4.244-4.243L4.322 18.6l-1.414-1.41 4.242-4.244-4.243-4.243 2.122-2.121 5.656 1.414 3.536-3.536-1.414-1.414z" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="17" x2="12" y2="22" />
          <path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24z" />
        </svg>
      )}
    </button>
  );
}

function DataGridTableRowSelect<TData>({ row }: { row: Row<TData> }) {
  const { isLoading, props } = useDataGrid();
  return (
    <>
      <div
        className={cn(
          "bg-primary absolute inset-s-0 top-0 bottom-0 hidden w-[2px]",
          row.getIsSelected() && "block"
        )}
      />
      <Checkbox
        disabled={isLoading || !row.getCanSelect()}
        checked={row.getIsSelected()}
        indeterminate={row.getIsSomeSelected() && !row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
        onClick={(event) => {
          // Selection must not bubble into the row's onRowClick handler.
          event.stopPropagation();
        }}
        aria-label={getDataGridCopy(props.locale).selectRow}
        className="align-[inherit]"
      />
    </>
  );
}

function DataGridTableRowSelectAll() {
  const { table, recordCount, isLoading, props } = useDataGrid();
  const isAllSelected = table.getIsAllPageRowsSelected();
  const isSomeSelected = table.getIsSomePageRowsSelected();
  const hasSelectableRows = table
    .getRowModel()
    .rows.some((row) => row.getCanSelect());

  return (
    <Checkbox
      checked={isAllSelected}
      indeterminate={isSomeSelected && !isAllSelected}
      disabled={isLoading || recordCount === 0 || !hasSelectableRows}
      onCheckedChange={(value) =>
        table.toggleAllPageRowsSelected(Boolean(value))
      }
      aria-label={getDataGridCopy(props.locale).selectAll}
      className="align-[inherit]"
    />
  );
}

function DataGridTableRowExpand<TData>({
  row,
  indent = 20,
  className,
  children,
  expandLabel = "Expand row",
  collapseLabel = "Collapse row",
}: {
  row: Row<TData>;
  /** Horizontal offset in px applied per tree depth level. */
  indent?: number;
  className?: string;
  /** Custom toggle icon; replaces the default chevron. */
  children?: ReactNode;
  expandLabel?: string;
  collapseLabel?: string;
}) {
  const { props } = useDataGrid();
  const isExpanded = row.getIsExpanded();
  const controlSize = props.tableLayout?.dense ? "size-6" : "size-7";

  return (
    <span
      data-slot="data-grid-table-row-expand"
      style={getDataGridTreeIndentStyle(row, indent)}
      className={cn(
        "inline-flex shrink-0 items-center align-middle ps-(--data-grid-tree-padding)",
        className
      )}
    >
      {row.getCanExpand() ? (
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? collapseLabel : expandLabel}
          onClick={(event) => {
            // Expansion must not bubble into the row's onRowClick handler.
            event.stopPropagation();
            row.toggleExpanded();
          }}
          className={cn(
            "text-muted-foreground hover:text-foreground rounded-lg inline-flex items-center justify-center transition-colors",
            controlSize
          )}
        >
          {children ?? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="transition-transform duration-200 in-aria-[expanded=false]:-rotate-90 rtl:in-aria-[expanded=false]:rotate-90"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          )}
        </button>
      ) : (
        // Leaf spacer: compact by design so leaf content sits near the
        // Parent label instead of a full toggle width deeper.
        <span aria-hidden="true" className="w-2 shrink-0" />
      )}
    </span>
  );
}

function DataGridTableBodyRows<TData>({ table }: { table: Table<TData> }) {
  const { isLoading, props } = useDataGrid();
  if (isLoading) {
    return (
      <DataGridTableLoadingRow
        colSpan={
          table.getVisibleFlatColumns().length +
          (props.tableLayout?.columnsResizable ? 1 : 0)
        }
      />
    );
  }

  const resolvedRows = getDataGridTableResolvedRows(
    table,
    props.tableLayout?.rowsPinnable
  );

  if (resolvedRows.length === 0) {
    return <DataGridTableEmpty />;
  }

  return (
    <>
      {resolvedRows.map(({ row, pinnedBoundary }) => (
        <DataGridTableRenderedRow
          key={row.id}
          row={row}
          pinnedBoundary={pinnedBoundary}
        />
      ))}
    </>
  );
}

/**
 * Memoized body rows: skip re-renders during active column resize.
 * Column widths update via CSS variables on the <table> element,
 * so the browser handles width changes without React re-renders.
 */
const MemoizedDataGridTableBodyRows = memo(
  DataGridTableBodyRows,
  (_prev, next) =>
    Boolean(next.table.getState().columnSizingInfo.isResizingColumn)
) as typeof DataGridTableBodyRows;

function DataGridTableHeader() {
  const { table, props } = useDataGrid();
  const mergedHeaderGroups = getDataGridTableMergedHeaderGroups(table);
  const hasRightPinnedColumns = hasDataGridTableRightPinnedColumns(table);

  return (
    <DataGridTableViewport>
      <DataGridTableBase>
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
      </DataGridTableBase>
    </DataGridTableViewport>
  );
}

function DataGridTable({
  footerContent,
  label,
  renderHeader = true,
}: {
  footerContent?: ReactNode;
  label?: string;
  renderHeader?: boolean;
}) {
  const { table, props } = useDataGrid();
  const mergedHeaderGroups = getDataGridTableMergedHeaderGroups(table);
  const hasRightPinnedColumns = hasDataGridTableRightPinnedColumns(table);

  return (
    <DataGridTableViewport>
      <DataGridTableBase label={label}>
        {renderHeader && (
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
                {props.tableLayout?.columnsResizable &&
                hasRightPinnedColumns ? (
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
                {props.tableLayout?.columnsResizable &&
                !hasRightPinnedColumns ? (
                  <DataGridTableFillHeadCell />
                ) : null}
              </DataGridTableHeadRow>
            ))}
          </DataGridTableHead>
        )}

        {renderHeader &&
          (props.tableLayout?.stripped || !props.tableLayout?.rowBorder) && (
            <DataGridTableRowSpacer />
          )}

        <DataGridTableBody>
          <MemoizedDataGridTableBodyRows table={table} />
        </DataGridTableBody>

        {footerContent && (
          <DataGridTableFoot>{footerContent}</DataGridTableFoot>
        )}
      </DataGridTableBase>
    </DataGridTableViewport>
  );
}

export {
  DataGridTable,
  DataGridTableBase,
  DataGridTableBody,
  DataGridTableBodyRow,
  DataGridTableBodyRowCell,
  DataGridTableBodyRowExpandded,
  DataGridTableRenderedRow,
  DataGridTableEmpty,
  DataGridTableFillBodyCell,
  DataGridTableFillHeadCell,
  DataGridTableFoot,
  DataGridTableFootRow,
  DataGridTableFootRowCell,
  DataGridTableHeader,
  DataGridTableHead,
  DataGridTableHeadRow,
  DataGridTableHeadRowCell,
  DataGridTableHeadRowCellResize,
  DataGridTableRowExpand,
  DataGridTableRowPin,
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
  DataGridTableRowSpacer,
  DataGridTableViewport,
  DATA_GRID_LAYOUT_RESIZE_END_EVENT,
  getDataGridLayoutResizeRoot,
  getDataGridScrollAreaViewport,
  getDataGridTableMergedHeaderGroups,
  getPinningStyles,
  getDataGridTableResolvedRows,
  getDataGridTableRowSections,
  getDataGridTreeIndentStyle,
  hasDataGridTableRightPinnedColumns,
};

export type { DataGridTablePinnedBoundary };
