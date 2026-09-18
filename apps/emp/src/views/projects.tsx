"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type {
  CollisionDetection,
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragStartEvent,
  UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SmartFormV2DefinitionSchema,
  canGlobalRoleCreateProject,
  formatNumberWithoutDigitFour,
  getProjectInvitationEligibility,
} from "@project-wing/shared";
import type {
  CreateInvitationInput,
  CreateProjectInput,
  LinkProjectEngagementInput,
  ProjectRole,
  SmartFormV2Definition,
  SmartFormV2Node,
  UpdateProjectInput,
} from "@project-wing/shared";
import {
  Button as SharedButton,
  CollectionState,
  ViewSwitcher,
  ProjectWingMasterDataGrid,
  ProjectWingMasterDataGridColumnHeader,
  ProjectWingTopBarBrand,
  ProjectWingTopBarReturnAction,
  Badge as ReuiBadge,
  Sortable,
  SortableItem,
  SortableItemHandle,
  projectWingSelectedValuesFilter,
  useCompactViewport,
  useProjectWingActionHistory,
} from "@project-wing/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Archive,
  ArrowLeft,
  BookOpenCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Edit3,
  ExternalLink,
  FileSearch,
  FileText,
  Funnel,
  Folder,
  GripVertical,
  LayoutGrid,
  List,
  MailPlus,
  MonitorCog,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Truck,
  Upload,
  UserCog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
} from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  MouseEvent as ReactMouseEvent,
  ReactNode,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import type { PanelImperativeHandle, PanelSize } from "react-resizable-panels";

import { EmpMobileProjects } from "@/components/emp-mobile-projects";
import { ProjectFileTypeIcon } from "@/components/project-file-type-icon";
import {
  Autocomplete,
  AutocompleteCollection,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteGroupLabel,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from "@/components/reui/autocomplete";
import { AccessibleName } from "@/components/ui/accessible-name";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DynamicBox, DynamicComponent } from "@/components/ui/dynamic-layout";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { FileInput } from "@/components/ui/file-input";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getEmpMobileNavigationCopy } from "@/i18n/mobile-navigation";

import type {
  DesktopFolder,
  DesktopProjectPlacement,
  InboxMessage,
  Project,
  ProjectMember,
  ProjectTemplate,
  ProjectTemplateFile,
  ProjectTemplateNode,
  ProjectTemplateOrderedItem,
  ProjectTemplateSmartForm,
  RollForwardPreview,
  SmartFormTemplate,
  User,
  WorkflowNode,
} from "../api/client";
import { api } from "../api/client";
import { EmpHomeSearchShell } from "../components/emp-home-search-shell";
import { EmpRouteTopBar } from "../components/emp-persistent-top-bar";
import {
  EmpPortalAction,
  EmpTopBarControls,
  GlobalSettingsPanel,
  getIntranetPortalUrl,
} from "../components/project-wing-top-bar-controls";
import {
  SIDEBAR_13_DIALOG_CONTENT_CLASS,
  SIDEBAR_13_DIALOG_OVERLAY_CLASS,
} from "../components/settings-dialog-shell";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "../components/sidebar";
import { SmartFormV2TemplateDesigner } from "../components/smart-form-v2-template-designer";
import { SplitterRail } from "../components/splitter-rail";
import { useToast } from "../components/toast";
import { WorkbenchActivityPanel } from "../components/workbench-activity-panel";
import { WorkbenchDirectory } from "../components/workbench-directory";
import type { DirectoryNodeForm } from "../components/workbench-directory";
import { useI18n } from "../i18n/client";
import type { Dictionary } from "../i18n/dictionaries";
import type { Locale } from "../i18n/settings";
import { canAccessAdmin } from "../lib/access-control";
import {
  CALENDAR_END_MONTH,
  CALENDAR_START_MONTH,
  formatCalendarDate,
  formatIsoDate,
  getCalendarLocale,
  parseIsoDate,
} from "../lib/calendar-date";
import {
  clampDesktopPosition,
  findNextAvailableDesktopPosition,
  getDefaultIconPosition,
  matchesDesktopSearch,
  snapDesktopPosition,
} from "../lib/desktop-layout";
import type { DesktopPosition } from "../lib/desktop-layout";
import { getEmpActionLabel } from "../lib/emp-action-history";
import type { EmpActionHistoryEntry } from "../lib/emp-action-history";
import { resolveInboxActionHref } from "../lib/inbox-action-url";
import {
  getFirmRankLabel,
  getInvitationRoleLabel,
  getRoleInEngagementLabel,
} from "../lib/member-role-labels";
import {
  buildProjectGridSlots,
  getProjectGridDimensions,
  getProjectGridPlacementUpdates,
  moveProjectGridSlot,
} from "../lib/project-icon-grid";
import type { ProjectGridPlacementUpdate } from "../lib/project-icon-grid";
import {
  BUTTON_GROUP_SEPARATED_ITEMS_CLASS,
  PROJECT_OVERVIEW_GRID_CLASS,
  formatDisplayName,
  formatProjectDisplayId,
} from "../lib/project-layout";
import {
  canArchiveProject,
  canPerformProjectAction,
} from "../lib/project-permissions";
import type { ProjectMemberPermissionSubject } from "../lib/project-permissions";
import { cn } from "../lib/utils";
import { WorkbenchSettingsPanel } from "./workbench-settings-panel";

const ICON_HEIGHT = 132;
const ICON_WIDTH = 132;
const DETAIL_ROW_METRICS: Record<
  DesktopIconDensity,
  { gap: number; height: number }
> = {
  compact: { gap: 0, height: 48 },
  standard: { gap: 0, height: 56 },
  comfortable: { gap: 0, height: 64 },
};
const HOME_NAV_CHARACTER_WIDTH = 8;
const HOME_NAV_COLLAPSED_THRESHOLD = 1;
const HOME_NAV_CONTENT_WIDTH = 76;
const HOME_NAV_DRAG_COLLAPSE_THRESHOLD = 48;
const HOME_NAV_DRAG_EXPAND_THRESHOLD = 48;
const HOME_NAV_MAX_WIDTH = 260;
const HOME_NAV_MIN_WIDTH = 184;
const EMPTY_FOLDERS: DesktopFolder[] = [];
const EMPTY_PLACEMENTS: DesktopProjectPlacement[] = [];
const EMPTY_PROJECTS: Project[] = [];
const EMPTY_PROJECT_TEMPLATES: ProjectTemplate[] = [];
const EMPTY_SMART_FORM_TEMPLATES: SmartFormTemplate[] = [];
const EMPTY_PROJECT_TEMPLATE_NODES: ProjectTemplateNode[] = [];
const ARCHIVED_DESKTOP_FOLDER_NAMES = new Set([
  "Archived",
  "\u5DF2\u5F52\u6863",
]);
const DISPLAY_SETTINGS_STORAGE_KEY = "project-wing-home-display-settings";
const HOME_VIEW_MODE_STORAGE_KEY = "project-wing-home-view-mode";
const DESKTOP_CONTEXT_MENU_CONTENT_CLASS =
  "w-64 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-xl";
const DESKTOP_CONTEXT_MENU_ITEM_CLASS =
  "h-9 gap-3 rounded-sm px-3 text-left text-sm";

function isArchivedProject(project: Pick<Project, "status">) {
  return project.status === "ARCHIVED";
}

function getProjectStatusBadge(
  project: Pick<Project, "status">,
  copy: Pick<
    ReturnType<typeof useI18n>["dictionary"]["desktop"],
    "archivedStatus" | "pendingFinalCheckStatus"
  >
) {
  if (project.status === "PENDING_FINAL_CHECK") {
    return {
      label: copy.pendingFinalCheckStatus ?? "Pending archive review",
      className:
        "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200",
    };
  }
  if (isArchivedProject(project)) {
    return {
      label: copy.archivedStatus ?? "Archived",
      className:
        "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
    };
  }
  return null;
}
const DEFAULT_ARCHIVE_DEADLINE_DAYS = 60;
const DEFAULT_INVITATION_EXPIRY_DAYS = 7;
const PROJECT_DIALOG_EXIT_DURATION_MS = 200;
const PROJECT_TEMPLATE_DIRECTORY_MAX_WIDTH = 520;
const PROJECT_TEMPLATE_DIRECTORY_MIN_WIDTH = 240;
const PROJECT_TEMPLATE_DIRECTORY_WIDTH = 300;
const SORT_PREFERENCES_STORAGE_KEY = "project-wing-home-sort-preferences";

type ContextMenuState = {
  x: number;
  y: number;
} | null;

type DragState = {
  projectId: string;
  origin: DesktopPosition;
  moved: boolean;
};

type ProjectFormState = {
  cmpClientId: string;
  cmpEngagementId: string;
  cmpEngagementCode: string;
  cmpClientName?: string;
  cmpEngagementName?: string;
  name: string;
  projectCode: string;
  language: "zh-CN" | "en-US";
  frameworkTemplateId: string;
  frameworkTemplateInput: string;
  projectTemplateId: string;
  projectTemplateName?: string;
  rollForwardFromProjectId: string;
  rollForwardSourceName?: string;
  inheritMembers: boolean;
  yearEndDate: string;
  reportDate: string;
  archiveDeadline: string;
  notes: string;
};

type ProjectReviewData = ProjectFormState & {
  invitations?: CreateProjectInput["invitations"];
};

type AutomaticProjectMemberAssignment = Pick<
  ProjectMember,
  "projectRole" | "inChargeRole"
>;

type ProjectSelectOption = {
  value: string;
  label: string;
};

type DesktopSortField =
  | "name"
  | "createdAt"
  | "lastOpenedAt"
  | "reportDate"
  | "archiveDeadline";
type DesktopSortDirection = "asc" | "desc";
type DesktopIconDensity = "compact" | "standard" | "comfortable";
type DesktopMode = "home" | "templates" | "smart-forms";
type HomeViewMode = "list" | "icons";
type DesktopSortPreference = {
  field: DesktopSortField;
  direction: DesktopSortDirection;
};
type DesktopDisplaySettings = {
  projectCodePreferenceVersion?: 1;
  density: DesktopIconDensity;
  showProjectCode: boolean;
  showClientCode: boolean;
  showClientName: boolean;
  showLastOpened: boolean;
  showReportDate: boolean;
  showArchiveDeadline: boolean;
};

type ProjectTemplateSettingsForm = {
  name: string;
  code: string;
  frameworkTemplateId: string;
  isPublished: boolean;
};

type TemplateLibraryMode = "project" | "smart-form";

type SmartFormTemplateDraft = {
  name: string;
  code: string;
  description: string;
  frameworkTemplateId: string;
};

type FrameworkTemplateMatch = {
  id: string;
  code: string;
  name: string;
};

const defaultDisplaySettings: DesktopDisplaySettings = {
  projectCodePreferenceVersion: 1,
  density: "standard",
  showProjectCode: true,
  showClientCode: true,
  showClientName: true,
  showLastOpened: true,
  showReportDate: false,
  showArchiveDeadline: false,
};

function formatFrameworkTemplateInput(template: FrameworkTemplateMatch) {
  return `${template.code} - ${template.name}`;
}

function findFrameworkTemplateByInput(
  templates: FrameworkTemplateMatch[],
  value: string
) {
  const normalizedValue = value.trim().toLocaleLowerCase();
  if (!normalizedValue) {
    return null;
  }
  return (
    templates.find((template) => {
      const code = template.code.trim().toLocaleLowerCase();
      const name = template.name.trim().toLocaleLowerCase();
      return (
        normalizedValue === code ||
        normalizedValue === name ||
        normalizedValue ===
          formatFrameworkTemplateInput(template).toLocaleLowerCase()
      );
    }) ?? null
  );
}

type MemberRoleFilter =
  | "ALL"
  | "PARTNER"
  | "PRINCIPAL"
  | "MANAGER"
  | "SENIOR"
  | "STAFF"
  | "ASSISTANT"
  | "EXPERT";
type InvitationStatusFilter = "ALL" | "INVITED";
type ProjectCalendarFieldId = "yearEndDate" | "reportDate" | "archiveDeadline";

const MEMBER_ROLE_FILTERS: {
  value: Exclude<MemberRoleFilter, "ALL">;
  label: string;
}[] = [
  { value: "PARTNER", label: "Partner" },
  { value: "PRINCIPAL", label: "Principal" },
  { value: "MANAGER", label: "Manager" },
  { value: "SENIOR", label: "Senior" },
  { value: "STAFF", label: "Staff" },
  { value: "ASSISTANT", label: "Assistant" },
  { value: "EXPERT", label: "Expert" },
];

function getMemberGradeLabel(user: User) {
  return getFirmRankLabel(user.globalRole);
}

function getDefaultInvitationRole(user: User): ProjectRole | null {
  const eligibility = getProjectInvitationEligibility(user);
  const preferredRole: Partial<Record<User["globalRole"], ProjectRole>> = {
    PARTNER: "PARTNER",
    EQCR: "EQCR",
    TAX_EXPERT: "TAX_REVIEWER",
  };
  const preferred = preferredRole[user.globalRole] ?? "PREPARER";
  return eligibility.assignableProjectRoles.includes(preferred)
    ? preferred
    : (eligibility.assignableProjectRoles[0] ?? null);
}

function matchesMemberRoleFilter(
  user: User,
  projectRole: ProjectRole | null,
  filter: MemberRoleFilter
) {
  switch (filter) {
    case "ALL": {
      return true;
    }
    case "PARTNER": {
      return user.globalRole === "PARTNER";
    }
    case "PRINCIPAL": {
      return user.globalRole === "PRINCIPAL";
    }
    case "MANAGER": {
      return user.globalRole === "MANAGER";
    }
    case "SENIOR": {
      return user.globalRole === "SENIOR";
    }
    case "STAFF": {
      return user.globalRole === "STAFF";
    }
    case "ASSISTANT": {
      return user.globalRole === "ASSISTANT";
    }
    case "EXPERT": {
      return user.globalRole === "TAX_EXPERT" || projectRole === "TAX_REVIEWER";
    }
    default: {
      return false;
    }
  }
}

function getProjectMemberPermissionSubject(
  project: Project | null,
  user: User | null | undefined
): ProjectMemberPermissionSubject | null {
  if (!project || !user) {
    return null;
  }
  if (user.globalRole === "SUPER_ADMIN") {
    return {
      id: `super-admin:${project.id}:${user.id}`,
      projectRole: "PREPARER",
      user: { id: user.id, globalRole: user.globalRole },
    };
  }
  const member = project.members?.find((item) => item.user.id === user.id);
  if (!member) {
    return null;
  }
  return mapProjectMemberToPermissionSubject(member);
}

function mapProjectMemberToPermissionSubject(
  member: ProjectMember
): ProjectMemberPermissionSubject {
  return {
    id: member.id,
    projectRole: member.projectRole,
    inChargeRole: member.inChargeRole ?? null,
    authorizationSuspendedAt: member.authorizationSuspendedAt,
    user: {
      id: member.user.id,
      globalRole: member.user.globalRole,
    },
  };
}

export function ProjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { dictionary, locale, localizedPath } = useI18n();
  const actionHistory = useProjectWingActionHistory<EmpActionHistoryEntry>({
    current: { id: "engagement", href: localizedPath("/engagement") },
    storageKey: "project-wing:emp:action-history",
  });
  const { toast } = useToast();
  const desktopCopy = dictionary.desktop;
  const desktopContextCopy = desktopCopy.context;
  const calendarTodayLabel = dictionary.common.datePicker?.today ?? "Today";
  const desktop = useQuery({ queryKey: ["desktop"], queryFn: api.desktop });
  const frameworkTemplates = useQuery({
    queryKey: ["frameworkTemplates"],
    queryFn: api.frameworkTemplates,
  });
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const inbox = useQuery({
    queryKey: ["inbox", me.data?.id],
    queryFn: api.inboxMessages,
    enabled: Boolean(me.data),
  });
  const inboxMessages = inbox.data ?? [];
  const [desktopMode, setDesktopMode] = useState<DesktopMode>("home");
  const [activityPanelOpen, setActivityPanelOpen] = useState(false);
  const [desktopSettingsOpen, setDesktopSettingsOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(() =>
    searchParams.get("folderId")
  );
  const [searchQuery, setSearchQuery] = useState("");
  const isMobile = useCompactViewport(767);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileCopy = getEmpMobileNavigationCopy(locale);
  const [isHomeSearchActive, setIsHomeSearchActive] = useState(false);
  const [compactSearchOpen, setCompactSearchOpen] = useState(false);
  const homeSearchContainerRef = useRef<HTMLDivElement>(null);
  const homeSearchShellRef = useRef<HTMLDivElement>(null);
  const homeSearchExitAnimation = useRef<Animation | null>(null);

  useEffect(
    () => () => {
      homeSearchExitAnimation.current?.cancel();
      homeSearchExitAnimation.current = null;
    },
    []
  );

  function openConfirmationCenter() {
    if (homeSearchExitAnimation.current) {
      return;
    }
    const href = localizedPath("/confirmations");
    const navigate = () =>
      actionHistory.navigateTo({ id: "confirmation-center", href }, (entry) =>
        router.push(entry.href)
      );
    const search = homeSearchShellRef.current;
    if (
      !search ||
      !search.getClientRects().length ||
      typeof search.animate !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      navigate();
      return;
    }
    setIsHomeSearchActive(false);
    router.prefetch(href);
    const animation = search.animate(
      [
        { clipPath: "inset(0 0% round 999px)", opacity: 1 },
        { clipPath: "inset(0 50% round 999px)", opacity: 0 },
      ],
      { duration: 180, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" }
    );
    homeSearchExitAnimation.current = animation;
    void animation.finished.then(
      () => {
        // The persistent header can outlive this route's animation cleanup.
        search.style.opacity = "0";
        search.style.clipPath = "inset(0 50% round 999px)";
        search.style.visibility = "hidden";
        navigate();
      },
      () => {}
    );
  }

  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [homeViewMode, setHomeViewMode] = useState<HomeViewMode>("list");
  const [displaySettings, setDisplaySettings] =
    useState<DesktopDisplaySettings>(() => {
      if (typeof window === "undefined") {
        return defaultDisplaySettings;
      }
      const savedDisplaySettings = window.localStorage.getItem(
        DISPLAY_SETTINGS_STORAGE_KEY
      );
      return savedDisplaySettings
        ? parseDisplaySettings(savedDisplaySettings)
        : defaultDisplaySettings;
    });
  const [sortPreferences, setSortPreferences] = useState<
    Record<string, DesktopSortPreference>
  >({});
  const [createMode, setCreateMode] = useState<"folder" | "project" | null>(
    null
  );
  const [projectDialogStep, setProjectDialogStep] = useState<1 | 2>(1);
  const [isEngagementLinkSkipped, setIsEngagementLinkSkipped] = useState(false);
  const [reviewData, setReviewData] = useState<ProjectReviewData | null>(null);
  const [folderName, setFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState<DesktopFolder | null>(
    null
  );
  const [deleteFolderCandidate, setDeleteFolderCandidate] =
    useState<DesktopFolder | null>(null);
  const [projectForm, setProjectForm] = useState<ProjectFormState>({
    cmpClientId: "",
    cmpEngagementId: "",
    cmpEngagementCode: "",
    cmpClientName: "",
    cmpEngagementName: "",
    name: "",
    projectCode: "",
    language: "zh-CN" as const,
    frameworkTemplateId: "",
    frameworkTemplateInput: "",
    projectTemplateId: "",
    rollForwardFromProjectId: "",
    rollForwardSourceName: "",
    inheritMembers: true,
    yearEndDate: "2026-12-31",
    reportDate: "2027-03-31",
    archiveDeadline: "2027-05-30",
    notes: "",
  });
  const [openProjectCalendarField, setOpenProjectCalendarField] =
    useState<ProjectCalendarFieldId | null>(null);
  const [selectedInvitations, setSelectedInvitations] = useState<
    Record<string, ProjectRole>
  >({});
  const [invitationRoleChoices, setInvitationRoleChoices] = useState<
    Record<string, ProjectRole>
  >({});
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const projectDialogCleanupTimerRef = useRef<number | null>(null);
  const [deleteProjectCandidate, setDeleteProjectCandidate] =
    useState<Project | null>(null);
  const [projectRecycleBinOpen, setProjectRecycleBinOpen] = useState(false);
  const [selectedDeletedProjectIds, setSelectedDeletedProjectIds] = useState<
    string[]
  >([]);
  const closeProjectRecycleBin = () => {
    setProjectRecycleBinOpen(false);
    setSelectedDeletedProjectIds([]);
  };
  const projectTemplates = useQuery({
    queryKey: ["projectTemplates", "createProject"],
    queryFn: () => api.projectTemplates(),
    enabled: createMode === "project",
  });
  const cmpEngagementSearchCode = projectForm.cmpEngagementCode.trim();
  const cmpEngagements = useQuery({
    queryKey: ["cmpEngagements", cmpEngagementSearchCode, "ACTIVE"],
    queryFn: () =>
      api.cmpEngagements({
        q: cmpEngagementSearchCode,
        status: "ACTIVE",
      }),
    enabled:
      createMode === "project" &&
      !projectForm.rollForwardFromProjectId &&
      Boolean(cmpEngagementSearchCode),
  });
  const projectList = useQuery({
    queryKey: ["projects", "rollForwardSources"],
    queryFn: api.projects,
    enabled: createMode === "project" && !editingProject,
  });
  const rollForwardPreview = useQuery({
    queryKey: ["rollForwardPreview", projectForm.rollForwardFromProjectId],
    queryFn: () => api.rollForwardPreview(projectForm.rollForwardFromProjectId),
    enabled:
      createMode === "project" &&
      !editingProject &&
      Boolean(projectForm.rollForwardFromProjectId),
  });
  const deletedProjects = useQuery({
    queryKey: ["projects", "deleted"],
    queryFn: api.deletedProjects,
    enabled: projectRecycleBinOpen,
  });
  const deletedProjectItems = deletedProjects.data ?? EMPTY_PROJECTS;
  const visibleSelectedDeletedProjectIds = useMemo(() => {
    const deletedIds = new Set(
      deletedProjectItems.map((project) => project.id)
    );
    return selectedDeletedProjectIds.filter((projectId) =>
      deletedIds.has(projectId)
    );
  }, [deletedProjectItems, selectedDeletedProjectIds]);
  const userDirectory = useQuery({
    queryKey: ["user-directory"],
    queryFn: api.userDirectory,
    enabled: createMode === "project",
  });
  const [positions, setPositions] = useState<Record<string, DesktopPosition>>(
    {}
  );
  const [detailPositions, setDetailPositions] = useState<
    Record<string, DesktopPosition>
  >({});
  const [isHomeNavigationCollapsed, setIsHomeNavigationCollapsed] =
    useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(
    null
  );
  const [hiddenProjectIds, setHiddenProjectIds] = useState<Set<string>>(
    () => new Set()
  );
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const navigationPanelRef = useRef<PanelImperativeHandle | null>(null);
  const homeNavigationGroupElementRef = useRef<HTMLDivElement | null>(null);
  const homeNavigationUserResizedRef = useRef(false);
  const homeNavigationResponsiveCollapsedRef = useRef(false);
  const homeNavigationLastWidthRef = useRef(HOME_NAV_MIN_WIDTH);
  const [homeNavigationLastWidth, setHomeNavigationLastWidth] =
    useState(HOME_NAV_MIN_WIDTH);
  const homeNavigationResizeStartWidthRef = useRef(HOME_NAV_MIN_WIDTH);
  const homeNavigationResizeStartCollapsedRef = useRef(false);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickProjectId = useRef<string | null>(null);
  const lastAppliedCmpEngagementIdRef = useRef<string | null>(null);
  const folders = desktop.data?.folders ?? EMPTY_FOLDERS;
  const placements = desktop.data?.placements ?? EMPTY_PLACEMENTS;
  const activeFolderId =
    selectedFolderId ?? folders.find((folder) => folder.isDefault)?.id ?? null;
  const activeFolder = folders.find((folder) => folder.id === activeFolderId);
  const activeFolderName = activeFolder
    ? getDesktopFolderLabel(activeFolder, desktopCopy)
    : "";
  const homeNavigationPreferredWidth = getHomeNavigationWidth(
    folders,
    desktopCopy
  );
  const folderPlacements = placements.filter(
    (placement) => placement.folderId === activeFolderId
  );
  const activeSortPreference = activeFolderId
    ? (sortPreferences[activeFolderId] ?? null)
    : null;
  const sortedFolderPlacements = useMemo(
    () =>
      activeSortPreference
        ? sortPlacements(folderPlacements, activeSortPreference)
        : folderPlacements,
    [activeSortPreference, folderPlacements]
  );
  const activePlacements = sortedFolderPlacements;
  const rollForwardSourceProjects = useMemo(
    () =>
      (projectList.data ?? EMPTY_PROJECTS).filter(
        (project) => project.status === "ARCHIVED"
      ),
    [projectList.data]
  );
  const matchingCmpEngagements = useMemo(() => {
    const normalizedSearch = cmpEngagementSearchCode.toLocaleLowerCase();
    if (!normalizedSearch) {
      return [];
    }
    return (cmpEngagements.data?.engagements ?? [])
      .filter((engagement) =>
        [
          engagement.engagementCode,
          engagement.client.clientCode,
          engagement.client.nameEn,
          engagement.client.nameZh,
        ].some((value) =>
          value?.trim().toLocaleLowerCase().startsWith(normalizedSearch)
        )
      )
      .slice(0, 8);
  }, [cmpEngagementSearchCode, cmpEngagements.data?.engagements]);
  const selectedCmpEngagement = useMemo(
    () =>
      (cmpEngagements.data?.engagements ?? []).find(
        (engagement) => engagement.id === projectForm.cmpEngagementId
      ),
    [cmpEngagements.data?.engagements, projectForm.cmpEngagementId]
  );
  const automaticEngagementMemberAssignments = useMemo(() => {
    const assignments = new Map<string, AutomaticProjectMemberAssignment>();
    if (
      editingProject ||
      projectForm.rollForwardFromProjectId ||
      !selectedCmpEngagement
    ) {
      return assignments;
    }
    if (selectedCmpEngagement.micUserId) {
      assignments.set(selectedCmpEngagement.micUserId, {
        projectRole: "REVIEWER",
        inChargeRole: "MANAGER_IN_CHARGE",
      });
    }
    if (selectedCmpEngagement.picUserId) {
      assignments.set(selectedCmpEngagement.picUserId, {
        projectRole: "PARTNER",
        inChargeRole: "PARTNER_IN_CHARGE",
      });
    }
    return assignments;
  }, [
    editingProject,
    projectForm.rollForwardFromProjectId,
    selectedCmpEngagement,
  ]);
  const canAccessSystemAdmin = canAccessAdmin(me.data);
  const canCreateProjects = me.data
    ? canGlobalRoleCreateProject(me.data.globalRole)
    : false;
  const canCreateInActiveFolder =
    canCreateProjects && !isArchivedDesktopFolder(activeFolder);
  const canManageProjectTemplates = canAccessSystemAdmin;
  const editingProjectMember = useMemo(
    () => getProjectMemberPermissionSubject(editingProject, me.data),
    [editingProject, me.data]
  );
  const canArchiveEditingProject = Boolean(
    editingProject?.status === "ACTIVE" &&
    canArchiveProject(editingProjectMember)
  );
  const canDeleteEditingProject = Boolean(
    editingProject?.status === "ACTIVE" &&
    canPerformProjectAction(editingProjectMember, "deleteProject")
  );
  const canEditEditingProject = Boolean(
    editingProject?.status === "ACTIVE" &&
    canPerformProjectAction(editingProjectMember, "updateProjectInfo")
  );
  const activeProjectMemberIds = useMemo(
    () =>
      new Set((editingProject?.members ?? []).map((member) => member.user.id)),
    [editingProject?.members]
  );
  const eligibleInvitees = useMemo(
    () =>
      (userDirectory.data ?? []).filter((user) => {
        if (user.id === me.data?.id) {
          return false;
        }
        return (
          activeProjectMemberIds.has(user.id) ||
          getProjectInvitationEligibility(user).canReceiveInvitation
        );
      }),
    [activeProjectMemberIds, me.data?.id, userDirectory.data]
  );
  const invitationInputs = useMemo(
    () =>
      eligibleInvitees
        .map((user) => {
          const invitedRole = selectedInvitations[user.id];
          if (activeProjectMemberIds.has(user.id)) {
            return null;
          }
          if (automaticEngagementMemberAssignments.has(user.id)) {
            return null;
          }
          if (!invitedRole) {
            return null;
          }
          return {
            recipientUserId: user.id,
            invitedRole,
            expiresInDays: DEFAULT_INVITATION_EXPIRY_DAYS,
          };
        })
        .filter((invitation): invitation is NonNullable<typeof invitation> =>
          Boolean(invitation)
        ),
    [
      activeProjectMemberIds,
      automaticEngagementMemberAssignments,
      eligibleInvitees,
      selectedInvitations,
    ]
  );

  useEffect(() => {
    const openTemplates = searchParams.get("templateLibrary") === "1";
    const openSmartForms = searchParams.get("smartForms") === "1";
    if (!openTemplates && !openSmartForms) {
      return;
    }
    if (me.isLoading) {
      return;
    }
    if (canManageProjectTemplates) {
      setDesktopMode(openSmartForms ? "smart-forms" : "templates");
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("templateLibrary");
    params.delete("smartForms");
    const query = params.toString();
    router.replace(
      `${localizedPath("/engagement")}${query ? `?${query}` : ""}`
    );
  }, [
    canManageProjectTemplates,
    localizedPath,
    me.isLoading,
    router,
    searchParams,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const savedSortPreferences = window.localStorage.getItem(
      SORT_PREFERENCES_STORAGE_KEY
    );
    if (savedSortPreferences) {
      setSortPreferences(parseSortPreferences(savedSortPreferences));
    }
    const savedHomeViewMode = window.localStorage.getItem(
      HOME_VIEW_MODE_STORAGE_KEY
    );
    if (isHomeViewMode(savedHomeViewMode)) {
      setHomeViewMode(savedHomeViewMode);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(HOME_VIEW_MODE_STORAGE_KEY, homeViewMode);
  }, [homeViewMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      DISPLAY_SETTINGS_STORAGE_KEY,
      JSON.stringify(displaySettings)
    );
  }, [displaySettings]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      SORT_PREFERENCES_STORAGE_KEY,
      JSON.stringify(sortPreferences)
    );
  }, [sortPreferences]);

  useEffect(() => {
    if (folders.length === 0) {
      return;
    }
    setSelectedFolderId((currentFolderId) => {
      const mobileRequestedFolder = searchParams.get("folderId");
      if (
        isMobile &&
        folders.some((folder) => folder.id === mobileRequestedFolder)
      ) {
        return mobileRequestedFolder;
      }
      if (folders.some((folder) => folder.id === currentFolderId)) {
        return currentFolderId;
      }
      const requestedFolderId = searchParams.get("folderId");
      if (folders.some((folder) => folder.id === requestedFolderId)) {
        return requestedFolderId;
      }
      return folders.find((folder) => folder.isDefault)?.id ?? folders[0].id;
    });
  }, [folders, searchParams, isMobile]);

  useLayoutEffect(() => {
    const group = homeNavigationGroupElementRef.current;
    if (!group) {
      return;
    }
    // Restoring a cached route is layout initialization, not a panel toggle.
    group.dataset.restoringLayout = "true";
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        delete group.dataset.restoringLayout;
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      delete group.dataset.restoringLayout;
    };
  }, []);

  useEffect(() => {
    if (desktopMode !== "home") {
      navigationPanelRef.current?.resize(0);
    }
  }, [desktopMode]);

  useEffect(() => {
    if (
      desktopMode !== "home" ||
      window.matchMedia("(max-width: 767px)").matches ||
      isHomeNavigationCollapsed ||
      homeNavigationUserResizedRef.current
    ) {
      return;
    }

    navigationPanelRef.current?.resize(homeNavigationPreferredWidth);
    homeNavigationLastWidthRef.current = homeNavigationPreferredWidth;
    setHomeNavigationLastWidth(homeNavigationPreferredWidth);
  }, [desktopMode, homeNavigationPreferredWidth, isHomeNavigationCollapsed]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    let restoreFrame: number | undefined;
    const restoreDesktopWidth = () => {
      if (restoreFrame !== undefined) {
        window.cancelAnimationFrame(restoreFrame);
      }
      if (desktopMode !== "home") {
        return;
      }
      if (media.matches) {
        homeNavigationResponsiveCollapsedRef.current = true;
        navigationPanelRef.current?.collapse();
        return;
      }
      if (isHomeNavigationCollapsed) {
        homeNavigationResponsiveCollapsedRef.current = false;
        return;
      }
      const width = homeNavigationUserResizedRef.current
        ? homeNavigationLastWidthRef.current
        : homeNavigationPreferredWidth;
      // The panel library measures its Group after a viewport change. Restore
      // on the next frame so its resize observer cannot overwrite our width.
      restoreFrame = window.requestAnimationFrame(() => {
        if (media.matches) {
          return;
        }
        navigationPanelRef.current?.expand();
        navigationPanelRef.current?.resize(width);
      });
    };
    restoreDesktopWidth();
    const observer = new ResizeObserver(restoreDesktopWidth);
    if (homeNavigationGroupElementRef.current) {
      observer.observe(homeNavigationGroupElementRef.current);
    }
    media.addEventListener("change", restoreDesktopWidth);
    return () => {
      media.removeEventListener("change", restoreDesktopWidth);
      observer.disconnect();
      if (restoreFrame !== undefined) {
        window.cancelAnimationFrame(restoreFrame);
      }
    };
  }, [desktopMode, homeNavigationPreferredWidth, isHomeNavigationCollapsed]);

  useEffect(() => {
    if (desktopMode !== "home" && !canManageProjectTemplates) {
      setDesktopMode("home");
    }
  }, [canManageProjectTemplates, desktopMode]);

  useEffect(() => {
    if (!desktop.data) {
      return;
    }
    setHiddenProjectIds(new Set());
    setPositions(() => {
      const next: Record<string, DesktopPosition> = {};
      for (const placement of desktop.data.placements) {
        next[placement.projectId] = {
          x: placement.desktopX,
          y: placement.desktopY,
        };
      }
      return next;
    });
  }, [desktop.data]);

  useEffect(() => {
    if (
      createMode !== "project" ||
      editingProject ||
      projectForm.rollForwardFromProjectId ||
      !selectedCmpEngagement ||
      lastAppliedCmpEngagementIdRef.current === selectedCmpEngagement.id
    ) {
      return;
    }
    lastAppliedCmpEngagementIdRef.current = selectedCmpEngagement.id;
    setProjectForm((current) => {
      const reportDate = selectedCmpEngagement.reportDate ?? current.reportDate;
      return {
        ...current,
        name: selectedCmpEngagement.engagementCode,
        cmpClientId: selectedCmpEngagement.clientId,
        cmpEngagementId: selectedCmpEngagement.id,
        cmpEngagementCode: selectedCmpEngagement.engagementCode,
        cmpClientName: `${selectedCmpEngagement.client.clientCode} - ${
          selectedCmpEngagement.client.nameEn ||
          selectedCmpEngagement.client.nameZh
        }`,
        cmpEngagementName: selectedCmpEngagement.engagementCode,
        yearEndDate: selectedCmpEngagement.yearEndDate ?? current.yearEndDate,
        reportDate,
        archiveDeadline:
          selectedCmpEngagement.reportDate && reportDate
            ? (addDaysIsoDate(reportDate, DEFAULT_ARCHIVE_DEADLINE_DAYS) ??
              current.archiveDeadline)
            : current.archiveDeadline,
      };
    });
  }, [
    createMode,
    editingProject,
    projectForm.rollForwardFromProjectId,
    selectedCmpEngagement,
  ]);

  useEffect(() => {
    if (!projectForm.projectTemplateId) {
      return;
    }
    if (!projectTemplates.data) {
      return;
    }
    if (
      !projectTemplates.data.some(
        (template) => template.id === projectForm.projectTemplateId
      )
    ) {
      setProjectForm((current) => ({
        ...current,
        projectTemplateId: "",
        projectTemplateName: "",
      }));
    }
  }, [projectForm.projectTemplateId, projectTemplates.data]);

  const updatePlacement = useMutation({
    mutationFn: ({
      folderId,
      lastOpened,
      placement,
      position,
    }: {
      folderId?: string;
      lastOpened?: boolean;
      placement: DesktopProjectPlacement;
      position: DesktopPosition;
    }) =>
      api.updateDesktopProjectPlacement(placement.project.id, {
        ...(folderId ? { folderId } : {}),
        desktopX: position.x,
        desktopY: position.y,
        ...(lastOpened ? { lastOpened } : {}),
      }),
    onSuccess: async (_placement, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["desktop"] });
      setHiddenProjectIds((current) => {
        const next = new Set(current);
        next.delete(variables.placement.projectId);
        return next;
      });
    },
    onError: (_error, variables) => {
      setHiddenProjectIds((current) => {
        const next = new Set(current);
        next.delete(variables.placement.projectId);
        return next;
      });
      toast({
        title: desktopCopy.errors?.savePosition ?? "Position was not saved",
        variant: "destructive",
      });
    },
  });
  const applyDesktopSort = useMutation({
    mutationFn: async ({
      folderId,
      preference,
      placementsToSort,
    }: {
      folderId: string;
      preference: DesktopSortPreference;
      placementsToSort: DesktopProjectPlacement[];
    }) => {
      const sortedPlacements = sortPlacements(placementsToSort, preference);
      await api.reorderDesktopProjectPlacements(folderId, {
        placements: sortedPlacements.map((placement, index) => {
          const position = getDefaultIconPosition(index);
          return {
            projectId: placement.projectId,
            sortOrder: index,
            desktopX: position.x,
            desktopY: position.y,
          };
        }),
      });
      return { folderId, preference, sortedPlacements };
    },
    onMutate: ({ folderId, preference, placementsToSort }) => {
      const previousSortPreferences = sortPreferences;
      const previousPositions = positions;
      const sortedPlacements = sortPlacements(placementsToSort, preference);
      const nextPositions = { ...positions };
      sortedPlacements.forEach((placement, index) => {
        nextPositions[placement.projectId] = getDefaultIconPosition(index);
      });
      setSortPreferences((current) => ({
        ...current,
        [folderId]: preference,
      }));
      setPositions(nextPositions);
      return { previousPositions, previousSortPreferences };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["desktop"] });
    },
    onError: (_error, _variables, context) => {
      if (context) {
        setPositions(context.previousPositions);
        setSortPreferences(context.previousSortPreferences);
      }
      toast({
        title:
          desktopCopy.errors?.savePosition ??
          "The desktop order could not be saved",
        variant: "destructive",
      });
    },
  });
  const reorderIconProjects = useMutation({
    mutationFn: async ({
      folderId,
      placementUpdates,
    }: {
      folderId: string;
      placementUpdates: ProjectGridPlacementUpdate<DesktopProjectPlacement>[];
    }) => {
      await api.reorderDesktopProjectPlacements(folderId, {
        placements: placementUpdates.map(
          ({ placement, position, sortOrder }) => ({
            desktopX: position.x,
            desktopY: position.y,
            projectId: placement.projectId,
            sortOrder,
          })
        ),
      });
    },
    onMutate: ({ folderId, placementUpdates }) => {
      const previousDetailPositions = detailPositions;
      const previousPositions = positions;
      const previousSortPreferences = sortPreferences;
      const nextPositions = { ...positions };
      placementUpdates.forEach(({ placement, position }) => {
        nextPositions[placement.projectId] = position;
      });
      const orderedPlacements = [...placementUpdates]
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map(({ placement }) => placement);
      setPositions(nextPositions);
      setDetailPositions((current) => ({
        ...current,
        ...buildDetailPositions(orderedPlacements, displaySettings.density),
      }));
      setSortPreferences((current) => {
        const next = { ...current };
        Reflect.deleteProperty(next, folderId);
        return next;
      });
      return {
        previousDetailPositions,
        previousPositions,
        previousSortPreferences,
      };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["desktop"] });
    },
    onError: (_error, _variables, context) => {
      if (context) {
        setDetailPositions(context.previousDetailPositions);
        setPositions(context.previousPositions);
        setSortPreferences(context.previousSortPreferences);
      }
      toast({
        title:
          desktopCopy.errors?.savePosition ??
          "The desktop order could not be saved",
        variant: "destructive",
      });
    },
  });
  const createFolder = useMutation({
    mutationFn: () => api.createDesktopFolder({ name: folderName.trim() }),
    onSuccess: () => {
      setFolderName("");
      setEditingFolder(null);
      setCreateMode(null);
      void queryClient.invalidateQueries({ queryKey: ["desktop"] });
    },
  });
  const renameFolder = useMutation({
    mutationFn: () => {
      if (!editingFolder) {
        throw new Error("Folder is required");
      }
      return api.updateDesktopFolder(editingFolder.id, {
        name: folderName.trim(),
      });
    },
    onSuccess: () => {
      setFolderName("");
      setEditingFolder(null);
      setCreateMode(null);
      void queryClient.invalidateQueries({ queryKey: ["desktop"] });
    },
    onError: () => {
      toast({
        title:
          desktopCopy.folderMenu?.actionFailed ??
          "The folder could not be updated",
        variant: "destructive",
      });
    },
  });
  const deleteFolder = useMutation({
    mutationFn: (folder: DesktopFolder) => api.deleteDesktopFolder(folder.id),
    onSuccess: async ({ id }) => {
      setDeleteFolderCandidate(null);
      if (selectedFolderId === id) {
        setSelectedFolderId(
          folders.find((folder) => folder.isDefault)?.id ?? null
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["desktop"] });
    },
    onError: () => {
      toast({
        title:
          desktopCopy.folderMenu?.actionFailed ??
          "The folder could not be deleted",
        variant: "destructive",
      });
    },
  });
  const createProject = useMutation({
    mutationFn: (data: NonNullable<typeof reviewData>) => {
      const input: CreateProjectInput = {
        name: data.name.trim(),
        ...(data.projectCode.trim()
          ? { projectCode: data.projectCode.trim() }
          : {}),
        language: data.language,
        frameworkTemplateId: data.frameworkTemplateId,
        ...(data.projectTemplateId
          ? { projectTemplateId: data.projectTemplateId }
          : {}),
        ...(activeFolderId ? { folderId: activeFolderId } : {}),
        yearEndDate: data.yearEndDate,
        reportDate: data.reportDate,
        archiveDeadline: data.archiveDeadline,
        notes: data.notes,
        ...(data.rollForwardFromProjectId
          ? {
              rollForwardFromProjectId: data.rollForwardFromProjectId,
              inheritMembers: data.inheritMembers,
            }
          : data.cmpClientId && data.cmpEngagementId
            ? {
                cmpClientId: data.cmpClientId,
                cmpEngagementId: data.cmpEngagementId,
              }
            : {}),
        ...(data.invitations?.length ? { invitations: data.invitations } : {}),
      };
      return api.createProject(input);
    },
    onSuccess: () => {
      setCreateMode(null);
      setReviewData(null);
      setIsEngagementLinkSkipped(false);
      setProjectForm((current) => ({
        ...current,
        cmpClientId: "",
        cmpEngagementId: "",
        cmpEngagementCode: "",
        cmpClientName: "",
        cmpEngagementName: "",
        name: "",
        projectCode: "",
        rollForwardFromProjectId: "",
        rollForwardSourceName: "",
        inheritMembers: true,
      }));
      setSelectedInvitations({});
      setInvitationRoleChoices({});
      void queryClient.invalidateQueries({ queryKey: ["desktop"] });
    },
  });
  const updateProject = useMutation({
    mutationFn: ({
      projectId,
      data,
      invitations,
    }: {
      projectId: string;
      data: UpdateProjectInput;
      invitations: CreateInvitationInput[];
    }) =>
      api.updateProject(projectId, data).then(async (project) => {
        await Promise.all(
          invitations.map((invitation) =>
            api.createInvitation(projectId, invitation)
          )
        );
        return project;
      }),
    onSuccess: async (project) => {
      setEditingProject(project);
      setSelectedInvitations({});
      await queryClient.invalidateQueries({ queryKey: ["desktop"] });
    },
  });
  const linkProjectEngagement = useMutation({
    mutationFn: ({
      projectId,
      input,
    }: {
      projectId: string;
      input: LinkProjectEngagementInput;
    }) => api.linkProjectEngagement(projectId, input),
    onSuccess: async (project, variables) => {
      const engagement =
        cmpEngagements.data?.engagements.find(
          (item) => item.id === variables.input.cmpEngagementId
        ) ?? null;
      setEditingProject(project);
      setProjectForm((current) => ({
        ...current,
        projectCode: project.projectCode,
        cmpClientId: variables.input.cmpClientId,
        cmpEngagementId: variables.input.cmpEngagementId,
        cmpEngagementCode: engagement?.engagementCode ?? "",
        cmpClientName: engagement
          ? `${engagement.client.clientCode} - ${engagement.client.nameEn || engagement.client.nameZh}`
          : current.cmpClientName,
        cmpEngagementName: engagement?.engagementCode ?? "",
      }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["desktop"] }),
        queryClient.invalidateQueries({ queryKey: ["work-items"] }),
      ]);
    },
  });
  useEffect(() => {
    if (!editingProject) {
      return;
    }
    const data: UpdateProjectInput = {
      name: projectForm.name.trim(),
      projectCode: projectForm.projectCode.trim(),
      yearEndDate: projectForm.yearEndDate,
      reportDate: projectForm.reportDate,
      archiveDeadline: projectForm.archiveDeadline,
      notes: projectForm.notes,
    };
    const dirty =
      data.name !== (editingProject.name ?? "") ||
      data.projectCode !== (editingProject.projectCode ?? "") ||
      data.yearEndDate !==
        toDateInputValue(
          editingProject.yearEndDate ?? editingProject.reportingDate
        ) ||
      data.reportDate !== toDateInputValue(editingProject.reportDate) ||
      data.archiveDeadline !==
        toDateInputValue(editingProject.archiveDeadline) ||
      data.notes !== (editingProject.notes ?? "") ||
      invitationInputs.length > 0;
    if (!dirty || !data.name || !data.projectCode) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      updateProject.mutate({
        projectId: editingProject.id,
        data,
        invitations: invitationInputs,
      });
    }, 400);
    return () => window.clearTimeout(timeoutId);
  }, [
    editingProject,
    invitationInputs,
    projectForm.archiveDeadline,
    projectForm.name,
    projectForm.notes,
    projectForm.projectCode,
    projectForm.reportDate,
    projectForm.yearEndDate,
    updateProject,
  ]);
  const archiveEditedProject = useMutation({
    mutationFn: (project: Project) => api.archiveProject(project.id),
    onSuccess: async () => {
      setEditingProject(null);
      setCreateMode(null);
      await queryClient.invalidateQueries({ queryKey: ["desktop"] });
    },
  });
  const deleteEditedProject = useMutation({
    mutationFn: (project: Project) => api.deleteProject(project.id),
    onSuccess: async () => {
      setDeleteProjectCandidate(null);
      setEditingProject(null);
      setCreateMode(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["desktop"] }),
        queryClient.invalidateQueries({ queryKey: ["projects", "deleted"] }),
      ]);
    },
  });
  const restoreDeletedProjects = useMutation({
    mutationFn: (projectIds: string[]) =>
      Promise.all(projectIds.map((projectId) => api.restoreProject(projectId))),
    onSuccess: async () => {
      setSelectedDeletedProjectIds([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["desktop"] }),
        queryClient.invalidateQueries({ queryKey: ["projects", "deleted"] }),
      ]);
    },
  });
  const markInboxRead = useMutation({
    mutationFn: api.markInboxRead,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["inbox", me.data?.id] }),
  });
  const markInboxUnread = useMutation({
    mutationFn: api.markInboxUnread,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["inbox", me.data?.id] }),
  });
  const searchResults = useMemo(
    () =>
      buildSearchResults({
        folders,
        placements,
        query: searchQuery,
        labels: {
          folder: desktopCopy.folderKind,
          project: desktopCopy.projectKind,
        },
      }),
    [
      desktopCopy.folderKind,
      desktopCopy.projectKind,
      folders,
      placements,
      searchQuery,
    ]
  );
  const groupedHomeSearchResults = useMemo(
    () =>
      [
        {
          group: desktopCopy.folderKind,
          items: searchResults.filter((result) => result.kind === "folder"),
        },
        {
          group: desktopCopy.projectKind,
          items: searchResults.filter((result) => result.kind === "project"),
        },
      ].filter((group) => group.items.length > 0),
    [desktopCopy.folderKind, desktopCopy.projectKind, searchResults]
  );
  const placementByProjectId = useMemo(
    () =>
      new Map(placements.map((placement) => [placement.projectId, placement])),
    [placements]
  );
  const activeDragPlacement = drag
    ? placementByProjectId.get(drag.projectId)
    : null;
  const resolveDetailPosition = (placement: DesktopProjectPlacement) =>
    detailPositions[placement.projectId] ??
    getDefaultDetailRowPosition(
      Math.max(
        0,
        activePlacements.findIndex(
          (item) => item.projectId === placement.projectId
        )
      ),
      displaySettings.density
    );
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );
  const folderCollisionDetection = useCallback<CollisionDetection>((args) => {
    const folderCollisions = pointerWithin(args).filter((collision) =>
      isFolderDroppableId(collision.id)
    );
    if (folderCollisions.length > 0) {
      return folderCollisions;
    }
    if (!args.pointerCoordinates) {
      return [];
    }
    const folderId = getFolderFromBounds(
      args.pointerCoordinates.x,
      args.pointerCoordinates.y
    );
    return folderId ? [{ id: getFolderDroppableId(folderId) }] : [];
  }, []);
  const setDragState = (next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  };
  const toggleInitialInvitation = (user: User) => {
    setSelectedInvitations((current) => {
      const next = { ...current };
      if (next[user.id]) {
        Reflect.deleteProperty(next, user.id);
        return next;
      }
      const role =
        invitationRoleChoices[user.id] ?? getDefaultInvitationRole(user);
      if (role) {
        next[user.id] = role;
      }
      return next;
    });
  };
  const updateInitialInvitationRole = (user: User, role: ProjectRole) => {
    setInvitationRoleChoices((current) => ({ ...current, [user.id]: role }));
    setSelectedInvitations((current) =>
      current[user.id] ? { ...current, [user.id]: role } : current
    );
  };
  const resetProjectDialog = () => {
    setProjectDialogStep(1);
    setIsEngagementLinkSkipped(false);
    setEditingProject(null);
    setDeleteProjectCandidate(null);
    setSelectedInvitations({});
    setInvitationRoleChoices({});
    setMemberSearchQuery("");
  };
  const closeProjectDialog = () => {
    setCreateMode(null);
    if (projectDialogCleanupTimerRef.current !== null) {
      window.clearTimeout(projectDialogCleanupTimerRef.current);
    }
    projectDialogCleanupTimerRef.current = window.setTimeout(() => {
      resetProjectDialog();
      projectDialogCleanupTimerRef.current = null;
    }, PROJECT_DIALOG_EXIT_DURATION_MS);
  };
  const getProjectHref = useCallback(
    (projectId: string, folderId = activeFolderId) => {
      const returnTo = `/engagement${
        folderId ? `?folderId=${encodeURIComponent(folderId)}` : ""
      }`;
      return localizedPath(
        `/engagement/${projectId}?returnTo=${encodeURIComponent(returnTo)}`
      );
    },
    [activeFolderId, localizedPath]
  );
  const prefetchProject = useCallback(
    (projectId: string) => router.prefetch(getProjectHref(projectId)),
    [getProjectHref, router]
  );
  const openProjectCreator = () => {
    if (!canCreateInActiveFolder) {
      return;
    }
    const creationParams = new URLSearchParams({
      attempt: String(Date.now()),
      ...(activeFolderId ? { folderId: activeFolderId } : {}),
    });
    router.push(
      `${localizedPath("/engagement/new")}?${creationParams.toString()}`
    );
  };
  const openFolderCreator = () => {
    setEditingFolder(null);
    setFolderName("");
    setCreateMode("folder");
  };
  const openFolderRenamer = (folder: DesktopFolder) => {
    if (isProtectedDesktopFolder(folder)) {
      return;
    }
    setEditingFolder(folder);
    setFolderName(folder.name);
    setCreateMode("folder");
  };
  const closeFolderDialog = () => {
    setCreateMode(null);
    setEditingFolder(null);
    setFolderName("");
  };
  const openProjectEditor = (project: Project) => {
    if (projectDialogCleanupTimerRef.current !== null) {
      window.clearTimeout(projectDialogCleanupTimerRef.current);
      projectDialogCleanupTimerRef.current = null;
    }
    lastAppliedCmpEngagementIdRef.current = null;
    setReviewData(null);
    setDeleteProjectCandidate(null);
    setSelectedInvitations({});
    setInvitationRoleChoices({});
    setMemberSearchQuery("");
    setProjectDialogStep(2);
    setIsEngagementLinkSkipped(false);
    setEditingProject(project);
    setProjectForm({
      cmpClientId: "",
      cmpEngagementId: "",
      cmpEngagementCode: "",
      cmpClientName: "",
      cmpEngagementName: "",
      name: project.name ?? "",
      projectCode: project.projectCode ?? "",
      language: project.language ?? "zh-CN",
      frameworkTemplateId: project.frameworkTemplateId ?? "",
      frameworkTemplateInput: project.frameworkTemplate
        ? formatFrameworkTemplateInput(project.frameworkTemplate)
        : (project.frameworkTemplateId ?? ""),
      projectTemplateId: "",
      projectTemplateName: "",
      rollForwardFromProjectId: "",
      rollForwardSourceName: "",
      inheritMembers: true,
      yearEndDate: toDateInputValue(
        project.yearEndDate ?? project.reportingDate
      ),
      reportDate: toDateInputValue(project.reportDate),
      archiveDeadline: toDateInputValue(project.archiveDeadline),
      notes: project.notes ?? "",
    });
    setCreateMode("project");
  };
  const openProject = (projectId: string) => {
    if (suppressClickProjectId.current === projectId) {
      suppressClickProjectId.current = null;
      return;
    }
    const placement = placementByProjectId.get(projectId);
    if (placement) {
      updatePlacement.mutate({
        folderId: placement.folderId,
        placement,
        position: resolvePosition(placement, positions),
        lastOpened: true,
      });
    }
    router.push(getProjectHref(projectId, placement?.folderId));
  };
  const openInboxMessage = (message: InboxMessage) => {
    if (!message.readAt) {
      markInboxRead.mutate(message.id);
    }
    setActivityPanelOpen(false);
    if (message.actionUrl) {
      router.push(resolveInboxActionHref(message.actionUrl, localizedPath));
      return;
    }
    const projectId = getInboxMessageProjectId(message);
    if (projectId) {
      void openProject(projectId);
    }
  };
  const toggleInboxMessageReadState = (message: InboxMessage) => {
    if (message.readAt) {
      markInboxUnread.mutate(message.id);
      return;
    }
    markInboxRead.mutate(message.id);
  };
  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  };
  const handleSortSelect = (preference: DesktopSortPreference) => {
    if (!activeFolderId) {
      setContextMenu(null);
      return;
    }
    setContextMenu(null);
    applyDesktopSort.mutate({
      folderId: activeFolderId,
      preference,
      placementsToSort: folderPlacements,
    });
  };
  const handleSortDirectionChange = (direction: DesktopSortDirection) => {
    if (!activeFolderId) {
      setContextMenu(null);
      return;
    }
    handleSortSelect({
      field: activeSortPreference?.field ?? "name",
      direction,
    });
  };
  const updateDisplaySetting = <T extends keyof DesktopDisplaySettings>(
    key: T,
    value: DesktopDisplaySettings[T]
  ) => {
    setDisplaySettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  function handleNavigationPanelResize(panelSize: PanelSize) {
    if (window.matchMedia("(max-width: 767px)").matches) {
      return;
    }
    if (homeNavigationResponsiveCollapsedRef.current) {
      if (panelSize.inPixels <= HOME_NAV_COLLAPSED_THRESHOLD) {
        return;
      }
      homeNavigationResponsiveCollapsedRef.current = false;
    }
    const collapsed =
      panelSize.asPercentage <= 0.5 ||
      panelSize.inPixels <= HOME_NAV_COLLAPSED_THRESHOLD;
    // Measurements (including the initial zero-size layout) are not user
    // intent. Toggle/drag handlers own the user's collapsed preference.
    if (!collapsed) {
      homeNavigationLastWidthRef.current = panelSize.inPixels;
      setHomeNavigationLastWidth(panelSize.inPixels);
    }
  }

  function setHomeNavigationOpen(open: boolean) {
    if (open) {
      const width = homeNavigationUserResizedRef.current
        ? homeNavigationLastWidthRef.current
        : homeNavigationPreferredWidth;
      navigationPanelRef.current?.expand();
      navigationPanelRef.current?.resize(width);
      setIsHomeNavigationCollapsed(false);
      return;
    }

    navigationPanelRef.current?.collapse();
    setIsHomeNavigationCollapsed(true);
  }

  function handleHomeNavigationResizeStart() {
    homeNavigationUserResizedRef.current = true;
    homeNavigationResizeStartCollapsedRef.current = isHomeNavigationCollapsed;
    homeNavigationResizeStartWidthRef.current = isHomeNavigationCollapsed
      ? 0
      : homeNavigationLastWidthRef.current || homeNavigationPreferredWidth;
  }

  function handleHomeNavigationResize(deltaX: number) {
    const startWidth = homeNavigationResizeStartWidthRef.current;
    const startCollapsed = homeNavigationResizeStartCollapsedRef.current;
    const nextWidth = startWidth + deltaX;

    if (startCollapsed && nextWidth < HOME_NAV_DRAG_EXPAND_THRESHOLD) {
      navigationPanelRef.current?.collapse();
      setIsHomeNavigationCollapsed(true);
      return;
    }

    if (!startCollapsed && nextWidth < HOME_NAV_DRAG_COLLAPSE_THRESHOLD) {
      navigationPanelRef.current?.collapse();
      setIsHomeNavigationCollapsed(true);
      return;
    }

    const width = Math.min(
      HOME_NAV_MAX_WIDTH,
      Math.max(HOME_NAV_MIN_WIDTH, nextWidth)
    );
    navigationPanelRef.current?.expand();
    navigationPanelRef.current?.resize(width);
    homeNavigationLastWidthRef.current = width;
    setHomeNavigationLastWidth(width);
    setIsHomeNavigationCollapsed(false);
  }

  function handleHomeNavigationResizeCancel() {
    if (homeNavigationResizeStartCollapsedRef.current) {
      navigationPanelRef.current?.collapse();
      setIsHomeNavigationCollapsed(true);
      return;
    }

    const width = homeNavigationResizeStartWidthRef.current;
    navigationPanelRef.current?.expand();
    navigationPanelRef.current?.resize(width);
    homeNavigationLastWidthRef.current = width;
    setHomeNavigationLastWidth(width);
    setIsHomeNavigationCollapsed(false);
  }

  const movePlacementToFolder = (
    placement: DesktopProjectPlacement,
    targetFolderId: string
  ) => {
    if (targetFolderId === placement.folderId) {
      return;
    }
    const canvasBounds = getCanvasBounds(canvasRef.current);
    const occupiedPositions = placements
      .filter(
        (item) =>
          item.projectId !== placement.projectId &&
          item.folderId === targetFolderId
      )
      .map((item) => resolvePosition(item, positions));
    const finalPosition = findNextAvailableDesktopPosition({
      bounds: canvasBounds,
      desired: getDefaultIconPosition(0),
      occupied: occupiedPositions,
    });
    setHiddenProjectIds(
      (current) => new Set([...current, placement.projectId])
    );
    setPositions((current) => ({
      ...current,
      [placement.projectId]: finalPosition,
    }));
    suppressClickProjectId.current = placement.projectId;
    window.setTimeout(() => {
      if (suppressClickProjectId.current === placement.projectId) {
        suppressClickProjectId.current = null;
      }
    }, 200);
    updatePlacement.mutate({
      folderId: targetFolderId,
      placement,
      position: finalPosition,
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const placement = placementByProjectId.get(String(event.active.id));
    if (!placement) {
      return;
    }
    const position =
      homeViewMode === "list"
        ? resolveDetailPosition(placement)
        : snapForCanvas(
            resolvePosition(placement, positions),
            canvasRef.current
          );
    setDropTargetFolderId(null);
    setDragState({
      projectId: placement.projectId,
      origin: position,
      moved: true,
    });
  };
  const handleDragMove = (event: DragMoveEvent) => {
    const { current } = dragRef;
    if (!current || current.projectId !== String(event.active.id)) {
      return;
    }
    const next = current.moved ? current : { ...current, moved: true };
    setDragState(next);
    setDropTargetFolderId(getFolderIdFromDroppableId(event.over?.id));
  };
  const handleDragOver = (event: DragOverEvent) => {
    setDropTargetFolderId(getFolderIdFromDroppableId(event.over?.id));
  };
  const handleDragEnd = (event: DragEndEvent) => {
    const { current } = dragRef;
    const placement = placementByProjectId.get(String(event.active.id));
    if (!current || !placement || current.projectId !== placement.projectId) {
      setDragState(null);
      setDropTargetFolderId(null);
      return;
    }
    const releasedAfterMove =
      current.moved || Math.abs(event.delta.x) + Math.abs(event.delta.y) > 0;
    const targetFolderId =
      getFolderIdFromDroppableId(event.over?.id) ??
      getFolderIdFromDragEvent(event) ??
      dropTargetFolderId;
    const canvasBounds = getCanvasBounds(canvasRef.current);
    const desiredPosition = snapDesktopPosition(
      {
        x: current.origin.x + event.delta.x,
        y: current.origin.y + event.delta.y,
      },
      canvasBounds
    );
    const shouldSave = releasedAfterMove;
    if (targetFolderId) {
      setDragState(null);
      setDropTargetFolderId(null);
      if (shouldSave) {
        movePlacementToFolder(placement, targetFolderId);
      }
      return;
    }
    if (homeViewMode === "list" && !targetFolderId) {
      const orderedPlacements = orderDetailPlacements(
        activePlacements,
        detailPositions,
        displaySettings.density
      );
      const fromIndex = orderedPlacements.findIndex(
        (item) => item.projectId === placement.projectId
      );
      const targetIndex = getDetailRowIndexFromPosition(
        desiredPosition,
        orderedPlacements.length,
        displaySettings.density
      );
      const nextOrder =
        fromIndex === -1
          ? orderedPlacements
          : moveDetailPlacement(orderedPlacements, fromIndex, targetIndex);
      const nextDetailPositions = buildDetailPositions(
        nextOrder,
        displaySettings.density
      );
      const finalPosition =
        nextDetailPositions[placement.projectId] ??
        getDefaultDetailRowPosition(targetIndex, displaySettings.density);

      setDragState(null);
      setDropTargetFolderId(null);
      if (shouldSave) {
        suppressClickProjectId.current = placement.projectId;
        window.setTimeout(() => {
          if (suppressClickProjectId.current === placement.projectId) {
            suppressClickProjectId.current = null;
          }
        }, 200);
        setPositions((previousPositions) => ({
          ...previousPositions,
          [placement.projectId]: finalPosition,
        }));
        setDetailPositions((previousDetailPositions) => ({
          ...previousDetailPositions,
          ...nextDetailPositions,
        }));
        updatePlacement.mutate({
          folderId: undefined,
          placement,
          position: finalPosition,
        });
      }
      return;
    }
    const occupiedPositions = placements
      .filter(
        (item) =>
          item.projectId !== placement.projectId &&
          item.folderId === (activeFolderId ?? placement.folderId)
      )
      .map((item) => resolvePosition(item, positions));
    const finalPosition = findNextAvailableDesktopPosition({
      bounds: canvasBounds,
      desired: desiredPosition,
      occupied: occupiedPositions,
    });
    setDragState(null);
    setDropTargetFolderId(null);
    if (shouldSave) {
      suppressClickProjectId.current = placement.projectId;
      window.setTimeout(() => {
        if (suppressClickProjectId.current === placement.projectId) {
          suppressClickProjectId.current = null;
        }
      }, 200);
      setPositions((previousPositions) => ({
        ...previousPositions,
        [placement.projectId]: finalPosition,
      }));
      updatePlacement.mutate({
        folderId: undefined,
        placement,
        position: finalPosition,
      });
    }
  };
  const handleDragCancel = () => {
    setDragState(null);
    setDropTargetFolderId(null);
  };
  const desktopNavigationWidth =
    desktopMode === "home" ? getHomeNavigationWidth(folders, desktopCopy) : 0;
  const isDesktopNavigationCollapsed =
    desktopMode === "home" ? isHomeNavigationCollapsed : true;
  const isEditingProject = Boolean(editingProject);
  const isProjectRecycleBinWorkspace =
    projectRecycleBinOpen && !desktopSettingsOpen;
  const isHomeFolderPanel =
    desktopMode === "home" && !isProjectRecycleBinWorkspace;
  const projectDialogTitle = isEditingProject
    ? (desktopCopy.createProject.editTitle ?? "Edit project")
    : desktopCopy.createProject.title;
  const mobileHome = isMobile && isHomeFolderPanel;

  const mobileFolderId = folders.some(
    (folder) => folder.id === searchParams.get("folderId")
  )
    ? searchParams.get("folderId")
    : null;
  const mobileFolder = folders.find((folder) => folder.id === mobileFolderId);
  return (
    <div className="project-home-shell flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <EmpRouteTopBar
        centerOnMobile={mobileHome}
        centerPriority
        className="emp-project-home-top-bar"
        leading={
          mobileHome ? (
            <div className="flex min-w-0 items-center gap-2">
              <ProjectWingTopBarReturnAction
                label={mobileCopy.back}
                onClick={() => {
                  setSearchQuery("");
                  if (mobileFolder) {
                    router.push(localizedPath("/engagement"));
                  } else {
                    window.location.assign(getIntranetPortalUrl());
                  }
                }}
              />
              <EmpPortalAction />
              <h1 className="min-w-0 truncate text-lg font-semibold">
                {mobileFolder
                  ? getDesktopFolderLabel(mobileFolder, desktopCopy)
                  : mobileCopy.folders}
              </h1>
            </div>
          ) : (
            <div className="project-wing-top-bar-context">
              <ProjectWingTopBarBrand />
              {actionHistory.returnTarget ? (
                <ProjectWingTopBarReturnAction
                  label={`${dictionary.common.backTo ?? "Back to"} ${getEmpActionLabel(actionHistory.returnTarget.id, dictionary)}`}
                  onClick={() =>
                    actionHistory.returnToPrevious((entry) =>
                      router.push(entry.href)
                    )
                  }
                />
              ) : (
                <ProjectWingTopBarReturnAction
                  label={`${dictionary.common.backTo ?? "Back to"} Intranet`}
                  onClick={() => window.location.assign(getIntranetPortalUrl())}
                />
              )}
              <EmpPortalAction />
            </div>
          )
        }
        center={
          mobileHome ? undefined : (
            <div
              ref={homeSearchContainerRef}
              className="relative hidden w-full min-w-0 justify-self-center md:block"
            >
              <Autocomplete
                filter={null}
                itemToStringValue={(item: unknown) =>
                  (item as { title: string }).title
                }
                items={groupedHomeSearchResults}
                onOpenChange={setIsHomeSearchActive}
                onValueChange={(nextValue, details) => {
                  if (details.reason !== "item-press") {
                    setIsHomeSearchActive(true);
                    setSearchQuery(nextValue);
                  }
                }}
                open={Boolean(searchQuery.trim()) && isHomeSearchActive}
                value={searchQuery}
              >
                <EmpHomeSearchShell
                  ref={homeSearchShellRef}
                  className="project-wing-top-bar-search relative z-10 data-[open=true]:bg-card data-[open=true]:!shadow-md"
                  data-open={Boolean(searchQuery.trim()) && isHomeSearchActive}
                  data-top-bar-search=""
                  role="group"
                >
                  <span
                    aria-hidden="true"
                    className="project-wing-top-bar-search-icon"
                  >
                    <Search />
                  </span>
                  <AutocompleteInput
                    aria-label={desktopCopy.searchPlaceholder}
                    placeholder={desktopCopy.searchPlaceholder}
                    clearLabel={desktopCopy.clearSearch}
                    className="h-full rounded-full border-0 bg-transparent px-2.5 shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
                    containerClassName="h-full min-w-0 flex-1"
                    onFocus={() => setIsHomeSearchActive(true)}
                    showClear
                  />
                </EmpHomeSearchShell>
                {searchQuery.trim() && isHomeSearchActive ? (
                  <AutocompleteContent
                    anchor={homeSearchShellRef}
                    className="rounded-t-[calc(var(--anchor-height)/2)] rounded-b-2xl border border-input bg-popover pt-(--anchor-height) ring-0"
                    portalContainer={homeSearchContainerRef}
                    positionerClassName="z-0"
                    positionMethod="fixed"
                    sideOffset={({ anchor }) => -anchor.height}
                  >
                    {searchResults.length > 0 ? (
                      <AutocompleteList
                        className="not-empty:pt-0 not-empty:pb-4"
                        scrollFade
                      >
                        {(group) => (
                          <AutocompleteGroup
                            className="py-0"
                            items={group.items}
                            key={group.group}
                          >
                            <AutocompleteGroupLabel className="me-1.5 pt-2.5 pb-0.5 text-xs font-medium text-muted-foreground">
                              {group.group}
                            </AutocompleteGroupLabel>
                            <AutocompleteCollection>
                              {(result: (typeof searchResults)[number]) => (
                                <AutocompleteItem
                                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg"
                                  key={`${result.kind}-${result.id}`}
                                  onClick={() => {
                                    if (result.kind === "folder") {
                                      setSelectedFolderId(result.id);
                                    } else {
                                      openProject(result.id);
                                    }
                                    setSearchQuery("");
                                  }}
                                  value={result}
                                >
                                  {result.kind === "folder" ? (
                                    <Folder className="text-muted-foreground" />
                                  ) : (
                                    <LayoutGrid className="text-primary" />
                                  )}
                                  {result.kind === "project" ? (
                                    <div className="flex w-full min-w-0 flex-1 items-center justify-between gap-3">
                                      <div className="min-w-0 flex-1 truncate">
                                        {result.subtitle}
                                      </div>
                                      <div className="shrink-0 text-right text-xs text-muted-foreground">
                                        {result.title}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate">
                                        {result.title}
                                      </div>
                                    </div>
                                  )}
                                </AutocompleteItem>
                              )}
                            </AutocompleteCollection>
                          </AutocompleteGroup>
                        )}
                      </AutocompleteList>
                    ) : (
                      <AutocompleteEmpty className="min-h-28 py-12">
                        {desktopCopy.searchEmpty ?? "No results"}
                      </AutocompleteEmpty>
                    )}
                  </AutocompleteContent>
                ) : null}
              </Autocomplete>
            </div>
          )
        }
        actions={
          mobileHome ? (
            <EmpTopBarControls
              key="emp-navigation"
              homeActive={desktopMode === "home"}
              actionItems={[
                ...(mobileHome
                  ? [
                      {
                        id: "mobile-search",
                        label: mobileCopy.search,
                        icon: <Search />,
                        onClick: () => setMobileSearchOpen((open) => !open),
                      },
                      {
                        id: "mobile-new-folder",
                        label: mobileCopy.newFolder,
                        icon: <Folder />,
                        onClick: openFolderCreator,
                      },
                      ...(mobileFolder
                        ? [
                            {
                              id: "mobile-rename-folder",
                              label:
                                desktopCopy.folderMenu?.renameFolder ??
                                "Rename folder",
                              icon: <Pencil />,
                              disabled:
                                isProtectedDesktopFolder(mobileFolder) ||
                                renameFolder.isPending,
                              onClick: () => openFolderRenamer(mobileFolder),
                            },
                            {
                              id: "mobile-delete-folder",
                              label:
                                desktopCopy.folderMenu?.deleteFolder ??
                                "Delete folder",
                              icon: <Trash2 />,
                              disabled:
                                isProtectedDesktopFolder(mobileFolder) ||
                                placements.some(
                                  (item) => item.folderId === mobileFolder.id
                                ) ||
                                deleteFolder.isPending,
                              onClick: () =>
                                setDeleteFolderCandidate(mobileFolder),
                            },
                          ]
                        : []),
                      ...(mobileFolder && canCreateInActiveFolder
                        ? [
                            {
                              id: "mobile-new-project",
                              label: mobileCopy.newProject,
                              icon: <Plus />,
                              onClick: openProjectCreator,
                            },
                          ]
                        : []),
                    ]
                  : []),
                {
                  id: "confirmation-center",
                  label:
                    dictionary.confirmationCenter?.intranet?.shortcut ??
                    dictionary.confirmations?.shortcutLabel ??
                    "Confirmation",
                  icon: <Truck />,
                  onClick: openConfirmationCenter,
                },
                ...(canAccessSystemAdmin && canManageProjectTemplates
                  ? [
                      {
                        id: "project-templates",
                        label: desktopCopy.apps.templates,
                        icon: <BookOpenCheck />,
                        onClick: () => {
                          closeProjectRecycleBin();
                          setDesktopMode("templates");
                        },
                      },
                      {
                        id: "smart-forms",
                        label: desktopCopy.apps.smartForms,
                        icon: <ClipboardList />,
                        onClick: () => {
                          closeProjectRecycleBin();
                          setDesktopMode("smart-forms");
                        },
                      },
                    ]
                  : []),
                ...(canAccessSystemAdmin
                  ? [
                      {
                        id: "user-management",
                        label:
                          dictionary.common.userManagement ?? "User management",
                        icon: <UserCog />,
                        onClick: () =>
                          router.push(localizedPath("/admin/users")),
                      },
                    ]
                  : []),
                {
                  id: "settings",
                  label: dictionary.common.settings,
                  icon: <Settings data-testid="homepage-settings-icon" />,
                  active: desktopSettingsOpen,
                  onClick: () => setDesktopSettingsOpen(true),
                },
              ]}
              showSettingsButton={false}
              className="justify-self-end"
            />
          ) : (
            <EmpTopBarControls
              key="emp-navigation"
              homeActive={desktopMode === "home"}
              responsiveProjectHome
              compactSearchAction={{
                id: "search",
                label: desktopCopy.searchPlaceholder,
                icon: <Search />,
                onClick: () => setCompactSearchOpen(true),
              }}
              actionItems={[
                {
                  id: "confirmation-center",
                  label:
                    dictionary.confirmationCenter?.intranet?.shortcut ??
                    dictionary.confirmations?.shortcutLabel ??
                    "Confirmation",
                  icon: <Truck />,
                  onClick: openConfirmationCenter,
                },
                ...(canAccessSystemAdmin && canManageProjectTemplates
                  ? [
                      {
                        id: "project-templates",
                        label: desktopCopy.apps.templates,
                        icon: <BookOpenCheck />,
                        active: desktopMode === "templates",
                        onClick: () => {
                          closeProjectRecycleBin();
                          setDesktopMode("templates");
                        },
                      },
                      {
                        id: "smart-forms",
                        label: desktopCopy.apps.smartForms,
                        icon: <ClipboardList />,
                        active: desktopMode === "smart-forms",
                        onClick: () => {
                          closeProjectRecycleBin();
                          setDesktopMode("smart-forms");
                        },
                      },
                    ]
                  : []),
                ...(canAccessSystemAdmin
                  ? [
                      {
                        id: "user-management",
                        label:
                          dictionary.common.userManagement ?? "User management",
                        icon: <UserCog />,
                        onClick: () =>
                          router.push(localizedPath("/admin/users")),
                      },
                    ]
                  : []),
                {
                  id: "settings",
                  label: dictionary.common.settings,
                  icon: <Settings data-testid="homepage-settings-icon" />,
                  active: desktopSettingsOpen,
                  onClick: () => setDesktopSettingsOpen(true),
                },
              ]}
              showSettingsButton={false}
              className="justify-self-end"
            />
          )
        }
        overlays={
          <>
            <Dialog
              open={desktopSettingsOpen}
              onOpenChange={(open) => {
                setDesktopSettingsOpen(open);
                if (!open) {
                  closeProjectRecycleBin();
                }
              }}
            >
              <DialogContent
                className={SIDEBAR_13_DIALOG_CONTENT_CLASS}
                overlayClassName={SIDEBAR_13_DIALOG_OVERLAY_CLASS}
              >
                <DialogHeader className="sr-only">
                  <DialogTitle>{dictionary.common.settings}</DialogTitle>
                </DialogHeader>
                <GlobalSettingsPanel
                  isSuperAdmin={me.data?.globalRole === "SUPER_ADMIN"}
                  recycleBinContent={
                    <ProjectRecycleBinWorkspace
                      embedded
                      locale={locale}
                      error={deletedProjects.isError}
                      onRetry={() => {
                        void deletedProjects.refetch();
                      }}
                      copy={desktopCopy}
                      loading={deletedProjects.isLoading}
                      pending={restoreDeletedProjects.isPending}
                      projects={deletedProjectItems}
                      selectedProjectIds={visibleSelectedDeletedProjectIds}
                      onClose={() => setDesktopSettingsOpen(false)}
                      onRestoreProject={(projectId) =>
                        restoreDeletedProjects.mutate([projectId])
                      }
                      onRestoreSelected={() =>
                        restoreDeletedProjects.mutate(
                          visibleSelectedDeletedProjectIds
                        )
                      }
                      onSelectionChange={setSelectedDeletedProjectIds}
                    />
                  }
                  onOpenRecycleBin={() => {
                    setDesktopMode("home");
                    setProjectRecycleBinOpen(true);
                  }}
                />
              </DialogContent>
            </Dialog>
            <Dialog
              open={compactSearchOpen}
              onOpenChange={(open) => {
                setCompactSearchOpen(open);
                if (!open) {
                  setSearchQuery("");
                }
              }}
            >
              <DialogContent className="top-[max(1rem,env(safe-area-inset-top))] max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-lg translate-y-0 gap-3 rounded-2xl p-4 sm:top-1/2 sm:w-full sm:-translate-y-1/2">
                <DialogHeader>
                  <DialogTitle>{desktopCopy.searchPlaceholder}</DialogTitle>
                  <DialogDescription className="sr-only">
                    {desktopCopy.searchPlaceholder}
                  </DialogDescription>
                </DialogHeader>
                <Input
                  autoFocus
                  aria-label={desktopCopy.searchPlaceholder}
                  placeholder={desktopCopy.searchPlaceholder}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
                <div
                  className="grid max-h-[min(28rem,65dvh)] gap-1 overflow-y-auto"
                  role="listbox"
                  aria-label={desktopCopy.searchPlaceholder}
                >
                  {searchQuery.trim() ? (
                    searchResults.length > 0 ? (
                      searchResults.map((result) => (
                        <Button
                          key={`${result.kind}-${result.id}`}
                          type="button"
                          variant="ghost"
                          role="option"
                          aria-selected="false"
                          className="h-11 min-w-0 justify-start gap-3 px-3"
                          onClick={() => {
                            if (result.kind === "folder") {
                              setSelectedFolderId(result.id);
                            } else {
                              openProject(result.id);
                            }
                            setCompactSearchOpen(false);
                            setSearchQuery("");
                          }}
                        >
                          {result.kind === "folder" ? (
                            <Folder className="size-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <LayoutGrid className="size-4 shrink-0 text-primary" />
                          )}
                          <span className="min-w-0 flex-1 truncate text-left">
                            {result.kind === "project"
                              ? result.subtitle
                              : result.title}
                          </span>
                          {result.kind === "project" ? (
                            <span className="max-w-32 shrink-0 truncate text-xs text-muted-foreground">
                              {result.title}
                            </span>
                          ) : null}
                        </Button>
                      ))
                    ) : (
                      <p className="py-10 text-center text-sm text-muted-foreground">
                        {desktopCopy.searchEmpty ?? "No results"}
                      </p>
                    )
                  ) : null}
                </div>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {mobileHome ? (
        <EmpMobileProjects
          folders={folders}
          placements={placements}
          folderId={mobileFolderId}
          folderLabel={(folder) => getDesktopFolderLabel(folder, desktopCopy)}
          projectLabel={(placement) => placement.project.name}
          projectActions={(placement, close) => (
            <div className="grid gap-3">
              <ProjectDetailActions
                copy={desktopCopy}
                displaySettings={displaySettings}
                isPhone
                locale={locale}
                placement={placement}
                onEdit={() => {
                  close();
                  openProjectEditor(placement.project);
                }}
                onOpen={() => {
                  close();
                  openProject(placement.projectId);
                }}
                onPrefetch={() => prefetchProject(placement.projectId)}
              />
              <ViewSwitcher
                mobilePresentation="sheet"
                label={mobileCopy.moveProject}
                value={placement.folderId}
                options={folders.map((folder) => ({
                  value: folder.id,
                  label: getDesktopFolderLabel(folder, desktopCopy),
                }))}
                onValueChange={(id) => {
                  close();
                  movePlacementToFolder(placement, id);
                }}
              />
            </div>
          )}
          query={searchQuery}
          showSearch={mobileSearchOpen}
          onQueryChange={setSearchQuery}
          onFolder={(id) => {
            setSelectedFolderId(id);
            setSearchQuery("");
            router.push(
              localizedPath(`/engagement?folderId=${encodeURIComponent(id)}`)
            );
          }}
          projectHref={(id) => getProjectHref(id, mobileFolderId)}
          onProject={openProject}
          loading={desktop.isLoading}
          error={desktop.isError}
          onRetry={() => {
            void desktop.refetch();
          }}
          locale={locale}
        />
      ) : (
        <DndContext
          collisionDetection={folderCollisionDetection}
          sensors={sensors}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
          onDragMove={handleDragMove}
          onDragOver={handleDragOver}
          onDragStart={handleDragStart}
        >
          <SidebarProvider
            className="relative min-h-0 flex-1 flex-col bg-background lg:flex-row"
            open={desktopMode !== "home" || !isHomeNavigationCollapsed}
            onOpenChange={(open) => {
              if (desktopMode === "home") {
                setHomeNavigationOpen(open);
              }
            }}
          >
            {isHomeFolderPanel && folders.length > 0 ? (
              <div
                className="shrink-0 px-3 pt-3 lg:hidden"
                data-testid="compact-folder-switcher"
              >
                <ViewSwitcher
                  label={desktopCopy.folderSwitcher}
                  value={activeFolderId ?? ""}
                  options={folders.map((folder) => ({
                    value: folder.id,
                    label: getDesktopFolderLabel(folder, desktopCopy),
                    icon: <Folder className="size-4" />,
                  }))}
                  onValueChange={(folderId) => {
                    closeProjectRecycleBin();
                    setSelectedFolderId(folderId);
                  }}
                />
              </div>
            ) : null}
            <ResizablePanelGroup
              elementRef={homeNavigationGroupElementRef}
              orientation="horizontal"
              className={
                isHomeFolderPanel
                  ? cn(
                      PROJECT_OVERVIEW_GRID_CLASS,
                      "relative overflow-visible p-3"
                    )
                  : "relative min-h-0 flex-1"
              }
            >
              <ResizablePanel
                id="project-home-navigation"
                data-compact-hidden="true"
                panelRef={navigationPanelRef}
                defaultSize={homeNavigationPreferredWidth}
                minSize={
                  desktopMode === "home" ? `${HOME_NAV_MIN_WIDTH}px` : "0rem"
                }
                maxSize={
                  desktopMode === "home" ? `${HOME_NAV_MAX_WIDTH}px` : "20rem"
                }
                collapsedSize="0rem"
                collapsible={desktopMode === "home"}
                onResize={handleNavigationPanelResize}
                className="min-w-0 rounded-[12px] shadow-sm shadow-foreground/5"
              >
                <DynamicBox
                  data-testid="desktop-navigation-sidebar"
                  aria-hidden={isDesktopNavigationCollapsed ? true : undefined}
                  width={
                    desktopMode === "home" ? undefined : desktopNavigationWidth
                  }
                  className={cn(
                    "h-full min-h-0 w-full overflow-hidden rounded-[12px] border border-border/70 bg-card transition-colors",
                    isDesktopNavigationCollapsed && "border-0"
                  )}
                >
                  <Sidebar
                    collapsible={desktopMode === "home" ? "offcanvas" : "none"}
                    className={cn(
                      "relative h-full min-h-0 w-full rounded-[12px] bg-card transition-opacity",
                      isDesktopNavigationCollapsed &&
                        "pointer-events-none select-none opacity-0"
                    )}
                  >
                    <ContextMenu>
                      <ContextMenuTrigger
                        render={
                          <div
                            className="h-full min-h-0"
                            data-testid="desktop-folder-blank-context-target"
                          >
                            <SidebarContent className="h-full px-4 pt-6 pb-4">
                              <SidebarGroup className="p-0">
                                <SidebarGroupContent>
                                  <SidebarMenu className="gap-2">
                                    {desktop.isLoading ? (
                                      <>
                                        <SidebarMenuItem>
                                          <Skeleton className="h-10 rounded-md" />
                                        </SidebarMenuItem>
                                        <SidebarMenuItem>
                                          <Skeleton className="h-10 rounded-md" />
                                        </SidebarMenuItem>
                                      </>
                                    ) : (
                                      folders.map((folder) => (
                                        <DesktopFolderButton
                                          key={folder.id}
                                          active={activeFolderId === folder.id}
                                          copy={desktopCopy}
                                          folder={folder}
                                          hasProjects={placements.some(
                                            (placement) =>
                                              placement.folderId === folder.id
                                          )}
                                          highlighted={
                                            dropTargetFolderId === folder.id
                                          }
                                          pending={
                                            renameFolder.isPending ||
                                            deleteFolder.isPending
                                          }
                                          onClick={() => {
                                            closeProjectRecycleBin();
                                            setSelectedFolderId(folder.id);
                                          }}
                                          onCreateFolder={openFolderCreator}
                                          onDeleteFolder={
                                            setDeleteFolderCandidate
                                          }
                                          onRenameFolder={openFolderRenamer}
                                        />
                                      ))
                                    )}
                                  </SidebarMenu>
                                </SidebarGroupContent>
                              </SidebarGroup>
                            </SidebarContent>
                          </div>
                        }
                      />
                      <ContextMenuContent
                        className={DESKTOP_CONTEXT_MENU_CONTENT_CLASS}
                      >
                        <ContextMenuItem
                          className={DESKTOP_CONTEXT_MENU_ITEM_CLASS}
                          disabled={createFolder.isPending}
                          onClick={openFolderCreator}
                        >
                          <Folder className="size-4 text-muted-foreground" />
                          {desktopCopy.folderMenu?.newFolder ?? "New folder"}
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  </Sidebar>
                </DynamicBox>
              </ResizablePanel>
              {desktopMode === "home" ? (
                <SplitterRail
                  className="max-lg:hidden"
                  expanded={!isHomeNavigationCollapsed}
                  hitAreaTestId="home-navigation-splitter-hit-area"
                  label={desktopCopy.templateLibrary.resizeNavigationSidebar}
                  max={HOME_NAV_MAX_WIDTH}
                  min={HOME_NAV_MIN_WIDTH}
                  onDrag={handleHomeNavigationResize}
                  onDragCancel={handleHomeNavigationResizeCancel}
                  onToggle={() =>
                    setHomeNavigationOpen(isHomeNavigationCollapsed)
                  }
                  onPointerDown={handleHomeNavigationResizeStart}
                  value={homeNavigationLastWidth}
                />
              ) : null}

              <ResizablePanel
                id="project-home-content"
                minSize="0rem"
                className={
                  isHomeFolderPanel
                    ? "relative h-full min-h-0 min-w-0 overflow-hidden rounded-[12px] bg-workbench-panel shadow-sm shadow-foreground/5"
                    : "relative min-w-0"
                }
              >
                <main
                  role="presentation"
                  ref={canvasRef}
                  data-testid="desktop-canvas"
                  className={cn(
                    "relative h-full min-h-0 min-w-0 flex-1",
                    isHomeFolderPanel
                      ? "flex h-full flex-col overflow-hidden bg-workbench-panel"
                      : isProjectRecycleBinWorkspace
                        ? "overflow-auto bg-background"
                        : "overflow-hidden bg-background"
                  )}
                  onContextMenu={
                    desktopMode === "home" && !isProjectRecycleBinWorkspace
                      ? handleContextMenu
                      : undefined
                  }
                  onClick={() => setContextMenu(null)}
                >
                  {desktopMode === "templates" ? (
                    <ProjectTemplateLibraryWorkspace
                      copy={desktopCopy.templateLibrary}
                      directoryCopy={dictionary.workbench}
                      templateFileDetailHref={(templateId, fileId) =>
                        localizedPath(
                          `/templates/project/${templateId}/files/${fileId}?returnTo=${encodeURIComponent(
                            localizedPath("/engagement?templateLibrary=1")
                          )}`
                        )
                      }
                    />
                  ) : desktopMode === "smart-forms" ? (
                    <SmartFormTemplateWorkspace
                      copy={desktopCopy.templateLibrary}
                    />
                  ) : isProjectRecycleBinWorkspace ? (
                    <ProjectRecycleBinWorkspace
                      locale={locale}
                      error={deletedProjects.isError}
                      onRetry={() => {
                        void deletedProjects.refetch();
                      }}
                      copy={desktopCopy}
                      loading={deletedProjects.isLoading}
                      pending={restoreDeletedProjects.isPending}
                      projects={deletedProjectItems}
                      selectedProjectIds={visibleSelectedDeletedProjectIds}
                      onClose={closeProjectRecycleBin}
                      onRestoreProject={(projectId) =>
                        restoreDeletedProjects.mutate([projectId])
                      }
                      onRestoreSelected={() => {
                        if (visibleSelectedDeletedProjectIds.length > 0) {
                          restoreDeletedProjects.mutate(
                            visibleSelectedDeletedProjectIds
                          );
                        }
                      }}
                      onSelectionChange={setSelectedDeletedProjectIds}
                    />
                  ) : (
                    <>
                      <ProjectDetailList
                        key={activeFolderId ?? "none"}
                        activeFolderName={activeFolderName}
                        showRecordCount={!desktop.isLoading && !desktop.isError}
                        canCreateProject={canCreateInActiveFolder}
                        content={
                          desktop.isLoading ? (
                            <CollectionState kind="loading" locale={locale} />
                          ) : desktop.isError ? (
                            <CollectionState
                              kind="error"
                              locale={locale}
                              onRetry={() => {
                                void desktop.refetch();
                              }}
                            />
                          ) : homeViewMode === "icons" ? (
                            <ProjectIconGrid
                              key={`${activeFolderId ?? "none"}:${activePlacements
                                .filter(
                                  (placement) =>
                                    !hiddenProjectIds.has(placement.projectId)
                                )
                                .map((placement) => placement.projectId)
                                .join("|")}`}
                              copy={desktopCopy}
                              displaySettings={displaySettings}
                              locale={locale}
                              positions={positions}
                              placements={activePlacements.filter(
                                (placement) =>
                                  !hiddenProjectIds.has(placement.projectId)
                              )}
                              onOpenProject={openProject}
                              onPrefetchProject={prefetchProject}
                              onFolderDropTargetChange={setDropTargetFolderId}
                              onMoveProjectToFolder={movePlacementToFolder}
                              onValueCommit={(placementUpdates) => {
                                if (!activeFolderId) {
                                  return;
                                }
                                reorderIconProjects.mutate({
                                  folderId: activeFolderId,
                                  placementUpdates,
                                });
                              }}
                            />
                          ) : undefined
                        }
                        copy={desktopCopy}
                        displaySettings={displaySettings}
                        detailPositions={detailPositions}
                        dragProjectId={drag?.projectId ?? null}
                        locale={locale}
                        placements={activePlacements}
                        viewMode={homeViewMode}
                        onCreateProject={openProjectCreator}
                        onEditProject={openProjectEditor}
                        onOpenProject={openProject}
                        onPrefetchProject={prefetchProject}
                        onViewModeChange={setHomeViewMode}
                      />
                      <AnimatePresence initial={false}>
                        {contextMenu ? (
                          <DesktopContextMenu
                            key="desktop-context-menu"
                            copy={desktopContextCopy}
                            currentSortPreference={activeSortPreference}
                            displaySettings={displaySettings}
                            canCreateProject={canCreateInActiveFolder}
                            sortDisabled={!activeFolderId}
                            position={contextMenu}
                            onDisplaySettingsChange={updateDisplaySetting}
                            onCreateFolder={() => {
                              setContextMenu(null);
                              openFolderCreator();
                            }}
                            onCreateProject={() => {
                              setContextMenu(null);
                              openProjectCreator();
                            }}
                            onSortDirectionChange={handleSortDirectionChange}
                            onSortSelect={handleSortSelect}
                            onClose={() => setContextMenu(null)}
                          />
                        ) : null}
                      </AnimatePresence>
                    </>
                  )}
                </main>
                <AnimatePresence initial={false}>
                  {activityPanelOpen ? (
                    <ProjectsActivityPanel
                      key="projects-activity-panel"
                      inboxCopy={dictionary.inbox}
                      locale={locale}
                      messages={inboxMessages}
                      messagesLoading={inbox.isLoading}
                      readStatePending={
                        markInboxRead.isPending || markInboxUnread.isPending
                      }
                      onOpenMessage={openInboxMessage}
                      onToggleMessageRead={toggleInboxMessageReadState}
                      onClose={() => setActivityPanelOpen(false)}
                    />
                  ) : null}
                </AnimatePresence>
              </ResizablePanel>
            </ResizablePanelGroup>
          </SidebarProvider>
          <DragOverlay>
            {activeDragPlacement ? (
              homeViewMode === "list" ? (
                <ProjectDetailDragOverlay
                  displaySettings={displaySettings}
                  placement={activeDragPlacement}
                />
              ) : (
                <DesktopProjectDragOverlay
                  copy={desktopCopy}
                  displaySettings={displaySettings}
                  locale={locale}
                  placement={activeDragPlacement}
                />
              )
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
      <Dialog
        open={createMode === "folder"}
        onOpenChange={(open) => !open && closeFolderDialog()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingFolder
                ? (desktopCopy.folderMenu?.renameTitle ?? "Rename folder")
                : desktopCopy.createFolder.title}
            </DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (folderName.trim()) {
                if (editingFolder) {
                  renameFolder.mutate();
                } else {
                  createFolder.mutate();
                }
              }
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="desktop-folder-name">
                {desktopCopy.createFolder.name}
              </Label>
              <Input
                id="desktop-folder-name"
                placeholder={desktopCopy.createFolder.placeholder}
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
              />
            </div>
            <DialogFooter>
              <ButtonGroup>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeFolderDialog}
                >
                  {desktopCopy.cancel}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !folderName.trim() ||
                    createFolder.isPending ||
                    renameFolder.isPending ||
                    (editingFolder !== null &&
                      folderName.trim() === editingFolder.name)
                  }
                >
                  {editingFolder
                    ? (desktopCopy.folderMenu?.save ?? "Save")
                    : desktopCopy.create}
                </Button>
              </ButtonGroup>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(deleteFolderCandidate)}
        onOpenChange={(open) => !open && setDeleteFolderCandidate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {desktopCopy.folderMenu?.deleteTitle ?? "Delete folder?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(
                desktopCopy.folderMenu?.deleteDescription ??
                "Delete {name}? This action cannot be undone."
              ).replace(
                "{name}",
                deleteFolderCandidate
                  ? getDesktopFolderLabel(deleteFolderCandidate, desktopCopy)
                  : ""
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteFolder.isPending}>
              {desktopCopy.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteFolder.isPending || !deleteFolderCandidate}
              variant="destructive"
              onClick={() => {
                if (deleteFolderCandidate) {
                  deleteFolder.mutate(deleteFolderCandidate);
                }
              }}
            >
              {desktopCopy.folderMenu?.deleteConfirm ?? "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={createMode === "project"}
        onOpenChange={(open) => {
          if (!open) {
            closeProjectDialog();
          }
        }}
      >
        <DialogContent
          className={
            isEditingProject
              ? SIDEBAR_13_DIALOG_CONTENT_CLASS
              : "flex max-h-[calc(100vh-4rem)] w-[min(calc(100vw-3rem),70rem)] max-w-none flex-col overflow-hidden sm:min-h-[38rem] sm:max-w-none"
          }
          overlayClassName={
            isEditingProject ? SIDEBAR_13_DIALOG_OVERLAY_CLASS : undefined
          }
        >
          {isEditingProject && editingProject ? (
            <>
              <DialogTitle className="sr-only">
                {dictionary.projects.settingsTitle ?? "Project settings"}
              </DialogTitle>
              <WorkbenchSettingsPanel
                projectId={editingProject.id}
                canArchiveProject={canArchiveEditingProject}
                canDeleteProject={canDeleteEditingProject}
                canEditProject={canEditEditingProject}
                archivePending={archiveEditedProject.isPending}
                projectOnly
                onArchiveProject={() =>
                  archiveEditedProject.mutate(editingProject)
                }
              />
            </>
          ) : (
            <>
              <DialogHeader className="flex-row items-center justify-between gap-3 pr-10">
                <DialogTitle>{projectDialogTitle}</DialogTitle>
                {isEditingProject ? (
                  <output
                    className="w-16 shrink-0 text-right text-xs text-muted-foreground"
                    data-testid="project-dialog-save-status"
                  >
                    {updateProject.isPending ? "Saving…" : "Saved"}
                  </output>
                ) : null}
              </DialogHeader>
              {isEditingProject ? null : (
                <AccessibleName label={desktopCopy.createProject.title}>
                  <ol className="mx-auto flex w-full max-w-2xl items-center px-2 text-xs font-medium text-muted-foreground">
                    <li
                      className={cn(
                        "flex shrink-0 items-center gap-2",
                        projectDialogStep === 1 && "text-primary"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full border border-border bg-background",
                          projectDialogStep === 1 &&
                            "border-primary bg-primary text-primary-foreground",
                          projectDialogStep === 2 &&
                            "border-primary bg-primary/10 text-primary"
                        )}
                      >
                        {projectDialogStep === 2 ? (
                          <Check className="size-3.5" />
                        ) : (
                          "1"
                        )}
                      </span>
                      <span>
                        {desktopCopy.createProject.selectEngagementStep}
                      </span>
                    </li>
                    <span className="mx-3 h-px min-w-8 flex-1 bg-border" />
                    <li
                      className={cn(
                        "flex shrink-0 items-center gap-2",
                        projectDialogStep === 2 && "text-primary"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full border border-border bg-background",
                          projectDialogStep === 2 &&
                            "border-primary bg-primary text-primary-foreground"
                        )}
                      >
                        2
                      </span>
                      <span>
                        {desktopCopy.createProject.completeProjectStep}
                      </span>
                    </li>
                  </ol>
                </AccessibleName>
              )}
              <form
                className="flex min-h-0 flex-1 flex-col gap-6"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (editingProject) {
                    return;
                  }
                  const hasProjectSource =
                    Boolean(projectForm.rollForwardFromProjectId) ||
                    isEngagementLinkSkipped ||
                    Boolean(projectForm.cmpEngagementId);
                  if (
                    projectForm.name.trim() &&
                    hasProjectSource &&
                    projectForm.frameworkTemplateId
                  ) {
                    const selectedProjectTemplate = projectTemplates.data?.find(
                      (template) =>
                        template.id === projectForm.projectTemplateId
                    );
                    setCreateMode(null);
                    setReviewData({
                      ...projectForm,
                      projectCode: projectForm.projectCode,
                      cmpClientName: projectForm.cmpClientName,
                      cmpEngagementName: projectForm.cmpEngagementName,
                      projectTemplateName: selectedProjectTemplate?.name ?? "",
                      invitations:
                        invitationInputs.length > 0
                          ? invitationInputs
                          : undefined,
                    });
                  }
                }}
              >
                <div className="grid min-h-0 flex-1 gap-5 overflow-x-hidden overflow-y-auto pr-1 lg:grid-cols-[minmax(20rem,22rem)_minmax(0,1fr)]">
                  {!isEditingProject && projectDialogStep === 1 ? (
                    <section className="mx-auto grid w-full max-w-4xl content-start gap-5 py-5 lg:col-span-2">
                      <div className="text-center">
                        <h2 className="text-xl font-semibold text-foreground">
                          {desktopCopy.createProject.selectEngagementTitle}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {
                            desktopCopy.createProject
                              .selectEngagementDescription
                          }
                        </p>
                      </div>
                      <InputGroup className="mx-auto h-11 w-full max-w-2xl bg-background shadow-sm">
                        <InputGroupAddon>
                          <Search className="size-4" />
                        </InputGroupAddon>
                        <InputGroupInput
                          id="desktop-project-cmp-engagement-code"
                          label={desktopCopy.createProject.engagementCode}
                          autoComplete="off"
                          value={projectForm.cmpEngagementCode}
                          placeholder={
                            desktopCopy.createProject.engagementCodePlaceholder
                          }
                          onChange={(event) => {
                            lastAppliedCmpEngagementIdRef.current = null;
                            setIsEngagementLinkSkipped(false);
                            setProjectForm((current) => ({
                              ...current,
                              cmpEngagementCode: event.target.value,
                              cmpClientId: "",
                              cmpEngagementId: "",
                              cmpClientName: "",
                              cmpEngagementName: "",
                            }));
                          }}
                        />
                      </InputGroup>
                      {cmpEngagementSearchCode ? (
                        cmpEngagements.isLoading ? (
                          <div
                            className="mx-auto grid w-full max-w-3xl gap-2"
                            aria-busy="true"
                            aria-label={
                              desktopCopy.createProject
                                .loadingCmpEngagementMatch
                            }
                          >
                            <Skeleton className="h-16 w-full rounded-md" />
                            <Skeleton className="h-16 w-full rounded-md" />
                          </div>
                        ) : matchingCmpEngagements.length > 0 ? (
                          <AccessibleName
                            label={
                              desktopCopy.createProject.matchingCmpEngagement
                            }
                          >
                            <section className="mx-auto grid w-full max-w-3xl gap-2">
                              <p className="text-xs text-muted-foreground">
                                {desktopCopy.createProject.matchingEngagementCount.replace(
                                  "{count}",
                                  String(matchingCmpEngagements.length)
                                )}
                              </p>
                              <div className="grid grid-cols-[1.2fr_1.5fr_1fr_0.8fr_0.8fr] gap-3 border-b border-border px-3 pb-2 text-xs font-medium text-muted-foreground">
                                <span>
                                  {desktopCopy.createProject.engagementCode}
                                </span>
                                <span>
                                  {desktopCopy.createProject.matchedClientName}
                                </span>
                                <span>
                                  {desktopCopy.createProject.matchedClientCode}
                                </span>
                                <span>{desktopCopy.createProject.pic}</span>
                                <span>{desktopCopy.createProject.mic}</span>
                              </div>
                              <div className="grid divide-y divide-border border-y border-border">
                                {matchingCmpEngagements.map((engagement) => {
                                  const selected =
                                    projectForm.cmpEngagementId ===
                                    engagement.id;
                                  return (
                                    <Button
                                      key={engagement.id}
                                      type="button"
                                      variant="ghost"
                                      aria-pressed={selected}
                                      className={cn(
                                        "h-auto min-h-14 w-full rounded-none px-3 py-2 text-left hover:bg-muted/70",
                                        selected &&
                                          "bg-primary/10 hover:bg-primary/10"
                                      )}
                                      onClick={() => {
                                        lastAppliedCmpEngagementIdRef.current =
                                          null;
                                        setIsEngagementLinkSkipped(false);
                                        setProjectForm((current) => ({
                                          ...current,
                                          cmpEngagementCode:
                                            engagement.engagementCode,
                                          cmpClientId: engagement.clientId,
                                          cmpEngagementId: engagement.id,
                                          cmpClientName: `${engagement.client.clientCode} - ${
                                            engagement.client.nameEn ||
                                            engagement.client.nameZh
                                          }`,
                                          cmpEngagementName:
                                            engagement.engagementCode,
                                          name: engagement.engagementCode,
                                          yearEndDate:
                                            engagement.yearEndDate ??
                                            current.yearEndDate,
                                          reportDate:
                                            engagement.reportDate ??
                                            current.reportDate,
                                          archiveDeadline: engagement.reportDate
                                            ? (addDaysIsoDate(
                                                engagement.reportDate,
                                                DEFAULT_ARCHIVE_DEADLINE_DAYS
                                              ) ?? current.archiveDeadline)
                                            : current.archiveDeadline,
                                        }));
                                      }}
                                    >
                                      <span className="grid w-full grid-cols-[1.2fr_1.5fr_1fr_0.8fr_0.8fr] items-center gap-3 text-sm">
                                        <span className="flex items-center gap-2 font-semibold text-foreground">
                                          {selected ? (
                                            <CheckCircle2 className="size-4 shrink-0 text-primary" />
                                          ) : null}
                                          <span className="truncate">
                                            {engagement.engagementCode}
                                          </span>
                                        </span>
                                        <span className="truncate text-foreground">
                                          {engagement.client.nameEn ||
                                            engagement.client.nameZh}
                                        </span>
                                        <span className="truncate text-muted-foreground">
                                          {engagement.client.clientCode}
                                        </span>
                                        <span className="truncate text-muted-foreground">
                                          {engagement.pic || "-"}
                                        </span>
                                        <span className="truncate text-muted-foreground">
                                          {engagement.mic || "-"}
                                        </span>
                                      </span>
                                    </Button>
                                  );
                                })}
                              </div>
                            </section>
                          </AccessibleName>
                        ) : (
                          <div className="mx-auto w-full max-w-3xl rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                            {desktopCopy.createProject.noMatchingEngagementCode}
                          </div>
                        )
                      ) : null}
                    </section>
                  ) : (
                    <>
                      {isEditingProject && !editingProject?.cmpEngagementId ? (
                        <section className="grid gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 lg:col-span-2">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {desktopCopy.createProject.linkEngagement}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {
                                desktopCopy.createProject
                                  .linkEngagementDescription
                              }
                            </p>
                          </div>
                          <Input
                            data-testid="project-link-engagement-code"
                            aria-label={
                              desktopCopy.createProject.engagementCode
                            }
                            value={projectForm.cmpEngagementCode}
                            placeholder={
                              desktopCopy.createProject
                                .linkEngagementPlaceholder
                            }
                            onChange={(event) =>
                              setProjectForm((current) => ({
                                ...current,
                                cmpEngagementCode: event.target.value,
                              }))
                            }
                          />
                          {matchingCmpEngagements.length > 0 ? (
                            <div className="grid divide-y divide-border overflow-hidden rounded-md border border-border bg-background">
                              {matchingCmpEngagements.map((engagement) => (
                                <Button
                                  key={engagement.id}
                                  type="button"
                                  variant="ghost"
                                  className="h-auto justify-start rounded-none px-3 py-2 text-left"
                                  disabled={linkProjectEngagement.isPending}
                                  data-testid={`project-link-engagement-${engagement.id}`}
                                  onClick={() =>
                                    linkProjectEngagement.mutate({
                                      projectId: editingProject?.id ?? "",
                                      input: {
                                        cmpClientId: engagement.clientId,
                                        cmpEngagementId: engagement.id,
                                      },
                                    })
                                  }
                                >
                                  <span className="grid gap-0.5">
                                    <span className="font-medium">
                                      {engagement.engagementCode}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {engagement.client.clientCode} ·{" "}
                                      {engagement.client.nameEn ||
                                        engagement.client.nameZh}
                                    </span>
                                  </span>
                                </Button>
                              ))}
                            </div>
                          ) : projectForm.cmpEngagementCode.trim() ? (
                            <p className="text-xs text-muted-foreground">
                              {
                                desktopCopy.createProject
                                  .noMatchingEngagementCode
                              }
                            </p>
                          ) : null}
                        </section>
                      ) : null}
                      {!isEditingProject && selectedCmpEngagement ? (
                        <section className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-4 lg:col-span-2">
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            <div className="grid gap-1">
                              <span className="text-xs text-muted-foreground">
                                {desktopCopy.createProject.engagementCode}
                              </span>
                              <span className="text-sm font-semibold text-foreground">
                                {selectedCmpEngagement.engagementCode}
                              </span>
                            </div>
                            <div className="grid gap-1">
                              <span className="text-xs text-muted-foreground">
                                {desktopCopy.createProject.matchedClientName}
                              </span>
                              <span className="truncate text-sm font-medium text-foreground">
                                {selectedCmpEngagement.client.nameEn ||
                                  selectedCmpEngagement.client.nameZh}
                              </span>
                            </div>
                            <div className="grid gap-1">
                              <span className="text-xs text-muted-foreground">
                                {desktopCopy.createProject.matchedClientCode}
                              </span>
                              <span className="text-sm text-foreground">
                                {selectedCmpEngagement.client.clientCode}
                              </span>
                            </div>
                            <div className="grid gap-1">
                              <span className="text-xs text-muted-foreground">
                                {desktopCopy.createProject.pic}
                              </span>
                              <span className="text-sm text-foreground">
                                {selectedCmpEngagement.pic || "-"}
                              </span>
                            </div>
                            <div className="grid gap-1">
                              <span className="text-xs text-muted-foreground">
                                {desktopCopy.createProject.mic}
                              </span>
                              <span className="text-sm text-foreground">
                                {selectedCmpEngagement.mic || "-"}
                              </span>
                            </div>
                          </div>
                        </section>
                      ) : null}
                      <div className="grid min-w-0 content-start gap-5">
                        <Field>
                          <FieldLabel htmlFor="desktop-project-name">
                            {desktopCopy.createProject.name}
                          </FieldLabel>
                          <Input
                            id="desktop-project-name"
                            readOnly={
                              !isEditingProject && isEngagementLinkSkipped
                            }
                            value={projectForm.name}
                            onChange={(event) =>
                              !isEngagementLinkSkipped || isEditingProject
                                ? setProjectForm((current) => ({
                                    ...current,
                                    name: event.target.value,
                                  }))
                                : undefined
                            }
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="desktop-project-code">
                            {desktopCopy.createProject.projectCode}
                          </FieldLabel>
                          <Input
                            id="desktop-project-code"
                            value={projectForm.projectCode}
                            maxLength={80}
                            placeholder={
                              isEditingProject
                                ? undefined
                                : dictionary.projects.projectCodeAutomatic
                            }
                            onChange={(event) =>
                              setProjectForm((current) => ({
                                ...current,
                                projectCode: event.target.value,
                              }))
                            }
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="desktop-project-language">
                            {desktopCopy.createProject.language}
                          </FieldLabel>
                          <ProjectSelectControl
                            id="desktop-project-language"
                            value={projectForm.language}
                            disabled={isEditingProject}
                            options={[
                              {
                                value: "zh-CN",
                                label:
                                  desktopCopy.createProject.languages["zh-CN"],
                              },
                              {
                                value: "en-US",
                                label:
                                  desktopCopy.createProject.languages["en-US"],
                              },
                            ]}
                            onValueChange={(value) =>
                              setProjectForm((current) => ({
                                ...current,
                                language: value as "zh-CN" | "en-US",
                              }))
                            }
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="desktop-project-framework">
                            {desktopCopy.createProject.frameworkTemplate}
                          </FieldLabel>
                          <Input
                            id="desktop-project-framework"
                            value={projectForm.frameworkTemplateInput}
                            disabled={isEditingProject}
                            placeholder={
                              desktopCopy.createProject
                                .frameworkTemplateInputPlaceholder ??
                              "Enter a standard code or name"
                            }
                            aria-invalid={
                              Boolean(
                                projectForm.frameworkTemplateInput.trim()
                              ) &&
                              !findFrameworkTemplateByInput(
                                frameworkTemplates.data ?? [],
                                projectForm.frameworkTemplateInput
                              )
                            }
                            onChange={(event) => {
                              const frameworkTemplateInput = event.target.value;
                              const matchedTemplate =
                                findFrameworkTemplateByInput(
                                  frameworkTemplates.data ?? [],
                                  frameworkTemplateInput
                                );
                              setProjectForm((current) => ({
                                ...current,
                                frameworkTemplateInput,
                                frameworkTemplateId: matchedTemplate?.id ?? "",
                              }));
                            }}
                          />
                          {projectForm.frameworkTemplateInput.trim() &&
                          !findFrameworkTemplateByInput(
                            frameworkTemplates.data ?? [],
                            projectForm.frameworkTemplateInput
                          ) ? (
                            <p className="mt-1 text-xs text-destructive">
                              {desktopCopy.createProject
                                .frameworkTemplateNoMatch ??
                                "Enter an existing standard code or name"}
                            </p>
                          ) : null}
                        </Field>
                        <div>
                          <Field>
                            <FieldLabel htmlFor="desktop-project-template">
                              {desktopCopy.createProject.projectTemplate}
                            </FieldLabel>
                            <ProjectSelectControl
                              id="desktop-project-template"
                              value={projectForm.projectTemplateId}
                              contentClassName="max-h-[14rem]"
                              options={[
                                {
                                  value: "",
                                  label:
                                    desktopCopy.createProject.noProjectTemplate,
                                },
                                ...(projectTemplates.data?.map((template) => ({
                                  value: template.id,
                                  label: template.name,
                                })) ?? []),
                              ]}
                              onValueChange={(value) => {
                                const selectedTemplate =
                                  projectTemplates.data?.find(
                                    (template) => template.id === value
                                  );
                                const selectedFramework =
                                  selectedTemplate?.frameworkTemplateId
                                    ? (frameworkTemplates.data ?? []).find(
                                        (template) =>
                                          template.id ===
                                          selectedTemplate.frameworkTemplateId
                                      )
                                    : null;
                                setProjectForm((current) => ({
                                  ...current,
                                  projectTemplateId: value,
                                  projectTemplateName:
                                    selectedTemplate?.name ?? "",
                                  ...(selectedTemplate?.frameworkTemplateId
                                    ? {
                                        frameworkTemplateId:
                                          selectedTemplate.frameworkTemplateId,
                                        frameworkTemplateInput:
                                          selectedFramework
                                            ? formatFrameworkTemplateInput(
                                                selectedFramework
                                              )
                                            : selectedTemplate.frameworkTemplateId,
                                      }
                                    : {}),
                                }));
                              }}
                              disabled={
                                projectTemplates.isLoading ||
                                Boolean(projectForm.rollForwardFromProjectId)
                              }
                            />
                          </Field>
                        </div>
                        {editingProject ? null : (
                          <div className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-3">
                            <Field>
                              <FieldLabel htmlFor="desktop-project-roll-forward">
                                {desktopCopy.createProject.rollForward.label}
                              </FieldLabel>
                              <ProjectSelectControl
                                id="desktop-project-roll-forward"
                                value={projectForm.rollForwardFromProjectId}
                                options={[
                                  {
                                    value: "",
                                    label:
                                      desktopCopy.createProject.rollForward
                                        .none,
                                  },
                                  ...rollForwardSourceProjects.map(
                                    (project) => ({
                                      value: project.id,
                                      label: `${project.projectCode} - ${project.name}`,
                                    })
                                  ),
                                ]}
                                onValueChange={(value) => {
                                  lastAppliedCmpEngagementIdRef.current = null;
                                  const sourceProject =
                                    rollForwardSourceProjects.find(
                                      (project) => project.id === value
                                    );
                                  const sourceFrameworkTemplate =
                                    sourceProject?.frameworkTemplateId
                                      ? (frameworkTemplates.data ?? []).find(
                                          (template) =>
                                            template.id ===
                                            sourceProject.frameworkTemplateId
                                        )
                                      : null;
                                  setProjectForm((current) => ({
                                    ...current,
                                    cmpClientId: "",
                                    cmpEngagementId: "",
                                    cmpEngagementCode: "",
                                    cmpClientName: "",
                                    cmpEngagementName: "",
                                    rollForwardFromProjectId: value,
                                    rollForwardSourceName:
                                      sourceProject?.name ?? "",
                                    frameworkTemplateId:
                                      sourceProject?.frameworkTemplateId ||
                                      current.frameworkTemplateId,
                                    frameworkTemplateInput:
                                      sourceProject?.frameworkTemplateId
                                        ? sourceFrameworkTemplate
                                          ? formatFrameworkTemplateInput(
                                              sourceFrameworkTemplate
                                            )
                                          : sourceProject.frameworkTemplateId
                                        : current.frameworkTemplateInput,
                                    projectTemplateId: value
                                      ? ""
                                      : current.projectTemplateId,
                                    projectTemplateName: value
                                      ? ""
                                      : current.projectTemplateName,
                                    yearEndDate: sourceProject
                                      ? addYearsIsoDate(
                                          sourceProject.yearEndDate,
                                          1
                                        )
                                      : current.yearEndDate,
                                    reportDate: sourceProject
                                      ? addYearsIsoDate(
                                          sourceProject.reportDate,
                                          1
                                        )
                                      : current.reportDate,
                                    archiveDeadline: sourceProject
                                      ? addYearsIsoDate(
                                          sourceProject.archiveDeadline,
                                          1
                                        )
                                      : current.archiveDeadline,
                                  }));
                                }}
                              />
                            </Field>
                            {projectForm.rollForwardFromProjectId ? (
                              <>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Checkbox
                                    label={
                                      desktopCopy.createProject.rollForward
                                        .inheritMembers
                                    }
                                    checked={projectForm.inheritMembers}
                                    onCheckedChange={(checked) =>
                                      setProjectForm((current) => ({
                                        ...current,
                                        inheritMembers: checked === true,
                                      }))
                                    }
                                  />
                                  <span>
                                    {
                                      desktopCopy.createProject.rollForward
                                        .inheritMembers
                                    }
                                  </span>
                                </div>
                                <RollForwardPreviewCard
                                  copy={desktopCopy.createProject.rollForward}
                                  preview={rollForwardPreview.data}
                                  loading={rollForwardPreview.isLoading}
                                />
                              </>
                            ) : null}
                          </div>
                        )}
                        <Field>
                          <FieldLabel htmlFor="desktop-project-year-end-date">
                            {desktopCopy.createProject.yearEndDate}
                          </FieldLabel>
                          {renderCalendarDateControl({
                            id: "desktop-project-year-end-date",
                            value: projectForm.yearEndDate,
                            locale,
                            placeholder: desktopCopy.createProject.yearEndDate,
                            todayLabel: calendarTodayLabel,
                            open: openProjectCalendarField === "yearEndDate",
                            setOpen: (open) =>
                              setOpenProjectCalendarField(
                                open ? "yearEndDate" : null
                              ),
                            onChange: (value) =>
                              setProjectForm((current) => ({
                                ...current,
                                yearEndDate: value,
                              })),
                          })}
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="desktop-project-report-date">
                            {desktopCopy.createProject.reportDate}
                          </FieldLabel>
                          {renderCalendarDateControl({
                            id: "desktop-project-report-date",
                            value: projectForm.reportDate,
                            locale,
                            placeholder: desktopCopy.createProject.reportDate,
                            todayLabel: calendarTodayLabel,
                            open: openProjectCalendarField === "reportDate",
                            setOpen: (open) =>
                              setOpenProjectCalendarField(
                                open ? "reportDate" : null
                              ),
                            onChange: (value) =>
                              setProjectForm((current) => ({
                                ...current,
                                reportDate: value,
                                archiveDeadline:
                                  addDaysIsoDate(
                                    value,
                                    DEFAULT_ARCHIVE_DEADLINE_DAYS
                                  ) ?? current.archiveDeadline,
                              })),
                          })}
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="desktop-project-archive-deadline">
                            {desktopCopy.createProject.archiveDeadline}
                          </FieldLabel>
                          {renderCalendarDateControl({
                            id: "desktop-project-archive-deadline",
                            value: projectForm.archiveDeadline,
                            locale,
                            placeholder:
                              desktopCopy.createProject.archiveDeadline,
                            todayLabel: calendarTodayLabel,
                            open:
                              openProjectCalendarField === "archiveDeadline",
                            setOpen: (open) =>
                              setOpenProjectCalendarField(
                                open ? "archiveDeadline" : null
                              ),
                            onChange: (value) =>
                              setProjectForm((current) => ({
                                ...current,
                                archiveDeadline: value,
                              })),
                          })}
                        </Field>
                      </div>
                      <ProjectInitialInviteList
                        copy={dictionary.projects}
                        users={eligibleInvitees}
                        projectMembers={editingProject?.members ?? []}
                        memberLibraryLabel={
                          desktopCopy.createProject.memberLibrary
                        }
                        locale={locale}
                        searchQuery={memberSearchQuery}
                        onSearchChange={setMemberSearchQuery}
                        selectedInvitations={selectedInvitations}
                        invitationRoleChoices={invitationRoleChoices}
                        automaticMemberAssignments={
                          automaticEngagementMemberAssignments
                        }
                        loading={userDirectory.isLoading}
                        onToggle={toggleInitialInvitation}
                        onRoleChange={updateInitialInvitationRole}
                      />
                    </>
                  )}
                </div>
                <DialogFooter className="mt-auto shrink-0 justify-end border-t border-border bg-card pt-4 sm:justify-end">
                  <ButtonGroup
                    className="ml-auto w-full flex-wrap justify-end sm:w-fit sm:flex-nowrap"
                    data-testid="project-dialog-actions"
                  >
                    {!isEditingProject && projectDialogStep === 1 ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          lastAppliedCmpEngagementIdRef.current = null;
                          setIsEngagementLinkSkipped(true);
                          setProjectForm((current) => ({
                            ...current,
                            cmpClientId: "",
                            cmpEngagementId: "",
                            cmpEngagementCode: "",
                            cmpClientName: "",
                            cmpEngagementName: "",
                            name: "Dummy",
                            projectCode: "",
                          }));
                          setProjectDialogStep(2);
                        }}
                      >
                        {dictionary.projects.skipEngagementLink}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeProjectDialog}
                    >
                      {desktopCopy.cancel}
                    </Button>
                    {!isEditingProject && projectDialogStep === 1 ? (
                      <Button
                        type="button"
                        disabled={
                          !projectForm.cmpEngagementId &&
                          !isEngagementLinkSkipped
                        }
                        onClick={() => setProjectDialogStep(2)}
                      >
                        {desktopCopy.createProject.nextStep}
                        <ChevronRight data-icon="inline-end" />
                      </Button>
                    ) : (
                      <>
                        {isEditingProject ? null : (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setProjectDialogStep(1)}
                          >
                            <ChevronLeft data-icon="inline-start" />
                            {desktopCopy.createProject.backStep}
                          </Button>
                        )}
                        {isEditingProject && editingProject ? (
                          <>
                            {canArchiveEditingProject ? (
                              <Button
                                type="button"
                                variant="outline"
                                disabled={
                                  archiveEditedProject.isPending ||
                                  deleteEditedProject.isPending
                                }
                                onClick={() =>
                                  archiveEditedProject.mutate(editingProject)
                                }
                              >
                                <Archive data-icon="inline-start" />
                                {desktopCopy.createProject.archiveProject}
                              </Button>
                            ) : null}
                            {canDeleteEditingProject ? (
                              <Button
                                type="button"
                                variant="destructive"
                                disabled={
                                  archiveEditedProject.isPending ||
                                  deleteEditedProject.isPending
                                }
                                onClick={() =>
                                  setDeleteProjectCandidate(editingProject)
                                }
                              >
                                <Trash2 data-icon="inline-start" />
                                {desktopCopy.createProject.deleteProject}
                              </Button>
                            ) : null}
                          </>
                        ) : null}
                        {isEditingProject ? null : (
                          <Button
                            type="submit"
                            tooltip={
                              projectForm.name.trim()
                                ? isEditingProject &&
                                  !projectForm.projectCode.trim()
                                  ? desktopCopy.createProject.projectCode
                                  : !isEditingProject &&
                                      !projectForm.rollForwardFromProjectId &&
                                      !projectForm.cmpEngagementId &&
                                      !isEngagementLinkSkipped
                                    ? desktopCopy.createProject.cmpEngagement
                                    : projectForm.frameworkTemplateId
                                      ? undefined
                                      : desktopCopy.createProject
                                          .frameworkTemplate
                                : desktopCopy.createProject.name
                            }
                            disabled={
                              createProject.isPending ||
                              updateProject.isPending ||
                              !projectForm.name.trim() ||
                              (isEditingProject &&
                                !projectForm.projectCode.trim()) ||
                              (!isEditingProject &&
                                !projectForm.rollForwardFromProjectId &&
                                !projectForm.cmpEngagementId &&
                                !isEngagementLinkSkipped) ||
                              !projectForm.frameworkTemplateId
                            }
                          >
                            {desktopCopy.create}
                          </Button>
                        )}
                      </>
                    )}
                  </ButtonGroup>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteProjectCandidate)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteProjectCandidate(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {desktopCopy.createProject.confirmDeleteProject}
            </DialogTitle>
            <DialogDescription>
              {desktopCopy.createProject.deleteProjectDescription}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <ButtonGroup>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteProjectCandidate(null)}
              >
                {desktopCopy.cancel}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={
                  !deleteProjectCandidate || deleteEditedProject.isPending
                }
                onClick={() => {
                  if (deleteProjectCandidate) {
                    deleteEditedProject.mutate(deleteProjectCandidate);
                  }
                }}
              >
                <Trash2 data-icon="inline-start" />
                {desktopCopy.createProject.deleteProject}
              </Button>
            </ButtonGroup>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project review dialog before creation */}
      <AnimatePresence>
        {reviewData ? (
          <ProjectReviewOverlay
            dictionary={dictionary}
            data={reviewData}
            isPending={createProject.isPending}
            onConfirm={() => createProject.mutate(reviewData)}
            onBack={() => {
              setReviewData(null);
              setCreateMode("project");
            }}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ProjectInitialInviteList({
  copy,
  users,
  projectMembers,
  memberLibraryLabel,
  locale,
  searchQuery,
  onSearchChange,
  selectedInvitations,
  invitationRoleChoices,
  automaticMemberAssignments,
  loading,
  onToggle,
  onRoleChange,
}: {
  copy: ReturnType<typeof useI18n>["dictionary"]["projects"];
  users: User[];
  projectMembers: NonNullable<Project["members"]>;
  memberLibraryLabel: string;
  locale: Locale;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedInvitations: Record<string, ProjectRole>;
  invitationRoleChoices: Record<string, ProjectRole>;
  automaticMemberAssignments: ReadonlyMap<
    string,
    AutomaticProjectMemberAssignment
  >;
  loading: boolean;
  onToggle: (user: User) => void;
  onRoleChange: (user: User, role: ProjectRole) => void;
}) {
  const [roleFilter, setRoleFilter] = useState<MemberRoleFilter>("ALL");
  const [statusFilter, setStatusFilter] =
    useState<InvitationStatusFilter>("ALL");
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const memberByUserId = useMemo(
    () => new Map(projectMembers.map((member) => [member.user.id, member])),
    [projectMembers]
  );
  const filterCopy =
    locale === "zh-CN"
      ? {
          roleLabel: "\u804C\u7EA7\u7B5B\u9009",
          rank: "Rank",
          roleInEngagement: "Role in Engagement",
          statusLabel: "\u9080\u8BF7\u72B6\u6001\u7B5B\u9009",
          allRoles: "\u5168\u90E8\u804C\u7EA7",
          allStatuses: "\u5168\u90E8\u72B6\u6001",
          notAccepted: "\u672A\u63A5\u53D7\u9080\u8BF7",
        }
      : {
          roleLabel: "Role filter",
          rank: "Rank",
          roleInEngagement: "Role in Engagement",
          statusLabel: "Invitation status filter",
          allRoles: "All roles",
          allStatuses: "All statuses",
          notAccepted: "Not accepted invitation",
        };
  const visibleUsers = useMemo(
    () =>
      users.filter((user) => {
        const member = memberByUserId.get(user.id);
        const automaticMember = automaticMemberAssignments.get(user.id);
        const selectedRole = selectedInvitations[user.id];
        const projectRole =
          member?.projectRole ??
          automaticMember?.projectRole ??
          selectedRole ??
          getDefaultInvitationRole(user);
        if (!matchesMemberRoleFilter(user, projectRole, roleFilter)) {
          return false;
        }
        if (
          statusFilter === "INVITED" &&
          member?.membershipStatus !== "INVITED" &&
          !selectedRole
        ) {
          return false;
        }
        return normalizedSearch
          ? `${user.name} ${user.email}`
              .toLowerCase()
              .includes(normalizedSearch)
          : true;
      }),
    [
      memberByUserId,
      automaticMemberAssignments,
      normalizedSearch,
      roleFilter,
      selectedInvitations,
      statusFilter,
      users,
    ]
  );

  return (
    <section
      aria-labelledby="invite-project-members-title"
      className="grid min-h-0 content-start gap-3"
    >
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/70 px-3 py-2 shadow-sm shadow-foreground/5 backdrop-blur-sm">
        <h2
          id="invite-project-members-title"
          className="text-sm font-semibold text-foreground"
        >
          {copy.inviteProjectMembers}
        </h2>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
        <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {memberLibraryLabel ?? "Member library"}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <ProjectSelectControl
            ariaLabel={filterCopy.roleLabel}
            size="sm"
            className="w-full sm:w-36"
            value={roleFilter}
            onValueChange={(value) => setRoleFilter(value as MemberRoleFilter)}
            options={[
              { label: filterCopy.allRoles, value: "ALL" },
              ...MEMBER_ROLE_FILTERS.map((role) => ({
                label: role.label,
                value: role.value,
              })),
            ]}
          />
          <ProjectSelectControl
            ariaLabel={filterCopy.statusLabel}
            size="sm"
            className="w-full sm:w-36"
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as InvitationStatusFilter)
            }
            options={[
              { label: filterCopy.allStatuses, value: "ALL" },
              { label: filterCopy.notAccepted, value: "INVITED" },
            ]}
          />
        </div>
        <div className="relative w-full sm:w-52">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            label={copy.memberSearch ?? "Search members"}
            className="h-8 rounded-md bg-background pl-8 text-xs shadow-none"
            placeholder={copy.memberSearch ?? "Search members"}
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
      </div>
      {loading ? (
        <div
          className="space-y-3 p-3"
          aria-busy="true"
          aria-label={copy.loadingAvailableUsers}
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-28 rounded-sm" />
              <Skeleton className="h-3 w-40 rounded-sm" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-24 rounded-sm" />
              <Skeleton className="h-3 w-36 rounded-sm" />
            </div>
          </div>
        </div>
      ) : null}
      {!loading && visibleUsers.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          {copy.noInviteableUsers}
        </div>
      ) : null}
      {!loading && visibleUsers.length > 0 ? (
        <div className="grid max-h-[min(31rem,calc(100dvh-16rem))] gap-1.5 overflow-auto pr-1">
          <div className="hidden grid-cols-[minmax(0,1fr)_7.5rem_10rem_6.5rem] gap-3 px-3 text-xs font-medium text-muted-foreground md:grid">
            <span />
            <span>{filterCopy.rank}</span>
            <span>{filterCopy.roleInEngagement}</span>
            <span />
          </div>
          {visibleUsers.map((user) => {
            const member = memberByUserId.get(user.id);
            const automaticMember = automaticMemberAssignments.get(user.id);
            const selectedRole = selectedInvitations[user.id];
            const projectRole =
              member?.projectRole ??
              automaticMember?.projectRole ??
              selectedRole ??
              invitationRoleChoices[user.id] ??
              getDefaultInvitationRole(user);
            const isExistingMember = Boolean(member);
            const isAutomaticallyInvited = Boolean(automaticMember);
            const isLockedMember = isExistingMember || isAutomaticallyInvited;
            const isSelected = isLockedMember || Boolean(selectedRole);
            const allowedProjectRoles =
              getProjectInvitationEligibility(user).assignableProjectRoles;
            return (
              <div
                key={user.id}
                className="grid gap-3 rounded-md border border-border/65 bg-background/55 px-3 py-2 md:grid-cols-[minmax(0,1fr)_7.5rem_10rem_6.5rem] md:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {user.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
                </div>
                <span className="text-sm text-foreground">
                  {projectRole ? getMemberGradeLabel(user) : "-"}
                </span>
                {allowedProjectRoles.length > 1 && projectRole ? (
                  <ProjectSelectControl
                    ariaLabel={`${user.name} ${filterCopy.roleInEngagement}`}
                    size="sm"
                    className="w-full"
                    disabled={isLockedMember}
                    value={projectRole}
                    onValueChange={(value) =>
                      onRoleChange(user, value as ProjectRole)
                    }
                    options={allowedProjectRoles.map((role) => ({
                      label: getInvitationRoleLabel(user.globalRole, role),
                      value: role,
                    }))}
                  />
                ) : (
                  <span className="text-sm text-foreground">
                    {projectRole
                      ? getRoleInEngagementLabel({
                          globalRole: user.globalRole,
                          projectRole,
                          inChargeRole:
                            member?.inChargeRole ??
                            automaticMember?.inChargeRole ??
                            null,
                        })
                      : "-"}
                  </span>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant={isSelected ? "outline" : "default"}
                  disabled={!projectRole || isLockedMember}
                  accessibleName={`${isSelected ? copy.invitedStatus : copy.inviteAction} ${user.name}`}
                  aria-pressed={isSelected}
                  onClick={() => {
                    if (!isLockedMember) {
                      onToggle(user);
                    }
                  }}
                >
                  <MailPlus data-icon="inline-start" />
                  {isSelected ? copy.invitedStatus : copy.inviteAction}
                </Button>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function RollForwardPreviewCard({
  copy,
  loading,
  preview,
}: {
  copy: ReturnType<
    typeof useI18n
  >["dictionary"]["desktop"]["createProject"]["rollForward"];
  loading: boolean;
  preview?: RollForwardPreview;
}) {
  if (loading) {
    return (
      <div
        className="space-y-2 rounded-md border border-border/70 bg-background/80 p-3"
        aria-busy="true"
        aria-label={copy.loadingSummary}
      >
        <Skeleton className="h-4 w-32 rounded-sm" />
        <Skeleton className="h-4 w-48 rounded-sm" />
      </div>
    );
  }
  if (!preview) {
    return null;
  }

  const summaryItems = [
    {
      label: copy.summary.folders,
      value: preview.summary.workflowNodes,
    },
    {
      label: copy.summary.papers,
      value: preview.summary.workingPapers,
    },
    {
      label: copy.summary.files,
      value: preview.summary.attachments,
    },
    {
      label: copy.summary.versions,
      value: preview.summary.attachmentVersions,
    },
    {
      label: "Smart Form",
      value: preview.summary.smartForms,
    },
  ];

  return (
    <div className="grid gap-3 rounded-md border border-border/70 bg-background/85 p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-primary/25 bg-primary/10 text-primary">
          <RotateCcw className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">
            {preview.project.projectCode} - {preview.project.name}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {copy.retentionNotice}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {summaryItems.map((item) => (
          <div
            key={item.label}
            className="rounded-md border border-border/60 bg-muted/25 px-2 py-1.5 text-center"
          >
            <div className="text-sm font-semibold text-foreground tabular-nums">
              {item.value}
            </div>
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {item.label}
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-1 text-xs text-muted-foreground">
        <div>{copy.retains}</div>
        <div>{copy.resets}</div>
      </div>
    </div>
  );
}

function ProjectSelectControl({
  ariaLabel,
  className = "w-full",
  id,
  value,
  options,
  onValueChange,
  disabled,
  placeholder,
  size,
  contentClassName,
}: {
  ariaLabel?: string;
  className?: string;
  id?: string;
  value: string;
  options: ProjectSelectOption[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  size?: "sm" | "default";
  contentClassName?: string;
}) {
  return (
    <Select
      items={options}
      value={value}
      onValueChange={(nextValue) => onValueChange(String(nextValue ?? ""))}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        label={ariaLabel}
        className={cn(
          "min-h-8 min-w-0 overflow-hidden whitespace-normal",
          className
        )}
        size={size}
      >
        <SelectValue
          className="line-clamp-2 min-w-0 text-left leading-5 break-words whitespace-normal"
          placeholder={placeholder}
        />
      </SelectTrigger>
      <SelectContent
        align="start"
        alignItemWithTrigger={false}
        collisionAvoidance={{ side: "flip", align: "shift" }}
        className={contentClassName}
      >
        <SelectGroup>
          {options.map((option) => (
            <SelectItem
              key={option.value || "empty"}
              value={option.value}
              onClick={() => onValueChange(option.value)}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function ProjectsActivityPanel({
  inboxCopy,
  locale,
  messages,
  messagesLoading,
  readStatePending,
  onOpenMessage,
  onToggleMessageRead,
  onClose,
}: {
  inboxCopy: Dictionary["inbox"];
  locale: Locale;
  messages: InboxMessage[];
  messagesLoading: boolean;
  readStatePending: boolean;
  onOpenMessage: (message: InboxMessage) => void;
  onToggleMessageRead: (message: InboxMessage) => void;
  onClose: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const isPresent = useIsPresent();

  return (
    <motion.aside
      initial={
        reducedMotion
          ? { opacity: 0 }
          : { opacity: 0, transform: "translateX(1rem)" }
      }
      animate={
        reducedMotion ? { opacity: 1 } : { opacity: 1, transform: "none" }
      }
      exit={{
        opacity: 0,
        ...(reducedMotion ? {} : { transform: "translateX(1rem)" }),
        transition: {
          duration: reducedMotion ? 0.12 : 0.18,
          ease: reducedMotion ? "linear" : [0.16, 1, 0.3, 1],
        },
      }}
      transition={{
        duration: reducedMotion ? 0.12 : 0.22,
        ease: reducedMotion ? "linear" : [0.16, 1, 0.3, 1],
      }}
      aria-label={inboxCopy.title}
      aria-hidden={!isPresent}
      inert={!isPresent}
      className={cn(
        "absolute inset-y-0 right-0 z-[60] w-[min(32rem,calc(100%-2rem))] overflow-hidden border-l border-border bg-workbench-sidebar shadow-2xl shadow-foreground/20",
        !isPresent && "pointer-events-none"
      )}
    >
      <WorkbenchActivityPanel
        showQuestions={false}
        inboxCopy={inboxCopy}
        locale={locale}
        messages={messages}
        messagesLoading={messagesLoading}
        readStatePending={readStatePending}
        onOpenMessage={onOpenMessage}
        onToggleMessageRead={onToggleMessageRead}
        onClose={onClose}
        className="bg-workbench-sidebar"
      />
    </motion.aside>
  );
}

function ProjectReviewOverlay({
  dictionary,
  data,
  isPending,
  onConfirm,
  onBack,
}: {
  dictionary: ReturnType<typeof useI18n>["dictionary"];
  data: {
    name: string;
    projectCode: string;
    cmpClientName?: string;
    cmpEngagementName?: string;
    language: string;
    frameworkTemplateId: string;
    frameworkTemplateInput?: string;
    projectTemplateId?: string;
    projectTemplateName?: string;
    rollForwardFromProjectId?: string;
    rollForwardSourceName?: string;
    inheritMembers?: boolean;
    yearEndDate: string;
    reportDate: string;
    archiveDeadline: string;
    notes?: string;
  };
  isPending: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const isPresent = useIsPresent();
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
        "fixed inset-0 z-50 grid place-items-center bg-foreground/35 px-4 backdrop-blur-sm",
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
        className="w-full max-w-xl rounded-lg border border-border bg-card p-6 shadow-xl"
      >
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary">
              {formatDisplayName(data.projectCode)}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">
              {dictionary.workbench.reviewTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {dictionary.workbench.reviewDescription}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 rounded-md border border-border bg-background p-4 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {data.cmpClientName ? (
              <div>
                <span className="text-muted-foreground">
                  {dictionary.desktop.createProject.cmpClient}
                </span>
                <p className="font-medium text-foreground">
                  {formatDisplayName(data.cmpClientName)}
                </p>
              </div>
            ) : null}
            {data.cmpEngagementName ? (
              <div>
                <span className="text-muted-foreground">
                  {dictionary.desktop.createProject.cmpEngagement}
                </span>
                <p className="font-medium text-foreground">
                  {formatDisplayName(data.cmpEngagementName)}
                </p>
              </div>
            ) : null}
            <div>
              <span className="text-muted-foreground">
                {dictionary.projects.name}
              </span>
              <p className="font-medium text-foreground">
                {formatDisplayName(data.name)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">
                {dictionary.projects.projectCode}
              </span>
              <p className="font-medium text-foreground">
                {formatDisplayName(data.projectCode)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">
                {dictionary.projects.language}
              </span>
              <p className="font-medium text-foreground">
                {dictionary.projects.languages?.[
                  data.language as "zh-CN" | "en-US"
                ] ?? data.language}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">
                {dictionary.projects.frameworkTemplate}
              </span>
              <p className="font-medium text-foreground">
                {data.frameworkTemplateInput || data.frameworkTemplateId || "-"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">
                {dictionary.projects.projectTemplate}
              </span>
              <p className="font-medium text-foreground">
                {data.projectTemplateName ||
                  data.projectTemplateId ||
                  dictionary.desktop.createProject.noProjectTemplate}
              </p>
            </div>
            {data.rollForwardFromProjectId ? (
              <div>
                <span className="text-muted-foreground">
                  {dictionary.desktop.createProject.rollForward.sourceLabel}
                </span>
                <p className="font-medium text-foreground">
                  {data.rollForwardSourceName || data.rollForwardFromProjectId}
                  {data.inheritMembers
                    ? ` · ${dictionary.desktop.createProject.rollForward.inheritMembersSuffix}`
                    : ""}
                </p>
              </div>
            ) : null}
            <div>
              <span className="text-muted-foreground">
                {dictionary.projects.yearEndDate}
              </span>
              <p className="font-medium text-foreground">
                {data.yearEndDate
                  ? new Date(data.yearEndDate).toLocaleDateString("zh-CN")
                  : "-"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">
                {dictionary.projects.reportDate}
              </span>
              <p className="font-medium text-foreground">
                {data.reportDate
                  ? new Date(data.reportDate).toLocaleDateString("zh-CN")
                  : "-"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">
                {dictionary.projects.archiveDeadline}
              </span>
              <p className="font-medium text-foreground">
                {data.archiveDeadline
                  ? new Date(data.archiveDeadline).toLocaleDateString("zh-CN")
                  : "-"}
              </p>
            </div>
            {data.notes ? (
              <div>
                <span className="text-muted-foreground">
                  {dictionary.projects.notes}
                </span>
                <p className="font-medium text-foreground">{data.notes}</p>
              </div>
            ) : null}
          </div>
        </div>

        <ButtonGroup className="mt-5 ml-auto">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={onBack}
          >
            <Edit3 className="h-4 w-4" />
            {dictionary.workbench.backToEdit}
          </Button>
          <Button type="button" disabled={isPending} onClick={onConfirm}>
            <CheckCircle2 className="h-4 w-4" />
            {isPending
              ? dictionary.workbench.confirming
              : dictionary.workbench.confirmReview}
          </Button>
        </ButtonGroup>
      </motion.div>
    </motion.div>
  );
}

type ProjectTemplateWorkflowNode = WorkflowNode & {
  sortOrder: number;
  auditAreaCode?: string | null;
  children: ProjectTemplateWorkflowNode[];
};

function ProjectTemplateLibraryWorkspace({
  copy,
  directoryCopy,
  mode = "project",
  templateFileDetailHref,
}: {
  copy: ReturnType<typeof useI18n>["dictionary"]["desktop"]["templateLibrary"];
  directoryCopy?: ReturnType<typeof useI18n>["dictionary"]["workbench"];
  mode?: TemplateLibraryMode;
  templateFileDetailHref?: (templateId: string, fileId: string) => string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { dictionary, locale } = useI18n();
  const libraryMode = mode;
  const [search, setSearch] = useState("");
  const [smartFormStatusFilter, setSmartFormStatusFilter] = useState<
    "ALL" | "DRAFT" | "PUBLISHED"
  >("ALL");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedSmartFormTemplateId, setSelectedSmartFormTemplateId] =
    useState("");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [addNodeTarget, setAddNodeTarget] = useState<WorkflowNode | null>(null);
  const [leftWidth, setLeftWidth] = useState(320);
  const [directoryWidth, setDirectoryWidth] = useState(
    PROJECT_TEMPLATE_DIRECTORY_WIDTH
  );
  const leftPanelLastWidthRef = useRef(320);
  const directoryPanelLastWidthRef = useRef(PROJECT_TEMPLATE_DIRECTORY_WIDTH);
  const libraryResizeStartWidthRef = useRef(320);
  const directoryResizeStartWidthRef = useRef(PROJECT_TEMPLATE_DIRECTORY_WIDTH);
  const [isCreateTemplateOpen, setIsCreateTemplateOpen] = useState(false);
  const [isCreateSmartFormOpen, setIsCreateSmartFormOpen] = useState(false);
  const [isAddSmartFormOpen, setIsAddSmartFormOpen] = useState(false);
  const [isAddPlaceholderOpen, setIsAddPlaceholderOpen] = useState(false);
  const [settingsTemplateId, setSettingsTemplateId] = useState("");
  const [smartFormSettingsTemplateId, setSmartFormSettingsTemplateId] =
    useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateCode, setTemplateCode] = useState("");
  const [templateFrameworkTemplateId, setTemplateFrameworkTemplateId] =
    useState("");
  const [templateZipFile, setTemplateZipFile] = useState<File | null>(null);
  const [smartFormDraft, setSmartFormDraft] = useState<SmartFormTemplateDraft>(
    () => createDefaultSmartFormDraft()
  );
  const [smartFormReferenceTemplateId, setSmartFormReferenceTemplateId] =
    useState("");
  const [smartFormReferenceTitle, setSmartFormReferenceTitle] = useState("");
  const [smartFormReferenceCode, setSmartFormReferenceCode] = useState("");
  const [placeholderCode, setPlaceholderCode] = useState("");
  const [placeholderName, setPlaceholderName] = useState("");
  const [editingTemplateItemCode, setEditingTemplateItemCode] = useState<{
    id: string;
    type: ProjectTemplateOrderedItem["type"];
    value: string;
    error: string;
  } | null>(null);
  const [templateSettingsForm, setTemplateSettingsForm] =
    useState<ProjectTemplateSettingsForm>({
      name: "",
      code: "",
      frameworkTemplateId: "",
      isPublished: false,
    });
  const [smartFormSettingsForm, setSmartFormSettingsForm] =
    useState<ProjectTemplateSettingsForm>({
      name: "",
      code: "",
      frameworkTemplateId: "",
      isPublished: false,
    });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const frameworkTemplatesQuery = useQuery({
    queryKey: ["frameworkTemplates", "templateWorkspace"],
    queryFn: api.frameworkTemplates,
  });
  const templatesQuery = useQuery({
    queryKey: ["projectTemplates", "adminWorkspace"],
    queryFn: () => api.adminProjectTemplates(),
  });
  const smartFormTemplatesQuery = useQuery({
    queryKey: ["smartFormTemplates", "adminWorkspace"],
    queryFn: () => api.adminSmartFormTemplates(),
  });
  const publishedSmartFormTemplatesQuery = useQuery({
    queryKey: ["smartFormTemplates", "published", "templateWorkspace"],
    queryFn: () => api.smartFormTemplates(),
  });
  const templates = templatesQuery.data ?? EMPTY_PROJECT_TEMPLATES;
  const smartFormTemplates =
    smartFormTemplatesQuery.data ?? EMPTY_SMART_FORM_TEMPLATES;
  const publishedSmartFormTemplates =
    publishedSmartFormTemplatesQuery.data ?? EMPTY_SMART_FORM_TEMPLATES;
  const filteredTemplates = useMemo(
    () => filterProjectTemplates(templates, search),
    [search, templates]
  );
  const filteredSmartFormTemplates = useMemo(
    () =>
      filterSmartFormTemplates(smartFormTemplates, search).filter(
        (template) =>
          smartFormStatusFilter === "ALL" ||
          template.status === smartFormStatusFilter
      ),
    [search, smartFormStatusFilter, smartFormTemplates]
  );

  useEffect(() => {
    if (filteredTemplates.length === 0) {
      if (selectedTemplateId) {
        setSelectedTemplateId("");
      }
      return;
    }
    if (
      selectedTemplateId &&
      filteredTemplates.some((template) => template.id === selectedTemplateId)
    ) {
      return;
    }
    setSelectedTemplateId(filteredTemplates[0].id);
  }, [filteredTemplates, selectedTemplateId]);

  useEffect(() => {
    if (filteredSmartFormTemplates.length === 0) {
      if (selectedSmartFormTemplateId) {
        setSelectedSmartFormTemplateId("");
      }
      return;
    }
    if (
      selectedSmartFormTemplateId &&
      filteredSmartFormTemplates.some(
        (template) => template.id === selectedSmartFormTemplateId
      )
    ) {
      return;
    }
    setSelectedSmartFormTemplateId(filteredSmartFormTemplates[0].id);
  }, [filteredSmartFormTemplates, selectedSmartFormTemplateId]);

  const selectedTemplateQuery = useQuery({
    queryKey: ["projectTemplate", "admin", selectedTemplateId],
    queryFn: () => api.adminProjectTemplate(selectedTemplateId),
    enabled: Boolean(selectedTemplateId),
  });
  const selectedTemplate =
    selectedTemplateQuery.data ??
    filteredTemplates.find((template) => template.id === selectedTemplateId) ??
    null;
  const selectedSmartFormTemplate =
    filteredSmartFormTemplates.find(
      (template) => template.id === selectedSmartFormTemplateId
    ) ?? null;
  const templateNodes = selectedTemplate?.nodes ?? EMPTY_PROJECT_TEMPLATE_NODES;
  const templateWorkflow = useMemo(
    () => buildProjectTemplateWorkflow(templateNodes),
    [templateNodes]
  );
  const templateFiles = useMemo(
    () => getProjectTemplateFiles(templateNodes),
    [templateNodes]
  );
  const selectedNode =
    templateNodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedNodeFiles = selectedNode?.files ?? [];
  const selectedNodeSmartForms = selectedNode?.smartForms ?? [];
  const selectedNodeItems = useMemo(
    () => getOrderedProjectTemplateItems(selectedNode),
    [selectedNode]
  );
  const selectedNodeCodePrefix = selectedNode
    ? normalizeProjectTemplateNumericFolderCode(selectedNode.code)
    : null;

  useEffect(() => {
    setAddNodeTarget(null);
  }, [selectedTemplateId]);

  useEffect(() => {
    if (templateNodes.length === 0) {
      if (selectedNodeId) {
        setSelectedNodeId("");
      }
      return;
    }
    if (
      selectedNodeId &&
      templateNodes.some((node) => node.id === selectedNodeId)
    ) {
      return;
    }
    const parentIds = new Set(
      templateNodes
        .map((node) => node.parentId)
        .filter((parentId): parentId is string => Boolean(parentId))
    );
    const firstFileFolder = templateNodes.find(
      (node) => (node.files?.length ?? 0) > 0
    );
    const firstLeaf = templateNodes.find((node) => !parentIds.has(node.id));
    setSelectedNodeId(
      firstFileFolder?.id ?? firstLeaf?.id ?? templateNodes[0].id
    );
  }, [selectedNodeId, templateNodes]);

  useEffect(() => {
    const frameworks = frameworkTemplatesQuery.data ?? [];
    if (frameworks.length === 0) {
      if (templateFrameworkTemplateId) {
        setTemplateFrameworkTemplateId("");
      }
      return;
    }
    const selectedFramework = frameworks.find(
      (template) => template.id === templateFrameworkTemplateId
    );
    if (!selectedFramework) {
      setTemplateFrameworkTemplateId(frameworks[0].id);
    }
  }, [frameworkTemplatesQuery.data, templateFrameworkTemplateId]);

  useEffect(() => {
    if (!isAddSmartFormOpen) {
      return;
    }
    const availableTemplates = publishedSmartFormTemplates.filter(
      (template) => template.currentPublishedVersionId
    );
    const selected = availableTemplates.find(
      (template) => template.id === smartFormReferenceTemplateId
    );
    const nextTemplate = selected ?? availableTemplates[0];
    if (!nextTemplate) {
      setSmartFormReferenceTemplateId("");
      return;
    }
    if (!selected) {
      setSmartFormReferenceTemplateId(nextTemplate.id);
    }
    setSmartFormReferenceTitle((current) => current || nextTemplate.name);
  }, [
    isAddSmartFormOpen,
    publishedSmartFormTemplates,
    smartFormReferenceTemplateId,
  ]);

  const refreshSelectedTemplate = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ["projectTemplates", "adminWorkspace"],
    });
    if (selectedTemplateId) {
      void queryClient.invalidateQueries({
        queryKey: ["projectTemplate", "admin", selectedTemplateId],
      });
    }
  }, [queryClient, selectedTemplateId]);

  function resetTemplateDraft() {
    setTemplateName("");
    setTemplateCode("");
    setTemplateZipFile(null);
  }

  function resetSmartFormDraft() {
    setSmartFormDraft(createDefaultSmartFormDraft());
  }

  function resetSmartFormReferenceDraft() {
    setSmartFormReferenceTemplateId("");
    setSmartFormReferenceTitle("");
    setSmartFormReferenceCode("");
  }

  function resetPlaceholderDraft() {
    setPlaceholderCode("");
    setPlaceholderName("");
  }

  function openPlaceholderDialog() {
    if (!selectedNode) {
      return;
    }
    setPlaceholderCode(
      buildProjectTemplateItemCode(
        selectedNode,
        selectedNodeFiles,
        selectedNodeSmartForms
      )
    );
    setPlaceholderName("");
    setIsAddPlaceholderOpen(true);
  }

  function openSmartFormReferenceDialog() {
    if (!selectedNode) {
      return;
    }
    resetSmartFormReferenceDraft();
    setSmartFormReferenceCode(
      buildProjectTemplateItemCode(
        selectedNode,
        selectedNodeFiles,
        selectedNodeSmartForms
      )
    );
    setIsAddSmartFormOpen(true);
  }

  function getSelectedTemplateFramework() {
    const frameworkTemplate = frameworkTemplatesQuery.data?.find(
      (template) => template.id === templateFrameworkTemplateId
    );
    if (!frameworkTemplate) {
      throw new Error(copy.frameworkLabel);
    }
    return frameworkTemplate;
  }

  const createTemplateMutation = useMutation({
    mutationFn: () => {
      const frameworkTemplate = getSelectedTemplateFramework();
      const input = {
        code: templateCode.trim(),
        name: templateName.trim(),
        language: "zh-CN" as const,
        frameworkTemplateId: frameworkTemplate.id,
      };
      return templateZipFile
        ? api.importProjectTemplateZip(input, templateZipFile)
        : api.createProjectTemplate({
            ...input,
            description: "",
            status: "DRAFT",
          });
    },
    onSuccess: (template) => {
      setIsCreateTemplateOpen(false);
      resetTemplateDraft();
      setSelectedTemplateId(template.id);
      refreshSelectedTemplate();
      toast({
        title: templateZipFile ? copy.importTemplate : copy.createTemplate,
        description: template.name,
      });
    },
    onError: () => {
      toast({
        title: templateZipFile
          ? copy.importTemplateError
          : copy.createTemplateError,
        variant: "destructive",
      });
    },
  });
  const updateTemplateSettingsMutation = useMutation({
    mutationFn: () =>
      api.updateProjectTemplate(settingsTemplateId, {
        code: templateSettingsForm.code.trim(),
        name: templateSettingsForm.name.trim(),
        ...(templateSettingsForm.frameworkTemplateId
          ? { frameworkTemplateId: templateSettingsForm.frameworkTemplateId }
          : {}),
        status: templateSettingsForm.isPublished ? "PUBLISHED" : "DRAFT",
      }),
    onSuccess: (template) => {
      setSettingsTemplateId("");
      setSelectedTemplateId(template.id);
      refreshSelectedTemplate();
      void queryClient.invalidateQueries({ queryKey: ["projectTemplates"] });
      toast({
        title: copy.templateSettingsSavedTitle,
        description: template.name,
      });
    },
    onError: (_unused_error) => {
      toast({
        title: copy.createTemplateError,
        variant: "destructive",
      });
    },
  });
  const deleteProjectTemplateMutation = useMutation({
    mutationFn: (template: ProjectTemplate) =>
      api.deleteProjectTemplate(template.id),
    onSuccess: (template) => {
      if (selectedTemplateId === template.id) {
        setSelectedTemplateId("");
      }
      void queryClient.invalidateQueries({
        queryKey: ["projectTemplates", "adminWorkspace"],
      });
      toast({ title: copy.deleteSuccessTitle, description: template.name });
    },
  });
  const createSmartFormTemplateMutation = useMutation({
    mutationFn: () =>
      api.createSmartFormTemplate({
        code: smartFormDraft.code.trim(),
        name: smartFormDraft.name.trim(),
        frameworkTemplateId: smartFormDraft.frameworkTemplateId || null,
        description: smartFormDraft.description.trim(),
        definition: buildSmartFormV2Definition(
          smartFormDraft,
          dictionary.smartFormV2Designer.sectionTitlePlaceholder
        ),
      }),
    onSuccess: (template) => {
      setIsCreateSmartFormOpen(false);
      resetSmartFormDraft();
      setSelectedSmartFormTemplateId(template.id);
      queryClient.setQueryData<SmartFormTemplate[]>(
        ["smartFormTemplates", "adminWorkspace"],
        (current) => updateSmartFormTemplateList(current, template)
      );
      void queryClient.invalidateQueries({
        queryKey: ["smartFormTemplates", "adminWorkspace"],
      });
      toast({
        title: copy.smartFormTemplateCreatedTitle,
        description: template.name,
      });
    },
    onError: (_unused_error) => {
      toast({
        title: copy.createSmartFormTemplateError,
        variant: "destructive",
      });
    },
  });
  const updateSmartFormTemplateMutation = useMutation({
    mutationFn: ({
      input,
      template,
    }: {
      input: Parameters<typeof api.updateSmartFormTemplate>[1];
      template: SmartFormTemplate;
    }) => api.updateSmartFormTemplate(template.id, input),
    onSuccess: (template) => {
      queryClient.setQueryData<SmartFormTemplate[]>(
        ["smartFormTemplates", "adminWorkspace"],
        (current) => updateSmartFormTemplateList(current, template)
      );
    },
    onError: (_unused_error) => {
      toast({
        title: copy.createSmartFormTemplateError,
        variant: "destructive",
      });
    },
  });
  const updateSmartFormSettingsMutation = useMutation({
    mutationFn: async () => {
      const template = smartFormTemplates.find(
        (item) => item.id === smartFormSettingsTemplateId
      );
      if (!template) {
        throw new Error(copy.selectSmartFormTemplatePrompt);
      }
      const updated = await api.updateSmartFormTemplate(template.id, {
        code: smartFormSettingsForm.code.trim(),
        name: smartFormSettingsForm.name.trim(),
        frameworkTemplateId: smartFormSettingsForm.frameworkTemplateId || null,
        status:
          smartFormSettingsForm.isPublished && template.status === "PUBLISHED"
            ? "PUBLISHED"
            : "DRAFT",
      });
      if (smartFormSettingsForm.isPublished && updated.status !== "PUBLISHED") {
        return api.publishSmartFormTemplate(template.id);
      }
      return updated;
    },
    onSuccess: (template) => {
      setSmartFormSettingsTemplateId("");
      setSelectedSmartFormTemplateId(template.id);
      queryClient.setQueryData<SmartFormTemplate[]>(
        ["smartFormTemplates", "adminWorkspace"],
        (current) => updateSmartFormTemplateList(current, template)
      );
      void queryClient.invalidateQueries({
        queryKey: ["smartFormTemplates", "adminWorkspace"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["smartFormTemplates", "published"],
      });
      toast({
        title: copy.templateSettingsSavedTitle,
        description: template.name,
      });
    },
    onError: (_unused_error) => {
      toast({
        title: copy.createSmartFormTemplateError,
        variant: "destructive",
      });
    },
  });
  const publishSmartFormTemplateMutation = useMutation({
    mutationFn: (template: SmartFormTemplate) =>
      api.publishSmartFormTemplate(template.id),
    onSuccess: (template) => {
      setSelectedSmartFormTemplateId(template.id);
      void queryClient.invalidateQueries({
        queryKey: ["smartFormTemplates", "adminWorkspace"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["smartFormTemplates", "published"],
      });
      toast({
        title: copy.smartFormTemplatePublishedTitle,
        description: template.name,
      });
    },
    onError: (_unused_error) => {
      toast({
        title: copy.publishSmartFormTemplateError,
        variant: "destructive",
      });
    },
  });
  const deleteSmartFormTemplateMutation = useMutation({
    mutationFn: (template: SmartFormTemplate) =>
      api.deleteSmartFormTemplate(template.id),
    onSuccess: (template) => {
      setSelectedSmartFormTemplateId("");
      void queryClient.invalidateQueries({
        queryKey: ["smartFormTemplates", "adminWorkspace"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["smartFormTemplates", "published"],
      });
      toast({
        title: copy.smartFormTemplateDeletedTitle,
        description: template.name,
      });
    },
  });
  const createNodeMutation = useMutation({
    mutationFn: (values: DirectoryNodeForm) =>
      api.createProjectTemplateNode(selectedTemplateId, {
        parentId: addNodeTarget?.id ?? "",
        code: values.code.trim(),
        title: values.title.trim(),
      }),
    onSuccess: (node) => {
      setAddNodeTarget(null);
      setSelectedNodeId(node.id);
      refreshSelectedTemplate();
      toast({ title: copy.folderSuccessTitle, description: node.title });
    },
    onError: () => {
      toast({ title: copy.createTemplateError, variant: "destructive" });
    },
  });
  const updateNodeMutation = useMutation({
    mutationFn: ({
      node,
      values,
    }: {
      node: WorkflowNode;
      values: { code: string; title: string };
    }) =>
      api.updateProjectTemplateNode(selectedTemplateId, node.id, {
        code: values.code.trim(),
        title: values.title,
      }),
    onSuccess: () => {
      refreshSelectedTemplate();
    },
  });
  const deleteNodeMutation = useMutation({
    mutationFn: (node: WorkflowNode) =>
      api.deleteProjectTemplateNode(selectedTemplateId, node.id),
    onSuccess: (node) => {
      setAddNodeTarget(null);
      if (selectedNodeId === node.id) {
        setSelectedNodeId("");
      }
      refreshSelectedTemplate();
      toast({ title: copy.deleteSuccessTitle, description: node.title });
    },
  });
  const uploadFileMutation = useMutation({
    mutationFn: (file: File) => {
      if (!selectedTemplate || !selectedNode) {
        throw new Error(copy.selectFolderPrompt);
      }
      return api.uploadProjectTemplateFile(
        selectedTemplate.id,
        selectedNode.id,
        {},
        file
      );
    },
    onSuccess: (file) => {
      queryClient.setQueryData<ProjectTemplate>(
        ["projectTemplate", "admin", selectedTemplateId],
        (current) => appendProjectTemplateFile(current, file)
      );
      queryClient.setQueryData<ProjectTemplate[]>(
        ["projectTemplates", "adminWorkspace"],
        (current) => updateProjectTemplateListFileCount(current, file)
      );
      void queryClient.invalidateQueries({
        queryKey: ["projectTemplates", "adminWorkspace"],
      });
      toast({ title: copy.uploadSuccessTitle, description: file.title });
    },
  });
  const createPlaceholderMutation = useMutation({
    mutationFn: () => {
      if (!selectedTemplate || !selectedNode) {
        throw new Error(copy.selectFolderPrompt);
      }
      return api.createProjectTemplatePlaceholder(
        selectedTemplate.id,
        selectedNode.id,
        {
          code: placeholderCode.trim(),
          title: placeholderName.trim(),
          placeholderType: "GENERIC",
        }
      );
    },
    onSuccess: (file) => {
      setIsAddPlaceholderOpen(false);
      resetPlaceholderDraft();
      queryClient.setQueryData<ProjectTemplate>(
        ["projectTemplate", "admin", selectedTemplateId],
        (current) => appendProjectTemplateFile(current, file)
      );
      queryClient.setQueryData<ProjectTemplate[]>(
        ["projectTemplates", "adminWorkspace"],
        (current) => updateProjectTemplateListFileCount(current, file)
      );
      void queryClient.invalidateQueries({
        queryKey: ["projectTemplates", "adminWorkspace"],
      });
      toast({
        title: copy.placeholderCreatedTitle,
        description: file.title,
      });
    },
    onError: () => {
      toast({
        title: copy.placeholderCreateError,
        variant: "destructive",
      });
    },
  });
  const deleteFileMutation = useMutation({
    mutationFn: (file: ProjectTemplateFile) => {
      if (!selectedTemplate) {
        throw new Error(copy.noTemplateSelected);
      }
      return api.deleteProjectTemplateFile(selectedTemplate.id, file.id);
    },
    onSuccess: (file) => {
      refreshSelectedTemplate();
      toast({ title: copy.deleteSuccessTitle, description: file.title });
    },
  });
  const createSmartFormReferenceMutation = useMutation({
    mutationFn: () => {
      if (!selectedTemplate || !selectedNode) {
        throw new Error(copy.selectFolderPrompt);
      }
      const template = publishedSmartFormTemplates.find(
        (item) => item.id === smartFormReferenceTemplateId
      );
      if (!template?.currentPublishedVersionId) {
        throw new Error(copy.noPublishedSmartForms);
      }
      return api.createProjectTemplateSmartForm(
        selectedTemplate.id,
        selectedNode.id,
        {
          smartFormTemplateVersionId: template.currentPublishedVersionId,
          code: smartFormReferenceCode.trim(),
          title: smartFormReferenceTitle.trim(),
        }
      );
    },
    onSuccess: async (reference) => {
      setIsAddSmartFormOpen(false);
      resetSmartFormReferenceDraft();
      queryClient.setQueryData<ProjectTemplate>(
        ["projectTemplate", "admin", reference.projectTemplateId],
        (current) => appendProjectTemplateSmartForm(current, reference)
      );
      queryClient.setQueryData<ProjectTemplate[]>(
        ["projectTemplates", "adminWorkspace"],
        (current) => updateProjectTemplateListSmartFormCount(current, reference)
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["projectTemplate", "admin", reference.projectTemplateId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["projectTemplates", "adminWorkspace"],
        }),
      ]);
      toast({
        title: copy.smartFormReferenceAddedTitle,
        description: reference.title,
      });
    },
    onError: (_unused_error) => {
      toast({
        title: copy.addSmartFormToFolder,
        variant: "destructive",
      });
    },
  });
  const deleteSmartFormReferenceMutation = useMutation({
    mutationFn: (reference: ProjectTemplateSmartForm) => {
      if (!selectedTemplate) {
        throw new Error(copy.noTemplateSelected);
      }
      return api.deleteProjectTemplateSmartForm(
        selectedTemplate.id,
        reference.id
      );
    },
    onSuccess: (reference) => {
      refreshSelectedTemplate();
      toast({
        title: copy.smartFormReferenceDeletedTitle,
        description: reference.title,
      });
    },
  });
  const updateTemplateItemCodeMutation = useMutation({
    mutationFn: ({
      item,
      sequence,
    }: {
      item: ProjectTemplateOrderedItem;
      sequence: number;
    }): Promise<ProjectTemplateFile | ProjectTemplateSmartForm> => {
      if (!selectedTemplate) {
        throw new Error(copy.noTemplateSelected);
      }
      return item.type === "FILE"
        ? api.updateProjectTemplateFileCode(selectedTemplate.id, item.id, {
            sequence,
          })
        : api.updateProjectTemplateSmartFormCode(selectedTemplate.id, item.id, {
            sequence,
          });
    },
    onSuccess: (updated, variables) => {
      queryClient.setQueryData<ProjectTemplate>(
        ["projectTemplate", "admin", selectedTemplateId],
        (current) =>
          updateProjectTemplateItem(current, variables.item.type, updated)
      );
    },
    onError: (_error, variables) => {
      setEditingTemplateItemCode({
        id: variables.item.id,
        type: variables.item.type,
        value: String(variables.sequence),
        error: copy.updateItemCodeError,
      });
      toast({ title: copy.updateItemCodeError, variant: "destructive" });
    },
  });
  const reorderTemplateItemsMutation = useMutation({
    mutationFn: ({
      items,
    }: {
      items: ProjectTemplateOrderedItem[];
      previous: ProjectTemplateOrderedItem[];
    }) => {
      if (!selectedTemplate || !selectedNode) {
        throw new Error(copy.selectFolderPrompt);
      }
      return api.reorderProjectTemplateItems(
        selectedTemplate.id,
        selectedNode.id,
        {
          items: items.map(({ id, type }) => ({ id, type })),
        }
      );
    },
    onSuccess: ({ items }) => {
      queryClient.setQueryData<ProjectTemplate>(
        ["projectTemplate", "admin", selectedTemplateId],
        (current) =>
          replaceProjectTemplateNodeItems(current, selectedNodeId, items)
      );
    },
    onError: (_error, variables) => {
      queryClient.setQueryData<ProjectTemplate>(
        ["projectTemplate", "admin", selectedTemplateId],
        (current) =>
          replaceProjectTemplateNodeItems(
            current,
            selectedNodeId,
            variables.previous
          )
      );
      toast({ title: copy.reorderItemsError, variant: "destructive" });
    },
  });

  function startEditingTemplateItemCode(item: ProjectTemplateOrderedItem) {
    if (!selectedNodeCodePrefix) {
      return;
    }
    setEditingTemplateItemCode({
      id: item.id,
      type: item.type,
      value: getProjectTemplateItemSequence(item.code, selectedNodeCodePrefix),
      error: "",
    });
  }

  function updateEditingTemplateItemValue(
    item: ProjectTemplateOrderedItem,
    value: string
  ) {
    const digits = value.replaceAll(/\D/g, "");
    const sequence = Number(digits);
    const nextCode = selectedNodeCodePrefix
      ? `${selectedNodeCodePrefix}.${sequence}`
      : "";
    const error =
      !digits || !Number.isSafeInteger(sequence) || sequence < 1
        ? copy.invalidItemSequence
        : selectedNodeItems.some(
              (candidate) =>
                candidate.id !== item.id && candidate.code === nextCode
            )
          ? copy.duplicateItemCode
          : "";
    setEditingTemplateItemCode({
      id: item.id,
      type: item.type,
      value: digits,
      error,
    });
  }

  function commitTemplateItemCode(item: ProjectTemplateOrderedItem) {
    const draft = editingTemplateItemCode;
    if (!draft || draft.id !== item.id || draft.type !== item.type) {
      return;
    }
    const sequence = Number(draft.value);
    if (draft.error || !Number.isSafeInteger(sequence) || sequence < 1) {
      return;
    }
    setEditingTemplateItemCode(null);
    if (item.code === `${selectedNodeCodePrefix}.${sequence}`) {
      return;
    }
    updateTemplateItemCodeMutation.mutate({ item, sequence });
  }

  function setOrderedTemplateItems(items: ProjectTemplateOrderedItem[]) {
    if (!selectedNodeCodePrefix) {
      return;
    }
    const renumbered = items.map((item, index) => ({
      ...item,
      sortOrder: index + 1,
      code: `${selectedNodeCodePrefix}.${index + 1}`,
    })) as ProjectTemplateOrderedItem[];
    queryClient.setQueryData<ProjectTemplate>(
      ["projectTemplate", "admin", selectedTemplateId],
      (current) =>
        replaceProjectTemplateNodeItems(current, selectedNodeId, renumbered)
    );
  }

  function openTemplateSettings(template: ProjectTemplate) {
    setSettingsTemplateId(template.id);
    setTemplateSettingsForm({
      name: template.name,
      code: template.code,
      frameworkTemplateId: template.frameworkTemplateId ?? "",
      isPublished: template.status === "PUBLISHED",
    });
  }

  function openSmartFormSettings(template: SmartFormTemplate) {
    setSmartFormSettingsTemplateId(template.id);
    setSmartFormSettingsForm({
      name: template.name,
      code: template.code,
      frameworkTemplateId: template.frameworkTemplateId ?? "",
      isPublished: template.status === "PUBLISHED",
    });
  }

  function handleLibraryResizeStart(event: ReactPointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    libraryResizeStartWidthRef.current = leftWidth;
  }

  function handleLibraryResize(deltaX: number) {
    const width = clampNumber(
      libraryResizeStartWidthRef.current + deltaX,
      260,
      420
    );
    setLeftWidth(width);
    leftPanelLastWidthRef.current = width;
  }

  function handleLibraryResizeCancel() {
    setLeftWidth(libraryResizeStartWidthRef.current);
  }

  function handleDirectoryResizeStart(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    event.stopPropagation();
    directoryResizeStartWidthRef.current = directoryWidth;
  }

  function handleDirectoryResize(deltaX: number) {
    const width = clampNumber(
      directoryResizeStartWidthRef.current + deltaX,
      PROJECT_TEMPLATE_DIRECTORY_MIN_WIDTH,
      PROJECT_TEMPLATE_DIRECTORY_MAX_WIDTH
    );
    setDirectoryWidth(width);
    directoryPanelLastWidthRef.current = width;
  }

  function handleDirectoryResizeCancel() {
    setDirectoryWidth(directoryResizeStartWidthRef.current);
  }

  function toggleTemplateLibraryPanel() {
    if (leftWidth <= 0) {
      const width = leftPanelLastWidthRef.current;
      setLeftWidth(width);
      return;
    }

    leftPanelLastWidthRef.current = leftWidth;
    setLeftWidth(0);
  }

  function toggleTemplateDirectoryPanel() {
    if (directoryWidth <= 0) {
      const width = directoryPanelLastWidthRef.current;
      setDirectoryWidth(width);
      return;
    }

    directoryPanelLastWidthRef.current = directoryWidth;
    setDirectoryWidth(0);
  }

  return (
    <div
      className={cn(
        "emp-splitter-layout flex h-full min-h-0 bg-app-panel",
        libraryMode === "smart-form" ? "p-2" : "p-3"
      )}
    >
      <DynamicBox
        className="emp-splitter-panel flex min-h-0 shrink-0 flex-col overflow-hidden rounded-md border border-border bg-workbench-sidebar shadow-xs"
        width={leftWidth}
      >
        {libraryMode === "project" ? (
          <div className="border-b border-border">
            <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border/70 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {copy.projectTemplatesLabel}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDesktopCopy(copy.templateCount, {
                    count: templates.length,
                  })}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => {
                  resetTemplateDraft();
                  setIsCreateTemplateOpen(true);
                }}
              >
                <Plus className="size-4" />
                <span>{copy.newOrImportProjectTemplate}</span>
              </Button>
            </div>
            <div className="p-2.5">
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.currentTarget.value)}
                    className="h-8 bg-background pl-8 text-xs shadow-none"
                    placeholder={copy.searchPlaceholder}
                    label={copy.searchLabel}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="border-b border-border">
            <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border/70 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {copy.smartFormsLabel}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDesktopCopy(copy.templateCount, {
                    count: smartFormTemplates.length,
                  })}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => {
                  resetSmartFormDraft();
                  setIsCreateSmartFormOpen(true);
                }}
              >
                <Plus className="size-4" />
                <span>{copy.newSmartFormTemplate}</span>
              </Button>
            </div>
            <div className="p-2.5">
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.currentTarget.value)}
                    className="h-8 bg-background pl-8 text-xs shadow-none"
                    placeholder={copy.searchPlaceholder}
                    label={copy.searchLabel}
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        className="shrink-0"
                        tooltip={copy.filterSmartForms}
                        aria-label={copy.filterSmartForms}
                      />
                    }
                  >
                    <Funnel className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-44">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>
                        {copy.filterSmartForms}
                      </DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={smartFormStatusFilter}
                        onValueChange={(nextStatus) =>
                          setSmartFormStatusFilter(
                            nextStatus as "ALL" | "DRAFT" | "PUBLISHED"
                          )
                        }
                      >
                        <DropdownMenuRadioItem value="ALL">
                          {copy.allSmartFormStatuses}
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="PUBLISHED">
                          {copy.publishedStatus}
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="DRAFT">
                          {copy.draftStatus}
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-2">
          {libraryMode === "project" ? (
            templatesQuery.isLoading ? (
              <div
                className="space-y-2 p-1"
                aria-busy="true"
                aria-label={copy.loading}
              >
                <Skeleton className="h-16 w-full rounded-md" />
                <Skeleton className="h-16 w-full rounded-md" />
                <Skeleton className="h-16 w-full rounded-md" />
              </div>
            ) : filteredTemplates.length > 0 ? (
              <div className="grid gap-1.5">
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    className={cn(
                      "relative flex w-full min-w-0 items-start gap-1 rounded-md border p-2 pl-3 text-left transition-colors",
                      template.id === selectedTemplateId
                        ? "border-primary/30 bg-primary/8 text-foreground shadow-xs"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-background hover:text-foreground"
                    )}
                  >
                    {template.id === selectedTemplateId ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary"
                      />
                    ) : null}
                    <Button
                      type="button"
                      aria-pressed={template.id === selectedTemplateId}
                      variant="ghost"
                      className="h-auto min-w-0 flex-1 justify-start overflow-hidden px-0 py-0 text-left hover:bg-transparent"
                      onClick={() => setSelectedTemplateId(template.id)}
                    >
                      <span className="grid min-w-0 flex-1 gap-1">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {template.name}
                        </span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {template.code}
                          {template.frameworkTemplate
                            ? ` · ${template.frameworkTemplate.code}`
                            : ` · ${copy.globalTemplate}`}
                        </span>
                        <span className="mt-1 flex min-w-0 items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-5 rounded-full px-2 text-[11px]",
                              template.status === "PUBLISHED"
                                ? "border-primary/20 bg-primary/8 text-primary"
                                : "border-warning/40 bg-warning/20 text-warning"
                            )}
                          >
                            {template.status === "PUBLISHED"
                              ? copy.publishedStatus
                              : copy.draftStatus}
                          </Badge>
                          <span className="truncate text-[11px] text-muted-foreground">
                            {formatDesktopCopy(
                              copy.templateSummaryWithSmartForms ??
                                "{nodes} folders · {files} files · {smartForms} Smart Forms",
                              {
                                nodes:
                                  template._count?.nodes ??
                                  template.nodes?.length ??
                                  0,
                                files:
                                  template._count?.files ??
                                  getProjectTemplateFiles(template.nodes ?? [])
                                    .length,
                                smartForms:
                                  template._count?.smartForms ??
                                  getProjectTemplateSmartForms(
                                    template.nodes ?? []
                                  ).length,
                              }
                            )}
                          </span>
                        </span>
                      </span>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                            tooltip={dictionary.common.moreActions}
                            aria-label={`${template.name}: ${dictionary.common.moreActions}`}
                          />
                        }
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-40">
                        <DropdownMenuItem
                          onClick={() => openTemplateSettings(template)}
                        >
                          <Settings className="size-4" />
                          {copy.templateSettings}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          disabled={deleteProjectTemplateMutation.isPending}
                          onClick={() =>
                            deleteProjectTemplateMutation.mutate(template)
                          }
                        >
                          <Trash2 className="size-4" />
                          {copy.deleteProjectTemplate ?? copy.deleteFile}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            ) : (
              <TemplateWorkspaceEmpty
                title={templates.length > 0 ? copy.noResults : copy.empty}
              />
            )
          ) : smartFormTemplatesQuery.isLoading ? (
            <div
              className="space-y-2 p-1"
              aria-busy="true"
              aria-label={copy.loading}
            >
              <Skeleton className="h-16 w-full rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
            </div>
          ) : filteredSmartFormTemplates.length > 0 ? (
            <div className="grid gap-1.5">
              {filteredSmartFormTemplates.map((template) => (
                <div
                  key={template.id}
                  className={cn(
                    "relative flex w-full min-w-0 items-start gap-1 rounded-md border p-2 pl-3 text-left transition-colors",
                    template.id === selectedSmartFormTemplateId
                      ? "border-primary/30 bg-primary/8 text-foreground shadow-xs"
                      : "border-transparent text-muted-foreground hover:border-border hover:bg-background hover:text-foreground"
                  )}
                >
                  {template.id === selectedSmartFormTemplateId ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary"
                    />
                  ) : null}
                  <Button
                    type="button"
                    aria-pressed={template.id === selectedSmartFormTemplateId}
                    variant="ghost"
                    className="h-auto min-w-0 flex-1 justify-start overflow-hidden px-0 py-0 text-left hover:bg-transparent"
                    onClick={() => setSelectedSmartFormTemplateId(template.id)}
                  >
                    <span className="grid min-w-0 flex-1 gap-1">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {template.name}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {template.code}
                        {template.frameworkTemplate
                          ? ` · ${template.frameworkTemplate.code}`
                          : ` · ${copy.globalTemplate}`}
                      </span>
                      <span className="mt-1 flex min-w-0 items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-5 rounded-full px-2 text-[11px]",
                            template.status === "PUBLISHED"
                              ? "border-primary/20 bg-primary/8 text-primary"
                              : "border-warning/40 bg-warning/20 text-warning"
                          )}
                        >
                          {template.status === "PUBLISHED"
                            ? copy.publishedStatus
                            : copy.draftStatus}
                        </Badge>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {formatSmartFormSummary(
                            copy.smartFormTemplateSummary,
                            template.draftDefinitionJson,
                            dictionary.smartFormV2Designer.invalidDefinition
                          )}
                        </span>
                      </span>
                    </span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                          tooltip={dictionary.common.moreActions}
                          aria-label={`${template.name}: ${dictionary.common.moreActions}`}
                        />
                      }
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-40">
                      <DropdownMenuItem
                        onClick={() => openSmartFormSettings(template)}
                      >
                        <Settings className="size-4" />
                        {copy.smartFormSettings ?? copy.templateSettings}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        disabled={deleteSmartFormTemplateMutation.isPending}
                        onClick={() =>
                          deleteSmartFormTemplateMutation.mutate(template)
                        }
                      >
                        <Trash2 className="size-4" />
                        {copy.deleteSmartFormTemplate}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          ) : (
            <TemplateWorkspaceEmpty
              title={
                smartFormTemplates.length > 0 ? copy.noResults : copy.empty
              }
            />
          )}
        </div>
      </DynamicBox>

      <SplitterRail
        className="w-3 text-muted-foreground"
        expanded={leftWidth > 0}
        hitAreaTestId="template-library-splitter-hit-area"
        label={copy.resizeTemplateWorkspacePanels}
        max={420}
        min={0}
        onDrag={handleLibraryResize}
        onDragCancel={handleLibraryResizeCancel}
        onPointerDown={handleLibraryResizeStart}
        onToggle={toggleTemplateLibraryPanel}
        value={leftWidth}
      />

      <section className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {libraryMode === "project" ? (
          selectedTemplate ? (
            <div className="emp-splitter-layout flex h-full min-h-0">
              <DynamicBox
                data-testid="project-template-directory-panel"
                className="emp-splitter-panel h-full min-h-0 shrink-0 overflow-hidden rounded-lg border border-border bg-workbench-sidebar"
                width={directoryWidth}
              >
                <WorkbenchDirectory
                  copy={directoryCopy}
                  workflow={templateWorkflow}
                  selectedNodeId={selectedNodeId}
                  addNodeTarget={addNodeTarget}
                  setSelectedNodeId={(id) => {
                    setAddNodeTarget(null);
                    setSelectedNodeId(id);
                  }}
                  openAddNode={(target) => {
                    setSelectedNodeId(target.id);
                    setAddNodeTarget(target);
                  }}
                  closeAddNode={() => setAddNodeTarget(null)}
                  createNode={(values) => createNodeMutation.mutate(values)}
                  createNodePending={createNodeMutation.isPending}
                  renameNode={(node, values) =>
                    updateNodeMutation.mutate({ node, values })
                  }
                  renameNodePending={updateNodeMutation.isPending}
                  deleteNode={(node) => deleteNodeMutation.mutate(node)}
                  deleteNodePending={deleteNodeMutation.isPending}
                  isLoading={selectedTemplateQuery.isLoading}
                  className="border-0 bg-transparent"
                />
              </DynamicBox>

              <SplitterRail
                className="w-3 text-muted-foreground"
                expanded={directoryWidth > 0}
                hitAreaTestId="template-directory-splitter-hit-area"
                label={copy.resizeTemplateWorkspacePanels}
                max={PROJECT_TEMPLATE_DIRECTORY_MAX_WIDTH}
                min={PROJECT_TEMPLATE_DIRECTORY_MIN_WIDTH}
                onDrag={handleDirectoryResize}
                onDragCancel={handleDirectoryResizeCancel}
                onPointerDown={handleDirectoryResizeStart}
                onToggle={toggleTemplateDirectoryPanel}
                value={directoryWidth}
              />

              <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-workbench-panel">
                <div className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-4 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="shrink-0 text-sm font-semibold text-foreground">
                      {copy.templateFiles}
                    </h2>
                    <span className="truncate text-xs text-muted-foreground">
                      {selectedNode
                        ? formatDisplayName(selectedNode.code)
                        : formatDesktopCopy(copy.fileCount, {
                            count: templateFiles.length,
                          })}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <FileInput
                      ref={fileInputRef}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        event.currentTarget.value = "";
                        if (file) {
                          uploadFileMutation.mutate(file);
                        }
                      }}
                    />
                    <ButtonGroup
                      className={cn(
                        "gap-2",
                        BUTTON_GROUP_SEPARATED_ITEMS_CLASS
                      )}
                    >
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!selectedNode}
                        onClick={openPlaceholderDialog}
                      >
                        <FileText className="mr-2 size-4" />
                        {copy.addPlaceholderToFolder}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!selectedNode}
                        onClick={openSmartFormReferenceDialog}
                      >
                        <ClipboardList className="mr-2 size-4" />
                        {copy.addSmartFormToFolder}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!selectedNode || uploadFileMutation.isPending}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="mr-2 size-4" />
                        {copy.uploadFile}
                      </Button>
                    </ButtonGroup>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  {selectedTemplateQuery.isLoading ? (
                    <div
                      className="space-y-2 p-4"
                      aria-busy="true"
                      aria-label={copy.loading}
                    >
                      <Skeleton className="h-8 w-full rounded-md" />
                      <Skeleton className="h-8 w-full rounded-md" />
                      <Skeleton className="h-8 w-full rounded-md" />
                    </div>
                  ) : selectedNodeItems.length > 0 ? (
                    <div className="min-w-0">
                      {selectedNodeCodePrefix ? null : (
                        <div className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-xs text-warning-foreground">
                          {copy.numericFolderRequired}
                        </div>
                      )}
                      <div className="grid grid-cols-[9rem_minmax(0,1fr)_8rem_6rem] border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground">
                        <span>{copy.code}</span>
                        <span>{copy.titleColumn}</span>
                        <span>{copy.fileSize}</span>
                        <span />
                      </div>
                      <Sortable
                        activationMode="long-press"
                        dropAnimationMode="none"
                        getItemValue={(item) => `${item.type}:${item.id}`}
                        strategy="vertical"
                        value={selectedNodeItems}
                        onValueChange={setOrderedTemplateItems}
                        onValueCommit={(items, { previousValue }) =>
                          reorderTemplateItemsMutation.mutate({
                            items,
                            previous: previousValue,
                          })
                        }
                      >
                        {selectedNodeItems.map((item) => {
                          const isFile = item.type === "FILE";
                          const detailHref =
                            isFile &&
                            !item.placeholderType &&
                            item.fileUrl &&
                            selectedTemplate
                              ? templateFileDetailHref?.(
                                  selectedTemplate.id,
                                  item.id
                                )
                              : null;
                          const isEditing =
                            editingTemplateItemCode?.id === item.id &&
                            editingTemplateItemCode.type === item.type;
                          return (
                            <SortableItem
                              key={`${item.type}:${item.id}`}
                              value={`${item.type}:${item.id}`}
                              dragHandleOnly={false}
                              disabled={
                                !selectedNodeCodePrefix ||
                                selectedNodeItems.length < 2 ||
                                reorderTemplateItemsMutation.isPending
                              }
                              className="grid cursor-grab grid-cols-[9rem_minmax(0,1fr)_8rem_6rem] items-center gap-0 border-b border-border bg-background px-4 py-2.5 text-sm last:border-b-0 data-[disabled=true]:cursor-default data-[overlay=true]:shadow-lg"
                            >
                              <span className="min-w-0 font-mono text-xs text-muted-foreground">
                                {isEditing && selectedNodeCodePrefix ? (
                                  <span
                                    className="grid gap-1"
                                    onPointerDown={(event) =>
                                      event.stopPropagation()
                                    }
                                  >
                                    <span className="flex items-center">
                                      <span>{selectedNodeCodePrefix}.</span>
                                      <Input
                                        autoFocus
                                        aria-label={copy.itemCodeSequence}
                                        className="h-7 w-14 px-1.5 font-mono text-xs"
                                        inputMode="numeric"
                                        value={editingTemplateItemCode.value}
                                        onBlur={() =>
                                          commitTemplateItemCode(item)
                                        }
                                        onChange={(event) =>
                                          updateEditingTemplateItemValue(
                                            item,
                                            event.target.value
                                          )
                                        }
                                        onKeyDown={(event) => {
                                          if (event.key === "Escape") {
                                            event.preventDefault();
                                            setEditingTemplateItemCode(null);
                                          }
                                          if (event.key === "Enter") {
                                            event.preventDefault();
                                            commitTemplateItemCode(item);
                                          }
                                        }}
                                      />
                                    </span>
                                    {editingTemplateItemCode.error ? (
                                      <span className="text-[10px] leading-tight text-destructive">
                                        {editingTemplateItemCode.error}
                                      </span>
                                    ) : null}
                                  </span>
                                ) : (
                                  <SharedButton
                                    variant="quiet"
                                    size="sm"
                                    type="button"
                                    className="rounded px-1 py-0.5 text-left hover:bg-muted disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                    disabled={!selectedNodeCodePrefix}
                                    title={copy.editItemCode}
                                    onClick={() =>
                                      startEditingTemplateItemCode(item)
                                    }
                                    onPointerDown={(event) =>
                                      event.stopPropagation()
                                    }
                                  >
                                    {item.code}
                                  </SharedButton>
                                )}
                              </span>
                              <span className="flex min-w-0 items-center gap-2">
                                {isFile ? (
                                  <ProjectFileTypeIcon
                                    fileName={
                                      item.originalName ||
                                      item.fileName ||
                                      item.title
                                    }
                                  />
                                ) : (
                                  <ClipboardList className="size-4 shrink-0 text-muted-foreground" />
                                )}
                                <span className="truncate text-foreground">
                                  {item.title}
                                </span>
                                {isFile && item.placeholderType ? (
                                  <Badge
                                    variant="outline"
                                    className="shrink-0 font-normal"
                                  >
                                    {copy.placeholderBadge}
                                  </Badge>
                                ) : null}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {isFile
                                  ? item.placeholderType
                                    ? "—"
                                    : formatFileSize(item.fileSize)
                                  : copy.smartFormsInFolder}
                              </span>
                              <span
                                className="flex justify-end gap-1"
                                onPointerDown={(event) =>
                                  event.stopPropagation()
                                }
                              >
                                {detailHref ? (
                                  <Link
                                    href={detailHref}
                                    title={copy.viewTemplateFile}
                                    className="grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none"
                                  >
                                    <FileSearch className="size-4" />
                                  </Link>
                                ) : null}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-destructive"
                                  onClick={() =>
                                    isFile
                                      ? deleteFileMutation.mutate(item)
                                      : deleteSmartFormReferenceMutation.mutate(
                                          item
                                        )
                                  }
                                >
                                  <Trash2 className="size-4" />
                                  <span className="sr-only">
                                    {isFile
                                      ? copy.deleteFile
                                      : copy.deleteSmartFormReference}
                                  </span>
                                </Button>
                              </span>
                            </SortableItem>
                          );
                        })}
                      </Sortable>
                    </div>
                  ) : (
                    <TemplateWorkspaceEmpty
                      title={
                        selectedNode
                          ? copy.emptyFolder
                          : copy.selectFolderPrompt
                      }
                    />
                  )}
                </div>
              </section>
            </div>
          ) : (
            <TemplateWorkspaceEmpty title={copy.selectTemplatePrompt} />
          )
        ) : (
          <SmartFormTemplateDetail
            copy={copy}
            designerCopy={dictionary.smartFormV2Designer}
            readonlyCopy={dictionary.smartFormV2Preview}
            locale={locale}
            isLoading={smartFormTemplatesQuery.isLoading}
            template={selectedSmartFormTemplate}
            onPublish={(template) =>
              publishSmartFormTemplateMutation.mutate(template)
            }
            onDelete={(template) =>
              deleteSmartFormTemplateMutation.mutate(template)
            }
            onUpdateDefinition={(template, definition) =>
              updateSmartFormTemplateMutation.mutate({
                template,
                input: { definition },
              })
            }
            publishPending={publishSmartFormTemplateMutation.isPending}
            deletePending={deleteSmartFormTemplateMutation.isPending}
            updatePending={updateSmartFormTemplateMutation.isPending}
          />
        )}
      </section>

      <Dialog
        open={Boolean(settingsTemplateId)}
        onOpenChange={(open) => {
          if (!open) {
            setSettingsTemplateId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.templateSettings}</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (
                templateSettingsForm.name.trim() &&
                templateSettingsForm.code.trim()
              ) {
                updateTemplateSettingsMutation.mutate();
              }
            }}
          >
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="project-template-settings-name">
                  {copy.templateName}
                </Label>
                <Input
                  id="project-template-settings-name"
                  value={templateSettingsForm.name}
                  onChange={(event) => {
                    const { value } = event.currentTarget;
                    setTemplateSettingsForm((current) => ({
                      ...current,
                      name: value,
                    }));
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="project-template-settings-code">
                  {copy.templateCode}
                </Label>
                <Input
                  id="project-template-settings-code"
                  value={templateSettingsForm.code}
                  onChange={(event) => {
                    const { value } = event.currentTarget;
                    setTemplateSettingsForm((current) => ({
                      ...current,
                      code: value,
                    }));
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="project-template-settings-framework">
                  {copy.recommendedFrameworkLabel}
                </Label>
                <ProjectSelectControl
                  id="project-template-settings-framework"
                  value={templateSettingsForm.frameworkTemplateId}
                  onValueChange={(value) => {
                    setTemplateSettingsForm((current) => ({
                      ...current,
                      frameworkTemplateId: value,
                    }));
                  }}
                  disabled={!frameworkTemplatesQuery.data?.length}
                  options={(frameworkTemplatesQuery.data ?? []).map(
                    (template) => ({
                      label: `${template.code} - ${template.name}`,
                      value: template.id,
                    })
                  )}
                />
              </div>
              <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                <Checkbox
                  label={copy.publishedToggleLabel}
                  checked={templateSettingsForm.isPublished}
                  onCheckedChange={(checked) => {
                    setTemplateSettingsForm((current) => ({
                      ...current,
                      isPublished: checked === true,
                    }));
                  }}
                />
                <span>{copy.publishedToggleLabel}</span>
              </div>
            </div>
            <DialogFooter>
              <ButtonGroup>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSettingsTemplateId("")}
                >
                  {copy.cancel}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !templateSettingsForm.name.trim() ||
                    !templateSettingsForm.code.trim() ||
                    updateTemplateSettingsMutation.isPending
                  }
                >
                  {copy.saveTemplateSettings}
                </Button>
              </ButtonGroup>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(smartFormSettingsTemplateId)}
        onOpenChange={(open) => {
          if (!open) {
            setSmartFormSettingsTemplateId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {copy.smartFormSettings ?? copy.templateSettings}
            </DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (
                smartFormSettingsForm.name.trim() &&
                smartFormSettingsForm.code.trim()
              ) {
                updateSmartFormSettingsMutation.mutate();
              }
            }}
          >
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="smart-form-settings-name">
                  {copy.smartFormName}
                </Label>
                <Input
                  id="smart-form-settings-name"
                  value={smartFormSettingsForm.name}
                  onChange={(event) => {
                    const { value } = event.currentTarget;
                    setSmartFormSettingsForm((current) => ({
                      ...current,
                      name: value,
                    }));
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="smart-form-settings-code">
                  {copy.smartFormCode}
                </Label>
                <Input
                  id="smart-form-settings-code"
                  value={smartFormSettingsForm.code}
                  onChange={(event) => {
                    const { value } = event.currentTarget;
                    setSmartFormSettingsForm((current) => ({
                      ...current,
                      code: value,
                    }));
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="smart-form-settings-framework">
                  {copy.recommendedFrameworkLabel}
                </Label>
                <ProjectSelectControl
                  id="smart-form-settings-framework"
                  value={smartFormSettingsForm.frameworkTemplateId}
                  onValueChange={(value) => {
                    setSmartFormSettingsForm((current) => ({
                      ...current,
                      frameworkTemplateId: value,
                    }));
                  }}
                  options={[
                    { label: copy.globalTemplate, value: "" },
                    ...(frameworkTemplatesQuery.data ?? []).map((template) => ({
                      label: `${template.code} - ${template.name}`,
                      value: template.id,
                    })),
                  ]}
                />
              </div>
              <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                <Checkbox
                  label={copy.publishedToggleLabel}
                  checked={smartFormSettingsForm.isPublished}
                  onCheckedChange={(checked) => {
                    setSmartFormSettingsForm((current) => ({
                      ...current,
                      isPublished: checked === true,
                    }));
                  }}
                />
                <span>{copy.publishedToggleLabel}</span>
              </div>
            </div>
            <DialogFooter>
              <ButtonGroup>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSmartFormSettingsTemplateId("")}
                >
                  {copy.cancel}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !smartFormSettingsForm.name.trim() ||
                    !smartFormSettingsForm.code.trim() ||
                    updateSmartFormSettingsMutation.isPending
                  }
                >
                  {copy.saveTemplateSettings}
                </Button>
              </ButtonGroup>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCreateTemplateOpen}
        onOpenChange={(open) => {
          setIsCreateTemplateOpen(open);
          if (!open) {
            resetTemplateDraft();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.newOrImportProjectTemplate}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Input
              value={templateName}
              onChange={(event) => setTemplateName(event.currentTarget.value)}
              placeholder={copy.templateName}
            />
            <Input
              value={templateCode}
              onChange={(event) => setTemplateCode(event.currentTarget.value)}
              placeholder={copy.templateCode}
            />
            <Label className="grid gap-1 text-xs font-medium text-muted-foreground">
              <span>{copy.recommendedFrameworkLabel}</span>
              <ProjectSelectControl
                ariaLabel={copy.recommendedFrameworkLabel}
                value={templateFrameworkTemplateId}
                onValueChange={setTemplateFrameworkTemplateId}
                disabled={!frameworkTemplatesQuery.data?.length}
                options={(frameworkTemplatesQuery.data ?? []).map(
                  (template) => ({
                    label: `${template.code} - ${template.name}`,
                    value: template.id,
                  })
                )}
              />
            </Label>
            <Label
              htmlFor="project-template-zip-file"
              className="grid gap-1 text-xs font-medium text-muted-foreground"
            >
              <span>{copy.projectTemplateZipFile}</span>
              <Input
                id="project-template-zip-file"
                aria-label={copy.projectTemplateZipFile}
                type="file"
                accept=".zip,.7z,application/zip,application/x-zip-compressed,application/x-7z-compressed"
                onChange={(event) =>
                  setTemplateZipFile(event.currentTarget.files?.[0] ?? null)
                }
              />
              <span className="text-[11px] font-normal text-muted-foreground">
                {copy.templateArchiveOptional}
              </span>
            </Label>
          </div>
          <DialogFooter>
            <ButtonGroup>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateTemplateOpen(false)}
              >
                {copy.cancel}
              </Button>
              <Button
                type="button"
                disabled={
                  !templateName.trim() ||
                  !templateCode.trim() ||
                  createTemplateMutation.isPending ||
                  !templateFrameworkTemplateId
                }
                onClick={() => createTemplateMutation.mutate()}
              >
                {templateZipFile
                  ? copy.importTemplate
                  : copy.createBlankTemplate}
              </Button>
            </ButtonGroup>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCreateSmartFormOpen}
        onOpenChange={(open) => {
          setIsCreateSmartFormOpen(open);
          if (!open) {
            resetSmartFormDraft();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.createSmartFormTemplateTitle}</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (isSmartFormDraftValid(smartFormDraft)) {
                createSmartFormTemplateMutation.mutate();
              }
            }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={smartFormDraft.name}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  setSmartFormDraft((current) => ({
                    ...current,
                    name: value,
                  }));
                }}
                placeholder={copy.smartFormName}
              />
              <Input
                value={smartFormDraft.code}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  setSmartFormDraft((current) => ({
                    ...current,
                    code: value,
                  }));
                }}
                placeholder={copy.smartFormCode}
              />
            </div>

            <DialogFooter>
              <ButtonGroup>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateSmartFormOpen(false)}
                >
                  {copy.cancel}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !isSmartFormDraftValid(smartFormDraft) ||
                    createSmartFormTemplateMutation.isPending
                  }
                >
                  {copy.createSmartFormTemplate}
                </Button>
              </ButtonGroup>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAddPlaceholderOpen}
        onOpenChange={(open) => {
          setIsAddPlaceholderOpen(open);
          if (!open) {
            resetPlaceholderDraft();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{copy.placeholderDialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Label className="grid gap-1.5 text-sm font-medium">
              <span>{copy.placeholderCode}</span>
              <Input
                autoFocus
                value={placeholderCode}
                maxLength={80}
                onChange={(event) =>
                  setPlaceholderCode(event.currentTarget.value)
                }
              />
            </Label>
            <Label className="grid gap-1.5 text-sm font-medium">
              <span>{copy.placeholderName}</span>
              <Input
                value={placeholderName}
                maxLength={255}
                onChange={(event) =>
                  setPlaceholderName(event.currentTarget.value)
                }
              />
            </Label>
          </div>
          <DialogFooter>
            <ButtonGroup>
              <Button
                type="button"
                variant="outline"
                disabled={createPlaceholderMutation.isPending}
                onClick={() => setIsAddPlaceholderOpen(false)}
              >
                {copy.cancel}
              </Button>
              <Button
                type="button"
                disabled={
                  !placeholderCode.trim() ||
                  !placeholderName.trim() ||
                  createPlaceholderMutation.isPending
                }
                onClick={() => createPlaceholderMutation.mutate()}
              >
                {copy.createPlaceholder}
              </Button>
            </ButtonGroup>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAddSmartFormOpen}
        onOpenChange={(open) => {
          setIsAddSmartFormOpen(open);
          if (!open) {
            resetSmartFormReferenceDraft();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.addSmartFormToFolder}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Label className="grid gap-1 text-xs font-medium text-muted-foreground">
              <span>{copy.smartFormTemplateReference}</span>
              <ProjectSelectControl
                ariaLabel={copy.smartFormTemplateReference}
                value={smartFormReferenceTemplateId}
                onValueChange={(value) => {
                  const template = publishedSmartFormTemplates.find(
                    (item) => item.id === value
                  );
                  setSmartFormReferenceTemplateId(value);
                  setSmartFormReferenceTitle(template?.name ?? "");
                }}
                disabled={publishedSmartFormTemplates.length === 0}
                options={publishedSmartFormTemplates.map((template) => ({
                  label: `${template.code} - ${template.name}`,
                  value: template.id,
                }))}
              />
            </Label>
            <Label className="grid gap-1 text-xs font-medium text-muted-foreground">
              <span>{copy.smartFormName}</span>
              <Input
                value={smartFormReferenceTitle}
                onChange={(event) =>
                  setSmartFormReferenceTitle(event.currentTarget.value)
                }
                placeholder={copy.smartFormName}
              />
            </Label>
            <Label className="grid gap-1 text-xs font-medium text-muted-foreground">
              <span>{copy.smartFormCode}</span>
              <Input
                value={smartFormReferenceCode}
                onChange={(event) =>
                  setSmartFormReferenceCode(event.currentTarget.value)
                }
                placeholder={copy.smartFormCode}
              />
            </Label>
            {publishedSmartFormTemplates.length > 0 ? null : (
              <p className="text-sm text-muted-foreground">
                {copy.noPublishedSmartForms}
              </p>
            )}
          </div>
          <DialogFooter>
            <ButtonGroup>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddSmartFormOpen(false)}
              >
                {copy.cancel}
              </Button>
              <Button
                type="button"
                disabled={
                  !smartFormReferenceTemplateId ||
                  !smartFormReferenceTitle.trim() ||
                  !smartFormReferenceCode.trim() ||
                  createSmartFormReferenceMutation.isPending
                }
                onClick={() => createSmartFormReferenceMutation.mutate()}
              >
                {copy.addSmartForm}
              </Button>
            </ButtonGroup>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SmartFormTemplateWorkspace({
  copy,
}: {
  copy: ReturnType<typeof useI18n>["dictionary"]["desktop"]["templateLibrary"];
}) {
  return <ProjectTemplateLibraryWorkspace copy={copy} mode="smart-form" />;
}

function TemplateWorkspaceEmpty({ title }: { title: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center px-4 text-center text-sm text-muted-foreground">
      {title}
    </div>
  );
}

function SmartFormTemplateDetail({
  copy,
  deletePending,
  designerCopy,
  isLoading,
  locale,
  onDelete,
  onPublish,
  onUpdateDefinition,
  publishPending,
  readonlyCopy,
  template,
  updatePending,
}: {
  copy: ReturnType<typeof useI18n>["dictionary"]["desktop"]["templateLibrary"];
  deletePending: boolean;
  designerCopy: ReturnType<typeof useI18n>["dictionary"]["smartFormV2Designer"];
  isLoading: boolean;
  locale: string;
  onDelete: (template: SmartFormTemplate) => void;
  onPublish: (template: SmartFormTemplate) => void;
  onUpdateDefinition: (
    template: SmartFormTemplate,
    definition: SmartFormV2Definition
  ) => void;
  publishPending: boolean;
  readonlyCopy: ReturnType<typeof useI18n>["dictionary"]["smartFormV2Preview"];
  template: SmartFormTemplate | null;
  updatePending: boolean;
}) {
  if (isLoading) {
    return <TemplateWorkspaceEmpty title={copy.loading} />;
  }
  if (!template) {
    return (
      <TemplateWorkspaceEmpty title={copy.selectSmartFormTemplatePrompt} />
    );
  }

  if (!isValidSmartFormV2Definition(template.draftDefinitionJson)) {
    return <TemplateWorkspaceEmpty title={designerCopy.invalidDefinition} />;
  }

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <SmartFormV2TemplateDesigner
        key={`${template.id}:${template.updatedAt ?? ""}`}
        initialDefinition={template.draftDefinitionJson}
        locale={locale}
        copy={designerCopy}
        readonlyCopy={readonlyCopy}
        onSave={(definition) => onUpdateDefinition(template, definition)}
        headerContext={template.frameworkTemplate?.code ?? copy.globalTemplate}
        headerTitle={template.name}
        headerSubtitle={template.code}
        headerActions={
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={publishPending || updatePending}
              onClick={() => onPublish(template)}
            >
              <Upload className="size-4" />
              {copy.publishSmartFormTemplate}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={deletePending}
              onClick={() => onDelete(template)}
            >
              <Trash2 className="size-4" />
              {copy.deleteSmartFormTemplate}
            </Button>
          </>
        }
        className="h-full max-w-none rounded-none border-0 shadow-none"
      />
    </div>
  );
}

function getOrderedProjectTemplateItems(
  node: ProjectTemplateNode | null
): ProjectTemplateOrderedItem[] {
  if (!node) {
    return [];
  }
  return [
    ...(node.files ?? []).map((item): ProjectTemplateOrderedItem => ({
      ...item,
      type: "FILE",
    })),
    ...(node.smartForms ?? []).map((item): ProjectTemplateOrderedItem => ({
      ...item,
      type: "SMART_FORM",
    })),
  ].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.code.localeCompare(right.code)
  );
}

function normalizeProjectTemplateNumericFolderCode(code: string) {
  const normalized = code.trim().replaceAll(/\s*-\s*/g, "-");
  return /^\d{1,4}$|^\d+(?:-\d+)+$/.test(normalized) ? normalized : null;
}

function getProjectTemplateItemSequence(code: string, prefix: string) {
  const escapedPrefix = prefix.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = code.trim().match(new RegExp(`^${escapedPrefix}\\.(\\d+)$`));
  return match?.[1] ?? "";
}

function updateProjectTemplateItem(
  template: ProjectTemplate | undefined,
  type: ProjectTemplateOrderedItem["type"],
  updated: ProjectTemplateFile | ProjectTemplateSmartForm
) {
  if (!template?.nodes) {
    return template;
  }
  return {
    ...template,
    nodes: template.nodes.map((node) => {
      if (node.id !== updated.templateNodeId) {
        return node;
      }
      return type === "FILE"
        ? {
            ...node,
            files: (node.files ?? []).map((item) =>
              item.id === updated.id ? (updated as ProjectTemplateFile) : item
            ),
          }
        : {
            ...node,
            smartForms: (node.smartForms ?? []).map((item) =>
              item.id === updated.id
                ? (updated as ProjectTemplateSmartForm)
                : item
            ),
          };
    }),
  };
}

function replaceProjectTemplateNodeItems(
  template: ProjectTemplate | undefined,
  nodeId: string,
  items: ProjectTemplateOrderedItem[]
) {
  if (!template?.nodes) {
    return template;
  }
  return {
    ...template,
    nodes: template.nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            files: items
              .filter(
                (
                  item
                ): item is Extract<
                  ProjectTemplateOrderedItem,
                  { type: "FILE" }
                > => item.type === "FILE"
              )
              .map(({ type: _type, ...item }) => item),
            smartForms: items
              .filter(
                (
                  item
                ): item is Extract<
                  ProjectTemplateOrderedItem,
                  { type: "SMART_FORM" }
                > => item.type === "SMART_FORM"
              )
              .map(({ type: _type, ...item }) => item),
          }
        : node
    ),
  };
}

function appendProjectTemplateFile(
  template: ProjectTemplate | undefined,
  file: ProjectTemplateFile
) {
  if (!template?.nodes) {
    return template;
  }
  return {
    ...template,
    _count: template._count
      ? { ...template._count, files: template._count.files + 1 }
      : template._count,
    nodes: template.nodes.map((node) =>
      node.id === file.templateNodeId
        ? {
            ...node,
            files: [...(node.files ?? []), file].sort(
              (left, right) =>
                left.sortOrder - right.sortOrder ||
                left.code.localeCompare(right.code)
            ),
          }
        : node
    ),
  };
}

function buildProjectTemplateItemCode(
  node: ProjectTemplateNode,
  files: ProjectTemplateFile[],
  smartForms: ProjectTemplateSmartForm[]
) {
  const nextSortOrder =
    Math.max(
      0,
      ...files.map((file) => file.sortOrder),
      ...smartForms.map((smartForm) => smartForm.sortOrder)
    ) + 1;
  const nodeCode = node.code.trim();
  if (/^\d{1,4}$|^\d+(?:-\d+)+$/.test(nodeCode)) {
    return `${nodeCode}.${nextSortOrder}`;
  }
  return `${nodeCode}-F${formatNumberWithoutDigitFour(nextSortOrder, 3)}`;
}

function appendProjectTemplateSmartForm(
  template: ProjectTemplate | undefined,
  smartForm: ProjectTemplateSmartForm
) {
  if (!template?.nodes) {
    return template;
  }
  return {
    ...template,
    _count: template._count
      ? {
          ...template._count,
          smartForms:
            (template._count.smartForms ??
              getProjectTemplateSmartForms(template.nodes).length) + 1,
        }
      : template._count,
    nodes: template.nodes.map((node) =>
      node.id === smartForm.templateNodeId
        ? {
            ...node,
            smartForms: [...(node.smartForms ?? []), smartForm].sort(
              (left, right) =>
                left.sortOrder - right.sortOrder ||
                left.code.localeCompare(right.code)
            ),
          }
        : node
    ),
  };
}

function updateProjectTemplateListFileCount(
  templates: ProjectTemplate[] | undefined,
  file: ProjectTemplateFile
) {
  return templates?.map((template) =>
    template.id === file.projectTemplateId
      ? {
          ...template,
          _count: template._count
            ? { ...template._count, files: template._count.files + 1 }
            : template._count,
        }
      : template
  );
}

function updateProjectTemplateListSmartFormCount(
  templates: ProjectTemplate[] | undefined,
  smartForm: ProjectTemplateSmartForm
) {
  return templates?.map((template) =>
    template.id === smartForm.projectTemplateId
      ? {
          ...template,
          _count: template._count
            ? {
                ...template._count,
                smartForms: (template._count.smartForms ?? 0) + 1,
              }
            : template._count,
        }
      : template
  );
}

function updateSmartFormTemplateList(
  templates: SmartFormTemplate[] | undefined,
  updatedTemplate: SmartFormTemplate
) {
  if (!templates) {
    return templates;
  }
  if (!templates.some((template) => template.id === updatedTemplate.id)) {
    return [updatedTemplate, ...templates];
  }
  return templates.map((template) =>
    template.id === updatedTemplate.id ? updatedTemplate : template
  );
}

function ProjectRecycleBinWorkspace({
  embedded = false,
  locale,
  error,
  onRetry,
  copy,
  loading,
  onClose,
  onRestoreProject,
  onRestoreSelected,
  onSelectionChange,
  pending,
  projects,
  selectedProjectIds,
}: {
  embedded?: boolean;
  locale: Locale;
  error: boolean;
  onRetry: () => void;
  copy: ReturnType<typeof useI18n>["dictionary"]["desktop"];
  loading: boolean;
  onClose: () => void;
  onRestoreProject: (projectId: string) => void;
  onRestoreSelected: () => void;
  onSelectionChange: (projectIds: string[]) => void;
  pending: boolean;
  projects: Project[];
  selectedProjectIds: string[];
}) {
  const selectedSet = new Set(selectedProjectIds);
  const hasProjects = !loading && !error && projects.length > 0;
  const allSelected =
    projects.length > 0 &&
    projects.every((project) => selectedSet.has(project.id));
  const selectedCountLabel = formatDesktopCopy(
    copy.selectedDeletedProjectsCount ?? "{count} selected",
    { count: selectedProjectIds.length }
  );

  return (
    <section
      data-testid="project-recycle-bin-workspace"
      className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-6 py-6 sm:py-10"
    >
      {embedded ? null : (
        <div className="flex flex-wrap items-center gap-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            <ArrowLeft data-icon="inline-start" />
            {copy.backToProjects ?? "Back to projects"}
          </Button>
          <h2 className="text-lg font-semibold text-foreground">
            {copy.projectRecycleBin}
          </h2>
        </div>
      )}
      {hasProjects ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <ReuiBadge variant="secondary" radius="full" size="sm">
                {formatDesktopCopy(copy.deletedProjectsCount, {
                  count: projects.length,
                })}
              </ReuiBadge>
            </div>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={
                selectedProjectIds.length === 0 || pending || loading || error
              }
              onClick={onRestoreSelected}
            >
              <RotateCcw data-icon="inline-start" />
              {copy.restoreSelectedProjects ?? "Restore selected"}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-4 border-t border-border/60 pt-5 text-sm text-muted-foreground">
            <div className="inline-flex items-center gap-2">
              <Checkbox
                checked={allSelected}
                label={
                  copy.selectAllDeletedProjects ?? "Select all deleted projects"
                }
                disabled={projects.length === 0 || pending || loading || error}
                onCheckedChange={(checked) =>
                  onSelectionChange(
                    checked === true
                      ? projects.map((project) => project.id)
                      : []
                  )
                }
              />
              <span>
                {copy.selectAllDeletedProjects ?? "Select all deleted projects"}
              </span>
            </div>
            {selectedProjectIds.length > 0 ? (
              <span role="status">{selectedCountLabel}</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {loading ? (
        <CollectionState kind="loading" locale={locale} />
      ) : error ? (
        <CollectionState kind="error" locale={locale} onRetry={onRetry} />
      ) : projects.length > 0 ? (
        <div className="grid gap-3">
          {projects.map((project) => {
            const selected = selectedSet.has(project.id);

            return (
              <article
                key={project.id}
                className={cn(
                  "rounded-2xl border border-border bg-card p-6 transition-colors",
                  selected && "border-primary"
                )}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Checkbox
                    checked={selected}
                    label={formatDesktopCopy(
                      copy.selectDeletedProject ?? "Select {name}",
                      {
                        name: project.name,
                      }
                    )}
                    disabled={pending}
                    onCheckedChange={(checked) => {
                      onSelectionChange(
                        checked === true
                          ? [...selectedProjectIds, project.id]
                          : selectedProjectIds.filter((id) => id !== project.id)
                      );
                    }}
                  />
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <ProjectFileIcon className="size-10" />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-foreground">
                        {project.name}
                      </h3>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {project.projectCode}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    disabled={pending}
                    onClick={() => onRestoreProject(project.id)}
                  >
                    <RotateCcw data-icon="inline-start" />
                    {copy.restoreProject ?? "Restore project"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <CollectionState
          kind="empty"
          locale={locale}
          title={copy.projectRecycleBinEmpty}
          className="min-h-80"
        />
      )}
    </section>
  );
}

function ProjectHomeActions({
  canCreateProject,
  copy,
  onCreateProject,
  onViewModeChange,
  viewMode,
}: {
  canCreateProject: boolean;
  copy: ReturnType<typeof useI18n>["dictionary"]["desktop"];
  onCreateProject: () => void;
  onViewModeChange: (mode: HomeViewMode) => void;
  viewMode: HomeViewMode;
}) {
  return (
    <ButtonGroup>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={copy.viewModeLabel ?? "Project view"}
        onClick={() => onViewModeChange(viewMode === "list" ? "icons" : "list")}
      >
        {viewMode === "list" ? <List /> : <LayoutGrid />}
      </Button>
      {canCreateProject ? (
        <Button
          type="button"
          variant="outline"
          className="max-sm:w-9 max-sm:px-0"
          onClick={onCreateProject}
        >
          <Plus data-icon="inline-start" />
          <span className="max-sm:sr-only">{copy.context.new}</span>
        </Button>
      ) : null}
    </ButtonGroup>
  );
}

function getProjectClientName(
  client: NonNullable<Project["cmpClient"]>,
  locale: Locale
) {
  const localizedNames =
    locale === "zh-CN"
      ? [client.nameZh, client.nameEn]
      : [client.nameEn, client.nameZh];
  return (
    localizedNames.find((name) => name?.trim())?.trim() ||
    client.clientCode?.trim() ||
    client.id
  );
}

function getProjectLastOpenedText(
  placement: DesktopProjectPlacement,
  locale: Locale,
  copy: ReturnType<typeof useI18n>["dictionary"]["desktop"]
) {
  const lastOpenedAt = formatDesktopRelativeTime(
    placement.lastOpenedAt,
    locale,
    copy.justNow ?? "just now"
  );
  return lastOpenedAt
    ? formatDesktopCopy(copy.lastOpenedRelative ?? "{time}", {
        time: lastOpenedAt,
      })
    : copy.neverOpened;
}

type ProjectDetailListProps = {
  showRecordCount?: boolean;
  activeFolderName: string;
  canCreateProject: boolean;
  content?: ReactNode;
  copy: ReturnType<typeof useI18n>["dictionary"]["desktop"];
  displaySettings: DesktopDisplaySettings;
  detailPositions: Record<string, DesktopPosition>;
  dragProjectId: string | null;
  locale: Locale;
  onCreateProject: () => void;
  onEditProject: (project: Project) => void;
  onOpenProject: (projectId: string) => void;
  onPrefetchProject: (projectId: string) => void;
  onViewModeChange: (mode: HomeViewMode) => void;
  placements: DesktopProjectPlacement[];
  viewMode: HomeViewMode;
};

function ProjectDetailList({
  showRecordCount,
  activeFolderName,
  canCreateProject,
  content,
  copy,
  displaySettings,
  detailPositions,
  dragProjectId,
  locale,
  onCreateProject,
  onEditProject,
  onOpenProject,
  onPrefetchProject,
  onViewModeChange,
  placements,
  viewMode,
}: ProjectDetailListProps) {
  const isPhone = useCompactViewport(767);
  const orderedPlacements = orderDetailPlacements(
    placements,
    detailPositions,
    displaySettings.density
  );
  const densityClassName = useMemo(
    () => getProjectDetailDensityClassName(displaySettings.density),
    [displaySettings.density]
  );
  const columns = useMemo<ColumnDef<DesktopProjectPlacement>[]>(
    () =>
      createProjectDetailColumns({
        copy,
        densityClassName,
        displaySettings,
        isPhone,
        locale,
        onEditProject,
        onOpenProject,
        onPrefetchProject,
      }),
    [
      copy,
      densityClassName,
      displaySettings,
      isPhone,
      locale,
      onEditProject,
      onOpenProject,
      onPrefetchProject,
    ]
  );
  const tableLabel = formatDesktopCopy(
    copy.projectTableLabel ?? "{folder} projects",
    { folder: activeFolderName }
  );

  return (
    <ProjectWingMasterDataGrid
      locale={locale}
      showRecordCount={showRecordCount}
      showRowSelection={!isPhone}
      actions={
        <ProjectHomeActions
          canCreateProject={canCreateProject}
          copy={copy}
          viewMode={viewMode}
          onCreateProject={onCreateProject}
          onViewModeChange={onViewModeChange}
        />
      }
      columns={columns}
      content={content}
      columnVisibilityIconOnly
      columnVisibilityLabel={copy.columns}
      columnVisibilityPosition="before-actions"
      compactHiddenColumnIds={[
        "clientCode",
        "lastOpened",
        "reportDate",
        "archiveDeadline",
      ]}
      data={orderedPlacements}
      emptyMessage={copy.empty}
      getRowId={(placement) => placement.projectId}
      initialVisibility={{ systemId: false }}
      rowClassName={(placement) =>
        cn(
          densityClassName.row,
          dragProjectId === placement.projectId && "opacity-0 transition-none"
        )
      }
      selectionSummary={copy.dataGridSelectionSummary}
      tableLabel={tableLabel}
      testId="project-home-data-grid"
      title={activeFolderName}
      toolbarTestId="project-home-toolbar"
      onRowClick={(placement) => onOpenProject(placement.projectId)}
    />
  );
}

type ProjectDetailColumnOptions = Pick<
  ProjectDetailListProps,
  | "copy"
  | "displaySettings"
  | "locale"
  | "onEditProject"
  | "onOpenProject"
  | "onPrefetchProject"
> & {
  densityClassName: ReturnType<typeof getProjectDetailDensityClassName>;
  isPhone: boolean;
};

function createProjectDetailColumns({
  copy,
  densityClassName,
  displaySettings,
  isPhone,
  locale,
  onEditProject,
  onOpenProject,
  onPrefetchProject,
}: ProjectDetailColumnOptions): ColumnDef<DesktopProjectPlacement>[] {
  const columnMenuCopy = getProjectColumnMenuCopy(copy);
  const columns: ColumnDef<DesktopProjectPlacement>[] = [
    {
      id: "name",
      accessorFn: (placement) => placement.project.name,
      header: ({ column }) => (
        <ProjectWingMasterDataGridColumnHeader
          column={column}
          copy={columnMenuCopy}
          title={copy.engagement}
        />
      ),
      cell: ({ row }) => (
        <ProjectDetailNameCell
          copy={copy}
          densityClassName={densityClassName}
          isPhone={isPhone}
          placement={row.original}
          onOpen={() => onOpenProject(row.original.projectId)}
          onPrefetch={() => onPrefetchProject(row.original.projectId)}
        />
      ),
      meta: { autoSize: true, headerTitle: copy.engagement },
      filterFn: projectWingSelectedValuesFilter,
      minSize: 220,
      size: 280,
    },
  ];

  if (isPhone) {
    columns.push({
      id: "actions",
      header: () => <span className="sr-only">{copy.actions}</span>,
      cell: ({ row }) => (
        <ProjectDetailActions
          copy={copy}
          displaySettings={displaySettings}
          isPhone
          locale={locale}
          placement={row.original}
          onEdit={() => onEditProject(row.original.project)}
          onOpen={() => onOpenProject(row.original.projectId)}
          onPrefetch={() => onPrefetchProject(row.original.projectId)}
        />
      ),
      enableHiding: false,
      enableResizing: false,
      enableSorting: false,
      size: 44,
    });
    return columns;
  }

  if (displaySettings.showProjectCode) {
    columns.push(
      createProjectTextColumn({
        id: "projectCode",
        title: copy.projectCode,
        accessorFn: (placement) => placement.project.projectCode,
        columnMenuCopy,
        minSize: 180,
        size: 200,
      })
    );
  }
  columns.push(
    createProjectTextColumn({
      id: "systemId",
      title: copy.systemId,
      accessorFn: (placement) =>
        placement.project.projectNumber === null ||
        placement.project.projectNumber === undefined
          ? "-"
          : String(placement.project.projectNumber).padStart(7, "0"),
      columnMenuCopy,
    })
  );

  addProjectClientColumns(columns, {
    columnMenuCopy,
    copy,
    displaySettings,
    locale,
  });
  addProjectDateColumns(columns, { columnMenuCopy, copy, displaySettings });
  columns.push({
    id: "actions",
    header: copy.actions,
    cell: ({ row }) => (
      <ProjectDetailActions
        copy={copy}
        displaySettings={displaySettings}
        isPhone={false}
        locale={locale}
        placement={row.original}
        onEdit={() => onEditProject(row.original.project)}
        onOpen={() => onOpenProject(row.original.projectId)}
        onPrefetch={() => onPrefetchProject(row.original.projectId)}
      />
    ),
    enableHiding: false,
    enableResizing: false,
    enableSorting: false,
    size: 96,
  });
  return columns;
}

function addProjectClientColumns(
  columns: ColumnDef<DesktopProjectPlacement>[],
  {
    columnMenuCopy,
    copy,
    displaySettings,
    locale,
  }: Pick<ProjectDetailListProps, "copy" | "displaySettings" | "locale"> & {
    columnMenuCopy: ReturnType<typeof getProjectColumnMenuCopy>;
  }
) {
  if (displaySettings.showClientName) {
    columns.push(
      createProjectTextColumn({
        id: "clientName",
        title: copy.clientName,
        accessorFn: (placement) =>
          placement.project.cmpClient
            ? getProjectClientName(placement.project.cmpClient, locale)
            : (copy.unassignedClient ?? "Unassigned client"),
        columnMenuCopy,
        autoSize: true,
        minSize: 140,
        size: 160,
      })
    );
  }
  if (displaySettings.showClientCode) {
    columns.push(
      createProjectTextColumn({
        id: "clientCode",
        title: copy.clientCode,
        accessorFn: (placement) =>
          placement.project.cmpClient?.clientCode || "-",
        columnMenuCopy,
        minSize: 180,
        size: 200,
      })
    );
  }
  if (displaySettings.showLastOpened) {
    columns.push(
      createProjectTextColumn({
        id: "lastOpened",
        title: copy.lastOpened,
        accessorFn: (placement) =>
          getProjectLastOpenedText(placement, locale, copy),
        columnMenuCopy,
      })
    );
  }
}

function addProjectDateColumns(
  columns: ColumnDef<DesktopProjectPlacement>[],
  {
    columnMenuCopy,
    copy,
    displaySettings,
  }: Pick<ProjectDetailListProps, "copy" | "displaySettings"> & {
    columnMenuCopy: ReturnType<typeof getProjectColumnMenuCopy>;
  }
) {
  if (displaySettings.showReportDate) {
    columns.push(
      createProjectTextColumn({
        id: "reportDate",
        title: copy.reportDate,
        accessorFn: (placement) =>
          formatDesktopDate(placement.project.reportDate) || "-",
        columnMenuCopy,
      })
    );
  }
  if (displaySettings.showArchiveDeadline) {
    columns.push(
      createProjectTextColumn({
        id: "archiveDeadline",
        title: copy.archiveDeadline,
        accessorFn: (placement) =>
          formatDesktopDate(placement.project.archiveDeadline) || "-",
        columnMenuCopy,
      })
    );
  }
}

type ProjectTextColumnOptions = {
  accessorFn: (placement: DesktopProjectPlacement) => string;
  autoSize?: boolean;
  columnMenuCopy: ReturnType<typeof getProjectColumnMenuCopy>;
  id: string;
  minSize?: number;
  size?: number;
  title: string;
};

function createProjectTextColumn({
  accessorFn,
  autoSize = false,
  columnMenuCopy,
  id,
  minSize,
  size = 150,
  title,
}: ProjectTextColumnOptions): ColumnDef<DesktopProjectPlacement> {
  return {
    id,
    accessorFn,
    header: ({ column }) => (
      <ProjectWingMasterDataGridColumnHeader
        column={column}
        copy={columnMenuCopy}
        title={title}
      />
    ),
    cell: ({ getValue }) => (
      <span className="block truncate font-medium text-foreground">
        {String(getValue() || "-")}
      </span>
    ),
    meta: { autoSize, headerTitle: title },
    filterFn: projectWingSelectedValuesFilter,
    minSize,
    size,
  };
}

function getProjectColumnMenuCopy(copy: ProjectDetailListProps["copy"]) {
  return copy.dataGridColumnMenu;
}

function ProjectDetailNameCell({
  copy,
  densityClassName,
  isPhone,
  onOpen,
  onPrefetch,
  placement,
}: {
  copy: ProjectDetailListProps["copy"];
  densityClassName: ReturnType<typeof getProjectDetailDensityClassName>;
  isPhone: boolean;
  onOpen: () => void;
  onPrefetch: () => void;
  placement: DesktopProjectPlacement;
}) {
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    id: placement.projectId,
  });
  const statusBadge = getProjectStatusBadge(placement.project, copy);

  return (
    <Button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      variant="ghost"
      accessibleName={getDesktopProjectLabel(placement.project)}
      className={cn(
        "h-auto w-full min-w-0 justify-start rounded-none p-0 text-left hover:bg-transparent",
        isDragging ? "cursor-grabbing" : "cursor-grab"
      )}
      onClick={onOpen}
      onFocus={onPrefetch}
      onPointerEnter={onPrefetch}
    >
      {isPhone ? null : <ProjectFileIcon className={densityClassName.icon} />}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "min-w-20 flex-1 truncate font-semibold text-foreground",
              densityClassName.title
            )}
          >
            {placement.project.name}
          </span>
          {!isPhone && statusBadge ? (
            <Badge
              variant="outline"
              className={cn("shrink-0", statusBadge.className)}
            >
              {statusBadge.label}
            </Badge>
          ) : null}
        </div>
      </div>
    </Button>
  );
}

function getProjectDetailMenuItems({
  copy,
  displaySettings,
  locale,
  placement,
}: {
  copy: ProjectDetailListProps["copy"];
  displaySettings: DesktopDisplaySettings;
  locale: Locale;
  placement: DesktopProjectPlacement;
}) {
  const { project } = placement;
  return [
    ...(displaySettings.showProjectCode
      ? [{ label: copy.projectCode, value: project.projectCode || "-" }]
      : []),
    {
      label: copy.systemId,
      value:
        project.projectNumber === null || project.projectNumber === undefined
          ? "-"
          : String(project.projectNumber).padStart(7, "0"),
    },
    ...(displaySettings.showClientName
      ? [
          {
            label: copy.clientName,
            value: project.cmpClient
              ? getProjectClientName(project.cmpClient, locale)
              : (copy.unassignedClient ?? "Unassigned client"),
          },
        ]
      : []),
    ...(displaySettings.showClientCode
      ? [
          {
            label: copy.clientCode,
            value: project.cmpClient?.clientCode || "-",
          },
        ]
      : []),
    ...(displaySettings.showLastOpened
      ? [
          {
            label: copy.lastOpened,
            value: getProjectLastOpenedText(placement, locale, copy),
          },
        ]
      : []),
    ...(displaySettings.showReportDate
      ? [
          {
            label: copy.reportDate,
            value: formatDesktopDate(project.reportDate) || "-",
          },
        ]
      : []),
    ...(displaySettings.showArchiveDeadline
      ? [
          {
            label: copy.archiveDeadline,
            value: formatDesktopDate(project.archiveDeadline) || "-",
          },
        ]
      : []),
  ];
}

function ProjectDetailActions({
  copy,
  displaySettings,
  isPhone,
  locale,
  onEdit,
  onOpen,
  onPrefetch,
  placement,
}: {
  copy: ProjectDetailListProps["copy"];
  displaySettings: DesktopDisplaySettings;
  isPhone: boolean;
  locale: Locale;
  onEdit: () => void;
  onOpen: () => void;
  onPrefetch: () => void;
  placement: DesktopProjectPlacement;
}) {
  if (isPhone) {
    const details = getProjectDetailMenuItems({
      copy,
      displaySettings,
      locale,
      placement,
    });

    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground"
              tooltip={copy.actions}
              aria-label={`${copy.actions}: ${placement.project.name}`}
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="truncate">
              {placement.project.name}
            </DropdownMenuLabel>
            {details.length > 0 ? <DropdownMenuSeparator /> : null}
            {details.map((detail) => (
              <div
                className="flex items-center justify-between gap-4 px-2 py-1.5 text-sm"
                key={detail.label}
              >
                <span className="text-muted-foreground">{detail.label}</span>
                <span className="max-w-36 truncate text-right font-medium text-foreground">
                  {detail.value}
                </span>
              </div>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onFocus={onPrefetch}
            onPointerEnter={onPrefetch}
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
          >
            <ExternalLink />
            {copy.openProject ?? "Open project"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
          >
            <Pencil />
            {copy.editProject}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <ButtonGroup
      className={cn("justify-end gap-1", BUTTON_GROUP_SEPARATED_ITEMS_CLASS)}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-muted-foreground"
        tooltip={copy.editProject}
        aria-label={`${copy.editProject}: ${placement.project.name}`}
        onClick={(event) => {
          event.stopPropagation();
          onEdit();
        }}
      >
        <Pencil />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        tooltip={copy.openProject ?? "Open project"}
        aria-label={`${copy.openProject}: ${placement.project.name}`}
        onFocus={onPrefetch}
        onPointerEnter={onPrefetch}
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
      >
        <ExternalLink />
      </Button>
    </ButtonGroup>
  );
}

function ProjectDetailDragOverlay({
  displaySettings,
  placement,
}: {
  displaySettings: DesktopDisplaySettings;
  placement: DesktopProjectPlacement;
}) {
  const rowMetrics = getDetailRowMetrics(displaySettings.density);
  return (
    <DynamicBox
      className="flex w-[min(64rem,calc(100vw-10rem))] items-center gap-3 rounded-[8px] border border-border/60 bg-card/95 px-4 text-left shadow-xl select-none"
      height={rowMetrics.height}
    >
      <ProjectFileIcon className="size-10" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {placement.project.name}
        </p>
        <p className="truncate font-mono text-xs text-muted-foreground">
          {placement.project.projectCode}
        </p>
      </div>
      <ChevronRight className="size-4 text-muted-foreground" />
    </DynamicBox>
  );
}

function ProjectFileIcon({ className }: { className?: string }) {
  return (
    <span
      data-testid="project-file-icon"
      aria-hidden="true"
      className={cn(
        "relative block size-10 shrink-0 text-muted-foreground",
        className
      )}
    >
      <FileText className="absolute inset-[2%] size-[96%] stroke-[1.2]" />
      <span className="absolute bottom-0 left-[6%] flex size-[46%] items-center justify-center rounded-[16%] bg-primary text-primary-foreground shadow-sm">
        <CheckCircle2 className="size-[70%] stroke-[2.2]" />
      </span>
    </span>
  );
}

function getDetailRowMetrics(density: DesktopIconDensity) {
  return DETAIL_ROW_METRICS[density] ?? DETAIL_ROW_METRICS.standard;
}

function getProjectDetailDensityClassName(density: DesktopIconDensity) {
  switch (density) {
    case "compact": {
      return {
        container: "gap-2",
        row: "h-12",
        cell: "py-1",
        icon: "size-8",
        title: "text-xs leading-4",
        meta: "text-[10px] leading-3.5",
      };
    }
    case "comfortable": {
      return {
        container: "gap-4",
        row: "h-16",
        cell: "py-2.5",
        icon: "size-10",
        title: "text-lg leading-6",
        meta: "text-sm leading-5",
      };
    }
    default: {
      return {
        container: "gap-3",
        row: "h-14",
        cell: "py-2",
        icon: "size-9",
        title: "text-base leading-6",
        meta: "text-xs leading-4",
      };
    }
  }
}

function getDefaultDetailRowPosition(
  index: number,
  density: DesktopIconDensity
): DesktopPosition {
  const rowMetrics = getDetailRowMetrics(density);
  return {
    x: 28,
    y: 18 + index * (rowMetrics.height + rowMetrics.gap),
  };
}

function orderDetailPlacements(
  placements: DesktopProjectPlacement[],
  positions: Record<string, DesktopPosition>,
  density: DesktopIconDensity
) {
  if (!placements.some((placement) => positions[placement.projectId])) {
    return placements;
  }
  return [...placements].sort((left, right) => {
    const leftIndex = placements.findIndex(
      (placement) => placement.projectId === left.projectId
    );
    const rightIndex = placements.findIndex(
      (placement) => placement.projectId === right.projectId
    );
    const leftPosition =
      positions[left.projectId] ??
      getDefaultDetailRowPosition(leftIndex, density);
    const rightPosition =
      positions[right.projectId] ??
      getDefaultDetailRowPosition(rightIndex, density);
    if (leftPosition.y !== rightPosition.y) {
      return leftPosition.y - rightPosition.y;
    }
    return leftIndex - rightIndex;
  });
}

function moveDetailPlacement(
  placements: DesktopProjectPlacement[],
  fromIndex: number,
  targetIndex: number
) {
  const next = [...placements];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

function buildDetailPositions(
  placements: DesktopProjectPlacement[],
  density: DesktopIconDensity
) {
  return Object.fromEntries(
    placements.map((placement, index) => [
      placement.projectId,
      getDefaultDetailRowPosition(index, density),
    ])
  ) as Record<string, DesktopPosition>;
}

function getDetailRowIndexFromPosition(
  position: DesktopPosition,
  rowCount: number,
  density: DesktopIconDensity
) {
  if (rowCount <= 1) {
    return 0;
  }
  const rowMetrics = getDetailRowMetrics(density);
  const stride = rowMetrics.height + rowMetrics.gap;
  const index = Math.round((position.y - 18) / stride);
  return clampNumber(index, 0, rowCount - 1);
}

function DesktopFolderButton({
  active,
  copy,
  folder,
  hasProjects,
  highlighted,
  onClick,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
  pending,
}: {
  active: boolean;
  copy: {
    archivedFolder?: string;
    defaultFolder?: string;
    folderMenu?: {
      actionFailed?: string;
      deleteFolder?: string;
      deleteNonEmpty?: string;
      newFolder?: string;
      protectedFolder?: string;
      renameFolder?: string;
    };
  };
  folder: DesktopFolder;
  hasProjects: boolean;
  highlighted: boolean;
  onClick: () => void;
  onCreateFolder: () => void;
  onDeleteFolder: (folder: DesktopFolder) => void;
  onRenameFolder: (folder: DesktopFolder) => void;
  pending: boolean;
}) {
  const { setNodeRef } = useDroppable({
    id: getFolderDroppableId(folder.id),
  });
  const protectedFolder = isProtectedDesktopFolder(folder);
  const deleteDisabled = protectedFolder || hasProjects || pending;
  const deleteDisabledReason = protectedFolder
    ? copy.folderMenu?.protectedFolder
    : hasProjects
      ? copy.folderMenu?.deleteNonEmpty
      : undefined;
  const folderButton = (
    <SidebarMenuButton
      ref={setNodeRef}
      type="button"
      isActive={active}
      aria-current={active ? "page" : undefined}
      data-desktop-folder-id={folder.id}
      data-drop-target={highlighted ? "true" : undefined}
      className={cn(
        "relative h-11 justify-start gap-3 rounded-[8px] px-4 text-left text-sm font-medium transition-[background-color,color,box-shadow]",
        highlighted
          ? "bg-[var(--brand-tint)] text-primary shadow-sm shadow-primary/10 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-1 before:rounded-r-full before:bg-primary"
          : active
            ? "bg-workbench-active text-foreground shadow-sm shadow-foreground/5 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-1 before:rounded-r-full before:bg-primary hover:bg-workbench-active"
            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
      )}
      onClick={onClick}
    >
      <Folder className="size-4 shrink-0" />
      <span>{getDesktopFolderLabel(folder, copy)}</span>
    </SidebarMenuButton>
  );

  return (
    <SidebarMenuItem>
      <ContextMenu>
        <ContextMenuTrigger render={folderButton} />
        <ContextMenuContent className={DESKTOP_CONTEXT_MENU_CONTENT_CLASS}>
          <ContextMenuItem
            className={DESKTOP_CONTEXT_MENU_ITEM_CLASS}
            disabled={pending}
            onClick={onCreateFolder}
          >
            <Plus className="size-4 text-muted-foreground" />
            {copy.folderMenu?.newFolder ?? "New folder"}
          </ContextMenuItem>
          <ContextMenuItem
            className={DESKTOP_CONTEXT_MENU_ITEM_CLASS}
            disabled={protectedFolder || pending}
            onClick={() => onRenameFolder(folder)}
          >
            <Pencil className="size-4 text-muted-foreground" />
            {copy.folderMenu?.renameFolder ?? "Rename folder"}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className={DESKTOP_CONTEXT_MENU_ITEM_CLASS}
            disabled={deleteDisabled}
            title={deleteDisabledReason}
            variant="destructive"
            onClick={() => onDeleteFolder(folder)}
          >
            <Trash2 className="size-4" />
            {copy.folderMenu?.deleteFolder ?? "Delete folder"}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </SidebarMenuItem>
  );
}

function isProtectedDesktopFolder(folder: DesktopFolder) {
  return folder.isDefault || isArchivedDesktopFolder(folder);
}

function isArchivedDesktopFolder(folder?: DesktopFolder) {
  return Boolean(folder && ARCHIVED_DESKTOP_FOLDER_NAMES.has(folder.name));
}

function getDesktopFolderLabel(
  folder: DesktopFolder,
  copy: { archivedFolder?: string; defaultFolder?: string }
) {
  if (folder.isDefault) {
    return copy.defaultFolder ?? folder.name;
  }
  if (ARCHIVED_DESKTOP_FOLDER_NAMES.has(folder.name)) {
    return copy.archivedFolder ?? folder.name;
  }
  return folder.name;
}

export function getHomeNavigationWidth(
  folders: DesktopFolder[],
  copy: { archivedFolder?: string; defaultFolder?: string }
) {
  const longestLabelWidth = Math.max(
    0,
    ...folders.map((folder) =>
      getVisualCharacterWidth(getDesktopFolderLabel(folder, copy))
    )
  );

  return clampNumber(
    HOME_NAV_CONTENT_WIDTH + longestLabelWidth * HOME_NAV_CHARACTER_WIDTH,
    HOME_NAV_MIN_WIDTH,
    HOME_NAV_MAX_WIDTH
  );
}

function getVisualCharacterWidth(value: string) {
  return [...value].reduce(
    (width, character) =>
      width + ((character.codePointAt(0) ?? 0) > 0xff ? 2 : 1),
    0
  );
}

function ProjectIconGrid({
  copy,
  displaySettings,
  locale,
  onFolderDropTargetChange,
  onMoveProjectToFolder,
  onOpenProject,
  onPrefetchProject,
  onValueCommit,
  positions,
  placements: initialPlacements,
}: {
  copy: ReturnType<typeof useI18n>["dictionary"]["desktop"];
  displaySettings: DesktopDisplaySettings;
  locale: Locale;
  onFolderDropTargetChange: (folderId: string | null) => void;
  onMoveProjectToFolder: (
    placement: DesktopProjectPlacement,
    folderId: string
  ) => void;
  onOpenProject: (projectId: string) => void;
  onPrefetchProject: (projectId: string) => void;
  onValueCommit: (
    updates: ProjectGridPlacementUpdate<DesktopProjectPlacement>[]
  ) => void;
  positions: Record<string, DesktopPosition>;
  placements: DesktopProjectPlacement[];
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridPositions, setGridPositions] = useState(positions);
  const [dimensions, setDimensions] = useState(() =>
    getProjectGridDimensions(0, 0, initialPlacements)
  );

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || typeof ResizeObserver === "undefined") {
      return;
    }
    const updateDimensions = () => {
      const bounds = grid.getBoundingClientRect();
      setDimensions(
        getProjectGridDimensions(bounds.width, bounds.height, initialPlacements)
      );
    };
    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [initialPlacements]);

  useEffect(() => setGridPositions(positions), [positions]);

  const slots = useMemo(
    () =>
      buildProjectGridSlots(
        initialPlacements,
        gridPositions,
        dimensions.columns,
        dimensions.rows
      ),
    [dimensions.columns, dimensions.rows, gridPositions, initialPlacements]
  );

  if (initialPlacements.length === 0) {
    return (
      <Empty className="h-full rounded-none border-0">
        <EmptyHeader>
          <EmptyTitle>{copy.empty}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Sortable
      ref={gridRef}
      className="group/grid grid min-h-full auto-rows-[9rem] grid-cols-[repeat(auto-fill,9rem)] content-start gap-3 overflow-auto p-4"
      collisionDetection={projectGridFolderCollisionDetection}
      getItemValue={(slot) => slot.id}
      getValueAfterMove={(value, { activeIndex, overIndex }) =>
        moveProjectGridSlot(value, activeIndex, overIndex)
      }
      strategy="spatial"
      value={slots}
      onDragCancel={() => onFolderDropTargetChange(null)}
      onDragEnd={(event) => {
        const folderId =
          getFolderIdFromDroppableId(event.over?.id) ??
          getFolderIdFromDragEvent(event);
        const placement = slots.find(
          (slot) => slot.id === event.active.id
        )?.placement;
        onFolderDropTargetChange(null);
        if (folderId && placement) {
          onMoveProjectToFolder(placement, folderId);
        }
      }}
      onDragOver={(event) =>
        onFolderDropTargetChange(getFolderIdFromDroppableId(event.over?.id))
      }
      onDragStart={() => onFolderDropTargetChange(null)}
      onValueChange={(nextSlots) => {
        const nextPositions = Object.fromEntries(
          getProjectGridPlacementUpdates(nextSlots, dimensions.columns).map(
            ({ placement, position }) => [placement.projectId, position]
          )
        );
        setGridPositions(nextPositions);
      }}
      onValueCommit={(nextSlots) =>
        onValueCommit(
          getProjectGridPlacementUpdates(nextSlots, dimensions.columns)
        )
      }
    >
      {slots.map((slot) => (
        <SortableItem
          key={slot.id}
          aria-hidden={slot.placement ? undefined : true}
          className="group/slot size-36 data-[dragging=true]:opacity-0 data-[overlay=true]:opacity-100"
          dragHandleOnly={!slot.placement}
          tabIndex={slot.placement ? undefined : -1}
          value={slot.id}
        >
          {slot.placement ? (
            <ProjectIconGridItem
              copy={copy}
              displaySettings={displaySettings}
              locale={locale}
              placement={slot.placement}
              onOpen={() => {
                if (slot.placement) {
                  onOpenProject(slot.placement.projectId);
                }
              }}
              onPrefetch={() => {
                if (slot.placement) {
                  onPrefetchProject(slot.placement.projectId);
                }
              }}
            />
          ) : (
            <div
              data-slot="project-grid-empty-slot"
              className="size-36 rounded-md border border-transparent transition-colors group-data-[dragging=true]/grid:border-border/60 group-data-[over=true]/slot:border-primary/50 group-data-[over=true]/slot:bg-primary/5"
            />
          )}
        </SortableItem>
      ))}
    </Sortable>
  );
}

function ProjectIconGridItem({
  copy,
  displaySettings,
  locale,
  onOpen,
  onPrefetch,
  placement,
}: {
  copy: ReturnType<typeof useI18n>["dictionary"]["desktop"];
  displaySettings: DesktopDisplaySettings;
  locale: Locale;
  onOpen: () => void;
  onPrefetch: () => void;
  placement: DesktopProjectPlacement;
}) {
  const clientName = getProjectIconClientName(
    placement,
    displaySettings,
    locale,
    copy
  );
  const lastOpened = getProjectLastOpenedText(placement, locale, copy);
  const statusBadge = getProjectIconStatusBadge(placement.project, copy);

  return (
    <div
      role="button"
      tabIndex={0}
      data-project-grid-project={placement.projectId}
      className="group relative flex size-36 cursor-grab flex-col rounded-md border border-border bg-background p-2.5 transition-colors hover:bg-accent/50 active:cursor-grabbing"
      onClick={(event) => {
        if (
          (event.target as HTMLElement).closest(
            '[data-slot="sortable-item-handle"]'
          )
        ) {
          return;
        }
        onOpen();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        onOpen();
      }}
      onFocus={onPrefetch}
      onPointerEnter={onPrefetch}
    >
      <SortableItemHandle
        className="absolute end-1.5 top-2.5 z-10 text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100! group-hover:opacity-100 hover:text-foreground"
        onClick={(event) => event.stopPropagation()}
      >
        <GripVertical aria-hidden="true" className="size-3.5" />
      </SortableItemHandle>
      <div className="flex min-w-0 items-center gap-2 pe-4">
        <ProjectFileIcon className="size-7 shrink-0" />
        {clientName ? (
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {clientName}
          </p>
        ) : null}
      </div>
      <div className="mt-2 min-w-0 flex-1">
        <h4 className="line-clamp-2 text-sm leading-4 font-medium text-foreground">
          {placement.project.name}
        </h4>
        {displaySettings.showProjectCode ? (
          <p className="mt-1 truncate text-xs leading-4 text-muted-foreground">
            {placement.project.projectCode}
          </p>
        ) : null}
      </div>
      <div className="mt-1.5 flex min-w-0 items-center justify-between gap-1">
        {statusBadge ? (
          <ReuiBadge
            className="max-w-[62%] truncate"
            radius="default"
            size="sm"
            variant={statusBadge.variant}
          >
            {statusBadge.label}
          </ReuiBadge>
        ) : (
          <span />
        )}
        {displaySettings.showLastOpened ? (
          <span className="truncate text-[10px] text-muted-foreground">
            {lastOpened}
          </span>
        ) : null}
      </div>
    </div>
  );
}

const projectGridCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args);
};

const projectGridFolderCollisionDetection: CollisionDetection = (args) => {
  if (args.pointerCoordinates) {
    const folderId = getFolderFromBounds(
      args.pointerCoordinates.x,
      args.pointerCoordinates.y
    );
    if (folderId) {
      return [{ id: getFolderDroppableId(folderId) }];
    }
  }
  return projectGridCollisionDetection(args);
};

function getProjectIconClientName(
  placement: DesktopProjectPlacement,
  displaySettings: DesktopDisplaySettings,
  locale: Locale,
  copy: ReturnType<typeof useI18n>["dictionary"]["desktop"]
) {
  if (!displaySettings.showClientName) {
    return null;
  }
  const client = placement.project.cmpClient;
  if (!client) {
    return copy.unassignedClient ?? "Unassigned client";
  }
  return getProjectClientName(client, locale) || client.id;
}

function getProjectIconStatusBadge(
  project: Pick<Project, "status">,
  copy: Pick<
    ReturnType<typeof useI18n>["dictionary"]["desktop"],
    "activeStatus" | "archivedStatus" | "pendingFinalCheckStatus"
  >
) {
  if (project.status === "ACTIVE") {
    return {
      label: copy.activeStatus ?? "Active",
      variant: "success-light" as const,
    };
  }
  if (project.status === "PENDING_FINAL_CHECK") {
    return {
      label: copy.pendingFinalCheckStatus ?? "Pending archive review",
      variant: "info-light" as const,
    };
  }
  if (project.status === "ARCHIVED") {
    return {
      label: copy.archivedStatus ?? "Archived",
      variant: "warning-light" as const,
    };
  }
  return null;
}

function DesktopProjectDragOverlay({
  copy,
  displaySettings,
  locale,
  placement,
}: {
  copy: ReturnType<typeof useI18n>["dictionary"]["desktop"];
  displaySettings: DesktopDisplaySettings;
  locale: Locale;
  placement: DesktopProjectPlacement;
}) {
  return (
    <div
      data-testid="project-drag-overlay"
      className="flex h-[132px] w-[132px] flex-col items-center justify-start gap-1 rounded-md bg-background/95 p-2.5 text-center shadow-xl transition-none select-none"
    >
      <ProjectIconContents
        copy={copy}
        displaySettings={displaySettings}
        locale={locale}
        placement={placement}
      />
    </div>
  );
}

function ProjectIconContents({
  copy,
  displaySettings,
  locale,
  placement,
}: {
  copy: ReturnType<typeof useI18n>["dictionary"]["desktop"];
  displaySettings: DesktopDisplaySettings;
  locale: Locale;
  placement: DesktopProjectPlacement;
}) {
  const displayId = formatProjectDisplayId(placement.project.projectNumber);
  const densityClassName = getDesktopDensityClassName(displaySettings.density);
  const lastOpenedAt = formatDesktopRelativeTime(
    placement.lastOpenedAt,
    locale,
    copy.justNow ?? "just now"
  );
  const lastOpenedText = lastOpenedAt
    ? formatDesktopCopy(copy.lastOpenedRelative ?? "{time}", {
        time: lastOpenedAt,
      })
    : copy.neverOpened;
  const lastOpenedTitle = lastOpenedAt
    ? `${copy.lastOpened}: ${lastOpenedAt}`
    : copy.neverOpened;
  const reportDate = formatDesktopDate(placement.project.reportDate);
  const archiveDeadline = formatDesktopDate(placement.project.archiveDeadline);
  const statusBadge = getProjectStatusBadge(placement.project, copy);

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center text-center transition-transform",
        densityClassName.container
      )}
    >
      <ProjectFileIcon className={cn("mb-1", densityClassName.icon)} />
      <span
        className={cn(
          "line-clamp-2 w-full font-semibold text-foreground",
          densityClassName.title
        )}
      >
        {placement.project.name}
      </span>
      {statusBadge ? (
        <Badge
          variant="outline"
          className={cn(
            "max-w-full shrink-0 truncate px-1.5 py-0 text-[10px] leading-4",
            statusBadge.className
          )}
        >
          {statusBadge.label}
        </Badge>
      ) : null}
      {displaySettings.showProjectCode ? (
        <span
          className={cn(
            "w-full truncate font-mono text-muted-foreground",
            densityClassName.meta
          )}
        >
          {placement.project.projectCode}
        </span>
      ) : null}
      {displayId ? (
        <span className="w-full truncate font-mono text-[10px] leading-3 text-muted-foreground/80">
          {displayId}
        </span>
      ) : null}
      {displaySettings.showLastOpened ? (
        <AccessibleName label={lastOpenedTitle}>
          <span
            className={cn(
              "w-full truncate text-muted-foreground/80",
              densityClassName.detail
            )}
          >
            {lastOpenedText}
          </span>
        </AccessibleName>
      ) : null}
      {displaySettings.showReportDate && reportDate ? (
        <span
          className={cn(
            "w-full truncate text-muted-foreground/80",
            densityClassName.detail
          )}
        >
          {reportDate}
        </span>
      ) : null}
      {displaySettings.showArchiveDeadline && archiveDeadline ? (
        <span
          className={cn(
            "w-full truncate text-muted-foreground/80",
            densityClassName.detail
          )}
        >
          {archiveDeadline}
        </span>
      ) : null}
    </div>
  );
}

function DesktopContextMenu({
  canCreateProject,
  copy,
  currentSortPreference,
  displaySettings,
  onCreateFolder,
  onCreateProject,
  onDisplaySettingsChange,
  onClose,
  onSortDirectionChange,
  onSortSelect,
  sortDisabled,
  position,
}: {
  canCreateProject: boolean;
  copy: {
    sort: string;
    new: string;
    newProject: string;
    newFolder: string;
    display: string;
    sortDirection: string;
    ascending: string;
    descending: string;
    sortName: string;
    sortCreatedAt: string;
    sortLastOpened: string;
    sortReportDate: string;
    sortArchiveDeadline: string;
    density: string;
    densityCompact: string;
    densityStandard: string;
    densityComfortable: string;
    showProjectCode: string;
    showClientCode: string;
    showClientName: string;
    showLastOpened: string;
    showReportDate: string;
    showArchiveDeadline: string;
  };
  currentSortPreference: DesktopSortPreference | null;
  displaySettings: DesktopDisplaySettings;
  onCreateFolder: () => void;
  onCreateProject: () => void;
  onDisplaySettingsChange: <T extends keyof DesktopDisplaySettings>(
    key: T,
    value: DesktopDisplaySettings[T]
  ) => void;
  onClose: () => void;
  onSortDirectionChange: (direction: DesktopSortDirection) => void;
  onSortSelect: (preference: DesktopSortPreference) => void;
  sortDisabled: boolean;
  position: { x: number; y: number };
}) {
  const [submenu, setSubmenu] = useState<"sort" | "display" | null>(null);
  const menuRef = useRef<Element | null>(null);
  const currentSortField = currentSortPreference?.field ?? "name";
  const currentSortDirection = currentSortPreference?.direction ?? "asc";
  const lastOpenedSortDirection =
    currentSortField === "lastOpenedAt" ? currentSortDirection : "desc";
  const reducedMotion = useReducedMotion();
  const isPresent = useIsPresent();

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setSubmenu(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !isPresent) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isPresent, onClose]);

  return (
    <DynamicComponent
      component={motion.div}
      ref={menuRef}
      className={cn(
        "fixed z-50",
        DESKTOP_CONTEXT_MENU_CONTENT_CLASS,
        !isPresent && "pointer-events-none"
      )}
      dynamicStyle={{
        left: position.x,
        top: position.y,
        transformOrigin: "top left",
      }}
      role="menu"
      aria-hidden={!isPresent}
      data-emp-surface-motion="menu"
      inert={!isPresent}
      initial={
        reducedMotion
          ? { opacity: 0 }
          : { opacity: 0, transform: "translateY(-4px) scale(0.96)" }
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
              transform: "translateY(-2px) scale(0.98)",
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
      onClick={(event: ReactMouseEvent<HTMLDivElement>) =>
        event.stopPropagation()
      }
      onContextMenu={(event: ReactMouseEvent<HTMLDivElement>) =>
        event.stopPropagation()
      }
    >
      <MenuSubmenu
        icon={Clock3}
        label={copy.sort}
        open={submenu === "sort"}
        disabled={sortDisabled}
        onOpenChange={(open) => setSubmenu(open ? "sort" : null)}
      >
        <MenuOptionGroup label={copy.sortDirection}>
          <MenuDirectionToggle
            ascendingLabel={copy.ascending}
            descendingLabel={copy.descending}
            value={currentSortDirection}
            onChange={onSortDirectionChange}
          />
        </MenuOptionGroup>
        <div className="my-1 h-px bg-border" />
        <MenuOptionGroup label={copy.sort}>
          <MenuSelectableItem
            label={copy.sortName}
            selected={isSortPreferenceSelected(currentSortPreference, {
              field: "name",
              direction: currentSortDirection,
            })}
            onClick={() =>
              onSortSelect({ field: "name", direction: currentSortDirection })
            }
          />
          <MenuSelectableItem
            label={copy.sortCreatedAt}
            selected={isSortPreferenceSelected(currentSortPreference, {
              field: "createdAt",
              direction: currentSortDirection,
            })}
            onClick={() =>
              onSortSelect({
                field: "createdAt",
                direction: currentSortDirection,
              })
            }
          />
          <MenuSelectableItem
            label={copy.sortLastOpened}
            selected={isSortPreferenceSelected(currentSortPreference, {
              field: "lastOpenedAt",
              direction: lastOpenedSortDirection,
            })}
            onClick={() =>
              onSortSelect({
                field: "lastOpenedAt",
                direction: lastOpenedSortDirection,
              })
            }
          />
          <MenuSelectableItem
            label={copy.sortReportDate}
            selected={isSortPreferenceSelected(currentSortPreference, {
              field: "reportDate",
              direction: currentSortDirection,
            })}
            onClick={() =>
              onSortSelect({
                field: "reportDate",
                direction: currentSortDirection,
              })
            }
          />
          <MenuSelectableItem
            label={copy.sortArchiveDeadline}
            selected={isSortPreferenceSelected(currentSortPreference, {
              field: "archiveDeadline",
              direction: currentSortDirection,
            })}
            onClick={() =>
              onSortSelect({
                field: "archiveDeadline",
                direction: currentSortDirection,
              })
            }
          />
        </MenuOptionGroup>
      </MenuSubmenu>
      <div className="my-1 h-px bg-border" />
      <MenuItem icon={Plus} label={copy.new} />
      <div className="pl-8">
        {canCreateProject ? (
          <MenuItem
            icon={LayoutGrid}
            label={copy.newProject}
            onClick={onCreateProject}
          />
        ) : null}
        <MenuItem
          icon={Folder}
          label={copy.newFolder}
          onClick={onCreateFolder}
        />
      </div>
      <div className="my-1 h-px bg-border" />
      <MenuSubmenu
        icon={MonitorCog}
        label={copy.display}
        open={submenu === "display"}
        onOpenChange={(open) => setSubmenu(open ? "display" : null)}
      >
        <MenuOptionGroup label={copy.density}>
          <MenuSelectableItem
            label={copy.densityCompact}
            selected={displaySettings.density === "compact"}
            onClick={() => onDisplaySettingsChange("density", "compact")}
          />
          <MenuSelectableItem
            label={copy.densityStandard}
            selected={displaySettings.density === "standard"}
            onClick={() => onDisplaySettingsChange("density", "standard")}
          />
          <MenuSelectableItem
            label={copy.densityComfortable}
            selected={displaySettings.density === "comfortable"}
            onClick={() => onDisplaySettingsChange("density", "comfortable")}
          />
        </MenuOptionGroup>
        <div className="my-1 h-px bg-border" />
        <MenuOptionGroup label={copy.display}>
          <MenuSelectableItem
            label={copy.showProjectCode}
            selected={displaySettings.showProjectCode}
            onClick={() =>
              onDisplaySettingsChange(
                "showProjectCode",
                !displaySettings.showProjectCode
              )
            }
          />
          <MenuSelectableItem
            label={copy.showClientCode}
            selected={displaySettings.showClientCode}
            onClick={() =>
              onDisplaySettingsChange(
                "showClientCode",
                !displaySettings.showClientCode
              )
            }
          />
          <MenuSelectableItem
            label={copy.showClientName}
            selected={displaySettings.showClientName}
            onClick={() =>
              onDisplaySettingsChange(
                "showClientName",
                !displaySettings.showClientName
              )
            }
          />
          <MenuSelectableItem
            label={copy.showLastOpened}
            selected={displaySettings.showLastOpened}
            onClick={() =>
              onDisplaySettingsChange(
                "showLastOpened",
                !displaySettings.showLastOpened
              )
            }
          />
          <MenuSelectableItem
            label={copy.showReportDate}
            selected={displaySettings.showReportDate}
            onClick={() =>
              onDisplaySettingsChange(
                "showReportDate",
                !displaySettings.showReportDate
              )
            }
          />
          <MenuSelectableItem
            label={copy.showArchiveDeadline}
            selected={displaySettings.showArchiveDeadline}
            onClick={() =>
              onDisplaySettingsChange(
                "showArchiveDeadline",
                !displaySettings.showArchiveDeadline
              )
            }
          />
        </MenuOptionGroup>
      </MenuSubmenu>
    </DynamicComponent>
  );
}

function MenuItem({
  icon: Icon,
  disabled,
  label,
  onClick,
}: {
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "w-full justify-start",
        DESKTOP_CONTEXT_MENU_ITEM_CLASS,
        disabled
          ? "cursor-not-allowed text-muted-foreground/60"
          : "hover:bg-muted"
      )}
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="size-4 text-muted-foreground" />
      <span>{label}</span>
    </Button>
  );
}

function MenuSubmenu({
  children,
  disabled,
  icon: Icon,
  label,
  onOpenChange,
  open,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <div
      className="relative"
      onMouseEnter={() => !disabled && onOpenChange(true)}
      onMouseLeave={() => onOpenChange(false)}
    >
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "w-full justify-start",
          DESKTOP_CONTEXT_MENU_ITEM_CLASS,
          disabled
            ? "cursor-not-allowed text-muted-foreground/60"
            : "hover:bg-muted"
        )}
        role="menuitem"
        disabled={disabled}
        onClick={() => !disabled && onOpenChange(!open)}
      >
        <Icon className="size-4 text-muted-foreground" />
        <span className="min-w-0 flex-1">{label}</span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Button>
      {open ? (
        <div className="absolute top-0 left-full min-w-64 rounded-md border border-border bg-popover p-1 shadow-xl">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function MenuOptionGroup({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="grid gap-1">
      <div className="px-3 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      {children}
    </div>
  );
}

function MenuSelectableItem({
  label,
  onClick,
  selected,
}: {
  label: string;
  onClick: () => void;
  selected: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "w-full justify-start hover:bg-muted",
        DESKTOP_CONTEXT_MENU_ITEM_CLASS,
        selected ? "bg-muted/80 text-foreground" : "text-foreground"
      )}
      role="menuitemcheckbox"
      aria-checked={selected}
      onClick={onClick}
    >
      <span className="flex size-4 items-center justify-center">
        {selected ? <Check className="size-4 text-primary" /> : null}
      </span>
      <span>{label}</span>
    </Button>
  );
}

function MenuDirectionToggle({
  ascendingLabel,
  descendingLabel,
  value,
  onChange,
}: {
  ascendingLabel: string;
  descendingLabel: string;
  value: DesktopSortDirection;
  onChange: (direction: DesktopSortDirection) => void;
}) {
  return (
    <ButtonGroup
      className={cn(
        "grid w-full grid-cols-2 gap-2 px-2 pb-1",
        BUTTON_GROUP_SEPARATED_ITEMS_CLASS
      )}
    >
      <Button
        type="button"
        variant="outline"
        className={cn(
          "h-8 rounded-sm px-3 text-sm",
          value === "asc"
            ? "border-primary bg-surface text-primary"
            : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
        onClick={() => onChange("asc")}
      >
        {ascendingLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        className={cn(
          "h-8 rounded-sm px-3 text-sm",
          value === "desc"
            ? "border-primary bg-surface text-primary"
            : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
        onClick={() => onChange("desc")}
      >
        {descendingLabel}
      </Button>
    </ButtonGroup>
  );
}

function parseDisplaySettings(value: string): DesktopDisplaySettings {
  try {
    const parsed = JSON.parse(value) as Partial<DesktopDisplaySettings>;
    return {
      projectCodePreferenceVersion: 1,
      density:
        parsed.density === "compact" ||
        parsed.density === "standard" ||
        parsed.density === "comfortable"
          ? parsed.density
          : defaultDisplaySettings.density,
      showProjectCode:
        parsed.projectCodePreferenceVersion === 1 &&
        typeof parsed.showProjectCode === "boolean"
          ? parsed.showProjectCode
          : defaultDisplaySettings.showProjectCode,
      showClientCode:
        typeof parsed.showClientCode === "boolean"
          ? parsed.showClientCode
          : defaultDisplaySettings.showClientCode,
      showClientName:
        typeof parsed.showClientName === "boolean"
          ? parsed.showClientName
          : defaultDisplaySettings.showClientName,
      showLastOpened:
        typeof parsed.showLastOpened === "boolean"
          ? parsed.showLastOpened
          : defaultDisplaySettings.showLastOpened,
      showReportDate:
        typeof parsed.showReportDate === "boolean"
          ? parsed.showReportDate
          : defaultDisplaySettings.showReportDate,
      showArchiveDeadline:
        typeof parsed.showArchiveDeadline === "boolean"
          ? parsed.showArchiveDeadline
          : defaultDisplaySettings.showArchiveDeadline,
    };
  } catch {
    return defaultDisplaySettings;
  }
}

function isHomeViewMode(value: string | null): value is HomeViewMode {
  return value === "list" || value === "icons";
}

function parseSortPreferences(
  value: string
): Record<string, DesktopSortPreference> {
  try {
    const parsed = JSON.parse(value) as Record<
      string,
      Partial<DesktopSortPreference>
    >;
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([folderId, preference]) =>
        isValidSortPreference(preference) ? [[folderId, preference]] : []
      )
    );
  } catch {
    return {};
  }
}

function isValidSortPreference(
  value: Partial<DesktopSortPreference> | undefined
): value is DesktopSortPreference {
  if (!value) {
    return false;
  }
  return (
    [
      "name",
      "createdAt",
      "lastOpenedAt",
      "reportDate",
      "archiveDeadline",
    ].includes(value.field ?? "") &&
    ["asc", "desc"].includes(value.direction ?? "")
  );
}

function isSortPreferenceSelected(
  current: DesktopSortPreference | null,
  expected: DesktopSortPreference
) {
  return (
    current?.field === expected.field &&
    current.direction === expected.direction
  );
}

function sortPlacements(
  placements: DesktopProjectPlacement[],
  preference: DesktopSortPreference
) {
  return [...placements].sort((left, right) => {
    const baseComparison = comparePlacementByField(
      left,
      right,
      preference.field
    );
    if (baseComparison !== 0) {
      return preference.direction === "asc" ? baseComparison : -baseComparison;
    }
    return left.project.name.localeCompare(right.project.name);
  });
}

function comparePlacementByField(
  left: DesktopProjectPlacement,
  right: DesktopProjectPlacement,
  field: DesktopSortField
) {
  if (field === "name") {
    return left.project.name.localeCompare(right.project.name);
  }
  if (field === "createdAt") {
    return compareOptionalTimes(left.createdAt, right.createdAt);
  }
  if (field === "lastOpenedAt") {
    return compareOptionalTimes(left.lastOpenedAt, right.lastOpenedAt);
  }
  if (field === "reportDate") {
    return compareOptionalTimes(
      left.project.reportDate,
      right.project.reportDate
    );
  }
  return compareOptionalTimes(
    left.project.archiveDeadline,
    right.project.archiveDeadline
  );
}

function compareOptionalTimes(left?: string | null, right?: string | null) {
  const leftTime = left ? new Date(left).getTime() : Number.NaN;
  const rightTime = right ? new Date(right).getTime() : Number.NaN;
  const leftHasValue = Number.isFinite(leftTime);
  const rightHasValue = Number.isFinite(rightTime);
  if (leftHasValue && rightHasValue) {
    return leftTime - rightTime;
  }
  if (leftHasValue) {
    return -1;
  }
  if (rightHasValue) {
    return 1;
  }
  return 0;
}

function getDesktopDensityClassName(density: DesktopIconDensity) {
  switch (density) {
    case "compact": {
      return {
        container: "gap-0 scale-90",
        icon: "size-9",
        title: "text-[10px] leading-3.5",
        meta: "text-[9px] leading-3",
        detail: "text-[9px] leading-3",
      };
    }
    case "comfortable": {
      return {
        container: "gap-1.5 scale-[1.03]",
        icon: "size-12",
        title: "text-[13px] leading-4",
        meta: "text-xs leading-4",
        detail: "text-[11px] leading-3.5",
      };
    }
    default: {
      return {
        container: "gap-1",
        icon: "size-12",
        title: "text-xs leading-4",
        meta: "text-[11px] leading-4",
        detail: "text-[10px] leading-3",
      };
    }
  }
}

function formatDesktopDate(value?: string) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return value.includes("T") ? value.slice(0, 10) : value;
}

function filterProjectTemplates(templates: ProjectTemplate[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) {
    return templates;
  }
  return templates.filter((template) =>
    [
      template.code,
      template.name,
      template.description ?? "",
      template.frameworkTemplate?.code ?? "",
      template.frameworkTemplate?.name ?? "",
    ].some((value) => value.toLowerCase().includes(query))
  );
}

function filterSmartFormTemplates(
  templates: SmartFormTemplate[],
  search: string
) {
  const query = search.trim().toLowerCase();
  if (!query) {
    return templates;
  }
  return templates.filter((template) =>
    [
      template.code,
      template.name,
      template.description ?? "",
      template.frameworkTemplate?.code ?? "",
      template.frameworkTemplate?.name ?? "",
    ].some((value) => value.toLowerCase().includes(query))
  );
}

function createSmartFormDraftId(prefix: string) {
  const randomId =
    globalThis.crypto?.randomUUID?.() ??
    `${String(Date.now())}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomId}`.slice(0, 120);
}

function createDefaultSmartFormDraft(
  frameworkTemplateId = ""
): SmartFormTemplateDraft {
  return {
    name: "",
    code: "",
    description: "",
    frameworkTemplateId,
  };
}

function isSmartFormDraftValid(draft: SmartFormTemplateDraft) {
  return Boolean(draft.name.trim() && draft.code.trim());
}

function buildSmartFormV2Definition(
  draft: SmartFormTemplateDraft,
  defaultSectionTitle: string
): SmartFormV2Definition {
  const definitionId = createSmartFormDraftId("smart-form");
  return {
    kind: "smartForm",
    schemaVersion: 2,
    id: definitionId,
    i18n: {
      defaultLocale: "zh-CN",
      supportedLocales: ["zh-CN", "en-US"],
      fallbackLocales: { "en-US": ["zh-CN"] },
      publishingPolicy: "default-required",
    },
    title: createSmartFormV2LocalizedText(draft.name.trim(), draft.name.trim()),
    description: createSmartFormV2LocalizedText(
      draft.description.trim(),
      draft.description.trim()
    ),
    children: [
      {
        kind: "section",
        id: createSmartFormDraftId("section"),
        title: createSmartFormV2LocalizedText(
          defaultSectionTitle,
          "New section"
        ),
        children: [],
      },
    ],
  };
}

function createSmartFormV2LocalizedText(
  zh: string,
  en: string
): SmartFormV2Definition["title"] {
  const paragraph = (text: string, locale: string) => ({
    type: "doc" as const,
    version: 1 as const,
    content: [
      {
        type: "paragraph" as const,
        id: createSmartFormDraftId(`paragraph-${locale}`),
        content: text ? [{ type: "text" as const, text }] : [],
      },
    ],
  });
  return {
    values: {
      "zh-CN": paragraph(zh, "zh"),
      "en-US": paragraph(en, "en"),
    },
  };
}
function buildProjectTemplateWorkflow(nodes: ProjectTemplateNode[]) {
  const byId = new Map<string, ProjectTemplateWorkflowNode>();
  for (const node of nodes) {
    byId.set(node.id, {
      id: node.id,
      parentId: node.parentId ?? null,
      code: node.code,
      title: node.title,
      level: node.level,
      nodeType: node.nodeType,
      sortOrder: node.sortOrder,
      auditAreaCode: node.auditAreaCode,
      workingPapers: [],
      children: [],
    });
  }

  const roots: ProjectTemplateWorkflowNode[] = [];
  for (const node of nodes) {
    const treeNode = byId.get(node.id);
    if (!treeNode) {
      continue;
    }
    if (node.parentId && byId.has(node.parentId)) {
      const parent = byId.get(node.parentId);
      if (parent) {
        parent.children.push(treeNode);
      }
    } else {
      roots.push(treeNode);
    }
  }

  sortProjectTemplateWorkflow(roots);
  return roots;
}

function sortProjectTemplateWorkflow(nodes: ProjectTemplateWorkflowNode[]) {
  nodes.sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.code.localeCompare(right.code)
  );
  for (const node of nodes) {
    sortProjectTemplateWorkflow(node.children);
  }
}

function getProjectTemplateFiles(nodes: ProjectTemplateNode[]) {
  return nodes
    .flatMap((node) =>
      (node.files ?? []).map((file) => ({
        node,
        file,
      }))
    )
    .sort(
      (left, right) =>
        left.node.code.localeCompare(right.node.code) ||
        left.file.sortOrder - right.file.sortOrder ||
        left.file.code.localeCompare(right.file.code)
    );
}

function getProjectTemplateSmartForms(nodes: ProjectTemplateNode[]) {
  return nodes
    .flatMap((node) =>
      (node.smartForms ?? []).map((smartForm) => ({
        node,
        smartForm,
      }))
    )
    .sort(
      (left, right) =>
        left.node.code.localeCompare(right.node.code) ||
        left.smartForm.sortOrder - right.smartForm.sortOrder ||
        left.smartForm.code.localeCompare(right.smartForm.code)
    );
}

function formatSmartFormSummary(
  template: string,
  definition: unknown,
  invalidDefinitionLabel: string
) {
  if (!isValidSmartFormV2Definition(definition)) {
    return invalidDefinitionLabel;
  }
  return formatDesktopCopy(
    template,
    countSmartFormV2Nodes(definition.children)
  );
}

function isValidSmartFormV2Definition(
  value: unknown
): value is SmartFormV2Definition {
  return SmartFormV2DefinitionSchema.safeParse(value).success;
}

function countSmartFormV2Nodes(nodes: SmartFormV2Node[]): {
  sections: number;
  questions: number;
} {
  return nodes.reduce(
    (summary, node) => {
      if (node.kind === "section") {
        summary.sections += 1;
      }
      if (node.kind === "field") {
        summary.questions += 1;
      }
      if (node.kind === "conditional") {
        summary.questions += 1;
        const branchSummary = countSmartFormV2Nodes([
          ...node.branches.flatMap((branch) => branch.children),
          ...node.otherwise.children,
        ]);
        summary.sections += branchSummary.sections;
        summary.questions += branchSummary.questions;
      }
      if ("children" in node) {
        const childSummary = countSmartFormV2Nodes(node.children);
        summary.sections += childSummary.sections;
        summary.questions += childSummary.questions;
      }
      return summary;
    },
    { sections: 0, questions: 0 }
  );
}

function formatFileSize(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "-";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatDesktopRelativeTime(
  value: string | null | undefined,
  locale: Locale,
  justNowLabel: string
) {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 1000)
  );
  if (elapsedSeconds < 60) {
    return justNowLabel;
  }

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];
  const [unit, secondsInUnit] = units.find(
    ([, seconds]) => elapsedSeconds >= seconds
  ) ?? ["minute", 60];
  const count = Math.max(1, Math.floor(elapsedSeconds / secondsInUnit));

  return new Intl.RelativeTimeFormat(locale, { numeric: "always" }).format(
    -count,
    unit
  );
}

function formatDesktopCopy(
  template: string,
  values: Record<string, string | number>
) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template
  );
}

function resolvePosition(
  placement: DesktopProjectPlacement,
  positions: Record<string, DesktopPosition>
) {
  return (
    positions[placement.projectId] ?? {
      x: placement.desktopX,
      y: placement.desktopY,
    }
  );
}

function snapForCanvas(
  position: DesktopPosition,
  canvas: HTMLDivElement | null
) {
  const bounds = getCanvasBounds(canvas);
  return snapDesktopPosition(clampDesktopPosition(position, bounds), bounds);
}

function getCanvasBounds(canvas: HTMLDivElement | null) {
  const rect = canvas?.getBoundingClientRect();
  return {
    width: rect?.width || 1600,
    height: rect?.height || 900,
    iconWidth: ICON_WIDTH,
    iconHeight: ICON_HEIGHT,
  };
}

function getFolderFromBounds(clientX: number, clientY: number) {
  const folders = document.querySelectorAll<HTMLElement>(
    "[data-desktop-folder-id]"
  );
  for (const folder of folders) {
    const rect = folder.getBoundingClientRect();
    if (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    ) {
      return folder.dataset.desktopFolderId ?? null;
    }
  }
  return null;
}

function getFolderDroppableId(folderId: string) {
  return `folder:${folderId}`;
}

function getFolderIdFromDroppableId(
  droppableId: UniqueIdentifier | null | undefined
) {
  if (!isFolderDroppableId(droppableId)) {
    return null;
  }
  return String(droppableId).slice("folder:".length);
}

function getFolderIdFromDragEvent(event: DragEndEvent) {
  const activator = event.activatorEvent as Event & {
    clientX?: number;
    clientY?: number;
    changedTouches?: ArrayLike<{ clientX: number; clientY: number }>;
  };
  const changedTouch = activator.changedTouches?.[0];
  const startX = changedTouch?.clientX ?? activator.clientX;
  const startY = changedTouch?.clientY ?? activator.clientY;
  if (typeof startX !== "number" || typeof startY !== "number") {
    return null;
  }
  return getFolderFromBounds(startX + event.delta.x, startY + event.delta.y);
}

function isFolderDroppableId(droppableId: UniqueIdentifier | null | undefined) {
  return typeof droppableId === "string" && droppableId.startsWith("folder:");
}

function toDateInputValue(value?: string) {
  if (!value) {
    return "";
  }
  return value.slice(0, 10);
}

function addDaysIsoDate(value: string, days: number) {
  if (!value) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

type CalendarDateControlProps = {
  className?: string;
  disabled?: boolean;
  id: string;
  locale: Locale;
  onChange: (value: string) => void;
  open: boolean;
  placeholder: string;
  setOpen: (open: boolean) => void;
  todayLabel: string;
  value: string;
};

function renderCalendarDateControl(props: CalendarDateControlProps) {
  return <CalendarDateControl {...props} />;
}

function useCalendarOutsideDismissal(
  open: boolean,
  setOpen: (open: boolean) => void,
  contentRef: RefObject<HTMLElement | null>,
  triggerRef: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const closeOnOutsideInteraction = (event: MouseEvent | PointerEvent) => {
      const { target } = event;
      if (!(target instanceof Node)) {
        return;
      }
      if (contentRef.current?.contains(target)) {
        return;
      }
      if (triggerRef.current?.contains(target)) {
        return;
      }
      if (
        target instanceof Element &&
        target.closest('[data-slot="select-content"]')
      ) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideInteraction, true);
    document.addEventListener("click", closeOnOutsideInteraction, true);

    return () => {
      document.removeEventListener(
        "pointerdown",
        closeOnOutsideInteraction,
        true
      );
      document.removeEventListener("click", closeOnOutsideInteraction, true);
    };
  }, [contentRef, open, setOpen, triggerRef]);
}

function CalendarDateControl({
  className,
  disabled,
  id,
  locale,
  onChange,
  open,
  placeholder,
  setOpen,
  todayLabel,
  value,
}: CalendarDateControlProps) {
  const selectedDate = parseIsoDate(value);
  const calendarLocale = getCalendarLocale(locale);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedDateTime = selectedDate?.getTime() ?? null;
  const [displayMonth, setDisplayMonth] = useState(
    () => selectedDate ?? new Date()
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setDisplayMonth(selectedDate ?? new Date());
  }, [open, selectedDate, selectedDateTime]);

  const commitDate = (date: Date | undefined) => {
    if (!date) {
      return;
    }
    setDisplayMonth(date);
    onChange(formatIsoDate(date));
  };
  useCalendarOutsideDismissal(open, setOpen, contentRef, triggerRef);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            ref={triggerRef}
            type="button"
            variant="outline"
            disabled={disabled}
            data-empty={!selectedDate}
            className={cn(
              "w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground",
              className
            )}
          />
        }
      >
        <CalendarDays data-icon="inline-start" />
        {selectedDate ? formatCalendarDate(selectedDate, locale) : placeholder}
      </PopoverTrigger>
      {open ? (
        <PopoverContent
          side="bottom"
          align="start"
          collisionAvoidance={{
            side: "flip",
            align: "shift",
          }}
          className="max-h-[calc(100vh-2rem)] w-auto overflow-y-auto p-0"
          data-testid={`${id}-calendar`}
        >
          <Card
            ref={contentRef}
            size="sm"
            className="w-fit max-w-[300px]"
            data-slot="calendar-preset-surface"
          >
            <CardContent className="p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                month={displayMonth}
                onMonthChange={setDisplayMonth}
                locale={calendarLocale}
                captionLayout="dropdown"
                startMonth={CALENDAR_START_MONTH}
                endMonth={CALENDAR_END_MONTH}
                fixedWeeks
                className="p-0 [--cell-size:--spacing(9.5)]"
                onSelect={commitDate}
              />
            </CardContent>
            <CardFooter
              data-slot="calendar-preset-footer"
              className="flex flex-wrap gap-2 border-t border-border/40 bg-card"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 bg-card"
                onClick={() => commitDate(new Date())}
              >
                {todayLabel}
              </Button>
            </CardFooter>
          </Card>
        </PopoverContent>
      ) : null}
    </Popover>
  );
}

function addYearsIsoDate(value: string | undefined, years: number) {
  if (!value) {
    return "";
  }
  const date = new Date(`${toDateInputValue(value)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString().slice(0, 10);
}

function buildSearchResults({
  folders,
  labels,
  placements,
  query,
}: {
  folders: DesktopFolder[];
  labels: {
    folder: string;
    project: string;
  };
  placements: DesktopProjectPlacement[];
  query: string;
}) {
  const folderResults = folders
    .filter((folder) =>
      matchesDesktopSearch({ visibleFields: [folder.name] }, query)
    )
    .map((folder) => ({
      id: folder.id,
      kind: "folder" as const,
      label: labels.folder,
      title: folder.name,
      subtitle: labels.folder,
    }));
  const projectResults = placements
    .filter((placement) => {
      const { project } = placement;
      return matchesDesktopSearch(
        {
          visibleFields: [
            project.projectCode,
            project.name,
            formatProjectDisplayId(project.projectNumber),
            project.frameworkTemplate?.code,
            project.frameworkTemplate?.name,
            project.reportingDate.slice(0, 10),
          ].filter((value): value is string => Boolean(value)),
        },
        query
      );
    })
    .map((placement) => ({
      id: placement.project.id,
      kind: "project" as const,
      label: labels.project,
      title: placement.project.projectCode,
      subtitle: placement.project.name,
    }));
  return [...folderResults, ...projectResults];
}

function getDesktopProjectLabel(project: DesktopProjectPlacement["project"]) {
  return [
    project.projectCode,
    project.name,
    formatProjectDisplayId(project.projectNumber),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

function getInboxMessageProjectId(message: InboxMessage) {
  return (
    message.projectId ??
    message.project?.id ??
    message.projectInvitation?.project.id ??
    null
  );
}
