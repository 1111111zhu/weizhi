"use client";

import type { Table } from "@tanstack/react-table";
import { Ellipsis, X } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Badge } from "../badge";
import { Button } from "../button";
import { FrameHeader, FrameTitle } from "../frame";
import { useCompactViewport } from "../hooks/use-compact-viewport";
import { MobileActionSheet } from "../mobile-workspace";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { getDataGridCopy } from "./data-grid-copy";
import type { DataGridLocale } from "./data-grid-copy";

const TOOLBAR_GAP_PX = 12;
const TOOLBAR_EXPAND_HYSTERESIS_PX = 24;
const TOOLBAR_TITLE_MAX_WIDTH_PX = 240;

export function getDataGridToolbarAvailableWidth(
  width: number,
  paddingLeft: string,
  paddingRight: string
) {
  return Math.max(
    0,
    width -
      (Number(paddingLeft.replace("px", "")) || 0) -
      (Number(paddingRight.replace("px", "")) || 0)
  );
}

type DataGridToolbarFitInput = {
  actionsWidth: number;
  availableWidth: number;
  hasPersistentActions: boolean;
  persistentActionsWidth: number;
  titleWidth: number;
};

function getDataGridToolbarRequiredWidth({
  actionsWidth,
  hasPersistentActions,
  persistentActionsWidth,
  titleWidth,
}: Omit<DataGridToolbarFitInput, "availableWidth">) {
  const sectionCount = 2 + Number(hasPersistentActions);
  return (
    Math.min(titleWidth, TOOLBAR_TITLE_MAX_WIDTH_PX) +
    persistentActionsWidth +
    actionsWidth +
    Math.max(0, sectionCount - 1) * TOOLBAR_GAP_PX
  );
}

export function shouldCollapseDataGridToolbarActions({
  availableWidth,
  ...widths
}: DataGridToolbarFitInput) {
  if (availableWidth <= 0) {
    return false;
  }
  return getDataGridToolbarRequiredWidth(widths) > availableWidth;
}

type ProjectWingDataGridToolbarProps<TData> = {
  locale?: DataGridLocale;
  actions?: ReactNode;
  primaryAction?: ReactNode;
  overflowLabel?: string;
  persistentActions?: ReactNode;
  recordCount?: number;
  selectionSummary?: string;
  showRecordCount?: boolean;
  table?: Table<TData>;
  testId?: string;
  title: string;
  titleAdornment?: ReactNode;
};

function ProjectWingDataGridToolbar<TData>({
  locale,
  actions,
  primaryAction,
  overflowLabel,
  persistentActions,
  recordCount: providedRecordCount,
  selectionSummary,
  showRecordCount = true,
  table,
  testId,
  title,
  titleAdornment,
}: ProjectWingDataGridToolbarProps<TData>) {
  const copy = getDataGridCopy(locale);
  const isMobile = useCompactViewport(767);
  const toolbarRef = useRef<HTMLElement | null>(null);
  const titleRef = useRef<HTMLDivElement | null>(null);
  const persistentActionsRef = useRef<HTMLDivElement | null>(null);
  const inlineActionsRef = useRef<HTMLDivElement | null>(null);
  const primaryActionRef = useRef<HTMLDivElement | null>(null);
  const expandedRequiredWidthRef = useRef(0);
  const [actionsCollapsed, setActionsCollapsed] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const recordCount =
    providedRecordCount ?? table?.getFilteredRowModel().rows.length ?? 0;
  const selectedCount = table?.getSelectedRowModel().rows.length ?? 0;
  const selectedLabel = (selectionSummary ?? copy.selectionSummary)
    .replace("{selected}", String(selectedCount))
    .replace("{total}", String(recordCount));
  const badgeLabel =
    selectedCount && selectedLabel ? selectedLabel : String(recordCount);
  const measureActions = useCallback(() => {
    const toolbar = toolbarRef.current;
    const titleElement = titleRef.current;
    if (!toolbar || !titleElement || !actions) {
      setActionsCollapsed(false);
      setOverflowOpen(false);
      return;
    }

    const styles = toolbar.ownerDocument.defaultView?.getComputedStyle(toolbar);
    const primaryWidth = primaryActionRef.current?.scrollWidth ?? 0;
    const availableWidth = Math.max(
      0,
      getDataGridToolbarAvailableWidth(
        toolbar.clientWidth,
        styles?.paddingLeft ?? "0",
        styles?.paddingRight ?? "0"
      ) -
        primaryWidth -
        (primaryAction ? TOOLBAR_GAP_PX : 0)
    );
    if (availableWidth <= 0) {
      setActionsCollapsed(false);
      setOverflowOpen(false);
      return;
    }

    if (!actionsCollapsed && inlineActionsRef.current) {
      const requiredWidth = getDataGridToolbarRequiredWidth({
        actionsWidth: inlineActionsRef.current.scrollWidth,
        hasPersistentActions: Boolean(persistentActions),
        persistentActionsWidth: persistentActionsRef.current?.scrollWidth ?? 0,
        titleWidth: titleElement.scrollWidth,
      });
      expandedRequiredWidthRef.current = requiredWidth;
      if (requiredWidth > availableWidth + 1) {
        setActionsCollapsed(true);
      }
      return;
    }

    if (
      actionsCollapsed &&
      availableWidth >=
        expandedRequiredWidthRef.current + TOOLBAR_EXPAND_HYSTERESIS_PX
    ) {
      setActionsCollapsed(false);
      setOverflowOpen(false);
    }
  }, [actions, actionsCollapsed, persistentActions, primaryAction]);

  useLayoutEffect(() => {
    measureActions();
    const toolbar = toolbarRef.current;
    if (!toolbar || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(measureActions);
    observer.observe(toolbar);
    if (titleRef.current) {
      observer.observe(titleRef.current);
    }
    if (persistentActionsRef.current) {
      observer.observe(persistentActionsRef.current);
    }
    if (inlineActionsRef.current) {
      observer.observe(inlineActionsRef.current);
    }
    if (primaryActionRef.current) {
      observer.observe(primaryActionRef.current);
    }
    return () => observer.disconnect();
  }, [measureActions]);

  return (
    <FrameHeader
      ref={toolbarRef}
      className="relative z-20 flex w-full flex-row flex-nowrap items-center justify-between gap-3 py-3"
      data-testid={testId}
      data-grid-toolbar=""
      data-has-persistent-actions={Boolean(persistentActions) || undefined}
      role="group"
    >
      <div
        ref={titleRef}
        className="flex max-w-60 min-w-0 shrink items-center gap-2"
      >
        <FrameTitle
          aria-level={1}
          className="truncate text-base leading-6"
          role="heading"
        >
          {title}
        </FrameTitle>
        {titleAdornment ? (
          <span className="text-foreground shrink-0 text-sm font-medium">
            {titleAdornment}
          </span>
        ) : null}
        {showRecordCount ? (
          <Badge
            aria-label={
              selectedCount && selectedLabel
                ? selectedLabel
                : `${title}: ${recordCount}`
            }
            className={
              selectedCount && selectedLabel
                ? undefined
                : "min-w-6 px-1.5 tabular-nums"
            }
            radius={selectedCount && selectedLabel ? "default" : "full"}
            variant={
              selectedCount && selectedLabel ? "primary-light" : "secondary"
            }
          >
            {badgeLabel}
          </Badge>
        ) : null}
        {selectedCount > 0 && table ? (
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            accessibleName={copy.clearSelection}
            tooltip={copy.clearSelection}
            onClick={() => table.resetRowSelection(true)}
          >
            <X aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      {persistentActions || actions || primaryAction ? (
        <div
          data-grid-toolbar-controls=""
          className="flex min-w-0 flex-1 items-center justify-end gap-3"
        >
          {persistentActions ? (
            <div
              ref={persistentActionsRef}
              data-grid-persistent-actions=""
              className="flex min-w-0 flex-1 items-center justify-end gap-2 [&>*]:min-w-0!"
            >
              {persistentActions}
            </div>
          ) : null}
          {actions && !isMobile && !actionsCollapsed ? (
            <div
              ref={inlineActionsRef}
              className="flex shrink-0 items-center justify-end gap-2 whitespace-nowrap"
            >
              {actions}
            </div>
          ) : null}
          {actions && isMobile ? (
            <>
              <Button
                accessibleName={overflowLabel ?? copy.moreActions}
                size="icon-sm"
                variant="outline"
                aria-haspopup="dialog"
                aria-expanded={overflowOpen}
                onClick={() => setOverflowOpen(true)}
              >
                <Ellipsis aria-hidden="true" />
              </Button>
              <MobileActionSheet
                open={overflowOpen}
                onOpenChange={setOverflowOpen}
                title={overflowLabel ?? copy.moreActions}
                closeLabel={copy.closeActions}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {actions}
                </div>
              </MobileActionSheet>
            </>
          ) : actions && actionsCollapsed ? (
            <Popover open={overflowOpen} onOpenChange={setOverflowOpen}>
              <PopoverTrigger
                render={
                  <Button
                    accessibleName={overflowLabel ?? copy.moreActions}
                    size="icon-sm"
                    tooltip={overflowLabel ?? copy.moreActions}
                    variant="outline"
                  />
                }
              >
                <Ellipsis aria-hidden="true" />
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-auto max-w-lg"
                side="bottom"
              >
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {actions}
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
          {primaryAction ? (
            <div ref={primaryActionRef} className="flex shrink-0 items-center">
              {primaryAction}
            </div>
          ) : null}
        </div>
      ) : null}
    </FrameHeader>
  );
}

export { ProjectWingDataGridToolbar };
export type { DataGridToolbarFitInput, ProjectWingDataGridToolbarProps };
