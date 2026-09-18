export type DesktopRectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DesktopPoint = Pick<DesktopRectangle, "x" | "y">;

type FlyoutSize = Pick<DesktopRectangle, "width" | "height">;

const flyoutGap = 8;
const workAreaMargin = 8;

export function isPointInsideRectangle(
  point: DesktopPoint,
  rectangle: DesktopRectangle
) {
  return (
    point.x >= rectangle.x &&
    point.x < rectangle.x + rectangle.width &&
    point.y >= rectangle.y &&
    point.y < rectangle.y + rectangle.height
  );
}

export function getTrayFlyoutPosition(
  anchor: DesktopRectangle,
  workArea: DesktopRectangle,
  flyout: FlyoutSize
) {
  const workAreaRight = workArea.x + workArea.width;
  const workAreaBottom = workArea.y + workArea.height;
  const anchorRight = anchor.x + anchor.width;
  const anchorBottom = anchor.y + anchor.height;
  const centeredX = anchor.x + (anchor.width - flyout.width) / 2;
  const centeredY = anchor.y + (anchor.height - flyout.height) / 2;

  if (anchor.y >= workAreaBottom) {
    return clampPosition(
      centeredX,
      anchor.y - flyout.height - flyoutGap,
      workArea,
      flyout
    );
  }
  if (anchorBottom <= workArea.y) {
    return clampPosition(centeredX, anchorBottom + flyoutGap, workArea, flyout);
  }
  if (anchor.x >= workAreaRight) {
    return clampPosition(
      anchor.x - flyout.width - flyoutGap,
      centeredY,
      workArea,
      flyout
    );
  }
  if (anchorRight <= workArea.x) {
    return clampPosition(anchorRight + flyoutGap, centeredY, workArea, flyout);
  }

  const spaceBelow = workAreaBottom - anchorBottom;
  const y =
    spaceBelow >= flyout.height + flyoutGap
      ? anchorBottom + flyoutGap
      : anchor.y - flyout.height - flyoutGap;
  return clampPosition(centeredX, y, workArea, flyout);
}

function clampPosition(
  x: number,
  y: number,
  workArea: DesktopRectangle,
  flyout: FlyoutSize
) {
  return {
    x: Math.round(
      clamp(
        x,
        workArea.x + workAreaMargin,
        workArea.x + workArea.width - flyout.width - workAreaMargin
      )
    ),
    y: Math.round(
      clamp(
        y,
        workArea.y + workAreaMargin,
        workArea.y + workArea.height - flyout.height - workAreaMargin
      )
    ),
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}
