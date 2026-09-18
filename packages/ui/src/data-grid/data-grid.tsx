"use client";
"use no memo";

import type {
  Column,
  ColumnFiltersState,
  RowData,
  SortingState,
  Table,
} from "@tanstack/react-table";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { useCompactViewport } from "../hooks/use-compact-viewport";
import { cn } from "../utils";
import { createDataGridAutoSizeController } from "./data-grid-auto-size";
import type { DataGridAutoSizeController } from "./data-grid-auto-size";
import type { DataGridLocale } from "./data-grid-copy";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    headerTitle?: string;
    headerClassName?: string;
    cellClassName?: string;
    expandedContent?: (row: TData) => ReactNode;
    autoSize?: boolean;
    filterValueLabel?: (value: unknown) => string;
  }
}

/** Label for headers / column visibility: `meta.headerTitle`, string `columnDef.header`, or `column.id`. */
export function getColumnHeaderLabel<TData, TValue>(
  column: Column<TData, TValue>
): string {
  const meta = column.columnDef.meta as { headerTitle?: string } | undefined;
  if (typeof meta?.headerTitle === "string") {
    return meta.headerTitle;
  }
  const defHeader = column.columnDef.header;
  if (typeof defHeader === "string") {
    return defHeader;
  }
  return String(column.id);
}

export type DataGridApiFetchParams = {
  pageIndex: number;
  pageSize: number;
  sorting?: SortingState;
  filters?: ColumnFiltersState;
  searchQuery?: string;
};

export type DataGridApiResponse<T> = {
  data: T[];
  empty: boolean;
  pagination: {
    total: number;
    page: number;
  };
};

export interface DataGridContextProps<TData extends object> {
  props: DataGridProps<TData>;
  table: Table<TData>;
  recordCount: number;
  isLoading: boolean;
  /**
   * Internal coordinator for `meta.autoSize` columns. Lives at the core level
   * so every table variant and viewport instance shares one application state.
   */
  autoSize?: DataGridAutoSizeController;
}

export type DataGridRequestParams = {
  pageIndex: number;
  pageSize: number;
  sorting?: SortingState;
  columnFilters?: ColumnFiltersState;
};

export interface DataGridProps<TData extends object> {
  locale?: DataGridLocale;
  className?: string;
  table?: Table<TData>;
  recordCount: number;
  children?: ReactNode;
  onRowClick?: (row: TData) => void;
  rowProps?: (row: TData) => Omit<ComponentPropsWithoutRef<"tr">, "children">;
  rowClassName?: (row: TData) => string | undefined;
  isLoading?: boolean;
  allRowsLoadedMessage?: ReactNode | string;
  emptyMessage?: ReactNode | string;
  tableLayout?: {
    dense?: boolean;
    cellBorder?: boolean;
    rowBorder?: boolean;
    rowRounded?: boolean;
    stripped?: boolean;
    headerBackground?: boolean;
    footerBackground?: boolean;
    headerBorder?: boolean;
    headerSticky?: boolean;
    width?: "auto" | "fixed";
    columnsVisibility?: boolean;
    columnsResizable?: boolean;
    columnsResizeMode?: "onChange" | "onEnd";
    columnsPinnable?: boolean;
    columnsMovable?: boolean;
    columnsDraggable?: boolean;
    rowsDraggable?: boolean;
    rowsPinnable?: boolean;
  };
  tableClassNames?: {
    base?: string;
    header?: string;
    headerRow?: string;
    headerSticky?: string;
    body?: string;
    bodyRow?: string;
    footer?: string;
    edgeCell?: string;
  };
}

const DataGridContext = createContext<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DataGridContextProps<any> | undefined
>(undefined);

function useDataGrid() {
  const context = useContext(DataGridContext);
  if (!context) {
    throw new Error("useDataGrid must be used within a DataGridProvider");
  }
  return context;
}

function DataGridProvider<TData extends object>({
  children,
  table,
  ...props
}: DataGridProps<TData> & { table: Table<TData> }) {
  const tableState = table.getState();
  const isMobile = useCompactViewport(767);
  // Latest-props ref: context reads always resolve fresh props through the
  // Getter below without the memoized context value depending on unstable
  // ReactNode/function prop identities (inline emptyMessage/onRowClick would
  // Otherwise publish a new context value on every consumer render - at
  // Mousemove rate during a resize drag, piercing the body-rows memo).
  const propsRef = useRef(props);
  propsRef.current = props;

  // Re-assert an explicit tableLayout resize mode after mount so
  // consumer-level useReactTable options cannot flip it back between drags.
  // This used to mutate the table while React was rendering, which React 19
  // can report as a state update before the grid has mounted.
  const columnResizeMode =
    props.tableLayout?.columnsResizable && props.tableLayout.columnsResizeMode
      ? props.tableLayout.columnsResizeMode
      : undefined;
  useLayoutEffect(() => {
    if (!columnResizeMode) {
      return;
    }
    table.options.columnResizeMode = columnResizeMode;
  }, [columnResizeMode, table]);

  // One autoSize coordinator per table instance so split header/body viewports
  // Cannot apply the growth twice.
  const autoSize = useMemo(
    () => createDataGridAutoSizeController(table, isMobile),
    [table, isMobile]
  );
  // Memoize context value so consumers don't re-render during column resize.
  // Column sizing state is intentionally excluded from deps -- CSS variables
  // On the <table> element handle width updates without React re-renders.
  // ReactNode/function props (messages, onRowClick) are also excluded: they
  // Are served fresh through the props getter, so unstable inline identities
  // Cannot invalidate the context value.
  const value = useMemo(
    () => ({
      get props() {
        return propsRef.current;
      },
      table,
      recordCount: props.recordCount,
      isLoading: props.isLoading || false,
      autoSize,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      table,
      autoSize,
      props.recordCount,
      props.isLoading,
      props.locale,
      props.className,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(props.tableLayout),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(props.tableClassNames),
      tableState.sorting,
      tableState.pagination,
      tableState.columnFilters,
      tableState.rowSelection,
      tableState.rowPinning,
      tableState.expanded,
      tableState.columnVisibility,
      tableState.columnOrder,
      tableState.columnPinning,
      tableState.globalFilter,
    ]
  );

  return (
    <DataGridContext.Provider value={value}>
      {children}
    </DataGridContext.Provider>
  );
}

function DataGrid<TData extends object>({
  children,
  table,
  ...props
}: DataGridProps<TData>) {
  const defaultProps: Partial<DataGridProps<TData>> = {
    tableLayout: {
      dense: false,
      cellBorder: false,
      rowBorder: true,
      rowRounded: false,
      stripped: false,
      headerSticky: false,
      headerBackground: false,
      footerBackground: false,
      headerBorder: true,
      width: "fixed",
      columnsVisibility: false,
      columnsResizable: false,
      // ColumnsResizeMode has no default on purpose: when unset, the
      // Consumer's tanstack columnResizeMode (default "onEnd") is honored.
      columnsPinnable: false,
      columnsMovable: false,
      columnsDraggable: false,
      rowsDraggable: false,
      rowsPinnable: false,
    },
    tableClassNames: {
      base: "",
      header: "",
      headerRow: "",
      // Z-40 keeps the sticky header above pinned body cells (zIndex 30 in
      // GetPinningStyles), which would otherwise paint over it while
      // Scrolling vertically with columnsPinnable enabled.
      headerSticky: "sticky top-0 z-40 bg-card/95 backdrop-blur-xs",
      body: "",
      bodyRow: "",
      footer: "",
      edgeCell: "",
    },
  };
  const mergedProps: DataGridProps<TData> = {
    ...defaultProps,
    ...props,
    tableLayout: {
      ...defaultProps.tableLayout,
      ...props.tableLayout,
    },
    tableClassNames: {
      ...defaultProps.tableClassNames,
      ...props.tableClassNames,
    },
  };

  // Ensure table is provided
  if (!table) {
    throw new Error('DataGrid requires a "table" prop');
  }

  return (
    <DataGridProvider table={table} {...mergedProps}>
      {children}
    </DataGridProvider>
  );
}

function DataGridContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
  /** Accepted for backwards compatibility; currently has no effect. */
  border?: boolean;
}) {
  return (
    <div
      data-slot="data-grid"
      className={cn("w-full overflow-hidden bg-card", className)}
    >
      {children}
    </div>
  );
}

export { useDataGrid, DataGridProvider, DataGrid, DataGridContainer };
