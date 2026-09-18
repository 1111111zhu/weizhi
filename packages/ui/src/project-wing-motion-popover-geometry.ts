const CIRCLE_KAPPA = 0.5523;

export type ProjectWingMotionPopoverSide = "top" | "bottom";
export type ProjectWingMotionPopoverAlign = "start" | "center" | "end";

export interface ProjectWingMotionPopoverRect {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

export interface ProjectWingMotionPopoverGeo {
  layerW: number;
  layerH: number;
  left: number;
  top: number;
  trigger: ProjectWingMotionPopoverRect;
  panel: ProjectWingMotionPopoverRect;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function buildProjectWingMotionPopoverGeo(
  triggerWidth: number,
  triggerHeight: number,
  contentWidth: number,
  contentHeight: number,
  side: ProjectWingMotionPopoverSide,
  align: ProjectWingMotionPopoverAlign,
  gap: number,
  panelRadius: number
): ProjectWingMotionPopoverGeo {
  const panelTop =
    side === "bottom" ? triggerHeight + gap : -(gap + contentHeight);
  const panelLeft =
    align === "start"
      ? 0
      : align === "end"
        ? triggerWidth - contentWidth
        : (triggerWidth - contentWidth) / 2;
  const left = Math.min(0, panelLeft);
  const top = Math.min(0, panelTop);
  const layerW = Math.max(triggerWidth, panelLeft + contentWidth) - left;
  const layerH = Math.max(triggerHeight, panelTop + contentHeight) - top;
  const triggerRadius = Math.min(triggerHeight / 2, panelRadius);

  return {
    layerW,
    layerH,
    left,
    top,
    trigger: {
      x: -left,
      y: -top,
      w: triggerWidth,
      h: triggerHeight,
      r: triggerRadius,
    },
    panel: {
      x: panelLeft - left,
      y: panelTop - top,
      w: contentWidth,
      h: contentHeight,
      r: panelRadius,
    },
  };
}

function rectAtProgress(
  geo: ProjectWingMotionPopoverGeo,
  progress: number
): ProjectWingMotionPopoverRect {
  const { trigger, panel } = geo;

  return {
    x: lerp(trigger.x, panel.x, progress),
    y: lerp(trigger.y, panel.y, progress),
    w: lerp(trigger.w, panel.w, progress),
    h: lerp(trigger.h, panel.h, progress),
    r: lerp(trigger.r, panel.r, progress),
  };
}

function insetFor(
  rect: ProjectWingMotionPopoverRect,
  layerW: number,
  layerH: number
) {
  const top = rect.y;
  const right = layerW - (rect.x + rect.w);
  const bottom = layerH - (rect.y + rect.h);
  return `inset(${top}px ${right}px ${bottom}px ${rect.x}px round ${rect.r}px)`;
}

function roundedRectShape(rect: ProjectWingMotionPopoverRect) {
  const radius = Math.max(0, Math.min(rect.r, rect.w / 2, rect.h / 2));
  const control = radius * CIRCLE_KAPPA;
  const x1 = rect.x;
  const y1 = rect.y;
  const x2 = rect.x + rect.w;
  const y2 = rect.y + rect.h;
  const px = (value: number) => `${value.toFixed(3)}px`;

  return (
    `shape(from ${px(x1 + radius)} ${px(y1)}, ` +
    `line to ${px(x2 - radius)} ${px(y1)}, ` +
    `curve to ${px(x2)} ${px(y1 + radius)} with ${px(x2 - radius + control)} ${px(y1)} / ${px(x2)} ${px(y1 + radius - control)}, ` +
    `line to ${px(x2)} ${px(y2 - radius)}, ` +
    `curve to ${px(x2 - radius)} ${px(y2)} with ${px(x2)} ${px(y2 - radius + control)} / ${px(x2 - radius + control)} ${px(y2)}, ` +
    `line to ${px(x1 + radius)} ${px(y2)}, ` +
    `curve to ${px(x1)} ${px(y2 - radius)} with ${px(x1 + radius - control)} ${px(y2)} / ${px(x1)} ${px(y2 - radius + control)}, ` +
    `line to ${px(x1)} ${px(y1 + radius)}, ` +
    `curve to ${px(x1 + radius)} ${px(y1)} with ${px(x1)} ${px(y1 + radius - control)} / ${px(x1 + radius - control)} ${px(y1)}, ` +
    "close)"
  );
}

export function clipProjectWingMotionPopover(
  geo: ProjectWingMotionPopoverGeo,
  progress: number,
  supportsShape: boolean
) {
  const rect = rectAtProgress(geo, progress);
  return supportsShape
    ? roundedRectShape(rect)
    : insetFor(rect, geo.layerW, geo.layerH);
}

export const PROJECT_WING_MOTION_POPOVER_ALIGN_ORIGIN: Record<
  ProjectWingMotionPopoverAlign,
  string
> = {
  start: "left",
  center: "center",
  end: "right",
};
