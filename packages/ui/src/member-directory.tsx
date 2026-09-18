"use client";

import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createContext, use } from "react";
import type { ComponentProps, ReactNode } from "react";

import { Input } from "./input";
import { ProjectWingTopBarAvatar } from "./project-wing-top-bar-avatar";
import { cn } from "./utils";

export type MemberDirectoryLayout = "assignment" | "management";

const MEMBER_DIRECTORY_GRIDS: Record<MemberDirectoryLayout, string> = {
  assignment:
    "grid-cols-[minmax(16rem,1.8fr)_minmax(7rem,.75fr)_minmax(10rem,1fr)_minmax(7rem,.75fr)]",
  management: "grid-cols-[12.5rem_6.25rem_8rem_6.5rem_5.5rem_10.5rem]",
};
const MemberDirectoryLayoutContext =
  createContext<MemberDirectoryLayout | null>(null);

export function MemberDirectoryAvatar({ name }: { name: string }) {
  return (
    <AvatarPrimitive.Root
      aria-label={name}
      className="relative flex size-10 shrink-0 rounded-full bg-purple-100 text-purple-600 shadow-sm select-none"
      role="img"
    >
      <AvatarPrimitive.Fallback className="flex size-full items-center justify-center rounded-full bg-transparent text-[0.82rem] font-bold text-inherit">
        {getMemberInitials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export function MemberDirectoryCompactIdentity({
  label,
  name,
}: {
  label?: string;
  name: string;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <ProjectWingTopBarAvatar label={label ?? name} name={name} size="xs" />
      <span className="max-w-28 truncate text-[0.7rem] font-medium">
        {name}
      </span>
    </span>
  );
}

export function MemberDirectorySearch({
  ariaLabel,
  autoFocus,
  className,
  countLabel,
  placeholder,
  query,
  onQueryChange,
}: {
  ariaLabel: string;
  autoFocus?: boolean;
  className?: string;
  countLabel: string;
  placeholder?: string;
  query: string;
  onQueryChange: (query: string) => void;
}) {
  return (
    <div className={cn("relative mx-auto w-full max-w-sm", className)}>
      <Search
        aria-hidden="true"
        className="text-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2"
      />
      <Input
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        className="bg-card/80 shadow-foreground/5 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/25 h-8 rounded-full pr-20 pl-9 text-sm shadow-sm focus-visible:ring-2"
        placeholder={placeholder}
        role="searchbox"
        value={query}
        onChange={(event) => onQueryChange(event.currentTarget.value)}
      />
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs">
        {countLabel}
      </span>
    </div>
  );
}

/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- This named scroll region must be keyboard-focusable to expose offscreen columns. */
export function MemberDirectoryTable({
  children,
  headers,
  label,
  layout,
}: {
  children: ReactNode;
  headers: string[];
  label: string;
  layout: MemberDirectoryLayout;
}) {
  const gridClassName = MEMBER_DIRECTORY_GRIDS[layout];
  return (
    <MemberDirectoryLayoutContext value={layout}>
      <div
        className="focus-visible:ring-ring max-w-full min-w-0 overflow-x-auto rounded-md focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
        role="region"
        aria-label={label}
        tabIndex={0}
      >
        <div
          aria-label={label}
          className={cn(
            "text-sm",
            layout === "assignment" ? "min-w-[46rem]" : "min-w-[49.25rem]"
          )}
          role="table"
        >
          <div
            className={cn(
              "grid border-b border-border text-xs font-semibold text-muted-foreground",
              gridClassName
            )}
            role="row"
          >
            {headers.map((header) => (
              <div
                key={header}
                className="flex h-10 items-center px-2 font-medium"
                role="columnheader"
              >
                {header}
              </div>
            ))}
          </div>
          {children}
        </div>
      </div>
    </MemberDirectoryLayoutContext>
  );
}

/* oxlint-enable jsx-a11y/no-noninteractive-tabindex */
export function MemberDirectoryRow({
  children,
  className,
  ...props
}: ComponentProps<"div">) {
  const layout = use(MemberDirectoryLayoutContext);
  if (!layout) {
    throw new Error("MemberDirectoryRow requires MemberDirectoryTable");
  }
  return (
    <div
      className={cn(
        "grid min-h-16 items-center border-b border-border",
        MEMBER_DIRECTORY_GRIDS[layout],
        className
      )}
      role="row"
      {...props}
    >
      {children}
    </div>
  );
}

export function MemberDirectoryCell({
  children,
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn("px-2 text-foreground", className)}
      role="cell"
      {...props}
    >
      {children}
    </div>
  );
}

export function MemberDirectoryIdentity({
  avatar,
  email,
  name,
  nameAdornment,
}: {
  avatar: ReactNode;
  email: string;
  name: string;
  nameAdornment?: ReactNode;
}) {
  return (
    <MemberDirectoryCell className="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3 py-2">
      {avatar}
      <div className="grid min-w-0 gap-0.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0 truncate leading-tight font-medium">
            {name}
          </span>
          {nameAdornment}
        </div>
        <span className="text-muted-foreground truncate text-xs leading-tight">
          {email}
        </span>
      </div>
    </MemberDirectoryCell>
  );
}

export function MemberDirectoryAction({
  accessibleName,
  children,
  disabled,
  icon: Icon,
  onClick,
  variant = "outline",
}: {
  accessibleName: string;
  children: ReactNode;
  disabled?: boolean;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: "default" | "destructive" | "outline";
}) {
  return (
    <ButtonPrimitive
      aria-label={accessibleName}
      className={cn(
        "inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-[min(var(--radius-md),12px)] border px-2.5 text-[0.8rem] font-normal whitespace-nowrap transition-[background-color,border-color,color,box-shadow,opacity] duration-[var(--motion-fast)] ease-[var(--motion-ease)] outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        variant === "default" &&
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        variant === "outline" &&
          "border-input bg-transparent text-foreground hover:bg-muted",
        variant === "destructive" &&
          "border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20"
      )}
      data-slot="member-directory-action"
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      {Icon ? <Icon data-icon="inline-start" /> : null}
      {children}
    </ButtonPrimitive>
  );
}

function getMemberInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase();
}
