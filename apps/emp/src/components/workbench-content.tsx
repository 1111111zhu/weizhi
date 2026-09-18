"use client";

import type {
  ProjectLanguage,
  ProjectRole,
  WorkingPaperBucket,
} from "@project-wing/shared";
import { ProjectWingDevLogo } from "@project-wing/ui";
import type { MouseEvent, RefObject } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { Attachment, WorkflowNode } from "../api/client";
import type {
  DirectoryFileClipboard,
  DirectoryFileTransfer,
} from "./workbench-directory";
import { WorkbenchPaperSection } from "./workbench-paper-section";
import type {
  WorkbenchBreadcrumbSegment,
  WorkbenchFileActionRequest,
  WorkbenchPaperForm,
  WorkbenchPaperSectionCopy,
} from "./workbench-paper-section";
import type { WorkbenchReviewNotesTarget } from "./workbench-review-notes-types";

const EMPTY_DEFAULT_ARRAY: never[] = [];

const NOOP = () => {};

export type { WorkbenchPaperForm } from "./workbench-paper-section";
export type { WorkbenchFileActionRequest } from "./workbench-paper-section";

export type WorkbenchDraftForm = {
  title: string;
  content: string;
};

export type WorkbenchContentProps = {
  copy?: WorkbenchContentCopy;
  projectId: string;
  projectName?: string;
  projectLanguage?: ProjectLanguage;
  currentUserId?: string | null;
  currentProjectRole?: ProjectRole | null;
  selectedNode: WorkflowNode | null;
  selectedPath?: WorkbenchBreadcrumbSegment[];
  onSelectPathNode?: (nodeId: string) => void;
  selectedPathScrollRef?: RefObject<HTMLDivElement | null>;
  workflow?: WorkflowNode[];
  activeBucket?: WorkingPaperBucket;
  onActiveBucketChange?: (bucket: WorkingPaperBucket) => void;
  canDeleteSelected: boolean;
  deleteSelected: () => void;
  deletePending: boolean;
  paperForm: UseFormReturn<WorkbenchPaperForm>;
  createPaper: (values: WorkbenchPaperForm) => void;
  createPaperPending: boolean;
  selectedPaperId?: string | null;
  highlightedPaperId?: string | null;
  highlightedPaperIds?: string[];
  clearHighlightedPaper?: () => void;
  setSelectedPaperId?: (paperId: string | null) => void;
  onPreviewFile?: (attachmentId: string) => void;
  onExportAttachments?: (attachmentIds: string[]) => void;
  fileActionRequest?: WorkbenchFileActionRequest | null;
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
  onOpenReviewNotes?: (target: WorkbenchReviewNotesTarget) => void;
  onSmartFormOpenChange?: (open: boolean) => void;
};

export type WorkbenchSignoffStatusCopy = {
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
  revokeSuccess?: string;
  revokeDescription?: string;
  revokeFailed?: string;
};

export type WorkbenchEmptySlotUploadCopy = {
  titlePrefix: string;
  description: string;
  descriptionWithTitle: string;
  cancel: string;
  chooseFile: string;
  uploadAriaLabelPrefix: string;
  fileInputAriaLabelPrefix: string;
  alreadyHasFileTitle: string;
  alreadyHasFileDescription: string;
};

export type WorkbenchContentCopy = WorkbenchPaperSectionCopy & {
  selectPromptTitle: string;
  selectPromptDescription: string;
  signoffStatus?: WorkbenchSignoffStatusCopy;
  emptySlotUpload?: WorkbenchEmptySlotUploadCopy;
};

const defaultCopy: WorkbenchContentCopy = {
  selectPromptTitle: "Select a workpaper or file",
  selectPromptDescription:
    "Expand a group in the project directory and select a workpaper to upload files or open existing files.",
  signoffStatus: {
    preparedLabel: "Prepared",
    preparedTitle: "Preparation signed",
    removePreparedLabel: "Remove this preparation signoff",
    reviewedLabel: "Reviewed",
    reviewedTitle: "Review signed",
    removeReviewedLabel: "Remove this review signoff",
  },
  emptySlotUpload: {
    titlePrefix: "Upload file to",
    description:
      "This empty workpaper slot will keep its RefCode and receive the selected file.",
    descriptionWithTitle:
      "This empty workpaper slot will keep its RefCode and receive the selected file:",
    cancel: "Cancel",
    chooseFile: "Choose file",
    uploadAriaLabelPrefix: "Upload to",
    fileInputAriaLabelPrefix: "Choose file for",
    alreadyHasFileTitle: "This slot already has a file",
    alreadyHasFileDescription: "Upload a new version from the file tools.",
  },
};

export function WorkbenchContent({
  copy = defaultCopy,
  projectId,
  projectName = "Project",
  projectLanguage,
  currentUserId = null,
  currentProjectRole = null,
  selectedNode,
  selectedPath = EMPTY_DEFAULT_ARRAY,
  onSelectPathNode,
  selectedPathScrollRef,
  workflow = EMPTY_DEFAULT_ARRAY,
  activeBucket = "CURRENT",
  onActiveBucketChange = NOOP,
  selectedPaperId = null,
  setSelectedPaperId = NOOP,
  onPreviewFile,
  onExportAttachments,
  fileActionRequest,
  highlightedPaperId = null,
  highlightedPaperIds = EMPTY_DEFAULT_ARRAY,
  clearHighlightedPaper,
  uploadFileToWorkingPaper,
  uploadFilesToNode,
  createPlaceholderToNode,
  onCreateSmartForm,
  onCreateFromTemplate,
  placeholderDefaultCode,
  uploadFilePending = false,
  attachmentClipboard = null,
  onSetAttachmentClipboard,
  onPasteAttachmentClipboard,
  onMoveAttachmentsToNode,
  readOnly = false,
  showTemporaryFiles = true,
  disableFileMutations = false,
  forceReadOnlyOpen = false,
  canSignPreparer = true,
  onOpenReviewNotes,
  onSmartFormOpenChange,
}: WorkbenchContentProps) {
  const clearHighlightOnBlankClick = (event: MouseEvent<HTMLElement>) => {
    if (
      (!highlightedPaperId && highlightedPaperIds.length === 0) ||
      !clearHighlightedPaper
    ) {
      return;
    }
    const { target } = event;
    if (!(target instanceof Element)) {
      return;
    }
    if (
      target.closest(
        "button,a,input,select,textarea,label,tr,th,td,[role='button'],[role='menuitem']"
      )
    ) {
      return;
    }
    clearHighlightedPaper();
  };

  if (!selectedNode) {
    return (
      <section className="flex h-full min-h-0 flex-1 flex-col bg-workbench-panel">
        <div className="scrollbar-stable min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-5">
          <div className="flex min-h-[28rem] flex-1 flex-col items-center justify-center px-6 py-12 text-center">
            <ProjectWingDevLogo
              alt=""
              className="h-44 w-44 shrink-0 opacity-[0.14]"
            />
            <h2 className="mt-8 text-base font-semibold text-foreground">
              {copy.selectPromptTitle}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              {copy.selectPromptDescription}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-workbench-panel">
      <div
        role="presentation"
        onClick={clearHighlightOnBlankClick}
        className={
          selectedPaperId
            ? "min-h-0 flex-1 overflow-hidden px-4 pt-4 pb-0"
            : "min-h-0 flex-1 overflow-hidden p-0"
        }
      >
        <WorkbenchPaperSection
          projectId={projectId}
          projectName={projectName}
          projectLanguage={projectLanguage}
          copy={copy}
          currentUserId={currentUserId}
          currentProjectRole={currentProjectRole}
          selectedNode={selectedNode}
          selectedPath={selectedPath}
          onSelectPathNode={onSelectPathNode}
          selectedPathScrollRef={selectedPathScrollRef}
          workflow={workflow}
          selectedPaperId={selectedPaperId}
          setSelectedPaperId={setSelectedPaperId}
          onPreviewFile={onPreviewFile}
          onExportAttachments={onExportAttachments}
          fileActionRequest={fileActionRequest}
          highlightedPaperId={highlightedPaperId}
          highlightedPaperIds={highlightedPaperIds}
          activeBucket={activeBucket}
          onActiveBucketChange={onActiveBucketChange}
          readOnly={readOnly}
          showTemporaryFiles={showTemporaryFiles}
          disableFileMutations={disableFileMutations}
          forceReadOnlyOpen={forceReadOnlyOpen}
          canSignPreparer={canSignPreparer}
          onOpenReviewNotes={onOpenReviewNotes}
          onSmartFormOpenChange={onSmartFormOpenChange}
          uploadFileToWorkingPaper={
            readOnly ? undefined : uploadFileToWorkingPaper
          }
          uploadFilesToNode={readOnly ? undefined : uploadFilesToNode}
          createPlaceholderToNode={
            readOnly ? undefined : createPlaceholderToNode
          }
          onCreateSmartForm={readOnly ? undefined : onCreateSmartForm}
          onCreateFromTemplate={readOnly ? undefined : onCreateFromTemplate}
          placeholderDefaultCode={placeholderDefaultCode}
          uploadFilePending={uploadFilePending}
          attachmentClipboard={readOnly ? null : attachmentClipboard}
          onSetAttachmentClipboard={
            readOnly ? undefined : onSetAttachmentClipboard
          }
          onPasteAttachmentClipboard={
            readOnly ? undefined : onPasteAttachmentClipboard
          }
          onMoveAttachmentsToNode={
            readOnly ? undefined : onMoveAttachmentsToNode
          }
          signoffStatusCopy={copy.signoffStatus ?? defaultCopy.signoffStatus}
          emptySlotUploadCopy={
            copy.emptySlotUpload ?? defaultCopy.emptySlotUpload
          }
          onClearHighlightedPaper={clearHighlightedPaper}
        />
      </div>
    </section>
  );
}
