import { BadRequestException } from "@nestjs/common";

import type { ErrorCode } from "./api-error";

export class ApiBadRequestException extends BadRequestException {
  constructor(code: ErrorCode, message: string) {
    super({ code, message });
  }
}
