import {
  CMP_BUDGET_CURRENCIES,
  TMS_NORMAL_DAILY_HOURS_ERROR_MESSAGE,
  TMS_NORMAL_DAILY_HOURS_MAX,
} from "@project-wing/shared";
import type {
  CmpBudgetCurrency,
  TmsEngagementDirectoryItem,
  TmsEngagementTimesheetAccessReason,
} from "@project-wing/shared";

export type PeriodKey = "all" | "first" | "second";

export const DETAILS_BY_TYPE = {
  Chargeable: ["Normal", "OT", "Absent"],
  "Non-Chargeable": [
    "Internal Admin",
    "Business Development",
    "HR Function",
    "Idle or Unassigned",
    "Internal Event",
    "Technical & Training Dept Only",
    "Marketing",
    "Internal Training",
    "Others PRC Training",
    "PRC Training",
    "Resignation",
    "Others",
  ],
  Leave: [
    "Annual Leave",
    "Examination Leave",
    "O.T. Leave",
    "No Pay Leave",
    "Special Leave",
    "Public Holiday",
    "Sick Leave",
    "Study Leave",
  ],
} as const;

export type TimesheetType = keyof typeof DETAILS_BY_TYPE;
export type ChargeableDetails = (typeof DETAILS_BY_TYPE.Chargeable)[number];
export type NonChargeableDetails =
  (typeof DETAILS_BY_TYPE)["Non-Chargeable"][number];
export type LeaveDetails = (typeof DETAILS_BY_TYPE.Leave)[number];
export type TimesheetDetails =
  | ChargeableDetails
  | NonChargeableDetails
  | LeaveDetails;

export type TimesheetWorkType = "Normal" | "OT" | "Absent";

export const WORK_TYPES_BY_TYPE = {
  Chargeable: ["Normal", "OT"],
  "Non-Chargeable": ["Normal", "OT"],
  Leave: ["Normal"],
} as const;

const LEGACY_NON_CHARGEABLE_DETAILS: Record<string, NonChargeableDetails> = {
  Admin: "Internal Admin",
  Marketing: "Marketing",
  Outing: "Others",
  Training: "Internal Training",
};
const LEGACY_LEAVE_DETAILS: Record<string, LeaveDetails> = {
  "Annual leave": "Annual Leave",
  "Non-pay leave": "No Pay Leave",
  "Sick leave": "Sick Leave",
  "Special leave": "Special Leave",
  "Study leave": "Study Leave",
};

export const TIMESHEET_TYPES = [
  "Chargeable",
  "Non-Chargeable",
  "Leave",
] as const;

const TMS_DEMO_MONTH = 7;
const TMS_DEMO_YEAR = 2026;
const DEMO_ENGAGEMENT_CODES = new Set([
  "100204",
  "200118",
  "300672",
  "400091",
  "500314",
  "600527",
]);

export type PeriodDay = {
  date: string;
  dayOfMonth: number;
  label: string;
  weekdayLabel: string;
  isWorkday: boolean;
};

export type Engagement = {
  engagementId: string;
  source?: "ENGAGEMENT" | "UNLINKED_PROJECT" | "TMS_PENDING";
  projectId?: string | null;
  projectCode?: string | null;
  projectName?: string | null;
  engagementCode: string;
  clientCode: string;
  clientName: string;
  budgetedHours: string;
  agreedFee: string;
  recoveryRate: string | null;
  feeCurrency: CmpBudgetCurrency;
  pic: string | null;
  mic: string | null;
  codeAliases: string[];
  timesheetAccess: {
    allowed: boolean;
    reason: TmsEngagementTimesheetAccessReason;
  };
};

type TimesheetRowBase = {
  id: string;
  periodScope: PeriodKey;
  workType?: TimesheetWorkType;
  description: string;
  hoursByDate: Record<string, number>;
  periodTotal: number;
  approvalOriginalHoursByDate?: Record<string, number>;
};

export type ChargeableRow = TimesheetRowBase &
  Engagement & {
    type: "Chargeable";
    details: ChargeableDetails;
  };

export type NonChargeableRow = TimesheetRowBase & {
  type: "Non-Chargeable";
  details: NonChargeableDetails;
};

export type LeaveRow = TimesheetRowBase & {
  type: "Leave";
  details: LeaveDetails;
};

export type TimesheetRow = ChargeableRow | NonChargeableRow | LeaveRow;

export function createPendingTmsEngagement(): Engagement {
  return {
    engagementId: "",
    source: "TMS_PENDING",
    projectId: null,
    projectCode: null,
    projectName: null,
    engagementCode: "",
    clientCode: "",
    clientName: "",
    budgetedHours: "",
    agreedFee: "",
    recoveryRate: null,
    feeCurrency: "HKD",
    pic: null,
    mic: null,
    codeAliases: [],
    timesheetAccess: { allowed: true, reason: "ALLOWED" },
  };
}

export type AddTimesheetRowInput =
  | {
      id: string;
      periodScope: PeriodKey;
      description?: string;
      type: "Chargeable";
      workType?: TimesheetWorkType;
      details: ChargeableDetails;
      engagement: Engagement;
    }
  | {
      id: string;
      periodScope: PeriodKey;
      description?: string;
      type: "Non-Chargeable";
      workType?: TimesheetWorkType;
      details: NonChargeableDetails;
    }
  | {
      id: string;
      periodScope: PeriodKey;
      description?: string;
      type: "Leave";
      workType?: TimesheetWorkType;
      details: LeaveDetails;
    };

export type ValidationMessage = {
  date: string;
  severity: "warning" | "error";
  message: string;
};

export type DailyHoursSummary = PeriodDay & {
  chargeable: number;
  nonChargeable: number;
  leave: number;
  normal: number;
  overtime: number;
  regularTotal: number;
  isHoliday: boolean;
  explainedTotal: number;
  total: number;
};

export function toEngagement(item: TmsEngagementDirectoryItem): Engagement {
  return {
    engagementId: item.id,
    source: item.source ?? "ENGAGEMENT",
    projectId: item.projectId ?? null,
    projectCode: item.projectCode ?? null,
    projectName: item.projectName ?? null,
    engagementCode: item.engagementCode,
    clientCode: item.clientCode,
    clientName: item.clientName,
    budgetedHours: item.budgetedHours,
    agreedFee: item.agreedFee,
    recoveryRate: item.recoveryRate,
    feeCurrency: item.feeCurrency,
    pic: item.pic,
    mic: item.mic,
    codeAliases: item.codeAliases,
    timesheetAccess: item.timesheetAccess,
  };
}

export function timesheetAccessError(
  reason: TmsEngagementTimesheetAccessReason
) {
  return `Timesheet access denied: ${reason}`;
}

export function isTmsDemoPeriod(
  year: number,
  month: number,
  period: PeriodKey
) {
  return (
    year === TMS_DEMO_YEAR && month === TMS_DEMO_MONTH && period !== "second"
  );
}

export function isChargeableRow(row: TimesheetRow): row is ChargeableRow {
  return row.type === "Chargeable";
}

export function getTimesheetWorkType(
  row: Pick<TimesheetRow, "type" | "details" | "workType">
): TimesheetWorkType {
  if (row.type === "Leave") {
    return "Normal";
  }

  if (row.type === "Chargeable" && row.workType === "Absent") {
    return row.workType;
  }

  const allowedWorkTypes: readonly string[] = WORK_TYPES_BY_TYPE[row.type];
  if (row.workType && allowedWorkTypes.includes(row.workType)) {
    return row.workType;
  }

  if (
    row.type === "Chargeable" &&
    (row.details === "Normal" ||
      row.details === "OT" ||
      row.details === "Absent")
  ) {
    return row.details;
  }

  return "Normal";
}

export function isDemoTimesheetRow(row: TimesheetRow) {
  return isChargeableRow(row) && DEMO_ENGAGEMENT_CODES.has(row.engagementCode);
}

export function buildPeriodDays(
  year: number,
  month: number,
  period: PeriodKey
): PeriodDay[] {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const start = period === "second" ? 16 : 1;
  const end = period === "first" ? 15 : lastDay;

  return Array.from({ length: end - start + 1 }, (_, index) => {
    const dayOfMonth = start + index;
    const date = new Date(Date.UTC(year, month - 1, dayOfMonth));
    const weekday = date.getUTCDay();

    return {
      date: formatDateKey(date),
      dayOfMonth,
      label: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      weekdayLabel: date.toLocaleDateString("en-US", {
        weekday: "short",
        timeZone: "UTC",
      }),
      isWorkday: weekday >= 1 && weekday <= 5,
    };
  });
}

export function createInitialRows(
  _year: number,
  _month: number,
  _period: PeriodKey,
  _options: { seedDemoHours?: boolean } = {}
): TimesheetRow[] {
  return [];
}

export function createTimesheetRowId() {
  return crypto.randomUUID();
}

function readWorkType(value: unknown): TimesheetWorkType | undefined {
  return value === "Normal" || value === "OT" || value === "Absent"
    ? value
    : undefined;
}

function normalizeWorkType(
  type: TimesheetType,
  requested: TimesheetWorkType | undefined,
  details: TimesheetDetails
): TimesheetWorkType {
  if (type === "Leave") {
    return "Normal";
  }

  if (type === "Chargeable" && requested === "Absent") {
    return requested;
  }

  const allowedWorkTypes: readonly string[] = WORK_TYPES_BY_TYPE[type];
  if (requested && allowedWorkTypes.includes(requested)) {
    return requested;
  }

  if (
    type === "Chargeable" &&
    (details === "Normal" || details === "OT" || details === "Absent")
  ) {
    return details;
  }

  return "Normal";
}

export function addTimesheetRow(
  rows: TimesheetRow[],
  input: AddTimesheetRowInput
): TimesheetRow[] {
  const base = {
    id: input.id,
    periodScope: input.periodScope,
    description: input.description ?? "",
    hoursByDate: {},
    periodTotal: 0,
  };

  if (input.type === "Chargeable") {
    if (!input.engagement.timesheetAccess.allowed) {
      throw new Error(
        timesheetAccessError(input.engagement.timesheetAccess.reason)
      );
    }
    if (findDuplicateChargeableRow(rows, input)) {
      return rows;
    }
    return [
      ...rows,
      {
        ...input.engagement,
        ...base,
        type: "Chargeable",
        workType: normalizeWorkType(input.type, input.workType, input.details),
        details: input.details,
      },
    ];
  }

  if (input.type === "Non-Chargeable") {
    return [
      ...rows,
      {
        ...base,
        type: "Non-Chargeable",
        workType: normalizeWorkType(input.type, input.workType, input.details),
        details: input.details,
      },
    ];
  }

  return [
    ...rows,
    {
      ...base,
      type: "Leave",
      workType: normalizeWorkType(input.type, input.workType, input.details),
      details: input.details,
    },
  ];
}

export function findDuplicateChargeableRow(
  rows: TimesheetRow[],
  input: Extract<AddTimesheetRowInput, { type: "Chargeable" }>
) {
  const inputProjectKey =
    input.engagement.projectId || input.engagement.engagementId;
  if (!inputProjectKey) {
    return;
  }

  return rows.find(
    (row): row is ChargeableRow =>
      isChargeableRow(row) &&
      row.periodScope === input.periodScope &&
      (row.projectId || row.engagementId) === inputProjectKey &&
      getTimesheetWorkType(row) ===
        normalizeWorkType(input.type, input.workType, input.details)
  );
}

export function deleteTimesheetRows(
  rows: TimesheetRow[],
  selectedIds: Set<string>
) {
  return rows.filter((row) => !selectedIds.has(row.id));
}

export function filterTimesheetRowsByDays(
  rows: TimesheetRow[],
  days: PeriodDay[]
) {
  const dates = new Set(days.map((day) => day.date));
  return rows.map((row) =>
    withTotals({
      ...row,
      hoursByDate: pickDates(dates, row.hoursByDate),
    })
  );
}

export function mergeTimesheetRows(...rowSets: TimesheetRow[][]) {
  const merged = new Map<string, TimesheetRow>();

  for (const rows of rowSets) {
    for (const row of rows) {
      const current = merged.get(row.id);
      merged.set(
        row.id,
        withTotals({
          ...current,
          ...row,
          hoursByDate: {
            ...current?.hoursByDate,
            ...row.hoursByDate,
          },
        } as TimesheetRow)
      );
    }
  }

  return [...merged.values()];
}

export function updateTimesheetHours(
  rows: TimesheetRow[],
  rowId: string,
  date: string,
  hours: number
) {
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
    return rows;
  }

  const targetRow = rows.find((row) => row.id === rowId);
  if (
    !targetRow ||
    (isChargeableRow(targetRow) &&
      !isDemoTimesheetRow(targetRow) &&
      targetRow.timesheetAccess?.allowed !== true)
  ) {
    return rows;
  }
  if (
    getTimesheetWorkType(targetRow) === "Normal" &&
    hours > TMS_NORMAL_DAILY_HOURS_MAX
  ) {
    return rows;
  }

  return rows.map((row) => {
    if (row.id !== rowId) {
      return row;
    }

    const hoursByDate = { ...row.hoursByDate };
    if (hours === 0) {
      const { [date]: _removedHours, ...remainingHoursByDate } = hoursByDate;
      return withTotals({ ...row, hoursByDate: remainingHoursByDate });
    }
    hoursByDate[date] = hours;

    return withTotals({ ...row, hoursByDate });
  });
}

export function timesheetHourValidationMessage(
  row: Pick<TimesheetRow, "type" | "details" | "workType">,
  date: string,
  hours: number
) {
  if (
    getTimesheetWorkType(row) === "Normal" &&
    hours > TMS_NORMAL_DAILY_HOURS_MAX
  ) {
    return `${TMS_NORMAL_DAILY_HOURS_ERROR_MESSAGE}（${date}）`;
  }
  return null;
}

export function updateTimesheetDescription(
  rows: TimesheetRow[],
  rowId: string,
  description: string
) {
  return rows.map((row) => (row.id === rowId ? { ...row, description } : row));
}

export function calculateDailyHours(
  rows: TimesheetRow[],
  days: PeriodDay[]
): DailyHoursSummary[] {
  return days.map((day) => {
    let chargeable = 0;
    let explainedTotal = 0;
    let isPublicHoliday = false;
    let leave = 0;
    let nonChargeable = 0;
    let normal = 0;
    let overtime = 0;

    for (const row of rows) {
      const hours = row.hoursByDate[day.date] ?? 0;
      explainedTotal += hours;
      const workType = getTimesheetWorkType(row);
      if (row.type === "Chargeable") {
        if (workType === "Absent") {
          continue;
        }
        chargeable += hours;
      } else if (row.type === "Non-Chargeable") {
        nonChargeable += hours;
      } else {
        leave += hours;
        if (row.details === "Public Holiday" && hours > 0) {
          isPublicHoliday = true;
        }
      }

      if (workType === "OT") {
        overtime += hours;
      } else {
        normal += hours;
      }
    }

    return {
      ...day,
      chargeable,
      nonChargeable,
      leave,
      normal,
      overtime,
      regularTotal: normal,
      isHoliday: !day.isWorkday || isPublicHoliday,
      explainedTotal,
      total: chargeable + nonChargeable + leave,
    };
  });
}

export function calculateDashboard(rows: TimesheetRow[], days: PeriodDay[]) {
  const dailyHours = calculateDailyHours(rows, days);
  const workdays = dailyHours.filter((day) => day.isWorkday);
  const openDays = workdays
    .map((day) => ({ ...day, hours: day.explainedTotal }))
    .filter((day) => day.explainedTotal < 8);
  const completed = workdays.length - openDays.length;
  const completion = {
    completed,
    open: workdays.length - completed,
    openDays,
    target: workdays.length,
  };

  return {
    completion,
    progressPercent: completion.target
      ? Math.round((completion.completed / completion.target) * 100)
      : 0,
    dailyHours,
  };
}

export function validateTimesheet(
  rows: TimesheetRow[],
  days: PeriodDay[]
): ValidationMessage[] {
  const cellMessages = rows.flatMap<ValidationMessage>((row) =>
    days.flatMap<ValidationMessage>((day) => {
      const message = timesheetHourValidationMessage(
        row,
        day.date,
        row.hoursByDate[day.date] ?? 0
      );
      return message
        ? [{ date: day.date, severity: "error" as const, message }]
        : [];
    })
  );
  const dailyMessages = calculateDailyHours(
    rows,
    days
  ).flatMap<ValidationMessage>((day) => {
    if (day.regularTotal > TMS_NORMAL_DAILY_HOURS_MAX) {
      return [
        {
          date: day.date,
          severity: "error" as const,
          message: `${day.label} Normal + Leave is ${formatHours(day.regularTotal)}. Normal 工时和休假每天不能超过 8 小时，请将超出部分记入 OT。`,
        },
      ];
    }
    if (day.total > 24) {
      return [
        {
          date: day.date,
          severity: "error" as const,
          message: `${day.label} has ${formatHours(day.total)} counted hours. A day cannot exceed 24 hours.`,
        },
      ];
    }
    if (day.isWorkday && !day.isHoliday && (day.total < 8 || day.total > 12)) {
      return [
        {
          date: day.date,
          severity: "warning" as const,
          message: `${day.label} has ${formatHours(day.total)} counted hours. Non-holiday workdays should have between 8 and 12 hours.`,
        },
      ];
    }
    return [];
  });
  return [...cellMessages, ...dailyMessages];
}

export function findEngagement(
  engagementCode: string,
  engagementDirectory: Engagement[]
) {
  const normalized = engagementCode.trim().toUpperCase();
  return engagementDirectory.find(
    (item) =>
      item.engagementCode.toUpperCase() === normalized ||
      item.codeAliases.some((alias) => alias.toUpperCase() === normalized)
  );
}

export function syncRowsWithEngagementDirectory(
  rows: TimesheetRow[],
  engagementDirectory: Engagement[]
): TimesheetRow[] {
  const engagementById = new Map(
    engagementDirectory.map((engagement) => [
      engagement.engagementId,
      engagement,
    ])
  );
  const engagementByProjectId = new Map(
    engagementDirectory
      .filter((engagement) => engagement.projectId)
      .map((engagement) => [engagement.projectId as string, engagement])
  );

  let changed = false;
  const nextRows = rows.map((row) => {
    if (!isChargeableRow(row) || isDemoTimesheetRow(row)) {
      return row;
    }

    const engagement =
      (row.projectId ? engagementByProjectId.get(row.projectId) : undefined) ??
      (row.engagementId ? engagementById.get(row.engagementId) : undefined) ??
      findEngagement(row.engagementCode, engagementDirectory);
    if (!engagement || engagementMatchesRow(row, engagement)) {
      return row;
    }

    changed = true;
    return withTotals({ ...row, ...engagement });
  });

  return changed ? nextRows : rows;
}

export function migrateTimesheetRows(
  rows: unknown[],
  fallbackPeriod: PeriodKey
): TimesheetRow[] {
  const migrated = rows.flatMap<TimesheetRow>((value) => {
    if (!isRecord(value)) {
      return [];
    }

    const hoursByDate = readHours(value.hoursByDate);
    const periodScope = readPeriodScope(
      value.periodScope,
      hoursByDate,
      fallbackPeriod
    );
    const common = {
      id: typeof value.id === "string" ? value.id : createTimesheetRowId(),
      periodScope,
      description:
        typeof value.description === "string" ? value.description : "",
      hoursByDate,
      periodTotal: sumHours(hoursByDate),
    };

    if (value.type === "Chargeable") {
      const details = isOneOf(value.details, DETAILS_BY_TYPE.Chargeable)
        ? value.details
        : "Normal";
      return [
        {
          ...readEngagement(value),
          ...common,
          type: "Chargeable",
          workType: normalizeWorkType(
            "Chargeable",
            readWorkType(value.workType),
            details
          ),
          details,
        },
      ];
    }
    if (value.type === "Non-Chargeable") {
      const details = isOneOf(value.details, DETAILS_BY_TYPE["Non-Chargeable"])
        ? value.details
        : typeof value.details === "string"
          ? (LEGACY_NON_CHARGEABLE_DETAILS[value.details] ?? "Internal Admin")
          : "Internal Admin";
      return [
        {
          ...common,
          type: "Non-Chargeable",
          workType: normalizeWorkType(
            "Non-Chargeable",
            readWorkType(value.workType),
            details
          ),
          details,
        },
      ];
    }
    if (value.type === "Leave") {
      const details = isOneOf(value.details, DETAILS_BY_TYPE.Leave)
        ? value.details
        : typeof value.details === "string"
          ? (LEGACY_LEAVE_DETAILS[value.details] ?? "Annual Leave")
          : "Annual Leave";
      return [
        {
          ...common,
          type: "Leave",
          workType: "Normal",
          details,
        },
      ];
    }
    if (isOneOf(value.type, DETAILS_BY_TYPE.Chargeable)) {
      return [
        {
          ...readEngagement(value),
          ...common,
          type: "Chargeable",
          workType: value.type,
          details: value.type,
        },
      ];
    }
    return [];
  });
  return mergeTimesheetRows(migrated);
}

function engagementMatchesRow(row: ChargeableRow, engagement: Engagement) {
  return (
    row.engagementCode === engagement.engagementCode &&
    row.clientCode === engagement.clientCode &&
    row.clientName === engagement.clientName &&
    row.budgetedHours === engagement.budgetedHours &&
    row.agreedFee === engagement.agreedFee &&
    row.recoveryRate === engagement.recoveryRate &&
    row.feeCurrency === engagement.feeCurrency &&
    row.pic === engagement.pic &&
    row.mic === engagement.mic &&
    row.timesheetAccess?.allowed === engagement.timesheetAccess.allowed &&
    row.timesheetAccess?.reason === engagement.timesheetAccess.reason &&
    row.source === engagement.source &&
    row.projectId === engagement.projectId &&
    row.projectCode === engagement.projectCode &&
    row.projectName === engagement.projectName
  );
}

function readEngagement(value: Record<string, unknown>): Engagement {
  return {
    engagementId: readString(value.engagementId),
    source:
      value.source === "UNLINKED_PROJECT"
        ? "UNLINKED_PROJECT"
        : value.source === "TMS_PENDING"
          ? "TMS_PENDING"
          : "ENGAGEMENT",
    projectId: typeof value.projectId === "string" ? value.projectId : null,
    projectCode:
      typeof value.projectCode === "string" ? value.projectCode : null,
    projectName:
      typeof value.projectName === "string" ? value.projectName : null,
    engagementCode: readString(value.engagementCode),
    clientCode: readString(value.clientCode),
    clientName: readString(value.clientName),
    budgetedHours: readString(value.budgetedHours),
    agreedFee: readString(value.agreedFee),
    recoveryRate:
      typeof value.recoveryRate === "string" ? value.recoveryRate : null,
    feeCurrency: CMP_BUDGET_CURRENCIES.includes(
      value.feeCurrency as CmpBudgetCurrency
    )
      ? (value.feeCurrency as CmpBudgetCurrency)
      : "HKD",
    pic: typeof value.pic === "string" ? value.pic : null,
    mic: typeof value.mic === "string" ? value.mic : null,
    codeAliases: Array.isArray(value.codeAliases)
      ? value.codeAliases.filter(
          (alias): alias is string => typeof alias === "string"
        )
      : [],
    timesheetAccess: readTimesheetAccess(value.timesheetAccess),
  };
}

function readTimesheetAccess(value: unknown): Engagement["timesheetAccess"] {
  if (isRecord(value) && typeof value.allowed === "boolean") {
    return {
      allowed: value.allowed,
      reason:
        typeof value.reason === "string"
          ? (value.reason as TmsEngagementTimesheetAccessReason)
          : "ALLOWED",
    };
  }
  return { allowed: true, reason: "ALLOWED" };
}

function readPeriodScope(
  value: unknown,
  hoursByDate: Record<string, number>,
  fallback: PeriodKey
): PeriodKey {
  if (value === "all" || value === "first" || value === "second") {
    return value;
  }
  const halves = new Set(
    Object.keys(hoursByDate).map((date) =>
      Number(date.slice(-2)) <= 15 ? "first" : "second"
    )
  );
  if (halves.size === 2) {
    return "all";
  }
  return halves.values().next().value ?? fallback;
}

function readHours(value: unknown) {
  if (!isRecord(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === "number" && Number.isFinite(entry[1])
    )
  );
}

function withTotals<T extends TimesheetRow>(row: T): T {
  return { ...row, periodTotal: sumHours(row.hoursByDate) };
}

function sumHours(hoursByDate: Record<string, number>) {
  return Object.values(hoursByDate).reduce((total, hours) => total + hours, 0);
}

function pickDates(
  periodDates: Set<string>,
  hoursByDate: Record<string, number>
) {
  return Object.fromEntries(
    Object.entries(hoursByDate).filter(([date]) => periodDates.has(date))
  );
}

function formatDateKey(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function formatHours(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOneOf<const T extends readonly string[]>(
  value: unknown,
  values: T
): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
