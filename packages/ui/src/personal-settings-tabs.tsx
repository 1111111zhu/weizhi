"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import type { ReactNode } from "react";

import { cn } from "./utils";

export type PersonalSettingsTabOption<T extends string = string> = {
  label: ReactNode;
  value: T;
};

export function PersonalSettingsTabs<T extends string>({
  className,
  label,
  onValueChange,
  options,
  value,
}: {
  className?: string;
  label: string;
  onValueChange: (value: T) => void;
  options: PersonalSettingsTabOption<T>[];
  value: T;
}) {
  const handleValueChange = (nextValue: string) =>
    onValueChange(nextValue as T);
  return (
    <TabsPrimitive.Root
      aria-label={label}
      className={cn("w-fit", className)}
      value={value}
      onValueChange={handleValueChange}
    >
      <TabsPrimitive.List className="bg-muted inline-flex h-7 w-fit items-center rounded-lg p-0.5">
        {options.map((option) => (
          <TabsPrimitive.Tab
            className="text-foreground/60 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 data-active:bg-background data-active:text-foreground inline-flex h-[calc(100%-1px)] items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 text-xs leading-none font-medium whitespace-nowrap transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-start]:pl-1 data-active:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            key={option.value}
            value={option.value}
          >
            {option.label}
          </TabsPrimitive.Tab>
        ))}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}
