import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";

import type { Mock } from "vitest";

import { ProjectsController } from "./projects.controller";

const projects = {
  create: vi.fn(),
  list: vi.fn(),
  listDeleted: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  movePlacement: vi.fn(),
  deleteProject: vi.fn(),
  restoreProject: vi.fn(),
  archiveCheck: vi.fn(),
  startArchiveCheckJob: vi.fn(),
  archiveCheckJob: vi.fn(),
  startArchiveJob: vi.fn(),
  archiveJob: vi.fn(),
  subscribeArchiveJob: vi.fn(),
  archiveArtifact: vi.fn(),
  rollForwardPreview: vi.fn(),
  unlinkEngagement: vi.fn(),
  archive: vi.fn(),
  submitArchive: vi.fn(),
  reopen: vi.fn(),
  confirmArchive: vi.fn(),
};
const confirmations = {
  listForProject: vi.fn(),
  getProjectConfirmationDefaults: vi.fn(),
  updateProjectConfirmationDefaults: vi.fn(),
  createForProject: vi.fn(),
  updateForProject: vi.fn(),
  previewPdfForProject: vi.fn(),
  previewDocxForProject: vi.fn(),
  reviewProjectConfirmationResponse: vi.fn(),
  startRedispatchEditing: vi.fn(),
  uploadDispatchAttachment: vi.fn(),
  voidProjectConfirmation: vi.fn(),
  restoreProjectConfirmation: vi.fn(),
  undoProjectConfirmationReview: vi.fn(),
};
const submissions = {
  submit: vi.fn(),
  withdraw: vi.fn(),
};
const responses = {
  receive: vi.fn(),
  addArtifacts: vi.fn(),
  downloadArtifact: vi.fn(),
  withdraw: vi.fn(),
};
const uploads = { createFromUpload: vi.fn() };

function createController() {
  return new ProjectsController(
    projects as never,
    confirmations as never,
    submissions as never,
    responses as never,
    uploads as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );
}

describe(ProjectsController, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes the EMP project CRUD and placement endpoints", async () => {
    const controller = createController();
    const user = { id: "partner-1", globalRole: "PARTNER" } as never;
    const source = { channel: "web" } as never;
    const createInput = {
      name: "EMP project",
      projectCode: "EMP-2026-AUD",
      language: "zh-CN",
      applicableAccountingStandard: "HKFRS",
      yearEndDate: "2026-12-31",
      reportDate: "2027-03-31",
      archiveDeadline: "2027-06-29",
    };
    const updateInput = {
      name: "EMP project revised",
      projectCode: "EMP-2026-AUD",
      yearEndDate: "2026-12-31",
      reportDate: "2027-03-31",
      archiveDeadline: "2027-06-29",
    };
    projects.create.mockResolvedValue({ id: "project-1" });
    projects.list.mockResolvedValue([{ id: "project-1" }]);
    projects.listDeleted.mockResolvedValue([{ id: "deleted-project-1" }]);
    projects.get.mockResolvedValue({ id: "project-1" });
    projects.archiveCheck.mockResolvedValue({ project: { id: "project-1" }, ready: true });
    projects.update.mockResolvedValue({ id: "project-1", name: updateInput.name });
    projects.movePlacement.mockResolvedValue({ id: "project-1", folderId: "folder-1" });
    projects.deleteProject.mockResolvedValue({ id: "project-1", status: "DELETED" });
    projects.restoreProject.mockResolvedValue({ id: "project-1", status: "ACTIVE" });

    await controller.create(createInput, user, source);
    await controller.list(user);
    await controller.listDeleted(user);
    await controller.get("project-1", user);
    await controller.archiveCheck("project-1", user);
    await controller.update("project-1", updateInput, user, source);
    await controller.movePlacement("project-1", { folderId: "folder-1" }, user, source);
    await controller.deleteProject("project-1", user, source);
    await controller.restoreProject("project-1", user, source);

    expect(projects.create).toHaveBeenCalledWith(createInput, user, source);
    expect(projects.list).toHaveBeenCalledWith(user);
    expect(projects.listDeleted).toHaveBeenCalledWith(user);
    expect(projects.get).toHaveBeenCalledWith("project-1", user);
    expect(projects.archiveCheck).toHaveBeenCalledWith("project-1", user);
    expect(projects.update).toHaveBeenCalledWith("project-1", updateInput, user, source);
    expect(projects.movePlacement).toHaveBeenCalledWith(
      "project-1",
      user,
      { folderId: "folder-1" },
      source
    );
    expect(projects.deleteProject).toHaveBeenCalledWith("project-1", user, source);
    expect(projects.restoreProject).toHaveBeenCalledWith("project-1", user, source);
  });

  it("rejects invalid EMP create, update, and placement payloads", () => {
    const controller = createController();
    const user = { id: "partner-1", globalRole: "PARTNER" } as never;
    const source = { channel: "web" } as never;

    expect(() => controller.create({ name: "" }, user, source)).toThrow(
      "项目信息不完整或格式无效"
    );
    expect(() => controller.update("project-1", {}, user, source)).toThrow(
      "椤圭洰淇℃伅涓嶅畬鏁存垨鏍煎紡鏃犳晥"
    );
    expect(() => controller.movePlacement("project-1", {}, user, source)).toThrow(
      "Folder 信息无效"
    );
  });

  it("parses and submits confirmation drafts without dispatch execution fields", async () => {
    const controller = createController();
    const input = {
      expectedDraftUpdatedAt: "2026-07-11T08:00:00.000Z",
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
    };
    const currentUser = { id: "user-1" } as never;
    const auditSource = { ipAddress: "127.0.0.1" } as never;

    await controller.submitConfirmation(
      "project-1",
      "confirmation-1",
      input,
      currentUser,
      auditSource
    );

    expect(submissions.submit).toHaveBeenCalledWith(
      "project-1",
      "confirmation-1",
      input,
      currentUser,
      auditSource
    );

    expect(() =>
      controller.submitConfirmation(
        "project-1",
        "confirmation-1",
        { ...input, courierName: "Injected courier", trackingNumber: "X" },
        currentUser,
        auditSource
      )
    ).toThrow("函证提交信息不完整或格式无效");
  });

  it("routes project confirmation defaults and rejects unknown fields", async () => {
    const controller = createController();
    const user = { id: "user-1" } as never;
    const source = { ipAddress: "127.0.0.1" } as never;
    confirmations.getProjectConfirmationDefaults.mockResolvedValue({
      projectId: "project-1",
      clientName: null,
      confirmationDate: null,
      reference: null,
      pic: null,
      mic: null,
      reportDate: null,
      updatedAt: null,
    });
    confirmations.updateProjectConfirmationDefaults.mockResolvedValue({
      id: "defaults-1",
      projectId: "project-1",
    });
    const input = {
      baseInformation: { clientNames: [], references: [], banks: [], customFields: [{ id: "department-1", name: "Contact department", value: "Audit team" }] },
      clientName: "Orchid Holdings",
      confirmationDate: "2026-12-31",
      reference: "REF-001",
      pic: "Bonnie Su",
      mic: "Michael Chan",
      reportDate: "2026-08-15",
    };

    await controller.getConfirmationDefaults("project-1", user);
    await controller.updateConfirmationDefaults(
      "project-1",
      input,
      user,
      source
    );

    expect(confirmations.getProjectConfirmationDefaults).toHaveBeenCalledWith(
      "project-1",
      user
    );
    expect(
      confirmations.updateProjectConfirmationDefaults
    ).toHaveBeenCalledWith("project-1", input, user, source);
    expect(() =>
      controller.updateConfirmationDefaults(
        "project-1",
        { ...input, unsupported: "value" },
        user,
        source
      )
    ).toThrow("函证通用填写信息不完整或格式无效");
  });

  it("routes uploaded confirmation documents with their selected type", async () => {
    const controller = createController();
    const file = {
      buffer: Buffer.from("%PDF-1.4"),
      mimetype: "application/pdf",
      originalname: "lawyer.pdf",
      size: 8,
    };
    const user = { id: "user-1" } as never;
    const source = { ipAddress: "127.0.0.1" } as never;

    await controller.uploadConfirmation(
      "project-1",
      { type: "LAWYER", counterpartyName: "Example law firm" },
      file,
      user,
      source
    );

    expect(uploads.createFromUpload).toHaveBeenCalledWith(
      "project-1",
      "LAWYER",
      "Example law firm",
      file,
      user,
      source
    );
  });

  it("routes supplementary confirmation response files", async () => {
    const controller = createController();
    const files = [
      {
        buffer: Buffer.from("image"),
        mimetype: "image/png",
        originalname: "page-2.png",
        size: 5,
      },
    ];
    const user = { id: "user-1" } as never;
    const source = { ipAddress: "127.0.0.1" } as never;

    await controller.addConfirmationResponseArtifacts(
      "project-1",
      "confirmation-1",
      "response-1",
      files,
      user,
      source
    );

    expect(responses.addArtifacts).toHaveBeenCalledWith(
      "project-1",
      "confirmation-1",
      "response-1",
      files,
      user,
      source
    );
  });

  it("parses received confirmation metadata and routes the scanned response", async () => {
    const controller = createController();
    const file = {
      buffer: Buffer.from("%PDF-1.4"),
      mimetype: "application/pdf",
      originalname: "bank-response.pdf",
      size: 8,
    };
    const input = {
      responseChannel: "PAPER",
      receivedAt: "2026-07-17T08:30:00.000Z",
      responseReference: "MAILROOM-42",
      notes: "Original response received by post",
    };
    const user = { id: "user-1" } as never;
    const source = { ipAddress: "127.0.0.1" } as never;

    await controller.receiveConfirmationResponse(
      "project-1",
      "confirmation-1",
      input,
      [file],
      user,
      source
    );

    expect(responses.receive).toHaveBeenCalledWith(
      "project-1",
      "confirmation-1",
      input,
      [file],
      user,
      source
    );
  });

  it("routes confirmation response withdrawals", async () => {
    const controller = createController();
    const user = { id: "user-1" } as never;
    const source = { ipAddress: "127.0.0.1" } as never;

    await controller.withdrawConfirmationResponse(
      "project-1",
      "confirmation-1",
      "response-1",
      user,
      source
    );

    expect(responses.withdraw).toHaveBeenCalledWith(
      "project-1",
      "confirmation-1",
      "response-1",
      user,
      source
    );
  });

  it("parses and routes confirmation response reviews", async () => {
    const controller = createController();
    const input = {
      result: "MISMATCHED",
      action: "ALTERNATIVE_PROCEDURE",
      notes: "Use the bank statement as an alternative procedure",
    };
    const user = { id: "user-1" } as never;
    const source = { ipAddress: "127.0.0.1" } as never;

    await controller.reviewConfirmationResponse(
      "project-1",
      "confirmation-1",
      input,
      user,
      source
    );

    expect(
      confirmations.reviewProjectConfirmationResponse
    ).toHaveBeenCalledWith("project-1", "confirmation-1", input, user, source);
  });

  it("routes legacy redispatch editing", async () => {
    const controller = createController();
    const user = { id: "user-1" } as never;
    const source = { ipAddress: "127.0.0.1" } as never;

    await controller.startConfirmationRedispatchEditing(
      "project-1",
      "confirmation-1",
      user,
      source
    );

    expect(confirmations.startRedispatchEditing).toHaveBeenCalledWith(
      "project-1",
      "confirmation-1",
      user,
      source
    );
  });

  it("routes optional confirmation dispatch attachment uploads", async () => {
    const controller = createController();
    const file = {
      buffer: Buffer.from("scan"),
      mimetype: "application/pdf",
      originalname: "sent.pdf",
      size: 4,
    };
    const user = { id: "user-1" } as never;
    const source = { ipAddress: "127.0.0.1" } as never;

    await controller.uploadConfirmationDispatchAttachment(
      "project-1",
      "confirmation-1",
      "dispatch-1",
      file,
      user,
      source
    );

    expect(confirmations.uploadDispatchAttachment).toHaveBeenCalledWith(
      "project-1",
      "confirmation-1",
      "dispatch-1",
      file,
      user,
      source
    );
  });

  it("routes confirmation recycle-bin actions without a request body", async () => {
    const controller = createController();
    const user = { id: "user-1" } as never;
    const source = { ipAddress: "127.0.0.1" } as never;

    await controller.voidConfirmation(
      "project-1",
      "confirmation-1",
      user,
      source
    );
    await controller.restoreConfirmation(
      "project-1",
      "confirmation-1",
      user,
      source
    );

    expect(confirmations.voidProjectConfirmation).toHaveBeenCalledWith(
      "project-1",
      "confirmation-1",
      user,
      source
    );
    expect(confirmations.restoreProjectConfirmation).toHaveBeenCalledWith(
      "project-1",
      "confirmation-1",
      user,
      source
    );
  });

  it("routes confirmation review rollback without a request body", async () => {
    const controller = createController();
    const user = { id: "user-1" } as never;
    const source = { ipAddress: "127.0.0.1" } as never;

    await controller.undoConfirmationReview(
      "project-1",
      "confirmation-1",
      user,
      source
    );

    expect(confirmations.undoProjectConfirmationReview).toHaveBeenCalledWith(
      "project-1",
      "confirmation-1",
      user,
      source
    );
  });

  it("parses confirmation withdrawals", async () => {
    const controller = createController();
    const input = {
      idempotencyKey: "00000000-0000-4000-8000-000000000002",
      reason: "Recipient details need revision",
    };
    const currentUser = { id: "user-1" } as never;
    const auditSource = { ipAddress: "127.0.0.1" } as never;

    await controller.withdrawConfirmation(
      "project-1",
      "confirmation-1",
      input,
      currentUser,
      auditSource
    );

    expect(submissions.withdraw).toHaveBeenCalledWith(
      "project-1",
      "confirmation-1",
      input,
      currentUser,
      auditSource
    );
  });

  it("returns generated confirmation previews from a local absolute path", async () => {
    const tempDir = await mkdtemp(
      pathModule.join(tmpdir(), "project-wing-preview-")
    );
    try {
      const previewPath = pathModule.join(tempDir, "preview.pdf");
      const previewBody = Buffer.from("%PDF-1.4 preview");
      await writeFile(previewPath, previewBody);
      confirmations.previewPdfForProject.mockResolvedValue({
        absolutePath: previewPath,
        fileName: "confirmation-preview.pdf",
        mimeType: "application/pdf",
      });
      const response = {
        type: vi.fn(),
        setHeader: vi.fn(),
        send: vi.fn(),
        redirect: vi.fn(),
        sendFile: vi.fn(),
      };
      const controller = createController();
      const user = { id: "partner-1", globalRole: "PARTNER" } as never;

      await controller.previewConfirmationPdf(
        "project-1",
        "confirmation-1",
        user,
        response as never
      );

      expect(confirmations.previewPdfForProject).toHaveBeenCalledWith(
        "project-1",
        "confirmation-1",
        user
      );
      expect(response.type).toHaveBeenCalledWith("application/pdf");
      expect(response.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        "inline; filename=\"confirmation-preview.pdf\"; filename*=UTF-8''confirmation-preview.pdf"
      );
      expect(response.send).toHaveBeenCalledWith(previewBody);
      expect(response.sendFile).not.toHaveBeenCalled();
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("returns a DOCX fallback preview as a safe attachment", async () => {
    const body = Buffer.from("PK docx preview");
    confirmations.previewDocxForProject.mockResolvedValue({
      body,
      fileName: "confirmation-preview.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const response = {
      type: vi.fn(),
      setHeader: vi.fn(),
      send: vi.fn(),
    };
    const user = { id: "user-1" } as never;

    await createController().previewConfirmationDocx(
      "project-1",
      "confirmation-1",
      user,
      response as never
    );

    expect(confirmations.previewDocxForProject).toHaveBeenCalledWith(
      "project-1",
      "confirmation-1",
      user
    );
    expect(response.type).toHaveBeenCalledWith("application/octet-stream");
    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      "attachment; filename=\"confirmation-preview.docx\"; filename*=UTF-8''confirmation-preview.docx"
    );
    expect(response.send).toHaveBeenCalledWith(body);
  });

  it("passes the current draft payload to the PDF download route", async () => {
    const body = Buffer.from("%PDF-1.4 filled");
    const input = {
      draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
      draftPayload: { bankName: "Edited bank" },
    };
    confirmations.previewPdfForProject.mockResolvedValue({
      body,
      fileName: "confirmation.pdf",
      mimeType: "application/pdf",
    });
    const response = {
      type: vi.fn(),
      setHeader: vi.fn(),
      send: vi.fn(),
    };
    const user = { id: "user-1" } as never;

    await createController().downloadConfirmationPdf(
      "project-1",
      "confirmation-1",
      input,
      user,
      response as never
    );

    expect(confirmations.previewPdfForProject).toHaveBeenCalledWith(
      "project-1",
      "confirmation-1",
      user,
      { ...input, patchSource: "MANUAL" }
    );
    expect(response.send).toHaveBeenCalledWith(body);
  });

  it("passes the current draft payload to the DOCX download route", async () => {
    const body = Buffer.from("PK filled docx");
    const input = {
      draftTemplateCode: "CTPL-123456789ABC",
      draftPayload: {
        bankName: "Edited bank",
        templateFieldValues: { reference: "Download value" },
      },
    };
    confirmations.previewDocxForProject.mockResolvedValue({
      body,
      fileName: "confirmation.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const response = {
      type: vi.fn(),
      setHeader: vi.fn(),
      send: vi.fn(),
    };
    const user = { id: "user-1" } as never;

    await createController().downloadConfirmationDocx(
      "project-1",
      "confirmation-1",
      input,
      user,
      response as never
    );

    expect(confirmations.previewDocxForProject).toHaveBeenCalledWith(
      "project-1",
      "confirmation-1",
      user,
      { ...input, patchSource: "MANUAL" }
    );
    expect(response.send).toHaveBeenCalledWith(body);
  });

  it.each([
    {
      fileName: "payload.html",
      mimeType: "text/html",
      body: Buffer.from("<script>same-origin-risk</script>"),
    },
    {
      fileName: "diagram.svg",
      mimeType: "image/svg+xml",
      body: Buffer.from('<svg onload="same-origin-risk" />'),
    },
    {
      fileName: "unknown.bin",
      mimeType: "application/x-unknown-document",
      body: Buffer.from("opaque bytes"),
    },
  ])(
    "downloads a $mimeType source as an attachment with a safe MIME",
    async ({ fileName, mimeType, body }) => {
      confirmations.previewPdfForProject.mockResolvedValue({
        body,
        fileName,
        mimeType,
      });
      const response = {
        type: vi.fn(),
        setHeader: vi.fn(),
        send: vi.fn(),
      };

      await createController().previewConfirmationPdf(
        "project-1",
        "confirmation-1",
        { id: "user-1" } as never,
        response as never
      );

      expect(response.type).toHaveBeenCalledWith("application/octet-stream");
      expect(response.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        expect.stringMatching(
          new RegExp(`^attachment;.*${fileName.replace(".", String.raw`\.`)}`)
        )
      );
      expect(response.setHeader.mock.calls[0][1]).not.toContain("inline");
      expect(response.setHeader).toHaveBeenCalledWith(
        "X-Content-Type-Options",
        "nosniff"
      );
      expect(response.send).toHaveBeenCalledWith(body);
    }
  );

  it("keeps a non-PDF preview redirect as a safe attachment", async () => {
    const redirectUrl = "https://oss.example/signed/confirmation.msg";
    confirmations.previewPdfForProject.mockResolvedValue({
      redirectUrl,
      fileName: "confirmation.msg",
      mimeType: "application/vnd.ms-outlook",
    });
    const response = {
      type: vi.fn(),
      setHeader: vi.fn(),
      redirect: vi.fn(),
    };

    await createController().previewConfirmationPdf(
      "project-1",
      "confirmation-1",
      { id: "user-1" } as never,
      response as never
    );

    expect(response.type).toHaveBeenCalledWith("application/octet-stream");
    expect(response.setHeader).toHaveBeenNthCalledWith(
      1,
      "Content-Disposition",
      expect.stringMatching(/^attachment;.*confirmation\.msg/)
    );
    expect(response.setHeader).toHaveBeenNthCalledWith(
      2,
      "X-Content-Type-Options",
      "nosniff"
    );
    expect(response.redirect).toHaveBeenCalledWith(302, redirectUrl);
    expect(
      Math.max(...response.setHeader.mock.invocationCallOrder)
    ).toBeLessThan(response.redirect.mock.invocationCallOrder[0]);
  });

  it("keeps a PDF preview redirect inline", async () => {
    const redirectUrl = "https://oss.example/signed/confirmation.pdf";
    confirmations.previewPdfForProject.mockResolvedValue({
      redirectUrl,
      fileName: "confirmation.pdf",
      mimeType: "application/pdf",
    });
    const response = {
      type: vi.fn(),
      setHeader: vi.fn(),
      redirect: vi.fn(),
    };

    await createController().previewConfirmationPdf(
      "project-1",
      "confirmation-1",
      { id: "user-1" } as never,
      response as never
    );

    expect(response.type).toHaveBeenCalledWith("application/pdf");
    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      expect.stringMatching(/^inline;.*confirmation\.pdf/)
    );
    expect(response.setHeader).not.toHaveBeenCalledWith(
      "X-Content-Type-Options",
      "nosniff"
    );
    expect(response.redirect).toHaveBeenCalledWith(302, redirectUrl);
    expect(
      Math.max(...response.setHeader.mock.invocationCallOrder)
    ).toBeLessThan(response.redirect.mock.invocationCallOrder[0]);
  });

  it("serves response scans with a header-safe UTF-8 file name", async () => {
    const expectedFileName = "银行回函扫描件.pdf";
    const mojibakeFileName = Buffer.from(expectedFileName, "utf-8").toString(
      "latin1"
    );
    const body = Buffer.from("%PDF-1.4 response");
    responses.downloadArtifact.mockResolvedValue({
      body,
      fileName: mojibakeFileName,
      mimeType: "application/pdf",
    });
    const response = {
      type: vi.fn(),
      setHeader: vi.fn(),
      send: vi.fn(),
    };
    const controller = createController();

    await controller.downloadConfirmationResponseArtifact(
      "project-1",
      "confirmation-1",
      "response-1",
      "artifact-1",
      { id: "user-1" } as never,
      response as never
    );

    expect(response.type).toHaveBeenCalledWith("application/pdf");
    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      "inline; filename=\"_______.pdf\"; filename*=UTF-8''%E9%93%B6%E8%A1%8C%E5%9B%9E%E5%87%BD%E6%89%AB%E6%8F%8F%E4%BB%B6.pdf"
    );
    expect(response.send).toHaveBeenCalledWith(body);
  });

  it("starts archive check jobs for the current user", async () => {
    projects.startArchiveCheckJob.mockResolvedValue({
      jobId: "archive-job-1",
      projectId: "project-1",
      status: "queued",
    });
    const controller = createController();
    const user = { id: "partner-1", globalRole: "PARTNER" } as never;

    await expect(
      controller.startArchiveCheckJob("project-1", user)
    ).resolves.toStrictEqual(
      expect.objectContaining({
        jobId: "archive-job-1",
        status: "queued",
      })
    );

    expect(projects.startArchiveCheckJob).toHaveBeenCalledWith(
      "project-1",
      user
    );
  });

  it("returns archive check job snapshots for the current user", async () => {
    projects.archiveCheckJob.mockResolvedValue({
      jobId: "archive-job-1",
      projectId: "project-1",
      status: "running",
    });
    const controller = createController();
    const user = { id: "partner-1", globalRole: "PARTNER" } as never;

    await expect(
      controller.archiveCheckJob("project-1", "archive-job-1", user)
    ).resolves.toStrictEqual(
      expect.objectContaining({
        jobId: "archive-job-1",
        status: "running",
      })
    );

    expect(projects.archiveCheckJob).toHaveBeenCalledWith(
      "project-1",
      "archive-job-1",
      user
    );
  });

  it("starts archive jobs for the current user", async () => {
    projects.startArchiveJob.mockResolvedValue({
      jobId: "archive-job-1",
      projectId: "project-1",
      status: "queued",
    });
    const controller = createController();
    const user = { id: "partner-1", globalRole: "PARTNER" } as never;
    const source = { channel: "web" } as never;

    await expect(
      controller.startArchiveJob("project-1", user, source)
    ).resolves.toStrictEqual(
      expect.objectContaining({
        jobId: "archive-job-1",
        status: "queued",
      })
    );

    expect(projects.startArchiveJob).toHaveBeenCalledWith(
      "project-1",
      user,
      source
    );
  });

  it("returns archive job snapshots for the current user", async () => {
    projects.archiveJob.mockResolvedValue({
      jobId: "archive-job-1",
      projectId: "project-1",
      status: "completed",
    });
    const controller = createController();
    const user = { id: "partner-1", globalRole: "PARTNER" } as never;

    await expect(
      controller.archiveJob("project-1", "archive-job-1", user)
    ).resolves.toStrictEqual(
      expect.objectContaining({
        jobId: "archive-job-1",
        status: "completed",
      })
    );

    expect(projects.archiveJob).toHaveBeenCalledWith(
      "project-1",
      "archive-job-1",
      user
    );
  });

  it("streams archive job snapshots as server-sent events", async () => {
    const unsubscribe = vi.fn();
    projects.archiveJob.mockResolvedValue({
      jobId: "archive-job-1",
      projectId: "project-1",
      status: "running",
    });
    projects.subscribeArchiveJob.mockImplementation(
      (
        jobId: string,
        listener: (job: { jobId: string; status: string }) => void
      ) => {
        listener({ jobId, status: "completed" });
        return unsubscribe;
      }
    );
    const controller = createController();
    const user = { id: "partner-1", globalRole: "PARTNER" } as never;
    const closeHandlers: (() => void)[] = [];
    const response: {
      setHeader: Mock;
      flushHeaders: Mock;
      write: Mock;
      end: Mock;
      on: Mock;
    } = {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      on: vi.fn((event: string, handler: () => void) => {
        if (event === "close") {
          closeHandlers.push(handler);
        }
        return response;
      }),
    };

    await controller.archiveJobEvents(
      "project-1",
      "archive-job-1",
      user,
      response as never
    );

    expect(projects.archiveJob).toHaveBeenCalledWith(
      "project-1",
      "archive-job-1",
      user
    );
    expect(projects.subscribeArchiveJob).toHaveBeenCalledWith(
      "archive-job-1",
      expect.any(Function)
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "text/event-stream"
    );
    expect(response.write).toHaveBeenCalledWith(
      expect.stringContaining('"status":"running"')
    );
    expect(response.write).toHaveBeenCalledWith(
      expect.stringContaining('"status":"completed"')
    );
    expect(response.end).toHaveBeenCalledWith();

    closeHandlers.forEach((handler) => handler());

    expect(unsubscribe).toHaveBeenCalledWith();
  });

  it("replays the latest archive job after subscribing", async () => {
    const unsubscribe = vi.fn();
    projects.archiveJob
      .mockResolvedValueOnce({
        jobId: "archive-job-1",
        projectId: "project-1",
        status: "running",
        updatedAt: "2026-06-20T10:00:00.000Z",
      })
      .mockResolvedValueOnce({
        jobId: "archive-job-1",
        projectId: "project-1",
        status: "completed",
        updatedAt: "2026-06-20T10:00:01.000Z",
      });
    projects.subscribeArchiveJob.mockReturnValue(unsubscribe);
    const controller = createController();
    const user = { id: "partner-1", globalRole: "PARTNER" } as never;
    const response = {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      on: vi.fn().mockReturnThis(),
    };

    await controller.archiveJobEvents(
      "project-1",
      "archive-job-1",
      user,
      response as never
    );

    expect(response.write).toHaveBeenCalledWith(
      expect.stringContaining('"status":"running"')
    );
    expect(response.write).toHaveBeenCalledWith(
      expect.stringContaining('"status":"completed"')
    );
    expect(response.end).toHaveBeenCalledWith();
    expect(unsubscribe).toHaveBeenCalledWith();
  });

  it("returns archive artifacts for the current user", async () => {
    projects.archiveArtifact.mockResolvedValue({
      id: "artifact-1",
      projectId: "project-1",
      fileName: "archive.zip",
    });
    const controller = createController();
    const user = { id: "partner-1", globalRole: "PARTNER" } as never;

    await expect(
      controller.archiveArtifact("project-1", user)
    ).resolves.toStrictEqual(
      expect.objectContaining({
        id: "artifact-1",
        fileName: "archive.zip",
      })
    );

    expect(projects.archiveArtifact).toHaveBeenCalledWith("project-1", user);
  });

  it("returns roll-forward previews for archived source projects", async () => {
    projects.rollForwardPreview.mockResolvedValue({
      project: { id: "project-1", status: "ARCHIVED" },
      summary: {
        workflowNodes: 3,
        workingPapers: 2,
        attachments: 2,
        attachmentVersions: 4,
        smartForms: 1,
      },
    });
    const controller = createController();
    const user = { id: "partner-1", globalRole: "PARTNER" } as never;

    await expect(
      controller.rollForwardPreview("project-1", user)
    ).resolves.toStrictEqual(
      expect.objectContaining({
        summary: expect.objectContaining({ attachmentVersions: 4 }),
      })
    );

    expect(projects.rollForwardPreview).toHaveBeenCalledWith("project-1", user);
  });

  it("routes reversible CMP unlinking through the project relationship", async () => {
    projects.unlinkEngagement.mockResolvedValue({
      id: "project-1",
      projectCode: "DUMMY-EMP-1000027",
      cmpEngagementId: null,
    });
    const controller = createController();
    const user = { id: "manager-1", globalRole: "MANAGER" } as never;
    const source = { channel: "web" } as never;

    await expect(
      controller.unlinkEngagement("project-1", user, source)
    ).resolves.toMatchObject({
      projectCode: "DUMMY-EMP-1000027",
      cmpEngagementId: null,
    });

    expect(projects.unlinkEngagement).toHaveBeenCalledWith(
      "project-1",
      user,
      source
    );
  });

  it("submits projects for archive review through both archive entrypoints", async () => {
    projects.submitArchive.mockResolvedValue({
      id: "project-1",
      status: "PENDING_FINAL_CHECK",
    });
    const controller = createController();
    const user = { id: "partner-1", globalRole: "PARTNER" } as never;
    const source = { channel: "web" } as never;

    await expect(
      controller.archive("project-1", user, source)
    ).resolves.toStrictEqual(
      expect.objectContaining({ status: "PENDING_FINAL_CHECK" })
    );
    await expect(
      controller.archiveExplicit("project-1", user, source)
    ).resolves.toStrictEqual(
      expect.objectContaining({ status: "PENDING_FINAL_CHECK" })
    );

    expect(projects.submitArchive).toHaveBeenCalledWith(
      "project-1",
      user,
      source
    );
    expect(projects.submitArchive).toHaveBeenCalledTimes(2);
  });

  it("exposes reopen and confirm archive routes", async () => {
    projects.reopen.mockResolvedValue({ id: "project-1", status: "ACTIVE" });
    projects.confirmArchive.mockResolvedValue({
      jobId: "archive-job-1",
      projectId: "project-1",
      status: "queued",
    });
    const controller = createController();
    const user = { id: "admin-1", globalRole: "SUPER_ADMIN" } as never;
    const source = { channel: "web" } as never;

    await expect(
      controller.reopen("project-1", {}, user, source)
    ).resolves.toStrictEqual(expect.objectContaining({ status: "ACTIVE" }));
    await expect(
      controller.confirmArchive("project-1", user, source)
    ).resolves.toStrictEqual(
      expect.objectContaining({ jobId: "archive-job-1" })
    );

    expect(projects.reopen).toHaveBeenCalledWith("project-1", user, source);
    expect(projects.confirmArchive).toHaveBeenCalledWith(
      "project-1",
      user,
      source
    );
  });
});
