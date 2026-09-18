import { z } from "zod";

export const DESKTOP_AGENT_MASTER_OPEN_SUPPORTED_EXTENSIONS = [
  ".xlsx",
  ".xls",
  ".xlsm",
  ".xlsb",
  ".csv",
  ".tsv",
  ".docx",
  ".doc",
  ".pptx",
  ".ppt",
  ".pdf",
] as const;

export const DESKTOP_AGENT_READ_ONLY_OPEN_SUPPORTED_EXTENSIONS = [
  ...DESKTOP_AGENT_MASTER_OPEN_SUPPORTED_EXTENSIONS,
  ".pdf",
] as const;

export const DESKTOP_AGENT_OPEN_SUPPORTED_EXTENSIONS =
  DESKTOP_AGENT_MASTER_OPEN_SUPPORTED_EXTENSIONS;

export function isDesktopAgentOpenSupportedFileName(
  fileName: string,
  mode: "MASTER" | "READ_ONLY" = "MASTER"
) {
  const supportedExtensions =
    mode === "READ_ONLY"
      ? DESKTOP_AGENT_READ_ONLY_OPEN_SUPPORTED_EXTENSIONS
      : DESKTOP_AGENT_MASTER_OPEN_SUPPORTED_EXTENSIONS;
  return hasSupportedExtension(fileName, supportedExtensions);
}

function hasSupportedExtension(
  fileName: string,
  supportedExtensions: readonly string[]
) {
  const normalized = fileName.trim().toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");
  if (dotIndex <= 0) {
    return false;
  }
  return supportedExtensions.includes(normalized.slice(dotIndex));
}

export const DesktopAgentModeSchema = z.enum(["MASTER", "READ_ONLY"]);
export type DesktopAgentMode = z.infer<typeof DesktopAgentModeSchema>;

export const PROJECT_WING_DESKTOP_AGENT_CLIENT_ID =
  "project-wing-desktop-agent";

const DesktopAgentAuthBaseUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine(
    (value) => {
      const url = new URL(value);
      return (
        (url.protocol === "http:" || url.protocol === "https:") &&
        (url.pathname === "/" || url.pathname === "") &&
        !url.search &&
        !url.hash
      );
    },
    { message: "Auth URL must be an HTTP(S) origin" }
  );

export const DesktopAgentStartDevicePairSchema = z.object({
  clientId: z.literal(PROJECT_WING_DESKTOP_AGENT_CLIENT_ID),
  deviceCode: z.string().trim().min(1).max(512),
  authBaseUrl: DesktopAgentAuthBaseUrlSchema,
  expiresInSeconds: z
    .number()
    .int()
    .positive()
    .max(30 * 60),
  intervalSeconds: z.number().int().positive().max(60),
});
export type DesktopAgentStartDevicePair = z.infer<
  typeof DesktopAgentStartDevicePairSchema
>;

export const DesktopAgentDeviceAuthStatusResponseSchema = z.object({
  ok: z.literal(true),
  authenticated: z.boolean(),
  pairing: z.boolean(),
  lastError: z.literal("DEVICE_AUTHORIZATION_FAILED").optional(),
});
export type DesktopAgentDeviceAuthStatusResponse = z.infer<
  typeof DesktopAgentDeviceAuthStatusResponseSchema
>;

const HttpUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => {
      const { protocol } = new URL(value);
      return protocol === "http:" || protocol === "https:";
    },
    { message: "URL must use HTTP or HTTPS" }
  );

export const DesktopAgentOpenRequestSchema = z
  .object({
    requestId: z.string().trim().min(1).max(128).optional(),
    mode: DesktopAgentModeSchema,
    projectId: z.string().trim().min(1),
    attachmentId: z.string().trim().min(1),
    fileName: z.string().trim().min(1),
    downloadUrl: HttpUrlSchema,
    heartbeatUrl: HttpUrlSchema.optional(),
    checkInUrl: HttpUrlSchema.optional(),
    releaseUrl: HttpUrlSchema.optional(),
    lockSessionId: z.string().trim().min(1).optional(),
    baseVersion: z.number().int().positive().optional(),
    baseVersionId: z.string().trim().min(1).optional(),
    lockEpoch: z.number().int().nonnegative().optional(),
    cacheVersionId: z.string().trim().min(1).optional(),
    cacheOwnerId: z.string().trim().min(1).optional(),
    fileSize: z.number().int().nonnegative().optional(),
    mimeType: z.string().trim().min(1).optional(),
    grantSecret: z.string().trim().min(1).optional(),
    contentToken: z.string().trim().min(1).max(128).optional(),
    contentHash: z
      .string()
      .trim()
      .regex(/^[a-f0-9]{64}$/i)
      .optional(),
    directUploadSupported: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (value.mode !== "MASTER") {
      return;
    }
    if (!value.lockSessionId) {
      context.addIssue({
        code: "custom",
        message: "Master sessions require lockSessionId",
        path: ["lockSessionId"],
      });
    }
    if (!value.baseVersion) {
      context.addIssue({
        code: "custom",
        message: "Master sessions require baseVersion",
        path: ["baseVersion"],
      });
    }
    if (!value.grantSecret) {
      context.addIssue({
        code: "custom",
        message: "Master sessions require grantSecret",
        path: ["grantSecret"],
      });
    }
  });
export type DesktopAgentOpenRequest = z.infer<
  typeof DesktopAgentOpenRequestSchema
>;

export const DesktopAgentPrinterSchema = z.object({
  name: z.string().trim().min(1),
  isDefault: z.boolean(),
  isOffline: z.boolean(),
});
export type DesktopAgentPrinter = z.infer<typeof DesktopAgentPrinterSchema>;

export const DesktopAgentPrintersResponseSchema = z.object({
  ok: z.literal(true),
  printers: z.array(DesktopAgentPrinterSchema),
});
export type DesktopAgentPrintersResponse = z.infer<
  typeof DesktopAgentPrintersResponseSchema
>;

export const DesktopAgentPrintDocumentSchema = z.object({
  id: z.string().trim().min(1),
  fileName: z.string().trim().min(1),
  downloadUrl: HttpUrlSchema,
});
export type DesktopAgentPrintDocument = z.infer<
  typeof DesktopAgentPrintDocumentSchema
>;

export const DesktopAgentPrintRequestSchema = z.object({
  printerName: z.string().trim().min(1),
  documents: z.array(DesktopAgentPrintDocumentSchema).min(1).max(100),
});
export type DesktopAgentPrintRequest = z.infer<
  typeof DesktopAgentPrintRequestSchema
>;

export const DesktopAgentPrintResponseSchema = z.object({
  ok: z.literal(true),
  printerName: z.string().trim().min(1),
  printed: z.array(
    z.object({
      id: z.string().trim().min(1),
      fileName: z.string().trim().min(1),
    })
  ),
});
export type DesktopAgentPrintResponse = z.infer<
  typeof DesktopAgentPrintResponseSchema
>;

const DesktopAgentOfficeAppHealthDiagnosticsSchema = z.object({
  status: z.enum(["OK", "NEEDS_ATTENTION", "MISSING", "SKIPPED", "UNKNOWN"]),
  installed: z.boolean().optional(),
  checkedAt: z.string().datetime(),
  comAutomation: z.enum(["AVAILABLE", "UNAVAILABLE", "SKIPPED", "UNKNOWN"]),
  hiddenAutomationProcessCount: z.number().int().nonnegative(),
  hiddenAutomationProcessIds: z
    .array(z.number().int().nonnegative())
    .optional(),
  hresult: z.number().int().optional(),
  message: z.string().trim().min(1).optional(),
  recommendedAction: z.string().trim().min(1).optional(),
});
const DesktopAgentPdfEditorHealthDiagnosticsSchema = z.object({
  status: z.enum(["OK", "MISSING", "SKIPPED", "UNKNOWN"]),
  installed: z.boolean().optional(),
  trustedEditor: z.boolean().optional(),
  checkedAt: z.string().datetime(),
  editorPath: z.string().trim().min(1).optional(),
  message: z.string().trim().min(1).optional(),
  recommendedAction: z.string().trim().min(1).optional(),
});

export const DesktopAgentHealthDiagnosticsSchema = z.object({
  excel: DesktopAgentOfficeAppHealthDiagnosticsSchema.optional(),
  word: DesktopAgentOfficeAppHealthDiagnosticsSchema.optional(),
  powerPoint: DesktopAgentOfficeAppHealthDiagnosticsSchema.optional(),
  pdfEditor: DesktopAgentPdfEditorHealthDiagnosticsSchema.optional(),
});
export type DesktopAgentHealthDiagnostics = z.infer<
  typeof DesktopAgentHealthDiagnosticsSchema
>;

const DesktopAgentVersionSchema = z.string().trim().min(1);

export const DesktopRuntimeAgentStateSchema = z.enum([
  "NOT_INSTALLED",
  "STARTING",
  "READY",
  "UPDATING",
  "RESTORING",
  "READY_WITH_ATTENTION",
  "DEGRADED_NEEDS_ATTENTION",
  "FAILED",
]);
export type DesktopRuntimeAgentState = z.infer<
  typeof DesktopRuntimeAgentStateSchema
>;

export const DesktopRuntimeUpdateStateSchema = z.enum([
  "IDLE",
  "UPDATE_REQUESTED",
  "PREPARING_AGENT",
  "SNAPSHOT_RECEIVED",
  "STOPPING_AGENT",
  "AGENT_STOPPED",
  "STAGING_PAYLOAD",
  "VERIFYING_PAYLOAD",
  "SWITCHING_ACTIVE_VERSION",
  "STARTING_AGENT",
  "RESTORING_AGENT",
  "VERIFYING_READY",
  "READY",
  "FAILED",
]);
export type DesktopRuntimeUpdateState = z.infer<
  typeof DesktopRuntimeUpdateStateSchema
>;

export const DesktopRuntimeRestoreStateSchema = z.enum([
  "NOT_STARTED",
  "READY",
  "READY_WITH_ATTENTION",
  "DEGRADED_NEEDS_ATTENTION",
  "FAILED",
]);
export type DesktopRuntimeRestoreState = z.infer<
  typeof DesktopRuntimeRestoreStateSchema
>;

const LegacyDesktopAgentHealthResponseSchema = z.object({
  ok: z.literal(true),
  app: z.literal("project-wing-desktop-agent"),
  version: DesktopAgentVersionSchema,
  diagnostics: DesktopAgentHealthDiagnosticsSchema.optional(),
});
const ManagedDesktopRuntimeHealthResponseSchema = z.object({
  ok: z.literal(true),
  app: z.literal("project-wing-desktop-runtime"),
  version: DesktopAgentVersionSchema,
  managerVersion: DesktopAgentVersionSchema,
  agentVersion: DesktopAgentVersionSchema.optional(),
  managerState: z.string().trim().min(1).optional(),
  workerPid: z.number().int().positive().nullable().optional(),
  restartCount: z.number().int().nonnegative().optional(),
  requiredAgentVersion: DesktopAgentVersionSchema.optional(),
  agentState: DesktopRuntimeAgentStateSchema,
  updateState: DesktopRuntimeUpdateStateSchema,
  restoreState: DesktopRuntimeRestoreStateSchema,
  attentionCount: z.number().int().nonnegative(),
  quarantineCount: z.number().int().nonnegative().optional(),
  diagnostics: DesktopAgentHealthDiagnosticsSchema.optional(),
});

export const DesktopAgentHealthResponseSchema = z.discriminatedUnion("app", [
  LegacyDesktopAgentHealthResponseSchema,
  ManagedDesktopRuntimeHealthResponseSchema,
]);
export type DesktopAgentHealthResponse = z.infer<
  typeof DesktopAgentHealthResponseSchema
>;

export const DesktopAgentOpenResponseSchema = z.object({
  ok: z.literal(true),
  requestId: z.string().trim().min(1).max(128).optional(),
  sessionId: z.string().trim().min(1),
  localPath: z.string().trim().min(1),
  openedAt: z.string().datetime(),
});
export type DesktopAgentOpenResponse = z.infer<
  typeof DesktopAgentOpenResponseSchema
>;

export const DesktopAgentErrorResponseSchema = z.object({
  ok: z.literal(false),
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
});
export type DesktopAgentErrorResponse = z.infer<
  typeof DesktopAgentErrorResponseSchema
>;

export const DesktopAgentSessionStatusSchema = z.enum([
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
export type DesktopAgentSessionStatus = z.infer<
  typeof DesktopAgentSessionStatusSchema
>;

export const DesktopAgentSessionLifecycleStateSchema = z.enum([
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
export type DesktopAgentSessionLifecycleState = z.infer<
  typeof DesktopAgentSessionLifecycleStateSchema
>;

export const DesktopAgentSessionContentStateSchema = z.enum([
  "UNCHANGED",
  "DIRTY",
  "UPLOADED",
  "MISSING",
]);
export type DesktopAgentSessionContentState = z.infer<
  typeof DesktopAgentSessionContentStateSchema
>;

export const DesktopAgentOpenObservationSourceSchema = z.enum([
  "WATCHER_COM",
  "WATCHER_FILE_LOCK",
  "MONITOR_COM",
  "MONITOR_FILE_LOCK",
  "MONITOR_PROCESS",
  "LAUNCHER_PROCESS",
  "MANUAL",
]);
export type DesktopAgentOpenObservationSource = z.infer<
  typeof DesktopAgentOpenObservationSourceSchema
>;

export const DesktopAgentOpenObservedRequestSchema = z.object({
  generation: z.number().int().positive().default(1),
  openSignalToken: z.string().trim().min(1),
  source: DesktopAgentOpenObservationSourceSchema,
});
export type DesktopAgentOpenObservedRequest = z.infer<
  typeof DesktopAgentOpenObservedRequestSchema
>;

export const DesktopAgentLaunchFailedReasonSchema = z.enum([
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
export type DesktopAgentLaunchFailedReason = z.infer<
  typeof DesktopAgentLaunchFailedReasonSchema
>;

export const DesktopAgentLaunchFailedRequestSchema = z.object({
  generation: z.number().int().positive().default(1),
  openSignalToken: z.string().trim().min(1),
  reason: DesktopAgentLaunchFailedReasonSchema,
  message: z.string().trim().min(1).max(500).optional(),
});
export type DesktopAgentLaunchFailedRequest = z.infer<
  typeof DesktopAgentLaunchFailedRequestSchema
>;

export const DesktopAgentCloseDetectionSourceSchema = z.enum([
  "WATCHER",
  "MONITOR",
  "MANUAL",
]);
export type DesktopAgentCloseDetectionSource = z.infer<
  typeof DesktopAgentCloseDetectionSourceSchema
>;

export const DesktopAgentClosedRequestSchema = z.object({
  generation: z.number().int().positive().default(1),
  closeSignalToken: z.string().trim().min(1),
  source: DesktopAgentCloseDetectionSourceSchema.default("WATCHER"),
});
export type DesktopAgentClosedRequest = z.infer<
  typeof DesktopAgentClosedRequestSchema
>;

export const DesktopAgentLaunchAbortReleaseRequestSchema = z.object({
  generation: z.number().int().positive().default(1),
  closeSignalToken: z.string().trim().min(1),
  confirmNoUserVisibleWorkbook: z.literal(true),
});
export type DesktopAgentLaunchAbortReleaseRequest = z.infer<
  typeof DesktopAgentLaunchAbortReleaseRequestSchema
>;

export const DesktopAgentPendingReleaseReasonSchema = z.enum([
  "CHECKED_IN",
  "UNCHANGED_RELEASE",
]);
export type DesktopAgentPendingReleaseReason = z.infer<
  typeof DesktopAgentPendingReleaseReasonSchema
>;

export function getDesktopAgentCompatibilityStatus(input: {
  lifecycleState: DesktopAgentSessionLifecycleState;
  contentState: DesktopAgentSessionContentState;
}): DesktopAgentSessionStatus {
  switch (input.lifecycleState) {
    case "LAUNCHING":
    case "OPEN":
    case "OPEN_NOT_OBSERVED":
    case "LAUNCH_FAILED":
    case "CLOSE_DETECTED": {
      return input.contentState === "DIRTY"
        ? "DIRTY_PENDING_CHECKIN"
        : input.contentState === "MISSING"
          ? "LOCAL_FILE_MISSING"
          : "OPEN_UNCHANGED";
    }
    case "CHECKING_IN": {
      return "CHECKING_IN";
    }
    case "CHECKIN_FAILED": {
      return "CHECKIN_FAILED";
    }
    case "RELEASE_PENDING": {
      return "RELEASE_PENDING";
    }
    case "RELEASING": {
      return "RELEASING";
    }
    case "RELEASE_FAILED": {
      return "RELEASE_FAILED";
    }
    case "CLEANUP_PENDING": {
      return "CLEANUP_PENDING";
    }
    case "CLEANUP_FAILED": {
      return "CLEANUP_FAILED";
    }
    case "CLOSED": {
      return "CLOSED";
    }
    case "LOCAL_FILE_MISSING": {
      return "LOCAL_FILE_MISSING";
    }
    case "CONFLICT_RISK": {
      return "CONFLICT_RISK";
    }
    case "LEASE_LOST": {
      return "LEASE_LOST";
    }
    case "LOCK_REVOKED": {
      return "LOCK_REVOKED";
    }
    case "SERVER_FILE_REMOVED": {
      return "SERVER_FILE_REMOVED";
    }
    default: {
      return assertNeverDesktopAgentState(input.lifecycleState);
    }
  }
}

function assertNeverDesktopAgentState(value: never): never {
  throw new Error(`Unhandled desktop agent lifecycle state: ${value}`);
}

export const DesktopAgentSessionSchema = z.object({
  sessionId: z.string().trim().min(1),
  generation: z.number().int().positive().default(1),
  lockSessionId: z.string().trim().min(1).optional(),
  mode: DesktopAgentModeSchema,
  projectId: z.string().trim().min(1),
  attachmentId: z.string().trim().min(1),
  fileName: z.string().trim().min(1),
  localPath: z.string().trim().min(1),
  baseVersion: z.number().int().positive().optional(),
  baseVersionId: z.string().trim().min(1).optional(),
  lockEpoch: z.number().int().nonnegative().optional(),
  cacheVersionId: z.string().trim().min(1).optional(),
  cacheOwnerId: z.string().trim().min(1).optional(),
  fileSize: z.number().int().nonnegative().optional(),
  mimeType: z.string().trim().min(1).optional(),
  contentHash: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/i)
    .optional(),
  directUploadSupported: z.boolean().optional(),
  heartbeatUrl: HttpUrlSchema.optional(),
  checkInUrl: HttpUrlSchema.optional(),
  releaseUrl: HttpUrlSchema.optional(),
  originalHash: z.string().trim().min(1),
  lastKnownHash: z.string().trim().min(1),
  lastUploadedHash: z.string().trim().min(1).optional(),
  grantSecret: z.string().trim().min(1).optional(),
  status: DesktopAgentSessionStatusSchema,
  lifecycleState: DesktopAgentSessionLifecycleStateSchema,
  contentState: DesktopAgentSessionContentStateSchema,
  openedAt: z.string().datetime(),
  launchStartedAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  lastHeartbeatAt: z.string().datetime().optional(),
  leaseLostAt: z.string().datetime().optional(),
  openObservedAt: z.string().datetime().optional(),
  openObservedSource: DesktopAgentOpenObservationSourceSchema.optional(),
  launchFailedReason: DesktopAgentLaunchFailedReasonSchema.optional(),
  closeDetectedAt: z.string().datetime().optional(),
  closeDetectedSource: DesktopAgentCloseDetectionSourceSchema.optional(),
  openSignalToken: z.string().trim().min(1).optional(),
  closeSignalToken: z.string().trim().min(1).optional(),
  excelHelperProcessId: z.number().int().positive().optional(),
  pendingReleaseReason: DesktopAgentPendingReleaseReasonSchema.optional(),
  pendingReleaseHash: z.string().trim().min(1).optional(),
  lastObservationAt: z.string().datetime().optional(),
  lastObservationDiagnostic: z.string().trim().min(1).optional(),
  lastUploadAttemptAt: z.string().datetime().optional(),
  checkInSnapshot: z
    .object({
      snapshotId: z.string().trim().min(1),
      path: z.string().trim().min(1),
      fileSize: z.number().int().nonnegative(),
      contentHash: z
        .string()
        .trim()
        .regex(/^[a-f0-9]{64}$/i),
      contentCrc64: z.string().trim().regex(/^\d+$/).optional(),
      createdAt: z.string().datetime(),
    })
    .optional(),
  uploadCheckpoint: z
    .object({
      localContentHash: z.string().trim().min(1),
      localContentCrc64: z.string().trim().regex(/^\d+$/).optional(),
      fileSize: z.number().int().nonnegative(),
      objectKey: z.string().trim().min(1),
      uploadAttemptId: z
        .string()
        .trim()
        .regex(/^[a-zA-Z0-9_-]{1,64}$/)
        .optional(),
      uploadId: z.string().trim().min(1).optional(),
      partSize: z.number().int().positive().optional(),
      lastTransferStatus: z.number().int().min(100).max(599).optional(),
      lastTransferErrorCode: z.string().trim().min(1).optional(),
      lastTransferRequestId: z.string().trim().min(1).optional(),
      completedParts: z.array(
        z.object({
          partNumber: z.number().int().positive(),
          etag: z.string().trim().min(1),
        })
      ),
    })
    .optional(),
  lastReleaseAttemptAt: z.string().datetime().optional(),
  lastCleanupAttemptAt: z.string().datetime().optional(),
  retryCount: z.number().int().nonnegative().optional(),
  lastError: z.string().trim().min(1).optional(),
});
export type DesktopAgentSession = z.infer<typeof DesktopAgentSessionSchema>;

export const DesktopAgentRecentSessionSchema = z.object({
  projectId: z.string().trim().min(1),
  attachmentId: z.string().trim().min(1),
  fileName: z.string().trim().min(1),
  mode: DesktopAgentModeSchema,
  openedAt: z.string().datetime(),
  closedAt: z.string().datetime(),
});
export type DesktopAgentRecentSession = z.infer<
  typeof DesktopAgentRecentSessionSchema
>;

const DesktopDirectUploadPartSchema = z.object({
  partNumber: z.number().int().positive(),
  uploadUrl: HttpUrlSchema,
});

export const DesktopUploadGrantSchema = z.discriminatedUnion("mode", [
  z.object({ ok: z.literal(true), mode: z.literal("PROXY") }),
  z.object({
    ok: z.literal(true),
    mode: z.literal("ALREADY_UPLOADED"),
    objectKey: z.string().trim().min(1),
  }),
  z.object({
    ok: z.literal(true),
    mode: z.literal("DIRECT_PUT"),
    objectKey: z.string().trim().min(1),
    uploadUrl: HttpUrlSchema,
    headers: z.record(z.string(), z.string()),
    expiresAt: z.string().datetime(),
  }),
  z.object({
    ok: z.literal(true),
    mode: z.literal("DIRECT_MULTIPART"),
    objectKey: z.string().trim().min(1),
    uploadId: z.string().trim().min(1),
    partSize: z.number().int().positive(),
    parts: z.array(DesktopDirectUploadPartSchema).min(1),
    uploadedParts: z
      .array(
        z.object({
          partNumber: z.number().int().positive(),
          etag: z.string().trim().min(1),
        })
      )
      .default([]),
    expiresAt: z.string().datetime(),
  }),
]);
export type DesktopUploadGrant = z.infer<typeof DesktopUploadGrantSchema>;

export const DesktopAgentSessionsResponseSchema = z.object({
  ok: z.literal(true),
  sessions: z.array(DesktopAgentSessionSchema),
  recentSessions: z.array(DesktopAgentRecentSessionSchema).default([]),
});
export type DesktopAgentSessionsResponse = z.infer<
  typeof DesktopAgentSessionsResponseSchema
>;

export const DesktopAgentCheckInRequestSchema = z.object({
  sessionId: z.string().trim().min(1),
  checkInUrl: HttpUrlSchema.optional(),
  releaseUrl: HttpUrlSchema,
  uploadUrl: HttpUrlSchema.optional(),
});
export type DesktopAgentCheckInRequest = z.infer<
  typeof DesktopAgentCheckInRequestSchema
>;

export const DesktopAgentCheckInResponseSchema = z.object({
  ok: z.literal(true),
  session: DesktopAgentSessionSchema,
});
export type DesktopAgentCheckInResponse = z.infer<
  typeof DesktopAgentCheckInResponseSchema
>;

export const DesktopAgentReleaseRequestSchema = z.object({
  sessionId: z.string().trim().min(1),
  releaseUrl: HttpUrlSchema,
});
export type DesktopAgentReleaseRequest = z.infer<
  typeof DesktopAgentReleaseRequestSchema
>;

export const DesktopAgentReleaseResponseSchema = z.object({
  ok: z.literal(true),
  session: DesktopAgentSessionSchema,
});
export type DesktopAgentReleaseResponse = z.infer<
  typeof DesktopAgentReleaseResponseSchema
>;

export const DesktopAgentUpdateStatusSchema = z.enum([
  "STARTED",
  "IN_PROGRESS",
  "WAITING_FOR_WORKBOOK_CLOSE",
  "CHECKING_IN",
  "RELEASING",
  "RELEASING_SESSIONS",
  "DOWNLOADING",
  "VERIFYING_INSTALLER",
  "STOPPING_AGENT",
  "REPAIRING_ENVIRONMENT",
  "INSTALLING",
  "STARTING_AGENT",
  "RESTARTING",
  "VERIFYING_HEALTH",
  "READY",
  "FAILED",
]);
export type DesktopAgentUpdateStatus = z.infer<
  typeof DesktopAgentUpdateStatusSchema
>;

export const DesktopAgentUpdateErrorCodeSchema = z.enum([
  "ACTIVE_MASTER_SESSIONS",
  "MASTER_RELEASE_FAILED",
  "DOWNLOAD_FAILED",
  "INSTALLER_VERIFY_FAILED",
  "INSTALLER_START_FAILED",
  "DISK_FULL",
  "ACCESS_DENIED",
  "PORT_STILL_BUSY",
  "HEALTH_TIMEOUT",
  "REGISTRATION_FAILED",
  "ROLLBACK_FAILED",
  "UNKNOWN_ERROR",
]);
export type DesktopAgentUpdateErrorCode = z.infer<
  typeof DesktopAgentUpdateErrorCodeSchema
>;

const DesktopAgentVersionStringSchema = z
  .string()
  .trim()
  .regex(/^\d+\.\d+\.\d+(?:[-+].*)?$/);

export const DesktopAgentWindowsSignaturePolicySchema = z.enum([
  "required",
  "optional",
]);
export type DesktopAgentWindowsSignaturePolicy = z.infer<
  typeof DesktopAgentWindowsSignaturePolicySchema
>;

export const DesktopAgentReleaseManifestSchema = z.object({
  version: DesktopAgentVersionStringSchema,
  platform: z.literal("windows"),
  architecture: z.literal("x64"),
  downloadUrl: HttpUrlSchema,
  sha256: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/i),
  fileSize: z.number().int().positive(),
  publishedAt: z.string().datetime(),
  minimumSupportedVersion: DesktopAgentVersionStringSchema,
  minimumSelfUpdateVersion: DesktopAgentVersionStringSchema,
  signaturePolicy: DesktopAgentWindowsSignaturePolicySchema.default("required"),
});
export type DesktopAgentReleaseManifest = z.infer<
  typeof DesktopAgentReleaseManifestSchema
>;

export const DesktopAgentUpdateRequestSchema = z
  .object({
    expectedVersion: DesktopAgentVersionStringSchema,
    expectedSha256: z
      .string()
      .trim()
      .regex(/^[a-f0-9]{64}$/i),
    expectedFileSize: z.number().int().positive(),
    downloadUrl: HttpUrlSchema.optional(),
    signaturePolicy:
      DesktopAgentWindowsSignaturePolicySchema.default("required"),
  })
  .transform((value) => ({
    expectedVersion: value.expectedVersion,
    expectedSha256: value.expectedSha256.toLowerCase(),
    expectedFileSize: value.expectedFileSize,
    signaturePolicy: value.signaturePolicy,
    ...(value.downloadUrl ? { downloadUrl: value.downloadUrl } : {}),
  }));
export type DesktopAgentUpdateRequest = z.infer<
  typeof DesktopAgentUpdateRequestSchema
>;

export const DesktopAgentUpdateResponseSchema = z.object({
  ok: z.literal(true),
  status: DesktopAgentUpdateStatusSchema,
  taskId: z.string().trim().min(1).optional(),
  downloadUrl: HttpUrlSchema.optional(),
  message: z.string().trim().min(1).optional(),
  errorCode: DesktopAgentUpdateErrorCodeSchema.optional(),
  expectedVersion: DesktopAgentVersionStringSchema.optional(),
  currentVersion: DesktopAgentVersionStringSchema.optional(),
  startedAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  reportPath: z.string().trim().min(1).optional(),
  stage: DesktopAgentUpdateStatusSchema.optional(),
});
export type DesktopAgentUpdateResponse = z.infer<
  typeof DesktopAgentUpdateResponseSchema
>;

export const DesktopAgentUpdateStatusResponseSchema =
  DesktopAgentUpdateResponseSchema;
export type DesktopAgentUpdateStatusResponse = z.infer<
  typeof DesktopAgentUpdateStatusResponseSchema
>;
