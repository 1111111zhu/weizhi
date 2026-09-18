import { ServiceUnavailableException } from "@nestjs/common";

import type { ErrorCode } from "./api-error";

export class ApiServiceUnavailableException extends ServiceUnavailableException {
  constructor(code: ErrorCode, message: string) {
    super({ code, message });
  }
}
