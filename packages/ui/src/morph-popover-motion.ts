import type { PortalLayout } from "./morph-popover-position";

export type MorphPopoverSide = "top" | "bottom";
export type MorphPopoverAlign = "start" | "end";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const SPRING_PANEL = {
  type: "spring",
  stiffness: 420,
  damping: 40,
  mass: 0.5,
} as const;

function clipHidden(
  side: MorphPopoverSide,
  align: MorphPopoverAlign,
  radius: number
) {
  const top = side === "bottom" ? "0%" : "92%";
  const bottom = side === "bottom" ? "92%" : "0%";
  const right = align === "end" ? "0%" : "92%";
  const left = align === "end" ? "92%" : "0%";
  return `inset(${top} ${right} ${bottom} ${left} round ${radius}px)`;
}

export function getMorphPopoverPosition(
  layout: PortalLayout,
  side: MorphPopoverSide,
  align: MorphPopoverAlign,
  offset: number
) {
  return {
    left:
      align === "end"
        ? layout.trigger.left + layout.trigger.width - layout.content.width
        : layout.trigger.left,
    top:
      side === "bottom"
        ? layout.trigger.top + layout.trigger.height + offset
        : layout.trigger.top - layout.content.height - offset,
  };
}

export function getMorphPopoverVariants(
  reduce: boolean,
  side: MorphPopoverSide,
  align: MorphPopoverAlign,
  radius: number
) {
  if (reduce) {
    return { clipVariants: undefined, wrapperVariants: undefined };
  }
  const transition = { duration: 0.32, ease: EASE_OUT } as const;
  return {
    wrapperVariants: {
      hidden: { opacity: 0, scale: 0.96, transition: SPRING_PANEL },
      show: { opacity: 1, scale: 1, transition: SPRING_PANEL },
    },
    clipVariants: {
      hidden: { clipPath: clipHidden(side, align, radius), transition },
      show: {
        clipPath: `inset(0% 0% 0% 0% round ${radius}px)`,
        transition,
      },
    },
  };
}
