import { cleanup, render, screen } from "@testing-library/react";
// @vitest-environment happy-dom
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { ProjectFrameworkBadge } from "./project-framework-badge";

describe("lint test setup", () => {
  describe("project framework badge test setup", () => {
    afterEach(cleanup);

    describe(ProjectFrameworkBadge, () => {
      it("renders a framework code with the template name as its accessible label", () => {
        render(
          createElement(ProjectFrameworkBadge, {
            frameworkTemplate: {
              id: "framework-hkfrs",
              code: "HKFRS",
              name: "HKFRS audit framework",
              language: "zh-CN",
              isActive: true,
            },
          })
        );

        expect(screen.getByLabelText("HKFRS audit framework")).toBeTruthy();
        expect(screen.getByText("HKFRS")).toBeTruthy();
      });

      it("falls back to the framework template id when the relation is unavailable", () => {
        render(
          createElement(ProjectFrameworkBadge, {
            frameworkTemplateId: "framework-custom",
          })
        );

        expect(screen.getByLabelText("framework-custom")).toBeTruthy();
      });
    });
  });
});
