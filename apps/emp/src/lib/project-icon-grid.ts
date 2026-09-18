import type { DesktopPosition } from "./desktop-layout";

export const PROJECT_GRID_TILE_SIZE = 144;
export const PROJECT_GRID_GAP = 12;

const PROJECT_GRID_OFFSET = 24;
const PROJECT_GRID_PADDING = 16;
const PROJECT_GRID_STEP = PROJECT_GRID_TILE_SIZE + PROJECT_GRID_GAP;
const DEFAULT_PROJECT_GRID_COLUMNS = 6;
const DEFAULT_PROJECT_GRID_ROWS = 4;

export type ProjectGridPlacement = {
  desktopX: number;
  desktopY: number;
  projectId: string;
  sortOrder: number;
};

export type ProjectGridSlot<T extends ProjectGridPlacement> = {
  id: string;
  index: number;
  placement: T | null;
};

export type ProjectGridPlacementUpdate<T extends ProjectGridPlacement> = {
  placement: T;
  position: DesktopPosition;
  sortOrder: number;
};

export function getProjectGridDimensions<T extends ProjectGridPlacement>(
  width: number,
  height: number,
  placements: T[]
) {
  const columns = getVisibleColumnCount(width);
  const visibleRows = getVisibleRowCount(height);
  const persistedRows = placements.reduce(
    (rows, placement) =>
      Math.max(rows, getGridAxisIndex(placement.desktopY) + 1),
    1
  );
  return { columns, rows: Math.max(visibleRows, persistedRows) };
}

export function buildProjectGridSlots<T extends ProjectGridPlacement>(
  placements: T[],
  positions: Record<string, DesktopPosition>,
  columns: number,
  rows: number
): ProjectGridSlot<T>[] {
  const slots = createEmptySlots<T>(
    Math.max(columns * rows, placements.length)
  );
  const sortedPlacements = [...placements].sort(
    (left, right) => left.sortOrder - right.sortOrder
  );
  for (const placement of sortedPlacements) {
    const position = positions[placement.projectId] ?? {
      x: placement.desktopX,
      y: placement.desktopY,
    };
    const desiredIndex = getProjectGridSlotIndex(position, columns);
    const availableIndex = findAvailableSlot(slots, desiredIndex);
    if (availableIndex === slots.length) {
      slots.push(...createEmptySlots<T>(columns, slots.length));
    }
    const slot = slots[availableIndex];
    if (slot) {
      slot.placement = placement;
    }
  }
  return slots;
}

export function moveProjectGridSlot<T extends ProjectGridPlacement>(
  slots: ProjectGridSlot<T>[],
  activeIndex: number,
  overIndex: number
) {
  const activePlacement = slots[activeIndex]?.placement;
  if (!activePlacement || !slots[overIndex]) {
    return slots;
  }
  const next = slots.map((slot) => ({ ...slot }));
  next[activeIndex].placement = next[overIndex].placement;
  next[overIndex].placement = activePlacement;
  return next;
}

export function getProjectGridPlacementUpdates<T extends ProjectGridPlacement>(
  slots: ProjectGridSlot<T>[],
  columns: number
) {
  return slots.flatMap<ProjectGridPlacementUpdate<T>>((slot) =>
    slot.placement
      ? [
          {
            placement: slot.placement,
            position: getProjectGridPosition(slot.index, columns),
            sortOrder: slot.index,
          },
        ]
      : []
  );
}

function getVisibleColumnCount(width: number) {
  if (width <= 0) {
    return DEFAULT_PROJECT_GRID_COLUMNS;
  }
  const availableSize = width - PROJECT_GRID_PADDING * 2 + PROJECT_GRID_GAP;
  return Math.max(1, Math.floor(availableSize / PROJECT_GRID_STEP));
}

function getVisibleRowCount(height: number) {
  if (height <= 0) {
    return DEFAULT_PROJECT_GRID_ROWS;
  }
  const availableSize = height - PROJECT_GRID_PADDING * 2 + PROJECT_GRID_GAP;
  return Math.max(1, Math.ceil(availableSize / PROJECT_GRID_STEP));
}

function getProjectGridSlotIndex(position: DesktopPosition, columns: number) {
  const column = Math.min(getGridAxisIndex(position.x), columns - 1);
  return getGridAxisIndex(position.y) * columns + column;
}

function getProjectGridPosition(index: number, columns: number) {
  return {
    x: PROJECT_GRID_OFFSET + (index % columns) * PROJECT_GRID_STEP,
    y: PROJECT_GRID_OFFSET + Math.floor(index / columns) * PROJECT_GRID_STEP,
  };
}

function getGridAxisIndex(value: number) {
  return Math.max(
    0,
    Math.round((value - PROJECT_GRID_OFFSET) / PROJECT_GRID_STEP)
  );
}

function findAvailableSlot<T extends ProjectGridPlacement>(
  slots: ProjectGridSlot<T>[],
  desiredIndex: number
) {
  const clampedIndex = Math.min(desiredIndex, slots.length - 1);
  if (!slots[clampedIndex]?.placement) {
    return clampedIndex;
  }
  const after = slots.findIndex(
    (slot, index) => index > clampedIndex && !slot.placement
  );
  if (after !== -1) {
    return after;
  }
  const before = slots.findIndex(
    (slot, index) => index < clampedIndex && !slot.placement
  );
  return before === -1 ? slots.length : before;
}

function createEmptySlots<T extends ProjectGridPlacement>(
  count: number,
  offset = 0
): ProjectGridSlot<T>[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `project-grid-slot-${offset + index}`,
    index: offset + index,
    placement: null,
  }));
}
