import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

export async function createRuntimeIntegrityManifest(directory) {
  const files = {};
  async function visit(relativeDirectory) {
    const entries = await readdir(path.join(directory, relativeDirectory), {
      withFileTypes: true,
    });
    for (const entry of entries.sort((left, right) =>
      left.name.localeCompare(right.name)
    )) {
      const relative = path.join(relativeDirectory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error("Runtime payload may not contain redirected files.");
      }
      if (entry.isDirectory()) {
        await visit(relative);
      } else if (entry.isFile()) {
        const hash = createHash("sha256");
        for await (const chunk of createReadStream(
          path.join(directory, relative)
        )) {
          hash.update(chunk);
        }
        files[relative.split(path.sep).join("/")] = hash.digest("hex");
      }
    }
  }
  await visit("");
  if (
    !Object.keys(files).some((name) =>
      /(^|\/)ProjectWing\.AgentManager(\.exe)?$/.test(name)
    )
  ) {
    throw new Error(
      "Runtime integrity manifest is missing its Manager executable."
    );
  }
  return { schemaVersion: 1, files };
}
