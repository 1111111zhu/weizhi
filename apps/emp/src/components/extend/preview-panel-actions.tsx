"use client";

import { IconButton } from "@project-wing/ui";
import { ExternalLink, Maximize2, Minimize2, Presentation } from "lucide-react";
import type { MouseEvent } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

function togglePreviewPresentation(event: MouseEvent<HTMLButtonElement>) {
  const viewer = event.currentTarget.closest<HTMLElement>(
    '[data-slot="pdf-viewer"]'
  );
  if (!viewer) {
    return;
  }

  const transition =
    document.fullscreenElement === viewer
      ? document.exitFullscreen()
      : document.fullscreenElement
        ? document.exitFullscreen().then(() => viewer.requestFullscreen())
        : viewer.requestFullscreen();

  void transition.catch((error: unknown) => {
    console.error(error);
  });
}

export function PreviewPanelActions({
  expandLabel,
  exitExpandedLabel,
  isPreviewExpanded,
  onOpenInNewWindow,
  onTogglePreviewExpanded,
  openInNewWindowLabel,
  presentationLabel,
}: {
  expandLabel: string;
  exitExpandedLabel: string;
  isPreviewExpanded: boolean;
  onOpenInNewWindow: () => void;
  onTogglePreviewExpanded?: () => void;
  openInNewWindowLabel: string;
  presentationLabel?: string;
}) {
  return (
    <TooltipProvider>
      {onTogglePreviewExpanded ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <IconButton
                type="button"
                variant="quiet"
                size="xs"
                icon={
                  isPreviewExpanded ? (
                    <Minimize2 strokeWidth={1.5} />
                  ) : (
                    <Maximize2 strokeWidth={1.5} />
                  )
                }
                label={isPreviewExpanded ? exitExpandedLabel : expandLabel}
                onClick={onTogglePreviewExpanded}
              />
            }
          />
          <TooltipContent side="bottom">
            {isPreviewExpanded ? exitExpandedLabel : expandLabel}
          </TooltipContent>
        </Tooltip>
      ) : null}
      {presentationLabel ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <IconButton
                type="button"
                variant="quiet"
                size="xs"
                icon={<Presentation strokeWidth={1.5} />}
                label={presentationLabel}
                onClick={togglePreviewPresentation}
              />
            }
          />
          <TooltipContent side="bottom">{presentationLabel}</TooltipContent>
        </Tooltip>
      ) : null}
      <Tooltip>
        <TooltipTrigger
          render={
            <IconButton
              type="button"
              variant="quiet"
              size="xs"
              icon={<ExternalLink strokeWidth={1.5} />}
              label={openInNewWindowLabel}
              onClick={onOpenInNewWindow}
            />
          }
        />
        <TooltipContent side="bottom">{openInNewWindowLabel}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
