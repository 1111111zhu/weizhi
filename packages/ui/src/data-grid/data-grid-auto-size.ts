import type { ColumnSizingState, Table } from "@tanstack/react-table";

export type DataGridAutoSizeController = {
  apply: (containerWidth: number) => boolean;
};

export type DataGridAutoSizeEntry = {
  columnId: string;
  base: number;
  grown: number;
  minimum?: number;
};

type AppliedAutoSizes = {
  signature: string;
  entries: DataGridAutoSizeEntry[];
  lockedColumnIds: Set<string>;
  columnSizes: Map<string, number>;
  containerWidth: number;
  fixedWidth: number;
};

export function distributeDataGridAutoSize(
  entries: DataGridAutoSizeEntry[],
  availableWidth: number,
  lockedColumnIds: ReadonlySet<string> = new Set()
) {
  const lockedWidth = entries.reduce(
    (total, entry) =>
      total + (lockedColumnIds.has(entry.columnId) ? entry.base : 0),
    0
  );
  const flexibleEntries = entries.filter(
    (entry) => !lockedColumnIds.has(entry.columnId)
  );
  const flexibleBaseTotal = flexibleEntries.reduce(
    (total, entry) => total + entry.base,
    0
  );
  const flexibleAvailableWidth = Math.max(0, availableWidth - lockedWidth);
  const widthDelta = flexibleAvailableWidth - flexibleBaseTotal;
  const shrinkCapacity = flexibleEntries.reduce(
    (total, entry) =>
      total + entry.base - Math.min(entry.base, entry.minimum ?? entry.base),
    0
  );
  const distributableWidth =
    widthDelta >= 0 ? widthDelta : Math.min(-widthDelta, shrinkCapacity);
  let distributed = 0;
  let flexibleIndex = 0;

  return entries.map((entry) => {
    if (lockedColumnIds.has(entry.columnId)) {
      return { ...entry, grown: entry.base };
    }

    const index = flexibleIndex;
    flexibleIndex += 1;
    const capacity =
      widthDelta >= 0
        ? entry.base
        : entry.base - Math.min(entry.base, entry.minimum ?? entry.base);
    const totalCapacity = widthDelta >= 0 ? flexibleBaseTotal : shrinkCapacity;
    const share =
      index === flexibleEntries.length - 1
        ? distributableWidth - distributed
        : totalCapacity > 0
          ? (distributableWidth * capacity) / totalCapacity
          : 0;
    distributed += share;
    return {
      ...entry,
      grown: widthDelta >= 0 ? entry.base + share : entry.base - share,
    };
  });
}

function resolveAutoSizeEntries<TData extends object>(
  table: Table<TData>,
  sizing: ColumnSizingState,
  previous: AppliedAutoSizes | null,
  preserveReadableWidths: boolean
) {
  const previousEntries = new Map(
    previous?.entries.map((entry) => [entry.columnId, entry])
  );
  const manuallySizedColumnIds = new Set<string>();
  const entries = table
    .getVisibleLeafColumns()
    .filter(
      (column) => column.columnDef.meta?.autoSize && column.getCanResize()
    )
    .map((column) => {
      const prior = previousEntries.get(column.id);
      const current = sizing[column.id] ?? column.getSize();
      const manuallySized = Boolean(
        prior && Math.abs(current - prior.grown) >= 0.01
      );
      if (manuallySized) {
        manuallySizedColumnIds.add(column.id);
      }
      // TanStack merges its 20px default minimum into columnDef. On phones,
      // that is a resize limit, not a readable automatic layout width.
      const authoredMinimum = Math.max(
        column.columnDef.minSize ?? 0,
        column.columnDef.size ?? current
      );
      const base =
        prior && !manuallySized
          ? prior.base
          : preserveReadableWidths && !prior
            ? Math.max(current, authoredMinimum)
            : current;
      return {
        columnId: column.id,
        base,
        grown: current,
        minimum: preserveReadableWidths
          ? authoredMinimum
          : (column.columnDef.minSize ?? 64),
      };
    });

  return { entries, manuallySizedColumnIds };
}

function sizesMatch(
  entries: DataGridAutoSizeEntry[],
  sizing: ColumnSizingState
) {
  return entries.every(
    (entry) =>
      Math.abs(entry.grown - (sizing[entry.columnId] ?? entry.base)) < 0.01
  );
}

function getVisibleResizableSizes<TData extends object>(table: Table<TData>) {
  return new Map(
    table
      .getVisibleLeafColumns()
      .filter((column) => column.getCanResize())
      .map((column) => [column.id, column.getSize()])
  );
}

function getManuallySizedColumnIds(
  current: ReadonlyMap<string, number>,
  previous?: ReadonlyMap<string, number>
) {
  const resized = new Set<string>();
  if (!previous) {
    return resized;
  }
  current.forEach((size, columnId) => {
    const priorSize = previous.get(columnId);
    if (priorSize !== undefined && Math.abs(size - priorSize) >= 0.01) {
      resized.add(columnId);
    }
  });
  return resized;
}

function withAutoSizes(
  columnSizes: ReadonlyMap<string, number>,
  entries: DataGridAutoSizeEntry[]
) {
  const resolved = new Map(columnSizes);
  entries.forEach(({ columnId, grown }) => resolved.set(columnId, grown));
  return resolved;
}

export function createDataGridAutoSizeController<TData extends object>(
  table: Table<TData>,
  preserveReadableWidths = false
): DataGridAutoSizeController {
  let applied: AppliedAutoSizes | null = null;
  let pendingEntries: DataGridAutoSizeEntry[] | null = null;

  return {
    apply(containerWidth) {
      const sizing = table.getState().columnSizing;
      if (pendingEntries) {
        if (!sizesMatch(pendingEntries, sizing)) {
          return false;
        }
        pendingEntries = null;
      }
      const { entries, manuallySizedColumnIds } = resolveAutoSizeEntries(
        table,
        sizing,
        applied,
        preserveReadableWidths
      );
      if (entries.length === 0 || containerWidth <= 0) {
        return false;
      }
      const currentColumnSizes = getVisibleResizableSizes(table);
      const resizedColumnIds = getManuallySizedColumnIds(
        currentColumnSizes,
        applied?.columnSizes
      );
      // Column order is deliberately excluded. Reordering columns changes
      // Their position, not their width, and must not move any boundaries.
      const signature = entries
        .map(({ columnId }) => columnId)
        .sort()
        .join("|");
      const visibleColumnIds = new Set(entries.map(({ columnId }) => columnId));
      const lockedColumnIds = new Set(
        [...(applied?.lockedColumnIds ?? [])].filter((columnId) =>
          visibleColumnIds.has(columnId)
        )
      );
      manuallySizedColumnIds.forEach((columnId) =>
        lockedColumnIds.add(columnId)
      );
      const currentAutoWidth = entries.reduce(
        (total, entry) => total + entry.grown,
        0
      );
      const fixedWidth = table.getTotalSize() - currentAutoWidth;

      // A user resize is authoritative. Capture the new state without
      // Redistributing any free width: only the dragged column moves and all
      // Neighbouring column boundaries remain exactly where they were.
      if (resizedColumnIds.size > 0) {
        applied = {
          signature,
          entries: entries.map((entry) => ({
            ...entry,
            base: entry.grown,
          })),
          lockedColumnIds,
          columnSizes: currentColumnSizes,
          containerWidth,
          fixedWidth,
        };
        return false;
      }

      // Ordinary React renders after a resize must not become layout passes.
      // Auto distribution is reserved for initial layout, a real viewport
      // Resize, a visible-column set change, or a fixed-width column change.
      // The last case lets flexible columns immediately absorb space when a
      // Protected column (for example Status or Actions) needs more room.
      if (
        applied?.signature === signature &&
        Math.abs(applied.containerWidth - containerWidth) < 0.01 &&
        Math.abs(applied.fixedWidth - fixedWidth) < 0.01
      ) {
        return false;
      }

      const nextEntries = distributeDataGridAutoSize(
        entries,
        containerWidth - fixedWidth,
        lockedColumnIds
      );
      if (applied?.signature === signature && sizesMatch(nextEntries, sizing)) {
        return false;
      }

      applied = {
        signature,
        entries: nextEntries,
        lockedColumnIds,
        columnSizes: withAutoSizes(currentColumnSizes, nextEntries),
        containerWidth,
        fixedWidth,
      };
      pendingEntries = nextEntries;
      table.setColumnSizing((old) => ({
        ...old,
        ...Object.fromEntries(
          nextEntries.map(({ columnId, grown }) => [columnId, grown])
        ),
      }));
      return true;
    },
  };
}
