import { afterEach, describe, expect, test, vi } from "vitest";

import {
  getTmsTimesheetQuery,
  linkTmsProject,
  login,
  loginWithOtp,
  me,
  requestLoginOtp,
  requestPasswordResetOtp,
  resetPasswordWithOtp,
  signOut,
  submitTimesheet,
  tmsEngagementDirectory,
} from "./api";

describe("tMS cookie-session API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test("keeps the shared cookie session usable across refresh lookups", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "mock");
    const previewWindow = createPreviewWindow();
    stubPreviewEnvironment(previewWindow);

    await login("partner@projectwing.local", "Partner123!");
    await expect(me()).resolves.toMatchObject({
      email: "partner@projectwing.local",
    });
    await expect(me()).resolves.toMatchObject({
      email: "partner@projectwing.local",
    });
  });

  test("restores an Intranet entry from the shared cookie session", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "mock");
    const previewWindow = createPreviewWindow();
    stubPreviewEnvironment(previewWindow);

    await login("partner@projectwing.local", "Partner123!");
    await expect(me()).resolves.toMatchObject({
      email: "partner@projectwing.local",
    });
  });

  test("returns null when no shared session is available", async () => {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage();
    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("sessionStorage", sessionStorage);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(me()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3000/account/me", {
      credentials: "include",
    });
  });

  test("queries timesheets with server-side filters and pagination", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        {
          mode: "DETAIL",
          rows: [],
          total: 0,
          page: 1,
          pageSize: 50,
        },
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await getTmsTimesheetQuery({
      staffName: "Hugo",
      mode: "DETAIL",
      sortBy: "JOB_CODE",
      sortDirection: "asc",
      page: 1,
      pageSize: 50,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        "/tms/timesheets/query?staffName=Hugo&mode=DETAIL"
      ),
      expect.objectContaining({ credentials: "include" })
    );
  });

  test("links a TMS row to an EMP project through the project-links endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        {
          id: "tms-link-1",
          rowId: "tms-row-1",
          ownerUserId: "user-1",
          ownerName: "Partner",
          year: 2026,
          month: 8,
          periodScope: "first",
          tmsCode: "DUMMY-TMS-000001",
          label: "Dummy",
          projectId: "project-1",
          projectCode: "DUMMY-EMP-1000001",
          projectName: "Dummy",
          status: "LINKED",
        },
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      linkTmsProject("tms-row-1", "project-1")
    ).resolves.toMatchObject({
      tmsCode: "DUMMY-TMS-000001",
      projectId: "project-1",
      status: "LINKED",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/tms/timesheets/project-links",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ rowId: "tms-row-1", projectId: "project-1" }),
      })
    );
  });

  test("preserves server validation details for timesheet submissions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        {
          code: "VALIDATION_FAILED",
          message: "2026-07-01 Normal + Leave 不能超过 8 小时",
        },
        { status: 400 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      submitTimesheet(2026, 7, { scope: "SECOND_HALF" })
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      message: "2026-07-01 Normal + Leave 不能超过 8 小时",
      status: 400,
    });
  });

  test("signs in through Better Auth and reads the shared session", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({}, { status: 200 }))
      .mockResolvedValueOnce(
        Response.json(
          {
            id: "user-1",
            email: "partner@projectwing.local",
            name: "Partner",
            globalRole: "PARTNER",
          },
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      login("partner@projectwing.local", "Partner123!", true)
    ).resolves.toMatchObject({
      email: "partner@projectwing.local",
      globalRole: "PARTNER",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/auth/sign-in/email",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          email: "partner@projectwing.local",
          password: "Partner123!",
          rememberMe: true,
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/account/me",
      { credentials: "include" }
    );
  });

  test("surfaces a rejected Better Auth sign-in", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { message: "Invalid email or password." },
            { status: 401 }
          )
        )
    );

    await expect(login("staff@example.com", "wrong-password")).rejects.toThrow(
      "Invalid email or password."
    );
  });

  test("requests and verifies an email OTP through Better Auth", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({}, { status: 200 }))
      .mockResolvedValueOnce(Response.json({}, { status: 200 }))
      .mockResolvedValueOnce(
        Response.json(
          {
            id: "user-1",
            email: "staff@example.com",
            name: "Staff",
            globalRole: "STAFF",
          },
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    await requestLoginOtp("staff@example.com");
    await expect(
      loginWithOtp("staff@example.com", "123456")
    ).resolves.toStrictEqual(
      expect.objectContaining({ email: "staff@example.com" })
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/auth/email-otp/send-verification-otp",
      expect.objectContaining({ method: "POST", credentials: "include" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/auth/sign-in/email-otp",
      expect.objectContaining({
        body: JSON.stringify({ email: "staff@example.com", otp: "123456" }),
      })
    );
  });

  test("uses 123456 for email-code sign-in in preview mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "mock");
    vi.stubGlobal("window", createPreviewWindow());

    await expect(
      requestLoginOtp("partner@projectwing.local")
    ).resolves.toStrictEqual({ demoCode: "123456" });
    await expect(
      loginWithOtp("partner@projectwing.local", "123456")
    ).resolves.toMatchObject({ email: "partner@projectwing.local" });
    await expect(
      loginWithOtp("partner@projectwing.local", "000000")
    ).rejects.toMatchObject({ code: "OTP_INVALID" });
  });

  test("requests and completes password reset in preview mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "mock");
    vi.stubGlobal("window", createPreviewWindow());

    await expect(
      requestPasswordResetOtp("partner@projectwing.local")
    ).resolves.toStrictEqual({ demoCode: "123456" });
    await expect(
      resetPasswordWithOtp(
        "partner@projectwing.local",
        "123456",
        "NewPassword123!"
      )
    ).resolves.toBeUndefined();
  });

  test("loads the preview CMP directory without a browser token", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "mock");

    await expect(tmsEngagementDirectory("Orchid")).resolves.toStrictEqual([
      expect.objectContaining({
        projectCode: "ORC-2026-AUD-GROUP",
        engagementCode: "ORC-2026-AUD",
        clientCode: "C-ORC-2026",
      }),
      expect.objectContaining({
        projectCode: "ORC-2026-AUD-HK",
        engagementCode: "ORC-2026-AUD",
        clientCode: "C-ORC-2026",
      }),
    ]);
  });

  test("uses a signed-out preview session only in explicit mock mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "mock");
    const previewWindow = createPreviewWindow();
    const fetchMock = vi.fn();
    stubPreviewEnvironment(previewWindow);
    vi.stubGlobal("fetch", fetchMock);

    await expect(me()).resolves.toBeNull();
    await expect(
      login("partner@projectwing.local", "Partner123!")
    ).resolves.toMatchObject({ email: "partner@projectwing.local" });
    await expect(me()).resolves.toMatchObject({
      email: "partner@projectwing.local",
    });
    await signOut();
    await expect(me()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("keeps localhost on live auth when an API base URL is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:3000");
    vi.stubGlobal("window", createPreviewWindow());
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({}, { status: 200 }))
      .mockResolvedValueOnce(
        Response.json(
          {
            id: "user-1",
            email: "partner@projectwing.local",
            name: "Partner",
            globalRole: "PARTNER",
          },
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    await login("partner@projectwing.local", "Partner123!");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/auth/sign-in/email",
      expect.objectContaining({ method: "POST" })
    );
  });

  test("loads the CMP-backed directory with cookie credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        {
          engagements: [
            {
              id: "engagement-1",
              engagementCode: "ORC-2026-AUD",
              clientId: "client-1",
              clientCode: "C-ORC",
              clientName: "Orchid Limited",
              serviceType: "AUDIT",
              budgetedHours: "420.00",
              agreedFee: "180000.00",
              recoveryRate: null,
              feeCurrency: "HKD",
              pic: "Jony Ma",
              mic: "Eden Chan",
              codeAliases: [],
              timesheetAccess: {
                allowed: false,
                reason: "INDEPENDENCE_DECLARATION_REQUIRED",
              },
            },
          ],
        },
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(tmsEngagementDirectory("Orchid")).resolves.toStrictEqual([
      expect.objectContaining({
        engagementCode: "ORC-2026-AUD",
        timesheetAccess: {
          allowed: false,
          reason: "INDEPENDENCE_DECLARATION_REQUIRED",
        },
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/cmp/integrations/tms/engagements?q=Orchid",
      expect.objectContaining({
        cache: "no-store",
        credentials: "include",
      })
    );
  });

  test("signs out through the central cookie endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({}, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(signOut()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/auth/sign-out",
      { method: "POST", credentials: "include" }
    );
  });

  test("clears the preview session after sign-out", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "mock");
    const previewWindow = createPreviewWindow();
    stubPreviewEnvironment(previewWindow);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({}, { status: 200 }))
    );

    await signOut();

    await expect(me()).resolves.toBeNull();
  });
});

function createPreviewWindow() {
  const localStorage = createMemoryStorage();
  const sessionStorage = createMemoryStorage();
  return {
    location: { hostname: "localhost" },
    localStorage,
    sessionStorage,
  };
}

function stubPreviewEnvironment(
  previewWindow: ReturnType<typeof createPreviewWindow>
) {
  vi.stubGlobal("window", previewWindow);
  vi.stubGlobal("localStorage", previewWindow.localStorage);
  vi.stubGlobal("sessionStorage", previewWindow.sessionStorage);
}

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}
