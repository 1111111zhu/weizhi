"use client";

import type {
  CmpAcceptanceDraftListItem,
  CmpClient,
  CmpEngagement,
  CmpEngagementServiceType,
  CmpEngagementStatus,
} from "@project-wing/shared";
import { Button, ButtonGroup } from "@project-wing/ui";
import type { ProjectWingMasterDataGridProps } from "@project-wing/ui";
import { Archive, FileText, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { useCmpI18n } from "@/i18n/client";
import type { CmpDictionary } from "@/i18n/client";

import { CmpDataGridStatusBadge } from "./cmp-data-grid-status-badge";
import {
  CmpMasterDataGrid,
  CmpMasterDataGridColumnHeader,
  cmpSelectedValuesFilter,
} from "./cmp-master-data-grid";
import {
  CmpMasterDraftActions,
  CmpMasterDraftLink,
  CmpMasterDraftRowMeta,
  CmpShowDraftsButton,
  getCmpMasterDraftHref,
  isCmpEngagementDraftRow,
  toCmpEngagementDraftRow,
} from "./cmp-master-drafts-section";

type WorkspaceCopy = CmpDictionary["workspace"];
type CmpEngagementColumn =
  ProjectWingMasterDataGridProps<CmpEngagement>["columns"][number];

const COMPACT_HIDDEN_ENGAGEMENT_COLUMNS = [
  "reportDate",
  "approvalNumber",
  "pic",
  "mic",
  "remarks",
];
const EMPTY_CMP_DRAFTS: CmpAcceptanceDraftListItem[] = [];

export function CmpEngagementsDataGrid({
  archiveCount = 0,
  canEdit,
  clients,
  copy,
  drafts = EMPTY_CMP_DRAFTS,
  engagements,
  onEdit,
  onOpenFeeNote,
  onPreview,
  leadingActions,
  serviceTypeLabels,
  statusLabels,
  trailingActions,
  onDeleteDraft,
}: {
  archiveCount?: number;
  canEdit: boolean;
  clients: CmpClient[];
  copy: WorkspaceCopy;
  drafts?: CmpAcceptanceDraftListItem[];
  engagements: CmpEngagement[];
  onEdit: (engagement: CmpEngagement) => void;
  onOpenFeeNote?: (engagement: CmpEngagement) => void;
  onPreview: (engagement: CmpEngagement) => void;
  leadingActions?: ReactNode;
  serviceTypeLabels: Record<CmpEngagementServiceType, string>;
  statusLabels: Record<CmpEngagementStatus, string>;
  trailingActions?: ReactNode;
  onDeleteDraft?: (id: string) => Promise<unknown>;
}) {
  const { locale, localizedPath } = useCmpI18n();
  const [showDrafts, setShowDrafts] = useState(false);
  const menuCopy = useMemo(
    () => ({
      clear: copy.clearFilters,
      empty: copy.filterNoResults,
      filter: copy.filter,
      search: copy.filterSearch,
    }),
    [copy]
  );
  const draftRows = useMemo(
    () => drafts.map((draft) => toCmpEngagementDraftRow(draft, clients)),
    [clients, drafts]
  );
  const rows = useMemo(
    () => (showDrafts ? draftRows : engagements),
    [draftRows, engagements, showDrafts]
  );
  const columns = useMemo<CmpEngagementColumn[]>(() => {
    const textColumn = (
      id: string,
      title: string,
      accessorFn: (row: CmpEngagement) => string,
      size = 140,
      hiddenOnCompact = false
    ): CmpEngagementColumn => ({
      accessorFn,
      id,
      header: ({ column }) => (
        <CmpMasterDataGridColumnHeader
          column={column}
          copy={menuCopy}
          title={title}
        />
      ),
      cell: ({ getValue }) => (
        <span className="block truncate font-medium text-foreground">
          {String(getValue() || "-")}
        </span>
      ),
      enableHiding: true,
      enableResizing: true,
      enableSorting: true,
      filterFn: cmpSelectedValuesFilter,
      meta: {
        autoSize: true,
        cellClassName: hiddenOnCompact
          ? "cmp-grid-secondary-column"
          : undefined,
        headerClassName: hiddenOnCompact
          ? "cmp-grid-secondary-column"
          : undefined,
        headerTitle: title,
      },
      size,
    });

    return [
      {
        accessorKey: "engagementCode",
        id: "engagementCode",
        header: ({ column }) => (
          <CmpMasterDataGridColumnHeader
            column={column}
            copy={menuCopy}
            title={copy.engagementCode}
          />
        ),
        cell: ({ row }) =>
          isCmpEngagementDraftRow(row.original) ? (
            <CmpMasterDraftLink
              draft={row.original.__cmpDraft}
              returnTo="/engagement"
            >
              <strong className="block truncate font-medium text-foreground">
                {row.original.engagementCode}
              </strong>
              <CmpMasterDraftRowMeta draft={row.original.__cmpDraft} />
            </CmpMasterDraftLink>
          ) : (
            <Button
              type="button"
              variant="quiet"
              size="md"
              className="h-auto min-w-0 justify-start p-0 text-left hover:bg-transparent hover:text-primary"
              accessibleName={copy.previewEngagement.replace(
                "{engagementCode}",
                row.original.engagementCode
              )}
              onClick={(event) => {
                event.stopPropagation();
                onPreview(row.original);
              }}
            >
              <span className="block truncate font-medium">
                {row.original.engagementCode}
              </span>
            </Button>
          ),
        enableHiding: true,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: { autoSize: true, headerTitle: copy.engagementCode },
        size: 140,
      },
      {
        accessorFn: (row) =>
          `${row.client.clientCode} ${row.client.nameEn || row.client.nameZh}`,
        id: "client",
        header: ({ column }) => (
          <CmpMasterDataGridColumnHeader
            column={column}
            copy={menuCopy}
            title={copy.client}
          />
        ),
        cell: ({ row }) => (
          <span className="block min-w-0">
            <strong className="block truncate font-medium text-foreground">
              {row.original.client.clientCode}
            </strong>
            <span className="block truncate text-muted-foreground">
              {row.original.client.nameEn || row.original.client.nameZh}
            </span>
          </span>
        ),
        enableHiding: true,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: { autoSize: true, headerTitle: copy.client },
        size: 200,
      },
      textColumn(
        "serviceType",
        copy.serviceType,
        (row) => serviceTypeLabels[row.serviceType],
        120
      ),
      textColumn(
        "yearEndDate",
        copy.yearEnd,
        (row) => row.yearEndDate ?? "-",
        110
      ),
      textColumn(
        "reportDate",
        copy.reportDate,
        (row) => row.reportDate ?? "-",
        120,
        true
      ),
      textColumn(
        "approvalNumber",
        copy.approvalNumber,
        (row) => row.approvalReferenceNumber ?? "-",
        170,
        true
      ),
      textColumn("pic", "PIC", (row) => row.pic ?? "-", 120, true),
      textColumn("mic", "MIC", (row) => row.mic ?? "-", 120, true),
      {
        accessorFn: (row) => statusLabels[row.status],
        id: "status",
        header: ({ column }) => (
          <CmpMasterDataGridColumnHeader
            column={column}
            copy={menuCopy}
            title={copy.status}
          />
        ),
        cell: ({ row }) =>
          isCmpEngagementDraftRow(row.original) ? (
            <CmpDataGridStatusBadge tone="warning">
              {copy.clientFormDraftStatus}
            </CmpDataGridStatusBadge>
          ) : (
            <CmpDataGridStatusBadge
              tone={
                row.original.status === "ACTIVE"
                  ? "success"
                  : row.original.status === "COMPLETED"
                    ? "info"
                    : "warning"
              }
            >
              {statusLabels[row.original.status]}
            </CmpDataGridStatusBadge>
          ),
        enableHiding: true,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: { autoSize: true, headerTitle: copy.status },
        size: 100,
      },
      textColumn(
        "remarks",
        copy.remarks,
        (row) => row.remarks ?? "-",
        230,
        true
      ),
      {
        id: "actions",
        header: copy.actions,
        cell: ({ row }) =>
          isCmpEngagementDraftRow(row.original) ? (
            <CmpMasterDraftActions
              draft={row.original.__cmpDraft}
              returnTo="/engagement"
              handleDeleteDraft={onDeleteDraft}
            />
          ) : canEdit ? (
            <ButtonGroup>
              {onOpenFeeNote ? (
                <Button
                  type="button"
                  variant="quiet"
                  size="sm"
                  className="text-secondary-foreground/80"
                  accessibleName={copy.feeNoteOpen}
                  tooltip={copy.feeNoteOpen}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenFeeNote(row.original);
                  }}
                >
                  <FileText />
                  {copy.feeNote}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="quiet"
                size="icon-sm"
                className="text-secondary-foreground/80"
                accessibleName={copy.edit}
                tooltip={copy.edit}
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(row.original);
                }}
              >
                <Pencil />
              </Button>
            </ButtonGroup>
          ) : null,
        enableHiding: false,
        enableResizing: false,
        enableSorting: false,
        meta: {
          cellClassName: "text-secondary-foreground/80",
          headerClassName: "text-secondary-foreground/80",
          headerTitle: copy.actions,
        },
        size: 156,
      },
    ];
  }, [
    canEdit,
    copy,
    menuCopy,
    onDeleteDraft,
    onEdit,
    onOpenFeeNote,
    onPreview,
    serviceTypeLabels,
    statusLabels,
  ]);

  return (
    <CmpMasterDataGrid
      mobile={{
        titleColumn: "engagementCode",
        summaryColumns: ["client", "status"],
        filterColumn: "status",
      }}
      key={showDrafts ? "drafts" : "records"}
      columnVisibilityLabel={copy.dataGridColumns}
      columns={columns}
      compactHiddenColumnIds={COMPACT_HIDDEN_ENGAGEMENT_COLUMNS}
      data={rows}
      emptyMessage={
        showDrafts
          ? locale === "zh-CN"
            ? "没有待完善的草稿"
            : "No drafts"
          : copy.noMatchingEngagements
      }
      initialSorting={[{ id: "engagementCode", desc: false }]}
      isRowSelectable={(row) => !isCmpEngagementDraftRow(row)}
      leadingActions={
        <>
          {showDrafts ? null : leadingActions}
          <CmpShowDraftsButton
            count={drafts.length}
            onPressedChange={setShowDrafts}
            pressed={showDrafts}
          />
          <Button
            className="h-8 gap-1.5 rounded-md px-2.5 text-[0.8rem]! font-semibold! whitespace-nowrap"
            nativeButton={false}
            render={
              <a
                href={localizedPath("/engagement/archive")}
                aria-label={locale === "zh-CN" ? "显示归档" : "Archived"}
              />
            }
            size="sm"
            variant="outline"
          >
            <Archive aria-hidden="true" className="size-3.5" />
            <span>{locale === "zh-CN" ? "显示归档" : "Archived"}</span>
            <span className="rounded-sm bg-emerald-500/15 px-1 text-[0.7rem] text-emerald-800 dark:text-emerald-200">
              {archiveCount}
            </span>
          </Button>
        </>
      }
      onRowClick={(row) => {
        if (isCmpEngagementDraftRow(row)) {
          window.location.assign(
            getCmpMasterDraftHref(row.__cmpDraft, "/engagement", localizedPath)
          );
          return;
        }
        onPreview(row);
      }}
      recordCount={showDrafts ? draftRows.length : engagements.length}
      showRowSelection={!showDrafts}
      testId="cmp-engagements-data-grid"
      title={
        showDrafts ? (locale === "zh-CN" ? "草稿" : "Drafts") : copy.engagements
      }
      trailingActions={showDrafts ? undefined : trailingActions}
    />
  );
}
