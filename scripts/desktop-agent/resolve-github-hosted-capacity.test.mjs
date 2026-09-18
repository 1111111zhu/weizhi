import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateHostedCapacity,
  resolveCapacity,
} from "./resolve-github-hosted-capacity.mjs";

test("enables hosted builders only when shared included minutes cover this build", () => {
  const usage = [
    {
      discountAmount: 11.4,
      product: "Actions",
      unitType: "minutes",
    },
  ];

  assert.equal(evaluateHostedCapacity("free", usage, 100).available, true);
  assert.equal(evaluateHostedCapacity("free", usage, 101).available, false);
});

test("normalizes included discounts to Linux-equivalent minutes", () => {
  const capacity = evaluateHostedCapacity(
    "free",
    [
      {
        discountAmount: 0.6,
        product: "Actions",
        unitType: "minutes",
      },
    ],
    384
  );

  assert.equal(capacity.consumedIncludedMinutes, 100);
  assert.equal(capacity.remainingIncludedMinutes, 1900);
  assert.match(capacity.reason, /1,900 included minutes remain/);
});

test("ignores Actions storage when calculating shared included minutes", () => {
  const capacity = evaluateHostedCapacity(
    "free",
    [
      {
        discountAmount: 11,
        product: "Actions",
        unitType: "gigabyte-hours",
      },
    ],
    384
  );

  assert.equal(capacity.available, true);
  assert.match(capacity.reason, /2,000 included minutes remain/);
});

test("fails preflight when the billing credential is unavailable", async () => {
  await assert.rejects(
    resolveCapacity({
      owner: "fin-agent-lab",
      requiredMinutes: 384,
      token: "",
    }),
    /requires GH_BILLING_READ_TOKEN/
  );
});

test("rejects plan assumptions that are not explicitly modeled", () => {
  assert.throws(
    () => evaluateHostedCapacity("team", [], 384),
    /Unsupported GitHub plan/
  );
});
