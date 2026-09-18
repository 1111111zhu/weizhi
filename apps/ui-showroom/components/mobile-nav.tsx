"use client";

import type { Root as PageTreeRoot } from "fumadocs-core/page-tree";
import { useState } from "react";
import type { ComponentProps } from "react";

import { MobileNavContent } from "@/components/mobile-nav-content";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MobileNavTrigger = ({
  open,
  className,
  ...props
}: ComponentProps<typeof Button> & {
  open: boolean;
}) => (
  <Button
    className={cn(
      "extend-touch-target h-8 touch-manipulation items-center justify-start gap-2.5 !p-0 hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 active:bg-transparent dark:hover:bg-transparent",
      className
    )}
    variant="ghost"
    {...props}
  >
    <div className="relative flex h-8 w-4 items-center justify-center">
      <div className="relative size-4">
        <span
          className={cn(
            "bg-foreground absolute left-0 block h-0.5 w-4 transition-all duration-100",
            open ? "top-[0.4rem] -rotate-45" : "top-1"
          )}
        />
        <span
          className={cn(
            "bg-foreground absolute left-0 block h-0.5 w-4 transition-all duration-100",
            open ? "top-[0.4rem] rotate-45" : "top-2.5"
          )}
        />
      </div>
      <span className="sr-only">Toggle Menu</span>
    </div>
    <span className="flex h-8 items-center text-lg leading-none font-medium">
      Menu
    </span>
  </Button>
);

export const MobileNav = ({
  items,
  tree,
  className,
}: {
  items: { href: string; label: string }[];
  tree: PageTreeRoot;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover sounds open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild nativeButton>
        <MobileNavTrigger open={open} className={className} />
      </PopoverTrigger>
      <PopoverContent
        className="no-scrollbar h-(--radix-popper-available-height) w-(--radix-popper-available-width) overflow-y-auto rounded-none border-none bg-background/90 p-0 shadow-none backdrop-blur duration-100"
        align="start"
        side="bottom"
        alignOffset={-16}
        sideOffset={14}
      >
        <MobileNavContent items={items} tree={tree} setOpen={setOpen} />
      </PopoverContent>
    </Popover>
  );
};
