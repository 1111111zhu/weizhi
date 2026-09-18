import { describe, expect, it } from "vitest";

import { readCanvasDataGridPalette } from "./canvas-data-grid-palette";

describe(readCanvasDataGridPalette, () => {
  it("resolves public CSS tokens into canvas-compatible color strings", () => {
    const styles = {
      getPropertyValue: (token: string) => ` resolved(${token}) `,
    } as Pick<CSSStyleDeclaration, "getPropertyValue">;

    expect(readCanvasDataGridPalette(styles)).toStrictEqual({
      accentColor: "resolved(--project-wing-canvas-grid-accent)",
      accentLight: "resolved(--project-wing-canvas-grid-accent-soft)",
      accentFg: "resolved(--project-wing-canvas-grid-accent-foreground)",
      textDark: "resolved(--project-wing-canvas-grid-text-strong)",
      textMedium: "resolved(--project-wing-canvas-grid-text-medium)",
      textLight: "resolved(--project-wing-canvas-grid-text-light)",
      textBubble: "resolved(--project-wing-canvas-grid-text-bubble)",
      textHeader: "resolved(--project-wing-canvas-grid-text-header)",
      textGroupHeader: "resolved(--project-wing-canvas-grid-text-group-header)",
      bgCell: "resolved(--project-wing-canvas-grid-cell)",
      bgCellMedium: "resolved(--project-wing-canvas-grid-cell-subtle)",
      bgHeader: "resolved(--project-wing-canvas-grid-header)",
      bgHeaderHasFocus: "resolved(--project-wing-canvas-grid-header-focus)",
      bgHeaderHovered: "resolved(--project-wing-canvas-grid-header-hover)",
      borderColor: "resolved(--project-wing-canvas-grid-border)",
      horizontalBorderColor:
        "resolved(--project-wing-canvas-grid-border-horizontal)",
    });
  });

  it("uses a canvas-safe fallback before browser styles are available", () => {
    expect(
      Object.values(readCanvasDataGridPalette()).every(
        (value) => value === "currentColor"
      )
    ).toBeTruthy();
  });
});
