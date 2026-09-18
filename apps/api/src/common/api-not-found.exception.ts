import { NotFoundException } from "@nestjs/common";

import type { ErrorCode } from "./api-error";

export class ApiNotFoundException extends NotFoundException {
  constructor(code: ErrorCode, message: string) {
    super({ code, message });
  }
}
