import { describe, expect, it } from "vitest";

import {
  compactWorkbenchLayout,
  reconcileWorkbenchLayout,
} from "./workbench-compact-layout";

describe("compact workbench layout", () => {
  it.each(["files", "directory", "preview", "notes", "tasks"] as const)(
    "gives %s the entire available pane",
    (pane) => {
      const layout = compactWorkbenchLayout(pane, true);
      expect(
        Object.values(layout.horizontal).filter((size) => size > 0)
      ).toStrictEqual([100]);
      expect(
        Object.values(layout.vertical).filter((size) => size > 0)
      ).toStrictEqual([100]);
      expect(layout.vertical["project-file-review-notes"]).toBe(
        pane === "notes" ? 100 : 0
      );
    }
  );

  it("falls back to files when tasks are closed", () => {
    expect(compactWorkbenchLayout("tasks", false).horizontal).toStrictEqual({
      "project-directory": 0,
      "project-review": 100,
      "project-file-preview": 0,
      "project-team-work-items": 0,
    });
  });

  it("restores proportions without resurrecting removed panes", () => {
    expect(
      reconcileWorkbenchLayout(
        { files: 50, directory: 25, tasks: 25 },
        { files: 100, directory: 0 }
      )
    ).toStrictEqual({ files: 200 / 3, directory: 100 / 3 });
  });
});
