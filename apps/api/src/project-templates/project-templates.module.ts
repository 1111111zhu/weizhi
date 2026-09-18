import { Module } from "@nestjs/common";

import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ProjectAccessService } from "../projects/project-access.service";
import { SmartFormsModule } from "../smart-forms/smart-forms.module";
import { StorageModule } from "../storage/storage.module";
import { ProjectTemplatesController } from "./project-templates.controller";
import { ProjectTemplatesService } from "./project-templates.service";

@Module({
  imports: [PrismaModule, StorageModule, AuditLogsModule, SmartFormsModule],
  controllers: [ProjectTemplatesController],
  providers: [ProjectAccessService, ProjectTemplatesService],
  exports: [ProjectTemplatesService],
})
export class ProjectTemplatesModule {
  private readonly _moduleMarker = true;
}
