import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Regression acceptance for previously reproduced recovery dead ends.
// No installed Agent, fixed Agent ports, registry, Office or user data involved.
const nativeAudit =
  process.env.PROJECT_WING_RUN_ADVERSARIAL_PROCESS_AUDIT === "1";

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("No port");
  }
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  return address.port;
}

async function until<T>(
  read: () => Promise<T>,
  accepts: (value: T) => boolean,
  timeout = 45_000
): Promise<T> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const value = await read();
      if (accepts(value)) {
        return value;
      }
    } catch {
      /* Wait only on isolated test process readiness. */
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });
  }
  throw new Error("Isolated process condition timed out");
}

async function exited(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  await new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
  });
}

interface FixtureHealth {
  agentState: string;
  workerPid: number;
  managerInstanceId: string;
}
async function readHealth(
  url: string,
  init?: RequestInit
): Promise<FixtureHealth> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(4000),
    ...init,
  });
  return response.json() as Promise<FixtureHealth>;
}
function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!nativeAudit)(
  "adversarial native process characterization",
  () => {
    it.skipIf(!process.env.PROJECT_WING_BODY_AUDIT_DLL)(
      "partial health body remains bounded and sustained failure recovers automatically",
      async () => {
        const fixtureDll = process.env.PROJECT_WING_BODY_AUDIT_DLL;
        if (!fixtureDll) {
          throw new Error("Partial health fixture DLL required");
        }
        const state = await mkdtemp(
          path.join(tmpdir(), "project-wing-process-audit-")
        );
        const cache = path.join(state, "cache");
        await mkdir(cache);
        const port = await freePort();
        let workerPort = await freePort();
        while (workerPort === port) {
          workerPort = await freePort();
        }
        expect([port, workerPort]).not.toContain(17_862);
        expect([port, workerPort]).not.toContain(17_863);
        const managerDll = path.resolve(
          import.meta.dirname,
          "../../../desktop-agent/manager/ProjectWing.AgentManager/bin/Debug/net8.0/ProjectWing.AgentManager.dll"
        );
        const child = spawn(
          "dotnet",
          [
            managerDll,
            "run",
            "--app-directory",
            state,
            "--agent-version",
            "process-audit",
            "--state-root",
            state,
            "--runtime-path",
            fixtureDll,
            "--runtime-port",
            String(port),
            "--worker-port",
            String(workerPort),
          ],
          {
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
            env: {
              ...process.env,
              PROJECT_WING_AGENT_STATE_ROOT: state,
              PROJECT_WING_AGENT_CACHE_ROOT: cache,
              PROJECT_WING_AGENT_DISABLE_FILE_LAUNCH: "true",
            },
          }
        );
        let workerPid: number | undefined;
        let output = "";
        child.stdout?.on("data", (value) => {
          output += String(value);
        });
        child.stderr?.on("data", (value) => {
          output += String(value);
        });
        const origin = `http://127.0.0.1:${port}`;
        try {
          const ready = await until(
            () => readHealth(`${origin}/health`),
            (value) => value.agentState === "READY",
            15_000
          );
          ({ workerPid } = ready);
          await new Promise((resolve) => {
            setTimeout(resolve, 2200);
          });
          const started = Date.now();
          const unavailable = await readHealth(`${origin}/health`);
          expect(unavailable.agentState).toBe("STARTING");
          expect(Date.now() - started).toBeLessThan(3500);
          const identityStarted = Date.now();
          const identity = await readHealth(`${origin}/control/identity`, {
            headers: { "X-Project-Wing-Agent": "1" },
            signal: AbortSignal.timeout(2000),
          });
          expect(identity.managerInstanceId).toBe(ready.managerInstanceId);
          expect(Date.now() - identityStarted).toBeLessThan(1500);
          // No recover click: repeated failed probes must recover the owned child.
          const recovered = await until(
            () => readHealth(`${origin}/health`),
            (value) =>
              value.agentState === "READY" &&
              value.workerPid !== ready.workerPid,
            43_000
          );
          ({ workerPid } = recovered);
          console.log(
            JSON.stringify({
              audit: "partial-body-bounded-and-automatically-recovered",
              managerPort: port,
              workerPort,
              workerPid,
              state,
            })
          );
        } finally {
          child.kill("SIGKILL");
          await exited(child);
          if (workerPid !== undefined) {
            try {
              process.kill(workerPid, "SIGKILL");
            } catch {
              /* Owned fixture only. */
            }
          }
          await writeFile(path.join(state, "audit-output.log"), output);
        }
      },
      55_000
    );

    it("a hard-killed Manager causes its Runtime to self-exit and replacement startup recovers", async () => {
      const root = path.resolve(import.meta.dirname, "../../..");
      const managerDll = path.join(
        root,
        "desktop-agent/manager/ProjectWing.AgentManager/bin/Debug/net8.0/ProjectWing.AgentManager.dll"
      );
      const runtimeDll = path.join(
        root,
        "desktop-agent/runtime/ProjectWing.DesktopAgent.Runtime/bin/Debug/net8.0/ProjectWing.DesktopAgent.Runtime.dll"
      );
      const state = await mkdtemp(
        path.join(tmpdir(), "project-wing-process-audit-")
      );
      const cache = path.join(state, "cache");
      await mkdir(cache);
      await writeFile(
        path.join(cache, "synthetic-unuploaded.txt"),
        "SYNTHETIC AUDIT ONLY"
      );
      const managerPort = await freePort();
      let workerPort = await freePort();
      while (workerPort === managerPort) {
        workerPort = await freePort();
      }
      expect([managerPort, workerPort]).not.toContain(17_862);
      expect([managerPort, workerPort]).not.toContain(17_863);
      const origin = `http://127.0.0.1:${managerPort}`;
      const children: ChildProcess[] = [];
      let orphanPid: number | undefined;
      let output = "";
      const startManager = () => {
        const child = spawn(
          "dotnet",
          [
            managerDll,
            "run",
            "--app-directory",
            path.dirname(runtimeDll),
            "--agent-version",
            "process-audit",
            "--state-root",
            state,
            "--runtime-path",
            runtimeDll,
            "--runtime-port",
            String(managerPort),
            "--worker-port",
            String(workerPort),
            "--api-base-url",
            "http://127.0.0.1:1",
            "--auth-base-url",
            "http://127.0.0.1:1",
          ],
          {
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
            env: {
              ...process.env,
              PROJECT_WING_AGENT_STATE_ROOT: state,
              PROJECT_WING_AGENT_CACHE_ROOT: cache,
              PROJECT_WING_AGENT_DISABLE_FILE_LAUNCH: "true",
            },
          }
        );
        children.push(child);
        child.stdout?.on("data", (chunk) => {
          output += String(chunk);
        });
        child.stderr?.on("data", (chunk) => {
          output += String(chunk);
        });
        return child;
      };
      const health = () => readHealth(`${origin}/health`);
      try {
        const first = startManager();
        const ready = await until(
          health,
          (value) => value.agentState === "READY"
        );
        orphanPid = ready.workerPid ?? undefined;
        expect(orphanPid).toBeTypeOf("number");
        first.kill("SIGKILL");
        await exited(first);
        startManager();
        const recovered = await until(
          health,
          (value) =>
            value.agentState === "READY" && value.workerPid !== ready.workerPid,
          20_000
        );
        if (orphanPid === undefined) {
          throw new Error("Fixture worker identity missing");
        }
        expect(isProcessAlive(orphanPid)).toBeFalsy();
        await expect(
          readFile(path.join(cache, "synthetic-unuploaded.txt"), "utf-8")
        ).resolves.toBe("SYNTHETIC AUDIT ONLY");
        console.log(
          JSON.stringify({
            audit: "orphan-runtime-self-exit-and-automatic-replacement",
            managerPort,
            workerPort,
            orphanPid,
            state,
            initial: ready.agentState,
            final: recovered.agentState,
          })
        );
      } finally {
        for (const child of children) {
          if (child.exitCode === null && child.signalCode === null) {
            child.kill("SIGKILL");
          }
          await exited(child);
        }
        if (orphanPid !== undefined) {
          try {
            process.kill(orphanPid, "SIGKILL");
          } catch {
            /* Owned fixture already stopped. */
          }
        }
        // Preserve isolated artifacts and logs for review; no recursive deletion.
        await writeFile(path.join(state, "audit-output.log"), output);
      }
    }, 105_000);
  }
);
