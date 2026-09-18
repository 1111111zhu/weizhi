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

function replaceRange(text, start, end, replacement, label) {
  const startIndex = text.indexOf(start);
  assert.notEqual(startIndex, -1, `missing range start: ${label}`);
  const endIndex = text.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `missing range end: ${label}`);
  return text.slice(0, startIndex) + replacement + text.slice(endIndex);
}

function migrateRegisterAccessibility() {
  const path =
    "apps/emp/src/components/confirmations/confirmation-register-data-grid.tsx";
  let text = readFileSync(path, "utf-8");
  if (text.includes('aria-label={row.original.confirmationCode ?? "—"}')) {
    return;
  }

  text = replaceOnce(
    text,
    `          <span className="block truncate font-mono text-xs text-muted-foreground">\n            {row.original.confirmationCode ?? "—"}\n          </span>`,
    `          <span\n            aria-label={row.original.confirmationCode ?? "—"}\n            className="block truncate font-mono text-xs text-muted-foreground"\n          >\n            {row.original.confirmationCode ?? "—"}\n          </span>`,
    "confirmation register clipped code accessible name"
  );
  writeFileSync(path, text);
}

function migrateResponseWarehouseSelectionAlignment() {
  const path =
    "apps/emp/src/components/confirmation-response-warehouse-grid.tsx";
  let text = readFileSync(path, "utf-8");
  if (
    text.includes(
      'aria-label={copy.selectAll}\n              className="mx-auto"'
    )
  ) {
    return;
  }

  text = replaceOnce(
    text,
    `            <Checkbox\n              aria-label={copy.selectAll}\n              checked={allSelectableRowsSelected}`,
    `            <Checkbox\n              aria-label={copy.selectAll}\n              className="mx-auto"\n              checked={allSelectableRowsSelected}`,
    "response warehouse select-all alignment"
  );
  text = replaceOnce(
    text,
    `              <Checkbox\n                aria-label={copy.selectRow.replace("{title}", row.original.title)}\n                checked={selectedIds.has(row.original.id)}`,
    `              <Checkbox\n                aria-label={copy.selectRow.replace("{title}", row.original.title)}\n                className="mx-auto"\n                checked={selectedIds.has(row.original.id)}`,
    "response warehouse row selection alignment"
  );
  writeFileSync(path, text);
}

function migrateProjectConfirmationTests() {
  const path = "apps/emp/src/components/project-confirmations-panel.test.tsx";
  let text = readFileSync(path, "utf-8");
  if (
    text.includes(
      "uses the shared DataGrid resize contract while clipping long confirmation codes"
    )
  ) {
    return;
  }

  const start = `  it("lets users resize register columns while clipping long confirmation codes", async () => {`;
  const end = `  it("shows a project overview computed from the existing confirmation list", async () => {`;
  const replacement = `  it("uses the shared DataGrid resize contract while clipping long confirmation codes", async () => {\n    const longCode = "TEST_20260616_1-LEGACY-3-HSBC-HONGKONG-001";\n    mockApi.projectConfirmations.mockResolvedValue([\n      confirmation({ confirmationCode: longCode }),\n    ]);\n    renderPanel();\n\n    const grid = await screen.findByTestId("confirmation-register-data-grid");\n    const code = within(grid).getByText(longCode);\n    expect(code).toHaveClass("truncate");\n    expect(code).toHaveAttribute("aria-label", longCode);\n\n    const resizeHandle = within(grid).getByRole("separator", {\n      name: "Resize Confirmation no. column",\n    });\n    expect(resizeHandle).toHaveAttribute("aria-valuenow", "200");\n    expect(resizeHandle).toHaveAttribute("aria-orientation", "vertical");\n    expect(resizeHandle).toHaveAttribute("tabindex", "0");\n\n    fireEvent.keyDown(resizeHandle, { key: "ArrowRight" });\n    await waitFor(() =>\n      expect(resizeHandle).toHaveAttribute("aria-valuenow", "216")\n    );\n    expect(\n      within(grid).getByRole("button", { name: "Filter Counterparty" })\n    ).toBeVisible();\n  });\n\n  it("keeps the shared confirmation DataGrid inside the right scroll owner", async () => {\n    mockApi.projectConfirmations.mockResolvedValue([confirmation()]);\n    renderPanel();\n\n    const grid = await screen.findByTestId("confirmation-register-data-grid");\n    expect(screen.getByRole("main")).toHaveClass("overflow-y-auto");\n    expect(within(grid).getByRole("table")).toBeVisible();\n    expect(\n      within(grid).getByRole("columnheader", { name: "Counterparty" })\n    ).toBeVisible();\n  });\n\n`;

  text = replaceRange(
    text,
    start,
    end,
    replacement,
    "project confirmation custom resize tests"
  );
  writeFileSync(path, text);
}

function migrateResponseWarehouseTests() {
  const path =
    "apps/emp/src/components/confirmation-response-warehouse.test.tsx";
  let text = readFileSync(path, "utf-8");
  if (
    text.includes(
      "uses one DataGrid toolbar and opens the selected file in the preview pane"
    )
  ) {
    return;
  }

  const start = `  it("uses a compact toolbar and opens the selected file in the preview pane", async () => {`;
  const end = `  it("offers a filter for every non-action column", async () => {`;
  const replacement = `  it("uses one DataGrid toolbar and opens the selected file in the preview pane", async () => {\n    renderWarehouse();\n\n    const toolbar = await screen.findByTestId(\n      "confirmation-response-warehouse-toolbar"\n    );\n    expect(\n      within(toolbar).getByRole("heading", { name: "Response warehouse" })\n    ).toBeVisible();\n    expect(within(toolbar).getByText("1 responses")).toBeVisible();\n    expect(\n      within(toolbar).getByRole("button", { name: "Upload response" })\n    ).toBeVisible();\n\n    fireEvent.click(\n      await screen.findByText("2025 confirmation response register")\n    );\n    expect(\n      screen.getByRole("region", {\n        name: "Preview: 2025 confirmation response register",\n      })\n    ).toBeVisible();\n  });\n\n  it("uses the shared DataGrid resize surface for warehouse columns", async () => {\n    renderWarehouse();\n\n    await screen.findByText("2025 confirmation response register");\n    const grid = screen.getByTestId("confirmation-response-warehouse-data-grid");\n    expect(within(grid).getByRole("table")).toBeVisible();\n    const resizeHandle = within(grid).getByRole("separator", {\n      name: "Resize Response code column",\n    });\n    expect(resizeHandle).toHaveAttribute("aria-valuenow", "190");\n    fireEvent.keyDown(resizeHandle, { key: "ArrowRight" });\n    await waitFor(() =>\n      expect(resizeHandle).toHaveAttribute("aria-valuenow", "206")\n    );\n  });\n\n`;

  text = replaceRange(
    text,
    start,
    end,
    replacement,
    "response warehouse legacy toolbar tests"
  );
  writeFileSync(path, text);
}

function migrateTemplateLibraryTests() {
  const path =
    "apps/emp/src/components/project-confirmation-template-library.test.tsx";
  let text = readFileSync(path, "utf-8");
  if (text.includes('toHaveAttribute("data-preview-open", "true")')) {
    return;
  }

  const before = `    fireEvent.click(\n      await screen.findByRole("row", {\n        name: "Preview: Bank confirmation letter",\n      })\n    );\n\n    expect(templateLibrary).toHaveClass("rounded-l-xl", "border-r-0");\n    expect(templateLibrary).not.toHaveClass("rounded-xl");`;
  const after = `    fireEvent.click(\n      await screen.findByRole("row", {\n        name: /Bank confirmation letter/,\n      })\n    );\n\n    const grid = within(templateLibrary).getByTestId(\n      "confirmation-template-library-data-grid"\n    );\n    expect(grid.parentElement).toHaveAttribute("data-preview-open", "true");\n    expect(grid.parentElement).toHaveClass(\n      "[&_[data-slot=frame]]:rounded-r-none",\n      "[&_[data-slot=frame]]:border-r-0"\n    );`;

  text = replaceOnce(
    text,
    before,
    after,
    "template library DataGrid preview seam test"
  );
  writeFileSync(path, text);
}

function migrateImportPreviewTests() {
  const path =
    "apps/emp/src/components/confirmations/confirmation-response-warehouse.test.tsx";
  let text = readFileSync(path, "utf-8");
  if (
    text.includes("uses shared DataGrid resizing for grouped import columns")
  ) {
    return;
  }

  const start = `  it("allows grouped import columns to be resized without changing the rows", async () => {`;
  const end = `  it("uses a sliding mode indicator with a reduced-motion fallback", async () => {`;
  const replacement = `  it("uses shared DataGrid resizing for grouped import columns", async () => {\n    const client = createClient();\n    client.confirmationEmpPreview = vi\n      .fn()\n      .mockImplementation((_projectId, input) =>\n        Promise.resolve(\n          input.mode === "GROUPED"\n            ? createThreeItemGroupedPreview()\n            : createPreview(input.mode)\n        )\n      );\n\n    await renderArchive(client);\n    fireEvent.click(screen.getByRole("tab", { name: "Create folder" }));\n\n    const header = await screen.findByRole("columnheader", {\n      name: "Child code",\n    });\n    expect(header).toBeVisible();\n    const resizeHandle = screen.getByRole("separator", {\n      name: "Resize Child code column",\n    });\n    expect(resizeHandle).toHaveAttribute("aria-valuenow", "240");\n\n    fireEvent.keyDown(resizeHandle, { key: "ArrowRight" });\n    await waitFor(() =>\n      expect(resizeHandle).toHaveAttribute("aria-valuenow", "256")\n    );\n    expect(screen.getByText("HSBC Hong Kong.pdf")).toBeVisible();\n  });\n\n`;

  text = replaceRange(
    text,
    start,
    end,
    replacement,
    "confirmation import manual resize test"
  );
  writeFileSync(path, text);
}

function migrateGroupedImportToolbarSummaryTest() {
  const path =
    "apps/emp/src/components/confirmations/confirmation-response-warehouse.test.tsx";
  let text = readFileSync(path, "utf-8");
  if (text.includes('getByLabelText("Folder contents: 3")')) {
    return;
  }

  text = replaceOnce(
    text,
    `    expect(screen.getByText("To import: 3")).toBeVisible();`,
    `    expect(screen.getByLabelText("Folder contents: 3")).toBeVisible();`,
    "grouped import shared toolbar count test"
  );
  writeFileSync(path, text);
}

migrateRegisterAccessibility();
migrateResponseWarehouseSelectionAlignment();
migrateProjectConfirmationTests();
migrateResponseWarehouseTests();
migrateTemplateLibraryTests();
migrateImportPreviewTests();
migrateGroupedImportToolbarSummaryTest();
