import { readFile } from "node:fs/promises";
import pathModule from "node:path";

import plist from "plist";

import { assertEqual } from "./runtime-test-support.mjs";

const { join } = pathModule;

export const repositoryRoot = join(import.meta.dirname, "../../..");

export async function assertFileContains(
  relativePath,
  requiredValues,
  rejectTemplateMarkers = true
) {
  const contents = await readFile(join(repositoryRoot, relativePath), "utf-8");
  for (const required of requiredValues) {
    assertEqual(contents.includes(required), true);
  }
  if (rejectTemplateMarkers) {
    assertEqual(contents.includes("{{"), false);
  }
}

export function parsePlist(contents) {
  try {
    plist.parse(contents);
    return { status: 0 };
  } catch {
    return { status: 1 };
  }
}
