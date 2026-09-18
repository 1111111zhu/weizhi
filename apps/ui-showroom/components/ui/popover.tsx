/* eslint-disable react/no-react-children */

"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import * as React from "react";

import { dropdownClose, dropdownOpen } from "@/audio/core";
import { useOpenStateFeedback } from "@/hooks/use-open-state-feedback";
import { cn } from "@/lib/utils";

function Popover({
  onOpenChange,
  sounds = false,
  ...props
}: PopoverPrimitive.Root.Props & { sounds?: boolean }) {
  const handleOpenChange = useOpenStateFeedback({
    closeSound: dropdownClose,
    defaultOpen: props.defaultOpen,
    open: props.open,
    openSound: dropdownOpen,
    sounds,
  });

  return (
    <PopoverPrimitive.Root
      data-slot="popover"
      onOpenChange={(open, details) => {
        if (sounds) {
          handleOpenChange(open);
        }
        onOpenChange?.(open, details);
      }}
      {...props}
    />
  );
}

function PopoverTrigger({
  asChild = false,
  children,
  render,
  nativeButton,
  ...props
}: PopoverPrimitive.Trigger.Props & { asChild?: boolean }) {
  return (
    <PopoverPrimitive.Trigger
      data-slot="popover-trigger"
      nativeButton={nativeButton ?? (asChild ? false : undefined)}
      render={
        asChild ? (React.Children.only(children) as React.ReactElement) : render
      }
      {...props}
    >
      {asChild ? undefined : children}
    </PopoverPrimitive.Trigger>
  );
}

function PopoverContent({
  className,
  align = "center",
  alignOffset = 0,
  collisionAvoidance,
  side = "bottom",
  sideOffset = 4,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    "align" | "alignOffset" | "collisionAvoidance" | "side" | "sideOffset"
  >) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        collisionAvoidance={collisionAvoidance}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50 [--radix-popper-available-height:var(--available-height)] [--radix-popper-available-width:var(--available-width)]"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 origin-(--transform-origin) rounded-md border p-4 shadow-md outline-hidden",
            className
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

function PopoverAnchor({ ...props }: React.ComponentProps<"span">) {
  return <span data-slot="popover-anchor" {...props} />;
}

export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger };
