export type CanvasDataGridPalette = {
  accentColor: string;
  accentLight: string;
  accentFg: string;
  textDark: string;
  textMedium: string;
  textLight: string;
  textBubble: string;
  textHeader: string;
  textGroupHeader: string;
  bgCell: string;
  bgCellMedium: string;
  bgHeader: string;
  bgHeaderHasFocus: string;
  bgHeaderHovered: string;
  borderColor: string;
  horizontalBorderColor: string;
};

type CssPropertyReader = Pick<CSSStyleDeclaration, "getPropertyValue">;

const canvasDataGridTokens = {
  accentColor: "--project-wing-canvas-grid-accent",
  accentLight: "--project-wing-canvas-grid-accent-soft",
  accentFg: "--project-wing-canvas-grid-accent-foreground",
  textDark: "--project-wing-canvas-grid-text-strong",
  textMedium: "--project-wing-canvas-grid-text-medium",
  textLight: "--project-wing-canvas-grid-text-light",
  textBubble: "--project-wing-canvas-grid-text-bubble",
  textHeader: "--project-wing-canvas-grid-text-header",
  textGroupHeader: "--project-wing-canvas-grid-text-group-header",
  bgCell: "--project-wing-canvas-grid-cell",
  bgCellMedium: "--project-wing-canvas-grid-cell-subtle",
  bgHeader: "--project-wing-canvas-grid-header",
  bgHeaderHasFocus: "--project-wing-canvas-grid-header-focus",
  bgHeaderHovered: "--project-wing-canvas-grid-header-hover",
  borderColor: "--project-wing-canvas-grid-border",
  horizontalBorderColor: "--project-wing-canvas-grid-border-horizontal",
} as const satisfies Record<keyof CanvasDataGridPalette, string>;

export function readCanvasDataGridPalette(
  styles: CssPropertyReader | undefined = typeof window === "undefined"
    ? undefined
    : window.getComputedStyle(document.documentElement)
): CanvasDataGridPalette {
  const readToken = (token: string) =>
    styles?.getPropertyValue(token).trim() || "currentColor";

  return Object.fromEntries(
    Object.entries(canvasDataGridTokens).map(([property, token]) => [
      property,
      readToken(token),
    ])
  ) as CanvasDataGridPalette;
}
