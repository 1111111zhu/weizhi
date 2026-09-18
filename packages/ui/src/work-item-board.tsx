"use client";

import {
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  Clock3,
  ClipboardList,
  FolderKanban,
  Search,
  X,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
} from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ComponentProps,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";

import { Button } from "./button";
import { RESIZE_GRIP_CLASS, RESIZE_RAIL_CLASS } from "./resize-handle";
import { cn } from "./utils";

const DEFAULT_DOCK_WIDTH = 488;
const MINIMUM_DOCK_WIDTH = 360;
const MAXIMUM_DOCK_WIDTH = 672;
const MINIMUM_WORKSPACE_WIDTH = 560;
const DEFAULT_DOCK_SPACING = {
  block: 12,
  inline: 12,
  workspaceInline: 12,
} as const;

export type WorkItemBoardItem = {
  id: string;
  ruleId: string;
  domain: "EMP" | "PROJECT" | "CMP" | "TMS" | "OPS";
  view: "PERSONAL" | "TEAM" | "OPS";
  category: string;
  state: "OPEN" | "WAITING" | "BLOCKED";
  severity: "ACTION_REQUIRED" | "WARNING" | "BLOCKER";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  title: string;
  description: string;
  subjectType: string;
  subjectId: string;
  reference: string | null;
  objectLabel: string | null;
  responsibleLabel: string;
  assignedTo: { id: string; name: string; email: string | null } | null;
  createdBy: { id: string; name: string; email: string | null } | null;
  dueAt: string | null;
  openedAt: string;
  updatedAt: string;
  project: { id: string; projectCode: string; name: string } | null;
  actionTarget: {
    app: "EMP" | "PROJECT" | "CMP" | "TMS" | "OPS";
    resourceType: string;
    resourceId: string | null;
    params: Record<string, string | number | boolean | null>;
  };
};

export type WorkItemBoardCategory = {
  category: string;
  label: string;
  total: number;
  blockers: number;
  earliestOpenedAt: string | null;
};

type Locale = "zh-CN" | "en-US";

export type WorkItemBoardSection = {
  id: string;
  label: string;
  items: WorkItemBoardItem[];
  isLoading?: boolean;
  hasError?: boolean;
  onRetry?: () => void;
};

export function ProjectWingWorkItemList({
  items,
  locale,
  onOpen,
  showAssignmentInline = false,
  className,
}: {
  items: WorkItemBoardItem[];
  locale: Locale;
  onOpen: (item: WorkItemBoardItem) => void;
  showAssignmentInline?: boolean;
  className?: string;
}) {
  const copy = boardCopy(locale);
  if (items.length === 0) {
    return (
      <div
        className={cn(
          "grid min-h-52 place-items-center rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center",
          className
        )}
      >
        <div>
          <ClipboardList className="text-muted-foreground mx-auto size-8" />
          <p className="text-foreground mt-3 text-sm font-semibold">
            {copy.empty}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {copy.emptyDescription}
          </p>
        </div>
      </div>
    );
  }
  const timelineGroups = groupWorkItemsByTimeline(items, locale);
  return (
    <div
      className={cn("grid gap-3", className)}
      data-slot="project-wing-work-item-timeline"
    >
      {timelineGroups.map((group) => (
        <section
          key={group.id}
          data-slot="project-wing-work-item-timeline-group"
        >
          <div className="text-muted-foreground flex items-center gap-2 px-1 text-[11px] font-medium">
            <span
              aria-hidden="true"
              className="bg-primary size-1.5 shrink-0 rounded-full"
            />
            <span>{group.label}</span>
            <span aria-hidden="true" className="bg-border h-px flex-1" />
          </div>
          <ol className="before:bg-border/70 relative mt-2 grid gap-2 pl-4 before:absolute before:top-0 before:bottom-0 before:left-[3px] before:w-px">
            {group.items.map((item) => (
              <li className="relative" key={item.id}>
                <WorkItemCard
                  item={item}
                  locale={locale}
                  onOpen={onOpen}
                  showAssignmentInline={showAssignmentInline}
                />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

export function ProjectWingWorkItemOverlay({
  open = true,
  ...props
}: ComponentProps<typeof WorkItemDockContent> & { open?: boolean }) {
  return (
    <AnimatePresence>
      {open ? <WorkItemDockContent key="work-item-dock" {...props} /> : null}
    </AnimatePresence>
  );
}

function WorkItemDockContent({
  title,
  onClose,
  children,
  resizeLabel,
  spacing = DEFAULT_DOCK_SPACING,
  className,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  resizeLabel?: string;
  spacing?: { block: number; inline: number; workspaceInline?: number };
  className?: string;
}) {
  const isPresent = useIsPresent();
  const reduce = useReducedMotion();
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const [dockWidth, setDockWidth] = useState(DEFAULT_DOCK_WIDTH);
  const [compact, setCompact] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const inlineSpacing = Math.max(0, spacing.inline);
  const blockSpacing = Math.max(0, spacing.block);
  const workspaceInlineSpacing = Math.max(
    0,
    spacing.workspaceInline ?? inlineSpacing
  );
  const reservedSpacing = Math.max(
    inlineSpacing,
    inlineSpacing * 2 - workspaceInlineSpacing
  );
  const openerRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!openerRef.current && document.activeElement instanceof HTMLElement) {
      openerRef.current = document.activeElement;
    }
    const dialog = dialogRef.current;
    const opener = openerRef.current;
    return () => {
      queueMicrotask(() => {
        if (!dialog?.isConnected && opener?.isConnected) {
          opener.focus({ preventScroll: true });
        }
      });
    };
  }, []);
  useLayoutEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const sync = () => setCompact(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || typeof dialog.showModal !== "function") {
      return;
    }
    if (compact) {
      if (!dialog.matches(":modal")) {
        if (dialog.open) {
          dialog.close();
        }
        dialog.showModal();
      }
    } else {
      if (dialog.matches(":modal")) {
        dialog.close();
      }
      if (!dialog.open) {
        dialog.show();
      }
    }
    return () => {
      if (dialog.matches(":modal")) {
        dialog.close();
      }
    };
  }, [compact]);
  const maximumDockWidth = useCallback(() => {
    const viewportWidth =
      typeof window === "undefined"
        ? DEFAULT_DOCK_WIDTH + MINIMUM_WORKSPACE_WIDTH + inlineSpacing * 2
        : window.innerWidth;
    return Math.max(
      MINIMUM_DOCK_WIDTH,
      Math.min(
        MAXIMUM_DOCK_WIDTH,
        viewportWidth - MINIMUM_WORKSPACE_WIDTH - inlineSpacing * 2
      )
    );
  }, [inlineSpacing]);
  const clampDockWidth = useCallback(
    (width: number) =>
      Math.min(maximumDockWidth(), Math.max(MINIMUM_DOCK_WIDTH, width)),
    [maximumDockWidth]
  );

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      "--project-wing-work-item-dock-reserved-width",
      `${compact || !entered || !isPresent ? 0 : dockWidth + reservedSpacing}px`
    );
  }, [compact, dockWidth, reservedSpacing, entered, isPresent]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    return () => {
      root.style.removeProperty("--project-wing-work-item-dock-reserved-width");
    };
  }, []);

  useEffect(() => {
    const handleWindowResize = () => {
      if (window.matchMedia("(max-width: 1023px)").matches) {
        return;
      }
      setDockWidth((width) => clampDockWidth(width));
    };
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, [clampDockWidth]);

  useEffect(
    () => () => {
      resizeCleanupRef.current?.();
    },
    []
  );

  const handleResizeStart = (event: ReactPointerEvent<HTMLInputElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    resizeCleanupRef.current?.();
    const { clientX: startX, currentTarget: target, pointerId } = event;
    const startWidth = dockWidth;
    let dragged = false;
    let resizing = false;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    target.setPointerCapture?.(pointerId);
    document.body.style.userSelect = "none";
    const holdTimer = window.setTimeout(() => {
      resizing = true;
      setIsResizing(true);
      document.body.style.cursor = "col-resize";
    }, 180);

    const handleMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) {
        return;
      }
      if (Math.abs(moveEvent.clientX - startX) > 4) {
        dragged = true;
      }
      if (!resizing) {
        return;
      }
      setDockWidth(clampDockWidth(startWidth + startX - moveEvent.clientX));
    };
    const finish = (finishEvent?: PointerEvent) => {
      if (finishEvent && finishEvent.pointerId !== pointerId) {
        return;
      }
      window.clearTimeout(holdTimer);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      window.removeEventListener("blur", handleBlur);
      if (target.hasPointerCapture?.(pointerId)) {
        target.releasePointerCapture?.(pointerId);
      }
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      setIsResizing(false);
      if (resizeCleanupRef.current === cleanup) {
        resizeCleanupRef.current = null;
      }
      if (finishEvent?.type === "pointerup" && !dragged && !resizing) {
        onClose();
      }
    };
    const handleBlur = () => finish();
    const cleanup = () => finish();
    resizeCleanupRef.current = cleanup;
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    window.addEventListener("blur", handleBlur);
  };
  const handleResizeKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    const step = event.shiftKey ? 32 : 12;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setDockWidth((width) => clampDockWidth(width + step));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setDockWidth((width) => clampDockWidth(width - step));
    }
  };
  const resolvedResizeLabel = resizeLabel ?? `${title} width`;

  return (
    <motion.dialog
      initial={{ x: reduce ? 0 : "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: reduce ? 0 : "100%", opacity: 0 }}
      transition={{
        duration: reduce ? 0.12 : 0.24,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      ref={dialogRef}
      open={compact ? undefined : true}
      aria-label={title}
      aria-modal={compact ? "true" : "false"}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      data-slot="project-wing-work-item-dock"
      data-resize-state={isResizing ? "dragging" : "idle"}
      className={cn(
        "fixed left-auto z-40 m-0 overflow-visible border-0 bg-transparent p-0 text-foreground",
        className
      )}
      style={{
        height: compact
          ? `calc(100dvh - ${blockSpacing * 2}px)`
          : `calc(100dvh - 3.5rem - ${blockSpacing * 2}px)`,
        right: inlineSpacing,
        top: compact ? blockSpacing : `calc(3.5rem + ${blockSpacing}px)`,
        width: compact ? `calc(100vw - ${inlineSpacing * 2}px)` : dockWidth,
      }}
    >
      <div
        hidden={compact}
        className={cn(
          RESIZE_RAIL_CLASS,
          "absolute inset-y-0 z-20 touch-none select-none",
          compact && "hidden"
        )}
        data-resize-state={isResizing ? "dragging" : "idle"}
        style={{ left: -inlineSpacing, width: inlineSpacing }}
      >
        <input
          aria-label={resolvedResizeLabel}
          aria-orientation="vertical"
          className="peer absolute -inset-x-1 inset-y-0 h-auto cursor-pointer touch-none appearance-none border-0 bg-transparent opacity-0 select-none focus-visible:outline-none data-[resize-state=dragging]:cursor-col-resize"
          data-resize-state={isResizing ? "dragging" : "idle"}
          data-slot="project-wing-work-item-dock-resize-handle"
          max={maximumDockWidth()}
          min={MINIMUM_DOCK_WIDTH}
          onChange={(event) =>
            setDockWidth(clampDockWidth(Number(event.currentTarget.value)))
          }
          onKeyDown={handleResizeKeyDown}
          onPointerDown={handleResizeStart}
          type="range"
          value={dockWidth}
        />
        <span
          aria-hidden="true"
          className={cn(
            RESIZE_GRIP_CLASS,
            "pointer-events-none z-10 h-12 w-1 shrink-0 peer-focus-visible:bg-primary"
          )}
          data-slot="project-wing-work-item-dock-resize-grip"
        />
      </div>
      <div
        className="border-border/70 bg-card shadow-foreground/5 h-full w-full overflow-hidden rounded-[12px] border shadow-sm"
        data-slot="project-wing-work-item-dock-surface"
      >
        {children}
      </div>
    </motion.dialog>
  );
}

export function ProjectWingPersonalWorkItemSidebar({
  title,
  sections,
  locale,
  onOpen,
  onClose,
  isLoading = false,
  hasError = false,
  onRetry,
  className,
}: {
  title: string;
  sections: WorkItemBoardSection[];
  locale: Locale;
  onOpen: (item: WorkItemBoardItem) => void;
  onClose: () => void;
  isLoading?: boolean;
  hasError?: boolean;
  onRetry?: () => void;
  className?: string;
}) {
  const copy = boardCopy(locale);
  const [selectedSectionId, setSelectedSectionId] = useState(
    sections[0]?.id ?? ""
  );
  const selectedSection =
    sections.find((section) => section.id === selectedSectionId) ?? sections[0];
  const total = sections.reduce(
    (count, section) => count + section.items.length,
    0
  );
  const selectedIsLoading = selectedSection?.isLoading ?? isLoading;
  const selectedHasError = selectedSection?.hasError ?? hasError;
  const selectedOnRetry = selectedSection?.onRetry ?? onRetry;

  return (
    <aside
      className={cn("flex h-full min-h-0 w-full flex-col bg-card", className)}
      aria-label={title}
    >
      <WorkItemSidebarHeader
        icon={<ClipboardList className="size-[26px]" />}
        title={title}
        subtitle={copy.personalCount(total)}
        closeLabel={copy.closePersonal}
        onClose={onClose}
      />

      {sections.length > 1 ? (
        <div
          className="border-border bg-muted/20 grid shrink-0 border-b p-2"
          style={{
            gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))`,
          }}
          role="tablist"
          aria-label={title}
        >
          {sections.map((section) => {
            const selected = section.id === selectedSection?.id;
            return (
              <button
                key={section.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={cn(
                  "inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded-md px-2 text-xs font-medium",
                  selected
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                )}
                onClick={() => setSelectedSectionId(section.id)}
              >
                <span className="truncate">{section.label}</span>
                <span className="border-border bg-muted/30 rounded-full border px-1.5 py-0.5 text-[10px] tabular-nums">
                  {section.items.length}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {selectedIsLoading || selectedHasError ? (
          <WorkItemPanelState
            hasError={selectedHasError}
            isLoading={selectedIsLoading}
            locale={locale}
            onRetry={selectedOnRetry}
          />
        ) : (
          <ProjectWingWorkItemList
            items={selectedSection?.items ?? []}
            locale={locale}
            onOpen={onOpen}
          />
        )}
      </div>
    </aside>
  );
}

export function ProjectWingProjectWorkItemSidebar({
  personalItems,
  teamItems,
  teamCategories,
  locale,
  onOpen,
  onClose,
  personalLoading = false,
  personalError = false,
  teamLoading = false,
  teamError = false,
  onRetry,
  className,
}: {
  personalItems: WorkItemBoardItem[];
  teamItems: WorkItemBoardItem[];
  teamCategories: WorkItemBoardCategory[];
  locale: Locale;
  onOpen: (item: WorkItemBoardItem) => void;
  onClose: () => void;
  personalLoading?: boolean;
  personalError?: boolean;
  teamLoading?: boolean;
  teamError?: boolean;
  onRetry?: () => void;
  className?: string;
}) {
  const copy = boardCopy(locale);
  const [view, setView] = useState<"personal" | "team">("personal");
  const uniqueCount = new Set(
    [...personalItems, ...teamItems].map((item) => item.id)
  ).size;

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[12px] border border-border/70 bg-card shadow-sm shadow-foreground/5",
        className
      )}
      aria-label={copy.projectTitle}
    >
      <WorkItemSidebarHeader
        icon={<FolderKanban className="size-[26px]" />}
        title={copy.projectTitle}
        subtitle={copy.summaryCount(uniqueCount)}
        closeLabel={copy.closeProject}
        onClose={onClose}
      />

      <div
        className="border-border bg-muted/20 grid shrink-0 grid-cols-2 gap-1 border-b p-2"
        role="tablist"
        aria-label={copy.projectTitle}
      >
        {(
          [
            ["personal", copy.projectPersonal, personalItems.length],
            ["team", copy.teamTitle, teamItems.length],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            className={cn(
              "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-xs font-medium",
              view === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
            )}
            onClick={() => setView(id)}
          >
            {label}
            <span className="border-border bg-muted/30 rounded-full border px-1.5 py-0.5 text-[10px] tabular-nums">
              {count}
            </span>
          </button>
        ))}
      </div>

      {view === "personal" ? (
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {personalLoading || personalError ? (
            <WorkItemPanelState
              hasError={personalError}
              isLoading={personalLoading}
              locale={locale}
              onRetry={onRetry}
            />
          ) : (
            <ProjectWingWorkItemList
              items={personalItems}
              locale={locale}
              onOpen={onOpen}
            />
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden">
          {teamLoading || teamError ? (
            <div className="h-full overflow-auto p-3">
              <WorkItemPanelState
                hasError={teamError}
                isLoading={teamLoading}
                locale={locale}
                onRetry={onRetry}
              />
            </div>
          ) : (
            <ProjectWingTeamWorkItemSidebar
              embedded
              items={teamItems}
              categories={teamCategories}
              locale={locale}
              onOpen={onOpen}
            />
          )}
        </div>
      )}
    </aside>
  );
}

export function ProjectWingTeamWorkItemSidebar({
  items,
  categories,
  locale,
  onOpen,
  onClose,
  embedded = false,
  className,
}: {
  items: WorkItemBoardItem[];
  categories: WorkItemBoardCategory[];
  locale: Locale;
  onOpen: (item: WorkItemBoardItem) => void;
  onClose?: () => void;
  embedded?: boolean;
  className?: string;
}) {
  const copy = boardCopy(locale);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return items.filter(
      (item) =>
        (!selectedCategory || item.category === selectedCategory) &&
        (!query ||
          [
            item.title,
            item.description,
            item.reference,
            item.objectLabel,
            item.responsibleLabel,
            item.assignedTo?.name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase()
            .includes(query))
    );
  }, [items, search, selectedCategory]);
  const selectedLabel = categories.find(
    (category) => category.category === selectedCategory
  )?.label;

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full flex-col bg-card",
        !embedded &&
          "overflow-hidden rounded-[12px] border border-border/70 shadow-sm shadow-foreground/5",
        className
      )}
      aria-label={copy.teamTitle}
    >
      {embedded ? null : (
        <header className="border-border flex h-14 shrink-0 items-center gap-2 border-b px-4">
          {selectedCategory ? (
            <button
              type="button"
              className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-8 items-center justify-center rounded-md"
              onClick={() => {
                setSelectedCategory(null);
                setSearch("");
              }}
              aria-label={copy.back}
            >
              <ArrowLeft className="size-4" />
            </button>
          ) : (
            <ClipboardList className="text-primary size-4" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-sm font-semibold">
              {selectedLabel ?? copy.teamTitle}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {selectedCategory
                ? copy.detailCount(filtered.length)
                : copy.summaryCount(items.length)}
            </p>
          </div>
          {embedded ? null : (
            <button
              type="button"
              className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-8 items-center justify-center rounded-md"
              onClick={onClose}
              aria-label={copy.close}
            >
              <X className="size-4" />
            </button>
          )}
        </header>
      )}

      {selectedCategory ? (
        <>
          <div className="border-border flex shrink-0 items-center gap-2 border-b p-3">
            {embedded ? (
              <button
                type="button"
                className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-md"
                onClick={() => {
                  setSelectedCategory(null);
                  setSearch("");
                }}
                aria-label={copy.back}
              >
                <ArrowLeft className="size-4" />
              </button>
            ) : null}
            <div className="relative min-w-0 flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="border-input bg-background focus:border-ring focus:ring-ring/20 h-9 w-full rounded-md border pr-3 pl-9 text-sm outline-none focus:ring-2"
                placeholder={copy.search}
                aria-label={copy.search}
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <ProjectWingWorkItemList
              items={filtered}
              locale={locale}
              onOpen={onOpen}
              showAssignmentInline
            />
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {categories.length > 0 ? (
            <div className="border-border overflow-hidden rounded-lg border">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="bg-muted/45 text-muted-foreground text-xs">
                  <tr>
                    <th className="px-3 py-2 font-medium">{copy.category}</th>
                    <th className="w-16 px-2 py-2 text-center font-medium">
                      {copy.open}
                    </th>
                    <th className="w-16 px-2 py-2 text-center font-medium">
                      {copy.blockers}
                    </th>
                    <th className="w-16 px-2 py-2 text-center font-medium">
                      {copy.action}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {categories.map((category) => (
                    <tr key={category.category} className="hover:bg-muted/25">
                      <td className="px-3 py-3">
                        <p className="text-foreground truncate font-medium">
                          {category.label}
                        </p>
                        {category.earliestOpenedAt ? (
                          <p className="text-muted-foreground mt-0.5 truncate text-xs">
                            {copy.earliest}{" "}
                            {formatDate(category.earliestOpenedAt, locale)}
                          </p>
                        ) : null}
                      </td>
                      <td className="text-foreground px-2 py-3 text-center tabular-nums">
                        {category.total}
                      </td>
                      <td className="px-2 py-3 text-center tabular-nums">
                        <span
                          className={
                            category.blockers > 0
                              ? "text-destructive font-semibold"
                              : "text-muted-foreground"
                          }
                        >
                          {category.blockers}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-center">
                        <button
                          type="button"
                          className="border-border bg-background text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary inline-flex size-8 items-center justify-center rounded-full border transition-colors"
                          onClick={() => setSelectedCategory(category.category)}
                          aria-label={copy.viewDetails}
                          title={copy.viewDetails}
                        >
                          <ChevronRight className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ProjectWingWorkItemList
              items={items}
              locale={locale}
              onOpen={onOpen}
              showAssignmentInline
            />
          )}
        </div>
      )}
    </aside>
  );
}

function WorkItemSidebarHeader({
  icon,
  title,
  subtitle,
  closeLabel,
  onClose,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <header className="border-border/60 bg-card flex h-14 shrink-0 items-center gap-3 border-b px-4">
      <span className="text-primary grid size-[26px] shrink-0 place-items-center">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-foreground truncate text-sm font-semibold tracking-[0.01em]">
          {title}
        </h2>
        <p className="text-muted-foreground mt-0.5 truncate text-[11px] leading-3.5 tabular-nums">
          {subtitle}
        </p>
      </div>
      <button
        type="button"
        className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-colors"
        onClick={onClose}
        aria-label={closeLabel}
      >
        <X className="size-4" />
      </button>
    </header>
  );
}

function WorkItemCard({
  item,
  locale,
  onOpen,
  showAssignmentInline,
}: {
  item: WorkItemBoardItem;
  locale: Locale;
  onOpen: (item: WorkItemBoardItem) => void;
  showAssignmentInline: boolean;
}) {
  const assignment =
    showAssignmentInline && item.assignedTo
      ? locale === "zh-CN"
        ? `（该问题已被分配给 ${item.assignedTo.name}）`
        : ` (this question is assigned to ${item.assignedTo.name})`
      : "";
  const content = appendBeforeSentenceEnd(item.title, assignment, locale);
  const detail = workItemDetail(item);
  const actionLabel = workItemActionLabel(item, locale);
  return (
    <article className="border-border/60 bg-card hover:border-primary/30 group overflow-hidden rounded-lg border transition-colors">
      <div className="min-w-0 px-3.5 py-3">
        <p className="text-foreground line-clamp-4 text-sm leading-6 font-normal">
          {content}
        </p>
        {detail ? (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-5">
            {detail}
          </p>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-3 px-3.5 pb-3">
        <time className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
          <Clock3 aria-hidden="true" className="size-3 shrink-0" />
          {formatDate(item.updatedAt, locale)}
        </time>
        {item.actionTarget.params.unavailable === true ? (
          <span className="text-muted-foreground text-xs">
            {locale === "zh-CN" ? "关联文件已删除" : "Related file deleted"}
          </span>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpen(item)}
            aria-label={`${actionLabel}${locale === "zh-CN" ? "：" : ": "}${item.title}`}
          >
            {actionLabel}
            <ArrowUpRight className="size-3.5" />
          </Button>
        )}
      </div>
    </article>
  );
}

function WorkItemPanelState({
  isLoading,
  hasError,
  locale,
  onRetry,
}: {
  isLoading: boolean;
  hasError: boolean;
  locale: Locale;
  onRetry?: () => void;
}) {
  const copy = boardCopy(locale);
  return (
    <div className="border-border bg-muted/20 grid min-h-52 place-items-center rounded-xl border border-dashed p-6 text-center">
      <div>
        <ClipboardList className="text-muted-foreground mx-auto size-7" />
        <p className="text-muted-foreground mt-3 text-sm">
          {isLoading ? copy.loading : copy.loadError}
        </p>
        {hasError && onRetry ? (
          <button
            type="button"
            className="border-border bg-background text-foreground hover:bg-muted mt-3 inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium"
            onClick={onRetry}
          >
            {copy.retry}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function boardCopy(locale: Locale) {
  const zh = locale === "zh-CN";
  return {
    teamTitle: zh ? "团队待办" : "Team work items",
    projectTitle: zh ? "项目待办" : "Project work items",
    projectPersonal: zh ? "我的待办" : "My work items",
    back: zh ? "返回统计" : "Back to summary",
    close: zh ? "关闭团队待办" : "Close team work items",
    closePersonal: zh ? "关闭待办" : "Close work items",
    closeProject: zh ? "关闭项目待办" : "Close project work items",
    empty: zh ? "当前没有待办" : "No active work items",
    emptyDescription: zh
      ? "业务状态恢复正常后，事项会自动从这里消失。"
      : "Items disappear automatically when business state returns to normal.",
    search: zh
      ? "搜索事项、编号、文件或人员"
      : "Search items, references, files, or people",
    category: zh ? "大类" : "Category",
    open: zh ? "未解决" : "Open",
    blockers: zh ? "阻断" : "Blockers",
    action: zh ? "操作" : "Action",
    earliest: zh ? "最早" : "Earliest",
    viewDetails: zh ? "查看详情" : "View details",
    loading: zh ? "正在加载待办…" : "Loading work items…",
    loadError: zh ? "待办加载失败，请重试。" : "Unable to load work items.",
    retry: zh ? "重试" : "Retry",
    timelineToday: zh ? "今天" : "Today",
    timelineYesterday: zh ? "昨天" : "Yesterday",
    timelineLastSevenDays: zh ? "近 7 天" : "Last 7 days",
    timelineEarlier: zh ? "更早" : "Earlier",
    summaryCount: (count: number) =>
      zh ? `${count} 项未解决` : `${count} unresolved`,
    detailCount: (count: number) =>
      zh ? `${count} 项活动事项` : `${count} active items`,
    personalCount: (count: number) =>
      zh ? `${count} 项需要处理` : `${count} items require attention`,
  };
}

export function workItemDetail(item: WorkItemBoardItem) {
  const description = item.description.trim();
  if (!description) {
    return null;
  }
  const redundantValues = [
    item.title,
    item.objectLabel ?? "",
    item.reference ?? "",
  ].map((value) => value.trim());
  return redundantValues.includes(description) ? null : description;
}

export function workItemActionLabel(item: WorkItemBoardItem, locale: Locale) {
  const zh = locale === "zh-CN";
  const labels: Record<string, readonly [string, string]> = {
    "CMP-001": ["继续填写", "Continue editing"],
    "CMP-002": ["复核并提交", "Review and submit"],
    "CMP-003": ["去审批", "Review request"],
    "CMP-004": ["去审批", "Review request"],
    "CMP-005": ["去审批", "Review request"],
    "CMP-006": ["去修改", "Revise request"],
    "CMP-007": ["继续归档", "Continue archive"],
    "CMP-008": ["去审批", "Review archive"],
    "CMP-009": ["去修改", "Revise archive"],
    "CMP-010": ["去审批", "Review billing"],
    "CMP-011": ["去修改", "Revise billing"],
    "CMP-012": ["去发送", "Send billing"],
    "CMP-013": ["去跟进", "Follow up"],
    "CMP-014": ["去核销", "Reconcile"],
    "CMP-015": ["去核对", "Review evidence"],
    "CMP-017": ["更新汇率", "Update rates"],
    "EMP-001": ["去完成", "Complete declaration"],
    "EMP-002": ["处理邀请", "Respond"],
    "EMP-003": ["去确认", "Confirm declaration"],
    "EMP-006": ["去创建", "Create project"],
    "EMP-009": ["去审核", "Review archive"],
    "EMP-011": ["查看并重试", "Review and retry"],
    "EMP-012": ["查看并重试", "Review and retry"],
    "TMS-001": ["去填报", "Enter time"],
    "TMS-003": ["去修改", "Revise timesheet"],
    "TMS-004": ["去补充", "Complete timesheet"],
    "TMS-005": ["去审批", "Review timesheet"],
    "TMS-006": ["去确认", "Confirm timesheet"],
    "TMS-007": ["去关联", "Link project"],
    "TMS-009": ["去创建", "Create project"],
  };
  const label = labels[item.ruleId];
  if (label) {
    return zh ? label[0] : label[1];
  }
  if (item.domain === "OPS") {
    return zh ? "查看详情" : "View details";
  }
  return zh ? "查看并处理" : "Open item";
}

export function groupWorkItemsByTimeline(
  items: WorkItemBoardItem[],
  locale: Locale,
  now = new Date()
) {
  const copy = boardCopy(locale);
  const currentDay = localDayNumber(now);
  const groups: {
    id: string;
    label: string;
    items: WorkItemBoardItem[];
  }[] = [
    { id: "today", label: copy.timelineToday, items: [] },
    { id: "yesterday", label: copy.timelineYesterday, items: [] },
    {
      id: "last-seven-days",
      label: copy.timelineLastSevenDays,
      items: [],
    },
    { id: "earlier", label: copy.timelineEarlier, items: [] },
  ];

  for (const item of [...items].sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
  )) {
    const updatedAt = new Date(item.updatedAt);
    const ageInDays = Number.isFinite(updatedAt.getTime())
      ? currentDay - localDayNumber(updatedAt)
      : Number.POSITIVE_INFINITY;
    const groupIndex =
      ageInDays <= 0 ? 0 : ageInDays === 1 ? 1 : ageInDays <= 7 ? 2 : 3;
    groups[groupIndex]?.items.push(item);
  }

  return groups.filter((group) => group.items.length > 0);
}

function localDayNumber(value: Date) {
  return (
    Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) /
    86_400_000
  );
}

function formatDate(value: string, locale: Locale) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(locale, {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
    : value;
}

export function appendBeforeSentenceEnd(
  sentence: string,
  suffix: string,
  locale: Locale
) {
  if (!suffix) {
    return sentence;
  }
  const punctuation = locale === "zh-CN" ? /[。！？]$/ : /[.!?]$/;
  const match = sentence.match(punctuation);
  return match
    ? `${sentence.slice(0, -1)}${suffix}${match[0]}`
    : `${sentence}${suffix}`;
}
