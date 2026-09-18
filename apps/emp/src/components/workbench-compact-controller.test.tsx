// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkbenchCompactController } from "./workbench-compact-controller";

describe(WorkbenchCompactController, () => {
  afterEach(() => vi.unstubAllGlobals());

  it("switches compact panes, restores wide proportions once, and releases the measurement guard on a wide mount", async () => {
    const frames = new Map<number, FrameRequestCallback>();
    let frameId = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frameId += 1;
      frames.set(frameId, callback);
      return frameId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    function group(initial: Record<string, number>) {
      let layout = initial;
      return {
        current: {
          getLayout: () => layout,
          setLayout: vi.fn((next: Record<string, number>) => {
            layout = next;
            return layout;
          }),
        },
      };
    }
    const horizontal = group({
      "project-directory": 20,
      "project-review": 65,
      "project-file-preview": 15,
      "project-team-work-items": 0,
    });
    const vertical = group({
      "project-files-workspace": 70,
      "project-file-review-notes": 30,
    });
    const original = {
      horizontal: horizontal.current.getLayout(),
      vertical: vertical.current.getLayout(),
    };
    const element = { current: document.createElement("div") };
    const onRestore = vi.fn();
    const root = createRoot(element.current);
    const render = async (
      compact: boolean,
      pane: "files" | "notes" | "preview"
    ) => {
      await act(() =>
        root.render(
          <WorkbenchCompactController
            {...{ compact, pane, horizontal, vertical, element, onRestore }}
            tasksOpen={false}
          />
        )
      );
      await act(() => {
        const pending = [...frames.values()];
        frames.clear();
        pending.forEach((callback) => callback(0));
      });
    };
    try {
      await render(false, "files");
      expect(onRestore).toHaveBeenLastCalledWith(null);
      await render(true, "preview");
      expect(horizontal.current.getLayout()["project-file-preview"]).toBe(100);
      await render(true, "notes");
      expect(vertical.current.getLayout()["project-file-review-notes"]).toBe(
        100
      );
      await render(false, "notes");
      expect(horizontal.current.getLayout()).toStrictEqual(original.horizontal);
      expect(vertical.current.getLayout()).toStrictEqual(original.vertical);
      expect(onRestore).toHaveBeenLastCalledWith(original);
      horizontal.current.setLayout({
        "project-directory": 25,
        "project-review": 60,
        "project-file-preview": 15,
      });
      await render(false, "files");
      expect(horizontal.current.getLayout()["project-directory"]).toBe(25);
      expect(onRestore).toHaveBeenLastCalledWith(null);
    } finally {
      await act(() => root.unmount());
    }
  });
});
