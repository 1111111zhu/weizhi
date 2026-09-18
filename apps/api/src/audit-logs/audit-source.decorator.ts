import { createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import { auditLogSourceFromRequest } from "./audit-log-source";

export const AuditSource = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    auditLogSourceFromRequest(context.switchToHttp().getRequest<Request>())
);
