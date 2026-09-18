import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import {
  ApiForbiddenException,
  ApiUnauthorizedException,
} from "../common/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { BETTER_AUTH_SESSION_READER } from "./better-auth-session-reader";
import type { BetterAuthSessionReader } from "./better-auth-session-reader";
import { SKIP_DECLARATION_GATE_KEY } from "./declaration-gate.decorator";
import type { RequestUser } from "./request-user";

const SYSTEM_DECLARATION_RELATION_SELECT = {
  where: {
    projectId: null,
    declarationVersion: "v1",
  },
  select: { id: true },
  take: 1,
} as const;
const AUTH_GUARD_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  globalRole: true,
  status: true,
} as const;
const AUTH_GUARD_USER_WITH_DECLARATION_SELECT = {
  ...AUTH_GUARD_USER_SELECT,
  independenceDeclarations: SYSTEM_DECLARATION_RELATION_SELECT,
} as const;

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(BETTER_AUTH_SESSION_READER)
    private readonly auth: BetterAuthSessionReader,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(Reflector)
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();
    const session = await this.auth.getSession(request.headers);
    if (!session) {
      throw new ApiUnauthorizedException("UNAUTHORIZED", "请先登录");
    }

    try {
      const skipDeclarationGate = this.shouldSkipDeclarationGate(context);
      const user = await this.prisma.user.findUnique({
        where: { id: session.user.id },
        select: skipDeclarationGate
          ? AUTH_GUARD_USER_SELECT
          : AUTH_GUARD_USER_WITH_DECLARATION_SELECT,
      });
      if (!user || user.status !== "ACTIVE") {
        throw new ApiUnauthorizedException("UNAUTHORIZED", "账号不可用");
      }
      request.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        globalRole: user.globalRole,
      };
      if (skipDeclarationGate) {
        return true;
      }
      const userWithDeclaration = user as typeof user & {
        independenceDeclarations?: { id: string }[];
      };
      if (!userWithDeclaration.independenceDeclarations?.[0]) {
        throw new ApiForbiddenException(
          "DECLARATION_REQUIRED",
          "请先确认独立性声明"
        );
      }
      return true;
    } catch (error) {
      if (
        error instanceof ApiUnauthorizedException ||
        error instanceof ApiForbiddenException
      ) {
        throw error;
      }
      throw new ApiUnauthorizedException("UNAUTHORIZED", "登录状态已失效");
    }
  }

  private shouldSkipDeclarationGate(context: ExecutionContext) {
    return (
      this.reflector.getAllAndOverride<boolean>(SKIP_DECLARATION_GATE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }
}
