// @vitest-environment jsdom

import { readFileSync } from "node:fs";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConfirmationTemplateLibraryFile } from "../../api/client";
import { completeWithoutResult } from "../../test/async-noop";
import { cssPercent, cssPixels } from "../../test/css-pixels";
import {
  ConfirmationTemplateWorkbench,
  snapFieldGeometry,
} from "./confirmation-template-workbench";
import type { ConfirmationTemplateWorkbenchCopy } from "./confirmation-template-workbench";

import inspectorStyles from "./confirmation-template-workbench.module.css";

function testRect(left: number, top: number, width: number, height: number) {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

vi.mock("@/components/extend/docx-viewer", () => ({
  DocxViewerPreview: ({
    autoFitWidth,
    defaultZoom,
    fileName,
    renderPageOverlay,
    src,
    zoomScale,
    onZoomScaleChange,
  }: {
    autoFitWidth?: boolean;
    defaultZoom?: number;
    fileName?: string;
    renderPageOverlay?: (input: {
      pageElement: HTMLElement;
      pageHeight: number;
      pageNumber: number;
      pageSurfaceElement: HTMLElement | null;
      pageWidth: number;
      resolveParagraphAnchor: () => Promise<{
        paragraphId?: string;
        paragraphOrdinal: number;
        paragraphText: string;
        part: "word/document.xml";
        sourceXmlSha256: string;
      } | null>;
      rotation: number;
      scale: number;
    }) => ReactNode;
    src?: string;
    zoomScale?: number;
    onZoomScaleChange?: (zoomScale: number) => void;
  }) => {
    const latePageElementRef = React.useRef<HTMLElement | null>(null);
    const latePageSurfaceElementRef = React.useRef<HTMLElement | null>(null);
    const [lateTextReady, setLateTextReady] = React.useState(false);
    if (!latePageElementRef.current) {
      latePageElementRef.current = document.createElement("div");
    }
    if (!latePageSurfaceElementRef.current) {
      latePageSurfaceElementRef.current = document.createElement("div");
    }
    const pageElement =
      fileName === "late-text.docx"
        ? latePageElementRef.current
        : document.createElement("div");
    const pageSurfaceElement =
      fileName === "late-text.docx"
        ? latePageSurfaceElementRef.current
        : document.createElement("div");
    if (!pageElement || !pageSurfaceElement) {
      throw new Error("Mock DOCX page elements were not initialized");
    }
    if (fileName === "late-text.docx") {
      pageSurfaceElement.dataset.docxPageSurface = "true";
      if (!pageElement.contains(pageSurfaceElement)) {
        pageElement.append(pageSurfaceElement);
      }
    }
    const rect = (left: number, top: number, width: number, height: number) =>
      ({
        bottom: top + height,
        height,
        left,
        right: left + width,
        top,
        width,
        x: left,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect;

    const scale = (zoomScale ?? defaultZoom ?? 100) / 100;
    Object.defineProperty(pageElement, "getBoundingClientRect", {
      configurable: true,
      value: () => rect(10, 20, 800 * scale, 1000 * scale),
    });
    Object.defineProperty(pageSurfaceElement, "getBoundingClientRect", {
      configurable: true,
      value: () => rect(10, 20, 800 * scale, 1000 * scale),
    });
    pageSurfaceElement.dataset.mockZoomScale = String(
      zoomScale ?? defaultZoom ?? 100
    );
    const hasSourceRangeParagraph =
      fileName === "table-source-range.docx" ||
      fileName === "numbered-source-range.docx" ||
      fileName === "unresolved-source-range.docx";
    if (hasSourceRangeParagraph) {
      const paragraph = document.createElement("div");
      paragraph.dataset.docxParagraphKind = "table-cell";
      paragraph.dataset.docxTableIndex = "0";
      paragraph.dataset.docxRowIndex = "0";
      paragraph.dataset.docxCellIndex = "0";
      paragraph.dataset.docxParagraphIndex = "0";
      if (fileName === "numbered-source-range.docx") {
        const label = document.createElement("span");
        label.dataset.docxNumberingLabel = "true";
        label.append("1.");
        paragraph.append(label);
      }
      paragraph.append("Account: 123456");
      Object.defineProperty(paragraph, "getBoundingClientRect", {
        configurable: true,
        value: () => rect(205, 268, 260, 45),
      });
      pageSurfaceElement.append(paragraph);
    }
    if (fileName === "unsupported-source-text.docx") {
      const unsupportedText = document.createElement("span");
      unsupportedText.append("Unmapped source text");
      pageSurfaceElement.append(unsupportedText);
    }

    React.useEffect(() => {
      if (fileName !== "late-text.docx" || lateTextReady) {
        return;
      }
      pageSurfaceElement.append("Existing document text");
      setLateTextReady(true);
    }, [fileName, lateTextReady, pageSurfaceElement]);

    return (
      <div
        data-auto-fit-width={String(autoFitWidth ?? true)}
        data-default-zoom={String(defaultZoom ?? "")}
        data-src={src}
        data-testid="mock-docx-viewer"
        data-late-text-ready={String(lateTextReady)}
        data-zoom-scale={String(zoomScale ?? defaultZoom ?? "")}
      >
        {onZoomScaleChange ? (
          <button
            aria-label="Zoom in DOCX fixture"
            data-testid="mock-docx-zoom-in"
            onClick={() => onZoomScaleChange(125)}
            type="button"
          />
        ) : null}
        {renderPageOverlay?.({
          pageElement,
          pageHeight: 1000,
          pageNumber: 1,
          pageSurfaceElement:
            fileName === "missing-page-surface.docx"
              ? null
              : pageSurfaceElement,
          pageWidth: 800,
          resolveParagraphAnchor: () =>
            Promise.resolve(
              hasSourceRangeParagraph &&
                fileName !== "unresolved-source-range.docx"
                ? {
                    paragraphId: "A1B2C3D4",
                    paragraphOrdinal: 7,
                    paragraphText: "Account: 123456",
                    part: "word/document.xml" as const,
                    sourceXmlSha256: "a".repeat(64),
                  }
                : null
            ),
          rotation: 0,
          scale: 1,
        })}
      </div>
    );
  },
}));

vi.mock("@/components/extend/pdf-viewer", () => ({
  PDFViewer: ({
    autoFitWidth,
    fileName,
    interactionMode,
    renderPageOverlay,
    src,
    textSelectionEnabled,
  }: {
    fileName?: string;
    autoFitWidth?: boolean;
    interactionMode?: "select" | "pan";
    textSelectionEnabled?: boolean;
    renderPageOverlay?: (input: {
      pageHeight: number;
      pageNumber: number;
      pageWidth: number;
      rotation: number;
      scale: number;
      textBlocks?: {
        height: number;
        width: number;
        x: number;
        y: number;
      }[];
    }) => ReactNode;
    src?: string;
  }) => {
    const isDelayedTextFixture = fileName === "delayed-text.pdf";
    const [pdfZoomScale, setPdfZoomScale] = React.useState(1);
    const [pdfTextBlocks, setPdfTextBlocks] = React.useState(() =>
      fileName === "text-alignment.pdf"
        ? [{ height: 0.03, width: 0.05, x: 0.5, y: 0.2 }]
        : []
    );

    React.useEffect(() => {
      if (!isDelayedTextFixture) {
        return;
      }
      const timeoutId = window.setTimeout(() => {
        setPdfTextBlocks([{ height: 0.03, width: 0.05, x: 0.5, y: 0.2 }]);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }, [isDelayedTextFixture]);
    React.useEffect(() => {
      if (!isDelayedTextFixture || pdfZoomScale === 1) {
        return;
      }
      const timeoutId = window.setTimeout(() => {
        setPdfTextBlocks([{ height: 0.03, width: 0.05, x: 0.6, y: 0.2 }]);
      }, 10);
      return () => window.clearTimeout(timeoutId);
    }, [isDelayedTextFixture, pdfZoomScale]);

    return (
      <div
        data-auto-fit-width={String(autoFitWidth ?? true)}
        data-file-name={fileName}
        data-interaction-mode={interactionMode}
        data-pdf-text-ready={String(pdfTextBlocks.length > 0)}
        data-pdf-zoom-scale={String(pdfZoomScale)}
        data-src={src}
        data-testid="mock-pdf-viewer"
        data-text-selection-enabled={String(textSelectionEnabled ?? true)}
      >
        {isDelayedTextFixture ? (
          <button
            aria-label="Zoom in PDF fixture"
            data-testid="mock-pdf-zoom-in"
            onClick={() => {
              setPdfZoomScale(1.25);
              setPdfTextBlocks([]);
            }}
            type="button"
          />
        ) : null}
        {renderPageOverlay?.({
          pageHeight: 1000,
          pageNumber: 1,
          pageWidth: 800,
          rotation: 0,
          scale: pdfZoomScale,
          textBlocks: pdfTextBlocks,
        })}
        {fileName === "cross-page.pdf"
          ? renderPageOverlay?.({
              pageHeight: 1000,
              pageNumber: 2,
              pageWidth: 800,
              rotation: 0,
              scale: 1,
              textBlocks: [],
            })
          : null}
      </div>
    );
  },
}));

const COPY: ConfirmationTemplateWorkbenchCopy = {
  sidebarTabs: {
    actions: "Quick actions",
    insert: "Insert",
    field: "Field",
    style: "Style",
    canvas: "Canvas",
  },
  back: "Back",
  draft: "Draft",
  disabled: "Disabled",
  enabled: "Enabled",
  enable: "Enable",
  fieldSettings: {
    addOption: "Add option",
    backgroundColor: "Background color",
    checkboxBehavior: "Checkbox behavior",
    checkboxBehaviorDescription:
      "Set the initial state and whether the checkbox must be selected.",
    copyField: "Copy field",
    defaultChecked: "Checked by default",
    defaultCheckedDescription: "New confirmations start checked.",
    defaultFill: "Information association",
    defaultFillBaseInformation: "Base information association",
    defaultFillCustom: "Custom value",
    defaultFillCustomValue: "Default content",
    defaultFillCurrentDate: "Use current date",
    defaultFillDescription:
      "Prefilled for a new confirmation; users can still edit it.",
    defaultFillInformationLibrary:
      "Confirmation information library association",
    defaultFillNone: "Not associated",
    initialValue: "Initial value",
    initialValueCustom: "Custom value",
    initialValueCustomValue: "Initial content",
    initialValueCurrentDate: "Use current date",
    initialValueDescription:
      "Optional starting value; users can still edit it.",
    initialValueNone: "No initial value",
    pasteField: "Paste field",
    binding: "Base settings link",
    bindingNone: "No link",
    informationLibraryBinding: "Link confirmation information library",
    bindings: {
      accountNumber: "Account number",
      auditorAddress: "Auditor address",
      auditorName: "Auditor name",
      authorizationAccount: "Authorization account",
      bankName: "Bank name",
      clientName: "Client Name",
      micEmail: "MIC email",
      micNameAndInitial: "MIC name and initial",
      officeDate: "Date",
      recipientAddress: "Recipient address",
      recipientName: "Recipient name",
      referenceCode: "Reference",
      picName: "PIC",
      micName: "MIC",
      reportDate: "Report Date",
      salutation: "Salutation",
      yearEndDate: "Year end date",
    },
    deleteField: "Delete field",
    deleteOption: "Delete option",
    empty: "Select a field to edit",
    bold: "Bold",
    fontFamily: "Font family",
    fontFamilyOptions: {
      "Noto Sans SC": "Noto Sans SC",
      "Noto Sans": "Noto Sans",
      "Liberation Sans": "Liberation Sans",
      "Liberation Serif": "Liberation Serif",
      Arial: "Arial",
      "Microsoft YaHei": "Microsoft YaHei",
      "Times New Roman": "Times New Roman",
    },
    fontSize: "Font size",
    fontSizeOptions: {
      "8": "8 pt",
      "10": "10 pt",
      "12": "12 pt",
      "14": "14 pt",
      "16": "16 pt",
      "18": "18 pt",
      "20": "20 pt",
      "24": "24 pt",
      "28": "28 pt",
      "32": "32 pt",
    },
    italic: "Italic",
    kind: "Field type",
    name: "Field name",
    option: "Option",
    options: "Options",
    placeholder: "Placeholder",
    preview: "Prompt preview",
    required: "Must be checked",
    requiredDescription: "Block submission until selected.",
    staticTextContent: "Text content",
    title: "Field settings",
    textColor: "Text color",
    underline: "Underline",
  },
  loading: "Loading document",
  loadError: "Unable to load document",
  preview: "Word preview",
  previewFill: "Preview form",
  readOnly: "Built-in templates are read-only",
  returnToEdit: "Back to editing",
  saveDraft: "Save draft",
  saveError: "Unable to save template design",
  saving: "Saving...",
  unsavedChangesDescription:
    "You have unsaved field changes. Leave without saving?",
  unsavedChangesTitle: "Leave without saving?",
  discardChanges: "Leave without saving",
  keepEditing: "Keep editing",
  tools: {
    alignmentTitle: "Alignment",
    checkbox: "Checkbox",
    clearSelection: "Clear selection",
    clipboardTitle: "Clipboard",
    cut: "Cut",
    date: "Date field",
    formatPainter: "Format painter",
    fontTitle: "Font",
    historyTitle: "History",
    insertTitle: "Insert fields",
    mask: "Remove source field",
    multiline: "Multiline field",
    number: "Number field",
    operationsTitle: "Actions",
    pageTitle: "Page",
    panMode: "Pan",
    fitWidth: "Fit width",
    showRuler: "Show rulers",
    radio: "Radio field",
    staticText: "Static text",
    redo: "Redo",
    select: "Dropdown field",
    selectMode: "Select",
    text: "Text field",
    title: "Tools",
    undo: "Undo",
  },
  defaults: {
    checkboxName: "Checkbox field",
    dateName: "Date field",
    maskName: "Source field",
    multilineName: "Multiline field",
    numberName: "Number field",
    option: "Option value",
    radioName: "Radio field",
    staticTextName: "Static text",
    selectName: "Dropdown field",
    textName: "Text field",
  },
  validation: {
    defaultValueType: "Custom default must match the field type",
    nameRequired: "Field name is required",
    optionRequired: "At least one option is required",
    optionUnique: "Dropdown options must be unique",
    placeholderRequired: "Field prompt is required",
  },
};

const makeTemplate = (
  overrides: Partial<ConfirmationTemplateLibraryFile> = {}
): ConfirmationTemplateLibraryFile => ({
  code: "TPL-001",
  confirmationType: "BANK",
  createdAt: "2026-08-15T00:00:00.000Z",
  designSchema: null,
  designStatus: "DRAFT",
  description: null,
  enabledAt: null,
  fileName: "bank-confirmation.docx",
  fileSize: 128,
  id: "template-1",
  isBuiltIn: false,
  mimeType:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  name: "Bank confirmation",
  updatedAt: "2026-08-15T00:00:00.000Z",
  uploadedById: "user-1",
  uploader: { id: "user-1", name: "Test User" },
  ...overrides,
});

const makeLegacyDropdownTemplate = () =>
  makeTemplate({
    designSchema: {
      version: 1,
      fields: [
        {
          height: 0.04,
          id: "legacy-dropdown",
          kind: "SELECT",
          name: "Legacy dropdown",
          options: [COPY.defaults.option],
          page: 1,
          placeholder: "Choose one",
          width: 0.3,
          x: 0.1,
          y: 0.1,
        },
      ],
    },
  });

function drawFieldAt(
  pageOverlay: HTMLElement,
  startX: number,
  startY: number,
  endX = startX + 144,
  endY = startY + 32,
  pointerId = 1
) {
  fireEvent.pointerDown(pageOverlay, {
    clientX: startX,
    clientY: startY,
    pointerId,
  });
  fireEvent.pointerMove(window, {
    clientX: endX,
    clientY: endY,
    pointerId,
  });
  fireEvent.pointerUp(window, {
    clientX: endX,
    clientY: endY,
    pointerId,
  });
}

async function chooseDefaultFill(
  _user: ReturnType<typeof userEvent.setup>,
  sourceLabel: string,
  bindingLabel: string
) {
  const trigger =
    sourceLabel === COPY.fieldSettings.defaultFillBaseInformation
      ? "template-workbench-base-information-trigger"
      : "template-workbench-information-library-trigger";
  fireEvent.click(screen.getByTestId(trigger));
  fireEvent.click(await screen.findByRole("menuitem", { name: bindingLabel }));
}

const createObjectUrl = vi.fn(() => "blob:confirmation-template");
const revokeObjectUrl = vi.fn();

describe(ConfirmationTemplateWorkbench, () => {
  let inspectorSheet: HTMLStyleElement;
  beforeEach(() => {
    // jsdom does not install Vite CSS modules. Load the actual stylesheet so
    // geometry assertions cover production rules rather than duplicated test CSS.
    inspectorSheet = document.createElement("style");
    inspectorSheet.textContent = readFileSync(
      `${import.meta.dirname}/confirmation-template-workbench.module.css`,
      "utf-8"
    ).replaceAll(
      /\.([A-Za-z_][\w-]*)\s*\{/g,
      (_selector, name: string) => `.${inspectorStyles[name]} {`
    );
    document.head.append(inspectorSheet);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrl,
    });
  });

  afterEach(() => {
    cleanup();
    inspectorSheet.remove();
    vi.clearAllMocks();
  });

  it("removes redundant ribbon captions while keeping representative controls reachable", async () => {
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate()}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );

    for (const caption of [
      COPY.tools.historyTitle,
      COPY.tools.clipboardTitle,
      COPY.tools.insertTitle,
      COPY.preview,
      COPY.tools.fontTitle,
      COPY.tools.alignmentTitle,
      COPY.tools.pageTitle,
      COPY.tools.operationsTitle,
    ]) {
      expect(
        screen.queryByText(caption, { exact: true })
      ).not.toBeInTheDocument();
    }
    for (const control of [
      COPY.tools.undo,
      COPY.tools.redo,
      COPY.fieldSettings.copyField,
      COPY.fieldSettings.pasteField,
      COPY.tools.text,
      COPY.tools.multiline,
      COPY.tools.staticText,
      COPY.tools.radio,
      COPY.tools.number,
      COPY.tools.date,
      COPY.tools.selectMode,
      COPY.tools.panMode,
      COPY.tools.fitWidth,
      COPY.tools.showRuler,
      COPY.tools.clearSelection,
    ]) {
      expect(screen.getByRole("button", { name: control })).toBeVisible();
    }
    expect(screen.getByLabelText(COPY.fieldSettings.fontFamily)).toBeVisible();
    expect(screen.getByLabelText(COPY.fieldSettings.fontSize)).toBeVisible();
  });

  it("offers only the six confirmation-focused insertion tools", async () => {
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate()}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );

    for (const label of [
      COPY.tools.text,
      COPY.tools.multiline,
      COPY.tools.staticText,
      COPY.tools.radio,
      COPY.tools.number,
      COPY.tools.date,
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeVisible();
    }
    expect(
      screen.queryByRole("button", { name: COPY.tools.checkbox })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: COPY.tools.select })
    ).not.toBeInTheDocument();
  });

  it.each([
    ["TEXT", COPY.tools.text],
    ["MULTILINE", COPY.tools.multiline],
    ["STATIC_TEXT", COPY.tools.staticText],
    ["NUMBER", COPY.tools.number],
    ["DATE", COPY.tools.date],
    ["RADIO", COPY.tools.radio],
  ] as const)(
    "creates and saves a %s field from the Ribbon",
    async (kind, label) => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockImplementation(completeWithoutResult);
      render(
        <ConfirmationTemplateWorkbench
          copy={COPY}
          loadFile={() => Promise.resolve(new Blob(["docx"]))}
          onBack={vi.fn()}
          onSave={onSave}
          template={makeTemplate()}
        />
      );

      await waitFor(() =>
        expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
      );
      await user.click(screen.getByRole("button", { name: label }));
      expect(screen.getByTestId("template-workbench-insert-group")).toHaveClass(
        "sidebar-insert"
      );
      drawFieldAt(
        screen.getByTestId("template-workbench-page-overlay"),
        210,
        270
      );
      await user.click(screen.getByRole("button", { name: COPY.saveDraft }));

      expect(onSave).toHaveBeenCalledWith({
        designSchema: expect.objectContaining({
          fields: [
            expect.objectContaining({
              kind,
              options: kind === "RADIO" ? [COPY.defaults.option] : [],
            }),
          ],
        }),
        designStatus: "DRAFT",
      });
    }
  );

  it("configures checkbox-specific default and required behavior", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                defaultChecked: false,
                height: 0.04,
                id: "legacy-checkbox",
                kind: "CHECKBOX",
                name: "Authorization",
                options: [],
                page: 1,
                placeholder: "Confirm authorization",
                required: false,
                width: 0.3,
                x: 0.1,
                y: 0.1,
              },
            ],
          },
        })}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );

    await user.click(screen.getByTestId("template-field-legacy-checkbox"));
    await user.click(
      screen.getByRole("button", { name: COPY.fieldSettings.checkboxBehavior })
    );

    expect(
      screen.getByTestId("template-workbench-checkbox-settings")
    ).toBeVisible();
    const defaultChecked = screen.getByRole("switch", {
      name: COPY.fieldSettings.defaultChecked,
    });
    const required = screen.getByRole("switch", {
      name: COPY.fieldSettings.required,
    });
    expect(defaultChecked).not.toBeChecked();
    expect(required).not.toBeChecked();

    await user.click(defaultChecked);
    await user.click(required);
    expect(defaultChecked).toBeChecked();
    expect(required).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: COPY.fieldSettings.preview })
    ).toBeChecked();

    await user.click(screen.getByRole("button", { name: COPY.saveDraft }));
    expect(onSave).toHaveBeenCalledWith({
      designSchema: expect.objectContaining({
        fields: [
          expect.objectContaining({
            defaultChecked: true,
            kind: "CHECKBOX",
            required: true,
          }),
        ],
      }),
      designStatus: "DRAFT",
    });
  });

  it("renders field settings as a dedicated right column beside the document", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.04,
                id: "field-1",
                kind: "TEXT",
                name: "Field",
                options: [],
                page: 1,
                placeholder: "Field",
                width: 0.3,
                x: 0.1,
                y: 0.1,
              },
            ],
          },
        })}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );

    await user.click(screen.getByTestId("template-field-field-1"));
    const layout = screen.getByTestId("template-workbench-content-layout");
    const inspector = screen.getByTestId("template-workbench-inspector");
    expect(layout).toHaveClass("flex", "overflow-hidden");
    expect(inspector.parentElement).toBe(layout);
    expect(inspector).toHaveClass("h-full", "shrink-0", "border-l");
    expect(inspector).not.toHaveClass("absolute", "shadow-xl");
    expect(layout.firstElementChild).toHaveClass("min-w-0", "flex-1");
    expect(screen.queryByTestId("template-workbench-inspector")).toBeVisible();
    expect(layout.firstElementChild).toHaveClass("flex-1");
  });

  it("configures radio options from the field inspector", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={makeTemplate()}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByRole("button", { name: COPY.tools.radio }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      210,
      270
    );
    expect(
      screen
        .getByTestId("template-field-prompt-field-1")
        .querySelector(".lucide-chevron-down")
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", {
        name: COPY.fieldSettings.options,
      })
    );
    fireEvent.change(screen.getByLabelText(`${COPY.fieldSettings.option} 1`), {
      target: { value: "Agree" },
    });
    await user.click(
      screen.getByRole("button", { name: COPY.fieldSettings.addOption })
    );
    fireEvent.change(screen.getByLabelText(`${COPY.fieldSettings.option} 2`), {
      target: { value: "Disagree" },
    });
    await user.click(screen.getByRole("button", { name: COPY.saveDraft }));

    expect(onSave).toHaveBeenCalledWith({
      designSchema: expect.objectContaining({
        fields: [
          expect.objectContaining({
            kind: "RADIO",
            options: ["Agree", "Disagree"],
          }),
        ],
      }),
      designStatus: "DRAFT",
    });
  });

  it("configures the current date as an editable default fill", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={makeTemplate()}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByRole("button", { name: COPY.tools.date }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      210,
      270
    );
    fireEvent.click(
      screen.getByTestId("template-workbench-default-fill-trigger")
    );
    await user.click(
      screen.getByRole("menuitem", {
        name: COPY.fieldSettings.defaultFillCurrentDate,
      })
    );
    expect(
      screen.getByTestId("template-workbench-default-fill-trigger")
    ).toHaveTextContent(COPY.fieldSettings.defaultFillCurrentDate);
    expect(
      screen.getByText(COPY.fieldSettings.initialValueDescription)
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: COPY.saveDraft }));

    expect(onSave).toHaveBeenCalledWith({
      designSchema: expect.objectContaining({
        fields: [
          expect.objectContaining({
            defaultValueSource: {
              source: "SYSTEM",
              value: "CURRENT_DATE",
            },
            kind: "DATE",
          }),
        ],
      }),
      designStatus: "DRAFT",
    });
  });

  it.each([
    ["TEXT", COPY.tools.text, "Custom text"],
    ["MULTILINE", COPY.tools.multiline, "Line one\nLine two"],
    ["NUMBER", COPY.tools.number, "123.45"],
    ["DATE", COPY.tools.date, "2027-01-15"],
    ["RADIO", COPY.tools.radio, COPY.defaults.option],
  ] as const)(
    "stores a type-safe custom default for %s",
    async (kind, toolLabel, customValue) => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockImplementation(completeWithoutResult);
      render(
        <ConfirmationTemplateWorkbench
          copy={COPY}
          loadFile={() => Promise.resolve(new Blob(["docx"]))}
          onBack={vi.fn()}
          onSave={onSave}
          template={makeTemplate()}
        />
      );
      await waitFor(() =>
        expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
      );

      await user.click(screen.getByRole("button", { name: toolLabel }));
      drawFieldAt(
        screen.getByTestId("template-workbench-page-overlay"),
        210,
        270
      );
      fireEvent.click(
        screen.getByTestId("template-workbench-default-fill-trigger")
      );
      await user.click(
        screen.getByRole("menuitem", {
          name: COPY.fieldSettings.defaultFillCustom,
        })
      );
      if (kind === "RADIO") {
        fireEvent.click(
          screen.getByLabelText(COPY.fieldSettings.initialValueCustomValue)
        );
        await user.click(
          await screen.findByRole("option", { name: customValue })
        );
      } else {
        fireEvent.change(
          screen.getByLabelText(COPY.fieldSettings.initialValueCustomValue),
          { target: { value: customValue } }
        );
      }
      await user.click(screen.getByRole("button", { name: COPY.saveDraft }));

      expect(onSave).toHaveBeenCalledWith({
        designSchema: expect.objectContaining({
          fields: [
            expect.objectContaining({
              defaultValueSource: {
                source: "CUSTOM",
                value: customValue,
              },
              kind,
            }),
          ],
        }),
        designStatus: "DRAFT",
      });
    }
  );

  it("creates formatted static text without fillable-field settings", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={makeTemplate()}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(
      screen.getByRole("button", { name: COPY.tools.staticText })
    );
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      210,
      270,
      510,
      350
    );
    fireEvent.change(
      screen.getByLabelText(COPY.fieldSettings.staticTextContent),
      {
        target: {
          value: "Please return this confirmation directly.\nThank you.",
        },
      }
    );
    await user.click(
      screen.getByRole("button", { name: COPY.fieldSettings.bold })
    );
    expect(
      screen.queryByTestId("template-workbench-default-fill-trigger")
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("template-field-prompt-field-1")
    ).toHaveTextContent("Please return this confirmation directly.");
    expect(
      screen.getByTestId("template-field-prompt-field-1")
    ).toHaveTextContent("Thank you.");
    await user.click(screen.getByRole("button", { name: COPY.saveDraft }));

    expect(onSave).toHaveBeenCalledWith({
      designSchema: expect.objectContaining({
        fields: [
          expect.objectContaining({
            kind: "STATIC_TEXT",
            placeholder:
              "Please return this confirmation directly.\nThank you.",
            textStyle: expect.objectContaining({ bold: true }),
          }),
        ],
      }),
      designStatus: "DRAFT",
    });
  });

  it("previews filling without applying defaults or saving preview values", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                defaultValueSource: {
                  source: "CUSTOM",
                  value: "Default client",
                },
                height: 0.04,
                id: "client",
                kind: "TEXT",
                name: "Client",
                options: [],
                page: 1,
                placeholder: "Client",
                width: 0.3,
                x: 0.1,
                y: 0.1,
              },
              {
                defaultValueSource: {
                  source: "SYSTEM",
                  value: "CURRENT_DATE",
                },
                height: 0.04,
                id: "date",
                kind: "DATE",
                name: "Date",
                options: [],
                page: 1,
                placeholder: "Date",
                width: 0.2,
                x: 0.1,
                y: 0.2,
              },
              {
                height: 0.06,
                id: "delivery",
                kind: "RADIO",
                name: "Delivery",
                options: ["Postal", "Electronic"],
                page: 1,
                placeholder: "Delivery",
                width: 0.3,
                x: 0.1,
                y: 0.3,
              },
              {
                height: 0.08,
                id: "notes",
                kind: "MULTILINE",
                name: "Notes",
                options: [],
                page: 1,
                placeholder: "Notes",
                width: 0.3,
                x: 0.5,
                y: 0.1,
              },
              {
                height: 0.04,
                id: "legacy-choice",
                kind: "SELECT",
                name: "Legacy choice",
                options: ["Option A", "Option B"],
                page: 1,
                placeholder: "Legacy choice",
                width: 0.3,
                x: 0.5,
                y: 0.2,
              },
              {
                height: 0.04,
                id: "approval",
                kind: "CHECKBOX",
                name: "Approval",
                options: [],
                page: 1,
                placeholder: "Approval",
                width: 0.3,
                x: 0.5,
                y: 0.3,
              },
              {
                height: 0.06,
                id: "instructions",
                kind: "STATIC_TEXT",
                name: "Instructions",
                options: [],
                page: 1,
                placeholder: "Return directly to the auditor.",
                width: 0.4,
                x: 0.1,
                y: 0.4,
              },
            ],
          },
        })}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );

    await user.click(screen.getByRole("button", { name: COPY.previewFill }));
    expect(screen.getByTestId("template-workbench-fill-preview")).toBeVisible();
    expect(screen.getByLabelText("Client")).toHaveValue("");
    expect(screen.getByLabelText("Date")).toHaveValue("");
    for (const fieldId of [
      "client",
      "date",
      "delivery",
      "notes",
      "legacy-choice",
      "approval",
    ]) {
      const frame = screen.getByTestId(`template-preview-field-${fieldId}`);
      expect(frame).toHaveClass(
        "flex",
        "items-center",
        "rounded-none",
        "border-2",
        "border-dashed",
        "border-primary/90",
        "bg-transparent"
      );
      expect(frame).not.toHaveClass(
        "rounded-sm",
        "border-primary",
        "border-success/70",
        "bg-success/5"
      );
    }
    expect(screen.getByLabelText("Client")).toHaveClass(
      "rounded-none",
      "border-0",
      "bg-transparent"
    );
    expect(screen.getByLabelText("Client")).toHaveStyle({
      lineHeight: "normal",
    });
    expect(screen.getByLabelText("Date")).toHaveStyle({
      lineHeight: "normal",
    });
    expect(screen.getByLabelText("Notes")).toHaveClass(
      "rounded-none",
      "border-0",
      "bg-transparent"
    );
    expect(screen.getByLabelText("Notes")).toHaveStyle({ lineHeight: "1" });
    expect(screen.getByRole("combobox", { name: "Legacy choice" })).toHaveClass(
      "rounded-none",
      "border-0",
      "bg-transparent",
      "py-0"
    );
    expect(screen.getByRole("combobox", { name: "Legacy choice" })).toHaveStyle(
      { height: "100%" }
    );
    const delivery = screen.getByTestId(
      "template-preview-radio-display-delivery"
    );
    expect(delivery).toHaveClass(
      "h-full",
      "rounded-none",
      "border-0",
      "bg-transparent",
      "py-0"
    );
    expect(delivery).not.toHaveClass(
      "border-success/70",
      "border-primary",
      "bg-success/5"
    );
    const deliveryMenu = screen.getByRole("button", {
      name: "Delivery options",
    });
    expect(deliveryMenu).toHaveClass(
      "right-0",
      "w-5",
      "rounded-none",
      "border-0",
      "bg-transparent"
    );
    expect(
      deliveryMenu.closest('[data-testid="template-preview-field-delivery"]')
    ).toBeInTheDocument();
    fireEvent.click(deliveryMenu);
    fireEvent.click(
      await screen.findByRole("menuitemradio", { name: "Electronic" })
    );
    expect(delivery).toHaveTextContent("Electronic");
    expect(
      screen.getByTestId("template-preview-static-instructions")
    ).toHaveTextContent("Return directly to the auditor.");
    await user.type(screen.getByLabelText("Client"), "Preview client");
    expect(screen.getByLabelText("Client")).toHaveValue("Preview client");
    expect(onSave).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: COPY.returnToEdit }));
    expect(
      screen.queryByTestId("template-workbench-fill-preview")
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: COPY.previewFill }));
    expect(screen.getByLabelText("Client")).toHaveValue("");
    expect(onSave).not.toHaveBeenCalled();
  });

  it.each(["docx", "pdf"] as const)(
    "keeps legacy %s template geometry and bindings intact across fill preview",
    async (format) => {
      const user = userEvent.setup();
      const onSave = vi.fn(() => Promise.resolve());
      const template = makeTemplate({
        fileName: `bank-confirmation.${format}`,
        mimeType:
          format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        designSchema: {
          version: 1,
          fields: [
            {
              id: "old-client",
              kind: "TEXT",
              name: "Legacy client",
              placeholder: "Customer's Name",
              page: 1,
              x: 0.1,
              y: 0.2,
              width: 0.35,
              height: 0.015,
              textAlign: "right",
              binding: "clientName",
              options: [],
            },
            {
              id: "old-date",
              kind: "DATE",
              name: "Legacy date",
              placeholder: "Date",
              page: 1,
              x: 0.6,
              y: 0.2,
              width: 0.2,
              height: 0.02,
              options: [],
            },
            {
              id: "old-number",
              kind: "NUMBER",
              name: "Legacy number",
              placeholder: "123",
              page: 1,
              x: 0.6,
              y: 0.24,
              width: 0.2,
              height: 0.02,
              options: [],
            },
            {
              id: "old-select",
              kind: "SELECT",
              name: "Legacy select",
              placeholder: "Choose",
              page: 1,
              x: 0.1,
              y: 0.3,
              width: 0.3,
              height: 0.04,
              options: ["Postal", "Electronic"],
            },
            {
              id: "other-page",
              kind: "TEXT",
              name: "Other page",
              placeholder: "Other page",
              page: 2,
              x: 0.1,
              y: 0.2,
              width: 0.3,
              height: 0.02,
              options: [],
            },
          ],
        },
      });
      const originalDesign = template.designSchema;
      if (!originalDesign) {
        throw new Error("Legacy fixture must contain a design");
      }
      const original = JSON.stringify(originalDesign);
      render(
        <ConfirmationTemplateWorkbench
          copy={COPY}
          loadFile={() =>
            Promise.resolve(
              new Blob([format === "pdf" ? "%PDF-1.7" : "docx"], {
                type: template.mimeType,
              })
            )
          }
          onBack={vi.fn()}
          onSave={onSave}
          template={template}
        />
      );
      await screen.findByTestId(`mock-${format}-viewer`);
      const editStyle = screen.getByTestId(
        "template-field-prompt-old-client"
      ).style;
      const geometry = {
        top: editStyle.top,
        left: editStyle.left,
        width: editStyle.width,
        height: editStyle.height,
      };
      await user.click(screen.getByRole("button", { name: COPY.previewFill }));
      const frame = screen.getByTestId("template-preview-field-old-client");
      expect(frame).toHaveStyle(geometry);
      expect(frame).toHaveClass("flex", "items-center");
      expect(screen.getByLabelText("Legacy client")).toHaveStyle({
        textAlign: "right",
      });
      fireEvent.change(screen.getByLabelText("Legacy client"), {
        target: { value: "Preview only" },
      });
      fireEvent.change(screen.getByLabelText("Legacy date"), {
        target: { value: "2026-09-08" },
      });
      fireEvent.change(screen.getByLabelText("Legacy number"), {
        target: { value: "12345" },
      });
      expect(screen.getByLabelText("Legacy client")).toHaveValue(
        "Preview only"
      );
      expect(screen.getByLabelText("Legacy date")).toHaveValue("2026-09-08");
      expect(screen.getByLabelText("Legacy number")).toHaveValue(12_345);
      expect(
        screen.getByRole("combobox", { name: "Legacy select" })
      ).toBeVisible();
      expect(onSave).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: COPY.returnToEdit }));
      expect(
        screen.getByTestId("template-field-prompt-old-client")
      ).toHaveStyle(geometry);
      expect(JSON.stringify(template.designSchema)).toBe(original);
      await user.click(screen.getByRole("button", { name: COPY.saveDraft }));
      expect(onSave).toHaveBeenCalledWith({
        designStatus: "DRAFT",
        designSchema: expect.objectContaining({
          version: 1,
          fields: originalDesign.fields.map((field) =>
            expect.objectContaining(field)
          ),
        }),
      });
    }
  );

  it("supports Ribbon undo, redo, and text alignment", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={makeTemplate()}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    expect(
      screen.getByRole("button", { name: COPY.tools.fitWidth })
    ).toHaveClass("sidebar-command");
    expect(
      screen.getByRole("group", { name: COPY.sidebarTabs.field })
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      210,
      270
    );

    const undo = screen.getByRole("button", { name: COPY.tools.undo });
    await waitFor(() => expect(undo).toBeEnabled());
    await user.click(undo);
    expect(
      screen.queryByTestId("template-field-field-1")
    ).not.toBeInTheDocument();

    const redo = screen.getByRole("button", { name: COPY.tools.redo });
    expect(redo).toBeEnabled();
    await user.click(redo);
    await user.click(screen.getByTestId("template-field-field-1"));
    await user.click(
      screen.getByRole("button", {
        name: `${COPY.tools.alignmentTitle}: center`,
      })
    );
    expect(screen.getByTestId("template-field-prompt-field-1")).toHaveStyle({
      justifyContent: "center",
      textAlign: "center",
    });
    await user.click(screen.getByRole("button", { name: COPY.saveDraft }));

    expect(onSave).toHaveBeenCalledWith({
      designSchema: expect.objectContaining({
        fields: [expect.objectContaining({ textAlign: "center" })],
      }),
      designStatus: "DRAFT",
    });
  });

  it("applies the format painter and cuts fields through the Ribbon", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.04,
                id: "field-1",
                kind: "TEXT",
                name: "Source style",
                options: [],
                page: 1,
                placeholder: "Source",
                textStyle: {
                  backgroundColor: "#FFF59D",
                  bold: true,
                  fontFamily: "Noto Sans SC",
                  fontSize: 14,
                  italic: false,
                  textColor: "#123456",
                  underline: false,
                },
                width: 0.2,
                x: 0.1,
                y: 0.1,
              },
              {
                height: 0.04,
                id: "field-2",
                kind: "TEXT",
                name: "Target style",
                options: [],
                page: 1,
                placeholder: "Target",
                width: 0.2,
                x: 0.4,
                y: 0.1,
              },
            ],
          },
        })}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );

    await user.click(screen.getByTestId("template-field-field-1"));
    await user.click(
      screen.getByRole("button", { name: COPY.tools.formatPainter })
    );
    await user.click(screen.getByTestId("template-field-field-2"));
    await waitFor(() =>
      expect(screen.getByTestId("template-field-prompt-field-2")).toHaveStyle({
        backgroundColor: "rgb(255, 245, 157)",
        color: "rgb(18, 52, 86)",
        fontWeight: "700",
      })
    );

    await user.click(screen.getByTestId("template-field-field-1"));
    await user.click(screen.getByRole("button", { name: COPY.tools.cut }));
    expect(
      screen.queryByTestId("template-field-field-1")
    ).not.toBeInTheDocument();
  });

  it("applies page and operations commands to the active workbench", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() =>
          Promise.resolve(new Blob(["%PDF-1.7"], { type: "application/pdf" }))
        }
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({
          fileName: "commands.pdf",
          mimeType: "application/pdf",
        })}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId("mock-pdf-viewer")).toBeVisible()
    );

    await user.click(screen.getByRole("button", { name: COPY.tools.fitWidth }));
    expect(screen.getByTestId("mock-pdf-viewer")).toHaveAttribute(
      "data-auto-fit-width",
      "true"
    );
    await user.click(
      screen.getByRole("button", { name: COPY.tools.showRuler })
    );
    expect(
      screen.getByTestId("template-workbench-horizontal-ruler")
    ).toBeVisible();
    expect(
      screen.getByTestId("template-workbench-vertical-ruler")
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      210,
      270
    );
    expect(
      screen.getByTestId("template-field-selection-box-field-1")
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: COPY.tools.clearSelection })
    );
    expect(
      screen.queryByTestId("template-field-selection-box-field-1")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("template-field-idle-box-field-1")).toBeVisible();
  });

  it("renders editable field geometry without inline styles", async () => {
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.045,
                id: "field-1",
                kind: "TEXT",
                name: "Reference",
                options: [],
                page: 1,
                placeholder: "",
                width: 0.28,
                x: 0.25,
                y: 0.25,
              },
            ],
          },
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );

    expect(screen.getByTestId("template-field-field-1")).not.toHaveAttribute(
      "style"
    );
    expect(
      screen.getByTestId("template-field-geometry-field-1")
    ).toHaveAttribute("x", "0.25");
    expect(screen.getByTestId("template-field-idle-box-field-1")).toHaveClass(
      "border-dashed",
      "border-2",
      "border-primary/90"
    );
    expect(
      screen.queryByTestId("template-field-prompt-field-1")
    ).not.toBeInTheDocument();
  });

  it("hydrates the persisted design when the template revision changes", async () => {
    const user = userEvent.setup();
    const initialTemplate = makeTemplate({
      designSchema: {
        version: 1,
        fields: [
          {
            height: 0.045,
            id: "field-1",
            kind: "TEXT",
            name: "Field",
            options: [],
            page: 1,
            placeholder: "Initial prompt",
            width: 0.28,
            x: 0.25,
            y: 0.25,
          },
        ],
      },
    });
    const { rerender } = render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={initialTemplate}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );

    rerender(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                baseInformationBinding: "bankName",
                height: 0.045,
                id: "field-1",
                informationLibraryBinding: "recipientName",
                kind: "TEXT",
                name: "Field",
                options: [],
                page: 1,
                placeholder: "Persisted prompt",
                textStyle: {
                  backgroundColor: "#FFF59D",
                  bold: true,
                  fontFamily: "Noto Sans SC",
                  fontSize: 14,
                  italic: false,
                  textColor: "#123456",
                  underline: false,
                },
                width: 0.28,
                x: 0.25,
                y: 0.25,
              },
            ],
          },
          updatedAt: "2026-08-16T00:00:00.000Z",
        })}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByTestId("template-field-prompt-field-1")
      ).toHaveTextContent("Persisted prompt")
    );
    await user.click(screen.getByTestId("template-field-field-1"));
    expect(
      screen.getByTestId("template-workbench-base-information-trigger")
    ).toHaveTextContent(
      `${COPY.fieldSettings.defaultFillBaseInformation} / ${COPY.fieldSettings.bindings.bankName}`
    );
    expect(
      screen.getByTestId("template-workbench-information-library-trigger")
    ).toHaveTextContent(
      `${COPY.fieldSettings.defaultFillInformationLibrary} / ${COPY.fieldSettings.bindings.recipientName}`
    );
    expect(screen.getByTestId("template-field-prompt-field-1")).toHaveStyle({
      backgroundColor: "rgb(255, 245, 157)",
      color: "rgb(18, 52, 86)",
      fontWeight: "700",
    });
  });

  it("renders the field prompt inside the box with proportional CJK typography", async () => {
    const user = userEvent.setup();

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      410,
      520
    );

    expect(
      screen.getByTestId("template-field-selection-box-field-1")
    ).toHaveClass("border-[3px]", "border-primary");
    expect(
      screen.getByTestId("template-field-visible-handle-bottom-right")
    ).toHaveClass("size-3.5");
    expect(
      screen.getByTestId("template-field-visible-handle-bottom-right")
        .firstElementChild
    ).toHaveStyle({ inset: "4px" });

    fireEvent.change(screen.getByLabelText(COPY.fieldSettings.placeholder), {
      target: { value: "Date" },
    });

    const geometry = screen.getByTestId("template-field-geometry-field-1");
    expect(Number(geometry.getAttribute("width"))).toBeCloseTo(0.18);
    expect(Number(geometry.getAttribute("height"))).toBeCloseTo(0.032);

    const prompt = screen.getByTestId("template-field-prompt-field-1");
    expect(prompt).toHaveTextContent("Date");
    expect(prompt).toHaveClass("text-black");
    expect(prompt).not.toHaveAttribute("textLength");
    expect(prompt).not.toHaveAttribute("lengthAdjust");
    expect(prompt.style.fontFamily).toContain("Noto Sans SC");
  });

  it("uses the prompt as the demo preview and rejects an empty prompt", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={makeTemplate()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      210,
      270
    );

    const promptInput = screen.getByLabelText(COPY.fieldSettings.placeholder);
    expect(promptInput).toHaveValue(COPY.defaults.textName);
    const fieldText = screen.getByTestId("template-field-prompt-field-1");
    expect(fieldText).toHaveTextContent(COPY.defaults.textName);
    expect(fieldText).toHaveClass("text-black");

    fireEvent.change(promptInput, { target: { value: "" } });
    await user.click(screen.getByRole("button", { name: COPY.saveDraft }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        COPY.validation.placeholderRequired
      )
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("renders a PDF template in the PDF viewer", async () => {
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["%PDF-1.7"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({
          fileName: "bank-confirmation.pdf",
          mimeType: "application/pdf",
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-pdf-viewer")).toBeVisible()
    );
    expect(screen.getByTestId("mock-pdf-viewer")).toHaveAttribute(
      "data-interaction-mode",
      "select"
    );
    fireEvent.click(
      screen.getByRole("button", { name: COPY.tools.panMode ?? "Pan" })
    );
    expect(screen.getByTestId("mock-pdf-viewer")).toHaveAttribute(
      "data-interaction-mode",
      "pan"
    );
    expect(screen.queryByTestId("mock-docx-viewer")).not.toBeInTheDocument();
  });

  it("shows the eight-handle frame while drawing the first field on a blank PDF", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() =>
          Promise.resolve(new Blob(["%PDF-1.7"], { type: "application/pdf" }))
        }
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({
          designSchema: { fields: [], version: 1 },
          fileName: "blank.pdf",
          mimeType: "application/pdf",
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-pdf-viewer")).toBeVisible()
    );
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));
    const overlay = screen.getByTestId("template-workbench-page-overlay");
    fireEvent.pointerDown(overlay, {
      clientX: 210,
      clientY: 270,
      pointerId: 11,
    });
    fireEvent.pointerMove(window, {
      clientX: 410,
      clientY: 370,
      pointerId: 11,
    });

    expect(screen.getByTestId("template-field-drawing-preview")).toBeVisible();
    expect(
      screen.getAllByTestId(/^template-field-drawing-handle-/)
    ).toHaveLength(8);
    expect(
      screen.queryByTestId("template-field-field-1")
    ).not.toBeInTheDocument();

    fireEvent.pointerUp(window, {
      clientX: 410,
      clientY: 370,
      pointerId: 11,
    });
  });

  it("uses the canonical PDF preview for a DOCX template", async () => {
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() =>
          Promise.resolve(new Blob(["%PDF-1.7"], { type: "application/pdf" }))
        }
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({
          fileName: "bank-confirmation.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-pdf-viewer")).toBeVisible()
    );
    expect(screen.getByTestId("mock-pdf-viewer")).toHaveAttribute(
      "data-file-name",
      "bank-confirmation.pdf"
    );
    expect(screen.getByTestId("mock-pdf-viewer")).toHaveAttribute(
      "data-auto-fit-width",
      "false"
    );
    expect(screen.queryByTestId("mock-docx-viewer")).not.toBeInTheDocument();
  });

  it("recognizes a canonical PDF preview when the response has no MIME type", async () => {
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["%PDF-1.7"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({ fileName: "bank-confirmation.docx" })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-pdf-viewer")).toBeVisible()
    );
    expect(screen.queryByTestId("mock-docx-viewer")).not.toBeInTheDocument();
  });

  it("allows a PDF template to be enabled after editing", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["%PDF-1.7"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={makeTemplate({
          fileName: "bank-confirmation.pdf",
          mimeType: "application/pdf",
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-pdf-viewer")).toBeVisible()
    );
    const enableButton = screen.getByRole("button", { name: COPY.enable });
    expect(enableButton).toBeEnabled();
    await user.click(enableButton);

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ designStatus: "ENABLED" })
      )
    );
  });

  it("exits field editing on a blank work-area click without losing selection or layout", async () => {
    const user = userEvent.setup();

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.032,
                id: "field-1",
                kind: "TEXT",
                name: "Date",
                options: [],
                page: 1,
                placeholder: "Date",
                width: 0.18,
                x: 0.2,
                y: 0.2,
              },
            ],
          },
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    const field = screen.getByTestId("template-field-field-1");
    await user.click(field);
    expect(field).toHaveAttribute("data-field-mode", "editing");

    const pageOverlay = screen.getByTestId("template-workbench-page-overlay");
    fireEvent.click(pageOverlay);

    expect(field).toHaveAttribute("data-field-mode", "move");
    expect(field).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByTestId("template-workbench-empty-settings")
    ).toBeInTheDocument();

    await user.click(field);
    const geometry = screen.getByTestId("template-field-geometry-field-1");
    fireEvent.pointerDown(geometry, {
      clientX: 170,
      clientY: 220,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, {
      clientX: 250,
      clientY: 320,
      pointerId: 1,
    });
    fireEvent.pointerUp(window, {
      clientX: 250,
      clientY: 320,
      pointerId: 1,
    });

    const updatedGeometry = screen.getByTestId(
      "template-field-geometry-field-1"
    );
    expect(Number(updatedGeometry.getAttribute("x"))).toBeCloseTo(0.3, 5);
    expect(Number(updatedGeometry.getAttribute("y"))).toBeCloseTo(0.3, 5);
  });

  it("shows a selection highlight without changing the field bounds", async () => {
    const user = userEvent.setup();

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.032,
                id: "field-1",
                kind: "TEXT",
                name: "Date",
                options: [],
                page: 1,
                placeholder: "Date",
                width: 0.18,
                x: 0.2,
                y: 0.2,
              },
            ],
          },
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByTestId("template-field-field-1"));

    const geometry = screen.getByTestId("template-field-geometry-field-1");
    const highlight = screen.getByTestId(
      "template-field-selection-box-field-1"
    );
    expect(highlight).toBeInTheDocument();
    expect(cssPercent(highlight.style.left) / 100).toBeCloseTo(
      Number(geometry.getAttribute("x"))
    );
    expect(cssPercent(highlight.style.top) / 100).toBeCloseTo(
      Number(geometry.getAttribute("y"))
    );
    expect(cssPercent(highlight.style.width) / 100).toBeCloseTo(
      Number(geometry.getAttribute("width"))
    );
    expect(cssPercent(highlight.style.height) / 100).toBeCloseTo(
      Number(geometry.getAttribute("height"))
    );
  });

  it("copies and pastes a selected field with a small offset", async () => {
    const user = userEvent.setup();

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.04,
                id: "field-1",
                kind: "TEXT",
                name: "Date",
                options: [],
                page: 1,
                placeholder: "Date",
                width: 0.18,
                x: 0.2,
                y: 0.2,
              },
            ],
          },
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByTestId("template-field-field-1"));
    await user.click(
      screen.getByRole("button", { name: COPY.fieldSettings.copyField })
    );
    const pasteButton = screen.getByRole("button", {
      name: COPY.fieldSettings.pasteField,
    });
    expect(pasteButton).toBeEnabled();
    await user.click(pasteButton);

    const original = screen.getByTestId("template-field-geometry-field-1");
    const pasted = screen.getByTestId("template-field-geometry-field-2");
    expect(Number(pasted.getAttribute("x"))).toBeCloseTo(
      Number(original.getAttribute("x")) + 0.02
    );
    expect(Number(pasted.getAttribute("y"))).toBeCloseTo(
      Number(original.getAttribute("y")) + 0.02
    );
    expect(screen.getByTestId("template-field-settings")).toBeInTheDocument();

    fireEvent.keyDown(window, { ctrlKey: true, key: "c" });
    fireEvent.keyDown(window, { ctrlKey: true, key: "v" });
    expect(
      screen.getByTestId("template-field-geometry-field-3")
    ).toBeInTheDocument();
  });

  it("marquee-selects fields and moves the selected group together", async () => {
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.04,
                id: "field-1",
                kind: "TEXT",
                name: "One",
                options: [],
                page: 1,
                placeholder: "One",
                width: 0.2,
                x: 0.2,
                y: 0.2,
              },
              {
                height: 0.04,
                id: "field-2",
                kind: "TEXT",
                name: "Two",
                options: [],
                page: 1,
                placeholder: "Two",
                width: 0.2,
                x: 0.2,
                y: 0.3,
              },
            ],
          },
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    const overlay = screen.getByTestId("template-workbench-page-overlay");
    fireEvent.pointerDown(overlay, {
      clientX: 100,
      clientY: 100,
      pointerId: 4,
    });
    fireEvent.pointerMove(window, { clientX: 450, clientY: 450, pointerId: 4 });
    fireEvent.pointerUp(window, { clientX: 450, clientY: 450, pointerId: 4 });

    expect(
      screen
        .getByTestId("template-workbench")
        .querySelectorAll(
          '[data-testid^="template-field-"][aria-pressed="true"]'
        )
    ).toHaveLength(2);
    expect(
      screen.queryByTestId("template-field-selection-rectangle")
    ).not.toBeInTheDocument();

    const firstGeometry = screen.getByTestId("template-field-geometry-field-1");
    const secondGeometry = screen.getByTestId(
      "template-field-geometry-field-2"
    );
    const firstX = Number(firstGeometry.getAttribute("x"));
    const secondX = Number(secondGeometry.getAttribute("x"));
    fireEvent.pointerDown(firstGeometry, {
      clientX: 180,
      clientY: 240,
      pointerId: 5,
    });
    fireEvent.pointerMove(window, { clientX: 182, clientY: 242, pointerId: 5 });
    fireEvent.pointerUp(window, { clientX: 182, clientY: 242, pointerId: 5 });

    expect(Number(firstGeometry.getAttribute("x"))).toBeCloseTo(firstX, 5);
    expect(Number(secondGeometry.getAttribute("x"))).toBeCloseTo(secondX, 5);
    expect(
      screen.getByRole("button", { name: COPY.tools.undo })
    ).toBeDisabled();

    fireEvent.pointerDown(firstGeometry, {
      clientX: 180,
      clientY: 240,
      pointerId: 6,
    });
    fireEvent.pointerMove(window, { clientX: 260, clientY: 240, pointerId: 6 });
    fireEvent.pointerUp(window, { clientX: 260, clientY: 240, pointerId: 6 });

    expect(Number(firstGeometry.getAttribute("x"))).toBeCloseTo(
      firstX + 0.1,
      4
    );
    expect(Number(secondGeometry.getAttribute("x"))).toBeCloseTo(
      secondX + 0.1,
      4
    );
  });

  it("keeps sub-threshold field moves and resizes inert", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={onBack}
        onSave={vi.fn().mockResolvedValue(null)}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.1,
                id: "field-1",
                kind: "TEXT",
                name: "Field",
                options: [],
                page: 1,
                placeholder: "Field",
                width: 0.2,
                x: 0.2,
                y: 0.2,
              },
            ],
          },
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    const geometry = screen.getByTestId("template-field-geometry-field-1");
    const initialGeometry = {
      height: geometry.getAttribute("height"),
      width: geometry.getAttribute("width"),
      x: geometry.getAttribute("x"),
      y: geometry.getAttribute("y"),
    };
    const undo = screen.getByRole("button", { name: COPY.tools.undo });
    expect(undo).toBeDisabled();

    fireEvent.pointerDown(geometry, {
      button: 0,
      clientX: 200,
      clientY: 220,
      pointerId: 31,
    });
    fireEvent.pointerMove(window, {
      clientX: 203,
      clientY: 222,
      pointerId: 31,
    });
    fireEvent.pointerUp(window, {
      clientX: 203,
      clientY: 222,
      pointerId: 31,
    });

    expect(geometry).toHaveAttribute("height", initialGeometry.height);
    expect(geometry).toHaveAttribute("width", initialGeometry.width);
    expect(geometry).toHaveAttribute("x", initialGeometry.x);
    expect(geometry).toHaveAttribute("y", initialGeometry.y);
    expect(undo).toBeDisabled();

    await user.click(screen.getByTestId("template-field-field-1"));
    const visibleHandle = screen.getByTestId(
      "template-field-visible-handle-bottom-right"
    );
    fireEvent.pointerDown(visibleHandle, {
      button: 0,
      clientX: 360,
      clientY: 320,
      pointerId: 32,
    });
    fireEvent.pointerMove(window, {
      clientX: 362,
      clientY: 322,
      pointerId: 32,
    });
    fireEvent.pointerUp(window, {
      clientX: 362,
      clientY: 322,
      pointerId: 32,
    });

    expect(geometry).toHaveAttribute("height", initialGeometry.height);
    expect(geometry).toHaveAttribute("width", initialGeometry.width);
    expect(geometry).toHaveAttribute("x", initialGeometry.x);
    expect(geometry).toHaveAttribute("y", initialGeometry.y);
    expect(undo).toBeDisabled();

    await user.click(screen.getByRole("button", { name: COPY.back }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("resizes a selected field from the corner handle", async () => {
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.1,
                id: "field-1",
                kind: "TEXT",
                name: "Date",
                options: [],
                page: 1,
                placeholder: "Date",
                width: 0.2,
                x: 0.2,
                y: 0.2,
              },
            ],
          },
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    const field = screen.getByTestId("template-field-field-1");
    fireEvent.click(field);
    const handle = screen.getByTestId("template-field-resize-handle-corner");
    expect(handle).toHaveAttribute("fill", "transparent");
    expect(handle).toHaveAttribute("stroke", "transparent");
    expect(
      screen.getAllByTestId(/^template-field-resize-handle-/)
    ).toHaveLength(8);
    expect(screen.getByTestId("template-field-move-target")).toHaveAttribute(
      "fill",
      "transparent"
    );
    const visibleHandle = screen.getByTestId(
      "template-field-visible-handle-bottom-right"
    );
    fireEvent.pointerDown(visibleHandle, {
      clientX: 200,
      clientY: 220,
      pointerId: 2,
    });
    fireEvent.pointerMove(window, { clientX: 240, clientY: 260, pointerId: 2 });

    const geometry = screen.getByTestId("template-field-geometry-field-1");
    const liveSelectionBox = screen.getByTestId(
      "template-field-selection-box-field-1"
    );
    expect(liveSelectionBox).toBeVisible();
    expect(liveSelectionBox).toHaveClass("border-[3px]", "bg-transparent");
    expect(Number(geometry.getAttribute("width"))).toBeGreaterThan(0.2);
    expect(Number(geometry.getAttribute("height"))).toBeGreaterThan(0.1);
    fireEvent.pointerUp(window, { clientX: 240, clientY: 260, pointerId: 2 });

    const beforeEdgeResize = {
      height: Number(geometry.getAttribute("height")),
      width: Number(geometry.getAttribute("width")),
      x: Number(geometry.getAttribute("x")),
      y: Number(geometry.getAttribute("y")),
    };
    const rightHandle = screen.getByTestId(
      "template-field-resize-handle-right"
    );
    fireEvent.mouseDown(rightHandle, { button: 0, clientX: 240, clientY: 260 });
    fireEvent.mouseMove(window, { clientX: 280, clientY: 260 });
    fireEvent.mouseUp(window, { clientX: 280, clientY: 260 });

    expect(Number(geometry.getAttribute("width"))).toBeGreaterThan(
      beforeEdgeResize.width
    );
    expect(Number(geometry.getAttribute("height"))).toBeCloseTo(
      beforeEdgeResize.height,
      5
    );
    expect(Number(geometry.getAttribute("x"))).toBeCloseTo(
      beforeEdgeResize.x,
      5
    );
    expect(Number(geometry.getAttribute("y"))).toBeCloseTo(
      beforeEdgeResize.y,
      5
    );
  });

  it("keeps the center movable when a field is at minimum size", async () => {
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.012,
                id: "field-1",
                kind: "TEXT",
                name: "Small",
                options: [],
                page: 1,
                placeholder: "",
                width: 0.04,
                x: 0.2,
                y: 0.2,
              },
            ],
          },
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    fireEvent.click(screen.getByTestId("template-field-field-1"));
    const moveTarget = screen.getByTestId("template-field-move-target");
    fireEvent.pointerDown(moveTarget, {
      clientX: 200,
      clientY: 220,
      pointerId: 3,
    });
    fireEvent.pointerMove(window, { clientX: 240, clientY: 260, pointerId: 3 });
    fireEvent.pointerUp(window, { clientX: 240, clientY: 260, pointerId: 3 });

    const geometry = screen.getByTestId("template-field-geometry-field-1");
    expect(Number(geometry.getAttribute("x"))).toBeGreaterThan(0.2);
    expect(Number(geometry.getAttribute("y"))).toBeGreaterThan(0.2);
    expect(Number(geometry.getAttribute("width"))).toBeCloseTo(0.04, 5);
    expect(Number(geometry.getAttribute("height"))).toBeCloseTo(0.012, 5);
  });

  it("keeps alignment guides hidden when no pointer interaction is active", async () => {
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.03,
                id: "moving-field",
                kind: "TEXT",
                name: "Moving",
                options: [],
                page: 1,
                placeholder: "",
                width: 0.2,
                x: 0.1,
                y: 0.2,
              },
              {
                height: 0.03,
                id: "peer-field",
                kind: "TEXT",
                name: "Peer",
                options: [],
                page: 1,
                placeholder: "",
                width: 0.2,
                x: 0.5,
                y: 0.2,
              },
            ],
          },
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    fireEvent.pointerMove(window, { clientX: 358, clientY: 218, pointerId: 4 });

    expect(
      screen.queryByTestId("template-field-alignment-guide-vertical")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("template-field-alignment-guide-horizontal")
    ).not.toBeInTheDocument();
  });

  it("keeps field geometry fixed when text styling changes", async () => {
    const user = userEvent.setup();

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.08,
                id: "field-1",
                kind: "TEXT",
                name: "Amount",
                options: [],
                page: 1,
                placeholder: "Amount",
                textStyle: {
                  bold: false,
                  fontFamily: "Microsoft YaHei",
                  fontSize: 14,
                  italic: false,
                  underline: false,
                },
                width: 0.5,
                x: 0.2,
                y: 0.2,
              },
            ],
          },
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByTestId("template-field-field-1"));
    const geometry = screen.getByTestId("template-field-geometry-field-1");
    const initialGeometry = {
      height: geometry.getAttribute("height"),
      width: geometry.getAttribute("width"),
      x: geometry.getAttribute("x"),
      y: geometry.getAttribute("y"),
    };
    await user.click(
      screen.getByRole("button", { name: COPY.fieldSettings.bold })
    );
    await user.click(
      screen.getByRole("button", { name: COPY.fieldSettings.underline })
    );
    await user.click(
      screen.getByRole("button", { name: COPY.fieldSettings.italic })
    );
    fireEvent.click(screen.getByLabelText(COPY.fieldSettings.fontSize));
    await user.click(
      await screen.findByRole("option", {
        name: COPY.fieldSettings.fontSizeOptions["10"],
      })
    );

    expect(geometry).toHaveAttribute("height", initialGeometry.height);
    expect(geometry).toHaveAttribute("width", initialGeometry.width);
    expect(geometry).toHaveAttribute("x", initialGeometry.x);
    expect(geometry).toHaveAttribute("y", initialGeometry.y);
  });

  it("supports Arial alongside existing template font families", async () => {
    const user = userEvent.setup();

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.032,
                id: "field-1",
                kind: "TEXT",
                name: "Date",
                options: [],
                page: 1,
                placeholder: "Date",
                width: 0.18,
                x: 0.2,
                y: 0.2,
              },
            ],
          },
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByTestId("template-field-field-1"));
    expect(screen.getByLabelText(COPY.fieldSettings.fontFamily)).toHaveClass(
      "h-6",
      "py-0"
    );
    expect(
      screen.getByRole("button", { name: COPY.fieldSettings.bold })
    ).toHaveClass("sidebar-format-command");
    await user.click(screen.getByLabelText(COPY.fieldSettings.fontFamily));
    for (const fontFamily of [
      "Noto Sans SC",
      "Noto Sans",
      "Liberation Sans",
      "Liberation Serif",
    ]) {
      await expect(
        screen.findByRole("option", { name: fontFamily })
      ).resolves.toBeVisible();
    }
    expect(screen.getByRole("option", { name: "Arial" })).toBeVisible();
    await user.click(screen.getByRole("option", { name: "Arial" }));
    expect(
      screen.getByLabelText(COPY.fieldSettings.fontFamily)
    ).toHaveTextContent("Arial");
    expect(
      screen.getByTestId("template-field-prompt-field-1").style.fontFamily
    ).toContain("Arial");
    await user.click(screen.getByLabelText(COPY.fieldSettings.fontFamily));
    expect(
      screen.queryByRole("option", { name: "Microsoft YaHei" })
    ).not.toBeInTheDocument();
  });

  it("keeps work-area field geometry fixed when the prompt changes", async () => {
    const user = userEvent.setup();

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.012,
                id: "field-1",
                kind: "TEXT",
                name: "Date",
                options: [],
                page: 1,
                placeholder: "A",
                textStyle: {
                  bold: false,
                  fontFamily: "Microsoft YaHei",
                  fontSize: 10,
                  italic: false,
                  underline: false,
                },
                width: 0.1,
                x: 0.8,
                y: 0.2,
              },
            ],
          },
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByTestId("template-field-field-1"));

    fireEvent.change(screen.getByLabelText(COPY.fieldSettings.placeholder), {
      target: {
        value: "A very long confirmation prompt that needs more room",
      },
    });
    const geometry = screen.getByTestId("template-field-geometry-field-1");
    expect(Number(geometry.getAttribute("width"))).toBeCloseTo(0.1);
    expect(Number(geometry.getAttribute("x"))).toBeCloseTo(0.8);

    const promptHeight = geometry.getAttribute("height");
    fireEvent.click(screen.getByLabelText(COPY.fieldSettings.fontSize));
    await user.click(
      await screen.findByRole("option", {
        name: COPY.fieldSettings.fontSizeOptions["14"],
      })
    );

    expect(geometry).toHaveAttribute("height", promptHeight);
    const prompt = screen.getByTestId("template-field-prompt-field-1");
    expect(cssPixels(prompt.style.fontSize)).toBeGreaterThan(0);
    expect(cssPixels(prompt.style.fontSize)).toBeLessThanOrEqual(
      (14 / 900) * 1000
    );
  });

  it("saves prompt text style and renders it in the work area", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={makeTemplate()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByRole("button", { name: COPY.tools.radio }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      210,
      270
    );
    fireEvent.change(screen.getByLabelText(COPY.fieldSettings.placeholder), {
      target: { value: "Choose bank" },
    });
    fireEvent.click(screen.getByLabelText(COPY.fieldSettings.fontSize));
    await user.click(
      await screen.findByRole("option", {
        name: COPY.fieldSettings.fontSizeOptions["14"],
      })
    );
    await user.click(
      screen.getByRole("button", { name: COPY.fieldSettings.bold })
    );
    await user.click(
      screen.getByRole("button", { name: COPY.fieldSettings.underline })
    );
    await user.click(
      screen.getByRole("button", { name: COPY.fieldSettings.italic })
    );

    const prompt = screen.getByTestId("template-field-prompt-field-1");
    await waitFor(() =>
      expect(prompt).toHaveStyle({
        fontStyle: "italic",
        fontWeight: "700",
        textDecoration: "underline",
      })
    );
    fireEvent.input(screen.getByLabelText(COPY.fieldSettings.textColor), {
      target: { value: "#123456" },
    });
    await waitFor(() =>
      expect(prompt).toHaveStyle({ color: "rgb(18, 52, 86)" })
    );
    fireEvent.input(screen.getByLabelText(COPY.fieldSettings.backgroundColor), {
      target: { value: "#fff59d" },
    });
    await waitFor(() =>
      expect(prompt).toHaveStyle({
        backgroundColor: "rgb(255, 245, 157)",
      })
    );
    expect(prompt).toHaveTextContent("Choose bank");
    expect(prompt).toHaveClass("text-black");
    expect(prompt.style.fontFamily).toContain("Noto Sans SC");
    await waitFor(() =>
      expect(prompt).toHaveStyle({
        backgroundColor: "rgb(255, 245, 157)",
        color: "rgb(18, 52, 86)",
        fontStyle: "italic",
        fontWeight: "700",
        textDecoration: "underline",
      })
    );
    expect(
      screen.queryByTestId("template-field-style-preview")
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: COPY.saveDraft }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        designSchema: expect.objectContaining({
          fields: expect.arrayContaining([
            expect.objectContaining({
              kind: "RADIO",
              textStyle: {
                backgroundColor: "#FFF59D",
                bold: true,
                fontFamily: "Noto Sans SC",
                fontSize: 14,
                italic: true,
                textColor: "#123456",
                underline: true,
              },
            }),
          ]),
        }),
      })
    );
  });

  it("creates a field from a dragged rectangle instead of a fixed click", async () => {
    const user = userEvent.setup();

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));

    const pageOverlay = screen.getByTestId("template-workbench-page-overlay");
    fireEvent.click(pageOverlay, { clientX: 210, clientY: 270 });
    expect(
      screen.queryByTestId("template-field-field-1")
    ).not.toBeInTheDocument();

    fireEvent.pointerDown(pageOverlay, {
      clientX: 210,
      clientY: 270,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, {
      clientX: 410,
      clientY: 370,
      pointerId: 1,
    });
    const drawingPreview = screen.getByTestId("template-field-drawing-preview");
    expect(drawingPreview).toHaveClass(
      "border-[3px]",
      "border-primary",
      "bg-transparent"
    );
    expect(drawingPreview).not.toHaveClass("border-dashed");
    expect(
      screen.getAllByTestId(/^template-field-drawing-handle-/)
    ).toHaveLength(8);
    expect(
      screen.getByTestId("template-field-drawing-handle-bottom-right")
        .firstElementChild
    ).toHaveClass("rounded-full", "border-primary");
    expect(cssPercent(drawingPreview.style.height)).toBeCloseTo(10);
    expect(cssPercent(drawingPreview.style.left)).toBeCloseTo(25);
    expect(cssPercent(drawingPreview.style.top)).toBeCloseTo(25);
    expect(cssPercent(drawingPreview.style.width)).toBeCloseTo(25);
    fireEvent.pointerUp(window, {
      clientX: 410,
      clientY: 370,
      pointerId: 1,
    });
    fireEvent.click(pageOverlay, { clientX: 410, clientY: 370 });
    expect(
      screen.queryByTestId("template-field-drawing-preview")
    ).not.toBeInTheDocument();

    const geometry = screen.getByTestId("template-field-geometry-field-1");
    expect(
      screen.getByTestId("template-field-selection-box-field-1")
    ).toBeVisible();
    expect(
      screen.queryByTestId("template-field-idle-box-field-1")
    ).not.toBeInTheDocument();
    expect(Number(geometry.getAttribute("x"))).toBeCloseTo(0.25);
    expect(Number(geometry.getAttribute("y"))).toBeCloseTo(0.25);
    expect(Number(geometry.getAttribute("width"))).toBeCloseTo(0.25);
    expect(Number(geometry.getAttribute("height"))).toBeCloseTo(0.1);
  });

  it("exits field drawing mode with Escape so the canvas can be dragged", async () => {
    const user = userEvent.setup();

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    const tool = screen.getByRole("button", { name: COPY.tools.text });
    await user.click(tool);
    expect(tool).toHaveAttribute("aria-pressed", "true");

    fireEvent.keyDown(window, { key: "Escape" });

    expect(tool).toHaveAttribute("aria-pressed", "false");
  });

  it("moves a selected field and does not render a resize handle", async () => {
    const user = userEvent.setup();

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      410,
      520
    );

    const field = screen.getByTestId("template-field-geometry-field-1");
    fireEvent.pointerDown(field, { clientX: 410, clientY: 520, pointerId: 1 });
    fireEvent.pointerMove(field, {
      clientX: 490,
      clientY: 620,
      pointerId: 1,
    });
    fireEvent.pointerUp(window, { clientX: 490, clientY: 620, pointerId: 1 });

    const updatedGeometry = screen.getByTestId(
      "template-field-geometry-field-1"
    );
    expect(Number(updatedGeometry.getAttribute("x"))).toBeCloseTo(0.6, 5);
    expect(Number(updatedGeometry.getAttribute("y"))).toBeCloseTo(0.6, 5);
    expect(
      screen.queryByTestId("template-field-resize-handle-field-1")
    ).not.toBeInTheDocument();
    expect(
      screen
        .getByTestId("template-workbench")
        .querySelector('[data-slot="resizable-handle"]')
    ).toBeNull();
  });

  it("persists the dragged position in the design sent for document export", async () => {
    const onSave = vi.fn().mockImplementation(completeWithoutResult);

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.05,
                id: "export-field",
                kind: "MASK",
                name: "Export field",
                options: [],
                page: 1,
                placeholder: "",
                width: 0.2,
                x: 0.1,
                y: 0.2,
              },
            ],
          },
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    fireEvent.pointerDown(
      screen.getByTestId("template-field-geometry-export-field"),
      {
        button: 0,
        clientX: 200,
        clientY: 220,
        pointerId: 17,
      }
    );
    fireEvent.pointerMove(window, {
      clientX: 280,
      clientY: 300,
      pointerId: 17,
    });
    fireEvent.pointerUp(window, { clientX: 280, clientY: 300, pointerId: 17 });

    await waitFor(() =>
      expect(
        Number(
          screen
            .getByTestId("template-field-geometry-export-field")
            .getAttribute("x")
        )
      ).toBeCloseTo(0.2, 8)
    );

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: COPY.saveDraft }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledWith({
      designSchema: expect.objectContaining({
        fields: [
          expect.objectContaining({
            id: "export-field",
            x: expect.closeTo(0.2, 5),
            y: expect.closeTo(0.28, 5),
          }),
        ],
      }),
      designStatus: "DRAFT",
    });
  });

  it("continues moving when pointer capture is unavailable", async () => {
    const user = userEvent.setup();
    const captureSpy = vi.fn(() => {
      throw new DOMException("Pointer is not active", "NotFoundError");
    });
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: captureSpy,
    });

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      410,
      520
    );

    try {
      const field = screen.getByTestId("template-field-geometry-field-1");
      fireEvent.pointerDown(field, {
        button: 0,
        clientX: 410,
        clientY: 520,
        pointerId: 1,
      });
      expect(captureSpy).not.toHaveBeenCalled();
      fireEvent.pointerMove(window, {
        clientX: 490,
        clientY: 620,
        pointerId: 1,
      });
      fireEvent.pointerUp(window, { clientX: 490, clientY: 620, pointerId: 1 });

      expect(captureSpy).toHaveBeenCalledWith(1);
      const updatedField = screen.getByTestId(
        "template-field-geometry-field-1"
      );
      expect(Number(updatedField.getAttribute("x"))).toBeCloseTo(0.6, 5);
      expect(Number(updatedField.getAttribute("y"))).toBeCloseTo(0.6, 5);
    } finally {
      delete (
        HTMLElement.prototype as unknown as { setPointerCapture?: unknown }
      ).setPointerCapture;
    }
  });

  it("moves a field with the native left mouse drag path", async () => {
    const user = userEvent.setup();

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      410,
      520
    );

    const field = screen.getByTestId("template-field-geometry-field-1");
    fireEvent.mouseDown(field, { button: 0, clientX: 410, clientY: 520 });
    fireEvent.mouseMove(window, { clientX: 490, clientY: 620 });
    fireEvent.mouseUp(window, { clientX: 490, clientY: 620 });

    const updatedField = screen.getByTestId("template-field-geometry-field-1");
    expect(Number(updatedField.getAttribute("x"))).toBeCloseTo(0.6, 5);
    expect(Number(updatedField.getAttribute("y"))).toBeCloseTo(0.6, 5);
  });

  it("accepts the left button code used by the browser drag bridge", async () => {
    const user = userEvent.setup();

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      410,
      520
    );

    const field = screen.getByTestId("template-field-geometry-field-1");
    fireEvent.pointerDown(field, {
      button: 1,
      buttons: 1,
      clientX: 410,
      clientY: 520,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, {
      buttons: 1,
      clientX: 490,
      clientY: 620,
      pointerId: 1,
    });
    fireEvent.pointerUp(window, {
      button: 1,
      clientX: 490,
      clientY: 620,
      pointerId: 1,
    });

    const updatedField = screen.getByTestId("template-field-geometry-field-1");
    expect(Number(updatedField.getAttribute("x"))).toBeCloseTo(0.6, 5);
    expect(Number(updatedField.getAttribute("y"))).toBeCloseTo(0.6, 5);
  });

  it("snaps a moving field to a nearby peer edge and shows temporary guides", async () => {
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.03,
                id: "moving-field",
                kind: "TEXT",
                name: "Moving",
                options: [],
                page: 1,
                placeholder: "",
                width: 0.2,
                x: 0.1,
                y: 0.2,
              },
              {
                height: 0.03,
                id: "peer-field",
                kind: "TEXT",
                name: "Peer",
                options: [],
                page: 1,
                placeholder: "",
                width: 0.2,
                x: 0.5,
                y: 0.2,
              },
            ],
          },
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    const field = screen.getByTestId("template-field-moving-field");
    fireEvent.pointerDown(field, { clientX: 200, clientY: 220, pointerId: 4 });
    fireEvent.pointerMove(window, { clientX: 358, clientY: 218, pointerId: 4 });

    const geometry = screen.getByTestId("template-field-geometry-moving-field");
    expect(Number(geometry.getAttribute("x"))).toBeCloseTo(0.3, 5);
    expect(Number(geometry.getAttribute("y"))).toBeCloseTo(0.2, 5);
    expect(
      screen.getByTestId("template-field-alignment-guide-vertical")
    ).toHaveAttribute("x1", "0.5");
    expect(
      screen.getByTestId("template-field-alignment-guide-horizontal")
    ).toHaveAttribute("y1", "0.2");

    fireEvent.pointerUp(window, { clientX: 358, clientY: 218, pointerId: 4 });
    expect(
      screen.queryByTestId("template-field-alignment-guide-vertical")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("template-field-alignment-guide-horizontal")
    ).not.toBeInTheDocument();
  });

  it("refreshes late document text geometry after readiness and zoom changes", async () => {
    const user = userEvent.setup();
    const rangeRect = vi
      .spyOn(Range.prototype, "getBoundingClientRect")
      .mockImplementation(function rangeRect(this: Range) {
        const pageSurface =
          this.startContainer.parentElement?.closest<HTMLElement>(
            '[data-docx-page-surface="true"]'
          );
        const zoomScale = Number(pageSurface?.dataset.mockZoomScale ?? 100);
        return zoomScale === 100
          ? testRect(410, 220, 10, 20)
          : testRect(610, 270, 12.5, 25);
      });

    try {
      render(
        <ConfirmationTemplateWorkbench
          copy={COPY}
          loadFile={() => Promise.resolve(new Blob(["docx"]))}
          onBack={vi.fn()}
          onSave={vi.fn().mockResolvedValue(null)}
          template={makeTemplate({
            fileName: "late-text.docx",
            designSchema: {
              version: 1,
              fields: [
                {
                  height: 0.03,
                  id: "moving-field",
                  kind: "TEXT",
                  name: "Moving",
                  options: [],
                  page: 1,
                  placeholder: "",
                  width: 0.2,
                  x: 0.1,
                  y: 0.2,
                },
              ],
            },
          })}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId("mock-docx-viewer")).toBeVisible();
        expect(screen.getByTestId("mock-docx-viewer")).toHaveAttribute(
          "data-late-text-ready",
          "true"
        );
      });

      const field = screen.getByTestId("template-field-moving-field");
      fireEvent.pointerDown(field, {
        clientX: 200,
        clientY: 220,
        pointerId: 41,
      });
      fireEvent.pointerMove(window, {
        clientX: 358,
        clientY: 220,
        pointerId: 41,
      });

      let geometry = screen.getByTestId("template-field-geometry-moving-field");
      expect(Number(geometry.getAttribute("x"))).toBeCloseTo(0.3, 5);
      expect(
        screen.getByTestId("template-field-alignment-guide-vertical")
      ).toHaveAttribute("x1", "0.5");
      fireEvent.pointerUp(window, {
        clientX: 358,
        clientY: 220,
        pointerId: 41,
      });

      await user.click(screen.getByTestId("mock-docx-zoom-in"));
      await waitFor(() =>
        expect(screen.getByTestId("mock-docx-viewer")).toHaveAttribute(
          "data-zoom-scale",
          "125"
        )
      );

      fireEvent.pointerDown(screen.getByTestId("template-field-moving-field"), {
        clientX: 300,
        clientY: 270,
        pointerId: 42,
      });
      fireEvent.pointerMove(window, {
        clientX: 400,
        clientY: 270,
        pointerId: 42,
      });

      geometry = screen.getByTestId("template-field-geometry-moving-field");
      expect(Number(geometry.getAttribute("x"))).toBeCloseTo(0.4, 5);
      expect(
        screen.getByTestId("template-field-alignment-guide-vertical")
      ).toHaveAttribute("x1", "0.6");
      fireEvent.pointerUp(window, {
        clientX: 400,
        clientY: 270,
        pointerId: 42,
      });
    } finally {
      rangeRect.mockRestore();
    }
  });

  it("keeps PDF engine text blocks available while dragging", async () => {
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["%PDF-1.7"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockResolvedValue(null)}
        template={makeTemplate({
          fileName: "text-alignment.pdf",
          mimeType: "application/pdf",
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.03,
                id: "moving-field",
                kind: "TEXT",
                name: "Moving",
                options: [],
                page: 1,
                placeholder: "",
                width: 0.2,
                x: 0.1,
                y: 0.2,
              },
            ],
          },
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-pdf-viewer")).toBeVisible()
    );
    const field = screen.getByTestId("template-field-moving-field");
    fireEvent.pointerDown(field, {
      clientX: 200,
      clientY: 220,
      pointerId: 51,
    });
    fireEvent.pointerMove(window, {
      clientX: 358,
      clientY: 220,
      pointerId: 51,
    });

    const geometry = screen.getByTestId("template-field-geometry-moving-field");
    expect(Number(geometry.getAttribute("x"))).toBeCloseTo(0.3, 5);
    expect(
      screen.getByTestId("template-field-alignment-guide-vertical")
    ).toHaveAttribute("x1", "0.5");
    fireEvent.pointerUp(window, {
      clientX: 358,
      clientY: 220,
      pointerId: 51,
    });
  });

  it("waits for delayed PDF text blocks again after a zoom reset", async () => {
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["%PDF-1.7"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockResolvedValue(null)}
        template={makeTemplate({
          fileName: "delayed-text.pdf",
          mimeType: "application/pdf",
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.03,
                id: "moving-field",
                kind: "TEXT",
                name: "Moving",
                options: [],
                page: 1,
                placeholder: "",
                width: 0.2,
                x: 0.1,
                y: 0.2,
              },
            ],
          },
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-pdf-viewer")).toHaveAttribute(
        "data-pdf-text-ready",
        "true"
      )
    );
    fireEvent.pointerDown(screen.getByTestId("template-field-moving-field"), {
      clientX: 200,
      clientY: 220,
      pointerId: 61,
    });
    fireEvent.pointerMove(window, {
      clientX: 358,
      clientY: 220,
      pointerId: 61,
    });
    expect(
      Number(
        screen
          .getByTestId("template-field-geometry-moving-field")
          .getAttribute("x")
      )
    ).toBeCloseTo(0.3, 5);
    fireEvent.pointerUp(window, {
      clientX: 358,
      clientY: 220,
      pointerId: 61,
    });

    // Observe the synchronous reset before this fixture's 10ms text timer.
    fireEvent.click(screen.getByTestId("mock-pdf-zoom-in"));
    expect(screen.getByTestId("mock-pdf-viewer")).toHaveAttribute(
      "data-pdf-text-ready",
      "false"
    );
    await waitFor(() =>
      expect(screen.getByTestId("mock-pdf-viewer")).toHaveAttribute(
        "data-pdf-text-ready",
        "true"
      )
    );
    fireEvent.pointerDown(screen.getByTestId("template-field-moving-field"), {
      clientX: 300,
      clientY: 220,
      pointerId: 62,
    });
    fireEvent.pointerMove(window, {
      clientX: 380,
      clientY: 220,
      pointerId: 62,
    });
    expect(
      Number(
        screen
          .getByTestId("template-field-geometry-moving-field")
          .getAttribute("x")
      )
    ).toBeCloseTo(0.4, 5);
    expect(
      screen.getByTestId("template-field-alignment-guide-vertical")
    ).toHaveAttribute("x1", "0.6");
    fireEvent.pointerUp(window, {
      clientX: 380,
      clientY: 220,
      pointerId: 62,
    });
  });

  it("does not expand height while resizing width near a lower peer", () => {
    const snapped = snapFieldGeometry(
      {
        height: 0.032,
        width: 0.16,
        x: 0.2,
        y: 0.2,
      },
      [
        {
          height: 0.032,
          width: 0.18,
          x: 0.2,
          y: 0.24,
        },
      ],
      "resize",
      ["x"]
    );

    expect(snapped.height).toBeCloseTo(0.032, 5);
  });

  it("shows horizontal guides for equal vertical spacing", async () => {
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.03,
                id: "top-field",
                kind: "TEXT",
                name: "Top",
                options: [],
                page: 1,
                placeholder: "",
                width: 0.12,
                x: 0.2,
                y: 0.1,
              },
              {
                height: 0.03,
                id: "middle-field",
                kind: "TEXT",
                name: "Middle",
                options: [],
                page: 1,
                placeholder: "",
                width: 0.12,
                x: 0.2,
                y: 0.297,
              },
              {
                height: 0.03,
                id: "bottom-field",
                kind: "TEXT",
                name: "Bottom",
                options: [],
                page: 1,
                placeholder: "",
                width: 0.12,
                x: 0.2,
                y: 0.5,
              },
            ],
          },
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    fireEvent.pointerDown(screen.getByTestId("template-field-middle-field"), {
      clientX: 170,
      clientY: 312,
      pointerId: 6,
    });
    fireEvent.pointerMove(window, { clientX: 170, clientY: 317, pointerId: 6 });

    expect(
      screen.getByTestId("template-field-alignment-guide-horizontal")
    ).toHaveAttribute("y1", "0.3");
    expect(
      screen.getByTestId("template-field-alignment-guide-horizontal-1")
    ).toHaveAttribute("y1");
    expect(
      Number(
        screen
          .getByTestId("template-field-alignment-guide-horizontal-1")
          .getAttribute("y1")
      )
    ).toBeCloseTo(0.33, 5);
    fireEvent.pointerUp(window, { clientX: 170, clientY: 317, pointerId: 6 });
  });

  it("snaps a moving field into equal spacing between peer fields", () => {
    const snapped = snapFieldGeometry(
      {
        height: 0.03,
        width: 0.1,
        x: 0.297,
        y: 0.2,
      },
      [
        {
          height: 0.03,
          width: 0.1,
          x: 0.1,
          y: 0.2,
        },
        {
          height: 0.03,
          width: 0.1,
          x: 0.5,
          y: 0.2,
        },
      ],
      "move"
    );

    expect(snapped.x).toBeCloseTo(0.3, 5);
    expect(snapped.guides).toStrictEqual(
      expect.arrayContaining([
        { axis: "vertical", position: 0.3 },
        { axis: "vertical", position: 0.4 },
      ])
    );
  });

  it("shows only the alignment guide that will actually snap", () => {
    const snapped = snapFieldGeometry(
      {
        height: 0.02,
        width: 0.12,
        x: 0.2,
        y: 0.297,
      },
      [
        {
          height: 0.06,
          width: 0.3,
          x: 0.15,
          y: 0.3,
        },
      ],
      "move"
    );

    expect(snapped.guides).toHaveLength(1);
    expect(snapped.guides[0]).toStrictEqual({
      axis: "horizontal",
      position: expect.closeTo(0.3, 5),
    });
  });

  it("prevents native text selection while a field is being dragged", async () => {
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.03,
                id: "field-1",
                kind: "TEXT",
                name: "Field",
                options: [],
                page: 1,
                placeholder: "",
                width: 0.12,
                x: 0.2,
                y: 0.2,
              },
            ],
          },
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    const field = screen.getByTestId("template-field-field-1");
    fireEvent.pointerDown(field, {
      button: 0,
      clientX: 200,
      clientY: 220,
      pointerId: 12,
    });

    const selectionStart = new Event("selectstart", {
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(selectionStart);

    expect(selectionStart.defaultPrevented).toBeTruthy();
    fireEvent.pointerUp(window, { pointerId: 12 });
  });

  it("disables PDF text selection only for the duration of field dragging", async () => {
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["%PDF-1.7"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({
          fileName: "bank-confirmation.pdf",
          mimeType: "application/pdf",
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.03,
                id: "field-1",
                kind: "TEXT",
                name: "Field",
                options: [],
                page: 1,
                placeholder: "",
                width: 0.12,
                x: 0.2,
                y: 0.2,
              },
            ],
          },
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-pdf-viewer")).toBeVisible()
    );
    const viewer = screen.getByTestId("mock-pdf-viewer");
    expect(viewer).toHaveAttribute("data-text-selection-enabled", "true");

    fireEvent.pointerDown(screen.getByTestId("template-field-field-1"), {
      button: 0,
      clientX: 200,
      clientY: 220,
      pointerId: 13,
    });
    expect(viewer).toHaveAttribute("data-text-selection-enabled", "false");

    fireEvent.pointerUp(window, { pointerId: 13 });
    expect(viewer).toHaveAttribute("data-text-selection-enabled", "true");
  });

  it("updates the default-fill summary after choosing a value", async () => {
    const user = userEvent.setup();

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.032,
                id: "field-1",
                kind: "TEXT",
                name: "Field",
                options: [],
                page: 1,
                placeholder: "Field",
                width: 0.18,
                x: 0.2,
                y: 0.2,
              },
            ],
          },
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByTestId("template-field-field-1"));

    const chooseAndAssertClosed = async (trigger: string, option: string) => {
      fireEvent.click(screen.getByLabelText(trigger));
      await user.click(await screen.findByRole("option", { name: option }));
      await waitFor(() =>
        expect(
          screen.queryByRole("option", { name: option })
        ).not.toBeInTheDocument()
      );
    };

    await chooseAndAssertClosed(
      COPY.fieldSettings.fontSize,
      COPY.fieldSettings.fontSizeOptions["14"]
    );
    await chooseDefaultFill(
      user,
      COPY.fieldSettings.defaultFillBaseInformation,
      COPY.fieldSettings.bindings.bankName
    );
    expect(
      screen.getByTestId("template-workbench-base-information-trigger")
    ).toHaveTextContent(
      `${COPY.fieldSettings.defaultFillBaseInformation} / ${COPY.fieldSettings.bindings.bankName}`
    );
  });

  it("keeps base and information-library associations independent", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.032,
                id: "field-1",
                kind: "TEXT",
                name: "Field",
                options: [],
                page: 1,
                placeholder: "Field",
                width: 0.18,
                x: 0.2,
                y: 0.2,
              },
            ],
          },
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByTestId("template-field-field-1"));

    expect(
      screen.getByText(COPY.fieldSettings.defaultFillBaseInformation, {
        exact: true,
      })
    ).toBeVisible();
    expect(
      screen.getByText(COPY.fieldSettings.defaultFillInformationLibrary, {
        exact: true,
      })
    ).toBeVisible();

    fireEvent.click(
      screen.getByTestId("template-workbench-base-information-trigger")
    );
    await user.click(
      await screen.findByRole("menuitem", {
        name: COPY.fieldSettings.bindings.bankName,
      })
    );
    fireEvent.click(
      screen.getByTestId("template-workbench-information-library-trigger")
    );
    await user.click(
      await screen.findByRole("menuitem", {
        name: COPY.fieldSettings.bindings.recipientName,
      })
    );

    await user.click(screen.getByRole("button", { name: COPY.saveDraft }));

    expect(onSave).toHaveBeenCalledWith({
      designSchema: expect.objectContaining({
        fields: [
          expect.objectContaining({
            baseInformationBinding: "bankName",
            informationLibraryBinding: "recipientName",
          }),
        ],
      }),
      designStatus: "DRAFT",
    });
    expect(onSave.mock.calls[0][0].designSchema.fields[0]).not.toHaveProperty(
      "defaultValueSource"
    );
  });

  it("loads and saves a legacy base-information association", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                defaultValueSource: {
                  binding: "bankName",
                  source: "BASE_INFORMATION",
                },
                height: 0.032,
                id: "field-1",
                kind: "TEXT",
                name: "Field",
                options: [],
                page: 1,
                placeholder: "Field",
                width: 0.18,
                x: 0.2,
                y: 0.2,
              },
            ],
          },
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByTestId("template-field-field-1"));
    expect(
      screen.getByTestId("template-workbench-base-information-trigger")
    ).toHaveTextContent(
      `${COPY.fieldSettings.defaultFillBaseInformation} / ${COPY.fieldSettings.bindings.bankName}`
    );

    await user.click(screen.getByRole("button", { name: COPY.saveDraft }));

    expect(onSave).toHaveBeenCalledWith({
      designSchema: expect.objectContaining({
        fields: [
          expect.objectContaining({
            baseInformationBinding: "bankName",
          }),
        ],
      }),
      designStatus: "DRAFT",
    });
    expect(onSave.mock.calls[0][0].designSchema.fields[0]).not.toHaveProperty(
      "defaultValueSource"
    );
  });

  it("loads and saves a legacy information-library association", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                defaultValueSource: {
                  binding: "recipientName",
                  source: "INFORMATION_LIBRARY",
                },
                height: 0.032,
                id: "field-1",
                kind: "TEXT",
                name: "Field",
                options: [],
                page: 1,
                placeholder: "Field",
                width: 0.18,
                x: 0.2,
                y: 0.2,
              },
            ],
          },
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByTestId("template-field-field-1"));
    expect(
      screen.getByTestId("template-workbench-information-library-trigger")
    ).toHaveTextContent(
      `${COPY.fieldSettings.defaultFillInformationLibrary} / ${COPY.fieldSettings.bindings.recipientName}`
    );

    await user.click(screen.getByRole("button", { name: COPY.saveDraft }));

    expect(onSave).toHaveBeenCalledWith({
      designSchema: expect.objectContaining({
        fields: [
          expect.objectContaining({
            informationLibraryBinding: "recipientName",
          }),
        ],
      }),
      designStatus: "DRAFT",
    });
    expect(onSave.mock.calls[0][0].designSchema.fields[0]).not.toHaveProperty(
      "defaultValueSource"
    );
  });

  it("does not serialize direct associations under the wrong source", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                baseInformationBinding: "recipientName",
                height: 0.032,
                id: "field-1",
                informationLibraryBinding: "accountNumber",
                kind: "TEXT",
                name: "Field",
                options: [],
                page: 1,
                placeholder: "Field",
                width: 0.18,
                x: 0.2,
                y: 0.2,
              },
            ],
          },
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByTestId("template-field-field-1"));
    expect(
      screen.getByTestId("template-workbench-base-information-trigger")
    ).toHaveTextContent(COPY.fieldSettings.defaultFillNone);
    expect(
      screen.getByTestId("template-workbench-information-library-trigger")
    ).toHaveTextContent(COPY.fieldSettings.defaultFillNone);
    await user.click(screen.getByRole("button", { name: COPY.saveDraft }));

    const [savedField] = onSave.mock.calls[0][0].designSchema.fields;
    expect(savedField).not.toHaveProperty("baseInformationBinding");
    expect(savedField).not.toHaveProperty("informationLibraryBinding");
  });

  it("keeps associations and editable initial values independent", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={makeTemplate()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      210,
      270
    );

    await chooseDefaultFill(
      user,
      COPY.fieldSettings.defaultFillBaseInformation,
      COPY.fieldSettings.bindings.bankName
    );
    fireEvent.click(
      screen.getByTestId("template-workbench-default-fill-trigger")
    );
    await user.click(
      screen.getByRole("menuitem", {
        name: COPY.fieldSettings.defaultFillCustom,
      })
    );
    fireEvent.change(
      screen.getByLabelText(COPY.fieldSettings.initialValueCustomValue),
      { target: { value: "Initial client" } }
    );

    expect(
      screen.getByTestId("template-workbench-base-information-trigger")
    ).toHaveTextContent(
      `${COPY.fieldSettings.defaultFillBaseInformation} / ${COPY.fieldSettings.bindings.bankName}`
    );

    await chooseDefaultFill(
      user,
      COPY.fieldSettings.defaultFillBaseInformation,
      COPY.fieldSettings.bindings.bankName
    );
    expect(
      screen.getByTestId("template-workbench-default-fill-trigger")
    ).toHaveTextContent(COPY.fieldSettings.initialValueCustom);

    await user.click(screen.getByRole("button", { name: COPY.saveDraft }));

    expect(onSave).toHaveBeenCalledWith({
      designSchema: expect.objectContaining({
        fields: [
          expect.objectContaining({
            baseInformationBinding: "bankName",
            defaultValueSource: {
              source: "CUSTOM",
              value: "Initial client",
            },
          }),
        ],
      }),
      designStatus: "DRAFT",
    });
  });

  it("uses mixed text and field peers for vertical equal-spacing guides", () => {
    const snapped = snapFieldGeometry(
      {
        height: 0.03,
        width: 0.12,
        x: 0.2,
        y: 0.297,
      },
      [
        {
          height: 0.03,
          width: 0.24,
          x: 0.2,
          y: 0.1,
        },
        {
          height: 0.03,
          width: 0.18,
          x: 0.23,
          y: 0.5,
        },
      ],
      "move"
    );

    expect(snapped.y).toBeCloseTo(0.3, 5);
    expect(
      snapped.guides.some(
        (guide) =>
          guide.axis === "horizontal" && Math.abs(guide.position - 0.3) < 1e-6
      )
    ).toBeTruthy();
    expect(
      snapped.guides.some(
        (guide) =>
          guide.axis === "horizontal" && Math.abs(guide.position - 0.33) < 1e-6
      )
    ).toBeTruthy();
  });

  it("leaves field alignment to manual editing", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.03,
                id: "field-1",
                kind: "TEXT",
                name: "First field",
                options: [],
                page: 1,
                placeholder: "First",
                width: 0.12,
                x: 0.1,
                y: 0.2,
              },
              {
                height: 0.03,
                id: "field-2",
                kind: "TEXT",
                name: "Second field",
                options: [],
                page: 1,
                placeholder: "Second",
                width: 0.24,
                x: 0.5,
                y: 0.225,
              },
            ],
          },
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByTestId("template-field-field-1"));
    expect(
      screen.queryByRole("button", { name: "Auto-align page" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Align and equalize row" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Align and equalize column" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: COPY.enable }));
    expect(onSave).toHaveBeenLastCalledWith({
      designSchema: {
        fields: expect.arrayContaining([
          expect.objectContaining({
            id: "field-1",
            width: 0.12,
            x: 0.1,
            y: 0.2,
          }),
          expect.objectContaining({
            id: "field-2",
            width: 0.24,
            x: 0.5,
            y: 0.225,
          }),
        ]),
        version: 1,
      },
      designStatus: "ENABLED",
    });
  });

  it("uses a controllable authoring scale instead of fitting the page to width", async () => {
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    expect(screen.getByTestId("mock-docx-viewer")).toHaveAttribute(
      "data-auto-fit-width",
      "false"
    );
    expect(screen.getByTestId("mock-docx-viewer")).toHaveAttribute(
      "data-default-zoom",
      "100"
    );
    expect(screen.getByTestId("mock-docx-viewer")).toHaveAttribute(
      "data-zoom-scale",
      "100"
    );
  });

  it("does not reload the same template when loadFile identity changes", async () => {
    const firstLoad = vi.fn().mockResolvedValue(new Blob(["first"]));
    const secondLoad = vi.fn().mockResolvedValue(new Blob(["second"]));
    const { rerender } = render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={firstLoad}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate()}
      />
    );

    await waitFor(() => expect(firstLoad).toHaveBeenCalledOnce());
    rerender(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={secondLoad}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate()}
      />
    );

    expect(secondLoad).not.toHaveBeenCalled();
  });

  it("keeps save actions disabled while the source document is loading", () => {
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => new Promise<Blob>(() => {})}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate()}
      />
    );

    expect(screen.getByLabelText(COPY.loading)).toBeVisible();
    expect(screen.getByRole("button", { name: COPY.saveDraft })).toBeDisabled();
    expect(screen.getByRole("button", { name: COPY.enable })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: COPY.tools.text })
    ).toBeDisabled();
  });

  it("keeps save actions disabled when the source document cannot load", async () => {
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.reject(new Error("document unavailable"))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate()}
      />
    );

    await waitFor(() => expect(screen.getByText(COPY.loadError)).toBeVisible());
    expect(screen.getByRole("button", { name: COPY.saveDraft })).toBeDisabled();
    expect(screen.getByRole("button", { name: COPY.enable })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: COPY.tools.text })
    ).toBeDisabled();
  });

  it("lets keyboard users place the active tool on the page", async () => {
    const user = userEvent.setup();

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));

    const pageOverlay = screen.getByTestId("template-workbench-page-overlay");
    expect(pageOverlay).toHaveAttribute("role", "button");
    pageOverlay.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByTestId("template-field-field-1")).toBeVisible();
  });

  it("normalizes legacy TEXT, MASK, and SELECT field values", async () => {
    const user = userEvent.setup();

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.045,
                id: "legacy-text",
                kind: "TEXT",
                page: 1,
                width: 0.28,
                x: 0.1,
                y: 0.1,
              },
              {
                height: 0.06,
                id: "legacy-mask",
                kind: "MASK",
                name: null,
                options: null,
                page: 1,
                placeholder: null,
                width: 0.32,
                x: 0.2,
                y: 0.2,
              },
              {
                height: 0.045,
                id: "legacy-select",
                kind: "SELECT",
                name: undefined,
                options: 42,
                page: 1,
                placeholder: undefined,
                width: 0.28,
                x: 0.3,
                y: 0.3,
              },
            ],
          } as unknown as ConfirmationTemplateLibraryFile["designSchema"],
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    expect(screen.getByTestId("template-field-legacy-text")).toBeVisible();
    expect(screen.getByTestId("template-field-legacy-mask")).toBeVisible();
    expect(screen.getByTestId("template-field-legacy-select")).toBeVisible();

    await user.click(screen.getByTestId("template-field-legacy-text"));
    expect(
      screen.queryByLabelText(COPY.fieldSettings.name)
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(COPY.fieldSettings.placeholder)).toHaveValue(
      ""
    );

    await user.click(screen.getByTestId("template-field-legacy-select"));
    expect(
      screen.queryByLabelText(`${COPY.fieldSettings.option} 1`)
    ).not.toBeInTheDocument();
  });

  it("treats a malformed legacy fields collection as empty", async () => {
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: null,
          } as unknown as ConfirmationTemplateLibraryFile["designSchema"],
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    expect(
      screen.queryByTestId("template-workbench-empty-settings")
    ).toBeVisible();
    expect(
      screen.getByRole("group", { name: COPY.sidebarTabs.field })
    ).toBeVisible();
  });

  it("avoids an existing field id when adding after a sparse id sequence", async () => {
    const user = userEvent.setup();

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.045,
                id: "field-1",
                kind: "TEXT",
                name: "First field",
                options: [],
                page: 1,
                placeholder: "",
                width: 0.28,
                x: 0.1,
                y: 0.1,
              },
              {
                height: 0.045,
                id: "field-3",
                kind: "TEXT",
                name: "Third field",
                options: [],
                page: 1,
                placeholder: "",
                width: 0.28,
                x: 0.2,
                y: 0.2,
              },
            ],
          },
        })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      410,
      520
    );

    expect(screen.getByTestId("template-field-field-4")).toBeVisible();
    expect(screen.getAllByTestId("template-field-field-3")).toHaveLength(1);
  });

  it("adds, edits, and saves a text layer as draft and enabled", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);
    const loadFile = vi
      .fn()
      .mockResolvedValue(new Blob(["docx"], { type: COPY.preview }));

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={loadFile}
        onBack={vi.fn()}
        onSave={onSave}
        template={makeTemplate()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      210,
      270
    );

    const placeholderInput = screen.getByLabelText(
      COPY.fieldSettings.placeholder
    );
    fireEvent.change(placeholderInput, {
      target: { value: "Enter reference" },
    });
    await user.click(screen.getByRole("button", { name: COPY.saveDraft }));

    expect(onSave).toHaveBeenLastCalledWith({
      designSchema: {
        version: 1,
        fields: [
          expect.objectContaining({
            kind: "TEXT",
            options: [],
            page: 1,
            placeholder: "Enter reference",
            x: 0.25,
            y: 0.25,
          }),
        ],
      },
      designStatus: "DRAFT",
    });

    await user.click(screen.getByRole("button", { name: COPY.enable }));
    expect(onSave).toHaveBeenLastCalledWith({
      designSchema: expect.objectContaining({ version: 1 }),
      designStatus: "ENABLED",
    });
  });

  it("renders a newly placed field in the native SVG layer", async () => {
    const user = userEvent.setup();

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      210,
      270
    );

    const field = screen.getByTestId("template-field-field-1");
    expect(field.tagName.toLowerCase()).toBe("g");
    expect(field.closest("foreignObject")).toBeNull();
  });

  it("saves a text field linked to a general fill value", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={makeTemplate()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      210,
      270
    );
    await chooseDefaultFill(
      user,
      COPY.fieldSettings.defaultFillBaseInformation,
      COPY.fieldSettings.bindings.accountNumber
    );
    await user.click(screen.getByRole("button", { name: COPY.saveDraft }));

    expect(onSave).toHaveBeenCalledWith({
      designSchema: {
        fields: [
          expect.objectContaining({
            baseInformationBinding: "accountNumber",
            kind: "TEXT",
          }),
        ],
        version: 1,
      },
      designStatus: "DRAFT",
    });
  });

  it("saves a text field linked to a project custom field", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        customFields={[
          {
            id: "department-1",
            name: "Contact department",
            value: "Audit team",
          },
        ]}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={makeTemplate()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      210,
      270
    );
    await chooseDefaultFill(
      user,
      COPY.fieldSettings.defaultFillBaseInformation,
      "Contact department"
    );
    await user.click(screen.getByRole("button", { name: COPY.saveDraft }));

    expect(onSave).toHaveBeenCalledWith({
      designSchema: {
        fields: [
          expect.objectContaining({
            baseInformationBinding: "custom:department-1",
            kind: "TEXT",
          }),
        ],
        version: 1,
      },
      designStatus: "DRAFT",
    });
  });

  it("updates a selected custom binding label after a global rename without losing its ID", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);

    const template = makeTemplate();
    const { rerender } = render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        generalLayout={{
          sections: [
            {
              id: "general",
              name: "General",
              fields: [{ id: "department-1", name: "Contact department" }],
            },
          ],
        }}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={template}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      210,
      270
    );
    await chooseDefaultFill(
      user,
      COPY.fieldSettings.defaultFillBaseInformation,
      "Contact department"
    );
    rerender(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        generalLayout={{
          sections: [
            {
              id: "general",
              name: "General",
              fields: [{ id: "department-1", name: "Renamed department" }],
            },
          ],
        }}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={template}
      />
    );
    expect(
      screen.getByTestId("template-workbench-base-information-trigger")
    ).toHaveTextContent("Renamed department");
    await user.click(screen.getByRole("button", { name: COPY.saveDraft }));

    expect(onSave).toHaveBeenCalledWith({
      designSchema: {
        fields: [
          expect.objectContaining({
            baseInformationBinding: "custom:department-1",
            kind: "TEXT",
          }),
        ],
        version: 1,
      },
      designStatus: "DRAFT",
    });
  });

  it("saves a text field linked to a confirmation information value", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={makeTemplate()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      210,
      270
    );
    await chooseDefaultFill(
      user,
      COPY.fieldSettings.defaultFillInformationLibrary,
      COPY.fieldSettings.bindings.recipientAddress
    );
    await user.click(screen.getByRole("button", { name: COPY.saveDraft }));

    expect(onSave).toHaveBeenCalledWith({
      designSchema: {
        fields: [
          expect.objectContaining({
            informationLibraryBinding: "recipientAddress",
            kind: "TEXT",
          }),
        ],
        version: 1,
      },
      designStatus: "DRAFT",
    });
  });

  it("saves a multiline field linked to project and confirmation information", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={makeTemplate()}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(
      screen.getByRole("button", { name: COPY.tools.multiline })
    );
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      210,
      270,
      510,
      390
    );
    await chooseDefaultFill(
      user,
      COPY.fieldSettings.defaultFillBaseInformation,
      COPY.fieldSettings.bindings.auditorAddress
    );
    await user.click(screen.getByRole("button", { name: COPY.saveDraft }));

    expect(onSave).toHaveBeenLastCalledWith({
      designSchema: {
        fields: [
          expect.objectContaining({
            baseInformationBinding: "auditorAddress",
            kind: "MULTILINE",
          }),
        ],
        version: 1,
      },
      designStatus: "DRAFT",
    });

    await chooseDefaultFill(
      user,
      COPY.fieldSettings.defaultFillInformationLibrary,
      COPY.fieldSettings.bindings.recipientAddress
    );
    await user.click(screen.getByRole("button", { name: COPY.saveDraft }));

    expect(onSave).toHaveBeenCalledWith({
      designSchema: {
        fields: [
          expect.objectContaining({
            informationLibraryBinding: "recipientAddress",
            kind: "MULTILINE",
          }),
        ],
        version: 1,
      },
      designStatus: "DRAFT",
    });
  });

  it("saves a text field defaulted from a confirmation contact and closes the menu", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={makeTemplate()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      210,
      270
    );
    await chooseDefaultFill(
      user,
      COPY.fieldSettings.defaultFillInformationLibrary,
      COPY.fieldSettings.bindings.recipientName
    );
    expect(
      screen.getByTestId("template-workbench-information-library-trigger")
    ).toHaveTextContent(
      `${COPY.fieldSettings.defaultFillInformationLibrary} / ${COPY.fieldSettings.bindings.recipientName}`
    );
    await user.click(screen.getByRole("button", { name: COPY.saveDraft }));

    expect(onSave).toHaveBeenCalledWith({
      designSchema: {
        fields: [
          expect.objectContaining({
            informationLibraryBinding: "recipientName",
            kind: "TEXT",
          }),
        ],
        version: 1,
      },
      designStatus: "DRAFT",
    });
  });

  it("opens confirmation information choices in its independent selector", async () => {
    const user = userEvent.setup();

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      210,
      270
    );
    fireEvent.click(
      screen.getByTestId("template-workbench-information-library-trigger")
    );
    const option = await screen.findByRole("menuitem", {
      name: COPY.fieldSettings.bindings.bankName,
    });
    expect(option).toBeVisible();
  });

  it("captures selected source text from a table-cell paragraph", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);
    const rangeRect = vi
      .spyOn(Range.prototype, "getBoundingClientRect")
      .mockImplementation(function rangeRect(this: Range) {
        return this.startOffset >= 9 && this.startOffset < 15
          ? testRect(230, 280, 8, 20)
          : testRect(0, 0, 0, 0);
      });

    try {
      render(
        <ConfirmationTemplateWorkbench
          copy={COPY}
          loadFile={() => Promise.resolve(new Blob(["docx"]))}
          onBack={vi.fn()}
          onSave={onSave}
          template={makeTemplate({ fileName: "table-source-range.docx" })}
        />
      );

      await waitFor(() =>
        expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
      );
      await user.click(screen.getByRole("button", { name: COPY.tools.text }));
      drawFieldAt(
        screen.getByTestId("template-workbench-page-overlay"),
        210,
        270
      );
      await user.click(screen.getByRole("button", { name: COPY.saveDraft }));

      expect(onSave).toHaveBeenCalledWith({
        designSchema: {
          fields: [
            expect.objectContaining({
              sourceRanges: [
                {
                  end: 15,
                  paragraphId: "A1B2C3D4",
                  paragraphOrdinal: 7,
                  paragraphXmlSha256: "a".repeat(64),
                  part: "word/document.xml",
                  sourceText: "123456",
                  start: 9,
                },
              ],
            }),
          ],
          version: 1,
        },
        designStatus: "DRAFT",
      });
    } finally {
      rangeRect.mockRestore();
    }
  });

  it("does not count a DOCX numbering label in the saved source range", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);
    const rangeRect = vi
      .spyOn(Range.prototype, "getBoundingClientRect")
      .mockImplementation(function rangeRect(this: Range) {
        return this.startOffset >= 9 && this.startOffset < 15
          ? testRect(230, 280, 8, 20)
          : testRect(0, 0, 0, 0);
      });

    try {
      render(
        <ConfirmationTemplateWorkbench
          copy={COPY}
          loadFile={() => Promise.resolve(new Blob(["docx"]))}
          onBack={vi.fn()}
          onSave={onSave}
          template={makeTemplate({ fileName: "numbered-source-range.docx" })}
        />
      );

      await waitFor(() =>
        expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
      );
      await user.click(screen.getByRole("button", { name: COPY.tools.text }));
      drawFieldAt(
        screen.getByTestId("template-workbench-page-overlay"),
        210,
        270
      );
      await user.click(screen.getByRole("button", { name: COPY.saveDraft }));

      expect(onSave).toHaveBeenCalledWith({
        designSchema: {
          fields: [
            expect.objectContaining({
              sourceRanges: [
                expect.objectContaining({
                  sourceText: "123456",
                  start: 9,
                }),
              ],
            }),
          ],
          version: 1,
        },
        designStatus: "DRAFT",
      });
    } finally {
      rangeRect.mockRestore();
    }
  });

  it("keeps placement when source text cannot be safely replaced", async () => {
    const user = userEvent.setup();
    const rangeRect = vi
      .spyOn(Range.prototype, "getBoundingClientRect")
      .mockImplementation(function rangeRect(this: Range) {
        return this.startOffset >= 9 && this.startOffset < 15
          ? testRect(230, 280, 8, 20)
          : testRect(0, 0, 0, 0);
      });

    try {
      render(
        <ConfirmationTemplateWorkbench
          copy={COPY}
          loadFile={() => Promise.resolve(new Blob(["docx"]))}
          onBack={vi.fn()}
          onSave={vi.fn().mockImplementation(completeWithoutResult)}
          template={makeTemplate({ fileName: "unresolved-source-range.docx" })}
        />
      );

      await waitFor(() =>
        expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
      );
      await user.click(screen.getByRole("button", { name: COPY.tools.text }));
      drawFieldAt(
        screen.getByTestId("template-workbench-page-overlay"),
        210,
        270
      );

      await waitFor(() =>
        expect(screen.getByTestId("template-field-field-1")).toBeVisible()
      );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      rangeRect.mockRestore();
    }
  });

  it("keeps placement over visible text outside the supported DOCX paragraph model", async () => {
    const user = userEvent.setup();
    const rangeRect = vi
      .spyOn(Range.prototype, "getBoundingClientRect")
      .mockImplementation(function rangeRect(this: Range) {
        return this.startOffset < 20
          ? testRect(230, 280, 8, 20)
          : testRect(0, 0, 0, 0);
      });

    try {
      render(
        <ConfirmationTemplateWorkbench
          copy={COPY}
          loadFile={() => Promise.resolve(new Blob(["docx"]))}
          onBack={vi.fn()}
          onSave={vi.fn().mockImplementation(completeWithoutResult)}
          template={makeTemplate({ fileName: "unsupported-source-text.docx" })}
        />
      );

      await waitFor(() =>
        expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
      );
      await user.click(screen.getByRole("button", { name: COPY.tools.text }));
      drawFieldAt(
        screen.getByTestId("template-workbench-page-overlay"),
        210,
        270
      );

      expect(screen.getByTestId("template-field-field-1")).toBeVisible();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      rangeRect.mockRestore();
    }
  });

  it("keeps placement until the DOCX page surface is available", async () => {
    const user = userEvent.setup();

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate({ fileName: "missing-page-surface.docx" })}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      210,
      270
    );

    expect(screen.getByTestId("template-field-field-1")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps placement over a DOCX numbering label", async () => {
    const user = userEvent.setup();
    const rangeRect = vi
      .spyOn(Range.prototype, "getBoundingClientRect")
      .mockImplementation(function rangeRect(this: Range) {
        return this.startContainer.parentElement?.closest(
          '[data-docx-numbering-label="true"]'
        )
          ? testRect(230, 280, 8, 20)
          : testRect(0, 0, 0, 0);
      });

    try {
      render(
        <ConfirmationTemplateWorkbench
          copy={COPY}
          loadFile={() => Promise.resolve(new Blob(["docx"]))}
          onBack={vi.fn()}
          onSave={vi.fn().mockImplementation(completeWithoutResult)}
          template={makeTemplate({ fileName: "numbered-source-range.docx" })}
        />
      );

      await waitFor(() =>
        expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
      );
      await user.click(screen.getByRole("button", { name: COPY.tools.text }));
      drawFieldAt(
        screen.getByTestId("template-workbench-page-overlay"),
        210,
        270
      );

      expect(screen.getByTestId("template-field-field-1")).toBeVisible();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      rangeRect.mockRestore();
    }
  });

  it("confirms before leaving when fields are dirty", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={onBack}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeTemplate()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      210,
      270
    );

    await user.click(screen.getByRole("button", { name: COPY.back }));
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByText(COPY.unsavedChangesTitle)).toBeVisible();
    expect(screen.getByText(COPY.unsavedChangesDescription)).toBeVisible();

    await user.click(screen.getByRole("button", { name: COPY.keepEditing }));
    await waitFor(() =>
      expect(
        screen.queryByText(COPY.unsavedChangesTitle)
      ).not.toBeInTheDocument()
    );
    expect(onBack).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: COPY.back }));
    await user.click(screen.getByRole("button", { name: COPY.discardChanges }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("blocks return while saving and clears dirty after a successful save", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    let resolveSave: () => void = () => {};
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        })
    );

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={onBack}
        onSave={onSave}
        template={makeTemplate()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      210,
      270
    );

    const backButton = screen.getByRole("button", { name: COPY.back });
    await user.click(screen.getByRole("button", { name: COPY.saveDraft }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(backButton).toBeDisabled();
    expect(
      screen.queryByLabelText(COPY.fieldSettings.name)
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: COPY.tools.radio, hidden: true })
    ).toBeDisabled();
    fireEvent.click(backButton);
    expect(onBack).not.toHaveBeenCalled();

    resolveSave();
    await waitFor(() => expect(backButton).not.toBeDisabled());
    await user.click(backButton);
    expect(onBack).toHaveBeenCalledOnce();
    expect(
      screen.queryByText(COPY.unsavedChangesTitle)
    ).not.toBeInTheDocument();
  });

  it("adds a dropdown layer and edits its options", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={makeLegacyDropdownTemplate()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByTestId("template-field-legacy-dropdown"));

    await user.click(
      screen.getByRole("button", {
        name: COPY.fieldSettings.options,
      })
    );
    const optionOne = screen.getByLabelText(`${COPY.fieldSettings.option} 1`);
    fireEvent.change(optionOne, { target: { value: "Yes" } });
    await user.click(
      screen.getByRole("button", { name: COPY.fieldSettings.addOption })
    );
    const optionTwo = screen.getByLabelText(`${COPY.fieldSettings.option} 2`);
    fireEvent.change(optionTwo, { target: { value: "No" } });
    await user.click(screen.getByRole("button", { name: COPY.saveDraft }));

    expect(onSave).toHaveBeenCalledWith({
      designSchema: {
        version: 1,
        fields: [
          expect.objectContaining({
            kind: "SELECT",
            options: ["Yes", "No"],
            page: 1,
          }),
        ],
      },
      designStatus: "DRAFT",
    });
  });

  it("creates a distinct default value for each dropdown option", async () => {
    const user = userEvent.setup();

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={makeLegacyDropdownTemplate()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByTestId("template-field-legacy-dropdown"));

    await user.click(
      screen.getByRole("button", {
        name: COPY.fieldSettings.options,
      })
    );
    const optionOne = screen.getByLabelText(`${COPY.fieldSettings.option} 1`);
    await user.click(
      screen.getByRole("button", { name: COPY.fieldSettings.addOption })
    );
    const optionTwo = screen.getByLabelText(`${COPY.fieldSettings.option} 2`);

    expect(optionTwo).not.toHaveValue((optionOne as HTMLInputElement).value);
    expect(
      screen.getByRole("button", {
        name: `${COPY.fieldSettings.deleteOption} 2`,
      })
    ).toBeVisible();
  });

  it("rejects duplicate dropdown option values before calling save", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={makeLegacyDropdownTemplate()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByTestId("template-field-legacy-dropdown"));
    await user.click(
      screen.getByRole("button", {
        name: COPY.fieldSettings.options,
      })
    );
    fireEvent.change(screen.getByLabelText(`${COPY.fieldSettings.option} 1`), {
      target: { value: "Same value" },
    });
    await user.click(
      screen.getByRole("button", { name: COPY.fieldSettings.addOption })
    );
    fireEvent.change(screen.getByLabelText(`${COPY.fieldSettings.option} 2`), {
      target: { value: "Same value" },
    });
    await user.click(screen.getByRole("button", { name: COPY.saveDraft }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      COPY.validation.optionUnique
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("lets built-in templates be edited and saved from a disabled state", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);
    const disabledTemplate = {
      ...makeTemplate({
        designSchema: null,
        isBuiltIn: true,
      }),
      designStatus: "DISABLED",
    } as unknown as ConfirmationTemplateLibraryFile;

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={disabledTemplate}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    expect(screen.getByText(COPY.disabled)).toBeVisible();
    expect(screen.queryByText(COPY.readOnly)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: COPY.tools.text })
    ).not.toBeDisabled();
    expect(
      screen.getByRole("button", { name: COPY.saveDraft })
    ).not.toBeDisabled();
    expect(
      screen.getByRole("button", { name: COPY.enable })
    ).not.toBeDisabled();
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      410,
      520
    );

    fireEvent.keyDown(window, { key: "Delete" });
    expect(
      screen.queryByTestId("template-field-field-1")
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      410,
      520
    );
    fireEvent.keyDown(window, { key: "Backspace" });
    expect(
      screen.queryByTestId("template-field-field-2")
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: COPY.tools.text }));
    drawFieldAt(
      screen.getByTestId("template-workbench-page-overlay"),
      410,
      520
    );
    await user.click(screen.getByRole("button", { name: COPY.saveDraft }));
    expect(onSave).toHaveBeenLastCalledWith({
      designSchema: expect.objectContaining({ version: 1 }),
      designStatus: "DRAFT",
    });
    expect(screen.getByText(COPY.draft)).toBeVisible();

    await user.click(screen.getByRole("button", { name: COPY.enable }));
    expect(onSave).toHaveBeenLastCalledWith({
      designSchema: expect.objectContaining({ version: 1 }),
      designStatus: "ENABLED",
    });
    expect(screen.getByText(COPY.enabled)).toBeVisible();
    expect(
      screen.getByText(COPY.enabled).closest('[data-slot="badge"]')
    ).toHaveClass("border-success/40", "bg-success/10", "text-success");
    expect(
      screen
        .getByText(COPY.enabled)
        .closest('[data-slot="badge"]')
        ?.querySelector(".lucide-circle-check-big")
    ).toBeVisible();
  });

  it("changes an existing field type in the inspector and restores it from the saved design", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(null);
    const template = makeLegacyDropdownTemplate();
    const retainedStyle = {
      bold: true,
      fontFamily: "Noto Sans SC",
      fontSize: 14,
      textColor: "#123456",
    };
    const retainedRanges = [
      {
        end: 15,
        paragraphId: "A1B2C3D4",
        paragraphOrdinal: 7,
        paragraphXmlSha256: "a".repeat(64),
        part: "word/document.xml",
        sourceText: "123456",
        start: 9,
      },
    ];
    if (!template.designSchema) {
      throw new Error("Expected the legacy template design fixture");
    }
    Object.assign(template.designSchema.fields[0], {
      textStyle: retainedStyle,
      textAlign: "right",
      sourceRanges: retainedRanges,
    });
    const props = {
      copy: COPY,
      loadFile: () => Promise.resolve(new Blob(["docx"])),
      onBack: vi.fn(),
      onSave,
    };
    const view = render(
      <ConfirmationTemplateWorkbench {...props} template={template} />
    );
    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByTestId("template-field-legacy-dropdown"));
    await user.click(
      screen.getByRole("combobox", { name: COPY.fieldSettings.kind })
    );
    for (const label of [
      COPY.tools.text,
      COPY.tools.multiline,
      COPY.tools.staticText,
      COPY.tools.radio,
      COPY.tools.number,
      COPY.tools.date,
    ]) {
      expect(screen.getByRole("option", { name: label })).toBeVisible();
    }
    await user.click(screen.getByRole("option", { name: COPY.tools.number }));
    expect(
      screen.getByRole("combobox", { name: COPY.fieldSettings.kind })
    ).toHaveTextContent(COPY.tools.number);
    await user.click(screen.getByRole("button", { name: COPY.saveDraft }));
    expect(onSave).toHaveBeenCalledWith({
      designStatus: "DRAFT",
      designSchema: {
        version: 1,
        fields: [
          expect.objectContaining({
            id: "legacy-dropdown",
            kind: "NUMBER",
            options: [],
            x: 0.1,
            y: 0.1,
            width: 0.3,
            height: 0.04,
          }),
        ],
      },
    });
    const savedDesign = onSave.mock.calls[0][0].designSchema;
    expect(savedDesign.fields[0]).toMatchObject({
      textStyle: retainedStyle,
      textAlign: "right",
      sourceRanges: retainedRanges,
    });
    view.unmount();
    render(
      <ConfirmationTemplateWorkbench
        {...props}
        template={{ ...template, designSchema: savedDesign }}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    await user.click(screen.getByTestId("template-field-legacy-dropdown"));
    expect(
      screen.getByRole("combobox", { name: COPY.fieldSettings.kind })
    ).toHaveTextContent(COPY.tools.number);
  });

  it("keeps a dragged field under the pointer while scrolling across pages, with one undo", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(null);
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["pdf"]))}
        onBack={vi.fn()}
        onSave={onSave}
        template={makeTemplate({
          fileName: "cross-page.pdf",
          mimeType: "application/pdf",
          designSchema: {
            version: 1,
            fields: [
              {
                id: "moving",
                kind: "TEXT",
                name: "Moving",
                placeholder: "Moving",
                page: 1,
                x: 0.1,
                y: 0.2,
                width: 0.2,
                height: 0.04,
                options: [],
              },
            ],
          },
        })}
      />
    );
    await waitFor(() =>
      expect(
        screen.getAllByTestId("template-workbench-page-overlay")
      ).toHaveLength(2)
    );
    const [page1, page2] = screen.getAllByTestId(
      "template-workbench-page-overlay"
    );
    let scroll = 0;
    Object.defineProperty(page1, "getBoundingClientRect", {
      value: () => testRect(10, 20 - scroll, 800, 1000),
    });
    Object.defineProperty(page2, "getBoundingClientRect", {
      value: () => testRect(10, 1040 - scroll, 800, 1000),
    });
    fireEvent.pointerDown(screen.getByTestId("template-field-moving"), {
      clientX: 130,
      clientY: 240,
      pointerId: 71,
      buttons: 1,
    });
    fireEvent.pointerMove(window, {
      clientX: 146,
      clientY: 240,
      pointerId: 71,
      buttons: 1,
    });
    expect(
      Number(
        screen.getByTestId("template-field-geometry-moving").getAttribute("x")
      )
    ).toBeCloseTo(0.12);
    scroll = 100;
    fireEvent.scroll(window);
    await waitFor(() =>
      expect(
        Number(
          screen.getByTestId("template-field-geometry-moving").getAttribute("y")
        )
      ).toBeCloseTo(0.3)
    );
    scroll = 1020;
    fireEvent.scroll(window);
    await waitFor(() =>
      expect(page2).toContainElement(
        screen.getByTestId("template-field-moving")
      )
    );
    expect(
      Number(
        screen.getByTestId("template-field-geometry-moving").getAttribute("y")
      )
    ).toBeCloseTo(0.2);
    fireEvent.pointerUp(window, { clientX: 146, clientY: 240, pointerId: 71 });
    await user.click(screen.getByRole("button", { name: COPY.saveDraft }));
    expect(onSave.mock.calls[0][0].designSchema.fields[0]).toMatchObject({
      id: "moving",
      page: 2,
      x: expect.closeTo(0.12, 8),
      y: 0.2,
    });
    await user.click(screen.getByRole("button", { name: COPY.tools.undo }));
    expect(page1).toContainElement(screen.getByTestId("template-field-moving"));
    expect(
      Number(
        screen.getByTestId("template-field-geometry-moving").getAttribute("x")
      )
    ).toBeCloseTo(0.1);
  });

  it("does not show a snapped guide before the drag activates", async () => {
    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["pdf"]))}
        onBack={vi.fn()}
        onSave={vi.fn()}
        template={makeTemplate({
          fileName: "text-alignment.pdf",
          mimeType: "application/pdf",
          designSchema: {
            version: 1,
            fields: [
              {
                id: "near",
                kind: "TEXT",
                name: "Near",
                placeholder: "",
                page: 1,
                x: 0.298,
                y: 0.2,
                width: 0.2,
                height: 0.03,
                options: [],
              },
            ],
          },
        })}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId("template-field-near")).toBeVisible()
    );
    fireEvent.pointerDown(screen.getByTestId("template-field-near"), {
      clientX: 300,
      clientY: 220,
      pointerId: 72,
    });
    fireEvent.pointerMove(window, {
      clientX: 301,
      clientY: 220,
      pointerId: 72,
    });
    expect(
      screen.queryByTestId("template-field-alignment-guide-vertical")
    ).not.toBeInTheDocument();
    expect(
      Number(
        screen.getByTestId("template-field-geometry-near").getAttribute("x")
      )
    ).toBeCloseTo(0.298);
    fireEvent.pointerUp(window);
  });

  it("uses pixel-scaled snap distances rather than a zoom-dependent page percentage", () => {
    const field = { x: 0.194, y: 0.7, width: 0.1, height: 0.04 };
    const peers = [{ x: 0.3, y: 0.1, width: 0.1, height: 0.04 }];
    expect(
      snapFieldGeometry(field, peers, "move", [], { x: 5 / 800, y: 5 / 1000 }).x
    ).toBeCloseTo(0.2);
    const zoomed = snapFieldGeometry(field, peers, "move", [], {
      x: 5 / 1600,
      y: 5 / 2000,
    });
    expect(zoomed.x).toBe(field.x);
    expect(zoomed.guides).toHaveLength(0);
  });

  it("defaults a built-in template without a design status to enabled", async () => {
    const template = {
      ...makeTemplate({ isBuiltIn: true }),
      designStatus: undefined,
    } as unknown as ConfirmationTemplateLibraryFile;

    render(
      <ConfirmationTemplateWorkbench
        copy={COPY}
        loadFile={() => Promise.resolve(new Blob(["docx"]))}
        onBack={vi.fn()}
        onSave={vi.fn().mockImplementation(completeWithoutResult)}
        template={template}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("mock-docx-viewer")).toBeVisible()
    );
    expect(screen.getByText(COPY.enabled)).toBeVisible();
    expect(screen.queryByText(COPY.disabled)).not.toBeInTheDocument();
  });
});
