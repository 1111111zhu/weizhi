import type { SoundDefinition } from "@web-kits/audio";

export const click: SoundDefinition = {
  source: {
    type: "sine",
    frequency: { start: 200, end: 700 },
    fm: { ratio: 0.5, depth: 80 },
  },
  envelope: { attack: 0, decay: 0.06, sustain: 0, release: 0.02 },
  gain: 0.25,
};
export const tap: SoundDefinition = {
  source: { type: "sine", frequency: 1300, fm: { ratio: 0.5, depth: 100 } },
  envelope: { attack: 0, decay: 0.015, sustain: 0, release: 0.005 },
  gain: 0.2,
};
export const keyPress: SoundDefinition = {
  source: { type: "sine", frequency: 1300, fm: { ratio: 0.5, depth: 80 } },
  envelope: { attack: 0, decay: 0.012, sustain: 0, release: 0.004 },
  gain: 0.18,
};
export const checkbox: SoundDefinition = {
  source: {
    type: "sine",
    frequency: { start: 250, end: 800 },
    fm: { ratio: 0.5, depth: 60 },
  },
  envelope: { attack: 0, decay: 0.05, sustain: 0, release: 0.015 },
  gain: 0.22,
};
export const radio: SoundDefinition = {
  source: {
    type: "sine",
    frequency: { start: 300, end: 900 },
    fm: { ratio: 0.5, depth: 50 },
  },
  envelope: { attack: 0, decay: 0.04, sustain: 0, release: 0.012 },
  gain: 0.2,
};
export const tick: SoundDefinition = {
  source: { type: "sine", frequency: 1500, fm: { ratio: 0.5, depth: 60 } },
  envelope: { attack: 0, decay: 0.01, sustain: 0, release: 0.004 },
  gain: 0.15,
};
export const scrollSnap: SoundDefinition = {
  source: { type: "sine", frequency: 1400, fm: { ratio: 0.5, depth: 50 } },
  envelope: { attack: 0, decay: 0.008, sustain: 0, release: 0.003 },
  gain: 0.08,
};
export const focus: SoundDefinition = {
  source: { type: "sine", frequency: 1300, fm: { ratio: 0.5, depth: 40 } },
  envelope: { attack: 0, decay: 0.02, sustain: 0, release: 0.008 },
  gain: 0.06,
};
export const blur: SoundDefinition = {
  source: { type: "sine", frequency: 1100, fm: { ratio: 0.5, depth: 30 } },
  envelope: { attack: 0, decay: 0.018, sustain: 0, release: 0.008 },
  gain: 0.04,
};
export const toggleOn: SoundDefinition = {
  layers: [
    {
      source: { type: "sine", frequency: 2093 },
      envelope: { attack: 0, decay: 0.012, sustain: 0, release: 0.004 },
      gain: 0.2,
    },
    {
      source: { type: "sine", frequency: 3136 },
      envelope: { attack: 0, decay: 0.012, sustain: 0, release: 0.004 },
      delay: 0.025,
      gain: 0.2,
    },
  ],
};
export const toggleOff: SoundDefinition = {
  layers: [
    {
      source: { type: "sine", frequency: 3136 },
      envelope: { attack: 0, decay: 0.012, sustain: 0, release: 0.004 },
      gain: 0.2,
    },
    {
      source: { type: "sine", frequency: 2093 },
      envelope: { attack: 0, decay: 0.012, sustain: 0, release: 0.004 },
      delay: 0.025,
      gain: 0.2,
    },
  ],
};
export const hover: SoundDefinition = {
  source: { type: "sine", frequency: 1300 },
  envelope: { attack: 0.005, decay: 0.015, sustain: 0, release: 0.008 },
  gain: 0.04,
};
export const select: SoundDefinition = {
  source: { type: "sine", frequency: 1400, fm: { ratio: 0.5, depth: 60 } },
  envelope: { attack: 0, decay: 0.05, sustain: 0, release: 0.015 },
  gain: 0.2,
};
export const deselect: SoundDefinition = {
  source: { type: "sine", frequency: 1200, fm: { ratio: 0.5, depth: 60 } },
  envelope: { attack: 0, decay: 0.04, sustain: 0, release: 0.012 },
  gain: 0.16,
};
export const pop: SoundDefinition = {
  source: { type: "sine", frequency: { start: 400, end: 150 } },
  envelope: { attack: 0, decay: 0.08, sustain: 0, release: 0.025 },
  gain: 0.25,
};
export const boop: SoundDefinition = {
  source: {
    type: "sine",
    frequency: { start: 600, end: 250 },
    fm: { ratio: 0.5, depth: 40 },
  },
  envelope: { attack: 0, decay: 0.1, sustain: 0, release: 0.03 },
  gain: 0.2,
};
export const bounce: SoundDefinition = {
  source: { type: "sine", frequency: { start: 350, end: 180 } },
  envelope: { attack: 0, decay: 0.12, sustain: 0, release: 0.04 },
  gain: 0.22,
};
export const spring: SoundDefinition = {
  source: {
    type: "sine",
    frequency: { start: 400, end: 900 },
    fm: { ratio: 0.5, depth: 50 },
  },
  envelope: { attack: 0, decay: 0.15, sustain: 0.03, release: 0.05 },
  gain: 0.18,
};
export const expand: SoundDefinition = {
  source: { type: "sine", frequency: { start: 500, end: 700 } },
  envelope: { attack: 0.003, decay: 0.1, sustain: 0.02, release: 0.04 },
  gain: 0.12,
};
export const collapse: SoundDefinition = {
  source: { type: "sine", frequency: { start: 700, end: 500 } },
  envelope: { attack: 0.003, decay: 0.1, sustain: 0.02, release: 0.04 },
  gain: 0.12,
};
