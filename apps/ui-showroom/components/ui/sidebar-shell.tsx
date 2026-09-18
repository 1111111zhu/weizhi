"use client";

import { PanelLeftIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar-context";
import {
  SidebarDesktop,
  SidebarMobile,
  SidebarNone,
} from "@/components/ui/sidebar-shell-layout";
import type { SidebarProps } from "@/components/ui/sidebar-shell-layout";
import { cn } from "@/lib/utils";

function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  ...props
}: SidebarProps) {
  const { isMobile, state } = useSidebar();

  if (collapsible === "none") {
    return (
      <SidebarNone {...{ side, variant, className, children }} {...props} />
    );
  }

  if (isMobile) {
    return <SidebarMobile {...{ side, className, children }} {...props} />;
  }

  return (
    <SidebarDesktop
      {...{ side, variant, collapsible, className, children, state }}
      {...props}
    />
  );
}

function SidebarTrigger({
  className,
  onClick,
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon"
      className={cn("size-7", className)}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      {children ?? <PanelLeftIcon />}
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
}

function SidebarRail({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      data-slot="sidebar-rail"
      data-sidebar="rail"
      variant="ghost"
      size="icon-sm"
      aria-label="Toggle Sidebar"
      className={cn(
        "hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all after:absolute after:inset-y-0 after:left-1/2 after:w-px md:flex",
        "in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
        "group-data-[side=left]:-right-4 group-data-[side=right]:left-0",
        "group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full group-data-[collapsible=offcanvas]:hover:bg-sidebar",
        className
      )}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    />
  );
}

export { Sidebar, SidebarRail, SidebarTrigger };
