import { ForbiddenException } from "@nestjs/common";

import type { ErrorCode } from "./api-error";

export class ApiForbiddenException extends ForbiddenException {
  constructor(code: ErrorCode, message: string) {
    super({ code, message });
  }
}
