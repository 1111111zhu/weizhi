import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const readRuntimeSource = (file: string) =>
  readFileSync(
    new URL(
      `../runtime/ProjectWing.DesktopAgent.Runtime/${file}`,
      import.meta.url
    ),
    "utf-8"
  );

describe("desktop Agent Runtime session endpoint recovery", () => {
  it("persists derived remote endpoints for new Master sessions", () => {
    const urlPolicy = readRuntimeSource("DesktopAgentRemoteUrlPolicy.cs");
    const validator = readRuntimeSource("DesktopAgentOpenRequestValidator.cs");

    expect(validator).toContain(
      "DesktopAgentRemoteUrlPolicy.BuildMasterSessionUrl"
    );
    expect(validator).toContain('"check-in"');
    expect(validator).toContain('"release"');
    expect(urlPolicy).toContain(
      "/desktop/master-sessions/{encodedSessionId}/{action}"
    );
  });

  it("backfills missing endpoints in persisted sessions", () => {
    const reconciler = readRuntimeSource("DesktopAgentSessionReconciler.cs");

    expect(reconciler).toContain("BackfillRemoteUrlsAsync");
    expect(reconciler).toContain('ReadString(node, "checkInUrl")');
    expect(reconciler).toContain('ReadString(node, "releaseUrl")');
    expect(reconciler).toContain(
      "DesktopAgentRemoteUrlPolicy.BuildMasterSessionUrl"
    );
  });

  it("keeps close-detected sessions eligible for background synchronization", () => {
    const background = readRuntimeSource(
      "DesktopAgentBackgroundSyncService.cs"
    );

    expect(background).toContain(
      'lifecycle is "CLOSE_DETECTED" or "CHECKIN_FAILED"'
    );
    expect(background).toContain(
      'var releaseUrl = ReadString(session.Value, "releaseUrl")'
    );
  });

  it("preserves typed check-in failures across reconciliation", () => {
    const diagnostics = readRuntimeSource(
      "DesktopAgentTransferDiagnosticLog.cs"
    );
    const reconciler = readRuntimeSource("DesktopAgentSessionReconciler.cs");
    const syncService = readRuntimeSource("DesktopAgentSessionSyncService.cs");

    expect(reconciler).toContain('or "CHECKING_IN" or "CHECKIN_FAILED"');
    expect(reconciler).toContain('if (lifecycleState != "CHECKIN_FAILED")');
    expect(syncService).toContain(
      "diagnosticLog.RecordSyncFailure(stage, error)"
    );
    expect(diagnostics).toContain('"SESSION_SYNC_FAILURE"');
    expect(diagnostics).toContain("ErrorCode: error.Code");
  });

  it("only locally cleans unchanged lease-lost files", () => {
    const syncService = readRuntimeSource("DesktopAgentSessionSyncService.cs");
    const releaseCore = syncService.slice(
      syncService.indexOf(
        "private async Task<DesktopAgentSessionResponse> ReleaseCoreAsync"
      ),
      syncService.indexOf(
        "private async Task<DesktopAgentSyncSession> PrepareCheckInAsync"
      )
    );

    expect(releaseCore).toContain('session.LifecycleState == "LEASE_LOST"');
    expect(releaseCore).toContain("RecoverUnchangedLeaseLostAsync");
    expect(releaseCore).toContain(
      "HashLocalFileAsync(session, cancellationToken) != session.OriginalHash"
    );
    expect(releaseCore).toContain('["LEASE_LOST"]');
  });
});
