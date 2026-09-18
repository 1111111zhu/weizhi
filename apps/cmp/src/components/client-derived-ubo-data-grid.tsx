"use client";

import type {
  DataGridColumnHeaderProps,
  ProjectWingMasterDataGridProps,
} from "@project-wing/ui";
import { useMemo } from "react";

import type { CmpDictionary } from "@/i18n/client";

import {
  CmpMasterDataGrid,
  CmpMasterDataGridColumnHeader,
  cmpSelectedValuesFilter,
} from "./cmp-master-data-grid";

export type DerivedUboRow = {
  key: string;
  owner: string;
  ownershipPercentage: number | null;
  status: "CONFIRMED" | "EXCLUDED" | "DATA_CONFLICT" | "LEGACY";
  explanation: string;
};

function formatPercentage(value: number | null) {
  if (value === null) {
    return null;
  }
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 4,
  }).format(value);
}

type WorkspaceCopy = CmpDictionary["workspace"];
type DerivedUboColumn =
  ProjectWingMasterDataGridProps<DerivedUboRow>["columns"][number];

export function ClientDerivedUboDataGrid({
  rows,
  copy,
}: {
  rows: DerivedUboRow[];
  copy: WorkspaceCopy;
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
  const columns = useMemo<DerivedUboColumn[]>(() => {
    const header = (title: string) =>
      function DerivedUboColumnHeader({
        column,
      }: {
        column: DataGridColumnHeaderProps<DerivedUboRow, unknown>["column"];
      }) {
        return (
          <CmpMasterDataGridColumnHeader
            column={column}
            copy={menuCopy}
            title={title}
          />
        );
      };
    return [
      {
        accessorKey: "owner",
        id: "owner",
        header: header(copy.clientFormBeneficialOwner),
        cell: ({ row }) => (
          <strong className="block truncate font-medium text-foreground">
            {row.original.owner}
          </strong>
        ),
        enableHiding: false,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: {
          autoSize: true,
          headerTitle: copy.clientFormBeneficialOwner,
        },
        size: 220,
      },
      {
        accessorKey: "ownershipPercentage",
        id: "ownershipPercentage",
        header: header(copy.clientFormConfirmedOwnershipPercentage),
        cell: ({ row }) => {
          const value = formatPercentage(row.original.ownershipPercentage);
          return (
            <span className="block truncate text-foreground tabular-nums">
              {value === null ? copy.clientFormNotProvided : `${value}%`}
            </span>
          );
        },
        enableHiding: false,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: {
          autoSize: true,
          headerTitle: copy.clientFormConfirmedOwnershipPercentage,
        },
        size: 150,
      },
      {
        accessorKey: "status",
        id: "status",
        header: header(copy.clientFormOwnershipAssessment),
        cell: ({ row }) => (
          <span className="block truncate text-foreground">
            {ownershipStatusLabel(row.original.status, copy)}
          </span>
        ),
        enableHiding: false,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: {
          autoSize: true,
          headerTitle: copy.clientFormOwnershipAssessment,
        },
        size: 180,
      },
      {
        accessorKey: "explanation",
        id: "explanation",
        header: header(copy.clientFormOwnershipExplanation),
        cell: ({ row }) => (
          <span className="block truncate text-foreground">
            {row.original.explanation}
          </span>
        ),
        enableHiding: false,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: {
          autoSize: true,
          headerTitle: copy.clientFormOwnershipExplanation,
        },
        size: 640,
      },
    ];
  }, [copy, menuCopy]);

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <h4 className="text-sm font-medium">
          {copy.clientFormUltimateBeneficialOwners}
        </h4>
        <span className="text-xs text-muted-foreground">{rows.length}</span>
      </div>
      <CmpMasterDataGrid
        mobile={{
          titleColumn: "owner",
          summaryColumns: ["ownershipPercentage", "status"],
        }}
        columns={columns}
        data={rows}
        emptyMessage={copy.clientFormUltimateBeneficialOwnersEmpty}
        getRowId={(row) => row.key}
        initialSorting={[]}
        showRecordCount={false}
        showRowSelection={false}
        showToolbar={false}
        tableLabel={copy.clientFormUltimateBeneficialOwners}
        tableLayout={{ headerSticky: false, columnsVisibility: false }}
        testId="cmp-client-derived-ubo-data-grid"
        title={copy.clientFormUltimateBeneficialOwners}
      />
    </section>
  );
}

function ownershipStatusLabel(
  status: DerivedUboRow["status"],
  copy: WorkspaceCopy
) {
  return {
    CONFIRMED: copy.clientFormOwnershipConfirmed,
    EXCLUDED: copy.clientFormOwnershipExcluded,
    DATA_CONFLICT: copy.clientFormOwnershipDataConflict,
    LEGACY: copy.clientFormLegacyBeneficialOwnerRecord,
  }[status];
}
