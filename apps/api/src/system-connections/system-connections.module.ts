import { Module } from "@nestjs/common";

import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { SystemConnectionsController } from "./system-connections.controller";
import { SystemConnectionsService } from "./system-connections.service";
import { Tracking17TrackCarrierDirectoryService } from "./tracking-17track-carrier-directory.service";
import { Tracking17TrackCarriersController } from "./tracking-17track-carriers.controller";
import { Tracking17TrackMnsConsumer } from "./tracking-17track-mns-consumer.service";
import { Tracking17TrackWebhookController } from "./tracking-17track-webhook.controller";
import { Tracking17TrackService } from "./tracking-17track.service";

@Module({
  imports: [AuditLogsModule],
  controllers: [
    SystemConnectionsController,
    Tracking17TrackCarriersController,
    Tracking17TrackWebhookController,
  ],
  providers: [
    SystemConnectionsService,
    Tracking17TrackCarrierDirectoryService,
    Tracking17TrackService,
    Tracking17TrackMnsConsumer,
  ],
  exports: [
    SystemConnectionsService,
    Tracking17TrackCarrierDirectoryService,
    Tracking17TrackService,
  ],
})
export class SystemConnectionsModule {
  private readonly _moduleMarker = true;
}
