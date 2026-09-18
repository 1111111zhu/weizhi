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
import { getTmsWorkspaceCopy } from "@/i18n/dictionaries";
import type { TmsWorkspaceCopy } from "@/i18n/dictionaries";
import { cn } from "@/lib/utils";

export function ApprovalColumnFilterHeader({
  label,
  onChange,
  options,
  selectedValues,
  trigger,
  copy = getTmsWorkspaceCopy("en-US"),
}: {
  label: string;
  onChange: (values: string[]) => void;
  options: { value: string; label: string }[];
  selectedValues: string[];
  trigger?: ReactNode;
  copy?: TmsWorkspaceCopy;
}) {
  const [search, setSearch] = useState("");
  const visibleOptions = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  );
  const active = selectedValues.length > 0;

  return (
    <div className="relative min-w-0 pr-6 text-center">
      {trigger ?? (
        <span className="block truncate whitespace-nowrap">{label}</span>
      )}
      <Popover>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`${copy.filter} ${label}`}
              data-filter-active={active ? "true" : "false"}
              className={cn(
                "absolute right-1 top-1/2 z-20 size-6 -translate-y-1/2 rounded-md border border-transparent bg-muted/80 p-0 text-muted-foreground transition-[background-color,border-color,color,box-shadow] duration-150 hover:border-primary/50 hover:bg-primary/10 hover:text-primary focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/40 data-[state=open]:border-primary data-[state=open]:bg-primary/10 data-[filter-active=true]:border-primary/60",
                active && "border-primary/60 bg-primary/10 text-primary"
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
            aria-label={`${copy.filterSearch} ${label}`}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            className="mb-2 h-7 shrink-0 text-xs"
            placeholder={`${copy.filterSearch} ${label}`}
          />
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {visibleOptions.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted"
              >
                <Checkbox
                  checked={selectedValues.includes(option.value)}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked
                        ? [...selectedValues, option.value]
                        : selectedValues.filter((item) => item !== option.value)
                    )
                  }
                />
                <span className="truncate">{option.label}</span>
              </label>
            ))}
            {visibleOptions.length > 0 ? null : (
              <p className="px-1.5 py-2 text-xs text-muted-foreground">
                {copy.filterNoMatches}
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
              {copy.clearFilter}
            </Button>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
