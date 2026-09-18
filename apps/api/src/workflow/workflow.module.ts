import { Module } from "@nestjs/common";

import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { InboxModule } from "../inbox/inbox.module";
import { ProjectAccessService } from "../projects/project-access.service";
import { SmartFormV2PdfService } from "../smart-forms/smart-form-v2-pdf.service";
import { StorageModule } from "../storage/storage.module";
import { DocumentConversionService } from "./document-conversion.service";
import { PdfRasterPreviewService } from "./pdf-raster-preview.service";
import { ProjectFileExportJobService } from "./project-file-export-job.service";
import { SpreadsheetPreviewCacheService } from "./spreadsheet-preview-cache.service";
import {
  DesktopMasterSessionController,
  DesktopZipEntryMasterSessionController,
  WorkflowController,
} from "./workflow.controller";
import { WorkflowService } from "./workflow.service";
import { ZipMasterService } from "./zip-master.service";

@Module({
  imports: [AuditLogsModule, InboxModule, StorageModule],
  controllers: [
    WorkflowController,
    DesktopMasterSessionController,
    DesktopZipEntryMasterSessionController,
  ],
  providers: [
    WorkflowService,
    ZipMasterService,
    ProjectAccessService,
    DocumentConversionService,
    PdfRasterPreviewService,
    SpreadsheetPreviewCacheService,
    SmartFormV2PdfService,
    ProjectFileExportJobService,
  ],
  exports: [DocumentConversionService, SpreadsheetPreviewCacheService],
})
export class WorkflowModule {
  private readonly _moduleMarker = true;
}
