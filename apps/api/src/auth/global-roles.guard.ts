import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { GlobalRole } from "@prisma/client";

import { ApiForbiddenException } from "../common/api-error";
import { GLOBAL_ROLES_KEY } from "./global-roles.decorator";
import type { RequestUser } from "./request-user";

@Injectable()
export class GlobalRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<GlobalRole[]>(
      GLOBAL_ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );
    if (!roles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    if (!request.user || !roles.includes(request.user.globalRole)) {
      throw new ApiForbiddenException("FORBIDDEN", "无权访问该功能");
    }
    return true;
  }
}
