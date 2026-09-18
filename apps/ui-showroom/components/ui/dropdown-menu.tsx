/* eslint-disable react/no-react-children, unicorn/prefer-export-from */

"use client";

import { Menu as DropdownMenuPrimitive } from "@base-ui/react/menu";
import { ChevronRightIcon } from "lucide-react";
import * as React from "react";

import { dropdownClose, dropdownOpen } from "@/audio/core";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu-items";
import type { FeedbackType } from "@/hooks/use-feedback";
import { useFeedback } from "@/hooks/use-feedback";
import { useOpenStateFeedback } from "@/hooks/use-open-state-feedback";
import { cn } from "@/lib/utils";

function DropdownMenu({
  onOpenChange,
  sounds = false,
  ...props
}: DropdownMenuPrimitive.Root.Props & { sounds?: boolean }) {
  const handleOpenChange = useOpenStateFeedback({
    closeSound: dropdownClose,
    defaultOpen: props.defaultOpen,
    open: props.open,
    openSound: dropdownOpen,
    sounds,
  });

  return (
    <DropdownMenuPrimitive.Root
      data-slot="dropdown-menu"
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

function DropdownMenuPortal({ ...props }: DropdownMenuPrimitive.Portal.Props) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  );
}

function DropdownMenuTrigger({
  asChild = false,
  children,
  render,
  nativeButton,
  ...props
}: DropdownMenuPrimitive.Trigger.Props & { asChild?: boolean }) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      nativeButton={nativeButton ?? (asChild ? false : undefined)}
      render={
        asChild ? (React.Children.only(children) as React.ReactElement) : render
      }
      {...props}
    >
      {asChild ? undefined : children}
    </DropdownMenuPrimitive.Trigger>
  );
}

function DropdownMenuContent({
  className,
  align = "start",
  alignOffset = 0,
  collisionPadding,
  finalFocus,
  onCloseAutoFocus,
  side = "bottom",
  sideOffset = 4,
  ...props
}: DropdownMenuPrimitive.Popup.Props &
  Pick<
    DropdownMenuPrimitive.Positioner.Props,
    "align" | "alignOffset" | "collisionPadding" | "side" | "sideOffset"
  > & {
    onCloseAutoFocus?: (event: Event) => void;
  }) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        collisionPadding={collisionPadding}
        side={side}
        sideOffset={sideOffset}
      >
        <DropdownMenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-(--available-height) min-w-[8rem] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md",
            className
          )}
          finalFocus={onCloseAutoFocus ? false : finalFocus}
          {...props}
        />
      </DropdownMenuPrimitive.Positioner>
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuGroup({ ...props }: DropdownMenuPrimitive.Group.Props) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  );
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  children,
  asChild = false,
  render,
  nativeButton,
  onClick,
  sound,
  haptic,
  ...props
}: DropdownMenuPrimitive.Item.Props & {
  asChild?: boolean;
  haptic?: boolean;
  inset?: boolean;
  sound?: FeedbackType;
  variant?: "default" | "destructive";
}) {
  const play = useFeedback({ haptic, sound });

  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-inset:pl-8 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      nativeButton={nativeButton ?? (asChild ? false : undefined)}
      onClick={(event) => {
        play();
        onClick?.(event);
      }}
      render={
        asChild ? (React.Children.only(children) as React.ReactElement) : render
      }
      {...props}
    >
      {asChild ? undefined : children}
    </DropdownMenuPrimitive.Item>
  );
}

function DropdownMenuSub({
  ...props
}: DropdownMenuPrimitive.SubmenuRoot.Props) {
  return (
    <DropdownMenuPrimitive.SubmenuRoot
      data-slot="dropdown-menu-sub"
      {...props}
    />
  );
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  asChild = false,
  render,
  nativeButton,
  ...props
}: DropdownMenuPrimitive.SubmenuTrigger.Props & {
  asChild?: boolean;
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-popup-open:bg-accent data-popup-open:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-inset:pl-8",
        className
      )}
      nativeButton={nativeButton ?? (asChild ? false : undefined)}
      render={
        asChild ? (React.Children.only(children) as React.ReactElement) : render
      }
      {...props}
    >
      {asChild ? undefined : children}
      {asChild ? null : <ChevronRightIcon className="ml-auto size-4" />}
    </DropdownMenuPrimitive.SubmenuTrigger>
  );
}

type DropdownMenuSubContentProps = React.ComponentProps<
  typeof DropdownMenuContent
>;

function DropdownMenuSubContent({
  className,
  ...props
}: DropdownMenuSubContentProps) {
  return (
    <DropdownMenuContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "w-auto min-w-[8rem] overflow-hidden rounded-md p-1 shadow-lg",
        className
      )}
      side="right"
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
