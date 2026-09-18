import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CmpDataGridStatusBadge } from "./cmp-data-grid-status-badge";

describe("CMP status color contract", () => {
  it.each(["warning", "success", "info", "destructive"] as const)(
    "%s retains a distinguishable tinted surface and readable foreground",
    (tone) => {
      const markup = renderToStaticMarkup(
        <CmpDataGridStatusBadge tone={tone}>状态</CmpDataGridStatusBadge>
      );
      expect(markup).toContain(`bg-${tone}-subtle`);
      expect(markup).toContain("text-foreground");
      expect(markup).toContain(`before:bg-${tone}-accent`);
      expect(markup).toContain("状态");
    }
  );

  it("keeps a draft neutral instead of giving it the editing accent", () => {
    const markup = renderToStaticMarkup(
      <CmpDataGridStatusBadge tone="neutral">草稿</CmpDataGridStatusBadge>
    );
    expect(markup).toContain("bg-secondary");
    expect(markup).toContain("text-secondary-foreground");
  });
});
