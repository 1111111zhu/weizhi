import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/request-user";
import { InboxService } from "./inbox.service";

@UseGuards(AuthGuard)
@Controller("inbox/messages")
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.inbox.list(user.id);
  }

  @Post(":messageId/read")
  markRead(
    @Param("messageId") messageId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.inbox.markRead(messageId, user.id);
  }

  @Post(":messageId/unread")
  markUnread(
    @Param("messageId") messageId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.inbox.markUnread(messageId, user.id);
  }

  @Post("read-all")
  markAllRead(@CurrentUser() user: RequestUser) {
    return this.inbox.markAllRead(user.id);
  }

  @Delete(":messageId")
  delete(
    @Param("messageId") messageId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.inbox.delete(messageId, user.id);
  }
}
