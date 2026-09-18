"use client";

import type { TmsApprovalLock } from "@project-wing/shared";
import {
  MotionButton,
  StatefulMotionButton,
  useCompactViewport,
  MobileActionSheet,
  Button as MobileButton,
  projectWingToast as toast,
} from "@project-wing/ui";
import type { MotionButtonState } from "@project-wing/ui";
import {
  CalendarDays,
  Check,
  Link2,
  Link2Off,
  ListFilter,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import type * as React from "react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Cell, Pie, PieChart } from "recharts";

import { HoursInput } from "@/components/hours-input";
import {
  RESIZE_GRIP_CLASS,
  RESIZE_RAIL_CLASS,
} from "@/components/resize-handle";
import { TmsHeader } from "@/components/tms-header";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { ChartContainer } from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getPeriodLabel,
  getTimesheetDetailsLabel,
  getTimesheetTypeLabel,
  getTimesheetWorkTypeLabel,
  getTmsMonthLabels,
  getTmsWorkspaceCopy,
  tmsWorkspaceCopy,
  translateTimesheetMessage,
} from "@/i18n/dictionaries";
import type { TmsWorkspaceCopy } from "@/i18n/dictionaries";
import type { TmsLocale } from "@/i18n/settings";
import {
  getCmpEngagementDirectory,
  linkTmsProject,
  loadTimesheetMonth,
  saveTimesheetDraft,
  submitTimesheet,
  unlinkTmsProject,
} from "@/lib/api";
import type { User } from "@/lib/api";
import {
  DETAILS_BY_TYPE,
  TIMESHEET_TYPES,
  WORK_TYPES_BY_TYPE,
  addTimesheetRow,
  buildPeriodDays,
  calculateDashboard,
  createInitialRows,
  createPendingTmsEngagement,
  createTimesheetRowId,
  deleteTimesheetRows,
  filterTimesheetRowsByDays,
  findDuplicateChargeableRow,
  findEngagement,
  getTimesheetWorkType,
  isChargeableRow,
  isDemoTimesheetRow,
  isTmsDemoPeriod,
  mergeTimesheetRows,
  migrateTimesheetRows,
  syncRowsWithEngagementDirectory,
  timesheetAccessError as _timesheetAccessError,
  timesheetHourValidationMessage,
  updateTimesheetDescription,
  updateTimesheetHours,
  validateTimesheet,
} from "@/lib/timesheet";
import type {
  ChargeableDetails,
  DailyHoursSummary,
  Engagement,
  LeaveDetails,
  NonChargeableDetails,
  PeriodDay,
  PeriodKey,
  TimesheetDetails,
  TimesheetRow,
  TimesheetType,
  TimesheetWorkType,
  ValidationMessage,
} from "@/lib/timesheet";
import { cn } from "@/lib/utils";

import { TimesheetMobile } from "./timesheet-mobile";

import mobileStyles from "./tms-mobile.module.css";

type TypeFilter = TimesheetType | "All";
export type TimesheetColumnKey =
  | "engagementCode"
  | "clientName"
  | "workType"
  | "details"
  | "description";
export type TimesheetColumnFilters = Partial<
  Record<TimesheetColumnKey, string[]>
>;

const BLANK_COLUMN_VALUE = tmsWorkspaceCopy.filterBlankValue;
const AUTO_SAVE_DELAY_MS = 500;
const SAVE_FEEDBACK_MINIMUM_MS = 400;
const SUBMIT_FAILURE_FEEDBACK_MS = 20_000;

type SubmitFeedbackKind = "success" | "failure";
type SubmitFailureTag = "missing-hours" | "abnormal";

function timesheetColumnValue(
  row: TimesheetRow,
  key: TimesheetColumnKey,
  blankValue: string = BLANK_COLUMN_VALUE
) {
  const value =
    key === "details" || key === "description"
      ? row[key]
      : key === "workType"
        ? getTimesheetWorkType(row)
        : isChargeableRow(row)
          ? key === "engagementCode"
            ? (row.projectCode ?? row.engagementCode)
            : row[key]
          : "";
  return value?.trim() || blankValue;
}

export function timesheetColumnValues(
  rows: TimesheetRow[],
  key: TimesheetColumnKey,
  blankValue: string = BLANK_COLUMN_VALUE
) {
  return [
    ...new Set(rows.map((row) => timesheetColumnValue(row, key, blankValue))),
  ].sort((left, right) => left.localeCompare(right));
}

export function filterTimesheetRowsByColumns(
  rows: TimesheetRow[],
  filters: TimesheetColumnFilters,
  blankValue: string = BLANK_COLUMN_VALUE
) {
  return rows.filter((row) =>
    Object.entries(filters).every(([key, selectedValues]) => {
      if (!selectedValues?.length) {
        return true;
      }
      return selectedValues.includes(
        timesheetColumnValue(row, key as TimesheetColumnKey, blankValue)
      );
    })
  );
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function rankEngagementMatches(
  engagements: Engagement[],
  input: string,
  limit = 8
) {
  const query = input.trim().toLocaleLowerCase("en-US");
  if (!query) {
    return [];
  }

  return engagements
    .map((engagement) => ({
      engagement,
      score: engagementMatchScore(engagement, query),
    }))
    .filter((match) => Number.isFinite(match.score))
    .sort(
      (left, right) =>
        left.score - right.score ||
        (
          left.engagement.projectCode ?? left.engagement.engagementCode
        ).localeCompare(
          right.engagement.projectCode ?? right.engagement.engagementCode
        )
    )
    .slice(0, limit)
    .map((match) => match.engagement);
}

function engagementMatchScore(engagement: Engagement, query: string) {
  const projectCode = engagement.projectCode?.toLocaleLowerCase("en-US") ?? "";
  const projectName = engagement.projectName?.toLocaleLowerCase() ?? "";
  const code = engagement.engagementCode.toLocaleLowerCase("en-US");
  const aliases = engagement.codeAliases.map((alias) =>
    alias.toLocaleLowerCase("en-US")
  );
  const clientCode = engagement.clientCode.toLocaleLowerCase("en-US");
  const clientName = engagement.clientName.toLocaleLowerCase();

  if (projectCode.startsWith(query)) {
    return 0;
  }
  if (code.startsWith(query)) {
    return 1;
  }
  if (aliases.some((alias) => alias.startsWith(query))) {
    return 2;
  }
  if (projectCode.includes(query)) {
    return 3;
  }
  if (projectName.includes(query)) {
    return 4;
  }
  if (code.includes(query)) {
    return 5;
  }
  if (aliases.some((alias) => alias.includes(query))) {
    return 6;
  }
  if (clientCode.startsWith(query)) {
    return 7;
  }
  if (clientName.startsWith(query)) {
    return 8;
  }
  if (clientCode.includes(query)) {
    return 9;
  }
  if (clientName.includes(query)) {
    return 10;
  }
  return Number.POSITIVE_INFINITY;
}

export function shouldKeepAddDialogOpen(
  isSubmitting: boolean,
  nextOpen: boolean
) {
  return isSubmitting && !nextOpen;
}

export function shouldDisableTimesheetHours(
  dateEditable: boolean,
  accessAllowed: boolean
) {
  return !dateEditable || !accessAllowed;
}

export function shouldBlockTimesheetSubmit(
  messages: Pick<ValidationMessage, "severity">[]
) {
  return messages.length > 0;
}

export function shouldConfirmTimesheetSubmit(
  _messages: Pick<ValidationMessage, "severity">[]
) {
  return false;
}

export function getTimesheetProgressSegments(
  completion: { completed: number; open: number },
  copy: Pick<TmsWorkspaceCopy, "completed" | "open">
) {
  return [
    {
      label: copy.completed,
      value: completion.completed,
      color: "var(--success)",
    },
    {
      label: copy.open,
      value: completion.open,
      color: "var(--muted)",
    },
  ];
}

export function timesheetSubmitMessageClass(
  message: string,
  hasErrors: boolean
) {
  if (!message) {
    return "opacity-0";
  }
  return hasErrors || message === "Submit failed"
    ? "text-destructive opacity-100"
    : "text-success opacity-100";
}

const TMS_BOARD_LAYOUT_STORAGE_PREFIX = "project-wing:tms:board-layout:v1";
const TMS_DEMO_DATA_VERSION = "5";
const TMS_FILTERS_STORAGE_PREFIX = "project-wing:tms:filters";
const TMS_ROWS_STORAGE_PREFIX = "project-wing-tms-rows";
const LEGACY_DEMO_ROW_IDS = [
  "100204-Normal",
  "200118-Normal",
  "300672-Absent",
  "400091-OT",
] as const;

export type SavedTimesheetFilters = {
  year: number;
  month: number;
  period: PeriodKey;
  typeFilter: TypeFilter;
};

type FilterStorage = Pick<Storage, "getItem" | "setItem">;

export type TimesheetBoardLayout = {
  firstBoundary: number;
  secondBoundary: number;
};

export const DEFAULT_TIMESHEET_BOARD_LAYOUT: TimesheetBoardLayout = {
  firstBoundary: 0.56,
  secondBoundary: 0.78,
};

export type InitialTimesheetWorkspaceState = {
  filters: SavedTimesheetFilters;
  rows: TimesheetRow[];
};

export function buildTimesheetYearOptions(currentYear: number) {
  return Array.from({ length: 7 }, (_, index) => currentYear - 3 + index);
}

export function timesheetFiltersStorageKey(userId: string) {
  return `${TMS_FILTERS_STORAGE_PREFIX}:${userId}`;
}

export function createDefaultTimesheetFilters(
  now: Date
): SavedTimesheetFilters {
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    period: "first",
    typeFilter: "All",
  };
}

function isSavedTimesheetFilters(
  value: unknown,
  currentYear: number
): value is SavedTimesheetFilters {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Partial<SavedTimesheetFilters>;
  return (
    Number.isInteger(candidate.year) &&
    buildTimesheetYearOptions(currentYear).includes(candidate.year as number) &&
    Number.isInteger(candidate.month) &&
    (candidate.month as number) >= 1 &&
    (candidate.month as number) <= 12 &&
    (candidate.period === "all" ||
      candidate.period === "first" ||
      candidate.period === "second") &&
    (candidate.typeFilter === "All" ||
      TIMESHEET_TYPES.includes(candidate.typeFilter as TimesheetType))
  );
}

export function readSavedTimesheetFilters(
  userId: string,
  now: Date,
  storage?: FilterStorage
): SavedTimesheetFilters {
  const defaults = createDefaultTimesheetFilters(now);
  try {
    const target =
      storage ?? (typeof window === "undefined" ? null : window.localStorage);
    const raw = target?.getItem(timesheetFiltersStorageKey(userId));
    if (!raw) {
      return defaults;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isSavedTimesheetFilters(parsed, defaults.year)) {
      return defaults;
    }
    return {
      ...parsed,
      period: parsed.period === "all" ? "first" : parsed.period,
    };
  } catch {
    return defaults;
  }
}

export function saveTimesheetFilters(
  userId: string,
  filters: SavedTimesheetFilters,
  storage?: FilterStorage
) {
  try {
    const target =
      storage ?? (typeof window === "undefined" ? null : window.localStorage);
    target?.setItem(
      timesheetFiltersStorageKey(userId),
      JSON.stringify(filters)
    );
  } catch {
    // Keep the in-memory filters usable when browser storage is unavailable.
  }
}

export function timesheetBoardLayoutStorageKey(userId: string) {
  return `${TMS_BOARD_LAYOUT_STORAGE_PREFIX}:${userId}`;
}

function isTimesheetBoardLayout(value: unknown): value is TimesheetBoardLayout {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Partial<TimesheetBoardLayout>;
  return (
    Number.isFinite(candidate.firstBoundary) &&
    Number.isFinite(candidate.secondBoundary) &&
    (candidate.firstBoundary as number) >= 0 &&
    (candidate.firstBoundary as number) <=
      (candidate.secondBoundary as number) &&
    (candidate.secondBoundary as number) <= 1
  );
}

export function readTimesheetBoardLayout(
  userId: string,
  storage?: FilterStorage
): TimesheetBoardLayout {
  try {
    const target =
      storage ?? (typeof window === "undefined" ? null : window.localStorage);
    const raw = target?.getItem(timesheetBoardLayoutStorageKey(userId));
    if (!raw) {
      return DEFAULT_TIMESHEET_BOARD_LAYOUT;
    }
    const parsed: unknown = JSON.parse(raw);
    return isTimesheetBoardLayout(parsed)
      ? parsed
      : DEFAULT_TIMESHEET_BOARD_LAYOUT;
  } catch {
    return DEFAULT_TIMESHEET_BOARD_LAYOUT;
  }
}

export function saveTimesheetBoardLayout(
  userId: string,
  layout: TimesheetBoardLayout,
  storage?: FilterStorage
) {
  if (!isTimesheetBoardLayout(layout)) {
    return;
  }
  try {
    const target =
      storage ?? (typeof window === "undefined" ? null : window.localStorage);
    target?.setItem(
      timesheetBoardLayoutStorageKey(userId),
      JSON.stringify(layout)
    );
  } catch {
    // Keep the in-memory layout usable when browser storage is unavailable.
  }
}

export function typeFilterForBoardLayout(
  layout: TimesheetBoardLayout
): TypeFilter {
  const sizes = [
    layout.firstBoundary,
    layout.secondBoundary - layout.firstBoundary,
    1 - layout.secondBoundary,
  ];
  const visible = sizes
    .map((size, index) => (size > 0.0001 ? index : -1))
    .filter((index) => index >= 0);
  const [visibleIndex] = visible;
  return visible.length === 1 && visibleIndex !== undefined
    ? TIMESHEET_TYPES[visibleIndex]
    : "All";
}

export function boardLayoutForTypeFilter(
  typeFilter: TypeFilter
): TimesheetBoardLayout {
  if (typeFilter === "Chargeable") {
    return { firstBoundary: 1, secondBoundary: 1 };
  }
  if (typeFilter === "Non-Chargeable") {
    return { firstBoundary: 0, secondBoundary: 1 };
  }
  if (typeFilter === "Leave") {
    return { firstBoundary: 0, secondBoundary: 0 };
  }
  return DEFAULT_TIMESHEET_BOARD_LAYOUT;
}

export function resizeTimesheetBoardLayout(
  layout: TimesheetBoardLayout,
  boundary: "first" | "second",
  ratio: number
): TimesheetBoardLayout {
  const nextRatio = Math.min(1, Math.max(0, ratio));
  if (boundary === "first") {
    return {
      firstBoundary: nextRatio,
      secondBoundary: Math.max(layout.secondBoundary, nextRatio),
    };
  }
  return {
    firstBoundary: Math.min(layout.firstBoundary, nextRatio),
    secondBoundary: nextRatio,
  };
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);
const DATE_TABLE_WIDTH_CLASS: Record<number, string> = {
  15: "min-w-[978px]",
  16: "min-w-[1024px]",
  28: "min-w-[1576px]",
  29: "min-w-[1622px]",
  30: "min-w-[1668px]",
  31: "min-w-[1714px]",
};

export function rowsStorageKey(year: number, month: number, period: PeriodKey) {
  return `${TMS_ROWS_STORAGE_PREFIX}:${year}:${month}:${period}`;
}

function demoVersionStorageKey(year: number, month: number, period: PeriodKey) {
  return `${TMS_ROWS_STORAGE_PREFIX}:demo-version:${year}:${month}:${period}`;
}

function normalizeStoredDemoRows(
  rows: TimesheetRow[],
  year: number,
  month: number,
  period: PeriodKey
) {
  const scopedRows =
    period === "all"
      ? rows
      : filterTimesheetRowsByDays(rows, buildPeriodDays(year, month, period));
  if (!isTmsDemoPeriod(year, month, period)) {
    return scopedRows.filter((row) => !isDemoTimesheetRow(row));
  }
  if (period !== "all") {
    return scopedRows;
  }

  const firstHalfDays = buildPeriodDays(year, month, "first");
  return scopedRows.flatMap((row) =>
    isDemoTimesheetRow(row)
      ? filterTimesheetRowsByDays([row], firstHalfDays)
      : [row]
  );
}

function readStoredRows(
  year: number,
  month: number,
  period: PeriodKey
): TimesheetRow[] | null {
  try {
    const raw = window.localStorage.getItem(
      rowsStorageKey(year, month, period)
    );
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }
    const rows = migrateTimesheetRows(parsed, period);
    const storedVersion = window.localStorage.getItem(
      demoVersionStorageKey(year, month, period)
    );
    const normalizedRows = normalizeStoredDemoRows(rows, year, month, period);
    if (
      storedVersion === TMS_DEMO_DATA_VERSION &&
      JSON.stringify(rows) === JSON.stringify(parsed)
    ) {
      return normalizedRows;
    }

    const existingIds = new Set(normalizedRows.map((row) => row.id));
    const isCompleteLegacyDemo =
      storedVersion === null &&
      isTmsDemoPeriod(year, month, period) &&
      LEGACY_DEMO_ROW_IDS.every((id) => existingIds.has(id));
    const upgradedRows = isCompleteLegacyDemo
      ? [
          ...normalizedRows,
          ...createInitialRows(year, month, period).filter(
            (row) => !existingIds.has(row.id)
          ),
        ]
      : normalizedRows;
    writeStoredRows(year, month, period, upgradedRows);
    return upgradedRows;
  } catch {
    return null;
  }
}

function writeStoredRows(
  year: number,
  month: number,
  period: PeriodKey,
  rows: TimesheetRow[]
) {
  const normalizedRows = normalizeStoredDemoRows(rows, year, month, period);
  window.localStorage.setItem(
    rowsStorageKey(year, month, period),
    JSON.stringify(normalizedRows)
  );
  window.localStorage.setItem(
    demoVersionStorageKey(year, month, period),
    TMS_DEMO_DATA_VERSION
  );
}

export function rowsForPeriod(
  rows: TimesheetRow[],
  year: number,
  month: number,
  period: PeriodKey
) {
  if (period === "all") {
    return rows;
  }
  return filterTimesheetRowsByDays(
    rows.filter(
      (row) => row.periodScope === period || row.periodScope === "all"
    ),
    buildPeriodDays(year, month, period)
  );
}

export function replaceRowsForPeriod(
  fullMonthRows: TimesheetRow[],
  periodRows: TimesheetRow[],
  days: PeriodDay[],
  period: PeriodKey,
  preserveOutsideWhenDeleted = false
) {
  if (period === "all") {
    return periodRows;
  }

  const periodDates = new Set(days.map((day) => day.date));
  const submittedById = new Map(periodRows.map((row) => [row.id, row]));
  const nextRows: TimesheetRow[] = [];

  for (const storedRow of fullMonthRows) {
    const wasVisible =
      storedRow.periodScope === period || storedRow.periodScope === "all";
    if (!wasVisible) {
      nextRows.push(storedRow);
      continue;
    }

    const submittedRow = submittedById.get(storedRow.id);
    if (!submittedRow) {
      if (!preserveOutsideWhenDeleted) {
        continue;
      }
      const outsideHours = Object.fromEntries(
        Object.entries(storedRow.hoursByDate).filter(
          ([date]) => !periodDates.has(date)
        )
      );
      if (Object.keys(outsideHours).length > 0) {
        nextRows.push({
          ...storedRow,
          hoursByDate: outsideHours,
          periodTotal: Object.values(outsideHours).reduce(
            (total, hours) => total + hours,
            0
          ),
        });
      }
      continue;
    }
    submittedById.delete(storedRow.id);
    const outsideHours = Object.fromEntries(
      Object.entries(storedRow.hoursByDate).filter(
        ([date]) => !periodDates.has(date)
      )
    );
    const hoursByDate = { ...outsideHours, ...submittedRow.hoursByDate };
    nextRows.push({
      ...submittedRow,
      hoursByDate,
      periodTotal: Object.values(hoursByDate).reduce(
        (total, hours) => total + hours,
        0
      ),
    });
  }

  return [...nextRows, ...submittedById.values()];
}

function writeFullMonthRows(year: number, month: number, rows: TimesheetRow[]) {
  writeStoredRows(year, month, "all", rows);
  writeStoredRows(
    year,
    month,
    "first",
    rowsForPeriod(rows, year, month, "first")
  );
  writeStoredRows(
    year,
    month,
    "second",
    rowsForPeriod(rows, year, month, "second")
  );
}

export function readSavedRows(
  year: number,
  month: number,
  period: PeriodKey
): TimesheetRow[] | null {
  const storedRows = readStoredRows(year, month, period);
  if (period !== "all") {
    if (storedRows !== null) {
      return storedRows;
    }
    const fullMonthRows = readStoredRows(year, month, "all");
    return fullMonthRows === null
      ? null
      : rowsForPeriod(fullMonthRows, year, month, period);
  }

  const firstRows = readStoredRows(year, month, "first");
  const secondRows = readStoredRows(year, month, "second");
  if (storedRows === null && firstRows === null && secondRows === null) {
    return null;
  }

  const fullMonthRows = mergeTimesheetRows(
    storedRows ?? [],
    firstRows ??
      (storedRows === null
        ? createInitialRows(year, month, "first")
        : rowsForPeriod(storedRows, year, month, "first")),
    secondRows ??
      (storedRows === null
        ? createInitialRows(year, month, "second")
        : rowsForPeriod(storedRows, year, month, "second"))
  );
  writeFullMonthRows(year, month, fullMonthRows);
  return fullMonthRows;
}

export function createInitialTimesheetWorkspaceState(
  userId: string,
  now: Date,
  storage?: FilterStorage
): InitialTimesheetWorkspaceState {
  const filters = readSavedTimesheetFilters(userId, now, storage);
  return {
    filters,
    rows:
      readSavedRows(filters.year, filters.month, filters.period) ??
      createInitialRows(filters.year, filters.month, filters.period),
  };
}

export function saveRows(
  year: number,
  month: number,
  period: PeriodKey,
  rows: TimesheetRow[]
) {
  if (period === "all") {
    writeFullMonthRows(year, month, rows);
    return;
  }

  const fullMonthRows =
    readStoredRows(year, month, "all") ??
    mergeTimesheetRows(
      readStoredRows(year, month, "first") ?? [],
      readStoredRows(year, month, "second") ?? []
    );
  const canonicalRows = replaceRowsForPeriod(
    fullMonthRows,
    rows,
    buildPeriodDays(year, month, period),
    period
  );
  writeFullMonthRows(year, month, canonicalRows);
}

export function TimesheetWorkspace({
  approvalPending = false,
  locale: localeProp,
  onOpenApprovals,
  onOpenQuery,
  onSignOut,
  renderHeader = true,
  user,
}: {
  approvalPending?: boolean;
  onOpenApprovals?: () => void;
  onOpenQuery?: () => void;
  onSignOut: () => void;
  renderHeader?: boolean;
  user: User;
  locale?: TmsLocale;
}) {
  const locale = localeProp ?? "en-US";
  const phone = useCompactViewport(767.98);
  const copy = getTmsWorkspaceCopy(locale);
  const now = useMemo(() => new Date(), []);
  const [initialWorkspaceState, setInitialWorkspaceState] = useState(() =>
    createInitialTimesheetWorkspaceState(user.id, now)
  );
  const [initialBoardLayout, setInitialBoardLayout] = useState(() =>
    readTimesheetBoardLayout(user.id)
  );
  void setInitialWorkspaceState;
  void setInitialBoardLayout;
  const [year, setYear] = useState(initialWorkspaceState.filters.year);
  const [month, setMonth] = useState(initialWorkspaceState.filters.month);
  const [period, setPeriod] = useState<PeriodKey>(
    initialWorkspaceState.filters.period
  );
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(
    typeFilterForBoardLayout(initialBoardLayout)
  );
  const [boardLayout, setBoardLayout] =
    useState<TimesheetBoardLayout>(initialBoardLayout);
  const boardGridRef = useRef<HTMLElement | null>(null);
  const boardResizeFrameRef = useRef<number | null>(null);
  const boardResizePendingLayoutRef = useRef<TimesheetBoardLayout | null>(null);
  const [rows, setRows] = useState(initialWorkspaceState.rows);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [entryCode, setEntryCode] = useState("");
  const [entryDescription, setEntryDescription] = useState("");
  const [entryType, setEntryType] = useState<TimesheetType | "">("");
  const [entryWorkType, setEntryWorkType] = useState<TimesheetWorkType | "">(
    ""
  );
  const [entryDetails, setEntryDetails] = useState<TimesheetDetails | "">("");
  const [entryError, setEntryError] = useState("");
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [engagementDirectory, setEngagementDirectory] = useState<Engagement[]>(
    []
  );
  const [engagementDirectoryLoading, setEngagementDirectoryLoading] =
    useState(false);
  const [selectedEngagement, setSelectedEngagement] = useState<Engagement>();
  const [linkProjectRowId, setLinkProjectRowId] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitFeedbackKind, setSubmitFeedbackKind] =
    useState<SubmitFeedbackKind | null>(null);
  const [submitButtonState, setSubmitButtonState] =
    useState<MotionButtonState>("idle");
  const [highlightedRowId, setHighlightedRowId] = useState("");
  const [submitWarnings, setSubmitWarnings] = useState<
    ReturnType<typeof validateTimesheet>
  >([]);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [submitConfirmWarnings, setSubmitConfirmWarnings] = useState<
    ReturnType<typeof validateTimesheet>
  >([]);
  const [submitFailureOpen, setSubmitFailureOpen] = useState(false);
  const [submitFailureTags, setSubmitFailureTags] = useState<
    SubmitFailureTag[]
  >([]);
  const [saveState, setSaveState] = useState<
    "Loading" | "Saved" | "Saving" | "Error"
  >("Loading");
  const [isSaveHovered, setIsSaveHovered] = useState(false);
  const [periodStates, setPeriodStates] = useState({
    FIRST_HALF: {
      status: "DRAFT",
      revision: 0,
      editable: true,
      approvalStatus: "NOT_SUBMITTED",
    },
    SECOND_HALF: {
      status: "DRAFT",
      revision: 0,
      editable: true,
      approvalStatus: "NOT_SUBMITTED",
    },
  });
  const [approvalLocks, setApprovalLocks] = useState<TmsApprovalLock[]>([]);
  const returnedCellKeys = useMemo(
    () =>
      new Set(
        approvalLocks
          .filter((lock) => lock.status === "RETURNED")
          .flatMap((lock) =>
            lock.returnedCells.map(
              (cell) => `${lock.engagementId}:${cell.rowId}:${cell.date}`
            )
          )
      ),
    [approvalLocks]
  );
  const approvedCellKeys = useMemo(
    () =>
      new Set(
        approvalLocks
          .filter((lock) => lock.status === "APPROVED")
          .flatMap((lock) =>
            lock.lockedCells.map(
              (cell) => `${lock.engagementId}:${cell.rowId}:${cell.date}`
            )
          )
      ),
    [approvalLocks]
  );
  const modifiedApprovalCellKeys = useMemo(
    () =>
      new Set(
        approvalLocks
          .filter((lock) => lock.status === "APPROVED")
          .flatMap((lock) =>
            (lock.modifiedCells ?? []).map(
              (cell) => `${lock.engagementId}:${cell.rowId}:${cell.date}`
            )
          )
      ),
    [approvalLocks]
  );
  const returnReason = useMemo(
    () =>
      approvalLocks.find(
        (lock) => lock.status === "RETURNED" && lock.returnReason
      )?.returnReason ?? null,
    [approvalLocks]
  );
  const hasReturnedTimesheet =
    periodStates.FIRST_HALF.approvalStatus === "RETURNED" ||
    periodStates.SECOND_HALF.approvalStatus === "RETURNED" ||
    approvalLocks.some((lock) => lock.status === "RETURNED");
  const fullMonthRowsRef = useRef<TimesheetRow[]>([]);
  const restoringRowsRef = useRef(true);
  const skipNextAutoSaveRef = useRef(false);
  const autoSaveTimeoutRef = useRef<number | null>(null);
  const saveRequestRef = useRef(0);
  const cmpDirectoryRequestRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(false);
  const isAddingEntryRef = useRef(false);
  const isAddDialogOpenRef = useRef(false);
  const addSubmissionRef = useRef(0);
  const days = useMemo(
    () => buildPeriodDays(year, month, period),
    [year, month, period]
  );
  const yearOptions = useMemo(
    () => buildTimesheetYearOptions(now.getFullYear()),
    [now]
  );
  const dashboard = useMemo(() => calculateDashboard(rows, days), [days, rows]);
  const validationMessages = useMemo(
    () => validateTimesheet(rows, days),
    [days, rows]
  );
  const validationDateSet = useMemo(
    () => new Set(validationMessages.map((message) => message.date)),
    [validationMessages]
  );
  const validationDays = useMemo(
    () =>
      dashboard.dailyHours
        .filter((day) => validationDateSet.has(day.date))
        .map((day) => ({ ...day, hours: day.explainedTotal })),
    [dashboard.dailyHours, validationDateSet]
  );
  const abnormalDays = useMemo(
    () =>
      validationDays.filter(
        (day) =>
          day.regularTotal > 8 ||
          day.total > 24 ||
          (day.isWorkday && !day.isHoliday && day.total > 12)
      ),
    [validationDays]
  );
  const hasAbnormalDays = abnormalDays.length > 0;
  const matchedEngagement = selectedEngagement;
  const saveButtonState: MotionButtonState =
    saveState === "Loading" || saveState === "Saving"
      ? "loading"
      : saveState === "Error"
        ? "error"
        : "success";
  const refreshCmpDirectory = useCallback(
    async (query: string) => {
      cmpDirectoryRequestRef.current?.abort();
      const request = new AbortController();
      cmpDirectoryRequestRef.current = request;

      try {
        setEngagementDirectoryLoading(true);
        const latestDirectory = await getCmpEngagementDirectory(
          query,
          request.signal
        );
        if (
          request.signal.aborted ||
          cmpDirectoryRequestRef.current !== request ||
          !isMountedRef.current
        ) {
          throw new DOMException(
            "CMP directory refresh superseded",
            "AbortError"
          );
        }
        setEngagementDirectory(latestDirectory);
        setRows((currentRows) =>
          syncRowsWithEngagementDirectory(currentRows, latestDirectory)
        );
        return latestDirectory;
      } catch (error) {
        if (
          !request.signal.aborted &&
          cmpDirectoryRequestRef.current === request &&
          isMountedRef.current
        ) {
          setEngagementDirectory([]);
          toast.error(copy.unableLoadTimesheet);
        }
        throw error;
      } finally {
        if (cmpDirectoryRequestRef.current === request) {
          cmpDirectoryRequestRef.current = null;
        }
        if (isMountedRef.current) {
          setEngagementDirectoryLoading(false);
        }
      }
    },
    [copy.unableLoadTimesheet]
  );
  const persistTimesheetRows = useCallback(async () => {
    saveRequestRef.current += 1;
    const requestId = saveRequestRef.current;
    setSaveState("Saving");
    const canonicalRows =
      period === "all"
        ? rows
        : replaceRowsForPeriod(
            fullMonthRowsRef.current,
            rows,
            buildPeriodDays(year, month, period),
            period,
            true
          );
    try {
      const [saved] = await Promise.all([
        saveTimesheetDraft(year, month, { rows: canonicalRows }),
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, SAVE_FEEDBACK_MINIMUM_MS);
        }),
      ]);
      if (requestId !== saveRequestRef.current) {
        return;
      }
      const normalizedRows = migrateTimesheetRows(saved.rows, "all");
      fullMonthRowsRef.current = normalizedRows;
      if (JSON.stringify(normalizedRows) !== JSON.stringify(canonicalRows)) {
        skipNextAutoSaveRef.current = true;
        setRows(rowsForPeriod(normalizedRows, year, month, period));
      }
      setPeriodStates(saved.periods);
      setApprovalLocks(saved.approvalLocks ?? []);
      setSaveState("Saved");
    } catch {
      if (requestId !== saveRequestRef.current) {
        return;
      }
      setSaveState("Error");
      setSubmitMessage("");
      toast.error(copy.unableSaveTimesheet);
    }
  }, [copy.unableSaveTimesheet, month, period, rows, year]);

  useEffect(() => {
    restoringRowsRef.current = true;
    const legacyRows = readSavedRows(year, month, "all");
    let cancelled = false;
    setSaveState("Loading");
    void loadTimesheetMonth(year, month)
      .then(async (serverMonth) => {
        const restored =
          serverMonth.rows.length === 0 && legacyRows?.length
            ? await saveTimesheetDraft(year, month, { rows: legacyRows })
            : serverMonth;
        if (cancelled) {
          return;
        }
        fullMonthRowsRef.current = migrateTimesheetRows(restored.rows, "all");
        setPeriodStates(restored.periods);
        setApprovalLocks(restored.approvalLocks ?? []);
        skipNextAutoSaveRef.current = true;
        setRows(rowsForPeriod(fullMonthRowsRef.current, year, month, period));
        setSaveState("Saved");
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        skipNextAutoSaveRef.current = true;
        setRows(
          legacyRows
            ? rowsForPeriod(legacyRows, year, month, period)
            : createInitialRows(year, month, period)
        );
        setSaveState("Error");
        setSubmitMessage("");
        toast.error(copy.unableLoadTimesheet);
      })
      .finally(() => {
        if (!cancelled) {
          restoringRowsRef.current = false;
        }
      });
    setDeleteMode(false);
    setSelectedIds(new Set());
    setSubmitMessage("");
    setSubmitWarnings([]);
    return () => {
      cancelled = true;
    };
  }, [copy.unableLoadTimesheet, year, month, period]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      isAddDialogOpenRef.current = false;
      addSubmissionRef.current += 1;
      cmpDirectoryRequestRef.current?.abort();
      cmpDirectoryRequestRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!addOpen || entryType !== "Chargeable" || selectedEngagement) {
      return;
    }
    const query = entryCode.trim();
    if (!query) {
      setEngagementDirectory([]);
      setEngagementDirectoryLoading(false);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void refreshCmpDirectory(query).catch(() => {});
    }, 180);
    return () => window.clearTimeout(timeoutId);
  }, [addOpen, entryCode, entryType, refreshCmpDirectory, selectedEngagement]);

  useEffect(() => {
    if (restoringRowsRef.current) {
      return;
    }
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return;
    }
    saveRequestRef.current += 1;
    const timeoutId = window.setTimeout(() => {
      autoSaveTimeoutRef.current = null;
      void persistTimesheetRows();
    }, AUTO_SAVE_DELAY_MS);
    autoSaveTimeoutRef.current = timeoutId;
    return () => {
      window.clearTimeout(timeoutId);
      if (autoSaveTimeoutRef.current === timeoutId) {
        autoSaveTimeoutRef.current = null;
      }
    };
  }, [persistTimesheetRows]);

  useEffect(() => {
    saveTimesheetFilters(user.id, { year, month, period, typeFilter });
  }, [month, period, typeFilter, user.id, year]);

  useEffect(() => {
    saveTimesheetBoardLayout(user.id, boardLayout);
  }, [boardLayout, user.id]);

  useEffect(() => {
    if (phone) {
      return;
    }
    const grid = boardGridRef.current;
    if (!grid) {
      return;
    }
    grid.style.gridTemplateRows = `minmax(0, ${boardLayout.firstBoundary}fr) 8px minmax(0, ${
      boardLayout.secondBoundary - boardLayout.firstBoundary
    }fr) 8px minmax(0, ${1 - boardLayout.secondBoundary}fr)`;
  }, [boardLayout, phone]);

  useEffect(() => {
    if (!submitMessage) {
      return;
    }
    const timeoutId = window.setTimeout(
      () => {
        setSubmitMessage("");
        setSubmitFeedbackKind(null);
        setSubmitButtonState("idle");
        setSubmitWarnings([]);
        setSubmitFailureTags([]);
      },
      submitFeedbackKind === "failure" ? SUBMIT_FAILURE_FEEDBACK_MS : 2400
    );

    return () => window.clearTimeout(timeoutId);
  }, [submitFeedbackKind, submitMessage]);

  useEffect(() => {
    if (!highlightedRowId) {
      return;
    }
    const highlightedRow = [
      ...document.querySelectorAll<HTMLElement>("[data-timesheet-row-id]"),
    ].find((element) => element.dataset.timesheetRowId === highlightedRowId);
    highlightedRow?.scrollIntoView?.({
      behavior: "smooth",
      block: "nearest",
    });
    const timeoutId = window.setTimeout(() => {
      setHighlightedRowId("");
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [highlightedRowId]);

  useEffect(() => {
    if (!entryError) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setEntryError("");
    }, 2400);

    return () => window.clearTimeout(timeoutId);
  }, [entryError]);

  useEffect(() => {
    if (!deleteMode) {
      return;
    }

    const closeDeleteModeOnBlankClick = (event: PointerEvent) => {
      const { target } = event;
      if (!(target instanceof Element)) {
        return;
      }
      if (
        target.closest(
          "button,input,textarea,select,a,label,td,th,[role='separator'],[role='scrollbar'],[aria-label$=' horizontal scroll'],[data-tms-delete-control]"
        )
      ) {
        return;
      }

      setDeleteMode(false);
      setSelectedIds(new Set());
    };

    document.addEventListener("pointerdown", closeDeleteModeOnBlankClick, true);
    return () =>
      document.removeEventListener(
        "pointerdown",
        closeDeleteModeOnBlankClick,
        true
      );
  }, [deleteMode]);

  async function handleAddEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isAddingEntryRef.current) {
      return;
    }
    setEntryError("");

    if (!entryType) {
      setEntryError(copy.chooseTimesheetType);
      return;
    }
    if (!entryWorkType) {
      setEntryError(copy.chooseTypeForCategory);
      return;
    }
    if (entryType !== "Chargeable" && !entryDetails) {
      setEntryError(copy.chooseDetailsForType);
      return;
    }

    if (entryType === "Non-Chargeable") {
      if (
        !WORK_TYPES_BY_TYPE["Non-Chargeable"].includes(
          entryWorkType as "Normal" | "OT"
        )
      ) {
        setEntryError(copy.chooseValidNonChargeableType);
        return;
      }
      if (
        !DETAILS_BY_TYPE["Non-Chargeable"].includes(
          entryDetails as NonChargeableDetails
        )
      ) {
        setEntryError(copy.chooseValidNonChargeableDetails);
        return;
      }
      setRows((currentRows) =>
        addTimesheetRow(currentRows, {
          id: createTimesheetRowId(),
          periodScope: period,
          type: "Non-Chargeable",
          workType: entryWorkType,
          details: entryDetails as NonChargeableDetails,
          description: entryDescription.trim(),
        })
      );
      closeAddDialog();
      return;
    }

    if (entryType === "Leave") {
      if (entryWorkType !== "Normal") {
        setEntryError(copy.leaveOnlyNormalType);
        return;
      }
      if (!DETAILS_BY_TYPE.Leave.includes(entryDetails as LeaveDetails)) {
        setEntryError(copy.chooseValidLeaveDetails);
        return;
      }
      setRows((currentRows) =>
        addTimesheetRow(currentRows, {
          id: createTimesheetRowId(),
          periodScope: period,
          type: "Leave",
          workType: "Normal",
          details: entryDetails as LeaveDetails,
          description: entryDescription.trim(),
        })
      );
      closeAddDialog();
      return;
    }

    const pendingEngagement =
      !matchedEngagement && !entryCode.trim()
        ? createPendingTmsEngagement()
        : undefined;
    if (!matchedEngagement && !pendingEngagement) {
      setEntryError(copy.chooseEngagement);
      return;
    }
    if (
      !WORK_TYPES_BY_TYPE.Chargeable.includes(entryWorkType as "Normal" | "OT")
    ) {
      setEntryError(copy.chooseValidChargeableType);
      return;
    }
    if (matchedEngagement && !matchedEngagement.timesheetAccess.allowed) {
      setEntryError(
        copy.timesheetAccessDenied.replace(
          "{reason}",
          matchedEngagement.timesheetAccess.reason
        )
      );
      return;
    }

    isAddingEntryRef.current = true;
    addSubmissionRef.current += 1;
    const submissionId = addSubmissionRef.current;
    setIsAddingEntry(true);
    try {
      if (pendingEngagement) {
        const newEntry = {
          id: createTimesheetRowId(),
          periodScope: period,
          type: "Chargeable" as const,
          workType: entryWorkType,
          details: entryWorkType as ChargeableDetails,
          description: entryDescription.trim() || "Dummy",
          engagement: pendingEngagement,
        };
        setRows((currentRows) => addTimesheetRow(currentRows, newEntry));
        closeAddDialog();
        return;
      }
      if (!matchedEngagement) {
        return;
      }
      const latestDirectory = await refreshCmpDirectory(entryCode);
      const latestEngagement =
        latestDirectory.find(
          (engagement) =>
            Boolean(matchedEngagement.projectId) &&
            engagement.projectId === matchedEngagement.projectId
        ) ?? findEngagement(matchedEngagement.engagementCode, latestDirectory);
      if (!latestEngagement) {
        setEntryError(copy.noActiveCmpEngagement);
        return;
      }
      if (!latestEngagement.timesheetAccess.allowed) {
        setEntryError(
          copy.timesheetAccessDenied.replace(
            "{reason}",
            latestEngagement.timesheetAccess.reason
          )
        );
        return;
      }
      if (
        submissionId !== addSubmissionRef.current ||
        !isMountedRef.current ||
        !isAddDialogOpenRef.current ||
        !isAddingEntryRef.current
      ) {
        return;
      }

      const rowEngagement =
        latestEngagement.source === "UNLINKED_PROJECT"
          ? { ...latestEngagement, engagementId: "" }
          : latestEngagement;
      const newEntry = {
        id: createTimesheetRowId(),
        periodScope: period,
        type: "Chargeable" as const,
        workType: entryWorkType,
        details: entryWorkType as ChargeableDetails,
        description: entryDescription.trim(),
        engagement: rowEngagement,
      };
      const duplicate = findDuplicateChargeableRow(rows, newEntry);
      if (duplicate) {
        setEntryError(
          copy.duplicateChargeableRow.replace(
            "{details}",
            getTimesheetDetailsLabel(newEntry.details, locale)
          )
        );
        setHighlightedRowId(duplicate.id);
        return;
      }

      setRows((currentRows) => addTimesheetRow(currentRows, newEntry));
      closeAddDialog();
    } catch (error) {
      if (!isAbortError(error) && isMountedRef.current) {
        toast.error(copy.liveCmpValidationFailed);
      }
    } finally {
      isAddingEntryRef.current = false;
      if (isMountedRef.current) {
        setIsAddingEntry(false);
      }
    }
  }

  function showSubmitFailure(
    messages: ReturnType<typeof validateTimesheet>,
    message: string,
    tags: SubmitFailureTag[]
  ) {
    setSubmitWarnings(messages);
    setSubmitFailureTags(tags);
    setSubmitMessage(message);
    setSubmitFeedbackKind("failure");
    setSubmitFailureOpen(true);
    setSubmitButtonState("error");
  }

  async function submitTimesheetData() {
    setSubmitButtonState("loading");
    try {
      const canonicalRows =
        period === "all"
          ? rows
          : replaceRowsForPeriod(
              fullMonthRowsRef.current,
              rows,
              buildPeriodDays(year, month, period),
              period,
              true
            );
      const saved = await saveTimesheetDraft(year, month, {
        rows: canonicalRows,
      });
      const submitted = await submitTimesheet(year, month, {
        scope:
          period === "all"
            ? "ALL"
            : period === "first"
              ? "FIRST_HALF"
              : "SECOND_HALF",
      });
      fullMonthRowsRef.current = submitted.rows as TimesheetRow[];
      setPeriodStates(submitted.periods);
      setApprovalLocks(submitted.approvalLocks ?? []);
      setSaveState("Saved");
      setSubmitWarnings([]);
      setSubmitFailureTags([]);
      setSubmitFeedbackKind("success");
      setSubmitFailureOpen(false);
      setSubmitMessage(
        saved.persistence === "SERVER"
          ? copy.submittedSuccessful
          : copy.demoSubmitted
      );
      setSubmitButtonState("success");
    } catch (error) {
      setSaveState("Error");
      showSubmitFailure(
        [],
        error instanceof Error ? error.message : copy.unableSubmitTimesheet,
        []
      );
    }
  }

  async function handleUnlinkProjectRow(rowId: string) {
    try {
      const link = await unlinkTmsProject(rowId);
      const clearLink = (row: TimesheetRow) =>
        row.id !== rowId || row.type !== "Chargeable"
          ? row
          : {
              ...row,
              projectId: null,
              projectCode: null,
              projectName: null,
              source: "TMS_PENDING" as const,
              engagementId: "",
              engagementCode: link.tmsCode,
              clientCode: "",
              clientName: "",
              pic: null,
              mic: null,
            };
      setRows((currentRows) => currentRows.map(clearLink));
      fullMonthRowsRef.current = fullMonthRowsRef.current.map(clearLink);
    } catch {
      toast.error(copy.unableSaveTimesheet);
    }
  }

  async function handleLinkProjectRow(projectId: string) {
    if (!linkProjectRowId) {
      return;
    }
    try {
      await linkTmsProject(linkProjectRowId, projectId);
      const refreshed = await loadTimesheetMonth(year, month);
      const normalizedRows = migrateTimesheetRows(refreshed.rows, "all");
      fullMonthRowsRef.current = normalizedRows;
      setRows(rowsForPeriod(normalizedRows, year, month, period));
      setPeriodStates(refreshed.periods);
      setApprovalLocks(refreshed.approvalLocks ?? []);
      setLinkProjectRowId(null);
    } catch {
      toast.error(copy.linkProjectError);
    }
  }

  async function handleSubmitTimesheet() {
    const messages = validateTimesheet(rows, days);
    if (shouldBlockTimesheetSubmit(messages)) {
      showSubmitFailure(messages, copy.fixBeforeSubmit, [
        ...(dashboard.completion.open > 0 ? ["missing-hours" as const] : []),
        ...(hasAbnormalDays ? ["abnormal" as const] : []),
      ]);
      return;
    }
    if (shouldConfirmTimesheetSubmit(messages)) {
      setSubmitConfirmWarnings(
        messages.filter((message) => message.severity === "warning")
      );
      setSubmitConfirmOpen(true);
      return;
    }
    await submitTimesheetData();
  }

  async function confirmSubmitTimesheet() {
    const messages = validateTimesheet(rows, days);
    setSubmitConfirmOpen(false);
    setSubmitConfirmWarnings([]);
    if (shouldBlockTimesheetSubmit(messages)) {
      showSubmitFailure(messages, copy.fixBeforeSubmit, [
        ...(dashboard.completion.open > 0 ? ["missing-hours" as const] : []),
        ...(hasAbnormalDays ? ["abnormal" as const] : []),
      ]);
      return;
    }
    await submitTimesheetData();
  }

  function openAddEntryDialog() {
    setEntryCode("");
    setEntryDescription("");
    setSelectedEngagement(undefined);
    setEntryWorkType("");
    setEntryDetails("");
    setEntryError("");
    setEntryType("");
    isAddDialogOpenRef.current = true;
    setAddOpen(true);
  }

  function closeAddDialog() {
    isAddDialogOpenRef.current = false;
    setAddOpen(false);
    setEntryCode("");
    setEntryDescription("");
    setEntryWorkType("");
    setEntryDetails("");
    setEntryType("");
    setSelectedEngagement(undefined);
  }

  function handleAddDialogOpenChange(nextOpen: boolean) {
    if (shouldKeepAddDialogOpen(isAddingEntryRef.current, nextOpen)) {
      return;
    }
    if (!nextOpen) {
      addSubmissionRef.current += 1;
      cmpDirectoryRequestRef.current?.abort();
    }
    isAddDialogOpenRef.current = nextOpen;
    setAddOpen(nextOpen);
  }

  function toggleSelected(rowId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }

  function deleteSelected() {
    setRows((currentRows) => deleteTimesheetRows(currentRows, selectedIds));
    setSelectedIds(new Set());
    setDeleteMode(false);
  }

  function handleHourChange(rowId: string, day: PeriodDay, value: string) {
    const row = rows.find((item) => item.id === rowId);
    if (
      !row ||
      !isApprovalHourEditable(row, day.date) ||
      (isChargeableRow(row) &&
        !isDemoTimesheetRow(row) &&
        row.timesheetAccess?.allowed !== true)
    ) {
      return;
    }

    const hours = value === "" ? 0 : Number(value);
    if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
      return;
    }
    const validationMessage = timesheetHourValidationMessage(
      row,
      day.date,
      hours
    );
    if (validationMessage) {
      setSubmitWarnings([
        { date: day.date, severity: "error", message: validationMessage },
      ]);
      setSubmitMessage(validationMessage);
      return;
    }

    setRows((currentRows) =>
      updateTimesheetHours(currentRows, rowId, day.date, hours)
    );
  }

  function handleDescriptionChange(rowId: string, description: string) {
    if (
      !periodStates.FIRST_HALF.editable ||
      !periodStates.SECOND_HALF.editable
    ) {
      return;
    }
    setRows((currentRows) =>
      updateTimesheetDescription(currentRows, rowId, description)
    );
  }

  function isDateEditable(date: string) {
    return Number(date.slice(-2)) <= 15
      ? periodStates.FIRST_HALF.editable
      : periodStates.SECOND_HALF.editable;
  }

  function isApprovalHourEditable(row: TimesheetRow, date: string) {
    if (!isChargeableRow(row)) {
      return isDateEditable(date);
    }
    const half = Number(date.slice(-2)) <= 15 ? "FIRST_HALF" : "SECOND_HALF";
    const lock = approvalLocks.find(
      (candidate) =>
        candidate.engagementId === row.engagementId &&
        (!candidate.projectId || candidate.projectId === row.projectId) &&
        candidate.half === half
    );
    if (lock) {
      if (lock.lockAll) {
        return false;
      }
      if (lock.status === "APPROVED" || lock.status === "SUBMITTED") {
        return !lock.lockedCells.some(
          (cell) => cell.rowId === row.id && cell.date === date
        );
      }
    }
    const { approvalStatus } = periodStates[half];
    if (approvalStatus === "PENDING_CONFIRMATION") {
      return false;
    }
    if (approvalStatus === "APPROVED") {
      return (row.hoursByDate[date] ?? 0) === 0;
    }
    return isDateEditable(date);
  }

  function isReturnedHour(row: TimesheetRow, date: string) {
    if (!isChargeableRow(row)) {
      return false;
    }
    return returnedCellKeys.has(`${row.engagementId}:${row.id}:${date}`);
  }

  function getApprovalCellState(row: TimesheetRow, date: string) {
    if (!isChargeableRow(row)) {
      return null;
    }
    const key = `${row.engagementId}:${row.id}:${date}`;
    if (modifiedApprovalCellKeys.has(key)) {
      return "modified" as const;
    }
    return approvedCellKeys.has(key) ? ("approved" as const) : null;
  }

  function applyBoardLayoutStyle(layout: TimesheetBoardLayout) {
    const grid = boardGridRef.current;
    if (!grid) {
      return;
    }
    grid.style.gridTemplateRows = `minmax(0, ${layout.firstBoundary}fr) 8px minmax(0, ${
      layout.secondBoundary - layout.firstBoundary
    }fr) 8px minmax(0, ${1 - layout.secondBoundary}fr)`;
  }

  function scheduleBoardLayoutPaint(layout: TimesheetBoardLayout) {
    boardResizePendingLayoutRef.current = layout;
    if (boardResizeFrameRef.current !== null) {
      return;
    }
    boardResizeFrameRef.current = window.requestAnimationFrame(() => {
      boardResizeFrameRef.current = null;
      const pending = boardResizePendingLayoutRef.current;
      boardResizePendingLayoutRef.current = null;
      if (pending) {
        applyBoardLayoutStyle(pending);
      }
    });
  }

  function flushBoardLayoutPaint() {
    if (boardResizeFrameRef.current !== null) {
      window.cancelAnimationFrame(boardResizeFrameRef.current);
      boardResizeFrameRef.current = null;
    }
    const pending = boardResizePendingLayoutRef.current;
    boardResizePendingLayoutRef.current = null;
    if (pending) {
      applyBoardLayoutStyle(pending);
    }
  }

  function handleBoardResizePointerDown(
    boundary: "first" | "second",
    event: React.PointerEvent<HTMLElement>
  ) {
    const grid = boardGridRef.current;
    if (!grid) {
      return;
    }

    event.preventDefault();
    const rect = grid.getBoundingClientRect();
    const startingLayout = boardLayout;
    let currentLayout = startingLayout;

    const updateBoundary = (clientY: number) => {
      const ratio =
        rect.height > 0
          ? Math.min(1, Math.max(0, (clientY - rect.top) / rect.height))
          : 0;
      const nextLayout = resizeTimesheetBoardLayout(
        currentLayout,
        boundary,
        ratio
      );

      currentLayout = nextLayout;
      scheduleBoardLayoutPaint(nextLayout);
    };
    const removeListeners = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      window.removeEventListener("blur", handleWindowBlur);
    };
    const handlePointerMove = (pointerEvent: PointerEvent) => {
      updateBoundary(pointerEvent.clientY);
    };
    const handlePointerUp = (pointerEvent: PointerEvent) => {
      updateBoundary(pointerEvent.clientY);
      const finalLayout = currentLayout;
      flushBoardLayoutPaint();
      setBoardLayout(finalLayout);
      setTypeFilter(typeFilterForBoardLayout(finalLayout));
      removeListeners();
    };
    const handlePointerCancel = () => {
      flushBoardLayoutPaint();
      applyBoardLayoutStyle(startingLayout);
      setBoardLayout(startingLayout);
      removeListeners();
    };
    const handleWindowBlur = () => {
      handlePointerCancel();
    };

    updateBoundary(event.clientY);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    window.addEventListener("blur", handleWindowBlur);
  }

  const handleDeleteAction = () => {
    if (!deleteMode) {
      setDeleteMode(true);
      setSelectedIds(new Set());
      return;
    }
    if (selectedIds.size > 0) {
      deleteSelected();
      return;
    }
    setDeleteMode(false);
    setSelectedIds(new Set());
  };
  const handleManualSave = () => {
    if (autoSaveTimeoutRef.current !== null) {
      window.clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    void persistTimesheetRows();
  };

  return (
    <main
      className={cn(
        "overflow-hidden bg-background text-foreground",
        renderHeader ? "h-dvh" : "h-[calc(100dvh-3.5rem)]"
      )}
    >
      {renderHeader ? (
        <TmsHeader
          approvalPending={approvalPending}
          locale={localeProp}
          timesheetActive
          user={user}
          onOpenApprovals={onOpenApprovals}
          onOpenQuery={onOpenQuery}
          onSignOut={onSignOut}
        />
      ) : null}

      <div
        data-testid="timesheet-workspace-shell"
        className={cn(
          "grid min-h-0 w-full max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-2 overflow-hidden px-4 py-2",
          phone && mobileStyles.root,
          renderHeader ? "h-[calc(100dvh-3.5rem)]" : "h-full"
        )}
      >
        {phone ? (
          <TimesheetMobile
            locale={locale}
            rows={rows}
            days={days}
            year={year}
            month={month}
            period={period}
            yearOptions={yearOptions}
            onYearChange={setYear}
            onMonthChange={setMonth}
            onPeriodChange={setPeriod}
            typeFilter={typeFilter}
            onTypeFilterChange={(type) => {
              setTypeFilter(type);
              setBoardLayout(boardLayoutForTypeFilter(type));
              setDeleteMode(false);
              setSelectedIds(new Set());
            }}
            deleteMode={deleteMode}
            selectedIds={selectedIds}
            highlightedRowId={highlightedRowId}
            onToggleSelected={toggleSelected}
            onHourChange={handleHourChange}
            onDescriptionChange={handleDescriptionChange}
            descriptionEditable={
              periodStates.FIRST_HALF.editable &&
              periodStates.SECOND_HALF.editable
            }
            isHourEditable={isApprovalHourEditable}
            canEditDate={isDateEditable}
            getApprovalCellState={getApprovalCellState}
            isReturnedHour={isReturnedHour}
            onUnlinkRow={handleUnlinkProjectRow}
            onLinkRow={setLinkProjectRowId}
            onAdd={openAddEntryDialog}
            onDelete={handleDeleteAction}
            onCancelDelete={() => {
              setDeleteMode(false);
              setSelectedIds(new Set());
            }}
            onSubmit={() => void handleSubmitTimesheet()}
            onSave={handleManualSave}
            saveState={saveButtonState}
            submitState={submitButtonState}
            loading={saveState === "Loading"}
            feedback={returnReason || submitMessage}
            feedbackError={
              Boolean(returnReason) ||
              submitFeedbackKind === "failure" ||
              submitWarnings.some((message) => message.severity === "error")
            }
            dashboard={dashboard.dailyHours}
            progress={dashboard.completion}
            validation={validationMessages}
          />
        ) : (
          <>
            <div className="grid gap-2">
              <section className="relative flex min-h-8 flex-wrap items-center justify-between gap-2 xl:flex-nowrap">
                <div className="flex shrink-0 items-center gap-2">
                  <h1 className="text-xl leading-7 font-semibold whitespace-nowrap">
                    {copy.timesheetTitle}
                  </h1>
                  <StatefulMotionButton
                    aria-label={
                      saveButtonState === "loading"
                        ? copy.saving
                        : saveButtonState === "error"
                          ? copy.retrySave
                          : isSaveHovered
                            ? copy.save
                            : copy.saved
                    }
                    data-action-id="save-timesheet"
                    data-testid="timesheet-save-state"
                    size="sm"
                    variant="ghost"
                    className="h-7 shrink-0 cursor-pointer px-2 text-xs! [&_.lucide-x]:text-destructive [&_svg]:size-3.5"
                    state={saveButtonState}
                    loadingText={copy.saving}
                    successIcon={
                      isSaveHovered ? (
                        <Check className="text-success" />
                      ) : undefined
                    }
                    successText={isSaveHovered ? copy.save : copy.saved}
                    errorText={copy.retrySave}
                    onBlur={() => setIsSaveHovered(false)}
                    onFocus={() => setIsSaveHovered(true)}
                    onMouseEnter={() => setIsSaveHovered(true)}
                    onMouseLeave={() => setIsSaveHovered(false)}
                    onClick={handleManualSave}
                  >
                    {copy.save}
                  </StatefulMotionButton>
                </div>
                {!matchedEngagement && !entryCode.trim() ? (
                  <p className="order-4 w-full text-xs text-muted-foreground xl:order-none xl:w-auto">
                    {copy.pendingLinkHint}
                  </p>
                ) : null}
                <div
                  data-testid="timesheet-filter-controls"
                  className="order-3 flex w-full flex-wrap items-center gap-1.5 xl:absolute xl:top-1/2 xl:left-1/2 xl:order-none xl:w-auto xl:-translate-x-1/2 xl:-translate-y-1/2"
                >
                  <ButtonGroup
                    label={copy.timesheetPeriodFilters}
                    data-testid="timesheet-period-filter-group"
                    className="shrink-0 gap-0 [&>[data-slot=select-trigger]]:rounded-none [&>[data-slot=select-trigger]]:border-l-0 [&>[data-slot=select-trigger]:first-of-type]:rounded-l-lg [&>[data-slot=select-trigger]:first-of-type]:border-l [&>[data-slot=select-trigger]:last-of-type]:rounded-r-lg"
                  >
                    <GroupedFilterSelect
                      label={copy.year}
                      value={String(year)}
                      onValueChange={(value) => value && setYear(Number(value))}
                      icon={<CalendarDays aria-hidden="true" />}
                      options={yearOptions.map((item) => ({
                        value: String(item),
                        label: String(item),
                      }))}
                    />
                    <GroupedFilterSelect
                      label={copy.month}
                      value={String(month)}
                      onValueChange={(value) =>
                        value && setMonth(Number(value))
                      }
                      options={MONTH_OPTIONS.map((item) => ({
                        value: String(item),
                        label: getTmsMonthLabels(locale)[item - 1] ?? "",
                      }))}
                    />
                    <GroupedFilterSelect
                      label={copy.period}
                      value={period}
                      onValueChange={(value) =>
                        value && setPeriod(value as PeriodKey)
                      }
                      options={(["first", "second"] as const).map((item) => ({
                        value: item,
                        label: getPeriodLabel(item, locale),
                      }))}
                    />
                  </ButtonGroup>
                  <ButtonGroup
                    label={copy.timesheetTypeFilter}
                    data-testid="timesheet-type-filter-group"
                    className="shrink-0 gap-0"
                  >
                    <GroupedFilterSelect
                      label={copy.type}
                      value={typeFilter}
                      icon={<ListFilter aria-hidden="true" />}
                      onValueChange={(value) => {
                        if (!value) {
                          return;
                        }
                        const nextFilter = value as TypeFilter;
                        setTypeFilter(nextFilter);
                        setBoardLayout(boardLayoutForTypeFilter(nextFilter));
                        setDeleteMode(false);
                        setSelectedIds(new Set());
                      }}
                      options={[
                        { value: "All", label: copy.all },
                        ...TIMESHEET_TYPES.map((item) => ({
                          value: item,
                          label: getTimesheetTypeLabel(item, locale),
                        })),
                      ]}
                    />
                  </ButtonGroup>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {hasReturnedTimesheet ? (
                    <div
                      data-testid="timesheet-return-feedback"
                      className="flex w-64 min-w-0 flex-col items-end text-right text-xs text-destructive"
                      aria-live="polite"
                      aria-description={returnReason ?? undefined}
                    >
                      <span className="font-semibold">
                        {copy.returnedTimesheet}
                      </span>
                      {returnReason ? (
                        <span
                          data-testid="timesheet-return-reason"
                          className="max-w-full truncate font-normal"
                          title={returnReason}
                        >
                          {copy.viewReturnReason}: {returnReason}
                        </span>
                      ) : null}
                    </div>
                  ) : submitFeedbackKind === "failure" &&
                    submitFailureTags.length > 0 ? (
                    <div
                      data-testid="timesheet-submit-failure-feedback"
                      className="flex max-w-[22rem] flex-wrap justify-end gap-1 text-right text-xs font-medium text-destructive opacity-100"
                      aria-live="polite"
                    >
                      {submitFailureTags.map((tag) => (
                        <span
                          key={tag}
                          className={cn(
                            "whitespace-nowrap rounded border px-1.5 py-0.5 font-semibold",
                            tag === "missing-hours"
                              ? "border-destructive-accent bg-destructive-subtle text-foreground"
                              : "border-warning-accent bg-warning-subtle text-foreground"
                          )}
                        >
                          {tag === "missing-hours"
                            ? copy.validationMissingHours
                            : copy.validationIssueReason}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span
                      className={cn(
                        "max-w-32 text-right text-xs font-medium transition-opacity duration-150 empty:hidden xl:w-32",
                        timesheetSubmitMessageClass(
                          submitMessage,
                          submitFeedbackKind === "failure"
                        )
                      )}
                      aria-live="polite"
                    >
                      {submitMessage}
                    </span>
                  )}
                  <ButtonGroup
                    label={copy.timesheetActions}
                    data-testid="timesheet-workspace-actions"
                    className="shrink-0 items-center gap-1.5"
                  >
                    <MotionButton
                      aria-label={copy.addRow}
                      data-action-id="add-row"
                      size="icon"
                      variant="secondary"
                      className="size-6 cursor-pointer rounded-md"
                      onClick={openAddEntryDialog}
                    >
                      <Plus className="size-3.5" />
                    </MotionButton>
                    <MotionButton
                      aria-label={
                        deleteMode ? copy.deleteSelectedRows : copy.deleteRows
                      }
                      aria-pressed={deleteMode}
                      data-action-id="delete-rows"
                      size="icon"
                      variant="secondary"
                      className="size-6 cursor-pointer rounded-md"
                      onClick={handleDeleteAction}
                    >
                      <Trash2 className="size-3.5" />
                    </MotionButton>
                    <StatefulMotionButton
                      aria-label={copy.submit}
                      data-action-id="submit-timesheet"
                      size="sm"
                      variant="secondary"
                      className="h-7 cursor-pointer px-2.5 text-xs! [&_svg]:size-3.5"
                      state={submitButtonState}
                      loadingText={copy.submitting}
                      successText={copy.submitted}
                      errorText={copy.submitTryAgain}
                      onClick={() => void handleSubmitTimesheet()}
                    >
                      {copy.submit}
                    </StatefulMotionButton>
                  </ButtonGroup>
                </div>
              </section>
            </div>

            <section
              data-timesheet-board-grid
              data-board-layout={`${boardLayout.firstBoundary},${boardLayout.secondBoundary}`}
              data-type-filter={typeFilter}
              ref={boardGridRef}
              className="grid min-h-0 overflow-hidden"
            >
              <TimesheetBoard
                type="Chargeable"
                copy={copy}
                locale={locale}
                rows={rows.filter((row) => row.type === "Chargeable")}
                days={days}
                deleteMode={deleteMode}
                highlightedRowId={highlightedRowId}
                selectedIds={selectedIds}
                onDescriptionChange={handleDescriptionChange}
                onHourChange={handleHourChange}
                canEditDate={isDateEditable}
                isHourEditable={isApprovalHourEditable}
                getApprovalCellState={getApprovalCellState}
                isReturnedHour={isReturnedHour}
                onUnlinkRow={handleUnlinkProjectRow}
                onLinkRow={setLinkProjectRowId}
                onToggleSelected={toggleSelected}
              />
              <Button
                type="button"
                data-timesheet-resize-handle
                accessibleName={copy.resizeChargeableNonChargeable}
                showTooltip={false}
                size="icon"
                variant="ghost"
                className={cn(
                  RESIZE_RAIL_CLASS,
                  "cursor-row-resize border-0 p-0"
                )}
                onPointerDown={(event) =>
                  handleBoardResizePointerDown("first", event)
                }
              >
                <span className={cn(RESIZE_GRIP_CLASS, "h-1 w-12")} />
              </Button>
              <TimesheetBoard
                type="Non-Chargeable"
                copy={copy}
                locale={locale}
                rows={rows.filter((row) => row.type === "Non-Chargeable")}
                days={days}
                deleteMode={deleteMode}
                highlightedRowId={highlightedRowId}
                selectedIds={selectedIds}
                onDescriptionChange={handleDescriptionChange}
                onHourChange={handleHourChange}
                canEditDate={isDateEditable}
                isHourEditable={isApprovalHourEditable}
                getApprovalCellState={getApprovalCellState}
                isReturnedHour={isReturnedHour}
                onToggleSelected={toggleSelected}
              />
              <Button
                type="button"
                data-timesheet-resize-handle
                accessibleName={copy.resizeNonChargeableLeave}
                showTooltip={false}
                size="icon"
                variant="ghost"
                className={cn(
                  RESIZE_RAIL_CLASS,
                  "cursor-row-resize border-0 p-0"
                )}
                onPointerDown={(event) =>
                  handleBoardResizePointerDown("second", event)
                }
              >
                <span className={cn(RESIZE_GRIP_CLASS, "h-1 w-12")} />
              </Button>
              <TimesheetBoard
                type="Leave"
                copy={copy}
                locale={locale}
                rows={rows.filter((row) => row.type === "Leave")}
                days={days}
                deleteMode={deleteMode}
                highlightedRowId={highlightedRowId}
                selectedIds={selectedIds}
                onDescriptionChange={handleDescriptionChange}
                onHourChange={handleHourChange}
                canEditDate={isDateEditable}
                isHourEditable={isApprovalHourEditable}
                getApprovalCellState={getApprovalCellState}
                isReturnedHour={isReturnedHour}
                onToggleSelected={toggleSelected}
              />
            </section>

            <section className="grid min-h-40 rounded-lg border border-border bg-card shadow-sm md:grid-cols-[1.7fr_2.3fr]">
              <DashboardPanel
                chartVariant="recharts"
                detailsTextClassName="text-sm"
                title={copy.fillingProgress}
                segments={getTimesheetProgressSegments(
                  dashboard.completion,
                  copy
                )}
                center={
                  hasAbnormalDays ? (
                    <TriangleAlert
                      aria-label={copy.warning}
                      className="size-7 text-warning-accent"
                    />
                  ) : dashboard.progressPercent >= 100 ? (
                    <Check className="size-7 text-primary" />
                  ) : (
                    <span data-testid="timesheet-progress-percent">
                      {dashboard.progressPercent}%
                    </span>
                  )
                }
                details={[
                  {
                    label: copy.completed,
                    value: String(dashboard.completion.completed),
                  },
                  {
                    label: copy.open,
                    value: String(dashboard.completion.open),
                  },
                  ...(hasAbnormalDays
                    ? [
                        {
                          label: (
                            <span
                              data-testid="timesheet-abnormal-detail"
                              className="inline-flex items-center gap-1 whitespace-nowrap"
                            >
                              <span>{copy.abnormal}</span>
                              <span
                                data-testid="timesheet-abnormal-reason"
                                className="rounded border border-warning-accent bg-warning-subtle px-1 text-xs font-semibold !text-foreground"
                              >
                                {copy.validationIssueReason}
                              </span>
                            </span>
                          ),
                          value: (
                            <span data-testid="timesheet-abnormal-count">
                              {abnormalDays.length}
                            </span>
                          ),
                        },
                      ]
                    : []),
                  {
                    label: copy.target,
                    value: String(dashboard.completion.target),
                  },
                ]}
                secondaryDetailsByIndex={{
                  1: (
                    <OpenDateBadges
                      copy={copy}
                      openDays={dashboard.completion.openDays}
                    />
                  ),
                  ...(hasAbnormalDays
                    ? {
                        2: (
                          <OpenDateBadges
                            copy={copy}
                            reason={copy.validationIssueReason}
                            openDays={abnormalDays}
                            testId="timesheet-abnormal-date-badges"
                          />
                        ),
                      }
                    : {}),
                }}
              />
              <HoursVerificationTable
                copy={copy}
                dailyHours={dashboard.dailyHours}
              />
            </section>
          </>
        )}
      </div>

      <AddEntryDialog
        mobile={phone}
        entryCode={entryCode}
        entryDescription={entryDescription}
        entryDetails={entryDetails}
        entryWorkType={entryWorkType}
        entryError={entryError}
        entryType={entryType}
        isSubmitting={isAddingEntry}
        matchedEngagement={matchedEngagement}
        engagementDirectory={engagementDirectory}
        engagementDirectoryLoading={engagementDirectoryLoading}
        open={addOpen}
        onEntryCodeChange={(value) => {
          setEntryCode(value);
          setSelectedEngagement(undefined);
        }}
        onEntryDescriptionChange={setEntryDescription}
        onEngagementSelect={(engagement) => {
          setSelectedEngagement(engagement);
          setEntryCode(engagement.projectCode ?? engagement.engagementCode);
        }}
        onEntryDetailsChange={setEntryDetails}
        onEntryWorkTypeChange={setEntryWorkType}
        onEntryTypeChange={(value) => {
          setEntryType(value);
          setEntryWorkType("");
          setEntryDetails("");
          setEntryCode("");
          setSelectedEngagement(undefined);
          setEntryError("");
        }}
        onOpenChange={handleAddDialogOpenChange}
        onSubmit={handleAddEntry}
        copy={copy}
        locale={locale}
      />

      <TmsEmpProjectLinkDialog
        open={Boolean(linkProjectRowId)}
        copy={copy}
        onOpenChange={(open) => {
          if (!open) {
            setLinkProjectRowId(null);
          }
        }}
        onLink={handleLinkProjectRow}
      />

      <Dialog open={submitFailureOpen} onOpenChange={setSubmitFailureOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{copy.submitFailed}</DialogTitle>
            <DialogDescription>
              {submitMessage || copy.unableSubmitTimesheet}
            </DialogDescription>
          </DialogHeader>
          {submitFailureTags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {submitFailureTags.map((tag) => (
                <span
                  key={tag}
                  className={cn(
                    "whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-semibold",
                    tag === "missing-hours"
                      ? "border-destructive-accent bg-destructive-subtle text-foreground"
                      : "border-warning-accent bg-warning-subtle text-foreground"
                  )}
                >
                  {tag === "missing-hours"
                    ? copy.validationMissingHours
                    : copy.validationIssueReason}
                </span>
              ))}
            </div>
          ) : null}
          {submitWarnings.length > 0 ? (
            <div className="max-h-48 overflow-y-auto rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-foreground">
              <ul className="grid gap-2">
                {submitWarnings.map((warning) => (
                  <li key={`${warning.date}-${warning.message}`}>
                    {translateTimesheetMessage(warning.message, locale)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSubmitFailureOpen(false)}
            >
              {copy.cancel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={submitConfirmOpen} onOpenChange={setSubmitConfirmOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{copy.openDatesRemain}</DialogTitle>
            <DialogDescription>
              {copy.openDatesRemainDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-48 overflow-y-auto rounded-md border border-l-2 border-border border-l-warning-accent bg-warning-subtle p-3 text-sm text-foreground">
            <ul className="grid gap-2">
              {submitConfirmWarnings.map((warning) => (
                <li key={warning.date}>
                  {translateTimesheetMessage(warning.message, locale)}
                </li>
              ))}
            </ul>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSubmitConfirmOpen(false)}
            >
              {copy.cancel}
            </Button>
            <Button type="button" onClick={() => void confirmSubmitTimesheet()}>
              {copy.submitAnyway}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function TmsEmpProjectLinkDialog({
  open,
  copy,
  onOpenChange,
  onLink,
}: {
  open: boolean;
  copy: TmsWorkspaceCopy;
  onOpenChange: (open: boolean) => void;
  onLink: (projectId: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkingProjectId, setLinkingProjectId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
      setMatches([]);
      setLoading(false);
      setError("");
      return;
    }
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setMatches([]);
      setLoading(false);
      setError("");
      return;
    }
    const request = new AbortController();
    setLoading(true);
    setError("");
    void getCmpEngagementDirectory(normalizedQuery, request.signal)
      .then((directory) => {
        setMatches(
          rankEngagementMatches(
            directory.filter((engagement) => Boolean(engagement.projectId)),
            normalizedQuery
          )
        );
      })
      .catch((requestError) => {
        if (!isAbortError(requestError)) {
          setError(copy.linkProjectError);
        }
      })
      .finally(() => {
        if (!request.signal.aborted) {
          setLoading(false);
        }
      });
    return () => request.abort();
  }, [copy.linkProjectError, open, query]);

  async function selectProject(projectId: string) {
    setLinkingProjectId(projectId);
    try {
      await onLink(projectId);
    } finally {
      setLinkingProjectId("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{copy.linkEmpProject}</DialogTitle>
          <DialogDescription>{copy.searchEmpProjectHint}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              aria-label={copy.searchEmpProjectPlaceholder}
              className="pl-9"
              placeholder={copy.searchEmpProjectPlaceholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">
              {copy.searchingEmpProjects}
            </p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : query.trim() && matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {copy.noMatchingEmpProjects}
            </p>
          ) : (
            <EmpProjectResultsTable
              copy={copy}
              disabled={Boolean(linkingProjectId)}
              projects={matches}
              onSelect={(engagement) =>
                engagement.projectId
                  ? selectProject(engagement.projectId)
                  : Promise.resolve()
              }
            />
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {copy.cancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmpProjectResultsTable({
  projects,
  copy,
  disabled = false,
  onSelect,
}: {
  projects: Engagement[];
  copy: TmsWorkspaceCopy;
  disabled?: boolean;
  onSelect: (project: Engagement) => Promise<void>;
}) {
  const phone = useCompactViewport(767.98);
  if (phone) {
    return (
      <div
        className={mobileStyles.menu}
        aria-label={copy.matchingCmpEngagements}
      >
        {projects.map((project) => (
          <MobileButton
            key={
              project.projectId ??
              `${project.engagementId}:${project.projectCode}`
            }
            variant="quiet"
            className={mobileStyles.projectOptionButton}
            disabled={disabled || !project.projectId}
            onClick={() => void onSelect(project)}
          >
            <span className={mobileStyles.projectOption}>
              <strong>{project.projectCode ?? project.engagementCode}</strong>
              <span className={mobileStyles.muted}>
                {project.projectName} ·{" "}
                {project.clientName || project.clientCode}
              </span>
              <span className={mobileStyles.muted}>
                {copy.pic}: {project.pic || "—"} · {copy.mic}:{" "}
                {project.mic || "—"}
              </span>
            </span>
          </MobileButton>
        ))}
      </div>
    );
  }
  return (
    <div className="max-h-64 overflow-auto rounded-md border border-border bg-background">
      <table
        aria-label={copy.matchingCmpEngagements}
        className="w-full min-w-[44rem] border-collapse text-xs"
      >
        <thead className="sticky top-0 z-10 bg-muted/90 text-muted-foreground backdrop-blur">
          <tr className="border-b border-border">
            {[
              copy.projectCode,
              copy.projectName,
              copy.clientName,
              copy.pic,
              copy.mic,
            ].map((label) => (
              <th key={label} className="px-3 py-2 text-left font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr
              key={
                project.projectId ??
                `${project.engagementId}:${project.projectCode}`
              }
              className="border-b border-border/70 last:border-b-0 hover:bg-muted/40"
            >
              <td className="px-3 py-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto p-0 text-left font-semibold text-primary hover:bg-transparent hover:underline"
                  disabled={disabled || !project.projectId}
                  onClick={() => onSelect(project)}
                >
                  {project.projectCode ?? project.engagementCode}
                </Button>
              </td>
              <td className="max-w-48 truncate px-3 py-2">
                {project.projectName || "—"}
              </td>
              <td className="max-w-48 truncate px-3 py-2">
                {project.clientName || project.clientCode}
              </td>
              <td className="px-3 py-2">{project.pic || "—"}</td>
              <td className="px-3 py-2">{project.mic || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SelectedEmpProjectSummary({
  project,
  copy,
}: {
  project: Engagement;
  copy: TmsWorkspaceCopy;
}) {
  const projectCode = project.projectCode ?? project.engagementCode;

  return (
    <section
      aria-label={`${copy.selectedEmpProject}: ${projectCode}`}
      className="overflow-hidden rounded-lg border border-primary/20 bg-card shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            {copy.selectedEmpProject}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
            {projectCode}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {project.projectName || project.clientName}
          </p>
        </div>
        <div className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs text-foreground">
          <span className="text-muted-foreground">{copy.cmpMatch}</span>{" "}
          <span className="font-medium">{project.engagementCode}</span>
        </div>
      </div>
      <div className="grid border-t border-border/70 bg-muted/20 sm:grid-cols-3 sm:divide-x sm:divide-border/70">
        <ProjectSummaryField label={copy.clientName}>
          <span className="truncate font-medium text-foreground">
            {project.clientName || "—"}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {project.clientCode || "—"}
          </span>
        </ProjectSummaryField>
        <ProjectSummaryField label={copy.pic}>
          {project.pic || "—"}
        </ProjectSummaryField>
        <ProjectSummaryField label={copy.mic}>
          {project.mic || "—"}
        </ProjectSummaryField>
      </div>
    </section>
  );
}

function ProjectSummaryField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 content-start gap-0.5 px-4 py-3 text-sm">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

type TimesheetAddFormContentProps = {
  mobile?: boolean;
  entryCode: string;
  entryDescription: string;
  entryDetails: TimesheetDetails | "";
  entryWorkType: TimesheetWorkType | "";
  entryError: string;
  entryType: TimesheetType | "";
  engagementDirectory: Engagement[];
  engagementDirectoryLoading: boolean;
  isSubmitting: boolean;
  matchedEngagement?: Engagement;
  onCancel: () => void;
  onEngagementSelect: (engagement: Engagement) => void;
  onEntryCodeChange: (value: string) => void;
  onEntryDescriptionChange: (value: string) => void;
  onEntryDetailsChange: (value: TimesheetDetails | "") => void;
  onEntryWorkTypeChange: (value: TimesheetWorkType | "") => void;
  onEntryTypeChange: (value: TimesheetType | "") => void;
  copy?: TmsWorkspaceCopy;
  locale?: TmsLocale;
};

export function TimesheetAddFormContent({
  mobile = false,
  entryCode,
  entryDescription,
  entryDetails,
  entryWorkType,
  entryError,
  entryType,
  engagementDirectory,
  engagementDirectoryLoading,
  isSubmitting,
  matchedEngagement,
  onCancel,
  onEngagementSelect,
  onEntryCodeChange,
  onEntryDescriptionChange,
  onEntryDetailsChange,
  onEntryWorkTypeChange,
  onEntryTypeChange,
  copy: copyProp,
  locale = "en-US",
}: TimesheetAddFormContentProps) {
  const copy = copyProp ?? tmsWorkspaceCopy;
  const listId = useId();
  const matches = useMemo(
    () => rankEngagementMatches(engagementDirectory, entryCode),
    [engagementDirectory, entryCode]
  );
  const showMatches =
    entryType === "Chargeable" &&
    !matchedEngagement &&
    Boolean(entryCode.trim());
  const workTypes = entryType ? WORK_TYPES_BY_TYPE[entryType] : [];
  const details =
    entryType && entryType !== "Chargeable" ? DETAILS_BY_TYPE[entryType] : [];
  const chargeableDenied =
    entryType === "Chargeable" &&
    matchedEngagement !== undefined &&
    !matchedEngagement.timesheetAccess.allowed;
  const chargeableEnabled = entryType === "Chargeable";

  return (
    <fieldset
      className={cn("grid gap-4", mobile && mobileStyles.addForm)}
      disabled={isSubmitting}
    >
      <Field label={copy.category}>
        <Select
          value={entryType}
          onValueChange={(value) =>
            onEntryTypeChange((value as TimesheetType | null) ?? "")
          }
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue placeholder={copy.chooseType}>
              {entryType ? getTimesheetTypeLabel(entryType, locale) : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {TIMESHEET_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {getTimesheetTypeLabel(type, locale)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      {(!mobile || entryType) && (
        <Field label={copy.type}>
          <Select
            disabled={!entryType}
            value={entryWorkType}
            onValueChange={(value) =>
              onEntryWorkTypeChange((value as TimesheetWorkType | null) ?? "")
            }
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue placeholder={copy.chooseType}>
                {entryWorkType
                  ? getTimesheetWorkTypeLabel(entryWorkType, locale)
                  : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {workTypes.map((workType) => (
                  <SelectItem key={workType} value={workType}>
                    {getTimesheetWorkTypeLabel(workType, locale)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      )}

      {(!mobile || (entryType && entryType !== "Chargeable")) && (
        <Field label={copy.details}>
          <span className="sr-only">
            {details
              .map((detail) => getTimesheetDetailsLabel(detail, locale))
              .join(" · ")}
          </span>
          <Select
            disabled={!entryType || entryType === "Chargeable"}
            value={entryDetails}
            onValueChange={(value) =>
              onEntryDetailsChange((value as TimesheetDetails | null) ?? "")
            }
          >
            <SelectTrigger
              size="sm"
              className="w-full"
              data-chargeable-details={
                entryType === "Chargeable" ? "disabled" : "enabled"
              }
              aria-label={mobile ? copy.details : undefined}
            >
              <SelectValue placeholder={copy.chooseDetails}>
                {entryDetails
                  ? getTimesheetDetailsLabel(entryDetails, locale)
                  : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {details.map((detail) => (
                  <SelectItem key={detail} value={detail}>
                    {getTimesheetDetailsLabel(detail, locale)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      )}

      <Field label={copy.description}>
        <Input
          aria-label={copy.description}
          value={entryDescription}
          placeholder={copy.addDescriptionPlaceholder}
          onChange={(event) =>
            onEntryDescriptionChange(event.currentTarget.value)
          }
        />
      </Field>

      {(!mobile || chargeableEnabled) && (
        <fieldset
          data-chargeable-fields={chargeableEnabled ? "enabled" : "disabled"}
          disabled={!chargeableEnabled}
          className={cn(
            "relative grid content-start gap-4 overflow-visible pr-1 transition-opacity",
            !chargeableEnabled && "opacity-50"
          )}
        >
          <Field label={copy.selectEmpProject}>
            <div className="relative grid gap-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  role="combobox"
                  aria-label={mobile ? copy.selectEmpProject : undefined}
                  aria-autocomplete="list"
                  aria-expanded={showMatches}
                  aria-controls={listId}
                  className="pl-9"
                  value={entryCode}
                  placeholder={copy.searchEmpProjectDirectoryPlaceholder}
                  autoComplete="off"
                  onChange={(event) =>
                    onEntryCodeChange(event.currentTarget.value)
                  }
                />
              </div>
              {matchedEngagement ? (
                <SelectedEmpProjectSummary
                  copy={copy}
                  project={matchedEngagement}
                />
              ) : null}
              <div
                id={listId}
                aria-label={copy.matchingCmpEngagements}
                className={cn(
                  "absolute inset-x-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg",
                  !showMatches && "sr-only"
                )}
              >
                {engagementDirectoryLoading ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    {copy.searchingCmpEngagements}
                  </p>
                ) : matches.length > 0 ? (
                  <EmpProjectResultsTable
                    copy={copy}
                    projects={matches}
                    onSelect={(engagement) => {
                      onEngagementSelect(engagement);
                      return Promise.resolve();
                    }}
                  />
                ) : (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    {copy.noMatchingActiveEngagement}
                  </p>
                )}
              </div>
            </div>
          </Field>
        </fieldset>
      )}
      {mobile &&
        chargeableEnabled &&
        !entryCode.trim() &&
        !matchedEngagement && (
          <p className={mobileStyles.muted}>{copy.pendingLinkHint}</p>
        )}

      {chargeableDenied && matchedEngagement ? (
        <p className="rounded-md border border-l-2 border-border border-l-warning-accent bg-warning-subtle px-3 py-2 text-sm text-foreground">
          {copy.timesheetAccessDenied.replace(
            "{reason}",
            matchedEngagement.timesheetAccess.reason
          )}
        </p>
      ) : null}

      <DialogFooter className="items-center sm:justify-between">
        <p
          className={cn(
            "min-h-5 min-w-0 flex-1 truncate text-sm font-medium",
            entryError ? "text-destructive opacity-100" : "opacity-0"
          )}
          aria-live="polite"
        >
          {entryError}
        </p>
        <ButtonGroup>
          <Button type="button" variant="outline" onClick={onCancel}>
            {copy.cancel}
          </Button>
          <Button
            type="submit"
            disabled={
              !entryType ||
              !entryWorkType ||
              (entryType !== "Chargeable" && !entryDetails) ||
              chargeableDenied ||
              (entryType === "Chargeable" &&
                !matchedEngagement &&
                Boolean(entryCode.trim()))
            }
          >
            {isSubmitting ? copy.validatingCmp : copy.add}
          </Button>
        </ButtonGroup>
      </DialogFooter>
    </fieldset>
  );
}

function AddEntryDialog({
  mobile = false,
  entryCode,
  entryDescription,
  entryDetails,
  entryWorkType,
  entryError,
  entryType,
  engagementDirectory,
  engagementDirectoryLoading,
  isSubmitting,
  matchedEngagement,
  open,
  onEntryCodeChange,
  onEntryDescriptionChange,
  onEngagementSelect,
  onEntryDetailsChange,
  onEntryWorkTypeChange,
  onEntryTypeChange,
  onOpenChange,
  onSubmit,
  copy,
  locale,
}: Omit<TimesheetAddFormContentProps, "onCancel"> & {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const content = (
    <form onSubmit={onSubmit}>
      <TimesheetAddFormContent
        mobile={mobile}
        entryCode={entryCode}
        entryDescription={entryDescription}
        entryDetails={entryDetails}
        entryWorkType={entryWorkType}
        entryError={entryError}
        entryType={entryType}
        engagementDirectory={engagementDirectory}
        engagementDirectoryLoading={engagementDirectoryLoading}
        isSubmitting={isSubmitting}
        matchedEngagement={matchedEngagement}
        onCancel={() => onOpenChange(false)}
        onEngagementSelect={onEngagementSelect}
        onEntryCodeChange={onEntryCodeChange}
        onEntryDescriptionChange={onEntryDescriptionChange}
        onEntryDetailsChange={onEntryDetailsChange}
        onEntryWorkTypeChange={onEntryWorkTypeChange}
        onEntryTypeChange={onEntryTypeChange}
        copy={copy}
        locale={locale}
      />
    </form>
  );
  if (mobile) {
    return (
      <MobileActionSheet
        open={open}
        onOpenChange={onOpenChange}
        title={copy?.addRow ?? tmsWorkspaceCopy.addRow}
        closeLabel={copy?.cancel ?? tmsWorkspaceCopy.cancel}
      >
        {content}
      </MobileActionSheet>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto p-0 sm:max-w-[880px]">
        <div className="flex flex-col gap-4 p-5">
          <DialogHeader>
            <DialogTitle>{copy?.addRow ?? tmsWorkspaceCopy.addRow}</DialogTitle>
          </DialogHeader>
          {content}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TimesheetColumnFilterHeader({
  column,
  label,
  onChange,
  rows,
  selectedValues,
  copy = tmsWorkspaceCopy,
}: {
  column: TimesheetColumnKey;
  label: string;
  onChange: (values: string[]) => void;
  rows: TimesheetRow[];
  selectedValues: string[];
  copy?: TmsWorkspaceCopy;
}) {
  const [search, setSearch] = useState("");
  const values = useMemo(
    () => timesheetColumnValues(rows, column, copy.filterBlankValue),
    [column, copy.filterBlankValue, rows]
  );
  const visibleValues = values.filter((value) =>
    value.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  );
  const active = selectedValues.length > 0;

  return (
    <div className="relative min-w-0 pr-6 text-center">
      <span className="block truncate whitespace-nowrap">{label}</span>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`${copy.filter} ${label}`}
              data-filter-active={active ? "true" : "false"}
              className={cn(
                "absolute right-1 top-1/2 z-20 size-6 -translate-y-1/2 rounded-md border border-transparent bg-muted/80 p-0 text-muted-foreground transition-[background-color,border-color,color,box-shadow] duration-150 hover:border-primary/50 hover:bg-primary/10 hover:text-primary focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/40 data-[state=open]:border-primary data-[state=open]:bg-primary/10 data-[filter-active=true]:border-primary/60",
                active && "border-primary/60 bg-primary/10 text-primary"
              )}
            >
              <ListFilter className="size-3.5" />
            </Button>
          }
        />
        <PopoverContent
          align="end"
          sideOffset={4}
          className="flex h-72 w-60 flex-col p-2"
        >
          <Input
            type="search"
            aria-label={`${copy.filterSearch} ${label}`}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            className="mb-2 h-7 shrink-0 text-xs"
            placeholder={`${copy.filterSearch} ${label}`}
          />
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {visibleValues.map((value) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted"
              >
                <Checkbox
                  checked={selectedValues.includes(value)}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked
                        ? [...selectedValues, value]
                        : selectedValues.filter((item) => item !== value)
                    )
                  }
                />
                <span className="truncate">{value}</span>
              </label>
            ))}
            {visibleValues.length === 0 ? (
              <p className="px-1.5 py-2 text-xs text-muted-foreground">
                {copy.filterNoMatches}
              </p>
            ) : null}
          </div>
          {active ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 h-7 w-full shrink-0 text-xs"
              onClick={() => onChange([])}
            >
              {copy.clearFilter}
            </Button>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export type TimesheetBoardProps = {
  type: TimesheetType;
  copy?: TmsWorkspaceCopy;
  locale?: TmsLocale;
  rows: TimesheetRow[];
  days: PeriodDay[];
  deleteMode: boolean;
  highlightedRowId?: string;
  selectedIds: Set<string>;
  onDescriptionChange: (rowId: string, description: string) => void;
  onHourChange: (rowId: string, day: PeriodDay, value: string) => void;
  canEditDate?: (date: string) => boolean;
  isHourEditable?: (row: TimesheetRow, date: string) => boolean;
  getApprovalCellState?: (
    row: TimesheetRow,
    date: string
  ) => "approved" | "modified" | null;
  isReturnedHour?: (row: TimesheetRow, date: string) => boolean;
  onUnlinkRow?: (rowId: string) => void;
  onLinkRow?: (rowId: string) => void;
  onToggleSelected: (rowId: string) => void;
};

/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- The named date scroller needs keyboard focus so narrow-screen users can reach every date. */
export function TimesheetBoard({
  type,
  copy = tmsWorkspaceCopy,
  locale = "en-US",
  rows,
  days,
  deleteMode,
  highlightedRowId,
  selectedIds,
  onDescriptionChange,
  onHourChange,
  canEditDate,
  isHourEditable,
  getApprovalCellState,
  isReturnedHour,
  onUnlinkRow,
  onLinkRow,
  onToggleSelected,
}: TimesheetBoardProps) {
  const isChargeable = type === "Chargeable";
  const fixedPaneWidth = deleteMode ? 480 : 448;
  const fixedWidth = deleteMode ? "w-[480px]" : "w-[448px]";
  const gridColumns = deleteMode
    ? "grid-cols-[480px_minmax(0,1fr)]"
    : "grid-cols-[448px_minmax(0,1fr)]";
  const dateTableWidthClass =
    DATE_TABLE_WIDTH_CLASS[days.length] ?? "min-w-[978px]";
  const datePaneRef = useRef<HTMLDivElement | null>(null);
  const horizontalRailRef = useRef<HTMLDivElement | null>(null);
  const [columnFilters, setColumnFilters] = useState<TimesheetColumnFilters>(
    {}
  );
  const filteredRows = useMemo(
    () =>
      filterTimesheetRowsByColumns(rows, columnFilters, copy.filterBlankValue),
    [columnFilters, copy.filterBlankValue, rows]
  );

  function filterHeader(label: string, column: TimesheetColumnKey) {
    return (
      <TimesheetColumnFilterHeader
        column={column}
        label={label}
        rows={rows}
        selectedValues={columnFilters[column] ?? []}
        copy={copy}
        onChange={(values) =>
          setColumnFilters((current) => ({ ...current, [column]: values }))
        }
      />
    );
  }

  function syncHorizontalScroll(
    source: HTMLElement,
    target: HTMLDivElement | null
  ) {
    if (target && target.scrollLeft !== source.scrollLeft) {
      target.scrollLeft = source.scrollLeft;
    }
  }

  return (
    <section
      data-timesheet-board={type}
      data-fixed-pane-width={fixedPaneWidth}
      data-period-days={days.length}
      data-independent-scroll
      className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-card"
    >
      <h2 className="border-b border-border bg-muted/35 px-3 py-1.5 text-xs font-semibold text-foreground">
        {getTimesheetTypeLabel(type, locale)}
      </h2>
      <div
        data-timesheet-vertical-scroll
        tabIndex={0}
        role="region"
        aria-label={`${getTimesheetTypeLabel(type, locale)} ${locale === "zh-CN" ? "工时表，可横向滚动查看日期" : "timesheet, scroll horizontally for dates"}`}
        className="grid min-h-0 w-full min-w-0 grid-rows-[minmax(max-content,1fr)_auto] overflow-x-hidden overflow-y-auto focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
      >
        <div
          data-timesheet-columns
          className={cn("grid min-h-max content-start", gridColumns)}
        >
          <div className="timesheet-frozen-pane min-h-max overflow-x-hidden overflow-y-clip border-r border-border">
            <table
              className={cn("table-fixed border-collapse text-xs", fixedWidth)}
            >
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr
                  data-timesheet-header-height="32"
                  className="h-8 border-b border-border"
                >
                  {deleteMode ? (
                    <HeaderCell className="w-8 p-0 text-center">
                      <span className="sr-only">{copy.select}</span>
                    </HeaderCell>
                  ) : null}
                  {isChargeable ? (
                    <>
                      <HeaderCell className="w-[132px]">
                        {filterHeader(copy.projectCode, "engagementCode")}
                      </HeaderCell>
                      <HeaderCell className="w-[172px]">
                        {filterHeader(copy.clientName, "clientName")}
                      </HeaderCell>
                      <HeaderCell className="w-[144px]">
                        {filterHeader(copy.type, "workType")}
                      </HeaderCell>
                    </>
                  ) : (
                    <>
                      <HeaderCell className="w-[304px]">
                        {filterHeader(copy.details, "details")}
                      </HeaderCell>
                      <HeaderCell className="w-[144px]">
                        {filterHeader(copy.type, "workType")}
                      </HeaderCell>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    data-duplicate-highlight={
                      highlightedRowId === row.id ? "true" : undefined
                    }
                    data-timesheet-row-id={row.id}
                    data-timesheet-row-height="28"
                    data-timesheet-row-adjustment="0.6667"
                    key={row.id}
                    className={cn(
                      "h-[calc(1.75rem+0.6667px)] border-t border-border last:border-b",
                      !deleteMode && "hover:bg-accent/40",
                      deleteMode &&
                        !selectedIds.has(row.id) &&
                        "hover:[&>td]:bg-destructive/5 hover:[&>td>input]:border-destructive/20 hover:[&>td>input]:bg-destructive/5",
                      selectedIds.has(row.id) &&
                        "[&>td]:bg-destructive/10 [&>td>input]:border-destructive/30 [&>td>input]:bg-destructive/10",
                      highlightedRowId === row.id &&
                        "bg-primary/15 ring-1 ring-inset ring-primary/40"
                    )}
                  >
                    {deleteMode ? (
                      <BodyCell className="w-8 p-0 text-center">
                        <Button
                          data-tms-delete-control
                          type="button"
                          variant={
                            selectedIds.has(row.id) ? "destructive" : "outline"
                          }
                          size="icon-sm"
                          aria-label={`${copy.selectRow} ${row.id}`}
                          className={cn(
                            "relative mx-auto size-5 rounded-[5px] p-0 after:absolute after:-inset-1 after:content-[''] [&_svg]:size-3",
                            selectedIds.has(row.id)
                              ? "border-destructive bg-destructive/15 text-destructive hover:bg-destructive/20"
                              : "border-border bg-background text-muted-foreground hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                          )}
                          onClick={() => onToggleSelected(row.id)}
                        >
                          <Check className="size-3.5" />
                        </Button>
                      </BodyCell>
                    ) : null}
                    {isChargeable ? (
                      <>
                        <BodyCell className="w-[132px] text-center font-medium">
                          {isChargeableRow(row) ? (
                            <span className="inline-flex items-center gap-1">
                              {row.projectCode ||
                                row.engagementCode ||
                                (row.source === "TMS_PENDING"
                                  ? copy.pendingLinkLabel
                                  : null)}
                              {row.projectId && onUnlinkRow ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`${copy.unlinkProject} ${row.id}`}
                                  className="size-5"
                                  onClick={() => onUnlinkRow(row.id)}
                                >
                                  <Link2Off className="size-3" />
                                </Button>
                              ) : row.source === "TMS_PENDING" && onLinkRow ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`${copy.linkEmpProject} ${row.id}`}
                                  className="size-5"
                                  onClick={() => onLinkRow(row.id)}
                                >
                                  <Link2 className="size-3" />
                                </Button>
                              ) : null}
                            </span>
                          ) : null}
                        </BodyCell>
                        <BodyCell className="w-[172px] text-center">
                          {isChargeableRow(row) ? row.clientName : null}
                        </BodyCell>
                        <BodyCell className="w-[144px] text-center">
                          <DetailsPill
                            type={row.type}
                            details={getTimesheetWorkType(row)}
                            locale={locale}
                          />
                        </BodyCell>
                      </>
                    ) : (
                      <>
                        <BodyCell className="w-[304px] text-center">
                          <DetailsPill
                            type={row.type}
                            details={row.details}
                            locale={locale}
                          />
                        </BodyCell>
                        <BodyCell className="w-[144px] text-center">
                          <DetailsPill
                            type={row.type}
                            details={getTimesheetWorkType(row)}
                            locale={locale}
                          />
                        </BodyCell>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            ref={datePaneRef}
            className="timesheet-date-scroll tms-native-scrollbar-hidden min-h-max overflow-x-auto overflow-y-clip"
            onScroll={(event) =>
              syncHorizontalScroll(
                event.currentTarget,
                horizontalRailRef.current
              )
            }
          >
            <table
              className={cn(
                "w-full table-fixed border-collapse text-xs",
                dateTableWidthClass
              )}
            >
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr
                  data-timesheet-header-height="32"
                  className="h-8 border-b border-border"
                >
                  {days.map((day) => (
                    <HeaderCell
                      key={day.date}
                      className={cn(
                        "w-[46px] text-center",
                        daySurfaceClass(day)
                      )}
                    >
                      <span className="block leading-4">{day.dayOfMonth}</span>
                      <span className="block text-[0.62rem] leading-3 font-medium text-muted-foreground">
                        {day.weekdayLabel}
                      </span>
                    </HeaderCell>
                  ))}
                  <HeaderCell className="w-[222px]">
                    {filterHeader(copy.description, "description")}
                  </HeaderCell>
                  <HeaderCell className="w-[66px] text-center">
                    {copy.total}
                  </HeaderCell>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    data-duplicate-highlight={
                      highlightedRowId === row.id ? "true" : undefined
                    }
                    data-timesheet-row-id={row.id}
                    data-timesheet-row-height="28"
                    key={row.id}
                    className={cn(
                      "h-7 border-t border-border last:border-b",
                      !deleteMode && "hover:bg-accent/40",
                      deleteMode &&
                        !selectedIds.has(row.id) &&
                        "hover:[&>td]:bg-destructive/5 hover:[&>td>input]:border-destructive/20 hover:[&>td>input]:bg-destructive/5",
                      selectedIds.has(row.id) &&
                        "[&>td]:bg-destructive/10 [&>td>input]:border-destructive/30 [&>td>input]:bg-destructive/10",
                      highlightedRowId === row.id &&
                        "bg-primary/15 ring-1 ring-inset ring-primary/40"
                    )}
                  >
                    {days.map((day) => (
                      <BodyCell
                        key={day.date}
                        data-testid={
                          isReturnedHour?.(row, day.date)
                            ? `timesheet-returned-cell-${row.id}-${day.date}`
                            : undefined
                        }
                        className={cn(
                          "p-0 text-center",
                          daySurfaceClass(day),
                          isReturnedHour?.(row, day.date) && "bg-destructive/15"
                        )}
                      >
                        <HourCell
                          approvalState={getApprovalCellState?.(row, day.date)}
                          max={getTimesheetWorkType(row) === "Normal" ? 8 : 24}
                          returned={isReturnedHour?.(row, day.date) ?? false}
                          disabled={shouldDisableTimesheetHours(
                            isHourEditable?.(row, day.date) ??
                              canEditDate?.(day.date) ??
                              true,
                            !isChargeableRow(row) ||
                              isDemoTimesheetRow(row) ||
                              row.timesheetAccess?.allowed === true
                          )}
                          onChange={(value) => onHourChange(row.id, day, value)}
                          type={row.type}
                          value={row.hoursByDate[day.date] ?? 0}
                          hoursLabel={copy.hours}
                        />
                      </BodyCell>
                    ))}
                    <BodyCell className="w-[222px] p-0.5">
                      <Input
                        aria-label={`${copy.descriptionForRow} ${row.id}`}
                        value={row.description}
                        onChange={(event) =>
                          onDescriptionChange(row.id, event.currentTarget.value)
                        }
                        className="h-6 w-full rounded-md px-2 text-xs"
                      />
                    </BodyCell>
                    <BodyCell className="text-center font-semibold text-muted-foreground">
                      {formatPeriodHours(row.periodTotal)}
                    </BodyCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div
          data-timesheet-horizontal-rail
          className={cn(
            "sticky bottom-0 z-10 grid min-w-0 bg-card",
            gridColumns
          )}
        >
          <div aria-hidden />
          <section
            ref={horizontalRailRef}
            aria-label={`${getTimesheetTypeLabel(type, locale)} horizontal scroll`}
            className="overflow-x-auto"
            onScroll={(event) =>
              syncHorizontalScroll(event.currentTarget, datePaneRef.current)
            }
          >
            <div aria-hidden className={cn("h-px", dateTableWidthClass)} />
          </section>
        </div>
      </div>
    </section>
  );
}

/* oxlint-enable jsx-a11y/no-noninteractive-tabindex */
export function hoursVerificationClass(
  day: Pick<PeriodDay, "isWorkday"> & { isHoliday?: boolean },
  total: number
) {
  if (total > 24) {
    return "border-b-2 border-b-destructive-accent bg-destructive-subtle text-foreground";
  }
  if (!day.isWorkday || day.isHoliday) {
    return "bg-success-subtle text-foreground";
  }
  if (total < 8 || total > 12) {
    return "border-b-2 border-b-warning-accent bg-warning-subtle text-foreground";
  }
  return "bg-success-subtle text-foreground";
}

export function HoursVerificationTable({
  dailyHours,
  copy = tmsWorkspaceCopy,
}: {
  dailyHours: DailyHoursSummary[];
  copy?: TmsWorkspaceCopy;
}) {
  const rows = [
    {
      label: copy.chargeable,
      key: "chargeable",
      className: "text-primary",
    },
    {
      label: copy.nonChargeable,
      key: "nonChargeable",
      className: "text-violet-700 dark:text-violet-300",
    },
    {
      label: copy.leave,
      key: "leave",
      className: "text-rose-700 dark:text-rose-300",
    },
    {
      label: copy.total,
      key: "total",
      className: "font-semibold",
    },
  ] as const;
  const periodTotals = dailyHours.reduce(
    (totals, day) => ({
      chargeable: totals.chargeable + day.chargeable,
      nonChargeable: totals.nonChargeable + day.nonChargeable,
      leave: totals.leave + day.leave,
      total: totals.total + day.total,
    }),
    { chargeable: 0, nonChargeable: 0, leave: 0, total: 0 }
  );

  return (
    <section className="grid min-h-40 grid-rows-[1.15rem_minmax(0,1fr)] gap-1.5 p-2.5">
      <h2 className="text-xs font-semibold">{copy.hoursVerification}</h2>
      <div className="h-full overflow-x-auto rounded-md border border-border">
        <table className="h-full min-w-full table-fixed border-collapse text-xs">
          <thead className="bg-muted/70 text-muted-foreground">
            <tr>
              <HeaderCell className="sticky left-0 z-10 w-[126px] bg-muted/95">
                {copy.category}
              </HeaderCell>
              {dailyHours.map((day) => (
                <HeaderCell
                  key={day.date}
                  className={cn("w-[46px] text-center", daySurfaceClass(day))}
                >
                  <span className="block">{day.dayOfMonth}</span>
                  <span className="text-[0.62rem]">{day.weekdayLabel}</span>
                </HeaderCell>
              ))}
              <HeaderCell className="w-[82px] text-center">
                {copy.periodTotal}
              </HeaderCell>
            </tr>
          </thead>
          <tbody>
            {rows.map((summaryRow) => (
              <tr
                key={summaryRow.label}
                data-hours-summary-row={summaryRow.label}
                className="border-t border-border"
              >
                <BodyCell
                  className={cn(
                    "sticky left-0 z-10 w-[126px] bg-card font-medium",
                    summaryRow.className
                  )}
                >
                  {summaryRow.label}
                </BodyCell>
                {dailyHours.map((day) => (
                  <BodyCell
                    key={day.date}
                    className={cn(
                      "w-[46px] text-center tabular-nums",
                      summaryRow.key === "total"
                        ? hoursVerificationClass(day, day.total)
                        : daySurfaceClass(day)
                    )}
                  >
                    {formatPeriodHours(day[summaryRow.key])}
                  </BodyCell>
                ))}
                <BodyCell className="w-[82px] text-center font-semibold tabular-nums">
                  {formatPeriodHours(periodTotals[summaryRow.key])}
                </BodyCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function DashboardPanel({
  center,
  chartVariant = "svg",
  details,
  detailsTextClassName,
  notice,
  secondaryDetails,
  secondaryDetailsByIndex,
  secondaryDetailsIndex = 1,
  segments,
  title,
}: {
  center: React.ReactNode;
  chartVariant?: "recharts" | "svg";
  details?: { label: React.ReactNode; value?: React.ReactNode }[];
  detailsTextClassName?: string;
  notice?: React.ReactNode;
  secondaryDetails?: React.ReactNode;
  secondaryDetailsByIndex?: Partial<Record<number, React.ReactNode>>;
  secondaryDetailsIndex?: number;
  segments: { color: string; label: string; value: number }[];
  title: string;
}) {
  const total = totalFromSegments(segments);
  const chartData = total
    ? segments.map((segment) => ({
        ...segment,
        fill: segment.color,
      }))
    : [
        {
          label: segments[1]?.label ?? segments[0]?.label ?? "",
          value: 1,
          fill: "var(--muted)",
        },
      ];
  const svgSegments = segments.map((segment, index) => {
    const length = total ? (segment.value / total) * 100 : 0;
    const offset = -segments
      .slice(0, index)
      .reduce(
        (cursor, previous) =>
          cursor + (total ? (previous.value / total) * 100 : 0),
        0
      );
    return { length, offset, segment };
  });

  return (
    <section className="grid min-h-40 grid-rows-[1.15rem_minmax(0,1fr)] gap-1.5 border-b border-border p-2.5 md:border-r md:border-b-0 md:last:border-r-0">
      <h2 className="flex h-[1.15rem] items-start text-xs font-semibold">
        {title}
      </h2>
      <div
        data-testid="dashboard-chart-details-group"
        className={cn(
          "grid h-full min-h-0 items-stretch",
          chartVariant === "recharts"
            ? "timesheet-progress-group w-full justify-self-center"
            : "grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] gap-1"
        )}
      >
        <div className="relative grid min-h-0 place-items-center">
          {chartVariant === "recharts" ? (
            <ChartContainer
              label={title}
              className="absolute inset-0 h-full w-full"
            >
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="72%"
                  outerRadius="98%"
                  paddingAngle={total ? 2 : 0}
                  strokeWidth={0}
                  startAngle={90}
                  endAngle={-270}
                  animationBegin={0}
                  animationDuration={650}
                  animationEasing="ease-out"
                  isAnimationActive={process.env.NODE_ENV !== "test"}
                >
                  {chartData.map((segment) => (
                    <Cell key={segment.label} fill={segment.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          ) : (
            <svg
              aria-label={title}
              viewBox="0 0 100 100"
              className="h-full max-h-full w-full -rotate-90"
            >
              <circle
                cx="50"
                cy="50"
                r="36"
                fill="none"
                stroke="var(--muted)"
                strokeWidth="10"
                pathLength="100"
              />
              {svgSegments.map(({ length, offset, segment }) => (
                <circle
                  key={segment.label}
                  cx="50"
                  cy="50"
                  r="36"
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="10"
                  strokeLinecap="round"
                  pathLength="100"
                  strokeDasharray={`${length} ${100 - length}`}
                  strokeDashoffset={offset}
                />
              ))}
            </svg>
          )}
          <div className="absolute inset-0 grid place-items-center text-xs leading-tight font-semibold">
            {center}
          </div>
        </div>
        <div className={cn("min-w-0", chartVariant === "recharts" && "pl-1")}>
          {details ? (
            <div className="grid">
              {details.map((detail, index) => (
                <div key={index} className="grid">
                  {index > 0 ? (
                    <Separator data-testid="dashboard-detail-separator" />
                  ) : null}
                  <div className={cn("py-1.5 text-xs", detailsTextClassName)}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">
                        {detail.label}
                      </span>
                      {detail.value !== null && detail.value !== undefined ? (
                        <span className="font-semibold">{detail.value}</span>
                      ) : null}
                    </div>
                    {secondaryDetailsByIndex?.[index] ??
                      (index === secondaryDetailsIndex
                        ? secondaryDetails
                        : null)}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {notice}
        </div>
      </div>
    </section>
  );
}

function OpenDateBadges({
  copy = tmsWorkspaceCopy,
  openDays,
  reason,
  testId = "timesheet-open-date-badges",
}: {
  openDays: { dayOfMonth: number; hours: number; weekdayLabel: string }[];
  copy?: TmsWorkspaceCopy;
  reason?: string;
  testId?: string;
}) {
  if (openDays.length === 0) {
    return null;
  }

  const badgeTone = reason
    ? "border-warning-accent bg-warning-subtle text-foreground"
    : "border-success-accent bg-success-subtle text-foreground";

  return (
    <div
      data-testid={testId}
      className="timesheet-open-date-badges mt-1 grid gap-x-1 gap-y-1"
    >
      {openDays.map((day) => {
        const filledLabel = reason
          ? `${reason} · ${day.hours.toFixed(1)}h ${copy.filled}`
          : `${day.hours.toFixed(1)}h ${copy.filled}`;
        return (
          <Tooltip key={`${day.dayOfMonth}-${day.weekdayLabel}`}>
            <TooltipTrigger
              render={
                <span
                  aria-label={`${day.dayOfMonth} ${day.weekdayLabel}, ${filledLabel}`}
                  className={cn(
                    "w-full whitespace-nowrap rounded border px-0.5 text-center text-xs font-semibold leading-3",
                    badgeTone
                  )}
                />
              }
            >
              {day.dayOfMonth} {day.weekdayLabel}
            </TooltipTrigger>
            <TooltipContent>{filledLabel}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function HourCell({
  approvalState,
  disabled,
  max,
  hoursLabel = tmsWorkspaceCopy.hours,
  onChange,
  returned,
  type,
  value,
}: {
  approvalState?: "approved" | "modified" | null;
  disabled: boolean;
  max: number;
  hoursLabel?: string;
  onChange: (value: string) => void;
  returned: boolean;
  type: TimesheetType;
  value: number;
}) {
  const hasValue = value > 0;

  return (
    <HoursInput
      aria-label={hoursLabel}
      disabled={disabled}
      max={max}
      value={value}
      onChange={onChange}
      className={cn(
        "mx-auto h-6 w-[38px] rounded-md px-0 text-center text-[0.7rem] font-semibold [appearance:textfield] disabled:border-transparent disabled:bg-transparent disabled:text-muted-foreground [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        hasValue
          ? hourValueClass(type)
          : "border-input bg-background text-foreground",
        returned && "border-destructive/50 bg-destructive/15 text-destructive",
        approvalState === "approved" &&
          "disabled:text-success disabled:opacity-100",
        approvalState === "modified" &&
          "disabled:text-info disabled:opacity-100",
        returned && "disabled:text-destructive"
      )}
    />
  );
}

function hourValueClass(type: TimesheetType) {
  if (type === "Leave") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }
  if (type === "Non-Chargeable") {
    return "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300";
  }
  return "border-primary/30 bg-primary/10 text-primary";
}

export function daySurfaceClass(day: Pick<PeriodDay, "isWorkday">) {
  return day.isWorkday
    ? "bg-muted/80 text-foreground"
    : "bg-card text-muted-foreground";
}

function totalFromSegments(segments: { value: number }[]) {
  return segments.reduce((sum, item) => sum + item.value, 0);
}

export function formatPeriodHours(value: number) {
  if (Number.isInteger(value * 10)) {
    return value.toFixed(1);
  }
  return value.toFixed(2).replace(/0$/, "");
}

function GroupedFilterSelect({
  className,
  icon,
  label,
  onValueChange,
  options,
  value,
}: {
  className?: string;
  icon?: React.ReactNode;
  label: string;
  onValueChange: (value: string | null) => void;
  options: { value: string; label: string }[];
  value: string;
}) {
  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? value;

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        label={label}
        size="sm"
        className={cn("cursor-pointer", className)}
      >
        <SelectValue>
          <span className="flex min-w-0 items-center gap-2">
            {icon}
            <span className="truncate">{selectedLabel}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} className="max-h-none">
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="grid gap-1 text-[0.72rem] font-medium text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function HeaderCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "h-8 border-r border-border px-1.5 text-left font-semibold last:border-r-0",
        className
      )}
    >
      {children}
    </th>
  );
}

export function BodyCell({
  children,
  className,
  "data-testid": dataTestId,
  "data-review-cell-state": reviewCellState,
}: {
  children: React.ReactNode;
  className?: string;
  "data-testid"?: string;
  "data-review-cell-state"?: string;
}) {
  return (
    <td
      data-testid={dataTestId}
      data-review-cell-state={reviewCellState}
      className={cn(
        "h-7 overflow-hidden border-r border-border px-1.5 text-ellipsis whitespace-nowrap last:border-r-0",
        className
      )}
    >
      {children}
    </td>
  );
}

function DetailsPill({
  details,
  locale = "en-US",
  type,
}: {
  details: TimesheetDetails;
  locale?: TmsLocale;
  type: TimesheetType;
}) {
  return (
    <span
      data-timesheet-detail={details}
      className={cn(
        "inline-flex h-5 items-center whitespace-nowrap rounded-full border px-2 text-[0.7rem] font-medium",
        details === "Normal" && "border-primary/20 bg-primary/10 text-primary",
        details === "OT" && "border-primary bg-primary text-primary-foreground",
        details === "Absent" &&
          "border-warning-accent bg-warning-subtle text-foreground",
        type === "Non-Chargeable" &&
          "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
        type === "Leave" &&
          "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300"
      )}
    >
      {getTimesheetDetailsLabel(details, locale)}
    </span>
  );
}
