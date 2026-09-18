"use client";

import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { cn } from "../lib/utils";
import { SplitterRail } from "./splitter-rail";

type SidebarState = "expanded" | "collapsed";
type SidebarButtonProps = ComponentPropsWithoutRef<typeof Button>;

type SidebarContextValue = {
  state: SidebarState;
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleSidebar: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const context = useContext(SidebarContext);

  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return context;
}

export type SidebarProviderProps = ComponentPropsWithoutRef<"div"> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function SidebarProvider({
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  className,
  children,
  ...props
}: SidebarProviderProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (controlledOpen === undefined) {
        setUncontrolledOpen(nextOpen);
      }

      onOpenChange?.(nextOpen);
    },
    [controlledOpen, onOpenChange]
  );
  const value = useMemo<SidebarContextValue>(
    () => ({
      state: open ? "expanded" : "collapsed",
      open,
      setOpen,
      toggleSidebar: () => setOpen(!open),
    }),
    [open, setOpen]
  );

  return (
    <SidebarContext.Provider value={value}>
      <div
        data-slot="sidebar-wrapper"
        data-state={value.state}
        className={cn("flex min-h-0 w-full bg-workbench-panel", className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export type SidebarProps = ComponentPropsWithoutRef<"aside"> & {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
};

export const Sidebar = forwardRef<HTMLElement, SidebarProps>(
  (
    {
      className,
      side = "left",
      variant = "sidebar",
      collapsible = "none",
      ...props
    },
    ref
  ) => (
    <aside
      ref={ref}
      data-slot="sidebar"
      data-side={side}
      data-variant={variant}
      data-collapsible={collapsible}
      className={cn(
        "flex h-full min-h-0 w-full flex-col border-border bg-workbench-sidebar text-foreground",
        className
      )}
      {...props}
    />
  )
);
Sidebar.displayName = "Sidebar";

export const SidebarHeader = forwardRef<
  HTMLElement,
  ComponentPropsWithoutRef<"header">
>(({ className, ...props }, ref) => (
  <header
    ref={ref}
    data-slot="sidebar-header"
    className={cn("flex shrink-0 flex-col gap-3 p-3", className)}
    {...props}
  />
));
SidebarHeader.displayName = "SidebarHeader";

export const SidebarFooter = forwardRef<
  HTMLElement,
  ComponentPropsWithoutRef<"footer">
>(({ className, ...props }, ref) => (
  <footer
    ref={ref}
    data-slot="sidebar-footer"
    className={cn("flex shrink-0 flex-col gap-2 p-3", className)}
    {...props}
  />
));
SidebarFooter.displayName = "SidebarFooter";

export const SidebarContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="sidebar-content"
    className={cn("min-h-0 flex-1 overflow-auto px-2 py-2", className)}
    {...props}
  />
));
SidebarContent.displayName = "SidebarContent";

export const SidebarGroup = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="sidebar-group"
    className={cn("grid gap-2 py-1", className)}
    {...props}
  />
));
SidebarGroup.displayName = "SidebarGroup";

export const SidebarGroupLabel = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="sidebar-group-label"
    className={cn(
      "px-2 text-xs font-medium tracking-normal text-muted-foreground",
      className
    )}
    {...props}
  />
));
SidebarGroupLabel.displayName = "SidebarGroupLabel";

export const SidebarGroupAction = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="sidebar-group-action"
    className={className}
    {...props}
  />
));
SidebarGroupAction.displayName = "SidebarGroupAction";

export const SidebarGroupContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="sidebar-group-content"
    className={className}
    {...props}
  />
));
SidebarGroupContent.displayName = "SidebarGroupContent";

export const SidebarMenu = forwardRef<
  HTMLUListElement,
  ComponentPropsWithoutRef<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    data-slot="sidebar-menu"
    className={cn("m-0 list-none p-0", className)}
    {...props}
  />
));
SidebarMenu.displayName = "SidebarMenu";

export const SidebarMenuItem = forwardRef<
  HTMLLIElement,
  ComponentPropsWithoutRef<"li">
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    data-slot="sidebar-menu-item"
    className={cn("relative list-none", className)}
    {...props}
  />
));
SidebarMenuItem.displayName = "SidebarMenuItem";

export const SidebarMenuSub = forwardRef<
  HTMLUListElement,
  ComponentPropsWithoutRef<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    data-slot="sidebar-menu-sub"
    className={cn(
      "m-0 ml-4 list-none border-l border-border/70 pl-2",
      className
    )}
    {...props}
  />
));
SidebarMenuSub.displayName = "SidebarMenuSub";

export const SidebarMenuSubItem = forwardRef<
  HTMLLIElement,
  ComponentPropsWithoutRef<"li">
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    data-slot="sidebar-menu-sub-item"
    className={cn("list-none", className)}
    {...props}
  />
));
SidebarMenuSubItem.displayName = "SidebarMenuSubItem";

export const SidebarFooterAction = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="sidebar-footer-action"
    className={className}
    {...props}
  />
));
SidebarFooterAction.displayName = "SidebarFooterAction";

export const SidebarInset = forwardRef<
  HTMLElement,
  ComponentPropsWithoutRef<"main">
>(({ className, ...props }, ref) => (
  <main
    ref={ref}
    data-slot="sidebar-inset"
    className={cn("min-w-0 flex-1", className)}
    {...props}
  />
));
SidebarInset.displayName = "SidebarInset";

export const SidebarTrigger = forwardRef<HTMLButtonElement, SidebarButtonProps>(
  ({ className, type = "button", onClick, ...props }, ref) => {
    const { toggleSidebar } = useSidebar();

    return (
      <Button
        ref={ref}
        type={type}
        variant="ghost"
        size="icon-lg"
        data-slot="sidebar-trigger"
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-workbench-row-hover hover:text-foreground   focus-visible:outline-none",
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
);
SidebarTrigger.displayName = "SidebarTrigger";

type SidebarRailProps = Omit<
  ComponentPropsWithoutRef<typeof SplitterRail>,
  "expanded" | "label" | "onToggle"
> & {
  "aria-label"?: string;
};

export const SidebarRail = forwardRef<HTMLDivElement, SidebarRailProps>(
  ({ "aria-label": ariaLabel, className, hitAreaTestId, ...props }, ref) => {
    const { state, toggleSidebar } = useSidebar();
    const dataTestId = props["data-testid"];

    return (
      <SplitterRail
        ref={ref}
        className={cn(
          "absolute inset-y-0 z-10 hidden w-4 -translate-x-1/2 md:flex",
          className
        )}
        expanded={state === "expanded"}
        hitAreaTestId={
          hitAreaTestId ?? (dataTestId ? `${dataTestId}-hit-area` : undefined)
        }
        label={ariaLabel ?? "Toggle sidebar"}
        onToggle={toggleSidebar}
        {...props}
      />
    );
  }
);
SidebarRail.displayName = "SidebarRail";

const sidebarMenuButtonVariants = cva(
  "inline-flex w-full min-w-0 items-center text-left text-sm transition     focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "text-muted-foreground hover:bg-workbench-row-hover hover:text-foreground data-[active=true]:bg-workbench-active data-[active=true]:text-workbench-active-foreground  ",
        outline:
          "border border-border bg-background text-foreground hover:bg-workbench-row-hover data-[active=true]:bg-workbench-active  ",
        tree: "group rounded-md text-[13px] font-medium text-muted-foreground hover:bg-workbench-row-hover hover:text-foreground aria-expanded:bg-transparent aria-expanded:text-foreground data-[active=true]:bg-workbench-active data-[active=true]:text-workbench-active-foreground data-[active=true]:shadow-sm data-[active=true]:shadow-foreground/5",
      },
      size: {
        default: "h-8 px-2",
        sm: "h-7 px-2 text-xs",
        lg: "h-10 px-3",
        treeItem: "h-8 justify-start gap-2 px-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export type SidebarMenuButtonProps = Omit<
  SidebarButtonProps,
  "className" | "variant" | "size"
> &
  VariantProps<typeof sidebarMenuButtonVariants> & {
    className?: string;
    isActive?: boolean;
    tooltip?: ReactNode;
  };

export const SidebarMenuButton = forwardRef<
  HTMLButtonElement,
  SidebarMenuButtonProps
>(({ className, isActive = false, variant, size, tooltip, ...props }, ref) => (
  <Button
    ref={ref}
    variant="ghost"
    size="default"
    data-slot="sidebar-menu-button"
    data-active={isActive}
    tooltip={tooltip}
    className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
    {...props}
  />
));
SidebarMenuButton.displayName = "SidebarMenuButton";

export type SidebarMenuActionProps = Omit<
  SidebarButtonProps,
  "className" | "variant" | "size"
> & {
  className?: string;
};

export const SidebarMenuAction = forwardRef<
  HTMLButtonElement,
  SidebarMenuActionProps
>(({ className, type = "button", ...props }, ref) => (
  <Button
    ref={ref}
    type={type}
    variant="ghost"
    size="icon-xs"
    data-slot="sidebar-menu-action"
    className={cn(
      "absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition hover:bg-workbench-row-hover hover:text-foreground focus-visible:opacity-100   focus-visible:outline-none group-hover/menu-item:opacity-100",
      className
    )}
    {...props}
  />
));
SidebarMenuAction.displayName = "SidebarMenuAction";

export const SidebarMenuBadge = forwardRef<
  HTMLSpanElement,
  ComponentPropsWithoutRef<"span">
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    data-slot="sidebar-menu-badge"
    className={cn(
      "ml-auto rounded-md px-1.5 py-0.5 text-xs font-medium text-muted-foreground",
      className
    )}
    {...props}
  />
));
SidebarMenuBadge.displayName = "SidebarMenuBadge";

export type SidebarMenuSubButtonProps = SidebarMenuButtonProps;

export const SidebarMenuSubButton = forwardRef<
  HTMLButtonElement,
  SidebarMenuSubButtonProps
>(({ variant = "tree", size = "treeItem", ...props }, ref) => (
  <SidebarMenuButton
    ref={ref}
    variant={variant}
    size={size}
    data-slot="sidebar-menu-sub-button"
    {...props}
  />
));
SidebarMenuSubButton.displayName = "SidebarMenuSubButton";
