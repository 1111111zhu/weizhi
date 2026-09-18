import type {
  CmpEngagementFeePlanAssignmentType,
  CmpEngagementFeePlanGrade,
} from "@project-wing/shared";

export type CmpFeePlanningFormLine = {
  key: string;
  grade: CmpEngagementFeePlanGrade | "";
  assignmentType: CmpEngagementFeePlanAssignmentType | "";
  staffUserId: string;
  hourlyRate: string;
  budgetHours: string;
  dateFrom: string;
  dateTo: string;
};

export type CmpFeePlanningTotals = {
  totalHours: number;
  standardValue: number;
};

export function calculateFeePlanningTotals(
  lines: readonly Pick<CmpFeePlanningFormLine, "hourlyRate" | "budgetHours">[]
): CmpFeePlanningTotals {
  return lines.reduce<CmpFeePlanningTotals>(
    (totals, line) => {
      const budgetHours = Math.max(0, Number(line.budgetHours || 0));
      const hourlyRate = Math.max(0, Number(line.hourlyRate || 0));
      return {
        totalHours: totals.totalHours + budgetHours,
        standardValue: totals.standardValue + budgetHours * hourlyRate,
      };
    },
    { totalHours: 0, standardValue: 0 }
  );
}
