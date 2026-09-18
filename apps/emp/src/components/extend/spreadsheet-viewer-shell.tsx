"use client";

import {
  MinusSignCircleIcon,
  PlusSignCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import * as React from "react";
import { useElementWidth } from "./document-viewer-sidebar";
import { PreviewCloseAction } from "./preview-close-action";

import {
  PREVIEW_ZOOM_TRIGGER_CLASS_NAME,
  PREVIEW_ZOOM_VALUE_CLASS_NAME,
} from "@/components/extend/preview-zoom-control";
import { Button } from "@/components/extend/ui/button";
import { ScrollArea } from "@/components/extend/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/extend/ui/select";
import { Separator } from "@/components/extend/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/extend/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/extend/ui/tooltip";

const SPREADSHEET_DROPDOWN_Z_INDEX_CLASS = "z-40";

function ToolbarTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export function SpreadsheetViewerToolbar({
  actionMenu,
  canZoomIn,
  canZoomOut,
  currentZoom,
  leadingContent,
  onZoomChange,
  onZoomIn,
  onZoomOut,
  searchControl,
  toolbarActions,
  zoomInLabel = "Zoom in",
  zoomOptions,
  zoomOutLabel = "Zoom out",
}: {
  actionMenu?: React.ReactNode | ((controls: React.ReactNode) => React.ReactNode);
  canZoomIn: boolean;
  canZoomOut: boolean;
  currentZoom: number;
  leadingContent?: React.ReactNode;
  onZoomChange: (zoom: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  searchControl?: React.ReactNode;
  toolbarActions?: React.ReactNode;
  zoomInLabel?: string;
  zoomOptions: readonly number[];
  zoomOutLabel?: string;
}) {
  const [toolbarRef, toolbarWidth] = useElementWidth<HTMLDivElement>();
  const compact = toolbarWidth > 0 && toolbarWidth < 700 && typeof actionMenu === "function";
  const minimal = toolbarWidth > 0 && toolbarWidth < 440;
  return (
    <div ref={toolbarRef} data-file-identity-toolbar className="flex min-h-12 flex-nowrap items-center justify-end gap-2 border-b bg-background px-3 py-2">
      {leadingContent ? (
        <div className="min-w-0 flex-1">{leadingContent}</div>
      ) : null}
      <TooltipProvider>
        <div className="ml-auto flex shrink-0 flex-nowrap items-center justify-end gap-1">
          <div className="flex flex-none items-center gap-1">
            {minimal ? null : <ToolbarTooltip label={zoomOutLabel}>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={!canZoomOut}
                aria-label={zoomOutLabel}
                onClick={onZoomOut}
              >
                <HugeiconsIcon icon={MinusSignCircleIcon} className="size-4" />
              </Button>
            </ToolbarTooltip>}
            <Select
              value={currentZoom.toString()}
              onValueChange={(value) => onZoomChange(Number(value))}
              modal={false}
            >
              <SelectTrigger
                size="sm"
                className={PREVIEW_ZOOM_TRIGGER_CLASS_NAME}
                aria-label="Zoom level"
              >
                <SelectValue className={PREVIEW_ZOOM_VALUE_CLASS_NAME}>
                  {currentZoom}%
                </SelectValue>
              </SelectTrigger>
              <SelectContent
                align="end"
                alignItemWithTrigger={false}
                className={SPREADSHEET_DROPDOWN_Z_INDEX_CLASS}
              >
                {zoomOptions.map((value) => (
                  <SelectItem key={value} value={value.toString()}>
                    {value}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {minimal ? null : <ToolbarTooltip label={zoomInLabel}>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={!canZoomIn}
                aria-label={zoomInLabel}
                onClick={onZoomIn}
              >
                <HugeiconsIcon icon={PlusSignCircleIcon} className="size-4" />
              </Button>
            </ToolbarTooltip>}
          </div>
          {!compact && searchControl ? (
            <>
              <Separator
                orientation="vertical"
                className="mx-1 h-4 self-center"
              />
              {searchControl}
            </>
          ) : null}
          {actionMenu ? (
            <>
              <Separator
                orientation="vertical"
                className="mx-1 h-4 self-center"
              />
              {typeof actionMenu === "function" ? actionMenu(compact ? <>{searchControl}{toolbarActions}</> : null) : actionMenu}
            </>
          ) : null}
          {!compact && toolbarActions ? (
            <>
              <Separator
                orientation="vertical"
                className="mx-1 h-4 self-center"
              />
              {toolbarActions}
            </>
          ) : null}
        </div>
      </TooltipProvider>
      <PreviewCloseAction />
    </div>
  );
}

export function SpreadsheetViewerSheetTabs({
  activeSheetIndex,
  onActiveSheetIndexChange,
  onMouseLeave,
  onSheetMouseEnter,
  sheetNames,
  triggerRef,
  viewportRef,
}: {
  activeSheetIndex: number;
  onActiveSheetIndexChange: (index: number) => void;
  onMouseLeave?: () => void;
  onSheetMouseEnter?: (index: number) => void;
  sheetNames: readonly string[];
  triggerRef?: (index: number, node: HTMLButtonElement | null) => void;
  viewportRef?: React.RefObject<HTMLDivElement | null>;
}) {
  if (sheetNames.length <= 1) {
    return null;
  }

  return (
    <div className="border-t bg-muted/40 px-3 py-2" onMouseLeave={onMouseLeave}>
      <Tabs
        value={String(activeSheetIndex)}
        onValueChange={(value) => onActiveSheetIndexChange(Number(value))}
        className="gap-0"
      >
        <ScrollArea
          orientation="horizontal"
          scrollbarGutter
          className="h-10 w-full has-[[data-slot=scroll-area-viewport][data-has-overflow-x]]:h-[50px]"
          viewportClassName="overflow-y-hidden"
          viewportRef={viewportRef}
        >
          <div className="flex h-full items-center">
            <TabsList className="shrink-0">
              {sheetNames.map((sheetName, index) => (
                <TabsTrigger
                  key={`${index}-${sheetName}`}
                  ref={(node) => triggerRef?.(index, node)}
                  value={String(index)}
                  className="max-w-48 flex-none"
                  onMouseEnter={() => onSheetMouseEnter?.(index)}
                >
                  <span className="truncate">{sheetName}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
