import { Module } from "@nestjs/common";

import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { ProjectsModule } from "../projects/projects.module";
import { DeclarationsController } from "./declarations.controller";
import { DeclarationsService } from "./declarations.service";

@Module({
  imports: [AuditLogsModule, ProjectsModule],
  controllers: [DeclarationsController],
  providers: [DeclarationsService],
})
export class DeclarationsModule {
  private readonly _moduleMarker = true;
}
