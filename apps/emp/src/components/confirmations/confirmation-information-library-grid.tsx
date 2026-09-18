"use client";

import {
  CollectionState,
  ProjectWingMasterDataGrid,
  useCompactViewport,
} from "@project-wing/ui";
import type { ProjectWingMasterDataGridProps } from "@project-wing/ui";
import {
  ArchiveX,
  LockKeyhole,
  Pencil,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import type { ConfirmationInformationLibraryEntry } from "../../api/client";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ButtonGroup } from "../ui/button-group";
import { Checkbox } from "../ui/checkbox";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../ui/input-group";
import { ConfirmationColumnFilter } from "./confirmation-column-filter";
import {
  ConfirmationLibraryMobile,
  ConfirmationLibraryRecord,
} from "./confirmation-library-mobile";

type InformationLibraryGridCopy = {
  title: string;
  add: string;
  moreActions: string;
  actions: string;
  columnMenu: {
    clear: string;
    empty: string;
    filter: string;
    search: string;
  };
  rowsPerPage: string;
  rowsPerPageSuffix: string;
  searchPlaceholder: string;
  resultCount: string;
  showInactive: string;
  loading: string;
  loadError: string;
  empty: string;
  noResults: string;
  emptyValue: string;
  code: string;
  sourceLabel: string;
  sourceRow: string;
  bankNameEn: string;
  bankNameZh: string;
  bankType: string;
  effectiveMailingAddress: string;
  businessAddress?: string;
  mailingAddress?: string;
  contactName?: string;
  attention?: string;
  notes?: string;
  background?: string;
  historicalMailingAddress?: string;
  cautions?: string;
  completeness: string;
  ready: string;
  incomplete: string;
  active: string;
  inactive: string;
  edit: string;
  deactivate: string;
  restore: string;
};

type InformationLibraryAccessCopy = {
  complete: string;
  readOnlyTitle: string;
  readOnlyDescription: string;
};

const INFORMATION_FILTER_COLUMNS = [
  "code",
  "bankNameZh",
  "bankNameEn",
  "bankType",
  "effectiveMailingAddress",
  "businessAddress",
  "mailingAddress",
  "contactName",
  "attention",
  "background",
  "notes",
  "historicalMailingAddress",
  "cautions",
  "source",
  "completeness",
  "active",
] as const;

type InformationFilterColumn = (typeof INFORMATION_FILTER_COLUMNS)[number];
type InformationColumnFilters = Partial<
  Record<InformationFilterColumn, string[]>
>;
type InformationFilterOptions = Record<
  InformationFilterColumn,
  { value: string; label: string }[]
>;

function informationColumn(
  column: ProjectWingMasterDataGridProps<ConfirmationInformationLibraryEntry>["columns"][number]
) {
  return column;
}

function displayedMailingAddress(entry: ConfirmationInformationLibraryEntry) {
  return entry.mailingAddressSameAsBusiness
    ? entry.businessAddress
    : entry.mailingAddress;
}

function informationFilterValue(
  column: InformationFilterColumn,
  entry: ConfirmationInformationLibraryEntry,
  copy: InformationLibraryGridCopy
) {
  const value = (() => {
    switch (column) {
      case "code": {
        return entry.bankCode;
      }
      case "bankNameZh": {
        return entry.bankNameZh;
      }
      case "bankNameEn": {
        return entry.bankNameEn;
      }
      case "bankType": {
        return entry.bankType;
      }
      case "effectiveMailingAddress": {
        return displayedMailingAddress(entry);
      }
      case "businessAddress": {
        return entry.businessAddress;
      }
      case "mailingAddress": {
        return entry.mailingAddress;
      }
      case "contactName": {
        return entry.contactName;
      }
      case "attention": {
        return entry.attention;
      }
      case "background": {
        return entry.background;
      }
      case "notes": {
        return entry.notes;
      }
      case "historicalMailingAddress": {
        return entry.historicalMailingAddress;
      }
      case "cautions": {
        return entry.cautions;
      }
      case "source": {
        return entry.sourceLabel;
      }
      case "completeness": {
        return entry.isReadyForDispatch ? copy.ready : copy.incomplete;
      }
      case "active": {
        return entry.isActive ? copy.active : copy.inactive;
      }
      default: {
        return "";
      }
    }
  })();
  return value || copy.emptyValue;
}

export function ConfirmationInformationLibraryGrid({
  accessCopy,
  canManage,
  copy,
  deactivatePending,
  hideAccessStatus = false,
  hideInactiveFilter = false,
  compact = false,
  summary = false,
  locale,
  includeInactive,
  isError,
  isLoading,
  onRetry,
  onCreate,
  onDeactivate,
  onEdit,
  onIncludeInactiveChange,
  onQueryChange,
  onRowClick,
  onRestore,
  query,
  restorePending,
  rows,
}: {
  accessCopy: InformationLibraryAccessCopy;
  canManage: boolean;
  copy: InformationLibraryGridCopy;
  deactivatePending: boolean;
  hideAccessStatus?: boolean;
  hideInactiveFilter?: boolean;
  compact?: boolean;
  summary?: boolean;
  locale: string;
  includeInactive: boolean;
  isError: boolean;
  isLoading: boolean;
  onRetry?: () => void;
  onCreate: () => void;
  onDeactivate: (entry: ConfirmationInformationLibraryEntry) => void;
  onEdit: (entry: ConfirmationInformationLibraryEntry) => void;
  onIncludeInactiveChange: (checked: boolean) => void;
  onQueryChange: (value: string) => void;
  onRowClick?: (entry: ConfirmationInformationLibraryEntry) => void;
  onRestore: (entry: ConfirmationInformationLibraryEntry) => void;
  query: string;
  restorePending: boolean;
  rows: ConfirmationInformationLibraryEntry[];
}) {
  const handleQueryChange = (value: string) => {
    onQueryChange(value);
  };
  const phone = useCompactViewport(767.98);

  const handleIncludeInactiveChange = (checked: boolean) => {
    onIncludeInactiveChange(checked);
  };

  const [columnFilters, setColumnFilters] = useState<InformationColumnFilters>(
    {}
  );
  const filterLabels = useMemo(
    () => ({
      triggerLabel: copy.columnMenu.filter,
      searchLabel: copy.columnMenu.search,
      clearLabel: copy.columnMenu.clear,
      emptyLabel: copy.columnMenu.empty,
    }),
    [
      copy.columnMenu.clear,
      copy.columnMenu.empty,
      copy.columnMenu.filter,
      copy.columnMenu.search,
    ]
  );
  const filterOptions = useMemo<InformationFilterOptions>(() => {
    const options = {} as InformationFilterOptions;
    for (const column of INFORMATION_FILTER_COLUMNS) {
      const values = new Set(
        rows.map((entry) => informationFilterValue(column, entry, copy))
      );
      options[column] = [...values]
        .sort((left, right) => left.localeCompare(right, locale))
        .map((value) => ({ value, label: value }));
    }
    return options;
  }, [copy, locale, rows]);
  const filteredRows = useMemo(
    () =>
      rows.filter((entry) =>
        Object.entries(columnFilters).every(([column, values]) => {
          if (!values?.length) {
            return true;
          }
          return values.includes(
            informationFilterValue(
              column as InformationFilterColumn,
              entry,
              copy
            )
          );
        })
      ),
    [columnFilters, copy, rows]
  );
  const handleColumnFilterChange = useCallback(
    (column: InformationFilterColumn, values: string[]) => {
      setColumnFilters((current) => {
        if (values.length === 0) {
          return Object.fromEntries(
            Object.entries(current).filter(([key]) => key !== column)
          );
        }
        return { ...current, [column]: values };
      });
    },
    []
  );

  const columns = useMemo<
    ProjectWingMasterDataGridProps<ConfirmationInformationLibraryEntry>["columns"]
  >(() => {
    const filterHeader = (column: InformationFilterColumn, title: string) => ({
      id: column,
      header: () =>
        summary ? (
          <span>{title}</span>
        ) : (
          <ConfirmationColumnFilter
            label={title}
            options={filterOptions[column]}
            selectedValues={columnFilters[column] ?? []}
            onChange={(values) => handleColumnFilterChange(column, values)}
            labels={filterLabels}
          />
        ),
      meta: { headerTitle: title },
    });
    const textColumn = (
      id: InformationFilterColumn,
      title: string,
      value: (
        entry: ConfirmationInformationLibraryEntry
      ) => string | null | undefined
    ) =>
      informationColumn({
        ...filterHeader(id, title),
        accessorFn: (entry) => value(entry) || copy.emptyValue,
        cell: ({ row }) => (
          <span className="whitespace-normal">
            {value(row.original) || copy.emptyValue}
          </span>
        ),
        enableSorting: true,
        minSize: 180,
        size: 280,
      });
    const result = [
      informationColumn({
        ...filterHeader("code", copy.code),
        accessorFn: (entry) => entry.bankCode,
        cell: ({ row }) => (
          <span className="font-mono font-semibold">
            {row.original.bankCode}
          </span>
        ),
        enableSorting: true,
        minSize: 120,
        size: 150,
      }),
      informationColumn({
        ...filterHeader("bankNameZh", copy.bankNameZh),
        accessorFn: (entry) => entry.bankNameZh,
        cell: ({ row }) => (
          <span className="whitespace-normal">{row.original.bankNameZh}</span>
        ),
        enableSorting: true,
        minSize: 180,
        size: 240,
      }),
      informationColumn({
        ...filterHeader("bankNameEn", copy.bankNameEn),
        accessorFn: (entry) => entry.bankNameEn,
        cell: ({ row }) => (
          <span className="whitespace-normal">{row.original.bankNameEn}</span>
        ),
        enableSorting: true,
        minSize: 220,
        size: 300,
      }),
      informationColumn({
        ...filterHeader("bankType", copy.bankType),
        accessorFn: (entry) => entry.bankType || copy.emptyValue,
        cell: ({ row }) => row.original.bankType || copy.emptyValue,
        enableSorting: true,
        minSize: 140,
        size: 190,
      }),
      informationColumn({
        ...filterHeader(
          "effectiveMailingAddress",
          copy.mailingAddress ?? copy.effectiveMailingAddress
        ),
        accessorFn: (entry) =>
          displayedMailingAddress(entry) || copy.emptyValue,
        cell: ({ row }) => (
          <span className="whitespace-normal">
            {displayedMailingAddress(row.original) || copy.emptyValue}
          </span>
        ),
        enableSorting: true,
        minSize: 240,
        size: 360,
      }),
      textColumn(
        "businessAddress",
        copy.businessAddress ?? copy.effectiveMailingAddress,
        (entry) => entry.businessAddress
      ),
      textColumn(
        "mailingAddress",
        copy.mailingAddress ?? copy.effectiveMailingAddress,
        (entry) => entry.mailingAddress
      ),
      textColumn(
        "contactName",
        copy.contactName ?? copy.bankNameEn,
        (entry) => entry.contactName
      ),
      textColumn(
        "attention",
        copy.attention ?? copy.bankType,
        (entry) => entry.attention
      ),
      textColumn(
        "background",
        copy.background ?? copy.sourceLabel,
        (entry) => entry.background
      ),
      textColumn(
        "notes",
        copy.notes ?? copy.sourceLabel,
        (entry) => entry.notes
      ),
      textColumn(
        "historicalMailingAddress",
        copy.historicalMailingAddress ?? copy.effectiveMailingAddress,
        (entry) => entry.historicalMailingAddress
      ),
      textColumn(
        "cautions",
        copy.cautions ?? copy.sourceLabel,
        (entry) => entry.cautions
      ),
      informationColumn({
        ...filterHeader("source", copy.sourceLabel),
        accessorFn: (entry) => entry.sourceLabel,
        cell: ({ row }) => (
          <div className="whitespace-normal">
            <span className="block">{row.original.sourceLabel}</span>
            <span className="text-xs text-muted-foreground">
              {copy.sourceRow}: {row.original.sourceRow ?? copy.emptyValue}
            </span>
          </div>
        ),
        enableSorting: true,
        minSize: 180,
        size: 260,
      }),
      informationColumn({
        ...filterHeader("completeness", copy.completeness),
        accessorFn: (entry) =>
          entry.isReadyForDispatch ? copy.ready : copy.incomplete,
        cell: ({ row }) => (
          <Badge
            variant={row.original.isReadyForDispatch ? "secondary" : "outline"}
          >
            {row.original.isReadyForDispatch ? copy.ready : copy.incomplete}
          </Badge>
        ),
        enableSorting: true,
        minSize: 130,
        size: 160,
      }),
      informationColumn({
        ...filterHeader("active", copy.active),
        accessorFn: (entry) => (entry.isActive ? copy.active : copy.inactive),
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "outline" : "secondary"}>
            {row.original.isActive ? copy.active : copy.inactive}
          </Badge>
        ),
        enableSorting: true,
        minSize: 110,
        size: 130,
      }),
    ];

    if (!compact && !summary) {
      const localizedNameColumnId =
        locale === "zh-CN" ? "bankNameZh" : "bankNameEn";
      return result.filter((column) =>
        [
          "code",
          localizedNameColumnId,
          "bankType",
          "effectiveMailingAddress",
          "businessAddress",
        ].includes(String(column.id))
      );
    }

    if (compact || summary) {
      const compactColumns = result.filter((column) =>
        [
          "code",
          "bankNameZh",
          "bankNameEn",
          "bankType",
          "effectiveMailingAddress",
        ].includes(String(column.id))
      );
      if (summary) {
        return compactColumns.map((column) => ({
          ...column,
          enableColumnFilter: false,
          enableSorting: false,
        }));
      }
      compactColumns.push(
        informationColumn({
          id: "select",
          header: copy.actions,
          cell: ({ row }) => (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onRowClick?.(row.original)}
            >
              {copy.actions}
            </Button>
          ),
          enableSorting: false,
          enableColumnFilter: false,
          enableHiding: false,
          meta: { headerTitle: copy.actions },
          minSize: 100,
          size: 120,
        })
      );
      return compactColumns;
    }

    if (canManage) {
      result.push(
        informationColumn({
          id: "actions",
          header: copy.actions,
          cell: ({ row }) => {
            const entry = row.original;
            return (
              <ButtonGroup label={copy.actions} className="ml-auto">
                {entry.isActive ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      aria-label={`${entry.isReadyForDispatch ? copy.edit : accessCopy.complete}: ${entry.bankNameEn}`}
                      onClick={() => onEdit(entry)}
                    >
                      <Pencil className="size-3.5" />
                      {entry.isReadyForDispatch
                        ? copy.edit
                        : accessCopy.complete}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      aria-label={`${copy.deactivate}: ${entry.bankNameEn}`}
                      disabled={deactivatePending}
                      onClick={() => onDeactivate(entry)}
                    >
                      <ArchiveX className="size-3.5" />
                      {copy.deactivate}
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    aria-label={`${copy.restore}: ${entry.bankNameEn}`}
                    disabled={restorePending}
                    onClick={() => onRestore(entry)}
                  >
                    <RotateCcw className="size-3.5" />
                    {copy.restore}
                  </Button>
                )}
              </ButtonGroup>
            );
          },
          enableColumnFilter: false,
          enableHiding: false,
          enableResizing: false,
          enableSorting: false,
          meta: {
            headerTitle: copy.actions,
            headerClassName: "text-right",
            cellClassName: "text-right",
          },
          minSize: 220,
          size: 280,
        })
      );
    }

    return result;
  }, [
    accessCopy.complete,
    canManage,
    columnFilters,
    compact,
    copy,
    deactivatePending,
    locale,
    filterLabels,
    filterOptions,
    handleColumnFilterChange,
    onDeactivate,
    onEdit,
    onRestore,
    onRowClick,
    restorePending,
    summary,
  ]);
  const persistentActions = (
    <InputGroup className="max-w-md min-w-64">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        aria-label={copy.searchPlaceholder}
        placeholder={copy.searchPlaceholder}
        value={query}
        onChange={(event) => handleQueryChange(event.target.value)}
      />
    </InputGroup>
  );

  const actions = (
    <>
      {hideInactiveFilter || summary ? null : (
        <label className="flex items-center gap-2 text-sm whitespace-nowrap text-muted-foreground">
          <Checkbox
            id="confirmation-information-library-show-inactive"
            checked={includeInactive}
            label={copy.showInactive}
            onCheckedChange={(checked) =>
              handleIncludeInactiveChange(checked === true)
            }
          />
          <span>{copy.showInactive}</span>
        </label>
      )}
      {canManage || hideAccessStatus ? null : (
        <output
          aria-label={accessCopy.readOnlyDescription}
          className="flex items-center gap-1.5 text-sm whitespace-nowrap text-muted-foreground"
        >
          <LockKeyhole className="size-4" />
          <span>{accessCopy.readOnlyTitle}</span>
          <span className="sr-only">{accessCopy.readOnlyDescription}</span>
        </output>
      )}
    </>
  );

  if (phone && !summary && !compact) {
    return (
      <ConfirmationLibraryMobile
        locale={locale}
        title={copy.title}
        search={persistentActions}
        actions={
          <>
            {actions}
            {canManage ? (
              <Button onClick={onCreate}>
                <Plus />
                {copy.add}
              </Button>
            ) : null}
          </>
        }
        filters={INFORMATION_FILTER_COLUMNS.map((column) => (
          <ConfirmationColumnFilter
            key={column}
            label={
              column === "code"
                ? copy.code
                : column === "source"
                  ? copy.sourceLabel
                  : (copy[column] ?? column)
            }
            options={filterOptions[column]}
            selectedValues={columnFilters[column] ?? []}
            onChange={(values) => handleColumnFilterChange(column, values)}
            labels={filterLabels}
          />
        ))}
        loading={isLoading}
        error={isError}
        onRetry={onRetry}
        count={filteredRows.length}
        empty={query ? copy.noResults : copy.empty}
      >
        {filteredRows.map((entry) => (
          <ConfirmationLibraryRecord
            key={entry.id}
            id={entry.id}
            locale={locale}
            title={locale === "zh-CN" ? entry.bankNameZh : entry.bankNameEn}
            description={`${entry.bankCode} · ${entry.bankType}`}
            meta={displayedMailingAddress(entry) || copy.incomplete}
            onOpen={() => onRowClick?.(entry)}
            actions={
              canManage ? (
                entry.isActive ? (
                  <>
                    <Button onClick={() => onEdit(entry)}>{copy.edit}</Button>
                    <Button
                      disabled={deactivatePending}
                      onClick={() => onDeactivate(entry)}
                    >
                      {copy.deactivate}
                    </Button>
                  </>
                ) : (
                  <Button
                    disabled={restorePending}
                    onClick={() => onRestore(entry)}
                  >
                    {copy.restore}
                  </Button>
                )
              ) : undefined
            }
          />
        ))}
      </ConfirmationLibraryMobile>
    );
  }
  return (
    <div className="confirmation-information-library-grid flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <ProjectWingMasterDataGrid
        locale={locale === "zh-CN" ? "zh-CN" : "en-US"}
        actions={actions}
        primaryAction={
          canManage ? (
            <Button type="button" onClick={onCreate}>
              <Plus />
              {copy.add}
            </Button>
          ) : undefined
        }
        showRecordCount={!isLoading && !isError}
        columns={columns}
        content={
          isLoading ? (
            <CollectionState
              kind="loading"
              locale={locale === "zh-CN" ? "zh-CN" : "en-US"}
              title={copy.loading}
            />
          ) : isError ? (
            <CollectionState
              kind="error"
              locale={locale === "zh-CN" ? "zh-CN" : "en-US"}
              title={copy.loadError}
              onRetry={onRetry}
            />
          ) : undefined
        }
        data={filteredRows}
        emptyMessage={
          query.trim() ||
          Object.values(columnFilters).some((values) => values.length)
            ? copy.noResults
            : copy.empty
        }
        getRowId={(entry) => entry.id}
        onRowClick={onRowClick}
        overflowLabel={copy.moreActions}
        paginationPageSize={compact || isLoading || isError ? undefined : 30}
        paginationPageSizeLabel={compact ? undefined : copy.rowsPerPage}
        paginationPageSizeOptionSuffix={
          compact ? undefined : copy.rowsPerPageSuffix
        }
        paginationPageSizeOptions={compact ? undefined : [30, 40, 50]}
        paginationResetKey={`${query}\u0000${includeInactive}\u0000${JSON.stringify(columnFilters)}`}
        persistentActions={persistentActions}
        showRowSelection={false}
        tableLayout={{
          width: summary ? "auto" : "fixed",
          columnsResizable: false,
        }}
        tableLabel={copy.title}
        testId="confirmation-information-library-data-grid"
        toolbarTestId="confirmation-information-library-toolbar"
        title={copy.title}
      />
    </div>
  );
}
