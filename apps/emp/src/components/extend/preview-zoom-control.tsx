"use client";

import {
  MinusSignCircleIcon,
  PlusSignCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconButton } from "@project-wing/ui";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

export const PREVIEW_ZOOM_OPTIONS = [50, 75, 100, 125, 150, 200] as const;
export type PreviewZoom = (typeof PREVIEW_ZOOM_OPTIONS)[number];

type PreviewZoomControlProps = {
  onValueChange: (value: PreviewZoom) => void;
  value: PreviewZoom;
};

export const PREVIEW_ZOOM_TRIGGER_CLASS_NAME =
  "w-[96px] min-w-[96px] max-w-[96px] justify-start gap-1 focus-visible:border-input focus-visible:ring-0";
export const PREVIEW_ZOOM_VALUE_CLASS_NAME =
  "min-w-0 truncate whitespace-nowrap";

export function formatPreviewZoomPercentage(scale: number) {
  return `${Math.round(scale * 100)}%`;
}

export const previewZoomContentClassName: Record<PreviewZoom, string> = {
  50: "[zoom:.5]",
  75: "[zoom:.75]",
  100: "[zoom:1]",
  125: "[zoom:1.25]",
  150: "[zoom:1.5]",
  200: "[zoom:2]",
};

export function PreviewZoomControl({
  onValueChange,
  value,
}: PreviewZoomControlProps) {
  const index = PREVIEW_ZOOM_OPTIONS.indexOf(value);
  const canZoomOut = index > 0;
  const canZoomIn = index < PREVIEW_ZOOM_OPTIONS.length - 1;

  return (
    <div className="flex shrink-0 items-center gap-1" data-preview-zoom-control>
      <IconButton
        type="button"
        variant="quiet"
        size="xs"
        icon={<HugeiconsIcon icon={MinusSignCircleIcon} className="size-4" />}
        label="Zoom out"
        disabled={!canZoomOut}
        onClick={() => onValueChange(PREVIEW_ZOOM_OPTIONS[index - 1])}
      />
      <Select
        value={value.toString()}
        onValueChange={(next) => onValueChange(Number(next) as PreviewZoom)}
        modal={false}
      >
        <SelectTrigger
          size="sm"
          aria-label="Zoom level"
          className={PREVIEW_ZOOM_TRIGGER_CLASS_NAME}
        >
          <SelectValue className={PREVIEW_ZOOM_VALUE_CLASS_NAME}>
            {value}%
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end" alignItemWithTrigger={false}>
          {PREVIEW_ZOOM_OPTIONS.map((option) => (
            <SelectItem key={option} value={option.toString()}>
              {option}%
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <IconButton
        type="button"
        variant="quiet"
        size="xs"
        icon={<HugeiconsIcon icon={PlusSignCircleIcon} className="size-4" />}
        label="Zoom in"
        disabled={!canZoomIn}
        onClick={() => onValueChange(PREVIEW_ZOOM_OPTIONS[index + 1])}
      />
    </div>
  );
}
