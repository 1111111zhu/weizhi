"use client";
"use no memo";

import type { Column } from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowLeftToLineIcon,
  ArrowRightIcon,
  ArrowRightToLineIcon,
  ArrowUpIcon,
  ChevronsUpDownIcon,
  PinOffIcon,
} from "lucide-react";
import { memo, useMemo } from "react";
import type { HTMLAttributes, ReactNode } from "react";

import { Button } from "../button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../dropdown-menu";
import { cn } from "../utils";
import { getColumnHeaderLabel, useDataGrid } from "./data-grid";
import { getDataGridCopy } from "./data-grid-copy";

const selectedMenuItemClassName =
  "data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[selected]:**:text-primary-foreground data-[selected]:focus:bg-primary data-[selected]:focus:text-primary-foreground data-[selected]:focus:**:text-primary-foreground";

interface DataGridColumnHeaderProps<
  TData,
  TValue,
> extends HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  /** When omitted, uses `column.columnDef.meta.headerTitle`, then a string `columnDef.header`, then `column.id`. */
  title?: string;
  accessibleName?: string;
  icon?: ReactNode;
  /** Reserved; pin controls are gated by tableLayout.columnsPinnable + column.getCanPin(). */
  pinnable?: boolean;
  filter?: ReactNode;
}

function DataGridColumnHeaderInner<TData, TValue>({
  column,
  title,
  accessibleName,
  icon,
  className,
  filter,
}: DataGridColumnHeaderProps<TData, TValue>) {
  const { isLoading, table, props } = useDataGrid();
  const copy = getDataGridCopy(props.locale);
  const resolvedTitle = title ?? getColumnHeaderLabel(column);
  // TanStack's columnOrder defaults to [] until a consumer seeds it; fall
  // Back to the definition order so Move Left/Right work out of the box.
  const columnOrderState = table.getState().columnOrder;
  const columnOrder =
    columnOrderState.length > 0
      ? columnOrderState
      : table.getAllLeafColumns().map((leafColumn) => leafColumn.id);
  const isSorted = column.getIsSorted();
  const isPinned = column.getIsPinned();
  const canSort = column.getCanSort();
  const canPin = column.getCanPin();
  const canResize = column.getCanResize();
  const columnIndex = columnOrder.indexOf(column.id);
  const canMoveLeft = columnIndex > 0;
  const canMoveRight = columnIndex < columnOrder.length - 1;
  const handleSort = () => {
    if (isSorted === "asc") {
      column.toggleSorting(true);
    } else if (isSorted === "desc") {
      column.clearSorting();
    } else {
      column.toggleSorting(false);
    }
  };
  const headerLabelClassName = cn(
    "text-secondary-foreground/80 inline-flex h-full items-center gap-1.5 font-normal! text-[0.8125rem]! leading-[calc(1.125/0.8125)]! [&_svg]:size-3.5 [&_svg]:opacity-60",
    className
  );
  const headerButtonClassName = cn(
    "text-secondary-foreground/80 hover:bg-secondary data-[state=open]:bg-secondary hover:text-foreground data-[state=open]:text-foreground h-6 max-w-full overflow-hidden rounded-lg px-2 font-normal! text-[0.8125rem]! leading-[calc(1.125/0.8125)]!",
    className
  );
  const sortIcon =
    canSort &&
    (isSorted === "desc" ? (
      <ArrowDownIcon className="size-3.25" aria-hidden="true" />
    ) : isSorted === "asc" ? (
      <ArrowUpIcon className="size-3.25" aria-hidden="true" />
    ) : (
      <ChevronsUpDownIcon className="mt-px size-3.25" aria-hidden="true" />
    ));
  const hasControls =
    props.tableLayout?.columnsMovable ||
    (props.tableLayout?.columnsPinnable && canPin) ||
    filter;
  const menuItems = useMemo(() => {
    const items: ReactNode[] = [];
    let hasPreviousSection = false;

    // Sort section
    if (canSort) {
      items.push(
        <DropdownMenuItem
          key="sort-asc"
          className={selectedMenuItemClassName}
          data-selected={isSorted === "asc" ? "" : undefined}
          onClick={() => {
            if (isSorted === "asc") {
              column.clearSorting();
            } else {
              column.toggleSorting(false);
            }
          }}
          disabled={!canSort}
        >
          <ArrowUpIcon aria-hidden="true" />
          <span className="grow">{copy.sortAscending}</span>
        </DropdownMenuItem>,
        <DropdownMenuItem
          key="sort-desc"
          className={selectedMenuItemClassName}
          data-selected={isSorted === "desc" ? "" : undefined}
          onClick={() => {
            if (isSorted === "desc") {
              column.clearSorting();
            } else {
              column.toggleSorting(true);
            }
          }}
          disabled={!canSort}
        >
          <ArrowDownIcon aria-hidden="true" />
          <span className="grow">{copy.sortDescending}</span>
        </DropdownMenuItem>
      );
      hasPreviousSection = true;
    }

    // Filter section
    if (filter) {
      if (hasPreviousSection) {
        items.push(<DropdownMenuSeparator key="sep-filter" />);
      }
      items.push(
        <DropdownMenuGroup key="group-filter">{filter}</DropdownMenuGroup>
      );
      hasPreviousSection = true;
    }

    // Pin section
    if (props.tableLayout?.columnsPinnable && canPin) {
      if (hasPreviousSection) {
        items.push(<DropdownMenuSeparator key="sep-pin" />);
      }
      items.push(
        <DropdownMenuItem
          key="pin-left"
          className={selectedMenuItemClassName}
          data-selected={isPinned === "left" ? "" : undefined}
          onClick={() => column.pin(isPinned === "left" ? false : "left")}
        >
          <ArrowLeftToLineIcon aria-hidden="true" />
          <span className="grow">{copy.pinLeft}</span>
        </DropdownMenuItem>,
        <DropdownMenuItem
          key="pin-right"
          className={selectedMenuItemClassName}
          data-selected={isPinned === "right" ? "" : undefined}
          onClick={() => column.pin(isPinned === "right" ? false : "right")}
        >
          <ArrowRightToLineIcon aria-hidden="true" />
          <span className="grow">{copy.pinRight}</span>
        </DropdownMenuItem>
      );
      hasPreviousSection = true;
    }

    // Move section
    if (props.tableLayout?.columnsMovable) {
      if (hasPreviousSection) {
        items.push(<DropdownMenuSeparator key="sep-move" />);
      }
      items.push(
        <DropdownMenuItem
          key="move-left"
          onClick={() => {
            if (columnIndex > 0) {
              const newOrder = [...columnOrder];
              const [movedColumn] = newOrder.splice(columnIndex, 1);
              newOrder.splice(columnIndex - 1, 0, movedColumn);
              table.setColumnOrder(newOrder);
            }
          }}
          disabled={!canMoveLeft || isPinned !== false}
        >
          <ArrowLeftIcon aria-hidden="true" />
          <span>{copy.moveLeft}</span>
        </DropdownMenuItem>,
        <DropdownMenuItem
          key="move-right"
          onClick={() => {
            if (columnIndex < columnOrder.length - 1) {
              const newOrder = [...columnOrder];
              const [movedColumn] = newOrder.splice(columnIndex, 1);
              newOrder.splice(columnIndex + 1, 0, movedColumn);
              table.setColumnOrder(newOrder);
            }
          }}
          disabled={!canMoveRight || isPinned !== false}
        >
          <ArrowRightIcon aria-hidden="true" />
          <span>{copy.moveRight}</span>
        </DropdownMenuItem>
      );
      hasPreviousSection = true;
    }

    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    copy,
    filter,
    canSort,
    isSorted,
    column,
    props.tableLayout?.columnsPinnable,
    props.tableLayout?.columnsMovable,
    canPin,
    isPinned,
    canMoveLeft,
    canMoveRight,
    table,
    columnIndex,
    columnOrder,
  ]);

  if (hasControls) {
    return (
      <div className="-ms-2 flex h-full max-w-full min-w-0 items-center justify-between gap-1.5 pe-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className={headerButtonClassName}
                disabled={isLoading}
                accessibleName={accessibleName}
              >
                {icon}
                <span className="min-w-0 truncate">{resolvedTitle}</span>
                {sortIcon}
              </Button>
            }
          />
          <DropdownMenuContent
            className="w-40 data-closed:animate-none"
            align="start"
          >
            {menuItems}
          </DropdownMenuContent>
        </DropdownMenu>
        {props.tableLayout?.columnsPinnable && canPin && isPinned && (
          <Button
            size="icon-sm"
            variant="ghost"
            className="-me-1 size-7 rounded-lg"
            onClick={() => column.pin(false)}
            aria-label={copy.unpinColumn(resolvedTitle)}
            title={copy.unpinColumn(resolvedTitle)}
          >
            <PinOffIcon className="size-3.5! opacity-50!" aria-hidden="true" />
          </Button>
        )}
      </div>
    );
  }

  if (canSort || (props.tableLayout?.columnsResizable && canResize)) {
    return (
      <div className="-ms-2 flex h-full max-w-full min-w-0 items-center pe-2">
        <Button
          variant="ghost"
          className={headerButtonClassName}
          disabled={isLoading}
          accessibleName={accessibleName}
          onClick={handleSort}
        >
          {icon}
          <span className="min-w-0 truncate">{resolvedTitle}</span>
          {sortIcon}
        </Button>
      </div>
    );
  }

  return (
    <div className={headerLabelClassName}>
      {icon}
      {resolvedTitle}
    </div>
  );
}

const DataGridColumnHeader = memo(
  DataGridColumnHeaderInner
) as typeof DataGridColumnHeaderInner;

export { DataGridColumnHeader, type DataGridColumnHeaderProps };
