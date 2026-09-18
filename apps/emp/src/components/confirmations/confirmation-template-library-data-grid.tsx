"use client";

import {
  DataGridColumnHeader,
  ProjectWingLoadingProgress,
  ProjectWingMasterDataGrid,
  ProjectWingPaginationFooter,
  useCompactViewport,
} from "@project-wing/ui";
import type { ProjectWingMasterDataGridProps } from "@project-wing/ui";
import {
  Check,
  ChevronRight,
  Download,
  Eye,
  Pencil,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { ConfirmationTemplateLibraryFile } from "../../api/client";
import type { Dictionary } from "../../i18n/dictionaries";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ButtonGroup } from "../ui/button-group";
import { Checkbox } from "../ui/checkbox";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { getConfirmationTypeTone } from "./confirmation-category-tone";
import { ConfirmationColumnFilter } from "./confirmation-column-filter";
import {
  ConfirmationLibraryMobile,
  ConfirmationLibraryRecord,
} from "./confirmation-library-mobile";

type Copy = Dictionary["confirmations"];
type DesignStatus = "DRAFT" | "ENABLED" | "DISABLED";
const TEMPLATE_FILTER_COLUMNS = [
  "code",
  "name",
  "type",
  "status",
  "file",
] as const;
type TemplateFilterColumn = (typeof TEMPLATE_FILTER_COLUMNS)[number];
type TemplateColumnFilters = Partial<Record<TemplateFilterColumn, string[]>>;
type TemplateFilterOptions = Record<
  TemplateFilterColumn,
  { value: string; label: string }[]
>;

function templateColumn(
  value: ProjectWingMasterDataGridProps<ConfirmationTemplateLibraryFile>["columns"][number]
) {
  return value;
}

function getSubtypeLabel(copy: Copy, type: string) {
  const labels: Record<string, string> = {
    BANK: copy.register.bank,
    INTERMEDIARY: copy.register.otherFinancialInstitution,
    BALANCE: copy.register.thirdParty,
    RELATED_PARTY: copy.register.relatedParty,
    LAWYER: copy.register.lawyer,
    INVENTORY: copy.register.inventory,
    OTHER: copy.register.miscellaneous,
    UNCLASSIFIED: copy.register.unclassified,
  };
  return labels[type] ?? copy.register.unclassified;
}

function getStatusLabel(copy: Copy, status: DesignStatus) {
  return status === "ENABLED"
    ? copy.templateLibrary.statusEnabled
    : status === "DRAFT"
      ? copy.templateLibrary.statusDraft
      : copy.templateLibrary.statusDisabled;
}

function templateFilterOption(
  column: TemplateFilterColumn,
  template: ConfirmationTemplateLibraryFile,
  copy: Copy,
  getDesignStatus: (template: ConfirmationTemplateLibraryFile) => DesignStatus
) {
  switch (column) {
    case "code": {
      return { value: template.code, label: template.code };
    }
    case "name": {
      return { value: template.name, label: template.name };
    }
    case "type": {
      const label = getSubtypeLabel(copy, template.confirmationType);
      return { value: template.confirmationType, label };
    }
    case "status": {
      const status = getDesignStatus(template);
      return { value: status, label: getStatusLabel(copy, status) };
    }
    case "file": {
      return { value: template.fileName, label: template.fileName };
    }
    default: {
      return { value: "", label: "" };
    }
  }
}

function TemplateRowActions({
  template,
  canManageTemplate,
  getDesignStatus,
  templateActionPending,
  isTemplateDesignable,
  onToggleStatus,
  onDesign,
  onDelete,
  onPreview,
  onDownload,
  copy,
}: { template: ConfirmationTemplateLibraryFile } & Pick<
  Parameters<typeof ConfirmationTemplateLibraryDataGrid>[0],
  | "canManageTemplate"
  | "getDesignStatus"
  | "templateActionPending"
  | "isTemplateDesignable"
  | "onToggleStatus"
  | "onDesign"
  | "onDelete"
  | "onPreview"
  | "onDownload"
  | "copy"
>) {
  const status = getDesignStatus(template);
  return (
    <div className="flex w-full items-center gap-2">
      <ButtonGroup className="max-w-full">
        {canManageTemplate(template) ? (
          <>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="shrink-0"
              aria-label={
                status === "ENABLED"
                  ? copy.templateLibrary.disable
                  : copy.templateLibrary.enable
              }
              disabled={
                templateActionPending ||
                (status !== "ENABLED" && !isTemplateDesignable(template))
              }
              onClick={() =>
                onToggleStatus(
                  template,
                  status === "ENABLED" ? "DISABLED" : "ENABLED"
                )
              }
            >
              {status === "ENABLED" ? <X /> : <Check />}
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="shrink-0"
              aria-label={copy.templateLibrary.design}
              disabled={
                !isTemplateDesignable(template) || templateActionPending
              }
              onClick={() => onDesign(template)}
            >
              <Pencil />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="shrink-0"
              aria-label={copy.templateLibrary.delete}
              disabled={templateActionPending}
              onClick={() => onDelete(template)}
            >
              <Trash2 />
            </Button>
          </>
        ) : null}
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="shrink-0"
          disabled={templateActionPending}
          aria-label={copy.templateLibrary.preview}
          onClick={() => onPreview(template)}
        >
          <Eye />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="shrink-0"
          disabled={templateActionPending}
          aria-label={copy.templateLibrary.download}
          onClick={() => onDownload(template)}
        >
          <Download />
        </Button>
      </ButtonGroup>
      <ChevronRight
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
        data-testid={`template-row-disclosure-${template.id}`}
      />
    </div>
  );
}

export function ConfirmationTemplateLibraryDataGrid({
  locale = "en-US",
  generalInformationSettings,
  canManageTemplates,
  canManageTemplate,
  commonCopy,
  copy,
  deletableRowsExist,
  getDesignStatus,
  isTemplateDesignable,
  isLoading,
  onDelete,
  onDesign,
  onDownload,
  onExitSelection,
  onPreview,
  onQueryChange,
  onSelectionAction,
  onToggleSelection,
  onToggleStatus,
  onTypeChange,
  onUpload,
  previewingTemplateId,
  query,
  rows,
  selectedTemplateIds,
  selectionAction,
  statusMutationPending,
  templateActionPending,
  type,
  typeOptions,
}: {
  locale?: string;
  generalInformationSettings?: ReactNode;
  allSelectableRowsSelected: boolean;
  canManageTemplates: boolean;
  canManageTemplate: (template: ConfirmationTemplateLibraryFile) => boolean;
  commonCopy: Dictionary["common"];
  copy: Copy;
  deletableRowsExist: boolean;
  getDesignStatus: (template: ConfirmationTemplateLibraryFile) => DesignStatus;
  isTemplateDesignable: (template: ConfirmationTemplateLibraryFile) => boolean;
  isLoading: boolean;
  onDelete: (template: ConfirmationTemplateLibraryFile) => void;
  onDesign: (template: ConfirmationTemplateLibraryFile) => void;
  onDownload: (template: ConfirmationTemplateLibraryFile) => void;
  onExitSelection: () => void;
  onPreview: (template: ConfirmationTemplateLibraryFile) => void;
  onQueryChange: (value: string) => void;
  onSelectionAction: (action: "DELETE" | "ENABLE" | "DISABLE") => void;
  onToggleAllSelection: (selected: boolean) => void;
  onToggleSelection: (
    template: ConfirmationTemplateLibraryFile,
    selected: boolean
  ) => void;
  onToggleStatus: (
    template: ConfirmationTemplateLibraryFile,
    designStatus: DesignStatus
  ) => void;
  onTypeChange: (value: string) => void;
  onUpload: () => void;
  previewingTemplateId: string | null;
  query: string;
  rows: ConfirmationTemplateLibraryFile[];
  selectedTemplateIds: Set<string>;
  selectionAction: "DELETE" | "ENABLE" | "DISABLE" | null;
  someSelectableRowsSelected: boolean;
  statusMutationPending: boolean;
  templateActionPending: boolean;
  type: string;
  typeOptions: { value: string; label: string }[];
}) {
  const phone = useCompactViewport(767.98);
  const [pageSize, setPageSize] = useState(30);
  const [columnFilters, setColumnFilters] = useState<TemplateColumnFilters>({});
  const filterLabels = useMemo(
    () => ({
      triggerLabel: copy.register.filterTrigger,
      searchLabel: copy.register.filterSearch,
      clearLabel: copy.register.clearFilter,
      emptyLabel: copy.register.noFilterOptions,
    }),
    [
      copy.register.clearFilter,
      copy.register.filterSearch,
      copy.register.filterTrigger,
      copy.register.noFilterOptions,
    ]
  );
  const filterOptions = useMemo<TemplateFilterOptions>(() => {
    const options = {} as TemplateFilterOptions;
    for (const filterColumn of TEMPLATE_FILTER_COLUMNS) {
      const values = new Map<string, string>();
      for (const template of rows) {
        const option = templateFilterOption(
          filterColumn,
          template,
          copy,
          getDesignStatus
        );
        values.set(option.value, option.label);
      }
      options[filterColumn] = [...values.entries()]
        .sort((left, right) => left[1].localeCompare(right[1]))
        .map(([value, label]) => ({ value, label }));
    }
    return options;
  }, [copy, getDesignStatus, rows]);
  const filteredRows = useMemo(
    () =>
      rows.filter((template) =>
        Object.entries(columnFilters).every(([column, values]) => {
          if (!values?.length) {
            return true;
          }
          return values.includes(
            templateFilterOption(
              column as TemplateFilterColumn,
              template,
              copy,
              getDesignStatus
            ).value
          );
        })
      ),
    [columnFilters, copy, getDesignStatus, rows]
  );
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visibleRows = filteredRows.slice(
    safePage * pageSize,
    (safePage + 1) * pageSize
  );
  const selectableVisibleRows = visibleRows.filter(canManageTemplate);
  const allVisibleRowsSelected =
    selectableVisibleRows.length > 0 &&
    selectableVisibleRows.every((template) =>
      selectedTemplateIds.has(template.id)
    );
  const someVisibleRowsSelected =
    selectableVisibleRows.some((template) =>
      selectedTemplateIds.has(template.id)
    ) && !allVisibleRowsSelected;
  const selectableRowsExist = rows.some(canManageTemplate);

  function handleToggleAllSelection(selected: boolean) {
    for (const template of selectableVisibleRows) {
      onToggleSelection(template, selected);
    }
  }
  const handleQueryChange = (value: string) => {
    setPage(0);
    onQueryChange(value);
  };
  const handleTypeChange = (value: string) => {
    setPage(0);
    onTypeChange(value);
  };
  const handleColumnFilterChange = useCallback(
    (filterColumn: TemplateFilterColumn, values: string[]) => {
      onExitSelection();
      setPage(0);
      setColumnFilters((current) => {
        if (values.length === 0) {
          return Object.fromEntries(
            Object.entries(current).filter(([key]) => key !== filterColumn)
          );
        }
        return { ...current, [filterColumn]: values };
      });
    },
    [onExitSelection]
  );
  const handlePageChange = (nextPage: number) => {
    onExitSelection();
    setPage(nextPage);
  };
  const handlePageSizeChange = (nextPageSize: number) => {
    onExitSelection();
    setPageSize(nextPageSize);
    setPage(0);
  };

  useEffect(() => {
    if (safePage < 0) {
      return;
    }
    const viewport = document.querySelector<HTMLElement>(
      '[data-testid="confirmation-template-library-data-grid"] [data-slot="scroll-area-viewport"]'
    );
    if (typeof viewport?.scrollTo === "function") {
      viewport.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [safePage]);

  const renderRowActions = useCallback(
    (template: ConfirmationTemplateLibraryFile) => (
      <TemplateRowActions
        template={template}
        canManageTemplate={canManageTemplate}
        getDesignStatus={getDesignStatus}
        templateActionPending={templateActionPending}
        isTemplateDesignable={isTemplateDesignable}
        onToggleStatus={onToggleStatus}
        onDesign={onDesign}
        onDelete={onDelete}
        onPreview={onPreview}
        onDownload={onDownload}
        copy={copy}
      />
    ),
    [
      canManageTemplate,
      getDesignStatus,
      templateActionPending,
      isTemplateDesignable,
      onToggleStatus,
      onDesign,
      onDelete,
      onPreview,
      onDownload,
      copy,
    ]
  );

  const columns: ProjectWingMasterDataGridProps<ConfirmationTemplateLibraryFile>["columns"] =
    (() => {
      const filterHeader = (
        filterColumn: TemplateFilterColumn,
        title: string
      ) => ({
        id: filterColumn,
        header: () => (
          <ConfirmationColumnFilter
            label={title}
            options={filterOptions[filterColumn]}
            selectedValues={columnFilters[filterColumn] ?? []}
            onChange={(values) =>
              handleColumnFilterChange(filterColumn, values)
            }
            labels={filterLabels}
          />
        ),
      });

      return [
        ...(selectionAction
          ? [
              templateColumn({
                id: "selection",
                header: () => (
                  <Checkbox
                    aria-label={copy.templateLibrary.selectAll}
                    checked={allVisibleRowsSelected}
                    indeterminate={someVisibleRowsSelected}
                    disabled={
                      !selectableVisibleRows.length || templateActionPending
                    }
                    onCheckedChange={(checked) =>
                      handleToggleAllSelection(checked === true)
                    }
                  />
                ),
                cell: ({ row }) => (
                  <Checkbox
                    aria-label={copy.templateLibrary.selectRow.replace(
                      "{name}",
                      row.original.name
                    )}
                    checked={selectedTemplateIds.has(row.original.id)}
                    disabled={
                      !canManageTemplate(row.original) || templateActionPending
                    }
                    onCheckedChange={(checked) =>
                      onToggleSelection(row.original, checked === true)
                    }
                  />
                ),
                enableHiding: false,
                enableResizing: false,
                enableSorting: false,
                meta: { headerTitle: copy.templateLibrary.selectAll },
                size: 48,
              }),
            ]
          : []),
        templateColumn({
          ...filterHeader("code", copy.templateLibrary.columns.code),
          accessorFn: (template) => template.code,
          cell: ({ row }) => (
            <span className="block font-mono text-xs break-words whitespace-normal text-muted-foreground">
              {row.original.code}
            </span>
          ),
          meta: {
            autoSize: true,
            headerTitle: copy.templateLibrary.columns.code,
            cellClassName: "overflow-visible whitespace-normal text-clip",
          },
          minSize: 160,
          size: 260,
        }),
        templateColumn({
          ...filterHeader("name", copy.templateLibrary.columns.name),
          accessorFn: (template) => template.name,
          cell: ({ row }) => (
            <div className="min-w-0">
              <div className="font-medium break-words whitespace-normal">
                {row.original.name}
              </div>
              {row.original.description ? (
                <p className="mt-0.5 text-xs break-words whitespace-normal text-muted-foreground">
                  {row.original.description}
                </p>
              ) : null}
            </div>
          ),
          meta: {
            autoSize: true,
            headerTitle: copy.templateLibrary.columns.name,
            cellClassName: "overflow-visible whitespace-normal text-clip",
          },
          minSize: 180,
          size: 300,
        }),
        templateColumn({
          ...filterHeader("type", copy.templateLibrary.columns.type),
          accessorFn: (template) =>
            getSubtypeLabel(copy, template.confirmationType),
          cell: ({ row }) => (
            <Badge
              className={cn(
                getConfirmationTypeTone(row.original.confirmationType).badge,
                "max-w-full whitespace-normal"
              )}
              variant="outline"
            >
              {getSubtypeLabel(copy, row.original.confirmationType)}
            </Badge>
          ),
          meta: {
            autoSize: true,
            headerTitle: copy.templateLibrary.columns.type,
            cellClassName: "overflow-visible whitespace-normal text-clip",
          },
          minSize: 120,
          size: 160,
        }),
        templateColumn({
          ...filterHeader("status", copy.templateLibrary.columns.status),
          accessorFn: (template) => getDesignStatus(template),
          cell: ({ row }) => {
            const status = getDesignStatus(row.original);
            return (
              <Badge
                variant="outline"
                className={cn(
                  status === "ENABLED" &&
                    "border-emerald-200 bg-emerald-50 text-emerald-700",
                  status === "DISABLED" &&
                    "border-rose-200 bg-rose-50 text-rose-700",
                  status === "DRAFT" &&
                    "border-amber-200 bg-amber-50 text-amber-700"
                )}
              >
                {status === "ENABLED"
                  ? copy.templateLibrary.statusEnabled
                  : status === "DRAFT"
                    ? copy.templateLibrary.statusDraft
                    : copy.templateLibrary.statusDisabled}
              </Badge>
            );
          },
          meta: {
            autoSize: true,
            headerTitle: copy.templateLibrary.columns.status,
            cellClassName: "overflow-visible whitespace-normal text-clip",
          },
          minSize: 110,
          size: 150,
        }),
        templateColumn({
          ...filterHeader("file", copy.templateLibrary.columns.file),
          accessorFn: (template) => template.fileName,
          cell: ({ row }) => (
            <span className="block break-words whitespace-normal">
              {row.original.fileName}
            </span>
          ),
          meta: {
            autoSize: true,
            headerTitle: copy.templateLibrary.columns.file,
            cellClassName: "overflow-visible whitespace-normal text-clip",
          },
          minSize: 180,
          size: 300,
        }),
        templateColumn({
          id: "actions",
          header: ({ column: current }) => (
            <DataGridColumnHeader
              column={current}
              title={copy.templateLibrary.columns.actions}
            />
          ),
          cell: ({ row }) => renderRowActions(row.original),
          enableSorting: false,
          meta: {
            headerTitle: copy.templateLibrary.columns.actions,
            headerClassName: "text-left",
            cellClassName: "text-left",
          },
          minSize: 190,
          size: 190,
        }),
      ];
    })();
  const persistentActions = (
    <InputGroup className="max-w-md min-w-64">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        aria-label={copy.templateLibrary.searchPlaceholder}
        placeholder={copy.templateLibrary.searchPlaceholder}
        value={query}
        onChange={(event) => handleQueryChange(event.target.value)}
      />
    </InputGroup>
  );

  const actions = (
    <>
      <Select
        value={type}
        onValueChange={(value) => value && handleTypeChange(value)}
      >
        <SelectTrigger className="w-44" aria-label={copy.templateLibrary.type}>
          <SelectValue>
            {type === "ALL"
              ? copy.filter.allTypes
              : (typeOptions.find((option) => option.value === type)?.label ??
                copy.filter.allTypes)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">{copy.filter.allTypes}</SelectItem>
          {typeOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {canManageTemplates ? (
        <ButtonGroup>
          {deletableRowsExist ? (
            <Button
              type="button"
              variant={selectionAction === "DELETE" ? "destructive" : "outline"}
              aria-pressed={selectionAction === "DELETE"}
              disabled={templateActionPending}
              onClick={() => onSelectionAction("DELETE")}
            >
              <Trash2 />
              {copy.templateLibrary.deleteSelected}
            </Button>
          ) : null}
          <Button
            type="button"
            variant={selectionAction === "ENABLE" ? "default" : "outline"}
            aria-pressed={selectionAction === "ENABLE"}
            disabled={templateActionPending || !selectableRowsExist}
            onClick={() => onSelectionAction("ENABLE")}
          >
            <Check />
            {statusMutationPending
              ? copy.templateLibrary.statusUpdating
              : copy.templateLibrary.enableSelected}
          </Button>
          <Button
            type="button"
            variant={selectionAction === "DISABLE" ? "destructive" : "outline"}
            aria-pressed={selectionAction === "DISABLE"}
            disabled={templateActionPending || !selectableRowsExist}
            onClick={() => onSelectionAction("DISABLE")}
          >
            <X />
            {statusMutationPending
              ? copy.templateLibrary.statusUpdating
              : copy.templateLibrary.disableSelected}
          </Button>
        </ButtonGroup>
      ) : null}
      {generalInformationSettings}
      {canManageTemplates ? (
        <Button type="button" onClick={onUpload}>
          <Upload />
          {copy.templateLibrary.upload}
        </Button>
      ) : null}
    </>
  );

  if (phone) {
    return (
      <ConfirmationLibraryMobile
        locale={locale}
        title={copy.templateLibrary.title}
        search={persistentActions}
        actions={actions}
        filters={TEMPLATE_FILTER_COLUMNS.map((column) => (
          <ConfirmationColumnFilter
            key={column}
            label={copy.templateLibrary.columns[column]}
            options={filterOptions[column]}
            selectedValues={columnFilters[column] ?? []}
            onChange={(values) => handleColumnFilterChange(column, values)}
            labels={filterLabels}
          />
        ))}
        loading={isLoading}
        count={visibleRows.length}
        empty={
          query || type !== "ALL"
            ? copy.templateLibrary.noResults
            : copy.templateLibrary.noTemplates
        }
        footer={
          filteredRows.length > pageSize ? (
            <ProjectWingPaginationFooter
              locale={locale === "zh-CN" ? "zh-CN" : "en-US"}
              label={copy.templateLibrary.rowsPerPage}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              page={safePage}
              pageSize={pageSize}
              pageSizeOptionSuffix={copy.templateLibrary.rowsPerPageSuffix}
              recordCount={filteredRows.length}
            />
          ) : undefined
        }
      >
        {visibleRows.map((template) => (
          <ConfirmationLibraryRecord
            key={template.id}
            id={template.id}
            locale={locale}
            title={template.name}
            description={`${template.code} · ${getSubtypeLabel(copy, template.confirmationType)}`}
            meta={template.fileName}
            onOpen={() => onPreview(template)}
            actions={
              <TemplateRowActions
                template={template}
                copy={copy}
                canManageTemplate={canManageTemplate}
                getDesignStatus={getDesignStatus}
                templateActionPending={templateActionPending}
                isTemplateDesignable={isTemplateDesignable}
                onToggleStatus={onToggleStatus}
                onDesign={onDesign}
                onDelete={onDelete}
                onPreview={onPreview}
                onDownload={onDownload}
              />
            }
            selection={
              selectionAction ? (
                <Checkbox
                  aria-label={copy.templateLibrary.selectRow.replace(
                    "{name}",
                    template.name
                  )}
                  checked={selectedTemplateIds.has(template.id)}
                  disabled={
                    !selectableVisibleRows.includes(template) ||
                    templateActionPending
                  }
                  onCheckedChange={(checked) =>
                    onToggleSelection(template, checked === true)
                  }
                />
              ) : undefined
            }
          />
        ))}
      </ConfirmationLibraryMobile>
    );
  }

  return (
    <div
      data-preview-open={previewingTemplateId ? "true" : undefined}
      className={cn(
        "flex h-full min-h-0 flex-1 flex-col overflow-hidden",
        previewingTemplateId &&
          "[&_[data-slot=frame]]:rounded-r-none [&_[data-slot=frame]]:border-r-0"
      )}
    >
      <ProjectWingMasterDataGrid
        actions={actions}
        columns={columns}
        content={
          isLoading ? (
            <div className="grid min-h-64 place-items-center" aria-busy="true">
              <ProjectWingLoadingProgress />
            </div>
          ) : undefined
        }
        data={visibleRows}
        emptyMessage={
          query || type !== "ALL"
            ? copy.templateLibrary.noResults
            : copy.templateLibrary.noTemplates
        }
        getRowId={(template) => template.id}
        overflowLabel={commonCopy.moreActions}
        persistentActions={persistentActions}
        onRowClick={onPreview}
        rowClassName={(template) =>
          cn(
            "cursor-pointer",
            previewingTemplateId === template.id && "bg-primary/5"
          )
        }
        showRowSelection={false}
        tableLabel={copy.templateLibrary.title}
        testId="confirmation-template-library-data-grid"
        toolbarTestId="confirmation-template-library-toolbar"
        title={copy.templateLibrary.title}
        footer={
          <ProjectWingPaginationFooter
            label={copy.templateLibrary.rowsPerPage}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            page={safePage}
            pageSize={pageSize}
            pageSizeOptionSuffix={copy.templateLibrary.rowsPerPageSuffix}
            recordCount={filteredRows.length}
          />
        }
      />
    </div>
  );
}
