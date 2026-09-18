import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @vitest-environment happy-dom

import {
  ApiError,
  api,
  completeSignedUpload,
  getProjectConfirmationAttachment,
} from "./client";
import type {
  AttachmentUploadGrant,
  ConfirmationTemplateDesign,
} from "./client";

vi.mock("./mode", () => ({
  getApiMode: () => "mock",
  isMockApiMode: () => true,
}));

describe("lint test setup", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses versioned preview URLs without bypassing the browser cache", async () => {
    vi.resetModules();
    vi.doMock("./mode", () => ({
      getApiMode: () => "live",
      isMockApiMode: () => false,
      isRemoteVisualizationMode: () => false,
    }));
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        new Response(new Blob(["%PDF-1.4"]), {
          status: 200,
          headers: {
            "Content-Type": "application/vnd.project-wing.preview",
          },
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const { api: liveApi, getAttachmentPreviewPdfUrl } =
      await import("./client");

    await liveApi.previewAttachmentContent("project-1", "attachment-1", 7);
    await liveApi.previewAttachmentPdf("project-1", "attachment-1", 7);

    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "/engagement/project-1/workflow/attachments/attachment-1/preview-content?version=7"
    );
    expect(fetchMock.mock.calls[1]?.[0]).toContain(
      "/engagement/project-1/workflow/attachments/attachment-1/preview-pdf?transport=blob&version=7"
    );
    expect(fetchMock.mock.calls[1]?.[0]).toContain(
      "previewDelivery=content-v2"
    );
    expect(fetchMock.mock.calls[1]?.[0]).toContain("notesFormat=1");
    expect(getAttachmentPreviewPdfUrl("project-1", "attachment-1")).toContain("notesFormat=1");
    expect(fetchMock.mock.calls[0]?.[1]).not.toStrictEqual(
      expect.objectContaining({ cache: "no-store" })
    );
    expect(fetchMock.mock.calls[1]?.[1]).not.toStrictEqual(
      expect.objectContaining({ cache: "no-store" })
    );
    expect(
      getAttachmentPreviewPdfUrl("project-1", "attachment-1", "report", 7)
    ).toContain("/preview-pdf/report?version=7");
    expect(
      getAttachmentPreviewPdfUrl("project-1", "attachment-1", "report", 7)
    ).toContain("previewDelivery=content-v2");
    expect(getAttachmentPreviewPdfUrl("project-1", "attachment-1")).toContain(
      "?previewDelivery=content-v2"
    );
  });

  it("exposes the file-based workbench actions", () => {
    expect(api).toHaveProperty("createWorkflowNode");
    expect(api).toHaveProperty("updateWorkflowNode");
    expect(api).toHaveProperty("deleteWorkflowNode");
    expect(api).toHaveProperty("createWorkingPaper");
    expect(api).toHaveProperty("projectTemplates");
    expect(api).toHaveProperty("projectTemplate");
    expect(api).toHaveProperty("previewProjectTemplate");
    expect(api).toHaveProperty("previewConfirmationDispatchPdf");
    expect(api).toHaveProperty("uploadProjectConfirmation");
    expect(api).toHaveProperty("confirmationEmpProjects");
    expect(api).toHaveProperty("confirmationEmpPreview");
    expect(api).toHaveProperty("createConfirmationEmpImport");
    expect(api).toHaveProperty("confirmationEmpImportJob");
    expect(api).toHaveProperty("retryConfirmationEmpImport");
    expect(api).toHaveProperty("withdrawConfirmationEmpImport");
    expect(api).toHaveProperty("applyProjectTemplate");
    expect(api).toHaveProperty("deleteWorkingPaper");
    expect(api).toHaveProperty("uploadWorkingPaperAttachment");
    expect(api).toHaveProperty("previewAttachmentContent");
    expect(api).toHaveProperty("attachmentHistory");
    expect(api).toHaveProperty("attachmentConflicts");
    expect(api).toHaveProperty("resolveAttachmentConflict");
    expect(api).toHaveProperty("openZipMaster");
    expect(api).toHaveProperty("readZip");
    expect(api).toHaveProperty("addZipMasterOperation");
    expect(api).toHaveProperty("closeZipMaster");
    expect(api).toHaveProperty("discardZipMaster");
    expect(api).toHaveProperty("deletedAttachments");
    expect(api).toHaveProperty("projectAttachments");
    expect(api).toHaveProperty("deleteAttachment");
    expect(api).toHaveProperty("restoreAttachment");
    expect(api).toHaveProperty("downloadAttachmentVersion");
    expect(api).toHaveProperty("restoreAttachmentVersion");
    expect(api).toHaveProperty("archiveCheck");
    expect(api).toHaveProperty("startArchiveJob");
    expect(api).toHaveProperty("archiveJob");
    expect(api).toHaveProperty("archiveArtifact");
    expect(api).toHaveProperty("downloadArchiveArtifact");
    expect(api).toHaveProperty("archiveProject");
    expect(api).toHaveProperty("deleteProject");
    expect(api).toHaveProperty("deletedProjects");
    expect(api).toHaveProperty("restoreProject");
    expect(api).toHaveProperty("auditLogs");
  });

  describe("api client workbench surface", () => {
    it("exposes the file-based workbench actions", () => {
      expect(api).toHaveProperty("createWorkflowNode");
      expect(api).toHaveProperty("updateWorkflowNode");
      expect(api).toHaveProperty("deleteWorkflowNode");
      expect(api).toHaveProperty("createWorkingPaper");
      expect(api).toHaveProperty("projectTemplates");
      expect(api).toHaveProperty("projectTemplate");
      expect(api).toHaveProperty("previewProjectTemplate");
      expect(api).toHaveProperty("previewConfirmationDispatchPdf");
      expect(api).toHaveProperty("uploadProjectConfirmation");
      expect(api).toHaveProperty("confirmationEmpProjects");
      expect(api).toHaveProperty("confirmationEmpPreview");
      expect(api).toHaveProperty("createConfirmationEmpImport");
      expect(api).toHaveProperty("confirmationEmpImportJob");
      expect(api).toHaveProperty("retryConfirmationEmpImport");
      expect(api).toHaveProperty("withdrawConfirmationEmpImport");
      expect(api).toHaveProperty("applyProjectTemplate");
      expect(api).toHaveProperty("deleteWorkingPaper");
      expect(api).toHaveProperty("uploadWorkingPaperAttachment");
      expect(api).toHaveProperty("previewAttachmentContent");
      expect(api).toHaveProperty("attachmentHistory");
      expect(api).toHaveProperty("attachmentConflicts");
      expect(api).toHaveProperty("resolveAttachmentConflict");
      expect(api).toHaveProperty("openZipMaster");
      expect(api).toHaveProperty("readZip");
      expect(api).toHaveProperty("addZipMasterOperation");
      expect(api).toHaveProperty("closeZipMaster");
      expect(api).toHaveProperty("discardZipMaster");
      expect(api).toHaveProperty("deletedAttachments");
      expect(api).toHaveProperty("projectAttachments");
      expect(api).toHaveProperty("deleteAttachment");
      expect(api).toHaveProperty("restoreAttachment");
      expect(api).toHaveProperty("downloadAttachmentVersion");
      expect(api).toHaveProperty("restoreAttachmentVersion");
      expect(api).toHaveProperty("archiveCheck");
      expect(api).toHaveProperty("startArchiveJob");
      expect(api).toHaveProperty("archiveJob");
      expect(api).toHaveProperty("archiveArtifact");
      expect(api).toHaveProperty("downloadArchiveArtifact");
      expect(api).toHaveProperty("archiveProject");
      expect(api).toHaveProperty("deleteProject");
      expect(api).toHaveProperty("deletedProjects");
      expect(api).toHaveProperty("restoreProject");
      expect(api).toHaveProperty("auditLogs");
    });

    it("updates a confirmation template design with the workbench contract", async () => {
      vi.resetModules();
      vi.doMock(import("./mode"), () => ({
        getApiMode: () => "live",
        isMockApiMode: () => false,
        isRemoteVisualizationMode: () => false,
      }));

      const designSchema: ConfirmationTemplateDesign = {
        version: 1,
        fields: [
          {
            id: "field-text",
            kind: "TEXT",
            name: "recipientName",
            page: 1,
            x: 0.1,
            y: 0.2,
            width: 0.3,
            height: 0.04,
            placeholder: "Recipient name",
            options: [],
          },
          {
            id: "field-select",
            kind: "SELECT",
            name: "salutation",
            page: 1,
            x: 0.1,
            y: 0.3,
            width: 0.2,
            height: 0.04,
            placeholder: "Select salutation",
            options: ["Sir/Madam", "Sir", "Madam"],
          },
          {
            id: "field-mask",
            kind: "MASK",
            name: "source-field-mask",
            page: 2,
            x: 0.2,
            y: 0.4,
            width: 0.5,
            height: 0.08,
            placeholder: "",
            options: [],
          },
        ],
      };
      const fetchMock = vi.fn().mockResolvedValue(
        Response.json({
          id: "template-1",
          code: "CTPL-001",
          name: "Custom bank template",
          confirmationType: "BANK",
          description: null,
          fileName: "custom.docx",
          fileSize: 42,
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          isBuiltIn: false,
          uploadedById: "user-1",
          uploader: { id: "user-1", name: "Author" },
          createdAt: "2026-08-15T00:00:00.000Z",
          updatedAt: "2026-08-15T00:00:00.000Z",
          designSchema,
          designStatus: "ENABLED",
          enabledAt: "2026-08-15T00:00:00.000Z",
        })
      );
      vi.stubGlobal("fetch", fetchMock);
      const { api: liveApi } = await import("./client");

      await expect(
        liveApi.updateConfirmationTemplateLibraryDesign("template-1", {
          designSchema,
          designStatus: "ENABLED",
        })
      ).resolves.toMatchObject({
        designSchema,
        designStatus: "ENABLED",
        enabledAt: "2026-08-15T00:00:00.000Z",
      });

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:3000/confirmations/template-library/template-1/design",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ designSchema, designStatus: "ENABLED" }),
        })
      );
    });

    it("updates a confirmation template status through the status endpoint", async () => {
      vi.resetModules();
      vi.doMock(import("./mode"), () => ({
        getApiMode: () => "live",
        isMockApiMode: () => false,
        isRemoteVisualizationMode: () => false,
      }));

      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          Response.json({ id: "template-1", designStatus: "DISABLED" })
        );
      vi.stubGlobal("fetch", fetchMock);
      const { api: liveApi } = await import("./client");

      await expect(
        liveApi.updateConfirmationTemplateLibraryStatus("template-1", {
          designStatus: "DISABLED",
        })
      ).resolves.toStrictEqual({ id: "template-1", designStatus: "DISABLED" });

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:3000/confirmations/template-library/template-1/status",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ designStatus: "DISABLED" }),
        })
      );
    });

    it("updates up to a bulk set of confirmation template statuses", async () => {
      vi.resetModules();
      vi.doMock(import("./mode"), () => ({
        getApiMode: () => "live",
        isMockApiMode: () => false,
        isRemoteVisualizationMode: () => false,
      }));

      const fetchMock = vi.fn().mockResolvedValue(
        Response.json([
          { id: "template-1", designStatus: "ENABLED" },
          { id: "template-2", designStatus: "ENABLED" },
        ])
      );
      vi.stubGlobal("fetch", fetchMock);
      const { api: liveApi } = await import("./client");

      await expect(
        liveApi.bulkUpdateConfirmationTemplateLibraryStatus({
          templateIds: ["template-1", "template-2"],
          designStatus: "ENABLED",
        })
      ).resolves.toStrictEqual([
        { id: "template-1", designStatus: "ENABLED" },
        { id: "template-2", designStatus: "ENABLED" },
      ]);

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:3000/confirmations/template-library/status",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            templateIds: ["template-1", "template-2"],
            designStatus: "ENABLED",
          }),
        })
      );
    });

    it("exposes cookie-session sign-out alongside login", () => {
      expect(api).toHaveProperty("login");
      expect(api).toHaveProperty("signOut");
    });

    it("keeps confirmation review on the mock API boundary in mock mode", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("live request"));
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        api.reviewProjectConfirmationResponse(
          "project-orchid-2026",
          "missing",
          {
            result: "MATCHED",
          }
        )
      ).rejects.toMatchObject({ code: "MOCK_NOT_FOUND" });

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("keeps confirmation review rollback on the mock API boundary in mock mode", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("live request"));
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        api.undoProjectConfirmationReview("project-orchid-2026", "missing")
      ).rejects.toMatchObject({ code: "MOCK_NOT_FOUND" });

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("keeps EMP import preview on the mock boundary until the live API is wired", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("live request"));
      vi.stubGlobal("fetch", fetchMock);
      await api.login("partner@projectwing.local", "anything");

      const projects = await api.confirmationEmpProjects();
      expect(projects[0]).toStrictEqual(
        expect.objectContaining({ importEligible: true, status: "ACTIVE" })
      );
      const preview = await api.confirmationEmpPreview(projects[0].id, {
        mode: "ZIP",
      });

      expect(preview).toStrictEqual(
        expect.objectContaining({ projectId: projects[0].id, mode: "ZIP" })
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("uses the shared EMP contract for live preview parsing and mutation bodies", async () => {
      vi.resetModules();
      vi.doMock(import("./mode"), () => ({
        getApiMode: () => "live",
        isMockApiMode: () => false,
        isRemoteVisualizationMode: () => false,
      }));

      const previewResponse = {
        projectId: "project-1",
        mode: "GROUPED",
        targetDirectoryId: "directory-1",
        targetDirectories: [
          {
            id: "directory-1",
            code: "A1",
            title: "Planning",
            path: "Planning",
            level: 1,
            canAcceptWorkflow: true,
          },
        ],
        batchDirectory: { code: "A1-B001", name: "Confirmation responses" },
        zipWorkingPaper: null,
        counts: { eligible: 1, imported: 0, blocked: 0 },
        items: [
          {
            id: "source-1",
            sourceConfirmationId: "confirmation-1",
            confirmationId: "confirmation-1",
            confirmationCode: "CONF-001",
            counterparty: "Orchid Bank",
            role: "OUTGOING",
            sourceFileName: "outgoing.msg",
            sourceFileSize: 42,
            sourceProposal: {
              sourceConfirmationId: "confirmation-1",
              empCode: "A1-F001",
              businessName: "Orchid Bank outgoing confirmation",
            },
            status: "ELIGIBLE",
            existingLocation: null,
            existingCode: null,
            signoff: {
              preparerName: "Preparer",
              reviewerName: "Reviewer",
              manual: false,
            },
            zipEntryName: null,
            blockingIssues: [],
          },
        ],
        zipEntries: [],
        blockers: [],
        fingerprint: "preview-fingerprint-1",
      };
      const jobResponse = {
        id: "job-1",
        projectId: "project-1",
        mode: "GROUPED",
        status: "QUEUED",
        total: 1,
        completed: 0,
        failed: 0,
        retryable: false,
        previewFingerprint: "preview-fingerprint-1",
        createdAt: "2026-08-05T00:00:00.000Z",
        updatedAt: "2026-08-05T00:00:00.000Z",
        withdrawnAt: null,
        items: [
          {
            id: "source-1",
            sourceConfirmationId: "confirmation-1",
            confirmationId: "confirmation-1",
            sourceFileName: "outgoing.msg",
            status: "QUEUED",
            targetLocation: null,
            errorMessage: null,
            retryable: false,
          },
        ],
      };
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const jsonResponse = (body: unknown) => Response.json(body);

      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          ...previewResponse,
          items: [
            {
              ...previewResponse.items[0],
              sourceProposal: {
                ...previewResponse.items[0].sourceProposal,
                empCode: "",
              },
            },
          ],
        })
      );
      const { api: liveApi } = await import("./client");
      await expect(
        liveApi.confirmationEmpPreview("project-1", {
          mode: "GROUPED",
          targetDirectoryId: "directory-1",
          confirmationId: "confirmation-1",
        })
      ).rejects.toThrow(/.+/);
      expect(fetchMock.mock.calls[0]?.[0]).toBe(
        "http://localhost:3000/engagement/project-1/confirmation-emp-imports/preview?mode=GROUPED&targetDirectoryId=directory-1&confirmationId=confirmation-1"
      );

      fetchMock.mockResolvedValueOnce(jsonResponse(previewResponse));
      await liveApi.confirmationEmpPreview("project-1", {
        mode: "GROUPED",
        targetDirectoryId: "directory-1",
        confirmationIds: ["confirmation-1", "confirmation-1", "confirmation-2"],
      });
      expect(fetchMock.mock.calls[1]?.[0]).toBe(
        "http://localhost:3000/engagement/project-1/confirmation-emp-imports/preview?mode=GROUPED&targetDirectoryId=directory-1&confirmationIds=confirmation-1&confirmationIds=confirmation-2"
      );

      fetchMock.mockResolvedValueOnce(jsonResponse(jobResponse));
      await liveApi.createConfirmationEmpImport("project-1", {
        mode: "GROUPED",
        targetDirectoryId: "directory-1",
        previewFingerprint: "preview-fingerprint-1",
        batchDirectory: { code: "A1-B001", name: "Confirmation responses" },
        items: [
          {
            id: "source-1",
            sourceConfirmationId: "confirmation-1",
            empCode: "A1-F001",
            businessName: "Orchid Bank outgoing confirmation",
          },
        ],
        idempotencyKey: "11111111-1111-4111-8111-111111111111",
      });
      expect(fetchMock.mock.calls[2]?.[0]).toBe(
        "http://localhost:3000/engagement/project-1/confirmation-emp-imports"
      );
      expect(
        JSON.parse(fetchMock.mock.calls[2]?.[1]?.body as string)
      ).toStrictEqual({
        mode: "GROUPED",
        targetDirectoryId: "directory-1",
        previewFingerprint: "preview-fingerprint-1",
        batchDirectory: { code: "A1-B001", name: "Confirmation responses" },
        items: [
          {
            id: "source-1",
            sourceConfirmationId: "confirmation-1",
            empCode: "A1-F001",
            businessName: "Orchid Bank outgoing confirmation",
          },
        ],
        idempotencyKey: "11111111-1111-4111-8111-111111111111",
      });

      fetchMock.mockResolvedValueOnce(jsonResponse(jobResponse));
      await liveApi.withdrawConfirmationEmpImport("project-1", "job-1", {
        mode: "GROUPED",
        scope: "SOURCE_CONFIRMATION",
        sourceConfirmationId: "confirmation-1",
      });
      expect(
        JSON.parse(fetchMock.mock.calls[3]?.[1]?.body as string)
      ).toStrictEqual({
        mode: "GROUPED",
        scope: "SOURCE_CONFIRMATION",
        sourceConfirmationId: "confirmation-1",
      });
    });

    it("uses the project-scoped response library endpoint", async () => {
      vi.resetModules();
      vi.doMock(import("./mode"), () => ({
        getApiMode: () => "live",
        isMockApiMode: () => false,
        isRemoteVisualizationMode: () => false,
      }));

      const fetchMock = vi.fn().mockResolvedValue(Response.json([]));
      vi.stubGlobal("fetch", fetchMock);
      const { api: liveApi } = await import("./client");

      await expect(
        liveApi.projectConfirmationResponseWarehouse("project-1")
      ).resolves.toStrictEqual([]);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:3000/confirmations/response-library/project/project-1",
        expect.objectContaining({ credentials: "include" })
      );
    });

    it("persists report date through the project confirmation defaults endpoint", async () => {
      vi.resetModules();
      vi.doMock(import("./mode"), () => ({
        getApiMode: () => "live",
        isMockApiMode: () => false,
        isRemoteVisualizationMode: () => false,
      }));

      const fetchMock = vi.fn().mockResolvedValue(
        Response.json({
          projectId: "project-1",
          clientName: "Orchid Holdings",
          confirmationDate: "2026-12-31",
          reference: "REF-001",
          pic: "Bonnie Su",
          mic: "Michael Chan",
          reportDate: "2026-08-15",
          updatedAt: "2026-08-15T00:00:00.000Z",
        })
      );
      vi.stubGlobal("fetch", fetchMock);
      const { api: liveApi } = await import("./client");

      await expect(
        liveApi.updateProjectConfirmationDefaults("project-1", {
          clientName: "Orchid Holdings",
          confirmationDate: "2026-12-31",
          reference: "REF-001",
          pic: "Bonnie Su",
          mic: "Michael Chan",
          reportDate: "2026-08-15",
        })
      ).resolves.toMatchObject({ reportDate: "2026-08-15" });

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:3000/engagement/project-1/confirmation-defaults",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            clientName: "Orchid Holdings",
            confirmationDate: "2026-12-31",
            reference: "REF-001",
            pic: "Bonnie Su",
            mic: "Michael Chan",
            reportDate: "2026-08-15",
          }),
        })
      );
    });

    it("loads project choices from the dedicated eligible-projects endpoint", async () => {
      vi.resetModules();
      vi.doMock(import("./mode"), () => ({
        getApiMode: () => "live",
        isMockApiMode: () => false,
        isRemoteVisualizationMode: () => false,
      }));

      const fetchMock = vi.fn().mockResolvedValue(
        Response.json({
          projects: [
            { id: "project-1", code: "AUD-001", name: "Orchid Audit" },
          ],
        })
      );
      vi.stubGlobal("fetch", fetchMock);
      const { api: liveApi } = await import("./client");

      await expect(liveApi.confirmationEmpProjects()).resolves.toStrictEqual([
        {
          id: "project-1",
          projectCode: "AUD-001",
          name: "Orchid Audit",
          reportDate: null,
          status: "ACTIVE",
          importEligible: true,
          eligibilityReason: null,
        },
      ]);
      expect(() =>
        // @ts-expect-error ZIP source scopes are rejected by the shared union.
        liveApi.withdrawConfirmationEmpImport("project-1", "job-1", {
          mode: "ZIP",
          scope: "SOURCE_CONFIRMATION",
          sourceConfirmationId: "confirmation-1",
        })
      ).toThrow(/.+/);
      expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
        "http://localhost:3000/engagement/confirmation-emp-imports/eligible-projects",
        expect.objectContaining({ credentials: "include" })
      );
    });

    it("uses the attachment download URL without changing its original filename or MIME", async () => {
      vi.resetModules();
      vi.doMock(import("./mode"), () => ({
        getApiMode: () => "live",
        isMockApiMode: () => false,
        isRemoteVisualizationMode: () => false,
      }));
      const fetchMock = vi.fn().mockResolvedValue(
        new Response("opaque evidence", {
          status: 200,
          headers: { "Content-Type": "application/vnd.ms-outlook" },
        })
      );
      vi.stubGlobal("fetch", fetchMock);
      const { api: liveApi } = await import("./client");
      const blob = await liveApi.downloadProjectConfirmationAttachment(
        "project-1",
        "confirmation-1",
        "/engagement/project-1/confirmations/confirmation-1/attachment/download"
      );

      expect(blob.type).toBe("application/vnd.ms-outlook");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:3000/engagement/project-1/confirmations/confirmation-1/attachment/download",
        expect.objectContaining({ credentials: "include" })
      );
    });

    it("normalizes legacy attachment fields for the new document contract", () => {
      expect(
        getProjectConfirmationAttachment({
          attachmentName: "evidence.msg",
          attachmentMimeType: "application/vnd.ms-outlook",
        })
      ).toMatchObject({
        originalFileName: "evidence.msg",
        originalMimeType: "application/vnd.ms-outlook",
        previewability: null,
        downloadUrl: null,
      });
    });

    it("validates the current user from the shared cookie session", async () => {
      await expect(api.me()).resolves.toMatchObject({ id: expect.any(String) });
    });

    it("restores the Intranet entry from the shared cookie session", async () => {
      await expect(api.restoreIntranetEntry()).resolves.toMatchObject({
        id: expect.any(String),
      });
    });

    it("keeps sign-out available without a browser admission marker", async () => {
      await expect(api.signOut()).resolves.toBeUndefined();
    });

    it("posts restore scope to the confirmation EMP restore endpoint", async () => {
      vi.resetModules();
      vi.doMock(import("./mode"), () => ({
        getApiMode: () => "live",
        isMockApiMode: () => false,
        isRemoteVisualizationMode: () => false,
      }));

      const restoredJob = {
        id: "job-1",
        projectId: "project-1",
        mode: "GROUPED",
        status: "COMPLETED",
        total: 1,
        completed: 1,
        failed: 0,
        retryable: false,
        previewFingerprint: "fingerprint-1",
        createdAt: "2026-08-05T00:00:00.000Z",
        updatedAt: "2026-08-05T00:00:00.000Z",
        withdrawnAt: null,
        items: [
          {
            id: "source-1",
            sourceConfirmationId: "confirmation-1",
            confirmationId: "confirmation-1",
            sourceFileName: "evidence.msg",
            status: "COMPLETED",
            targetLocation: "Planning / A1-F001",
            targetCode: "A1-F001",
            errorMessage: null,
            retryable: false,
          },
        ],
      };
      const fetchMock = vi.fn().mockResolvedValue(Response.json(restoredJob));
      vi.stubGlobal("fetch", fetchMock);
      const { api: liveApi } = await import("./client");

      await expect(
        liveApi.restoreConfirmationEmpImport("project-1", "job-1", {
          mode: "GROUPED",
          scope: "SOURCE_CONFIRMATION",
          sourceConfirmationId: "confirmation-1",
        })
      ).resolves.toMatchObject({ id: "job-1", status: "COMPLETED" });
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:3000/engagement/project-1/confirmation-emp-imports/job-1/restore",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            mode: "GROUPED",
            scope: "SOURCE_CONFIRMATION",
            sourceConfirmationId: "confirmation-1",
          }),
        })
      );
    });
  });

  describe("signed attachment upload recovery", () => {
    const file = new File(["audit"], "audit.pdf", {
      type: "application/pdf",
    });
    const grant = (suffix: string): AttachmentUploadGrant => ({
      uploadUrl: `https://oss.example/${suffix}`,
      objectKey: `working-papers/project-1/paper-1/${suffix}`,
      fileName: "audit.pdf",
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      expiresAt: "2026-07-27T12:00:00.000Z",
    });

    it("confirms the object when the browser cannot observe the PUT result", async () => {
      const fetchMock = vi
        .fn()
        .mockRejectedValue(new TypeError("Failed to fetch"));
      vi.stubGlobal("fetch", fetchMock);
      const prepare = vi.fn().mockResolvedValue(grant("attempt-1"));
      const confirm = vi.fn().mockResolvedValue({ id: "attachment-1" });

      await expect(
        completeSignedUpload({
          file,
          prepare,
          uploadLocal: vi.fn(),
          confirm,
        })
      ).resolves.toStrictEqual({ id: "attachment-1" });

      expect(prepare).toHaveBeenCalledOnce();
      expect(confirm).toHaveBeenCalledWith(grant("attempt-1"));
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("requests a fresh grant when an ambiguous PUT did not store the object", async () => {
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(new Response(null, { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);
      const prepare = vi
        .fn()
        .mockResolvedValueOnce(grant("attempt-1"))
        .mockResolvedValueOnce(grant("attempt-2"));
      const confirm = vi
        .fn()
        .mockRejectedValueOnce(
          new ApiError(
            "DIRECT_UPLOAD_NOT_FOUND",
            "Uploaded object was not found",
            "request-1"
          )
        )
        .mockResolvedValueOnce({ id: "attachment-1" });

      await expect(
        completeSignedUpload({
          file,
          prepare,
          uploadLocal: vi.fn(),
          confirm,
        })
      ).resolves.toStrictEqual({ id: "attachment-1" });

      expect(prepare).toHaveBeenCalledTimes(2);
      expect(confirm).toHaveBeenNthCalledWith(1, grant("attempt-1"));
      expect(confirm).toHaveBeenNthCalledWith(2, grant("attempt-2"));
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
