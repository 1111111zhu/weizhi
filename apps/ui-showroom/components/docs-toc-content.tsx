"use client";

import { MenuIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type TocItem = {
  title?: React.ReactNode;
  url: string;
  depth: number;
};

export const DocsTocDropdown = ({
  toc,
  open,
  setOpen,
  handleClose,
  className,
}: {
  toc: TocItem[];
  open: boolean;
  setOpen: (open: boolean) => void;
  handleClose: () => void;
  className?: string;
}) => (
  <DropdownMenu open={open} onOpenChange={setOpen} sounds>
    <DropdownMenuTrigger asChild>
      <Button
        variant="outline"
        size="sm"
        className={cn("h-8 md:h-7", className)}
      >
        <MenuIcon /> On This Page
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="no-scrollbar max-h-[70svh]">
      {toc.map((item) => (
        <DropdownMenuItem
          key={item.url}
          asChild
          sound="click"
          onClick={handleClose}
          data-depth={item.depth}
          className="data-[depth=3]:pl-6 data-[depth=4]:pl-8"
        >
          <a href={item.url}>{item.title}</a>
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);

export const DocsTocList = ({
  toc,
  activeHeading,
  playTick,
  className,
}: {
  toc: TocItem[];
  activeHeading: string | null;
  playTick: () => void;
  className?: string;
}) => (
  <div className={cn("flex flex-col gap-2 p-4 pt-0 text-sm", className)}>
    <p className="sticky top-0 h-6 bg-background text-xs text-muted-foreground">
      On This Page
    </p>
    {toc.map((item) => (
      <a
        key={item.url}
        href={item.url}
        className="text-[0.8rem] text-muted-foreground no-underline transition-colors hover:text-foreground data-[active=true]:font-medium data-[active=true]:text-foreground data-[depth=3]:pl-4 data-[depth=4]:pl-6"
        data-active={item.url === `#${activeHeading}`}
        data-depth={item.depth}
        onClick={playTick}
      >
        {item.title}
      </a>
    ))}
  </div>
);
