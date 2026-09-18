import type { DesktopAgentErrorResponse } from "@project-wing/shared/desktop";

export class DesktopAgentError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "DesktopAgentError";
  }
}

export function toAgentErrorResponse(
  error: DesktopAgentError
): DesktopAgentErrorResponse {
  return {
    ok: false,
    code: error.code,
    message: error.message,
  };
}

export function getStatusForAgentError(error: DesktopAgentError) {
  if (error.code === "VALIDATION_FAILED") {
    return 400;
  }
  if (error.code === "UNSUPPORTED_FILE_TYPE") {
    return 400;
  }
  if (error.code === "ORIGIN_NOT_ALLOWED") {
    return 403;
  }
  if (error.code === "DOWNLOAD_FAILED") {
    return 502;
  }
  if (error.code === "DOWNLOAD_INTEGRITY_FAILED") {
    return 502;
  }
  if (error.code === "PRINT_FAILED") {
    return 502;
  }
  if (error.code === "UPLOAD_FAILED") {
    return 502;
  }
  if (error.code === "DIRECT_UPLOAD_RETRY_REQUIRED") {
    return 503;
  }
  if (error.code === "RELEASE_FAILED") {
    return 502;
  }
  if (error.code === "SESSION_NOT_FOUND") {
    return 404;
  }
  if (error.code === "DESKTOP_AGENT_STORAGE_FULL") {
    return 507;
  }
  if (error.code === "LOCAL_STORAGE_PERMISSION_DENIED") {
    return 403;
  }
  if (error.code === "LOCAL_FILE_MISSING") {
    return 409;
  }
  if (error.code === "LOCAL_FILE_BUSY") {
    return 409;
  }
  if (error.code === "CLEANUP_FAILED") {
    return 409;
  }
  if (error.code === "CONFLICT_RISK") {
    return 409;
  }
  if (error.code === "CACHE_RECOVERY_UNSAFE") {
    return 409;
  }
  if (error.code === "LOCK_REVOKED") {
    return 409;
  }
  if (error.code === "LOCK_SESSION_MISMATCH") {
    return 409;
  }
  if (error.code === "CHECK_IN_IN_PROGRESS") {
    return 409;
  }
  if (error.code === "PDF_EDITOR_UNAVAILABLE") {
    return 409;
  }
  if (error.code === "PRINTER_NOT_FOUND") {
    return 409;
  }
  if (error.code === "PRINTER_OFFLINE") {
    return 409;
  }
  if (error.code === "FILE_WRITE_FAILED") {
    return 500;
  }
  if (error.code === "OPEN_FAILED") {
    return 500;
  }
  if (error.code === "UPDATE_UNAVAILABLE") {
    return 501;
  }
  if (error.code === "UNSUPPORTED_PLATFORM") {
    return 501;
  }
  if (error.code === "PRINT_UNSUPPORTED") {
    return 501;
  }
  return 500;
}
