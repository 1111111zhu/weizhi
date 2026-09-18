import { Module } from "@nestjs/common";

import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { ProjectAccessService } from "../projects/project-access.service";
import { StorageModule } from "../storage/storage.module";
import { SmartFormV2PdfService } from "./smart-form-v2-pdf.service";
import { SmartFormsController } from "./smart-forms.controller";
import { SmartFormsService } from "./smart-forms.service";

@Module({
  imports: [AuditLogsModule, StorageModule],
  controllers: [SmartFormsController],
  providers: [ProjectAccessService, SmartFormsService, SmartFormV2PdfService],
  exports: [SmartFormsService, SmartFormV2PdfService],
})
export class SmartFormsModule {
  private readonly _moduleMarker = true;
}
