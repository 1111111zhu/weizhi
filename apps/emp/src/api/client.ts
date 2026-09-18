import type {
  CreatePicRecoveryInvitationInput,
  ReauthorizeProjectMemberInput,
  ProjectAuthorizationImpact,
  AcceptInvitationInput,
  ApplyProjectTemplateInput,
  AttachmentFileKind,
  AttachmentPlaceholderType,
  ClaimConfirmationDispatchQueueInput,
  CmpClient,
  CmpClientListQuery,
  CmpClientsResponse,
  CmpEngagement,
  CmpEngagementListQuery,
  CmpEngagementsResponse,
  ConfirmProjectTemplateFileUploadInput,
  ConfirmReviewQuestionImageInput,
  ConfirmationDifferenceStatus,
  ConfirmationDispatchMethod,
  ConfirmationDispatchQueueQuery,
  ConfirmationDraftPayload,
  ConfirmationDraftTemplateCode,
  ConfirmationEmpImportEligibleProjectsResponse,
  ConfirmationFollowUpEventType,
  ConfirmationResponseChannel,
  ConfirmationResponseLibraryRoutingStatus,
  ConfirmationResponseMatchMethod,
  ConfirmationResponseRoutingStatus,
  ConfirmationResponseStatus,
  ConfirmationStatus,
  ConfirmationTeamConfirmStatus,
  ConfirmationTemplateTextStyle,
  ConfirmationType,
  CorrectProjectConfirmationTrackingInput,
  CreateAttachmentPlaceholderInput,
  CreateConfirmationDispatchBatchInput,
  CreateDesktopFolderInput,
  CreateInvitationInput,
  CreateProjectConfirmationDispatchInput,
  CreateProjectConfirmationFollowUpEventInput,
  CreateProjectConfirmationInput,
  CreateProjectConfirmationResponseInput,
  CreateProjectFileExportJobInput,
  CreateProjectInput,
  CreateProjectSmartFormInput,
  CreateProjectTemplateInput,
  CreateProjectTemplateNodeInput,
  CreateProjectTemplatePlaceholderInput,
  CreateProjectTemplateSmartFormInput,
  CreateSmartFormTemplateInput,
  CreateUserInput,
  CreateWorkflowNodeInput,
  CreateWorkingPaperInput,
  CreateWorkingPaperQuestionInput,
  CreateWorkspaceInput,
  ExecuteConfirmationDispatchBatchInput,
  FollowUpWorkingPaperQuestionInput,
  GlobalRole,
  InboxContentKey,
  InboxContentParameter,
  ImportProjectTemplateZipInput,
  InChargeRole,
  LinkProjectEngagementInput,
  MoveProjectPlacementInput,
  PrepareProjectConfirmationDispatchInput,
  ProjectFileExportJob,
  ProjectInviteeDirectoryQueryInput,
  ProjectInviteeDirectoryResponse,
  ProjectLanguage,
  ProjectRole,
  ProjectStatus,
  ProjectTemplateFileInput,
  ProjectTemplateListQueryInput,
  ProjectTemplateStatus,
  ReleaseConfirmationDispatchQueueInput,
  RelocateAttachmentInput,
  RenameAttachmentInput,
  ReorderDesktopProjectPlacementsInput,
  ReorderProjectTemplateItemsInput,
  ReorderWorkingPaperAttachmentsInput,
  ReplyWorkingPaperQuestionInput,
  RequestAttachmentUploadUrlInput,
  RequestAttachmentVersionUploadUrlInput,
  RequestProjectTemplateFileUploadUrlInput,
  RestoreAttachmentInput,
  RestoreConfirmationEmpImportInput,
  ReturnConfirmationDispatchQueueInput,
  ReturnWorkingPaperInput,
  ReviewProjectConfirmationResponseInput,
  ReviewQuestionStatus,
  RouteConfirmationResponseLibraryFileInput,
  SaveSmartFormPackageInput,
  ConfirmationAttachmentContract as SharedConfirmationAttachmentContract,
  ConfirmationAttachmentPreviewability as SharedConfirmationAttachmentPreviewability,
  ConfirmationEmpImportDirectory as SharedConfirmationEmpImportDirectory,
  ConfirmationEmpImportItemStatus as SharedConfirmationEmpImportItemStatus,
  ConfirmationEmpImportJob as SharedConfirmationEmpImportJob,
  ConfirmationEmpImportJobItem as SharedConfirmationEmpImportJobItem,
  ConfirmationEmpImportJobStatus as SharedConfirmationEmpImportJobStatus,
  ConfirmationEmpImportMode as SharedConfirmationEmpImportMode,
  ConfirmationEmpImportPreviewItem as SharedConfirmationEmpImportPreviewItem,
  ConfirmationEmpImportPreviewQuery as SharedConfirmationEmpImportPreviewQuery,
  ConfirmationEmpImportPreviewResponse as SharedConfirmationEmpImportPreviewResponse,
  ConfirmationEmpImportSignoffPreview as SharedConfirmationEmpImportSignoffPreview,
  ConfirmationEmpImportSourceProposal as SharedConfirmationEmpImportSourceProposal,
  ConfirmationInformationLibraryCreateInput as SharedConfirmationInformationLibraryCreateInput,
  ConfirmationInformationLibraryEntry as SharedConfirmationInformationLibraryEntry,
  ConfirmationInformationLibraryUpdateInput as SharedConfirmationInformationLibraryUpdateInput,
  CreateConfirmationEmpImportJobInput as SharedCreateConfirmationEmpImportJobInput,
  SmartFormPackage,
  SmartFormTemplateListQueryInput,
  SmartFormV2Definition,
  SmartFormV2ResponseValidationIssue,
  SubmitProjectConfirmationInput,
  TmsProjectLink,
  TmsProjectLinkQuery,
  TmsProjectLinksResponse,
  UpdateAttachmentIdentityInput,
  UpdateDesktopFolderInput,
  UpdateDesktopProjectPlacementInput,
  UpdateProjectConfirmationDraftInput,
  UpdateProjectConfirmationInput,
  UpdateProjectInput,
  UpdateProjectMemberInChargeRoleInput,
  UpdateProjectMemberRoleInput,
  UpdateProjectTemplateInput,
  UpdateProjectTemplateItemCodeInput,
  UpdateProjectTemplateNodeInput,
  UpdateSmartFormTemplateInput,
  UpdateUserInput,
  UpdateWorkflowNodeInput,
  UpdateWorkingPaperAssigneesInput,
  UpdateWorkingPaperInput,
  UpdateWorkspaceInput,
  UserListQueryInput,
  WithdrawConfirmationEmpImportInput,
  WithdrawProjectConfirmationInput,
  WorkingPaperBucket,
  WorkingPaperQuestionMessageType,
  WorkingPaperSignoffType,
  ZipMasterOperation,
  WorkItemDomain,
  WorkItemListResponse,
  WorkItemView,
} from "@project-wing/shared";
import {
  ConfirmationEmpImportEligibleProjectsResponseSchema,
  ConfirmationEmpImportJobSchema,
  ConfirmationEmpImportPreviewQuerySchema,
  ConfirmationEmpImportPreviewResponseSchema,
  ConfirmationInformationLibraryCreateInputSchema,
  ConfirmationInformationLibraryEntrySchema,
  ConfirmationInformationLibraryUpdateInputSchema,
  CreateConfirmationEmpImportJobSchema,
  RestoreConfirmationEmpImportSchema,
  RetryConfirmationEmpImportSchema,
  TmsProjectLinkSchema,
  TmsProjectLinksResponseSchema,
  WithdrawConfirmationEmpImportSchema,
  requestEmailPasswordResetOtp,
  requestEmailSignInOtp,
  resetPasswordWithEmailOtp,
  signInWithBetterAuth,
  signInWithEmailOtp,
  signOutWithBetterAuth,
  verifyEmailPasswordResetOtp,
} from "@project-wing/shared";

import { mockApi } from "./mock-api";
import { getApiMode, isMockApiMode } from "./mode";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
const AUTH_BASE_URL = process.env.NEXT_PUBLIC_AUTH_BASE_URL ?? API_BASE_URL;
const USE_MOCK_API = isMockApiMode(getApiMode());
const PREVIEW_BLOB_ACCEPT = "application/vnd.project-wing.preview";
const PREVIEW_BLOB_MIME = "application/vnd.project-wing.preview";
export type User = {
  id: string;
  email: string;
  name: string;
  globalRole: GlobalRole;
  status?: "ACTIVE" | "DISABLED";
  staffNo?: string | null;
  hourlyRate?: string | null;
  preferredLocale?: "zh-CN" | "en-US";
  declarationAccepted?: boolean;
  declarationAcceptedAt?: string | null;
};

export type DevelopmentAccount = Pick<User, "email" | "name"> & {
  role: GlobalRole;
};

export type UserMailConnection = {
  emailAddress: string;
  connected: boolean;
  provider: "WECOM_EXMAIL";
  status: "CONNECTED" | "ERROR" | null;
  verifiedAt: string | null;
  lastTestedAt: string | null;
  lastError: string | null;
  updatedAt: string | null;
};

export type Tracking17TrackConnection = {
  provider: "TRACKING_17TRACK";
  connected: boolean;
  status: "CONNECTED" | "ERROR" | null;
  verifiedAt: string | null;
  lastTestedAt: string | null;
  lastError: string | null;
  quotaTotal: number | null;
  quotaUsed: number | null;
  quotaRemain: number | null;
  updatedAt: string | null;
  updatedBy: { id: string; name: string; email: string } | null;
};

export type Tracking17TrackCarrier = {
  code: number;
  countryIso: string | null;
  name: string;
  nameZh: string;
  requirements?: Tracking17TrackCarrierRequirement[];
};

export type Tracking17TrackCarrierRequirement = {
  key: string;
  description: string;
  options: Record<string, string> | null;
  required: boolean;
  sample: string | null;
};

export type Project = {
  id: string;
  projectNumber?: number;
  workspaceId: string;
  name: string;
  projectCode: string;
  language?: ProjectLanguage;
  frameworkTemplateId?: string | null;
  frameworkTemplate?: FrameworkTemplate | null;
  applicableAccountingStandard?: string | null;
  reportingDate: string;
  yearEndDate?: string;
  reportDate?: string;
  archiveDeadline?: string;
  industryCode?: string | null;
  industrySourceText?: string | null;
  auditAreaCodes?: string[];
  cmpClientId?: string | null;
  cmpEngagementId?: string | null;
  cmpClient?:
    | (Pick<
        CmpClient,
        | "id"
        | "clientCode"
        | "nameZh"
        | "nameEn"
        | "status"
        | "clientPartnerPic"
        | "clientManagerMic"
      > &
        Partial<
          Pick<
            CmpClient,
            | "companyCode"
            | "companyIdentifierType"
            | "companyNumber"
            | "address"
            | "addresses"
            | "contacts"
            | "website"
            | "yearEndDate"
            | "reportingGaap"
            | "hsicSectionCode"
            | "industryOtherDescription"
            | "placeOfIncorporation"
            | "incorporationYearMonth"
            | "listedOrPrivate"
            | "stockExchangeOrListingPlace"
            | "stockCode"
            | "groupName"
            | "group"
            | "parentClientCode"
            | "parentHoldingCompanyName"
            | "subsidiariesOrAssociates"
            | "updatedAt"
          >
        >)
    | null;
  cmpEngagement?:
    | (Pick<
        CmpEngagement,
        | "id"
        | "clientId"
        | "engagementCode"
        | "serviceType"
        | "yearEndDate"
        | "reportDate"
        | "pic"
        | "mic"
        | "status"
      > &
        Partial<
          Pick<
            CmpEngagement,
            | "otherServiceDescription"
            | "deliverables"
            | "engagementDate"
            | "eqReviewer"
            | "updatedAt"
          >
        >)
    | null;
  rolledForwardFromProjectId?: string | null;
  status: ProjectStatus;
  notes?: string;
  archivePassword?: string | null;
  members?: ProjectMember[];
  desktopFolder?: DesktopFolder;
};

export type AttachmentExportFormat = "original" | "pdf" | "zip";

export type RollForwardPreview = {
  project: Project;
  summary: {
    workflowNodes: number;
    workingPapers: number;
    attachments: number;
    attachmentVersions: number;
    smartForms: number;
  };
  reset: {
    signoffs: boolean;
    reviewQuestions: boolean;
    locks: boolean;
    archiveArtifacts: boolean;
    auditLogs: boolean;
  };
  retained: {
    workflow: boolean;
    workingPapers: boolean;
    attachments: boolean;
    attachmentVersions: boolean;
    smartFormAnswers: boolean;
  };
};

export type FrameworkTemplate = {
  id: string;
  code: string;
  name: string;
  language: ProjectLanguage;
  description?: string | null;
  isActive: boolean;
};

export type ProjectTemplate = {
  id: string;
  code: string;
  name: string;
  language: ProjectLanguage;
  frameworkTemplateId?: string | null;
  frameworkTemplate?: FrameworkTemplate | null;
  description?: string | null;
  status: ProjectTemplateStatus;
  _count?: {
    nodes: number;
    files: number;
    smartForms?: number;
  };
  nodes?: ProjectTemplateNode[];
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectTemplateNode = {
  id: string;
  projectTemplateId: string;
  parentId?: string | null;
  level: number;
  code: string;
  title: string;
  auditAreaCode?: string | null;
  nodeType: "PHASE" | "ACCOUNT" | "WORKING_PAPER";
  sortOrder: number;
  files?: ProjectTemplateFile[];
  smartForms?: ProjectTemplateSmartForm[];
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectTemplateFile = {
  id: string;
  projectTemplateId: string;
  templateNodeId: string;
  code: string;
  title: string;
  fileName: string;
  originalName?: string | null;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  placeholderType?: AttachmentPlaceholderType | null;
  paperType: "WORKING_PAPER" | "SUPPLEMENT";
  sortOrder: number;
  templateItemId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type SmartFormTemplateStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type SmartFormTemplateVersion = {
  id: string;
  templateId: string;
  version: number;
  definitionJson: SmartFormV2Definition;
  definitionHash?: string;
  publishedBy?: string;
  publishedAt: string;
};

export type SmartFormTemplate = {
  id: string;
  code: string;
  name: string;
  frameworkTemplateId: string | null;
  frameworkTemplate?: FrameworkTemplate | null;
  description?: string | null;
  status: SmartFormTemplateStatus;
  draftDefinitionJson: SmartFormV2Definition;
  currentPublishedVersionId?: string | null;
  currentPublishedVersion?: SmartFormTemplateVersion | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectTemplateSmartForm = {
  id: string;
  projectTemplateId: string;
  templateNodeId: string;
  smartFormTemplateId: string;
  smartFormTemplateVersionId: string;
  code: string;
  title: string;
  fileName: string;
  sortOrder: number;
  smartFormTemplate?: SmartFormTemplate | null;
  smartFormTemplateVersion?: SmartFormTemplateVersion | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectTemplateOrderedItem =
  | ({ type: "FILE" } & ProjectTemplateFile)
  | ({ type: "SMART_FORM" } & ProjectTemplateSmartForm);

export type ProjectTemplateApplyPlanItem = {
  templateFileId: string;
  templateNodeId: string;
  sourceCode: string;
  title: string;
  originalName?: string | null;
  paperType: "WORKING_PAPER" | "SUPPLEMENT";
  bucket: WorkingPaperBucket;
  status: "CREATE" | "EXISTS";
  plannedCode: string | null;
  existingWorkingPaper: Pick<
    WorkingPaper,
    "id" | "code" | "title" | "paperType" | "bucket"
  > | null;
};

export type ProjectTemplateApplySmartFormPlanItem = {
  smartFormReferenceId: string;
  templateNodeId: string;
  smartFormTemplateVersionId: string;
  sourceCode: string;
  title: string;
  originalName: string;
  paperType: "WORKING_PAPER";
  bucket: WorkingPaperBucket;
  status: "CREATE" | "EXISTS";
  plannedCode: string | null;
  existingWorkingPaper: Pick<
    WorkingPaper,
    "id" | "code" | "title" | "paperType" | "bucket"
  > | null;
};

export type ProjectTemplateApplyPlan = {
  summary: {
    total: number;
    files?: number;
    smartForms?: number;
    create: number;
    existing: number;
    createFiles?: number;
    createSmartForms?: number;
    existingFiles?: number;
    existingSmartForms?: number;
  };
  items: ProjectTemplateApplyPlanItem[];
  smartFormItems?: ProjectTemplateApplySmartFormPlanItem[];
};

export type ProjectTemplateApplyPreview = {
  template: ProjectTemplate;
  targetNode: Pick<WorkflowNode, "id" | "code" | "title" | "level">;
  plan: ProjectTemplateApplyPlan;
};

export type ProjectTemplateApplyResult = ProjectTemplateApplyPreview & {
  createdWorkingPapers: WorkingPaper[];
  // API returns attachments; legacy/mock responses may wrap them in workpapers.
  createdSmartForms?: (Attachment | WorkingPaper)[];
  createdWorkflowNodes?: WorkflowNode[];
  existingWorkingPapers: Pick<
    WorkingPaper,
    "id" | "code" | "title" | "paperType" | "bucket"
  >[];
  skippedTemplateFileIds: string[];
  skippedSmartFormReferenceIds?: string[];
};

export type SmartFormSessionResponse = {
  attachment: Attachment;
  package: SmartFormPackage;
  lockSessionId: string;
  completion: {
    complete: boolean;
    issues: SmartFormV2ResponseValidationIssue[];
  };
};

export type SmartFormReadResponse = Omit<
  SmartFormSessionResponse,
  "lockSessionId"
> & {
  lockSessionId?: string;
};

export type Workspace = {
  id: string;
  name: string;
  clientName: string;
  description?: string;
  ownerId?: string;
  projects: Project[];
};

export type DesktopFolder = {
  id: string;
  ownerId: string;
  name: string;
  sortOrder: number;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type DesktopProjectPlacement = {
  id: string;
  userId?: string;
  projectId: string;
  folderId: string;
  desktopX: number;
  desktopY: number;
  sortOrder: number;
  lastOpenedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  project: Project;
};

export type DesktopState = {
  folders: DesktopFolder[];
  placements: DesktopProjectPlacement[];
};

export type ProjectMember = {
  authorizationSuspendedAt?: string | null;
  id: string;
  membershipStatus?: "ACTIVE" | "INVITED";
  invitationId?: string;
  invitationExpiresAt?: string | null;
  invitedAt?: string | null;
  projectRole: ProjectRole;
  inChargeRole?: InChargeRole | null;
  allowedProjectRoles: ProjectRole[];
  roleConsistent: boolean;
  roleConflictReason?: string | null;
  declarationAccepted: boolean;
  declarationAcceptedAt?: string | null;
  user: User;
};

export type ProjectDeclarationStatus = {
  accepted: boolean;
  acceptedAt?: string | null;
};

export type ConfirmationShipmentTrackingEvent = {
  at?: string | null;
  description: string;
  location?: string | null;
  stage?: string | null;
  substatus?: string | null;
};

export type ProjectConfirmationDispatch = {
  id: string;
  confirmationId: string;
  artifactId?: string | null;
  sequence: number;
  method: ConfirmationDispatchMethod;
  executionStatus?: "QUEUED" | "STARTED" | "SENT" | "DELIVERED" | "FAILED";
  sentAt?: string | null;
  deliveredAt?: string | null;
  senderName?: string | null;
  applicantName?: string | null;
  courierName?: string | null;
  trackingNumber?: string | null;
  trackingProvider?: string | null;
  trackingCarrierCode?: number | null;
  trackingCarrierName?: string | null;
  trackingStatus?: string | null;
  trackingSubstatus?: string | null;
  trackingDescription?: string | null;
  trackingLocation?: string | null;
  trackingEvents?: ConfirmationShipmentTrackingEvent[] | null;
  trackingRegisteredAt?: string | null;
  trackingLastEventAt?: string | null;
  trackingUpdatedAt?: string | null;
  trackingStoppedAt?: string | null;
  trackingError?: string | null;
  dispatchReference?: string | null;
  recipientName?: string | null;
  recipientContact?: string | null;
  recipientPhone?: string | null;
  followUpDate?: string | null;
  attachmentName?: string | null;
  attachmentObjectKey?: string | null;
  attachmentMimeType?: string | null;
  attachmentSize?: number | null;
  attachmentSha256?: string | null;
  notes?: string | null;
  createdBy: string;
  createdAt: string;
  events?: {
    id: string;
    eventType: string;
    actorId?: string | null;
    source: string;
    payload?: unknown;
    occurredAt: string;
    createdAt: string;
  }[];
};

export type ProjectConfirmationFollowUpEvent = {
  id: string;
  confirmationId: string;
  eventType: ConfirmationFollowUpEventType;
  actorId?: string | null;
  source: string;
  notes?: string | null;
  payload?: unknown;
  occurredAt: string;
  createdAt: string;
};

export type ProjectConfirmationResponse = {
  id: string;
  confirmationId: string;
  responseStatus: ConfirmationResponseStatus;
  responseChannel?: ConfirmationResponseChannel | null;
  sourcePackageId?: string | null;
  matchMethod?: ConfirmationResponseMatchMethod | null;
  routingStatus: ConfirmationResponseRoutingStatus;
  responsibleUserId?: string | null;
  receivingUserId?: string | null;
  pageCount?: number | null;
  conditionNotes?: string | null;
  storageLocation?: string | null;
  receivedAt?: string | null;
  receivedBy?: string | null;
  responseReference?: string | null;
  responseAddress?: string | null;
  attachmentName?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  artifacts?: ProjectConfirmationResponseArtifact[];
};

export type ProjectConfirmationResponseArtifact = {
  id: string;
  responseId: string;
  sequence: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  uploadedBy: string;
  capturedAt: string;
  createdAt: string;
};

export type ProjectConfirmationArtifact = {
  id: string;
  confirmationId: string;
  version: number;
  disposition: "ACTIVE" | "INVALIDATED" | "RETURNED";
  templateCode: ConfirmationDraftTemplateCode | "UPLOADED_DOCUMENT";
  templateVersion: string;
  docxSize: number;
  pdfSize: number;
  pdfSha256: string;
  submittedBy: string;
  submittedAt: string;
  invalidatedBy?: string | null;
  invalidatedAt?: string | null;
  invalidationReason?: string | null;
};

export type ProjectConfirmationAttachment =
  SharedConfirmationAttachmentContract;

export type ConfirmationTemplateDesignFieldKind =
  | "TEXT"
  | "MULTILINE"
  | "NUMBER"
  | "DATE"
  | "CHECKBOX"
  | "SELECT"
  | "RADIO"
  | "STATIC_TEXT"
  | "MASK";

export type ConfirmationTemplateDesignFieldBinding =
  | `custom:${string}`
  | "accountNumber"
  | "auditorAddress"
  | "auditorName"
  | "authorizationAccount"
  | "bankName"
  | "clientName"
  | "micEmail"
  | "micNameAndInitial"
  | "officeDate"
  | "recipientAddress"
  | "recipientName"
  | "referenceCode"
  | "picName"
  | "micName"
  | "reportDate"
  | "salutation"
  | "yearEndDate";

export type ConfirmationTemplateDefaultValueSource =
  | {
      binding: ConfirmationTemplateDesignFieldBinding;
      source: "BASE_INFORMATION" | "INFORMATION_LIBRARY";
    }
  | { source: "CUSTOM"; value: string }
  | { source: "SYSTEM"; value: "CURRENT_DATE" };

export type ConfirmationTemplateDesignFieldSourceRange = {
  end: number;
  paragraphId?: string;
  paragraphOrdinal: number;
  paragraphXmlSha256: string;
  part: "word/document.xml";
  sourceText: string;
  start: number;
};

export type ConfirmationTemplateDesignField = {
  defaultChecked?: boolean;
  defaultValueSource?: ConfirmationTemplateDefaultValueSource;
  id: string;
  kind: ConfirmationTemplateDesignFieldKind;
  name: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  placeholder: string;
  options: string[];
  required?: boolean;
  textStyle?: ConfirmationTemplateTextStyle;
  textAlign?: "left" | "center" | "right";
  /** Legacy binding is retained for templates saved before the two sources were split. */
  binding?: ConfirmationTemplateDesignFieldBinding;
  baseInformationBinding?: ConfirmationTemplateDesignFieldBinding;
  informationLibraryBinding?: ConfirmationTemplateDesignFieldBinding;
  sourceRanges?: ConfirmationTemplateDesignFieldSourceRange[];
};

export type ConfirmationTemplateDesign = {
  version: 1;
  fields: ConfirmationTemplateDesignField[];
};

export type ConfirmationTemplateDesignStatus = "DRAFT" | "ENABLED" | "DISABLED";

export type UpdateConfirmationTemplateLibraryDesignInput = {
  designSchema: ConfirmationTemplateDesign;
  designStatus: Exclude<ConfirmationTemplateDesignStatus, "DISABLED">;
};

export type UpdateConfirmationTemplateLibraryStatusInput = {
  designStatus: ConfirmationTemplateDesignStatus;
};

export type BulkUpdateConfirmationTemplateLibraryStatusInput = {
  templateIds: string[];
  designStatus: ConfirmationTemplateDesignStatus;
};

export type ConfirmationTemplateLibraryFile = {
  id: string;
  code: string;
  name: string;
  confirmationType: ConfirmationType;
  description?: string | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  isBuiltIn: boolean;
  uploadedById: string;
  uploader: Pick<User, "id" | "name">;
  createdAt: string;
  updatedAt: string;
  designSchema: ConfirmationTemplateDesign | null;
  designStatus: ConfirmationTemplateDesignStatus;
  enabledAt: string | null;
};

export type ConfirmationResponseLibraryFile = {
  id: string;
  code: string;
  title: string;
  receivedAt: string;
  courierTrackingNumber?: string | null;
  referenceNumber?: string | null;
  clientName: string;
  respondingEntity: string;
  notes?: string | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedById: string;
  uploader: Pick<User, "id" | "name">;
  projectId?: string | null;
  confirmationId?: string | null;
  provisionalType?: ConfirmationType | null;
  routingStatus: ConfirmationResponseLibraryRoutingStatus;
  routedById?: string | null;
  routedBy?: Pick<User, "id" | "name"> | null;
  routedAt?: string | null;
  matchedResponseId?: string | null;
  project?: Pick<Project, "id" | "name" | "projectCode"> | null;
  confirmation?: Pick<
    ProjectConfirmation,
    | "id"
    | "confirmationCode"
    | "counterpartyName"
    | "displayName"
    | "type"
    | "status"
    | "differenceStatus"
  > | null;
  createdAt: string;
  updatedAt: string;
};

export type ConfirmationInformationLibraryEntry =
  SharedConfirmationInformationLibraryEntry;
export type ConfirmationInformationLibraryCreateInput =
  SharedConfirmationInformationLibraryCreateInput;
export type ConfirmationInformationLibraryUpdateInput =
  SharedConfirmationInformationLibraryUpdateInput;

export type ConfirmationInformationLibraryQuery = {
  entryId?: string;
  query?: string;
  includeInactive?: boolean;
};

export type ConfirmationDispatchQueueItem = {
  confirmationId: string;
  confirmationCode: string | null;
  project: { id: string; name: string; projectCode: string };
  type: ConfirmationType;
  counterpartyName: string;
  templateCode: ConfirmationDraftTemplateCode | null;
  artifact: {
    id: string;
    version: number;
    disposition: "ACTIVE" | "INVALIDATED" | "RETURNED";
    templateCode: ConfirmationDraftTemplateCode;
    templateVersion: string;
    pdfSha256: string;
    submittedAt: string;
  } | null;
  preparedDispatchMethod: ConfirmationDispatchMethod | null;
  plannedSendDate: string | null;
  queuedAt: string | null;
  updatedAt: string;
  stage: "AWAITING_CLAIM" | "PENDING_DISPATCH" | "SENT" | "OUT_OF_SCOPE";
  queueStatus: "UNCLAIMED" | "CLAIMED" | "RETURNED";
  validationStatus: "READY" | "NEEDS_REVISION";
  claim: { userId: string; claimedAt: string } | null;
  pic: { id: string; name: string; email: string } | null;
  revisionReason: string | null;
  latestDispatch: {
    id: string;
    method: ConfirmationDispatchMethod;
    executionStatus: "QUEUED" | "STARTED" | "SENT" | "DELIVERED" | "FAILED";
    sentAt: string | null;
    deliveredAt: string | null;
    courierName: string | null;
    trackingNumber: string | null;
    providerName: string | null;
    providerReference: string | null;
  } | null;
};

export type ConfirmationDispatchBatchItem = {
  id: string;
  confirmationId: string;
  artifactId: string;
  status: "QUEUED" | "CLAIMED" | "SENT" | "FAILED" | "RETURNED";
  errorCode?: string | null;
  errorMessage?: string | null;
  confirmation: {
    id: string;
    projectId: string;
    confirmationCode: string | null;
    counterpartyName: string;
  };
  artifact: {
    id: string;
    version: number;
    disposition: "ACTIVE" | "INVALIDATED" | "RETURNED";
    templateCode: ConfirmationDraftTemplateCode;
  };
  dispatch?: { id: string; executionStatus: string } | null;
};

export type ConfirmationDispatchBatch = {
  id: string;
  method: "COURIER" | "POST" | "HAND_DELIVERY" | "OTHER";
  status:
    | "QUEUED"
    | "EXECUTING"
    | "COMPLETED"
    | "PARTIAL_FAILURE"
    | "FAILED"
    | "CANCELLED";
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
  items: ConfirmationDispatchBatchItem[];
};

export type ProjectConfirmation = {
  id: string;
  projectId: string;
  type: ConfirmationType;
  status: ConfirmationStatus;
  voidedFromStatus?: ConfirmationStatus | null;
  displayName?: string | null;
  clientName?: string | null;
  confirmationCode?: string | null;
  auditPeriod?: string | null;
  counterpartyName: string;
  respondingEntityName?: string | null;
  thirdPartyName?: string | null;
  subjectName?: string | null;
  attachmentName?: string | null;
  attachmentMimeType?: string | null;
  originalFileName?: string | null;
  originalMimeType?: string | null;
  previewability?: SharedConfirmationAttachmentPreviewability | null;
  downloadUrl?: string | null;
  previewUrl?: string | null;
  attachment?: ProjectConfirmationAttachment | null;
  uploadedFileNames?: string[];
  counterpartyContact?: string | null;
  counterpartyAddress?: string | null;
  draftTemplateCode?: ConfirmationDraftTemplateCode | null;
  draftPayload?: ConfirmationDraftPayload | null;
  draftUpdatedAt?: string | null;
  submissionVersion?: number;
  currentArtifactId?: string | null;
  currentArtifact?: ProjectConfirmationArtifact | null;
  queuedAt?: string | null;
  queueClaimedBy?: string | null;
  queueClaimedAt?: string | null;
  revisionReason?: string | null;
  revisionRequestedBy?: string | null;
  revisionRequestedAt?: string | null;
  responsibleUserId?: string | null;
  plannedSendDate?: string | null;
  reportDeadline?: string | null;
  preparedDispatchMethod?: ConfirmationDispatchMethod | null;
  preparedSenderName?: string | null;
  preparedApplicantName?: string | null;
  preparedCourierName?: string | null;
  preparedTrackingNumber?: string | null;
  preparedDispatchReference?: string | null;
  preparedRecipientName?: string | null;
  preparedRecipientContact?: string | null;
  preparedRecipientPhone?: string | null;
  preparedFollowUpDate?: string | null;
  preparedAttachmentName?: string | null;
  preparedDispatchNotes?: string | null;
  preparedDispatchReadyBy?: string | null;
  preparedDispatchReadyAt?: string | null;
  teamConfirmStatus: ConfirmationTeamConfirmStatus;
  teamConfirmedByName?: string | null;
  teamConfirmedAt?: string | null;
  differenceStatus?: ConfirmationDifferenceStatus | null;
  notes?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  project?: Pick<
    Project,
    "id" | "name" | "projectCode" | "reportDate" | "status"
  > | null;
  responsibleUser?: Pick<User, "id" | "name" | "email" | "globalRole"> | null;
  creator?: Pick<User, "id" | "name" | "email" | "globalRole"> | null;
  dispatches?: ProjectConfirmationDispatch[];
  responses?: ProjectConfirmationResponse[];
  empImportItems?: {
    responseArtifactId: string | null;
    attachmentId: string | null;
    attachment: { deletedAt: string | null } | null;
  }[];
  followUpEvents?: ProjectConfirmationFollowUpEvent[];
};

export type ProjectConfirmationDefaults = {
  id?: string;
  projectId: string;
  clientName: string | null;
  confirmationDate: string | null;
  reference: string | null;
  pic: string | null;
  mic: string | null;
  reportDate: string | null;
  baseInformation?: ProjectConfirmationBaseInformation | null;
  updatedAt: string | null;
};

export type ConfirmationGeneralField = { id: string; name: string };
export type ConfirmationGeneralLayout = {
  sections: {
    id: string;
    name: string;
    fields: (ConfirmationGeneralField & {
      binding?: string;
      colSpan?: 1 | 2;
    })[];
  }[];
};

export type ProjectConfirmationBaseInformation = {
  customFields?: { id: string; name: string; value: string }[];

  clientNames: string[];
  references: string[];
  banks: {
    name: string;
    account: string;
    address: string;
  }[];
};

export type UpdateProjectConfirmationDefaultsInput = {
  clientName: string;
  confirmationDate: string;
  reference: string;
  pic: string;
  mic: string;
  reportDate: string;
  baseInformation?: ProjectConfirmationBaseInformation | null;
};

export function getProjectConfirmationAttachment(
  confirmation: Pick<
    ProjectConfirmation,
    | "attachment"
    | "attachmentName"
    | "attachmentMimeType"
    | "originalFileName"
    | "originalMimeType"
    | "previewability"
    | "downloadUrl"
    | "previewUrl"
  >
): ProjectConfirmationAttachment {
  return {
    originalFileName:
      confirmation.attachment?.originalFileName ??
      confirmation.originalFileName ??
      confirmation.attachmentName ??
      null,
    originalMimeType:
      confirmation.attachment?.originalMimeType ??
      confirmation.originalMimeType ??
      confirmation.attachmentMimeType ??
      null,
    previewability:
      confirmation.attachment?.previewability ??
      confirmation.previewability ??
      null,
    downloadUrl:
      confirmation.attachment?.downloadUrl ?? confirmation.downloadUrl ?? null,
    previewUrl:
      confirmation.attachment?.previewUrl ?? confirmation.previewUrl ?? null,
  };
}

export type ConfirmationEmpImportMode = SharedConfirmationEmpImportMode;

export type ConfirmationEmpImportItemStatus =
  SharedConfirmationEmpImportItemStatus;

export type ConfirmationEmpImportJobStatus =
  SharedConfirmationEmpImportJobStatus;

export type ConfirmationEmpProject = {
  id: string;
  projectCode: string;
  name: string;
  reportDate?: string | null;
  status: ProjectStatus;
  importEligible: boolean;
  eligibilityReason?: string | null;
};

export type ConfirmationEmpDirectory = {
  id: SharedConfirmationEmpImportDirectory["id"];
  code: SharedConfirmationEmpImportDirectory["code"];
  title: SharedConfirmationEmpImportDirectory["title"];
  path: SharedConfirmationEmpImportDirectory["path"];
  level: SharedConfirmationEmpImportDirectory["level"];
  canAcceptWorkflow: SharedConfirmationEmpImportDirectory["canAcceptWorkflow"];
};

export type ConfirmationEmpImportSignoffPreview =
  SharedConfirmationEmpImportSignoffPreview;

export type ConfirmationEmpImportSourceProposal =
  SharedConfirmationEmpImportSourceProposal;

export type ConfirmationEmpImportPreviewItem = {
  existingJobId?: string;
  existingItemId?: string;
  reimportTargetDirectoryId?: string;
  existingMode?: ConfirmationEmpImportMode;
  targetState?: "AVAILABLE" | "RECYCLED" | "MISSING" | "CHANGED" | "UNVERIFIED";
  id: SharedConfirmationEmpImportPreviewItem["id"];
  sourceConfirmationId?: string;
  confirmationId: SharedConfirmationEmpImportPreviewItem["confirmationId"];
  confirmationCode: SharedConfirmationEmpImportPreviewItem["confirmationCode"];
  counterparty: SharedConfirmationEmpImportPreviewItem["counterparty"];
  role: SharedConfirmationEmpImportPreviewItem["role"];
  sourceFileName: SharedConfirmationEmpImportPreviewItem["sourceFileName"];
  sourceFileSize: SharedConfirmationEmpImportPreviewItem["sourceFileSize"];
  sourceProposal?: ConfirmationEmpImportSourceProposal;
  proposedCode: string;
  proposedName: string;
  status: ConfirmationEmpImportItemStatus;
  existingLocation?: string | null;
  existingCode?: string | null;
  signoff: ConfirmationEmpImportSignoffPreview;
  zipEntryName?: string | null;
  blockingIssues: string[];
};

export type ConfirmationEmpImportPreviewInput =
  SharedConfirmationEmpImportPreviewQuery;

export type ConfirmationEmpImportPreview = Omit<
  SharedConfirmationEmpImportPreviewResponse,
  "items"
> & {
  items: ConfirmationEmpImportPreviewItem[];
};

export type ConfirmationEmpImportRequest = Omit<
  SharedCreateConfirmationEmpImportJobInput,
  "items"
> & {
  items: {
    id: string;
    sourceConfirmationId?: string;
    empCode?: string;
    businessName?: string;
    code?: string;
    name?: string;
  }[];
};

export type ConfirmationEmpImportWithdrawInput =
  WithdrawConfirmationEmpImportInput;

export type ConfirmationEmpImportRestoreInput =
  RestoreConfirmationEmpImportInput;

export type ConfirmationEmpImportJobItem = Omit<
  SharedConfirmationEmpImportJobItem,
  "sourceFileName"
> & {
  sourceFileName?: string;
};

export type ConfirmationEmpImportJob = Omit<
  SharedConfirmationEmpImportJob,
  "items"
> & {
  items: ConfirmationEmpImportJobItem[];
};

export type ConfirmationEmpImportClient = {
  confirmationEmpProjects: () => Promise<ConfirmationEmpProject[]>;
  workflow: (projectId: string) => Promise<WorkflowNode[]>;
  confirmationEmpPreview: (
    projectId: string,
    input: ConfirmationEmpImportPreviewInput
  ) => Promise<ConfirmationEmpImportPreview>;
  createConfirmationEmpImport: (
    projectId: string,
    input: ConfirmationEmpImportRequest
  ) => Promise<ConfirmationEmpImportJob>;
  confirmationEmpImportJob: (
    projectId: string,
    jobId: string
  ) => Promise<ConfirmationEmpImportJob>;
  confirmationEmpImportHistory: (
    projectId: string
  ) => Promise<ConfirmationEmpImportJob[]>;
  retryConfirmationEmpImport: (
    projectId: string,
    jobId: string
  ) => Promise<ConfirmationEmpImportJob>;
  withdrawConfirmationEmpImport: (
    projectId: string,
    jobId: string,
    input: WithdrawConfirmationEmpImportInput
  ) => Promise<ConfirmationEmpImportJob>;
  restoreConfirmationEmpImport: (
    projectId: string,
    jobId: string,
    input: RestoreConfirmationEmpImportInput
  ) => Promise<ConfirmationEmpImportJob>;
};

export { isConfirmationEmpImportDirectoryAllowed as canUseConfirmationEmpDirectory } from "@project-wing/shared";

export type ArchiveCheckIssueType =
  | "MISSING_PREPARER_SIGNOFF"
  | "MISSING_REVIEWER_SIGNOFF"
  | "REVIEW_SIGNOFF_BEFORE_PREPARER"
  | "SELF_REVIEWED_WORKING_PAPER"
  | "OPEN_REVIEW_QUESTION"
  | "LOCKED_ATTACHMENT"
  | "SMART_FORM_INCOMPLETE"
  | "DOCX_TRACK_CHANGES"
  | "DOCX_UNRESOLVED_COMMENT"
  | "XLSX_UNRESOLVED_COMMENT"
  | "XLSX_ERROR_VALUE"
  | "OFFICE_FILE_CHECK_FAILED";

export type ArchiveCheckIssueAction = {
  type:
    | "OPEN_WORKING_PAPER"
    | "OPEN_SIGNOFF"
    | "OPEN_REVIEW_QUESTION"
    | "OPEN_ATTACHMENT";
  workingPaperId?: string;
  reviewQuestionId?: string;
  attachmentId?: string;
};

export type ArchiveCheckIssueLocation = {
  attachmentId?: string;
  attachmentName?: string;
  projectPath?: string;
  sheetName?: string;
  cellAddress?: string;
  value?: string;
  part?: string;
  excerpt?: string;
  commentAuthor?: string;
};

export type ArchiveCheckIssue = {
  type: ArchiveCheckIssueType;
  severity: "BLOCKER" | "WARNING";
  message: string;
  workingPaper?: Pick<WorkingPaper, "id" | "code" | "title">;
  reviewQuestion?: {
    id: string;
    status: ReviewQuestionStatus;
    assignedTo?: Pick<User, "id" | "name" | "email"> | null;
  };
  attachment?: {
    id: string;
    name: string;
    lockedBy?: Pick<User, "id" | "name" | "email"> | null;
    lockedAt?: string | null;
  };
  member?: Pick<User, "id" | "name" | "email"> | null;
  location?: ArchiveCheckIssueLocation;
  action?: ArchiveCheckIssueAction;
};

export type ArchiveCheckId =
  | "SIGNOFF_MISSING"
  | "SIGNOFF_DATE_ORDER"
  | "SELF_REVIEW"
  | "OPEN_REVIEW_QUESTIONS"
  | "MASTER_LOCKS"
  | "SMART_FORMS"
  | "WORD_ISSUES"
  | "EXCEL_COMMENTS"
  | "EXCEL_ERROR_VALUES"
  | "OFFICE_INSPECTION";

export type ArchiveCheckStatus = "PASSED" | "WARNING" | "BLOCKER" | "FAILED";

export type ArchiveCheckGroup = {
  id: ArchiveCheckId;
  name: string;
  status: ArchiveCheckStatus;
  severity?: "BLOCKER" | "WARNING";
  counts: {
    issues: number;
    blockers: number;
    warnings: number;
  };
  issues: ArchiveCheckIssue[];
};

export type ArchiveCheckReport = {
  project: Pick<Project, "id" | "projectCode" | "name">;
  generatedAt: string;
  ready: boolean;
  summary: {
    attachments: number;
    blockers: number;
    warnings: number;
    missingPreparerSignoffs?: number;
    missingReviewerSignoffs?: number;
    signoffDateIssues?: number;
    selfReviewedAttachments: number;
    unresolvedReviewQuestions: number;
    lockedAttachments: number;
    incompleteSmartForms: number;
    officeFileIssues?: number;
  };
  checks?: ArchiveCheckGroup[];
  issues: ArchiveCheckIssue[];
};

export type ArchiveCheckProgressGroupId =
  | "signoffs"
  | "reviewQuestions"
  | "workpaperFiles"
  | "officeFiles"
  | "finalizing";

export type ArchiveCheckProgressGroup = {
  id: ArchiveCheckProgressGroupId;
  label: string;
  completedUnits: number;
  totalUnits: number;
  status: "pending" | "running" | "completed";
};

export type ArchiveCheckJobSnapshot = {
  jobId: string;
  projectId: string;
  status: "queued" | "running" | "completed" | "failed";
  currentPhase: ArchiveCheckProgressGroupId;
  currentLabel?: string;
  progress: {
    completedUnits: number;
    totalUnits: number;
    groups: ArchiveCheckProgressGroup[];
  };
  report?: ArchiveCheckReport;
  error?: { message: string };
  createdAt: string;
  updatedAt: string;
};

export type ProjectArchiveArtifact = {
  id: string;
  projectId: string;
  fileName: string;
  objectKey: string;
  fileSize: number;
  mimeType: string;
  createdBy: string;
  createdAt: string;
};

export type ArchiveJobSnapshot = {
  jobId: string;
  projectId: string;
  status: "queued" | "running" | "completed" | "failed";
  currentPhase: "fileCheck" | "packaging" | "uploading" | "finalizing";
  currentLabel?: string;
  progress: {
    completedUnits: number;
    totalUnits: number;
  };
  artifact?: ProjectArchiveArtifact;
  error?: { message: string };
  createdAt: string;
  updatedAt: string;
};

export type ArchiveJobEventHandler = (job: ArchiveJobSnapshot) => void;
export type ProjectFileExportJobEventHandler = (
  job: ProjectFileExportJob
) => void;

export type WorkflowNode = {
  id: string;
  parentId?: string | null;
  code: string;
  title: string;
  level: number;
  nodeType: string;
  workingPapers: WorkingPaper[];
  attachments?: Attachment[];
  children?: WorkflowNode[];
};

export type WorkingPaper = {
  id: string;
  projectId: string;
  workflowNodeId: string;
  templateItemId?: string | null;
  code: string;
  title: string;
  paperType: "WORKING_PAPER" | "SUPPLEMENT";
  bucket?: WorkingPaperBucket;
  preparerId?: string | null;
  reviewerId?: string | null;
  preparedAt?: string | null;
  reviewedAt?: string | null;
  returnedAt?: string | null;
  reviewNote?: string | null;
  preparer?: Pick<User, "id" | "name" | "email"> | null;
  reviewer?: Pick<User, "id" | "name" | "email"> | null;
  signoffs?: WorkingPaperSignoff[];
  reviewQuestions?: WorkingPaperQuestion[];
  attachments?: Attachment[];
};

export type WorkingPaperSignoff = {
  id: string;
  attachmentId?: string | null;
  type: WorkingPaperSignoffType;
  roundNumber?: number;
  isCurrent?: boolean;
  attachmentVersionId?: string | null;
  attachmentVersion?: number | null;
  contentHash?: string | null;
  signedAt: string;
  revokedAt?: string | null;
  revokedBy?: Pick<User, "id" | "name" | "email"> | null;
  revocationReason?: string | null;
  user: Pick<User, "id" | "name" | "email">;
};

export type AttachmentSignoffHistory = {
  attachmentId: string;
  total: number;
  currentRoundNumber: number | null;
  currentStatus: "PENDING_PREPARER" | "PENDING_REVIEW" | "COMPLETED";
  rounds: {
    roundNumber: number;
    status: "COMPLETED" | "PENDING_REVIEW" | "SUPERSEDED" | "REVOKED";
    signoffs: WorkingPaperSignoff[];
  }[];
};

export type WorkingPaperQuestion = {
  id: string;
  projectId: string;
  workingPaperId: string;
  attachmentId?: string | null;
  smartFormNodeId?: string | null;
  smartFormRowId?: string | null;
  smartFormTargetLabel?: string | null;
  body: string;
  status: ReviewQuestionStatus;
  assignedToId: string | null;
  createdById: string;
  repliedById?: string | null;
  replyBody?: string | null;
  repliedAt?: string | null;
  clearedById?: string | null;
  clearedAt?: string | null;
  reopenedById?: string | null;
  reopenedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTo?: Pick<User, "id" | "name" | "email"> | null;
  createdBy?: Pick<User, "id" | "name" | "email"> | null;
  repliedBy?: Pick<User, "id" | "name" | "email"> | null;
  clearedBy?: Pick<User, "id" | "name" | "email"> | null;
  reopenedBy?: Pick<User, "id" | "name" | "email"> | null;
  messages?: WorkingPaperQuestionMessage[];
};

export type WorkingPaperQuestionMessage = {
  id: string;
  questionId: string;
  authorId: string;
  messageType: WorkingPaperQuestionMessageType;
  body: string;
  createdAt: string;
  author?: Pick<User, "id" | "name" | "email"> | null;
  images?: ReviewQuestionMessageImage[];
  references?: ReviewQuestionMessageReference[];
};

export type ReviewQuestionMessageImage = {
  id: string;
  messageId: string;
  fileName: string;
  originalName?: string | null;
  objectKey: string;
  fileSize: number;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  createdAt: string;
};

export type ReviewQuestionMessageReference = {
  id: string;
  messageId: string;
  workingPaperId: string;
  createdAt: string;
  workingPaper: {
    id: string;
    code: string;
    title: string;
    workflowNodeId: string;
    bucket: WorkingPaperBucket;
  };
};

export type Attachment = {
  confirmationEmpImportItems?: { id: string }[];
  id: string;
  workingPaperId?: string | null;
  workflowNodeId?: string | null;
  bucket?: WorkingPaperBucket | null;
  code?: string | null;
  title?: string | null;
  preparerId?: string | null;
  reviewerId?: string | null;
  preparedAt?: string | null;
  reviewedAt?: string | null;
  returnedAt?: string | null;
  reviewNote?: string | null;
  templateItemId?: string | null;
  fileKind: AttachmentFileKind;
  placeholderType?: AttachmentPlaceholderType | null;
  fileName: string;
  originalName?: string | null;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  sortOrder?: number;
  version: number;
  contentHash?: string | null;
  lockEpoch?: number;
  conflictFrozenAt?: string | null;
  conflictCandidateVersionId?: string | null;
  createdAt?: string;
  headVersionId?: string | null;
  workDate?: string | null;
  lockedBy?: string | null;
  lockedAt?: string | null;
  lockExpiresAt?: string | null;
  lockSessionId?: string | null;
  lockHeartbeatAt?: string | null;
  lockStaleAt?: string | null;
  lockRevokedAt?: string | null;
  lockRevokedBy?: string | null;
  lockReleaseReason?: string | null;
  uploadedBy?: string | null;
  deletedAt?: string | null;
  deletedBy?: string | null;
  deletedFromWorkingPaperId?: string | null;
  deletedFromWorkflowNodeId?: string | null;
  deletedFromWorkingPaperCode?: string | null;
  deletedFromWorkingPaperTitle?: string | null;
  restoredAt?: string | null;
  restoredBy?: string | null;
  lastModifiedBy?: string | null;
  lastModifiedAt?: string | null;
  uploader?: Pick<User, "id" | "name" | "email"> | null;
  lockHolder?: Pick<User, "id" | "name" | "email"> | null;
  deletedByUser?: Pick<User, "id" | "name" | "email"> | null;
  restoredByUser?: Pick<User, "id" | "name" | "email"> | null;
  lastModifier?: Pick<User, "id" | "name" | "email"> | null;
  signoffs?: WorkingPaperSignoff[];
  reviewQuestions?: WorkingPaperQuestion[];
  smartFormInstance?: {
    status: "INCOMPLETE" | "COMPLETE";
  } | null;
};

export type AttachmentVersion = {
  id: string;
  attachmentId: string;
  projectId: string;
  version: number;
  parentVersionId?: string | null;
  sourceVersionId?: string | null;
  fileKind: AttachmentFileKind;
  fileName: string;
  originalName?: string | null;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  workDate?: string | null;
  uploadedBy?: string | null;
  uploadedAt: string;
  archivedBy: string;
  action?: "INITIAL" | "UPLOAD" | "CHECK_IN" | "RESTORE" | "MIGRATION" | string;
  message?: string | null;
  isCurrent?: boolean;
  contentHash?: string | null;
  conflictState?: "OPEN" | "RESOLVED" | string | null;
  conflictBaseVersionId?: string | null;
  conflictServerVersionId?: string | null;
  conflictResolvedBy?: string | null;
  conflictResolvedAt?: string | null;
  conflictResolution?: AttachmentConflictResolution | null;
  createdAt: string;
  uploadedByUser?: Pick<User, "id" | "name" | "email"> | null;
  archivedByUser?: Pick<User, "id" | "name" | "email"> | null;
};

export type AttachmentConflictResolution =
  | "KEEP_SERVER"
  | "USE_CANDIDATE"
  | "REVERT_TO_BASE";

export type AttachmentConflictSummary = {
  frozen: boolean;
  frozenAt?: string | null;
  headVersionId?: string | null;
  candidateVersionId?: string | null;
  candidates: AttachmentVersion[];
};

export type AttachmentUploadGrant = {
  objectKey: string;
  fileName: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: string;
};

export type ProjectAttachment = Attachment & {
  workingPaper?: {
    id: string;
    attachmentId?: string;
    code: string;
    title: string;
    bucket?: WorkingPaperBucket;
    workflowNodeId: string;
    workflowNodeCode: string;
    workflowNodeTitle: string;
    signoffs?: WorkingPaperSignoff[];
    reviewQuestions?: WorkingPaperQuestion[];
    path: {
      id: string;
      code: string;
      title: string;
      level: number;
    }[];
  } | null;
};

export type ZipMasterEntry =
  | {
      type: "folder";
      name: string;
      path: string;
      modifiedAt?: string;
      children: ZipMasterEntry[];
    }
  | {
      type: "file";
      name: string;
      path: string;
      modifiedAt?: string;
      size: number;
      status?: "MASTER";
      masterState?: ZipMasterSessionState;
    };

export type ZipMasterSessionState =
  | "OPEN"
  | "DIRTY"
  | "CLOSING_WAITING_ENTRIES"
  | "CHECKING_IN"
  | "RELEASING"
  | "CLOSED"
  | "CHECKIN_FAILED"
  | "RELEASE_FAILED"
  | "RECOVERABLE"
  | "LOCK_REVOKED"
  | "BASE_VERSION_CONFLICT"
  | "DRAFT_EXPIRED";

export type ZipMasterSessionResponse = {
  ok: true;
  mode: "MASTER";
  sessionId: string;
  attachmentId: string;
  projectId: string;
  lockSessionId: string;
  fileName: string;
  version: number;
  state: ZipMasterSessionState;
  dirty: boolean;
  activeEntryMasters?: {
    entryPath: string;
    state: ZipMasterSessionState;
  }[];
  entries: ZipMasterEntry[];
};

export type ZipMasterOpenResponse =
  | ZipMasterSessionResponse
  | {
      ok: false;
      code: "LOCKED_BY_OTHER";
      holderName: string;
    };

export type ZipReadOnlyResponse = {
  ok: true;
  mode: "READ_ONLY";
  attachmentId: string;
  projectId: string;
  fileName: string;
  version: number;
  entries: ZipMasterEntry[];
};

export type ZipEntryMasterOpenResponse = {
  ok: true;
  mode: "ZIP_ENTRY_MASTER";
  projectId: string;
  attachmentId: string;
  zipMasterSessionId: string;
  entryPath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  lockSessionId: string;
  baseVersion: number;
  contentToken?: string;
  cacheVersionId?: string;
  cacheOwnerId?: string;
  contentHash?: string;
  directUploadSupported?: boolean;
  grantSecret: string;
  downloadUrl: string;
  heartbeatUrl: string;
  checkInUrl: string;
  releaseUrl: string;
};

type ZipMasterNonFileOperation = Exclude<
  ZipMasterOperation,
  { type: "ADD_FILE" | "REPLACE_FILE" }
>;

export type ZipMasterFileOperationInput = {
  type: "ADD_FILE" | "REPLACE_FILE";
  entryPath: string;
};

export type ZipMasterTextOperationInput = ZipMasterNonFileOperation;

export type ZipMasterOperationInput =
  | ZipMasterFileOperationInput
  | ZipMasterTextOperationInput;

export type ZipMasterCloseResponse = {
  ok: true;
  checkedIn: boolean;
  discarded: boolean;
  queued?: boolean;
  waitingForEntries?: boolean;
  activeEntryMasters?: {
    entryPath: string;
    state: ZipMasterSessionState;
  }[];
  attachmentId: string;
  projectId: string;
  sessionId: string;
  lockSessionId: string;
  version: number;
};

export type SpreadsheetPreview = {
  attachmentId: string;
  fileName: string;
  sheetNames: string[];
  sheetIndex: number;
  sheetName: string;
  offset: number;
  limit: number;
  columnOffset: number;
  columnLimit: number;
  totalRows: number;
  totalColumns: number;
  rows: { rowNumber: number; cells: string[] }[];
  hasMore: boolean;
  hasMoreColumns: boolean;
};

export type SpreadsheetPreviewSearchResult = {
  columnIndex: number;
  rowNumber: number;
  sheetIndex: number;
  value: string;
};

export type AttachmentRasterPdfManifest = {
  attachmentId: string;
  version: number;
  pageCount: number;
  pageWidth: number;
  pageHeight: number;
  dpi: number;
  mimeType: "image/png";
};

export type AuditLog = {
  id: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  projectId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  description: string;
  createdAt: string;
  actor?: Pick<User, "id" | "name" | "email" | "globalRole"> | null;
};

export type AttachmentHistory = {
  attachment: Attachment;
  versions: AttachmentVersion[];
  events: AuditLog[];
};

export type InboxMessageType =
  | "PROJECT_INVITATION"
  | "REVIEW_QUESTION"
  | "REVIEW_REPLY"
  | "REVIEW_FOLLOW_UP"
  | "REVIEW_REOPENED"
  | "SIGNOFF"
  | "SYSTEM_NOTIFICATION"
  | "ATTACHMENT_CONFLICT";

export type InboxProjectContext = {
  id: string;
  projectCode: string;
  name: string;
  workspace?: { id: string; name: string; clientName: string };
};

export type InboxWorkingPaperContext = {
  id: string;
  code: string;
  title: string;
};

export type InboxReviewQuestionContext = {
  id: string;
  workingPaperId?: string;
  attachmentId?: string | null;
  smartFormNodeId?: string | null;
  smartFormRowId?: string | null;
  smartFormTargetLabel?: string | null;
  status: "OPEN" | "REPLIED" | "CLEARED";
  body: string;
  assignedTo?: Pick<User, "id" | "name" | "email"> | null;
  createdBy?: Pick<User, "id" | "name" | "email"> | null;
};

export type InboxMessage = {
  id: string;
  recipientId?: string;
  senderId?: string | null;
  projectId?: string | null;
  workingPaperId?: string | null;
  reviewQuestionId?: string | null;
  type: InboxMessageType;
  title: string;
  body: string;
  contentKey?: InboxContentKey | null;
  contentParams?: Record<string, InboxContentParameter> | null;
  actionUrl?: string | null;
  readAt?: string | null;
  createdAt: string;
  sender?: User | null;
  project?: InboxProjectContext | null;
  workingPaper?: InboxWorkingPaperContext | null;
  reviewQuestion?: InboxReviewQuestionContext | null;
  projectInvitation?: {
    id: string;
    status: "PENDING" | "USED" | "EXPIRED";
    invitedRole: ProjectRole;
    expiresAt: string;
    project: InboxProjectContext;
  } | null;
};

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly requestId: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getAttachmentPreviewPdfUrl(
  projectId: string,
  attachmentId: string,
  displayName?: string,
  version?: number
) {
  const path = `/engagement/${projectId}/workflow/attachments/${attachmentId}/preview-pdf`;
  const suffix = displayName?.trim()
    ? `/${encodeURIComponent(displayName.trim())}`
    : "";
  // New URL identity bypasses old browser-cached 302 responses whose OSS
  // signatures may already be expired. Keep caching of actual versioned bytes.
  const query =
    version === undefined
      ? "?previewDelivery=content-v2"
      : `?version=${version}&previewDelivery=content-v2`;
  return `${API_BASE_URL}${path}${suffix}${query}&notesFormat=1`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = isFormDataBody(options.body);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  }).catch((error: unknown) => {
    throw toNetworkApiError(error);
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
      requestId?: string;
    } | null;
    throw new ApiError(
      body?.code ?? "REQUEST_FAILED",
      body?.message ?? "Request failed",
      body?.requestId ?? "unknown"
    );
  }
  return response.json() as Promise<T>;
}

type RuntimeParser<T> = {
  parse: (value: unknown) => T;
};

async function requestParsed<T>(
  path: string,
  schema: RuntimeParser<T>,
  options: RequestInit = {}
): Promise<T> {
  return schema.parse(await request<unknown>(path, options));
}

function adaptConfirmationEmpImportPreview(
  preview: SharedConfirmationEmpImportPreviewResponse
): ConfirmationEmpImportPreview {
  return {
    ...preview,
    items: preview.items.map((item) => ({
      ...item,
      proposedCode: item.sourceProposal.empCode,
      proposedName: item.sourceProposal.businessName,
    })),
  };
}

function adaptConfirmationEmpImportJob(
  job: SharedConfirmationEmpImportJob
): ConfirmationEmpImportJob {
  return {
    ...job,
    items: job.items.map((item) => ({ ...item })),
  };
}

function toCanonicalConfirmationEmpImportRequest(
  input: ConfirmationEmpImportRequest
): SharedCreateConfirmationEmpImportJobInput {
  return CreateConfirmationEmpImportJobSchema.parse({
    ...input,
    items: input.items.map((item) => ({
      id: item.id,
      ...(item.sourceConfirmationId
        ? { sourceConfirmationId: item.sourceConfirmationId }
        : {}),
      empCode: item.empCode ?? item.code,
      businessName: item.businessName ?? item.name,
    })),
  });
}

async function requestBlob(
  path: string,
  options: RequestInit & {
    accept?: string;
    cache?: RequestCache;
    normalizePdfMime?: boolean;
  } = {}
): Promise<Blob> {
  const { accept, normalizePdfMime, ...requestOptions } = options;
  const url = /^https?:\/\//i.test(path) ? path : `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...requestOptions,
    credentials: "include",
    headers: {
      ...requestOptions.headers,
      ...(accept ? { Accept: accept } : {}),
    },
  }).catch((error: unknown) => {
    throw toNetworkApiError(error);
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
      requestId?: string;
    } | null;
    throw new ApiError(
      body?.code ?? "REQUEST_FAILED",
      body?.message ?? "Request failed",
      body?.requestId ?? "unknown"
    );
  }
  const blob = await response.blob();
  if (normalizePdfMime && blob.type === PREVIEW_BLOB_MIME) {
    return new Blob([blob], { type: "application/pdf" });
  }
  return blob;
}

async function requestEventStream<T>(
  path: string,
  onEvent: (event: T) => void,
  options: { signal?: AbortSignal } = {}
) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      Accept: "text/event-stream",
    },
    signal: options.signal,
  }).catch((error: unknown) => {
    throw toNetworkApiError(error);
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
      requestId?: string;
    } | null;
    throw new ApiError(
      body?.code ?? "REQUEST_FAILED",
      body?.message ?? "Request failed",
      body?.requestId ?? "unknown"
    );
  }
  if (!response.body) {
    throw new ApiError(
      "STREAM_UNAVAILABLE",
      "Event stream is not available",
      "unknown"
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = rawEvent
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (data) {
        onEvent(JSON.parse(data) as T);
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
}

function isFormDataBody(body: BodyInit | null | undefined) {
  if (!body || typeof FormData === "undefined") {
    return false;
  }
  return (
    body instanceof FormData ||
    Object.prototype.toString.call(body) === "[object FormData]"
  );
}

async function uploadFileToSignedUrl(grant: AttachmentUploadGrant, file: File) {
  const response = await fetch(grant.uploadUrl, {
    method: grant.method,
    headers: grant.headers,
    body: file,
  }).catch((error: unknown) => {
    throw toNetworkApiError(error);
  });
  if (!response.ok) {
    throw new ApiError(
      "OSS_UPLOAD_FAILED",
      `File upload failed with status ${response.status}`,
      "oss"
    );
  }
}

function uploadPhaseError(
  code: "PREPARE_UPLOAD_FAILED" | "OSS_PUT_FAILED" | "CONFIRM_UPLOAD_FAILED",
  label: string,
  error: unknown
) {
  if (error instanceof ApiError && error.code === code) {
    return error;
  }
  return new ApiError(
    code,
    label,
    error instanceof ApiError ? error.requestId : "client"
  );
}

function storedUploadWasNotFound(error: unknown) {
  return (
    error instanceof ApiError &&
    ["DIRECT_UPLOAD_NOT_FOUND", "NOT_FOUND"].includes(error.code)
  );
}

export async function completeSignedUpload<T>({
  prepare,
  uploadLocal,
  confirm,
  file,
}: {
  prepare: () => Promise<AttachmentUploadGrant>;
  uploadLocal: () => Promise<T>;
  confirm: (grant: AttachmentUploadGrant) => Promise<T>;
  file: File;
}) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let grant: AttachmentUploadGrant;
    try {
      grant = await prepare();
    } catch (error) {
      lastError = uploadPhaseError(
        "PREPARE_UPLOAD_FAILED",
        "Could not prepare file upload",
        error
      );
      if (attempt === 0) {
        continue;
      }
      throw lastError;
    }

    if (grant.uploadUrl.startsWith("local://")) {
      return uploadLocal();
    }

    let putError: unknown = null;
    try {
      await uploadFileToSignedUrl(grant, file);
    } catch (error) {
      putError = error;
    }

    try {
      // Confirmation is also the authoritative check for an ambiguous browser
      // PUT result (for example, OSS accepted the object but CORS hid the
      // Response). This avoids uploading the same bytes again unnecessarily.
      return await confirm(grant);
    } catch (error) {
      if (storedUploadWasNotFound(error) && attempt === 0) {
        lastError = putError ?? error;
        continue;
      }
      if (putError) {
        throw uploadPhaseError(
          "OSS_PUT_FAILED",
          "Could not upload file to object storage",
          putError
        );
      }
      throw uploadPhaseError(
        "CONFIRM_UPLOAD_FAILED",
        "The file was uploaded but could not be confirmed",
        error
      );
    }
  }

  throw uploadPhaseError(
    "OSS_PUT_FAILED",
    "Could not upload file to object storage",
    lastError
  );
}

function toNetworkApiError(error: unknown) {
  if (error instanceof ApiError) {
    return error;
  }
  return new ApiError("NETWORK_FAILED", "Network request failed", "client");
}

async function loginWithApi(
  email: string,
  password: string,
  rememberMe = false
) {
  await signInWithBetterAuth({
    baseURL: AUTH_BASE_URL,
    email,
    password,
    rememberMe,
  });
  return request<User>("/account/me");
}

async function requestLoginOtpWithApi(email: string) {
  await requestEmailSignInOtp({ baseURL: AUTH_BASE_URL, email });
  return {} as { demoCode?: string };
}

async function loginWithOtpApi(email: string, otp: string) {
  await signInWithEmailOtp({ baseURL: AUTH_BASE_URL, email, otp });
  return request<User>("/account/me");
}

async function listDevelopmentAccountsWithApi() {
  const response = await fetch(`${AUTH_BASE_URL}/auth/development/accounts`, {
    credentials: "include",
  }).catch((error: unknown) => {
    throw toNetworkApiError(error);
  });
  if (!response.ok) {
    throw new ApiError(
      "IMPERSONATION_ACCOUNTS_FAILED",
      "Unable to load development accounts",
      "auth"
    );
  }
  const body = (await response.json()) as {
    accounts: Pick<User, "email" | "name" | "globalRole">[];
  };
  return body.accounts.map(({ email, name, globalRole }) => ({
    email,
    name,
    role: globalRole,
  }));
}

async function impersonateDevelopmentAccountWithApi(email: string) {
  const response = await fetch(
    `${AUTH_BASE_URL}/auth/development/impersonate`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }
  ).catch((error: unknown) => {
    throw toNetworkApiError(error);
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new ApiError(
      "IMPERSONATION_FAILED",
      body?.message ?? "Unable to impersonate account",
      "auth"
    );
  }
  return request<User>("/account/me");
}

async function uploadWorkingPaperAttachmentMultipart(
  projectId: string,
  paperId: string,
  file: File,
  workDate?: string
) {
  await Promise.resolve();
  const data = new FormData();
  if (workDate) {
    data.set("workDate", workDate);
  }
  data.set("file", file);
  return request<Attachment>(
    `/engagement/${projectId}/workflow/working-papers/${paperId}/attachments`,
    { method: "POST", body: data }
  );
}

async function uploadAttachmentNewVersionMultipart(
  projectId: string,
  attachmentId: string,
  file: File,
  workDate?: string
) {
  await Promise.resolve();
  const data = new FormData();
  if (workDate) {
    data.set("workDate", workDate);
  }
  data.set("file", file);
  return request<Attachment>(
    `/engagement/${projectId}/workflow/attachments/${attachmentId}/new-version`,
    { method: "POST", body: data }
  );
}

async function replaceAttachmentPlaceholderMultipart(
  projectId: string,
  attachmentId: string,
  file: File
) {
  await Promise.resolve();
  const data = new FormData();
  data.set("file", file);
  return request<Attachment>(
    `/engagement/${projectId}/workflow/attachments/${attachmentId}/replace`,
    { method: "POST", body: data }
  );
}

async function uploadReviewQuestionImageMultipart(
  projectId: string,
  questionId: string,
  file: File
) {
  await Promise.resolve();
  const data = new FormData();
  data.set("file", file);
  return request<ConfirmReviewQuestionImageInput>(
    `/engagement/${projectId}/workflow/questions/${questionId}/images`,
    { method: "POST", body: data }
  );
}

async function addZipMasterOperationMultipart(
  projectId: string,
  sessionId: string,
  operation: ZipMasterOperationInput,
  file?: File
) {
  await Promise.resolve();
  if (isZipMasterFileOperation(operation) && !file) {
    throw new ApiError(
      "VALIDATION_FAILED",
      "Zip file operations require a file",
      "client"
    );
  }
  const data = new FormData();
  data.set("operation", JSON.stringify(operation));
  if (file) {
    data.set("file", file);
  }
  return request<ZipMasterSessionResponse>(
    `/engagement/${projectId}/workflow/zip-master-sessions/${sessionId}/operations`,
    { method: "POST", body: data }
  );
}

function isZipMasterFileOperation(
  operation: ZipMasterOperationInput
): operation is ZipMasterFileOperationInput {
  return operation.type === "ADD_FILE" || operation.type === "REPLACE_FILE";
}

function addZipMasterOperation(
  projectId: string,
  sessionId: string,
  operation: ZipMasterFileOperationInput,
  file: File
): Promise<ZipMasterSessionResponse>;
function addZipMasterOperation(
  projectId: string,
  sessionId: string,
  operation: ZipMasterTextOperationInput
): Promise<ZipMasterSessionResponse>;
function addZipMasterOperation(
  projectId: string,
  sessionId: string,
  operation: ZipMasterOperationInput,
  file?: File
) {
  return addZipMasterOperationMultipart(projectId, sessionId, operation, file);
}

async function uploadProjectTemplateFileMultipart(
  templateId: string,
  nodeId: string,
  input: ProjectTemplateFileInput,
  file: File
) {
  await Promise.resolve();
  const data = new FormData();
  if (input.code) {
    data.set("code", input.code);
  }
  if (input.title) {
    data.set("title", input.title);
  }
  data.set("file", file);
  return request<ProjectTemplateFile>(
    `/admin/project-templates/${templateId}/nodes/${nodeId}/files`,
    { method: "POST", body: data }
  );
}

async function importProjectTemplateZipMultipart(
  input: ImportProjectTemplateZipInput,
  file: File
) {
  await Promise.resolve();
  const data = new FormData();
  data.set("code", input.code);
  data.set("name", input.name);
  data.set("language", input.language ?? "zh-CN");
  data.set("frameworkTemplateId", input.frameworkTemplateId);
  data.set("file", file);
  return request<ProjectTemplate>("/admin/project-templates/import-zip", {
    method: "POST",
    body: data,
  });
}

const liveApi = {
  impersonateDevelopmentAccount: impersonateDevelopmentAccountWithApi,
  listDevelopmentAccounts: listDevelopmentAccountsWithApi,
  login: loginWithApi,
  requestLoginOtp: requestLoginOtpWithApi,
  loginWithOtp: loginWithOtpApi,
  requestPasswordResetOtp: async (email: string) => {
    await requestEmailPasswordResetOtp({ baseURL: AUTH_BASE_URL, email });
    return {} as { demoCode?: string };
  },
  verifyPasswordResetOtp: (email: string, otp: string) =>
    verifyEmailPasswordResetOtp({ baseURL: AUTH_BASE_URL, email, otp }),
  resetPasswordWithOtp: (email: string, otp: string, password: string) =>
    resetPasswordWithEmailOtp({
      baseURL: AUTH_BASE_URL,
      email,
      otp,
      password,
    }),
  me: () => request<User>("/account/me"),
  updatePreferredLocale: (preferredLocale: "zh-CN" | "en-US") =>
    request<User>("/account/preferences", {
      method: "PATCH",
      body: JSON.stringify({ preferredLocale }),
      keepalive: true,
    }),
  signOut: () => signOutWithBetterAuth(AUTH_BASE_URL),
  userMailConnection: () => request<UserMailConnection>("/mail-connection"),
  connectUserMail: (clientPassword: string) =>
    request<UserMailConnection>("/mail-connection", {
      method: "PUT",
      body: JSON.stringify({ clientPassword }),
    }),
  testUserMailConnection: () =>
    request<UserMailConnection>("/mail-connection/test", {
      method: "POST",
      body: "{}",
    }),
  disconnectUserMail: () =>
    request<UserMailConnection>("/mail-connection", { method: "DELETE" }),
  tracking17TrackConnection: () =>
    request<Tracking17TrackConnection>("/system-connections/17track"),
  tracking17TrackCarriers: (query: string) =>
    request<Tracking17TrackCarrier[]>(
      `/tracking/17track/carriers?q=${encodeURIComponent(query)}`
    ),
  connectTracking17Track: (apiKey: string) =>
    request<Tracking17TrackConnection>("/system-connections/17track", {
      method: "PUT",
      body: JSON.stringify({ apiKey }),
    }),
  testTracking17TrackConnection: () =>
    request<Tracking17TrackConnection>("/system-connections/17track/test", {
      method: "POST",
      body: "{}",
    }),
  disconnectTracking17Track: () =>
    request<Tracking17TrackConnection>("/system-connections/17track", {
      method: "DELETE",
    }),
  acceptDeclaration: () =>
    request("/declarations/accept", { method: "POST", body: "{}" }),
  projectDeclarationStatus: (projectId: string) =>
    request<ProjectDeclarationStatus>(
      `/declarations/engagement/${projectId}/status`
    ),
  acceptProjectDeclaration: (projectId: string) =>
    request(`/declarations/engagement/${projectId}/accept`, {
      method: "POST",
      body: "{}",
    }),
  workspaces: () => request<Workspace[]>("/workspaces"),
  createWorkspace: (input: CreateWorkspaceInput) =>
    request<Workspace>("/workspaces", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateWorkspace: (id: string, input: UpdateWorkspaceInput) =>
    request<Workspace>(`/workspaces/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  desktop: () => request<DesktopState>("/desktop"),
  frameworkTemplates: () =>
    request<FrameworkTemplate[]>("/framework-templates"),
  cmpClients: (input: CmpClientListQuery = {}) => {
    const query = new URLSearchParams();
    if (input.status) {
      query.set("status", input.status);
    }
    if (input.groupId) {
      query.set("groupId", input.groupId);
    }
    if (input.q) {
      query.set("q", input.q);
    }
    const suffix = query.toString();
    return request<CmpClientsResponse>(
      `/cmp/clients${suffix ? `?${suffix}` : ""}`
    );
  },
  cmpEngagements: (input: CmpEngagementListQuery = {}) => {
    const query = new URLSearchParams();
    if (input.clientId) {
      query.set("clientId", input.clientId);
    }
    if (input.status) {
      query.set("status", input.status);
    }
    if (input.serviceType) {
      query.set("serviceType", input.serviceType);
    }
    if (input.q) {
      query.set("q", input.q);
    }
    if (input.availableForProject) {
      query.set("availableForProject", "true");
    }
    const suffix = query.toString();
    return request<CmpEngagementsResponse>(
      `/cmp/engagements${suffix ? `?${suffix}` : ""}`
    );
  },
  resolveCmpEngagementProjectCode: (code: string) =>
    request<CmpEngagement>(
      `/cmp/engagements/resolve-project-code?code=${encodeURIComponent(code)}`
    ),
  smartFormTemplates: (input: SmartFormTemplateListQueryInput = {}) => {
    const params = new URLSearchParams();
    if (input.frameworkTemplateId) {
      params.set("frameworkTemplateId", input.frameworkTemplateId);
    }
    if (input.q) {
      params.set("q", input.q);
    }
    const query = params.toString();
    return request<SmartFormTemplate[]>(
      `/smart-form-templates${query ? `?${query}` : ""}`
    );
  },
  projectTemplates: (input: ProjectTemplateListQueryInput = {}) => {
    const params = new URLSearchParams();
    if (input.language) {
      params.set("language", input.language);
    }
    if (input.frameworkTemplateId) {
      params.set("frameworkTemplateId", input.frameworkTemplateId);
    }
    if (input.q) {
      params.set("q", input.q);
    }
    const query = params.toString();
    return request<ProjectTemplate[]>(
      `/project-templates${query ? `?${query}` : ""}`
    );
  },
  projectTemplate: (templateId: string) =>
    request<ProjectTemplate>(`/project-templates/${templateId}`),
  previewProjectTemplate: (
    projectId: string,
    templateId: string,
    input: ApplyProjectTemplateInput
  ) =>
    request<ProjectTemplateApplyPreview>(
      `/engagement/${projectId}/project-templates/${templateId}/preview`,
      { method: "POST", body: JSON.stringify(input) }
    ),
  applyProjectTemplate: (
    projectId: string,
    templateId: string,
    input: ApplyProjectTemplateInput
  ) =>
    request<ProjectTemplateApplyResult>(
      `/engagement/${projectId}/project-templates/${templateId}/apply`,
      { method: "POST", body: JSON.stringify(input) }
    ),
  adminProjectTemplates: (input: ProjectTemplateListQueryInput = {}) => {
    const params = new URLSearchParams();
    if (input.language) {
      params.set("language", input.language);
    }
    if (input.frameworkTemplateId) {
      params.set("frameworkTemplateId", input.frameworkTemplateId);
    }
    if (input.q) {
      params.set("q", input.q);
    }
    const query = params.toString();
    return request<ProjectTemplate[]>(
      `/admin/project-templates${query ? `?${query}` : ""}`
    );
  },
  adminProjectTemplate: (templateId: string) =>
    request<ProjectTemplate>(`/admin/project-templates/${templateId}`),
  previewProjectTemplateFile: (templateId: string, fileId: string) =>
    requestBlob(
      `/admin/project-templates/${templateId}/files/${fileId}/preview`
    ),
  createProjectTemplate: (input: CreateProjectTemplateInput) =>
    request<ProjectTemplate>("/admin/project-templates", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  importProjectTemplateZip: (
    input: ImportProjectTemplateZipInput,
    file: File
  ) => importProjectTemplateZipMultipart(input, file),
  updateProjectTemplate: (
    templateId: string,
    input: UpdateProjectTemplateInput
  ) =>
    request<ProjectTemplate>(`/admin/project-templates/${templateId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteProjectTemplate: (templateId: string) =>
    request<ProjectTemplate>(`/admin/project-templates/${templateId}`, {
      method: "DELETE",
    }),
  adminSmartFormTemplates: (input: SmartFormTemplateListQueryInput = {}) => {
    const params = new URLSearchParams();
    if (input.frameworkTemplateId) {
      params.set("frameworkTemplateId", input.frameworkTemplateId);
    }
    if (input.q) {
      params.set("q", input.q);
    }
    const query = params.toString();
    return request<SmartFormTemplate[]>(
      `/admin/smart-form-templates${query ? `?${query}` : ""}`
    );
  },
  createSmartFormTemplate: (input: CreateSmartFormTemplateInput) =>
    request<SmartFormTemplate>("/admin/smart-form-templates", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateSmartFormTemplate: (
    templateId: string,
    input: UpdateSmartFormTemplateInput
  ) =>
    request<SmartFormTemplate>(`/admin/smart-form-templates/${templateId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  publishSmartFormTemplate: (templateId: string) =>
    request<SmartFormTemplate>(
      `/admin/smart-form-templates/${templateId}/publish`,
      {
        method: "POST",
        body: "{}",
      }
    ),
  deleteSmartFormTemplate: (templateId: string) =>
    request<SmartFormTemplate>(`/admin/smart-form-templates/${templateId}`, {
      method: "DELETE",
    }),
  createProjectTemplateNode: (
    templateId: string,
    input: CreateProjectTemplateNodeInput
  ) =>
    request<ProjectTemplateNode>(
      `/admin/project-templates/${templateId}/nodes`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    ),
  updateProjectTemplateNode: (
    templateId: string,
    nodeId: string,
    input: UpdateProjectTemplateNodeInput
  ) =>
    request<ProjectTemplateNode>(
      `/admin/project-templates/${templateId}/nodes/${nodeId}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      }
    ),
  deleteProjectTemplateNode: (templateId: string, nodeId: string) =>
    request<ProjectTemplateNode>(
      `/admin/project-templates/${templateId}/nodes/${nodeId}`,
      {
        method: "DELETE",
      }
    ),
  createProjectTemplateSmartForm: (
    templateId: string,
    nodeId: string,
    input: CreateProjectTemplateSmartFormInput
  ) =>
    request<ProjectTemplateSmartForm>(
      `/admin/project-templates/${templateId}/nodes/${nodeId}/smart-forms`,
      { method: "POST", body: JSON.stringify(input) }
    ),
  createProjectTemplatePlaceholder: (
    templateId: string,
    nodeId: string,
    input: CreateProjectTemplatePlaceholderInput
  ) =>
    request<ProjectTemplateFile>(
      `/admin/project-templates/${templateId}/nodes/${nodeId}/placeholders`,
      { method: "POST", body: JSON.stringify(input) }
    ),
  deleteProjectTemplateSmartForm: (templateId: string, referenceId: string) =>
    request<ProjectTemplateSmartForm>(
      `/admin/project-templates/${templateId}/smart-forms/${referenceId}`,
      { method: "DELETE" }
    ),
  updateProjectTemplateSmartFormCode: (
    templateId: string,
    referenceId: string,
    input: UpdateProjectTemplateItemCodeInput
  ) =>
    request<ProjectTemplateSmartForm>(
      `/admin/project-templates/${templateId}/smart-forms/${referenceId}`,
      { method: "PATCH", body: JSON.stringify(input) }
    ),
  reorderProjectTemplateItems: (
    templateId: string,
    nodeId: string,
    input: ReorderProjectTemplateItemsInput
  ) =>
    request<{ items: ProjectTemplateOrderedItem[] }>(
      `/admin/project-templates/${templateId}/nodes/${nodeId}/items/order`,
      { method: "PUT", body: JSON.stringify(input) }
    ),
  uploadProjectTemplateFile: (
    templateId: string,
    nodeId: string,
    input: ProjectTemplateFileInput,
    file: File
  ) => {
    const uploadInput: RequestProjectTemplateFileUploadUrlInput = {
      ...input,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
    };
    return completeSignedUpload({
      file,
      prepare: () =>
        request<AttachmentUploadGrant>(
          `/admin/project-templates/${templateId}/nodes/${nodeId}/files/upload-url`,
          { method: "POST", body: JSON.stringify(uploadInput) }
        ),
      uploadLocal: () =>
        uploadProjectTemplateFileMultipart(templateId, nodeId, input, file),
      confirm: (grant) => {
        const confirmInput: ConfirmProjectTemplateFileUploadInput = {
          ...uploadInput,
          objectKey: grant.objectKey,
        };
        return request<ProjectTemplateFile>(
          `/admin/project-templates/${templateId}/nodes/${nodeId}/files/confirm`,
          {
            method: "POST",
            body: JSON.stringify(confirmInput),
          }
        );
      },
    });
  },
  deleteProjectTemplateFile: (templateId: string, fileId: string) =>
    request<ProjectTemplateFile>(
      `/admin/project-templates/${templateId}/files/${fileId}`,
      {
        method: "DELETE",
      }
    ),
  updateProjectTemplateFileCode: (
    templateId: string,
    fileId: string,
    input: UpdateProjectTemplateItemCodeInput
  ) =>
    request<ProjectTemplateFile>(
      `/admin/project-templates/${templateId}/files/${fileId}`,
      { method: "PATCH", body: JSON.stringify(input) }
    ),
  createProjectSmartForm: (
    projectId: string,
    nodeId: string,
    input: CreateProjectSmartFormInput
  ) =>
    request<Attachment>(
      `/engagement/${projectId}/workflow/nodes/${nodeId}/smart-forms`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    ),
  openSmartForm: (projectId: string, attachmentId: string) =>
    request<SmartFormSessionResponse>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/smart-form/open`,
      { method: "POST", body: "{}" }
    ),
  readSmartForm: (projectId: string, attachmentId: string) =>
    request<SmartFormReadResponse>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/smart-form`
    ),
  saveSmartForm: (
    projectId: string,
    attachmentId: string,
    input: SaveSmartFormPackageInput
  ) =>
    request<SmartFormSessionResponse>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/smart-form/save`,
      { method: "POST", body: JSON.stringify(input) }
    ),
  closeSmartForm: (
    projectId: string,
    attachmentId: string,
    input: SaveSmartFormPackageInput
  ) =>
    request<SmartFormSessionResponse>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/smart-form/close`,
      { method: "POST", body: JSON.stringify(input) }
    ),
  discardSmartForm: (
    projectId: string,
    attachmentId: string,
    input: { lockSessionId: string }
  ) =>
    request<SmartFormSessionResponse>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/smart-form/discard`,
      { method: "POST", body: JSON.stringify(input) }
    ),
  createDesktopFolder: (input: CreateDesktopFolderInput) =>
    request<DesktopFolder>("/desktop/folders", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateDesktopFolder: (id: string, input: UpdateDesktopFolderInput) =>
    request<DesktopFolder>(`/desktop/folders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteDesktopFolder: (id: string) =>
    request<{ id: string }>(`/desktop/folders/${id}`, {
      method: "DELETE",
    }),
  reorderDesktopProjectPlacements: (
    folderId: string,
    input: ReorderDesktopProjectPlacementsInput
  ) =>
    request<{ count: number }>(
      `/desktop/folders/${folderId}/placements/order`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      }
    ),
  updateDesktopProjectPlacement: (
    id: string,
    input: UpdateDesktopProjectPlacementInput
  ) =>
    request<DesktopProjectPlacement>(`/desktop/engagement/${id}/placement`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  projects: () => request<Project[]>("/engagement"),
  deletedProjects: () => request<Project[]>("/engagement/deleted"),
  createProject: (input: CreateProjectInput) =>
    request<Project>("/engagement", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  rollForwardPreview: (id: string) =>
    request<RollForwardPreview>(`/engagement/${id}/roll-forward-preview`),
  project: (id: string) => request<Project>(`/engagement/${id}`),
  confirmations: () => request<ProjectConfirmation[]>("/confirmations"),
  confirmationEmpProjects: async () => {
    const response =
      await requestParsed<ConfirmationEmpImportEligibleProjectsResponse>(
        "/engagement/confirmation-emp-imports/eligible-projects",
        ConfirmationEmpImportEligibleProjectsResponseSchema
      );
    return response.projects.map<ConfirmationEmpProject>((project) => ({
      id: project.id,
      projectCode: project.code,
      name: project.name,
      reportDate: null,
      status: "ACTIVE",
      importEligible: true,
      eligibilityReason: null,
    }));
  },
  confirmationEmpPreview: (
    projectId: string,
    input: ConfirmationEmpImportPreviewInput
  ) => {
    const query = ConfirmationEmpImportPreviewQuerySchema.parse(input);
    const params = new URLSearchParams({ mode: query.mode });
    if (query.targetDirectoryId) {
      params.set("targetDirectoryId", query.targetDirectoryId);
    }
    if (query.confirmationId) {
      params.set("confirmationId", query.confirmationId);
    }
    for (const key of query.activeLinkKeys ?? [])
      params.append("activeLinkKeys", key);
    for (const confirmationId of query.confirmationIds ?? []) {
      params.append("confirmationIds", confirmationId);
    }
    return requestParsed(
      `/engagement/${projectId}/confirmation-emp-imports/preview?${params.toString()}`,
      ConfirmationEmpImportPreviewResponseSchema
    ).then(adaptConfirmationEmpImportPreview);
  },
  createConfirmationEmpImport: async (
    projectId: string,
    input: ConfirmationEmpImportRequest
  ) => {
    await Promise.resolve();
    const canonicalInput = toCanonicalConfirmationEmpImportRequest(input);
    return requestParsed(
      `/engagement/${projectId}/confirmation-emp-imports`,
      ConfirmationEmpImportJobSchema,
      { method: "POST", body: JSON.stringify(canonicalInput) }
    ).then(adaptConfirmationEmpImportJob);
  },
  confirmationEmpImportJob: (projectId: string, jobId: string) =>
    requestParsed(
      `/engagement/${projectId}/confirmation-emp-imports/${jobId}`,
      ConfirmationEmpImportJobSchema
    ).then(adaptConfirmationEmpImportJob),
  confirmationEmpImportHistory: (projectId: string) =>
    requestParsed(`/engagement/${projectId}/confirmation-emp-imports`, {
      parse: (value) =>
        Array.isArray(value)
          ? value.map((item) => ConfirmationEmpImportJobSchema.parse(item))
          : ConfirmationEmpImportJobSchema.array().parse(value),
    }).then((jobs) => jobs.map(adaptConfirmationEmpImportJob)),
  retryConfirmationEmpImport: (projectId: string, jobId: string) => {
    const body = RetryConfirmationEmpImportSchema.parse({});
    return requestParsed(
      `/engagement/${projectId}/confirmation-emp-imports/${jobId}/retry`,
      ConfirmationEmpImportJobSchema,
      { method: "POST", body: JSON.stringify(body) }
    ).then(adaptConfirmationEmpImportJob);
  },
  withdrawConfirmationEmpImport: (
    projectId: string,
    jobId: string,
    input: WithdrawConfirmationEmpImportInput
  ) => {
    const body = WithdrawConfirmationEmpImportSchema.parse(input);
    return requestParsed(
      `/engagement/${projectId}/confirmation-emp-imports/${jobId}/withdraw`,
      ConfirmationEmpImportJobSchema,
      { method: "POST", body: JSON.stringify(body) }
    ).then(adaptConfirmationEmpImportJob);
  },
  restoreConfirmationEmpImport: (
    projectId: string,
    jobId: string,
    input: RestoreConfirmationEmpImportInput
  ) => {
    const body = RestoreConfirmationEmpImportSchema.parse(input);
    return requestParsed(
      `/engagement/${projectId}/confirmation-emp-imports/${jobId}/restore`,
      ConfirmationEmpImportJobSchema,
      { method: "POST", body: JSON.stringify(body) }
    ).then(adaptConfirmationEmpImportJob);
  },
  confirmationTemplateLibrary: () =>
    request<ConfirmationTemplateLibraryFile[]>(
      "/confirmations/template-library"
    ),
  updateConfirmationTemplateLibraryDesign: (
    templateId: string,
    input: UpdateConfirmationTemplateLibraryDesignInput
  ) =>
    request<ConfirmationTemplateLibraryFile>(
      `/confirmations/template-library/${templateId}/design`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      }
    ),
  updateConfirmationTemplateLibraryStatus: (
    templateId: string,
    input: UpdateConfirmationTemplateLibraryStatusInput
  ) =>
    request<ConfirmationTemplateLibraryFile>(
      `/confirmations/template-library/${templateId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      }
    ),
  bulkUpdateConfirmationTemplateLibraryStatus: (
    input: BulkUpdateConfirmationTemplateLibraryStatusInput
  ) =>
    request<ConfirmationTemplateLibraryFile[]>(
      "/confirmations/template-library/status",
      {
        method: "PATCH",
        body: JSON.stringify(input),
      }
    ),
  uploadConfirmationTemplateLibraryFile: (input: {
    name: string;
    confirmationType: ConfirmationType;
    description?: string;
    file: File;
  }) => {
    const body = new FormData();
    body.set("name", input.name);
    body.set("confirmationType", input.confirmationType);
    if (input.description?.trim()) {
      body.set("description", input.description.trim());
    }
    body.set("file", input.file);
    return request<ConfirmationTemplateLibraryFile>(
      "/confirmations/template-library",
      {
        method: "POST",
        body,
      }
    );
  },
  deleteConfirmationTemplateLibraryFile: (templateId: string) =>
    request<{ id: string }>(`/confirmations/template-library/${templateId}`, {
      method: "DELETE",
    }),
  confirmationTemplateLibraryDownloadUrl: (templateId: string) =>
    `${API_BASE_URL}/confirmations/template-library/${templateId}/download`,
  previewConfirmationTemplateLibraryFile: (templateId: string) =>
    requestBlob(`/confirmations/template-library/${templateId}/preview`),
  confirmationInformationLibrary: (
    input: ConfirmationInformationLibraryQuery = {}
  ) => {
    const params = new URLSearchParams({
      query: input.query?.trim() ?? "",
      includeInactive: String(input.includeInactive ?? false),
    });
    if (input.entryId?.trim()) {
      params.set("entryId", input.entryId.trim());
    }
    return requestParsed(
      `/confirmations/information-library?${params.toString()}`,
      ConfirmationInformationLibraryEntrySchema.array()
    );
  },
  createConfirmationInformationLibrary: (
    input: ConfirmationInformationLibraryCreateInput
  ) => {
    const body = ConfirmationInformationLibraryCreateInputSchema.parse(input);
    return requestParsed(
      "/confirmations/information-library",
      ConfirmationInformationLibraryEntrySchema,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );
  },
  updateConfirmationInformationLibrary: (
    entryId: string,
    input: ConfirmationInformationLibraryUpdateInput
  ) => {
    const body = ConfirmationInformationLibraryUpdateInputSchema.parse(input);
    return requestParsed(
      `/confirmations/information-library/${entryId}`,
      ConfirmationInformationLibraryEntrySchema,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      }
    );
  },
  deleteConfirmationInformationLibrary: (entryId: string) =>
    requestParsed(
      `/confirmations/information-library/${entryId}`,
      ConfirmationInformationLibraryEntrySchema,
      { method: "DELETE" }
    ),
  restoreConfirmationInformationLibrary: (entryId: string) =>
    requestParsed(
      `/confirmations/information-library/${entryId}/restore`,
      ConfirmationInformationLibraryEntrySchema,
      { method: "POST" }
    ),
  confirmationResponseLibrary: () =>
    request<ConfirmationResponseLibraryFile[]>(
      "/confirmations/response-library"
    ),
  projectConfirmationResponseWarehouse: (projectId: string) =>
    request<ConfirmationResponseLibraryFile[]>(
      `/confirmations/response-library/project/${projectId}`
    ),
  projectPendingConfirmationResponses: (projectId: string) =>
    request<ConfirmationResponseLibraryFile[]>(
      `/confirmations/response-library/project/${projectId}/pending`
    ),
  routeConfirmationResponseLibraryFile: (
    responseId: string,
    input: RouteConfirmationResponseLibraryFileInput
  ) =>
    request<ConfirmationResponseLibraryFile>(
      `/confirmations/response-library/${responseId}/route`,
      { method: "PATCH", body: JSON.stringify(input) }
    ),
  uploadConfirmationResponseLibraryFile: (input: {
    projectId?: string;
    title: string;
    receivedAt: string;
    courierTrackingNumber?: string;
    referenceNumber?: string;
    clientName: string;
    respondingEntity: string;
    notes?: string;
    file: File;
  }) => {
    const body = new FormData();
    if (input.projectId) {
      body.set("projectId", input.projectId);
    }
    body.set("title", input.title);
    body.set("receivedAt", input.receivedAt);
    if (input.courierTrackingNumber?.trim()) {
      body.set("courierTrackingNumber", input.courierTrackingNumber.trim());
    }
    if (input.referenceNumber?.trim()) {
      body.set("referenceNumber", input.referenceNumber.trim());
    }
    body.set("clientName", input.clientName);
    body.set("respondingEntity", input.respondingEntity);
    if (input.notes?.trim()) {
      body.set("notes", input.notes.trim());
    }
    body.set("file", input.file);
    return request<ConfirmationResponseLibraryFile>(
      "/confirmations/response-library",
      {
        method: "POST",
        body,
      }
    );
  },
  confirmationResponseLibraryDownloadUrl: (responseId: string) =>
    `${API_BASE_URL}/confirmations/response-library/${responseId}/download`,
  previewConfirmationResponseLibraryFile: (responseId: string) =>
    requestBlob(`/confirmations/response-library/${responseId}/preview`),
  projectConfirmations: (id: string) =>
    request<ProjectConfirmation[]>(`/engagement/${id}/confirmations`),
  confirmationGeneralFields: () =>
    request<ConfirmationGeneralField[]>("/confirmations/general-fields"),
  confirmationGeneralLayout: () =>
    request<ConfirmationGeneralLayout>("/confirmations/general-fields/layout"),
  updateConfirmationGeneralLayout: (layout: ConfirmationGeneralLayout) =>
    request<ConfirmationGeneralLayout>("/confirmations/general-fields/layout", {
      method: "PATCH",
      body: JSON.stringify(layout),
    }),
  updateConfirmationGeneralFields: (fields: ConfirmationGeneralField[]) =>
    request<ConfirmationGeneralField[]>("/confirmations/general-fields", {
      method: "PATCH",
      body: JSON.stringify({ fields }),
    }),
  projectConfirmationDefaults: (id: string) =>
    request<ProjectConfirmationDefaults>(
      `/engagement/${id}/confirmation-defaults`
    ),
  updateProjectConfirmationDefaults: (
    id: string,
    input: UpdateProjectConfirmationDefaultsInput
  ) =>
    request<ProjectConfirmationDefaults>(
      `/engagement/${id}/confirmation-defaults`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      }
    ),
  createProjectConfirmation: (
    id: string,
    input: CreateProjectConfirmationInput
  ) =>
    request<ProjectConfirmation>(`/engagement/${id}/confirmations`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateProjectConfirmation: (
    projectId: string,
    confirmationId: string,
    input: UpdateProjectConfirmationInput
  ) =>
    request<ProjectConfirmation>(
      `/engagement/${projectId}/confirmations/${confirmationId}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      }
    ),
  uploadProjectConfirmation: (
    projectId: string,
    input: { type: ConfirmationType; counterpartyName: string; file: File }
  ) => {
    const body = new FormData();
    body.set("type", input.type);
    body.set("counterpartyName", input.counterpartyName);
    body.set("file", input.file);
    return request<ProjectConfirmation>(
      `/engagement/${projectId}/confirmations/upload`,
      {
        method: "POST",
        body,
      }
    );
  },
  uploadProjectConfirmationFile: (
    projectId: string,
    confirmationId: string,
    input: { counterpartyName: string; file: File | File[] }
  ) => {
    const body = new FormData();
    body.set("counterpartyName", input.counterpartyName);
    for (const file of Array.isArray(input.file) ? input.file : [input.file]) {
      body.append("file", file);
    }
    return request<ProjectConfirmation>(
      `/engagement/${projectId}/confirmations/${confirmationId}/upload`,
      { method: "POST", body }
    );
  },
  removeProjectConfirmationFile: (projectId: string, confirmationId: string) =>
    request<ProjectConfirmation>(
      `/engagement/${projectId}/confirmations/${confirmationId}/upload`,
      {
        method: "DELETE",
      }
    ),
  removeProjectConfirmationContent: (
    projectId: string,
    confirmationId: string
  ) =>
    request<ProjectConfirmation>(
      `/engagement/${projectId}/confirmations/${confirmationId}/content`,
      {
        method: "DELETE",
      }
    ),
  updateProjectConfirmationDraft: (
    projectId: string,
    confirmationId: string,
    input: UpdateProjectConfirmationDraftInput
  ) =>
    request<ProjectConfirmation>(
      `/engagement/${projectId}/confirmations/${confirmationId}/draft`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      }
    ),
  previewProjectConfirmationPdf: (
    projectId: string,
    confirmationId: string,
    input?: UpdateProjectConfirmationDraftInput
  ) =>
    requestBlob(
      `/engagement/${projectId}/confirmations/${confirmationId}/preview.pdf`,
      input
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          }
        : {}
    ),
  previewProjectConfirmationDocx: (
    projectId: string,
    confirmationId: string,
    input?: UpdateProjectConfirmationDraftInput
  ) =>
    requestBlob(
      `/engagement/${projectId}/confirmations/${confirmationId}/preview.docx`,
      input
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          }
        : {}
    ),
  downloadProjectConfirmationAttachment: (
    projectId: string,
    confirmationId: string,
    downloadUrl?: string | null
  ) =>
    requestBlob(
      downloadUrl ??
        `/engagement/${projectId}/confirmations/${confirmationId}/preview.pdf`
    ),
  previewConfirmationDispatchPdf: (confirmationId: string) =>
    requestBlob(`/confirmations/dispatch-queue/${confirmationId}/preview.pdf`),
  submitProjectConfirmation: (
    projectId: string,
    confirmationId: string,
    input: SubmitProjectConfirmationInput
  ) =>
    request<ProjectConfirmation>(
      `/engagement/${projectId}/confirmations/${confirmationId}/submit`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    ),
  withdrawProjectConfirmation: (
    projectId: string,
    confirmationId: string,
    input: WithdrawProjectConfirmationInput
  ) =>
    request<ProjectConfirmation>(
      `/engagement/${projectId}/confirmations/${confirmationId}/withdraw`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    ),
  confirmationDispatchQueue: (query: ConfirmationDispatchQueueQuery = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) {
        params.set(key, value);
      }
    }
    const search = params.size > 0 ? `?${params.toString()}` : "";
    return request<ConfirmationDispatchQueueItem[]>(
      `/confirmations/dispatch-queue${search}`
    );
  },
  claimConfirmationDispatchQueue: (
    confirmationId: string,
    input: ClaimConfirmationDispatchQueueInput
  ) =>
    request<ConfirmationDispatchQueueItem>(
      `/confirmations/dispatch-queue/${confirmationId}/claim`,
      { method: "POST", body: JSON.stringify(input) }
    ),
  releaseConfirmationDispatchQueue: (
    confirmationId: string,
    input: ReleaseConfirmationDispatchQueueInput
  ) =>
    request<ConfirmationDispatchQueueItem>(
      `/confirmations/dispatch-queue/${confirmationId}/release`,
      { method: "POST", body: JSON.stringify(input) }
    ),
  returnConfirmationDispatchQueue: (
    confirmationId: string,
    input: ReturnConfirmationDispatchQueueInput
  ) =>
    request<ConfirmationDispatchQueueItem>(
      `/confirmations/dispatch-queue/${confirmationId}/return`,
      { method: "POST", body: JSON.stringify(input) }
    ),
  createConfirmationDispatchBatch: (
    input: CreateConfirmationDispatchBatchInput
  ) =>
    request<ConfirmationDispatchBatch>("/confirmations/dispatch-batches", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  executeConfirmationDispatchBatch: (
    batchId: string,
    input: ExecuteConfirmationDispatchBatchInput
  ) =>
    request<ConfirmationDispatchBatch>(
      `/confirmations/dispatch-batches/${batchId}/execute`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    ),
  completeMockCourierDelivery: (
    dispatchId: string,
    input: { idempotencyKey: string }
  ) =>
    request(`/confirmations/dispatches/${dispatchId}/mock-delivery`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  confirmationDispatchBatch: (batchId: string) =>
    request<ConfirmationDispatchBatch>(
      `/confirmations/dispatch-batches/${batchId}`
    ),
  createProjectConfirmationDispatch: (
    projectId: string,
    confirmationId: string,
    input: CreateProjectConfirmationDispatchInput
  ) =>
    request<ProjectConfirmation>(
      `/engagement/${projectId}/confirmations/${confirmationId}/dispatches`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    ),
  uploadProjectConfirmationDispatchAttachment: (
    projectId: string,
    confirmationId: string,
    dispatchId: string,
    file: File
  ) => {
    const body = new FormData();
    body.set("file", file);
    return request<ProjectConfirmation>(
      `/engagement/${projectId}/confirmations/${confirmationId}/dispatches/${dispatchId}/attachment`,
      { method: "POST", body }
    );
  },
  receiveProjectConfirmationResponse: (
    projectId: string,
    confirmationId: string,
    input: CreateProjectConfirmationResponseInput & { files: File[] }
  ) => {
    const body = new FormData();
    body.set("responseChannel", input.responseChannel);
    body.set("receivedAt", input.receivedAt);
    if (input.responseReference) {
      body.set("responseReference", input.responseReference);
    }
    if (input.notes) {
      body.set("notes", input.notes);
    }
    input.files.forEach((file) => body.append("files", file));
    return request<ProjectConfirmation>(
      `/engagement/${projectId}/confirmations/${confirmationId}/responses`,
      { method: "POST", body }
    );
  },
  createProjectConfirmationFollowUpEvent: (
    projectId: string,
    confirmationId: string,
    input: CreateProjectConfirmationFollowUpEventInput
  ) =>
    request<ProjectConfirmation>(
      `/engagement/${projectId}/confirmations/${confirmationId}/follow-up-events`,
      { method: "POST", body: JSON.stringify(input) }
    ),
  completeProjectConfirmationProgram: (
    projectId: string,
    confirmationId: string
  ) =>
    request<ProjectConfirmation>(
      `/engagement/${projectId}/confirmations/${confirmationId}/complete`,
      { method: "POST" }
    ),
  reviewProjectConfirmationResponse: (
    projectId: string,
    confirmationId: string,
    input: ReviewProjectConfirmationResponseInput
  ) =>
    request<ProjectConfirmation>(
      `/engagement/${projectId}/confirmations/${confirmationId}/review`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    ),
  startProjectConfirmationRedispatchEditing: (
    projectId: string,
    confirmationId: string
  ) =>
    request<ProjectConfirmation>(
      `/engagement/${projectId}/confirmations/${confirmationId}/redispatch/edit`,
      { method: "POST" }
    ),
  voidProjectConfirmation: (projectId: string, confirmationId: string) =>
    request<ProjectConfirmation>(
      `/engagement/${projectId}/confirmations/${confirmationId}/void`,
      {
        method: "POST",
      }
    ),
  restoreProjectConfirmation: (projectId: string, confirmationId: string) =>
    request<ProjectConfirmation>(
      `/engagement/${projectId}/confirmations/${confirmationId}/restore`,
      {
        method: "POST",
      }
    ),
  undoProjectConfirmationReview: (projectId: string, confirmationId: string) =>
    request<ProjectConfirmation>(
      `/engagement/${projectId}/confirmations/${confirmationId}/review/undo`,
      { method: "POST" }
    ),
  addProjectConfirmationResponseArtifacts: (
    projectId: string,
    confirmationId: string,
    responseId: string,
    files: File[]
  ) => {
    const body = new FormData();
    files.forEach((file) => body.append("files", file));
    return request<ProjectConfirmation>(
      `/engagement/${projectId}/confirmations/${confirmationId}/responses/${responseId}/artifacts`,
      { method: "POST", body }
    );
  },
  projectConfirmationResponseArtifact: (
    projectId: string,
    confirmationId: string,
    responseId: string,
    artifactId: string
  ) =>
    requestBlob(
      `/engagement/${projectId}/confirmations/${confirmationId}/responses/${responseId}/artifacts/${artifactId}`
    ),
  withdrawProjectConfirmationResponse: (
    projectId: string,
    confirmationId: string,
    responseId: string
  ) =>
    request<ProjectConfirmation | { deletedConfirmationId: string; responseLibraryFileId: string }>(
      `/engagement/${projectId}/confirmations/${confirmationId}/responses/${responseId}/withdraw`,
      { method: "POST" }
    ),
  correctProjectConfirmationTracking: (
    projectId: string,
    confirmationId: string,
    dispatchId: string,
    input: CorrectProjectConfirmationTrackingInput
  ) =>
    request<ProjectConfirmation>(
      `/engagement/${projectId}/confirmations/${confirmationId}/dispatches/${dispatchId}/tracking`,
      { method: "PATCH", body: JSON.stringify(input) }
    ),
  refreshProjectConfirmationTracking: (
    projectId: string,
    confirmationId: string,
    dispatchId: string
  ) =>
    request<ProjectConfirmation>(
      `/engagement/${projectId}/confirmations/${confirmationId}/dispatches/${dispatchId}/tracking/refresh`,
      { method: "POST" }
    ),
  prepareProjectConfirmationDispatch: (
    projectId: string,
    confirmationId: string,
    input: PrepareProjectConfirmationDispatchInput
  ) =>
    request<ProjectConfirmation>(
      `/engagement/${projectId}/confirmations/${confirmationId}/prepared-dispatch`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      }
    ),
  updateProject: (id: string, input: UpdateProjectInput) =>
    request<Project>(`/engagement/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  linkProjectEngagement: (id: string, input: LinkProjectEngagementInput) =>
    request<Project>(`/engagement/${id}/link-engagement`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  unlinkProjectEngagement: (id: string) =>
    request<Project>(`/engagement/${id}/link-engagement`, {
      method: "DELETE",
    }),
  tmsProjectLinks: (input: TmsProjectLinkQuery = {}) => {
    const params = new URLSearchParams();
    if (input.q) {
      params.set("q", input.q);
    }
    if (input.projectId) {
      params.set("projectId", input.projectId);
    }
    if (input.status) {
      params.set("status", input.status);
    }
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return requestParsed<TmsProjectLinksResponse>(
      `/tms/timesheets/project-links${suffix}`,
      TmsProjectLinksResponseSchema
    );
  },
  linkTmsProject: (rowId: string, projectId: string) =>
    requestParsed<TmsProjectLink>(
      "/tms/timesheets/project-links",
      TmsProjectLinkSchema,
      {
        method: "POST",
        body: JSON.stringify({ rowId, projectId }),
      }
    ),
  unlinkTmsProject: (rowId: string) =>
    requestParsed<TmsProjectLink>(
      `/tms/timesheets/project-links/${encodeURIComponent(rowId)}`,
      TmsProjectLinkSchema,
      { method: "DELETE" }
    ),
  archiveCheck: (id: string) =>
    request<ArchiveCheckReport>(`/engagement/${id}/archive-check`),
  exportArchiveCheck: (id: string) =>
    requestBlob(`/engagement/${id}/archive-check/export.pdf`),
  startArchiveCheckJob: (id: string) =>
    request<ArchiveCheckJobSnapshot>(`/engagement/${id}/archive-check-jobs`, {
      method: "POST",
      body: "{}",
    }),
  archiveCheckJob: (id: string, jobId: string) =>
    request<ArchiveCheckJobSnapshot>(
      `/engagement/${id}/archive-check-jobs/${jobId}`
    ),
  startArchiveJob: (id: string) =>
    request<ArchiveJobSnapshot>(`/engagement/${id}/archive-jobs`, {
      method: "POST",
      body: "{}",
    }),
  archiveJob: (id: string, jobId: string) =>
    request<ArchiveJobSnapshot>(`/engagement/${id}/archive-jobs/${jobId}`),
  watchArchiveJob: (
    id: string,
    jobId: string,
    onJob: ArchiveJobEventHandler,
    options?: { signal?: AbortSignal }
  ) =>
    requestEventStream<ArchiveJobSnapshot>(
      `/engagement/${id}/archive-jobs/${jobId}/events`,
      onJob,
      options
    ),
  archiveArtifact: (id: string) =>
    request<ProjectArchiveArtifact>(`/engagement/${id}/archive-artifact`),
  downloadArchiveArtifact: (id: string) =>
    requestBlob(`/engagement/${id}/archive-artifact/download`),
  submitArchive: (id: string) =>
    request<Project>(`/engagement/${id}/submit-archive`, { method: "POST" }),
  reopenProject: (id: string, input?: { reason?: string }) =>
    request<Project>(`/engagement/${id}/reopen`, {
      method: "POST",
      body: JSON.stringify(input ?? {}),
    }),
  confirmProjectArchive: (id: string) =>
    request<ArchiveJobSnapshot>(`/engagement/${id}/confirm-archive`, {
      method: "POST",
    }),
  archiveProject: (id: string) =>
    request<Project>(`/engagement/${id}/archive`, { method: "POST" }),
  deleteProject: (id: string) =>
    request<Project>(`/engagement/${id}`, { method: "DELETE" }),
  restoreProject: (id: string) =>
    request<Project>(`/engagement/${id}/restore`, { method: "POST" }),
  moveProjectPlacement: (id: string, input: MoveProjectPlacementInput) =>
    request<Project>(`/engagement/${id}/placement`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  members: (projectId: string) =>
    request<ProjectMember[]>(`/engagement/${projectId}/members`),
  projectMemberDirectory: (projectId: string) =>
    request<ProjectMember[]>(`/engagement/${projectId}/member-directory`),
  userDirectory: () => request<User[]>("/users/directory"),
  projectInvitees: (input: ProjectInviteeDirectoryQueryInput = {}) => {
    const query = new URLSearchParams();
    if (input.q) {
      query.set("q", input.q);
    }
    if (input.browseAll) {
      query.set("browseAll", "true");
    }
    if (input.globalRole) {
      query.set("globalRole", input.globalRole);
    }
    if (input.excludeUserIds?.length) {
      query.set("excludeUserIds", input.excludeUserIds.join(","));
    }
    if (input.page) {
      query.set("page", String(input.page));
    }
    if (input.pageSize) {
      query.set("pageSize", String(input.pageSize));
    }
    const suffix = query.toString();
    return request<ProjectInviteeDirectoryResponse>(
      `/users/directory/project-invitees${suffix ? `?${suffix}` : ""}`
    );
  },
  createInvitation: (projectId: string, input: CreateInvitationInput) =>
    request<{
      inviteUrl: string;
      invitedRole: string;
      expiresAt: string;
      delivery?: {
        recipientEmail: string;
        delivered: boolean;
        message: string;
      } | null;
    }>(`/engagement/${projectId}/invitations`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  cancelProjectInvitation: (projectId: string, invitationId: string) =>
    request<{ id: string }>(
      `/engagement/${projectId}/invitations/${invitationId}`,
      {
        method: "DELETE",
      }
    ),
  updateProjectMemberRole: (
    projectId: string,
    memberId: string,
    input: UpdateProjectMemberRoleInput
  ) =>
    request<ProjectMember>(`/engagement/${projectId}/members/${memberId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  updateProjectMemberInChargeRole: (
    projectId: string,
    memberId: string,
    input: UpdateProjectMemberInChargeRoleInput
  ) =>
    request<ProjectMember>(
      `/engagement/${projectId}/members/${memberId}/in-charge`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      }
    ),
  removeProjectMember: (projectId: string, memberId: string) =>
    request<{ id: string }>(`/engagement/${projectId}/members/${memberId}`, {
      method: "DELETE",
    }),
  createPicRecoveryInvitation: (
    projectId: string,
    input: CreatePicRecoveryInvitationInput
  ) =>
    request<{ id: string; inviteUrl: string }>(
      `/engagement/${projectId}/pic-recovery-invitations`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    ),
  recoverProjectPic: (
    projectId: string,
    memberId: string,
    input: { reason: string }
  ) =>
    request<ProjectMember>(
      `/engagement/${projectId}/members/${memberId}/recover-pic`,
      { method: "POST", body: JSON.stringify(input) }
    ),
  reauthorizeProjectMember: (
    projectId: string,
    memberId: string,
    input: ReauthorizeProjectMemberInput
  ) =>
    request<ProjectMember>(
      `/engagement/${projectId}/members/${memberId}/reauthorize`,
      { method: "POST", body: JSON.stringify(input) }
    ),
  acceptInvitation: (token: string, input: AcceptInvitationInput) =>
    request<{ projectId: string }>(`/invitations/${token}/accept`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  inboxMessages: () => request<InboxMessage[]>("/inbox/messages"),
  workItems: (
    input: {
      view?: WorkItemView;
      scope?: WorkItemDomain;
      domain?: WorkItemDomain;
      projectId?: string;
      locale?: "zh-CN" | "en-US";
    } = {}
  ) => {
    const params = new URLSearchParams();
    if (input.view) {
      params.set("view", input.view);
    }
    if (input.scope) {
      params.set("scope", input.scope);
    }
    if (input.domain) {
      params.set("domain", input.domain);
    }
    if (input.projectId) {
      params.set("projectId", input.projectId);
    }
    if (input.locale) {
      params.set("locale", input.locale);
    }
    const query = params.toString();
    return request<WorkItemListResponse>(
      `/work-items${query ? `?${query}` : ""}`
    );
  },
  markInboxRead: (messageId: string) =>
    request<InboxMessage>(`/inbox/messages/${messageId}/read`, {
      method: "POST",
      body: "{}",
    }),
  markInboxUnread: (messageId: string) =>
    request<InboxMessage>(`/inbox/messages/${messageId}/unread`, {
      method: "POST",
      body: "{}",
    }),
  markAllInboxRead: () =>
    request<{ count: number; readAt: string }>(`/inbox/messages/read-all`, {
      method: "POST",
      body: "{}",
    }),
  deleteInboxMessage: (messageId: string) =>
    request<{ id: string }>(`/inbox/messages/${messageId}`, {
      method: "DELETE",
    }),
  workflow: (projectId: string) =>
    request<WorkflowNode[]>(`/engagement/${projectId}/workflow`),
  createWorkflowNode: (projectId: string, input: CreateWorkflowNodeInput) =>
    request<WorkflowNode>(`/engagement/${projectId}/workflow/nodes`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateWorkflowNode: (
    projectId: string,
    nodeId: string,
    input: UpdateWorkflowNodeInput
  ) =>
    request<WorkflowNode>(`/engagement/${projectId}/workflow/nodes/${nodeId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteWorkflowNode: (projectId: string, nodeId: string) =>
    request<{ id: string }>(
      `/engagement/${projectId}/workflow/nodes/${nodeId}`,
      {
        method: "DELETE",
      }
    ),
  createWorkingPaper: (projectId: string, input: CreateWorkingPaperInput) =>
    request<WorkingPaper>(`/engagement/${projectId}/workflow/working-papers`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  workingPaper: (projectId: string, paperId: string) =>
    request<WorkingPaper>(
      `/engagement/${projectId}/workflow/working-papers/${paperId}`
    ),
  updateWorkingPaper: (
    projectId: string,
    paperId: string,
    input: UpdateWorkingPaperInput
  ) =>
    request<WorkingPaper>(
      `/engagement/${projectId}/workflow/working-papers/${paperId}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      }
    ),
  updateWorkingPaperAssignees: (
    projectId: string,
    paperId: string,
    input: UpdateWorkingPaperAssigneesInput
  ) =>
    request<WorkingPaper>(
      `/engagement/${projectId}/workflow/working-papers/${paperId}/assignees`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      }
    ),
  deleteWorkingPaper: (projectId: string, paperId: string) =>
    request<{ id: string }>(
      `/engagement/${projectId}/workflow/working-papers/${paperId}`,
      {
        method: "DELETE",
      }
    ),
  uploadWorkingPaperAttachment: (
    projectId: string,
    paperId: string,
    file: File,
    workDate?: string
  ) => {
    const input: RequestAttachmentUploadUrlInput = {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      workDate,
    };
    return completeSignedUpload({
      file,
      prepare: () =>
        request<AttachmentUploadGrant>(
          `/engagement/${projectId}/workflow/working-papers/${paperId}/attachments/upload-url`,
          { method: "POST", body: JSON.stringify(input) }
        ),
      uploadLocal: () =>
        uploadWorkingPaperAttachmentMultipart(
          projectId,
          paperId,
          file,
          workDate
        ),
      confirm: (grant) =>
        request<Attachment>(
          `/engagement/${projectId}/workflow/working-papers/${paperId}/attachments/confirm`,
          {
            method: "POST",
            body: JSON.stringify({ ...input, objectKey: grant.objectKey }),
          }
        ),
    });
  },
  lockAttachment: (projectId: string, attachmentId: string) =>
    request<Attachment>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/lock`,
      {
        method: "POST",
        body: "{}",
      }
    ),
  unlockAttachment: (projectId: string, attachmentId: string) =>
    request<Attachment>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/unlock`,
      {
        method: "POST",
        body: "{}",
      }
    ),
  uploadAttachmentNewVersion: (
    projectId: string,
    attachmentId: string,
    file: File,
    workDate?: string
  ) => {
    const input: RequestAttachmentVersionUploadUrlInput = {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      workDate,
    };
    return completeSignedUpload({
      file,
      prepare: () =>
        request<AttachmentUploadGrant>(
          `/engagement/${projectId}/workflow/attachments/${attachmentId}/new-version/upload-url`,
          { method: "POST", body: JSON.stringify(input) }
        ),
      uploadLocal: () =>
        uploadAttachmentNewVersionMultipart(
          projectId,
          attachmentId,
          file,
          workDate
        ),
      confirm: (grant) =>
        request<Attachment>(
          `/engagement/${projectId}/workflow/attachments/${attachmentId}/new-version/confirm`,
          {
            method: "POST",
            body: JSON.stringify({ ...input, objectKey: grant.objectKey }),
          }
        ),
    });
  },
  createAttachmentPlaceholder: (
    projectId: string,
    paperId: string,
    input: CreateAttachmentPlaceholderInput
  ) =>
    request<Attachment>(
      `/engagement/${projectId}/workflow/working-papers/${paperId}/attachments/placeholders`,
      { method: "POST", body: JSON.stringify(input) }
    ),
  replaceAttachmentPlaceholder: (
    projectId: string,
    attachmentId: string,
    file: File
  ) => {
    const input: RequestAttachmentVersionUploadUrlInput = {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
    };
    return completeSignedUpload({
      file,
      prepare: () =>
        request<AttachmentUploadGrant>(
          `/engagement/${projectId}/workflow/attachments/${attachmentId}/replace/upload-url`,
          { method: "POST", body: JSON.stringify(input) }
        ),
      uploadLocal: () =>
        replaceAttachmentPlaceholderMultipart(projectId, attachmentId, file),
      confirm: (grant) =>
        request<Attachment>(
          `/engagement/${projectId}/workflow/attachments/${attachmentId}/replace/confirm`,
          {
            method: "POST",
            body: JSON.stringify({ ...input, objectKey: grant.objectKey }),
          }
        ),
    });
  },
  deletedAttachments: (projectId: string) =>
    request<Attachment[]>(
      `/engagement/${projectId}/workflow/deleted-attachments`
    ),
  projectAttachments: (projectId: string) =>
    request<ProjectAttachment[]>(
      `/engagement/${projectId}/workflow/attachments`
    ),
  deleteAttachment: (projectId: string, attachmentId: string) =>
    request<Attachment>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}`,
      {
        method: "DELETE",
      }
    ),
  renameAttachment: (
    projectId: string,
    attachmentId: string,
    input: RenameAttachmentInput
  ) =>
    request<Attachment>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      }
    ),
  updateAttachmentIdentity: (
    projectId: string,
    attachmentId: string,
    input: UpdateAttachmentIdentityInput
  ) =>
    request<Attachment>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/identity`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      }
    ),
  reorderWorkingPaperAttachments: (
    projectId: string,
    input: ReorderWorkingPaperAttachmentsInput
  ) =>
    request<{ attachmentIds: string[] }>(
      `/engagement/${projectId}/workflow/attachments/order`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      }
    ),
  moveAttachment: (
    projectId: string,
    attachmentId: string,
    input: RelocateAttachmentInput
  ) =>
    request<Attachment>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/move`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    ),
  copyAttachment: (
    projectId: string,
    attachmentId: string,
    input: RelocateAttachmentInput
  ) =>
    request<Attachment>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/copy`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    ),
  restoreAttachment: (
    projectId: string,
    attachmentId: string,
    input: RestoreAttachmentInput = {}
  ) =>
    request<Attachment>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/restore`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    ),
  downloadAttachment: (projectId: string, attachmentId: string) =>
    requestBlob(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/download`
    ),
  downloadAttachmentReadOnly: (projectId: string, attachmentId: string) =>
    requestBlob(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/download-readonly`
    ),
  exportAttachment: (
    projectId: string,
    attachmentId: string,
    format: AttachmentExportFormat
  ) => {
    const params = new URLSearchParams({ format });
    return requestBlob(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/export?${params.toString()}`
    );
  },
  createProjectFileExportJob: (
    projectId: string,
    input: CreateProjectFileExportJobInput
  ) =>
    request<ProjectFileExportJob>(
      `/engagement/${projectId}/workflow/export-jobs`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    ),
  activeProjectFileExportJob: (projectId: string) =>
    request<ProjectFileExportJob | null>(
      `/engagement/${projectId}/workflow/export-jobs/active`
    ),
  projectFileExportJob: (projectId: string, jobId: string) =>
    request<ProjectFileExportJob>(
      `/engagement/${projectId}/workflow/export-jobs/${jobId}`
    ),
  retryProjectFileExportJob: (projectId: string, jobId: string) =>
    request<ProjectFileExportJob>(
      `/engagement/${projectId}/workflow/export-jobs/${jobId}/retry`,
      {
        method: "POST",
      }
    ),
  watchProjectFileExportJob: (
    projectId: string,
    jobId: string,
    onJob: ProjectFileExportJobEventHandler,
    options?: { signal?: AbortSignal }
  ) =>
    requestEventStream<ProjectFileExportJob>(
      `/engagement/${projectId}/workflow/export-jobs/${jobId}/events`,
      onJob,
      options
    ),
  downloadProjectFileExportJob: (projectId: string, jobId: string) =>
    requestBlob(
      `/engagement/${projectId}/workflow/export-jobs/${jobId}/download`
    ),
  projectFileExportJobDownloadUrl: (projectId: string, jobId: string) =>
    Promise.resolve(
      `${API_BASE_URL}/engagement/${projectId}/workflow/export-jobs/${jobId}/download`
    ),
  previewAttachmentContent: (
    projectId: string,
    attachmentId: string,
    version?: number
  ) =>
    requestBlob(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/preview-content${
        version === undefined
          ? "?transport=blob"
          : `?version=${version}&transport=blob`
      }`,
      {
        accept: PREVIEW_BLOB_ACCEPT,
        normalizePdfMime: true,
      }
    ),
  previewAttachmentPdf: (
    projectId: string,
    attachmentId: string,
    version?: number
  ) =>
    requestBlob(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/preview-pdf?transport=blob${
        version === undefined ? "" : `&version=${version}`
      }&previewDelivery=content-v2&notesFormat=1`,
      {
        accept: PREVIEW_BLOB_ACCEPT,
        normalizePdfMime: true,
      }
    ),
  previewAttachmentRasterPdfManifest: (
    projectId: string,
    attachmentId: string,
    version?: number
  ) =>
    request<AttachmentRasterPdfManifest>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/preview-pdf/pages${
        version === undefined ? "" : `?version=${version}`
      }`
    ),
  previewAttachmentRasterPdfPage: (
    projectId: string,
    attachmentId: string,
    pageNumber: number,
    dpi: number,
    version?: number
  ) => {
    const params = new URLSearchParams({ dpi: String(dpi) });
    if (version !== undefined) {
      params.set("version", String(version));
    }
    return requestBlob(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/preview-pdf/pages/${pageNumber}?${params.toString()}`
    );
  },
  previewAttachment: (
    projectId: string,
    attachmentId: string,
    input: {
      sheetIndex?: number;
      offset?: number;
      limit?: number;
      columnOffset?: number;
      columnLimit?: number;
      targetRow?: number;
    }
  ) => {
    const params = new URLSearchParams();
    if (input.sheetIndex !== undefined) {
      params.set("sheet", String(input.sheetIndex));
    }
    if (input.offset !== undefined) {
      params.set("offset", String(input.offset));
    }
    if (input.limit !== undefined) {
      params.set("limit", String(input.limit));
    }
    if (input.columnOffset !== undefined) {
      params.set("column", String(input.columnOffset));
    }
    if (input.columnLimit !== undefined) {
      params.set("columns", String(input.columnLimit));
    }
    if (input.targetRow !== undefined) {
      params.set("row", String(input.targetRow));
    }
    return request<SpreadsheetPreview>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/preview?${params.toString()}`
    );
  },
  searchAttachmentPreview: (
    projectId: string,
    attachmentId: string,
    query: string
  ) =>
    request<{ results: SpreadsheetPreviewSearchResult[] }>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/preview-search?q=${encodeURIComponent(query)}`
    ),
  downloadAttachmentVersion: (
    projectId: string,
    attachmentId: string,
    versionId: string
  ) =>
    requestBlob(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/versions/${versionId}/download`
    ),
  restoreAttachmentVersion: (
    projectId: string,
    attachmentId: string,
    versionId: string
  ) =>
    request<Attachment>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/versions/${versionId}/restore`,
      { method: "POST", body: "{}" }
    ),
  attachmentConflicts: (projectId: string, attachmentId: string) =>
    request<AttachmentConflictSummary>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/conflicts`
    ),
  resolveAttachmentConflict: (
    projectId: string,
    attachmentId: string,
    candidateVersionId: string,
    resolution: AttachmentConflictResolution
  ) =>
    request<Attachment>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/conflicts/${candidateVersionId}/resolve`,
      { method: "POST", body: JSON.stringify({ resolution }) }
    ),
  attachmentHistory: (projectId: string, attachmentId: string) =>
    request<AttachmentHistory>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/history`
    ),
  openZipMaster: (projectId: string, attachmentId: string) =>
    request<ZipMasterOpenResponse>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/zip-master/open`,
      { method: "POST", body: "{}" }
    ),
  readZip: (projectId: string, attachmentId: string) =>
    request<ZipReadOnlyResponse>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/zip/read`
    ),
  downloadZipEntryReadOnly: (
    projectId: string,
    attachmentId: string,
    entryPath: string
  ) => {
    const params = new URLSearchParams({ path: entryPath });
    return requestBlob(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/zip/entries/download?${params.toString()}`
    );
  },
  openZipEntryMaster: (
    projectId: string,
    sessionId: string,
    entryPath: string
  ) =>
    request<ZipEntryMasterOpenResponse>(
      `/engagement/${projectId}/workflow/zip-master-sessions/${sessionId}/entries/master/open`,
      { method: "POST", body: JSON.stringify({ entryPath }) }
    ),
  downloadZipSessionEntry: (
    projectId: string,
    sessionId: string,
    entryPath: string
  ) => {
    const params = new URLSearchParams({ path: entryPath });
    return requestBlob(
      `/engagement/${projectId}/workflow/zip-master-sessions/${sessionId}/entries/download?${params.toString()}`
    );
  },
  addZipMasterOperation,
  closeZipMaster: (projectId: string, sessionId: string) =>
    request<ZipMasterCloseResponse>(
      `/engagement/${projectId}/workflow/zip-master-sessions/${sessionId}/close`,
      { method: "POST", body: "{}" }
    ),
  discardZipMaster: (projectId: string, sessionId: string) =>
    request<ZipMasterCloseResponse>(
      `/engagement/${projectId}/workflow/zip-master-sessions/${sessionId}/discard`,
      { method: "POST", body: "{}" }
    ),
  prepareWorkingPaper: (projectId: string, paperId: string) =>
    request<WorkingPaper>(
      `/engagement/${projectId}/workflow/working-papers/${paperId}/prepare`,
      {
        method: "POST",
        body: "{}",
      }
    ),
  reviewWorkingPaper: (projectId: string, paperId: string) =>
    request<WorkingPaper>(
      `/engagement/${projectId}/workflow/working-papers/${paperId}/review`,
      {
        method: "POST",
        body: "{}",
      }
    ),
  prepareAttachment: (projectId: string, attachmentId: string) =>
    request<Attachment>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/prepare`,
      {
        method: "POST",
        body: "{}",
      }
    ),
  removeWorkingPaperSignoff: (projectId: string, signoffId: string) =>
    request<{ id: string }>(
      `/engagement/${projectId}/workflow/signoffs/${signoffId}`,
      {
        method: "DELETE",
      }
    ),
  reviewAttachment: (projectId: string, attachmentId: string) =>
    request<Attachment>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/review`,
      {
        method: "POST",
        body: "{}",
      }
    ),
  attachmentSignoffHistory: (projectId: string, attachmentId: string) =>
    request<AttachmentSignoffHistory>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/signoffs/history`
    ),
  revokeAttachmentSignoff: (
    projectId: string,
    attachmentId: string,
    signoffId: string,
    input: { reason: string }
  ) =>
    request<AttachmentSignoffHistory>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/signoffs/${signoffId}/revoke`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    ),
  returnWorkingPaper: (
    projectId: string,
    paperId: string,
    input: ReturnWorkingPaperInput
  ) =>
    request<WorkingPaper>(
      `/engagement/${projectId}/workflow/working-papers/${paperId}/return`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    ),
  createWorkingPaperQuestion: (
    projectId: string,
    paperId: string,
    input: CreateWorkingPaperQuestionInput
  ) =>
    request<WorkingPaperQuestion>(
      `/engagement/${projectId}/workflow/working-papers/${paperId}/questions`,
      { method: "POST", body: JSON.stringify(input) }
    ),
  createAttachmentQuestion: (
    projectId: string,
    attachmentId: string,
    input: CreateWorkingPaperQuestionInput
  ) =>
    request<WorkingPaperQuestion>(
      `/engagement/${projectId}/workflow/attachments/${attachmentId}/questions`,
      { method: "POST", body: JSON.stringify(input) }
    ),
  uploadReviewQuestionImage: (
    projectId: string,
    questionId: string,
    file: File
  ) => uploadReviewQuestionImageMultipart(projectId, questionId, file),
  downloadReviewQuestionImage: (projectId: string, imageId: string) =>
    requestBlob(`/engagement/${projectId}/workflow/question-images/${imageId}`),
  attachWorkingPaperQuestionInitialMessage: (
    projectId: string,
    questionId: string,
    images: ConfirmReviewQuestionImageInput[]
  ) =>
    request<WorkingPaperQuestion>(
      `/engagement/${projectId}/workflow/questions/${questionId}/initial-attachments`,
      {
        method: "POST",
        body: JSON.stringify({ images }),
      }
    ),
  replyWorkingPaperQuestion: (
    projectId: string,
    questionId: string,
    input: ReplyWorkingPaperQuestionInput
  ) =>
    request<WorkingPaperQuestion>(
      `/engagement/${projectId}/workflow/questions/${questionId}/reply`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    ),
  followUpWorkingPaperQuestion: (
    projectId: string,
    questionId: string,
    input: FollowUpWorkingPaperQuestionInput
  ) =>
    request<WorkingPaperQuestion>(
      `/engagement/${projectId}/workflow/questions/${questionId}/follow-up`,
      { method: "POST", body: JSON.stringify(input) }
    ),
  markWorkingPaperQuestionReplied: (projectId: string, questionId: string) =>
    request<WorkingPaperQuestion>(
      `/engagement/${projectId}/workflow/questions/${questionId}/mark-replied`,
      { method: "POST", body: "{}" }
    ),
  clearWorkingPaperQuestion: (projectId: string, questionId: string) =>
    request<WorkingPaperQuestion>(
      `/engagement/${projectId}/workflow/questions/${questionId}/clear`,
      {
        method: "POST",
        body: "{}",
      }
    ),
  reopenWorkingPaperQuestion: (
    projectId: string,
    questionId: string,
    input: FollowUpWorkingPaperQuestionInput
  ) =>
    request<WorkingPaperQuestion>(
      `/engagement/${projectId}/workflow/questions/${questionId}/reopen`,
      { method: "POST", body: JSON.stringify(input) }
    ),
  auditLogs: (projectId: string) =>
    request<AuditLog[]>(`/engagement/${projectId}/audit-logs`),
  users: (input: UserListQueryInput = {}) => {
    const params = new URLSearchParams();
    if (input.q) {
      params.set("q", input.q);
    }
    if (input.globalRole) {
      params.set("globalRole", input.globalRole);
    }
    if (input.status) {
      params.set("status", input.status);
    }
    const query = params.toString();
    return request<User[]>(`/admin/users${query ? `?${query}` : ""}`);
  },
  createUser: (input: CreateUserInput) =>
    request<User>("/admin/users", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateUser: (id: string, input: UpdateUserInput) =>
    request<User>(`/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  userRoleImpact: (id: string, globalRole: GlobalRole) =>
    request<ProjectAuthorizationImpact>(
      `/admin/users/${encodeURIComponent(id)}/role-impact?globalRole=${encodeURIComponent(globalRole)}`
    ),
  resetPassword: (id: string) =>
    request<{ temporaryPassword: string; user: User }>(
      `/admin/users/${id}/reset-password`,
      {
        method: "POST",
        body: "{}",
      }
    ),
  roles: () =>
    request<
      {
        id: string;
        code: string;
        name: string;
        scope: string;
        rolePermissions: unknown[];
      }[]
    >("/roles"),
};
const selectedApi: typeof liveApi = (USE_MOCK_API
  ? mockApi
  : liveApi) as unknown as typeof liveApi;

type EmpApi = Omit<typeof liveApi, "me" | "signOut"> & {
  me: () => Promise<User | null>;
  restoreIntranetEntry: () => Promise<User | null>;
  signOut: () => Promise<void>;
};

export const api: EmpApi = {
  ...selectedApi,
  async me() {
    try {
      return await selectedApi.me();
    } catch (error) {
      if (
        error instanceof ApiError &&
        ["UNAUTHORIZED", "SESSION_EXPIRED"].includes(error.code)
      ) {
        return null;
      }
      throw error;
    }
  },
  async restoreIntranetEntry() {
    try {
      return await api.me();
    } catch {
      return null;
    }
  },
  async signOut() {
    await selectedApi.signOut();
  },
};
