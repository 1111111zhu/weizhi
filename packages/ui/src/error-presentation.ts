export type ProjectWingErrorPresentation = {
  title: string;
  description: string;
  code: string | null;
  requestId: string | null;
};

type CodedError = {
  code?: unknown;
  message?: unknown;
  name?: unknown;
  requestId?: unknown;
};

export const PROJECT_WING_DEFAULT_ERROR_TITLE = "Action could not be completed";
export const PROJECT_WING_DEFAULT_ERROR_MESSAGE =
  "Something went wrong. Please try again.";
export const PROJECT_WING_NETWORK_ERROR_MESSAGE =
  "Network connection failed. Check your connection and try again.";

const GENERIC_ERROR_MESSAGES = new Set([
  "an error occurred",
  "internal server error",
  "request failed",
  "something went wrong",
  "something went wrong. please try again.",
  "unknown error",
]);

const TECHNICAL_ERROR_PATTERNS = [
  /failed to fetch/i,
  /network ?error/i,
  /network request failed/i,
  /load failed/i,
  /fetch failed/i,
  /cors/i,
  /\b(?:ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN)\b/i,
  /\b(?:EACCES|EPERM|ENOENT|NoSuchKey|AccessDenied)\b/i,
  /\bTypeError:\s*/i,
  /\bat\s+\S+\s+\([^\n]+:\d+:\d+\)/i,
];

const ERROR_COPY: Record<string, { title: string; description: string }> = {
  BAD_REQUEST: {
    title: "Action unavailable",
    description: "This action could not be completed with the current data.",
  },
  DECLARATION_REQUIRED: {
    title: "Declaration required",
    description: "Please complete the required declaration first.",
  },
  DUPLICATE_CODE: {
    title: "Reference already in use",
    description: "Choose a different reference and try again.",
  },
  FORBIDDEN: {
    title: "Permission denied",
    description: "You do not have permission to perform this action.",
  },
  INTERNAL_SERVER_ERROR: {
    title: "Server error",
    description: "The server could not complete the request. Please try again.",
  },
  INVALID_CREDENTIALS: {
    title: "Sign-in failed",
    description: "The email or password is incorrect.",
  },
  NETWORK_FAILED: {
    title: "Connection problem",
    description: PROJECT_WING_NETWORK_ERROR_MESSAGE,
  },
  NOT_FOUND: {
    title: "Item not found",
    description: "The requested item could not be found.",
  },
  PREPARER_SIGNOFF_REQUIRED: {
    title: "Preparation required",
    description: "The file must be prepared before it can be reviewed.",
  },
  PROJECT_ARCHIVED: {
    title: "Project is read-only",
    description: "Archived projects cannot be changed.",
  },
  PROJECT_CODE_ALREADY_IN_USE: {
    title: "Project code unavailable",
    description: "Choose a different project code and try again.",
  },
  PROJECT_ENGAGEMENT_ALREADY_LINKED: {
    title: "Engagement already linked",
    description: "This engagement is already linked to another project.",
  },
  PROJECT_NOT_FOUND: {
    title: "Project not found",
    description: "The requested project could not be found.",
  },
  PROJECT_TEMPLATE_INITIALIZATION_FAILED: {
    title: "Project template unavailable",
    description:
      "The project template could not be initialized. Ask an administrator to verify its files, then try again.",
  },
  REQUEST_FAILED: {
    title: PROJECT_WING_DEFAULT_ERROR_TITLE,
    description: PROJECT_WING_DEFAULT_ERROR_MESSAGE,
  },
  REVIEW_SIGNOFF_COOLDOWN_ACTIVE: {
    title: "Review unavailable",
    description: "The same reviewer can sign this file again after 24 hours.",
  },
  SMART_FORM_INCOMPLETE: {
    title: "SmartForm incomplete",
    description: "Complete the required SmartForm fields before signing.",
  },
  UNAUTHORIZED: {
    title: "Session expired",
    description: "Your session has expired. Please sign in again.",
  },
  VALIDATION_FAILED: {
    title: "Check the information",
    description: "Please check the entered information and try again.",
  },
};

const FIXED_DESCRIPTION_CODES = new Set([
  "FORBIDDEN",
  "INTERNAL_SERVER_ERROR",
  "INVALID_CREDENTIALS",
  "NETWORK_FAILED",
  "UNAUTHORIZED",
]);

export function isProjectWingAbortError(error: unknown) {
  const codedError = readCodedError(error);
  return (
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "AbortError") ||
    codedError?.name === "AbortError" ||
    readErrorMessage(error).toLowerCase() === "aborted"
  );
}

export function isProjectWingNetworkError(error: unknown) {
  const code = readErrorCode(error);
  if (code) {
    return code === "NETWORK_FAILED";
  }

  const message = readErrorMessage(error);
  return Boolean(
    message && TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(message))
  );
}

export function sanitizeProjectWingErrorDescription(
  description: string | undefined,
  fallback = PROJECT_WING_DEFAULT_ERROR_MESSAGE
) {
  const value = description?.trim();
  if (!value) {
    return;
  }
  if (TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(value))) {
    return PROJECT_WING_NETWORK_ERROR_MESSAGE;
  }
  return value || fallback;
}

export function getProjectWingErrorPresentation(
  error: unknown,
  fallback = PROJECT_WING_DEFAULT_ERROR_MESSAGE
): ProjectWingErrorPresentation {
  const code = readErrorCode(error);
  const requestId = readRequestId(error);
  const isNetworkError = isProjectWingNetworkError(error);
  const resolvedCode = isNetworkError ? "NETWORK_FAILED" : code;
  const copy = resolvedCode ? ERROR_COPY[resolvedCode] : undefined;
  const message = readErrorMessage(error);
  const canShowMessage =
    Boolean(message) &&
    !GENERIC_ERROR_MESSAGES.has(message.toLowerCase()) &&
    !TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(message)) &&
    !(resolvedCode && FIXED_DESCRIPTION_CODES.has(resolvedCode));
  const description = appendRequestReference(
    canShowMessage ? message : (copy?.description ?? fallback),
    requestId
  );

  return {
    title: copy?.title ?? PROJECT_WING_DEFAULT_ERROR_TITLE,
    description,
    code: resolvedCode,
    requestId,
  };
}

function appendRequestReference(description: string, requestId: string | null) {
  if (!requestId) {
    return description;
  }
  return `${description} Reference: ${requestId}`;
}

function readCodedError(error: unknown): CodedError | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  return error as CodedError;
}

function readErrorCode(error: unknown) {
  const code = readCodedError(error)?.code;
  return typeof code === "string" && code.trim() ? code.trim() : null;
}

function readErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return error.trim();
  }
  const message = readCodedError(error)?.message;
  return typeof message === "string" ? message.trim() : "";
}

function readRequestId(error: unknown) {
  const requestId = readCodedError(error)?.requestId;
  return typeof requestId === "string" &&
    requestId.trim() &&
    requestId !== "unknown"
    ? requestId.trim()
    : null;
}
