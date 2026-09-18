export type DesktopAgentState =
  | "OFFLINE"
  | "STARTING"
  | "PAIR_REQUIRED"
  | "PAIRING"
  | "READY"
  | "UPDATING"
  | "ATTENTION"
  | "FAILED";

export type DesktopAgentAccount = {
  id: string;
  email: string;
  name: string;
  globalRole: string;
};

export type DesktopAgentSnapshot = {
  stale?: boolean;
  observedAt?: string;
  recoveryRequired?: boolean;
  state: DesktopAgentState;
  version: string | null;
  attentionCount: number;
  error: string | null;
  user: DesktopAgentAccount | null;
  recentFiles?: {
    projectId: string;
    attachmentId: string;
    fileName: string;
    mode: "MASTER" | "READ_ONLY" | "UNKNOWN";
    openedAt: string;
    closedAt: string;
  }[];
  sessions: {
    sessionId: string;
    fileName: string;
    status: string;
    projectId: string;
    mode?: "MASTER" | "READ_ONLY" | "UNKNOWN";
    canCheckIn?: boolean;
    lifecycleState?: string;
    lastError?: string;
  }[];
};

export type DesktopAgentUpdate = {
  targetVersion: string;
  releaseNotes: string;
};

export type DesktopCacheFile = {
  id: string;
  fileName: string;
  size: number;
  kind: string;
  canDelete: boolean;
  protectedReason?: string | null;
};
export type DesktopCacheFiles = {
  usedBytes: number;
  files: DesktopCacheFile[];
};
export type DesktopCacheSettings = {
  cancelled?: boolean;
  evictionPolicy?: "LRU" | "FIFO";
  idleDays?: number;
  cacheRoot: string;
  maxBytes: number;
  usedBytes: number;
  entryCount: number;
  restartRequired?: boolean;
};

export type DesktopAgentHostApi = {
  getCacheFiles: () => Promise<DesktopCacheFiles>;
  deleteCacheFile: (id: string) => Promise<DesktopCacheFiles>;
  getCacheSettings: () => Promise<DesktopCacheSettings>;
  saveCacheSettings: (
    settings: Pick<
      DesktopCacheSettings,
      "cacheRoot" | "maxBytes" | "evictionPolicy" | "idleDays"
    >
  ) => Promise<DesktopCacheSettings>;
  getSnapshot: () => Promise<DesktopAgentSnapshot>;
  onSnapshot: (
    callback: (snapshot: DesktopAgentSnapshot) => void
  ) => () => void;
  refresh: () => Promise<DesktopAgentSnapshot>;
  signOut: () => Promise<DesktopAgentSnapshot>;
  checkIn: (sessionId: string) => Promise<DesktopAgentSnapshot>;
  release: (sessionId: string) => Promise<DesktopAgentSnapshot>;
  openMainWindow: () => Promise<void>;
  minimize: () => Promise<void>;
  endTracking: (sessionId: string) => Promise<DesktopAgentSnapshot>;
  openProject: (sessionId: string) => Promise<void>;
  openRecentProject: (projectId: string) => Promise<void>;
  revealSessionFile: (sessionId: string) => Promise<void>;
  openRecoveryHistory: () => Promise<void>;
  openRetainedFiles: () => Promise<void>;
  onOpenSettings: (callback: () => void) => () => void;
  checkForUpdate: () => Promise<DesktopAgentUpdate | null>;
  downloadUpdate: () => Promise<DesktopAgentUpdate | null>;
  applyUpdate: () => Promise<boolean>;
};

declare global {
  interface Window {
    desktopAgent: DesktopAgentHostApi;
  }
}
