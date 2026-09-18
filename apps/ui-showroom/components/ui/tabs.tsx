/* eslint-disable react/no-react-children, react/no-clone-element */

"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import * as React from "react";

import type { FeedbackType } from "@/hooks/use-feedback";
import { useFeedback } from "@/hooks/use-feedback";
import { cn } from "@/lib/utils";

function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]",
        className
      )}
      {...props}
    />
  );
}

type TabsTriggerProps = TabsPrimitive.Tab.Props & {
  asChild?: boolean;
  haptic?: boolean;
  sound?: FeedbackType;
};

function TabsTrigger({
  className,
  onClick,
  sound,
  haptic,
  children,
  asChild = false,
  nativeButton,
  ...props
}: TabsTriggerProps) {
  const play = useFeedback({ haptic, sound });
  const child = asChild
    ? (React.Children.only(children) as React.ReactElement)
    : null;

  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "data-[state=active]:bg-background dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      nativeButton={nativeButton ?? (asChild ? false : undefined)}
      onClick={(event) => {
        play();
        onClick?.(event);
      }}
      render={(renderProps, state) =>
        React.cloneElement(child ?? <BaseButton type="button" />, {
          ...renderProps,
          "data-state": state.active ? "active" : "inactive",
        })
      }
      {...props}
    >
      {asChild ? undefined : children}
    </TabsPrimitive.Tab>
  );
}

function TabsContent({
  className,
  children,
  asChild = false,
  render,
  ...props
}: TabsPrimitive.Panel.Props & { asChild?: boolean }) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      render={
        asChild ? (React.Children.only(children) as React.ReactElement) : render
      }
      {...props}
    >
      {asChild ? undefined : children}
    </TabsPrimitive.Panel>
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
