import type { SoundDefinition } from "@web-kits/audio";

export const success: SoundDefinition = {
  layers: [
    {
      source: { type: "sine", frequency: 523 },
      envelope: { attack: 0.003, decay: 0.3, sustain: 0.06, release: 0.1 },
      gain: 0.16,
    },
    {
      source: { type: "sine", frequency: 659 },
      envelope: { attack: 0.003, decay: 0.28, sustain: 0.05, release: 0.1 },
      delay: 0.07,
      gain: 0.14,
    },
    {
      source: { type: "sine", frequency: { start: 784, end: 880 } },
      envelope: { attack: 0.003, decay: 0.32, sustain: 0.06, release: 0.12 },
      delay: 0.14,
      gain: 0.15,
    },
  ],
};
export const complete: SoundDefinition = {
  layers: [
    {
      source: { type: "sine", frequency: 523 },
      envelope: { attack: 0.003, decay: 0.35, sustain: 0.05, release: 0.1 },
      gain: 0.15,
    },
    {
      source: { type: "sine", frequency: 659 },
      envelope: { attack: 0.003, decay: 0.35, sustain: 0.05, release: 0.1 },
      delay: 0.015,
      gain: 0.13,
    },
    {
      source: { type: "sine", frequency: 784 },
      envelope: { attack: 0.003, decay: 0.35, sustain: 0.05, release: 0.1 },
      delay: 0.03,
      gain: 0.12,
    },
    {
      source: { type: "sine", frequency: { start: 1046, end: 1175 } },
      envelope: { attack: 0.003, decay: 0.3, sustain: 0.04, release: 0.12 },
      delay: 0.045,
      gain: 0.1,
    },
  ],
};
export const levelUp: SoundDefinition = {
  layers: [
    {
      source: { type: "sine", frequency: 440 },
      envelope: { attack: 0.003, decay: 0.25, sustain: 0.06, release: 0.1 },
      gain: 0.15,
    },
    {
      source: { type: "sine", frequency: 554 },
      envelope: { attack: 0.003, decay: 0.25, sustain: 0.05, release: 0.1 },
      delay: 0.07,
      gain: 0.14,
    },
    {
      source: { type: "sine", frequency: 660 },
      envelope: { attack: 0.003, decay: 0.28, sustain: 0.05, release: 0.1 },
      delay: 0.14,
      gain: 0.13,
    },
    {
      source: { type: "sine", frequency: { start: 880, end: 990 } },
      envelope: { attack: 0.003, decay: 0.22, sustain: 0.04, release: 0.12 },
      delay: 0.21,
      gain: 0.08,
    },
  ],
};
export const confetti: SoundDefinition = {
  layers: [
    {
      source: { type: "sine", frequency: 523 },
      envelope: { attack: 0.002, decay: 0.18, sustain: 0.04, release: 0.08 },
      gain: 0.14,
    },
    {
      source: { type: "sine", frequency: 659 },
      envelope: { attack: 0.002, decay: 0.18, sustain: 0.04, release: 0.08 },
      delay: 0.06,
      gain: 0.14,
    },
    {
      source: { type: "sine", frequency: 784 },
      envelope: { attack: 0.002, decay: 0.18, sustain: 0.03, release: 0.08 },
      delay: 0.12,
      gain: 0.12,
    },
    {
      source: { type: "sine", frequency: { start: 1047, end: 1175 } },
      envelope: { attack: 0.002, decay: 0.2, sustain: 0.03, release: 0.1 },
      delay: 0.18,
      gain: 0.1,
    },
  ],
};
export const save: SoundDefinition = {
  layers: [
    {
      source: { type: "sine", frequency: { start: 880, end: 1046 } },
      envelope: { attack: 0, decay: 0.1, sustain: 0.03, release: 0.04 },
      gain: 0.14,
    },
    {
      source: { type: "sine", frequency: { start: 1046, end: 1175 } },
      envelope: { attack: 0, decay: 0.1, sustain: 0.02, release: 0.04 },
      delay: 0.08,
      gain: 0.1,
    },
  ],
};
export const ding: SoundDefinition = {
  source: { type: "sine", frequency: 880, fm: { ratio: 3.5, depth: 300 } },
  envelope: { attack: 0, decay: 0.6, sustain: 0.04, release: 0.25 },
  effects: [{ type: "reverb", decay: 0.8, damping: 0.6, mix: 0.15 }],
  gain: 0.18,
};
export const notification: SoundDefinition = {
  layers: [
    {
      source: { type: "sine", frequency: 780, fm: { ratio: 1.5, depth: 150 } },
      envelope: { attack: 0, decay: 0.4, sustain: 0.04, release: 0.15 },
      effects: [{ type: "reverb", decay: 0.6, damping: 0.6, mix: 0.12 }],
      gain: 0.16,
    },
    {
      source: { type: "sine", frequency: 1170, fm: { ratio: 1.5, depth: 120 } },
      envelope: { attack: 0, decay: 0.35, sustain: 0.03, release: 0.15 },
      delay: 0.1,
      effects: [{ type: "reverb", decay: 0.6, damping: 0.6, mix: 0.12 }],
      gain: 0.14,
    },
  ],
};
export const mention: SoundDefinition = {
  source: { type: "sine", frequency: 660, fm: { ratio: 2.5, depth: 150 } },
  envelope: { attack: 0.003, decay: 0.5, sustain: 0.05, release: 0.2 },
  effects: [{ type: "reverb", decay: 0.6, damping: 0.5, mix: 0.1 }],
  gain: 0.14,
};
export const badge: SoundDefinition = {
  source: { type: "sine", frequency: 1100, fm: { ratio: 2.76, depth: 350 } },
  envelope: { attack: 0, decay: 0.35, sustain: 0.04, release: 0.15 },
  effects: [{ type: "reverb", decay: 0.5, damping: 0.6, mix: 0.1 }],
  gain: 0.16,
};
export const info: SoundDefinition = {
  source: { type: "sine", frequency: 880, fm: { ratio: 2, depth: 120 } },
  envelope: { attack: 0.003, decay: 0.3, sustain: 0.04, release: 0.12 },
  gain: 0.14,
};
export const sparkle: SoundDefinition = {
  layers: [
    {
      source: {
        type: "sine",
        frequency: 1047,
        detune: 7,
        fm: { ratio: 3.5, depth: 200 },
      },
      envelope: { attack: 0, decay: 0.4, sustain: 0.04, release: 0.18 },
      effects: [{ type: "reverb", decay: 0.8, damping: 0.5, mix: 0.15 }],
      gain: 0.12,
    },
    {
      source: { type: "sine", frequency: 1050, fm: { ratio: 3.5, depth: 180 } },
      envelope: { attack: 0, decay: 0.38, sustain: 0.03, release: 0.18 },
      gain: 0.08,
    },
  ],
};
export const star: SoundDefinition = {
  source: { type: "sine", frequency: 880, fm: { ratio: 2.76, depth: 250 } },
  envelope: { attack: 0, decay: 0.4, sustain: 0.04, release: 0.18 },
  effects: [{ type: "reverb", decay: 0.6, damping: 0.5, mix: 0.12 }],
  gain: 0.14,
};
export const error: SoundDefinition = {
  layers: [
    {
      source: { type: "sawtooth", frequency: { start: 320, end: 140 } },
      filter: { type: "lowpass", frequency: 1200 },
      envelope: { attack: 0, decay: 0.25, sustain: 0, release: 0.08 },
      gain: 0.22,
    },
    {
      source: { type: "square", frequency: { start: 180, end: 80 } },
      filter: { type: "lowpass", frequency: 800 },
      envelope: { attack: 0, decay: 0.2, sustain: 0, release: 0.06 },
      delay: 0.03,
      gain: 0.12,
    },
  ],
};
export const _delete: SoundDefinition = {
  layers: [
    {
      source: { type: "sawtooth", frequency: { start: 300, end: 100 } },
      filter: { type: "lowpass", frequency: 800 },
      envelope: { attack: 0, decay: 0.3, sustain: 0, release: 0.08 },
      gain: 0.18,
    },
    {
      source: { type: "square", frequency: { start: 200, end: 60 } },
      filter: { type: "lowpass", frequency: 600 },
      envelope: { attack: 0, decay: 0.25, sustain: 0, release: 0.06 },
      delay: 0.02,
      gain: 0.1,
    },
  ],
};
export const warning: SoundDefinition = {
  layers: [
    {
      source: { type: "triangle", frequency: 440 },
      envelope: { attack: 0, decay: 0.18, sustain: 0.06, release: 0.06 },
      gain: 0.2,
    },
    {
      source: { type: "triangle", frequency: 466 },
      envelope: { attack: 0, decay: 0.18, sustain: 0.06, release: 0.06 },
      delay: 0.01,
      gain: 0.15,
    },
  ],
};
