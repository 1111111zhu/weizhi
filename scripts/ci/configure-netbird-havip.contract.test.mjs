import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const script = path.join(root, "scripts/ci/configure-netbird-havip.sh");
const secret = "fixture-token-never-print";

function fixtureState(overrides = {}) {
  return {
    networks: [],
    resources: [],
    routers: [],
    groups: [
      { id: "group-all", name: "All" },
      { id: "group-development", name: "Development Server" },
    ],
    calls: [],
    ...overrides,
  };
}

async function startFixture(state) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    state.calls.push({ method: request.method, path: url.pathname, query: url.search });
    if (request.headers.authorization !== "Token " + secret) {
      response.writeHead(401).end();
      return;
    }
    const body = [];
    for await (const chunk of request) body.push(chunk);
    const payload = body.length ? JSON.parse(Buffer.concat(body)) : undefined;
    const send = (status, value) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(value));
    };
    if (request.method === "GET" && url.pathname === "/api/networks") return send(200, state.networks);
    if (request.method === "GET" && url.pathname === "/api/groups") {
      return send(200, state.groups.filter((group) => group.name === url.searchParams.get("name")));
    }
    const resourcePath = /^\/api\/networks\/([^/]+)\/resources$/.exec(url.pathname);
    if (resourcePath && request.method === "GET") {
      return send(200, Object.hasOwn(state, "resourcesResponse") ? state.resourcesResponse : state.resources);
    }
    if (resourcePath && request.method === "POST") {
      const value = { id: "resource-" + (state.resources.length + 1), type: "host", ...payload,
        groups: payload.groups.map((id) => ({ id, name: "All" })) };
      state.resources.push(value);
      return send(201, value);
    }
    const routerPath = /^\/api\/networks\/([^/]+)\/routers$/.exec(url.pathname);
    if (routerPath && request.method === "GET") {
      return send(200, Object.hasOwn(state, "routersResponse") ? state.routersResponse : state.routers);
    }
    if (routerPath && request.method === "POST") {
      const value = { id: "router-" + (state.routers.length + 1), ...payload };
      state.routers.push(value);
      return send(201, value);
    }
    if (request.method === "POST" && url.pathname === "/api/networks") {
      const value = { id: "network-" + (state.networks.length + 1), ...payload };
      state.networks.push(value);
      return send(201, value);
    }
    send(404, { error: "not found" });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, url: "http://127.0.0.1:" + server.address().port };
}

function runScript(url, tokenFile, extra = {}) {
  return new Promise((resolve) => {
    const child = spawn("bash", [script], {
      env: {
        ...process.env,
        NETBIRD_MANAGEMENT_URL: url,
        NETBIRD_API_TOKEN_FILE: tokenFile,
        PROJECTWING_HAVIP_ADDRESS: "172.19.143.200",
        PROJECTWING_NETBIRD_ROUTER_NAME: "ProjectWing Edge Router",
        ...extra,
      },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status, signal) => resolve({ status, signal, stdout, stderr }));
  });
}

async function withFixture(state, callback) {
  const directory = mkdtempSync(path.join(tmpdir(), "projectwing-netbird-"));
  const tokenFile = path.join(directory, "token");
  writeFileSync(tokenFile, secret + "\n", { mode: 0o600 });
  const fixture = await startFixture(state);
  try {
    return await callback(fixture.url, tokenFile);
  } finally {
    await new Promise((resolve) => fixture.server.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  }
}

test("creates the HA network, /32 resource, and grouped router through the expected API", async () => {
  const state = fixtureState();
  await withFixture(state, async (url, tokenFile) => {
    const result = await runScript(url, tokenFile);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      networkId: "network-1",
      resourceId: "resource-1",
      routerId: "router-1",
      resourceGroup: "All",
      peerGroup: "Development Server",
    });
    assert.ok(state.calls.some((call) => call.method === "POST" && call.path.endsWith("/resources")));
    assert.ok(state.calls.some((call) => call.method === "POST" && call.path.endsWith("/routers")));
    assert.equal(state.resources[0].address, "172.19.143.200/32");
    assert.deepEqual(state.routers[0], {
      id: "router-1",
      peer_groups: ["group-development"],
      metric: 100,
      masquerade: true,
      enabled: true,
    });
    assert.ok(state.calls.some((call) => call.path === "/api/groups" && call.query === "?name=Development%20Server"));
    assert.doesNotMatch(result.stdout + result.stderr, new RegExp(secret));
  });
});

test("is idempotent and does not create duplicate objects on the second run", async () => {
  const state = fixtureState();
  await withFixture(state, async (url, tokenFile) => {
    assert.equal((await runScript(url, tokenFile)).status, 0);
    const postCount = state.calls.filter((call) => call.method === "POST").length;
    assert.equal((await runScript(url, tokenFile)).status, 0);
    assert.equal(state.calls.filter((call) => call.method === "POST").length, postCount);
  });
});

test("accepts null for empty NetBird resource and router collections", async () => {
  const state = fixtureState({ resourcesResponse: null, routersResponse: null });
  await withFixture(state, async (url, tokenFile) => {
    const result = await runScript(url, tokenFile);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(state.resources.length, 1);
    assert.equal(state.routers.length, 1);
  });
});

test("requires an exact 0600 token file before making any API request", async () => {
  const state = fixtureState();
  await withFixture(state, async (url, tokenFile) => {
    chmodSync(tokenFile, 0o644);
    const result = await runScript(url, tokenFile);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /mode 0600/);
    assert.equal(state.calls.length, 0);
    assert.doesNotMatch(result.stdout + result.stderr, new RegExp(secret));
  });
});

test("refuses non-local plain HTTP before sending the token", async () => {
  const state = fixtureState();
  await withFixture(state, async (url, tokenFile) => {
    const result = await runScript(url, tokenFile, {
      NETBIRD_MANAGEMENT_URL: "http://example.com",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /HTTPS or fixture-local HTTP/);
    assert.equal(state.calls.length, 0);
    assert.doesNotMatch(result.stdout + result.stderr, new RegExp(secret));
  });
});

test("refuses an Edge host address as the HaVip", async () => {
  const state = fixtureState();
  await withFixture(state, async (url, tokenFile) => {
    const result = await runScript(url, tokenFile, {
      PROJECTWING_HAVIP_ADDRESS: "172.19.143.157",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must not reuse an Edge host address/);
    assert.equal(state.calls.length, 0);
  });
});

test("fails closed when a named resource has conflicting address or group", async () => {
  const state = fixtureState({
    networks: [{ id: "network-1", name: "ProjectWing Development Edge" }],
    resources: [{
      id: "resource-existing", type: "host", name: "ProjectWing Edge HaVip",
      address: "172.19.143.201/32", enabled: true, groups: [{ id: "group-all" }],
    }],
  });
  await withFixture(state, async (url, tokenFile) => {
    const result = await runScript(url, tokenFile);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /conflicts/);
    assert.equal(state.calls.filter((call) => call.method === "POST").length, 0);
  });
});

test("fails closed when the existing grouped router has wrong route properties", async () => {
  const state = fixtureState({
    networks: [{ id: "network-1", name: "ProjectWing Development Edge" }],
    resources: [{
      id: "resource-existing", type: "host", name: "ProjectWing Edge HaVip",
      address: "172.19.143.200/32", enabled: true, groups: [{ id: "group-all" }],
    }],
    routers: [{
      id: "router-existing", peer_groups: ["group-development"],
      metric: 999, masquerade: true, enabled: true,
    }],
  });
  await withFixture(state, async (url, tokenFile) => {
    const result = await runScript(url, tokenFile);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /conflicts/);
    assert.equal(state.calls.filter((call) => call.method === "POST").length, 0);
  });
});
