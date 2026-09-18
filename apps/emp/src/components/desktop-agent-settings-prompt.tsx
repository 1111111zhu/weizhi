"use client";

import { Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { defaultDesktopAgentManagementCopy } from "../i18n/dictionaries";

export const OPEN_DESKTOP_AGENT_SETTINGS =
  "project-wing:open-desktop-agent-settings";

export type DesktopAgentSettingsPromptCopy = Pick<
  typeof defaultDesktopAgentManagementCopy,
  | "settingsPromptTitle"
  | "settingsPromptDescription"
  | "goToSettings"
  | "cancel"
>;

export function DesktopAgentSettingsPrompt({
  open,
  onOpenChange,
  copy = defaultDesktopAgentManagementCopy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  copy?: DesktopAgentSettingsPromptCopy;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.settingsPromptTitle}</DialogTitle>
          <DialogDescription>
            {copy.settingsPromptDescription}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {copy.cancel}
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              // Finish the current dialog's click/close before opening another
              // modal, so its outside-click handling cannot close the new one.
              window.setTimeout(
                () =>
                  window.dispatchEvent(new Event(OPEN_DESKTOP_AGENT_SETTINGS)),
                0
              );
            }}
          >
            <Settings />
            {copy.goToSettings}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
