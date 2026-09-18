"use client";

import type {
  TmsTimesheetQueryInput,
  TmsTimesheetQueryResponse,
} from "@project-wing/shared";
import {
  UI_UNIT_LABELS,
  Badge as StatusBadge,
  DataGridColumnHeader,
  ProjectWingLoadingProgress,
  ProjectWingMasterDataGrid,
  projectWingToast as toast,
  useCompactViewport,
  Button as MobileButton,
  Input as MobileInput,
  MobileActionSheet,
  MobileListItem,
  CollectionState,
  ViewSwitcher,
} from "@project-wing/ui";
import type { ProjectWingMasterDataGridProps } from "@project-wing/ui";
import { Download, RotateCcw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { TmsHeader } from "@/components/tms-header";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getTmsStatusLabel, getTmsWorkspaceCopy } from "@/i18n/dictionaries";
import type { TmsWorkspaceCopy } from "@/i18n/dictionaries";
import { getTmsMobileCopy } from "@/i18n/mobile";
import type { TmsLocale } from "@/i18n/settings";
import { downloadTmsTimesheetQuery, getTmsTimesheetQuery } from "@/lib/api";
import type { User } from "@/lib/api";

import { TmsMobileActions } from "./tms-mobile-controls";

import mobileStyles from "./tms-mobile.module.css";

const DEFAULT_QUERY: TmsTimesheetQueryInput = {
  mode: "DETAIL",
  sortBy: "JOB_CODE",
  sortDirection: "asc",
  page: 1,
  pageSize: 50,
};
const DETAIL_COLUMN_SIZES = [
  164, 112, 168, 132, 104, 104, 88, 96, 120, 220, 132, 144, 144, 148, 132,
] as const;
const SUMMARY_COLUMN_SIZES = [
  164, 112, 168, 132, 132, 104, 104, 88, 96, 120, 220, 132, 144, 144, 148, 132,
] as const;

type QueryGridRow = {
  id: string;
  values: (string | number)[];
};

export function QueryWorkspace({
  approvalPending = false,
  locale,
  onBack,
  onOpenApprovals,
  onSignOut,
  renderHeader = true,
  user,
}: {
  approvalPending?: boolean;
  onBack: () => void;
  onOpenApprovals?: () => void;
  onSignOut: () => void;
  renderHeader?: boolean;
  user: User;
  locale?: TmsLocale;
}) {
  const effectiveLocale = locale ?? "en-US";
  const phone = useCompactViewport(767.98);
  const mobileCopy = getTmsMobileCopy(effectiveLocale);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [mobileRow, setMobileRow] = useState<
    TmsTimesheetQueryResponse["rows"][number] | null
  >(null);
  const [loadError, setLoadError] = useState(false);
  const copy = useMemo(
    () =>
      locale
        ? getTmsWorkspaceCopy(locale)
        : {
            ...getTmsWorkspaceCopy("en-US"),
            back: getTmsWorkspaceCopy("zh-CN").back,
            detail: getTmsWorkspaceCopy("zh-CN").detail,
            summary: getTmsWorkspaceCopy("zh-CN").summary,
          },
    [locale]
  );
  const [draft, setDraft] = useState<TmsTimesheetQueryInput>(DEFAULT_QUERY);
  const [query, setQuery] = useState<TmsTimesheetQueryInput>(DEFAULT_QUERY);
  const [result, setResult] = useState<TmsTimesheetQueryResponse | null>(null);
  const [resultVersion, setResultVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    void getTmsTimesheetQuery(query)
      .then((value) => {
        if (active) {
          setResult(value);
          setResultVersion((current) => current + 1);
        }
      })
      .catch(() => {
        if (active) {
          toast.error(copy.unableLoadQuery);
          setLoadError(true);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [copy.unableLoadQuery, query]);

  function setText(
    key:
      | "staffName"
      | "staffNo"
      | "jobCode"
      | "pic"
      | "mic"
      | "dateFrom"
      | "dateTo",
    value: string
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const file = await downloadTmsTimesheetQuery({
        ...query,
        page: 1,
      });
      const url = URL.createObjectURL(file.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(copy.unableExportQuery);
    } finally {
      setExporting(false);
    }
  }

  const gridRows = useMemo<QueryGridRow[]>(
    () =>
      result
        ? (result.rows ?? []).map((row, index) => ({
            id: `${row.jobCode}-${row.staffNo ?? ""}-${row.staffName}-${index}`,
            values: rowValues(result.mode, row, copy),
          }))
        : [],
    [copy, result]
  );
  const gridColumns = useMemo<
    ProjectWingMasterDataGridProps<QueryGridRow>["columns"]
  >(() => {
    if (!result) {
      return [];
    }
    const labels = columnLabels(result.mode, copy);
    const sizes =
      result.mode === "DETAIL" ? DETAIL_COLUMN_SIZES : SUMMARY_COLUMN_SIZES;
    const timesheetStatusCell = labels.length - 2;

    return labels.map((label, index) => ({
      id: `query-${result.mode.toLowerCase()}-${index}`,
      meta: { headerTitle: label },
      accessorFn: (row: QueryGridRow) => row.values[index],
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={label} />
      ),
      cell: ({ getValue }) => {
        const value = getValue<string | number>();
        const statusKind =
          index === timesheetStatusCell
            ? "timesheet"
            : index === timesheetStatusCell + 1
              ? "active"
              : null;
        return statusKind ? (
          <StatusTag
            kind={statusKind}
            value={String(value ?? "")}
            locale={locale}
          />
        ) : (
          <span className="whitespace-nowrap">{String(value ?? "")}</span>
        );
      },
      minSize: Math.min(88, sizes[index] ?? 120),
      size: sizes[index] ?? 144,
    }));
  }, [copy, locale, result]);

  if (phone) {
    const filterCount = [
      query.staffName,
      query.staffNo,
      query.jobCode,
      query.pic,
      query.mic,
      query.dateFrom,
      query.dateTo,
      query.timesheetStatus,
      query.activeStatus,
    ].filter(Boolean).length;
    return (
      <main
        className={`flex flex-col overflow-hidden ${renderHeader ? "h-dvh" : "h-[calc(100dvh-3.5rem)]"}`}
      >
        {renderHeader && (
          <TmsHeader
            queryActive
            approvalPending={approvalPending}
            locale={effectiveLocale}
            user={user}
            onOpenApprovals={onOpenApprovals}
            onOpenTimesheet={onBack}
            onReturn={onBack}
            returnTarget="TIMESHEET"
            onSignOut={onSignOut}
          />
        )}
        <section
          className={`${mobileStyles.root} ${mobileStyles.padded}`}
          data-testid="query-mobile"
        >
          <div className={mobileStyles.toolbar}>
            <ViewSwitcher
              label={copy.timesheetResults}
              value={query.mode}
              options={[
                { value: "DETAIL", label: copy.detail },
                { value: "SUMMARY", label: copy.summary },
              ]}
              onValueChange={(mode) => {
                setDraft((current) => ({
                  ...current,
                  mode: mode as "DETAIL" | "SUMMARY",
                }));
                setQuery((current) => ({
                  ...current,
                  mode: mode as "DETAIL" | "SUMMARY",
                  page: 1,
                }));
              }}
              mobilePresentation="sheet"
            />
            <TmsMobileActions
              locale={effectiveLocale}
              items={[
                {
                  label: copy.exportExcel,
                  onClick: () => void exportExcel(),
                  disabled: exporting,
                },
                {
                  label: copy.reset,
                  onClick: () => {
                    setDraft(DEFAULT_QUERY);
                    setQuery(DEFAULT_QUERY);
                  },
                },
              ]}
            />
          </div>
          <MobileButton
            variant={filterCount ? "secondary" : "outline"}
            onClick={() => setMobileFilters(true)}
          >
            {mobileCopy.filters}
            {filterCount ? ` (${filterCount})` : ""}
          </MobileButton>
          <div className={mobileStyles.list}>
            {loading || loadError ? (
              <CollectionState
                kind={loadError ? "error" : "loading"}
                locale={effectiveLocale}
                onRetry={() => setQuery((current) => ({ ...current }))}
              />
            ) : result?.rows.length ? (
              result.rows.map((row, index) => (
                <MobileListItem
                  key={`${row.jobCode}-${row.staffNo}-${index}`}
                  title={row.staffName}
                  description={`${row.jobCode} · ${row.clientName}`}
                  meta={
                    <span>
                      {"timesheetDate" in row
                        ? row.timesheetDate
                        : `${row.dateFrom ?? copy.allDates} – ${row.dateTo ?? copy.allDates}`}{" "}
                      · {copy.normal} {row.normal} {UI_UNIT_LABELS.hours} ·{" "}
                      {copy.ot} {row.ot} {UI_UNIT_LABELS.hours} ·{" "}
                      <StatusTag
                        locale={effectiveLocale}
                        kind="timesheet"
                        value={row.timesheetStatus}
                      />
                    </span>
                  }
                  href="#query-details"
                  onNavigate={(event) => {
                    event.preventDefault();
                    setMobileRow(row);
                  }}
                />
              ))
            ) : (
              <CollectionState
                kind="empty"
                title={copy.noResults}
                locale={effectiveLocale}
              />
            )}
          </div>
          {result && result.total > result.pageSize && (
            <div className={mobileStyles.actions}>
              <MobileButton
                variant="quiet"
                disabled={loading || result.page <= 1}
                onClick={() =>
                  setQuery((current) => ({
                    ...current,
                    page: current.page - 1,
                  }))
                }
              >
                {mobileCopy.previousPage}
              </MobileButton>
              <MobileButton
                variant="quiet"
                disabled={
                  loading || result.page * result.pageSize >= result.total
                }
                onClick={() =>
                  setQuery((current) => ({
                    ...current,
                    page: current.page + 1,
                  }))
                }
              >
                {mobileCopy.nextPage}
              </MobileButton>
            </div>
          )}
        </section>
        <MobileActionSheet
          title={mobileCopy.filters}
          closeLabel={copy.cancel}
          open={mobileFilters}
          onOpenChange={setMobileFilters}
        >
          <div className={mobileStyles.fields}>
            <QueryInput
              label={copy.staffName}
              value={draft.staffName ?? ""}
              onChange={(value) => setText("staffName", value)}
            />
            <QueryInput
              label={copy.engagementCode}
              value={draft.jobCode ?? ""}
              onChange={(value) => setText("jobCode", value)}
            />
            <label>
              {copy.dateFrom}
              <MobileInput
                type="date"
                aria-label={copy.dateFrom}
                value={draft.dateFrom ?? ""}
                onChange={(event) => setText("dateFrom", event.target.value)}
              />
            </label>
            <label>
              {copy.dateTo}
              <MobileInput
                type="date"
                aria-label={copy.dateTo}
                value={draft.dateTo ?? ""}
                onChange={(event) => setText("dateTo", event.target.value)}
              />
            </label>
            <QuerySelect
              label={copy.timesheetStatus}
              copy={copy}
              locale={effectiveLocale}
              value={draft.timesheetStatus ?? ""}
              options={["DRAFT", "SUBMITTED", "APPROVED", "RETURNED"]}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  timesheetStatus: (value ||
                    undefined) as TmsTimesheetQueryInput["timesheetStatus"],
                }))
              }
            />
            <MobileButton
              variant="quiet"
              aria-expanded={advanced}
              onClick={() => setAdvanced((value) => !value)}
            >
              {mobileCopy.advancedFilters}
            </MobileButton>
            {advanced && (
              <>
                <QueryInput
                  label={copy.staffNo}
                  value={draft.staffNo ?? ""}
                  onChange={(value) => setText("staffNo", value)}
                />
                <QueryInput
                  label={copy.pic}
                  value={draft.pic ?? ""}
                  onChange={(value) => setText("pic", value)}
                />
                <QueryInput
                  label={copy.mic}
                  value={draft.mic ?? ""}
                  onChange={(value) => setText("mic", value)}
                />
                <QuerySelect
                  label={copy.activeStatus}
                  copy={copy}
                  locale={effectiveLocale}
                  value={draft.activeStatus ?? ""}
                  options={["ACTIVE", "OFF_LINE", "LEAVE"]}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      activeStatus: (value ||
                        undefined) as TmsTimesheetQueryInput["activeStatus"],
                    }))
                  }
                />
                <QuerySelect
                  label={copy.orderBy}
                  copy={copy}
                  locale={effectiveLocale}
                  value={draft.sortBy}
                  options={[
                    "JOB_CODE",
                    "STAFF_NAME",
                    "TIMESHEET_DATE",
                    "CLIENT_NAME",
                  ]}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      sortBy: value as TmsTimesheetQueryInput["sortBy"],
                    }))
                  }
                />
              </>
            )}
            <MobileButton
              variant="primary"
              onClick={() => {
                setQuery({ ...draft, page: 1 });
                setMobileFilters(false);
              }}
            >
              {copy.search}
            </MobileButton>
          </div>
        </MobileActionSheet>
        <MobileActionSheet
          open={Boolean(mobileRow)}
          onOpenChange={(open) => {
            if (!open) {
              setMobileRow(null);
            }
          }}
          title={mobileRow?.staffName ?? mobileCopy.details}
          closeLabel={copy.cancel}
        >
          {mobileRow && result && (
            <dl className={mobileStyles.details}>
              {columnLabels(result.mode, copy).map((label, index) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    {String(
                      rowValues(result.mode, mobileRow, copy)[index] ?? "—"
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </MobileActionSheet>
      </main>
    );
  }
  return (
    <main className="grid min-h-screen grid-rows-[auto_minmax(0,1fr)] bg-background">
      {renderHeader ? (
        <TmsHeader
          approvalPending={approvalPending}
          locale={effectiveLocale}
          queryActive
          user={user}
          onOpenApprovals={onOpenApprovals}
          onOpenQuery={onBack}
          onOpenTimesheet={onBack}
          onReturn={onBack}
          returnTarget="TIMESHEET"
          onSignOut={onSignOut}
        />
      ) : null}
      <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 p-3">
        <div className="grid gap-2">
          <section
            aria-label={copy.timesheetFilters}
            data-testid="query-filter-panel"
            className="rounded-lg border border-border bg-card p-3 shadow-sm"
          >
            <div
              data-query-filter-controls=""
              className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7"
            >
              <QueryInput
                label={copy.staffName}
                value={draft.staffName ?? ""}
                onChange={(value) => setText("staffName", value)}
              />
              <QueryInput
                label={copy.staffNo}
                value={draft.staffNo ?? ""}
                onChange={(value) => setText("staffNo", value)}
              />
              <QueryInput
                label={copy.engagementCode}
                value={draft.jobCode ?? ""}
                onChange={(value) => setText("jobCode", value)}
              />
              <QueryInput
                label={copy.pic}
                value={draft.pic ?? ""}
                onChange={(value) => setText("pic", value)}
              />
              <QueryInput
                label={copy.mic}
                value={draft.mic ?? ""}
                onChange={(value) => setText("mic", value)}
              />
              <QuerySelect
                label={copy.timesheetStatus}
                copy={copy}
                locale={locale}
                value={draft.timesheetStatus ?? ""}
                options={["DRAFT", "SUBMITTED", "APPROVED", "RETURNED"]}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    timesheetStatus: (value ||
                      undefined) as TmsTimesheetQueryInput["timesheetStatus"],
                  }))
                }
              />
              <QuerySelect
                label={copy.activeStatus}
                copy={copy}
                locale={locale}
                value={draft.activeStatus ?? ""}
                options={["ACTIVE", "OFF_LINE", "LEAVE"]}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    activeStatus: (value ||
                      undefined) as TmsTimesheetQueryInput["activeStatus"],
                  }))
                }
              />
            </div>
            <div
              data-query-filter-actions=""
              className="mt-2 flex flex-wrap items-end gap-2"
            >
              <QueryDateInput
                label={copy.dateFrom}
                copy={copy}
                value={draft.dateFrom ?? ""}
                onChange={(value) => setText("dateFrom", value)}
              />
              <QueryDateInput
                label={copy.dateTo}
                copy={copy}
                value={draft.dateTo ?? ""}
                onChange={(value) => setText("dateTo", value)}
              />
              <QuerySelect
                label={copy.orderBy}
                copy={copy}
                locale={locale}
                value={draft.sortBy}
                options={[
                  "JOB_CODE",
                  "STAFF_NAME",
                  "TIMESHEET_DATE",
                  "CLIENT_NAME",
                ]}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    sortBy: value as TmsTimesheetQueryInput["sortBy"],
                  }))
                }
              />
              <Button
                type="button"
                onClick={() => setQuery({ ...draft, page: 1 })}
              >
                <Search size={16} /> {copy.search}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraft(DEFAULT_QUERY);
                  setQuery(DEFAULT_QUERY);
                }}
              >
                <RotateCcw size={16} /> {copy.reset}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={exporting}
                onClick={() => void exportExcel()}
              >
                <Download size={16} /> {copy.exportExcel}
              </Button>
              <Tabs
                className="ml-auto block gap-0"
                value={query.mode}
                onValueChange={(mode) => {
                  if (!mode || mode === query.mode) {
                    return;
                  }
                  const nextMode = mode as "DETAIL" | "SUMMARY";
                  setDraft((current) => ({ ...current, mode: nextMode }));
                  setQuery((current) => ({
                    ...current,
                    mode: nextMode,
                    page: 1,
                  }));
                }}
              >
                <TabsList
                  data-query-mode={query.mode}
                  data-testid="query-mode-toggle"
                  className="relative h-7 w-24 overflow-hidden rounded-full border border-border bg-muted/50 p-0.5"
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0.5 grid grid-cols-2 rounded-full"
                  >
                    <span
                      data-testid="query-mode-active-indicator"
                      aria-hidden="true"
                      className={`query-mode-active-indicator block w-full rounded-full bg-primary shadow-sm ${
                        query.mode === "SUMMARY"
                          ? "translate-x-full"
                          : "translate-x-0"
                      }`}
                    />
                  </span>
                  <TabsTrigger value="DETAIL" className="query-mode-trigger">
                    {copy.detail}
                  </TabsTrigger>
                  <TabsTrigger value="SUMMARY" className="query-mode-trigger">
                    {copy.summary}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </section>
        </div>

        <section
          aria-label={copy.timesheetResults}
          aria-busy={loading}
          className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
        >
          {loading && !result ? (
            <ProjectWingLoadingProgress />
          ) : result ? (
            <div
              data-query-results-state={loading ? "leaving" : "ready"}
              data-testid="query-results-frame"
              className="query-results-frame min-h-0 flex-1 overflow-hidden"
            >
              <div
                key={resultVersion}
                data-testid="query-results-transition"
                className="query-results-transition h-full min-h-0 min-w-full"
              >
                <ProjectWingMasterDataGrid
                  columns={gridColumns}
                  data={gridRows}
                  emptyMessage={copy.noResults}
                  getRowId={(row) => row.id}
                  tableLabel={copy.timesheetResults}
                  testId="tms-query-data-grid"
                  title={copy.timesheetResults}
                />
              </div>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function QueryInput({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid min-w-40 gap-0.5 text-xs text-muted-foreground">
      {label}
      <Input
        aria-label={label}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function QueryDateInput({
  copy = getTmsWorkspaceCopy("en-US"),
  label,
  onChange,
  value,
}: {
  copy?: TmsWorkspaceCopy;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedDate = parseDateValue(value);

  return (
    <label className="grid min-w-40 gap-0.5 text-xs text-muted-foreground">
      {label}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          nativeButton={false}
          render={<span className="block" />}
        >
          <Input
            aria-label={label}
            type="text"
            inputMode="numeric"
            placeholder={copy.dateFormatPlaceholder}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
              }
            }}
          />
        </PopoverTrigger>
        <PopoverContent
          aria-label={`${label} calendar`}
          align="start"
          className="w-auto p-0"
        >
          <Calendar
            mode="single"
            defaultMonth={selectedDate}
            selected={selectedDate}
            onSelect={(date) => {
              if (!date) {
                return;
              }
              onChange(formatDateValue(date));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </label>
  );
}

function QuerySelect({
  copy = getTmsWorkspaceCopy("en-US"),
  label,
  locale = "en-US",
  onChange,
  options,
  value,
}: {
  copy?: TmsWorkspaceCopy;
  label: string;
  locale?: TmsLocale;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  const allValue = "__all__";

  return (
    <label className="grid min-w-40 gap-0.5 text-xs text-muted-foreground">
      {label}
      <Select
        value={value || allValue}
        onValueChange={(nextValue) =>
          onChange(!nextValue || nextValue === allValue ? "" : nextValue)
        }
      >
        <SelectTrigger aria-label={label} className="w-full">
          <SelectValue>
            {value ? formatQueryOption(value, copy, locale) : copy.all}
          </SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            <SelectItem value={allValue}>{copy.all}</SelectItem>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {formatQueryOption(option, copy, locale)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </label>
  );
}

function parseDateValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return;
  }

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : undefined;
}

function formatDateValue(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatQueryOption(
  option: string,
  copy: TmsWorkspaceCopy = getTmsWorkspaceCopy("en-US"),
  locale: TmsLocale = "en-US"
) {
  const labels: Record<string, string> = {
    JOB_CODE: copy.engagementCode,
    STAFF_NAME: copy.staffName,
    TIMESHEET_DATE: copy.timesheetDate,
    CLIENT_NAME: copy.clientName,
    DRAFT: getTmsStatusLabel("DRAFT", locale),
    SUBMITTED: copy.statusSubmitted,
    APPROVED: copy.statusApproved,
    RETURNED: copy.statusReturned,
    ACTIVE: getTmsStatusLabel("ACTIVE", locale),
    OFF_LINE: getTmsStatusLabel("OFF_LINE", locale),
    LEAVE: copy.leave,
  };
  return labels[option] ?? option.replaceAll("_", " ");
}

function columnLabels(
  mode: "DETAIL" | "SUMMARY",
  copy: TmsWorkspaceCopy = getTmsWorkspaceCopy("en-US")
) {
  return [
    copy.engagementCode,
    copy.staffNo,
    copy.staffName,
    ...(mode === "DETAIL"
      ? [copy.timesheetDate]
      : [copy.dateFrom, copy.dateTo]),
    copy.rate,
    copy.normal,
    copy.ot,
    copy.absent,
    copy.total,
    copy.clientName,
    copy.netBudgetFee,
    copy.pic,
    copy.mic,
    copy.timesheetStatus,
    copy.activeStatus,
  ];
}

function rowValues(
  mode: "DETAIL" | "SUMMARY",
  row: TmsTimesheetQueryResponse["rows"][number],
  copy: TmsWorkspaceCopy = getTmsWorkspaceCopy("en-US")
) {
  const dateValues =
    mode === "DETAIL"
      ? [(row as { timesheetDate: string }).timesheetDate]
      : [
          (row as { dateFrom: string | null }).dateFrom ?? copy.allDates,
          (row as { dateTo: string | null }).dateTo ?? copy.allDates,
        ];
  return [
    row.jobCode,
    row.staffNo ?? "—",
    row.staffName,
    ...dateValues,
    row.rate ?? "—",
    row.normal,
    row.ot,
    row.absent,
    row.total ?? "—",
    row.clientName,
    row.netBudgetFee ?? "—",
    row.pic ?? "—",
    row.mic ?? "—",
    row.timesheetStatus,
    row.activeStatus,
  ];
}

function StatusTag({
  locale,
  kind,
  value,
}: {
  locale?: TmsLocale;
  kind: "timesheet" | "active";
  value: string;
}) {
  const normalized = value.replaceAll("-", "_");
  const variant =
    kind === "timesheet"
      ? normalized === "SUBMITTED"
        ? "warning-light"
        : normalized === "APPROVED"
          ? "success-light"
          : normalized === "RETURNED"
            ? "destructive-light"
            : "secondary"
      : normalized === "ACTIVE"
        ? "success-light"
        : normalized === "LEAVE"
          ? "destructive-light"
          : "secondary";

  return (
    <StatusBadge
      data-status={normalized}
      variant={variant}
      radius="full"
      className="h-auto px-2 py-0.5 text-xs leading-5 font-medium"
    >
      {locale
        ? getTmsStatusLabel(normalized, locale)
        : normalized.replaceAll("_", "-")}
    </StatusBadge>
  );
}
