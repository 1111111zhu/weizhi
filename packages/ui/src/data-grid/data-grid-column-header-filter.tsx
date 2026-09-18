"use client";

import type { Column } from "@tanstack/react-table";
import { ListFilterIcon, RotateCcwIcon, SearchIcon } from "lucide-react";
import { useState } from "react";

import {
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "../dropdown-menu";
import { Input } from "../input";
import { cn } from "../utils";

type DataGridColumnHeaderFilterCopy = {
  clear: string;
  empty: string;
  filter: string;
  search: string;
};

function DataGridColumnHeaderFilter<TData, TValue>({
  column,
  copy,
  title,
}: {
  column: Column<TData, TValue>;
  copy: DataGridColumnHeaderFilterCopy;
  title: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const filterValue = column.getFilterValue();
  const selectedValues = new Set(
    Array.isArray(filterValue) ? (filterValue as string[]) : []
  );
  const labelValue = column.columnDef.meta?.filterValueLabel;
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const options = [...column.getFacetedUniqueValues().entries()]
    .map(([value, count]) => ({
      count,
      label: labelValue?.(value) ?? String(value || "-"),
      value: String(value ?? ""),
    }))
    .filter((option) =>
      option.label.toLocaleLowerCase().includes(normalizedQuery)
    )
    .sort((left, right) => left.label.localeCompare(right.label));

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="min-h-9 gap-2 rounded-lg px-2.5 py-1.5">
        <ListFilterIcon aria-hidden="true" />
        <span className="min-w-0 flex-1">{copy.filter}</span>
        {selectedValues.size > 0 ? (
          <span className="text-muted-foreground text-xs">
            {selectedValues.size}
          </span>
        ) : null}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-max max-w-[calc(100vw-2rem)] min-w-56 p-0">
        <DropdownMenuLabel className="p-2">
          <div className="relative">
            <SearchIcon
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2"
            />
            <Input
              aria-label={`${copy.search} ${title}`}
              autoFocus={false}
              className="focus-visible:border-input h-8 ps-8 focus-visible:ring-0"
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
              value={searchQuery}
            />
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuGroup className="max-h-64 overflow-y-auto p-1">
          {options.length > 0 ? (
            options.map((option, index) => {
              const isSelected = selectedValues.has(option.value);
              const previousIsSelected = selectedValues.has(
                options[index - 1]?.value
              );
              const nextIsSelected = selectedValues.has(
                options[index + 1]?.value
              );

              return (
                <DropdownMenuCheckboxItem
                  checked={isSelected}
                  className={cn(
                    "group/filter-option mx-1 min-h-8 gap-2 rounded-lg border-t border-transparent px-2.5 py-1.5 data-checked:bg-primary data-checked:text-primary-foreground data-checked:**:text-primary-foreground data-checked:focus:bg-primary data-checked:focus:text-primary-foreground data-checked:focus:**:text-primary-foreground [&_[data-slot=dropdown-menu-checkbox-item-indicator]]:hidden",
                    isSelected &&
                      previousIsSelected &&
                      "rounded-t-none border-primary-foreground/20",
                    isSelected && nextIsSelected && "rounded-b-none"
                  )}
                  key={option.value}
                  onCheckedChange={(checked) => {
                    const nextValues = new Set(selectedValues);
                    if (checked) {
                      nextValues.add(option.value);
                    } else {
                      nextValues.delete(option.value);
                    }
                    column.setFilterValue(
                      nextValues.size > 0 ? [...nextValues] : undefined
                    );
                  }}
                  onSelect={(event) => event.preventDefault()}
                >
                  <span className="flex-1 whitespace-nowrap">
                    {option.label}
                  </span>
                  {option.count > 1 ? (
                    <span className="ms-auto min-w-6 text-end text-xs tabular-nums opacity-60">
                      {option.count}
                    </span>
                  ) : null}
                </DropdownMenuCheckboxItem>
              );
            })
          ) : (
            <DropdownMenuLabel className="py-6 text-center font-normal">
              {copy.empty}
            </DropdownMenuLabel>
          )}
        </DropdownMenuGroup>
        {selectedValues.size > 0 ? (
          <>
            <DropdownMenuSeparator className="m-0" />
            <DropdownMenuItem
              className="m-1 justify-center"
              onClick={() => column.setFilterValue(undefined)}
            >
              <RotateCcwIcon aria-hidden="true" />
              {copy.clear}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export { DataGridColumnHeaderFilter, type DataGridColumnHeaderFilterCopy };
