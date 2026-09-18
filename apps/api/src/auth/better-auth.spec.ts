import {
  PROJECT_WING_DESKTOP_AGENT_CLIENT_ID,
  createProjectWingAuthOptions,
  createProjectWingDeviceAuthorizationOptions,
  createProjectWingEmailOtpOptions,
  shouldEnableDevelopmentImpersonation,
} from "./better-auth-options";

const runtimeConfig = {
  baseURL: "https://auth.superfx.cn",
  cookieDomain: ".superfx.cn",
  environment: "restricted" as const,
  secret: "test-secret-that-is-long-enough-for-better-auth",
  trustedOrigins: ["https://emp.superfx.cn", "https://cmp.superfx.cn"],
  useSecureCookies: true,
};

describe(createProjectWingAuthOptions, () => {
  it("only enables identity simulation in the explicit development environment", () => {
    expect(
      shouldEnableDevelopmentImpersonation({ environment: "development" })
    ).toBeTruthy();
    expect(
      shouldEnableDevelopmentImpersonation({ environment: "restricted" })
    ).toBeFalsy();
  });

  it("maps Better Auth to Project Wing's existing user and auth models", () => {
    const options = createProjectWingAuthOptions(runtimeConfig, {} as never);

    expect(options.baseURL).toBe(runtimeConfig.baseURL);
    expect(options.basePath).toBe("/auth");
    expect(options.user?.modelName).toBe("user");
    expect(options.session?.modelName).toBe("authSession");
    expect(options.account?.modelName).toBe("authAccount");
    expect(options.verification?.modelName).toBe("authVerification");
    expect(options.emailAndPassword?.enabled).toBeTruthy();
    expect(options.emailAndPassword?.disableSignUp).toBeTruthy();
    expect(
      options.emailAndPassword?.revokeSessionsOnPasswordReset
    ).toBeTruthy();
    expect(options.advanced?.useSecureCookies).toBeTruthy();
    expect(options.advanced?.crossSubDomainCookies).toStrictEqual({
      enabled: true,
      domain: ".superfx.cn",
    });
  });

  it("audits a successful password reset", async () => {
    const onPasswordReset = vi.fn().mockResolvedValue(undefined as never);
    const options = createProjectWingAuthOptions(
      runtimeConfig,
      {} as never,
      undefined,
      undefined,
      undefined,
      onPasswordReset
    );

    await options.emailAndPassword?.onPasswordReset?.({
      user: {
        id: "user-1",
        email: "user@example.com",
      } as never,
    });

    expect(onPasswordReset).toHaveBeenCalledWith({
      id: "user-1",
      email: "user@example.com",
    });
  });

  it("keeps existing bcrypt password hashes valid", async () => {
    const options = createProjectWingAuthOptions(runtimeConfig, {} as never);
    const password = options.emailAndPassword?.password;
    const hash = await password?.hash?.("existing-password");

    expect(hash).toMatch(/^\$2[aby]\$/);
    await expect(
      password?.verify?.({
        hash: hash as string,
        password: "existing-password",
      })
    ).resolves.toBeTruthy();
    await expect(
      password?.verify?.({ hash: hash as string, password: "wrong-password" })
    ).resolves.toBeFalsy();
  });

  it("preserves the session audit hook for successful sign-ins", async () => {
    const onSessionCreated = vi.fn().mockResolvedValue(undefined as never);
    const options = createProjectWingAuthOptions(
      runtimeConfig,
      {} as never,
      onSessionCreated
    );

    await options.databaseHooks?.session?.create?.after?.({
      userId: "user-1",
    });

    expect(onSessionCreated).toHaveBeenCalledWith({ userId: "user-1" });
  });

  it("blocks a session when the account policy rejects it", async () => {
    const canCreateSession = vi.fn().mockResolvedValue(false);
    const options = createProjectWingAuthOptions(
      runtimeConfig,
      {} as never,
      undefined,
      canCreateSession
    );

    await expect(
      options.databaseHooks?.session?.create?.before?.({
        userId: "disabled-user",
      })
    ).resolves.toBeFalsy();

    expect(canCreateSession).toHaveBeenCalledWith({ userId: "disabled-user" });
  });

  it("rejects OTP delivery uniformly when the mail service is unavailable", async () => {
    const options = createProjectWingAuthOptions(
      runtimeConfig,
      {} as never,
      undefined,
      undefined,
      () => false
    );

    await expect(
      options.hooks?.before?.({
        path: "/email-otp/send-verification-otp",
        body: { email: "unknown@example.com", type: "sign-in" },
      } as never)
    ).rejects.toThrow("Email verification code service is unavailable");
  });

  it("keeps a hashed decoy OTP for unknown emails", async () => {
    const createVerificationValue = vi
      .fn()
      .mockResolvedValue(undefined as never);
    const options = createProjectWingAuthOptions(runtimeConfig, {} as never);
    const hookResult = await options.hooks?.after?.({
      path: "/email-otp/send-verification-otp",
      body: { email: "Unknown@Example.com", type: "sign-in" },
      context: {
        internalAdapter: {
          findVerificationValue: vi.fn().mockResolvedValue(null),
          createVerificationValue,
        },
      },
    } as never);

    expect(hookResult).toStrictEqual({});
    expect(createVerificationValue).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: "sign-in-otp-unknown@example.com",
        value: expect.stringMatching(/^[A-Za-z0-9_-]+:0$/),
        expiresAt: expect.any(Date),
      })
    );
    expect(createVerificationValue.mock.calls[0]?.[0].value).not.toContain(
      "123456"
    );
  });

  it("enables a scoped device flow for the Desktop Agent", () => {
    const deviceAuthorization =
      createProjectWingDeviceAuthorizationOptions(runtimeConfig);

    expect(deviceAuthorization).toMatchObject({
      verificationUri: `${runtimeConfig.baseURL}/auth/device`,
      schema: { deviceCode: { modelName: "authDeviceCode" } },
    });
    expect(
      deviceAuthorization.validateClient(PROJECT_WING_DESKTOP_AGENT_CLIENT_ID)
    ).toBeTruthy();
    expect(deviceAuthorization.validateClient("untrusted-client")).toBeFalsy();
  });

  it("configures secure, single-use sign-in email codes", async () => {
    const sendSignInOtp = vi.fn().mockResolvedValue(undefined as never);
    const options = createProjectWingEmailOtpOptions(sendSignInOtp);

    expect(options).toMatchObject({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 3,
      disableSignUp: true,
      storeOTP: "hashed",
      resendStrategy: "rotate",
      rateLimit: { window: 60, max: 3 },
    });

    await options.sendVerificationOTP({
      email: "staff@example.com",
      otp: "123456",
      type: "sign-in",
    });
    expect(sendSignInOtp).toHaveBeenCalledWith({
      email: "staff@example.com",
      otp: "123456",
      type: "sign-in",
    });

    await options.sendVerificationOTP({
      email: "staff@example.com",
      otp: "654321",
      type: "forget-password",
    });
    expect(sendSignInOtp).toHaveBeenLastCalledWith({
      email: "staff@example.com",
      otp: "654321",
      type: "forget-password",
    });
  });

  it("does not reuse the sign-in mailer for unsupported OTP flows", async () => {
    const options = createProjectWingEmailOtpOptions(vi.fn());

    await expect(
      options.sendVerificationOTP({
        email: "staff@example.com",
        otp: "123456",
        type: "email-verification",
      })
    ).rejects.toThrow("Unsupported email verification code type");
  });
});
