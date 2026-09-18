"use client";

import { Menu, Search } from "lucide-react";
import { useState } from "react";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "./button";
import { CollectionState } from "./collection-state";
import { Link, List, ListItem } from "./content-primitives";
import { Drawer } from "./overlay-primitives";

export type ScrollAreaProps = ComponentProps<"div"> & {
  label: string;
  orientation?: "vertical" | "horizontal" | "both";
};
export function ScrollArea({
  label,
  orientation = "vertical",
  className = "",
  ...props
}: ScrollAreaProps) {
  const overflow = {
    vertical: "overflow-y-auto overflow-x-hidden",
    horizontal: "overflow-x-auto overflow-y-hidden",
    both: "overflow-auto",
  };
  return (
    <section
      {...props}
      aria-label={label}
      tabIndex={props.tabIndex ?? 0}
      className={`focus-visible:ring-ring min-h-0 min-w-0 overscroll-contain outline-none focus-visible:ring-2 ${overflow[orientation]} ${className}`}
    />
  );
}
export type NavigationItem = {
  id: string;
  label: string;
  href?: string;
  disabled?: boolean;
};
export type NavigationListProps = {
  label: string;
  items: readonly NavigationItem[];
  selectedId?: string;
  onSelect?: (id: string) => void;
};
export function NavigationList({
  label,
  items,
  selectedId,
  onSelect,
}: NavigationListProps) {
  return (
    <nav aria-label={label}>
      <List>
        {items.map((item) => (
          <ListItem key={item.id} className="py-0.5">
            {item.href ? (
              <Link
                href={item.href}
                disabled={item.disabled}
                aria-current={selectedId === item.id ? "page" : undefined}
                className="aria-[current=page]:bg-accent flex min-h-11 items-center rounded-md px-3"
                onClick={(event) => {
                  if (
                    onSelect &&
                    event.button === 0 &&
                    !event.ctrlKey &&
                    !event.metaKey &&
                    !event.shiftKey &&
                    !event.altKey
                  ) {
                    event.preventDefault();
                    onSelect(item.id);
                  }
                }}
              >
                {item.label}
              </Link>
            ) : (
              <Button
                type="button"
                variant={selectedId === item.id ? "secondary" : "quiet"}
                disabled={item.disabled || !onSelect}
                onClick={() => onSelect?.(item.id)}
                className="h-auto min-h-11 w-full justify-start text-left whitespace-normal"
              >
                {item.label}
              </Button>
            )}
          </ListItem>
        ))}
      </List>
    </nav>
  );
}
export type AppShellProps = {
  label: string;
  header?: ReactNode;
  navigationLabel: string;
  closeNavigationLabel: string;
  navigation: readonly NavigationItem[];
  currentId?: string;
  onNavigate: (id: string) => void;
  children: ReactNode;
  footer?: ReactNode;
};
export function AppShell({
  label,
  header,
  navigationLabel,
  closeNavigationLabel,
  navigation,
  currentId,
  onNavigate,
  children,
  footer,
}: AppShellProps) {
  const [open, setOpen] = useState(false);
  const select = (id: string) => {
    onNavigate(id);
    setOpen(false);
  };
  return (
    <div className="bg-background text-foreground flex min-h-svh min-w-0 flex-col">
      <header className="border-border flex min-w-0 items-center gap-3 border-b p-3">
        <Button
          type="button"
          variant="quiet"
          size="icon"
          aria-label={navigationLabel}
          onClick={() => setOpen(true)}
          className="md:hidden"
        >
          <Menu />
        </Button>
        <strong>{label}</strong>
        {header}
      </header>
      <div className="flex min-h-0 min-w-0 flex-1">
        <aside className="border-border hidden w-60 shrink-0 border-r p-3 md:block">
          <NavigationList
            label={navigationLabel}
            items={navigation}
            selectedId={currentId}
            onSelect={select}
          />
        </aside>
        <main className="min-w-0 flex-1 p-4">{children}</main>
      </div>
      {footer ? (
        <footer className="border-border border-t p-3">{footer}</footer>
      ) : null}
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title={navigationLabel}
        closeLabel={closeNavigationLabel}
        side="start"
      >
        <NavigationList
          label={navigationLabel}
          items={navigation}
          selectedId={currentId}
          onSelect={select}
        />
      </Drawer>
    </div>
  );
}
export type SearchResultsProps = {
  label: string;
  items: readonly NavigationItem[];
  onSelect?: (id: string) => void;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  locale?: "en-US" | "zh-CN";
};
export function SearchResults({
  label,
  items,
  onSelect,
  loading,
  error,
  onRetry,
  locale,
}: SearchResultsProps) {
  const handleRetry = () => onRetry?.();
  if (loading || error || !items.length) {
    return (
      <CollectionState
        locale={locale}
        kind={loading ? "loading" : error ? "error" : "filtered"}
        onRetry={onRetry ? handleRetry : undefined}
      />
    );
  }
  return (
    <section aria-label={label}>
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Search aria-hidden="true" className="size-4" />
        {label}
      </div>
      <NavigationList label={label} items={items} onSelect={onSelect} />
    </section>
  );
}
