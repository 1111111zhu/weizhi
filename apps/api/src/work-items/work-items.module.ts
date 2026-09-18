import { Module } from "@nestjs/common";

import { WorkItemsSynchronizerService } from "./work-items-synchronizer.service";
import { WorkItemsController } from "./work-items.controller";
import { WorkItemsService } from "./work-items.service";

@Module({
  controllers: [WorkItemsController],
  providers: [WorkItemsService, WorkItemsSynchronizerService],
  exports: [WorkItemsService, WorkItemsSynchronizerService],
})
export class WorkItemsModule {
  private readonly _moduleMarker = true;
}
