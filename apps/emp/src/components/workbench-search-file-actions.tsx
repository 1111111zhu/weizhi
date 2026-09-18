"use client";

import { Download, Eye } from "lucide-react";
import type { SyntheticEvent } from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";

export type WorkbenchSearchFileAction =
  | "PREVIEW"
  | "PREVIEW_NEW_WINDOW"
  | "MASTER"
  | "DOWNLOAD";

export type WorkbenchSearchFileActionCopy = {
  preview: string;
  openMaster: string;
  download: string;
};

function isolateActionEvent(event: SyntheticEvent<HTMLButtonElement>) {
  event.stopPropagation();
}

function getPreviewAction(event: { ctrlKey: boolean; metaKey: boolean }) {
  return event.ctrlKey || event.metaKey ? "PREVIEW_NEW_WINDOW" : "PREVIEW";
}

export function WorkbenchSearchFileActions({
  copy,
  supportsMaster,
  onAction,
}: {
  copy: WorkbenchSearchFileActionCopy;
  supportsMaster: boolean;
  onAction: (action: WorkbenchSearchFileAction) => void;
}) {
  const secondaryAction = supportsMaster ? "MASTER" : "DOWNLOAD";
  const secondaryLabel = supportsMaster ? copy.openMaster : copy.download;

  return (
    <ButtonGroup
      className="shrink-0 gap-0.5"
      label={`${copy.preview}, ${secondaryLabel}`}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-7 rounded-md"
        accessibleName={copy.preview}
        onPointerDown={(event) => {
          isolateActionEvent(event);
          onAction(getPreviewAction(event));
        }}
        onPointerUp={isolateActionEvent}
        onMouseDown={isolateActionEvent}
        onClick={(event) => {
          isolateActionEvent(event);
          if (event.detail === 0) {
            onAction(getPreviewAction(event));
          }
        }}
      >
        <Eye />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-7 rounded-md"
        accessibleName={secondaryLabel}
        onPointerDown={(event) => {
          isolateActionEvent(event);
          onAction(secondaryAction);
        }}
        onPointerUp={isolateActionEvent}
        onMouseDown={isolateActionEvent}
        onClick={(event) => {
          isolateActionEvent(event);
          if (event.detail === 0) {
            onAction(secondaryAction);
          }
        }}
      >
        <Download />
      </Button>
    </ButtonGroup>
  );
}
