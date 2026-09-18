import { SKIP_DECLARATION_GATE_KEY } from "../auth/declaration-gate.decorator";
import { GLOBAL_ROLES_KEY } from "../auth/global-roles.decorator";
import { KnowledgeController } from "./knowledge.controller";

describe(KnowledgeController, () => {
  it("requires login without applying the EMP declaration gate", () => {
    expect(
      Reflect.getMetadata(SKIP_DECLARATION_GATE_KEY, KnowledgeController)
    ).toBeTruthy();
  });

  it("restricts the upload route to administrators and partners", () => {
    const roles = Reflect.getMetadata(
      GLOBAL_ROLES_KEY,
      KnowledgeController.prototype.upload
    );
    expect(roles).toStrictEqual(["SUPER_ADMIN", "PARTNER"]);
  });

  it.each(["update", "archive", "restore", "remove", "listArchived"] as const)(
    "restricts the %s route to administrators and partners",
    (method) => {
      const roles = Reflect.getMetadata(
        GLOBAL_ROLES_KEY,
        KnowledgeController.prototype[method]
      );
      expect(roles).toStrictEqual(["SUPER_ADMIN", "PARTNER"]);
    }
  );

  it("passes Portal Office uploads to the service", async () => {
    const uploaded = { id: "doc-1", downloadUrl: "/download" };
    const knowledge = { upload: vi.fn().mockResolvedValue(uploaded) };
    const controller = new KnowledgeController(knowledge as never);
    const body = {
      referenceCode: "ADM-001",
      title: "Administration guide",
      department: "admin",
      type: "guide",
    };
    const file = {
      originalname: "guide.docx",
      mimetype:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 4,
      buffer: Buffer.from("PK\u0003\u0004"),
    };
    const user = {
      id: "partner-1",
      email: "partner@example.com",
      name: "Pat Partner",
      globalRole: "PARTNER" as const,
    };
    const source = { ipAddress: "127.0.0.1" };

    await expect(controller.upload(body, file, user, source)).resolves.toBe(
      uploaded
    );
    expect(knowledge.upload).toHaveBeenCalledWith(body, file, user, source);
  });

  it("serves preview inline and download as an attachment", async () => {
    const knowledge = {
      getFile: vi.fn().mockResolvedValue({
        fileName: "技术更新.pdf",
        mimeType: "application/pdf",
        body: Buffer.from("%PDF-file"),
        etag: 'W/"document-v1"',
      }),
    };
    const controller = new KnowledgeController(knowledge as never);
    const response = {
      type: vi.fn(),
      setHeader: vi.fn(),
      send: vi.fn(),
    };

    await controller.preview("doc-1", response as never);
    expect(response.setHeader).toHaveBeenLastCalledWith(
      "Content-Disposition",
      expect.stringMatching(/^inline;/)
    );

    await controller.download("doc-1", response as never);
    expect(response.setHeader).toHaveBeenLastCalledWith(
      "Content-Disposition",
      expect.stringMatching(/^attachment;/)
    );
    expect(response.send).toHaveBeenCalledWith(Buffer.from("%PDF-file"));
  });

  it("serves an embedded notice attachment inline only when preview is allowed", async () => {
    const knowledge = {
      getAttachment: vi.fn().mockResolvedValue({
        fileName: "示例报表.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        body: Buffer.from("workbook"),
        etag: 'W/"attachment-v1"',
      }),
    };
    const controller = new KnowledgeController(knowledge as never);
    const response = {
      type: vi.fn(),
      setHeader: vi.fn(),
      send: vi.fn(),
    };

    await controller.previewAttachment("attachment-1", response as never);

    expect(knowledge.getAttachment).toHaveBeenCalledWith(
      "attachment-1",
      "preview"
    );

    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      expect.stringMatching(/^inline;/)
    );
    expect(response.send).toHaveBeenCalledWith(Buffer.from("workbook"));
  });
});
