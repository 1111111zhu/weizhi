"use client";
"use no memo";

import type {
  CmpAcceptanceDraftListItem,
  CmpClient,
} from "@project-wing/shared";
import {
  Button,
  getSortedRowModelWithTrailingRows,
  getResponsiveColumnVisibility,
  useCompactViewport,
} from "@project-wing/ui";
import type {
  ColumnFiltersState,
  ExpandedState,
  RowSelectionState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import {
  getCoreRowModel,
  getExpandedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { DataGrid } from "@/components/reui/data-grid/data-grid";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTableVirtual } from "@/components/reui/data-grid/data-grid-table-virtual";
import { Frame, FramePanel } from "@/components/reui/frame";
import { useCmpI18n } from "@/i18n/client";
import { openCmpRecordPreviewWindow } from "@/lib/open-cmp-record-preview-window";

import { CmpClientEngagementsDialog } from "./cmp-client-engagements-dialog";
import { CmpClientSearchDocumentsSheet } from "./cmp-client-search-documents-sheet";
import { buildCmpClientColumns } from "./cmp-clients-data-grid-columns";
import type { CmpClientGridActions } from "./cmp-clients-data-grid-columns";
import { CmpClientsDataGridToolbar } from "./cmp-clients-data-grid-toolbar";
import {
  CmpShowDraftsButton,
  getCmpMasterDraftHref,
  isCmpClientDraftRow,
  toCmpClientDraftRow,
} from "./cmp-master-drafts-section";
import { CmpMobileGrid } from "./cmp-mobile-grid";

const COMPACT_CLIENT_GRID_WIDTH = 640;
const INITIAL_VISIBLE_ROWS = 25;
const NARROW_CLIENT_GRID_WIDTH = 512;
const ROW_FETCH_BATCH_SIZE = 25;
const COMPACT_HIDDEN_COLUMNS = [
  "groupCode",
  "companyCode",
  "companyNumber",
  "companyTypeOrSpecialIndustry",
  "yearEndDate",
] as const;
const NARROW_HIDDEN_COLUMNS = ["clientCode", "status"] as const;
const EMPTY_CMP_DRAFTS: CmpAcceptanceDraftListItem[] = [];
const INITIAL_CLIENT_COLUMN_VISIBILITY: VisibilityState = {
  audit: false,
  risk: false,
  tax: false,
};

function useResponsiveColumnVisibility(columnVisibility: VisibilityState) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [responsiveMode, setResponsiveMode] = useState<
    "default" | "compact" | "narrow"
  >("default");

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const sync = (width: number) => {
      if (width <= 0) {
        return;
      }
      setResponsiveMode(
        width <= NARROW_CLIENT_GRID_WIDTH
          ? "narrow"
          : width <= COMPACT_CLIENT_GRID_WIDTH
            ? "compact"
            : "default"
      );
    };
    sync(container.clientWidth);

    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        sync(entry.contentRect.width);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const effectiveColumnVisibility = useMemo(() => {
    if (responsiveMode === "default") {
      return columnVisibility;
    }
    const hiddenColumns = [
      ...COMPACT_HIDDEN_COLUMNS,
      ...(responsiveMode === "narrow" ? NARROW_HIDDEN_COLUMNS : []),
    ];
    return getResponsiveColumnVisibility(columnVisibility, hiddenColumns);
  }, [columnVisibility, responsiveMode]);

  return { containerRef, effectiveColumnVisibility, responsiveMode };
}

export function CmpClientsDataGrid({
  clients,
  drafts = EMPTY_CMP_DRAFTS,
  onEdit,
  canEdit,
  loadingEditClientId,
  canCreateClient,
  onCreateClient,
  onDeleteDraft,
}: {
  clients: CmpClient[];
  drafts?: CmpAcceptanceDraftListItem[];
  onEdit: (client: CmpClient) => void;
  canEdit: boolean;
  loadingEditClientId: string | null;
  canCreateClient: boolean;
  onCreateClient: () => void;
  onDeleteDraft?: (id: string) => Promise<unknown>;
}) {
  const { dictionary, localizedPath, locale } = useCmpI18n();
  const copy = dictionary.workspace;
  const mobile = useCompactViewport(767.98);
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "clientCode", desc: false },
  ]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    INITIAL_CLIENT_COLUMN_VISIBILITY
  );
  const [showDrafts, setShowDrafts] = useState(false);
  const { containerRef, effectiveColumnVisibility, responsiveMode } =
    useResponsiveColumnVisibility(columnVisibility);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [visibleRowCount, setVisibleRowCount] = useState(INITIAL_VISIBLE_ROWS);
  const [engagementClient, setEngagementClient] = useState<CmpClient | null>(
    null
  );
  const [searchMaterialsClient, setSearchMaterialsClient] =
    useState<CmpClient | null>(null);
  const handleDraftViewChange = (next: boolean) => {
    setShowDrafts(next);
    setColumnFilters([]);
    setExpanded({});
    setRowSelection({});
    setVisibleRowCount(INITIAL_VISIBLE_ROWS);
  };
  const draftRows = useMemo(() => drafts.map(toCmpClientDraftRow), [drafts]);
  const rows = useMemo(
    () => (showDrafts ? draftRows : clients),
    [clients, draftRows, showDrafts]
  );
  const sortedRowModel = useMemo(
    () => getSortedRowModelWithTrailingRows(isCmpClientDraftRow),
    []
  );
  const actionsRef = useRef<CmpClientGridActions>({
    canEdit,
    compact: responsiveMode !== "default",
    copy,
    localizedPath,
    loadingEditClientId,
    onEdit,
    onEngagements: setEngagementClient,
    onPreview: (client) =>
      openCmpRecordPreviewWindow(
        localizedPath(`/client/${encodeURIComponent(client.id)}`)
      ),
    onSearchMaterials: setSearchMaterialsClient,
    onDeleteDraft,
    draftReturnTo: "/client",
  });
  actionsRef.current = {
    mobile,
    canEdit,
    compact: responsiveMode !== "default",
    copy,
    localizedPath,
    loadingEditClientId,
    onEdit,
    onEngagements: setEngagementClient,
    onPreview: (client) =>
      mobile || window.matchMedia?.("(max-width: 767px)").matches
        ? router.push(localizedPath(`/client/${encodeURIComponent(client.id)}`))
        : openCmpRecordPreviewWindow(
            localizedPath(`/client/${encodeURIComponent(client.id)}`)
          ),
    onSearchMaterials: setSearchMaterialsClient,
    onDeleteDraft,
    draftReturnTo: "/client",
  };
  const columns = useMemo(() => buildCmpClientColumns(actionsRef), []);
  const table = useReactTable({
    initialState: { columnVisibility: INITIAL_CLIENT_COLUMN_VISIBILITY },
    columns,
    data: rows,
    enableRowSelection: (row) => !isCmpClientDraftRow(row.original),
    getRowId: (client) => client.id,
    getRowCanExpand: (row) => !isCmpClientDraftRow(row.original),
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: sortedRowModel,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: (updater) => {
      setColumnFilters(updater);
      setVisibleRowCount(INITIAL_VISIBLE_ROWS);
    },
    onExpandedChange: setExpanded,
    onRowSelectionChange: setRowSelection,
    onSortingChange: (updater) => {
      setSorting(updater);
      setVisibleRowCount(INITIAL_VISIBLE_ROWS);
    },
    state: {
      columnVisibility: effectiveColumnVisibility,
      columnFilters,
      expanded,
      rowSelection,
      sorting,
    },
  });

  const filteredRows = table
    .getFilteredRowModel()
    .rows.map(({ original }) => original);
  const filteredClientCount = filteredRows.length;
  const hasMoreRows = visibleRowCount < filteredRows.length;

  return (
    <>
      <DataGrid
        locale={locale}
        emptyMessage={copy.noMatchingClients}
        onRowClick={(client) => {
          if (isCmpClientDraftRow(client)) {
            window.location.assign(
              getCmpMasterDraftHref(client.__cmpDraft, "/client", localizedPath)
            );
            return;
          }
          table.getRow(client.id)?.toggleExpanded();
        }}
        recordCount={filteredClientCount}
        table={table}
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
        }}
      >
        <Frame
          ref={containerRef}
          className="h-full min-h-0 w-full max-w-full min-w-0 overflow-hidden [&_td]:border-border [&_th]:border-border"
          data-testid="cmp-clients-data-grid"
          dense
          stacked
        >
          {mobile ? (
            <CmpMobileGrid
              profile={{
                titleColumn: "clientName",
                openLabel: (client: CmpClient) =>
                  copy.previewClient.replace("{clientCode}", client.clientCode),
                actionsColumn: "actions",
                summaryColumns: ["clientCode", "status"],
                filterColumn: "status",
              }}
              title={
                showDrafts
                  ? locale === "zh-CN"
                    ? "草稿"
                    : "Drafts"
                  : copy.client
              }
              selection={!showDrafts}
              onOpen={(client: CmpClient) => {
                if (isCmpClientDraftRow(client)) {
                  router.push(
                    getCmpMasterDraftHref(
                      client.__cmpDraft,
                      "/client",
                      localizedPath
                    )
                  );
                } else {
                  actionsRef.current.onPreview(client);
                }
              }}
              actions={
                <>
                  <CmpShowDraftsButton
                    count={drafts.length}
                    onPressedChange={handleDraftViewChange}
                    pressed={showDrafts}
                  />
                  {canCreateClient && !showDrafts && (
                    <Button variant="primary" onClick={onCreateClient}>
                      {copy.newClient}
                    </Button>
                  )}
                </>
              }
            />
          ) : (
            <>
              <CmpClientsDataGridToolbar
                canCreateClient={canCreateClient}
                draftToggle={
                  <CmpShowDraftsButton
                    count={drafts.length}
                    onPressedChange={handleDraftViewChange}
                    pressed={showDrafts}
                  />
                }
                isDraftView={showDrafts}
                onCreateClient={onCreateClient}
                recordCount={filteredClientCount}
                table={table}
              />
              <FramePanel className="min-h-0 p-0 shadow-none">
                <DataGridScrollArea
                  orientation="both"
                  className="h-full min-h-0"
                >
                  <DataGridTableVirtual
                    estimateSize={52}
                    hasMore={hasMoreRows ? true : undefined}
                    onFetchMore={() =>
                      setVisibleRowCount((count) =>
                        Math.min(
                          count + ROW_FETCH_BATCH_SIZE,
                          filteredRows.length
                        )
                      )
                    }
                    overscan={12}
                    visibleRowCount={visibleRowCount}
                    virtualizerOptions={{
                      enabled: process.env.NODE_ENV !== "test",
                    }}
                  />
                </DataGridScrollArea>
              </FramePanel>
            </>
          )}
        </Frame>
      </DataGrid>
      <CmpClientEngagementsDialog
        client={engagementClient}
        onOpenChange={(open) => {
          if (!open) {
            setEngagementClient(null);
          }
        }}
      />
      <CmpClientSearchDocumentsSheet
        client={searchMaterialsClient}
        canEdit={canEdit}
        onOpenChange={(open) => {
          if (!open) {
            setSearchMaterialsClient(null);
          }
        }}
      />
    </>
  );
}
