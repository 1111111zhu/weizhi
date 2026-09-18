"use client";

import type { CmpClient } from "@project-wing/shared";
import {
  Button,
  DataGridTableRowExpand,
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
} from "@project-wing/ui";
import type { ProjectWingMasterDataGridProps } from "@project-wing/ui";
import type { RefObject } from "react";

import { createCmpClientActionsColumn } from "./cmp-clients-data-grid-actions";
import {
  CmpClientColumnHeader,
  selectedValuesFilter,
} from "./cmp-clients-data-grid-column-filter";
import type { WorkspaceCopy } from "./cmp-clients-data-grid-column-filter";
import { CmpClientExpandedDetails } from "./cmp-clients-data-grid-details";
import {
  createServiceColumn,
  createStatusColumn,
} from "./cmp-clients-data-grid-service-columns";
import {
  formatCmpYearEndMonth,
  getCmpClientCompanyType,
  getCmpClientCountryCode,
  getCmpClientYearEndMonth,
} from "./cmp-clients-data-grid-utils";
import {
  CmpMasterDraftLink,
  CmpMasterDraftRowMeta,
  isCmpClientDraftRow,
} from "./cmp-master-drafts-section";

export type CmpClientGridActions = {
  canEdit: boolean;
  compact: boolean;
  mobile?: boolean;
  copy: WorkspaceCopy;
  localizedPath: (path: string) => string;
  loadingEditClientId: string | null;
  onEdit: (client: CmpClient) => void;
  onEngagements: (client: CmpClient) => void;
  onPreview: (client: CmpClient) => void;
  onSearchMaterials: (client: CmpClient) => void;
  onDeleteDraft?: (id: string) => Promise<unknown>;
  draftReturnTo: string;
};

type CmpClientColumn =
  ProjectWingMasterDataGridProps<CmpClient>["columns"][number] & {
    enableColumnOrdering?: boolean;
  };

export function buildCmpClientColumns(
  actionsRef: RefObject<CmpClientGridActions>
): CmpClientColumn[] {
  const { copy } = actionsRef.current;
  const simple = (
    id: keyof CmpClient,
    title: string,
    size = 150,
    autoSize = false
  ): CmpClientColumn => ({
    accessorKey: id,
    id: String(id),
    header: ({ column }) => (
      <CmpClientColumnHeader column={column} copy={copy} title={title} />
    ),
    cell: ({ row }) => (
      <span className="flex min-w-0 items-center gap-1.5 font-medium text-foreground">
        <span className="block truncate">
          {String(row.original[id] || "-")}
        </span>
      </span>
    ),
    enableHiding: true,
    filterFn: selectedValuesFilter,
    enableResizing: true,
    enableSorting: true,
    meta: { autoSize, headerTitle: title },
    size,
  });

  return [
    {
      id: "select",
      header: () => <DataGridTableRowSelectAll />,
      cell: ({ row }) => <DataGridTableRowSelect row={row} />,
      enableColumnOrdering: false,
      enableHiding: false,
      enablePinning: false,
      enableResizing: false,
      enableSorting: false,
      size: 36,
    },
    {
      accessorFn: (client) =>
        client.nameEn || client.nameZh || client.clientCode,
      id: "clientName",
      header: ({ column }) => (
        <CmpClientColumnHeader
          column={column}
          copy={copy}
          title={copy.client}
        />
      ),
      cell: ({ row }) => {
        const draft = isCmpClientDraftRow(row.original)
          ? row.original.__cmpDraft
          : null;
        const primaryName =
          row.original.nameEn || row.original.nameZh || row.original.clientCode;
        const secondaryName =
          row.original.nameZh === primaryName ? null : row.original.nameZh;
        return (
          <div className="flex min-w-0 items-center gap-2">
            {draft ? null : (
              <DataGridTableRowExpand
                row={row}
                className="[&>button]:justify-start [&>button>svg]:-translate-x-1.5"
                expandLabel={copy.dataGridExpandDetails}
                collapseLabel={copy.dataGridCollapseDetails}
              />
            )}
            {draft ? (
              <CmpMasterDraftLink
                draft={draft}
                returnTo={actionsRef.current.draftReturnTo}
              >
                <strong className="block truncate font-medium text-foreground">
                  {primaryName}
                </strong>
                {secondaryName ? (
                  <span className="block truncate text-muted-foreground">
                    {secondaryName}
                  </span>
                ) : null}
                <CmpMasterDraftRowMeta draft={draft} />
              </CmpMasterDraftLink>
            ) : (
              <Button
                type="button"
                variant="quiet"
                size="md"
                className="h-auto min-w-0 justify-start p-0 text-left hover:bg-transparent hover:text-primary"
                accessibleName={actionsRef.current.copy.previewClient.replace(
                  "{clientCode}",
                  row.original.clientCode
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  actionsRef.current.onPreview(row.original);
                }}
              >
                <span className="min-w-0">
                  <strong className="block truncate font-medium text-foreground">
                    {primaryName}
                  </strong>
                  {secondaryName ? (
                    <span className="block truncate text-muted-foreground">
                      {secondaryName}
                    </span>
                  ) : null}
                </span>
              </Button>
            )}
          </div>
        );
      },
      enableHiding: false,
      filterFn: selectedValuesFilter,
      enableResizing: true,
      enableSorting: true,
      meta: {
        autoSize: true,
        expandedContent: (client) => (
          <CmpClientExpandedDetails client={client} copy={copy} />
        ),
        headerTitle: copy.client,
      },
      size: 260,
    },
    simple("clientCode", copy.clientCode, 120, true),
    simple("companyCode", copy.companyCode, 128, true),
    {
      accessorFn: (client) => client.group?.groupCode || "-",
      id: "groupCode",
      header: ({ column }) => (
        <CmpClientColumnHeader
          column={column}
          copy={copy}
          title={copy.groupCode}
        />
      ),
      cell: ({ row }) => (
        <span className="block truncate font-medium text-foreground">
          {row.original.group?.groupCode || "-"}
        </span>
      ),
      enableHiding: true,
      enableResizing: true,
      enableSorting: true,
      filterFn: selectedValuesFilter,
      meta: { autoSize: true, headerTitle: copy.groupCode },
      size: 112,
    },
    simple("companyNumber", copy.companyNumber, 128, true),
    {
      accessorFn: (client) => getCmpClientCompanyType(client) || "UNRECORDED",
      id: "companyType",
      header: ({ column }) => (
        <CmpClientColumnHeader
          column={column}
          copy={copy}
          title={copy.companyType}
        />
      ),
      cell: ({ row }) => {
        const companyType = getCmpClientCompanyType(row.original);
        const countryCode = getCmpClientCountryCode(row.original);
        const countryName = row.original.placeOfIncorporation;
        const companyTypeLabel =
          companyType === "PRIVATE"
            ? copy.companyTypePrivate
            : companyType === "LISTED"
              ? copy.companyTypeListed
              : companyType === "OTHER"
                ? copy.companyTypeOther
                : copy.dataGridNoValue;
        return (
          <span className="inline-flex items-center gap-2 font-medium text-foreground">
            {countryCode ? (
              <img
                src={`https://flagcdn.com/${countryCode.toLowerCase()}.svg`}
                alt={countryName || countryCode}
                className="size-4 rounded-full object-cover"
              />
            ) : null}
            {companyTypeLabel}
          </span>
        );
      },
      enableHiding: true,
      enableResizing: true,
      enableSorting: true,
      filterFn: selectedValuesFilter,
      meta: {
        autoSize: true,
        filterValueLabel: (value) =>
          value === "PRIVATE"
            ? copy.companyTypePrivate
            : value === "LISTED"
              ? copy.companyTypeListed
              : value === "OTHER"
                ? copy.companyTypeOther
                : copy.dataGridNoValue,
        headerTitle: copy.companyType,
      },
      size: 132,
    },
    {
      accessorFn: getCmpClientYearEndMonth,
      id: "yearEndDate",
      header: ({ column }) => (
        <CmpClientColumnHeader
          column={column}
          copy={copy}
          title={copy.yearEnd}
        />
      ),
      cell: ({ row }) => (
        <span className="block truncate font-medium text-foreground">
          {formatCmpYearEndMonth(getCmpClientYearEndMonth(row.original))}
        </span>
      ),
      enableHiding: true,
      enableResizing: true,
      enableSorting: true,
      filterFn: selectedValuesFilter,
      meta: {
        filterValueLabel: (value) =>
          formatCmpYearEndMonth(typeof value === "number" ? value : null),
        headerTitle: copy.yearEnd,
      },
      minSize: 148,
      size: 148,
    },
    createServiceColumn("audit", "Audit", copy.audit, copy),
    createServiceColumn("tax", "Tax", copy.tax, copy),
    createServiceColumn("risk", "Risk", copy.risk, copy),
    createStatusColumn(copy),
    createCmpClientActionsColumn(actionsRef),
  ];
}
