import { Module } from "@nestjs/common";

import { SystemEmailModule } from "../mail/system-email.module";
import { InboxController } from "./inbox.controller";
import { InboxService } from "./inbox.service";

@Module({
  imports: [SystemEmailModule],
  controllers: [InboxController],
  providers: [InboxService],
  exports: [InboxService],
})
export class InboxModule {
  private readonly _moduleMarker = true;
}
