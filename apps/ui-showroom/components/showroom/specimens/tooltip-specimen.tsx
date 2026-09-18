"use client";

import { ButtonGroup } from "@project-wing/ui";
import { InfoIcon, KeyboardIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { SpecimenSection } from "./specimen-section";

export function TooltipSpecimen() {
  return (
    <SpecimenSection
      description="A local tooltip wrapper attached to icon-labelled actions, with hover and keyboard focus behavior."
      id="tooltip-specimen"
      source={{
        scope: "showroom",
        library: "@/components/ui/tooltip",
        detail: "Base UI wrapper",
      }}
      title="Tooltip"
    >
      <ButtonGroup>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label="Show project information"
              size="icon"
              variant="outline"
            >
              <InfoIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Project information</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label="Show keyboard shortcuts"
              size="icon"
              variant="ghost"
            >
              <KeyboardIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Keyboard shortcuts</TooltipContent>
        </Tooltip>
      </ButtonGroup>
    </SpecimenSection>
  );
}
