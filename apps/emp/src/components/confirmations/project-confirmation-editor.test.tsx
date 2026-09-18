import type * as PublicUi from "@project-wing/ui";
// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render as testingLibraryRender,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, useEffect } from "react";
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { completeWithoutResult } from "@/test/async-noop";
import { requiredFixture } from "@/test/required-fixture";

import { api } from "../../api/client";
import type { ConfirmationInformationLibraryEntry } from "../../api/client";
import { defaultConfirmationsCopy as defaultProjectConfirmationsCopy } from "../../i18n/dictionaries";
import {
  getEditableConfirmationDraftPayload,
  ProjectConfirmationEditor,
} from "./project-confirmation-editor";

import styles from "./project-confirmation-editor.module.css";

vi.mock("@project-wing/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof PublicUi>()),
  StatefulMotionButton: ({
    children,
    errorText,
    icon,
    loadingText,
    size,
    state = "idle",
    successIcon,
    successText,
    ...rest
  }: {
    children: ReactNode;
    errorText?: ReactNode;
    icon?: ReactNode;
    loadingText?: ReactNode;
    size?: string;
    state?: "idle" | "loading" | "success" | "error";
    successIcon?: ReactNode;
    successText?: ReactNode;
    [key: string]: unknown;
  }) => {
    void icon;
    void size;
    void successIcon;
    const text =
      state === "loading"
        ? loadingText
        : state === "success"
          ? successText
          : state === "error"
            ? errorText
            : children;
    const buttonProps = {
      ...(rest as ButtonHTMLAttributes<HTMLButtonElement>),
      "aria-busy": state === "loading",
      "data-stateful-motion-button": "true",
      disabled:
        Boolean((rest as ButtonHTMLAttributes<HTMLButtonElement>).disabled) ||
        state === "loading",
    } as ButtonHTMLAttributes<HTMLButtonElement> & {
      "data-stateful-motion-button": string;
    };
    return createElement("button", { type: "button", ...buttonProps }, text);
  },
}));

function render(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = testingLibraryRender(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
  return {
    ...result,
    rerender: (nextUi: ReactElement) =>
      result.rerender(
        <QueryClientProvider client={queryClient}>{nextUi}</QueryClientProvider>
      ),
  };
}

vi.mock("@/components/extend/pdf-viewer", () => ({
  PDFViewer: ({
    autoFitWidth,
    defaultZoom,
    onDocumentLoadSuccess,
    renderPageOverlay,
    showToolbar = true,
    src,
    viewportGap,
  }: {
    autoFitWidth?: boolean;
    defaultZoom?: number;
    onDocumentLoadSuccess?: (count: number) => void;
    renderPageOverlay?: (input: {
      pageNumber: number;
      pageWidth: number;
      pageHeight: number;
      rotation: number;
      scale: number;
    }) => React.ReactNode;
    showToolbar?: boolean;
    src?: string;
    viewportGap?: number;
  }) => {
    useEffect(() => onDocumentLoadSuccess?.(5), [onDocumentLoadSuccess]);
    return (
      <div
        data-auto-fit-width={String(autoFitWidth ?? true)}
        data-default-zoom={String(defaultZoom ?? "")}
        data-testid="mock-pdf-viewer"
        data-show-toolbar={String(showToolbar)}
        data-src={src}
        data-viewport-gap={viewportGap}
      >
        {renderPageOverlay?.({
          pageNumber: 1,
          pageWidth: 595,
          pageHeight: 842,
          rotation: 0,
          scale: 1,
        })}
      </div>
    );
  },
}));

vi.mock("@/components/extend/docx-viewer", () => ({
  DocxViewerPreview: ({
    renderPageOverlay,
    showDownload,
    showToolbar,
    showUpload,
    src,
  }: {
    renderPageOverlay?: (input: {
      pageNumber: number;
      pageWidth: number;
      pageHeight: number;
      rotation: number;
      scale: number;
      pageElement: HTMLElement;
      pageSurfaceElement: HTMLElement;
    }) => React.ReactNode;
    showDownload?: boolean;
    showToolbar?: boolean;
    showUpload?: boolean;
    src?: string;
  }) => {
    const pageElement = document.createElement("div");
    const pageSurfaceElement = document.createElement("div");
    pageSurfaceElement.dataset.docxPageSurface = "true";
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
    Object.defineProperty(pageElement, "getBoundingClientRect", {
      value: () => rect(10, 20, 794, 1122),
    });
    Object.defineProperty(pageSurfaceElement, "getBoundingClientRect", {
      value: () => rect(10, 20, 794, 1122),
    });
    Object.defineProperty(Range.prototype, "getBoundingClientRect", {
      configurable: true,
      value: () => rect(250, 400, 160, 22),
    });
    pageSurfaceElement.append(
      "(Customer’s Name) [Recipient Name] [Recipient Address] ",
      "To The Manager Dear  Sir /   Madam ",
      "[Auditor Name] [Year end date] [Auditor Name] [Auditor Address] ",
      "[MIC Name] [Client Name] [Client’s Name] [MIC Email] ",
      "[MIC Name and Initial] [Client’s Name]"
    );
    pageElement.append(pageSurfaceElement);
    const addCell = (
      tableIndex: number,
      rowIndex: number,
      cellIndex: number,
      cellRect: DOMRect
    ) => {
      const cell = document.createElement("div");
      cell.dataset.docxTableCell = "true";
      cell.dataset.docxTableIndex = String(tableIndex);
      cell.dataset.docxRowIndex = String(rowIndex);
      cell.dataset.docxCellIndex = String(cellIndex);
      Object.defineProperty(cell, "getBoundingClientRect", {
        value: () => cellRect,
      });
      pageElement.append(cell);
    };
    const addParagraph = (
      tableIndex: number,
      rowIndex: number,
      cellIndex: number,
      paragraphIndex: number,
      text: string,
      paragraphRect: DOMRect
    ) => {
      const paragraph = document.createElement("div");
      paragraph.dataset.docxParagraphHost = "true";
      paragraph.dataset.docxParagraphKind = "table-cell";
      paragraph.dataset.docxTableIndex = String(tableIndex);
      paragraph.dataset.docxRowIndex = String(rowIndex);
      paragraph.dataset.docxCellIndex = String(cellIndex);
      paragraph.dataset.docxParagraphIndex = String(paragraphIndex);
      paragraph.append(text);
      Object.defineProperty(paragraph, "getBoundingClientRect", {
        value: () => paragraphRect,
      });
      pageElement.append(paragraph);
    };
    const addBodyParagraph = (
      nodeIndex: number,
      text: string,
      paragraphRect: DOMRect
    ) => {
      const paragraph = document.createElement("div");
      paragraph.dataset.docxParagraphHost = "true";
      paragraph.dataset.docxParagraphKind = "paragraph";
      paragraph.dataset.docxParagraphNodeIndex = String(nodeIndex);
      paragraph.append(text);
      Object.defineProperty(paragraph, "getBoundingClientRect", {
        value: () => paragraphRect,
      });
      pageElement.append(paragraph);
    };
    addCell(6, 3, 0, rect(110, 240, 250, 24));
    addCell(6, 3, 2, rect(470, 240, 260, 24));
    addCell(8, 0, 2, rect(470, 270, 260, 24));
    addCell(13, 5, 1, rect(470, 400, 260, 24));
    addParagraph(
      15,
      0,
      0,
      0,
      "our affairs with your bank as at the close of business on the reporting date For each item",
      rect(170, 600, 180, 20)
    );
    addParagraph(
      15,
      4,
      0,
      1,
      "                            (Auditor Name),",
      rect(110, 700, 220, 20)
    );
    addParagraph(
      15,
      4,
      0,
      2,
      "                            (Auditor Address).",
      rect(110, 725, 320, 20)
    );
    addParagraph(
      15,
      6,
      0,
      1,
      "                            ",
      rect(300, 770, 160, 20)
    );
    addBodyParagraph(
      0,
      "Ref:                         ",
      rect(110, 90, 360, 24)
    );
    addBodyParagraph(
      1,
      "Date:                        ",
      rect(110, 120, 360, 24)
    );
    addBodyParagraph(
      12,
      "Account number:                       ",
      rect(110, 650, 460, 24)
    );

    return (
      <div
        data-show-download={String(showDownload)}
        data-show-toolbar={String(showToolbar)}
        data-show-upload={String(showUpload)}
        data-testid="mock-docx-viewer"
        data-src={src}
      >
        {renderPageOverlay?.({
          pageElement,
          pageHeight: 1122,
          pageNumber: 1,
          pageSurfaceElement,
          pageWidth: 794,
          rotation: 0,
          scale: src === "blob:font-scale-test" ? 1.61 : 1,
        })}
      </div>
    );
  },
}));

const derivedValues = {
  balanceSheetDate: "2026-12-31",
  clientCode: "C-001",
  clientName: "Orchid Holdings",
  confirmationCode: "AUD-2026-0001-YH-001",
  contactEmail: "bonnie@example.test",
  contactName: "Bonnie Su",
  fiscalYear: "2026",
  picName: "Engagement PIC",
  projectCode: "AUD-2026-0001",
  projectName: "Orchid Holdings 2026 audit",
};

const informationLibraryEntry = {
  id: "library-entry-001",
  bankCode: "004",
  bankNameEn: "Library Bank Limited",
  bankNameZh: "函证银行有限公司",
  bankType: "Local bank",
  businessAddress: "1 Library Street",
  mailingAddress: "Library recipient address",
  mailingAddressSameAsBusiness: false,
  contactName: "Library Contact",
  attention: null,
  notes: null,
  background: null,
  historicalMailingAddress: null,
  cautions: null,
  sourceLabel: "test fixture",
  sourceRow: 1,
  isActive: true,
  effectiveMailingAddress: "Library recipient address",
  isReadyForDispatch: true,
  createdAt: "2026-08-31T00:00:00.000Z",
  updatedAt: "2026-08-31T00:00:00.000Z",
} satisfies ConfirmationInformationLibraryEntry;

const managedTemplateCodes = [
  "STANDARD_FINANCIAL_INSTITUTION",
  "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
  "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
  "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
] as const;

function renderManagedTemplate(
  templateCode: (typeof managedTemplateCodes)[number]
) {
  return render(
    <ProjectConfirmationEditor
      copy={defaultProjectConfirmationsCopy}
      derivedValues={derivedValues}
      draftPayload={{}}
      templateCode={templateCode}
      {...(templateCode === "STANDARD_FINANCIAL_INSTITUTION"
        ? { uploadedDocumentUrl: "blob:standard-preview" }
        : { uploadedDocumentDocxUrl: "blob:managed-docx-preview" })}
      onTemplateSelect={vi.fn()}
      onSave={vi.fn()}
      onSubmit={vi.fn()}
    />
  );
}

describe(ProjectConfirmationEditor, () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("shows safe download and open actions for an unsupported uploaded format", () => {
    const onDownloadDocument = vi.fn();
    const onOpenDocument = vi.fn();
    const ExtendedEditor = ProjectConfirmationEditor as unknown as (
      props: Record<string, unknown>
    ) => ReactElement;

    render(
      createElement(ExtendedEditor, {
        copy: defaultProjectConfirmationsCopy,
        derivedValues,
        draftPayload: null,
        templateCode: null,
        onTemplateSelect: vi.fn(),
        onSave: vi.fn(),
        onSubmit: vi.fn(),
        hasUploadedDocument: true,
        uploadedDocumentFileName: "evidence.msg",
        uploadedDocumentMimeType: "application/vnd.ms-outlook",
        uploadedDocumentUnsupported: true,
        onDownloadDocument,
        onOpenDocument,
      })
    );

    expect(
      screen.getByText("This file type cannot be previewed inline.")
    ).toBeVisible();
    expect(screen.getByText("evidence.msg")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Download original file" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Open original file" }));
    expect(onDownloadDocument).toHaveBeenCalledOnce();
    expect(onOpenDocument).toHaveBeenCalledOnce();
  });

  it("starts with local upload when the template library has no options", () => {
    const onTemplateSelect = vi.fn();
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={null}
        templateCode={null}
        onTemplateSelect={onTemplateSelect}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(
      screen.queryByTestId("confirmation-draft-document")
    ).not.toBeInTheDocument();
    const templateSelect = screen.getByLabelText("Confirmation template");
    expect(templateSelect).toHaveAttribute(
      "data-template-catalog-version",
      "managed-confirmation-templates-v2"
    );
    fireEvent.click(templateSelect);
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).not.toHaveAttribute("data-template-code");
  });

  it("does not offer stale legacy templates when the library has no enabled options", () => {
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={
          {
            templateAvailableCodes: [
              "STANDARD_FINANCIAL_INSTITUTION",
              "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
            ],
          } as never
        }
        templateCode="STANDARD_FINANCIAL_INSTITUTION"
        confirmationType="BANK"
        availableTemplateOptions={[]}
        uploadedDocumentUrl="blob:legacy-preview"
        onTemplateSelect={vi.fn()}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const templateSelect = screen.getByLabelText("Confirmation template");
    expect(templateSelect).toHaveTextContent(
      "Standard financial institution confirmation template"
    );
    fireEvent.click(templateSelect);

    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(
      screen.queryByRole("option", {
        name: /Standard financial institution confirmation template/,
      })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", {
        name: /Bank Confirmation - HK Standard \(English\)/,
      })
    ).not.toBeInTheDocument();
  });

  it("distinguishes a library template named Custom upload from the local upload action", () => {
    const templateCode = "CTPL-123456789ABC" as const;
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={{}}
        templateCode={null}
        confirmationType="BANK"
        availableTemplateOptions={[
          { code: templateCode, label: "Custom upload" },
        ]}
        onTemplateSelect={vi.fn()}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText("Confirmation template"));

    expect(
      screen.getByRole("option", { name: "From local upload" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Custom upload.*CTPL-123456789ABC/ })
    ).toHaveAttribute("data-template-code", templateCode);
  });

  it("layers the saved manifest over hard-coded fields and restores dynamic values", async () => {
    const onSave = vi.fn();
    const designSchema = {
      version: 1,
      fields: [
        {
          id: "dynamic-reference",
          kind: "TEXT",
          name: "Dynamic Reference",
          placeholder: "Reference",
          options: [],
          page: 1,
          x: 0.1,
          y: 0.1,
          width: 0.3,
          height: 0.04,
        },
        {
          id: "dynamic-choice",
          kind: "SELECT",
          name: "Dynamic Choice",
          placeholder: "Choose",
          options: ["A", "B"],
          page: 1,
          x: 0.1,
          y: 0.16,
          width: 0.3,
          height: 0.04,
        },
        {
          id: "cancelled-source",
          kind: "MASK",
          name: "Cancelled source",
          placeholder: "",
          options: [],
          page: 1,
          x: 0.1,
          y: 0.22,
          width: 0.3,
          height: 0.04,
        },
      ],
    } as const;
    const draftPayload = {
      templateDesignSchema: designSchema,
      templateFieldValues: {
        "dynamic-reference": "Saved reference",
        "dynamic-choice": "B",
      },
    } as never;

    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={draftPayload}
        templateCode="BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
        uploadedDocumentDocxUrl="blob:managed-docx-preview"
        onTemplateSelect={vi.fn()}
        onSave={onSave}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Third party")).toBeInTheDocument();
    expect(screen.getByLabelText("Dynamic Reference")).toHaveValue(
      "Saved reference"
    );
    expect(screen.getByLabelText("Dynamic Choice")).toHaveTextContent("B");
    expect(
      screen.getByTestId("confirmation-template-mask-cancelled-source")
    ).toHaveStyle({
      left: "10%",
      top: "22%",
      width: "30%",
      height: "4%",
    });

    fireEvent.change(screen.getByLabelText("Dynamic Reference"), {
      target: { value: "Edited reference" },
    });
    fireEvent.blur(screen.getByLabelText("Dynamic Reference"));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          templateDesignSchema: designSchema,
          templateFieldValues: {
            "dynamic-reference": "Edited reference",
            "dynamic-choice": "B",
          },
        })
      )
    );
  });

  it("does not restore legacy fields after an explicitly empty managed design is saved", () => {
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={
          {
            templateDesignSchema: { version: 1, fields: [] },
          } as never
        }
        templateCode="BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
        uploadedDocumentDocxUrl="blob:managed-docx-preview"
        onTemplateSelect={vi.fn()}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.queryByLabelText("Third party")).not.toBeInTheDocument();
  });

  it("keeps source anchors when saving a dynamic field manifest", async () => {
    const onSave = vi.fn();
    const sourceRange = {
      end: 16,
      paragraphOrdinal: 4,
      paragraphXmlSha256: "a".repeat(64),
      part: "word/document.xml" as const,
      sourceText: "(To The Manager)",
      start: 0,
    };
    const designSchema = {
      version: 1,
      fields: [
        {
          id: "dynamic-manager",
          kind: "TEXT" as const,
          name: "Dynamic manager",
          placeholder: "To the Manager",
          options: [],
          page: 1,
          x: 0.1,
          y: 0.1,
          width: 0.3,
          height: 0.04,
          sourceRanges: [sourceRange],
        },
      ],
    } as const;

    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={
          {
            templateDesignSchema: designSchema,
            templateFieldValues: { "dynamic-manager": "Operations Manager" },
          } as never
        }
        templateCode="BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
        uploadedDocumentDocxUrl="blob:managed-docx-preview"
        onTemplateSelect={vi.fn()}
        onSave={onSave}
        onSubmit={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("Dynamic manager"), {
      target: { value: "Updated Manager" },
    });
    fireEvent.blur(screen.getByLabelText("Dynamic manager"));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          templateDesignSchema: expect.objectContaining({
            fields: [expect.objectContaining({ sourceRanges: [sourceRange] })],
          }),
        })
      )
    );
  });

  it("covers the PDF source behind custom-template fields", () => {
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={
          {
            templateDesignSchema: {
              version: 1,
              fields: [
                {
                  id: "dynamic-manager",
                  kind: "TEXT",
                  name: "Dynamic manager",
                  placeholder: "To the Manager",
                  options: [],
                  page: 1,
                  x: 0.1,
                  y: 0.1,
                  width: 0.3,
                  height: 0.04,
                },
              ],
            },
            templateFieldValues: {},
          } as never
        }
        templateCode={"CTPL-BANK-2026-000001" as never}
        uploadedDocumentUrl="blob:standard-preview"
        onTemplateSelect={vi.fn()}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const input = screen.getByLabelText("Dynamic manager");
    expect(input).toHaveClass("rounded-sm", "border", "bg-transparent");
    expect(input).not.toHaveClass(
      "rounded-none",
      "border-0",
      "border-b",
      "border-dashed"
    );
    expect(
      input
        .closest("[data-confirmation-template-field]")
        ?.querySelector("[data-confirmation-source-cover]")
    ).toHaveClass("bg-white");
  });

  it("covers anchored PDF source text behind an editable field", () => {
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={
          {
            templateDesignSchema: {
              version: 1,
              fields: [
                {
                  id: "dynamic-manager",
                  kind: "TEXT",
                  name: "Dynamic manager",
                  placeholder: "To the Manager",
                  options: [],
                  page: 1,
                  x: 0.1,
                  y: 0.1,
                  width: 0.3,
                  height: 0.04,
                  sourceRanges: [
                    {
                      end: 16,
                      paragraphOrdinal: 4,
                      paragraphXmlSha256: "a".repeat(64),
                      part: "word/document.xml",
                      sourceText: "(To The Manager)",
                      start: 0,
                    },
                  ],
                },
              ],
            },
            templateFieldValues: {},
          } as never
        }
        templateCode="STANDARD_FINANCIAL_INSTITUTION"
        uploadedDocumentUrl="blob:standard-preview"
        onTemplateSelect={vi.fn()}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(
      screen
        .getByLabelText("Dynamic manager")
        .closest("[data-confirmation-template-field]")
        ?.querySelector("[data-confirmation-source-cover]")
    ).toHaveClass("bg-white");
  });

  it("renders all supported dynamic confirmation field controls", () => {
    const fieldKinds = [
      ["text", "TEXT", "Text field", []],
      ["multiline", "MULTILINE", "Multiline field", []],
      ["number", "NUMBER", "Number field", []],
      ["date", "DATE", "Date field", []],
      ["static", "STATIC_TEXT", "Static notice", []],
      ["checkbox", "CHECKBOX", "Checkbox field", []],
      ["select", "SELECT", "Select field", ["A", "B"]],
      ["radio", "RADIO", "Radio field", ["A", "B"]],
    ] as const;
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={
          {
            templateDesignSchema: {
              version: 1,
              fields: fieldKinds.map(([id, kind, name, options], index) => ({
                defaultChecked: id === "checkbox" ? true : undefined,
                height:
                  kind === "MULTILINE" ||
                  kind === "RADIO" ||
                  kind === "STATIC_TEXT"
                    ? 0.08
                    : 0.04,
                id,
                kind,
                name,
                options: [...options],
                required: id === "checkbox" ? true : undefined,
                page: 1,
                placeholder: name,
                textAlign: "center",
                width: 0.3,
                x: 0.1,
                y: 0.05 + index * 0.11,
              })),
            },
            templateFieldValues: {},
          } as never
        }
        onSave={vi.fn()}
        onSubmit={vi.fn()}
        onTemplateSelect={vi.fn()}
        templateCode="CTPL-123456789ABC"
        uploadedDocumentUrl="blob:all-field-kinds"
      />
    );

    expect(screen.getByLabelText("Text field")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Text field")).toHaveStyle({
      textAlign: "center",
    });
    expect(screen.getByLabelText("Multiline field").tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText("Number field")).toHaveAttribute(
      "type",
      "number"
    );
    expect(screen.getByLabelText("Date field")).toHaveAttribute("type", "text");
    expect(
      document.querySelector('[data-confirmation-static-text="static"]')
    ).toHaveTextContent("Static notice");
    expect(
      document
        .querySelector('[data-confirmation-template-field="static"]')
        ?.querySelector("input, textarea, button")
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Checkbox field" })
    ).toBeChecked();
    expect(
      document.querySelector(
        '[data-confirmation-template-field="checkbox"] > div'
      )
    ).toHaveStyle({ justifyContent: "center" });
    expect(
      screen.getByRole("combobox", { name: "Select field" })
    ).toBeVisible();
    expect(
      document
        .querySelector('[data-confirmation-template-field="select"]')
        ?.querySelector('[data-slot="select-value"]')
    ).toHaveClass("justify-center", "text-center");
    const radioField = document.querySelector(
      '[data-confirmation-template-field="radio"]'
    );
    expect(
      radioField?.querySelector(
        '[data-testid="confirmation-radio-display-radio"]'
      )
    ).toBeVisible();
    expect(screen.getByTestId("confirmation-radio-display-radio")).toHaveClass(
      "h-full",
      "rounded-sm",
      "border",
      "border-primary",
      "bg-transparent",
      "py-0"
    );
    expect(
      screen.getByTestId("confirmation-radio-display-radio")
    ).not.toHaveClass("border-dashed", "border-blue-500/90");
  });

  it("blocks submission until a required checkbox is checked", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);
    const onSubmit = vi.fn();
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={
          {
            templateDesignSchema: {
              version: 1,
              fields: [
                {
                  defaultChecked: false,
                  height: 0.04,
                  id: "required-checkbox",
                  kind: "CHECKBOX",
                  name: "Authorization",
                  options: [],
                  page: 1,
                  placeholder: "Confirm authorization",
                  required: true,
                  width: 0.3,
                  x: 0.1,
                  y: 0.1,
                },
              ],
            },
            templateFieldValues: {},
          } as never
        }
        onSave={onSave}
        onSubmit={onSubmit}
        onTemplateSelect={vi.fn()}
        templateCode="CTPL-123456789ABC"
        uploadedDocumentUrl="blob:required-checkbox"
      />
    );

    const submit = screen.getByRole("button", {
      name: defaultProjectConfirmationsCopy.submitConfirmation,
    });
    await user.click(submit);
    expect(vi.mocked(onSubmit)).toHaveBeenCalledTimes(0);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Confirm authorization"
    );

    await user.click(screen.getByRole("checkbox", { name: "Authorization" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          templateFieldValues: { "required-checkbox": "true" },
        })
      )
    );
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("stores exactly one selected radio option", async () => {
    const onSave = vi.fn().mockImplementation(completeWithoutResult);
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={
          {
            templateDesignSchema: {
              version: 1,
              fields: [
                {
                  height: 0.08,
                  id: "delivery-method",
                  kind: "RADIO",
                  name: "Delivery method",
                  options: ["Postal", "Electronic"],
                  page: 1,
                  placeholder: "Choose delivery method",
                  width: 0.4,
                  x: 0.1,
                  y: 0.1,
                },
              ],
            },
            templateFieldValues: { "delivery-method": "Postal" },
          } as never
        }
        onSave={onSave}
        onSubmit={vi.fn()}
        onTemplateSelect={vi.fn()}
        templateCode="CTPL-123456789ABC"
        uploadedDocumentUrl="blob:radio-field"
      />
    );

    const radio = screen.getByTestId(
      "confirmation-radio-display-delivery-method"
    );
    const radioMenu = screen.getByRole("button", {
      name: "Delivery method options",
    });
    expect(radioMenu).toHaveClass(
      "right-0",
      "w-5",
      "rounded-none",
      "border-0",
      "bg-transparent"
    );
    expect(
      radioMenu.closest('[data-confirmation-template-field="delivery-method"]')
    ).toBeInTheDocument();
    fireEvent.click(radioMenu);
    fireEvent.click(
      await screen.findByRole("menuitemradio", { name: "Electronic" })
    );

    expect(radio).toHaveTextContent("Electronic");
    await waitFor(() =>
      expect(onSave).toHaveBeenLastCalledWith(
        expect.objectContaining({
          templateFieldValues: { "delivery-method": "Electronic" },
        })
      )
    );
  });

  it("prefills the current date once and keeps the field editable", async () => {
    const onSave = vi.fn().mockImplementation(completeWithoutResult);
    const now = new Date();
    const expectedToday = new Date(
      now.getTime() - now.getTimezoneOffset() * 60_000
    )
      .toISOString()
      .slice(0, 10);
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={
          {
            templateDesignSchema: {
              version: 1,
              fields: [
                {
                  defaultValueSource: {
                    source: "SYSTEM",
                    value: "CURRENT_DATE",
                  },
                  height: 0.04,
                  id: "confirmation-date",
                  kind: "DATE",
                  name: "Confirmation date",
                  options: [],
                  page: 1,
                  placeholder: "Confirmation date",
                  width: 0.25,
                  x: 0.1,
                  y: 0.1,
                },
              ],
            },
            templateFieldValues: {},
          } as never
        }
        onSave={onSave}
        onSubmit={vi.fn()}
        onTemplateSelect={vi.fn()}
        templateCode="CTPL-123456789ABC"
        uploadedDocumentUrl="blob:date-default"
      />
    );

    const date = screen.getByLabelText("Confirmation date");
    expect(date).toHaveValue(expectedToday);
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          templateFieldValues: { "confirmation-date": expectedToday },
        })
      )
    );

    fireEvent.change(date, { target: { value: "2027-01-15" } });
    fireEvent.blur(date);
    await waitFor(() =>
      expect(onSave).toHaveBeenLastCalledWith(
        expect.objectContaining({
          templateFieldValues: { "confirmation-date": "2027-01-15" },
        })
      )
    );
  });

  it("applies WYSIWYG field formatting without changing the plain-text value", async () => {
    const onSave = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <ProjectConfirmationEditor
          copy={defaultProjectConfirmationsCopy}
          derivedValues={derivedValues}
          draftPayload={
            {
              templateDesignSchema: {
                version: 1,
                fields: [
                  {
                    id: "dynamic-manager",
                    kind: "TEXT",
                    name: "Dynamic manager",
                    placeholder: "To the Manager",
                    options: [],
                    page: 1,
                    x: 0.1,
                    y: 0.1,
                    width: 0.3,
                    height: 0.04,
                  },
                ],
              },
              templateFieldValues: {
                "dynamic-manager": "Operations Manager",
              },
            } as never
          }
          templateCode="STANDARD_FINANCIAL_INSTITUTION"
          uploadedDocumentUrl="blob:standard-preview"
          onTemplateSelect={vi.fn()}
          onSave={onSave}
          onSubmit={vi.fn()}
        />
      </QueryClientProvider>
    );

    const formattingCopy =
      defaultProjectConfirmationsCopy.templateLibrary.workbench.fieldSettings;
    fireEvent.focus(screen.getByLabelText("Dynamic manager"));
    fireEvent.click(screen.getByRole("button", { name: formattingCopy.bold }));
    fireEvent.click(
      screen.getByRole("button", {
        name: formattingCopy.fontSizeIncrease ?? formattingCopy.fontSize,
      })
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Dynamic manager")).toHaveStyle({
        fontWeight: "700",
      })
    );
    expect(
      screen.queryByLabelText(formattingCopy.textColor)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(formattingCopy.backgroundColor)
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Dynamic manager")).toHaveValue(
      "Operations Manager"
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Dynamic manager")).toHaveStyle({
        fontWeight: "700",
      })
    );
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          templateDesignSchema: expect.objectContaining({
            fields: [
              expect.objectContaining({
                textStyle: expect.objectContaining({
                  bold: true,
                  fontSize: 14,
                }),
              }),
            ],
          }),
          templateFieldValues: {
            "dynamic-manager": "Operations Manager",
          },
        })
      )
    );
  });

  it("replaces overlapping standard controls when the applied design owns their source fields", () => {
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={
          {
            templateDesignSchema: {
              version: 1,
              fields: ["To the Manager", "Bank Office", "Date", "Ref"].map(
                (placeholder, index) => ({
                  id: `dynamic-${index}`,
                  kind: "TEXT" as const,
                  name: placeholder,
                  placeholder,
                  options: [],
                  page: 1,
                  x: 0.1,
                  y: 0.1 + index * 0.05,
                  width: 0.3,
                  height: 0.04,
                })
              ),
            },
            templateFieldValues: {},
          } as never
        }
        templateCode="STANDARD_FINANCIAL_INSTITUTION"
        uploadedDocumentUrl="blob:standard-preview"
        onTemplateSelect={vi.fn()}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(
      document.querySelector("#confirmation-to-the-manager")
    ).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-confirmation-field="bankName"]')
    ).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-confirmation-field="officeDate"]')
    ).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-confirmation-field="referenceCode"]')
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Sir/Madam")).toBeInTheDocument();
    expect(
      screen
        .getByTestId("confirmation-editable-overlay")
        .querySelectorAll("[data-confirmation-field]")
    ).toHaveLength(5);
  });

  it("stores a dynamic text selection without overwriting referenceCode", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const designSchema = {
      version: 1,
      fields: [
        {
          id: "dynamic-reference",
          kind: "TEXT",
          name: "Dynamic Reference",
          binding: "referenceCode",
          placeholder: "Reference",
          options: [],
          page: 1,
          x: 0.1,
          y: 0.1,
          width: 0.3,
          height: 0.04,
        },
      ],
    } as const;

    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={
          {
            referenceCode: "GENERAL-FILL-REF",
            templateDesignSchema: designSchema,
            templateFieldValues: {},
          } as never
        }
        baseInformationOptions={{
          references: ["GENERAL-FILL-REF", "EDITED-REF"],
        }}
        templateCode="BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
        uploadedDocumentDocxUrl="blob:managed-docx-preview"
        onTemplateSelect={vi.fn()}
        onSave={onSave}
        onSubmit={vi.fn()}
      />
    );

    const reference = screen.getByRole("combobox", {
      name: "Dynamic Reference",
    });
    expect(reference).toHaveValue("");
    await user.click(reference);
    await user.click(screen.getByRole("option", { name: "EDITED-REF" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());

    const savedPayload = onSave.mock.calls[0]?.[0] as
      | {
          referenceCode?: string;
          templateFieldValues?: Record<string, string>;
        }
      | undefined;
    expect(savedPayload?.referenceCode).toBe("GENERAL-FILL-REF");
    expect(savedPayload?.templateFieldValues?.["dynamic-reference"]).toBe(
      "EDITED-REF"
    );
  });

  it("binds multiline fields to project and confirmation information values", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={
          {
            auditorAddress: "Project address\nFloor 8",
            recipientAddress: "Bank address\nCentral",
            templateDesignSchema: {
              version: 1,
              fields: [
                {
                  defaultValueSource: {
                    binding: "auditorAddress",
                    source: "BASE_INFORMATION",
                  },
                  height: 0.1,
                  id: "project-address",
                  kind: "MULTILINE",
                  name: "Project address",
                  options: [],
                  page: 1,
                  placeholder: "Project address",
                  width: 0.35,
                  x: 0.1,
                  y: 0.1,
                },
                {
                  height: 0.1,
                  id: "confirmation-address",
                  defaultValueSource: {
                    binding: "recipientAddress",
                    source: "INFORMATION_LIBRARY",
                  },
                  kind: "MULTILINE",
                  name: "Confirmation address",
                  options: [],
                  page: 1,
                  placeholder: "Confirmation address",
                  width: 0.35,
                  x: 0.1,
                  y: 0.25,
                },
              ],
            },
            templateFieldValues: {},
          } as never
        }
        onSave={onSave}
        onSubmit={vi.fn()}
        onTemplateSelect={vi.fn()}
        templateCode="CTPL-123456789ABC"
        uploadedDocumentUrl="blob:multiline-bindings"
      />
    );

    const projectAddress = screen.getByLabelText("Project address");
    const confirmationAddress = screen.getByLabelText("Confirmation address");
    expect(projectAddress.tagName).toBe("TEXTAREA");
    expect(confirmationAddress.tagName).toBe("TEXTAREA");
    expect(projectAddress).toHaveValue("");
    expect(confirmationAddress).toHaveValue("");

    await user.clear(projectAddress);
    await user.type(projectAddress, "Updated project\nAddress");
    await user.clear(confirmationAddress);
    await user.type(confirmationAddress, "Updated bank\nAddress");
    fireEvent.blur(confirmationAddress);
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          templateFieldValues: {
            "confirmation-address": "Updated bank\nAddress",
            "project-address": "Updated project\nAddress",
          },
        })
      )
    );
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        auditorAddress: "Project address\nFloor 8",
        recipientAddress: "Bank address\nCentral",
        templateFieldValues: {
          "confirmation-address": "Updated bank\nAddress",
          "project-address": "Updated project\nAddress",
        },
      })
    );
  });

  it.each(["TEXT", "MULTILINE"] as const)(
    "keeps %s fields local when base and information-library bindings coexist",
    async (kind) => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockImplementation(completeWithoutResult);
      vi.spyOn(api, "confirmationInformationLibrary").mockResolvedValue([
        informationLibraryEntry,
      ]);
      const fieldId = `dual-source-${kind.toLowerCase()}`;
      const fieldName = `Dual source ${kind.toLowerCase()}`;

      render(
        <ProjectConfirmationEditor
          copy={defaultProjectConfirmationsCopy}
          derivedValues={derivedValues}
          baseInformationOptions={{ clientNames: ["Base client"] }}
          draftPayload={
            {
              clientName: "Source client",
              confirmationInformationLibraryEntryId: informationLibraryEntry.id,
              recipientAddress: "Source address",
              templateDesignSchema: {
                version: 1,
                fields: [
                  {
                    baseInformationBinding: "clientName",
                    height: kind === "MULTILINE" ? 0.1 : 0.04,
                    id: fieldId,
                    informationLibraryBinding: "recipientAddress",
                    kind,
                    name: fieldName,
                    options: [],
                    page: 1,
                    placeholder: "Choose a value",
                    width: 0.35,
                    x: 0.1,
                    y: 0.1,
                  },
                ],
              },
              templateFieldValues: {},
            } as never
          }
          onSave={onSave}
          onSubmit={vi.fn()}
          onTemplateSelect={vi.fn()}
          templateCode="CTPL-123456789ABC"
          uploadedDocumentUrl="blob:dual-source"
        />
      );

      const field = screen.getByRole("combobox", { name: fieldName });
      expect(field).toHaveValue("");

      await user.click(
        screen.getByRole("button", { name: `Open ${fieldName} options` })
      );
      await expect(
        screen.findByRole("option", { name: "Base client" })
      ).resolves.toBeVisible();
      expect(
        screen.getByRole("option", { name: "Library recipient address" })
      ).toBeVisible();

      await user.click(
        screen.getByRole("option", { name: "Library recipient address" })
      );
      await waitFor(() =>
        expect(onSave).toHaveBeenLastCalledWith(
          expect.objectContaining({
            clientName: "Source client",
            recipientAddress: "Source address",
            templateFieldValues: {
              [fieldId]: "Library recipient address",
            },
          })
        )
      );
    }
  );

  it("treats a relation legacy default as a candidate without auto-filling it", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        baseInformationOptions={{ clientNames: ["Legacy client"] }}
        draftPayload={
          {
            clientName: "Source client",
            templateDesignSchema: {
              version: 1,
              fields: [
                {
                  defaultValueSource: {
                    binding: "clientName",
                    source: "BASE_INFORMATION",
                  },
                  height: 0.04,
                  id: "legacy-default-source",
                  kind: "TEXT",
                  name: "Legacy default source",
                  options: [],
                  page: 1,
                  placeholder: "Choose a client",
                  width: 0.35,
                  x: 0.1,
                  y: 0.1,
                },
                {
                  defaultValueSource: {
                    source: "CUSTOM",
                    value: "Manual default",
                  },
                  height: 0.04,
                  id: "custom-default-source",
                  kind: "TEXT",
                  name: "Custom default source",
                  options: [],
                  page: 1,
                  placeholder: "Custom value",
                  width: 0.35,
                  x: 0.1,
                  y: 0.2,
                },
              ],
            },
            templateFieldValues: {},
          } as never
        }
        onSave={onSave}
        onSubmit={vi.fn()}
        onTemplateSelect={vi.fn()}
        templateCode="CTPL-123456789ABC"
        uploadedDocumentUrl="blob:legacy-default-source"
      />
    );

    const field = screen.getByRole("combobox", {
      name: "Legacy default source",
    });
    expect(field).toHaveValue("");
    expect(screen.getByLabelText("Custom default source")).toHaveValue(
      "Manual default"
    );

    await user.click(
      screen.getByRole("button", {
        name: "Open Legacy default source options",
      })
    );
    await expect(
      screen.findByRole("option", { name: "Legacy client" })
    ).resolves.toBeVisible();

    await user.click(screen.getByRole("option", { name: "Legacy client" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenLastCalledWith(
        expect.objectContaining({
          clientName: "Source client",
          templateFieldValues: expect.objectContaining({
            "legacy-default-source": "Legacy client",
          }),
          templateDesignSchema: expect.objectContaining({
            fields: [
              expect.objectContaining({
                baseInformationBinding: "clientName",
              }),
              expect.objectContaining({
                defaultValueSource: {
                  source: "CUSTOM",
                  value: "Manual default",
                },
              }),
            ],
          }),
        })
      )
    );
    const savedField = (
      requiredFixture(onSave.mock.calls.at(-1))[0] as {
        templateDesignSchema?: { fields?: Record<string, unknown>[] };
      }
    ).templateDesignSchema?.fields?.[0];
    expect(savedField).not.toHaveProperty("defaultValueSource");
  });

  it("uses the information-library binding set for a legacy relation candidate", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);
    vi.spyOn(api, "confirmationInformationLibrary").mockResolvedValue([
      informationLibraryEntry,
    ]);

    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={
          {
            confirmationInformationLibraryEntryId: informationLibraryEntry.id,
            templateDesignSchema: {
              version: 1,
              fields: [
                {
                  defaultValueSource: {
                    binding: "recipientName",
                    source: "INFORMATION_LIBRARY",
                  },
                  height: 0.04,
                  id: "legacy-library-default-source",
                  kind: "TEXT",
                  name: "Legacy library default source",
                  options: [],
                  page: 1,
                  placeholder: "Choose a contact",
                  width: 0.35,
                  x: 0.1,
                  y: 0.1,
                },
              ],
            },
            templateFieldValues: {},
          } as never
        }
        onSave={onSave}
        onSubmit={vi.fn()}
        onTemplateSelect={vi.fn()}
        templateCode="CTPL-123456789ABC"
        uploadedDocumentUrl="blob:legacy-library-default-source"
      />
    );

    const field = await screen.findByRole("combobox", {
      name: "Legacy library default source",
    });
    expect(field).toHaveValue("");
    await user.click(
      screen.getByRole("button", {
        name: "Open Legacy library default source options",
      })
    );
    await expect(
      screen.findByRole("option", { name: "Library Contact" })
    ).resolves.toBeVisible();
    await user.click(screen.getByRole("option", { name: "Library Contact" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenLastCalledWith(
        expect.objectContaining({
          templateDesignSchema: expect.objectContaining({
            fields: [
              expect.objectContaining({
                informationLibraryBinding: "recipientName",
              }),
            ],
          }),
        })
      )
    );
    const savedField = (
      requiredFixture(onSave.mock.calls.at(-1))[0] as {
        templateDesignSchema?: { fields?: Record<string, unknown>[] };
      }
    ).templateDesignSchema?.fields?.[0];
    expect(savedField).not.toHaveProperty("defaultValueSource");
  });

  it("keeps a custom initial value alongside explicit dual associations", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);
    vi.spyOn(api, "confirmationInformationLibrary").mockResolvedValue([
      informationLibraryEntry,
    ]);

    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        baseInformationOptions={{ clientNames: ["Base client"] }}
        draftPayload={
          {
            confirmationInformationLibraryEntryId: informationLibraryEntry.id,
            templateDesignSchema: {
              version: 1,
              fields: [
                {
                  baseInformationBinding: "clientName",
                  defaultValueSource: {
                    source: "CUSTOM",
                    value: "Optional initial value",
                  },
                  height: 0.04,
                  id: "dual-source-with-initial",
                  informationLibraryBinding: "recipientName",
                  kind: "TEXT",
                  name: "Dual source with initial",
                  options: [],
                  page: 1,
                  placeholder: "Choose a value",
                  width: 0.35,
                  x: 0.1,
                  y: 0.1,
                },
              ],
            },
            templateFieldValues: {},
          } as never
        }
        onSave={onSave}
        onSubmit={vi.fn()}
        onTemplateSelect={vi.fn()}
        templateCode="CTPL-123456789ABC"
        uploadedDocumentUrl="blob:dual-source-with-initial"
      />
    );

    const field = await screen.findByRole("combobox", {
      name: "Dual source with initial",
    });
    expect(field).toHaveValue("Optional initial value");
    await user.click(
      screen.getByRole("button", {
        name: "Open Dual source with initial options",
      })
    );
    await user.click(screen.getByRole("option", { name: "Library Contact" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenLastCalledWith(
        expect.objectContaining({
          templateFieldValues: {
            "dual-source-with-initial": "Library Contact",
          },
        })
      )
    );
  });

  it("saves a changed text field once on blur instead of on every keystroke", async () => {
    vi.useFakeTimers();
    const onSave = vi.fn().mockImplementation(completeWithoutResult);
    const designSchema = {
      version: 1,
      fields: [
        {
          id: "dynamic-reference",
          kind: "TEXT",
          name: "Dynamic Reference",
          placeholder: "Reference",
          page: 1,
          x: 0.1,
          y: 0.1,
          width: 0.3,
          height: 0.04,
        },
      ],
    } as const;

    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={
          {
            templateDesignSchema: designSchema,
            templateFieldValues: { "dynamic-reference": "Saved reference" },
          } as never
        }
        templateCode="BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
        uploadedDocumentDocxUrl="blob:managed-docx-preview"
        onTemplateSelect={vi.fn()}
        onSave={onSave}
        onSubmit={vi.fn()}
      />
    );

    const referenceField = screen.getByLabelText("Dynamic Reference");
    fireEvent.change(referenceField, { target: { value: "Edited" } });
    fireEvent.change(referenceField, {
      target: { value: "Edited reference" },
    });

    expect(vi.mocked(onSave)).toHaveBeenCalledTimes(0);
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    expect(vi.mocked(onSave)).toHaveBeenCalledTimes(0);

    fireEvent.blur(referenceField);
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        templateFieldValues: { "dynamic-reference": "Edited reference" },
      })
    );
    expect(screen.getByTestId("confirmation-auto-save-status")).toHaveAttribute(
      "data-stateful-motion-button",
      "true"
    );
    expect(screen.getByRole("button", { name: "Saved" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save confirmation draft" })
    ).not.toBeInTheDocument();

    fireEvent.focus(referenceField);
    fireEvent.blur(referenceField);
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });
    expect(onSave).toHaveBeenCalledOnce();

    fireEvent.change(referenceField, { target: { value: "" } });
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    expect(onSave).toHaveBeenCalledOnce();

    fireEvent.blur(referenceField);
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        templateFieldValues: { "dynamic-reference": "" },
      })
    );
  });

  it("covers a previously rendered PDF value behind an editable template field", () => {
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={
          {
            templateDesignSchema: {
              version: 1,
              fields: [
                {
                  id: "dynamic-date",
                  kind: "TEXT",
                  name: "Dynamic Date",
                  placeholder: "Date",
                  page: 1,
                  x: 0.1,
                  y: 0.1,
                  width: 0.3,
                  height: 0.04,
                },
              ],
            },
            templateFieldValues: { "dynamic-date": "" },
          } as never
        }
        templateCode="BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
        uploadedDocumentUrl="blob:managed-pdf-preview"
        onTemplateSelect={vi.fn()}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const field = document.querySelector(
      '[data-confirmation-template-field="dynamic-date"]'
    );
    expect(field).not.toBeNull();
    expect(
      field?.querySelector("[data-confirmation-template-field-backdrop]")
    ).toBeInTheDocument();
  });

  it("guards submit when only a dynamic template field is dirty", () => {
    const designSchema = {
      version: 1,
      fields: [
        {
          id: "dynamic-reference",
          kind: "TEXT",
          name: "Dynamic Reference",
          page: 1,
          x: 0.1,
          y: 0.1,
          width: 0.3,
          height: 0.04,
        },
      ],
    } as const;

    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={
          {
            templateDesignSchema: designSchema,
            templateFieldValues: { "dynamic-reference": "Saved reference" },
          } as never
        }
        templateCode="BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
        uploadedDocumentDocxUrl="blob:managed-docx-preview"
        onTemplateSelect={vi.fn()}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const submitButton = screen.getByRole("button", {
      name: "Freeze confirmation",
    });
    expect(submitButton).toBeEnabled();

    fireEvent.change(screen.getByLabelText("Dynamic Reference"), {
      target: { value: "Edited reference" },
    });
    fireEvent.blur(screen.getByLabelText("Dynamic Reference"));

    expect(submitButton).toBeDisabled();
    expect(
      screen.getByTestId("confirmation-auto-save-status")
    ).toHaveTextContent("Saving");
  });

  it("clears dynamic fields dirty state after a synchronous save succeeds", async () => {
    const onSave = vi.fn();
    const designSchema = {
      version: 1,
      fields: [
        {
          id: "dynamic-reference",
          kind: "TEXT",
          name: "Dynamic Reference",
          page: 1,
          x: 0.1,
          y: 0.1,
          width: 0.3,
          height: 0.04,
        },
      ],
    } as const;

    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={
          {
            templateDesignSchema: designSchema,
            templateFieldValues: { "dynamic-reference": "Saved reference" },
          } as never
        }
        templateCode="BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
        uploadedDocumentDocxUrl="blob:managed-docx-preview"
        onTemplateSelect={vi.fn()}
        onSave={onSave}
        onSubmit={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("Dynamic Reference"), {
      target: { value: "Edited reference" },
    });
    fireEvent.blur(screen.getByLabelText("Dynamic Reference"));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(
        screen.getByTestId("confirmation-auto-save-status")
      ).toHaveTextContent("Saved")
    );
    expect(
      screen.getByRole("button", { name: "Freeze confirmation" })
    ).toBeEnabled();
  });

  it("keeps dynamic fields dirty when saving the draft fails", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("save failed"));
    const designSchema = {
      version: 1,
      fields: [
        {
          id: "dynamic-reference",
          kind: "TEXT",
          name: "Dynamic Reference",
          page: 1,
          x: 0.1,
          y: 0.1,
          width: 0.3,
          height: 0.04,
        },
      ],
    } as const;

    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={
          {
            templateDesignSchema: designSchema,
            templateFieldValues: { "dynamic-reference": "Saved reference" },
          } as never
        }
        templateCode="BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
        uploadedDocumentDocxUrl="blob:managed-docx-preview"
        onTemplateSelect={vi.fn()}
        onSave={onSave}
        onSubmit={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("Dynamic Reference"), {
      target: { value: "Edited reference" },
    });
    fireEvent.blur(screen.getByLabelText("Dynamic Reference"));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(
      screen.getByTestId("confirmation-auto-save-status")
    ).toHaveTextContent("Retry Save");
    expect(
      screen.getByRole("button", { name: "Freeze confirmation" })
    ).toBeDisabled();
  });

  it("filters stale template snapshots while keeping the current value labeled", () => {
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={
          {
            templateAvailableCodes: [
              "STANDARD_FINANCIAL_INSTITUTION",
              "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
              "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
            ],
          } as never
        }
        templateCode="BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
        availableTemplateOptions={[
          {
            code: "STANDARD_FINANCIAL_INSTITUTION",
            label: "Standard financial institution confirmation template",
          },
          {
            code: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
            label: "Securities Confirmation - English - Type 1",
          },
          {
            code: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
            label: "Securities Confirmation - English - Type 2",
          },
        ]}
        uploadedDocumentDocxUrl="blob:managed-docx-preview"
        onTemplateSelect={vi.fn()}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText("Confirmation template"));
    expect(
      screen.getByRole("button", { name: "Confirmation template" })
    ).toHaveTextContent("Bank Confirmation - HK Standard (English)");
    expect(
      screen.queryByRole("option", {
        name: /Bank Confirmation - HK Standard \(English\)/,
      })
    ).not.toBeInTheDocument();
    const options = screen.getAllByRole("option");
    expect(
      options
        .map((option) => option.dataset.templateCode)
        .filter((code): code is string => Boolean(code))
    ).toStrictEqual([
      "STANDARD_FINANCIAL_INSTITUTION",
      "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
      "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
    ]);
  });

  it.each([
    "STANDARD_FINANCIAL_INSTITUTION",
    "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
  ] as const)(
    "shows bank lookup for every bank template: %s",
    (templateCode) => {
      renderManagedTemplate(templateCode);

      expect(screen.getByRole("button", { name: "Bank lookup" })).toBeVisible();
    }
  );

  it.each([
    "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
    "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
  ] as const)(
    "does not show bank lookup for intermediary templates: %s",
    (templateCode) => {
      renderManagedTemplate(templateCode);

      expect(
        screen.queryByRole("button", { name: "Bank lookup" })
      ).not.toBeInTheDocument();
    }
  );

  it.each(managedTemplateCodes)(
    "keeps the salutation options unique and limited: %s",
    async (templateCode) => {
      const user = userEvent.setup();
      renderManagedTemplate(templateCode);

      const trigger = screen.getByLabelText("Sir/Madam");
      await user.click(trigger);
      const options = await waitFor(() => screen.getAllByRole("option"));

      expect(options.map((option) => option.textContent?.trim())).toStrictEqual(
        ["Sir/Madam", "Sir", "Madam"]
      );
      expect(
        new Set(options.map((option) => option.textContent?.trim())).size
      ).toBe(3);
      expect(trigger).toHaveClass("leading-none", "min-w-0");
      expect(trigger).toHaveClass(styles.overlaySelectValue);
      expect(trigger).not.toHaveClass("text-inherit");
      expect(trigger.querySelector('[data-slot="select-value"]')).toHaveClass(
        "min-w-0",
        "text-clip",
        "line-clamp-none"
      );
      expect(
        trigger.querySelector('[data-slot="select-value"]')
      ).not.toHaveClass("overflow-visible");
    }
  );

  it.each([
    ["Sirs/Madam", "Sir/Madam"],
    ["Sir / Madam", "Sir/Madam"],
    ["Sir/Madam", "Sir/Madam"],
    ["Sir", "Sir"],
    ["Madam", "Madam"],
  ] as const)(
    "loads and saves the canonical salutation for legacy value %s",
    (storedSalutation, canonicalSalutation) => {
      render(
        <ProjectConfirmationEditor
          copy={defaultProjectConfirmationsCopy}
          derivedValues={derivedValues}
          draftPayload={{ salutation: storedSalutation }}
          onSave={vi.fn()}
          onSubmit={vi.fn()}
          onTemplateSelect={vi.fn()}
          templateCode="STANDARD_FINANCIAL_INSTITUTION"
          uploadedDocumentUrl="blob:standard-preview"
        />
      );

      expect(screen.getByLabelText("Sir/Madam")).toHaveTextContent(
        canonicalSalutation
      );
      expect(["Sir/Madam", "Sir", "Madam"]).toContain(canonicalSalutation);
    }
  );

  it.each([
    ["Sirs/Madam", "Sir/Madam"],
    ["Sir / Madam", "Sir/Madam"],
    ["Sir/Madam", "Sir/Madam"],
    ["Sir", "Sir"],
    ["Madam", "Madam"],
  ] as const)(
    "normalizes %s in the editable draft payload before saving",
    (storedSalutation, canonicalSalutation) => {
      expect(
        getEditableConfirmationDraftPayload({ salutation: storedSalutation })
      ).toStrictEqual(
        expect.objectContaining({ salutation: canonicalSalutation })
      );
    }
  );

  it.each(managedTemplateCodes)(
    "covers the source field before rendering the editable overlay: %s",
    (templateCode) => {
      renderManagedTemplate(templateCode);

      const overlay = screen.getByTestId("confirmation-editable-overlay");
      const fields = overlay.querySelectorAll("[data-confirmation-field]");
      const sourceCovers = overlay.querySelectorAll(
        "[data-confirmation-source-cover]"
      );

      expect(fields.length).toBeGreaterThan(0);
      expect(sourceCovers.length).toBeGreaterThan(0);
      for (const cover of sourceCovers) {
        expect(cover).toHaveAttribute("aria-hidden", "true");
      }
    }
  );

  it.each([
    "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
    "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
    "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
  ] as const)("covers every DOCX overlay field source line: %s", (code) => {
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={{}}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
        onTemplateSelect={vi.fn()}
        templateCode={code}
        uploadedDocumentDocxUrl="blob:managed-docx-preview"
      />
    );

    const overlay = screen.getByTestId("confirmation-editable-overlay");
    const fields = [
      ...overlay.querySelectorAll<HTMLElement>("[data-confirmation-field]"),
    ];
    const sourceCovers = overlay.querySelectorAll(
      "[data-confirmation-source-cover]"
    );

    expect(sourceCovers).toHaveLength(fields.length);
    for (const field of fields) {
      expect(field.previousElementSibling).toHaveAttribute(
        "data-confirmation-source-cover",
        "true"
      );
    }
  });

  it("offers a custom upload action beside the standard template", () => {
    const onCustomTemplateSelect = vi.fn();
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={null}
        templateCode={null}
        availableTemplateOptions={[
          {
            code: "STANDARD_FINANCIAL_INSTITUTION",
            label: "Standard financial institution confirmation template",
          },
        ]}
        onTemplateSelect={vi.fn()}
        onCustomTemplateSelect={onCustomTemplateSelect}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText("Confirmation template"));
    fireEvent.click(screen.getByRole("option", { name: "From local upload" }));

    expect(onCustomTemplateSelect).toHaveBeenCalledOnce();
  });

  it("labels an uploaded document as a local upload", () => {
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={null}
        templateCode={null}
        hasUploadedDocument
        uploadedDocumentUrl="blob:uploaded-confirmation"
        onTemplateSelect={vi.fn()}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "Confirmation template" })
    ).toHaveTextContent("From local upload");
  });

  it("uses the DOCX preview when the PDF preview is unavailable", () => {
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={{}}
        templateCode="BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
        uploadedDocumentDocxUrl="blob:hk-english-docx-preview"
        onTemplateSelect={vi.fn()}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByTestId("mock-docx-viewer")).toHaveAttribute(
      "data-src",
      "blob:hk-english-docx-preview"
    );
    expect(screen.getByTestId("confirmation-editable-overlay")).toBeVisible();
    expect(
      screen
        .getByTestId("confirmation-editable-overlay")
        .querySelectorAll("[data-confirmation-field]")
    ).toHaveLength(10);
    expect(screen.getByLabelText("Ref")).toHaveValue("");
    expect(screen.getByLabelText("Ref")).toHaveAttribute(
      "placeholder",
      "Enter reference code"
    );
    expect(screen.getByLabelText("Ref")).toHaveClass("leading-none");
    expect(screen.getByLabelText("Ref").parentElement).toHaveStyle({
      left: "460px",
      top: "250px",
      width: "260px",
      height: "24px",
    });
  });

  it("renders the General Fill reference in Standard without using Report date", () => {
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={{
          referenceCode: "GENERAL-FILL-REF",
          reportDate: "2026-08-15",
        }}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
        onTemplateSelect={vi.fn()}
        templateCode="STANDARD_FINANCIAL_INSTITUTION"
        uploadedDocumentUrl="blob:standard-preview"
      />
    );

    expect(screen.getByLabelText("Ref")).toHaveValue("GENERAL-FILL-REF");
    expect(screen.getByLabelText("Report date")).toHaveValue("2026-08-15");
  });

  it("keeps an unsaved Ref when its draft payload is refreshed with equivalent data", () => {
    const baseProps = {
      copy: defaultProjectConfirmationsCopy,
      derivedValues,
      onSave: vi.fn(),
      onSubmit: vi.fn(),
      onTemplateSelect: vi.fn(),
      templateCode: "STANDARD_FINANCIAL_INSTITUTION" as const,
      uploadedDocumentUrl: "blob:standard-preview",
    };
    const { rerender } = render(
      <ProjectConfirmationEditor
        {...baseProps}
        draftPayload={{ referenceCode: "SAVED-REF" }}
      />
    );

    const reference = screen.getByLabelText("Ref");
    fireEvent.change(reference, { target: { value: "UNSAVED-REF" } });
    expect(reference).toHaveValue("UNSAVED-REF");

    rerender(
      <ProjectConfirmationEditor
        {...baseProps}
        draftPayload={{ referenceCode: "SAVED-REF" }}
      />
    );

    expect(reference).toHaveValue("UNSAVED-REF");
  });

  it("lets the HK DOCX template choose and save its salutation", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={{}}
        templateCode="BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
        uploadedDocumentDocxUrl="blob:hk-english-docx-preview"
        onTemplateSelect={vi.fn()}
        onSave={onSave}
        onSubmit={vi.fn()}
      />
    );

    await user.click(screen.getByLabelText("Sir/Madam"));
    await user.click(await screen.findByRole("option", { name: "Madam" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ salutation: "Madam" })
      )
    );
  });

  it("gives HK manager and salutation overlays enough geometry for visible text", () => {
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={{ salutation: "Sir/Madam" }}
        templateCode="BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
        uploadedDocumentDocxUrl="blob:hk-english-docx-preview"
        onTemplateSelect={vi.fn()}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const managerField = screen
      .getByLabelText("To The Manager")
      .closest("[data-confirmation-field]");
    expect(managerField).toHaveStyle({
      width: "320px",
    });
    expect(screen.getByLabelText("Third party")).toHaveClass("rounded-sm");
    expect(
      screen.getByLabelText("Sir/Madam").closest("[data-confirmation-field]")
    ).toHaveStyle({
      height: "22px",
      left: "240px",
      top: "366.8px",
      width: "640px",
    });
    expect(screen.getByLabelText("Sir/Madam")).toHaveTextContent("Sir/Madam");
    expect(screen.getByLabelText("Sir/Madam")).toHaveClass("min-w-0");
  });

  it.each([
    "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
    "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
    "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
  ] as const)("shows the built-in DOCX page controls for %s", (code) => {
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={{}}
        templateCode={code}
        uploadedDocumentDocxUrl="blob:managed-docx-preview"
        onTemplateSelect={vi.fn()}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const viewer = screen.getByTestId("mock-docx-viewer");
    expect(viewer).toHaveAttribute("data-show-toolbar", "true");
    expect(viewer).toHaveAttribute("data-show-upload", "false");
    expect(viewer).toHaveAttribute("data-show-download", "false");
  });

  it("uses the canonical PDF preview when a managed template has dynamic fields", () => {
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={{
          templateDesignSchema: {
            version: 1,
            fields: [
              {
                id: "dynamic-bank-field",
                kind: "TEXT",
                name: "Dynamic bank field",
                page: 1,
                x: 0.1,
                y: 0.1,
                width: 0.3,
                height: 0.04,
                placeholder: "Bank",
                options: [],
              },
            ],
          },
        }}
        templateCode="BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
        uploadedDocumentUrl="blob:managed-canonical-pdf"
        uploadedDocumentDocxUrl="blob:managed-docx-fallback"
        onTemplateSelect={vi.fn()}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByTestId("mock-pdf-viewer")).toHaveAttribute(
      "data-src",
      "blob:managed-canonical-pdf"
    );
    expect(screen.getByTestId("confirmation-draft-document")).toHaveAttribute(
      "data-editor",
      "pdf-digital-twin"
    );
    expect(screen.queryByTestId("mock-docx-viewer")).not.toBeInTheDocument();
  });

  it("keeps the restored standard template on its PDF digital-twin path", () => {
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={{}}
        templateCode="STANDARD_FINANCIAL_INSTITUTION"
        uploadedDocumentUrl="blob:standard-preview"
        onTemplateSelect={vi.fn()}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByTestId("mock-pdf-viewer")).toHaveAttribute(
      "data-src",
      "blob:standard-preview"
    );
    expect(screen.getByTestId("mock-pdf-viewer")).toHaveAttribute(
      "data-show-toolbar",
      "true"
    );
    expect(screen.getByTestId("confirmation-draft-document")).toHaveAttribute(
      "data-editor",
      "pdf-digital-twin"
    );
    expect(
      screen
        .getByTestId("confirmation-editable-overlay")
        .querySelectorAll("[data-confirmation-field]")
    ).toHaveLength(9);
    expect(screen.getByLabelText("To The Manager")).toHaveClass(
      "rounded-sm",
      "border",
      "border-slate-300"
    );
    expect(screen.getByLabelText("Third party")).not.toHaveClass(
      "rounded-sm",
      "border-primary/40"
    );
    expect(
      screen.getByLabelText("Third party").closest("[data-confirmation-field]")
    ).toHaveAttribute("data-confirmation-field", "bankName");
    expect(
      screen.getByTestId("confirmation-bank-name-source-cover")
    ).toHaveClass("bg-white", "pointer-events-none");
    expect(screen.queryByTestId("mock-docx-viewer")).not.toBeInTheDocument();
  });

  it("uses the canonical PDF preview for an uploaded DOCX custom template", () => {
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={
          {
            templateLibrarySource: {
              fileName: "custom-template.docx",
              mimeType:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            },
          } as never
        }
        templateCode="CTPL-123456789ABC"
        uploadedDocumentDocxUrl="blob:custom-docx-preview"
        uploadedDocumentUrl="blob:canonical-pdf-preview"
        onTemplateSelect={vi.fn()}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByTestId("mock-pdf-viewer")).toHaveAttribute(
      "data-src",
      "blob:canonical-pdf-preview"
    );
    expect(screen.getByTestId("confirmation-draft-document")).toHaveAttribute(
      "data-editor",
      "custom-pdf-overlay"
    );
    expect(screen.queryByTestId("mock-docx-viewer")).not.toBeInTheDocument();
  });

  it("fits applied PDF templates to the available width", () => {
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={{}}
        templateCode="STANDARD_FINANCIAL_INSTITUTION"
        uploadedDocumentUrl="blob:managed-canonical-pdf"
        onTemplateSelect={vi.fn()}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const viewer = screen.getByTestId("mock-pdf-viewer");
    expect(viewer).toHaveAttribute("data-auto-fit-width", "true");
  });

  it("lets the standard PDF template choose and save its salutation", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={{}}
        templateCode="STANDARD_FINANCIAL_INSTITUTION"
        uploadedDocumentUrl="blob:standard-preview"
        onTemplateSelect={vi.fn()}
        onSave={onSave}
        onSubmit={vi.fn()}
      />
    );

    await user.click(screen.getByLabelText("Sir/Madam"));
    await user.click(await screen.findByRole("option", { name: "Sir" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ salutation: "Sir" })
      )
    );
  });

  it("positions the standard PDF salutation over the source greeting", () => {
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={{}}
        templateCode="STANDARD_FINANCIAL_INSTITUTION"
        uploadedDocumentUrl="blob:standard-preview"
        onTemplateSelect={vi.fn()}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(
      screen.getByLabelText("Sir/Madam").closest("[data-confirmation-field]")
    ).toHaveAttribute("data-confirmation-field", "salutation");
    expect(screen.getByLabelText("To The Manager")).toHaveAttribute(
      "placeholder",
      "To The Manager"
    );
  });

  it("saves the editable manager addressee through the existing draft recipient field", async () => {
    const onSave = vi.fn();
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={{}}
        onSave={onSave}
        onSubmit={vi.fn()}
        onTemplateSelect={vi.fn()}
        templateCode="STANDARD_FINANCIAL_INSTITUTION"
        uploadedDocumentUrl="blob:standard-preview"
      />
    );

    fireEvent.change(screen.getByLabelText("To The Manager"), {
      target: { value: "Operations Manager" },
    });
    fireEvent.blur(screen.getByLabelText("To The Manager"));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ recipientName: "Operations Manager" })
      )
    );
  });

  it.each([
    "PRC_BANK_TEMPLATE_1",
    "PRC_BANK_TEMPLATE_2",
    "SHINEWING_ENG_BANK",
  ] as const)("does not render the retired %s editor", (code) => {
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={{}}
        templateCode={code}
        onTemplateSelect={vi.fn()}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(
      screen.queryByTestId("confirmation-draft-document")
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Confirmation template")).toBeVisible();
  });

  it("offers file deletion and PDF download for a saved standard draft", async () => {
    const onDeleteDocument = vi.fn();
    const onDownloadDocument = vi.fn();
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={{}}
        templateCode="STANDARD_FINANCIAL_INSTITUTION"
        uploadedDocumentUrl="blob:standard-preview"
        onTemplateSelect={vi.fn()}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
        onDeleteDocument={onDeleteDocument}
        onDownloadDocument={onDownloadDocument}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete file" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Download confirmation" })
    );

    expect(onDeleteDocument).toHaveBeenCalledOnce();
    await waitFor(() => expect(onDownloadDocument).toHaveBeenCalledOnce());
  });

  it("downloads PDF directly from the confirmation download action", async () => {
    const onDownloadDocument = vi.fn();
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={{}}
        templateCode="STANDARD_FINANCIAL_INSTITUTION"
        uploadedDocumentUrl="blob:standard-preview"
        onTemplateSelect={vi.fn()}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
        onDownloadDocument={onDownloadDocument}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Download confirmation" })
    );
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(onDownloadDocument).toHaveBeenCalledWith("pdf", expect.anything())
    );
  });

  it("uses the compact editable chooser for saved base information", () => {
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        baseInformationOptions={{
          clientNames: ["Orchid Holdings"],
          references: ["REF-001"],
          banks: [
            {
              name: "HSBC Hong Kong",
              account: "123456",
              address: "1 Queen's Road",
            },
          ],
        }}
        draftPayload={{}}
        templateCode="STANDARD_FINANCIAL_INSTITUTION"
        uploadedDocumentUrl="blob:standard-preview"
        onTemplateSelect={vi.fn()}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const bankInput = document.querySelector<HTMLInputElement>(
      "#confirmation-bank-office"
    );
    const referenceInput = document.querySelector<HTMLInputElement>(
      "#confirmation-reference-code"
    );
    expect(bankInput).not.toHaveAttribute("list");
    expect(referenceInput).not.toHaveAttribute("list");
  });

  it("renders a linked template field as a compact dropdown", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        baseInformationOptions={{
          clientNames: ["Orchid Holdings", "Harbour Retail Limited"],
        }}
        draftPayload={
          {
            templateDesignSchema: {
              version: 1,
              fields: [
                {
                  id: "linked-client",
                  kind: "TEXT",
                  name: "Linked client",
                  placeholder: "Client name",
                  binding: "clientName",
                  page: 1,
                  x: 0.1,
                  y: 0.1,
                  width: 0.3,
                  height: 0.04,
                },
              ],
            },
          } as never
        }
        templateCode="STANDARD_FINANCIAL_INSTITUTION"
        uploadedDocumentUrl="blob:standard-preview"
        onTemplateSelect={vi.fn()}
        onSave={onSave}
        onSubmit={vi.fn()}
      />
    );

    const linkedField = screen.getByRole("combobox", { name: "Linked client" });
    expect(linkedField).not.toHaveAttribute("list");
    expect(linkedField).toHaveAttribute("data-slot", "input");
    await user.click(linkedField);
    await user.click(
      screen.getByRole("option", { name: "Harbour Retail Limited" })
    );
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          clientName: "Orchid Holdings",
          templateFieldValues: {
            "linked-client": "Harbour Retail Limited",
          },
        })
      )
    );
  });

  it("keeps all Hong Kong template fields editable", async () => {
    const onSave = vi.fn();
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={{}}
        templateCode="BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
        uploadedDocumentDocxUrl="blob:hk-english-preview"
        onTemplateSelect={vi.fn()}
        onSave={onSave}
        onSubmit={vi.fn()}
      />
    );

    const values = [
      ["To The Manager", "Operations Manager"],
      ["Third party", "HSBC Hong Kong"],
      ["Office Date", "2026-07-12"],
      ["Ref", "CUSTOM-REF-2026"],
      ["Client Name", "Orchid Custom Limited"],
      ["Report date", "2026-12-31"],
      ["Auditor name", "Wing CPA Limited"],
      ["Auditor address", "17/F, Central Tower"],
      ["Fee debit account", "001-123456"],
    ] as const;
    for (const [label, value] of values) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.blur(screen.getByLabelText(requiredFixture(values.at(-1))[0]));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          bankName: "HSBC Hong Kong",
          recipientName: "Operations Manager",
          officeDate: "2026-07-12",
          referenceCode: "CUSTOM-REF-2026",
          clientName: "Orchid Custom Limited",
          reportDate: "2026-12-31",
          auditorName: "Wing CPA Limited",
          auditorAddress: "17/F, Central Tower",
          authorizationAccount: "001-123456",
        })
      )
    );
    expect(screen.getByTestId("mock-docx-viewer")).toHaveAttribute(
      "data-src",
      "blob:hk-english-preview"
    );
    expect(screen.getByTestId("confirmation-editable-overlay")).toBeVisible();
    expect(screen.getByTestId("confirmation-editable-overlay")).toHaveAttribute(
      "data-layout-version",
      "standard-financial-institution-v3"
    );
    expect(
      screen
        .getByTestId("confirmation-editable-overlay")
        .querySelectorAll("[data-confirmation-field]")
    ).toHaveLength(10);
    expect(document.querySelector("[contenteditable='true']")).toBeNull();
    expect(screen.getAllByRole("textbox")).toHaveLength(9);
    expect(
      screen.queryByPlaceholderText("Key dates, scope, special requirements")
    ).toBeNull();
  });

  it.each([
    {
      code: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
      expectedFieldCount: 12,
      fields: [
        ["Recipient Name", "Custodian Limited"],
        ["Recipient Address", "1 Finance Street"],
        ["Client Name", "Orchid Securities"],
        ["Year End Date", "2026-12-31"],
        ["Account Number", "SEC-001"],
        ["MIC Name", "Alice Manager"],
      ],
    },
    {
      code: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
      expectedFieldCount: 12,
      fields: [
        ["Recipient Name", "Broker Limited"],
        ["Recipient Address", "2 Exchange Square"],
        ["Client Name", "Orchid Securities"],
        ["MIC Email", "mic@example.com"],
        ["MIC Name and Initial", "A. Manager"],
        ["Year End Date", "2026-12-31"],
      ],
    },
  ] as const)(
    "renders and saves every editable field for $code",
    async ({ code, expectedFieldCount, fields }) => {
      const onSave = vi.fn();
      render(
        <ProjectConfirmationEditor
          copy={defaultProjectConfirmationsCopy}
          derivedValues={derivedValues}
          draftPayload={{}}
          templateCode={code}
          uploadedDocumentDocxUrl="blob:securities-preview"
          onTemplateSelect={vi.fn()}
          onSave={onSave}
          onSubmit={vi.fn()}
        />
      );

      expect(
        screen
          .getByTestId("confirmation-editable-overlay")
          .querySelectorAll("[data-confirmation-field]")
      ).toHaveLength(expectedFieldCount);
      for (const [label, value] of fields) {
        fireEvent.change(requiredFixture(screen.getAllByLabelText(label)[0]), {
          target: { value },
        });
      }
      fireEvent.blur(
        requiredFixture(
          screen.getAllByLabelText(requiredFixture(fields.at(-1))[0])[0]
        )
      );

      await waitFor(() =>
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining(
            Object.fromEntries(
              fields.map(([label, value]) => [
                {
                  "Account Number": "accountNumber",
                  "Client Name": "clientName",
                  "MIC Email": "micEmail",
                  "MIC Name": "micName",
                  "MIC Name and Initial": "micNameAndInitial",
                  "Recipient Address": "recipientAddress",
                  "Recipient Name": "recipientName",
                  "To The Manager": "recipientName",
                  "Year End Date": "yearEndDate",
                }[label],
                value,
              ])
            )
          )
        )
      );
    }
  );

  it("lets the securities template choose and save its salutation", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={{}}
        onSave={onSave}
        onSubmit={vi.fn()}
        onTemplateSelect={vi.fn()}
        templateCode="SECURITIES_CONFIRMATION_ENGLISH_TYPE_2"
        uploadedDocumentDocxUrl="blob:securities-preview"
      />
    );

    const ref = screen.getByLabelText("Ref");
    const date = screen.getByLabelText("Date");
    expect(ref).toHaveAttribute("placeholder", "");
    expect(date).toHaveAttribute("placeholder", "");

    await user.click(screen.getByLabelText("Sir/Madam"));
    await user.click(await screen.findByRole("option", { name: "Sir" }));

    const salutation = screen.getByLabelText("Sir/Madam");
    expect(salutation).toHaveAttribute("aria-expanded", "false");
    expect(salutation).toHaveTextContent("Sir");
    expect(
      Number.parseFloat(
        salutation.closest<HTMLElement>("[data-confirmation-field]")?.style
          .width ?? "0"
      )
    ).toBeLessThan(250);
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ salutation: "Sir" })
      )
    );
  });

  it.each([
    "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
    "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
  ] as const)("absorbs the source Ref/Date lines for %s", (code) => {
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={{}}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
        onTemplateSelect={vi.fn()}
        templateCode={code}
        uploadedDocumentDocxUrl="blob:securities-preview"
      />
    );

    const covers = [
      ...screen
        .getByTestId("confirmation-editable-overlay")
        .querySelectorAll<HTMLElement>("[data-confirmation-source-line-cover]"),
    ];
    for (const label of ["Ref", "Date"]) {
      const input = screen.getByLabelText(label);
      const field = input.closest<HTMLElement>("[data-confirmation-field]");
      expect(field).toHaveAttribute("data-source-line-absorbed", "true");
      expect(input).toHaveClass(
        "bg-white",
        "rounded-sm",
        "border",
        "border-slate-300"
      );
    }
    expect(covers).toHaveLength(2);

    for (const [index, label] of ["Ref", "Date"].entries()) {
      const field = screen
        .getByLabelText(label)
        .closest("[data-confirmation-field]") as HTMLElement;
      const cover = requiredFixture(covers[index]);
      const height = Number.parseFloat(field.style.height);
      const left = Number.parseFloat(field.style.left);
      const width = Number.parseFloat(field.style.width);
      const leadingRatio = requiredFixture([0.3, 0.4][index]);
      expect(Number.parseFloat(cover.style.left)).toBeCloseTo(
        left - height * leadingRatio
      );
      expect(Number.parseFloat(cover.style.width)).toBeCloseTo(
        width + height * leadingRatio
      );
    }
  });

  it.each([
    "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
    "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
    "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
  ] as const)("keeps the DOCX salutation fully visible for %s", (code) => {
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={{ salutation: "Sir/Madam" }}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
        onTemplateSelect={vi.fn()}
        templateCode={code}
        uploadedDocumentDocxUrl="blob:managed-docx-preview"
      />
    );

    const trigger = screen.getByLabelText("Sir/Madam");
    const field = trigger.closest<HTMLElement>("[data-confirmation-field]");
    const cover = field?.previousElementSibling as HTMLElement | null;

    expect(trigger).toHaveTextContent("Sir/Madam");
    expect(trigger).toHaveClass("min-w-0", "leading-none");
    expect(cover).toHaveAttribute("data-confirmation-source-cover", "true");
    expect(Number.parseFloat(cover?.style.width ?? "0")).toBeGreaterThanOrEqual(
      Number.parseFloat(field?.style.width ?? "0")
    );
  });

  it.each([
    [
      "explicit year-end date",
      { yearEndDate: "2027-12-31", reportDate: "2025-12-31" },
      "2027-12-31",
    ],
    [
      "report date for an empty year-end date",
      { yearEndDate: "", reportDate: "2025-12-31" },
      "2025-12-31",
    ],
    ["derived balance-sheet date", {}, "2026-12-31"],
  ] as const)(
    "uses the %s as the securities year-end date fallback in Type1 and Type2",
    (_caseName, draftPayload, expectedYearEndDate) => {
      for (const code of [
        "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
        "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
      ] as const) {
        render(
          <ProjectConfirmationEditor
            copy={defaultProjectConfirmationsCopy}
            derivedValues={derivedValues}
            draftPayload={draftPayload}
            onSave={vi.fn()}
            onSubmit={vi.fn()}
            onTemplateSelect={vi.fn()}
            templateCode={code}
            uploadedDocumentDocxUrl="blob:securities-preview"
          />
        );

        expect(screen.getByLabelText("Year End Date")).toHaveValue(
          expectedYearEndDate
        );
        cleanup();
      }
    }
  );

  it("opens base-information choices for a linked dynamic text field", async () => {
    const user = userEvent.setup();

    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        baseInformationOptions={{ clientNames: ["Client A", "Client B"] }}
        draftPayload={
          {
            clientName: "Client A",
            templateDesignSchema: {
              version: 1,
              fields: [
                {
                  id: "linked-client",
                  kind: "TEXT",
                  name: "Client Name",
                  placeholder: "Choose client",
                  options: [],
                  baseInformationBinding: "clientName",
                  page: 1,
                  x: 0.1,
                  y: 0.1,
                  width: 0.3,
                  height: 0.04,
                },
              ],
            },
            templateFieldValues: {},
          } as never
        }
        onSave={vi.fn()}
        onSubmit={vi.fn()}
        onTemplateSelect={vi.fn()}
        templateCode="CTPL-123456789ABC"
        uploadedDocumentDocxUrl="blob:custom-template-preview"
      />
    );

    const field = screen.getByRole("combobox", { name: "Client Name" });
    expect(field).toHaveValue("");
    expect(field).not.toHaveAttribute("list");

    await user.click(field);

    await expect(
      screen.findByRole("option", { name: "Client B" })
    ).resolves.toBeVisible();
  });

  it("uses the same compact option-box design for linked and standard fields", async () => {
    const user = userEvent.setup();

    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        baseInformationOptions={{ clientNames: ["Client A"] }}
        draftPayload={
          {
            clientName: "Client A",
            templateDesignSchema: {
              version: 1,
              fields: [
                {
                  id: "linked-client-style",
                  kind: "TEXT",
                  name: "Linked client style",
                  placeholder: "Choose client",
                  options: [],
                  baseInformationBinding: "clientName",
                  page: 1,
                  x: 0.1,
                  y: 0.1,
                  width: 0.3,
                  height: 0.04,
                },
                {
                  id: "standard-status-style",
                  kind: "SELECT",
                  name: "Standard status style",
                  placeholder: "Choose status",
                  options: ["Option A"],
                  page: 1,
                  x: 0.1,
                  y: 0.2,
                  width: 0.3,
                  height: 0.04,
                },
              ],
            },
            templateFieldValues: {},
          } as never
        }
        onSave={vi.fn()}
        onSubmit={vi.fn()}
        onTemplateSelect={vi.fn()}
        templateCode="CTPL-123456789ABC"
        uploadedDocumentDocxUrl="blob:custom-template-preview"
      />
    );

    await user.click(
      screen.getByRole("combobox", { name: "Linked client style" })
    );
    const linkedPopup = screen.getByRole("listbox", {
      name: "Linked client style options",
    });
    const linkedOption = screen.getByRole("option", { name: "Client A" });

    expect(linkedPopup).toHaveClass(
      "max-h-40",
      "min-w-0",
      "overflow-auto",
      "rounded-sm",
      "border-primary",
      "bg-white",
      "p-1",
      "shadow-lg",
      "outline-none"
    );
    expect(linkedOption).toHaveClass(
      "px-2",
      "py-0.5",
      "text-xs!",
      "leading-4!"
    );

    await user.click(document.body);
    await user.click(
      screen.getByRole("combobox", { name: "Standard status style" })
    );

    const standardPopup = await waitFor(() => {
      const popup = document.querySelector<HTMLElement>(
        '[data-slot="select-content"][data-open]'
      );
      expect(popup).not.toBeNull();
      return popup as HTMLElement;
    });
    const standardOption = await screen.findByRole("option", {
      name: "Option A",
    });
    expect(standardPopup).toHaveAttribute("data-align-trigger", "false");
    expect(standardPopup).toHaveClass(
      "max-h-40",
      "min-w-0",
      "rounded-sm",
      "border-primary",
      "bg-white",
      "p-1",
      "shadow-lg",
      "outline-none"
    );
    expect(standardPopup).toHaveClass("overflow-x-hidden", "overflow-y-auto");
    expect(standardOption).toHaveClass(
      "px-2",
      "py-0.5",
      "text-xs!",
      "leading-4!"
    );
  });

  it("closes linked field choices on outside click or Escape", async () => {
    const user = userEvent.setup();

    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        baseInformationOptions={{ clientNames: ["Client A", "Client B"] }}
        draftPayload={
          {
            clientName: "Client A",
            templateDesignSchema: {
              version: 1,
              fields: [
                {
                  id: "linked-client-close",
                  kind: "TEXT",
                  name: "Client Name",
                  placeholder: "Choose client",
                  options: [],
                  baseInformationBinding: "clientName",
                  page: 1,
                  x: 0.1,
                  y: 0.1,
                  width: 0.3,
                  height: 0.04,
                },
              ],
            },
            templateFieldValues: {},
          } as never
        }
        onSave={vi.fn()}
        onSubmit={vi.fn()}
        onTemplateSelect={vi.fn()}
        templateCode="CTPL-123456789ABC"
        uploadedDocumentDocxUrl="blob:custom-template-preview"
      />
    );

    const field = screen.getByRole("combobox", { name: "Client Name" });
    await user.click(field);
    expect(screen.getByRole("listbox")).toBeVisible();

    await user.click(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("does not add the current scalar binding to the dropdown", async () => {
    const user = userEvent.setup();
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={
          {
            clientName: "Client A",
            templateDesignSchema: {
              version: 1,
              fields: [
                {
                  id: "linked-client",
                  kind: "TEXT",
                  name: "Client Name",
                  placeholder: "Choose client",
                  options: [],
                  baseInformationBinding: "clientName",
                  page: 1,
                  x: 0.1,
                  y: 0.1,
                  width: 0.3,
                  height: 0.04,
                },
              ],
            },
            templateFieldValues: {},
          } as never
        }
        onSave={vi.fn()}
        onSubmit={vi.fn()}
        onTemplateSelect={vi.fn()}
        templateCode="CTPL-123456789ABC"
        uploadedDocumentDocxUrl="blob:custom-template-preview"
      />
    );

    const field = screen.getByRole("combobox", { name: "Client Name" });
    expect(field).toHaveValue("");
    await user.click(field);
    expect(screen.getByRole("listbox")).toHaveTextContent(
      "No options available"
    );
    expect(screen.queryByRole("option", { name: "Client A" })).toBeNull();
  });

  it("automatically fills custom project fields and lists their saved content", async () => {
    const user = userEvent.setup();
    render(
      <ProjectConfirmationEditor
        baseInformationOptions={{
          customFields: [
            { id: "department-1", name: "Department", value: "Audit team" },
          ],
        }}
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={
          {
            clientName: "Client A",
            templateDesignSchema: {
              version: 1,
              fields: [
                {
                  id: "linked-client",
                  kind: "TEXT",
                  name: "Client Name",
                  placeholder: "Choose client",
                  options: [],
                  baseInformationBinding: "custom:department-1",
                  page: 1,
                  x: 0.1,
                  y: 0.1,
                  width: 0.3,
                  height: 0.04,
                },
              ],
            },
            templateFieldValues: {},
          } as never
        }
        onSave={vi.fn()}
        onSubmit={vi.fn()}
        onTemplateSelect={vi.fn()}
        templateCode="CTPL-123456789ABC"
        uploadedDocumentDocxUrl="blob:custom-template-preview"
      />
    );

    const field = screen.getByRole("combobox", { name: "Client Name" });
    await waitFor(() => expect(field).toHaveValue("Audit team"));
    await user.click(field);
    expect(screen.getByRole("option", { name: "Audit team" })).toBeVisible();
    expect(screen.queryByRole("option", { name: "Client A" })).toBeNull();
  });

  it("does not retain edited linked values as choices", async () => {
    const user = userEvent.setup();

    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={
          {
            referenceCode: "REF-001",
            templateDesignSchema: {
              version: 1,
              fields: [
                {
                  id: "linked-reference-clear",
                  kind: "TEXT",
                  name: "Reference",
                  placeholder: "Ref",
                  options: [],
                  baseInformationBinding: "referenceCode",
                  page: 1,
                  x: 0.1,
                  y: 0.1,
                  width: 0.3,
                  height: 0.04,
                },
              ],
            },
            templateFieldValues: {},
          } as never
        }
        onSave={vi.fn()}
        onSubmit={vi.fn()}
        onTemplateSelect={vi.fn()}
        templateCode="CTPL-123456789ABC"
        uploadedDocumentDocxUrl="blob:custom-template-preview"
      />
    );

    const field = screen.getByRole("combobox", { name: "Reference" });
    await user.click(field);
    expect(screen.queryByRole("option", { name: "REF-001" })).toBeNull();

    fireEvent.change(field, { target: { value: "REF-00" } });
    fireEvent.change(field, { target: { value: "REF-0" } });
    fireEvent.change(field, { target: { value: "" } });
    expect(field).toHaveValue("");
    expect(screen.getByRole("listbox")).toHaveClass("max-h-40");
    expect(screen.getByRole("listbox")).toHaveTextContent(
      "No options available"
    );
  });

  it("keeps dynamic field borders and font scale aligned with the template workbench", () => {
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={
          {
            templateDesignSchema: {
              version: 1,
              fields: [
                {
                  id: "styled-dynamic-field",
                  kind: "TEXT",
                  name: "Styled dynamic field",
                  placeholder: "Styled prompt",
                  options: [],
                  textStyle: {
                    bold: true,
                    fontFamily: "Arial",
                    fontSize: 20,
                    italic: true,
                    underline: true,
                  },
                  page: 1,
                  x: 0.1,
                  y: 0.1,
                  width: 0.3,
                  height: 0.04,
                },
              ],
            },
            templateFieldValues: { "styled-dynamic-field": "Styled value" },
          } as never
        }
        onSave={vi.fn()}
        onSubmit={vi.fn()}
        onTemplateSelect={vi.fn()}
        templateCode="CTPL-123456789ABC"
        uploadedDocumentDocxUrl="blob:font-scale-test"
      />
    );

    const field = screen.getByLabelText("Styled dynamic field");
    expect(field).toHaveClass("rounded-sm", "border-primary", "bg-transparent");
    expect(field).toHaveStyle({ fontSize: `${(20 / 900) * 1122}px` });
  });

  it("uses PDF point sizes for fields over the canonical PDF preview", () => {
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={
          {
            templateDesignSchema: {
              version: 1,
              fields: [
                {
                  id: "pdf-styled-field",
                  kind: "TEXT",
                  name: "PDF styled field",
                  placeholder: "PDF styled prompt",
                  options: [],
                  textStyle: {
                    bold: false,
                    fontFamily: "Arial",
                    fontSize: 20,
                    italic: false,
                    underline: false,
                  },
                  page: 1,
                  x: 0.1,
                  y: 0.1,
                  width: 0.3,
                  height: 0.04,
                },
              ],
            },
            templateFieldValues: { "pdf-styled-field": "PDF value" },
          } as never
        }
        onSave={vi.fn()}
        onSubmit={vi.fn()}
        onTemplateSelect={vi.fn()}
        templateCode="CTPL-123456789ABC"
        uploadedDocumentUrl="blob:canonical-pdf-preview"
      />
    );

    expect(screen.getByLabelText("PDF styled field")).toHaveStyle({
      fontSize: "20px",
    });
    expect(screen.getByTestId("mock-pdf-viewer")).toHaveAttribute(
      "data-viewport-gap",
      "0"
    );
    expect(screen.getByTestId("confirmation-draft-document-shell")).toHaveClass(
      "overflow-hidden"
    );
    expect(
      screen.getByTestId("confirmation-draft-document-shell")
    ).not.toHaveClass("p-3", "sm:p-6", "lg:p-8");
  });

  it("keeps applied text controls flush with their field geometry", () => {
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        baseInformationOptions={{ clientNames: ["Client A"] }}
        draftPayload={
          {
            templateDesignSchema: {
              version: 1,
              fields: [
                {
                  id: "aligned-text",
                  kind: "TEXT",
                  name: "Aligned text",
                  placeholder: "Text",
                  options: [],
                  page: 1,
                  x: 0.1,
                  y: 0.1,
                  width: 0.3,
                  height: 0.04,
                },
                {
                  id: "aligned-linked",
                  kind: "TEXT",
                  name: "Aligned linked",
                  placeholder: "Client",
                  options: [],
                  baseInformationBinding: "clientName",
                  page: 1,
                  x: 0.1,
                  y: 0.2,
                  width: 0.3,
                  height: 0.04,
                },
              ],
            },
            templateFieldValues: {},
          } as never
        }
        onSave={vi.fn()}
        onSubmit={vi.fn()}
        onTemplateSelect={vi.fn()}
        templateCode="CTPL-123456789ABC"
        uploadedDocumentDocxUrl="blob:custom-template-preview"
      />
    );

    expect(screen.getByLabelText("Aligned text")).toHaveClass("block");
    expect(
      screen.getByRole("combobox", { name: "Aligned linked" })
    ).toHaveClass("block");
  });

  it("gives the managed template menu enough width without narrow-screen overflow", async () => {
    render(
      <ProjectConfirmationEditor
        copy={defaultProjectConfirmationsCopy}
        derivedValues={derivedValues}
        draftPayload={{}}
        templateCode={null}
        availableTemplateOptions={[
          {
            code: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
            label: "Bank Confirmation - HK Standard (English)",
          },
        ]}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
        onTemplateSelect={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText("Confirmation template"));

    const item = screen.getByRole("option", {
      name: /Bank Confirmation - HK Standard \(English\)/,
    });
    await waitFor(() => expect(item).toBeVisible());
    const content = item.closest('[data-slot="popover-content"]');

    expect(content).toHaveClass("p-2");
    expect(item).toHaveClass("h-auto", "min-h-8", "w-full");
  });
});
