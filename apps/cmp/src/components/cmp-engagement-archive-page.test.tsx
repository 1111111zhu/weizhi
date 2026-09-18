import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CmpI18nProvider } from "../i18n/client";
import {
  ArchiveWorkflowNavigation,
  type ArchiveWorkflowMode,
} from "./cmp-engagement-archive-page";

function renderNavigation(mode: ArchiveWorkflowMode) {
  return render(
    <CmpI18nProvider initialLocale="en-US">
      <ArchiveWorkflowNavigation currentMode={mode} engagementId="eng-001" />
    </CmpI18nProvider>
  );
}

describe("ArchiveWorkflowNavigation", () => {
  it.each([
    ["edit", /prepare/i],
    ["review", /review/i],
    ["confirm", /archive/i],
  ] as const)("marks %s as the current workflow step", (mode, label) => {
    renderNavigation(mode);

    expect(screen.getByRole("link", { name: label })).toHaveAttribute(
      "aria-current",
      "step"
    );
  });

  it("keeps the three route links and document anchors available", () => {
    renderNavigation("review");

    expect(screen.getByRole("link", { name: /prepare/i })).toHaveAttribute(
      "href",
      "/en-US/engagement/eng-001/archive"
    );
    expect(screen.getByRole("link", { name: /archive/i })).toHaveAttribute(
      "href",
      "/en-US/engagement/eng-001/archive/confirm"
    );
    expect(
      screen.getByRole("link", { name: /project overview/i })
    ).toHaveAttribute("href", "#archive-overview");
    expect(
      screen.getByRole("link", { name: /people and budget/i })
    ).toHaveAttribute("href", "#archive-budget");
  });
});
