import type {
  SmartFormV2FieldDefinition,
  SmartFormV2FixedSheetRow,
  SmartFormV2SheetColumnGroup,
  SmartFormV2SheetColumnNode,
  SmartFormV2SheetLeafColumn,
  SmartFormV2SheetNode,
} from "@project-wing/shared";

export type MobileSheetColumn = {
  column: SmartFormV2SheetLeafColumn;
  ancestors: readonly SmartFormV2SheetColumnGroup[];
};

/** A lossless column projection: identity, order and grouped headers are retained. */
export function projectMobileSheetColumns(
  columns: readonly SmartFormV2SheetColumnNode[],
  ancestors: readonly SmartFormV2SheetColumnGroup[] = []
): MobileSheetColumn[] {
  return columns.flatMap((column) =>
    column.kind === "column"
      ? [{ column, ancestors }]
      : projectMobileSheetColumns(column.children, [...ancestors, column])
  );
}

export function mobileSheetLayout(sheet: SmartFormV2SheetNode) {
  const columns = projectMobileSheetColumns(sheet.columns);
  // Respect the author's explicit comparison/scroll contract. Multiple row-label
  // columns cannot be represented by one record heading without losing context.
  return sheet.presentation.responsive === "cards" &&
    columns.filter(({ column }) => column.cell.kind === "rowLabel").length <= 1
    ? "records"
    : "table";
}

const FIELD_SPANS = {
  choice: "compact",
  number: "compact",
  date: "compact",
  text: "full",
  richText: "full",
  reference: "full",
  attachment: "full",
} satisfies Record<SmartFormV2FieldDefinition["type"], "compact" | "full">;

export function mobileSheetFieldSpan(
  row: SmartFormV2FixedSheetRow,
  column: SmartFormV2SheetLeafColumn
): "compact" | "full" {
  if (
    row.cells?.[column.id]?.kind === "content" ||
    column.cell.kind !== "field"
  ) {
    return "full";
  }
  const field = column.cell.field.value;
  return field.type === "choice" && field.cardinality === "many"
    ? "full"
    : FIELD_SPANS[field.type];
}
