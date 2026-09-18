import { Module } from "@nestjs/common";

import { FrameworkTemplatesController } from "./framework-templates.controller";
import { FrameworkTemplatesService } from "./framework-templates.service";

@Module({
  controllers: [FrameworkTemplatesController],
  providers: [FrameworkTemplatesService],
})
export class FrameworkTemplatesModule {
  private readonly _moduleMarker = true;
}
