"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "./button";
import { cn } from "./utils";
import { ViewSwitcher } from "./view-switcher";

const narrowSettingsQuery = "(width < 48rem)";
const getNarrowSettings = () => window.matchMedia(narrowSettingsQuery).matches;
const getServerNarrowSettings = () => false;
function subscribeNarrowSettings(listener: () => void) {
  const media = window.matchMedia(narrowSettingsQuery);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

/** Shared sizing classes for the EMP/CMP settings dialog content. */
export const SETTINGS_DIALOG_CONTENT_CLASS =
  "h-[80dvh] w-[80vw] max-h-[80dvh] max-w-[80vw] max-md:h-[calc(100dvh-1rem)] max-md:max-h-[calc(100dvh-1rem)] max-md:w-[calc(100vw-1rem)] max-md:max-w-[calc(100vw-1rem)] overflow-hidden rounded-[10px] border border-border bg-popover p-0 shadow-lg md:max-w-[80vw] [&>[data-slot=dialog-close]]:top-2 [&>[data-slot=dialog-close]]:right-2 [&>[data-slot=dialog-close]]:size-8 [&>[data-slot=dialog-close]]:rounded-[8px] [&>[data-slot=dialog-close]]:border-0 [&>[data-slot=dialog-close]]:p-0 [&>[data-slot=dialog-close]]:text-foreground [&>[data-slot=dialog-close]]:opacity-70 [&>[data-slot=dialog-close]]:hover:opacity-100";

/** Shared overlay classes for the EMP/CMP settings dialog. */
export const SETTINGS_DIALOG_OVERLAY_CLASS = "bg-black/50 backdrop-blur-none";

// Kept for consumers that still use the historical name from the EMP shell.
export const SIDEBAR_13_DIALOG_CONTENT_CLASS = SETTINGS_DIALOG_CONTENT_CLASS;
export const SIDEBAR_13_DIALOG_OVERLAY_CLASS = SETTINGS_DIALOG_OVERLAY_CLASS;

export type SettingsDialogNavigationItem<T extends string> = {
  id: T;
  icon: LucideIcon;
  label: string;
  badge?: ReactNode;
};

export type SettingsDialogShellProps<T extends string> = {
  activeId: T;
  breadcrumbRoot: string;
  children: ReactNode;
  /** Optional contextual controls beside the active section breadcrumb. */
  headerActions?: ReactNode;
  items: SettingsDialogNavigationItem<T>[];
  mainClassName?: string;
  navigationLabel: string;
  onActiveIdChange: (id: T) => void;
  /** Opt-in list/detail navigation at narrow widths; desktop sidebar is unchanged. */
  mobileNavigation?: "select" | "pages";
  /** Open a contextual destination immediately (e.g. an archive-review link). */
  mobileInitialDetail?: boolean;
  /** A changed request opens the active page even when returning to the same category. */
  mobileDetailRequestKey?: string | number;
  mobileBackLabel?: string;
};

/**
 * The shared two-pane settings layout used by EMP and CMP.
 *
 * Consumers own the surrounding Dialog and render this shell as its content.
 * The shell intentionally has no app-specific imports so it can be used by
 * either application (and by future settings surfaces).
 */
export function SettingsDialogShell<T extends string>({
  activeId,
  breadcrumbRoot,
  children,
  headerActions,
  items,
  mainClassName,
  navigationLabel,
  onActiveIdChange,
  mobileNavigation = "select",
  mobileInitialDetail = false,
  mobileDetailRequestKey,
  mobileBackLabel,
}: SettingsDialogShellProps<T>) {
  const activeItem = items.find((item) => item.id === activeId) ?? items[0];
  const activeLabel = activeItem?.label ?? breadcrumbRoot;
  const narrow = useSyncExternalStore(
    subscribeNarrowSettings,
    getNarrowSettings,
    getServerNarrowSettings
  );
  const mobilePages = mobileNavigation === "pages" && narrow;
  const [closedAt, setClosedAt] = useState<{
    id: T;
    requestKey?: string | number;
  } | null>(
    mobileInitialDetail
      ? null
      : { id: activeId, requestKey: mobileDetailRequestKey }
  );
  const detailOpen =
    closedAt === null ||
    closedAt.id !== activeId ||
    closedAt.requestKey !== mobileDetailRequestKey;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusPending = useRef(false);
  const selectPage = (id: T) => {
    onActiveIdChange(id);
    focusPending.current = true;
    setClosedAt(null);
  };
  useLayoutEffect(() => {
    if (!focusPending.current) {
      return;
    }
    focusPending.current = false;
    if (detailOpen) {
      headingRef.current?.focus();
    } else {
      menuRef.current
        ?.querySelector<HTMLButtonElement>('[aria-current="page"]')
        ?.focus();
    }
  }, [detailOpen]);

  return (
    <div
      data-mobile-navigation={mobileNavigation}
      className="pw-settings-shell bg-popover flex h-full max-h-full min-h-0 w-full max-w-full"
    >
      {mobilePages ? (
        <div
          ref={menuRef}
          data-slot="settings-mobile-index"
          className={cn(
            "min-h-0 w-full flex-col md:hidden",
            detailOpen ? "hidden" : "flex"
          )}
        >
          <header className="border-border shrink-0 border-b px-4 py-4 pr-14">
            <h2 className="font-semibold">{breadcrumbRoot}</h2>
          </header>
          <nav
            aria-label={navigationLabel}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"
          >
            <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
              {items.map((item) => (
                <li key={item.id}>
                  <Button
                    fullWidth
                    variant="quiet"
                    aria-current={item.id === activeId ? "page" : undefined}
                    className="min-h-14 justify-start rounded-none px-4 py-3 text-left whitespace-normal"
                    onClick={() => selectPage(item.id)}
                    iconStart={<item.icon />}
                    iconEnd={<ChevronRight />}
                  >
                    <span className="flex flex-1 items-center justify-between gap-2">
                      {item.label}
                      {item.badge}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      ) : null}
      {mobilePages ? null : (
        <aside
          aria-label={navigationLabel}
          className="border-border bg-muted/40 text-foreground hidden min-h-0 w-44 shrink-0 flex-col self-stretch overflow-y-auto border-r md:flex"
        >
          <div className="flex flex-1 flex-col">
            <div className="relative flex w-full min-w-0 flex-col p-2">
              <ul className="flex w-full min-w-0 flex-col gap-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.id === activeId;

                  return (
                    <li key={item.id} className="relative">
                      <Button
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex h-8 w-full items-center justify-start gap-2 overflow-hidden rounded-[8px] border-0 p-2 text-left text-sm font-normal text-foreground hover:bg-muted hover:text-foreground",
                          isActive &&
                            "bg-accent font-medium text-accent-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                        size="default"
                        type="button"
                        variant="ghost"
                        onClick={() => onActiveIdChange(item.id)}
                      >
                        <Icon data-icon="inline-start" />
                        <span title={item.label} className="truncate">
                          {item.label}
                        </span>
                        {item.badge === null ||
                        item.badge === undefined ? null : (
                          <span
                            data-slot="settings-navigation-badge"
                            className="ml-auto shrink-0"
                          >
                            {item.badge}
                          </span>
                        )}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </aside>
      )}

      <main
        className={cn(
          "flex h-full max-h-full min-h-0 min-w-0 flex-1 flex-col",
          mobilePages && !detailOpen && "hidden",
          mainClassName
        )}
      >
        <header className="border-border flex h-14 shrink-0 items-center gap-2 border-b px-4 pr-14">
          {mobilePages ? null : (
            <div className="hidden min-w-0 items-center gap-2 md:flex">
              <nav aria-label={navigationLabel}>
                <ol className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm wrap-break-word">
                  <li className="hidden items-center gap-1 md:inline-flex">
                    <span className="text-muted-foreground">
                      {breadcrumbRoot}
                    </span>
                  </li>
                  <li className="hidden items-center gap-1 md:inline-flex">
                    <ChevronRight
                      aria-hidden="true"
                      className="text-muted-foreground size-4"
                    />
                  </li>
                  <li>
                    <span aria-current="page" className="text-foreground">
                      {activeLabel}
                    </span>
                  </li>
                </ol>
              </nav>
            </div>
          )}
          {mobilePages ? (
            <div className="flex min-w-0 flex-1 items-center gap-2 md:hidden">
              <Button
                data-slot="settings-mobile-back"
                variant="quiet"
                aria-label={mobileBackLabel ?? breadcrumbRoot}
                className="min-h-12 min-w-12"
                onClick={() => {
                  focusPending.current = true;
                  setClosedAt({
                    id: activeId,
                    requestKey: mobileDetailRequestKey,
                  });
                }}
              >
                <ArrowLeft aria-hidden />
              </Button>
              <h2
                ref={headingRef}
                tabIndex={-1}
                className="min-w-0 font-semibold break-words outline-none"
              >
                {activeLabel}
              </h2>
            </div>
          ) : (
            <div className="min-w-0 flex-1 md:hidden">
              <ViewSwitcher
                label={navigationLabel}
                value={activeItem?.id ?? ""}
                options={items.map((item) => ({
                  value: item.id,
                  label: item.label,
                  icon: <item.icon className="size-4" />,
                }))}
                onValueChange={(value) => {
                  const next = items.find((item) => item.id === value);
                  if (next) {
                    onActiveIdChange(next.id);
                  }
                }}
              />
            </div>
          )}
          {headerActions ? (
            <div
              data-slot="settings-header-actions"
              className="ml-auto flex shrink-0 items-center gap-3"
            >
              {headerActions}
            </div>
          ) : null}
        </header>
        <section
          aria-label={activeLabel}
          data-slot="settings-scroll-content"
          className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 pb-6 [scrollbar-gutter:stable]"
        >
          {children}
        </section>
      </main>
    </div>
  );
}
