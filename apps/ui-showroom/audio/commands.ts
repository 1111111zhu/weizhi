import type { SoundDefinition } from "@web-kits/audio";

export const copy: SoundDefinition = {
  layers: [
    {
      source: { type: "sine", frequency: 1200 },
      envelope: { attack: 0, decay: 0.015, sustain: 0, release: 0.006 },
      gain: 0.16,
    },
    {
      source: { type: "sine", frequency: 1400 },
      envelope: { attack: 0, decay: 0.015, sustain: 0, release: 0.006 },
      delay: 0.04,
      gain: 0.14,
    },
  ],
};
export const send: SoundDefinition = {
  source: { type: "sine", frequency: { start: 500, end: 1200 } },
  envelope: { attack: 0, decay: 0.15, sustain: 0, release: 0.04 },
  gain: 0.16,
};
export const receive: SoundDefinition = {
  source: { type: "sine", frequency: { start: 1200, end: 700 } },
  envelope: { attack: 0, decay: 0.12, sustain: 0.02, release: 0.04 },
  gain: 0.12,
};
export const command: SoundDefinition = {
  layers: [
    {
      source: { type: "sine", frequency: { start: 600, end: 900 } },
      envelope: { attack: 0, decay: 0.05, sustain: 0, release: 0.015 },
      gain: 0.18,
    },
    {
      source: { type: "sine", frequency: { start: 900, end: 1100 } },
      envelope: { attack: 0, decay: 0.04, sustain: 0, release: 0.012 },
      delay: 0.04,
      gain: 0.12,
    },
  ],
};
export const escape: SoundDefinition = {
  layers: [
    {
      source: { type: "sine", frequency: { start: 900, end: 600 } },
      envelope: { attack: 0, decay: 0.05, sustain: 0, release: 0.015 },
      gain: 0.16,
    },
    {
      source: { type: "sine", frequency: { start: 700, end: 500 } },
      envelope: { attack: 0, decay: 0.04, sustain: 0, release: 0.012 },
      delay: 0.03,
      gain: 0.1,
    },
  ],
};
export const undo: SoundDefinition = {
  source: { type: "sine", frequency: { start: 900, end: 600 } },
  envelope: { attack: 0, decay: 0.12, sustain: 0.02, release: 0.04 },
  gain: 0.14,
};
export const archive: SoundDefinition = {
  source: { type: "sine", frequency: { start: 800, end: 550 } },
  envelope: { attack: 0.003, decay: 0.15, sustain: 0.02, release: 0.05 },
  gain: 0.12,
};
export const sync: SoundDefinition = {
  layers: [
    {
      source: { type: "sine", frequency: 523 },
      envelope: { attack: 0, decay: 0.015, sustain: 0, release: 0.005 },
      gain: 0.14,
    },
    {
      source: { type: "sine", frequency: 784 },
      envelope: { attack: 0, decay: 0.015, sustain: 0, release: 0.005 },
      delay: 0.04,
      gain: 0.12,
    },
  ],
};
export const heart: SoundDefinition = {
  layers: [
    {
      source: { type: "sine", frequency: { start: 500, end: 300 } },
      envelope: { attack: 0, decay: 0.1, sustain: 0, release: 0.04 },
      gain: 0.16,
    },
    {
      source: { type: "sine", frequency: 523, fm: { ratio: 2.5, depth: 100 } },
      envelope: { attack: 0.008, decay: 0.25, sustain: 0.04, release: 0.1 },
      gain: 0.1,
    },
  ],
};
export const streak: SoundDefinition = {
  layers: [
    {
      source: { type: "sine", frequency: { start: 523, end: 784 } },
      envelope: { attack: 0, decay: 0.12, sustain: 0.02, release: 0.05 },
      gain: 0.16,
    },
    {
      source: {
        type: "sine",
        frequency: { start: 526, end: 787 },
        fm: { ratio: 2.5, depth: 100 },
      },
      envelope: { attack: 0, decay: 0.11, sustain: 0.01, release: 0.05 },
      gain: 0.08,
    },
  ],
};
export const loadingStart: SoundDefinition = {
  source: { type: "sine", frequency: { start: 500, end: 700 } },
  envelope: { attack: 0.008, decay: 0.12, sustain: 0.02, release: 0.05 },
  gain: 0.08,
};
export const loadingEnd: SoundDefinition = {
  layers: [
    {
      source: { type: "sine", frequency: { start: 700, end: 880 } },
      envelope: { attack: 0, decay: 0.1, sustain: 0.02, release: 0.04 },
      gain: 0.1,
    },
    {
      source: { type: "sine", frequency: { start: 880, end: 1046 } },
      envelope: { attack: 0, decay: 0.08, sustain: 0.01, release: 0.04 },
      delay: 0.06,
      gain: 0.08,
    },
  ],
};
export const progressTick: SoundDefinition = {
  source: { type: "sine", frequency: 1400, fm: { ratio: 0.5, depth: 50 } },
  envelope: { attack: 0, decay: 0.01, sustain: 0, release: 0.004 },
  gain: 0.1,
};
