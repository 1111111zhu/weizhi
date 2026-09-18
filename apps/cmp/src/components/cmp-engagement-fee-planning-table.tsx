"use client";

import {
  CMP_ENGAGEMENT_FEE_PLAN_GRADE_RATES,
  validateCmpEngagementBudget,
} from "@project-wing/shared";
import type {
  CmpBudgetCurrency,
  CmpBudgetExchangeRateSnapshot,
  CmpEngagementFeePlanGrade,
  CmpEngagementFeePlanLine,
  CmpEngagementFeePlanLineInput,
} from "@project-wing/shared";
import { Button, ButtonGroup, Input } from "@project-wing/ui";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { DirectoryUser } from "../api/client";
import { useCmpI18n } from "../i18n/client";
import { CmpEngagementFeePlanningDataGrid } from "./cmp-engagement-fee-planning-data-grid";
import { calculateFeePlanningTotals } from "./cmp-engagement-fee-planning-model";
import type { CmpFeePlanningFormLine } from "./cmp-engagement-fee-planning-model";
import { CmpEngagementFeePlanningSummaryDataGrid } from "./cmp-engagement-fee-planning-summary-data-grid";

const EMPTY_DIRECTORY_USERS: DirectoryUser[] = [];

export type { CmpFeePlanningFormLine } from "./cmp-engagement-fee-planning-model";

export function createEmptyFeePlanningLine(): CmpFeePlanningFormLine {
  return {
    key: `fee-plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    grade: "",
    assignmentType: "",
    staffUserId: "",
    hourlyRate: "",
    budgetHours: "",
    dateFrom: "",
    dateTo: "",
  };
}

export function feePlanningLinesFromEngagement(
  lines: CmpEngagementFeePlanLine[] | undefined
): CmpFeePlanningFormLine[] {
  return (lines ?? []).map((line) => ({
    key: line.id,
    grade: line.grade,
    assignmentType: line.assignmentType,
    staffUserId: line.staff?.id ?? "",
    hourlyRate: line.hourlyRate,
    budgetHours: line.budgetHours,
    dateFrom: line.dateFrom ?? "",
    dateTo: line.dateTo ?? "",
  }));
}

export { calculateFeePlanningTotals } from "./cmp-engagement-fee-planning-model";

export function deriveFeePlanningBudget(
  lines: readonly CmpFeePlanningFormLine[],
  agreedFee: string
) {
  const totals = calculateFeePlanningTotals(lines);
  const parsedAgreedFee = Number(agreedFee);
  const hasAgreedFee =
    agreedFee.trim() !== "" &&
    Number.isFinite(parsedAgreedFee) &&
    parsedAgreedFee >= 0;
  return {
    ...totals,
    budgetedHours: totals.totalHours > 0 ? totals.totalHours.toFixed(2) : "",
    recoveryRate:
      hasAgreedFee && totals.standardValue > 0
        ? ((parsedAgreedFee / totals.standardValue) * 100).toFixed(2)
        : "",
    effectiveHourlyRate:
      hasAgreedFee && totals.totalHours > 0
        ? parsedAgreedFee / totals.totalHours
        : null,
  };
}

export function isFeePlanningLineBlank(line: CmpFeePlanningFormLine) {
  return !line.grade && !line.assignmentType && !line.budgetHours;
}

export function feePlanningLinesForDraft(lines: CmpFeePlanningFormLine[]) {
  return lines
    .filter((line) => !isFeePlanningLineBlank(line))
    .map((line, index) => ({
      key: line.key,
      grade: line.grade || undefined,
      assignmentType: line.assignmentType || undefined,
      staffUserId: line.staffUserId || undefined,
      hourlyRate: line.hourlyRate,
      budgetHours: line.budgetHours,
      dateFrom: line.dateFrom,
      dateTo: line.dateTo,
      sortOrder: index,
    }));
}

export function feePlanningLinesForSubmission(
  lines: CmpFeePlanningFormLine[]
): CmpEngagementFeePlanLineInput[] {
  return lines
    .filter((line) => !isFeePlanningLineBlank(line))
    .map((line, index) => ({
      key: line.key,
      grade: line.grade as CmpEngagementFeePlanGrade,
      assignmentType: line.assignmentType as "STAFF" | "TBC",
      staffUserId: line.staffUserId || null,
      hourlyRate: line.hourlyRate,
      budgetHours: line.budgetHours,
      dateFrom: line.dateFrom,
      dateTo: line.dateTo,
      sortOrder: index,
    }));
}

function hourlyRate(grade: CmpEngagementFeePlanGrade | "", hkdPerUnit: number) {
  return grade && hkdPerUnit > 0
    ? (CMP_ENGAGEMENT_FEE_PLAN_GRADE_RATES[grade] / hkdPerUnit).toFixed(2)
    : "";
}

export function recalculateFeePlanningRates(
  lines: CmpFeePlanningFormLine[],
  currency: CmpBudgetCurrency,
  exchangeRate?: CmpBudgetExchangeRateSnapshot | null
) {
  const hkdPerUnit = currency === "HKD" ? 1 : Number(exchangeRate?.hkdPerUnit);
  return lines.map((line) => ({
    ...line,
    hourlyRate: hourlyRate(line.grade, hkdPerUnit),
  }));
}

export function CmpEngagementFeePlanningTable({
  value,
  onChange,
  currency = "HKD",
  exchangeRate,
  users = EMPTY_DIRECTORY_USERS,
  isPrivateClient = false,
  allowTbc = true,
  eligibleStaffIds,
  disabled = false,
  error,
}: {
  value: CmpFeePlanningFormLine[];
  onChange: (lines: CmpFeePlanningFormLine[]) => void;
  currency?: CmpBudgetCurrency;
  exchangeRate?: CmpBudgetExchangeRateSnapshot | null;
  users?: DirectoryUser[];
  isPrivateClient?: boolean;
  allowTbc?: boolean;
  eligibleStaffIds?: ReadonlySet<string>;
  disabled?: boolean;
  error?: string;
}) {
  const { dictionary, locale } = useCmpI18n();
  const copy = dictionary.workspace;
  const [expanded, setExpanded] = useState(value.length > 0);
  const [staffLineKey, setStaffLineKey] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [validationStale, setValidationStale] = useState(false);
  const hkdPerUnit = currency === "HKD" ? 1 : Number(exchangeRate?.hkdPerUnit);
  const rateAvailable = Number.isFinite(hkdPerUnit) && hkdPerUnit > 0;
  const staffLine = value.find((line) => line.key === staffLineKey) ?? null;
  const usedStaff = new Set(
    value
      .filter((line) => line.key !== staffLineKey)
      .map((line) => line.staffUserId)
      .filter(Boolean)
  );
  const markBudgetChanged = () => {
    if (showValidation) {
      setShowValidation(false);
      setValidationStale(true);
    }
  };
  const update = (key: string, patch: Partial<CmpFeePlanningFormLine>) => {
    markBudgetChanged();
    onChange(
      value.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  };
  const openFeePlanning = () => {
    setExpanded(true);
    if (value.length === 0) {
      onChange([createEmptyFeePlanningLine()]);
    }
  };
  const budgetValidation = validateCmpEngagementBudget({
    isPrivateClient,
    hkdPerUnit,
    lines: value.map((line) => ({
      grade: line.grade,
      hourlyRate: Number(line.hourlyRate || 0),
      budgetHours: Number(line.budgetHours || 0),
    })),
  });
  const [firstLine] = value;
  const addRow = () => {
    markBudgetChanged();
    onChange([
      ...value,
      {
        ...createEmptyFeePlanningLine(),
        dateFrom: firstLine?.dateFrom ?? "",
        dateTo: firstLine?.dateTo ?? "",
      },
    ]);
  };
  const updateDate = (
    key: string,
    field: "dateFrom" | "dateTo",
    nextValue: string
  ) => {
    markBudgetChanged();
    const isFirstLine = value[0]?.key === key;
    const next = value.map((line) =>
      line.key === key ? { ...line, [field]: nextValue } : line
    );
    if (isFirstLine && nextValue) {
      for (const line of next) {
        if (line.key !== key && !line[field]) {
          line[field] = nextValue;
        }
      }
    }
    onChange(next);
  };

  return (
    <section
      className="cmp-fee-planning cmp-form-span-full"
      aria-label={copy.feePlanningDetails}
    >
      <ButtonGroup>
        <Button
          type="button"
          variant="outline"
          onClick={expanded ? () => setExpanded(false) : openFeePlanning}
          disabled={disabled}
        >
          {value.length > 0
            ? copy.feePlanningEdit.replace("{count}", String(value.length))
            : copy.formEnterFeeAndHours}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || value.length === 0 || !rateAvailable}
          onClick={() => {
            setShowValidation(true);
            setValidationStale(false);
          }}
        >
          <CheckCircle2 className="size-4" />
          {copy.feePlanningValidate}
        </Button>
      </ButtonGroup>
      {currency !== "HKD" && !rateAvailable ? (
        <p className="cmp-field-error">{copy.feePlanningRateUnavailable}</p>
      ) : null}
      {exchangeRate?.stale ? (
        <p className="cmp-form-empty-note">
          {copy.feePlanningRateStale.replace(
            "{date}",
            new Date(exchangeRate.fetchedAt).toLocaleDateString(locale)
          )}
        </p>
      ) : null}
      {showValidation ? (
        <BudgetValidationSummary
          privateCostRule={budgetValidation.privateCostRule}
        />
      ) : null}
      {validationStale ? (
        <p className="cmp-form-empty-note">
          {copy.feePlanningValidationPending}
        </p>
      ) : null}
      {expanded ? (
        <>
          <CmpEngagementFeePlanningDataGrid
            value={value}
            currency={currency}
            hkdPerUnit={hkdPerUnit}
            rateAvailable={rateAvailable}
            disabled={disabled}
            onUpdate={update}
            onDelete={(key) => {
              markBudgetChanged();
              onChange(value.filter((item) => item.key !== key));
            }}
            onAdd={addRow}
            onOpenStaff={setStaffLineKey}
            staffNameById={new Map(users.map((user) => [user.id, user.name]))}
            onUpdateDate={updateDate}
          />
          {error ? <p className="cmp-field-error">{error}</p> : null}
        </>
      ) : null}
      <BudgetStaffDialog
        line={staffLine}
        users={users}
        usedStaff={usedStaff}
        allowTbc={allowTbc}
        eligibleStaffIds={eligibleStaffIds}
        open={Boolean(staffLine)}
        onOpenChange={(open) => !open && setStaffLineKey(null)}
        onChange={(patch) => staffLine && update(staffLine.key, patch)}
      />
    </section>
  );
}

function BudgetStaffDialog({
  line,
  users,
  usedStaff,
  allowTbc,
  eligibleStaffIds,
  open,
  onOpenChange,
  onChange,
}: {
  line: CmpFeePlanningFormLine | null;
  users: DirectoryUser[];
  usedStaff: Set<string>;
  allowTbc: boolean;
  eligibleStaffIds?: ReadonlySet<string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (patch: Partial<CmpFeePlanningFormLine>) => void;
}) {
  const { dictionary } = useCmpI18n();
  const copy = dictionary.workspace;
  const [search, setSearch] = useState("");
  const [rankFilter, setRankFilter] = useState("");
  const term = search.trim().toLowerCase();
  const results =
    term.length < 2
      ? []
      : users.filter(
          (user) =>
            !usedStaff.has(user.id) &&
            (!eligibleStaffIds || eligibleStaffIds.has(user.id)) &&
            (!rankFilter || user.globalRole === rankFilter) &&
            `${user.name} ${user.email}`.toLowerCase().includes(term)
        );
  const selected = line?.staffUserId
    ? users.find((user) => user.id === line.staffUserId)
    : undefined;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={copy.closeForm} className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{copy.feePlanningStaffDialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="cmp-fee-planning-staff-filter grid gap-2">
          <Input
            aria-label={copy.feePlanningStaffSearch}
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={copy.feePlanningStaffSearch}
          />
          <Select
            value={rankFilter || undefined}
            onValueChange={(value) =>
              setRankFilter(value === "ALL" ? "" : (value ?? ""))
            }
          >
            <SelectTrigger aria-label={copy.feePlanningStaffRankFilter}>
              <SelectValue placeholder={copy.feePlanningStaffRankAll} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">
                {copy.feePlanningStaffRankAll}
              </SelectItem>
              {[...new Set(users.map((user) => user.globalRole))].map(
                (role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <p className="font-medium">{copy.feePlanningStaffSelected}</p>
          {selected ? (
            <div className="cmp-fee-planning-staff-card grid gap-2 rounded-md border border-border/65 bg-background/55 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{selected.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {selected.email}
                </p>
              </div>
              <span className="text-sm text-muted-foreground">
                {selected.globalRole}
              </span>
              <Button
                type="button"
                variant="quiet"
                size="sm"
                onClick={() =>
                  onChange({ assignmentType: "", staffUserId: "" })
                }
              >
                {copy.delete}
              </Button>
            </div>
          ) : line?.assignmentType === "TBC" ? (
            <div className="cmp-fee-planning-staff-card cmp-fee-planning-staff-card-tbc grid gap-2 rounded-md border border-border/65 bg-background/55 px-3 py-2">
              <span>{copy.feePlanningTbcLabel}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  onChange({ assignmentType: "", staffUserId: "" })
                }
              >
                {copy.delete}
              </Button>
            </div>
          ) : null}
        </div>
        {allowTbc ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onChange({ assignmentType: "TBC", staffUserId: "" });
              onOpenChange(false);
            }}
          >
            {copy.feePlanningStaffTbc}
          </Button>
        ) : null}
        <div className="max-h-56 overflow-y-auto">
          {term.length < 2 ? (
            <p className="cmp-form-empty-note">
              {copy.feePlanningStaffSearchHint}
            </p>
          ) : results.length > 0 ? (
            results.map((user) => (
              <div
                key={user.id}
                className="cmp-fee-planning-staff-card mb-1.5 grid gap-2 rounded-md border border-border/65 bg-background/55 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">
                  {user.globalRole}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={line?.staffUserId === user.id}
                  onClick={() => {
                    onChange({ assignmentType: "STAFF", staffUserId: user.id });
                    onOpenChange(false);
                  }}
                >
                  {copy.feePlanningStaffAdd}
                </Button>
              </div>
            ))
          ) : (
            <p className="cmp-form-empty-note">
              {copy.feePlanningStaffNoResults}
            </p>
          )}
        </div>
        <Button type="button" onClick={() => onOpenChange(false)}>
          {copy.feePlanningStaffSave}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function BudgetValidationSummary({
  privateCostRule,
}: {
  privateCostRule: {
    applicable: boolean;
    totalCostHkd: number;
    seniorCostRatio: number | null;
    passed: boolean;
  };
}) {
  const { dictionary, locale } = useCmpI18n();
  const copy = dictionary.workspace;
  const hasFailure = !privateCostRule.passed;
  const ratio =
    privateCostRule.seniorCostRatio === null
      ? "—"
      : new Intl.NumberFormat(locale, {
          style: "percent",
          maximumFractionDigits: 2,
        }).format(privateCostRule.seniorCostRatio);
  return (
    <div
      aria-live="polite"
      className={
        hasFailure
          ? "cmp-fee-planning-validation cmp-fee-planning-validation-error"
          : "cmp-fee-planning-validation"
      }
    >
      <p className="font-medium">
        {hasFailure
          ? copy.feePlanningValidationFailed
          : copy.feePlanningValidationPassed}
      </p>
      {privateCostRule.applicable ? (
        <p>
          {(privateCostRule.passed
            ? copy.feePlanningValidationPrivatePassed
            : copy.feePlanningValidationPrivateFailed
          ).replace("{ratio}", ratio)}
        </p>
      ) : (
        <p>{copy.feePlanningValidationPrivateNotApplicable}</p>
      )}
    </div>
  );
}

export function CmpEngagementFeePlanningSummary({
  lines,
  currency = "HKD",
  users = EMPTY_DIRECTORY_USERS,
}: {
  lines: CmpFeePlanningFormLine[];
  currency?: CmpBudgetCurrency;
  users?: DirectoryUser[];
}) {
  const completeLines = lines.filter(
    (line) => line.grade && line.assignmentType && Number(line.budgetHours) > 0
  );
  if (completeLines.length === 0) {
    return <span>—</span>;
  }
  return (
    <CmpEngagementFeePlanningSummaryDataGrid
      lines={completeLines}
      currency={currency}
      users={users}
    />
  );
}
