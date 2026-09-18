import { Module } from "@nestjs/common";

import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { UserDirectoryController } from "./user-directory.controller";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [AuditLogsModule],
  controllers: [UsersController, UserDirectoryController],
  providers: [UsersService],
})
export class UsersModule {
  private readonly _moduleMarker = true;
}
