import type {
  TmsApprovalProject,
  TmsApprovalRecord,
} from "@project-wing/shared";
import { buildTmsApprovalOtRowId } from "@project-wing/shared";
import {
  Badge as StatusBadge,
  StatefulMotionButton,
  useCompactViewport,
  MobileActionSheet,
  MobileTextArea,
  Button as MobileButton,
  projectWingToast as toast,
} from "@project-wing/ui";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  ListFilter,
  Search,
  ShieldCheck,
  Undo2,
  UserCog,
  X,
} from "lucide-react";
import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { ApprovalColumnFilterHeader } from "@/components/approval-column-filter-header";
import { HoursInput } from "@/components/hours-input";
import {
  RESIZE_GRIP_CLASS,
  RESIZE_RAIL_CLASS,
} from "@/components/resize-handle";
import { TmsHeader } from "@/components/tms-header";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
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
import { Textarea } from "@/components/ui/textarea";
import {
  getApprovalStatusLabel,
  getPeriodLabel,
  getTimesheetWorkTypeLabel,
  getTmsMonthLabels,
  getTmsWorkspaceCopy,
} from "@/i18n/dictionaries";
import { getTmsMobileCopy } from "@/i18n/mobile";
import type { TmsLocale } from "@/i18n/settings";
import {
  approveTmsSubmission,
  editTmsSubmission,
  getTmsApprovalProjects,
  getTmsApprovalRecords,
  returnTmsSubmission,
} from "@/lib/api";
import type { User } from "@/lib/api";
import {
  recommendApprovalPeriod,
  selectApprovalGroups,
  selectApprovalProjects,
} from "@/lib/approval-filter";
import type { ApprovalRecordGroup } from "@/lib/approval-filter";
import { buildPeriodDays, updateTimesheetHours } from "@/lib/timesheet";
import type { ChargeableRow, PeriodKey, TimesheetRow } from "@/lib/timesheet";
import { cn } from "@/lib/utils";

import { ApprovalMobile } from "./approval-mobile";
import { TmsMobileControls } from "./tms-mobile-controls";

import mobileStyles from "./tms-mobile.module.css";

type ApprovalWorkspaceProps = {
  approvalPending?: boolean;
  locale?: TmsLocale;
  onApprovalPendingChange?: (pending: boolean) => void;
  renderHeader?: boolean;
  user: User;
  onBack: () => void;
  onOpenQuery?: () => void;
  onSignOut: () => void;
};

const APPROVAL_STATUS_VALUES: TmsApprovalRecord["status"][] = [
  "NOT_SUBMITTED",
  "SUBMITTED",
  "RETURNED",
  "APPROVED",
  "PENDING_CONFIRMATION",
];
const MIN_PROJECT_PANE_WIDTH = 280;
const DEFAULT_PROJECT_PANE_WIDTH = MIN_PROJECT_PANE_WIDTH;
const APPROVAL_FILTER_STORAGE_PREFIX = "project-wing:tms:approval-filters:";
const MAX_PROJECT_PANE_WIDTH = 480;
const PROJECT_PANE_COLLAPSE_THRESHOLD = 48;
const PROJECT_PANE_DRAG_THRESHOLD = 1;
const PROJECT_PANE_EXPAND_THRESHOLD = 48;
const APPROVAL_DISPLAY_ROW_TYPES = ["Normal", "OT"] as const;
type ApprovalDisplayRowType = (typeof APPROVAL_DISPLAY_ROW_TYPES)[number];
type ApprovalRowType = ApprovalDisplayRowType | "Leave";
type ApprovalFilters = { year: number; month: number; period: PeriodKey };

type ProjectPaneDrag = {
  pointerId: number;
  startX: number;
  startWidth: number;
  currentWidth: number;
  restoreWidth: number;
  startCollapsed: boolean;
  previewExpanded: boolean;
  moved: boolean;
};
type ApprovalUndoEntry = {
  id: string;
  restoreStatus: "SUBMITTED" | "PENDING_CONFIRMATION";
};
type ReturnDialogState = {
  groupId: string;
  targets: TmsApprovalRecord[];
};
type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<unknown> };
};
const APPROVAL_DATE_TABLE_WIDTH_CLASS: Record<number, string> = {
  15: "min-w-[1254px]",
  16: "min-w-[1300px]",
  28: "min-w-[1852px]",
  29: "min-w-[1898px]",
  30: "min-w-[1944px]",
  31: "min-w-[1990px]",
};

function getApprovalRecordForDate(records: TmsApprovalRecord[], date: string) {
  const day = Number(date.slice(-2));
  const half = day <= 15 ? "FIRST_HALF" : "SECOND_HALF";
  return records.find((record) => record.half === half);
}

function runApprovalViewTransition(update: () => void) {
  if (typeof document === "undefined") {
    return false;
  }
  const transitionDocument = document as ViewTransitionDocument;
  if (typeof transitionDocument.startViewTransition !== "function") {
    return false;
  }
  transitionDocument.startViewTransition(() => flushSync(update));
  return true;
}

function getApprovalRowTransitionName(rowKey: string) {
  return `approval-row-${rowKey.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function getGroupRows(
  group: ApprovalRecordGroup,
  draftRowsByRecordId: Record<string, TimesheetRow[]>
) {
  return group.records.flatMap(
    (record) =>
      draftRowsByRecordId[record.id] ??
      normalizeApprovalRows(record.submittedRows)
  );
}

export function buildApprovalYearOptions(centerYear: number) {
  return Array.from({ length: 5 }, (_, index) => centerYear - 2 + index);
}

export function getApprovalTotal(
  rows: Pick<TimesheetRow, "type" | "details" | "hoursByDate">[],
  days: { date: string }[],
  rowType?: ApprovalRowType
) {
  return days.reduce(
    (total, day) =>
      total +
      rows.reduce((dayTotal, row) => {
        const type = getApprovalRowType(row);
        if (!type || (rowType ? type !== rowType : type === "Leave")) {
          return dayTotal;
        }
        return dayTotal + (row.hoursByDate[day.date] ?? 0);
      }, 0),
    0
  );
}

type ApprovalRowTypeInput = Pick<TimesheetRow, "type" | "details"> & {
  workType?: string;
};

export function getApprovalRowType(
  row: ApprovalRowTypeInput
): ApprovalRowType | null {
  if (row.type === "Non-Chargeable") {
    return null;
  }
  if (row.type === "Leave" || row.details.trim().toLowerCase() === "leave") {
    return "Leave";
  }
  const workType = row.workType?.trim().toLowerCase();
  if (workType === "ot") {
    return "OT";
  }
  if (workType === "normal") {
    return "Normal";
  }
  if (row.details.trim().toLowerCase() === "ot") {
    return "OT";
  }
  return row.type === "Chargeable" ? "Normal" : null;
}

export function getApprovalFilterStorageKey(userId: string) {
  return `${APPROVAL_FILTER_STORAGE_PREFIX}${userId}`;
}

function getDefaultApprovalFilters(): ApprovalFilters {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    period: "all",
  };
}

export function readApprovalFilters(userId: string): ApprovalFilters {
  const fallback = getDefaultApprovalFilters();
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(getApprovalFilterStorageKey(userId)) ?? "null"
    ) as Partial<ApprovalFilters> | null;
    const parsedYear = parsed?.year;
    const parsedMonth = parsed?.month;
    const parsedPeriod = parsed?.period;
    if (
      parsed &&
      typeof parsedYear === "number" &&
      Number.isInteger(parsedYear) &&
      parsedYear >= 2000 &&
      parsedYear <= 2200 &&
      typeof parsedMonth === "number" &&
      Number.isInteger(parsedMonth) &&
      parsedMonth >= 1 &&
      parsedMonth <= 12 &&
      (parsedPeriod === "all" ||
        parsedPeriod === "first" ||
        parsedPeriod === "second")
    ) {
      return { year: parsedYear, month: parsedMonth, period: parsedPeriod };
    }
  } catch {
    // Storage is optional; use the in-memory defaults.
  }
  return fallback;
}

function persistApprovalFilters(userId: string, filters: ApprovalFilters) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      getApprovalFilterStorageKey(userId),
      JSON.stringify(filters)
    );
  } catch {
    // Storage is optional; the current selection remains usable.
  }
}

function ApprovalTotalCell({
  groupId,
  rowType,
  total,
}: {
  groupId: string;
  rowType: ApprovalDisplayRowType;
  total: number;
}) {
  return (
    <td
      data-testid={`approval-total-${groupId}-${rowType.toLowerCase()}`}
      aria-label={`${total.toFixed(1)}h`}
      className="h-7 w-[66px] min-w-[66px] border-r border-border bg-card p-0 text-center align-middle font-semibold"
    >
      <span
        data-testid={`approval-total-detail-${groupId}-${rowType.toLowerCase()}`}
        className="flex h-full items-center justify-center"
      >
        {total.toFixed(1)}h
      </span>
    </td>
  );
}

const NOOP = () => {};

export function ApprovalWorkspace({
  approvalPending = false,
  locale: localeProp,
  onApprovalPendingChange,
  user,
  onBack,
  onOpenQuery = NOOP,
  onSignOut,
  renderHeader = true,
}: ApprovalWorkspaceProps) {
  const locale = localeProp ?? "zh-CN";
  const phone = useCompactViewport(767.98);
  const mobileCopy = getTmsMobileCopy(locale);
  const copy = getTmsWorkspaceCopy(locale);
  const legacyProjectLabel =
    locale === "zh-CN" ? "历史未关联项目" : "Legacy unlinked project";
  const ariaCopy = getTmsWorkspaceCopy(localeProp ?? "en-US");
  const ariaLocale = localeProp ?? "en-US";
  const ariaHours = localeProp ? ariaCopy.hours : "hours";
  const controlLocale = localeProp ?? "en-US";
  const detailLocale = localeProp ?? "en-US";
  const matrixLabels = localeProp
    ? copy
    : {
        ...copy,
        name: "Name",
        operation: getTmsWorkspaceCopy("zh-CN").operation,
        status: "Status",
        approvalTotal: "Total",
        approvalType: "Type",
        description: ariaCopy.description,
      };
  const [initialFilters, setInitialFilters] = useState(
    getDefaultApprovalFilters
  );
  void setInitialFilters;
  const [year, setYear] = useState(initialFilters.year);
  const [month, setMonth] = useState(initialFilters.month);
  const [period, setPeriod] = useState<PeriodKey>(initialFilters.period);
  const [hydratedFilterUserId, setHydratedFilterUserId] = useState<
    string | null
  >(null);
  const autoPeriodRef = useRef(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [pendingProjectsOnly, setPendingProjectsOnly] = useState(false);
  const [projectFilterOpen, setProjectFilterOpen] = useState(false);
  const [matrixNameFilters, setMatrixNameFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<
    TmsApprovalRecord["status"][]
  >([]);
  const [projects, setProjects] = useState<TmsApprovalProject[]>([]);
  const visibleProjects = useMemo(() => {
    const filteredProjects = selectApprovalProjects(projects);
    return pendingProjectsOnly
      ? filteredProjects.filter((project) => project.pendingCount > 0)
      : filteredProjects;
  }, [pendingProjectsOnly, projects]);
  const [selectedProject, setSelectedProject] =
    useState<TmsApprovalProject | null>(null);
  const [selectedApprovalProjectIds, setSelectedApprovalProjectIds] = useState<
    Set<string>
  >(() => new Set());
  const [expandedApprovalProjectIds, setExpandedApprovalProjectIds] = useState<
    Set<string>
  >(() => new Set());
  const [records, setRecords] = useState<TmsApprovalRecord[]>([]);
  const recordsRef = useRef(records);
  const [draftRowsByRecordId, setDraftRowsByRecordId] = useState<
    Record<string, TimesheetRow[]>
  >({});
  const [dirtyRecordIds, setDirtyRecordIds] = useState<Record<string, boolean>>(
    {}
  );
  const [editingAll, setEditingAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [savingRecordId, setSavingRecordId] = useState<string | null>(null);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [undoableApprovals, setUndoableApprovals] = useState<
    ApprovalUndoEntry[]
  >([]);
  const [actionId, setActionId] = useState<string | null>(null);
  const [returnDialog, setReturnDialog] = useState<ReturnDialogState | null>(
    null
  );
  const [returnReason, setReturnReason] = useState("");
  const [projectPaneWidth, setProjectPaneWidth] = useState(
    DEFAULT_PROJECT_PANE_WIDTH
  );
  const [projectPaneDragging, setProjectPaneDragging] = useState(false);
  const [projectPaneDragPreviewExpanded, setProjectPaneDragPreviewExpanded] =
    useState(false);
  const projectPaneLastWidthRef = useRef(DEFAULT_PROJECT_PANE_WIDTH);
  const projectPaneDragRef = useRef<ProjectPaneDrag | null>(null);
  const projectPaneDragCleanupRef = useRef<(() => void) | null>(null);
  const projectPaneFrameRef = useRef<HTMLElement | null>(null);
  const projectPaneContentRef = useRef<HTMLDivElement | null>(null);
  const projectPanePaintFrameRef = useRef<number | null>(null);
  const pendingProjectPaneWidthRef = useRef<number | null>(null);
  const suppressProjectPaneClickRef = useRef(false);

  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  const replaceFetchedRecords = useCallback(
    (nextRecords: TmsApprovalRecord[]) => {
      const update = () => setRecords(nextRecords);
      if (recordsRef.current.length > 0 && runApprovalViewTransition(update)) {
        return;
      }
      update();
    },
    []
  );
  const days = useMemo(
    () => buildPeriodDays(year, month, period),
    [year, month, period]
  );
  const yearOptions = useMemo(() => buildApprovalYearOptions(year), [year]);
  const nameFilterOptions = useMemo(
    () => [...new Set(records.map((record) => record.ownerName))].sort(),
    [records]
  );
  const visibleGroups = useMemo(
    () =>
      selectApprovalGroups(records, period, statusFilters, matrixNameFilters),
    [matrixNameFilters, period, records, statusFilters]
  );
  const visibleApprovalProjects = useMemo(() => {
    const grouped = new Map<
      string,
      {
        id: string;
        code: string;
        name: string;
        groups: ApprovalRecordGroup[];
      }
    >();
    for (const group of visibleGroups) {
      const id =
        group.projectId ??
        `legacy:${selectedProject?.engagementId ?? "unknown"}`;
      const current = grouped.get(id) ?? {
        id,
        code: group.projectCode ?? legacyProjectLabel,
        name: group.projectName ?? legacyProjectLabel,
        groups: [],
      };
      current.groups.push(group);
      grouped.set(id, current);
    }
    return [...grouped.values()].sort((left, right) =>
      left.code.localeCompare(right.code)
    );
  }, [legacyProjectLabel, selectedProject?.engagementId, visibleGroups]);
  const visibleRecords = useMemo(
    () => visibleGroups.flatMap((group) => group.records),
    [visibleGroups]
  );
  const pendingRecords = visibleRecords.filter(
    (record) =>
      record.status === "SUBMITTED" || record.status === "PENDING_CONFIRMATION"
  );
  const scopedPendingRecords = pendingRecords.filter(
    (record) =>
      selectedApprovalProjectIds.size === 0 ||
      (record.projectId && selectedApprovalProjectIds.has(record.projectId))
  );
  const hasEditableVisibleRecords = visibleRecords.some(
    (record) => record.status !== "NOT_SUBMITTED"
  );
  const hasUnsavedChanges = Object.values(dirtyRecordIds).some(Boolean);
  const saveState =
    batchProcessing || actionId || savingRecordId
      ? "saving"
      : saveFailed
        ? "failed"
        : hasUnsavedChanges
          ? "dirty"
          : "saved";
  const saveButtonState =
    saveState === "saving"
      ? "loading"
      : saveState === "failed"
        ? "error"
        : saveState === "saved"
          ? "success"
          : "idle";
  const hasUndoableApprovals = undoableApprovals.length > 0;

  useEffect(() => {
    setSelectedProject((current) =>
      current &&
      visibleProjects.some(
        (project) => project.engagementId === current.engagementId
      )
        ? current
        : (visibleProjects[0] ?? null)
    );
  }, [visibleProjects]);

  useEffect(() => {
    setSelectedApprovalProjectIds(new Set());
    setExpandedApprovalProjectIds(new Set());
  }, [selectedProject?.engagementId]);

  useEffect(() => {
    if (visibleApprovalProjects.length === 0) {
      return;
    }
    setExpandedApprovalProjectIds((current) =>
      visibleApprovalProjects.some((project) => current.has(project.id))
        ? current
        : new Set([visibleApprovalProjects[0].id])
    );
  }, [visibleApprovalProjects]);

  useEffect(() => {
    const savedFilters = readApprovalFilters(user.id);
    setYear(savedFilters.year);
    setMonth(savedFilters.month);
    setPeriod(savedFilters.period);
    setHydratedFilterUserId(user.id);
  }, [user.id]);

  useEffect(() => {
    if (hydratedFilterUserId !== user.id) {
      return;
    }
    persistApprovalFilters(user.id, { year, month, period });
  }, [hydratedFilterUserId, month, period, user.id, year]);

  useEffect(() => {
    if (statusFilters.length === 0) {
      if (autoPeriodRef.current) {
        autoPeriodRef.current = false;
        setPeriod("all");
      }
      return;
    }

    if (period !== "all" && !autoPeriodRef.current) {
      return;
    }
    const recommendedPeriod = recommendApprovalPeriod(
      records,
      statusFilters,
      matrixNameFilters
    );
    if (recommendedPeriod === period) {
      return;
    }

    autoPeriodRef.current = recommendedPeriod !== "all";
    setPeriod(recommendedPeriod);
  }, [matrixNameFilters, period, records, statusFilters]);

  useEffect(() => {
    if (hydratedFilterUserId !== user.id) {
      return;
    }
    let active = true;
    setLoading(true);
    void getTmsApprovalProjects(year, month, projectSearch)
      .then((response) => {
        if (!active) {
          return;
        }
        setProjects(response.projects);
        setLoadError(false);
        onApprovalPendingChange?.(
          selectApprovalProjects(response.projects).some(
            (project) => project.pendingCount > 0
          )
        );
      })
      .catch(() => {
        if (!active) {
          return;
        }
        toast.error(copy.unableLoadTimesheet);
        setLoadError(true);
        onApprovalPendingChange?.(false);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [
    hydratedFilterUserId,
    loadVersion,
    month,
    onApprovalPendingChange,
    projectSearch,
    copy.unableLoadTimesheet,
    user.id,
    year,
  ]);

  useEffect(() => {
    if (hydratedFilterUserId !== user.id) {
      return;
    }
    if (!selectedProject) {
      setRecords([]);
      return;
    }
    let active = true;
    setLoading(true);
    void getTmsApprovalRecords(selectedProject.engagementId, year, month)
      .then((response) => {
        if (!active) {
          return;
        }
        replaceFetchedRecords(response.records);
        setLoadError(false);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        toast.error(copy.unableLoadTimesheet);
        setLoadError(true);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [
    copy.unableLoadTimesheet,
    hydratedFilterUserId,
    month,
    replaceFetchedRecords,
    loadVersion,
    selectedProject,
    user.id,
    year,
  ]);

  useEffect(() => {
    setDraftRowsByRecordId(
      Object.fromEntries(
        records.map((record) => [
          record.id,
          normalizeApprovalRows(record.submittedRows),
        ])
      )
    );
    setDirtyRecordIds({});
    setEditingAll(false);
    setSaveFailed(false);
  }, [records]);

  useEffect(() => {
    setUndoableApprovals([]);
  }, [
    matrixNameFilters,
    month,
    period,
    selectedProject?.engagementId,
    statusFilters,
    year,
  ]);

  const setProjectPaneDragVisualStateRef = useRef<(dragging: boolean) => void>(
    () => {}
  );
  useEffect(
    () => () => {
      projectPaneDragCleanupRef.current?.();
      setProjectPaneDragVisualStateRef.current(false);
      if (
        projectPanePaintFrameRef.current !== null &&
        typeof window.cancelAnimationFrame === "function"
      ) {
        window.cancelAnimationFrame(projectPanePaintFrameRef.current);
      }
    },
    []
  );

  async function refreshRecords() {
    if (!selectedProject) {
      return;
    }
    setLoading(true);
    try {
      const [projectsResponse, recordsResponse] = await Promise.all([
        getTmsApprovalProjects(year, month, projectSearch),
        getTmsApprovalRecords(selectedProject.engagementId, year, month),
      ]);
      setProjects(projectsResponse.projects);
      onApprovalPendingChange?.(
        selectApprovalProjects(projectsResponse.projects).some(
          (project) => project.pendingCount > 0
        )
      );
      replaceFetchedRecords(recordsResponse.records);
    } finally {
      setLoading(false);
    }
  }

  function toggleProjectPane() {
    stopProjectPaneDragging();
    flushProjectPaneWidthPaint();
    setProjectPaneDragPreviewExpanded(false);
    setProjectPaneWidth((current) => {
      if (current === 0) {
        return projectPaneLastWidthRef.current;
      }
      projectPaneLastWidthRef.current = current;
      return 0;
    });
  }

  function updateProjectPaneWidth(width: number) {
    const nextWidth = Math.min(
      MAX_PROJECT_PANE_WIDTH,
      Math.max(MIN_PROJECT_PANE_WIDTH, width)
    );
    projectPaneLastWidthRef.current = nextWidth;
    setProjectPaneWidth(nextWidth);
  }

  type ProjectPanePointerLike = {
    clientX: number;
    pointerId: number;
    preventDefault: () => void;
  };

  function applyProjectPaneWidth(width: number) {
    projectPaneFrameRef.current?.style.setProperty(
      "--project-pane-width",
      `${width}px`
    );
    if (projectPaneFrameRef.current) {
      projectPaneFrameRef.current.dataset.projectPaneWidth = String(width);
    }
    if (projectPaneContentRef.current) {
      projectPaneContentRef.current.dataset.projectPaneWidth = String(width);
    }
  }

  const setProjectPaneDragVisualState = useCallback((dragging: boolean) => {
    const frame = projectPaneFrameRef.current;
    if (!frame) {
      return;
    }
    if (dragging) {
      frame.dataset.projectPaneDragging = "true";
      frame.style.transition = "none";
      frame.style.willChange = "grid-template-columns";
      return;
    }
    delete frame.dataset.projectPaneDragging;
    frame.style.removeProperty("transition");
    frame.style.removeProperty("will-change");
  }, []);
  setProjectPaneDragVisualStateRef.current = setProjectPaneDragVisualState;

  function scheduleProjectPaneWidthPaint(width: number) {
    pendingProjectPaneWidthRef.current = width;
    if (projectPanePaintFrameRef.current !== null) {
      return;
    }

    if (typeof window.requestAnimationFrame !== "function") {
      pendingProjectPaneWidthRef.current = null;
      applyProjectPaneWidth(width);
      return;
    }

    let completedSynchronously = false;
    const frameId = window.requestAnimationFrame(() => {
      completedSynchronously = true;
      projectPanePaintFrameRef.current = null;
      const pendingWidth = pendingProjectPaneWidthRef.current;
      pendingProjectPaneWidthRef.current = null;
      if (pendingWidth !== null) {
        applyProjectPaneWidth(pendingWidth);
      }
    });
    projectPanePaintFrameRef.current = completedSynchronously ? null : frameId;
  }

  function flushProjectPaneWidthPaint(width?: number) {
    if (
      projectPanePaintFrameRef.current !== null &&
      typeof window.cancelAnimationFrame === "function"
    ) {
      window.cancelAnimationFrame(projectPanePaintFrameRef.current);
    }
    projectPanePaintFrameRef.current = null;
    const pendingWidth = width ?? pendingProjectPaneWidthRef.current;
    pendingProjectPaneWidthRef.current = null;
    if (pendingWidth !== undefined && pendingWidth !== null) {
      applyProjectPaneWidth(pendingWidth);
    }
  }

  function stopProjectPaneDragging() {
    projectPaneDragCleanupRef.current?.();
    projectPaneDragCleanupRef.current = null;
    setProjectPaneDragVisualState(false);
    setProjectPaneDragging(false);
  }

  function handleProjectPaneResizePointerMove(
    pointerEvent: ProjectPanePointerLike
  ) {
    const drag = projectPaneDragRef.current;
    if (
      !drag ||
      pointerEvent.pointerId !== drag.pointerId ||
      Math.abs(pointerEvent.clientX - drag.startX) <=
        PROJECT_PANE_DRAG_THRESHOLD
    ) {
      return;
    }

    drag.moved = true;
    pointerEvent.preventDefault();
    const delta = pointerEvent.clientX - drag.startX;
    drag.currentWidth = Math.min(
      MAX_PROJECT_PANE_WIDTH,
      Math.max(0, drag.startWidth + delta)
    );
    if (drag.currentWidth >= MIN_PROJECT_PANE_WIDTH) {
      drag.restoreWidth = Math.min(
        MAX_PROJECT_PANE_WIDTH,
        Math.max(MIN_PROJECT_PANE_WIDTH, drag.currentWidth)
      );
    }
    scheduleProjectPaneWidthPaint(drag.currentWidth);
    const previewExpanded =
      drag.startCollapsed && drag.currentWidth >= PROJECT_PANE_EXPAND_THRESHOLD;
    if (previewExpanded !== drag.previewExpanded) {
      drag.previewExpanded = previewExpanded;
      setProjectPaneDragPreviewExpanded(previewExpanded);
    }
  }

  function handleProjectPaneResizePointerDown(
    event: React.PointerEvent<HTMLButtonElement>
  ) {
    if (event.button !== 0) {
      return;
    }

    stopProjectPaneDragging();
    event.preventDefault();
    const target = event.currentTarget;
    const startCollapsed = projectPaneWidth === 0;
    const startWidth = startCollapsed ? 0 : projectPaneWidth;
    projectPaneDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth,
      currentWidth: startWidth,
      restoreWidth: startWidth,
      startCollapsed,
      previewExpanded: false,
      moved: false,
    };
    suppressProjectPaneClickRef.current = false;
    setProjectPaneDragVisualState(true);

    const handleWindowPointerMove = (pointerEvent: Event) => {
      handleProjectPaneResizePointerMove(pointerEvent as PointerEvent);
    };
    const handleWindowPointerUp = (pointerEvent: Event) => {
      handleProjectPaneResizePointerUp(pointerEvent as PointerEvent);
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener(
        "pointercancel",
        handleProjectPaneResizePointerCancel
      );
      window.removeEventListener("blur", handleProjectPaneResizeWindowBlur);
      if (target.hasPointerCapture?.(event.pointerId)) {
        target.releasePointerCapture(event.pointerId);
      }
      projectPaneDragCleanupRef.current = null;
    };
    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener(
      "pointercancel",
      handleProjectPaneResizePointerCancel
    );
    window.addEventListener("blur", handleProjectPaneResizeWindowBlur);
    projectPaneDragCleanupRef.current = cleanup;
    target.setPointerCapture?.(event.pointerId);
    setProjectPaneDragging(true);
  }

  function finishProjectPaneResize(pointerEvent: ProjectPanePointerLike) {
    const drag = projectPaneDragRef.current;
    if (!drag || pointerEvent.pointerId !== drag.pointerId) {
      return;
    }
    handleProjectPaneResizePointerMove(pointerEvent);
    const currentDrag = projectPaneDragRef.current;
    if (!currentDrag) {
      return;
    }
    suppressProjectPaneClickRef.current = currentDrag.moved;
    if (currentDrag.moved) {
      const shouldCollapse = currentDrag.startCollapsed
        ? currentDrag.currentWidth < PROJECT_PANE_EXPAND_THRESHOLD
        : currentDrag.currentWidth < PROJECT_PANE_COLLAPSE_THRESHOLD;
      const nextWidth = shouldCollapse
        ? currentDrag.restoreWidth
        : Math.min(
            MAX_PROJECT_PANE_WIDTH,
            Math.max(MIN_PROJECT_PANE_WIDTH, currentDrag.currentWidth)
          );
      flushProjectPaneWidthPaint(shouldCollapse ? 0 : nextWidth);
      if (shouldCollapse) {
        if (currentDrag.restoreWidth >= MIN_PROJECT_PANE_WIDTH) {
          projectPaneLastWidthRef.current = currentDrag.restoreWidth;
        }
        setProjectPaneWidth(0);
      } else {
        updateProjectPaneWidth(nextWidth);
      }
    }
    projectPaneDragRef.current = null;
    setProjectPaneDragPreviewExpanded(false);
    stopProjectPaneDragging();
  }

  function cancelProjectPaneResize() {
    const drag = projectPaneDragRef.current;
    if (!drag) {
      return;
    }
    suppressProjectPaneClickRef.current = drag.moved;
    flushProjectPaneWidthPaint(drag.startWidth);
    setProjectPaneWidth(drag.startCollapsed ? 0 : drag.startWidth);
    projectPaneDragRef.current = null;
    setProjectPaneDragPreviewExpanded(false);
    stopProjectPaneDragging();
  }

  function handleProjectPaneResizePointerUp(event: ProjectPanePointerLike) {
    finishProjectPaneResize(event);
  }

  function handleProjectPaneResizePointerCancel() {
    cancelProjectPaneResize();
  }

  function handleProjectPaneResizeWindowBlur() {
    cancelProjectPaneResize();
  }

  function handleProjectPaneResizeClick() {
    if (suppressProjectPaneClickRef.current) {
      suppressProjectPaneClickRef.current = false;
      return;
    }
    toggleProjectPane();
  }

  function handleProjectPaneResizeKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>
  ) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    toggleProjectPane();
  }

  async function undoLastApprovalBatch() {
    if (undoableApprovals.length === 0 || batchProcessing) {
      return;
    }
    const targets = undoableApprovals.flatMap((entry) => {
      const record = records.find((candidate) => candidate.id === entry.id);
      return record ? [{ entry, record }] : [];
    });
    const remainingEntries = undoableApprovals.filter(
      (entry) => !targets.some(({ entry: target }) => target.id === entry.id)
    );
    const dirtyRecord = targets.find(({ record }) => dirtyRecordIds[record.id]);
    if (dirtyRecord) {
      toast.warning(copy.approvalAutosaveBusy);
      return;
    }
    setBatchProcessing(true);
    setSaveFailed(false);
    let undoneCount = 0;
    let failedCount = remainingEntries.length;
    try {
      for (const { entry, record } of targets) {
        try {
          await approveTmsSubmission(record.id, {
            expectedRevision: record.revision,
            restoreStatus: entry.restoreStatus,
          });
          undoneCount += 1;
        } catch {
          failedCount += 1;
          remainingEntries.push(entry);
        }
      }
      setUndoableApprovals(remainingEntries);
      if (failedCount) {
        setSaveFailed(true);
        toast.error(
          copy.approvalBatchPartial
            .replace("{action}", copy.undidAction)
            .replace("{success}", String(undoneCount))
            .replace("{failed}", String(failedCount))
        );
      }
      setSelectedApprovalProjectIds(new Set());
      await refreshRecords();
    } finally {
      setBatchProcessing(false);
    }
  }

  async function approveAllVisible() {
    if (batchProcessing) {
      return;
    }
    if (hasUndoableApprovals) {
      await undoLastApprovalBatch();
      return;
    }
    if (scopedPendingRecords.length === 0) {
      return;
    }
    if (scopedPendingRecords.some((record) => dirtyRecordIds[record.id])) {
      toast.warning(copy.approvalAutosaveBusy);
      return;
    }
    setBatchProcessing(true);
    setSaveFailed(false);
    let approvedCount = 0;
    let failedCount = 0;
    const approvedEntries: ApprovalUndoEntry[] = [];
    try {
      for (const record of scopedPendingRecords) {
        try {
          await approveTmsSubmission(record.id, {
            expectedRevision: record.revision,
          });
          approvedCount += 1;
          if (
            record.status === "SUBMITTED" ||
            record.status === "PENDING_CONFIRMATION"
          ) {
            approvedEntries.push({
              id: record.id,
              restoreStatus: record.status,
            });
          }
        } catch {
          failedCount += 1;
        }
      }
      setUndoableApprovals(approvedEntries);
      if (failedCount) {
        setSaveFailed(true);
        toast.error(
          copy.approvalBatchPartial
            .replace("{action}", copy.approvedAction)
            .replace("{success}", String(approvedCount))
            .replace("{failed}", String(failedCount))
        );
      }
      setSelectedApprovalProjectIds(new Set());
      await refreshRecords();
    } finally {
      setBatchProcessing(false);
    }
  }

  async function reviewRecords(
    targets: TmsApprovalRecord[],
    action: "approve" | "return",
    busyId: string,
    reason?: string
  ) {
    if (targets.length === 0 || actionId || batchProcessing) {
      return;
    }
    const dirtyRecord = targets.find((record) => dirtyRecordIds[record.id]);
    if (dirtyRecord) {
      toast.warning(copy.approvalAutosaveBusy);
      return;
    }
    setUndoableApprovals([]);
    setActionId(busyId);
    setSaveFailed(false);
    try {
      for (const record of targets) {
        await (action === "approve"
          ? approveTmsSubmission(record.id, {
              expectedRevision: record.revision,
            })
          : returnTmsSubmission(record.id, {
              expectedRevision: record.revision,
              reason: reason?.trim() || undefined,
            }));
      }
      await refreshRecords();
    } catch {
      setSaveFailed(true);
      toast.error(
        copy.approvalActionFailed.replace(
          "{action}",
          action === "approve" ? copy.approve : copy.return
        )
      );
    } finally {
      setActionId(null);
    }
  }

  function getReviewTargets(
    groupRecords: TmsApprovalRecord[],
    action: "approve" | "return"
  ) {
    const activeStatuses =
      action === "approve"
        ? ["SUBMITTED", "PENDING_CONFIRMATION"]
        : ["SUBMITTED", "RETURNED", "PENDING_CONFIRMATION"];
    const targets = groupRecords.filter((record) =>
      activeStatuses.includes(record.status)
    );
    const toggleStatus = action === "approve" ? "APPROVED" : "RETURNED";
    return targets.length > 0
      ? targets
      : groupRecords.filter((record) => record.status === toggleStatus);
  }

  async function toggleEditAll() {
    if (!editingAll) {
      setSaveFailed(false);
      setEditingAll(true);
      return;
    }

    const changedRecords = records.filter((record) => {
      const draftRows = draftRowsByRecordId[record.id];
      return (
        record.status !== "NOT_SUBMITTED" &&
        Boolean(dirtyRecordIds[record.id]) &&
        Boolean(draftRows) &&
        !approvalRowsHoursEqual(
          normalizeApprovalRows(record.submittedRows),
          draftRows ?? []
        )
      );
    });
    if (changedRecords.length === 0) {
      setEditingAll(false);
      setDirtyRecordIds({});
      setSaveFailed(false);
      return;
    }

    setUndoableApprovals([]);
    setBatchProcessing(true);
    setSaveFailed(false);
    const savedRecords = new Map<string, TmsApprovalRecord>();
    try {
      for (const record of changedRecords) {
        const draftRows = draftRowsByRecordId[record.id];
        if (!draftRows) {
          continue;
        }
        setSavingRecordId(record.id);
        const saved = await editTmsSubmission(record.id, {
          expectedRevision: record.revision,
          rows: draftRows as unknown as TmsApprovalRecord["submittedRows"],
        });
        savedRecords.set(saved.id, saved);
      }
      setRecords((current) =>
        current.map((record) => savedRecords.get(record.id) ?? record)
      );
      setDirtyRecordIds({});
      setEditingAll(false);
    } catch {
      setSaveFailed(true);
      toast.error(copy.approvalAutosaveFailed);
    } finally {
      setSavingRecordId(null);
      setBatchProcessing(false);
    }
  }

  function approveGroup(group: ApprovalRecordGroup) {
    void reviewRecords(
      getReviewTargets(group.records, "approve"),
      "approve",
      group.id
    );
  }

  function returnGroup(group: ApprovalRecordGroup) {
    const targets = getReviewTargets(group.records, "return");
    if (targets.length === 0) {
      return;
    }
    setReturnReason("");
    setReturnDialog({ groupId: group.id, targets });
  }

  function closeReturnDialog() {
    if (actionId) {
      return;
    }
    setReturnDialog(null);
    setReturnReason("");
  }

  function confirmReturn() {
    if (!returnDialog) {
      return;
    }
    const reason = returnReason.trim();
    if (!reason) {
      toast.warning(copy.returnReasonRequired);
      return;
    }
    const dialog = returnDialog;
    setReturnDialog(null);
    setReturnReason("");
    void reviewRecords(dialog.targets, "return", dialog.groupId, reason);
  }

  function handleHourChange(
    record: TmsApprovalRecord,
    date: string,
    value: string,
    rowType?: ApprovalRowType
  ) {
    if (
      record.status === "NOT_SUBMITTED" ||
      !isRecordDateEditable(record, date)
    ) {
      return;
    }
    const hours = value === "" ? 0 : Number(value);
    if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
      return;
    }
    const currentRows =
      draftRowsByRecordId[record.id] ??
      normalizeApprovalRows(record.submittedRows);
    const nextRows = updateRecordDayHours(currentRows, date, hours, rowType);
    if (approvalRowsHoursEqual(currentRows, nextRows)) {
      return;
    }
    setUndoableApprovals([]);
    setSaveFailed(false);
    setDraftRowsByRecordId((current) => ({
      ...current,
      [record.id]: nextRows,
    }));
    setDirtyRecordIds((current) => ({
      ...current,
      [record.id]: !approvalRowsHoursEqual(
        normalizeApprovalRows(record.submittedRows),
        nextRows
      ),
    }));
  }

  function handlePeriodChange(value: string | null) {
    if (!value) {
      return;
    }
    autoPeriodRef.current = false;
    setPeriod(value as PeriodKey);
  }

  const showTypeColumn = true;
  const typeColumnClassName = "approval-type-column";
  const liveProjectPaneDrag = projectPaneDragRef.current;
  const isProjectPaneCollapsed =
    projectPaneWidth === 0 && !projectPaneDragPreviewExpanded;
  const visibleProjectPaneWidth = liveProjectPaneDrag?.moved
    ? liveProjectPaneDrag.currentWidth
    : isProjectPaneCollapsed
      ? 0
      : projectPaneWidth;

  if (phone) {
    const busy =
      Boolean(actionId) || batchProcessing || Boolean(savingRecordId);
    return (
      <main
        className={cn(
          "flex flex-col overflow-hidden",
          renderHeader ? "h-dvh" : "h-[calc(100dvh-3.5rem)]"
        )}
      >
        {renderHeader && (
          <TmsHeader
            approvalActive
            approvalPending={approvalPending}
            locale={locale}
            user={user}
            onOpenQuery={onOpenQuery}
            onOpenTimesheet={onBack}
            onReturn={onBack}
            returnTarget="TIMESHEET"
            onSignOut={onSignOut}
          />
        )}
        <div className={cn(mobileStyles.root, mobileStyles.padded)}>
          <ApprovalMobile
            locale={locale}
            projects={visibleProjects}
            selectedProject={selectedProject}
            projectGroups={visibleApprovalProjects}
            loading={loading}
            error={loadError}
            onRetry={() => setLoadVersion((value) => value + 1)}
            search={projectSearch}
            onSearch={setProjectSearch}
            pendingOnly={pendingProjectsOnly}
            onPendingOnly={setPendingProjectsOnly}
            onProject={(project) => {
              if (selectedProject?.engagementId !== project.engagementId) {
                setRecords([]);
              }
              setSelectedProject(project);
            }}
            days={days}
            editing={editingAll}
            busy={busy}
            canEdit={hasEditableVisibleRecords}
            onEdit={() => void toggleEditAll()}
            onApprove={approveGroup}
            onReturn={returnGroup}
            feedback={
              saveFailed ? copy.approvalAutosaveFailed : busy ? copy.saving : ""
            }
            nameFilters={matrixNameFilters}
            onClearNameFilters={() => setMatrixNameFilters([])}
            selectedIds={selectedApprovalProjectIds}
            onSelectProjectGroup={(id) =>
              setSelectedApprovalProjectIds((current) => {
                const next = new Set(current);
                if (next.has(id)) {
                  next.delete(id);
                } else {
                  next.add(id);
                }
                return next;
              })
            }
            batchActions={[
              {
                label: hasUndoableApprovals
                  ? copy.undoApproval
                  : selectedApprovalProjectIds.size
                    ? mobileCopy.approveSelected.replace(
                        "{count}",
                        String(selectedApprovalProjectIds.size)
                      )
                    : copy.approveAll,
                onClick: () => void approveAllVisible(),
                disabled:
                  busy ||
                  editingAll ||
                  (!scopedPendingRecords.length && !hasUndoableApprovals),
              },
              {
                label: editingAll ? copy.finishEditing : copy.editHours,
                onClick: () => void toggleEditAll(),
                disabled: busy || !hasEditableVisibleRecords,
              },
            ]}
            getTotal={(group, type) =>
              getApprovalTotal(
                getGroupRows(group, draftRowsByRecordId),
                days,
                type
              )
            }
            getCell={(group, day, type) => {
              const draftRows = getGroupRows(group, draftRowsByRecordId);
              const rowRows = draftRows.filter(
                (row) => getApprovalRowType(row) === type
              );
              const record = getApprovalRecordForDate(group.records, day.date);
              const available = getApprovalRecordForDate(
                group.allRecords,
                day.date
              );
              const filtered =
                statusFilters.length > 0 && !record && Boolean(available);
              const hours = filtered ? 0 : getRowsDayHours(rowRows, day.date);
              const missing =
                day.isWorkday && getRowsDayHours(draftRows, day.date) === 0;
              const unavailable =
                filtered ||
                !record ||
                record.status === "NOT_SUBMITTED" ||
                missing ||
                (!day.isWorkday && hours === 0);
              const editable = Boolean(
                editingAll &&
                record &&
                record.status !== "NOT_SUBMITTED" &&
                !missing &&
                draftRows.some((row) => getApprovalRowType(row) !== null) &&
                isRecordDateEditable(record, day.date)
              );
              return {
                hours,
                unavailable,
                editable,
                onChange: (value) => {
                  if (editable && record) {
                    handleHourChange(record, day.date, value, type);
                  }
                },
              };
            }}
            periodControls={
              <TmsMobileControls
                locale={locale}
                label={mobileCopy.period}
                disabled={editingAll || busy}
                title={`${year} / ${month} · ${getPeriodLabel(period, locale)}${statusFilters.length ? ` · ${statusFilters.map((status) => getApprovalStatusLabel(status, locale)).join(", ")}` : ""}`}
              >
                <ApprovalFilterSelect
                  label={copy.year}
                  value={String(year)}
                  options={yearOptions.map((value) => ({
                    value: String(value),
                    label: String(value),
                  }))}
                  onValueChange={(value) => value && setYear(Number(value))}
                />
                <ApprovalFilterSelect
                  label={copy.month}
                  value={String(month)}
                  options={getTmsMonthLabels(locale).map((label, i) => ({
                    label,
                    value: String(i + 1),
                  }))}
                  onValueChange={(value) => value && setMonth(Number(value))}
                />
                <ApprovalFilterSelect
                  label={copy.period}
                  value={period}
                  options={(["all", "first", "second"] as const).map(
                    (value) => ({ value, label: getPeriodLabel(value, locale) })
                  )}
                  onValueChange={handlePeriodChange}
                />
                <ApprovalFilterSelect
                  label={copy.status}
                  value={
                    statusFilters.length > 1
                      ? "current"
                      : (statusFilters[0] ?? "all")
                  }
                  options={[
                    { value: "all", label: mobileCopy.allStatuses },
                    ...(statusFilters.length > 1
                      ? [
                          {
                            value: "current",
                            label: statusFilters
                              .map((status) =>
                                getApprovalStatusLabel(status, locale)
                              )
                              .join(", "),
                          },
                        ]
                      : []),
                    ...APPROVAL_STATUS_VALUES.map((value) => ({
                      value,
                      label: getApprovalStatusLabel(value, locale),
                    })),
                  ]}
                  onValueChange={(value) => {
                    if (value && value !== "current") {
                      setStatusFilters(
                        value === "all"
                          ? []
                          : [value as TmsApprovalRecord["status"]]
                      );
                    }
                  }}
                />
              </TmsMobileControls>
            }
          />
        </div>
        <MobileActionSheet
          open={Boolean(returnDialog)}
          onOpenChange={(open) => {
            if (!open) {
              closeReturnDialog();
            }
          }}
          title={copy.returnReasonTitle}
          closeLabel={copy.cancel}
        >
          <div className={mobileStyles.fields}>
            <p>{copy.returnReasonDescription}</p>
            <MobileTextArea
              aria-label={copy.returnReasonTitle}
              value={returnReason}
              maxLength={1000}
              onChange={(event) => setReturnReason(event.target.value)}
            />
            <MobileButton
              variant="primary"
              disabled={!returnReason.trim() || Boolean(actionId)}
              onClick={confirmReturn}
            >
              {copy.return}
            </MobileButton>
          </div>
        </MobileActionSheet>
      </main>
    );
  }
  return (
    <main
      className={cn(
        renderHeader ? "h-screen" : "h-[calc(100vh-3.5rem)]",
        "overflow-hidden bg-background text-foreground"
      )}
    >
      {renderHeader ? (
        <TmsHeader
          approvalActive
          approvalPending={approvalPending}
          locale={locale}
          user={user}
          onOpenQuery={onOpenQuery}
          onOpenTimesheet={onBack}
          onReturn={onBack}
          returnTarget="TIMESHEET"
          onSignOut={onSignOut}
        />
      ) : null}

      <div
        data-testid="approval-workspace-shell"
        className={cn(
          "mx-auto grid min-h-0 w-full max-w-none grid-rows-[minmax(0,1fr)] overflow-hidden px-4 py-2",
          renderHeader ? "h-[calc(100vh-3.5rem)]" : "h-full"
        )}
      >
        <section
          data-project-pane-width={visibleProjectPaneWidth}
          ref={projectPaneFrameRef}
          style={
            {
              "--project-pane-width": `${visibleProjectPaneWidth}px`,
            } as React.CSSProperties
          }
          className={cn(
            "grid min-h-0 gap-1 overflow-hidden transition-[grid-template-columns] duration-[var(--motion-panel)] ease-[var(--motion-ease-emphasized)] lg:grid-cols-[var(--project-pane-width)_8px_minmax(0,1fr)]"
          )}
        >
          <div
            data-testid="approval-project-pane"
            data-project-pane-width={visibleProjectPaneWidth}
            ref={projectPaneContentRef}
            className={cn(
              "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card p-3 shadow-sm transition-[opacity,padding,border-color,box-shadow] duration-[var(--motion-panel)] ease-[var(--motion-ease-emphasized)]",
              isProjectPaneCollapsed &&
                "pointer-events-none border-transparent bg-transparent p-0 opacity-0 shadow-none"
            )}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{copy.myProjects}</h2>
              <span className="text-xs text-muted-foreground">
                {visibleProjects.length} {copy.projectCount}
              </span>
            </div>
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute top-2 left-2.5 size-3.5 text-muted-foreground" />
              <Input
                value={projectSearch}
                onChange={(event) => setProjectSearch(event.target.value)}
                placeholder={copy.searchProjectPlaceholder}
                className="h-8 px-20 pl-8 text-xs"
              />
              <Popover
                open={projectFilterOpen}
                onOpenChange={setProjectFilterOpen}
              >
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant={pendingProjectsOnly ? "secondary" : "ghost"}
                      size="sm"
                      aria-label={copy.projectApprovalFilter}
                      className="absolute top-1 right-1 h-6 px-2 text-[0.68rem]"
                    >
                      <ListFilter className="size-3" />
                      {pendingProjectsOnly ? copy.pendingOnly : copy.all}
                    </Button>
                  }
                />
                <PopoverContent
                  align="end"
                  sideOffset={4}
                  className="w-36 gap-1 p-1"
                >
                  <Button
                    type="button"
                    variant={pendingProjectsOnly ? "ghost" : "secondary"}
                    aria-pressed={!pendingProjectsOnly}
                    className="h-8 justify-start px-2 text-xs"
                    onClick={() => {
                      setPendingProjectsOnly(false);
                      setProjectFilterOpen(false);
                    }}
                  >
                    {copy.all}
                  </Button>
                  <Button
                    type="button"
                    variant={pendingProjectsOnly ? "secondary" : "ghost"}
                    aria-pressed={pendingProjectsOnly}
                    className="h-8 justify-start px-2 text-xs"
                    onClick={() => {
                      setPendingProjectsOnly(true);
                      setProjectFilterOpen(false);
                    }}
                  >
                    {copy.pendingOnly}
                  </Button>
                </PopoverContent>
              </Popover>
            </div>
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
              <div className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border/70 bg-background">
                {visibleProjects.map((project) => {
                  const active =
                    project.engagementId === selectedProject?.engagementId;
                  return (
                    <Button
                      key={project.engagementId}
                      type="button"
                      variant="ghost"
                      onClick={() => setSelectedProject(project)}
                      className={cn(
                        "relative h-auto w-full min-w-0 items-center justify-start overflow-hidden rounded-none border-0 px-3 py-2.5 text-left whitespace-normal shadow-none",
                        active
                          ? "bg-success/5 hover:bg-success/10"
                          : "hover:bg-muted/50"
                      )}
                    >
                      {active ? (
                        <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-success" />
                      ) : null}
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {project.engagementCode}
                          </p>
                          <p className="mt-0.5 truncate text-xs font-normal text-muted-foreground">
                            {project.clientName}
                          </p>
                        </div>
                        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                      </div>
                    </Button>
                  );
                })}
                {projects.length === 0 && (
                  <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                    {copy.noMatchingProjects}
                  </p>
                )}
              </div>
            </div>
          </div>

          <ProjectPaneResizeHandle
            collapsed={isProjectPaneCollapsed}
            dragging={projectPaneDragging}
            label={
              localeProp ? copy.projectPaneResize : copy.resizeProjectPaneLegacy
            }
            onClick={handleProjectPaneResizeClick}
            onKeyDown={handleProjectPaneResizeKeyDown}
            onPointerDown={handleProjectPaneResizePointerDown}
            onPointerMove={handleProjectPaneResizePointerMove}
            onPointerUp={handleProjectPaneResizePointerUp}
            onPointerCancel={handleProjectPaneResizePointerCancel}
          />

          <div
            data-resizable-review-container
            className="relative flex min-h-0 min-w-0 flex-col overflow-hidden"
          >
            <div
              data-testid="approval-matrix-card"
              className="relative flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-border bg-card p-3 shadow-sm"
            >
              <div className="flex shrink-0 flex-wrap items-end justify-between gap-2 border-b border-border pb-2">
                <div>
                  <div
                    data-testid="approval-project-heading"
                    className="flex items-center gap-2"
                  >
                    <h2 className="text-base font-semibold">
                      {selectedProject?.engagementCode ?? copy.selectProject}
                    </h2>
                    <StatefulMotionButton
                      aria-label={
                        saveState === "saving"
                          ? copy.saving
                          : saveState === "failed"
                            ? copy.approvalSaveFailedStatus
                            : saveState === "dirty"
                              ? copy.approvalUnsaved
                              : copy.saved
                      }
                      data-testid="approval-save-status"
                      data-save-state={saveState}
                      size="sm"
                      variant="ghost"
                      className="h-7 shrink-0 cursor-pointer px-2 text-xs! [&_.lucide-x]:text-destructive [&_svg]:size-3.5"
                      state={saveButtonState}
                      loadingText={copy.saving}
                      successText={copy.saved}
                      errorText={copy.approvalSaveFailedStatus}
                      onClick={() => {
                        if (saveState === "dirty" && editingAll) {
                          void toggleEditAll();
                        }
                      }}
                    >
                      {copy.approvalUnsaved}
                    </StatefulMotionButton>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span
                      aria-label={`${locale === "zh-CN" ? "客户" : "Client"} ${selectedProject?.clientName ?? "-"}`}
                      className="inline-flex min-w-0 items-center gap-1"
                      title={locale === "zh-CN" ? "客户" : "Client"}
                    >
                      <Building2 className="size-3.5 shrink-0" />
                      <span className="truncate">
                        {selectedProject?.clientName ?? "-"}
                      </span>
                    </span>
                    <span
                      aria-label={`${copy.pic} ${selectedProject?.pic ?? "-"}`}
                      className="inline-flex items-center gap-1"
                      title={copy.pic}
                    >
                      <ShieldCheck className="size-3.5 shrink-0" />
                      {selectedProject?.pic ?? "-"}
                    </span>
                    <span
                      aria-label={`${copy.mic} ${selectedProject?.mic ?? "-"}`}
                      className="inline-flex items-center gap-1"
                      title={copy.mic}
                    >
                      <UserCog className="size-3.5 shrink-0" />
                      {selectedProject?.mic ?? "-"}
                    </span>
                  </div>
                </div>
                <div
                  data-testid="approval-header-controls"
                  className="flex flex-wrap items-end justify-end gap-2"
                >
                  <div className="grid w-full grid-cols-1 gap-2 min-[400px]:w-auto min-[400px]:grid-cols-[5.5rem_5.5rem_8rem]">
                    <ApprovalFilterSelect
                      label={getTmsWorkspaceCopy(controlLocale).year}
                      value={String(year)}
                      onValueChange={(value) => value && setYear(Number(value))}
                      options={yearOptions.map((item) => ({
                        value: String(item),
                        label: String(item),
                      }))}
                    />
                    <ApprovalFilterSelect
                      label={getTmsWorkspaceCopy(controlLocale).month}
                      value={String(month)}
                      onValueChange={(value) =>
                        value && setMonth(Number(value))
                      }
                      options={getTmsMonthLabels(controlLocale).map(
                        (label, index) => ({
                          value: String(index + 1),
                          label,
                        })
                      )}
                    />
                    <ApprovalFilterSelect
                      label={getTmsWorkspaceCopy(controlLocale).period}
                      value={period}
                      onValueChange={handlePeriodChange}
                      options={(["all", "first", "second"] as const).map(
                        (item) => ({
                          value: item,
                          label: getPeriodLabel(item, controlLocale),
                        })
                      )}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      className="h-8 w-[6.5rem] text-xs"
                      disabled={
                        editingAll ||
                        (scopedPendingRecords.length === 0 &&
                          !hasUndoableApprovals) ||
                        batchProcessing
                      }
                      onClick={() => void approveAllVisible()}
                    >
                      {hasUndoableApprovals && !batchProcessing ? (
                        <Undo2 />
                      ) : (
                        <Check />
                      )}
                      {batchProcessing
                        ? hasUndoableApprovals
                          ? copy.undoing
                          : copy.approving
                        : hasUndoableApprovals
                          ? copy.undoApproval
                          : selectedApprovalProjectIds.size > 0
                            ? locale === "zh-CN"
                              ? `批准所选（${selectedApprovalProjectIds.size}）`
                              : `Approve selected (${selectedApprovalProjectIds.size})`
                            : copy.approveAll}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={editingAll ? "default" : "outline"}
                      className="h-8 w-20 text-xs"
                      aria-pressed={editingAll}
                      data-testid="approval-edit-toggle"
                      disabled={
                        !hasEditableVisibleRecords ||
                        Boolean(actionId) ||
                        batchProcessing
                      }
                      onClick={() => void toggleEditAll()}
                    >
                      {editingAll ? copy.finishEditing : copy.editHours}
                    </Button>
                  </div>
                </div>
              </div>

              <div
                data-testid="approval-results-frame"
                data-approval-results-state="ready"
                className="approval-results-frame mt-2 min-h-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto bg-muted/10 p-1"
              >
                {visibleApprovalProjects.map((approvalProject) => {
                  const projectRecords = approvalProject.groups.flatMap(
                    (group) => group.records
                  );
                  const pendingCount = projectRecords.filter((record) =>
                    ["SUBMITTED", "PENDING_CONFIRMATION"].includes(
                      record.status
                    )
                  ).length;
                  const notSubmittedCount = projectRecords.filter(
                    (record) => record.status === "NOT_SUBMITTED"
                  ).length;
                  const expanded = expandedApprovalProjectIds.has(
                    approvalProject.id
                  );
                  const selectable =
                    !approvalProject.id.startsWith("legacy:") &&
                    pendingCount > 0 &&
                    notSubmittedCount === 0;
                  const selected = selectedApprovalProjectIds.has(
                    approvalProject.id
                  );
                  const projectHeader = (
                    <div
                      className="border-b border-border bg-card"
                      data-testid={`approval-project-${approvalProject.id}`}
                      key={`project-${approvalProject.id}`}
                    >
                      <div className="flex items-center gap-2 px-3 py-2">
                        <Checkbox
                          aria-label={`${locale === "zh-CN" ? "选择项目" : "Select project"} ${approvalProject.name}`}
                          checked={selected}
                          disabled={!selectable}
                          onCheckedChange={(checked) => {
                            setSelectedApprovalProjectIds((current) => {
                              const next = new Set(current);
                              if (checked) {
                                next.add(approvalProject.id);
                              } else {
                                next.delete(approvalProject.id);
                              }
                              return next;
                            });
                          }}
                        />
                        <Button
                          aria-expanded={expanded}
                          aria-label={`${expanded ? (locale === "zh-CN" ? "收起" : "Collapse") : locale === "zh-CN" ? "展开" : "Expand"} ${approvalProject.name}`}
                          className="size-7 shadow-none"
                          onClick={() =>
                            setExpandedApprovalProjectIds((current) => {
                              const next = new Set(current);
                              if (expanded) {
                                next.delete(approvalProject.id);
                              } else {
                                next.add(approvalProject.id);
                              }
                              return next;
                            })
                          }
                          size="icon-sm"
                          variant="ghost"
                        >
                          {expanded ? <ChevronDown /> : <ChevronRight />}
                        </Button>
                        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                          <FolderKanban className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {approvalProject.name}
                          </p>
                          <p className="truncate text-[0.68rem] text-muted-foreground">
                            {approvalProject.code}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          {approvalProject.groups.length}{" "}
                          {locale === "zh-CN" ? "人" : "people"}
                        </span>
                      </div>
                      {notSubmittedCount > 0 ? (
                        <p className="border-t border-l-2 border-border border-l-warning-accent bg-warning-subtle px-3 py-1.5 text-[0.68rem] text-foreground">
                          {locale === "zh-CN"
                            ? `${notSubmittedCount} 名员工尚未提交，解决后可批量选择该项目。`
                            : `${notSubmittedCount} employees have not submitted; resolve them before selecting this project.`}
                        </p>
                      ) : null}
                    </div>
                  );
                  const projectColumnHeader = (
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr>
                        <th className="sticky left-0 z-20 h-8 w-[112px] min-w-[112px] border-r border-border bg-muted px-2 py-1 font-medium">
                          <ApprovalColumnFilterHeader
                            label={matrixLabels.name}
                            options={nameFilterOptions.map((value) => ({
                              value,
                              label: value,
                            }))}
                            selectedValues={matrixNameFilters}
                            onChange={setMatrixNameFilters}
                            copy={localeProp ? copy : undefined}
                          />
                        </th>
                        <th className="sticky left-[112px] z-20 h-8 w-[104px] min-w-[104px] border-r border-border bg-muted px-1 py-1 text-center font-medium">
                          {matrixLabels.operation}
                        </th>
                        <th className="sticky left-[216px] z-20 h-8 w-[88px] min-w-[88px] border-r border-border bg-muted px-1 py-1 font-medium">
                          <ApprovalColumnFilterHeader
                            label={matrixLabels.status}
                            options={APPROVAL_STATUS_VALUES.map((value) => ({
                              value,
                              label: getApprovalStatusLabel(value, locale),
                            }))}
                            selectedValues={statusFilters}
                            onChange={(values) =>
                              setStatusFilters(
                                values as TmsApprovalRecord["status"][]
                              )
                            }
                            copy={localeProp ? copy : undefined}
                          />
                        </th>
                        {showTypeColumn ? (
                          <th
                            data-testid={`approval-type-column-${approvalProject.id}`}
                            data-approval-type-column-state="open"
                            className={cn(
                              "sticky left-[304px] z-20 h-8 w-[64px] min-w-[64px] border-r border-border bg-muted px-1 py-1 text-center font-medium",
                              typeColumnClassName
                            )}
                          >
                            {matrixLabels.approvalType}
                          </th>
                        ) : null}
                        {days.map((day) => (
                          <th
                            key={`${approvalProject.id}-${day.date}`}
                            className="h-8 w-[46px] min-w-[46px] border-r border-border bg-muted/40 px-1 py-0 text-center font-medium"
                          >
                            <span className="block leading-4 text-foreground">
                              {day.dayOfMonth}
                            </span>
                            <span className="block text-[0.62rem] leading-3">
                              {day.weekdayLabel}
                            </span>
                          </th>
                        ))}
                        <th className="h-8 w-[66px] min-w-[66px] border-r border-border bg-muted/40 px-1 py-1 text-center font-medium">
                          {matrixLabels.approvalTotal}
                        </th>
                        <th className="h-8 w-[222px] min-w-[222px] border-r border-border bg-muted/40 px-2 py-1 font-medium">
                          {matrixLabels.description}
                        </th>
                      </tr>
                    </thead>
                  );
                  const projectRows = approvalProject.groups.flatMap(
                    (group) => {
                      const draftRows = getGroupRows(
                        group,
                        draftRowsByRecordId
                      );
                      const hasChargeableRows = draftRows.some(
                        (row) => getApprovalRowType(row) !== null
                      );
                      const rowTypes = [...APPROVAL_DISPLAY_ROW_TYPES];
                      const totals = Object.fromEntries(
                        APPROVAL_DISPLAY_ROW_TYPES.map((rowType) => [
                          rowType,
                          getApprovalTotal(draftRows, days, rowType),
                        ])
                      ) as Record<ApprovalDisplayRowType, number>;
                      return rowTypes.map((rowType, rowIndex) => {
                        const rowRows = rowType
                          ? draftRows.filter(
                              (row) => getApprovalRowType(row) === rowType
                            )
                          : draftRows;
                        const description = getApprovalDescription(rowRows);
                        const isParent = rowIndex === 0;
                        const approveActive =
                          group.records.length > 0 &&
                          group.records.every(
                            (record) => record.status === "APPROVED"
                          );
                        const returnActive =
                          group.records.length > 0 &&
                          group.records.every(
                            (record) => record.status === "RETURNED"
                          );
                        const canApprove = group.records.some((record) =>
                          [
                            "SUBMITTED",
                            "APPROVED",
                            "PENDING_CONFIRMATION",
                          ].includes(record.status)
                        );
                        const canReturn = group.records.some((record) =>
                          [
                            "SUBMITTED",
                            "RETURNED",
                            "PENDING_CONFIRMATION",
                          ].includes(record.status)
                        );
                        const groupBusy = group.records.some(
                          (record) => savingRecordId === record.id
                        );
                        const rowId = rowType
                          ? `${group.id}-${rowType.toLowerCase()}`
                          : group.id;
                        const reactRowKey = rowId;
                        const isExtraDetailRow = rowType === "OT";
                        return (
                          <tr
                            key={reactRowKey}
                            style={{
                              viewTransitionName:
                                getApprovalRowTransitionName(reactRowKey),
                            }}
                            data-testid={`approval-row-${rowId}`}
                            data-approval-row-group={group.id}
                            data-approval-row-type={rowType}
                            data-approval-detail-row="true"
                            className={cn(
                              "relative h-7 border-t border-border align-middle transition-[background-color,opacity,transform] duration-[var(--motion-panel)] ease-[var(--motion-ease-emphasized)] last:border-b [&>td]:border-t [&>td]:border-border last:[&>td]:border-b",
                              isExtraDetailRow
                                ? "approval-detail-row z-10"
                                : "z-20",
                              approveActive && "bg-muted/20"
                            )}
                          >
                            <td className="sticky left-0 z-40 w-[112px] min-w-[112px] border-r border-border bg-card p-0 align-middle">
                              {isParent ? (
                                <div className="absolute inset-x-0 top-0 z-50 flex h-14 min-w-0 items-center bg-card px-2">
                                  <span
                                    className="truncate px-0.5 font-semibold"
                                    data-testid={`approval-name-${group.id}`}
                                  >
                                    {group.ownerName}
                                  </span>
                                </div>
                              ) : null}
                            </td>
                            <td className="sticky left-[112px] z-40 w-[104px] min-w-[104px] border-r border-border bg-card p-0 text-center align-middle">
                              {isParent ? (
                                <div
                                  className="absolute inset-x-0 top-0 z-50 flex h-14 items-center justify-center gap-1.5 rounded-md bg-card"
                                  data-testid={`approval-actions-${group.id}`}
                                >
                                  {canApprove ? (
                                    <Button
                                      size="icon-sm"
                                      variant="outline"
                                      aria-label={`${copy.approve} ${group.ownerName}`}
                                      className={cn(
                                        "size-7 shadow-none",
                                        approveActive
                                          ? "border-success bg-success text-success-foreground hover:border-success/80 hover:bg-success/85 hover:text-success-foreground"
                                          : "border-success/30 text-success hover:border-success/50 hover:bg-success/10 hover:text-success"
                                      )}
                                      disabled={
                                        Boolean(actionId) ||
                                        batchProcessing ||
                                        editingAll ||
                                        groupBusy
                                      }
                                      onClick={() => approveGroup(group)}
                                    >
                                      <Check />
                                    </Button>
                                  ) : null}
                                  {canReturn ? (
                                    <Button
                                      size="icon-sm"
                                      variant="outline"
                                      aria-label={`${copy.return} ${group.ownerName}`}
                                      className={cn(
                                        "size-7 shadow-none",
                                        returnActive
                                          ? "border-destructive bg-destructive text-destructive-foreground hover:border-destructive/80 hover:bg-destructive/85 hover:text-destructive-foreground"
                                          : "border-destructive/30 text-destructive hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                                      )}
                                      disabled={
                                        Boolean(actionId) ||
                                        batchProcessing ||
                                        editingAll ||
                                        groupBusy
                                      }
                                      onClick={() => returnGroup(group)}
                                    >
                                      <X />
                                    </Button>
                                  ) : null}
                                  {!canApprove && !canReturn ? (
                                    <span className="text-muted-foreground">
                                      —
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                            </td>
                            <td className="sticky left-[216px] z-40 w-[88px] min-w-[88px] border-r border-border bg-card p-0 text-center align-middle">
                              {isParent ? (
                                <div className="absolute inset-x-0 top-0 z-50 flex h-14 items-center justify-center bg-card px-1">
                                  <ApprovalStatusSummary
                                    group={group}
                                    filtered={statusFilters.length > 0}
                                    locale={locale}
                                  />
                                </div>
                              ) : null}
                            </td>
                            {showTypeColumn ? (
                              <td
                                className={cn(
                                  "sticky left-[304px] z-40 w-[64px] min-w-[64px] border-r border-border bg-card px-1 py-0.5 text-center font-medium",
                                  typeColumnClassName
                                )}
                              >
                                <span
                                  data-testid={`approval-detail-content-${rowId}`}
                                >
                                  {getTimesheetWorkTypeLabel(
                                    rowType,
                                    detailLocale
                                  )}
                                </span>
                              </td>
                            ) : null}
                            {days.map((day) => {
                              const record = getApprovalRecordForDate(
                                group.records,
                                day.date
                              );
                              const availableRecord = getApprovalRecordForDate(
                                group.allRecords,
                                day.date
                              );
                              const filteredOutCell =
                                statusFilters.length > 0 &&
                                !record &&
                                Boolean(availableRecord);
                              const hours = filteredOutCell
                                ? 0
                                : getRowsDayHours(rowRows, day.date);
                              const dayTotalHours = getRowsDayHours(
                                draftRows,
                                day.date
                              );
                              const missingWorkday =
                                day.isWorkday && dayTotalHours === 0;
                              const unsubmittedCell =
                                !filteredOutCell &&
                                (!record ||
                                  record.status === "NOT_SUBMITTED" ||
                                  missingWorkday ||
                                  (!day.isWorkday && hours === 0));
                              const editable = Boolean(
                                editingAll &&
                                record &&
                                record.status !== "NOT_SUBMITTED" &&
                                !missingWorkday &&
                                hasChargeableRows &&
                                isRecordDateEditable(record, day.date)
                              );
                              const hoursInput = (
                                <HoursInput
                                  aria-label={`${group.ownerName} ${getTimesheetWorkTypeLabel(rowType, ariaLocale)} ${day.date} ${ariaHours}`}
                                  readOnly={!editable}
                                  disabled={unsubmittedCell}
                                  className={cn(
                                    "mx-auto h-6 w-[38px] rounded-md px-0 text-center text-[0.7rem] font-semibold [appearance:textfield] disabled:border-transparent disabled:bg-transparent disabled:text-muted-foreground [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                                    editable
                                      ? hours > 0
                                        ? "border-primary/30 bg-primary/10 text-primary"
                                        : "border-input bg-background text-foreground"
                                      : "border-transparent bg-muted text-muted-foreground"
                                  )}
                                  title={
                                    unsubmittedCell
                                      ? copy.notSubmittedCannotEdit
                                      : editingAll
                                        ? undefined
                                        : copy.editHoursHint
                                  }
                                  value={hours}
                                  onChange={
                                    editable && record
                                      ? (value) =>
                                          handleHourChange(
                                            record,
                                            day.date,
                                            value,
                                            rowType
                                          )
                                      : () => {}
                                  }
                                />
                              );
                              return (
                                <td
                                  key={day.date}
                                  className="h-7 border-r border-border p-0 text-center"
                                >
                                  {filteredOutCell ? (
                                    <span
                                      data-testid={`approval-filtered-out-cell-${group.id}-${rowType.toLowerCase()}-${day.date}`}
                                      className="text-xs text-muted-foreground"
                                      title={copy.filteredStatusHalf}
                                    >
                                      —
                                    </span>
                                  ) : unsubmittedCell ? (
                                    <span
                                      data-testid={`approval-unsubmitted-cell-${group.id}-${rowType.toLowerCase()}-${day.date}`}
                                      className="text-xs text-muted-foreground"
                                      title={copy.notSubmittedCannotEdit}
                                    >
                                      —
                                    </span>
                                  ) : (
                                    hoursInput
                                  )}
                                </td>
                              );
                            })}
                            <ApprovalTotalCell
                              groupId={group.id}
                              rowType={rowType}
                              total={totals[rowType]}
                            />
                            <td
                              className="w-[222px] min-w-[222px] border-r border-border px-2 py-0.5"
                              data-testid={`approval-description-${group.id}-${rowType.toLowerCase()}`}
                            >
                              {description ? (
                                <span className="block truncate">
                                  {description}
                                </span>
                              ) : null}
                            </td>
                          </tr>
                        );
                      });
                    }
                  );
                  return (
                    <article
                      className="isolate overflow-hidden rounded-lg border border-border bg-card shadow-sm"
                      key={approvalProject.id}
                    >
                      {projectHeader}
                      {expanded ? (
                        <div
                          aria-label={`${localeProp ? copy.approvalHorizontalScroll : ariaCopy.approvalHorizontalScroll}: ${approvalProject.name}`}
                          className="overflow-x-auto overflow-y-hidden"
                          data-approval-timesheet-matrix
                          data-approval-project-id={approvalProject.id}
                          data-testid="approval-timesheet-matrix"
                        >
                          <div data-testid="approval-table-motion-shell">
                            <table
                              data-approval-project-id={approvalProject.id}
                              data-testid="approval-records-transition"
                              className={cn(
                                "approval-records-transition isolate w-full table-fixed border-collapse border-spacing-0 text-left text-xs",
                                APPROVAL_DATE_TABLE_WIDTH_CLASS[days.length] ??
                                  "min-w-[1384px]"
                              )}
                            >
                              <colgroup>
                                <col className="w-[112px]" />
                                <col className="w-[104px]" />
                                <col className="w-[88px]" />
                                {showTypeColumn ? (
                                  <col
                                    className={cn(
                                      "w-[64px]",
                                      typeColumnClassName
                                    )}
                                  />
                                ) : null}
                                {days.map((day) => (
                                  <col key={day.date} className="w-[46px]" />
                                ))}
                                <col className="w-[66px]" />
                                <col className="w-[222px]" />
                              </colgroup>
                              {projectColumnHeader}
                              <tbody>{projectRows}</tbody>
                            </table>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
                {visibleApprovalProjects.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border bg-card py-12 text-center text-xs text-muted-foreground">
                    {copy.approvalNoEmployees}
                  </p>
                )}
              </div>
            </div>

            <Dialog
              open={Boolean(returnDialog)}
              onOpenChange={(open) => {
                if (!open) {
                  closeReturnDialog();
                }
              }}
            >
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{copy.returnReasonTitle}</DialogTitle>
                  <DialogDescription>
                    {copy.returnReasonDescription}
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  aria-label={copy.returnReasonTitle}
                  autoFocus
                  placeholder={copy.returnReasonPlaceholder}
                  value={returnReason}
                  maxLength={1000}
                  onChange={(event) => setReturnReason(event.target.value)}
                />
                <DialogFooter>
                  <ButtonGroup className="ml-auto">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={closeReturnDialog}
                    >
                      {copy.cancel}
                    </Button>
                    <Button type="button" onClick={confirmReturn}>
                      {copy.return}
                    </Button>
                  </ButtonGroup>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {loading && (
              <p className="mt-2 text-xs text-muted-foreground">
                {copy.syncingApproval}
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function normalizeApprovalRows(
  rows: TmsApprovalRecord["submittedRows"]
): TimesheetRow[] {
  return rows.map((row) => {
    if (row.type !== "Chargeable") {
      return row as TimesheetRow;
    }
    return {
      ...row,
      timesheetAccess: row.timesheetAccess ?? {
        allowed: true,
        reason: "ALLOWED",
      },
    } as unknown as TimesheetRow;
  });
}

function isRecordDateEditable(record: TmsApprovalRecord, date: string) {
  const day = Number(date.slice(-2));
  return record.half === "FIRST_HALF" ? day <= 15 : day >= 16;
}

function getRowsDayHours(rows: TimesheetRow[], date: string) {
  return rows.reduce((total, row) => total + (row.hoursByDate[date] ?? 0), 0);
}

function getApprovalDescription(rows: TimesheetRow[]) {
  return [
    ...new Set(rows.map((row) => row.description.trim()).filter(Boolean)),
  ].join(" · ");
}

function approvalRowsHoursEqual(before: TimesheetRow[], after: TimesheetRow[]) {
  const beforeById = new Map(before.map((row) => [row.id, row]));
  const afterById = new Map(after.map((row) => [row.id, row]));
  const rowIds = new Set([...beforeById.keys(), ...afterById.keys()]);

  for (const rowId of rowIds) {
    const beforeHours = beforeById.get(rowId)?.hoursByDate ?? {};
    const afterHours = afterById.get(rowId)?.hoursByDate ?? {};
    const dates = new Set([
      ...Object.keys(beforeHours),
      ...Object.keys(afterHours),
    ]);
    for (const date of dates) {
      if (Number(beforeHours[date] ?? 0) !== Number(afterHours[date] ?? 0)) {
        return false;
      }
    }
  }
  return true;
}

/* oxlint-disable jsx-a11y/prefer-tag-over-role -- The interactive splitter must remain a button while exposing separator semantics. */
function ProjectPaneResizeHandle({
  collapsed,
  dragging,
  label,
  onClick,
  onKeyDown,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  collapsed: boolean;
  dragging: boolean;
  label: string;
  onClick: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: () => void;
}) {
  return (
    <button
      type="button"
      data-testid="approval-project-pane-controls"
      data-project-pane-frame
      aria-label={label}
      role="separator"
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={collapsed ? 0 : 1}
      data-state={collapsed ? "collapsed" : "expanded"}
      data-resize-state={dragging ? "dragging" : "idle"}
      className={cn(
        RESIZE_RAIL_CLASS,
        "relative z-20 h-full w-full appearance-none border-0 p-0 cursor-pointer touch-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-col-resize"
      )}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <span
        data-testid="approval-project-pane-hit-area"
        aria-hidden="true"
        className="absolute -inset-x-3 inset-y-0 cursor-pointer touch-none select-none active:cursor-col-resize"
      />
      <span
        data-testid="approval-project-pane-grip"
        aria-hidden="true"
        className={cn(RESIZE_GRIP_CLASS, "h-12 w-1")}
      />
    </button>
  );
}
/* oxlint-enable jsx-a11y/prefer-tag-over-role */

function ApprovalFilterSelect({
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
  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? value;

  return (
    <label className="grid gap-1 text-[0.72rem] font-medium text-muted-foreground">
      <span>{label}</span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger size="sm" className="w-full" aria-label={label}>
          <SelectValue>{selectedLabel}</SelectValue>
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
    </label>
  );
}

function updateRecordDayHours(
  rows: TimesheetRow[],
  date: string,
  targetHours: number,
  rowType?: ApprovalRowType
) {
  const chargeableRows = rows.filter((row) => {
    const type = getApprovalRowType(row);
    return type && (rowType ? type === rowType : type !== "Leave");
  });
  if (chargeableRows.length === 0) {
    if (rowType === "OT" && targetHours > 0) {
      const source = rows.find(
        (row): row is ChargeableRow =>
          row.type === "Chargeable" && getApprovalRowType(row) === "Normal"
      );
      if (source) {
        const otRow: TimesheetRow = {
          ...source,
          id: buildTmsApprovalOtRowId(source.id),
          workType: "OT",
          details: "OT",
          approvalOriginalHoursByDate: {},
          hoursByDate: { [date]: targetHours },
          periodTotal: targetHours,
        };
        return [...rows, otRow];
      }
    }
    return rows;
  }

  let remaining = targetHours;
  let updatedRows = rows;
  for (const row of chargeableRows) {
    const nextHours = Math.min(row.hoursByDate[date] ?? 0, remaining);
    updatedRows = updateTimesheetHours(updatedRows, row.id, date, nextHours);
    remaining -= nextHours;
  }

  if (remaining <= 0) {
    return updatedRows;
  }
  const lastRow = chargeableRows[chargeableRows.length - 1];
  const currentLastHours =
    updatedRows.find((row) => row.id === lastRow.id)?.hoursByDate[date] ?? 0;
  return updateTimesheetHours(
    updatedRows,
    lastRow.id,
    date,
    currentLastHours + remaining
  );
}

function ApprovalStatusSummary({
  filtered,
  group,
  locale = "en-US",
}: {
  filtered: boolean;
  group: ApprovalRecordGroup;
  locale?: TmsLocale;
}) {
  if (!filtered) {
    return <StatusPill locale={locale} status={group.status} />;
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      {group.matchedHalves.map((half) => {
        const record = group.records.find((item) => item.half === half);
        return (
          <StatusPill
            key={half}
            half={half}
            locale={locale}
            status={record?.status ?? "NOT_SUBMITTED"}
          />
        );
      })}
    </div>
  );
}

function StatusPill({
  half,
  locale = "en-US",
  status,
}: {
  half?: "FIRST_HALF" | "SECOND_HALF";
  locale?: TmsLocale;
  status: TmsApprovalRecord["status"];
}) {
  const variants = {
    NOT_SUBMITTED: "secondary",
    SUBMITTED: "warning-light",
    APPROVED: "success-light",
    RETURNED: "destructive-light",
    PENDING_CONFIRMATION: "info-light",
  } as const;
  return (
    <StatusBadge
      variant={variants[status]}
      radius="full"
      className="h-auto px-2 py-1 text-[0.68rem] font-semibold"
    >
      {half
        ? `${half === "FIRST_HALF" ? getTmsWorkspaceCopy(locale).firstHalfShort : getTmsWorkspaceCopy(locale).secondHalfShort} · `
        : ""}
      {getApprovalStatusLabel(status, locale)}
    </StatusBadge>
  );
}
