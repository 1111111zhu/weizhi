import { createServer } from "node:http";
import { Readable } from "node:stream";

export const LOCAL_REMOTE_SESSION_COOKIE = "project_wing_remote_session_token";
export const REMOTE_SESSION_COOKIE = "__Secure-project_wing.session_token";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);
const UPSTREAM_CORS_HEADERS = new Set([
  "access-control-allow-credentials",
  "access-control-allow-headers",
  "access-control-allow-methods",
  "access-control-allow-origin",
  "access-control-expose-headers",
  "access-control-max-age",
]);
const UPSTREAM_BODY_ENCODING_HEADERS = new Set(["content-encoding"]);

function mapRequestCookies(cookieHeader) {
  if (!cookieHeader) {
    return cookieHeader;
  }
  return cookieHeader
    .split(";")
    .map((part) => {
      const separator = part.indexOf("=");
      if (separator === -1) {
        return part.trim();
      }
      const name = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      return name === LOCAL_REMOTE_SESSION_COOKIE
        ? `${REMOTE_SESSION_COOKIE}=${value}`
        : part.trim();
    })
    .join("; ");
}

function mapResponseCookie(cookie) {
  const [pair, ...attributes] = cookie.split(";");
  const separator = pair.indexOf("=");
  if (separator === -1) {
    return cookie;
  }
  const name = pair.slice(0, separator).trim();
  const value = pair.slice(separator + 1);
  const mappedPair =
    name === REMOTE_SESSION_COOKIE
      ? `${LOCAL_REMOTE_SESSION_COOKIE}=${value}`
      : pair;
  const mappedAttributes = attributes.filter((attribute) => {
    const normalized = attribute.trim().toLowerCase();
    return !normalized.startsWith("domain=") && normalized !== "secure";
  });
  return [mappedPair, ...mappedAttributes].join(";");
}

function getSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const cookie = headers.get("set-cookie");
  return cookie ? [cookie] : [];
}

function updateRemoteSessionCookie(cookieHeader, setCookies) {
  let sessionCookie = cookieHeader;
  for (const cookie of setCookies) {
    const [pair] = cookie.split(";");
    const separator = pair.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const name = pair.slice(0, separator).trim();
    if (name !== REMOTE_SESSION_COOKIE) {
      continue;
    }
    const value = pair.slice(separator + 1).trim();
    sessionCookie = value ? `${REMOTE_SESSION_COOKIE}=${value}` : "";
  }
  return sessionCookie;
}

function setCorsHeaders(response, allowedOrigin) {
  response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept, X-Requested-With"
  );
  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS"
  );
  response.setHeader("Vary", "Origin");
}

export function createRemoteApiProxyServer({
  allowedOrigin = "http://localhost:3001",
  debug = false,
  remoteBaseUrl = "https://emp.superfx.cn/api",
} = {}) {
  const normalizedRemoteBaseUrl = remoteBaseUrl.replace(/\/$/, "");
  const remoteOrigin = new URL(normalizedRemoteBaseUrl).origin;
  let remoteSessionCookie;
  const log = (...values) => {
    if (debug) {
      console.log("[projectwing proxy]", ...values);
    }
  };

  return createServer(async (request, response) => {
    setCorsHeaders(response, allowedOrigin);

    if (request.method === "OPTIONS") {
      response.statusCode = 204;
      response.end();
      return;
    }

    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const targetUrl = `${normalizedRemoteBaseUrl}${requestUrl.pathname}${requestUrl.search}`;
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (
        HOP_BY_HOP_HEADERS.has(name) ||
        value === null ||
        value === undefined
      ) {
        continue;
      }
      headers.set(name, Array.isArray(value) ? value.join(", ") : value);
    }
    const isDevelopmentImpersonation =
      request.method === "POST" &&
      requestUrl.pathname === "/auth/development/impersonate";
    const cookieHeader = isDevelopmentImpersonation
      ? ""
      : (remoteSessionCookie ?? mapRequestCookies(request.headers.cookie));
    if (isDevelopmentImpersonation) {
      headers.delete("cookie");
    }
    log(
      request.method,
      requestUrl.pathname,
      `incomingCookie=${Boolean(request.headers.cookie)}`,
      `cachedCookie=${Boolean(remoteSessionCookie)}`
    );
    if (cookieHeader) {
      headers.set("cookie", cookieHeader);
    }
    headers.set("accept-encoding", "identity");
    headers.set("origin", remoteOrigin);

    try {
      const method = request.method ?? "GET";
      const upstream = await fetch(targetUrl, {
        method,
        headers,
        body: method === "GET" || method === "HEAD" ? undefined : request,
        duplex: method === "GET" || method === "HEAD" ? undefined : "half",
        redirect: "manual",
      });

      response.statusCode = upstream.status;
      for (const [name, value] of upstream.headers) {
        if (
          HOP_BY_HOP_HEADERS.has(name) ||
          name === "set-cookie" ||
          UPSTREAM_CORS_HEADERS.has(name) ||
          UPSTREAM_BODY_ENCODING_HEADERS.has(name)
        ) {
          continue;
        }
        response.setHeader(name, value);
      }
      const setCookies = getSetCookieHeaders(upstream.headers);
      remoteSessionCookie = updateRemoteSessionCookie(
        remoteSessionCookie,
        setCookies
      );
      const mappedCookies = setCookies.map(mapResponseCookie);
      if (mappedCookies.length > 0) {
        response.setHeader("Set-Cookie", mappedCookies);
      }
      log(
        request.method,
        requestUrl.pathname,
        `status=${upstream.status}`,
        `setSessionCookie=${setCookies.some((cookie) =>
          cookie.startsWith(`${REMOTE_SESSION_COOKIE}=`)
        )}`,
        `cachedCookie=${Boolean(remoteSessionCookie)}`
      );

      if (!upstream.body) {
        response.end();
        return;
      }
      Readable.fromWeb(upstream.body).pipe(response);
    } catch (error) {
      response.statusCode = 502;
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify({
          code: "REMOTE_API_UNAVAILABLE",
          message:
            error instanceof Error ? error.message : "Remote API unavailable",
        })
      );
    }
  });
}

function startFromCli() {
  const port = Number(process.env.PROJECTWING_REMOTE_API_PROXY_PORT ?? 3010);
  const server = createRemoteApiProxyServer({
    allowedOrigin:
      process.env.PROJECTWING_LOCAL_EMP_ORIGIN ?? "http://localhost:3001",
    debug: process.env.PROJECTWING_REMOTE_API_PROXY_DEBUG === "1",
    remoteBaseUrl:
      process.env.PROJECTWING_REMOTE_API_BASE_URL ??
      "https://emp.superfx.cn/api",
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(
      `[projectwing] EMP remote API proxy listening on http://127.0.0.1:${port}`
    );
  });
}

if (process.argv[1] === import.meta.filename) {
  startFromCli();
}
