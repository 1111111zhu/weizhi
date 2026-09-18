import { useEffect, useState } from "react";

import type {
  DesktopAgentSnapshot,
  DesktopAgentUpdate,
} from "../shared/desktop-agent-api";
import { useDesktopAgentI18n } from "./i18n";

export type UpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "current" }
  | { kind: "available"; update: DesktopAgentUpdate }
  | { kind: "downloading"; update: DesktopAgentUpdate }
  | { kind: "ready"; update: DesktopAgentUpdate }
  | { kind: "failed" };

export function useDesktopAgentSnapshot() {
  const { copy } = useDesktopAgentI18n();
  const [snapshot, setSnapshot] = useState<DesktopAgentSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(action: () => Promise<DesktopAgentSnapshot>) {
    setBusy(true);
    setActionError(null);
    try {
      setSnapshot(await action());
    } catch (error) {
      console.error("Desktop Agent tray action failed:", error);
      setActionError(readActionError(error, copy.genericActionError));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const refreshSnapshot = () =>
      window.desktopAgent.getSnapshot().then(setSnapshot);
    fireAndForget(refreshSnapshot());
    return window.desktopAgent.onSnapshot(setSnapshot);
  }, []);

  return { actionError, busy, run, snapshot };
}

function fireAndForget(task: Promise<unknown>) {
  task.catch(() => null);
}

function readActionError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

type UpdateTask<T> = {
  pending: UpdateState;
  resolve: (result: T) => UpdateState;
  setBusy: (busy: boolean) => void;
  setState: (state: UpdateState) => void;
  task: () => Promise<T>;
};

async function runUpdateTask<T>({
  pending,
  resolve,
  setBusy,
  setState,
  task,
}: UpdateTask<T>) {
  setBusy(true);
  setState(pending);
  try {
    setState(resolve(await task()));
  } catch {
    setState({ kind: "failed" });
  } finally {
    setBusy(false);
  }
}

export function useDesktopAgentUpdates() {
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<UpdateState>({ kind: "idle" });
  const execute = <T>(task: Omit<UpdateTask<T>, "setBusy" | "setState">) =>
    runUpdateTask({ ...task, setBusy, setState });

  const check = () =>
    execute({
      pending: { kind: "checking" },
      resolve: (update: DesktopAgentUpdate | null) =>
        update ? { kind: "available", update } : { kind: "current" },
      task: () => window.desktopAgent.checkForUpdate(),
    });
  const download = (update: DesktopAgentUpdate) =>
    execute({
      pending: { kind: "downloading", update },
      resolve: (result: DesktopAgentUpdate | null) =>
        result ? { kind: "ready", update: result } : { kind: "current" },
      task: () => window.desktopAgent.downloadUpdate(),
    });
  const apply = (update: DesktopAgentUpdate) =>
    execute({
      pending: { kind: "ready", update },
      resolve: (applied: boolean) =>
        applied ? { kind: "current" } : { kind: "available", update },
      task: () => window.desktopAgent.applyUpdate(),
    });

  return { apply, busy, check, download, state };
}
