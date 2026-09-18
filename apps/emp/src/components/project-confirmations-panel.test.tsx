import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { completeWithoutResult } from "@/test/async-noop";
import { requiredFixture } from "@/test/required-fixture";

import type {
  ConfirmationTemplateLibraryFile,
  ProjectConfirmation,
} from "../api/client";
import { ApiError } from "../api/client";
import {
  getConfirmationDispatchAttachmentFileName,
  getConfirmationEditorDraftPayload,
  mergeGeneralFillDraftPayload,
  ConfirmationTemplateLibrary,
  defaultProjectConfirmationsCopy,
  invalidateConfirmationEmpImportQueries,
  ProjectConfirmationsPanel,
  isConfirmationArchiveComplete,
} from "./project-confirmations-panel";
import { ToastProvider } from "./toast";
// @vitest-environment jsdom

vi.mock("@/components/ui/resizable", async () => {
  const { createElement } = await import("react");
  type MockResizableProps = Record<string, unknown> & {
    children?: ReactNode;
  };

  const withoutPanelLayoutProps = (props: MockResizableProps) => {
    const {
      children,
      collapsible: _collapsible,
      collapsedSize: _collapsedSize,
      defaultSize: _defaultSize,
      disableCursor: _disableCursor,
      groupResizeBehavior: _groupResizeBehavior,
      maxSize: _maxSize,
      minSize: _minSize,
      orientation: _orientation,
      panelRef: _panelRef,
      ...elementProps
    } = props;
    return { children, elementProps };
  };

  return {
    ResizablePanelGroup: (props: MockResizableProps) => {
      const { children, elementProps } = withoutPanelLayoutProps(props);
      return createElement(
        "div",
        { ...elementProps, "data-slot": "resizable-panel-group" },
        children
      );
    },
    ResizablePanel: (props: MockResizableProps) => {
      const { children, elementProps } = withoutPanelLayoutProps(props);
      return createElement(
        "div",
        { ...elementProps, "data-slot": "resizable-panel" },
        children
      );
    },
    ResizableHandle: (props: MockResizableProps) => {
      const {
        children,
        label,
        withHandle: _withHandle,
        ...elementProps
      } = props;
      return createElement(
        "div",
        {
          ...elementProps,
          "aria-label": label,
          "data-slot": "resizable-handle",
          role: "separator",
        },
        children
      );
    },
  };
});

const mockApi = vi.hoisted(() => ({
  createProjectConfirmation: vi.fn(),
  createProjectConfirmationDispatch: vi.fn(),
  uploadProjectConfirmationDispatchAttachment: vi.fn(),
  uploadProjectConfirmation: vi.fn(),
  uploadProjectConfirmationFile: vi.fn(),
  removeProjectConfirmationFile: vi.fn(),
  removeProjectConfirmationContent: vi.fn(),
  previewProjectConfirmationPdf: vi.fn(),
  previewProjectConfirmationDocx: vi.fn(),
  downloadProjectConfirmationAttachment: vi.fn(),
  projectConfirmations: vi.fn(),
  projects: vi.fn(),
  confirmationGeneralFields: vi.fn(),
  confirmationGeneralLayout: vi.fn(),
  updateConfirmationGeneralLayout: vi.fn(),
  updateConfirmationGeneralFields: vi.fn(),
  confirmationTemplateLibrary: vi.fn(),
  confirmationTemplateLibraryDownloadUrl: vi.fn(),
  previewConfirmationTemplateLibraryFile: vi.fn(),
  updateConfirmationTemplateLibraryDesign: vi.fn(),
  uploadConfirmationTemplateLibraryFile: vi.fn(),
  deleteConfirmationTemplateLibraryFile: vi.fn(),
  updateConfirmationTemplateLibraryStatus: vi.fn(),
  bulkUpdateConfirmationTemplateLibraryStatus: vi.fn(),
  projectConfirmationDefaults: vi.fn(),
  updateProjectConfirmationDefaults: vi.fn(),
  projectConfirmationResponseWarehouse: vi.fn(),
  projectPendingConfirmationResponses: vi.fn(),
  routeConfirmationResponseLibraryFile: vi.fn(),
  projectConfirmationResponseArtifact: vi.fn(),
  addProjectConfirmationResponseArtifacts: vi.fn(),
  receiveProjectConfirmationResponse: vi.fn(),
  completeProjectConfirmationProgram: vi.fn(),
  reviewProjectConfirmationResponse: vi.fn(),
  startProjectConfirmationRedispatchEditing: vi.fn(),
  voidProjectConfirmation: vi.fn(),
  restoreProjectConfirmation: vi.fn(),
  undoProjectConfirmationReview: vi.fn(),
  submitProjectConfirmation: vi.fn(),
  updateProjectConfirmation: vi.fn(),
  updateProjectConfirmationDraft: vi.fn(),
  withdrawProjectConfirmation: vi.fn(),
  withdrawProjectConfirmationResponse: vi.fn(),
  userMailConnection: vi.fn(),
  workflow: vi.fn(),
  confirmationEmpImportHistory: vi.fn(),
  confirmationEmpPreview: vi.fn(),
  createConfirmationEmpImport: vi.fn(),
  confirmationEmpImport: vi.fn(),
  retryConfirmationEmpImport: vi.fn(),
  withdrawConfirmationEmpImport: vi.fn(),
  restoreConfirmationEmpImport: vi.fn(),
}));

vi.mock("../api/client", () => ({
  api: mockApi,
  canUseConfirmationEmpDirectory: () => true,
  getProjectConfirmationAttachment: (
    attachmentSource: ProjectConfirmation
  ) => ({
    originalFileName:
      attachmentSource.attachment?.originalFileName ??
      attachmentSource.originalFileName ??
      attachmentSource.attachmentName ??
      null,
    originalMimeType:
      attachmentSource.attachment?.originalMimeType ??
      attachmentSource.originalMimeType ??
      attachmentSource.attachmentMimeType ??
      null,
    previewability:
      attachmentSource.attachment?.previewability ??
      attachmentSource.previewability ??
      null,
    downloadUrl:
      attachmentSource.attachment?.downloadUrl ??
      attachmentSource.downloadUrl ??
      null,
    previewUrl:
      attachmentSource.attachment?.previewUrl ??
      attachmentSource.previewUrl ??
      null,
  }),
  ApiError: class MockApiError extends Error {
    override name = "MockApiError";
    constructor(
      public readonly code: string,
      message: string,
      public readonly requestId: string
    ) {
      super(message);
    }
  },
}));

vi.mock("@/components/extend/docx-viewer", () => ({
  DocxViewerPreview: ({
    renderPageOverlay,
    src,
  }: {
    renderPageOverlay?: (input: {
      pageElement: HTMLElement;
      pageHeight: number;
      pageNumber: number;
      pageSurfaceElement: HTMLElement | null;
      pageWidth: number;
      rotation: number;
      scale: number;
    }) => ReactNode;
    src: string;
  }) => {
    const pageElement = document.createElement("div");
    return (
      <div data-src={src} data-testid="mock-docx-viewer">
        {renderPageOverlay?.({
          pageElement,
          pageHeight: 1122,
          pageNumber: 1,
          pageSurfaceElement: null,
          pageWidth: 794,
          rotation: 0,
          scale: 1,
        })}
      </div>
    );
  },
}));

vi.mock("@/components/extend/pdf-viewer", () => ({
  PDFViewer: ({
    fileName,
    onDocumentLoadSuccess,
    renderPageOverlay,
    src,
  }: {
    fileName?: string;
    onDocumentLoadSuccess?: (count: number) => void;
    renderPageOverlay?: (input: {
      pageNumber: number;
      pageWidth: number;
      pageHeight: number;
      rotation: number;
      scale: number;
    }) => ReactNode;
    src?: string;
  }) => {
    useEffect(() => onDocumentLoadSuccess?.(5), [onDocumentLoadSuccess]);
    return (
      <div
        aria-label={fileName}
        data-testid="mock-confirmation-pdf-viewer"
        data-src={src}
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

function confirmation(
  overrides: Partial<ProjectConfirmation> = {}
): ProjectConfirmation {
  return {
    id: "confirmation-1",
    projectId: "project-1",
    type: "BANK",
    status: "DRAFT",
    counterpartyName: "HSBC Hong Kong",
    confirmationCode: "AUD-2026-0001-YH-001",
    draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
    draftPayload: { bankName: "HSBC Hong Kong" },
    draftUpdatedAt: "2026-07-12T08:00:00.000Z",
    teamConfirmStatus: "PENDING",
    createdBy: "user-1",
    createdAt: "2026-07-12T07:00:00.000Z",
    updatedAt: "2026-07-12T08:00:00.000Z",
    dispatches: [],
    responses: [],
    ...overrides,
  };
}

function receivedConfirmation(
  overrides: Partial<ProjectConfirmation> = {}
): ProjectConfirmation {
  return confirmation({
    status: "RESPONSE_RECEIVED",
    differenceStatus: null,
    responses: [
      {
        id: "response-1",
        confirmationId: "confirmation-1",
        responseStatus: "RECEIVED",
        responseChannel: "PAPER",
        matchMethod: "MANUAL",
        routingStatus: "ROUTED",
        receivedAt: "2026-07-17T08:30:00.000Z",
        createdAt: "2026-07-17T08:30:00.000Z",
        updatedAt: "2026-07-17T08:30:00.000Z",
        artifacts: [
          {
            id: "artifact-1",
            responseId: "response-1",
            sequence: 1,
            fileName: "bank-response.pdf",
            mimeType: "application/pdf",
            fileSize: 18,
            sha256: "test-sha256",
            uploadedBy: "user-1",
            capturedAt: "2026-07-17T08:30:00.000Z",
            createdAt: "2026-07-17T08:30:00.000Z",
          },
        ],
      },
    ],
    ...overrides,
  });
}

function renderPanel({
  initialConfirmationId,
  initialConfirmationView,
  readOnly = false,
}: {
  initialConfirmationId?: string | null;
  initialConfirmationView?: string | null;
  readOnly?: boolean;
} = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const rendered = render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <ProjectConfirmationsPanel
          projectId="project-1"
          currentUser={{
            id: "user-1",
            name: "Bonnie Su",
            email: "bonnie@example.test",
            globalRole: "STAFF",
          }}
          members={[]}
          commonCopy={{ cancel: "Cancel" } as never}
          locale="en-US"
          initialConfirmationId={initialConfirmationId}
          initialConfirmationView={initialConfirmationView}
          readOnly={readOnly}
        />
      </ToastProvider>
    </QueryClientProvider>
  );
  return { ...rendered, client };
}

function templateLibraryFile(
  overrides: Partial<ConfirmationTemplateLibraryFile> = {}
): ConfirmationTemplateLibraryFile {
  return {
    id: "template-1",
    code: "CTPL-001",
    name: "Bank confirmation",
    confirmationType: "BANK",
    fileName: "bank-confirmation.docx",
    fileSize: 1024,
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    isBuiltIn: false,
    uploadedById: "user-1",
    uploader: { id: "user-1", name: "Bonnie Su" },
    createdAt: "2026-08-16T00:00:00.000Z",
    updatedAt: "2026-08-16T00:00:00.000Z",
    designStatus: "ENABLED",
    enabledAt: "2026-08-16T00:00:00.000Z",
    designSchema: null,
    description: null,
    ...overrides,
  };
}

function renderTemplateLibrary(
  templates: ConfirmationTemplateLibraryFile[] = [templateLibraryFile()]
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  mockApi.confirmationTemplateLibrary.mockResolvedValue(templates);
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <ConfirmationTemplateLibrary
          copy={defaultProjectConfirmationsCopy}
          commonCopy={{ cancel: "Cancel" } as never}
          currentUser={{ id: "user-1", globalRole: "SUPER_ADMIN" }}
          locale="en-US"
        />
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe("confirmation archive completion", () => {
  it("opens the unmatched queue from its deep link", async () => {
    renderPanel({ initialConfirmationView: "unmatched" });
    await waitFor(() =>
      expect(
        vi.mocked(mockApi.projectConfirmationResponseWarehouse).mock.calls
          .length
      ).toBeGreaterThan(0)
    );
    expect(
      screen.queryByRole("button", { name: "New confirmation" })
    ).not.toBeInTheDocument();
  });

  it("requires every response file and becomes pending after a single withdrawal", () => {
    const row = receivedConfirmation({
      status: "CLOSED",
      differenceStatus: "MATCHED",
    });
    const artifact = requiredFixture(
      requiredFixture(
        requiredFixture(requiredFixture(row.responses)[0]).artifacts
      )[0]
    );
    requiredFixture(
      requiredFixture(requiredFixture(row.responses)[0]).artifacts
    ).push({
      ...artifact,
      id: "artifact-2",
      sequence: 2,
    });
    const link = {
      responseArtifactId: artifact.id,
      attachmentId: "file-1",
      attachment: { deletedAt: null },
    };
    row.empImportItems = [
      link,
      { ...link, responseArtifactId: "artifact-2", attachmentId: "file-2" },
    ];
    expect(isConfirmationArchiveComplete(row) === true).toBeTruthy();
    row.empImportItems.pop();
    expect(isConfirmationArchiveComplete(row) === false).toBeTruthy();
    expect(row.differenceStatus).toBe("MATCHED");
    row.empImportItems.push({
      ...link,
      responseArtifactId: "artifact-2",
      attachmentId: "file-3",
    });
    expect(isConfirmationArchiveComplete(row) === true).toBeTruthy();
    requiredFixture(
      requiredFixture(row.empImportItems[0]).attachment
    ).deletedAt = "2026-09-10T12:00:00Z";
    expect(isConfirmationArchiveComplete(row) === false).toBeTruthy();
  });
});

describe(ProjectConfirmationsPanel, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:confirmation-response"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    mockApi.confirmationGeneralFields.mockResolvedValue([]);
    mockApi.confirmationGeneralLayout.mockResolvedValue(null);
    mockApi.updateConfirmationGeneralLayout.mockImplementation((layout) =>
      Promise.resolve(layout)
    );
    mockApi.updateConfirmationGeneralFields.mockImplementation((fields) =>
      Promise.resolve(fields)
    );
    mockApi.projectConfirmations.mockResolvedValue([]);
    mockApi.projects.mockResolvedValue([]);
    mockApi.confirmationTemplateLibrary.mockReturnValue(new Promise(() => {}));
    mockApi.projectConfirmationDefaults.mockResolvedValue({
      projectId: "project-1",
      clientName: null,
      confirmationDate: null,
      reference: null,
      pic: null,
      mic: null,
      reportDate: null,
      updatedAt: null,
    });
    mockApi.projectPendingConfirmationResponses.mockResolvedValue([]);
    mockApi.projectConfirmationResponseWarehouse.mockResolvedValue([]);
    mockApi.routeConfirmationResponseLibraryFile.mockResolvedValue({});
    mockApi.workflow.mockResolvedValue([
      {
        id: "workflow-planning",
        parentId: null,
        code: "A1",
        title: "Planning",
        level: 1,
        nodeType: "PHASE",
        workingPapers: [],
        children: [],
      },
    ]);
    mockApi.confirmationEmpImportHistory.mockResolvedValue([]);
    mockApi.userMailConnection.mockResolvedValue({
      emailAddress: "bonnie@example.test",
      connected: false,
      provider: "WECOM_EXMAIL",
      status: null,
      verifiedAt: null,
      lastTestedAt: null,
      lastError: null,
      updatedAt: null,
    });
    mockApi.previewProjectConfirmationPdf.mockResolvedValue(
      new Blob(["%PDF-1.4"])
    );
    mockApi.previewProjectConfirmationDocx.mockResolvedValue(
      new Blob(["PK DOCX"])
    );
    mockApi.downloadProjectConfirmationAttachment.mockResolvedValue(
      new Blob(["opaque evidence"], { type: "application/octet-stream" })
    );
    mockApi.projectConfirmationResponseArtifact.mockResolvedValue(
      new Blob(["%PDF-1.4 response"])
    );
    mockApi.updateProjectConfirmationDraft.mockImplementation(
      (
        _projectId: string,
        _confirmationId: string,
        input: { draftPayload: ProjectConfirmation["draftPayload"] }
      ) => Promise.resolve(confirmation({ draftPayload: input.draftPayload }))
    );
  });

  afterEach(cleanup);

  it("refreshes the confirmation timeline when an EMP archive job completes", async () => {
    const invalidateQueries = vi.fn().mockImplementation(completeWithoutResult);

    await invalidateConfirmationEmpImportQueries(
      { invalidateQueries },
      "project-1"
    );

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["project-confirmations", "project-1"],
    });
  });

  it("shows template checkboxes only after a batch action is activated", async () => {
    const user = userEvent.setup();
    const template = templateLibraryFile();
    renderTemplateLibrary([template]);

    const library = await screen.findByRole("region", {
      name: "Confirmation templates",
    });
    const libraryGroup = library.parentElement?.parentElement;
    expect(libraryGroup).not.toHaveClass("p-2", "bg-muted/20");
    expect(library).not.toHaveClass("rounded-xl", "border", "shadow-sm");
    await within(library).findByText(template.name);
    const row = within(library).getByRole("row", {
      name: new RegExp(template.name),
    });

    expect(
      within(library).queryByRole("checkbox", { name: "Select all templates" })
    ).not.toBeInTheDocument();
    expect(
      within(row).queryByRole("checkbox", {
        name: `Select template: ${template.name}`,
      })
    ).not.toBeInTheDocument();
    expect(within(library).getByText("Enabled")).toBeVisible();
    expect(
      within(row).getByRole("button", { name: "Disable template" })
    ).toBeVisible();

    await user.click(
      within(library).getByRole("button", { name: "Disable selected" })
    );

    await user.click(
      within(row).getByRole("checkbox", {
        name: `Select template: ${template.name}`,
      })
    );

    expect(
      within(library).getByRole("checkbox", { name: "Select all templates" })
    ).toBeVisible();
    expect(
      within(library).getByRole("checkbox", {
        name: `Select template: ${template.name}`,
      })
    ).toBeVisible();
    expect(
      within(library).getByRole("button", { name: "Enable selected" })
    ).toBeVisible();
    expect(
      within(library).getByRole("button", { name: "Disable selected" })
    ).toBeVisible();
  });

  it("keeps every row operation in place and disables unavailable actions", async () => {
    const unsupportedDraft = templateLibraryFile({
      id: "template-unsupported",
      code: "CTPL-BANK-2026-000001",
      fileName: "bank-confirmation.msg",
      mimeType: "application/vnd.ms-outlook",
      designStatus: "DRAFT",
      enabledAt: null,
    });
    const builtIn = templateLibraryFile({
      id: "template-built-in",
      code: "STANDARD_FINANCIAL_INSTITUTION",
      name: "Standard financial institution",
      fileName: "standard-financial-institution.docx",
      isBuiltIn: true,
      designStatus: "ENABLED",
    });
    renderTemplateLibrary([unsupportedDraft, builtIn]);

    const library = await screen.findByRole("region", {
      name: "Confirmation templates",
    });
    await within(library).findByText(unsupportedDraft.name);
    const unsupportedRow = within(library).getByRole("row", {
      name: new RegExp(unsupportedDraft.name),
    });
    const builtInRow = within(library).getByRole("row", {
      name: new RegExp(builtIn.name),
    });

    for (const row of [unsupportedRow, builtInRow]) {
      expect(
        within(row).getByRole("button", {
          name: row === unsupportedRow ? "Enable template" : "Disable template",
        })
      ).toBeVisible();
      expect(
        within(row).getByRole("button", { name: "Design template" })
      ).toBeVisible();
      expect(
        within(row).getByRole("button", { name: "Delete template" })
      ).toBeVisible();
      expect(
        within(row).getByRole("button", { name: "Preview" })
      ).toBeVisible();
      expect(
        within(row).getByRole("button", { name: "Download" })
      ).toBeVisible();
    }
    expect(
      within(unsupportedRow).getByRole("button", { name: "Enable template" })
    ).toBeDisabled();
    expect(
      within(unsupportedRow).getByRole("button", { name: "Design template" })
    ).toBeDisabled();
    expect(
      within(builtInRow).getByRole("button", { name: "Delete template" })
    ).toBeEnabled();
  });

  it("refreshes the template library when the app regains focus", async () => {
    const staleTemplate = templateLibraryFile({
      id: "template-stale",
      name: "Old bank template",
      designStatus: "DRAFT",
      enabledAt: null,
    });
    const refreshedTemplate = templateLibraryFile({
      id: "template-refreshed",
      name: "Recently enabled bank template",
    });
    let templates = [staleTemplate];
    mockApi.confirmationTemplateLibrary.mockImplementation(async () => {
      const currentTemplates = templates;
      await Promise.resolve();
      return currentTemplates;
    });
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <ConfirmationTemplateLibrary
            copy={defaultProjectConfirmationsCopy}
            commonCopy={{ cancel: "Cancel" } as never}
            currentUser={{ id: "user-1", globalRole: "SUPER_ADMIN" }}
            locale="en-US"
          />
        </ToastProvider>
      </QueryClientProvider>
    );

    try {
      const library = await screen.findByRole("region", {
        name: "Confirmation templates",
      });
      await within(library).findByText(staleTemplate.name);

      templates = [refreshedTemplate];
      focusManager.setFocused(false);
      focusManager.setFocused(true);

      await within(library).findByText(refreshedTemplate.name);
      expect(mockApi.confirmationTemplateLibrary).toHaveBeenCalledTimes(2);
    } finally {
      focusManager.setFocused(undefined);
    }
  });

  it("keeps the current custom template name visible without making it selectable", async () => {
    const templateCode = "CTPL-123456789ABC" as NonNullable<
      ProjectConfirmation["draftTemplateCode"]
    >;
    const template = templateLibraryFile({
      id: "template-edited",
      code: templateCode,
      name: "Recently edited bank template",
      designStatus: "DRAFT",
      enabledAt: null,
    });
    mockApi.confirmationTemplateLibrary.mockResolvedValue([template]);
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({
        draftTemplateCode: templateCode,
        draftPayload: {
          bankName: "HSBC Hong Kong",
          templateAvailableCodes: [templateCode],
        },
      }),
    ]);

    renderPanel();
    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    const trigger = await screen.findByLabelText("Confirmation template");

    expect(trigger).toHaveTextContent(template.name);
    expect(trigger).not.toHaveTextContent(template.code);

    fireEvent.click(trigger);
    expect(
      screen.queryByRole("option", { name: new RegExp(template.name) })
    ).not.toBeInTheDocument();
  });

  it.each([
    [
      "BANK",
      "Bank custom template",
      "CTPL-BANK-2026-000001",
      "Securities custom template",
    ],
    [
      "INTERMEDIARY",
      "Securities custom template",
      "CTPL-INTERMEDIARY-2026-000001",
      "Bank custom template",
    ],
  ] as const)(
    "only offers templates from the active confirmation category: %s",
    async (type, visibleName, visibleCode, hiddenName) => {
      mockApi.confirmationTemplateLibrary.mockResolvedValue([
        templateLibraryFile({
          id: "template-bank",
          code: "CTPL-BANK-2026-000001",
          name: "Bank custom template",
          confirmationType: "BANK",
        }),
        templateLibraryFile({
          id: "template-securities",
          code: "CTPL-INTERMEDIARY-2026-000001",
          name: "Securities custom template",
          confirmationType: "INTERMEDIARY",
        }),
      ]);
      mockApi.projectConfirmations.mockResolvedValue([
        confirmation({
          type,
          draftTemplateCode:
            type === "BANK"
              ? "STANDARD_FINANCIAL_INSTITUTION"
              : "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
          draftPayload: { bankName: "HSBC Hong Kong" },
        }),
      ]);

      renderPanel();
      fireEvent.click(await screen.findByText("HSBC Hong Kong"));
      fireEvent.click(await screen.findByLabelText("Confirmation template"));

      const visibleOption = await screen.findByRole("option", {
        name: new RegExp(visibleName),
      });
      expect(visibleOption).toHaveTextContent(visibleCode);
      expect(
        screen.queryByRole("option", { name: new RegExp(hiddenName) })
      ).not.toBeInTheDocument();
    }
  );

  it("does not expose financial-institution templates for related-party confirmations", async () => {
    mockApi.confirmationTemplateLibrary.mockResolvedValue([]);
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({
        type: "RELATED_PARTY",
        draftTemplateCode: null,
        draftPayload: {
          templateAvailableCodes: [
            "STANDARD_FINANCIAL_INSTITUTION",
            "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
            "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
            "CTPL-BANK-2026-000001",
          ],
        },
      }),
    ]);

    renderPanel();
    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.click(await screen.findByLabelText("Confirmation template"));

    expect(
      screen.queryByRole("option", { name: /标准银行函证模版/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", {
        name: /Bank Confirmation - HK Standard \(English\)/,
      })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", {
        name: /Securities Confirmation - English - Type 1/,
      })
    ).not.toBeInTheDocument();
  });

  it("deletes selected templates through the existing delete API", async () => {
    const user = userEvent.setup();
    const template = templateLibraryFile();
    mockApi.deleteConfirmationTemplateLibraryFile.mockResolvedValue({
      id: template.id,
    });
    renderTemplateLibrary([template]);

    const library = await screen.findByRole("region", {
      name: "Confirmation templates",
    });
    await within(library).findByText(template.name);
    await user.click(
      within(library).getByRole("button", { name: "Delete selected" })
    );
    await user.click(
      within(library).getByRole("checkbox", {
        name: `Select template: ${template.name}`,
      })
    );
    await user.click(
      within(library).getByRole("button", { name: "Delete selected" })
    );

    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Delete template" })
    );

    await waitFor(() =>
      expect(
        mockApi.deleteConfirmationTemplateLibraryFile
      ).toHaveBeenCalledWith(template.id)
    );
  });

  it("uses the paper editor as the first preparation stage without legacy forms", async () => {
    mockApi.projectConfirmations.mockResolvedValue([confirmation()]);
    renderPanel();
    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    await screen.findByLabelText("Confirmation template");
    expect(screen.getByRole("tab", { name: "Confirmation" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.queryByText("Basic information")).not.toBeInTheDocument();
    expect(screen.queryByText("Manual entry")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Courier / postal service")
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tracking number")).not.toBeInTheDocument();
  });

  it("restores list and detail stages from browser history", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({
        id: "history-confirmation",
        counterpartyName: "History Bank",
      }),
    ]);
    renderPanel({ initialConfirmationId: "history-confirmation" });
    await screen.findByTestId("confirmation-detail-toolbar");
    window.history.replaceState({}, "", "?workspace=confirmations");
    fireEvent(window, new PopStateEvent("popstate"));
    await waitFor(() =>
      expect(screen.queryByTestId("confirmation-detail-toolbar")).toBeNull()
    );
    window.history.replaceState(
      {},
      "",
      "?workspace=confirmations&confirmationId=history-confirmation&confirmationStage=tracking"
    );
    fireEvent(window, new PopStateEvent("popstate"));
    await expect(
      screen.findByTestId("confirmation-detail-toolbar")
    ).resolves.toBeVisible();
    expect(screen.getByRole("tab", { name: "Tracking" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    window.history.replaceState({}, "", "/");
  });

  it("reopens the same archive dialog when browser history remounts the confirmation workspace", async () => {
    mockApi.workflow.mockResolvedValue([]);
    window.history.replaceState(
      {
        confirmationArchiveView: {
          projectId: "project-1",
          confirmationIds: ["history-confirmation"],
          mode: "FLAT",
          scrollTop: 180,
        },
      },
      "",
      "?workspace=confirmations&confirmationId=history-confirmation&confirmationStage=review"
    );
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({ id: "history-confirmation" }),
    ]);
    renderPanel({ initialConfirmationId: "history-confirmation" });
    await expect(screen.findByRole("dialog")).resolves.toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Archive to project" })
    ).toBeVisible();
    window.history.replaceState({}, "", "/");
  });

  it("opens a confirmation supplied by a global-center deep link", async () => {
    window.history.replaceState({}, "", "?confirmationStage=draft");
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({
        id: "confirmation-deep-link",
        status: "RESPONSE_RECEIVED",
        counterpartyName: "Deep Link Bank",
      }),
    ]);

    renderPanel({ initialConfirmationId: "confirmation-deep-link" });

    await expect(
      screen.findByLabelText("Confirmation template")
    ).resolves.toBeVisible();
    expect(screen.getByRole("tab", { name: "Confirmation" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(
      within(screen.getByTestId("confirmation-detail-toolbar")).getByText(
        "Deep Link Bank"
      )
    ).toBeVisible();
    window.history.replaceState({}, "", "/");
  });

  it("keeps the active document mounted while an autosave completes", async () => {
    const initial = confirmation({
      draftTemplateCode: "CTPL-42EE80005D40" as never,
      draftPayload: {
        templateDesignSchema: {
          version: 1,
          fields: [
            {
              id: "autosave-manager",
              kind: "TEXT",
              name: "Autosave manager",
              page: 1,
              x: 0.1,
              y: 0.1,
              width: 0.3,
              height: 0.04,
              placeholder: "Manager",
              options: [],
            },
          ],
        },
        templateFieldValues: { "autosave-manager": "" },
      } as never,
    });
    mockApi.projectConfirmations.mockResolvedValue([initial]);
    mockApi.updateProjectConfirmationDraft.mockImplementation(
      (
        _projectId: string,
        _confirmationId: string,
        input: { draftPayload: ProjectConfirmation["draftPayload"] }
      ) =>
        Promise.resolve(
          confirmation({
            ...initial,
            draftPayload: input.draftPayload,
            draftUpdatedAt: "2026-07-12T08:00:01.000Z",
            updatedAt: "2026-07-12T08:00:01.000Z",
          })
        )
    );
    renderPanel({ initialConfirmationId: initial.id });

    const field = await screen.findByLabelText("Autosave manager");
    await waitFor(() =>
      expect(mockApi.previewProjectConfirmationPdf).toHaveBeenCalledOnce()
    );
    mockApi.previewProjectConfirmationPdf.mockClear();
    mockApi.previewProjectConfirmationDocx.mockClear();

    fireEvent.change(field, { target: { value: "A new manager" } });
    fireEvent.blur(field);

    await waitFor(() =>
      expect(mockApi.updateProjectConfirmationDraft).toHaveBeenCalledOnce()
    );
    await new Promise((resolve) => {
      setTimeout(resolve, 400);
    });

    expect(field).toHaveValue("A new manager");
    expect(
      vi.mocked(mockApi.previewProjectConfirmationPdf)
    ).toHaveBeenCalledTimes(0);
    expect(
      vi.mocked(mockApi.previewProjectConfirmationDocx)
    ).toHaveBeenCalledTimes(0);
  });

  it("autosaves an explicitly cleared linked Ref field as an empty value", async () => {
    const initial = confirmation({
      draftTemplateCode: "CTPL-42EE80005D40" as never,
      draftPayload: {
        referenceCode: "Existing reference",
        templateDesignSchema: {
          version: 1,
          fields: [
            {
              baseInformationBinding: "referenceCode",
              id: "autosave-reference",
              kind: "TEXT",
              name: "Autosave reference",
              page: 1,
              x: 0.1,
              y: 0.1,
              width: 0.3,
              height: 0.04,
              placeholder: "Ref",
              options: [],
            },
          ],
        },
        templateFieldValues: {
          "autosave-reference": "Existing reference",
        },
      } as never,
    });
    mockApi.projectConfirmations.mockResolvedValue([initial]);
    renderPanel({ initialConfirmationId: initial.id });

    const field = await screen.findByLabelText("Autosave reference");
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.blur(field);

    await waitFor(() =>
      expect(mockApi.updateProjectConfirmationDraft).toHaveBeenCalledWith(
        "project-1",
        initial.id,
        expect.objectContaining({
          draftPayload: expect.objectContaining({
            templateFieldValues: expect.objectContaining({
              "autosave-reference": "",
            }),
          }),
        })
      )
    );
  });

  it("does not add an edited linked value to the option list after autosave", async () => {
    const initial = confirmation({
      draftTemplateCode: "CTPL-42EE80005D40" as never,
      draftPayload: {
        clientName: "Client A",
        templateDesignSchema: {
          version: 1,
          fields: [
            {
              id: "autosave-client",
              kind: "TEXT",
              name: "Autosave client",
              page: 1,
              x: 0.1,
              y: 0.1,
              width: 0.3,
              height: 0.04,
              placeholder: "Client",
              options: [],
              baseInformationBinding: "clientName",
            },
          ],
        },
        templateFieldValues: {},
      } as never,
    });
    mockApi.projectConfirmations.mockResolvedValue([initial]);
    mockApi.projectConfirmationDefaults.mockResolvedValue({
      projectId: "project-1",
      clientName: null,
      confirmationDate: null,
      reference: null,
      pic: null,
      mic: null,
      reportDate: null,
      baseInformation: {
        clientNames: ["Client A"],
        references: [],
        banks: [],
      },
      updatedAt: null,
    });
    mockApi.updateProjectConfirmationDraft.mockImplementation(
      (
        _projectId: string,
        _confirmationId: string,
        input: { draftPayload: ProjectConfirmation["draftPayload"] }
      ) =>
        Promise.resolve(
          confirmation({ ...initial, draftPayload: input.draftPayload })
        )
    );
    renderPanel({ initialConfirmationId: initial.id });

    const field = await screen.findByRole("combobox", {
      name: "Autosave client",
    });
    const user = userEvent.setup();
    await user.click(field);
    await expect(
      screen.findByRole("option", { name: "Client A" })
    ).resolves.toBeVisible();

    fireEvent.change(field, { target: { value: "Client B" } });
    fireEvent.blur(field);
    await waitFor(() =>
      expect(mockApi.updateProjectConfirmationDraft).toHaveBeenCalledOnce()
    );
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Autosave client" })
      ).toHaveValue("Client B")
    );
    await new Promise((resolve) => {
      setTimeout(resolve, 400);
    });

    expect(
      screen.queryByRole("option", { name: "Client B" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Client A" })).toBeVisible();
  });

  it("does not update or reload when the current confirmation category is selected again", async () => {
    const initial = confirmation();
    mockApi.projectConfirmations.mockResolvedValue([initial]);
    mockApi.updateProjectConfirmation.mockResolvedValue(initial);
    renderPanel({ initialConfirmationId: initial.id });

    const category = await screen.findByRole("combobox", {
      name: "Confirmation category",
    });
    await waitFor(() =>
      expect(mockApi.previewProjectConfirmationPdf).toHaveBeenCalledOnce()
    );
    mockApi.previewProjectConfirmationPdf.mockClear();

    const user = userEvent.setup();
    await user.click(category);
    expect(
      document.querySelector('[data-slot="select-content"]')
    ).toHaveAttribute("data-align-trigger", "false");
    await user.click(await screen.findByRole("option", { name: "Bank" }));
    await waitFor(() =>
      expect(category).toHaveAttribute("aria-expanded", "false")
    );
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });

    expect(vi.mocked(mockApi.updateProjectConfirmation)).toHaveBeenCalledTimes(
      0
    );
    expect(mockApi.projectConfirmations).toHaveBeenCalledOnce();
    expect(
      vi.mocked(mockApi.previewProjectConfirmationPdf)
    ).toHaveBeenCalledTimes(0);
  });

  it("opens an awaiting exception deep link in tracking", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({
        id: "confirmation-exception-deep-link",
        status: "AWAITING_RESPONSE",
        differenceStatus: "EXCEPTION",
        responses: [
          {
            id: "response-routed",
            confirmationId: "confirmation-exception-deep-link",
            responseStatus: "RECEIVED",
            routingStatus: "ROUTED",
            createdAt: "2026-07-12T10:00:00.000Z",
            updatedAt: "2026-07-12T10:00:00.000Z",
            artifacts: [],
          },
        ],
      }),
    ]);

    renderPanel({ initialConfirmationId: "confirmation-exception-deep-link" });

    await expect(
      screen.findByRole("tab", { name: "Tracking" })
    ).resolves.toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Review" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
  });

  it("gives an overlong tracking timeline its own vertical scroll region", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({
        status: "AWAITING_RESPONSE",
        followUpEvents: Array.from({ length: 10 }, (_, index) => ({
          id: `follow-up-${index}`,
          confirmationId: "confirmation-1",
          eventType: "COUNTERPARTY_RECEIVED" as const,
          actorId: "user-1",
          source: "PROJECT_TEAM_MANUAL" as const,
          notes: `Progress ${index + 1}`,
          occurredAt: `2026-07-${String(13 + index).padStart(2, "0")}T08:00:00.000Z`,
          createdAt: `2026-07-${String(13 + index).padStart(2, "0")}T08:00:00.000Z`,
        })),
      }),
    ]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.click(await screen.findByRole("tab", { name: "Tracking" }));

    const content = await screen.findByTestId("confirmation-tracking-content");
    expect(content).toHaveClass("min-h-0", "flex-1", "overflow-y-auto");
    expect(screen.getByRole("main")).toHaveClass("overflow-hidden");
  });

  it("shows category navigation and a project-wide confirmation register", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({ id: "draft-1", counterpartyName: "Draft bank" }),
      confirmation({
        id: "prepared-1",
        counterpartyName: "Related company",
        type: "RELATED_PARTY",
        status: "PREPARED",
      }),
      confirmation({
        id: "closed-1",
        counterpartyName: "Law firm",
        type: "LAWYER",
        status: "CLOSED",
      }),
      confirmation({
        id: "unknown-1",
        counterpartyName: "Unknown counterparty",
        type: "MYSTERY" as never,
      }),
    ]);
    renderPanel();

    await expect(
      screen.findByRole("navigation", { name: "All confirmations" })
    ).resolves.toBeVisible();
    expect(screen.getByTestId("confirmation-register-data-grid")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "General fill" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Confirmation no.")).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "Current status" })
    ).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "Base date" })
    ).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "Waiting time" })
    ).toBeVisible();
    expect(screen.queryByText("Progress")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Financial institutions/ })
    ).toHaveAttribute("data-category-tone", "financial");
    expect(
      screen.getByRole("button", { name: /Correspondence/ })
    ).toHaveAttribute("data-category-tone", "correspondence");
    expect(
      screen.getByRole("button", { name: /Other confirmations/ })
    ).toHaveAttribute("data-category-tone", "other");
    expect(
      screen.queryByRole("button", { name: /Unclassified/ })
    ).not.toBeInTheDocument();
    await screen.findByText("Draft bank");
    expect(
      screen
        .getByRole("table")
        .querySelector('[data-category-tone="financial"]')
    ).toBeTruthy();
    expect(
      screen
        .getByRole("table")
        .querySelector('[data-category-tone="unclassified"]')
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Correspondence/ }));
    expect(screen.getByText("Related company")).toBeVisible();
    expect(screen.queryByText("Draft bank")).not.toBeInTheDocument();
    expect(screen.queryByText("Law firm")).not.toBeInTheDocument();
  });

  it("offers 30, 40, and 50 confirmation rows per page", async () => {
    const user = userEvent.setup();
    mockApi.projectConfirmations.mockResolvedValueOnce(
      Array.from({ length: 51 }, (_, index) =>
        confirmation({
          id: `confirmation-${index + 1}`,
          confirmationCode: `AUD-2026-${String(index + 1).padStart(4, "0")}`,
          counterpartyName: `Bank ${index + 1}`,
        })
      )
    );
    renderPanel();

    const register = await screen.findByTestId(
      "confirmation-register-data-grid"
    );
    expect(
      within(register).getByRole("textbox", {
        name: "Search confirmations by name prefix",
      })
    ).toBeVisible();
    await waitFor(() =>
      expect(within(register).getAllByRole("row")).toHaveLength(31)
    );
    expect(screen.getByText("1-30 / 51")).toBeVisible();

    const pageSize = screen.getByRole("combobox", { name: "Rows per page" });
    await user.click(pageSize);
    expect(pageSize).toHaveTextContent("30 / page");
    expect(
      screen.getAllByRole("option").map((option) => option.textContent)
    ).toStrictEqual(["30 / page", "40 / page", "50 / page"]);
    await user.click(screen.getByRole("option", { name: "40 / page" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("option", { name: "40 / page" })
      ).not.toBeInTheDocument()
    );

    await waitFor(() =>
      expect(within(register).getAllByRole("row")).toHaveLength(41)
    );
    expect(screen.getByText("1-40 / 51")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Page 2" }));

    await waitFor(() =>
      expect(within(register).getAllByRole("row")).toHaveLength(12)
    );
    expect(screen.getByText("41-51 / 51")).toBeVisible();

    await user.click(screen.getByRole("combobox", { name: "Rows per page" }));
    await user.click(await screen.findByRole("option", { name: "50 / page" }));
    await waitFor(() =>
      expect(within(register).getAllByRole("row")).toHaveLength(51)
    );
    expect(screen.getByText("1-50 / 51")).toBeVisible();
  });

  it("opens base information below overview and saves repeatable client and bank rows", async () => {
    renderPanel();

    fireEvent.click(
      await screen.findByRole("button", { name: "Base information" })
    );

    const panel = await screen.findByRole("region", {
      name: "Base information",
    });
    const repeatableFields = screen
      .getByRole("heading", { name: "Client names" })
      .closest("section")?.parentElement;
    expect(repeatableFields).not.toHaveClass("lg:grid-cols-2");
    fireEvent.change(within(panel).getByLabelText("Client names 1"), {
      target: { value: "Orchid Holdings" },
    });
    fireEvent.click(
      within(panel).getAllByRole("button", { name: "Add row" })[0]
    );
    fireEvent.change(within(panel).getByLabelText("Client names 2"), {
      target: { value: "Orchid Services" },
    });
    fireEvent.change(within(panel).getByLabelText("Refs 1"), {
      target: { value: "REF-001" },
    });
    fireEvent.change(within(panel).getByLabelText("Bank name"), {
      target: { value: "Example Bank" },
    });
    fireEvent.change(within(panel).getByLabelText("Bank account"), {
      target: { value: "001-123" },
    });
    fireEvent.change(within(panel).getByLabelText("Mailing address"), {
      target: { value: "1 Main Street" },
    });
    fireEvent.change(within(panel).getByLabelText("Date"), {
      target: { value: "2026-12-31" },
    });
    fireEvent.change(within(panel).getByLabelText("PIC"), {
      target: { value: "Bonnie Su" },
    });
    fireEvent.change(within(panel).getByLabelText("MIC"), {
      target: { value: "Michael Chan" },
    });
    fireEvent.change(within(panel).getByLabelText("Report Date"), {
      target: { value: "2026-08-15" },
    });
    fireEvent.click(
      within(panel).getByRole("button", { name: "Save base information" })
    );

    await waitFor(() =>
      expect(mockApi.updateProjectConfirmationDefaults).toHaveBeenCalledWith(
        "project-1",
        {
          clientName: "Orchid Holdings\nOrchid Services",
          confirmationDate: "2026-12-31",
          reference: "REF-001",
          pic: "Bonnie Su",
          mic: "Michael Chan",
          reportDate: "2026-08-15",
          baseInformation: {
            clientNames: ["Orchid Holdings", "Orchid Services"],
            references: ["REF-001"],
            banks: [
              {
                name: "Example Bank",
                account: "001-123",
                address: "1 Main Street",
              },
            ],
          },
        }
      )
    );
  });

  it("saves mobile base information through the existing defaults mutation", async () => {
    const originalMatchMedia = requiredFixture(
      vi.mocked(window.matchMedia).getMockImplementation()
    );
    const matchMedia = vi
      .spyOn(window, "matchMedia")
      .mockImplementation((query: string) => ({
        matches: query.includes("767"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    try {
      renderPanel();
      fireEvent.click(
        await screen.findByRole("button", { name: "Confirmation views" })
      );
      fireEvent.click(
        await screen.findByRole("button", { name: "Base information" })
      );
      const panel = await screen.findByRole("region", {
        name: "Base information",
      });
      fireEvent.change(within(panel).getByLabelText("Client names 1"), {
        target: { value: "Orchid Mobile" },
      });
      const bank = within(panel).getByRole("group", { name: "Bank 1" });
      fireEvent.change(within(bank).getByLabelText("Bank name"), {
        target: { value: "Example bank" },
      });
      fireEvent.change(within(bank).getByLabelText("Bank account"), {
        target: { value: "001" },
      });
      fireEvent.change(within(bank).getByLabelText("Mailing address"), {
        target: { value: "Floor 10\nCentral" },
      });
      const save = within(panel).getByRole("button", {
        name: "Save base information",
      });
      expect(save.closest("footer")).not.toBeNull();
      fireEvent.click(save);
      await waitFor(() =>
        expect(mockApi.updateProjectConfirmationDefaults).toHaveBeenCalledWith(
          "project-1",
          expect.objectContaining({
            clientName: "Orchid Mobile",
            baseInformation: expect.objectContaining({
              clientNames: ["Orchid Mobile"],
              banks: [
                {
                  name: "Example bank",
                  account: "001",
                  address: "Floor 10\nCentral",
                },
              ],
            }),
          })
        )
      );
    } finally {
      cleanup();
      matchMedia.mockRestore();
      vi.mocked(window.matchMedia).mockImplementation(originalMatchMedia);
    }
  });

  it("only fills global fields in a project and cannot manage their definitions", async () => {
    mockApi.confirmationGeneralFields.mockResolvedValue([
      { id: "department", name: "Contact team" },
    ]);
    mockApi.confirmationGeneralLayout.mockResolvedValue({
      sections: [
        {
          id: "general",
          name: "General",
          fields: [
            {
              id: "builtin-reportDate",
              name: "Report Date",
              binding: "reportDate",
            },
            { id: "department", name: "Contact team" },
          ],
        },
      ],
    });
    renderPanel();
    fireEvent.click(
      await screen.findByRole("button", { name: "Base information" })
    );
    const field = await screen.findByLabelText("Contact team");
    expect(screen.queryByRole("button", { name: "Add field" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Rename|Delete Contact/ })
    ).toBeNull();
    expect(
      screen.getByLabelText("Report Date").compareDocumentPosition(field) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    fireEvent.change(field, { target: { value: "Project A team" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Save base information" })
    );
    await waitFor(() =>
      expect(mockApi.updateProjectConfirmationDefaults).toHaveBeenCalledWith(
        "project-1",
        expect.objectContaining({
          baseInformation: expect.objectContaining({
            customFields: [
              {
                id: "department",
                name: "Contact team",
                value: "Project A team",
              },
            ],
          }),
        })
      )
    );
  });

  it("confirms global settings only in the super administrator template library", async () => {
    mockApi.confirmationGeneralLayout.mockResolvedValue({
      sections: [
        {
          id: "general",
          name: "General",
          fields: [{ id: "department", name: "Department" }],
        },
      ],
    });

    renderTemplateLibrary();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "General information settings",
      })
    );
    fireEvent.change(await screen.findByLabelText("Field name 1-1"), {
      target: { value: "Cancelled name" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Back to template library" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(
      vi.mocked(mockApi.updateConfirmationGeneralLayout)
    ).toHaveBeenCalledTimes(0);
    fireEvent.click(
      screen.getByRole("button", { name: "General information settings" })
    );
    await expect(screen.findByLabelText("Field name 1-1")).resolves.toHaveValue(
      "Department"
    );
    fireEvent.change(screen.getByLabelText("Field name 1-1"), {
      target: { value: "Contact team" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    fireEvent.change(screen.getByLabelText("Field name 1-2"), {
      target: { value: "Phone" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply globally" }));
    await waitFor(() =>
      expect(mockApi.updateConfirmationGeneralLayout).toHaveBeenCalledWith(
        {
          sections: [
            {
              id: "general",
              name: "General",
              fields: [
                { id: "department", name: "Contact team" },
                { id: expect.any(String), name: "Phone", colSpan: 1 },
              ],
            },
          ],
        },
        expect.anything()
      )
    );
  });

  it("hides global settings for ordinary project users", async () => {
    mockApi.confirmationTemplateLibrary.mockResolvedValue([]);
    renderPanel();
    fireEvent.click(
      await screen.findByRole("button", {
        name: defaultProjectConfirmationsCopy.register.templateLibrary,
      })
    );
    expect(
      screen.queryByRole("button", { name: "General information settings" })
    ).toBeNull();
  });

  it("keeps general fill out of the detail toolbar while retaining bank lookup", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({ draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION" }),
    ]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    const toolbar = await screen.findByTestId("confirmation-detail-toolbar");
    expect(
      within(toolbar).queryByRole("button", { name: "General fill" })
    ).not.toBeInTheDocument();
    expect(
      within(toolbar).getByRole("button", { name: "Bank lookup" })
    ).toBeVisible();
  });

  it("uses the project Ref only when the draft has no explicit Ref", () => {
    const defaults = {
      projectId: "project-1",
      clientName: null,
      confirmationDate: null,
      reference: "PROJECT-REF-001",
      pic: null,
      mic: null,
      reportDate: null,
      updatedAt: null,
    };

    expect(
      getConfirmationEditorDraftPayload(
        { bankName: "HSBC Hong Kong", referenceCode: "" },
        defaults
      )
    ).toStrictEqual(expect.objectContaining({ referenceCode: "" }));
    expect(
      getConfirmationEditorDraftPayload(
        { bankName: "HSBC Hong Kong" },
        defaults
      )
    ).toStrictEqual(
      expect.objectContaining({ referenceCode: "PROJECT-REF-001" })
    );
    expect(
      getConfirmationEditorDraftPayload(
        {
          bankName: "HSBC Hong Kong",
          referenceCode: "SINGLE-CONFIRMATION-REF",
        },
        defaults
      )
    ).toStrictEqual(
      expect.objectContaining({
        referenceCode: "SINGLE-CONFIRMATION-REF",
      })
    );
  });

  it("preserves general fields when an editor payload omits them", () => {
    const result = mergeGeneralFillDraftPayload(
      {
        officeDate: "Single confirmation date",
      },
      {
        clientName: "Existing client",
        officeDate: "Existing office date",
        referenceCode: "",
        picName: "",
        micName: "",
        micNameAndInitial: "",
      },
      {
        projectId: "project-1",
        clientName: "Default client",
        confirmationDate: "2026-12-31",
        reference: "REF-001",
        pic: "Default PIC",
        mic: "Default MIC",
        reportDate: "2026-06-30",
        updatedAt: null,
      }
    );

    expect(result).toStrictEqual(
      expect.objectContaining({
        clientName: "Existing client",
        officeDate: "Single confirmation date",
        referenceCode: "REF-001",
        picName: "Default PIC",
        micName: "Default MIC",
        micNameAndInitial: "Default MIC",
        reportDate: "2026-06-30",
      })
    );
  });

  it("preserves explicitly cleared general fields instead of restoring previous values", () => {
    const result = mergeGeneralFillDraftPayload(
      { referenceCode: "" },
      { referenceCode: "Existing reference" },
      {
        projectId: "project-1",
        clientName: null,
        confirmationDate: null,
        reference: "PROJECT-REF-001",
        pic: null,
        mic: null,
        reportDate: null,
        updatedAt: null,
      }
    );

    expect(result.referenceCode).toBe("");
  });

  it("does not drop explicit general fields when project defaults are blank", () => {
    const result = mergeGeneralFillDraftPayload(
      { bankName: "HSBC Hong Kong" },
      {
        clientName: "Existing client",
        officeDate: "Existing office date",
        referenceCode: "Existing reference",
        picName: "Existing PIC",
        micName: "Existing MIC",
        micNameAndInitial: "Existing MIC / E.",
      },
      {
        projectId: "project-1",
        clientName: null,
        confirmationDate: null,
        reference: null,
        pic: null,
        mic: null,
        reportDate: null,
        updatedAt: null,
      }
    );

    expect(result).toStrictEqual(
      expect.objectContaining({
        clientName: "Existing client",
        officeDate: "Existing office date",
        referenceCode: "Existing reference",
        picName: "Existing PIC",
        micName: "Existing MIC",
        micNameAndInitial: "Existing MIC / E.",
      })
    );
  });

  it("uses shared DataGrid column CSS variables and semantic widths", async () => {
    mockApi.projectConfirmations.mockResolvedValue([confirmation()]);
    renderPanel();

    const register = await screen.findByTestId(
      "confirmation-register-data-grid"
    );
    const table = within(register).getByRole("table");
    const firstColumn = table.querySelector("col");

    expect(table).toHaveClass("w-full", "table-auto");
    expect(table).not.toHaveClass("table-fixed");
    expect(table).not.toHaveAttribute(
      "style",
      expect.stringContaining("--header-code-size")
    );
    expect(firstColumn).not.toBeNull();
    expect(firstColumn).not.toHaveAttribute("style");
  });

  it("removes the unclassified register from navigation", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({
        type: "UNCLASSIFIED",
        counterpartyName: "Unclassified counterparty",
      }),
    ]);
    renderPanel();

    await screen.findByTestId("confirmation-register-data-grid");
    expect(
      screen.queryByRole("button", { name: /Unclassified/ })
    ).not.toBeInTheDocument();
  });

  it("uses the active confirmation category as the register title without a duplicate count", async () => {
    mockApi.projectConfirmations.mockResolvedValue([confirmation()]);
    renderPanel();

    const initialRegister = await screen.findByTestId(
      "confirmation-register-data-grid"
    );
    await within(initialRegister).findByText("HSBC Hong Kong");
    const initialToolbar = within(initialRegister).getByTestId(
      "confirmation-register-toolbar"
    );
    expect(
      within(initialToolbar).getByRole("heading", {
        name: "All confirmations",
      })
    ).toBeVisible();
    expect(
      within(initialToolbar).getByLabelText("All confirmations: 1")
    ).toHaveTextContent("1");
    expect(within(initialToolbar).queryByText("1 confirmations")).toBeNull();

    const navigation = screen.getByRole("navigation", {
      name: "All confirmations",
    });
    fireEvent.click(within(navigation).getByRole("button", { name: /^Bank/ }));

    const categoryRegister = screen.getByTestId(
      "confirmation-register-data-grid"
    );
    expect(
      within(categoryRegister).getByRole("heading", { name: "Bank" })
    ).toBeVisible();
    expect(
      within(categoryRegister).getByLabelText("Bank: 1")
    ).toHaveTextContent("1");
  });

  it("moves lifecycle actions to the toolbar and uses TMS-style delete selection", async () => {
    const target = confirmation();
    const voided = confirmation({ ...target, status: "VOIDED" });
    mockApi.projectConfirmations
      .mockResolvedValueOnce([target])
      .mockResolvedValue([voided]);
    mockApi.voidProjectConfirmation.mockResolvedValue(voided);
    renderPanel();

    const register = await screen.findByTestId(
      "confirmation-register-data-grid"
    );
    expect(
      within(register).queryByTestId("confirmation-register-filter-code")
    ).not.toBeInTheDocument();
    expect(
      within(register).queryByTestId(
        "confirmation-register-filter-dispatchMethod"
      )
    ).not.toBeInTheDocument();

    const awaitedFixture1 = await screen.findByText("HSBC Hong Kong");
    const row = awaitedFixture1.closest("tr");
    expect(row).not.toBeNull();
    expect(
      within(row as HTMLElement).queryByRole("button", {
        name: "Move confirmation to recycle bin: HSBC Hong Kong",
      })
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(register).getByRole("button", { name: "Delete confirmations" })
    );
    fireEvent.click(
      within(register).getByRole("button", {
        name: "Select confirmation: HSBC Hong Kong",
      })
    );
    fireEvent.click(
      within(register).getByRole("button", {
        name: "Delete selected confirmations",
      })
    );

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toBeVisible();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Move to recycle bin" })
    );

    await waitFor(() =>
      expect(mockApi.voidProjectConfirmation).toHaveBeenCalledWith(
        "project-1",
        "confirmation-1"
      )
    );
  });

  it("keeps failed confirmations selected after a partial delete", async () => {
    const succeeded = confirmation({
      id: "confirmation-succeeded",
      counterpartyName: "Succeeded bank",
    });
    const failed = confirmation({
      id: "confirmation-failed",
      counterpartyName: "Failed bank",
    });
    let refreshAfterMutation = false;
    mockApi.projectConfirmations.mockReset();
    mockApi.projectConfirmations.mockImplementation(async () => {
      const currentConfirmations = refreshAfterMutation
        ? [failed]
        : [succeeded, failed];
      await Promise.resolve();
      return currentConfirmations;
    });
    mockApi.voidProjectConfirmation
      .mockResolvedValueOnce(confirmation({ ...succeeded, status: "VOIDED" }))
      .mockRejectedValueOnce(new Error("state conflict"));
    renderPanel();

    const register = await screen.findByTestId(
      "confirmation-register-data-grid"
    );
    await within(register).findByText("Succeeded bank");
    fireEvent.click(
      within(register).getByRole("button", { name: "Delete confirmations" })
    );
    fireEvent.click(
      within(register).getByRole("button", {
        name: "Select confirmation: Succeeded bank",
      })
    );
    fireEvent.click(
      within(register).getByRole("button", {
        name: "Select confirmation: Failed bank",
      })
    );
    fireEvent.click(
      within(register).getByRole("button", {
        name: "Delete selected confirmations",
      })
    );
    const dialog = await screen.findByRole("alertdialog");
    refreshAfterMutation = true;
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Move to recycle bin" })
    );

    await waitFor(() => {
      expect(mockApi.voidProjectConfirmation).toHaveBeenNthCalledWith(
        1,
        "project-1",
        "confirmation-succeeded"
      );
      expect(mockApi.voidProjectConfirmation).toHaveBeenNthCalledWith(
        2,
        "project-1",
        "confirmation-failed"
      );
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(
        within(register).getByRole("button", {
          name: "Select confirmation: Failed bank",
        })
      ).toHaveAttribute("aria-pressed", "true")
    );
    expect(screen.queryByText("Succeeded bank")).not.toBeInTheDocument();
  });

  it("uses toolbar selection mode to restore confirmations from the recycle bin", async () => {
    const voided = confirmation({ status: "VOIDED" });
    const restored = confirmation({ status: "DRAFT" });
    mockApi.projectConfirmations
      .mockResolvedValueOnce([voided])
      .mockResolvedValue([restored]);
    mockApi.restoreProjectConfirmation.mockResolvedValue(restored);
    renderPanel();

    fireEvent.click(
      await screen.findByRole("button", { name: /^Recycle bin/ })
    );
    const register = await screen.findByTestId(
      "confirmation-register-data-grid"
    );
    expect(
      within(register).queryByRole("button", { name: "New confirmation" })
    ).not.toBeInTheDocument();
    const awaitedFixture2 = await screen.findByText("HSBC Hong Kong");
    const row = awaitedFixture2.closest("tr");
    expect(row).not.toBeNull();
    expect(
      within(row as HTMLElement).queryByRole("button", {
        name: "Restore confirmation: HSBC Hong Kong",
      })
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(register).getByRole("button", { name: "Restore confirmations" })
    );
    fireEvent.click(
      within(register).getByRole("button", {
        name: "Select confirmation: HSBC Hong Kong",
      })
    );
    fireEvent.click(
      within(register).getByRole("button", {
        name: "Restore selected confirmations",
      })
    );

    await waitFor(() =>
      expect(mockApi.restoreProjectConfirmation).toHaveBeenCalledWith(
        "project-1",
        "confirmation-1"
      )
    );
  });

  it("uses the shared collapsible rail for project confirmation navigation", async () => {
    mockApi.projectConfirmations.mockResolvedValue([confirmation()]);
    renderPanel();

    await expect(
      screen.findByRole("navigation", { name: "All confirmations" })
    ).resolves.toBeVisible();

    const rail = screen.getByRole("separator", {
      name: "Confirmation secondary navigation",
    });
    const navigation = screen
      .getByRole("navigation", { name: "All confirmations" })
      .closest("aside");
    expect(navigation).not.toBeNull();
    const navigationPanelContent = navigation?.parentElement;
    expect(navigationPanelContent).toHaveClass("!overflow-hidden");
    expect(rail).toHaveAttribute("aria-orientation", "vertical");
    expect(rail).toHaveAttribute("aria-expanded", "true");
    expect(rail).toHaveAttribute("aria-valuemin", "224");
    expect(rail).toHaveAttribute("aria-valuemax", "320");
    expect(rail).toHaveClass("cursor-pointer", "active:cursor-col-resize");

    fireEvent.pointerDown(rail, {
      button: 0,
      clientX: 256,
      pointerId: 21,
    });
    fireEvent.pointerMove(window, { clientX: 100, pointerId: 21 });

    expect(rail).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(rail).toHaveAttribute("aria-valuenow", "100"));
    expect(navigationPanelContent).toHaveClass("!overflow-visible");
    expect(navigation).toHaveStyle({ width: "100px" });

    fireEvent.pointerMove(window, { clientX: 0, pointerId: 21 });

    await waitFor(() => expect(rail).toHaveAttribute("aria-expanded", "true"));
    expect(navigation).not.toHaveAttribute("inert");
    fireEvent.pointerUp(window, { pointerId: 21 });
    expect(rail).toHaveAttribute("aria-expanded", "false");
    expect(rail).toHaveAttribute("aria-valuenow", "0");
    expect(rail).toHaveAttribute("data-state", "collapsed");
    expect(navigation).toHaveAttribute("inert");
    expect(navigationPanelContent).toHaveClass("!overflow-hidden");

    fireEvent.pointerDown(rail, {
      button: 0,
      clientX: 0,
      pointerId: 22,
    });
    fireEvent.pointerMove(window, { clientX: 60, pointerId: 22 });

    await waitFor(() => {
      expect(rail).toHaveAttribute("aria-expanded", "true");
      expect(rail).toHaveAttribute("aria-valuenow", "60");
    });
    fireEvent.pointerUp(window, { pointerId: 22 });
  });

  it("selects other subtype independently from the other confirmations group", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({ id: "lawyer-1", type: "LAWYER", counterpartyName: "Law firm" }),
      confirmation({ id: "other-1", type: "OTHER", counterpartyName: "Other recipient" }),
    ]);
    renderPanel();
    const navigation = await screen.findByRole("navigation", { name: "All confirmations" });
    await screen.findByText("Law firm");
    const group = within(navigation).getByRole("button", { name: /^Other confirmations/ });
    const subtype = within(navigation).getByRole("button", { name: /^Other\s*\d+$/ });

    fireEvent.click(subtype);
    expect(subtype).toHaveAttribute("data-active", "true");
    expect(group).toHaveAttribute("data-active", "false");
    expect(screen.queryByText("Law firm")).not.toBeInTheDocument();
    expect(screen.getByText("Other recipient")).toBeVisible();

    fireEvent.click(group);
    expect(group).toHaveAttribute("data-active", "true");
    expect(subtype).toHaveAttribute("data-active", "false");
    expect(screen.getByText("Law firm")).toBeVisible();
    expect(screen.getByText("Other recipient")).toBeVisible();
  });

  it("keeps secondary category navigation unfilled until hover or selection", async () => {
    mockApi.projectConfirmations.mockResolvedValue([confirmation()]);
    renderPanel();

    const navigation = await screen.findByRole("navigation", {
      name: "All confirmations",
    });
    const bank = within(navigation).getByRole("button", { name: /^Bank/ });

    expect(bank).toHaveClass("border-0", "bg-transparent", "text-emerald-800");
    expect(bank).not.toHaveClass("border", "bg-emerald-500/5");

    fireEvent.click(bank);
    expect(bank).toHaveClass("bg-secondary", "text-emerald-800");
  });

  it("uses a fluid DataGrid layout while preserving long confirmation codes", async () => {
    const longCode = "TEST_20260616_1-LEGACY-3-HSBC-HONGKONG-001";
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({ confirmationCode: longCode }),
    ]);
    renderPanel();

    const grid = await screen.findByTestId("confirmation-register-data-grid");
    expect(screen.getByRole("main").closest("section")).toHaveClass("p-3");
    expect(screen.getByRole("main").closest("section")).not.toHaveClass(
      "p-1",
      "p-2"
    );
    const code = await within(grid).findByLabelText(longCode);
    expect(code).toHaveClass("break-all");
    expect(code).toHaveAttribute("aria-label", longCode);
    expect(
      within(grid).queryByRole("separator", {
        name: "Resize Confirmation no. column",
      })
    ).not.toBeInTheDocument();
    expect(
      within(grid).getByRole("button", { name: "Filter Counterparty" })
    ).toBeVisible();
  });

  it("keeps the shared confirmation DataGrid inside the right scroll owner", async () => {
    mockApi.projectConfirmations.mockResolvedValue([confirmation()]);
    renderPanel();

    const grid = await screen.findByTestId("confirmation-register-data-grid");
    expect(screen.getByRole("complementary")).toHaveClass(
      "rounded-xl",
      "border"
    );
    expect(screen.getByRole("main")).toHaveClass("overflow-y-auto");
    expect(screen.getByRole("main")).toHaveClass("rounded-xl", "border");
    expect(within(grid).getByRole("table")).toBeVisible();
    expect(
      within(grid).getByRole("columnheader", { name: "Counterparty" })
    ).toBeVisible();
  });

  it("shows a project overview computed from the existing confirmation list", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({ id: "draft-1", counterpartyName: "Draft bank" }),
      confirmation({
        id: "prepared-1",
        counterpartyName: "Related company",
        type: "RELATED_PARTY",
        status: "PREPARED",
      }),
      confirmation({
        id: "closed-1",
        counterpartyName: "Law firm",
        type: "LAWYER",
        status: "CLOSED",
      }),
    ]);
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Overview" }));

    const overview = screen.getByRole("region", {
      name: "Confirmation overview",
    });
    expect(overview).toBeVisible();
    expect(screen.getByRole("main")).toHaveClass("overflow-y-auto");
    expect(within(overview).getByText("Count")).toBeVisible();
    expect(within(overview).getByText("Percentage")).toBeVisible();
    expect(
      within(overview).getByRole("button", { name: "Total Unclassified 0" })
    ).toBeVisible();
    expect(mockApi.projectConfirmations).toHaveBeenCalledOnce();

    fireEvent.click(
      within(overview).getByRole("button", {
        name: "Frozen Related party 1",
      })
    );

    const register = screen.getByTestId("confirmation-register-data-grid");
    expect(register).toBeVisible();
    expect(within(register).getByText("Related company")).toBeVisible();
    expect(within(register).queryByText("Draft bank")).not.toBeInTheDocument();
    expect(within(register).queryByText("Law firm")).not.toBeInTheDocument();
  });

  it("shows sent confirmations by waiting time and opens the selected item", async () => {
    const sentAt = new Date(
      Date.now() - 10 * 24 * 60 * 60 * 1000
    ).toISOString();
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({
        id: "awaiting-1",
        counterpartyName: "Waiting bank",
        status: "AWAITING_RESPONSE",
        dispatches: [
          {
            id: "dispatch-1",
            confirmationId: "awaiting-1",
            sequence: 1,
            method: "COURIER",
            sentAt,
            createdBy: "user-1",
            createdAt: sentAt,
          },
        ],
      }),
    ]);
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Overview" }));
    const overview = screen.getByRole("region", {
      name: "Confirmation overview",
    });
    fireEvent.click(
      within(overview).getByRole("button", { name: "8–14 days Bank 1" })
    );

    const register = await screen.findByTestId(
      "confirmation-register-data-grid"
    );
    expect(register).toBeVisible();
    const row = await within(register).findByRole("row", {
      name: /Waiting bank/,
    });
    expect(within(row).getByText("Waiting bank")).toBeVisible();
    fireEvent.click(within(row).getByText("Waiting bank"));

    const detail = screen.getByRole("main");
    const toolbar = await within(detail).findByTestId(
      "confirmation-detail-toolbar"
    );
    await expect(
      within(detail).findByRole("button", { name: "Upload response" })
    ).resolves.toBeVisible();
    expect(
      within(toolbar).getByRole("tab", { name: "Tracking" })
    ).toHaveAttribute("aria-selected", "true");
  });

  it("returns to the register from an active confirmation", async () => {
    mockApi.projectConfirmations.mockResolvedValue([confirmation()]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    await expect(
      screen.findByLabelText("Confirmation template")
    ).resolves.toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /All confirmations/ }));

    expect(screen.getByTestId("confirmation-register-data-grid")).toBeVisible();
    expect(
      screen.queryByLabelText("Confirmation template")
    ).not.toBeInTheDocument();
  });

  it("records a scanned response against the selected sent confirmation", async () => {
    const awaitingResponse = confirmation({
      status: "AWAITING_RESPONSE",
      dispatches: [
        {
          id: "dispatch-1",
          confirmationId: "confirmation-1",
          sequence: 1,
          method: "COURIER",
          trackingNumber: "TRACK-001",
          sentAt: "2026-07-15T08:00:00.000Z",
          createdBy: "user-1",
          createdAt: "2026-07-15T08:00:00.000Z",
        },
      ],
    });
    const responseReceived = confirmation({
      ...awaitingResponse,
      status: "RESPONSE_RECEIVED",
      updatedAt: "2026-07-17T08:30:00.000Z",
      responses: [
        {
          id: "response-1",
          confirmationId: "confirmation-1",
          responseStatus: "RECEIVED",
          responseChannel: "PAPER",
          matchMethod: "MANUAL",
          routingStatus: "ROUTED",
          receivedAt: "2026-07-17T08:30:00.000Z",
          createdAt: "2026-07-17T08:30:00.000Z",
          updatedAt: "2026-07-17T08:30:00.000Z",
          artifacts: [
            {
              id: "artifact-1",
              responseId: "response-1",
              sequence: 1,
              fileName: "bank-response.pdf",
              mimeType: "application/pdf",
              fileSize: 18,
              sha256: "test-sha256",
              uploadedBy: "user-1",
              capturedAt: "2026-07-17T08:30:00.000Z",
              createdAt: "2026-07-17T08:30:00.000Z",
            },
          ],
        },
      ],
    });
    mockApi.projectConfirmations.mockResolvedValue([awaitingResponse]);
    mockApi.receiveProjectConfirmationResponse.mockImplementation(async () => {
      await Promise.resolve();
      mockApi.projectConfirmations.mockResolvedValue([responseReceived]);
      return responseReceived;
    });
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    await expect(
      screen.findByRole("tab", { name: "Tracking" })
    ).resolves.toHaveAttribute("aria-selected", "true");
    fireEvent.click(
      await screen.findByRole("button", { name: "Upload response" })
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      screen.queryByText(
        "Upload the scan and record receipt details. The response is linked automatically to this confirmation and project."
      )
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByText("PDF, JPG, or PNG up to 20 MB.")
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("combobox", { name: "Response channel" })
    );
    expect(
      screen.getAllByRole("option").map((option) => option.textContent)
    ).toStrictEqual(["Paper", "Electronic", "Other"]);
    fireEvent.click(screen.getByRole("option", { name: "Paper" }));
    const responseFile = new File(["%PDF-1.4 response"], "bank-response.pdf", {
      type: "application/pdf",
    });
    const responseImage = new File(["image"], "bank-response-page-2.png", {
      type: "image/png",
    });
    const responseFilesInput = within(dialog).getByLabelText("Response files");
    expect(responseFilesInput).toHaveAttribute(
      "accept",
      expect.stringContaining(".doc,.docx")
    );
    fireEvent.change(responseFilesInput, {
      target: { files: [responseFile, responseImage] },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirm received" })
    );

    await waitFor(() =>
      expect(mockApi.receiveProjectConfirmationResponse).toHaveBeenCalledWith(
        "project-1",
        "confirmation-1",
        expect.objectContaining({
          files: [responseFile, responseImage],
          responseChannel: "PAPER",
        })
      )
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });

  it("shows the stored response scan for a closed confirmation", async () => {
    const closed = confirmation({
      status: "CLOSED",
      responses: [
        {
          id: "response-pending",
          confirmationId: "confirmation-1",
          responseStatus: "RECEIVED",
          routingStatus: "PENDING",
          receivedAt: "2026-07-18T08:30:00.000Z",
          createdAt: "2026-07-18T08:30:00.000Z",
          updatedAt: "2026-07-18T08:30:00.000Z",
          artifacts: [],
        },
        {
          id: "response-1",
          confirmationId: "confirmation-1",
          responseStatus: "RECEIVED",
          responseChannel: "PAPER",
          matchMethod: "MANUAL",
          routingStatus: "ROUTED",
          receivedAt: "2026-07-17T08:30:00.000Z",
          createdAt: "2026-07-17T08:30:00.000Z",
          updatedAt: "2026-07-17T08:30:00.000Z",
          artifacts: [
            {
              id: "artifact-1",
              responseId: "response-1",
              sequence: 1,
              fileName: "bank-response.pdf",
              mimeType: "application/pdf",
              fileSize: 18,
              sha256: "test-sha256",
              uploadedBy: "user-1",
              capturedAt: "2026-07-17T08:30:00.000Z",
              createdAt: "2026-07-17T08:30:00.000Z",
            },
            {
              id: "artifact-2",
              responseId: "response-1",
              sequence: 2,
              fileName: "bank-response-page-2.png",
              mimeType: "image/png",
              fileSize: 5,
              sha256: "test-image-sha256",
              uploadedBy: "user-1",
              capturedAt: "2026-07-17T08:30:00.000Z",
              createdAt: "2026-07-17T08:30:00.000Z",
            },
          ],
        },
      ],
    });
    mockApi.projectConfirmations.mockResolvedValue([closed]);
    mockApi.addProjectConfirmationResponseArtifacts.mockResolvedValue(closed);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    await expect(
      screen.findByRole("button", { name: "View response scan" })
    ).resolves.toBeVisible();
    await expect(
      screen.findByLabelText("bank-response.pdf")
    ).resolves.toBeVisible();
    expect(mockApi.projectConfirmationResponseArtifact).toHaveBeenCalledWith(
      "project-1",
      "confirmation-1",
      "response-1",
      "artifact-1"
    );

    fireEvent.click(
      screen.getByTestId("confirmation-response-file-picker-trigger")
    );
    fireEvent.click(
      await screen.findByRole("option", { name: /bank-response-page-2/ })
    );
    await expect(
      screen.findByAltText("bank-response-page-2.png")
    ).resolves.toBeVisible();
    expect(mockApi.projectConfirmationResponseArtifact).toHaveBeenCalledWith(
      "project-1",
      "confirmation-1",
      "response-1",
      "artifact-2"
    );

    const supplement = new File(["more"], "supplement.png", {
      type: "image/png",
    });
    const addFilesInput = screen
      .getAllByLabelText("Add files")
      .find((element) => element.tagName === "INPUT");
    expect(addFilesInput).toBeDefined();
    expect(addFilesInput).toHaveAttribute(
      "accept",
      expect.stringContaining(".doc,.docx")
    );
    fireEvent.change(requiredFixture(addFilesInput), {
      target: { files: [supplement] },
    });
    await waitFor(() =>
      expect(
        mockApi.addProjectConfirmationResponseArtifacts
      ).toHaveBeenCalledWith("project-1", "confirmation-1", "response-1", [
        supplement,
      ])
    );

    expect(
      screen.queryByRole("button", { name: "Withdraw record" })
    ).not.toBeInTheDocument();
  });

  it("copies the confirmation number from the detail toolbar", async () => {
    const writeText = vi.fn().mockImplementation(completeWithoutResult);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({ confirmationCode: "AUD-COPY-001" }),
    ]);
    renderPanel();
    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    const toolbar = await screen.findByTestId("confirmation-detail-toolbar");
    fireEvent.click(
      within(toolbar).getByRole("button", { name: "Copy confirmation number" })
    );
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("AUD-COPY-001"));
  });

  it("keeps detail back, context, and stage tabs in one compact toolbar", async () => {
    mockApi.projectConfirmations.mockResolvedValue([confirmation()]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    const toolbar = await screen.findByTestId("confirmation-detail-toolbar");
    expect(
      within(toolbar).getByRole("button", {
        name: "Back to all confirmations",
      })
    ).toHaveClass("hover:-translate-x-0.5", "active:translate-y-px");
    expect(within(toolbar).getByText("HSBC Hong Kong")).toBeVisible();
    expect(
      within(toolbar).getByRole("tab", { name: "Confirmation" })
    ).toBeVisible();
    expect(
      within(toolbar).getByRole("tab", { name: "Tracking" })
    ).toBeVisible();
    expect(within(toolbar).getByRole("tab", { name: "Review" })).toBeVisible();
  });

  it("keeps one two-row detail toolbar across all preparation stages", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({ status: "AWAITING_RESPONSE" }),
    ]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    await screen.findByTestId("confirmation-detail-toolbar");

    for (const stage of ["Confirmation", "Tracking", "Review"]) {
      fireEvent.click(screen.getByRole("tab", { name: stage }));
      const toolbar = await screen.findByTestId("confirmation-detail-toolbar");

      expect(
        within(toolbar).getByTestId("confirmation-detail-toolbar-primary")
      ).toBeVisible();
      expect(
        within(toolbar).getByTestId("confirmation-detail-toolbar-actions")
      ).toBeVisible();
      expect(
        toolbar.querySelectorAll(
          '[data-testid="confirmation-detail-toolbar-primary"]'
        )
      ).toHaveLength(1);
      expect(
        toolbar.querySelectorAll(
          '[data-testid="confirmation-detail-toolbar-actions"]'
        )
      ).toHaveLength(1);
    }
  });

  it("keeps the response file actions inside the shared review toolbar", async () => {
    mockApi.projectConfirmations.mockResolvedValue([receivedConfirmation()]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    const toolbar = await screen.findByTestId("confirmation-detail-toolbar");
    const reviewHeader = within(toolbar).getByTestId(
      "confirmation-review-header"
    );

    expect(reviewHeader).toBeVisible();
    expect(
      reviewHeader.closest('[data-testid="confirmation-detail-toolbar"]')
    ).toBe(toolbar);
    expect(screen.getAllByTestId("confirmation-review-header")).toHaveLength(1);
  });

  it("lets the detail panes fill the workspace with the splitter as the divider", async () => {
    mockApi.projectConfirmations.mockResolvedValue([receivedConfirmation()]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    expect(screen.getByRole("main")).toHaveClass("p-0");
    expect(screen.getByRole("complementary")).not.toHaveClass("border-r");
  });

  it("shows response withdrawal only for an unreviewed routed response", async () => {
    mockApi.projectConfirmations.mockResolvedValue([receivedConfirmation()]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));

    await screen.findByTestId("confirmation-detail-toolbar");

    await expect(
      screen.findByRole("button", { name: "Withdraw record" })
    ).resolves.toBeVisible();
  });

  it("withdraws the newest routed response when multiple responses exist", async () => {
    const received = receivedConfirmation();
    const firstResponse = requiredFixture(
      requiredFixture(received.responses)[0]
    );
    const latestResponse = {
      ...firstResponse,
      id: "response-2",
      receivedAt: "2026-07-18T08:30:00.000Z",
      createdAt: "2026-07-18T08:30:00.000Z",
      updatedAt: "2026-07-18T08:30:00.000Z",
      artifacts: (firstResponse.artifacts ?? []).map((artifact) => ({
        ...artifact,
        id: "artifact-2",
        responseId: "response-2",
      })),
    };
    received.responses = [firstResponse, latestResponse];
    mockApi.projectConfirmations.mockResolvedValue([received]);
    mockApi.withdrawProjectConfirmationResponse.mockResolvedValue(
      confirmation({ status: "AWAITING_RESPONSE", responses: [] })
    );
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.click(
      await screen.findByRole("button", { name: "Withdraw record" })
    );
    await expect(
      screen.findByText("Withdraw this response record?")
    ).resolves.toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));

    await waitFor(() =>
      expect(mockApi.withdrawProjectConfirmationResponse).toHaveBeenCalledWith(
        "project-1",
        "confirmation-1",
        "response-2"
      )
    );
  });

  it("returns to pending responses when withdrawal removes an automatic confirmation", async () => {
    mockApi.projectConfirmations.mockResolvedValue([receivedConfirmation()]);
    mockApi.withdrawProjectConfirmationResponse.mockImplementation(async () => {
      await Promise.resolve();
      mockApi.projectConfirmations.mockResolvedValue([]);
      return {
        deletedConfirmationId: "confirmation-1",
        responseLibraryFileId: "library-1",
      };
    });
    renderPanel();
    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.click(
      await screen.findByRole("button", { name: "Withdraw record" })
    );
    fireEvent.click(await screen.findByRole("button", { name: "Withdraw" }));
    await waitFor(() =>
      expect(
        screen.queryByTestId("confirmation-detail-toolbar")
      ).not.toBeInTheDocument()
    );
    expect(
      new URL(window.location.href).searchParams.has("confirmationId") === false
    ).toBeTruthy();
    await waitFor(() =>
      expect(mockApi.projectConfirmationResponseWarehouse).toHaveBeenCalledWith(
        "project-1"
      )
    );
  });

  it("hides response withdrawal after a response review marks follow-up work", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      receivedConfirmation({ differenceStatus: "PENDING_FOLLOW_UP" }),
    ]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));

    expect(
      screen.queryByRole("button", { name: "Withdraw record" })
    ).not.toBeInTheDocument();
  });

  it("shows confirmation categories and exposes status filtering", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({ id: "bank-1", counterpartyName: "Example bank" }),
      confirmation({
        id: "lawyer-1",
        counterpartyName: "Example law firm",
        type: "LAWYER",
        status: "PREPARED",
      }),
    ]);
    renderPanel();

    await expect(screen.findByText("Example bank")).resolves.toBeVisible();
    expect(screen.getByText("Example law firm")).toBeVisible();
    expect(screen.getAllByText("Bank").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Lawyer").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("columnheader", { name: /Current status/ })
    ).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: /Base date/ })
    ).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: /Waiting time/ })
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Filter Counterparty" })
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Filter Category" })
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Filter confirmations" })
    ).not.toBeInTheDocument();
  });

  it("filters counterparty and category columns without changing the loaded rows", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({ id: "bank-1", counterpartyName: "Example bank" }),
      confirmation({ id: "bank-2", counterpartyName: "Second bank" }),
      confirmation({
        id: "lawyer-1",
        counterpartyName: "Example law firm",
        type: "LAWYER",
      }),
    ]);
    renderPanel();

    const main = screen.getByRole("main");
    const workArea = screen.getByTestId("confirmation-register-data-grid");
    await within(workArea).findByText("Example bank");
    fireEvent.click(
      within(workArea).getByRole("button", { name: "Filter Counterparty" })
    );
    const counterpartyPopover = await screen.findByRole("dialog");
    fireEvent.click(
      within(counterpartyPopover).getByRole("checkbox", {
        name: "Example bank",
      })
    );
    expect(within(workArea).getByText("Example bank")).toBeVisible();
    expect(within(workArea).queryByText("Second bank")).not.toBeInTheDocument();
    expect(
      within(workArea).queryByText("Example law firm")
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(workArea).getByRole("button", { name: "Filter Counterparty" })
    );
    await screen.findByRole("dialog");
    fireEvent.click(
      within(main).getByRole("button", {
        name: "Reset filters",
      })
    );
    fireEvent.click(
      within(workArea).getByRole("button", { name: "Filter Category" })
    );
    const categoryPopover = await screen.findByRole("dialog");
    fireEvent.click(
      within(categoryPopover).getByRole("checkbox", { name: "Lawyer" })
    );

    expect(within(workArea).getByText("Example law firm")).toBeVisible();
    expect(
      within(workArea).queryByText("Example bank")
    ).not.toBeInTheDocument();
    expect(within(workArea).queryByText("Second bank")).not.toBeInTheDocument();
    expect(mockApi.projectConfirmations).toHaveBeenCalledOnce();
  });

  it("keeps the full column option set available while combining filters", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({ id: "draft-1", counterpartyName: "Draft bank" }),
      confirmation({
        id: "prepared-1",
        counterpartyName: "Prepared bank",
        status: "PREPARED",
      }),
      confirmation({
        id: "closed-1",
        counterpartyName: "Closed bank",
        status: "CLOSED",
      }),
    ]);
    renderPanel();

    await screen.findByText("Draft bank");
    fireEvent.click(
      screen.getByRole("button", { name: "Filter Current status" })
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Draft" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Filter Current status" })
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Frozen" }));

    expect(screen.getByText("Draft bank")).toBeVisible();
    expect(screen.getByText("Prepared bank")).toBeVisible();
    expect(screen.queryByText("Closed bank")).not.toBeInTheDocument();
  });

  it("opens a confirmation from any row cell and resets independent filters without refetching", async () => {
    mockApi.projectConfirmations.mockResolvedValue([confirmation()]);
    renderPanel();

    const awaitedFixture3 = await screen.findByText("HSBC Hong Kong");
    const row = awaitedFixture3.closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(within(row as HTMLElement).getByText("Bank"));
    await expect(
      screen.findByLabelText("Confirmation template")
    ).resolves.toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /All confirmations/ }));
    const refetchCount = mockApi.projectConfirmations.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(mockApi.projectConfirmations).toHaveBeenCalledTimes(refetchCount);
  });

  it("navigates from a matrix cell to the filtered register", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({
        id: "lawyer-1",
        type: "LAWYER",
        counterpartyName: "Law firm",
      }),
      confirmation({
        id: "other-1",
        type: "OTHER",
        counterpartyName: "Other recipient",
      }),
    ]);
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Overview" }));
    const overview = screen.getByRole("region", {
      name: "Confirmation overview",
    });
    fireEvent.click(
      within(overview).getByRole("button", { name: "Draft Other 1" })
    );

    const register = screen.getByTestId("confirmation-register-data-grid");
    expect(register).toBeVisible();
    expect(within(register).getByText("Other recipient")).toBeVisible();
    expect(within(register).queryByText("Law firm")).not.toBeInTheDocument();
  });

  it("searches confirmation details within the active navigation category", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({ id: "bank-a", counterpartyName: "Alpha bank" }),
      confirmation({
        id: "lawyer-a",
        counterpartyName: "Alpha legal",
        type: "LAWYER",
      }),
      confirmation({
        id: "lawyer-b",
        counterpartyName: "Beta legal",
        type: "LAWYER",
      }),
    ]);
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: /Lawyer/ }));
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Search confirmations by name prefix",
      }),
      { target: { value: "Alpha" } }
    );

    expect(screen.getByText("Alpha legal")).toBeVisible();
    expect(screen.queryByText("Alpha bank")).not.toBeInTheDocument();
    expect(screen.queryByText("Beta legal")).not.toBeInTheDocument();
  });

  it("searches the visible fallback name and renames it on double click", async () => {
    const user = userEvent.setup();
    const unnamed = confirmation({ counterpartyName: "", displayName: null });
    mockApi.projectConfirmations.mockResolvedValue([unnamed]);
    mockApi.updateProjectConfirmation.mockResolvedValue({
      ...unnamed,
      displayName: "Cash confirmation",
    });
    renderPanel();

    fireEvent.change(
      await screen.findByRole("textbox", {
        name: "Search confirmations by name prefix",
      }),
      { target: { value: "New" } }
    );
    const fallbackName = within(screen.getByRole("table")).getByText(
      "New confirmation"
    );
    expect(fallbackName).toBeVisible();
    fireEvent.doubleClick(fallbackName);
    const nameInput = await screen.findByRole("textbox", {
      name: "Confirmation name",
    });
    await user.clear(nameInput);
    await user.type(nameInput, "Cash confirmation");
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(mockApi.updateProjectConfirmation).toHaveBeenCalledWith(
        "project-1",
        unnamed.id,
        {
          displayName: "Cash confirmation",
        }
      )
    );
  });

  it("offers grouped confirmation types and uploads an ordinary PDF after creation", async () => {
    const emptyDraft = confirmation({
      type: "BANK",
      draftTemplateCode: null,
      draftPayload: null,
    });
    mockApi.createProjectConfirmation.mockResolvedValue(emptyDraft);
    mockApi.uploadProjectConfirmationFile.mockResolvedValue(
      confirmation({
        status: "DRAFT",
        type: "BANK",
        draftTemplateCode: null,
        currentArtifact: {
          id: "uploaded-artifact-1",
          confirmationId: "confirmation-1",
          version: 1,
          disposition: "ACTIVE",
          templateCode: "UPLOADED_DOCUMENT",
          templateVersion: "1",
          docxSize: 10,
          pdfSize: 10,
          pdfSha256: "abcdef0123456789",
          submittedBy: "user-1",
          submittedAt: "2026-07-12T09:00:00.000Z",
        },
      })
    );
    renderPanel();

    fireEvent.click(
      await screen.findByRole("button", { name: "New confirmation" })
    );
    const newConfirmationDialog = await screen.findByRole("dialog");
    expect(
      within(newConfirmationDialog).getByLabelText("Confirmation group")
    ).toBeVisible();
    expect(
      within(newConfirmationDialog).getByLabelText("Confirmation group")
    ).toHaveTextContent("Financial institutions");
    expect(
      within(newConfirmationDialog).getByLabelText("Confirmation category")
    ).toHaveTextContent("Bank");
    fireEvent.click(
      within(newConfirmationDialog).getByLabelText("Confirmation group")
    );
    const confirmationGroupPopover = await screen.findByRole("listbox");
    expect(
      document.querySelector('[data-slot="select-content"]')
    ).toHaveAttribute("data-align-trigger", "false");
    expect(
      within(confirmationGroupPopover).getByText("Financial institutions")
    ).toBeVisible();
    expect(
      within(confirmationGroupPopover).queryByRole("option", {
        name: "Unclassified",
      })
    ).not.toBeInTheDocument();
    fireEvent.keyDown(
      within(newConfirmationDialog).getByLabelText("Confirmation group"),
      {
        key: "Escape",
      }
    );
    fireEvent.click(
      within(newConfirmationDialog).getByLabelText("Confirmation category")
    );
    const confirmationTypePopover = await screen.findByRole("listbox");
    expect(
      document.querySelector('[data-slot="select-content"]')
    ).toHaveAttribute("data-align-trigger", "false");
    expect(within(confirmationTypePopover).getByText("Bank")).toBeVisible();
    fireEvent.keyDown(
      within(newConfirmationDialog).getByLabelText("Confirmation category"),
      {
        key: "Escape",
      }
    );
    fireEvent.click(
      within(newConfirmationDialog).getByRole("button", {
        name: "Create confirmation",
      })
    );
    await waitFor(() =>
      expect(mockApi.createProjectConfirmation).toHaveBeenCalledWith(
        "project-1",
        {
          type: "BANK",
          draftPayload: {},
        }
      )
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Upload confirmation file" })
    );
    const uploadDialog = await screen.findByRole("dialog");
    const uploadCounterparty = uploadDialog.querySelector<HTMLInputElement>(
      "#upload-counterparty"
    );
    expect(uploadCounterparty).not.toBeNull();
    fireEvent.change(uploadCounterparty as HTMLInputElement, {
      target: { value: "Example law firm" },
    });
    const file = new File(["%PDF-1.4"], "lawyer.pdf", {
      type: "application/pdf",
    });
    const confirmationFile =
      uploadDialog.querySelector<HTMLInputElement>("#confirmation-file");
    expect(confirmationFile).not.toBeNull();
    fireEvent.change(confirmationFile as HTMLInputElement, {
      target: { files: [file] },
    });
    fireEvent.click(
      within(uploadDialog).getByRole("button", { name: "Upload and submit" })
    );

    await waitFor(() =>
      expect(mockApi.uploadProjectConfirmationFile).toHaveBeenCalledWith(
        "project-1",
        emptyDraft.id,
        { counterpartyName: "Example law firm", file: [file] }
      )
    );
  });

  it("restricts a new confirmation upload to PDF", async () => {
    const emptyDraft = confirmation({
      draftTemplateCode: null,
      draftPayload: null,
    });
    mockApi.projectConfirmations.mockResolvedValue([emptyDraft]);
    mockApi.uploadProjectConfirmationFile.mockResolvedValue(emptyDraft);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.click(
      await screen.findByRole("button", { name: "Upload confirmation file" })
    );

    const uploadDialog = await screen.findByRole("dialog");
    const input =
      uploadDialog.querySelector<HTMLInputElement>("#confirmation-file");
    expect(input).not.toBeNull();
    expect(input).toHaveAttribute("accept", "application/pdf");

    const file = new File(["%PDF-1.7"], "confirmation.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
    const counterpartyInput = uploadDialog.querySelector<HTMLInputElement>(
      "#upload-counterparty"
    );
    expect(counterpartyInput).not.toBeNull();
    fireEvent.change(counterpartyInput as HTMLInputElement, {
      target: { value: "Example counterparty" },
    });
    fireEvent.click(
      within(uploadDialog).getByRole("button", { name: "Upload and submit" })
    );

    await waitFor(() =>
      expect(mockApi.uploadProjectConfirmationFile).toHaveBeenCalledWith(
        "project-1",
        emptyDraft.id,
        { counterpartyName: "Example counterparty", file: [file] }
      )
    );
  });

  it("downloads an unsupported uploaded format with its original safe filename", async () => {
    const uploaded = confirmation({
      attachmentName: "evidence.msg",
      draftTemplateCode: null,
      draftPayload: null,
      currentArtifact: {
        id: "uploaded-artifact-1",
        confirmationId: "confirmation-1",
        version: 1,
        disposition: "ACTIVE",
        templateCode: "UPLOADED_DOCUMENT",
        templateVersion: "1",
        docxSize: 15,
        pdfSize: 15,
        pdfSha256: "abcdef0123456789",
        submittedBy: "user-1",
        submittedAt: "2026-07-12T09:00:00.000Z",
      },
    });
    mockApi.projectConfirmations.mockResolvedValue([uploaded]);
    mockApi.previewProjectConfirmationPdf.mockResolvedValue(
      new Blob(["opaque evidence"], { type: "application/pdf" })
    );
    let downloadName: string | null = null;
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function click(this: HTMLAnchorElement) {
        downloadName = this.download;
      });
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.click(
      await screen.findByRole("button", { name: "Download confirmation" })
    );

    await waitFor(() => expect(downloadName).toBe("evidence.msg"));
    click.mockRestore();
  });

  it.each([["confirmation.pdf", "application/pdf"]])(
    "accepts %s upload through the PDF-only file input",
    async (fileName, mimeType) => {
      const emptyDraft = confirmation({
        draftTemplateCode: null,
        draftPayload: null,
      });
      mockApi.projectConfirmations.mockResolvedValue([emptyDraft]);
      mockApi.uploadProjectConfirmationFile.mockResolvedValue(emptyDraft);
      renderPanel();

      fireEvent.click(await screen.findByText("HSBC Hong Kong"));
      fireEvent.click(
        await screen.findByRole("button", { name: "Upload confirmation file" })
      );
      const dialog = await screen.findByRole("dialog");
      const input =
        dialog.querySelector<HTMLInputElement>("#confirmation-file");
      expect(input).toHaveAttribute("accept", "application/pdf");
      fireEvent.change(input as HTMLInputElement, {
        target: { files: [new File(["opaque"], fileName, { type: mimeType })] },
      });
      fireEvent.change(
        requiredFixture(
          dialog.querySelector<HTMLInputElement>("#upload-counterparty")
        ),
        {
          target: { value: "Opaque counterparty" },
        }
      );
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Upload and submit" })
      );

      await waitFor(() =>
        expect(mockApi.uploadProjectConfirmationFile).toHaveBeenCalledWith(
          "project-1",
          emptyDraft.id,
          expect.objectContaining({ counterpartyName: "Opaque counterparty" })
        )
      );
    }
  );

  it("shows unsupported uploaded metadata and uses the attachment download contract", async () => {
    const uploaded = confirmation({
      draftTemplateCode: null,
      draftPayload: null,
      attachment: {
        originalFileName: "evidence.msg",
        originalMimeType: "application/vnd.ms-outlook",
        previewability: "DOWNLOAD_ONLY",
        downloadUrl:
          "/projects/project-1/confirmations/confirmation-1/attachment/download",
        previewUrl: null,
      },
      currentArtifact: {
        id: "uploaded-artifact-1",
        confirmationId: "confirmation-1",
        version: 1,
        disposition: "ACTIVE",
        templateCode: "UPLOADED_DOCUMENT",
        templateVersion: "1",
        docxSize: 15,
        pdfSize: 15,
        pdfSha256: "abcdef0123456789",
        submittedBy: "user-1",
        submittedAt: "2026-07-12T09:00:00.000Z",
      },
    });
    mockApi.projectConfirmations.mockResolvedValue([uploaded]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    await expect(
      screen.findByText("This file type cannot be previewed inline.")
    ).resolves.toBeVisible();
    expect(screen.getByText("evidence.msg")).toBeVisible();
    expect(screen.getByText("application/vnd.ms-outlook")).toBeVisible();
    expect(
      vi.mocked(mockApi.previewProjectConfirmationPdf)
    ).toHaveBeenCalledTimes(0);

    fireEvent.click(
      screen.getByRole("button", { name: "Download original file" })
    );
    await waitFor(() =>
      expect(
        mockApi.downloadProjectConfirmationAttachment
      ).toHaveBeenCalledWith(
        "project-1",
        "confirmation-1",
        "/projects/project-1/confirmations/confirmation-1/attachment/download"
      )
    );
  });

  it("keeps a PDF uploaded document on the normal inline preview path", async () => {
    const uploaded = confirmation({
      draftTemplateCode: null,
      draftPayload: null,
      attachment: {
        originalFileName: "confirmation.pdf",
        originalMimeType: "application/pdf",
        previewability: "INLINE",
        downloadUrl:
          "/projects/project-1/confirmations/confirmation-1/download",
        previewUrl:
          "/projects/project-1/confirmations/confirmation-1/preview.pdf",
      },
      currentArtifact: {
        id: "uploaded-artifact-1",
        confirmationId: "confirmation-1",
        version: 1,
        disposition: "ACTIVE",
        templateCode: "UPLOADED_DOCUMENT",
        templateVersion: "1",
        docxSize: 15,
        pdfSize: 15,
        pdfSha256: "abcdef0123456789",
        submittedBy: "user-1",
        submittedAt: "2026-07-12T09:00:00.000Z",
      },
    });
    mockApi.projectConfirmations.mockResolvedValue([uploaded]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    await waitFor(() =>
      expect(mockApi.previewProjectConfirmationPdf).toHaveBeenCalledWith(
        "project-1",
        "confirmation-1"
      )
    );
    expect(
      screen.queryByText("This file type cannot be previewed inline.")
    ).not.toBeInTheDocument();
  });

  it("does not reload the PDF base while draft values change", async () => {
    const initialPreview = new Blob(["%PDF-1.4 initial"]);
    mockApi.previewProjectConfirmationPdf.mockResolvedValue(initialPreview);
    const initial = confirmation({
      draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
      draftPayload: { bankName: "HSBC Hong Kong" },
      updatedAt: "2026-08-29T08:00:00.000Z",
    });
    mockApi.projectConfirmations.mockResolvedValue([initial]);
    vi.mocked(URL.createObjectURL).mockImplementation((blob) =>
      blob === initialPreview
        ? "blob:initial-preview"
        : "blob:refreshed-preview"
    );
    const { client } = renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    await waitFor(() =>
      expect(URL.createObjectURL).toHaveBeenCalledWith(initialPreview)
    );

    client.setQueryData(
      ["project-confirmations", "project-1"],
      [
        {
          ...initial,
          draftPayload: {
            bankName: "HSBC Hong Kong",
            officeDate: "2026-08-29",
          },
          updatedAt: "2026-08-29T08:01:00.000Z",
        },
      ]
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Office Date")).toHaveValue("2026-08-29")
    );
    expect(mockApi.previewProjectConfirmationPdf).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(
      "blob:initial-preview"
    );
  });

  it("loads managed bank and securities drafts through the canonical PDF preview", async () => {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
    const managed = confirmation({
      counterpartyName: "Custodian Limited",
      draftTemplateCode: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
      draftPayload: { recipientName: "Custodian Limited" },
      type: "INTERMEDIARY",
    });
    mockApi.projectConfirmations.mockResolvedValue([managed]);
    renderPanel();

    fireEvent.click(await screen.findByText("Custodian Limited"));

    await waitFor(() =>
      expect(mockApi.previewProjectConfirmationPdf).toHaveBeenCalledWith(
        "project-1",
        "confirmation-1"
      )
    );
    expect(
      vi.mocked(mockApi.previewProjectConfirmationDocx)
    ).toHaveBeenCalledTimes(0);
  });

  it("downloads an editable custom-template draft from its DOCX preview", async () => {
    const custom = confirmation({
      draftTemplateCode: "CTPL-123456789ABC",
      draftPayload: { bankName: "HSBC Hong Kong" },
    });
    mockApi.projectConfirmations.mockResolvedValue([custom]);
    let downloadName: string | null = null;
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function click(this: HTMLAnchorElement) {
        downloadName = this.download;
      });
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    await waitFor(() =>
      expect(mockApi.previewProjectConfirmationPdf).toHaveBeenCalledWith(
        "project-1",
        "confirmation-1"
      )
    );
    mockApi.previewProjectConfirmationPdf.mockClear();

    fireEvent.click(
      screen.getByRole("button", { name: "Download confirmation" })
    );

    await waitFor(() =>
      expect(mockApi.previewProjectConfirmationPdf).toHaveBeenCalledWith(
        "project-1",
        "confirmation-1",
        expect.objectContaining({
          draftTemplateCode: "CTPL-123456789ABC",
          draftPayload: expect.objectContaining({
            bankName: "HSBC Hong Kong",
          }),
        })
      )
    );
    expect(
      vi.mocked(mockApi.downloadProjectConfirmationAttachment)
    ).toHaveBeenCalledTimes(0);
    expect(downloadName).toBe("HSBC Hong Kong.pdf");
    click.mockRestore();
  });

  it("downloads a PDF custom-template draft with the current unsaved field values", async () => {
    const custom = confirmation({
      draftTemplateCode: "CTPL-123456789ABC",
      draftPayload: {
        bankName: "HSBC Hong Kong",
        templateDesignSchema: {
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
          ],
        },
        templateFieldValues: {},
      } as never,
    });
    mockApi.projectConfirmations.mockResolvedValue([custom]);
    let downloadName: string | null = null;
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function click(this: HTMLAnchorElement) {
        downloadName = this.download;
      });
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    await waitFor(() =>
      expect(mockApi.previewProjectConfirmationPdf).toHaveBeenCalledWith(
        "project-1",
        "confirmation-1"
      )
    );
    mockApi.previewProjectConfirmationPdf.mockClear();

    fireEvent.change(await screen.findByLabelText("Dynamic Reference"), {
      target: { value: "Download value" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Download confirmation" })
    );

    await waitFor(() =>
      expect(mockApi.previewProjectConfirmationPdf).toHaveBeenCalledWith(
        "project-1",
        "confirmation-1",
        expect.objectContaining({
          draftTemplateCode: "CTPL-123456789ABC",
          draftPayload: expect.objectContaining({
            templateFieldValues: { "dynamic-reference": "Download value" },
          }),
        })
      )
    );
    expect(downloadName).toBe("HSBC Hong Kong.pdf");
    click.mockRestore();
  });

  it("downloads a standard draft with the current unsaved field values", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({
        draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
        draftPayload: { bankName: "HSBC Hong Kong" },
      }),
    ]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    await waitFor(() =>
      expect(mockApi.previewProjectConfirmationPdf).toHaveBeenCalledWith(
        "project-1",
        "confirmation-1"
      )
    );
    mockApi.previewProjectConfirmationPdf.mockClear();

    fireEvent.change(await screen.findByLabelText("Office Date"), {
      target: { value: "2026-08-27" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Download confirmation" })
    );

    await waitFor(() =>
      expect(mockApi.previewProjectConfirmationPdf).toHaveBeenCalledWith(
        "project-1",
        "confirmation-1",
        expect.objectContaining({
          draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
          draftPayload: expect.objectContaining({ officeDate: "2026-08-27" }),
        })
      )
    );
    expect(
      vi.mocked(mockApi.downloadProjectConfirmationAttachment)
    ).toHaveBeenCalledTimes(0);
  });

  it("keeps restored standard drafts on the PDF digital-twin preview path", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({
        draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
        draftPayload: { bankName: "HSBC Hong Kong" },
      }),
    ]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));

    await waitFor(() =>
      expect(mockApi.previewProjectConfirmationPdf).toHaveBeenCalledWith(
        "project-1",
        "confirmation-1"
      )
    );
    expect(
      vi.mocked(mockApi.previewProjectConfirmationDocx)
    ).toHaveBeenCalledTimes(0);
  });

  it("uses the original uploaded filename for dispatch and a PDF name for templates", () => {
    expect(
      getConfirmationDispatchAttachmentFileName(
        confirmation({
          attachmentName: "evidence.msg",
          currentArtifact: {
            id: "uploaded-artifact-1",
            confirmationId: "confirmation-1",
            version: 1,
            disposition: "ACTIVE",
            templateCode: "UPLOADED_DOCUMENT",
            templateVersion: "1",
            docxSize: 15,
            pdfSize: 15,
            pdfSha256: "abcdef0123456789",
            submittedBy: "user-1",
            submittedAt: "2026-07-12T09:00:00.000Z",
          },
        }),
        {} as never
      )
    ).toBe("evidence.msg");
    expect(
      getConfirmationDispatchAttachmentFileName(confirmation(), {} as never)
    ).toMatch(/\.pdf$/);
  });

  it("does not submit an empty confirmation file", async () => {
    const emptyDraft = confirmation({
      draftTemplateCode: null,
      draftPayload: null,
    });
    mockApi.projectConfirmations.mockResolvedValue([emptyDraft]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.click(
      await screen.findByRole("button", { name: "Upload confirmation file" })
    );

    const uploadDialog = await screen.findByRole("dialog");
    const input =
      uploadDialog.querySelector<HTMLInputElement>("#confirmation-file");
    expect(input).not.toBeNull();
    fireEvent.change(input as HTMLInputElement, {
      target: {
        files: [
          new File([], "empty.msg", { type: "application/octet-stream" }),
        ],
      },
    });
    fireEvent.change(
      uploadDialog.querySelector<HTMLInputElement>(
        "#upload-counterparty"
      ) as HTMLInputElement,
      { target: { value: "Example counterparty" } }
    );

    expect(
      within(uploadDialog).getByRole("button", { name: "Upload and submit" })
    ).toBeDisabled();
    expect(
      vi.mocked(mockApi.uploadProjectConfirmationFile)
    ).toHaveBeenCalledTimes(0);
  });

  it("does not remove existing draft content when custom upload is cancelled", async () => {
    const existing = confirmation({
      draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
      draftPayload: {
        bankName: "HSBC Hong Kong",
        referenceCode: "KEEP-EXISTING-REF",
      },
    });
    mockApi.projectConfirmations.mockResolvedValue([existing]);

    renderPanel();
    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.change(await screen.findByLabelText("Ref"), {
      target: { value: "Edited reference" },
    });
    fireEvent.click(await screen.findByLabelText("Confirmation template"));
    const customOption = screen
      .getAllByRole("option")
      .find((option) => option.textContent?.trim() === "From local upload");
    expect(customOption).toBeDefined();
    fireEvent.click(requiredFixture(customOption));

    const uploadDialog = await screen.findByRole("dialog");
    expect(
      vi.mocked(mockApi.removeProjectConfirmationContent)
    ).toHaveBeenCalledTimes(0);
    expect(
      vi.mocked(mockApi.uploadProjectConfirmationFile)
    ).toHaveBeenCalledTimes(0);
    expect(screen.getByLabelText("Ref")).toHaveValue("Edited reference");
    fireEvent.click(
      within(uploadDialog).getByRole("button", { name: "Cancel" })
    );

    expect(
      vi.mocked(mockApi.removeProjectConfirmationContent)
    ).toHaveBeenCalledTimes(0);
    expect(
      vi.mocked(mockApi.uploadProjectConfirmationFile)
    ).toHaveBeenCalledTimes(0);
    expect(
      getConfirmationEditorDraftPayload(existing.draftPayload, null)
    ).toStrictEqual(
      expect.objectContaining({ referenceCode: "KEEP-EXISTING-REF" })
    );
  });

  it("removes existing content only after a valid custom upload is confirmed", async () => {
    const existing = confirmation({
      draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
      draftPayload: { bankName: "HSBC Hong Kong" },
    });
    const cleared = confirmation({
      ...existing,
      draftTemplateCode: null,
      draftPayload: null,
      currentArtifact: null,
    });
    const uploaded = confirmation({
      ...cleared,
      currentArtifact: {
        id: "uploaded-artifact-1",
        confirmationId: "confirmation-1",
        version: 1,
        disposition: "ACTIVE",
        templateCode: "UPLOADED_DOCUMENT",
        templateVersion: "1",
        docxSize: 0,
        pdfSize: 10,
        pdfSha256: "abcdef0123456789",
        submittedBy: "user-1",
        submittedAt: "2026-07-12T09:00:00.000Z",
      },
    });
    mockApi.projectConfirmations.mockResolvedValue([existing]);
    mockApi.removeProjectConfirmationContent.mockResolvedValue(cleared);
    mockApi.uploadProjectConfirmationFile.mockResolvedValue(uploaded);

    renderPanel();
    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.click(await screen.findByLabelText("Confirmation template"));
    const customOption = screen
      .getAllByRole("option")
      .find((option) => option.textContent?.trim() === "From local upload");
    expect(customOption).toBeDefined();
    fireEvent.click(requiredFixture(customOption));

    const uploadDialog = await screen.findByRole("dialog");
    expect(
      vi.mocked(mockApi.removeProjectConfirmationContent)
    ).toHaveBeenCalledTimes(0);
    fireEvent.change(within(uploadDialog).getByLabelText("Counterparty"), {
      target: { value: "Example counterparty" },
    });
    const file = new File(["%PDF-1.4"], "custom.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(
      requiredFixture(uploadDialog.querySelector("#confirmation-file")),
      {
        target: { files: [file] },
      }
    );
    fireEvent.click(
      within(uploadDialog).getByRole("button", { name: "Upload and submit" })
    );

    await waitFor(() => {
      expect(mockApi.removeProjectConfirmationContent).toHaveBeenCalledWith(
        "project-1",
        "confirmation-1"
      );
      expect(mockApi.uploadProjectConfirmationFile).toHaveBeenCalledWith(
        "project-1",
        "confirmation-1",
        { counterpartyName: "Example counterparty", file: [file] }
      );
    });
  });

  it("creates a blank draft without offering retired Word templates", async () => {
    const created = confirmation({
      draftTemplateCode: null,
      draftPayload: null,
    });
    mockApi.createProjectConfirmation.mockResolvedValue(created);
    mockApi.confirmationTemplateLibrary.mockResolvedValue([]);
    renderPanel();

    fireEvent.click(
      await screen.findByRole("button", { name: "New confirmation" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Create confirmation" })
    );
    fireEvent.click(await screen.findByLabelText("Confirmation template"));
    expect(
      screen.queryByText("PRC bank confirmation - Template 1")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("PRC bank confirmation - Template 2")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("ShineWing English bank confirmation")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", {
        name: /Bank Confirmation - HK Standard \(English\)/,
      })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Standard financial institution confirmation template")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Securities Confirmation - English - Type 1")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Securities Confirmation - English - Type 2")
    ).not.toBeInTheDocument();

    await waitFor(() =>
      expect(mockApi.createProjectConfirmation).toHaveBeenCalledWith(
        "project-1",
        {
          draftPayload: {},
          type: "BANK",
        }
      )
    );
    const payload = mockApi.createProjectConfirmation.mock.calls[0]?.[1];
    expect(payload).not.toHaveProperty("confirmationCode");
    expect(payload).not.toHaveProperty("counterpartyName");
    expect(mockApi.createProjectConfirmation).toHaveBeenCalledOnce();
    expect(
      vi.mocked(mockApi.updateProjectConfirmationDraft)
    ).toHaveBeenCalledTimes(0);
  });

  it("does not offer a retired securities template to an existing draft", async () => {
    mockApi.confirmationTemplateLibrary.mockResolvedValue([]);
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({
        type: "INTERMEDIARY",
        draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
        draftPayload: {
          clientName: "Example Client",
          recipientAddress: "Manual broker address",
          recipientName: "Example Broker",
          confirmationInformationLibraryEntryId: "hk-bank-012",
          bankName: "中国银行（香港）有限公司",
          counterpartyAddress: "3/F, Bank of China Centre",
          counterpartyAttention: "Bank confirmation",
          counterpartyContact: "Confirmation desk",
        },
      }),
    ]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.click(await screen.findByLabelText("Confirmation template"));
    const securitiesOption = screen
      .getAllByRole("option")
      .find(
        (option) =>
          option.dataset.templateCode ===
          "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1"
      );
    expect(securitiesOption).toBeUndefined();
    expect(
      vi.mocked(mockApi.updateProjectConfirmationDraft)
    ).toHaveBeenCalledTimes(0);
  });

  it("submits with the current draft timestamp and a generated UUID", async () => {
    const draft = confirmation();
    mockApi.projectConfirmations.mockResolvedValue([draft]);
    mockApi.submitProjectConfirmation.mockResolvedValue(
      confirmation({ status: "PREPARED" })
    );
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.click(
      await screen.findByRole("button", { name: "Freeze confirmation" })
    );

    await waitFor(() =>
      expect(mockApi.submitProjectConfirmation).toHaveBeenCalledWith(
        "project-1",
        "confirmation-1",
        expect.objectContaining({
          expectedDraftUpdatedAt: "2026-07-12T08:00:00.000Z",
          idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
        })
      )
    );
    expect(screen.getByRole("tab", { name: "Confirmation" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("saves structured standard fields while preserving explicit general fields", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({
        draftPayload: {
          bankName: "HSBC Hong Kong",
          clientCode: "legacy-client-code",
          clientName: "legacy-client-name",
        },
      }),
    ]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.change(await screen.findByLabelText("Office Date"), {
      target: { value: "2026-07-12" },
    });
    fireEvent.blur(screen.getByLabelText("Office Date"));

    await waitFor(() =>
      expect(mockApi.updateProjectConfirmationDraft).toHaveBeenCalledWith(
        "project-1",
        "confirmation-1",
        expect.objectContaining({
          patchSource: "MANUAL",
          draftPayload: expect.objectContaining({
            bankName: "HSBC Hong Kong",
            officeDate: "2026-07-12",
          }),
        })
      )
    );
    const payload =
      mockApi.updateProjectConfirmationDraft.mock.calls[0]?.[2]?.draftPayload;
    expect(payload).not.toHaveProperty("clientCode");
    expect(payload).toHaveProperty("clientName", "legacy-client-name");
  });

  it("keeps the editor dirty after a failed draft save and clears it after retry", async () => {
    const user = userEvent.setup();
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
      ],
    } as const;
    let currentConfirmation = confirmation({
      draftTemplateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
      draftPayload: {
        templateDesignSchema: designSchema,
        templateFieldValues: { "dynamic-reference": "Saved reference" },
      } as never,
    });
    mockApi.projectConfirmations.mockResolvedValue([currentConfirmation]);
    mockApi.updateProjectConfirmationDraft
      .mockRejectedValueOnce(new Error("save failed"))
      .mockImplementationOnce(
        (
          _projectId: string,
          _confirmationId: string,
          input: {
            draftPayload: ProjectConfirmation["draftPayload"];
            draftTemplateCode: ProjectConfirmation["draftTemplateCode"];
          }
        ) =>
          Promise.resolve().then(() => {
            currentConfirmation = confirmation({
              ...currentConfirmation,
              draftPayload: input.draftPayload,
              draftTemplateCode: input.draftTemplateCode,
              draftUpdatedAt: "2026-07-12T08:01:00.000Z",
              updatedAt: "2026-07-12T08:01:00.000Z",
            });
            return currentConfirmation;
          })
      );
    renderPanel();

    await user.click(await screen.findByText("HSBC Hong Kong"));
    const dynamicReference = await screen.findByLabelText("Dynamic Reference");
    fireEvent.change(dynamicReference, {
      target: { value: "Edited reference" },
    });
    fireEvent.blur(dynamicReference);

    const freezeButton = screen.getByRole("button", {
      name: "Freeze confirmation",
    });
    expect(freezeButton).toBeDisabled();

    await waitFor(() =>
      expect(mockApi.updateProjectConfirmationDraft).toHaveBeenCalledOnce()
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("confirmation-auto-save-status")
      ).toHaveTextContent("Retry Save")
    );
    expect(dynamicReference).toHaveValue("Edited reference");
    expect(freezeButton).toBeDisabled();

    fireEvent.change(dynamicReference, {
      target: { value: "Edited reference after retry" },
    });
    fireEvent.blur(dynamicReference);
    await waitFor(() =>
      expect(mockApi.updateProjectConfirmationDraft).toHaveBeenCalledTimes(2)
    );
    await waitFor(() => {
      expect(
        screen.getByTestId("confirmation-auto-save-status")
      ).toHaveTextContent("Saved");
      expect(freezeButton).toBeEnabled();
    });
  });

  it("keeps frozen items in confirmation and allows an unclaimed withdrawal", async () => {
    const prepared = confirmation({
      status: "PREPARED",
      queuedAt: "2026-07-12T09:00:00.000Z",
      currentArtifact: {
        id: "artifact-1",
        confirmationId: "confirmation-1",
        version: 1,
        disposition: "ACTIVE",
        templateCode: "PRC_BANK_TEMPLATE_1",
        templateVersion: "1",
        docxSize: 10,
        pdfSize: 10,
        pdfSha256: "abcdef0123456789",
        submittedBy: "user-1",
        submittedAt: "2026-07-12T09:00:00.000Z",
      },
    });
    mockApi.projectConfirmations.mockResolvedValue([prepared]);
    mockApi.withdrawProjectConfirmation.mockResolvedValue(confirmation());
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    await expect(
      screen.findByRole("tab", { name: "Confirmation" })
    ).resolves.toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    fireEvent.change(screen.getByLabelText("Withdrawal reason"), {
      target: { value: "Recipient correction" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm withdrawal" }));

    await waitFor(() =>
      expect(mockApi.withdrawProjectConfirmation).toHaveBeenCalledWith(
        "project-1",
        "confirmation-1",
        expect.objectContaining({
          reason: "Recipient correction",
          idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
        })
      )
    );
  });

  it("opens routed responses in review", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({
        status: "AWAITING_RESPONSE",
        responses: [
          {
            id: "response-1",
            confirmationId: "confirmation-1",
            responseStatus: "RECEIVED",
            routingStatus: "ROUTED",
            createdAt: "2026-07-12T10:00:00.000Z",
            updatedAt: "2026-07-12T10:00:00.000Z",
          },
        ],
      }),
    ]);
    renderPanel();
    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    await expect(
      screen.findByRole("tab", { name: "Review" })
    ).resolves.toHaveAttribute("aria-selected", "true");
  });

  it("keeps response resolution controls inside the compact review toolbar", async () => {
    mockApi.projectConfirmations.mockResolvedValue([receivedConfirmation()]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    const toolbar = await screen.findByTestId("confirmation-detail-toolbar");

    expect(
      within(toolbar).getByRole("button", { name: "Response matches" })
    ).toBeVisible();
    expect(
      within(toolbar).getByRole("button", {
        name: "Response does not match",
      })
    ).toBeVisible();
  });

  it("keeps the response review header dense so the preview owns the remaining height", async () => {
    mockApi.projectConfirmations.mockResolvedValue([receivedConfirmation()]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    const header = await screen.findByTestId("confirmation-review-header");
    expect(header).toHaveClass("py-2");
    expect(within(header).getByText("bank-response.pdf")).toBeVisible();
    expect(within(header).queryByText(/Paper/)).not.toBeInTheDocument();
    expect(
      within(header).getByRole("button", { name: "Response matches" })
    ).toBeVisible();
  });

  it("passes a matched review through the panel and reflects the CLOSED result", async () => {
    const received = receivedConfirmation({ status: "RESPONSE_RECEIVED" });
    const closed = receivedConfirmation({
      ...received,
      status: "CLOSED",
      differenceStatus: "MATCHED",
    });
    mockApi.projectConfirmations
      .mockResolvedValueOnce([received])
      .mockResolvedValue([closed]);
    mockApi.reviewProjectConfirmationResponse.mockResolvedValue(closed);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.click(
      await screen.findByRole("button", { name: "Response matches" })
    );

    await waitFor(() =>
      expect(mockApi.reviewProjectConfirmationResponse).toHaveBeenCalledWith(
        "project-1",
        "confirmation-1",
        { result: "MATCHED" }
      )
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Response matches" })
      ).not.toBeInTheDocument()
    );
    const completion = await screen.findByTestId(
      "confirmation-review-completion"
    );
    expect(completion).toHaveAttribute("role", "status");
    expect(completion).toHaveAttribute("aria-live", "polite");
    expect(completion).toHaveTextContent("Program completed");
    expect(completion).toHaveTextContent("Closed");
  });

  it("offers review rollback for a matched conclusion and confirms the mutation", async () => {
    const reviewed = receivedConfirmation({
      status: "CLOSED",
      differenceStatus: "MATCHED",
      followUpEvents: [
        {
          id: "review-event-1",
          confirmationId: "confirmation-1",
          eventType: "REVIEW_RECORDED",
          actorId: "user-1",
          source: "PROJECT_TEAM_MANUAL",
          payload: {
            responseId: "response-1",
            previous: {
              status: "RESPONSE_RECEIVED",
              differenceStatus: null,
              notes: null,
            },
            next: {
              status: "CLOSED",
              differenceStatus: "MATCHED",
              notes: null,
            },
          },
          occurredAt: "2026-07-17T09:00:00.000Z",
          createdAt: "2026-07-17T09:00:00.000Z",
        },
      ],
    });
    const unreviewed = receivedConfirmation();
    mockApi.projectConfirmations.mockResolvedValue([reviewed]);
    mockApi.undoProjectConfirmationReview.mockResolvedValue(unreviewed);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.click(
      await screen.findByRole("button", { name: "Undo review conclusion" })
    );

    await expect(
      screen.findByText("Undo this review conclusion?")
    ).resolves.toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Undo review" }));

    await waitFor(() =>
      expect(mockApi.undoProjectConfirmationReview).toHaveBeenCalledWith(
        "project-1",
        "confirmation-1"
      )
    );
  });

  it("wires alternative procedure completion after the mismatch decision", async () => {
    const received = receivedConfirmation({ status: "RESPONSE_RECEIVED" });
    const pendingAlternative = receivedConfirmation({
      ...received,
      status: "RESPONSE_RECEIVED",
      differenceStatus: "PENDING_FOLLOW_UP",
    });
    const closed = receivedConfirmation({
      ...pendingAlternative,
      status: "CLOSED",
    });
    mockApi.projectConfirmations
      .mockResolvedValueOnce([received])
      .mockResolvedValue([pendingAlternative]);
    mockApi.reviewProjectConfirmationResponse.mockResolvedValue(
      pendingAlternative
    );
    mockApi.completeProjectConfirmationProgram.mockResolvedValue(closed);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.click(
      await screen.findByRole("button", { name: "Response does not match" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Alternative procedure" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() =>
      expect(mockApi.reviewProjectConfirmationResponse).toHaveBeenCalledWith(
        "project-1",
        "confirmation-1",
        expect.objectContaining({
          result: "MISMATCHED",
          action: "ALTERNATIVE_PROCEDURE",
        })
      )
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Complete alternative procedure",
      })
    );
    await waitFor(() =>
      expect(mockApi.completeProjectConfirmationProgram).toHaveBeenCalledWith(
        "project-1",
        "confirmation-1"
      )
    );
  });

  it("returns to the confirmation editor after saving a redispatch decision", async () => {
    const routed = {
      id: "response-1",
      confirmationId: "confirmation-1",
      responseStatus: "RECEIVED" as const,
      routingStatus: "ROUTED" as const,
      createdAt: "2026-07-12T10:00:00.000Z",
      updatedAt: "2026-07-12T10:00:00.000Z",
    };
    const received = confirmation({
      status: "RESPONSE_RECEIVED",
      responses: [routed],
    });
    const awaitingSecondResponse = confirmation({
      ...received,
      status: "DRAFT",
      differenceStatus: "EXCEPTION",
      submissionVersion: 1,
      currentArtifactId: "uploaded-artifact-1",
      attachment: {
        originalFileName: "previous-confirmation.pdf",
        originalMimeType: "application/pdf",
        previewability: "INLINE",
        downloadUrl:
          "/projects/project-1/confirmations/confirmation-1/attachment/download",
        previewUrl:
          "/projects/project-1/confirmations/confirmation-1/preview.pdf",
      },
      currentArtifact: {
        id: "uploaded-artifact-1",
        confirmationId: "confirmation-1",
        version: 1,
        disposition: "ACTIVE",
        templateCode: "UPLOADED_DOCUMENT",
        templateVersion: "1",
        docxSize: 15,
        pdfSize: 15,
        pdfSha256: "abcdef0123456789",
        submittedBy: "user-1",
        submittedAt: "2026-07-12T09:00:00.000Z",
      },
      dispatches: [
        {
          id: "dispatch-1",
          confirmationId: "confirmation-1",
          sequence: 1,
          method: "COURIER",
          sentAt: "2026-07-13T10:00:00.000Z",
          createdBy: "user-1",
          createdAt: "2026-07-13T10:00:00.000Z",
        },
      ],
      followUpEvents: [
        {
          id: "redispatch-request-1",
          confirmationId: "confirmation-1",
          eventType: "REDISPATCH_REQUESTED",
          actorId: "user-1",
          source: "PROJECT_TEAM_MANUAL",
          occurredAt: "2026-07-13T11:00:00.000Z",
          createdAt: "2026-07-13T11:00:00.000Z",
        },
      ],
    });
    mockApi.projectConfirmations
      .mockResolvedValueOnce([received])
      .mockResolvedValue([awaitingSecondResponse]);
    mockApi.reviewProjectConfirmationResponse.mockResolvedValue(
      awaitingSecondResponse
    );
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.click(
      await screen.findByRole("button", { name: "Response does not match" })
    );
    fireEvent.click(screen.getByRole("button", { name: /Redispatch/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() =>
      expect(mockApi.reviewProjectConfirmationResponse).toHaveBeenCalledWith(
        "project-1",
        "confirmation-1",
        expect.objectContaining({
          result: "MISMATCHED",
          action: "REDISPATCH",
        })
      )
    );
    expect(screen.getByRole("tab", { name: "Confirmation" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(
      screen.findByTestId("confirmation-redispatch-draft-indicator")
    ).resolves.toHaveTextContent("Redispatch confirmation #2");
    expect(screen.getByTestId("confirmation-draft-document")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Upload confirmation file" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete file" })).toBeVisible();
  });

  it("shows the confirmation identity once and inherits its type color", async () => {
    const reviewed = confirmation({
      confirmationCode: "HBR-2026-001",
      displayName: "New confirmation",
      status: "RESPONSE_RECEIVED",
      responses: [
        {
          id: "response-1",
          confirmationId: "confirmation-1",
          responseStatus: "RECEIVED",
          routingStatus: "ROUTED",
          createdAt: "2026-07-12T10:00:00.000Z",
          updatedAt: "2026-07-12T10:00:00.000Z",
          artifacts: [
            {
              id: "artifact-1",
              responseId: "response-1",
              sequence: 1,
              fileName: "response-1.pdf",
              mimeType: "application/pdf",
              fileSize: 10,
              sha256: "sha-1",
              uploadedBy: "user-1",
              capturedAt: "2026-07-12T10:00:00.000Z",
              createdAt: "2026-07-12T10:00:00.000Z",
            },
            {
              id: "artifact-2",
              responseId: "response-1",
              sequence: 2,
              fileName: "response-2.pdf",
              mimeType: "application/pdf",
              fileSize: 10,
              sha256: "sha-2",
              uploadedBy: "user-1",
              capturedAt: "2026-07-12T10:00:00.000Z",
              createdAt: "2026-07-12T10:00:00.000Z",
            },
          ],
        },
      ],
    });
    mockApi.projectConfirmations.mockResolvedValue([reviewed]);
    renderPanel();

    fireEvent.click(await screen.findByText("HBR-2026-001"));
    const toolbar = await screen.findByTestId("confirmation-detail-toolbar");
    expect(within(toolbar).getAllByText("HBR-2026-001")).toHaveLength(1);
    expect(
      within(toolbar).queryByText("New confirmation")
    ).not.toBeInTheDocument();
    expect(
      within(toolbar).queryByTestId("confirmation-review-identity")
    ).not.toBeInTheDocument();
    expect(within(toolbar).getByText("Bank")).toHaveAttribute(
      "data-category-tone",
      "financial"
    );
    expect(
      within(toolbar).getByTestId("confirmation-response-file-picker-trigger")
    ).toHaveAttribute("data-category-tone", "financial");
  });

  it("keeps many response files in one searchable picker", async () => {
    const reviewed = confirmation({
      confirmationCode: "HBR-2026-001",
      status: "RESPONSE_RECEIVED",
      responses: [
        {
          id: "response-1",
          confirmationId: "confirmation-1",
          responseStatus: "RECEIVED",
          responseChannel: "PAPER",
          routingStatus: "ROUTED",
          receivedAt: "2026-07-12T10:00:00.000Z",
          createdAt: "2026-07-12T10:00:00.000Z",
          updatedAt: "2026-07-12T10:00:00.000Z",
          artifacts: [
            {
              id: "artifact-1",
              responseId: "response-1",
              sequence: 1,
              fileName: "duplicate-response.pdf",
              mimeType: "application/pdf",
              fileSize: 10,
              sha256: "sha-1",
              uploadedBy: "user-1",
              capturedAt: "2026-07-12T10:00:00.000Z",
              createdAt: "2026-07-12T10:00:00.000Z",
            },
            {
              id: "artifact-2",
              responseId: "response-1",
              sequence: 2,
              fileName: "duplicate-response.pdf",
              mimeType: "application/pdf",
              fileSize: 20,
              sha256: "sha-2",
              uploadedBy: "user-1",
              capturedAt: "2026-07-12T10:00:00.000Z",
              createdAt: "2026-07-12T10:00:00.000Z",
            },
            {
              id: "artifact-3",
              responseId: "response-1",
              sequence: 3,
              fileName: "third-evidence.pdf",
              mimeType: "application/pdf",
              fileSize: 30,
              sha256: "sha-3",
              uploadedBy: "user-1",
              capturedAt: "2026-07-12T10:00:00.000Z",
              createdAt: "2026-07-12T10:00:00.000Z",
            },
          ],
        },
      ],
    });
    mockApi.projectConfirmations.mockResolvedValue([reviewed]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    const header = await screen.findByTestId("confirmation-review-header");
    const trigger = within(header).getByTestId(
      "confirmation-response-file-picker-trigger"
    );
    expect(trigger).toHaveTextContent("1/3");
    expect(trigger).toHaveTextContent("duplicate-response.pdf");
    expect(within(header).getAllByText("duplicate-response.pdf")).toHaveLength(
      1
    );
    expect(
      within(header).queryByRole("button", { name: /third-evidence\.pdf/ })
    ).not.toBeInTheDocument();

    fireEvent.click(trigger);
    const picker = await screen.findByTestId(
      "confirmation-response-file-picker-content"
    );
    const search = within(picker).getByRole("textbox", {
      name: "Search response files",
    });
    fireEvent.change(search, { target: { value: "duplicate" } });
    const duplicateOptions = within(picker).getAllByRole("option", {
      name: /duplicate-response\.pdf/,
    });
    expect(duplicateOptions).toHaveLength(2);
    expect(duplicateOptions[0]).toHaveTextContent("1");
    expect(duplicateOptions[0]).toHaveTextContent("10 B");
    expect(duplicateOptions[1]).toHaveTextContent("2");
    expect(duplicateOptions[1]).toHaveTextContent("20 B");

    fireEvent.change(search, { target: { value: "third" } });
    fireEvent.click(
      within(picker).getByRole("option", { name: /third-evidence\.pdf/ })
    );

    await waitFor(() => {
      expect(trigger).toHaveTextContent("3/3");
      expect(trigger).toHaveTextContent("third-evidence.pdf");
    });
    expect(mockApi.projectConfirmationResponseArtifact).toHaveBeenCalledWith(
      "project-1",
      "confirmation-1",
      "response-1",
      "artifact-3"
    );
  });

  it("opens a project-scoped EMP import for a completed confirmation", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      receivedConfirmation({
        status: "CLOSED",
        differenceStatus: "MATCHED",
      }),
    ]);
    mockApi.confirmationEmpPreview.mockResolvedValue({
      projectId: "project-1",
      mode: "FLAT",
      targetDirectoryId: "workflow-planning",
      fingerprint: "scoped-preview",
      blockers: [],
      targetDirectories: [
        {
          id: "workflow-planning",
          code: "A1",
          title: "Planning",
          path: "Planning",
          level: 1,
          canAcceptWorkflow: true,
        },
      ],
      counts: { eligible: 1, imported: 0, blocked: 0 },
      items: [],
      batchDirectory: null,
      zipWorkingPaper: null,
    });
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Archive to project",
      })
    );
    await expect(
      screen.findAllByRole("heading", {
        name: "Archive to project",
      })
    ).resolves.not.toHaveLength(0);
    expect(screen.getByRole("dialog")).toHaveClass(
      "sm:max-w-[min(72rem,calc(100vw-3rem))]",
      "sm:h-[min(42rem,calc(100vh-3rem))]"
    );
    expect(screen.queryByText("Eligible project")).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Archive every completed response for this confirmation into the project's EMP directory. The outgoing confirmation is excluded."
      )
    ).not.toBeInTheDocument();

    await waitFor(() =>
      expect(mockApi.confirmationEmpPreview).toHaveBeenCalledWith(
        "project-1",
        expect.objectContaining({
          confirmationId: "confirmation-1",
          mode: "FLAT",
          targetDirectoryId: "workflow-planning",
        })
      )
    );
  });

  it("keeps the unmatched project warehouse in the return-to-center workflow", async () => {
    mockApi.projectConfirmationResponseWarehouse.mockResolvedValue([
      {
        id: "response-library-1",
        code: "CRSP-001",
        title: "Reviewed response",
        receivedAt: "2026-07-17T08:30:00.000Z",
        clientName: "Example Client",
        respondingEntity: "HSBC Hong Kong",
        fileName: "bank-response.pdf",
        fileSize: 18,
        mimeType: "application/pdf",
        uploadedById: "user-1",
        uploader: { id: "user-1", name: "Bonnie Su" },
        projectId: "project-1",
        confirmationId: "confirmation-1",
        routingStatus: "PENDING_MATCH",
        confirmation: {
          id: "confirmation-1",
          confirmationCode: "AUD-2026-0001-YH-001",
          counterpartyName: "HSBC Hong Kong",
          displayName: "HSBC Hong Kong",
          type: "BANK",
          status: "CLOSED",
          differenceStatus: "MATCHED",
        },
        createdAt: "2026-07-17T08:30:00.000Z",
        updatedAt: "2026-07-17T08:30:00.000Z",
      },
    ]);
    renderPanel();
    fireEvent.click(
      screen.getByRole("button", { name: /Unmatched responses/ })
    );
    await screen.findByText("Reviewed response");
    expect(
      screen.queryByRole("button", { name: "Archive to project" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Batch return" })
    ).toBeInTheDocument();
    expect(mockApi.confirmationEmpPreview).toHaveBeenCalledTimes(0);
  });

  it("renders only the unmatched response warehouse in the project area", async () => {
    mockApi.projectConfirmationResponseWarehouse.mockResolvedValue([
      {
        id: "response-pending-1",
        code: "CRSP-PENDING-1",
        title: "Unmatched response file",
        receivedAt: "2026-08-18T08:30:00.000Z",
        clientName: "Example Client",
        respondingEntity: "HSBC Hong Kong",
        fileName: "unmatched-response.pdf",
        fileSize: 18,
        mimeType: "application/pdf",
        uploadedById: "user-1",
        uploader: { id: "user-1", name: "Bonnie Su" },
        projectId: "project-1",
        confirmationId: null,
        provisionalType: "BANK",
        routingStatus: "PENDING_MATCH",
        createdAt: "2026-08-18T08:30:00.000Z",
        updatedAt: "2026-08-18T08:30:00.000Z",
      },
    ]);
    renderPanel();

    const unmatchedResponses = await screen.findByRole("button", {
      name: /Unmatched responses/,
    });
    fireEvent.click(unmatchedResponses);

    expect(unmatchedResponses).toHaveClass("bg-rose-100");
    const awaitedFixture4 = await screen.findAllByRole("heading", {
      name: "Unmatched responses",
    });
    expect(awaitedFixture4.at(-1)).toBeVisible();
    expect(
      screen.queryByTestId("pending-confirmation-responses-data-grid")
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Received date range")).not.toBeInTheDocument();
    await expect(
      screen.findByText("Unmatched response file")
    ).resolves.toBeVisible();
    expect(
      screen.getByRole("button", { name: "Continue matching" })
    ).toBeVisible();
  });

  it("creates and opens a review-ready confirmation for a response without an outgoing request", async () => {
    const pendingResponse = {
      id: "response-no-source-1",
      code: "CRSP-NO-SOURCE-1",
      title: "No-source response file",
      receivedAt: "2026-08-18T08:30:00.000Z",
      clientName: "Example Client",
      respondingEntity: "HSBC Hong Kong",
      fileName: "no-source-response.pdf",
      fileSize: 18,
      mimeType: "application/pdf",
      uploadedById: "user-1",
      uploader: { id: "user-1", name: "Bonnie Su" },
      projectId: "project-1",
      confirmationId: null,
      provisionalType: "BANK",
      routingStatus: "PENDING_MATCH",
      createdAt: "2026-08-18T08:30:00.000Z",
      updatedAt: "2026-08-18T08:30:00.000Z",
    };
    const created = confirmation({
      id: "confirmation-no-source-1",
      status: "RESPONSE_RECEIVED",
      confirmationCode: "AUD-2026-NOSOURCE-001",
      responses: [
        {
          id: "response-no-source-recorded",
          confirmationId: "confirmation-no-source-1",
          responseStatus: "RECEIVED",
          responseChannel: "OTHER",
          matchMethod: "MANUAL",
          routingStatus: "ROUTED",
          receivedAt: "2026-08-18T08:30:00.000Z",
          createdAt: "2026-08-18T08:30:00.000Z",
          updatedAt: "2026-08-18T08:30:00.000Z",
          artifacts: [],
        },
      ],
    });
    mockApi.projectConfirmationResponseWarehouse.mockResolvedValue([
      pendingResponse,
    ]);
    mockApi.projectConfirmations.mockResolvedValue([created]);
    mockApi.routeConfirmationResponseLibraryFile.mockResolvedValueOnce({
      ...pendingResponse,
      confirmationId: created.id,
      routingStatus: "MATCHED",
    });

    renderPanel();
    fireEvent.click(
      await screen.findByRole("button", { name: /Unmatched responses/ })
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Continue matching" })
    );
    fireEvent.click(await screen.findByText("No outgoing request"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));

    await waitFor(() =>
      expect(mockApi.routeConfirmationResponseLibraryFile).toHaveBeenCalledWith(
        pendingResponse.id,
        expect.objectContaining({
          action: "NO_SOURCE_REQUEST",
          projectId: "project-1",
          provisionalType: "BANK",
        })
      )
    );
    expect(
      new URL(window.location.href).searchParams.get("confirmationId")
    ).toBe(created.id);
    await expect(
      screen.findByRole("tab", { name: "Review" })
    ).resolves.toHaveAttribute("aria-selected", "true");
  }, 30_000);

  it("opens a matched project response in review after routing it to an outgoing confirmation", async () => {
    const candidate = confirmation({
      id: "confirmation-match-1",
      status: "AWAITING_RESPONSE",
      differenceStatus: null,
      dispatches: [
        {
          id: "dispatch-match-1",
          confirmationId: "confirmation-match-1",
          sequence: 1,
          method: "COURIER",
          sentAt: "2026-08-17T08:00:00.000Z",
          createdBy: "user-1",
          createdAt: "2026-08-17T08:00:00.000Z",
        },
      ],
    });
    const matched = receivedConfirmation({
      id: "confirmation-match-1",
      confirmationCode: candidate.confirmationCode,
    });
    const pendingResponse = {
      id: "response-match-1",
      code: "CRSP-MATCH-1",
      title: "Matched response file",
      receivedAt: "2026-08-18T08:30:00.000Z",
      clientName: "Example Client",
      respondingEntity: "HSBC Hong Kong",
      fileName: "matched-response.pdf",
      fileSize: 18,
      mimeType: "application/pdf",
      uploadedById: "user-1",
      uploader: { id: "user-1", name: "Bonnie Su" },
      projectId: "project-1",
      confirmationId: null,
      provisionalType: "BANK",
      routingStatus: "PENDING_MATCH",
      createdAt: "2026-08-18T08:30:00.000Z",
      updatedAt: "2026-08-18T08:30:00.000Z",
    };
    let routed = false;
    mockApi.projectConfirmations.mockResolvedValue(
      routed ? [matched] : [candidate]
    );
    mockApi.projectConfirmationResponseWarehouse.mockResolvedValue([
      pendingResponse,
    ]);
    mockApi.routeConfirmationResponseLibraryFile.mockImplementation(() =>
      Promise.resolve().then(() => {
        routed = true;
        return {
          ...pendingResponse,
          confirmationId: candidate.id,
          routingStatus: "MATCHED",
        };
      })
    );

    renderPanel();
    fireEvent.click(
      await screen.findByRole("button", { name: /Unmatched responses/ })
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Continue matching" })
    );
    fireEvent.click(await screen.findByText("Match an outgoing confirmation"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const routingSheet = await screen.findByRole("dialog");
    fireEvent.click(within(routingSheet).getByText("HSBC Hong Kong"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() =>
      expect(mockApi.routeConfirmationResponseLibraryFile).toHaveBeenCalledWith(
        pendingResponse.id,
        {
          action: "MATCH_CONFIRMATION",
          projectId: "project-1",
          confirmationId: candidate.id,
        }
      )
    );
    await expect(
      screen.findByRole("tab", { name: "Review" })
    ).resolves.toHaveAttribute("aria-selected", "true");
  }, 30_000);

  it("returns a project-claimed response to the confirmation center", async () => {
    const pendingResponse = {
      id: "response-claimed-1",
      code: "CRSP-CLAIMED-1",
      title: "Claimed response file",
      receivedAt: "2026-08-18T08:30:00.000Z",
      clientName: "Example Client",
      respondingEntity: "HSBC Hong Kong",
      fileName: "claimed-response.pdf",
      fileSize: 18,
      mimeType: "application/pdf",
      uploadedById: "user-1",
      uploader: { id: "user-1", name: "Bonnie Su" },
      projectId: "project-1",
      confirmationId: null,
      provisionalType: "BANK",
      routingStatus: "PENDING_MATCH",
      createdAt: "2026-08-18T08:30:00.000Z",
      updatedAt: "2026-08-18T08:30:00.000Z",
    };
    mockApi.projectConfirmationResponseWarehouse.mockResolvedValue([
      pendingResponse,
    ]);
    mockApi.routeConfirmationResponseLibraryFile.mockResolvedValue({
      ...pendingResponse,
      projectId: null,
      routingStatus: "UNASSIGNED_PROJECT",
    });

    renderPanel();
    fireEvent.click(
      await screen.findByRole("button", { name: /Unmatched responses/ })
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Return to confirmation center",
      })
    );

    await waitFor(() =>
      expect(mockApi.routeConfirmationResponseLibraryFile).toHaveBeenCalledWith(
        pendingResponse.id,
        { action: "UNASSIGN_PROJECT" }
      )
    );
  }, 30_000);

  it("hides project EMP import from the response warehouse in read-only mode", async () => {
    mockApi.projectConfirmationResponseWarehouse.mockResolvedValue([
      {
        id: "response-library-read-only",
        code: "CRSP-READ-ONLY",
        title: "Reviewed response",
        receivedAt: "2026-07-17T08:30:00.000Z",
        clientName: "Example Client",
        respondingEntity: "HSBC Hong Kong",
        fileName: "bank-response.pdf",
        fileSize: 18,
        mimeType: "application/pdf",
        uploadedById: "user-1",
        uploader: { id: "user-1", name: "Bonnie Su" },
        projectId: "project-1",
        confirmationId: "confirmation-1",
        routingStatus: "PENDING_MATCH",
        confirmation: {
          id: "confirmation-1",
          confirmationCode: "AUD-2026-0001-YH-001",
          counterpartyName: "HSBC Hong Kong",
          displayName: "HSBC Hong Kong",
          type: "BANK",
          status: "CLOSED",
          differenceStatus: "MATCHED",
        },
        createdAt: "2026-07-17T08:30:00.000Z",
        updatedAt: "2026-07-17T08:30:00.000Z",
      },
    ]);
    renderPanel({ readOnly: true });

    fireEvent.click(
      screen.getByRole("button", { name: /Unmatched responses/ })
    );

    await expect(screen.findByText("Reviewed response")).resolves.toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Archive to project" })
    ).not.toBeInTheDocument();
  });

  it("does not offer project archiving until a closed confirmation is matched", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      receivedConfirmation({
        status: "CLOSED",
        differenceStatus: "PENDING_FOLLOW_UP",
      }),
    ]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));

    expect(
      screen.queryByRole("button", { name: "Archive to project" })
    ).not.toBeInTheDocument();
  });

  it("does not open an unrouted response in review", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({
        status: "AWAITING_RESPONSE",
        responses: [
          {
            id: "response-pending",
            confirmationId: "confirmation-1",
            responseStatus: "RECEIVED",
            routingStatus: "PENDING",
            createdAt: "2026-07-12T10:00:00.000Z",
            updatedAt: "2026-07-12T10:00:00.000Z",
          },
        ],
      }),
    ]);
    renderPanel();
    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    await expect(
      screen.findByRole("tab", { name: "Tracking" })
    ).resolves.toHaveAttribute("aria-selected", "true");
  });

  it("does not preview fallback project identity or reporting date as authoritative", async () => {
    mockApi.projectConfirmations.mockResolvedValue([confirmation()]);
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <ProjectConfirmationsPanel
            projectId="project-1"
            project={{
              id: "project-1",
              workspaceId: "workspace-1",
              name: "Fallback project",
              projectCode: "PROJECT-FALLBACK",
              reportingDate: "2026-12-31T00:00:00.000Z",
              status: "ACTIVE",
            }}
            currentUser={null}
            members={[]}
            commonCopy={{ cancel: "Cancel" } as never}
            locale="en-US"
          />
        </ToastProvider>
      </QueryClientProvider>
    );

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    const paper = await screen.findByTestId("confirmation-draft-document");
    const reportDate = await within(paper).findByLabelText("Report date");
    expect(
      within(paper).queryByText("PROJECT-FALLBACK")
    ).not.toBeInTheDocument();
    expect(
      within(paper).queryByText("Entity fallback")
    ).not.toBeInTheDocument();
    expect(reportDate).toHaveValue("");
  });

  it("shows localized validation errors by API error code", async () => {
    mockApi.projectConfirmations.mockResolvedValue([confirmation()]);
    mockApi.submitProjectConfirmation.mockRejectedValue(
      new ApiError("CMP_CLIENT_REQUIRED", "CMP client is required", "request-1")
    );
    renderPanel();
    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.click(
      await screen.findByRole("button", { name: "Freeze confirmation" })
    );
    await expect(
      screen.findByText("The project is not linked to a CMP client.")
    ).resolves.toBeVisible();
    expect(
      screen.queryByText("CMP client is required")
    ).not.toBeInTheDocument();
  });

  it("separates received responses from the manual review stage", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      receivedConfirmation({
        dispatches: [
          {
            id: "dispatch-1",
            confirmationId: "confirmation-1",
            sequence: 1,
            method: "COURIER",
            sentAt: "2026-07-12T09:00:00.000Z",
            createdBy: "officer-1",
            createdAt: "2026-07-12T09:00:00.000Z",
          },
        ],
      }),
    ]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.click(await screen.findByRole("tab", { name: "Tracking" }));

    expect(screen.getByText("Response follow-up")).toBeVisible();
    expect(screen.getByText("Manual review")).toBeVisible();
    expect(screen.getByText("Awaiting manual review")).toBeVisible();
    expect(
      screen.getByText("Response received; awaiting manual review")
    ).toBeVisible();
  });

  it("shows a pending redispatch as the current workflow stage", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({
        status: "AWAITING_RESPONSE",
        differenceStatus: "EXCEPTION",
        dispatches: [
          {
            id: "dispatch-1",
            confirmationId: "confirmation-1",
            sequence: 1,
            method: "COURIER",
            sentAt: "2026-07-12T09:00:00.000Z",
            createdBy: "officer-1",
            createdAt: "2026-07-12T09:00:00.000Z",
          },
        ],
        followUpEvents: [
          {
            id: "redispatch-request-1",
            confirmationId: "confirmation-1",
            eventType: "REDISPATCH_REQUESTED",
            actorId: "reviewer-1",
            source: "PROJECT_TEAM_MANUAL",
            occurredAt: "2026-07-13T09:00:00.000Z",
            createdAt: "2026-07-13T09:00:00.000Z",
          },
        ],
      }),
    ]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.click(await screen.findByRole("tab", { name: "Tracking" }));

    expect(screen.getByText("Redispatch confirmation #2")).toBeVisible();
    expect(screen.getAllByText("Awaiting redispatch")[0]).toBeVisible();
    const followUpHeading = screen.getByRole("heading", {
      name: "Response follow-up",
    });
    const manualReviewHeading = screen.getByRole("heading", {
      name: "Manual review",
    });
    expect(followUpHeading.parentElement).toHaveTextContent("Not completed");
    expect(manualReviewHeading.parentElement).toHaveTextContent(
      "Not completed"
    );
  });

  it("does not offer dispatch after the latest redispatch request was already sent", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({
        status: "PREPARED",
        differenceStatus: "EXCEPTION",
        currentArtifactId: "artifact-2",
        currentArtifact: {
          id: "artifact-2",
          confirmationId: "confirmation-1",
          version: 2,
          disposition: "ACTIVE",
          templateCode: "UPLOADED_DOCUMENT",
          templateVersion: "1",
          docxSize: 15,
          pdfSize: 15,
          pdfSha256: "abcdef0123456789",
          submittedBy: "user-1",
          submittedAt: "2026-07-13T09:30:00.000Z",
        },
        dispatches: [
          {
            id: "dispatch-2",
            confirmationId: "confirmation-1",
            sequence: 2,
            method: "COURIER",
            sentAt: "2026-07-13T10:00:00.000Z",
            createdBy: "user-1",
            createdAt: "2026-07-13T10:00:00.000Z",
          },
        ],
        followUpEvents: [
          {
            id: "redispatch-request-1",
            confirmationId: "confirmation-1",
            eventType: "REDISPATCH_REQUESTED",
            actorId: "user-1",
            source: "PROJECT_TEAM_MANUAL",
            occurredAt: "2026-07-13T09:00:00.000Z",
            createdAt: "2026-07-13T09:00:00.000Z",
          },
        ],
      }),
    ]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));

    await screen.findByTestId("confirmation-detail-toolbar");

    expect(
      screen.queryByRole("button", { name: "Send confirmation" })
    ).not.toBeInTheDocument();
  });

  it("offers a retry after a failed redispatch attempt", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({
        status: "PREPARED",
        differenceStatus: "EXCEPTION",
        currentArtifactId: "artifact-2",
        currentArtifact: {
          id: "artifact-2",
          confirmationId: "confirmation-1",
          version: 2,
          disposition: "ACTIVE",
          templateCode: "UPLOADED_DOCUMENT",
          templateVersion: "1",
          docxSize: 15,
          pdfSize: 15,
          pdfSha256: "abcdef0123456789",
          submittedBy: "user-1",
          submittedAt: "2026-07-13T09:30:00.000Z",
        },
        dispatches: [
          {
            id: "dispatch-8",
            confirmationId: "confirmation-1",
            sequence: 8,
            artifactId: "artifact-1",
            method: "COURIER",
            sentAt: "2026-07-13T10:00:00.000Z",
            createdBy: "user-1",
            createdAt: "2026-07-13T10:00:00.000Z",
          },
          {
            id: "dispatch-9",
            confirmationId: "confirmation-1",
            sequence: 9,
            artifactId: "artifact-2",
            method: "COURIER",
            executionStatus: "FAILED",
            trackingError: "17TRACK 尚未连接",
            sentAt: null,
            createdBy: "user-1",
            createdAt: "2026-07-13T10:05:00.000Z",
          },
        ],
        responses: [
          {
            id: "response-1",
            confirmationId: "confirmation-1",
            responseStatus: "RECEIVED",
            responseChannel: "PAPER",
            matchMethod: "MANUAL",
            routingStatus: "ROUTED",
            receivedAt: "2026-07-13T08:00:00.000Z",
            createdAt: "2026-07-13T08:00:00.000Z",
            updatedAt: "2026-07-13T08:00:00.000Z",
          },
        ],
        followUpEvents: [
          {
            id: "redispatch-request-1",
            confirmationId: "confirmation-1",
            eventType: "REDISPATCH_REQUESTED",
            actorId: "user-1",
            source: "PROJECT_TEAM_MANUAL",
            occurredAt: "2026-07-13T09:00:00.000Z",
            createdAt: "2026-07-13T09:00:00.000Z",
          },
        ],
      }),
    ]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));

    await expect(
      screen.findByRole("button", { name: "Send confirmation" })
    ).resolves.toBeVisible();
    fireEvent.click(await screen.findByRole("tab", { name: "Tracking" }));
    expect(screen.getByText("Redispatch confirmation #10")).toBeVisible();
  });

  it("offers the next redispatch for a newly frozen replacement and keeps review closed", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({
        status: "PREPARED",
        differenceStatus: "EXCEPTION",
        currentArtifactId: "artifact-3",
        currentArtifact: {
          id: "artifact-3",
          confirmationId: "confirmation-1",
          version: 3,
          disposition: "ACTIVE",
          templateCode: "UPLOADED_DOCUMENT",
          templateVersion: "1",
          docxSize: 15,
          pdfSize: 15,
          pdfSha256: "abcdef0123456789",
          submittedBy: "user-1",
          submittedAt: "2026-07-14T09:30:00.000Z",
        },
        dispatches: [
          {
            id: "dispatch-8",
            confirmationId: "confirmation-1",
            sequence: 8,
            artifactId: "artifact-2",
            method: "COURIER",
            sentAt: "2026-07-14T10:00:00.000Z",
            createdBy: "user-1",
            createdAt: "2026-07-14T10:00:00.000Z",
          },
        ],
        responses: [
          {
            id: "response-1",
            confirmationId: "confirmation-1",
            responseStatus: "RECEIVED",
            responseChannel: "PAPER",
            matchMethod: "MANUAL",
            routingStatus: "ROUTED",
            receivedAt: "2026-07-14T08:00:00.000Z",
            createdAt: "2026-07-14T08:00:00.000Z",
            updatedAt: "2026-07-14T08:00:00.000Z",
          },
        ],
        followUpEvents: [
          {
            id: "redispatch-request-1",
            confirmationId: "confirmation-1",
            eventType: "REDISPATCH_REQUESTED",
            actorId: "user-1",
            source: "PROJECT_TEAM_MANUAL",
            occurredAt: "2026-07-14T09:00:00.000Z",
            createdAt: "2026-07-14T09:00:00.000Z",
          },
        ],
      }),
    ]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));

    await expect(
      screen.findByRole("tab", { name: "Confirmation" })
    ).resolves.toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Review" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(
      screen.getByRole("button", { name: "Send confirmation" })
    ).toBeVisible();

    fireEvent.click(await screen.findByRole("tab", { name: "Tracking" }));
    expect(screen.getByText("Redispatch confirmation #9")).toBeVisible();
    expect(screen.getAllByText("Awaiting redispatch").length).toBeGreaterThan(
      0
    );
    expect(screen.queryByText("Awaiting response")).not.toBeInTheDocument();
  });

  it("opens a legacy pending redispatch in the editable confirmation draft", async () => {
    const pending = confirmation({
      status: "AWAITING_RESPONSE",
      differenceStatus: "EXCEPTION",
      dispatches: [
        {
          id: "dispatch-1",
          confirmationId: "confirmation-1",
          sequence: 1,
          method: "COURIER",
          sentAt: "2026-07-12T09:00:00.000Z",
          createdBy: "officer-1",
          createdAt: "2026-07-12T09:00:00.000Z",
        },
      ],
      followUpEvents: [
        {
          id: "redispatch-request-1",
          confirmationId: "confirmation-1",
          eventType: "REDISPATCH_REQUESTED",
          actorId: "reviewer-1",
          source: "PROJECT_TEAM_MANUAL",
          occurredAt: "2026-07-13T09:00:00.000Z",
          createdAt: "2026-07-13T09:00:00.000Z",
        },
      ],
    });
    const editable = confirmation({
      ...pending,
      status: "DRAFT",
      currentArtifactId: null,
      currentArtifact: null,
    });
    mockApi.projectConfirmations.mockResolvedValue([pending]);
    mockApi.startProjectConfirmationRedispatchEditing.mockResolvedValue(
      editable
    );
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.click(await screen.findByRole("tab", { name: "Tracking" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit confirmation before redispatch",
      })
    );

    await waitFor(() =>
      expect(
        mockApi.startProjectConfirmationRedispatchEditing
      ).toHaveBeenCalledWith("project-1", "confirmation-1")
    );
    expect(screen.getByRole("tab", { name: "Confirmation" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByTestId("confirmation-draft-document")).toBeVisible();
  });

  it("returns a redispatch draft to the creation milestone", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({
        status: "DRAFT",
        differenceStatus: "EXCEPTION",
        dispatches: [
          {
            id: "dispatch-1",
            confirmationId: "confirmation-1",
            sequence: 1,
            method: "COURIER",
            sentAt: "2026-07-12T09:00:00.000Z",
            createdBy: "officer-1",
            createdAt: "2026-07-12T09:00:00.000Z",
          },
        ],
        followUpEvents: [
          {
            id: "redispatch-request-1",
            confirmationId: "confirmation-1",
            eventType: "REDISPATCH_REQUESTED",
            actorId: "reviewer-1",
            source: "PROJECT_TEAM_MANUAL",
            occurredAt: "2026-07-13T09:00:00.000Z",
            createdAt: "2026-07-13T09:00:00.000Z",
          },
        ],
      }),
    ]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.click(await screen.findByRole("tab", { name: "Tracking" }));

    const createdHeading = screen.getByRole("heading", {
      name: "Confirmation created",
    });
    expect(createdHeading.parentElement).toHaveTextContent(
      "Edit before redispatch"
    );
    expect(
      screen.queryByText("Redispatch confirmation #2")
    ).not.toBeInTheDocument();
  });

  it("keeps legacy exception records in the redispatch cycle", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({
        status: "AWAITING_RESPONSE",
        differenceStatus: "EXCEPTION",
        dispatches: [
          {
            id: "dispatch-1",
            confirmationId: "confirmation-1",
            sequence: 1,
            method: "COURIER",
            sentAt: "2026-07-13T10:00:00.000Z",
            createdBy: "officer-1",
            createdAt: "2026-07-13T10:00:00.000Z",
          },
        ],
        followUpEvents: [
          {
            id: "redispatch-request-1",
            confirmationId: "confirmation-1",
            eventType: "REDISPATCH_REQUESTED",
            actorId: "reviewer-1",
            source: "PROJECT_TEAM_MANUAL",
            occurredAt: "2026-07-13T09:00:00.000Z",
            createdAt: "2026-07-13T09:00:00.000Z",
          },
        ],
      }),
    ]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.click(await screen.findByRole("tab", { name: "Tracking" }));

    expect(screen.getByText("Redispatch confirmation #2")).toBeVisible();
    expect(screen.getAllByText("Awaiting redispatch")[0]).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Response follow-up" }).parentElement
    ).toHaveTextContent("Not completed");
    expect(
      screen.getByRole("heading", { name: "Manual review" }).parentElement
    ).toHaveTextContent("Not completed");
  });

  it("labels the latest dispatch as a redispatch when dispatches are unsorted", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({
        status: "AWAITING_RESPONSE",
        differenceStatus: "EXCEPTION",
        dispatches: [
          {
            id: "dispatch-2",
            confirmationId: "confirmation-1",
            sequence: 2,
            method: "COURIER",
            sentAt: "2026-07-14T09:00:00.000Z",
            createdBy: "officer-2",
            createdAt: "2026-07-14T09:00:00.000Z",
          },
          {
            id: "dispatch-1",
            confirmationId: "confirmation-1",
            sequence: 1,
            method: "COURIER",
            sentAt: "2026-07-12T09:00:00.000Z",
            createdBy: "officer-1",
            createdAt: "2026-07-12T09:00:00.000Z",
          },
        ],
        followUpEvents: [
          {
            id: "redispatch-request-1",
            confirmationId: "confirmation-1",
            eventType: "REDISPATCH_REQUESTED",
            actorId: "reviewer-1",
            source: "PROJECT_TEAM_MANUAL",
            occurredAt: "2026-07-13T09:00:00.000Z",
            createdAt: "2026-07-13T09:00:00.000Z",
          },
        ],
      }),
    ]);
    renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.click(await screen.findByRole("tab", { name: "Tracking" }));

    expect(screen.getByText("Redispatch confirmation #2")).toBeVisible();
    expect(screen.getAllByText("Awaiting response").length).toBeGreaterThan(0);
  });

  it("advances received progress without inventing freeze or dispatch history", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      receivedConfirmation({
        dispatches: [],
        preparedDispatchReadyAt: null,
        preparedDispatchReadyBy: null,
        currentArtifact: null,
        currentArtifactId: null,
        followUpEvents: [
          {
            id: "actual-receipt",
            confirmationId: "confirmation-1",
            eventType: "RESPONSE_RECEIVED",
            actorId: "user-1",
            source: "RESPONSE_INTAKE",
            occurredAt: "2026-07-12T10:00:00.000Z",
            createdAt: "2026-07-12T10:00:00.000Z",
          },
        ],
      }),
    ]);
    renderPanel();
    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.click(await screen.findByRole("tab", { name: "Tracking" }));
    const sent = requiredFixture(
      requiredFixture(screen.getByText("Confirmation sent").parentElement)
        .parentElement
    );
    expect(sent.querySelector("svg.lucide-check")).not.toBeNull();
    const history = screen
      .getAllByRole("listitem")
      .map((item) => item.textContent)
      .join(" ");
    expect(history).toContain("Response received");
    expect(history).not.toContain("Confirmation frozen");
    expect(history).not.toContain("Initial dispatch");
  });

  it("lights the sent workflow milestone with its actor and time", async () => {
    mockApi.projectConfirmations.mockResolvedValue([
      confirmation({
        status: "AWAITING_RESPONSE",
        dispatches: [
          {
            id: "dispatch-1",
            confirmationId: "confirmation-1",
            sequence: 1,
            method: "COURIER",
            sentAt: "2026-07-12T09:00:00.000Z",
            dispatchReference: "ADMIN-REF-1",
            trackingNumber: "SF1001",
            trackingProvider: "17TRACK",
            trackingCarrierName: "SF Express",
            trackingStatus: "InTransit",
            trackingDescription: "Shipment departed the sorting centre",
            trackingLocation: "Shenzhen",
            trackingUpdatedAt: "2026-07-12T10:00:00.000Z",
            trackingEvents: [
              {
                at: "2026-07-12T10:00:00.000Z",
                description: "Shipment departed the sorting centre",
                location: "Shenzhen",
              },
              {
                at: "2026-07-12T09:15:00.000Z",
                description: "Shipment collected",
                location: "Hong Kong",
              },
            ],
            createdBy: "officer-1",
            createdAt: "2026-07-12T09:00:00.000Z",
          },
        ],
      }),
    ]);
    renderPanel();
    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.click(await screen.findByRole("tab", { name: "Tracking" }));
    expect(screen.getByText("Confirmation sent")).toBeVisible();
    expect(screen.getAllByText(/officer-1/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Jul 12, 2026/).length).toBeGreaterThanOrEqual(
      1
    );
    expect(screen.queryByText(/9:00 AM/)).not.toBeInTheDocument();
    expect(screen.getByText("Initial dispatch")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Initial dispatch · View tracking",
      })
    );
    expect(screen.getByText(/SF Express.*SF1001/)).toBeVisible();
    expect(
      screen.getByText("Shipment departed the sorting centre")
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "View tracking" }));
    expect(screen.getByText("Shipment collected")).toBeVisible();
  });

  it("refreshes archive completion and withdrawal events without changing the parent revision", async () => {
    const original = receivedConfirmation({
      status: "CLOSED",
      differenceStatus: "MATCHED",
      empImportItems: [
        {
          responseArtifactId: "artifact-1",
          attachmentId: "file-1",
          attachment: { deletedAt: null },
        },
      ],
      followUpEvents: [],
    });
    mockApi.projectConfirmations.mockResolvedValue([original]);
    const { client } = renderPanel();
    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.click(await screen.findByRole("tab", { name: "Tracking" }));
    const withdrawn = {
      ...original,
      empImportItems: [],
      followUpEvents: [
        {
          id: "withdraw-1",
          confirmationId: original.id,
          eventType: "IMPORT_WITHDRAWN" as const,
          actorId: "user-1",
          source: "PROJECT_TEAM_MANUAL",
          notes: "Withdrawn file after reimport",
          occurredAt: "2026-09-10T12:00:00Z",
          createdAt: "2026-09-10T12:00:00Z",
        },
      ],
    };
    mockApi.projectConfirmations.mockResolvedValue([withdrawn]);
    await invalidateConfirmationEmpImportQueries(client, "project-1");
    await expect(
      screen.findByText("Withdrawn file after reimport")
    ).resolves.toBeVisible();
    await waitFor(() =>
      expect(screen.getAllByText("Awaiting archive").length).toBeGreaterThan(0)
    );
    mockApi.projectConfirmations.mockResolvedValue([
      { ...withdrawn, empImportItems: original.empImportItems },
    ]);
    await invalidateConfirmationEmpImportQueries(client, "project-1");
    await waitFor(() =>
      expect(screen.queryByText("Awaiting archive")).not.toBeInTheDocument()
    );
    mockApi.projectConfirmations.mockResolvedValue([withdrawn]);
    await invalidateConfirmationEmpImportQueries(client, "project-1");
    await waitFor(() =>
      expect(screen.getAllByText("Awaiting archive").length).toBeGreaterThan(0)
    );
  });

  it("refreshes the selected confirmation when only nested logistics change", async () => {
    const original = confirmation({
      status: "AWAITING_RESPONSE",
      dispatches: [
        {
          id: "dispatch-1",
          confirmationId: "confirmation-1",
          sequence: 1,
          method: "COURIER",
          sentAt: "2026-07-12T09:00:00.000Z",
          trackingNumber: "SF1001",
          trackingEvents: [],
          createdBy: "officer-1",
          createdAt: "2026-07-12T09:00:00.000Z",
        },
      ],
    });
    mockApi.projectConfirmations.mockResolvedValue([original]);
    const { client } = renderPanel();

    fireEvent.click(await screen.findByText("HSBC Hong Kong"));
    fireEvent.click(await screen.findByRole("tab", { name: "Tracking" }));
    expect(screen.queryByText("Webhook arrived later")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Initial dispatch · View tracking",
      })
    );

    client.setQueryData(
      ["project-confirmations", "project-1"],
      [
        confirmation({
          status: "AWAITING_RESPONSE",
          updatedAt: original.updatedAt,
          dispatches: [
            {
              ...requiredFixture(requiredFixture(original.dispatches)[0]),
              trackingUpdatedAt: "2026-07-12T11:00:00.000Z",
              trackingEvents: [
                {
                  at: "2026-07-12T09:30:00.000Z",
                  description: "Webhook arrived later",
                  location: "Hong Kong",
                },
              ],
            },
          ],
        }),
      ]
    );

    await expect(
      screen.findByText("Webhook arrived later")
    ).resolves.toBeVisible();
  });
});
