import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const readManagerSource = (file: string) =>
  readFileSync(
    new URL(`../manager/ProjectWing.AgentManager/${file}`, import.meta.url),
    "utf-8"
  );
const _runtimeRequestHandler = readManagerSource("RuntimeRequestHandler.cs");
const runtimeHttpProxy = readManagerSource("RuntimeHttpProxy.cs");
const workerSupervisor = readManagerSource("WorkerSupervisor.cs");
const agentUpdateCommands = readManagerSource("AgentUpdateCommands.cs");
const installerSignatureVerifier = readManagerSource(
  "InstallerSignatureVerifier.cs"
);

describe("desktop Agent Manager runtime boundary", () => {
  it("uses route-aware long transfer deadlines instead of a global 60 second timeout", () => {
    expect(runtimeHttpProxy).toContain("GetWorkerProxyTimeout");
    expect(runtimeHttpProxy).toContain("TimeSpan.FromMinutes(35)");
    expect(runtimeHttpProxy).not.toContain(
      "new HttpClient { Timeout = TimeSpan.FromSeconds(60) }"
    );
  });

  it("supervises and restarts a failed worker with bounded backoff", () => {
    expect(workerSupervisor).toContain("sealed class WorkerSupervisor");
    expect(workerSupervisor).toContain("RestartDelays");
    expect(workerSupervisor).toContain(
      "restartHistory.Count >= RestartDelays.Length"
    );
    expect(workerSupervisor).toContain("DEGRADED_NEEDS_ATTENTION");
  });

  it("requires installer size and SHA-256 before an update runs", () => {
    expect(agentUpdateCommands).toContain("RequireSha256");
    expect(agentUpdateCommands).toContain("RequireFileSize");
    expect(agentUpdateCommands).toContain("INSTALLER_VERIFY_FAILED");
    expect(agentUpdateCommands).toContain("InstallerSignatureVerifier.Verify");
    expect(agentUpdateCommands).toContain("--signature-policy");
    expect(installerSignatureVerifier).toContain("TrustENoSignature");
    expect(installerSignatureVerifier).toContain(
      'signaturePolicy == "optional"'
    );
  });
});
