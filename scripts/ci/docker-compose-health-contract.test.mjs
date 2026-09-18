import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const compose = fs.readFileSync(
  path.resolve(import.meta.dirname, "../../docker-compose.development.yml"),
  "utf8",
);

function serviceSource(name, nextName) {
  const start = compose.indexOf(`  ${name}:\n`);
  const end = compose.indexOf(`  ${nextName}:\n`, start + 1);
  return compose.slice(start, end);
}

const frontendServices = [
  ["emp", "cmp"],
  ["cmp", "showroom"],
  ["showroom", "tms"],
  ["tms", "intranet"],
  ["intranet", "ib"],
  ["ib", "api"],
];

test("frontend health checks probe quickly only during startup", () => {
  for (const [name, nextName] of frontendServices) {
    const service = serviceSource(name, nextName);
    assert.match(service, /interval: 30s/, `${name} steady interval`);
    assert.match(service, /start_interval: 5s/, `${name} startup interval`);
    assert.match(service, /start_period: 120s/, `${name} startup grace`);
    assert.match(service, /retries: 3/, `${name} failure threshold`);
  }
});
