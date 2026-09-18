"use client";

import type { TmsTimesheetQueryDetailRow } from "@project-wing/shared";
import {
  SelectField,
  ViewSwitcher,
  useCompactViewport,
} from "@project-wing/ui";
import { useMemo, useState } from "react";

import { useCmpI18n } from "@/i18n/client";

import styles from "./cmp-mobile.module.css";

type WorksheetDayCell = { normal: number; ot: number; absent: number };

const WEEKDAY_ZH = ["一", "二", "三", "四", "五", "六", "日"];

function monthKey(date: string) {
  return date.slice(0, 7);
}

function daysInMonth(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return new Date(year, mon, 0).getDate();
}

function weekdayLabel(dateIso: string, locale: string) {
  const date = new Date(`${dateIso}T00:00:00`);
  const index = (date.getDay() + 6) % 7;
  return locale === "zh-CN"
    ? WEEKDAY_ZH[index]
    : WEEKDAY_ZH[index].replace("日", "Sun").slice(0, 3);
}

function isWeekend(dateIso: string) {
  const day = new Date(`${dateIso}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

export function CmpTmsTimesheetWorksheet({
  rows,
}: {
  rows: TmsTimesheetQueryDetailRow[];
}) {
  const phone = useCompactViewport(767.98);
  const [staff, setStaff] = useState("");
  const { dictionary, locale } = useCmpI18n();
  const archiveCopy = dictionary.workspace.archive;
  const byStaff = useMemo(() => {
    const map = new Map<
      string,
      { cells: Map<string, WorksheetDayCell>; statuses: Set<string> }
    >();
    for (const row of rows) {
      const entry = map.get(row.staffName) ?? {
        cells: new Map<string, WorksheetDayCell>(),
        statuses: new Set<string>(),
      };
      const cell = entry.cells.get(row.timesheetDate) ?? {
        normal: 0,
        ot: 0,
        absent: 0,
      };
      entry.cells.set(row.timesheetDate, {
        normal: cell.normal + row.normal,
        ot: cell.ot + row.ot,
        absent: cell.absent + row.absent,
      });
      entry.statuses.add(row.timesheetStatus);
      map.set(row.staffName, entry);
    }
    return map;
  }, [rows]);

  const months = useMemo(
    () =>
      [...new Set(rows.map((row) => monthKey(row.timesheetDate)))].sort(
        (a, b) => b.localeCompare(a)
      ),
    [rows]
  );
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const activeMonth = selectedMonth ?? months[0] ?? null;

  if (!rows.length || !activeMonth) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {archiveCopy.worksheetEmpty}
      </p>
    );
  }

  const dayCount = daysInMonth(activeMonth);
  const days = Array.from({ length: dayCount }, (_, index) => {
    const date = `${activeMonth}-${String(index + 1).padStart(2, "0")}`;
    return { date, dayOfMonth: index + 1, label: weekdayLabel(date, locale) };
  });

  if (phone) {
    const staffNames = [...byStaff.keys()].sort((a, b) => a.localeCompare(b));
    const activeStaff = byStaff.has(staff) ? staff : staffNames[0];
    const entry = byStaff.get(activeStaff);
    const cells = days
      .map((day) => entry?.cells.get(day.date))
      .filter((cell): cell is WorksheetDayCell => Boolean(cell));
    const totals = cells.reduce<WorksheetDayCell & { days: number }>(
      (sum, cell) => ({
        normal: sum.normal + cell.normal,
        ot: sum.ot + cell.ot,
        absent: sum.absent + cell.absent,
        days: sum.days + (cell.normal + cell.ot > 0 ? 1 : 0),
      }),
      { normal: 0, ot: 0, absent: 0, days: 0 }
    );
    return (
      <div className={styles.fields} data-testid="cmp-mobile-worksheet">
        <ViewSwitcher
          label={archiveCopy.worksheetMonth}
          value={activeMonth}
          options={months.map((value) => ({ value, label: value }))}
          onValueChange={setSelectedMonth}
          mobilePresentation="sheet"
        />
        <ViewSwitcher
          label={archiveCopy.worksheetMember}
          value={activeStaff}
          options={staffNames.map((value) => ({ value, label: value }))}
          onValueChange={setStaff}
          mobilePresentation="sheet"
        />
        <dl className={styles.metrics}>
          {[
            [archiveCopy.worksheetNormal, totals.normal],
            [archiveCopy.worksheetOt, totals.ot],
            [archiveCopy.worksheetAbsent, totals.absent],
            [archiveCopy.worksheetAttendDays, totals.days],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {days.map((day) => {
          const cell = entry?.cells.get(day.date);
          return (
            <section className={styles.record} key={day.date}>
              <strong>{day.date}</strong>
              <p className={styles.muted}>
                {archiveCopy.worksheetNormal}: {cell?.normal ?? "—"} ·{" "}
                {archiveCopy.worksheetOt}: {cell?.ot ?? "—"} ·{" "}
                {archiveCopy.worksheetAbsent}: {cell?.absent ?? "—"}
              </p>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {archiveCopy.worksheetMonth}
        </span>
        <SelectField
          label={archiveCopy.worksheetMonth}
          labelVisibility="hidden"
          onValueChange={setSelectedMonth}
          value={activeMonth}
          options={months.map((month) => ({ value: month, label: month }))}
        />
        <span className="text-xs text-muted-foreground">
          {archiveCopy.personnelRows.replace("{count}", String(byStaff.size))}
        </span>
      </div>
      <div className="cmp-horizontal-data-scrollbar overflow-x-auto overscroll-x-contain rounded-lg border">
        <table className="border-collapse text-xs">
          <thead>
            <tr className="bg-muted/40">
              <th className="sticky left-0 z-10 min-w-[7rem] border-b bg-muted/40 px-3 py-2 text-left font-medium text-muted-foreground">
                {archiveCopy.worksheetMember}
              </th>
              {days.map((day) => (
                <th
                  className={`w-[46px] border-b px-0 py-1 text-center font-medium ${
                    isWeekend(day.date) ? "bg-muted/70" : ""
                  }`}
                  key={day.date}
                >
                  <span className="block leading-4">{day.dayOfMonth}</span>
                  <span className="block text-[0.62rem] leading-3 font-medium text-muted-foreground">
                    {day.label}
                  </span>
                </th>
              ))}
              <th className="border-b px-2 py-2 text-center font-medium text-muted-foreground">
                {archiveCopy.worksheetNormal}
              </th>
              <th className="border-b px-2 py-2 text-center font-medium text-muted-foreground">
                {archiveCopy.worksheetOt}
              </th>
              <th className="border-b px-2 py-2 text-center font-medium text-muted-foreground">
                {archiveCopy.worksheetAbsent}
              </th>
              <th className="border-b px-2 py-2 text-center font-medium text-muted-foreground">
                {archiveCopy.worksheetAttendDays}
              </th>
            </tr>
          </thead>
          <tbody>
            {[...byStaff.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([staffName, entry]) => {
                const totals = { normal: 0, ot: 0, absent: 0, days: 0 };
                return (
                  <tr className="h-7 border-t" key={staffName}>
                    <td className="sticky left-0 z-10 min-w-[7rem] border-r bg-card px-3 font-medium">
                      {staffName}
                    </td>
                    {days.map((day) => {
                      const cell = entry.cells.get(day.date);
                      const weekend = isWeekend(day.date);
                      if (!cell || cell.normal + cell.ot + cell.absent === 0) {
                        return (
                          <td
                            className={`text-center text-muted-foreground/40 ${
                              weekend ? "bg-muted/50" : ""
                            }`}
                            key={day.date}
                          >
                            —
                          </td>
                        );
                      }
                      totals.normal += cell.normal;
                      totals.ot += cell.ot;
                      totals.absent += cell.absent;
                      if (cell.absent > 0) {
                        totals.days += cell.normal + cell.ot > 0 ? 1 : 0;
                        return (
                          <td
                            className="bg-destructive/10 text-center font-medium text-destructive"
                            key={day.date}
                            title={archiveCopy.worksheetAbsent}
                          >
                            {archiveCopy.worksheetAbsentMark}
                          </td>
                        );
                      }
                      totals.days += 1;
                      const hasOt = cell.ot > 0;
                      return (
                        <td
                          className={`text-center tabular-nums ${
                            hasOt
                              ? "bg-warning/10 text-warning"
                              : weekend
                                ? "bg-muted/50"
                                : "bg-success/5"
                          }`}
                          key={day.date}
                          title={`${archiveCopy.worksheetNormal} ${cell.normal} · ${archiveCopy.worksheetOt} ${cell.ot}`}
                        >
                          {cell.normal + cell.ot > 0
                            ? (cell.normal + cell.ot)
                                .toFixed(1)
                                .replace(/\.0$/, "")
                            : "—"}
                        </td>
                      );
                    })}
                    <td className="px-2 text-center tabular-nums">
                      {totals.normal.toFixed(1).replace(/\.0$/, "")}
                    </td>
                    <td className="px-2 text-center tabular-nums">
                      {totals.ot.toFixed(1).replace(/\.0$/, "")}
                    </td>
                    <td className="px-2 text-center tabular-nums">
                      {totals.absent.toFixed(1).replace(/\.0$/, "")}
                    </td>
                    <td className="px-2 text-center tabular-nums">
                      {totals.days}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {archiveCopy.worksheetLegend}
      </p>
    </div>
  );
}
