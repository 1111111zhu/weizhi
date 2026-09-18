import { UnauthorizedException } from "@nestjs/common";

import type { ErrorCode } from "./api-error";

export class ApiUnauthorizedException extends UnauthorizedException {
  constructor(code: ErrorCode, message: string) {
    super({ code, message });
  }
}
