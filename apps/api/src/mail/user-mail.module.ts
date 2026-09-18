import { Module } from "@nestjs/common";

import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { UserMailConnectionController } from "./user-mail-connection.controller";
import { UserMailConnectionService } from "./user-mail-connection.service";

@Module({
  imports: [AuditLogsModule],
  controllers: [UserMailConnectionController],
  providers: [UserMailConnectionService],
  exports: [UserMailConnectionService],
})
export class UserMailModule {
  private readonly _moduleMarker = true;
}
