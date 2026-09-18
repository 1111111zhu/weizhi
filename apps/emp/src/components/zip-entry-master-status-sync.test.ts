import type { DesktopAgentSession } from "@project-wing/shared";
import { describe, expect, it } from "vitest";

import type { ZipMasterSessionResponse } from "../api/client";
import {
  getDesktopAgentProjectSessionSignature,
  hasMasterZipEntries,
  shouldRefreshZipMasterPanelForDesktopAgentChange,
} from "./zip-entry-master-status-sync";

const baseZipSession: ZipMasterSessionResponse = {
  ok: true,
  mode: "MASTER",
  projectId: "project-1",
  attachmentId: "zip-attachment-1",
  sessionId: "zip-session-1",
  lockSessionId: "zip-lock-1",
  fileName: "evidence.zip",
  version: 3,
  state: "OPEN",
  dirty: false,
  entries: [
    {
      type: "file",
      name: "support.pdf",
      path: "support.pdf",
      size: 1024,
    },
  ],
};
const desktopSession = {
  sessionId: "desktop-session-1",
  generation: 1,
  lockSessionId: "entry-lock-1",
  mode: "MASTER",
  projectId: "project-1",
  attachmentId: "zip-entry:entry-session-1",
  fileName: "support.pdf",
  localPath: "C:/tmp/support.pdf",
  originalHash: "hash-1",
  lastKnownHash: "hash-1",
  status: "OPEN_UNCHANGED",
  lifecycleState: "OPEN",
  contentState: "UNCHANGED",
  openedAt: "2026-07-02T00:00:00.000Z",
  launchStartedAt: "2026-07-02T00:00:00.000Z",
  lastSeenAt: "2026-07-02T00:00:00.000Z",
} satisfies DesktopAgentSession;

describe("zip entry Master status sync", () => {
  it("detects Master entries anywhere in the zip tree", () => {
    expect(
      hasMasterZipEntries([
        {
          type: "folder",
          name: "docs",
          path: "docs/",
          children: [
            {
              type: "file",
              name: "support.pdf",
              path: "docs/support.pdf",
              size: 1024,
              status: "MASTER",
              masterState: "OPEN",
            },
          ],
        },
      ])
    ).toBeTruthy();
  });

  it("refreshes a zip Master panel when local Agent sessions change while a Master badge is visible", () => {
    const sessionWithMasterEntry: ZipMasterSessionResponse = {
      ...baseZipSession,
      entries: [
        {
          type: "file",
          name: "support.pdf",
          path: "support.pdf",
          size: 1024,
          status: "MASTER",
          masterState: "OPEN",
        },
      ],
    };
    const previousSignature = getDesktopAgentProjectSessionSignature(
      [desktopSession],
      "project-1"
    );
    const nextSignature = getDesktopAgentProjectSessionSignature(
      [],
      "project-1"
    );

    expect(
      shouldRefreshZipMasterPanelForDesktopAgentChange({
        session: sessionWithMasterEntry,
        previousSignature,
        nextSignature,
      })
    ).toBeTruthy();
  });

  it("does not refresh when there is no visible Master entry", () => {
    expect(
      shouldRefreshZipMasterPanelForDesktopAgentChange({
        session: baseZipSession,
        previousSignature: "old",
        nextSignature: "new",
      })
    ).toBeFalsy();
  });
});
