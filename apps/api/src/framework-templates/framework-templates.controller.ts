import { Controller, Get, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { FrameworkTemplatesService } from "./framework-templates.service";

@UseGuards(AuthGuard)
@Controller("framework-templates")
export class FrameworkTemplatesController {
  constructor(private readonly frameworkTemplates: FrameworkTemplatesService) {}

  @Get()
  list() {
    return this.frameworkTemplates.list();
  }
}
