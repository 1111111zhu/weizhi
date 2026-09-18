/**
 * Hong Kong General Holidays published by GovHK. The budget planner deliberately
 * keeps this data local so workday indicators remain deterministic and usable
 * without a third-party calendar service. Add a year only after it is gazetted.
 */
export const CMP_HONG_KONG_PUBLIC_HOLIDAYS: Readonly<
  Record<number, readonly string[]>
> = {
  2025: [
    "2025-01-01",
    "2025-01-29",
    "2025-01-30",
    "2025-01-31",
    "2025-04-04",
    "2025-04-18",
    "2025-04-19",
    "2025-04-21",
    "2025-05-01",
    "2025-05-05",
    "2025-05-31",
    "2025-07-01",
    "2025-10-01",
    "2025-10-07",
    "2025-10-29",
    "2025-12-25",
    "2025-12-26",
  ],
  2026: [
    "2026-01-01",
    "2026-02-17",
    "2026-02-18",
    "2026-02-19",
    "2026-04-03",
    "2026-04-04",
    "2026-04-06",
    "2026-04-07",
    "2026-05-01",
    "2026-05-25",
    "2026-06-19",
    "2026-07-01",
    "2026-09-26",
    "2026-10-01",
    "2026-10-19",
    "2026-12-25",
    "2026-12-26",
  ],
  2027: [
    "2027-01-01",
    "2027-02-06",
    "2027-02-08",
    "2027-02-09",
    "2027-03-26",
    "2027-03-27",
    "2027-03-29",
    "2027-04-05",
    "2027-05-01",
    "2027-05-13",
    "2027-06-09",
    "2027-07-01",
    "2027-09-16",
    "2027-10-01",
    "2027-10-08",
    "2027-12-25",
    "2027-12-27",
  ],
};

export type CmpHongKongWorkdaySummary = {
  workdays: number;
  leaveDays: number;
};

export function getCmpHongKongWorkdaySummary(
  dateFrom?: string | null,
  dateTo?: string | null
): CmpHongKongWorkdaySummary | null {
  if (!dateFrom || !dateTo) {
    return null;
  }
  const from = parseIsoDate(dateFrom);
  const to = parseIsoDate(dateTo);
  if (!from || !to || from > to) {
    return null;
  }

  const startYear = from.getUTCFullYear();
  const endYear = to.getUTCFullYear();
  for (let year = startYear; year <= endYear; year += 1) {
    if (!CMP_HONG_KONG_PUBLIC_HOLIDAYS[year]) {
      return null;
    }
  }

  const holidays = new Set(
    Array.from(
      { length: endYear - startYear + 1 },
      (_, index) => CMP_HONG_KONG_PUBLIC_HOLIDAYS[startYear + index] ?? []
    ).flat()
  );
  const cursor = new Date(from);
  const endTime = to.getTime();
  let leaveDays = 0;
  let workdays = 0;
  while (cursor.getTime() <= endTime) {
    const dayOfWeek = cursor.getUTCDay();
    const isoDate = cursor.toISOString().slice(0, 10);
    if (dayOfWeek === 0 || dayOfWeek === 6 || holidays.has(isoDate)) {
      leaveDays += 1;
    } else {
      workdays += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return { workdays, leaveDays };
}

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
