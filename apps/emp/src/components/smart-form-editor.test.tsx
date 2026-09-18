import {
  DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
  DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
} from "@project-wing/shared";
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SmartFormEditor } from "./smart-form-editor";

describe("lint test setup", () => {
  afterEach(cleanup);

  describe(SmartFormEditor, () => {
    it("offers a reversible focus mode for sustained form entry", async () => {
      const user = userEvent.setup();
      render(
        <SmartFormEditor
          mode="MASTER"
          locale="zh-CN"
          fileName="audit.sf"
          package={{
            packageType: "PROJECT_WING_SMART_FORM",
            formatVersion: 2,
            template: {
              id: "template-1",
              versionId: "version-1",
              code: "SF-1",
              title: "Audit form",
              publishedAt: "2026-08-01T00:00:00.000Z",
              language: "zh-CN",
            },
            definition: DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
            response: structuredClone(
              DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE
            ),
            createdAt: "2026-08-01T00:00:00.000Z",
            updatedAt: "2026-08-01T00:00:00.000Z",
          }}
        />
      );

      const enterFocus = screen.getByRole("button", { name: "Focus mode" });
      const editor = enterFocus.closest("section");
      expect(editor).toHaveClass("border", "bg-muted/30");
      expect(editor).not.toHaveClass("fixed");

      await user.click(enterFocus);
      expect(editor).toHaveClass("fixed", "inset-0");
      expect(editor).not.toHaveClass("border", "bg-muted/30");
      await user.click(screen.getByRole("button", { name: "Exit focus mode" }));
      expect(editor).not.toHaveClass("fixed");
    });

    it("browses current working papers through a hierarchical reference picker", async () => {
      const user = userEvent.setup();
      render(
        <SmartFormEditor
          mode="MASTER"
          locale="zh-CN"
          fileName="audit.sf"
          workingPaperOptions={[
            {
              id: "paper-1",
              code: "C-01-F001",
              title: "Cash current year lead schedule.xlsx",
              path: "Planning › A1 - 1000 › C-01-F001",
              pathSegments: ["Planning", "A1 - 1000"],
            },
          ]}
          package={{
            packageType: "PROJECT_WING_SMART_FORM",
            formatVersion: 2,
            template: {
              id: "template-1",
              versionId: "version-1",
              code: "SF-1",
              title: "Audit form",
              publishedAt: "2026-08-01T00:00:00.000Z",
              language: "zh-CN",
            },
            definition: DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
            response: structuredClone(
              DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE
            ),
            createdAt: "2026-08-01T00:00:00.000Z",
            updatedAt: "2026-08-01T00:00:00.000Z",
          }}
        />
      );

      await user.click(
        screen.getAllByRole("button", { name: "Add reference" })[0]
      );
      expect(
        screen.getByRole("tree", { name: "Add reference" })
      ).toBeInTheDocument();
      const results = document.querySelector(
        '[data-slot="smart-form-reference-results"]'
      );
      const search = screen.getByRole("textbox", {
        name: "Search working papers",
      });
      expect(results).not.toBeNull();
      await user.type(search, "missing paper");
      expect(
        screen.getByText("No matching working papers")
      ).toBeInTheDocument();
      expect(
        document.querySelector('[data-slot="smart-form-reference-results"]')
      ).toBe(results);
      await user.clear(search);
      expect(
        screen.getByRole("tree", { name: "Add reference" })
      ).toBeInTheDocument();
      expect(
        document.querySelector('[data-slot="smart-form-reference-results"]')
      ).toBe(results);
      await user.click(
        screen.getByRole("treeitem", {
          name: "Expand folder: A1 - 1000",
        })
      );
      const workingPaper = screen.getByRole("treeitem", {
        name: /C-01-F001.*Cash current year lead schedule\.xlsx/,
      });
      await user.click(workingPaper);
      expect(workingPaper).toHaveAttribute("aria-selected", "true");
    });

    it("saves the editor's current unsaved response as a draft before closing", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <SmartFormEditor
          mode="MASTER"
          locale="zh-CN"
          fileName="audit.sf"
          package={{
            packageType: "PROJECT_WING_SMART_FORM",
            formatVersion: 2,
            template: {
              id: "template-1",
              versionId: "version-1",
              code: "SF-1",
              title: "Audit form",
              publishedAt: "2026-08-01T00:00:00.000Z",
              language: "zh-CN",
            },
            definition: DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
            response: structuredClone(
              DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE
            ),
            createdAt: "2026-08-01T00:00:00.000Z",
            updatedAt: "2026-08-01T00:00:00.000Z",
          }}
          onClose={onClose}
        />
      );

      expect(
        screen.queryByRole("button", { name: "编辑标题与说明" })
      ).not.toBeInTheDocument();

      await user.click(screen.getAllByRole("combobox", { name: "Select" })[0]);
      await user.click(
        await screen.findByRole("option", { name: "Not selected" })
      );
      await user.click(screen.getByRole("button", { name: "Save as draft" }));

      expect(onClose).toHaveBeenCalledOnce();
      expect(onClose.mock.calls[0][0].definition).toStrictEqual(
        DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE
      );
      expect(
        onClose.mock.calls[0][0].response.sheets[
          "deferred-income-general-procedures"
        ].rows[0].cells["test-required"]
      ).toStrictEqual({ type: "choice", selectedOptionIds: [] });
    }, 30_000);
  });
});
