import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import { startAgentRuntime } from "./agent-runtime.js";

describe("desktop agent runtime", () => {
  it("starts the session monitor only after the HTTP server is listening", async () => {
    const server = new FakeServer();
    const monitor = { stop: vi.fn() };
    const startMonitor = vi.fn(() => monitor);

    startAgentRuntime({
      server,
      port: 17_862,
      host: "127.0.0.1",
      startMonitor,
      log: vi.fn(),
      exit: vi.fn(),
    });

    expect(startMonitor).not.toHaveBeenCalled();

    server.emitListening();
    await Promise.resolve();
    await Promise.resolve();

    expect(startMonitor).toHaveBeenCalledOnce();
  });

  it("waits for startup recovery before activating the session monitor", async () => {
    const server = new FakeServer();
    const monitor = { stop: vi.fn() };
    let finishRecovery!: () => void;
    const startMonitor = vi.fn(
      () =>
        new Promise<typeof monitor>((resolve) => {
          finishRecovery = () => resolve(monitor);
        })
    );
    const log = vi.fn();

    startAgentRuntime({
      server,
      port: 17_862,
      host: "127.0.0.1",
      startMonitor,
      log,
      exit: vi.fn(),
    });

    server.emitListening();
    await Promise.resolve();
    expect(log).not.toHaveBeenCalled();

    finishRecovery();
    await vi.waitFor(() =>
      expect(log).toHaveBeenCalledWith(
        "Project Wing desktop agent listening on 127.0.0.1:17862"
      )
    );
  });

  it("does not start the session monitor when another agent already owns the port", () => {
    const server = new FakeServer();
    const startMonitor = vi.fn();
    const exit = vi.fn();
    const log = vi.fn();

    startAgentRuntime({
      server,
      port: 17_862,
      host: "127.0.0.1",
      startMonitor,
      log,
      exit,
    });

    const error = Object.assign(new Error("address in use"), {
      code: "EADDRINUSE",
    });
    server.emit("error", error);

    expect(startMonitor).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      "Project Wing desktop agent already running on 127.0.0.1:17862"
    );
    expect(exit).toHaveBeenCalledWith(0);
  });

  it.each([
    ["unhandledRejection", "Project Wing desktop agent unhandled rejection:"],
    ["uncaughtException", "Project Wing desktop agent uncaught exception:"],
  ] as const)(
    "exits after a fatal %s so AgentManager can restart the worker",
    (event, message) => {
      const server = new FakeServer();
      const processEvents = new EventEmitter();
      const error = vi.fn();
      const exit = vi.fn();

      startAgentRuntime({
        server,
        port: 17_862,
        host: "127.0.0.1",
        startMonitor: vi.fn(),
        log: vi.fn(),
        error,
        exit,
        processEvents,
      });

      processEvents.emit(event, new Error("fatal runtime failure"));

      expect(error).toHaveBeenCalledWith(message, expect.any(Error));
      expect(exit).toHaveBeenCalledWith(1);
    }
  );

  it("stops an active monitor before exiting after a fatal exception", async () => {
    const server = new FakeServer();
    const processEvents = new EventEmitter();
    const monitor = { stop: vi.fn() };
    const exit = vi.fn();

    startAgentRuntime({
      server,
      port: 17_862,
      host: "127.0.0.1",
      startMonitor: vi.fn(() => monitor),
      log: vi.fn(),
      error: vi.fn(),
      exit,
      processEvents,
    });

    server.emitListening();
    await Promise.resolve();
    await Promise.resolve();
    processEvents.emit("uncaughtException", new Error("event failed"));

    expect(monitor.stop).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(1);
  });
});

class FakeServer extends EventEmitter {
  private listeningCallback?: () => void;

  listen(port: number, host: string, callback: () => void) {
    if (port <= 0 || host !== "127.0.0.1") {
      throw new Error("FakeServer received an invalid listen address.");
    }
    this.listeningCallback = callback;
    return this;
  }

  emitListening() {
    this.listeningCallback?.();
  }
}
