"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

function Tabs({
  className,
  children,
  label,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props & { label?: React.ReactNode }) {
  const labelId = React.useId();

  return (
    <TabsPrimitive.Root
      aria-labelledby={label ? labelId : undefined}
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col data-[orientation=vertical]:flex-row",
        className
      )}
      {...props}
    >
      {label ? (
        <span id={labelId} hidden>
          {label}
        </span>
      ) : null}
      {children}
    </TabsPrimitive.Root>
  );
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-8 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function TabsList({
  className,
  children,
  label,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props &
  VariantProps<typeof tabsListVariants> & { label?: React.ReactNode }) {
  const labelId = React.useId();

  return (
    <TabsPrimitive.List
      aria-labelledby={label ? labelId : undefined}
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      {label ? (
        <span id={labelId} hidden>
          {label}
        </span>
      ) : null}
      {children}
    </TabsPrimitive.List>
  );
}

function TabsTrigger({
  className,
  children,
  ...props
}: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium leading-none whitespace-nowrap text-foreground/60 transition-[background-color,color,box-shadow,scale] group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:outline-1 active:not-disabled:scale-[0.98] motion-reduce:active:not-disabled:scale-100 motion-reduce:transition-none disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:h-9 group-data-[variant=line]/tabs-list:px-2 group-data-[variant=line]/tabs-list:py-0 group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "duration-[var(--motion-fast)] ease-[var(--motion-ease)]",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-foreground",
        "after:absolute after:bg-primary after:opacity-0 after:transition-opacity after:duration-[var(--motion-fast)] after:ease-[var(--motion-ease)] group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-4px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=horizontal]/tabs:after:scale-x-75 group-data-[orientation=horizontal]/tabs:data-active:after:scale-x-100 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[orientation=vertical]/tabs:after:scale-y-75 group-data-[orientation=vertical]/tabs:data-active:after:scale-y-100 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.Tab>
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn(
        "flex-1 text-sm outline-none transition-opacity duration-[var(--motion-fast)] ease-[var(--motion-ease)] data-starting-style:opacity-0 data-ending-style:hidden data-ending-style:transition-none motion-reduce:transition-none",
        className
      )}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
