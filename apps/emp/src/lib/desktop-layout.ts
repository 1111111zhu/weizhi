export type DesktopPosition = {
  x: number;
  y: number;
};

export type DesktopBounds = {
  width: number;
  height: number;
  iconWidth: number;
  iconHeight: number;
};

export type DesktopSearchItem = {
  visibleFields: string[];
  hiddenFields?: string[];
};

const ICON_COLUMNS = 6;
const ICON_OFFSET = 24;
const ICON_STEP_X = 132;
const ICON_STEP_Y = 148;

export function getDefaultIconPosition(index: number): DesktopPosition {
  return {
    x: (index % ICON_COLUMNS) * ICON_STEP_X + ICON_OFFSET,
    y: Math.floor(index / ICON_COLUMNS) * ICON_STEP_Y + ICON_OFFSET,
  };
}

export function clampDesktopPosition(
  position: DesktopPosition,
  bounds: DesktopBounds
): DesktopPosition {
  return {
    x: clamp(position.x, 0, Math.max(bounds.width - bounds.iconWidth, 0)),
    y: clamp(position.y, 0, Math.max(bounds.height - bounds.iconHeight, 0)),
  };
}

export function snapDesktopPosition(
  position: DesktopPosition,
  bounds: DesktopBounds
): DesktopPosition {
  return {
    x: snapAxisToGrid(
      position.x,
      ICON_OFFSET,
      ICON_STEP_X,
      Math.max(bounds.width - bounds.iconWidth, 0)
    ),
    y: snapAxisToGrid(
      position.y,
      ICON_OFFSET,
      ICON_STEP_Y,
      Math.max(bounds.height - bounds.iconHeight, 0)
    ),
  };
}

export function findNextAvailableDesktopPosition({
  bounds,
  desired,
  occupied,
}: {
  bounds: DesktopBounds;
  desired: DesktopPosition;
  occupied: DesktopPosition[];
}): DesktopPosition {
  const clampedDesired = clampDesktopPosition(desired, bounds);
  if (!hasCollision(clampedDesired, occupied, bounds)) {
    return clampedDesired;
  }

  const snappedDesired = snapDesktopPosition(clampedDesired, bounds);
  const maxColumn = getMaxGridIndex(
    bounds.width,
    bounds.iconWidth,
    ICON_STEP_X
  );
  const maxRow = getMaxGridIndex(bounds.height, bounds.iconHeight, ICON_STEP_Y);
  const startColumn = getGridIndex(snappedDesired.x, ICON_STEP_X);
  const startRow = getGridIndex(snappedDesired.y, ICON_STEP_Y);

  for (let row = startRow; row <= maxRow; row += 1) {
    const firstColumn = row === startRow ? startColumn : 0;
    const candidate = findFreePositionInRow(
      row,
      firstColumn,
      maxColumn,
      occupied,
      bounds
    );
    if (candidate) {
      return candidate;
    }
  }

  for (let row = 0; row <= startRow; row += 1) {
    const lastColumn = row === startRow ? startColumn - 1 : maxColumn;
    const candidate = findFreePositionInRow(
      row,
      0,
      lastColumn,
      occupied,
      bounds
    );
    if (candidate) {
      return candidate;
    }
  }

  return snappedDesired;
}

export function matchesDesktopSearch(
  item: DesktopSearchItem,
  query: string
): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }
  return item.visibleFields.some((field) =>
    field.toLowerCase().includes(normalizedQuery)
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function snapAxisToGrid(
  value: number,
  offset: number,
  step: number,
  max: number
) {
  if (max <= 0) {
    return 0;
  }

  const maxIndex = Math.max(0, Math.floor((max - offset) / step));
  const index = clamp(Math.round((value - offset) / step), 0, maxIndex);
  return clamp(offset + index * step, 0, max);
}

function findFreePositionInRow(
  row: number,
  firstColumn: number,
  lastColumn: number,
  occupied: DesktopPosition[],
  bounds: DesktopBounds
) {
  for (let column = firstColumn; column <= lastColumn; column += 1) {
    const candidate = {
      x: ICON_OFFSET + column * ICON_STEP_X,
      y: ICON_OFFSET + row * ICON_STEP_Y,
    };
    if (!hasCollision(candidate, occupied, bounds)) {
      return candidate;
    }
  }
  return null;
}

function hasCollision(
  position: DesktopPosition,
  occupied: DesktopPosition[],
  bounds: DesktopBounds
) {
  return occupied.some((item) =>
    rectanglesOverlap(position, item, bounds.iconWidth, bounds.iconHeight)
  );
}

function rectanglesOverlap(
  left: DesktopPosition,
  right: DesktopPosition,
  width: number,
  height: number
) {
  return (
    left.x < right.x + width &&
    left.x + width > right.x &&
    left.y < right.y + height &&
    left.y + height > right.y
  );
}

function getGridIndex(value: number, step: number) {
  return Math.max(0, Math.round((value - ICON_OFFSET) / step));
}

function getMaxGridIndex(size: number, iconSize: number, step: number) {
  const maxPosition = Math.max(size - iconSize, 0);
  return Math.max(0, Math.floor((maxPosition - ICON_OFFSET) / step));
}
