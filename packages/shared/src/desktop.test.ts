import { describe, expect, it } from "vitest";

import {
  CreateDesktopFolderSchema,
  CreateProjectSchema,
  DesktopAgentCheckInRequestSchema,
  DesktopAgentCheckInResponseSchema,
  DesktopAgentCloseDetectionSourceSchema,
  DesktopAgentClosedRequestSchema,
  DesktopAgentDeviceAuthStatusResponseSchema,
  DesktopAgentHealthResponseSchema,
  DesktopAgentLaunchAbortReleaseRequestSchema,
  DesktopAgentLaunchFailedReasonSchema,
  DesktopAgentLaunchFailedRequestSchema,
  DesktopAgentOpenObservationSourceSchema,
  DesktopAgentOpenObservedRequestSchema,
  DesktopAgentOpenRequestSchema,
  DesktopAgentPrintRequestSchema,
  DesktopAgentReleaseManifestSchema,
  DesktopAgentReleaseRequestSchema,
  DesktopAgentSessionContentStateSchema,
  DesktopAgentSessionLifecycleStateSchema,
  DesktopAgentSessionStatusSchema,
  DesktopAgentSessionsResponseSchema,
  DesktopAgentStartDevicePairSchema,
  DesktopAgentUpdateRequestSchema,
  DesktopAgentUpdateStatusResponseSchema,
  DesktopUploadGrantSchema,
  PROJECT_WING_DESKTOP_AGENT_CLIENT_ID,
  ReorderDesktopProjectPlacementsSchema,
  UpdateDesktopProjectPlacementSchema,
  getDesktopAgentCompatibilityStatus,
} from "./index";

describe("desktop launcher contracts", () => {
  it("validates a bounded Desktop Agent device pairing request", () => {
    expect(
      DesktopAgentStartDevicePairSchema.parse({
        clientId: PROJECT_WING_DESKTOP_AGENT_CLIENT_ID,
        deviceCode: "device-code",
        authBaseUrl: "https://auth.superfx.cn",
        expiresInSeconds: 1800,
        intervalSeconds: 5,
      })
    ).toStrictEqual({
      clientId: PROJECT_WING_DESKTOP_AGENT_CLIENT_ID,
      deviceCode: "device-code",
      authBaseUrl: "https://auth.superfx.cn",
      expiresInSeconds: 1800,
      intervalSeconds: 5,
    });
    expect(
      DesktopAgentStartDevicePairSchema.safeParse({
        clientId: PROJECT_WING_DESKTOP_AGENT_CLIENT_ID,
        deviceCode: "device-code",
        authBaseUrl: "https://auth.superfx.cn",
        expiresInSeconds: 1801,
        intervalSeconds: 5,
      }).success
    ).toBeFalsy();
    expect(
      DesktopAgentStartDevicePairSchema.safeParse({
        clientId: PROJECT_WING_DESKTOP_AGENT_CLIENT_ID,
        deviceCode: "device-code",
        authBaseUrl: "https://auth.superfx.cn/device",
        expiresInSeconds: 1800,
        intervalSeconds: 5,
      }).success
    ).toBeFalsy();
  });

  it("validates Desktop Agent device pairing status without exposing a token", () => {
    expect(
      DesktopAgentDeviceAuthStatusResponseSchema.parse({
        ok: true,
        authenticated: false,
        pairing: true,
      })
    ).toStrictEqual({
      ok: true,
      authenticated: false,
      pairing: true,
    });
  });

  it("validates legacy desktop agent health responses", () => {
    expect(
      DesktopAgentHealthResponseSchema.parse({
        ok: true,
        app: "project-wing-desktop-agent",
        version: "0.1.20",
      })
    ).toStrictEqual({
      ok: true,
      app: "project-wing-desktop-agent",
      version: "0.1.20",
    });
  });

  it("validates manager-owned desktop runtime health responses", () => {
    expect(
      DesktopAgentHealthResponseSchema.parse({
        ok: true,
        app: "project-wing-desktop-runtime",
        version: "0.1.20",
        managerVersion: "0.2.0",
        agentVersion: "0.1.20",
        requiredAgentVersion: "0.1.21",
        agentState: "READY",
        updateState: "IDLE",
        restoreState: "READY",
        attentionCount: 0,
      })
    ).toStrictEqual({
      ok: true,
      app: "project-wing-desktop-runtime",
      version: "0.1.20",
      managerVersion: "0.2.0",
      agentVersion: "0.1.20",
      requiredAgentVersion: "0.1.21",
      agentState: "READY",
      updateState: "IDLE",
      restoreState: "READY",
      attentionCount: 0,
    });
  });

  it("validates desktop agent health diagnostics", () => {
    const result = DesktopAgentHealthResponseSchema.safeParse({
      ok: true,
      app: "project-wing-desktop-agent",
      version: "0.1.12",
      diagnostics: {
        excel: {
          status: "NEEDS_ATTENTION",
          checkedAt: "2026-06-15T12:00:00.000Z",
          comAutomation: "UNAVAILABLE",
          hiddenAutomationProcessCount: 2,
          hiddenAutomationProcessIds: [1234, 5678],
          message: "Excel COM automation is unavailable.",
          recommendedAction:
            "Close hidden Excel automation processes or repair Office.",
        },
      },
    });

    expect(result.success).toBeTruthy();
    if (!result.success) {
      throw new Error("Expected validation result to match the success branch");
    }
    expect(result.data.diagnostics?.excel?.status).toBe("NEEDS_ATTENTION");
    expect(result.data.diagnostics?.excel?.hiddenAutomationProcessCount).toBe(
      2
    );
  });

  it("validates missing Excel diagnostics", () => {
    const result = DesktopAgentHealthResponseSchema.safeParse({
      ok: true,
      app: "project-wing-desktop-agent",
      version: "0.1.12",
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
    });

    expect(result.success).toBeTruthy();
    if (!result.success) {
      throw new Error("Expected validation result to match the success branch");
    }
    expect(result.data.diagnostics?.excel?.status).toBe("MISSING");
    expect(result.data.diagnostics?.excel?.installed).toBeFalsy();
  });

  it("validates missing Word diagnostics", () => {
    const result = DesktopAgentHealthResponseSchema.safeParse({
      ok: true,
      app: "project-wing-desktop-agent",
      version: "0.1.12",
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
    });

    expect(result.success).toBeTruthy();
    if (!result.success) {
      throw new Error("Expected missing Word diagnostics to parse");
    }
    const diagnostics = result.data.diagnostics as {
      word?: { status?: string; installed?: boolean };
    };
    expect(diagnostics?.word?.status).toBe("MISSING");
    expect(diagnostics?.word?.installed).toBeFalsy();
  });

  it("validates missing PowerPoint diagnostics", () => {
    const result = DesktopAgentHealthResponseSchema.safeParse({
      ok: true,
      app: "project-wing-desktop-agent",
      version: "0.1.12",
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
    });

    expect(result.success).toBeTruthy();
    if (!result.success) {
      throw new Error("Expected validation result to match the success branch");
    }
    expect(result.data.diagnostics?.powerPoint?.status).toBe("MISSING");
    expect(result.data.diagnostics?.powerPoint?.installed).toBeFalsy();
  });

  it("allows project-first creation without an explicit workspace", () => {
    const result = CreateProjectSchema.safeParse({
      name: "ABC Group 2026 audit",
      projectCode: "ABC-2026-AUD",
      language: "zh-CN",
      frameworkTemplateId: "framework-hkfrs",
      yearEndDate: "2026-12-31",
      reportDate: "2027-03-31",
      archiveDeadline: "2027-06-29",
    });

    expect(result.success).toBeTruthy();
    if (!result.success) {
      throw new Error("Expected validation result to match the success branch");
    }
    expect("companyName" in result.data).toBeFalsy();
    expect("companyRegion" in result.data).toBeFalsy();
    expect("listingStatus" in result.data).toBeFalsy();
  });

  it("accepts the desktop folder where a project is created", () => {
    const result = CreateProjectSchema.safeParse({
      name: "ABC Group 2026 audit",
      projectCode: "ABC-2026-AUD",
      language: "zh-CN",
      frameworkTemplateId: "framework-hkfrs",
      folderId: "folder-client",
      yearEndDate: "2026-12-31",
      reportDate: "2027-03-31",
      archiveDeadline: "2027-06-29",
    });

    expect(result.success).toBeTruthy();
    if (!result.success) {
      throw new Error("Expected validation result to match the success branch");
    }
    expect(result.data.folderId).toBe("folder-client");
  });

  it("validates desktop folder names", () => {
    expect(
      CreateDesktopFolderSchema.safeParse({ name: "Default" }).success
    ).toBeTruthy();
    expect(
      CreateDesktopFolderSchema.safeParse({ name: " " }).success
    ).toBeFalsy();
  });

  it("accepts persisted icon coordinates and folder moves", () => {
    const result = UpdateDesktopProjectPlacementSchema.safeParse({
      folderId: "folder-1",
      desktopX: 360,
      desktopY: 216,
      lastOpened: true,
    });

    expect(result.success).toBeTruthy();
  });

  it("rejects negative desktop coordinates", () => {
    const result = UpdateDesktopProjectPlacementSchema.safeParse({
      desktopX: -1,
      desktopY: 10,
    });

    expect(result.success).toBeFalsy();
  });

  it("accepts batched desktop placement reorder payloads", () => {
    const result = ReorderDesktopProjectPlacementsSchema.safeParse({
      placements: [
        {
          projectId: "project-2",
          desktopX: 24,
          desktopY: 24,
          sortOrder: 0,
        },
        {
          projectId: "project-1",
          desktopX: 156,
          desktopY: 24,
          sortOrder: 1,
        },
      ],
    });

    expect(result.success).toBeTruthy();
  });

  it("validates desktop agent open requests", () => {
    const result = DesktopAgentOpenRequestSchema.safeParse({
      mode: "MASTER",
      projectId: "project-1",
      attachmentId: "attachment-1",
      fileName: "cash.xlsx",
      downloadUrl:
        "http://localhost:3000/engagement/project-1/workflow/attachments/attachment-1/download",
      lockSessionId: "lock-session-1",
      baseVersion: 3,
      cacheVersionId: "attachment-version-3",
      cacheOwnerId: "user-1",
      fileSize: 1024,
      contentHash: "a".repeat(64),
      directUploadSupported: true,
      grantSecret: "grant-secret",
    });

    expect(result.success).toBeTruthy();
    if (!result.success) {
      throw new Error("Expected validation result to match the success branch");
    }
    expect(result.data.mode).toBe("MASTER");
    expect(result.data.fileName).toBe("cash.xlsx");
    expect(result.data.lockSessionId).toBe("lock-session-1");
    expect(result.data.baseVersion).toBe(3);
    expect(result.data.cacheVersionId).toBe("attachment-version-3");
    expect(result.data.cacheOwnerId).toBe("user-1");
    expect(result.data.fileSize).toBe(1024);
    expect(result.data.contentHash).toBe("a".repeat(64));
    expect(result.data.directUploadSupported).toBeTruthy();
    expect(result.data.grantSecret).toBe("grant-secret");
  });

  it("validates resumable OSS upload grants", () => {
    expect(
      DesktopUploadGrantSchema.parse({
        ok: true,
        mode: "DIRECT_MULTIPART",
        objectKey: "desktop-master-check-ins/file.xlsx",
        uploadId: "upload-1",
        partSize: 8 * 1024 * 1024,
        parts: [
          { partNumber: 1, uploadUrl: "https://oss.example/signed-part-1" },
        ],
        expiresAt: "2026-07-23T10:00:00.000Z",
      }).mode
    ).toBe("DIRECT_MULTIPART");
  });

  it("drops browser bearer values from all Desktop Agent public requests", () => {
    const openRequest = DesktopAgentOpenRequestSchema.parse({
      mode: "READ_ONLY",
      projectId: "project-1",
      attachmentId: "attachment-1",
      fileName: "cash.xlsx",
      downloadUrl: "https://api.example.test/download",
      authorization: "Bearer browser-token",
    });
    const printRequest = DesktopAgentPrintRequestSchema.parse({
      printerName: "Office Printer",
      documents: [
        {
          id: "confirmation-1",
          fileName: "confirmation.pdf",
          downloadUrl: "https://api.example.test/confirmation.pdf",
        },
      ],
      authorization: "Bearer browser-token",
    });
    const checkInRequest = DesktopAgentCheckInRequestSchema.parse({
      sessionId: "session-1",
      releaseUrl: "https://api.example.test/release",
      authorization: "Bearer browser-token",
    });
    const releaseRequest = DesktopAgentReleaseRequestSchema.parse({
      sessionId: "session-1",
      releaseUrl: "https://api.example.test/release",
      authorization: "Bearer browser-token",
    });

    expect(openRequest).not.toHaveProperty("authorization");
    expect(printRequest).not.toHaveProperty("authorization");
    expect(checkInRequest).not.toHaveProperty("authorization");
    expect(releaseRequest).not.toHaveProperty("authorization");
  });

  it("validates desktop agent open requests with custom Master callbacks", () => {
    const result = DesktopAgentOpenRequestSchema.safeParse({
      mode: "MASTER",
      projectId: "project-1",
      attachmentId: "zip-attachment-1",
      fileName: "support.xlsx",
      downloadUrl:
        "https://wing.test/engagement/project-1/workflow/zip-master-sessions/session-1/entries/download?path=support.xlsx",
      checkInUrl:
        "https://wing.test/desktop/zip-entry-master-sessions/zip-entry-lock-1/check-in",
      releaseUrl:
        "https://wing.test/desktop/zip-entry-master-sessions/zip-entry-lock-1/release",
      lockSessionId: "zip-entry-lock-1",
      baseVersion: 1,
      grantSecret: "secret",
    });

    expect(result.success).toBeTruthy();
    if (!result.success) {
      throw new Error("Expected validation result to match the success branch");
    }
    expect(result.data.checkInUrl).toBe(
      "https://wing.test/desktop/zip-entry-master-sessions/zip-entry-lock-1/check-in"
    );
    expect(result.data.releaseUrl).toBe(
      "https://wing.test/desktop/zip-entry-master-sessions/zip-entry-lock-1/release"
    );
  });

  it("rejects desktop agent open requests with non-http download URLs", () => {
    const result = DesktopAgentOpenRequestSchema.safeParse({
      mode: "READ_ONLY",
      projectId: "project-1",
      attachmentId: "attachment-1",
      fileName: "cash.xlsx",
      downloadUrl: "file:///C:/Users/User/cash.xlsx",
    });

    expect(result.success).toBeFalsy();
  });

  it("validates desktop agent persisted session snapshots", () => {
    const result = DesktopAgentSessionsResponseSchema.safeParse({
      ok: true,
      sessions: [
        {
          sessionId: "session-1",
          generation: 2,
          lockSessionId: "lock-session-1",
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
          localPath:
            "C:\\Users\\User\\AppData\\Local\\ProjectWing\\AgentCache\\cash.xlsx",
          baseVersion: 3,
          originalHash: "abc123",
          lastKnownHash: "def456",
          lastUploadedHash: "abc123",
          grantSecret: "grant-secret",
          checkInUrl:
            "https://wing.test/desktop/zip-entry-master-sessions/zip-entry-lock-1/check-in",
          releaseUrl:
            "https://wing.test/desktop/zip-entry-master-sessions/zip-entry-lock-1/release",
          status: "RELEASE_FAILED",
          lifecycleState: "RELEASE_FAILED",
          contentState: "DIRTY",
          launchStartedAt: "2026-06-05T02:00:00.000Z",
          openObservedAt: "2026-06-05T02:01:00.000Z",
          openObservedSource: "WATCHER_COM",
          closeDetectedAt: "2026-06-05T02:04:00.000Z",
          closeDetectedSource: "WATCHER",
          openSignalToken: "open-token-1",
          closeSignalToken: "close-token-1",
          excelHelperProcessId: 1234,
          pendingReleaseReason: "CHECKED_IN",
          pendingReleaseHash: "def456",
          openedAt: "2026-06-05T02:00:00.000Z",
          lastSeenAt: "2026-06-05T02:05:00.000Z",
          lastObservationAt: "2026-06-05T02:04:00.000Z",
          lastUploadAttemptAt: "2026-06-05T02:06:00.000Z",
          lastReleaseAttemptAt: "2026-06-05T02:07:00.000Z",
          retryCount: 2,
          lastError: "Network unavailable",
        },
      ],
      recentSessions: [
        {
          projectId: "project-2",
          attachmentId: "attachment-2",
          fileName: "planning.xlsx",
          mode: "READ_ONLY",
          openedAt: "2026-06-04T02:00:00.000Z",
          closedAt: "2026-06-04T03:00:00.000Z",
        },
      ],
    });

    expect(result.success).toBeTruthy();
    if (!result.success) {
      throw new Error("Expected validation result to match the success branch");
    }
    expect(result.data.sessions[0]?.checkInUrl).toBe(
      "https://wing.test/desktop/zip-entry-master-sessions/zip-entry-lock-1/check-in"
    );
    expect(result.data.sessions[0]?.releaseUrl).toBe(
      "https://wing.test/desktop/zip-entry-master-sessions/zip-entry-lock-1/release"
    );
    expect(result.data.recentSessions[0]?.fileName).toBe("planning.xlsx");
  });

  it("defaults missing desktop agent recent sessions for older runtimes", () => {
    const result = DesktopAgentSessionsResponseSchema.parse({
      ok: true,
      sessions: [],
    });

    expect(result.recentSessions).toStrictEqual([]);
  });

  it("validates desktop agent check-in requests and responses", () => {
    const request = DesktopAgentCheckInRequestSchema.safeParse({
      sessionId: "session-1",
      checkInUrl:
        "http://localhost:3000/desktop/master-sessions/lock-session-1/check-in",
      releaseUrl:
        "http://localhost:3000/desktop/master-sessions/lock-session-1/release",
    });
    const response = DesktopAgentCheckInResponseSchema.safeParse({
      ok: true,
      session: {
        sessionId: "session-1",
        lockSessionId: "lock-session-1",
        mode: "MASTER",
        projectId: "project-1",
        attachmentId: "attachment-1",
        fileName: "cash.xlsx",
        localPath: "C:\\ProjectWing\\cash.xlsx",
        baseVersion: 3,
        originalHash: "new-hash",
        lastKnownHash: "new-hash",
        grantSecret: "grant-secret",
        status: "CLEANUP_PENDING",
        lifecycleState: "CLEANUP_PENDING",
        contentState: "UNCHANGED",
        launchStartedAt: "2026-06-05T02:00:00.000Z",
        openedAt: "2026-06-05T02:00:00.000Z",
        lastSeenAt: "2026-06-05T02:10:00.000Z",
        retryCount: 0,
      },
    });

    expect(request.success).toBeTruthy();
    expect(response.success).toBeTruthy();
  });

  it("lists robust desktop agent session statuses", () => {
    expect(DesktopAgentSessionStatusSchema.options).toStrictEqual([
      "OPEN_UNCHANGED",
      "DIRTY_PENDING_CHECKIN",
      "CHECKING_IN",
      "CHECKIN_FAILED",
      "RELEASE_PENDING",
      "RELEASING",
      "RELEASE_FAILED",
      "CLEANUP_PENDING",
      "CLEANUP_FAILED",
      "LOCAL_FILE_MISSING",
      "CONFLICT_RISK",
      "LEASE_LOST",
      "LOCK_REVOKED",
      "SERVER_FILE_REMOVED",
      "CLOSED",
    ]);
  });

  it("validates desktop agent release requests", () => {
    const result = DesktopAgentReleaseRequestSchema.safeParse({
      sessionId: "session-1",
      releaseUrl:
        "http://localhost:3000/desktop/master-sessions/lock-session-1/release",
    });

    expect(result.success).toBeTruthy();
  });

  it("requires integrity metadata for desktop agent update requests", () => {
    expect(
      DesktopAgentUpdateRequestSchema.parse({
        expectedVersion: "0.1.19",
        expectedSha256: "A".repeat(64),
        expectedFileSize: 123_456,
        downloadUrl:
          "https://emp.wzcpa.hk/api/downloads/desktop-agent/windows/releases/0.2.1",
      })
    ).toStrictEqual({
      expectedVersion: "0.1.19",
      expectedSha256: "a".repeat(64),
      expectedFileSize: 123_456,
      signaturePolicy: "required",
      downloadUrl:
        "https://emp.wzcpa.hk/api/downloads/desktop-agent/windows/releases/0.2.1",
    });

    expect(() => DesktopAgentUpdateRequestSchema.parse({})).toThrow(/./);

    expect(() =>
      DesktopAgentUpdateRequestSchema.parse({
        expectedVersion: "latest",
      })
    ).toThrow(/./);
  });

  it("defaults legacy Windows release manifests to required signatures", () => {
    const manifest = DesktopAgentReleaseManifestSchema.parse({
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
    });

    expect(manifest.version).toBe("0.2.1");
    expect(manifest.signaturePolicy).toBe("required");
  });

  it("accepts an explicit optional Windows signature policy", () => {
    const manifest = DesktopAgentReleaseManifestSchema.parse({
      version: "0.2.2",
      platform: "windows",
      architecture: "x64",
      downloadUrl:
        "https://emp.wzcpa.hk/api/downloads/desktop-agent/windows/releases/0.2.2",
      sha256: "b".repeat(64),
      fileSize: 234_567,
      publishedAt: "2026-07-30T12:00:00.000Z",
      minimumSupportedVersion: "0.2.0",
      minimumSelfUpdateVersion: "0.2.10",
      signaturePolicy: "optional",
    });

    expect(manifest.signaturePolicy).toBe("optional");
  });

  it("validates durable desktop agent update status responses", () => {
    const parsed = DesktopAgentUpdateStatusResponseSchema.parse({
      ok: true,
      taskId: "task-1",
      status: "VERIFYING_HEALTH",
      stage: "VERIFYING_HEALTH",
      message: "Waiting for Desktop Agent 0.1.19.",
      expectedVersion: "0.1.19",
      currentVersion: "0.1.18",
      startedAt: "2026-06-17T12:00:00.000Z",
      updatedAt: "2026-06-17T12:00:05.000Z",
      downloadUrl:
        "https://wing.superfx.cn/api/downloads/desktop-agent/windows/releases/0.2.1",
      reportPath:
        "C:\\Users\\LHX\\AppData\\Local\\ProjectWing\\AgentState\\install-repair-report.json",
    });

    expect(parsed.status).toBe("VERIFYING_HEALTH");
    expect(parsed.expectedVersion).toBe("0.1.19");
  });

  it("validates desktop agent update failure codes", () => {
    expect(
      DesktopAgentUpdateStatusResponseSchema.parse({
        ok: true,
        status: "FAILED",
        taskId: "task-1",
        errorCode: "HEALTH_TIMEOUT",
        message: "Desktop Agent did not report the expected version.",
        startedAt: "2026-06-17T12:00:00.000Z",
        updatedAt: "2026-06-17T12:01:00.000Z",
      }).errorCode
    ).toBe("HEALTH_TIMEOUT");
  });

  it("backfills desktop agent session generation for legacy snapshots", () => {
    const result = DesktopAgentSessionsResponseSchema.safeParse({
      ok: true,
      sessions: [
        {
          sessionId: "session-1",
          lockSessionId: "lock-session-1",
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
          localPath: "C:\\ProjectWing\\cash.xlsx",
          baseVersion: 3,
          originalHash: "hash-1",
          lastKnownHash: "hash-1",
          grantSecret: "grant-secret",
          status: "OPEN_UNCHANGED",
          lifecycleState: "OPEN",
          contentState: "UNCHANGED",
          launchStartedAt: "2026-06-05T02:00:00.000Z",
          openedAt: "2026-06-05T02:00:00.000Z",
          lastSeenAt: "2026-06-05T02:00:00.000Z",
        },
      ],
    });

    expect(result.success).toBeTruthy();
    if (!result.success) {
      throw new Error("Expected validation result to match the success branch");
    }
    expect(result.data.sessions[0]?.generation).toBe(1);
  });

  it("validates open and close event payloads with generation-specific tokens", () => {
    const openObserved = DesktopAgentOpenObservedRequestSchema.safeParse({
      generation: 2,
      openSignalToken: "open-token-1",
      source: "WATCHER_COM",
    });
    const closed = DesktopAgentClosedRequestSchema.safeParse({
      generation: 2,
      closeSignalToken: "close-token-1",
      source: "WATCHER",
    });

    expect(openObserved.success).toBeTruthy();
    expect(closed.success).toBeTruthy();
  });

  it("validates launch failure and launch-abort release payloads", () => {
    const launchFailed = DesktopAgentLaunchFailedRequestSchema.safeParse({
      generation: 2,
      openSignalToken: "open-token-1",
      reason: "VISIBILITY_FAILED",
      message: "Excel could not be made visible.",
    });
    const launchAbortRelease =
      DesktopAgentLaunchAbortReleaseRequestSchema.safeParse({
        generation: 2,
        closeSignalToken: "close-token-1",
        confirmNoUserVisibleWorkbook: true,
      });
    const missingConfirmation =
      DesktopAgentLaunchAbortReleaseRequestSchema.safeParse({
        generation: 2,
        closeSignalToken: "close-token-1",
      });

    expect(launchFailed.success).toBeTruthy();
    expect(launchAbortRelease.success).toBeTruthy();
    expect(missingConfirmation.success).toBeFalsy();
  });

  it("lists operationally meaningful launch failure reasons", () => {
    expect(DesktopAgentLaunchFailedReasonSchema.options).toStrictEqual([
      "COM_CREATE_FAILED",
      "COM_OPEN_FAILED",
      "VISIBILITY_FAILED",
      "OPEN_OBSERVED_POST_FAILED",
      "SHELL_OPEN_FAILED",
      "SHELL_OPEN_NOT_OBSERVED",
      "OPEN_OBSERVATION_TIMEOUT",
      "SESSION_NOT_FOUND_AFTER_LAUNCH",
      "SESSION_NO_LONGER_LAUNCHABLE",
      "WATCHER_START_FAILED",
    ]);
  });

  it("validates desktop agent lifecycle and content states", () => {
    expect(DesktopAgentSessionLifecycleStateSchema.options).toStrictEqual([
      "LAUNCHING",
      "OPEN",
      "OPEN_NOT_OBSERVED",
      "LAUNCH_FAILED",
      "CLOSE_DETECTED",
      "CHECKING_IN",
      "CHECKIN_FAILED",
      "RELEASE_PENDING",
      "RELEASING",
      "RELEASE_FAILED",
      "CLEANUP_PENDING",
      "CLEANUP_FAILED",
      "CLOSED",
      "LOCAL_FILE_MISSING",
      "CONFLICT_RISK",
      "LEASE_LOST",
      "LOCK_REVOKED",
      "SERVER_FILE_REMOVED",
    ]);
    expect(DesktopAgentSessionContentStateSchema.options).toStrictEqual([
      "UNCHANGED",
      "DIRTY",
      "UPLOADED",
      "MISSING",
    ]);
  });

  it("validates endpoint-specific desktop agent observation sources", () => {
    expect(DesktopAgentOpenObservationSourceSchema.options).toStrictEqual([
      "WATCHER_COM",
      "WATCHER_FILE_LOCK",
      "MONITOR_COM",
      "MONITOR_FILE_LOCK",
      "MONITOR_PROCESS",
      "LAUNCHER_PROCESS",
      "MANUAL",
    ]);
    expect(DesktopAgentCloseDetectionSourceSchema.options).toStrictEqual([
      "WATCHER",
      "MONITOR",
      "MANUAL",
    ]);
  });

  it("maps lifecycle and content state to compatibility statuses", () => {
    expect(
      getDesktopAgentCompatibilityStatus({
        lifecycleState: "OPEN",
        contentState: "UNCHANGED",
      })
    ).toBe("OPEN_UNCHANGED");
    expect(
      getDesktopAgentCompatibilityStatus({
        lifecycleState: "OPEN",
        contentState: "DIRTY",
      })
    ).toBe("DIRTY_PENDING_CHECKIN");
    expect(
      getDesktopAgentCompatibilityStatus({
        lifecycleState: "CLOSE_DETECTED",
        contentState: "DIRTY",
      })
    ).toBe("DIRTY_PENDING_CHECKIN");
    expect(
      getDesktopAgentCompatibilityStatus({
        lifecycleState: "CHECKING_IN",
        contentState: "DIRTY",
      })
    ).toBe("CHECKING_IN");
    expect(
      getDesktopAgentCompatibilityStatus({
        lifecycleState: "RELEASE_PENDING",
        contentState: "UPLOADED",
      })
    ).toBe("RELEASE_PENDING");
    expect(
      getDesktopAgentCompatibilityStatus({
        lifecycleState: "RELEASING",
        contentState: "UPLOADED",
      })
    ).toBe("RELEASING");
    expect(
      getDesktopAgentCompatibilityStatus({
        lifecycleState: "CLEANUP_PENDING",
        contentState: "UPLOADED",
      })
    ).toBe("CLEANUP_PENDING");
  });
});
