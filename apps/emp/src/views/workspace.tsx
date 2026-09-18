"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type {
  CollisionDetection,
  DragEndEvent,
  DragStartEvent,
  Modifier,
} from "@dnd-kit/core";
import {
  formatNumberWithoutDigitFour,
  normalizeCodeWithoutDigitFour,
  isProjectPermissionSubjectConsistent,
} from "@project-wing/shared";
import type {
  CreateProjectFileExportJobInput,
  ProjectFileExportJob,
  WorkItem,
  WorkingPaperBucket,
} from "@project-wing/shared";
import {
  ProjectWingProjectWorkItemSidebar,
  ProjectWingWorkItemOverlay,
  ViewSwitcher,
  useCompactViewport,
} from "@project-wing/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpenCheck,
  ClipboardList,
  Download,
  Loader2,
  PanelsTopLeft,
  Search,
  RotateCcw,
  ShieldCheck,
  Truck,
  UserCog,
  X,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
} from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { useForm } from "react-hook-form";
import type {
  GroupImperativeHandle,
  PanelImperativeHandle,
  PanelSize,
} from "react-resizable-panels";

import {
  EmpMobileDirectory,
  resolveMobileDirectory,
} from "@/components/emp-mobile-directory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
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
  Progress,
  ProgressIndicator,
  ProgressTrack,
} from "@/components/ui/progress";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WorkbenchCompactController } from "@/components/workbench-compact-controller";
import { getEmpMobileNavigationCopy } from "@/i18n/mobile-navigation";
import type { WorkbenchPane } from "@/lib/workbench-compact-layout";

import type {
  ArchiveJobSnapshot,
  Attachment,
  InboxMessage,
  Project,
  ProjectAttachment,
  WorkflowNode,
  WorkingPaper,
} from "../api/client";
import { ApiError, api } from "../api/client";
import { OPEN_DESKTOP_AGENT_SETTINGS } from "../components/desktop-agent-settings-prompt";
import {
  ProjectConfirmationsPanel,
  defaultProjectConfirmationsCopy,
} from "../components/project-confirmations-panel";
import { ProjectPageHeader } from "../components/project-page-header";
import { collectProjectReviewQuestionItems } from "../components/project-review-questions-dialog";
import type { ProjectReviewQuestionItem } from "../components/project-review-questions-dialog";
import { SplitterRail } from "../components/splitter-rail";
import { useToast } from "../components/toast";
import { WorkbenchActivityPanel } from "../components/workbench-activity-panel";
import { WorkbenchContent } from "../components/workbench-content";
import type {
  WorkbenchFileActionRequest,
  WorkbenchPaperForm,
} from "../components/workbench-content";
import {
  WorkbenchDirectory,
  WorkbenchProjectSearch,
} from "../components/workbench-directory";
import type {
  DirectoryFileClipboard,
  DirectoryFileTransfer,
  DirectoryNodeForm,
  DirectoryNodeTransfer,
} from "../components/workbench-directory";
import {
  AttachmentRecycleBinPanel,
  ProjectFileTypeIcon,
  WorkbenchFilePreviewPane,
  openAttachmentPreviewInNewWindow,
} from "../components/workbench-paper-section";
import type { WorkbenchBreadcrumbSegment } from "../components/workbench-paper-section";
import { WorkbenchReviewNotesPanel } from "../components/workbench-review-notes-panel";
import { WorkbenchTemplateLibraryDialog } from "../components/workbench-template-library-dialog";
import { useI18n } from "../i18n/client";
import { defaultReviewNotesBottomPanelCopy } from "../i18n/dictionaries";
import type { Dictionary } from "../i18n/dictionaries";
import {
  canAccessAdmin,
  getUserScopedQueryKey,
  requiresProjectDeclaration,
} from "../lib/access-control";
import { getUserFacingErrorMessage, showErrorToast } from "../lib/error-toast";
import { resolveInboxActionHref } from "../lib/inbox-action-url";
import { seedUploadedAttachmentPreview } from "../lib/preview-query-cache";
import {
  DIRECTORY_TREE_CLASS,
  FILE_PREVIEW_PANE_CLASS,
  PROJECT_OVERVIEW_GRID_CLASS,
  PROJECT_PAGE_SHELL_CLASS,
  REVIEW_CONTENT_CLASS,
  findFirstWorkbenchNode,
  findWorkflowNode,
  formatDisplayName,
} from "../lib/project-layout";
import {
  canArchiveProject,
  canPerformProjectAction,
} from "../lib/project-permissions";
import { useSurfaceTransition } from "../lib/use-surface-transition";
import { cn } from "../lib/utils";
import {
  WORKBENCH_FILE_DIRECTORY_DROP_TYPE,
  WORKBENCH_FILE_DRAG_TYPE,
  WORKBENCH_FILE_PREVIEW_DROPPABLE_ID,
} from "../lib/workbench-file-dnd";
import {
  buildNextWorkflowFolderCode,
  formatHierarchicalNumericCode,
  groupFolderUploadFiles,
  parseHierarchicalNumericCode,
} from "../lib/workbench-folder-upload";
import {
  ArchiveCheckNavigator,
  WorkbenchSettingsPanel,
} from "./workbench-settings-panel";
import type { ArchiveCheckNavigatorSnapshot } from "./workbench-settings-panel";

const WORKSPACE_QUERY_META = { suppressGlobalErrorToast: true } as const;
const DRAG_OVERLAY_POINTER_OFFSET = 12;
const offsetDragOverlayFromPointer: Modifier = ({
  activeNodeRect,
  activatorEvent,
  transform,
}) => {
  const coordinates = getDragActivatorCoordinates(activatorEvent);
  if (!activeNodeRect || !coordinates) {
    return transform;
  }
  return {
    ...transform,
    x:
      transform.x +
      coordinates.x -
      activeNodeRect.left +
      DRAG_OVERLAY_POINTER_OFFSET,
    y:
      transform.y +
      coordinates.y -
      activeNodeRect.top +
      DRAG_OVERLAY_POINTER_OFFSET,
  };
};

function getDragActivatorCoordinates(event: Event | null) {
  if (typeof MouseEvent !== "undefined" && event instanceof MouseEvent) {
    return { x: event.clientX, y: event.clientY };
  }
  if (typeof TouchEvent !== "undefined" && event instanceof TouchEvent) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  return null;
}

const CONTEXT_PANEL_COLLAPSED_SIZE = "0rem";
const DEFAULT_CONTEXT_PANEL_PIXELS = 640;
const DEFAULT_CONTEXT_PANEL_SIZE = "40rem";
const DEFAULT_DIRECTORY_PANEL_PIXELS = 208;
const DEFAULT_DIRECTORY_PANEL_SIZE = "13rem";
const DEFAULT_REVIEW_NOTES_PANEL_PIXELS = 288;
const MINIMUM_CONTEXT_PANEL_PIXELS = 630;
const MINIMUM_CONTEXT_PANEL_SIZE = "39.375rem";
const MINIMUM_DIRECTORY_PANEL_PIXELS = 176;
const MINIMUM_REVIEW_NOTES_PANEL_PIXELS = 208;
const REVIEW_NOTES_PANEL_COLLAPSED_SIZE = "0rem";
const REVIEW_NOTES_PANEL_SNAP_THRESHOLD_PIXELS = 48;
const REVIEW_NOTES_PANEL_STORAGE_PREFIX =
  "project-wing-review-notes-panel-height";
export const DEFAULT_PREVIEW_PANEL_SIZE = DEFAULT_CONTEXT_PANEL_SIZE;
export const MINIMUM_PREVIEW_PANEL_SIZE = MINIMUM_CONTEXT_PANEL_SIZE;
export function shouldSnapReviewNotesPanelClosed(height: number) {
  return height < REVIEW_NOTES_PANEL_SNAP_THRESHOLD_PIXELS;
}
type ProjectWorkspaceMode = "files" | "confirmations";

type PendingReferenceCodeUpload = {
  bucket: WorkingPaperBucket;
  files: File[];
  node: WorkflowNode;
  referenceCodes: string[];
  reject: (reason?: unknown) => void;
  resolve: (attachments: Attachment[]) => void;
};

const fileCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args);
};

export function shouldAllowWorkbenchPointerDrag(
  target: EventTarget | null
): boolean {
  if (
    typeof document !== "undefined" &&
    document.querySelector('[data-workbench-interaction-lock="true"]')
  ) {
    return false;
  }
  const element = target instanceof Element ? target : null;
  const isSortableFileRow = Boolean(
    element?.closest('[data-dnd-sortable="true"]')
  );
  return !element?.closest(
    isSortableFileRow
      ? "input,select,textarea,label,[contenteditable='true'],[role='menuitem'],[data-workbench-dnd-ignore='true']"
      : "button,a,input,select,textarea,label,[contenteditable='true'],[role='button'],[role='menuitem'],[data-workbench-dnd-ignore='true']"
  );
}

class WorkbenchPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent }: ReactPointerEvent) =>
        shouldAllowWorkbenchPointerDrag(nativeEvent.target),
    },
  ];
}

export function WorkspacePage({
  projectId,
  workspaceId,
}: {
  projectId: string;
  workspaceId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { confirm, toast } = useToast();
  const fileSensors = useSensors(
    useSensor(WorkbenchPointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );
  const { dictionary, locale, localizedPath } = useI18n();
  const workbenchCopy = dictionary.workbench;
  const reviewNotesBottomPanelCopy =
    workbenchCopy.reviewNotesBottomPanel ?? defaultReviewNotesBottomPanelCopy;
  const projectCopy = dictionary.projects;
  const isConfirmationWorkspace =
    searchParams.get("workspace") === "confirmations";
  const [activeWorkspace, setActiveWorkspace] = useState<ProjectWorkspaceMode>(
    () => (isConfirmationWorkspace ? "confirmations" : "files")
  );
  const workspaceSurfaceRef = useSurfaceTransition<HTMLDivElement>(
    activeWorkspace,
    {
      variant: "page",
    }
  );
  useEffect(() => {
    setActiveWorkspace(isConfirmationWorkspace ? "confirmations" : "files");
  }, [isConfirmationWorkspace, projectId]);
  function navigateWorkspace(mode: ProjectWorkspaceMode) {
    const url = new URL(window.location.href);
    if (url.searchParams.get("workspace") === mode) {
      return;
    }
    url.searchParams.set("workspace", mode);
    if (mode === "confirmations") {
      for (const key of [
        "locatePaperId",
        "attachmentId",
        "workingPaperId",
        "reviewQuestionId",
        "focus",
        "smartFormPreview",
      ]) {
        url.searchParams.delete(key);
      }
    }
    window.history.pushState(
      window.history.state,
      "",
      url.pathname + url.search
    );
    setActiveWorkspace(mode);
  }
  useEffect(() => {
    const restore = () =>
      setActiveWorkspace(
        new URLSearchParams(window.location.search).get("workspace") ===
          "confirmations"
          ? "confirmations"
          : "files"
      );
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.project(projectId),
    enabled: Boolean(projectId),
    meta: WORKSPACE_QUERY_META,
    retry: false,
  });
  const desktop = useQuery({
    queryKey: ["desktop"],
    queryFn: api.desktop,
    enabled: Boolean(projectId),
    meta: WORKSPACE_QUERY_META,
  });
  const projectReturnHref = useMemo(() => {
    const explicitReturnHref = resolveProjectsReturnHref(
      searchParams.get("returnTo")
    );
    if (explicitReturnHref) {
      return explicitReturnHref;
    }

    return isConfirmationWorkspace ? "/confirmations" : undefined;
  }, [isConfirmationWorkspace, searchParams]);
  const declaration = useQuery({
    queryKey: ["projectDeclaration", projectId],
    queryFn: () => api.projectDeclarationStatus(projectId),
    enabled: Boolean(projectId),
    meta: WORKSPACE_QUERY_META,
    retry: false,
  });
  const declarationAccepted = declaration.data?.accepted === true;
  const workflow = useQuery({
    queryKey: ["workflow", projectId],
    queryFn: () => api.workflow(projectId),
    enabled:
      Boolean(projectId) && declarationAccepted && activeWorkspace === "files",
    meta: WORKSPACE_QUERY_META,
  });
  const activeFileExport = useQuery({
    queryKey: ["project-file-export-job-active", projectId],
    queryFn: () => api.activeProjectFileExportJob(projectId),
    enabled:
      Boolean(projectId) && declarationAccepted && activeWorkspace === "files",
    meta: WORKSPACE_QUERY_META,
    retry: false,
  });
  const me = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    meta: WORKSPACE_QUERY_META,
  });
  const currentMember = useMemo(() => {
    if (me.data?.globalRole === "SUPER_ADMIN") {
      return {
        id: `super-admin:${projectId}:${me.data.id}`,
        projectRole: "PREPARER" as const,
        inChargeRole: null,
        authorizationSuspendedAt: null,
        user: { id: me.data.id, globalRole: me.data.globalRole },
      };
    }
    const member = project.data?.members?.find(
      (projectMember) => projectMember.user.id === me.data?.id
    );
    if (!member || !me.data) {
      return null;
    }
    return {
      id: member.id,
      projectRole: member.projectRole,
      inChargeRole: member.inChargeRole ?? null,
      authorizationSuspendedAt: member.authorizationSuspendedAt,
      user: { id: me.data.id, globalRole: me.data.globalRole },
    };
  }, [me.data, project.data?.members, projectId]);
  const canViewTemporaryFiles = canPerformProjectAction(
    currentMember,
    "viewTemporaryFiles"
  );
  const canViewNotifications = canPerformProjectAction(
    currentMember,
    "viewNotifications"
  );
  const canViewRecycleBin = canPerformProjectAction(
    currentMember,
    "viewRecycleBin"
  );
  const deletedAttachments = useQuery({
    queryKey: ["deleted-attachments", projectId],
    queryFn: () => api.deletedAttachments(projectId),
    enabled: Boolean(projectId) && declarationAccepted && canViewRecycleBin,
    meta: WORKSPACE_QUERY_META,
  });
  const projectAttachments = useQuery({
    queryKey: ["project-attachments", projectId],
    queryFn: () => api.projectAttachments(projectId),
    enabled:
      Boolean(projectId) && declarationAccepted && activeWorkspace === "files",
    meta: WORKSPACE_QUERY_META,
  });
  const inboxQueryKey = getUserScopedQueryKey("inbox", me.data);
  const inbox = useQuery({
    queryKey: inboxQueryKey,
    queryFn: api.inboxMessages,
    enabled: Boolean(me.data) && canViewNotifications,
    meta: WORKSPACE_QUERY_META,
  });
  const teamWorkItems = useQuery({
    queryKey: ["work-items", "team", projectId, locale],
    queryFn: () =>
      api.workItems({
        view: "TEAM",
        projectId,
        locale,
      }),
    enabled: Boolean(projectId) && declarationAccepted,
    refetchInterval: declarationAccepted ? 10_000 : false,
    meta: WORKSPACE_QUERY_META,
  });
  const personalWorkItems = useQuery({
    queryKey: [
      "work-items",
      "personal",
      "PROJECT",
      projectId,
      me.data?.id,
      locale,
    ],
    queryFn: () =>
      api.workItems({
        view: "PERSONAL",
        scope: "PROJECT",
        projectId,
        locale,
      }),
    enabled: Boolean(me.data) && declarationAccepted,
    refetchInterval: declarationAccepted ? 10_000 : false,
    meta: WORKSPACE_QUERY_META,
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [highlightedPaperId, setHighlightedPaperId] = useState<string | null>(
    null
  );
  const [highlightedPaperIds, setHighlightedPaperIds] = useState<string[]>([]);
  const [directoryMultiSelectionResetKey, setDirectoryMultiSelectionResetKey] =
    useState(0);
  const [directorySelectionCleared, setDirectorySelectionCleared] =
    useState(false);
  const directoryFilePasteTargetRef = useRef<string | null>(null);
  const [addNodeTarget, setAddNodeTarget] = useState<WorkflowNode | null>(null);
  const [activeBucket, setActiveBucket] =
    useState<WorkingPaperBucket>("CURRENT");
  const [templateLibraryOpen, setTemplateLibraryOpen] = useState(false);
  const [smartFormLibraryOpen, setSmartFormLibraryOpen] = useState(false);
  const [recycleBinDialogOpen, setRecycleBinDialogOpen] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [archiveCheckNavigator, setArchiveCheckNavigator] =
    useState<ArchiveCheckNavigatorSnapshot | null>(null);
  const [archiveCheckNavigatorMinimized, setArchiveCheckNavigatorMinimized] =
    useState(false);
  const [archiveCheckNavigatorPosition, setArchiveCheckNavigatorPosition] =
    useState<{ x: number; y: number } | null>(null);
  const archiveCheckNavigatorHasPosition =
    archiveCheckNavigatorPosition !== null;
  const [folderUploadPending, setFolderUploadPending] = useState(false);
  const [pendingReferenceCodeUpload, setPendingReferenceCodeUpload] =
    useState<PendingReferenceCodeUpload | null>(null);
  const [settingsInitialSection, setSettingsInitialSection] = useState<
    "general" | "archive" | "desktopAgent"
  >("general");
  useEffect(() => {
    const openAgentSettings = () => {
      setSettingsInitialSection("desktopAgent");
      setSettingsOpen(true);
    };
    window.addEventListener(OPEN_DESKTOP_AGENT_SETTINGS, openAgentSettings);
    return () =>
      window.removeEventListener(
        OPEN_DESKTOP_AGENT_SETTINGS,
        openAgentSettings
      );
  }, []);
  const [archiveReviewRequestKey, setArchiveReviewRequestKey] = useState(0);
  const [archiveJobSnapshot, setArchiveJobSnapshot] =
    useState<ArchiveJobSnapshot | null>(null);
  const [archiveJobErrorMessage, setArchiveJobErrorMessage] = useState<
    string | null
  >(null);
  const archiveJobAbortRef = useRef<AbortController | null>(null);
  const [fileExportJob, setFileExportJob] =
    useState<ProjectFileExportJob | null>(null);
  const [fileExportDownloading, setFileExportDownloading] = useState(false);
  const fileExportAbortRef = useRef<AbortController | null>(null);
  const [fileExportStartedHereIds, setFileExportStartedHereIds] = useState<
    Set<string>
  >(() => new Set());
  const fileExportStartedHereKey = [...fileExportStartedHereIds].join("\0");
  const fileExportDownloadedRef = useRef(new Set<string>());
  const fileExportDownloadingRef = useRef(false);

  const resetDirectoryMultiSelection = useCallback(() => {
    setDirectoryMultiSelectionResetKey((current) => current + 1);
  }, []);
  const clearMultiHighlightedPapers = useCallback(() => {
    setHighlightedPaperIds([]);
    resetDirectoryMultiSelection();
  }, [resetDirectoryMultiSelection]);
  const showDirectoryPanel = useCallback(() => {}, []);
  const [activityPanelOpen, setActivityPanelOpen] = useState(false);
  const [projectWorkItemsOpen, setProjectWorkItemsOpen] = useState(false);
  const workspacePanelGroupRef = useRef<GroupImperativeHandle | null>(null);
  const workspacePanelGroupElementRef = useRef<HTMLDivElement | null>(null);
  const archiveCheckNavigatorElementRef = useRef<HTMLDivElement | null>(null);
  const reviewNotesPanelGroupElementRef = useRef<HTMLDivElement | null>(null);
  const reviewNotesPanelGroupRef = useRef<GroupImperativeHandle | null>(null);
  const [compactWorkbench, setCompactWorkbench] = useState(false);
  const isPhone = useCompactViewport(767);
  const mobileCopy = getEmpMobileNavigationCopy(locale);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileDirectoryTrail, setMobileDirectoryTrail] = useState<string[]>(
    []
  );
  const [mobileDirectoryManagementOpen, setMobileDirectoryManagementOpen] =
    useState(false);
  const [compactPane, setCompactPane] = useState<WorkbenchPane>("files");
  const mobileDirectFileEntry = Boolean(
    searchParams.get("previewAttachmentId") ||
    searchParams.get("attachmentId") ||
    searchParams.get("locatePaperId") ||
    searchParams.get("reviewQuestionId")
  );
  useEffect(() => {
    if (isPhone && !mobileDirectFileEntry) {
      setCompactPane("directory");
      setMobileDirectoryTrail([]);
    }
  }, [isPhone, projectId, mobileDirectFileEntry]);
  const compactLayoutGuard = useRef(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => {
      if (media.matches) {
        compactLayoutGuard.current = true;
      }
      setCompactWorkbench(media.matches);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (projectWorkItemsOpen) {
      setCompactPane("tasks");
    } else {
      setCompactPane((current) => (current === "tasks" ? "files" : current));
    }
  }, [projectWorkItemsOpen]);
  const directoryPanelRef = useRef<PanelImperativeHandle | null>(null);
  const previewPanelRef = useRef<PanelImperativeHandle | null>(null);
  const reviewNotesPanelRef = useRef<PanelImperativeHandle | null>(null);
  const projectWorkItemsPanelRef = useRef<PanelImperativeHandle | null>(null);
  const collapseProjectWorkItemsPanel = useCallback(() => {
    const group = workspacePanelGroupRef.current;
    if (!group) {
      return;
    }
    const layout = group.getLayout();
    const taskSize = layout["project-team-work-items"];
    if (!taskSize) {
      return;
    }
    // Return the task pane's space to files, not the adjacent preview pane.
    group.setLayout({
      ...layout,
      "project-review": layout["project-review"] + taskSize,
      "project-team-work-items": 0,
    });
  }, []);
  useEffect(() => {
    if (compactWorkbench) {
      return;
    }
    if (projectWorkItemsOpen) {
      projectWorkItemsPanelRef.current?.resize("34rem");
    } else {
      collapseProjectWorkItemsPanel();
    }
  }, [projectWorkItemsOpen, compactWorkbench, collapseProjectWorkItemsPanel]);
  const directoryResizeStartRef = useRef(DEFAULT_DIRECTORY_PANEL_PIXELS);
  const previewResizeStartRef = useRef(DEFAULT_CONTEXT_PANEL_PIXELS);
  const reviewNotesResizeStartRef = useRef(
    readStoredReviewNotesPanelHeight(projectId)
  );
  const reviewNotesResizeStartedCollapsedRef = useRef(true);
  const directoryPanelWidthRef = useRef(DEFAULT_DIRECTORY_PANEL_PIXELS);
  const previewPanelWidthRef = useRef(DEFAULT_CONTEXT_PANEL_PIXELS);
  const reviewNotesPanelHeightRef = useRef(
    readStoredReviewNotesPanelHeight(projectId)
  );
  const directoryPanelCollapsedRef = useRef(false);
  const previewPanelCollapsedRef = useRef(true);
  const reviewNotesPanelCollapsedRef = useRef(true);
  const directoryPanelResizeFrameRef = useRef<number | null>(null);
  const previewPanelResizeFrameRef = useRef<number | null>(null);
  const reviewNotesPanelResizeFrameRef = useRef<number | null>(null);
  const workbenchPanelResizeFinishFrameRef = useRef<number | null>(null);
  const directoryPanelPendingWidthRef = useRef<number | null>(null);
  const previewPanelPendingWidthRef = useRef<number | null>(null);
  const reviewNotesPanelPendingHeightRef = useRef<number | null>(null);
  const [directoryPanelWidth, setDirectoryPanelWidth] = useState(
    DEFAULT_DIRECTORY_PANEL_PIXELS
  );
  const [isDirectoryPanelCollapsed, setIsDirectoryPanelCollapsed] =
    useState(false);
  const [previewPanelWidth, setPreviewPanelWidth] = useState(
    DEFAULT_CONTEXT_PANEL_PIXELS
  );
  const [isPreviewPanelCollapsed, setIsPreviewPanelCollapsed] = useState(true);
  const [reviewNotesPanelHeight, setReviewNotesPanelHeight] = useState(() =>
    readStoredReviewNotesPanelHeight(projectId)
  );
  const [isReviewNotesPanelCollapsed, setIsReviewNotesPanelCollapsed] =
    useState(true);
  const [reviewNotesMounted, setReviewNotesMounted] = useState(false);
  useEffect(() => {
    if (!isReviewNotesPanelCollapsed) {
      setReviewNotesMounted(true);
    }
  }, [isReviewNotesPanelCollapsed]);
  const [isSmartFormOpen, setIsSmartFormOpen] = useState(false);
  useEffect(() => {
    if (isSmartFormOpen) {
      setCompactPane((current) => (current === "notes" ? "files" : current));
    }
  }, [isSmartFormOpen]);
  const expandedPreviewLayoutRef = useRef<Record<string, number> | null>(null);
  const [previewedAttachmentId, setPreviewedAttachmentId] = useState<
    string | null
  >(() => searchParams.get("previewAttachmentId"));
  const [fileActionRequest, setFileActionRequest] =
    useState<WorkbenchFileActionRequest | null>(null);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [directoryFileClipboard, setDirectoryFileClipboard] =
    useState<DirectoryFileClipboard | null>(null);
  const [isActivityPanelMounted, setIsActivityPanelMounted] = useState(false);
  const [isActivityPanelVisible, setIsActivityPanelVisible] = useState(false);
  const [previewDragFileName, setPreviewDragFileName] = useState<string | null>(
    null
  );
  const handleSmartFormOpenChange = useCallback((open: boolean) => {
    setIsSmartFormOpen(open);
    if (!open) {
      return;
    }
    if (reviewNotesPanelResizeFrameRef.current !== null) {
      window.cancelAnimationFrame(reviewNotesPanelResizeFrameRef.current);
      reviewNotesPanelResizeFrameRef.current = null;
    }
    reviewNotesPanelPendingHeightRef.current = null;
    reviewNotesPanelRef.current?.collapse();
    reviewNotesPanelCollapsedRef.current = true;
    setIsReviewNotesPanelCollapsed(true);
  }, []);

  useEffect(
    () => () => {
      archiveJobAbortRef.current?.abort();
      fileExportAbortRef.current?.abort();
      if (directoryPanelResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(directoryPanelResizeFrameRef.current);
      }
      if (previewPanelResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(previewPanelResizeFrameRef.current);
      }
      if (reviewNotesPanelResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(reviewNotesPanelResizeFrameRef.current);
      }
      if (workbenchPanelResizeFinishFrameRef.current !== null) {
        window.cancelAnimationFrame(workbenchPanelResizeFinishFrameRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!archiveCheckNavigator || !archiveCheckNavigatorHasPosition) {
      return;
    }

    const keepNavigatorInView = () => {
      const container = workspacePanelGroupElementRef.current;
      const navigator = archiveCheckNavigatorElementRef.current;
      if (!container || !navigator) {
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const navigatorRect = navigator.getBoundingClientRect();
      const edge = 8;
      const maxX = Math.max(
        edge,
        containerRect.width - navigatorRect.width - edge
      );
      const maxY = Math.max(
        edge,
        containerRect.height - navigatorRect.height - edge
      );
      setArchiveCheckNavigatorPosition((current) => {
        if (!current) {
          return current;
        }
        const next = {
          x: Math.min(maxX, Math.max(edge, current.x)),
          y: Math.min(maxY, Math.max(edge, current.y)),
        };
        return next.x === current.x && next.y === current.y ? current : next;
      });
    };
    const frame = window.requestAnimationFrame(keepNavigatorInView);
    const observer = new ResizeObserver(keepNavigatorInView);
    if (workspacePanelGroupElementRef.current) {
      observer.observe(workspacePanelGroupElementRef.current);
    }
    if (archiveCheckNavigatorElementRef.current) {
      observer.observe(archiveCheckNavigatorElementRef.current);
    }
    window.addEventListener("resize", keepNavigatorInView);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", keepNavigatorInView);
    };
  }, [
    archiveCheckNavigator,
    archiveCheckNavigatorMinimized,
    archiveCheckNavigatorHasPosition,
  ]);

  useEffect(() => {
    const navigator = archiveCheckNavigatorElementRef.current;
    if (!navigator || !archiveCheckNavigatorPosition) {
      return;
    }
    navigator.style.left = `${archiveCheckNavigatorPosition.x}px`;
    navigator.style.top = `${archiveCheckNavigatorPosition.y}px`;
    navigator.style.right = "auto";
  }, [archiveCheckNavigatorPosition]);

  function handleArchiveCheckNavigatorDragStart(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    if (event.button !== 0) {
      return;
    }
    if (
      event.target instanceof Element &&
      event.target.closest("button, input, textarea, select, a")
    ) {
      return;
    }
    const container = workspacePanelGroupElementRef.current;
    const navigator = archiveCheckNavigatorElementRef.current;
    if (!container || !navigator) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const containerRect = container.getBoundingClientRect();
    const navigatorRect = navigator.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const { pointerId } = event;
    const initialX = navigatorRect.left - containerRect.left;
    const initialY = navigatorRect.top - containerRect.top;
    const edge = 8;
    const maxX = Math.max(
      edge,
      containerRect.width - navigatorRect.width - edge
    );
    const maxY = Math.max(
      edge,
      containerRect.height - navigatorRect.height - edge
    );

    let nextX = initialX;
    let nextY = initialY;
    let dragFrame: number | null = null;
    navigator.style.willChange = "transform";

    const measureNextPosition = (moveEvent: PointerEvent) => {
      nextX = Math.min(
        maxX,
        Math.max(edge, initialX + moveEvent.clientX - startX)
      );
      nextY = Math.min(
        maxY,
        Math.max(edge, initialY + moveEvent.clientY - startY)
      );
    };
    const paintNavigator = () => {
      dragFrame = null;
      navigator.style.transform = `translate3d(${nextX - initialX}px, ${
        nextY - initialY
      }px, 0)`;
    };
    const moveNavigator = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) {
        return;
      }
      measureNextPosition(moveEvent);
      if (dragFrame === null) {
        dragFrame = window.requestAnimationFrame(paintNavigator);
      }
    };
    const stopDragging = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) {
        return;
      }
      measureNextPosition(upEvent);
      if (dragFrame !== null) {
        window.cancelAnimationFrame(dragFrame);
      }
      navigator.style.transform = "";
      navigator.style.willChange = "";
      navigator.style.left = `${nextX}px`;
      navigator.style.top = `${nextY}px`;
      navigator.style.right = "auto";
      setArchiveCheckNavigatorPosition({ x: nextX, y: nextY });
      window.removeEventListener("pointermove", moveNavigator);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };

    window.addEventListener("pointermove", moveNavigator);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
  }

  const paperForm = useForm<WorkbenchPaperForm>({
    defaultValues: {
      code: "",
      title: "",
      paperType: "WORKING_PAPER",
      bucket: "CURRENT",
    },
  });
  const workflowNodes = useMemo(
    () => filterWorkbenchWorkflow(workflow.data ?? []),
    [workflow.data]
  );
  const workflowPapers = useMemo(
    () => collectWorkflowPapers(workflowNodes),
    [workflowNodes]
  );
  const previewTarget = useMemo(
    () =>
      resolveFilePreviewTarget(
        workflowPapers,
        projectAttachments.data ?? [],
        previewedAttachmentId
      ),
    [previewedAttachmentId, projectAttachments.data, workflowPapers]
  );
  const previewedAttachment = previewTarget?.attachment ?? null;
  const selectedNode = useMemo(
    () => findWorkflowNode(workflowNodes, selectedNodeId),
    [workflowNodes, selectedNodeId]
  );
  const selectedBreadcrumbPath = useMemo(() => {
    if (!selectedNodeId) {
      return [];
    }
    return findRollingWorkflowPath(workflowNodes, selectedNodeId);
  }, [selectedNodeId, workflowNodes]);
  const selectedPathScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const scroller = selectedPathScrollRef.current;
    if (!scroller) {
      return;
    }
    scroller.scrollLeft = scroller.scrollWidth;
  }, [selectedBreadcrumbPath]);
  const highlightedPaperNodeId = useMemo(
    () =>
      highlightedPaperId
        ? findWorkflowNodeIdForPaper(workflowNodes, highlightedPaperId)
        : null,
    [workflowNodes, highlightedPaperId]
  );
  const restoreTargetNodes = useMemo(
    () => collectWorkflowRestoreTargetNodes(workflowNodes),
    [workflowNodes]
  );
  const canDeleteSelected = Boolean(selectedNode);
  const isPendingFinalCheckProject =
    project.data?.status === "PENDING_FINAL_CHECK";
  const isArchivedProject = project.data?.status === "ARCHIVED";
  const isSuperAdmin = me.data?.globalRole === "SUPER_ADMIN";
  const canAccessSystemAdmin = canAccessAdmin(me.data);
  const hasCurrentProjectAuthorization =
    isSuperAdmin ||
    (currentMember &&
      isProjectPermissionSubjectConsistent({
        globalRole: currentMember.user.globalRole,
        projectRole: currentMember.projectRole,
        inChargeRole: currentMember.inChargeRole,
        authorizationSuspended: Boolean(currentMember.authorizationSuspendedAt),
      }));
  const isReadOnlyProject =
    isArchivedProject ||
    isPendingFinalCheckProject ||
    !hasCurrentProjectAuthorization ||
    project.data?.status === "DELETED";
  const canReviewFinalArchive = Boolean(
    isSuperAdmin && isPendingFinalCheckProject
  );
  const canArchiveCurrentProject =
    !isReadOnlyProject && canArchiveProject(currentMember);
  const canDeleteCurrentProject =
    !isReadOnlyProject &&
    canPerformProjectAction(currentMember, "deleteProject");
  const canRunArchiveWorkflow =
    canArchiveCurrentProject || canReviewFinalArchive;
  const canEditCurrentProject =
    !isReadOnlyProject &&
    canPerformProjectAction(currentMember, "updateProjectInfo");
  const canUseLibrary =
    !isReadOnlyProject && canPerformProjectAction(currentMember, "useLibrary");
  const canModifyIndex =
    !isReadOnlyProject && canPerformProjectAction(currentMember, "modifyIndex");
  const canUploadWorkingPapers =
    !isReadOnlyProject &&
    canPerformProjectAction(currentMember, "uploadWorkingPapers");
  const canUploadFilesToNode = canModifyIndex && canUploadWorkingPapers;
  const canSignPreparer =
    !isReadOnlyProject &&
    canPerformProjectAction(currentMember, "signPreparer");
  const auditYear = useMemo(
    () => resolveAuditYear(project.data?.yearEndDate),
    [project.data?.yearEndDate]
  );

  useEffect(() => {
    if (activityPanelOpen) {
      setIsActivityPanelMounted(true);
      const frameId = window.requestAnimationFrame(() =>
        setIsActivityPanelVisible(true)
      );
      return () => window.cancelAnimationFrame(frameId);
    }

    setIsActivityPanelVisible(false);
    if (!isActivityPanelMounted) {
      return;
    }

    const timeoutId = window.setTimeout(
      () => setIsActivityPanelMounted(false),
      180
    );
    return () => window.clearTimeout(timeoutId);
  }, [activityPanelOpen, isActivityPanelMounted]);

  useEffect(() => {
    if (canViewTemporaryFiles || activeBucket !== "TEMPORARY") {
      return;
    }
    setActiveBucket("CURRENT");
  }, [activeBucket, canViewTemporaryFiles]);

  useEffect(() => {
    if (canUseLibrary) {
      return;
    }
    setTemplateLibraryOpen(false);
    setSmartFormLibraryOpen(false);
  }, [canUseLibrary]);

  useEffect(() => {
    if (canViewRecycleBin) {
      return;
    }
    setRecycleBinDialogOpen(false);
  }, [canViewRecycleBin]);

  useEffect(() => {
    paperForm.reset({
      code: "",
      title: "",
      paperType: "WORKING_PAPER",
      bucket: "CURRENT",
    });
  }, [paperForm, selectedNodeId]);

  useEffect(() => {
    const nodes = workflowNodes;
    if (nodes.length === 0) {
      return;
    }
    if (findWorkflowNode(nodes, selectedNodeId)) {
      return;
    }
    if (!selectedNodeId && directorySelectionCleared) {
      return;
    }

    const firstNode = findFirstWorkbenchNode(nodes);
    if (firstNode) {
      setSelectedNodeId(firstNode.id);
    }
  }, [workflowNodes, selectedNodeId, directorySelectionCleared]);

  useEffect(() => {
    if (!previewedAttachmentId || previewedAttachment) {
      return;
    }
    if (
      workflowPapers.length === 0 &&
      (projectAttachments.data ?? []).length === 0
    ) {
      return;
    }
    if (projectAttachments.isLoading) {
      return;
    }
    setPreviewedAttachmentId(null);
  }, [
    previewedAttachment,
    previewedAttachmentId,
    projectAttachments.data,
    projectAttachments.isLoading,
    workflowPapers.length,
  ]);

  const locatePaperInWorkbench = useCallback(
    (
      paperId: string,
      options: { expandDirectory?: boolean; highlightId?: string } = {}
    ) => {
      const nodeId = findWorkflowNodeIdForPaper(workflowNodes, paperId);
      if (!nodeId) {
        return false;
      }
      setActiveWorkspace("files");
      setAddNodeTarget(null);
      setDirectorySelectionCleared(false);
      setSelectedNodeId(nodeId);
      setSelectedPaperId(null);
      setHighlightedPaperId(options.highlightId ?? paperId);
      clearMultiHighlightedPapers();
      if (options.expandDirectory) {
        showDirectoryPanel();
      }
      setActiveBucket(
        findWorkflowPaperBucket(workflowNodes, paperId) ?? "CURRENT"
      );
      return true;
    },
    [clearMultiHighlightedPapers, showDirectoryPanel, workflowNodes]
  );

  useEffect(() => {
    const locatePaperId = searchParams.get("locatePaperId");
    if (locatePaperId) {
      const attachmentId = searchParams.get("attachmentId");
      locatePaperInWorkbench(locatePaperId, {
        expandDirectory: true,
        highlightId: attachmentId ?? undefined,
      });
    }
  }, [locatePaperInWorkbench, searchParams]);

  const focusReviewQuestionInWorkbench = useCallback(
    (item: ProjectReviewQuestionItem) => {
      const nodeId = findWorkflowNodeIdForPaper(workflowNodes, item.paper.id);
      if (!nodeId) {
        return false;
      }
      setActiveWorkspace("files");
      setAddNodeTarget(null);
      setDirectorySelectionCleared(false);
      setSelectedNodeId(nodeId);
      setSelectedPaperId(item.paper.id);
      setHighlightedPaperId(item.question.attachmentId ?? item.paper.id);
      clearMultiHighlightedPapers();
      showDirectoryPanel();
      setActiveBucket(
        findWorkflowPaperBucket(workflowNodes, item.paper.id) ?? "CURRENT"
      );
      return true;
    },
    [clearMultiHighlightedPapers, showDirectoryPanel, workflowNodes]
  );

  useEffect(() => {
    const reviewQuestionId = searchParams.get("reviewQuestionId");
    if (!reviewQuestionId) {
      return;
    }
    const questionItem = collectProjectReviewQuestionItems(
      workflowNodes,
      projectAttachments.data ?? []
    ).find((item) => item.question.id === reviewQuestionId);
    if (!questionItem) {
      return;
    }
    focusReviewQuestionInWorkbench(questionItem);
  }, [
    focusReviewQuestionInWorkbench,
    projectAttachments.data,
    searchParams,
    workflowNodes,
  ]);

  useEffect(() => {
    if (searchParams.get("templateLibrary") !== "1") {
      return;
    }
    if (!canUseLibrary) {
      return;
    }
    setTemplateLibraryOpen(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("templateLibrary");
    const query = params.toString();
    router.replace(
      `${localizedPath(`/engagement/${projectId}`)}${query ? `?${query}` : ""}`
    );
  }, [canUseLibrary, localizedPath, projectId, router, searchParams]);

  function locateProjectReviewQuestion(item: ProjectReviewQuestionItem) {
    const attachmentId = item.question.attachmentId ?? item.attachment?.id;
    const located = locatePaperInWorkbench(item.paper.id, {
      expandDirectory: true,
      highlightId: attachmentId ?? item.paper.id,
    });
    if (!located) {
      return false;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("locatePaperId", item.paper.id);
    if (attachmentId) {
      params.set("attachmentId", attachmentId);
    } else {
      params.delete("attachmentId");
    }
    params.delete("workingPaperId");
    params.delete("reviewQuestionId");
    params.delete("focus");
    params.delete("smartFormPreview");
    params.delete("smartFormNodeId");
    params.delete("smartFormRowId");
    params.delete("smartFormTargetLabel");
    params.delete("sheetName");
    params.delete("cellAddress");
    router.replace(`${localizedPath(`/engagement/${projectId}`)}?${params}`);
    return true;
  }

  function openProjectInboxMessage(message: InboxMessage) {
    if (!message.readAt) {
      markInboxRead.mutate(message.id);
    }

    const questionItem = collectProjectReviewQuestionItems(
      workflowNodes,
      projectAttachments.data ?? []
    ).find((item) => item.question.id === message.reviewQuestionId);
    if (questionItem) {
      locateProjectReviewQuestion(questionItem);
      return;
    }

    if (message.workingPaper?.id || message.workingPaperId) {
      openWorkingPaperFromInboxMessage(message);
      return;
    }

    if (message.actionUrl) {
      router.push(resolveInboxActionHref(message.actionUrl, localizedPath));
    }
  }

  function openWorkingPaperFromInboxMessage(message: InboxMessage) {
    const paperId = message.workingPaper?.id ?? message.workingPaperId;
    if (!paperId) {
      return;
    }
    const nodeId = findWorkflowNodeIdForPaper(workflowNodes, paperId);
    if (!nodeId) {
      return;
    }

    navigateWorkspace("files");
    setAddNodeTarget(null);
    setSelectedNodeId(nodeId);
    setSelectedPaperId(paperId);
    setHighlightedPaperId(null);
    showDirectoryPanel();
    setActiveBucket(
      findWorkflowPaperBucket(workflowNodes, paperId) ?? "CURRENT"
    );

    const params = new URLSearchParams(searchParams.toString());
    params.set("locatePaperId", paperId);
    params.delete("workingPaperId");
    if (message.reviewQuestionId) {
      params.set("reviewQuestionId", message.reviewQuestionId);
      params.set("focus", "q");
    }
    router.replace(`${localizedPath(`/engagement/${projectId}`)}?${params}`);
  }

  function toggleProjectMessageReadState(message: InboxMessage) {
    if (message.readAt) {
      markInboxUnread.mutate(message.id);
      return;
    }
    markInboxRead.mutate(message.id);
  }

  async function refreshWorkflow() {
    await queryClient.invalidateQueries({ queryKey: ["workflow", projectId] });
    await queryClient.invalidateQueries({ queryKey: ["auditLogs", projectId] });
  }

  async function startFileExport(
    input: CreateProjectFileExportJobInput,
    description: string
  ) {
    try {
      toast({
        title: workbenchCopy.fileExport.preparingTitle,
        description,
      });
      const job = await api.createProjectFileExportJob(projectId, input);
      setFileExportStartedHereIds((current) => new Set([...current, job.id]));
      setFileExportJob(job);
      if (job.status === "COMPLETED") {
        await downloadFileExportJob(job);
        return;
      }
      watchFileExportJob(job.id);
    } catch {
      toast({
        title: workbenchCopy.fileExport.failedTitle,
        variant: "destructive",
      });
    }
  }

  const downloadFileExportJob = useCallback(
    async (job: ProjectFileExportJob) => {
      if (
        fileExportDownloadingRef.current ||
        fileExportDownloadedRef.current.has(job.id)
      ) {
        return;
      }
      fileExportDownloadedRef.current.add(job.id);
      fileExportDownloadingRef.current = true;
      setFileExportDownloading(true);
      try {
        const downloadUrl = await api.projectFileExportJobDownloadUrl(
          projectId,
          job.id
        );
        startBrowserDownload(
          downloadUrl,
          job.outputFileName ?? "project-files-export.zip"
        );
        toast({
          title: workbenchCopy.fileExport.downloadStartedTitle,
          description: formatTemplate(
            workbenchCopy.fileExport.downloadStartedDescription,
            {
              name: job.outputFileName ?? "project-files-export.zip",
            }
          ),
        });
        setFileExportJob(null);
      } catch {
        fileExportDownloadedRef.current.delete(job.id);
        toast({
          title: workbenchCopy.fileExport.downloadFailed,
          variant: "destructive",
        });
      } finally {
        fileExportDownloadingRef.current = false;
        setFileExportDownloading(false);
      }
    },
    [projectId, toast, workbenchCopy.fileExport]
  );

  function watchFileExportJob(jobId: string) {
    fileExportAbortRef.current?.abort();
    const controller = new AbortController();
    fileExportAbortRef.current = controller;
    void api
      .watchProjectFileExportJob(
        projectId,
        jobId,
        (job) => {
          setFileExportJob(job);
          if (job.status === "FAILED") {
            toast({
              title: workbenchCopy.fileExport.failedTitle,
              variant: "destructive",
            });
          }
          if (
            job.status === "COMPLETED" &&
            fileExportStartedHereKey.split("\0").includes(job.id)
          ) {
            void downloadFileExportJob(job);
          }
        },
        { signal: controller.signal }
      )
      .catch(async () => {
        if (controller.signal.aborted) {
          return;
        }
        try {
          const latest = await api.projectFileExportJob(projectId, jobId);
          setFileExportJob(latest);
        } catch {
          toast({
            title: workbenchCopy.fileExport.failedTitle,
            variant: "destructive",
          });
        }
      });
  }
  const watchFileExportJobEvent = useEffectEvent(watchFileExportJob);

  useEffect(() => {
    const active = activeFileExport.data;
    if (!active || !isInFlightFileExportJob(active)) {
      return;
    }
    setFileExportJob(active);
    watchFileExportJobEvent(active.id);
  }, [activeFileExport.data]);

  async function retryFileExportJob(job: ProjectFileExportJob) {
    try {
      const retried = await api.retryProjectFileExportJob(projectId, job.id);
      setFileExportStartedHereIds((current) => new Set([...current, job.id]));
      setFileExportJob(retried);
      watchFileExportJob(job.id);
    } catch {
      toast({
        title: workbenchCopy.fileExport.failedTitle,
        variant: "destructive",
      });
    }
  }

  const uploadFolderFilesToNode = async (
    targetNode: WorkflowNode,
    files: File[],
    bucket: WorkingPaperBucket
  ) => {
    const groups = groupFolderUploadFiles(files);
    if (groups.length === 0) {
      return [];
    }

    setFolderUploadPending(true);
    let childCreated = false;
    try {
      const children = [...(targetNode.children ?? [])];
      const attachments: Attachment[] = [];

      for (const group of groups) {
        const existingNode = children.find(
          (child) => child.title === group.folderName
        );
        const targetChild =
          existingNode ??
          (await api.createWorkflowNode(projectId, {
            parentId: targetNode.id,
            code: buildNextWorkflowFolderCode({
              code: targetNode.code,
              children,
            }),
            title: group.folderName,
          }));
        if (!existingNode) {
          children.push(targetChild);
          childCreated = true;
        }

        const existingFileCounts = new Map<string, number>();
        for (const paper of targetChild.workingPapers ?? []) {
          if ((paper.bucket ?? "CURRENT") !== bucket) {
            continue;
          }
          existingFileCounts.set(
            paper.title,
            (existingFileCounts.get(paper.title) ?? 0) + 1
          );
        }
        const filesToUpload = group.files.filter((file) => {
          const existingCount = existingFileCounts.get(file.name) ?? 0;
          if (!existingCount) {
            return true;
          }
          existingFileCounts.set(file.name, existingCount - 1);
          return false;
        });
        if (filesToUpload.length === 0) {
          continue;
        }

        attachments.push(
          ...(await requestReferenceCodeUpload(
            targetChild,
            filesToUpload,
            bucket
          ))
        );
      }

      return attachments;
    } catch (error) {
      const title = workbenchCopy.folderUploadFailed ?? "Folder upload failed";
      showErrorToast(error, title);
      throw error;
    } finally {
      if (childCreated) {
        await refreshWorkflow();
      }
      setFolderUploadPending(false);
    }
  };
  const createNode = useMutation({
    mutationFn: (values: DirectoryNodeForm) =>
      api.createWorkflowNode(projectId, {
        parentId: addNodeTarget?.id ?? null,
        code: values.code,
        title: values.title,
      }),
    onSuccess: async (node) => {
      setAddNodeTarget(null);
      setDirectorySelectionCleared(false);
      setSelectedNodeId(node.id);
      setSelectedPaperId(null);
      toast({
        title: getNodeCreatedTitle(workbenchCopy, node.level),
        description: `${formatDisplayName(node.code)}`,
        variant: "success",
      });
      await refreshWorkflow();
      setSelectedNodeId(node.id);
    },
  });
  const updateNode = useMutation({
    mutationFn: ({
      nodeId,
      code,
      title,
    }: {
      nodeId: string;
      code: string;
      title: string;
    }) => api.updateWorkflowNode(projectId, nodeId, { code, title }),
    onSuccess: refreshWorkflow,
  });
  const deleteNode = useMutation({
    mutationFn: (nodeId: string) => api.deleteWorkflowNode(projectId, nodeId),
    onSuccess: async () => {
      setDirectorySelectionCleared(true);
      setSelectedNodeId(null);
      setSelectedPaperId(null);
      setHighlightedPaperId(null);
      clearMultiHighlightedPapers();
      setAddNodeTarget(null);
      toast({
        title: workbenchCopy.deleted,
        variant: "success",
        duration: 3000,
      });
      await refreshWorkflow();
    },
  });
  const createPaper = useMutation({
    mutationFn: (values: WorkbenchPaperForm) =>
      api.createWorkingPaper(projectId, {
        workflowNodeId: selectedNodeId ?? "",
        code: values.code,
        title: values.title,
        paperType: values.paperType,
        bucket: values.bucket,
      }),
    onSuccess: async (paper) => {
      paperForm.reset({
        code: "",
        title: "",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
      });
      toast({
        title: workbenchCopy.paperCreated,
        description: `${formatDisplayName(paper.code)}`,
        variant: "success",
      });
      await refreshWorkflow();
    },
  });
  const uploadFileToNode = useMutation({
    mutationFn: async ({
      node,
      file,
      bucket,
      sequenceOffset,
      code,
    }: {
      node: WorkflowNode;
      file: File;
      bucket: WorkingPaperBucket;
      sequenceOffset?: number;
      code?: string;
    }) => {
      assertUploadableFile(file, workbenchCopy);
      const paper = await api.createWorkingPaper(projectId, {
        workflowNodeId: node.id,
        code:
          code ??
          buildFilePaperCode(node, bucket, workflow.data ?? [], sequenceOffset),
        title: file.name,
        paperType: "WORKING_PAPER",
        bucket,
      });
      let attachment: Attachment;
      try {
        attachment = await api.uploadWorkingPaperAttachment(
          projectId,
          paper.id,
          file
        );
      } catch (error) {
        await api.deleteWorkingPaper(projectId, paper.id).catch(() => {});
        throw error;
      }
      return { node, paper, attachment, file };
    },
    onSuccess: async ({ node, paper, attachment, file }) => {
      seedUploadedAttachmentPreview(queryClient, projectId, attachment, file);
      const paperWithAttachment = attachUploadedFileToPaper(paper, attachment);
      const uploadedBucket = paper.bucket ?? "CURRENT";
      queryClient.setQueryData<WorkflowNode[]>(
        ["workflow", projectId],
        (current) =>
          current
            ? upsertWorkingPaperInWorkflow(
                current,
                node.id,
                paperWithAttachment
              )
            : current
      );
      queryClient.setQueryData<ProjectAttachment[]>(
        ["project-attachments", projectId],
        (current = []) =>
          upsertProjectAttachment(
            current,
            buildProjectAttachment(
              attachment,
              paperWithAttachment,
              node,
              findWorkflowNodePath(workflowNodes, node.id) ?? [
                toProjectAttachmentPathNode(node),
              ]
            )
          )
      );
      toast({
        title: workbenchCopy.fileUploaded,
        variant: "success",
        duration: 3000,
      });
      setAddNodeTarget(null);
      setSelectedNodeId(node.id);
      setSelectedPaperId(null);
      setHighlightedPaperId(paper.id);
      clearMultiHighlightedPapers();
      setActiveBucket(uploadedBucket);
      void queryClient.invalidateQueries({
        queryKey: ["project-attachments", projectId],
        refetchType: "none",
      });
      await refreshWorkflow();
      queryClient.setQueryData<WorkflowNode[]>(
        ["workflow", projectId],
        (current) =>
          current
            ? upsertWorkingPaperInWorkflow(
                current,
                node.id,
                paperWithAttachment
              )
            : current
      );
      setSelectedNodeId(node.id);
      setSelectedPaperId(null);
      setHighlightedPaperId(paper.id);
      clearMultiHighlightedPapers();
      setActiveBucket(uploadedBucket);
    },
  });
  const createPlaceholderToNode = useMutation({
    mutationFn: async ({
      node,
      code,
      name,
      bucket,
    }: {
      node: WorkflowNode;
      code: string;
      name: string;
      bucket: WorkingPaperBucket;
    }) => {
      const displayName = name.trim();
      const paper = await api.createWorkingPaper(projectId, {
        workflowNodeId: node.id,
        code: code.trim(),
        title: displayName,
        paperType: "WORKING_PAPER",
        bucket,
      });
      try {
        const attachment = await api.createAttachmentPlaceholder(
          projectId,
          paper.id,
          {
            name,
            placeholderType: "GENERIC",
          }
        );
        return { node, paper, attachment };
      } catch (error) {
        await api.deleteWorkingPaper(projectId, paper.id).catch(() => {});
        throw error;
      }
    },
    onSuccess: async ({ node, paper, attachment }) => {
      const paperWithAttachment = attachUploadedFileToPaper(paper, attachment);
      queryClient.setQueryData<WorkflowNode[]>(
        ["workflow", projectId],
        (current) =>
          current
            ? upsertWorkingPaperInWorkflow(
                current,
                node.id,
                paperWithAttachment
              )
            : current
      );
      await Promise.all([
        refreshWorkflow(),
        queryClient.invalidateQueries({
          queryKey: ["project-attachments", projectId],
        }),
      ]);
      toast({
        title:
          workbenchCopy.projectFileIndex.actionMenu.placeholderCreated ??
          "Placeholder created",
        description: attachment.originalName ?? attachment.fileName,
        variant: "success",
      });
      setSelectedNodeId(node.id);
      setSelectedPaperId(null);
      setHighlightedPaperId(paper.id);
      clearMultiHighlightedPapers();
      setActiveBucket(paper.bucket ?? "CURRENT");
    },
  });
  const requestReferenceCodeUpload = (
    node: WorkflowNode,
    files: File[],
    bucket: WorkingPaperBucket
  ) => {
    if (files.length === 0) {
      return Promise.resolve<Attachment[]>([]);
    }
    return new Promise<Attachment[]>((resolve, reject) => {
      setPendingReferenceCodeUpload({
        node,
        files,
        bucket,
        referenceCodes: files.map((_, sequenceOffset) =>
          buildFilePaperCode(node, bucket, workflow.data ?? [], sequenceOffset)
        ),
        resolve,
        reject,
      });
    });
  };
  const submitReferenceCodeUpload = async () => {
    const pending = pendingReferenceCodeUpload;
    if (!pending) {
      return;
    }
    try {
      const uploaded = await Promise.all(
        pending.files.map((file, index) =>
          uploadFileToNode.mutateAsync({
            node: pending.node,
            file,
            bucket: pending.bucket,
            code: pending.referenceCodes[index]?.trim(),
          })
        )
      );
      pending.resolve(uploaded.map((item) => item.attachment));
      setPendingReferenceCodeUpload(null);
    } catch (error) {
      pending.reject(error);
    }
  };
  const cancelReferenceCodeUpload = () => {
    pendingReferenceCodeUpload?.resolve([]);
    setPendingReferenceCodeUpload(null);
  };
  const uploadFileToWorkingPaper = useMutation({
    mutationFn: async ({
      node,
      paper,
      file,
    }: {
      node: WorkflowNode;
      paper: WorkingPaper;
      file: File;
    }) => {
      assertUploadableFile(file, workbenchCopy);
      const attachment = await api.uploadWorkingPaperAttachment(
        projectId,
        paper.id,
        file
      );
      return { node, paper, attachment, file };
    },
    onSuccess: async ({ node, paper, attachment, file }) => {
      seedUploadedAttachmentPreview(queryClient, projectId, attachment, file);
      const paperWithAttachment = attachUploadedFileToPaper(paper, attachment);
      queryClient.setQueryData<WorkflowNode[]>(
        ["workflow", projectId],
        (current) =>
          current
            ? upsertWorkingPaperInWorkflow(
                current,
                node.id,
                paperWithAttachment
              )
            : current
      );
      queryClient.setQueryData<ProjectAttachment[]>(
        ["project-attachments", projectId],
        (current = []) =>
          upsertProjectAttachment(
            current,
            buildProjectAttachment(
              attachment,
              paperWithAttachment,
              node,
              findWorkflowNodePath(workflowNodes, node.id) ?? [
                toProjectAttachmentPathNode(node),
              ]
            )
          )
      );
      toast({
        title: workbenchCopy.fileUploaded,
        variant: "success",
        duration: 3000,
      });
      void queryClient.invalidateQueries({
        queryKey: ["project-attachments", projectId],
        refetchType: "none",
      });
      await refreshWorkflow();
    },
  });
  const relocateDirectoryFiles = useMutation({
    mutationFn: async ({
      files,
      mode,
      node,
    }: {
      files: DirectoryFileTransfer[];
      mode: "copy" | "move";
      node: WorkflowNode;
    }) => {
      if (
        mode === "move" &&
        files.some(
          (file) =>
            projectAttachments.data?.find(
              (attachment) => attachment.id === file.attachmentId
            )?.confirmationEmpImportItems?.length
        )
      ) {
        throw new Error("请回到函证归档处撤回导入，再重新导入到目标位置");
      }
      directoryFilePasteTargetRef.current = node.id;
      const relocatedFiles: {
        attachment: Attachment;
        file: DirectoryFileTransfer;
      }[] = [];
      for (const file of files) {
        const input = {
          workflowNodeId: node.id,
          bucket: file.bucket,
        };
        const attachment =
          mode === "copy"
            ? await api.copyAttachment(projectId, file.attachmentId, input)
            : await api.moveAttachment(projectId, file.attachmentId, input);
        relocatedFiles.push({ attachment, file });
      }
      return { relocatedFiles, mode, node };
    },
    onSuccess: async ({ relocatedFiles, mode, node }) => {
      if (relocatedFiles.length === 0) {
        return;
      }
      const firstFile = relocatedFiles[0].file;
      const preserveMultiHighlight = relocatedFiles.length > 1;
      const targetHighlightIds = [
        ...new Set(
          relocatedFiles.map(({ attachment, file }) =>
            getDirectoryFileTargetHighlightId(
              attachment,
              file,
              preserveMultiHighlight
            )
          )
        ),
      ];
      const applyRelocationHighlight = () => {
        setDirectorySelectionCleared(false);
        setSelectedNodeId(node.id);
        setSelectedPaperId(null);
        if (preserveMultiHighlight) {
          setHighlightedPaperId(null);
          setHighlightedPaperIds(targetHighlightIds);
        } else {
          setHighlightedPaperId(targetHighlightIds[0] ?? null);
          clearMultiHighlightedPapers();
        }
      };
      setDirectoryFileClipboard(null);
      toast({
        title: mode === "copy" ? "File copied" : "File moved",
        description:
          relocatedFiles.length > 1
            ? `${relocatedFiles.length} files -> ${formatDisplayName(node.code)}`
            : `${firstFile.fileName} -> ${formatDisplayName(node.code)}`,
        variant: "success",
        duration: 3000,
      });
      applyRelocationHighlight();
      setActiveBucket(firstFile.bucket);
      if (
        mode === "move" ||
        relocatedFiles.some(
          ({ attachment }) => (attachment as ProjectAttachment).workingPaper
        )
      ) {
        queryClient.setQueryData<ProjectAttachment[]>(
          ["project-attachments", projectId],
          (current = []) =>
            relocatedFiles.reduce((next, { attachment, file }) => {
              const relocatedAttachment = attachment as ProjectAttachment;
              const withoutSource =
                mode === "move"
                  ? removeMovedProjectAttachmentFromSource(next, file)
                  : next;
              return relocatedAttachment.workingPaper
                ? upsertProjectAttachment(withoutSource, relocatedAttachment)
                : withoutSource;
            }, current)
        );
      }
      await queryClient.invalidateQueries({
        queryKey: ["project-attachments", projectId],
      });
      await refreshWorkflow();
      applyRelocationHighlight();
      window.setTimeout(() => {
        applyRelocationHighlight();
        if (directoryFilePasteTargetRef.current === node.id) {
          directoryFilePasteTargetRef.current = null;
        }
      }, 0);
    },
    onError: (error) => {
      directoryFilePasteTargetRef.current = null;
      showErrorToast(error, "Relocation failed");
    },
  });
  const pasteDirectoryFiles = (
    files: DirectoryFileTransfer[],
    mode: "copy" | "move",
    node: WorkflowNode
  ) => {
    if (files.length === 0) {
      return;
    }
    const preserveMultiHighlight = files.length > 1;
    if (preserveMultiHighlight) {
      setDirectorySelectionCleared(false);
      setSelectedNodeId(node.id);
      setSelectedPaperId(null);
      setHighlightedPaperId(null);
      setHighlightedPaperIds([]);
    }
    relocateDirectoryFiles.mutate({ files, mode, node });
  };
  const pasteDirectoryFileClipboard = (node: WorkflowNode) => {
    if (!directoryFileClipboard) {
      return;
    }
    const files = directoryFileClipboard.files?.length
      ? directoryFileClipboard.files
      : [directoryFileClipboard.file];
    pasteDirectoryFiles(files, directoryFileClipboard.mode, node);
  };
  const relocateDirectoryNode = useMutation({
    mutationFn: async ({
      mode,
      node,
      source,
    }: {
      mode: "copy" | "move";
      node: WorkflowNode;
      source: DirectoryNodeTransfer;
    }) => {
      const sourceNode = findWorkflowNode(workflowNodes, source.nodeId);
      if (!sourceNode) {
        throw new Error(workbenchCopy.directoryRelocation.notFound);
      }
      const targetParentId = node.id;
      if (
        sourceNode.id === targetParentId ||
        (targetParentId && containsWorkflowNodeId(sourceNode, targetParentId))
      ) {
        throw new Error(workbenchCopy.directoryRelocation.selfTarget);
      }

      if (mode === "move") {
        const movedNode = await api.updateWorkflowNode(
          projectId,
          sourceNode.id,
          {
            parentId: targetParentId,
          }
        );
        return { mode, node, resultNode: movedNode, sourceNode };
      }
      const createdNode = await copyWorkflowNodeTree(
        projectId,
        sourceNode,
        targetParentId
      );
      return { mode, node, resultNode: createdNode, sourceNode };
    },
    onSuccess: async ({ mode, node, resultNode, sourceNode }) => {
      toast({
        title:
          mode === "copy"
            ? workbenchCopy.directoryRelocation.copied
            : workbenchCopy.directoryRelocation.moved,
        description: node
          ? `${formatDisplayName(sourceNode.code)} -> ${formatDisplayName(node.code)}`
          : formatDisplayName(sourceNode.code),
        variant: "success",
        duration: 3000,
      });
      setDirectorySelectionCleared(false);
      setSelectedNodeId(resultNode.id);
      setSelectedPaperId(null);
      setHighlightedPaperId(null);
      clearMultiHighlightedPapers();
      await refreshWorkflow();
    },
    onError: (error) => {
      showErrorToast(error, workbenchCopy.directoryRelocation.failed);
    },
  });
  const acceptDeclaration = useMutation({
    mutationFn: () => api.acceptProjectDeclaration(projectId),
    onSuccess: async () => {
      queryClient.setQueryData(["projectDeclaration", projectId], {
        accepted: true,
        acceptedAt: new Date().toISOString(),
      });
      await queryClient.invalidateQueries({
        queryKey: ["projectDeclaration", projectId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["members", projectId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["auditLogs", projectId],
      });
    },
  });
  const archiveProject = useMutation({
    mutationFn: () => api.submitArchive(projectId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["desktop"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["workflow", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["auditLogs", projectId] }),
      ]);
    },
  });
  const reopenProject = useMutation({
    mutationFn: () =>
      api.reopenProject(projectId, {
        reason: reopenReason.trim() || undefined,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["desktop"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["workflow", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["auditLogs", projectId] }),
        queryClient.invalidateQueries({ queryKey: inboxQueryKey }),
      ]);
      toast({
        title: workbenchCopy.archiveCheck.projectReopened,
        variant: "success",
        duration: 3000,
      });
    },
  });
  const refreshAfterArchiveJob = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["desktop"] }),
      queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["workflow", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["auditLogs", projectId] }),
      queryClient.invalidateQueries({
        queryKey: ["archiveArtifact", projectId],
      }),
      queryClient.invalidateQueries({ queryKey: inboxQueryKey }),
    ]);
    router.refresh();
  };
  const handleArchiveJobUpdate = (job: ArchiveJobSnapshot) => {
    setArchiveJobSnapshot(job);
    if (job.status === "failed") {
      const title = workbenchCopy.archiveCheck.confirmArchiveFailed;
      setArchiveJobErrorMessage(title);
      showErrorToast(job.error ?? new Error(title), title);
      void refreshAfterArchiveJob();
      return true;
    }
    if (job.status === "completed") {
      setArchiveJobErrorMessage(null);
      void refreshAfterArchiveJob();
      return true;
    }
    return false;
  };
  const pollArchiveJob = async (jobId: string, signal: AbortSignal) => {
    for (let index = 0; index < 120; index += 1) {
      if (signal.aborted) {
        return;
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });
      if (signal.aborted) {
        return;
      }
      try {
        const status = await api.archiveJob(projectId, jobId);
        if (handleArchiveJobUpdate(status)) {
          return;
        }
      } catch (error) {
        if (!signal.aborted) {
          const title = workbenchCopy.archiveCheck.confirmArchiveFailed;
          setArchiveJobErrorMessage(title);
          showErrorToast(error, title);
        }
        return;
      }
    }
    if (!signal.aborted) {
      await refreshAfterArchiveJob();
    }
  };
  const watchArchiveJob = (job: ArchiveJobSnapshot) => {
    archiveJobAbortRef.current?.abort();
    const controller = new AbortController();
    archiveJobAbortRef.current = controller;
    setArchiveJobErrorMessage(null);
    const terminal = handleArchiveJobUpdate(job);
    if (terminal) {
      return;
    }

    let reachedTerminal = false;
    void api
      .watchArchiveJob(
        projectId,
        job.jobId,
        (snapshot) => {
          reachedTerminal = handleArchiveJobUpdate(snapshot);
          if (reachedTerminal) {
            controller.abort();
          }
        },
        { signal: controller.signal }
      )
      .catch((error) => {
        if (controller.signal.aborted || reachedTerminal) {
          return;
        }
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        void pollArchiveJob(job.jobId, controller.signal);
      });
  };
  const confirmProjectArchive = useMutation({
    mutationFn: () => api.confirmProjectArchive(projectId),
    onSuccess: async (job) => {
      await Promise.resolve();
      watchArchiveJob(job);
    },
    onError: (error) => {
      const title = workbenchCopy.archiveCheck.confirmArchiveFailed;
      setArchiveJobErrorMessage(title);
      showErrorToast(error, title);
    },
  });
  const markInboxRead = useMutation({
    mutationFn: api.markInboxRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inboxQueryKey }),
  });
  const markInboxUnread = useMutation({
    mutationFn: api.markInboxUnread,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inboxQueryKey }),
  });
  const restoreDeletedAttachment = useMutation({
    mutationFn: ({
      attachmentId,
      workingPaperId,
      workflowNodeId,
    }: {
      attachmentId: string;
      workingPaperId?: string;
      workflowNodeId?: string;
    }) =>
      api.restoreAttachment(projectId, attachmentId, {
        workingPaperId,
        workflowNodeId,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["deleted-attachments", projectId],
        }),
        queryClient.invalidateQueries({ queryKey: ["work-items"] }),
        queryClient.invalidateQueries({
          queryKey: ["project-attachments", projectId],
        }),
        queryClient.invalidateQueries({ queryKey: ["workflow", projectId] }),
        queryClient.invalidateQueries({
          queryKey: ["workingPaper", projectId],
        }),
        queryClient.invalidateQueries({ queryKey: ["auditLogs", projectId] }),
      ]);
    },
  });

  async function confirmDeleteNode(target: WorkflowNode) {
    const deleteCopy = getDeleteNodeCopy(workbenchCopy, target.level);
    const confirmed = await confirm({
      title: deleteCopy.title,
      description: deleteCopy.description,
      confirmLabel: workbenchCopy.confirmDelete,
      cancelLabel: dictionary.common.cancel,
    });
    if (confirmed) {
      deleteNode.mutate(target.id);
    }
  }

  if (project.isLoading) {
    return renderStatusShell(workbenchCopy.loadingWorkbench, "muted");
  }

  if (project.isError) {
    const errorCode =
      project.error instanceof ApiError ? project.error.code : undefined;
    const accessDenied = errorCode === "FORBIDDEN";
    const unavailable =
      errorCode === "NOT_FOUND" || errorCode === "PROJECT_NOT_FOUND";
    return renderStatusShell(
      <div className="flex flex-col items-start gap-3">
        <p>
          {accessDenied
            ? workbenchCopy.workbenchAccessDenied
            : unavailable
              ? workbenchCopy.workbenchUnavailable
              : workbenchCopy.workbenchLoadFailed}
        </p>
        {!accessDenied && !unavailable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={project.isFetching}
            onClick={() => project.refetch()}
          >
            {workbenchCopy.workbenchRetry}
          </Button>
        )}
      </div>,
      "destructive"
    );
  }

  const loadedProject = project.data;
  if (!loadedProject) {
    return renderStatusShell(workbenchCopy.loadingWorkbench, "muted");
  }
  const projectTemplateLanguage = loadedProject.language ?? locale;
  const isDetachedPreviewWindow = searchParams.get("previewWindow") === "1";
  const declarationBlocked = requiresProjectDeclaration(declaration.data);
  const archiveJobRunning = Boolean(
    archiveJobSnapshot &&
    archiveJobSnapshot.status !== "completed" &&
    archiveJobSnapshot.status !== "failed"
  );
  function navigateToArchiveCheckIssue(paperId: string, attachmentId?: string) {
    locatePaperInWorkbench(paperId, {
      expandDirectory: true,
      highlightId: attachmentId,
    });
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "overview");
    params.set("locatePaperId", paperId);
    if (attachmentId) {
      params.set("attachmentId", attachmentId);
      params.set("focus", "attachment");
    } else {
      params.delete("attachmentId");
      params.delete("focus");
    }
    params.delete("workingPaperId");
    params.delete("reviewQuestionId");
    params.delete("sheetName");
    params.delete("cellAddress");
    params.delete("smartFormPreview");
    params.delete("smartFormNodeId");
    params.delete("smartFormRowId");
    params.delete("smartFormTargetLabel");
    router.replace(`${localizedPath(`/engagement/${projectId}`)}?${params}`);
  }
  const settingsActions = (
    <WorkbenchSettingsPanel
      projectId={projectId}
      canArchiveProject={canArchiveCurrentProject}
      canDeleteProject={canDeleteCurrentProject}
      canRunArchiveWorkflow={canRunArchiveWorkflow}
      isFinalArchiveReview={canReviewFinalArchive}
      canEditProject={Boolean(canEditCurrentProject)}
      archivePending={
        archiveProject.isPending ||
        confirmProjectArchive.isPending ||
        archiveJobRunning
      }
      archiveJob={archiveJobSnapshot}
      archiveJobErrorMessage={archiveJobErrorMessage ?? undefined}
      initialSection={settingsInitialSection}
      archiveReviewRequestKey={archiveReviewRequestKey}
      onArchiveProject={() => {
        if (canReviewFinalArchive) {
          confirmProjectArchive.mutate();
          return;
        }
        archiveProject.mutate();
      }}
      onReopenProject={() => setReopenDialogOpen(true)}
      onLocateWorkingPaper={navigateToArchiveCheckIssue}
      onOpenArchiveCheckNavigator={(snapshot) => {
        setArchiveCheckNavigator(snapshot);
        setArchiveCheckNavigatorMinimized(false);
        setArchiveCheckNavigatorPosition(null);
        setSettingsOpen(false);
      }}
      recycleBinContent={
        declarationBlocked || !canViewRecycleBin ? undefined : (
          <AttachmentRecycleBinPanel
            attachments={deletedAttachments.data ?? []}
            loading={deletedAttachments.isLoading}
            pending={restoreDeletedAttachment.isPending}
            restoreTargetNodes={restoreTargetNodes}
            pathNodes={workflowNodes}
            fullDialogOpen={recycleBinDialogOpen}
            onFullDialogOpenChange={setRecycleBinDialogOpen}
            restoreAttachment={(attachmentId, target) =>
              restoreDeletedAttachment.mutate({
                attachmentId,
                ...target,
              })
            }
          />
        )
      }
    />
  );
  const setDirectoryPanelCollapsed = (collapsed: boolean) => {
    if (directoryPanelCollapsedRef.current === collapsed) {
      return;
    }
    directoryPanelCollapsedRef.current = collapsed;
    setIsDirectoryPanelCollapsed(collapsed);
  };
  const setPreviewPanelCollapsed = (collapsed: boolean) => {
    if (previewPanelCollapsedRef.current === collapsed) {
      return;
    }
    previewPanelCollapsedRef.current = collapsed;
    setIsPreviewPanelCollapsed(collapsed);
  };
  const beginWorkbenchPanelResize = () => {
    const groups = [
      workspacePanelGroupElementRef.current,
      reviewNotesPanelGroupElementRef.current,
    ].filter((group): group is HTMLDivElement => Boolean(group));
    if (groups.length === 0) {
      return;
    }

    if (workbenchPanelResizeFinishFrameRef.current !== null) {
      window.cancelAnimationFrame(workbenchPanelResizeFinishFrameRef.current);
      workbenchPanelResizeFinishFrameRef.current = null;
    }

    for (const group of groups) {
      group.dataset.dataGridLayoutResizing = "true";
    }
  };
  const finishWorkbenchPanelResize = () => {
    const groups = [
      workspacePanelGroupElementRef.current,
      reviewNotesPanelGroupElementRef.current,
    ].filter((group): group is HTMLDivElement => Boolean(group));
    if (groups.length === 0) {
      return;
    }

    if (workbenchPanelResizeFinishFrameRef.current !== null) {
      window.cancelAnimationFrame(workbenchPanelResizeFinishFrameRef.current);
    }
    workbenchPanelResizeFinishFrameRef.current = window.requestAnimationFrame(
      () => {
        workbenchPanelResizeFinishFrameRef.current = null;
        for (const group of groups) {
          delete group.dataset.dataGridLayoutResizing;
          group.dispatchEvent(
            new CustomEvent("data-grid-layout-resize-end", { bubbles: true })
          );
        }
      }
    );
  };
  const commitDirectoryPanelResize = () => {
    const width = directoryPanelPendingWidthRef.current;
    directoryPanelPendingWidthRef.current = null;
    if (directoryPanelCollapsedRef.current || width === null) {
      directoryPanelRef.current?.collapse();
      finishWorkbenchPanelResize();
      return;
    }

    directoryPanelWidthRef.current = width;
    directoryPanelRef.current?.expand();
    directoryPanelRef.current?.resize(width);
    finishWorkbenchPanelResize();
  };
  const commitPreviewPanelResize = () => {
    const width = previewPanelPendingWidthRef.current;
    previewPanelPendingWidthRef.current = null;
    if (previewPanelCollapsedRef.current || width === null) {
      previewPanelRef.current?.collapse();
      finishWorkbenchPanelResize();
      return;
    }

    previewPanelWidthRef.current = width;
    previewPanelRef.current?.expand();
    previewPanelRef.current?.resize(width);
    finishWorkbenchPanelResize();
  };
  const scheduleDirectoryPanelResize = (width: number) => {
    directoryPanelPendingWidthRef.current = width;
    if (directoryPanelResizeFrameRef.current !== null) {
      return;
    }
    directoryPanelResizeFrameRef.current = window.requestAnimationFrame(() => {
      directoryPanelResizeFrameRef.current = null;
      const pendingWidth = directoryPanelPendingWidthRef.current;
      if (pendingWidth === null) {
        return;
      }
      directoryPanelWidthRef.current = pendingWidth;
      directoryPanelRef.current?.expand();
      directoryPanelRef.current?.resize(pendingWidth);
    });
  };
  const schedulePreviewPanelResize = (width: number) => {
    previewPanelPendingWidthRef.current = width;
    if (previewPanelResizeFrameRef.current !== null) {
      return;
    }
    previewPanelResizeFrameRef.current = window.requestAnimationFrame(() => {
      previewPanelResizeFrameRef.current = null;
      const pendingWidth = previewPanelPendingWidthRef.current;
      if (pendingWidth === null) {
        return;
      }
      previewPanelWidthRef.current = pendingWidth;
      previewPanelRef.current?.expand();
      previewPanelRef.current?.resize(pendingWidth);
    });
  };
  const cancelDirectoryPanelResize = () => {
    if (directoryPanelResizeFrameRef.current !== null) {
      window.cancelAnimationFrame(directoryPanelResizeFrameRef.current);
      directoryPanelResizeFrameRef.current = null;
    }
    directoryPanelPendingWidthRef.current = null;
  };
  const cancelPreviewPanelResize = () => {
    if (previewPanelResizeFrameRef.current !== null) {
      window.cancelAnimationFrame(previewPanelResizeFrameRef.current);
      previewPanelResizeFrameRef.current = null;
    }
    previewPanelPendingWidthRef.current = null;
  };
  const syncDirectoryPanelSize = (panelSize: PanelSize) => {
    const collapsed = panelSize.inPixels <= 1;
    setDirectoryPanelCollapsed(collapsed);
    if (!collapsed && !compactLayoutGuard.current) {
      directoryPanelWidthRef.current = panelSize.inPixels;
    }
  };
  const toggleDirectoryPanel = () => {
    if (directoryPanelCollapsedRef.current) {
      directoryPanelRef.current?.expand();
      directoryPanelRef.current?.resize(directoryPanelWidthRef.current);
      setDirectoryPanelCollapsed(false);
      return;
    }
    directoryPanelRef.current?.collapse();
    setDirectoryPanelCollapsed(true);
  };
  const resizeDirectoryPanel = (deltaX: number) => {
    const nextWidth = directoryResizeStartRef.current + deltaX;
    if (nextWidth < MINIMUM_DIRECTORY_PANEL_PIXELS / 2) {
      cancelDirectoryPanelResize();
      directoryPanelRef.current?.collapse();
      setDirectoryPanelCollapsed(true);
      return;
    }
    const width = Math.max(MINIMUM_DIRECTORY_PANEL_PIXELS, nextWidth);
    if (directoryPanelCollapsedRef.current) {
      setDirectoryPanelCollapsed(false);
    }
    scheduleDirectoryPanelResize(width);
  };
  const syncPreviewPanelSize = (panelSize: PanelSize) => {
    const collapsed = panelSize.inPixels <= 1;
    setPreviewPanelCollapsed(collapsed);
    if (!collapsed && !compactLayoutGuard.current) {
      previewPanelWidthRef.current = panelSize.inPixels;
    }
  };
  const restorePreviewExpandedLayout = () => {
    const layout = expandedPreviewLayoutRef.current;
    if (!layout) {
      return;
    }

    workspacePanelGroupRef.current?.setLayout(layout);
    expandedPreviewLayoutRef.current = null;
    setIsPreviewExpanded(false);
  };
  const togglePreviewExpanded = () => {
    if (expandedPreviewLayoutRef.current) {
      restorePreviewExpandedLayout();
      return;
    }

    const layout = workspacePanelGroupRef.current?.getLayout();
    if (!layout || Object.keys(layout).length === 0) {
      return;
    }

    expandedPreviewLayoutRef.current = layout;
    workspacePanelGroupRef.current?.setLayout({
      ...layout,
      "project-directory": 0,
      "project-file-preview": 100,
      "project-review": 0,
    });
    setIsPreviewExpanded(true);
  };
  const hidePreviewPanel = () => {
    if (compactWorkbench) {
      setCompactPane("files");
      return;
    }
    restorePreviewExpandedLayout();
    cancelPreviewPanelResize();
    previewPanelRef.current?.collapse();
    setPreviewPanelCollapsed(true);
  };
  const showPreviewPanel = () => {
    setProjectWorkItemsOpen(false);
    if (compactWorkbench) {
      setCompactPane("preview");
      return;
    }
    previewPanelRef.current?.expand();
    previewPanelRef.current?.resize(previewPanelWidthRef.current);
    setPreviewPanelCollapsed(false);
  };
  const togglePreviewPanel = () => {
    if (previewPanelCollapsedRef.current) {
      showPreviewPanel();
      return;
    }
    hidePreviewPanel();
  };
  const resizePreviewPanel = (deltaX: number) => {
    const nextWidth = previewResizeStartRef.current - deltaX;
    if (nextWidth < MINIMUM_CONTEXT_PANEL_PIXELS / 2) {
      hidePreviewPanel();
      return;
    }
    const width = Math.max(MINIMUM_CONTEXT_PANEL_PIXELS, nextWidth);
    if (previewPanelCollapsedRef.current) {
      setProjectWorkItemsOpen(false);
      setPreviewPanelCollapsed(false);
    }
    schedulePreviewPanelResize(width);
  };
  const getMaximumReviewNotesPanelHeight = () => {
    const measuredGroupHeight =
      reviewNotesPanelGroupElementRef.current?.getBoundingClientRect().height ??
      0;
    const groupHeight =
      measuredGroupHeight > 0
        ? measuredGroupHeight
        : Math.max(DEFAULT_REVIEW_NOTES_PANEL_PIXELS * 2, window.innerHeight);
    return Math.max(MINIMUM_REVIEW_NOTES_PANEL_PIXELS, groupHeight - 260);
  };
  const setReviewNotesPanelCollapsed = (collapsed: boolean) => {
    if (reviewNotesPanelCollapsedRef.current === collapsed) {
      return;
    }
    reviewNotesPanelCollapsedRef.current = collapsed;
    setIsReviewNotesPanelCollapsed(collapsed);
  };
  const cancelReviewNotesPanelResize = () => {
    if (reviewNotesPanelResizeFrameRef.current !== null) {
      window.cancelAnimationFrame(reviewNotesPanelResizeFrameRef.current);
      reviewNotesPanelResizeFrameRef.current = null;
    }
    reviewNotesPanelPendingHeightRef.current = null;
  };
  const scheduleReviewNotesPanelResize = (height: number) => {
    reviewNotesPanelPendingHeightRef.current = height;
    if (reviewNotesPanelResizeFrameRef.current !== null) {
      return;
    }
    reviewNotesPanelResizeFrameRef.current = window.requestAnimationFrame(
      () => {
        reviewNotesPanelResizeFrameRef.current = null;
        const pendingHeight = reviewNotesPanelPendingHeightRef.current;
        if (pendingHeight === null) {
          return;
        }
        reviewNotesPanelHeightRef.current = pendingHeight;
        reviewNotesPanelRef.current?.expand();
        reviewNotesPanelRef.current?.resize(pendingHeight);
      }
    );
  };
  const commitReviewNotesPanelResize = () => {
    const height = reviewNotesPanelPendingHeightRef.current;
    if (reviewNotesPanelResizeFrameRef.current !== null) {
      window.cancelAnimationFrame(reviewNotesPanelResizeFrameRef.current);
      reviewNotesPanelResizeFrameRef.current = null;
    }
    reviewNotesPanelPendingHeightRef.current = null;
    if (height === null || reviewNotesPanelCollapsedRef.current) {
      finishWorkbenchPanelResize();
      return;
    }
    reviewNotesPanelHeightRef.current = height;
    reviewNotesPanelRef.current?.expand();
    reviewNotesPanelRef.current?.resize(height);
    setReviewNotesPanelHeight(height);
    storeReviewNotesPanelHeight(projectId, height);
    finishWorkbenchPanelResize();
  };
  const syncReviewNotesPanelSize = (panelSize: PanelSize) => {
    const collapsed = panelSize.inPixels <= 1;
    setReviewNotesPanelCollapsed(collapsed);
    if (!collapsed && !compactLayoutGuard.current) {
      reviewNotesPanelHeightRef.current = panelSize.inPixels;
    }
  };
  const toggleReviewNotesPanel = () => {
    if (reviewNotesPanelCollapsedRef.current) {
      const height = Math.min(
        Math.max(
          MINIMUM_REVIEW_NOTES_PANEL_PIXELS,
          reviewNotesPanelHeightRef.current
        ),
        getMaximumReviewNotesPanelHeight()
      );
      reviewNotesPanelRef.current?.expand();
      reviewNotesPanelRef.current?.resize(height);
      reviewNotesPanelHeightRef.current = height;
      setReviewNotesPanelHeight(height);
      setReviewNotesPanelCollapsed(false);
      return;
    }
    reviewNotesPanelRef.current?.collapse();
    setReviewNotesPanelCollapsed(true);
  };
  const resizeReviewNotesPanel = (deltaY: number) => {
    if (reviewNotesResizeStartedCollapsedRef.current && deltaY >= 0) {
      return;
    }
    const nextHeight = reviewNotesResizeStartRef.current - deltaY;
    if (shouldSnapReviewNotesPanelClosed(nextHeight)) {
      cancelReviewNotesPanelResize();
      reviewNotesPanelRef.current?.collapse();
      setReviewNotesPanelCollapsed(true);
      return;
    }
    const height = Math.min(
      Math.max(MINIMUM_REVIEW_NOTES_PANEL_PIXELS, nextHeight),
      getMaximumReviewNotesPanelHeight()
    );
    setReviewNotesPanelCollapsed(false);
    scheduleReviewNotesPanelResize(height);
  };
  const previewFile = (attachmentId: string) => {
    setPreviewedAttachmentId(attachmentId);
    showPreviewPanel();
  };
  const uploadPreviewFile = async (file: File) => {
    const paper = previewTarget?.paper;
    if (!canUploadWorkingPapers || !paper) {
      return;
    }

    const node = findWorkflowNode(workflowNodes, paper.workflowNodeId);
    if (!node) {
      return;
    }

    const { attachment } = await uploadFileToWorkingPaper.mutateAsync({
      node,
      paper,
      file,
    });
    previewFile(attachment.id);
  };
  const previewDroppedFile = (event: DragEndEvent) => {
    if (event.over?.id !== WORKBENCH_FILE_PREVIEW_DROPPABLE_ID) {
      return;
    }
    const data = event.active.data.current;
    if (data?.type !== WORKBENCH_FILE_DRAG_TYPE) {
      return;
    }
    const { attachmentId } = data;
    if (typeof attachmentId === "string") {
      previewFile(attachmentId);
    }
  };
  const moveDroppedFileToDirectory = (event: DragEndEvent) => {
    const active = event.active.data.current;
    const over = event.over?.data.current;
    if (
      active?.type !== WORKBENCH_FILE_DRAG_TYPE ||
      over?.type !== WORKBENCH_FILE_DIRECTORY_DROP_TYPE ||
      typeof active.attachmentId !== "string" ||
      typeof active.fileName !== "string" ||
      typeof active.workflowNodeId !== "string" ||
      typeof active.workingPaperId !== "string" ||
      typeof active.bucket !== "string" ||
      typeof over.workflowNodeId !== "string" ||
      active.workflowNodeId === over.workflowNodeId
    ) {
      return;
    }
    const node = findWorkflowNode(workflowNodes, over.workflowNodeId);
    if (!node) {
      return;
    }
    pasteDirectoryFiles(
      [
        {
          attachmentId: active.attachmentId,
          bucket: active.bucket as WorkingPaperBucket,
          fileName: active.fileName,
          nodeId: active.workflowNodeId,
          paperId: active.workingPaperId,
        },
      ],
      "move",
      node
    );
  };
  const beginPreviewFileDrag = (event: DragStartEvent) => {
    const fileName = event.active.data.current?.fileName;
    setPreviewDragFileName(typeof fileName === "string" ? fileName : null);
  };
  const clearPreviewFileDrag = () => setPreviewDragFileName(null);
  const projectPersonalWorkItems = (personalWorkItems.data?.items ?? []).filter(
    (item) => item.domain === "PROJECT" && item.project?.id === projectId
  );
  const projectWorkItemCount = new Set(
    [...projectPersonalWorkItems, ...(teamWorkItems.data?.items ?? [])].map(
      (item) => item.id
    )
  ).size;
  const openTeamWorkItem = (
    item: WorkItem,
    questionItems: ProjectReviewQuestionItem[]
  ) => {
    if (item.actionTarget.resourceType === "REVIEW_QUESTION") {
      const question = questionItems.find(
        (candidate) => candidate.question.id === item.actionTarget.resourceId
      );
      if (question) {
        locateProjectReviewQuestion(question);
      }
      return;
    }
    if (item.actionTarget.resourceType === "ATTACHMENT") {
      const attachmentId = item.actionTarget.resourceId;
      const attachment = (projectAttachments.data ?? []).find(
        (candidate) => candidate.id === attachmentId
      );
      if (attachment?.workingPaperId) {
        locatePaperInWorkbench(attachment.workingPaperId, {
          highlightId: attachment.id,
        });
      } else if (attachmentId) {
        previewFile(attachmentId);
      }
      return;
    }
    if (
      item.actionTarget.resourceType === "PROJECT" ||
      item.actionTarget.resourceType === "TMS_PENDING_LINK"
    ) {
      setSettingsInitialSection(
        ["EMP-007", "EMP-008", "EMP-010"].includes(item.ruleId)
          ? "archive"
          : "general"
      );
      setSettingsOpen(true);
    }
  };
  const createFromTemplateLabel =
    workbenchCopy.projectFileIndex?.actionMenu?.createFromTemplate ??
    workbenchCopy.templateLibrary?.label ??
    "New from template";
  const createSmartFormLabel =
    workbenchCopy.projectFileIndex?.actionMenu?.createSmartForm ??
    workbenchCopy.templateLibrary?.smartFormTemplatesTitle ??
    "New Smart Form";
  const confirmationsCopy =
    dictionary.confirmations ?? defaultProjectConfirmationsCopy;
  const confirmationsButtonLabel =
    confirmationsCopy.shortcutLabel ?? confirmationsCopy.title;
  const selectWorkbenchNode = (id: string) => {
    const shouldKeepFileHighlight =
      id === selectedNodeId || id === directoryFilePasteTargetRef.current;
    setAddNodeTarget(null);
    setDirectorySelectionCleared(false);
    setSelectedNodeId(id);
    setSelectedPaperId(null);
    if (!shouldKeepFileHighlight) {
      directoryFilePasteTargetRef.current = null;
      setHighlightedPaperId(null);
      clearMultiHighlightedPapers();
    }
  };
  const renderWorkbenchDirectory = () => (
    <WorkbenchDirectory
      mobileLocale={isPhone ? locale : undefined}
      className="h-full w-full rounded-lg border-0 shadow-none"
      copy={dictionary.workbench}
      workflow={workflowNodes}
      selectedNodeId={selectedNodeId}
      selectedNodeHighlightId={
        directorySelectionCleared
          ? null
          : (highlightedPaperNodeId ?? selectedNodeId)
      }
      readOnly={isReadOnlyProject || !canModifyIndex}
      addNodeTarget={addNodeTarget}
      setSelectedNodeId={(nodeId) => {
        if (isPhone) {
          setMobileDirectoryManagementOpen(false);
        }
        selectWorkbenchNode(nodeId);
        if (compactWorkbench) {
          setCompactPane("files");
        }
      }}
      openAddNode={(target) => {
        setDirectorySelectionCleared(false);
        setSelectedNodeId(target.id);
        setSelectedPaperId(null);
        setHighlightedPaperId(null);
        clearMultiHighlightedPapers();
        setAddNodeTarget(target);
      }}
      closeAddNode={() => setAddNodeTarget(null)}
      createNode={(values) => {
        if (canModifyIndex) {
          createNode.mutate(values);
        }
      }}
      createNodePending={createNode.isPending}
      renameNode={
        canModifyIndex
          ? (node, values) =>
              updateNode.mutate({
                nodeId: node.id,
                code: values.code,
                title: values.title,
              })
          : undefined
      }
      renameNodePending={updateNode.isPending}
      deleteNode={(node) => {
        if (canModifyIndex) {
          void confirmDeleteNode(node);
        }
      }}
      deleteNodePending={deleteNode.isPending}
      selectedPaperId={selectedPaperId}
      highlightedPaperId={highlightedPaperId}
      onSelectPaper={(paperId, nodeId) => {
        if (isPhone) {
          setMobileDirectoryManagementOpen(false);
        }
        if (compactWorkbench) {
          setCompactPane("files");
        }
        setAddNodeTarget(null);
        setDirectorySelectionCleared(false);
        setSelectedNodeId(nodeId);
        setSelectedPaperId(null);
        setHighlightedPaperId(paperId);
        clearMultiHighlightedPapers();
        setActiveBucket(
          findWorkflowPaperBucket(workflowNodes, paperId) ?? "CURRENT"
        );
      }}
      onLocatePaper={(paperId, nodeId, highlightId) => {
        locatePaperInWorkbench(paperId, {
          expandDirectory: true,
          highlightId,
        });
      }}
      fileClipboard={directoryFileClipboard}
      onFileClipboardChange={
        canModifyIndex ? setDirectoryFileClipboard : undefined
      }
      onCopyFileToNode={
        canModifyIndex
          ? (file, node, files) =>
              pasteDirectoryFiles(files?.length ? files : [file], "copy", node)
          : undefined
      }
      onMoveFileToNode={
        canModifyIndex
          ? (file, node, files) =>
              pasteDirectoryFiles(files?.length ? files : [file], "move", node)
          : undefined
      }
      onCopyNodeToNode={
        canModifyIndex
          ? (source, node) =>
              relocateDirectoryNode.mutate({ source, mode: "copy", node })
          : undefined
      }
      onMoveNodeToNode={
        canModifyIndex
          ? (source, node) =>
              relocateDirectoryNode.mutate({ source, mode: "move", node })
          : undefined
      }
      onExportNode={(node, bucket) =>
        startFileExport(
          {
            scope: "WORKFLOW_NODE",
            workflowNodeId: node.id,
            bucket,
          },
          formatTemplate(workbenchCopy.fileExport.folderStarted, {
            name: formatWorkflowNodeContextLabel(node),
          })
        )
      }
      onUploadFile={
        canUploadFilesToNode
          ? (node, bucket, file) => {
              void requestReferenceCodeUpload(node, [file], bucket);
            }
          : undefined
      }
      uploadFilePending={uploadFileToNode.isPending}
      relocateFilePending={
        relocateDirectoryFiles.isPending || relocateDirectoryNode.isPending
      }
      visibleFileBucket={activeBucket}
      showFiles
      showFileRows={canViewTemporaryFiles && activeBucket === "TEMPORARY"}
      useTemporaryFilesView={false}
      showTemporaryFiles={canViewTemporaryFiles}
      onVisibleFileBucketChange={(bucket) =>
        setActiveBucket(
          bucket === "TEMPORARY" && !canViewTemporaryFiles ? "CURRENT" : bucket
        )
      }
      auditYear={auditYear}
      onMultiSelectedItemIdsChange={(itemIds) => {
        const paperIds = itemIds
          .filter((itemId) => itemId.startsWith("paper:"))
          .map((itemId) => itemId.slice("paper:".length));
        setHighlightedPaperIds(paperIds);
        if (paperIds.length === 0) {
          return;
        }
        setDirectorySelectionCleared(false);
        const firstNodeId = findWorkflowNodeIdForPaper(
          workflowNodes,
          paperIds[0]
        );
        if (firstNodeId) {
          setSelectedNodeId(firstNodeId);
        }
        setSelectedPaperId(null);
        setHighlightedPaperId(null);
      }}
      multiSelectionResetKey={directoryMultiSelectionResetKey}
      isLoading={workflow.isLoading}
      panelCollapsed={false}
      panelToggleLabel={workbenchCopy.directoryHideLabel}
      onPanelToggle={undefined}
      onClearSelection={() => {
        if (directoryFilePasteTargetRef.current) {
          return;
        }
        setDirectorySelectionCleared(true);
        setSelectedPaperId(null);
        setHighlightedPaperId(null);
        clearMultiHighlightedPapers();
      }}
    />
  );

  const renderProjectWorkspaceSearch = () => {
    if (declarationBlocked || activeWorkspace !== "files") {
      return null;
    }

    return (
      <WorkbenchProjectSearch
        copy={workbenchCopy}
        workflow={workflowNodes}
        fileActionCopy={{
          preview: workbenchCopy.projectFileIndex.actionMenu.preview,
          openMaster: workbenchCopy.projectFileIndex.actionMenu.openMaster,
          download: workbenchCopy.filePreview.download,
        }}
        setSelectedNodeId={(nodeId) => {
          navigateWorkspace("files");
          setAddNodeTarget(null);
          setDirectorySelectionCleared(false);
          clearMultiHighlightedPapers();
          setSelectedPaperId(null);
          setHighlightedPaperId(null);
          setSelectedNodeId(nodeId);
        }}
        onLocatePaper={(paperId, _nodeId, highlightId) => {
          locatePaperInWorkbench(paperId, {
            expandDirectory: true,
            highlightId,
          });
        }}
        onFileAction={(action, file) => {
          const { attachmentId } = file;
          if (!attachmentId) {
            return;
          }
          if (action === "PREVIEW_NEW_WINDOW") {
            const target = resolveFilePreviewTarget(
              workflowPapers,
              projectAttachments.data ?? [],
              attachmentId
            );
            if (target) {
              openAttachmentPreviewInNewWindow(projectId, target.attachment);
            }
            return;
          }
          if (action === "PREVIEW") {
            setHighlightedPaperId(null);
            clearMultiHighlightedPapers();
            previewFile(attachmentId);
            return;
          }
          if (
            !locatePaperInWorkbench(file.paperId, {
              highlightId: attachmentId,
            })
          ) {
            return;
          }
          setFileActionRequest((current) => ({
            requestId: (current?.requestId ?? 0) + 1,
            attachmentId,
            action,
          }));
        }}
        className="w-full"
      />
    );
  };

  const renderProjectWorkItemsSidebar = () => (
    <ProjectWingProjectWorkItemSidebar
      personalItems={projectPersonalWorkItems}
      teamItems={teamWorkItems.data?.items ?? []}
      teamCategories={teamWorkItems.data?.categories ?? []}
      locale={locale}
      personalError={personalWorkItems.isError}
      personalLoading={personalWorkItems.isLoading}
      teamError={teamWorkItems.isError}
      teamLoading={teamWorkItems.isLoading}
      onRetry={() => {
        teamWorkItems.refetch();
        personalWorkItems.refetch();
      }}
      onClose={() => setProjectWorkItemsOpen(false)}
      onOpen={(item) =>
        openTeamWorkItem(
          item,
          collectProjectReviewQuestionItems(
            workflowNodes,
            projectAttachments.data ?? []
          )
        )
      }
    />
  );

  const workspaceControlActionItems = declarationBlocked
    ? undefined
    : [
        {
          id: "engagement",
          label: dictionary.common.engagement ?? "Engagement",
          icon: <PanelsTopLeft />,
          active: activeWorkspace === "files" && !projectWorkItemsOpen,
          onClick: () => {
            setActivityPanelOpen(false);
            navigateWorkspace("files");
          },
        },
        {
          id: "confirmations",
          label: confirmationsButtonLabel,
          icon: <Truck />,
          active: activeWorkspace === "confirmations" && !projectWorkItemsOpen,
          onClick: () => {
            setActivityPanelOpen(false);
            navigateWorkspace("confirmations");
          },
        },
        {
          id: "project-work-items",
          label: dictionary.workItems.projectTitle,
          icon: (
            <span className="relative inline-flex">
              <ClipboardList aria-hidden="true" />
              {projectWorkItemCount ? (
                <span className="absolute -top-1 -right-1 inline-flex">
                  <span
                    aria-hidden="true"
                    className="inline-block size-1.5 shrink-0 rounded-full bg-red-500"
                  />
                </span>
              ) : null}
            </span>
          ),
          active: projectWorkItemsOpen,
          onClick: () => {
            const nextOpen = !projectWorkItemsOpen;
            setActivityPanelOpen(false);
            if (nextOpen && activeWorkspace === "files") {
              hidePreviewPanel();
            }
            setProjectWorkItemsOpen(nextOpen);
            if (nextOpen) {
              teamWorkItems.refetch();
              personalWorkItems.refetch();
            }
          },
        },
      ];
  const mobileWorkspaceControlActionItems = declarationBlocked
    ? undefined
    : [
        {
          id: "engagement",
          label: dictionary.common.engagement ?? "Engagement",
          icon: <PanelsTopLeft />,
          active: activeWorkspace === "files" && !projectWorkItemsOpen,
          onClick: () => {
            setActivityPanelOpen(false);
            navigateWorkspace("files");
          },
        },
        {
          id: "confirmations",
          label: confirmationsButtonLabel,
          icon: <Truck />,
          active: activeWorkspace === "confirmations" && !projectWorkItemsOpen,
          onClick: () => {
            setActivityPanelOpen(false);
            navigateWorkspace("confirmations");
          },
        },
        {
          id: "project-work-items",
          label: dictionary.workItems.projectTitle,
          icon: (
            <span className="relative inline-flex">
              <ClipboardList aria-hidden="true" />
              {projectWorkItemCount ? (
                <span className="absolute -top-1 -right-1 inline-flex">
                  <span
                    aria-hidden="true"
                    className="inline-block size-1.5 shrink-0 rounded-full bg-red-500"
                  />
                </span>
              ) : null}
            </span>
          ),
          active: projectWorkItemsOpen,
          onClick: () => {
            const nextOpen = !projectWorkItemsOpen;
            setActivityPanelOpen(false);
            if (nextOpen && activeWorkspace === "files") {
              hidePreviewPanel();
            }
            setProjectWorkItemsOpen(nextOpen);
            if (nextOpen) {
              teamWorkItems.refetch();
              personalWorkItems.refetch();
            }
          },
        },
        ...(canAccessSystemAdmin
          ? [
              {
                id: "project-templates",
                label: dictionary.desktop?.apps?.templates ?? "Templates",
                icon: <BookOpenCheck />,
                onClick: () =>
                  router.push(localizedPath("/engagement?templateLibrary=1")),
              },
              {
                id: "smart-forms",
                label: dictionary.desktop?.apps?.smartForms ?? "Smart Forms",
                icon: <ClipboardList />,
                onClick: () =>
                  router.push(localizedPath("/engagement?smartForms=1")),
              },
              {
                id: "user-management",
                label: dictionary.common.userManagement ?? "User management",
                icon: <UserCog />,
                onClick: () => router.push(localizedPath("/admin/users")),
              },
            ]
          : []),
      ];

  if (isDetachedPreviewWindow) {
    return (
      <main className="h-dvh min-h-0 bg-workbench-sidebar" data-preview-window>
        <WorkbenchFilePreviewPane
          projectId={projectId}
          attachment={previewedAttachment}
          copy={dictionary.workbench}
        />
      </main>
    );
  }

  return (
    <div ref={workspaceSurfaceRef} className={PROJECT_PAGE_SHELL_CLASS}>
      <ProjectPageHeader
        project={loadedProject}
        mobileTitle={
          activeWorkspace === "files"
            ? compactPane === "preview" && previewedAttachment
              ? (previewedAttachment.originalName ??
                previewedAttachment.fileName)
              : compactPane === "files" && selectedNode
                ? selectedNode.title
                : (resolveMobileDirectory(workflowNodes, mobileDirectoryTrail)
                    .current?.title ?? loadedProject.name)
            : loadedProject.name
        }
        onMobileBack={() => {
          if (activeWorkspace !== "files") {
            if (projectReturnHref?.startsWith("/confirmations")) {
              router.push(localizedPath(projectReturnHref));
            } else {
              setActiveWorkspace("files");
            }
          } else if (
            compactPane === "preview" ||
            compactPane === "notes" ||
            compactPane === "tasks"
          ) {
            setCompactPane("files");
          } else if (compactPane === "files") {
            setCompactPane("directory");
          } else if (mobileDirectoryTrail.length) {
            setMobileDirectoryTrail((trail) => trail.slice(0, -1));
          } else {
            router.push(localizedPath(projectReturnHref ?? "/engagement"));
          }
        }}
        backHref={
          activeWorkspace === "confirmations"
            ? projectReturnHref?.startsWith("/confirmations")
              ? projectReturnHref
              : "/confirmations"
            : projectReturnHref
        }
        backLabel={
          activeWorkspace === "confirmations" ||
          projectReturnHref?.split(/[?#]/)[0] === "/confirmations"
            ? dictionary.confirmationCenter.intranet.title
            : undefined
        }
        projectSwitcherProjects={desktop.data?.placements.map(
          (placement) => placement.project
        )}
        projectSwitcherProjectHref={(nextProjectId) =>
          workspaceId
            ? `/workspaces/${workspaceId}/projects/${nextProjectId}`
            : `/engagement/${nextProjectId}${
                projectReturnHref
                  ? `?returnTo=${encodeURIComponent(projectReturnHref)}`
                  : ""
              }`
        }
        className={
          activeWorkspace === "confirmations"
            ? "!bg-card backdrop-blur-none supports-[backdrop-filter]:!bg-card"
            : undefined
        }
        settingsOpen={settingsOpen}
        onOtherAction={() => setProjectWorkItemsOpen(false)}
        onSettingsOpenChange={(open) => {
          setSettingsOpen(open);
          if (!open) {
            setSettingsInitialSection("general");
          }
        }}
        centerSlot={
          isPhone && !mobileSearchOpen
            ? undefined
            : renderProjectWorkspaceSearch()
        }
        mobileSearchContent={renderProjectWorkspaceSearch()}
        responsiveProjectWorkspace={!isPhone}
        settingsActions={settingsActions}
        inboxAction={false}
        controlActionItems={workspaceControlActionItems}
        mobileControlActionItems={
          isPhone && !declarationBlocked
            ? [
                {
                  id: "mobile-directory-management",
                  label: mobileCopy.manageDirectory,
                  icon: <PanelsTopLeft />,
                  onClick: () => {
                    setCompactPane("directory");
                    setMobileDirectoryManagementOpen(true);
                  },
                },
                {
                  id: "mobile-search",
                  label: mobileCopy.search,
                  icon: <Search />,
                  onClick: () => setMobileSearchOpen((open) => !open),
                },
              ]
            : mobileWorkspaceControlActionItems
        }
      />
      {canReviewFinalArchive ? (
        <div className="border-b border-sky-200 bg-sky-50/90 px-4 py-3 text-sky-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold">
                {loadedProject.projectCode}{" "}
                {projectCopy.pendingFinalCheckStatus ?? "Pending final check"}
              </div>
              <div className="mt-1 text-sm text-sky-800">
                {projectCopy.adminReviewBanner}
              </div>
            </div>
            <ButtonGroup>
              <Button
                type="button"
                variant="outline"
                disabled={
                  reopenProject.isPending || confirmProjectArchive.isPending
                }
                onClick={() => setReopenDialogOpen(true)}
              >
                {projectCopy.reopenProject}
              </Button>
              <Button
                type="button"
                disabled={
                  reopenProject.isPending || confirmProjectArchive.isPending
                }
                onClick={() => {
                  setSettingsInitialSection("archive");
                  setSettingsOpen(true);
                  setArchiveReviewRequestKey((current) => current + 1);
                }}
              >
                {confirmProjectArchive.isPending
                  ? dictionary.workbench.settingsPanel.project.archivingProject
                  : (projectCopy.finalArchiveReview ??
                    projectCopy.confirmArchive)}
              </Button>
            </ButtonGroup>
          </div>
        </div>
      ) : null}
      <AnimatePresence>
        {!declaration.isLoading &&
        !declaration.isError &&
        declarationBlocked ? (
          <ProjectDeclarationGate
            copy={workbenchCopy}
            project={loadedProject}
            isPending={acceptDeclaration.isPending}
            onAccept={() => acceptDeclaration.mutate()}
          />
        ) : null}
      </AnimatePresence>
      {declaration.isLoading ? (
        <WorkbenchRouteStatus tone="muted">
          {workbenchCopy.checkingDeclaration}
        </WorkbenchRouteStatus>
      ) : declaration.isError ? (
        <WorkbenchRouteStatus tone="destructive">
          {workbenchCopy.checkingDeclaration}
        </WorkbenchRouteStatus>
      ) : declarationBlocked ? null : activeWorkspace === "files" ? (
        <>
          {compactWorkbench && !isPhone ? (
            <div
              className="shrink-0 px-3 pb-2 max-[767.5px]:px-2 max-[767.5px]:pb-1"
              data-testid="compact-workbench-navigation"
            >
              <p
                className="mb-1.5 truncate text-sm font-medium max-[767.5px]:hidden"
                title={loadedProject.name}
              >
                {loadedProject.name}
              </p>
              <ViewSwitcher
                label={workbenchCopy.compactLayout.label}
                value={compactPane}
                onValueChange={(value) =>
                  setCompactPane(value as WorkbenchPane)
                }
                options={[
                  {
                    value: "files",
                    label: workbenchCopy.compactLayout.files,
                  },
                  {
                    value: "directory",
                    label: workbenchCopy.compactLayout.directory,
                  },
                  {
                    value: "preview",
                    label: workbenchCopy.compactLayout.preview,
                  },
                  ...(isSmartFormOpen
                    ? []
                    : [
                        {
                          value: "notes",
                          label: workbenchCopy.compactLayout.reviewNotes,
                        },
                      ]),
                  ...(projectWorkItemsOpen
                    ? [
                        {
                          value: "tasks",
                          label: dictionary.workItems.projectTitle,
                        },
                      ]
                    : []),
                ]}
              />
            </div>
          ) : null}
          <DndContext
            collisionDetection={fileCollisionDetection}
            sensors={fileSensors}
            onDragStart={beginPreviewFileDrag}
            onDragCancel={clearPreviewFileDrag}
            onDragEnd={(event) => {
              previewDroppedFile(event);
              moveDroppedFileToDirectory(event);
              clearPreviewFileDrag();
            }}
          >
            <ResizablePanelGroup
              orientation="vertical"
              groupRef={reviewNotesPanelGroupRef}
              elementRef={reviewNotesPanelGroupElementRef}
              data-data-grid-layout-root=""
              className={`${PROJECT_OVERVIEW_GRID_CLASS} animate-fade-in`}
            >
              <ResizablePanel
                id="project-files-workspace"
                inert={compactWorkbench && compactPane === "notes"}
                defaultSize="100%"
                minSize={compactWorkbench ? 0 : "16rem"}
                collapsible={compactWorkbench}
                className="min-h-0"
              >
                <ResizablePanelGroup
                  orientation="horizontal"
                  groupRef={workspacePanelGroupRef}
                  elementRef={workspacePanelGroupElementRef}
                  data-data-grid-layout-root=""
                  className="relative h-full min-h-0 w-full"
                >
                  {archiveCheckNavigator ? (
                    <div
                      ref={archiveCheckNavigatorElementRef}
                      data-archive-check-navigator=""
                      className={`pointer-events-none absolute top-4 z-[50] max-w-[calc(100%-2rem)] ${
                        archiveCheckNavigatorPosition ? "right-auto" : "right-4"
                      }`}
                    >
                      <div className="pointer-events-auto">
                        <ArchiveCheckNavigator
                          snapshot={archiveCheckNavigator}
                          minimized={archiveCheckNavigatorMinimized}
                          onMinimizedChange={setArchiveCheckNavigatorMinimized}
                          onClose={() => {
                            setArchiveCheckNavigator(null);
                            setArchiveCheckNavigatorPosition(null);
                          }}
                          onSelectIssue={(activeIssueKey) =>
                            setArchiveCheckNavigator((current) =>
                              current ? { ...current, activeIssueKey } : current
                            )
                          }
                          onLocateWorkingPaper={navigateToArchiveCheckIssue}
                          onDragPointerDown={
                            handleArchiveCheckNavigatorDragStart
                          }
                        />
                      </div>
                    </div>
                  ) : null}
                  {isActivityPanelMounted ? (
                    <aside
                      aria-label={dictionary.inbox.title}
                      aria-hidden={!isActivityPanelVisible}
                      inert={!isActivityPanelVisible}
                      data-panel-state={
                        isActivityPanelVisible ? "open" : "closed"
                      }
                      className="emp-panel-motion absolute inset-y-0 right-0 z-[60] w-[min(32rem,calc(100%-2rem))] overflow-hidden border-l border-border bg-workbench-sidebar shadow-2xl shadow-foreground/20"
                    >
                      <WorkbenchActivityPanel
                        workflow={workflowNodes}
                        attachments={projectAttachments.data ?? []}
                        projectId={loadedProject.id}
                        reviewQuestionsCopy={
                          dictionary.projects.reviewQuestions
                        }
                        inboxCopy={dictionary.inbox}
                        locale={locale}
                        showMessages={canViewNotifications}
                        messages={inbox.data ?? []}
                        messagesLoading={inbox.isLoading}
                        readStatePending={
                          markInboxRead.isPending || markInboxUnread.isPending
                        }
                        onOpenQuestion={(item) => {
                          setActivityPanelOpen(false);
                          locateProjectReviewQuestion(item);
                        }}
                        onOpenMessage={(message) => {
                          setActivityPanelOpen(false);
                          openProjectInboxMessage(message);
                        }}
                        onToggleMessageRead={toggleProjectMessageReadState}
                        onClose={() => setActivityPanelOpen(false)}
                        className="bg-workbench-sidebar"
                      />
                    </aside>
                  ) : null}
                  <ResizablePanel
                    id="project-directory"
                    inert={compactWorkbench && compactPane !== "directory"}
                    defaultSize={DEFAULT_DIRECTORY_PANEL_SIZE}
                    minSize={
                      compactWorkbench
                        ? 0
                        : `${MINIMUM_DIRECTORY_PANEL_PIXELS}px`
                    }
                    collapsedSize="0rem"
                    collapsible
                    groupResizeBehavior="preserve-pixel-size"
                    panelRef={directoryPanelRef}
                    onResize={syncDirectoryPanelSize}
                    aria-hidden={isDirectoryPanelCollapsed || undefined}
                    data-collapsed={isDirectoryPanelCollapsed}
                  >
                    <div
                      className={`${DIRECTORY_TREE_CLASS} h-full w-full ${
                        isDirectoryPanelCollapsed
                          ? "pointer-events-none invisible border-0"
                          : ""
                      }`}
                    >
                      {isPhone ? (
                        <EmpMobileDirectory
                          key={projectId}
                          nodes={workflowNodes}
                          loading={workflow.isLoading}
                          locale={locale}
                          management={renderWorkbenchDirectory()}
                          trail={mobileDirectoryTrail}
                          onTrailChange={setMobileDirectoryTrail}
                          managementOpen={mobileDirectoryManagementOpen}
                          onManagementOpenChange={
                            setMobileDirectoryManagementOpen
                          }
                          onOpen={(id) => {
                            selectWorkbenchNode(id);
                            setCompactPane("files");
                          }}
                        />
                      ) : (
                        renderWorkbenchDirectory()
                      )}
                    </div>
                  </ResizablePanel>
                  <SplitterRail
                    className={
                      compactWorkbench
                        ? "hidden"
                        : isDirectoryPanelCollapsed
                          ? "-translate-x-1/2"
                          : "mx-1.5"
                    }
                    expanded={!isDirectoryPanelCollapsed}
                    label={workbenchCopy.directoryResizeLabel}
                    min={MINIMUM_DIRECTORY_PANEL_PIXELS}
                    value={directoryPanelWidth}
                    onDragStart={() => {
                      const directoryWidth = directoryPanelCollapsedRef.current
                        ? 0
                        : (directoryPanelRef.current?.getSize().inPixels ??
                          directoryPanelWidthRef.current);
                      directoryResizeStartRef.current = directoryWidth;
                      beginWorkbenchPanelResize();
                    }}
                    onDrag={resizeDirectoryPanel}
                    onDragCancel={() => {
                      cancelDirectoryPanelResize();
                      const width = directoryResizeStartRef.current;
                      if (width <= 0) {
                        directoryPanelRef.current?.collapse();
                        setDirectoryPanelCollapsed(true);
                        finishWorkbenchPanelResize();
                        return;
                      }
                      directoryPanelRef.current?.expand();
                      directoryPanelRef.current?.resize(width);
                      directoryPanelWidthRef.current = width;
                      setDirectoryPanelCollapsed(false);
                      finishWorkbenchPanelResize();
                    }}
                    onDragEnd={() => {
                      commitDirectoryPanelResize();
                      setDirectoryPanelWidth(directoryPanelWidthRef.current);
                    }}
                    onToggle={toggleDirectoryPanel}
                    data-testid="directory-resize-rail"
                  />
                  <ResizablePanel
                    id="project-review"
                    inert={compactWorkbench && compactPane !== "files"}
                    collapsible={compactWorkbench}
                    aria-hidden={
                      (compactWorkbench && compactPane !== "files") || undefined
                    }
                    minSize="0rem"
                    className={`${REVIEW_CONTENT_CLASS} relative`}
                  >
                    <div className="flex h-full min-h-0 flex-col">
                      <div className="min-h-0 flex-1">
                        <WorkbenchContent
                          copy={{
                            ...dictionary.workbench,
                            projectFileIndex: {
                              ...dictionary.workbench.projectFileIndex,
                              mobileNavigation: mobileCopy,
                            },
                            smartFormV2Editor: dictionary.smartFormV2Editor,
                          }}
                          projectId={projectId}
                          projectName={loadedProject.name}
                          projectLanguage={projectTemplateLanguage}
                          currentUserId={me.data?.id ?? null}
                          currentProjectRole={
                            currentMember?.projectRole ?? null
                          }
                          selectedNode={selectedNode}
                          selectedPath={selectedBreadcrumbPath}
                          onSelectPathNode={selectWorkbenchNode}
                          selectedPathScrollRef={selectedPathScrollRef}
                          workflow={workflowNodes}
                          activeBucket={activeBucket}
                          onActiveBucketChange={(bucket) =>
                            setActiveBucket(
                              bucket === "TEMPORARY" && !canViewTemporaryFiles
                                ? "CURRENT"
                                : bucket
                            )
                          }
                          canDeleteSelected={
                            canModifyIndex && canDeleteSelected
                          }
                          deleteSelected={async () => {
                            if (!canModifyIndex) {
                              return;
                            }
                            if (!selectedNode) {
                              return;
                            }
                            await confirmDeleteNode(selectedNode);
                          }}
                          deletePending={deleteNode.isPending}
                          paperForm={paperForm}
                          createPaper={(values) => {
                            if (canModifyIndex) {
                              createPaper.mutate(values);
                            }
                          }}
                          createPaperPending={createPaper.isPending}
                          selectedPaperId={selectedPaperId}
                          highlightedPaperId={highlightedPaperId}
                          highlightedPaperIds={highlightedPaperIds}
                          clearHighlightedPaper={() => {
                            if (
                              directoryFilePasteTargetRef.current ===
                              selectedNodeId
                            ) {
                              return;
                            }
                            setHighlightedPaperId(null);
                            clearMultiHighlightedPapers();
                          }}
                          setSelectedPaperId={(paperId) => {
                            setHighlightedPaperId(null);
                            clearMultiHighlightedPapers();
                            setSelectedPaperId(paperId);
                          }}
                          onPreviewFile={(attachmentId) => {
                            setHighlightedPaperId(null);
                            clearMultiHighlightedPapers();
                            previewFile(attachmentId);
                          }}
                          onExportAttachments={(attachmentIds) =>
                            startFileExport(
                              { scope: "ATTACHMENTS", attachmentIds },
                              workbenchCopy.fileExport.selectedStarted
                            )
                          }
                          fileActionRequest={fileActionRequest}
                          uploadFileToWorkingPaper={
                            selectedNode && canUploadWorkingPapers
                              ? (paperId, file) => {
                                  const paper =
                                    selectedNode.workingPapers?.find(
                                      (item) => item.id === paperId
                                    );
                                  if (!paper) {
                                    return;
                                  }
                                  if (hasActiveAttachments(paper)) {
                                    toast({
                                      title:
                                        workbenchCopy.emptySlotUpload
                                          .alreadyHasFileTitle,
                                      description:
                                        workbenchCopy.emptySlotUpload
                                          .alreadyHasFileDescription,
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  uploadFileToWorkingPaper.mutate({
                                    node: selectedNode,
                                    paper,
                                    file,
                                  });
                                }
                              : undefined
                          }
                          uploadFilesToNode={
                            selectedNode && canUploadFilesToNode
                              ? async (files, bucket) => {
                                  await Promise.resolve();
                                  const targetNode = selectedNode;
                                  if (targetNode.level === 1) {
                                    return uploadFolderFilesToNode(
                                      targetNode,
                                      files,
                                      bucket
                                    );
                                  }

                                  return requestReferenceCodeUpload(
                                    targetNode,
                                    files,
                                    bucket
                                  );
                                }
                              : undefined
                          }
                          createPlaceholderToNode={
                            selectedNode && canUploadFilesToNode
                              ? (code, name, bucket) =>
                                  createPlaceholderToNode
                                    .mutateAsync({
                                      node: selectedNode,
                                      code,
                                      name,
                                      bucket,
                                    })
                                    .then((result) => result.attachment)
                              : undefined
                          }
                          onCreateSmartForm={
                            canUseLibrary
                              ? () => setSmartFormLibraryOpen(true)
                              : undefined
                          }
                          onCreateFromTemplate={
                            canUseLibrary
                              ? () => setTemplateLibraryOpen(true)
                              : undefined
                          }
                          placeholderDefaultCode={
                            selectedNode
                              ? buildFilePaperCode(
                                  selectedNode,
                                  activeBucket,
                                  workflow.data ?? []
                                )
                              : ""
                          }
                          uploadFilePending={
                            uploadFileToNode.isPending ||
                            uploadFileToWorkingPaper.isPending ||
                            folderUploadPending ||
                            createPlaceholderToNode.isPending
                          }
                          onSetAttachmentClipboard={
                            canModifyIndex
                              ? setDirectoryFileClipboard
                              : undefined
                          }
                          attachmentClipboard={directoryFileClipboard}
                          onPasteAttachmentClipboard={
                            canModifyIndex
                              ? pasteDirectoryFileClipboard
                              : undefined
                          }
                          onMoveAttachmentsToNode={
                            canModifyIndex
                              ? (files, targetNode) =>
                                  pasteDirectoryFiles(files, "move", targetNode)
                              : undefined
                          }
                          readOnly={isReadOnlyProject}
                          showTemporaryFiles={canViewTemporaryFiles}
                          disableFileMutations={!canModifyIndex}
                          forceReadOnlyOpen={!canUploadWorkingPapers}
                          canSignPreparer={canSignPreparer}
                          onSmartFormOpenChange={handleSmartFormOpenChange}
                        />
                      </div>
                    </div>
                  </ResizablePanel>
                  {projectWorkItemsOpen || compactWorkbench ? null : (
                    <SplitterRail
                      className={
                        isPreviewPanelCollapsed ? "translate-x-1/2" : "mx-1.5"
                      }
                      expanded={!isPreviewPanelCollapsed}
                      label={
                        workbenchCopy.filePreview?.resizeLabel ??
                        "Resize file preview panel"
                      }
                      min={MINIMUM_CONTEXT_PANEL_PIXELS}
                      value={previewPanelWidth}
                      onDragStart={() => {
                        const previewWidth = previewPanelCollapsedRef.current
                          ? 0
                          : (previewPanelRef.current?.getSize().inPixels ??
                            previewPanelWidthRef.current);
                        previewResizeStartRef.current = previewWidth;
                        beginWorkbenchPanelResize();
                      }}
                      onDrag={resizePreviewPanel}
                      onDragCancel={() => {
                        cancelPreviewPanelResize();
                        const width = previewResizeStartRef.current;
                        if (width <= 0) {
                          previewPanelRef.current?.collapse();
                          setPreviewPanelCollapsed(true);
                          finishWorkbenchPanelResize();
                          return;
                        }
                        setProjectWorkItemsOpen(false);
                        previewPanelRef.current?.expand();
                        previewPanelRef.current?.resize(width);
                        previewPanelWidthRef.current = width;
                        setPreviewPanelCollapsed(false);
                        finishWorkbenchPanelResize();
                      }}
                      onDragEnd={() => {
                        commitPreviewPanelResize();
                        setPreviewPanelWidth(previewPanelWidthRef.current);
                      }}
                      onToggle={togglePreviewPanel}
                      data-testid="preview-resize-rail"
                    />
                  )}
                  <ResizablePanel
                    id="project-file-preview"
                    inert={compactWorkbench && compactPane !== "preview"}
                    defaultSize="0rem"
                    minSize={compactWorkbench ? 0 : MINIMUM_CONTEXT_PANEL_SIZE}
                    collapsedSize={CONTEXT_PANEL_COLLAPSED_SIZE}
                    collapsible
                    groupResizeBehavior="preserve-pixel-size"
                    panelRef={previewPanelRef}
                    onResize={syncPreviewPanelSize}
                    aria-hidden={isPreviewPanelCollapsed || undefined}
                    data-collapsed={isPreviewPanelCollapsed}
                  >
                    <div
                      className={`${FILE_PREVIEW_PANE_CLASS} relative h-full min-h-0 w-full ${
                        isPreviewPanelCollapsed
                          ? "pointer-events-none invisible border-0"
                          : ""
                      }`}
                    >
                      <WorkbenchFilePreviewPane
                        projectId={projectId}
                        onClose={hidePreviewPanel}
                        closeLabel={
                          locale === "zh-CN" ? "关闭预览" : "Close preview"
                        }
                        attachment={previewedAttachment}
                        copy={dictionary.workbench}
                        isPreviewExpanded={isPreviewExpanded}
                        onTogglePreviewExpanded={
                          compactWorkbench ? undefined : togglePreviewExpanded
                        }
                        onUploadFile={
                          canUploadWorkingPapers && previewTarget?.paper
                            ? uploadPreviewFile
                            : undefined
                        }
                      />
                    </div>
                  </ResizablePanel>
                  {projectWorkItemsOpen ? (
                    <ResizableHandle
                      withHandle
                      className={compactWorkbench ? "hidden" : "w-3"}
                      label={dictionary.workItems.resizeProject}
                    />
                  ) : null}
                  <ResizablePanel
                    id="project-team-work-items"
                    panelRef={projectWorkItemsPanelRef}
                    inert={
                      !projectWorkItemsOpen ||
                      (compactWorkbench && compactPane !== "tasks")
                    }
                    defaultSize="0rem"
                    minSize={compactWorkbench ? 0 : "27rem"}
                    maxSize={compactWorkbench ? "100%" : "42rem"}
                    collapsible
                    collapsedSize="0rem"
                    data-collapsed={!projectWorkItemsOpen}
                    aria-hidden={
                      !projectWorkItemsOpen ||
                      (compactWorkbench && compactPane !== "tasks") ||
                      undefined
                    }
                    className="min-h-0 rounded-[12px] shadow-sm shadow-foreground/5"
                  >
                    <div
                      className={`h-full min-h-0 w-full overflow-hidden ${compactWorkbench ? "" : "min-w-[27rem]"}`}
                    >
                      {renderProjectWorkItemsSidebar()}
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>
              {isSmartFormOpen || compactWorkbench ? null : (
                <SplitterRail
                  orientation="horizontal"
                  expanded={!isReviewNotesPanelCollapsed}
                  label={reviewNotesBottomPanelCopy.resizeLabel}
                  min={MINIMUM_REVIEW_NOTES_PANEL_PIXELS}
                  value={reviewNotesPanelHeight}
                  onDragStart={() => {
                    reviewNotesResizeStartedCollapsedRef.current =
                      reviewNotesPanelCollapsedRef.current;
                    reviewNotesResizeStartRef.current =
                      reviewNotesPanelCollapsedRef.current
                        ? MINIMUM_REVIEW_NOTES_PANEL_PIXELS
                        : (reviewNotesPanelRef.current?.getSize().inPixels ??
                          reviewNotesPanelHeightRef.current);
                    beginWorkbenchPanelResize();
                  }}
                  onDrag={resizeReviewNotesPanel}
                  onDragCancel={() => {
                    cancelReviewNotesPanelResize();
                    if (reviewNotesResizeStartedCollapsedRef.current) {
                      reviewNotesPanelRef.current?.collapse();
                      setReviewNotesPanelCollapsed(true);
                      finishWorkbenchPanelResize();
                      return;
                    }
                    const height = reviewNotesResizeStartRef.current;
                    if (height <= 0) {
                      reviewNotesPanelRef.current?.collapse();
                      setReviewNotesPanelCollapsed(true);
                      finishWorkbenchPanelResize();
                      return;
                    }
                    reviewNotesPanelRef.current?.expand();
                    reviewNotesPanelRef.current?.resize(height);
                    reviewNotesPanelHeightRef.current = height;
                    setReviewNotesPanelCollapsed(false);
                    finishWorkbenchPanelResize();
                  }}
                  onDragEnd={commitReviewNotesPanelResize}
                  onToggle={toggleReviewNotesPanel}
                  data-testid="review-notes-resize-rail"
                />
              )}
              <ResizablePanel
                id="project-file-review-notes"
                inert={
                  isReviewNotesPanelCollapsed ||
                  (compactWorkbench && compactPane !== "notes")
                }
                defaultSize="0rem"
                minSize={
                  compactWorkbench
                    ? 0
                    : `${MINIMUM_REVIEW_NOTES_PANEL_PIXELS}px`
                }
                collapsedSize={REVIEW_NOTES_PANEL_COLLAPSED_SIZE}
                collapsible
                groupResizeBehavior="preserve-pixel-size"
                panelRef={reviewNotesPanelRef}
                onResize={syncReviewNotesPanelSize}
                aria-hidden={isReviewNotesPanelCollapsed || undefined}
                data-collapsed={isReviewNotesPanelCollapsed}
                className="min-h-0"
              >
                {!reviewNotesMounted && isReviewNotesPanelCollapsed ? null : (
                  <div className="h-full min-h-0 overflow-hidden rounded-lg border border-border bg-workbench-panel">
                    <WorkbenchReviewNotesPanel
                      key={projectId}
                      projectId={projectId}
                      target={null}
                      unavailableTarget={null}
                      currentUserId={me.data?.id ?? null}
                      currentProjectRole={currentMember?.projectRole ?? null}
                      workflow={workflowNodes}
                      attachments={projectAttachments.data ?? []}
                      locale={locale}
                      readOnly={isReadOnlyProject}
                      copy={reviewNotesBottomPanelCopy}
                      reviewQuestionsCopy={dictionary.workbench.reviewQuestions}
                      onChanged={async () => {
                        await Promise.all([
                          refreshWorkflow(),
                          projectAttachments.refetch(),
                        ]);
                      }}
                      onLocateQuestion={locateProjectReviewQuestion}
                    />
                  </div>
                )}
              </ResizablePanel>
            </ResizablePanelGroup>
            <WorkbenchCompactController
              compact={compactWorkbench}
              pane={compactPane}
              tasksOpen={projectWorkItemsOpen}
              horizontal={workspacePanelGroupRef}
              vertical={reviewNotesPanelGroupRef}
              element={reviewNotesPanelGroupElementRef}
              onRestore={(layout) => {
                if (!layout) {
                  compactLayoutGuard.current = false;
                  return;
                }
                if (projectWorkItemsOpen) {
                  projectWorkItemsPanelRef.current?.resize("34rem");
                } else {
                  collapseProjectWorkItemsPanel();
                }
                if (layout.horizontal["project-directory"] > 0) {
                  directoryPanelRef.current?.resize(
                    directoryPanelWidthRef.current
                  );
                }
                if (layout.horizontal["project-file-preview"] > 0) {
                  previewPanelRef.current?.resize(previewPanelWidthRef.current);
                }
                if (layout.vertical["project-file-review-notes"] > 0) {
                  reviewNotesPanelRef.current?.resize(
                    reviewNotesPanelHeightRef.current
                  );
                }
                requestAnimationFrame(() => {
                  compactLayoutGuard.current = false;
                });
              }}
            />
            <DragOverlay
              dropAnimation={null}
              modifiers={[offsetDragOverlayFromPointer]}
            >
              {previewDragFileName ? (
                <Badge
                  variant="outline"
                  data-testid="workbench-file-drag-overlay"
                  className="h-8 max-w-72 gap-1.5 rounded-md bg-popover px-2.5 text-sm text-popover-foreground shadow-md"
                >
                  <ProjectFileTypeIcon
                    fileName={previewDragFileName}
                    data-icon="inline-start"
                  />
                  <span className="truncate">{previewDragFileName}</span>
                </Badge>
              ) : null}
            </DragOverlay>
          </DndContext>
          {canUseLibrary ? (
            <>
              <WorkbenchTemplateLibraryDialog
                open={templateLibraryOpen}
                onOpenChange={setTemplateLibraryOpen}
                mode="project-template"
                projectId={projectId}
                projectLanguage={projectTemplateLanguage}
                projectFrameworkTemplateId={
                  loadedProject.frameworkTemplateId ?? null
                }
                workflow={workflowNodes}
                initialTargetNodeId={selectedNode ? selectedNode.id : ""}
                initialBucket={activeBucket}
                copy={{
                  ...workbenchCopy.templateLibrary,
                  label: createFromTemplateLabel,
                  dialogTitle: createFromTemplateLabel,
                }}
                bucketLabels={workbenchCopy.bucketLabels}
                templateFileDetailHref={(templateId, fileId) =>
                  localizedPath(
                    `/templates/project/${templateId}/files/${fileId}?returnTo=${encodeURIComponent(
                      localizedPath(
                        `/engagement/${projectId}?templateLibrary=1`
                      )
                    )}`
                  )
                }
                onApplied={({ targetNodeId, bucket }) => {
                  setAddNodeTarget(null);
                  setSelectedNodeId(targetNodeId);
                  setSelectedPaperId(null);
                  setHighlightedPaperId(null);
                  clearMultiHighlightedPapers();
                  setActiveBucket(bucket);
                }}
              />
              <WorkbenchTemplateLibraryDialog
                open={smartFormLibraryOpen}
                onOpenChange={setSmartFormLibraryOpen}
                mode="smart-form"
                projectId={projectId}
                projectLanguage={projectTemplateLanguage}
                projectFrameworkTemplateId={
                  loadedProject.frameworkTemplateId ?? null
                }
                workflow={workflowNodes}
                initialTargetNodeId={selectedNode ? selectedNode.id : ""}
                initialBucket={activeBucket}
                copy={{
                  ...workbenchCopy.templateLibrary,
                  label: createSmartFormLabel,
                  dialogTitle: createSmartFormLabel,
                }}
                bucketLabels={workbenchCopy.bucketLabels}
                onApplied={({ targetNodeId }) => {
                  setAddNodeTarget(null);
                  setSelectedNodeId(targetNodeId);
                  setSelectedPaperId(null);
                  setHighlightedPaperId(null);
                  clearMultiHighlightedPapers();
                  setActiveBucket("CURRENT");
                }}
              />
            </>
          ) : null}
          <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {projectCopy.reopenProjectDialogTitle}
                </DialogTitle>
                <DialogDescription>
                  {projectCopy.reopenProjectDialogDescription}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">
                  {projectCopy.reopenReason}
                </label>
                <Textarea
                  className="min-h-24"
                  placeholder={projectCopy.reopenReasonPlaceholder}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                />
              </div>
              <DialogFooter>
                <ButtonGroup>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setReopenDialogOpen(false);
                      setReopenReason("");
                    }}
                  >
                    {dictionary.common.cancel}
                  </Button>
                  <Button
                    type="button"
                    disabled={reopenProject.isPending}
                    onClick={() => {
                      reopenProject.mutate();
                      setReopenDialogOpen(false);
                      setReopenReason("");
                    }}
                  >
                    {projectCopy.reopenProject}
                  </Button>
                </ButtonGroup>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog
            open={Boolean(pendingReferenceCodeUpload)}
            onOpenChange={(open) => {
              if (!open && !uploadFileToNode.isPending) {
                cancelReferenceCodeUpload();
              }
            }}
          >
            <DialogContent showCloseButton={!uploadFileToNode.isPending}>
              <DialogHeader>
                <DialogTitle>
                  {workbenchCopy.referenceCodeImportTitle}
                </DialogTitle>
                <DialogDescription>
                  {workbenchCopy.referenceCodeImportDescription}
                </DialogDescription>
              </DialogHeader>
              <div className="grid max-h-80 gap-3 overflow-y-auto pr-1">
                {pendingReferenceCodeUpload?.files.map((file, index) => (
                  <div
                    className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_11rem] sm:gap-3"
                    key={`${file.name}-${index}`}
                  >
                    <Tooltip>
                      <TooltipTrigger
                        render={<span className="truncate text-sm" />}
                      >
                        {file.name}
                      </TooltipTrigger>
                      <TooltipContent>{file.name}</TooltipContent>
                    </Tooltip>
                    <Input
                      aria-label={`${workbenchCopy.referenceCode}: ${file.name}`}
                      disabled={uploadFileToNode.isPending}
                      value={
                        pendingReferenceCodeUpload.referenceCodes[index] ?? ""
                      }
                      onChange={(event) => {
                        const referenceCodes = [
                          ...pendingReferenceCodeUpload.referenceCodes,
                        ];
                        referenceCodes[index] = event.target.value;
                        setPendingReferenceCodeUpload({
                          ...pendingReferenceCodeUpload,
                          referenceCodes,
                        });
                      }}
                    />
                  </div>
                ))}
              </div>
              <DialogFooter>
                <ButtonGroup>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploadFileToNode.isPending}
                    onClick={cancelReferenceCodeUpload}
                  >
                    {dictionary.common.cancel}
                  </Button>
                  <Button
                    type="button"
                    disabled={
                      uploadFileToNode.isPending ||
                      pendingReferenceCodeUpload?.referenceCodes.some(
                        (code) => !code.trim()
                      )
                    }
                    onClick={() => submitReferenceCodeUpload()}
                  >
                    {workbenchCopy.importFiles}
                  </Button>
                </ButtonGroup>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <ProjectConfirmationsPanel
          projectId={projectId}
          project={loadedProject}
          currentUser={me.data ?? null}
          members={loadedProject.members ?? []}
          copy={confirmationsCopy}
          commonCopy={dictionary.common}
          responseWarehouseCopy={
            dictionary.confirmationCenter.intranet.responseWarehouseWorkspace
          }
          responseImportCopy={
            dictionary.confirmationCenter.intranet.responseWarehousePanel
          }
          locale={locale}
          readOnly={isReadOnlyProject}
          initialConfirmationId={searchParams.get("confirmationId")}
          initialConfirmationView={searchParams.get("confirmationView")}
          onViewProjectFiles={() => navigateWorkspace("files")}
        />
      )}
      <ProjectWingWorkItemOverlay
        open={activeWorkspace === "confirmations" && projectWorkItemsOpen}
        title={dictionary.workItems.projectTitle}
        resizeLabel={dictionary.workItems.resizeProject}
        onClose={() => setProjectWorkItemsOpen(false)}
      >
        {renderProjectWorkItemsSidebar()}
      </ProjectWingWorkItemOverlay>
      <AnimatePresence initial={false}>
        {fileExportJob ? (
          <FileExportProgressPanel
            key={fileExportJob.id}
            job={fileExportJob}
            copy={workbenchCopy.fileExport}
            downloading={fileExportDownloading}
            onDownload={() => downloadFileExportJob(fileExportJob)}
            onRetry={() => retryFileExportJob(fileExportJob)}
            onClose={() => setFileExportJob(null)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );

  function renderStatusShell(children: ReactNode, tone: WorkbenchStatusTone) {
    return (
      <div className={PROJECT_PAGE_SHELL_CLASS}>
        <ProjectPageHeader project={project.data} backHref={undefined} />
        {tone === "muted" ? (
          <div className="flex h-full w-full flex-col gap-3 p-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-full min-h-96 w-full flex-1" />
          </div>
        ) : (
          <WorkbenchRouteStatus tone={tone}>{children}</WorkbenchRouteStatus>
        )}
      </div>
    );
  }
}

function FileExportProgressPanel({
  job,
  copy,
  downloading,
  onDownload,
  onRetry,
  onClose,
}: {
  job: ProjectFileExportJob;
  copy: Dictionary["workbench"]["fileExport"];
  downloading: boolean;
  onDownload: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const isPresent = useIsPresent();
  const terminal = ["COMPLETED", "FAILED", "DOWNLOADED", "EXPIRED"].includes(
    job.status
  );
  const phaseLabel =
    job.status === "COMPLETED" || job.status === "DOWNLOADED"
      ? copy.ready
      : job.status === "FAILED"
        ? copy.failedTitle
        : job.currentPhase === "COLLECTING"
          ? copy.collecting
          : job.currentPhase === "PACKAGING"
            ? copy.packaging
            : job.currentPhase === "UPLOADING"
              ? copy.uploading
              : copy.ready;
  const progress = job.totalFiles
    ? Math.min(100, Math.round((job.completedFiles / job.totalFiles) * 100))
    : job.currentPhase === "READY"
      ? 100
      : 8;

  return (
    <motion.section
      initial={
        reducedMotion
          ? { opacity: 0 }
          : { opacity: 0, transform: "translateY(8px) scale(0.985)" }
      }
      animate={
        reducedMotion
          ? { opacity: 1 }
          : { opacity: 1, transform: "translateY(0px) scale(1)" }
      }
      exit={
        reducedMotion
          ? {
              opacity: 0,
              transition: { duration: 0.12, ease: "linear" },
            }
          : {
              opacity: 0,
              transform: "translateY(4px) scale(0.985)",
              transition: {
                duration: 0.18,
                ease: [0.16, 1, 0.3, 1],
              },
            }
      }
      transition={{
        duration: reducedMotion ? 0.12 : 0.22,
        ease: reducedMotion ? "linear" : [0.16, 1, 0.3, 1],
      }}
      inert={!isPresent}
      aria-live="polite"
      className={cn(
        "fixed right-6 bottom-6 z-50 w-[min(25rem,calc(100vw-3rem))] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-xl",
        !isPresent && "pointer-events-none"
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        {terminal ? (
          <Download className="mt-0.5 size-4 shrink-0 text-primary" />
        ) : (
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{phaseLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatTemplate(copy.progress, {
                  completed: job.completedFiles,
                  total: job.totalFiles,
                })}
              </p>
            </div>
            {terminal ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={copy.close}
                onClick={onClose}
              >
                <X />
              </Button>
            ) : null}
          </div>
          <Progress
            value={progress}
            max={100}
            label={phaseLabel}
            className="mt-3 h-1.5 bg-muted"
          >
            <ProgressTrack>
              <ProgressIndicator
                className={
                  job.status === "FAILED" ? "bg-destructive" : "bg-primary"
                }
              />
            </ProgressTrack>
          </Progress>
        </div>
      </div>
      {["COMPLETED", "DOWNLOADED", "FAILED"].includes(job.status) ? (
        <div className="flex justify-end border-t border-border px-4 py-3">
          <ButtonGroup>
            {job.status === "FAILED" ? (
              <Button type="button" variant="outline" onClick={onRetry}>
                <RotateCcw />
                {copy.retry}
              </Button>
            ) : (
              <Button type="button" disabled={downloading} onClick={onDownload}>
                {downloading ? (
                  <Skeleton className="size-4 rounded-full" />
                ) : (
                  <Download />
                )}
                {copy.download}
              </Button>
            )}
          </ButtonGroup>
        </div>
      ) : null}
    </motion.section>
  );
}

type WorkbenchStatusTone = "muted" | "destructive";

function WorkbenchRouteStatus({
  tone,
  children,
}: {
  tone: WorkbenchStatusTone;
  children: ReactNode;
}) {
  const textClass =
    tone === "destructive" ? "text-destructive" : "text-muted-foreground";

  return (
    <div
      className={`min-h-0 flex-1 bg-workbench-panel px-[35px] py-[30px] text-sm ${textClass}`}
    >
      {children}
    </div>
  );
}

function ProjectDeclarationGate({
  copy,
  project,
  isPending,
  onAccept,
}: {
  copy: Dictionary["workbench"];
  project?: Project;
  isPending: boolean;
  onAccept: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const isPresent = useIsPresent();
  const frameworkLabel =
    project?.frameworkTemplate?.code ?? project?.frameworkTemplateId ?? "";

  return (
    <motion.div
      inert={!isPresent}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{
        opacity: 0,
        transition: {
          duration: reducedMotion ? 0.12 : 0.18,
          ease: reducedMotion ? "linear" : [0.2, 0, 0, 1],
        },
      }}
      transition={{
        duration: reducedMotion ? 0.12 : 0.22,
        ease: reducedMotion ? "linear" : [0.2, 0, 0, 1],
      }}
      className={cn(
        "fixed inset-0 z-40 grid place-items-center bg-foreground/35 px-4 backdrop-blur-sm",
        !isPresent && "pointer-events-none"
      )}
    >
      <motion.div
        initial={
          reducedMotion
            ? { opacity: 0 }
            : { opacity: 0, transform: "translateY(6px) scale(0.985)" }
        }
        animate={
          reducedMotion
            ? { opacity: 1 }
            : { opacity: 1, transform: "translateY(0px) scale(1)" }
        }
        exit={
          reducedMotion
            ? {
                opacity: 0,
                transition: { duration: 0.12, ease: "linear" },
              }
            : {
                opacity: 0,
                transform: "translateY(4px) scale(0.985)",
                transition: {
                  duration: 0.18,
                  ease: [0.16, 1, 0.3, 1],
                },
              }
        }
        transition={{
          duration: reducedMotion ? 0.12 : 0.22,
          ease: reducedMotion ? "linear" : [0.16, 1, 0.3, 1],
        }}
        className="w-full max-w-xl rounded-lg border border-border bg-card p-6 text-card-foreground shadow-xl"
      >
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary">
              {formatDisplayName(
                project?.projectCode ?? copy.declarationFallbackProject
              )}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">
              {copy.declarationTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {project
                ? `${formatDisplayName(project.name)}（${frameworkLabel}）`
                : copy.declarationFallbackClient}
              {copy.declarationDescription}
            </p>
          </div>
        </div>
        <div className="mt-5 rounded-md border border-border bg-background p-4 text-sm leading-6 text-muted-foreground">
          {copy.declarationStatement}
        </div>
        <div className="mt-5 flex justify-end">
          <Button type="button" disabled={isPending} onClick={onAccept}>
            <ShieldCheck className="h-4 w-4" />
            {isPending ? copy.confirming : copy.confirmAndEnterProject}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function assertUploadableFile(file: File, copy: Dictionary["workbench"]) {
  if (file.size <= 0) {
    throw new Error(copy.fileUploadEmpty);
  }
}

function hasActiveAttachments(paper: WorkingPaper) {
  return (paper.attachments ?? []).some((attachment) => !attachment.deletedAt);
}

function filterWorkbenchWorkflow(nodes: WorkflowNode[]): WorkflowNode[] {
  return nodes.map((node) => ({
    ...node,
    workingPapers: (node.workingPapers ?? []).filter(
      (paper) => !isEmptyUploadPlaceholderPaper(paper)
    ),
    children: filterWorkbenchWorkflow(node.children ?? []),
  }));
}

function isEmptyUploadPlaceholderPaper(paper: WorkingPaper) {
  if (hasActiveAttachments(paper)) {
    return false;
  }
  if (
    (paper.signoffs ?? []).length > 0 ||
    (paper.reviewQuestions ?? []).length > 0
  ) {
    return false;
  }
  return /\.[A-Za-z0-9]{1,8}$/.test(paper.title.trim());
}

function buildFilePaperCode(
  node: WorkflowNode,
  bucket: WorkingPaperBucket,
  workflowNodes: WorkflowNode[],
  sequenceOffset = 0
) {
  if (bucket === "TEMPORARY") {
    return buildTemporaryFileCode(workflowNodes, sequenceOffset);
  }

  const numericFolderCode = resolveHierarchicalWorkflowNodeCode(
    workflowNodes,
    node
  );
  if (numericFolderCode) {
    const expression = new RegExp(
      `^${escapeRegExp(numericFolderCode)}\\.(\\d+)$`
    );
    const nextSequence = Math.max(
      0,
      ...(node.workingPapers ?? []).flatMap((paper) => {
        const match = paper.code.trim().match(expression);
        return match ? [Number(match[1])] : [];
      })
    );
    return `${numericFolderCode}.${nextSequence + sequenceOffset + 1}`;
  }

  const prefix = `${normalizeCodeWithoutDigitFour(node.code)}-F`;
  const existingCodes = new Set(
    (node.workingPapers ?? []).map((paper) =>
      normalizeCodeWithoutDigitFour(paper.code)
    )
  );
  let availableIndex = 0;
  for (let index = 1; index < 1000; index += 1) {
    const code = `${prefix}${formatNumberWithoutDigitFour(index, 3)}`;
    if (!existingCodes.has(code)) {
      if (availableIndex === sequenceOffset) {
        return code;
      }
      availableIndex += 1;
    }
  }
  return `${prefix}${formatNumberWithoutDigitFour(Date.now(), 1)}`;
}

function normalizeHierarchicalFolderCode(code: string) {
  const normalized = code.trim().replaceAll(/\s*-\s*/g, "-");
  return /^\d{1,4}$|^\d+(?:-\d+)+$/.test(normalized) ? normalized : null;
}

function findHierarchicalWorkflowNodeCode(
  nodes: WorkflowNode[],
  nodeId: string,
  parentPath: number[] = []
): string | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const storedCode =
      normalizeHierarchicalFolderCode(node.code) ??
      normalizeHierarchicalFolderCode(node.title);
    const path = (storedCode
      ? parseHierarchicalNumericCode(storedCode)
      : null) ?? [...parentPath, index + 1];
    const code = formatHierarchicalNumericCode(path);
    if (node.id === nodeId) {
      return code;
    }
    const childCode = findHierarchicalWorkflowNodeCode(
      node.children ?? [],
      nodeId,
      path
    );
    if (childCode) {
      return childCode;
    }
  }
  return null;
}

function resolveHierarchicalWorkflowNodeCode(
  nodes: WorkflowNode[],
  node: WorkflowNode
) {
  const existingCode = findHierarchicalWorkflowNodeCode(nodes, node.id);
  if (existingCode) {
    return existingCode;
  }

  const storedCode =
    normalizeHierarchicalFolderCode(node.code) ??
    normalizeHierarchicalFolderCode(node.title);
  if (storedCode) {
    return storedCode;
  }

  const parent = findWorkflowNode(nodes, node.parentId ?? null);
  const parentCode = parent
    ? findHierarchicalWorkflowNodeCode(nodes, parent.id)
    : null;
  const parentPath = parentCode
    ? parseHierarchicalNumericCode(parentCode)
    : null;
  const siblingIndex = parent?.children?.findIndex(
    (child) => child.id === node.id
  );
  const ordinal =
    siblingIndex !== undefined && siblingIndex >= 0
      ? siblingIndex + 1
      : inferLegacyWorkflowNodeOrdinal(node);
  if (parentPath && ordinal) {
    return formatHierarchicalNumericCode([...parentPath, ordinal]);
  }
  return ordinal ? formatHierarchicalNumericCode([ordinal]) : null;
}

function inferLegacyWorkflowNodeOrdinal(node: WorkflowNode) {
  const normalized = normalizeWorkflowNodeCode(node.code);
  if (node.level <= 1) {
    const letters = normalized.match(/^[A-Z]+$/i)?.[0]?.toUpperCase();
    if (!letters) {
      return null;
    }
    return [...letters].reduce(
      (value, letter) => value * 26 + (letter.codePointAt(0) ?? 0) - 64,
      0
    );
  }
  if (node.level === 2) {
    const groupOrdinal = normalized.match(/^[A-Z]+(\d+)$/i)?.[1];
    return groupOrdinal ? Number(groupOrdinal) : null;
  }
  const trailingNumber = normalized.match(/-(\d+)$/)?.[1];
  if (!trailingNumber) {
    return null;
  }
  const numericValue = Number(trailingNumber);
  return numericValue >= 1000 && numericValue % 1000 === 0
    ? numericValue / 1000
    : numericValue;
}

function escapeRegExp(value: string) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function buildTemporaryFileCode(
  workflowNodes: WorkflowNode[],
  sequenceOffset = 0
) {
  const existingCodes = new Set(
    collectWorkflowPapers(workflowNodes)
      .filter((paper) => (paper.bucket ?? "CURRENT") === "TEMPORARY")
      .map((paper) => normalizeCodeWithoutDigitFour(paper.code))
  );
  let availableIndex = 0;
  for (let index = 1; index < 1000; index += 1) {
    const code = `TMP${formatNumberWithoutDigitFour(index, 3)}`;
    if (!existingCodes.has(code)) {
      if (availableIndex === sequenceOffset) {
        return code;
      }
      availableIndex += 1;
    }
  }
  return `TMP${formatNumberWithoutDigitFour(Date.now(), 1)}`;
}

function findRollingWorkflowPath(
  rootNodes: WorkflowNode[],
  nodeId: string,
  parentDisplayCode?: string,
  pathSegments: WorkbenchBreadcrumbSegment[] = []
): WorkbenchBreadcrumbSegment[] {
  for (let index = 0; index < rootNodes.length; index += 1) {
    const node = rootNodes[index];
    const displayCode = formatRollingWorkflowNodeCode(
      node,
      index + 1,
      parentDisplayCode
    );
    const nextPathSegments = [
      ...pathSegments,
      {
        nodeId: node.id,
        label: formatRollingWorkflowPathLabel(node, displayCode),
      },
    ];
    if (node.id === nodeId) {
      return nextPathSegments;
    }
    const childPath = findRollingWorkflowPath(
      node.children ?? [],
      nodeId,
      displayCode,
      nextPathSegments
    );
    if (childPath.length > 0) {
      return childPath;
    }
  }
  return [];
}

function formatRollingWorkflowPathLabel(
  node: WorkflowNode,
  displayCode: string
) {
  const formattedDisplayCode = formatDisplayName(displayCode);
  const title = getVisibleWorkflowNodeTitle(node, displayCode);
  if (!title) {
    return formattedDisplayCode;
  }
  return `${formattedDisplayCode} - ${title}`;
}

function getVisibleWorkflowNodeTitle(node: WorkflowNode, displayCode: string) {
  const title = formatDisplayName(node.title).trim();
  if (!title || isDefaultPhaseTitle(title)) {
    return "";
  }
  const normalizedTitle = normalizeWorkflowNodeCode(title).toUpperCase();
  const normalizedCode = normalizeWorkflowNodeCode(node.code).toUpperCase();
  const normalizedDisplayCode =
    normalizeWorkflowNodeCode(displayCode).toUpperCase();
  const titleWithoutDisplayCode = stripWorkflowNodeTitleCodePrefix(
    title,
    formatDisplayName(displayCode).trim()
  );
  if (titleWithoutDisplayCode !== title) {
    return titleWithoutDisplayCode;
  }
  if (normalizedTitle === normalizedDisplayCode) {
    return "";
  }
  if (
    normalizedTitle === normalizedCode &&
    (normalizedDisplayCode === normalizedCode ||
      isGeneratedWorkflowNodeCode(node.code))
  ) {
    return "";
  }
  return title;
}

function stripWorkflowNodeTitleCodePrefix(title: string, displayCode: string) {
  const prefix = `${displayCode} - `;
  if (!title.startsWith(prefix)) {
    return title;
  }
  return title.slice(prefix.length).trim();
}

function isDefaultPhaseTitle(title: string) {
  return title === "\u65B0\u9636\u6BB5" || title === "New phase";
}

function isGeneratedWorkflowNodeCode(code: string) {
  return /^[A-Za-z]+\d+(?:-\d+)*$/.test(normalizeWorkflowNodeCode(code));
}

function formatAlphabetWorkflowCode(index: number) {
  let value = Math.max(1, Math.floor(index));
  let code = "";
  while (value > 0) {
    value -= 1;
    code = String.fromCodePoint(65 + (value % 26)) + code;
    value = Math.floor(value / 26);
  }
  return code;
}

function getWorkflowPhasePrefix(code: string) {
  return normalizeWorkflowNodeCode(code).match(/^[A-Z]+/)?.[0] ?? null;
}

function formatRollingWorkflowNodeCode(
  node: WorkflowNode,
  siblingIndex: number,
  parentDisplayCode?: string
) {
  const storedCode =
    normalizeHierarchicalFolderCode(node.code) ??
    normalizeHierarchicalFolderCode(node.title);
  if (storedCode) {
    return storedCode;
  }
  if (node.level <= 1) {
    return formatAlphabetWorkflowCode(siblingIndex);
  }
  const numericParent = parentDisplayCode
    ? parseHierarchicalNumericCode(parentDisplayCode)
    : null;
  if (numericParent) {
    return formatHierarchicalNumericCode([...numericParent, siblingIndex]);
  }
  const normalized = normalizeWorkflowNodeCode(node.code);
  if (node.level === 2) {
    const prefix =
      getWorkflowPhasePrefix(parentDisplayCode ?? "") ??
      normalized.match(/^([A-Za-z]+)/)?.[1] ??
      "";
    return prefix
      ? `${prefix}${formatNumberWithoutDigitFour(siblingIndex, 1)}`
      : node.code;
  }

  const parentCode = getRollingWorkflowGeneratedPrefix(
    parentDisplayCode ?? node.code
  );
  const nextNumber = formatNumberWithoutDigitFour(siblingIndex * 1000, 1, 1000);
  return `${parentCode}-${nextNumber}`;
}

function getRollingWorkflowGeneratedPrefix(code: string) {
  const normalized = normalizeWorkflowNodeCode(code);
  const codeMatch = normalized.match(/^([A-Za-z]+\d+)/);
  if (codeMatch) {
    return codeMatch[1];
  }
  return normalized.split("-")[0] || normalized;
}

function normalizeWorkflowNodeCode(code: string) {
  return normalizeCodeWithoutDigitFour(code).replaceAll(/\s*-\s*/g, "-");
}

function collectWorkflowPapers(nodes: WorkflowNode[]): WorkingPaper[] {
  return nodes.flatMap((node) => [
    ...(node.workingPapers ?? []),
    ...collectWorkflowPapers(node.children ?? []),
  ]);
}

function getReviewNotesPanelStorageKey(projectId: string) {
  return `${REVIEW_NOTES_PANEL_STORAGE_PREFIX}:${projectId}`;
}

function readStoredReviewNotesPanelHeight(projectId: string) {
  if (typeof window === "undefined") {
    return DEFAULT_REVIEW_NOTES_PANEL_PIXELS;
  }
  const parsed = Number(
    window.localStorage.getItem(getReviewNotesPanelStorageKey(projectId))
  );
  return Number.isFinite(parsed) && parsed >= MINIMUM_REVIEW_NOTES_PANEL_PIXELS
    ? parsed
    : DEFAULT_REVIEW_NOTES_PANEL_PIXELS;
}

function storeReviewNotesPanelHeight(projectId: string, height: number) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    getReviewNotesPanelStorageKey(projectId),
    String(Math.round(height))
  );
}

function resolveFilePreviewTarget(
  workflowPapers: WorkingPaper[],
  projectAttachments: ProjectAttachment[],
  attachmentId: string | null
): {
  attachment: Attachment | ProjectAttachment;
  paper: WorkingPaper | null;
} | null {
  if (!attachmentId) {
    return null;
  }

  for (const paper of workflowPapers) {
    const attachment =
      paper.attachments?.find(
        (item) => item.id === attachmentId && !item.deletedAt
      ) ?? null;
    if (attachment) {
      return { attachment, paper };
    }
  }

  const attachment =
    projectAttachments.find(
      (item) => item.id === attachmentId && !item.deletedAt
    ) ?? null;
  if (!attachment) {
    return null;
  }

  const paperId = attachment.workingPaper?.id ?? attachment.workingPaperId;
  const paper = paperId
    ? (workflowPapers.find((item) => item.id === paperId) ?? null)
    : null;
  return { attachment, paper };
}

async function copyWorkflowNodeTree(
  projectId: string,
  sourceNode: WorkflowNode,
  parentId: string
) {
  const createdNode = await api.createWorkflowNode(projectId, {
    parentId,
    code: sourceNode.code,
    title: sourceNode.title,
  });

  for (const paper of sourceNode.workingPapers ?? []) {
    const createdPaper = await api.createWorkingPaper(projectId, {
      workflowNodeId: createdNode.id,
      code: paper.code,
      title: paper.title,
      paperType: paper.paperType,
      bucket: paper.bucket ?? "CURRENT",
    });

    for (const attachment of paper.attachments ?? []) {
      if (attachment.deletedAt) {
        continue;
      }
      await api.copyAttachment(projectId, attachment.id, {
        workingPaperId: createdPaper.id,
      });
    }
  }

  for (const child of sourceNode.children ?? []) {
    await copyWorkflowNodeTree(projectId, child, createdNode.id);
  }

  return createdNode;
}

function containsWorkflowNodeId(root: WorkflowNode, nodeId: string): boolean {
  if (root.id === nodeId) {
    return true;
  }
  return (root.children ?? []).some((child) =>
    containsWorkflowNodeId(child, nodeId)
  );
}

function attachUploadedFileToPaper(
  paper: WorkingPaper,
  attachment: Attachment
): WorkingPaper {
  return {
    ...paper,
    attachments: upsertAttachment(paper.attachments ?? [], attachment),
  };
}

function upsertAttachment(
  attachments: Attachment[],
  attachment: Attachment
): Attachment[] {
  const index = attachments.findIndex((item) => item.id === attachment.id);
  if (index === -1) {
    return [...attachments, attachment];
  }
  return attachments.map((item) =>
    item.id === attachment.id ? attachment : item
  );
}

function upsertWorkingPaperInWorkflow(
  nodes: WorkflowNode[],
  nodeId: string,
  paper: WorkingPaper
): WorkflowNode[] {
  return nodes.map((node) => {
    const children = node.children
      ? upsertWorkingPaperInWorkflow(node.children, nodeId, paper)
      : node.children;
    if (node.id !== nodeId) {
      return children === node.children ? node : { ...node, children };
    }
    return {
      ...node,
      children,
      workingPapers: upsertWorkingPaper(node.workingPapers ?? [], paper),
    };
  });
}

function _removeAttachmentFromWorkflow(
  nodes: WorkflowNode[],
  attachmentId: string
): WorkflowNode[] {
  return nodes.map((node) => ({
    ...node,
    workingPapers: (node.workingPapers ?? []).map((paper) => ({
      ...paper,
      attachments: (paper.attachments ?? []).filter(
        (attachment) => attachment.id !== attachmentId
      ),
    })),
    children: node.children
      ? _removeAttachmentFromWorkflow(node.children, attachmentId)
      : node.children,
  }));
}

function upsertWorkingPaper(
  papers: WorkingPaper[],
  paper: WorkingPaper
): WorkingPaper[] {
  const index = papers.findIndex((item) => item.id === paper.id);
  if (index === -1) {
    return [...papers, paper];
  }
  return papers.map((item) => (item.id === paper.id ? paper : item));
}

function upsertProjectAttachment(
  attachments: ProjectAttachment[],
  attachment: ProjectAttachment
): ProjectAttachment[] {
  const index = attachments.findIndex((item) => item.id === attachment.id);
  if (index === -1) {
    return [...attachments, attachment];
  }
  return attachments.map((item) =>
    item.id === attachment.id ? attachment : item
  );
}

function removeMovedProjectAttachmentFromSource(
  attachments: ProjectAttachment[],
  file: DirectoryFileTransfer
) {
  return attachments.filter((attachment) => {
    if (attachment.id !== file.attachmentId) {
      return true;
    }
    const locationNodeId = attachment.workingPaper?.workflowNodeId;
    const locationPaperId =
      attachment.workingPaper?.id ?? attachment.workingPaperId;
    return locationNodeId !== file.nodeId && locationPaperId !== file.paperId;
  });
}

function getDirectoryFileTargetHighlightId(
  attachment: Attachment,
  file: DirectoryFileTransfer,
  preferAttachmentId = false
) {
  const relocatedAttachment = attachment as ProjectAttachment;
  if (preferAttachmentId) {
    return attachment.id ?? file.attachmentId;
  }
  return (
    relocatedAttachment.workingPaper?.id ??
    attachment.workingPaperId ??
    attachment.id ??
    file.paperId
  );
}

function buildProjectAttachment(
  attachment: Attachment,
  paper: WorkingPaper,
  node: WorkflowNode,
  path: { id: string; code: string; title: string; level: number }[]
): ProjectAttachment {
  return {
    ...attachment,
    workingPaper: {
      id: paper.id,
      code: paper.code,
      title: paper.title,
      bucket: paper.bucket,
      workflowNodeId: node.id,
      workflowNodeCode: node.code,
      workflowNodeTitle: node.title,
      signoffs: paper.signoffs ?? [],
      reviewQuestions: paper.reviewQuestions ?? [],
      path,
    },
  };
}

function findWorkflowNodePath(
  nodes: WorkflowNode[],
  nodeId: string
): { id: string; code: string; title: string; level: number }[] | null {
  for (const node of nodes) {
    const current = toProjectAttachmentPathNode(node);
    if (node.id === nodeId) {
      return [current];
    }
    const childPath = findWorkflowNodePath(node.children ?? [], nodeId);
    if (childPath) {
      return [current, ...childPath];
    }
  }
  return null;
}

function findWorkflowNodeIdForPaper(
  nodes: WorkflowNode[],
  paperId: string
): string | null {
  for (const node of nodes) {
    if (node.workingPapers.some((paper) => paper.id === paperId)) {
      return node.id;
    }
    const childNodeId = findWorkflowNodeIdForPaper(
      node.children ?? [],
      paperId
    );
    if (childNodeId) {
      return childNodeId;
    }
  }
  return null;
}

function findWorkflowPaperBucket(
  nodes: WorkflowNode[],
  paperId: string
): WorkingPaperBucket | null {
  for (const node of nodes) {
    const paper = node.workingPapers.find((item) => item.id === paperId);
    if (paper) {
      return paper.bucket ?? "CURRENT";
    }
    const childBucket = findWorkflowPaperBucket(node.children ?? [], paperId);
    if (childBucket) {
      return childBucket;
    }
  }
  return null;
}

function resolveAuditYear(yearEndDate?: string) {
  if (!yearEndDate) {
    return new Date().getFullYear();
  }
  const year = new Date(yearEndDate).getFullYear();
  return Number.isFinite(year) ? year : new Date().getFullYear();
}

function resolveProjectsReturnHref(returnTo: string | null) {
  if (!returnTo) {
    return;
  }

  try {
    const destination = new URL(returnTo, "https://projectwing.local");
    if (destination.origin !== "https://projectwing.local") {
      return;
    }
    if (!["/engagement", "/confirmations"].includes(destination.pathname)) {
      return;
    }
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    // Invalid external URLs have no safe restore target.
  }
}

function collectWorkflowRestoreTargetNodes(
  nodes: WorkflowNode[]
): WorkflowNode[] {
  return nodes.flatMap((node) => [
    node,
    ...collectWorkflowRestoreTargetNodes(node.children ?? []),
  ]);
}

function toProjectAttachmentPathNode(node: WorkflowNode) {
  return {
    id: node.id,
    code: node.code,
    title: node.title,
    level: node.level,
  };
}

function formatWorkflowNodeContextLabel(node: { code: string; title: string }) {
  const code = formatDisplayName(node.code);
  const title = formatDisplayName(node.title);
  if (!code) {
    return title;
  }
  if (!title || title === code) {
    return code;
  }
  return `${code}-${title}`;
}

function formatTemplate(
  template: string,
  values: Record<string, string | number>
) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template
  );
}

function _unused_getErrorMessage(error: unknown) {
  return getUserFacingErrorMessage(error);
}

export function isInFlightFileExportJob(job: ProjectFileExportJob) {
  return job.status === "QUEUED" || job.status === "RUNNING";
}

function _unused_downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function startBrowserDownload(url: string, fileName: string) {
  if (!url.startsWith("data:")) {
    const frame = document.createElement("iframe");
    frame.title = "File export download";
    frame.hidden = true;
    frame.src = url;
    document.body.append(frame);
    window.setTimeout(() => frame.remove(), 5 * 60 * 1000);
    return;
  }
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

type PhaseWorkbenchCopy = Dictionary["workbench"] & {
  nodeCreatedPhase?: string;
  deletePhaseDescription?: string;
  confirmDeletePhase?: string;
};

function getNodeCreatedTitle(copy: Dictionary["workbench"], level: number) {
  const phaseCopy = copy as PhaseWorkbenchCopy;
  if (level === 1) {
    return phaseCopy.nodeCreatedPhase ?? copy.nodeCreatedGroup;
  }
  if (level === 2) {
    return copy.nodeCreatedGroup;
  }
  return copy.nodeCreatedWorkpaper;
}

function getDeleteNodeCopy(copy: Dictionary["workbench"], level: number) {
  const phaseCopy = copy as PhaseWorkbenchCopy;
  if (level === 1) {
    return {
      title: phaseCopy.confirmDeletePhase ?? copy.confirmDeleteGroup,
      description:
        phaseCopy.deletePhaseDescription ?? copy.deleteGroupDescription,
    };
  }
  if (level === 2) {
    return {
      title: copy.confirmDeleteGroup,
      description: copy.deleteGroupDescription,
    };
  }
  return {
    title: copy.confirmDeleteWorkpaper,
    description: copy.deleteWorkpaperDescription,
  };
}
