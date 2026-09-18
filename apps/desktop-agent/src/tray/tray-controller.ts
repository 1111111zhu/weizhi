import type { DesktopAgentSession } from "@project-wing/shared";

import {
  DesktopAgentRuntimeClient,
  DesktopAgentRuntimeRequestError,
} from "./runtime-client.js";
import type { DesktopAgentRuntimeSnapshot } from "./runtime-client.js";
import { buildDesktopAgentTrayViewModel } from "./tray-state.js";
import type { DesktopAgentTrayViewModel } from "./tray-state.js";

const DEFAULT_REFRESH_INTERVAL_MS = 3000;

type TrayAction = "UPDATE" | "CHECK_IN" | "RELEASE" | "RECOVER_RELEASE";
type Listener = () => void;

export type DesktopAgentTrayControllerState = {
  viewModel: DesktopAgentTrayViewModel;
  refreshing: boolean;
  action: TrayAction | null;
  actionError: string | null;
  lastUpdatedAt: number | null;
};

export type DesktopAgentTrayControllerOptions = {
  client?: DesktopAgentRuntimeClient;
  refreshIntervalMs?: number;
  now?: () => number;
};

export class DesktopAgentTrayController {
  private readonly client: DesktopAgentRuntimeClient;
  private readonly refreshIntervalMs: number;
  private readonly now: () => number;
  private readonly listeners = new Set<Listener>();
  private runtimeSnapshot = emptyRuntimeSnapshot();
  private state = initialState(this.runtimeSnapshot);
  private refreshPromise: Promise<void> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: DesktopAgentTrayControllerOptions = {}) {
    this.client = options.client ?? new DesktopAgentRuntimeClient();
    this.refreshIntervalMs =
      options.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;
    this.now = options.now ?? Date.now;
  }

  getSnapshot = () => this.state;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  start() {
    if (this.timer) {
      return;
    }
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), this.refreshIntervalMs);
  }

  stop() {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = null;
  }

  async refresh() {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    const operation = this.loadSnapshot();
    this.refreshPromise = operation;
    try {
      await operation;
    } finally {
      if (this.refreshPromise === operation) {
        this.refreshPromise = null;
      }
    }
  }

  startUpdate(expectedVersion?: string) {
    return this.runAction("UPDATE", () =>
      this.client.startUpdate(expectedVersion)
    );
  }

  checkInSession(sessionId: string) {
    return this.runSessionAction("CHECK_IN", sessionId, (session) =>
      this.client.checkInSession(session)
    );
  }

  releaseSession(sessionId: string) {
    return this.runSessionAction("RELEASE", sessionId, (session) =>
      this.client.releaseSession(session)
    );
  }

  recoverLaunchFailedRelease(sessionId: string) {
    return this.runSessionAction("RECOVER_RELEASE", sessionId, (session) =>
      this.client.recoverLaunchFailedRelease(session)
    );
  }

  private async loadSnapshot() {
    this.patchState({ refreshing: true });
    const snapshot = await this.client.readSnapshot();
    this.runtimeSnapshot = snapshot;
    this.patchState({
      viewModel: buildDesktopAgentTrayViewModel(snapshot),
      refreshing: false,
      lastUpdatedAt: this.now(),
    });
  }

  private runSessionAction<T>(
    action: TrayAction,
    sessionId: string,
    operation: (session: DesktopAgentSession) => Promise<T>
  ) {
    const session = this.runtimeSnapshot.sessions.find(
      (item) => item.sessionId === sessionId
    );
    if (!session) {
      return Promise.reject(new Error("Desktop Agent session was not found."));
    }
    return this.runAction(action, () => operation(session));
  }

  private async runAction<T>(action: TrayAction, operation: () => Promise<T>) {
    if (this.state.action) {
      throw new Error("A Desktop Agent tray action is already running.");
    }
    this.patchState({ action, actionError: null });
    try {
      const result = await operation();
      await this.refresh();
      return result;
    } catch (error) {
      this.patchState({ actionError: readActionError(error) });
      throw error;
    } finally {
      this.patchState({ action: null });
    }
  }

  private patchState(patch: Partial<DesktopAgentTrayControllerState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) {
      listener();
    }
  }
}

function emptyRuntimeSnapshot(): DesktopAgentRuntimeSnapshot {
  return {
    health: null,
    auth: null,
    sessions: [],
    recentSessions: [],
    update: null,
    errors: ["health"],
  };
}

function initialState(
  snapshot: DesktopAgentRuntimeSnapshot
): DesktopAgentTrayControllerState {
  return {
    viewModel: buildDesktopAgentTrayViewModel(snapshot),
    refreshing: false,
    action: null,
    actionError: null,
    lastUpdatedAt: null,
  };
}

function readActionError(error: unknown) {
  if (error instanceof DesktopAgentRuntimeRequestError) {
    return error.code;
  }
  return error instanceof Error ? error.message : "UNKNOWN_ERROR";
}
