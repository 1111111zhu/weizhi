import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import { gzipSync } from "node:zlib";

import { createRemoteApiProxyServer } from "./dev-remote-api-proxy.mjs";

test("proxies EMP requests and maps the remote secure session cookie", async () => {
  const observedCookies = [];
  const observedAcceptEncodings = [];
  let observedOrigin = "";
  let observedPath = "";
  const upstream = createServer((request, response) => {
    observedCookies.push(request.headers.cookie ?? "");
    observedAcceptEncodings.push(request.headers["accept-encoding"] ?? "");
    observedPath = request.url ?? "";
    observedOrigin = request.headers.origin ?? "";
    response.setHeader(
      "Access-Control-Allow-Origin",
      request.headers.origin ?? ""
    );
    if (request.method === "POST") {
      response.setHeader(
        "Set-Cookie",
        "__Secure-project_wing.session_token=remote-token; Domain=.superfx.cn; Path=/; Secure; HttpOnly; SameSite=Lax"
      );
    }
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Content-Encoding", "gzip");
    response.end(gzipSync(JSON.stringify({ ok: true })));
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");

  const upstreamAddress = upstream.address();
  assert.equal(typeof upstreamAddress, "object");
  const remoteBaseUrl = `http://127.0.0.1:${upstreamAddress.port}/api`;
  const remoteOrigin = new URL(remoteBaseUrl).origin;
  const proxy = createRemoteApiProxyServer({
    allowedOrigin: "http://localhost:3001",
    remoteBaseUrl,
  });
  proxy.listen(0, "127.0.0.1");
  await once(proxy, "listening");
  const proxyAddress = proxy.address();
  assert.equal(typeof proxyAddress, "object");

  try {
    const loginResponse = await fetch(
      `http://127.0.0.1:${proxyAddress.port}/auth/development/impersonate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3001",
        },
        body: JSON.stringify({ email: "admin@projectwing.local" }),
      }
    );
    assert.equal(loginResponse.status, 200);
    assert.match(
      loginResponse.headers.get("set-cookie") ?? "",
      /project_wing_remote_session_token=remote-token/
    );
    assert.doesNotMatch(
      loginResponse.headers.get("set-cookie") ?? "",
      /Domain=|Secure/
    );
    assert.equal(
      loginResponse.headers.get("access-control-allow-origin"),
      "http://localhost:3001"
    );

    const switchAccountResponse = await fetch(
      `http://127.0.0.1:${proxyAddress.port}/auth/development/impersonate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "project_wing_remote_session_token=old-token",
          Origin: "http://localhost:3001",
        },
        body: JSON.stringify({ email: "other@projectwing.local" }),
      }
    );
    assert.equal(switchAccountResponse.status, 200);
    assert.equal(observedCookies[1], "");

    const dataResponse = await fetch(
      `http://127.0.0.1:${proxyAddress.port}/projects`,
      {
        headers: {
          Cookie: "project_wing_remote_session_token=old-token",
          Origin: "http://localhost:3001",
        },
      }
    );
    assert.equal(dataResponse.status, 200);
    assert.deepEqual(await dataResponse.json(), { ok: true });
    assert.equal(dataResponse.headers.get("content-encoding"), null);
    assert.equal(observedAcceptEncodings[2], "identity");
    assert.equal(
      observedCookies[2],
      "__Secure-project_wing.session_token=remote-token"
    );
    assert.equal(observedPath, "/api/projects");
    assert.equal(observedOrigin, remoteOrigin);
  } finally {
    proxy.close();
    upstream.close();
    await Promise.all([once(proxy, "close"), once(upstream, "close")]);
  }
});
