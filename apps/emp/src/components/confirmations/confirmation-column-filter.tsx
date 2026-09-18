import { ListFilter } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function ConfirmationColumnFilter({
  label,
  options,
  selectedValues,
  onChange,
  labels,
  trigger,
}: {
  label: string;
  options: { value: string; label: string }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  labels: {
    triggerLabel: string;
    searchLabel: string;
    clearLabel: string;
    emptyLabel: string;
  };
  trigger?: ReactNode;
}) {
  const [search, setSearch] = useState("");
  const visibleOptions = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  );
  const active = selectedValues.length > 0;

  return (
    <div className="relative min-w-0 pr-6">
      {trigger ?? <span className="block truncate">{label}</span>}
      <Popover>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`${labels.triggerLabel} ${label}`}
              data-filter-active={active ? "true" : "false"}
              className={cn(
                "absolute right-2 top-1/2 z-20 size-6 -translate-y-1/2 rounded-md border border-transparent bg-muted/80 p-0 text-muted-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-primary data-[filter-active=true]:border-primary/60 data-[filter-active=true]:text-primary",
                active && "bg-primary/10"
              )}
            >
              <ListFilter className="size-3.5" />
            </Button>
          }
        />
        <PopoverContent
          align="end"
          sideOffset={4}
          className="flex h-72 w-60 flex-col p-2"
        >
          <Input
            type="search"
            aria-label={labels.searchLabel}
            placeholder={labels.searchLabel}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            className="mb-2 h-7 shrink-0 text-xs"
          />
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {visibleOptions.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted"
              >
                <Checkbox
                  checked={selectedValues.includes(option.value)}
                  onCheckedChange={(checked) => {
                    if (checked === true) {
                      onChange(
                        selectedValues.includes(option.value)
                          ? selectedValues
                          : [...selectedValues, option.value]
                      );
                      return;
                    }
                    onChange(
                      selectedValues.filter((value) => value !== option.value)
                    );
                  }}
                />
                <span className="truncate">{option.label}</span>
              </label>
            ))}
            {visibleOptions.length > 0 ? null : (
              <p className="px-1.5 py-2 text-xs text-muted-foreground">
                {labels.emptyLabel}
              </p>
            )}
          </div>
          {active ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 h-7 w-full shrink-0 text-xs"
              onClick={() => onChange([])}
            >
              {labels.clearLabel}
            </Button>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
