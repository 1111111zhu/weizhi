type DataGridColumnResizeMaxDeltaInput = {
  columnMaxDeltaPercentage: number;
  compensationColumns?: DataGridColumnResizeCompensationColumn[];
  currentTableWidth: number;
  resizedColumnsWidth: number;
  viewportWidth?: number;
};

type DataGridColumnResizeCompensationColumn = {
  id: string;
  minSize: number;
  size: number;
};

type DataGridColumnResizeCompensationInput = {
  compensationColumns: DataGridColumnResizeCompensationColumn[];
  currentTableWidth: number;
  deltaOffset: number;
  viewportWidth?: number;
};

function getCompensationCapacity(
  columns: DataGridColumnResizeCompensationColumn[]
) {
  return columns.reduce(
    (total, column) => total + Math.max(0, column.size - column.minSize),
    0
  );
}

function roundColumnSize(size: number) {
  return Math.round(size * 100) / 100;
}

export function getDataGridColumnResizeMaxDeltaPercentage({
  columnMaxDeltaPercentage,
  compensationColumns = [],
  currentTableWidth,
  resizedColumnsWidth,
  viewportWidth,
}: DataGridColumnResizeMaxDeltaInput) {
  if (
    typeof viewportWidth !== "number" ||
    !Number.isFinite(viewportWidth) ||
    viewportWidth <= 0 ||
    !Number.isFinite(currentTableWidth) ||
    currentTableWidth < 0 ||
    !Number.isFinite(resizedColumnsWidth) ||
    resizedColumnsWidth <= 0
  ) {
    return columnMaxDeltaPercentage;
  }

  const availableGrowth =
    Math.max(0, viewportWidth - currentTableWidth) +
    getCompensationCapacity(compensationColumns);
  return Math.min(
    columnMaxDeltaPercentage,
    availableGrowth / resizedColumnsWidth
  );
}

export function getDataGridColumnResizeCompensation({
  compensationColumns,
  currentTableWidth,
  deltaOffset,
  viewportWidth,
}: DataGridColumnResizeCompensationInput) {
  if (
    deltaOffset <= 0 ||
    typeof viewportWidth !== "number" ||
    !Number.isFinite(viewportWidth) ||
    viewportWidth <= 0 ||
    !Number.isFinite(currentTableWidth) ||
    currentTableWidth < 0
  ) {
    return {};
  }

  const freeGrowth = Math.max(0, viewportWidth - currentTableWidth);
  let remainingCompensation = Math.max(0, deltaOffset - freeGrowth);
  const sizing: Record<string, number> = {};

  for (const column of compensationColumns) {
    if (remainingCompensation <= 0) {
      break;
    }

    const shrinkCapacity = Math.max(0, column.size - column.minSize);
    const shrink = Math.min(shrinkCapacity, remainingCompensation);
    if (shrink <= 0) {
      continue;
    }

    sizing[column.id] = roundColumnSize(column.size - shrink);
    remainingCompensation -= shrink;
  }

  return sizing;
}

export type {
  DataGridColumnResizeCompensationColumn,
  DataGridColumnResizeCompensationInput,
  DataGridColumnResizeMaxDeltaInput,
};
