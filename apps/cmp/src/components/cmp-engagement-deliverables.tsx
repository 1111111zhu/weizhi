"use client";

import { CMP_ENGAGEMENT_DELIVERABLE_LABELS } from "@project-wing/shared";
import type {
  CmpEngagementDeliverable,
  CmpEngagementServiceType,
} from "@project-wing/shared";
import type {
  DataGridColumnHeaderProps,
  ProjectWingMasterDataGridProps,
} from "@project-wing/ui";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { useCmpI18n } from "../i18n/client";
import {
  CmpMasterDataGrid,
  CmpMasterDataGridColumnHeader,
  cmpSelectedValuesFilter,
} from "./cmp-master-data-grid";

type DeliverableColumn =
  ProjectWingMasterDataGridProps<CmpEngagementDeliverable>["columns"][number];

export function formatEngagementDeliverables(
  deliverables: CmpEngagementDeliverable[],
  locale: "en-US" | "zh-CN" = "en-US"
) {
  return [...deliverables]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item) => {
      const label =
        CMP_ENGAGEMENT_DELIVERABLE_LABELS[item.code][
          locale === "zh-CN" ? "zh" : "en"
        ];
      return item.description ? `${label}: ${item.description}` : label;
    });
}

export function EngagementDeliverablesField({
  value,
  onChange,
}: {
  value: CmpEngagementDeliverable[];
  serviceType?: CmpEngagementServiceType | "";
  onChange: (value: CmpEngagementDeliverable[]) => void;
  locale?: "en-US" | "zh-CN";
}) {
  const { dictionary, locale } = useCmpI18n();
  const copy = dictionary.workspace;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const auditorsReport = value.find((item) => item.code === "AUDITORS_REPORT");
  const language = locale === "zh-CN" ? "zh" : "en";
  const update = useCallback(
    (next: CmpEngagementDeliverable[]) =>
      onChange(next.map((item, index) => ({ ...item, sortOrder: index }))),
    [onChange]
  );
  const openCustomEditor = useCallback((item?: CmpEngagementDeliverable) => {
    setEditingKey(item?.key ?? null);
    setDescription(item?.description ?? "");
    setDialogOpen(true);
  }, []);
  const menuCopy = useMemo(
    () => ({
      clear: copy.clearFilters,
      empty: copy.filterNoResults,
      filter: copy.filter,
      search: copy.filterSearch,
    }),
    [copy]
  );
  const columns = useMemo<DeliverableColumn[]>(() => {
    const header = (title: string) =>
      function DeliverableColumnHeader({
        column,
      }: {
        column: DataGridColumnHeaderProps<
          CmpEngagementDeliverable,
          unknown
        >["column"];
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
        id: "type",
        accessorFn: (row) =>
          CMP_ENGAGEMENT_DELIVERABLE_LABELS[row.code][language],
        header: header(copy.engagementDeliverableType),
        cell: ({ row }) => (
          <strong className="block truncate font-medium text-foreground">
            {CMP_ENGAGEMENT_DELIVERABLE_LABELS[row.original.code][language]}
          </strong>
        ),
        enableHiding: false,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: {
          autoSize: true,
          headerTitle: copy.engagementDeliverableType,
        },
        size: 260,
      },
      {
        accessorKey: "description",
        id: "description",
        header: header(copy.engagementDeliverableDescription),
        cell: ({ row }) => (
          <span className="block truncate text-foreground">
            {row.original.description || copy.formNotSet}
          </span>
        ),
        enableHiding: false,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: {
          autoSize: true,
          headerTitle: copy.engagementDeliverableDescription,
        },
        size: 620,
      },
      {
        id: "actions",
        header: copy.action,
        cell: ({ row }) => (
          <ButtonGroup>
            {row.original.code === "CUSTOM" ? (
              <Button
                type="button"
                size="icon-sm"
                variant="quiet"
                aria-label={copy.engagementEditCustomDeliverable}
                onClick={() => openCustomEditor(row.original)}
              >
                <Pencil />
              </Button>
            ) : null}
            <Button
              type="button"
              size="icon-sm"
              variant="quiet"
              aria-label={copy.engagementRemoveDeliverable}
              onClick={() =>
                update(value.filter((item) => item.key !== row.original.key))
              }
            >
              <Trash2 />
            </Button>
          </ButtonGroup>
        ),
        enableHiding: false,
        enableResizing: false,
        enableSorting: false,
        meta: { headerTitle: copy.action },
        size: 86,
      },
    ];
  }, [copy, language, menuCopy, openCustomEditor, update, value]);
  const saveCustomDeliverable = () => {
    const normalizedDescription = description.trim();
    if (!normalizedDescription) {
      return;
    }
    if (editingKey) {
      update(
        value.map((item) =>
          item.key === editingKey
            ? { ...item, description: normalizedDescription }
            : item
        )
      );
    } else {
      update([
        ...value,
        {
          key: `custom-${crypto.randomUUID()}`,
          category: "OTHERS",
          code: "CUSTOM",
          description: normalizedDescription,
          sortOrder: value.length,
        },
      ]);
    }
    setDialogOpen(false);
  };

  return (
    <section
      className="cmp-engagement-deliverables cmp-form-span-full grid gap-3"
      data-testid="engagement-deliverables"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">
            {copy.engagementSelectedDeliverables}
          </h4>
          <span className="text-xs text-muted-foreground">{value.length}</span>
        </div>
        <ButtonGroup>
          {auditorsReport ? null : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                update([
                  ...value,
                  {
                    key: "AUDITORS_REPORT",
                    category: "ANNUAL_AUDIT",
                    code: "AUDITORS_REPORT",
                    sortOrder: value.length,
                  },
                ])
              }
            >
              <Plus />
              {copy.engagementAddAuditorsReport}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => openCustomEditor()}
          >
            <Plus />
            {copy.engagementAddCustomDeliverable}
          </Button>
        </ButtonGroup>
      </header>

      <CmpMasterDataGrid
        mobile={{ titleColumn: "type", summaryColumns: ["description"] }}
        columns={columns}
        data={value}
        emptyMessage={copy.engagementDeliverablesEmpty}
        getRowId={(row) => row.key}
        initialSorting={[]}
        showRecordCount={false}
        showRowSelection={false}
        showToolbar={false}
        tableLabel={copy.engagementSelectedDeliverables}
        tableLayout={{ headerSticky: false, columnsVisibility: false }}
        testId="cmp-engagement-deliverables-data-grid"
        title={copy.engagementSelectedDeliverables}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl" closeLabel={copy.close}>
          <DialogHeader>
            <DialogTitle>
              {editingKey
                ? copy.engagementEditCustomDeliverable
                : copy.engagementAddCustomDeliverable}
            </DialogTitle>
          </DialogHeader>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">
              {copy.engagementDeliverableDescription}
            </span>
            <Input
              aria-label={copy.engagementDeliverableDescription}
              autoFocus
              value={description}
              placeholder={copy.engagementSpecifyDeliverable}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <ButtonGroup className="justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              {copy.cancel}
            </Button>
            <Button
              type="button"
              disabled={!description.trim()}
              onClick={saveCustomDeliverable}
            >
              {copy.formSave}
            </Button>
          </ButtonGroup>
        </DialogContent>
      </Dialog>
    </section>
  );
}
