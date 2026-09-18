"use client";
"use no memo";

import type { Table } from "@tanstack/react-table";
import { Check, ChevronDown, RotateCcw } from "lucide-react";
import { cloneElement } from "react";
import type { ReactElement } from "react";

import { Button } from "../button";
import { ButtonGroup } from "../button-group";
import {
  MorphPopover,
  MorphPopoverContent,
  MorphPopoverTrigger,
} from "../morph-popover";
import { getColumnHeaderLabel } from "./data-grid";
import { getDataGridCopy } from "./data-grid-copy";
import type { DataGridLocale } from "./data-grid-copy";

function DataGridColumnVisibility<TData>({
  table,
  trigger,
  label,
  locale,
  showChevron = true,
}: {
  table: Table<TData>;
  trigger: ReactElement<Record<string, unknown>>;
  label?: string;
  locale?: DataGridLocale;
  showChevron?: boolean;
}) {
  const copy = getDataGridCopy(locale);
  const resolvedLabel = label ?? copy.columns;
  const columns = table.getAllColumns().filter((column) => column.getCanHide());

  return (
    <MorphPopover>
      <MorphPopoverTrigger>
        {showChevron ? cloneTriggerWithChevron(trigger) : trigger}
      </MorphPopoverTrigger>
      <MorphPopoverContent
        className="w-max max-w-[calc(100vw-2rem)] p-1.5"
        radius={16}
      >
        <div
          aria-label={resolvedLabel}
          role="menu"
          tabIndex={-1}
          onKeyDown={(event) => {
            if (
              event.altKey ||
              event.ctrlKey ||
              event.metaKey ||
              event.defaultPrevented
            ) {
              return;
            }
            const items = [
              ...event.currentTarget.querySelectorAll<HTMLElement>(
                '[role="menuitemcheckbox"]:not(:disabled), [role="menuitem"]:not(:disabled)'
              ),
            ];
            const index = items.indexOf(document.activeElement as HTMLElement);
            const next =
              event.key === "ArrowDown"
                ? (index + 1) % items.length
                : event.key === "ArrowUp"
                  ? (index - 1 + items.length) % items.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? items.length - 1
                      : undefined;
            if (next !== undefined && items[next]) {
              event.preventDefault();
              items[next].focus();
            }
          }}
        >
          <p className="text-muted-foreground px-2.5 pt-1.5 pb-1 text-xs font-medium">
            {resolvedLabel}
          </p>
          <ButtonGroup className="max-h-[min(24rem,calc(100dvh-9rem))] w-full flex-col gap-0 overflow-y-auto overscroll-contain">
            {columns.map((column) => (
              <Button
                aria-checked={column.getIsVisible()}
                className="h-auto w-full justify-start gap-2.5 rounded-lg px-2.5 py-2 text-left font-normal!"
                key={column.id}
                onClick={() => column.toggleVisibility()}
                role="menuitemcheckbox"
                variant="ghost"
              >
                <Check
                  aria-hidden
                  className={
                    column.getIsVisible() ? "opacity-100" : "opacity-0"
                  }
                />
                <span className="capitalize">
                  {getColumnHeaderLabel(column)}
                </span>
              </Button>
            ))}
          </ButtonGroup>
          <div className="border-border mt-1 border-t pt-1">
            <Button
              type="button"
              role="menuitem"
              variant="ghost"
              className="w-full justify-start gap-2.5 px-2.5 font-normal!"
              onClick={() => {
                table.resetColumnVisibility();
                table.resetColumnSizing();
                table.resetColumnOrder();
                table.resetColumnPinning();
              }}
            >
              <RotateCcw aria-hidden="true" />
              {copy.restoreColumns}
            </Button>
          </div>
        </div>
      </MorphPopoverContent>
    </MorphPopover>
  );
}

function cloneTriggerWithChevron(
  trigger: ReactElement<Record<string, unknown>>
) {
  const triggerChildren = trigger.props.children;
  const existingChildren = Array.isArray(triggerChildren)
    ? triggerChildren
    : [triggerChildren];
  return cloneElement(trigger, {
    children: [
      ...existingChildren,
      <ChevronDown data-icon="inline-end" key="chevron" />,
    ],
  });
}

export { DataGridColumnVisibility };
