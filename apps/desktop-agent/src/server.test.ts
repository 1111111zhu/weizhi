import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import pathModule from "node:path";

import type { DesktopAgentSession } from "@project-wing/shared/desktop";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DesktopAgentError } from "./errors.js";
import { createAgentServer as createProductionAgentServer } from "./server.js";
import { hashFile } from "./session-store.js";

const { join } = pathModule;

const testDeviceAuthSession = {
  status: () => ({ authenticated: true, pairing: false }),
  startPair: vi.fn().mockResolvedValue(),
  getAuthorization: () => "Bearer paired-test-session",
};

function createAgentServer(
  options: Parameters<typeof createProductionAgentServer>[0] = {}
) {
  return createProductionAgentServer({
    deviceAuthSession: testDeviceAuthSession,
    ...options,
  });
}

const servers: ReturnType<typeof createProductionAgentServer>[] = [];
const roots: string[] = [];
const SERVER_TEST_TIMEOUT_MS = 10_000;

function updateRequest() {
  return {
    expectedVersion: "0.1.19",
    expectedSha256: "a".repeat(64),
    expectedFileSize: 123_456,
  };
}

describe("server", () => {
  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => {
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            });
          })
      )
    );
    await Promise.all(
      roots.map((root) => rm(root, { recursive: true, force: true }))
    );
    roots.length = 0;
  });

  async function makeRoot() {
    const root = await mkdtemp(join(tmpdir(), "project-wing-agent-server-"));
    roots.push(root);
    await mkdir(root, { recursive: true });
    return root;
  }

  async function listen(
    server: ReturnType<typeof createProductionAgentServer>
  ) {
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    servers.push(server);
    const address = server.address() as AddressInfo;
    return `http://127.0.0.1:${address.port}`;
  }

  describe("desktop agent server", () => {
    it("reads and updates the local cache settings", async () => {
      const getCacheSettings = vi.fn().mockReturnValue({
        cacheRoot: "D:\\ProjectWingCache",
        maxBytes: 5_000_000_000,
      });
      const updateCacheSettings = vi.fn().mockResolvedValue({
        cacheRoot: "E:\\ProjectWingCache",
        maxBytes: 7_000_000_000,
      });
      const server = createAgentServer({
        getCacheSettings,
        updateCacheSettings,
      });
      const baseUrl = await listen(server);

      await expect(
        fetch(`${baseUrl}/cache/settings`).then((response) => response.json())
      ).resolves.toStrictEqual({
        ok: true,
        cacheRoot: "D:\\ProjectWingCache",
        maxBytes: 5_000_000_000,
      });

      const response = await fetch(`${baseUrl}/cache/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cacheRoot: "E:\\ProjectWingCache",
          maxBytes: 7_000_000_000,
        }),
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toStrictEqual({
        ok: true,
        cacheRoot: "E:\\ProjectWingCache",
        maxBytes: 7_000_000_000,
      });
      expect(updateCacheSettings).toHaveBeenCalledWith({
        cacheRoot: "E:\\ProjectWingCache",
        maxBytes: 7_000_000_000,
      });
    });

    it("rejects file access before the local agent is paired", async () => {
      const openDesktopFile = vi.fn();
      const server = createAgentServer({
        openDesktopFile,
        deviceAuthSession: {
          status: () => ({ authenticated: false, pairing: false }),
          startPair: vi.fn().mockResolvedValue(),
          getAuthorization: () => null,
        },
      });
      const baseUrl = await listen(server);
      const response = await fetch(`${baseUrl}/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "READ_ONLY",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
          downloadUrl: "https://api.example.test/download",
        }),
      });

      expect(response.status).toBe(401);
      expect(openDesktopFile).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toStrictEqual({
        ok: false,
        code: "DEVICE_AUTH_REQUIRED",
        message: "Pair this Desktop Agent before opening files.",
      });
    });

    it("starts a local device pairing without accepting a browser bearer token", async () => {
      const startPair = vi.fn().mockResolvedValue();
      const server = createAgentServer({
        deviceAuthSession: {
          status: () => ({ authenticated: false, pairing: false }),
          startPair,
          getAuthorization: () => null,
        },
      } as never);
      const baseUrl = await listen(server);

      await expect(fetch(`${baseUrl}/auth/status`)).resolves.toMatchObject({
        status: 200,
      });
      await expect(
        fetch(`${baseUrl}/auth/status`).then((response) => response.json())
      ).resolves.toStrictEqual({
        ok: true,
        authenticated: false,
        pairing: false,
      });

      const response = await fetch(`${baseUrl}/auth/pair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: "project-wing-desktop-agent",
          deviceCode: "device-code",
          authBaseUrl: "https://auth.wzcpa.hk/",
          authorization: "Bearer browser-token-must-not-be-used",
          expiresInSeconds: 1800,
          intervalSeconds: 5,
        }),
      });

      expect(response.status).toBe(202);
      expect(startPair).toHaveBeenCalledWith({
        clientId: "project-wing-desktop-agent",
        deviceCode: "device-code",
        authBaseUrl: "https://auth.wzcpa.hk",
        expiresInSeconds: 1800,
        intervalSeconds: 5,
      });
      await expect(response.json()).resolves.toStrictEqual({
        ok: true,
        authenticated: false,
        pairing: true,
      });
    });

    it("rejects a device pairing request for an untrusted auth origin", async () => {
      const startPair = vi.fn().mockResolvedValue();
      const server = createAgentServer({
        deviceAuthSession: {
          status: () => ({ authenticated: false, pairing: false }),
          startPair,
          getAuthorization: () => null,
        },
      } as never);
      const baseUrl = await listen(server);
      const response = await fetch(`${baseUrl}/auth/pair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: "project-wing-desktop-agent",
          deviceCode: "device-code",
          authBaseUrl: "https://auth.example.test",
          expiresInSeconds: 1800,
          intervalSeconds: 5,
        }),
      });

      expect(response.status).toBe(400);
      expect(startPair).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toStrictEqual({
        ok: false,
        code: "VALIDATION_FAILED",
        message: "Device pairing request is invalid.",
      });
    });

    it("lists local printers through the printer endpoint", async () => {
      const listDesktopPrinters = vi
        .fn()
        .mockResolvedValue([
          { name: "Office Printer", isDefault: true, isOffline: false },
        ]);
      const server = createAgentServer({ listDesktopPrinters } as never);
      const baseUrl = await listen(server);
      const response = await fetch(`${baseUrl}/printers`);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toStrictEqual({
        ok: true,
        printers: [
          { name: "Office Printer", isDefault: true, isOffline: false },
        ],
      });
    });

    it("submits validated confirmation PDFs to the printer service", async () => {
      const printConfirmationDocuments = vi.fn().mockResolvedValue({
        ok: true,
        printerName: "Office Printer",
        printed: [{ id: "confirmation-1", fileName: "confirmation.pdf" }],
      });
      const server = createAgentServer({
        printConfirmationDocuments,
        deviceAuthSession: {
          status: () => ({ authenticated: true, pairing: false }),
          startPair: vi.fn().mockResolvedValue(),
          getAuthorization: () => "Bearer paired-device-session",
        },
      } as never);
      const baseUrl = await listen(server);
      const response = await fetch(`${baseUrl}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printerName: "Office Printer",
          authorization: "Bearer browser-token-must-not-be-used",
          documents: [
            {
              id: "confirmation-1",
              fileName: "confirmation.pdf",
              downloadUrl: "https://api.example.test/confirmation.pdf",
            },
          ],
        }),
      });

      expect(response.status).toBe(200);
      expect(printConfirmationDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          printerName: "Office Printer",
          authorization: "Bearer paired-device-session",
        })
      );
      await expect(response.json()).resolves.toStrictEqual({
        ok: true,
        printerName: "Office Printer",
        printed: [{ id: "confirmation-1", fileName: "confirmation.pdf" }],
      });
    });

    it(
      "serves health metadata",
      async () => {
        const server = createAgentServer();
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/health`);

        await expect(response.json()).resolves.toStrictEqual({
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.2.1",
          agentState: "READY",
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "does not run Office diagnostics while serving health",
      async () => {
        const getHealthDiagnostics = vi.fn().mockResolvedValue({
          excel: {
            status: "OK",
            checkedAt: "2026-06-15T12:00:00.000Z",
            comAutomation: "AVAILABLE",
            hiddenAutomationProcessCount: 0,
            hiddenAutomationProcessIds: [],
          },
        });
        const server = createAgentServer({ getHealthDiagnostics } as never);
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/health`);

        await expect(response.json()).resolves.toStrictEqual({
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.2.1",
          agentState: "READY",
        });
        expect(getHealthDiagnostics).not.toHaveBeenCalled();
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "reports recovery readiness supplied by the runtime",
      async () => {
        const server = createAgentServer({
          getRuntimeHealth: () => ({
            agentState: "RECOVERING",
            recoveryMessage: "Reconciling persisted sessions.",
            quarantinedSessionCount: 2,
          }),
        });
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/health`);

        await expect(response.json()).resolves.toMatchObject({
          ok: true,
          agentState: "RECOVERING",
          recoveryMessage: "Reconciling persisted sessions.",
          quarantinedSessionCount: 2,
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "serves Office diagnostics from an explicit diagnostics endpoint",
      async () => {
        const server = createAgentServer({
          getHealthDiagnostics: async () => {
            await Promise.resolve();
            return {
              excel: {
                status: "NEEDS_ATTENTION",
                checkedAt: "2026-06-15T12:00:00.000Z",
                comAutomation: "UNAVAILABLE",
                hiddenAutomationProcessCount: 1,
                hiddenAutomationProcessIds: [1234],
                message: "Excel COM automation is unavailable.",
                recommendedAction:
                  "Close hidden Excel automation processes or repair Office.",
              },
            };
          },
        } as never);
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/diagnostics/office`);

        await expect(response.json()).resolves.toStrictEqual({
          ok: true,
          diagnostics: {
            excel: {
              status: "NEEDS_ATTENTION",
              checkedAt: "2026-06-15T12:00:00.000Z",
              comAutomation: "UNAVAILABLE",
              hiddenAutomationProcessCount: 1,
              hiddenAutomationProcessIds: [1234],
              message: "Excel COM automation is unavailable.",
              recommendedAction:
                "Close hidden Excel automation processes or repair Office.",
            },
          },
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "does not block health while diagnostics are still running",
      async () => {
        const server = createAgentServer({
          getHealthDiagnostics: () => new Promise(() => {}),
        } as never);
        const baseUrl = await listen(server);
        const startedAt = Date.now();
        const response = await fetch(`${baseUrl}/health`);

        expect(Date.now() - startedAt).toBeLessThan(1000);
        await expect(response.json()).resolves.toStrictEqual({
          ok: true,
          app: "project-wing-desktop-agent",
          version: "0.2.1",
          agentState: "READY",
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "serves the installed release version from the agent manifest",
      async () => {
        const root = await makeRoot();
        await writeFile(
          join(root, "agent-manifest.json"),
          `\uFEFF${JSON.stringify({
            app: "project-wing-desktop-agent",
            version: "0.1.6",
            platform: "win-x64",
          })}`
        );
        const cwd = vi.spyOn(process, "cwd").mockReturnValue(root);
        const server = createAgentServer();
        const baseUrl = await listen(server);

        try {
          const response = await fetch(`${baseUrl}/health`);

          await expect(response.json()).resolves.toStrictEqual({
            ok: true,
            app: "project-wing-desktop-agent",
            version: "0.1.6",
            agentState: "READY",
          });
        } finally {
          cwd.mockRestore();
        }
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "allows browser private-network preflights from trusted web origins",
      async () => {
        const server = createAgentServer({
          allowedWebOrigins: ["https://wing.superfx.cn"],
        });
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/health`, {
          method: "OPTIONS",
          headers: {
            Origin: "https://wing.superfx.cn",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Private-Network": "true",
          },
        });

        expect(response.status).toBe(204);
        expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
          "https://wing.superfx.cn"
        );
        expect(
          response.headers.get("Access-Control-Allow-Private-Network")
        ).toBe("true");
        expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
          "X-Project-Wing-Agent"
        );
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "rejects state-changing requests from untrusted browser origins before side effects",
      async () => {
        const updateDesktopAgent = vi.fn();
        const server = createAgentServer({
          allowedWebOrigins: ["https://wing.superfx.cn"],
          updateDesktopAgent,
        });
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/update`, {
          method: "POST",
          headers: {
            Origin: "https://attacker.example",
            "Content-Type": "text/plain",
          },
          body: JSON.stringify(updateRequest()),
        });

        expect(response.status).toBe(403);
        expect(updateDesktopAgent).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toMatchObject({
          code: "ORIGIN_NOT_ALLOWED",
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "requires the Desktop Agent mutation header for browser-origin POST requests",
      async () => {
        const updateDesktopAgent = vi.fn().mockResolvedValue({
          ok: true,
          status: "STARTED",
        });
        const server = createAgentServer({
          allowedWebOrigins: ["https://wing.superfx.cn"],
          updateDesktopAgent,
        });
        const baseUrl = await listen(server);
        const missingHeader = await fetch(`${baseUrl}/update`, {
          method: "POST",
          headers: {
            Origin: "https://wing.superfx.cn",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateRequest()),
        });
        expect(missingHeader.status).toBe(403);
        expect(updateDesktopAgent).not.toHaveBeenCalled();

        const allowed = await fetch(`${baseUrl}/update`, {
          method: "POST",
          headers: {
            Origin: "https://wing.superfx.cn",
            "Content-Type": "application/json",
            "X-Project-Wing-Agent": "1",
          },
          body: JSON.stringify(updateRequest()),
        });
        expect(allowed.status).toBe(202);
        expect(updateDesktopAgent).toHaveBeenCalledOnce();
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "starts a desktop agent self-update from the local web client",
      async () => {
        const updateDesktopAgent = vi.fn().mockResolvedValue({
          ok: true,
          status: "STARTED",
          downloadUrl:
            "http://localhost:3000/downloads/desktop-agent/windows/latest",
        });
        const server = createAgentServer({ updateDesktopAgent });
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/update`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateRequest()),
        });

        expect(response.status).toBe(202);
        expect(updateDesktopAgent).toHaveBeenCalledOnce();
        await expect(response.json()).resolves.toStrictEqual({
          ok: true,
          status: "STARTED",
          downloadUrl:
            "http://localhost:3000/downloads/desktop-agent/windows/latest",
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "returns desktop agent update status",
      async () => {
        const getDesktopAgentUpdateStatus = vi.fn().mockResolvedValue({
          ok: true,
          status: "VERIFYING_HEALTH",
          taskId: "task-1",
          expectedVersion: "0.1.19",
          currentVersion: "0.1.18",
        });
        const server = createAgentServer({
          getDesktopAgentUpdateStatus,
        });
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/update/status`);

        expect(response.status).toBe(200);
        expect(getDesktopAgentUpdateStatus).toHaveBeenCalledOnce();
        await expect(response.json()).resolves.toStrictEqual({
          ok: true,
          status: "VERIFYING_HEALTH",
          taskId: "task-1",
          expectedVersion: "0.1.19",
          currentVersion: "0.1.18",
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "sends expected update version to the updater",
      async () => {
        const updateDesktopAgent = vi.fn().mockResolvedValue({
          ok: true,
          status: "STARTED",
          taskId: "task-1",
        });
        const server = createAgentServer({ updateDesktopAgent });
        const baseUrl = await listen(server);

        await fetch(`${baseUrl}/update`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateRequest()),
        });

        expect(updateDesktopAgent).toHaveBeenCalledWith({
          expectedVersion: "0.1.19",
          expectedSha256: "a".repeat(64),
          expectedFileSize: 123_456,
          signaturePolicy: "required",
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "rejects invalid desktop agent update requests",
      async () => {
        const updateDesktopAgent = vi.fn();
        const server = createAgentServer({ updateDesktopAgent });
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/update`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expectedVersion: "latest" }),
        });

        expect(response.status).toBe(400);
        expect(updateDesktopAgent).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toStrictEqual({
          ok: false,
          code: "VALIDATION_FAILED",
          message: "Update request is invalid.",
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "returns not found when desktop agent update status is unavailable",
      async () => {
        const server = createAgentServer();
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/update/status`);

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toStrictEqual({
          ok: false,
          code: "NOT_FOUND",
          message: "Desktop Agent update status is not available.",
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "rejects open requests while a desktop agent update is active",
      async () => {
        const openDesktopFile = vi.fn();
        const server = createAgentServer({
          openDesktopFile,
          isDesktopAgentUpdateActive: () => true,
        } as never);
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/open`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-1",
            fileName: "cash.xlsx",
            downloadUrl: "http://localhost:3000/file",
            lockSessionId: "lock-session-1",
            baseVersion: 2,
            grantSecret: "grant-secret",
          }),
        });

        expect(response.status).toBe(409);
        expect(openDesktopFile).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toStrictEqual({
          ok: false,
          code: "AGENT_UPDATE_IN_PROGRESS",
          message: "Desktop Agent is updating.",
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "rejects Master open requests when Excel is missing",
      async () => {
        const openDesktopFile = vi.fn();
        const server = createAgentServer({
          openDesktopFile,
          getHealthDiagnostics: async () => {
            await Promise.resolve();
            return {
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
            };
          },
        } as never);
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/open`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-1",
            fileName: "cash.xlsx",
            downloadUrl: "http://localhost:3000/file",
            lockSessionId: "lock-session-1",
            baseVersion: 2,
            grantSecret: "grant-secret",
          }),
        });

        expect(response.status).toBe(409);
        expect(openDesktopFile).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toStrictEqual({
          ok: false,
          code: "EXCEL_NOT_INSTALLED",
          message:
            "Microsoft Excel is required for Master editing. Install Excel, then retry Master.",
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "rejects Word Master open requests when Word is missing",
      async () => {
        const openDesktopFile = vi.fn().mockResolvedValue({
          ok: true,
          sessionId: "session-word",
          localPath: "C:\\ProjectWing\\planning-memo.docx",
          openedAt: "2026-06-05T02:00:00.000Z",
        });
        const server = createAgentServer({
          openDesktopFile,
          getHealthDiagnostics: async () => {
            await Promise.resolve();
            return {
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
            };
          },
        } as never);
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/open`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-word",
            fileName: "planning-memo.docx",
            downloadUrl: "http://localhost:3000/file",
            lockSessionId: "lock-session-1",
            baseVersion: 2,
            grantSecret: "grant-secret",
          }),
        });

        expect(response.status).toBe(409);
        expect(openDesktopFile).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toStrictEqual({
          ok: false,
          code: "WORD_NOT_INSTALLED",
          message:
            "Microsoft Word is required for Master editing. Install Word, then retry Master.",
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "rejects PowerPoint Master open requests when PowerPoint is missing",
      async () => {
        const openDesktopFile = vi.fn().mockResolvedValue({
          ok: true,
          sessionId: "session-pptx",
          localPath: "C:\\ProjectWing\\board-deck.pptx",
          openedAt: "2026-06-05T02:00:00.000Z",
        });
        const server = createAgentServer({
          openDesktopFile,
          getHealthDiagnostics: async () => {
            await Promise.resolve();
            return {
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
            };
          },
        } as never);
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/open`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-pptx",
            fileName: "board-deck.pptx",
            downloadUrl: "http://localhost:3000/file",
            lockSessionId: "lock-session-1",
            baseVersion: 2,
            grantSecret: "grant-secret",
          }),
        });

        expect(response.status).toBe(409);
        expect(openDesktopFile).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toStrictEqual({
          ok: false,
          code: "POWERPOINT_NOT_INSTALLED",
          message:
            "Microsoft PowerPoint is required for Master editing. Install PowerPoint, then retry Master.",
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "rejects PDF Master open requests when no supported PDF editor is available",
      async () => {
        const openDesktopFile = vi.fn().mockResolvedValue({
          ok: true,
          sessionId: "session-pdf",
          localPath: "C:\\ProjectWing\\support.pdf",
          openedAt: "2026-06-05T02:00:00.000Z",
        });
        const server = createAgentServer({
          openDesktopFile,
          getHealthDiagnostics: async () => {
            await Promise.resolve();
            return {
              pdfEditor: {
                status: "MISSING",
                installed: false,
                trustedEditor: false,
                checkedAt: "2026-06-15T12:00:00.000Z",
                message:
                  "A supported PDF editor is not installed or configured.",
                recommendedAction:
                  "Install Adobe Acrobat, PDF-XChange Editor, or PDF Master Editor, then restart Desktop Agent.",
              },
            };
          },
        } as never);
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/open`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-pdf",
            fileName: "support.pdf",
            downloadUrl: "http://localhost:3000/file",
            lockSessionId: "lock-session-1",
            baseVersion: 2,
            grantSecret: "grant-secret",
          }),
        });

        expect(response.status).toBe(409);
        expect(openDesktopFile).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toStrictEqual({
          ok: false,
          code: "PDF_EDITOR_NOT_INSTALLED",
          message:
            "A supported PDF editor is required for PDF Master editing. Install Adobe Acrobat, PDF-XChange Editor, Foxit PDF Editor, or PDF Master Editor, then retry Master.",
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "rejects invalid open request bodies",
      async () => {
        const server = createAgentServer();
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/open`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "MASTER" }),
        });

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
          ok: false,
          code: "VALIDATION_FAILED",
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "passes valid open requests to the file session service",
      async () => {
        const openDesktopFile = vi.fn().mockResolvedValue({
          ok: true,
          sessionId: "session-1",
          localPath: "C:\\ProjectWing\\cash.xlsx",
          openedAt: "2026-06-05T02:00:00.000Z",
        });
        const server = createAgentServer({
          openDesktopFile,
          deviceAuthSession: {
            status: () => ({ authenticated: true, pairing: false }),
            startPair: vi.fn().mockResolvedValue(),
            getAuthorization: () => "Bearer paired-device-session",
          },
        } as never);
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/open`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-1",
            fileName: "cash.xlsx",
            downloadUrl:
              "http://localhost:3000/engagement/project-1/workflow/attachments/attachment-1/download",
            authorization: "Bearer browser-token-must-not-be-used",
            lockSessionId: "lock-session-1",
            baseVersion: 2,
            grantSecret: "grant-secret",
          }),
        });

        expect(response.status).toBe(200);
        expect(openDesktopFile).toHaveBeenCalledWith(
          expect.objectContaining({
            attachmentId: "attachment-1",
            authorization: "Bearer paired-device-session",
          })
        );
        await expect(response.json()).resolves.toMatchObject({
          ok: true,
          sessionId: "session-1",
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "reports unsafe cache recovery as a conflict instead of an internal error",
      async () => {
        const openDesktopFile = vi
          .fn()
          .mockRejectedValue(
            new DesktopAgentError(
              "CACHE_RECOVERY_UNSAFE",
              "Existing Master cache cannot be recovered automatically."
            )
          );
        const server = createAgentServer({ openDesktopFile });
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/open`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-1",
            fileName: "cash.xlsx",
            downloadUrl: "http://localhost:3000/file",
            lockSessionId: "lock-session-1",
            baseVersion: 2,
            grantSecret: "grant-secret",
          }),
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toStrictEqual({
          ok: false,
          code: "CACHE_RECOVERY_UNSAFE",
          message: "Existing Master cache cannot be recovered automatically.",
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "returns refreshed tracking sessions",
      async () => {
        const refresh = vi.fn().mockResolvedValue([
          {
            sessionId: "session-1",
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-1",
            fileName: "cash.xlsx",
            localPath: "C:\\ProjectWing\\cash.xlsx",
            originalHash: "hash-1",
            lastKnownHash: "hash-2",
            grantSecret: "sensitive-grant",
            uploadCheckpoint: {
              localContentHash: "hash-2",
              fileSize: 8,
              objectKey: "sensitive-object-key",
              uploadAttemptId: "attempt-1",
              completedParts: [],
            },
            status: "DIRTY_PENDING_CHECKIN",
            openedAt: "2026-06-05T02:00:00.000Z",
            lastSeenAt: "2026-06-05T02:05:00.000Z",
          },
        ]);
        const server = createAgentServer({
          sessionStore: {
            refresh,
          },
        });
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/sessions`);

        expect(refresh).toHaveBeenCalledWith();
        const body = await response.json();
        expect(body).toStrictEqual({
          ok: true,
          sessions: [
            expect.objectContaining({
              attachmentId: "attachment-1",
              status: "DIRTY_PENDING_CHECKIN",
            }),
          ],
        });
        expect(JSON.stringify(body)).not.toContain("sensitive-grant");
        expect(JSON.stringify(body)).not.toContain("sensitive-object-key");
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "keeps serving health when session refresh fails",
      async () => {
        const server = createAgentServer({
          sessionStore: {
            refresh: vi.fn().mockRejectedValue(
              Object.assign(new Error("busy"), {
                code: "EBUSY",
              })
            ),
          },
        });
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/sessions`, {
          signal: AbortSignal.timeout(1000),
        });

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toMatchObject({
          ok: false,
          code: "SESSION_REFRESH_FAILED",
        });
        await expect(fetch(`${baseUrl}/health`)).resolves.toMatchObject({
          status: 200,
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it.each(["EBUSY", "EPERM", "EACCES", "EMFILE", "ENFILE"])(
      "keeps serving health when an event route hits %s",
      async (code) => {
        const server = createAgentServer({
          sessionStore: {
            refresh: vi.fn().mockResolvedValue([]),
            get: vi.fn().mockRejectedValue(
              Object.assign(new Error("busy"), {
                code,
              })
            ),
            updateIf: vi.fn(),
          },
        } as never);
        const baseUrl = await listen(server);
        const response = await fetch(
          `${baseUrl}/sessions/session-1/open-observed`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              generation: 1,
              openSignalToken: "open-token-1",
              source: "WATCHER_COM",
            }),
            signal: AbortSignal.timeout(1000),
          }
        );

        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toMatchObject({
          ok: false,
          code: "DESKTOP_AGENT_FILE_SYSTEM_BUSY",
        });
        await expect(fetch(`${baseUrl}/health`)).resolves.toMatchObject({
          status: 200,
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "keeps serving health when an event route hits a missing local file",
      async () => {
        const server = createAgentServer({
          sessionStore: {
            refresh: vi.fn().mockResolvedValue([]),
            get: vi.fn().mockRejectedValue(
              Object.assign(new Error("missing"), {
                code: "ENOENT",
              })
            ),
            updateIf: vi.fn(),
          },
        } as never);
        const baseUrl = await listen(server);
        const response = await fetch(
          `${baseUrl}/sessions/session-1/open-observed`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              generation: 1,
              openSignalToken: "open-token-1",
              source: "WATCHER_COM",
            }),
            signal: AbortSignal.timeout(1000),
          }
        );

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({
          ok: false,
          code: "DESKTOP_AGENT_FILE_MISSING",
        });
        await expect(fetch(`${baseUrl}/health`)).resolves.toMatchObject({
          status: 200,
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it.each([
      ["ENOSPC", 507, "DESKTOP_AGENT_STORAGE_FULL"],
      ["EROFS", 409, "DESKTOP_AGENT_STORAGE_READ_ONLY"],
      ["ENAMETOOLONG", 409, "DESKTOP_AGENT_INVALID_LOCAL_PATH"],
      ["EISDIR", 409, "DESKTOP_AGENT_INVALID_LOCAL_PATH"],
      ["ENOTDIR", 409, "DESKTOP_AGENT_INVALID_LOCAL_PATH"],
    ])(
      "keeps serving health when an event route hits %s",
      async (fsCode, status, agentCode) => {
        const server = createAgentServer({
          sessionStore: {
            refresh: vi.fn().mockResolvedValue([]),
            get: vi.fn().mockRejectedValue(
              Object.assign(new Error("local file failure"), {
                code: fsCode,
              })
            ),
            updateIf: vi.fn(),
          },
        } as never);
        const baseUrl = await listen(server);
        const response = await fetch(
          `${baseUrl}/sessions/session-1/open-observed`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              generation: 1,
              openSignalToken: "open-token-1",
              source: "WATCHER_COM",
            }),
            signal: AbortSignal.timeout(1000),
          }
        );

        expect(response.status).toBe(status);
        await expect(response.json()).resolves.toMatchObject({
          ok: false,
          code: agentCode,
        });
        await expect(fetch(`${baseUrl}/health`)).resolves.toMatchObject({
          status: 200,
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "passes valid check-in requests to the check-in service",
      async () => {
        const checkInDesktopSession = vi.fn().mockResolvedValue({
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
            contentState: "UPLOADED",
            launchStartedAt: "2026-06-05T02:00:00.000Z",
            openedAt: "2026-06-05T02:00:00.000Z",
            lastSeenAt: "2026-06-05T02:10:00.000Z",
            retryCount: 0,
          },
        });
        const server = createAgentServer({ checkInDesktopSession });
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/sessions/session-1/check-in`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            checkInUrl:
              "http://localhost:3000/desktop/master-sessions/lock-session-1/check-in",
            releaseUrl:
              "http://localhost:3000/desktop/master-sessions/lock-session-1/release",
          }),
        });

        expect(response.status).toBe(200);
        expect(checkInDesktopSession).toHaveBeenCalledWith(
          expect.objectContaining({
            sessionId: "session-1",
            releaseUrl:
              "http://localhost:3000/desktop/master-sessions/lock-session-1/release",
          })
        );
        await expect(response.json()).resolves.toStrictEqual({
          ok: true,
          session: expect.objectContaining({
            sessionId: "session-1",
            status: "CLOSED",
          }),
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "passes valid manual release requests to the release service",
      async () => {
        const releaseDesktopSession = vi.fn().mockResolvedValue({
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
            launchStartedAt: "2026-06-05T02:00:00.000Z",
            openedAt: "2026-06-05T02:00:00.000Z",
            lastSeenAt: "2026-06-05T02:10:00.000Z",
            retryCount: 0,
          },
        });
        const checkInDesktopSession = vi.fn();
        const server = createAgentServer({
          checkInDesktopSession,
          releaseDesktopSession,
        });
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/sessions/session-1/release`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            releaseUrl:
              "http://localhost:3000/desktop/master-sessions/lock-session-1/release",
          }),
        });

        expect(response.status).toBe(200);
        expect(checkInDesktopSession).not.toHaveBeenCalled();
        expect(releaseDesktopSession).toHaveBeenCalledWith(
          expect.objectContaining({
            sessionId: "session-1",
            releaseUrl:
              "http://localhost:3000/desktop/master-sessions/lock-session-1/release",
          })
        );
        await expect(response.json()).resolves.toStrictEqual({
          ok: true,
          session: expect.objectContaining({
            sessionId: "session-1",
            status: "CLOSED",
          }),
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "marks a helper-owned Master session closed when the close token matches",
      async () => {
        const session = makeSession({
          closeSignalToken: "close-token-1",
          openObservedAt: "2026-06-05T02:05:00.000Z",
          lifecycleState: "OPEN",
          checkInUrl:
            "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/check-in",
          releaseUrl:
            "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/release",
        });
        const updateIf = vi.fn().mockResolvedValue({
          ...session,
          lifecycleState: "CLOSE_DETECTED",
          closeDetectedAt: "2026-06-05T02:10:00.000Z",
        });
        const checkInDesktopSession = vi.fn().mockResolvedValue({
          ok: true,
          session: {
            ...session,
            lifecycleState: "CLOSED",
            closeDetectedAt: "2026-06-05T02:10:00.000Z",
          },
        });
        const server = createAgentServer({
          checkInDesktopSession,
          sessionStore: {
            refresh: vi.fn().mockResolvedValue([]),
            get: vi.fn().mockResolvedValue(session),
            updateIf,
          },
          now: () => new Date("2026-06-05T02:10:00.000Z"),
        } as never);
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/sessions/session-1/closed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generation: 1,
            closeSignalToken: "close-token-1",
            source: "WATCHER",
          }),
        });

        expect(response.status).toBe(200);
        expect(updateIf).toHaveBeenCalledWith(
          "session-1",
          expect.any(Function),
          {
            lifecycleState: "CLOSE_DETECTED",
            closeDetectedAt: "2026-06-05T02:10:00.000Z",
            closeDetectedSource: "WATCHER",
            lastObservationAt: "2026-06-05T02:10:00.000Z",
            lastError: undefined,
          }
        );
        await expect(response.json()).resolves.toStrictEqual({
          ok: true,
          session: expect.objectContaining({
            sessionId: "session-1",
            closeDetectedAt: "2026-06-05T02:10:00.000Z",
          }),
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "starts immediate Master check-in after a helper close event",
      async () => {
        const session = makeSession({
          closeSignalToken: "close-token-1",
          openObservedAt: "2026-06-05T02:05:00.000Z",
          lifecycleState: "OPEN",
          checkInUrl:
            "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/check-in",
          releaseUrl:
            "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/release",
        });
        const updated = {
          ...session,
          lifecycleState: "CLOSE_DETECTED" as const,
          closeDetectedAt: "2026-06-05T02:10:00.000Z",
        };
        const checkInDesktopSession = vi.fn().mockResolvedValue({
          ok: true,
          session: { ...updated, lifecycleState: "CLOSED", status: "CLOSED" },
        });
        const server = createAgentServer({
          apiBaseUrl: "http://localhost:3000",
          checkInDesktopSession,
          sessionStore: {
            refresh: vi.fn().mockResolvedValue([]),
            get: vi.fn().mockResolvedValue(session),
            updateIf: vi.fn().mockResolvedValue(updated),
          },
          now: () => new Date("2026-06-05T02:10:00.000Z"),
        } as never);
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/sessions/session-1/closed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generation: 1,
            closeSignalToken: "close-token-1",
            source: "WATCHER",
          }),
        });

        expect(response.status).toBe(200);
        await Promise.resolve();
        expect(checkInDesktopSession).toHaveBeenCalledWith({
          sessionId: "session-1",
          checkInUrl:
            "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/check-in",
          releaseUrl:
            "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/release",
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "accepts a close event after the Master lease was lost",
      async () => {
        const session = makeSession({
          closeSignalToken: "close-token-1",
          openObservedAt: "2026-06-05T02:05:00.000Z",
          lifecycleState: "LEASE_LOST",
          status: "LEASE_LOST",
          contentState: "DIRTY",
        });
        const updated = {
          ...session,
          lifecycleState: "CLOSE_DETECTED" as const,
          status: "DIRTY_PENDING_CHECKIN" as const,
          closeDetectedAt: "2026-06-05T02:10:00.000Z",
        };
        const checkInDesktopSession = vi.fn().mockResolvedValue({
          ok: true,
          session: { ...updated, lifecycleState: "CLOSED", status: "CLOSED" },
        });
        const server = createAgentServer({
          apiBaseUrl: "http://localhost:3000",
          checkInDesktopSession,
          sessionStore: {
            refresh: vi.fn().mockResolvedValue([]),
            get: vi.fn().mockResolvedValue(session),
            updateIf: vi.fn().mockResolvedValue(updated),
          },
          now: () => new Date("2026-06-05T02:10:00.000Z"),
        } as never);
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/sessions/session-1/closed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generation: 1,
            closeSignalToken: "close-token-1",
            source: "WATCHER",
          }),
        });

        expect(response.status).toBe(200);
        await Promise.resolve();
        expect(checkInDesktopSession).toHaveBeenCalledWith({
          sessionId: "session-1",
          checkInUrl:
            "http://localhost:3000/desktop/master-sessions/lock-session-1/check-in",
          releaseUrl:
            "http://localhost:3000/desktop/master-sessions/lock-session-1/release",
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "acknowledges a helper close event without waiting for upload",
      async () => {
        const session = makeSession({
          closeSignalToken: "close-token-1",
          openObservedAt: "2026-06-05T02:05:00.000Z",
          lifecycleState: "OPEN",
          checkInUrl:
            "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/check-in",
          releaseUrl:
            "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/release",
        });
        const updated = {
          ...session,
          lifecycleState: "CLOSE_DETECTED" as const,
          closeDetectedAt: "2026-06-05T02:10:00.000Z",
        };
        const checkInDesktopSession = vi.fn(() => new Promise(() => {}));
        const server = createAgentServer({
          checkInDesktopSession,
          sessionStore: {
            refresh: vi.fn().mockResolvedValue([]),
            get: vi.fn().mockResolvedValue(session),
            updateIf: vi.fn().mockResolvedValue(updated),
          },
          now: () => new Date("2026-06-05T02:10:00.000Z"),
        } as never);
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/sessions/session-1/closed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generation: 1,
            closeSignalToken: "close-token-1",
            source: "WATCHER",
          }),
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toStrictEqual({
          ok: true,
          session: expect.objectContaining({
            sessionId: "session-1",
            lifecycleState: "CLOSE_DETECTED",
          }),
        });
        await Promise.resolve();
        expect(checkInDesktopSession).toHaveBeenCalledOnce();
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "records a valid open observation without releasing the session",
      async () => {
        const session = makeSession({
          lifecycleState: "LAUNCHING",
          closeSignalToken: "close-token-1",
          openObservedAt: undefined,
          openObservedSource: undefined,
        });
        const updateIf = vi.fn().mockResolvedValue({
          ...session,
          lifecycleState: "OPEN",
          openObservedAt: "2026-06-05T02:06:00.000Z",
          openObservedSource: "WATCHER_COM",
        });
        const server = createAgentServer({
          sessionStore: {
            refresh: vi.fn().mockResolvedValue([]),
            get: vi.fn().mockResolvedValue(session),
            updateIf,
          },
          now: () => new Date("2026-06-05T02:06:00.000Z"),
        } as never);
        const baseUrl = await listen(server);
        const response = await fetch(
          `${baseUrl}/sessions/session-1/open-observed`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              generation: 1,
              openSignalToken: "open-token-1",
              source: "WATCHER_COM",
            }),
          }
        );

        expect(response.status).toBe(200);
        expect(updateIf).toHaveBeenCalledWith(
          "session-1",
          expect.any(Function),
          {
            lifecycleState: "OPEN",
            openObservedAt: "2026-06-05T02:06:00.000Z",
            openObservedSource: "WATCHER_COM",
            lastObservationAt: "2026-06-05T02:06:00.000Z",
            lastError: undefined,
          }
        );
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "rejects open observation with a close-only source",
      async () => {
        const server = createAgentServer({
          sessionStore: {
            refresh: vi.fn().mockResolvedValue([]),
            get: vi
              .fn()
              .mockResolvedValue(
                makeSession({ closeSignalToken: "close-token-1" })
              ),
            updateIf: vi.fn(),
          },
        } as never);
        const baseUrl = await listen(server);
        const response = await fetch(
          `${baseUrl}/sessions/session-1/open-observed`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              generation: 1,
              openSignalToken: "open-token-1",
              source: "WATCHER",
            }),
          }
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
          code: "VALIDATION_FAILED",
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "rejects open observation with a stale generation",
      async () => {
        const updateIf = vi.fn();
        const server = createAgentServer({
          sessionStore: {
            refresh: vi.fn().mockResolvedValue([]),
            get: vi.fn().mockResolvedValue(
              makeSession({
                lifecycleState: "LAUNCHING",
                openObservedAt: undefined,
              })
            ),
            updateIf,
          },
        } as never);
        const baseUrl = await listen(server);
        const response = await fetch(
          `${baseUrl}/sessions/session-1/open-observed`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              generation: 2,
              openSignalToken: "open-token-1",
              source: "WATCHER_COM",
            }),
          }
        );

        expect(response.status).toBe(403);
        expect(updateIf).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toMatchObject({
          code: "SESSION_GENERATION_MISMATCH",
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "rejects close detection with a stale generation",
      async () => {
        const updateIf = vi.fn();
        const server = createAgentServer({
          sessionStore: {
            refresh: vi.fn().mockResolvedValue([]),
            get: vi.fn().mockResolvedValue(
              makeSession({
                lifecycleState: "OPEN",
                openObservedAt: "2026-06-05T02:05:00.000Z",
              })
            ),
            updateIf,
          },
        } as never);
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/sessions/session-1/closed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generation: 2,
            closeSignalToken: "close-token-1",
            source: "WATCHER",
          }),
        });

        expect(response.status).toBe(403);
        expect(updateIf).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toMatchObject({
          code: "SESSION_GENERATION_MISMATCH",
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "rejects automatic close detection before open observation",
      async () => {
        const server = createAgentServer({
          sessionStore: {
            refresh: vi.fn().mockResolvedValue([]),
            get: vi.fn().mockResolvedValue(
              makeSession({
                lifecycleState: "LAUNCHING",
                closeSignalToken: "close-token-1",
                openObservedAt: undefined,
              })
            ),
            updateIf: vi.fn(),
          },
        } as never);
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/sessions/session-1/closed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generation: 1,
            closeSignalToken: "close-token-1",
            source: "WATCHER",
          }),
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({
          code: "OPEN_NOT_OBSERVED",
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "rejects manual close from open-not-observed sessions",
      async () => {
        const session = makeSession({
          lifecycleState: "OPEN_NOT_OBSERVED",
          closeSignalToken: "close-token-1",
          openObservedAt: undefined,
        });
        const updateIf = vi.fn();
        const server = createAgentServer({
          sessionStore: {
            refresh: vi.fn().mockResolvedValue([]),
            get: vi.fn().mockResolvedValue(session),
            updateIf,
          },
          now: () => new Date("2026-06-05T02:12:00.000Z"),
        } as never);
        const baseUrl = await listen(server);
        const response = await fetch(`${baseUrl}/sessions/session-1/closed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generation: 1,
            closeSignalToken: "close-token-1",
            source: "MANUAL",
          }),
        });

        expect(response.status).toBe(409);
        expect(updateIf).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toMatchObject({
          code: "OPEN_NOT_OBSERVED",
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "records launch failures from the helper before workbook visibility",
      async () => {
        const session = makeSession({
          lifecycleState: "LAUNCHING",
          openObservedAt: undefined,
          openObservedSource: undefined,
        });
        const updateIf = vi.fn().mockResolvedValue({
          ...session,
          lifecycleState: "LAUNCH_FAILED",
          launchFailedReason: "COM_OPEN_FAILED",
          lastError: "Excel could not start.",
        });
        const server = createAgentServer({
          sessionStore: {
            refresh: vi.fn().mockResolvedValue([]),
            get: vi.fn().mockResolvedValue(session),
            updateIf,
          },
          now: () => new Date("2026-06-05T02:12:00.000Z"),
        } as never);
        const baseUrl = await listen(server);
        const response = await fetch(
          `${baseUrl}/sessions/session-1/launch-failed`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              generation: 1,
              openSignalToken: "open-token-1",
              reason: "COM_OPEN_FAILED",
              message: "Excel could not start.",
            }),
          }
        );

        expect(response.status).toBe(200);
        expect(updateIf).toHaveBeenCalledWith(
          "session-1",
          expect.any(Function),
          {
            lifecycleState: "LAUNCH_FAILED",
            status: "OPEN_UNCHANGED",
            launchFailedReason: "COM_OPEN_FAILED",
            lastObservationAt: "2026-06-05T02:12:00.000Z",
            lastObservationDiagnostic: "Excel could not start.",
            lastError: "Excel could not start.",
          }
        );
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "records visibility failures before open observation is available",
      async () => {
        const session = makeSession({
          lifecycleState: "LAUNCHING",
          openObservedAt: undefined,
          openObservedSource: undefined,
        });
        const updateIf = vi.fn().mockResolvedValue({
          ...session,
          lifecycleState: "LAUNCH_FAILED",
          launchFailedReason: "VISIBILITY_FAILED",
          lastError: "Excel window could not be made visible.",
        });
        const server = createAgentServer({
          sessionStore: {
            refresh: vi.fn().mockResolvedValue([]),
            get: vi.fn().mockResolvedValue(session),
            updateIf,
          },
          now: () => new Date("2026-06-05T02:12:00.000Z"),
        } as never);
        const baseUrl = await listen(server);
        const response = await fetch(
          `${baseUrl}/sessions/session-1/launch-failed`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              generation: 1,
              openSignalToken: "open-token-1",
              reason: "VISIBILITY_FAILED",
              message: "Excel window could not be made visible.",
            }),
          }
        );

        expect(response.status).toBe(200);
        expect(updateIf).toHaveBeenCalledWith(
          "session-1",
          expect.any(Function),
          {
            lifecycleState: "LAUNCH_FAILED",
            status: "OPEN_UNCHANGED",
            launchFailedReason: "VISIBILITY_FAILED",
            lastObservationAt: "2026-06-05T02:12:00.000Z",
            lastObservationDiagnostic:
              "Excel window could not be made visible.",
            lastError: "Excel window could not be made visible.",
          }
        );
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "rejects launch failure events with stale generation",
      async () => {
        const updateIf = vi.fn();
        const server = createAgentServer({
          sessionStore: {
            refresh: vi.fn().mockResolvedValue([]),
            get: vi.fn().mockResolvedValue(
              makeSession({
                generation: 1,
                lifecycleState: "LAUNCHING",
                openObservedAt: undefined,
              })
            ),
            updateIf,
          },
        } as never);
        const baseUrl = await listen(server);
        const response = await fetch(
          `${baseUrl}/sessions/session-1/launch-failed`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              generation: 2,
              openSignalToken: "open-token-1",
              reason: "COM_OPEN_FAILED",
            }),
          }
        );

        expect(response.status).toBe(403);
        expect(updateIf).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toMatchObject({
          code: "SESSION_GENERATION_MISMATCH",
        });
      },
      SERVER_TEST_TIMEOUT_MS
    );

    it(
      "recovers launch failures by staging an unchanged release",
      async () => {
        const root = await makeRoot();
        const localPath = join(root, "cash.xlsx");
        await writeFile(localPath, "same");
        const originalHash = await hashFile(localPath);
        const session = makeSession({
          localPath,
          originalHash,
          lastKnownHash: originalHash,
          lifecycleState: "LAUNCH_FAILED",
          closeSignalToken: "close-token-1",
          openObservedAt: undefined,
          openObservedSource: undefined,
          launchFailedReason: "COM_OPEN_FAILED",
        });
        const updateIf = vi.fn().mockResolvedValue({
          ...session,
          lifecycleState: "RELEASE_PENDING",
          contentState: "UNCHANGED",
          status: "RELEASE_PENDING",
          pendingReleaseReason: "UNCHANGED_RELEASE",
          pendingReleaseHash: originalHash,
        });
        const server = createAgentServer({
          isLocalFileBusy: vi.fn().mockResolvedValue(false),
          sessionStore: {
            refresh: vi.fn().mockResolvedValue([]),
            get: vi.fn().mockResolvedValue(session),
            updateIf,
          },
        } as never);
        const baseUrl = await listen(server);
        const response = await fetch(
          `${baseUrl}/sessions/session-1/recover-launch-failed-release`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              generation: 1,
              closeSignalToken: "close-token-1",
              confirmNoUserVisibleWorkbook: true,
            }),
          }
        );

        expect(response.status).toBe(200);
        expect(updateIf).toHaveBeenCalledWith(
          "session-1",
          expect.any(Function),
          {
            lifecycleState: "RELEASE_PENDING",
            contentState: "UNCHANGED",
            status: "RELEASE_PENDING",
            pendingReleaseReason: "UNCHANGED_RELEASE",
            pendingReleaseHash: originalHash,
            lastError: undefined,
          }
        );
      },
      SERVER_TEST_TIMEOUT_MS
    );
  });

  function makeSession(
    overrides: Partial<DesktopAgentSession> = {}
  ): DesktopAgentSession {
    return {
      sessionId: "session-1",
      generation: 1,
      lockSessionId: "lock-session-1",
      mode: "MASTER",
      projectId: "project-1",
      attachmentId: "attachment-1",
      fileName: "cash.xlsx",
      localPath: "C:\\ProjectWing\\cash.xlsx",
      baseVersion: 2,
      originalHash: "hash-1",
      lastKnownHash: "hash-1",
      grantSecret: "grant-secret",
      openSignalToken: "open-token-1",
      closeSignalToken: "close-token-1",
      status: "OPEN_UNCHANGED",
      lifecycleState: "OPEN",
      contentState: "UNCHANGED",
      openedAt: "2026-06-05T02:00:00.000Z",
      launchStartedAt: "2026-06-05T02:00:00.000Z",
      openObservedAt: "2026-06-05T02:05:00.000Z",
      openObservedSource: "WATCHER_COM",
      lastSeenAt: "2026-06-05T02:05:00.000Z",
      retryCount: 0,
      ...overrides,
    };
  }
});
