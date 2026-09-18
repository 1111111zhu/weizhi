import type { Server } from "node:http";

type ProcessErrorEvents = {
  on: (
    event: "unhandledRejection" | "uncaughtException",
    listener: (error: unknown) => void
  ) => unknown;
};

export type AgentRuntimeOptions = {
  server: Pick<Server, "listen" | "on">;
  port: number;
  host: string;
  startMonitor: () => { stop: () => void } | Promise<{ stop: () => void }>;
  log?: (message: string) => void;
  error?: (message: string, error: unknown) => void;
  exit?: (code: number) => never | void;
  processEvents?: ProcessErrorEvents;
};

export function startAgentRuntime({
  server,
  port,
  host,
  startMonitor,
  log = console.log,
  error = console.error,
  exit = process.exit,
  processEvents = process,
}: AgentRuntimeOptions) {
  let monitor: { stop: () => void } | null = null;
  let stopped = false;

  const exitAfterFatalError = (message: string, processError: unknown) => {
    if (stopped) {
      return;
    }
    stopped = true;
    error(message, processError);
    monitor?.stop();
    exit(1);
  };

  processEvents.on("unhandledRejection", (processError) =>
    exitAfterFatalError(
      "Project Wing desktop agent unhandled rejection:",
      processError
    )
  );
  processEvents.on("uncaughtException", (processError) =>
    exitAfterFatalError(
      "Project Wing desktop agent uncaught exception:",
      processError
    )
  );

  server.on("error", (serverError: unknown) => {
    if (isAddressInUseError(serverError)) {
      log(`Project Wing desktop agent already running on ${host}:${port}`);
      exit(0);
      return;
    }
    error("Project Wing desktop agent server failed:", serverError);
    stopped = true;
    monitor?.stop();
    exit(1);
  });

  server.listen(port, host, () => {
    void Promise.resolve()
      .then(startMonitor)
      .then((startedMonitor) => {
        if (stopped) {
          startedMonitor.stop();
          return;
        }
        monitor = startedMonitor;
        log(`Project Wing desktop agent listening on ${host}:${port}`);
      })
      .catch((startError) => {
        stopped = true;
        error(
          "Project Wing desktop agent session recovery failed:",
          startError
        );
        exit(1);
      });
  });

  return {
    stop() {
      stopped = true;
      monitor?.stop();
    },
  };
}

function isAddressInUseError(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }
  return error.code === "EADDRINUSE";
}
