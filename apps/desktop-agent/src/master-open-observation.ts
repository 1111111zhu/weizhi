import pathModule from "node:path";

const { extname } = pathModule;

const EXCEL_EXTENSIONS = new Set([".csv", ".xls", ".xlsb", ".xlsm", ".xlsx"]);
const WORD_EXTENSIONS = new Set([".doc", ".docx"]);
const POWERPOINT_EXTENSIONS = new Set([".ppt", ".pptx"]);

export function getMasterOpenObservationTimeoutMessage(fileName?: string) {
  return `${getMasterOpenObservationSubject(fileName)} open was not observed before the launch observation timeout.`;
}

export function getMasterOpenObservationTimeoutMsForFileName(
  fileName: string,
  {
    masterTimeoutMs,
    pdfTimeoutMs,
  }: { masterTimeoutMs: number; pdfTimeoutMs: number }
) {
  return isPdfMasterFileName(fileName) ? pdfTimeoutMs : masterTimeoutMs;
}

export function getMasterLaunchFailedBeforeVisibleMessage(fileName?: string) {
  const subject = getMasterOpenObservationSubject(fileName);
  if (subject === "Excel") {
    return "Excel launch failed before the workbook was visible.";
  }
  return `${subject} launch failed before the file was visible.`;
}

function getMasterOpenObservationSubject(fileName?: string) {
  const extension = extname(fileName ?? "").toLowerCase();
  if (isPdfMasterFileName(fileName ?? "")) {
    return "PDF";
  }
  if (WORD_EXTENSIONS.has(extension)) {
    return "Word document";
  }
  if (POWERPOINT_EXTENSIONS.has(extension)) {
    return "PowerPoint presentation";
  }
  if (EXCEL_EXTENSIONS.has(extension)) {
    return "Excel";
  }
  return "Master file";
}

function isPdfMasterFileName(fileName: string) {
  return extname(fileName).toLowerCase() === ".pdf";
}
