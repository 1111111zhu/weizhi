import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ProjectWingTopBarAvatar,
  getProjectWingTopBarAvatarTone,
} from "./project-wing-top-bar-avatar";

const styles = readFileSync(new URL("styles.css", import.meta.url), "utf-8");
const tones = [
  ...styles.matchAll(
    /\[data-avatar-tone="(\d+)"\] \{\s*--project-wing-top-bar-avatar-tone: rgb\(([\d ]+)\);/g
  ),
].map((match) => ({
  id: match[1],
  channels: (match[2] ?? "").split(" ").map(Number),
}));
const mix = (a: number[], b: number[], weight: number) =>
  a.map((value, index) => value * weight + (b[index] ?? 0) * (1 - weight));
function luminance(channels: number[]) {
  return channels
    .map((value) => value / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    )
    .reduce(
      (sum, value, index) =>
        sum + value * ([0.2126, 0.7152, 0.0722][index] ?? 0),
      0
    );
}
function contrast(a: number[], b: number[]) {
  const light = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));
  return (light + 0.05) / (dark + 0.05);
}

describe("avatar identity and color accessibility contract", () => {
  it("retains all twenty identity tones and independently defined light/dark treatments", () => {
    expect(tones).toHaveLength(20);
    for (const percentage of [24, 75, 18, 35]) {
      expect(styles).toContain(
        `var(--project-wing-top-bar-avatar-tone) ${percentage}%`
      );
    }
    expect(styles).toContain(".dark .project-wing-top-bar-avatar");
  });

  it.each(tones)(
    "tone $id keeps light initials above 4.5:1",
    ({ channels }) => {
      expect(
        contrast(
          mix(channels, [0, 0, 0], 0.75),
          mix(channels, [255, 255, 255], 0.24)
        )
      ).toBeGreaterThanOrEqual(4.5);
    }
  );

  it.each(tones)("tone $id keeps dark initials above 4.5:1", ({ channels }) => {
    expect(
      contrast(
        mix(channels, [255, 255, 255], 0.35),
        mix(channels, [32, 43, 53], 0.18)
      )
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the same identity at navigation and compact-list sizes", () => {
    for (const size of ["md", "compact"] as const) {
      const markup = renderToStaticMarkup(
        <ProjectWingTopBarAvatar name="Jony Ma" label="Jony Ma" size={size} />
      );
      expect(markup).toContain(
        `data-avatar-tone="${getProjectWingTopBarAvatarTone("Jony Ma")}"`
      );
      expect(markup).toContain('aria-label="Jony Ma"');
      expect(markup).toContain("JM");
    }
  });
});
