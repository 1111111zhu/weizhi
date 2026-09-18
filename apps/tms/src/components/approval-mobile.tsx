"use client";

import type { TmsApprovalProject } from "@project-wing/shared";
import {
  UI_UNIT_LABELS,
  Button,
  CollectionState,
  Input,
  MobileListItem,
} from "@project-wing/ui";
import { ArrowLeft, Check } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import {
  getApprovalStatusLabel,
  getTmsWorkspaceCopy,
} from "@/i18n/dictionaries";
import { getTmsMobileCopy } from "@/i18n/mobile";
import type { TmsLocale } from "@/i18n/settings";
import type { ApprovalRecordGroup } from "@/lib/approval-filter";
import type { PeriodDay } from "@/lib/timesheet";

import { HoursInput } from "./hours-input";
import { TmsMobileActions } from "./tms-mobile-controls";
import type { TmsMobileAction } from "./tms-mobile-controls";

import styles from "./tms-mobile.module.css";

export type ApprovalMobileCell = {
  hours: number;
  editable: boolean;
  unavailable: boolean;
  onChange: (value: string) => void;
};
type ProjectGroup = {
  id: string;
  code: string;
  name: string;
  groups: ApprovalRecordGroup[];
};
export function ApprovalMobile({
  locale,
  projects,
  selectedProject,
  projectGroups,
  loading,
  error,
  onRetry,
  search,
  onSearch,
  pendingOnly,
  onPendingOnly,
  onProject,
  periodControls,
  editing,
  busy,
  canEdit,
  onEdit,
  batchActions,
  onApprove,
  onReturn,
  getCell,
  getTotal,
  days,
  selectedIds,
  onSelectProjectGroup,
  feedback,
  nameFilters,
  onClearNameFilters,
}: {
  locale: TmsLocale;
  projects: TmsApprovalProject[];
  selectedProject: TmsApprovalProject | null;
  projectGroups: ProjectGroup[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  search: string;
  onSearch: (value: string) => void;
  pendingOnly: boolean;
  onPendingOnly: (value: boolean) => void;
  onProject: (project: TmsApprovalProject) => void;
  periodControls: ReactNode;
  editing: boolean;
  busy: boolean;
  canEdit: boolean;
  onEdit: () => void;
  batchActions: TmsMobileAction[];
  onApprove: (group: ApprovalRecordGroup) => void;
  onReturn: (group: ApprovalRecordGroup) => void;
  getCell: (
    group: ApprovalRecordGroup,
    day: PeriodDay,
    type: "Normal" | "OT"
  ) => ApprovalMobileCell;
  getTotal: (group: ApprovalRecordGroup, type: "Normal" | "OT") => number;
  days: PeriodDay[];
  selectedIds: Set<string>;
  onSelectProjectGroup: (id: string) => void;
  feedback: string;
  nameFilters: string[];
  onClearNameFilters: () => void;
}) {
  const copy = getTmsWorkspaceCopy(locale);
  const mobileCopy = getTmsMobileCopy(locale);
  const [view, setView] = useState<"projects" | "records" | "detail">(
    "projects"
  );
  const [groupId, setGroupId] = useState<string | null>(null);
  const groups = projectGroups.flatMap((project) => project.groups);
  const selected = groups.find((group) => group.id === groupId);
  const activeView = view === "detail" && !selected ? "records" : view;
  const canApprove = selected?.records.some((record) =>
    ["SUBMITTED", "APPROVED", "PENDING_CONFIRMATION"].includes(record.status)
  );
  const canReturn = selected?.records.some((record) =>
    ["SUBMITTED", "RETURNED", "PENDING_CONFIRMATION"].includes(record.status)
  );
  const approved = selected?.records.every(
    (record) => record.status === "APPROVED"
  );
  return (
    <section className={styles.root} data-testid="approval-mobile">
      <div className={styles.toolbar}>
        {activeView !== "projects" && (
          <Button
            variant="quiet"
            size="icon"
            aria-label={mobileCopy.back}
            disabled={editing || busy}
            onClick={() =>
              setView(activeView === "detail" ? "records" : "projects")
            }
          >
            <ArrowLeft />
          </Button>
        )}
        <h2>
          {activeView === "projects"
            ? copy.myProjects
            : activeView === "detail"
              ? selected?.ownerName
              : (selectedProject?.engagementCode ?? mobileCopy.submissions)}
        </h2>
        {activeView === "detail" ? (
          <Button
            variant={editing ? "primary" : "outline"}
            disabled={!canEdit || busy}
            onClick={onEdit}
          >
            {editing ? copy.finishEditing : copy.editHours}
          </Button>
        ) : (
          periodControls
        )}
      </div>
      {activeView !== "projects" && (
        <p className={styles.muted}>
          {selectedProject?.clientName}
          {activeView === "detail" && selected
            ? ` · ${selected.projectName ?? ""}`
            : ""}
        </p>
      )}
      {activeView === "detail" && days.length > 0 && (
        <p className={styles.periodContext}>
          {copy.period}: {days[0].date} – {days.at(-1)?.date}
        </p>
      )}
      {activeView === "projects" ? (
        <div className={styles.toolbar}>
          <Input
            aria-label={copy.searchProjectPlaceholder}
            placeholder={copy.searchProjectPlaceholder}
            value={search}
            onChange={(event) => onSearch(event.target.value)}
          />
          <Button
            variant={pendingOnly ? "secondary" : "quiet"}
            aria-pressed={pendingOnly}
            onClick={() => onPendingOnly(!pendingOnly)}
          >
            {mobileCopy.pendingOnly}
          </Button>
        </div>
      ) : (
        <div className={styles.toolbar}>
          <span className={styles.muted}>
            {activeView === "detail" && selected
              ? getApprovalStatusLabel(selected.status, locale)
              : mobileCopy.submissions}
          </span>
          <TmsMobileActions locale={locale} items={batchActions} />
        </div>
      )}
      {nameFilters.length > 0 && (
        <Button variant="secondary" onClick={onClearNameFilters}>
          {nameFilters.join(", ")} ×
        </Button>
      )}
      {feedback && (
        <output className={busy ? styles.notice : styles.feedback}>
          {feedback}
        </output>
      )}
      <div className={styles.list}>
        {loading || error ? (
          <CollectionState
            kind={error ? "error" : "loading"}
            locale={locale}
            onRetry={onRetry}
          />
        ) : activeView === "projects" ? (
          projects.length ? (
            projects.map((project) => (
              <MobileListItem
                key={project.engagementId}
                title={project.clientName}
                description={project.engagementCode}
                meta={`${copy.pendingOnly}: ${project.pendingCount}`}
                href="#approval-records"
                onNavigate={(event) => {
                  event.preventDefault();
                  onProject(project);
                  setView("records");
                  setGroupId(null);
                }}
              />
            ))
          ) : (
            <CollectionState
              kind="empty"
              title={copy.noMatchingProjects}
              locale={locale}
            />
          )
        ) : activeView === "records" ? (
          projectGroups.length ? (
            projectGroups.map((project) => {
              const records = project.groups.flatMap((group) => group.records);
              const selectable =
                !project.id.startsWith("legacy:") &&
                records.some((record) =>
                  ["SUBMITTED", "PENDING_CONFIRMATION"].includes(record.status)
                ) &&
                !records.some((record) => record.status === "NOT_SUBMITTED");
              return (
                <section key={project.id} className={styles.record}>
                  <div className={styles.identity}>
                    <div>
                      <strong>{project.name}</strong>
                      <p>{project.code}</p>
                    </div>
                    <Button
                      variant={
                        selectedIds.has(project.id) ? "secondary" : "quiet"
                      }
                      size="icon"
                      aria-label={`${mobileCopy.select}: ${project.name}`}
                      aria-pressed={selectedIds.has(project.id)}
                      disabled={!selectable || busy || editing}
                      onClick={() => onSelectProjectGroup(project.id)}
                    >
                      <Check />
                    </Button>
                  </div>
                  {project.groups.map((group) => (
                    <MobileListItem
                      key={group.id}
                      title={group.ownerName}
                      description={getApprovalStatusLabel(group.status, locale)}
                      meta={`${copy.normal} ${getTotal(group, "Normal")} h · ${copy.ot} ${getTotal(group, "OT")} h`}
                      href="#approval-detail"
                      onNavigate={(event) => {
                        event.preventDefault();
                        setGroupId(group.id);
                        setView("detail");
                      }}
                    />
                  ))}
                </section>
              );
            })
          ) : (
            <CollectionState
              kind="empty"
              title={copy.approvalNoEmployees}
              locale={locale}
            />
          )
        ) : selected ? (
          <>
            <div className={styles.metrics}>
              <div className={styles.metric}>
                {copy.normal}
                <strong>
                  {getTotal(selected, "Normal")} {UI_UNIT_LABELS.hours}
                </strong>
              </div>
              <div className={styles.metric}>
                {copy.ot}
                <strong>
                  {getTotal(selected, "OT")} {UI_UNIT_LABELS.hours}
                </strong>
              </div>
            </div>
            {selected.records.some((record) => record.returnReason) && (
              <p className={styles.feedback}>
                {selected.records
                  .map((record) => record.returnReason)
                  .filter(Boolean)
                  .join("\n")}
              </p>
            )}
            <div
              className={`${styles.approvalDay} ${styles.approvalDayHeader}`}
            >
              <span>{copy.timesheetDate}</span>
              <span>{copy.normal}</span>
              <span>{copy.ot}</span>
            </div>
            {days.map((day) => (
              <fieldset
                key={day.date}
                className={styles.approvalDay}
                aria-label={day.date}
              >
                <span>{day.date.slice(5)}</span>
                {(["Normal", "OT"] as const).map((type) => {
                  const cell = getCell(selected, day, type);
                  return cell.unavailable ? (
                    <span key={type}>—</span>
                  ) : (
                    <HoursInput
                      key={type}
                      aria-label={`${selected.ownerName} ${type} ${day.date} ${copy.hours}`}
                      value={cell.hours}
                      readOnly={!cell.editable}
                      disabled={busy}
                      onChange={cell.editable ? cell.onChange : () => {}}
                    />
                  );
                })}
              </fieldset>
            ))}
            <p className={styles.muted}>
              {selected.records
                .flatMap((record) =>
                  record.submittedRows.map((row) => row.description)
                )
                .filter(Boolean)
                .join(" / ")}
            </p>
          </>
        ) : null}
      </div>
      {activeView === "detail" && selected && (
        <div className={styles.actions}>
          <Button
            variant="outline"
            disabled={!canReturn || busy || editing}
            onClick={() => onReturn(selected)}
          >
            {copy.return}
          </Button>
          <Button
            variant={approved ? "outline" : "primary"}
            disabled={!canApprove || busy || editing}
            onClick={() => onApprove(selected)}
          >
            {approved ? copy.undoApproval : copy.approve}
          </Button>
        </div>
      )}
    </section>
  );
}
