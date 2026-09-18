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
const networkPolicy = readRuntimeSource("DesktopAgentNetworkPolicy.cs");
const runtimeOptions = readRuntimeSource("DesktopAgentRuntimeOptions.cs");
const runtimeProgram = readRuntimeSource("Program.cs");
const fileTransfer = readRuntimeSource("DesktopAgentFileTransfer.cs");
const transferDiagnosticLog = readRuntimeSource(
  "DesktopAgentTransferDiagnosticLog.cs"
);

describe("desktop Agent runtime network policy", () => {
  it("defaults outbound runtime traffic to explicit direct mode", () => {
    expect(runtimeOptions).toContain(
      'ReadValue(configuration, "PROJECT_WING_AGENT_NETWORK_MODE")'
    );
    expect(runtimeOptions).toContain(
      'null or "DIRECT" => DesktopAgentNetworkMode.Direct'
    );
    expect(networkPolicy).toContain(
      "UseProxy = options.NetworkMode is not DesktopAgentNetworkMode.Direct"
    );
    expect(runtimeProgram).toContain(
      "DesktopAgentNetworkPolicy.CreateHttpClient(options)"
    );
  });

  it("keeps system and explicit proxy modes opt-in", () => {
    expect(runtimeOptions).toContain(
      '"SYSTEM" => DesktopAgentNetworkMode.System'
    );
    expect(runtimeOptions).toContain(
      '"EXPLICIT" => DesktopAgentNetworkMode.Explicit'
    );
    expect(runtimeOptions).toContain("PROJECT_WING_AGENT_PROXY_URL");
    expect(networkPolicy).toContain("handler.Proxy = new WebProxy");
  });

  it("follows only allowlisted download redirects without forwarding cross-origin authorization", () => {
    expect(networkPolicy).toContain("AllowAutoRedirect = false");
    expect(runtimeOptions).toContain(
      "PROJECT_WING_AGENT_ALLOWED_DOWNLOAD_REDIRECT_ORIGINS"
    );
    expect(fileTransfer).toContain("MaxRedirects = 5");
    expect(fileTransfer).toContain("TryResolveAllowedRedirect");
    expect(fileTransfer).toContain(
      "includeAuthorization = includeAuthorization && SameOrigin"
    );
    expect(transferDiagnosticLog).toContain('"DOWNLOAD_REDIRECT"');
  });

  it("retains safe download diagnostics without logging signed URLs", () => {
    expect(fileTransfer).toContain(
      "Desktop Agent download returned HTTP {StatusCode} ({ReasonPhrase}) from {Origin}."
    );
    expect(fileTransfer).toContain(
      "Desktop Agent download transport failed for {Origin}."
    );
    expect(fileTransfer).toContain("ReadOrigin(downloadUri)");
    expect(fileTransfer).not.toContain(
      "logger.LogWarning(response.RequestMessage"
    );
    expect(fileTransfer).not.toContain("logger.LogWarning(authorization");
    expect(runtimeProgram).toContain(
      "AddSingleton<DesktopAgentTransferDiagnosticLog>()"
    );
    expect(transferDiagnosticLog).toContain('"transfer-diagnostics.jsonl"');
    expect(transferDiagnosticLog).toContain('"DOWNLOAD_HTTP_FAILURE"');
    expect(transferDiagnosticLog).toContain('"DOWNLOAD_TRANSPORT_FAILURE"');
    expect(transferDiagnosticLog).not.toContain("downloadUri.ToString()");
    expect(transferDiagnosticLog).not.toContain("Authorization");
    expect(transferDiagnosticLog).toContain('"OBJECT_STORAGE_FAILURE"');
    expect(transferDiagnosticLog).toContain(
      'XDocument.Parse(body).Root?.Element("Code")?.Value'
    );
    expect(transferDiagnosticLog).not.toContain("StringToSign");
  });
});
