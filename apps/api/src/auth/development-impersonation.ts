import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import * as z from "zod";

import type { PrismaService } from "../prisma/prisma.service";

const accountSelect = {
  id: true,
  email: true,
  name: true,
  image: true,
  emailVerified: true,
  globalRole: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function developmentImpersonation(prisma: PrismaService) {
  return {
    id: "development-impersonation",
    endpoints: {
      listDevelopmentAccounts: createAuthEndpoint(
        "/development/accounts",
        { method: "GET" },
        async (ctx) => {
          const accounts = await prisma.user.findMany({
            where: { status: "ACTIVE" },
            orderBy: [{ globalRole: "asc" }, { name: "asc" }],
            select: accountSelect,
          });
          return ctx.json({ accounts });
        }
      ),
      impersonateDevelopmentAccount: createAuthEndpoint(
        "/development/impersonate",
        { method: "POST", body: z.object({ email: z.string().email() }) },
        async (ctx) => {
          const user = await prisma.user.findFirst({
            where: {
              email: { equals: ctx.body.email.trim(), mode: "insensitive" },
              status: "ACTIVE",
            },
            select: accountSelect,
          });
          if (!user) {
            throw new APIError("NOT_FOUND", {
              message: "Active account not found.",
            });
          }

          const session = await ctx.context.internalAdapter.createSession(
            user.id
          );
          if (!session) {
            throw new APIError("UNAUTHORIZED", {
              message: "Failed to create session.",
            });
          }

          await setSessionCookie(ctx, { session, user });
          return ctx.json({ user });
        }
      ),
    },
  };
}
