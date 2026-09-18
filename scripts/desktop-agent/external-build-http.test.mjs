import assert from "node:assert/strict";
import test from "node:test";

import { fetchWithRetry, formatHttpFailure } from "./external-build-http.mjs";

test("retries a transient Azure connection reset", async () => {
  let calls = 0;
  const pauses = [];
  const response = await fetchWithRetry(
    "https://azure.example/build",
    {},
    {
      fetchImpl: () => {
        calls += 1;
        if (calls === 1) {
          const error = new TypeError("terminated");
          error.cause = { code: "ECONNRESET" };
          throw error;
        }
        return new Response("ok");
      },
      log: () => {},
      sleep: (milliseconds) => pauses.push(milliseconds),
    }
  );

  assert.equal(response.status, 200);
  assert.equal(calls, 2);
  assert.deepEqual(pauses, [1000]);
});

test("retries a request deadline expiry", async () => {
  let calls = 0;
  const response = await fetchWithRetry(
    "https://azure.example/build",
    {},
    {
      fetchImpl: (_url, options) => {
        assert.ok(options.signal);
        calls += 1;
        if (calls === 1) {
          throw new DOMException("deadline exceeded", "TimeoutError");
        }
        return new Response("ok");
      },
      log: () => {},
      sleep: () => {},
      timeoutMilliseconds: 10 ** 3,
    }
  );

  assert.equal(response.status, 200);
  assert.equal(calls, 2);
});

test("retries transient responses but returns the final response", async () => {
  let calls = 0;
  const response = await fetchWithRetry(
    "https://azure.example/build",
    {},
    {
      attempts: 2,
      fetchImpl: () => {
        calls += 1;
        return new Response("unavailable", { status: 503 });
      },
      log: () => {},
      sleep: () => {},
    }
  );

  assert.equal(response.status, 503);
  assert.equal(calls, 2);
});

test("can retry a newly created build that is briefly unavailable", async () => {
  let calls = 0;
  const response = await fetchWithRetry(
    "https://codemagic.example/build",
    {},
    {
      fetchImpl: () => {
        calls += 1;
        return calls === 1
          ? new Response("not found", { status: 404 })
          : new Response("ready");
      },
      log: () => {},
      retryStatusCodes: [404],
      sleep: () => {},
    }
  );

  assert.equal(response.status, 200);
  assert.equal(calls, 2);
});

test("includes a bounded provider response in terminal HTTP errors", async () => {
  const response = Response.json(
    { message: "Unexpected template parameter" },
    { status: 400 }
  );

  assert.equal(
    await formatHttpFailure(response, "Azure build start"),
    'Azure build start failed with HTTP 400: {"message":"Unexpected template parameter"}'
  );
});

test("redacts known credentials from provider error responses", async () => {
  const response = new Response("Invalid variable secret-value", {
    status: 400,
  });

  assert.equal(
    await formatHttpFailure(response, "Provider", ["secret-value"]),
    "Provider failed with HTTP 400: Invalid variable ***"
  );
});
