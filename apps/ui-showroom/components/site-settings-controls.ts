"use client";

import { useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import type { VibrateIconHandle } from "@/components/animated-icons/vibrate";
import type { Volume2IconHandle } from "@/components/animated-icons/volume-2";
import { useHapticsEnabled } from "@/hooks/use-haptic-toggle";
import { useIsMac } from "@/hooks/use-is-mac";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSoundEnabled } from "@/hooks/use-sound-toggle";

export const useSiteSettingsControls = () => {
  const volumeIconRef = useRef<Volume2IconHandle>(null);
  const vibrateIconRef = useRef<VibrateIconHandle>(null);
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();
  const isMac = useIsMac();
  const [soundEnabled, setSoundEnabled] = useSoundEnabled();
  const [hapticsEnabled, setHapticsEnabled] = useHapticsEnabled();

  useHotkeys("meta+s, ctrl+s", () => setSoundEnabled((prev) => !prev), {
    preventDefault: true,
  });
  useHotkeys("meta+h, ctrl+h", () => setHapticsEnabled((prev) => !prev), {
    preventDefault: true,
  });

  return {
    volumeIconRef,
    vibrateIconRef,
    isOpen,
    setIsOpen,
    isMobile,
    isMac,
    soundEnabled,
    setSoundEnabled,
    hapticsEnabled,
    setHapticsEnabled,
    onSoundMouseEnter: () => volumeIconRef.current?.startAnimation(),
    onSoundMouseLeave: () => volumeIconRef.current?.stopAnimation(),
    onHapticsMouseEnter: () => vibrateIconRef.current?.startAnimation(),
    onHapticsMouseLeave: () => vibrateIconRef.current?.stopAnimation(),
  };
};
