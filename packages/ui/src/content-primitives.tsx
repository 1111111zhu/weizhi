"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { ChevronRight, Info, LockKeyhole } from "lucide-react";
import { useId } from "react";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "./button";
import { CollectionState } from "./collection-state";
import type { CollectionStateProps } from "./collection-state";
import { cn } from "./utils";

export type LinkProps = ComponentProps<"a"> & { disabled?: boolean };
function safeNavigationHref(href?: string) {
  if (
    !href ||
    [...href].some(
      (character) =>
        (character.codePointAt(0) ?? 0) < 32 || character.codePointAt(0) === 127
    )
  ) {
    return;
  }
  try {
    const url = new URL(href, "https://navigation.invalid");
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol)
      ? href
      : undefined;
  } catch {
    // Malformed destinations are deliberately not navigable.
  }
}
export function Link({
  href,
  disabled,
  onClick,
  className,
  target,
  rel,
  children,
  ...props
}: LinkProps) {
  const destination = disabled ? undefined : safeNavigationHref(href);
  return (
    <a
      {...props}
      href={destination}
      target={target}
      rel={
        target === "_blank"
          ? [
              ...new Set(
                `${rel ?? ""} noopener noreferrer`.trim().split(/\s+/)
              ),
            ].join(" ")
          : rel
      }
      role={destination ? undefined : "link"}
      aria-disabled={!destination || undefined}
      tabIndex={destination ? props.tabIndex : -1}
      onClick={(event) => {
        if (!destination) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      className={cn(
        "text-primary underline-offset-4 outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
        className
      )}
    >
      {children}
    </a>
  );
}

export type BreadcrumbsProps = {
  label: string;
  items: readonly { id: string; label: string; href?: string }[];
};
export function Breadcrumbs({ label, items }: BreadcrumbsProps) {
  return (
    <nav aria-label={label}>
      <ol className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        {items.map((item, index) => (
          <li key={item.id} className="flex min-w-0 items-center gap-2">
            {index > 0 ? (
              <ChevronRight
                aria-hidden="true"
                className="text-muted-foreground size-4 shrink-0"
              />
            ) : null}
            {index === items.length - 1 ? (
              <span
                aria-current="page"
                className="text-foreground min-w-0 break-words"
              >
                {item.label}
              </span>
            ) : (
              <Link href={item.href}>{item.label}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export type ListProps = ComponentProps<"ul">;
export function List({ className, ...props }: ListProps) {
  return (
    <ul
      {...props}
      data-slot="list"
      className={cn(
        "m-0 min-w-0 list-none divide-y divide-border p-0",
        className
      )}
    />
  );
}
export type ListItemProps = ComponentProps<"li">;
export function ListItem({ className, ...props }: ListItemProps) {
  return (
    <li
      {...props}
      data-slot="list-item"
      className={cn("min-w-0 py-3 text-sm", className)}
    />
  );
}

export type AlertProps = {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  intent?: "info" | "success" | "warning" | "danger";
};
export function Alert({
  title,
  children,
  actions,
  intent = "info",
}: AlertProps) {
  const tones = {
    info: "border-border bg-muted text-foreground",
    success: "border-success/30 bg-success/10 text-foreground",
    warning: "border-warning/30 bg-warning/10 text-foreground",
    danger: "border-destructive/30 bg-destructive/10 text-foreground",
  };
  return (
    <div
      role={intent === "danger" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-lg border p-4", tones[intent])}
    >
      <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="grid min-w-0 flex-1 gap-2">
        <strong className="text-sm">{title}</strong>
        {children ? <div className="text-sm">{children}</div> : null}
        {actions}
      </div>
    </div>
  );
}

export type EmptyStateProps = Omit<CollectionStateProps, "kind">;
export function EmptyState(props: EmptyStateProps) {
  return <CollectionState {...props} kind="empty" />;
}
export function ErrorState(props: EmptyStateProps) {
  return <CollectionState {...props} kind="error" />;
}
export type PermissionDeniedProps = {
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
};
export function PermissionDenied({
  title,
  description,
  action,
}: PermissionDeniedProps) {
  const handleAction = action?.onClick;
  return (
    <section
      aria-label={title}
      className="grid justify-items-center gap-3 p-6 text-center"
    >
      <LockKeyhole
        aria-hidden="true"
        className="text-muted-foreground size-6"
      />
      <div role="alert">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>
      {action ? (
        <Button type="button" variant="outline" onClick={handleAction}>
          {action.label}
        </Button>
      ) : null}
    </section>
  );
}

export type TabsProps = {
  label: string;
  activation?: "manual" | "automatic";
  value: string;
  onValueChange: (value: string) => void;
  tabs: readonly {
    value: string;
    label: string;
    content: ReactNode;
    disabled?: boolean;
  }[];
};
export function Tabs({
  label,
  activation = "manual",
  value,
  onValueChange,
  tabs,
}: TabsProps) {
  return (
    <TabsPrimitive.Root
      value={value}
      onValueChange={(next) => {
        if (typeof next === "string") {
          onValueChange(next);
        }
      }}
      className="grid min-w-0 gap-4"
    >
      <TabsPrimitive.List
        activateOnFocus={activation === "automatic"}
        aria-label={label}
        className="bg-muted flex min-w-0 flex-wrap gap-1 rounded-lg p-1"
      >
        {tabs.map((tab) => (
          <TabsPrimitive.Tab
            key={tab.value}
            value={tab.value}
            disabled={tab.disabled}
            className="focus-visible:ring-ring data-active:bg-background min-h-11 rounded-md px-3 text-sm outline-none focus-visible:ring-2 data-active:shadow-sm data-disabled:opacity-50 md:min-h-8"
          >
            {tab.label}
          </TabsPrimitive.Tab>
        ))}
      </TabsPrimitive.List>
      {tabs.map((tab) => (
        <TabsPrimitive.Panel
          key={tab.value}
          value={tab.value}
          keepMounted
          className="focus-visible:ring-ring min-w-0 outline-none focus-visible:ring-2"
        >
          {tab.content}
        </TabsPrimitive.Panel>
      ))}
    </TabsPrimitive.Root>
  );
}

export type AccordionProps = {
  items: readonly {
    id: string;
    title: string;
    content: ReactNode;
    disabled?: boolean;
  }[];
  expanded: readonly string[];
  onExpandedChange: (expanded: string[]) => void;
};
export function Accordion({
  items,
  expanded,
  onExpandedChange,
}: AccordionProps) {
  const scope = useId();
  return (
    <div className="divide-border divide-y">
      {items.map((item) => (
        <section key={item.id}>
          <h3>
            <Button
              type="button"
              variant="quiet"
              disabled={item.disabled}
              aria-expanded={expanded.includes(item.id)}
              aria-controls={`${scope}-${item.id}-panel`}
              onClick={() =>
                onExpandedChange(
                  expanded.includes(item.id)
                    ? expanded.filter((id) => id !== item.id)
                    : [...expanded, item.id]
                )
              }
              className="h-auto min-h-11 w-full justify-between py-3 text-left whitespace-normal"
            >
              {item.title}
              <ChevronRight
                aria-hidden="true"
                className={cn(
                  "size-4 shrink-0",
                  expanded.includes(item.id) && "rotate-90"
                )}
              />
            </Button>
          </h3>
          <div
            id={`${scope}-${item.id}-panel`}
            hidden={!expanded.includes(item.id)}
            className="pb-4 text-sm"
          >
            {item.content}
          </div>
        </section>
      ))}
    </div>
  );
}
