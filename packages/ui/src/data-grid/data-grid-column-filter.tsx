"use client";
"use no memo";

import type { Column } from "@tanstack/react-table";
import { CheckIcon, CirclePlusIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "../badge";
import { Button } from "../button";
import { Input } from "../input";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { Separator } from "../separator";
import { cn } from "../utils";

interface DataGridColumnFilterProps<TData, TValue> {
  column?: Column<TData, TValue>;
  title?: string;
  searchable?: boolean;
  clearLabel?: string;
  emptyLabel?: string;
  selectedLabel?: string;
  options: {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
  }[];
}

function DataGridColumnFilter<TData, TValue>({
  column,
  title,
  options,
  searchable = true,
  clearLabel = "Clear filters",
  emptyLabel = "No results found.",
  selectedLabel = "{count} selected",
}: DataGridColumnFilterProps<TData, TValue>) {
  const facets = column?.getFacetedUniqueValues();
  const filterValue = column?.getFilterValue();
  const selectedValues = new Set(
    Array.isArray(filterValue) ? (filterValue as string[]) : []
  );
  const [searchQuery, setSearchQuery] = useState("");
  const filteredOptions = useMemo(() => {
    if (!searchQuery) {
      return options;
    }
    return options.filter((option) =>
      option.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [options, searchQuery]);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <CirclePlusIcon className="size-4" />
            {title}
            {selectedValues?.size > 0 && (
              <>
                <Separator orientation="vertical" className="mx-2 h-4" />
                <Badge
                  variant="secondary"
                  className="px-1 font-normal lg:hidden"
                >
                  {selectedValues.size}
                </Badge>
                <div className="hidden space-x-1 lg:flex">
                  {selectedValues.size > 2 ? (
                    <Badge variant="secondary" className="px-1 font-normal">
                      {selectedLabel.replace(
                        "{count}",
                        String(selectedValues.size)
                      )}
                    </Badge>
                  ) : (
                    options
                      .filter((option) => selectedValues.has(option.value))
                      .map((option) => (
                        <Badge
                          variant="secondary"
                          key={option.value}
                          className="px-1 font-normal"
                        >
                          {option.label}
                        </Badge>
                      ))
                  )}
                </div>
              </>
            )}
          </Button>
        }
      />
      <PopoverContent className="w-[200px] p-0" align="start">
        {searchable ? (
          <div className="p-2">
            <Input
              placeholder={title}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8"
            />
          </div>
        ) : null}
        <div className="max-h-[300px] overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div className="text-muted-foreground py-6 text-center text-sm">
              {emptyLabel}
            </div>
          ) : (
            <div className="p-1">
              {filteredOptions.map((option) => {
                const isSelected = selectedValues.has(option.value);
                const facetCount = facets?.get(option.value);
                const toggleOption = () => {
                  if (isSelected) {
                    selectedValues.delete(option.value);
                  } else {
                    selectedValues.add(option.value);
                  }
                  const filterValues = [...selectedValues];
                  column?.setFilterValue(
                    filterValues.length > 0 ? filterValues : undefined
                  );
                };
                return (
                  <div
                    key={option.value}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onClick={toggleOption}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleOption();
                      }
                    }}
                    className={cn(
                      "rounded-md relative flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm outline-hidden select-none",
                      "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                    )}
                  >
                    <div
                      className={cn(
                        "border-primary rounded-sm flex h-4 w-4 items-center justify-center border",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <CheckIcon className="h-4 w-4" />
                    </div>
                    {option.icon && (
                      <option.icon className="text-muted-foreground h-4 w-4" />
                    )}
                    <span>{option.label}</span>
                    {facetCount !== undefined && (
                      <span className="ms-auto flex h-4 w-4 items-center justify-center font-mono text-xs">
                        {facetCount}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {selectedValues.size > 0 && (
            <>
              <div className="bg-border -mx-1 my-1 h-px" />
              <div className="p-1">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => column?.setFilterValue(undefined)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      column?.setFilterValue(undefined);
                    }
                  }}
                  className="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground relative flex cursor-pointer items-center justify-center rounded-md px-2 py-1.5 text-sm outline-hidden select-none"
                >
                  {clearLabel}
                </div>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { DataGridColumnFilter, type DataGridColumnFilterProps };
