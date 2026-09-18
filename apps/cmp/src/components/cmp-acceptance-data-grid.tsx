"use client";

import type {
  CmpAcceptanceRequest,
  CmpAcceptanceStatus,
} from "@project-wing/shared";
import type {
  DataGridColumnHeaderProps,
  ProjectWingMasterDataGridProps,
} from "@project-wing/ui";
import type { ReactNode } from "react";
import { useEffect, useMemo, useReducer, useRef } from "react";

import type { CmpDictionary } from "@/i18n/client";

import { CmpDataGridStatusBadge } from "./cmp-data-grid-status-badge";
import {
  CmpMasterDataGrid,
  CmpMasterDataGridColumnHeader,
  cmpSelectedValuesFilter,
} from "./cmp-master-data-grid";

type WorkspaceCopy = CmpDictionary["workspace"];
type AcceptanceGridProps = ProjectWingMasterDataGridProps<CmpAcceptanceRequest>;
type AcceptanceGridColumn = AcceptanceGridProps["columns"][number];

export function CmpAcceptanceDataGrid({
  copy,
  formatDate,
  getCurrentOwner,
  getStepLabel,
  getSubtitle,
  getTitle,
  getTypeLabel,
  getStatusLabel,
  initialColumnFilters,
  onRowClick,
  renderActions,
  requests,
  recentlyUpdatedRequestId,
  selectedRequestId,
  title,
  toolbarActions,
}: {
  copy: WorkspaceCopy;
  formatDate: (value: string | null) => string;
  getCurrentOwner: (request: CmpAcceptanceRequest) => string;
  getStepLabel: (request: CmpAcceptanceRequest) => string;
  getSubtitle: (request: CmpAcceptanceRequest) => string;
  getTitle: (request: CmpAcceptanceRequest) => string;
  getTypeLabel: (request: CmpAcceptanceRequest) => string;
  getStatusLabel: (status: CmpAcceptanceStatus) => string;
  initialColumnFilters?: AcceptanceGridProps["initialColumnFilters"];
  onRowClick: (request: CmpAcceptanceRequest) => void;
  renderActions: (request: CmpAcceptanceRequest) => ReactNode;
  requests: CmpAcceptanceRequest[];
  recentlyUpdatedRequestId?: string | null;
  selectedRequestId?: string | null;
  title: string;
  toolbarActions?: ReactNode;
}) {
  const menuCopy = useMemo(
    () => ({
      clear: copy.clearFilters,
      empty: copy.filterNoResults,
      filter: copy.filter,
      search: copy.filterSearch,
    }),
    [copy]
  );
  const callbacksRef = useRef({
    formatDate,
    getCurrentOwner,
    getStepLabel,
    getSubtitle,
    getTitle,
    getTypeLabel,
    getStatusLabel,
    renderActions,
  });
  const [, refreshLocalizedCallbacks] = useReducer(
    (value: number) => value + 1,
    0
  );
  useEffect(() => {
    callbacksRef.current = {
      formatDate,
      getCurrentOwner,
      getStepLabel,
      getSubtitle,
      getTitle,
      getTypeLabel,
      getStatusLabel,
      renderActions,
    };
  }, [
    formatDate,
    getCurrentOwner,
    getStatusLabel,
    getStepLabel,
    getSubtitle,
    getTitle,
    getTypeLabel,
    renderActions,
  ]);
  useEffect(() => {
    if (copy.view) {
      refreshLocalizedCallbacks();
    }
  }, [copy.view]);
  const columns = useMemo<AcceptanceGridColumn[]>(() => {
    const header = (headerTitle: string) =>
      function AcceptanceColumnHeader({
        column,
      }: {
        column: DataGridColumnHeaderProps<
          CmpAcceptanceRequest,
          unknown
        >["column"];
      }) {
        return (
          <CmpMasterDataGridColumnHeader
            column={column}
            copy={menuCopy}
            title={headerTitle}
          />
        );
      };

    return [
      {
        accessorKey: "requestNo",
        id: "requestNumber",
        header: header(copy.requestNumber),
        cell: ({ row }) => (
          <strong className="block truncate font-medium text-foreground">
            {row.original.requestNo}
          </strong>
        ),
        enableHiding: true,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: { autoSize: true, headerTitle: copy.requestNumber },
        size: 180,
      },
      {
        accessorFn: (request) => callbacksRef.current.getTypeLabel(request),
        id: "type",
        header: header(copy.type),
        cell: ({ row }) => (
          <span className="block truncate font-medium text-foreground">
            {callbacksRef.current.getTypeLabel(row.original)}
          </span>
        ),
        enableHiding: true,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: { autoSize: true, headerTitle: copy.type },
        size: 150,
      },
      {
        accessorFn: (request) =>
          `${callbacksRef.current.getTitle(request)} ${callbacksRef.current.getSubtitle(request)}`,
        id: "clientOrEngagement",
        header: header(copy.clientOrEngagement),
        cell: ({ row }) => (
          <span className="block min-w-0">
            <strong className="block truncate font-medium text-foreground">
              {callbacksRef.current.getTitle(row.original)}
            </strong>
            <span className="block truncate text-muted-foreground">
              {callbacksRef.current.getSubtitle(row.original)}
            </span>
          </span>
        ),
        enableHiding: true,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: { autoSize: true, headerTitle: copy.clientOrEngagement },
        size: 260,
      },
      {
        accessorFn: (request) =>
          `${callbacksRef.current.getCurrentOwner(request)} ${callbacksRef.current.getStepLabel(request)}`,
        id: "currentOwner",
        header: header(copy.currentOwner),
        cell: ({ row }) => (
          <span className="block min-w-0">
            <strong className="block truncate font-medium text-foreground">
              {callbacksRef.current.getCurrentOwner(row.original)}
            </strong>
            <span className="block truncate text-muted-foreground">
              {callbacksRef.current.getStepLabel(row.original)}
            </span>
          </span>
        ),
        enableHiding: true,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: { autoSize: true, headerTitle: copy.currentOwner },
        size: 160,
      },
      {
        accessorFn: (request) =>
          `${request.submittedBy.name} ${callbacksRef.current.formatDate(request.submittedAt)}`,
        id: "submittedBy",
        header: header(copy.submittedBy),
        cell: ({ row }) => (
          <span className="block min-w-0">
            <strong className="block truncate font-medium text-foreground">
              {row.original.submittedBy.name}
            </strong>
            <span className="block truncate text-muted-foreground">
              {callbacksRef.current.formatDate(row.original.submittedAt)}
            </span>
          </span>
        ),
        enableHiding: true,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: { autoSize: true, headerTitle: copy.submittedBy },
        size: 150,
      },
      {
        accessorFn: (request) =>
          callbacksRef.current.getStatusLabel(request.status),
        id: "status",
        header: header(copy.status),
        cell: ({ row }) => (
          <CmpDataGridStatusBadge
            tone={
              row.original.status === "APPROVED"
                ? "success"
                : row.original.status === "RETURNED"
                  ? "destructive"
                  : row.original.status === "PENDING_PIC"
                    ? "warning"
                    : ["PENDING_MIC", "PENDING_IT", "STAFF_EDITING"].includes(
                          row.original.status
                        )
                      ? "warning"
                      : "neutral"
            }
          >
            {callbacksRef.current.getStatusLabel(row.original.status)}
          </CmpDataGridStatusBadge>
        ),
        enableHiding: true,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: { autoSize: true, headerTitle: copy.status },
        size: 120,
      },
      {
        id: "actions",
        header: copy.action,
        cell: ({ row }) => callbacksRef.current.renderActions(row.original),
        enableHiding: false,
        enableResizing: false,
        enableSorting: false,
        meta: {
          cellClassName: "text-secondary-foreground/80",
          headerClassName: "text-secondary-foreground/80",
          headerTitle: copy.action,
        },
        size: 130,
      },
    ];
  }, [copy, menuCopy]);

  return (
    <CmpMasterDataGrid
      mobile={{
        titleColumn: "requestNumber",
        summaryColumns: ["clientOrEngagement", "type", "status"],
        filterColumn: "status",
      }}
      columns={columns}
      compactHiddenColumnIds={["submittedBy"]}
      data={requests}
      emptyMessage={copy.noAcceptanceRequests}
      initialColumnFilters={initialColumnFilters}
      initialSorting={[{ id: "requestNumber", desc: true }]}
      leadingActions={toolbarActions}
      onRowClick={onRowClick}
      rowClassName={(request) =>
        [
          request.id === selectedRequestId ? "is-selected" : "",
          request.id === recentlyUpdatedRequestId ? "is-recently-updated" : "",
        ]
          .filter(Boolean)
          .join(" ") || undefined
      }
      testId="cmp-acceptance-data-grid"
      title={title}
    />
  );
}
