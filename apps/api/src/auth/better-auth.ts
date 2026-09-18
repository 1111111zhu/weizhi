import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { bearer, deviceAuthorization, emailOTP } from "better-auth/plugins";

import type { PrismaService } from "../prisma/prisma.service";
import {
  createProjectWingAuthOptions,
  createProjectWingDeviceAuthorizationOptions,
  createProjectWingEmailOtpOptions,
  shouldEnableDevelopmentImpersonation,
} from "./better-auth-options";
import type {
  ProjectWingAuthRuntimeConfig,
  ProjectWingEmailOtpAvailability,
  ProjectWingEmailOtpSender,
  ProjectWingPasswordResetHook,
  ProjectWingSessionCreatedHook,
} from "./better-auth-options";
import { developmentImpersonation } from "./development-impersonation";

export function createProjectWingAuth(
  prisma: PrismaService,
  config: ProjectWingAuthRuntimeConfig,
  onSessionCreated?: ProjectWingSessionCreatedHook,
  sendEmailOtp: ProjectWingEmailOtpSender = async () => {
    await Promise.resolve();
    throw new Error("Email verification code service is unavailable.");
  },
  canSendEmailOtp: ProjectWingEmailOtpAvailability = () => true,
  onPasswordReset?: ProjectWingPasswordResetHook
) {
  const canCreateSession = async ({ userId }: { userId: string }) => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    return user?.status === "ACTIVE";
  };

  return betterAuth({
    ...createProjectWingAuthOptions(
      config,
      prismaAdapter(prisma, { provider: "postgresql" }),
      onSessionCreated,
      canCreateSession,
      canSendEmailOtp,
      onPasswordReset
    ),
    plugins: [
      ...(shouldEnableDevelopmentImpersonation(config)
        ? [developmentImpersonation(prisma)]
        : []),
      bearer(),
      deviceAuthorization(createProjectWingDeviceAuthorizationOptions(config)),
      emailOTP(createProjectWingEmailOtpOptions(sendEmailOtp)),
    ],
  });
}
