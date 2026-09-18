import { Controller, Get, Query, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { Tracking17TrackCarrierDirectoryService } from "./tracking-17track-carrier-directory.service";

@UseGuards(AuthGuard)
@Controller("tracking/17track")
export class Tracking17TrackCarriersController {
  constructor(
    private readonly carriers: Tracking17TrackCarrierDirectoryService
  ) {}

  @Get("carriers")
  search(@Query("q") query = "") {
    return this.carriers.search(query);
  }
}
