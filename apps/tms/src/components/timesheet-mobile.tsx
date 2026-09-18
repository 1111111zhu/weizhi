"use client";

import {
  UI_UNIT_LABELS,
  Button,
  CollectionState,
  MobileActionSheet,
  MobileTextArea,
  StatefulMotionButton,
  ViewSwitcher,
} from "@project-wing/ui";
import type { MotionButtonState } from "@project-wing/ui";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { useState } from "react";

import {
  getPeriodLabel,
  getTimesheetDetailsLabel,
  getTimesheetTypeLabel,
  getTimesheetWorkTypeLabel,
  translateTimesheetMessage,
  getTmsWorkspaceCopy,
} from "@/i18n/dictionaries";
import { getTmsMobileCopy } from "@/i18n/mobile";
import type { TmsLocale } from "@/i18n/settings";
import {
  getTimesheetWorkType,
  isChargeableRow,
  isDemoTimesheetRow,
  TIMESHEET_TYPES,
} from "@/lib/timesheet";
import type {
  DailyHoursSummary,
  PeriodKey,
  TimesheetRow,
  TimesheetType,
  ValidationMessage,
} from "@/lib/timesheet";

import { HoursInput } from "./hours-input";
import type { TimesheetBoardProps } from "./timesheet-workspace";
import { TmsMobileActions, TmsMobileControls } from "./tms-mobile-controls";

import styles from "./tms-mobile.module.css";

type Props = Omit<TimesheetBoardProps, "type" | "copy" | "locale"> & {
  locale: TmsLocale;
  year: number;
  month: number;
  period: PeriodKey;
  yearOptions: number[];
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  onPeriodChange: (period: PeriodKey) => void;
  typeFilter: TimesheetType | "All";
  onTypeFilterChange: (type: TimesheetType | "All") => void;
  onAdd: () => void;
  onDelete: () => void;
  onCancelDelete: () => void;
  onSubmit: () => void;
  onSave: () => void;
  saveState: MotionButtonState;
  submitState: MotionButtonState;
  loading: boolean;
  feedback: string;
  descriptionEditable: boolean;
  dashboard: DailyHoursSummary[];
  progress: { completed: number; open: number; target: number };
  validation: ValidationMessage[];
  feedbackError: boolean;
};

export function TimesheetMobile(props: Props) {
  const { rows, days, locale } = props;
  const copy = getTmsWorkspaceCopy(locale);
  const mobileCopy = getTmsMobileCopy(locale);
  const today = new Date().toLocaleDateString("sv-SE");
  const [date, setDate] = useState(today);
  const [detailId, setDetailId] = useState<string | null>(null);
  const day = days.find((item) => item.date === date) ?? days[0];
  const dayIndex = days.findIndex((item) => item.date === day?.date);
  const detail = rows.find((row) => row.id === detailId);
  const visibleRows =
    props.typeFilter === "All"
      ? rows
      : rows.filter((row) => row.type === props.typeFilter);
  const titleFor = (row: TimesheetRow) =>
    isChargeableRow(row)
      ? row.projectName ||
        row.clientName ||
        row.projectCode ||
        row.engagementCode ||
        copy.pendingLinkLabel
      : getTimesheetDetailsLabel(row.details, locale);
  const periodLabel = `${props.year} / ${props.month}\n${getPeriodLabel(props.period, locale)}`;
  if (!day) {
    return null;
  }
  return (
    <section className={styles.root} data-testid="timesheet-mobile">
      <div className={styles.timesheetPeriodBar}>
        <TmsMobileControls
          label={mobileCopy.period}
          title={periodLabel}
          locale={locale}
        >
          <label>
            <span>{copy.year}</span>
            <ViewSwitcher
              label={copy.year}
              value={String(props.year)}
              options={props.yearOptions.map((year) => ({
                value: String(year),
                label: String(year),
              }))}
              onValueChange={(value) => props.onYearChange(Number(value))}
              mobilePresentation="sheet"
            />
          </label>
          <label>
            <span>{copy.month}</span>
            <ViewSwitcher
              label={copy.month}
              value={String(props.month)}
              options={Array.from({ length: 12 }, (_, i) => ({
                value: String(i + 1),
                label: String(i + 1),
              }))}
              onValueChange={(value) => props.onMonthChange(Number(value))}
              mobilePresentation="sheet"
            />
          </label>
          <label>
            <span>{copy.period}</span>
            <ViewSwitcher
              label={copy.period}
              value={props.period}
              options={(["first", "second"] as const).map((value) => ({
                value,
                label: getPeriodLabel(value, locale),
              }))}
              onValueChange={(value) =>
                props.onPeriodChange(value as PeriodKey)
              }
              mobilePresentation="sheet"
            />
          </label>
        </TmsMobileControls>
        <StatefulMotionButton
          variant="ghost"
          state={props.saveState}
          loadingText={copy.saving}
          successText={copy.saved}
          errorText={copy.retrySave}
          onClick={props.onSave}
        >
          {copy.save}
        </StatefulMotionButton>
        <TmsMobileActions
          locale={locale}
          items={[
            {
              label: props.deleteMode
                ? copy.deleteSelectedRows
                : copy.deleteRows,
              onClick: props.onDelete,
              danger: true,
              disabled: props.loading,
            },
          ]}
        />
      </div>
      <div className={styles.dayBar}>
        <Button
          variant="quiet"
          size="icon"
          aria-label={mobileCopy.previousDay}
          disabled={dayIndex <= 0}
          onClick={() => setDate(days[dayIndex - 1].date)}
        >
          <ChevronLeft />
        </Button>
        <TmsMobileControls
          locale={locale}
          label={mobileCopy.date}
          title={new Intl.DateTimeFormat(locale, {
            month: "short",
            day: "numeric",
            weekday: "short",
          }).format(new Date(`${day.date}T12:00:00`))}
        >
          <ViewSwitcher
            label={mobileCopy.date}
            value={day.date}
            options={days.map((item) => ({
              value: item.date,
              label: `${item.date} · ${item.weekdayLabel}`,
            }))}
            onValueChange={setDate}
            mobilePresentation="sheet"
          />
        </TmsMobileControls>
        <Button
          variant="quiet"
          size="icon"
          aria-label={mobileCopy.nextDay}
          disabled={dayIndex >= days.length - 1}
          onClick={() => setDate(days[dayIndex + 1].date)}
        >
          <ChevronRight />
        </Button>
      </div>
      <div className={styles.toolbar}>
        <span className={styles.muted}>
          {mobileCopy.daily}:{" "}
          <strong>
            {rows.reduce(
              (total, row) => total + (row.hoursByDate[day.date] ?? 0),
              0
            )}{" "}
            {UI_UNIT_LABELS.hours}
          </strong>
        </span>
        <TmsMobileControls locale={locale} label={mobileCopy.statistics}>
          <div className={styles.metrics}>
            {[
              { label: copy.completed, value: props.progress.completed },
              { label: copy.open, value: props.progress.open },
              { label: copy.target, value: props.progress.target },
            ].map((metric) => (
              <div className={styles.metric} key={metric.label}>
                {metric.label}
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
          <div className={styles.metrics}>
            {TIMESHEET_TYPES.map((type) => (
              <div className={styles.metric} key={type}>
                {getTimesheetTypeLabel(type, locale)}
                <strong>
                  {rows
                    .filter((row) => row.type === type)
                    .reduce(
                      (total, row) =>
                        total +
                        days.reduce(
                          (sum, dateItem) =>
                            sum + (row.hoursByDate[dateItem.date] ?? 0),
                          0
                        ),
                      0
                    )}{" "}
                  {UI_UNIT_LABELS.hours}
                </strong>
              </div>
            ))}
          </div>
          <ViewSwitcher
            label={copy.type}
            value={props.typeFilter}
            options={[
              { value: "All", label: copy.all },
              ...TIMESHEET_TYPES.map((value) => ({
                value,
                label: getTimesheetTypeLabel(value, locale),
              })),
            ]}
            onValueChange={(value) =>
              props.onTypeFilterChange(value as Props["typeFilter"])
            }
            mobilePresentation="sheet"
          />
          {props.validation.map((message) => (
            <p
              className={styles.feedback}
              key={`${message.date}-${message.message}`}
            >
              {translateTimesheetMessage(message.message, locale)}
            </p>
          ))}
          {props.dashboard.map((dateItem) => (
            <section className={styles.record} key={dateItem.date}>
              <strong>
                {dateItem.date} · {copy.total} {dateItem.total}{" "}
                {UI_UNIT_LABELS.hours}
              </strong>
              <p className={styles.muted}>
                {copy.chargeable} {dateItem.chargeable} · {copy.nonChargeable}{" "}
                {dateItem.nonChargeable} · {copy.leave} {dateItem.leave}
              </p>
            </section>
          ))}
        </TmsMobileControls>
      </div>
      {props.feedback && (
        <output
          className={props.feedbackError ? styles.feedback : styles.notice}
        >
          {props.feedback}
        </output>
      )}
      <div className={styles.list}>
        {props.loading ? (
          <CollectionState kind="loading" locale={locale} />
        ) : visibleRows.length ? (
          visibleRows.map((row) => {
            const editable =
              (props.isHourEditable?.(row, day.date) ??
                props.canEditDate?.(day.date) ??
                true) &&
              (!isChargeableRow(row) ||
                isDemoTimesheetRow(row) ||
                row.timesheetAccess?.allowed === true);
            const state = props.isReturnedHour?.(row, day.date)
              ? "returned"
              : props.getApprovalCellState?.(row, day.date);
            return (
              <article
                key={row.id}
                className={styles.record}
                data-highlighted={
                  row.id === props.highlightedRowId || undefined
                }
              >
                <div className={styles.identity}>
                  <div>
                    <strong>{titleFor(row)}</strong>
                    <p>
                      {isChargeableRow(row)
                        ? row.projectCode || row.engagementCode
                        : getTimesheetTypeLabel(row.type, locale)}{" "}
                      ·{" "}
                      {getTimesheetWorkTypeLabel(
                        getTimesheetWorkType(row),
                        locale
                      )}
                    </p>
                  </div>
                  {props.deleteMode ? (
                    <Button
                      variant={
                        props.selectedIds.has(row.id) ? "danger" : "outline"
                      }
                      size="icon"
                      aria-label={`${mobileCopy.select}: ${titleFor(row)}`}
                      aria-pressed={props.selectedIds.has(row.id)}
                      onClick={() => props.onToggleSelected(row.id)}
                    >
                      <Check />
                    </Button>
                  ) : (
                    <Button
                      variant="quiet"
                      size="icon"
                      aria-label={`${mobileCopy.details}: ${titleFor(row)} ${getTimesheetWorkTypeLabel(getTimesheetWorkType(row), locale)}`}
                      onClick={() => setDetailId(row.id)}
                    >
                      <MoreHorizontal />
                    </Button>
                  )}
                </div>
                <label className={styles.hours} data-state={state ?? undefined}>
                  <span>
                    {copy.hours}{" "}
                    {!editable && (
                      <span className={styles.tag}>
                        <LockKeyhole size={14} />
                        {mobileCopy.locked}
                      </span>
                    )}
                    {state === "returned" && (
                      <span className={styles.tag}>
                        {copy.returnedTimesheet}
                      </span>
                    )}
                  </span>
                  <HoursInput
                    key={`${row.id}-${day.date}`}
                    aria-label={`${titleFor(row)} · ${getTimesheetWorkTypeLabel(getTimesheetWorkType(row), locale)} · ${day.date} ${copy.hours}`}
                    value={row.hoursByDate[day.date] ?? 0}
                    max={getTimesheetWorkType(row) === "Normal" ? 8 : 24}
                    disabled={!editable || props.deleteMode}
                    onChange={(value) => props.onHourChange(row.id, day, value)}
                  />
                </label>
              </article>
            );
          })
        ) : (
          <CollectionState kind="empty" locale={locale} />
        )}
      </div>
      <div className={styles.actions}>
        {props.deleteMode ? (
          <>
            <Button variant="outline" onClick={props.onCancelDelete}>
              {copy.cancel}
            </Button>
            <Button
              variant="danger"
              disabled={!props.selectedIds.size}
              onClick={props.onDelete}
            >
              {copy.deleteSelectedRows} ({props.selectedIds.size})
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              disabled={props.loading}
              onClick={props.onAdd}
            >
              <Plus />
              {copy.addRow}
            </Button>
            <StatefulMotionButton
              variant="primary"
              state={props.submitState}
              loadingText={copy.submitting}
              successText={copy.submitted}
              errorText={copy.submitTryAgain}
              disabled={props.loading}
              onClick={props.onSubmit}
            >
              {copy.submit}
            </StatefulMotionButton>
          </>
        )}
      </div>
      <MobileActionSheet
        open={Boolean(detail)}
        onOpenChange={(open) => {
          if (!open) {
            setDetailId(null);
          }
        }}
        title={detail ? titleFor(detail) : mobileCopy.details}
        closeLabel={mobileCopy.close}
      >
        {detail && (
          <div className={styles.fields}>
            <dl className={styles.details}>
              <div>
                <dt>{copy.type}</dt>
                <dd>{getTimesheetTypeLabel(detail.type, locale)}</dd>
              </div>
              <div>
                <dt>{copy.total}</dt>
                <dd>
                  {detail.periodTotal} {UI_UNIT_LABELS.hours}
                </dd>
              </div>
              {isChargeableRow(detail) && (
                <>
                  <div>
                    <dt>{copy.clientName}</dt>
                    <dd>{detail.clientName}</dd>
                  </div>
                  <div>
                    <dt>{copy.engagementCode}</dt>
                    <dd>{detail.projectCode || detail.engagementCode}</dd>
                  </div>
                </>
              )}
            </dl>
            <label>
              {copy.description}
              <MobileTextArea
                value={detail.description}
                disabled={!props.descriptionEditable}
                onChange={(event) =>
                  props.onDescriptionChange(detail.id, event.target.value)
                }
              />
            </label>
            {isChargeableRow(detail) && (
              <TmsMobileActions
                locale={locale}
                items={[
                  ...(props.onLinkRow &&
                  detail.source === "TMS_PENDING" &&
                  !detail.projectId
                    ? [
                        {
                          label: copy.linkEmpProject,
                          onClick: () => {
                            setDetailId(null);
                            props.onLinkRow?.(detail.id);
                          },
                        },
                      ]
                    : []),
                  ...(props.onUnlinkRow && detail.projectId
                    ? [
                        {
                          label: copy.unlinkProject,
                          onClick: () => props.onUnlinkRow?.(detail.id),
                          danger: true,
                        },
                      ]
                    : []),
                ]}
              />
            )}
          </div>
        )}
      </MobileActionSheet>
    </section>
  );
}
