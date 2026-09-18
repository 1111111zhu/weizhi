export const CONFIRMATION_EMP_MANIFEST_FILE_NAME =
  "confirmation-file-manifest.csv";
export const MAX_CONFIRMATION_EMP_FILE_NAME_LENGTH = 255;
export const CONFIRMATION_EMP_MANIFEST_TEXT_MARKER = "[TEXT]";

export type ConfirmationEmpImportRole = "OUTGOING" | "RESPONSE_ORIGINAL";

export type ConfirmationEmpImportSourceFile = {
  internalSequence: number;
  sourceConfirmationCode: string;
  counterparty: string;
  zipEntryName?: string;
  role: ConfirmationEmpImportRole;
  responseSequence?: number;
  originalName: string;
  size: number;
  checksum: string;
};

export type ConfirmationEmpImportZipFile = ConfirmationEmpImportSourceFile & {
  finalName: string;
  zipPath: string;
};

export type ConfirmationEmpImportZipPlan = {
  files: ConfirmationEmpImportZipFile[];
  manifestFileName: typeof CONFIRMATION_EMP_MANIFEST_FILE_NAME;
  manifestCsv: string;
};

export function buildConfirmationEmpImportFileName(
  file: ConfirmationEmpImportSourceFile,
  usedNames: Iterable<string> = []
) {
  if (file.zipEntryName?.trim()) {
    return buildConfirmationEmpImportZipChildName(file, usedNames);
  }
  const extension = getExtension(file.originalName);
  const sequence = formatSequence(file.internalSequence);
  const counterparty = normalizeCounterparty(file.counterparty);
  const role = formatRole(file);
  const fixedNamePart = `${sequence}--${role}.${extension}`;
  const availableCounterpartyLength = Math.max(
    1,
    MAX_CONFIRMATION_EMP_FILE_NAME_LENGTH - fixedNamePart.length
  );
  const stem = `${sequence}-${truncate(
    counterparty,
    availableCounterpartyLength
  )}-${role}`;
  const initialName = `${stem}.${extension}`;
  const used = new Set(
    [...usedNames].map((name) => name.toLocaleLowerCase("en-US"))
  );
  if (!used.has(initialName.toLocaleLowerCase("en-US"))) {
    return initialName;
  }

  for (let duplicate = 2; ; duplicate += 1) {
    const suffix = `-${String(duplicate).padStart(2, "0")}`;
    const duplicateStem = `${truncate(
      stem,
      MAX_CONFIRMATION_EMP_FILE_NAME_LENGTH -
        suffix.length -
        extension.length -
        1
    )}${suffix}`;
    const candidate = `${duplicateStem}.${extension}`;
    if (!used.has(candidate.toLocaleLowerCase("en-US"))) {
      return candidate;
    }
  }
}

function buildConfirmationEmpImportZipChildName(
  file: ConfirmationEmpImportSourceFile,
  usedNames: Iterable<string>
) {
  const safeName = (file.zipEntryName ?? "")
    .trim()
    .replaceAll(/[<>:"/\\|?*\p{Cc}]/gu, "_")
    .replaceAll(/^\.+/g, "");
  const extension = getExtension(safeName || file.originalName);
  const rawStem = safeName.toLowerCase().endsWith(`.${extension}`)
    ? safeName.slice(0, -(extension.length + 1))
    : safeName;
  const stem = rawStem || formatSequence(file.internalSequence);
  const used = new Set(
    [...usedNames].map((name) => name.toLocaleLowerCase("en-US"))
  );
  for (let duplicate = 1; ; duplicate += 1) {
    const suffix =
      duplicate === 1 ? "" : `-${String(duplicate).padStart(2, "0")}`;
    const candidate = `${truncate(stem, MAX_CONFIRMATION_EMP_FILE_NAME_LENGTH - extension.length - suffix.length - 1)}${suffix}.${extension}`;
    if (!used.has(candidate.toLocaleLowerCase("en-US"))) return candidate;
  }
}

export function buildConfirmationEmpImportZipPlan(
  sourceFiles: readonly ConfirmationEmpImportSourceFile[]
): ConfirmationEmpImportZipPlan {
  const usedNames = new Set<string>();
  const files = sourceFiles.map((file) => {
    const finalName = buildConfirmationEmpImportFileName(file, usedNames);
    usedNames.add(finalName.toLocaleLowerCase("en-US"));
    return { ...file, finalName, zipPath: finalName };
  });
  return {
    files,
    manifestFileName: CONFIRMATION_EMP_MANIFEST_FILE_NAME,
    manifestCsv: buildConfirmationEmpImportManifestCsv(files),
  };
}

export function buildConfirmationEmpImportManifestCsv(
  files: readonly ConfirmationEmpImportZipFile[]
) {
  const header = [
    "内部序号",
    "源函证代码",
    "对方",
    "角色",
    "最终名",
    "原名",
    "大小",
    "checksum",
  ];
  const rows = files.map((file) => [
    formatSequence(file.internalSequence),
    file.sourceConfirmationCode,
    file.counterparty,
    formatRole(file),
    file.finalName,
    file.originalName,
    String(file.size),
    file.checksum,
  ]);
  return [header, ...rows]
    .map((row) =>
      row.map((value) => escapeCsvValue(encodeManifestCell(value))).join(",")
    )
    .join("\r\n");
}

export function decodeConfirmationEmpImportManifestCell(value: string) {
  return value.startsWith(CONFIRMATION_EMP_MANIFEST_TEXT_MARKER)
    ? value.slice(CONFIRMATION_EMP_MANIFEST_TEXT_MARKER.length)
    : value;
}

function formatSequence(sequence: number) {
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new Error("internalSequence must be a positive integer");
  }
  return String(sequence).padStart(3, "0");
}

function formatRole(file: ConfirmationEmpImportSourceFile) {
  if (file.role === "OUTGOING") {
    return "Outgoing";
  }
  const responseSequence = file.responseSequence ?? 1;
  if (!Number.isSafeInteger(responseSequence) || responseSequence < 1) {
    throw new Error("responseSequence must be a positive integer");
  }
  return `Response-${String(responseSequence).padStart(2, "0")}-Original`;
}

function normalizeCounterparty(value: string) {
  const normalized = value
    .normalize("NFKC")
    .replaceAll(/[^\p{L}\p{N}\s_-]/gu, "-")
    .replaceAll(/\s+/g, " ")
    .replaceAll(/\s*-\s*/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^[-\s]+|[-\s]+$/g, "");
  return normalized || "Counterparty";
}

function getExtension(originalName: string) {
  const baseName = originalName.split(/[\\/]/).pop() ?? "";
  const extensionStart = baseName.lastIndexOf(".");
  const extension =
    extensionStart > 0 ? baseName.slice(extensionStart + 1) : "";
  const normalized = extension
    .normalize("NFKC")
    .replaceAll(/[^A-Za-z0-9]/g, "")
    .toLowerCase();
  return normalized ? truncate(normalized, 32) : "bin";
}

function truncate(value: string, maxLength: number) {
  return [...value].slice(0, Math.max(1, maxLength)).join("");
}

function escapeCsvValue(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function encodeManifestCell(value: string) {
  const needsTextMarker =
    /^[\s]*[=+\-@]/.test(value) ||
    value.startsWith(CONFIRMATION_EMP_MANIFEST_TEXT_MARKER);
  return needsTextMarker
    ? `${CONFIRMATION_EMP_MANIFEST_TEXT_MARKER}${value}`
    : value;
}
