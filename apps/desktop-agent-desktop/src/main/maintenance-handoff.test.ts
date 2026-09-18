import type { ChildProcessWithoutNullStreams } from "node:child_process";
import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  awaitMaintenancePreparation,
  createMaintenanceStagingDirectory,
  resolveMaintenancePaths,
} from "./maintenance-handoff";

function fixtureChild() {
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
  return {
    on: (event: string, listener: (...args: unknown[]) => void) => {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    },
    emit: (event: string, ...args: unknown[]) => {
      for (const listener of listeners.get(event) ?? []) {
        listener(...args);
      }
    },
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    unref: vi.fn(),
  } as unknown as ChildProcessWithoutNullStreams;
}

describe("native update handoff", () => {
  afterEach(() => vi.useRealTimers());

  it("reserves an isolated helper container but leaves the copy target absent", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "project-wing-staging-test-")
    );
    try {
      const stateRoot = path.join(root, "state");
      const source = path.join(root, "source");
      await mkdir(source);
      await writeFile(path.join(source, "helper.txt"), "synthetic helper");
      const target = await createMaintenanceStagingDirectory(stateRoot);
      await expect(stat(target)).rejects.toMatchObject({ code: "ENOENT" });
      expect(path.basename(target)).toBe("runtime");
      expect(path.dirname(path.dirname(target))).toBe(
        path.join(stateRoot, "recovery-helper")
      );
      await cp(source, target, {
        recursive: true,
        errorOnExist: true,
        force: false,
      });
      await expect(
        readFile(path.join(target, "helper.txt"), "utf-8")
      ).resolves.toBe("synthetic helper");
      const next = await createMaintenanceStagingDirectory(stateRoot);
      expect(next).not.toBe(target);
      await expect(stat(next)).rejects.toMatchObject({ code: "ENOENT" });
      await writeFile(path.join(source, "helper.txt"), "replacement helper");
      await expect(
        cp(source, target, {
          recursive: true,
          errorOnExist: true,
          force: false,
        })
      ).rejects.toMatchObject({ code: "ERR_FS_CP_EEXIST" });
      await expect(
        readFile(path.join(target, "helper.txt"), "utf-8")
      ).resolves.toBe("synthetic helper");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("only resolves package paths inside the installed package directory", () => {
    const executable = path.resolve(
      "fixture-install/current/ProjectWingDesktopAgent.exe"
    );
    expect(
      resolveMaintenancePaths(executable, "agent-0.3.5-full.nupkg").packagePath
    ).toBe(path.resolve("fixture-install/packages/agent-0.3.5-full.nupkg"));
    for (const name of [
      "../escape.nupkg",
      "..\\escape.nupkg",
      "evil;cmd.nupkg",
      "x.exe",
    ]) {
      expect(() => resolveMaintenancePaths(executable, name)).toThrow(
        "package name"
      );
    }
    expect(() =>
      resolveMaintenancePaths(
        path.resolve("Downloads/ProjectWingDesktopAgent.exe"),
        "agent.nupkg"
      )
    ).toThrow("installation layout");
  });

  it("requires PREPARED then COMMITTED acknowledgements before UI exit", async () => {
    const child = fixtureChild();
    const prepared = awaitMaintenancePreparation(child);
    child.stdout.emit("data", '{"status":"PREPARED"}\n');
    const transaction = await prepared;
    const commit = transaction.commit();
    expect((child.stdin as PassThrough).read()?.toString()).toBe(
      '{"command":"commit"}\n'
    );
    expect(child.unref).not.toHaveBeenCalled();
    child.stdout.emit("data", '{"status":"COMMITTED","updaterPid":99}\n');
    await commit;
    expect(child.unref).toHaveBeenCalledOnce();
    await transaction.cancel();
    expect(child.stdin.writableEnded).toBeTruthy();
  });

  it("does not launch anything after cancellation before commit", async () => {
    const child = fixtureChild();
    const prepared = awaitMaintenancePreparation(child);
    child.stdout.emit("data", '{"status":"PREPARED"}\n');
    const transaction = await prepared;
    await transaction.cancel();
    expect(child.stdin.writableEnded).toBeTruthy();
    expect((child.stdin as PassThrough).read()?.toString()).toBe(
      '{"command":"cancel"}\n'
    );
  });

  it("fails locally on signature/ownership refusal without declaring readiness", async () => {
    const child = fixtureChild();
    const prepared = awaitMaintenancePreparation(child);
    await Promise.all([
      expect(prepared).rejects.toThrow("untrusted updater"),
      Promise.resolve().then(() =>
        child.stdout.emit(
          "data",
          '{"status":"FAILED","error":"untrusted updater"}\n'
        )
      ),
    ]);
    expect(child.stdin.writableEnded).toBeTruthy();
  });

  it("ends preparation after a bounded silent helper timeout", async () => {
    vi.useFakeTimers();
    const child = fixtureChild();
    const prepared = awaitMaintenancePreparation(child);
    await Promise.all([
      expect(prepared).rejects.toThrow("did not confirm readiness"),
      vi.advanceTimersByTimeAsync(60_000),
    ]);
    expect(child.stdin.writableEnded).toBeTruthy();
  });

  it("uses the exact persisted handoff transaction if the commit acknowledgement is lost", async () => {
    vi.useFakeTimers();
    const child = fixtureChild();
    const confirmCommitted = vi.fn(() => Promise.resolve(true));
    const prepared = awaitMaintenancePreparation(child, confirmCommitted);
    child.stdout.emit("data", '{"status":"PREPARED"}\n');
    const transaction = await prepared;
    await Promise.all([
      transaction.commit(),
      vi.advanceTimersByTimeAsync(15_000),
    ]);
    expect(confirmCommitted).toHaveBeenCalledOnce();
    expect(child.unref).toHaveBeenCalledOnce();
    await transaction.cancel();
    expect(child.stdin.writableEnded).toBeTruthy();
  });

  it("contains a broken helper input pipe instead of crashing the desktop host", async () => {
    const child = fixtureChild();
    const prepared = awaitMaintenancePreparation(child);
    child.stdout.emit("data", '{"status":"PREPARED"}\n');
    const transaction = await prepared;
    const commit = transaction.commit();
    await Promise.all([
      expect(commit).rejects.toThrow("EPIPE"),
      Promise.resolve().then(() =>
        child.stdin.emit("error", new Error("EPIPE"))
      ),
    ]);
  });

  it("does not treat a dead helper's old armed receipt as a committed update", async () => {
    const child = fixtureChild();
    const confirmCommitted = vi.fn(() => Promise.resolve(true));
    const prepared = awaitMaintenancePreparation(child, confirmCommitted);
    child.stdout.emit("data", '{"status":"PREPARED"}\n');
    const transaction = await prepared;
    const commit = transaction.commit();
    await Promise.all([
      expect(commit).rejects.toThrow("Update preparation stopped"),
      Promise.resolve().then(() => child.emit("exit", 1)),
    ]);
    expect(confirmCommitted).not.toHaveBeenCalled();
    expect(child.unref).not.toHaveBeenCalled();
  });
});
