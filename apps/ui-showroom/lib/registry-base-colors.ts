/* eslint-disable sort-keys, no-inline-comments */
import { baseColorsPart1 } from "./registry-base-colors-1";
import { baseColorsPart2 } from "./registry-base-colors-2";
import { baseColorsPart3 } from "./registry-base-colors-3";
import { baseColorsOKLCHPart1 } from "./registry-base-colors-oklch-1";
import { baseColorsOKLCHPart2 } from "./registry-base-colors-oklch-2";
import { baseColorsOKLCHPart3 } from "./registry-base-colors-oklch-3";
import { baseColorsOKLCHPart4 } from "./registry-base-colors-oklch-4";
import { baseColorsV4Part1 } from "./registry-base-colors-v4-1";
import { baseColorsV4Part2 } from "./registry-base-colors-v4-2";

export const baseColors = [
  ...baseColorsPart1,
  ...baseColorsPart2,
  ...baseColorsPart3,
] as const;

export type BaseColor = (typeof baseColors)[number];

export const baseColorsV4 = {
  ...baseColorsV4Part1,
  ...baseColorsV4Part2,
} as const;

export const baseColorsOKLCH = {
  ...baseColorsOKLCHPart1,
  ...baseColorsOKLCHPart2,
  ...baseColorsOKLCHPart3,
  ...baseColorsOKLCHPart4,
} as const;
