export type DesktopGridPosition = {
  desktopX: number;
  desktopY: number;
};

export const DESKTOP_ICON_WIDTH = 132;
export const DESKTOP_ICON_HEIGHT = 132;
export const DESKTOP_ICON_STEP_X = 132;
export const DESKTOP_ICON_STEP_Y = 148;
export const DESKTOP_ICON_COLUMNS = 6;
export const DESKTOP_ICON_OFFSET = 24;

export function defaultDesktopPosition(index: number): DesktopGridPosition {
  return {
    desktopX:
      (index % DESKTOP_ICON_COLUMNS) * DESKTOP_ICON_STEP_X +
      DESKTOP_ICON_OFFSET,
    desktopY:
      Math.floor(index / DESKTOP_ICON_COLUMNS) * DESKTOP_ICON_STEP_Y +
      DESKTOP_ICON_OFFSET,
  };
}

export function findNextAvailableDesktopPosition(
  desired: DesktopGridPosition,
  occupied: DesktopGridPosition[]
): DesktopGridPosition {
  const clampedDesired = {
    desktopX: Math.max(0, desired.desktopX),
    desktopY: Math.max(0, desired.desktopY),
  };
  if (!hasCollision(clampedDesired, occupied)) {
    return clampedDesired;
  }

  const startIndex = positionToGridIndex(clampedDesired);
  for (
    let index = startIndex;
    index <= startIndex + occupied.length + DESKTOP_ICON_COLUMNS + 1;
    index += 1
  ) {
    const candidate = defaultDesktopPosition(index);
    if (!hasCollision(candidate, occupied)) {
      return candidate;
    }
  }

  return defaultDesktopPosition(startIndex + occupied.length + 1);
}

function hasCollision(
  position: DesktopGridPosition,
  occupied: DesktopGridPosition[]
) {
  return occupied.some((item) => rectanglesOverlap(position, item));
}

function rectanglesOverlap(
  left: DesktopGridPosition,
  right: DesktopGridPosition
) {
  return (
    left.desktopX < right.desktopX + DESKTOP_ICON_WIDTH &&
    left.desktopX + DESKTOP_ICON_WIDTH > right.desktopX &&
    left.desktopY < right.desktopY + DESKTOP_ICON_HEIGHT &&
    left.desktopY + DESKTOP_ICON_HEIGHT > right.desktopY
  );
}

function positionToGridIndex(position: DesktopGridPosition) {
  const column = Math.max(
    0,
    Math.min(
      DESKTOP_ICON_COLUMNS - 1,
      Math.round(
        (position.desktopX - DESKTOP_ICON_OFFSET) / DESKTOP_ICON_STEP_X
      )
    )
  );
  const row = Math.max(
    0,
    Math.round((position.desktopY - DESKTOP_ICON_OFFSET) / DESKTOP_ICON_STEP_Y)
  );
  return row * DESKTOP_ICON_COLUMNS + column;
}
