"use client";

import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Download01Icon,
  Moon02Icon,
  MoreHorizontalIcon,
  Upload01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";

import { Button } from "@/components/extend/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/extend/ui/dropdown-menu";

type WorkbookFileActionsMenuProps = {
  additionalControls?: ReactNode;
  actionsLabel?: string;
  downloadDisabled?: boolean;
  downloadLabel?: string;
  isDark?: boolean;
  onDownload?: () => void;
  onIsDarkChange?: (checked: boolean) => void;
  onNextColumns?: () => void;
  onPreviousColumns?: () => void;
  onUploadClick?: () => void;
  nextColumnsDisabled?: boolean;
  nextColumnsLabel?: string;
  previousColumnsDisabled?: boolean;
  previousColumnsLabel?: string;
  showDownloadButton: boolean;
  showNightRenderToggle?: boolean;
  showUploadButton: boolean;
  uploadLabel?: string;
};

function WorkbookThemeAction({
  isDark,
  onIsDarkChange,
}: Pick<WorkbookFileActionsMenuProps, "isDark" | "onIsDarkChange">) {
  return (
    <DropdownMenuCheckboxItem
      checked={Boolean(isDark)}
      variant="switch"
      onCheckedChange={(checked) => onIsDarkChange?.(checked === true)}
    >
      <span className="flex min-w-0 items-center gap-2">
        <HugeiconsIcon icon={Moon02Icon} className="size-4" />
        Dark mode
      </span>
    </DropdownMenuCheckboxItem>
  );
}

function WorkbookFileActions({
  downloadDisabled,
  downloadLabel,
  onDownload,
  onUploadClick,
  showDownloadButton,
  showUploadButton,
  uploadLabel,
}: WorkbookFileActionsMenuProps) {
  return (
    <DropdownMenuGroup>
      {showDownloadButton && onDownload ? (
        <DropdownMenuItem disabled={downloadDisabled} onClick={onDownload}>
          <HugeiconsIcon icon={Download01Icon} className="size-4" />
          {downloadLabel}
        </DropdownMenuItem>
      ) : null}
      {showUploadButton ? (
        <DropdownMenuItem onClick={() => onUploadClick?.()}>
          <HugeiconsIcon icon={Upload01Icon} className="size-4" />
          {uploadLabel}
        </DropdownMenuItem>
      ) : null}
    </DropdownMenuGroup>
  );
}

function WorkbookColumnActions({
  nextColumnsDisabled,
  nextColumnsLabel,
  onNextColumns,
  onPreviousColumns,
  previousColumnsDisabled,
  previousColumnsLabel,
}: WorkbookFileActionsMenuProps) {
  return (
    <DropdownMenuGroup>
      {onPreviousColumns ? (
        <DropdownMenuItem
          disabled={previousColumnsDisabled}
          onClick={onPreviousColumns}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
          {previousColumnsLabel}
        </DropdownMenuItem>
      ) : null}
      {onNextColumns ? (
        <DropdownMenuItem
          disabled={nextColumnsDisabled}
          onClick={onNextColumns}
        >
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
          {nextColumnsLabel}
        </DropdownMenuItem>
      ) : null}
    </DropdownMenuGroup>
  );
}

export function WorkbookFileActionsMenu({
  actionsLabel = "Open workbook actions",
  downloadDisabled = false,
  downloadLabel = "Download",
  nextColumnsDisabled = false,
  nextColumnsLabel = "Next columns",
  previousColumnsDisabled = false,
  previousColumnsLabel = "Previous columns",
  showNightRenderToggle = false,
  uploadLabel = "Upload",
  ...props
}: WorkbookFileActionsMenuProps) {
  const { onIsDarkChange, onNextColumns, onPreviousColumns } = props;
  const showThemeControl = showNightRenderToggle && Boolean(onIsDarkChange);
  const showFileActions =
    (props.showDownloadButton && props.onDownload) || props.showUploadButton;
  const showColumnActions = onPreviousColumns || onNextColumns;
  if (!showThemeControl && !showFileActions && !showColumnActions && !props.additionalControls) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={actionsLabel}
          />
        }
      >
        <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-40 w-52">
        {showThemeControl ? (
          <WorkbookThemeAction
            isDark={props.isDark}
            onIsDarkChange={onIsDarkChange}
          />
        ) : null}
        {showThemeControl && (showFileActions || showColumnActions) ? (
          <DropdownMenuSeparator />
        ) : null}
        {showFileActions ? (
          <WorkbookFileActions
            {...props}
            downloadDisabled={downloadDisabled}
            downloadLabel={downloadLabel}
            uploadLabel={uploadLabel}
          />
        ) : null}
        {showColumnActions && showFileActions ? (
          <DropdownMenuSeparator />
        ) : null}
        {showColumnActions ? (
          <WorkbookColumnActions
            {...props}
            nextColumnsDisabled={nextColumnsDisabled}
            nextColumnsLabel={nextColumnsLabel}
            previousColumnsDisabled={previousColumnsDisabled}
            previousColumnsLabel={previousColumnsLabel}
          />
        ) : null}
        {props.additionalControls ? (
          <>
            <DropdownMenuSeparator />
            <div className="flex items-center gap-1 px-2 py-1">{props.additionalControls}</div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
