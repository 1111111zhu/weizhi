import {
  DesktopAgentHealthDiagnosticsSchema,
  DesktopAgentHealthResponseSchema,
  DesktopAgentPrintersResponseSchema,
} from "@project-wing/shared";

import { assertEqual, postJson, readJson } from "./runtime-test-support.mjs";

const trustedOrigin = "http://localhost:3021";

export async function verifyPlatformContracts(
  url,
  { trustedPdfEditorPath = null } = {}
) {
  await verifyCors(url);
  const healthResponse = await fetch(`${url}/health`, {
    headers: {
      Origin: trustedOrigin,
      "Access-Control-Request-Private-Network": "true",
    },
  });
  assertEqual(
    healthResponse.headers.get("access-control-allow-origin"),
    trustedOrigin
  );
  assertEqual(
    healthResponse.headers.get("access-control-allow-private-network"),
    "true"
  );
  const health = await healthResponse.json();
  DesktopAgentHealthResponseSchema.parse(health);
  assertHealth(health);

  const diagnostics = await readJson(url, "/diagnostics/office");
  DesktopAgentHealthDiagnosticsSchema.parse(diagnostics);
  for (const component of [
    diagnostics.excel,
    diagnostics.word,
    diagnostics.powerPoint,
  ]) {
    assertEqual(
      process.platform === "win32"
        ? ["OK", "MISSING", "NEEDS_ATTENTION", "UNKNOWN"].includes(
            component.status
          )
        : component.status === "SKIPPED",
      true
    );
  }
  assertEqual(
    process.platform === "win32"
      ? ["OK", "MISSING", "UNKNOWN"].includes(diagnostics.pdfEditor.status)
      : diagnostics.pdfEditor.status === "SKIPPED",
    true
  );
  if (trustedPdfEditorPath) {
    assertEqual(diagnostics.pdfEditor.status, "OK");
    assertEqual(diagnostics.pdfEditor.trustedEditor, true);
    assertEqual(diagnostics.pdfEditor.editorPath, trustedPdfEditorPath);
  }
  await verifyPrinters(url);
}

export async function verifyPrintEndpoint(url, authServer) {
  const response = await postJson(url, "/print", makePrintRequest(authServer));
  if (process.platform === "win32") {
    assertEqual(response.status, 404);
    const payload = await response.json();
    assertEqual(payload.code, "PRINTER_NOT_FOUND");
    return;
  }
  assertEqual(response.status, 501);
  const payload = await response.json();
  assertEqual(payload.code, "PRINT_UNSUPPORTED");
}

export function makePrintRequest(authServer) {
  return {
    printerName: "Project Wing Test Printer",
    documents: [
      {
        id: "document-1",
        fileName: "confirmation.pdf",
        downloadUrl: `${authServer.origin}/downloads/audit-report.pdf`,
      },
    ],
  };
}

async function verifyPrinters(url) {
  const response = await fetch(`${url}/printers`);
  if (response.status === 200) {
    DesktopAgentPrintersResponseSchema.parse(await response.json());
    return;
  }
  assertEqual(response.status, 501);
  assertEqual(await response.json(), {
    ok: false,
    code: "PRINT_UNSUPPORTED",
    message: "Direct printer access is unavailable on this computer.",
  });
}

async function verifyCors(url) {
  const preflight = await fetch(`${url}/health`, {
    method: "OPTIONS",
    headers: {
      Origin: trustedOrigin,
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Private-Network": "true",
    },
  });
  assertEqual(preflight.status, 204);
  assertEqual(
    preflight.headers.get("access-control-allow-origin"),
    trustedOrigin
  );
  assertEqual(
    preflight.headers.get("access-control-allow-private-network"),
    "true"
  );
  const untrusted = await fetch(`${url}/health`, {
    headers: { Origin: "https://untrusted.example" },
  });
  assertEqual(untrusted.status, 403);
  assertEqual(untrusted.headers.get("access-control-allow-origin"), null);
}

function assertHealth(value) {
  assertEqual(value, {
    ok: true,
    app: "project-wing-desktop-runtime",
    version: "9.8.7-test",
    managerVersion: "0.2.1",
    agentVersion: "9.8.7-test",
    agentState: "UPDATING",
    updateState: "STAGING_PAYLOAD",
    restoreState: "READY",
    attentionCount: 1,
    quarantineCount: 0,
  });
}
