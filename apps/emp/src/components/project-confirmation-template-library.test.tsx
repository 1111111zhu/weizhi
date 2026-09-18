// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ConfirmationTemplateDesign,
  ConfirmationTemplateLibraryFile,
} from "../api/client";
import { ProjectConfirmationsPanel } from "./project-confirmations-panel";
import { ToastProvider } from "./toast";

const mockApi = vi.hoisted(() => ({
  addProjectConfirmationResponseArtifacts: vi.fn(),
  confirmationTemplateLibrary: vi.fn(),
  confirmationTemplateLibraryDownloadUrl: vi.fn(),
  previewConfirmationTemplateLibraryFile: vi.fn(),
  createProjectConfirmation: vi.fn(),
  createProjectConfirmationDispatch: vi.fn(),
  deleteConfirmationTemplateLibraryFile: vi.fn(),
  previewProjectConfirmationPdf: vi.fn(),
  projectConfirmationResponseArtifact: vi.fn(),
  projectConfirmations: vi.fn(),
  receiveProjectConfirmationResponse: vi.fn(),
  removeProjectConfirmationContent: vi.fn(),
  removeProjectConfirmationFile: vi.fn(),
  submitProjectConfirmation: vi.fn(),
  updateConfirmationTemplateLibraryDesign: vi.fn(),
  updateConfirmationTemplateLibraryStatus: vi.fn(),
  bulkUpdateConfirmationTemplateLibraryStatus: vi.fn(),
  updateProjectConfirmation: vi.fn(),
  updateProjectConfirmationDraft: vi.fn(),
  uploadConfirmationTemplateLibraryFile: vi.fn(),
  uploadProjectConfirmation: vi.fn(),
  uploadProjectConfirmationFile: vi.fn(),
  withdrawProjectConfirmation: vi.fn(),
  withdrawProjectConfirmationResponse: vi.fn(),
}));

vi.mock("../api/client", () => ({
  api: mockApi,
  ApiError: class MockApiError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly requestId: string
    ) {
      super(message);
    }
  },
}));

vi.mock("./confirmations/confirmation-template-workbench", () => ({
  ConfirmationTemplateWorkbench: ({
    onBack,
    onSave,
    template,
  }: {
    onBack: () => void;
    onSave: (input: {
      designSchema: ConfirmationTemplateDesign;
      designStatus: "DRAFT" | "ENABLED";
    }) => Promise<void>;
    template: ConfirmationTemplateLibraryFile;
  }) => (
    <section
      data-read-only="false"
      data-status={template.designStatus}
      data-testid="mock-confirmation-template-workbench"
      data-template-id={template.id}
    >
      <h2>Template workbench</h2>
      <button type="button" onClick={onBack}>
        Back
      </button>
      <button
        type="button"
        onClick={() =>
          void onSave({
            designSchema: MOCK_DESIGN_SCHEMA,
            designStatus: "DRAFT",
          })
        }
      >
        Save draft
      </button>
      <button
        type="button"
        onClick={() =>
          void onSave({
            designSchema: MOCK_DESIGN_SCHEMA,
            designStatus: "ENABLED",
          })
        }
      >
        Enable
      </button>
    </section>
  ),
}));

const MOCK_DESIGN_SCHEMA: ConfirmationTemplateDesign = {
  fields: [
    {
      height: 0.045,
      id: "field-1",
      kind: "TEXT",
      name: "Confirmation reference",
      options: [],
      page: 1,
      placeholder: "Enter reference",
      width: 0.28,
      x: 0.2,
      y: 0.3,
    },
  ],
  version: 1,
};

function makeTemplate(
  overrides: Partial<ConfirmationTemplateLibraryFile> = {}
): ConfirmationTemplateLibraryFile {
  return {
    code: "CTPL-TEST",
    confirmationType: "BANK",
    createdAt: "2026-08-15T00:00:00.000Z",
    designSchema: null,
    designStatus: "DRAFT",
    description: null,
    enabledAt: null,
    fileName: "bank-confirmation.docx",
    fileSize: 65_536,
    id: "template-custom",
    isBuiltIn: false,
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    name: "Custom bank confirmation",
    updatedAt: "2026-08-15T00:00:00.000Z",
    uploadedById: "user-1",
    uploader: { id: "user-1", name: "Bonnie Su" },
    ...overrides,
  };
}

function withDesignStatus(
  template: ConfirmationTemplateLibraryFile,
  designStatus: "DRAFT" | "ENABLED" | "DISABLED"
): ConfirmationTemplateLibraryFile {
  return {
    ...template,
    designStatus,
  } as unknown as ConfirmationTemplateLibraryFile;
}

function renderPanel(
  globalRole: "STAFF" | "MANAGER" | "PARTNER" | "SUPER_ADMIN" = "STAFF"
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <ProjectConfirmationsPanel
          projectId="project-1"
          currentUser={{
            id: "user-1",
            name: "Bonnie Su",
            email: "bonnie@example.test",
            globalRole,
          }}
          members={[]}
          commonCopy={{ cancel: "Cancel" } as never}
          locale="en-US"
        />
      </ToastProvider>
    </QueryClientProvider>
  );
}

async function openTemplateLibrary() {
  fireEvent.click(
    await screen.findByRole("button", { name: "Confirmation templates" })
  );
  const library = await screen.findByRole("region", {
    name: "Confirmation templates",
  });
  await waitFor(() =>
    expect(within(library).getAllByRole("row").length).toBeGreaterThan(1)
  );
  return library;
}

describe("confirmation template library", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.projectConfirmations.mockResolvedValue([]);
    mockApi.confirmationTemplateLibrary.mockReset();
    mockApi.confirmationTemplateLibrary.mockResolvedValue([
      {
        id: "template-1",
        code: "CTPL-123456789ABC",
        name: "Bank confirmation letter",
        confirmationType: "BANK",
        fileName: "bank-confirmation.docx",
        fileSize: 65_536,
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        isBuiltIn: false,
        uploadedById: "admin-1",
        uploader: {
          id: "admin-1",
          name: "Jony Ma",
        },
        createdAt: "2026-07-27T08:00:00.000Z",
        updatedAt: "2026-07-27T08:00:00.000Z",
      },
    ]);
    mockApi.uploadConfirmationTemplateLibraryFile.mockReset();
    mockApi.deleteConfirmationTemplateLibraryFile.mockReset();
    mockApi.updateConfirmationTemplateLibraryDesign.mockReset();
    mockApi.updateConfirmationTemplateLibraryDesign.mockResolvedValue(
      makeTemplate()
    );
    mockApi.updateConfirmationTemplateLibraryStatus.mockReset();
    mockApi.bulkUpdateConfirmationTemplateLibraryStatus.mockReset();
    mockApi.confirmationTemplateLibraryDownloadUrl.mockReturnValue(
      "https://api.example.test/confirmations/template-library/template-1/download"
    );
    mockApi.previewConfirmationTemplateLibraryFile.mockReturnValue(
      new Promise(() => undefined)
    );
  });

  afterEach(cleanup);

  it("opens the library and downloads a selected Word template", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    renderPanel();

    fireEvent.click(
      await screen.findByRole("button", { name: "Confirmation templates" })
    );

    expect(
      await screen.findByRole("region", { name: "Confirmation templates" })
    ).toBeVisible();
    expect(await screen.findByText("Bank confirmation letter")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    expect(mockApi.confirmationTemplateLibraryDownloadUrl).toHaveBeenCalledWith(
      "template-1"
    );
    expect(open).toHaveBeenCalledWith(
      "https://api.example.test/confirmations/template-library/template-1/download",
      "_blank",
      "noopener,noreferrer"
    );
    open.mockRestore();
  });

  it("opens a reusable right-side preview when the template row is clicked", async () => {
    renderPanel();

    fireEvent.click(
      await screen.findByRole("button", { name: "Confirmation templates" })
    );
    const templateLibrary = await screen.findByRole("region", {
      name: "Confirmation templates",
    });
    fireEvent.click(
      await screen.findByRole("row", {
        name: /Bank confirmation letter/,
      })
    );

    const grid = within(templateLibrary).getByTestId(
      "confirmation-template-library-data-grid"
    );
    expect(grid.parentElement).toHaveAttribute("data-preview-open", "true");
    expect(grid.parentElement).toHaveClass(
      "[&_[data-slot=frame]]:rounded-r-none",
      "[&_[data-slot=frame]]:border-r-0"
    );
    expect(
      await screen.findByRole("region", {
        name: "Preview: Bank confirmation letter",
      })
    ).toBeVisible();
    expect(mockApi.previewConfirmationTemplateLibraryFile).toHaveBeenCalledWith(
      "template-1"
    );

    fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
    expect(
      screen.queryByRole("region", {
        name: "Preview: Bank confirmation letter",
      })
    ).toBeNull();
  });

  it("keeps the template table focused on actionable columns", async () => {
    renderPanel();

    fireEvent.click(
      await screen.findByRole("button", { name: "Confirmation templates" })
    );

    expect(screen.queryByText("Jony Ma")).toBeNull();
    expect(screen.queryByText("Size")).toBeNull();
    expect(screen.queryByText("Last updated by")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(
      await screen.findByRole("region", {
        name: "Preview: Bank confirmation letter",
      })
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Expand preview" })
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Open in new window" })
    ).toBeVisible();
  });

  it("hides row management actions from an ordinary user", async () => {
    renderPanel();

    const library = await openTemplateLibrary();

    expect(
      within(library).queryByRole("button", { name: "Upload template" })
    ).toBeNull();
    expect(
      within(library).queryByRole("button", { name: "Enable template" })
    ).toBeNull();
    expect(
      within(library).queryByRole("button", { name: "Disable template" })
    ).toBeNull();
    expect(
      within(library).queryByRole("button", { name: "Design template" })
    ).toBeNull();
    expect(
      within(library).queryByRole("button", { name: "Delete template" })
    ).toBeNull();
    expect(
      within(library).getByRole("button", { name: "Preview" })
    ).toBeVisible();
    expect(
      within(library).getByRole("button", { name: "Download" })
    ).toBeVisible();
  });

  it("keeps row management actions visible to Super Admin", async () => {
    renderPanel("SUPER_ADMIN");

    const library = await openTemplateLibrary();

    expect(
      within(library).getByRole("button", { name: "Enable template" })
    ).toBeVisible();
    expect(
      within(library).getByRole("button", { name: "Design template" })
    ).toBeVisible();
    expect(
      within(library).getByRole("button", { name: "Delete template" })
    ).toBeVisible();
    expect(
      within(library).getByRole("button", { name: "Preview" })
    ).toBeVisible();
    expect(
      within(library).getByRole("button", { name: "Download" })
    ).toBeVisible();
  });

  it("keeps Partner access read-only", async () => {
    renderPanel("PARTNER");

    const library = await openTemplateLibrary();

    expect(
      within(library).queryByRole("button", { name: "Upload template" })
    ).toBeNull();
    expect(
      within(library).queryByRole("button", { name: "Enable template" })
    ).toBeNull();
    expect(
      within(library).queryByRole("button", { name: "Design template" })
    ).toBeNull();
    expect(
      within(library).queryByRole("button", { name: "Delete template" })
    ).toBeNull();
    expect(
      within(library).getByRole("button", { name: "Preview" })
    ).toBeVisible();
    expect(
      within(library).getByRole("button", { name: "Download" })
    ).toBeVisible();
  });

  it("uses the shared 30-row themed pagination footer", async () => {
    mockApi.confirmationTemplateLibrary.mockResolvedValue(
      Array.from({ length: 51 }, (_, index) =>
        makeTemplate({
          id: `template-${index + 1}`,
          code: `CTPL-${String(index + 1).padStart(3, "0")}`,
          name: `Template ${index + 1}`,
        })
      )
    );
    renderPanel("SUPER_ADMIN");

    const library = await openTemplateLibrary();
    expect(
      within(library).getByRole("textbox", {
        name: "Search template name, code, or file name",
      })
    ).toBeVisible();
    await expect(
      within(library).findByText("Template 1")
    ).resolves.toBeVisible();
    expect(within(library).getAllByRole("row")).toHaveLength(31);
    expect(screen.getByText("1-30 / 51")).toBeVisible();

    const pageSize = screen.getByRole("combobox", { name: "Rows per page" });
    expect(pageSize).toHaveTextContent("30 / page");
    expect(
      screen
        .getByRole("button", { name: "Page 1" })
        .compareDocumentPosition(pageSize) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));

    await waitFor(() =>
      expect(within(library).getAllByRole("row")).toHaveLength(22)
    );
    expect(screen.getByText("31-51 / 51")).toBeVisible();
  });

  it("filters the complete template library before paginating", async () => {
    const user = userEvent.setup();
    mockApi.confirmationTemplateLibrary.mockResolvedValue(
      Array.from({ length: 51 }, (_, index) =>
        makeTemplate({
          id: `template-${index + 1}`,
          code: `CTPL-${String(index + 1).padStart(3, "0")}`,
          name: `Template ${index + 1}`,
        })
      )
    );
    renderPanel("SUPER_ADMIN");

    const library = await openTemplateLibrary();
    expect(
      within(library).getByRole("button", {
        name: "Filter Template no.",
      })
    ).toBeVisible();
    await user.click(
      within(library).getByRole("button", {
        name: "Filter Template no.",
      })
    );
    const filter = screen
      .getByRole("searchbox", { name: "Search filter options" })
      .closest('[data-slot="popover-content"]') as HTMLElement;
    await user.click(
      within(filter).getByRole("checkbox", { name: "CTPL-051" })
    );

    await waitFor(() =>
      expect(within(library).getByText("Template 51")).toBeVisible()
    );
    expect(within(library).getAllByRole("row")).toHaveLength(2);
    expect(screen.queryByText("1-50 / 51")).not.toBeInTheDocument();
  });

  it("clears hidden template selections when moving to another page", async () => {
    const user = userEvent.setup();
    mockApi.confirmationTemplateLibrary.mockResolvedValue(
      Array.from({ length: 51 }, (_, index) =>
        makeTemplate({
          id: `template-${index + 1}`,
          code: `CTPL-${String(index + 1).padStart(3, "0")}`,
          name: `Template ${index + 1}`,
        })
      )
    );
    renderPanel("SUPER_ADMIN");

    const library = await openTemplateLibrary();
    await user.click(
      within(library).getByRole("button", { name: "Enable selected" })
    );
    await user.click(
      within(library).getByRole("checkbox", {
        name: "Select template: Template 1",
      })
    );
    expect(
      within(library).getByRole("button", { name: "Enable selected" })
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Page 2" }));

    await waitFor(() => {
      expect(
        within(library).getByRole("button", { name: "Enable selected" })
      ).toHaveAttribute("aria-pressed", "false");
      expect(
        within(library).queryByRole("checkbox", {
          name: "Select template: Template 51",
        })
      ).not.toBeInTheDocument();
    });
  });

  it("left-aligns row actions and shows a disclosure arrow", async () => {
    renderPanel();

    const library = await openTemplateLibrary();
    const row = within(library).getByRole("row", {
      name: /Bank confirmation letter/,
    });
    const actionsHeader = within(library).getByRole("columnheader", {
      name: "Actions",
    });
    const actionsCell = within(row)
      .getByRole("button", { name: "Preview" })
      .closest("td");

    expect(actionsHeader).toHaveClass("text-left");
    expect(actionsCell).toHaveClass("text-left");
    const disclosure = within(row).getByTestId(
      "template-row-disclosure-template-1"
    );
    expect(disclosure).toBeVisible();
    expect(disclosure.parentElement).not.toHaveClass("justify-between");
  });

  it("uploads a PDF template with the form values and refreshes the library", async () => {
    const user = userEvent.setup();
    const file = new File(["%PDF-1.7"], "uploaded-bank-template.pdf", {
      type: "application/pdf",
    });
    mockApi.uploadConfirmationTemplateLibraryFile.mockResolvedValueOnce({
      id: "template-uploaded",
    });
    renderPanel("SUPER_ADMIN");

    await user.click(
      await screen.findByRole("button", { name: "Confirmation templates" })
    );
    await user.click(
      await screen.findByRole("button", { name: "Upload template" })
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Upload confirmation template",
    });
    expect(dialog).toHaveTextContent(
      "Valid PDF templates up to 20 MB are supported."
    );
    await user.type(
      within(dialog).getByLabelText("Template name"),
      "Uploaded bank template"
    );
    const fileInput =
      dialog.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    expect(fileInput).toHaveAttribute(
      "accept",
      ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(fileInput).toHaveAttribute("multiple");
    expect(
      within(dialog).getByRole("button", { name: "Choose a template file" })
    ).toBeVisible();
    await user.upload(fileInput!, file);
    expect(
      within(dialog).getByText("uploaded-bank-template.pdf")
    ).toBeVisible();

    await user.click(within(dialog).getByRole("button", { name: "Upload" }));

    await waitFor(() =>
      expect(
        mockApi.uploadConfirmationTemplateLibraryFile
      ).toHaveBeenCalledWith({
        name: "Uploaded bank template",
        confirmationType: "BANK",
        file,
      })
    );
    await waitFor(() =>
      expect(mockApi.confirmationTemplateLibrary).toHaveBeenCalled()
    );
    expect(
      screen.queryByRole("dialog", { name: "Upload confirmation template" })
    ).toBeNull();
  });

  it("keeps legacy DOC rows usable without exposing the DOCX workbench", async () => {
    mockApi.confirmationTemplateLibrary.mockResolvedValue([
      makeTemplate({
        id: "legacy-template",
        fileName: "legacy.doc",
        mimeType: "application/msword",
        name: "Legacy bank confirmation",
      }),
    ]);
    renderPanel("MANAGER");

    const library = await openTemplateLibrary();

    expect(
      await within(library).findByText("Legacy bank confirmation")
    ).toBeVisible();
    expect(
      within(library).queryByRole("button", { name: "Design template" })
    ).toBeNull();
    expect(
      within(library).getByRole("button", { name: "Preview" })
    ).toBeVisible();
    expect(
      within(library).getByRole("button", { name: "Download" })
    ).toBeVisible();
    expect(
      within(library).queryByRole("button", { name: "Delete template" })
    ).toBeNull();
  });

  it("uploads multiple PDF templates as separate templates named from their files", async () => {
    const user = userEvent.setup();
    const files = [
      new File(["%PDF-1.7"], "bank-confirmation.pdf", {
        type: "application/pdf",
      }),
      new File(["%PDF-1.7"], "securities-confirmation.pdf", {
        type: "application/pdf",
      }),
    ];
    mockApi.uploadConfirmationTemplateLibraryFile
      .mockResolvedValueOnce({ id: "template-bank" })
      .mockResolvedValueOnce({ id: "template-securities" });
    renderPanel("SUPER_ADMIN");

    await user.click(
      await screen.findByRole("button", { name: "Confirmation templates" })
    );
    await user.click(
      await screen.findByRole("button", { name: "Upload template" })
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Upload confirmation template",
    });
    const fileInput =
      dialog.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    await user.upload(fileInput!, files);

    await user.click(within(dialog).getByRole("button", { name: "Upload" }));

    await waitFor(() =>
      expect(
        mockApi.uploadConfirmationTemplateLibraryFile
      ).toHaveBeenNthCalledWith(1, {
        name: "bank-confirmation",
        confirmationType: "BANK",
        file: files[0],
      })
    );
    expect(
      mockApi.uploadConfirmationTemplateLibraryFile
    ).toHaveBeenNthCalledWith(2, {
      name: "securities-confirmation",
      confirmationType: "BANK",
      file: files[1],
    });
  });

  it("shows deletion for a Super Admin on a custom template", async () => {
    mockApi.confirmationTemplateLibrary.mockResolvedValue([
      {
        id: "template-owned",
        code: "CTPL-OWNED",
        name: "My bank confirmation",
        confirmationType: "BANK",
        fileName: "my-bank-confirmation.docx",
        fileSize: 65_536,
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        isBuiltIn: false,
        uploadedById: "user-1",
        uploader: { id: "user-1", name: "Leo Li" },
        createdAt: "2026-07-27T08:00:00.000Z",
        updatedAt: "2026-07-27T08:00:00.000Z",
      },
    ]);
    renderPanel("SUPER_ADMIN");

    const library = await openTemplateLibrary();

    expect(
      within(library).getByRole("button", { name: "Delete template" })
    ).toBeVisible();
  });

  it("lets Super Admin delete another user's custom template", async () => {
    mockApi.confirmationTemplateLibrary.mockResolvedValue([
      {
        id: "template-owned-by-other",
        code: "CTPL-OTHER",
        name: "Another user's bank confirmation",
        confirmationType: "BANK",
        fileName: "another-bank-confirmation.docx",
        fileSize: 65_536,
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        isBuiltIn: false,
        uploadedById: "admin-1",
        uploader: { id: "admin-1", name: "Jony Ma" },
        createdAt: "2026-07-27T08:00:00.000Z",
        updatedAt: "2026-07-27T08:00:00.000Z",
      },
    ]);
    mockApi.deleteConfirmationTemplateLibraryFile.mockResolvedValueOnce({
      id: "template-owned-by-other",
    });
    renderPanel("SUPER_ADMIN");

    fireEvent.click(
      await screen.findByRole("button", { name: "Confirmation templates" })
    );
    const library = await screen.findByRole("region", {
      name: "Confirmation templates",
    });
    fireEvent.click(
      await within(library).findByRole("button", {
        name: "Delete template",
      })
    );

    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete template" })
    );

    await waitFor(() =>
      expect(
        mockApi.deleteConfirmationTemplateLibraryFile
      ).toHaveBeenCalledWith("template-owned-by-other")
    );
  });

  it("lets Super Admin delete any built-in template", async () => {
    mockApi.confirmationTemplateLibrary.mockResolvedValue(
      [
        [
          "STANDARD_FINANCIAL_INSTITUTION",
          "Standard financial institution",
          "standard-financial-institution-pdf-twin.docx",
          "BANK",
        ],
        [
          "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
          "Bank Confirmation - HK Standard (English)",
          "bank-confirmation-hk-standard-english.docx",
          "BANK",
        ],
        [
          "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
          "Securities Confirmation - English - Type 1",
          "securities-confirmation-english-type-1.docx",
          "INTERMEDIARY",
        ],
        [
          "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
          "Securities Confirmation - English - Type 2",
          "securities-confirmation-english-type-2.docx",
          "INTERMEDIARY",
        ],
      ].map(([code, name, fileName, confirmationType]) => ({
        id: `builtin-${code}`,
        code,
        name,
        confirmationType,
        fileName,
        fileSize: 100,
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        isBuiltIn: true,
        uploadedById: "SYSTEM",
        uploader: { id: "SYSTEM", name: "ProjectWing" },
        createdAt: "2026-08-15T00:00:00.000Z",
        updatedAt: "2026-08-15T00:00:00.000Z",
      }))
    );
    mockApi.deleteConfirmationTemplateLibraryFile.mockResolvedValueOnce({
      id: "builtin-STANDARD_FINANCIAL_INSTITUTION",
    });
    renderPanel("SUPER_ADMIN");

    fireEvent.click(
      await screen.findByRole("button", { name: "Confirmation templates" })
    );

    const library = await screen.findByRole("region", {
      name: "Confirmation templates",
    });
    await within(library).findByText("Standard financial institution");
    expect(within(library).getAllByRole("row")).toHaveLength(5);
    const deleteButtons = within(library).getAllByRole("button", {
      name: "Delete template",
    });
    expect(deleteButtons).toHaveLength(4);
    expect(deleteButtons[0]).toBeEnabled();
  });

  it("lets Super Admin open a system template in an editable workbench with a delete action", async () => {
    const user = userEvent.setup();
    const builtInTemplate = makeTemplate({
      code: "STANDARD_FINANCIAL_INSTITUTION",
      designStatus: "ENABLED",
      enabledAt: "2026-08-15T00:00:00.000Z",
      id: "builtin-standard-financial-institution",
      isBuiltIn: true,
      name: "Standard financial institution",
      uploadedById: "SYSTEM",
      uploader: { id: "SYSTEM", name: "ProjectWing" },
    });
    mockApi.confirmationTemplateLibrary.mockResolvedValue([builtInTemplate]);
    renderPanel("SUPER_ADMIN");

    const library = await openTemplateLibrary();
    expect(
      within(library).getByRole("button", { name: "Delete template" })
    ).toBeEnabled();
    await user.click(
      within(library).getByRole("button", { name: "Design template" })
    );

    const workbench = await screen.findByTestId(
      "mock-confirmation-template-workbench"
    );
    expect(workbench).toHaveAttribute("data-read-only", "false");
    expect(
      within(workbench).getByRole("button", { name: "Save draft" })
    ).toBeEnabled();
  });

  it("keeps system-template edit and status controls hidden from staff", async () => {
    const builtInTemplate = makeTemplate({
      code: "STANDARD_FINANCIAL_INSTITUTION",
      designStatus: "ENABLED",
      enabledAt: "2026-08-15T00:00:00.000Z",
      id: "builtin-standard-financial-institution",
      isBuiltIn: true,
      name: "Standard financial institution",
      uploadedById: "SYSTEM",
      uploader: { id: "SYSTEM", name: "ProjectWing" },
    });
    mockApi.confirmationTemplateLibrary.mockResolvedValue([builtInTemplate]);
    renderPanel();

    const library = await openTemplateLibrary();
    expect(
      within(library).queryByRole("button", { name: "Design template" })
    ).toBeNull();
    expect(
      within(library).queryByRole("button", { name: "Enable template" })
    ).toBeNull();
    expect(
      within(library).queryByRole("button", { name: "Disable template" })
    ).toBeNull();
  });

  it("lets a Super Admin edit and directly disable a system template from the list", async () => {
    const user = userEvent.setup();
    const builtInTemplate = makeTemplate({
      code: "STANDARD_FINANCIAL_INSTITUTION",
      designStatus: "ENABLED",
      enabledAt: "2026-08-15T00:00:00.000Z",
      id: "builtin-standard-financial-institution",
      isBuiltIn: true,
      name: "Standard financial institution",
      uploadedById: "SYSTEM",
      uploader: { id: "SYSTEM", name: "ProjectWing" },
    });
    mockApi.confirmationTemplateLibrary.mockResolvedValue([builtInTemplate]);
    mockApi.updateConfirmationTemplateLibraryStatus.mockResolvedValue(
      withDesignStatus(builtInTemplate, "DISABLED")
    );
    renderPanel("SUPER_ADMIN");

    const library = await openTemplateLibrary();
    expect(
      within(library).queryByRole("checkbox", {
        name: "Select template: Standard financial institution",
      })
    ).not.toBeInTheDocument();
    await user.click(
      within(library).getByRole("button", { name: "Design template" })
    );
    expect(
      await screen.findByTestId("mock-confirmation-template-workbench")
    ).toHaveAttribute("data-template-id", builtInTemplate.id);

    await user.click(screen.getByRole("button", { name: "Back" }));
    const reopenedLibrary = await screen.findByRole("region", {
      name: "Confirmation templates",
    });
    await user.click(
      within(reopenedLibrary).getByRole("button", { name: "Disable template" })
    );
    await waitFor(() =>
      expect(
        mockApi.updateConfirmationTemplateLibraryStatus
      ).toHaveBeenCalledWith(builtInTemplate.id, { designStatus: "DISABLED" })
    );
  });

  it("lets a Super Admin disable and re-enable a custom template from its row", async () => {
    const user = userEvent.setup();
    let currentTemplate = makeTemplate({
      designStatus: "ENABLED",
      id: "template-owned",
      name: "Owned bank confirmation",
      updatedAt: "2026-08-15T00:00:00.000Z",
      uploadedById: "user-1",
      uploader: { id: "user-1", name: "Bonnie Su" },
    });
    mockApi.confirmationTemplateLibrary.mockImplementation(() =>
      Promise.resolve([currentTemplate])
    );
    mockApi.updateConfirmationTemplateLibraryStatus.mockImplementation(
      async (
        templateId: string,
        input: { designStatus: "DRAFT" | "ENABLED" | "DISABLED" }
      ) => {
        expect(templateId).toBe(currentTemplate.id);
        currentTemplate = withDesignStatus(currentTemplate, input.designStatus);
        return currentTemplate;
      }
    );
    renderPanel("SUPER_ADMIN");

    let library = await openTemplateLibrary();
    let row = within(library).getByRole("row", {
      name: /Owned bank confirmation/,
    });
    await user.click(
      within(row).getByRole("button", { name: "Disable template" })
    );
    await waitFor(() =>
      expect(
        mockApi.updateConfirmationTemplateLibraryStatus
      ).toHaveBeenCalledWith("template-owned", { designStatus: "DISABLED" })
    );
    await waitFor(() =>
      expect(mockApi.confirmationTemplateLibrary).toHaveBeenCalled()
    );

    library = await screen.findByRole("region", {
      name: "Confirmation templates",
    });
    row = within(library).getByRole("row", {
      name: /Owned bank confirmation/,
    });
    expect(
      within(row).getByRole("button", { name: "Enable template" })
    ).toBeVisible();

    await user.click(
      within(row).getByRole("button", { name: "Enable template" })
    );
    await waitFor(() =>
      expect(
        mockApi.updateConfirmationTemplateLibraryStatus
      ).toHaveBeenLastCalledWith("template-owned", { designStatus: "ENABLED" })
    );
  });

  it("selects all authorized templates from the header checkbox", async () => {
    const user = userEvent.setup();
    const templates = [
      makeTemplate({ id: "template-one", name: "First owned template" }),
      makeTemplate({
        id: "template-two",
        name: "Second owned template",
      }),
    ];
    mockApi.confirmationTemplateLibrary.mockResolvedValue(templates);
    renderPanel("SUPER_ADMIN");

    const library = await openTemplateLibrary();
    await user.click(
      within(library).getByRole("button", { name: "Disable selected" })
    );
    const selectAll = within(library).getByRole("checkbox", {
      name: "Select all templates",
    });
    await user.click(selectAll);

    expect(
      within(library).getByRole("checkbox", { name: "Select all templates" })
    ).toBeChecked();
    expect(
      within(library).getByRole("checkbox", {
        name: "Select template: First owned template",
      })
    ).toBeChecked();
    expect(
      within(library).getByRole("checkbox", {
        name: "Select template: Second owned template",
      })
    ).toBeChecked();
  });

  it("lets the batch action button enter and exit an empty selection mode", async () => {
    const user = userEvent.setup();
    const template = makeTemplate();
    mockApi.confirmationTemplateLibrary.mockResolvedValue([template]);
    renderPanel("SUPER_ADMIN");

    const library = await openTemplateLibrary();
    await within(library).findByText(template.name);
    const toolbar = within(
      screen.getByTestId("confirmation-template-library-toolbar")
    );

    const deleteButton = toolbar.getByRole("button", {
      name: "Delete selected",
    });
    const disable = toolbar.getByRole("button", { name: "Disable selected" });
    await user.click(deleteButton);
    expect(deleteButton).toHaveClass("bg-destructive/10", "text-destructive");
    await user.click(deleteButton);

    expect(disable).toBeEnabled();
    expect(disable).toHaveAttribute("aria-pressed", "false");
    expect(
      within(library).queryByRole("checkbox", {
        name: `Select template: ${template.name}`,
      })
    ).not.toBeInTheDocument();

    await user.click(disable);

    expect(disable).toHaveAttribute("aria-pressed", "true");
    expect(disable).toHaveClass("bg-destructive/10", "text-destructive");
    expect(
      within(library).getByRole("checkbox", {
        name: `Select template: ${template.name}`,
      })
    ).toBeVisible();

    await user.click(disable);

    expect(disable).toHaveAttribute("aria-pressed", "false");
    expect(
      within(library).queryByRole("checkbox", {
        name: `Select template: ${template.name}`,
      })
    ).not.toBeInTheDocument();
    expect(
      mockApi.bulkUpdateConfirmationTemplateLibraryStatus
    ).not.toHaveBeenCalled();
  });

  it("switches the pending batch action without losing the selection", async () => {
    const user = userEvent.setup();
    const template = makeTemplate();
    mockApi.confirmationTemplateLibrary.mockResolvedValue([template]);
    mockApi.bulkUpdateConfirmationTemplateLibraryStatus.mockResolvedValue([
      { ...template, designStatus: "ENABLED" },
    ]);
    renderPanel("SUPER_ADMIN");

    const library = await openTemplateLibrary();
    const disable = within(library).getByRole("button", {
      name: "Disable selected",
    });
    const enable = within(library).getByRole("button", {
      name: "Enable selected",
    });

    await user.click(disable);
    await user.click(
      within(library).getByRole("checkbox", {
        name: `Select template: ${template.name}`,
      })
    );
    await user.click(enable);

    expect(enable).toHaveAttribute("aria-pressed", "true");
    expect(
      within(library).getByRole("checkbox", {
        name: `Select template: ${template.name}`,
      })
    ).toBeChecked();
    expect(
      mockApi.bulkUpdateConfirmationTemplateLibraryStatus
    ).not.toHaveBeenCalled();

    await user.click(enable);

    await waitFor(() =>
      expect(
        mockApi.bulkUpdateConfirmationTemplateLibraryStatus
      ).toHaveBeenCalledWith({
        templateIds: [template.id],
        designStatus: "ENABLED",
      })
    );
  });

  it("does not open the row preview when selecting a template with the keyboard", async () => {
    const user = userEvent.setup();
    const template = makeTemplate({
      id: "template-keyboard-selection",
      name: "Keyboard selection template",
    });
    mockApi.confirmationTemplateLibrary.mockResolvedValue([template]);
    renderPanel("SUPER_ADMIN");

    const library = await openTemplateLibrary();
    await user.click(
      within(library).getByRole("button", { name: "Disable selected" })
    );
    const rowCheckbox = within(library).getByRole("checkbox", {
      name: "Select template: Keyboard selection template",
    });
    rowCheckbox.focus();
    await user.keyboard(" ");

    expect(
      within(library).getByRole("checkbox", {
        name: "Select template: Keyboard selection template",
      })
    ).toBeChecked();
    expect(
      mockApi.previewConfirmationTemplateLibraryFile
    ).not.toHaveBeenCalled();
  });

  it("disables selected templates in one bulk status update and refreshes the rows", async () => {
    const user = userEvent.setup();
    let currentTemplates = [
      makeTemplate({
        designStatus: "ENABLED",
        id: "template-one",
        name: "First owned template",
      }),
      makeTemplate({
        designStatus: "ENABLED",
        id: "template-two",
        name: "Second owned template",
      }),
    ];
    mockApi.confirmationTemplateLibrary.mockImplementation(() =>
      Promise.resolve(currentTemplates)
    );
    mockApi.bulkUpdateConfirmationTemplateLibraryStatus.mockImplementation(
      async (input: {
        templateIds: string[];
        designStatus: "DRAFT" | "ENABLED" | "DISABLED";
      }) => {
        currentTemplates = currentTemplates.map((template) =>
          input.templateIds.includes(template.id)
            ? withDesignStatus(template, input.designStatus)
            : template
        );
        return currentTemplates;
      }
    );
    renderPanel("SUPER_ADMIN");

    const library = await openTemplateLibrary();
    await user.click(
      within(library).getByRole("button", { name: "Disable selected" })
    );
    await user.click(
      within(library).getByRole("checkbox", {
        name: "Select template: First owned template",
      })
    );
    expect(
      within(library).getByRole("checkbox", { name: "Select all templates" })
    ).toHaveAttribute("aria-checked", "mixed");
    await user.click(
      within(library).getByRole("checkbox", {
        name: "Select template: Second owned template",
      })
    );
    await user.click(
      within(library).getByRole("button", { name: "Disable selected" })
    );

    await waitFor(() =>
      expect(
        mockApi.bulkUpdateConfirmationTemplateLibraryStatus
      ).toHaveBeenCalledWith({
        templateIds: ["template-one", "template-two"],
        designStatus: "DISABLED",
      })
    );
    await waitFor(() =>
      expect(mockApi.confirmationTemplateLibrary).toHaveBeenCalled()
    );
    expect(
      within(
        within(library).getByRole("row", { name: /First owned template/ })
      ).getByText("Disabled")
    ).toBeVisible();
    expect(
      within(
        within(library).getByRole("row", { name: /Second owned template/ })
      ).getByText("Disabled")
    ).toBeVisible();
    await waitFor(() =>
      expect(
        within(library).queryByRole("checkbox", {
          name: "Select all templates",
        })
      ).not.toBeInTheDocument()
    );
  });

  it("enables selected disabled templates in one bulk status update", async () => {
    const user = userEvent.setup();
    let currentTemplates = [
      withDesignStatus(
        makeTemplate({ id: "template-disabled-one", name: "Disabled first" }),
        "DISABLED"
      ),
      withDesignStatus(
        makeTemplate({ id: "template-disabled-two", name: "Disabled second" }),
        "DISABLED"
      ),
    ];
    mockApi.confirmationTemplateLibrary.mockImplementation(() =>
      Promise.resolve(currentTemplates)
    );
    mockApi.bulkUpdateConfirmationTemplateLibraryStatus.mockImplementation(
      async (input: {
        templateIds: string[];
        designStatus: "DRAFT" | "ENABLED" | "DISABLED";
      }) => {
        currentTemplates = currentTemplates.map((template) =>
          input.templateIds.includes(template.id)
            ? withDesignStatus(template, input.designStatus)
            : template
        );
        return currentTemplates;
      }
    );
    renderPanel("SUPER_ADMIN");

    const library = await openTemplateLibrary();
    await user.click(
      within(library).getByRole("button", { name: "Enable selected" })
    );
    await user.click(
      within(library).getByRole("checkbox", { name: "Select all templates" })
    );
    await user.click(
      within(library).getByRole("button", { name: "Enable selected" })
    );

    await waitFor(() =>
      expect(
        mockApi.bulkUpdateConfirmationTemplateLibraryStatus
      ).toHaveBeenCalledWith({
        templateIds: ["template-disabled-one", "template-disabled-two"],
        designStatus: "ENABLED",
      })
    );
    await waitFor(() =>
      expect(mockApi.confirmationTemplateLibrary).toHaveBeenCalled()
    );
  });

  it("drops hidden template selections before exposing bulk actions", async () => {
    const user = userEvent.setup();
    const templates = [
      makeTemplate({ id: "template-one", name: "First owned template" }),
      makeTemplate({ id: "template-two", name: "Second owned template" }),
    ];
    mockApi.confirmationTemplateLibrary.mockResolvedValue(templates);
    renderPanel("SUPER_ADMIN");

    const library = await openTemplateLibrary();
    await user.click(
      within(library).getByRole("button", { name: "Disable selected" })
    );
    await user.click(
      within(library).getByRole("checkbox", {
        name: "Select template: First owned template",
      })
    );
    const searchInput = within(library).getByRole("textbox", {
      name: "Search template name, code, or file name",
    });
    fireEvent.change(searchInput, { target: { value: "Second" } });

    await waitFor(() => {
      expect(
        within(library).getByRole("button", { name: "Disable selected" })
      ).toHaveAttribute("aria-pressed", "false");
      expect(
        within(library).queryByRole("checkbox", {
          name: "Select template: Second owned template",
        })
      ).not.toBeInTheDocument();
    });
    expect(
      mockApi.bulkUpdateConfirmationTemplateLibraryStatus
    ).not.toHaveBeenCalled();
  });

  it("offers Design template for a custom template and opens the workbench", async () => {
    const template = makeTemplate();
    mockApi.confirmationTemplateLibrary.mockResolvedValue([template]);
    renderPanel("SUPER_ADMIN");

    const library = await openTemplateLibrary();
    await within(library).findByText(template.name);
    fireEvent.click(
      within(library).getByRole("button", { name: "Design template" })
    );

    const workbench = await screen.findByTestId(
      "mock-confirmation-template-workbench"
    );
    expect(workbench).toHaveAttribute("data-template-id", template.id);
    expect(workbench).toHaveAttribute("data-read-only", "false");
  });

  it("offers Design template for a custom PDF template", async () => {
    const template = makeTemplate({
      fileName: "bank-confirmation.pdf",
      mimeType: "application/pdf",
    });
    mockApi.confirmationTemplateLibrary.mockResolvedValue([template]);
    renderPanel("SUPER_ADMIN");

    const library = await openTemplateLibrary();
    await within(library).findByText(template.name);
    fireEvent.click(
      within(library).getByRole("button", { name: "Design template" })
    );

    expect(
      await screen.findByTestId("mock-confirmation-template-workbench")
    ).toHaveAttribute("data-template-id", template.id);
  });

  it("accepts both PDF and DOCX files when uploading a template", async () => {
    mockApi.confirmationTemplateLibrary.mockResolvedValue([makeTemplate()]);
    renderPanel("SUPER_ADMIN");

    const library = await openTemplateLibrary();
    await userEvent
      .setup()
      .click(within(library).getByRole("button", { name: "Upload template" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Upload confirmation template",
    });
    expect(
      dialog.querySelector<HTMLInputElement>('input[type="file"]')?.accept
    ).toContain(".pdf");
    expect(
      dialog.querySelector<HTMLInputElement>('input[type="file"]')?.accept
    ).toContain(".docx");
  });

  it("enters the workbench automatically after a custom DOCX upload succeeds", async () => {
    const user = userEvent.setup();
    const uploadedTemplate = makeTemplate({
      id: "template-uploaded",
      name: "Uploaded bank confirmation",
    });
    const file = new File(["docx"], "uploaded-bank-template.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    mockApi.confirmationTemplateLibrary.mockResolvedValue([uploadedTemplate]);
    mockApi.uploadConfirmationTemplateLibraryFile.mockResolvedValue(
      uploadedTemplate
    );
    renderPanel("SUPER_ADMIN");

    const library = await openTemplateLibrary();
    await user.click(
      within(library).getByRole("button", { name: "Upload template" })
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Upload confirmation template",
    });
    fireEvent.change(within(dialog).getByLabelText("Template name"), {
      target: { value: "Uploaded bank confirmation" },
    });
    const fileInput =
      dialog.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    await user.upload(fileInput!, file);
    await user.click(within(dialog).getByRole("button", { name: "Upload" }));

    await waitFor(() =>
      expect(mockApi.uploadConfirmationTemplateLibraryFile).toHaveBeenCalled()
    );
    expect(
      await screen.findByTestId("mock-confirmation-template-workbench")
    ).toHaveAttribute("data-template-id", uploadedTemplate.id);
  });

  it("saves draft and enabled designs through the API and refreshes status", async () => {
    const user = userEvent.setup();
    const initialTemplate = makeTemplate();
    let currentTemplate = initialTemplate;
    mockApi.confirmationTemplateLibrary.mockImplementation(() =>
      Promise.resolve([currentTemplate])
    );
    mockApi.updateConfirmationTemplateLibraryDesign.mockImplementation(
      async (
        _templateId: string,
        input: {
          designSchema: ConfirmationTemplateDesign;
          designStatus: "DRAFT" | "ENABLED";
        }
      ) => {
        currentTemplate = makeTemplate({
          designSchema: input.designSchema,
          designStatus: input.designStatus,
          enabledAt:
            input.designStatus === "ENABLED"
              ? "2026-08-15T00:02:00.000Z"
              : null,
          updatedAt:
            input.designStatus === "ENABLED"
              ? "2026-08-15T00:02:00.000Z"
              : "2026-08-15T00:01:00.000Z",
        });
        return currentTemplate;
      }
    );
    renderPanel("SUPER_ADMIN");

    const library = await openTemplateLibrary();
    await within(library).findByText(initialTemplate.name);
    fireEvent.click(
      within(library).getByRole("button", { name: "Design template" })
    );
    const workbench = await screen.findByTestId(
      "mock-confirmation-template-workbench"
    );

    await user.click(
      within(workbench).getByRole("button", { name: "Save draft" })
    );
    await waitFor(() =>
      expect(
        mockApi.updateConfirmationTemplateLibraryDesign
      ).toHaveBeenCalledWith(initialTemplate.id, {
        designSchema: MOCK_DESIGN_SCHEMA,
        designStatus: "DRAFT",
      })
    );
    await waitFor(() =>
      expect(mockApi.confirmationTemplateLibrary).toHaveBeenCalled()
    );

    await user.click(within(workbench).getByRole("button", { name: "Enable" }));
    await waitFor(() =>
      expect(
        mockApi.updateConfirmationTemplateLibraryDesign
      ).toHaveBeenCalledWith(initialTemplate.id, {
        designSchema: MOCK_DESIGN_SCHEMA,
        designStatus: "ENABLED",
      })
    );
    await waitFor(() =>
      expect(mockApi.confirmationTemplateLibrary).toHaveBeenCalled()
    );
    expect(
      await screen.findByTestId("mock-confirmation-template-workbench")
    ).toHaveAttribute("data-status", "ENABLED");
  });

  it("preserves the cached template when save response omits uploader metadata", async () => {
    const user = userEvent.setup();
    const initialTemplate = makeTemplate();
    let resolveRefetch: (
      templates: ConfirmationTemplateLibraryFile[]
    ) => void = () => undefined;
    let libraryCallCount = 0;
    const delayedRefetch = new Promise<ConfirmationTemplateLibraryFile[]>(
      (resolve) => {
        resolveRefetch = resolve;
      }
    );
    mockApi.confirmationTemplateLibrary.mockImplementation(() => {
      libraryCallCount += 1;
      return libraryCallCount === 1
        ? Promise.resolve([initialTemplate])
        : delayedRefetch;
    });
    const { uploader, ...responseWithoutUploader } = makeTemplate({
      designSchema: MOCK_DESIGN_SCHEMA,
      updatedAt: "2026-08-15T00:01:00.000Z",
    });
    expect(uploader).toBeDefined();
    mockApi.updateConfirmationTemplateLibraryDesign.mockResolvedValue(
      responseWithoutUploader
    );
    renderPanel("SUPER_ADMIN");

    const library = await openTemplateLibrary();
    await within(library).findByText(initialTemplate.name);
    fireEvent.click(
      within(library).getByRole("button", { name: "Design template" })
    );
    const workbench = await screen.findByTestId(
      "mock-confirmation-template-workbench"
    );

    await user.click(
      within(workbench).getByRole("button", { name: "Save draft" })
    );
    await waitFor(() =>
      expect(mockApi.updateConfirmationTemplateLibraryDesign).toHaveBeenCalled()
    );
    await waitFor(() =>
      expect(mockApi.confirmationTemplateLibrary).toHaveBeenCalled()
    );

    await user.click(within(workbench).getByRole("button", { name: "Back" }));
    try {
      expect(await screen.findByText(initialTemplate.name)).toBeInTheDocument();
    } finally {
      resolveRefetch([initialTemplate]);
    }
  });

  it("opens built-in templates in editable mode with Super Admin deletion", async () => {
    const builtInTemplate = makeTemplate({
      code: "STANDARD_FINANCIAL_INSTITUTION",
      designSchema: MOCK_DESIGN_SCHEMA,
      designStatus: "ENABLED",
      enabledAt: "2026-08-15T00:00:00.000Z",
      id: "builtin-standard-financial-institution",
      isBuiltIn: true,
      name: "Standard financial institution",
    });
    mockApi.confirmationTemplateLibrary.mockResolvedValue([builtInTemplate]);
    renderPanel("SUPER_ADMIN");

    const library = await openTemplateLibrary();
    await within(library).findByText(builtInTemplate.name);
    fireEvent.click(
      within(library).getByRole("button", { name: "Design template" })
    );
    const workbench = await screen.findByTestId(
      "mock-confirmation-template-workbench"
    );

    expect(workbench).toHaveAttribute("data-read-only", "false");
    expect(
      within(workbench).getByRole("button", { name: "Save draft" })
    ).toBeEnabled();
    expect(
      within(workbench).getByRole("button", { name: "Enable" })
    ).toBeEnabled();
    expect(
      mockApi.updateConfirmationTemplateLibraryDesign
    ).not.toHaveBeenCalled();
    expect(
      within(library).getByRole("button", { name: "Delete template" })
    ).toBeEnabled();
  });
});
