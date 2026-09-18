#!/usr/bin/env node

import { appendFile, readFile } from "node:fs/promises";

const manifest = JSON.parse(
  await readFile(
    new URL("../../apps/desktop-agent-desktop/package.json", import.meta.url),
    "utf-8"
  )
);
const versionMatch = /^(\d+)\.(\d+)\.(\d+)$/.exec(manifest.version);
if (!versionMatch) {
  throw new Error("Desktop Agent package version must be plain SemVer.");
}

const [, major, minor, packagePatch] = versionMatch;
const releasePattern = new RegExp(
  `^desktop-agent-v${major}\\.${minor}\\.(\\d+)$`
);
let releasePatch = Number(packagePatch);

for (const release of await listReleases()) {
  const match = releasePattern.exec(release.tag_name);
  if (match) {
    releasePatch = Math.max(releasePatch, Number(match[1]) + 1);
  }
}

const automaticVersion = `${major}.${minor}.${releasePatch}`;
const releaseVersion = resolveVersionOverride(automaticVersion, major, minor);
const changelog = await readFile(
  new URL("../../apps/desktop-agent-desktop/CHANGELOG.md", import.meta.url),
  "utf-8"
);
const releaseNote = readReleaseNote(changelog, manifest.version);
const outputs = {
  "package-version": manifest.version,
  "release-version": releaseVersion,
  "release-note": releaseNote,
};

if (process.env.GITHUB_OUTPUT) {
  await appendFile(
    process.env.GITHUB_OUTPUT,
    Object.entries(outputs)
      .map(([name, value]) => `${name}=${value}\n`)
      .join("")
  );
}
process.stdout.write(`${JSON.stringify(outputs)}\n`);

async function listReleases() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (!repository || !token) {
    return [];
  }
  const response = await fetch(
    `https://api.github.com/repos/${repository}/releases?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "project-wing-release",
      },
    }
  );
  if (!response.ok) {
    throw new Error(
      `GitHub release lookup failed with HTTP ${response.status}.`
    );
  }
  return response.json();
}

function readReleaseNote(contents, packageVersion) {
  const section = contents.match(
    new RegExp(
      `^## ${packageVersion.replaceAll(".", String.raw`\.`)}\\s*\\n+([\\s\\S]*?)(?=^## |$)`,
      "m"
    )
  );
  const item = section?.[1].match(/^[-*] (.+)$/m)?.[1]?.trim();
  if (!item) {
    throw new Error(`CHANGELOG.md has no release note for ${packageVersion}.`);
  }
  return item;
}

function resolveVersionOverride(calculatedVersion, releaseMajor, releaseMinor) {
  const override =
    process.env.DESKTOP_AGENT_RELEASE_VERSION_OVERRIDE?.trim() ?? "";
  if (!override) {
    return calculatedVersion;
  }
  if (!/^\d+\.\d+\.\d+$/.test(override)) {
    throw new Error(
      "Desktop Agent release version override must be plain SemVer."
    );
  }
  if (!override.startsWith(`${releaseMajor}.${releaseMinor}.`)) {
    throw new Error(
      "Desktop Agent release version override must match the package series."
    );
  }
  return override;
}
