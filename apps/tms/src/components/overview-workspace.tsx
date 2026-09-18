"use client";

import type {
  TmsOverviewEmployee,
  TmsOverviewPeriod,
} from "@project-wing/shared";
import {
  UI_UNIT_LABELS,
  Badge as StatusBadge,
  Button as MobileButton,
  CollectionState,
  MobileActionSheet,
  MobileListItem,
  useCompactViewport,
  ViewSwitcher,
} from "@project-wing/ui";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { TmsHeader } from "@/components/tms-header";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getPeriodLabel,
  getTmsMonthLabels,
  getTmsWorkspaceCopy,
} from "@/i18n/dictionaries";
import { getTmsMobileCopy } from "@/i18n/mobile";
import type { TmsLocale } from "@/i18n/settings";
import { getTmsOverview } from "@/lib/api";
import type { User } from "@/lib/api";
import { cn } from "@/lib/utils";

import { TmsMobileControls } from "./tms-mobile-controls";

import mobileStyles from "./tms-mobile.module.css";

type OverviewWorkspaceProps = {
  locale?: TmsLocale;
  onBack: () => void;
  onSignOut: () => void;
  renderHeader?: boolean;
  user: User;
};

const PERIODS: TmsOverviewPeriod[] = ["all", "first", "second"];

export function OverviewWorkspace({
  locale = "zh-CN",
  onBack,
  onSignOut,
  renderHeader = true,
  user,
}: OverviewWorkspaceProps) {
  const copy = getTmsWorkspaceCopy(locale);
  const phone = useCompactViewport(767.98);
  const mobileCopy = getTmsMobileCopy(locale);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [period, setPeriod] = useState<TmsOverviewPeriod>("all");
  const [employees, setEmployees] = useState<TmsOverviewEmployee[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await getTmsOverview(year, month, period);
      setEmployees(response.employees);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [month, period, year]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  if (phone) {
    const selected = employees.find(
      (employee) => employee.userId === expandedUserId
    );
    const statusLabel = (employee: TmsOverviewEmployee) =>
      employee.status === "APPROVED"
        ? copy.statusApproved
        : employee.status === "SUBMITTED"
          ? copy.statusSubmitted
          : copy.statusNotSubmitted;
    return (
      <main
        className={`flex flex-col overflow-hidden ${renderHeader ? "h-dvh" : "h-[calc(100dvh-3.5rem)]"}`}
      >
        {renderHeader && (
          <TmsHeader
            overviewActive
            locale={locale}
            user={user}
            onOpenTimesheet={onBack}
            onReturn={onBack}
            returnTarget="TIMESHEET"
            onSignOut={onSignOut}
          />
        )}
        <section
          className={`${mobileStyles.root} ${mobileStyles.padded}`}
          data-testid="overview-mobile"
        >
          <div className={mobileStyles.toolbar}>
            <TmsMobileControls
              label={mobileCopy.period}
              title={`${year} / ${month} · ${getPeriodLabel(period, locale)}`}
              locale={locale}
            >
              <ViewSwitcher
                label={copy.year}
                value={String(year)}
                options={Array.from({ length: 5 }, (_, i) => ({
                  value: String(now.getFullYear() - 2 + i),
                  label: String(now.getFullYear() - 2 + i),
                }))}
                onValueChange={(value) => setYear(Number(value))}
                mobilePresentation="sheet"
              />
              <ViewSwitcher
                label={copy.month}
                value={String(month)}
                options={getTmsMonthLabels(locale).map((label, i) => ({
                  label,
                  value: String(i + 1),
                }))}
                onValueChange={(value) => setMonth(Number(value))}
                mobilePresentation="sheet"
              />
              <ViewSwitcher
                label={copy.period}
                value={period}
                options={PERIODS.map((value) => ({
                  value,
                  label: getPeriodLabel(value, locale),
                }))}
                onValueChange={(value) => setPeriod(value as TmsOverviewPeriod)}
                mobilePresentation="sheet"
              />
            </TmsMobileControls>
            <MobileButton
              variant="quiet"
              size="icon"
              aria-label={copy.refresh}
              disabled={loading}
              onClick={() => void loadOverview()}
            >
              <RefreshCw />
            </MobileButton>
          </div>
          <div className={mobileStyles.metrics}>
            <div className={mobileStyles.metric}>
              {copy.employee}
              <strong>{employees.length}</strong>
            </div>
            <div className={mobileStyles.metric}>
              {copy.total}
              <strong>
                {employees
                  .reduce(
                    (sum, employee) =>
                      sum + employee.normal + employee.ot + employee.leave,
                    0
                  )
                  .toFixed(1)}{" "}
                {UI_UNIT_LABELS.hours}
              </strong>
            </div>
          </div>
          <div className={mobileStyles.list}>
            {loading || error ? (
              <CollectionState
                kind={error ? "error" : "loading"}
                locale={locale}
                onRetry={() => void loadOverview()}
              />
            ) : employees.length ? (
              employees.map((employee) => (
                <MobileListItem
                  key={employee.userId}
                  title={employee.name}
                  description={employee.email}
                  meta={
                    <span>
                      {statusLabel(employee)} · {copy.normal} {employee.normal}{" "}
                      / {copy.ot} {employee.ot} / {copy.leave} {employee.leave}{" "}
                      {UI_UNIT_LABELS.hours}
                    </span>
                  }
                  href="#employee-hours"
                  onNavigate={(event) => {
                    event.preventDefault();
                    setExpandedUserId(employee.userId);
                  }}
                />
              ))
            ) : (
              <CollectionState
                kind="empty"
                title={copy.noOverviewData}
                locale={locale}
              />
            )}
          </div>
        </section>
        <MobileActionSheet
          open={Boolean(selected)}
          onOpenChange={(open) => {
            if (!open) {
              setExpandedUserId(null);
            }
          }}
          title={selected?.name ?? copy.employee}
          closeLabel={mobileCopy.close}
        >
          {selected && (
            <div className={mobileStyles.fields}>
              <p>
                {statusLabel(selected)} · {selected.email}
              </p>
              <div className={mobileStyles.metrics}>
                <div className={mobileStyles.metric}>
                  {copy.warning}
                  <strong>{selected.warningCount}</strong>
                </div>
                <div className={mobileStyles.metric}>
                  {copy.error}
                  <strong>{selected.errorCount}</strong>
                </div>
              </div>
              {selected.daily.map((day) => (
                <section className={mobileStyles.record} key={day.date}>
                  <div className={mobileStyles.identity}>
                    <strong>{day.date}</strong>
                    <span className={mobileStyles.tag}>
                      {day.state === "ERROR"
                        ? copy.error
                        : day.state === "WARNING"
                          ? copy.warning
                          : copy.ok}
                    </span>
                  </div>
                  <p className={mobileStyles.muted}>
                    {copy.normal} {day.normal} {UI_UNIT_LABELS.hours} ·{" "}
                    {copy.ot} {day.ot} {UI_UNIT_LABELS.hours} · {copy.leave}{" "}
                    {day.leave} {UI_UNIT_LABELS.hours}
                  </p>
                  <strong>
                    {copy.total} {day.total} {UI_UNIT_LABELS.hours}
                  </strong>
                </section>
              ))}
            </div>
          )}
        </MobileActionSheet>
      </main>
    );
  }
  return (
    <main
      className={cn(
        "overflow-hidden bg-background text-foreground",
        renderHeader ? "h-dvh" : "h-[calc(100dvh-3.5rem)]"
      )}
    >
      {renderHeader ? (
        <TmsHeader
          overviewActive
          locale={locale}
          user={user}
          onOpenTimesheet={onBack}
          onReturn={onBack}
          returnTarget="TIMESHEET"
          onSignOut={onSignOut}
        />
      ) : null}
      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden px-4 py-3">
        <section className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{copy.overviewTitle}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {copy.overviewDescription}
            </p>
          </div>
          <ButtonGroup label={copy.overview} className="items-end">
            <OverviewSelect
              label={copy.year}
              value={String(year)}
              options={Array.from({ length: 5 }, (_, index) => {
                const value = now.getFullYear() - 2 + index;
                return { value: String(value), label: String(value) };
              })}
              onValueChange={(value) => value && setYear(Number(value))}
            />
            <OverviewSelect
              label={copy.month}
              value={String(month)}
              options={getTmsMonthLabels(locale).map((label, index) => ({
                value: String(index + 1),
                label,
              }))}
              onValueChange={(value) => value && setMonth(Number(value))}
            />
            <OverviewSelect
              label={copy.period}
              value={period}
              options={PERIODS.map((value) => ({
                value,
                label: getPeriodLabel(value, locale),
              }))}
              onValueChange={(value) =>
                value && setPeriod(value as TmsOverviewPeriod)
              }
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={copy.refresh}
              onClick={() => void loadOverview()}
            >
              <RefreshCw
                className={cn("size-3.5", loading && "animate-spin")}
              />
              {copy.refresh}
            </Button>
          </ButtonGroup>
        </section>

        <section className="min-h-0 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          {error ? (
            <div className="grid h-full place-items-center p-6 text-sm text-destructive">
              {copy.overviewLoadFailed}
            </div>
          ) : loading && employees.length === 0 ? (
            <div className="grid h-full place-items-center p-6 text-sm text-muted-foreground">
              {copy.loading}
            </div>
          ) : employees.length > 0 ? (
            <div className="h-full overflow-auto">
              <table className="w-full min-w-[860px] border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-muted/95 text-muted-foreground">
                  <tr>
                    <th className="w-[190px] border-r border-b border-border px-3 py-2 text-left font-medium">
                      {copy.employee}
                    </th>
                    <th className="w-[105px] border-r border-b border-border px-2 py-2 text-center font-medium">
                      {copy.status}
                    </th>
                    <th className="w-[90px] border-r border-b border-border px-2 py-2 text-center font-medium">
                      {copy.normal}
                    </th>
                    <th className="w-[90px] border-r border-b border-border px-2 py-2 text-center font-medium">
                      {copy.ot}
                    </th>
                    <th className="w-[90px] border-r border-b border-border px-2 py-2 text-center font-medium">
                      {copy.leave}
                    </th>
                    <th className="w-[90px] border-r border-b border-border px-2 py-2 text-center font-medium">
                      {copy.warning}
                    </th>
                    <th className="w-[90px] border-b border-border px-2 py-2 text-center font-medium">
                      {copy.error}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => {
                    const expanded = expandedUserId === employee.userId;
                    return (
                      <OverviewEmployeeRows
                        key={employee.userId}
                        copy={copy}
                        employee={employee}
                        expanded={expanded}
                        locale={locale}
                        onToggle={() =>
                          setExpandedUserId(expanded ? null : employee.userId)
                        }
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid h-full place-items-center p-6 text-sm text-muted-foreground">
              {copy.noOverviewData}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function OverviewSelect({
  label,
  onValueChange,
  options,
  value,
}: {
  label: string;
  onValueChange: (value: string | null) => void;
  options: { value: string; label: string }[];
  value: string;
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label;
  return (
    <label className="grid gap-1 text-[0.68rem] font-medium text-muted-foreground">
      <span>{label}</span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger size="sm" className="min-w-24">
          <SelectValue>{selectedLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </label>
  );
}

function OverviewEmployeeRows({
  copy,
  employee,
  expanded,
  locale: _locale,
  onToggle,
}: {
  copy: ReturnType<typeof getTmsWorkspaceCopy>;
  employee: TmsOverviewEmployee;
  expanded: boolean;
  locale: TmsLocale;
  onToggle: () => void;
}) {
  const statusLabel =
    employee.status === "APPROVED"
      ? copy.statusApproved
      : employee.status === "SUBMITTED"
        ? copy.statusSubmitted
        : copy.statusNotSubmitted;
  return (
    <>
      <tr className="border-b border-border align-middle">
        <td className="border-r border-border px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto min-w-0 justify-start px-0 text-left"
            aria-label={`${employee.name} ${statusLabel}`}
            aria-expanded={expanded}
            onClick={onToggle}
          >
            <span className="truncate font-semibold">{employee.name}</span>
            <span className="ml-2 truncate text-[0.68rem] text-muted-foreground">
              {employee.email}
            </span>
          </Button>
        </td>
        <td className="border-r border-border px-2 py-2 text-center">
          <StatusBadge
            className="px-2 py-0.5 text-[0.68rem]"
            radius="full"
            variant={
              employee.status === "APPROVED"
                ? "success-light"
                : employee.status === "SUBMITTED"
                  ? "warning-light"
                  : "secondary"
            }
          >
            {statusLabel}
          </StatusBadge>
        </td>
        <td className="border-r border-border px-2 py-2 text-center tabular-nums">
          {employee.normal.toFixed(1)}
          {copy.hoursSuffix}
        </td>
        <td className="border-r border-border px-2 py-2 text-center tabular-nums">
          {employee.ot.toFixed(1)}
          {copy.hoursSuffix}
        </td>
        <td className="border-r border-border px-2 py-2 text-center tabular-nums">
          {employee.leave.toFixed(1)}
          {copy.hoursSuffix}
        </td>
        <td className="border-r border-border px-2 py-2 text-center tabular-nums">
          {employee.warningCount > 0 ? (
            <StatusBadge variant="warning-light">
              {employee.warningCount}
            </StatusBadge>
          ) : (
            employee.warningCount
          )}
        </td>
        <td className="px-2 py-2 text-center tabular-nums">
          {employee.errorCount > 0 ? (
            <StatusBadge variant="destructive-light">
              {employee.errorCount}
            </StatusBadge>
          ) : (
            employee.errorCount
          )}
        </td>
      </tr>
      {expanded ? (
        <tr data-testid={`tms-overview-detail-${employee.userId}`}>
          <td
            colSpan={7}
            aria-label={copy.dailyTotal}
            className="border-b border-border bg-muted/20 p-3"
          >
            <div className="grid gap-2">
              <div className="text-xs font-semibold">{copy.dailyTotal}</div>
              <div className="grid min-w-max auto-cols-[76px] grid-flow-col gap-1 overflow-x-auto">
                {employee.daily.map((day) => (
                  <div
                    key={day.date}
                    className={cn(
                      "rounded-md border px-1.5 py-1.5 text-center",
                      day.state === "ERROR"
                        ? "border-destructive-accent bg-destructive-subtle text-foreground"
                        : day.state === "WARNING"
                          ? "border-warning-accent bg-warning-subtle text-foreground"
                          : "border-border bg-card text-foreground"
                    )}
                    title={`${day.date}: ${day.normal.toFixed(1)}h Normal + ${day.ot.toFixed(1)}h OT + ${day.leave.toFixed(1)}h Leave`}
                  >
                    <div className="text-[0.65rem] text-muted-foreground">
                      {day.date.slice(-2)}
                    </div>
                    <div className="font-semibold tabular-nums">
                      {day.total.toFixed(1)}
                      {copy.hoursSuffix}
                    </div>
                    <div className="text-[0.62rem]">
                      {day.state === "ERROR"
                        ? copy.error
                        : day.state === "WARNING"
                          ? copy.warning
                          : copy.ok}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
