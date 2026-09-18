import { startAgentRuntime } from "./agent-runtime.js";
import { createCacheIndex } from "./cache-index.js";
import {
  checkInDesktopSession,
  cleanupOrphanedCheckInSnapshots,
  releaseDesktopSession,
} from "./check-in-service.js";
import {
  DEFAULT_AGENT_PORT,
  getAgentRuntimeRole,
  getAgentWorkerPort,
  getCacheRoot,
} from "./config.js";
import { createDesktopAgentUpdater } from "./desktop-agent-updater.js";
import { createExcelDiagnosticsProvider } from "./excel-diagnostics.js";
import { isLocalFileBusy } from "./file-busy.js";
import { openDesktopFile } from "./file-session-service.js";
import { createAgentServer } from "./server.js";
import { startSessionMonitor } from "./session-monitor.js";
import { createSessionStore } from "./session-store.js";

const runtimeRole = getAgentRuntimeRole();
const port =
  runtimeRole === "worker"
    ? getAgentWorkerPort()
    : Number(process.env.PROJECT_WING_AGENT_PORT ?? DEFAULT_AGENT_PORT);
const sessionStore = createSessionStore();
const cacheIndex = createCacheIndex();
const cacheRoot = getCacheRoot();
let runtimeHealth:
  | {
      agentState: "RECOVERING";
    }
  | {
      agentState: "READY" | "READY_WITH_ATTENTION";
      recoveryMessage?: string;
      quarantinedSessionCount?: number;
    } = { agentState: "RECOVERING" };
const getHealthDiagnostics = createExcelDiagnosticsProvider();
const checkInWithSharedStore = (
  request: Parameters<typeof checkInDesktopSession>[0]
) =>
  checkInDesktopSession(request, {
    sessionStore,
    isLocalFileBusy,
    cacheIndex,
    cacheRoot,
  });
const updater = createDesktopAgentUpdater({
  sessionStore,
  checkInDesktopSession: checkInWithSharedStore,
  releaseDesktopSession: (request) =>
    releaseDesktopSession(request, { sessionStore, cacheIndex }),
});
const server = createAgentServer({
  sessionStore,
  openDesktopFile: (request) =>
    openDesktopFile(request, { sessionStore, cacheIndex }),
  checkInDesktopSession: checkInWithSharedStore,
  releaseDesktopSession: (request) =>
    releaseDesktopSession(request, { sessionStore, cacheIndex }),
  updateDesktopAgent: (request) => updater.startUpdate(request),
  getDesktopAgentUpdateStatus: () => updater.getCurrentUpdateStatus(),
  isDesktopAgentUpdateActive: () => updater.isUpdating(),
  getHealthDiagnostics,
  getRuntimeHealth: () => runtimeHealth,
});

startAgentRuntime({
  server,
  port,
  host: "127.0.0.1",
  startMonitor: async () => {
    const recoveredSessions = await sessionStore.refresh();
    await cleanupOrphanedCheckInSnapshots(recoveredSessions, {
      cacheIndex,
      cacheRoot,
    });
    const recovery = sessionStore.getRecoveryStatus();
    runtimeHealth =
      recovery.state === "READY"
        ? { agentState: "READY" }
        : {
            agentState: "READY_WITH_ATTENTION",
            recoveryMessage: recovery.message,
            quarantinedSessionCount: recovery.quarantinedCount,
          };
    return startSessionMonitor({
      sessionStore,
      checkInDesktopSession: checkInWithSharedStore,
    });
  },
});
