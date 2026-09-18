import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, chmod, copyFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";

const preparedExecutables = new Map<string, Promise<string>>();

export function ensureExecutableFile(filePath: string, copyName?: string) {
  if (process.platform === "win32") {
    return Promise.resolve(filePath);
  }
  const cached = preparedExecutables.get(filePath);
  if (cached) {
    return cached;
  }
  const prepared = prepareExecutableFile(filePath, copyName);
  preparedExecutables.set(filePath, prepared);
  return prepared;
}

async function prepareExecutableFile(filePath: string, copyName?: string) {
  if (await canExecute(filePath)) {
    return filePath;
  }

  try {
    await chmod(filePath, 0o755);
    if (await canExecute(filePath)) {
      return filePath;
    }
  } catch {
    // Fall back to a temp copy below. node_modules may be read-only in deploys.
  }

  const targetPath = await copyExecutableToTemp(filePath, copyName);
  if (await canExecute(targetPath)) {
    return targetPath;
  }
  throw new Error(`Executable file is not runnable: ${filePath}`);
}

async function canExecute(filePath: string) {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function copyExecutableToTemp(filePath: string, copyName?: string) {
  const executableDir = pathModule.join(tmpdir(), "projectwing-executables");
  const hash = createHash("sha256").update(filePath).digest("hex").slice(0, 12);
  const safeName = sanitizeExecutableName(
    copyName ?? pathModule.basename(filePath)
  );
  const targetPath = pathModule.join(executableDir, `${safeName}-${hash}`);
  await mkdir(executableDir, { recursive: true });
  await copyFile(filePath, targetPath);
  await chmod(targetPath, 0o755);
  return targetPath;
}

function sanitizeExecutableName(value: string) {
  const sanitized = value.replaceAll(/[^a-zA-Z0-9._-]/g, "_").trim();
  return sanitized || "executable";
}
