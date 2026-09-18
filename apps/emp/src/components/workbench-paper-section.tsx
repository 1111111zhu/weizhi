"use client";
import { useDndMonitor, useDroppable } from "@dnd-kit/core";
import type { DragEndEvent, DragMoveEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  ATTACHMENT_PLACEHOLDER_TYPES,
  REVIEW_QUESTION_IMAGE_MAX_PER_MESSAGE,
  REVIEW_QUESTION_IMAGE_MAX_SIZE_BYTES,
  REVIEW_QUESTION_IMAGE_MIME_TYPES,
  SMART_FORM_MIME_TYPE,
  getAttachmentPlaceholderTypeForFile,
  isDesktopAgentOpenSupportedFileName,
} from "@project-wing/shared";
import type {
  AttachmentPlaceholderType,
  ConfirmReviewQuestionImageInput,
  DesktopAgentSession,
  ProjectLanguage,
  ProjectRole,
  WorkingPaperBucket,
} from "@project-wing/shared";
import {
  Button as SignoffButton,
  Badge as StatusBadge,
  DataGrid,
  DataGridScrollArea,
  DataGridTableBodyRow,
  DataGridTableBodyRowCell,
  DataGridTableFillBodyCell,
  DataGridTableFillHeadCell,
  DataGridTableHead,
  DataGridTableHeadRow,
  DataGridTableHeadRowCell,
  DataGridTableHeadRowCellResize,
  DataGridTableVirtual,
  Frame,
  FrameHeader,
  FramePanel,
  ProjectWingDevLogo,
  ProjectWingMasterDataGridColumnHeader,
  projectWingSelectedValuesFilter,
  useCompactViewport,
  useMobileKeyboardViewport,
  MobileActionSheet,
  MobileListItem,
  ProjectWingFileTypeIcon,
} from "@project-wing/ui";
import type { DataGridTableVirtualRowRenderer } from "@project-wing/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type {
  ColumnDef,
  ColumnFiltersState,
  ColumnSizingState,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Circle,
  CircleCheck,
  CirclePlus,
  Clock3,
  ClipboardCheck,
  ClipboardPaste,
  Copy,
  Download,
  Eye,
  File as FileIcon,
  FileSpreadsheet,
  Folder,
  FolderInput,
  GitBranch,
  Hash,
  ImageOff,
  ListFilter,
  LayoutTemplate,
  Lock,
  LockOpen,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Paperclip,
  Power,
  RefreshCcw,
  Scissors,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  Fragment,
  cloneElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ClipboardEvent,
  CSSProperties,
  DragEvent,
  KeyboardEvent,
  ReactElement,
  ReactNode,
  RefObject,
} from "react";

import { FileUpload } from "@/components/extend/file-upload";
import { Button as MotionButton } from "@/components/motion/button/base";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button, buttonVariants } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DynamicComponent } from "@/components/ui/dynamic-layout";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getProjectMemberMentionOptions } from "@/lib/member-role-labels";

import { ApiError, api, getAttachmentPreviewPdfUrl } from "../api/client";
import type {
  Attachment,
  AttachmentExportFormat,
  AttachmentConflictResolution,
  AttachmentVersion,
  ProjectAttachment,
  ProjectMember,
  ReviewQuestionMessageImage,
  ReviewQuestionMessageReference,
  SmartFormReadResponse,
  SmartFormSessionResponse,
  SpreadsheetPreview,
  WorkingPaperQuestion,
  WorkingPaperQuestionMessage,
  WorkingPaperSignoff,
  WorkflowNode,
  ZipMasterEntry,
  ZipEntryMasterOpenResponse,
  ZipMasterCloseResponse,
  ZipMasterFileOperationInput,
  ZipMasterSessionResponse,
  ZipMasterTextOperationInput,
  ZipReadOnlyResponse,
  WorkingPaper,
} from "../api/client";
import {
  DesktopAgentClientError,
  checkDesktopAgentAvailability,
  checkInDesktopAgentSession,
  getDesktopAgentReleaseManifest,
  getDesktopAgentStatus,
  getDesktopAgentUpdateStatus,
  listDesktopAgentSessions,
  openAttachmentInDesktopAgent,
  releaseDesktopAgentSession,
  updateDesktopAgent,
} from "../api/desktop-agent";
import type { DesktopAgentStatus } from "../api/desktop-agent";
import { getApiMode, isMockApiMode } from "../api/mode";
import {
  defaultDesktopAgentManagementCopy,
  defaultFileOccupancyCopy,
} from "../i18n/dictionaries";
import { getEmpMobileNavigationCopy } from "../i18n/mobile-navigation";
import {
  getAttachmentPreviewCapabilities,
  getAttachmentPreviewFamily,
} from "../lib/attachment-preview";
import type { AttachmentPreviewKind } from "../lib/attachment-preview";
import { showErrorToast } from "../lib/error-toast";
import { openAuthorizedPreviewWindow } from "../lib/open-preview-window";
import {
  attachmentContentPreviewQueryKey,
  getAttachmentContentPreviewKind,
  PREVIEW_QUERY_GC_TIME_MS,
  PREVIEW_QUERY_META,
  PREVIEW_QUERY_STALE_TIME_MS,
  seedUploadedAttachmentPreview,
} from "../lib/preview-query-cache";
import { formatDisplayName } from "../lib/project-layout";
import { getFileLevelReviewQuestions } from "../lib/review-question-scope";
import { formatAccountDisplayName } from "../lib/user-display";
import { cn } from "../lib/utils";
import {
  WORKBENCH_FILE_DRAG_TYPE,
  WORKBENCH_FILE_PREVIEW_DROPPABLE_ID,
  getWorkbenchFileSortableId,
} from "../lib/workbench-file-dnd";
import { DesktopAgentSettingsPrompt } from "./desktop-agent-settings-prompt";
import type { DesktopAgentSettingsPromptCopy } from "./desktop-agent-settings-prompt";
import { EmpMobileReviewQuestionFooter } from "./emp-mobile-review-question-footer";
import { EmptyState } from "./empty-state";
import { ArchiveViewer } from "./extend/archive-viewer";
import { AttachmentPreviewShell } from "./extend/attachment-preview-shell";
import { CsvViewer } from "./extend/csv-viewer";
import { DocumentAssetViewer } from "./extend/document-asset-viewer";
import { DocxViewerPreview } from "./extend/docx-viewer";
import { PDFViewer } from "./extend/pdf-viewer";
import { PptxViewerPreview } from "./extend/pptx-viewer";
import { PreviewCloseContext } from "./extend/preview-close-action";
import { PreviewLoadingState } from "./extend/preview-loading-state";
import { PreviewPanelActions } from "./extend/preview-panel-actions";
import { usePreviewDarkMode } from "./extend/use-preview-dark-mode";
import { XlsxViewerPreview } from "./extend/xlsx-viewer";
import {
  HeaderAvatar,
  getAvatarColorClassName,
  getAvatarInitials,
} from "./header-avatar";
import { ProjectFileTypeIcon } from "./project-file-type-icon";
import {
  confirmReviewMessage,
  mergeReviewMessages,
} from "./review-note-message-state";
import type { LocalReviewMessage } from "./review-note-message-state";
import {
  ReviewNoteRichText,
  ReviewNoteRichTextComposer,
  reviewNotePlainText,
} from "./review-note-rich-text";
import type { ReviewNoteEditorCopy } from "./review-note-rich-text";
import {
  SmartFormEditor,
  defaultSmartFormEditorCopy,
} from "./smart-form-editor";
import type {
  SmartFormEditorCopy,
  SmartFormWorkingPaperOption,
} from "./smart-form-editor";
import type { SmartFormV2ReviewTarget } from "./smart-form-v2-review-questions";
import { StatusBadge as Badge } from "./status-badge";
import { useNativePdfViewerPreference } from "./theme-provider";
import { useToast } from "./toast";
import { WorkbenchAuditLogs } from "./workbench-audit-logs";
import {
  CachedPdfViewerPreview,
  CachedSpreadsheetPreview,
  SPREADSHEET_PAGE_COLUMNS,
  SPREADSHEET_PAGE_ROWS,
} from "./workbench-cached-preview";
import type {
  DirectoryFileClipboard,
  DirectoryFileTransfer,
} from "./workbench-directory";
import { changesAttachmentOrder } from "./workbench-file-reorder";
import type { AttachmentInsertionPosition } from "./workbench-file-reorder";
import { WorkbenchMoveToDialog } from "./workbench-move-to-dialog";
import type { WorkbenchMoveToDialogCopy } from "./workbench-move-to-dialog";
import type { WorkbenchReviewNotesTarget } from "./workbench-review-notes-types";
import { defaultTemplateLibraryCopy } from "./workbench-template-library-dialog";
import type { WorkbenchTemplateLibraryCopy } from "./workbench-template-library-dialog";
import {
  getDesktopAgentProjectSessionSignature,
  hasMasterZipEntries,
  shouldRefreshZipMasterPanelForDesktopAgentChange,
} from "./zip-entry-master-status-sync";
import {
  defaultZipMasterEditorCopy,
  ZipMasterEditor,
} from "./zip-master-editor";
import type { ZipMasterEditorCopy } from "./zip-master-editor";

export { ProjectFileTypeIcon } from "./project-file-type-icon";

const EMPTY_DEFAULT_ARRAY: never[] = [];
const EMPTY_DESKTOP_AGENT_SESSIONS: DesktopAgentSession[] = [];
const EMPTY_WORKING_PAPERS: WorkingPaper[] = [];

export type WorkbenchPaperForm = {
  code: string;
  title: string;
  paperType: "WORKING_PAPER" | "SUPPLEMENT";
  bucket: WorkingPaperBucket;
};

export type WorkbenchBreadcrumbSegment = {
  nodeId: string;
  label: string;
};

type ZipArchivePanelState =
  | {
      mode: "MASTER";
      session: ZipMasterSessionResponse;
    }
  | {
      mode: "READ_ONLY";
      archive: ZipReadOnlyResponse;
    };

type SmartFormPanelState =
  | {
      mode: "MASTER";
      session: SmartFormSessionResponse;
    }
  | {
      mode: "READ_ONLY";
      form: SmartFormReadResponse;
    };

export type ReviewQuestionReplyPayload = {
  replyBody: string;
  images?: ConfirmReviewQuestionImageInput[];
  referencedWorkingPaperIds?: string[];
};

type ReviewQuestionImageDraft = {
  id: string;
  file: File;
  previewUrl: string;
};

const REVIEW_QUESTION_IMAGE_ACCEPT = REVIEW_QUESTION_IMAGE_MIME_TYPES.join(",");
const REVIEW_QUESTION_IMAGE_MIME_TYPE_SET = new Set<string>(
  REVIEW_QUESTION_IMAGE_MIME_TYPES
);
const CREATE_REVIEW_QUESTION_DRAFT_ID = "__create-review-question__";

type RestoreAttachmentTarget = {
  workingPaperId?: string;
  workflowNodeId?: string;
};

const ORIGINAL_RESTORE_TARGET = "__original__";
const defaultBucketLabels: Record<WorkingPaperBucket, string> = {
  CURRENT: "Current workpapers",
  PRIOR: "Prior workpapers",
  TEMPORARY: "Temporary files",
};
const defaultBucketShortLabels: Record<WorkingPaperBucket, string> = {
  CURRENT: "Current",
  PRIOR: "Prior",
  TEMPORARY: "Temporary",
};
const defaultBucketDescriptions: Record<WorkingPaperBucket, string> = {
  CURRENT: "Upload and manage current-period workpaper files.",
  PRIOR: "Upload prior-period workpaper files for reference.",
  TEMPORARY: "Upload temporary supporting files.",
};
const DESKTOP_AGENT_MASTER_UNSUPPORTED_FILE_MESSAGE =
  "Open via Desktop Agent currently supports xlsx, xls, xlsm, xlsb, csv, tsv, docx, doc, pptx, ppt, and pdf files only.";
const DESKTOP_AGENT_START_PROTOCOL_URL = "projectwing-agent://start";
const DESKTOP_AGENT_UNAVAILABLE_MESSAGE = "Desktop agent is not available.";
const DESKTOP_AGENT_UPDATE_STATUS_INTERVAL_MS = 1000;
const DESKTOP_AGENT_UPDATE_TIMEOUT_MS = 240_000;
const DESKTOP_AGENT_WAKE_ATTEMPTS = 3;
const DESKTOP_AGENT_WAKE_CHECK_TIMEOUT_MS = 8000;
const DESKTOP_AGENT_WAKE_RETRY_DELAY_MS = 1500;

type DesktopAgentPlatform = "windows" | "macos" | "unknown";

type DesktopAgentInstallPrompt = {
  attachment: Attachment;
  mode: "MASTER" | "READ_ONLY";
  fileName: string;
  platform: DesktopAgentPlatform;
  downloadUrl: string | null;
  localMasterSessionCount: number;
  localMasterSessionsNeedAttentionCount: number;
  agentState: "not_running" | "legacy" | "self_update_supported";
  agentNeedsUpdate: boolean;
  masterBlocker?:
    | "excel_missing"
    | "word_missing"
    | "powerpoint_missing"
    | "pdf_editor_missing";
  diagnosticMessage?: string;
  agentVersion?: string;
  launchFailureReason?: DesktopAgentSession["launchFailedReason"];
  launchFailureLastError?: string;
};

type DesktopAgentExcelDiagnostics = NonNullable<
  NonNullable<DesktopAgentStatus["health"]>["diagnostics"]
>["excel"];
type DesktopAgentWordDiagnostics = NonNullable<
  NonNullable<DesktopAgentStatus["health"]>["diagnostics"]
>["word"];
type DesktopAgentPowerPointDiagnostics = NonNullable<
  NonNullable<DesktopAgentStatus["health"]>["diagnostics"]
>["powerPoint"];
type DesktopAgentPdfEditorDiagnostics = NonNullable<
  NonNullable<DesktopAgentStatus["health"]>["diagnostics"]
>["pdfEditor"];

type DesktopAgentStatusTone = "slate" | "green" | "sky" | "amber";

type DesktopAgentDialogStatus = {
  label: string;
  nextStep: string;
  tone: DesktopAgentStatusTone;
};

type DesktopAgentDiagnosticRow = {
  label: string;
  value: string;
};

type WorkbenchSignoffStatusCopy = {
  preparedLabel: string;
  preparedTitle: string;
  removePreparedLabel?: string;
  reviewedLabel: string;
  reviewedTitle: string;
  removeReviewedLabel?: string;
  addPreparation?: string;
  addReview?: string;
  history?: string;
  historyTitle?: string;
  loadingHistory?: string;
  historyLoadFailed?: string;
  retry?: string;
  noSignoffs?: string;
  round?: string;
  signedAt?: string;
  fileVersion?: string;
  type?: string;
  signer?: string;
  status?: string;
  current?: string;
  completed?: string;
  pendingReview?: string;
  superseded?: string;
  revoked?: string;
  legacy?: string;
  revoke?: string;
  revokeTitle?: string;
  revocationReason?: string;
  cancel?: string;
  selfReviewTitle?: string;
  selfReviewDescription?: string;
  signReview?: string;
  reviewCooldownTitle?: string;
  reviewCooldownDescription?: string;
  revokeSuccess?: string;
  revokeDescription?: string;
  revokeFailed?: string;
};

type WorkbenchEmptySlotUploadCopy = {
  titlePrefix: string;
  description: string;
  descriptionWithTitle: string;
  cancel: string;
  upload?: string;
  chooseFile: string;
  uploadAriaLabelPrefix: string;
  fileInputAriaLabelPrefix: string;
  alreadyHasFileTitle: string;
  alreadyHasFileDescription: string;
};

type PaperToolPanelId = "history" | "projectFiles" | "signoff" | "questions";

export type WorkbenchPaperToolsCopy = {
  labels: {
    history: string;
    projectFiles: string;
    signoff: string;
    questions: string;
  };
  backToFiles: string;
  openFileTools: string;
  close: string;
};

export type WorkbenchReviewQuestionsCopy = {
  statusLabels: Record<WorkingPaperQuestion["status"], string>;
  projectRoleLabels: Record<ProjectRole, string>;
  dialogTitle: string;
  totalCount: string;
  unresolvedCount: string;
  newReviewNote: string;
  newButton: string;
  searchNotes?: string;
  searchMembers?: string;
  searchWorkpapers?: string;
  noSearchResults?: string;
  noteActions?: string;
  addToMessage?: string;
  noMatchingNotes?: string;
  listTitle: string;
  openTab: string;
  repliedTab: string;
  resolvedTab: string;
  emptyTitle: string;
  emptyDescription: string;
  createPlaceholder: string;
  removeAttachment: string;
  assignRespondent: string;
  adding: string;
  addReviewNote: string;
  workingPaper: string;
  reopenPlaceholder: string;
  followUpPlaceholder: string;
  messagePlaceholder: string;
  clear: string;
  markReplied: string;
  uploading: string;
  send: string;
  reopen: string;
  selectPrompt: string;
  clearConfirmTitle: string;
  clearConfirmDescription: string;
  clearConfirmLabel: string;
  cancel: string;
  back: string;
  close: string;
  createAttachmentUploadFailedToast: string;
  createAttachmentUploadFailed: string;
  attachmentLimit: string;
  attachmentTypeUnsupported: string;
  attachmentTooLarge: string;
  attachmentRemaining: string;
  imageUploadFailed: string;
  unassigned: string;
  unknown: string;
  currentUser: string;
  raisedBy: string;
  assignedTo: string;
  initiatorLabel: string;
  assigneeLabel: string;
  loadingImage: string;
  imageUnavailable: string;
  reviewNoteContent: string;
  attachImage: string;
  message: string;
  retry: string;
  draft: string;
  noMessagesYet: string;
  currentDiscussionOnly: string;
  noWorkpapersAvailable: string;
  sending: string;
  referenceWorkpaper: string;
  editor: ReviewNoteEditorCopy;
};

type DesktopAgentUpdateDialogCopy = {
  title: string;
  description: string;
  waitingForStart: string;
  releasingAndUpdating: string;
  startingUpdate: string;
  startingAgent: string;
  startAgent: string;
  startFailed: string;
  retryingMaster: string;
  retryMasterFailed: string;
  releaseAllAndUpdate: string;
  updateAgent: string;
  exit: string;
  installerUnavailable: string;
  downloadReadOnly: string;
  windowsInstallDescription: string;
  macosInstallDescription: string;
  genericInstallDescription: string;
  downloadWindows: string;
  downloadMacos: string;
  downloadGeneric: string;
  localMasterSessionNeedsAttention: string;
  localMasterSessionsNeedAttention: string;
  currentStatus: string;
  nextStep: string;
  diagnosticDetails: string;
  statusUpdateReady: string;
  statusInstallRequired: string;
  statusAgentStartRequired: string;
  statusActionRequired: string;
  statusUpdating: string;
  statusWaitingForAgent: string;
  nextStepReleaseAndUpdate: string;
  nextStepUpdate: string;
  nextStepInstall: string;
  nextStepStart: string;
  nextStepResolveLocks: string;
  nextStepFixOffice: string;
  nextStepWait: string;
  platformLabel: string;
  agentStateLabel: string;
  agentVersionLabel: string;
  selfUpdateLabel: string;
  localMasterLocksLabel: string;
  localMasterAttentionLabel: string;
  officeBlockerLabel: string;
  launchFailureLabel: string;
  lastErrorLabel: string;
  platformWindows: string;
  platformMacos: string;
  platformUnknown: string;
  agentStateNotRunning: string;
  agentStateLegacy: string;
  agentStateSelfUpdate: string;
  yes: string;
  no: string;
  unknown: string;
  closeWorkbooks: string;
  downloading: string;
  verifyingInstaller: string;
  stoppingAgent: string;
  repairingEnvironment: string;
  installing: string;
  startingAgentUpdate: string;
  verifyingHealth: string;
  restarting: string;
  ready: string;
  failed: string;
  fallbackFailed: string;
  updateTimedOut: string;
  agentUnavailable: string;
  selfUpdateUnavailable: string;
  hiddenAutomationExcel: string;
  excelComUnavailable: string;
  excelMissing: string;
  wordMissing: string;
  powerPointMissing: string;
  pdfEditorMissing: string;
};

export type WorkbenchPaperSectionCopy = {
  settingsPanel?: {
    desktopAgentManagement?: DesktopAgentSettingsPromptCopy & {
      ready?: string;
      readyHelp?: string;
    };
  };
  bucketLabels?: Record<WorkingPaperBucket, string>;
  bucketShortLabels?: Record<WorkingPaperBucket, string>;
  bucketDescriptions?: Record<WorkingPaperBucket, string>;
  fileCategoriesLabel?: string;
  collapsedBreadcrumbLabel?: string;
  noFilesInBucket?: string;
  filePreview?: WorkbenchFilePreviewCopy;
  templateLibrary?: WorkbenchTemplateLibraryCopy;
  projectFileIndex?: WorkbenchProjectFileIndexCopy;
  paperTools?: WorkbenchPaperToolsCopy;
  reviewQuestions?: WorkbenchReviewQuestionsCopy;
  desktopAgentUpdate?: DesktopAgentUpdateDialogCopy;
  zipMaster?: ZipMasterEditorCopy;
  smartForm?: SmartFormEditorCopy;
  smartFormV2Editor?: SmartFormEditorCopy;
};

export type WorkbenchFilePreviewCopy = {
  title: string;
  drawerTitle?: string;
  showLabel: string;
  hideLabel: string;
  resizeLabel: string;
  expandLabel: string;
  exitExpandedLabel: string;
  presentationLabel: string;
  openInNewWindow: string;
  emptyTitle: string;
  emptyDescription: string;
  unsupportedTitle: string;
  unsupportedDescription: string;
  download: string;
  pageIndicator: string;
  zoomOut: string;
  zoomIn: string;
  fitToWidth: string;
  loadingPreview: string;
  loadingArchive: string;
  previewFailedTitle?: string;
  retryPreview?: string;
  retryPage?: string;
  rowsLabel?: string;
  columnsLabel?: string;
  previousPage?: string;
  nextPage?: string;
  moveLeft?: string;
  moveRight?: string;
};

export type WorkbenchProjectFileIndexCopy = {
  mobileNavigation?: ReturnType<typeof getEmpMobileNavigationCopy>;
  title: string;
  activeSuffix: string;
  loading: string;
  headers: {
    refCode: string;
    title: string;
    actions: string;
    status: string;
    notes: string;
    signoffs: string;
    attributes: string;
    review: string;
  };
  selection?: {
    selectAll: string;
    selectRow: string;
    selectedRows: string;
    exitMultiSelect?: string;
    exportSelected?: string;
    resizeColumn: string;
    sortColumn: string;
  };
  columnVisibility?: {
    trigger: string;
    showAll: string;
  };
  columnMenu?: {
    clear: string;
    empty: string;
    filter: string;
    search: string;
  };
  noFile: string;
  openWorkpaper: string;
  openAsMaster: string;
  reviewButton: string;
  reviewApproved: string;
  reviewBlocked: string;
  smartFormComplete?: string;
  smartFormIncomplete?: string;
  emptyTray?: WorkbenchProjectFileEmptyTrayCopy;
  actionMenu?: WorkbenchProjectFileActionMenuCopy;
  relocation?: {
    copy: string;
    move: string;
    moveTo?: string;
    paste: string;
    copying: string;
    moving: string;
    chooseTarget: string;
    cancel: string;
    moveToDialog?: WorkbenchMoveToDialogCopy;
  };
  activity?: {
    locale?: ProjectLanguage;
    masterOpened: string;
    withinOneMinute: string;
    retryCheckIn: string;
    retryTracking: string;
    lockDetails?: {
      title: string;
      holder: string;
      startedAt: string;
      unknownHolder: string;
      unknownTime: string;
      ownedByYou: string;
      ownedByOther: string;
      close: string;
    };
  };
  resetHead?: WorkbenchResetHeadCopy;
};

type ResolvedWorkbenchProjectFileIndexCopy = Omit<
  WorkbenchProjectFileIndexCopy,
  | "selection"
  | "columnVisibility"
  | "columnMenu"
  | "emptyTray"
  | "actionMenu"
  | "relocation"
  | "activity"
  | "resetHead"
> & {
  selection: NonNullable<WorkbenchProjectFileIndexCopy["selection"]>;
  columnVisibility: NonNullable<
    WorkbenchProjectFileIndexCopy["columnVisibility"]
  >;
  columnMenu: NonNullable<WorkbenchProjectFileIndexCopy["columnMenu"]>;
  emptyTray: NonNullable<WorkbenchProjectFileIndexCopy["emptyTray"]>;
  actionMenu: NonNullable<WorkbenchProjectFileIndexCopy["actionMenu"]>;
  relocation: NonNullable<WorkbenchProjectFileIndexCopy["relocation"]>;
  activity: NonNullable<WorkbenchProjectFileIndexCopy["activity"]>;
  resetHead: NonNullable<WorkbenchProjectFileIndexCopy["resetHead"]>;
};

export type WorkbenchProjectFileEmptyTrayCopy = {
  currentTitle: string;
  priorTitle: string;
  temporaryTitle: string;
  currentDescription: string;
  priorDescription: string;
  temporaryDescription: string;
  uploadFiles: string;
  uploadFolder?: string;
  folderDescription?: string;
  unavailableDescription: string;
};

export type WorkbenchProjectFileActionMenuCopy = {
  preview: string;
  openMaster: string;
  recoverMasterSession: string;
  openReadOnly: string;
  openLocal?: string;
  download?: string;
  export?: string;
  exportTitle?: string;
  exportOriginal?: string;
  exportPdf?: string;
  exportZip?: string;
  exportSelected?: string;
  exporting?: string;
  exportSuccessTitle?: string;
  exportSuccessDescription?: string;
  exportFailedTitle?: string;
  multiSelect?: string;
  releaseMaster: string;
  changeRefcode: string;
  rename: string;
  resetHead: string;
  delete: string;
  triggerActionsFor: string;
  actionsFor: string;
  newRefcode: string;
  saveRefcode: string;
  fileDisplayName: string;
  saveName: string;
  backToActions: string;
  createPlaceholder?: string;
  createSmartForm?: string;
  createFromTemplate?: string;
  replacePlaceholder?: string;
  placeholderBadge?: string;
  placeholderDialogTitle?: string;
  placeholderDialogDescription?: string;
  placeholderCode?: string;
  placeholderName?: string;
  placeholderType?: string;
  placeholderCreate?: string;
  placeholderCancel?: string;
  placeholderCreated?: string;
  placeholderReplaced?: string;
  placeholderTypeMismatch?: string;
  placeholderCreateFailed?: string;
  placeholderReplaceFailed?: string;
  placeholderRequestFailed?: string;
  placeholderTypeLabels?: Partial<Record<AttachmentPlaceholderType, string>>;
};

export type WorkbenchResetHeadCopy = {
  title: string;
  description: string;
  versionHeader: string;
  modifierHeader: string;
  timeHeader: string;
  current: string;
  loadingVersions: string;
  loadFailed: string;
  empty: string;
  selectedImpact: string;
  selectPrompt: string;
  locked: string;
  reset: string;
  resetTo: string;
  versionHistory: string;
  versionsCount: string;
  currentHead: string;
  lockedBadge: string;
  availableBadge: string;
  historical: string;
  chooseForReset: string;
  versionsLabel: string;
  masterLockedForVersion: string;
  masterLocked: string;
  loadingFileHistory: string;
  fileHistoryLoadFailed: string;
  noVersions: string;
  conflictTitle: string;
  conflictDescription: string;
  conflictCandidate: string;
  conflictFrozenBadge: string;
  conflictResetBlocked: string;
  conflictDetectedAt: string;
  conflictCandidateHash: string;
  conflictViewOnly: string;
  conflictKeepServer: string;
  conflictUseCandidate: string;
  conflictRevertToBase: string;
  conflictConfirmTitle: string;
  conflictConfirmDescription: string;
  conflictCancel: string;
  conflictConfirm: string;
  conflictResolved: string;
  conflictLoadFailed: string;
};

const defaultResetHeadCopy: WorkbenchResetHeadCopy = {
  title: "Reset head",
  description:
    "Select one history entry. Reset only moves the Master head; newer history remains available until Master is changed again.",
  versionHeader: "Version",
  modifierHeader: "Modifier",
  timeHeader: "Time",
  current: "Current",
  loadingVersions: "Loading versions...",
  loadFailed: "Version history failed to load",
  empty: "No historical head candidates yet.",
  selectedImpact:
    "If Master is changed after this reset, versions after this point will be replaced by the new history line.",
  selectPrompt: "Select a history entry to reset.",
  locked: "Release Master before resetting the head.",
  reset: "Reset",
  resetTo: "Reset head to {version}",
  versionHistory: "Version history",
  versionsCount: "{count} versions",
  currentHead: "Current head",
  lockedBadge: "Locked",
  availableBadge: "Available",
  historical: "Historical",
  chooseForReset: "Choose {version} for reset head",
  versionsLabel: "Reset head versions",
  masterLockedForVersion: "Master locked for {version}",
  masterLocked: "Master locked",
  loadingFileHistory: "Loading file history...",
  fileHistoryLoadFailed: "File history failed to load",
  noVersions: "No versions recorded yet.",
  conflictTitle: "File version conflict detected",
  conflictDescription:
    "The server head and a desktop edit diverged. This file is frozen until the project PIC chooses the authoritative version.",
  conflictCandidate: "Conflict candidate",
  conflictFrozenBadge: "Conflict frozen",
  conflictResetBlocked: "Resolve the file conflict before resetting head",
  conflictDetectedAt: "Detected {time}",
  conflictCandidateHash: "SHA-256 {hash}",
  conflictViewOnly: "Only the project PIC can resolve this conflict.",
  conflictKeepServer: "Keep server version",
  conflictUseCandidate: "Use desktop candidate",
  conflictRevertToBase: "Revert to common parent",
  conflictConfirmTitle: "Confirm conflict resolution",
  conflictConfirmDescription:
    "{action} will become the authoritative head. Both versions remain in the audit history.",
  conflictCancel: "Cancel",
  conflictConfirm: "Confirm resolution",
  conflictResolved: "File conflict resolved",
  conflictLoadFailed: "Conflict details failed to load",
};
const defaultSignoffStatusCopy: WorkbenchSignoffStatusCopy = {
  preparedLabel: "Prepared",
  preparedTitle: "Preparation signed",
  removePreparedLabel: "Remove this preparation signoff",
  reviewedLabel: "Reviewed",
  reviewedTitle: "Review signed",
  removeReviewedLabel: "Remove this review signoff",
  addPreparation: "Add preparation signoff",
  addReview: "Add review signoff",
  history: "Signoff history",
  historyTitle: "Signoff history",
  loadingHistory: "Loading signoff history...",
  historyLoadFailed: "Could not load signoff history.",
  retry: "Retry",
  noSignoffs: "No signoffs recorded.",
  round: "Round",
  signedAt: "Signed at",
  fileVersion: "File version",
  type: "Type",
  signer: "Signer",
  status: "Status",
  current: "Current",
  completed: "Completed",
  pendingReview: "Pending review",
  superseded: "Superseded",
  revoked: "Revoked",
  legacy: "Legacy",
  revoke: "Revoke",
  revokeTitle: "Revoke signoff",
  revocationReason: "Reason is required",
  cancel: "Cancel",
  selfReviewTitle: "Self-review warning",
  selfReviewDescription:
    "You prepared the current round. You may sign the review, but it remains a File Check blocker until resolved.",
  signReview: "Sign review",
  reviewCooldownTitle: "Review unavailable",
  reviewCooldownDescription:
    "The same reviewer can sign this file again after 24 hours.",
  revokeSuccess: "Signoff revoked",
  revokeDescription: "The active round was recalculated.",
  revokeFailed: "Could not revoke signoff",
};
const defaultEmptySlotUploadCopy: WorkbenchEmptySlotUploadCopy = {
  titlePrefix: "Upload file to",
  description:
    "This empty workpaper slot will keep its RefCode and receive the selected file.",
  descriptionWithTitle:
    "This empty workpaper slot will keep its RefCode and receive the selected file:",
  cancel: "Cancel",
  upload: "Upload",
  chooseFile: "Choose file",
  uploadAriaLabelPrefix: "Upload a file to",
  fileInputAriaLabelPrefix: "Choose file for",
  alreadyHasFileTitle: "This slot already has a file",
  alreadyHasFileDescription: "Upload a new version from the file tools.",
};
const defaultProjectFileIndexCopy: ResolvedWorkbenchProjectFileIndexCopy = {
  title: "Project files",
  activeSuffix: "active",
  loading: "Loading project files...",
  headers: {
    refCode: "Ref",
    title: "File",
    actions: "Actions",
    status: "Status",
    notes: "Note",
    signoffs: "Sign-offs",
    attributes: "Attributes",
    review: "Review",
  },
  selection: {
    selectAll: "Select all project files",
    selectRow: "Select {name}",
    selectedRows: "{selected} of {total} row(s) selected.",
    exitMultiSelect: "Exit multi-select",
    exportSelected: "Export selected ({count})",
    resizeColumn: "Resize {name} column",
    sortColumn: "Sort {name} column",
  },
  columnVisibility: {
    trigger: "Columns",
    showAll: "Show all",
  },
  columnMenu: {
    clear: "Clear",
    empty: "No values found",
    filter: "Filter",
    search: "Search",
  },
  noFile: "No file",
  openWorkpaper: "Open {name} workpaper",
  openAsMaster: "Open {name} as Master",
  reviewButton: "Review",
  reviewApproved: "Review approved for {name}",
  reviewBlocked: "Review blocked - click for notes",
  smartFormComplete: "Complete",
  smartFormIncomplete: "Incomplete",
  emptyTray: {
    currentTitle: "Current workpapers",
    priorTitle: "Prior workpapers",
    temporaryTitle: "Temporary files",
    currentDescription: "Drag files here or upload current-period workpapers.",
    priorDescription: "Drag files here or upload prior-period workpapers.",
    temporaryDescription: "Drag supporting files here before filing them.",
    uploadFiles: "Upload files",
    uploadFolder: "Upload folder",
    folderDescription:
      "Select a folder. Its child folders will be added below this phase and their files will be listed inside them.",
    unavailableDescription:
      "This folder cannot accept direct uploads. Select a child workpaper folder to add files.",
  },
  actionMenu: {
    preview: "Preview",
    openMaster: "Open (Master)",
    recoverMasterSession: "Recover Master session",
    openReadOnly: "Open (Read Only)",
    openLocal: "Open locally",
    download: "Download",
    export: "Export",
    exportTitle: "Export file",
    exportOriginal: "Original format",
    exportPdf: "PDF",
    exportZip: "ZIP with folder path",
    exporting: "Exporting...",
    exportSuccessTitle: "File exported",
    exportSuccessDescription: "Exported {name}",
    exportFailedTitle: "Could not export file",
    releaseMaster: "Release Master",
    changeRefcode: "Change Refcode",
    rename: "Rename",
    resetHead: "Reset head",
    delete: "Delete",
    triggerActionsFor: "File actions for {name}",
    actionsFor: "Actions for {name}",
    newRefcode: "New refcode",
    saveRefcode: "Save refcode",
    fileDisplayName: "File display name",
    saveName: "Save name",
    backToActions: "Back to file actions",
    createPlaceholder: "New placeholder",
    createSmartForm: "New Smart Form",
    createFromTemplate: "New from template",
    replacePlaceholder: "Replace file",
    placeholderBadge: "Placeholder",
    placeholderDialogTitle: "New file placeholder",
    placeholderDialogDescription:
      "Reserve a reference code and location, then replace it with any file format.",
    placeholderCode: "Reference code",
    placeholderName: "Placeholder name",
    placeholderType: "File type",
    placeholderCreate: "Create placeholder",
    placeholderCancel: "Cancel",
    placeholderCreated: "Placeholder created",
    placeholderReplaced: "Placeholder replaced",
    placeholderTypeMismatch: "Choose a file matching the placeholder type.",
    placeholderCreateFailed: "Could not create placeholder",
    placeholderReplaceFailed: "Could not replace placeholder",
    placeholderRequestFailed: "Request failed",
    placeholderTypeLabels: {
      GENERIC: "Any format",
      WORD: "Word",
      SPREADSHEET: "Excel",
      PRESENTATION: "PowerPoint",
      PDF: "PDF",
      IMAGE: "Image",
      ZIP: "ZIP",
      TEXT: "Text",
    },
  },
  relocation: {
    copy: "Copy",
    move: "Cut",
    moveTo: "Move to",
    paste: "Paste",
    copying: "Copying {name}",
    moving: "Cutting {name}",
    chooseTarget: "Choose a destination folder on the left",
    cancel: "Cancel",
    moveToDialog: {
      heading: "Move to",
      instructions: "Choose a destination in the current project",
      searchPlaceholder: "Search folders or files",
      filesAreLocations:
        "Files are shown for orientation and cannot be destinations",
      targetLocation: "Destination",
      currentLocation: "Current location",
      noResults: "No matching folders or files",
      expandFolder: "Expand",
      collapseFolder: "Collapse",
      cancel: "Cancel",
      moveHere: "Move here",
      close: "Close",
    },
  },
  activity: {
    locale: "en-US",
    masterOpened: "{actor} opened Master {time}",
    withinOneMinute: "within 1 minute",
    retryCheckIn: "Check in local changes for {name}",
    retryTracking: "Retry desktop agent tracking for {name}",
  },
  resetHead: defaultResetHeadCopy,
};

function getDefaultProjectFileActivityCopy(): NonNullable<
  WorkbenchProjectFileIndexCopy["activity"]
> {
  return defaultProjectFileIndexCopy.activity;
}

function resolveProjectFileIndexCopy(
  copy: WorkbenchProjectFileIndexCopy = defaultProjectFileIndexCopy
): ResolvedWorkbenchProjectFileIndexCopy {
  return {
    ...defaultProjectFileIndexCopy,
    ...copy,
    headers: {
      ...defaultProjectFileIndexCopy.headers,
      ...copy.headers,
    },
    selection: {
      ...defaultProjectFileIndexCopy.selection,
      ...copy.selection,
    },
    columnVisibility: {
      ...defaultProjectFileIndexCopy.columnVisibility,
      ...copy.columnVisibility,
    },
    columnMenu: {
      ...defaultProjectFileIndexCopy.columnMenu,
      ...copy.columnMenu,
    },
    actionMenu: {
      ...defaultProjectFileIndexCopy.actionMenu,
      ...copy.actionMenu,
    },
    emptyTray: {
      ...defaultProjectFileIndexCopy.emptyTray,
      ...copy.emptyTray,
    },
    relocation: {
      ...defaultProjectFileIndexCopy.relocation,
      ...copy.relocation,
    },
    activity: {
      ...defaultProjectFileIndexCopy.activity,
      ...copy.activity,
    },
    resetHead: {
      ...defaultProjectFileIndexCopy.resetHead,
      ...copy.resetHead,
    },
  };
}

const defaultPaperToolsCopy: WorkbenchPaperToolsCopy = {
  labels: {
    history: "File status",
    projectFiles: "Project files",
    signoff: "Signoff and review",
    questions: "Review notes",
  },
  backToFiles: "Back to files",
  openFileTools: "Open file tools",
  close: "Close",
};
const defaultReviewQuestionsCopy: WorkbenchReviewQuestionsCopy = {
  statusLabels: {
    OPEN: "Open",
    REPLIED: "Replied",
    CLEARED: "Cleared",
  },
  projectRoleLabels: {
    PARTNER: "Partner",
    REVIEWER: "Reviewer",
    PREPARER: "Preparer",
    EQCR: "Engagement quality reviewer",
    TAX_REVIEWER: "Tax reviewer",
  },
  dialogTitle: "Notes / Review notes",
  totalCount: "{count} total",
  unresolvedCount: "{count} unresolved",
  newReviewNote: "New review note",
  newButton: "New",
  searchNotes: "Search notes",
  noteActions: "Note actions",
  addToMessage: "Add to message",
  noMatchingNotes: "No matching notes",
  listTitle: "Review notes",
  openTab: "Open",
  repliedTab: "Replied",
  resolvedTab: "Resolved",
  emptyTitle: "No review notes yet",
  emptyDescription: "Create one to start the conversation.",
  createPlaceholder: "Describe what needs to be supplemented",
  removeAttachment: "Remove {name}",
  assignRespondent: "Assign respondent",
  adding: "Adding...",
  addReviewNote: "Add review note",
  workingPaper: "Working paper",
  reopenPlaceholder: "Explain why this review note should be reopened...",
  followUpPlaceholder: "Add a follow-up...",
  messagePlaceholder: "Type a message...",
  clear: "Clear",
  markReplied: "Mark replied",
  uploading: "Uploading...",
  send: "Send",
  reopen: "Reopen",
  selectPrompt: "Select a question or create a new one",
  clearConfirmTitle: "Clear review note",
  clearConfirmDescription:
    "This will mark the selected review note as resolved. The conversation history will remain available.",
  clearConfirmLabel: "Clear",
  cancel: "Cancel",
  back: "Back",
  close: "Close",
  createAttachmentUploadFailedToast:
    "Review note created, but attachment upload failed",
  createAttachmentUploadFailed:
    "Review note was created, but attachment upload failed.",
  attachmentLimit: "Each message can include up to {count} attachments.",
  attachmentTypeUnsupported: "This attachment type is not supported.",
  attachmentTooLarge: "Attachment must be 25 MB or smaller.",
  attachmentRemaining:
    "Only {count} more attachment(s) can be added to this message.",
  imageUploadFailed: "Image upload failed.",
  unassigned: "Unassigned",
  unknown: "Unknown",
  currentUser: "Current user",
  raisedBy: "Raised by {name}",
  assignedTo: "Assigned to {name}",
  initiatorLabel: "Initiator: {name}",
  assigneeLabel: "Assignee: {name}",
  loadingImage: "Loading image",
  imageUnavailable: "Image unavailable",
  reviewNoteContent: "Review note content",
  attachImage: "Attach file",
  message: "Message",
  retry: "Retry",
  draft: "Draft",
  noMessagesYet: "No more messages",
  currentDiscussionOnly: "Only this review note's discussion is shown.",
  noWorkpapersAvailable: "No workpapers available",
  sending: "Sending...",
  referenceWorkpaper: "Reference workpaper",
  editor: {
    formattingToolbar: "Formatting toolbar",
    paragraph: "Paragraph",
    heading2: "Heading 2",
    heading3: "Heading 3",
    bold: "Bold",
    italic: "Italic",
    underline: "Underline",
    strikethrough: "Strikethrough",
    inlineCode: "Inline code",
    bulletList: "Bullet list",
    numberedList: "Numbered list",
    quote: "Quote",
    mention: "Mention",
    link: "Link",
    attachImage: "Attach file",
  },
};
const defaultDesktopAgentUpdateCopy: DesktopAgentUpdateDialogCopy = {
  title: "Install or update Desktop Agent",
  description:
    "Master editing needs Desktop Agent to open Office/PDF files, track when they close, upload new versions, and release Master safely.",
  waitingForStart: "Waiting for Desktop Agent to start...",
  releasingAndUpdating: "Releasing local Master locks and starting update...",
  startingUpdate: "Starting Desktop Agent update...",
  startingAgent: "Starting Desktop Agent...",
  startAgent: "Start Desktop Agent",
  startFailed:
    "Desktop Agent did not start after 3 attempts. It may be missing, blocked, or broken. Download and run the latest installer, then retry Master.",
  retryingMaster: "Desktop Agent is running. Retrying Master...",
  retryMasterFailed:
    "Desktop Agent started, but Master could not be opened. Please retry or download a read-only copy.",
  releaseAllAndUpdate: "Release all Master locks and update",
  updateAgent: "Update Desktop Agent",
  exit: "Exit",
  installerUnavailable: "Installer unavailable",
  downloadReadOnly: "Download read-only copy",
  windowsInstallDescription:
    "Windows was detected. Install the latest Desktop Agent, then retry Master.",
  macosInstallDescription:
    "macOS was detected. Install the latest Desktop Agent, then retry Master.",
  genericInstallDescription:
    "Install the latest Desktop Agent for your operating system, then retry Master.",
  downloadWindows: "Download Desktop Agent for Windows",
  downloadMacos: "Download Desktop Agent for macOS",
  downloadGeneric: "Download Desktop Agent",
  localMasterSessionNeedsAttention:
    "{count} local Master session needs attention. Check in, discard, or recover it before updating Desktop Agent.",
  localMasterSessionsNeedAttention:
    "{count} local Master sessions need attention. Check in, discard, or recover them before updating Desktop Agent.",
  currentStatus: "Current status",
  nextStep: "Next step",
  diagnosticDetails: "Diagnostic details",
  statusUpdateReady: "Update ready",
  statusInstallRequired: "Install required",
  statusAgentStartRequired: "Agent not running",
  statusActionRequired: "Action required",
  statusUpdating: "Updating",
  statusWaitingForAgent: "Waiting for agent",
  nextStepReleaseAndUpdate: "Release local Master locks, then update.",
  nextStepUpdate: "Update Desktop Agent, then Master will retry.",
  nextStepInstall: "Download and run the latest installer, then retry Master.",
  nextStepStart: "Start Desktop Agent, then Master will retry.",
  nextStepResolveLocks:
    "Check in, discard, or recover local Master sessions before updating.",
  nextStepFixOffice:
    "Install or repair the required desktop app, then retry Master.",
  nextStepWait:
    "Wait for Desktop Agent to finish; Master will retry automatically.",
  platformLabel: "Platform",
  agentStateLabel: "Agent state",
  agentVersionLabel: "Agent version",
  selfUpdateLabel: "Self-update",
  localMasterLocksLabel: "Releasable Master locks",
  localMasterAttentionLabel: "Locks needing attention",
  officeBlockerLabel: "Master blocker",
  launchFailureLabel: "Launch failure",
  lastErrorLabel: "Last error",
  platformWindows: "Windows",
  platformMacos: "macOS",
  platformUnknown: "Unknown",
  agentStateNotRunning: "Not running",
  agentStateLegacy: "Installed, manual update required",
  agentStateSelfUpdate: "Installed, self-update supported",
  yes: "Yes",
  no: "No",
  unknown: "Unknown",
  closeWorkbooks:
    "Close open Office files to continue the Desktop Agent update.",
  downloading: "Downloading Desktop Agent update...",
  verifyingInstaller: "Verifying Desktop Agent installer...",
  stoppingAgent: "Stopping the old Desktop Agent...",
  repairingEnvironment: "Repairing the Desktop Agent installation...",
  installing: "Installing Desktop Agent update...",
  startingAgentUpdate: "Starting the new Desktop Agent...",
  verifyingHealth: "Verifying the new Desktop Agent...",
  restarting: "Restarting Desktop Agent...",
  ready: "Desktop Agent update is ready.",
  failed: "Desktop Agent update failed.",
  fallbackFailed: "Could not start Desktop Agent update.",
  updateTimedOut:
    "Desktop Agent update timed out. Download and run the latest installer, then retry Master.",
  agentUnavailable:
    "Desktop Agent is not running. Start or install the latest Desktop Agent, then retry Master.",
  selfUpdateUnavailable:
    "This Desktop Agent is too old to update itself. Download and run the latest installer, then retry Master.",
  hiddenAutomationExcel:
    "Hidden Excel automation processes were detected ({count}). Close them from Task Manager or restart Windows before retrying Master.",
  excelComUnavailable:
    "Excel automation is degraded. Close hidden Excel processes or repair Office if Master still cannot open.",
  excelMissing:
    "Microsoft Excel was not detected. Install Microsoft 365 or Office, then retry Master. You can still download a read-only copy.",
  wordMissing:
    "Microsoft Word was not detected. Install Microsoft 365 or Office, then retry Master. You can still download a read-only copy.",
  powerPointMissing:
    "Microsoft PowerPoint was not detected. Install Microsoft 365 or Office, then retry Master. You can still download a read-only copy.",
  pdfEditorMissing:
    "A supported PDF editor was not detected. Install Adobe Acrobat, PDF-XChange Editor, Foxit PDF Editor, or PDF Master Editor, then retry Master. You can still download a read-only copy.",
};
const defaultFilePreviewCopy: WorkbenchFilePreviewCopy = {
  title: "File preview",
  drawerTitle: "Preview",
  showLabel: "Show file preview",
  hideLabel: "Hide file preview",
  resizeLabel: "Resize file preview panel",
  expandLabel: "Expand preview",
  exitExpandedLabel: "Collapse to sidebar",
  presentationLabel: "Presentation mode",
  openInNewWindow: "Open in new window",
  emptyTitle: "Select a workpaper to preview",
  emptyDescription:
    "PDF, Word, PPT, Excel and image files can be reviewed here.",
  unsupportedTitle: "This file type cannot be previewed online yet",
  unsupportedDescription:
    "Use the file actions menu to open it outside preview.",
  download: "Download",
  pageIndicator: "Page {page} of {count}",
  zoomOut: "Zoom out",
  zoomIn: "Zoom in",
  fitToWidth: "Fit to width",
  loadingPreview: "Loading preview...",
  loadingArchive: "Loading archive...",
  previewFailedTitle: "Preview could not be loaded",
  retryPreview: "Retry",
  retryPage: "Retry page {page}",
  rowsLabel: "rows",
  columnsLabel: "columns",
  previousPage: "Previous page",
  nextPage: "Next page",
  moveLeft: "Move left",
  moveRight: "Move right",
};
const defaultPaperSectionCopy: WorkbenchPaperSectionCopy = {
  bucketLabels: defaultBucketLabels,
  bucketShortLabels: defaultBucketShortLabels,
  bucketDescriptions: defaultBucketDescriptions,
  fileCategoriesLabel: "File categories",
  collapsedBreadcrumbLabel: "Show hidden path",
  noFilesInBucket: "No files in {bucket}",
  filePreview: defaultFilePreviewCopy,
  templateLibrary: defaultTemplateLibraryCopy,
  projectFileIndex: defaultProjectFileIndexCopy,
  paperTools: defaultPaperToolsCopy,
  reviewQuestions: defaultReviewQuestionsCopy,
  desktopAgentUpdate: defaultDesktopAgentUpdateCopy,
  zipMaster: defaultZipMasterEditorCopy,
};

export type WorkbenchFileActionRequest = {
  requestId: number;
  attachmentId: string;
  action: "MASTER" | "DOWNLOAD";
};

export function WorkbenchPaperSection({
  projectId,
  projectName = "Project",
  projectLanguage,
  copy = defaultPaperSectionCopy,
  currentUserId,
  currentProjectRole,
  selectedNode,
  selectedPath = EMPTY_DEFAULT_ARRAY,
  onSelectPathNode,
  selectedPathScrollRef,
  workflow,
  selectedPaperId,
  setSelectedPaperId,
  onPreviewFile,
  onExportAttachments,
  fileActionRequest,
  highlightedPaperId,
  highlightedPaperIds = EMPTY_DEFAULT_ARRAY,
  activeBucket,
  onActiveBucketChange,
  uploadFileToWorkingPaper,
  uploadFilesToNode,
  createPlaceholderToNode,
  onCreateSmartForm,
  onCreateFromTemplate,
  placeholderDefaultCode = "",
  uploadFilePending = false,
  attachmentClipboard,
  onSetAttachmentClipboard,
  onPasteAttachmentClipboard,
  onMoveAttachmentsToNode,
  readOnly = false,
  showTemporaryFiles = true,
  disableFileMutations = false,
  forceReadOnlyOpen = false,
  canSignPreparer = true,
  signoffStatusCopy = defaultSignoffStatusCopy,
  emptySlotUploadCopy = defaultEmptySlotUploadCopy,
  onClearHighlightedPaper,
  onOpenReviewNotes,
  onSmartFormOpenChange,
}: {
  projectId: string;
  projectName?: string;
  projectLanguage?: ProjectLanguage;
  copy?: WorkbenchPaperSectionCopy;
  currentUserId?: string | null;
  currentProjectRole?: ProjectRole | null;
  selectedNode: WorkflowNode;
  selectedPath?: WorkbenchBreadcrumbSegment[];
  onSelectPathNode?: (nodeId: string) => void;
  selectedPathScrollRef?: RefObject<HTMLDivElement | null>;
  workflow: WorkflowNode[];
  selectedPaperId: string | null;
  setSelectedPaperId: (paperId: string | null) => void;
  onPreviewFile?: (attachmentId: string) => void;
  onExportAttachments?: (attachmentIds: string[]) => void;
  fileActionRequest?: WorkbenchFileActionRequest | null;
  highlightedPaperId?: string | null;
  highlightedPaperIds?: string[];
  activeBucket: WorkingPaperBucket;
  onActiveBucketChange: (bucket: WorkingPaperBucket) => void;
  uploadFileToWorkingPaper?: (paperId: string, file: File) => void;
  uploadFilesToNode?: (
    files: File[],
    bucket: WorkingPaperBucket
  ) => Promise<Attachment[] | undefined> | Attachment[] | undefined;
  createPlaceholderToNode?: (
    code: string,
    name: string,
    bucket: WorkingPaperBucket
  ) => Promise<Attachment>;
  onCreateSmartForm?: () => void;
  onCreateFromTemplate?: () => void;
  placeholderDefaultCode?: string;
  uploadFilePending?: boolean;
  attachmentClipboard?: DirectoryFileClipboard | null;
  onSetAttachmentClipboard?: (clipboard: DirectoryFileClipboard) => void;
  onPasteAttachmentClipboard?: (targetNode: WorkflowNode) => void;
  onMoveAttachmentsToNode?: (
    files: DirectoryFileTransfer[],
    targetNode: WorkflowNode
  ) => void;
  readOnly?: boolean;
  showTemporaryFiles?: boolean;
  disableFileMutations?: boolean;
  forceReadOnlyOpen?: boolean;
  canSignPreparer?: boolean;
  signoffStatusCopy?: WorkbenchSignoffStatusCopy;
  emptySlotUploadCopy?: WorkbenchEmptySlotUploadCopy;
  onClearHighlightedPaper?: () => void;
  onOpenReviewNotes?: (target: WorkbenchReviewNotesTarget) => void;
  onSmartFormOpenChange?: (open: boolean) => void;
}) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [desktopAgentInstallPrompt, setDesktopAgentInstallPrompt] =
    useState<DesktopAgentInstallPrompt | null>(null);
  const [zipArchivePanel, setZipArchivePanel] =
    useState<ZipArchivePanelState | null>(null);
  const [zipArchiveBusy, setZipArchiveBusy] = useState(false);
  const [smartFormPanel, setSmartFormPanel] =
    useState<SmartFormPanelState | null>(null);
  const smartFormOpen = smartFormPanel !== null;
  const [smartFormReviewRequest, setSmartFormReviewRequest] = useState<{
    key: number;
    target: SmartFormV2ReviewTarget;
    questionId?: string;
  } | null>(null);
  const [smartFormBusy, setSmartFormBusy] = useState(false);

  useEffect(() => {
    onSmartFormOpenChange?.(smartFormOpen);
  }, [onSmartFormOpenChange, smartFormOpen]);
  useEffect(
    () => () => {
      onSmartFormOpenChange?.(false);
    },
    [onSmartFormOpenChange]
  );
  const [placeholderDialogOpen, setPlaceholderDialogOpen] = useState(false);
  const [placeholderCode, setPlaceholderCode] = useState("");
  const [placeholderName, setPlaceholderName] = useState("");
  const [placeholderBusy, setPlaceholderBusy] = useState(false);
  const [replacementTarget, setReplacementTarget] =
    useState<ProjectAttachment | null>(null);
  const replacementInputRef = useRef<HTMLInputElement | null>(null);
  const desktopAgentUpdateCopy =
    copy.desktopAgentUpdate ?? defaultDesktopAgentUpdateCopy;
  const zipMasterCopy = copy.zipMaster ?? defaultZipMasterEditorCopy;
  const smartFormCopy = {
    ...defaultSmartFormEditorCopy,
    ...copy.smartForm,
    ...copy.smartFormV2Editor,
  };
  const fileMutationDisabled = readOnly || disableFileMutations;

  useEffect(() => {
    if (showTemporaryFiles || activeBucket !== "TEMPORARY") {
      return;
    }
    onActiveBucketChange("CURRENT");
  }, [activeBucket, onActiveBucketChange, showTemporaryFiles]);

  const papers = selectedNode.workingPapers ?? EMPTY_WORKING_PAPERS;
  const paperDetail = useQuery({
    queryKey: ["workingPaper", projectId, selectedPaperId],
    queryFn: () => api.workingPaper(projectId, selectedPaperId ?? ""),
    enabled: Boolean(selectedPaperId),
  });
  const projectAttachments = useQuery({
    queryKey: ["project-attachments", projectId],
    queryFn: () => api.projectAttachments(projectId),
    enabled: Boolean(projectId),
  });
  const desktopAgentStatus = useQuery({
    queryKey: ["desktop-agent-status"],
    queryFn: () => getDesktopAgentStatus(),
    enabled: Boolean(projectId),
    meta: { suppressGlobalErrorToast: true },
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });
  const desktopAgentSessions = useQuery({
    queryKey: ["desktop-agent-sessions"],
    queryFn: () => listDesktopAgentSessions(),
    enabled: Boolean(projectId),
    meta: { suppressGlobalErrorToast: true },
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
  });
  const trackedDesktopAgentSessions =
    desktopAgentSessions.data ?? EMPTY_DESKTOP_AGENT_SESSIONS;
  const desktopAgentProjectSessionSignature = useMemo(
    () =>
      getDesktopAgentProjectSessionSignature(
        trackedDesktopAgentSessions,
        projectId
      ),
    [projectId, trackedDesktopAgentSessions]
  );
  const lastDesktopAgentProjectSessionSignature = useRef<string | null>(null);
  const autoCheckInInFlightKeys = useRef(new Set<string>());
  const autoCheckInAttemptedKeys = useRef(new Set<string>());
  const autoCheckInRetryTimeouts = useRef(new Map<string, number>());
  const zipArchiveClosePollTimeouts = useRef(new Map<string, number>());
  const refreshZipMasterPanel = useCallback(
    async (session: ZipMasterSessionResponse) => {
      const refreshed = await api.openZipMaster(
        projectId,
        session.attachmentId
      );
      if (!refreshed.ok) {
        return;
      }
      setZipArchivePanel((current) =>
        current?.mode === "MASTER" &&
        current.session.sessionId === session.sessionId
          ? { mode: "MASTER", session: refreshed }
          : current
      );
    },
    [projectId]
  );
  useEffect(
    () => () => {
      for (const timeout of autoCheckInRetryTimeouts.current.values()) {
        window.clearTimeout(timeout);
      }
      autoCheckInRetryTimeouts.current.clear();
      for (const timeout of zipArchiveClosePollTimeouts.current.values()) {
        window.clearTimeout(timeout);
      }
      zipArchiveClosePollTimeouts.current.clear();
    },
    []
  );
  useEffect(() => {
    if (!desktopAgentSessions.data) {
      return;
    }
    const previous = lastDesktopAgentProjectSessionSignature.current;
    lastDesktopAgentProjectSessionSignature.current =
      desktopAgentProjectSessionSignature;
    if (previous === null || previous === desktopAgentProjectSessionSignature) {
      return;
    }
    void queryClient.invalidateQueries({
      queryKey: ["project-attachments", projectId],
    });
    if (
      zipArchivePanel?.mode === "MASTER" &&
      shouldRefreshZipMasterPanelForDesktopAgentChange({
        session: zipArchivePanel.session,
        previousSignature: previous,
        nextSignature: desktopAgentProjectSessionSignature,
      })
    ) {
      void refreshZipMasterPanel(zipArchivePanel.session);
    }
  }, [
    desktopAgentProjectSessionSignature,
    desktopAgentSessions.data,
    projectId,
    queryClient,
    refreshZipMasterPanel,
    zipArchivePanel,
  ]);
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    if (zipArchivePanel?.mode !== "MASTER") {
      return;
    }
    if (!hasMasterZipEntries(zipArchivePanel.session.entries)) {
      return;
    }

    const refreshVisibleZipMasterStatus = () => {
      if (document.visibilityState === "hidden") {
        return;
      }
      void queryClient.invalidateQueries({
        queryKey: ["desktop-agent-sessions"],
      });
      void refreshZipMasterPanel(zipArchivePanel.session);
    };

    window.addEventListener("focus", refreshVisibleZipMasterStatus);
    document.addEventListener(
      "visibilitychange",
      refreshVisibleZipMasterStatus
    );
    return () => {
      window.removeEventListener("focus", refreshVisibleZipMasterStatus);
      document.removeEventListener(
        "visibilitychange",
        refreshVisibleZipMasterStatus
      );
    };
  }, [queryClient, refreshZipMasterPanel, zipArchivePanel]);
  const projectAttachmentById = useMemo(
    () =>
      new Map(
        (projectAttachments.data ?? []).map((attachment) => [
          attachment.id,
          attachment,
        ])
      ),
    [projectAttachments.data]
  );
  const scopedProjectAttachments = useMemo(
    () =>
      filterProjectAttachmentsForNode(
        projectAttachments.data ?? [],
        selectedNode
      ),
    [projectAttachments.data, selectedNode]
  );
  const restoreTargetPapers = useMemo(
    () => collectWorkflowPapers(workflow),
    [workflow]
  );
  const smartFormWorkingPaperOptions = useMemo(
    () => collectSmartFormWorkingPaperOptions(workflow),
    [workflow]
  );
  const selectedPaper = useMemo(
    () =>
      paperDetail.data ??
      papers.find((paper) => paper.id === selectedPaperId) ??
      null,
    [paperDetail.data, papers, selectedPaperId]
  );
  const activeSmartFormAttachment = smartFormPanel
    ? smartFormPanel.mode === "MASTER"
      ? smartFormPanel.session.attachment
      : smartFormPanel.form.attachment
    : null;
  const filecheckAttachmentOpenedRef = useRef<string | null>(null);
  const smartFormPreviewOpenedRef = useRef<string | null>(null);
  const smartFormReviewQuestions = useMemo(() => {
    if (!activeSmartFormAttachment) {
      return [];
    }
    const candidates = [
      ...(selectedPaper?.reviewQuestions ?? []),
      ...(activeSmartFormAttachment.reviewQuestions ?? []),
    ];
    return [
      ...new Map(
        candidates.map((question) => [question.id, question])
      ).values(),
    ].filter(
      (question) => question.attachmentId === activeSmartFormAttachment.id
    );
  }, [activeSmartFormAttachment, selectedPaper?.reviewQuestions]);
  const mergeSmartFormReviewQuestion = useCallback(
    (question: WorkingPaperQuestion) => {
      setSmartFormPanel((current) => {
        if (!current) {
          return current;
        }
        const attachment =
          current.mode === "MASTER"
            ? current.session.attachment
            : current.form.attachment;
        if (attachment.id !== question.attachmentId) {
          return current;
        }
        const nextAttachment = {
          ...attachment,
          reviewQuestions: [
            question,
            ...(attachment.reviewQuestions ?? []).filter(
              (candidate) => candidate.id !== question.id
            ),
          ],
        };
        return current.mode === "MASTER"
          ? {
              ...current,
              session: { ...current.session, attachment: nextAttachment },
            }
          : {
              ...current,
              form: { ...current.form, attachment: nextAttachment },
            };
      });
    },
    []
  );
  const requestSmartFormReview = useCallback(
    (target: SmartFormV2ReviewTarget, questionId?: string) => {
      setSmartFormReviewRequest((current) => ({
        key: (current?.key ?? 0) + 1,
        target,
        questionId,
      }));
    },
    []
  );
  const resetSmartFormReviewState = useCallback(() => {
    setSmartFormReviewRequest(null);
    smartFormPreviewOpenedRef.current = null;
  }, []);
  const clearSmartFormPreviewUrl = useCallback((attachmentId: string) => {
    if (typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    if (
      url.searchParams.get("smartFormPreview") !== "1" ||
      url.searchParams.get("attachmentId") !== attachmentId
    ) {
      return;
    }
    [
      "smartFormPreview",
      "smartFormNodeId",
      "smartFormRowId",
      "smartFormTargetLabel",
      "attachmentId",
      "reviewQuestionId",
      "focus",
    ].forEach((key) => url.searchParams.delete(key));
    window.history.replaceState({}, "", url.pathname + url.search);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, []);
  const closeSmartFormReadOnly = useCallback(() => {
    const attachmentId = activeSmartFormAttachment?.id;
    setSmartFormPanel(null);
    resetSmartFormReviewState();
    if (attachmentId) {
      clearSmartFormPreviewUrl(attachmentId);
    }
  }, [
    activeSmartFormAttachment?.id,
    clearSmartFormPreviewUrl,
    resetSmartFormReviewState,
  ]);
  const smartFormReviewQuestionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const question of smartFormReviewQuestions) {
      if (!question.smartFormNodeId) {
        continue;
      }
      const key = `${question.smartFormNodeId}\0${question.smartFormRowId ?? ""}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [smartFormReviewQuestions]);
  const smartFormReviewQuestionsConfig = useMemo(
    () =>
      activeSmartFormAttachment
        ? {
            buttonLabel:
              smartFormCopy.reviewQuestionButtonLabel ??
              defaultSmartFormEditorCopy.reviewQuestionButtonLabel ??
              "Review questions",
            getQuestionCount: (target: SmartFormV2ReviewTarget) =>
              smartFormReviewQuestionCounts.get(
                `${target.nodeId}\0${target.rowId ?? ""}`
              ) ?? 0,
            onOpen: requestSmartFormReview,
          }
        : undefined,
    [
      activeSmartFormAttachment,
      requestSmartFormReview,
      smartFormCopy.reviewQuestionButtonLabel,
      smartFormReviewQuestionCounts,
    ]
  );
  useEffect(() => {
    if (searchParams.get("smartFormPreview") !== "1") {
      return;
    }
    const attachmentId = searchParams.get("attachmentId");
    const nodeId = searchParams.get("smartFormNodeId");
    const rowId = searchParams.get("smartFormRowId");
    if (!attachmentId || !nodeId) {
      return;
    }
    const target: SmartFormV2ReviewTarget = {
      nodeId,
      ...(rowId ? { rowId } : {}),
      label: searchParams.get("smartFormTargetLabel") ?? rowId ?? nodeId,
    };
    const questionId = searchParams.get("reviewQuestionId") ?? undefined;
    const previewKey = `${attachmentId}:${nodeId}:${target.rowId ?? ""}:${questionId ?? ""}`;
    if (
      smartFormPreviewOpenedRef.current === previewKey &&
      (activeSmartFormAttachment?.id === attachmentId ||
        smartFormPanel?.mode === "MASTER")
    ) {
      return;
    }
    if (smartFormPanel?.mode === "MASTER") {
      smartFormPreviewOpenedRef.current = previewKey;
      if (activeSmartFormAttachment?.id === attachmentId) {
        requestSmartFormReview(target, questionId);
      } else {
        toast({
          title:
            smartFormCopy.reviewMasterConflictTitle ??
            defaultSmartFormEditorCopy.reviewMasterConflictTitle ??
            "Cannot open review questions while Master is active",
          description:
            smartFormCopy.reviewMasterConflictDescription ??
            defaultSmartFormEditorCopy.reviewMasterConflictDescription,
        });
      }
      return;
    }
    if (
      smartFormPanel?.mode === "READ_ONLY" &&
      activeSmartFormAttachment?.id === attachmentId
    ) {
      smartFormPreviewOpenedRef.current = previewKey;
      requestSmartFormReview(target, questionId);
      return;
    }
    if (!selectedPaper) {
      return;
    }
    const attachment = selectedPaper.attachments?.find(
      (candidate) => candidate.id === attachmentId
    );
    if (!attachment || !isSmartFormAttachment(attachment)) {
      return;
    }
    smartFormPreviewOpenedRef.current = previewKey;
    requestSmartFormReview(target, questionId);
    let canceled = false;
    setSmartFormBusy(true);
    void api
      .readSmartForm(projectId, attachmentId)
      .then((form) => {
        if (!canceled) {
          setSmartFormPanel({ mode: "READ_ONLY", form });
        }
      })
      .catch((error) => {
        if (!canceled) {
          showErrorToast(error, "SmartForm could not be loaded");
        }
      })
      .finally(() => {
        if (!canceled) {
          setSmartFormBusy(false);
        }
      });
    return () => {
      canceled = true;
    };
  }, [
    activeSmartFormAttachment?.id,
    projectId,
    requestSmartFormReview,
    searchParams,
    selectedPaper,
    smartFormPanel?.mode,
    smartFormCopy.reviewMasterConflictDescription,
    smartFormCopy.reviewMasterConflictTitle,
    toast,
  ]);

  const refreshPaper = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["work-items"] }),
      queryClient.invalidateQueries({
        queryKey: ["workingPaper", projectId, selectedPaperId],
      }),
      queryClient.invalidateQueries({ queryKey: ["workflow", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["auditLogs", projectId] }),
      queryClient.invalidateQueries({
        queryKey: ["deleted-attachments", projectId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["project-attachments", projectId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["desktop-agent-sessions"],
      }),
      queryClient.invalidateQueries({ queryKey: ["desktop-agent-status"] }),
    ]);
  };
  const refreshAttachmentHistory = async (attachmentId: string) => {
    await queryClient.invalidateQueries({
      queryKey: ["attachment-history", projectId, attachmentId],
    });
  };
  const showDesktopAgentInstallPrompt = async (
    attachment: Attachment,
    mode: DesktopAgentInstallPrompt["mode"] = "MASTER",
    diagnosticMessage?: string | null,
    masterBlocker?: DesktopAgentInstallPrompt["masterBlocker"] | null
  ) => {
    const agentStatus =
      desktopAgentStatus.data ??
      (await getDesktopAgentStatus().catch(() => null));
    const currentSessions =
      (await listDesktopAgentSessions().catch(
        () => trackedDesktopAgentSessions
      )) ?? trackedDesktopAgentSessions;
    const localMasterSessions = currentSessions.filter(
      (session) => session.mode === "MASTER"
    );
    setDesktopAgentInstallPrompt(
      createDesktopAgentInstallPrompt(
        attachment,
        mode,
        localMasterSessions.filter(isLocalMasterSessionSafeForSelfUpdate)
          .length,
        localMasterSessions.filter(
          isLocalMasterSessionAttentionNeededBeforeUpdate
        ).length,
        getDesktopAgentPromptState(agentStatus),
        diagnosticMessage ??
          getDesktopAgentDiagnosticMessage(
            agentStatus,
            desktopAgentUpdateCopy,
            attachment.originalName ?? attachment.fileName
          ),
        mode === "MASTER"
          ? (masterBlocker ??
              getDesktopAgentMasterBlocker(
                agentStatus,
                attachment.originalName ?? attachment.fileName
              ))
          : null,
        agentStatus,
        localMasterSessions
      )
    );
  };
  const openWithDesktopAgentWake = async (
    input: Parameters<typeof openAttachmentInDesktopAgent>[0]
  ) => {
    const firstAttempt = await openAttachmentInDesktopAgent(input).catch(
      (error) => {
        if (isDesktopAgentSetupError(error)) {
          return null;
        }
        throw error;
      }
    );
    if (
      firstAttempt ||
      input.mode === "MASTER" ||
      detectDesktopAgentPlatform() === "unknown"
    ) {
      return firstAttempt;
    }
    openDesktopAgentStartProtocol();
    return null;
  };
  const deleteAttachment = useMutation({
    mutationFn: (attachmentId: string) =>
      api.deleteAttachment(projectId, attachmentId),
    onSuccess: refreshPaper,
  });
  const restoreAttachment = useMutation({
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
    onSuccess: refreshPaper,
  });
  const updateWorkingPaper = useMutation({
    mutationFn: ({
      paperId,
      code,
      title,
    }: {
      paperId: string;
      code?: string;
      title?: string;
    }) => api.updateWorkingPaper(projectId, paperId, { code, title }),
    onSuccess: refreshPaper,
  });
  const updateAttachmentIdentity = useMutation({
    mutationFn: ({
      attachmentId,
      code,
      title,
    }: {
      attachmentId: string;
      code?: string;
      title?: string;
    }) =>
      api.updateAttachmentIdentity(projectId, attachmentId, { code, title }),
    onSuccess: refreshPaper,
  });
  const renameAttachment = useMutation({
    mutationFn: ({
      attachmentId,
      originalName,
    }: {
      attachmentId: string;
      originalName: string;
    }) => api.renameAttachment(projectId, attachmentId, { originalName }),
    onSuccess: refreshPaper,
  });
  const restoreAttachmentVersion = useMutation({
    mutationFn: ({
      attachmentId,
      versionId,
    }: {
      attachmentId: string;
      versionId: string;
    }) => api.restoreAttachmentVersion(projectId, attachmentId, versionId),
    onSuccess: async (_attachment, { attachmentId }) => {
      await refreshAttachmentHistory(attachmentId);
      await refreshPaper();
    },
  });
  const updateZipMasterSession = async (
    action: () => Promise<ZipMasterSessionResponse>
  ) => {
    setZipArchiveBusy(true);
    try {
      const session = await action();
      setZipArchivePanel((current) =>
        current?.mode === "MASTER" &&
        current.session.sessionId === session.sessionId
          ? { mode: "MASTER", session }
          : current
      );
    } catch (error) {
      showErrorToast(error, "Could not update archive");
    } finally {
      setZipArchiveBusy(false);
    }
  };
  const addZipMasterOperation = (
    sessionId: string,
    operation: ZipMasterTextOperationInput
  ) =>
    updateZipMasterSession(() =>
      api.addZipMasterOperation(projectId, sessionId, operation)
    );
  const addZipMasterFileOperation = (
    sessionId: string,
    operation: ZipMasterFileOperationInput,
    file: File
  ) =>
    updateZipMasterSession(() =>
      api.addZipMasterOperation(projectId, sessionId, operation, file)
    );
  const reflectPendingZipMasterClose = (response: ZipMasterCloseResponse) => {
    setZipArchivePanel((current) =>
      current?.mode === "MASTER" &&
      current.session.sessionId === response.sessionId
        ? {
            mode: "MASTER",
            session: {
              ...current.session,
              state: response.waitingForEntries
                ? "CLOSING_WAITING_ENTRIES"
                : "CHECKING_IN",
              activeEntryMasters: response.activeEntryMasters ?? [],
              entries: syncZipEntryMasterStatuses(
                current.session.entries,
                response.activeEntryMasters ?? []
              ),
            },
          }
        : current
    );
  };
  function scheduleZipMasterClosePoll(sessionId: string) {
    if (typeof window === "undefined") {
      return;
    }
    const existing = zipArchiveClosePollTimeouts.current.get(sessionId);
    if (existing) {
      window.clearTimeout(existing);
    }
    const timeout = window.setTimeout(async () => {
      try {
        const response = await api.closeZipMaster(projectId, sessionId);
        if (response.waitingForEntries || response.queued) {
          reflectPendingZipMasterClose(response);
          scheduleZipMasterClosePoll(sessionId);
          await refreshPaper();
          return;
        }
        zipArchiveClosePollTimeouts.current.delete(sessionId);
        setZipArchivePanel((current) =>
          current?.mode === "MASTER" && current.session.sessionId === sessionId
            ? null
            : current
        );
        await refreshPaper();
      } catch (error) {
        zipArchiveClosePollTimeouts.current.delete(sessionId);
        showErrorToast(error, "Could not close archive session");
      }
    }, 1500);
    zipArchiveClosePollTimeouts.current.set(sessionId, timeout);
  }
  const closeZipMasterSession = async (sessionId: string) => {
    setZipArchiveBusy(true);
    try {
      const response = await api.closeZipMaster(projectId, sessionId);
      if (response.waitingForEntries || response.queued) {
        reflectPendingZipMasterClose(response);
        scheduleZipMasterClosePoll(sessionId);
      } else {
        setZipArchivePanel(null);
      }
      await refreshPaper();
    } catch (error) {
      showErrorToast(error, "Could not close archive session");
    } finally {
      setZipArchiveBusy(false);
    }
  };
  const discardZipMasterSession = async (sessionId: string) => {
    setZipArchivePanel(null);
    setZipArchiveBusy(true);
    try {
      await api.discardZipMaster(projectId, sessionId);
      await refreshPaper();
    } catch (error) {
      showErrorToast(error, "Could not discard archive session");
    } finally {
      setZipArchiveBusy(false);
    }
  };
  const openZipEntryReadOnly = async (
    attachmentId: string,
    entryPath: string,
    sessionId?: string
  ) => {
    const fileName = getZipEntryFileName(entryPath);
    setZipArchiveBusy(true);
    try {
      const openedInAgent = await openAttachmentInDesktopAgent({
        mode: "READ_ONLY",
        projectId,
        attachmentId,
        fileName,
        downloadUrl: sessionId
          ? getZipSessionEntryDownloadPath(projectId, sessionId, entryPath)
          : getZipEntryReadOnlyDownloadPath(projectId, attachmentId, entryPath),
      }).catch(() => null);
      if (openedInAgent) {
        return;
      }
      const blob = sessionId
        ? await api.downloadZipSessionEntry(projectId, sessionId, entryPath)
        : await api.downloadZipEntryReadOnly(
            projectId,
            attachmentId,
            entryPath
          );
      downloadBlob(blob, fileName);
      toast({
        title: "Downloaded a read-only copy",
        description:
          "Install Desktop Agent to open files directly from Project Wing.",
      });
    } catch (error) {
      showErrorToast(error, "Could not open archive entry");
    } finally {
      setZipArchiveBusy(false);
    }
  };
  const openZipEntryMaster = async (
    session: ZipMasterSessionResponse,
    entryPath: string
  ) => {
    setZipArchiveBusy(true);
    let entrySession: ZipEntryMasterOpenResponse | null = null;
    try {
      const agentStatus =
        desktopAgentStatus.data ?? (await getDesktopAgentStatus());
      if (!agentStatus.isSupported) {
        showErrorToast(
          new Error(zipMasterCopy.desktopAgentRequired),
          zipMasterCopy.desktopAgentRequired
        );
        return;
      }
      entrySession = await api.openZipEntryMaster(
        projectId,
        session.sessionId,
        entryPath
      );
      const openedInAgent = await openAttachmentInDesktopAgent({
        mode: "MASTER",
        projectId,
        attachmentId: entrySession.attachmentId,
        fileName: entrySession.fileName,
        downloadUrl: entrySession.downloadUrl,
        heartbeatUrl: entrySession.heartbeatUrl,
        checkInUrl: entrySession.checkInUrl,
        releaseUrl: entrySession.releaseUrl,
        lockSessionId: entrySession.lockSessionId,
        baseVersion: entrySession.baseVersion,
        cacheVersionId: entrySession.cacheVersionId,
        cacheOwnerId: entrySession.cacheOwnerId,
        fileSize: entrySession.fileSize,
        mimeType: entrySession.mimeType,
        contentHash: entrySession.contentHash,
        directUploadSupported: entrySession.directUploadSupported,
        grantSecret: entrySession.grantSecret,
        contentToken: entrySession.contentToken,
      });
      if (!openedInAgent) {
        await releaseZipEntryMasterGrant(entrySession).catch(() => {});
        showErrorToast(
          new Error(zipMasterCopy.desktopAgentRequired),
          zipMasterCopy.desktopAgentRequired
        );
        return;
      }
      entrySession = null;
      await refreshZipMasterPanel(session);
      await queryClient.invalidateQueries({
        queryKey: ["desktop-agent-sessions"],
      });
    } catch (error) {
      if (entrySession) {
        await releaseZipEntryMasterGrant(entrySession).catch(() => {});
      }
      showErrorToast(error, "Could not open archive entry");
    } finally {
      setZipArchiveBusy(false);
    }
  };
  const updateSmartFormSession = async (
    action: () => Promise<SmartFormSessionResponse>
  ) => {
    setSmartFormBusy(true);
    try {
      const session = await action();
      setSmartFormPanel((current) =>
        current?.mode === "MASTER" &&
        current.session.attachment.id === session.attachment.id
          ? { mode: "MASTER", session }
          : current
      );
    } catch (error) {
      showErrorToast(error, "SmartForm could not be saved");
      throw error;
    } finally {
      setSmartFormBusy(false);
    }
  };
  const saveSmartFormSession = (
    session: SmartFormSessionResponse,
    nextPackage: SmartFormSessionResponse["package"]
  ) =>
    updateSmartFormSession(() =>
      api.saveSmartForm(projectId, session.attachment.id, {
        lockSessionId: session.lockSessionId,
        package: nextPackage,
      })
    );
  const closeSmartFormSession = async (
    session: SmartFormSessionResponse,
    nextPackage: SmartFormSessionResponse["package"]
  ) => {
    setSmartFormBusy(true);
    try {
      await api.closeSmartForm(projectId, session.attachment.id, {
        lockSessionId: session.lockSessionId,
        package: nextPackage,
      });
      setSmartFormPanel(null);
      resetSmartFormReviewState();
      clearSmartFormPreviewUrl(session.attachment.id);
      await refreshPaper();
    } catch (error) {
      showErrorToast(error, "SmartForm could not be saved");
    } finally {
      setSmartFormBusy(false);
    }
  };
  const discardSmartFormSession = async (session: SmartFormSessionResponse) => {
    setSmartFormBusy(true);
    try {
      await api.discardSmartForm(projectId, session.attachment.id, {
        lockSessionId: session.lockSessionId,
      });
      setSmartFormPanel(null);
      resetSmartFormReviewState();
      clearSmartFormPreviewUrl(session.attachment.id);
      await refreshPaper();
    } catch (error) {
      showErrorToast(error, "SmartForm could not be saved");
    } finally {
      setSmartFormBusy(false);
    }
  };
  const downloadAttachment = useMutation({
    mutationFn: async (attachment: Attachment) => {
      if (isSmartFormAttachment(attachment)) {
        const opened = await api.openSmartForm(projectId, attachment.id);
        resetSmartFormReviewState();
        setSmartFormPanel({ mode: "MASTER", session: opened });
        return;
      }
      if (isZipAttachment(attachment)) {
        const opened = await api.openZipMaster(projectId, attachment.id);
        if (!opened.ok) {
          throw new Error(
            formatWorkbenchCopy(zipMasterCopy.lockedBy, {
              holder: opened.holderName || zipMasterCopy.lockedHolderFallback,
            })
          );
        }
        setZipArchivePanel({ mode: "MASTER", session: opened });
        return;
      }
      assertDesktopAgentOpenSupportedAttachment(attachment, "MASTER");
      const fileName = getAttachmentExternalFileName(attachment);
      let openedInAgent: Awaited<
        ReturnType<typeof openAttachmentInDesktopAgent>
      >;
      try {
        openedInAgent = await openWithDesktopAgentWake({
          mode: "MASTER",
          projectId,
          attachmentId: attachment.id,
          fileName,
        });
      } catch (error) {
        const masterBlocker = getDesktopAgentMasterBlockerFromOpenError(error);
        if (!masterBlocker) {
          throw error;
        }
        await showDesktopAgentInstallPrompt(
          attachment,
          "MASTER",
          getDesktopAgentOfficeBlockerMessage(
            masterBlocker,
            desktopAgentUpdateCopy
          ),
          masterBlocker
        );
        return;
      }
      if (!openedInAgent) {
        await showDesktopAgentInstallPrompt(attachment, "MASTER");
      }
    },
    onSuccess: refreshPaper,
  });
  const retryAttachmentOpen = async (
    attachment: Attachment,
    mode: DesktopAgentInstallPrompt["mode"]
  ) => {
    let openedInAgent: Awaited<ReturnType<typeof openAttachmentInDesktopAgent>>;
    try {
      openedInAgent = await openAttachmentInDesktopAgent({
        mode,
        projectId,
        attachmentId: attachment.id,
        fileName: getAttachmentExternalFileName(attachment),
        ...(mode === "READ_ONLY"
          ? {
              baseVersion: attachment.version,
              baseVersionId: attachment.headVersionId ?? undefined,
              cacheVersionId:
                attachment.headVersionId ??
                `${attachment.id}:v${attachment.version}`,
              fileSize: attachment.fileSize,
              contentHash: attachment.contentHash ?? undefined,
              contentToken:
                attachment.contentHash ??
                attachment.headVersionId ??
                `${attachment.id}:v${attachment.version}`,
            }
          : {}),
      });
    } catch (error) {
      if (
        error instanceof DesktopAgentClientError &&
        error.code === "DESKTOP_AGENT_REQUEST_TIMEOUT"
      ) {
        throw new Error(desktopAgentUpdateCopy.retryMasterFailed, {
          cause: error,
        });
      }
      throw error;
    }
    if (!openedInAgent) {
      throw new Error(desktopAgentUpdateCopy.retryMasterFailed);
    }
    await refreshPaper();
  };
  const downloadAttachmentReadOnly = useMutation({
    mutationFn: async (attachment: Attachment) => {
      if (isSmartFormAttachment(attachment)) {
        const form = await api.readSmartForm(projectId, attachment.id);
        resetSmartFormReviewState();
        setSmartFormPanel({ mode: "READ_ONLY", form });
        return;
      }
      if (isZipAttachment(attachment)) {
        const archive = await api.readZip(projectId, attachment.id);
        setZipArchivePanel({ mode: "READ_ONLY", archive });
        return;
      }
      assertDesktopAgentOpenSupportedAttachment(attachment, "READ_ONLY");
      const openedInAgent = await openWithDesktopAgentWake({
        mode: "READ_ONLY",
        projectId,
        attachmentId: attachment.id,
        fileName: getAttachmentExternalFileName(attachment),
        baseVersion: attachment.version,
        baseVersionId: attachment.headVersionId ?? undefined,
        cacheVersionId:
          attachment.headVersionId ?? `${attachment.id}:v${attachment.version}`,
        fileSize: attachment.fileSize,
        contentHash: attachment.contentHash ?? undefined,
        contentToken:
          attachment.contentHash ??
          attachment.headVersionId ??
          `${attachment.id}:v${attachment.version}`,
      }).catch(() => null);
      if (openedInAgent) {
        return;
      }
      await showDesktopAgentInstallPrompt(attachment, "READ_ONLY");
    },
    onSuccess: refreshPaper,
  });
  const openAttachmentLocally = useMutation({
    mutationFn: async (attachment: Attachment) => {
      const openedInAgent = await openAttachmentInDesktopAgent({
        mode: "READ_ONLY",
        projectId,
        attachmentId: attachment.id,
        fileName: getAttachmentExternalFileName(attachment),
        baseVersion: attachment.version,
        baseVersionId: attachment.headVersionId ?? undefined,
        cacheVersionId:
          attachment.headVersionId ?? `${attachment.id}:v${attachment.version}`,
        fileSize: attachment.fileSize,
        contentHash: attachment.contentHash ?? undefined,
        contentToken:
          attachment.contentHash ??
          attachment.headVersionId ??
          `${attachment.id}:v${attachment.version}`,
      }).catch(() => null);
      if (openedInAgent) {
        return;
      }
      await downloadReadOnlyAttachmentCopy(projectId, attachment);
    },
  });
  const downloadAttachmentCopy = useMutation({
    mutationFn: async (attachment: Attachment) => {
      await downloadReadOnlyAttachmentCopy(projectId, attachment);
      const fileName = getAttachmentDownloadFileName(attachment);
      toast({
        title: "Downloaded file",
        description: fileName,
      });
    },
  });
  const handledFileActionRequestRef = useRef<number | null>(null);
  useEffect(() => {
    if (
      !fileActionRequest ||
      handledFileActionRequestRef.current === fileActionRequest.requestId
    ) {
      return;
    }
    const attachment = selectedNode.workingPapers
      ?.flatMap((paper) => paper.attachments ?? [])
      .find((item) => item.id === fileActionRequest.attachmentId);
    if (!attachment) {
      return;
    }

    handledFileActionRequestRef.current = fileActionRequest.requestId;
    if (fileActionRequest.action === "MASTER") {
      downloadAttachment.mutate(attachment);
    } else {
      downloadAttachmentCopy.mutate(attachment);
    }
  }, [
    downloadAttachment,
    downloadAttachmentCopy,
    fileActionRequest,
    selectedNode,
  ]);
  useEffect(() => {
    if (searchParams?.get("focus") !== "attachment") {
      return;
    }
    const attachmentId = searchParams.get("attachmentId");
    if (
      !attachmentId ||
      filecheckAttachmentOpenedRef.current === attachmentId
    ) {
      return;
    }
    const attachment = selectedPaper?.attachments?.find(
      (item) => item.id === attachmentId
    );
    if (!attachment) {
      return;
    }
    if (
      isSpreadsheetAttachment(attachment) &&
      searchParams.get("cellAddress")
    ) {
      return;
    }
    filecheckAttachmentOpenedRef.current = attachmentId;
    downloadAttachmentReadOnly.mutate(attachment);
  }, [downloadAttachmentReadOnly, searchParams, selectedPaper]);
  const checkInDesktopSession = useMutation({
    mutationFn: async ({
      session,
      attachment,
    }: {
      session: DesktopAgentSession;
      attachment: ProjectAttachment;
    }) => {
      const checkedInSession = await checkInDesktopAgentSession({
        sessionId: session.sessionId,
        lockSessionId: session.lockSessionId,
        projectId,
        attachmentId: attachment.id,
        checkInUrl: session.checkInUrl,
        releaseUrl: session.releaseUrl,
      });
      if (!checkedInSession) {
        throw new Error(DESKTOP_AGENT_UNAVAILABLE_MESSAGE);
      }
      return checkedInSession;
    },
    onSuccess: refreshPaper,
  });
  const releaseDesktopSession = useMutation({
    mutationFn: async ({
      session,
      attachment,
    }: {
      session: DesktopAgentSession;
      attachment: ProjectAttachment;
    }) => {
      const releasedSession = await releaseDesktopAgentSession({
        sessionId: session.sessionId,
        lockSessionId: session.lockSessionId,
        projectId,
        attachmentId: attachment.id,
        releaseUrl: session.releaseUrl,
      });
      if (!releasedSession) {
        throw new Error(DESKTOP_AGENT_UNAVAILABLE_MESSAGE);
      }
      return releasedSession;
    },
    onSuccess: refreshPaper,
  });
  useEffect(() => {
    const attemptAutoCheckIn = (
      session: DesktopAgentSession,
      attachment: ProjectAttachment,
      autoCheckInKey: string
    ) => {
      autoCheckInInFlightKeys.current.add(autoCheckInKey);
      checkInDesktopSession.mutate(
        { session, attachment },
        {
          onSettled: (_data, error) => {
            autoCheckInAttemptedKeys.current.add(autoCheckInKey);
            if (
              error instanceof Error &&
              error.message === DESKTOP_AGENT_UNAVAILABLE_MESSAGE &&
              !autoCheckInRetryTimeouts.current.has(autoCheckInKey)
            ) {
              const timeout = window.setTimeout(() => {
                autoCheckInRetryTimeouts.current.delete(autoCheckInKey);
                autoCheckInAttemptedKeys.current.delete(autoCheckInKey);
                attemptAutoCheckIn(session, attachment, autoCheckInKey);
                void desktopAgentSessions.refetch();
              }, 5000);
              autoCheckInRetryTimeouts.current.set(autoCheckInKey, timeout);
            }
            autoCheckInInFlightKeys.current.delete(autoCheckInKey);
          },
        }
      );
    };

    for (const session of trackedDesktopAgentSessions) {
      if (!isDesktopAgentAutoRetryStatus(session.status)) {
        continue;
      }
      if (!hasDesktopMasterGrant(session)) {
        continue;
      }

      const attachment = projectAttachmentById.get(session.attachmentId);
      if (!attachment) {
        continue;
      }

      const autoCheckInKey = [
        session.sessionId,
        session.status,
        session.lastKnownHash,
        session.retryCount ?? 0,
        session.lastUploadAttemptAt ?? "",
        session.lastReleaseAttemptAt ?? "",
        session.lastCleanupAttemptAt ?? "",
      ].join(":");
      if (
        autoCheckInInFlightKeys.current.has(autoCheckInKey) ||
        autoCheckInAttemptedKeys.current.has(autoCheckInKey)
      ) {
        continue;
      }

      attemptAutoCheckIn(session, attachment, autoCheckInKey);
    }
  }, [
    checkInDesktopSession,
    desktopAgentSessions,
    projectAttachmentById,
    trackedDesktopAgentSessions,
  ]);
  const prepare = useMutation({
    mutationFn: (paperId: string) =>
      api.prepareWorkingPaper(projectId, paperId),
    onSuccess: refreshPaper,
  });
  const showReviewSignoffError = (error: unknown) => {
    if (
      error instanceof ApiError &&
      error.code === "REVIEW_SIGNOFF_COOLDOWN_ACTIVE"
    ) {
      toast({
        title: signoffStatusCopy.reviewCooldownTitle ?? "Review unavailable",
        description:
          signoffStatusCopy.reviewCooldownDescription ??
          "The same reviewer can sign this file again after 24 hours.",
        variant: "destructive",
      });
      return;
    }
    showErrorToast(error, "Could not sign review");
  };
  const review = useMutation({
    mutationFn: (paperId: string) => api.reviewWorkingPaper(projectId, paperId),
    onSuccess: refreshPaper,
    onError: showReviewSignoffError,
  });
  const prepareAttachment = useMutation({
    mutationFn: (attachmentId: string) =>
      api.prepareAttachment(projectId, attachmentId),
    onSuccess: refreshPaper,
  });
  const removeSignoff = useMutation({
    mutationFn: (signoffId: string) =>
      api.removeWorkingPaperSignoff(projectId, signoffId),
    onSuccess: refreshPaper,
  });
  const reviewAttachment = useMutation({
    mutationFn: (attachmentId: string) =>
      api.reviewAttachment(projectId, attachmentId),
    onSuccess: refreshPaper,
    onError: showReviewSignoffError,
  });
  const pending =
    uploadFilePending ||
    deleteAttachment.isPending ||
    restoreAttachment.isPending ||
    updateWorkingPaper.isPending ||
    updateAttachmentIdentity.isPending ||
    renameAttachment.isPending ||
    restoreAttachmentVersion.isPending ||
    downloadAttachment.isPending ||
    downloadAttachmentReadOnly.isPending ||
    openAttachmentLocally.isPending ||
    downloadAttachmentCopy.isPending ||
    zipArchiveBusy ||
    smartFormBusy ||
    checkInDesktopSession.isPending ||
    releaseDesktopSession.isPending ||
    prepare.isPending ||
    review.isPending ||
    prepareAttachment.isPending ||
    reviewAttachment.isPending ||
    removeSignoff.isPending;
  const placeholderCopy = resolveProjectFileIndexCopy(
    copy.projectFileIndex
  ).actionMenu;
  const openPlaceholderDialog = () => {
    setPlaceholderCode(placeholderDefaultCode);
    setPlaceholderName("");
    setPlaceholderDialogOpen(true);
  };
  const submitPlaceholder = async () => {
    if (
      !createPlaceholderToNode ||
      !placeholderCode.trim() ||
      !placeholderName.trim()
    ) {
      return;
    }
    setPlaceholderBusy(true);
    try {
      await createPlaceholderToNode(
        placeholderCode.trim(),
        placeholderName.trim(),
        activeBucket
      );
      setPlaceholderDialogOpen(false);
      setPlaceholderCode("");
      setPlaceholderName("");
    } catch (error) {
      showErrorToast(
        error,
        placeholderCopy.placeholderCreateFailed ??
          "Could not create placeholder"
      );
    } finally {
      setPlaceholderBusy(false);
    }
  };
  const requestPlaceholderReplacement = (attachment: ProjectAttachment) => {
    if (!attachment.placeholderType) {
      return;
    }
    setReplacementTarget(attachment);
    window.requestAnimationFrame(() => replacementInputRef.current?.click());
  };
  const replacePlaceholder = async (file: File) => {
    const target = replacementTarget;
    if (!target?.placeholderType) {
      return;
    }
    if (
      target.placeholderType !== "GENERIC" &&
      getAttachmentPlaceholderTypeForFile(file.name, file.type) !==
        target.placeholderType
    ) {
      toast({
        title:
          placeholderCopy.placeholderTypeMismatch ??
          "Choose a file matching the placeholder type.",
        description:
          ATTACHMENT_PLACEHOLDER_TYPES[target.placeholderType].accept,
        variant: "destructive",
      });
      return;
    }
    setPlaceholderBusy(true);
    try {
      const attachment = await api.replaceAttachmentPlaceholder(
        projectId,
        target.id,
        file
      );
      seedUploadedAttachmentPreview(queryClient, projectId, attachment, file);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workflow", projectId] }),
        queryClient.invalidateQueries({
          queryKey: ["project-attachments", projectId],
        }),
      ]);
      toast({
        title: placeholderCopy.placeholderReplaced ?? "Placeholder replaced",
        description: target.originalName ?? target.fileName,
        variant: "success",
      });
      setReplacementTarget(null);
    } catch (error) {
      showErrorToast(
        error,
        placeholderCopy.placeholderReplaceFailed ??
          "Could not replace placeholder"
      );
    } finally {
      setPlaceholderBusy(false);
    }
  };

  if (selectedPaperId && !selectedPaper && paperDetail.isLoading) {
    return <EmptyState title="Opening file" description="Please wait." />;
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-4">
      {smartFormPanel ? (
        <div className="animate-workbench-surface-enter min-h-0 flex-1 overflow-hidden bg-background">
          {smartFormPanel.mode === "MASTER" ? (
            <SmartFormEditor
              key={smartFormPanel.session.attachment.id}
              mode="MASTER"
              locale={
                smartFormPanel.session.package.template.language ??
                projectLanguage ??
                "zh-CN"
              }
              fileName={getAttachmentDisplayName(
                smartFormPanel.session.attachment
              )}
              package={smartFormPanel.session.package}
              copy={smartFormCopy}
              workingPaperOptions={smartFormWorkingPaperOptions}
              reviewQuestions={smartFormReviewQuestionsConfig}
              focusTarget={smartFormReviewRequest?.target}
              busy={smartFormBusy}
              onSave={(nextPackage) =>
                saveSmartFormSession(smartFormPanel.session, nextPackage)
              }
              onClose={(nextPackage) =>
                closeSmartFormSession(smartFormPanel.session, nextPackage)
              }
              onDiscard={() => discardSmartFormSession(smartFormPanel.session)}
            />
          ) : (
            <SmartFormEditor
              key={smartFormPanel.form.attachment.id}
              mode="READ_ONLY"
              locale={
                smartFormPanel.form.package.template.language ??
                projectLanguage ??
                "zh-CN"
              }
              fileName={getAttachmentDisplayName(
                smartFormPanel.form.attachment
              )}
              package={smartFormPanel.form.package}
              copy={smartFormCopy}
              workingPaperOptions={smartFormWorkingPaperOptions}
              reviewQuestions={smartFormReviewQuestionsConfig}
              focusTarget={smartFormReviewRequest?.target}
              busy={smartFormBusy}
              readOnlyCloseLabel={
                (copy.paperTools ?? defaultPaperToolsCopy).close
              }
              onReadOnlyClose={closeSmartFormReadOnly}
            />
          )}
          {activeSmartFormAttachment && smartFormReviewRequest ? (
            <SmartFormReviewQuestionsController
              key={`${activeSmartFormAttachment.id}:${smartFormReviewRequest.key}`}
              projectId={projectId}
              attachmentId={activeSmartFormAttachment.id}
              fileName={getAttachmentDisplayName(activeSmartFormAttachment)}
              target={smartFormReviewRequest.target}
              initialQuestionId={smartFormReviewRequest.questionId}
              questions={smartFormReviewQuestions}
              workflow={workflow}
              paper={selectedPaper}
              currentUserId={currentUserId ?? null}
              currentProjectRole={currentProjectRole ?? null}
              readOnly={readOnly}
              copy={copy.reviewQuestions ?? defaultReviewQuestionsCopy}
              onChanged={refreshPaper}
              onQuestionChanged={mergeSmartFormReviewQuestion}
            />
          ) : null}
        </div>
      ) : selectedPaper ? (
        <WorkingPaperDetail
          projectName={projectName}
          projectLanguage={projectLanguage}
          copy={copy}
          paper={selectedPaper}
          currentUserId={currentUserId ?? null}
          currentProjectRole={currentProjectRole ?? null}
          deleteAttachment={(attachmentId) => {
            if (!fileMutationDisabled) {
              deleteAttachment.mutate(attachmentId);
            }
          }}
          restoreAttachment={(attachmentId, workingPaperId) => {
            if (!fileMutationDisabled) {
              restoreAttachment.mutate({ attachmentId, workingPaperId });
            }
          }}
          downloadAttachment={(attachment) =>
            downloadAttachment.mutate(attachment)
          }
          downloadAttachmentReadOnly={(attachment) =>
            downloadAttachmentReadOnly.mutate(attachment)
          }
          openAttachmentLocally={(attachment) =>
            openAttachmentLocally.mutate(attachment)
          }
          downloadAttachmentCopy={(attachment) =>
            downloadAttachmentCopy.mutate(attachment)
          }
          checkInDesktopSession={(session, attachment) =>
            checkInDesktopSession.mutate({ session, attachment })
          }
          releaseDesktopSession={(session, attachment) =>
            releaseDesktopSession.mutate({ session, attachment })
          }
          projectAttachments={projectAttachments.data ?? []}
          projectAttachmentsLoading={projectAttachments.isLoading}
          desktopAgentSessions={trackedDesktopAgentSessions}
          restoreTargetPapers={restoreTargetPapers}
          updateAttachmentIdentity={(attachmentId, code) => {
            if (!fileMutationDisabled) {
              updateAttachmentIdentity.mutate({ attachmentId, code });
            }
          }}
          renameAttachment={(attachmentId, originalName) => {
            if (!fileMutationDisabled) {
              renameAttachment.mutate({ attachmentId, originalName });
            }
          }}
          onSetAttachmentClipboard={
            fileMutationDisabled ? undefined : onSetAttachmentClipboard
          }
          onMoveAttachmentsToNode={
            fileMutationDisabled ? undefined : onMoveAttachmentsToNode
          }
          restoreAttachmentVersion={(attachmentId, versionId) => {
            if (!fileMutationDisabled) {
              restoreAttachmentVersion.mutate({ attachmentId, versionId });
            }
          }}
          prepare={() => {
            if (!readOnly && canSignPreparer) {
              prepare.mutate(selectedPaper.id);
            }
          }}
          review={() => {
            if (!readOnly) {
              review.mutate(selectedPaper.id);
            }
          }}
          prepareWorkingPaper={(paperId) => {
            if (!readOnly && canSignPreparer) {
              prepare.mutate(paperId);
            }
          }}
          reviewWorkingPaper={(paperId) => {
            if (!readOnly) {
              review.mutate(paperId);
            }
          }}
          prepareAttachment={(attachmentId) => {
            if (!readOnly && canSignPreparer) {
              prepareAttachment.mutate(attachmentId);
            }
          }}
          removePreparationSignoff={(signoffId) => {
            if (!readOnly) {
              removeSignoff.mutate(signoffId);
            }
          }}
          reviewAttachment={(attachmentId) => {
            if (!readOnly) {
              reviewAttachment.mutate(attachmentId);
            }
          }}
          pending={pending || readOnly}
          readOnly={readOnly}
          onBackToFolder={() => setSelectedPaperId(null)}
          projectId={projectId}
          workflow={workflow}
          onPaperChanged={refreshPaper}
          signoffStatusCopy={signoffStatusCopy}
          disableFileMutations={disableFileMutations}
          forceReadOnlyOpen={forceReadOnlyOpen}
          canSignPreparer={canSignPreparer}
        />
      ) : (
        <FolderFileArea
          projectId={projectId}
          projectName={projectName}
          projectLanguage={projectLanguage}
          copy={copy}
          node={selectedNode}
          selectedPath={selectedPath}
          onSelectPathNode={onSelectPathNode}
          selectedPathScrollRef={selectedPathScrollRef}
          projectAttachments={scopedProjectAttachments}
          projectAttachmentsLoading={projectAttachments.isLoading}
          desktopAgentSessions={trackedDesktopAgentSessions}
          currentUserId={currentUserId ?? null}
          currentProjectRole={currentProjectRole ?? null}
          activeBucket={activeBucket}
          onActiveBucketChange={onActiveBucketChange}
          readOnly={readOnly}
          showTemporaryFiles={showTemporaryFiles}
          disableFileMutations={disableFileMutations}
          forceReadOnlyOpen={forceReadOnlyOpen}
          canSignPreparer={canSignPreparer}
          uploadFileToWorkingPaper={
            readOnly ? undefined : uploadFileToWorkingPaper
          }
          uploadFilesToNode={readOnly ? undefined : uploadFilesToNode}
          onCreatePlaceholder={
            !readOnly && createPlaceholderToNode
              ? openPlaceholderDialog
              : undefined
          }
          onCreateSmartForm={readOnly ? undefined : onCreateSmartForm}
          onCreateFromTemplate={readOnly ? undefined : onCreateFromTemplate}
          onReplacePlaceholder={
            !readOnly && createPlaceholderToNode
              ? requestPlaceholderReplacement
              : undefined
          }
          uploadFilePending={uploadFilePending}
          downloadAttachment={(attachment) =>
            downloadAttachment.mutate(attachment)
          }
          downloadAttachmentReadOnly={(attachment) =>
            downloadAttachmentReadOnly.mutate(attachment)
          }
          openAttachmentLocally={(attachment) =>
            openAttachmentLocally.mutate(attachment)
          }
          downloadAttachmentCopy={(attachment) =>
            downloadAttachmentCopy.mutate(attachment)
          }
          checkInDesktopSession={(session, attachment) =>
            checkInDesktopSession.mutate({ session, attachment })
          }
          releaseDesktopSession={(session, attachment) =>
            releaseDesktopSession.mutate({ session, attachment })
          }
          deleteAttachment={(attachmentId) => {
            if (!fileMutationDisabled) {
              deleteAttachment.mutate(attachmentId);
            }
          }}
          restoreTargetPapers={restoreTargetPapers}
          updateAttachmentIdentity={(attachmentId, code) => {
            if (!fileMutationDisabled) {
              updateAttachmentIdentity.mutate({ attachmentId, code });
            }
          }}
          renameAttachment={(attachmentId, originalName) => {
            if (!fileMutationDisabled) {
              renameAttachment.mutate({ attachmentId, originalName });
            }
          }}
          onSetAttachmentClipboard={
            fileMutationDisabled ? undefined : onSetAttachmentClipboard
          }
          attachmentClipboard={
            fileMutationDisabled ? null : attachmentClipboard
          }
          onPasteAttachmentClipboard={
            fileMutationDisabled ? undefined : onPasteAttachmentClipboard
          }
          onMoveAttachmentsToNode={
            fileMutationDisabled ? undefined : onMoveAttachmentsToNode
          }
          restoreAttachmentVersion={(attachmentId, versionId) => {
            if (!fileMutationDisabled) {
              restoreAttachmentVersion.mutate({ attachmentId, versionId });
            }
          }}
          prepareWorkingPaper={(paperId) => {
            if (!readOnly && canSignPreparer) {
              prepare.mutate(paperId);
            }
          }}
          reviewWorkingPaper={(paperId) => {
            if (!readOnly) {
              review.mutate(paperId);
            }
          }}
          prepareAttachment={(attachmentId) => {
            if (!readOnly && canSignPreparer) {
              prepareAttachment.mutate(attachmentId);
            }
          }}
          removePreparationSignoff={(signoffId) => {
            if (!readOnly) {
              removeSignoff.mutate(signoffId);
            }
          }}
          reviewAttachment={(attachmentId) => {
            if (!readOnly) {
              reviewAttachment.mutate(attachmentId);
            }
          }}
          pending={pending || readOnly}
          onReviewQuestionsChanged={refreshPaper}
          workflow={workflow}
          signoffStatusCopy={signoffStatusCopy}
          emptySlotUploadCopy={emptySlotUploadCopy}
          openWorkingPaper={setSelectedPaperId}
          onPreviewFile={onPreviewFile}
          onExportAttachments={onExportAttachments}
          highlightedPaperId={highlightedPaperId}
          highlightedPaperIds={highlightedPaperIds}
          onClearHighlightedPaper={onClearHighlightedPaper}
          onOpenReviewNotes={onOpenReviewNotes}
        />
      )}
      <Dialog
        open={Boolean(zipArchivePanel)}
        onOpenChange={(open) => {
          if (open || zipArchivePanel?.mode !== "READ_ONLY") {
            return;
          }
          setZipArchivePanel(null);
        }}
      >
        <DialogContent
          className="h-[min(760px,calc(100vh-2rem))] max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 sm:max-w-6xl"
          showCloseButton={zipArchivePanel?.mode === "READ_ONLY"}
          closeLabel={(copy.paperTools ?? defaultPaperToolsCopy).close}
        >
          {zipArchivePanel ? (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>
                  {zipArchivePanel.mode === "MASTER"
                    ? zipArchivePanel.session.fileName
                    : zipArchivePanel.archive.fileName}
                </DialogTitle>
              </DialogHeader>
              {zipArchivePanel.mode === "MASTER" ? (
                <ZipMasterEditor
                  session={zipArchivePanel.session}
                  copy={zipMasterCopy}
                  busy={zipArchiveBusy}
                  onAddFile={(entryPath, file) =>
                    addZipMasterFileOperation(
                      zipArchivePanel.session.sessionId,
                      { type: "ADD_FILE", entryPath },
                      file
                    )
                  }
                  onReplaceFile={(entryPath, file) =>
                    addZipMasterFileOperation(
                      zipArchivePanel.session.sessionId,
                      { type: "REPLACE_FILE", entryPath },
                      file
                    )
                  }
                  onCreateFolder={(entryPath) =>
                    addZipMasterOperation(zipArchivePanel.session.sessionId, {
                      type: "CREATE_FOLDER",
                      entryPath,
                    })
                  }
                  onDeleteEntry={(entryPath) =>
                    addZipMasterOperation(zipArchivePanel.session.sessionId, {
                      type: "DELETE_ENTRY",
                      entryPath,
                    })
                  }
                  onMoveEntry={(entryPath, targetPath) =>
                    addZipMasterOperation(zipArchivePanel.session.sessionId, {
                      type: "MOVE_ENTRY",
                      entryPath,
                      targetPath,
                    })
                  }
                  onCopyEntry={(entryPath, targetPath) =>
                    addZipMasterOperation(zipArchivePanel.session.sessionId, {
                      type: "COPY_ENTRY",
                      entryPath,
                      targetPath,
                    })
                  }
                  onOpenEntryReadOnly={(entryPath) =>
                    openZipEntryReadOnly(
                      zipArchivePanel.session.attachmentId,
                      entryPath,
                      zipArchivePanel.session.sessionId
                    )
                  }
                  onOpenEntryMaster={(entryPath) =>
                    openZipEntryMaster(zipArchivePanel.session, entryPath)
                  }
                  onClose={() =>
                    closeZipMasterSession(zipArchivePanel.session.sessionId)
                  }
                  onDiscard={() =>
                    discardZipMasterSession(zipArchivePanel.session.sessionId)
                  }
                />
              ) : (
                <ZipReadOnlyArchiveViewer
                  archive={zipArchivePanel.archive}
                  copy={zipMasterCopy}
                  onOpenEntryReadOnly={(entryPath) =>
                    openZipEntryReadOnly(
                      zipArchivePanel.archive.attachmentId,
                      entryPath
                    )
                  }
                />
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <Input
        ref={replacementInputRef}
        type="file"
        className="hidden"
        accept={
          replacementTarget?.placeholderType
            ? ATTACHMENT_PLACEHOLDER_TYPES[replacementTarget.placeholderType]
                .accept
            : undefined
        }
        onClick={(event) => {
          event.currentTarget.value = "";
        }}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) {
            void replacePlaceholder(file);
          }
        }}
      />
      <Dialog
        open={placeholderDialogOpen}
        onOpenChange={(open) => {
          if (!placeholderBusy) {
            setPlaceholderDialogOpen(open);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{placeholderCopy.placeholderDialogTitle}</DialogTitle>
            <DialogDescription>
              {placeholderCopy.placeholderDialogDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <label className="grid gap-1.5 text-sm font-medium">
              {placeholderCopy.placeholderCode}
              <Input
                autoFocus
                value={placeholderCode}
                maxLength={80}
                onChange={(event) => setPlaceholderCode(event.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              {placeholderCopy.placeholderName}
              <Input
                value={placeholderName}
                maxLength={255}
                onChange={(event) => setPlaceholderName(event.target.value)}
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={placeholderBusy}
              onClick={() => setPlaceholderDialogOpen(false)}
            >
              {placeholderCopy.placeholderCancel}
            </Button>
            <Button
              type="button"
              disabled={
                placeholderBusy ||
                !placeholderCode.trim() ||
                !placeholderName.trim()
              }
              onClick={() => submitPlaceholder()}
            >
              {placeholderBusy ? (
                <Skeleton className="mr-1.5 inline-block size-3.5 rounded-full" />
              ) : null}
              {placeholderCopy.placeholderCreate}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {desktopAgentInstallPrompt?.mode === "MASTER" &&
      desktopAgentInstallPrompt.agentState === "not_running" &&
      !desktopAgentInstallPrompt.masterBlocker ? (
        <DesktopAgentSettingsPrompt
          open
          copy={copy.settingsPanel?.desktopAgentManagement}
          onOpenChange={(open) => {
            if (!open) {
              setDesktopAgentInstallPrompt(null);
            }
          }}
        />
      ) : (
        <DesktopAgentInstallDialog
          prompt={desktopAgentInstallPrompt}
          copy={desktopAgentUpdateCopy}
          onOpenChange={(open) => {
            if (!open) {
              setDesktopAgentInstallPrompt(null);
            }
          }}
          onAgentAvailable={async (attachment, mode) => {
            await retryAttachmentOpen(attachment, mode);
            setDesktopAgentInstallPrompt(null);
            toast({
              title:
                copy.settingsPanel?.desktopAgentManagement?.ready ??
                defaultDesktopAgentManagementCopy.ready,
              description:
                copy.settingsPanel?.desktopAgentManagement?.readyHelp ??
                defaultDesktopAgentManagementCopy.readyHelp,
            });
          }}
        />
      )}
    </section>
  );
}

function ZipReadOnlyArchiveViewer({
  archive,
  copy,
  showHeader = true,
  onOpenEntryReadOnly,
}: {
  archive: ZipReadOnlyResponse;
  copy: ZipMasterEditorCopy;
  showHeader?: boolean;
  onOpenEntryReadOnly?: (entryPath: string) => void | Promise<void>;
}) {
  const [currentFolderPath, setCurrentFolderPath] = useState("");
  const entryCount = countZipEntries(archive.entries);
  const visibleEntries = useMemo(
    () => getVisibleZipEntries(archive.entries, currentFolderPath),
    [archive.entries, currentFolderPath]
  );
  const currentPathLabel = formatZipPathLabel(
    currentFolderPath,
    copy.rootFolder
  );

  useEffect(() => {
    if (!currentFolderPath) {
      return;
    }
    if (findZipFolder(archive.entries, currentFolderPath)) {
      return;
    }
    setCurrentFolderPath("");
  }, [archive.entries, currentFolderPath]);

  return (
    <section className="flex h-full min-h-[520px] flex-col overflow-hidden bg-background text-foreground">
      {showHeader ? (
        <header className="flex min-h-14 items-center justify-between gap-3 border-b bg-card px-4 py-2.5 pr-12">
          <div className="flex min-w-0 items-center gap-3">
            <ProjectFileTypeIcon fileName={archive.fileName} />
            <div className="min-w-0">
              <h2 className="truncate text-sm leading-5 font-semibold">
                {archive.fileName}
              </h2>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {copy.versionPrefix} {archive.version}
                </span>
                <span>
                  {entryCount} {copy.entriesLabel}
                </span>
                <Badge tone="slate">{copy.readOnly}</Badge>
              </div>
            </div>
          </div>
        </header>
      ) : (
        <header className="flex min-h-12 items-center gap-2 border-b bg-background px-3 py-2">
          <ProjectFileTypeIcon fileName={archive.fileName} />
          <span className="min-w-0 truncate text-sm font-medium">
            {archive.fileName}
          </span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {entryCount} {copy.entriesLabel}
          </span>
        </header>
      )}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--spreadsheet-body)]">
        <div className="flex min-h-10 items-center gap-2 border-b bg-muted/20 px-3 py-1.5">
          <Archive className="size-4 shrink-0 text-muted-foreground" />
          {currentFolderPath ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={copy.parentFolder}
              onClick={() =>
                setCurrentFolderPath(getZipParentFolderPath(currentFolderPath))
              }
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
          <span className="min-w-0 truncate text-sm font-medium">
            {currentPathLabel}
          </span>
        </div>
        <div className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-auto bg-muted/20">
          <Table className="min-w-[620px]">
            <TableHeader className="sticky top-0 z-10 bg-[var(--spreadsheet-header)] backdrop-blur">
              <TableRow className="bg-[var(--spreadsheet-header)] hover:bg-[var(--spreadsheet-header)] hover:shadow-none">
                <TableHead className="w-[46%] px-4">
                  {copy.columns.name}
                </TableHead>
                <TableHead className="w-[16%] text-right">
                  {copy.columns.size}
                </TableHead>
                <TableHead className="w-[18%]">{copy.columns.type}</TableHead>
                <TableHead className="w-[20%]">
                  {copy.columns.modified}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleEntries.length > 0 ? (
                visibleEntries.map((entry) => (
                  <ZipReadOnlyEntryTableRow
                    key={entry.path}
                    entry={entry}
                    copy={copy}
                    onOpenFolder={setCurrentFolderPath}
                    onOpenReadOnly={onOpenEntryReadOnly}
                  />
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-36 text-center text-sm text-muted-foreground"
                  >
                    {copy.noEntries}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}

function ZipReadOnlyEntryTableRow({
  entry,
  copy,
  onOpenFolder,
  onOpenReadOnly,
}: {
  entry: ZipMasterEntry;
  copy: ZipMasterEditorCopy;
  onOpenFolder: (folderPath: string) => void;
  onOpenReadOnly?: (entryPath: string) => void | Promise<void>;
}) {
  const isFolder = entry.type === "folder";
  return (
    <TableRow className="h-9 bg-[var(--spreadsheet-body)] select-none hover:bg-[var(--spreadsheet-body-hover)] hover:shadow-none">
      <TableCell className="max-w-0 px-4 py-1.5">
        <div className="group flex min-w-0 items-center gap-2">
          {isFolder ? (
            <Folder
              className="h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          ) : (
            <ProjectFileTypeIcon fileName={entry.name} />
          )}
          {isFolder ? (
            <Button
              type="button"
              variant="ghost"
              size="default"
              className="min-w-0 truncate text-left font-medium text-foreground underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:outline-none"
              onClick={() => onOpenFolder(entry.path)}
            >
              {entry.name}
            </Button>
          ) : (
            <span className="min-w-0 truncate text-left">{entry.name}</span>
          )}
          {!isFolder && onOpenReadOnly ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="ml-auto h-7 w-7 shrink-0 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
              aria-label={`${copy.openReadOnly}: ${entry.name}`}
              onClick={(event) => {
                event.stopPropagation();
                void onOpenReadOnly(entry.path);
              }}
            >
              <Eye className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="py-1.5 text-right text-muted-foreground">
        {entry.type === "file" ? formatZipBytes(entry.size) : ""}
      </TableCell>
      <TableCell className="py-1.5 text-muted-foreground">
        {getZipEntryTypeLabel(entry, copy)}
      </TableCell>
      <TableCell className="py-1.5 text-muted-foreground">
        {formatZipModifiedAt(entry.modifiedAt, copy.modifiedFallback)}
      </TableCell>
    </TableRow>
  );
}

function getVisibleZipEntries(
  entries: ZipMasterEntry[],
  folderPath: string
): ZipMasterEntry[] {
  if (!folderPath) {
    return entries;
  }
  return findZipFolder(entries, folderPath)?.children ?? [];
}

function findZipFolder(
  entries: ZipMasterEntry[],
  folderPath: string
): Extract<ZipMasterEntry, { type: "folder" }> | null {
  for (const entry of entries) {
    if (entry.type !== "folder") {
      continue;
    }
    if (entry.path === folderPath) {
      return entry;
    }
    const nested = findZipFolder(entry.children, folderPath);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function getZipParentFolderPath(folderPath: string) {
  const segments = folderPath
    .replaceAll(/\/+$/g, "")
    .split("/")
    .filter(Boolean);
  segments.pop();
  return segments.length > 0 ? `${segments.join("/")}/` : "";
}

function formatZipPathLabel(folderPath: string, rootLabel: string) {
  if (!folderPath) {
    return rootLabel;
  }
  const segments = folderPath
    .replaceAll(/\/+$/g, "")
    .split("/")
    .filter(Boolean);
  return [rootLabel, ...segments].join(" / ");
}

function getZipEntryTypeLabel(
  entry: ZipMasterEntry,
  copy: ZipMasterEditorCopy
) {
  if (entry.type === "folder") {
    return copy.folderType;
  }
  const extension = getFileExtension(entry.name)?.replace(/^\./, "");
  if (!extension) {
    return copy.fileTypeFallback;
  }
  return `${extension.toUpperCase()} ${copy.fileTypeFallback.toLowerCase()}`;
}

function formatZipModifiedAt(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function countZipEntries(entries: ZipMasterEntry[]): number {
  return entries.reduce(
    (total, entry) =>
      total +
      1 +
      (entry.type === "folder" ? countZipEntries(entry.children) : 0),
    0
  );
}

function formatZipBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function DesktopAgentInstallDialog({
  prompt,
  copy,
  onOpenChange,
  onAgentAvailable,
}: {
  prompt: DesktopAgentInstallPrompt | null;
  copy: DesktopAgentUpdateDialogCopy;
  onOpenChange: (open: boolean) => void;
  onAgentAvailable: (
    attachment: Attachment,
    mode: DesktopAgentInstallPrompt["mode"]
  ) => void | Promise<void>;
}) {
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [updateStartedAt, setUpdateStartedAt] = useState<number | null>(null);
  const [updateTaskId, setUpdateTaskId] = useState<string | null>(null);
  const [selfUpdateUnavailable, setSelfUpdateUnavailable] = useState(false);
  const [startFailed, setStartFailed] = useState(false);
  const copyRef = useRef(copy);
  const onAgentAvailableRef = useRef(onAgentAvailable);
  const masterBlockedByLocalOffice =
    prompt?.masterBlocker === "excel_missing" ||
    prompt?.masterBlocker === "word_missing" ||
    prompt?.masterBlocker === "powerpoint_missing" ||
    prompt?.masterBlocker === "pdf_editor_missing";
  const localOfficeBlockerHasPriority =
    masterBlockedByLocalOffice && !prompt?.agentNeedsUpdate;
  const masterBlockedByLocalSessions =
    (prompt?.localMasterSessionsNeedAttentionCount ?? 0) > 0;
  const showStartAction =
    Boolean(prompt) &&
    prompt?.agentState === "not_running" &&
    !startFailed &&
    !localOfficeBlockerHasPriority &&
    !masterBlockedByLocalSessions;
  const primaryActionDisabled =
    !prompt ||
    updating ||
    checking ||
    localOfficeBlockerHasPriority ||
    masterBlockedByLocalSessions ||
    (!showStartAction &&
      (prompt?.agentState !== "self_update_supported" ||
        selfUpdateUnavailable));
  const visibleUpdateMessage =
    updateMessage ??
    (prompt ? getDesktopAgentInitialMessage(prompt, copy) : null);
  const dialogStatus = prompt
    ? getDesktopAgentDialogStatus(prompt, copy, {
        checking,
        updating,
        selfUpdateUnavailable,
        startFailed,
        masterBlockedByLocalOffice: localOfficeBlockerHasPriority,
        masterBlockedByLocalSessions,
      })
    : null;
  const diagnosticRows = prompt
    ? getDesktopAgentDiagnosticRows(prompt, copy)
    : [];

  useEffect(() => {
    copyRef.current = copy;
    onAgentAvailableRef.current = onAgentAvailable;
  }, [copy, onAgentAvailable]);

  useEffect(() => {
    if (!prompt || !checking) {
      return;
    }
    let inactive = false;
    let resolved = false;
    const interval = window.setInterval(() => {
      void checkDesktopAgentAvailability().then(async (available) => {
        if (inactive || resolved || !available) {
          return;
        }
        resolved = true;
        window.clearInterval(interval);
        setUpdateMessage(copyRef.current.retryingMaster);
        try {
          await onAgentAvailableRef.current(prompt.attachment, prompt.mode);
        } catch (error) {
          if (inactive) {
            return;
          }
          setChecking(false);
          setUpdating(false);
          setUpdateMessage(null);
          showErrorToast(error, copyRef.current.retryMasterFailed);
        }
      });
    }, 500);

    return () => {
      inactive = true;
      window.clearInterval(interval);
    };
  }, [checking, prompt]);

  useEffect(() => {
    if (!prompt || !updating || !updateStartedAt) {
      return;
    }
    let inactive = false;
    let resolved = false;

    const handleReady = async () => {
      resolved = true;
      setChecking(false);
      setUpdating(false);
      setUpdateMessage(copyRef.current.retryingMaster);
      try {
        await onAgentAvailableRef.current(prompt.attachment, prompt.mode);
      } catch (error) {
        if (inactive) {
          return;
        }
        setUpdateMessage(null);
        showErrorToast(error, copyRef.current.retryMasterFailed);
      }
    };
    const tryResumeReadyAgent = async () => {
      if (inactive || resolved) {
        return false;
      }
      try {
        const available = await checkDesktopAgentAvailability();
        if (inactive || resolved || !available) {
          return false;
        }
        await handleReady();
        return true;
      } catch {
        return false;
      }
    };
    const pollStatus = () => {
      void getDesktopAgentUpdateStatus()
        .then(async (status) => {
          if (inactive || resolved || !status) {
            return;
          }
          if (updateTaskId && status.taskId && status.taskId !== updateTaskId) {
            return;
          }
          if (status.status === "FAILED") {
            if (
              status.errorCode === "HEALTH_TIMEOUT" &&
              (await tryResumeReadyAgent())
            ) {
              return;
            }
            resolved = true;
            setChecking(false);
            setUpdating(false);
            setUpdateMessage(null);
            showErrorToast(
              new Error(copyRef.current.failed),
              copyRef.current.failed
            );
            return;
          }
          setUpdateMessage(
            getDesktopAgentUpdateMessage(status.status, copyRef.current, status)
          );
          if (status.status === "READY") {
            void handleReady();
          }
        })
        .catch(async (error) => {
          if (inactive || resolved) {
            return;
          }
          if (await tryResumeReadyAgent()) {
            return;
          }
          setUpdateMessage(null);
          showErrorToast(error, copyRef.current.fallbackFailed);
        });
    };

    pollStatus();
    const interval = window.setInterval(
      pollStatus,
      DESKTOP_AGENT_UPDATE_STATUS_INTERVAL_MS
    );
    const timeout = window.setTimeout(() => {
      void (async () => {
        if (inactive || resolved) {
          return;
        }
        if (await tryResumeReadyAgent()) {
          return;
        }
        resolved = true;
        setChecking(false);
        setUpdating(false);
        setUpdateMessage(null);
        showErrorToast(
          new Error(copyRef.current.updateTimedOut),
          copyRef.current.updateTimedOut
        );
      })();
    }, DESKTOP_AGENT_UPDATE_TIMEOUT_MS);

    return () => {
      inactive = true;
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [prompt, updateStartedAt, updateTaskId, updating]);

  useEffect(() => {
    if (prompt?.agentState === "not_running") {
      setChecking(true);
      return;
    }
    if (!prompt) {
      setChecking(false);
      setUpdating(false);
      setUpdateMessage(null);
      setUpdateStartedAt(null);
      setUpdateTaskId(null);
      setSelfUpdateUnavailable(false);
      setStartFailed(false);
    }
  }, [prompt]);

  const startInstalledAgent = async () => {
    if (!prompt || checking || updating) {
      return;
    }
    setUpdating(true);
    setChecking(false);
    setUpdateStartedAt(null);
    setUpdateTaskId(null);
    setStartFailed(false);
    setUpdateMessage(copy.startingAgent);
    const available = await wakeDesktopAgent();
    if (available) {
      setUpdateMessage(copy.retryingMaster);
      try {
        await onAgentAvailable(prompt.attachment, prompt.mode);
      } catch (error) {
        setChecking(false);
        setUpdateMessage(null);
        showErrorToast(error, copy.retryMasterFailed);
        setUpdating(false);
      }
      return;
    }
    setUpdating(false);
    setStartFailed(true);
    setUpdateMessage(null);
    showErrorToast(new Error(copy.startFailed), copy.startFailed);
  };
  const startUpdate = async () => {
    if (!prompt || updating) {
      return;
    }
    setUpdating(true);
    setChecking(false);
    setUpdateStartedAt(null);
    setUpdateTaskId(null);
    setUpdateMessage(
      prompt.localMasterSessionCount > 0
        ? copy.releasingAndUpdating
        : copy.startingUpdate
    );
    try {
      const releaseManifest = await getDesktopAgentReleaseManifest();
      const result = await updateDesktopAgent({
        releaseManifest,
      });
      setUpdateTaskId(result.taskId ?? null);
      setUpdateStartedAt(Date.now());
      if (result.status === "FAILED") {
        setUpdating(false);
        setUpdateMessage(null);
        showErrorToast(new Error(copy.failed), copy.failed);
        return;
      }
      setUpdateMessage(
        getDesktopAgentUpdateMessage(result.status, copy, result)
      );
    } catch (error) {
      setUpdating(false);
      if (
        error instanceof DesktopAgentClientError &&
        (error.code === "DESKTOP_AGENT_UPDATE_UNSUPPORTED" ||
          error.code === "NOT_FOUND")
      ) {
        setSelfUpdateUnavailable(true);
        setUpdateMessage(null);
        showErrorToast(
          new Error(copy.selfUpdateUnavailable),
          copy.selfUpdateUnavailable
        );
        return;
      }
      setUpdateMessage(null);
      showErrorToast(error, copy.fallbackFailed);
    }
  };
  const handlePrimaryAction = () => {
    if (primaryActionDisabled || !prompt) {
      return;
    }
    if (prompt.agentState === "not_running") {
      void startInstalledAgent();
      return;
    }
    void startUpdate();
  };

  return (
    <Dialog open={Boolean(prompt)} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-hidden sm:max-w-xl">
        <DialogHeader className="min-w-0 pr-8">
          <DialogTitle className="break-words">{copy.title}</DialogTitle>
          <DialogDescription className="break-words">
            {copy.description}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(20rem,calc(100vh-12rem))] min-w-0 overflow-x-hidden overflow-y-auto rounded-lg border border-border bg-muted/35 p-3 text-sm">
          {dialogStatus ? (
            <div className="min-w-0 rounded-md border border-border bg-background/70 p-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {copy.currentStatus}
                </span>
                <Badge tone={dialogStatus.tone} className="max-w-full">
                  <span className="min-w-0 break-words">
                    {dialogStatus.label}
                  </span>
                </Badge>
              </div>
              <p className="mt-2 min-w-0 text-xs break-words text-muted-foreground">
                <span className="font-medium text-foreground">
                  {copy.nextStep}
                </span>
                {": "}
                <span>{dialogStatus.nextStep}</span>
              </p>
            </div>
          ) : null}
          <div className="mt-3 min-w-0 font-medium break-words text-foreground">
            {prompt?.fileName ?? "Selected file"}
          </div>
          <p className="mt-1 break-words text-muted-foreground">
            {getDesktopAgentInstallDescription(
              prompt?.platform ?? "unknown",
              copy
            )}
          </p>
          {checking ? (
            <p className="mt-2 text-xs font-medium break-words text-primary">
              {copy.waitingForStart}
            </p>
          ) : null}
          {visibleUpdateMessage ? (
            <p className="mt-2 text-xs font-medium break-words text-primary">
              {visibleUpdateMessage}
            </p>
          ) : null}
          {prompt?.diagnosticMessage && !prompt.agentNeedsUpdate ? (
            <p className="mt-2 text-xs font-medium break-words text-amber-700 dark:text-amber-300">
              {prompt.diagnosticMessage}
            </p>
          ) : null}
          {diagnosticRows.length > 0 ? (
            <details className="mt-3 min-w-0 rounded-md border border-border/70 bg-background/60 p-3">
              <summary className="cursor-pointer text-xs font-semibold break-words text-foreground select-none">
                {copy.diagnosticDetails}
              </summary>
              <dl className="mt-2 grid min-w-0 gap-1.5 text-xs">
                {diagnosticRows.map((row) => (
                  <div
                    key={row.label}
                    className="grid min-w-0 grid-cols-[minmax(6.5rem,9rem)_minmax(0,1fr)] gap-2"
                  >
                    <dt className="min-w-0 break-words text-muted-foreground">
                      {row.label}
                    </dt>
                    <dd className="min-w-0 font-medium break-words text-foreground">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:flex-wrap sm:justify-start">
          {localOfficeBlockerHasPriority ||
          masterBlockedByLocalSessions ? null : (
            <Button
              type="button"
              size="lg"
              className="w-full min-w-0 text-center whitespace-normal sm:w-auto sm:max-w-full"
              disabled={primaryActionDisabled}
              onClick={handlePrimaryAction}
            >
              {prompt?.agentState === "not_running" ? (
                <Power className="h-4 w-4" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              <span className="min-w-0 break-words">
                {prompt?.agentState === "not_running"
                  ? copy.startAgent
                  : copy.updateAgent}
              </span>
            </Button>
          )}
          {prompt?.downloadUrl ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full min-w-0 text-center whitespace-normal sm:w-auto sm:max-w-full"
              disabled={updating}
              onClick={() => {
                if (prompt.downloadUrl) {
                  downloadDesktopAgentInstaller(prompt.downloadUrl);
                }
              }}
            >
              <Download className="h-4 w-4" />
              <span className="min-w-0 break-words">
                {prompt.platform === "windows"
                  ? copy.downloadWindows
                  : prompt.platform === "macos"
                    ? copy.downloadMacos
                    : copy.downloadGeneric}
              </span>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full min-w-0 text-center whitespace-normal sm:w-auto sm:max-w-full"
            disabled={!prompt || updating}
            onClick={() => onOpenChange(false)}
          >
            <span className="min-w-0 break-words">{copy.exit}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FolderFileArea({
  projectId,
  projectName,
  projectLanguage,
  copy,
  node,
  selectedPath,
  onSelectPathNode,
  selectedPathScrollRef,
  projectAttachments,
  projectAttachmentsLoading,
  desktopAgentSessions,
  currentUserId,
  currentProjectRole,
  activeBucket,
  onActiveBucketChange,
  readOnly = false,
  showTemporaryFiles = true,
  disableFileMutations = false,
  forceReadOnlyOpen = false,
  canSignPreparer = true,
  uploadFileToWorkingPaper,
  uploadFilesToNode,
  onCreatePlaceholder,
  onCreateSmartForm,
  onCreateFromTemplate,
  onReplacePlaceholder,
  uploadFilePending,
  downloadAttachment,
  pending,
  downloadAttachmentReadOnly,
  openAttachmentLocally,
  downloadAttachmentCopy,
  checkInDesktopSession,
  releaseDesktopSession,
  deleteAttachment,
  restoreTargetPapers,
  updateAttachmentIdentity,
  renameAttachment,
  onSetAttachmentClipboard,
  attachmentClipboard,
  onPasteAttachmentClipboard,
  onMoveAttachmentsToNode,
  restoreAttachmentVersion,
  prepareWorkingPaper,
  reviewWorkingPaper,
  prepareAttachment,
  removePreparationSignoff,
  reviewAttachment,
  workflow,
  onReviewQuestionsChanged,
  signoffStatusCopy = defaultSignoffStatusCopy,
  emptySlotUploadCopy,
  openWorkingPaper,
  onPreviewFile,
  onExportAttachments,
  highlightedPaperId,
  highlightedPaperIds = EMPTY_DEFAULT_ARRAY,
  onClearHighlightedPaper,
  onOpenReviewNotes,
}: {
  projectId: string;
  projectName: string;
  projectLanguage?: ProjectLanguage;
  copy: WorkbenchPaperSectionCopy;
  node: WorkflowNode;
  selectedPath: WorkbenchBreadcrumbSegment[];
  onSelectPathNode?: (nodeId: string) => void;
  selectedPathScrollRef?: RefObject<HTMLDivElement | null>;
  projectAttachments: ProjectAttachment[];
  projectAttachmentsLoading: boolean;
  desktopAgentSessions: DesktopAgentSession[];
  currentUserId?: string | null;
  currentProjectRole?: ProjectRole | null;
  activeBucket: WorkingPaperBucket;
  onActiveBucketChange: (bucket: WorkingPaperBucket) => void;
  readOnly?: boolean;
  showTemporaryFiles?: boolean;
  disableFileMutations?: boolean;
  forceReadOnlyOpen?: boolean;
  canSignPreparer?: boolean;
  uploadFileToWorkingPaper?: (paperId: string, file: File) => void;
  uploadFilesToNode?: (
    files: File[],
    bucket: WorkingPaperBucket
  ) => Promise<Attachment[] | undefined> | Attachment[] | undefined;
  onCreatePlaceholder?: () => void;
  onCreateSmartForm?: () => void;
  onCreateFromTemplate?: () => void;
  onReplacePlaceholder?: (attachment: ProjectAttachment) => void;
  uploadFilePending: boolean;
  downloadAttachment: (attachment: Attachment) => void;
  pending: boolean;
  downloadAttachmentReadOnly: (attachment: Attachment) => void;
  openAttachmentLocally: (attachment: Attachment) => void;
  downloadAttachmentCopy: (attachment: Attachment) => void;
  checkInDesktopSession: (
    session: DesktopAgentSession,
    attachment: ProjectAttachment
  ) => void;
  releaseDesktopSession: (
    session: DesktopAgentSession,
    attachment: ProjectAttachment
  ) => void;
  deleteAttachment: (attachmentId: string) => void;
  restoreTargetPapers: WorkflowNode["workingPapers"];
  updateAttachmentIdentity: (attachmentId: string, code: string) => void;
  renameAttachment: (attachmentId: string, originalName: string) => void;
  onSetAttachmentClipboard?: (clipboard: DirectoryFileClipboard) => void;
  attachmentClipboard?: DirectoryFileClipboard | null;
  onPasteAttachmentClipboard?: (targetNode: WorkflowNode) => void;
  onMoveAttachmentsToNode?: (
    files: DirectoryFileTransfer[],
    targetNode: WorkflowNode
  ) => void;
  restoreAttachmentVersion: (attachmentId: string, versionId: string) => void;
  prepareWorkingPaper: (paperId: string) => void;
  reviewWorkingPaper: (paperId: string) => void;
  prepareAttachment: (attachmentId: string) => void;
  removePreparationSignoff: (signoffId: string) => void;
  reviewAttachment: (attachmentId: string) => void;
  onReviewQuestionsChanged?: () => void | Promise<void>;
  workflow?: WorkflowNode[];
  signoffStatusCopy?: WorkbenchSignoffStatusCopy;
  emptySlotUploadCopy: WorkbenchEmptySlotUploadCopy;
  openWorkingPaper: (paperId: string) => void;
  onPreviewFile?: (attachmentId: string) => void;
  onExportAttachments?: (attachmentIds: string[]) => void;
  highlightedPaperId?: string | null;
  highlightedPaperIds?: string[];
  onClearHighlightedPaper?: () => void;
  onOpenReviewNotes?: (target: WorkbenchReviewNotesTarget) => void;
}) {
  const [uploadTargetPaper, setUploadTargetPaper] =
    useState<WorkingPaperRecord | null>(null);
  const [projectFileColumnVisibility, setProjectFileColumnVisibility] =
    useProjectFileColumnVisibility(projectId);
  const headerUploadInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useCompactViewport(767);
  const bucketLabels = copy.bucketLabels ?? defaultBucketLabels;
  const bucketShortLabels = copy.bucketShortLabels ?? defaultBucketShortLabels;
  const bucketDescriptions =
    copy.bucketDescriptions ?? defaultBucketDescriptions;
  const noFilesInBucket = copy.noFilesInBucket ?? "No files in {bucket}";
  const projectFileIndexCopy = resolveProjectFileIndexCopy(
    copy.projectFileIndex
  );
  const pasteAttachmentClipboard =
    onPasteAttachmentClipboard && !readOnly && !disableFileMutations
      ? () => {
          if (!attachmentClipboard) {
            return;
          }
          onPasteAttachmentClipboard(node);
        }
      : undefined;
  const activeProjectAttachments = useMemo(
    () =>
      projectAttachments.filter(
        (attachment) => getProjectAttachmentBucket(attachment) === activeBucket
      ),
    [activeBucket, projectAttachments]
  );
  const activeWorkingPapers = useMemo(
    () =>
      (node.workingPapers ?? []).filter(
        (paper) => (paper.bucket ?? "CURRENT") === activeBucket
      ),
    [activeBucket, node.workingPapers]
  );
  const activeBucketLabel = bucketLabels[activeBucket];
  const isFolderUploadNode = node.level === 1;
  const bulkUploadDisabled = uploadFilePending;
  const canBulkUpload = Boolean(uploadFilesToNode) && !bulkUploadDisabled;
  const emptyTrayCopy =
    projectFileIndexCopy.emptyTray ?? defaultProjectFileIndexCopy.emptyTray;
  const emptyTrayTitle =
    activeBucket === "CURRENT"
      ? emptyTrayCopy.currentTitle
      : activeBucket === "PRIOR"
        ? emptyTrayCopy.priorTitle
        : emptyTrayCopy.temporaryTitle;
  const emptyTrayDescription =
    isFolderUploadNode && uploadFilesToNode
      ? (emptyTrayCopy.folderDescription ??
        emptyTrayCopy.unavailableDescription)
      : activeBucket === "CURRENT"
        ? emptyTrayCopy.currentDescription
        : activeBucket === "PRIOR"
          ? emptyTrayCopy.priorDescription
          : emptyTrayCopy.temporaryDescription;
  const bucketTabs = (
    <BucketTabs
      mobile={isMobile}
      activeBucket={activeBucket}
      onActiveBucketChange={onActiveBucketChange}
      bucketLabels={bucketShortLabels}
      bucketTitles={bucketLabels}
      ariaLabel={
        copy.fileCategoriesLabel ??
        defaultPaperSectionCopy.fileCategoriesLabel ??
        "File categories"
      }
      showTemporaryFiles={showTemporaryFiles}
    />
  );

  return (
    <div
      data-testid="workbench-paper-section"
      className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
    >
      <ProjectFileIndexPanel
        toolbar={
          <FrameHeader
            data-testid="workbench-file-section-header"
            className={cn(
              PROJECT_FILE_TEXT_COLUMN_INSET_CLASS,
              "grid h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 bg-workbench-panel pr-3"
            )}
            onClick={(event) => {
              if (shouldIgnoreProjectFileRowClick(event.target)) {
                return;
              }
              onClearHighlightedPaper?.();
            }}
          >
            <div
              ref={selectedPathScrollRef}
              data-testid="workbench-selected-path"
              className="min-w-0 overflow-clip"
            >
              <div
                className={cn(
                  "flex min-w-0",
                  PROJECT_FILE_HEADER_LABEL_INSET_CLASS
                )}
              >
                <SelectedPathBreadcrumb
                  collapsedLabel={
                    copy.collapsedBreadcrumbLabel ??
                    defaultPaperSectionCopy.collapsedBreadcrumbLabel ??
                    "Show hidden path"
                  }
                  segments={selectedPath}
                  onSelectNode={onSelectPathNode}
                />
              </div>
            </div>
            <div className="emp-file-header-controls flex shrink-0 items-center gap-2">
              {isMobile ? (
                bucketTabs
              ) : (
                <Separator
                  orientation="vertical"
                  className="h-5 bg-border/60"
                />
              )}
              <BulkFileActions
                mobile={isMobile}
                disabled={!canBulkUpload}
                label={
                  emptySlotUploadCopy.upload ??
                  defaultEmptySlotUploadCopy.upload ??
                  "Upload files"
                }
                onUpload={() => headerUploadInputRef.current?.click()}
              />
              {isMobile ? null : (
                <>
                  <ProjectFileColumnVisibilityMenu
                    visibility={projectFileColumnVisibility}
                    onVisibilityChange={setProjectFileColumnVisibility}
                    copy={projectFileIndexCopy}
                  />
                  {bucketTabs}
                </>
              )}
            </div>
            <Input
              ref={headerUploadInputRef}
              type="file"
              multiple
              className="hidden"
              disabled={!canBulkUpload}
              aria-label={
                emptySlotUploadCopy.upload ?? defaultEmptySlotUploadCopy.upload
              }
              {...(isFolderUploadNode
                ? ({ webkitdirectory: "" } as Record<string, string>)
                : {})}
              onClick={(event) => {
                event.currentTarget.value = "";
              }}
              onChange={(event) => {
                const files = [...(event.currentTarget.files ?? [])];
                event.currentTarget.value = "";
                if (
                  !uploadFilesToNode ||
                  bulkUploadDisabled ||
                  files.length === 0
                ) {
                  return;
                }
                void Promise.resolve(
                  uploadFilesToNode(files, activeBucket)
                ).catch(() => {});
              }}
            />
          </FrameHeader>
        }
        projectId={projectId}
        projectName={projectName}
        columnVisibility={projectFileColumnVisibility}
        onColumnVisibilityChange={setProjectFileColumnVisibility}
        reviewQuestionsCopy={copy.reviewQuestions ?? defaultReviewQuestionsCopy}
        projectLanguage={projectLanguage}
        selectionScopeKey={node.id}
        attachments={activeProjectAttachments}
        workpapers={activeWorkingPapers}
        loading={projectAttachmentsLoading}
        desktopAgentSessions={desktopAgentSessions}
        currentUserId={currentUserId}
        currentProjectRole={currentProjectRole}
        pending={pending}
        readOnly={readOnly}
        disableFileMutations={disableFileMutations}
        forceReadOnlyOpen={forceReadOnlyOpen}
        downloadAttachment={downloadAttachment}
        downloadAttachmentReadOnly={downloadAttachmentReadOnly}
        openAttachmentLocally={openAttachmentLocally}
        downloadAttachmentCopy={downloadAttachmentCopy}
        checkInDesktopSession={checkInDesktopSession}
        releaseDesktopSession={releaseDesktopSession}
        deleteAttachment={deleteAttachment}
        restoreTargetPapers={restoreTargetPapers}
        updateAttachmentIdentity={updateAttachmentIdentity}
        renameAttachment={renameAttachment}
        onSetAttachmentClipboard={onSetAttachmentClipboard}
        attachmentClipboard={attachmentClipboard}
        onPasteAttachmentClipboard={pasteAttachmentClipboard}
        onMoveAttachmentsToNode={onMoveAttachmentsToNode}
        restoreAttachmentVersion={restoreAttachmentVersion}
        prepareWorkingPaper={prepareWorkingPaper}
        reviewWorkingPaper={reviewWorkingPaper}
        prepareAttachment={prepareAttachment}
        removePreparationSignoff={removePreparationSignoff}
        reviewAttachment={reviewAttachment}
        canSignPreparer={canSignPreparer}
        onOpenWorkpaper={openWorkingPaper}
        onPreviewFile={onPreviewFile}
        onExportAttachments={onExportAttachments}
        highlightedPaperId={highlightedPaperId}
        highlightedPaperIds={highlightedPaperIds}
        onUploadFilesToNode={
          uploadFilesToNode
            ? async (files) => {
                await uploadFilesToNode(files, activeBucket);
              }
            : undefined
        }
        onChooseFilesToNode={
          canBulkUpload
            ? () => headerUploadInputRef.current?.click()
            : undefined
        }
        onCreatePlaceholder={onCreatePlaceholder}
        onCreateSmartForm={onCreateSmartForm}
        onCreateFromTemplate={onCreateFromTemplate}
        onReplacePlaceholder={onReplacePlaceholder}
        isFolderUploadNode={isFolderUploadNode}
        uploadFilesDisabled={bulkUploadDisabled}
        onUploadFileToWorkpaper={
          !readOnly && uploadFileToWorkingPaper
            ? (paper) => setUploadTargetPaper(paper)
            : undefined
        }
        onReviewQuestionsChanged={onReviewQuestionsChanged}
        onOpenReviewNotes={onOpenReviewNotes}
        workflow={workflow}
        signoffStatusCopy={signoffStatusCopy}
        emptySlotUploadCopy={emptySlotUploadCopy}
        copy={projectFileIndexCopy}
        emptyTitle={noFilesInBucket.replace("{bucket}", activeBucketLabel)}
        emptyDescription={bucketDescriptions[activeBucket]}
        emptyTrayTitle={emptyTrayTitle || activeBucketLabel}
        emptyTrayDescription={emptyTrayDescription}
        layout="fill"
        onClearHighlightedPaper={onClearHighlightedPaper}
      />
      <EmptyWorkpaperUploadDialog
        paper={uploadTargetPaper}
        pending={uploadFilePending}
        copy={emptySlotUploadCopy}
        onOpenChange={(open) => {
          if (!open) {
            setUploadTargetPaper(null);
          }
        }}
        onUploadFile={(paperId, file) => {
          uploadFileToWorkingPaper?.(paperId, file);
          setUploadTargetPaper(null);
        }}
      />
    </div>
  );
}

function EmptyWorkpaperUploadDialog({
  paper,
  pending,
  copy,
  onOpenChange,
  onUploadFile,
}: {
  paper: WorkingPaperRecord | null;
  pending: boolean;
  copy: WorkbenchEmptySlotUploadCopy;
  onOpenChange: (open: boolean) => void;
  onUploadFile: (paperId: string, file: File) => void;
}) {
  const refCode = paper?.code ?? "";
  const title = paper ? formatDisplayName(paper.title) : "";
  const description = title
    ? `${copy.descriptionWithTitle} ${title}`
    : copy.description;

  return (
    <Dialog open={Boolean(paper)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {copy.titlePrefix} {refCode}?
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {copy.cancel}
          </Button>
          <label
            className={cn(
              buttonVariants(),
              "w-full cursor-pointer sm:w-auto",
              pending && "pointer-events-none opacity-60"
            )}
          >
            <Upload className="h-4 w-4" />
            {copy.chooseFile}
            <Input
              aria-label={`${copy.fileInputAriaLabelPrefix} ${refCode}`}
              type="file"
              className="hidden"
              disabled={pending}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (paper && file) {
                  onUploadFile(paper.id, file);
                }
              }}
            />
          </label>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatWorkbenchCopy(
  template: string,
  values: Record<string, string | number>
) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template
  );
}

type ProjectFileIndexRow =
  | {
      kind: "attachment";
      key: string;
      displayRefCode: string;
      attachment: ProjectAttachment;
      paper?: WorkingPaperRecord;
    }
  | {
      kind: "workpaper";
      key: string;
      displayRefCode: string;
      paper: WorkingPaperRecord;
    };

const PROJECT_FILE_ACTIONS_COLUMN_ID = "actions";
const PROJECT_FILE_ACTIONS_COLUMN_SIZE = 36;
const PROJECT_FILE_FILE_COLUMN_MIN_SIZE = 88;
const PROJECT_FILE_FIXED_CONTROL_COLUMN_SIZE = 44;
const PROJECT_FILE_HEADER_LABEL_INSET_CLASS =
  "border border-transparent px-2.5";
const PROJECT_FILE_ISSUES_COLUMN_ID = "notes";
const PROJECT_FILE_ISSUES_COLUMN_SIZE = 86;
const MOBILE_PROJECT_FILE_ISSUES_COLUMN_SIZE = 48;
const PROJECT_FILE_REF_CODE_CHARACTER_SIZE = 8;
const PROJECT_FILE_REF_CODE_COLUMN_MAX_INITIAL_SIZE = 320;
const PROJECT_FILE_REF_CODE_COLUMN_MIN_SIZE = 128;
const MOBILE_PROJECT_FILE_REF_CODE_COLUMN_SIZE = 88;
const PROJECT_FILE_REF_CODE_CONTENT_INSET_SIZE = 40;
const PROJECT_FILE_SELECT_COLUMN_ID = "select";
const PROJECT_FILE_SIGNOFFS_COLUMN_SIZE = 152;
const MOBILE_PROJECT_FILE_SIGNOFFS_COLUMN_SIZE = 80;
const MOBILE_PROJECT_FILE_GRID_CHROME_SIZE = 25;
const PROJECT_FILE_STATUS_COLUMN_MIN_SIZE = 88;
const PROJECT_FILE_TEXT_COLUMN_INSET_CLASS = "px-3";
const PROJECT_FILE_COLUMN_MAX_SIZE = Number.MAX_SAFE_INTEGER;
const PROJECT_FILE_PREFETCH_DELAY_MS = 160;
const PROJECT_FILE_PREFETCH_MAX_BYTES = 16 * 1024 * 1024;
const PROJECT_FILE_PREFETCH_SESSION_LIMIT = 6;
const PROJECT_FILE_COLUMN_VISIBILITY_STORAGE_PREFIX =
  "project-wing-project-file-columns";
const PROJECT_FILE_OPTIONAL_COLUMN_IDS = [
  "status",
  "notes",
  "signoffs",
] as const;
type ProjectFileOptionalColumnId =
  (typeof PROJECT_FILE_OPTIONAL_COLUMN_IDS)[number];
type ColumnVisibilityState = Record<string, boolean>;
type ProjectFileColumnVisibilityUpdater =
  | ColumnVisibilityState
  | ((current: ColumnVisibilityState) => ColumnVisibilityState);
type StoredProjectFileColumnVisibility = {
  projectId: string | null;
  visibility: ColumnVisibilityState;
};
const DEFAULT_PROJECT_FILE_COLUMN_VISIBILITY: ColumnVisibilityState =
  Object.fromEntries(
    PROJECT_FILE_OPTIONAL_COLUMN_IDS.map((columnId) => [columnId, true])
  );
const projectFileColumnClassNames: Record<string, string> = {
  [PROJECT_FILE_SELECT_COLUMN_ID]: "px-0 text-center",
  [PROJECT_FILE_ACTIONS_COLUMN_ID]: "px-0 text-center",
  refCode: `${PROJECT_FILE_TEXT_COLUMN_INSET_CLASS} min-w-0`,
  title: `${PROJECT_FILE_TEXT_COLUMN_INSET_CLASS} min-w-0`,
  status: PROJECT_FILE_TEXT_COLUMN_INSET_CLASS,
  [PROJECT_FILE_ISSUES_COLUMN_ID]: "px-0 text-center",
  signoffs: PROJECT_FILE_TEXT_COLUMN_INSET_CLASS,
};
const projectFileColumnSizes: Record<
  string,
  { size: number; minSize: number; maxSize: number }
> = {
  [PROJECT_FILE_SELECT_COLUMN_ID]: {
    size: PROJECT_FILE_FIXED_CONTROL_COLUMN_SIZE,
    minSize: PROJECT_FILE_FIXED_CONTROL_COLUMN_SIZE,
    maxSize: PROJECT_FILE_FIXED_CONTROL_COLUMN_SIZE,
  },
  [PROJECT_FILE_ACTIONS_COLUMN_ID]: {
    size: PROJECT_FILE_ACTIONS_COLUMN_SIZE,
    minSize: PROJECT_FILE_ACTIONS_COLUMN_SIZE,
    maxSize: PROJECT_FILE_ACTIONS_COLUMN_SIZE,
  },
  refCode: {
    size: 160,
    minSize: PROJECT_FILE_REF_CODE_COLUMN_MIN_SIZE,
    maxSize: PROJECT_FILE_COLUMN_MAX_SIZE,
  },
  title: {
    size: 260,
    minSize: PROJECT_FILE_FILE_COLUMN_MIN_SIZE,
    maxSize: PROJECT_FILE_COLUMN_MAX_SIZE,
  },
  status: {
    size: 144,
    minSize: PROJECT_FILE_STATUS_COLUMN_MIN_SIZE,
    maxSize: PROJECT_FILE_COLUMN_MAX_SIZE,
  },
  [PROJECT_FILE_ISSUES_COLUMN_ID]: {
    size: PROJECT_FILE_ISSUES_COLUMN_SIZE,
    minSize: PROJECT_FILE_ISSUES_COLUMN_SIZE,
    maxSize: PROJECT_FILE_ISSUES_COLUMN_SIZE,
  },
  signoffs: {
    size: PROJECT_FILE_SIGNOFFS_COLUMN_SIZE,
    minSize: PROJECT_FILE_SIGNOFFS_COLUMN_SIZE,
    maxSize: PROJECT_FILE_SIGNOFFS_COLUMN_SIZE,
  },
};

const mobileProjectFileColumnSizes: Record<
  string,
  { size: number; minSize: number; maxSize: number }
> = {
  ...projectFileColumnSizes,
  refCode: {
    size: MOBILE_PROJECT_FILE_REF_CODE_COLUMN_SIZE,
    minSize: MOBILE_PROJECT_FILE_REF_CODE_COLUMN_SIZE,
    maxSize: MOBILE_PROJECT_FILE_REF_CODE_COLUMN_SIZE,
  },
  [PROJECT_FILE_ISSUES_COLUMN_ID]: {
    size: MOBILE_PROJECT_FILE_ISSUES_COLUMN_SIZE,
    minSize: MOBILE_PROJECT_FILE_ISSUES_COLUMN_SIZE,
    maxSize: MOBILE_PROJECT_FILE_ISSUES_COLUMN_SIZE,
  },
  signoffs: {
    size: MOBILE_PROJECT_FILE_SIGNOFFS_COLUMN_SIZE,
    minSize: MOBILE_PROJECT_FILE_SIGNOFFS_COLUMN_SIZE,
    maxSize: MOBILE_PROJECT_FILE_SIGNOFFS_COLUMN_SIZE,
  },
};

function getMobileProjectFileColumnSizes(
  viewportWidth: number
): Record<string, { size: number; minSize: number; maxSize: number }> {
  const fixedColumnWidth =
    MOBILE_PROJECT_FILE_REF_CODE_COLUMN_SIZE +
    MOBILE_PROJECT_FILE_ISSUES_COLUMN_SIZE +
    MOBILE_PROJECT_FILE_SIGNOFFS_COLUMN_SIZE;
  const titleSize = Math.max(
    PROJECT_FILE_FILE_COLUMN_MIN_SIZE,
    viewportWidth - MOBILE_PROJECT_FILE_GRID_CHROME_SIZE - fixedColumnWidth
  );

  return {
    ...mobileProjectFileColumnSizes,
    title: {
      size: titleSize,
      minSize: PROJECT_FILE_FILE_COLUMN_MIN_SIZE,
      maxSize: titleSize,
    },
  };
}

function usePhoneWorkspaceViewportWidth(enabled: boolean) {
  const [width, setWidth] = useState(() =>
    typeof window === "undefined" ? 390 : window.innerWidth
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const syncWidth = () => setWidth(window.innerWidth);
    syncWidth();
    window.addEventListener("resize", syncWidth);
    return () => window.removeEventListener("resize", syncWidth);
  }, [enabled]);

  return width;
}

function getProjectFileColumnVisibilityStorageKey(projectId: string) {
  return `${PROJECT_FILE_COLUMN_VISIBILITY_STORAGE_PREFIX}:${projectId}`;
}

function normalizeProjectFileColumnVisibility(
  value: unknown
): ColumnVisibilityState {
  const stored =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return Object.fromEntries(
    PROJECT_FILE_OPTIONAL_COLUMN_IDS.map((columnId) => [
      columnId,
      stored[columnId] !== false,
    ])
  );
}

function readProjectFileColumnVisibility(projectId: string) {
  if (typeof window === "undefined") {
    return { ...DEFAULT_PROJECT_FILE_COLUMN_VISIBILITY };
  }

  try {
    const stored = window.localStorage.getItem(
      getProjectFileColumnVisibilityStorageKey(projectId)
    );
    return stored
      ? normalizeProjectFileColumnVisibility(JSON.parse(stored))
      : { ...DEFAULT_PROJECT_FILE_COLUMN_VISIBILITY };
  } catch {
    return { ...DEFAULT_PROJECT_FILE_COLUMN_VISIBILITY };
  }
}

function persistProjectFileColumnVisibility(
  projectId: string,
  visibility: ColumnVisibilityState
) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeProjectFileColumnVisibility(visibility);
  const storageKey = getProjectFileColumnVisibilityStorageKey(projectId);

  try {
    if (
      PROJECT_FILE_OPTIONAL_COLUMN_IDS.every(
        (columnId) => normalized[columnId] !== false
      )
    ) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(normalized));
  } catch {
    // Column visibility is a best-effort browser preference.
  }
}

function useProjectFileColumnVisibility(projectId: string) {
  const [storedVisibility, setStoredVisibility] =
    useState<StoredProjectFileColumnVisibility>({
      projectId: null,
      visibility: { ...DEFAULT_PROJECT_FILE_COLUMN_VISIBILITY },
    });

  useEffect(() => {
    setStoredVisibility({
      projectId,
      visibility: readProjectFileColumnVisibility(projectId),
    });
  }, [projectId]);

  const visibility =
    storedVisibility.projectId === projectId
      ? storedVisibility.visibility
      : DEFAULT_PROJECT_FILE_COLUMN_VISIBILITY;
  const updateVisibility = useCallback(
    (updater: ProjectFileColumnVisibilityUpdater) => {
      setStoredVisibility((current) => {
        const currentVisibility =
          current.projectId === projectId
            ? current.visibility
            : readProjectFileColumnVisibility(projectId);
        const nextVisibility = normalizeProjectFileColumnVisibility(
          typeof updater === "function" ? updater(currentVisibility) : updater
        );
        persistProjectFileColumnVisibility(projectId, nextVisibility);
        return { projectId, visibility: nextVisibility };
      });
    },
    [projectId]
  );

  return [visibility, updateVisibility] as const;
}

function ProjectFileIndexPanel({
  projectId,
  projectName,
  columnVisibility: controlledColumnVisibility,
  onColumnVisibilityChange: onControlledColumnVisibilityChange,
  reviewQuestionsCopy = defaultReviewQuestionsCopy,
  selectionScopeKey,
  attachments,
  workpapers = EMPTY_DEFAULT_ARRAY,
  loading,
  desktopAgentSessions = EMPTY_DEFAULT_ARRAY,
  currentUserId,
  currentProjectRole,
  pending,
  readOnly = false,
  disableFileMutations = false,
  forceReadOnlyOpen = false,
  downloadAttachment,
  downloadAttachmentReadOnly,
  openAttachmentLocally,
  downloadAttachmentCopy,
  checkInDesktopSession,
  releaseDesktopSession,
  deleteAttachment,
  restoreTargetPapers,
  updateAttachmentIdentity,
  renameAttachment,
  onSetAttachmentClipboard,
  attachmentClipboard,
  onPasteAttachmentClipboard,
  onMoveAttachmentsToNode,
  restoreAttachmentVersion,
  prepareWorkingPaper,
  reviewWorkingPaper,
  prepareAttachment,
  removePreparationSignoff,
  reviewAttachment,
  canSignPreparer = true,
  onOpenWorkpaper,
  onPreviewFile,
  onExportAttachments,
  highlightedPaperId,
  highlightedPaperIds = EMPTY_DEFAULT_ARRAY,
  onUploadFilesToNode,
  onChooseFilesToNode,
  onCreatePlaceholder,
  onCreateSmartForm,
  onCreateFromTemplate,
  onReplacePlaceholder,
  isFolderUploadNode = false,
  uploadFilesDisabled = false,
  onUploadFileToWorkpaper,
  onReviewQuestionsChanged,
  onOpenReviewNotes,
  workflow,
  signoffStatusCopy = defaultSignoffStatusCopy,
  emptySlotUploadCopy = defaultEmptySlotUploadCopy,
  copy = defaultProjectFileIndexCopy,
  emptyTitle = "No project files",
  emptyDescription = "Active files across the project will appear here.",
  emptyTrayTitle,
  emptyTrayDescription,
  layout = "compact",
  toolbar,
  onClearHighlightedPaper,
}: {
  projectId: string;
  projectName: string;
  columnVisibility?: ColumnVisibilityState;
  onColumnVisibilityChange?: (
    updater: ProjectFileColumnVisibilityUpdater
  ) => void;
  reviewQuestionsCopy?: WorkbenchReviewQuestionsCopy;
  projectLanguage?: ProjectLanguage;
  selectionScopeKey?: string;
  attachments: ProjectAttachment[];
  workpapers?: WorkflowNode["workingPapers"];
  loading: boolean;
  desktopAgentSessions?: DesktopAgentSession[];
  currentUserId?: string | null;
  currentProjectRole?: ProjectRole | null;
  pending: boolean;
  readOnly?: boolean;
  disableFileMutations?: boolean;
  forceReadOnlyOpen?: boolean;
  downloadAttachment: (attachment: Attachment) => void;
  downloadAttachmentReadOnly: (attachment: Attachment) => void;
  openAttachmentLocally: (attachment: Attachment) => void;
  downloadAttachmentCopy: (attachment: Attachment) => void;
  checkInDesktopSession: (
    session: DesktopAgentSession,
    attachment: ProjectAttachment
  ) => void;
  releaseDesktopSession: (
    session: DesktopAgentSession,
    attachment: ProjectAttachment
  ) => void;
  deleteAttachment: (attachmentId: string) => void;
  restoreTargetPapers: WorkflowNode["workingPapers"];
  updateAttachmentIdentity: (attachmentId: string, code: string) => void;
  renameAttachment: (attachmentId: string, originalName: string) => void;
  onSetAttachmentClipboard?: (clipboard: DirectoryFileClipboard) => void;
  attachmentClipboard?: DirectoryFileClipboard | null;
  onPasteAttachmentClipboard?: () => void;
  onMoveAttachmentsToNode?: (
    files: DirectoryFileTransfer[],
    targetNode: WorkflowNode
  ) => void;
  restoreAttachmentVersion: (attachmentId: string, versionId: string) => void;
  prepareWorkingPaper: (paperId: string) => void;
  reviewWorkingPaper: (paperId: string) => void;
  prepareAttachment: (attachmentId: string) => void;
  removePreparationSignoff: (signoffId: string) => void;
  reviewAttachment: (attachmentId: string) => void;
  canSignPreparer?: boolean;
  onOpenWorkpaper?: (paperId: string) => void;
  onPreviewFile?: (attachmentId: string) => void;
  onExportAttachments?: (attachmentIds: string[]) => void;
  highlightedPaperId?: string | null;
  highlightedPaperIds?: string[];
  onUploadFilesToNode?: (files: File[]) => void | Promise<void>;
  onChooseFilesToNode?: () => void;
  onCreatePlaceholder?: () => void;
  onCreateSmartForm?: () => void;
  onCreateFromTemplate?: () => void;
  onReplacePlaceholder?: (attachment: ProjectAttachment) => void;
  isFolderUploadNode?: boolean;
  uploadFilesDisabled?: boolean;
  onUploadFileToWorkpaper?: (paper: WorkingPaperRecord) => void;
  onReviewQuestionsChanged?: () => void | Promise<void>;
  onOpenReviewNotes?: (target: WorkbenchReviewNotesTarget) => void;
  workflow?: WorkflowNode[];
  signoffStatusCopy?: WorkbenchSignoffStatusCopy;
  emptySlotUploadCopy?: WorkbenchEmptySlotUploadCopy;
  copy?: WorkbenchProjectFileIndexCopy;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyTrayTitle?: string;
  emptyTrayDescription?: string;
  layout?: "compact" | "fill";
  toolbar?: ReactNode;
  onClearHighlightedPaper?: () => void;
}) {
  const [localColumnVisibility, onLocalColumnVisibilityChange] =
    useProjectFileColumnVisibility(projectId);
  const columnVisibility = controlledColumnVisibility ?? localColumnVisibility;
  const onColumnVisibilityChange =
    onControlledColumnVisibilityChange ?? onLocalColumnVisibilityChange;
  const queryClient = useQueryClient();
  const { toast: _unused_toast } = useToast();
  const projectFileCopy = resolveProjectFileIndexCopy(copy);
  const activityCopy =
    projectFileCopy.activity ?? getDefaultProjectFileActivityCopy();
  const relocationCopy = projectFileCopy.relocation;
  const actionMenuCopy = projectFileCopy.actionMenu;
  const selectionCopy = projectFileCopy.selection;
  const fileMutationDisabled = readOnly || disableFileMutations;
  const openReadOnlyByDefault = readOnly || forceReadOnlyOpen;
  const isPhoneViewport = useCompactViewport(767.5);
  const phoneViewportWidth = usePhoneWorkspaceViewportWidth(isPhoneViewport);
  const activeProjectFileColumnSizes = isPhoneViewport
    ? getMobileProjectFileColumnSizes(phoneViewportWidth)
    : projectFileColumnSizes;
  const effectiveColumnVisibility = isPhoneViewport
    ? { ...columnVisibility, status: false }
    : columnVisibility;
  const [multiSelectEnabled, setMultiSelectEnabled] = useState(false);
  const [selectedProjectFileRowKey, setSelectedProjectFileRowKey] = useState<
    string | null
  >(null);
  const previewPrefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const prefetchedAttachmentIdsRef = useRef(new Set<string>());
  const cancelAttachmentPreviewPrefetch = useCallback(() => {
    if (!previewPrefetchTimerRef.current) {
      return;
    }
    clearTimeout(previewPrefetchTimerRef.current);
    previewPrefetchTimerRef.current = null;
  }, []);
  const scheduleAttachmentPreviewPrefetch = useCallback(
    (attachment: ProjectAttachment) => {
      cancelAttachmentPreviewPrefetch();
      if (
        attachment.placeholderType ||
        typeof attachment.fileSize !== "number" ||
        attachment.fileSize <= 0 ||
        attachment.fileSize > PROJECT_FILE_PREFETCH_MAX_BYTES ||
        prefetchedAttachmentIdsRef.current.has(attachment.id) ||
        prefetchedAttachmentIdsRef.current.size >=
          PROJECT_FILE_PREFETCH_SESSION_LIMIT
      ) {
        return;
      }
      const previewKind = getAttachmentContentPreviewKind(attachment);
      const spreadsheet = isSpreadsheetAttachment(attachment);
      if (!previewKind && !spreadsheet) {
        return;
      }

      previewPrefetchTimerRef.current = setTimeout(() => {
        previewPrefetchTimerRef.current = null;
        prefetchedAttachmentIdsRef.current.add(attachment.id);
        if (spreadsheet) {
          void queryClient.prefetchInfiniteQuery({
            queryKey: [
              "attachmentSpreadsheetPreview",
              projectId,
              attachment.id,
              attachment.version,
              attachment.contentHash,
              0,
              0,
              undefined,
            ],
            initialPageParam: 0,
            queryFn: ({ pageParam }) =>
              api.previewAttachment(projectId, attachment.id, {
                sheetIndex: 0,
                offset: Number(pageParam),
                limit: SPREADSHEET_PAGE_ROWS,
                columnOffset: 0,
                columnLimit: SPREADSHEET_PAGE_COLUMNS,
              }),
            getNextPageParam: (lastPage: SpreadsheetPreview) =>
              lastPage.hasMore
                ? lastPage.offset + lastPage.rows.length
                : undefined,
            staleTime: PREVIEW_QUERY_STALE_TIME_MS,
            gcTime: PREVIEW_QUERY_GC_TIME_MS,
            meta: PREVIEW_QUERY_META,
          });
          return;
        }
        if (!previewKind) {
          return;
        }
        void queryClient.prefetchQuery({
          queryKey: attachmentContentPreviewQueryKey(
            projectId,
            attachment,
            previewKind
          ),
          queryFn: () =>
            api.previewAttachmentContent(
              projectId,
              attachment.id,
              attachment.version
            ),
          staleTime: PREVIEW_QUERY_STALE_TIME_MS,
          gcTime: PREVIEW_QUERY_GC_TIME_MS,
          meta: PREVIEW_QUERY_META,
        });
      }, PROJECT_FILE_PREFETCH_DELAY_MS);
    },
    [cancelAttachmentPreviewPrefetch, projectId, queryClient]
  );
  useEffect(
    () => () => cancelAttachmentPreviewPrefetch(),
    [cancelAttachmentPreviewPrefetch]
  );
  const [moveDialogFiles, setMoveDialogFiles] = useState<
    DirectoryFileTransfer[] | null
  >(null);
  const desktopAgentSessionByAttachment = useMemo(() => {
    const sessionsByAttachment = new Map<string, DesktopAgentSession>();
    for (const session of desktopAgentSessions) {
      if (!isDisplayableDesktopAgentSession(session)) {
        continue;
      }
      sessionsByAttachment.set(session.attachmentId, session);
    }
    return sessionsByAttachment;
  }, [desktopAgentSessions]);
  const paperById = useMemo(
    () => new Map(restoreTargetPapers.map((paper) => [paper.id, paper])),
    [restoreTargetPapers]
  );
  const projectFileRows = useMemo<ProjectFileIndexRow[]>(() => {
    const rows: ProjectFileIndexRow[] = [];
    const seenAttachmentIds = new Set<string>();
    const attachmentsByPaperId = new Map<string, ProjectAttachment[]>();
    const workpaperById = new Map(workpapers.map((paper) => [paper.id, paper]));
    const pushAttachmentRow = (
      attachment: ProjectAttachment,
      paper?: WorkingPaperRecord
    ) => {
      seenAttachmentIds.add(attachment.id);
      rows.push({
        kind: "attachment",
        key: `attachment-${attachment.id}`,
        displayRefCode: "",
        attachment,
        paper,
      });
    };

    for (const attachment of attachments) {
      const paperId = attachment.workingPaper?.id ?? attachment.workingPaperId;
      if (!paperId) {
        continue;
      }
      const existing = attachmentsByPaperId.get(paperId) ?? [];
      existing.push(attachment);
      attachmentsByPaperId.set(paperId, existing);
    }

    for (const paper of workpapers) {
      const paperAttachments = attachmentsByPaperId.get(paper.id) ?? [];
      for (const attachment of paperAttachments) {
        pushAttachmentRow(attachment, paper);
      }
    }

    for (const attachment of attachments) {
      if (seenAttachmentIds.has(attachment.id)) {
        continue;
      }
      const paperId = attachment.workingPaper?.id ?? attachment.workingPaperId;
      pushAttachmentRow(
        attachment,
        paperId ? workpaperById.get(paperId) : undefined
      );
    }

    return rows
      .sort((left, right) => {
        if (left.kind !== "attachment" || right.kind !== "attachment") {
          return 0;
        }
        return (
          (left.attachment.sortOrder ?? 0) - (right.attachment.sortOrder ?? 0)
        );
      })
      .map((row) => ({
        ...row,
        displayRefCode: getProjectFileRefCodeSortValue(row),
      }));
  }, [attachments, workpapers]);
  const reorderAttachments = useMutation({
    mutationFn: (input: {
      workflowNodeId: string;
      bucket: WorkingPaperBucket;
      attachmentIds: string[];
    }) => api.reorderWorkingPaperAttachments(projectId, input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: ["project-attachments", projectId],
      });
      const queryKey = ["project-attachments", projectId] as const;
      const previousAttachments =
        queryClient.getQueryData<ProjectAttachment[]>(queryKey);
      queryClient.setQueryData<ProjectAttachment[]>(queryKey, (current = []) =>
        reorderProjectAttachments(current, input)
      );
      return { previousAttachments, queryKey };
    },
    onError: (error, _input, context) => {
      if (context?.previousAttachments) {
        queryClient.setQueryData(context.queryKey, context.previousAttachments);
      }
      showErrorToast(error, "Unable to reorder files");
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["project-attachments", projectId],
        }),
        queryClient.invalidateQueries({ queryKey: ["workflow", projectId] }),
      ]),
  });
  const reorderAttachmentRow = useCallback(
    (
      workflowNodeId: string,
      bucket: WorkingPaperBucket,
      attachmentId: string,
      targetAttachmentId: string,
      position: AttachmentInsertionPosition
    ) => {
      if (attachmentId === targetAttachmentId || reorderAttachments.isPending) {
        return;
      }
      const attachmentIds = projectFileRows
        .filter(
          (row): row is Extract<ProjectFileIndexRow, { kind: "attachment" }> =>
            row.kind === "attachment" &&
            (row.attachment.workingPaper?.workflowNodeId ??
              row.attachment.workflowNodeId) === workflowNodeId &&
            (row.attachment.bucket ??
              row.attachment.workingPaper?.bucket ??
              "CURRENT") === bucket
        )
        .map((row) => row.attachment.id);
      const sourceIndex = attachmentIds.indexOf(attachmentId);
      const targetIndex = attachmentIds.indexOf(targetAttachmentId);
      if (
        !changesAttachmentOrder({
          attachmentIds,
          sourceAttachmentId: attachmentId,
          targetAttachmentId,
          position,
        })
      ) {
        return;
      }
      attachmentIds.splice(sourceIndex, 1);
      const adjustedTargetIndex =
        sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
      attachmentIds.splice(
        position === "after" ? adjustedTargetIndex + 1 : adjustedTargetIndex,
        0,
        attachmentId
      );
      reorderAttachments.mutate({ workflowNodeId, bucket, attachmentIds });
    },
    [projectFileRows, reorderAttachments]
  );
  const highlightedPaperIdsKey = highlightedPaperIds.join("\0");
  const highlightedProjectFileRowKey = useMemo(
    () =>
      highlightedPaperId
        ? resolveProjectFileRowHighlightKey(projectFileRows, highlightedPaperId)
        : null,
    [highlightedPaperId, projectFileRows]
  );
  const highlightedProjectFileRowKeys = useMemo(() => {
    if (!highlightedPaperIds.length) {
      return [];
    }
    return [
      ...new Set(
        highlightedPaperIds
          .map((id) => resolveProjectFileRowHighlightKey(projectFileRows, id))
          .filter((key): key is string => Boolean(key))
      ),
    ];
  }, [highlightedPaperIds, projectFileRows]);
  const highlightedProjectFileRowKeySet = useMemo(
    () => new Set(highlightedProjectFileRowKeys),
    [highlightedProjectFileRowKeys]
  );
  const clearCurrentProjectFileRow = useCallback(() => {
    setSelectedProjectFileRowKey(null);
    onClearHighlightedPaper?.();
  }, [onClearHighlightedPaper]);
  const clearCurrentProjectFileRowOnBlankTarget = useCallback(
    (target: EventTarget | null) => {
      if (!(target instanceof Element)) {
        return;
      }
      if (target.closest("[data-row-id]")) {
        return;
      }
      clearCurrentProjectFileRow();
    },
    [clearCurrentProjectFileRow]
  );
  const hasHighlightedPapers = Boolean(
    highlightedPaperId || highlightedPaperIds.length > 0
  );
  const highlightedFileRowRef = useRef<HTMLTableRowElement | null>(null);
  const scrollHighlightedFileRow = useCallback(
    (row: HTMLTableRowElement | null) => {
      highlightedFileRowRef.current = row;
      if (!hasHighlightedPapers) {
        return;
      }
      if (typeof row?.scrollIntoView !== "function") {
        return;
      }
      row.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    },
    [hasHighlightedPapers]
  );

  useEffect(() => {
    if (!hasHighlightedPapers) {
      return;
    }
    if (typeof highlightedFileRowRef.current?.scrollIntoView !== "function") {
      return;
    }
    highlightedFileRowRef.current.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [
    hasHighlightedPapers,
    highlightedPaperId,
    highlightedPaperIdsKey,
    projectFileRows,
  ]);
  useEffect(() => {
    if (!selectedProjectFileRowKey) {
      return;
    }
    if (projectFileRows.some((row) => row.key === selectedProjectFileRowKey)) {
      return;
    }
    setSelectedProjectFileRowKey(null);
  }, [projectFileRows, selectedProjectFileRowKey]);
  const renderAttachmentActionMenu = (
    attachment: ProjectAttachment,
    selectedAttachments: ProjectAttachment[] = [attachment],
    numberedDisplayName?: string,
    onEnableMultiSelect?: () => void,
    isMultiSelectAction = false,
    mobileSheet?: MobileFileActionSheetState
  ) => {
    const attachmentsForAction =
      selectedAttachments.length > 0 ? selectedAttachments : [attachment];
    const exportSelectionAttachments = isMultiSelectAction
      ? selectedAttachments
      : [];
    const isBatchAction =
      isMultiSelectAction || attachmentsForAction.length > 1;
    const lockState = getAttachmentLockState(attachment, currentUserId);
    const desktopAgentSession = desktopAgentSessionByAttachment.get(
      attachment.id
    );
    const canRecoverCurrentUserMaster =
      lockState.isLockedByCurrentUser && !desktopAgentSession;
    const releasableDesktopAgentSession =
      lockState.isLockedByCurrentUser &&
      desktopAgentSession &&
      hasDesktopMasterGrant(desktopAgentSession)
        ? desktopAgentSession
        : null;
    const location = attachment.workingPaper;
    const displayName = isBatchAction
      ? `${isMultiSelectAction ? exportSelectionAttachments.length : attachmentsForAction.length} files`
      : (numberedDisplayName ?? getAttachmentDisplayName(attachment));
    const clipboardFiles = attachmentsForAction
      .map((item) =>
        getProjectAttachmentFileTransfer(item, getAttachmentDisplayName(item))
      )
      .filter((file): file is DirectoryFileTransfer => Boolean(file));
    const clipboardFile = clipboardFiles[0] ?? null;
    const desktopMasterOpenSupported =
      isZipAttachment(attachment) ||
      isSmartFormAttachment(attachment) ||
      isDesktopAgentOpenSupportedAttachment(attachment, "MASTER");
    const desktopReadOnlyOpenSupported =
      isZipAttachment(attachment) ||
      isSmartFormAttachment(attachment) ||
      isDesktopAgentOpenSupportedAttachment(attachment, "READ_ONLY");
    return (
      <ProjectFileActionMenu
        mobileSheet={mobileSheet}
        projectId={projectId}
        attachment={attachment}
        displayName={displayName}
        resetHeadCopy={projectFileCopy.resetHead ?? defaultResetHeadCopy}
        currentRefcode={location?.code}
        disabled={pending}
        fileMutationDisabled={fileMutationDisabled}
        desktopMasterOpenSupported={desktopMasterOpenSupported}
        desktopReadOnlyOpenSupported={desktopReadOnlyOpenSupported}
        desktopLocalOpenSupported={
          !isSmartFormAttachment(attachment) && !isArchiveAttachment(attachment)
        }
        masterDisabled={
          openReadOnlyByDefault ||
          lockState.isLockedByOther ||
          (lockState.isLockedByCurrentUser && Boolean(desktopAgentSession))
        }
        masterLabel={
          canRecoverCurrentUserMaster
            ? actionMenuCopy.recoverMasterSession
            : actionMenuCopy.openMaster
        }
        actionMenuCopy={actionMenuCopy}
        canResetHead={
          !readOnly && !lockState.isLocked && !attachment.placeholderType
        }
        onPreview={
          onPreviewFile && !attachment.placeholderType
            ? () => onPreviewFile(attachment.id)
            : undefined
        }
        onOpenMaster={() => downloadAttachment(attachment)}
        onOpenReadOnly={() => downloadAttachmentReadOnly(attachment)}
        onOpenLocally={() => openAttachmentLocally(attachment)}
        onDownload={() => downloadAttachmentCopy(attachment)}
        onEnableMultiSelect={onEnableMultiSelect}
        selectionExportMode={isMultiSelectAction}
        exportSelectionCount={exportSelectionAttachments.length}
        onExportSelection={
          isMultiSelectAction &&
          exportSelectionAttachments.length > 0 &&
          onExportAttachments
            ? () =>
                onExportAttachments(
                  exportSelectionAttachments.map((item) => item.id)
                )
            : undefined
        }
        onExportZipJob={
          !isMultiSelectAction && onExportAttachments
            ? () => onExportAttachments([attachment.id])
            : undefined
        }
        onReplacePlaceholder={
          !isBatchAction && attachment.placeholderType
            ? () => onReplacePlaceholder?.(attachment)
            : undefined
        }
        onReleaseMaster={
          !openReadOnlyByDefault && releasableDesktopAgentSession
            ? () =>
                releaseDesktopSession(releasableDesktopAgentSession, attachment)
            : undefined
        }
        onDelete={() => {
          attachmentsForAction.forEach((item) => deleteAttachment(item.id));
        }}
        onChangeRefcode={
          !isBatchAction && location
            ? (code) => updateAttachmentIdentity(attachment.id, code)
            : undefined
        }
        onRename={
          isBatchAction
            ? undefined
            : (originalName) => renameAttachment(attachment.id, originalName)
        }
        relocationCopy={relocationCopy}
        workflow={workflow ?? []}
        moveFiles={clipboardFiles}
        onRequestMoveTo={
          onMoveAttachmentsToNode && clipboardFiles.length > 0
            ? () => setMoveDialogFiles(clipboardFiles)
            : undefined
        }
        onCopyToClipboard={
          onSetAttachmentClipboard && clipboardFile
            ? () =>
                onSetAttachmentClipboard({
                  mode: "copy",
                  file: clipboardFile,
                  files: clipboardFiles,
                })
            : undefined
        }
        onCutToClipboard={
          onSetAttachmentClipboard && clipboardFile
            ? () =>
                onSetAttachmentClipboard({
                  mode: "move",
                  file: clipboardFile,
                  files: clipboardFiles,
                })
            : undefined
        }
        onPasteClipboard={onPasteAttachmentClipboard || undefined}
        pasteClipboardDisabled={!attachmentClipboard}
        onRestoreVersion={
          isBatchAction || attachment.placeholderType
            ? undefined
            : (versionId) => restoreAttachmentVersion(attachment.id, versionId)
        }
      />
    );
  };
  const projectFileColumns = useMemo<ColumnDef<ProjectFileIndexRow>[]>(
    () => [
      ...(multiSelectEnabled
        ? [
            {
              id: PROJECT_FILE_SELECT_COLUMN_ID,
              ...activeProjectFileColumnSizes[PROJECT_FILE_SELECT_COLUMN_ID],
              enableResizing: false,
              header: ({ table }) => {
                const allSelected = table.getIsAllRowsSelected();
                const someSelected = table.getIsSomeRowsSelected();

                return (
                  <div className="flex w-full justify-center">
                    <Checkbox
                      aria-label={selectionCopy.selectAll}
                      checked={allSelected}
                      indeterminate={someSelected && !allSelected}
                      onCheckedChange={(checked) =>
                        table.toggleAllRowsSelected(checked)
                      }
                    />
                  </div>
                );
              },
              cell: ({ row }) => (
                <div
                  role="presentation"
                  className="flex w-full justify-center"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <Checkbox
                    aria-label={formatWorkbenchCopy(selectionCopy.selectRow, {
                      name: getProjectFileRowDisplayName(row.original),
                    })}
                    checked={row.getIsSelected()}
                    onCheckedChange={(checked) => row.toggleSelected(checked)}
                  />
                </div>
              ),
              enableSorting: false,
              enableHiding: false,
              meta: {
                cellClassName: getProjectFileColumnClassName(
                  PROJECT_FILE_SELECT_COLUMN_ID
                ),
                headerClassName: getProjectFileColumnClassName(
                  PROJECT_FILE_SELECT_COLUMN_ID
                ),
                headerTitle: selectionCopy.selectAll,
              },
            } satisfies ColumnDef<ProjectFileIndexRow>,
          ]
        : []),
      {
        id: "refCode",
        ...activeProjectFileColumnSizes.refCode,
        header: projectFileCopy.headers.refCode,
        enableHiding: false,
        meta: {
          cellClassName: getProjectFileColumnClassName(
            "refCode",
            isPhoneViewport
          ),
          headerClassName: getProjectFileColumnClassName(
            "refCode",
            isPhoneViewport
          ),
          headerTitle: projectFileCopy.headers.refCode,
        },
        accessorFn: (row) => row.displayRefCode,
        sortingFn: (rowA, rowB) =>
          compareProjectFileSortValues(
            rowA.original.displayRefCode,
            rowB.original.displayRefCode
          ),
        cell: ({ row }) => {
          const fileRow = row.original;
          return (
            <ProjectFileRefCodeCell
              row={fileRow}
              disabled={pending || fileMutationDisabled}
              mobile={isPhoneViewport}
              onChangeRefcode={updateAttachmentIdentity}
            />
          );
        },
      },
      {
        id: "title",
        ...activeProjectFileColumnSizes.title,
        header: projectFileCopy.headers.title,
        enableHiding: false,
        enableResizing: !isPhoneViewport,
        accessorFn: getProjectFileRowDisplayName,
        meta: {
          autoSize: !isPhoneViewport,
          cellClassName: getProjectFileColumnClassName(
            "title",
            isPhoneViewport
          ),
          headerClassName: getProjectFileColumnClassName(
            "title",
            isPhoneViewport
          ),
          headerTitle: projectFileCopy.headers.title,
        },
        sortingFn: (rowA, rowB) =>
          compareProjectFileSortValues(
            getProjectFileRowDisplayName(rowA.original),
            getProjectFileRowDisplayName(rowB.original)
          ),
        cell: ({ row }) => {
          const fileRow = row.original;
          const mobileFileNameClass = isPhoneViewport
            ? "min-w-0 line-clamp-2 break-words text-left text-[13px] leading-5"
            : "block min-w-0 truncate";
          const mobileFileNameButtonClass = isPhoneViewport
            ? "h-auto min-h-9 whitespace-normal px-0 py-1 text-[13px] leading-5"
            : undefined;
          const renderFileName = (displayName: string) => (
            <span
              className={mobileFileNameClass}
              title={isPhoneViewport ? displayName : undefined}
            >
              {displayName}
            </span>
          );
          if (fileRow.kind === "workpaper") {
            const refCode = fileRow.paper.code;
            const displayName = formatDisplayName(fileRow.paper.title);

            if (onUploadFileToWorkpaper) {
              return (
                <Button
                  type="button"
                  variant="ghost"
                  size="default"
                  className={cn(
                    "flex max-w-full min-w-0 items-center justify-start gap-2 rounded-sm text-left font-medium text-foreground underline-offset-4 transition hover:text-primary hover:underline",
                    mobileFileNameButtonClass
                  )}
                  aria-label={`${emptySlotUploadCopy.uploadAriaLabelPrefix} ${refCode}`}
                  onClick={() => onUploadFileToWorkpaper(fileRow.paper)}
                >
                  <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {renderFileName(displayName)}
                </Button>
              );
            }

            if (onOpenWorkpaper) {
              return (
                <Button
                  type="button"
                  variant="ghost"
                  size="default"
                  className={cn(
                    "flex max-w-full min-w-0 items-center gap-2 rounded-sm text-left font-medium text-foreground underline-offset-4 transition hover:text-primary hover:underline",
                    mobileFileNameButtonClass
                  )}
                  aria-label={formatWorkbenchCopy(
                    projectFileCopy.openWorkpaper,
                    {
                      name: displayName,
                    }
                  )}
                  onClick={() => onOpenWorkpaper(fileRow.paper.id)}
                >
                  <ClipboardCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {renderFileName(displayName)}
                </Button>
              );
            }

            return (
              <span className="text-foreground">
                {renderFileName(displayName)}
              </span>
            );
          }

          const { attachment } = fileRow;
          if (attachment.placeholderType) {
            const displayName = getProjectFileRowDisplayName(fileRow);
            return (
              <ButtonGroup className="w-full max-w-full min-w-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="default"
                  disabled={pending || fileMutationDisabled}
                  className={cn(
                    "inline-flex max-w-[calc(100%-2rem)] min-w-0 items-center justify-start gap-2 rounded-sm text-left font-medium text-foreground hover:text-primary",
                    mobileFileNameButtonClass
                  )}
                  onClick={() => onReplacePlaceholder?.(attachment)}
                >
                  <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {renderFileName(displayName)}
                  {isPhoneViewport ? null : (
                    <Badge className="shrink-0 text-[10px]">
                      {actionMenuCopy.placeholderBadge} ·{" "}
                      {actionMenuCopy.placeholderTypeLabels?.[
                        attachment.placeholderType
                      ] ?? attachment.placeholderType}
                    </Badge>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--brand-tint)] hover:text-primary"
                  aria-label={formatWorkbenchCopy(
                    actionMenuCopy.triggerActionsFor,
                    {
                      name: displayName,
                    }
                  )}
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    event.currentTarget.dispatchEvent(
                      new MouseEvent("contextmenu", {
                        bubbles: true,
                        cancelable: true,
                        clientX: rect.left + rect.width / 2,
                        clientY: rect.bottom + 4,
                      })
                    );
                  }}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </ButtonGroup>
            );
          }
          const lockState = getAttachmentLockState(attachment, currentUserId);
          const _unused_desktopAgentSession =
            desktopAgentSessionByAttachment.get(attachment.id);
          const displayName = getProjectFileRowDisplayName(fileRow);
          const desktopMasterOpenSupported =
            isZipAttachment(attachment) ||
            isSmartFormAttachment(attachment) ||
            isDesktopAgentOpenSupportedAttachment(attachment, "MASTER");
          const desktopReadOnlyOpenSupported =
            isZipAttachment(attachment) ||
            isSmartFormAttachment(attachment) ||
            isDesktopAgentOpenSupportedAttachment(attachment, "READ_ONLY");
          const desktopLocalOpenSupported =
            !isSmartFormAttachment(attachment) &&
            !isArchiveAttachment(attachment);
          const opensAsMaster =
            !openReadOnlyByDefault &&
            (desktopMasterOpenSupported || isArchiveAttachment(attachment));
          const opensReadOnly =
            openReadOnlyByDefault && desktopReadOnlyOpenSupported;
          const opensAsPreview =
            getExtendAttachmentPreviewKind(attachment) === "image" &&
            Boolean(onPreviewFile);
          return (
            <ButtonGroup className="w-full max-w-full min-w-0">
              <Button
                type="button"
                variant="ghost"
                size="default"
                disabled={
                  pending ||
                  (opensAsPreview
                    ? false
                    : opensAsMaster
                      ? lockState.isLocked || !desktopMasterOpenSupported
                      : !opensReadOnly && !desktopLocalOpenSupported)
                }
                className={cn(
                  "inline-flex max-w-full min-w-0 shrink items-center justify-start gap-2 rounded-sm text-left font-medium text-foreground underline-offset-4 transition hover:text-primary hover:underline disabled:pointer-events-none disabled:text-muted-foreground disabled:no-underline",
                  mobileFileNameButtonClass
                )}
                aria-label={formatWorkbenchCopy(
                  opensAsPreview
                    ? actionMenuCopy.preview
                    : opensAsMaster
                      ? projectFileCopy.openAsMaster
                      : opensReadOnly
                        ? actionMenuCopy.openReadOnly
                        : (actionMenuCopy.openLocal ??
                          actionMenuCopy.export ??
                          "Open"),
                  { name: displayName }
                )}
                onClick={() =>
                  opensAsPreview
                    ? onPreviewFile?.(attachment.id)
                    : opensAsMaster
                      ? downloadAttachment(attachment)
                      : opensReadOnly
                        ? downloadAttachmentReadOnly(attachment)
                        : openAttachmentLocally(attachment)
                }
              >
                <ProjectFileTypeIcon fileName={displayName} />
                {renderFileName(displayName)}
                {isSmartFormAttachment(attachment) && !isPhoneViewport ? (
                  <SmartFormInlineCompletionStatus
                    status={attachment.smartFormInstance?.status}
                    completeLabel={
                      projectFileCopy.smartFormComplete ??
                      defaultProjectFileIndexCopy.smartFormComplete ??
                      "Complete"
                    }
                    incompleteLabel={
                      projectFileCopy.smartFormIncomplete ??
                      defaultProjectFileIndexCopy.smartFormIncomplete ??
                      "Incomplete"
                    }
                  />
                ) : null}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground ring-1 ring-transparent transition hover:bg-[var(--brand-tint)] hover:text-primary hover:ring-primary/25 focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:outline-none"
                aria-label={formatWorkbenchCopy(
                  actionMenuCopy.triggerActionsFor ?? "Actions for {name}",
                  { name: displayName }
                )}
                onClick={(event) => {
                  const target = event.currentTarget;
                  const rect = target.getBoundingClientRect();
                  target.dispatchEvent(
                    new MouseEvent("contextmenu", {
                      bubbles: true,
                      cancelable: true,
                      clientX: rect.left + rect.width / 2,
                      clientY: rect.bottom + 4,
                    })
                  );
                }}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </ButtonGroup>
          );
        },
      },
      {
        id: "status",
        ...activeProjectFileColumnSizes.status,
        header: projectFileCopy.headers.status,
        meta: {
          autoSize: true,
          cellClassName: getProjectFileColumnClassName("status"),
          headerClassName: getProjectFileColumnClassName("status"),
          headerTitle: projectFileCopy.headers.status,
        },
        accessorFn: (row) =>
          getProjectFileStatusSortValue({
            row,
            currentUserId,
            activityCopy,
          }),
        sortingFn: (rowA, rowB) =>
          compareProjectFileSortValues(
            getProjectFileStatusSortValue({
              row: rowA.original,
              currentUserId,
              activityCopy,
            }),
            getProjectFileStatusSortValue({
              row: rowB.original,
              currentUserId,
              activityCopy,
            })
          ),
        cell: ({ row }) => {
          const fileRow = row.original;
          if (fileRow.kind === "workpaper") {
            return <span className="text-xs text-muted-foreground">-</span>;
          }

          const { attachment } = fileRow;
          const lockState = getAttachmentLockState(attachment, currentUserId);
          const desktopAgentSession = desktopAgentSessionByAttachment.get(
            attachment.id
          );

          return (
            <ProjectFileStatusLine
              mobile={isPhoneViewport}
              attachment={attachment}
              displayName={getProjectFileRowDisplayName(fileRow)}
              lockState={lockState}
              desktopAgentSession={desktopAgentSession}
              pending={pending}
              checkInDesktopSession={checkInDesktopSession}
              copy={activityCopy}
            />
          );
        },
      },
      {
        id: "notes",
        ...activeProjectFileColumnSizes.notes,
        header: projectFileCopy.headers.notes,
        enableResizing: false,
        meta: {
          cellClassName: getProjectFileColumnClassName(
            PROJECT_FILE_ISSUES_COLUMN_ID
          ),
          headerClassName: getProjectFileColumnClassName(
            PROJECT_FILE_ISSUES_COLUMN_ID
          ),
          headerTitle: projectFileCopy.headers.notes,
        },
        accessorFn: (row) => getProjectFileIssueCountSortValue(row, paperById),
        sortingFn: (rowA, rowB) =>
          compareProjectFileSortValues(
            getProjectFileIssueCountSortValue(rowA.original, paperById),
            getProjectFileIssueCountSortValue(rowB.original, paperById)
          ),
        cell: ({ row }) => {
          const fileRow = row.original;
          if (fileRow.kind === "workpaper") {
            const paper = getWorkpaperReviewSnapshot(fileRow.paper);
            const displayName = formatDisplayName(fileRow.paper.title);
            return (
              <ProjectFileNotesCell
                projectId={projectId}
                reviewQuestionsCopy={reviewQuestionsCopy}
                paper={paper}
                displayName={displayName}
                disabled={pending && !readOnly}
                readOnly={readOnly}
                currentUserId={currentUserId ?? null}
                currentProjectRole={currentProjectRole ?? null}
                workflow={workflow}
                onReviewQuestionsChanged={onReviewQuestionsChanged}
                onOpenReviewNotes={onOpenReviewNotes}
                target={{
                  key: `workpaper:${fileRow.paper.id}`,
                  kind: "workpaper",
                  paperId: fileRow.paper.id,
                  workflowNodeId: fileRow.paper.workflowNodeId,
                  bucket: fileRow.paper.bucket ?? "CURRENT",
                  reference: fileRow.displayRefCode || fileRow.paper.code,
                  displayName,
                }}
              />
            );
          }

          const { attachment } = fileRow;
          const paper = getProjectAttachmentReviewSnapshot(
            attachment,
            paperById,
            fileRow.paper
          );
          const displayName = getProjectFileRowDisplayName(fileRow);
          return (
            <ProjectFileNotesCell
              projectId={projectId}
              reviewQuestionsCopy={reviewQuestionsCopy}
              paper={paper}
              attachmentId={attachment.id}
              displayName={displayName}
              disabled={pending && !readOnly}
              readOnly={readOnly}
              currentUserId={currentUserId ?? null}
              currentProjectRole={currentProjectRole ?? null}
              workflow={workflow}
              onReviewQuestionsChanged={onReviewQuestionsChanged}
              onOpenReviewNotes={onOpenReviewNotes}
              target={{
                key: `attachment:${attachment.id}`,
                kind: "attachment",
                paperId: paper?.id ?? attachment.workingPaperId ?? "",
                attachmentId: attachment.id,
                workflowNodeId:
                  paper?.workflowNodeId ?? attachment.workflowNodeId,
                bucket: getProjectAttachmentBucket(attachment),
                reference: fileRow.displayRefCode,
                displayName,
              }}
            />
          );
        },
      },
      {
        id: "signoffs",
        ...activeProjectFileColumnSizes.signoffs,
        header: projectFileCopy.headers.signoffs,
        enableResizing: false,
        meta: {
          cellClassName: getProjectFileColumnClassName("signoffs"),
          headerClassName: getProjectFileColumnClassName("signoffs"),
          headerTitle: projectFileCopy.headers.signoffs,
        },
        accessorFn: (row) =>
          getProjectFileSignoffCountSortValue(row, paperById),
        sortingFn: (rowA, rowB) =>
          compareProjectFileSortValues(
            getProjectFileSignoffCountSortValue(rowA.original, paperById),
            getProjectFileSignoffCountSortValue(rowB.original, paperById)
          ),
        cell: ({ row }) => {
          const fileRow = row.original;
          if (fileRow.kind === "workpaper") {
            const paper = getWorkpaperReviewSnapshot(fileRow.paper);
            const displayName = formatDisplayName(fileRow.paper.title);
            const singleAttachmentId = getSingleAttachmentSignoffTarget(
              fileRow.paper
            );
            return (
              <ProjectFileSignoffActionCell
                paper={paper}
                signoffTargetId={singleAttachmentId ?? undefined}
                prepareSignoff={
                  singleAttachmentId ? prepareAttachment : undefined
                }
                reviewSignoff={
                  singleAttachmentId ? reviewAttachment : undefined
                }
                displayName={displayName}
                currentUserId={currentUserId ?? null}
                currentProjectRole={currentProjectRole ?? null}
                pending={pending || readOnly}
                canSignPreparer={canSignPreparer}
                prepareWorkingPaper={prepareWorkingPaper}
                reviewWorkingPaper={reviewWorkingPaper}
                removePreparationSignoff={removePreparationSignoff}
                copy={signoffStatusCopy}
                mobile={isPhoneViewport}
              />
            );
          }

          const { attachment } = fileRow;
          const paper = getProjectAttachmentReviewSnapshot(
            attachment,
            paperById,
            fileRow.paper
          );
          const displayName = getProjectFileRowDisplayName(fileRow);
          return (
            <ProjectFileSignoffActionCell
              paper={paper}
              signoffTargetId={attachment.id}
              prepareSignoff={prepareAttachment}
              reviewSignoff={reviewAttachment}
              displayName={displayName}
              currentUserId={currentUserId ?? null}
              currentProjectRole={currentProjectRole ?? null}
              pending={pending || readOnly}
              canSignPreparer={canSignPreparer}
              prepareWorkingPaper={prepareWorkingPaper}
              reviewWorkingPaper={reviewWorkingPaper}
              removePreparationSignoff={removePreparationSignoff}
              copy={signoffStatusCopy}
              mobile={isPhoneViewport}
            />
          );
        },
      },
    ],
    [
      actionMenuCopy,
      activeProjectFileColumnSizes,
      activityCopy,
      canSignPreparer,
      checkInDesktopSession,
      currentProjectRole,
      currentUserId,
      desktopAgentSessionByAttachment,
      downloadAttachment,
      downloadAttachmentReadOnly,
      emptySlotUploadCopy,
      fileMutationDisabled,
      isPhoneViewport,
      multiSelectEnabled,
      onOpenWorkpaper,
      onReviewQuestionsChanged,
      onOpenReviewNotes,
      onPreviewFile,
      onUploadFileToWorkpaper,
      openReadOnlyByDefault,
      paperById,
      pending,
      prepareAttachment,
      removePreparationSignoff,
      prepareWorkingPaper,
      projectId,
      projectFileCopy.smartFormComplete,
      projectFileCopy.smartFormIncomplete,
      readOnly,
      reviewAttachment,
      reviewWorkingPaper,
      signoffStatusCopy,
      onReplacePlaceholder,
      openAttachmentLocally,
      projectFileCopy.headers.notes,
      projectFileCopy.headers.refCode,
      projectFileCopy.headers.signoffs,
      projectFileCopy.headers.status,
      projectFileCopy.headers.title,
      projectFileCopy.openAsMaster,
      projectFileCopy.openWorkpaper,
      reviewQuestionsCopy,
      selectionCopy.selectAll,
      selectionCopy.selectRow,
      updateAttachmentIdentity,
      workflow,
    ]
  );

  const enableProjectFileMultiSelect = useCallback(() => {
    setSelectedProjectFileRowKey(null);
    setMultiSelectEnabled(true);
  }, []);
  const disableProjectFileMultiSelect = useCallback(() => {
    setMultiSelectEnabled(false);
  }, []);

  if (loading) {
    if (layout === "fill") {
      return (
        <section
          aria-label={projectFileCopy.title}
          className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background"
        >
          {toolbar}
          <PreviewLoadingState
            label={projectFileCopy.loading}
            className="min-h-0 flex-1"
          />
        </section>
      );
    }

    return (
      <PreviewLoadingState
        label={projectFileCopy.loading}
        className="min-h-32"
      />
    );
  }

  const getRowPresentation = (row: ProjectFileIndexRow) => {
    if (row.kind === "workpaper") {
      const isPrimaryHighlighted = highlightedProjectFileRowKey === row.key;
      const isMultiHighlighted = highlightedProjectFileRowKeySet.has(row.key);
      const isHighlighted = isPrimaryHighlighted || isMultiHighlighted;

      return {
        className: cn(
          "bg-card",
          isHighlighted &&
            "scroll-mt-16 scroll-mb-8 bg-[var(--brand-tint)] ring-1 ring-inset ring-primary/25"
        ),
        shouldAttachHighlightRef:
          isPrimaryHighlighted || (!highlightedPaperId && isMultiHighlighted),
      };
    }

    const { attachment } = row;
    const lockState = getAttachmentLockState(attachment, currentUserId);
    const isPrimaryHighlighted = highlightedProjectFileRowKey === row.key;
    const isMultiHighlighted = highlightedProjectFileRowKeySet.has(row.key);
    const isHighlighted = isPrimaryHighlighted || isMultiHighlighted;

    return {
      className: cn(
        isHighlighted
          ? "scroll-mt-16 scroll-mb-8 bg-[var(--brand-tint)] ring-1 ring-inset ring-primary/25"
          : lockState.isLockedByOther
            ? "bg-warning-subtle"
            : "bg-card"
      ),
      shouldAttachHighlightRef:
        isPrimaryHighlighted || (!highlightedPaperId && isMultiHighlighted),
    };
  };

  return (
    <section
      aria-label="Project files"
      onPointerDown={(event) =>
        clearCurrentProjectFileRowOnBlankTarget(event.target)
      }
      onContextMenu={(event) =>
        clearCurrentProjectFileRowOnBlankTarget(event.target)
      }
      className={cn(
        "bg-card",
        layout === "fill"
          ? "flex min-h-0 flex-1 flex-col overflow-hidden bg-background"
          : "grid gap-2 rounded-md p-3"
      )}
    >
      <div
        className={cn(
          "bg-background [container-type:size] [&_[data-slot=table-container]]:min-h-full [&_[data-slot=table-container]]:overflow-visible",
          layout === "fill"
            ? "min-h-0 flex-1 overflow-hidden"
            : "max-h-80 overflow-auto rounded-md border border-border"
        )}
      >
        <ProjectFileDataTable
          toolbar={toolbar}
          columns={projectFileColumns}
          columnVisibility={effectiveColumnVisibility}
          onColumnVisibilityChange={onColumnVisibilityChange}
          mobile={isPhoneViewport}
          mobileTitleSize={
            isPhoneViewport
              ? activeProjectFileColumnSizes.title.size
              : undefined
          }
          data={projectFileRows}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          copy={projectFileCopy}
          selectionScopeKey={selectionScopeKey}
          highlightedRowKeys={highlightedProjectFileRowKeys}
          multiSelectEnabled={multiSelectEnabled}
          onEnableMultiSelect={enableProjectFileMultiSelect}
          onDisableMultiSelect={disableProjectFileMultiSelect}
          getRowPresentation={getRowPresentation}
          selectedProjectFileRowKey={selectedProjectFileRowKey}
          setSelectedProjectFileRowKey={setSelectedProjectFileRowKey}
          highlightedFileRowRef={scrollHighlightedFileRow}
          renderAttachmentActionMenu={renderAttachmentActionMenu}
          onReorderAttachment={
            fileMutationDisabled || pending ? undefined : reorderAttachmentRow
          }
          onPreviewFile={onPreviewFile}
          onPrefetchAttachment={scheduleAttachmentPreviewPrefetch}
          onCancelPrefetchAttachment={cancelAttachmentPreviewPrefetch}
          onExportAttachments={onExportAttachments}
          onUploadFilesToBlank={
            !uploadFilesDisabled && !isFolderUploadNode
              ? onUploadFilesToNode
              : undefined
          }
          renderEmptyState={() => (
            <ProjectFileEmptyTray
              title={emptyTrayTitle ?? emptyTitle}
              description={emptyTrayDescription ?? emptyDescription}
            />
          )}
          renderBlankActionMenu={
            onChooseFilesToNode ||
            onCreatePlaceholder ||
            onCreateSmartForm ||
            onCreateFromTemplate ||
            (!readOnly && onPasteAttachmentClipboard)
              ? () => (
                  <ContextMenuContent className="w-44">
                    {onChooseFilesToNode ? (
                      <ProjectFileMenuItem
                        icon={<Upload className="h-4 w-4" />}
                        label={
                          projectFileCopy.emptyTray.uploadFiles ??
                          emptySlotUploadCopy.upload ??
                          defaultEmptySlotUploadCopy.upload ??
                          "Upload files"
                        }
                        onClick={onChooseFilesToNode}
                      />
                    ) : null}
                    {onCreatePlaceholder ? (
                      <ProjectFileMenuItem
                        icon={<FileIcon className="h-4 w-4" />}
                        label={
                          actionMenuCopy.createPlaceholder ?? "New placeholder"
                        }
                        disabled={pending || fileMutationDisabled}
                        onClick={onCreatePlaceholder}
                      />
                    ) : null}
                    {onCreateSmartForm ? (
                      <ProjectFileMenuItem
                        icon={<FileSpreadsheet className="h-4 w-4" />}
                        label={
                          actionMenuCopy.createSmartForm ?? "New Smart Form"
                        }
                        disabled={pending || fileMutationDisabled}
                        onClick={onCreateSmartForm}
                      />
                    ) : null}
                    {onCreateFromTemplate ? (
                      <ProjectFileMenuItem
                        icon={<LayoutTemplate className="h-4 w-4" />}
                        label={
                          actionMenuCopy.createFromTemplate ??
                          "New from template"
                        }
                        disabled={pending || fileMutationDisabled}
                        onClick={onCreateFromTemplate}
                      />
                    ) : null}
                    {(onChooseFilesToNode ||
                      onCreatePlaceholder ||
                      onCreateSmartForm ||
                      onCreateFromTemplate) &&
                    !readOnly &&
                    onPasteAttachmentClipboard ? (
                      <ContextMenuSeparator />
                    ) : null}
                    {!readOnly && onPasteAttachmentClipboard ? (
                      <ProjectFileMenuItem
                        icon={<ClipboardPaste className="h-4 w-4" />}
                        label={relocationCopy.paste ?? "Paste"}
                        disabled={pending || !attachmentClipboard}
                        onClick={onPasteAttachmentClipboard}
                      />
                    ) : null}
                  </ContextMenuContent>
                )
              : undefined
          }
          onClearSelection={onClearHighlightedPaper}
        />
      </div>
      <WorkbenchMoveToDialog
        open={Boolean(moveDialogFiles)}
        projectName={projectName}
        workflow={workflow ?? []}
        files={moveDialogFiles ?? []}
        copy={
          relocationCopy.moveToDialog ??
          defaultProjectFileIndexCopy.relocation.moveToDialog ?? {
            heading: "Move to",
            instructions: "Choose a destination folder",
            searchPlaceholder: "Search folders or files",
            filesAreLocations:
              "Files are shown for orientation and cannot be destinations",
            targetLocation: "Destination",
            currentLocation: "Current location",
            noResults: "No matching folders or files",
            expandFolder: "Expand",
            collapseFolder: "Collapse",
            cancel: "Cancel",
            moveHere: "Move here",
            close: "Close",
          }
        }
        disabled={pending || fileMutationDisabled || !onMoveAttachmentsToNode}
        onOpenChange={(open) => {
          if (!open) {
            setMoveDialogFiles(null);
          }
        }}
        onMove={(targetNode) => {
          if (!moveDialogFiles?.length || !onMoveAttachmentsToNode) {
            return;
          }
          onMoveAttachmentsToNode(moveDialogFiles, targetNode);
          setMoveDialogFiles(null);
        }}
      />
    </section>
  );
}

function shouldIgnoreProjectFileRowClick(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(
    target.closest(
      "button,a,input,select,textarea,label,[role='button'],[role='menuitem']"
    )
  );
}

function getProjectFileRowDisplayName(row: ProjectFileIndexRow) {
  return row.kind === "workpaper"
    ? formatDisplayName(row.paper.title)
    : getAttachmentDisplayName(row.attachment);
}

function getProjectFileRowHighlightIds(row: ProjectFileIndexRow) {
  if (row.kind === "workpaper") {
    return [row.paper.id];
  }
  const { attachment } = row;
  const location = attachment.workingPaper;
  return [
    attachment.id,
    location?.id,
    row.paper?.id,
    attachment.workingPaperId,
  ].filter((id): id is string => Boolean(id));
}

function resolveProjectFileRowHighlightKey(
  rows: ProjectFileIndexRow[],
  targetId: string
) {
  const exactRow = rows.find((row) =>
    row.kind === "workpaper"
      ? row.paper.id === targetId
      : row.attachment.id === targetId
  );
  if (exactRow) {
    return exactRow.key;
  }

  return (
    rows.find((row) => getProjectFileRowHighlightIds(row).includes(targetId))
      ?.key ?? null
  );
}

function ProjectFileRefCodeCell({
  row,
  disabled,
  mobile = false,
  onChangeRefcode,
}: {
  row: ProjectFileIndexRow;
  disabled: boolean;
  mobile?: boolean;
  onChangeRefcode: (attachmentId: string, code: string) => void;
}) {
  const displayCode = row.displayRefCode;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayCode);
  const committedRef = useRef(false);

  if (row.kind === "workpaper") {
    return (
      <span
        className={cn(
          "block min-w-0 font-medium text-foreground",
          mobile ? "truncate text-[11px] leading-4" : "truncate"
        )}
        title={displayCode}
      >
        {displayCode}
      </span>
    );
  }

  const displayName = getProjectFileRowDisplayName(row);
  const editLabel = `Edit refcode for ${displayName}`;
  const beginEdit = () => {
    if (disabled) {
      return;
    }
    committedRef.current = false;
    setDraft(displayCode);
    setEditing(true);
  };
  const commit = () => {
    if (committedRef.current) {
      return;
    }
    committedRef.current = true;
    const nextCode = draft.trim();
    setEditing(false);
    if (!nextCode || nextCode === displayCode) {
      setDraft(displayCode);
      return;
    }
    onChangeRefcode(row.attachment.id, nextCode);
  };
  const cancel = () => {
    committedRef.current = true;
    setDraft(displayCode);
    setEditing(false);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  };

  if (editing) {
    return (
      <Input
        aria-label={editLabel}
        autoFocus
        className={cn(
          "h-7 min-w-0 px-2 py-1 text-sm font-medium",
          mobile && "text-xs"
        )}
        value={draft}
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
      />
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="default"
      aria-label={editLabel}
      disabled={disabled}
      className={cn(
        "block w-full min-w-0 rounded-sm text-left font-medium text-foreground underline-offset-4 transition hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:pointer-events-none disabled:text-muted-foreground disabled:no-underline",
        mobile
          ? "h-7 min-h-7 truncate px-0 py-1 text-[11px] leading-4"
          : "truncate",
        !displayCode && "text-muted-foreground"
      )}
      title={displayCode || undefined}
      onClick={beginEdit}
    >
      {displayCode || "-"}
    </Button>
  );
}

function compareProjectFileSortValues(
  leftValue: string | number,
  rightValue: string | number
) {
  if (typeof leftValue === "number" && typeof rightValue === "number") {
    return leftValue - rightValue;
  }

  return String(leftValue).localeCompare(String(rightValue), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function getProjectFileRefCodeSortValue(row: ProjectFileIndexRow) {
  if (row.kind === "workpaper") {
    return row.paper.code;
  }
  return (
    row.attachment.code ??
    row.attachment.workingPaper?.code ??
    row.paper?.code ??
    ""
  );
}

function getProjectAttachmentFileTransfer(
  attachment: ProjectAttachment,
  fileName: string
): DirectoryFileTransfer | null {
  const location = attachment.workingPaper;
  if (!location?.id || !location.workflowNodeId) {
    return null;
  }
  return {
    attachmentId: attachment.id,
    bucket: getProjectAttachmentBucket(attachment),
    fileName,
    nodeId: location.workflowNodeId,
    paperId: location.id,
  };
}

function getProjectFileStatusSortValue({
  row,
  currentUserId,
  activityCopy,
}: {
  row: ProjectFileIndexRow;
  currentUserId?: string | null;
  activityCopy: NonNullable<WorkbenchProjectFileIndexCopy["activity"]>;
}) {
  if (row.kind === "workpaper") {
    return "";
  }

  const lockState = getAttachmentLockState(row.attachment, currentUserId);
  return (
    getAttachmentBusinessActivity(row.attachment, lockState, activityCopy)
      ?.label ?? ""
  );
}

function getProjectFileReviewSnapshot(
  row: ProjectFileIndexRow,
  paperById: Map<string, WorkingPaperRecord>
) {
  return row.kind === "workpaper"
    ? getWorkpaperReviewSnapshot(row.paper)
    : getProjectAttachmentReviewSnapshot(row.attachment, paperById, row.paper);
}

function getProjectFileIssueCountSortValue(
  row: ProjectFileIndexRow,
  paperById: Map<string, WorkingPaperRecord>
) {
  const questions =
    getProjectFileReviewSnapshot(row, paperById)?.reviewQuestions ?? [];
  const indicatorQuestions = getNotesIndicatorQuestions(
    questions,
    row.kind === "attachment" ? row.attachment.id : undefined
  );
  return indicatorQuestions.filter((question) => question.status !== "CLEARED")
    .length;
}

function getProjectFileSignoffCountSortValue(
  row: ProjectFileIndexRow,
  paperById: Map<string, WorkingPaperRecord>
) {
  return getProjectFileReviewSnapshot(row, paperById)?.signoffs?.length ?? 0;
}

type ProjectFileRowPresentation = {
  className?: string;
  shouldAttachHighlightRef?: boolean;
};

function getProjectFileColumnIds(columns: ColumnDef<ProjectFileIndexRow>[]) {
  return columns
    .map((column) => column.id)
    .filter((columnId): columnId is string => Boolean(columnId));
}

function getProjectFileColumnClassName(columnId: string, mobile = false) {
  const className =
    projectFileColumnClassNames[columnId] ??
    PROJECT_FILE_TEXT_COLUMN_INSET_CLASS;

  if (!mobile) {
    return className;
  }

  if (columnId === "refCode") {
    return cn(
      className,
      "!overflow-visible !text-clip !whitespace-normal px-1.5"
    );
  }

  if (columnId === "title") {
    return cn(
      className,
      "!overflow-visible !text-clip !whitespace-normal px-2 py-1"
    );
  }

  if (columnId === "signoffs") {
    return cn(className, "px-1");
  }

  return className;
}

function getProjectFileColumnHeaderLabel({
  columnId,
  headerContent,
  headersCopy,
  selectionCopy,
}: {
  columnId: string;
  headerContent: ReactNode;
  headersCopy: WorkbenchProjectFileIndexCopy["headers"];
  selectionCopy: NonNullable<WorkbenchProjectFileIndexCopy["selection"]>;
}) {
  if (columnId === PROJECT_FILE_SELECT_COLUMN_ID) {
    return selectionCopy.selectAll;
  }
  if (typeof headerContent === "string") {
    return headerContent;
  }

  const headerLabels: Record<string, string> = {
    refCode: headersCopy.refCode,
    title: headersCopy.title,
    actions: headersCopy.actions,
    status: headersCopy.status,
    notes: headersCopy.notes,
    signoffs: headersCopy.signoffs,
  };

  return headerLabels[columnId] ?? columnId;
}

function getInitialProjectFileRefCodeColumnSize(
  data: ProjectFileIndexRow[],
  mobile = false
) {
  if (mobile) {
    return MOBILE_PROJECT_FILE_REF_CODE_COLUMN_SIZE;
  }
  const contentWidth = data.reduce(
    (widestWidth, row) =>
      Math.max(
        widestWidth,
        [...row.displayRefCode].length * PROJECT_FILE_REF_CODE_CHARACTER_SIZE +
          PROJECT_FILE_REF_CODE_CONTENT_INSET_SIZE
      ),
    projectFileColumnSizes.refCode?.size ??
      PROJECT_FILE_REF_CODE_COLUMN_MIN_SIZE
  );

  return Math.min(
    PROJECT_FILE_REF_CODE_COLUMN_MAX_INITIAL_SIZE,
    Math.max(PROJECT_FILE_REF_CODE_COLUMN_MIN_SIZE, contentWidth)
  );
}

function getInitialProjectFileColumnSizing(
  columnIds: string[],
  data: ProjectFileIndexRow[] = [],
  mobile = false,
  mobileTitleSize?: number
) {
  return columnIds.reduce<ColumnSizingState>((columnSizing, columnId) => {
    columnSizing[columnId] =
      columnId === "refCode"
        ? getInitialProjectFileRefCodeColumnSize(data, mobile)
        : columnId === "title" && mobile && mobileTitleSize !== undefined
          ? mobileTitleSize
          : ((mobile ? mobileProjectFileColumnSizes : projectFileColumnSizes)[
              columnId
            ]?.size ?? 150);
    return columnSizing;
  }, {});
}

function ProjectFileDataTable({
  toolbar,
  columns,
  columnVisibility,
  onColumnVisibilityChange,
  data,
  emptyTitle,
  emptyDescription,
  copy,
  selectionScopeKey,
  highlightedRowKeys = EMPTY_DEFAULT_ARRAY,
  multiSelectEnabled,
  onEnableMultiSelect,
  onDisableMultiSelect,
  getRowPresentation,
  selectedProjectFileRowKey,
  setSelectedProjectFileRowKey,
  highlightedFileRowRef,
  renderAttachmentActionMenu,
  onReorderAttachment,
  onPreviewFile,
  onPrefetchAttachment,
  onCancelPrefetchAttachment,
  onExportAttachments,
  onUploadFilesToBlank,
  renderEmptyState,
  renderBlankActionMenu,
  onClearSelection,
  mobile = false,
  mobileTitleSize,
}: {
  toolbar?: ReactNode;
  columns: ColumnDef<ProjectFileIndexRow>[];
  columnVisibility: ColumnVisibilityState;
  onColumnVisibilityChange: (
    updater: ProjectFileColumnVisibilityUpdater
  ) => void;
  data: ProjectFileIndexRow[];
  emptyTitle: string;
  emptyDescription: string;
  copy: WorkbenchProjectFileIndexCopy;
  selectionScopeKey?: string;
  highlightedRowKeys?: string[];
  multiSelectEnabled: boolean;
  onEnableMultiSelect: () => void;
  onDisableMultiSelect: () => void;
  getRowPresentation: (row: ProjectFileIndexRow) => ProjectFileRowPresentation;
  selectedProjectFileRowKey: string | null;
  setSelectedProjectFileRowKey: (rowKey: string | null) => void;
  highlightedFileRowRef: (row: HTMLTableRowElement | null) => void;
  renderAttachmentActionMenu: (
    attachment: ProjectAttachment,
    selectedAttachments: ProjectAttachment[],
    numberedDisplayName?: string,
    onEnableMultiSelect?: () => void,
    isMultiSelectAction?: boolean,
    mobileSheet?: MobileFileActionSheetState
  ) => ReactNode;
  onReorderAttachment?: (
    workflowNodeId: string,
    bucket: WorkingPaperBucket,
    attachmentId: string,
    targetAttachmentId: string,
    position: AttachmentInsertionPosition
  ) => void;
  onPreviewFile?: (attachmentId: string) => void;
  onPrefetchAttachment?: (attachment: ProjectAttachment) => void;
  onCancelPrefetchAttachment?: () => void;
  onExportAttachments?: (attachmentIds: string[]) => void;
  onUploadFilesToBlank?: (files: File[]) => void | Promise<void>;
  renderEmptyState?: () => ReactNode;
  renderBlankActionMenu?: () => ReactNode;
  onClearSelection?: () => void;
  mobile?: boolean;
  mobileTitleSize?: number;
}) {
  const columnIds = useMemo(() => getProjectFileColumnIds(columns), [columns]);
  const isMobile = useCompactViewport(767);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [mobileActionFileKey, setMobileActionFileKey] = useState<string | null>(
    null
  );
  const [mobileSearch, setMobileSearch] = useState("");
  const [mobileVisibleCount, setMobileVisibleCount] = useState(40);
  const mobileCopy =
    copy.mobileNavigation ?? getEmpMobileNavigationCopy("en-US");
  useEffect(() => {
    setMobileVisibleCount(40);
    setMobileSearch("");
    setMobileActionFileKey(null);
  }, [selectionScopeKey]);
  const initialColumnSizing = useMemo(
    () =>
      getInitialProjectFileColumnSizing(
        columnIds,
        data,
        mobile,
        mobileTitleSize
      ),
    [columnIds, data, mobile, mobileTitleSize]
  );
  const [columnSizing, setColumnSizing] =
    useState<ColumnSizingState>(initialColumnSizing);
  const previousMobileRef = useRef(mobile);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const activeColumnFilters = useMemo(
    () => (isMobile ? [] : columnFilters),
    [isMobile, columnFilters]
  );
  const appliedHighlightedSelectionKeyRef = useRef<string | null>(null);
  const selectionCopy = copy.selection ?? defaultProjectFileIndexCopy.selection;
  const columnMenuCopy =
    copy.columnMenu ?? defaultProjectFileIndexCopy.columnMenu;
  const highlightedRowSelectionKey = highlightedRowKeys.join("\u0000");

  useEffect(() => {
    if (previousMobileRef.current === mobile) {
      return;
    }
    previousMobileRef.current = mobile;
    setColumnSizing(initialColumnSizing);
  }, [initialColumnSizing, mobile]);

  useEffect(() => {
    if (!mobile || columnSizing.title === initialColumnSizing.title) {
      return;
    }
    setColumnSizing((current) => ({
      ...current,
      title: initialColumnSizing.title,
    }));
  }, [columnSizing.title, initialColumnSizing.title, mobile]);

  useEffect(() => {
    if (multiSelectEnabled) {
      return;
    }
    setRowSelection({});
  }, [multiSelectEnabled]);
  useEffect(() => {
    appliedHighlightedSelectionKeyRef.current = null;
    setRowSelection({});
    onDisableMultiSelect();
    setSelectedProjectFileRowKey(null);
  }, [onDisableMultiSelect, selectionScopeKey, setSelectedProjectFileRowKey]);
  useEffect(() => {
    if (!highlightedRowSelectionKey) {
      if (!appliedHighlightedSelectionKeyRef.current) {
        return;
      }
      appliedHighlightedSelectionKeyRef.current = null;
      setRowSelection({});
      onDisableMultiSelect();
      return;
    }
    const rowKeys = highlightedRowSelectionKey.split("\u0000");
    appliedHighlightedSelectionKeyRef.current = highlightedRowSelectionKey;
    onEnableMultiSelect();
    setSelectedProjectFileRowKey(null);
    setRowSelection(
      Object.fromEntries(rowKeys.map((rowKey) => [rowKey, true]))
    );
  }, [
    highlightedRowSelectionKey,
    onDisableMultiSelect,
    onEnableMultiSelect,
    setSelectedProjectFileRowKey,
  ]);
  const table = useReactTable({
    data,
    columns,
    state: {
      columnFilters: activeColumnFilters,
      globalFilter: isMobile ? mobileSearch : "",
      columnSizing,
      columnVisibility,
      rowSelection,
      sorting,
    },
    defaultColumn: {
      filterFn: projectWingSelectedValuesFilter,
    },
    getColumnCanGlobalFilter: (column) => column.id === "title",
    globalFilterFn: (row, _columnId, value: string) =>
      `${getProjectFileRowDisplayName(row.original)} ${row.original.displayRefCode}`
        .toLocaleLowerCase()
        .includes(value.trim().toLocaleLowerCase()),
    onColumnFiltersChange: setColumnFilters,
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    getCoreRowModel: getCoreRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.key,
  });
  const attachmentIdsByDirectory = useMemo(() => {
    const idsByDirectory = new Map<string, string[]>();
    for (const row of data) {
      if (row.kind !== "attachment") {
        continue;
      }
      const workflowNodeId =
        row.attachment.workingPaper?.workflowNodeId ??
        row.attachment.workflowNodeId;
      const bucket = row.attachment.bucket ?? "CURRENT";
      if (!workflowNodeId) {
        continue;
      }
      const key = getDirectoryAttachmentScopeKey(workflowNodeId, bucket);
      const attachmentIds = idsByDirectory.get(key) ?? [];
      attachmentIds.push(row.attachment.id);
      idsByDirectory.set(key, attachmentIds);
    }
    return idsByDirectory;
  }, [data]);
  const sortableAttachmentIds = useMemo(
    () =>
      data
        .filter(
          (row): row is Extract<ProjectFileIndexRow, { kind: "attachment" }> =>
            row.kind === "attachment"
        )
        .map((row) => getWorkbenchFileSortableId(row.attachment.id)),
    [data]
  );
  const [attachmentInsertionTarget, setAttachmentInsertionTarget] = useState<{
    attachmentId: string;
    position: AttachmentInsertionPosition;
  } | null>(null);
  const attachmentInsertionTargetRef = useRef<{
    attachmentId: string;
    position: AttachmentInsertionPosition;
  } | null>(null);
  const [draggedAttachmentId, setDraggedAttachmentId] = useState<string | null>(
    null
  );
  const resolveAttachmentInsertionTarget = (
    event: DragMoveEvent | DragEndEvent
  ) => {
    const active = event.active.data.current;
    const over = event.over?.data.current;
    if (
      active?.type !== WORKBENCH_FILE_DRAG_TYPE ||
      over?.type !== WORKBENCH_FILE_DRAG_TYPE ||
      over.reorderTarget !== true ||
      active.workflowNodeId !== over.workflowNodeId ||
      active.bucket !== over.bucket ||
      typeof active.attachmentId !== "string" ||
      typeof over.attachmentId !== "string" ||
      active.attachmentId === over.attachmentId
    ) {
      return null;
    }
    const activeRect = event.active.rect.current.translated;
    const overRect = event.over?.rect;
    const position =
      activeRect &&
      overRect &&
      activeRect.top + activeRect.height / 2 >=
        overRect.top + overRect.height / 2
        ? "after"
        : "before";
    const attachmentIds =
      attachmentIdsByDirectory.get(
        getDirectoryAttachmentScopeKey(active.workflowNodeId, active.bucket)
      ) ?? [];
    if (
      !changesAttachmentOrder({
        attachmentIds,
        sourceAttachmentId: active.attachmentId,
        targetAttachmentId: over.attachmentId,
        position,
      })
    ) {
      return null;
    }
    return { attachmentId: over.attachmentId, position } as const;
  };
  const setResolvedAttachmentInsertionTarget = (
    target: {
      attachmentId: string;
      position: AttachmentInsertionPosition;
    } | null
  ) => {
    const { current } = attachmentInsertionTargetRef;
    if (
      current?.attachmentId === target?.attachmentId &&
      current?.position === target?.position
    ) {
      return;
    }
    attachmentInsertionTargetRef.current = target;
    setAttachmentInsertionTarget(target);
  };
  useDndMonitor({
    onDragStart: (event) => {
      const active = event.active.data.current;
      setDraggedAttachmentId(
        active?.type === WORKBENCH_FILE_DRAG_TYPE &&
          typeof active.attachmentId === "string"
          ? active.attachmentId
          : null
      );
    },
    onDragMove: (event) => {
      setResolvedAttachmentInsertionTarget(
        resolveAttachmentInsertionTarget(event)
      );
    },
    onDragCancel: () => {
      setResolvedAttachmentInsertionTarget(null);
      setDraggedAttachmentId(null);
    },
    onDragEnd: (event) => {
      const target = resolveAttachmentInsertionTarget(event);
      setResolvedAttachmentInsertionTarget(null);
      setDraggedAttachmentId(null);
      const active = event.active.data.current;
      if (
        !onReorderAttachment ||
        !target ||
        typeof active?.attachmentId !== "string" ||
        typeof active.workflowNodeId !== "string" ||
        typeof active.bucket !== "string"
      ) {
        return;
      }
      onReorderAttachment(
        active.workflowNodeId,
        active.bucket as WorkingPaperBucket,
        active.attachmentId,
        target.attachmentId,
        target.position
      );
    },
  });
  const selectedAttachments = table
    .getSelectedRowModel()
    .rows.map((row) => row.original)
    .filter(
      (row): row is Extract<ProjectFileIndexRow, { kind: "attachment" }> =>
        row.kind === "attachment"
    )
    .map((row) => row.attachment)
    .filter(
      (attachment, index, selected) =>
        selected.findIndex((item) => item.id === attachment.id) === index
    );
  const selectedRowCount = table.getSelectedRowModel().rows.length;
  const totalRowCount = table.getRowModel().rows.length;
  const clearProjectFileSelection = useCallback(() => {
    setRowSelection({});
    setSelectedProjectFileRowKey(null);
    onClearSelection?.();
    if (multiSelectEnabled) {
      onDisableMultiSelect();
    }
  }, [
    multiSelectEnabled,
    onClearSelection,
    onDisableMultiSelect,
    setSelectedProjectFileRowKey,
  ]);
  const exitMultiSelectLabel =
    selectionCopy.exitMultiSelect ??
    defaultProjectFileIndexCopy.selection.exitMultiSelect ??
    "Exit multi-select";
  const exitMultiSelect = useCallback(() => {
    setRowSelection({});
    onDisableMultiSelect();
  }, [onDisableMultiSelect]);
  const showMultiSelectToolbar = multiSelectEnabled && totalRowCount > 0;
  const selectedRowsSummary = formatWorkbenchCopy(selectionCopy.selectedRows, {
    selected: selectedRowCount,
    total: totalRowCount,
  });
  const renderResolvedEmptyState = () =>
    renderEmptyState ? (
      renderEmptyState()
    ) : (
      <div className="flex min-h-[max(28rem,calc(100cqh-3rem-1px))] flex-col items-center justify-center px-6 py-12 text-center">
        <ProjectWingDevLogo
          alt=""
          className="h-44 w-44 shrink-0 opacity-[0.14]"
        />
        <h3 className="mt-8 text-base font-semibold text-foreground">
          {emptyTitle}
        </h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {emptyDescription}
        </p>
      </div>
    );
  const handleSharedGridRowClick = (projectFileRow: ProjectFileIndexRow) => {
    const row = table.getRow(projectFileRow.key);
    if (multiSelectEnabled) {
      row.toggleSelected(!row.getIsSelected());
      return;
    }
    if (
      projectFileRow.kind === "attachment" &&
      !projectFileRow.attachment.placeholderType
    ) {
      onPreviewFile?.(projectFileRow.attachment.id);
    }
    setSelectedProjectFileRowKey(
      selectedProjectFileRowKey === projectFileRow.key
        ? null
        : projectFileRow.key
    );
  };
  const getSharedGridRowClassName = (projectFileRow: ProjectFileIndexRow) => {
    const row = table.getRow(projectFileRow.key);
    const presentation = getRowPresentation(projectFileRow);
    const isCurrent =
      !multiSelectEnabled && selectedProjectFileRowKey === projectFileRow.key;

    return cn(
      "transition-colors",
      draggedAttachmentId
        ? "bg-transparent shadow-none hover:bg-transparent"
        : "hover:bg-[var(--brand-tint-soft)]",
      (multiSelectEnabled || projectFileRow.kind === "attachment") &&
        "cursor-pointer",
      presentation.className,
      (row.getIsSelected() || isCurrent) &&
        "bg-[var(--brand-tint)] shadow-[inset_3px_0_0_color-mix(in_srgb,var(--primary)_52%,transparent)]"
    );
  };
  const projectFileHeader = (
    <DataGridTableHead>
      {table.getHeaderGroups().map((headerGroup) => (
        <DataGridTableHeadRow key={headerGroup.id} rowId={headerGroup.id}>
          {headerGroup.headers.map((header) => {
            const headerContent = header.isPlaceholder
              ? null
              : flexRender(header.column.columnDef.header, header.getContext());
            const headerLabel = getProjectFileColumnHeaderLabel({
              columnId: header.column.id,
              headerContent,
              headersCopy: copy.headers,
              selectionCopy,
            });
            const hasColumnMenu =
              header.column.id !== PROJECT_FILE_SELECT_COLUMN_ID &&
              header.column.id !== PROJECT_FILE_ACTIONS_COLUMN_ID;
            const headerAccessibleName = header.column.getCanSort()
              ? formatWorkbenchCopy(selectionCopy.sortColumn, {
                  name: headerLabel,
                })
              : headerLabel;
            const sortDirection = header.column.getIsSorted();
            const sortIcon = header.column.getCanSort() ? (
              sortDirection === "desc" ? (
                <ArrowDown aria-hidden="true" className="size-3.25 shrink-0" />
              ) : sortDirection === "asc" ? (
                <ArrowUp aria-hidden="true" className="size-3.25 shrink-0" />
              ) : (
                <ChevronsUpDown
                  aria-hidden="true"
                  className="size-3.25 shrink-0 opacity-60"
                />
              )
            ) : null;
            const handlePhoneHeaderSort = () => {
              if (!header.column.getCanSort()) {
                return;
              }
              const currentSortDirection = header.column.getIsSorted();
              if (currentSortDirection === "asc") {
                header.column.toggleSorting(true);
              } else if (currentSortDirection === "desc") {
                header.column.clearSorting();
              } else {
                header.column.toggleSorting(false);
              }
            };
            const phoneHeader = (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={headerAccessibleName}
                className={cn(
                  "h-full w-full min-w-0 justify-center gap-1 overflow-hidden rounded-none px-0 text-xs font-normal text-secondary-foreground/80 transition-[background-color,color,box-shadow] duration-150 ease-out hover:bg-secondary hover:text-foreground focus-visible:bg-secondary/70",
                  sortDirection &&
                    "bg-secondary/55 text-foreground shadow-[inset_0_-2px_0_var(--primary)]",
                  "[&_svg]:transition-[color,opacity,transform] [&_svg]:duration-150 [&_svg]:ease-out",
                  sortDirection && "[&_svg]:text-primary [&_svg]:opacity-100"
                )}
                data-testid={`phone-project-file-header-${header.column.id}`}
                data-sort-direction={sortDirection || "none"}
                disabled={!header.column.getCanSort()}
                onClick={handlePhoneHeaderSort}
                title={headerLabel}
              >
                <span className="block min-w-0 truncate">{headerLabel}</span>
                {sortIcon}
              </Button>
            );
            const desktopHeader = (
              <div
                className={cn(
                  "flex h-full w-full min-w-0 items-center rounded-md transition-[background-color,box-shadow] duration-150 ease-out hover:bg-secondary/55 focus-within:bg-secondary/70",
                  sortDirection &&
                    "bg-secondary/55 shadow-[inset_0_-2px_0_var(--primary)]",
                  "[&_button]:transition-[background-color,color,box-shadow] [&_button]:duration-150 [&_button]:ease-out",
                  "[&_button_svg]:transition-[color,opacity,transform] [&_button_svg]:duration-150 [&_button_svg]:ease-out",
                  sortDirection &&
                    "[&_button_svg]:text-primary [&_button_svg]:opacity-100"
                )}
                data-sort-direction={sortDirection || "none"}
              >
                <ProjectWingMasterDataGridColumnHeader
                  accessibleName={headerAccessibleName}
                  column={header.column}
                  copy={columnMenuCopy}
                  title={headerLabel}
                />
              </div>
            );

            return (
              <DataGridTableHeadRowCell key={header.id} header={header}>
                {mobile && hasColumnMenu ? (
                  header.column.id === PROJECT_FILE_ISSUES_COLUMN_ID ? (
                    <div className="emp-project-file-notes-header emp-project-file-notes-header-phone">
                      {phoneHeader}
                    </div>
                  ) : (
                    phoneHeader
                  )
                ) : hasColumnMenu ? (
                  header.column.id === PROJECT_FILE_ISSUES_COLUMN_ID ? (
                    <div className="emp-project-file-notes-header">
                      {desktopHeader}
                    </div>
                  ) : (
                    desktopHeader
                  )
                ) : (
                  headerContent
                )}
                {header.column.id === PROJECT_FILE_ISSUES_COLUMN_ID ? (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 end-0 w-px bg-border"
                    data-slot="project-file-fixed-column-divider"
                  />
                ) : null}
                {header.column.getCanResize() ? (
                  <DataGridTableHeadRowCellResize header={header} />
                ) : null}
              </DataGridTableHeadRowCell>
            );
          })}
          <DataGridTableFillHeadCell />
        </DataGridTableHeadRow>
      ))}
    </DataGridTableHead>
  );
  const renderProjectFileRow: DataGridTableVirtualRowRenderer<
    ProjectFileIndexRow
  > = ({ row, rowRef }) => {
    const presentation = getRowPresentation(row.original);
    const isCurrent =
      !multiSelectEnabled && selectedProjectFileRowKey === row.original.key;
    const applyRowRef = (node: HTMLTableRowElement | null) => {
      rowRef?.(node);
      if (presentation.shouldAttachHighlightRef) {
        highlightedFileRowRef(node);
      }
    };
    const rowElement = (
      <DataGridTableBodyRow
        className={mobile ? "[&>td]:align-top" : undefined}
        data-state={isCurrent ? "selected" : undefined}
        onContextMenu={(event) => {
          if (shouldIgnoreProjectFileRowClick(event.target)) {
            return;
          }
          if (!multiSelectEnabled) {
            setSelectedProjectFileRowKey(row.original.key);
          }
        }}
        onPointerEnter={() => {
          if (row.original.kind === "attachment") {
            onPrefetchAttachment?.(row.original.attachment);
          }
        }}
        onPointerLeave={onCancelPrefetchAttachment}
        row={row}
        rowRef={row.original.kind === "attachment" ? undefined : applyRowRef}
      >
        {row.getVisibleCells().map((cell) => {
          const cellContent =
            typeof cell.column.columnDef.cell === "function"
              ? cell.column.columnDef.cell(cell.getContext())
              : flexRender(cell.column.columnDef.cell, cell.getContext());

          return (
            <DataGridTableBodyRowCell key={cell.id} cell={cell}>
              {cell.column.id === PROJECT_FILE_ISSUES_COLUMN_ID ? (
                <div className="flex w-full items-center justify-center">
                  {cellContent}
                </div>
              ) : (
                cellContent
              )}
            </DataGridTableBodyRowCell>
          );
        })}
        <DataGridTableFillBodyCell />
      </DataGridTableBodyRow>
    );
    const startMultiSelect = () => {
      onEnableMultiSelect();
      setRowSelection({ [row.id]: true });
    };

    if (row.original.kind !== "attachment") {
      return (
        <ContextMenu>
          <ContextMenuTrigger render={rowElement} />
          <ContextMenuContent className="w-44">
            <ContextMenuItem onClick={startMultiSelect}>
              {copy.actionMenu?.multiSelect ?? "Multi-select"}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      );
    }

    const contextAttachments = multiSelectEnabled
      ? selectedAttachments
      : [row.original.attachment];
    const displayName = getProjectFileRowDisplayName(row.original);
    const insertionPosition =
      attachmentInsertionTarget?.attachmentId === row.original.attachment.id
        ? attachmentInsertionTarget.position
        : null;

    return (
      <ProjectFileAttachmentRow
        attachment={row.original.attachment}
        fileName={displayName}
        insertionPosition={insertionPosition}
        rowElement={rowElement}
        rowRef={applyRowRef}
        sortable={
          Boolean(onReorderAttachment) &&
          !multiSelectEnabled &&
          sorting.length === 0
        }
      >
        {renderAttachmentActionMenu(
          row.original.attachment,
          contextAttachments,
          displayName,
          startMultiSelect,
          multiSelectEnabled
        )}
      </ProjectFileAttachmentRow>
    );
  };
  const renderProjectFileDropZone = (empty: boolean) => {
    const dropZone = (
      <ProjectFileBlankDropZone
        onUploadFiles={onUploadFilesToBlank}
        className={
          empty
            ? "relative flex min-h-[max(28rem,calc(100cqh-3rem-1px))] w-[100cqw] items-center justify-center bg-[var(--workbench-panel)] px-5 py-10"
            : "min-h-[max(24rem,calc(100vh-16rem))]"
        }
      >
        {empty ? renderResolvedEmptyState() : null}
      </ProjectFileBlankDropZone>
    );
    const row = (
      <TableRow
        aria-hidden={empty ? undefined : true}
        className="h-full border-0 hover:bg-transparent hover:!shadow-none"
        onClick={clearProjectFileSelection}
      >
        <TableCell
          colSpan={table.getVisibleLeafColumns().length}
          className="h-full p-0"
        >
          {dropZone}
        </TableCell>
      </TableRow>
    );

    return renderBlankActionMenu ? (
      <ContextMenu>
        <ContextMenuTrigger render={row} />
        {renderBlankActionMenu()}
      </ContextMenu>
    ) : (
      row
    );
  };

  if (isMobile) {
    const { rows } = table.getRowModel();
    const highlightedIndex = rows.findLastIndex((row) =>
      highlightedRowKeys.includes(row.id)
    );
    const visibleCount = Math.max(mobileVisibleCount, highlightedIndex + 1);
    return (
      <DataGrid
        table={table}
        recordCount={totalRowCount}
        locale={mobileCopy.locale}
      >
        <section
          className="flex h-full min-h-0 flex-col"
          data-testid="emp-mobile-file-list"
        >
          <div className="emp-mobile-file-toolbar flex shrink-0 items-center justify-end gap-2">
            {showMultiSelectToolbar ? null : (
              <div className="emp-mobile-file-search">
                <Search aria-hidden="true" />
                <Input
                  type="search"
                  aria-label={mobileCopy.fileSearch}
                  placeholder={mobileCopy.fileSearch}
                  value={mobileSearch}
                  onChange={(event) => {
                    setMobileSearch(event.target.value);
                    setMobileVisibleCount(40);
                  }}
                />
                {mobileSearch ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={mobileCopy.clear}
                    onClick={() => setMobileSearch("")}
                  >
                    <X aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            )}
            {showMultiSelectToolbar ? (
              <>
                <Checkbox
                  aria-label={selectionCopy.selectAll}
                  checked={table.getIsAllRowsSelected()}
                  indeterminate={
                    table.getIsSomeRowsSelected() &&
                    !table.getIsAllRowsSelected()
                  }
                  onCheckedChange={(checked) =>
                    table.toggleAllRowsSelected(checked)
                  }
                />
                <span className="mr-auto text-sm">{selectedRowsSummary}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selectedAttachments.length || !onExportAttachments}
                  onClick={() =>
                    onExportAttachments?.(
                      selectedAttachments.map((item) => item.id)
                    )
                  }
                >
                  <Archive />
                </Button>
                <Button variant="ghost" size="sm" onClick={exitMultiSelect}>
                  {exitMultiSelectLabel}
                </Button>
              </>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              aria-label={mobileCopy.controls}
              onClick={() => setMobileToolsOpen(true)}
            >
              <MoreHorizontal />
            </Button>
          </div>
          <div className="emp-mobile-file-scroll min-h-0 flex-1 overflow-y-auto">
            {rows.slice(0, visibleCount).map((row) => {
              const file = row.original;
              const name = getProjectFileRowDisplayName(file);
              // Match the desktop renderer: a column callback is not a component
              // type. Remounting it would discard open notes/signoff dialogs.
              const renderMobileCell = (
                cell: ReturnType<typeof row.getAllCells>[number]
              ) =>
                typeof cell.column.columnDef.cell === "function"
                  ? cell.column.columnDef.cell(cell.getContext())
                  : flexRender(cell.column.columnDef.cell, cell.getContext());
              const cellContent = (id: string) => {
                const cell = row
                  .getAllCells()
                  .find((item) => item.column.id === id);
                return cell ? renderMobileCell(cell) : null;
              };
              const startMultiSelect = () => {
                onEnableMultiSelect();
                setRowSelection({ [row.id]: true });
              };
              const item = (
                <article
                  className="emp-mobile-file-row"
                  data-selected={
                    row.getIsSelected() ||
                    selectedProjectFileRowKey === file.key ||
                    undefined
                  }
                >
                  {multiSelectEnabled ? (
                    <div className="px-3 pt-2">
                      {cellContent(PROJECT_FILE_SELECT_COLUMN_ID)}
                    </div>
                  ) : null}
                  {file.kind === "workpaper" ||
                  file.attachment.placeholderType ? (
                    <div className="py-2">{cellContent("title")}</div>
                  ) : (
                    <MobileListItem
                      title={name}
                      showChevron={false}
                      icon={
                        <ProjectWingFileTypeIcon
                          fileName={file.attachment.fileName}
                        />
                      }
                      href="#preview"
                      onNavigate={(event) => {
                        event.preventDefault();
                        event.currentTarget.blur();
                        handleSharedGridRowClick(file);
                      }}
                      action={
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`${mobileCopy.fileDetails}: ${name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setMobileActionFileKey(file.key);
                          }}
                        >
                          <MoreHorizontal />
                        </Button>
                      }
                    />
                  )}
                  <div className="emp-mobile-file-metadata">
                    <div className="emp-mobile-file-reference-group">
                      <span className="emp-mobile-file-reference">
                        {file.displayRefCode}
                      </span>
                      {file.kind === "attachment"
                        ? cellContent("status")
                        : null}
                    </div>
                    {row
                      .getVisibleCells()
                      .filter(
                        (cell) =>
                          ![
                            "title",
                            "refCode",
                            PROJECT_FILE_SELECT_COLUMN_ID,
                          ].includes(cell.column.id)
                      )
                      .map((cell) => (
                        <div
                          key={cell.id}
                          className="emp-mobile-file-cell min-w-0 text-sm"
                          data-file-column={cell.column.id}
                        >
                          <span className="sr-only">
                            {cell.column.columnDef.meta?.headerTitle}
                          </span>
                          {renderMobileCell(cell)}
                        </div>
                      ))}
                  </div>
                </article>
              );
              return (
                <ContextMenu
                  key={row.id}
                  open={file.kind === "attachment" ? false : undefined}
                  onOpenChange={(open) => {
                    if (open && file.kind === "attachment") {
                      setMobileActionFileKey(file.key);
                    }
                  }}
                >
                  <ContextMenuTrigger render={item} />
                  {file.kind === "attachment" ? (
                    renderAttachmentActionMenu(
                      file.attachment,
                      multiSelectEnabled
                        ? selectedAttachments
                        : [file.attachment],
                      name,
                      startMultiSelect,
                      multiSelectEnabled,
                      {
                        open: mobileActionFileKey === file.key,
                        onOpenChange: (open) =>
                          setMobileActionFileKey(open ? file.key : null),
                        closeLabel: mobileCopy.close,
                      }
                    )
                  ) : (
                    <ContextMenuContent>
                      <ContextMenuItem onClick={startMultiSelect}>
                        {copy.actionMenu?.multiSelect ?? "Multi-select"}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  )}
                </ContextMenu>
              );
            })}
            {rows.length ? null : mobileSearch.trim() ? (
              <p
                role="status"
                className="py-6 text-center text-sm text-muted-foreground"
              >
                {mobileCopy.noMatchingFiles}
              </p>
            ) : (
              renderResolvedEmptyState()
            )}
            {rows.length > visibleCount ? (
              <Button
                variant="outline"
                className="my-3"
                onClick={() => setMobileVisibleCount(visibleCount + 40)}
              >
                {mobileCopy.loadMore}
              </Button>
            ) : null}
          </div>
          <MobileActionSheet
            open={mobileToolsOpen}
            onOpenChange={setMobileToolsOpen}
            title={mobileCopy.controls}
            closeLabel={mobileCopy.close}
          >
            <div className="emp-mobile-file-tools">
              {toolbar}
              {renderBlankActionMenu ? (
                <ContextMenu>
                  <ContextMenuTrigger
                    render={
                      <Button
                        variant="outline"
                        className="emp-mobile-file-create"
                        onClick={(event) => {
                          const rect =
                            event.currentTarget.getBoundingClientRect();
                          event.currentTarget.dispatchEvent(
                            new MouseEvent("contextmenu", {
                              bubbles: true,
                              cancelable: true,
                              clientX: rect.left,
                              clientY: rect.bottom,
                            })
                          );
                        }}
                      >
                        <Plus />
                        {mobileCopy.addFiles}
                      </Button>
                    }
                  />
                  {renderBlankActionMenu()}
                </ContextMenu>
              ) : null}
              <div className="emp-mobile-file-display">
                <ProjectFileColumnVisibilityMenu
                  visibility={columnVisibility}
                  onVisibilityChange={onColumnVisibilityChange}
                  copy={copy}
                  label={mobileCopy.showInformation}
                />
              </div>
            </div>
          </MobileActionSheet>
        </section>
      </DataGrid>
    );
  }

  return (
    <DataGrid
      emptyMessage={emptyDescription}
      onRowClick={handleSharedGridRowClick}
      recordCount={totalRowCount}
      rowClassName={getSharedGridRowClassName}
      table={table}
      tableLayout={{
        cellBorder: false,
        columnsResizable: true,
        columnsResizeMode: "onChange",
        headerSticky: true,
        rowBorder: true,
        rowRounded: false,
        width: "fixed",
      }}
    >
      <Frame
        className="h-full min-h-0 w-full max-w-full min-w-0 overflow-hidden [&_td]:border-border [&_th]:border-border"
        data-testid="project-file-data-grid"
        dense
        stacked
      >
        {toolbar}
        <FramePanel className="min-h-0 p-0 shadow-none">
          <div className="flex h-full min-w-0 flex-col">
            {showMultiSelectToolbar ? (
              <div
                data-testid="project-file-multi-select-toolbar"
                className="flex shrink-0 items-center justify-between gap-3 border-b border-primary/20 bg-primary/5 px-3 py-1.5 text-xs"
              >
                <span className="min-w-0 truncate font-medium text-primary">
                  {selectedRowsSummary}
                </span>
                <ButtonGroup>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 px-2 text-xs"
                    disabled={
                      selectedAttachments.length === 0 || !onExportAttachments
                    }
                    onClick={() =>
                      onExportAttachments?.(
                        selectedAttachments.map((attachment) => attachment.id)
                      )
                    }
                  >
                    <Archive className="h-3.5 w-3.5" />
                    {formatWorkbenchCopy(
                      selectionCopy.exportSelected ??
                        "Export selected ({count})",
                      { count: selectedAttachments.length }
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 px-2 text-xs"
                    onClick={exitMultiSelect}
                  >
                    {exitMultiSelectLabel}
                  </Button>
                </ButtonGroup>
              </div>
            ) : null}
            <DataGridScrollArea orientation="both" className="h-full min-h-0">
              <DataGridTableVirtual
                bodyFooter={
                  table.getRowModel().rows.length > 0
                    ? renderProjectFileDropZone(false)
                    : undefined
                }
                estimateSize={mobile ? 72 : 49}
                headerContent={projectFileHeader}
                overscan={6}
                renderEmptyState={() => renderProjectFileDropZone(true)}
                renderRow={renderProjectFileRow}
                virtualizerOptions={{
                  enabled: process.env.NODE_ENV !== "test",
                }}
                wrapBody={(body) => (
                  <SortableContext
                    items={sortableAttachmentIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {body}
                  </SortableContext>
                )}
              />
            </DataGridScrollArea>
          </div>
        </FramePanel>
      </Frame>
    </DataGrid>
  );
}

type ProjectFileRowElementProps = {
  className?: string;
  dndRef?: (node: HTMLTableRowElement | null) => void;
  dndStyle?: CSSProperties;
  [key: string]: unknown;
};

function ProjectFileAttachmentRow({
  attachment,
  fileName,
  rowElement,
  rowRef,
  sortable,
  insertionPosition,
  children,
}: {
  attachment: ProjectAttachment;
  fileName: string;
  rowElement: ReactElement<ProjectFileRowElementProps>;
  rowRef?: (node: HTMLTableRowElement | null) => void;
  sortable: boolean;
  insertionPosition: AttachmentInsertionPosition | null;
  children: ReactNode;
}) {
  const workingPaperId =
    attachment.workingPaper?.id ?? attachment.workingPaperId ?? null;
  const workflowNodeId =
    attachment.workingPaper?.workflowNodeId ??
    attachment.workflowNodeId ??
    null;
  const { listeners, setActivatorNodeRef, setNodeRef, isDragging } =
    useSortable({
      id: getWorkbenchFileSortableId(attachment.id),
      disabled: {
        draggable: !workflowNodeId,
        droppable: !sortable || !workflowNodeId,
      },
      data: {
        type: WORKBENCH_FILE_DRAG_TYPE,
        reorderTarget: sortable,
        attachmentId: attachment.id,
        fileName,
        workingPaperId,
        workflowNodeId:
          attachment.workingPaper?.workflowNodeId ?? attachment.workflowNodeId,
        bucket:
          attachment.bucket ?? attachment.workingPaper?.bucket ?? "CURRENT",
      },
    });
  const draggableRow = cloneElement(rowElement, {
    dndRef: (node: HTMLTableRowElement | null) => {
      setNodeRef(node);
      setActivatorNodeRef(node);
      rowRef?.(node);
    },
    dndStyle: isDragging ? { opacity: 0.45 } : undefined,
    "data-dnd-sortable": sortable ? "true" : "false",
    "data-attachment-insertion": insertionPosition ?? undefined,
    className: cn(
      rowElement.props.className,
      "cursor-pointer touch-none select-none",
      isDragging && "opacity-45",
      insertionPosition === "before" &&
        "[&>td]:border-t-2 [&>td]:border-primary",
      insertionPosition === "after" && "[&>td]:border-b-2 [&>td]:border-primary"
    ),
  });
  return (
    <ContextMenu>
      <ContextMenuTrigger {...listeners} render={draggableRow} />
      {children}
    </ContextMenu>
  );
}

function reorderProjectAttachments(
  attachments: ProjectAttachment[],
  input: {
    workflowNodeId: string;
    bucket: WorkingPaperBucket;
    attachmentIds: string[];
  }
) {
  const attachmentsById = new Map(
    attachments
      .filter(
        (attachment) =>
          (attachment.workingPaper?.workflowNodeId ??
            attachment.workflowNodeId) === input.workflowNodeId &&
          (attachment.bucket ??
            attachment.workingPaper?.bucket ??
            "CURRENT") === input.bucket
      )
      .map((attachment) => [attachment.id, attachment])
  );
  let nextIndex = 0;
  return attachments.map((attachment) => {
    const isSameDirectory =
      (attachment.workingPaper?.workflowNodeId ?? attachment.workflowNodeId) ===
        input.workflowNodeId &&
      (attachment.bucket ?? attachment.workingPaper?.bucket ?? "CURRENT") ===
        input.bucket;
    if (!isSameDirectory) {
      return attachment;
    }
    const nextAttachment = attachmentsById.get(
      input.attachmentIds[(nextIndex += 1)] ?? ""
    );
    return nextAttachment
      ? { ...nextAttachment, sortOrder: nextIndex - 1 }
      : attachment;
  });
}

function getDirectoryAttachmentScopeKey(
  workflowNodeId: string,
  bucket: WorkingPaperBucket
) {
  return `${workflowNodeId}:${bucket}`;
}

const WORKBENCH_FILE_BLANK_UPLOAD_DROPPABLE_ID =
  "workbench-file-blank-upload-dropzone";
const WORKBENCH_LOCAL_FILE_UPLOAD_TARGET_TYPE =
  "workbench-local-file-upload-target";

function containsNativeFiles(dataTransfer: DataTransfer) {
  return (
    [...(dataTransfer.types ?? [])].includes("Files") ||
    [...(dataTransfer.files ?? [])].length > 0
  );
}

function stopNativeFileDrag(event: DragEvent<HTMLDivElement>) {
  event.preventDefault();
  event.stopPropagation();
}

function useNativeFileDrop(
  onUploadFiles?: (files: File[]) => void | Promise<void>
) {
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const handleDragMove = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!containsNativeFiles(event.dataTransfer)) {
        return;
      }
      stopNativeFileDrag(event);
      event.dataTransfer.dropEffect = onUploadFiles ? "copy" : "none";
      setIsDraggingFiles(Boolean(onUploadFiles));
    },
    [onUploadFiles]
  );
  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!containsNativeFiles(event.dataTransfer)) {
      return;
    }
    stopNativeFileDrag(event);
    const { relatedTarget } = event;
    if (
      relatedTarget instanceof Node &&
      event.currentTarget.contains(relatedTarget)
    ) {
      return;
    }
    setIsDraggingFiles(false);
  }, []);
  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!containsNativeFiles(event.dataTransfer)) {
        return;
      }
      stopNativeFileDrag(event);
      setIsDraggingFiles(false);
      const files = [...(event.dataTransfer.files ?? [])];
      if (!onUploadFiles || files.length === 0) {
        return;
      }
      void Promise.resolve(onUploadFiles(files)).catch(console.error);
    },
    [onUploadFiles]
  );
  return {
    isDraggingFiles,
    onDragEnter: handleDragMove,
    onDragOver: handleDragMove,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  };
}

function ProjectFileBlankDropZone({
  children,
  className,
  onUploadFiles,
}: {
  children?: ReactNode;
  className?: string;
  onUploadFiles?: (files: File[]) => void | Promise<void>;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: WORKBENCH_FILE_BLANK_UPLOAD_DROPPABLE_ID,
    disabled: !onUploadFiles,
    data: { type: WORKBENCH_LOCAL_FILE_UPLOAD_TARGET_TYPE },
  });
  const { isDraggingFiles, ...nativeFileDropProps } =
    useNativeFileDrop(onUploadFiles);

  return (
    <div
      ref={setNodeRef}
      data-testid="project-file-blank-context-target"
      data-dnd-droppable={onUploadFiles ? "true" : "false"}
      data-dnd-over={isOver ? "true" : undefined}
      data-native-file-over={isDraggingFiles ? "true" : undefined}
      aria-disabled={!onUploadFiles}
      {...nativeFileDropProps}
      className={cn(
        "transition-colors",
        isDraggingFiles &&
          "bg-primary/[0.04] ring-1 ring-inset ring-primary/30",
        className
      )}
    >
      {children}
    </div>
  );
}

function ProjectFileEmptyTray({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      data-testid="project-file-empty-tray"
      className="relative z-10 flex min-h-[15rem] w-full max-w-[32rem] -translate-y-6 flex-col items-center justify-center rounded-sm bg-transparent px-4 py-4 text-center"
    >
      <div
        data-testid="project-file-empty-hero-icon"
        className="pointer-events-none flex items-center justify-center"
        aria-hidden="true"
      >
        <ProjectWingDevLogo
          alt=""
          className="h-36 w-36 opacity-[0.18] dark:opacity-[0.24]"
        />
      </div>
      <div className="mt-5 min-w-0">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-2 max-w-[34rem] text-sm leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

type PaperReviewSnapshot = Pick<
  WorkingPaperRecord,
  | "id"
  | "code"
  | "title"
  | "workflowNodeId"
  | "signoffs"
  | "reviewQuestions"
  | "preparedAt"
  | "preparerId"
  | "preparer"
  | "reviewedAt"
  | "reviewerId"
  | "reviewer"
>;

function getProjectAttachmentReviewSnapshot(
  attachment: ProjectAttachment,
  paperById: Map<string, WorkingPaperRecord>,
  knownPaper?: WorkingPaperRecord
): PaperReviewSnapshot | null {
  const location = attachment.workingPaper;
  const fallback =
    knownPaper ??
    (location?.id ? paperById.get(location.id) : undefined) ??
    (attachment.workingPaperId
      ? paperById.get(attachment.workingPaperId)
      : undefined) ??
    null;

  if (!location) {
    return fallback ? getWorkpaperReviewSnapshot(fallback) : null;
  }

  if (location.signoffs || location.reviewQuestions) {
    return {
      ...fallback,
      id: location.id,
      code: location.code,
      title: location.title,
      workflowNodeId: location.workflowNodeId,
      signoffs: location.signoffs ?? fallback?.signoffs,
      reviewQuestions: location.reviewQuestions ?? fallback?.reviewQuestions,
    };
  }

  return (
    fallback ?? {
      id: location.id,
      code: location.code,
      title: location.title,
      workflowNodeId: location.workflowNodeId,
      signoffs: [],
      reviewQuestions: [],
      preparedAt: undefined,
      preparerId: undefined,
      preparer: undefined,
      reviewedAt: undefined,
      reviewerId: undefined,
      reviewer: undefined,
    }
  );
}

function getWorkpaperReviewSnapshot(
  paper: WorkingPaperRecord
): PaperReviewSnapshot {
  return {
    id: paper.id,
    code: paper.code,
    title: paper.title,
    workflowNodeId: paper.workflowNodeId,
    signoffs: paper.signoffs ?? [],
    reviewQuestions: paper.reviewQuestions ?? [],
    preparedAt: paper.preparedAt,
    preparerId: paper.preparerId,
    preparer: paper.preparer,
    reviewedAt: paper.reviewedAt,
    reviewerId: paper.reviewerId,
    reviewer: paper.reviewer,
  };
}

export function getSingleAttachmentSignoffTarget(
  paper: Pick<WorkingPaperRecord, "attachments">
) {
  return paper.attachments?.length === 1
    ? (paper.attachments[0]?.id ?? null)
    : null;
}

function SmartFormReviewQuestionsController({
  projectId,
  attachmentId,
  fileName,
  target,
  initialQuestionId,
  questions,
  workflow,
  paper,
  currentUserId,
  currentProjectRole,
  readOnly,
  copy,
  onChanged,
  onQuestionChanged,
}: {
  projectId: string;
  attachmentId: string;
  fileName: string;
  target: SmartFormV2ReviewTarget;
  initialQuestionId?: string;
  questions: WorkingPaperQuestion[];
  workflow: WorkflowNode[];
  paper: WorkingPaperRecord | null;
  currentUserId: string | null;
  currentProjectRole: ProjectRole | null;
  readOnly: boolean;
  copy: WorkbenchReviewQuestionsCopy;
  onChanged: () => void | Promise<void>;
  onQuestionChanged: (question: WorkingPaperQuestion) => void;
}) {
  const canReview = Boolean(currentProjectRole) && !readOnly;
  const [startInCreateMode, setStartInCreateMode] = useState(
    () => !initialQuestionId
  );
  void setStartInCreateMode;
  const members = useQuery({
    queryKey: ["members", projectId],
    queryFn: () => api.members(projectId),
    enabled: canReview && Boolean(currentUserId),
  });
  const targetQuestions = useMemo(
    () =>
      questions.filter(
        (question) =>
          question.smartFormNodeId === target.nodeId &&
          (question.smartFormRowId ?? undefined) === target.rowId
      ),
    [questions, target]
  );
  const refresh = () => {
    Promise.resolve(onChanged()).catch((error) => {
      console.error("Failed to refresh SmartForm review questions", error);
    });
  };
  const mergeAndRefresh = (question: WorkingPaperQuestion) => {
    onQuestionChanged(question);
    refresh();
  };
  const createQuestion = useMutation({
    mutationFn: (input: {
      body: string;
      assignedToId?: string;
      referencedWorkingPaperIds?: string[];
    }) =>
      api.createAttachmentQuestion(projectId, attachmentId, {
        ...input,
        smartFormNodeId: target.nodeId,
        smartFormRowId: target.rowId,
        smartFormTargetLabel: target.label,
      }),
    onSuccess: mergeAndRefresh,
  });
  const replyQuestion = useMutation({
    mutationFn: ({
      questionId,
      payload,
    }: {
      questionId: string;
      payload: ReviewQuestionReplyPayload;
    }) => api.replyWorkingPaperQuestion(projectId, questionId, payload),
    onSuccess: mergeAndRefresh,
  });
  const markRepliedQuestion = useMutation({
    mutationFn: (questionId: string) =>
      api.markWorkingPaperQuestionReplied(projectId, questionId),
    onSuccess: mergeAndRefresh,
  });
  const clearQuestion = useMutation({
    mutationFn: (questionId: string) =>
      api.clearWorkingPaperQuestion(projectId, questionId),
    onSuccess: mergeAndRefresh,
  });
  const followUpQuestion = useMutation({
    mutationFn: ({ questionId, body }: { questionId: string; body: string }) =>
      api.followUpWorkingPaperQuestion(projectId, questionId, { body }),
    onSuccess: mergeAndRefresh,
  });
  const reopenQuestion = useMutation({
    mutationFn: ({ questionId, body }: { questionId: string; body: string }) =>
      api.reopenWorkingPaperQuestion(projectId, questionId, { body }),
    onSuccess: mergeAndRefresh,
  });
  const pending =
    createQuestion.isPending ||
    replyQuestion.isPending ||
    markRepliedQuestion.isPending ||
    clearQuestion.isPending ||
    followUpQuestion.isPending ||
    reopenQuestion.isPending;

  return (
    <ReviewQuestionsPanel
      copy={copy}
      canReview={canReview}
      currentUserId={currentUserId}
      members={members.data ?? []}
      questions={targetQuestions}
      workflow={workflow}
      defaultPaperId={paper?.id}
      defaultPaper={
        paper
          ? {
              id: paper.id,
              code: paper.code,
              title: paper.title,
              workflowNodeId: paper.workflowNodeId,
            }
          : undefined
      }
      contextTitle={fileName}
      contextCode={paper?.code}
      startInCreateMode={startInCreateMode}
      initialQuestionId={initialQuestionId}
      autoOpen
      hideTrigger
      filterQuestionsByPaper={false}
      pending={pending}
      createQuestion={(input) => createQuestion.mutateAsync(input)}
      replyQuestion={(questionId, payload) =>
        replyQuestion.mutateAsync({ questionId, payload })
      }
      uploadQuestionImage={(questionId, file) =>
        api.uploadReviewQuestionImage(projectId, questionId, file)
      }
      attachInitialQuestionFiles={(questionId, images) =>
        api
          .attachWorkingPaperQuestionInitialMessage(
            projectId,
            questionId,
            images
          )
          .then((question) => {
            mergeAndRefresh(question);
            return question;
          })
      }
      downloadQuestionImage={(imageId) =>
        api.downloadReviewQuestionImage(projectId, imageId)
      }
      markRepliedQuestion={(questionId) =>
        markRepliedQuestion.mutate(questionId)
      }
      clearQuestion={(questionId) => clearQuestion.mutate(questionId)}
      followUpQuestion={(questionId, body) =>
        followUpQuestion.mutate({ questionId, body })
      }
      reopenQuestion={(questionId, body) =>
        reopenQuestion.mutateAsync({ questionId, body })
      }
    />
  );
}

type ProjectFileNotesCellProps = {
  projectId: string;
  reviewQuestionsCopy?: WorkbenchReviewQuestionsCopy;
  paper: PaperReviewSnapshot | null;
  attachmentId?: string;
  displayName: string;
  disabled: boolean;
  readOnly?: boolean;
  currentUserId: string | null;
  currentProjectRole: ProjectRole | null;
  workflow?: WorkflowNode[];
  onReviewQuestionsChanged?: () => void | Promise<void>;
  onOpenReviewNotes?: (target: WorkbenchReviewNotesTarget) => void;
  target: WorkbenchReviewNotesTarget;
};

function ProjectFileNotesCell({
  paper,
  displayName,
  disabled,
  onOpenReviewNotes,
  target,
  ...dialogProps
}: ProjectFileNotesCellProps) {
  const indicatorQuestions = getNotesIndicatorQuestions(
    paper?.reviewQuestions ?? [],
    onOpenReviewNotes ? target.attachmentId : undefined
  );
  const issueCount = indicatorQuestions.length;
  const issueSummary = getProjectFileIssueSummary(indicatorQuestions);
  const issueState = getProjectFileIssueState(indicatorQuestions);
  const issueStatus = getProjectFileIssueStatus(issueSummary);
  const statusLabels =
    dialogProps.reviewQuestionsCopy?.statusLabels ??
    defaultReviewQuestionsCopy.statusLabels;

  if (onOpenReviewNotes) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 rounded-full border border-border bg-background p-0 text-muted-foreground transition hover:border-primary/30 hover:bg-surface hover:text-primary"
        aria-label={`${getProjectFileIssueLabel(issueCount)} for ${displayName}`}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onOpenReviewNotes(target);
        }}
      >
        <ProjectFileIssueIndicator
          count={issueCount}
          state={issueState}
          status={issueStatus}
          summary={issueSummary}
          statusLabels={statusLabels}
        />
      </Button>
    );
  }

  return (
    <ProjectFileNotesDialogCell
      {...dialogProps}
      paper={paper}
      displayName={displayName}
      disabled={disabled}
      target={target}
      fileLevelReviewQuestions={indicatorQuestions}
      issueCount={issueCount}
      issueState={issueState}
    />
  );
}

function getNotesIndicatorQuestions(
  questions: WorkingPaperQuestion[],
  attachmentId?: string
) {
  return attachmentId
    ? questions.filter(
        (question) =>
          !question.attachmentId || question.attachmentId === attachmentId
      )
    : getFileLevelReviewQuestions(questions);
}

function ProjectFileNotesDialogCell({
  projectId,
  reviewQuestionsCopy = defaultReviewQuestionsCopy,
  paper,
  attachmentId,
  displayName,
  disabled,
  readOnly = false,
  currentUserId,
  currentProjectRole,
  workflow,
  onReviewQuestionsChanged,
  fileLevelReviewQuestions,
  issueCount,
  issueState,
}: ProjectFileNotesCellProps & {
  fileLevelReviewQuestions: WorkingPaperQuestion[];
  issueCount: number;
  issueState: ProjectFileIssueState;
}) {
  const issueSummary = getProjectFileIssueSummary(fileLevelReviewQuestions);
  const issueStatus = getProjectFileIssueStatus(issueSummary);
  const { statusLabels } = reviewQuestionsCopy;
  const canReview = Boolean(currentProjectRole) && !readOnly;
  const members = useQuery({
    queryKey: ["members", projectId],
    queryFn: () => api.members(projectId),
    enabled: canReview && Boolean(currentUserId),
  });
  const refreshReviewQuestions = () => {
    Promise.resolve(onReviewQuestionsChanged?.()).catch((error) => {
      console.error("Failed to refresh review questions", error);
    });
  };
  const createQuestion = useMutation({
    mutationFn: (input: {
      body: string;
      assignedToId?: string;
      paperId?: string;
      referencedWorkingPaperIds?: string[];
    }) => {
      if (readOnly) {
        throw new Error("Archived projects are read-only.");
      }
      if (attachmentId) {
        return api.createAttachmentQuestion(projectId, attachmentId, {
          body: input.body,
          assignedToId: input.assignedToId ?? "",
          referencedWorkingPaperIds: input.referencedWorkingPaperIds,
        });
      }
      const targetPaperId = input.paperId || paper?.id;
      if (!targetPaperId) {
        throw new Error("Working paper is not available.");
      }
      return api.createWorkingPaperQuestion(projectId, targetPaperId, {
        body: input.body,
        assignedToId: input.assignedToId ?? "",
        referencedWorkingPaperIds: input.referencedWorkingPaperIds,
      });
    },
    onSuccess: refreshReviewQuestions,
  });
  const replyQuestion = useMutation({
    mutationFn: ({
      questionId,
      payload,
    }: {
      questionId: string;
      payload: ReviewQuestionReplyPayload;
    }) => {
      if (readOnly) {
        throw new Error("Archived projects are read-only.");
      }
      return api.replyWorkingPaperQuestion(projectId, questionId, payload);
    },
    onSuccess: refreshReviewQuestions,
  });
  const markRepliedQuestion = useMutation({
    mutationFn: (questionId: string) =>
      readOnly
        ? Promise.reject(new Error("Archived projects are read-only."))
        : api.markWorkingPaperQuestionReplied(projectId, questionId),
    onSuccess: refreshReviewQuestions,
  });
  const clearQuestion = useMutation({
    mutationFn: (questionId: string) =>
      readOnly
        ? Promise.reject(new Error("Archived projects are read-only."))
        : api.clearWorkingPaperQuestion(projectId, questionId),
    onSuccess: refreshReviewQuestions,
  });
  const followUpQuestion = useMutation({
    mutationFn: ({ questionId, body }: { questionId: string; body: string }) =>
      readOnly
        ? Promise.reject(new Error("Archived projects are read-only."))
        : api.followUpWorkingPaperQuestion(projectId, questionId, { body }),
    onSuccess: refreshReviewQuestions,
  });
  const reopenQuestion = useMutation({
    mutationFn: ({ questionId, body }: { questionId: string; body: string }) =>
      readOnly
        ? Promise.reject(new Error("Archived projects are read-only."))
        : api.reopenWorkingPaperQuestion(projectId, questionId, { body }),
    onSuccess: refreshReviewQuestions,
  });
  const reviewQuestionPending =
    disabled ||
    readOnly ||
    createQuestion.isPending ||
    replyQuestion.isPending ||
    markRepliedQuestion.isPending ||
    clearQuestion.isPending ||
    followUpQuestion.isPending ||
    reopenQuestion.isPending;

  return (
    <ReviewQuestionsPanel
      className="inline-flex size-7 items-center justify-center rounded-full border border-border bg-background p-0 text-muted-foreground transition hover:border-primary/30 hover:bg-surface hover:text-primary disabled:pointer-events-none disabled:opacity-45"
      copy={reviewQuestionsCopy}
      canReview={canReview}
      currentUserId={currentUserId}
      members={members.data ?? []}
      questions={fileLevelReviewQuestions}
      workflow={workflow ?? []}
      defaultPaperId={paper?.id ?? undefined}
      defaultPaper={
        paper
          ? {
              id: paper.id,
              code: paper.code,
              title: paper.title || displayName,
              workflowNodeId: paper.workflowNodeId,
            }
          : undefined
      }
      trigger={
        <ProjectFileIssueIndicator
          count={issueCount}
          state={issueState}
          status={issueStatus}
          summary={issueSummary}
          statusLabels={statusLabels}
        />
      }
      triggerAriaLabel={`${getProjectFileIssueLabel(issueCount)} for ${displayName}`}
      startInCreateMode={issueCount <= 0}
      pending={reviewQuestionPending}
      createQuestion={(input) => createQuestion.mutateAsync(input)}
      replyQuestion={(questionId, payload) =>
        replyQuestion.mutateAsync({ questionId, payload })
      }
      uploadQuestionImage={(questionId, file) =>
        readOnly
          ? Promise.reject(new Error("Archived projects are read-only."))
          : api.uploadReviewQuestionImage(projectId, questionId, file)
      }
      attachInitialQuestionFiles={(questionId, images) =>
        api
          .attachWorkingPaperQuestionInitialMessage(
            projectId,
            questionId,
            images
          )
          .then((question) => {
            refreshReviewQuestions();
            return question;
          })
      }
      downloadQuestionImage={(imageId) =>
        api.downloadReviewQuestionImage(projectId, imageId)
      }
      markRepliedQuestion={(questionId) =>
        markRepliedQuestion.mutate(questionId)
      }
      clearQuestion={(questionId) => clearQuestion.mutate(questionId)}
      followUpQuestion={(questionId, body) =>
        followUpQuestion.mutate({ questionId, body })
      }
      reopenQuestion={(questionId, body) =>
        reopenQuestion.mutateAsync({ questionId, body })
      }
    />
  );
}

function ProjectFileColumnVisibilityMenu({
  visibility,
  onVisibilityChange,
  copy,
  label,
}: {
  visibility: ColumnVisibilityState;
  onVisibilityChange: (updater: ProjectFileColumnVisibilityUpdater) => void;
  copy: WorkbenchProjectFileIndexCopy;
  label?: string;
}) {
  const menuCopy =
    copy.columnVisibility ?? defaultProjectFileIndexCopy.columnVisibility;
  const columnOptions: {
    id: ProjectFileOptionalColumnId;
    label: string;
  }[] = [
    { id: "status", label: copy.headers.status },
    { id: "notes", label: copy.headers.notes },
    { id: "signoffs", label: copy.headers.signoffs },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <MotionButton
            type="button"
            variant="secondary"
            size="xs"
            className={cn(
              "cursor-pointer",
              label ? "emp-mobile-file-display-trigger" : "size-6.5 px-0"
            )}
            aria-label={label ?? menuCopy.trigger}
          />
        }
      >
        <ListFilter data-icon="inline-start" />
        {label ? <span>{label}</span> : null}
        {label ? <ChevronRight aria-hidden="true" /> : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {columnOptions.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={visibility[column.id] !== false}
            closeOnClick={false}
            onCheckedChange={(checked) =>
              onVisibilityChange((current) => ({
                ...current,
                [column.id]: checked === true,
              }))
            }
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          closeOnClick={false}
          onClick={() =>
            onVisibilityChange({
              ...DEFAULT_PROJECT_FILE_COLUMN_VISIBILITY,
            })
          }
        >
          {menuCopy.showAll}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BucketTabs({
  activeBucket,
  onActiveBucketChange,
  bucketLabels,
  bucketTitles,
  ariaLabel,
  showTemporaryFiles = true,
  mobile = false,
}: {
  activeBucket: WorkingPaperBucket;
  onActiveBucketChange: (bucket: WorkingPaperBucket) => void;
  bucketLabels: Record<WorkingPaperBucket, string>;
  bucketTitles?: Record<WorkingPaperBucket, string>;
  ariaLabel: string;
  showTemporaryFiles?: boolean;
  mobile?: boolean;
}) {
  const tabs: { bucket: WorkingPaperBucket; label: string }[] = [
    { bucket: "CURRENT", label: bucketLabels.CURRENT },
    { bucket: "PRIOR", label: bucketLabels.PRIOR },
    ...(showTemporaryFiles
      ? [{ bucket: "TEMPORARY" as const, label: bucketLabels.TEMPORARY }]
      : []),
  ];

  return (
    <Tabs
      aria-label={ariaLabel}
      data-emp-file-buckets=""
      className="flex w-auto"
      value={activeBucket}
      onValueChange={(bucket) =>
        onActiveBucketChange(bucket as WorkingPaperBucket)
      }
    >
      <TabsList className="flex h-8 w-auto items-center rounded-full border border-border/70 bg-transparent p-0.5">
        {tabs.map((tab, index) => (
          <Fragment key={tab.bucket}>
            <TabsTrigger
              value={tab.bucket}
              title={bucketTitles?.[tab.bucket] ?? tab.label}
              className={
                mobile
                  ? "font-semibold text-foreground/60 data-active:text-primary"
                  : "h-full min-w-[3.25rem] rounded-sm border border-transparent px-2 !text-xs !font-semibold text-foreground/60 data-active:!bg-transparent data-active:text-primary data-active:!shadow-none"
              }
            >
              {tab.label}
            </TabsTrigger>
            {index < tabs.length - 1 ? (
              <Separator
                orientation="vertical"
                className="my-1.5 bg-border/70"
              />
            ) : null}
          </Fragment>
        ))}
      </TabsList>
    </Tabs>
  );
}

function BulkFileActions({
  disabled,
  label,
  onUpload,
  mobile = false,
}: {
  disabled: boolean;
  label: string;
  onUpload: () => void;
  mobile?: boolean;
}) {
  return (
    <div data-testid="workbench-bulk-file-actions" className="shrink-0">
      <MotionButton
        type="button"
        variant="primary"
        size={mobile ? "md" : "xs"}
        className="cursor-pointer"
        disabled={disabled}
        onClick={onUpload}
      >
        <Upload data-icon="inline-start" />
        {label}
      </MotionButton>
    </div>
  );
}

function SelectedPathBreadcrumb({
  collapsedLabel,
  segments,
  onSelectNode,
}: {
  collapsedLabel: string;
  segments: WorkbenchBreadcrumbSegment[];
  onSelectNode?: (nodeId: string) => void;
}) {
  const displaySegments = segments.map((segment) => ({
    ...segment,
    label: formatDisplayName(segment.label),
  }));
  const pathKey = displaySegments
    .map((segment) => `${segment.nodeId}:${segment.label}`)
    .join("\u203A");
  const fullPathMeasureRef = useRef<HTMLSpanElement>(null);
  const collapsedPathMeasureRef = useRef<HTMLSpanElement>(null);
  const compactPathMeasureRef = useRef<HTMLSpanElement>(null);
  const pathRef = useRef<HTMLDivElement>(null);
  const [collapseMode, setCollapseMode] = useState<
    "full" | "collapsed" | "compact"
  >("full");
  const canCollapse = displaySegments.length > 2;

  useEffect(() => {
    if (!canCollapse) {
      setCollapseMode("full");
      return;
    }

    const measure = () => {
      const availableWidth = pathRef.current?.clientWidth ?? 0;
      const fullPathWidth = fullPathMeasureRef.current?.scrollWidth ?? 0;
      const collapsedPathWidth =
        collapsedPathMeasureRef.current?.scrollWidth ?? 0;
      const compactPathWidth = compactPathMeasureRef.current?.scrollWidth ?? 0;

      if (!availableWidth || !fullPathWidth) {
        return;
      }

      if (fullPathWidth <= availableWidth) {
        setCollapseMode("full");
      } else if (collapsedPathWidth <= availableWidth) {
        setCollapseMode("collapsed");
      } else if (compactPathWidth <= availableWidth) {
        setCollapseMode("compact");
      } else {
        setCollapseMode("compact");
      }
    };
    const observedPath = pathRef.current;

    measure();
    if (typeof ResizeObserver === "undefined" || !observedPath) {
      return;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(observedPath);

    return () => observer.disconnect();
  }, [canCollapse, pathKey]);

  const isCollapsed = collapseMode !== "full";
  const visibleIndexes =
    collapseMode === "full"
      ? displaySegments.map((_, index) => index)
      : collapseMode === "collapsed"
        ? [0, displaySegments.length - 1]
        : [displaySegments.length - 1];

  return (
    <div ref={pathRef} className="relative w-full min-w-0">
      <span
        ref={fullPathMeasureRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute text-sm whitespace-nowrap"
      >
        {displaySegments.map((segment) => segment.label).join(" › ")}
      </span>
      <span
        ref={collapsedPathMeasureRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute text-sm whitespace-nowrap"
      >
        {`${displaySegments[0]?.label ?? ""} › … › ${displaySegments.at(-1)?.label ?? ""}`}
      </span>
      <span
        ref={compactPathMeasureRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute text-sm whitespace-nowrap"
      >
        {`… › ${displaySegments.at(-1)?.label ?? ""}`}
      </span>
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap gap-1.5 whitespace-nowrap">
          {visibleIndexes.map((index, visibleIndex) => {
            const segment = displaySegments[index];

            return (
              <Fragment key={segment.nodeId}>
                {visibleIndex > 0 ? <BreadcrumbSeparator /> : null}
                {isCollapsed &&
                ((collapseMode === "collapsed" && visibleIndex === 1) ||
                  (collapseMode === "compact" && visibleIndex === 0)) ? (
                  <>
                    <BreadcrumbItem className="shrink-0 whitespace-nowrap">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={collapsedLabel}
                              className="rounded-sm text-muted-foreground hover:text-foreground"
                            />
                          }
                        >
                          <BreadcrumbEllipsis />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuGroup>
                            {displaySegments
                              .slice(1, -1)
                              .map((hiddenSegment) => (
                                <DropdownMenuItem
                                  key={hiddenSegment.nodeId}
                                  onClick={() =>
                                    onSelectNode?.(hiddenSegment.nodeId)
                                  }
                                >
                                  {hiddenSegment.label}
                                </DropdownMenuItem>
                              ))}
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                  </>
                ) : null}
                <BreadcrumbItem className="shrink-0 whitespace-nowrap">
                  {index === displaySegments.length - 1 ? (
                    <BreadcrumbPage className="whitespace-nowrap">
                      {segment.label}
                    </BreadcrumbPage>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-1.5 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => onSelectNode?.(segment.nodeId)}
                    >
                      {segment.label}
                    </Button>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}

type ProjectFileIssueState = "none" | "open" | "closed";
type ProjectFileIssueStatus = "pending" | "replied" | "resolved";
type ProjectFileIssueSummary = {
  pending: number;
  replied: number;
  resolved: number;
  workflowReplied: number;
  replyEvidence: number;
};

function getProjectFileIssueSummary(
  questions: WorkingPaperQuestion[]
): ProjectFileIssueSummary {
  return questions.reduce(
    (summary, question) => {
      if (question.status === "OPEN") {
        summary.pending += 1;
      } else if (question.status === "CLEARED") {
        summary.resolved += 1;
      }
      const hasReply = hasReviewQuestionReply(question);
      if (question.status === "REPLIED") {
        summary.workflowReplied += 1;
      }
      if (question.status === "REPLIED" || hasReply) {
        summary.replied += 1;
      }
      if (hasReply) {
        summary.replyEvidence += 1;
      }
      return summary;
    },
    {
      pending: 0,
      replied: 0,
      resolved: 0,
      workflowReplied: 0,
      replyEvidence: 0,
    }
  );
}

function hasReviewQuestionReply(question: WorkingPaperQuestion) {
  return (
    Boolean(question.replyBody?.trim()) ||
    getQuestionMessages(question).some(
      (message) => message.messageType === "REPLY"
    )
  );
}

function getProjectFileIssueStatus(
  summary: ProjectFileIssueSummary
): ProjectFileIssueStatus {
  if (summary.pending > 0) {
    return "pending";
  }
  if (summary.workflowReplied > 0) {
    return "replied";
  }
  return "resolved";
}

function getProjectFileIssueState(
  questions: WorkingPaperQuestion[]
): ProjectFileIssueState {
  if (questions.length <= 0) {
    return "none";
  }
  return questions.some((question) => question.status !== "CLEARED")
    ? "open"
    : "closed";
}

export function ProjectFileIssueIndicator({
  count,
  state,
  status,
  summary,
  statusLabels,
}: {
  count: number;
  state: ProjectFileIssueState;
  status: ProjectFileIssueStatus;
  summary: ProjectFileIssueSummary;
  statusLabels: Record<WorkingPaperQuestion["status"], string>;
}) {
  if (count <= 0) {
    return <CirclePlus className="size-5 text-primary" aria-hidden="true" />;
  }

  const displayCount = count > 99 ? "99+" : String(count);
  const IndicatorIcon =
    status === "resolved"
      ? CircleCheck
      : status === "replied"
        ? MessageSquare
        : Circle;
  const tooltip = [
    `${statusLabels.OPEN}: ${summary.pending}`,
    `${statusLabels.REPLIED}: ${summary.replied}`,
    `${statusLabels.CLEARED}: ${summary.resolved}`,
  ].join(" · ");

  return (
    <span
      data-review-question-state={state}
      data-review-question-status={status}
      data-review-question-reply-count={summary.replyEvidence || undefined}
      data-review-question-mixed={
        Number(summary.pending > 0) +
          Number(summary.replied > 0) +
          Number(summary.resolved > 0) >
        1
          ? "true"
          : undefined
      }
      title={tooltip}
      className={cn(
        "relative inline-flex size-5 items-center justify-center rounded-full",
        status === "resolved"
          ? "bg-success-subtle text-success-accent"
          : status === "replied"
            ? "bg-info-subtle text-info-accent"
            : "bg-warning-subtle text-warning-accent"
      )}
    >
      <IndicatorIcon
        className="emp-mobile-note-icon size-5"
        aria-hidden="true"
      />
      {status === "pending" && summary.replyEvidence > 0 ? (
        <MessageSquare
          className="emp-mobile-note-icon absolute -right-1 -bottom-1 size-3 rounded-full bg-background text-info-accent"
          aria-hidden="true"
        />
      ) : null}
      <span
        className={cn(
          "absolute font-semibold leading-none tabular-nums text-foreground",
          displayCount.length > 2 ? "text-[0.44rem]" : "text-[0.625rem]"
        )}
      >
        {displayCount}
      </span>
    </span>
  );
}

function getProjectFileIssueLabel(count: number) {
  if (count <= 0) {
    return "No notes";
  }
  return count === 1 ? "1 note" : `${count} notes`;
}

function getProjectFileSignerName(signoff: WorkingPaperSignoff) {
  const name = signoff.user.name?.trim();
  return name
    ? formatDisplayName(name)
    : formatAccountDisplayName(signoff.user);
}

function ProjectFileSignerAvatars({
  signoffs,
  onRemove,
  removeLabel,
  canRemove,
}: {
  signoffs: WorkingPaperSignoff[];
  onRemove?: (signoffId: string) => void;
  removeLabel?: string;
  canRemove?: (signoff: WorkingPaperSignoff) => boolean;
}) {
  if (signoffs.length === 0) {
    return (
      <span
        data-signoff-empty
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/50 bg-transparent text-xs font-medium text-muted-foreground/65"
      >
        -
      </span>
    );
  }

  const signerNames = signoffs.map((signoff) =>
    getProjectFileSignerName(signoff)
  );
  const signerDetails = signoffs
    .map(
      (signoff, index) =>
        `${signerNames[index] || "Unknown member"} · ${formatDateOnly(signoff.signedAt)}`
    )
    .join("\n");
  const renderAvatar = (signoff: WorkingPaperSignoff) => {
    const displayName = getProjectFileSignerName(signoff) || "Unknown member";
    return (
      <Avatar
        key={signoff.id}
        size="sm"
        className={cn(
          "size-6 shadow-none",
          getAvatarColorClassName(displayName)
        )}
        title={`${displayName} · ${formatDateOnly(signoff.signedAt)}`}
      >
        <AvatarFallback className="bg-transparent !text-[0.5rem] leading-none font-bold text-inherit">
          {getAvatarInitials(displayName)}
        </AvatarFallback>
      </Avatar>
    );
  };

  return (
    <div
      className="group/signers relative flex min-w-0"
      aria-label={`Signed by ${signerDetails.replaceAll("\n", ", ")}`}
    >
      {signoffs.length === 1 ? (
        <div className="flex h-6 w-6 min-w-6">{renderAvatar(signoffs[0])}</div>
      ) : (
        <span className="inline-flex size-6 items-center justify-center rounded-md border border-border/55 bg-muted/35 text-[0.625rem] font-medium text-muted-foreground">
          {signoffs.length}
        </span>
      )}
      <div className="pointer-events-auto absolute top-full right-0 z-40 hidden w-60 rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-xl shadow-foreground/15 group-focus-within/signers:block group-hover/signers:block">
        <div className="grid gap-1.5">
          {signoffs.map((signoff) => {
            const displayName =
              getProjectFileSignerName(signoff) || "Unknown member";
            return (
              <div
                key={signoff.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2"
              >
                {renderAvatar(signoff)}
                <span className="min-w-0 text-xs">
                  {displayName} · {formatDateOnly(signoff.signedAt)}
                </span>
                {onRemove && (canRemove?.(signoff) ?? true) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={[
                      removeLabel ?? "Remove signoff",
                      displayName,
                    ].join(": ")}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemove(signoff.id);
                    }}
                  >
                    <X />
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const SIGNOFF_STATUS_BUTTON_CLASS =
  "h-6 w-6 min-w-6 rounded-md px-0 text-xs font-semibold shadow-none";
const SIGNOFF_STATUS_GROUP_CLASS =
  "flex h-7 w-[3.75rem] min-w-[3.75rem] items-center justify-between gap-1 px-1";
function ProjectFileSignoffActionCell({
  paper,
  signoffTargetId,
  prepareSignoff,
  reviewSignoff,
  displayName,
  currentUserId,
  currentProjectRole,
  pending,
  canSignPreparer = true,
  prepareWorkingPaper,
  reviewWorkingPaper,
  removePreparationSignoff,
  copy,
  mobile = false,
}: {
  paper: PaperReviewSnapshot | null;
  signoffTargetId?: string;
  prepareSignoff?: (targetId: string) => void;
  reviewSignoff?: (targetId: string) => void;
  displayName: string;
  currentUserId: string | null;
  currentProjectRole: ProjectRole | null;
  pending: boolean;
  canSignPreparer?: boolean;
  prepareWorkingPaper: (paperId: string) => void;
  reviewWorkingPaper: (paperId: string) => void;
  removePreparationSignoff: (signoffId: string) => void;
  copy: WorkbenchSignoffStatusCopy;
  mobile?: boolean;
}) {
  const [isSelfReviewWarningOpen, setIsSelfReviewWarningOpen] = useState(false);
  const multiRoundCopy = {
    ...defaultSignoffStatusCopy,
    ...copy,
  } as Required<WorkbenchSignoffStatusCopy>;
  const signoffs = paper ? getPaperSignoffs(paper) : [];
  const preparerSignoffs = signoffs.filter(
    (signoff) => signoff.type === "PREPARER"
  );
  const reviewerSignoffs = signoffs.filter(
    (signoff) => signoff.type === "REVIEWER"
  );
  const canSignoff = Boolean(paper && currentProjectRole);
  if (!canSignoff || !paper) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }
  const actionTargetId = signoffTargetId ?? paper.id;
  const submitPrepare = prepareSignoff ?? prepareWorkingPaper;
  const submitReview = reviewSignoff ?? reviewWorkingPaper;
  const isSelfReview = Boolean(
    currentUserId &&
    preparerSignoffs.some((signoff) => signoff.user.id === currentUserId)
  );

  if (mobile) {
    return (
      <MobileProjectFileSignoffCell
        displayName={displayName}
        currentUserId={currentUserId}
        currentProjectRole={currentProjectRole}
        pending={pending}
        canSignPreparer={canSignPreparer}
        preparerSignoffs={preparerSignoffs}
        reviewerSignoffs={reviewerSignoffs}
        prepareSignoff={() => submitPrepare(actionTargetId)}
        reviewSignoff={() => submitReview(actionTargetId)}
        removeSignoff={removePreparationSignoff}
        copy={multiRoundCopy}
      />
    );
  }

  return (
    <>
      <div
        data-file-signoffs
        className="flex w-full min-w-0 flex-nowrap items-center justify-center gap-1"
      >
        <div data-signoff-group className={SIGNOFF_STATUS_GROUP_CLASS}>
          <SignoffButton
            variant="success"
            type="button"
            size="xs"
            className={SIGNOFF_STATUS_BUTTON_CLASS}
            disabled={pending || !canSignPreparer}
            aria-label={`Add preparation signoff for ${displayName}`}
            onClick={() => submitPrepare(actionTargetId)}
          >
            P
          </SignoffButton>
          <ProjectFileSignerAvatars
            signoffs={preparerSignoffs}
            onRemove={removePreparationSignoff}
            removeLabel={multiRoundCopy.removePreparedLabel}
          />
        </div>
        <div data-signoff-group className={SIGNOFF_STATUS_GROUP_CLASS}>
          <SignoffButton
            variant="warning"
            type="button"
            size="xs"
            className={SIGNOFF_STATUS_BUTTON_CLASS}
            disabled={pending || preparerSignoffs.length === 0}
            aria-label={`Add review signoff for ${displayName}`}
            onClick={() => {
              if (isSelfReview) {
                setIsSelfReviewWarningOpen(true);
              } else {
                submitReview(actionTargetId);
              }
            }}
          >
            R
          </SignoffButton>
          <ProjectFileSignerAvatars
            signoffs={reviewerSignoffs}
            onRemove={removePreparationSignoff}
            removeLabel={multiRoundCopy.removeReviewedLabel}
            canRemove={(signoff) =>
              signoff.user.id === currentUserId ||
              currentProjectRole === "PARTNER"
            }
          />
        </div>
      </div>
      <AlertDialog
        open={isSelfReviewWarningOpen}
        onOpenChange={setIsSelfReviewWarningOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {multiRoundCopy.selfReviewTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {multiRoundCopy.selfReviewDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{multiRoundCopy.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsSelfReviewWarningOpen(false);
                submitReview(actionTargetId);
              }}
            >
              {multiRoundCopy.signReview}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function MobileProjectFileSignoffCell({
  displayName,
  currentUserId,
  currentProjectRole,
  pending,
  canSignPreparer,
  preparerSignoffs,
  reviewerSignoffs,
  prepareSignoff,
  reviewSignoff,
  removeSignoff,
  copy,
}: {
  displayName: string;
  currentUserId: string | null;
  currentProjectRole: ProjectRole | null;
  pending: boolean;
  canSignPreparer: boolean;
  preparerSignoffs: WorkingPaperSignoff[];
  reviewerSignoffs: WorkingPaperSignoff[];
  prepareSignoff: () => void;
  reviewSignoff: () => void;
  removeSignoff: (signoffId: string) => void;
  copy: Required<WorkbenchSignoffStatusCopy>;
}) {
  const [isSelfReviewWarningOpen, setIsSelfReviewWarningOpen] = useState(false);
  const isSelfReview = Boolean(
    currentUserId &&
    preparerSignoffs.some((signoff) => signoff.user.id === currentUserId)
  );

  return (
    <>
      <div className="emp-mobile-file-signoffs" data-file-signoffs>
        <div className="emp-mobile-file-signoff-group">
          <SignoffButton
            type="button"
            variant="outline"
            size="icon-xs"
            data-signoff-complete={preparerSignoffs.length > 0 || undefined}
            aria-description={
              preparerSignoffs.length > 0
                ? copy.preparedTitle
                : copy.addPreparation
            }
            disabled={pending || !canSignPreparer}
            aria-label={`Add preparation signoff for ${displayName}`}
            onClick={(event) => {
              event.stopPropagation();
              prepareSignoff();
            }}
          >
            {preparerSignoffs.length > 0 ? (
              <span aria-hidden="true">✓</span>
            ) : null}
            P
          </SignoffButton>
          <ProjectFileSignerAvatars
            signoffs={preparerSignoffs}
            onRemove={removeSignoff}
            removeLabel={copy.removePreparedLabel}
          />
        </div>
        <div className="emp-mobile-file-signoff-group">
          <SignoffButton
            type="button"
            variant="outline"
            size="icon-xs"
            data-signoff-complete={reviewerSignoffs.length > 0 || undefined}
            aria-description={
              reviewerSignoffs.length > 0
                ? copy.reviewedTitle
                : copy.pendingReview
            }
            disabled={pending || preparerSignoffs.length === 0}
            aria-label={`Add review signoff for ${displayName}`}
            onClick={(event) => {
              event.stopPropagation();
              if (isSelfReview) {
                setIsSelfReviewWarningOpen(true);
                return;
              }
              reviewSignoff();
            }}
          >
            {reviewerSignoffs.length > 0 ? (
              <span aria-hidden="true">✓</span>
            ) : null}
            R
          </SignoffButton>
          <ProjectFileSignerAvatars
            signoffs={reviewerSignoffs}
            onRemove={removeSignoff}
            removeLabel={copy.removeReviewedLabel}
            canRemove={(signoff) =>
              signoff.user.id === currentUserId ||
              currentProjectRole === "PARTNER"
            }
          />
        </div>
      </div>
      <AlertDialog
        open={isSelfReviewWarningOpen}
        onOpenChange={setIsSelfReviewWarningOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.selfReviewTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {copy.selfReviewDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsSelfReviewWarningOpen(false);
                reviewSignoff();
              }}
            >
              {copy.signReview}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PreviewLoadErrorState({
  onRetry,
  retryLabel,
}: {
  onRetry: () => void;
  retryLabel: string;
}) {
  return (
    <div
      role="alert"
      className="grid h-full min-h-0 place-items-center bg-destructive/5 px-4 text-center text-sm text-destructive"
    >
      <div className="grid max-w-sm justify-items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <RefreshCcw data-icon="inline-start" />
          {retryLabel}
        </Button>
      </div>
    </div>
  );
}

function ProjectFileStatusLine({
  mobile = false,
  attachment,
  displayName,
  lockState,
  desktopAgentSession,
  pending,
  checkInDesktopSession,
  copy,
}: {
  mobile?: boolean;
  attachment: ProjectAttachment;
  displayName: string;
  lockState: ReturnType<typeof getAttachmentLockState>;
  desktopAgentSession?: DesktopAgentSession;
  pending: boolean;
  checkInDesktopSession: (
    session: DesktopAgentSession,
    attachment: ProjectAttachment
  ) => void;
  copy: NonNullable<WorkbenchProjectFileIndexCopy["activity"]>;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const lockCopy = copy.lockDetails ?? defaultFileOccupancyCopy;
  const activity = getAttachmentBusinessActivity(attachment, lockState, copy);
  const retryableDesktopAgentSession =
    desktopAgentSession &&
    hasDesktopMasterGrant(desktopAgentSession) &&
    isDesktopAgentManualRetryStatus(desktopAgentSession.status)
      ? desktopAgentSession
      : null;

  if (
    !activity &&
    !retryableDesktopAgentSession &&
    !(mobile && lockState.isLocked)
  ) {
    return null;
  }

  return (
    <div className="inline-flex max-w-full min-w-0 items-center gap-1.5 text-xs leading-5 text-muted-foreground">
      {mobile && lockState.isLocked ? (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="emp-mobile-file-lock"
            aria-label={`${lockCopy.title}: ${displayName}`}
            onClick={(event) => {
              event.stopPropagation();
              setDetailsOpen(true);
            }}
          >
            <Lock aria-hidden="true" />
          </Button>
          <MobileActionSheet
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
            title={lockCopy.title}
            closeLabel={lockCopy.close}
          >
            <div className="grid gap-4">
              <p className="font-medium break-words">{displayName}</p>
              <p className="text-sm text-muted-foreground">
                {lockState.isLockedByCurrentUser
                  ? lockCopy.ownedByYou
                  : lockCopy.ownedByOther}
              </p>
              <dl className="grid gap-4 text-sm">
                <div className="grid gap-1">
                  <dt className="text-muted-foreground">{lockCopy.holder}</dt>
                  <dd className="break-words">
                    {getActivityActor(attachment.lockHolder) ||
                      lockCopy.unknownHolder}
                  </dd>
                </div>
                <div className="grid gap-1">
                  <dt className="text-muted-foreground">
                    {lockCopy.startedAt}
                  </dt>
                  <dd>
                    {attachment.lockedAt &&
                    Number.isFinite(Date.parse(attachment.lockedAt))
                      ? new Intl.DateTimeFormat(copy.locale ?? "en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(attachment.lockedAt))
                      : lockCopy.unknownTime}
                  </dd>
                </div>
              </dl>
            </div>
          </MobileActionSheet>
        </>
      ) : !mobile && activity ? (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span
            aria-label={activity.label}
            className={cn(
              "min-w-0 truncate font-normal",
              lockState.isLocked ? "text-primary" : "text-muted-foreground"
            )}
          >
            {activity.label}
          </span>
        </span>
      ) : null}
      {retryableDesktopAgentSession ? (
        <Button
          variant="outline"
          type="button"
          size="icon"
          className="h-6 w-6 shrink-0 rounded-sm"
          disabled={pending}
          aria-label={
            retryableDesktopAgentSession.status === "DIRTY_PENDING_CHECKIN"
              ? formatWorkbenchCopy(copy.retryCheckIn, { name: displayName })
              : formatWorkbenchCopy(copy.retryTracking, { name: displayName })
          }
          onClick={() =>
            checkInDesktopSession(retryableDesktopAgentSession, attachment)
          }
        >
          <Upload className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

function SmartFormInlineCompletionStatus({
  status,
  completeLabel,
  incompleteLabel,
}: {
  status?: "INCOMPLETE" | "COMPLETE";
  completeLabel: string;
  incompleteLabel: string;
}) {
  const complete = status === "COMPLETE";
  const label = complete ? completeLabel : incompleteLabel;
  return (
    <span
      aria-label={`SmartForm ${label}`}
      title={`SmartForm ${label}`}
      className="inline-flex shrink-0 items-center gap-1 text-[11px] leading-none font-medium text-foreground"
    >
      {complete ? (
        <CircleCheck
          aria-hidden="true"
          className="size-3.5 text-success-accent"
        />
      ) : (
        <Circle aria-hidden="true" className="size-3.5 text-warning-accent" />
      )}
      {label}
    </span>
  );
}

type ProjectFileActivity = {
  label: string;
};

function getAttachmentBusinessActivity(
  attachment: ProjectAttachment,
  lockState: ReturnType<typeof getAttachmentLockState>,
  copy: NonNullable<WorkbenchProjectFileIndexCopy["activity"]>
): ProjectFileActivity | null {
  if (!lockState.isLocked) {
    return null;
  }

  const actor =
    getActivityActor(attachment.lockHolder) ??
    getActivityActor(attachment.lastModifier) ??
    getActivityActor(attachment.uploader);
  const time = formatMasterOpenedTime(attachment.lockedAt, copy);
  if (!actor || !time) {
    return null;
  }

  return {
    label: formatWorkbenchCopy(copy.masterOpened, {
      actor,
      time,
    }),
  };
}

function getActivityActor(user?: UserLike | null) {
  const name = formatUserSummaryName(user);
  return name || null;
}

function formatUserSummaryName(user?: UserLike | null) {
  const name = user?.name?.trim();
  if (name) {
    return formatDisplayName(name);
  }
  return formatAccountDisplayName(user);
}

type UserLike = {
  name?: string | null;
  email?: string | null;
};

function formatMasterOpenedTime(
  value: string | null | undefined,
  copy: NonNullable<WorkbenchProjectFileIndexCopy["activity"]>
) {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  const diffMinutes = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 60_000)
  );
  if (diffMinutes < 1) {
    return copy.withinOneMinute;
  }
  if (diffMinutes === 1) {
    return "1 minute ago";
  }
  return `${diffMinutes} minutes ago`;
}

function isDisplayableDesktopAgentSession(session: DesktopAgentSession) {
  if (
    [
      "LAUNCHING",
      "OPEN_NOT_OBSERVED",
      "LAUNCH_FAILED",
      "LOCK_REVOKED",
      "CLOSED",
    ].includes(session.lifecycleState)
  ) {
    return false;
  }
  return true;
}

function isDesktopAgentAutoRetryStatus(status: DesktopAgentSession["status"]) {
  return [
    "RELEASE_PENDING",
    "RELEASE_FAILED",
    "CLEANUP_PENDING",
    "CLEANUP_FAILED",
  ].includes(status);
}

function hasDesktopMasterGrant(session: DesktopAgentSession) {
  return Boolean(session.lockSessionId && session.grantSecret);
}

function isDesktopAgentManualRetryStatus(
  status?: DesktopAgentSession["status"]
) {
  return Boolean(
    status &&
    [
      "DIRTY_PENDING_CHECKIN",
      "CHECKIN_FAILED",
      "RELEASE_FAILED",
      "CLEANUP_FAILED",
    ].includes(status)
  );
}

type ProjectFileActionView = "menu" | "export" | "refcode" | "rename";

type MobileFileActionSheetState = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closeLabel: string;
};

const MobileFileActionCloseContext = createContext<(() => void) | null>(null);

function ProjectFileActionMenu({
  mobileSheet,
  projectId,
  attachment,
  displayName,
  resetHeadCopy,
  currentRefcode,
  disabled,
  fileMutationDisabled = false,
  desktopMasterOpenSupported,
  desktopReadOnlyOpenSupported,
  desktopLocalOpenSupported,
  masterDisabled,
  masterLabel = "Open (Master)",
  actionMenuCopy,
  canResetHead,
  onPreview,
  onOpenMaster,
  onOpenReadOnly,
  onOpenLocally,
  onDownload,
  selectionExportMode = false,
  exportSelectionCount = 0,
  onExportSelection,
  onExportZipJob,
  onEnableMultiSelect,
  onReplacePlaceholder,
  onReleaseMaster,
  onDelete,
  onChangeRefcode,
  onRename,
  relocationCopy,
  workflow,
  moveFiles,
  onRequestMoveTo,
  onCopyToClipboard,
  onCutToClipboard,
  onPasteClipboard,
  pasteClipboardDisabled = false,
  onRestoreVersion,
}: {
  mobileSheet?: MobileFileActionSheetState;
  projectId: string;
  attachment: ProjectAttachment;
  displayName: string;
  resetHeadCopy: WorkbenchResetHeadCopy;
  currentRefcode?: string;
  disabled: boolean;
  fileMutationDisabled?: boolean;
  desktopMasterOpenSupported: boolean;
  desktopReadOnlyOpenSupported: boolean;
  desktopLocalOpenSupported: boolean;
  masterDisabled: boolean;
  masterLabel?: string;
  actionMenuCopy: WorkbenchProjectFileActionMenuCopy;
  canResetHead: boolean;
  onPreview?: () => void;
  onOpenMaster: () => void;
  onOpenReadOnly: () => void;
  onOpenLocally: () => void;
  onDownload: () => void;
  selectionExportMode?: boolean;
  exportSelectionCount?: number;
  onExportSelection?: () => void;
  onExportZipJob?: () => void;
  onEnableMultiSelect?: () => void;
  onReplacePlaceholder?: () => void;
  onReleaseMaster?: () => void;
  onDelete?: () => void;
  onChangeRefcode?: (code: string) => void;
  onRename?: (originalName: string) => void;
  relocationCopy: NonNullable<WorkbenchProjectFileIndexCopy["relocation"]>;
  workflow: WorkflowNode[];
  moveFiles: DirectoryFileTransfer[];
  onRequestMoveTo?: () => void;
  onCopyToClipboard?: () => void;
  onCutToClipboard?: () => void;
  onPasteClipboard?: () => void;
  pasteClipboardDisabled?: boolean;
  onRestoreVersion?: (versionId: string) => void;
}) {
  const openMasterDisabled =
    disabled || masterDisabled || !desktopMasterOpenSupported;
  const desktopReadOnlyDisabled = disabled || !desktopReadOnlyOpenSupported;
  const desktopLocalDisabled = disabled || !desktopLocalOpenSupported;
  const showReadOnlyAction =
    desktopReadOnlyOpenSupported || isArchiveAttachment(attachment);
  const mutationDisabled = disabled || fileMutationDisabled;
  const [isResetHeadOpen, setIsResetHeadOpen] = useState(false);
  const [view, setView] = useState<ProjectFileActionView>("menu");
  const [refcodeDraft, setRefcodeDraft] = useState(currentRefcode ?? "");
  const [nameDraft, setNameDraft] = useState(displayName);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();
  const versionHistory = useQuery({
    queryKey: ["attachment-history", projectId, attachment.id, "menu"],
    queryFn: () => api.attachmentHistory(projectId, attachment.id),
    enabled: isResetHeadOpen,
    staleTime: 30_000,
  });
  const resetHeadTimeline = buildAttachmentRevisionTimeline(
    versionHistory.data?.attachment ?? attachment,
    versionHistory.data?.versions ?? []
  );

  useEffect(() => {
    setView("menu");
    setRefcodeDraft(currentRefcode ?? "");
    setNameDraft(displayName);
  }, [currentRefcode, displayName]);

  const onMobileSheetOpenChange = mobileSheet?.onOpenChange;
  const closeMenu = useCallback(() => {
    setView("menu");
    onMobileSheetOpenChange?.(false);
  }, [onMobileSheetOpenChange]);
  const runAction = (action?: () => void) => {
    action?.();
    closeMenu();
  };
  const goBack = () => setView("menu");
  const submitRefcode = () => {
    const nextRefcode = refcodeDraft.trim();
    if (!nextRefcode || !onChangeRefcode) {
      return;
    }
    runAction(() => onChangeRefcode(nextRefcode));
  };
  const submitRename = () => {
    const nextName = nameDraft.trim();
    if (!nextName || !onRename) {
      return;
    }
    runAction(() => onRename(nextName));
  };
  const restoreVersion = (versionId: string) => {
    if (!onRestoreVersion) {
      return;
    }
    onRestoreVersion(versionId);
    setIsResetHeadOpen(false);
  };
  const exportAttachment = async (format: AttachmentExportFormat) => {
    if (format === "zip" && onExportZipJob) {
      onExportZipJob();
      setView("menu");
      return;
    }
    setExporting(true);
    try {
      toast({
        title: actionMenuCopy.exporting ?? "Exporting...",
        description: displayName,
        duration: 2000,
      });
      const blob = await api.exportAttachment(projectId, attachment.id, format);
      const fileName = getAttachmentExportDownloadFileName(attachment, format);
      downloadBlob(blob, fileName);
      toast({
        title: actionMenuCopy.exportSuccessTitle ?? "File exported",
        description: formatWorkbenchCopy(
          actionMenuCopy.exportSuccessDescription ?? "Exported {name}",
          { name: fileName }
        ),
      });
      setView("menu");
    } catch (error) {
      toast({
        title: actionMenuCopy.exportFailedTitle ?? "Could not export file",
        variant: "destructive",
      });
      showErrorToast(
        error,
        actionMenuCopy.exportFailedTitle ?? "Could not export file"
      );
    } finally {
      setExporting(false);
    }
  };
  const content = (
    <>
      {view === "menu" ? (
        <div
          role={mobileSheet ? "group" : "menu"}
          aria-label={formatWorkbenchCopy(actionMenuCopy.actionsFor, {
            name: displayName,
          })}
        >
          {attachment.placeholderType && onReplacePlaceholder ? (
            <ProjectFileMenuItem
              icon={<Upload className="h-4 w-4" />}
              label={actionMenuCopy.replacePlaceholder ?? "Replace file"}
              disabled={mutationDisabled}
              onClick={() => runAction(onReplacePlaceholder)}
            />
          ) : null}
          {!attachment.placeholderType && onPreview ? (
            <ProjectFileMenuItem
              icon={<Eye className="h-4 w-4" />}
              label={actionMenuCopy.preview}
              disabled={disabled}
              onClick={() => runAction(onPreview)}
            />
          ) : null}
          {attachment.placeholderType ? null : (
            <ProjectFileMenuItem
              icon={<Download className="h-4 w-4" />}
              label={masterLabel}
              disabled={openMasterDisabled}
              onClick={() => runAction(onOpenMaster)}
            />
          )}
          {!attachment.placeholderType && showReadOnlyAction ? (
            <ProjectFileMenuItem
              icon={<FileIcon className="h-4 w-4" />}
              label={actionMenuCopy.openReadOnly}
              disabled={desktopReadOnlyDisabled}
              onClick={() => runAction(onOpenReadOnly)}
            />
          ) : attachment.placeholderType ? null : (
            <ProjectFileMenuItem
              icon={<FileIcon className="h-4 w-4" />}
              label={
                actionMenuCopy.openLocal ?? actionMenuCopy.export ?? "Open"
              }
              disabled={desktopLocalDisabled}
              onClick={() => runAction(onOpenLocally)}
            />
          )}
          {attachment.placeholderType ? null : (
            <ProjectFileMenuItem
              icon={<Download className="h-4 w-4" />}
              label={
                selectionExportMode
                  ? formatWorkbenchCopy(
                      actionMenuCopy.exportSelected ??
                        "Export selected files ({count})",
                      { count: exportSelectionCount }
                    )
                  : (actionMenuCopy.export ??
                    actionMenuCopy.download ??
                    "Download")
              }
              disabled={disabled || (selectionExportMode && !onExportSelection)}
              closeOnClick={selectionExportMode || !actionMenuCopy.export}
              onClick={() =>
                selectionExportMode
                  ? runAction(onExportSelection)
                  : actionMenuCopy.export
                    ? setView("export")
                    : runAction(onDownload)
              }
            />
          )}
          {!attachment.placeholderType && onEnableMultiSelect ? (
            <ProjectFileMenuItem
              icon={<ClipboardCheck className="h-4 w-4" />}
              label={actionMenuCopy.multiSelect ?? "Multi-select"}
              disabled={false}
              onClick={() => runAction(onEnableMultiSelect)}
            />
          ) : null}
          {!attachment.placeholderType && onReleaseMaster ? (
            <ProjectFileMenuItem
              icon={<LockOpen className="h-4 w-4" />}
              label={actionMenuCopy.releaseMaster}
              disabled={disabled}
              onClick={() => runAction(onReleaseMaster)}
            />
          ) : null}
          <ContextMenuSeparator />
          {onChangeRefcode ? (
            <ProjectFileMenuItem
              icon={<Hash className="h-4 w-4" />}
              label={actionMenuCopy.changeRefcode}
              disabled={mutationDisabled}
              closeOnClick={false}
              onClick={() => setView("refcode")}
            />
          ) : null}
          {onRename ? (
            <ProjectFileMenuItem
              icon={<Pencil className="h-4 w-4" />}
              label={actionMenuCopy.rename}
              disabled={mutationDisabled}
              closeOnClick={false}
              onClick={() => setView("rename")}
            />
          ) : null}
          {onRestoreVersion ? (
            <ProjectFileMenuItem
              icon={<RefreshCcw className="h-4 w-4" />}
              label={actionMenuCopy.resetHead}
              disabled={mutationDisabled}
              onClick={() => {
                setView("menu");
                setIsResetHeadOpen(true);
              }}
            />
          ) : null}
          <ProjectFileMenuItem
            icon={<FolderInput className="h-4 w-4" />}
            label={relocationCopy.moveTo ?? "Move to"}
            disabled={
              mutationDisabled ||
              !onRequestMoveTo ||
              moveFiles.length === 0 ||
              workflow.length === 0
            }
            onClick={() => runAction(onRequestMoveTo)}
          />
          <ProjectFileMenuItem
            icon={<Copy className="h-4 w-4" />}
            label={relocationCopy.copy}
            disabled={mutationDisabled || !onCopyToClipboard}
            onClick={() => runAction(onCopyToClipboard)}
          />
          <ProjectFileMenuItem
            icon={<Scissors className="h-4 w-4" />}
            label={relocationCopy.move}
            disabled={mutationDisabled || !onCutToClipboard}
            onClick={() => runAction(onCutToClipboard)}
          />
          {onPasteClipboard ? (
            <ProjectFileMenuItem
              icon={<ClipboardPaste className="h-4 w-4" />}
              label={relocationCopy.paste}
              disabled={mutationDisabled || pasteClipboardDisabled}
              onClick={() => runAction(onPasteClipboard)}
            />
          ) : null}
          {onDelete ? (
            <>
              <ContextMenuSeparator />
              <ProjectFileMenuItem
                icon={<Trash2 className="h-4 w-4" />}
                label={actionMenuCopy.delete}
                destructive
                disabled={mutationDisabled}
                onClick={() => runAction(onDelete)}
              />
            </>
          ) : null}
        </div>
      ) : null}

      {view === "export" ? (
        <ProjectFileActionPanel
          title={
            actionMenuCopy.exportTitle ?? actionMenuCopy.export ?? "Export"
          }
          backLabel={actionMenuCopy.backToActions}
          onBack={goBack}
        >
          <ProjectFileMenuItem
            icon={<FileIcon className="h-4 w-4" />}
            label={actionMenuCopy.exportOriginal ?? "Original format"}
            disabled={disabled || exporting}
            onClick={() => exportAttachment("original")}
          />
          {isOfficePdfExportAttachment(attachment) ||
          isSmartFormAttachment(attachment) ? (
            <ProjectFileMenuItem
              icon={<FileIcon className="h-4 w-4" />}
              label={actionMenuCopy.exportPdf ?? "PDF"}
              disabled={disabled || exporting}
              onClick={() => exportAttachment("pdf")}
            />
          ) : null}
          <ProjectFileMenuItem
            icon={<Archive className="h-4 w-4" />}
            label={actionMenuCopy.exportZip ?? "ZIP with folder path"}
            disabled={disabled || exporting}
            onClick={() => exportAttachment("zip")}
          />
        </ProjectFileActionPanel>
      ) : null}

      {view === "refcode" ? (
        <ProjectFileActionPanel
          title={actionMenuCopy.changeRefcode}
          backLabel={actionMenuCopy.backToActions}
          onBack={goBack}
        >
          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            {actionMenuCopy.newRefcode}
            <Input
              aria-label={actionMenuCopy.newRefcode}
              value={refcodeDraft}
              disabled={mutationDisabled}
              onChange={(event) => setRefcodeDraft(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
            />
          </label>
          <Button
            type="button"
            disabled={mutationDisabled || !refcodeDraft.trim()}
            onClick={submitRefcode}
          >
            {actionMenuCopy.saveRefcode}
          </Button>
        </ProjectFileActionPanel>
      ) : null}

      {view === "rename" ? (
        <ProjectFileActionPanel
          title={actionMenuCopy.rename}
          backLabel={actionMenuCopy.backToActions}
          onBack={goBack}
        >
          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            {actionMenuCopy.fileDisplayName}
            <Input
              aria-label={actionMenuCopy.fileDisplayName}
              value={nameDraft}
              disabled={mutationDisabled || !onRename}
              onChange={(event) => setNameDraft(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
            />
          </label>
          <Button
            type="button"
            disabled={mutationDisabled || !onRename || !nameDraft.trim()}
            onClick={submitRename}
          >
            {actionMenuCopy.saveName}
          </Button>
        </ProjectFileActionPanel>
      ) : null}
    </>
  );

  return (
    <>
      {mobileSheet ? (
        <MobileActionSheet
          open={mobileSheet.open}
          onOpenChange={(open) => {
            mobileSheet.onOpenChange(open);
            if (!open) {
              setView("menu");
            }
          }}
          title={displayName}
          closeLabel={mobileSheet.closeLabel}
        >
          <MobileFileActionCloseContext.Provider value={closeMenu}>
            <div className="emp-mobile-file-action-sheet">{content}</div>
          </MobileFileActionCloseContext.Provider>
        </MobileActionSheet>
      ) : (
        <ContextMenuContent className="w-72">{content}</ContextMenuContent>
      )}
      <ResetHeadDialog
        open={isResetHeadOpen}
        onOpenChange={setIsResetHeadOpen}
        versions={resetHeadTimeline}
        loading={versionHistory.isLoading}
        error={versionHistory.error}
        disabled={disabled}
        canResetHead={canResetHead}
        copy={resetHeadCopy}
        onReset={restoreVersion}
      />
    </>
  );
}

function ProjectFileActionPanel({
  title,
  backLabel,
  onBack,
  children,
}: {
  title: string;
  backLabel: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3 p-2">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={backLabel}
          onClick={onBack}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 text-sm font-semibold text-foreground">
          {title}
        </div>
      </div>
      {children}
    </div>
  );
}

function ResetHeadDialog({
  open,
  onOpenChange,
  versions,
  loading,
  error,
  disabled,
  canResetHead,
  copy,
  initialVersionId,
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: AttachmentRevisionTimelineItem[];
  loading: boolean;
  error: unknown;
  disabled: boolean;
  canResetHead: boolean;
  copy: WorkbenchResetHeadCopy;
  initialVersionId?: string | null;
  onReset: (versionId: string) => void;
}) {
  const selectableVersions = useMemo(
    () => versions.filter((version) => !version.isCurrent),
    [versions]
  );
  const orderedVersions = useMemo(
    () =>
      [...versions].sort(
        (left, right) =>
          right.version - left.version ||
          Date.parse(right.createdAt) - Date.parse(left.createdAt)
      ),
    [versions]
  );
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!open) {
      setSelectedVersionId(null);
      return;
    }
    setSelectedVersionId((current) => {
      if (
        current &&
        selectableVersions.some((version) => version.id === current)
      ) {
        return current;
      }
      if (
        initialVersionId &&
        selectableVersions.some((version) => version.id === initialVersionId)
      ) {
        return initialVersionId;
      }
      return null;
    });
  }, [initialVersionId, open, selectableVersions]);

  const selectedVersion =
    orderedVersions.find((version) => version.id === selectedVersionId) ?? null;
  const resetDisabled =
    disabled || loading || Boolean(error) || !canResetHead || !selectedVersion;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[min(34rem,calc(100vh-2rem))] max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 px-5 py-4">
          <div className="grid grid-cols-[5rem_minmax(0,1fr)_11rem] border-b border-border px-3 pb-2 text-xs font-medium text-muted-foreground">
            <span>{copy.versionHeader}</span>
            <span>{copy.modifierHeader}</span>
            <span>{copy.timeHeader}</span>
          </div>
          {loading ? (
            <div
              className="space-y-2 p-3"
              aria-busy="true"
              aria-label={copy.loadingVersions}
            >
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          ) : orderedVersions.length > 0 ? (
            <ButtonGroup
              orientation="vertical"
              className="min-h-0 w-full overflow-y-auto rounded-md border border-border bg-background"
              role="radiogroup"
              aria-label={copy.versionsLabel}
            >
              {orderedVersions.map((version) => {
                const isSelected = version.id === selectedVersionId;
                const isSelectable = !version.isCurrent;
                const modifier = getAttachmentRevisionModifier(version);
                const modifiedAt = getAttachmentRevisionModifiedAt(version);

                return (
                  <Button
                    key={version.id}
                    type="button"
                    variant="ghost"
                    size="default"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`${modifier} ${formatDateTime(modifiedAt)} ${
                      version.version
                    }${version.isCurrent ? ` ${copy.current}` : ""}`}
                    disabled={!isSelectable || disabled || !canResetHead}
                    className={cn(
                      "grid min-h-12 w-full grid-cols-[5rem_minmax(0,1fr)_11rem] items-center gap-3 border-b border-border px-3 py-2 text-left transition-colors duration-75 ease-out last:border-b-0 will-change-[background-color,color]",
                      version.isCurrent
                        ? "cursor-default bg-background"
                        : isSelected
                          ? "bg-workbench-active"
                          : "bg-background hover:bg-workbench-row-hover",
                      (disabled || !canResetHead) &&
                        "cursor-not-allowed opacity-55"
                    )}
                    onClick={() => {
                      if (isSelectable) {
                        setSelectedVersionId(version.id);
                      }
                    }}
                  >
                    <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                      <span>{version.version}</span>
                      {version.isCurrent ? (
                        <span className="rounded border border-success/45 bg-success/20 px-1 py-0.5 font-sans text-[10px] leading-none text-success">
                          {copy.current}
                        </span>
                      ) : null}
                    </span>
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">
                      {modifier}
                    </span>
                    <time
                      dateTime={modifiedAt}
                      className="shrink-0 text-xs text-muted-foreground"
                    >
                      {formatDateTime(modifiedAt)}
                    </time>
                  </Button>
                );
              })}
            </ButtonGroup>
          ) : (
            <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              {copy.empty}
            </div>
          )}
        </div>

        <DialogFooter className="grid gap-3 border-t border-border px-5 pt-4 pb-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:pr-8">
          <div className="min-w-0 text-xs leading-5 text-muted-foreground">
            {selectedVersion ? (
              <>
                <p className="truncate text-foreground">
                  {getAttachmentRevisionModifier(selectedVersion)} ·{" "}
                  {formatDateTime(
                    getAttachmentRevisionModifiedAt(selectedVersion)
                  )}
                </p>
                <p>{copy.selectedImpact}</p>
              </>
            ) : canResetHead ? (
              copy.selectPrompt
            ) : (
              copy.locked
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              disabled={resetDisabled}
              aria-label={
                selectedVersion
                  ? formatWorkbenchCopy(copy.resetTo, {
                      version: String(selectedVersion.version),
                    })
                  : copy.title
              }
              onClick={() => {
                if (selectedVersion) {
                  onReset(selectedVersion.id);
                }
              }}
            >
              {copy.reset}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectFileMenuItem({
  label,
  icon,
  disabled = false,
  destructive = false,
  closeOnClick,
  onClick,
}: {
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  closeOnClick?: boolean;
  onClick?: () => void;
}) {
  const closeMobileSheet = useContext(MobileFileActionCloseContext);
  if (closeMobileSheet) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="emp-mobile-file-action"
        data-destructive={destructive || undefined}
        disabled={disabled}
        onClick={() => {
          onClick?.();
          if (closeOnClick !== false) {
            closeMobileSheet();
          }
        }}
      >
        {icon}
        {label}
      </Button>
    );
  }
  return (
    <ContextMenuItem
      disabled={disabled}
      variant={destructive ? "destructive" : "default"}
      closeOnClick={closeOnClick}
      className="gap-2 px-2.5 py-2 font-medium"
      onClick={onClick}
    >
      {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      <span>{label}</span>
    </ContextMenuItem>
  );
}

function filterProjectAttachmentsForNode(
  attachments: ProjectAttachment[],
  node: WorkflowNode
) {
  return attachments.filter((attachment) => {
    const workflowNodeId =
      attachment.workingPaper?.workflowNodeId ?? attachment.workflowNodeId;
    return workflowNodeId === node.id;
  });
}

function getProjectAttachmentBucket(
  attachment: ProjectAttachment
): WorkingPaperBucket {
  return attachment.workingPaper?.bucket ?? attachment.bucket ?? "CURRENT";
}

function collectWorkflowPapers(
  nodes: WorkflowNode[]
): WorkflowNode["workingPapers"] {
  return nodes.flatMap((node) => [
    ...(node.workingPapers ?? []),
    ...collectWorkflowPapers(node.children ?? []),
  ]);
}

function collectSmartFormWorkingPaperOptions(
  nodes: WorkflowNode[],
  ancestors: string[] = []
): SmartFormWorkingPaperOption[] {
  return nodes.flatMap((node) => {
    const nodeLabel = formatReviewQuestionPathNode(node);
    const path = nodeLabel ? [...ancestors, nodeLabel] : ancestors;
    const papers = (node.workingPapers ?? []).map((paper) => {
      const paperCode = formatDisplayName(paper.code);
      return {
        id: paper.id,
        code: paper.code,
        title: paper.title,
        path: [...path, paperCode].filter(Boolean).join(" \u203A "),
        pathSegments: path,
      };
    });
    return [
      ...papers,
      ...collectSmartFormWorkingPaperOptions(node.children ?? [], path),
    ];
  });
}

function WorkingPaperDetail({
  projectName,
  projectLanguage,
  copy = defaultPaperSectionCopy,
  paper,
  currentUserId,
  currentProjectRole,
  deleteAttachment,
  downloadAttachment,
  downloadAttachmentReadOnly,
  openAttachmentLocally,
  downloadAttachmentCopy,
  projectAttachments,
  projectAttachmentsLoading,
  desktopAgentSessions,
  checkInDesktopSession,
  releaseDesktopSession,
  restoreAttachment: _unused_restoreAttachment,
  restoreTargetPapers,
  updateAttachmentIdentity,
  renameAttachment,
  onSetAttachmentClipboard,
  onMoveAttachmentsToNode,
  restoreAttachmentVersion,
  prepare,
  review,
  prepareWorkingPaper,
  reviewWorkingPaper,
  prepareAttachment,
  removePreparationSignoff,
  reviewAttachment,
  pending,
  readOnly = false,
  onBackToFolder,
  projectId,
  workflow,
  onPaperChanged,
  signoffStatusCopy = defaultSignoffStatusCopy,
  disableFileMutations = false,
  forceReadOnlyOpen = false,
  canSignPreparer = true,
}: {
  projectName: string;
  projectLanguage?: ProjectLanguage;
  copy?: WorkbenchPaperSectionCopy;
  paper: NonNullable<WorkflowNode["workingPapers"][number]>;
  currentUserId?: string | null;
  currentProjectRole: ProjectRole | null;
  deleteAttachment: (attachmentId: string) => void;
  downloadAttachment: (attachment: Attachment) => void;
  downloadAttachmentReadOnly: (attachment: Attachment) => void;
  openAttachmentLocally: (attachment: Attachment) => void;
  downloadAttachmentCopy: (attachment: Attachment) => void;
  projectAttachments: ProjectAttachment[];
  projectAttachmentsLoading: boolean;
  desktopAgentSessions: DesktopAgentSession[];
  checkInDesktopSession: (
    session: DesktopAgentSession,
    attachment: ProjectAttachment
  ) => void;
  releaseDesktopSession: (
    session: DesktopAgentSession,
    attachment: ProjectAttachment
  ) => void;
  restoreAttachment: (attachmentId: string, workingPaperId?: string) => void;
  restoreTargetPapers: WorkflowNode["workingPapers"];
  updateAttachmentIdentity: (attachmentId: string, code: string) => void;
  renameAttachment: (attachmentId: string, originalName: string) => void;
  onSetAttachmentClipboard?: (clipboard: DirectoryFileClipboard) => void;
  onMoveAttachmentsToNode?: (
    files: DirectoryFileTransfer[],
    targetNode: WorkflowNode
  ) => void;
  restoreAttachmentVersion: (attachmentId: string, versionId: string) => void;
  prepare: () => void;
  review: () => void;
  prepareWorkingPaper: (paperId: string) => void;
  reviewWorkingPaper: (paperId: string) => void;
  prepareAttachment: (attachmentId: string) => void;
  removePreparationSignoff: (signoffId: string) => void;
  reviewAttachment: (attachmentId: string) => void;
  pending: boolean;
  readOnly?: boolean;
  onBackToFolder: () => void;
  projectId: string;
  workflow: WorkflowNode[];
  onPaperChanged: () => Promise<void>;
  signoffStatusCopy?: WorkbenchSignoffStatusCopy;
  disableFileMutations?: boolean;
  forceReadOnlyOpen?: boolean;
  canSignPreparer?: boolean;
}) {
  const searchParams = useSearchParams();
  const projectFileIndexCopy =
    copy.projectFileIndex ?? defaultProjectFileIndexCopy;
  const paperToolsCopy = copy.paperTools ?? defaultPaperToolsCopy;
  const multiRoundSignoffCopy = {
    ...defaultSignoffStatusCopy,
    ...signoffStatusCopy,
  } as Required<WorkbenchSignoffStatusCopy>;
  const attachments = paper.attachments ?? [];
  const filecheckAttachmentId =
    searchParams?.get("focus") === "attachment"
      ? searchParams.get("attachmentId")
      : null;
  const primaryAttachment =
    attachments.find((attachment) => attachment.id === filecheckAttachmentId) ??
    attachments[0] ??
    null;
  const signoffs = getPaperSignoffs(paper);
  const preparerSignoffs = signoffs.filter(
    (signoff) => signoff.type === "PREPARER"
  );
  const reviewerSignoffs = signoffs.filter(
    (signoff) => signoff.type === "REVIEWER"
  );
  const reviewQuestions = getFileLevelReviewQuestions(paper.reviewQuestions);
  const canSignoff = Boolean(currentProjectRole);
  const canReview = canSignoff;
  const isSelfReview = Boolean(
    currentUserId &&
    preparerSignoffs.some((signoff) => signoff.user.id === currentUserId)
  );
  const canSubmitPreparationNow = canSignPreparer && canSignoff;
  const members = useQuery({
    queryKey: ["members", projectId],
    queryFn: () => api.members(projectId),
    enabled: canReview && Boolean(currentUserId),
  });
  const createQuestion = useMutation({
    mutationFn: (input: {
      body: string;
      assignedToId?: string;
      paperId?: string;
      referencedWorkingPaperIds?: string[];
    }) =>
      api.createWorkingPaperQuestion(projectId, input.paperId || paper.id, {
        body: input.body,
        assignedToId: input.assignedToId ?? "",
        referencedWorkingPaperIds: input.referencedWorkingPaperIds,
      }),
    onSuccess: onPaperChanged,
  });
  const replyQuestion = useMutation({
    mutationFn: ({
      questionId,
      payload,
    }: {
      questionId: string;
      payload: ReviewQuestionReplyPayload;
    }) => api.replyWorkingPaperQuestion(projectId, questionId, payload),
    onSuccess: onPaperChanged,
  });
  const markRepliedQuestion = useMutation({
    mutationFn: (questionId: string) =>
      api.markWorkingPaperQuestionReplied(projectId, questionId),
    onSuccess: onPaperChanged,
  });
  const clearQuestion = useMutation({
    mutationFn: (questionId: string) =>
      api.clearWorkingPaperQuestion(projectId, questionId),
    onSuccess: onPaperChanged,
  });
  const followUpQuestion = useMutation({
    mutationFn: ({ questionId, body }: { questionId: string; body: string }) =>
      api.followUpWorkingPaperQuestion(projectId, questionId, { body }),
    onSuccess: onPaperChanged,
  });
  const reopenQuestion = useMutation({
    mutationFn: ({ questionId, body }: { questionId: string; body: string }) =>
      api.reopenWorkingPaperQuestion(projectId, questionId, { body }),
    onSuccess: onPaperChanged,
  });
  const signoffPending =
    pending ||
    createQuestion.isPending ||
    replyQuestion.isPending ||
    markRepliedQuestion.isPending ||
    clearQuestion.isPending ||
    followUpQuestion.isPending ||
    reopenQuestion.isPending;
  const [isToolMenuOpen, setIsToolMenuOpen] = useState(false);
  const [activeToolPanel, setActiveToolPanel] =
    useState<PaperToolPanelId | null>(null);
  const [isSelfReviewWarningOpen, setIsSelfReviewWarningOpen] = useState(false);
  const filecheckFocusHandledRef = useRef<string | null>(null);

  useEffect(() => {
    const focus = searchParams?.get("focus");
    if (focus !== "signoff" && focus !== "q") {
      return;
    }
    const targetPaperId = searchParams.get("locatePaperId");
    if (targetPaperId && targetPaperId !== paper.id) {
      return;
    }
    const key = `${paper.id}:${focus}:${searchParams.get("reviewQuestionId") ?? ""}`;
    if (filecheckFocusHandledRef.current === key) {
      return;
    }
    filecheckFocusHandledRef.current = key;
    setActiveToolPanel(focus === "q" ? "questions" : "signoff");
  }, [paper.id, searchParams]);

  function openToolPanel(panelId: PaperToolPanelId) {
    setActiveToolPanel(panelId);
    setIsToolMenuOpen(false);
  }

  return (
    <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <div className="flex min-h-0 items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="default"
          className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground"
          onClick={onBackToFolder}
        >
          <ArrowLeft className="h-4 w-4" />
          {paperToolsCopy.backToFiles}
        </Button>
        <div className="relative shrink-0">
          <Button
            variant="outline"
            type="button"
            size="icon"
            className="h-9 w-9 border-border bg-background text-muted-foreground shadow-sm shadow-foreground/5 hover:border-primary/30 hover:bg-surface hover:text-primary"
            aria-haspopup="menu"
            aria-expanded={isToolMenuOpen}
            onClick={() => setIsToolMenuOpen((current) => !current)}
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">{paperToolsCopy.openFileTools}</span>
          </Button>

          {isToolMenuOpen ? (
            <PaperToolsMenu
              activePanel={activeToolPanel}
              labels={paperToolsCopy.labels}
              onSelect={openToolPanel}
            />
          ) : null}

          {activeToolPanel ? (
            <PaperToolFloatingPanel
              title={paperToolsCopy.labels[activeToolPanel]}
              wide={
                activeToolPanel === "history" ||
                activeToolPanel === "projectFiles"
              }
              closeLabel={paperToolsCopy.close}
              onClose={() => setActiveToolPanel(null)}
            >
              {activeToolPanel === "history" ? (
                primaryAttachment ? (
                  <AttachmentHistoryPanel
                    projectId={projectId}
                    attachment={primaryAttachment}
                    disabled={pending}
                    canResolveConflict={currentProjectRole === "PARTNER"}
                    resetHeadCopy={
                      projectFileIndexCopy.resetHead ?? defaultResetHeadCopy
                    }
                    resetHead={(versionId) =>
                      restoreAttachmentVersion(primaryAttachment.id, versionId)
                    }
                  />
                ) : (
                  <EmptyState
                    title="No file status"
                    description="Upload a file to view current status and file-level history."
                  />
                )
              ) : null}

              {activeToolPanel === "signoff" ? (
                <div className="grid gap-3">
                  <div className="flex flex-wrap gap-2">
                    {canSignoff ? (
                      <>
                        <SignoffButton
                          type="button"
                          variant="success"
                          size="sm"
                          aria-label={multiRoundSignoffCopy.preparedTitle}
                          disabled={
                            signoffPending ||
                            !canSignPreparer ||
                            !canSubmitPreparationNow
                          }
                          onClick={() => prepare()}
                        >
                          <ClipboardCheck className="h-4 w-4" />
                          {multiRoundSignoffCopy.addPreparation}
                        </SignoffButton>
                        <ProjectFileSignerAvatars
                          signoffs={preparerSignoffs}
                          onRemove={removePreparationSignoff}
                          removeLabel={
                            multiRoundSignoffCopy.removePreparedLabel
                          }
                        />
                      </>
                    ) : null}
                    {canReview ? (
                      <>
                        <SignoffButton
                          variant="warning"
                          size="sm"
                          type="button"
                          aria-label={multiRoundSignoffCopy.reviewedTitle}
                          disabled={
                            signoffPending || preparerSignoffs.length === 0
                          }
                          onClick={() => {
                            if (isSelfReview) {
                              setIsSelfReviewWarningOpen(true);
                              return;
                            }
                            review();
                          }}
                        >
                          <ShieldCheck className="h-4 w-4" />
                          {multiRoundSignoffCopy.addReview}
                        </SignoffButton>
                        <ProjectFileSignerAvatars
                          signoffs={reviewerSignoffs}
                          onRemove={removePreparationSignoff}
                          removeLabel={
                            multiRoundSignoffCopy.removeReviewedLabel
                          }
                          canRemove={(signoff) =>
                            signoff.user.id === currentUserId ||
                            currentProjectRole === "PARTNER"
                          }
                        />
                      </>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {activeToolPanel === "questions" ? (
                <ReviewQuestionsPanel
                  className="border-0 bg-transparent p-0"
                  copy={copy.reviewQuestions ?? defaultReviewQuestionsCopy}
                  autoOpen
                  canReview={canReview}
                  currentUserId={currentUserId ?? null}
                  members={members.data ?? []}
                  questions={reviewQuestions}
                  workflow={workflow}
                  defaultPaperId={paper.id}
                  pending={signoffPending}
                  createQuestion={(input) => createQuestion.mutateAsync(input)}
                  replyQuestion={(questionId, payload) =>
                    replyQuestion.mutateAsync({ questionId, payload })
                  }
                  uploadQuestionImage={(questionId, file) =>
                    api.uploadReviewQuestionImage(projectId, questionId, file)
                  }
                  attachInitialQuestionFiles={(questionId, images) =>
                    api
                      .attachWorkingPaperQuestionInitialMessage(
                        projectId,
                        questionId,
                        images
                      )
                      .then((question) => {
                        onPaperChanged();
                        return question;
                      })
                  }
                  downloadQuestionImage={(imageId) =>
                    api.downloadReviewQuestionImage(projectId, imageId)
                  }
                  markRepliedQuestion={(questionId) =>
                    markRepliedQuestion.mutate(questionId)
                  }
                  clearQuestion={(questionId) =>
                    clearQuestion.mutate(questionId)
                  }
                  followUpQuestion={(questionId, body) =>
                    followUpQuestion.mutate({ questionId, body })
                  }
                  reopenQuestion={(questionId, body) =>
                    reopenQuestion.mutateAsync({ questionId, body })
                  }
                />
              ) : null}

              {activeToolPanel === "projectFiles" ? (
                <ProjectFileIndexPanel
                  projectId={projectId}
                  projectName={projectName}
                  reviewQuestionsCopy={
                    copy.reviewQuestions ?? defaultReviewQuestionsCopy
                  }
                  projectLanguage={projectLanguage}
                  attachments={projectAttachments}
                  loading={projectAttachmentsLoading}
                  desktopAgentSessions={desktopAgentSessions}
                  currentUserId={currentUserId}
                  currentProjectRole={currentProjectRole}
                  pending={pending}
                  readOnly={readOnly}
                  disableFileMutations={disableFileMutations}
                  forceReadOnlyOpen={forceReadOnlyOpen}
                  downloadAttachment={downloadAttachment}
                  downloadAttachmentReadOnly={downloadAttachmentReadOnly}
                  openAttachmentLocally={openAttachmentLocally}
                  downloadAttachmentCopy={downloadAttachmentCopy}
                  checkInDesktopSession={checkInDesktopSession}
                  releaseDesktopSession={releaseDesktopSession}
                  deleteAttachment={deleteAttachment}
                  restoreTargetPapers={restoreTargetPapers}
                  updateAttachmentIdentity={updateAttachmentIdentity}
                  renameAttachment={renameAttachment}
                  onSetAttachmentClipboard={onSetAttachmentClipboard}
                  onMoveAttachmentsToNode={onMoveAttachmentsToNode}
                  restoreAttachmentVersion={restoreAttachmentVersion}
                  prepareWorkingPaper={prepareWorkingPaper}
                  reviewWorkingPaper={reviewWorkingPaper}
                  prepareAttachment={prepareAttachment}
                  removePreparationSignoff={removePreparationSignoff}
                  reviewAttachment={reviewAttachment}
                  canSignPreparer={canSignPreparer}
                  workflow={workflow}
                  onReviewQuestionsChanged={onPaperChanged}
                  signoffStatusCopy={signoffStatusCopy}
                  copy={projectFileIndexCopy}
                />
              ) : null}
            </PaperToolFloatingPanel>
          ) : null}
        </div>
      </div>
      <AlertDialog
        open={isSelfReviewWarningOpen}
        onOpenChange={setIsSelfReviewWarningOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {multiRoundSignoffCopy.selfReviewTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {multiRoundSignoffCopy.selfReviewDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {multiRoundSignoffCopy.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsSelfReviewWarningOpen(false);
                review();
              }}
            >
              {multiRoundSignoffCopy.signReview}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
        {primaryAttachment ? (
          <AttachmentLockBanner
            attachment={primaryAttachment}
            currentUserId={currentUserId}
          />
        ) : null}
        <div className="min-h-0 flex-1 overflow-hidden">
          {primaryAttachment && isSmartFormAttachment(primaryAttachment) ? (
            <ReadOnlySmartFormPreview
              projectId={projectId}
              attachment={primaryAttachment}
              copy={copy}
            />
          ) : primaryAttachment &&
            getExtendAttachmentPreviewKind(primaryAttachment) ? (
            <ExtendAttachmentPreview
              projectId={projectId}
              attachment={primaryAttachment}
              previewCopy={copy.filePreview}
            />
          ) : (
            <div className="grid h-full min-h-[24rem] place-items-center border border-border bg-surface text-sm text-muted-foreground">
              {primaryAttachment ? (
                <div className="grid justify-items-center gap-3 px-6 text-center">
                  <p>This file type cannot be previewed online yet.</p>
                </div>
              ) : (
                "No preview available"
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReadOnlySmartFormPreview({
  projectId,
  attachment,
  copy,
}: {
  projectId: string;
  attachment: Attachment;
  copy: WorkbenchPaperSectionCopy;
}) {
  return (
    <CachedPdfViewerPreview
      projectId={projectId}
      attachment={attachment}
      copy={copy.filePreview ?? defaultFilePreviewCopy}
    />
  );
}

type WorkingPaperRecord = NonNullable<WorkflowNode["workingPapers"][number]>;

export {
  WORKBENCH_FILE_DRAG_TYPE,
  WORKBENCH_FILE_PREVIEW_DROPPABLE_ID,
} from "../lib/workbench-file-dnd";

export function WorkbenchFilePreviewPane({
  projectId,
  attachment,
  copy = defaultPaperSectionCopy,
  className,
  isPreviewExpanded = false,
  onTogglePreviewExpanded,
  onUploadFile,
  onClose,
  closeLabel = "Close preview",
}: {
  projectId: string;
  attachment: Attachment | ProjectAttachment | null;
  copy?: WorkbenchPaperSectionCopy;
  className?: string;
  isPreviewExpanded?: boolean;
  onTogglePreviewExpanded?: () => void;
  onUploadFile?: (file: File) => void;
  onClose?: () => void;
  closeLabel?: string;
}) {
  const previewCopy = {
    ...defaultFilePreviewCopy,
    ...copy.filePreview,
  };
  const { isOver: isPreviewDropActive, setNodeRef: setPreviewDropNodeRef } =
    useDroppable({
      id: WORKBENCH_FILE_PREVIEW_DROPPABLE_ID,
    });
  const previewCloseContextValue = useMemo(
    () => ({ label: closeLabel, onClose }),
    [closeLabel, onClose]
  );
  return (
    <PreviewCloseContext.Provider value={previewCloseContextValue}>
      <section
        ref={setPreviewDropNodeRef}

        aria-label={previewCopy.title}
        data-testid="file-preview-dropzone"
        data-drag-active={isPreviewDropActive || undefined}
        className={cn(
          "relative h-full min-h-0 min-w-0 overflow-hidden bg-workbench-sidebar [&_.extend-viewer-surface>div]:!p-0 [&_.extend-viewer-surface>div>div]:!rounded-none [&_.extend-viewer-surface>div>div]:!border-0 [&_.extend-viewer-surface>div>div]:!shadow-none",
          onClose &&
            "[&:has([data-preview-toolbar-close])>[data-preview-close-fallback]]:hidden [&:not(:has([data-preview-toolbar-close]))_[data-file-identity-toolbar]]:!pr-12",
          className
        )}
      >
        {onClose ? (
          <Button
            data-preview-close-fallback=""
            type="button"
            variant="ghost"
            size="icon"
            aria-label={closeLabel}
            onClick={onClose}
            className="absolute top-2 right-2 z-30 size-8 shrink-0 rounded-md"
          >
            <X className="size-4" />
          </Button>
        ) : null}
        <WorkbenchFilePreviewContent
          projectId={projectId}
          attachment={attachment}
          copy={copy}
          previewCopy={previewCopy}
          isPreviewDropActive={isPreviewDropActive}
          isPreviewExpanded={isPreviewExpanded}
          onTogglePreviewExpanded={onTogglePreviewExpanded}
          onUploadFile={onUploadFile}
        />
        {attachment && isPreviewDropActive ? (
          <PreviewFileDropzone
            overlay
            isActive
            title={previewCopy.emptyTitle}
            description={previewCopy.emptyDescription}
          />
        ) : null}
      </section>
    </PreviewCloseContext.Provider>
  );
}

export function openAttachmentPreviewInNewWindow(
  projectId: string,
  attachment: Attachment,
  options?: { useNativePdfViewer?: boolean }
) {
  const fileName = getAttachmentDisplayName(attachment);
  const mimeType = attachment.mimeType || "application/octet-stream";
  if (
    !isMockApiMode(getApiMode()) &&
    isPdfAttachment(attachment) &&
    options?.useNativePdfViewer
  ) {
    window.open(
      getAttachmentPreviewPdfUrl(
        projectId,
        attachment.id,
        getPreviewPdfDisplayName(attachment),
        attachment.version
      ),
      "_blank",
      "noopener"
    );
    return;
  }
  if (typeof BroadcastChannel === "undefined") {
    const currentUrl = new URL(window.location.href);
    const locale = currentUrl.pathname.split("/").find(Boolean) ?? "en-US";
    const nonce =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const previewUrl = new URL(`/${locale}/preview`, currentUrl.origin);
    previewUrl.searchParams.set("nonce", nonce);
    window.open(previewUrl.toString(), "_blank");
    return;
  }
  void openAuthorizedPreviewWindow({
    fileName,
    mimeType,
    loadBlob: () =>
      api.previewAttachmentContent(
        projectId,
        attachment.id,
        attachment.version
      ),
  });
}

function WorkbenchFilePreviewContent({
  projectId,
  attachment,
  copy,
  previewCopy,
  isPreviewDropActive,
  isPreviewExpanded,
  onTogglePreviewExpanded,
  onUploadFile,
}: {
  projectId: string;
  attachment: Attachment | null;
  copy: WorkbenchPaperSectionCopy;
  previewCopy: WorkbenchFilePreviewCopy;
  isPreviewDropActive: boolean;
  isPreviewExpanded: boolean;
  onTogglePreviewExpanded?: () => void;
  onUploadFile?: (file: File) => void;
}) {
  if (!attachment) {
    return (
      <PreviewFileDropzone
        title={previewCopy.emptyTitle}
        description={previewCopy.emptyDescription}
        isActive={isPreviewDropActive}
      />
    );
  }

  if (isSmartFormAttachment(attachment)) {
    return (
      <ReadOnlySmartFormPreview
        projectId={projectId}
        attachment={attachment}
        copy={copy}
      />
    );
  }

  if (isSpreadsheetAttachment(attachment)) {
    return (
      <AttachmentPreviewShell
        capabilities={getAttachmentPreviewCapabilities("xlsx")}
        family="spreadsheet"
        isDark={false}
      >
        <CachedSpreadsheetPreview
          projectId={projectId}
          attachment={attachment}
          copy={previewCopy}
          toolbarActions={
            <ExtendAttachmentToolbarActions
              projectId={projectId}
              attachment={attachment}
              expandLabel={previewCopy.expandLabel}
              exitExpandedLabel={previewCopy.exitExpandedLabel}
              presentationLabel={previewCopy.presentationLabel}
              isPreviewExpanded={isPreviewExpanded}
              onTogglePreviewExpanded={onTogglePreviewExpanded}
              openInNewWindowLabel={previewCopy.openInNewWindow}
            />
          }
        />
      </AttachmentPreviewShell>
    );
  }

  if (getExtendAttachmentPreviewKind(attachment)) {
    return (
      <ExtendAttachmentPreview
        projectId={projectId}
        attachment={attachment}
        previewCopy={previewCopy}
        isPreviewExpanded={isPreviewExpanded}
        onTogglePreviewExpanded={onTogglePreviewExpanded}
        onUploadFile={onUploadFile}
      />
    );
  }

  return <UnsupportedFilePreview attachment={attachment} copy={previewCopy} />;
}

function PreviewFileDropzone({
  title,
  description,
  isActive,
  overlay = false,
}: {
  title: string;
  description: string;
  isActive: boolean;
  overlay?: boolean;
}) {
  return (
    <div
      className={cn(
        "h-full min-h-0 p-[11px]",
        overlay && "pointer-events-none absolute inset-0 bg-workbench-sidebar"
      )}
    >
      <FileUpload
        disabled
        fill
        isActive={isActive}
        showBrowseLabel={false}
        showFileList={false}
        title={title}
        description={description}
        browseLabel="Drag a workbench file here"
        draggingLabel="Drop to preview"
        borderBeamRadius={10}
        dropzoneClassName="rounded-lg"
        className="h-full w-full"
      />
    </div>
  );
}

function PreviewReadingSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("h-full min-h-0 overflow-hidden bg-background", className)}
    >
      {children}
    </div>
  );
}

function ExtendAttachmentPreview({
  projectId,
  attachment,
  previewCopy = defaultFilePreviewCopy,
  isPreviewExpanded = false,
  onTogglePreviewExpanded,
  onUploadFile,
}: {
  projectId: string;
  attachment: Attachment;
  previewCopy?: WorkbenchFilePreviewCopy;
  isPreviewExpanded?: boolean;
  onTogglePreviewExpanded?: () => void;
  onUploadFile?: (file: File) => void;
}) {
  const previewKind = getExtendAttachmentPreviewKind(attachment);
  const preview = useQuery({
    queryKey: previewKind
      ? attachmentContentPreviewQueryKey(projectId, attachment, previewKind)
      : ["extendAttachmentPreview", "unsupported", attachment.id],
    queryFn: () =>
      api.previewAttachmentContent(
        projectId,
        attachment.id,
        attachment.version
      ),
    enabled: Boolean(previewKind),
    retry: false,
    staleTime: PREVIEW_QUERY_STALE_TIME_MS,
    gcTime: PREVIEW_QUERY_GC_TIME_MS,
    meta: PREVIEW_QUERY_META,
  });
  const sourceUrl = useBlobObjectUrl(preview.data);
  const csvData = useCsvPreviewData(preview.data, previewKind === "csv");

  useEffect(() => {
    if (preview.error) {
      showErrorToast(
        preview.error,
        previewCopy.previewFailedTitle ??
          defaultFilePreviewCopy.previewFailedTitle ??
          "Preview could not be loaded"
      );
    }
  }, [preview.error, previewCopy.previewFailedTitle]);

  if (preview.isError) {
    return (
      <PreviewLoadErrorState
        retryLabel={
          previewCopy.retryPreview ??
          defaultFilePreviewCopy.retryPreview ??
          "Retry"
        }
        onRetry={() => preview.refetch()}
      />
    );
  }
  if (preview.isLoading || !preview.data || !sourceUrl || !previewKind) {
    return <PreviewLoadingState label={previewCopy.loadingPreview} />;
  }

  return (
    <ExtendAttachmentViewer
      projectId={projectId}
      attachment={attachment}
      csvData={csvData}
      openInNewWindowLabel={previewCopy.openInNewWindow}
      expandLabel={previewCopy.expandLabel}
      exitExpandedLabel={previewCopy.exitExpandedLabel}
      presentationLabel={previewCopy.presentationLabel}
      isPreviewExpanded={isPreviewExpanded}
      onTogglePreviewExpanded={onTogglePreviewExpanded}
      onUploadFile={onUploadFile}
      previewKind={previewKind}
      sourceBlob={preview.data}
      sourceUrl={sourceUrl}
    />
  );
}

function ExtendAttachmentViewer({
  projectId,
  attachment,
  csvData,
  expandLabel,
  exitExpandedLabel,
  isPreviewExpanded,
  openInNewWindowLabel,
  presentationLabel,
  onTogglePreviewExpanded,
  onUploadFile,
  previewKind,
  sourceBlob,
  sourceUrl,
}: {
  projectId: string;
  attachment: Attachment;
  csvData: string;
  expandLabel: string;
  exitExpandedLabel: string;
  isPreviewExpanded: boolean;
  openInNewWindowLabel: string;
  presentationLabel: string;
  onTogglePreviewExpanded?: () => void;
  onUploadFile?: (file: File) => void;
  previewKind: AttachmentPreviewKind;
  sourceBlob: Blob;
  sourceUrl: string;
}) {
  const [isDark, setIsDark] = usePreviewDarkMode();
  const fileName = getAttachmentDisplayName(attachment);
  const previewCapabilities = getAttachmentPreviewCapabilities(previewKind);
  const previewFamily = getAttachmentPreviewFamily(previewKind);
  const className = "h-full min-h-0";
  const toolbarActions = (
    <ExtendAttachmentToolbarActions
      projectId={projectId}
      attachment={attachment}
      expandLabel={expandLabel}
      exitExpandedLabel={exitExpandedLabel}
      presentationLabel={presentationLabel}
      isPreviewExpanded={isPreviewExpanded}
      onTogglePreviewExpanded={onTogglePreviewExpanded}
      openInNewWindowLabel={openInNewWindowLabel}
    />
  );

  if (
    previewKind === "email" ||
    previewKind === "image" ||
    previewKind === "media" ||
    previewKind === "text"
  ) {
    return (
      <AttachmentPreviewShell
        capabilities={previewCapabilities}
        family={previewFamily}
        isDark={isDark}
      >
        <DocumentAssetViewer
          capabilities={previewCapabilities}
          className={className}
          fileName={fileName}
          kind={previewKind}
          source={sourceBlob}
          sourceUrl={sourceUrl}
          toolbarActions={toolbarActions}
        />
      </AttachmentPreviewShell>
    );
  }

  if (previewKind === "archive") {
    return (
      <AttachmentPreviewShell
        capabilities={previewCapabilities}
        family={previewFamily}
        isDark={false}
      >
        <ArchiveViewer
          className={className}
          fileName={fileName}
          source={sourceBlob}
          toolbarActions={toolbarActions}
        />
      </AttachmentPreviewShell>
    );
  }

  if (previewKind === "pdf") {
    return (
      <AttachmentPreviewShell
        capabilities={previewCapabilities}
        family={previewFamily}
        isDark={isDark}
      >
        <PDFViewer
          annotationProjectId={projectId}
          className={className}
          fileName={fileName}
          nativeSrc={
            isMockApiMode(getApiMode())
              ? sourceUrl
              : getAttachmentPreviewPdfUrl(
                  projectId,
                  attachment.id,
                  getPreviewPdfDisplayName(attachment),
                  attachment.version
                )
          }
          showUpload={Boolean(onUploadFile)}
          src={sourceUrl}
          toolbarActions={toolbarActions}
          onUpload={onUploadFile}
        />
      </AttachmentPreviewShell>
    );
  }
  if (previewKind === "docx") {
    return (
      <AttachmentPreviewShell
        capabilities={previewCapabilities}
        family={previewFamily}
        isDark={isDark}
      >
        <DocxViewerPreview
          className={className}
          fileName={fileName}
          isDark={isDark}
          onIsDarkChange={setIsDark}
          showUpload={false}
          src={sourceUrl}
          toolbarActions={toolbarActions}
        />
      </AttachmentPreviewShell>
    );
  }
  if (previewKind === "pptx") {
    return (
      <AttachmentPreviewShell
        capabilities={previewCapabilities}
        family={previewFamily}
        isDark={isDark}
      >
        <PptxViewerPreview
          className={className}
          fileName={fileName}
          showUpload={false}
          src={sourceUrl}
          toolbarActions={toolbarActions}
        />
      </AttachmentPreviewShell>
    );
  }
  if (previewKind === "csv") {
    return (
      <AttachmentPreviewShell
        capabilities={previewCapabilities}
        family={previewFamily}
        isDark={isDark}
      >
        <CsvViewer
          className={className}
          data={csvData}
          toolbarActions={toolbarActions}
        />
      </AttachmentPreviewShell>
    );
  }
  return (
    <AttachmentPreviewShell
      capabilities={previewCapabilities}
      family={previewFamily}
      isDark={isDark}
    >
      <XlsxViewerPreview
        className={className}
        fileName={fileName}
        isDark={isDark}
        onIsDarkChange={setIsDark}
        showUpload={false}
        src={sourceUrl}
        toolbarActions={toolbarActions}
      />
    </AttachmentPreviewShell>
  );
}

function ExtendAttachmentToolbarActions({
  projectId,
  attachment,
  expandLabel,
  exitExpandedLabel,
  isPreviewExpanded,
  onTogglePreviewExpanded,
  openInNewWindowLabel,
  presentationLabel,
}: {
  projectId: string;
  attachment: Attachment;
  expandLabel: string;
  exitExpandedLabel: string;
  isPreviewExpanded: boolean;
  onTogglePreviewExpanded?: () => void;
  openInNewWindowLabel: string;
  presentationLabel: string;
}) {
  const { useNativePdfViewer } = useNativePdfViewerPreference();
  const isPdf = isPdfAttachment(attachment);

  return (
    <PreviewPanelActions
      expandLabel={expandLabel}
      exitExpandedLabel={exitExpandedLabel}
      isPreviewExpanded={isPreviewExpanded}
      onTogglePreviewExpanded={onTogglePreviewExpanded}
      openInNewWindowLabel={openInNewWindowLabel}
      presentationLabel={isPdf ? presentationLabel : undefined}
      onOpenInNewWindow={() =>
        openAttachmentPreviewInNewWindow(projectId, attachment, {
          useNativePdfViewer,
        })
      }
    />
  );
}

function useBlobObjectUrl(blob: Blob | undefined) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setSourceUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(blob);
    setSourceUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [blob]);

  return sourceUrl;
}

function useCsvPreviewData(blob: Blob | undefined, enabled: boolean) {
  const [csvData, setCsvData] = useState("");

  useEffect(() => {
    let active = true;
    if (!blob || !enabled) {
      setCsvData("");
      return;
    }
    void readBlobText(blob).then((data) => {
      if (active) {
        setCsvData(data);
      }
    });
    return () => {
      active = false;
    };
  }, [blob, enabled]);

  return csvData;
}

function readBlobText(blob: Blob) {
  return blob.text();
}

function UnsupportedFilePreview({
  attachment,
  copy,
}: {
  attachment: Attachment;
  copy: WorkbenchFilePreviewCopy;
}) {
  const fileName = getAttachmentDisplayName(attachment);

  return (
    <PreviewReadingSurface className="grid place-items-center p-4">
      <div className="flex max-w-xs flex-col items-center rounded-sm bg-background p-4 text-center shadow-[0_1px_2px_rgb(15_23_42/0.06),0_12px_24px_rgb(15_23_42/0.05)]">
        <ProjectFileTypeIcon fileName={fileName} />
        <h3 className="mt-4 text-sm font-semibold text-foreground">
          {copy.unsupportedTitle}
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {copy.unsupportedDescription}
        </p>
      </div>
    </PreviewReadingSurface>
  );
}

function PaperToolsMenu({
  activePanel,
  labels,
  onSelect,
}: {
  activePanel: PaperToolPanelId | null;
  labels: WorkbenchPaperToolsCopy["labels"];
  onSelect: (panelId: PaperToolPanelId) => void;
}) {
  const items: PaperToolPanelId[] = [
    "history",
    "projectFiles",
    "signoff",
    "questions",
  ];

  return (
    <ButtonGroup
      orientation="vertical"
      role="menu"
      className="absolute top-11 right-0 z-40 w-44 rounded-md border border-border bg-card p-1.5 shadow-xl shadow-foreground/10"
    >
      {items.map((item) => (
        <Button
          key={item}
          type="button"
          variant="ghost"
          size="default"
          role="menuitem"
          className={cn(
            "flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm font-medium transition",
            activePanel === item
              ? "bg-accent text-foreground"
              : "text-foreground hover:bg-surface"
          )}
          onClick={() => onSelect(item)}
        >
          {labels[item]}
        </Button>
      ))}
    </ButtonGroup>
  );
}

function PaperToolFloatingPanel({
  title,
  wide = false,
  closeLabel,
  onClose,
  children,
}: {
  title: string;
  wide?: boolean;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <aside
      className={cn(
        "absolute right-0 top-11 z-30 grid max-h-[min(42rem,calc(100vh-14rem))] grid-rows-[auto_1fr] overflow-hidden rounded-lg border border-border bg-card shadow-2xl shadow-foreground/15",
        wide
          ? "w-[min(58rem,calc(100vw-2rem))]"
          : "w-[min(34rem,calc(100vw-2rem))]"
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
        <h3 className="font-medium text-foreground">{title}</h3>
        <Button
          variant="outline"
          type="button"
          size="icon"
          className="h-8 w-8 border-transparent bg-transparent hover:bg-background"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">{closeLabel}</span>
        </Button>
      </div>
      <div className="min-h-0 overflow-y-auto p-4">{children}</div>
    </aside>
  );
}

export function AttachmentRecycleBinPanel({
  attachments,
  loading,
  pending,
  restoreTargetNodes,
  pathNodes,
  fullDialogOpen,
  onFullDialogOpenChange,
  showViewAllButton = true,
  compact = false,
  dialogOnly = false,
  restoreAttachment,
}: {
  attachments: Attachment[];
  loading: boolean;
  pending: boolean;
  restoreTargetNodes: WorkflowNode[];
  pathNodes?: WorkflowNode[];
  fullDialogOpen?: boolean;
  onFullDialogOpenChange?: (open: boolean) => void;
  showViewAllButton?: boolean;
  compact?: boolean;
  dialogOnly?: boolean;
  restoreAttachment: (
    attachmentId: string,
    target: RestoreAttachmentTarget
  ) => void;
}) {
  const [targetByAttachment, setTargetByAttachment] = useState<
    Record<string, string>
  >({});
  const [internalFullDialogOpen, setInternalFullDialogOpen] = useState(false);
  const [recycleBinSearch, setRecycleBinSearch] = useState("");
  const resolvedFullDialogOpen = fullDialogOpen ?? internalFullDialogOpen;
  const setResolvedFullDialogOpen =
    onFullDialogOpenChange ?? setInternalFullDialogOpen;
  const attachmentPathById = useMemo(() => {
    const roots = pathNodes ?? restoreTargetNodes;
    return new Map(
      attachments.map((attachment) => [
        attachment.id,
        getDeletedAttachmentPath(roots, attachment),
      ])
    );
  }, [attachments, pathNodes, restoreTargetNodes]);
  const restoreTargetTree = useMemo(
    () => buildRestoreTargetTree(pathNodes ?? restoreTargetNodes),
    [pathNodes, restoreTargetNodes]
  );
  const originalTargetNodeByAttachmentId = useMemo(
    () =>
      new Map(
        attachments.map((attachment) => [
          attachment.id,
          getOriginalRestoreNodeId(restoreTargetTree, attachment),
        ])
      ),
    [attachments, restoreTargetTree]
  );
  const normalizedRecycleBinSearch = recycleBinSearch
    .trim()
    .toLocaleLowerCase();
  const dialogAttachments = useMemo(() => {
    if (!normalizedRecycleBinSearch) {
      return attachments;
    }

    return attachments.filter((attachment) => {
      const originalTargetNodeId = originalTargetNodeByAttachmentId.get(
        attachment.id
      );
      const selectedTarget =
        targetByAttachment[attachment.id] ??
        (originalTargetNodeId ? ORIGINAL_RESTORE_TARGET : "");
      const deletedFromPath = attachmentPathById.get(attachment.id) ?? "";
      const selectedPathLabel =
        selectedTarget === ORIGINAL_RESTORE_TARGET
          ? deletedFromPath
          : selectedTarget
            ? findWorkflowNodePath(restoreTargetTree, selectedTarget)
                .map((node) => node.code)
                .filter(Boolean)
                .join(" / ")
            : "";
      const searchText = [
        getAttachmentDisplayName(attachment),
        attachment.deletedAt ? formatDateTime(attachment.deletedAt) : "",
        deletedFromPath,
        selectedPathLabel,
        attachment.deletedFromWorkingPaperCode,
        attachment.deletedFromWorkingPaperTitle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();

      return searchText.includes(normalizedRecycleBinSearch);
    });
  }, [
    attachments,
    attachmentPathById,
    normalizedRecycleBinSearch,
    originalTargetNodeByAttachmentId,
    restoreTargetTree,
    targetByAttachment,
  ]);
  const previewAttachments = attachments.slice(0, 3);
  const renderRows = (items: Attachment[], expanded: boolean) =>
    items.map((attachment) => {
      const attachmentName = getAttachmentDisplayName(attachment);
      const deletedFromPath = attachmentPathById.get(attachment.id) ?? "";
      const originalTargetNodeId = originalTargetNodeByAttachmentId.get(
        attachment.id
      );
      const hasOriginalLocation = Boolean(originalTargetNodeId);
      const selectedTarget =
        targetByAttachment[attachment.id] ??
        (hasOriginalLocation ? ORIGINAL_RESTORE_TARGET : "");
      const canRestore = Boolean(selectedTarget);
      const selectedPathLabel =
        selectedTarget === ORIGINAL_RESTORE_TARGET
          ? deletedFromPath
          : selectedTarget
            ? findWorkflowNodePath(restoreTargetTree, selectedTarget)
                .map((node) => node.code)
                .filter(Boolean)
                .join(" / ")
            : "";

      return (
        <div
          key={attachment.id}
          data-testid={`${expanded ? "recycle-bin-dialog-row" : "recycle-bin-row"}-${attachment.id}`}
          className={cn(
            "grid w-full min-w-0 max-w-full gap-x-1 gap-y-0.5 overflow-hidden rounded-md border border-border bg-background px-2 py-0.5 text-sm",
            expanded
              ? "lg:grid-cols-[minmax(8.5rem,0.42fr)_minmax(0,2.06fr)_minmax(9.5rem,11rem)] lg:items-stretch"
              : compact
                ? "grid-cols-1 gap-y-2 px-3 py-2"
                : "lg:grid-cols-[minmax(7.5rem,0.52fr)_minmax(0,1.7fr)_minmax(9.5rem,11rem)] lg:items-stretch"
          )}
        >
          <div
            className={cn(
              "min-w-0 space-y-0.5",
              expanded &&
                "flex h-full flex-col justify-center rounded-md border border-border/70 bg-surface/40 px-2 py-0.5"
            )}
          >
            <div className="truncate text-sm leading-4 font-medium text-foreground">
              {attachmentName}
            </div>
            {attachment.deletedAt ? (
              <div className="truncate text-xs leading-4 text-muted-foreground">
                {formatDateTime(attachment.deletedAt)}
              </div>
            ) : null}
          </div>
          {expanded ? (
            <div className="grid h-full min-w-0 grid-rows-[3fr_2fr] overflow-hidden rounded-md border border-border/70 bg-surface/40 text-xs leading-4 text-muted-foreground">
              <div className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-1.5 px-2 py-0.5">
                <span className="font-medium whitespace-nowrap text-foreground">
                  Deleted from
                </span>
                <span className="min-w-0 truncate">{deletedFromPath}</span>
              </div>
              <div className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-1.5 border-t border-border/60 bg-background/35 px-2 py-0.5">
                <span className="font-medium whitespace-nowrap text-foreground/80">
                  Restore to
                </span>
                <span className="min-w-0 truncate">{selectedPathLabel}</span>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "min-w-0 text-xs leading-5 text-muted-foreground",
                !compact && "lg:hidden"
              )}
            >
              Deleted from: {deletedFromPath}
            </div>
          )}
          {!expanded && !compact ? (
            <div className="min-w-0 text-xs leading-5 text-muted-foreground max-lg:hidden">
              Deleted from: {deletedFromPath}
            </div>
          ) : null}
          <div className="grid w-full max-w-full min-w-0 gap-0.5 overflow-hidden">
            <RestoreTargetCascade
              attachmentName={attachmentName}
              disabled={pending}
              hasOriginalLocation={hasOriginalLocation}
              roots={restoreTargetTree}
              value={selectedTarget}
              onChange={(value) =>
                setTargetByAttachment((current) => ({
                  ...current,
                  [attachment.id]: value,
                }))
              }
              restoreAction={
                <Button
                  className="h-7 w-full shrink-0 px-2 text-xs"
                  variant="outline"
                  type="button"
                  disabled={pending || !canRestore}
                  onClick={() => {
                    if (selectedTarget === ORIGINAL_RESTORE_TARGET) {
                      restoreAttachment(attachment.id, {});
                      return;
                    }
                    restoreAttachment(attachment.id, {
                      workflowNodeId: selectedTarget,
                    });
                  }}
                >
                  <RefreshCcw className="h-4 w-4" />
                  Restore
                </Button>
              }
            />
          </div>
        </div>
      );
    });
  const fullRecycleBinDialog = (
    <Dialog
      open={resolvedFullDialogOpen}
      onOpenChange={setResolvedFullDialogOpen}
    >
      <DialogContent className="h-[calc(100dvh-2rem)] max-h-[48rem] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Recycle bin</DialogTitle>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DialogDescription className="min-w-0 flex-1">
              Review every deleted file in this project and restore it to the
              original or selected location.
            </DialogDescription>
            {attachments.length > 0 ? (
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Search recycle bin"
                  className="h-8 pr-8 pl-8 text-sm"
                  placeholder="Search deleted files"
                  value={recycleBinSearch}
                  onChange={(event) => setRecycleBinSearch(event.target.value)}
                />
                {recycleBinSearch ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-1/2 right-0.5 h-7 w-7 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setRecycleBinSearch("")}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Clear recycle bin search</span>
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto pr-2">
          {loading ? (
            <div className="grid min-h-40 place-items-center rounded-md border border-border bg-background text-sm text-muted-foreground">
              Loading deleted files...
            </div>
          ) : attachments.length > 0 ? (
            dialogAttachments.length > 0 ? (
              <div className="grid gap-1.5">
                {renderRows(dialogAttachments, true)}
              </div>
            ) : (
              <EmptyState
                title="No deleted files match"
                description="Try a different file name, path, or deleted time."
              />
            )
          ) : (
            <EmptyState
              title="Recycle bin is empty"
              description="Deleted project files will appear here."
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  if (dialogOnly) {
    return fullRecycleBinDialog;
  }

  if (loading) {
    return (
      <div className="grid min-h-40 place-items-center rounded-md border border-border bg-background text-sm text-muted-foreground">
        Loading deleted files...
      </div>
    );
  }

  if (attachments.length === 0) {
    return (
      <div className="grid gap-3">
        {showViewAllButton ? (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setResolvedFullDialogOpen(true)}
            >
              <ChevronRight className="h-4 w-4" />
              Manage
            </Button>
          </div>
        ) : null}
        <EmptyState
          title="Recycle bin is empty"
          description="Deleted project files will appear here."
        />
        {fullRecycleBinDialog}
      </div>
    );
  }

  return (
    <>
      <div className={cn("grid", compact ? "gap-2" : "gap-3")}>
        {showViewAllButton ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Showing latest {previewAttachments.length} of {attachments.length}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setResolvedFullDialogOpen(true)}
            >
              <ChevronRight className="h-4 w-4" />
              Manage
            </Button>
          </div>
        ) : null}
        {!showViewAllButton &&
        attachments.length > previewAttachments.length ? (
          <div className="text-xs leading-4 text-muted-foreground">
            Showing latest {previewAttachments.length} of {attachments.length}
          </div>
        ) : null}
        <div className={cn("grid", compact ? "gap-1.5" : "gap-2")}>
          {renderRows(previewAttachments, false)}
        </div>
      </div>
      {fullRecycleBinDialog}
    </>
  );
}

function getDeletedAttachmentPath(
  nodes: WorkflowNode[],
  attachment: Attachment
) {
  const locatedPath = findDeletedAttachmentPath(nodes, attachment);
  if (locatedPath) {
    return locatedPath;
  }

  return attachment.deletedFromWorkingPaperCode || "Original path unavailable";
}

function findDeletedAttachmentPath(
  nodes: WorkflowNode[],
  attachment: Attachment,
  path: string[] = []
): string | null {
  for (const node of nodes) {
    const nodeLabel = node.code || formatDisplayName(node.title);
    const nextPath = [...path, nodeLabel];
    if (attachment.deletedFromWorkflowNodeId === node.id) {
      return nextPath.join(" / ");
    }
    const paper = (node.workingPapers ?? []).find((item) => {
      if (attachment.deletedFromWorkingPaperId) {
        return item.id === attachment.deletedFromWorkingPaperId;
      }
      return item.code === attachment.deletedFromWorkingPaperCode;
    });

    if (paper) {
      return nextPath.join(" / ");
    }

    const childPath = findDeletedAttachmentPath(
      node.children ?? [],
      attachment,
      nextPath
    );
    if (childPath) {
      return childPath;
    }
  }

  return null;
}

function getOriginalRestoreNodeId(
  nodes: WorkflowNode[],
  attachment: Attachment
): string | null {
  const { deletedFromWorkflowNodeId } = attachment;
  if (
    deletedFromWorkflowNodeId &&
    findWorkflowNodePath(nodes, deletedFromWorkflowNodeId).length > 0
  ) {
    return deletedFromWorkflowNodeId;
  }
  return findDeletedAttachmentNodeId(nodes, attachment);
}

function findDeletedAttachmentNodeId(
  nodes: WorkflowNode[],
  attachment: Attachment
): string | null {
  for (const node of nodes) {
    const paper = (node.workingPapers ?? []).find((item) => {
      if (attachment.deletedFromWorkingPaperId) {
        return item.id === attachment.deletedFromWorkingPaperId;
      }
      return item.code === attachment.deletedFromWorkingPaperCode;
    });
    if (paper) {
      return node.id;
    }

    const childNodeId = findDeletedAttachmentNodeId(
      node.children ?? [],
      attachment
    );
    if (childNodeId) {
      return childNodeId;
    }
  }

  return null;
}

function WorkbenchSelect({
  ariaLabel,
  className = "w-full",
  disabled,
  id,
  onValueChange,
  noResults = "No matching results",
  options,
  placeholder,
  searchable = false,
  searchPlaceholder = "Search",
  size,
  value,
}: {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  onValueChange: (value: string) => void;
  noResults?: string;
  options: { label: string; value: string }[];
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  size?: "sm" | "default";
  value: string;
}) {
  const [search, setSearch] = useState("");
  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  );

  return (
    <Select
      value={value}
      onValueChange={(nextValue) => onValueChange(nextValue ?? "")}
      onOpenChange={(open) => {
        if (!open) {
          setSearch("");
        }
      }}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        className={cn("min-w-0 max-w-full overflow-hidden", className)}
        size={size}
      >
        <SelectValue
          className="min-w-0 overflow-hidden text-ellipsis"
          placeholder={placeholder}
        >
          {selectedOption?.label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="start">
        {searchable ? (
          <div className="px-2 pb-2">
            <Input
              type="search"
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
            />
          </div>
        ) : null}
        <div className={searchable ? "max-h-56 overflow-y-auto" : undefined}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <SelectItem
                key={option.value || "__empty"}
                value={option.value}
                onClick={() => {
                  onValueChange(option.value);
                  setSearch("");
                }}
              >
                {option.label}
              </SelectItem>
            ))
          ) : (
            <span className="block px-2 py-2 text-sm text-muted-foreground">
              {noResults}
            </span>
          )}
        </div>
      </SelectContent>
    </Select>
  );
}

function RestoreTargetCascade({
  attachmentName,
  disabled,
  hasOriginalLocation,
  roots,
  value,
  onChange,
  restoreAction,
}: {
  attachmentName: string;
  disabled: boolean;
  hasOriginalLocation: boolean;
  roots: WorkflowNode[];
  value: string;
  onChange: (value: string) => void;
  restoreAction: ReactNode;
}) {
  const selectedPath =
    value && value !== ORIGINAL_RESTORE_TARGET
      ? findWorkflowNodePath(roots, value)
      : [];
  const currentNode = selectedPath.at(-1);
  const currentOptions = currentNode?.children?.length
    ? currentNode.children
    : selectedPath.length > 0
      ? []
      : roots;
  const currentValue = "";
  const canGoUp = selectedPath.length > 0;

  return (
    <div className="grid w-full max-w-full min-w-0 flex-1 gap-1 overflow-hidden">
      <div className="grid min-w-0 grid-cols-2 gap-1">
        <div className="grid min-w-0 grid-cols-1 gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 w-full shrink-0 px-2 text-xs"
            disabled={disabled || !canGoUp}
            onClick={() =>
              onChange(
                selectedPath.at(-2)?.id ??
                  (hasOriginalLocation ? ORIGINAL_RESTORE_TARGET : "")
              )
            }
          >
            Back
          </Button>
        </div>
        {restoreAction}
      </div>
      <WorkbenchSelect
        size="sm"
        ariaLabel={`Restore target for ${attachmentName}`}
        className="w-full"
        value={currentValue}
        disabled={disabled || currentOptions.length === 0}
        placeholder={
          selectedPath.length > 0
            ? currentOptions.length > 0
              ? "Choose next level"
              : "No deeper level"
            : hasOriginalLocation
              ? "Choose another folder"
              : "Choose a folder"
        }
        onValueChange={(nextValue) => {
          const nextPath = findWorkflowNodePath(roots, nextValue);
          const _unused_nextNode = nextPath.at(-1);
          onChange(nextValue);
        }}
        options={currentOptions.map((node) => ({
          label: `${node.code} · ${formatDisplayName(node.title)}`,
          value: node.id,
        }))}
      />
    </div>
  );
}

function buildRestoreTargetTree(nodes: WorkflowNode[]) {
  if (nodes.some((node) => node.children?.length)) {
    return nodes;
  }

  const byId = new Map<string, WorkflowNode & { children: WorkflowNode[] }>();
  for (const node of nodes) {
    byId.set(node.id, { ...node, children: [] });
  }

  const roots: (WorkflowNode & { children: WorkflowNode[] })[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : null;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function findWorkflowNodePath(
  nodes: WorkflowNode[],
  nodeId: string,
  path: WorkflowNode[] = []
): WorkflowNode[] {
  for (const node of nodes) {
    const nextPath = [...path, node];
    if (node.id === nodeId) {
      return nextPath;
    }
    const childPath = findWorkflowNodePath(
      node.children ?? [],
      nodeId,
      nextPath
    );
    if (childPath.length > 0) {
      return childPath;
    }
  }

  return [];
}

function AttachmentHistoryPanel({
  projectId,
  attachment,
  disabled,
  canResolveConflict,
  resetHeadCopy,
  resetHead,
}: {
  projectId: string;
  attachment: Attachment;
  disabled: boolean;
  canResolveConflict: boolean;
  resetHeadCopy: WorkbenchResetHeadCopy;
  resetHead: (versionId: string) => void;
}) {
  const history = useQuery({
    queryKey: ["attachment-history", projectId, attachment.id],
    queryFn: () => api.attachmentHistory(projectId, attachment.id),
    staleTime: 30_000,
  });
  useEffect(() => {
    if (history.error) {
      showErrorToast(history.error, resetHeadCopy.fileHistoryLoadFailed);
    }
  }, [history.error, resetHeadCopy.fileHistoryLoadFailed]);
  const currentAttachment = history.data?.attachment ?? attachment;

  return (
    <div className="grid gap-3">
      <AttachmentStatusSummary attachment={currentAttachment} />
      <AttachmentConflictResolutionPanel
        projectId={projectId}
        attachment={currentAttachment}
        disabled={disabled}
        canResolve={canResolveConflict}
        copy={resetHeadCopy}
      />
      {history.isLoading ? (
        <div
          className="space-y-3 p-4"
          aria-busy="true"
          aria-label={resetHeadCopy.loadingFileHistory}
        >
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ) : history.isError ? (
        <div className="min-h-40" aria-hidden="true" />
      ) : (
        <>
          <AttachmentVersionHistoryList
            currentAttachment={currentAttachment}
            versions={history.data?.versions ?? []}
            disabled={disabled}
            copy={resetHeadCopy}
            resetHead={resetHead}
          />
          <WorkbenchAuditLogs logs={history.data?.events ?? []} />
        </>
      )}
    </div>
  );
}

type PendingAttachmentConflictResolution = {
  candidate: AttachmentVersion;
  resolution: AttachmentConflictResolution;
  actionLabel: string;
};

function AttachmentConflictResolutionPanel({
  projectId,
  attachment,
  disabled,
  canResolve,
  copy,
}: {
  projectId: string;
  attachment: Attachment;
  disabled: boolean;
  canResolve: boolean;
  copy: WorkbenchResetHeadCopy;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pendingResolution, setPendingResolution] =
    useState<PendingAttachmentConflictResolution | null>(null);
  const conflicts = useQuery({
    queryKey: ["attachment-conflicts", projectId, attachment.id],
    queryFn: () => api.attachmentConflicts(projectId, attachment.id),
    staleTime: 15_000,
  });
  useEffect(() => {
    if (conflicts.error) {
      showErrorToast(conflicts.error, copy.conflictLoadFailed);
    }
  }, [conflicts.error, copy.conflictLoadFailed]);
  const resolveConflict = useMutation({
    mutationFn: ({
      candidate,
      resolution,
    }: PendingAttachmentConflictResolution) =>
      api.resolveAttachmentConflict(
        projectId,
        attachment.id,
        candidate.id,
        resolution
      ),
    onSuccess: async () => {
      setPendingResolution(null);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["attachment-conflicts", projectId, attachment.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["attachment-history", projectId, attachment.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["project-attachments", projectId],
        }),
        queryClient.invalidateQueries({ queryKey: ["workflow", projectId] }),
        queryClient.invalidateQueries({
          queryKey: ["workingPaper", projectId],
        }),
      ]);
      toast({ title: copy.conflictResolved });
    },
    onError: () => {
      toast({
        title: copy.fileHistoryLoadFailed,
        variant: "destructive",
      });
    },
  });
  const candidates = conflicts.data?.candidates ?? [];
  const frozen = conflicts.data?.frozen ?? Boolean(attachment.conflictFrozenAt);

  if (!frozen && candidates.length === 0) {
    return null;
  }

  if (conflicts.isError && candidates.length === 0) {
    return null;
  }

  const detectedAt = conflicts.data?.frozenAt ?? attachment.conflictFrozenAt;

  return (
    <>
      <section className="border-l-2 border-warning-accent bg-warning-subtle px-4 py-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-accent" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {copy.conflictTitle}
                </h3>
                <Badge tone="amber">{copy.conflictFrozenBadge}</Badge>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                {copy.conflictDescription}
              </p>
              {detectedAt ? (
                <p className="text-xs text-muted-foreground">
                  {formatWorkbenchCopy(copy.conflictDetectedAt, {
                    time: formatDateTime(detectedAt),
                  })}
                </p>
              ) : null}
            </div>

            {conflicts.isLoading ? (
              <div
                aria-busy="true"
                aria-label={copy.loadingVersions}
                className="space-y-2 py-2"
              >
                <Skeleton className="h-8 w-full rounded-md" />
                <Skeleton className="h-8 w-full rounded-md" />
              </div>
            ) : (
              candidates.map((candidate) => {
                const shortHash = candidate.contentHash
                  ? `${candidate.contentHash.slice(0, 12)}…`
                  : null;
                const actions: {
                  resolution: AttachmentConflictResolution;
                  label: string;
                  variant: "outline" | "default";
                }[] = [
                  {
                    resolution: "KEEP_SERVER",
                    label: copy.conflictKeepServer,
                    variant: "outline",
                  },
                  {
                    resolution: "USE_CANDIDATE",
                    label: copy.conflictUseCandidate,
                    variant: "default",
                  },
                  {
                    resolution: "REVERT_TO_BASE",
                    label: copy.conflictRevertToBase,
                    variant: "outline",
                  },
                ];

                return (
                  <div
                    key={candidate.id}
                    className="flex flex-col gap-3 border-t border-border/80 pt-3 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium text-foreground">
                          {candidate.originalName ?? candidate.fileName}
                        </span>
                        <Badge tone="amber">
                          {copy.conflictCandidate} {candidate.version}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>{getAttachmentRevisionModifier(candidate)}</span>
                        <span aria-hidden="true">·</span>
                        <time dateTime={candidate.uploadedAt}>
                          {formatDateTime(candidate.uploadedAt)}
                        </time>
                        {shortHash ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">
                              {formatWorkbenchCopy(copy.conflictCandidateHash, {
                                hash: shortHash,
                              })}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {canResolve ? (
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        {actions.map((action) => (
                          <Button
                            key={action.resolution}
                            type="button"
                            size="sm"
                            variant={action.variant}
                            disabled={disabled || resolveConflict.isPending}
                            onClick={() =>
                              setPendingResolution({
                                candidate,
                                resolution: action.resolution,
                                actionLabel: action.label,
                              })
                            }
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {copy.conflictViewOnly}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <AlertDialog
        open={Boolean(pendingResolution)}
        onOpenChange={(open) => {
          if (!open && !resolveConflict.isPending) {
            setPendingResolution(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.conflictConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {formatWorkbenchCopy(copy.conflictConfirmDescription, {
                action: pendingResolution?.actionLabel ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resolveConflict.isPending}>
              {copy.conflictCancel}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!pendingResolution || resolveConflict.isPending}
              onClick={() => {
                if (pendingResolution) {
                  resolveConflict.mutate(pendingResolution);
                }
              }}
            >
              {resolveConflict.isPending ? (
                <Skeleton className="mr-1.5 inline-block size-3.5 rounded-full" />
              ) : null}
              {copy.conflictConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AttachmentVersionHistoryList({
  currentAttachment,
  versions,
  disabled,
  copy,
  resetHead,
}: {
  currentAttachment: Attachment;
  versions: AttachmentVersion[];
  disabled: boolean;
  copy: WorkbenchResetHeadCopy;
  resetHead: (versionId: string) => void;
}) {
  const lockState = getAttachmentLockState(currentAttachment);
  const conflictFrozen = Boolean(currentAttachment.conflictFrozenAt);
  const canResetHead = !lockState.isLocked && !conflictFrozen;
  const timeline = buildAttachmentRevisionTimeline(currentAttachment, versions);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetInitialVersionId, setResetInitialVersionId] = useState<
    string | null
  >(null);

  return (
    <div className="grid gap-2 rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          {copy.versionHistory}
        </h3>
        <Badge tone="slate">
          {formatWorkbenchCopy(copy.versionsCount, {
            count: String(timeline.length),
          })}
        </Badge>
      </div>
      <div className="grid gap-2">
        {timeline.length > 0 ? (
          timeline.map((version, index) => (
            <div
              key={version.id}
              className={cn(
                "grid gap-3 rounded-md border p-3 text-sm md:grid-cols-[1fr_auto] md:items-center",
                version.conflictState === "OPEN"
                  ? "border-warning-accent bg-warning-subtle"
                  : version.isCurrent
                    ? "border-primary/20 bg-primary/5"
                    : "border-border bg-card"
              )}
            >
              <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3">
                <AttachmentVersionRail
                  version={version}
                  isFirst={index === 0}
                  isLast={index === timeline.length - 1}
                />
                <AttachmentVersionSummary
                  version={version}
                  versions={timeline}
                />
              </div>
              {version.isCurrent ? (
                <div className="flex flex-wrap justify-start gap-2 md:justify-end">
                  <Badge tone="sky">{copy.currentHead}</Badge>
                  <Badge tone={lockState.isLocked ? "amber" : "slate"}>
                    {lockState.isLocked
                      ? copy.lockedBadge
                      : copy.availableBadge}
                  </Badge>
                  {conflictFrozen ? (
                    <Badge tone="amber">{copy.conflictFrozenBadge}</Badge>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-wrap justify-start gap-2 md:justify-end">
                  <Badge
                    tone={version.conflictState === "OPEN" ? "amber" : "slate"}
                  >
                    {version.conflictState === "OPEN"
                      ? copy.conflictCandidate
                      : copy.historical}
                  </Badge>
                  <Button
                    variant="outline"
                    type="button"
                    disabled={disabled || !canResetHead}
                    aria-label={
                      conflictFrozen
                        ? copy.conflictResetBlocked
                        : canResetHead
                          ? formatWorkbenchCopy(copy.chooseForReset, {
                              version: String(version.version),
                            })
                          : formatWorkbenchCopy(copy.masterLockedForVersion, {
                              version: String(version.version),
                            })
                    }
                    onClick={() => {
                      setResetInitialVersionId(version.id);
                      setResetDialogOpen(true);
                    }}
                  >
                    <RefreshCcw className="h-4 w-4" />
                    {conflictFrozen
                      ? copy.conflictFrozenBadge
                      : canResetHead
                        ? copy.title
                        : copy.masterLocked}
                  </Button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
            {copy.noVersions}
          </div>
        )}
      </div>
      <ResetHeadDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        versions={timeline}
        loading={false}
        error={null}
        disabled={disabled}
        canResetHead={canResetHead}
        copy={copy}
        initialVersionId={resetInitialVersionId}
        onReset={(versionId) => {
          resetHead(versionId);
          setResetDialogOpen(false);
        }}
      />
    </div>
  );
}

type AttachmentRevisionTimelineItem = AttachmentVersion & {
  depth: number;
  isCurrent: boolean;
};

function buildAttachmentRevisionTimeline(
  currentAttachment: Attachment,
  versions: AttachmentVersion[]
): AttachmentRevisionTimelineItem[] {
  const currentVersion =
    versions.find((version) =>
      isAttachmentRevisionCurrent(version, currentAttachment)
    ) ??
    versions.find((version) => version.version === currentAttachment.version);
  const rows =
    versions.length > 0
      ? versions
      : [
          {
            id: `current-${currentAttachment.id}`,
            attachmentId: currentAttachment.id,
            projectId: "",
            version: currentAttachment.version,
            parentVersionId: null,
            sourceVersionId: null,
            fileKind: currentAttachment.fileKind,
            fileName: currentAttachment.fileName,
            originalName: currentAttachment.originalName,
            fileUrl: currentAttachment.fileUrl,
            fileSize: currentAttachment.fileSize,
            mimeType: currentAttachment.mimeType,
            workDate: currentAttachment.workDate,
            uploadedBy:
              currentAttachment.lastModifiedBy ?? currentAttachment.uploadedBy,
            uploadedAt:
              currentAttachment.lastModifiedAt ?? new Date().toISOString(),
            archivedBy:
              currentAttachment.lastModifiedBy ??
              currentAttachment.uploadedBy ??
              "",
            action: "INITIAL",
            isCurrent: true,
            createdAt:
              currentAttachment.lastModifiedAt ?? new Date().toISOString(),
            uploadedByUser:
              currentAttachment.lastModifier ?? currentAttachment.uploader,
          } satisfies AttachmentVersion,
        ];
  const byId = new Map(rows.map((version) => [version.id, version]));
  const depthCache = new Map<string, number>();

  function getDepth(version: AttachmentVersion, seen = new Set<string>()) {
    if (depthCache.has(version.id)) {
      return depthCache.get(version.id) ?? 0;
    }
    if (!version.parentVersionId || seen.has(version.parentVersionId)) {
      depthCache.set(version.id, 0);
      return 0;
    }
    const parent = byId.get(version.parentVersionId);
    if (!parent) {
      depthCache.set(version.id, 0);
      return 0;
    }
    seen.add(version.id);
    const depth = Math.min(getDepth(parent, seen) + 1, 6);
    depthCache.set(version.id, depth);
    return depth;
  }

  return [...rows]
    .sort(
      (left, right) =>
        left.version - right.version ||
        Date.parse(left.createdAt) - Date.parse(right.createdAt)
    )
    .map((version) => ({
      ...version,
      depth: getDepth(version),
      isCurrent:
        isAttachmentRevisionCurrent(version, currentAttachment) ||
        version.id === currentVersion?.id,
    }));
}

function isAttachmentRevisionCurrent(
  version: AttachmentVersion,
  attachment: Attachment
) {
  return (
    version.isCurrent === true ||
    (attachment.headVersionId ? version.id === attachment.headVersionId : false)
  );
}

function getAttachmentRevisionBranchLabel(
  version: AttachmentVersion,
  versions: AttachmentVersion[]
) {
  if (!version.sourceVersionId) {
    return null;
  }
  const byId = new Map(versions.map((item) => [item.id, item]));
  const source = byId.get(version.sourceVersionId);
  return source ? `branched from ${source.version}` : null;
}

function getAttachmentRevisionModifier(version: AttachmentVersion) {
  return (
    formatAccountDisplayName(version.uploadedByUser) ||
    formatAccountDisplayName(version.archivedByUser) ||
    version.uploadedBy ||
    "Unknown member"
  );
}

function getAttachmentRevisionModifiedAt(version: AttachmentVersion) {
  return version.uploadedAt || version.createdAt;
}

function AttachmentVersionRail({
  version,
  isFirst,
  isLast,
  compact = false,
}: {
  version: AttachmentRevisionTimelineItem;
  isFirst: boolean;
  isLast: boolean;
  compact?: boolean;
}) {
  return (
    <DynamicComponent
      component="div"
      className={cn(
        "relative flex justify-center",
        compact ? "min-h-12 w-5" : "min-h-10 w-6"
      )}
      dynamicStyle={{ marginLeft: `${version.depth * (compact ? 8 : 12)}px` }}
      aria-hidden="true"
    >
      {isFirst ? null : (
        <span className="absolute top-0 h-1/2 w-px bg-border" />
      )}
      {isLast ? null : (
        <span className="absolute bottom-0 h-1/2 w-px bg-border" />
      )}
      <span
        className={cn(
          "absolute top-1/2 -translate-y-1/2 rounded-full border",
          compact ? "h-2.5 w-2.5" : "h-3 w-3",
          version.isCurrent
            ? "border-primary bg-primary"
            : "border-muted-foreground/40 bg-background"
        )}
      />
    </DynamicComponent>
  );
}

function AttachmentVersionSummary({
  version,
  versions,
  compact = false,
}: {
  version: AttachmentVersion;
  versions: AttachmentVersion[];
  compact?: boolean;
}) {
  const modifier = getAttachmentRevisionModifier(version);
  const modifiedAt = getAttachmentRevisionModifiedAt(version);
  const branchLabel = getAttachmentRevisionBranchLabel(version, versions);

  return (
    <div className={cn("min-w-0", compact ? "space-y-1" : "space-y-1.5")}>
      <div className="flex min-w-0 flex-wrap items-center gap-2 font-medium text-foreground">
        <Badge tone={version.isCurrent ? "sky" : "slate"}>
          {version.version}
        </Badge>
        {branchLabel ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-muted-foreground",
              compact ? "text-[11px]" : "text-xs"
            )}
          >
            <GitBranch className="h-3 w-3" />
            {branchLabel}
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground",
          compact ? "text-[11px]" : "text-xs"
        )}
      >
        <span className="truncate">{modifier}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={modifiedAt}>{formatDateTime(modifiedAt)}</time>
      </div>
    </div>
  );
}

function AttachmentStatusSummary({ attachment }: { attachment: Attachment }) {
  const lockState = getAttachmentLockState(attachment);
  const lockLabel = lockState.isLocked ? "Locked" : "Unlocked";
  const lockHolder = lockState.isLocked
    ? formatAccountDisplayName(attachment.lockHolder, "another member")
    : "None";
  const lastModifiedBy =
    formatAccountDisplayName(attachment.lastModifier) ||
    formatAccountDisplayName(attachment.uploader) ||
    "Not recorded";
  const lastModifiedAt = attachment.lastModifiedAt
    ? formatDateTime(attachment.lastModifiedAt)
    : "Not recorded";
  const workDate = attachment.workDate
    ? formatDateOnly(attachment.workDate)
    : "Not recorded";

  return (
    <div className="overflow-hidden rounded-md border border-border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {getAttachmentDisplayName(attachment)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {attachment.version} · {formatFileSize(attachment.fileSize)}
          </p>
        </div>
        <Badge tone={lockState.isLocked ? "amber" : "slate"}>{lockLabel}</Badge>
      </div>
      <dl className="grid grid-cols-2 divide-x divide-y divide-border md:grid-cols-4">
        <AttachmentStatusField label="Status" value={lockLabel} />
        <AttachmentStatusField label="Current holder" value={lockHolder} />
        <AttachmentStatusField
          label="Version"
          value={String(attachment.version)}
        />
        <AttachmentStatusField
          label="Last modified by"
          value={lastModifiedBy}
        />
        <AttachmentStatusField
          label="Locked at"
          value={
            attachment.lockedAt ? formatDateTime(attachment.lockedAt) : "None"
          }
        />
        <AttachmentStatusField
          label="Lock expires"
          value={
            attachment.lockExpiresAt
              ? formatDateTime(attachment.lockExpiresAt)
              : "None"
          }
        />
        <AttachmentStatusField
          label="File size"
          value={formatFileSize(attachment.fileSize)}
        />
        <AttachmentStatusField label="Last modified" value={lastModifiedAt} />
        <AttachmentStatusField label="Work date" value={workDate} />
      </dl>
    </div>
  );
}

function AttachmentStatusField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-sm font-medium text-foreground">
        {value}
      </dd>
    </div>
  );
}

function formatReviewQuestionPathNode(
  node: Pick<WorkflowNode, "code" | "title">
) {
  const code = formatDisplayName(node.code);
  const title = formatDisplayName(node.title);
  if (!code) {
    return title;
  }
  if (!title || title === code) {
    return code;
  }
  return `${code} ${title}`;
}

export function ReviewQuestionsPanel({
  className,
  copy = defaultReviewQuestionsCopy,
  canReview,
  currentUserId,
  members,
  questions,
  workflow,
  defaultPaperId,
  defaultPaper,
  contextTitle,
  contextCode,
  trigger,
  triggerAriaLabel,
  startInCreateMode = false,
  initialQuestionId,
  autoOpen = false,
  hideTrigger = false,
  filterQuestionsByPaper = true,
  pending,
  createQuestion,
  replyQuestion,
  uploadQuestionImage,
  attachInitialQuestionFiles,
  downloadQuestionImage,
  markRepliedQuestion,
  clearQuestion,
  followUpQuestion: _unused_followUpQuestion,
  reopenQuestion,
}: {
  className?: string;
  copy?: WorkbenchReviewQuestionsCopy;
  canReview: boolean;
  currentUserId: string | null;
  members: ProjectMember[];
  questions: WorkingPaperQuestion[];
  workflow?: WorkflowNode[];
  defaultPaperId?: string;
  defaultPaper?: {
    id: string;
    code?: string;
    title?: string;
    workflowNodeId?: string | null;
  };
  contextTitle?: string;
  contextCode?: string;
  trigger?: ReactNode;
  triggerAriaLabel?: string;
  startInCreateMode?: boolean;
  initialQuestionId?: string;
  autoOpen?: boolean;
  hideTrigger?: boolean;
  filterQuestionsByPaper?: boolean;
  pending: boolean;
  createQuestion: (input: {
    body: string;
    assignedToId?: string;
    paperId?: string;
    referencedWorkingPaperIds?: string[];
    smartFormNodeId?: string;
    smartFormRowId?: string;
    smartFormTargetLabel?: string;
  }) => Promise<WorkingPaperQuestion> | WorkingPaperQuestion;
  replyQuestion: (
    questionId: string,
    payload: ReviewQuestionReplyPayload
  ) => undefined | Promise<WorkingPaperQuestion>;
  uploadQuestionImage: (
    questionId: string,
    file: File
  ) => Promise<ConfirmReviewQuestionImageInput>;
  attachInitialQuestionFiles: (
    questionId: string,
    images: ConfirmReviewQuestionImageInput[]
  ) => Promise<WorkingPaperQuestion>;
  downloadQuestionImage: (imageId: string) => Promise<Blob>;
  markRepliedQuestion: (questionId: string) => void;
  clearQuestion: (questionId: string) => void;
  followUpQuestion: (questionId: string, body: string) => void;
  reopenQuestion: (
    questionId: string,
    body: string
  ) => undefined | Promise<WorkingPaperQuestion>;
}) {
  const { confirm } = useToast();
  const allPapers = useMemo(() => {
    const papers: {
      id: string;
      code: string;
      title: string;
      path: string;
      workflowNodeId?: string | null;
    }[] = [];
    function walk(nodes: WorkflowNode[], ancestors: string[]) {
      for (const node of nodes) {
        const label = formatReviewQuestionPathNode(node);
        const p = [...ancestors, label];
        for (const paper of node.workingPapers ?? []) {
          const paperCode = formatDisplayName(paper.code);
          papers.push({
            id: paper.id,
            code: paper.code,
            title: paper.title,
            path: [...p, paperCode].filter(Boolean).join(" \u203A "),
            workflowNodeId: paper.workflowNodeId,
          });
        }
        if (node.children) {
          walk(node.children, p);
        }
      }
    }
    walk(workflow ?? [], []);
    if (
      defaultPaper?.id &&
      !papers.some((paper) => paper.id === defaultPaper.id)
    ) {
      papers.push({
        id: defaultPaper.id,
        code: defaultPaper.code ?? "",
        title: defaultPaper.title || defaultPaper.code || copy.workingPaper,
        path: defaultPaper.code ?? "",
        workflowNodeId: defaultPaper.workflowNodeId,
      });
    }
    return papers;
  }, [copy.workingPaper, defaultPaper, workflow]);
  const [body, setBody] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [createPaperId, setCreatePaperId] = useState("");
  const [questionListFilter, setQuestionListFilter] =
    useState<WorkingPaperQuestion["status"]>("OPEN");
  const [localCreatedQuestions, setLocalCreatedQuestions] = useState<
    WorkingPaperQuestion[]
  >([]);
  const [chatDrafts, setChatDrafts] = useState<Record<string, string>>({});
  const [imageDrafts, setImageDrafts] = useState<
    Record<string, ReviewQuestionImageDraft[]>
  >({});
  const [referenceDrafts, setReferenceDrafts] = useState<
    Record<string, string[]>
  >({});
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [uploadingQuestionId, setUploadingQuestionId] = useState<string | null>(
    null
  );
  const imageDraftsRef = useRef(imageDrafts);
  const optimisticMessageSequenceRef = useRef(0);
  const [localMessages, setLocalMessages] = useState<
    Record<string, LocalReviewMessage[]>
  >({});
  const sendingQuestionIds = useRef(new Set<string>());
  const sendingCreateQuestion = useRef(false);

  useEffect(() => {
    imageDraftsRef.current = imageDrafts;
  }, [imageDrafts]);

  useEffect(
    () => () => {
      Object.values(imageDraftsRef.current)
        .flat()
        .forEach((draft) => revokeImageDraftPreview(draft.previewUrl));
    },
    []
  );

  const assignableMembers = useMemo(
    () =>
      members.filter(
        (member) =>
          member.user.status !== "DISABLED" &&
          !member.authorizationSuspendedAt &&
          member.roleConsistent !== false &&
          member.user.id !== currentUserId
      ),
    [currentUserId, members]
  );
  const mentionOptions = useMemo(
    () =>
      getProjectMemberMentionOptions(members, currentUserId, copy.currentUser),
    [copy.currentUser, currentUserId, members]
  );
  const validAssignedToId = assignableMembers.some(
    (member) => member.user.id === assignedToId
  )
    ? assignedToId
    : "";
  const currentUserName = useMemo(
    () =>
      members.find((member) => member.user.id === currentUserId)?.user.name ??
      copy.currentUser,
    [copy.currentUser, currentUserId, members]
  );

  async function handleCreateQuestion() {
    const trimmed = body.trim();
    const targetPaperId = createPaperId || defaultCreatePaperId();
    const drafts =
      imageDraftsRef.current[CREATE_REVIEW_QUESTION_DRAFT_ID] ?? [];
    const referencedWorkingPaperIds =
      referenceDrafts[CREATE_REVIEW_QUESTION_DRAFT_ID] ?? [];
    if (
      !trimmed ||
      uploadingQuestionId === CREATE_REVIEW_QUESTION_DRAFT_ID ||
      sendingCreateQuestion.current
    ) {
      return;
    }
    sendingCreateQuestion.current = true;
    setImageUploadError(null);

    let question: WorkingPaperQuestion;
    try {
      question = await createQuestion({
        body: trimmed,
        assignedToId: validAssignedToId || undefined,
        paperId: targetPaperId || undefined,
        referencedWorkingPaperIds:
          referencedWorkingPaperIds.length > 0
            ? referencedWorkingPaperIds
            : undefined,
      });
    } catch {
      return;
    } finally {
      sendingCreateQuestion.current = false;
    }

    if (targetPaperId) {
      setCreatePaperId(targetPaperId);
    }
    setLocalCreatedQuestions((current) => [
      question,
      ...current.filter((candidate) => candidate.id !== question.id),
    ]);
    setSelectedQuestionId(question.id);
    setQuestionListFilter("OPEN");
    setShowNewForm(false);
    setBody("");
    setAssignedToId("");
    setReferenceDrafts((current) => {
      const next = { ...current };
      Reflect.deleteProperty(next, CREATE_REVIEW_QUESTION_DRAFT_ID);
      return next;
    });
    // Keep createPaperId so next Q defaults to the same paper

    if (drafts.length === 0) {
      return;
    }
    try {
      const images = await uploadImageDrafts(
        question.id,
        CREATE_REVIEW_QUESTION_DRAFT_ID
      );
      await attachInitialQuestionFiles(question.id, images);
      clearImageDrafts(CREATE_REVIEW_QUESTION_DRAFT_ID);
    } catch (error) {
      clearImageDrafts(CREATE_REVIEW_QUESTION_DRAFT_ID);
      showErrorToast(error, copy.createAttachmentUploadFailedToast);
      setImageUploadError(copy.createAttachmentUploadFailed);
    }
  }

  function addOptimisticMessage(
    question: WorkingPaperQuestion,
    messageType: WorkingPaperQuestionMessage["messageType"],
    messageBody: string
  ) {
    optimisticMessageSequenceRef.current += 1;
    const optimistic: WorkingPaperQuestionMessage = {
      id: `optimistic-${optimisticMessageSequenceRef.current}`,
      questionId: question.id,
      authorId: currentUserId ?? "",
      messageType,
      body: messageBody,
      createdAt: new Date().toISOString(),
      author: null,
    };
    setLocalMessages((prev) => ({
      ...prev,
      [question.id]: [
        ...(prev[question.id] ?? []),
        {
          clientId: optimistic.id,
          message: optimistic,
          knownServerIds: getQuestionMessages(question).map(
            (message) => message.id
          ),
        },
      ],
    }));
    return optimistic.id;
  }

  function addImageDrafts(questionId: string, files: FileList | File[] | null) {
    const incomingFiles = files ? [...files] : [];
    if (incomingFiles.length === 0) {
      return;
    }
    const currentDrafts = imageDraftsRef.current[questionId] ?? [];
    const remainingSlots =
      REVIEW_QUESTION_IMAGE_MAX_PER_MESSAGE - currentDrafts.length;
    if (remainingSlots <= 0) {
      setImageUploadError(
        formatWorkbenchCopy(copy.attachmentLimit, {
          count: REVIEW_QUESTION_IMAGE_MAX_PER_MESSAGE,
        })
      );
      return;
    }

    const validFiles: File[] = [];
    for (const file of incomingFiles) {
      if (!REVIEW_QUESTION_IMAGE_MIME_TYPE_SET.has(file.type)) {
        setImageUploadError(copy.attachmentTypeUnsupported);
        continue;
      }
      if (file.size > REVIEW_QUESTION_IMAGE_MAX_SIZE_BYTES) {
        setImageUploadError(copy.attachmentTooLarge);
        continue;
      }
      validFiles.push(file);
    }

    const drafts = validFiles
      .slice(0, remainingSlots)
      .map((file) => createReviewQuestionImageDraft(file));
    if (drafts.length === 0) {
      return;
    }
    if (validFiles.length > remainingSlots) {
      setImageUploadError(
        formatWorkbenchCopy(copy.attachmentRemaining, {
          count: remainingSlots,
        })
      );
    } else {
      setImageUploadError(null);
    }
    setImageDrafts((current) => ({
      ...current,
      [questionId]: [...(current[questionId] ?? []), ...drafts],
    }));
  }

  function handleComposerPaste(
    event: ClipboardEvent<HTMLElement>,
    question: WorkingPaperQuestion
  ) {
    if (question.status === "CLEARED") {
      return;
    }
    const files = getClipboardImageFiles(event.clipboardData);
    if (files.length === 0) {
      return;
    }
    if (!event.clipboardData.getData("text/plain")) {
      event.preventDefault();
    }
    addImageDrafts(question.id, files);
  }

  function handleCreateComposerPaste(event: ClipboardEvent<HTMLElement>) {
    const files = getClipboardImageFiles(event.clipboardData);
    if (files.length === 0) {
      return;
    }
    if (!event.clipboardData.getData("text/plain")) {
      event.preventDefault();
    }
    addImageDrafts(CREATE_REVIEW_QUESTION_DRAFT_ID, files);
  }

  function removeImageDraft(questionId: string, draftId: string) {
    setImageDrafts((current) => {
      const drafts = current[questionId] ?? [];
      const removed = drafts.find((draft) => draft.id === draftId);
      if (removed) {
        revokeImageDraftPreview(removed.previewUrl);
      }
      const nextDrafts = drafts.filter((draft) => draft.id !== draftId);
      const next = { ...current };
      if (nextDrafts.length > 0) {
        next[questionId] = nextDrafts;
      } else {
        Reflect.deleteProperty(next, questionId);
      }
      return next;
    });
  }

  function clearImageDrafts(questionId: string) {
    setImageDrafts((current) => {
      const drafts = current[questionId] ?? [];
      drafts.forEach((draft) => revokeImageDraftPreview(draft.previewUrl));
      const next = { ...current };
      Reflect.deleteProperty(next, questionId);
      return next;
    });
  }

  async function uploadImageDrafts(questionId: string, draftKey = questionId) {
    const drafts = imageDraftsRef.current[draftKey] ?? [];
    if (drafts.length === 0) {
      return [];
    }
    setUploadingQuestionId(draftKey);
    try {
      return await Promise.all(
        drafts.map((draft) => uploadQuestionImage(questionId, draft.file))
      );
    } finally {
      setUploadingQuestionId(null);
    }
  }

  async function handleSend(question: WorkingPaperQuestion) {
    const draft = chatDrafts[question.id]?.trim() ?? "";
    const drafts = imageDraftsRef.current[question.id] ?? [];
    const referencedWorkingPaperIds = referenceDrafts[question.id] ?? [];
    if (
      !draft &&
      drafts.length === 0 &&
      referencedWorkingPaperIds.length === 0
    ) {
      return;
    }
    if (question.status === "CLEARED" && !draft) {
      return;
    }
    if (sendingQuestionIds.current.has(question.id)) {
      return;
    }
    sendingQuestionIds.current.add(question.id);
    setImageUploadError(null);
    let optimisticId: string | undefined;
    try {
      let images: ConfirmReviewQuestionImageInput[] = [];
      if (question.status !== "CLEARED") {
        try {
          images = await uploadImageDrafts(question.id);
        } catch (error) {
          setImageUploadError(copy.imageUploadFailed);
          throw error;
        }
      }
      if (draft) {
        optimisticId = addOptimisticMessage(
          question,
          question.status === "CLEARED"
            ? "REOPEN"
            : question.status === "REPLIED" &&
                currentUserId === question.createdById
              ? "FOLLOW_UP"
              : "REPLY",
          draft
        );
      }
      setChatDrafts((current) => ({ ...current, [question.id]: "" }));
      const updated =
        question.status === "CLEARED"
          ? await reopenQuestion(question.id, draft)
          : await replyQuestion(question.id, {
              replyBody: draft,
              images: images.length > 0 ? images : undefined,
              referencedWorkingPaperIds:
                referencedWorkingPaperIds.length > 0
                  ? referencedWorkingPaperIds
                  : undefined,
            });
      if (updated) {
        setLocalCreatedQuestions((current) => [
          updated,
          ...current.filter((item) => item.id !== updated.id),
        ]);
        setQuestionListFilter(updated.status);
        const confirmedMessages = getQuestionMessages(updated);
        setLocalMessages((current) => ({
          ...current,
          [question.id]: (current[question.id] ?? []).map((item) =>
            item.clientId === optimisticId
              ? confirmReviewMessage(item, confirmedMessages)
              : item
          ),
        }));
      }
      clearImageDrafts(question.id);
      setReferenceDrafts((current) => {
        const next = { ...current };
        Reflect.deleteProperty(next, question.id);
        return next;
      });
    } catch (error) {
      setLocalMessages((current) => ({
        ...current,
        [question.id]: (current[question.id] ?? []).filter(
          (item) => item.clientId !== optimisticId
        ),
      }));
      setChatDrafts((current) => ({
        ...current,
        [question.id]: current[question.id] || draft,
      }));
      showErrorToast(error);
    } finally {
      sendingQuestionIds.current.delete(question.id);
    }
  }

  function handleComposerKeyDown(
    event: globalThis.KeyboardEvent,
    send: () => void
  ) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.isComposing ||
      event.keyCode === 229
    ) {
      return;
    }
    event.preventDefault();
    send();
  }

  function toggleReferenceDraft(draftKey: string, workingPaperId: string) {
    setReferenceDrafts((current) => {
      const selected = current[draftKey] ?? [];
      return {
        ...current,
        [draftKey]: selected.includes(workingPaperId)
          ? selected.filter((id) => id !== workingPaperId)
          : [...selected, workingPaperId],
      };
    });
  }

  function openReferencedPaper(workingPaperId: string) {
    setDialogOpen(false);
    const params = new URLSearchParams(window.location.search);
    params.set("locatePaperId", workingPaperId);
    params.delete("workingPaperId");
    params.delete("reviewQuestionId");
    params.delete("focus");
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?${params.toString()}`
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  async function handleClearQuestion(question: WorkingPaperQuestion) {
    const confirmed = await confirm({
      title: copy.clearConfirmTitle,
      description: copy.clearConfirmDescription,
      confirmLabel: copy.clearConfirmLabel,
      cancelLabel: copy.cancel,
    });
    if (confirmed) {
      clearQuestion(question.id);
    }
  }

  const [urlQuestionId, setUrlQuestionId] = useState<string | null>(
    initialQuestionId ?? null
  );
  useEffect(() => {
    if (initialQuestionId) {
      setUrlQuestionId(initialQuestionId);
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    const questionId = url.searchParams.get("reviewQuestionId");
    if (!questionId) {
      return;
    }
    setUrlQuestionId(questionId);
    url.searchParams.delete("reviewQuestionId");
    window.history.replaceState({}, "", url.pathname + url.search);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, [initialQuestionId]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const isMobileNotes = useCompactViewport(767);
  const [noteSearch, setNoteSearch] = useState("");
  const [mobileNoteActionsOpen, setMobileNoteActionsOpen] = useState(false);
  const [mobileReplyFormatting, setMobileReplyFormatting] = useState(false);
  const [mobileQuestionDetail, setMobileQuestionDetail] = useState(false);
  const notesDialogRef = useRef<HTMLDivElement | null>(null);
  const questionListRef = useRef<HTMLDivElement | null>(null);
  const questionDetailRef = useRef<HTMLDivElement | null>(null);
  const returnToQuestionRef = useRef<HTMLButtonElement | null>(null);
  useMobileKeyboardViewport(notesDialogRef, dialogOpen && isMobileNotes);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    null
  );
  const [showNewForm, setShowNewForm] = useState(false);
  const messageScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!dialogOpen || !isMobileNotes) {
      return;
    }
    if (mobileQuestionDetail) {
      questionDetailRef.current?.focus();
    } else {
      const target = returnToQuestionRef.current;
      (target?.isConnected ? target : questionListRef.current)?.focus({
        preventScroll: true,
      });
    }
  }, [dialogOpen, isMobileNotes, mobileQuestionDetail]);
  const paperMetaById = useMemo(
    () => new Map(allPapers.map((paper) => [paper.id, paper])),
    [allPapers]
  );
  const availableQuestions = useMemo(() => {
    const byId = new Map(
      localCreatedQuestions.map((question) => [question.id, question])
    );
    for (const question of questions) {
      const local = byId.get(question.id);
      if (
        !local ||
        Date.parse(question.updatedAt) >= Date.parse(local.updatedAt)
      ) {
        byId.set(question.id, question);
      }
    }
    return [...byId.values()];
  }, [localCreatedQuestions, questions]);
  const activePaperId =
    defaultPaperId ||
    createPaperId ||
    availableQuestions[0]?.workingPaperId ||
    "";
  const fileQuestions = useMemo(() => {
    if (!filterQuestionsByPaper || !activePaperId) {
      return availableQuestions;
    }
    return availableQuestions.filter(
      (question) => question.workingPaperId === activePaperId
    );
  }, [activePaperId, availableQuestions, filterQuestionsByPaper]);
  const selectedQuestion =
    fileQuestions.find((question) => question.id === selectedQuestionId) ??
    null;
  const selectedPaper = selectedQuestion
    ? paperMetaById.get(selectedQuestion.workingPaperId)
    : activePaperId
      ? paperMetaById.get(activePaperId)
      : null;
  const hasOpen = fileQuestions.some(
    (q) => q.status === "OPEN" || q.status === "REPLIED"
  );
  const unresolvedCount = fileQuestions.filter(
    (question) => question.status !== "CLEARED"
  ).length;
  const openCount = fileQuestions.filter(
    (question) => question.status === "OPEN"
  ).length;
  const repliedCount = fileQuestions.filter(
    (question) => question.status === "REPLIED"
  ).length;
  const clearedCount = fileQuestions.length - openCount - repliedCount;
  const visibleFileQuestions = useMemo(
    () =>
      fileQuestions.filter(
        (question) =>
          question.status === questionListFilter &&
          (!isMobileNotes ||
            [
              reviewNotePlainText(question.body),
              question.createdBy?.name,
              question.assignedTo?.name,
            ]
              .filter(Boolean)
              .join(" ")
              .toLocaleLowerCase()
              .includes(noteSearch.trim().toLocaleLowerCase()))
      ),
    [fileQuestions, questionListFilter, isMobileNotes, noteSearch]
  );
  const selectedServerMessages = selectedQuestion
    ? getQuestionMessages(selectedQuestion)
    : [];
  const selectedQuestionMessage =
    selectedServerMessages.find(
      (message) => message.messageType === "QUESTION"
    ) ?? null;
  const selectedMessages = selectedQuestion
    ? mergeReviewMessages(
        selectedServerMessages,
        localMessages[selectedQuestion.id] ?? []
      )
    : null;
  const canClearSelectedQuestion = Boolean(
    selectedQuestion &&
    canReview &&
    currentUserId === selectedQuestion.createdById &&
    selectedQuestion.status !== "CLEARED"
  );
  const canMarkSelectedQuestionReplied = Boolean(
    selectedQuestion &&
    canReview &&
    selectedQuestion.status === "OPEN" &&
    (!selectedQuestion.assignedToId ||
      selectedQuestion.assignedToId === currentUserId ||
      selectedQuestion.createdById === currentUserId)
  );
  const selectedImageDrafts = selectedQuestion
    ? (imageDrafts[selectedQuestion.id] ?? [])
    : [];
  const createImageDrafts = imageDrafts[CREATE_REVIEW_QUESTION_DRAFT_ID] ?? [];
  const selectedDraftBody = selectedQuestion
    ? (chatDrafts[selectedQuestion.id] ?? "").trim()
    : "";
  const createQuestionUploading =
    uploadingQuestionId === CREATE_REVIEW_QUESTION_DRAFT_ID;
  const selectedQuestionUploading = Boolean(
    selectedQuestion && uploadingQuestionId === selectedQuestion.id
  );
  const createQuestionPending = pending || createQuestionUploading;
  const selectedQuestionPending = pending || selectedQuestionUploading;
  const createComposerError = imageUploadError;
  const selectedComposerError = imageUploadError;

  function defaultCreatePaperId() {
    return (
      defaultPaperId ||
      createPaperId ||
      selectedQuestion?.workingPaperId ||
      availableQuestions[0]?.workingPaperId ||
      allPapers[0]?.id ||
      ""
    );
  }

  function openNewForm(paperId?: string) {
    setMobileQuestionDetail(true);
    const targetPaperId = paperId || createPaperId || defaultCreatePaperId();
    setCreatePaperId(targetPaperId);
    setShowNewForm(true);
    setSelectedQuestionId(null);
    setImageUploadError(null);
  }

  function selectQuestion(question: WorkingPaperQuestion) {
    setMobileQuestionDetail(true);
    setSelectedQuestionId(question.id);
    setQuestionListFilter(question.status);
    setShowNewForm(false);
    setImageUploadError(null);
  }

  function selectQuestionList(nextFilter: WorkingPaperQuestion["status"]) {
    setQuestionListFilter(nextFilter);
    if (showNewForm) {
      return;
    }
    const nextQuestion = fileQuestions.find(
      (question) => question.status === nextFilter
    );
    setSelectedQuestionId(nextQuestion?.id ?? null);
    setImageUploadError(null);
  }

  useEffect(() => {
    if (!dialogOpen || showNewForm) {
      return;
    }
    // Mobile keeps the chosen conversation even if its status changes. Do not
    // silently replace it with the first conversation in the active list tab.
    if (isMobileNotes) {
      if (
        selectedQuestionId &&
        !fileQuestions.some((q) => q.id === selectedQuestionId)
      ) {
        setSelectedQuestionId(null);
        setMobileQuestionDetail(false);
      }
      return;
    }
    if (
      selectedQuestionId &&
      visibleFileQuestions.some(
        (question) => question.id === selectedQuestionId
      )
    ) {
      return;
    }
    const nextQuestion = visibleFileQuestions[0] ?? null;
    if (nextQuestion) {
      setSelectedQuestionId(nextQuestion.id);
    } else {
      setSelectedQuestionId(null);
    }
  }, [
    dialogOpen,
    selectedQuestionId,
    showNewForm,
    visibleFileQuestions,
    fileQuestions,
    isMobileNotes,
  ]);

  useEffect(() => {
    if (!dialogOpen || showNewForm) {
      return;
    }
    const scrollNode = messageScrollRef.current;
    if (!scrollNode) {
      return;
    }
    scrollNode.scrollTop = scrollNode.scrollHeight;
  }, [
    dialogOpen,
    selectedQuestionId,
    selectedMessages?.length,
    localMessages,
    showNewForm,
  ]);

  function openDialog(preferredQuestionId?: string | null) {
    const preferredQuestion = preferredQuestionId
      ? fileQuestions.find((question) => question.id === preferredQuestionId)
      : undefined;
    setMobileQuestionDetail(Boolean(preferredQuestion || startInCreateMode));
    const defaultPaperQuestion =
      preferredQuestion ??
      fileQuestions.find((question) => question.status !== "CLEARED") ??
      fileQuestions[0] ??
      null;
    const openCreateForm = () => {
      const targetPaperId =
        defaultPaperId ||
        createPaperId ||
        selectedQuestion?.workingPaperId ||
        availableQuestions[0]?.workingPaperId ||
        allPapers[0]?.id ||
        "";
      setCreatePaperId(targetPaperId);
      setShowNewForm(true);
      setSelectedQuestionId(null);
      setImageUploadError(null);
    };

    if (
      !preferredQuestion &&
      canReview &&
      (startInCreateMode || (!isMobileNotes && fileQuestions.length === 0))
    ) {
      openCreateForm();
    } else if (defaultPaperQuestion) {
      setSelectedQuestionId(
        isMobileNotes && !preferredQuestion ? null : defaultPaperQuestion.id
      );
      setQuestionListFilter(defaultPaperQuestion.status);
      setShowNewForm(false);
    } else if (canReview && !isMobileNotes) {
      openCreateForm();
    } else {
      setSelectedQuestionId(null);
      setShowNewForm(false);
    }
    setDialogOpen(true);
  }
  const openDialogEvent = useEffectEvent(openDialog);
  const autoOpened = useRef(false);
  useEffect(() => {
    if (!autoOpen || autoOpened.current) {
      return;
    }
    if (urlQuestionId && fileQuestions.length === 0) {
      return;
    }
    autoOpened.current = true;
    openDialogEvent(urlQuestionId);
  }, [autoOpen, fileQuestions, urlQuestionId]);
  const deepLinkOpened = useRef(false);
  useEffect(() => {
    if (autoOpen || deepLinkOpened.current || !urlQuestionId) {
      return;
    }
    const question = fileQuestions.find(
      (candidate) => candidate.id === urlQuestionId
    );
    if (!question) {
      return;
    }
    deepLinkOpened.current = true;
    setMobileQuestionDetail(true);
    setSelectedQuestionId(question.id);
    setQuestionListFilter(question.status);
    setShowNewForm(false);
    setDialogOpen(true);
  }, [autoOpen, fileQuestions, urlQuestionId]);

  const headerCode =
    contextCode ?? (contextTitle ? "" : (selectedPaper?.code ?? ""));
  const headerTitle = contextTitle ?? selectedPaper?.title ?? copy.dialogTitle;
  const headerFileName =
    headerCode && headerTitle.startsWith(`${headerCode} `)
      ? headerTitle.slice(headerCode.length + 1)
      : headerTitle;
  function backToQuestionList() {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setMobileQuestionDetail(false);
  }

  return (
    <>
      {hideTrigger ? null : (
        <Button
          type="button"
          variant="ghost"
          size="default"
          aria-label={triggerAriaLabel}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1 text-sm transition hover:bg-surface",
            className
          )}
          onClick={() => openDialog()}
        >
          {trigger ?? (
            <>
              <MessageSquare className="h-4 w-4" />
              {copy.dialogTitle}
              {hasOpen ? (
                <Badge tone="amber">{fileQuestions.length}</Badge>
              ) : null}
            </>
          )}
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          ref={notesDialogRef}
          data-emp-review-notes
          data-workbench-interaction-lock="true"
          onClick={(event) => event.stopPropagation()}
          overlayClassName="pointer-events-auto"
          showCloseButton={false}
          className={cn(
            "flex flex-col !gap-0 overflow-hidden rounded-2xl border border-border bg-background p-0 shadow-2xl shadow-foreground/15",
            !isMobileNotes &&
              "!h-[min(46rem,calc(100vh-2.5rem))] !w-[min(80rem,calc(100vw-2.5rem))] !max-w-none"
          )}
        >
          <DialogHeader className="shrink-0 !gap-0 border-b border-border bg-card">
            {isMobileNotes ? (
              <div className="emp-notes-mobile-header">
                {mobileQuestionDetail ? (
                  <Button
                    aria-label={copy.back}
                    size="icon"
                    variant="ghost"
                    onClick={backToQuestionList}
                  >
                    <ArrowLeft />
                  </Button>
                ) : null}
                <div className="min-w-0 flex-1">
                  <DialogTitle>
                    {mobileQuestionDetail && showNewForm
                      ? copy.newReviewNote
                      : copy.listTitle}
                  </DialogTitle>
                  <p
                    className="truncate text-xs text-muted-foreground"
                    title={headerFileName}
                  >
                    {headerFileName}
                  </p>
                </div>
                {mobileQuestionDetail && selectedQuestion && !showNewForm ? (
                  <>
                    <Button
                      aria-label={
                        copy.noteActions ??
                        defaultReviewQuestionsCopy.noteActions
                      }
                      size="icon"
                      variant="ghost"
                      onClick={() => setMobileNoteActionsOpen(true)}
                    >
                      <MoreHorizontal />
                    </Button>
                    <MobileActionSheet
                      open={mobileNoteActionsOpen}
                      onOpenChange={setMobileNoteActionsOpen}
                      title={
                        copy.noteActions ??
                        defaultReviewQuestionsCopy.noteActions ??
                        ""
                      }
                      closeLabel={copy.close}
                    >
                      <div className="emp-notes-status-actions">
                        <p>
                          {selectedQuestion.status === "OPEN"
                            ? copy.openTab
                            : selectedQuestion.status === "REPLIED"
                              ? copy.repliedTab
                              : copy.resolvedTab}
                        </p>
                        {canMarkSelectedQuestionReplied ? (
                          <Button
                            variant="ghost"
                            disabled={selectedQuestionPending}
                            onClick={() => {
                              setMobileNoteActionsOpen(false);
                              markRepliedQuestion(selectedQuestion.id);
                            }}
                          >
                            {copy.markReplied}
                          </Button>
                        ) : null}
                        {canClearSelectedQuestion ? (
                          <Button
                            variant="ghost"
                            disabled={selectedQuestionPending}
                            onClick={() => {
                              setMobileNoteActionsOpen(false);
                              handleClearQuestion(selectedQuestion);
                            }}
                          >
                            {copy.clear}
                          </Button>
                        ) : null}
                      </div>
                    </MobileActionSheet>
                  </>
                ) : null}
                <Button
                  aria-label={copy.close}
                  size="icon"
                  variant="ghost"
                  onClick={() => setDialogOpen(false)}
                >
                  <X />
                </Button>
              </div>
            ) : (
              <div className="flex min-h-16 min-w-0 items-center gap-3 px-5 py-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/70">
                  <ProjectFileTypeIcon
                    className="size-6"
                    fileName={
                      selectedPaper?.title ?? contextTitle ?? copy.workingPaper
                    }
                    iconClassName="size-6"
                  />
                </div>
                <DialogTitle className="flex min-w-0 items-baseline gap-4 text-lg leading-6 font-semibold tracking-tight">
                  {headerCode ? (
                    <span className="shrink-0">{headerCode}</span>
                  ) : null}
                  <span
                    className="min-w-0 truncate font-medium text-foreground/75"
                    title={headerFileName}
                  >
                    {headerFileName}
                  </span>
                </DialogTitle>
                <div className="flex shrink-0 items-center gap-2 text-xs">
                  <StatusBadge variant="secondary" radius="full" size="sm">
                    {formatWorkbenchCopy(copy.totalCount, {
                      count: fileQuestions.length,
                    })}
                  </StatusBadge>
                  <StatusBadge
                    variant={
                      unresolvedCount > 0 ? "warning-light" : "secondary"
                    }
                    radius="full"
                    size="sm"
                  >
                    {formatWorkbenchCopy(copy.unresolvedCount, {
                      count: unresolvedCount,
                    })}
                  </StatusBadge>
                </div>
                <Button
                  aria-label={copy.close}
                  className="ml-auto"
                  onClick={() => setDialogOpen(false)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <X className="size-4" />
                </Button>
              </div>
            )}
          </DialogHeader>
          <div className="emp-notes-panes grid min-h-0 flex-1 grid-cols-[19rem_minmax(0,1fr)] overflow-hidden">
            <div
              data-notes-pane="list"
              ref={questionListRef}
              tabIndex={-1}
              hidden={isMobileNotes && mobileQuestionDetail}
              className="flex min-h-0 flex-col border-r border-border bg-muted/20"
            >
              <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/55 px-4">
                {isMobileNotes ? (
                  <div className="emp-mobile-file-search">
                    <Search aria-hidden="true" />
                    <Input
                      type="search"
                      aria-label={
                        copy.searchNotes ??
                        defaultReviewQuestionsCopy.searchNotes
                      }
                      placeholder={
                        copy.searchNotes ??
                        defaultReviewQuestionsCopy.searchNotes
                      }
                      value={noteSearch}
                      onChange={(event) => setNoteSearch(event.target.value)}
                    />
                  </div>
                ) : (
                  <h3 className="text-sm font-semibold text-foreground">
                    {copy.listTitle}
                  </h3>
                )}
                {canReview ? (
                  <Button
                    aria-label={copy.newReviewNote}
                    type="button"
                    variant={isMobileNotes ? "ghost" : "outline"}
                    size={isMobileNotes ? "icon" : "sm"}
                    className={
                      isMobileNotes ? "emp-notes-new-action" : "text-primary"
                    }
                    onClick={(event) => {
                      returnToQuestionRef.current = event.currentTarget;
                      event.currentTarget.blur();
                      openNewForm();
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    {isMobileNotes ? null : copy.newButton}
                  </Button>
                ) : null}
              </div>
              <div
                aria-label={copy.listTitle}
                className="flex h-11 shrink-0 items-end gap-5 border-b border-border bg-background/55 px-4"
                role="tablist"
              >
                <Button
                  aria-selected={questionListFilter === "OPEN"}
                  className={cn(
                    "h-10 rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 text-xs font-medium shadow-none hover:bg-transparent",
                    questionListFilter === "OPEN" &&
                      "border-primary text-foreground"
                  )}
                  onClick={() => selectQuestionList("OPEN")}
                  role="tab"
                  type="button"
                  variant="ghost"
                >
                  {copy.openTab}
                  <span className="text-muted-foreground tabular-nums">
                    {openCount}
                  </span>
                </Button>
                <Button
                  aria-selected={questionListFilter === "REPLIED"}
                  className={cn(
                    "h-10 rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 text-xs font-medium shadow-none hover:bg-transparent",
                    questionListFilter === "REPLIED" &&
                      "border-primary text-foreground"
                  )}
                  onClick={() => selectQuestionList("REPLIED")}
                  role="tab"
                  type="button"
                  variant="ghost"
                >
                  {copy.repliedTab}
                  <span className="text-muted-foreground tabular-nums">
                    {repliedCount}
                  </span>
                </Button>
                <Button
                  aria-selected={questionListFilter === "CLEARED"}
                  className={cn(
                    "h-10 rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 text-xs font-medium shadow-none hover:bg-transparent",
                    questionListFilter === "CLEARED" &&
                      "border-primary text-foreground"
                  )}
                  onClick={() => selectQuestionList("CLEARED")}
                  role="tab"
                  type="button"
                  variant="ghost"
                >
                  {copy.resolvedTab}
                  <span className="text-muted-foreground tabular-nums">
                    {clearedCount}
                  </span>
                </Button>
              </div>
              <div
                data-notes-list-scroll
                className="min-h-0 flex-1 overflow-y-auto px-2 py-1"
              >
                {visibleFileQuestions.length > 0 ? (
                  visibleFileQuestions.map((q) => (
                    <Button
                      key={q.id}
                      type="button"
                      variant="ghost"
                      size="default"
                      aria-current={
                        selectedQuestionId === q.id && !showNewForm
                          ? "true"
                          : undefined
                      }
                      className={cn(
                        "h-auto w-full flex-col items-stretch justify-start gap-0 overflow-hidden whitespace-normal rounded-none border-0 border-b border-border/70 bg-transparent px-3 py-3.5 text-left shadow-none transition last:border-b-0 hover:bg-background/65",
                        selectedQuestionId === q.id &&
                          !showNewForm &&
                          "bg-primary/5 hover:bg-primary/5"
                      )}
                      onClick={(event) => {
                        returnToQuestionRef.current = event.currentTarget;
                        event.currentTarget.blur();
                        selectQuestion(q);
                      }}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <p className="min-w-0 flex-1 truncate text-[13px] leading-5 font-medium text-foreground">
                          {reviewNotePlainText(q.body)}
                        </p>
                        {isMobileNotes ? null : (
                          <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[11px] font-normal whitespace-nowrap text-muted-foreground">
                            <Clock3 className="size-3" />
                            {formatDateTime(q.updatedAt)}
                          </span>
                        )}
                      </div>
                      {isMobileNotes ? (
                        <span className="emp-notes-row-meta">
                          <span className="emp-notes-row-people">
                            <span aria-hidden="true">{`${q.createdBy?.name ?? copy.unknown} → ${q.assignedTo?.name ?? copy.unassigned}`}</span>
                            <span className="sr-only">
                              {formatWorkbenchCopy(copy.initiatorLabel, {
                                name: q.createdBy?.name ?? copy.unknown,
                              })}
                              {"; "}
                              {formatWorkbenchCopy(copy.assigneeLabel, {
                                name: q.assignedTo?.name ?? copy.unassigned,
                              })}
                            </span>
                          </span>
                          <time dateTime={q.updatedAt}>
                            {formatDateTime(q.updatedAt)}
                          </time>
                        </span>
                      ) : (
                        <span className="mt-1 flex min-w-0 items-center gap-4 text-[11px] font-normal text-muted-foreground">
                          <span className="truncate">
                            {formatWorkbenchCopy(copy.initiatorLabel, {
                              name: q.createdBy?.name ?? copy.unknown,
                            })}
                          </span>
                          <span className="shrink-0">
                            {formatWorkbenchCopy(copy.assigneeLabel, {
                              name: q.assignedTo?.name ?? copy.unassigned,
                            })}
                          </span>
                        </span>
                      )}
                    </Button>
                  ))
                ) : (
                  <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center text-xs text-muted-foreground">
                    <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <MessageSquare className="size-5" />
                    </div>
                    <p className="font-medium text-foreground">
                      {isMobileNotes && noteSearch.trim()
                        ? (copy.noMatchingNotes ??
                          defaultReviewQuestionsCopy.noMatchingNotes)
                        : copy.emptyTitle}
                    </p>
                    {isMobileNotes && noteSearch.trim() ? null : (
                      <p className="mt-1">{copy.emptyDescription}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div
              data-notes-pane="detail"
              hidden={isMobileNotes && !mobileQuestionDetail}
              ref={questionDetailRef}
              tabIndex={-1}
              className="min-h-0 overflow-hidden outline-none"
            >
              {showNewForm && canReview ? (
                <div
                  data-testid="review-note-new-form"
                  className="h-full min-h-0 bg-muted/10 p-5"
                >
                  <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm shadow-foreground/5">
                    <ReviewNoteRichTextComposer
                      ariaLabel={copy.reviewNoteContent}
                      toolbarDensity={isMobileNotes ? "compact" : "full"}
                      overlayPlacement={isMobileNotes ? "bottom" : "dialog"}
                      value={body}
                      disabled={createQuestionPending}
                      onChange={setBody}
                      onKeyDown={(event) =>
                        handleComposerKeyDown(event, () => {
                          void handleCreateQuestion();
                        })
                      }
                      onPaste={handleCreateComposerPaste}
                      placeholder={copy.createPlaceholder}
                      copy={copy.editor}
                      mentionOptions={mentionOptions}
                      allowImages
                      accept={REVIEW_QUESTION_IMAGE_ACCEPT}
                      onFiles={(files) =>
                        addImageDrafts(CREATE_REVIEW_QUESTION_DRAFT_ID, files)
                      }
                      className="min-h-0 flex-1 rounded-none border-0 shadow-none"
                      editorClassName="min-h-full"
                    />
                    {createImageDrafts.length > 0 ? (
                      <div className="shrink-0 border-t border-border bg-background/45 px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          {createImageDrafts.map((draft) => (
                            <div
                              key={draft.id}
                              className="group flex max-w-[13rem] items-center gap-2 rounded-md border border-border bg-background p-1.5 text-xs text-muted-foreground"
                            >
                              {draft.file.type.startsWith("image/") &&
                              draft.previewUrl ? (
                                <img
                                  src={draft.previewUrl}
                                  alt=""
                                  className="h-10 w-10 shrink-0 rounded object-cover"
                                />
                              ) : (
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-surface">
                                  <ProjectFileTypeIcon
                                    fileName={draft.file.name}
                                  />
                                </div>
                              )}
                              <span className="min-w-0 flex-1 truncate">
                                {draft.file.name}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-surface hover:text-foreground"
                                aria-label={formatWorkbenchCopy(
                                  copy.removeAttachment,
                                  { name: draft.file.name }
                                )}
                                disabled={createQuestionPending}
                                onClick={() =>
                                  removeImageDraft(
                                    CREATE_REVIEW_QUESTION_DRAFT_ID,
                                    draft.id
                                  )
                                }
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {(referenceDrafts[CREATE_REVIEW_QUESTION_DRAFT_ID]
                      ?.length ?? 0) > 0 ? (
                      <div className="shrink-0 border-t border-border bg-background/45 px-3 py-2">
                        <ReviewQuestionReferenceDrafts
                          papers={allPapers}
                          selectedIds={
                            referenceDrafts[CREATE_REVIEW_QUESTION_DRAFT_ID] ??
                            []
                          }
                          onRemove={(paperId) =>
                            toggleReferenceDraft(
                              CREATE_REVIEW_QUESTION_DRAFT_ID,
                              paperId
                            )
                          }
                        />
                      </div>
                    ) : null}
                    {isMobileNotes ? (
                      <EmpMobileReviewQuestionFooter
                        copy={copy}
                        papers={allPapers}
                        selectedReferenceIds={
                          referenceDrafts[CREATE_REVIEW_QUESTION_DRAFT_ID] ?? []
                        }
                        respondents={assignableMembers.map((member) => ({
                          id: member.user.id,
                          name: member.user.name,
                          role: copy.projectRoleLabels[member.projectRole],
                        }))}
                        assignedToId={validAssignedToId}
                        pending={createQuestionPending}
                        submitDisabled={createQuestionPending || !body.trim()}
                        error={createComposerError}
                        onToggleReference={(paperId) =>
                          toggleReferenceDraft(
                            CREATE_REVIEW_QUESTION_DRAFT_ID,
                            paperId
                          )
                        }
                        onAssign={setAssignedToId}
                        onSubmit={() => handleCreateQuestion()}
                      />
                    ) : (
                      <div className="shrink-0 border-t border-border bg-muted/20 px-4 py-3">
                        {createComposerError ? (
                          <p className="mb-2 text-sm text-destructive">
                            {createComposerError}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <ReviewQuestionReferencePicker
                            papers={allPapers}
                            selectedIds={
                              referenceDrafts[
                                CREATE_REVIEW_QUESTION_DRAFT_ID
                              ] ?? []
                            }
                            copy={copy}
                            disabled={createQuestionPending}
                            onToggle={(paperId) =>
                              toggleReferenceDraft(
                                CREATE_REVIEW_QUESTION_DRAFT_ID,
                                paperId
                              )
                            }
                          />
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <label
                              className="sr-only"
                              htmlFor="review-note-assignee"
                            >
                              {copy.assignRespondent}
                            </label>
                            <WorkbenchSelect
                              id="review-note-assignee"
                              className="h-9 w-48"
                              value={validAssignedToId}
                              disabled={createQuestionPending}
                              placeholder={copy.unassigned}
                              searchable
                              noResults={copy.noSearchResults}
                              searchPlaceholder={
                                copy.searchMembers ?? copy.assignRespondent
                              }
                              onValueChange={setAssignedToId}
                              options={[
                                { label: copy.unassigned, value: "" },
                                ...assignableMembers.map((member) => ({
                                  label: `${member.user.name} (${copy.projectRoleLabels[member.projectRole]})`,
                                  value: member.user.id,
                                })),
                              ]}
                            />
                            <Button
                              type="button"
                              disabled={createQuestionPending || !body.trim()}
                              onClick={() => handleCreateQuestion()}
                            >
                              {createQuestionPending
                                ? copy.adding
                                : copy.addReviewNote}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : selectedQuestion ? (
                <div
                  data-notes-thread
                  className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto]"
                >
                  <div
                    ref={messageScrollRef}
                    className="min-h-0 flex-1 overflow-y-auto bg-muted/10 px-6 py-5"
                  >
                    <div
                      data-testid="review-note-question-summary"
                      className="border-b border-border pb-5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <HeaderAvatar
                          className="size-8 shrink-0 shadow-none"
                          label={
                            selectedQuestion.createdBy?.name ?? copy.unknown
                          }
                          name={
                            selectedQuestion.createdBy?.name ?? copy.unknown
                          }
                        />
                        <span className="text-sm font-medium text-foreground">
                          {selectedQuestion.createdBy?.name ?? copy.unknown}
                        </span>
                        <time
                          className="text-xs text-muted-foreground"
                          dateTime={selectedQuestion.createdAt}
                        >
                          {formatDateTime(selectedQuestion.createdAt)}
                        </time>
                      </div>
                      <div className="mt-4 text-base font-medium text-foreground">
                        <ReviewNoteRichText value={selectedQuestion.body} />
                      </div>
                      <ReviewQuestionMessageImages
                        images={selectedQuestionMessage?.images}
                        downloadImage={downloadQuestionImage}
                        align="start"
                        copy={copy}
                      />
                      <ReviewQuestionMessageReferences
                        references={selectedQuestionMessage?.references}
                        onOpen={openReferencedPaper}
                      />
                    </div>

                    <div className="divide-y divide-border">
                      {(() => {
                        const messagesForSelectedQuestion =
                          selectedMessages?.filter(
                            (message) => message.messageType !== "QUESTION"
                          ) ?? [];
                        if (messagesForSelectedQuestion.length === 0) {
                          if (isMobileNotes) {
                            return null;
                          }
                          return (
                            <div className="flex min-h-64 flex-col items-center justify-center py-8 text-center text-xs text-muted-foreground">
                              <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-muted">
                                <MessageSquare className="size-5" />
                              </div>
                              <span className="font-medium text-foreground/80">
                                {copy.noMessagesYet}
                              </span>
                              <span className="mt-1">
                                {copy.currentDiscussionOnly}
                              </span>
                            </div>
                          );
                        }
                        return messagesForSelectedQuestion.map((msg) => {
                          const isPending = msg.pending;
                          // Optimistic messages are always authored by the current user.
                          const isMe =
                            isPending || msg.authorId === currentUserId;
                          const authorName =
                            msg.author?.name ??
                            (isMe ? currentUserName : copy.unknown);
                          return (
                            <article
                              key={msg.renderKey}
                              data-testid="review-note-message"
                              className="flex min-w-0 gap-3 py-4"
                            >
                              <HeaderAvatar
                                className="size-8 shrink-0 shadow-none"
                                name={authorName}
                                label={authorName}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                  <span className="text-sm font-medium text-foreground">
                                    {authorName}
                                  </span>
                                  <time
                                    className="text-xs text-muted-foreground"
                                    dateTime={msg.createdAt}
                                  >
                                    {formatDateTime(msg.createdAt)}
                                  </time>
                                  {isPending ? (
                                    <span className="text-xs text-muted-foreground">
                                      {copy.sending}
                                    </span>
                                  ) : null}
                                </div>
                                {msg.body ? (
                                  <div className="mt-1 text-sm text-foreground">
                                    <ReviewNoteRichText value={msg.body} />
                                  </div>
                                ) : null}
                                <ReviewQuestionMessageImages
                                  images={msg.images}
                                  downloadImage={downloadQuestionImage}
                                  align="start"
                                  copy={copy}
                                />
                                <ReviewQuestionMessageReferences
                                  references={msg.references}
                                  onOpen={openReferencedPaper}
                                />
                              </div>
                            </article>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {canReview ||
                  !selectedQuestion.assignedToId ||
                  selectedQuestion.assignedToId === currentUserId ? (
                    <div
                      data-notes-composer
                      className="shrink-0 border-t border-border bg-card px-4 py-3"
                    >
                      {selectedComposerError ? (
                        <p className="mb-2 text-xs text-destructive">
                          {selectedComposerError}
                        </p>
                      ) : null}
                      <div
                        className={
                          isMobileNotes
                            ? "emp-notes-reply-layout"
                            : "grid gap-2"
                        }
                        data-formatting={
                          (isMobileNotes && mobileReplyFormatting) || undefined
                        }
                      >
                        <ReviewNoteRichTextComposer
                          ariaLabel={copy.message}
                          toolbarDensity={isMobileNotes ? "compact" : "full"}
                          overlayPlacement={isMobileNotes ? "bottom" : "dialog"}
                          presentation={isMobileNotes ? "contextual" : "framed"}
                          placeholder={
                            selectedQuestion.status === "CLEARED"
                              ? copy.reopenPlaceholder
                              : selectedQuestion.status === "REPLIED"
                                ? copy.followUpPlaceholder
                                : copy.messagePlaceholder
                          }
                          value={chatDrafts[selectedQuestion.id] ?? ""}
                          disabled={selectedQuestionPending}
                          onChange={(value) =>
                            setChatDrafts((p) => ({
                              ...p,
                              [selectedQuestion.id]: value,
                            }))
                          }
                          onKeyDown={(event) =>
                            handleComposerKeyDown(event, () => {
                              void handleSend(selectedQuestion);
                            })
                          }
                          copy={copy.editor}
                          mentionOptions={mentionOptions}
                          allowImages={
                            selectedQuestion.status === "OPEN" ||
                            selectedQuestion.status === "REPLIED"
                          }
                          accept={REVIEW_QUESTION_IMAGE_ACCEPT}
                          onFiles={(files) =>
                            addImageDrafts(selectedQuestion.id, files)
                          }
                          editorClassName={
                            isMobileNotes
                              ? "emp-notes-reply-editor"
                              : "min-h-28 resize-none"
                          }
                          onPaste={(e) =>
                            handleComposerPaste(e, selectedQuestion)
                          }
                        />
                        {selectedImageDrafts.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {selectedImageDrafts.map((draft) => (
                              <div
                                key={draft.id}
                                className="group flex max-w-[13rem] items-center gap-2 rounded-md border border-border bg-background p-1.5 text-xs text-muted-foreground"
                              >
                                {draft.file.type.startsWith("image/") &&
                                draft.previewUrl ? (
                                  <img
                                    src={draft.previewUrl}
                                    alt=""
                                    className="h-10 w-10 shrink-0 rounded object-cover"
                                  />
                                ) : (
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-surface">
                                    <ProjectFileTypeIcon
                                      fileName={draft.file.name}
                                    />
                                  </div>
                                )}
                                <span className="min-w-0 flex-1 truncate">
                                  {draft.file.name}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-surface hover:text-foreground"
                                  aria-label={formatWorkbenchCopy(
                                    copy.removeAttachment,
                                    { name: draft.file.name }
                                  )}
                                  disabled={selectedQuestionPending}
                                  onClick={() =>
                                    removeImageDraft(
                                      selectedQuestion.id,
                                      draft.id
                                    )
                                  }
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {(referenceDrafts[selectedQuestion.id]?.length ?? 0) >
                        0 ? (
                          <ReviewQuestionReferenceDrafts
                            papers={allPapers}
                            selectedIds={
                              referenceDrafts[selectedQuestion.id] ?? []
                            }
                            onRemove={(paperId) =>
                              toggleReferenceDraft(selectedQuestion.id, paperId)
                            }
                          />
                        ) : null}
                        <div
                          className={
                            isMobileNotes
                              ? "emp-notes-reply-actions"
                              : "flex flex-wrap items-center justify-between gap-2"
                          }
                        >
                          <ReviewQuestionReferencePicker
                            mobile={isMobileNotes}
                            formatting={mobileReplyFormatting}
                            onToggleFormatting={() =>
                              setMobileReplyFormatting((value) => !value)
                            }
                            onFiles={
                              selectedQuestion.status === "CLEARED"
                                ? undefined
                                : (files) =>
                                    addImageDrafts(selectedQuestion.id, files)
                            }
                            papers={allPapers}
                            selectedIds={
                              referenceDrafts[selectedQuestion.id] ?? []
                            }
                            copy={copy}
                            disabled={selectedQuestionPending}
                            onToggle={(paperId) =>
                              toggleReferenceDraft(selectedQuestion.id, paperId)
                            }
                          />
                          <div className="flex items-center gap-2">
                            {!isMobileNotes &&
                            canMarkSelectedQuestionReplied ? (
                              <Button
                                variant="outline"
                                type="button"
                                disabled={selectedQuestionPending}
                                onClick={() =>
                                  markRepliedQuestion(selectedQuestion.id)
                                }
                              >
                                {copy.markReplied}
                              </Button>
                            ) : null}
                            {!isMobileNotes && canClearSelectedQuestion ? (
                              <Button
                                variant="outline"
                                type="button"
                                disabled={selectedQuestionPending}
                                onClick={() =>
                                  handleClearQuestion(selectedQuestion)
                                }
                              >
                                {copy.clear}
                              </Button>
                            ) : null}
                            {selectedQuestion.status === "OPEN" ||
                            selectedQuestion.status === "REPLIED" ? (
                              <Button
                                aria-label={
                                  selectedQuestionUploading
                                    ? copy.uploading
                                    : copy.send
                                }
                                className={
                                  isMobileNotes
                                    ? "emp-notes-send-action"
                                    : undefined
                                }
                                type="button"
                                disabled={
                                  selectedQuestionPending ||
                                  (!selectedDraftBody &&
                                    selectedImageDrafts.length === 0 &&
                                    !(
                                      referenceDrafts[selectedQuestion.id]
                                        ?.length ?? 0
                                    ))
                                }
                                onClick={() => handleSend(selectedQuestion)}
                              >
                                {isMobileNotes ? (
                                  <Send aria-hidden="true" />
                                ) : selectedQuestionUploading ? (
                                  copy.uploading
                                ) : (
                                  copy.send
                                )}
                              </Button>
                            ) : (
                              <Button
                                aria-label={copy.reopen}
                                className={
                                  isMobileNotes
                                    ? "emp-notes-send-action"
                                    : undefined
                                }
                                type="button"
                                disabled={
                                  selectedQuestionPending || !selectedDraftBody
                                }
                                onClick={() => handleSend(selectedQuestion)}
                              >
                                <Send className="h-4 w-4" />
                                {isMobileNotes ? null : copy.reopen}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex h-full flex-1 flex-col items-center justify-center bg-muted/10 px-8 text-center text-sm text-muted-foreground">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
                    <MessageSquare className="size-5" />
                  </div>
                  <span>{copy.selectPrompt}</span>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function _unused_ReviewQuestionCard({
  question,
  canReview,
  currentUserId,
  pending,
  replyDraft,
  actionDraft,
  setReplyDraft,
  setActionDraft,
  replyQuestion,
  clearQuestion,
  followUpQuestion,
  reopenQuestion,
}: {
  question: WorkingPaperQuestion;
  canReview: boolean;
  currentUserId: string | null;
  pending: boolean;
  replyDraft: string;
  actionDraft: string;
  setReplyDraft: (value: string) => void;
  setActionDraft: (value: string) => void;
  replyQuestion: () => void;
  clearQuestion: () => void;
  followUpQuestion: () => void;
  reopenQuestion: () => void;
}) {
  const canReply =
    question.status === "OPEN" && currentUserId === question.assignedToId;
  const canResolveQuestion =
    canReview && currentUserId === question.createdById;
  const canClear = canResolveQuestion && question.status === "REPLIED";
  const canFollowUp = canResolveQuestion && question.status === "REPLIED";
  const canReopen = canResolveQuestion && question.status === "CLEARED";
  const messages = getQuestionMessages(question);

  return (
    <article className="grid gap-3 rounded-md border border-border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{question.body}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Assigned to {question.assignedTo?.name ?? "Not recorded"} · Raised
            by {question.createdBy?.name ?? "Not recorded"}
          </p>
        </div>
        <QuestionStatusBadge status={question.status} />
      </div>

      <ReviewQuestionMessageTimeline messages={messages} />

      {canReply ? (
        <div className="grid gap-2 md:grid-cols-[1fr_auto]">
          <Textarea
            aria-label="Reply to review note"
            className="min-h-16 resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground transition outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
            value={replyDraft}
            disabled={pending}
            onChange={(event) => setReplyDraft(event.target.value)}
            placeholder="Add a reply or explanation"
          />
          <Button
            variant="outline"
            type="button"
            disabled={pending || !replyDraft.trim()}
            onClick={replyQuestion}
          >
            Submit reply
          </Button>
        </div>
      ) : null}

      {canClear || canFollowUp || canReopen ? (
        <div className="grid gap-2">
          {canFollowUp || canReopen ? (
            <Textarea
              aria-label={canFollowUp ? "Follow-up content" : "Reopen reason"}
              className="min-h-16 resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground transition outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
              value={actionDraft}
              disabled={pending}
              onChange={(event) => setActionDraft(event.target.value)}
              placeholder={
                canFollowUp
                  ? "Explain what still needs to be supplemented"
                  : "Explain why this review note is being reopened"
              }
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            {canClear ? (
              <Button
                variant="outline"
                type="button"
                disabled={pending}
                onClick={clearQuestion}
              >
                Mark resolved
              </Button>
            ) : null}
            {canFollowUp ? (
              <Button
                variant="outline"
                type="button"
                disabled={pending || !actionDraft.trim()}
                onClick={followUpQuestion}
              >
                Follow up
              </Button>
            ) : null}
            {canReopen ? (
              <Button
                variant="outline"
                type="button"
                disabled={pending || !actionDraft.trim()}
                onClick={reopenQuestion}
              >
                <RefreshCcw className="h-4 w-4" />
                Reopen
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function ReviewQuestionMessageTimeline({
  messages,
}: {
  messages: WorkingPaperQuestionMessage[];
}) {
  const visibleMessages = messages.filter(
    (message, index) => !(index === 0 && message.messageType === "QUESTION")
  );

  if (visibleMessages.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2 border-l border-border pl-3">
      {visibleMessages.map((message) => (
        <div
          key={message.id}
          className="rounded-md border border-border bg-background p-3"
        >
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{message.author?.name ?? "Not recorded"}</span>
            <span>{formatDateTime(message.createdAt)}</span>
          </div>
          <p className="text-sm text-foreground">{message.body}</p>
        </div>
      ))}
    </div>
  );
}

type ReviewQuestionPaperOption = {
  id: string;
  code: string;
  title: string;
  path: string;
};

function ReviewQuestionReferencePicker({
  mobile = false,
  formatting = false,
  onToggleFormatting,
  onFiles,
  papers,
  selectedIds,
  copy,
  disabled,
  onToggle,
}: {
  mobile?: boolean;
  formatting?: boolean;
  onToggleFormatting?: () => void;
  onFiles?: (files: File[]) => void;
  papers: ReviewQuestionPaperOption[];
  selectedIds: string[];
  copy: WorkbenchReviewQuestionsCopy;
  disabled: boolean;
  onToggle: (paperId: string) => void;
}) {
  const [mobilePicker, setMobilePicker] = useState<
    "tools" | "references" | null
  >(null);
  const [referenceSearch, setReferenceSearch] = useState("");
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const referenceInputPrefix = useId();
  const filteredPapers = papers.filter((paper) =>
    [paper.code, paper.title, paper.path]
      .join(" ")
      .toLocaleLowerCase()
      .includes(referenceSearch.trim().toLocaleLowerCase())
  );
  if (mobile) {
    const toolsLabel =
      copy.addToMessage ?? defaultReviewQuestionsCopy.addToMessage ?? "";
    return (
      <>
        <Button
          className="emp-notes-add-action"
          type="button"
          variant="ghost"
          size="icon"
          aria-label={toolsLabel}
          disabled={disabled}
          onClick={() => setMobilePicker("tools")}
        >
          <Plus aria-hidden="true" />
        </Button>
        <Input
          ref={attachmentInputRef}
          type="file"
          disabled={disabled}
          hidden
          multiple
          accept={REVIEW_QUESTION_IMAGE_ACCEPT}
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = "";
            if (files.length) {
              onFiles?.(files);
            }
          }}
        />
        <MobileActionSheet
          open={mobilePicker !== null}
          onOpenChange={(open) => {
            if (!open) {
              setReferenceSearch("");
              setMobilePicker(null);
            }
          }}
          title={
            mobilePicker === "references" ? copy.referenceWorkpaper : toolsLabel
          }
          closeLabel={copy.close}
        >
          {mobilePicker === "references" ? (
            <div className="emp-notes-reference-options">
              <Input
                type="search"
                aria-label={copy.searchWorkpapers ?? copy.referenceWorkpaper}
                placeholder={copy.searchWorkpapers ?? copy.referenceWorkpaper}
                value={referenceSearch}
                onChange={(event) => setReferenceSearch(event.target.value)}
              />
              <div className="max-h-[min(60vh,28rem)] overflow-y-auto">
                {filteredPapers.length ? (
                  filteredPapers.map((paper) => (
                    <label
                      key={paper.id}
                      htmlFor={`${referenceInputPrefix}-${paper.id}`}
                    >
                      <Checkbox
                        id={`${referenceInputPrefix}-${paper.id}`}
                        checked={selectedIds.includes(paper.id)}
                        disabled={disabled}
                        onCheckedChange={() => onToggle(paper.id)}
                      />
                      <span>
                        <strong>{paper.code || paper.title}</strong>
                        <span>{paper.path || paper.title}</span>
                      </span>
                    </label>
                  ))
                ) : (
                  <p>{copy.noSearchResults ?? copy.noWorkpapersAvailable}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="emp-notes-status-actions">
              <Button
                variant="ghost"
                disabled={disabled}
                onClick={() => setMobilePicker("references")}
              >
                <GitBranch />
                {copy.referenceWorkpaper}
              </Button>
              {onToggleFormatting ? (
                <Button
                  variant="ghost"
                  disabled={disabled}
                  aria-pressed={formatting}
                  onClick={() => {
                    onToggleFormatting();
                    setMobilePicker(null);
                  }}
                >
                  <Pencil aria-hidden="true" />
                  {copy.editor.formattingToolbar}
                </Button>
              ) : null}
              {onFiles ? (
                <Button
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => {
                    attachmentInputRef.current?.click();
                    setMobilePicker(null);
                  }}
                >
                  <Paperclip />
                  {copy.attachImage}
                </Button>
              ) : null}
            </div>
          )}
        </MobileActionSheet>
      </>
    );
  }
  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) {
          setReferenceSearch("");
        }
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
          />
        }
      >
        <GitBranch className="size-4" />
        {copy.referenceWorkpaper}
        {selectedIds.length > 0 ? (
          <span className="rounded-full bg-primary/10 px-1.5 text-xs text-primary">
            {selectedIds.length}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 overflow-hidden">
        <div className="px-2 pb-2">
          <Input
            type="search"
            aria-label={copy.searchWorkpapers ?? copy.referenceWorkpaper}
            placeholder={copy.searchWorkpapers ?? copy.referenceWorkpaper}
            value={referenceSearch}
            onChange={(event) => setReferenceSearch(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
          />
        </div>
        <div className="max-h-56 overflow-y-auto">
          {filteredPapers.length > 0 ? (
            filteredPapers.map((paper) => (
              <DropdownMenuCheckboxItem
                key={paper.id}
                checked={selectedIds.includes(paper.id)}
                onCheckedChange={() => onToggle(paper.id)}
                onSelect={(event) => event.preventDefault()}
                className="items-start"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {paper.code || paper.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {paper.path || paper.title}
                  </span>
                </span>
              </DropdownMenuCheckboxItem>
            ))
          ) : (
            <DropdownMenuItem disabled>
              {copy.noSearchResults ?? copy.noWorkpapersAvailable}
            </DropdownMenuItem>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ReviewQuestionReferenceDrafts({
  papers,
  selectedIds,
  onRemove,
}: {
  papers: ReviewQuestionPaperOption[];
  selectedIds: string[];
  onRemove: (paperId: string) => void;
}) {
  const paperById = new Map(papers.map((paper) => [paper.id, paper]));
  return (
    <div className="flex flex-wrap gap-2">
      {selectedIds.map((paperId) => {
        const paper = paperById.get(paperId);
        if (!paper) {
          return null;
        }
        return (
          <div
            key={paperId}
            className="inline-flex max-w-72 items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-xs"
          >
            <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{paper.code || paper.title}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Remove ${paper.code || paper.title}`}
              onClick={() => onRemove(paperId)}
            >
              <X className="size-3" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function ReviewQuestionMessageReferences({
  references,
  onOpen,
}: {
  references?: ReviewQuestionMessageReference[];
  onOpen: (workingPaperId: string) => void;
}) {
  if (!references?.length) {
    return null;
  }
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {references.map((reference) => (
        <Button
          key={reference.id}
          type="button"
          variant="outline"
          size="sm"
          className="max-w-80 justify-start"
          onClick={() => onOpen(reference.workingPaperId)}
        >
          <GitBranch className="size-4 shrink-0 text-primary" />
          <span className="truncate">
            {reference.workingPaper.code} {reference.workingPaper.title}
          </span>
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      ))}
    </div>
  );
}

function ReviewQuestionMessageImages({
  images,
  downloadImage,
  copy,
  align = "start",
}: {
  images?: ReviewQuestionMessageImage[];
  downloadImage: (imageId: string) => Promise<Blob>;
  copy: WorkbenchReviewQuestionsCopy;
  align?: "start" | "end";
}) {
  const [imageStates, setImageStates] = useState<
    Record<string, { status: "loading" | "loaded" | "error"; url?: string }>
  >({});
  const [loadAttempt, setLoadAttempt] = useState(0);
  const imagesRef = useRef(images);
  const downloadImageRef = useRef(downloadImage);
  const imageKey = (images ?? []).map((image) => image.id).join("|");

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    downloadImageRef.current = downloadImage;
  }, [downloadImage]);

  useEffect(() => {
    const currentImages = (imagesRef.current ?? []).filter((image) =>
      image.mimeType.startsWith("image/")
    );
    if (currentImages.length === 0) {
      setImageStates({});
      return;
    }
    let cancelled = false;
    const objectUrls: string[] = [];
    setImageStates(
      Object.fromEntries(
        currentImages.map((image) => [image.id, { status: "loading" as const }])
      )
    );

    async function loadImages() {
      const entries = await Promise.all(
        currentImages.map(async (image) => {
          try {
            const blob = await downloadImageRef.current(image.id);
            const url = createObjectPreviewUrl(blob);
            if (!url) {
              throw new Error("Image preview is unavailable");
            }
            objectUrls.push(url);
            return [image.id, { status: "loaded" as const, url }] as const;
          } catch {
            return [image.id, { status: "error" as const }] as const;
          }
        })
      );
      if (cancelled) {
        objectUrls.forEach(revokeImageDraftPreview);
        return;
      }
      setImageStates(Object.fromEntries(entries));
    }

    void loadImages();
    return () => {
      cancelled = true;
      objectUrls.forEach(revokeImageDraftPreview);
    };
  }, [imageKey, loadAttempt]);

  if (!images?.length) {
    return null;
  }

  return (
    <div
      className={cn(
        "mt-2 flex flex-wrap gap-2",
        align === "end" ? "justify-end" : "justify-start"
      )}
    >
      {images.map((image) => {
        const title = image.originalName || image.fileName;
        if (!image.mimeType.startsWith("image/")) {
          return (
            <Button
              key={image.id}
              type="button"
              variant="outline"
              size="sm"
              className="max-w-80 justify-start"
              onClick={async () => {
                const blob = await downloadImage(image.id);
                downloadBlob(blob, title);
              }}
            >
              <ProjectFileTypeIcon fileName={title} />
              <span className="truncate">{title}</span>
              <Download className="size-3.5 shrink-0 text-muted-foreground" />
            </Button>
          );
        }
        const imageState = imageStates[image.id] ?? { status: "loading" };
        if (imageState.status === "loaded" && imageState.url) {
          return (
            <a
              key={image.id}
              href={imageState.url}
              target="_blank"
              rel="noreferrer"
              className="block cursor-zoom-in overflow-hidden rounded-md border border-border bg-background/80"
            >
              <img
                src={imageState.url}
                alt={title}
                className="h-28 w-36 object-cover"
                loading="lazy"
                onError={() =>
                  setImageStates((current) => ({
                    ...current,
                    [image.id]: { status: "error" },
                  }))
                }
              />
            </a>
          );
        }

        return (
          <div
            key={image.id}
            className="flex h-28 w-36 flex-col items-center justify-center gap-1.5 rounded-md border border-border bg-background/80 px-2 text-center text-xs text-muted-foreground"
          >
            {imageState.status === "error" ? (
              <>
                <ImageOff className="size-4" />
                <span>{copy.imageUnavailable}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                >
                  {copy.retry}
                </Button>
              </>
            ) : (
              <div
                aria-busy="true"
                aria-label={copy.loadingImage}
                className="h-full w-full p-2"
              >
                <Skeleton className="h-full w-full rounded-md" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function QuestionStatusBadge({
  status,
}: {
  status: WorkingPaperQuestion["status"];
}) {
  const tone =
    status === "CLEARED" ? "green" : status === "REPLIED" ? "sky" : "amber";
  return <Badge tone={tone}>{status}</Badge>;
}

function AttachmentLockBanner({
  attachment,
  currentUserId,
}: {
  attachment: Attachment;
  currentUserId?: string | null;
}) {
  const lockState = getAttachmentLockState(attachment, currentUserId);

  if (!lockState.isLocked) {
    return null;
  }

  const lockedAt = attachment.lockedAt
    ? `Locked at ${formatDateTime(attachment.lockedAt)}`
    : "Lock time not recorded";

  return (
    <output
      className={cn(
        "rounded-md border px-4 py-3 text-sm",
        lockState.isLockedByCurrentUser
          ? "border-border bg-card text-foreground"
          : "border-warning-accent bg-warning-subtle text-foreground"
      )}
    >
      <div className="flex items-start gap-3">
        {lockState.isLockedByCurrentUser ? (
          <Lock className="mt-0.5 h-5 w-5 shrink-0" />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="font-semibold">
            {lockState.isLockedByCurrentUser
              ? "You are locking this file"
              : `This file is locked for editing by ${lockState.holderName}`}
          </p>
          <p className="mt-1 text-xs leading-5 opacity-85">
            {lockState.isLockedByCurrentUser
              ? `Release Master from the file action menu after editing. ${lockedAt}`
              : `You can still preview or open read-only, but cannot become Master. ${lockedAt}`}
          </p>
        </div>
      </div>
    </output>
  );
}

function getPaperSignoffs(paper: PaperReviewSnapshot): WorkingPaperSignoff[] {
  if (paper.signoffs?.length) {
    return [...paper.signoffs].sort(
      (left, right) => Date.parse(left.signedAt) - Date.parse(right.signedAt)
    );
  }

  const fallback: WorkingPaperSignoff[] = [];
  if (paper.preparedAt) {
    fallback.push({
      id: `${paper.id}-legacy-preparer`,
      type: "PREPARER",
      signedAt: paper.preparedAt,
      user: paper.preparer ?? {
        id: paper.preparerId ?? "legacy-preparer",
        name: "Not recorded",
        email: "",
      },
    });
  }
  if (paper.reviewedAt) {
    fallback.push({
      id: `${paper.id}-legacy-reviewer`,
      type: "REVIEWER",
      signedAt: paper.reviewedAt,
      user: paper.reviewer ?? {
        id: paper.reviewerId ?? "legacy-reviewer",
        name: "Not recorded",
        email: "",
      },
    });
  }
  return fallback;
}

function getQuestionMessages(
  question: WorkingPaperQuestion
): WorkingPaperQuestionMessage[] {
  if (question.messages?.length) {
    return [...question.messages].sort(
      (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)
    );
  }

  const messages: WorkingPaperQuestionMessage[] = [
    {
      id: `${question.id}-legacy-question`,
      questionId: question.id,
      authorId: question.createdById,
      messageType: "QUESTION",
      body: question.body,
      createdAt: question.createdAt,
      author: question.createdBy ?? null,
    },
  ];

  if (question.replyBody && question.repliedAt) {
    messages.push({
      id: `${question.id}-legacy-reply`,
      questionId: question.id,
      authorId:
        question.repliedById ?? question.repliedBy?.id ?? "legacy-replier",
      messageType: "REPLY",
      body: question.replyBody,
      createdAt: question.repliedAt,
      author: question.repliedBy ?? null,
    });
  }

  return messages;
}

function getAttachmentLockState(
  attachment: Attachment | null | undefined,
  currentUserId?: string | null
) {
  const lockUserId = attachment?.lockHolder?.id ?? attachment?.lockedBy ?? null;
  const isLocked = Boolean(lockUserId);
  const isLockedByCurrentUser = Boolean(
    isLocked && currentUserId && lockUserId === currentUserId
  );

  return {
    isLocked,
    isLockedByCurrentUser,
    isLockedByOther: isLocked && !isLockedByCurrentUser,
    holderName: formatAccountDisplayName(
      attachment?.lockHolder,
      "another member"
    ),
  };
}

function isSpreadsheetAttachment(attachment: Attachment) {
  const fileName = getAttachmentDisplayName(attachment).toLowerCase();
  return /\.(xlsx|xls|xlsm|xlsb|csv|tsv)$/.test(fileName);
}

function getExtendAttachmentPreviewKind(
  attachment: Attachment
): AttachmentPreviewKind | null {
  const fileName = getAttachmentDisplayName(attachment).toLowerCase();
  const mimeType = getAttachmentMimeType(attachment);
  if (/\.(csv|tsv)$/.test(fileName) || mimeType === "text/csv") {
    return "csv";
  }
  if (/\.(xlsx|xls|xlsm|xlsb)$/.test(fileName)) {
    return "xlsx";
  }
  return getAttachmentContentPreviewKind(attachment);
}

function isPdfAttachment(attachment: Attachment) {
  const mimeType = getAttachmentMimeType(attachment);
  const fileName = getAttachmentDisplayName(attachment).toLowerCase();
  return mimeType === "application/pdf" || fileName.endsWith(".pdf");
}

function isZipAttachment(attachment: Attachment) {
  const mimeType = getAttachmentMimeType(attachment);
  const fileName = getAttachmentDisplayName(attachment).toLowerCase();
  return (
    mimeType === "application/zip" ||
    mimeType === "application/x-zip-compressed" ||
    fileName.endsWith(".zip")
  );
}

function isArchiveAttachment(attachment: Attachment) {
  const mimeType = getAttachmentMimeType(attachment);
  const fileName = getAttachmentDisplayName(attachment).toLowerCase();
  return (
    mimeType === "application/zip" ||
    mimeType === "application/x-zip-compressed" ||
    mimeType === "application/x-rar-compressed" ||
    mimeType === "application/vnd.rar" ||
    mimeType === "application/x-7z-compressed" ||
    mimeType === "application/x-tar" ||
    mimeType === "application/gzip" ||
    mimeType === "application/x-gzip" ||
    mimeType === "application/x-bzip2" ||
    mimeType === "application/x-xz" ||
    mimeType === "application/vnd.ms-cab-compressed" ||
    /\.(zip|rar|7z|tar|tgz|gz|tbz2?|bz2|txz|xz|cab|ar|cpio|iso)$/.test(fileName)
  );
}

function isSmartFormAttachment(attachment: Attachment) {
  const mimeType = getAttachmentMimeType(attachment);
  const fileName = getAttachmentDisplayName(attachment).toLowerCase();
  return (
    attachment.fileKind === "SMART_FORM" ||
    mimeType === SMART_FORM_MIME_TYPE ||
    fileName.endsWith(".sf")
  );
}

function getAttachmentMimeType(attachment: Attachment) {
  return (attachment.mimeType ?? "").toLowerCase();
}

function getAttachmentDisplayName(attachment: Attachment) {
  return formatDisplayName(attachment.originalName ?? attachment.fileName);
}

function getPreviewPdfDisplayName(attachment: Attachment) {
  return getAttachmentDisplayName(attachment).replace(/\.[^.]+$/u, "");
}

function getAttachmentExternalFileName(
  attachment: Attachment & {
    workingPaper?: { code?: string | null } | null;
  }
) {
  return getNumberedAttachmentDisplayName(
    attachment,
    attachment.code ?? attachment.workingPaper?.code ?? undefined
  );
}

function getAttachmentDownloadFileName(
  attachment: Attachment & {
    workingPaper?: { code?: string | null } | null;
  }
) {
  const fileName = getAttachmentExternalFileName(attachment);
  if (!isSmartFormAttachment(attachment)) {
    return fileName;
  }
  return fileName.replace(/\.sf$/i, ".pdf");
}

function getAttachmentExportDownloadFileName(
  attachment: Attachment,
  format: AttachmentExportFormat
) {
  const fileName = getAttachmentDownloadFileName(attachment);
  if (format === "zip") {
    return `${fileName.replace(/\.[^.]+$/, "")}.zip`;
  }
  if (format === "pdf") {
    return `${fileName.replace(/\.[^.]+$/, "")}.pdf`;
  }
  return fileName;
}

function isOfficePdfExportAttachment(attachment: Attachment) {
  return /\.(doc|docx|ppt|pptx|xls|xlsx|xlsm|xlsb)$/i.test(
    getAttachmentDisplayName(attachment)
  );
}

function getNumberedAttachmentDisplayName(
  attachment: Attachment,
  refCode?: string
) {
  const displayName = getAttachmentDisplayName(attachment);
  if (!refCode) {
    return displayName;
  }
  const baseName = displayName.replace(
    /^[A-Za-z0-9][A-Za-z0-9-]*-F\d+\s+/i,
    ""
  );
  return `${refCode} ${baseName}`;
}

function isDesktopAgentOpenSupportedAttachment(
  attachment: Attachment,
  mode: "MASTER" | "READ_ONLY"
) {
  return isDesktopAgentOpenSupportedFileName(
    attachment.originalName ?? attachment.fileName,
    mode
  );
}

function assertDesktopAgentOpenSupportedAttachment(
  attachment: Attachment,
  mode: "MASTER" | "READ_ONLY"
) {
  if (!isDesktopAgentOpenSupportedAttachment(attachment, mode)) {
    throw new Error(DESKTOP_AGENT_MASTER_UNSUPPORTED_FILE_MESSAGE);
  }
}

async function downloadReadOnlyAttachmentCopy(
  projectId: string,
  attachment: Attachment
) {
  const blob = await api.downloadAttachmentReadOnly(projectId, attachment.id);
  downloadBlob(blob, getAttachmentDownloadFileName(attachment));
}

function createDesktopAgentInstallPrompt(
  attachment: Attachment,
  mode: DesktopAgentInstallPrompt["mode"],
  localMasterSessionCount = 0,
  localMasterSessionsNeedAttentionCount = 0,
  agentState: DesktopAgentInstallPrompt["agentState"] = "not_running",
  diagnosticMessage?: string | null,
  masterBlocker?: DesktopAgentInstallPrompt["masterBlocker"] | null,
  agentStatus?: DesktopAgentStatus | null,
  localMasterSessions: DesktopAgentSession[] = []
): DesktopAgentInstallPrompt {
  const platform = detectDesktopAgentPlatform();
  const fileName = attachment.originalName ?? attachment.fileName;
  const launchFailure = findAttachmentLaunchFailure(
    localMasterSessions,
    attachment.id
  );
  return {
    attachment,
    mode,
    fileName,
    platform,
    downloadUrl: getDesktopAgentDownloadUrl(platform),
    localMasterSessionCount,
    localMasterSessionsNeedAttentionCount,
    agentState,
    agentNeedsUpdate: Boolean(
      agentStatus?.isInstalled &&
      !agentStatus.isSupported &&
      agentStatus.supportsSelfUpdate
    ),
    ...(masterBlocker ? { masterBlocker } : {}),
    ...(diagnosticMessage ? { diagnosticMessage } : {}),
    ...(agentStatus?.health?.version
      ? { agentVersion: agentStatus.health.version }
      : {}),
    ...(launchFailure?.launchFailedReason
      ? { launchFailureReason: launchFailure.launchFailedReason }
      : {}),
    ...(launchFailure?.lastError
      ? { launchFailureLastError: launchFailure.lastError }
      : {}),
  };
}

function downloadDesktopAgentInstaller(downloadUrl: string) {
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = "desktop-agent-installer";
  document.body.append(link);
  link.click();
  link.remove();
}

function findAttachmentLaunchFailure(
  sessions: DesktopAgentSession[],
  attachmentId: string
) {
  return sessions
    .filter(
      (session) =>
        session.attachmentId === attachmentId &&
        session.lifecycleState === "LAUNCH_FAILED"
    )
    .sort(
      (left, right) =>
        getDesktopAgentSessionSortTime(right) -
        getDesktopAgentSessionSortTime(left)
    )[0];
}

function getDesktopAgentSessionSortTime(session: DesktopAgentSession) {
  const timestamp =
    session.lastSeenAt ??
    session.openObservedAt ??
    session.launchStartedAt ??
    session.openedAt;
  const time = timestamp ? Date.parse(timestamp) : 0;
  return Number.isNaN(time) ? 0 : time;
}

function getDesktopAgentPromptState(
  status: Awaited<ReturnType<typeof getDesktopAgentStatus>> | null
): DesktopAgentInstallPrompt["agentState"] {
  if (!status?.isInstalled) {
    return "not_running";
  }
  return status.supportsSelfUpdate ? "self_update_supported" : "legacy";
}

function getDesktopAgentInitialMessage(
  prompt: DesktopAgentInstallPrompt,
  copy: DesktopAgentUpdateDialogCopy
) {
  if (prompt.localMasterSessionsNeedAttentionCount > 0) {
    return formatLocalMasterSessionsNeedAttentionMessage(
      prompt.localMasterSessionsNeedAttentionCount,
      copy
    );
  }
  if (prompt.agentState === "not_running") {
    return copy.agentUnavailable;
  }
  if (prompt.agentState === "legacy") {
    return copy.selfUpdateUnavailable;
  }
  return null;
}

function getDesktopAgentMasterBlockerFromOpenError(error: unknown) {
  if (!(error instanceof DesktopAgentClientError)) {
    return null;
  }
  if (error.code === "EXCEL_NOT_INSTALLED") {
    return "excel_missing";
  }
  if (error.code === "WORD_NOT_INSTALLED") {
    return "word_missing";
  }
  if (error.code === "POWERPOINT_NOT_INSTALLED") {
    return "powerpoint_missing";
  }
  if (
    error.code === "PDF_EDITOR_NOT_INSTALLED" ||
    error.code === "PDF_EDITOR_UNAVAILABLE"
  ) {
    return "pdf_editor_missing";
  }
  return null;
}

function getDesktopAgentOfficeBlockerMessage(
  blocker: NonNullable<DesktopAgentInstallPrompt["masterBlocker"]>,
  copy: DesktopAgentUpdateDialogCopy
) {
  if (blocker === "word_missing") {
    return copy.wordMissing;
  }
  if (blocker === "powerpoint_missing") {
    return copy.powerPointMissing;
  }
  if (blocker === "pdf_editor_missing") {
    return copy.pdfEditorMissing;
  }
  return copy.excelMissing;
}

function getDesktopAgentDialogStatus(
  prompt: DesktopAgentInstallPrompt,
  copy: DesktopAgentUpdateDialogCopy,
  state: {
    checking: boolean;
    updating: boolean;
    selfUpdateUnavailable: boolean;
    startFailed: boolean;
    masterBlockedByLocalOffice: boolean;
    masterBlockedByLocalSessions: boolean;
  }
): DesktopAgentDialogStatus {
  if (state.checking) {
    return {
      label: copy.statusWaitingForAgent,
      nextStep: copy.nextStepWait,
      tone: "sky",
    };
  }
  if (state.updating) {
    return {
      label: copy.statusUpdating,
      nextStep: copy.nextStepWait,
      tone: "sky",
    };
  }
  if (state.masterBlockedByLocalOffice) {
    return {
      label: copy.statusActionRequired,
      nextStep: copy.nextStepFixOffice,
      tone: "amber",
    };
  }
  if (state.masterBlockedByLocalSessions) {
    return {
      label: copy.statusActionRequired,
      nextStep: copy.nextStepResolveLocks,
      tone: "amber",
    };
  }
  if (state.startFailed || state.selfUpdateUnavailable) {
    return {
      label: copy.statusActionRequired,
      nextStep: copy.nextStepInstall,
      tone: "amber",
    };
  }
  if (prompt.agentState === "not_running") {
    return {
      label: copy.statusAgentStartRequired,
      nextStep: copy.nextStepStart,
      tone: "amber",
    };
  }
  if (prompt.agentState === "legacy") {
    return {
      label: copy.statusInstallRequired,
      nextStep: copy.nextStepInstall,
      tone: "amber",
    };
  }
  return {
    label: copy.statusUpdateReady,
    nextStep:
      prompt.localMasterSessionCount > 0
        ? copy.nextStepReleaseAndUpdate
        : copy.nextStepUpdate,
    tone: "sky",
  };
}

function getDesktopAgentDiagnosticRows(
  prompt: DesktopAgentInstallPrompt,
  copy: DesktopAgentUpdateDialogCopy
): DesktopAgentDiagnosticRow[] {
  const rows: DesktopAgentDiagnosticRow[] = [
    {
      label: copy.platformLabel,
      value: getDesktopAgentPlatformName(prompt.platform, copy),
    },
    {
      label: copy.agentStateLabel,
      value: getDesktopAgentStateName(prompt.agentState, copy),
    },
    {
      label: copy.agentVersionLabel,
      value: prompt.agentVersion ?? copy.unknown,
    },
    {
      label: copy.selfUpdateLabel,
      value: prompt.agentState === "self_update_supported" ? copy.yes : copy.no,
    },
    {
      label: copy.localMasterLocksLabel,
      value: String(prompt.localMasterSessionCount),
    },
    {
      label: copy.localMasterAttentionLabel,
      value: String(prompt.localMasterSessionsNeedAttentionCount),
    },
  ];

  if (prompt.masterBlocker) {
    rows.push({
      label: copy.officeBlockerLabel,
      value: prompt.masterBlocker,
    });
  }
  if (prompt.launchFailureReason) {
    rows.push({
      label: copy.launchFailureLabel,
      value: prompt.launchFailureReason,
    });
  }
  if (prompt.launchFailureLastError) {
    rows.push({
      label: copy.lastErrorLabel,
      value: prompt.launchFailureLastError,
    });
  }

  return rows;
}

function getDesktopAgentPlatformName(
  platform: DesktopAgentPlatform,
  copy: DesktopAgentUpdateDialogCopy
) {
  if (platform === "windows") {
    return copy.platformWindows;
  }
  if (platform === "macos") {
    return copy.platformMacos;
  }
  return copy.platformUnknown;
}

function getDesktopAgentStateName(
  agentState: DesktopAgentInstallPrompt["agentState"],
  copy: DesktopAgentUpdateDialogCopy
) {
  if (agentState === "not_running") {
    return copy.agentStateNotRunning;
  }
  if (agentState === "legacy") {
    return copy.agentStateLegacy;
  }
  return copy.agentStateSelfUpdate;
}

function formatLocalMasterSessionsNeedAttentionMessage(
  count: number,
  copy: DesktopAgentUpdateDialogCopy
) {
  const template =
    count === 1
      ? copy.localMasterSessionNeedsAttention
      : copy.localMasterSessionsNeedAttention;
  return template.replace("{count}", String(count));
}

function isLocalMasterSessionSafeForSelfUpdate(session: DesktopAgentSession) {
  if (session.mode !== "MASTER" || session.contentState !== "UNCHANGED") {
    return false;
  }
  return !isTerminalDesktopAgentRecoveryLifecycle(session.lifecycleState);
}

function isLocalMasterSessionAttentionNeededBeforeUpdate(
  session: DesktopAgentSession
) {
  if (session.mode !== "MASTER") {
    return false;
  }
  if (isTerminalDesktopAgentRecoveryLifecycle(session.lifecycleState)) {
    return false;
  }
  return session.contentState !== "UNCHANGED";
}

function isTerminalDesktopAgentRecoveryLifecycle(
  lifecycleState: DesktopAgentSession["lifecycleState"]
) {
  return [
    "CLOSED",
    "LOCAL_FILE_MISSING",
    "LOCK_REVOKED",
    "CONFLICT_RISK",
  ].includes(lifecycleState);
}

function getDesktopAgentDiagnosticMessage(
  status: DesktopAgentStatus | null,
  copy: DesktopAgentUpdateDialogCopy,
  fileName?: string | null
) {
  const requiredApp = getRequiredOfficeAppForMaster(fileName);
  if (requiredApp === "word") {
    const word = status?.health?.diagnostics?.word;
    if (isWordMissingDiagnostic(word)) {
      return copy.wordMissing;
    }
    return word?.recommendedAction ?? word?.message ?? null;
  }
  if (requiredApp === "powerPoint") {
    const powerPoint = status?.health?.diagnostics?.powerPoint;
    if (isPowerPointMissingDiagnostic(powerPoint)) {
      return copy.powerPointMissing;
    }
    return powerPoint?.recommendedAction ?? powerPoint?.message ?? null;
  }
  if (requiredApp === "pdfEditor") {
    const pdfEditor = status?.health?.diagnostics?.pdfEditor;
    if (isPdfEditorMissingDiagnostic(pdfEditor)) {
      return copy.pdfEditorMissing;
    }
    return pdfEditor?.recommendedAction ?? pdfEditor?.message ?? null;
  }

  const excel = status?.health?.diagnostics?.excel;
  if (isExcelMissingDiagnostic(excel)) {
    return copy.excelMissing;
  }
  if (!excel || excel.status !== "NEEDS_ATTENTION") {
    return null;
  }
  if (excel.hiddenAutomationProcessCount > 0) {
    return copy.hiddenAutomationExcel.replace(
      "{count}",
      String(excel.hiddenAutomationProcessCount)
    );
  }
  if (excel.comAutomation === "UNAVAILABLE") {
    return copy.excelComUnavailable;
  }
  return excel.recommendedAction ?? excel.message ?? null;
}

function getDesktopAgentMasterBlocker(
  status: DesktopAgentStatus | null,
  fileName?: string | null
) {
  const requiredApp = getRequiredOfficeAppForMaster(fileName);
  if (requiredApp === "word") {
    return isWordMissingDiagnostic(status?.health?.diagnostics?.word)
      ? "word_missing"
      : null;
  }
  if (requiredApp === "powerPoint") {
    return isPowerPointMissingDiagnostic(
      status?.health?.diagnostics?.powerPoint
    )
      ? "powerpoint_missing"
      : null;
  }
  if (requiredApp === "pdfEditor") {
    return isPdfEditorMissingDiagnostic(status?.health?.diagnostics?.pdfEditor)
      ? "pdf_editor_missing"
      : null;
  }
  return isExcelMissingDiagnostic(status?.health?.diagnostics?.excel)
    ? "excel_missing"
    : null;
}

function isExcelMissingDiagnostic(
  excel: DesktopAgentExcelDiagnostics | undefined
) {
  return excel?.status === "MISSING" || excel?.installed === false;
}

function isWordMissingDiagnostic(
  word: DesktopAgentWordDiagnostics | undefined
) {
  return word?.status === "MISSING" || word?.installed === false;
}

function isPowerPointMissingDiagnostic(
  powerPoint: DesktopAgentPowerPointDiagnostics | undefined
) {
  return powerPoint?.status === "MISSING" || powerPoint?.installed === false;
}

function isPdfEditorMissingDiagnostic(
  pdfEditor: DesktopAgentPdfEditorDiagnostics | undefined
) {
  return (
    pdfEditor?.status === "MISSING" ||
    pdfEditor?.installed === false ||
    pdfEditor?.trustedEditor === false
  );
}

function getRequiredOfficeAppForMaster(fileName?: string | null) {
  const extension = getFileExtension(fileName);
  if (extension === ".pdf") {
    return "pdfEditor";
  }
  if (extension === ".docx" || extension === ".doc") {
    return "word";
  }
  if (extension === ".pptx" || extension === ".ppt") {
    return "powerPoint";
  }
  return "excel";
}

function getFileExtension(fileName?: string | null) {
  const normalized = fileName?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  const dotIndex = normalized.lastIndexOf(".");
  return dotIndex <= 0 ? null : normalized.slice(dotIndex);
}

function getDesktopAgentUpdateMessage(
  status: string,
  copy: DesktopAgentUpdateDialogCopy,
  detail?: { message?: string; errorCode?: string }
) {
  if (detail?.message) {
    return detail.message;
  }
  if (status === "WAITING_FOR_WORKBOOK_CLOSE") {
    return copy.closeWorkbooks;
  }
  if (status === "DOWNLOADING") {
    return copy.downloading;
  }
  if (status === "VERIFYING_INSTALLER") {
    return copy.verifyingInstaller;
  }
  if (status === "STOPPING_AGENT") {
    return copy.stoppingAgent;
  }
  if (status === "REPAIRING_ENVIRONMENT") {
    return copy.repairingEnvironment;
  }
  if (status === "INSTALLING") {
    return copy.installing;
  }
  if (status === "STARTING_AGENT") {
    return copy.startingAgentUpdate;
  }
  if (status === "VERIFYING_HEALTH") {
    return copy.verifyingHealth;
  }
  if (status === "RESTARTING") {
    return copy.restarting;
  }
  if (status === "READY") {
    return copy.ready;
  }
  if (status === "FAILED") {
    return detail?.errorCode
      ? `${copy.failed} ${detail.errorCode}`
      : copy.failed;
  }
  return copy.releasingAndUpdating;
}

async function wakeDesktopAgent() {
  for (let attempt = 0; attempt < DESKTOP_AGENT_WAKE_ATTEMPTS; attempt += 1) {
    openDesktopAgentStartProtocol();
    if (await waitForDesktopAgentAvailability()) {
      return true;
    }
  }
  return false;
}

function isDesktopAgentSetupError(error: unknown) {
  return (
    error instanceof DesktopAgentClientError &&
    (error.code === "DESKTOP_AGENT_ROUTE_NOT_FOUND" ||
      error.code === "DESKTOP_AGENT_FAILED")
  );
}

async function waitForDesktopAgentAvailability() {
  const deadline = Date.now() + DESKTOP_AGENT_WAKE_CHECK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await checkDesktopAgentAvailability().catch(() => false)) {
      return true;
    }
    await sleep(DESKTOP_AGENT_WAKE_RETRY_DELAY_MS);
  }
  return false;
}

function openDesktopAgentStartProtocol() {
  if (typeof document === "undefined") {
    return;
  }
  if (navigator.userAgent.toLowerCase().includes("jsdom")) {
    return;
  }
  const frame = document.createElement("iframe");
  frame.style.display = "none";
  frame.src = DESKTOP_AGENT_START_PROTOCOL_URL;
  document.body.append(frame);
  window.setTimeout(() => frame.remove(), 1000);
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function detectDesktopAgentPlatform(): DesktopAgentPlatform {
  if (typeof navigator === "undefined") {
    return "unknown";
  }
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes("windows") || userAgent.includes("win64")) {
    return "windows";
  }
  if (userAgent.includes("mac os") || userAgent.includes("macintosh")) {
    return "macos";
  }
  return "unknown";
}

function getDesktopAgentDownloadUrl(platform: DesktopAgentPlatform) {
  if (platform === "windows") {
    return (
      process.env.NEXT_PUBLIC_DESKTOP_AGENT_WINDOWS_DOWNLOAD_URL?.trim() || null
    );
  }
  if (platform === "macos") {
    return (
      process.env.NEXT_PUBLIC_DESKTOP_AGENT_MACOS_DOWNLOAD_URL?.trim() || null
    );
  }
  return null;
}

function getDesktopAgentInstallDescription(
  platform: DesktopAgentPlatform,
  copy: DesktopAgentUpdateDialogCopy
) {
  if (platform === "windows") {
    return copy.windowsInstallDescription;
  }
  if (platform === "macos") {
    return copy.macosInstallDescription;
  }
  return copy.genericInstallDescription;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function getZipEntryReadOnlyDownloadPath(
  projectId: string,
  attachmentId: string,
  entryPath: string
) {
  const params = new URLSearchParams({ path: entryPath });
  return `/engagement/${projectId}/workflow/attachments/${attachmentId}/zip/entries/download?${params.toString()}`;
}

function getZipSessionEntryDownloadPath(
  projectId: string,
  sessionId: string,
  entryPath: string
) {
  const params = new URLSearchParams({ path: entryPath });
  return `/engagement/${projectId}/workflow/zip-master-sessions/${sessionId}/entries/download?${params.toString()}`;
}

function getZipEntryFileName(entryPath: string) {
  return (
    entryPath.replaceAll(/\/+$/g, "").split("/").findLast(Boolean) || entryPath
  );
}

async function releaseZipEntryMasterGrant(
  entrySession: ZipEntryMasterOpenResponse
) {
  await fetch(entrySession.releaseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: entrySession.projectId,
      attachmentId: entrySession.attachmentId,
      grantSecret: entrySession.grantSecret,
      reason: "UNCHANGED_RELEASE",
    }),
  });
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateOnly(value: string) {
  const locale =
    typeof document === "undefined"
      ? "zh-CN"
      : document.documentElement.lang || "zh-CN";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function createReviewQuestionImageDraft(file: File): ReviewQuestionImageDraft {
  return {
    id: `image-draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    file,
    previewUrl: createObjectPreviewUrl(file),
  };
}

function getClipboardImageFiles(data: DataTransfer | null) {
  if (!data) {
    return [];
  }
  const files: File[] = [];
  if (data.items?.length) {
    for (const item of data.items) {
      if (item.kind !== "file") {
        continue;
      }
      const file = item.getAsFile();
      if (file?.type.startsWith("image/")) {
        files.push(normalizePastedImageFile(file, files.length));
      }
    }
  }
  if (files.length === 0 && data.files?.length) {
    for (const file of data.files) {
      if (file.type.startsWith("image/")) {
        files.push(normalizePastedImageFile(file, files.length));
      }
    }
  }
  return files;
}

function normalizePastedImageFile(file: File, index: number) {
  if (file.name && file.name !== "image.png") {
    return file;
  }
  const extension = getReviewQuestionImageExtension(file.type);
  const stamp = new Date().toISOString().replaceAll(/[-:.TZ]/g, "");
  return new File(
    [file],
    `pasted-screenshot-${stamp}-${index + 1}.${extension}`,
    {
      type: file.type,
      lastModified: file.lastModified || Date.now(),
    }
  );
}

function getReviewQuestionImageExtension(mimeType: string) {
  switch (mimeType) {
    case "image/jpeg": {
      return "jpg";
    }
    case "image/webp": {
      return "webp";
    }
    case "image/gif": {
      return "gif";
    }
    default: {
      return "png";
    }
  }
}

function createObjectPreviewUrl(source: Blob) {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return "";
  }
  return URL.createObjectURL(source);
}

function revokeImageDraftPreview(previewUrl: string) {
  if (
    !previewUrl ||
    typeof URL === "undefined" ||
    typeof URL.revokeObjectURL !== "function"
  ) {
    return;
  }
  URL.revokeObjectURL(previewUrl);
}

function syncZipEntryMasterStatuses(
  entries: ZipMasterEntry[],
  activeEntries: NonNullable<ZipMasterSessionResponse["activeEntryMasters"]>
): ZipMasterEntry[] {
  const activeStates = new Map(
    activeEntries.map((entry) => [entry.entryPath, entry.state])
  );
  const visit = (entry: ZipMasterEntry): ZipMasterEntry => {
    if (entry.type === "folder") {
      return {
        ...entry,
        children: entry.children.map(visit),
      };
    }
    const { status: _status, masterState: _masterState, ...file } = entry;
    const masterState = activeStates.get(entry.path);
    return masterState ? { ...file, status: "MASTER", masterState } : file;
  };
  return entries.map(visit);
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
