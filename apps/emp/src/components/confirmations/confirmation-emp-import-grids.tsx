"use client";

import {
  DataGridColumnHeader,
  ProjectWingMasterDataGrid,
} from "@project-wing/ui";
import type { ProjectWingMasterDataGridProps } from "@project-wing/ui";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import type { ConfirmationEmpImportPreviewItem } from "../../api/client";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";

type ImportGridCopy = {
  folderContents: string;
  importedFiles: string;
  childCode: string;
  fileName: string;
  validation: string;
  targetLocation: string;
  source: string;
  code: string;
  name: string;
  invalidIdentity: string;
  willAutoRename: string;
  ready: string;
  importedStatus: string;
  targetRecycled: string;
  targetMissing: string;
  targetChanged: string;
  targetUnverified: string;
  withdrawAction: string;
  withdrawConfirmSelected: string;
  withdrawCancel: string;
  withdrawSelectAll: string;
  withdrawSelectFile: string;
};

type EditedItem = { code: string; name: string };

function formatFileSize(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function gridColumn(
  column: ProjectWingMasterDataGridProps<ConfirmationEmpImportPreviewItem>["columns"][number]
) {
  return column;
}

export function ConfirmationGroupedImportDataGrid({
  copy,
  disabled,
  editedItems,
  invalidItemIds,
  itemCodeCounts,
  items,
  onCodeChange,
}: {
  copy: ImportGridCopy;
  disabled: boolean;
  editedItems: Record<string, EditedItem>;
  invalidItemIds: Set<string>;
  itemCodeCounts: Map<string, number>;
  items: ConfirmationEmpImportPreviewItem[];
  onCodeChange: (item: ConfirmationEmpImportPreviewItem, value: string) => void;
}) {
  const columns = useMemo<
    ProjectWingMasterDataGridProps<ConfirmationEmpImportPreviewItem>["columns"]
  >(
    () => [
      gridColumn({
        id: "childCode",
        accessorFn: (item) => editedItems[item.id]?.code ?? item.proposedCode,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={copy.childCode} />
        ),
        cell: ({ row }) => {
          const edited = editedItems[row.original.id] ?? {
            code: row.original.proposedCode,
            name: row.original.proposedName,
          };
          return (
            <Input
              label={`${copy.childCode}: ${row.original.sourceFileName}`}
              value={edited.code}
              disabled={disabled}
              onChange={(event) =>
                onCodeChange(row.original, event.target.value)
              }
              className="font-mono"
            />
          );
        },
        meta: { headerTitle: copy.childCode },
        minSize: 190,
        size: 210,
      }),
      gridColumn({
        id: "fileName",
        accessorFn: (item) => item.sourceFileName,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={copy.fileName} />
        ),
        cell: ({ row }) => (
          <div>
            <div className="font-medium break-all whitespace-normal">
              {row.original.sourceFileName}
            </div>
            <div className="text-xs text-muted-foreground">
              {row.original.counterparty} ·{" "}
              {formatFileSize(row.original.sourceFileSize)}
            </div>
          </div>
        ),
        meta: { headerTitle: copy.fileName, autoSize: true },
        minSize: 260,
        size: 360,
      }),
      gridColumn({
        id: "validation",
        accessorFn: (item) => {
          const edited = editedItems[item.id] ?? {
            code: item.proposedCode,
            name: item.proposedName,
          };
          const normalizedCode = edited.code.trim().toLocaleLowerCase();
          const invalid = invalidItemIds.has(item.id);
          const willRename =
            !invalid &&
            normalizedCode.length > 0 &&
            (itemCodeCounts.get(normalizedCode) ?? 0) > 1;
          return invalid
            ? copy.invalidIdentity
            : willRename
              ? copy.willAutoRename
              : copy.ready;
        },
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={copy.validation} />
        ),
        cell: ({ row }) => {
          const edited = editedItems[row.original.id] ?? {
            code: row.original.proposedCode,
            name: row.original.proposedName,
          };
          const normalizedCode = edited.code.trim().toLocaleLowerCase();
          const invalid = invalidItemIds.has(row.original.id);
          const willRename =
            !invalid &&
            normalizedCode.length > 0 &&
            (itemCodeCounts.get(normalizedCode) ?? 0) > 1;
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-sm font-medium",
                invalid
                  ? "text-destructive"
                  : willRename
                    ? "text-amber-600"
                    : "text-emerald-600"
              )}
            >
              {invalid ? (
                <AlertCircle className="size-4" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              {invalid
                ? copy.invalidIdentity
                : willRename
                  ? copy.willAutoRename
                  : copy.ready}
            </span>
          );
        },
        meta: { headerTitle: copy.validation },
        minSize: 130,
        size: 140,
      }),
    ],
    [copy, disabled, editedItems, invalidItemIds, itemCodeCounts, onCodeChange]
  );

  return (
    <ProjectWingMasterDataGrid
      columns={columns}
      data={items}
      emptyMessage={copy.folderContents}
      getRowId={(item) => item.id}
      showRowSelection={false}
      tableLabel={copy.folderContents}
      testId="confirmation-emp-import-grouped-data-grid"
      title={copy.folderContents}
    />
  );
}

export function ConfirmationImportedFilesDataGrid({
  copy,
  items,
  onWithdraw,
  disabled,
}: {
  copy: ImportGridCopy;
  onWithdraw: (items: ConfirmationEmpImportPreviewItem[]) => void;
  disabled: boolean;
  items: ConfirmationEmpImportPreviewItem[];
}) {
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const selectableItems = items.filter(
    (item) => item.existingItemId && item.existingJobId && item.existingMode
  );
  const selectedItems = selectableItems.filter((item) => selectedIds[item.id]);
  const columns = useMemo<
    ProjectWingMasterDataGridProps<ConfirmationEmpImportPreviewItem>["columns"]
  >(
    () => [
      ...(selecting
        ? [
            gridColumn({
              id: "select",
              header: () => (
                <Checkbox
                  label={copy.withdrawSelectAll}
                  disabled={disabled || selectableItems.length === 0}
                  checked={
                    selectedItems.length > 0 &&
                    selectedItems.length === selectableItems.length
                  }
                  indeterminate={
                    selectedItems.length > 0 &&
                    selectedItems.length < selectableItems.length
                  }
                  onCheckedChange={(checked) =>
                    setSelectedIds(
                      checked
                        ? Object.fromEntries(
                            selectableItems.map((item) => [item.id, true])
                          )
                        : {}
                    )
                  }
                />
              ),
              cell: ({ row }) => (
                <Checkbox
                  label={copy.withdrawSelectFile.replace(
                    "{name}",
                    row.original.sourceFileName
                  )}
                  disabled={
                    disabled ||
                    !row.original.existingItemId ||
                    !row.original.existingJobId ||
                    !row.original.existingMode
                  }
                  checked={Boolean(selectedIds[row.original.id])}
                  onCheckedChange={(checked) =>
                    setSelectedIds((current) => ({
                      ...current,
                      [row.original.id]: checked,
                    }))
                  }
                />
              ),
              size: 44,
              enableSorting: false,
              enableResizing: false,
              enableHiding: false,
            }),
          ]
        : []),
      gridColumn({
        id: "fileName",
        accessorFn: (item) => item.sourceFileName,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={copy.fileName} />
        ),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.sourceFileName}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.existingCode || row.original.confirmationCode}
            </div>
          </div>
        ),
        meta: { headerTitle: copy.fileName, autoSize: true },
        minSize: 260,
        size: 340,
      }),
      gridColumn({
        id: "targetLocation",
        accessorFn: (item) => item.existingLocation || "—",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={copy.targetLocation} />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.existingLocation || "—"}
          </span>
        ),
        meta: { headerTitle: copy.targetLocation },
        minSize: 210,
        size: 280,
      }),
      gridColumn({
        id: "validation",
        accessorFn: (item) => targetLabel(item.targetState, copy),
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={copy.validation} />
        ),
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center gap-1.5 text-sm font-medium ${row.original.targetState && row.original.targetState !== "AVAILABLE" ? "text-amber-600" : "text-emerald-600"}`}
          >
            {row.original.targetState &&
            row.original.targetState !== "AVAILABLE" ? (
              <AlertCircle className="size-4" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            {targetLabel(row.original.targetState, copy)}
          </span>
        ),
        meta: { headerTitle: copy.validation },
        minSize: 140,
        size: 180,
      }),
    ],
    [copy, disabled, selecting, selectedIds, selectableItems, selectedItems]
  );

  return (
    <ProjectWingMasterDataGrid
      actions={
        selecting ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => {
                setSelecting(false);
                setSelectedIds({});
              }}
            >
              {copy.withdrawCancel}
            </Button>
            <Button
              size="sm"
              disabled={disabled || selectedItems.length === 0}
              onClick={() => onWithdraw(selectedItems)}
            >
              {copy.withdrawConfirmSelected.replace(
                "{count}",
                String(selectedItems.length)
              )}
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || selectableItems.length === 0}
            onClick={() => setSelecting(true)}
          >
            {copy.withdrawAction}
          </Button>
        )
      }
      columns={columns}
      data={items}
      emptyMessage={copy.importedFiles}
      getRowId={(item) => item.id}
      showRowSelection={false}
      tableLabel={copy.importedFiles}
      testId="confirmation-emp-import-imported-data-grid"
      title={copy.importedFiles}
    />
  );
}

function targetLabel(
  state: ConfirmationEmpImportPreviewItem["targetState"],
  copy: ImportGridCopy
) {
  if (state === "RECYCLED") return copy.targetRecycled;
  if (state === "MISSING") return copy.targetMissing;
  if (state === "CHANGED") return copy.targetChanged;
  if (state === "UNVERIFIED") return copy.targetUnverified;
  return copy.importedStatus;
}
