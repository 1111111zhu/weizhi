import { Controller, Headers, Post, Req } from "@nestjs/common";
import type { Request } from "express";

import { ApiBadRequestException } from "../common/api-error";
import { Tracking17TrackService } from "./tracking-17track.service";

type RawBodyRequest = Request & { rawBody?: Buffer };

@Controller("webhooks/17track")
export class Tracking17TrackWebhookController {
  constructor(private readonly tracking: Tracking17TrackService) {}

  @Post()
  receive(
    @Req() request: RawBodyRequest,
    @Headers("sign") signature: string | undefined
  ) {
    if (!request.rawBody) {
      throw new ApiBadRequestException(
        "INVALID_WEBHOOK_PAYLOAD",
        "Missing raw 17TRACK webhook payload"
      );
    }
    return this.tracking.acceptWebhook(request.rawBody, signature);
  }
}
