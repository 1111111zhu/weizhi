import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import pathModule from "node:path";
import { promisify } from "node:util";

import type {
  DesktopAgentPrintRequest,
  DesktopAgentPrintResponse,
  DesktopAgentPrinter,
} from "@project-wing/shared/desktop";

import { getAllowedDownloadOrigins, getCacheRoot } from "./config.js";
import { DesktopAgentError } from "./errors.js";

const { basename, join } = pathModule;

const execFileAsync = promisify(execFile);

export type AuthenticatedDesktopAgentPrintRequest = DesktopAgentPrintRequest & {
  authorization: string;
};

type FetchFile = (
  url: string,
  init: { headers: Record<string, string> }
) => Promise<Response>;
type PrintFile = (filePath: string, printerName: string) => Promise<void>;
type ListPrinters = () => Promise<DesktopAgentPrinter[]>;

export type PrintConfirmationDocumentsOptions = {
  allowedDownloadOrigins?: string[];
  cacheRoot?: string;
  fetchFile?: FetchFile;
  listPrinters?: ListPrinters;
  printFile?: PrintFile;
  randomUUID?: () => string;
};

export async function listDesktopPrinters(): Promise<DesktopAgentPrinter[]> {
  if (process.platform !== "win32") {
    throw new DesktopAgentError(
      "PRINT_UNSUPPORTED",
      "Direct printer access is only available on Windows."
    );
  }

  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    "Get-CimInstance Win32_Printer | Select-Object Name,Default,WorkOffline | ConvertTo-Json -Compress",
  ]);
  return parseWindowsPrinters(stdout);
}

export async function printConfirmationDocuments(
  request: AuthenticatedDesktopAgentPrintRequest,
  options: PrintConfirmationDocumentsOptions = {}
): Promise<DesktopAgentPrintResponse> {
  const allowedDownloadOrigins =
    options.allowedDownloadOrigins ?? getAllowedDownloadOrigins();
  const cacheRoot = options.cacheRoot ?? getCacheRoot();
  const fetchFile = options.fetchFile ?? defaultFetchFile;
  const listPrinters = options.listPrinters ?? listDesktopPrinters;
  const printFile = options.printFile ?? printPdfToWindowsPrinter;
  const makeJobId = options.randomUUID ?? randomUUID;

  for (const document of request.documents) {
    assertAllowedDownloadOrigin(document.downloadUrl, allowedDownloadOrigins);
    if (!document.fileName.toLowerCase().endsWith(".pdf")) {
      throw new DesktopAgentError(
        "UNSUPPORTED_FILE_TYPE",
        "Only PDF confirmation documents can be printed."
      );
    }
  }

  const printers = await listPrinters();
  const selectedPrinter = printers.find(
    (printer) => printer.name === request.printerName
  );
  if (!selectedPrinter) {
    throw new DesktopAgentError(
      "PRINTER_NOT_FOUND",
      "The selected printer is no longer available on this computer."
    );
  }
  if (selectedPrinter.isOffline) {
    throw new DesktopAgentError(
      "PRINTER_OFFLINE",
      "The selected printer is offline."
    );
  }

  const jobDirectory = join(cacheRoot, "print-jobs", makeJobId());
  await mkdir(jobDirectory, { recursive: true });
  const printed: DesktopAgentPrintResponse["printed"] = [];

  for (const document of request.documents) {
    const response = await fetchFile(document.downloadUrl, {
      headers: request.authorization
        ? { Authorization: request.authorization }
        : {},
    });
    if (!response.ok) {
      throw new DesktopAgentError(
        "DOWNLOAD_FAILED",
        `Could not download ${document.fileName} for printing.`
      );
    }
    const safeFileName = getSafePdfFileName(document.fileName, document.id);
    const localPath = join(jobDirectory, safeFileName);
    await writeFile(localPath, Buffer.from(await response.arrayBuffer()));
    await printFile(localPath, selectedPrinter.name);
    printed.push({ id: document.id, fileName: safeFileName });
  }

  return { ok: true, printerName: selectedPrinter.name, printed };
}

async function printPdfToWindowsPrinter(filePath: string, printerName: string) {
  if (process.platform !== "win32") {
    throw new DesktopAgentError(
      "PRINT_UNSUPPORTED",
      "Direct printer access is only available on Windows."
    );
  }

  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$verbs = (Get-Item -LiteralPath $env:PROJECT_WING_PRINT_FILE).Verbs",
    "if ($verbs -notcontains 'printto') { throw 'No Windows PrintTo handler is registered for PDF files.' }",
    "Start-Process -FilePath $env:PROJECT_WING_PRINT_FILE -Verb PrintTo -ArgumentList $env:PROJECT_WING_PRINT_PRINTER -WindowStyle Hidden",
  ].join("; ");
  try {
    await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      {
        env: {
          ...process.env,
          PROJECT_WING_PRINT_FILE: filePath,
          PROJECT_WING_PRINT_PRINTER: printerName,
        },
      }
    );
  } catch (error) {
    throw new DesktopAgentError(
      "PRINT_FAILED",
      error instanceof Error
        ? error.message
        : "Windows could not submit the document to the selected printer."
    );
  }
}

function parseWindowsPrinters(value: string): DesktopAgentPrinter[] {
  const normalized = value.trim();
  if (!normalized) {
    return [];
  }
  let records: unknown;
  try {
    records = JSON.parse(normalized);
  } catch {
    throw new DesktopAgentError(
      "PRINTER_DISCOVERY_FAILED",
      "Windows returned an invalid printer list."
    );
  }
  const source = Array.isArray(records) ? records : [records];
  return source.flatMap((record) => {
    if (!record || typeof record !== "object") {
      return [];
    }
    const { Name, Default, WorkOffline } = record as Record<string, unknown>;
    if (typeof Name !== "string" || !Name.trim()) {
      return [];
    }
    return [
      {
        name: Name.trim(),
        isDefault: Default === true,
        isOffline: WorkOffline === true,
      },
    ];
  });
}

function assertAllowedDownloadOrigin(url: string, allowedOrigins: string[]) {
  let origin: string;
  try {
    ({ origin } = new URL(url));
  } catch {
    throw new DesktopAgentError(
      "ORIGIN_NOT_ALLOWED",
      "The print document URL is invalid."
    );
  }
  if (!allowedOrigins.includes(origin)) {
    throw new DesktopAgentError(
      "ORIGIN_NOT_ALLOWED",
      "The print document URL is not an approved Project Wing origin."
    );
  }
}

function getSafePdfFileName(fileName: string, id: string) {
  const safeBaseName = basename(fileName).replaceAll(/[^a-zA-Z0-9._-]/g, "_");
  const suffix = createHash("sha256").update(id).digest("hex").slice(0, 8);
  return `${safeBaseName.replace(/\.pdf$/i, "")}-${suffix}.pdf`;
}

async function defaultFetchFile(
  url: string,
  init: { headers: Record<string, string> }
) {
  await Promise.resolve();
  return fetch(url, init);
}
