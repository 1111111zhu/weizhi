import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectTemplateFileDetailPage } from "./template-detail";

const mockSearch = vi.hoisted(() => ({
  value: "returnTo=%2Fen-US%2Fengagement%3FtemplateLibrary%3D1",
}));
const mockApi = vi.hoisted(() => ({
  adminProjectTemplate: vi.fn(),
  me: vi.fn(),
  previewProjectTemplateFile: vi.fn(),
  projectTemplate: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearch.value),
}));

vi.mock("../api/client", () => ({
  api: mockApi,
}));

vi.mock("@/components/file-preview-pane", () => ({
  BlobFilePreviewPane: ({ fileName }: { fileName: string }) => (
    <div data-testid="template-file-preview">{fileName}</div>
  ),
}));

vi.mock("../i18n/client", () => ({
  useI18n: () => ({
    dictionary: {
      templateDetail: {
        title: "Template workpaper details",
        loading: "Loading template workpaper...",
        loadFailed: "Could not load this template. Please try again.",
        notFoundTitle: "Template workpaper not found",
        notFoundDescription:
          "This template workpaper does not exist, or this account cannot view it.",
        back: "Back",
        readOnly: "Read-only",
        templateLabel: "Template",
        folderPathLabel: "Folder",
        codeLabel: "Code",
        titleLabel: "Title",
        originalNameLabel: "Original file name",
        fileNameLabel: "Stored file name",
        fileSizeLabel: "Size",
        mimeTypeLabel: "File type",
        paperTypeLabel: "Workpaper type",
        updatedAtLabel: "Updated",
        createdAtLabel: "Created",
        frameworkLabel: "Framework",
        statusLabel: "Template status",
        emptyValue: "-",
        workpaperType: "Workpaper",
        supplementType: "Supporting file",
        draftStatus: "Draft",
        publishedStatus: "Published",
        previewUnavailable: "This file has no previewable content.",
        previewUnsupported: "This file type cannot be previewed.",
        retry: "Retry",
      },
    },
    locale: "en-US",
    localizedPath: (path: string) => `/en-US${path}`,
  }),
}));

describe("lint test setup", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    mockSearch.value = "returnTo=%2Fen-US%2Fengagement%3FtemplateLibrary%3D1";
  });

  describe(ProjectTemplateFileDetailPage, () => {
    it("loads draft template file details through the admin template API", async () => {
      mockApi.me.mockResolvedValue({
        id: "user-super-admin",
        email: "admin@projectwing.local",
        name: "Admin",
        globalRole: "SUPER_ADMIN",
        status: "ACTIVE",
      });
      mockApi.adminProjectTemplate.mockResolvedValue({
        id: "project-template-cas-standard-audit",
        code: "CAS-STANDARD-AUDIT",
        name: "CAS standard audit template",
        language: "zh-CN",
        frameworkTemplateId: "framework-cas",
        frameworkTemplate: {
          id: "framework-cas",
          code: "CAS",
          name: "CAS",
          language: "zh-CN",
          isActive: true,
        },
        description: "",
        status: "DRAFT",
        nodes: [
          {
            id: "template-node-planning",
            projectTemplateId: "project-template-cas-standard-audit",
            parentId: null,
            level: 1,
            code: "Planning",
            title: "Planning",
            nodeType: "PHASE",
            sortOrder: 1,
            files: [],
          },
          {
            id: "template-node-a1-1000",
            projectTemplateId: "project-template-cas-standard-audit",
            parentId: "template-node-planning",
            level: 2,
            code: "A1-1000",
            title: "Cash",
            nodeType: "WORKING_PAPER",
            sortOrder: 1,
            files: [
              {
                id: "template-file-a1-1000-f001",
                projectTemplateId: "project-template-cas-standard-audit",
                templateNodeId: "template-node-a1-1000",
                code: "A1-1000-F001",
                title: "Cash lead schedule",
                fileName: "cash-lead-schedule.xlsx",
                originalName: "cash-lead-schedule.xlsx",
                fileUrl: "mock://project-templates/cash-lead-schedule.xlsx",
                fileSize: 4096,
                mimeType:
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                paperType: "WORKING_PAPER",
                sortOrder: 1,
                createdAt: "2026-06-01T08:00:00.000Z",
                updatedAt: "2026-06-02T08:00:00.000Z",
              },
            ],
          },
        ],
      });

      renderTemplateDetail();

      await waitFor(() => {
        expect(mockApi.adminProjectTemplate).toHaveBeenCalledWith(
          "project-template-cas-standard-audit"
        );
      });
      expect(mockApi.projectTemplate).not.toHaveBeenCalled();
      expect(screen.getByTestId("template-file-preview")).toHaveTextContent(
        "cash-lead-schedule.xlsx"
      );
      expect(screen.queryByText("A1-1000-F001")).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
        "href",
        "/en-US/engagement?templateLibrary=1"
      );
    });

    it("falls back to the projects page when returnTo is not a safe relative path", async () => {
      mockSearch.value = "returnTo=https%3A%2F%2Fevil.example%2F";
      mockApi.me.mockResolvedValue({
        id: "user-staff",
        email: "staff@projectwing.local",
        name: "King Su",
        globalRole: "STAFF",
        status: "ACTIVE",
      });
      mockApi.projectTemplate.mockResolvedValue({
        id: "project-template-cas-standard-audit",
        code: "CAS-STANDARD-AUDIT",
        name: "CAS standard audit template",
        language: "zh-CN",
        status: "PUBLISHED",
        nodes: [],
      });

      renderTemplateDetail();

      await waitFor(() =>
        expect(mockApi.projectTemplate).toHaveBeenCalledWith(
          "project-template-cas-standard-audit"
        )
      );
      expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
        "href",
        "/en-US/engagement"
      );
    });
  });

  function renderTemplateDetail() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(ProjectTemplateFileDetailPage, {
          templateId: "project-template-cas-standard-audit",
          fileId: "template-file-a1-1000-f001",
        })
      )
    );
  }
});
