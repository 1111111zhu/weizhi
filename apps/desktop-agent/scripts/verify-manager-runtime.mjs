import { spawn, spawnSync } from "node:child_process";
import {
  access,
  cp,
  mkdtemp,
  rm,
  readFile,
  writeFile,
  mkdir,
  utimes,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertEqual,
  findAvailablePort,
  waitForExit,
  waitUntilReady,
} from "./runtime-test-support.mjs";

const { dirname, join } = pathModule;

const root = fileURLToPath(new URL("..", import.meta.url));
const managerProject = join(
  root,
  "manager/ProjectWing.AgentManager/ProjectWing.AgentManager.csproj"
);
const managerAssembly = join(
  root,
  "manager/ProjectWing.AgentManager/bin/Debug/net8.0/ProjectWing.AgentManager.dll"
);
const runtimeProject = join(
  root,
  "runtime/ProjectWing.DesktopAgent.Runtime/ProjectWing.DesktopAgent.Runtime.csproj"
);
const runtimeAssembly = join(
  root,
  "runtime/ProjectWing.DesktopAgent.Runtime/bin/Debug/net8.0/ProjectWing.DesktopAgent.Runtime.dll"
);

build(managerProject);
build(runtimeProject);
const recoveryFixtureProject = join(
  root,
  "test-fixtures/RecoveryWorker/RecoveryWorker.csproj"
);
const recoveryFixtureAssembly = join(
  root,
  "test-fixtures/RecoveryWorker/bin/Debug/net8.0/RecoveryWorker.dll"
);
build(recoveryFixtureProject);
const runtimePort = await findAvailablePort();
const workerPort = await findDistinctPort(runtimePort);
const stateRoot = await mkdtemp(join(tmpdir(), "project-wing-manager-"));
const appDirectory = join(stateRoot, "app");
const isolatedCache = join(stateRoot, "cache");
const orphanFile = join(isolatedCache, "unknown-owner.xlsx");
const orphanSnapshot = join(
  isolatedCache,
  ".check-in-staging",
  "lost-session",
  "snapshot.docx"
);
await mkdir(join(isolatedCache, ".check-in-staging", "lost-session"), {
  recursive: true,
});
for (const file of [orphanFile, orphanSnapshot]) {
  await writeFile(file, "UNOWNED WORK MUST NOT BE EVICTED");
  await utimes(file, new Date("2000-01-01"), new Date("2000-01-01"));
}
await cp(dirname(runtimeAssembly), join(appDirectory, "managed"), {
  recursive: true,
});
if (process.platform === "linux" || process.platform === "win32") {
  await verifyWorkerCrashRecoversManager();
  await verifyHungWorkerRecovery();
}
const baseUrl = `http://127.0.0.1:${runtimePort}`;
const manager = startManager(runtimePort, workerPort);

let output = "";
manager.stdout.on("data", (chunk) => (output += chunk));
manager.stderr.on("data", (chunk) => (output += chunk));

try {
  await waitUntilReady(baseUrl);
  const health = await waitForManagedReady(baseUrl);
  for (const file of [orphanFile, orphanSnapshot]) {
    assertEqual(
      await readFile(file, "utf-8"),
      "UNOWNED WORK MUST NOT BE EVICTED"
    );
  }
  // A second installation using another port must still not share state.
  const duplicatePort = await findAvailablePort();
  const duplicateWorkerPort = await findDistinctPort(duplicatePort);
  const duplicate = startManager(duplicatePort, duplicateWorkerPort);
  let duplicateOutput = "";
  duplicate.stdout.on("data", (chunk) => {
    duplicateOutput += chunk;
  });
  duplicate.stderr.on("data", (chunk) => {
    duplicateOutput += chunk;
  });
  await waitForExit(duplicate);
  assertEqual(duplicate.exitCode === 0, false);
  assertEqual(duplicateOutput.includes("INSTANCE_OWNERSHIP_UNAVAILABLE"), true);
  const ownerHealthResponse = await fetch(`${baseUrl}/health`);
  const ownerHealth = await ownerHealthResponse.json();
  assertEqual(ownerHealth.workerPid, health.workerPid);
  const duplicateRuntime = spawn(
    "dotnet",
    [runtimeAssembly, "--urls", `http://127.0.0.1:${duplicateWorkerPort}`],
    {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PROJECT_WING_AGENT_STATE_ROOT: join(stateRoot, "other-state"),
        PROJECT_WING_AGENT_CACHE_ROOT: isolatedCache,
        PROJECT_WING_AGENT_DISABLE_FILE_LAUNCH: "true",
      },
    }
  );
  let duplicateRuntimeOutput = "";
  duplicateRuntime.stdout.on("data", (chunk) => {
    duplicateRuntimeOutput += chunk;
  });
  duplicateRuntime.stderr.on("data", (chunk) => {
    duplicateRuntimeOutput += chunk;
  });
  await waitForExit(duplicateRuntime);
  assertEqual(duplicateRuntime.exitCode === 0, false);
  assertEqual(
    duplicateRuntimeOutput.includes("cannot acquire cache ownership"),
    true
  );
  assertEqual(health.app, "project-wing-desktop-runtime");
  assertEqual(health.version, "0.2.0-test");
  assertEqual(health.agentVersion, "0.2.0-test");
  assertEqual(health.agentState, "READY");
  assertEqual(health.updateState, "READY");
  assertEqual(health.attentionCount, 0);
  const authResponse = await fetch(`${baseUrl}/auth/status`);
  const auth = await authResponse.json();
  assertEqual(auth, { ok: true, authenticated: false, pairing: false });
  const rejectedShutdown = await fetch(`${baseUrl}/control/shutdown`, {
    method: "POST",
    headers: { Origin: "https://emp.superfx.cn" },
  });
  assertEqual(rejectedShutdown.status, 403);
  const staleShutdown = await fetch(`${baseUrl}/control/shutdown`, {
    method: "POST",
    headers: { "X-Project-Wing-Manager-Instance": "stale-instance" },
  });
  assertEqual(staleShutdown.status, 409);
  const browserShutdown = await fetch(`${baseUrl}/control/shutdown`, {
    method: "POST",
    headers: { "Sec-Fetch-Site": "none" },
  });
  assertEqual(browserShutdown.status, 403);
  const healthResponse = await fetch(`${baseUrl}/health`);
  assertEqual(healthResponse.status, 200);
  const shutdown = await fetch(`${baseUrl}/control/shutdown`, {
    method: "POST",
  });
  assertEqual(shutdown.status, 202);
  await waitForExit(manager);
  await access(join(stateRoot, "shutdown.flag"));
  console.log(`Desktop Agent manager verification passed on ${baseUrl}.`);
} catch (error) {
  console.error(output.trim());
  throw error;
} finally {
  if (manager.exitCode === null) {
    manager.kill("SIGINT");
    await waitForExit(manager);
  }
  await rm(stateRoot, { recursive: true, force: true });
}

function build(project) {
  const result = spawnSync(
    "dotnet",
    ["build", project, "-c", "Debug", "--nologo"],
    {
      cwd: root,
      encoding: "utf-8",
    }
  );
  if (result.status !== 0) {
    if (result.error) {
      throw result.error;
    }
    throw new Error(`${result.stdout ?? ""}${result.stderr ?? ""}`);
  }
}

async function waitForManagedReady(runtimeBaseUrl) {
  const deadline = Date.now() + 10_000;
  let lastHealth;
  while (Date.now() < deadline) {
    const healthResponse = await fetch(`${runtimeBaseUrl}/health`);
    const health = await healthResponse.json();
    lastHealth = health;
    if (health.agentState === "READY") {
      return health;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }
  throw new Error(
    `Managed Desktop Agent runtime did not become ready: ${JSON.stringify(lastHealth)}`
  );
}

function startManager(managerPort, managedWorkerPort, extraArgs = []) {
  return spawn(
    "dotnet",
    [
      managerAssembly,
      "run",
      "--app-directory",
      appDirectory,
      "--agent-version",
      "0.2.0-test",
      "--state-root",
      stateRoot,
      "--runtime-port",
      String(managerPort),
      "--worker-port",
      String(managedWorkerPort),
      ...extraArgs,
    ],
    {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PROJECT_WING_AGENT_STATE_ROOT: stateRoot,
        PROJECT_WING_AGENT_CACHE_ROOT: join(stateRoot, "cache"),
        PROJECT_WING_AGENT_DISABLE_FILE_LAUNCH: "true",
      },
    }
  );
}

async function verifyWorkerCrashRecoversManager() {
  const managerPort = await findAvailablePort();
  const managedWorkerPort = await findDistinctPort(managerPort);
  const crashManager = startManager(managerPort, managedWorkerPort);
  let crashOutput = "";
  crashManager.stdout.on("data", (chunk) => (crashOutput += chunk));
  crashManager.stderr.on("data", (chunk) => (crashOutput += chunk));
  try {
    await waitUntilReady(`http://127.0.0.1:${managerPort}`);
    const initial = await waitForManagedReady(
      `http://127.0.0.1:${managerPort}`
    );
    const { workerPid } = initial;
    if (!Number.isInteger(workerPid) || workerPid <= 0) {
      throw new Error("Desktop Agent manager did not report its worker PID.");
    }
    process.kill(workerPid, "SIGKILL");
    const recovered = await waitForRestartedWorker(
      `http://127.0.0.1:${managerPort}`,
      workerPid
    );
    assertEqual(recovered.agentState, "READY");
    assertEqual(crashManager.exitCode, null);
    const sentinel = join(stateRoot, "unsynced-workpaper.txt");
    await writeFile(sentinel, "LOCAL UNSYNCED WORK MUST SURVIVE", "utf-8");
    let current = recovered;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      process.kill(current.workerPid, "SIGKILL");
      if (attempt < 4) {
        current = await waitForRestartedWorker(
          `http://127.0.0.1:${managerPort}`,
          current.workerPid
        );
      }
    }
    const degraded = await waitForState(
      `http://127.0.0.1:${managerPort}`,
      "DEGRADED_NEEDS_ATTENTION"
    );
    const recoverUrl = `http://127.0.0.1:${managerPort}/control/recover`;
    const recoverRequest = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Project-Wing-Agent": "1",
      },
      body: JSON.stringify({ managerInstanceId: degraded.managerInstanceId }),
    };
    const browserRecovery = await fetch(recoverUrl, {
      ...recoverRequest,
      headers: {
        ...recoverRequest.headers,
        Origin: "https://emp.superfx.cn",
      },
    });
    assertEqual(browserRecovery.status, 403);
    const staleRecovery = await fetch(recoverUrl, {
      ...recoverRequest,
      body: JSON.stringify({ managerInstanceId: "stale-instance" }),
    });
    assertEqual(staleRecovery.status, 409);
    const updateFile = join(stateRoot, "update-status.json");
    const priorUpdate = await readFile(updateFile).catch((error) => {
      if (error.code === "ENOENT") {
        return null;
      }
      throw error;
    });
    await writeFile(updateFile, JSON.stringify({ status: "INSTALLING" }));
    const updatingRecovery = await fetch(recoverUrl, recoverRequest);
    assertEqual(updatingRecovery.status, 409);
    await (priorUpdate === null
      ? rm(updateFile)
      : writeFile(updateFile, priorUpdate));
    const recoveries = await Promise.all([
      fetch(recoverUrl, recoverRequest),
      fetch(recoverUrl, recoverRequest),
    ]);
    assertEqual(
      recoveries.filter((response) => response.status === 202).length,
      1
    );
    assertEqual(
      recoveries.every((response) => [200, 202, 409].includes(response.status)),
      true
    );
    await waitForManagedReady(`http://127.0.0.1:${managerPort}`);
    assertEqual(
      await readFile(sentinel, "utf-8"),
      "LOCAL UNSYNCED WORK MUST SURVIVE"
    );
    console.log(
      "Adversarial recovery passed: crash budget, native-only control, stale instance, update exclusion, concurrent recovery, preserved workpaper."
    );
    const shutdown = await fetch(
      `http://127.0.0.1:${managerPort}/control/shutdown`,
      { method: "POST" }
    );
    assertEqual(shutdown.status, 202);
    await waitForExit(crashManager);
  } catch (error) {
    console.error(crashOutput.trim());
    throw error;
  } finally {
    if (crashManager.exitCode === null) {
      crashManager.kill("SIGINT");
      await waitForExit(crashManager);
    }
  }
}

async function waitForRestartedWorker(runtimeBaseUrl, previousPid) {
  const deadline = Date.now() + 20_000;
  let lastHealth = null;
  while (Date.now() < deadline) {
    try {
      const healthResponse = await fetch(`${runtimeBaseUrl}/health`);
      const health = await healthResponse.json();
      lastHealth = health;
      if (
        health.agentState === "READY" &&
        Number.isInteger(health.workerPid) &&
        health.workerPid > 0 &&
        health.workerPid !== previousPid &&
        Number.isInteger(health.restartCount) &&
        health.restartCount >= 1
      ) {
        return health;
      }
    } catch {
      // The manager may briefly close a proxied request while replacing the worker.
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }
  throw new Error(
    `Desktop Agent manager did not restart its worker. Last health: ${JSON.stringify(lastHealth)}`
  );
}

async function findDistinctPort(excludedPort) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const port = await findAvailablePort();
    if (port !== excludedPort) {
      return port;
    }
  }
  throw new Error(`Could not find a port distinct from ${excludedPort}.`);
}

async function waitForState(fixtureOrigin, state) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${fixtureOrigin}/health`);
    const health = await response.json();
    if (health.agentState === state) {
      return health;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }
  throw new Error(`Did not observe ${state}`);
}

async function verifyHungWorkerRecovery() {
  const managerPort = await findAvailablePort();
  const managedWorkerPort = await findDistinctPort(managerPort);
  const base = `http://127.0.0.1:${managerPort}`;
  const instance = startManager(managerPort, managedWorkerPort, [
    "--runtime-path",
    recoveryFixtureAssembly,
  ]);
  instance.stdout.on("data", () => {});
  instance.stderr.on("data", () => {});
  try {
    await waitUntilReady(base);
    const initialResponse = await fetch(`${base}/health`);
    const initial = await initialResponse.json();
    assertEqual(initial.agentState, "STARTING");
    const result = await fetch(`${base}/control/recover`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Project-Wing-Agent": "1",
      },
      body: JSON.stringify({ managerInstanceId: initial.managerInstanceId }),
    });
    if (result.status !== 202) {
      throw new Error(
        `Hung recovery failed: ${result.status} ${await result.text()}`
      );
    }
    const recovered = await waitForManagedReady(base);
    assertEqual(recovered.workerPid !== initial.workerPid, true);
    console.log(
      "Hung-worker recovery passed: only the owned child was replaced."
    );
  } finally {
    await fetch(`${base}/control/shutdown`, { method: "POST" }).catch(
      () => null
    );
    if (instance.exitCode === null) {
      await waitForExit(instance);
    }
  }
}
