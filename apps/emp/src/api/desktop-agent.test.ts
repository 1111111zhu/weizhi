import { beforeEach, describe, expect, it, vi } from "vitest";
// @vitest-environment happy-dom

import * as desktopAgentApi from "./desktop-agent";
import {
  DesktopAgentClientError,
  checkInDesktopAgentSession,
  getDesktopAgentCacheSettings,
  listDesktopAgentSessions,
  openAttachmentInDesktopAgent,
  pairDesktopAgentWithBetterAuth,
  printConfirmationDocuments,
  releaseDesktopAgentSession,
  updateDesktopAgentCacheSettings,
} from "./desktop-agent";

describe("desktop agent client", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_DESKTOP_AGENT_MINIMUM_VERSION", "0.1.9");
  });

  it("reads real cache usage and hit metrics from the native runtime", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: true,
        cacheRoot: "D:\\ProjectWingCache",
        maxBytes: 5 * 1024 ** 3,
        usedBytes: 1024,
        entryCount: 3,
        orphanBytes: 128,
        orphanCount: 1,
        hitCount: 7,
        missCount: 2,
        bytesSaved: 4096,
        restartRequired: false,
      })
    );

    await expect(
      getDesktopAgentCacheSettings({ fetcher })
    ).resolves.toStrictEqual({
      cacheRoot: "D:\\ProjectWingCache",
      maxBytes: 5 * 1024 ** 3,
      usedBytes: 1024,
      entryCount: 3,
      orphanBytes: 128,
      orphanCount: 1,
      hitCount: 7,
      missCount: 2,
      bytesSaved: 4096,
      restartRequired: false,
    });
  });

  it("updates native cache settings through a protected mutation request", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: true,
        cacheRoot: "E:\\ProjectWingCache",
        maxBytes: 7 * 1024 ** 3,
        usedBytes: 0,
        entryCount: 0,
        orphanBytes: 0,
        orphanCount: 0,
        hitCount: 0,
        missCount: 0,
        bytesSaved: 0,
        restartRequired: true,
      })
    );

    await updateDesktopAgentCacheSettings(
      {
        cacheRoot: "E:\\ProjectWingCache",
        maxBytes: 7 * 1024 ** 3,
      },
      { fetcher }
    );

    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:17862/cache/settings",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Project-Wing-Agent": "1",
        },
        body: JSON.stringify({
          cacheRoot: "E:\\ProjectWingCache",
          maxBytes: 7 * 1024 ** 3,
        }),
      })
    );
  });

  it("pairs the Desktop Agent through Better Auth without storing a browser token", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          device_code: "device-code",
          user_code: "ABCD1234",
          expires_in: 1800,
          interval: 5,
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ ok: true, authenticated: false, pairing: true })
      )
      .mockResolvedValueOnce(
        jsonResponse({ user_code: "ABCD1234", status: "pending" })
      )
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(
        jsonResponse({ ok: true, authenticated: true, pairing: false })
      );

    await pairDesktopAgentWithBetterAuth({
      agentBaseUrl: "http://127.0.0.1:17862",
      authBaseUrl: "https://auth.superfx.cn",
      fetcher,
    });

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "https://auth.superfx.cn/auth/device/code",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ client_id: "project-wing-desktop-agent" }),
      })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:17862/auth/pair",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          clientId: "project-wing-desktop-agent",
          deviceCode: "device-code",
          authBaseUrl: "https://auth.superfx.cn",
          expiresInSeconds: 1800,
          intervalSeconds: 5,
        }),
      })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      "https://auth.superfx.cn/auth/device?user_code=ABCD1234",
      expect.objectContaining({ method: "GET", credentials: "include" })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      4,
      "https://auth.superfx.cn/auth/device/approve",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ userCode: "ABCD1234" }),
      })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      5,
      "http://127.0.0.1:17862/auth/status",
      expect.any(Object)
    );
  });

  it("coalesces concurrent pairing requests for the same Desktop Agent", async () => {
    const fetcher = vi.fn((input: string) => {
      if (input.endsWith("/auth/device/code")) {
        return Promise.resolve(
          jsonResponse({
            device_code: "device-code",
            user_code: "ABCD1234",
            expires_in: 1800,
            interval: 5,
          })
        );
      }
      if (input.endsWith("/auth/pair")) {
        return Promise.resolve(
          jsonResponse({ ok: true, authenticated: false, pairing: true })
        );
      }
      if (input.includes("/auth/device?user_code=")) {
        return Promise.resolve(
          jsonResponse({ user_code: "ABCD1234", status: "pending" })
        );
      }
      if (input.endsWith("/auth/device/approve")) {
        return Promise.resolve(jsonResponse({ success: true }));
      }
      if (input.endsWith("/auth/status")) {
        return Promise.resolve(
          jsonResponse({ ok: true, authenticated: true, pairing: false })
        );
      }
      throw new Error(`Unexpected request: ${input}`);
    });
    const options = {
      agentBaseUrl: "http://127.0.0.1:17862",
      authBaseUrl: "https://auth.superfx.cn",
      fetcher,
    };

    await Promise.all([
      pairDesktopAgentWithBetterAuth(options),
      pairDesktopAgentWithBetterAuth(options),
    ]);

    expect(
      fetcher.mock.calls.filter(([input]) =>
        String(input).endsWith("/auth/device/code")
      )
    ).toHaveLength(1);
  });

  it("asks the paired Desktop Agent to print without forwarding a browser bearer", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: true,
        printerName: "Office Printer",
        printed: [{ id: "confirmation-1", fileName: "confirmation.pdf" }],
      })
    );

    await expect(
      printConfirmationDocuments(
        {
          printerName: "Office Printer",
          documents: [
            { confirmationId: "confirmation-1", fileName: "confirmation.pdf" },
          ],
        },
        {
          agentBaseUrl: "http://127.0.0.1:17862",
          apiBaseUrl: "https://api.superfx.cn",
          fetcher,
        }
      )
    ).resolves.toMatchObject({ ok: true });

    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:17862/print",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          printerName: "Office Printer",
          documents: [
            {
              id: "confirmation-1",
              fileName: "confirmation.pdf",
              downloadUrl:
                "https://api.superfx.cn/confirmations/print-documents/confirmation-1.pdf",
            },
          ],
        }),
      })
    );
  });

  it("pairs once and retries a file open when the local agent requires device auth", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.9",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            ok: false,
            code: "DEVICE_AUTH_REQUIRED",
            message: "Pair this Desktop Agent before opening files.",
          },
          { status: 401 }
        )
      )
      .mockResolvedValueOnce(
        jsonResponse({
          device_code: "device-code",
          user_code: "ABCD1234",
          expires_in: 1800,
          interval: 5,
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ ok: true, authenticated: false, pairing: true })
      )
      .mockResolvedValueOnce(
        jsonResponse({ user_code: "ABCD1234", status: "pending" })
      )
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(
        jsonResponse({ ok: true, authenticated: true, pairing: false })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          sessionId: "session-1",
          localPath: "C:\\ProjectWing\\cash.xlsx",
          openedAt: "2026-06-05T02:00:00.000Z",
        })
      );

    await expect(
      openAttachmentInDesktopAgent(
        {
          mode: "READ_ONLY",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
        },
        {
          agentBaseUrl: "http://127.0.0.1:17862",
          apiBaseUrl: "https://api.superfx.cn",
          authBaseUrl: "https://auth.superfx.cn",
          fetcher,
        }
      )
    ).resolves.toMatchObject({ ok: true, sessionId: "session-1" });

    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:17862/open",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      "https://auth.superfx.cn/auth/device/code",
      expect.objectContaining({ credentials: "include" })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      8,
      "http://127.0.0.1:17862/open",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("sends scoped master session details to the available agent", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.9",
          diagnostics: {
            excel: {
              status: "OK",
              installed: true,
              checkedAt: "2026-06-15T12:00:00.000Z",
              comAutomation: "AVAILABLE",
              hiddenAutomationProcessCount: 0,
            },
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          sessionId: "session-1",
          localPath: "C:\\ProjectWing\\cash.xlsx",
          openedAt: "2026-06-05T02:00:00.000Z",
        })
      );
    const result = await openAttachmentInDesktopAgent(
      {
        mode: "MASTER",
        projectId: "project-1",
        attachmentId: "attachment-1",
        fileName: "cash.xlsx",
        requestId: "request-scoped-master",
        downloadUrl:
          "http://localhost:3000/engagement/project-1/workflow/attachments/attachment-1/download",
        lockSessionId: "lock-session-1",
        baseVersion: 2,
        grantSecret: "grant-secret",
      },
      {
        agentBaseUrl: "http://127.0.0.1:17862",
        apiBaseUrl: "http://localhost:3000",
        fetcher,
      }
    );

    expect(result).toStrictEqual(
      expect.objectContaining({ ok: true, sessionId: "session-1" })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:17862/open",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
          requestId: "request-scoped-master",
          downloadUrl:
            "http://localhost:3000/engagement/project-1/workflow/attachments/attachment-1/download",
          lockSessionId: "lock-session-1",
          baseVersion: 2,
          grantSecret: "grant-secret",
          checkInUrl:
            "http://localhost:3000/desktop/master-sessions/lock-session-1/check-in",
          releaseUrl:
            "http://localhost:3000/desktop/master-sessions/lock-session-1/release",
        }),
      })
    );
  });

  it("distinguishes a missing local open route from a missing remote file", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.3.0",
          diagnostics: {},
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { ok: false, code: "NOT_FOUND", message: "Route not found." },
          { status: 404 }
        )
      );

    await expect(
      openAttachmentInDesktopAgent(
        {
          mode: "READ_ONLY",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
        },
        { agentBaseUrl: "http://127.0.0.1:17862", fetcher }
      )
    ).rejects.toMatchObject({ code: "DESKTOP_AGENT_ROUTE_NOT_FOUND" });
  });

  it("blocks Master below the minimum version in the release manifest", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        app: "project-wing-desktop-agent",
        version: "0.2.0",
        diagnostics: {
          excel: {
            status: "OK",
            installed: true,
            checkedAt: "2026-07-27T12:00:00.000Z",
            comAutomation: "AVAILABLE",
            hiddenAutomationProcessCount: 0,
          },
        },
      })
    );

    await expect(
      openAttachmentInDesktopAgent(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
        },
        {
          agentBaseUrl: "http://127.0.0.1:17862",
          fetcher,
          releaseManifest: {
            version: "0.2.2",
            platform: "windows",
            architecture: "x64",
            downloadUrl:
              "https://emp.wzcpa.hk/api/downloads/desktop-agent/windows/releases/0.2.2",
            sha256: "a".repeat(64),
            fileSize: 123_456,
            publishedAt: "2026-07-27T12:00:00.000Z",
            minimumSupportedVersion: "0.2.1",
            minimumSelfUpdateVersion: "0.1.10",
            signaturePolicy: "required",
          },
        }
      )
    ).resolves.toBeNull();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("normalizes custom zip entry URLs before opening the agent", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.9",
          diagnostics: {
            excel: {
              status: "OK",
              installed: true,
              checkedAt: "2026-06-15T12:00:00.000Z",
              comAutomation: "AVAILABLE",
              hiddenAutomationProcessCount: 0,
            },
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          sessionId: "session-zip-entry-1",
          localPath: "C:\\ProjectWing\\support.xlsx",
          openedAt: "2026-06-05T02:00:00.000Z",
        })
      );

    await openAttachmentInDesktopAgent(
      {
        mode: "MASTER",
        projectId: "project-1",
        attachmentId: "archive-1",
        fileName: "support.xlsx",
        requestId: "request-zip-entry",
        downloadUrl:
          "http://api:3000/engagement/project-1/workflow/zip-master-sessions/zip-session-1/entries/download?path=docs%2Fsupport.xlsx",
        heartbeatUrl:
          "http://api:3000/desktop/zip-entry-master-sessions/entry-lock-1/heartbeat",
        checkInUrl:
          "http://api:3000/desktop/zip-entry-master-sessions/entry-lock-1/check-in",
        releaseUrl:
          "http://api:3000/desktop/zip-entry-master-sessions/entry-lock-1/release",
        lockSessionId: "entry-lock-1",
        baseVersion: 3,
        grantSecret: "entry-grant-secret",
        contentToken: "zip-entry-hash-1",
        contentHash: "zip-entry-hash-1",
      },
      {
        agentBaseUrl: "http://127.0.0.1:17862",
        apiBaseUrl: "http://localhost:3000",
        fetcher,
      }
    );

    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:17862/open",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "archive-1",
          fileName: "support.xlsx",
          requestId: "request-zip-entry",
          downloadUrl:
            "http://localhost:3000/engagement/project-1/workflow/zip-master-sessions/zip-session-1/entries/download?path=docs%2Fsupport.xlsx",
          heartbeatUrl:
            "http://localhost:3000/desktop/zip-entry-master-sessions/entry-lock-1/heartbeat",
          checkInUrl:
            "http://localhost:3000/desktop/zip-entry-master-sessions/entry-lock-1/check-in",
          releaseUrl:
            "http://localhost:3000/desktop/zip-entry-master-sessions/entry-lock-1/release",
          lockSessionId: "entry-lock-1",
          baseVersion: 3,
          grantSecret: "entry-grant-secret",
          contentToken: "zip-entry-hash-1",
          contentHash: "zip-entry-hash-1",
        }),
      })
    );
  });

  it("requires trusted release metadata before self-update", async () => {
    const fetcher = vi.fn();
    await expect(
      desktopAgentApi.updateDesktopAgent({
        agentBaseUrl: "http://127.0.0.1:17862",
        fetcher,
      })
    ).rejects.toMatchObject({
      code: "DESKTOP_AGENT_MANIFEST_UNAVAILABLE",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("passes release integrity metadata to the local updater", async () => {
    const releaseManifest = {
      version: "0.2.1",
      platform: "windows",
      architecture: "x64",
      downloadUrl:
        "https://emp.wzcpa.hk/api/downloads/desktop-agent/windows/releases/0.2.1",
      sha256: "a".repeat(64),
      fileSize: 123_456,
      publishedAt: "2026-07-27T12:00:00.000Z",
      minimumSupportedVersion: "0.2.0",
      minimumSelfUpdateVersion: "0.1.10",
      signaturePolicy: "optional",
    } as const;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: "STARTED" }));

    await desktopAgentApi.updateDesktopAgent({
      agentBaseUrl: "http://127.0.0.1:17862",
      fetcher,
      releaseManifest,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:17862/update",
      expect.objectContaining({
        body: JSON.stringify({
          expectedVersion: "0.2.1",
          expectedSha256: "a".repeat(64),
          expectedFileSize: 123_456,
          downloadUrl:
            "https://emp.wzcpa.hk/api/downloads/desktop-agent/windows/releases/0.2.1",
          signaturePolicy: "optional",
        }),
      })
    );
  });

  it("reuses the validated release manifest for the browser session", async () => {
    const releaseManifest = {
      version: "0.2.1",
      platform: "windows",
      architecture: "x64",
      downloadUrl:
        "https://emp.wzcpa.hk/api/downloads/desktop-agent/windows/releases/0.2.1",
      sha256: "a".repeat(64),
      fileSize: 123_456,
      publishedAt: "2026-07-27T12:00:00.000Z",
      minimumSupportedVersion: "0.2.0",
      minimumSelfUpdateVersion: "0.1.10",
      signaturePolicy: "optional",
    } as const;
    sessionStorage.setItem(
      "project-wing-desktop-agent-release-manifest",
      JSON.stringify(releaseManifest)
    );
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);

    await expect(
      desktopAgentApi.getDesktopAgentReleaseManifest()
    ).resolves.toStrictEqual(releaseManifest);
    expect(fetcher).not.toHaveBeenCalled();

    desktopAgentApi.clearDesktopAgentReleaseManifestCache();
    fetcher.mockResolvedValueOnce(jsonResponse(releaseManifest));
    await expect(
      desktopAgentApi.getDesktopAgentReleaseManifest()
    ).resolves.toStrictEqual(releaseManifest);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("reads desktop agent update status", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        status: "VERIFYING_HEALTH",
        taskId: "task-1",
        expectedVersion: "0.1.19",
        currentVersion: "0.1.18",
      })
    );

    await expect(
      desktopAgentApi.getDesktopAgentUpdateStatus({
        agentBaseUrl: "http://127.0.0.1:17862",
        fetcher,
      })
    ).resolves.toMatchObject({
      status: "VERIFYING_HEALTH",
      expectedVersion: "0.1.19",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:17862/update/status"
    );
  });

  it("returns null when update status is unsupported", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          ok: false,
          code: "NOT_FOUND",
          message: "Endpoint not found.",
        },
        { status: 404 }
      )
    );

    await expect(
      desktopAgentApi.getDesktopAgentUpdateStatus({
        agentBaseUrl: "http://127.0.0.1:17862",
        fetcher,
      })
    ).resolves.toBeNull();
  });

  it("reports unsupported self-update when an older agent has no update endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          ok: false,
          code: "NOT_FOUND",
          message: "Endpoint not found.",
        },
        { status: 404 }
      )
    );

    await expect(
      desktopAgentApi.updateDesktopAgent({
        agentBaseUrl: "http://127.0.0.1:17862",
        fetcher,
        releaseManifest: {
          version: "0.2.1",
          platform: "windows",
          architecture: "x64",
          downloadUrl:
            "https://emp.wzcpa.hk/api/downloads/desktop-agent/windows/releases/0.2.1",
          sha256: "a".repeat(64),
          fileSize: 123_456,
          publishedAt: "2026-07-27T12:00:00.000Z",
          minimumSupportedVersion: "0.2.0",
          minimumSelfUpdateVersion: "0.1.10",
          signaturePolicy: "optional",
        },
      })
    ).rejects.toMatchObject({
      code: "DESKTOP_AGENT_UPDATE_UNSUPPORTED",
      message: "This Desktop Agent version does not support self-update.",
    });
  });

  it("reports whether the detected desktop agent can self-update", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.9",
          diagnostics: {
            excel: {
              status: "NEEDS_ATTENTION",
              checkedAt: "2026-06-15T12:00:00.000Z",
              comAutomation: "UNAVAILABLE",
              hiddenAutomationProcessCount: 2,
              hiddenAutomationProcessIds: [1234, 5678],
              hresult: -2_146_233_087,
              message: "Excel COM automation is unavailable.",
              recommendedAction:
                "Close hidden Excel automation processes or repair Office.",
            },
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.10",
        })
      );

    await expect(
      desktopAgentApi.getDesktopAgentStatus({
        agentBaseUrl: "http://127.0.0.1:17862",
        fetcher,
      })
    ).resolves.toStrictEqual({
      health: {
        ok: true,
        app: "project-wing-desktop-agent",
        version: "0.1.9",
        diagnostics: {
          excel: {
            status: "NEEDS_ATTENTION",
            checkedAt: "2026-06-15T12:00:00.000Z",
            comAutomation: "UNAVAILABLE",
            hiddenAutomationProcessCount: 2,
            hiddenAutomationProcessIds: [1234, 5678],
            hresult: -2_146_233_087,
            message: "Excel COM automation is unavailable.",
            recommendedAction:
              "Close hidden Excel automation processes or repair Office.",
          },
        },
      },
      isInstalled: true,
      isSupported: true,
      supportsSelfUpdate: false,
    });
    await expect(
      desktopAgentApi.getDesktopAgentStatus({
        agentBaseUrl: "http://127.0.0.1:17862",
        fetcher,
      })
    ).resolves.toMatchObject({
      isInstalled: true,
      isSupported: true,
      supportsSelfUpdate: true,
    });
  });

  it("classifies missing, malformed, invalid-version, old, legacy, and current agent health", async () => {
    const missingFetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("offline"));
    await expect(
      desktopAgentApi.getDesktopAgentStatus({
        agentBaseUrl: "http://127.0.0.1:17862",
        fetcher: missingFetcher,
      })
    ).resolves.toStrictEqual({
      health: null,
      isInstalled: false,
      isSupported: false,
      supportsSelfUpdate: false,
    });

    const malformedFetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    await expect(
      desktopAgentApi.getDesktopAgentStatus({
        agentBaseUrl: "http://127.0.0.1:17862",
        fetcher: malformedFetcher,
      })
    ).resolves.toStrictEqual({
      health: null,
      isInstalled: false,
      isSupported: false,
      supportsSelfUpdate: false,
    });

    const invalidVersionFetcher = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        app: "project-wing-desktop-agent",
        version: "dev-build",
      })
    );
    await expect(
      desktopAgentApi.getDesktopAgentStatus({
        agentBaseUrl: "http://127.0.0.1:17862",
        fetcher: invalidVersionFetcher,
      })
    ).resolves.toMatchObject({
      isInstalled: true,
      isSupported: false,
      supportsSelfUpdate: false,
    });

    const oldFetcher = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        app: "project-wing-desktop-agent",
        version: "0.1.8",
      })
    );
    await expect(
      desktopAgentApi.getDesktopAgentStatus({
        agentBaseUrl: "http://127.0.0.1:17862",
        fetcher: oldFetcher,
      })
    ).resolves.toMatchObject({
      isInstalled: true,
      isSupported: false,
      supportsSelfUpdate: false,
    });

    const legacyFetcher = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        app: "project-wing-desktop-agent",
        version: "0.1.9",
      })
    );
    await expect(
      desktopAgentApi.getDesktopAgentStatus({
        agentBaseUrl: "http://127.0.0.1:17862",
        fetcher: legacyFetcher,
      })
    ).resolves.toMatchObject({
      isInstalled: true,
      isSupported: true,
      supportsSelfUpdate: false,
    });

    const currentFetcher = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        app: "project-wing-desktop-agent",
        version: "0.1.39",
      })
    );
    await expect(
      desktopAgentApi.getDesktopAgentStatus({
        agentBaseUrl: "http://127.0.0.1:17862",
        fetcher: currentFetcher,
      })
    ).resolves.toMatchObject({
      isInstalled: true,
      isSupported: true,
      supportsSelfUpdate: true,
    });
  });

  it("retries transitional managed runtime health before treating the agent as usable", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          app: "project-wing-desktop-runtime",
          version: "0.1.11",
          managerVersion: "0.2.0",
          agentVersion: "0.1.11",
          agentState: "STARTING",
          updateState: "IDLE",
          restoreState: "READY",
          attentionCount: 0,
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          app: "project-wing-desktop-runtime",
          version: "0.1.11",
          managerVersion: "0.2.0",
          agentVersion: "0.1.11",
          agentState: "READY",
          updateState: "IDLE",
          restoreState: "READY",
          attentionCount: 0,
        })
      );

    await expect(
      desktopAgentApi.getDesktopAgentStatus({
        agentBaseUrl: "http://127.0.0.1:17862",
        fetcher,
      })
    ).resolves.toMatchObject({
      isInstalled: true,
      isSupported: true,
      supportsSelfUpdate: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not prepare or open a Master session when the managed runtime is not ready", async () => {
    const startingHealth = {
      ok: true,
      app: "project-wing-desktop-runtime",
      version: "0.1.11",
      managerVersion: "0.2.0",
      agentVersion: "0.1.11",
      agentState: "STARTING",
      updateState: "IDLE",
      restoreState: "READY",
      attentionCount: 0,
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(startingHealth))
      .mockResolvedValueOnce(jsonResponse(startingHealth))
      .mockResolvedValueOnce(jsonResponse(startingHealth));

    await expect(
      openAttachmentInDesktopAgent(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
        },
        {
          agentBaseUrl: "http://127.0.0.1:17862",
          apiBaseUrl: "http://localhost:3000",
          fetcher,
        }
      )
    ).resolves.toBeNull();

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(
      fetcher.mock.calls.some(([url]) => String(url).includes("/master/open"))
    ).toBeFalsy();
    expect(
      fetcher.mock.calls.some(
        ([url]) => String(url) === "http://127.0.0.1:17862/open"
      )
    ).toBeFalsy();
  });

  it("uses deploy-time config for minimum supported agent versions", async () => {
    vi.stubEnv("NEXT_PUBLIC_DESKTOP_AGENT_MINIMUM_VERSION", "0.1.11");
    vi.stubEnv(
      "NEXT_PUBLIC_DESKTOP_AGENT_SELF_UPDATE_MINIMUM_VERSION",
      "0.1.12"
    );
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.10",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.11",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.12",
        })
      );

    await expect(
      desktopAgentApi.getDesktopAgentStatus({
        agentBaseUrl: "http://127.0.0.1:17862",
        fetcher,
      })
    ).resolves.toMatchObject({
      isInstalled: true,
      isSupported: false,
      supportsSelfUpdate: false,
    });
    await expect(
      desktopAgentApi.getDesktopAgentStatus({
        agentBaseUrl: "http://127.0.0.1:17862",
        fetcher,
      })
    ).resolves.toMatchObject({
      isInstalled: true,
      isSupported: true,
      supportsSelfUpdate: false,
    });
    await expect(
      desktopAgentApi.getDesktopAgentStatus({
        agentBaseUrl: "http://127.0.0.1:17862",
        fetcher,
      })
    ).resolves.toMatchObject({
      isInstalled: true,
      isSupported: true,
      supportsSelfUpdate: true,
    });
  });

  it("falls back when one configured agent version is invalid", async () => {
    vi.stubEnv("NEXT_PUBLIC_DESKTOP_AGENT_MINIMUM_VERSION", "next");
    vi.stubEnv(
      "NEXT_PUBLIC_DESKTOP_AGENT_SELF_UPDATE_MINIMUM_VERSION",
      "0.1.12"
    );
    const fetcher = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        app: "project-wing-desktop-agent",
        version: "0.2.0",
      })
    );

    await expect(
      desktopAgentApi.getDesktopAgentStatus({
        agentBaseUrl: "http://127.0.0.1:17862",
        fetcher,
      })
    ).resolves.toMatchObject({
      isInstalled: true,
      isSupported: true,
      supportsSelfUpdate: true,
    });
  });

  it("prepares a scoped master session through the API after the agent is healthy", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.9",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          lockSessionId: "lock-session-1",
          grantSecret: "grant-secret",
          attachmentId: "attachment-1",
          projectId: "project-1",
          fileName: "cash.xlsx",
          version: 2,
          contentToken: "remote-version-2",
          downloadUrl:
            "http://localhost:3000/engagement/project-1/workflow/attachments/attachment-1/download",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          sessionId: "session-1",
          localPath: "C:\\ProjectWing\\cash.xlsx",
          openedAt: "2026-06-05T02:00:00.000Z",
        })
      );

    await expect(
      openAttachmentInDesktopAgent(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
          requestId: "request-prepared-master",
        },
        {
          agentBaseUrl: "http://127.0.0.1:17862",
          apiBaseUrl: "http://localhost:3000",
          fetcher,
        }
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({ sessionId: "session-1" })
    );

    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/engagement/project-1/workflow/attachments/attachment-1/master/open",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      "http://127.0.0.1:17862/open",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
          requestId: "request-prepared-master",
          downloadUrl:
            "http://localhost:3000/engagement/project-1/workflow/attachments/attachment-1/download",
          checkInUrl:
            "http://localhost:3000/desktop/master-sessions/lock-session-1/check-in",
          releaseUrl:
            "http://localhost:3000/desktop/master-sessions/lock-session-1/release",
          lockSessionId: "lock-session-1",
          baseVersion: 2,
          grantSecret: "grant-secret",
          contentToken: "remote-version-2",
        }),
      })
    );
  });

  it("rebases an internal Master download URL onto the configured public API", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.46",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          lockSessionId: "lock-session-1",
          grantSecret: "grant-secret",
          attachmentId: "attachment-1",
          projectId: "project-1",
          fileName: "cash.xlsx",
          version: 2,
          downloadUrl:
            "http://api:3000/engagement/project-1/workflow/attachments/attachment-1/master/download",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          sessionId: "session-1",
          localPath: "C:\\ProjectWing\\cash.xlsx",
          openedAt: "2026-07-21T12:00:00.000Z",
        })
      );

    await openAttachmentInDesktopAgent(
      {
        mode: "MASTER",
        projectId: "project-1",
        attachmentId: "attachment-1",
        fileName: "cash.xlsx",
      },
      {
        agentBaseUrl: "http://127.0.0.1:17862",
        apiBaseUrl: "https://emp.superfx.cn/api",
        fetcher,
      }
    );

    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      "http://127.0.0.1:17862/open",
      expect.objectContaining({
        body: expect.stringContaining(
          '"downloadUrl":"https://emp.superfx.cn/api/engagement/project-1/workflow/attachments/attachment-1/master/download"'
        ),
      })
    );
  });

  it("does not prepare a Master lock when the agent reports Excel is missing", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        app: "project-wing-desktop-agent",
        version: "0.1.11",
        diagnostics: {
          excel: {
            status: "MISSING",
            installed: false,
            checkedAt: "2026-06-15T12:00:00.000Z",
            comAutomation: "UNAVAILABLE",
            hiddenAutomationProcessCount: 0,
            message: "Microsoft Excel is not installed or registered.",
            recommendedAction:
              "Install Microsoft Excel, then restart Desktop Agent.",
          },
        },
      })
    );

    await expect(
      openAttachmentInDesktopAgent(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
        },
        {
          agentBaseUrl: "http://127.0.0.1:17862",
          apiBaseUrl: "http://localhost:3000",
          fetcher,
        }
      )
    ).resolves.toBeNull();

    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:17862/health",
      expect.any(Object)
    );
    expect(
      fetcher.mock.calls.some(([url]) => String(url).includes("/master/open"))
    ).toBeFalsy();
  });

  it("does not prepare a Master lock when the agent reports Word is missing", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        app: "project-wing-desktop-agent",
        version: "0.1.11",
        diagnostics: {
          word: {
            status: "MISSING",
            installed: false,
            checkedAt: "2026-06-15T12:00:00.000Z",
            comAutomation: "UNAVAILABLE",
            hiddenAutomationProcessCount: 0,
            message: "Microsoft Word is not installed or registered.",
            recommendedAction:
              "Install Microsoft Word, then restart Desktop Agent.",
          },
        },
      })
    );

    await expect(
      openAttachmentInDesktopAgent(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-word",
          fileName: "planning-memo.docx",
        },
        {
          agentBaseUrl: "http://127.0.0.1:17862",
          apiBaseUrl: "http://localhost:3000",
          fetcher,
        }
      )
    ).resolves.toBeNull();

    expect(fetcher).toHaveBeenCalledOnce();
    expect(
      fetcher.mock.calls.some(([url]) => String(url).includes("/master/open"))
    ).toBeFalsy();
  });

  it("does not prepare a Master lock when the agent reports PowerPoint is missing", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        app: "project-wing-desktop-agent",
        version: "0.1.11",
        diagnostics: {
          powerPoint: {
            status: "MISSING",
            installed: false,
            checkedAt: "2026-06-15T12:00:00.000Z",
            comAutomation: "UNAVAILABLE",
            hiddenAutomationProcessCount: 0,
            message: "Microsoft PowerPoint is not installed or registered.",
            recommendedAction:
              "Install Microsoft PowerPoint, then restart Desktop Agent.",
          },
        },
      })
    );

    await expect(
      openAttachmentInDesktopAgent(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-pptx",
          fileName: "board-deck.pptx",
        },
        {
          agentBaseUrl: "http://127.0.0.1:17862",
          apiBaseUrl: "http://localhost:3000",
          fetcher,
        }
      )
    ).resolves.toBeNull();

    expect(fetcher).toHaveBeenCalledOnce();
    expect(
      fetcher.mock.calls.some(([url]) => String(url).includes("/master/open"))
    ).toBeFalsy();
  });

  it("does not prepare a Master lock when the agent reports no supported PDF editor", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        app: "project-wing-desktop-agent",
        version: "0.1.11",
        diagnostics: {
          pdfEditor: {
            status: "MISSING",
            installed: false,
            trustedEditor: false,
            checkedAt: "2026-06-15T12:00:00.000Z",
            message: "A supported PDF editor is not installed or configured.",
            recommendedAction:
              "Install Adobe Acrobat, PDF-XChange Editor, or PDF Master Editor, then restart Desktop Agent.",
          },
        },
      })
    );

    await expect(
      openAttachmentInDesktopAgent(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-pdf",
          fileName: "support.pdf",
        },
        {
          agentBaseUrl: "http://127.0.0.1:17862",
          apiBaseUrl: "http://localhost:3000",
          fetcher,
        }
      )
    ).resolves.toBeNull();

    expect(fetcher).toHaveBeenCalledOnce();
    expect(
      fetcher.mock.calls.some(([url]) => String(url).includes("/master/open"))
    ).toBeFalsy();
  });

  it("opens Word Master files when lightweight health has no diagnostics", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.11",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          lockSessionId: "lock-session-word",
          grantSecret: "grant-secret-word",
          attachmentId: "attachment-word",
          projectId: "project-1",
          fileName: "planning-memo.docx",
          version: 3,
          downloadUrl:
            "http://localhost:3000/engagement/project-1/workflow/attachments/attachment-word/master/download",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          sessionId: "session-word",
          localPath: "C:\\ProjectWing\\planning-memo.docx",
          openedAt: "2026-06-05T02:00:00.000Z",
        })
      );

    await expect(
      openAttachmentInDesktopAgent(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-word",
          fileName: "planning-memo.docx",
        },
        {
          agentBaseUrl: "http://127.0.0.1:17862",
          apiBaseUrl: "http://localhost:3000",
          fetcher,
        }
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({ sessionId: "session-word" })
    );

    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/engagement/project-1/workflow/attachments/attachment-word/master/open",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      "http://127.0.0.1:17862/open",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("opens PowerPoint Master files when lightweight health has no diagnostics", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.11",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          lockSessionId: "lock-session-pptx",
          grantSecret: "grant-secret-pptx",
          attachmentId: "attachment-pptx",
          projectId: "project-1",
          fileName: "board-deck.pptx",
          version: 4,
          downloadUrl:
            "http://localhost:3000/engagement/project-1/workflow/attachments/attachment-pptx/master/download",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          sessionId: "session-pptx",
          localPath: "C:\\ProjectWing\\board-deck.pptx",
          openedAt: "2026-06-05T02:00:00.000Z",
        })
      );

    await expect(
      openAttachmentInDesktopAgent(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-pptx",
          fileName: "board-deck.pptx",
        },
        {
          agentBaseUrl: "http://127.0.0.1:17862",
          apiBaseUrl: "http://localhost:3000",
          fetcher,
        }
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({ sessionId: "session-pptx" })
    );

    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/engagement/project-1/workflow/attachments/attachment-pptx/master/open",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      "http://127.0.0.1:17862/open",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("recovers an existing Master session when the API reports the current user is already Master", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.9",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: false,
          code: "ALREADY_MASTER",
          attachmentId: "attachment-1",
          lockSessionId: "lock-session-1",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          lockSessionId: "lock-session-1",
          grantSecret: "grant-secret-recovered",
          attachmentId: "attachment-1",
          projectId: "project-1",
          fileName: "cash.xlsx",
          version: 2,
          downloadUrl:
            "http://localhost:3000/engagement/project-1/workflow/attachments/attachment-1/master/download",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          sessionId: "session-1",
          localPath: "C:\\ProjectWing\\cash.xlsx",
          openedAt: "2026-06-05T02:00:00.000Z",
        })
      );

    await expect(
      openAttachmentInDesktopAgent(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
          requestId: "request-recovered-master",
        },
        {
          agentBaseUrl: "http://127.0.0.1:17862",
          apiBaseUrl: "http://localhost:3000",
          fetcher,
        }
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({ sessionId: "session-1" })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      "http://localhost:3000/engagement/project-1/workflow/attachments/attachment-1/master/recover",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      4,
      "http://127.0.0.1:17862/open",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
          requestId: "request-recovered-master",
          downloadUrl:
            "http://localhost:3000/engagement/project-1/workflow/attachments/attachment-1/master/download",
          checkInUrl:
            "http://localhost:3000/desktop/master-sessions/lock-session-1/check-in",
          releaseUrl:
            "http://localhost:3000/desktop/master-sessions/lock-session-1/release",
          lockSessionId: "lock-session-1",
          baseVersion: 2,
          grantSecret: "grant-secret-recovered",
        }),
      })
    );
  });

  it("does not call the local agent when the backend reports another Master holder", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.11",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: false,
          code: "LOCKED_BY_OTHER",
          holderName: "项目经理",
        })
      );

    await expect(
      openAttachmentInDesktopAgent(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
        },
        {
          agentBaseUrl: "http://127.0.0.1:17862",
          apiBaseUrl: "http://localhost:3000",
          fetcher,
        }
      )
    ).rejects.toStrictEqual(
      new DesktopAgentClientError("LOCKED_BY_OTHER", "项目经理 is the Master.")
    );

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(
      fetcher.mock.calls.some(
        ([url]) => String(url) === "http://127.0.0.1:17862/open"
      )
    ).toBeFalsy();
  });

  it("returns null when the agent health probe cannot connect", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError("offline"));

    await expect(
      openAttachmentInDesktopAgent(
        {
          mode: "READ_ONLY",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
        },
        {
          agentBaseUrl: "http://127.0.0.1:17862",
          apiBaseUrl: "http://localhost:3000",
          fetcher,
        }
      )
    ).resolves.toBeNull();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("returns null and does not open when the agent version is too old", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        app: "project-wing-desktop-agent",
        version: "0.1.0",
      })
    );

    await expect(
      openAttachmentInDesktopAgent(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
          downloadUrl:
            "http://localhost:3000/engagement/project-1/workflow/attachments/attachment-1/download",
          lockSessionId: "lock-session-1",
          baseVersion: 2,
          grantSecret: "grant-secret",
        },
        {
          agentBaseUrl: "http://127.0.0.1:17862",
          apiBaseUrl: "http://localhost:3000",
          fetcher,
        }
      )
    ).resolves.toBeNull();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("skips the desktop agent in mock api mode", async () => {
    const fetcher = vi.fn();

    await expect(
      openAttachmentInDesktopAgent(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
        },
        {
          agentBaseUrl: "http://127.0.0.1:17862",
          apiBaseUrl: "http://localhost:3000",
          apiMode: "mock",
          fetcher,
        }
      )
    ).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("throws structured errors when an available agent cannot open the file", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.9",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            ok: false,
            code: "DOWNLOAD_FAILED",
            message: "Could not download the selected file.",
          },
          { status: 502 }
        )
      );

    await expect(
      openAttachmentInDesktopAgent(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
        },
        {
          agentBaseUrl: "http://127.0.0.1:17862",
          apiBaseUrl: "http://localhost:3000",
          fetcher,
        }
      )
    ).rejects.toStrictEqual(
      new DesktopAgentClientError(
        "DOWNLOAD_FAILED",
        "Could not download the selected file."
      )
    );
  });

  it("releases a prepared Master session when the agent cannot open it", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.9",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          lockSessionId: "lock-session-1",
          grantSecret: "grant-secret",
          attachmentId: "attachment-1",
          projectId: "project-1",
          fileName: "cash.xlsx",
          version: 2,
          downloadUrl:
            "http://localhost:3000/engagement/project-1/workflow/attachments/attachment-1/master/download",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            ok: false,
            code: "DOWNLOAD_FAILED",
            message: "Could not download the selected file.",
          },
          { status: 502 }
        )
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await expect(
      openAttachmentInDesktopAgent(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
        },
        {
          agentBaseUrl: "http://127.0.0.1:17862",
          apiBaseUrl: "http://localhost:3000",
          fetcher,
        }
      )
    ).rejects.toStrictEqual(
      new DesktopAgentClientError(
        "DOWNLOAD_FAILED",
        "Could not download the selected file."
      )
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      4,
      "http://localhost:3000/desktop/master-sessions/lock-session-1/release",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "project-1",
          attachmentId: "attachment-1",
          grantSecret: "grant-secret",
          reason: "UNCHANGED_RELEASE",
        }),
      })
    );
  });

  it("times out a hanging local open request and releases the prepared Master session", async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({
            ok: true,
            app: "project-wing-desktop-agent",
            version: "0.1.9",
          })
        )
        .mockResolvedValueOnce(
          jsonResponse({
            ok: true,
            lockSessionId: "lock-session-1",
            grantSecret: "grant-secret",
            attachmentId: "attachment-1",
            projectId: "project-1",
            fileName: "cash.xlsx",
            version: 2,
            downloadUrl:
              "http://localhost:3000/engagement/project-1/workflow/attachments/attachment-1/master/download",
          })
        )
        .mockImplementationOnce(
          (_url: string, init?: RequestInit) =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () => {
                reject(new DOMException("Aborted", "AbortError"));
              });
            })
        )
        .mockResolvedValueOnce(jsonResponse({ ok: true }));
      const result = openAttachmentInDesktopAgent(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
        },
        {
          agentBaseUrl: "http://127.0.0.1:17862",
          apiBaseUrl: "http://localhost:3000",
          fetcher,
          requestTimeoutMs: 25,
        }
      );
      const rejection = result.catch((error) => error);

      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(25);

      await expect(rejection).resolves.toStrictEqual(
        new DesktopAgentClientError(
          "DESKTOP_AGENT_REQUEST_TIMEOUT",
          "Desktop Agent request timed out."
        )
      );
      expect(fetcher).toHaveBeenNthCalledWith(
        4,
        "http://localhost:3000/desktop/master-sessions/lock-session-1/release",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: "project-1",
            attachmentId: "attachment-1",
            grantSecret: "grant-secret",
            reason: "UNCHANGED_RELEASE",
          }),
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the default local open timeout long enough for large Master transfers", async () => {
    vi.useFakeTimers();
    try {
      let openSignal: AbortSignal | undefined;
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({
            ok: true,
            app: "project-wing-desktop-agent",
            version: "0.1.9",
          })
        )
        .mockImplementationOnce((_url: string, init?: RequestInit) => {
          openSignal = init?.signal ?? undefined;
          return new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          });
        });
      const result = openAttachmentInDesktopAgent(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "archive-1",
          fileName: "report.pdf",
          downloadUrl:
            "/engagement/project-1/workflow/zip-master-sessions/zip-session-1/entries/download?path=report.pdf",
          checkInUrl:
            "/desktop/zip-entry-master-sessions/zip-entry-lock-1/check-in",
          releaseUrl:
            "/desktop/zip-entry-master-sessions/zip-entry-lock-1/release",
          lockSessionId: "zip-entry-lock-1",
          baseVersion: 3,
          grantSecret: "entry-grant-secret",
        },
        {
          agentBaseUrl: "http://127.0.0.1:17862",
          apiBaseUrl: "http://localhost:3000",
          fetcher,
        }
      );

      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(15_000);
      expect(openSignal?.aborted).toBeFalsy();

      const rejection = result.catch((error) => error);
      await vi.advanceTimersByTimeAsync(2_085_000);
      await expect(rejection).resolves.toStrictEqual(
        new DesktopAgentClientError(
          "DESKTOP_AGENT_REQUEST_TIMEOUT",
          "Desktop Agent request timed out."
        )
      );
      expect(openSignal?.aborted).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not release a recovered Master session when the local agent cannot open it", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.9",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: false,
          code: "ALREADY_MASTER",
          attachmentId: "attachment-1",
          lockSessionId: "lock-session-1",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          lockSessionId: "lock-session-1",
          grantSecret: "grant-secret-recovered",
          attachmentId: "attachment-1",
          projectId: "project-1",
          fileName: "cash.xlsx",
          version: 2,
          downloadUrl:
            "http://localhost:3000/engagement/project-1/workflow/attachments/attachment-1/master/download",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            ok: false,
            code: "SESSION_ALREADY_OPEN",
            message: "This Master file is already being tracked locally.",
          },
          { status: 409 }
        )
      );

    await expect(
      openAttachmentInDesktopAgent(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
        },
        {
          agentBaseUrl: "http://127.0.0.1:17862",
          apiBaseUrl: "http://localhost:3000",
          fetcher,
        }
      )
    ).rejects.toStrictEqual(
      new DesktopAgentClientError(
        "SESSION_ALREADY_OPEN",
        "This Master file is already being tracked locally."
      )
    );
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(
      fetcher.mock.calls.some(([url]) => String(url).includes("/release"))
    ).toBeFalsy();
  });

  it("lists desktop agent tracking sessions when the agent is available", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.9",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          sessions: [
            {
              sessionId: "session-1",
              mode: "MASTER",
              projectId: "project-1",
              attachmentId: "attachment-1",
              fileName: "cash.xlsx",
              localPath: "C:\\ProjectWing\\cash.xlsx",
              originalHash: "hash-1",
              lastKnownHash: "hash-2",
              status: "DIRTY_PENDING_CHECKIN",
              lifecycleState: "OPEN",
              contentState: "DIRTY",
              openedAt: "2026-06-05T02:00:00.000Z",
              launchStartedAt: "2026-06-05T02:00:00.000Z",
              lastSeenAt: "2026-06-05T02:05:00.000Z",
            },
          ],
        })
      );

    await expect(
      listDesktopAgentSessions({
        agentBaseUrl: "http://127.0.0.1:17862",
        apiMode: "live",
        fetcher,
      })
    ).resolves.toStrictEqual([
      expect.objectContaining({
        attachmentId: "attachment-1",
        status: "DIRTY_PENDING_CHECKIN",
      }),
    ]);
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:17862/sessions"
    );
  });

  it("sends check-in requests with a one-time upload URL and bearer token", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.9",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          session: {
            sessionId: "session-1",
            lockSessionId: "lock-session-1",
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-1",
            fileName: "cash.xlsx",
            localPath: "C:\\ProjectWing\\cash.xlsx",
            baseVersion: 2,
            originalHash: "hash-2",
            lastKnownHash: "hash-2",
            grantSecret: "grant-secret",
            status: "CLOSED",
            lifecycleState: "CLOSED",
            contentState: "UNCHANGED",
            openedAt: "2026-06-05T02:00:00.000Z",
            launchStartedAt: "2026-06-05T02:00:00.000Z",
            lastSeenAt: "2026-06-05T02:10:00.000Z",
            retryCount: 0,
          },
        })
      );

    await expect(
      checkInDesktopAgentSession(
        {
          sessionId: "session-1",
          lockSessionId: "lock-session-1",
          projectId: "project-1",
          attachmentId: "attachment-1",
        },
        {
          agentBaseUrl: "http://127.0.0.1:17862",
          apiBaseUrl: "http://localhost:3000",
          apiMode: "live",
          fetcher,
        }
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({
        sessionId: "session-1",
        status: "CLOSED",
      })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:17862/sessions/session-1/check-in",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          checkInUrl:
            "http://localhost:3000/desktop/master-sessions/lock-session-1/check-in",
          releaseUrl:
            "http://localhost:3000/desktop/master-sessions/lock-session-1/release",
        }),
      })
    );
  });

  it("preserves custom session callbacks for manual check-in", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.9",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          session: {
            sessionId: "session-entry-1",
            lockSessionId: "zip-entry-lock-1",
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "archive-1",
            fileName: "support.xlsx",
            localPath: "C:\\ProjectWing\\support.xlsx",
            baseVersion: 3,
            checkInUrl:
              "http://localhost:3000/desktop/zip-entry-master-sessions/zip-entry-lock-1/check-in",
            releaseUrl:
              "http://localhost:3000/desktop/zip-entry-master-sessions/zip-entry-lock-1/release",
            originalHash: "hash-2",
            lastKnownHash: "hash-2",
            grantSecret: "entry-grant-secret",
            status: "CLOSED",
            lifecycleState: "CLOSED",
            contentState: "UNCHANGED",
            openedAt: "2026-06-05T02:00:00.000Z",
            launchStartedAt: "2026-06-05T02:00:00.000Z",
            lastSeenAt: "2026-06-05T02:10:00.000Z",
            retryCount: 0,
          },
        })
      );

    await checkInDesktopAgentSession(
      {
        sessionId: "session-entry-1",
        lockSessionId: "zip-entry-lock-1",
        projectId: "project-1",
        attachmentId: "archive-1",
        checkInUrl:
          "/desktop/zip-entry-master-sessions/zip-entry-lock-1/check-in",
        releaseUrl:
          "/desktop/zip-entry-master-sessions/zip-entry-lock-1/release",
      },
      {
        agentBaseUrl: "http://127.0.0.1:17862",
        apiBaseUrl: "http://localhost:3000",
        apiMode: "live",
        fetcher,
      }
    );

    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:17862/sessions/session-entry-1/check-in",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          checkInUrl:
            "http://localhost:3000/desktop/zip-entry-master-sessions/zip-entry-lock-1/check-in",
          releaseUrl:
            "http://localhost:3000/desktop/zip-entry-master-sessions/zip-entry-lock-1/release",
        }),
      })
    );
  });

  it("sends manual release requests to the local agent without check-in", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.9",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          session: {
            sessionId: "session-1",
            lockSessionId: "lock-session-1",
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-1",
            fileName: "cash.xlsx",
            localPath: "C:\\ProjectWing\\cash.xlsx",
            baseVersion: 2,
            originalHash: "hash-2",
            lastKnownHash: "hash-2",
            grantSecret: "grant-secret",
            status: "CLOSED",
            lifecycleState: "CLOSED",
            contentState: "DIRTY",
            openedAt: "2026-06-05T02:00:00.000Z",
            launchStartedAt: "2026-06-05T02:00:00.000Z",
            lastSeenAt: "2026-06-05T02:10:00.000Z",
            retryCount: 0,
          },
        })
      );

    await expect(
      releaseDesktopAgentSession(
        {
          sessionId: "session-1",
          lockSessionId: "lock-session-1",
          projectId: "project-1",
          attachmentId: "attachment-1",
        },
        {
          agentBaseUrl: "http://127.0.0.1:17862",
          apiBaseUrl: "http://localhost:3000",
          apiMode: "live",
          fetcher,
        }
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({
        sessionId: "session-1",
        status: "CLOSED",
      })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:17862/sessions/session-1/release",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          releaseUrl:
            "http://localhost:3000/desktop/master-sessions/lock-session-1/release",
        }),
      })
    );
  });

  it("coalesces duplicate in-flight opens for the same attachment", async () => {
    let finishOpen!: (response: Response) => void;
    const openResponse = new Promise<Response>((resolve) => {
      finishOpen = resolve;
    });
    const fetcher = vi.fn((input: string) =>
      input.endsWith("/health")
        ? Promise.resolve(
            jsonResponse({
              ok: true,
              app: "project-wing-desktop-agent",
              version: "0.1.9",
            })
          )
        : openResponse
    );
    const input = {
      mode: "READ_ONLY" as const,
      projectId: "project-coalesced",
      attachmentId: "attachment-coalesced",
      fileName: "coalesced.xlsx",
    };
    const options = {
      agentBaseUrl: "http://127.0.0.1:17862",
      apiBaseUrl: "http://localhost:3000",
      apiMode: "live",
      fetcher,
    };
    const first = openAttachmentInDesktopAgent(input, options);
    const second = openAttachmentInDesktopAgent(input, options);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    finishOpen(
      jsonResponse({
        ok: true,
        sessionId: "coalesced-session",
        localPath: "C:\\ProjectWing\\coalesced.xlsx",
        openedAt: "2026-09-08T02:00:00.000Z",
      })
    );
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("preserves custom release callbacks for manual release", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.1.9",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          session: {
            sessionId: "session-entry-1",
            lockSessionId: "zip-entry-lock-1",
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "archive-1",
            fileName: "support.xlsx",
            localPath: "C:\\ProjectWing\\support.xlsx",
            baseVersion: 3,
            releaseUrl:
              "http://localhost:3000/desktop/zip-entry-master-sessions/zip-entry-lock-1/release",
            originalHash: "hash-2",
            lastKnownHash: "hash-2",
            grantSecret: "entry-grant-secret",
            status: "CLOSED",
            lifecycleState: "CLOSED",
            contentState: "UNCHANGED",
            openedAt: "2026-06-05T02:00:00.000Z",
            launchStartedAt: "2026-06-05T02:00:00.000Z",
            lastSeenAt: "2026-06-05T02:10:00.000Z",
            retryCount: 0,
          },
        })
      );

    await releaseDesktopAgentSession(
      {
        sessionId: "session-entry-1",
        lockSessionId: "zip-entry-lock-1",
        projectId: "project-1",
        attachmentId: "archive-1",
        releaseUrl:
          "/desktop/zip-entry-master-sessions/zip-entry-lock-1/release",
      },
      {
        agentBaseUrl: "http://127.0.0.1:17862",
        apiBaseUrl: "http://localhost:3000",
        apiMode: "live",
        fetcher,
      }
    );

    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:17862/sessions/session-entry-1/release",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          releaseUrl:
            "http://localhost:3000/desktop/zip-entry-master-sessions/zip-entry-lock-1/release",
        }),
      })
    );
  });
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return Response.json(body, init);
}
