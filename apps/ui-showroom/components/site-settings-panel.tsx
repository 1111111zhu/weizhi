"use client";

import { SettingsIcon } from "lucide-react";
import type { RefObject } from "react";

import type { VibrateIconHandle } from "@/components/animated-icons/vibrate";
import type { Volume2IconHandle } from "@/components/animated-icons/volume-2";
import { SiteSettingsContent } from "@/components/site-settings-content";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type SiteSettingsPanelProps = {
  isMac: boolean;
  isMobile: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
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

type SiteSettingsOverlayProps = {
  trigger: React.ReactNode;
  content: React.ReactNode;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
};

const SiteSettingsMobile = ({
  trigger,
  content,
  isOpen,
  setIsOpen,
}: SiteSettingsOverlayProps) => (
  <Drawer open={isOpen} onOpenChange={setIsOpen} sounds>
    <DrawerTrigger asChild>{trigger}</DrawerTrigger>
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Settings</DrawerTitle>
        <DrawerDescription>Manage site preferences</DrawerDescription>
      </DrawerHeader>
      <div className="px-4">{content}</div>
      <DrawerFooter>
        <DrawerClose asChild>
          <Button size="sm">Done</Button>
        </DrawerClose>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
);

const SiteSettingsPopover = ({
  trigger,
  content,
  isOpen,
  setIsOpen,
}: SiteSettingsOverlayProps) => (
  <Popover open={isOpen} onOpenChange={setIsOpen} sounds>
    <PopoverTrigger asChild>{trigger}</PopoverTrigger>
    <PopoverContent className="w-fit p-1">{content}</PopoverContent>
  </Popover>
);

const SiteSettingsPanelContent = (props: SiteSettingsPanelProps) => (
  <SiteSettingsContent
    isMac={props.isMac}
    isMobile={props.isMobile}
    soundEnabled={props.soundEnabled}
    hapticsEnabled={props.hapticsEnabled}
    setSoundEnabled={props.setSoundEnabled}
    setHapticsEnabled={props.setHapticsEnabled}
    volumeIconRef={props.volumeIconRef}
    vibrateIconRef={props.vibrateIconRef}
    onSoundMouseEnter={props.onSoundMouseEnter}
    onSoundMouseLeave={props.onSoundMouseLeave}
    onHapticsMouseEnter={props.onHapticsMouseEnter}
    onHapticsMouseLeave={props.onHapticsMouseLeave}
  />
);

const SiteSettingsTrigger = () => (
  <Button
    variant="ghost"
    size="icon"
    className="group/settings extend-touch-target size-8"
    aria-label="Settings"
  >
    <SettingsIcon />
  </Button>
);

export const SiteSettingsPanel = (props: SiteSettingsPanelProps) => {
  const trigger = <SiteSettingsTrigger />;
  const content = <SiteSettingsPanelContent {...props} />;

  return props.isMobile ? (
    <SiteSettingsMobile
      trigger={trigger}
      content={content}
      isOpen={props.isOpen}
      setIsOpen={props.setIsOpen}
    />
  ) : (
    <SiteSettingsPopover
      trigger={trigger}
      content={content}
      isOpen={props.isOpen}
      setIsOpen={props.setIsOpen}
    />
  );
};
