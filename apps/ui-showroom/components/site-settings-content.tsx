"use client";

import type { RefObject } from "react";

import type { VibrateIconHandle } from "@/components/animated-icons/vibrate";
import { VibrateIcon } from "@/components/animated-icons/vibrate";
import type { Volume2IconHandle } from "@/components/animated-icons/volume-2";
import { Volume2Icon } from "@/components/animated-icons/volume-2";
import { Kbd } from "@/components/ui/kbd";
import { Toggle } from "@/components/ui/toggle";

type SiteSettingsContentProps = {
  isMac: boolean;
  isMobile: boolean;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  volumeIconRef: RefObject<Volume2IconHandle | null>;
  vibrateIconRef: RefObject<VibrateIconHandle | null>;
  onSoundMouseEnter: () => void;
  onSoundMouseLeave: () => void;
  onHapticsMouseEnter: () => void;
  onHapticsMouseLeave: () => void;
};

type SiteSettingsToggleRowProps = {
  label: string;
  shortcut: string;
  pressed: boolean;
  ariaLabel: string;
  onPressedChange: (pressed: boolean) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  children: React.ReactNode;
};

const SiteSettingsToggleRow = ({
  label,
  shortcut,
  pressed,
  ariaLabel,
  onPressedChange,
  onMouseEnter,
  onMouseLeave,
  children,
}: SiteSettingsToggleRowProps) => (
  <div className="flex items-center justify-between gap-2 pl-1">
    <div className="flex items-center gap-2">
      <span className="text-sm">{label}</span>
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </div>
    <Toggle
      pressed={pressed}
      onPressedChange={onPressedChange}
      aria-label={ariaLabel}
      variant="ghost"
      size="icon-sm"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </Toggle>
  </div>
);

export const SiteSettingsContent = ({
  isMac,
  isMobile,
  soundEnabled,
  hapticsEnabled,
  setSoundEnabled,
  setHapticsEnabled,
  volumeIconRef,
  vibrateIconRef,
  onSoundMouseEnter,
  onSoundMouseLeave,
  onHapticsMouseEnter,
  onHapticsMouseLeave,
}: SiteSettingsContentProps) => (
  <div className="flex flex-col gap-1">
    <SiteSettingsToggleRow
      label="Toggle Sound"
      shortcut={isMobile ? "" : `${isMac ? "⌘" : "Ctrl"}+S`}
      pressed={soundEnabled}
      onPressedChange={setSoundEnabled}
      ariaLabel="Toggle sound"
      onMouseEnter={onSoundMouseEnter}
      onMouseLeave={onSoundMouseLeave}
    >
      <Volume2Icon ref={volumeIconRef} />
    </SiteSettingsToggleRow>
    <SiteSettingsToggleRow
      label="Toggle Haptics"
      shortcut={isMobile ? "" : `${isMac ? "⌘" : "Ctrl"}+H`}
      pressed={hapticsEnabled}
      onPressedChange={setHapticsEnabled}
      ariaLabel="Toggle haptics"
      onMouseEnter={onHapticsMouseEnter}
      onMouseLeave={onHapticsMouseLeave}
    >
      <VibrateIcon ref={vibrateIconRef} />
    </SiteSettingsToggleRow>
  </div>
);
