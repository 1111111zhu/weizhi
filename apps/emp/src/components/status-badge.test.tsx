import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "./status-badge";

describe("project status badge color contract", () => {
  it.each([
    ["green", "success"],
    ["sky", "info"],
    ["amber", "warning"],
  ] as const)(
    "%s uses the shared %s signal with readable text",
    (tone, semantic) => {
      const markup = renderToStaticMarkup(
        <StatusBadge tone={tone}>Status</StatusBadge>
      );
      expect(markup).toContain(`bg-${semantic}-subtle`);
      expect(markup).toContain(`before:bg-${semantic}-accent`);
      expect(markup).toContain("text-foreground");
      expect(markup).toContain("Status");
    }
  );

  it("retains a neutral draft and caller-supplied layout", () => {
    const markup = renderToStaticMarkup(
      <StatusBadge className="shrink-0">Draft</StatusBadge>
    );
    expect(markup).toContain("bg-secondary");
    expect(markup).toContain("shrink-0");
  });
});
