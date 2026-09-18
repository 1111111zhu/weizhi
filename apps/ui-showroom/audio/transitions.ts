import type { SoundDefinition } from "@web-kits/audio";

export const swoosh: SoundDefinition = {
  source: { type: "noise", color: "white" },
  filter: {
    type: "bandpass",
    frequency: 300,
    resonance: 1.8,
    envelope: { attack: 0.01, peak: 4000, decay: 0.08 },
  },
  envelope: { attack: 0.01, decay: 0.12, sustain: 0, release: 0.04 },
  gain: 0.12,
};
export const whoosh: SoundDefinition = {
  source: { type: "noise", color: "white" },
  filter: {
    type: "bandpass",
    frequency: 300,
    resonance: 1.5,
    envelope: { attack: 0.04, peak: 4000, decay: 0.16 },
  },
  envelope: { attack: 0.02, decay: 0.25, sustain: 0, release: 0.08 },
  gain: 0.15,
};
export const pageEnter: SoundDefinition = {
  source: { type: "noise", color: "white" },
  filter: {
    type: "bandpass",
    frequency: 400,
    resonance: 1.2,
    envelope: { attack: 0.03, peak: 3000, decay: 0.15 },
  },
  envelope: { attack: 0.02, decay: 0.2, sustain: 0, release: 0.06 },
  gain: 0.08,
};
export const pageExit: SoundDefinition = {
  source: { type: "noise", color: "pink" },
  filter: {
    type: "bandpass",
    frequency: 2500,
    resonance: 1.2,
    envelope: { decay: 0.18, peak: 400 },
  },
  envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.06 },
  gain: 0.07,
};
export const tabSwitch: SoundDefinition = {
  source: {
    type: "sine",
    frequency: { start: 1100, end: 1500 },
    fm: { ratio: 0.5, depth: 50 },
  },
  envelope: { attack: 0, decay: 0.05, sustain: 0, release: 0.015 },
  gain: 0.18,
};
export const drawerOpen: SoundDefinition = {
  source: { type: "sine", frequency: { start: 350, end: 1000 } },
  envelope: { attack: 0, decay: 0.1, sustain: 0, release: 0.03 },
  gain: 0.08,
};
export const drawerClose: SoundDefinition = {
  source: { type: "sine", frequency: { start: 800, end: 350 } },
  envelope: { attack: 0, decay: 0.1, sustain: 0, release: 0.03 },
  gain: 0.06,
};
export const modalOpen: SoundDefinition = {
  source: { type: "sine", frequency: { start: 430, end: 1400 } },
  envelope: { attack: 0, decay: 0.08, sustain: 0, release: 0.025 },
  gain: 0.1,
};
export const modalClose: SoundDefinition = {
  source: { type: "sine", frequency: { start: 730, end: 430 } },
  envelope: { attack: 0, decay: 0.08, sustain: 0, release: 0.025 },
  gain: 0.08,
};
export const dropdownOpen: SoundDefinition = {
  source: { type: "sine", frequency: { start: 500, end: 1200 } },
  envelope: { attack: 0, decay: 0.06, sustain: 0, release: 0.02 },
  gain: 0.07,
};
export const dropdownClose: SoundDefinition = {
  source: { type: "sine", frequency: { start: 900, end: 500 } },
  envelope: { attack: 0, decay: 0.06, sustain: 0, release: 0.02 },
  gain: 0.05,
};
export const slide: SoundDefinition = {
  source: { type: "noise", color: "white" },
  filter: {
    type: "bandpass",
    frequency: 500,
    resonance: 1,
    envelope: { attack: 0.02, peak: 3000, decay: 0.12 },
  },
  envelope: { attack: 0.01, decay: 0.15, sustain: 0, release: 0.05 },
  gain: 0.07,
};
export const slideUp: SoundDefinition = {
  source: { type: "noise", color: "white" },
  filter: {
    type: "bandpass",
    frequency: 500,
    resonance: 1,
    envelope: { attack: 0.02, peak: 3500, decay: 0.12 },
  },
  envelope: { attack: 0.01, decay: 0.15, sustain: 0, release: 0.05 },
  gain: 0.07,
};
export const slideDown: SoundDefinition = {
  source: { type: "noise", color: "pink" },
  filter: {
    type: "bandpass",
    frequency: 2500,
    resonance: 1,
    envelope: { decay: 0.12, peak: 500 },
  },
  envelope: { attack: 0.01, decay: 0.15, sustain: 0, release: 0.05 },
  gain: 0.06,
};
