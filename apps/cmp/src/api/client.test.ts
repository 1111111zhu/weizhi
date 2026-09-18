import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// @vitest-environment happy-dom

describe("cMP API preview mode", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("accepts the local demo account without requiring the API server", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "mock");

    const { api } = await import("./client");
    await expect(
      api.login({
        email: "partner@projectwing.local",
        password: "Partner123!",
      })
    ).resolves.toMatchObject({
      email: "partner@projectwing.local",
      name: "Jony Ma",
      globalRole: "PARTNER",
    });
  });

  it("exposes every preview identity to the mock identity simulator", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "mock");

    const { api } = await import("./client");

    await expect(api.listDevelopmentAccounts()).resolves.toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email: "eden.chan@projectwing.local",
          role: "SUPER_ADMIN",
        }),
        expect.objectContaining({
          email: "partner@projectwing.local",
          role: "PARTNER",
        }),
      ])
    );
    await expect(
      api.impersonateDevelopmentAccount("eden.chan@projectwing.local")
    ).resolves.toMatchObject({
      email: "eden.chan@projectwing.local",
      globalRole: "SUPER_ADMIN",
    });
  });

  it("enforces Super Admin and input length rules for mock AML configuration", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "mock");
    vi.stubGlobal("window", createPreviewWindow());
    const { api } = await import("./client");

    await api.login({
      email: "amy.chan@projectwing.local",
      password: "Staff123!",
    });
    await expect(
      api.updateCmpAmlConfiguration("mock-key")
    ).rejects.toMatchObject({
      status: 403,
    });

    await api.login({
      email: "eden.chan@projectwing.local",
      password: "SuperAdmin123!",
    });
    await expect(
      api.updateCmpAmlConfiguration("x".repeat(4097))
    ).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      api.updateCmpAmlConfiguration("mock-key")
    ).resolves.toMatchObject({
      enabled: true,
      configured: true,
      source: "DATABASE",
    });
    await expect(api.disableCmpAmlConfiguration()).resolves.toMatchObject({
      enabled: false,
      configured: false,
    });
  });

  it("keeps the preview session usable after entering CMP", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "mock");
    vi.stubGlobal("window", createPreviewWindow());

    const { api } = await import("./client");

    await api.login({
      email: "partner@projectwing.local",
      password: "Partner123!",
    });
    await expect(api.me()).resolves.toMatchObject({
      email: "partner@projectwing.local",
    });
    await expect(api.cmpDashboard()).resolves.toMatchObject({
      draftsAssignedToMe: 0,
    });
    await expect(api.inboxMessages()).resolves.toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "preview-message-pic",
          readAt: null,
          actionUrl: "/cmp/acceptance?requestId=preview-ca-orchid",
        }),
        expect.objectContaining({
          id: "preview-message-approved",
          readAt: expect.any(String),
        }),
      ])
    );
    await expect(
      api.markInboxMessageRead("preview-message-pic")
    ).resolves.toStrictEqual(
      expect.objectContaining({ readAt: expect.any(String) })
    );
    await expect(
      api.markInboxMessageUnread("preview-message-pic")
    ).resolves.toStrictEqual(expect.objectContaining({ readAt: null }));
  });

  it("creates, updates, and deletes acceptance drafts without a live API", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "mock");
    vi.stubGlobal("window", createPreviewWindow());
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await import("./client");

    await api.login({
      email: "partner@projectwing.local",
      password: "Partner123!",
    });
    const created = await api.createCmpAcceptance({
      type: "CLIENT",
      clientPayload: { clientCode: "" },
      micApproverId: "preview-mic",
      submit: false,
    });
    const updated = await api.updateCmpAcceptance(created.id, {
      clientPayload: { clientCode: "C-PREVIEW-001" },
      submit: false,
    });

    expect(created).toMatchObject({
      status: "DRAFT",
      micApproverId: "preview-mic",
    });
    expect(updated).toMatchObject({
      id: created.id,
      clientPayload: { clientCode: "C-PREVIEW-001" },
    });
    await expect(api.cmpAcceptanceDrafts("CLIENT")).resolves.toStrictEqual({
      drafts: [
        expect.objectContaining({
          request: expect.objectContaining({ id: created.id }),
          displayStatus: "DRAFT",
          canEdit: true,
          canDelete: true,
        }),
      ],
    });
    await expect(api.deleteCmpAcceptance(created.id)).resolves.toStrictEqual({
      id: created.id,
    });
    await expect(api.cmpAcceptance()).resolves.toStrictEqual(
      expect.objectContaining({
        requests: expect.not.arrayContaining([
          expect.objectContaining({ id: created.id }),
        ]),
      })
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps an unrouted Partner draft in preview mode without inventing an MIC", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "mock");
    vi.stubGlobal("window", createPreviewWindow());
    const { api } = await import("./client");

    await api.login({
      email: "partner@projectwing.local",
      password: "Partner123!",
    });
    const created = await api.createCmpAcceptance({
      type: "CLIENT",
      clientPayload: { clientCode: "" },
      submit: false,
    });

    expect(created).toMatchObject({
      status: "DRAFT",
      submittedById: "preview-partner",
      micApproverId: "preview-partner",
    });
  });

  it("returns a typed TMS summary in preview mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "mock");
    const { api } = await import("./client");

    await expect(api.cmpTmsEngagementSummary("eng-hbr")).resolves.toMatchObject(
      {
        approved: { total: { name: "Total" } },
        draft: { rows: expect.any(Array) },
      }
    );
  });

  it("shows multiple linked EMP projects in the preview association directory", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "mock");
    const { api } = await import("./client");

    await expect(
      api.cmpAssociationDirectory("HBR-2026-ACC")
    ).resolves.toMatchObject({
      engagements: [
        { projectCode: "HBR-2026-ACC" },
        { projectCode: "HBR-2026-ACC-02" },
      ],
    });
    await expect(
      api.cmpAssociationDirectory("DUMMY-EMP-1000027")
    ).resolves.toMatchObject({
      engagements: [
        {
          source: "UNLINKED_PROJECT",
          projectCode: "DUMMY-EMP-1000027",
        },
      ],
    });
  });

  it("defaults group-relationship collections from an older live API response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json(
            {
              client: {
                id: "client-1",
                clientCode: "C-001",
                rootEntityId: null,
              },
              asOf: "2026-08-22",
              nodes: [],
              edges: [],
            },
            { status: 200 }
          )
        )
        .mockResolvedValueOnce(
          Response.json({ relationships: [] }, { status: 200 })
        )
    );
    const { api } = await import("./client");

    await expect(api.cmpClientGraph("client-1")).resolves.toMatchObject({});
    await expect(api.cmpEntityRelationships("client-1")).resolves.toMatchObject(
      {}
    );
  });

  it("validates the current user from the shared cookie session", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "mock");
    const { api } = await import("./client");
    await api.login({
      email: "partner@projectwing.local",
      password: "Partner123!",
    });

    await expect(api.me()).resolves.toMatchObject({
      id: expect.any(String),
      email: "partner@projectwing.local",
    });
  });

  it("restores an Intranet entry from a valid server session", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "mock");
    const { api } = await import("./client");
    await api.login({
      email: "partner@projectwing.local",
      password: "Partner123!",
    });
    await expect(api.restoreIntranetEntry()).resolves.toMatchObject({
      email: "partner@projectwing.local",
    });
    await expect(api.me()).resolves.toMatchObject({
      email: "partner@projectwing.local",
    });
  });

  it("clears the preview session after sign-out", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "mock");
    vi.stubGlobal("window", createPreviewWindow());
    const { api } = await import("./client");
    await api.login({
      email: "partner@projectwing.local",
      password: "Partner123!",
    });

    await api.signOut();

    await expect(api.me()).resolves.toBeNull();
  });

  it("uses the fixed verification code only in preview mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "mock");
    vi.stubGlobal("window", createPreviewWindow());

    const { api } = await import("./client");

    await expect(
      api.requestLoginOtp("partner@projectwing.local")
    ).resolves.toStrictEqual({
      demoCode: "123456",
    });
    await expect(
      api.loginWithOtp({
        email: "partner@projectwing.local",
        otp: "123456",
      })
    ).resolves.toMatchObject({ email: "partner@projectwing.local" });
    await expect(
      api.loginWithOtp({
        email: "partner@projectwing.local",
        otp: "000000",
      })
    ).rejects.toMatchObject({ code: "OTP_INVALID" });
  });

  it("supports password reset in preview mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "mock");
    vi.stubGlobal("window", createPreviewWindow());

    const { api } = await import("./client");
    await expect(
      api.requestPasswordResetOtp("partner@projectwing.local")
    ).resolves.toStrictEqual({
      demoCode: "123456",
    });
    await expect(
      api.resetPasswordWithOtp({
        email: "partner@projectwing.local",
        otp: "123456",
        password: "NewPassword123!",
      })
    ).resolves.toBeUndefined();
  });

  it("uses live auth on localhost unless mock mode is explicitly enabled", async () => {
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

    const { api } = await import("./client");
    await api.login({
      email: "partner@projectwing.local",
      password: "Partner123!",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/auth/sign-in/email",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("preserves safe validation details from live API errors", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:3000");
    vi.stubGlobal("window", createPreviewWindow());
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            code: "BAD_REQUEST",
            message: "Partner-initiated requests must select an MIC",
            requestId: "request-error-1",
          },
          { status: 400 }
        )
      )
    );

    const { ApiError, api } = await import("./client");
    await expect(api.cmpAcceptance()).rejects.toStrictEqual(
      expect.objectContaining({
        name: "ApiError",
        status: 400,
        code: "BAD_REQUEST",
        requestId: "request-error-1",
        message: "Partner-initiated requests must select an MIC",
      })
    );
    expect(ApiError).toBeDefined();
  });

  it("requests and verifies a live email sign-in code", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:3000");
    vi.stubGlobal("window", createPreviewWindow());
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

    const { api } = await import("./client");
    await api.requestLoginOtp("staff@example.com");
    await api.loginWithOtp({ email: "staff@example.com", otp: "654321" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/auth/email-otp/send-verification-otp",
      expect.objectContaining({ method: "POST", credentials: "include" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/auth/sign-in/email-otp",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ email: "staff@example.com", otp: "654321" }),
      })
    );
  });

  it("uses a non-conflicting route for company identity matching", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:3000");
    vi.stubGlobal("window", createPreviewWindow());
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ match: null }, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { api } = await import("./client");
    await expect(
      api.cmpCompanyIdentityMatch("COMPANY_REGISTRATION_NUMBER", "7654321")
    ).resolves.toStrictEqual({ match: null });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/cmp/clients/identity/company-match?identifierType=COMPANY_REGISTRATION_NUMBER&identifierValue=7654321",
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("loads a billing artifact as an authenticated Blob without downloading it", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:3000");
    vi.stubGlobal("window", createPreviewWindow());
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("payment proof", {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": "attachment; filename=payment-proof.png",
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { api } = await import("./client");
    const blob = await api.loadCmpBillingArtifact("artifact-1");

    await expect(blob.text()).resolves.toBe("payment proof");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/cmp/billing/artifacts/artifact-1/download",
      { credentials: "include" }
    );
  });
});

function createPreviewWindow() {
  const values = new Map<string, string>();
  return {
    location: { hostname: "localhost" },
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  };
}
