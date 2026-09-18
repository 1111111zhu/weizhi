import { Module } from "@nestjs/common";

import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { InboxModule } from "../inbox/inbox.module";
import { ProjectAccessService } from "../projects/project-access.service";
import { MembersController } from "./members.controller";
import { MembersService } from "./members.service";

@Module({
  imports: [AuditLogsModule, InboxModule],
  controllers: [MembersController],
  providers: [MembersService, ProjectAccessService],
})
export class MembersModule {
  private readonly _moduleMarker = true;
}
