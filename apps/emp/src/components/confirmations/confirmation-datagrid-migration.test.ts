import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const confirmationsDir = import.meta.dirname;
const componentsDir = fileURLToPath(new URL("../", import.meta.url));

function read(path: string) {
  return readFileSync(path, "utf-8");
}

const migratedSurfaces = [
  `${confirmationsDir}/confirmation-information-library.tsx`,
  `${componentsDir}/confirmation-response-warehouse.tsx`,
  `${confirmationsDir}/confirmation-response-warehouse.tsx`,
  `${confirmationsDir}/confirmation-dispatch-queue.tsx`,
  `${componentsDir}/project-confirmations-panel.tsx`,
] as const;
const dataGridHelpers = [
  `${confirmationsDir}/confirmation-information-library-grid.tsx`,
  `${componentsDir}/confirmation-response-warehouse-grid.tsx`,
  `${confirmationsDir}/confirmation-emp-import-grids.tsx`,
  `${confirmationsDir}/confirmation-register-data-grid.tsx`,
  `${confirmationsDir}/confirmation-template-library-data-grid.tsx`,
  `${confirmationsDir}/confirmation-dispatch-queue.tsx`,
] as const;

describe("confirmation-center DataGrid migration", () => {
  it("keeps every migrated non-overview surface off the legacy Table stack", () => {
    for (const path of migratedSurfaces) {
      const source = read(path);
      expect(source).not.toMatch(/(?:ui\/table|<Table(?:\s|>|[A-Z]))/);
    }
  });

  it("keeps manual confirmation-table resize implementations removed", () => {
    const source = migratedSurfaces.map(read).join("\n");
    expect(source).not.toMatch(
      /ConfirmationRegisterColumnResizer|ResizableTemplateLibraryHead|ResizableWarehouseHead|ResizableTableHead|REGISTER_COLUMN_WIDTHS|TEMPLATE_LIBRARY_COLUMN_WIDTHS|GROUPED_COLUMN_WIDTHS/
    );
  });

  it("uses explicit localized header metadata in every DataGrid helper", () => {
    for (const path of dataGridHelpers) {
      const source = read(path);
      expect(source).toMatch(/meta:\s*\{[\s\S]{0,120}headerTitle/);
    }
  });

  it("keeps dispatch stages inside the shared DataGrid toolbar", () => {
    const source = read(`${confirmationsDir}/confirmation-dispatch-queue.tsx`);
    expect(source).toContain("actions={stageTabs}");
    expect(source).toContain('toolbarTestId="confirmation-dispatch-toolbar"');
  });

  it("keeps response archive selection centered in its compact DataGrid column", () => {
    const source = read(
      `${componentsDir}/confirmation-response-warehouse-grid.tsx`
    );
    const centeredCheckboxes =
      source.match(/<Checkbox\b[^>]*?className=\{selectionMotionClass\}/g) ??
      [];
    expect(centeredCheckboxes.length).toBeGreaterThanOrEqual(2);
    const centeredMotionStates =
      source.match(/"mx-auto [^"]*motion-safe:animate-(?:in|out)[^"]*"/g) ?? [];
    expect(centeredMotionStates).toHaveLength(2);
  });

  it("keeps the grouped import summary inside the shared DataGrid toolbar", () => {
    const source = read(
      `${confirmationsDir}/confirmation-response-warehouse.tsx`
    );
    expect(source).toContain("<ConfirmationGroupedImportDataGrid");
    const gridSource = read(
      `${confirmationsDir}/confirmation-emp-import-grids.tsx`
    );
    expect(gridSource).toContain("title={copy.folderContents}");
  });

  it("preserves the template-grid seam when the preview pane is open", () => {
    const source = read(
      `${confirmationsDir}/confirmation-template-library-data-grid.tsx`
    );
    expect(source).toContain(
      'data-preview-open={previewingTemplateId ? "true" : undefined}'
    );
    expect(source).toContain(
      "[&_[data-slot=frame]]:rounded-r-none [&_[data-slot=frame]]:border-r-0"
    );
  });

  it("does not use the shared hardcoded-English row selection column", () => {
    for (const path of dataGridHelpers) {
      const source = read(path);
      expect(source).not.toContain("DataGridTableRowSelectAll");
      expect(source).not.toContain("DataGridTableRowSelect");
    }
  });

  it("leaves the overview matrix outside this migration contract", () => {
    const overviewPath = `${confirmationsDir}/confirmation-overview-matrix.tsx`;
    expect(migratedSurfaces).not.toContain(overviewPath);
  });
});
