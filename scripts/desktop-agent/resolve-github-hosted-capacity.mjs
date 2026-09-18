#!/usr/bin/env node

import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const INCLUDED_ACTIONS_MINUTES = 2_000;
// Included usage is normalized against the current Linux x64 list price.
export const LINUX_BASE_RATE_USD_PER_MINUTE = 0.006;
export const DEFAULT_REQUIRED_INCLUDED_MINUTES = 384;

const token = process.env.GH_BILLING_READ_TOKEN?.trim();
const owner = process.env.GITHUB_REPOSITORY_OWNER?.trim();
const requiredMinutes = parseRequiredMinutes(
  process.env.GH_BILLING_REQUIRED_INCLUDED_MINUTES
);

if (isMainModule()) {
  const capacity = await resolveCapacity({ owner, requiredMinutes, token });
  await writeOutputs(capacity);
  process.stdout.write(`${capacity.reason}\n`);
}

export async function resolveCapacity({
  owner: organization,
  requiredMinutes: required,
  token: accessToken,
}) {
  if (!organization || !accessToken) {
    throw new Error(
      "GitHub-hosted capacity preflight requires GH_BILLING_READ_TOKEN."
    );
  }

  const [organizationDetails, usage] = await Promise.all([
    githubRequest(`/orgs/${organization}`, accessToken),
    githubRequest(
      `/organizations/${organization}/settings/billing/usage/summary?product=Actions`,
      accessToken,
      "2026-03-10"
    ),
  ]);
  return evaluateHostedCapacity(
    organizationDetails.plan?.name,
    usage.usageItems,
    required
  );
}

export function evaluateHostedCapacity(plan, usageItems, requiredMinutes) {
  if (plan !== "free") {
    throw new Error(
      `Unsupported GitHub plan for Actions included-minutes preflight: ${plan ?? "unknown"}.`
    );
  }

  const consumedIncludedMinutes = (usageItems ?? [])
    .filter((item) => item.product === "Actions" && item.unitType === "minutes")
    .reduce(
      (total, item) =>
        total +
        numberOrZero(item.discountAmount) / LINUX_BASE_RATE_USD_PER_MINUTE,
      0
    );
  const remainingMinutes = Math.max(
    0,
    INCLUDED_ACTIONS_MINUTES - consumedIncludedMinutes
  );
  const required = parseRequiredMinutes(requiredMinutes);
  const available = remainingMinutes >= required;
  const remaining = formatMinutes(remainingMinutes);
  const reserved = formatMinutes(required);
  return {
    available,
    consumedIncludedMinutes,
    remainingIncludedMinutes: remainingMinutes,
    reason: available
      ? `GitHub-hosted runners enabled: ${remaining} included minutes remain; this build reserves ${reserved}.`
      : `GitHub-hosted runners skipped: ${remaining} included minutes remain; this build requires ${reserved}.`,
  };
}

async function githubRequest(path, accessToken, apiVersion = "2022-11-28") {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": apiVersion,
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status}`);
  }
  return response.json();
}

async function writeOutputs(capacity) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    throw new Error("GITHUB_OUTPUT is unavailable.");
  }
  await appendFile(
    outputPath,
    `available=${capacity.available}\nreason=${capacity.reason}\n`,
    "utf-8"
  );
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function parseRequiredMinutes(value) {
  const parsed = Number(value ?? DEFAULT_REQUIRED_INCLUDED_MINUTES);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(
      `Invalid required GitHub Actions included minutes: ${value}`
    );
  }
  return parsed;
}

function formatMinutes(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function isMainModule() {
  return (
    process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
  );
}
