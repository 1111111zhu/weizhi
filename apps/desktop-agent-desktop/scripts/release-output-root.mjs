import path from "node:path";

export function resolveReleaseOutputRoot(
  repoRoot,
  configuredRoot,
  defaultRelativeRoot
) {
  return path.resolve(repoRoot, configuredRoot ?? defaultRelativeRoot);
}
