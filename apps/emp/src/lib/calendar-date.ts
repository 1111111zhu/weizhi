import { enUS, zhCN } from "date-fns/locale";
import type { Locale as DayPickerLocale } from "react-day-picker";

export const CALENDAR_START_MONTH = new Date(1990, 0, 1);
export const CALENDAR_END_MONTH = new Date(2100, 11, 1);

export function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return;
  }

  return dateFromParts(match[1], match[2], match[3]);
}

export function parseDateInput(value: string) {
  const normalized = value.trim();
  const match =
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(normalized) ??
    /^(\d{4})\u5e74(\d{1,2})\u6708(\d{1,2})\u65e5$/.exec(normalized);
  if (!match) {
    return;
  }

  return dateFromParts(match[1], match[2], match[3]);
}

function dateFromParts(yearPart: string, monthPart: string, dayPart: string) {
  const year = Number(yearPart);
  const monthIndex = Number(monthPart) - 1;
  const day = Number(dayPart);
  const date = new Date(year, monthIndex, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return;
  }

  return date;
}

export function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatCalendarDate(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function getCalendarLocale(locale: string): Partial<DayPickerLocale> {
  if (locale === "zh-CN") {
    return zhCN;
  }
  return enUS;
}
