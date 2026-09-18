import type { ProjectRole } from "@project-wing/shared";

import type {
  Attachment,
  AttachmentVersion,
  AuditLog,
  ConfirmationGeneralField,
  ConfirmationGeneralLayout,
  ConfirmationInformationLibraryEntry,
  DesktopFolder,
  DesktopProjectPlacement,
  FrameworkTemplate,
  InboxMessage,
  ProjectConfirmation,
  ProjectConfirmationArtifact,
  ProjectConfirmationDefaults,
  ProjectTemplate,
  SmartFormTemplate,
  User,
  WorkflowNode,
  Workspace,
} from "./client";

export type MockDesktopProjectPlacement = Omit<
  DesktopProjectPlacement,
  "project"
>;

export type MockState = {
  users: User[];
  frameworkTemplates: FrameworkTemplate[];
  projectTemplates: ProjectTemplate[];
  smartFormTemplates: SmartFormTemplate[];
  /** @deprecated Workspace model is being replaced by Desktop Folder */
  workspaces: Workspace[];
  desktopFolders: DesktopFolder[];
  desktopPlacements: MockDesktopProjectPlacement[];
  workflows: Record<string, WorkflowNode[]>;
  deletedAttachments: Record<string, Attachment[]>;
  attachmentVersions: Record<string, AttachmentVersion[]>;
  attachmentContents?: Record<string, MockAttachmentContent>;
  projectTemplateFileContents?: Record<string, MockAttachmentContent>;
  declarations: Record<string, string[]>;
  messages: InboxMessage[];
  confirmations: Record<string, ProjectConfirmation[]>;
  confirmationGeneralFields?: ConfirmationGeneralField[];
  confirmationGeneralLayout?: ConfirmationGeneralLayout;
  confirmationInformationLibrary?: ConfirmationInformationLibraryEntry[];
  confirmationDefaults?: Record<string, ProjectConfirmationDefaults>;
  confirmationArtifacts?: Record<
    string,
    {
      submissionKey: string;
      artifact: ProjectConfirmationArtifact;
    }[]
  >;
  auditLogs: Record<string, AuditLog[]>;
  invitations: Record<
    string,
    {
      projectId: string;
      invitedRole: ProjectRole;
      recipientEmail?: string;
      expiresAt?: string;
      createdAt?: string;
      status?: "PENDING" | "USED" | "EXPIRED";
    }
  >;
};

export type MockAttachmentContent = {
  base64: string;
  mimeType: string;
};
