import { createHash, randomInt } from "node:crypto";

import {
  EMAIL_SIGN_IN_OTP_LENGTH,
  EMAIL_SIGN_IN_OTP_RESEND_SECONDS,
} from "@project-wing/shared";
import { compare, hash } from "bcryptjs";
import type { BetterAuthOptions } from "better-auth";

const BCRYPT_ROUNDS = 12;
const EMAIL_SIGN_IN_OTP_DELIVERY_PATH = "/email-otp/send-verification-otp";
const EMAIL_SIGN_IN_OTP_EXPIRES_SECONDS = 300;

export const BETTER_AUTH_BASE_PATH = "/auth";
export const PROJECT_WING_DESKTOP_AGENT_CLIENT_ID =
  "project-wing-desktop-agent";

export interface ProjectWingAuthRuntimeConfig {
  baseURL: string;
  cookieDomain?: string;
  environment: "development" | "restricted";
  secret: string;
  trustedOrigins: string[];
  useSecureCookies: boolean;
}

export function shouldEnableDevelopmentImpersonation(
  config: Pick<ProjectWingAuthRuntimeConfig, "environment">
) {
  return config.environment === "development";
}

export type ProjectWingSessionCreatedHook = (session: {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) => Promise<void>;

export type ProjectWingSessionCreationGuard = (session: {
  userId: string;
}) => Promise<boolean>;

export type ProjectWingEmailOtpType = "sign-in" | "forget-password";

export type ProjectWingEmailOtpSender = (input: {
  email: string;
  otp: string;
  type: ProjectWingEmailOtpType;
}) => Promise<void>;

export type ProjectWingEmailOtpAvailability = () => boolean | Promise<boolean>;

export type ProjectWingPasswordResetHook = (user: {
  id: string;
  email: string;
}) => Promise<void>;

type ProjectWingEmailOtpHookContext = {
  path?: string;
  body?: { email?: string; type?: string };
  context?: {
    internalAdapter: {
      findVerificationValue: (identifier: string) => Promise<unknown>;
      createVerificationValue: (input: {
        identifier: string;
        value: string;
        expiresAt: Date;
      }) => Promise<unknown>;
    };
  };
};

export function createProjectWingEmailOtpOptions(
  sendEmailOtp: ProjectWingEmailOtpSender
) {
  return {
    otpLength: EMAIL_SIGN_IN_OTP_LENGTH,
    expiresIn: EMAIL_SIGN_IN_OTP_EXPIRES_SECONDS,
    allowedAttempts: 3,
    disableSignUp: true,
    storeOTP: "hashed" as const,
    resendStrategy: "rotate" as const,
    rateLimit: { window: EMAIL_SIGN_IN_OTP_RESEND_SECONDS, max: 3 },
    sendVerificationOTP: async ({
      email,
      otp,
      type,
    }: {
      email: string;
      otp: string;
      type: string;
    }) => {
      if (type !== "sign-in" && type !== "forget-password") {
        throw new Error("Unsupported email verification code type.");
      }
      await sendEmailOtp({
        email,
        otp,
        type: type as ProjectWingEmailOtpType,
      });
    },
  };
}
export function createProjectWingDeviceAuthorizationOptions(
  config: ProjectWingAuthRuntimeConfig
) {
  return {
    verificationUri: `${config.baseURL}${BETTER_AUTH_BASE_PATH}/device`,
    validateClient: (clientId: string) =>
      clientId === PROJECT_WING_DESKTOP_AGENT_CLIENT_ID,
    schema: {
      deviceCode: { modelName: "authDeviceCode" },
    },
  };
}

export function hashProjectWingPassword(password: string) {
  return hash(password, BCRYPT_ROUNDS);
}

export function verifyProjectWingPassword(
  password: string,
  passwordHash: string
) {
  return compare(password, passwordHash);
}

export function createProjectWingAuthOptions(
  config: ProjectWingAuthRuntimeConfig,
  database: BetterAuthOptions["database"],
  onSessionCreated?: ProjectWingSessionCreatedHook,
  canCreateSession?: ProjectWingSessionCreationGuard,
  canSendEmailOtp: ProjectWingEmailOtpAvailability = () => true,
  onPasswordReset?: ProjectWingPasswordResetHook
) {
  const sessionCreateHooks = {
    ...(canCreateSession ? { before: canCreateSession } : {}),
    ...(onSessionCreated ? { after: onSessionCreated } : {}),
  };

  return {
    appName: "Project Wing",
    baseURL: config.baseURL,
    basePath: BETTER_AUTH_BASE_PATH,
    secret: config.secret,
    database,
    trustedOrigins: config.trustedOrigins,
    user: { modelName: "user" },
    session: { modelName: "authSession" },
    account: { modelName: "authAccount" },
    verification: { modelName: "authVerification" },
    hooks: {
      before: async (hookContext) => {
        const ctx = hookContext as unknown as ProjectWingEmailOtpHookContext;
        if (
          ctx.path === EMAIL_SIGN_IN_OTP_DELIVERY_PATH &&
          (ctx.body?.type === "sign-in" ||
            ctx.body?.type === "forget-password") &&
          !(await canSendEmailOtp())
        ) {
          throw new Error("Email verification code service is unavailable.");
        }
        return {};
      },
      after: async (hookContext) => {
        const ctx = hookContext as unknown as ProjectWingEmailOtpHookContext;
        if (
          ctx.path !== EMAIL_SIGN_IN_OTP_DELIVERY_PATH ||
          ctx.body?.type !== "sign-in" ||
          !ctx.context
        ) {
          return {};
        }

        const email =
          typeof ctx.body.email === "string"
            ? ctx.body.email.trim().toLowerCase()
            : "";
        if (!email) {
          return {};
        }

        const identifier = `sign-in-otp-${email}`;
        const existing =
          await ctx.context.internalAdapter.findVerificationValue(identifier);
        if (existing) {
          return {};
        }

        // Better Auth removes the record for unknown accounts when sign-up is
        // Disabled. Keep an indistinguishable decoy record so verification
        // Errors cannot be used to enumerate registered email addresses.
        const decoyOtp = randomInt(0, 10 ** EMAIL_SIGN_IN_OTP_LENGTH)
          .toString()
          .padStart(EMAIL_SIGN_IN_OTP_LENGTH, "0");
        const storedOtp = createHash("sha256")
          .update(decoyOtp)
          .digest("base64url");
        await ctx.context.internalAdapter.createVerificationValue({
          identifier,
          value: `${storedOtp}:0`,
          expiresAt: new Date(
            Date.now() + EMAIL_SIGN_IN_OTP_EXPIRES_SECONDS * 1000
          ),
        });
        return {};
      },
    },
    ...(Object.keys(sessionCreateHooks).length > 0
      ? {
          databaseHooks: {
            session: {
              create: sessionCreateHooks,
            },
          },
        }
      : {}),
    advanced: {
      cookiePrefix: "project_wing",
      useSecureCookies: config.useSecureCookies,
      crossSubDomainCookies: config.cookieDomain
        ? { enabled: true, domain: config.cookieDomain }
        : undefined,
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      revokeSessionsOnPasswordReset: true,
      ...(onPasswordReset
        ? {
            onPasswordReset: ({
              user,
            }: {
              user: { id: string; email: string };
            }) => onPasswordReset(user),
          }
        : {}),
      password: {
        hash: hashProjectWingPassword,
        verify: ({
          hash: passwordHash,
          password,
        }: {
          hash: string;
          password: string;
        }) => verifyProjectWingPassword(password, passwordHash),
      },
    },
  } satisfies BetterAuthOptions;
}
