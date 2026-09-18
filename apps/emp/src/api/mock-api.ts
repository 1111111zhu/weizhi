import { burn } from "@kenjiuno/msgreader/lib/Burner";
import { TypeEnum } from "@kenjiuno/msgreader/lib/Reader";
import type {
  ApplyProjectTemplateInput,
  ClaimConfirmationDispatchQueueInput,
  CmpClientsResponse,
  CmpEngagementListQuery,
  CmpEngagementsResponse,
  ConfirmReviewQuestionImageInput,
  ConfirmationDispatchQueueQuery,
  ConfirmationType,
  CorrectProjectConfirmationTrackingInput,
  CreateAttachmentPlaceholderInput,
  CreateConfirmationDispatchBatchInput,
  CreateDesktopFolderInput,
  CreateProjectConfirmationDispatchInput,
  CreateProjectConfirmationFollowUpEventInput,
  CreateProjectConfirmationInput,
  CreateProjectConfirmationResponseInput,
  CreateProjectFileExportJobInput,
  CreateProjectSmartFormInput,
  CreateProjectTemplateInput,
  CreateProjectTemplateNodeInput,
  CreateProjectTemplatePlaceholderInput,
  CreateProjectTemplateSmartFormInput,
  CreateSmartFormTemplateInput,
  CreateUserInput,
  CreateWorkingPaperQuestionInput,
  CreateWorkspaceInput,
  ExecuteConfirmationDispatchBatchInput,
  FollowUpWorkingPaperQuestionInput,
  ImportProjectTemplateZipInput,
  PrepareProjectConfirmationDispatchInput,
  ProjectFileExportJob,
  ProjectInviteeDirectoryQueryInput,
  ProjectInviteeDirectoryResponse,
  ProjectTemplateFileInput,
  ProjectTemplateListQueryInput,
  ReleaseConfirmationDispatchQueueInput,
  RelocateAttachmentInput,
  RenameAttachmentInput,
  ReorderProjectTemplateItemsInput,
  ReorderDesktopProjectPlacementsInput,
  ReorderWorkingPaperAttachmentsInput,
  ReplyWorkingPaperQuestionInput,
  RestoreAttachmentInput,
  ReturnConfirmationDispatchQueueInput,
  ReturnWorkingPaperInput,
  RouteConfirmationResponseLibraryFileInput,
  SmartFormLocale,
  SmartFormPackage,
  SmartFormTemplateListQueryInput,
  SubmitProjectConfirmationInput,
  TmsProjectLink,
  TmsProjectLinkQuery,
  UpdateAttachmentIdentityInput,
  UpdateDesktopFolderInput,
  UpdateDesktopProjectPlacementInput,
  UpdateProjectConfirmationDraftInput,
  UpdateProjectConfirmationInput,
  UpdateProjectTemplateInput,
  UpdateProjectTemplateNodeInput,
  UpdateProjectTemplateItemCodeInput,
  UpdateSmartFormTemplateInput,
  UpdateUserInput,
  UpdateWorkingPaperAssigneesInput,
  UpdateWorkingPaperInput,
  UpdateWorkspaceInput,
  UserListQueryInput,
  WithdrawProjectConfirmationInput,
  WorkItemDomain,
  WorkItemListResponse,
  WorkItemView,
} from "@project-wing/shared";
import {
  ATTACHMENT_PLACEHOLDER_TYPES,
  EMAIL_SIGN_IN_OTP_MOCK_CODE,
  EmailOtpClientError,
  SMART_FORM_MIME_TYPE,
  STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY,
  compileSmartFormV2Definition,
  canGlobalRoleManageConfirmationTemplates,
  formatNumberWithoutDigitFour,
  getAssignableProjectRolesForGlobalRole,
  getAttachmentPlaceholderReplacementName,
  getAttachmentPlaceholderTypeForFile,
  getProjectInvitationEligibility,
  normalizeCodeSequenceWithoutDigitFour,
  normalizeCodeWithoutDigitFour,
  validateSmartFormV2Response,
} from "@project-wing/shared";
import JSZip from "jszip";

import type {
  ArchiveCheckJobSnapshot,
  ArchiveCheckReport,
  ArchiveJobEventHandler,
  ArchiveJobSnapshot,
  Attachment,
  AttachmentConflictResolution,
  AttachmentConflictSummary,
  AttachmentHistory,
  AttachmentSignoffHistory,
  AttachmentVersion,
  ConfirmationDispatchBatch,
  ConfirmationDispatchQueueItem,
  ConfirmationEmpImportJob,
  ConfirmationEmpImportPreview,
  ConfirmationEmpImportPreviewInput,
  ConfirmationEmpImportRequest,
  ConfirmationEmpImportRestoreInput,
  ConfirmationEmpImportWithdrawInput,
  ConfirmationEmpProject,
  ConfirmationResponseLibraryFile,
  ConfirmationTemplateLibraryFile,
  InboxMessage,
  InboxMessageType,
  Project,
  ProjectArchiveArtifact,
  ProjectAttachment,
  ProjectConfirmation,
  ProjectFileExportJobEventHandler,
  ProjectTemplate,
  ProjectTemplateApplyPlan,
  ProjectTemplateFile,
  ProjectTemplateNode,
  ProjectTemplateSmartForm,
  ReviewQuestionMessageImage,
  RollForwardPreview,
  SmartFormReadResponse,
  SmartFormSessionResponse,
  SmartFormTemplate,
  SmartFormTemplateVersion,
  Tracking17TrackCarrier,
  Tracking17TrackConnection,
  UpdateConfirmationTemplateLibraryDesignInput,
  User,
  UserMailConnection,
  WorkflowNode,
  WorkingPaper,
  WorkingPaperQuestion,
  WorkingPaperSignoff,
  Workspace,
  ZipMasterCloseResponse,
  ZipMasterEntry,
  ZipMasterFileOperationInput,
  ZipMasterOpenResponse,
  ZipMasterOperationInput,
  ZipMasterSessionResponse,
  ZipMasterTextOperationInput,
  ZipReadOnlyResponse,
} from "./client";
import {
  acceptInvitation,
  createInvitation,
  createProject,
  createWorkflowNode,
  createWorkingPaper,
  moveProjectPlacement,
  updateProject,
  updateProjectMemberInChargeRole,
  recoverProjectPic,
  createPicRecoveryInvitation,
  reauthorizeProjectMember,
  updateProjectMemberRole,
  updateUser,
  userRoleImpact,
  updateWorkflowNode,
} from "./mock-actions";
import { mockConfirmationLibraryApi } from "./mock-confirmation-library";
import {
  defaultSmartFormTemplates,
  mockCmpClients,
  mockCmpEngagements,
} from "./mock-data";
import { mockDocxPreviewBytes } from "./mock-docx-preview";
import { mockPptxPreviewBytes } from "./mock-pptx-preview";
import {
  addLog,
  ensureDesktopPlacements,
  findNode,
  findProject,
  getCurrentUser,
  loadState,
  mockError,
  removeNode,
  reorderDesktopPlacements,
  setCurrentUser,
  updateDesktopPlacement,
  withState,
} from "./mock-store";
import type { MockAttachmentContent, MockState } from "./mock-types";
import { mockXlsxPreviewBytes } from "./mock-xlsx-preview";

type MockInboxMessageInput = {
  recipientId: string;
  senderId?: string | null;
  projectId?: string | null;
  workingPaperId?: string | null;
  reviewQuestionId?: string | null;
  reviewQuestion?: WorkingPaperQuestion | null;
  type: InboxMessageType;
  title: string;
  body: string;
  actionUrl?: string | null;
};

function mockEntityId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const mockArchiveCheckJobs = new Map<string, ArchiveCheckJobSnapshot>();
const mockArchiveJobs = new Map<string, ArchiveJobSnapshot>();
const mockTmsProjectLinks = new Map<string, TmsProjectLink>([
  [
    "preview-linked-fieldwork",
    {
      id: "tms-link-preview-linked",
      rowId: "preview-linked-fieldwork",
      ownerUserId: "user-partner",
      ownerName: "Jony Ma",
      year: 2026,
      month: 9,
      periodScope: "first",
      tmsCode: "DUMMY-TMS-000101",
      label: "Audit fieldwork",
      projectId: "project-orchid-2026",
      projectCode: "AUD-2026-0001",
      projectName: "Orchid Holdings 2026 audit",
      workType: "Normal",
      description: "Audit fieldwork",
      hoursByDate: {
        "2026-09-01": 8,
        "2026-09-02": 8,
        "2026-09-03": 6,
      },
      periodTotal: 22,
      status: "LINKED",
    },
  ],
  [
    "preview-pending-reporting",
    {
      id: "tms-link-preview-pending",
      rowId: "preview-pending-reporting",
      ownerUserId: "user-partner",
      ownerName: "Jony Ma",
      year: 2026,
      month: 9,
      periodScope: "first",
      tmsCode: "DUMMY-TMS-000102",
      label: "Reporting support",
      projectId: null,
      projectCode: null,
      projectName: null,
      workType: "OT",
      description: "Reporting support",
      hoursByDate: {
        "2026-09-04": 2,
        "2026-09-07": 3,
      },
      periodTotal: 5,
      status: "PENDING",
    },
  ],
]);
const mockProjectFileExportJobs = new Map<
  string,
  { job: ProjectFileExportJob; blob: Blob }
>();

function isInFlightProjectFileExportJob(job: ProjectFileExportJob) {
  return job.status === "QUEUED" || job.status === "RUNNING";
}
const mockConfirmationEmpImportJobs = new Map<
  string,
  ConfirmationEmpImportJob
>();
const mockConfirmationTemplateLibraryFiles: ConfirmationTemplateLibraryFile[] =
  [];
const mockConfirmationTemplateLibraryBodies = new Map<string, Blob>();
const mockArchiveArtifacts = new Map<string, ProjectArchiveArtifact>();
const mockSmartFormPackages = new Map<string, SmartFormPackage>();
const mockZipMasterEntries = new Map<string, ZipMasterEntry[]>();
const MOCK_XLSX_ATTACHMENT_CONTENT = "__mock_xlsx_attachment_content__";
const MOCK_ZIP_ATTACHMENT_CONTENT = "__mock_zip_attachment__";
const MOCK_ZIP_PREVIEW_BASE64 =
  "UEsDBAoAAAAAAAqM/lwX4CvkIwAAACMAAAAeABwAcHJvamVjdHdpbmctYXJjaGl2ZS1yZWFkbWUudHh0VVQJAAMjGmtqIxpranV4CwABBOgDAAAE6QMAAFByb2plY3QgV2luZyBhcmNoaXZlIHByZXZpZXcgbW9jay4KUEsBAh4DCgAAAAAACoz+XBfgK+QjAAAAIwAAAB4AGAAAAAAAAQAAAKSBAAAAAHByb2plY3R3aW5nLWFyY2hpdmUtcmVhZG1lLnR4dFVUBQADIxpranV4CwABBOgDAAAE6QMAAFBLBQYAAAAAAQABAGQAAAB7AAAAAAA=";

async function serializeMockAttachmentContent(
  file: File
): Promise<MockAttachmentContent> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x80_00;

  for (let start = 0; start < bytes.length; start += chunkSize) {
    binary += String.fromCodePoint(...bytes.subarray(start, start + chunkSize));
  }

  return {
    base64: btoa(binary),
    mimeType: file.type || "application/octet-stream",
  };
}

function isMockAttachmentContent(
  value: unknown
): value is MockAttachmentContent {
  return (
    typeof value === "object" &&
    value !== null &&
    "base64" in value &&
    "mimeType" in value
  );
}

function mockAttachmentContentBlob(content: MockAttachmentContent) {
  const binary = atob(content.base64);
  const bytes = Uint8Array.from(
    binary,
    (character) => character.codePointAt(0) ?? 0
  );
  return new Blob([bytes], { type: content.mimeType });
}

function createMockZipPreviewBlob() {
  const binary = atob(MOCK_ZIP_PREVIEW_BASE64);
  const bytes = Uint8Array.from(
    binary,
    (character) => character.codePointAt(0) ?? 0
  );
  return new Blob([bytes], { type: "application/zip" });
}
function ensureSuperAdmin(state: MockState) {
  const user = getCurrentUser(state);
  if (user.globalRole !== "SUPER_ADMIN") {
    throw mockError("无权访问该功能", "FORBIDDEN");
  }
  return user;
}

function ensureConfirmationTemplateManager(state: MockState) {
  const user = getCurrentUser(state);
  if (!canGlobalRoleManageConfirmationTemplates(user.globalRole)) {
    throw mockError("无权管理函证模板", "FORBIDDEN");
  }
  return user;
}

function emptyTracking17TrackConnection(): Tracking17TrackConnection {
  return {
    provider: "TRACKING_17TRACK",
    connected: false,
    status: null,
    verifiedAt: null,
    lastTestedAt: null,
    lastError: null,
    quotaTotal: null,
    quotaUsed: null,
    quotaRemain: null,
    updatedAt: null,
    updatedBy: null,
  };
}

const MOCK_TRACKING_CARRIERS: Tracking17TrackCarrier[] = [
  {
    code: 191_222,
    countryIso: "CN",
    name: "WHWDT",
    nameZh: "武汉沃德通",
  },
  {
    code: 100_003,
    countryIso: "CN",
    name: "SF Express",
    nameZh: "顺丰速运",
  },
  {
    code: 100_002,
    countryIso: "CN",
    name: "China Post",
    nameZh: "中国邮政",
  },
];

function searchMockTrackingCarriers(query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) {
    return MOCK_TRACKING_CARRIERS;
  }
  return MOCK_TRACKING_CARRIERS.filter((carrier) =>
    `${carrier.name} ${carrier.nameZh} ${carrier.code}`
      .toLocaleLowerCase()
      .includes(normalized)
  );
}

function addMockInboxMessage(state: MockState, input: MockInboxMessageInput) {
  if (input.senderId && input.senderId === input.recipientId) {
    return;
  }

  const project = input.projectId ? findProject(state, input.projectId) : null;
  const workspace = project
    ? state.workspaces.find((item) => item.id === project.workspaceId)
    : null;
  const paper =
    input.projectId && input.workingPaperId
      ? findWorkingPaper(
          state.workflows[input.projectId] ?? [],
          input.workingPaperId
        )
      : null;
  const question =
    input.reviewQuestion ??
    (input.projectId && input.reviewQuestionId
      ? findReviewQuestion(
          state.workflows[input.projectId] ?? [],
          input.reviewQuestionId
        )
      : null);
  const sender = input.senderId
    ? (state.users.find((item) => item.id === input.senderId) ?? null)
    : null;
  const assignedTo =
    question?.assignedTo ??
    state.users.find((item) => item.id === question?.assignedToId) ??
    null;
  const createdBy =
    question?.createdBy ??
    state.users.find((item) => item.id === question?.createdById) ??
    null;
  const now = new Date().toISOString();
  const message: InboxMessage = {
    id: `message-${Date.now()}-${state.messages.length}`,
    recipientId: input.recipientId,
    senderId: input.senderId ?? null,
    projectId: input.projectId ?? null,
    workingPaperId: input.workingPaperId ?? null,
    reviewQuestionId: input.reviewQuestionId ?? null,
    type: input.type,
    title: input.title,
    body: input.body,
    actionUrl:
      input.actionUrl ??
      (input.projectId ? `/engagement/${input.projectId}` : null),
    readAt: null,
    createdAt: now,
    sender,
    project: project
      ? {
          id: project.id,
          projectCode: project.projectCode,
          name: project.name ?? project.projectCode,
          workspace: workspace
            ? {
                id: workspace.id,
                name: workspace.name,
                clientName: workspace.clientName,
              }
            : undefined,
        }
      : null,
    workingPaper: paper
      ? {
          id: paper.id,
          code: normalizeCodeWithoutDigitFour(paper.code),
          title:
            paper.title === paper.code
              ? normalizeCodeWithoutDigitFour(paper.code)
              : paper.title,
        }
      : null,
    reviewQuestion: question
      ? {
          id: question.id,
          workingPaperId: question.workingPaperId,
          attachmentId: question.attachmentId ?? null,
          smartFormNodeId: question.smartFormNodeId ?? null,
          smartFormRowId: question.smartFormRowId ?? null,
          smartFormTargetLabel: question.smartFormTargetLabel ?? null,
          status: question.status,
          body: question.body,
          assignedTo: assignedTo
            ? {
                id: assignedTo.id,
                name: assignedTo.name,
                email: assignedTo.email,
              }
            : null,
          createdBy: createdBy
            ? {
                id: createdBy.id,
                name: createdBy.name,
                email: createdBy.email,
              }
            : null,
        }
      : null,
    projectInvitation: null,
  };

  state.messages = [message, ...state.messages];
}

function notificationExcerpt(value: string, limit = 120) {
  const normalized = value.trim().replaceAll(/\s+/g, " ");
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit - 1)}...`;
}

function addZipMasterOperationMock(
  projectId: string,
  sessionId: string,
  operation: ZipMasterFileOperationInput,
  file: File
): Promise<ZipMasterSessionResponse>;
function addZipMasterOperationMock(
  projectId: string,
  sessionId: string,
  operation: ZipMasterTextOperationInput
): Promise<ZipMasterSessionResponse>;
function addZipMasterOperationMock(
  projectId: string,
  sessionId: string,
  operation: ZipMasterOperationInput,
  file?: File
) {
  return withState((state): ZipMasterSessionResponse => {
    const attachmentId = sessionId.replace(/^mock-zip-lock-/, "");
    const attachment = findAttachment(
      state.workflows[projectId] ?? [],
      attachmentId
    );
    if (!attachment) {
      throw mockError("Zip Master session not found");
    }
    if (isZipMasterFileOperation(operation) && !file) {
      throw mockError(
        "Zip file operations require a file",
        "VALIDATION_FAILED"
      );
    }
    const currentEntries =
      mockZipMasterEntries.get(sessionId) ?? mockZipEntries();
    const nextEntries = applyMockZipOperation(currentEntries, operation, file);
    mockZipMasterEntries.set(sessionId, nextEntries);
    return mockZipMasterSession(projectId, attachment, sessionId, true);
  });
}

const MOCK_ASSET_ATTACHMENT_PREFIX = "__mock_asset_preview__:";
const MOCK_CSV_ATTACHMENT_CONTENT = "__mock_csv_attachment__";
const MOCK_DOCX_ATTACHMENT_CONTENT = "__mock_docx_attachment__";
const MOCK_EML_ATTACHMENT_CONTENT = "__mock_eml_attachment__";
const MOCK_PDF_ATTACHMENT_CONTENT = "__mock_pdf_attachment__";
const MOCK_PDF_PREVIEW_CONTENT =
  "JVBERi0xLjcKJYGBgYEKCjYgMCBvYmoKPDwKL0ZpbHRlciAvRmxhdGVEZWNvZGUKL0xlbmd0aCAxODMKPj4Kc3RyZWFtCnicbY7NCgIxDITveYqeBbWbNpMWRPBnFw9ehL6AyCqKHlbE5ze7elGkKZ1JSubraFnITyrnJ2w3iLufaLppr8/2cT7sx+pzislryo69K0fi6MqW7L+dyilbWf9GM/HKaLCAIGhkL4qMGjbWfmLWvKjOXblQGVFdaEfdED8s+87NtgKJBclV/DcX6Z0b15YasGSP2CsVrI2h7hlUNJg2BaBRHt6MFeSXigdnvNEcf8jrL9YXoYxBDQplbmRzdHJlYW0KZW5kb2JqCgo3IDAgb2JqCjw8Ci9GaWx0ZXIgL0ZsYXRlRGVjb2RlCi9UeXBlIC9PYmpTdG0KL04gNQovRmlyc3QgMjYKL0xlbmd0aCAzNzQKPj4Kc3RyZWFtCnic1VLfS8MwEH7PX3GP+iBJ0zRpZQz2qwoylE1QFB+6NozKSKTNZP733rWdYw/is5Qjubvvct/1vggESFAKYjApKEhiCQmYOIPRiPHHrw8L/KHY2pbxu7pq4RUxAlbwxvjM712AiI3H7ISdFaHY+S3riyAi8BHx0PhqX9oGRvkiz4UwQgit0LQQco7nDC1Dk+hjTqZ4RzNqMIyZWIh4grm8N236Gsp32GSoX+CJWE2YeY9Vae//9KVei/4N+RefbMz40lfzIli4mF9LIbUwMomUkol+ucTf0dgi+P87XMe/9u7XCc/2TOulJTeWNNBtma9s6/dNiWsnXO4xQ5dbu/u0oS6LKyOyFHmaNEONdSWnXGaU1Cl2SocctuPP95t3W3bPkLs4hJt1IH59gGJLW9XF1B9QmQI/HUkwmSR9TpzzgRTbadUFZEqeHvR7Ng6RZXy934TOpWDE+LRobTfGiSeScKWvarcF/lS7iWvrY4Be/AbF0s0xCmVuZHN0cmVhbQplbmRvYmoKCjggMCBvYmoKPDwKL1NpemUgOQovUm9vdCAyIDAgUgovSW5mbyAzIDAgUgovRmlsdGVyIC9GbGF0ZURlY29kZQovVHlwZSAvWFJlZgovTGVuZ3RoIDM5Ci9XIFsgMSAyIDIgXQovSW5kZXggWyAwIDkgXQo+PgpzdHJlYW0KeJwVxLENACAQA7FLQKJl/xnZ4dG5MDBTDlistmyHC4n1wQdc7wNICmVuZHN0cmVhbQplbmRvYmoKCnN0YXJ0eHJlZgo3NDgKJSVFT0Y=";
const MOCK_PNG_ATTACHMENT_CONTENT = "__mock_png_attachment__";
const MOCK_PPTX_ATTACHMENT_CONTENT = "__mock_pptx_attachment__";
const MOCK_CSV_PREVIEW_CONTENT = `Account,Amount,Check,Comment
Cash,1200,Exception,Needs bank statement
Revenue,4500,Not applicable,Missing support
Inventory,980,Clear,Count sheet agreed`;
const MOCK_EML_PREVIEW_CONTENT = `From: finance@example.com
To: audit@example.com
Subject: Bank statement evidence
Date: Tue, 30 Jul 2026 10:00:00 +0800
MIME-Version: 1.0
Content-Type: text/plain; charset=utf-8

Attached is the bank statement evidence for the current-year cash balance.
`;
const MOCK_AUDIO_PREVIEW_BASE64 =
  "UklGRpYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgATElTVBoAAABJTkZPSVNGVA4AAABMYXZmNjAuMTYuMTAwAGRhdGFQAAAAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIA=";
const MOCK_VIDEO_PREVIEW_BASE64 =
  "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAIXEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHYTbuMU6uEElTDZ1OsggEeTbuMU6uEHFO7a1OsggIB7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsirXsYMPQkBNgI1MYXZmNjAuMTYuMTAwV0GNTGF2ZjYwLjE2LjEwMESJiEBeAAAAAAAAFlSua8GuAQAAAAAAADjXgQFzxYi7F07TUQrUOZyBACK1nIN1bmSIgQCGhVZfVlA5g4EBI+ODhAJiWgDgibCBArqBApqBAhJUw2dAgHNzoGPAgGfImkWjh0VOQ09ERVJEh41MYXZmNjAuMTYuMTAwc3PaY8CLY8WIuxdO01EK1DlnyKVFo4dFTkNPREVSRIeYTGF2YzYwLjMxLjEwMiBsaWJ2cHgtdnA5Z8ihRaOIRFVSQVRJT05Eh5MwMDowMDowMC4xMjAwMDAwMDAAH0O2ddjngQCjqYEAAICCSYNCAAAQABYAOCQcGEoAACAgABG///9cdf////6+U///s+AAo5OBACgAhgBAkpwAUAAAAyAAAEtAo5OBAFAAhgBAkpwATuAAAyAAAEtAHFO7a5G7j7OBALeK94EB8YIBpPCBAw==";
const MOCK_IMAGE_PREVIEW_BASE64: Record<string, string> = {
  avif: "AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAAD5bWV0YQAAAAAAAAAvaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAFBpY3R1cmVIYW5kbGVyAAAAAA5waXRtAAAAAAABAAAAHmlsb2MAAAAARAAAAQABAAAAAQAAASEAAAAgAAAAKGlpbmYAAAAAAAEAAAAaaW5mZQIAAAAAAQAAYXYwMUNvbG9yAAAAAGppcHJwAAAAS2lwY28AAAAUaXNwZQAAAAAAAAACAAAAAgAAABBwaXhpAAAAAAMICAgAAAAMYXYxQ4EADAAAAAATY29scm5jbHgAAgACAAIAAAAAF2lwbWEAAAAAAAAAAQABBAECgwQAAAAobWRhdAoJAAAAAAZ//MAgMhMQAMAAAAKAAAAAsBNRPxROfLRg",
  bmp: "Qk2OAAAAAAAAAIoAAAB8AAAAAQAAAAEAAAABABgAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAD/AAD/AAAAAAAA/0JHUnMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAA9oI7AA==",
  gif: "R0lGODlhAQABAPAAADuC9gAAACH5BAAAAAAAIf8LSW1hZ2VNYWdpY2sOZ2FtbWE9MC40NTQ1NDUALAAAAAABAAEAAAICRAEAOw==",
  jpeg: "/9j/4AAQSkZJRgABAQAAAAAAAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAABf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAVAQEBAAAAAAAAAAAAAAAAAAAHCP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AD1dgd//2Q==",
  png: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAGUExURTuC9v///6NPwjoAAAABYktHRAH/Ai3eAAAAB3RJTUUH6gceCikAMDx0xQAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=",
  webp: "UklGRjoAAABXRUJQVlA4IC4AAADQAQCdASoBAAEAAgA0JaACdLoB+AADsAD+y7f/1BnyDPkGfqpf/IL1b5tjQAAA",
};

function createMockPdfPreviewBlob() {
  const binary = atob(MOCK_PDF_PREVIEW_CONTENT);
  const bytes = Uint8Array.from(
    binary,
    (character) => character.codePointAt(0) ?? 0
  );

  return new Blob([bytes], { type: "application/pdf" });
}

function createMockPngPreviewBlob() {
  return new Blob(
    [
      new Uint8Array([
        137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0,
        1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65,
        84, 120, 156, 99, 248, 255, 255, 63, 0, 5, 254, 2, 254, 167, 53, 129,
        132, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
      ]),
    ],
    { type: "image/png" }
  );
}

function createBase64PreviewBlob(base64: string, type: string) {
  const binary = atob(base64);
  const bytes = Uint8Array.from(
    binary,
    (character) => character.codePointAt(0) ?? 0
  );
  return new Blob([bytes], { type });
}

function encodeMockUtf16(value: string) {
  const bytes = new Uint8Array((value.length + 1) * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < value.length; index += 1) {
    view.setUint16(index * 2, value.charCodeAt(index), true);
  }
  return bytes;
}

function createMockMsgPreviewBlob() {
  const rootProperties = new Uint8Array(24 + 16 * 4);
  const rootView = new DataView(rootProperties.buffer);
  [0x00_1a_00_1e, 0x00_37_00_1f, 0x0c_1f_00_1f, 0x10_00_00_1f].forEach(
    (propertyTag, index) => {
      const offset = 24 + index * 16;
      rootView.setUint32(offset, propertyTag, true);
      rootView.setUint32(offset + 4, 2, true);
    }
  );
  const ascii = (value: string) =>
    Uint8Array.from(value, (character) => character.codePointAt(0) ?? 0);
  const subject = encodeMockUtf16("Bank statement evidence");
  const body = encodeMockUtf16("Attached is the bank statement evidence.");
  const entries = [
    {
      name: "Root Entry",
      type: TypeEnum.ROOT,
      children: [1, 2, 3, 4],
      length: 0,
    },
    {
      name: "__properties_version1.0",
      type: TypeEnum.DOCUMENT,
      binaryProvider: () => rootProperties,
      length: rootProperties.length,
    },
    {
      name: "__substg1.0_001A001E",
      type: TypeEnum.DOCUMENT,
      binaryProvider: () => ascii("IPM.Note\0"),
      length: 9,
    },
    {
      name: "__substg1.0_0037001F",
      type: TypeEnum.DOCUMENT,
      binaryProvider: () => subject,
      length: subject.length,
    },
    {
      name: "__substg1.0_1000001F",
      type: TypeEnum.DOCUMENT,
      binaryProvider: () => body,
      length: body.length,
    },
  ];
  const bytes = burn(entries);
  return new Blob([bytes.buffer as ArrayBuffer], {
    type: "application/vnd.ms-outlook",
  });
}

function createMockAssetPreviewBlob(fileName: string) {
  const normalizedName = fileName.toLowerCase();
  if (
    /\.(zip|rar|7z|tar|tgz|gz|tbz2?|bz2|txz|xz|cab|ar|cpio|iso)$/.test(
      normalizedName
    )
  ) {
    return createMockZipPreviewBlob();
  }
  if (normalizedName.endsWith(".msg")) {
    return createMockMsgPreviewBlob();
  }
  if (normalizedName.endsWith(".eml")) {
    return new Blob([MOCK_EML_PREVIEW_CONTENT], { type: "message/rfc822" });
  }
  const extension = normalizedName.split(".").pop() ?? "";
  if (extension === "svg") {
    return new Blob(
      [
        '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="rgb(59,130,246)"/></svg>',
      ],
      { type: "image/svg+xml" }
    );
  }
  const imageKey = extension === "jpg" ? "jpeg" : extension;
  if (imageKey in MOCK_IMAGE_PREVIEW_BASE64) {
    const mimeType = imageKey === "jpeg" ? "image/jpeg" : `image/${imageKey}`;
    return createBase64PreviewBlob(
      MOCK_IMAGE_PREVIEW_BASE64[imageKey],
      mimeType
    );
  }
  if (/\.(mp4|mov)$/.test(normalizedName)) {
    return createBase64PreviewBlob(MOCK_VIDEO_PREVIEW_BASE64, "video/webm");
  }
  if (normalizedName.endsWith(".webm")) {
    return createBase64PreviewBlob(MOCK_VIDEO_PREVIEW_BASE64, "video/webm");
  }
  if (/\.(aac|flac|m4a|mp3|ogg|wav)$/.test(normalizedName)) {
    return createBase64PreviewBlob(MOCK_AUDIO_PREVIEW_BASE64, "audio/wav");
  }
  return null;
}

function isMockAssetPreviewContent(value: unknown): value is string {
  return (
    typeof value === "string" && value.startsWith(MOCK_ASSET_ATTACHMENT_PREFIX)
  );
}

const mockMailConnections = new Map<string, UserMailConnection>();
let mockTracking17TrackConnection: Tracking17TrackConnection | null = null;

export const mockApi = {
  ...mockConfirmationLibraryApi,
  impersonateDevelopmentAccount: (email: string) => mockApi.login(email, ""),
  listDevelopmentAccounts: () =>
    withState((state) =>
      state.users
        .filter((user) => user.status === "ACTIVE")
        .map(({ email, name, globalRole }) => ({
          email,
          name,
          role: globalRole,
        }))
    ),
  login: (email: string, _password: string) =>
    withState((state) => {
      const user = state.users.find((item) => item.email === email);
      if (!user) {
        throw mockError("演示账号不存在", "INVALID_CREDENTIALS");
      }
      if (user.status === "DISABLED") {
        throw mockError("该演示账号已停用", "USER_DISABLED");
      }
      setCurrentUser(user.id);
      return user;
    }),
  requestLoginOtp: (_email: string) =>
    Promise.resolve({ demoCode: EMAIL_SIGN_IN_OTP_MOCK_CODE } as {
      demoCode?: string;
    }),
  loginWithOtp: (email: string, otp: string) => {
    if (otp !== EMAIL_SIGN_IN_OTP_MOCK_CODE) {
      throw new EmailOtpClientError("OTP_INVALID", 400);
    }
    return mockApi.login(email, "");
  },
  requestPasswordResetOtp: (_email: string) =>
    Promise.resolve({ demoCode: EMAIL_SIGN_IN_OTP_MOCK_CODE } as {
      demoCode?: string;
    }),
  verifyPasswordResetOtp: (_email: string, otp: string) => {
    if (otp !== EMAIL_SIGN_IN_OTP_MOCK_CODE) {
      throw new EmailOtpClientError("OTP_INVALID", 400);
    }
    return Promise.resolve();
  },
  resetPasswordWithOtp: (_email: string, otp: string, _password: string) => {
    if (otp !== EMAIL_SIGN_IN_OTP_MOCK_CODE) {
      throw new EmailOtpClientError("OTP_INVALID", 400);
    }
    return Promise.resolve();
  },
  me: () => withState((state) => getCurrentUser(state)),
  updatePreferredLocale: (preferredLocale: "zh-CN" | "en-US") =>
    withState((state) => {
      const user = getCurrentUser(state);
      user.preferredLocale = preferredLocale;
      return user;
    }),
  signOut: () => Promise.resolve(),
  userMailConnection: () =>
    withState((state) => {
      const user = getCurrentUser(state);
      return (
        mockMailConnections.get(user.id) ?? {
          emailAddress: user.email,
          connected: false,
          provider: "WECOM_EXMAIL" as const,
          status: null,
          verifiedAt: null,
          lastTestedAt: null,
          lastError: null,
          updatedAt: null,
        }
      );
    }),
  connectUserMail: (_clientPassword: string) =>
    withState((state) => {
      const user = getCurrentUser(state);
      const now = new Date().toISOString();
      const connection: UserMailConnection = {
        emailAddress: user.email,
        connected: true,
        provider: "WECOM_EXMAIL",
        status: "CONNECTED",
        verifiedAt: now,
        lastTestedAt: now,
        lastError: null,
        updatedAt: now,
      };
      mockMailConnections.set(user.id, connection);
      return connection;
    }),
  testUserMailConnection: () =>
    withState((state) => {
      const user = getCurrentUser(state);
      const connection = mockMailConnections.get(user.id);
      if (!connection) {
        throw mockError("请先连接企业邮箱");
      }
      const tested = { ...connection, lastTestedAt: new Date().toISOString() };
      mockMailConnections.set(user.id, tested);
      return tested;
    }),
  disconnectUserMail: () =>
    withState((state) => {
      const user = getCurrentUser(state);
      mockMailConnections.delete(user.id);
      return {
        emailAddress: user.email,
        connected: false,
        provider: "WECOM_EXMAIL" as const,
        status: null,
        verifiedAt: null,
        lastTestedAt: null,
        lastError: null,
        updatedAt: null,
      };
    }),
  tracking17TrackConnection: () =>
    withState((state) => {
      ensureSuperAdmin(state);
      return mockTracking17TrackConnection ?? emptyTracking17TrackConnection();
    }),
  tracking17TrackCarriers: (query: string) =>
    Promise.resolve(searchMockTrackingCarriers(query)),
  connectTracking17Track: (_apiKey: string) =>
    withState((state) => {
      const user = ensureSuperAdmin(state);
      const now = new Date().toISOString();
      mockTracking17TrackConnection = {
        provider: "TRACKING_17TRACK",
        connected: true,
        status: "CONNECTED",
        verifiedAt: now,
        lastTestedAt: now,
        lastError: null,
        quotaTotal: 100,
        quotaUsed: 0,
        quotaRemain: 100,
        updatedAt: now,
        updatedBy: { id: user.id, name: user.name, email: user.email },
      };
      return mockTracking17TrackConnection;
    }),
  testTracking17TrackConnection: () =>
    withState((state) => {
      const user = ensureSuperAdmin(state);
      if (!mockTracking17TrackConnection) {
        throw mockError("17TRACK 尚未连接");
      }
      const now = new Date().toISOString();
      mockTracking17TrackConnection = {
        ...mockTracking17TrackConnection,
        status: "CONNECTED",
        lastTestedAt: now,
        updatedAt: now,
        updatedBy: { id: user.id, name: user.name, email: user.email },
      };
      return mockTracking17TrackConnection;
    }),
  disconnectTracking17Track: () =>
    withState((state) => {
      ensureSuperAdmin(state);
      mockTracking17TrackConnection = null;
      return emptyTracking17TrackConnection();
    }),
  acceptDeclaration: () =>
    withState((state) => {
      const user = getCurrentUser(state);
      const acceptedAt = new Date().toISOString();
      user.declarationAccepted = true;
      user.declarationAcceptedAt = acceptedAt;
      return { accepted: true, acceptedAt };
    }),
  projectDeclarationStatus: (projectId: string) =>
    withState((state) => {
      const user = getCurrentUser(state);
      if (
        user.globalRole === "SUPER_ADMIN" ||
        user.globalRole === "CONFIRMATION_OFFICER"
      ) {
        return { accepted: true, acceptedAt: null };
      }
      const accepted =
        state.declarations[projectId]?.includes(user.id) ?? false;
      return {
        accepted,
        acceptedAt: accepted ? new Date().toISOString() : null,
      };
    }),
  acceptProjectDeclaration: (projectId: string) =>
    withState((state) => {
      const user = getCurrentUser(state);
      state.declarations[projectId] = [
        ...new Set([...(state.declarations[projectId] ?? []), user.id]),
      ];
      addLog(state, projectId, "DECLARATION_ACCEPTED", "签署项目独立性声明");
      return { accepted: true };
    }),
  workspaces: () =>
    withState((state) => {
      const user = getCurrentUser(state);
      return state.workspaces.filter(
        (workspace) => workspace.ownerId === user.id
      );
    }),
  createWorkspace: (input: CreateWorkspaceInput) =>
    withState((state) => {
      const user = getCurrentUser(state);
      const workspace: Workspace = {
        id: `workspace-${Date.now()}`,
        name: input.name,
        clientName: input.clientName,
        ownerId: user.id,
        description: input.description,
        projects: [],
      };
      state.workspaces.unshift(workspace);
      return workspace;
    }),
  updateWorkspace: (id: string, input: UpdateWorkspaceInput) =>
    withState((state) => {
      const user = getCurrentUser(state);
      const workspace = state.workspaces.find(
        (item) => item.id === id && item.ownerId === user.id
      );
      if (!workspace) {
        throw mockError("Workspace 不存在或无权访问");
      }
      workspace.name = input.name;
      workspace.clientName = input.clientName;
      workspace.description = input.description;
      return workspace;
    }),
  desktop: () =>
    withState((state) => {
      const user = getCurrentUser(state);
      return {
        folders: state.desktopFolders
          .filter((folder) => folder.ownerId === user.id)
          .sort(
            (left, right) =>
              left.sortOrder - right.sortOrder ||
              left.name.localeCompare(right.name)
          ),
        placements: ensureDesktopPlacements(state, user),
      };
    }),
  createDesktopFolder: (input: CreateDesktopFolderInput) =>
    withState((state) => {
      const user = getCurrentUser(state);
      const now = new Date().toISOString();
      const folder = {
        id: `desktop-folder-${Date.now()}`,
        ownerId: user.id,
        name: input.name,
        sortOrder: state.desktopFolders.filter(
          (item) => item.ownerId === user.id
        ).length,
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      };
      state.desktopFolders.push(folder);
      return folder;
    }),
  updateDesktopFolder: (id: string, input: UpdateDesktopFolderInput) =>
    withState((state) => {
      const user = getCurrentUser(state);
      const folder = state.desktopFolders.find(
        (item) => item.id === id && item.ownerId === user.id
      );
      if (!folder) {
        throw mockError("Folder not found");
      }
      folder.name = input.name ?? folder.name;
      folder.sortOrder = input.sortOrder ?? folder.sortOrder;
      folder.updatedAt = new Date().toISOString();
      return folder;
    }),
  deleteDesktopFolder: (id: string) =>
    withState((state) => {
      const user = getCurrentUser(state);
      const folder = state.desktopFolders.find(
        (item) => item.id === id && item.ownerId === user.id
      );
      if (!folder) {
        throw mockError("Folder not found");
      }
      if (folder.isDefault) {
        throw mockError("Default folder cannot be deleted");
      }
      if (
        state.desktopPlacements.some(
          (placement) =>
            placement.userId === user.id && placement.folderId === id
        )
      ) {
        throw mockError("Folder must be empty before deletion");
      }
      state.desktopFolders = state.desktopFolders.filter(
        (item) => item.id !== id
      );
      return { id };
    }),
  reorderDesktopProjectPlacements: (
    folderId: string,
    input: ReorderDesktopProjectPlacementsInput
  ) =>
    withState((state) =>
      reorderDesktopPlacements(state, getCurrentUser(state), folderId, input)
    ),
  updateDesktopProjectPlacement: (
    id: string,
    input: UpdateDesktopProjectPlacementInput
  ) =>
    withState((state) =>
      updateDesktopPlacement(state, getCurrentUser(state), id, input)
    ),
  frameworkTemplates: () =>
    withState((state) =>
      state.frameworkTemplates.filter((template) => template.isActive)
    ),
  cmpClients: (input: { status?: string; q?: string } = {}) =>
    Promise.resolve({
      clients: mockCmpClients.filter((client) => {
        if (input.status && client.status !== input.status) {
          return false;
        }
        if (!input.q?.trim()) {
          return true;
        }
        const query = input.q.trim().toLowerCase();
        return [client.clientCode, client.nameZh, client.nameEn]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query));
      }) as unknown as CmpClientsResponse["clients"],
    }),
  cmpEngagements: (input: CmpEngagementListQuery = {}) =>
    withState((_unused_state) => ({
      engagements: mockCmpEngagements.filter((engagement) => {
        if (input.clientId && engagement.clientId !== input.clientId) {
          return false;
        }
        if (input.status && engagement.status !== input.status) {
          return false;
        }
        if (!input.q?.trim()) {
          return true;
        }
        const query = input.q.trim().toLowerCase();
        return [
          engagement.engagementCode,
          engagement.client.clientCode,
          engagement.client.nameZh,
          engagement.client.nameEn,
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query));
      }) as unknown as CmpEngagementsResponse["engagements"],
    })),
  smartFormTemplates: (input: SmartFormTemplateListQueryInput = {}) =>
    withState((state) => filterSmartFormTemplates(state, input)),
  adminSmartFormTemplates: (input: SmartFormTemplateListQueryInput = {}) =>
    withState((state) => {
      requireTemplateLibraryAdmin(state);
      return filterSmartFormTemplates(state, input, true);
    }),
  createSmartFormTemplate: (input: CreateSmartFormTemplateInput) =>
    withState((state) => {
      requireTemplateLibraryAdmin(state);
      assertUniqueSmartFormTemplateCode(state, input.code);
      const frameworkTemplateId = input.frameworkTemplateId?.trim() || null;
      const frameworkTemplate = frameworkTemplateId
        ? state.frameworkTemplates.find(
            (template) => template.id === frameworkTemplateId
          )
        : null;
      if (frameworkTemplateId && !frameworkTemplate) {
        throw mockError("Applicable standard not found");
      }
      const now = new Date().toISOString();
      const template: SmartFormTemplate = {
        id: mockEntityId("smart-form-template"),
        code: input.code.trim(),
        name: input.name.trim(),
        frameworkTemplateId,
        frameworkTemplate,
        description: input.description?.trim() || null,
        status: "DRAFT",
        draftDefinitionJson: input.definition,
        currentPublishedVersionId: null,
        currentPublishedVersion: null,
        createdAt: now,
        updatedAt: now,
      };
      state.smartFormTemplates = [template, ...state.smartFormTemplates];
      return template;
    }),
  updateSmartFormTemplate: (
    templateId: string,
    input: UpdateSmartFormTemplateInput
  ) =>
    withState((state) => {
      requireTemplateLibraryAdmin(state);
      const template = findSmartFormTemplate(
        state.smartFormTemplates,
        templateId
      );
      if (input.code !== undefined) {
        assertUniqueSmartFormTemplateCode(state, input.code, template.id);
        template.code = input.code.trim();
      }
      if (input.name !== undefined) {
        template.name = input.name.trim();
      }
      if (input.frameworkTemplateId !== undefined) {
        const frameworkTemplateId = input.frameworkTemplateId?.trim() || null;
        const frameworkTemplate = frameworkTemplateId
          ? state.frameworkTemplates.find(
              (item) => item.id === frameworkTemplateId
            )
          : null;
        if (frameworkTemplateId && !frameworkTemplate) {
          throw mockError("Applicable standard not found");
        }
        template.frameworkTemplateId = frameworkTemplateId;
        template.frameworkTemplate = frameworkTemplate;
      }
      if (input.description !== undefined) {
        template.description = input.description?.trim() || null;
      }
      if (input.definition !== undefined) {
        template.draftDefinitionJson = input.definition;
      }
      template.updatedAt = new Date().toISOString();
      return template;
    }),
  publishSmartFormTemplate: (templateId: string) =>
    withState((state) => {
      requireTemplateLibraryAdmin(state);
      const template = findSmartFormTemplate(
        state.smartFormTemplates,
        templateId
      );
      const now = new Date().toISOString();
      const versionNumber =
        (template.currentPublishedVersion?.version ?? 0) + 1;
      const version: SmartFormTemplateVersion = {
        id: mockEntityId("smart-form-template-version"),
        templateId: template.id,
        version: versionNumber,
        definitionJson: template.draftDefinitionJson,
        definitionHash: `${template.id}:${versionNumber}`,
        publishedBy: getCurrentUser(state).id,
        publishedAt: now,
      };
      template.status = "PUBLISHED";
      template.currentPublishedVersionId = version.id;
      template.currentPublishedVersion = version;
      template.updatedAt = now;
      return template;
    }),
  deleteSmartFormTemplate: (templateId: string) =>
    withState((state) => {
      requireTemplateLibraryAdmin(state);
      const template = findSmartFormTemplate(
        state.smartFormTemplates,
        templateId
      );
      template.status = "ARCHIVED";
      template.updatedAt = new Date().toISOString();
      return template;
    }),
  projectTemplates: (input: ProjectTemplateListQueryInput = {}) =>
    withState((state) => filterProjectTemplates(state, input)),
  projectTemplate: (templateId: string) =>
    withState((state) => {
      const template = state.projectTemplates.find(
        (item) => item.id === templateId && item.status === "PUBLISHED"
      );
      if (!template) {
        throw mockError("Project template not found");
      }
      return template;
    }),
  adminProjectTemplates: (input: ProjectTemplateListQueryInput = {}) =>
    withState((state) => filterProjectTemplates(state, input, true)),
  adminProjectTemplate: (templateId: string) =>
    withState((state) => {
      requireTemplateLibraryAdmin(state);
      const template = state.projectTemplates.find(
        (item) => item.id === templateId && item.status !== "ARCHIVED"
      );
      if (!template) {
        throw mockError("Project template not found");
      }
      return template;
    }),
  createProjectTemplate: (input: CreateProjectTemplateInput) =>
    withState((state) => {
      requireTemplateLibraryAdmin(state);
      const templateId = mockEntityId("project-template");
      assertUniqueProjectTemplateCode(state, input.code);
      const frameworkTemplate = state.frameworkTemplates.find(
        (template) => template.id === input.frameworkTemplateId
      );
      const template: ProjectTemplate = {
        id: templateId,
        code: input.code.trim(),
        name: input.name.trim(),
        language: input.language ?? "zh-CN",
        frameworkTemplateId: input.frameworkTemplateId,
        frameworkTemplate,
        description: input.description?.trim() || null,
        status: input.status ?? "DRAFT",
        _count: { nodes: 0, files: 0 },
        nodes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state.projectTemplates = [template, ...state.projectTemplates];
      return template;
    }),
  importProjectTemplateZip: (
    input: ImportProjectTemplateZipInput,
    file: File
  ) =>
    withState((state) => {
      requireTemplateLibraryAdmin(state);
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith(".zip") && !fileName.endsWith(".7z")) {
        throw mockError("Please upload a zip or 7z file");
      }
      const templateId = mockEntityId("project-template");
      assertUniqueProjectTemplateCode(state, input.code);
      const frameworkTemplate = state.frameworkTemplates.find(
        (template) => template.id === input.frameworkTemplateId
      );
      const template: ProjectTemplate = {
        id: templateId,
        code: input.code.trim(),
        name: input.name.trim(),
        language: input.language ?? "zh-CN",
        frameworkTemplateId: input.frameworkTemplateId,
        frameworkTemplate,
        description: null,
        status: "DRAFT",
        _count: { nodes: 0, files: 0 },
        nodes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state.projectTemplates = [template, ...state.projectTemplates];
      return template;
    }),
  updateProjectTemplate: (
    templateId: string,
    input: UpdateProjectTemplateInput
  ) =>
    withState((state) => {
      requireTemplateLibraryAdmin(state);
      const template = findProjectTemplate(state.projectTemplates, templateId);
      if (input.code !== undefined) {
        assertUniqueProjectTemplateCode(state, input.code, template.id);
        template.code = input.code.trim();
      }
      if (input.name !== undefined) {
        template.name = input.name.trim();
      }
      if (input.language !== undefined) {
        template.language = input.language;
      }
      if (input.frameworkTemplateId !== undefined) {
        template.frameworkTemplateId = input.frameworkTemplateId;
        template.frameworkTemplate = state.frameworkTemplates.find(
          (item) => item.id === input.frameworkTemplateId
        );
      }
      if (input.description !== undefined) {
        template.description = input.description?.trim() || null;
      }
      if (input.status !== undefined) {
        template.status = input.status;
      }
      template.updatedAt = new Date().toISOString();
      refreshProjectTemplateCounts(template);
      return template;
    }),
  deleteProjectTemplate: (templateId: string) =>
    withState((state) => {
      requireTemplateLibraryAdmin(state);
      const template = findProjectTemplate(state.projectTemplates, templateId);
      template.status = "ARCHIVED";
      template.updatedAt = new Date().toISOString();
      return template;
    }),
  createProjectTemplateNode: (
    templateId: string,
    input: CreateProjectTemplateNodeInput
  ) =>
    withState((state) => {
      requireTemplateLibraryAdmin(state);
      const template = findProjectTemplate(state.projectTemplates, templateId);
      const parentId = input.parentId?.trim() || null;
      const parent = parentId
        ? template.nodes?.find((node) => node.id === parentId)
        : null;
      const level = parent ? parent.level + 1 : 1;
      const siblings = (template.nodes ?? []).filter(
        (node) => (node.parentId ?? null) === parentId
      );
      const node: ProjectTemplateNode = {
        id: mockEntityId("project-template-node"),
        projectTemplateId: template.id,
        parentId,
        level,
        code: input.code.trim(),
        title: input.title.trim(),
        auditAreaCode: input.auditAreaCode ?? null,
        nodeType:
          level === 1 ? "PHASE" : level === 2 ? "ACCOUNT" : "WORKING_PAPER",
        sortOrder: siblings.length + 1,
        files: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      template.nodes = [...(template.nodes ?? []), node];
      refreshProjectTemplateCounts(template);
      return node;
    }),
  updateProjectTemplateNode: (
    templateId: string,
    nodeId: string,
    input: UpdateProjectTemplateNodeInput
  ) =>
    withState((state) => {
      requireTemplateLibraryAdmin(state);
      const template = findProjectTemplate(state.projectTemplates, templateId);
      const node = findProjectTemplateNode(template, nodeId);
      if (input.code !== undefined) {
        node.code = input.code.trim();
      }
      if (input.title !== undefined) {
        node.title = input.title.trim();
      }
      if (input.auditAreaCode !== undefined) {
        node.auditAreaCode = input.auditAreaCode;
      }
      node.updatedAt = new Date().toISOString();
      return node;
    }),
  deleteProjectTemplateNode: (templateId: string, nodeId: string) =>
    withState((state) => {
      requireTemplateLibraryAdmin(state);
      const template = findProjectTemplate(state.projectTemplates, templateId);
      const removed = findProjectTemplateNode(template, nodeId);
      const removedIds = new Set<string>([nodeId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const node of template.nodes ?? []) {
          if (
            node.parentId &&
            removedIds.has(node.parentId) &&
            !removedIds.has(node.id)
          ) {
            removedIds.add(node.id);
            changed = true;
          }
        }
      }
      template.nodes = (template.nodes ?? []).filter(
        (node) => !removedIds.has(node.id)
      );
      refreshProjectTemplateCounts(template);
      return removed;
    }),
  createProjectTemplateSmartForm: (
    templateId: string,
    nodeId: string,
    input: CreateProjectTemplateSmartFormInput
  ) =>
    withState((state) => {
      requireTemplateLibraryAdmin(state);
      const template = findProjectTemplate(state.projectTemplates, templateId);
      const node = findProjectTemplateNode(template, nodeId);
      const smartFormTemplate = state.smartFormTemplates.find(
        (item) =>
          item.currentPublishedVersionId === input.smartFormTemplateVersionId &&
          item.status === "PUBLISHED"
      );
      const version = smartFormTemplate?.currentPublishedVersion;
      if (!smartFormTemplate || !version) {
        throw mockError("Published Smart Form template not found");
      }
      const smartForms = node.smartForms ?? [];
      const sortOrder =
        Math.max(
          0,
          ...(node.files ?? []).map((file) => file.sortOrder),
          ...smartForms.map((item) => item.sortOrder)
        ) + 1;
      const title = input.title?.trim() || smartFormTemplate.name;
      const smartForm: ProjectTemplateSmartForm = {
        id: mockEntityId("project-template-smart-form"),
        projectTemplateId: template.id,
        templateNodeId: node.id,
        smartFormTemplateId: smartFormTemplate.id,
        smartFormTemplateVersionId: version.id,
        code:
          input.code?.trim() ||
          buildProjectTemplateDefaultItemCode(node.code, sortOrder),
        title,
        fileName: normalizeSmartFormFileName(title),
        sortOrder,
        smartFormTemplate,
        smartFormTemplateVersion: version,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (
        smartForms.some(
          (item) =>
            item.code.trim().toLowerCase() === smartForm.code.toLowerCase()
        )
      ) {
        throw mockError(
          "Template folder already has this code",
          "DUPLICATE_CODE"
        );
      }
      node.smartForms = [...smartForms, smartForm];
      refreshProjectTemplateCounts(template);
      return smartForm;
    }),
  updateProjectTemplateSmartFormCode: (
    templateId: string,
    referenceId: string,
    input: UpdateProjectTemplateItemCodeInput
  ) =>
    withState((state) => {
      requireTemplateLibraryAdmin(state);
      const template = findProjectTemplate(state.projectTemplates, templateId);
      const node = (template.nodes ?? []).find((candidate) =>
        (candidate.smartForms ?? []).some((item) => item.id === referenceId)
      );
      const reference = node?.smartForms?.find(
        (item) => item.id === referenceId
      );
      if (!node || !reference) {
        throw mockError("Project template Smart Form not found");
      }
      const code = buildNumericProjectTemplateItemCode(
        node.code,
        input.sequence
      );
      assertMockTemplateItemCodeAvailable(node, code, referenceId);
      reference.code = code;
      reference.updatedAt = new Date().toISOString();
      return reference;
    }),
  reorderProjectTemplateItems: (
    templateId: string,
    nodeId: string,
    input: ReorderProjectTemplateItemsInput
  ) =>
    withState((state) => {
      requireTemplateLibraryAdmin(state);
      const template = findProjectTemplate(state.projectTemplates, templateId);
      const node = findProjectTemplateNode(template, nodeId);
      const prefix = requireNumericProjectTemplateFolderCode(node.code);
      const filesById = new Map(
        (node.files ?? []).map((item) => [item.id, item])
      );
      const smartFormsById = new Map(
        (node.smartForms ?? []).map((item) => [item.id, item])
      );
      const expected = new Set([
        ...[...filesById].map(([id]) => `FILE:${id}`),
        ...[...smartFormsById].map(([id]) => `SMART_FORM:${id}`),
      ]);
      const received = new Set(
        input.items.map((item) => `${item.type}:${item.id}`)
      );
      if (
        expected.size !== received.size ||
        [...expected].some((key) => !received.has(key))
      ) {
        throw mockError(
          "Project template item order must include every folder item exactly once",
          "VALIDATION_FAILED"
        );
      }
      const now = new Date().toISOString();
      const items = input.items.map((item, index) => {
        const target =
          item.type === "FILE"
            ? filesById.get(item.id)
            : smartFormsById.get(item.id);
        if (!target) {
          throw mockError(
            "Project template item not found",
            "VALIDATION_FAILED"
          );
        }
        target.sortOrder = index + 1;
        target.code = `${prefix}.${index + 1}`;
        target.updatedAt = now;
        return { type: item.type, ...target };
      });
      return { items };
    }),
  createProjectTemplatePlaceholder: (
    templateId: string,
    nodeId: string,
    input: CreateProjectTemplatePlaceholderInput
  ) =>
    withState((state) => {
      requireTemplateLibraryAdmin(state);
      const template = findProjectTemplate(state.projectTemplates, templateId);
      const node = findProjectTemplateNode(template, nodeId);
      const files = node.files ?? [];
      const sortOrder =
        Math.max(
          0,
          ...files.map((file) => file.sortOrder),
          ...(node.smartForms ?? []).map((item) => item.sortOrder)
        ) + 1;
      const placeholder = ATTACHMENT_PLACEHOLDER_TYPES[input.placeholderType];
      const title = ensureMockFileExtension(input.title, placeholder.extension);
      const templateFile: ProjectTemplateFile = {
        id: mockEntityId("project-template-placeholder"),
        projectTemplateId: template.id,
        templateNodeId: node.id,
        code: input.code.trim(),
        title,
        fileName: title,
        originalName: title,
        fileUrl: "",
        fileSize: 0,
        mimeType: placeholder.mimeType,
        placeholderType: input.placeholderType,
        paperType: "WORKING_PAPER",
        sortOrder,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (
        [...files, ...(node.smartForms ?? [])].some(
          (item) =>
            item.code.trim().toLowerCase() ===
            templateFile.code.trim().toLowerCase()
        )
      ) {
        throw mockError(
          "Template folder already has this code",
          "DUPLICATE_CODE"
        );
      }
      node.files = [...files, templateFile];
      refreshProjectTemplateCounts(template);
      return templateFile;
    }),
  deleteProjectTemplateSmartForm: (templateId: string, referenceId: string) =>
    withState((state) => {
      requireTemplateLibraryAdmin(state);
      const template = findProjectTemplate(state.projectTemplates, templateId);
      for (const node of template.nodes ?? []) {
        const nextSmartForms = (node.smartForms ?? []).filter(
          (item) => item.id !== referenceId
        );
        if (nextSmartForms.length !== (node.smartForms ?? []).length) {
          const removed = (node.smartForms ?? []).find(
            (item) => item.id === referenceId
          );
          node.smartForms = nextSmartForms;
          refreshProjectTemplateCounts(template);
          return removed;
        }
      }
      throw mockError("Project template Smart Form not found");
    }),
  uploadProjectTemplateFile: (
    templateId: string,
    nodeId: string,
    input: ProjectTemplateFileInput,
    file: File
  ) =>
    serializeMockAttachmentContent(file).then((content) =>
      withState((state) => {
        requireTemplateLibraryAdmin(state);
        const template = findProjectTemplate(
          state.projectTemplates,
          templateId
        );
        const node = findProjectTemplateNode(template, nodeId);
        const files = node.files ?? [];
        const sortOrder =
          Math.max(
            0,
            ...files.map((item) => item.sortOrder),
            ...(node.smartForms ?? []).map((item) => item.sortOrder)
          ) + 1;
        const title = input.title?.trim() || file.name;
        const templateFile: ProjectTemplateFile = {
          id: mockEntityId("project-template-file"),
          projectTemplateId: template.id,
          templateNodeId: node.id,
          code:
            input.code?.trim() ||
            buildProjectTemplateDefaultItemCode(node.code, sortOrder),
          title,
          fileName: file.name,
          originalName: file.name,
          fileUrl: `mock://project-templates/${template.id}/${node.id}/${file.name}`,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
          paperType: "WORKING_PAPER",
          sortOrder,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        node.files = [...files, templateFile];
        state.projectTemplateFileContents ??= {};
        state.projectTemplateFileContents[templateFile.id] = content;
        refreshProjectTemplateCounts(template);
        return templateFile;
      })
    ),
  updateProjectTemplateFileCode: (
    templateId: string,
    fileId: string,
    input: UpdateProjectTemplateItemCodeInput
  ) =>
    withState((state) => {
      requireTemplateLibraryAdmin(state);
      const template = findProjectTemplate(state.projectTemplates, templateId);
      const node = (template.nodes ?? []).find((candidate) =>
        (candidate.files ?? []).some((item) => item.id === fileId)
      );
      const file = node?.files?.find((item) => item.id === fileId);
      if (!node || !file) {
        throw mockError("Project template file not found");
      }
      const code = buildNumericProjectTemplateItemCode(
        node.code,
        input.sequence
      );
      assertMockTemplateItemCodeAvailable(node, code, fileId);
      file.code = code;
      file.updatedAt = new Date().toISOString();
      return file;
    }),
  previewProjectTemplateFile: (templateId: string, fileId: string) =>
    withState((state) => {
      requireTemplateLibraryAdmin(state);
      const template = findProjectTemplate(state.projectTemplates, templateId);
      const file = (template.nodes ?? [])
        .flatMap((node) => node.files ?? [])
        .find((candidate) => candidate.id === fileId);
      const content = state.projectTemplateFileContents?.[fileId];
      if (!file || file.placeholderType || !content) {
        throw mockError("Project template file is not available for preview");
      }
      return mockAttachmentContentBlob(content);
    }),
  deleteProjectTemplateFile: (templateId: string, fileId: string) =>
    withState((state) => {
      requireTemplateLibraryAdmin(state);
      const template = findProjectTemplate(state.projectTemplates, templateId);
      for (const node of template.nodes ?? []) {
        const nextFiles = (node.files ?? []).filter(
          (file) => file.id !== fileId
        );
        if (nextFiles.length !== (node.files ?? []).length) {
          const removed = (node.files ?? []).find((file) => file.id === fileId);
          node.files = nextFiles;
          refreshProjectTemplateCounts(template);
          return removed;
        }
      }
      throw mockError("Project template file not found");
    }),
  previewProjectTemplate: (
    projectId: string,
    templateId: string,
    input: ApplyProjectTemplateInput
  ) =>
    withState((state) => {
      const { template, targetNode, files, smartForms } =
        requireProjectTemplateApplyContext(state, projectId, templateId, input);
      return {
        template,
        targetNode: toTemplateTargetNode(targetNode),
        plan: buildProjectTemplateApplyPlan(
          targetNode,
          files,
          smartForms,
          input
        ),
      };
    }),
  applyProjectTemplate: (
    projectId: string,
    templateId: string,
    input: ApplyProjectTemplateInput
  ) =>
    withState((state) => {
      const { project, template, targetNode, files, smartForms } =
        requireProjectTemplateApplyContext(state, projectId, templateId, input);
      const plan = buildProjectTemplateApplyPlan(
        targetNode,
        files,
        smartForms,
        input
      );
      const filesById = new Map(files.map((file) => [file.id, file]));
      const smartFormsById = new Map(
        smartForms.map((smartForm) => [smartForm.id, smartForm])
      );
      const user = getCurrentUser(state);
      const createdWorkingPapers: WorkingPaper[] = [];
      for (const item of plan.items) {
        if (item.status !== "CREATE" || !item.plannedCode) {
          continue;
        }
        const file = filesById.get(item.templateFileId);
        if (!file) {
          continue;
        }
        const paper = workingPaperFromProjectTemplateFile(
          state,
          projectId,
          targetNode.id,
          item.plannedCode,
          item.bucket,
          file,
          user
        );
        targetNode.workingPapers = [...(targetNode.workingPapers ?? []), paper];
        createdWorkingPapers.push(paper);
      }
      const createdSmartForms: WorkingPaper[] = [];
      for (const item of plan.smartFormItems ?? []) {
        if (item.status !== "CREATE" || !item.plannedCode) {
          continue;
        }
        const smartForm = smartFormsById.get(item.smartFormReferenceId);
        if (!smartForm) {
          continue;
        }
        const paper = workingPaperFromProjectTemplateSmartForm(
          state,
          projectId,
          targetNode.id,
          item.plannedCode,
          smartForm,
          user,
          project.language === "en-US" ? "en-US" : "zh-CN"
        );
        targetNode.workingPapers = [...(targetNode.workingPapers ?? []), paper];
        createdSmartForms.push(paper);
      }
      if (createdWorkingPapers.length > 0 || createdSmartForms.length > 0) {
        addLog(
          state,
          projectId,
          "PROJECT_TEMPLATE_APPLIED",
          `Applied project template ${template.code} to ${targetNode.code}`,
          { targetType: "PROJECT_TEMPLATE", targetId: template.id }
        );
      }
      return {
        template,
        targetNode: toTemplateTargetNode(targetNode),
        plan,
        createdWorkingPapers,
        createdSmartForms,
        existingWorkingPapers: [
          ...plan.items.map((item) => item.existingWorkingPaper),
          ...(plan.smartFormItems ?? []).map(
            (item) => item.existingWorkingPaper
          ),
        ].filter(
          (
            paper
          ): paper is NonNullable<
            ProjectTemplateApplyPlan["items"][number]["existingWorkingPaper"]
          > => Boolean(paper)
        ),
        skippedTemplateFileIds: plan.items
          .filter((item) => item.status === "EXISTS")
          .map((item) => item.templateFileId),
        skippedSmartFormReferenceIds: (plan.smartFormItems ?? [])
          .filter((item) => item.status === "EXISTS")
          .map((item) => item.smartFormReferenceId),
      };
    }),
  projects: () =>
    withState((state) => {
      const user = getCurrentUser(state);
      return state.workspaces
        .filter((workspace) => workspace.ownerId === user.id)
        .flatMap((workspace) =>
          workspace.projects.filter(
            (project) =>
              project.status !== "DELETED" &&
              project.members?.some((member) => member.user.id === user.id)
          )
        );
    }),
  deletedProjects: () =>
    withState((state) => {
      const user = getCurrentUser(state);
      return state.workspaces
        .flatMap((workspace) => workspace.projects)
        .filter(
          (project) =>
            project.status === "DELETED" &&
            (user.globalRole === "SUPER_ADMIN" ||
              project.members?.some((member) => member.user.id === user.id))
        );
    }),
  createProject,
  updateProject,
  project: (id: string) =>
    withState((state) => {
      const project = findProject(state, id);
      if (!project) {
        throw mockError("项目不存在");
      }
      const cmpClient = project.cmpClientId
        ? mockCmpClients.find((client) => client.id === project.cmpClientId)
        : undefined;
      const cmpEngagement = project.cmpEngagementId
        ? mockCmpEngagements.find(
            (engagement) => engagement.id === project.cmpEngagementId
          )
        : undefined;
      return {
        ...project,
        ...(cmpClient ? { cmpClient } : {}),
        ...(cmpEngagement ? { cmpEngagement } : {}),
      };
    }),
  projectConfirmations: (id: string) =>
    withState((state) => {
      const project = findProject(state, id);
      if (!project) {
        throw mockError("项目不存在");
      }
      return [...((state.confirmations ??= {})[id] ?? [])]
        .map((confirmation) => ({
          ...confirmation,
          project: pickProjectConfirmationProject(project),
        }))
        .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
    }),
  confirmations: () =>
    withState((state) => {
      const user = getCurrentUser(state);
      const canSeeAll =
        user.globalRole === "SUPER_ADMIN" ||
        user.globalRole === "CONFIRMATION_OFFICER";
      return Object.entries(state.confirmations ?? {})
        .flatMap(([projectId, confirmations]) => {
          const project = findProject(state, projectId);
          if (!project) {
            return [];
          }
          if (
            !canSeeAll &&
            !project.members?.some((member) => member.user.id === user.id)
          ) {
            return [];
          }
          return confirmations.map((confirmation) => ({
            ...confirmation,
            project: pickProjectConfirmationProject(project),
          }));
        })
        .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
    }),
  confirmationEmpProjects: (): Promise<ConfirmationEmpProject[]> =>
    withState((state) =>
      state.workspaces
        .flatMap((workspace) => workspace.projects)
        .filter((project) => project.status === "ACTIVE")
        .map((project) => ({
          id: project.id,
          projectCode: project.projectCode,
          name: project.name,
          reportDate: project.reportDate ?? null,
          status: project.status,
          importEligible: true,
          eligibilityReason: null,
        }))
    ),
  confirmationEmpPreview: (
    projectId: string,
    input: ConfirmationEmpImportPreviewInput
  ): Promise<ConfirmationEmpImportPreview> =>
    withState((state) => {
      const project = findProject(state, projectId);
      if (!project) {
        throw mockError("项目不存在");
      }
      const directories = (state.workflows[projectId] ?? []).flatMap(
        function flatten(
          node
        ): ConfirmationEmpImportPreview["targetDirectories"] {
          return [
            {
              id: node.id,
              code: node.code,
              title: node.title,
              path: node.title,
              level: node.level,
              canAcceptWorkflow: true,
            },
            ...(node.children ?? []).flatMap(flatten),
          ];
        }
      );
      const targetDirectory =
        directories.find(
          (directory) => directory.id === input.targetDirectoryId
        ) ??
        directories[0] ??
        null;
      return {
        projectId,
        mode: input.mode,
        targetDirectoryId: targetDirectory?.id ?? null,
        targetDirectories: directories,
        batchDirectory:
          input.mode === "GROUPED"
            ? {
                code: `${targetDirectory?.code ?? "EMP"}-B001`,
                name: "Confirmation responses",
              }
            : null,
        zipWorkingPaper:
          input.mode === "ZIP"
            ? {
                code: `${targetDirectory?.code ?? "EMP"}-F001`,
                name: "Confirmation responses.zip",
              }
            : null,
        counts: { eligible: 0, imported: 0, blocked: 0 },
        items: [],
        zipEntries: [],
        blockers: targetDirectory ? [] : ["No workflow directory is available"],
        fingerprint: `${projectId}:${input.mode}:${targetDirectory?.id ?? "none"}`,
      };
    }),
  createConfirmationEmpImport: (
    projectId: string,
    input: ConfirmationEmpImportRequest
  ): Promise<ConfirmationEmpImportJob> => {
    const now = new Date().toISOString();
    const job: ConfirmationEmpImportJob = {
      id: mockEntityId("confirmation-emp-import"),
      projectId,
      mode: input.mode,
      status: "QUEUED",
      total: input.items.length,
      completed: 0,
      failed: 0,
      retryable: false,
      previewFingerprint: input.previewFingerprint,
      createdAt: now,
      updatedAt: now,
      withdrawnAt: null,
      items: input.items.map((item) => ({
        id: item.id,
        sourceConfirmationId: item.sourceConfirmationId ?? item.id,
        confirmationId: item.sourceConfirmationId ?? item.id,
        sourceFileName: item.businessName ?? item.name,
        status: "QUEUED",
        targetLocation: null,
        targetCode: item.empCode ?? item.code ?? null,
        errorMessage: null,
        retryable: false,
      })),
    };
    mockConfirmationEmpImportJobs.set(job.id, job);
    return Promise.resolve(job);
  },
  confirmationEmpImportJob: (projectId: string, jobId: string) => {
    const job = mockConfirmationEmpImportJobs.get(jobId);
    if (!job || job.projectId !== projectId) {
      throw mockError("导入任务不存在");
    }
    return Promise.resolve(job);
  },
  confirmationEmpImportHistory: (projectId: string) =>
    Promise.resolve(
      [...mockConfirmationEmpImportJobs.values()].filter(
        (job) => job.projectId === projectId
      )
    ),
  retryConfirmationEmpImport: (projectId: string, jobId: string) => {
    const job = mockConfirmationEmpImportJobs.get(jobId);
    if (!job || job.projectId !== projectId) {
      throw mockError("导入任务不存在");
    }
    job.status = "QUEUED";
    job.updatedAt = new Date().toISOString();
    return Promise.resolve(job);
  },
  withdrawConfirmationEmpImport: (
    projectId: string,
    jobId: string,
    _input: ConfirmationEmpImportWithdrawInput
  ) => {
    const job = mockConfirmationEmpImportJobs.get(jobId);
    if (!job || job.projectId !== projectId) {
      throw mockError("导入任务不存在");
    }
    job.status = "WITHDRAWN";
    job.withdrawnAt = new Date().toISOString();
    job.updatedAt = job.withdrawnAt;
    return Promise.resolve(job);
  },
  restoreConfirmationEmpImport: (
    projectId: string,
    jobId: string,
    _input: ConfirmationEmpImportRestoreInput
  ) => {
    const job = mockConfirmationEmpImportJobs.get(jobId);
    if (!job || job.projectId !== projectId) {
      throw mockError("导入任务不存在");
    }
    job.status = "COMPLETED";
    job.withdrawnAt = null;
    job.updatedAt = new Date().toISOString();
    return Promise.resolve(job);
  },
  confirmationTemplateLibrary: async () => {
    await Promise.resolve();
    return [...mockConfirmationTemplateLibraryFiles];
  },
  updateConfirmationTemplateLibraryDesign: (
    templateId: string,
    input: UpdateConfirmationTemplateLibraryDesignInput
  ): Promise<ConfirmationTemplateLibraryFile> =>
    withState((state) => {
      ensureConfirmationTemplateManager(state);
      const template = mockConfirmationTemplateLibraryFiles.find(
        (item) => item.id === templateId
      );
      if (!template) {
        throw mockError("Confirmation template was not found");
      }
      const now = new Date().toISOString();
      template.designSchema = structuredClone(input.designSchema);
      template.designStatus = input.designStatus;
      template.enabledAt = input.designStatus === "ENABLED" ? now : null;
      template.updatedAt = now;
      return { ...template };
    }),
  uploadConfirmationTemplateLibraryFile: (input: {
    name: string;
    confirmationType: ConfirmationType;
    description?: string;
    file: File;
  }) =>
    withState((state) => {
      const user = ensureConfirmationTemplateManager(state);
      const isPdf =
        input.file.type === "application/pdf" ||
        input.file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf || input.file.size === 0) {
        throw mockError("Upload a non-empty PDF confirmation template");
      }
      const now = new Date().toISOString();
      const id = mockEntityId("confirmation-template");
      const template: ConfirmationTemplateLibraryFile = {
        id,
        code: `CTPL-${id.slice(-12).toUpperCase()}`,
        name: input.name.trim(),
        confirmationType: input.confirmationType,
        description: input.description?.trim() || null,
        fileName: input.file.name,
        fileSize: input.file.size,
        mimeType: "application/pdf",
        isBuiltIn: false,
        uploadedById: user.id,
        uploader: { id: user.id, name: user.name },
        createdAt: now,
        updatedAt: now,
        designSchema: { version: 1, fields: [] },
        designStatus: "DRAFT",
        enabledAt: null,
      };
      mockConfirmationTemplateLibraryFiles.push(template);
      mockConfirmationTemplateLibraryBodies.set(
        id,
        new Blob([input.file], { type: "application/pdf" })
      );
      return { ...template };
    }),
  deleteConfirmationTemplateLibraryFile: (templateId: string) =>
    withState((state) => {
      ensureConfirmationTemplateManager(state);
      const index = mockConfirmationTemplateLibraryFiles.findIndex(
        (item) => item.id === templateId && !item.isBuiltIn
      );
      if (index === -1) {
        throw mockError("Confirmation template was not found");
      }
      mockConfirmationTemplateLibraryFiles.splice(index, 1);
      mockConfirmationTemplateLibraryBodies.delete(templateId);
      return { id: templateId };
    }),
  confirmationTemplateLibraryDownloadUrl: (_templateId: string) => "#",
  previewConfirmationTemplateLibraryFile: (templateId: string) => {
    const body = mockConfirmationTemplateLibraryBodies.get(templateId);
    if (!body) {
      throw mockError("Confirmation template was not found");
    }
    return Promise.resolve(body);
  },
  updateConfirmationTemplateLibraryStatus: (
    templateId: string,
    input: { designStatus: "DRAFT" | "ENABLED" | "DISABLED" }
  ) =>
    withState((state) => {
      ensureConfirmationTemplateManager(state);
      const template = mockConfirmationTemplateLibraryFiles.find(
        (item) => item.id === templateId
      );
      if (!template) {
        throw mockError("Confirmation template was not found");
      }
      const now = new Date().toISOString();
      template.designStatus = input.designStatus;
      template.enabledAt = input.designStatus === "ENABLED" ? now : null;
      template.updatedAt = now;
      return { ...template };
    }),
  bulkUpdateConfirmationTemplateLibraryStatus: (input: {
    templateIds: string[];
    designStatus: "DRAFT" | "ENABLED" | "DISABLED";
  }) =>
    Promise.all(
      input.templateIds.map((templateId) =>
        mockApi.updateConfirmationTemplateLibraryStatus(templateId, {
          designStatus: input.designStatus,
        })
      )
    ),
  confirmationResponseLibrary: async () => {
    await Promise.resolve();
    return [] as ConfirmationResponseLibraryFile[];
  },
  projectConfirmationResponseWarehouse: async (_projectId: string) => {
    await Promise.resolve();
    return [] as ConfirmationResponseLibraryFile[];
  },
  projectPendingConfirmationResponses: async (_projectId: string) => {
    await Promise.resolve();
    return [] as ConfirmationResponseLibraryFile[];
  },
  routeConfirmationResponseLibraryFile: async (
    _responseId: string,
    _input: RouteConfirmationResponseLibraryFileInput
  ) => {
    await Promise.resolve();
    throw mockError("Confirmation response routing requires the live API");
  },
  uploadConfirmationResponseLibraryFile: async (_input: {
    title: string;
    receivedAt: string;
    courierTrackingNumber?: string;
    referenceNumber?: string;
    clientName: string;
    respondingEntity: string;
    notes?: string;
    file: File;
  }) => {
    await Promise.resolve();
    throw new Error("Confirmation response uploads require the API.");
  },
  confirmationResponseLibraryDownloadUrl: (_responseId: string) => "#",
  previewConfirmationResponseLibraryFile: async (_responseId: string) => {
    await Promise.resolve();
    return createMockPngPreviewBlob();
  },
  confirmationDispatchQueue: async (
    _query: ConfirmationDispatchQueueQuery = {}
  ) => {
    await Promise.resolve();
    return [] as ConfirmationDispatchQueueItem[];
  },
  claimConfirmationDispatchQueue: async (
    _confirmationId: string,
    _input: ClaimConfirmationDispatchQueueInput
  ) => {
    await Promise.resolve();
    throw mockError("Dispatch queue requires the live API");
  },
  releaseConfirmationDispatchQueue: async (
    _confirmationId: string,
    _input: ReleaseConfirmationDispatchQueueInput
  ) => {
    await Promise.resolve();
    throw mockError("Dispatch queue requires the live API");
  },
  returnConfirmationDispatchQueue: async (
    _confirmationId: string,
    _input: ReturnConfirmationDispatchQueueInput
  ) => {
    await Promise.resolve();
    throw mockError("Dispatch queue requires the live API");
  },
  createConfirmationDispatchBatch: async (
    _input: CreateConfirmationDispatchBatchInput
  ) => {
    await Promise.resolve();
    throw mockError("Dispatch queue requires the live API");
  },
  executeConfirmationDispatchBatch: async (
    _batchId: string,
    _input: ExecuteConfirmationDispatchBatchInput
  ) => {
    await Promise.resolve();
    throw mockError("Dispatch queue requires the live API");
  },
  completeMockCourierDelivery: async (
    _dispatchId: string,
    _input: { idempotencyKey: string }
  ) => {
    await Promise.resolve();
    throw mockError("Dispatch queue requires the live API");
  },
  confirmationDispatchBatch: async (_batchId: string) => {
    await Promise.resolve();
    throw mockError(
      "Dispatch queue requires the live API"
    ) as never as ConfirmationDispatchBatch;
  },
  createProjectConfirmation: (
    id: string,
    input: CreateProjectConfirmationInput
  ) =>
    withState((state) => {
      const project = findProject(state, id);
      if (!project) {
        throw mockError("项目不存在");
      }
      const user = getCurrentUser(state);
      const now = new Date().toISOString();
      const counterpartyName = input.draftPayload?.bankName?.trim() ?? "";
      const confirmation: ProjectConfirmation = {
        id: `confirmation-${Date.now()}`,
        projectId: id,
        type: input.type ?? "BANK",
        status: "DRAFT",
        clientName: null,
        confirmationCode: null,
        auditPeriod: null,
        counterpartyName,
        respondingEntityName: null,
        thirdPartyName: null,
        subjectName: null,
        attachmentName: null,
        counterpartyContact: null,
        counterpartyAddress: null,
        draftTemplateCode: input.draftTemplateCode ?? null,
        draftPayload: input.draftPayload ?? null,
        draftUpdatedAt: input.draftPayload ? now : null,
        responsibleUserId: user.id,
        plannedSendDate: null,
        reportDeadline: null,
        preparedDispatchMethod: null,
        preparedSenderName: null,
        preparedApplicantName: null,
        preparedCourierName: null,
        preparedTrackingNumber: null,
        preparedDispatchReference: null,
        preparedRecipientName: null,
        preparedRecipientContact: null,
        preparedRecipientPhone: null,
        preparedFollowUpDate: null,
        preparedAttachmentName: null,
        preparedDispatchNotes: null,
        preparedDispatchReadyBy: null,
        preparedDispatchReadyAt: null,
        teamConfirmStatus: "PENDING",
        teamConfirmedByName: null,
        teamConfirmedAt: null,
        differenceStatus: null,
        notes: input.draftPayload?.draftNotes?.trim() || null,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
        responsibleUser: user,
        creator: user,
        dispatches: [],
        followUpEvents: [],
        responses: [],
      };
      const confirmations = state.confirmations ?? {};
      state.confirmations = confirmations;
      confirmations[id] = [confirmation, ...(confirmations[id] ?? [])];
      addLog(
        state,
        id,
        "PROJECT_CONFIRMATION_CREATED",
        `Created confirmation record for ${confirmation.counterpartyName}`
      );
      return confirmation;
    }),
  uploadProjectConfirmation: async (
    _projectId: string,
    _input: { type: ConfirmationType; counterpartyName: string; file: File }
  ) => {
    await Promise.resolve();
    throw mockError("Confirmation upload requires the live API");
  },
  uploadProjectConfirmationFile: async (
    _projectId: string,
    _confirmationId: string,
    _input: { counterpartyName: string; file: File }
  ) => {
    await Promise.resolve();
    throw mockError("Confirmation upload requires the live API");
  },
  receiveProjectConfirmationResponse: (
    projectId: string,
    confirmationId: string,
    input: CreateProjectConfirmationResponseInput & { files: File[] }
  ) =>
    withState((state) => {
      const confirmation = (state.confirmations ??= {})[projectId]?.find(
        (item) => item.id === confirmationId
      );
      if (!confirmation) {
        throw mockError("Confirmation not found");
      }
      if (confirmation.status !== "AWAITING_RESPONSE") {
        throw mockError(
          "Only a dispatched confirmation can receive a response",
          "CONFIRMATION_STATE_CONFLICT"
        );
      }
      const user = getCurrentUser(state);
      const now = new Date().toISOString();
      const responseId = `confirmation-response-${Date.now()}`;
      const artifacts = input.files.map((file, index) => ({
        id: `${responseId}-artifact-${index + 1}`,
        responseId,
        sequence: index + 1,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
        sha256: `mock-${responseId}-${index + 1}`,
        uploadedBy: user.id,
        capturedAt: input.receivedAt,
        createdAt: now,
      }));
      confirmation.responses = [
        {
          id: responseId,
          confirmationId,
          responseStatus: "RECEIVED",
          responseChannel: input.responseChannel,
          matchMethod: "MANUAL",
          routingStatus: "ROUTED",
          responsibleUserId: confirmation.responsibleUserId,
          receivingUserId: user.id,
          pageCount: artifacts.length,
          receivedAt: input.receivedAt,
          receivedBy: user.id,
          responseReference: input.responseReference || null,
          attachmentName: artifacts[0]?.fileName ?? null,
          notes: input.notes || null,
          createdAt: now,
          updatedAt: now,
          artifacts,
        },
        ...(confirmation.responses ?? []),
      ];
      confirmation.followUpEvents = [
        ...(confirmation.followUpEvents ?? []),
        {
          id: `${responseId}-received-event`,
          confirmationId,
          eventType: "RESPONSE_RECEIVED",
          actorId: user.id,
          source: "RESPONSE_INTAKE",
          payload: { responseId },
          occurredAt: input.receivedAt,
          createdAt: now,
        },
      ];
      confirmation.status = "RESPONSE_RECEIVED";
      confirmation.updatedAt = now;
      return confirmation;
    }),
  addProjectConfirmationResponseArtifacts: (
    projectId: string,
    confirmationId: string,
    responseId: string,
    files: File[]
  ) =>
    withState((state) => {
      const confirmation = (state.confirmations ??= {})[projectId]?.find(
        (item) => item.id === confirmationId
      );
      if (!confirmation) {
        throw mockError("Confirmation not found");
      }
      const response = confirmation.responses?.find(
        (item) => item.id === responseId
      );
      if (!response) {
        throw mockError("Confirmation response not found");
      }
      if (
        confirmation.status !== "RESPONSE_RECEIVED" &&
        confirmation.status !== "CLOSED"
      ) {
        throw mockError(
          "Files can only be added to a recorded response",
          "CONFIRMATION_STATE_CONFLICT"
        );
      }
      const user = getCurrentUser(state);
      const now = new Date().toISOString();
      const startSequence = (response.artifacts?.length ?? 0) + 1;
      response.artifacts = [
        ...(response.artifacts ?? []),
        ...files.map((file, index) => ({
          id: `${responseId}-artifact-${startSequence + index}`,
          responseId,
          sequence: startSequence + index,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
          sha256: `mock-${responseId}-${startSequence + index}`,
          uploadedBy: user.id,
          capturedAt: now,
          createdAt: now,
        })),
      ];
      response.pageCount = response.artifacts.length;
      response.updatedAt = now;
      confirmation.updatedAt = now;
      return confirmation;
    }),
  projectConfirmationResponseArtifact: async () => {
    await Promise.resolve();
    return createMockPngPreviewBlob();
  },
  withdrawProjectConfirmationResponse: (
    projectId: string,
    confirmationId: string,
    responseId: string
  ) =>
    withState((state) => {
      const confirmation = (state.confirmations ??= {})[projectId]?.find(
        (item) => item.id === confirmationId
      );
      if (!confirmation) {
        throw mockError("Confirmation not found");
      }
      if (confirmation.status !== "RESPONSE_RECEIVED") {
        throw mockError(
          "Only a recorded response can be withdrawn",
          "CONFIRMATION_STATE_CONFLICT"
        );
      }
      const user = getCurrentUser(state);
      const now = new Date().toISOString();
      confirmation.responses = (confirmation.responses ?? []).filter(
        (item) => item.id !== responseId
      );
      confirmation.followUpEvents = [
        ...(confirmation.followUpEvents ?? []),
        {
          id: `${responseId}-withdrawn-${Date.now()}`,
          confirmationId,
          eventType: "RESPONSE_WITHDRAWN",
          actorId: user.id,
          source: "RESPONSE_INTAKE",
          payload: { responseId },
          occurredAt: now,
          createdAt: now,
        },
      ];
      confirmation.status = "AWAITING_RESPONSE";
      confirmation.updatedAt = now;
      return confirmation;
    }),
  reviewProjectConfirmationResponse: (
    projectId: string,
    confirmationId: string
  ) =>
    withState((state) => {
      const confirmation = (state.confirmations ??= {})[projectId]?.find(
        (item) => item.id === confirmationId
      );
      if (!confirmation) {
        throw mockError("函证记录不存在");
      }
      throw mockError(
        "Confirmation review requires the live API",
        "CONFIRMATION_STATE_CONFLICT"
      );
    }),
  undoProjectConfirmationReview: (projectId: string, confirmationId: string) =>
    withState((state) => {
      const confirmation = (state.confirmations ??= {})[projectId]?.find(
        (item) => item.id === confirmationId
      );
      if (!confirmation) {
        throw mockError("函证记录不存在");
      }
      throw mockError(
        "Confirmation review rollback requires the live API",
        "CONFIRMATION_STATE_CONFLICT"
      );
    }),
  removeProjectConfirmationFile: async (
    _projectId: string,
    _confirmationId: string
  ) => {
    await Promise.resolve();
    throw mockError("Confirmation upload requires the live API");
  },
  removeProjectConfirmationContent: async (
    _projectId: string,
    _confirmationId: string
  ) => {
    await Promise.resolve();
    throw mockError("Confirmation content deletion requires the live API");
  },
  updateProjectConfirmation: (
    projectId: string,
    confirmationId: string,
    input: UpdateProjectConfirmationInput
  ) =>
    withState((state) => {
      const project = findProject(state, projectId);
      if (!project) {
        throw mockError("项目不存在");
      }
      const confirmation = (state.confirmations ??= {})[projectId]?.find(
        (item) => item.id === confirmationId
      );
      if (!confirmation) {
        throw mockError("函证记录不存在");
      }
      if (input.displayName !== undefined) {
        confirmation.displayName = input.displayName.trim();
      }
      if (input.plannedSendDate !== undefined) {
        confirmation.plannedSendDate = input.plannedSendDate || null;
      }
      if (input.reportDeadline !== undefined) {
        confirmation.reportDeadline = input.reportDeadline || null;
      }
      if (input.teamConfirmStatus !== undefined) {
        confirmation.teamConfirmStatus = input.teamConfirmStatus;
      }
      if (input.teamConfirmedByName !== undefined) {
        confirmation.teamConfirmedByName =
          input.teamConfirmedByName?.trim() || null;
      }
      if (input.teamConfirmedAt !== undefined) {
        confirmation.teamConfirmedAt = input.teamConfirmedAt || null;
      }
      if (input.notes !== undefined) {
        confirmation.notes = input.notes?.trim() || null;
      }
      confirmation.updatedAt = new Date().toISOString();
      addLog(
        state,
        projectId,
        "PROJECT_CONFIRMATION_UPDATED",
        `Updated confirmation record for ${confirmation.counterpartyName}`
      );
      return confirmation;
    }),
  updateProjectConfirmationDraft: (
    projectId: string,
    confirmationId: string,
    input: UpdateProjectConfirmationDraftInput
  ) =>
    withState((state) => {
      const confirmation = (state.confirmations ??= {})[projectId]?.find(
        (item) => item.id === confirmationId
      );
      if (!confirmation) {
        throw mockError("函证记录不存在");
      }
      const now = new Date().toISOString();
      confirmation.draftTemplateCode = input.draftTemplateCode;
      confirmation.draftPayload = input.draftPayload;
      confirmation.draftUpdatedAt = now;
      if (input.draftPayload.clientName) {
        confirmation.clientName = input.draftPayload.clientName.trim();
      }
      if (input.draftPayload.bankName) {
        confirmation.counterpartyName = input.draftPayload.bankName.trim();
      }
      if (input.draftPayload.counterpartyContact !== undefined) {
        confirmation.counterpartyContact =
          input.draftPayload.counterpartyContact?.trim() || null;
      }
      if (input.draftPayload.counterpartyAddress !== undefined) {
        confirmation.counterpartyAddress =
          input.draftPayload.counterpartyAddress?.trim() || null;
      }
      if (input.draftPayload.draftNotes !== undefined) {
        confirmation.notes = input.draftPayload.draftNotes?.trim() || null;
      }
      confirmation.updatedAt = now;
      addLog(
        state,
        projectId,
        "PROJECT_CONFIRMATION_DRAFT_UPDATED",
        `Updated confirmation draft for ${confirmation.counterpartyName}`
      );
      return confirmation;
    }),
  previewProjectConfirmationPdf: (projectId: string, confirmationId: string) =>
    withState((state) => {
      const confirmation = (state.confirmations ??= {})[projectId]?.find(
        (item) => item.id === confirmationId
      );
      if (!confirmation) {
        throw mockError("函证记录不存在");
      }
      if (!confirmation.draftPayload || !confirmation.draftTemplateCode) {
        throw mockError("请先保存函证正文后再预览正式文件");
      }
      return confirmation.id;
    }).then(() => createMockPdfPreviewBlob()),
  previewConfirmationDispatchPdf: (confirmationId: string) =>
    withState((state) => {
      const confirmation = Object.values(state.confirmations ?? {})
        .flat()
        .find((item) => item.id === confirmationId);
      if (!confirmation?.currentArtifact) {
        throw mockError("函证正式文件不存在");
      }
      return confirmation.id;
    }).then(() => createMockPdfPreviewBlob()),
  submitProjectConfirmation: (
    projectId: string,
    confirmationId: string,
    input: SubmitProjectConfirmationInput
  ) =>
    withState((state) => {
      const confirmation = (state.confirmations ??= {})[projectId]?.find(
        (item) => item.id === confirmationId
      );
      if (!confirmation) {
        throw mockError("函证记录不存在");
      }
      const artifactsByConfirmation = state.confirmationArtifacts ?? {};
      state.confirmationArtifacts = artifactsByConfirmation;
      const keyedArtifact = Object.values(artifactsByConfirmation)
        .flat()
        .find((item) => item.submissionKey === input.idempotencyKey);
      if (keyedArtifact) {
        if (keyedArtifact.artifact.confirmationId !== confirmationId) {
          throw mockError("提交键属于其他函证", "CONFIRMATION_STATE_CONFLICT");
        }
        if (
          !isSameTimestamp(
            confirmation.draftUpdatedAt,
            input.expectedDraftUpdatedAt
          )
        ) {
          throw mockError(
            "函证草稿已发生变化，请刷新后重试",
            "CONFIRMATION_DRAFT_CHANGED"
          );
        }
        if (
          confirmation.status === "PREPARED" &&
          confirmation.currentArtifactId === keyedArtifact.artifact.id &&
          confirmation.currentArtifact?.id === keyedArtifact.artifact.id &&
          confirmation.currentArtifact.disposition === "ACTIVE" &&
          keyedArtifact.artifact.disposition === "ACTIVE"
        ) {
          return confirmation;
        }
        throw mockError(
          "提交键不是当前有效函证版本",
          "CONFIRMATION_STATE_CONFLICT"
        );
      }
      if (
        !isSameTimestamp(
          confirmation.draftUpdatedAt,
          input.expectedDraftUpdatedAt
        )
      ) {
        throw mockError(
          "函证草稿已发生变化，请刷新后重试",
          "CONFIRMATION_DRAFT_CHANGED"
        );
      }
      if (confirmation.status !== "DRAFT" || confirmation.currentArtifactId) {
        throw mockError("只有草稿函证可以提交", "CONFIRMATION_STATE_CONFLICT");
      }
      const user = getCurrentUser(state);
      const submittedAt = new Date().toISOString();
      const version = (confirmation.submissionVersion ?? 0) + 1;
      const confirmationArtifacts =
        artifactsByConfirmation[confirmationId] ?? [];
      artifactsByConfirmation[confirmationId] = confirmationArtifacts;
      const previousArtifact =
        version > 1
          ? confirmationArtifacts.find(
              (item) => item.artifact.version === version - 1
            )
          : null;
      if (version > 1 && !previousArtifact) {
        throw mockError(
          "上一版本函证文件不存在",
          "CONFIRMATION_STATE_CONFLICT"
        );
      }
      if (previousArtifact) {
        previousArtifact.artifact.disposition = "INVALIDATED";
        previousArtifact.artifact.invalidatedBy = user.id;
        previousArtifact.artifact.invalidatedAt = submittedAt;
        previousArtifact.artifact.invalidationReason = `SUPERSEDED_BY_VERSION_${version}`;
      }
      confirmation.submissionVersion = version;
      confirmation.currentArtifactId = mockEntityId("artifact");
      const artifact: NonNullable<ProjectConfirmation["currentArtifact"]> = {
        id: confirmation.currentArtifactId,
        confirmationId,
        version,
        disposition: "ACTIVE",
        templateCode: confirmation.draftTemplateCode ?? "PRC_BANK_TEMPLATE_1",
        templateVersion: "mock-renderer-v1",
        docxSize: 0,
        pdfSize: 0,
        pdfSha256: "0".repeat(64),
        submittedBy: user.id,
        submittedAt,
        invalidatedBy: null,
        invalidatedAt: null,
        invalidationReason: null,
      };
      confirmation.currentArtifact = artifact;
      confirmationArtifacts.push({
        submissionKey: input.idempotencyKey,
        artifact: { ...artifact },
      });
      confirmation.status = "PREPARED";
      confirmation.queuedAt = submittedAt;
      confirmation.queueClaimedBy = null;
      confirmation.queueClaimedAt = null;
      confirmation.responsibleUserId = user.id;
      confirmation.responsibleUser = user;
      confirmation.updatedAt = submittedAt;
      addLog(
        state,
        projectId,
        version === 1
          ? "PROJECT_CONFIRMATION_SUBMITTED"
          : "PROJECT_CONFIRMATION_RESUBMITTED",
        `Submitted confirmation ${confirmation.counterpartyName}`
      );
      return confirmation;
    }),
  withdrawProjectConfirmation: (
    projectId: string,
    confirmationId: string,
    input: WithdrawProjectConfirmationInput
  ) =>
    withState((state) => {
      const confirmation = (state.confirmations ??= {})[projectId]?.find(
        (item) => item.id === confirmationId
      );
      if (!confirmation) {
        throw mockError("函证记录不存在");
      }
      if (
        confirmation.status !== "PREPARED" ||
        confirmation.queueClaimedAt ||
        !confirmation.currentArtifact ||
        confirmation.currentArtifact.disposition !== "ACTIVE"
      ) {
        throw mockError(
          "函证已被处理，无法撤回",
          "CONFIRMATION_STATE_CONFLICT"
        );
      }
      const user = getCurrentUser(state);
      const invalidatedAt = new Date().toISOString();
      const storedArtifact = (state.confirmationArtifacts ?? {})[
        confirmationId
      ]?.find(
        (item) =>
          item.artifact.id === confirmation.currentArtifactId &&
          item.artifact.disposition === "ACTIVE"
      );
      if (!storedArtifact) {
        throw mockError(
          "当前函证文件已发生变化",
          "CONFIRMATION_STATE_CONFLICT"
        );
      }
      storedArtifact.artifact.disposition = "INVALIDATED";
      storedArtifact.artifact.invalidatedBy = user.id;
      storedArtifact.artifact.invalidatedAt = invalidatedAt;
      storedArtifact.artifact.invalidationReason = `WITHDRAWN: ${input.reason}`;
      confirmation.currentArtifact.disposition = "INVALIDATED";
      confirmation.currentArtifact.invalidatedBy = user.id;
      confirmation.currentArtifact.invalidatedAt = invalidatedAt;
      confirmation.currentArtifact.invalidationReason = `WITHDRAWN: ${input.reason}`;
      confirmation.status = "DRAFT";
      confirmation.currentArtifactId = null;
      confirmation.currentArtifact = null;
      confirmation.queuedAt = null;
      confirmation.queueClaimedBy = null;
      confirmation.queueClaimedAt = null;
      confirmation.updatedAt = invalidatedAt;
      addLog(
        state,
        projectId,
        "PROJECT_CONFIRMATION_WITHDRAWN",
        `Withdrew confirmation ${confirmation.counterpartyName}`
      );
      return confirmation;
    }),
  prepareProjectConfirmationDispatch: (
    projectId: string,
    confirmationId: string,
    input: PrepareProjectConfirmationDispatchInput
  ) =>
    withState((state) => {
      const project = findProject(state, projectId);
      if (!project) {
        throw mockError("项目不存在");
      }
      const confirmation = (state.confirmations ??= {})[projectId]?.find(
        (item) => item.id === confirmationId
      );
      if (!confirmation) {
        throw mockError("函证记录不存在");
      }
      const user = getCurrentUser(state);
      const now = new Date().toISOString();
      confirmation.preparedDispatchMethod = input.method ?? null;
      confirmation.preparedSenderName = input.senderName?.trim() || null;
      confirmation.preparedApplicantName = input.applicantName?.trim() || null;
      confirmation.preparedRecipientName = input.recipientName?.trim() || null;
      confirmation.preparedRecipientContact =
        input.recipientContact?.trim() || null;
      confirmation.preparedRecipientPhone =
        input.recipientPhone?.trim() || null;
      confirmation.preparedCourierName = input.courierName?.trim() || null;
      confirmation.preparedTrackingNumber =
        input.trackingNumber?.trim() || null;
      confirmation.preparedDispatchReference =
        input.dispatchReference?.trim() || null;
      confirmation.preparedFollowUpDate = input.followUpDate || null;
      confirmation.preparedAttachmentName =
        input.attachmentName?.trim() || null;
      confirmation.preparedDispatchNotes = input.notes?.trim() || null;
      if (input.markReady) {
        confirmation.status = "PREPARED";
        confirmation.preparedDispatchReadyBy = user.id;
        confirmation.preparedDispatchReadyAt = now;
      }
      confirmation.updatedAt = now;
      addLog(
        state,
        projectId,
        "PROJECT_CONFIRMATION_UPDATED",
        `Prepared dispatch details for ${confirmation.counterpartyName}`
      );
      return confirmation;
    }),
  createProjectConfirmationDispatch: (
    projectId: string,
    confirmationId: string,
    input: CreateProjectConfirmationDispatchInput
  ) =>
    withState((state) => {
      const project = findProject(state, projectId);
      if (!project) {
        throw mockError("项目不存在");
      }
      const confirmation = (state.confirmations ??= {})[projectId]?.find(
        (item) => item.id === confirmationId
      );
      if (!confirmation) {
        throw mockError("函证记录不存在");
      }
      const user = getCurrentUser(state);
      const now = new Date().toISOString();
      const dispatches = confirmation.dispatches ?? [];
      confirmation.dispatches = dispatches;
      const sequence =
        dispatches.reduce(
          (max, dispatch) => Math.max(max, dispatch.sequence),
          0
        ) + 1;
      dispatches.push({
        id: `confirmation-dispatch-${Date.now()}`,
        confirmationId,
        sequence,
        method: input.method,
        sentAt: input.sentAt,
        senderName: input.senderName?.trim() || null,
        applicantName: input.applicantName?.trim() || null,
        recipientName: input.recipientName?.trim() || null,
        recipientContact: input.recipientContact?.trim() || null,
        recipientPhone: input.recipientPhone?.trim() || null,
        courierName: input.courierName?.trim() || null,
        trackingNumber: input.trackingNumber?.trim() || null,
        trackingProvider: input.trackingNumber ? "17TRACK" : null,
        trackingCarrierCode: input.trackingCarrierCode ?? null,
        trackingRegisteredAt: input.trackingNumber ? now : null,
        trackingUpdatedAt: input.trackingNumber ? now : null,
        dispatchReference: input.dispatchReference?.trim() || null,
        followUpDate: input.followUpDate || null,
        attachmentName: input.attachmentName?.trim() || null,
        notes: input.notes?.trim() || null,
        createdBy: user.id,
        createdAt: now,
      });
      confirmation.status = "AWAITING_RESPONSE";
      confirmation.updatedAt = now;
      addLog(
        state,
        projectId,
        "PROJECT_CONFIRMATION_DISPATCH_CREATED",
        `Recorded dispatch ${sequence} for ${confirmation.counterpartyName}`
      );
      return confirmation;
    }),
  createProjectConfirmationFollowUpEvent: (
    projectId: string,
    confirmationId: string,
    input: CreateProjectConfirmationFollowUpEventInput
  ) =>
    withState((state) => {
      const confirmation = (state.confirmations ??= {})[projectId]?.find(
        (item) => item.id === confirmationId
      );
      if (!confirmation) {
        throw mockError("函证记录不存在");
      }
      if (confirmation.status !== "AWAITING_RESPONSE") {
        throw mockError("仅等待回函的函证可以登记跟进进度");
      }
      const now = new Date().toISOString();
      const user = getCurrentUser(state);
      (confirmation.followUpEvents ??= []).push({
        id: `confirmation-follow-up-${Date.now()}`,
        confirmationId,
        eventType: input.eventType,
        actorId: user.id,
        source: "PROJECT_TEAM_MANUAL",
        notes: input.notes?.trim() || null,
        occurredAt: now,
        createdAt: now,
      });
      confirmation.updatedAt = now;
      return confirmation;
    }),
  completeProjectConfirmationProgram: (
    projectId: string,
    confirmationId: string
  ) =>
    withState((state) => {
      const confirmation = (state.confirmations ??= {})[projectId]?.find(
        (item) => item.id === confirmationId
      );
      if (!confirmation) {
        throw mockError("函证记录不存在");
      }
      if (
        confirmation.status !== "RESPONSE_RECEIVED" ||
        !(confirmation.responses?.length ?? 0)
      ) {
        throw mockError("请先登记并上传回函，再完成函证程序");
      }
      const now = new Date().toISOString();
      const user = getCurrentUser(state);
      confirmation.status = "CLOSED";
      (confirmation.followUpEvents ??= []).push({
        id: `confirmation-follow-up-${Date.now()}`,
        confirmationId,
        eventType: "PROGRAM_COMPLETED",
        actorId: user.id,
        source: "PROJECT_TEAM_MANUAL",
        notes: null,
        occurredAt: now,
        createdAt: now,
      });
      confirmation.updatedAt = now;
      return confirmation;
    }),
  correctProjectConfirmationTracking: (
    projectId: string,
    confirmationId: string,
    dispatchId: string,
    input: CorrectProjectConfirmationTrackingInput
  ) =>
    withState((state) => {
      const confirmation = (state.confirmations ??= {})[projectId]?.find(
        (item) => item.id === confirmationId
      );
      if (!confirmation) {
        throw mockError("函证记录不存在");
      }
      const dispatch = confirmation.dispatches?.find(
        (item) => item.id === dispatchId
      );
      if (!dispatch) {
        throw mockError("发函记录不存在");
      }
      const now = new Date().toISOString();
      dispatch.trackingNumber = input.trackingNumber;
      dispatch.courierName = input.courierName ?? null;
      dispatch.trackingCarrierCode = input.trackingCarrierCode ?? null;
      dispatch.trackingCarrierName = null;
      dispatch.trackingStatus = null;
      dispatch.trackingEvents = [];
      dispatch.trackingRegisteredAt = now;
      dispatch.trackingUpdatedAt = now;
      dispatch.trackingError = null;
      confirmation.updatedAt = now;
      addLog(
        state,
        projectId,
        "PROJECT_CONFIRMATION_TRACKING_CORRECTED",
        `Corrected tracking for ${confirmation.counterpartyName}`
      );
      return confirmation;
    }),
  refreshProjectConfirmationTracking: (
    projectId: string,
    confirmationId: string,
    dispatchId: string
  ) =>
    withState((state) => {
      const confirmation = (state.confirmations ??= {})[projectId]?.find(
        (item) => item.id === confirmationId
      );
      if (!confirmation) {
        throw mockError("函证记录不存在");
      }
      const dispatch = confirmation.dispatches?.find(
        (item) => item.id === dispatchId
      );
      if (!dispatch?.trackingNumber) {
        throw mockError("发函记录不存在");
      }
      dispatch.trackingUpdatedAt = new Date().toISOString();
      confirmation.updatedAt = dispatch.trackingUpdatedAt;
      return confirmation;
    }),
  rollForwardPreview: (id: string) =>
    withState((state): RollForwardPreview => {
      const user = getCurrentUser(state);
      const project = findProject(state, id);
      if (
        !project ||
        project.status !== "ARCHIVED" ||
        (user.globalRole !== "SUPER_ADMIN" &&
          !project.members?.some((member) => member.user.id === user.id))
      ) {
        throw mockError(
          "Only accessible archived projects can be rolled forward",
          "ROLL_FORWARD_SOURCE_NOT_AVAILABLE"
        );
      }
      const summary = buildRollForwardPreviewSummary(
        state.workflows[id] ?? [],
        state.attachmentVersions
      );
      return {
        project,
        summary,
        reset: {
          signoffs: true,
          reviewQuestions: true,
          locks: true,
          archiveArtifacts: true,
          auditLogs: true,
        },
        retained: {
          workflow: true,
          workingPapers: true,
          attachments: true,
          attachmentVersions: true,
          smartFormAnswers: true,
        },
      };
    }),
  archiveProject: (id: string) =>
    withState((state) => {
      const report = buildArchiveCheckReport(state, id);
      if (!report.ready) {
        throw mockError(
          `Archive File Check failed with ${report.summary.blockers} blocker(s)`,
          "ARCHIVE_CHECK_FAILED"
        );
      }
      const project = findProject(state, id);
      if (!project) {
        throw mockError("项目不存在");
      }
      project.status = "ARCHIVED";
      addLog(state, id, "PROJECT_ARCHIVED", "归档项目");
      const actorId = getCurrentUser(state).id;
      for (const member of project.members ?? []) {
        addMockInboxMessage(state, {
          recipientId: member.user.id,
          senderId: member.user.id === actorId ? null : actorId,
          projectId: id,
          type: "SYSTEM_NOTIFICATION",
          title: `Project successfully archived: ${project.projectCode}`,
          body: `${project.projectCode} has been successfully archived. The archive package is ready to download.`,
          actionUrl: `/engagement/${id}`,
        });
      }
      return project;
    }),
  submitArchive: (id: string) =>
    withState((state) => {
      const report = buildArchiveCheckReport(state, id);
      if (!report.ready) {
        throw mockError(
          `Archive File Check failed with ${report.summary.blockers} blocker(s)`,
          "ARCHIVE_CHECK_FAILED"
        );
      }
      const project = findProject(state, id);
      if (!project) {
        throw mockError("项目不存在");
      }
      project.status = "PENDING_FINAL_CHECK";
      addLog(
        state,
        id,
        "PROJECT_SUBMITTED_FOR_ARCHIVE",
        "Submitted project for final archive check"
      );
      return project;
    }),
  reopenProject: (id: string, _input?: { reason?: string }) =>
    withState((state) => {
      const project = findProject(state, id);
      if (!project) {
        throw mockError("项目不存在");
      }
      if (project.status !== "PENDING_FINAL_CHECK") {
        throw mockError("Only projects pending final check can be reopened");
      }
      project.status = "ACTIVE";
      addLog(state, id, "PROJECT_REOPENED", "Reopened project");
      for (const member of project.members ?? []) {
        addMockInboxMessage(state, {
          recipientId: member.user.id,
          senderId: getCurrentUser(state).id,
          projectId: id,
          type: "SYSTEM_NOTIFICATION",
          title: `Archive review returned for revision: ${project.projectCode}`,
          body: `${project.name} was returned from final archive review. The project is editable again.`,
          actionUrl: `/engagement/${id}`,
        });
      }
      return project;
    }),
  tmsProjectLinks: (input: TmsProjectLinkQuery = {}) =>
    withState((state) => {
      const currentUser = getCurrentUser(state);
      const canViewProjectLinks = input.projectId
        ? currentUser.globalRole === "SUPER_ADMIN" ||
          Boolean(
            findProject(state, input.projectId)?.members?.some(
              (member) => member.user.id === currentUser.id
            )
          )
        : false;
      return {
        links: [...mockTmsProjectLinks.values()].filter(
          (link) =>
            (!input.projectId || link.projectId === input.projectId) &&
            (!input.status || link.status === input.status) &&
            (!input.q ||
              `${link.tmsCode} ${link.label} ${link.ownerName}`
                .toLocaleLowerCase("en-US")
                .includes(input.q.toLocaleLowerCase("en-US"))) &&
            (input.projectId
              ? canViewProjectLinks
              : link.ownerUserId === currentUser.id ||
                currentUser.globalRole === "SUPER_ADMIN")
        ),
      };
    }),
  linkTmsProject: (rowId: string, projectId: string) =>
    withState((state) => {
      const currentUser = getCurrentUser(state);
      const project = findProject(state, projectId);
      if (!project) {
        throw mockError("项目不存在");
      }
      const existing = mockTmsProjectLinks.get(rowId);
      const duplicate = [...mockTmsProjectLinks.values()].some(
        (link) =>
          link.rowId !== rowId &&
          link.ownerUserId === (existing?.ownerUserId ?? currentUser.id) &&
          link.projectId === projectId &&
          link.status === "LINKED"
      );
      if (duplicate) {
        throw mockError("该 TMS 项目已关联另一条工时行");
      }
      const link: TmsProjectLink = {
        id: existing?.id ?? mockEntityId("tms-link"),
        rowId,
        ownerUserId: existing?.ownerUserId ?? currentUser.id,
        ownerName: existing?.ownerName ?? currentUser.name,
        year: existing?.year ?? 2026,
        month: existing?.month ?? 7,
        periodScope: existing?.periodScope ?? "first",
        tmsCode:
          existing?.tmsCode ??
          `DUMMY-TMS-${rowId.replaceAll("-", "").slice(-6).toUpperCase()}`,
        label: existing?.label ?? rowId,
        projectId,
        projectCode: project.projectCode,
        projectName: project.name,
        workType: existing?.workType ?? null,
        description: existing?.description ?? existing?.label ?? rowId,
        hoursByDate: existing?.hoursByDate ?? {},
        periodTotal: existing?.periodTotal ?? 0,
        status: "LINKED",
      };
      mockTmsProjectLinks.set(rowId, link);
      return link;
    }),
  unlinkTmsProject: (rowId: string) =>
    withState(() => {
      const existing = mockTmsProjectLinks.get(rowId);
      if (!existing) {
        throw mockError("TMS 行不存在");
      }
      const link = {
        ...existing,
        projectId: null,
        projectCode: null,
        projectName: null,
        status: "PENDING" as const,
      };
      mockTmsProjectLinks.set(rowId, link);
      return link;
    }),
  confirmProjectArchive: (id: string) =>
    withState((state) => {
      const project = findProject(state, id);
      if (!project) {
        throw mockError("项目不存在");
      }
      if (project.status !== "PENDING_FINAL_CHECK") {
        throw mockError(
          "Only projects pending final check can be confirmed for archive"
        );
      }
      const report = buildArchiveCheckReport(state, id);
      const job = report.ready
        ? buildCompletedArchiveJob(state, id, report)
        : buildFailedArchiveJob(id, report);
      mockArchiveJobs.set(job.jobId, job);
      if (job.status === "completed") {
        addLog(
          state,
          id,
          "PROJECT_FINAL_ARCHIVE_CONFIRMED",
          "Final archive confirmed"
        );
      }
      return job;
    }),
  deleteProject: (id: string) =>
    withState((state) => {
      const project = findProject(state, id);
      if (!project) {
        throw mockError("项目不存在");
      }
      project.status = "DELETED";
      state.desktopPlacements = state.desktopPlacements.filter(
        (placement) => placement.projectId !== id
      );
      addLog(state, id, "PROJECT_DELETED", "删除项目");
      return project;
    }),
  restoreProject: (id: string) =>
    withState((state) => {
      const project = findProject(state, id);
      if (!project) {
        throw mockError("Project not found");
      }
      project.status = "ACTIVE";
      ensureDesktopPlacements(state, getCurrentUser(state));
      addLog(state, id, "PROJECT_RESTORED", "Restore project");
      return project;
    }),
  archiveCheck: (id: string) =>
    withState((state) => buildArchiveCheckReport(state, id)),
  exportArchiveCheck: (id: string) =>
    withState((state) => {
      const report = buildArchiveCheckReport(state, id);
      return new Blob([JSON.stringify(report, null, 2)], {
        type: "application/pdf",
      });
    }),
  startArchiveCheckJob: (id: string) =>
    withState((state) => {
      const report = buildArchiveCheckReport(state, id);
      const job = buildCompletedArchiveCheckJob(id, report);
      mockArchiveCheckJobs.set(job.jobId, job);
      return job;
    }),
  archiveCheckJob: (projectId: string, jobId: string) =>
    withState((state) => {
      const job = mockArchiveCheckJobs.get(jobId);
      if (job?.projectId === projectId) {
        return job;
      }
      const report = buildArchiveCheckReport(state, projectId);
      const fallback = buildCompletedArchiveCheckJob(projectId, report, jobId);
      mockArchiveCheckJobs.set(jobId, fallback);
      return fallback;
    }),
  startArchiveJob: (id: string) =>
    withState((state) => {
      const report = buildArchiveCheckReport(state, id);
      const project = findProject(state, id);
      if (!project) {
        throw mockError("项目不存在");
      }
      const job = report.ready
        ? buildCompletedArchiveJob(state, id, report)
        : buildFailedArchiveJob(id, report);
      mockArchiveJobs.set(job.jobId, job);
      return job;
    }),
  archiveJob: (projectId: string, jobId: string) =>
    withState((state) => {
      const job = mockArchiveJobs.get(jobId);
      if (job?.projectId === projectId) {
        return job;
      }
      const report = buildArchiveCheckReport(state, projectId);
      const fallback = report.ready
        ? buildCompletedArchiveJob(state, projectId, report, jobId)
        : buildFailedArchiveJob(projectId, report, jobId);
      mockArchiveJobs.set(jobId, fallback);
      return fallback;
    }),
  watchArchiveJob: (
    projectId: string,
    jobId: string,
    onJob: ArchiveJobEventHandler
  ) =>
    withState((state) => {
      const job = mockArchiveJobs.get(jobId);
      if (job?.projectId === projectId) {
        onJob(job);
        return;
      }
      const report = buildArchiveCheckReport(state, projectId);
      const fallback = report.ready
        ? buildCompletedArchiveJob(state, projectId, report, jobId)
        : buildFailedArchiveJob(projectId, report, jobId);
      mockArchiveJobs.set(jobId, fallback);
      onJob(fallback);
    }),
  archiveArtifact: (projectId: string) =>
    withState((state) => {
      const artifact = mockArchiveArtifacts.get(projectId);
      if (artifact) {
        return artifact;
      }
      const project = findProject(state, projectId);
      if (!project) {
        throw mockError("项目不存在");
      }
      if (project.status !== "ARCHIVED") {
        throw mockError("归档包不存在", "ARCHIVE_ARTIFACT_NOT_FOUND");
      }
      const created = buildMockArchiveArtifact(
        projectId,
        project.projectCode,
        getCurrentUser(state).id
      );
      mockArchiveArtifacts.set(projectId, created);
      return created;
    }),
  downloadArchiveArtifact: (projectId: string) =>
    withState((state) => {
      const project = findProject(state, projectId);
      if (!project) {
        throw mockError("项目不存在");
      }
      return new Blob([`${project.projectCode} archive package`], {
        type: "application/zip",
      });
    }),
  moveProjectPlacement,
  members: (projectId: string) =>
    withState((state) => {
      const project = findProject(state, projectId);
      if (!project) {
        throw mockError("项目不存在");
      }
      return (project.members ?? []).map((member) => ({
        ...member,
        membershipStatus: "ACTIVE" as const,
      }));
    }),
  projectMemberDirectory: (projectId: string) =>
    withState((state) => {
      const project = findProject(state, projectId);
      if (!project) {
        throw mockError("项目不存在");
      }
      const members = (project.members ?? []).map((member) => ({
        ...member,
        membershipStatus: "ACTIVE" as const,
      }));
      const activeMemberEmails = new Set(
        members.map((member) => member.user.email.toLowerCase())
      );
      const invitedRows = Object.entries(state.invitations).flatMap(
        ([token, invitation]) => {
          if (invitation.projectId !== projectId) {
            return [];
          }
          if ((invitation.status ?? "PENDING") !== "PENDING") {
            return [];
          }
          if (
            invitation.expiresAt &&
            new Date(invitation.expiresAt).getTime() <= Date.now()
          ) {
            return [];
          }
          const recipientEmail = invitation.recipientEmail?.toLowerCase();
          if (!recipientEmail || activeMemberEmails.has(recipientEmail)) {
            return [];
          }
          const invitedUser = state.users.find(
            (user) =>
              user.email.toLowerCase() === recipientEmail &&
              user.status !== "DISABLED"
          );
          if (!invitedUser) {
            return [];
          }
          const allowedProjectRoles = getAssignableProjectRolesForGlobalRole(
            invitedUser.globalRole
          );
          const roleConsistent = allowedProjectRoles.includes(
            invitation.invitedRole
          );
          return [
            {
              id: `invitation:${token}`,
              invitationId: token,
              membershipStatus: "INVITED" as const,
              projectRole: invitation.invitedRole,
              inChargeRole: null,
              allowedProjectRoles,
              roleConsistent,
              roleConflictReason: roleConsistent
                ? null
                : `账号职级 ${invitedUser.globalRole} 不允许项目职责 ${invitation.invitedRole}`,
              declarationAccepted: false,
              declarationAcceptedAt: null,
              invitationExpiresAt: invitation.expiresAt ?? null,
              invitedAt: invitation.createdAt ?? null,
              user: invitedUser,
            },
          ];
        }
      );
      return [...members, ...invitedRows];
    }),
  userDirectory: () =>
    withState((state) =>
      state.users.filter(
        (user) => getProjectInvitationEligibility(user).canReceiveInvitation
      )
    ),
  projectInvitees: (
    input: ProjectInviteeDirectoryQueryInput = {}
  ): Promise<ProjectInviteeDirectoryResponse> =>
    withState((state) => {
      const query = input.q?.trim().toLowerCase();
      const currentUser = getCurrentUser(state);
      if (input.browseAll && currentUser.globalRole !== "PARTNER") {
        throw mockError("Only Partners can browse the full employee directory");
      }
      if (!input.browseAll && (!query || query.length < 2)) {
        throw mockError("Enter at least two letters to search employees");
      }
      const excludedUserIds = new Set(input.excludeUserIds);
      const pageSize = input.pageSize ?? 10;
      const page = input.page ?? 1;
      const users = state.users.filter((user) => {
        if (!getProjectInvitationEligibility(user).canReceiveInvitation) {
          return false;
        }
        if (excludedUserIds.has(user.id)) {
          return false;
        }
        if (input.globalRole && user.globalRole !== input.globalRole) {
          return false;
        }
        if (!query) {
          return true;
        }
        return (
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
        );
      });
      const total = users.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const resolvedPage = Math.min(Math.max(page, 1), totalPages);
      return {
        users: users
          .slice((resolvedPage - 1) * pageSize, resolvedPage * pageSize)
          .map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            globalRole: user.globalRole,
            status: user.status ?? "ACTIVE",
          })),
        page: resolvedPage,
        pageSize,
        total,
        totalPages,
      };
    }),
  createInvitation,
  cancelProjectInvitation: (projectId: string, invitationId: string) =>
    withState((state) => {
      const invitation = state.invitations[invitationId];
      if (!invitation || invitation.projectId !== projectId) {
        throw mockError("待处理邀请不存在", "NOT_FOUND");
      }
      Reflect.deleteProperty(state.invitations, invitationId);
      state.messages = state.messages.filter(
        (message) =>
          !(
            message.projectId === projectId &&
            message.actionUrl === `/invitations/${invitationId}`
          )
      );
      addLog(state, projectId, "INVITATION_CANCELLED", "取消项目邀请");
      return { id: invitationId };
    }),
  updateProjectMemberInChargeRole,
  recoverProjectPic,
  createPicRecoveryInvitation,
  reauthorizeProjectMember,
  updateProjectMemberRole,
  removeProjectMember: (projectId: string, memberId: string) =>
    withState((state) => {
      const project = findProject(state, projectId);
      if (!project?.members) {
        throw mockError("成员不存在");
      }
      if (
        project.members.find((member) => member.id === memberId)?.inChargeRole
      ) {
        throw mockError("请先由 PIC 取消该成员的负责人身份");
      }
      project.members = project.members.filter(
        (member) => member.id !== memberId
      );
      addLog(state, projectId, "MEMBER_REMOVED", "移除项目成员");
      return { id: memberId };
    }),
  acceptInvitation,
  inboxMessages: () =>
    withState((state) => {
      const user = getCurrentUser(state);
      return state.messages
        .filter((message) => message.recipientId === user.id)
        .sort((a, b) => {
          if (!a.readAt && b.readAt) {
            return -1;
          }
          if (a.readAt && !b.readAt) {
            return 1;
          }
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
    }),
  workItems: (
    input: {
      view?: WorkItemView;
      scope?: WorkItemDomain;
      domain?: WorkItemDomain;
      projectId?: string;
      locale?: "zh-CN" | "en-US";
    } = {}
  ) => withState((state) => buildMockWorkItems(state, input)),
  markInboxRead: (messageId: string) =>
    withState((state) => {
      const user = getCurrentUser(state);
      const message = state.messages.find(
        (item) => item.id === messageId && item.recipientId === user.id
      );
      if (!message) {
        throw mockError("消息不存在");
      }
      message.readAt ??= new Date().toISOString();
      return message;
    }),
  markInboxUnread: (messageId: string) =>
    withState((state) => {
      const user = getCurrentUser(state);
      const message = state.messages.find(
        (item) => item.id === messageId && item.recipientId === user.id
      );
      if (!message) {
        throw mockError("消息不存在");
      }
      message.readAt = null;
      return message;
    }),
  markAllInboxRead: () =>
    withState((state) => {
      const user = getCurrentUser(state);
      const readAt = new Date().toISOString();
      let count = 0;
      for (const message of state.messages) {
        if (message.recipientId === user.id && !message.readAt) {
          message.readAt = readAt;
          count += 1;
        }
      }
      return { count, readAt };
    }),
  deleteInboxMessage: (messageId: string) =>
    withState((state) => {
      const user = getCurrentUser(state);
      const index = state.messages.findIndex(
        (item) => item.id === messageId && item.recipientId === user.id
      );
      if (index === -1) {
        throw mockError("消息不存在");
      }
      state.messages.splice(index, 1);
      return { id: messageId };
    }),
  workflow: (projectId: string) =>
    withState((state) => {
      normalizeWorkflowCodes(state.workflows[projectId] ?? []);
      pruneEmptyWorkingPapers(state.workflows[projectId] ?? []);
      return withoutDeletedAttachments(state.workflows[projectId] ?? []);
    }),
  createWorkflowNode,
  updateWorkflowNode,
  deleteWorkflowNode: (projectId: string, nodeId: string) =>
    withState((state) => {
      state.deletedAttachments ??= {};
      const target = findNode(state.workflows[projectId] ?? [], nodeId);
      if (target) {
        const archived = archiveNodeAttachments(target, getCurrentUser(state));
        state.deletedAttachments[projectId] = [
          ...(state.deletedAttachments[projectId] ?? []),
          ...archived,
        ];
        archived.forEach((attachment) => {
          addLog(state, projectId, "ATTACHMENT_DELETED", "删除文件", {
            targetType: "ATTACHMENT",
            targetId: attachment.id,
          });
        });
      }
      const removed = removeNode(state.workflows[projectId] ?? [], nodeId);
      if (!removed || !target) {
        throw mockError("组或底稿不存在");
      }
      addLog(
        state,
        projectId,
        "WORKFLOW_NODE_DELETED",
        `删除${target.level === 2 ? "组" : "底稿"} ${target.code}`
      );
      return { id: nodeId };
    }),
  createWorkingPaper,
  createProjectSmartForm: (
    projectId: string,
    nodeId: string,
    input: CreateProjectSmartFormInput
  ) =>
    withState((state) => {
      const node = findNode(state.workflows[projectId] ?? [], nodeId);
      if (!node) {
        throw mockError("Project folder not found");
      }
      const smartFormTemplate = state.smartFormTemplates.find(
        (template) =>
          template.currentPublishedVersionId ===
            input.smartFormTemplateVersionId && template.status === "PUBLISHED"
      );
      const version = smartFormTemplate?.currentPublishedVersion;
      if (!smartFormTemplate || !version) {
        throw mockError("Published Smart Form template not found");
      }
      const sortOrder = (node.workingPapers ?? []).length + 1;
      const title = input.title?.trim() || smartFormTemplate.name;
      const plannedCode =
        normalizeCodeWithoutDigitFour(input.code?.trim() || "") ||
        buildNextWorkingPaperCode(node.code, node.workingPapers ?? []);
      const nodeCode = normalizeCodeWithoutDigitFour(node.code);
      const smartFormReference: ProjectTemplateSmartForm = {
        id: mockEntityId("project-smart-form-source"),
        projectTemplateId: projectId,
        templateNodeId: nodeId,
        smartFormTemplateId: smartFormTemplate.id,
        smartFormTemplateVersionId: version.id,
        code: `${nodeCode}-F${formatNumberWithoutDigitFour(sortOrder, 3)}`,
        title,
        fileName: normalizeSmartFormFileName(title),
        sortOrder,
        smartFormTemplate,
        smartFormTemplateVersion: version,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const paper = workingPaperFromProjectTemplateSmartForm(
        state,
        projectId,
        nodeId,
        plannedCode,
        smartFormReference,
        getCurrentUser(state),
        input.language ?? "zh-CN"
      );
      node.workingPapers = [...(node.workingPapers ?? []), paper];
      addLog(state, projectId, "WORKING_PAPER_CREATED", "Create Smart Form", {
        targetType: "WORKING_PAPER",
        targetId: paper.id,
      });
      return paper;
    }),
  openSmartForm: (projectId: string, attachmentId: string) =>
    withState((state) => {
      const attachment = findAttachment(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      if (!attachment) {
        throw mockError("Smart Form not found");
      }
      const user = getCurrentUser(state);
      lockAttachmentForUser(attachment, user);
      attachment.lockSessionId = `mock-smart-form-lock-${attachment.id}`;
      return buildMockSmartFormSession(attachment, attachment.lockSessionId);
    }),
  readSmartForm: (projectId: string, attachmentId: string) =>
    withState((state) => {
      const attachment = findAttachment(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      if (!attachment) {
        throw mockError("Smart Form not found");
      }
      return buildMockSmartFormRead(attachment);
    }),
  saveSmartForm: (
    projectId: string,
    attachmentId: string,
    input: {
      lockSessionId: string;
      package: SmartFormPackage;
    }
  ) =>
    withState((state) => {
      const attachment = findAttachment(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      if (!attachment) {
        throw mockError("Smart Form not found");
      }
      requireSmartFormMockLock(attachment, input.lockSessionId);
      attachment.version += 1;
      attachment.fileSize = JSON.stringify(input.package).length;
      attachment.lastModifiedAt = new Date().toISOString();
      mockSmartFormPackages.set(attachment.id, input.package);
      return buildMockSmartFormSession(
        attachment,
        input.lockSessionId,
        input.package
      );
    }),
  closeSmartForm: (
    projectId: string,
    attachmentId: string,
    input: {
      lockSessionId: string;
      package: SmartFormPackage;
    }
  ) =>
    withState((state) => {
      const attachment = findAttachment(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      if (!attachment) {
        throw mockError("Smart Form not found");
      }
      requireSmartFormMockLock(attachment, input.lockSessionId);
      attachment.version += 1;
      attachment.fileSize = JSON.stringify(input.package).length;
      mockSmartFormPackages.set(attachment.id, input.package);
      attachment.lockedBy = null;
      attachment.lockedAt = null;
      attachment.lockExpiresAt = null;
      attachment.lockSessionId = null;
      attachment.lockHolder = null;
      attachment.lastModifiedAt = new Date().toISOString();
      return buildMockSmartFormSession(
        attachment,
        input.lockSessionId,
        input.package
      );
    }),
  discardSmartForm: (
    projectId: string,
    attachmentId: string,
    input: { lockSessionId: string }
  ) =>
    withState((state) => {
      const attachment = findAttachment(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      if (!attachment) {
        throw mockError("Smart Form not found");
      }
      requireSmartFormMockLock(attachment, input.lockSessionId);
      attachment.lockedBy = null;
      attachment.lockedAt = null;
      attachment.lockExpiresAt = null;
      attachment.lockSessionId = null;
      attachment.lockHolder = null;
      return buildMockSmartFormSession(attachment, input.lockSessionId);
    }),
  workingPaper: (projectId: string, paperId: string) =>
    withState((state) => {
      const paper = findWorkingPaper(state.workflows[projectId] ?? [], paperId);
      if (!paper) {
        throw mockError("底稿不存在");
      }
      return withoutDeletedPaperAttachments(paper);
    }),
  updateWorkingPaper: (
    projectId: string,
    paperId: string,
    input: UpdateWorkingPaperInput
  ) =>
    withState((state) => {
      const paper = findWorkingPaper(state.workflows[projectId] ?? [], paperId);
      if (!paper) {
        throw mockError("Workpaper not found");
      }
      const inputCode = input.code?.trim();
      const code =
        inputCode === undefined
          ? undefined
          : normalizeCodeWithoutDigitFour(inputCode);
      if (code !== undefined) {
        paper.code = code;
        for (const attachment of paper.attachments ?? []) {
          if (attachment.placeholderType) {
            attachment.code = code;
          }
        }
      }
      if (input.title !== undefined) {
        const title = input.title.trim();
        paper.title =
          inputCode !== undefined && title === inputCode
            ? (code ?? title)
            : title;
      }
      addLog(
        state,
        projectId,
        "WORKING_PAPER_UPDATED",
        `Updated workpaper ${paper.code}`,
        {
          targetType: "WORKING_PAPER",
          targetId: paper.id,
        }
      );
      return withoutDeletedPaperAttachments(paper);
    }),
  updateAttachmentIdentity: (
    projectId: string,
    attachmentId: string,
    input: UpdateAttachmentIdentityInput
  ) =>
    withState((state) => {
      const location = findAttachmentLocation(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      if (!location) {
        throw mockError("File not found");
      }
      const inputCode = input.code?.trim();
      const code =
        inputCode === undefined
          ? undefined
          : normalizeAttachmentRefCodeInput(inputCode);
      if (code !== undefined) {
        if (location.attachment.placeholderType) {
          const paperCode = normalizeCodeWithoutDigitFour(inputCode ?? code);
          location.paper.code = paperCode;
          for (const attachment of location.paper.attachments ?? []) {
            if (attachment.placeholderType) {
              attachment.code = paperCode;
            }
          }
        } else {
          assertAttachmentRefCodeMatchesNode(code, location.node.code);
          location.attachment.code = code;
        }
      }
      if (input.title !== undefined) {
        const title = input.title.trim();
        location.attachment.title =
          inputCode !== undefined && title === inputCode ? code : title;
      }
      addLog(
        state,
        projectId,
        "ATTACHMENT_UPDATED",
        `Updated file ${location.attachment.code ?? location.attachment.originalName ?? location.attachment.fileName}`,
        { targetType: "ATTACHMENT", targetId: attachmentId }
      );
      return location.attachment;
    }),
  reorderWorkingPaperAttachments: (
    projectId: string,
    input: ReorderWorkingPaperAttachmentsInput
  ) =>
    withState((state) => {
      const node = findNode(
        state.workflows[projectId] ?? [],
        input.workflowNodeId
      );
      if (!node) {
        throw mockError("目录不存在");
      }
      const papers = (node.workingPapers ?? []).filter(
        (paper) => (paper.bucket ?? "CURRENT") === input.bucket
      );
      const attachments = papers.flatMap((paper) =>
        (paper.attachments ?? []).filter((attachment) => !attachment.deletedAt)
      );
      const attachmentsById = new Map(
        attachments.map((attachment) => [attachment.id, attachment])
      );
      if (
        attachmentsById.size !== input.attachmentIds.length ||
        input.attachmentIds.some(
          (attachmentId) => !attachmentsById.has(attachmentId)
        )
      ) {
        throw mockError(
          "附件必须全部属于同一目录和文件桶",
          "VALIDATION_FAILED"
        );
      }
      const sortOrderById = new Map(
        input.attachmentIds.map((attachmentId, sortOrder) => [
          attachmentId,
          sortOrder,
        ])
      );
      for (const paper of papers) {
        const paperAttachments = paper.attachments ?? [];
        const activeAttachments = paperAttachments
          .filter((attachment) => sortOrderById.has(attachment.id))
          .map((attachment) => ({
            ...attachment,
            sortOrder:
              sortOrderById.get(attachment.id) ?? Number.MAX_SAFE_INTEGER,
          }))
          .sort((left, right) => left.sortOrder - right.sortOrder);
        const deletedAttachments = paperAttachments.filter(
          (attachment) => !sortOrderById.has(attachment.id)
        );
        paper.attachments = [...activeAttachments, ...deletedAttachments];
      }
      addLog(state, projectId, "ATTACHMENT_UPDATED", "调整底稿附件顺序", {
        targetType: "PROJECT",
        targetId: projectId,
      });
      return { attachmentIds: input.attachmentIds };
    }),
  updateWorkingPaperAssignees: (
    projectId: string,
    paperId: string,
    input: UpdateWorkingPaperAssigneesInput
  ) =>
    withState((state) => {
      const paper = findWorkingPaper(state.workflows[projectId] ?? [], paperId);
      const project = findProject(state, projectId);
      if (!paper || !project) {
        throw mockError("底稿不存在");
      }
      const preparer =
        project.members?.find((member) => member.user.id === input.preparerId)
          ?.user ?? null;
      const reviewer =
        project.members?.find((member) => member.user.id === input.reviewerId)
          ?.user ?? null;
      paper.preparerId = preparer?.id ?? null;
      paper.reviewerId = reviewer?.id ?? null;
      paper.preparer = preparer;
      paper.reviewer = reviewer;
      addLog(
        state,
        projectId,
        "WORKING_PAPER_ASSIGNEES_UPDATED",
        "调整底稿签署人"
      );
      return paper;
    }),
  deleteWorkingPaper: (projectId: string, paperId: string) =>
    withState((state) => {
      const paper = findWorkingPaper(state.workflows[projectId] ?? [], paperId);
      if (!paper) {
        throw mockError("Workpaper not found");
      }
      if (
        (paper.attachments ?? []).some((attachment) => !attachment.deletedAt)
      ) {
        throw mockError("Only empty working papers can be deleted");
      }
      const removed = removeWorkingPaper(
        state.workflows[projectId] ?? [],
        paperId
      );
      if (!removed) {
        throw mockError("Workpaper not found");
      }
      addLog(state, projectId, "WORKING_PAPER_DELETED", "Deleted workpaper", {
        targetType: "WORKING_PAPER",
        targetId: paperId,
      });
      return { id: paperId };
    }),
  uploadWorkingPaperAttachment: (
    projectId: string,
    paperId: string,
    file: File,
    workDate?: string
  ) =>
    serializeMockAttachmentContent(file).then((content) =>
      withState((state) => {
        const paper = findWorkingPaper(
          state.workflows[projectId] ?? [],
          paperId
        );
        if (!paper) {
          throw mockError("底稿不存在");
        }
        const user = getCurrentUser(state);
        const uploadedAt = new Date().toISOString();
        const normalizedWorkDate = normalizeMockWorkDate(workDate, uploadedAt);
        const sortOrder = nextMockDirectoryAttachmentSortOrder(
          state,
          projectId,
          paper.workflowNodeId,
          paper.bucket ?? "CURRENT"
        );
        const attachment: Attachment = {
          id: mockEntityId("attachment"),
          workingPaperId: paper.id,
          fileKind: "SUPPORTING",
          fileName: file.name,
          originalName: file.name,
          fileUrl: `mock://${paper.id}/${file.name}`,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
          sortOrder,
          version: 1,
          workDate: normalizedWorkDate,
          lockedBy: null,
          lockedAt: null,
          lockExpiresAt: null,
          uploadedBy: user.id,
          deletedAt: null,
          deletedBy: null,
          restoredAt: null,
          restoredBy: null,
          lastModifiedBy: user.id,
          lastModifiedAt: uploadedAt,
          uploader: { id: user.id, name: user.name, email: user.email },
          lockHolder: null,
          lastModifier: { id: user.id, name: user.name, email: user.email },
        };
        const revision = createMockAttachmentRevision(state, projectId, {
          attachmentId: attachment.id,
          version: attachment.version,
          parentVersionId: null,
          sourceVersionId: null,
          fileKind: attachment.fileKind,
          fileName: attachment.fileName,
          originalName: attachment.originalName,
          fileUrl: attachment.fileUrl,
          fileSize: attachment.fileSize,
          mimeType: attachment.mimeType,
          workDate: attachment.workDate ?? null,
          uploadedBy: user.id,
          uploadedAt,
          archivedBy: user.id,
          action: "INITIAL",
          createdAt: uploadedAt,
          user,
        });
        attachment.headVersionId = revision.id;
        paper.attachments = [...(paper.attachments ?? []), attachment];
        state.attachmentContents ??= {};
        state.attachmentContents[attachment.id] = content;
        addLog(
          state,
          projectId,
          "ATTACHMENT_UPLOADED",
          `上传文件 ${file.name}`,
          {
            targetType: "ATTACHMENT",
            targetId: attachment.id,
          }
        );
        return attachment;
      })
    ),
  createAttachmentPlaceholder: (
    projectId: string,
    paperId: string,
    input: CreateAttachmentPlaceholderInput
  ) =>
    withState((state) => {
      const paper = findWorkingPaper(state.workflows[projectId] ?? [], paperId);
      if (!paper) {
        throw mockError("Workpaper not found");
      }
      const user = getCurrentUser(state);
      const createdAt = new Date().toISOString();
      const config = ATTACHMENT_PLACEHOLDER_TYPES[input.placeholderType];
      const baseName =
        input.name.trim().replace(/\.[^.]+$/, "") || "Placeholder";
      const displayName = `${baseName}${config.extension}`;
      const attachment: Attachment = {
        id: mockEntityId("attachment"),
        workingPaperId: paper.id,
        workflowNodeId: paper.workflowNodeId,
        bucket: paper.bucket,
        code: paper.code,
        fileKind: "SUPPORTING",
        placeholderType: input.placeholderType,
        fileName: displayName,
        originalName: displayName,
        fileUrl: "",
        fileSize: 0,
        mimeType: config.mimeType,
        sortOrder: nextMockDirectoryAttachmentSortOrder(
          state,
          projectId,
          paper.workflowNodeId,
          paper.bucket ?? "CURRENT"
        ),
        version: 0,
        headVersionId: null,
        uploadedBy: user.id,
        lastModifiedBy: user.id,
        lastModifiedAt: createdAt,
        uploader: { id: user.id, name: user.name, email: user.email },
        lastModifier: { id: user.id, name: user.name, email: user.email },
      };
      paper.attachments = [...(paper.attachments ?? []), attachment];
      return attachment;
    }),
  replaceAttachmentPlaceholder: (
    projectId: string,
    attachmentId: string,
    file: File
  ) =>
    serializeMockAttachmentContent(file).then((content) =>
      withState((state) => {
        const attachment = findAttachment(
          state.workflows[projectId] ?? [],
          attachmentId
        );
        if (!attachment?.placeholderType) {
          throw mockError("This attachment is not an unfilled placeholder");
        }
        const actualType = getAttachmentPlaceholderTypeForFile(
          file.name,
          file.type
        );
        if (
          attachment.placeholderType !== "GENERIC" &&
          actualType !== attachment.placeholderType
        ) {
          throw mockError(
            `Select a ${attachment.placeholderType.toLowerCase()} file`
          );
        }
        const user = getCurrentUser(state);
        const modifiedAt = new Date().toISOString();
        const displayName = getAttachmentPlaceholderReplacementName(
          attachment.originalName ?? attachment.fileName,
          file.name
        );
        attachment.placeholderType = null;
        attachment.fileName = file.name;
        attachment.originalName = displayName;
        attachment.fileUrl = `mock://${attachment.workingPaperId ?? "unassigned"}/${file.name}`;
        attachment.fileSize = file.size;
        attachment.mimeType = file.type || "application/octet-stream";
        attachment.version = 1;
        attachment.lastModifiedBy = user.id;
        attachment.lastModifiedAt = modifiedAt;
        attachment.lastModifier = {
          id: user.id,
          name: user.name,
          email: user.email,
        };
        const revision = createMockAttachmentRevision(state, projectId, {
          attachmentId: attachment.id,
          version: 1,
          parentVersionId: null,
          sourceVersionId: null,
          fileKind: attachment.fileKind,
          fileName: file.name,
          originalName: displayName,
          fileUrl: attachment.fileUrl,
          fileSize: file.size,
          mimeType: attachment.mimeType,
          workDate: null,
          uploadedBy: user.id,
          uploadedAt: modifiedAt,
          archivedBy: user.id,
          action: "INITIAL",
          createdAt: modifiedAt,
          user,
        });
        attachment.headVersionId = revision.id;
        state.attachmentContents ??= {};
        state.attachmentContents[attachment.id] = content;
        return attachment;
      })
    ),
  lockAttachment: (projectId: string, attachmentId: string) =>
    withState((state) => {
      const attachment = findAttachment(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      if (!attachment) {
        throw mockError("文件不存在");
      }
      const user = getCurrentUser(state);
      lockAttachmentForUser(attachment, user);
      addLog(
        state,
        projectId,
        "ATTACHMENT_LOCKED",
        `锁定文件 ${attachment.fileName}`,
        {
          targetType: "ATTACHMENT",
          targetId: attachment.id,
        }
      );
      return attachment;
    }),
  unlockAttachment: (projectId: string, attachmentId: string) =>
    withState((state) => {
      const attachment = findAttachment(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      if (!attachment) {
        throw mockError("文件不存在");
      }
      attachment.lockedBy = null;
      attachment.lockedAt = null;
      attachment.lockExpiresAt = null;
      attachment.lockHolder = null;
      addLog(
        state,
        projectId,
        "ATTACHMENT_UNLOCKED",
        `解锁文件 ${attachment.fileName}`,
        {
          targetType: "ATTACHMENT",
          targetId: attachment.id,
        }
      );
      return attachment;
    }),
  uploadAttachmentNewVersion: (
    projectId: string,
    attachmentId: string,
    file: File,
    workDate?: string
  ) =>
    serializeMockAttachmentContent(file).then((content) =>
      withState((state) => {
        const attachment = findAttachment(
          state.workflows[projectId] ?? [],
          attachmentId
        );
        if (!attachment) {
          throw mockError("文件不存在");
        }
        const user = getCurrentUser(state);
        const modifiedAt = new Date().toISOString();
        requireMockAttachmentLock(attachment, user);
        const nextVersion = attachment.version + 1;
        const parentVersionId = resolveMockAttachmentHeadVersionId(
          state,
          projectId,
          attachment
        );
        attachment.fileName = file.name;
        attachment.originalName = file.name;
        attachment.fileUrl = `mock://${attachment.workingPaperId ?? "unassigned"}/${file.name}`;
        attachment.fileSize = file.size;
        attachment.mimeType = file.type || attachment.mimeType;
        attachment.version = nextVersion;
        attachment.workDate = normalizeMockWorkDate(workDate, modifiedAt);
        const revision = createMockAttachmentRevision(state, projectId, {
          attachmentId: attachment.id,
          version: nextVersion,
          parentVersionId,
          sourceVersionId: null,
          fileKind: attachment.fileKind,
          fileName: attachment.fileName,
          originalName: attachment.originalName,
          fileUrl: attachment.fileUrl,
          fileSize: attachment.fileSize,
          mimeType: attachment.mimeType,
          workDate: attachment.workDate ?? null,
          uploadedBy: user.id,
          uploadedAt: modifiedAt,
          archivedBy: user.id,
          action: "UPLOAD",
          createdAt: modifiedAt,
          user,
        });
        attachment.headVersionId = revision.id;
        state.attachmentContents ??= {};
        state.attachmentContents[attachment.id] = content;
        attachment.lockedBy = null;
        attachment.lockedAt = null;
        attachment.lockExpiresAt = null;
        attachment.lockHolder = null;
        attachment.uploadedBy = user.id;
        attachment.uploader = {
          id: user.id,
          name: user.name,
          email: user.email,
        };
        attachment.lastModifiedBy = user.id;
        attachment.lastModifiedAt = modifiedAt;
        attachment.lastModifier = {
          id: user.id,
          name: user.name,
          email: user.email,
        };
        addLog(
          state,
          projectId,
          "ATTACHMENT_VERSION_UPLOADED",
          `同步新版本 ${file.name}`,
          {
            targetType: "ATTACHMENT",
            targetId: attachment.id,
          }
        );
        return attachment;
      })
    ),
  deletedAttachments: (projectId: string) =>
    withState((state) => {
      state.deletedAttachments ??= {};
      normalizeWorkflowCodes(state.workflows[projectId] ?? []);
      return collectDeletedAttachments(
        state.workflows[projectId] ?? [],
        state.deletedAttachments[projectId] ?? []
      );
    }),
  projectAttachments: (projectId: string) =>
    withState((state) => {
      normalizeWorkflowCodes(state.workflows[projectId] ?? []);
      return collectProjectAttachments(state.workflows[projectId] ?? []);
    }),
  deleteAttachment: (projectId: string, attachmentId: string) =>
    withState((state) => {
      state.deletedAttachments ??= {};
      const location = findAttachmentLocation(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      if (!location) {
        throw mockError("文件不存在");
      }
      const user = getCurrentUser(state);
      const deletedAt = new Date().toISOString();
      location.attachment.workingPaperId = null;
      location.attachment.deletedAt = deletedAt;
      location.attachment.deletedBy = user.id;
      location.attachment.deletedByUser = {
        id: user.id,
        name: user.name,
        email: user.email,
      };
      location.attachment.deletedFromWorkingPaperId = location.paper.id;
      location.attachment.deletedFromWorkflowNodeId =
        location.paper.workflowNodeId;
      location.attachment.deletedFromWorkingPaperCode =
        normalizeCodeWithoutDigitFour(location.paper.code);
      location.attachment.deletedFromWorkingPaperTitle = location.paper.title;
      location.attachment.restoredAt = null;
      location.attachment.restoredBy = null;
      location.attachment.restoredByUser = null;
      location.attachment.lockedBy = null;
      location.attachment.lockedAt = null;
      location.attachment.lockExpiresAt = null;
      location.attachment.lockHolder = null;
      location.paper.attachments = (location.paper.attachments ?? []).filter(
        (item) => item.id !== attachmentId
      );
      state.deletedAttachments[projectId] = [
        ...(state.deletedAttachments[projectId] ?? []).filter(
          (item) => item.id !== attachmentId
        ),
        location.attachment,
      ];
      if (!location.paper.attachments.some((item) => !item.deletedAt)) {
        removeWorkingPaper(state.workflows[projectId] ?? [], location.paper.id);
      }
      addLog(state, projectId, "ATTACHMENT_DELETED", "删除文件", {
        targetType: "ATTACHMENT",
        targetId: attachmentId,
      });
      return location.attachment;
    }),
  renameAttachment: (
    projectId: string,
    attachmentId: string,
    input: RenameAttachmentInput
  ) =>
    withState((state) => {
      const attachment = findAttachment(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      if (!attachment) {
        throw mockError("File not found");
      }
      const user = getCurrentUser(state);
      const modifiedAt = new Date().toISOString();
      attachment.originalName = input.originalName.trim();
      attachment.lastModifiedBy = user.id;
      attachment.lastModifiedAt = modifiedAt;
      attachment.lastModifier = {
        id: user.id,
        name: user.name,
        email: user.email,
      };
      addLog(state, projectId, "ATTACHMENT_RENAMED", "Renamed attachment", {
        targetType: "ATTACHMENT",
        targetId: attachment.id,
      });
      return attachment;
    }),
  moveAttachment: (
    projectId: string,
    attachmentId: string,
    input: RelocateAttachmentInput
  ) =>
    withState((state) => {
      const location = findAttachmentLocation(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      const targetPaper = location
        ? resolveRelocationTargetPaper(
            projectId,
            state.workflows[projectId] ?? [],
            input,
            location.attachment
          )
        : null;
      if (!location || !targetPaper) {
        throw mockError("Move target not found");
      }
      const user = getCurrentUser(state);
      const modifiedAt = new Date().toISOString();
      const targetSortOrder = nextMockDirectoryAttachmentSortOrder(
        state,
        projectId,
        targetPaper.workflowNodeId,
        targetPaper.bucket ?? "CURRENT",
        attachmentId
      );
      location.paper.attachments = (location.paper.attachments ?? []).filter(
        (item) => item.id !== attachmentId
      );
      if (
        !(location.paper.attachments ?? []).some(
          (attachment) => !attachment.deletedAt
        )
      ) {
        removeWorkingPaper(state.workflows[projectId] ?? [], location.paper.id);
      }
      targetPaper.attachments = [
        ...(targetPaper.attachments ?? []),
        location.attachment,
      ];
      location.attachment.sortOrder = targetSortOrder;
      location.attachment.workingPaperId = targetPaper.id;
      applyAttachmentIdentityFromPaper(location.attachment, targetPaper);
      location.attachment.lastModifiedBy = user.id;
      location.attachment.lastModifiedAt = modifiedAt;
      location.attachment.lastModifier = {
        id: user.id,
        name: user.name,
        email: user.email,
      };
      addLog(state, projectId, "ATTACHMENT_MOVED", "Moved attachment", {
        targetType: "ATTACHMENT",
        targetId: attachmentId,
      });
      return location.attachment;
    }),
  copyAttachment: (
    projectId: string,
    attachmentId: string,
    input: RelocateAttachmentInput
  ) =>
    withState((state) => {
      const attachment = findAttachment(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      const targetPaper = attachment
        ? resolveRelocationTargetPaper(
            projectId,
            state.workflows[projectId] ?? [],
            input,
            attachment
          )
        : null;
      if (!attachment || !targetPaper) {
        throw mockError("Copy target not found");
      }
      const user = getCurrentUser(state);
      const modifiedAt = new Date().toISOString();
      const targetSortOrder = nextMockDirectoryAttachmentSortOrder(
        state,
        projectId,
        targetPaper.workflowNodeId,
        targetPaper.bucket ?? "CURRENT"
      );
      const copied: Attachment = {
        ...attachment,
        id: `attachment-copy-${Date.now()}`,
        workingPaperId: targetPaper.id,
        ...getAttachmentIdentityFromPaper(targetPaper),
        sortOrder: targetSortOrder,
        version: attachment.placeholderType ? 0 : 1,
        lockedBy: null,
        lockedAt: null,
        lockExpiresAt: null,
        lockHolder: null,
        deletedAt: null,
        deletedBy: null,
        deletedByUser: null,
        deletedFromWorkflowNodeId: null,
        restoredAt: null,
        restoredBy: null,
        restoredByUser: null,
        uploadedBy: user.id,
        uploader: { id: user.id, name: user.name, email: user.email },
        lastModifiedBy: user.id,
        lastModifiedAt: modifiedAt,
        lastModifier: { id: user.id, name: user.name, email: user.email },
      };
      targetPaper.attachments = [...(targetPaper.attachments ?? []), copied];
      addLog(state, projectId, "ATTACHMENT_COPIED", "Copied attachment", {
        targetType: "ATTACHMENT",
        targetId: copied.id,
      });
      return copied;
    }),
  restoreAttachment: (
    projectId: string,
    attachmentId: string,
    input: RestoreAttachmentInput = {}
  ) =>
    withState((state) => {
      state.deletedAttachments ??= {};
      const location = findAttachmentLocation(
        state.workflows[projectId] ?? [],
        attachmentId,
        {
          includeDeleted: true,
        }
      );
      const detachedAttachment = (
        state.deletedAttachments[projectId] ?? []
      ).find((item) => item.id === attachmentId);
      const attachment = location?.attachment ?? detachedAttachment;
      const targetNodeId = input.workflowNodeId?.trim();
      const targetNode = targetNodeId
        ? findNode(state.workflows[projectId] ?? [], targetNodeId)
        : null;
      if (targetNodeId && targetNode && attachment?.deletedAt) {
        const user = getCurrentUser(state);
        const targetPaper = createRestoreWorkingPaper(
          projectId,
          targetNode,
          attachment
        );
        attachRestoredAttachmentToPaper(
          state,
          projectId,
          attachmentId,
          attachment,
          location?.paper ?? null,
          targetPaper,
          user
        );
        return attachment;
      }
      if (targetNodeId && !targetNode) {
        throw mockError(
          "Please choose a project folder as the restore location",
          "RESTORE_TARGET_NOT_FOUND"
        );
      }
      if (!attachment?.deletedAt) {
        throw mockError("回收站文件不存在");
      }
      const originalNodeId =
        attachment.deletedFromWorkflowNodeId?.trim() ||
        findWorkingPaper(
          state.workflows[projectId] ?? [],
          input.workingPaperId?.trim() ||
            attachment.deletedFromWorkingPaperId ||
            ""
        )?.workflowNodeId ||
        null;
      if (!originalNodeId) {
        throw mockError(
          "原目录不存在，请选择新的恢复位置",
          "RESTORE_TARGET_REQUIRED"
        );
      }
      const originalNode = findNode(
        state.workflows[projectId] ?? [],
        originalNodeId
      );
      if (!originalNode) {
        throw mockError(
          "原目录不存在，请选择新的恢复位置",
          "RESTORE_TARGET_NOT_FOUND"
        );
      }
      const user = getCurrentUser(state);
      const targetPaper = createRestoreWorkingPaper(
        projectId,
        originalNode,
        attachment
      );
      attachRestoredAttachmentToPaper(
        state,
        projectId,
        attachmentId,
        attachment,
        location?.paper ?? null,
        targetPaper,
        user
      );
      return attachment;
    }),
  downloadAttachment: (projectId: string, attachmentId: string) =>
    withState((state) => {
      const attachment = findAttachment(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      if (!attachment) {
        throw mockError("文件不存在");
      }
      if (attachment.fileKind === "SMART_FORM") {
        addLog(
          state,
          projectId,
          "ATTACHMENT_READONLY_DOWNLOADED",
          `Download Smart Form PDF ${attachment.fileName}`,
          { targetType: "ATTACHMENT", targetId: attachment.id }
        );
        return smartFormPdfBlob(attachment.fileName);
      }
      const user = getCurrentUser(state);
      lockAttachmentForUser(attachment, user);
      addLog(
        state,
        projectId,
        "ATTACHMENT_LOCKED",
        `锁定文件 ${attachment.fileName}`,
        {
          targetType: "ATTACHMENT",
          targetId: attachment.id,
        }
      );
      const uploadedContent = state.attachmentContents?.[attachment.id];
      if (uploadedContent) {
        return uploadedContent;
      }
      if (/\.(xlsx|xls|xlsm|xlsb)$/i.test(attachment.fileName)) {
        return MOCK_XLSX_ATTACHMENT_CONTENT;
      }
      if (/\.pdf$/i.test(attachment.fileName)) {
        return MOCK_PDF_ATTACHMENT_CONTENT;
      }
      if (/\.(docx|doc)$/i.test(attachment.fileName)) {
        return MOCK_DOCX_ATTACHMENT_CONTENT;
      }
      if (/\.(pptx|ppt)$/i.test(attachment.fileName)) {
        return MOCK_PPTX_ATTACHMENT_CONTENT;
      }
      if (/\.(zip|rar|7z)$/i.test(attachment.fileName)) {
        return MOCK_ZIP_ATTACHMENT_CONTENT;
      }
      if (/\.png$/i.test(attachment.fileName)) {
        return MOCK_PNG_ATTACHMENT_CONTENT;
      }
      if (/\.eml$/i.test(attachment.fileName)) {
        return MOCK_EML_ATTACHMENT_CONTENT;
      }
      if (/\.(csv|tsv)$/i.test(attachment.fileName)) {
        return MOCK_CSV_ATTACHMENT_CONTENT;
      }
      const generatedPreview = createMockAssetPreviewBlob(attachment.fileName);
      if (generatedPreview) {
        return `${MOCK_ASSET_ATTACHMENT_PREFIX}${attachment.fileName}`;
      }
      return `Preview download for ${attachmentId}`;
    }).then((content) => {
      const rawContent: unknown = content;
      if (isMockAttachmentContent(rawContent)) {
        return mockAttachmentContentBlob(rawContent);
      }
      if (isMockAssetPreviewContent(rawContent)) {
        return (
          createMockAssetPreviewBlob(
            rawContent.slice(MOCK_ASSET_ATTACHMENT_PREFIX.length)
          ) ?? new Blob([rawContent])
        );
      }
      if (rawContent === MOCK_XLSX_ATTACHMENT_CONTENT) {
        return new Blob([mockXlsxPreviewBytes()], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
      }
      if (rawContent === MOCK_PDF_ATTACHMENT_CONTENT) {
        return createMockPdfPreviewBlob();
      }
      if (rawContent === MOCK_DOCX_ATTACHMENT_CONTENT) {
        return new Blob([mockDocxPreviewBytes()], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
      }
      if (rawContent === MOCK_PPTX_ATTACHMENT_CONTENT) {
        return new Blob([mockPptxPreviewBytes()], {
          type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        });
      }
      if (rawContent === MOCK_ZIP_ATTACHMENT_CONTENT) {
        return createMockZipPreviewBlob();
      }
      if (rawContent === MOCK_PNG_ATTACHMENT_CONTENT) {
        return createMockPngPreviewBlob();
      }
      if (rawContent === MOCK_EML_ATTACHMENT_CONTENT) {
        return new Blob([MOCK_EML_PREVIEW_CONTENT], { type: "message/rfc822" });
      }
      if (rawContent === MOCK_CSV_ATTACHMENT_CONTENT) {
        return new Blob([MOCK_CSV_PREVIEW_CONTENT], { type: "text/csv" });
      }
      return isBlobContent(rawContent)
        ? rawContent
        : new Blob([String(rawContent)]);
    }),
  downloadAttachmentReadOnly: (projectId: string, attachmentId: string) =>
    withState((state) => {
      const attachment = findAttachment(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      if (!attachment) {
        throw mockError("File not found");
      }
      addLog(
        state,
        projectId,
        "ATTACHMENT_READONLY_DOWNLOADED",
        `Read-only download ${attachment.fileName}`,
        { targetType: "ATTACHMENT", targetId: attachment.id }
      );
      if (attachment.fileKind === "SMART_FORM") {
        return smartFormPdfBlob(attachment.fileName);
      }
      return `Read-only download for ${attachmentId}`;
    }).then((content) =>
      content instanceof Blob ? content : new Blob([content])
    ),
  exportAttachment: (
    projectId: string,
    attachmentId: string,
    format: "original" | "pdf" | "zip"
  ) =>
    withState((state) => {
      const attachment = findAttachment(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      if (!attachment) {
        throw mockError("File not found");
      }
      addLog(
        state,
        projectId,
        "ATTACHMENT_EXPORTED",
        `Exported ${attachment.fileName} as ${format}`,
        { targetType: "ATTACHMENT", targetId: attachment.id }
      );
      if (format === "zip") {
        return {
          content: `ZIP export for ${attachmentId}`,
          mimeType: "application/zip",
          fileName: attachment.fileName,
        };
      }
      if (format === "pdf" || attachment.fileKind === "SMART_FORM") {
        return {
          content: `%PDF-1.7\n% Mock Smart Form PDF: ${attachment.fileName.replace(
            /\.sf$/i,
            ".pdf"
          )}\n`,
          mimeType: "application/pdf",
          fileName: attachment.fileName.replace(/\.sf$/i, ".pdf"),
        };
      }
      return {
        content: `Original export for ${attachmentId}`,
        mimeType: attachment.mimeType,
        fileName: attachment.fileName,
      };
    }).then(async ({ content, mimeType, fileName }) => {
      await Promise.resolve();
      if (mimeType === "application/zip") {
        const safeFileName =
          fileName
            .replaceAll(/[<>:"/\\|?*]/g, "_")
            .replaceAll(
              new RegExp(
                `[${String.fromCodePoint(0)}-${String.fromCodePoint(31)}]`,
                "g"
              ),
              "_"
            )
            .replace(/^\.+/, "")
            .trim() || "exported-file";
        const zip = new JSZip();
        zip.file(`Mock Project/Unassigned/${safeFileName}`, content);
        return zip.generateAsync({
          type: "blob",
          compression: "STORE",
          mimeType,
        });
      }
      return new Blob([content], { type: mimeType });
    }),
  createProjectFileExportJob: (
    projectId: string,
    input: CreateProjectFileExportJobInput
  ) =>
    (async () => {
      const state = loadState();
      const active = [...mockProjectFileExportJobs.values()].find(
        ({ job }) =>
          job.projectId === projectId &&
          ["QUEUED", "RUNNING"].includes(job.status)
      );
      if (active) {
        return active.job;
      }
      const attachmentIds = [
        ...new Set(
          input.scope === "ATTACHMENTS"
            ? input.attachmentIds
            : collectMockNodeAttachmentIds(
                state.workflows[projectId] ?? [],
                input.workflowNodeId,
                input.bucket
              )
        ),
      ];
      const attachments = attachmentIds
        .map((id) =>
          findMockExportAttachmentLocation(state.workflows[projectId] ?? [], id)
        )
        .filter((value): value is NonNullable<typeof value> => Boolean(value));
      if (
        input.scope === "ATTACHMENTS" &&
        attachments.length !== attachmentIds.length
      ) {
        throw mockError(
          "One or more selected files are unavailable.",
          "EXPORT_ATTACHMENT_NOT_FOUND"
        );
      }
      if (input.scope === "ATTACHMENTS") {
        const buckets = new Set(
          attachments.map(
            ({ paper, attachment }) =>
              attachment.bucket ?? paper?.bucket ?? "CURRENT"
          )
        );
        if (buckets.size !== 1) {
          throw mockError(
            "Selected files must belong to the same workpaper bucket.",
            "EXPORT_BUCKET_MISMATCH"
          );
        }
      }
      const project = findProject(state, projectId);
      if (!project) {
        throw mockError("项目不存在");
      }
      const projectRoot = mockSanitizePathSegment(
        `${project.projectCode} - ${project.name}`
      );
      const zip = new JSZip();
      if (input.scope === "WORKFLOW_NODE") {
        for (const directory of collectMockNodeDirectoryPaths(
          state.workflows[projectId] ?? [],
          input.workflowNodeId
        )) {
          zip.folder(
            `${projectRoot}/${directory
              .map((segment) => mockSanitizePathSegment(segment))
              .join("/")}`
          );
        }
      }
      const usedPaths = new Set<string>();
      for (const { path, paper, attachment } of attachments) {
        const sourceName = attachment.originalName ?? attachment.fileName;
        const refCode = attachment.code ?? paper?.code ?? "";
        const baseName = refCode
          ? sourceName.replace(/^[A-Za-z0-9][A-Za-z0-9-]*-F\d+\s+/i, "")
          : sourceName;
        let fileName = mockSanitizeFileName(
          refCode ? `${refCode} ${baseName}` : baseName
        );
        if (attachment.fileKind === "SMART_FORM") {
          fileName = mockReplaceExtension(fileName, ".pdf");
        }
        const directory =
          path.length > 0
            ? path.map((node) => mockSanitizePathSegment(node.code))
            : ["Unassigned"];
        const zipPath = mockUniqueZipPath(
          `${projectRoot}/${directory.join("/")}/${fileName}`,
          usedPaths
        );
        zip.file(
          zipPath,
          attachment.fileKind === "SMART_FORM"
            ? `%PDF-1.7\nMock Smart Form ${fileName}`
            : `Mock export ${attachment.id}`
        );
      }
      const now = new Date().toISOString();
      const blob = await zip.generateAsync({
        type: "blob",
        compression: "STORE",
        mimeType: "application/zip",
      });
      const job: ProjectFileExportJob = {
        id: `mock-file-export-${Date.now()}`,
        projectId,
        scope: input.scope,
        bucket:
          input.scope === "WORKFLOW_NODE"
            ? input.bucket
            : (attachments[0]?.attachment.bucket ??
              attachments[0]?.paper?.bucket ??
              "CURRENT"),
        workflowNodeId:
          input.scope === "WORKFLOW_NODE" ? input.workflowNodeId : null,
        status: "COMPLETED",
        currentPhase: "READY",
        completedFiles: attachments.length,
        totalFiles: attachments.length,
        totalSourceBytes: attachments.reduce(
          (sum, item) => sum + item.attachment.fileSize,
          0
        ),
        errorMessage: null,
        outputFileName: "mock-project-export.zip",
        outputFileSize: blob.size,
        createdAt: now,
        updatedAt: now,
        completedAt: now,
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      };
      mockProjectFileExportJobs.set(job.id, { job, blob });
      return job;
    })(),
  activeProjectFileExportJob: (projectId: string) =>
    Promise.resolve(
      [...mockProjectFileExportJobs.values()]
        .map(({ job }) => job)
        .filter(
          (job) =>
            job.projectId === projectId && isInFlightProjectFileExportJob(job)
        )
        .findLast(() => true) ?? null
    ),
  projectFileExportJob: (_projectId: string, jobId: string) => {
    const found = mockProjectFileExportJobs.get(jobId)?.job;
    return found
      ? Promise.resolve(found)
      : Promise.reject(mockError("Export job not found"));
  },
  retryProjectFileExportJob: (_projectId: string, jobId: string) => {
    const found = mockProjectFileExportJobs.get(jobId);
    if (!found) {
      return Promise.reject(mockError("Export job not found"));
    }
    found.job = {
      ...found.job,
      status: "COMPLETED",
      currentPhase: "READY",
      errorMessage: null,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return Promise.resolve(found.job);
  },
  watchProjectFileExportJob: (
    _projectId: string,
    jobId: string,
    onJob: ProjectFileExportJobEventHandler,
    options?: { signal?: AbortSignal }
  ) => {
    const found = mockProjectFileExportJobs.get(jobId)?.job;
    if (found && !options?.signal?.aborted) {
      onJob(found);
    }
    return Promise.resolve();
  },
  downloadProjectFileExportJob: (_projectId: string, jobId: string) => {
    const found = mockProjectFileExportJobs.get(jobId);
    if (!found) {
      return Promise.reject(mockError("Export job not found"));
    }
    found.job = {
      ...found.job,
      status: "DOWNLOADED",
      updatedAt: new Date().toISOString(),
    };
    return Promise.resolve(found.blob);
  },
  projectFileExportJobDownloadUrl: async (
    _projectId: string,
    jobId: string
  ) => {
    await Promise.resolve();
    const found = mockProjectFileExportJobs.get(jobId);
    if (!found) {
      throw mockError("Export job not found");
    }
    found.job = {
      ...found.job,
      status: "DOWNLOADED",
      updatedAt: new Date().toISOString(),
    };
    return blobToDataUrl(found.blob);
  },
  previewAttachmentContent: (
    projectId: string,
    attachmentId: string,
    _version?: number
  ) =>
    withState((state) => {
      const attachment = findAttachment(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      if (!attachment) {
        throw mockError("File not found");
      }
      addLog(
        state,
        projectId,
        "ATTACHMENT_READONLY_DOWNLOADED",
        `Previewed attachment ${attachment.fileName}`,
        { targetType: "ATTACHMENT", targetId: attachment.id }
      );
      if (attachment.fileKind === "SMART_FORM") {
        return smartFormPdfBlob(attachment.fileName);
      }
      const uploadedContent = state.attachmentContents?.[attachment.id];
      if (uploadedContent) {
        return uploadedContent;
      }
      if (/\.(xlsx|xls|xlsm|xlsb)$/i.test(attachment.fileName)) {
        return MOCK_XLSX_ATTACHMENT_CONTENT;
      }
      if (/\.pdf$/i.test(attachment.fileName)) {
        return MOCK_PDF_ATTACHMENT_CONTENT;
      }
      if (/\.(docx|doc)$/i.test(attachment.fileName)) {
        return MOCK_DOCX_ATTACHMENT_CONTENT;
      }
      if (/\.(pptx|ppt)$/i.test(attachment.fileName)) {
        return MOCK_PPTX_ATTACHMENT_CONTENT;
      }
      if (/\.(zip|rar|7z)$/i.test(attachment.fileName)) {
        return MOCK_ZIP_ATTACHMENT_CONTENT;
      }
      if (/\.png$/i.test(attachment.fileName)) {
        return MOCK_PNG_ATTACHMENT_CONTENT;
      }
      if (/\.eml$/i.test(attachment.fileName)) {
        return MOCK_EML_ATTACHMENT_CONTENT;
      }
      if (/\.(csv|tsv)$/i.test(attachment.fileName)) {
        return MOCK_CSV_ATTACHMENT_CONTENT;
      }
      const generatedPreview = createMockAssetPreviewBlob(attachment.fileName);
      if (generatedPreview) {
        return `${MOCK_ASSET_ATTACHMENT_PREFIX}${attachment.fileName}`;
      }
      return `Preview content for ${attachmentId}`;
    }).then((content) => {
      const rawContent: unknown = content;
      if (isMockAttachmentContent(rawContent)) {
        return mockAttachmentContentBlob(rawContent);
      }
      if (isMockAssetPreviewContent(rawContent)) {
        return (
          createMockAssetPreviewBlob(
            rawContent.slice(MOCK_ASSET_ATTACHMENT_PREFIX.length)
          ) ?? new Blob([rawContent])
        );
      }
      if (rawContent === MOCK_XLSX_ATTACHMENT_CONTENT) {
        return new Blob([mockXlsxPreviewBytes()], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
      }
      if (rawContent === MOCK_PDF_ATTACHMENT_CONTENT) {
        return createMockPdfPreviewBlob();
      }
      if (rawContent === MOCK_DOCX_ATTACHMENT_CONTENT) {
        return new Blob([mockDocxPreviewBytes()], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
      }
      if (rawContent === MOCK_PPTX_ATTACHMENT_CONTENT) {
        return new Blob([mockPptxPreviewBytes()], {
          type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        });
      }
      if (rawContent === MOCK_ZIP_ATTACHMENT_CONTENT) {
        return createMockZipPreviewBlob();
      }
      if (rawContent === MOCK_PNG_ATTACHMENT_CONTENT) {
        return createMockPngPreviewBlob();
      }
      if (rawContent === MOCK_EML_ATTACHMENT_CONTENT) {
        return new Blob([MOCK_EML_PREVIEW_CONTENT], { type: "message/rfc822" });
      }
      if (rawContent === MOCK_CSV_ATTACHMENT_CONTENT) {
        return new Blob([MOCK_CSV_PREVIEW_CONTENT], { type: "text/csv" });
      }
      return isBlobContent(rawContent)
        ? rawContent
        : new Blob([String(rawContent)]);
    }),
  previewAttachmentPdf: (projectId: string, attachmentId: string) =>
    withState((state) => {
      const attachment = findAttachment(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      if (!attachment) {
        throw mockError("File not found");
      }
      return attachment.fileKind === "SMART_FORM"
        ? smartFormPdfBlob(attachment.fileName)
        : createMockPdfPreviewBlob();
    }),
  previewAttachmentRasterPdfManifest: (
    _projectId: string,
    attachmentId: string
  ) =>
    Promise.resolve({
      attachmentId,
      version: 1,
      pageCount: 1,
      pageWidth: 595,
      pageHeight: 842,
      dpi: 150,
      mimeType: "image/png" as const,
    }),
  previewAttachmentRasterPdfPage: (
    _projectId: string,
    _attachmentId: string,
    _pageNumber: number,
    _dpi: number
  ) => Promise.resolve(new Blob(["mock preview page"], { type: "image/png" })),
  previewAttachment: (
    _projectId: string,
    attachmentId: string,
    input: {
      sheetIndex?: number;
      offset?: number;
      limit?: number;
      columnOffset?: number;
      columnLimit?: number;
      targetRow?: number;
    }
  ) =>
    Promise.resolve({
      attachmentId,
      fileName: "mock.xlsx",
      sheetNames: ["Sheet1"],
      sheetIndex: input.sheetIndex ?? 0,
      sheetName: "Sheet1",
      offset: input.offset ?? 0,
      limit: input.limit ?? 50,
      columnOffset: input.columnOffset ?? 0,
      columnLimit: input.columnLimit ?? 30,
      totalRows: 2,
      totalColumns: 2,
      rows: [
        { rowNumber: 1, cells: ["Account", "Balance"] },
        { rowNumber: 2, cells: ["Cash", "100"] },
      ],
      hasMore: false,
      hasMoreColumns: false,
    }),
  searchAttachmentPreview: (
    _projectId: string,
    _attachmentId: string,
    query: string
  ) => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const values = ["Account", "Balance", "Cash", "100"];
    const results = values.flatMap((value, index) =>
      value.toLocaleLowerCase().includes(normalizedQuery)
        ? [
            {
              columnIndex: index % 2,
              rowNumber: Math.floor(index / 2) + 1,
              sheetIndex: 0,
              value,
            },
          ]
        : []
    );
    return Promise.resolve({ results });
  },
  downloadAttachmentVersion: (
    projectId: string,
    attachmentId: string,
    versionId: string
  ) =>
    withState((state) => {
      const version = findMockAttachmentVersion(
        state,
        projectId,
        attachmentId,
        versionId
      );
      if (!version) {
        throw mockError("File version not found");
      }
      addLog(
        state,
        projectId,
        "ATTACHMENT_VERSION_DOWNLOADED",
        `Downloaded version ${version.version}`,
        { targetType: "ATTACHMENT", targetId: attachmentId }
      );
      return `Preview download for ${attachmentId} version ${version.version}`;
    }).then((content) => new Blob([content])),
  restoreAttachmentVersion: (
    projectId: string,
    attachmentId: string,
    versionId: string
  ) =>
    withState((state) => {
      const attachment = findAttachment(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      if (!attachment) {
        throw mockError("File not found");
      }
      const version = findMockAttachmentVersion(
        state,
        projectId,
        attachmentId,
        versionId
      );
      if (!version) {
        throw mockError("File version not found");
      }
      const user = getCurrentUser(state);
      const restoredAt = new Date().toISOString();
      if (
        attachment.lockedBy &&
        (!attachment.lockExpiresAt ||
          Date.parse(attachment.lockExpiresAt) > Date.now())
      ) {
        throw mockError("Release Master before resetting the head");
      }
      state.attachmentVersions ??= {};
      state.attachmentVersions[projectId] = (
        state.attachmentVersions[projectId] ?? []
      ).map((item) =>
        item.attachmentId === attachment.id
          ? { ...item, isCurrent: item.id === version.id }
          : item
      );
      attachment.fileKind = version.fileKind;
      attachment.fileName = version.fileName;
      attachment.originalName = version.originalName;
      attachment.fileUrl = version.fileUrl;
      attachment.fileSize = version.fileSize;
      attachment.mimeType = version.mimeType;
      attachment.version = version.version;
      attachment.headVersionId = version.id;
      attachment.workDate = version.workDate;
      attachment.lockedBy = null;
      attachment.lockedAt = null;
      attachment.lockExpiresAt = null;
      attachment.lockHolder = null;
      attachment.uploadedBy = version.uploadedBy ?? user.id;
      attachment.uploader = version.uploadedByUser ?? {
        id: user.id,
        name: user.name,
        email: user.email,
      };
      attachment.lastModifiedBy = user.id;
      attachment.lastModifiedAt = restoredAt;
      attachment.lastModifier = {
        id: user.id,
        name: user.name,
        email: user.email,
      };
      addLog(
        state,
        projectId,
        "ATTACHMENT_VERSION_RESTORED",
        `Restored version ${version.version}`,
        { targetType: "ATTACHMENT", targetId: attachmentId }
      );
      return attachment;
    }),
  attachmentHistory: (projectId: string, attachmentId: string) =>
    withState((state): AttachmentHistory => {
      const attachment = findAttachment(
        state.workflows[projectId] ?? [],
        attachmentId,
        {
          includeDeleted: true,
        }
      );
      if (!attachment) {
        throw mockError("文件不存在");
      }
      const events = (state.auditLogs[projectId] ?? []).filter(
        (log) =>
          log.targetType === "ATTACHMENT" && log.targetId === attachmentId
      );
      const versions = listMockAttachmentVersions(
        state,
        projectId,
        attachmentId
      );
      return { attachment, versions, events };
    }),
  attachmentConflicts: (projectId: string, attachmentId: string) =>
    withState((state): AttachmentConflictSummary => {
      const attachment = findAttachment(
        state.workflows[projectId] ?? [],
        attachmentId,
        {
          includeDeleted: true,
        }
      );
      if (!attachment) {
        throw mockError("文件不存在");
      }
      const candidates = listMockAttachmentVersions(
        state,
        projectId,
        attachmentId
      ).filter((version) => version.conflictState === "OPEN");
      return {
        frozen: Boolean(attachment.conflictFrozenAt),
        frozenAt: attachment.conflictFrozenAt,
        headVersionId: attachment.headVersionId,
        candidateVersionId: attachment.conflictCandidateVersionId,
        candidates,
      };
    }),
  resolveAttachmentConflict: (
    projectId: string,
    attachmentId: string,
    candidateVersionId: string,
    resolution: AttachmentConflictResolution
  ) =>
    withState((state) => {
      const attachment = findAttachment(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      if (!attachment) {
        throw mockError("文件不存在");
      }
      const versions = listMockAttachmentVersions(
        state,
        projectId,
        attachmentId
      );
      const candidate = versions.find(
        (version) =>
          version.id === candidateVersionId && version.conflictState === "OPEN"
      );
      if (!candidate) {
        throw mockError("冲突候选不存在或已解决");
      }
      const targetVersionId =
        resolution === "USE_CANDIDATE"
          ? candidate.id
          : resolution === "REVERT_TO_BASE"
            ? candidate.conflictBaseVersionId
            : attachment.headVersionId;
      const target = versions.find((version) => version.id === targetVersionId);
      if (!target) {
        throw mockError("冲突裁决目标版本不存在");
      }
      const resolvedAt = new Date().toISOString();
      state.attachmentVersions ??= {};
      state.attachmentVersions[projectId] = (
        state.attachmentVersions[projectId] ?? []
      ).map((version) =>
        version.attachmentId === attachmentId
          ? version.id === candidate.id
            ? {
                ...version,
                isCurrent: version.id === target.id,
                conflictState: "RESOLVED",
                conflictResolvedAt: resolvedAt,
                conflictResolution: resolution,
              }
            : { ...version, isCurrent: version.id === target.id }
          : version
      );
      Object.assign(attachment, {
        fileKind: target.fileKind,
        fileName: target.fileName,
        originalName: target.originalName,
        fileUrl: target.fileUrl,
        fileSize: target.fileSize,
        mimeType: target.mimeType,
        contentHash: target.contentHash,
        version: target.version,
        headVersionId: target.id,
        workDate: target.workDate,
        conflictFrozenAt: null,
        conflictCandidateVersionId: null,
        lockEpoch: (attachment.lockEpoch ?? 0) + 1,
        lastModifiedAt: resolvedAt,
      });
      addLog(
        state,
        projectId,
        "ATTACHMENT_CONFLICT_RESOLVED",
        `Resolved attachment conflict with ${resolution}`,
        { targetType: "ATTACHMENT", targetId: attachmentId }
      );
      return attachment;
    }),
  openZipMaster: (projectId: string, attachmentId: string) =>
    withState((state): ZipMasterOpenResponse => {
      const attachment = findAttachment(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      if (!attachment) {
        throw mockError("文件不存在");
      }
      if (attachment.lockedBy) {
        return {
          ok: false,
          code: "LOCKED_BY_OTHER",
          holderName: attachment.lockHolder?.name ?? "其他成员",
        };
      }
      const user = getCurrentUser(state);
      const lockSessionId = `mock-zip-lock-${attachment.id}`;
      attachment.lockedBy = user.id;
      attachment.lockSessionId = lockSessionId;
      attachment.lockHolder = {
        id: user.id,
        name: user.name,
        email: user.email,
      };
      return mockZipMasterSession(projectId, attachment, lockSessionId);
    }),
  readZip: (projectId: string, attachmentId: string) =>
    withState((state): ZipReadOnlyResponse => {
      const attachment = findAttachment(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      if (!attachment) {
        throw mockError("文件不存在");
      }
      return {
        ok: true,
        mode: "READ_ONLY",
        attachmentId: attachment.id,
        projectId,
        fileName: attachment.originalName ?? attachment.fileName,
        version: attachment.version,
        entries: mockZipEntries(),
      };
    }),
  downloadZipEntryReadOnly: (
    projectId: string,
    attachmentId: string,
    entryPath: string
  ) =>
    withState((state) => {
      const attachment = findAttachment(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      if (!attachment) {
        throw mockError("文件不存在");
      }
      return new Blob([`mock zip entry ${entryPath}`], {
        type: "application/octet-stream",
      });
    }),
  openZipEntryMaster: (
    projectId: string,
    sessionId: string,
    entryPath: string
  ) =>
    withState((state) => {
      const attachmentId = sessionId.replace(/^mock-zip-lock-/, "");
      const attachment = findAttachment(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      if (!attachment) {
        throw mockError("Zip Master session not found");
      }
      const fileName = entryPath.split("/").findLast(Boolean) ?? entryPath;
      return {
        ok: true as const,
        mode: "ZIP_ENTRY_MASTER" as const,
        projectId,
        attachmentId: attachment.id,
        zipMasterSessionId: sessionId,
        entryPath,
        fileName,
        mimeType: "application/octet-stream",
        fileSize: 1,
        lockSessionId: `mock-zip-entry-lock-${attachment.id}`,
        baseVersion: attachment.version,
        grantSecret: "mock-zip-entry-secret",
        downloadUrl: `/engagement/${projectId}/workflow/zip-master-sessions/${sessionId}/entries/download?path=${encodeURIComponent(entryPath)}`,
        heartbeatUrl: `/desktop/zip-entry-master-sessions/mock-zip-entry-lock-${attachment.id}/heartbeat`,
        checkInUrl: `/desktop/zip-entry-master-sessions/mock-zip-entry-lock-${attachment.id}/check-in`,
        releaseUrl: `/desktop/zip-entry-master-sessions/mock-zip-entry-lock-${attachment.id}/release`,
      };
    }),
  downloadZipSessionEntry: (
    projectId: string,
    sessionId: string,
    entryPath: string
  ) =>
    withState((state) => {
      const attachmentId = sessionId.replace(/^mock-zip-lock-/, "");
      const attachment = findAttachment(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      if (!attachment) {
        throw mockError("Zip Master session not found");
      }
      return new Blob([`mock zip draft entry ${entryPath}`], {
        type: "application/octet-stream",
      });
    }),
  addZipMasterOperation: addZipMasterOperationMock,
  closeZipMaster: (projectId: string, sessionId: string) =>
    withState((state): ZipMasterCloseResponse => {
      const attachmentId = sessionId.replace(/^mock-zip-lock-/, "");
      const attachment = findAttachment(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      if (!attachment) {
        throw mockError("Zip Master session not found");
      }
      attachment.lockedBy = null;
      attachment.lockSessionId = null;
      attachment.lockHolder = null;
      mockZipMasterEntries.delete(sessionId);
      return mockZipMasterClose(projectId, attachment, sessionId, true);
    }),
  discardZipMaster: (projectId: string, sessionId: string) =>
    withState((state): ZipMasterCloseResponse => {
      const attachmentId = sessionId.replace(/^mock-zip-lock-/, "");
      const attachment = findAttachment(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      if (!attachment) {
        throw mockError("Zip Master session not found");
      }
      attachment.lockedBy = null;
      attachment.lockSessionId = null;
      attachment.lockHolder = null;
      mockZipMasterEntries.delete(sessionId);
      return mockZipMasterClose(projectId, attachment, sessionId, false, true);
    }),
  prepareWorkingPaper: (projectId: string, paperId: string) =>
    withState((state) => {
      const paper = findWorkingPaper(state.workflows[projectId] ?? [], paperId);
      const user = getCurrentUser(state);
      if (!paper) {
        throw mockError("底稿不存在");
      }
      appendPaperSignoff(paper, "PREPARER", user);
      addLog(state, projectId, "WORKING_PAPER_PREPARED", "提交编制");
      if (paper.reviewerId) {
        addMockInboxMessage(state, {
          recipientId: paper.reviewerId,
          senderId: user.id,
          projectId,
          workingPaperId: paper.id,
          type: "SIGNOFF",
          title: `底稿已完成编制：${paper.code}`,
          body: `${user.name} 已编制签署底稿 ${paper.code} ${paper.title}。`,
        });
      }
      return paper;
    }),
  reviewWorkingPaper: (projectId: string, paperId: string) =>
    withState((state) => {
      const paper = findWorkingPaper(state.workflows[projectId] ?? [], paperId);
      const user = getCurrentUser(state);
      if (!paper) {
        throw mockError("底稿不存在");
      }
      appendPaperSignoff(paper, "REVIEWER", user);
      addLog(state, projectId, "WORKING_PAPER_REVIEWED", "完成复核");
      if (paper.preparerId) {
        addMockInboxMessage(state, {
          recipientId: paper.preparerId,
          senderId: user.id,
          projectId,
          workingPaperId: paper.id,
          type: "SIGNOFF",
          title: `底稿已完成复核：${paper.code}`,
          body: `${user.name} 已复核签署底稿 ${paper.code} ${paper.title}。`,
        });
      }
      return paper;
    }),
  prepareAttachment: (projectId: string, attachmentId: string) =>
    withState((state) => {
      const location = findAttachmentLocation(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      const user = getCurrentUser(state);
      if (!location) {
        throw mockError("文件不存在");
      }
      appendAttachmentSignoff(location, "PREPARER", user);
      addLog(state, projectId, "WORKING_PAPER_PREPARED", "提交编制", {
        targetType: "ATTACHMENT",
        targetId: attachmentId,
      });
      if (location.attachment.reviewerId) {
        addMockInboxMessage(state, {
          recipientId: location.attachment.reviewerId,
          senderId: user.id,
          projectId,
          workingPaperId: location.paper.id,
          type: "SIGNOFF",
          title: `底稿已完成编制：${location.attachment.code ?? location.paper.code}`,
          body: `${user.name} 已编制签署底稿 ${location.attachment.code ?? location.paper.code} ${
            location.attachment.title ??
            location.attachment.originalName ??
            location.attachment.fileName
          }。`,
        });
      }
      return location.attachment;
    }),
  removeWorkingPaperSignoff: (projectId: string, signoffId: string) =>
    withState((state) => {
      const location = findSignoffLocation(
        state.workflows[projectId] ?? [],
        signoffId
      );
      if (!location) {
        throw mockError("签核不存在");
      }
      const removedSignoff =
        location.paper.signoffs?.find((signoff) => signoff.id === signoffId) ??
        location.attachment?.signoffs?.find(
          (signoff) => signoff.id === signoffId
        );
      if (!removedSignoff) {
        throw mockError("签核不存在");
      }
      location.paper.signoffs = (location.paper.signoffs ?? []).filter(
        (signoff) => signoff.id !== signoffId
      );
      for (const attachment of location.paper.attachments ?? []) {
        attachment.signoffs = (attachment.signoffs ?? []).filter(
          (signoff) => signoff.id !== signoffId
        );
      }
      if (location.attachment) {
        syncSingleAttachmentPaperSignoffs({
          paper: location.paper,
          attachment: location.attachment,
        });
      }
      addLog(
        state,
        projectId,
        removedSignoff.type === "PREPARER"
          ? "WORKING_PAPER_PREPARE_SIGNOFF_REMOVED"
          : "WORKING_PAPER_REVIEW_SIGNOFF_REMOVED",
        `Removed ${removedSignoff.type.toLowerCase()} signoff`,
        {
          targetType: location.attachment ? "ATTACHMENT" : "WORKING_PAPER",
          targetId: location.attachment?.id ?? location.paper.id,
        }
      );
      return { id: signoffId };
    }),
  reviewAttachment: (projectId: string, attachmentId: string) =>
    withState((state) => {
      const location = findAttachmentLocation(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      const user = getCurrentUser(state);
      if (!location) {
        throw mockError("文件不存在");
      }
      appendAttachmentSignoff(location, "REVIEWER", user);
      addLog(state, projectId, "WORKING_PAPER_REVIEWED", "完成复核", {
        targetType: "ATTACHMENT",
        targetId: attachmentId,
      });
      if (location.attachment.preparerId) {
        addMockInboxMessage(state, {
          recipientId: location.attachment.preparerId,
          senderId: user.id,
          projectId,
          workingPaperId: location.paper.id,
          type: "SIGNOFF",
          title: `底稿已完成复核：${location.attachment.code ?? location.paper.code}`,
          body: `${user.name} 已复核签署底稿 ${location.attachment.code ?? location.paper.code} ${
            location.attachment.title ??
            location.attachment.originalName ??
            location.attachment.fileName
          }。`,
        });
      }
      return location.attachment;
    }),
  attachmentSignoffHistory: (projectId: string, attachmentId: string) =>
    withState((state): AttachmentSignoffHistory => {
      const location = findAttachmentLocation(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      if (!location) {
        throw mockError("文件不存在");
      }
      return getMockAttachmentSignoffHistory(location.attachment);
    }),
  revokeAttachmentSignoff: (
    projectId: string,
    attachmentId: string,
    signoffId: string,
    input: { reason: string }
  ) =>
    withState((state): AttachmentSignoffHistory => {
      const location = findAttachmentLocation(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      const user = getCurrentUser(state);
      const reason = input.reason.trim();
      if (!location) {
        throw mockError("文件不存在");
      }
      if (!reason) {
        throw mockError("撤销签核必须填写原因", "VALIDATION_FAILED");
      }
      const signoff = (location.attachment.signoffs ?? []).find(
        (entry) => entry.id === signoffId
      );
      if (!signoff) {
        throw mockError("签核记录不存在", "NOT_FOUND");
      }
      if (signoff.revokedAt) {
        throw mockError("该签核已撤销", "VALIDATION_FAILED");
      }
      if (
        signoff.user.id !== user.id &&
        user.globalRole !== "SUPER_ADMIN" &&
        user.globalRole !== "PARTNER"
      ) {
        throw mockError("只有签核人或项目 Partner 可以撤销签核", "FORBIDDEN");
      }
      signoff.isCurrent = false;
      signoff.revokedAt = new Date().toISOString();
      signoff.revokedBy = { id: user.id, name: user.name, email: user.email };
      signoff.revocationReason = reason;
      refreshMockCurrentSignoffRound(location.attachment);
      syncSingleAttachmentPaperSignoffs(location);
      addLog(state, projectId, "WORKING_PAPER_SIGNOFF_REVOKED", "撤销签核", {
        targetType: "ATTACHMENT",
        targetId: attachmentId,
      });
      return getMockAttachmentSignoffHistory(location.attachment);
    }),
  returnWorkingPaper: (
    projectId: string,
    paperId: string,
    _input: ReturnWorkingPaperInput
  ) =>
    withState((state) => {
      const paper = findWorkingPaper(state.workflows[projectId] ?? [], paperId);
      if (!paper) {
        throw mockError("底稿不存在");
      }
      addLog(state, projectId, "WORKING_PAPER_RETURNED", "提出复核意见");
      return paper;
    }),
  createWorkingPaperQuestion: (
    projectId: string,
    paperId: string,
    input: CreateWorkingPaperQuestionInput
  ) =>
    withState((state) => {
      const paper = findWorkingPaper(state.workflows[projectId] ?? [], paperId);
      const project = findProject(state, projectId);
      const user = getCurrentUser(state);
      const assignee = input.assignedToId
        ? (project?.members?.find(
            (member) => member.user.id === input.assignedToId
          )?.user ?? null)
        : null;
      if (!paper) {
        throw mockError("Review note target not found");
      }
      const now = new Date().toISOString();
      const questionId = `question-${Date.now()}`;
      const question: WorkingPaperQuestion = {
        id: questionId,
        projectId,
        workingPaperId: paper.id,
        smartFormNodeId: input.smartFormNodeId ?? null,
        smartFormRowId: input.smartFormRowId ?? null,
        smartFormTargetLabel: input.smartFormTargetLabel ?? null,
        body: input.body.trim(),
        status: "OPEN",
        assignedToId: assignee?.id ?? "",
        createdById: user.id,
        createdAt: now,
        updatedAt: now,
        assignedTo: assignee
          ? { id: assignee.id, name: assignee.name, email: assignee.email }
          : null,
        createdBy: { id: user.id, name: user.name, email: user.email },
        messages: [
          {
            id: `question-message-${Date.now()}`,
            questionId,
            authorId: user.id,
            messageType: "QUESTION",
            body: input.body.trim(),
            createdAt: now,
            author: { id: user.id, name: user.name, email: user.email },
          },
        ],
      };
      paper.reviewQuestions = [question, ...(paper.reviewQuestions ?? [])];
      addLog(
        state,
        projectId,
        "WORKING_PAPER_QUESTION_CREATED",
        "Create review note"
      );
      if (assignee) {
        addMockInboxMessage(state, {
          recipientId: assignee.id,
          senderId: user.id,
          projectId,
          workingPaperId: paper.id,
          reviewQuestionId: question.id,
          reviewQuestion: question,
          type: "REVIEW_QUESTION",
          title: `复核注释待回复：${paper.code}`,
          body: `${user.name} 指派你处理底稿 ${paper.code} ${paper.title} 的复核注释：${notificationExcerpt(question.body)}`,
        });
      }
      return question;
    }),
  createAttachmentQuestion: (
    projectId: string,
    attachmentId: string,
    input: CreateWorkingPaperQuestionInput
  ) =>
    withState((state) => {
      const location = findAttachmentLocation(
        state.workflows[projectId] ?? [],
        attachmentId
      );
      const project = findProject(state, projectId);
      const user = getCurrentUser(state);
      const assignee = input.assignedToId
        ? (project?.members?.find(
            (member) => member.user.id === input.assignedToId
          )?.user ?? null)
        : null;
      if (!location) {
        throw mockError("Review note target not found");
      }
      const now = new Date().toISOString();
      const questionId = `question-${Date.now()}`;
      const fileCode = location.attachment.code ?? location.paper.code;
      const fileTitle =
        location.attachment.title ??
        location.attachment.originalName ??
        location.attachment.fileName;
      const question: WorkingPaperQuestion = {
        id: questionId,
        projectId,
        workingPaperId: location.paper.id,
        attachmentId,
        smartFormNodeId: input.smartFormNodeId ?? null,
        smartFormRowId: input.smartFormRowId ?? null,
        smartFormTargetLabel: input.smartFormTargetLabel ?? null,
        body: input.body.trim(),
        status: "OPEN",
        assignedToId: assignee?.id ?? "",
        createdById: user.id,
        createdAt: now,
        updatedAt: now,
        assignedTo: assignee
          ? { id: assignee.id, name: assignee.name, email: assignee.email }
          : null,
        createdBy: { id: user.id, name: user.name, email: user.email },
        messages: [
          {
            id: `question-message-${Date.now()}`,
            questionId,
            authorId: user.id,
            messageType: "QUESTION",
            body: input.body.trim(),
            createdAt: now,
            author: { id: user.id, name: user.name, email: user.email },
          },
        ],
      };
      location.attachment.reviewQuestions = [
        question,
        ...(location.attachment.reviewQuestions ?? []),
      ];
      const activeAttachments = (location.paper.attachments ?? []).filter(
        (attachment) => !attachment.deletedAt
      );
      if (activeAttachments.length <= 1) {
        location.paper.reviewQuestions = location.attachment.reviewQuestions;
      }
      addLog(
        state,
        projectId,
        "WORKING_PAPER_QUESTION_CREATED",
        "Create review note",
        {
          targetType: "ATTACHMENT",
          targetId: attachmentId,
        }
      );
      if (assignee) {
        addMockInboxMessage(state, {
          recipientId: assignee.id,
          senderId: user.id,
          projectId,
          workingPaperId: location.paper.id,
          reviewQuestionId: question.id,
          reviewQuestion: question,
          type: "REVIEW_QUESTION",
          title: `复核注释待回复：${fileCode}`,
          body: `${user.name} 指派你处理底稿 ${fileCode} ${fileTitle} 的复核注释：${notificationExcerpt(question.body)}`,
        });
      }
      return question;
    }),
  uploadReviewQuestionImage: (
    projectId: string,
    questionId: string,
    file: File
  ): Promise<ConfirmReviewQuestionImageInput> =>
    Promise.resolve({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "image/png",
      objectKey: `review-question-images/${projectId}/${questionId}/${Date.now()}-${file.name}`,
    }),
  downloadReviewQuestionImage: () =>
    Promise.resolve(new Blob(["mock image"], { type: "image/png" })),
  attachWorkingPaperQuestionInitialMessage: (
    projectId: string,
    questionId: string,
    images: ConfirmReviewQuestionImageInput[]
  ) =>
    withState((state) => {
      const question = findReviewQuestion(
        state.workflows[projectId] ?? [],
        questionId
      );
      if (!question) {
        throw mockError("Review note not found");
      }
      const message = question.messages?.find(
        (item) => item.messageType === "QUESTION"
      );
      if (!message) {
        throw mockError("Original review note message not found");
      }
      message.images = [
        ...(message.images ?? []),
        ...images.map((image, index) => ({
          id: `question-image-${Date.now()}-${index}`,
          messageId: message.id,
          fileName: image.fileName,
          originalName: image.fileName,
          objectKey: image.objectKey,
          fileSize: image.fileSize,
          mimeType: image.mimeType,
          width: image.width,
          height: image.height,
          createdAt: new Date().toISOString(),
        })),
      ];
      return question;
    }),
  replyWorkingPaperQuestion: (
    projectId: string,
    questionId: string,
    input: ReplyWorkingPaperQuestionInput
  ) =>
    withState((state) => {
      const question = findReviewQuestion(
        state.workflows[projectId] ?? [],
        questionId
      );
      const user = getCurrentUser(state);
      if (!question) {
        throw mockError("Review note not found");
      }
      if (
        question.assignedToId &&
        question.assignedToId !== user.id &&
        question.createdById !== user.id
      ) {
        throw mockError(
          "Only the assigned member can reply to this review note"
        );
      }
      if (question.status !== "OPEN" && question.status !== "REPLIED") {
        throw mockError("This review note cannot be replied to now");
      }
      const body = input.replyBody?.trim() ?? "";
      const images: ReviewQuestionMessageImage[] = (input.images ?? []).map(
        (image, index) => ({
          id: `question-image-${Date.now()}-${index}`,
          messageId: `question-message-${Date.now()}`,
          fileName: image.fileName,
          originalName: image.fileName,
          objectKey: image.objectKey,
          fileSize: image.fileSize,
          mimeType: image.mimeType,
          width: image.width ?? null,
          height: image.height ?? null,
          createdAt: new Date().toISOString(),
        })
      );
      if (!body && images.length === 0) {
        throw mockError("Message requires text or image");
      }
      const now = new Date().toISOString();
      const isQuestionCreator = question.createdById === user.id;
      const replyIsFollowUp =
        isQuestionCreator && question.status === "REPLIED";
      const messageId = `question-message-${Date.now()}`;
      question.updatedAt = now;
      question.messages = [
        ...(question.messages ?? []),
        {
          id: messageId,
          questionId,
          authorId: user.id,
          messageType: replyIsFollowUp ? "FOLLOW_UP" : "REPLY",
          body,
          createdAt: now,
          author: { id: user.id, name: user.name, email: user.email },
          images: images.map((image) => ({ ...image, messageId })),
        },
      ];
      addLog(
        state,
        projectId,
        "WORKING_PAPER_QUESTION_REPLIED",
        "Reply review note"
      );
      if (!isQuestionCreator) {
        addMockInboxMessage(state, {
          recipientId: question.createdById,
          senderId: user.id,
          projectId,
          workingPaperId: question.workingPaperId,
          reviewQuestionId: question.id,
          reviewQuestion: question,
          type: "REVIEW_REPLY",
          title: `复核注释已回复`,
          body: `${user.name} 回复了复核注释：${notificationExcerpt(question.body)}`,
        });
      } else if (replyIsFollowUp && question.assignedToId) {
        addMockInboxMessage(state, {
          recipientId: question.assignedToId,
          senderId: user.id,
          projectId,
          workingPaperId: question.workingPaperId,
          reviewQuestionId: question.id,
          reviewQuestion: question,
          type: "REVIEW_FOLLOW_UP",
          title: `复核注释需补充`,
          body: `${user.name} 继续追问复核注释：${notificationExcerpt(question.body)}`,
        });
      }
      return question;
    }),
  markWorkingPaperQuestionReplied: (projectId: string, questionId: string) =>
    withState((state) => {
      const question = findReviewQuestion(
        state.workflows[projectId] ?? [],
        questionId
      );
      const user = getCurrentUser(state);
      if (!question) {
        throw mockError("Review note not found");
      }
      if (
        question.assignedToId &&
        question.assignedToId !== user.id &&
        question.createdById !== user.id
      ) {
        throw mockError(
          "Only the assigned member can mark this review note as replied",
          "FORBIDDEN"
        );
      }
      if (question.status !== "OPEN") {
        throw mockError(
          "Only open review notes can be marked as replied",
          "BAD_REQUEST"
        );
      }
      const now = new Date().toISOString();
      question.status = "REPLIED";
      question.repliedById = user.id;
      question.repliedBy = {
        id: user.id,
        name: user.name,
        email: user.email,
      };
      question.repliedAt = now;
      question.clearedById = null;
      question.clearedBy = null;
      question.clearedAt = null;
      question.updatedAt = now;
      addLog(
        state,
        projectId,
        "WORKING_PAPER_QUESTION_REPLIED",
        "Mark review note replied"
      );
      addMockInboxMessage(state, {
        recipientId: question.createdById,
        senderId: user.id,
        projectId,
        workingPaperId: question.workingPaperId,
        reviewQuestionId: question.id,
        reviewQuestion: question,
        type: "REVIEW_REPLY",
        title: "Review note marked replied",
        body: `${user.name} marked a review note as replied: ${notificationExcerpt(question.body)}`,
      });
      return question;
    }),
  followUpWorkingPaperQuestion: (
    projectId: string,
    questionId: string,
    input: FollowUpWorkingPaperQuestionInput
  ) =>
    withState((state) => {
      const question = findReviewQuestion(
        state.workflows[projectId] ?? [],
        questionId
      );
      const user = getCurrentUser(state);
      if (!question) {
        throw mockError("Review note not found");
      }
      if (question.createdById !== user.id) {
        throw mockError("Only the review note creator can follow up");
      }
      if (question.status !== "REPLIED") {
        throw mockError("Only replied review notes can be followed up");
      }
      const now = new Date().toISOString();
      question.status = "OPEN";
      question.updatedAt = now;
      question.messages = [
        ...(question.messages ?? []),
        {
          id: `question-message-${Date.now()}`,
          questionId,
          authorId: user.id,
          messageType: "FOLLOW_UP",
          body: input.body.trim(),
          createdAt: now,
          author: { id: user.id, name: user.name, email: user.email },
        },
      ];
      addLog(
        state,
        projectId,
        "WORKING_PAPER_QUESTION_FOLLOWED_UP",
        "Follow up review note"
      );
      if (question.assignedToId) {
        addMockInboxMessage(state, {
          recipientId: question.assignedToId,
          senderId: user.id,
          projectId,
          workingPaperId: question.workingPaperId,
          reviewQuestionId: question.id,
          reviewQuestion: question,
          type: "REVIEW_FOLLOW_UP",
          title: `复核注释需补充`,
          body: `${user.name} 继续追问复核注释：${notificationExcerpt(question.body)}`,
        });
      }
      return question;
    }),
  clearWorkingPaperQuestion: (projectId: string, questionId: string) =>
    withState((state) => {
      const question = findReviewQuestion(
        state.workflows[projectId] ?? [],
        questionId
      );
      const user = getCurrentUser(state);
      if (!question) {
        throw mockError("Review note not found");
      }
      if (question.createdById !== user.id) {
        throw mockError("Only the review note creator can clear it");
      }
      if (question.status === "CLEARED") {
        throw mockError("This review note is already cleared");
      }
      const now = new Date().toISOString();
      question.status = "CLEARED";
      question.clearedById = user.id;
      question.clearedBy = { id: user.id, name: user.name, email: user.email };
      question.clearedAt = now;
      question.updatedAt = now;
      addLog(
        state,
        projectId,
        "WORKING_PAPER_QUESTION_CLEARED",
        "Clear review note"
      );
      return question;
    }),
  reopenWorkingPaperQuestion: (
    projectId: string,
    questionId: string,
    input: FollowUpWorkingPaperQuestionInput
  ) =>
    withState((state) => {
      const question = findReviewQuestion(
        state.workflows[projectId] ?? [],
        questionId
      );
      const user = getCurrentUser(state);
      if (!question) {
        throw mockError("Review note not found");
      }
      if (question.createdById !== user.id) {
        throw mockError("Only the review note creator can reopen it");
      }
      if (question.status !== "CLEARED") {
        throw mockError("Only cleared review notes can be reopened");
      }
      const now = new Date().toISOString();
      question.status = "OPEN";
      question.reopenedById = user.id;
      question.reopenedBy = { id: user.id, name: user.name, email: user.email };
      question.reopenedAt = now;
      question.clearedById = null;
      question.clearedBy = null;
      question.clearedAt = null;
      question.updatedAt = now;
      question.messages = [
        ...(question.messages ?? []),
        {
          id: `question-message-${Date.now()}`,
          questionId,
          authorId: user.id,
          messageType: "REOPEN",
          body: input.body.trim(),
          createdAt: now,
          author: { id: user.id, name: user.name, email: user.email },
        },
      ];
      addLog(
        state,
        projectId,
        "WORKING_PAPER_QUESTION_REOPENED",
        "Re-open review note"
      );
      if (question.assignedToId) {
        addMockInboxMessage(state, {
          recipientId: question.assignedToId,
          senderId: user.id,
          projectId,
          workingPaperId: question.workingPaperId,
          reviewQuestionId: question.id,
          reviewQuestion: question,
          type: "REVIEW_REOPENED",
          title: `复核注释已重开`,
          body: `${user.name} 重新打开复核注释：${notificationExcerpt(question.body)}`,
        });
      }
      return question;
    }),
  auditLogs: (projectId: string) =>
    withState((state) => state.auditLogs[projectId] ?? []),
  users: (input: UserListQueryInput = {}) =>
    withState((state) => filterUsers(state.users, input)),
  createUser: (input: CreateUserInput) =>
    withState((state) => {
      if (
        state.users.some(
          (user) => user.email.toLowerCase() === input.email.toLowerCase()
        )
      ) {
        throw mockError("该邮箱已被使用", "EMAIL_ALREADY_EXISTS");
      }
      const user: User = {
        id: `user-${Date.now()}`,
        email: input.email,
        name: input.name,
        globalRole: input.globalRole,
        status: "ACTIVE",
      };
      state.users.unshift(user);
      return user;
    }),
  updateUser: (id: string, input: UpdateUserInput) => updateUser(id, input),
  userRoleImpact,
  resetPassword: (id: string) =>
    withState((state) => {
      const user = state.users.find((item) => item.id === id);
      if (!user) {
        throw mockError("用户不存在");
      }
      return { temporaryPassword: "Preview123!", user };
    }),
  roles: () =>
    Promise.resolve([
      role("role-super-admin", "SUPER_ADMIN", "Super Admin", "GLOBAL"),
      role(
        "role-confirmation-officer",
        "CONFIRMATION_OFFICER",
        "Confirmation Officer",
        "GLOBAL"
      ),
      role("role-principal", "PRINCIPAL", "Principal", "GLOBAL"),
      role("role-manager", "MANAGER", "Manager", "GLOBAL"),
      role("role-senior", "SENIOR", "Senior", "GLOBAL"),
      role("role-staff", "STAFF", "Staff", "GLOBAL"),
      role("role-tax-expert", "TAX_EXPERT", "N/A", "GLOBAL"),
      role("role-partner", "PARTNER", "Partner", "PROJECT"),
      role("role-reviewer", "REVIEWER", "Reviewer", "PROJECT"),
      role("role-preparer", "PREPARER", "Preparer", "PROJECT"),
      role("role-eqcr", "EQCR", "EQR", "PROJECT"),
      role("role-tax-reviewer", "TAX_REVIEWER", "Expert", "PROJECT"),
    ]),
};

function filterUsers(users: User[], input: UserListQueryInput) {
  const q = input.q?.trim().toLowerCase();
  return users.filter((user) => {
    if (input.globalRole && user.globalRole !== input.globalRole) {
      return false;
    }
    if (input.status && (user.status ?? "ACTIVE") !== input.status) {
      return false;
    }
    if (!q) {
      return true;
    }
    return (
      user.email.toLowerCase().includes(q) ||
      user.name.toLowerCase().includes(q)
    );
  });
}

function role(id: string, code: string, name: string, scope: string) {
  return { id, code, name, scope, rolePermissions: [] };
}

function pickProjectConfirmationProject(project: Project) {
  return {
    id: project.id,
    name: project.name,
    projectCode: project.projectCode,
    reportDate: project.reportDate,
    status: project.status,
  };
}

function requireTemplateLibraryAdmin(state: MockState) {
  if (getCurrentUser(state).globalRole !== "SUPER_ADMIN") {
    throw mockError(
      "Only system administrators can maintain templates",
      "FORBIDDEN"
    );
  }
}

function findProjectTemplate(templates: ProjectTemplate[], templateId: string) {
  const template = templates.find(
    (item) => item.id === templateId && item.status !== "ARCHIVED"
  );
  if (!template) {
    throw mockError("Project template not found");
  }
  return template;
}

function findSmartFormTemplate(
  templates: SmartFormTemplate[],
  templateId: string
) {
  const template = templates.find(
    (item) => item.id === templateId && item.status !== "ARCHIVED"
  );
  if (!template) {
    throw mockError("Smart Form template not found");
  }
  return template;
}

function assertUniqueSmartFormTemplateCode(
  state: MockState,
  code: string,
  exceptTemplateId?: string
) {
  const normalized = code.trim().toLowerCase();
  const duplicate = state.smartFormTemplates.find(
    (item) =>
      item.id !== exceptTemplateId &&
      item.status !== "ARCHIVED" &&
      item.code.trim().toLowerCase() === normalized
  );
  if (duplicate) {
    throw mockError("Smart Form template code already exists");
  }
}

function assertUniqueProjectTemplateCode(
  state: MockState,
  code: string,
  exceptTemplateId?: string
) {
  const normalizedCode = code.trim();
  const duplicate = state.projectTemplates.some(
    (template) =>
      template.status !== "ARCHIVED" &&
      template.id !== exceptTemplateId &&
      template.code.toLowerCase() === normalizedCode.toLowerCase()
  );
  if (duplicate) {
    throw mockError("Project template code already exists", "DUPLICATE_CODE");
  }
}

function findProjectTemplateNode(template: ProjectTemplate, nodeId: string) {
  const node = template.nodes?.find((item) => item.id === nodeId);
  if (!node) {
    throw mockError("Project template folder not found");
  }
  return node;
}

function requireNumericProjectTemplateFolderCode(code: string) {
  const normalized = code.trim().replaceAll(/\s*-\s*/g, "-");
  if (!/^\d{1,4}$|^\d+(?:-\d+)+$/.test(normalized)) {
    throw mockError(
      "Project template folder code must be numeric before its items can be renumbered",
      "VALIDATION_FAILED"
    );
  }
  return normalized;
}

function buildNumericProjectTemplateItemCode(
  folderCode: string,
  sequence: number
) {
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw mockError(
      "Project template item sequence must be a positive integer",
      "VALIDATION_FAILED"
    );
  }
  return `${requireNumericProjectTemplateFolderCode(folderCode)}.${sequence}`;
}

function buildProjectTemplateDefaultItemCode(
  folderCode: string,
  sequence: number
) {
  const numericCode = folderCode.trim().replaceAll(/\s*-\s*/g, "-");
  return /^\d{1,4}$|^\d+(?:-\d+)+$/.test(numericCode)
    ? `${numericCode}.${sequence}`
    : `${folderCode.trim()}-F${formatNumberWithoutDigitFour(sequence, 3)}`;
}

function assertMockTemplateItemCodeAvailable(
  node: ProjectTemplateNode,
  code: string,
  exceptId: string
) {
  const duplicate = [...(node.files ?? []), ...(node.smartForms ?? [])].some(
    (item) =>
      item.id !== exceptId &&
      item.code.trim().toLowerCase() === code.trim().toLowerCase()
  );
  if (duplicate) {
    throw mockError("Template folder already has this code", "DUPLICATE_CODE");
  }
}

function refreshProjectTemplateCounts(template: ProjectTemplate) {
  const nodes = template.nodes ?? [];
  template._count = {
    nodes: nodes.length,
    files: nodes.reduce((total, node) => total + (node.files?.length ?? 0), 0),
    smartForms: nodes.reduce(
      (total, node) => total + (node.smartForms?.length ?? 0),
      0
    ),
  };
  template.updatedAt = new Date().toISOString();
}

function toTemplateTargetNode(node: WorkflowNode) {
  const code = normalizeCodeWithoutDigitFour(node.code);
  return {
    id: node.id,
    code,
    title: node.title === node.code ? code : node.title,
    level: node.level,
  };
}

function filterProjectTemplates(
  state: MockState,
  input: ProjectTemplateListQueryInput,
  includeAllStatuses = false
) {
  const q = input.q?.trim().toLowerCase();
  return state.projectTemplates
    .filter((template) =>
      includeAllStatuses
        ? template.status !== "ARCHIVED"
        : template.status === "PUBLISHED"
    )
    .filter(
      (template) =>
        !q ||
        template.code.toLowerCase().includes(q) ||
        template.name.toLowerCase().includes(q) ||
        Boolean(template.description?.toLowerCase().includes(q))
    );
}

function filterSmartFormTemplates(
  state: MockState,
  input: SmartFormTemplateListQueryInput,
  includeAllStatuses = false
) {
  const q = input.q?.trim().toLowerCase();
  return state.smartFormTemplates
    .filter((template) =>
      includeAllStatuses
        ? template.status !== "ARCHIVED"
        : template.status === "PUBLISHED" && template.currentPublishedVersionId
    )
    .filter(
      (template) =>
        !input.frameworkTemplateId ||
        template.frameworkTemplateId === input.frameworkTemplateId ||
        template.frameworkTemplateId === null
    )
    .filter(
      (template) =>
        !q ||
        template.code.toLowerCase().includes(q) ||
        template.name.toLowerCase().includes(q) ||
        Boolean(template.description?.toLowerCase().includes(q))
    );
}

function requireProjectTemplateApplyContext(
  state: MockState,
  projectId: string,
  templateId: string,
  input: ApplyProjectTemplateInput
) {
  const project = findProject(state, projectId);
  if (!project) {
    throw mockError("Project not found");
  }
  const template = state.projectTemplates.find(
    (item) => item.id === templateId && item.status === "PUBLISHED"
  );
  if (!template) {
    throw mockError(
      "Project template is not available",
      "PROJECT_TEMPLATE_NOT_FOUND"
    );
  }
  const targetNode = findNode(
    state.workflows[projectId] ?? [],
    input.workflowNodeId
  );
  if (!targetNode) {
    throw mockError("Choose a folder before applying a template");
  }
  const allFiles = getProjectTemplateFiles(template);
  const allSmartForms = getProjectTemplateSmartForms(template);
  const selectedIds = new Set(input.selectedTemplateFileIds);
  const selectedSmartFormIds = new Set(input.selectedSmartFormReferenceIds);
  const files =
    selectedIds.size > 0
      ? allFiles.filter((file) => selectedIds.has(file.id))
      : [];
  const smartForms =
    selectedSmartFormIds.size > 0
      ? allSmartForms.filter((item) => selectedSmartFormIds.has(item.id))
      : [];
  if (selectedIds.size > 0 && files.length !== selectedIds.size) {
    throw mockError("Selected template files are not available");
  }
  if (
    selectedSmartFormIds.size > 0 &&
    smartForms.length !== selectedSmartFormIds.size
  ) {
    throw mockError("Selected Smart Form templates are not available");
  }
  if (files.length === 0 && smartForms.length === 0) {
    throw mockError("Selected template has no files or Smart Forms");
  }
  return { project, template, targetNode, files, smartForms };
}

function buildRollForwardPreviewSummary(
  nodes: WorkflowNode[],
  attachmentVersions: MockState["attachmentVersions"]
) {
  let attachmentVersionCount = 0;
  let attachments = 0;
  let smartForms = 0;
  let workflowNodes = 0;
  let workingPapers = 0;

  const visit = (items: WorkflowNode[]) => {
    for (const node of items) {
      workflowNodes += 1;
      for (const paper of node.workingPapers ?? []) {
        workingPapers += 1;
        for (const attachment of paper.attachments ?? []) {
          if (attachment.deletedAt) {
            continue;
          }
          attachments += 1;
          attachmentVersionCount +=
            attachmentVersions[attachment.id]?.length || 1;
          if (attachment.fileKind === "SMART_FORM") {
            smartForms += 1;
          }
        }
      }
      visit(node.children ?? []);
    }
  };
  visit(nodes);

  return {
    workflowNodes,
    workingPapers,
    attachments,
    attachmentVersions: attachmentVersionCount,
    smartForms,
  };
}

function buildProjectTemplateApplyPlan(
  targetNode: WorkflowNode,
  files: ProjectTemplateFile[],
  smartForms: ProjectTemplateSmartForm[],
  input: ApplyProjectTemplateInput
): ProjectTemplateApplyPlan {
  const plannedCodes: Pick<WorkingPaper, "code">[] = [
    ...(targetNode.workingPapers ?? []),
  ];
  const referenceCodeByItemId = new Map(
    (input.referenceCodeOverrides ?? []).map((item) => [item.itemId, item.code])
  );
  const items: ProjectTemplateApplyPlan["items"] = [];
  const smartFormItems: ProjectTemplateApplyPlan["smartFormItems"] = [];
  const orderedItems = [
    ...files.map((item) => ({ type: "FILE" as const, item })),
    ...smartForms.map((item) => ({ type: "SMART_FORM" as const, item })),
  ].sort(
    (left, right) =>
      left.item.templateNodeId.localeCompare(right.item.templateNodeId) ||
      left.item.sortOrder - right.item.sortOrder ||
      left.item.code.localeCompare(right.item.code)
  );
  for (const orderedItem of orderedItems) {
    if (orderedItem.type === "FILE") {
      const file = orderedItem.item;
      const targetBucket = input.bucket ?? "CURRENT";
      const displayTitle = getProjectTemplateDisplayTitle(file);
      const plannedCode =
        referenceCodeByItemId.get(file.id) ??
        buildNextWorkingPaperCode(targetNode.code, plannedCodes);
      plannedCodes.push({ code: plannedCode });
      items.push({
        templateFileId: file.id,
        templateNodeId: file.templateNodeId,
        sourceCode: file.code,
        title: displayTitle,
        originalName: file.originalName,
        paperType: file.paperType,
        bucket: targetBucket,
        status: "CREATE" as const,
        plannedCode,
        existingWorkingPaper: null,
      });
    } else {
      const smartForm = orderedItem.item;
      const targetBucket = "CURRENT" as const;
      const displayTitle = getProjectTemplateSmartFormDisplayTitle(smartForm);
      const originalName = normalizeSmartFormFileName(
        smartForm.fileName || smartForm.title
      );
      const plannedCode =
        referenceCodeByItemId.get(smartForm.id) ??
        buildNextWorkingPaperCode(targetNode.code, plannedCodes);
      plannedCodes.push({ code: plannedCode });
      smartFormItems.push({
        smartFormReferenceId: smartForm.id,
        templateNodeId: smartForm.templateNodeId,
        smartFormTemplateVersionId: smartForm.smartFormTemplateVersionId,
        sourceCode: smartForm.code,
        title: displayTitle,
        originalName,
        paperType: "WORKING_PAPER" as const,
        bucket: targetBucket,
        status: "CREATE" as const,
        plannedCode,
        existingWorkingPaper: null,
      });
    }
  }
  const createFiles = items.filter((item) => item.status === "CREATE").length;
  const createSmartForms = smartFormItems.filter(
    (item) => item.status === "CREATE"
  ).length;
  const existingFiles = 0;
  const existingSmartForms = 0;
  return {
    summary: {
      total: items.length + smartFormItems.length,
      files: items.length,
      smartForms: smartFormItems.length,
      create: createFiles + createSmartForms,
      existing: existingFiles + existingSmartForms,
      createFiles,
      createSmartForms,
      existingFiles,
      existingSmartForms,
    },
    items,
    smartFormItems,
  };
}

function getProjectTemplateFiles(template: ProjectTemplate) {
  return (template.nodes ?? []).flatMap((node) => node.files ?? []);
}

function getProjectTemplateSmartForms(template: ProjectTemplate) {
  return (template.nodes ?? []).flatMap((node) => node.smartForms ?? []);
}

function normalizeSmartFormFileName(title: string) {
  const trimmed = title.trim() || "Smart Form";
  return trimmed.toLowerCase().endsWith(".sf") ? trimmed : `${trimmed}.sf`;
}

function smartFormPdfBlob(fileName: string) {
  const pdfName = fileName.replace(/\.sf$/i, ".pdf");
  return new Blob([`%PDF-1.7\n% Mock Smart Form PDF: ${pdfName}\n`], {
    type: "application/pdf",
  });
}

function isBlobContent(value: unknown): value is Blob {
  return (
    value instanceof Blob ||
    (typeof value === "object" &&
      value !== null &&
      "arrayBuffer" in value &&
      typeof value.arrayBuffer === "function")
  );
}

function getProjectTemplateSmartFormDisplayTitle(
  smartForm: ProjectTemplateSmartForm
) {
  return normalizeSmartFormFileName(
    getProjectTemplateDisplayTitle({
      code: smartForm.code,
      title: smartForm.title || smartForm.fileName,
    })
  );
}

function getProjectTemplateDisplayTitle(item: { code: string; title: string }) {
  return getDisplayTitleFromCode(item.code, item.title);
}

function getDisplayTitleFromCode(code: string, title: string) {
  const titleValue = title.trim();
  const codeValue = code.trim();
  if (!titleValue || !codeValue) {
    return titleValue || codeValue;
  }
  if (isReferenceCodeText(titleValue)) {
    return codeValue;
  }
  const titleWithoutCode = stripProjectTemplateCodePrefix(
    titleValue,
    codeValue
  );
  return titleWithoutCode || codeValue;
}

function stripProjectTemplateCodePrefix(titleValue: string, code: string) {
  const codePattern = code
    .trim()
    .split(/\s*-\s*/g)
    .filter(Boolean)
    .map(escapeRegExp)
    .join(String.raw`\s*-\s*`);
  if (!codePattern) {
    return titleValue;
  }
  if (new RegExp(`^${codePattern}$`, "i").test(titleValue)) {
    return "";
  }
  const prefixMatch = titleValue.match(
    new RegExp(
      `^${codePattern}\\s*(?:-|\\u2013|\\u2014|:|\\uFF1A)\\s*(.+)$`,
      "i"
    )
  );
  if (!prefixMatch) {
    return stripLegacyReferenceCodePrefix(titleValue) ?? titleValue;
  }
  const remainingTitle = prefixMatch[1].trim();
  return stripLegacyReferenceCodePrefix(remainingTitle) ?? remainingTitle;
}

function stripLegacyReferenceCodePrefix(title: string) {
  const parts = title
    .split(LEGACY_REFERENCE_TITLE_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0 || !isReferenceCodeStart(parts[0])) {
    return null;
  }
  if (parts.every(isReferenceCodePart)) {
    return "";
  }
  let prefixCount = 0;
  while (
    prefixCount < parts.length - 1 &&
    isReferenceCodePart(parts[prefixCount])
  ) {
    prefixCount += 1;
  }
  return prefixCount > 0 ? parts.slice(prefixCount).join(" - ").trim() : null;
}

function isReferenceCodeStart(value: string) {
  return (
    /^[A-Za-z]$/i.test(value) ||
    /^[A-Za-z]{1,3}\d+[A-Za-z]?$/i.test(value) ||
    /^F\d{1,5}$/i.test(value)
  );
}

function isReferenceCodePart(value: string) {
  return isReferenceCodeStart(value) || /^\d{1,6}$/.test(value);
}

function isReferenceCodeText(value: string) {
  const parts = value
    .trim()
    .split(/\s*-\s*/g)
    .filter(Boolean);
  return (
    parts.length > 0 &&
    isReferenceCodeStart(parts[0]) &&
    parts.every(isReferenceCodePart)
  );
}

const LEGACY_REFERENCE_TITLE_SEPARATOR =
  /\s*(?:[:\uFF1A]|[\u2013\u2014]+|\s+-\s+|\s*-\s+|\s+-\s*)\s*/g;

function escapeRegExp(value: string) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function createMockSmartFormPackage(
  smartForm: ProjectTemplateSmartForm,
  timestamp: string,
  language?: SmartFormLocale
): SmartFormPackage {
  const version = smartForm.smartFormTemplateVersion;
  const template = smartForm.smartFormTemplate;
  const templateDefinition =
    version?.definitionJson ?? template?.draftDefinitionJson;
  if (!templateDefinition) {
    throw mockError(
      "Smart Form V2 template definition is missing",
      "NOT_FOUND"
    );
  }
  const definition = compileSmartFormV2Definition(
    templateDefinition,
    STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY
  );
  return {
    packageType: "PROJECT_WING_SMART_FORM",
    formatVersion: 2,
    template: {
      id: smartForm.smartFormTemplateId,
      versionId: smartForm.smartFormTemplateVersionId,
      code: template?.code ?? smartForm.code,
      title: template?.name ?? smartForm.title,
      publishedAt: version?.publishedAt ?? timestamp,
      language,
    },
    definition,
    response: createEmptyMockSmartFormResponse(
      definition.id,
      language ?? definition.i18n.defaultLocale,
      timestamp
    ),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildMockSmartFormRead(
  attachment: Attachment,
  smartFormPackage?: SmartFormPackage
): SmartFormReadResponse {
  const pkg =
    smartFormPackage ??
    mockSmartFormPackages.get(attachment.id) ??
    createFallbackSmartFormPackage(
      attachment.originalName ?? attachment.fileName,
      attachment.lastModifiedAt ?? new Date().toISOString()
    );
  const definition = compileSmartFormV2Definition(
    pkg.definition,
    STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY
  );
  const validation = validateSmartFormV2Response(definition, pkg.response);
  return {
    attachment,
    package: pkg,
    completion: {
      complete: validation.success,
      issues: validation.success ? [] : validation.issues,
    },
  };
}

function buildMockSmartFormSession(
  attachment: Attachment,
  lockSessionId: string,
  smartFormPackage?: SmartFormPackage
): SmartFormSessionResponse {
  return {
    ...buildMockSmartFormRead(attachment, smartFormPackage),
    lockSessionId,
  };
}

function createFallbackSmartFormPackage(
  title: string,
  timestamp: string
): SmartFormPackage {
  const normalizedTitle = title.replace(/\.sf$/i, "").trim();
  const template = defaultSmartFormTemplates.find(
    (item) =>
      item.name.trim().toLocaleLowerCase() ===
      normalizedTitle.toLocaleLowerCase()
  );
  if (template?.currentPublishedVersion) {
    const definition = compileSmartFormV2Definition(
      template.currentPublishedVersion.definitionJson,
      STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY
    );
    return {
      packageType: "PROJECT_WING_SMART_FORM",
      formatVersion: 2,
      template: {
        id: template.id,
        versionId: template.currentPublishedVersion.id,
        code: template.code,
        title: template.name,
        publishedAt: template.currentPublishedVersion.publishedAt,
      },
      definition,
      response: createEmptyMockSmartFormResponse(
        definition.id,
        definition.i18n.defaultLocale,
        timestamp
      ),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  throw mockError(`Smart Form V2 template not found: ${title}`, "NOT_FOUND");
}

function createEmptyMockSmartFormResponse(
  definitionVersionId: string,
  responseLocale: string,
  updatedAt: string
) {
  return {
    kind: "smartFormResponse" as const,
    schemaVersion: 2 as const,
    definitionVersionId,
    responseLocale,
    updatedAt,
    fields: {},
    sheets: {},
  };
}

function requireSmartFormMockLock(
  attachment: Attachment,
  lockSessionId: string
) {
  if (attachment.lockSessionId !== lockSessionId) {
    throw mockError("Smart Form lock is not active", "BAD_REQUEST");
  }
}

function buildArchiveCheckReport(
  state: MockState,
  projectId: string
): ArchiveCheckReport {
  const project = findProject(state, projectId);
  if (!project) {
    throw mockError("Project not found");
  }
  const workflow = state.workflows[projectId] ?? [];
  const papers = collectWorkingPapers(workflow).filter(
    (paper) => (paper.bucket ?? "CURRENT") === "CURRENT"
  );
  const issues: ArchiveCheckReport["issues"] = [];
  for (const paper of papers) {
    const code = normalizeCodeWithoutDigitFour(paper.code);
    const workingPaper = {
      id: paper.id,
      code,
      title: paper.title === paper.code ? code : paper.title,
    };
    const activeAttachments = currentMockAttachments(paper);
    for (const attachment of activeAttachments) {
      const attachmentName = attachment.originalName ?? attachment.fileName;
      const fileLabel = `${paper.code} ${attachmentName}`;
      const baseLocation = {
        attachmentId: attachment.id,
        attachmentName,
        projectPath: formatMockWorkingPaperProjectPath(
          workflow,
          paper.workflowNodeId,
          code
        ),
      };
      const attachmentSummary = {
        id: attachment.id,
        name: attachmentName,
      };
      const attachmentSignoffs = mockAttachmentSignoffs(paper, attachment);
      const preparerSignoffs = attachmentSignoffs.filter(
        (signoff) => signoff.type === "PREPARER"
      );
      const reviewerSignoffs = attachmentSignoffs.filter(
        (signoff) => signoff.type === "REVIEWER"
      );
      const latestPreparer = latestMockSignoff(preparerSignoffs);
      const latestReviewer = latestMockSignoff(reviewerSignoffs);
      if (!latestPreparer) {
        issues.push({
          type: "MISSING_PREPARER_SIGNOFF",
          severity: "BLOCKER",
          message: `${fileLabel} has no preparer sign-off`,
          workingPaper,
          attachment: attachmentSummary,
          location: baseLocation,
          action: {
            type: "OPEN_SIGNOFF",
            workingPaperId: paper.id,
            attachmentId: attachment.id,
          },
        });
      }
      if (!latestReviewer) {
        issues.push({
          type: "MISSING_REVIEWER_SIGNOFF",
          severity: "BLOCKER",
          message: `${fileLabel} has no reviewer sign-off`,
          workingPaper,
          attachment: attachmentSummary,
          location: baseLocation,
          action: {
            type: "OPEN_SIGNOFF",
            workingPaperId: paper.id,
            attachmentId: attachment.id,
          },
        });
      }
      if (
        latestPreparer &&
        latestReviewer &&
        new Date(latestReviewer.signedAt).getTime() <=
          new Date(latestPreparer.signedAt).getTime()
      ) {
        issues.push({
          type: "REVIEW_SIGNOFF_BEFORE_PREPARER",
          severity: "BLOCKER",
          message: `${fileLabel} reviewer sign-off is not after preparer sign-off`,
          workingPaper,
          attachment: attachmentSummary,
          member: latestReviewer.user,
          location: {
            ...baseLocation,
            excerpt: `Preparer: ${latestPreparer.signedAt}; Reviewer: ${latestReviewer.signedAt}`,
          },
          action: {
            type: "OPEN_SIGNOFF",
            workingPaperId: paper.id,
            attachmentId: attachment.id,
          },
        });
      }
      if (
        latestPreparer &&
        latestReviewer &&
        latestPreparer.user.id === latestReviewer.user.id
      ) {
        issues.push({
          type: "SELF_REVIEWED_WORKING_PAPER",
          severity: "BLOCKER",
          message: `${fileLabel} was prepared and reviewed by ${latestReviewer.user.name}`,
          workingPaper,
          attachment: attachmentSummary,
          member: latestReviewer.user,
          location: baseLocation,
          action: {
            type: "OPEN_SIGNOFF",
            workingPaperId: paper.id,
            attachmentId: attachment.id,
          },
        });
      }
      for (const question of mockAttachmentQuestions(paper, attachment)) {
        if (question.status === "CLEARED") {
          continue;
        }
        issues.push({
          type: "OPEN_REVIEW_QUESTION",
          severity: "BLOCKER",
          message: `${fileLabel} has an unresolved review note`,
          workingPaper,
          attachment: attachmentSummary,
          location: baseLocation,
          reviewQuestion: {
            id: question.id,
            status: question.status,
            assignedTo: question.assignedTo ?? null,
          },
          action: {
            type: "OPEN_REVIEW_QUESTION",
            workingPaperId: paper.id,
            attachmentId: attachment.id,
            reviewQuestionId: question.id,
          },
        });
      }
      if (attachment.lockedBy) {
        issues.push({
          type: "LOCKED_ATTACHMENT",
          severity: "BLOCKER",
          message: `${paper.code} has a file currently held by Master`,
          workingPaper,
          attachment: {
            id: attachment.id,
            name: attachmentName,
            lockedBy: attachment.lockHolder ?? null,
            lockedAt: attachment.lockedAt ?? null,
          },
          location: baseLocation,
          action: {
            type: "OPEN_ATTACHMENT",
            workingPaperId: paper.id,
            attachmentId: attachment.id,
          },
        });
      }
      if (isIncompleteMockSmartFormAttachment(attachment)) {
        issues.push({
          type: "SMART_FORM_INCOMPLETE",
          severity: "BLOCKER",
          message: `${paper.code} ${attachmentName} is an incomplete Smart Form`,
          workingPaper,
          attachment: {
            id: attachment.id,
            name: attachmentName,
          },
          location: baseLocation,
          action: {
            type: "OPEN_ATTACHMENT",
            workingPaperId: paper.id,
            attachmentId: attachment.id,
          },
        });
      }
    }
  }
  const blockers = issues.filter((issue) => issue.severity === "BLOCKER");
  const attachmentCount = papers.reduce(
    (total, paper) => total + currentMockAttachments(paper).length,
    0
  );
  return {
    project: {
      id: project.id,
      projectCode: project.projectCode,
      name: project.name,
    },
    generatedAt: new Date().toISOString(),
    ready: blockers.length === 0,
    summary: {
      attachments: attachmentCount,
      blockers: blockers.length,
      warnings: issues.filter((issue) => issue.severity === "WARNING").length,
      missingPreparerSignoffs: issues.filter(
        (issue) => issue.type === "MISSING_PREPARER_SIGNOFF"
      ).length,
      missingReviewerSignoffs: issues.filter(
        (issue) => issue.type === "MISSING_REVIEWER_SIGNOFF"
      ).length,
      signoffDateIssues: issues.filter(
        (issue) => issue.type === "REVIEW_SIGNOFF_BEFORE_PREPARER"
      ).length,
      selfReviewedAttachments: issues.filter(
        (issue) => issue.type === "SELF_REVIEWED_WORKING_PAPER"
      ).length,
      unresolvedReviewQuestions: issues.filter(
        (issue) => issue.type === "OPEN_REVIEW_QUESTION"
      ).length,
      lockedAttachments: issues.filter(
        (issue) => issue.type === "LOCKED_ATTACHMENT"
      ).length,
      incompleteSmartForms: issues.filter(
        (issue) => issue.type === "SMART_FORM_INCOMPLETE"
      ).length,
      officeFileIssues: issues.filter(
        (issue) =>
          issue.type === "DOCX_TRACK_CHANGES" ||
          issue.type === "DOCX_UNRESOLVED_COMMENT" ||
          issue.type === "XLSX_UNRESOLVED_COMMENT" ||
          issue.type === "XLSX_ERROR_VALUE" ||
          issue.type === "OFFICE_FILE_CHECK_FAILED"
      ).length,
    },
    issues,
  };
}

function isIncompleteMockSmartFormAttachment(attachment: Attachment) {
  if (attachment.fileKind !== "SMART_FORM") {
    return false;
  }
  const pkg =
    mockSmartFormPackages.get(attachment.id) ??
    createFallbackSmartFormPackage(
      attachment.originalName ?? attachment.fileName,
      attachment.lastModifiedAt ?? new Date().toISOString()
    );
  const definition = compileSmartFormV2Definition(
    pkg.definition,
    STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY
  );
  return !validateSmartFormV2Response(definition, pkg.response).success;
}

function buildCompletedArchiveCheckJob(
  projectId: string,
  report: ArchiveCheckReport,
  jobId = mockEntityId("archive-check-job")
): ArchiveCheckJobSnapshot {
  const now = new Date().toISOString();
  const groupIds: ArchiveCheckJobSnapshot["progress"]["groups"][number]["id"][] =
    [
      "signoffs",
      "reviewQuestions",
      "workpaperFiles",
      "officeFiles",
      "finalizing",
    ];
  const groups: ArchiveCheckJobSnapshot["progress"]["groups"] = groupIds.map(
    (id) => ({
      id,
      label: id,
      completedUnits: 1,
      totalUnits: 1,
      status: "completed",
    })
  );
  return {
    jobId,
    projectId,
    status: "completed",
    currentPhase: "finalizing",
    progress: {
      completedUnits: groups.length,
      totalUnits: groups.length,
      groups,
    },
    report,
    createdAt: now,
    updatedAt: now,
  };
}

function buildCompletedArchiveJob(
  state: MockState,
  projectId: string,
  report: ArchiveCheckReport,
  jobId = mockEntityId("archive-job")
): ArchiveJobSnapshot {
  const now = new Date().toISOString();
  const project = findProject(state, projectId);
  if (!project) {
    throw mockError("Project not found");
  }
  project.status = "ARCHIVED";
  addLog(state, projectId, "PROJECT_ARCHIVED", "归档项目");
  const artifact = buildMockArchiveArtifact(
    projectId,
    project.projectCode,
    getCurrentUser(state).id
  );
  mockArchiveArtifacts.set(projectId, artifact);
  const actorId = getCurrentUser(state).id;
  for (const member of project.members ?? []) {
    addMockInboxMessage(state, {
      recipientId: member.user.id,
      senderId: member.user.id === actorId ? null : actorId,
      projectId,
      type: "SYSTEM_NOTIFICATION",
      title: `Project successfully archived: ${project.projectCode}`,
      body: `${project.projectCode} has been successfully archived. The archive package is ready to download.`,
      actionUrl: `/engagement/${projectId}`,
    });
  }
  return {
    jobId,
    projectId,
    status: "completed",
    currentPhase: "finalizing",
    progress: { completedUnits: 4, totalUnits: 4 },
    artifact,
    createdAt: now,
    updatedAt: now,
  };
}

function buildFailedArchiveJob(
  projectId: string,
  report: ArchiveCheckReport,
  jobId = mockEntityId("archive-job")
): ArchiveJobSnapshot {
  const now = new Date().toISOString();
  return {
    jobId,
    projectId,
    status: "failed",
    currentPhase: "fileCheck",
    currentLabel: "Archive File Check",
    progress: { completedUnits: 1, totalUnits: 4 },
    error: {
      message: `Archive File Check failed with ${report.summary.blockers} blocker(s)`,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function buildMockArchiveArtifact(
  projectId: string,
  projectCode: string,
  createdBy: string
): ProjectArchiveArtifact {
  const now = new Date().toISOString();
  return {
    id: mockEntityId("archive-artifact"),
    projectId,
    fileName: `${projectCode}-archive.zip`,
    objectKey: `project-archives/${projectId}/${projectCode}-archive.zip`,
    fileSize: 1024,
    mimeType: "application/zip",
    createdBy,
    createdAt: now,
  };
}

function currentMockAttachments(paper: WorkingPaper) {
  return (paper.attachments ?? []).filter(
    (attachment) =>
      !attachment.deletedAt &&
      (attachment.bucket ?? paper.bucket ?? "CURRENT") === "CURRENT"
  );
}

function mockAttachmentSignoffs(
  paper: WorkingPaper,
  attachment: Attachment
): WorkingPaperSignoff[] {
  const explicit = attachment.signoffs ?? [];
  const paperScoped = (paper.signoffs ?? []).filter(
    (signoff) => signoff.attachmentId === attachment.id
  );
  return uniqueById([...explicit, ...paperScoped]).filter(
    (signoff) => signoff.isCurrent !== false && !signoff.revokedAt
  );
}

function mockAttachmentQuestions(
  paper: WorkingPaper,
  attachment: Attachment
): WorkingPaperQuestion[] {
  const explicit = attachment.reviewQuestions ?? [];
  const paperScoped = (paper.reviewQuestions ?? []).filter(
    (question) => question.attachmentId === attachment.id
  );
  return uniqueById([...explicit, ...paperScoped]);
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function latestMockSignoff<T extends { signedAt: string }>(signoffs: T[]) {
  return [...signoffs].sort(
    (a, b) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime()
  )[0];
}

function collectWorkingPapers(nodes: WorkflowNode[]): WorkingPaper[] {
  return nodes.flatMap((node) => [
    ...node.workingPapers,
    ...collectWorkingPapers(node.children ?? []),
  ]);
}

function findWorkingPaper(
  nodes: WorkflowNode[],
  paperId: string
): WorkingPaper | null {
  for (const node of nodes) {
    const paper = node.workingPapers.find((item) => item.id === paperId);
    if (paper) {
      return paper;
    }
    const childPaper = findWorkingPaper(node.children ?? [], paperId);
    if (childPaper) {
      return childPaper;
    }
  }
  return null;
}

function resolveRelocationTargetPaper(
  projectId: string,
  nodes: WorkflowNode[],
  input: RelocateAttachmentInput,
  attachment: Attachment
): WorkingPaper | null {
  const targetWorkingPaperId = input.workingPaperId?.trim();
  if (targetWorkingPaperId) {
    return null;
  }
  const targetWorkflowNodeId = input.workflowNodeId?.trim();
  if (!targetWorkflowNodeId || !input.bucket) {
    return null;
  }
  const targetNode = findNode(nodes, targetWorkflowNodeId);
  if (!targetNode) {
    return null;
  }
  return createRestoreWorkingPaper(
    projectId,
    targetNode,
    attachment,
    input.bucket
  );
}

function removeWorkingPaper(nodes: WorkflowNode[], paperId: string): boolean {
  for (const node of nodes) {
    const nextPapers = node.workingPapers.filter((item) => item.id !== paperId);
    if (nextPapers.length !== node.workingPapers.length) {
      node.workingPapers = nextPapers;
      return true;
    }
    if (removeWorkingPaper(node.children ?? [], paperId)) {
      return true;
    }
  }
  return false;
}

function pruneEmptyWorkingPapers(nodes: WorkflowNode[]) {
  for (const node of nodes) {
    node.workingPapers = node.workingPapers.filter(
      (paper) => !isEmptyUploadPlaceholderPaper(paper)
    );
    pruneEmptyWorkingPapers(node.children ?? []);
  }
}

function normalizeWorkflowCodes(nodes: WorkflowNode[], isRoot = true) {
  const shouldRestoreSmeRootTitles = isRoot && hasSmeRootFolderSet(nodes);
  const nextCodes = normalizeCodeSequenceWithoutDigitFour(
    nodes.map((node) => node.code)
  );
  nodes.forEach((node, index) => {
    const previousCode = node.code;
    const code = nextCodes[index] ?? normalizeCodeWithoutDigitFour(node.code);
    syncCodeAndTitle(
      node,
      code,
      shouldRestoreSmeRootTitles ? SME_ROOT_TITLE_BY_CODE[code] : undefined
    );
    rebaseWorkflowTreeCodes(node.children ?? [], previousCode, code);
    normalizeWorkflowCodes(node.children ?? [], false);
    rebaseWorkingPaperCodes(node.workingPapers ?? [], previousCode, code);
    normalizeWorkingPaperCodes(node.workingPapers ?? []);
  });
}

function normalizeWorkingPaperCodes(papers: WorkingPaper[]) {
  const legacyPapers = papers.filter(
    (paper) => !isHierarchicalNumericWorkingPaperCode(paper.code)
  );
  const nextCodes = normalizeCodeSequenceWithoutDigitFour(
    legacyPapers.map((paper) => paper.code)
  );
  legacyPapers.forEach((paper, index) => {
    const code = nextCodes[index] ?? normalizeCodeWithoutDigitFour(paper.code);
    syncCodeAndTitle(paper, code);
  });
}

function rebaseWorkflowTreeCodes(
  nodes: WorkflowNode[],
  previousPrefix: string,
  nextPrefix: string
) {
  for (const node of nodes) {
    syncCodeAndTitle(
      node,
      rebaseCodePrefix(node.code, previousPrefix, nextPrefix)
    );
    rebaseWorkingPaperCodes(
      node.workingPapers ?? [],
      previousPrefix,
      nextPrefix
    );
    rebaseWorkflowTreeCodes(node.children ?? [], previousPrefix, nextPrefix);
  }
}

function rebaseWorkingPaperCodes(
  papers: WorkingPaper[],
  previousPrefix: string,
  nextPrefix: string
) {
  for (const paper of papers) {
    syncCodeAndTitle(
      paper,
      rebaseCodePrefix(paper.code, previousPrefix, nextPrefix)
    );
  }
}

function syncCodeAndTitle<
  T extends { code?: string | null; title?: string | null },
>(item: T, code: string, titleFallback?: string) {
  if (
    item.title === item.code ||
    (item.title && isReferenceCodeText(item.title))
  ) {
    item.title = titleFallback ?? code;
  }
  item.code = code;
}

const SME_ROOT_CODES = ["A", "B", "C", "D", "E", "F", "G"];
const SME_ROOT_TITLE_BY_CODE: Record<string, string> = {
  A: "Planning",
  B: "General Procedures",
  C: "Execution",
  D: "Reporting",
  E: "Completion",
  F: "Continued Connected Transactions (CCT)",
  G: "Other Audit Programmes",
};

function hasSmeRootFolderSet(nodes: { code: string }[]) {
  const codes = new Set(nodes.map((node) => node.code.trim()));
  return SME_ROOT_CODES.every((code) => codes.has(code));
}

function rebaseCodePrefix(
  code: string,
  previousPrefix: string,
  nextPrefix: string
) {
  if (previousPrefix === nextPrefix) {
    return code;
  }
  if (code === previousPrefix) {
    return nextPrefix;
  }
  if (code.startsWith(`${previousPrefix}-`)) {
    return `${nextPrefix}${code.slice(previousPrefix.length)}`;
  }
  const normalizedPreviousPrefix =
    normalizeCodeWithoutDigitFour(previousPrefix);
  if (normalizedPreviousPrefix === previousPrefix) {
    return code;
  }
  if (code === normalizedPreviousPrefix) {
    return nextPrefix;
  }
  if (code.startsWith(`${normalizedPreviousPrefix}-`)) {
    return `${nextPrefix}${code.slice(normalizedPreviousPrefix.length)}`;
  }
  return code;
}

function isEmptyUploadPlaceholderPaper(paper: WorkingPaper) {
  if ((paper.attachments ?? []).some((attachment) => !attachment.deletedAt)) {
    return false;
  }
  if (
    (paper.signoffs ?? []).length > 0 ||
    (paper.reviewQuestions ?? []).length > 0
  ) {
    return false;
  }
  const title = paper.title.trim();
  return /\.[A-Za-z0-9]{1,8}$/.test(title);
}

function createRestoreWorkingPaper(
  projectId: string,
  node: WorkflowNode,
  attachment: Attachment,
  bucket: WorkingPaper["bucket"] = "CURRENT"
): WorkingPaper {
  const paper: WorkingPaper = {
    id: `paper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    projectId,
    workflowNodeId: node.id,
    code: buildNextWorkingPaperCode(node.code, node.workingPapers ?? []),
    title: attachment.originalName ?? attachment.fileName,
    paperType: "WORKING_PAPER",
    bucket,
    preparerId: null,
    reviewerId: null,
    attachments: [],
    signoffs: [],
    reviewQuestions: [],
  };
  node.workingPapers = [...(node.workingPapers ?? []), paper];
  return paper;
}

function applyAttachmentIdentityFromPaper(
  attachment: Attachment,
  paper: WorkingPaper
) {
  Object.assign(attachment, getAttachmentIdentityFromPaper(paper));
}

function getAttachmentIdentityFromPaper(paper: WorkingPaper) {
  const code = normalizeMockWorkingPaperCode(paper.code);
  return {
    workflowNodeId: paper.workflowNodeId,
    bucket: paper.bucket ?? "CURRENT",
    code,
    title: paper.title === paper.code ? code : paper.title,
    preparerId: paper.preparerId ?? null,
    reviewerId: paper.reviewerId ?? null,
    preparedAt: paper.preparedAt ?? null,
    reviewedAt: paper.reviewedAt ?? null,
    returnedAt: paper.returnedAt ?? null,
    reviewNote: paper.reviewNote ?? null,
    templateItemId: paper.templateItemId ?? null,
    signoffs: paper.signoffs ?? [],
    reviewQuestions: paper.reviewQuestions ?? [],
  };
}

function workingPaperFromProjectTemplateFile(
  state: MockState,
  projectId: string,
  workflowNodeId: string,
  code: string,
  bucket: WorkingPaper["bucket"],
  file: ProjectTemplateFile,
  user: User
): WorkingPaper {
  const paperId = `paper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const attachment = attachmentFromProjectTemplateFile(
    state,
    projectId,
    paperId,
    file,
    user
  );
  return {
    id: paperId,
    projectId,
    workflowNodeId,
    templateItemId: null,
    code,
    title: getProjectTemplateDisplayTitle(file),
    paperType: file.paperType,
    bucket,
    preparerId: null,
    reviewerId: null,
    preparedAt: null,
    reviewedAt: null,
    returnedAt: null,
    reviewNote: null,
    preparer: null,
    reviewer: null,
    attachments: [attachment],
    signoffs: [],
    reviewQuestions: [],
  };
}

function attachmentFromProjectTemplateFile(
  state: MockState,
  projectId: string,
  paperId: string,
  file: ProjectTemplateFile,
  user: User
): Attachment {
  const now = new Date().toISOString();
  const isPlaceholder = Boolean(file.placeholderType);
  const attachment: Attachment = {
    id: `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workingPaperId: paperId,
    templateItemId: file.templateItemId ?? null,
    fileKind: "SUPPORTING",
    fileName: file.fileName,
    originalName: file.originalName ?? file.title,
    fileUrl: isPlaceholder
      ? ""
      : `mock://working-papers/${projectId}/${paperId}/${file.fileName}`,
    fileSize: isPlaceholder ? 0 : file.fileSize,
    mimeType: file.mimeType,
    placeholderType: file.placeholderType ?? null,
    version: 1,
    workDate: normalizeMockWorkDate(undefined, now),
    lockedBy: null,
    lockedAt: null,
    lockExpiresAt: null,
    uploadedBy: user.id,
    deletedAt: null,
    deletedBy: null,
    restoredAt: null,
    restoredBy: null,
    lastModifiedBy: user.id,
    lastModifiedAt: now,
    uploader: { id: user.id, name: user.name, email: user.email },
    lockHolder: null,
    lastModifier: { id: user.id, name: user.name, email: user.email },
  };
  if (isPlaceholder) {
    return attachment;
  }
  const revision = createMockAttachmentRevision(state, projectId, {
    attachmentId: attachment.id,
    version: attachment.version,
    parentVersionId: null,
    sourceVersionId: null,
    fileKind: attachment.fileKind,
    fileName: attachment.fileName,
    originalName: attachment.originalName,
    fileUrl: attachment.fileUrl,
    fileSize: attachment.fileSize,
    mimeType: attachment.mimeType,
    workDate: attachment.workDate ?? null,
    uploadedBy: user.id,
    uploadedAt: now,
    archivedBy: user.id,
    action: "INITIAL",
    createdAt: now,
    user,
  });
  attachment.headVersionId = revision.id;
  return attachment;
}

function workingPaperFromProjectTemplateSmartForm(
  state: MockState,
  projectId: string,
  workflowNodeId: string,
  code: string,
  smartForm: ProjectTemplateSmartForm,
  user: User,
  language?: SmartFormLocale
): WorkingPaper {
  const paperId = mockEntityId("paper");
  const attachment = attachmentFromSmartFormReference(
    state,
    projectId,
    paperId,
    smartForm,
    user,
    language
  );
  return {
    id: paperId,
    projectId,
    workflowNodeId,
    templateItemId: smartForm.id,
    code,
    title: getProjectTemplateSmartFormDisplayTitle(smartForm),
    paperType: "WORKING_PAPER",
    bucket: "CURRENT",
    preparerId: null,
    reviewerId: null,
    preparedAt: null,
    reviewedAt: null,
    returnedAt: null,
    reviewNote: null,
    preparer: null,
    reviewer: null,
    attachments: [attachment],
    signoffs: [],
    reviewQuestions: [],
  };
}

function attachmentFromSmartFormReference(
  state: MockState,
  projectId: string,
  paperId: string,
  smartForm: ProjectTemplateSmartForm,
  user: User,
  language?: SmartFormLocale
): Attachment {
  const now = new Date().toISOString();
  const fileName = getProjectTemplateSmartFormDisplayTitle(smartForm);
  const smartFormPackage = createMockSmartFormPackage(smartForm, now, language);
  const attachment: Attachment = {
    id: mockEntityId("attachment"),
    workingPaperId: paperId,
    fileKind: "SMART_FORM",
    fileName,
    originalName: fileName,
    fileUrl: `mock://smart-forms/${projectId}/${paperId}/${fileName}`,
    fileSize: JSON.stringify(smartFormPackage).length,
    mimeType: SMART_FORM_MIME_TYPE,
    version: 1,
    workDate: normalizeMockWorkDate(undefined, now),
    lockedBy: null,
    lockedAt: null,
    lockExpiresAt: null,
    uploadedBy: user.id,
    deletedAt: null,
    deletedBy: null,
    restoredAt: null,
    restoredBy: null,
    lastModifiedBy: user.id,
    lastModifiedAt: now,
    uploader: { id: user.id, name: user.name, email: user.email },
    lockHolder: null,
    lastModifier: { id: user.id, name: user.name, email: user.email },
  };
  mockSmartFormPackages.set(attachment.id, smartFormPackage);
  const revision = createMockAttachmentRevision(state, projectId, {
    attachmentId: attachment.id,
    version: attachment.version,
    parentVersionId: null,
    sourceVersionId: null,
    fileKind: attachment.fileKind,
    fileName: attachment.fileName,
    originalName: attachment.originalName,
    fileUrl: attachment.fileUrl,
    fileSize: attachment.fileSize,
    mimeType: attachment.mimeType,
    workDate: attachment.workDate ?? null,
    uploadedBy: user.id,
    uploadedAt: now,
    archivedBy: user.id,
    action: "INITIAL",
    createdAt: now,
    user,
  });
  attachment.headVersionId = revision.id;
  return attachment;
}

function buildNextWorkingPaperCode(
  nodeCode: string,
  existingPapers: Pick<WorkingPaper, "code">[]
) {
  const numericNodeCode = normalizeHierarchicalNumericFolderCode(nodeCode);
  if (numericNodeCode) {
    const expression = new RegExp(
      `^${escapeRegExp(numericNodeCode)}\\.(\\d+)$`
    );
    const maxIndex = existingPapers.reduce((max, paper) => {
      const match = paper.code.trim().match(expression);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `${numericNodeCode}.${maxIndex + 1}`;
  }
  const normalizedNodeCode = normalizeCodeWithoutDigitFour(nodeCode);
  const prefix = `${normalizedNodeCode}-F`;
  const maxIndex = existingPapers.reduce((max, paper) => {
    const paperCode = normalizeCodeWithoutDigitFour(paper.code);
    if (!paperCode.startsWith(prefix)) {
      return max;
    }
    const suffix = paperCode.slice(prefix.length);
    if (!/^\d+$/.test(suffix)) {
      return max;
    }
    return Math.max(max, Number(suffix));
  }, 0);
  return `${prefix}${formatNumberWithoutDigitFour(maxIndex + 1, 3)}`;
}

function normalizeAttachmentRefCodeInput(code: string) {
  return code.trim().replaceAll(/\s*-\s*/g, "-");
}

function assertAttachmentRefCodeMatchesNode(code: string, nodeCode: string) {
  const normalizedCode = code
    .trim()
    .replaceAll(/\s*-\s*/g, "-")
    .replaceAll(/\s*\.\s*/g, ".");
  const numericNodeCode = normalizeHierarchicalNumericFolderCode(nodeCode);
  if (numericNodeCode) {
    const prefix = `${numericNodeCode}.`;
    const suffix = normalizedCode.slice(prefix.length);
    if (normalizedCode.startsWith(prefix) && /^[1-9]\d*$/.test(suffix)) {
      return;
    }
    const legacyPrefix = `${normalizeAttachmentRefCodeInput(nodeCode)}-F`;
    const legacySuffix = normalizedCode.slice(legacyPrefix.length);
    if (
      normalizedCode.startsWith(legacyPrefix) &&
      /^\d{3}$/.test(legacySuffix)
    ) {
      return;
    }
    throw mockError(
      `File code must use ${prefix}1 format`,
      "VALIDATION_FAILED"
    );
  }
  const prefix = `${normalizeAttachmentRefCodeInput(nodeCode)}-F`;
  const suffix = normalizedCode.slice(prefix.length);
  if (normalizedCode.startsWith(prefix) && /^\d{3}$/.test(suffix)) {
    return;
  }
  throw mockError(
    `File code must use ${prefix}001 format`,
    "VALIDATION_FAILED"
  );
}

function normalizeHierarchicalNumericFolderCode(code: string) {
  const normalized = code.trim().replaceAll(/\s*-\s*/g, "-");
  if (/^\d{1,4}$|^\d+(?:-\d+)+$/.test(normalized)) {
    return normalized;
  }

  // Preview fixtures still carry legacy section prefixes such as A1-1000.
  // Production projects use the numeric leaf (1000), so mirror that numbering
  // Locally without rewriting the persisted fixture tree.
  return normalized.match(/^[A-Z]\d*-(\d{1,4})$/i)?.[1] ?? null;
}

function isHierarchicalNumericWorkingPaperCode(code: string) {
  return /^(?:\d{1,4}|\d+(?:-\d+)+)\.\d+$/.test(
    code
      .trim()
      .replaceAll(/\s*-\s*/g, "-")
      .replaceAll(/\s*\.\s*/g, ".")
  );
}

function normalizeMockWorkingPaperCode(code: string) {
  return isHierarchicalNumericWorkingPaperCode(code)
    ? code.trim().replaceAll(/\s+/g, "")
    : normalizeCodeWithoutDigitFour(code);
}

function attachRestoredAttachmentToPaper(
  state: MockState,
  projectId: string,
  attachmentId: string,
  attachment: Attachment,
  sourcePaper: WorkingPaper | null,
  targetPaper: WorkingPaper,
  user: Pick<User, "id" | "name" | "email">
) {
  if (sourcePaper && sourcePaper.id !== targetPaper.id) {
    sourcePaper.attachments = (sourcePaper.attachments ?? []).filter(
      (item) => item.id !== attachmentId
    );
  }
  if (!targetPaper.attachments?.some((item) => item.id === attachmentId)) {
    targetPaper.attachments = [...(targetPaper.attachments ?? []), attachment];
  }
  state.deletedAttachments[projectId] = (
    state.deletedAttachments[projectId] ?? []
  ).filter((item) => item.id !== attachmentId);
  attachment.workingPaperId = targetPaper.id;
  attachment.deletedAt = null;
  attachment.deletedBy = null;
  attachment.deletedByUser = null;
  attachment.deletedFromWorkingPaperId = null;
  attachment.deletedFromWorkflowNodeId = null;
  attachment.deletedFromWorkingPaperCode = null;
  attachment.deletedFromWorkingPaperTitle = null;
  attachment.restoredAt = new Date().toISOString();
  attachment.restoredBy = user.id;
  attachment.restoredByUser = {
    id: user.id,
    name: user.name,
    email: user.email,
  };
  addLog(state, projectId, "ATTACHMENT_RESTORED", "鎭㈠鏂囦欢", {
    targetType: "ATTACHMENT",
    targetId: attachmentId,
  });
}

function withoutDeletedAttachments(nodes: WorkflowNode[]): WorkflowNode[] {
  return nodes.map((node) => ({
    ...node,
    workingPapers: node.workingPapers.map(withoutDeletedPaperAttachments),
    children: withoutDeletedAttachments(node.children ?? []),
  }));
}

function withoutDeletedPaperAttachments(paper: WorkingPaper): WorkingPaper {
  return {
    ...paper,
    attachments: paper.attachments?.filter((item) => !item.deletedAt),
  };
}

function findAttachment(
  nodes: WorkflowNode[],
  attachmentId: string,
  options: { includeDeleted?: boolean } = {}
): Attachment | null {
  for (const node of nodes) {
    for (const paper of node.workingPapers) {
      const attachment = paper.attachments?.find(
        (item) =>
          item.id === attachmentId &&
          (options.includeDeleted || !item.deletedAt)
      );
      if (attachment) {
        return attachment;
      }
    }
    const childAttachment = findAttachment(
      node.children ?? [],
      attachmentId,
      options
    );
    if (childAttachment) {
      return childAttachment;
    }
  }
  return null;
}

function collectMockNodeAttachmentIds(
  nodes: WorkflowNode[],
  nodeId: string,
  bucket: "CURRENT" | "PRIOR" | "TEMPORARY"
) {
  const target = findMockWorkflowNode(nodes, nodeId);
  if (!target) {
    return [];
  }
  const result: string[] = [];
  const visit = (node: WorkflowNode) => {
    for (const attachment of node.attachments ?? []) {
      if (
        !attachment.deletedAt &&
        (attachment.bucket ?? "CURRENT") === bucket
      ) {
        result.push(attachment.id);
      }
    }
    for (const paper of node.workingPapers) {
      if ((paper.bucket ?? "CURRENT") !== bucket) {
        continue;
      }
      for (const attachment of paper.attachments ?? []) {
        if (!attachment.deletedAt) {
          result.push(attachment.id);
        }
      }
    }
    for (const child of node.children ?? []) {
      visit(child);
    }
  };
  visit(target);
  return result;
}

function findMockExportAttachmentLocation(
  nodes: WorkflowNode[],
  attachmentId: string,
  parents: WorkflowNode[] = []
): {
  node: WorkflowNode;
  path: WorkflowNode[];
  paper: WorkingPaper | null;
  attachment: Attachment;
} | null {
  for (const node of nodes) {
    const path = [...parents, node];
    const directAttachment = node.attachments?.find(
      (attachment) => attachment.id === attachmentId && !attachment.deletedAt
    );
    if (directAttachment) {
      return { node, path, paper: null, attachment: directAttachment };
    }
    for (const paper of node.workingPapers) {
      const attachment = paper.attachments?.find(
        (item) => item.id === attachmentId && !item.deletedAt
      );
      if (attachment) {
        return { node, path, paper, attachment };
      }
    }
    const child = findMockExportAttachmentLocation(
      node.children ?? [],
      attachmentId,
      path
    );
    if (child) {
      return child;
    }
  }
  return null;
}

async function blobToDataUrl(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x80_00) {
    binary += String.fromCodePoint(...bytes.subarray(offset, offset + 0x80_00));
  }
  return `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
}

function findMockWorkflowNode(
  nodes: WorkflowNode[],
  nodeId: string
): WorkflowNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }
    const child = findMockWorkflowNode(node.children ?? [], nodeId);
    if (child) {
      return child;
    }
  }
  return null;
}

function collectMockNodeDirectoryPaths(nodes: WorkflowNode[], nodeId: string) {
  const targetPath = findMockWorkflowNodePath(nodes, nodeId);
  if (!targetPath) {
    return [];
  }
  const result: string[][] = [];
  const visit = (node: WorkflowNode, path: string[]) => {
    const nextPath = [...path, node.code];
    result.push(nextPath);
    for (const child of node.children ?? []) {
      visit(child, nextPath);
    }
  };
  const targetNode = targetPath.at(-1);
  if (!targetNode) {
    return result;
  }
  visit(
    targetNode,
    targetPath.slice(0, -1).map((node) => node.code)
  );
  return result;
}

function mockSanitizePathSegment(value: string) {
  const mockControlCharacters = new RegExp(
    `[${String.fromCodePoint(0)}-${String.fromCodePoint(31)}]`,
    "g"
  );
  const sanitized = value
    .normalize("NFC")
    .replaceAll(mockControlCharacters, "_")
    .replaceAll(/[\\/:*?"<>|]/g, "_")
    .trim()
    .replace(/^\.+$/, "_");
  return sanitized && sanitized !== "." && sanitized !== ".."
    ? sanitized
    : "Untitled";
}

function mockSanitizeFileName(value: string) {
  const sanitized = mockSanitizePathSegment(value);
  return sanitized.startsWith(".") || sanitized.includes("..")
    ? "file"
    : sanitized;
}

function mockReplaceExtension(fileName: string, extension: string) {
  const lastSlash = Math.max(
    fileName.lastIndexOf("/"),
    fileName.lastIndexOf("\\")
  );
  const lastDot = fileName.lastIndexOf(".");
  const hasExtension = lastDot > lastSlash;
  return `${hasExtension ? fileName.slice(0, lastDot) : fileName || "file"}${extension}`;
}

function mockUniqueZipPath(path: string, used: Set<string>) {
  const normalized = path.toLocaleLowerCase("en-US");
  if (!used.has(normalized)) {
    used.add(normalized);
    return path;
  }
  const lastSlash = path.lastIndexOf("/");
  const lastDot = path.lastIndexOf(".");
  const hasExtension = lastDot > lastSlash;
  const extension = hasExtension ? path.slice(lastDot) : "";
  const base = extension ? path.slice(0, -extension.length) : path;
  for (let index = 2; ; index += 1) {
    const candidate = `${base} (${index})${extension}`;
    const key = candidate.toLocaleLowerCase("en-US");
    if (!used.has(key)) {
      used.add(key);
      return candidate;
    }
  }
}

function findMockWorkflowNodePath(
  nodes: WorkflowNode[],
  nodeId: string,
  parents: WorkflowNode[] = []
): WorkflowNode[] | null {
  for (const node of nodes) {
    const path = [...parents, node];
    if (node.id === nodeId) {
      return path;
    }
    const child = findMockWorkflowNodePath(node.children ?? [], nodeId, path);
    if (child) {
      return child;
    }
  }
  return null;
}

function formatMockWorkingPaperProjectPath(
  nodes: WorkflowNode[],
  workflowNodeId: string,
  workingPaperCode: string
) {
  const segments = (findMockWorkflowNodePath(nodes, workflowNodeId) ?? [])
    .map((node) => {
      const title = node.title.trim();
      return title && title !== node.code ? `${node.code} ${title}` : node.code;
    })
    .filter(Boolean);

  if (segments.at(-1) !== workingPaperCode) {
    segments.push(workingPaperCode);
  }
  return segments.join(" / ");
}

function findAttachmentLocation(
  nodes: WorkflowNode[],
  attachmentId: string,
  options: { includeDeleted?: boolean } = {},
  parents: WorkflowNode[] = []
): {
  node: WorkflowNode;
  path: WorkflowNode[];
  paper: WorkingPaper;
  attachment: Attachment;
} | null {
  for (const node of nodes) {
    const path = [...parents, node];
    for (const paper of node.workingPapers) {
      const attachment = paper.attachments?.find(
        (item) =>
          item.id === attachmentId &&
          (options.includeDeleted || !item.deletedAt)
      );
      if (attachment) {
        return { node, path, paper, attachment };
      }
    }
    const childLocation = findAttachmentLocation(
      node.children ?? [],
      attachmentId,
      options,
      path
    );
    if (childLocation) {
      return childLocation;
    }
  }
  return null;
}

function nextMockDirectoryAttachmentSortOrder(
  state: MockState,
  projectId: string,
  workflowNodeId: string,
  bucket: WorkingPaper["bucket"],
  excludedAttachmentId?: string
) {
  const node = findNode(state.workflows[projectId] ?? [], workflowNodeId);
  const highestSortOrder = (node?.workingPapers ?? [])
    .filter((paper) => (paper.bucket ?? "CURRENT") === bucket)
    .flatMap((paper) => paper.attachments ?? [])
    .filter((attachment) =>
      excludedAttachmentId ? attachment.id !== excludedAttachmentId : true
    )
    .reduce(
      (highest, attachment) => Math.max(highest, attachment.sortOrder ?? -1),
      -1
    );
  return highestSortOrder + 1;
}

function collectDeletedAttachments(
  nodes: WorkflowNode[],
  detached: Attachment[] = []
): Attachment[] {
  const deleted: Attachment[] = detached.map(normalizeAttachmentCodes);
  for (const node of nodes) {
    for (const paper of node.workingPapers) {
      deleted.push(
        ...(paper.attachments ?? []).filter((attachment) =>
          Boolean(attachment.deletedAt)
        )
      );
    }
    deleted.push(...collectDeletedAttachments(node.children ?? []));
  }
  return deleted
    .map(normalizeAttachmentCodes)
    .sort(
      (left, right) =>
        Date.parse(right.deletedAt ?? "") - Date.parse(left.deletedAt ?? "")
    );
}

function normalizeAttachmentCodes(attachment: Attachment): Attachment {
  return {
    ...attachment,
    deletedFromWorkingPaperCode: attachment.deletedFromWorkingPaperCode
      ? normalizeCodeWithoutDigitFour(attachment.deletedFromWorkingPaperCode)
      : attachment.deletedFromWorkingPaperCode,
  };
}

type ProjectAttachmentPath = NonNullable<
  ProjectAttachment["workingPaper"]
>["path"];

function collectProjectAttachments(
  nodes: WorkflowNode[],
  path: ProjectAttachmentPath = []
): ProjectAttachment[] {
  const files: ProjectAttachment[] = [];
  for (const node of nodes) {
    const nodeCode = normalizeCodeWithoutDigitFour(node.code);
    const nextPath = [
      ...path,
      {
        id: node.id,
        code: nodeCode,
        title: node.title === node.code ? nodeCode : node.title,
        level: node.level,
      },
    ];
    for (const paper of node.workingPapers) {
      for (const attachment of paper.attachments ?? []) {
        if (attachment.deletedAt) {
          continue;
        }
        const displayCode =
          attachment.code ?? normalizeMockWorkingPaperCode(paper.code);
        const displayTitle =
          (attachment.title ?? paper.title) === (attachment.code ?? paper.code)
            ? displayCode
            : (attachment.title ?? paper.title);
        files.push({
          ...attachment,
          smartFormInstance:
            attachment.fileKind === "SMART_FORM"
              ? {
                  status: isIncompleteMockSmartFormAttachment(attachment)
                    ? "INCOMPLETE"
                    : "COMPLETE",
                }
              : undefined,
          workingPaper: {
            id: paper.id,
            attachmentId: attachment.id,
            code: displayCode,
            title: displayTitle,
            bucket: attachment.bucket ?? paper.bucket,
            workflowNodeId: attachment.workflowNodeId ?? node.id,
            workflowNodeCode: nodeCode,
            workflowNodeTitle: node.title === node.code ? nodeCode : node.title,
            signoffs: attachment.signoffs ?? paper.signoffs ?? [],
            reviewQuestions:
              attachment.reviewQuestions ?? paper.reviewQuestions ?? [],
            path: nextPath,
          },
        });
      }
    }
    files.push(...collectProjectAttachments(node.children ?? [], nextPath));
  }
  return files.sort((left, right) => {
    if (left.workingPaper?.id === right.workingPaper?.id) {
      return (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
    }
    return (
      Date.parse(right.lastModifiedAt ?? "") -
      Date.parse(left.lastModifiedAt ?? "")
    );
  });
}

function listMockAttachmentVersions(
  state: MockState,
  projectId: string,
  attachmentId: string
) {
  state.attachmentVersions ??= {};
  return (state.attachmentVersions[projectId] ?? [])
    .filter((version) => version.attachmentId === attachmentId)
    .sort(
      (left, right) =>
        right.version - left.version ||
        Date.parse(right.createdAt) - Date.parse(left.createdAt)
    );
}

function findMockAttachmentVersion(
  state: MockState,
  projectId: string,
  attachmentId: string,
  versionId: string
) {
  return listMockAttachmentVersions(state, projectId, attachmentId).find(
    (version) => version.id === versionId
  );
}

function resolveMockAttachmentHeadVersionId(
  state: MockState,
  projectId: string,
  attachment: Attachment
) {
  if (attachment.headVersionId) {
    return attachment.headVersionId;
  }
  return (
    listMockAttachmentVersions(state, projectId, attachment.id).find(
      (version) => version.isCurrent
    )?.id ??
    listMockAttachmentVersions(state, projectId, attachment.id)[0]?.id ??
    null
  );
}

function createMockAttachmentRevision(
  state: MockState,
  projectId: string,
  input: {
    attachmentId: string;
    version: number;
    parentVersionId?: string | null;
    sourceVersionId?: string | null;
    fileKind: Attachment["fileKind"];
    fileName: string;
    originalName?: string | null;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
    workDate?: string | null;
    uploadedBy: string;
    uploadedAt: string;
    archivedBy: string;
    action: "INITIAL" | "UPLOAD" | "CHECK_IN" | "RESTORE" | "MIGRATION";
    createdAt: string;
    user: User;
  }
) {
  state.attachmentVersions ??= {};
  const existingVersions = state.attachmentVersions[projectId] ?? [];
  state.attachmentVersions[projectId] = existingVersions
    .filter(
      (version) =>
        version.attachmentId !== input.attachmentId ||
        version.version < input.version
    )
    .map((version) =>
      version.attachmentId === input.attachmentId
        ? { ...version, isCurrent: false }
        : version
    );
  const version: AttachmentVersion = {
    id: `attachment-version-${input.attachmentId}-${input.version}-${Date.now()}`,
    attachmentId: input.attachmentId,
    projectId,
    version: input.version,
    parentVersionId: input.parentVersionId ?? null,
    sourceVersionId: input.sourceVersionId ?? null,
    fileKind: input.fileKind,
    fileName: input.fileName,
    originalName: input.originalName,
    fileUrl: input.fileUrl,
    fileSize: input.fileSize,
    mimeType: input.mimeType,
    workDate: input.workDate ?? null,
    uploadedBy: input.uploadedBy,
    uploadedAt: input.uploadedAt,
    archivedBy: input.archivedBy,
    action: input.action,
    isCurrent: true,
    createdAt: input.createdAt,
    uploadedByUser: {
      id: input.user.id,
      name: input.user.name,
      email: input.user.email,
    },
    archivedByUser: {
      id: input.user.id,
      name: input.user.name,
      email: input.user.email,
    },
  };
  state.attachmentVersions[projectId] = [
    version,
    ...(state.attachmentVersions[projectId] ?? []),
  ];
  return version;
}

function archiveNodeAttachments(node: WorkflowNode, user: User): Attachment[] {
  const archived: Attachment[] = [];
  for (const paper of node.workingPapers) {
    for (const attachment of paper.attachments ?? []) {
      if (attachment.deletedAt) {
        continue;
      }
      const deletedAt = new Date().toISOString();
      attachment.workingPaperId = null;
      attachment.deletedAt = deletedAt;
      attachment.deletedBy = user.id;
      attachment.deletedByUser = {
        id: user.id,
        name: user.name,
        email: user.email,
      };
      attachment.deletedFromWorkingPaperId = paper.id;
      attachment.deletedFromWorkflowNodeId = paper.workflowNodeId;
      attachment.deletedFromWorkingPaperCode = normalizeCodeWithoutDigitFour(
        paper.code
      );
      attachment.deletedFromWorkingPaperTitle = paper.title;
      attachment.restoredAt = null;
      attachment.restoredBy = null;
      attachment.restoredByUser = null;
      attachment.lockedBy = null;
      attachment.lockedAt = null;
      attachment.lockExpiresAt = null;
      attachment.lockHolder = null;
      archived.push(attachment);
    }
  }
  for (const child of node.children ?? []) {
    archived.push(...archiveNodeAttachments(child, user));
  }
  return archived;
}

function lockAttachmentForUser(attachment: Attachment, user: User) {
  if (
    attachment.lockedBy &&
    attachment.lockedBy !== user.id &&
    (!attachment.lockExpiresAt ||
      Date.parse(attachment.lockExpiresAt) > Date.now())
  ) {
    throw mockError(
      `该文件已被 ${attachment.lockHolder?.name ?? "其他成员"} 锁定`,
      "BAD_REQUEST"
    );
  }
  attachment.lockedBy = user.id;
  attachment.lockedAt = new Date().toISOString();
  attachment.lockExpiresAt = new Date(
    Date.now() + 2 * 60 * 60 * 1000
  ).toISOString();
  attachment.lockHolder = {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

function requireMockAttachmentLock(attachment: Attachment, user: User) {
  if (
    attachment.lockedBy !== user.id ||
    !attachment.lockExpiresAt ||
    Date.parse(attachment.lockExpiresAt) <= Date.now()
  ) {
    throw mockError("Lock this file before uploading or restoring a version");
  }
}

function normalizeMockWorkDate(value: string | undefined, fallbackIso: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return `${fallbackIso.slice(0, 10)}T00:00:00.000Z`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw mockError("Work date must use YYYY-MM-DD", "VALIDATION_FAILED");
  }
  return `${trimmed}T00:00:00.000Z`;
}

function findReviewQuestion(
  nodes: WorkflowNode[],
  questionId: string
): WorkingPaperQuestion | null {
  for (const node of nodes) {
    for (const paper of node.workingPapers) {
      const question = paper.reviewQuestions?.find(
        (item) => item.id === questionId
      );
      if (question) {
        return question;
      }
    }
    const childQuestion = findReviewQuestion(node.children ?? [], questionId);
    if (childQuestion) {
      return childQuestion;
    }
  }
  return null;
}

function appendPaperSignoff(
  paper: WorkingPaper,
  type: WorkingPaperSignoff["type"],
  user: User
): void {
  let signedAt = new Date().toISOString();
  const signoffs = paper.signoffs ?? [];
  const incompleteSmartForm = (paper.attachments ?? []).find(
    (attachment) =>
      !attachment.deletedAt && isIncompleteMockSmartFormAttachment(attachment)
  );
  if (incompleteSmartForm) {
    throw mockError(
      "Complete the Smart Form before signing it.",
      "SMART_FORM_INCOMPLETE"
    );
  }
  assertMockReviewerSignoffCooldown(signoffs, type, user, signedAt);
  const current = getMockCurrentSignoffRound(signoffs);
  const latestCurrentSignoff = current
    ? [...current.signoffs].sort(
        (left, right) =>
          new Date(right.signedAt).getTime() - new Date(left.signedAt).getTime()
      )[0]
    : null;
  if (
    latestCurrentSignoff &&
    new Date(signedAt).getTime() <=
      new Date(latestCurrentSignoff.signedAt).getTime()
  ) {
    signedAt = new Date(
      new Date(latestCurrentSignoff.signedAt).getTime() + 1
    ).toISOString();
  }
  let roundNumber = current?.roundNumber ?? 1;
  if (type === "PREPARER" && current?.isComplete) {
    for (const signoff of signoffs) {
      if (signoff.isCurrent !== false && !signoff.revokedAt) {
        signoff.isCurrent = false;
      }
    }
    roundNumber += 1;
  }
  if (type === "REVIEWER" && !current?.latestPreparer) {
    throw mockError(
      "Preparation signoff is required before review signoff.",
      "PREPARER_SIGNOFF_REQUIRED"
    );
  }
  paper.signoffs = [
    ...signoffs,
    {
      id: `signoff-${paper.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      roundNumber,
      isCurrent: true,
      signedAt,
      user: { id: user.id, name: user.name, email: user.email },
    },
  ];
}

function appendAttachmentSignoff(
  location: { paper: WorkingPaper; attachment: Attachment },
  type: WorkingPaperSignoff["type"],
  user: User
): void {
  let signedAt = new Date().toISOString();
  const inheritedSignoffs =
    location.attachment.signoffs ??
    location.paper.signoffs?.filter(
      (signoff) =>
        !signoff.attachmentId || signoff.attachmentId === location.attachment.id
    ) ??
    [];
  if (isIncompleteMockSmartFormAttachment(location.attachment)) {
    throw mockError(
      "Complete the Smart Form before signing it.",
      "SMART_FORM_INCOMPLETE"
    );
  }
  assertMockReviewerSignoffCooldown(inheritedSignoffs, type, user, signedAt);
  const current = getMockCurrentSignoffRound(inheritedSignoffs);
  const latestCurrentSignoff = current
    ? [...current.signoffs].sort(
        (left, right) =>
          new Date(right.signedAt).getTime() - new Date(left.signedAt).getTime()
      )[0]
    : null;
  if (
    latestCurrentSignoff &&
    new Date(signedAt).getTime() <=
      new Date(latestCurrentSignoff.signedAt).getTime()
  ) {
    signedAt = new Date(
      new Date(latestCurrentSignoff.signedAt).getTime() + 1
    ).toISOString();
  }
  let roundNumber = current?.roundNumber ?? 1;
  if (type === "PREPARER" && current?.isComplete) {
    for (const signoff of inheritedSignoffs) {
      if (signoff.isCurrent !== false && !signoff.revokedAt) {
        signoff.isCurrent = false;
      }
    }
    roundNumber += 1;
  }
  if (type === "REVIEWER" && !current?.latestPreparer) {
    throw mockError(
      "Preparation signoff is required before review signoff.",
      "PREPARER_SIGNOFF_REQUIRED"
    );
  }
  location.attachment.signoffs = [
    ...inheritedSignoffs,
    {
      id: `signoff-${location.attachment.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      attachmentId: location.attachment.id,
      type,
      roundNumber,
      isCurrent: true,
      attachmentVersion: location.attachment.version,
      contentHash: location.attachment.contentHash ?? null,
      signedAt,
      user: { id: user.id, name: user.name, email: user.email },
    },
  ];
  syncSingleAttachmentPaperSignoffs(location);
}

function assertMockReviewerSignoffCooldown(
  signoffs: WorkingPaperSignoff[],
  type: WorkingPaperSignoff["type"],
  user: User,
  signedAt: string
) {
  if (type !== "REVIEWER") {
    return;
  }
  const [latestReview] = signoffs
    .filter(
      (signoff) =>
        signoff.type === "REVIEWER" &&
        signoff.user.id === user.id &&
        !signoff.revokedAt
    )
    .sort(
      (left, right) =>
        new Date(right.signedAt).getTime() - new Date(left.signedAt).getTime()
    );
  if (
    latestReview &&
    new Date(signedAt).getTime() - new Date(latestReview.signedAt).getTime() <
      24 * 60 * 60 * 1000
  ) {
    throw mockError(
      "The same reviewer can sign this file again after 24 hours.",
      "REVIEW_SIGNOFF_COOLDOWN_ACTIVE"
    );
  }
}

function getMockCurrentSignoffRound(signoffs: WorkingPaperSignoff[]) {
  const active = signoffs.filter(
    (signoff) => signoff.isCurrent !== false && !signoff.revokedAt
  );
  if (active.length === 0) {
    return null;
  }
  const roundNumber = Math.max(
    ...active.map((signoff) => signoff.roundNumber ?? 1)
  );
  const roundSignoffs = active.filter(
    (signoff) => (signoff.roundNumber ?? 1) === roundNumber
  );
  const latest = (type: WorkingPaperSignoff["type"]) =>
    [...roundSignoffs]
      .filter((signoff) => signoff.type === type)
      .sort(
        (left, right) =>
          new Date(right.signedAt).getTime() - new Date(left.signedAt).getTime()
      )[0] ?? null;
  const latestPreparer = latest("PREPARER");
  const latestReviewer = latest("REVIEWER");
  return {
    roundNumber,
    signoffs: roundSignoffs,
    latestPreparer,
    latestReviewer,
    isComplete: Boolean(
      latestPreparer &&
      latestReviewer &&
      new Date(latestReviewer.signedAt).getTime() >
        new Date(latestPreparer.signedAt).getTime()
    ),
  };
}

function refreshMockCurrentSignoffRound(attachment: Attachment) {
  const signoffs = attachment.signoffs ?? [];
  for (const signoff of signoffs) {
    signoff.isCurrent = false;
  }
  const active = signoffs.filter((signoff) => !signoff.revokedAt);
  const rounds = [
    ...new Set(active.map((signoff) => signoff.roundNumber ?? 1)),
  ].sort((left, right) => right - left);
  const currentRound = rounds.find((roundNumber) =>
    active.some(
      (signoff) =>
        (signoff.roundNumber ?? 1) === roundNumber &&
        signoff.type === "PREPARER"
    )
  );
  if (currentRound === undefined) {
    return;
  }
  for (const signoff of signoffs) {
    if (!signoff.revokedAt && (signoff.roundNumber ?? 1) === currentRound) {
      signoff.isCurrent = true;
    }
  }
}

function getMockAttachmentSignoffHistory(
  attachment: Attachment
): AttachmentSignoffHistory {
  const signoffs = [...(attachment.signoffs ?? [])].sort(
    (left, right) =>
      new Date(right.signedAt).getTime() - new Date(left.signedAt).getTime()
  );
  const current = getMockCurrentSignoffRound(signoffs);
  const roundNumbers = [
    ...new Set(signoffs.map((signoff) => signoff.roundNumber ?? 1)),
  ].sort((left, right) => right - left);
  return {
    attachmentId: attachment.id,
    total: signoffs.length,
    currentRoundNumber: current?.roundNumber ?? null,
    currentStatus: current?.isComplete
      ? "COMPLETED"
      : current?.latestPreparer
        ? "PENDING_REVIEW"
        : "PENDING_PREPARER",
    rounds: roundNumbers.map((roundNumber) => {
      const entries = signoffs.filter(
        (signoff) => (signoff.roundNumber ?? 1) === roundNumber
      );
      const active = entries.filter((signoff) => !signoff.revokedAt);
      const status =
        current?.roundNumber === roundNumber
          ? current.isComplete
            ? "COMPLETED"
            : "PENDING_REVIEW"
          : active.length > 0
            ? "SUPERSEDED"
            : "REVOKED";
      return { roundNumber, status, signoffs: entries };
    }),
  };
}

function findSignoffLocation(
  nodes: WorkflowNode[],
  signoffId: string
): { paper: WorkingPaper; attachment?: Attachment } | null {
  for (const node of nodes) {
    for (const paper of node.workingPapers) {
      if (paper.signoffs?.some((signoff) => signoff.id === signoffId)) {
        return { paper };
      }
      const attachment = paper.attachments?.find((item) =>
        item.signoffs?.some((signoff) => signoff.id === signoffId)
      );
      if (attachment) {
        return { paper, attachment };
      }
    }
    const childLocation = findSignoffLocation(node.children ?? [], signoffId);
    if (childLocation) {
      return childLocation;
    }
  }
  return null;
}

function syncSingleAttachmentPaperSignoffs(location: {
  paper: WorkingPaper;
  attachment: Attachment;
}) {
  const activeAttachments = (location.paper.attachments ?? []).filter(
    (attachment) => !attachment.deletedAt
  );
  if (activeAttachments.length > 1) {
    return;
  }
  location.paper.signoffs = location.attachment.signoffs ?? [];
}

function mockZipMasterSession(
  projectId: string,
  attachment: Attachment,
  lockSessionId: string,
  dirty = false
): ZipMasterSessionResponse {
  const entries = mockZipMasterEntries.get(lockSessionId) ?? mockZipEntries();
  mockZipMasterEntries.set(lockSessionId, entries);
  return {
    ok: true,
    mode: "MASTER",
    sessionId: lockSessionId,
    attachmentId: attachment.id,
    projectId,
    lockSessionId,
    fileName: attachment.originalName ?? attachment.fileName,
    version: attachment.version,
    state: dirty ? "DIRTY" : "OPEN",
    dirty,
    entries,
  };
}

function mockZipEntries(): ZipMasterEntry[] {
  return [
    {
      type: "folder",
      name: "evidence",
      path: "evidence/",
      modifiedAt: "2026-06-20T10:00:00.000Z",
      children: [
        {
          type: "file",
          name: "support.pdf",
          path: "evidence/support.pdf",
          modifiedAt: "2026-06-21T11:30:00.000Z",
          size: 14 * 1024 * 1024,
        },
        {
          type: "file",
          name: "schedule.xlsx",
          path: "evidence/schedule.xlsx",
          modifiedAt: "2026-06-22T12:45:00.000Z",
          size: 37 * 1024,
        },
      ],
    },
    {
      type: "file",
      name: "readme.txt",
      path: "readme.txt",
      modifiedAt: "2026-06-23T09:15:00.000Z",
      size: 512,
    },
  ];
}

function applyMockZipOperation(
  entries: ZipMasterEntry[],
  operation: ZipMasterOperationInput,
  file?: File
): ZipMasterEntry[] {
  const now = new Date().toISOString();
  const clonedEntries = cloneZipEntries(entries);
  if (operation.type === "ADD_FILE" || operation.type === "REPLACE_FILE") {
    const fileEntry: ZipMasterEntry = {
      type: "file",
      name: zipEntryBasename(operation.entryPath),
      path: operation.entryPath,
      modifiedAt: now,
      size: file?.size ?? 0,
    };
    return insertZipEntry(
      removeZipEntry(clonedEntries, operation.entryPath).entries,
      fileEntry
    );
  }
  if (operation.type === "CREATE_FOLDER") {
    const folderPath = ensureZipFolderPath(operation.entryPath);
    const folderEntry: ZipMasterEntry = {
      type: "folder",
      name: zipEntryBasename(folderPath),
      path: folderPath,
      modifiedAt: now,
      children: [],
    };
    return insertZipEntry(clonedEntries, folderEntry);
  }
  if (operation.type === "DELETE_ENTRY") {
    return removeZipEntry(clonedEntries, operation.entryPath).entries;
  }
  if (
    operation.type === "MOVE_ENTRY" ||
    operation.type === "COPY_ENTRY" ||
    operation.type === "RENAME_ENTRY"
  ) {
    const source = findZipEntry(clonedEntries, operation.entryPath);
    if (!source) {
      return clonedEntries;
    }
    const entry = cloneZipEntryToPath(source, operation.targetPath, now);
    const withoutSource =
      operation.type === "COPY_ENTRY"
        ? clonedEntries
        : removeZipEntry(clonedEntries, operation.entryPath).entries;
    return insertZipEntry(
      removeZipEntry(withoutSource, operation.targetPath).entries,
      entry
    );
  }
  return clonedEntries;
}

function cloneZipEntries(entries: ZipMasterEntry[]): ZipMasterEntry[] {
  return entries.map((entry) => cloneZipEntryToPath(entry, entry.path));
}

function cloneZipEntryToPath(
  entry: ZipMasterEntry,
  targetPath: string,
  modifiedAt = entry.modifiedAt
): ZipMasterEntry {
  if (entry.type === "file") {
    return {
      ...entry,
      name: zipEntryBasename(targetPath),
      path: targetPath,
      modifiedAt,
    };
  }
  const sourceFolderPath = ensureZipFolderPath(entry.path);
  const targetFolderPath = ensureZipFolderPath(targetPath);
  return {
    ...entry,
    name: zipEntryBasename(targetFolderPath),
    path: targetFolderPath,
    modifiedAt,
    children: entry.children.map((child) =>
      cloneZipEntryToPath(
        child,
        child.path.replace(sourceFolderPath, targetFolderPath),
        modifiedAt
      )
    ),
  };
}

function findZipEntry(
  entries: ZipMasterEntry[],
  path: string
): ZipMasterEntry | null {
  for (const entry of entries) {
    if (entry.path === path) {
      return entry;
    }
    if (entry.type !== "folder") {
      continue;
    }
    const nested = findZipEntry(entry.children, path);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function insertZipEntry(
  entries: ZipMasterEntry[],
  entryToInsert: ZipMasterEntry
): ZipMasterEntry[] {
  const parentPath = zipParentFolderPath(entryToInsert.path);
  if (!parentPath) {
    return [...entries, entryToInsert];
  }
  return entries.map((entry) => {
    if (entry.type !== "folder") {
      return entry;
    }
    if (entry.path === parentPath) {
      return {
        ...entry,
        children: [...entry.children, entryToInsert],
      };
    }
    return {
      ...entry,
      children: insertZipEntry(entry.children, entryToInsert),
    };
  });
}

function removeZipEntry(
  entries: ZipMasterEntry[],
  path: string
): { entries: ZipMasterEntry[]; removed: ZipMasterEntry | null } {
  let removed: ZipMasterEntry | null = null;
  const nextEntries: ZipMasterEntry[] = [];
  for (const entry of entries) {
    if (entry.path === path) {
      removed = entry;
      continue;
    }
    if (entry.type === "folder") {
      const result = removeZipEntry(entry.children, path);
      removed ??= result.removed;
      nextEntries.push({ ...entry, children: result.entries });
      continue;
    }
    nextEntries.push(entry);
  }
  return { entries: nextEntries, removed };
}

function zipParentFolderPath(path: string) {
  const segments = path.replaceAll(/\/+$/g, "").split("/").filter(Boolean);
  segments.pop();
  return segments.length > 0 ? `${segments.join("/")}/` : "";
}

function ensureZipFolderPath(path: string) {
  const normalized = path.replaceAll(/\/+$/g, "");
  return normalized ? `${normalized}/` : "";
}

function ensureMockFileExtension(value: string, extension: string) {
  const normalized = value.trim();
  return normalized.toLowerCase().endsWith(extension.toLowerCase())
    ? normalized
    : `${normalized.replace(/\.[^.]+$/, "")}${extension}`;
}

function isSameTimestamp(actual: string | null | undefined, expected: string) {
  if (!actual) {
    return false;
  }
  const actualTime = Date.parse(actual);
  const expectedTime = Date.parse(expected);
  return (
    Number.isFinite(actualTime) &&
    Number.isFinite(expectedTime) &&
    actualTime === expectedTime
  );
}

function zipEntryBasename(path: string) {
  const segments = path.replaceAll(/\/+$/g, "").split("/").filter(Boolean);
  return segments.at(-1) ?? path;
}

function isZipMasterFileOperation(
  operation: ZipMasterOperationInput
): operation is ZipMasterFileOperationInput {
  return operation.type === "ADD_FILE" || operation.type === "REPLACE_FILE";
}

function mockZipMasterClose(
  projectId: string,
  attachment: Attachment,
  sessionId: string,
  checkedIn: boolean,
  discarded = false
): ZipMasterCloseResponse {
  return {
    ok: true,
    checkedIn,
    discarded,
    attachmentId: attachment.id,
    projectId,
    sessionId,
    lockSessionId: sessionId,
    version: attachment.version,
  };
}

function buildMockWorkItems(
  state: MockState,
  input: {
    view?: WorkItemView;
    scope?: WorkItemDomain;
    domain?: WorkItemDomain;
    projectId?: string;
    locale?: "zh-CN" | "en-US";
  }
): WorkItemListResponse {
  const user = getCurrentUser(state);
  const locale = input.locale ?? "zh-CN";
  const project = input.projectId
    ? findProject(state, input.projectId)
    : state.workspaces
        .flatMap((workspace) => workspace.projects)
        .find((candidate) =>
          candidate.members?.some((member) => member.user.id === user.id)
        );
  const now = new Date().toISOString();
  const items: WorkItemListResponse["items"] = [];
  if (input.view === "TEAM" && project) {
    items.push({
      id: `PRJ-005:preview:${project.id}`,
      ruleId: "PRJ-005",
      domain: "PROJECT",
      view: "TEAM",
      category: "REVIEW",
      state: "OPEN",
      severity: "BLOCKER",
      priority: "HIGH",
      title:
        locale === "zh-CN"
          ? `文件 A1-1000-F001（Audit Programme）下，主题为“请确认审计程序已完成”、发起人为 ${user.name} 的复核问题尚未被关闭，请关注。`
          : `The review question titled “Please confirm that the audit programme is complete” under file A1-1000-F001 (Audit Programme), raised by ${user.name}, has not been cleared. Please review it.`,
      description:
        locale === "zh-CN"
          ? "这是团队待办的预览事项"
          : "Preview team work item",
      subjectType: "REVIEW_QUESTION",
      subjectId: `preview-question-${project.id}`,
      project: {
        id: project.id,
        projectCode: project.projectCode,
        name: project.name,
      },
      reference: "A1-1000-F001",
      objectLabel: "Audit Programme",
      responsibleLabel: user.name,
      assignedTo: { id: user.id, name: user.name, email: user.email },
      createdBy: { id: user.id, name: user.name, email: user.email },
      dueAt: null,
      openedAt: now,
      updatedAt: now,
      actionTarget: {
        app: "PROJECT",
        resourceType: "REVIEW_QUESTION",
        resourceId: `preview-question-${project.id}`,
        params: { projectId: project.id },
      },
    });
  } else {
    items.push({
      id: `EMP-003:preview:${user.id}`,
      ruleId: "EMP-003",
      domain: "EMP",
      view: "PERSONAL",
      category: "DECLARATION",
      state: "OPEN",
      severity: "ACTION_REQUIRED",
      priority: "HIGH",
      title:
        locale === "zh-CN"
          ? `您尚未确认${project?.name ?? "当前项目"}${project ? `（${project.projectCode}）` : ""}的项目独立性声明，请尽快确认。`
          : `You have not confirmed the project independence declaration for ${project?.name ?? "the current project"}${project ? ` (${project.projectCode})` : ""}. Please confirm it as soon as possible.`,
      description: project?.name ?? "Project",
      subjectType: "PROJECT_DECLARATION",
      subjectId: project?.id ?? user.id,
      project: project
        ? {
            id: project.id,
            projectCode: project.projectCode,
            name: project.name,
          }
        : null,
      reference: project?.projectCode ?? null,
      objectLabel: project?.name ?? null,
      responsibleLabel: user.name,
      assignedTo: { id: user.id, name: user.name, email: user.email },
      createdBy: null,
      dueAt: null,
      openedAt: now,
      updatedAt: now,
      actionTarget: {
        app: "EMP",
        resourceType: "PROJECT_DECLARATION",
        resourceId: project?.id ?? user.id,
        params: project ? { projectId: project.id } : {},
      },
    });
    if (project) {
      items.push({
        id: `PRJ-005:preview:${project.id}`,
        ruleId: "PRJ-005",
        domain: "PROJECT",
        view: "PERSONAL",
        category: "REVIEW",
        state: "OPEN",
        severity: "BLOCKER",
        priority: "HIGH",
        title:
          locale === "zh-CN"
            ? "你在文件 A1-1000-F001（Audit Programme）下发起的复核问题“请确认审计程序已完成”尚未关闭，请关注。"
            : "The review question “Please confirm that the audit programme is complete” that you opened under file A1-1000-F001 (Audit Programme) has not been cleared. Please review it.",
        description:
          locale === "zh-CN"
            ? "这是你发起且尚未关闭的复核问题"
            : "You opened this review question and it has not been cleared",
        subjectType: "REVIEW_QUESTION",
        subjectId: `preview-question-${project.id}`,
        project: {
          id: project.id,
          projectCode: project.projectCode,
          name: project.name,
        },
        reference: "A1-1000-F001",
        objectLabel: "Audit Programme",
        responsibleLabel: user.name,
        assignedTo: { id: user.id, name: user.name, email: user.email },
        createdBy: { id: user.id, name: user.name, email: user.email },
        dueAt: null,
        openedAt: now,
        updatedAt: now,
        actionTarget: {
          app: "PROJECT",
          resourceType: "REVIEW_QUESTION",
          resourceId: `preview-question-${project.id}`,
          params: { projectId: project.id },
        },
      });
    }
  }
  const scope = input.scope ?? input.domain;
  const filtered = scope
    ? items.filter((item) => item.domain === scope)
    : items;
  const counts = {
    total: filtered.length,
    EMP: filtered.filter((item) => item.domain === "EMP").length,
    PROJECT: filtered.filter((item) => item.domain === "PROJECT").length,
    CMP: filtered.filter((item) => item.domain === "CMP").length,
    TMS: filtered.filter((item) => item.domain === "TMS").length,
    OPS: filtered.filter((item) => item.domain === "OPS").length,
  };
  return {
    items: filtered,
    categories:
      filtered.length > 0
        ? [
            {
              category: filtered[0].category,
              label:
                filtered[0].category === "REVIEW"
                  ? locale === "zh-CN"
                    ? "复核问题"
                    : "Review questions"
                  : locale === "zh-CN"
                    ? "项目流程"
                    : "Project process",
              total: filtered.length,
              blockers: filtered.filter((item) => item.severity === "BLOCKER")
                .length,
              earliestOpenedAt: now,
            },
          ]
        : [],
    counts,
  };
}
