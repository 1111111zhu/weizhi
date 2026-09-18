import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(text, before, after, label) {
  const index = text.indexOf(before);
  assert.notEqual(index, -1, `missing migration anchor: ${label}`);
  assert.equal(
    text.indexOf(before, index + before.length),
    -1,
    `migration anchor must be unique: ${label}`
  );
  return text.slice(0, index) + after + text.slice(index + before.length);
}

function preserveTemplatePreviewSeam() {
  const path =
    "apps/emp/src/components/confirmations/confirmation-template-library-data-grid.tsx";
  let text = readFileSync(path, "utf-8");
  if (
    text.includes(
      'data-preview-open={previewingTemplateId ? "true" : undefined}'
    )
  ) {
    return;
  }

  text = replaceOnce(
    text,
    `  return (\n    <ProjectWingMasterDataGrid`,
    `  return (\n    <div\n      data-preview-open={previewingTemplateId ? "true" : undefined}\n      className={cn(\n        "h-full min-h-0",\n        previewingTemplateId &&\n          "[&_[data-slot=frame]]:rounded-r-none [&_[data-slot=frame]]:border-r-0"\n      )}\n    >\n      <ProjectWingMasterDataGrid`,
    "template preview DataGrid seam wrapper"
  );
  text = replaceOnce(
    text,
    `      toolbarTestId="confirmation-template-library-toolbar"\n      title={copy.templateLibrary.title}\n    />\n  );`,
    `      toolbarTestId="confirmation-template-library-toolbar"\n      title={copy.templateLibrary.title}\n    />\n    </div>\n  );`,
    "template preview DataGrid seam wrapper close"
  );
  writeFileSync(path, text);
}

function assertMigrationState() {
  const register = readFileSync(
    "apps/emp/src/components/confirmations/confirmation-register-data-grid.tsx",
    "utf-8"
  );
  const groupedImport = readFileSync(
    "apps/emp/src/components/confirmations/confirmation-response-warehouse.tsx",
    "utf-8"
  );
  const projectPanel = readFileSync(
    "apps/emp/src/components/project-confirmations-panel.tsx",
    "utf-8"
  );
  const rootWarehouse = readFileSync(
    "apps/emp/src/components/confirmation-response-warehouse.tsx",
    "utf-8"
  );

  assert.ok(register.includes('UNKNOWN: "—"'));
  assert.ok(groupedImport.includes("<ConfirmationGroupedImportDataGrid"));
  assert.ok(groupedImport.includes('{mode !== "GROUPED" ? ('));
  assert.ok(projectPanel.includes("<ConfirmationTemplateLibraryDataGrid"));
  assert.ok(!projectPanel.includes('from "@/components/ui/table"'));
  assert.ok(!rootWarehouse.includes('from "@/components/ui/table"'));
}

assertMigrationState();
preserveTemplatePreviewSeam();
