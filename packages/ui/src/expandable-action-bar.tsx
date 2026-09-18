"use client";

import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { FocusEvent, MouseEvent, ReactElement, ReactNode } from "react";

function cn(...values: (string | false | null | undefined)[]) {
  return values.filter(Boolean).join(" ");
}

function pointIsInside(element: HTMLElement, clientX: number, clientY: number) {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
}

export type ExpandableActionBarSize = "sm" | "md";

export type ExpandableActionBarItem = {
  id: string;
  label: ReactNode;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  tapAnimation?: boolean;
  badge?: ReactNode;
  shortcut?: ReactNode;
  wrap?: (button: ReactElement) => ReactNode;
};

export type ExpandableActionBarClassNames = {
  root?: string;
  track?: string;
  item?: string;
  activeItem?: string;
  icon?: string;
  label?: string;
  badge?: string;
  shortcut?: string;
};

export interface ExpandableActionBarProps {
  items: ExpandableActionBarItem[];
  label?: string;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  activeId?: string;
  selectOnAction?: boolean;
  onAction?: (item: ExpandableActionBarItem) => void;
  size?: ExpandableActionBarSize;
  expandOnHover?: boolean;
  expandOnFocus?: boolean;
  collapseDelay?: number;
  disableMotion?: boolean;
  className?: string;
  classNames?: ExpandableActionBarClassNames;
  testId?: string | null;
}

export const ACTION_BAR_TRANSITION: Transition = {
  type: "tween",
  duration: 0.2,
  ease: [0.16, 1, 0.3, 1],
};
export const REDUCED_ACTION_BAR_TRANSITION: Transition = {
  type: "tween",
  duration: 0.12,
  ease: [0.16, 1, 0.3, 1],
};
const POSITION_TRANSITION: Transition = {
  type: "tween",
  duration: 0.28,
  ease: [0.25, 0.1, 0.25, 1],
};

export function getActionBarLabelAnimation(
  isExpanded: boolean,
  reduce: boolean
) {
  return {
    width: isExpanded ? "auto" : 0,
    opacity: isExpanded ? 1 : 0,
    x: reduce || isExpanded ? 0 : -4,
    marginLeft: isExpanded ? 8 : 0,
    filter: reduce || isExpanded ? "blur(0px)" : "blur(3px)",
  };
}

function useActionBarReducedMotion() {
  const reduce = useReducedMotion();
  return useSyncExternalStore(
    () => () => {},
    () => reduce === true,
    () => false
  );
}

export function actionBarTapAnimation(
  reduce: boolean | null,
  disabled: boolean,
  enabled = true
) {
  return disabled || !enabled ? undefined : { scale: reduce ? 1 : 0.96 };
}
const SIZE_CLASS = {
  sm: "h-8 gap-0.5 p-0.5 text-xs",
  md: "min-h-11 gap-1.5 p-1.5 text-sm",
} satisfies Record<ExpandableActionBarSize, string>;
const ITEM_SIZE_CLASS = {
  sm: "h-6 min-w-6 px-1.5",
  md: "h-8 min-w-8 px-2",
} satisfies Record<ExpandableActionBarSize, string>;
const ICON_SIZE_CLASS = {
  sm: "size-3.5",
  md: "size-4",
} satisfies Record<ExpandableActionBarSize, string>;

function useControllableExpanded({
  expanded,
  defaultExpanded,
  onExpandedChange,
}: {
  expanded?: boolean;
  defaultExpanded: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isControlled = expanded !== undefined;
  const value = expanded ?? internalExpanded;
  const setValue = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setInternalExpanded(next);
      }
      onExpandedChange?.(next);
    },
    [isControlled, onExpandedChange]
  );

  return [value, setValue] as const;
}

export function ExpandableActionBar({
  items,
  label = "Actions",
  expanded,
  defaultExpanded = false,
  onExpandedChange,
  activeId,
  selectOnAction = false,
  onAction,
  size = "md",
  expandOnHover = true,
  expandOnFocus = true,
  collapseDelay = 90,
  disableMotion = false,
  className,
  classNames,
  testId = "expandable-action-bar",
}: ExpandableActionBarProps) {
  const reduce = useActionBarReducedMotion();
  const layoutId = useId();
  const [isExpanded, setIsExpanded] = useControllableExpanded({
    expanded,
    defaultExpanded,
    onExpandedChange,
  });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pendingActive, setPendingActive] = useState<{
    baseId: string | undefined;
    id: string;
  } | null>(null);
  const collapseTimer = useRef<number | null>(null);
  const hovering = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stopPointerTracking = useRef<(() => void) | null>(null);
  const clearCollapseTimer = useCallback(() => {
    if (collapseTimer.current) {
      window.clearTimeout(collapseTimer.current);
    }
    collapseTimer.current = null;
  }, []);
  const open = useCallback(() => {
    clearCollapseTimer();
    setIsExpanded(true);
  }, [clearCollapseTimer, setIsExpanded]);
  const close = useCallback(() => {
    clearCollapseTimer();
    collapseTimer.current = window.setTimeout(() => {
      setIsExpanded(false);
      setHoveredId(null);
    }, collapseDelay);
  }, [clearCollapseTimer, collapseDelay, setIsExpanded]);
  const finishPointerTracking = useCallback(() => {
    stopPointerTracking.current?.();
    hovering.current = false;
    setHoveredId(null);
    if (expandOnHover) {
      close();
    }
  }, [close, expandOnHover]);
  const trackPointerUntilLeave = useCallback(() => {
    stopPointerTracking.current?.();
    const handlePointerMove = (event: PointerEvent) => {
      const root = rootRef.current;
      if (root && pointIsInside(root, event.clientX, event.clientY)) {
        return;
      }
      finishPointerTracking();
    };
    const handlePointerOut = (event: PointerEvent) => {
      if (event.relatedTarget === null) {
        finishPointerTracking();
      }
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerout", handlePointerOut);
    stopPointerTracking.current = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerout", handlePointerOut);
      stopPointerTracking.current = null;
    };
  }, [finishPointerTracking]);

  useEffect(
    () => () => {
      clearCollapseTimer();
      stopPointerTracking.current?.();
    },
    [clearCollapseTimer]
  );

  const resolvedActiveId = activeId ?? items.find((item) => item.active)?.id;
  const activeItemId =
    pendingActive !== null && pendingActive.baseId === resolvedActiveId
      ? pendingActive.id
      : resolvedActiveId;
  const highlightId = hoveredId ?? activeItemId;

  return (
    <LayoutGroup id={layoutId}>
      <motion.div
        ref={rootRef}
        onMouseEnter={() => {
          hovering.current = true;
          trackPointerUntilLeave();
          if (expandOnHover) {
            open();
          }
        }}
        onMouseLeave={() => {
          hovering.current = false;
          setHoveredId(null);
        }}
        onFocus={() => {
          if (expandOnFocus) {
            open();
          }
        }}
        onBlur={(event: FocusEvent<HTMLDivElement>) => {
          if (
            !event.currentTarget.contains(event.relatedTarget as Node) &&
            expandOnFocus &&
            !(expandOnHover && hovering.current)
          ) {
            close();
          }
        }}
        layout={disableMotion ? false : "position"}
        transition={
          disableMotion || reduce ? { duration: 0 } : POSITION_TRANSITION
        }
        className={cn("inline-flex", classNames?.root, className)}
        role="toolbar"
        aria-label={label}
        data-slot="expandable-action-bar"
        data-testid={testId ?? undefined}
        data-expanded={isExpanded}
        data-motion={disableMotion ? "none" : "animated"}
        data-size={size}
      >
        <motion.div
          layout={disableMotion ? false : "position"}
          className={cn(
            "relative inline-flex items-center overflow-hidden rounded-full border border-border/70 bg-card/80 shadow-none backdrop-blur",
            SIZE_CLASS[size],
            classNames?.track
          )}
          transition={
            disableMotion || reduce ? { duration: 0 } : POSITION_TRANSITION
          }
          data-slot="expandable-action-bar-track"
        >
          {items.map((item) => {
            const isActive = activeItemId === item.id;
            const isHighlighted = highlightId === item.id;
            const itemLabel =
              typeof item.label === "string" ? item.label : undefined;
            const button = (
              <motion.button
                key={item.id}
                layout={disableMotion ? false : "position"}
                type="button"
                disabled={item.disabled}
                aria-label={itemLabel}
                onMouseEnter={() => {
                  clearCollapseTimer();
                  setHoveredId(item.id);
                }}
                onMouseLeave={() => {
                  setHoveredId((current) =>
                    current === item.id ? null : current
                  );
                }}
                onClick={(event: MouseEvent<HTMLButtonElement>) => {
                  if (selectOnAction && !isActive) {
                    setPendingActive({ id: item.id, baseId: resolvedActiveId });
                  }
                  setHoveredId(null);
                  event.currentTarget.blur();
                  item.onClick?.();
                  onAction?.(item);
                }}
                whileTap={
                  disableMotion
                    ? undefined
                    : actionBarTapAnimation(
                        reduce,
                        Boolean(item.disabled),
                        item.tapAnimation !== false
                      )
                }
                transition={
                  disableMotion || reduce
                    ? { duration: 0 }
                    : POSITION_TRANSITION
                }
                className={cn(
                  "relative isolate inline-flex items-center justify-center rounded-full font-medium text-muted-foreground outline-none transition-[color,background-color] duration-150 ease-out",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:text-foreground disabled:pointer-events-none disabled:opacity-40",
                  isHighlighted && "text-foreground",
                  ITEM_SIZE_CLASS[size],
                  classNames?.item,
                  isActive && classNames?.activeItem
                )}
                data-slot="expandable-action-bar-item"
                data-action-id={item.id}
                data-active={isActive || undefined}
              >
                {isActive ? (
                  <motion.span
                    layoutId={
                      disableMotion ? undefined : "action-bar-highlight"
                    }
                    className="bg-primary/7 pointer-events-none absolute inset-0 -z-10 rounded-full"
                    transition={
                      disableMotion || reduce
                        ? { duration: 0 }
                        : POSITION_TRANSITION
                    }
                    data-slot="expandable-action-bar-highlight"
                  />
                ) : null}
                {isHighlighted && !isActive ? (
                  <span
                    className="bg-muted/60 absolute inset-0 -z-10 rounded-full"
                    data-slot="expandable-action-bar-highlight"
                  />
                ) : null}
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center justify-center",
                    ICON_SIZE_CLASS[size],
                    classNames?.icon
                  )}
                  data-slot="expandable-action-bar-icon"
                >
                  {item.icon}
                </span>
                <motion.span
                  aria-hidden={!isExpanded}
                  initial={false}
                  animate={getActionBarLabelAnimation(isExpanded, reduce)}
                  transition={
                    disableMotion
                      ? { duration: 0 }
                      : reduce
                        ? REDUCED_ACTION_BAR_TRANSITION
                        : ACTION_BAR_TRANSITION
                  }
                  className={cn(
                    "inline-block overflow-hidden whitespace-nowrap",
                    classNames?.label
                  )}
                  data-slot="expandable-action-bar-label"
                >
                  {item.label}
                </motion.span>
                {item.shortcut ? (
                  <motion.span
                    aria-hidden={!isExpanded}
                    initial={false}
                    animate={{
                      width: isExpanded ? "auto" : 0,
                      opacity: isExpanded ? 1 : 0,
                      marginLeft: isExpanded ? 4 : 0,
                    }}
                    transition={
                      disableMotion
                        ? { duration: 0 }
                        : reduce
                          ? REDUCED_ACTION_BAR_TRANSITION
                          : ACTION_BAR_TRANSITION
                    }
                    className={cn(
                      "hidden overflow-hidden whitespace-nowrap text-[10px] text-muted-foreground sm:inline-block",
                      classNames?.shortcut
                    )}
                    data-slot="expandable-action-bar-shortcut"
                  >
                    {item.shortcut}
                  </motion.span>
                ) : null}
                {item.badge ? (
                  <span
                    className={cn(
                      "ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none text-primary-foreground",
                      !isExpanded && "absolute top-0.5 right-0.5",
                      classNames?.badge
                    )}
                    data-slot="expandable-action-bar-badge"
                  >
                    {item.badge}
                  </span>
                ) : null}
              </motion.button>
            );

            return item.wrap ? (
              <Fragment key={item.id}>{item.wrap(button)}</Fragment>
            ) : (
              button
            );
          })}
        </motion.div>
      </motion.div>
    </LayoutGroup>
  );
}
