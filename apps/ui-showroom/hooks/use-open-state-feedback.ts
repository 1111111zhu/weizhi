"use client";

import type { SoundDefinition } from "@web-kits/audio";
import { useCallback, useEffect, useRef } from "react";

import { useFeedback } from "@/hooks/use-feedback";

interface OpenStateFeedbackOptions {
  closeSound: SoundDefinition;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  openSound: SoundDefinition;
  sounds: boolean;
}

export function useOpenStateFeedback({
  closeSound,
  defaultOpen,
  onOpenChange,
  open,
  openSound,
  sounds,
}: OpenStateFeedbackOptions) {
  const playOpen = useFeedback({ soundDef: openSound });
  const playClose = useFeedback({ soundDef: closeSound });
  const lastOpen = useRef(open ?? defaultOpen ?? false);

  const playStateSound = useCallback(
    (nextOpen: boolean) => {
      if (!sounds || nextOpen === lastOpen.current) {
        return;
      }
      if (nextOpen) {
        playOpen();
      } else {
        playClose();
      }
      lastOpen.current = nextOpen;
    },
    [playClose, playOpen, sounds]
  );

  useEffect(() => {
    if (open !== undefined) {
      playStateSound(open);
    }
  }, [open, playStateSound]);

  return useCallback(
    (nextOpen: boolean) => {
      playStateSound(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [onOpenChange, playStateSound]
  );
}
