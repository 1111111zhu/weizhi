"use client";

import * as React from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSidebar } from "@/components/ui/sidebar-context";
import { cn } from "@/lib/utils";

export const SIDEBAR_WIDTH_MOBILE = "18rem";

export type SidebarProps = React.ComponentProps<"div"> & {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
};

export const SidebarNone = ({
  side = "left",
  variant = "sidebar",
  className,
  children,
  ...props
}: SidebarProps) => (
  <div
    data-slot="sidebar"
    data-sidebar="sidebar"
    data-variant={variant}
    data-side={side}
    className={cn(
      "bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export const SidebarMobile = ({
  side = "left",
  className,
  children,
  ...props
}: SidebarProps) => {
  void className;
  const { openMobile, setOpenMobile } = useSidebar();

  return (
    <Sheet open={openMobile} onOpenChange={setOpenMobile} sounds>
      <SheetContent
        data-slot="sidebar"
        data-sidebar="sidebar"
        data-mobile="true"
        side={side}
        className="w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
        style={
          { "--sidebar-width": SIDEBAR_WIDTH_MOBILE } as React.CSSProperties
        }
        {...props}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Sidebar</SheetTitle>
          <SheetDescription>Displays the mobile sidebar.</SheetDescription>
        </SheetHeader>
        <div className="flex size-full flex-col">{children}</div>
      </SheetContent>
    </Sheet>
  );
};

type SidebarState = {
  state: "expanded" | "collapsed";
  openMobile: boolean;
  setOpenMobile: (open: boolean | ((open: boolean) => boolean)) => void;
};

const getSidebarSpacerClassName = (
  variant: "sidebar" | "floating" | "inset"
) => {
  const isFloatingVariant = variant === "floating" || variant === "inset";
  return cn(
    "relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",
    "group-data-[collapsible=offcanvas]:w-0",
    "group-data-[side=right]:rotate-180",
    isFloatingVariant &&
      "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+theme(spacing.4))]",
    !isFloatingVariant &&
      "group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
  );
};

const getSidebarPanelClassName = (
  side: "left" | "right",
  variant: "sidebar" | "floating" | "inset"
) => {
  const isFloatingVariant = variant === "floating" || variant === "inset";
  return cn(
    "fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex",
    side === "left"
      ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
      : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
    isFloatingVariant &&
      "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+theme(spacing.4)+2px)]",
    !isFloatingVariant &&
      "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
    side === "right" && variant === "sidebar" && "border-l"
  );
};

const SidebarDesktopPanel = ({
  side,
  variant,
  children,
}: {
  side: "left" | "right";
  variant: "sidebar" | "floating" | "inset";
  children: React.ReactNode;
}) => (
  <>
    <div className={getSidebarSpacerClassName(variant)} />
    <div className={getSidebarPanelClassName(side, variant)}>
      <div
        data-slot="sidebar-inner"
        data-sidebar="sidebar"
        className="flex size-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow-sm"
      >
        {children}
      </div>
    </div>
  </>
);

export const SidebarDesktop = ({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  state,
  className,
  children,
  ...props
}: SidebarProps & Pick<SidebarState, "state">) => (
  <div
    className={cn(
      "group peer hidden text-sidebar-foreground md:block",
      className
    )}
    data-state={state}
    data-collapsible={state === "collapsed" ? collapsible : ""}
    data-variant={variant}
    data-side={side}
    data-slot="sidebar"
    {...props}
  >
    <SidebarDesktopPanel side={side} variant={variant}>
      {children}
    </SidebarDesktopPanel>
  </div>
);
