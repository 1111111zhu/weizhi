import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DesktopAgentSnapshot } from "../shared/desktop-agent-api";
import { DesktopAgentI18nProvider } from "./i18n";
import { SessionPage } from "./session-pages";

const snapshot: DesktopAgentSnapshot = {
  state: "ATTENTION",
  version: "fixture",
  attentionCount: 1,
  error: null,
  user: {
    id: "u",
    name: "Fixture",
    email: "fixture@example.invalid",
    globalRole: "USER",
  },
  sessions: [
    {
      sessionId: "open",
      fileName: "open-file.xlsx",
      projectId: "p",
      status: "OPEN",
      lifecycleState: "OPEN",
      mode: "MASTER",
    },
    {
      sessionId: "missing",
      fileName: "missing-file.xlsx",
      projectId: "p",
      status: "LOCAL_FILE_MISSING",
      lifecycleState: "LOCAL_FILE_MISSING",
      mode: "MASTER",
    },
  ],
  recentFiles: [
    {
      projectId: "recent-project",
      attachmentId: "recent-attachment",
      fileName: "recent-file.docx",
      mode: "READ_ONLY",
      openedAt: "2026-09-07T01:00:00.000Z",
      closedAt: "2026-09-07T02:00:00.000Z",
    },
  ],
};
describe("file workspace views", () => {
  afterEach(() => vi.unstubAllGlobals());
  const render = (issues: boolean) => {
    vi.stubGlobal("navigator", { language: "en-US" });
    return renderToStaticMarkup(
      <DesktopAgentI18nProvider>
        <SessionPage
          snapshot={snapshot}
          issues={issues}
          refresh={vi.fn()}
          headerHost={null}
        />
      </DesktopAgentI18nProvider>
    );
  };
  it("does not mix historical failures into open files", () => {
    const markup = render(false);
    expect(markup).toContain("open-file.xlsx");
    expect(markup).toContain("recent-file.docx");
    expect(markup).toContain("without reopening or locking");
    expect(markup).not.toContain("missing-file.xlsx");
  });
  it("provides a named resolve action without a permanent empty detail pane", () => {
    const markup = render(true);
    expect(markup).toContain("missing-file.xlsx");
    expect(markup).toContain('aria-label="Resolve · missing-file.xlsx"');
    expect(markup).not.toContain("open-file.xlsx");
    expect(markup).not.toContain("Select a record");
    expect(markup).not.toContain("Downloading again");
  });
});
