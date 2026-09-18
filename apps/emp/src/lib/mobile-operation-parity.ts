import type { ProjectPermissionAction } from "@project-wing/shared";

import type { WorkbenchContentProps } from "../components/workbench-content";
import type { WorkbenchDirectoryProps } from "../components/workbench-directory";
import type { WorkbenchSearchFileAction } from "../components/workbench-search-file-actions";

/** Design obligations, NOT wired handlers or a claim of completed mobile support. */
export type MobileOperationSurface =
  | "navigation"
  | "detail"
  | "form"
  | "selection"
  | "destination-picker"
  | "confirmation"
  | "file-picker"
  | "download"
  | "capability-flow"
  | "authorization";
type CallbackKeys<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends (...args: never[]) => unknown
    ? K
    : never;
}[keyof T];

// A new desktop callback or permission action requires an explicit mobile mapping.
export const mobileDirectoryRequirements = {
  setSelectedNodeId: "navigation",
  openAddNode: "form",
  closeAddNode: "navigation",
  createNode: "form",
  renameNode: "form",
  deleteNode: "confirmation",
  onSelectPaper: "detail",
  onLocatePaper: "navigation",
  onFileClipboardChange: "selection",
  onCopyFileToNode: "destination-picker",
  onMoveFileToNode: "destination-picker",
  onCopyNodeToNode: "destination-picker",
  onMoveNodeToNode: "destination-picker",
  onUploadFile: "file-picker",
  onExportNode: "download",
  onVisibleFileBucketChange: "navigation",
  onMultiSelectedItemIdsChange: "selection",
  onClearSelection: "selection",
  onSearchChange: "form",
  onPanelToggle: "navigation",
} satisfies Record<
  CallbackKeys<WorkbenchDirectoryProps>,
  MobileOperationSurface
>;
export const mobileContentRequirements = {
  onSelectPathNode: "navigation",
  onActiveBucketChange: "navigation",
  deleteSelected: "confirmation",
  createPaper: "form",
  clearHighlightedPaper: "selection",
  setSelectedPaperId: "detail",
  onPreviewFile: "detail",
  onExportAttachments: "download",
  uploadFileToWorkingPaper: "file-picker",
  uploadFilesToNode: "file-picker",
  createPlaceholderToNode: "form",
  onCreateSmartForm: "form",
  onCreateFromTemplate: "form",
  onSetAttachmentClipboard: "selection",
  onPasteAttachmentClipboard: "destination-picker",
  onMoveAttachmentsToNode: "destination-picker",
  onOpenReviewNotes: "detail",
  onSmartFormOpenChange: "navigation",
} satisfies Record<CallbackKeys<WorkbenchContentProps>, MobileOperationSurface>;
export const mobileFileActionRequirements = {
  PREVIEW: "detail",
  PREVIEW_NEW_WINDOW: "detail",
  MASTER: "capability-flow",
  DOWNLOAD: "download",
} satisfies Record<WorkbenchSearchFileAction, MobileOperationSurface>;
export const mobilePermissionRequirements = {
  restoreProject: "confirmation",
  reviewSignoff: "confirmation",
  legacyPreparer: "authorization",
  legacyReviewer: "authorization",
  legacyEqcr: "authorization",
  legacyPartner: "authorization",
  legacyTaxReviewer: "authorization",
  deleteProject: "confirmation",
  archiveProject: "form",
  inviteProjectMembers: "form",
  removeProjectMembers: "confirmation",
  updateProjectInfo: "form",
  modifyIndex: "form",
  signPreparer: "confirmation",
  viewTemporaryFiles: "navigation",
  viewNotifications: "detail",
  viewRecycleBin: "navigation",
  uploadWorkingPapers: "file-picker",
  useLibrary: "form",
} satisfies Record<ProjectPermissionAction, MobileOperationSurface>;
