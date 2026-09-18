import { Injectable } from "@nestjs/common";
import type { UpdateUserPreferencesInput } from "@project-wing/shared";

import { PrismaService } from "../prisma/prisma.service";

const SYSTEM_DECLARATION_RELATION_SELECT = {
  where: {
    projectId: null,
    declarationVersion: "v1",
  },
  select: { acceptedAt: true },
  take: 1,
} as const;
const CURRENT_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  globalRole: true,
  status: true,
  preferredLocale: true,
  cmpCurrencyOrder: true,
  independenceDeclarations: SYSTEM_DECLARATION_RELATION_SELECT,
} as const;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: CURRENT_USER_SELECT,
    });
    return this.toCurrentUser(user, user.independenceDeclarations[0]);
  }

  async updatePreferences(userId: string, input: UpdateUserPreferencesInput) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.preferredLocale === undefined
          ? {}
          : { preferredLocale: input.preferredLocale }),
        ...(input.cmpCurrencyOrder === undefined
          ? {}
          : { cmpCurrencyOrder: input.cmpCurrencyOrder }),
      },
    });
    return this.me(userId);
  }

  private toCurrentUser(
    user: {
      id: string;
      email: string;
      name: string;
      globalRole: string;
      preferredLocale: string;
      cmpCurrencyOrder: unknown;
    },
    declaration?: { acceptedAt: Date } | null
  ) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      globalRole: user.globalRole,
      preferredLocale: user.preferredLocale,
      cmpCurrencyOrder: Array.isArray(user.cmpCurrencyOrder)
        ? user.cmpCurrencyOrder.filter((currency): currency is string => typeof currency === "string")
        : [],
      declarationAccepted: Boolean(declaration),
      declarationAcceptedAt: declaration?.acceptedAt ?? null,
    };
  }
}
