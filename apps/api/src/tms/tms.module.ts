import { Module } from "@nestjs/common";

import { InboxModule } from "../inbox/inbox.module";
import { TmsTimesheetQueryService } from "./tms-timesheet-query.service";
import { TmsTimesheetsController } from "./tms-timesheets.controller";
import { TmsTimesheetsService } from "./tms-timesheets.service";

@Module({
  imports: [InboxModule],
  controllers: [TmsTimesheetsController],
  providers: [TmsTimesheetsService, TmsTimesheetQueryService],
  exports: [TmsTimesheetsService],
})
export class TmsModule {
  private readonly _moduleMarker = true;
}
