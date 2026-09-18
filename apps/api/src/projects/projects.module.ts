import { Module } from "@nestjs/common";

import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { InboxModule } from "../inbox/inbox.module";
import { SystemEmailModule } from "../mail/system-email.module";
import { UserMailModule } from "../mail/user-mail.module";
import { SmartFormV2PdfService } from "../smart-forms/smart-form-v2-pdf.service";
import { StorageModule } from "../storage/storage.module";
import { SystemConnectionsModule } from "../system-connections/system-connections.module";
import { TmsModule } from "../tms/tms.module";
import { DocumentConversionService } from "../workflow/document-conversion.service";
import { ArchiveCheckService } from "./archive-check.service";
import { ArchiveJobService } from "./archive-job.service";
import { ArchiveNotificationService } from "./archive-notification.service";
import { ArchiveReminderService } from "./archive-reminder.service";
import { ConfirmationArtifactService } from "./confirmation-artifact.service";
import { ConfirmationDerivedDataService } from "./confirmation-derived-data.service";
import { ConfirmationDispatchQueueService } from "./confirmation-dispatch-queue.service";
import { ConfirmationDispatchService } from "./confirmation-dispatch.service";
import { ConfirmationDocumentService } from "./confirmation-document.service";
import { ConfirmationEmpImportArchiveService } from "./confirmation-emp-import-archive.service";
import {
  CONFIRMATION_EMP_IMPORT_WITHDRAWAL_STORE,
  ConfirmationEmpImportWithdrawalService,
} from "./confirmation-emp-import-withdrawal.service";
import { PrismaConfirmationEmpImportWithdrawalStore } from "./confirmation-emp-import-withdrawal.store";
import { ConfirmationEmpImportService } from "./confirmation-emp-import.service";
import { ConfirmationImportLinkGuardService } from "./confirmation-import-link-guard.service";
import { ConfirmationInformationLibraryService } from "./confirmation-information-library.service";
import { ConfirmationManualChannelService } from "./confirmation-manual-channel.service";
import { ConfirmationMockCourierChannelService } from "./confirmation-mock-courier-channel.service";
import { ConfirmationPrintService } from "./confirmation-print.service";
import { ConfirmationResponseLibraryService } from "./confirmation-response-library.service";
import { ConfirmationResponseService } from "./confirmation-response.service";
import { ConfirmationSubmissionService } from "./confirmation-submission.service";
import { ConfirmationTemplateLibraryService } from "./confirmation-template-library.service";
import { ConfirmationUploadService } from "./confirmation-upload.service";
import { ConfirmationWorkspaceService } from "./confirmation-workspace.service";
import {
  ConfirmationsController,
  ProjectConfirmationLogisticsController,
} from "./confirmations.controller";
import { ProjectAccessService } from "./project-access.service";
import { ProjectConfirmationCodeService } from "./project-confirmation-code.service";
import { ProjectConfirmationsService } from "./project-confirmations.service";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { ConfirmationGeneralFieldsController } from "./confirmation-general-fields.controller";
import { ConfirmationGeneralFieldsService } from "./confirmation-general-fields.service";

@Module({
  imports: [
    AuditLogsModule,
    StorageModule,
    InboxModule,
    SystemEmailModule,
    UserMailModule,
    SystemConnectionsModule,
    TmsModule,
  ],
  controllers: [
    ProjectsController,
    ConfirmationsController,
    ProjectConfirmationLogisticsController,
    ConfirmationGeneralFieldsController,
  ],
  providers: [
    ConfirmationGeneralFieldsService,
    ProjectsService,
    ConfirmationArtifactService,
    ConfirmationDerivedDataService,
    ConfirmationEmpImportArchiveService,
    ConfirmationEmpImportService,
    ConfirmationImportLinkGuardService,
    PrismaConfirmationEmpImportWithdrawalStore,
    {
      provide: CONFIRMATION_EMP_IMPORT_WITHDRAWAL_STORE,
      useExisting: PrismaConfirmationEmpImportWithdrawalStore,
    },
    ConfirmationEmpImportWithdrawalService,
    ConfirmationDocumentService,
    ConfirmationInformationLibraryService,
    ConfirmationDispatchQueueService,
    ConfirmationDispatchService,
    ConfirmationManualChannelService,
    ConfirmationMockCourierChannelService,
    ConfirmationPrintService,
    ConfirmationResponseService,
    ConfirmationResponseLibraryService,
    ConfirmationSubmissionService,
    ConfirmationTemplateLibraryService,
    ConfirmationUploadService,
    ConfirmationWorkspaceService,
    ProjectConfirmationCodeService,
    ProjectConfirmationsService,
    ProjectAccessService,
    DocumentConversionService,
    ArchiveCheckService,
    ArchiveJobService,
    ArchiveNotificationService,
    ArchiveReminderService,
    SmartFormV2PdfService,
  ],
  exports: [ProjectAccessService],
})
export class ProjectsModule {
  private readonly _moduleMarker = true;
}
