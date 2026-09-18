import { Module } from "@nestjs/common";

import { StorageModule } from "../storage/storage.module";
import { DesktopAgentDownloadsController } from "./downloads.controller";

@Module({
  imports: [StorageModule],
  controllers: [DesktopAgentDownloadsController],
})
export class DownloadsModule {
  private readonly _moduleMarker = true;
}
