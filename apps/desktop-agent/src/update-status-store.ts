import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import pathModule from "node:path";
import { setTimeout } from "node:timers/promises";

import { DesktopAgentUpdateStatusResponseSchema } from "@project-wing/shared/desktop";
import type { DesktopAgentUpdateStatusResponse } from "@project-wing/shared/desktop";

const { dirname, join } = pathModule;

const UPDATE_STATUS_FILE = "update-status.json";

export function getUpdateStatusPath(stateRoot: string) {
  return join(stateRoot, UPDATE_STATUS_FILE);
}

export function createUpdateStatusStore(stateRoot: string) {
  const statusPath = getUpdateStatusPath(stateRoot);

  return {
    async read(): Promise<DesktopAgentUpdateStatusResponse | null> {
      let raw: string;
      try {
        raw = await readFile(statusPath, "utf-8");
      } catch (error) {
        if (getErrorCode(error) === "ENOENT") {
          return null;
        }
        return buildFailedStatus(
          `Could not read Desktop Agent update status: ${getErrorMessage(error)}`
        );
      }

      try {
        return DesktopAgentUpdateStatusResponseSchema.parse(JSON.parse(raw));
      } catch (error) {
        return buildFailedStatus(
          `Desktop Agent update status is corrupt: ${getErrorMessage(error)}`
        );
      }
    },

    async write(status: DesktopAgentUpdateStatusResponse): Promise<void> {
      const parsed = DesktopAgentUpdateStatusResponseSchema.parse(status);
      await mkdir(dirname(statusPath), { recursive: true });
      const tempPath = `${statusPath}.${randomUUID()}.tmp`;
      try {
        await writeFile(
          tempPath,
          `${JSON.stringify(parsed, null, 2)}\n`,
          "utf-8"
        );
        await replaceFile(tempPath, statusPath);
      } catch (error) {
        await rm(tempPath, { force: true }).catch(() => {});
        throw error;
      }
    },
  };
}

function buildFailedStatus(message: string): DesktopAgentUpdateStatusResponse {
  const now = new Date().toISOString();
  return DesktopAgentUpdateStatusResponseSchema.parse({
    ok: true,
    status: "FAILED",
    errorCode: "UNKNOWN_ERROR",
    message,
    updatedAt: now,
  });
}

async function replaceFile(tempPath: string, statusPath: string) {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await rename(tempPath, statusPath);
      return;
    } catch (error) {
      if (
        attempt === maxAttempts ||
        !["EBUSY", "EPERM"].includes(getErrorCode(error) ?? "")
      ) {
        throw error;
      }
      await setTimeout(10);
    }
  }
}

function getErrorCode(error: unknown) {
  return typeof error === "object" && error && "code" in error
    ? String(error.code)
    : undefined;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
