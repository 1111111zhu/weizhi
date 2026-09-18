import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = fs.readFileSync(
  path.resolve(import.meta.dirname, "deployment-health.sh"),
  "utf8",
);

function functionSource(name, nextName) {
  return source.slice(source.indexOf(`${name}() {`), source.indexOf(`${nextName}() {`));
}

test("API probes keep the strict 15-second response budget", () => {
  const apiProbe = functionSource("pw_verify_api_route", "pw_verify_frontend_route");
  assert.match(apiProbe, /--connect-timeout 5 --max-time 15/);
});

test("frontend identity probes allow bounded low-memory cold responses", () => {
  const frontendProbe = functionSource("pw_verify_frontend_route", "pw_wait_for_compose_service");
  assert.match(frontendProbe, /--connect-timeout 5 --max-time 30/);
});
