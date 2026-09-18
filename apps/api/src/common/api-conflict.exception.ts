import { ConflictException } from "@nestjs/common";

import type { ErrorCode } from "./api-error";

export class ApiConflictException extends ConflictException {
  constructor(code: ErrorCode, message: string, details?: object) {
    super({ code, message, ...details });
  }
}
