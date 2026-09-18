/** Read a CSS pixel measurement without accepting an unrelated CSS unit. */
export function cssPixels(value: string | number | undefined): number {
  const match = /^(-?\d+(?:\.\d+)?)(?:px)?$/.exec(String(value));
  if (!match) {
    throw new Error(`Expected a CSS pixel measurement, got ${String(value)}`);
  }
  return Number(match[1]);
}

/** Document overlays store geometry in percentages rather than CSS pixels. */
export function cssPercent(value: string): number {
  const match = /^(-?\d+(?:\.\d+)?)%$/.exec(value);
  if (!match) {
    throw new Error(`Expected a CSS percentage measurement, got ${value}`);
  }
  return Number(match[1]);
}
