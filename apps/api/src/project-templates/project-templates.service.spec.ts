import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import pathModule from "node:path";

import { path7za } from "7zip-bin";
import { Prisma } from "@prisma/client";
import JSZip from "jszip";

import { ProjectTemplatesService } from "./project-templates.service";

const prisma = {
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
  projectTemplate: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  projectTemplateNode: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn(),
  },
  projectTemplateFile: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn(),
    update: vi.fn(),
  },
  projectTemplateSmartForm: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn(),
    update: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
  },
  smartFormTemplateVersion: {
    findFirst: vi.fn(),
  },
  workflowNode: {
    findFirst: vi.fn(),
  },
  workingPaper: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  attachment: {
    create: vi.fn(),
    update: vi.fn(),
  },
  attachmentVersion: {
    create: vi.fn(),
  },
  frameworkTemplate: {
    findFirst: vi.fn(),
  },
};
const storage = {
  putProjectTemplateFile: vi.fn(),
  getObjectMetadata: vi.fn(),
  getObjectBuffer: vi.fn(),
  copyObjectToWorkingPaper: vi.fn(),
};
const access = {
  requireProjectRole: vi.fn(),
  requireProjectAction: vi.fn(),
};
const auditLogs = {
  log: vi.fn(),
};
const smartForms = {
  createProjectSmartForm: vi.fn(),
};

describe(ProjectTemplatesService, () => {
  beforeEach(() => {
    vi.resetAllMocks();
    access.requireProjectAction.mockResolvedValue({ projectRole: "PREPARER" });
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
  });

  it("creates a project template repository for super admins", async () => {
    prisma.frameworkTemplate.findFirst.mockResolvedValue({
      id: "framework-cas",
    });
    prisma.projectTemplate.create.mockResolvedValue({
      id: "template-1",
      code: "CAS-EMPTY",
      name: "CAS empty shell",
    });
    const service = new ProjectTemplatesService(
      prisma as never,
      storage as never
    );

    await service.create(
      {
        code: "CAS-EMPTY",
        name: "CAS empty shell",
        language: "zh-CN",
        frameworkTemplateId: "framework-cas",
        description: "",
        status: "DRAFT",
      },
      { id: "admin-1", globalRole: "SUPER_ADMIN" } as never
    );

    expect(prisma.projectTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "CAS-EMPTY",
          name: "CAS empty shell",
          language: "zh-CN",
          frameworkTemplateId: "framework-cas",
          status: "DRAFT",
          createdBy: "admin-1",
        }),
      })
    );
  });

  it("returns uploaded template file content for preview", async () => {
    prisma.projectTemplate.findFirst.mockResolvedValue({ id: "template-1" });
    prisma.projectTemplateFile.findFirst.mockResolvedValue({
      fileName: "cash.xlsx",
      originalName: "现金.xlsx",
      fileUrl: "project-templates/template-1/cash.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      placeholderType: null,
    });
    storage.getObjectBuffer.mockResolvedValue(Buffer.from("xlsx-content"));
    const service = new ProjectTemplatesService(
      prisma as never,
      storage as never
    );

    await expect(
      service.previewFile("template-1", "file-1", {
        id: "admin-1",
        globalRole: "SUPER_ADMIN",
      } as never)
    ).resolves.toStrictEqual({
      body: Buffer.from("xlsx-content"),
      fileName: "现金.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    expect(storage.getObjectBuffer).toHaveBeenCalledWith(
      "project-templates/template-1/cash.xlsx"
    );
  });

  it("lists published project templates without language or standard gates", async () => {
    prisma.projectTemplate.findMany.mockResolvedValue([]);
    const service = new ProjectTemplatesService(
      prisma as never,
      storage as never
    );

    await service.list({
      language: "zh-CN",
      frameworkTemplateId: "framework-cas",
    });

    expect(prisma.projectTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PUBLISHED" },
      })
    );
  });

  it("creates child template folders beyond the third level", async () => {
    prisma.projectTemplate.findFirst.mockResolvedValue({
      id: "template-1",
      code: "CAS-EMPTY",
    });
    prisma.projectTemplateNode.findFirst.mockResolvedValue({
      id: "node-a1-1000",
      projectTemplateId: "template-1",
      code: "A1-1000",
      title: "Cash",
      level: 3,
    });
    prisma.projectTemplateNode.aggregate.mockResolvedValue({
      _max: { sortOrder: 2 },
    });
    prisma.projectTemplateNode.create.mockResolvedValue({
      id: "node-a1-1000-01",
      projectTemplateId: "template-1",
      parentId: "node-a1-1000",
      code: "A1-1000-01",
      title: "Bank reconciliation",
      level: 4,
    });
    const service = new ProjectTemplatesService(
      prisma as never,
      storage as never
    );

    await service.createNode(
      "template-1",
      {
        parentId: "node-a1-1000",
        code: "A1-1000-01",
        title: "Bank reconciliation",
      },
      { id: "admin-1", globalRole: "SUPER_ADMIN" } as never
    );

    expect(prisma.projectTemplateNode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        parentId: "node-a1-1000",
        code: "A1-1000-01",
        title: "Bank reconciliation",
        level: 4,
        nodeType: "WORKING_PAPER",
        sortOrder: 3,
      }),
    });
  });

  it("uploads a real template file under a template folder at unknown level", async () => {
    prisma.projectTemplate.findFirst.mockResolvedValue({
      id: "template-1",
      code: "CAS-EMPTY",
    });
    prisma.projectTemplateNode.findFirst.mockResolvedValue({
      id: "node-a1-1000-sub",
      projectTemplateId: "template-1",
      code: "A1-1000-01",
      title: "Cash",
      level: 4,
    });
    prisma.projectTemplateFile.aggregate.mockResolvedValue({
      _max: { sortOrder: 2 },
    });
    storage.putProjectTemplateFile.mockResolvedValue({
      fileName: "stored.xlsx",
      objectKey: "project-templates/template-1/node-a1-1000-sub/stored.xlsx",
    });
    prisma.projectTemplateFile.create.mockResolvedValue({
      id: "template-file-1",
    });
    const service = new ProjectTemplatesService(
      prisma as never,
      storage as never
    );

    await service.uploadFile(
      "template-1",
      "node-a1-1000-sub",
      {
        code: "A1-1000-01-F003",
        title: "Bank confirmation.xlsx",
      },
      {
        originalname: "Bank confirmation.xlsx",
        mimetype:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: 4096,
        buffer: Buffer.from("xlsx"),
      },
      { id: "admin-1", globalRole: "SUPER_ADMIN" } as never
    );

    expect(storage.putProjectTemplateFile).toHaveBeenCalledWith(
      "template-1",
      "node-a1-1000-sub",
      "Bank confirmation.xlsx",
      Buffer.from("xlsx"),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(prisma.projectTemplateFile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectTemplateId: "template-1",
        templateNodeId: "node-a1-1000-sub",
        code: "A1-1000-01-F003",
        title: "Bank confirmation.xlsx",
        fileName: "Bank confirmation.xlsx",
        originalName: "Bank confirmation.xlsx",
        fileUrl: "project-templates/template-1/node-a1-1000-sub/stored.xlsx",
        fileSize: 4096,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        paperType: "WORKING_PAPER",
        sortOrder: 3,
      }),
    });
  });

  it("creates a numbered leave-blank under a template folder", async () => {
    prisma.projectTemplate.findFirst.mockResolvedValue({
      id: "template-1",
      code: "CAS-EMPTY",
    });
    prisma.projectTemplateNode.findFirst.mockResolvedValue({
      id: "node-1000",
      projectTemplateId: "template-1",
      code: "1000",
      title: "Planning",
      level: 1,
    });
    prisma.projectTemplateFile.aggregate.mockResolvedValue({
      _max: { sortOrder: 2 },
    });
    prisma.projectTemplateSmartForm.aggregate.mockResolvedValue({
      _max: { sortOrder: 1 },
    });
    prisma.projectTemplateFile.create.mockResolvedValue({
      id: "template-placeholder-1",
    });
    const service = new ProjectTemplatesService(
      prisma as never,
      storage as never
    );

    await service.createPlaceholder(
      "template-1",
      "node-1000",
      {
        code: "1000.7",
        title: "Client representation",
        placeholderType: "GENERIC",
      },
      { id: "admin-1", globalRole: "SUPER_ADMIN" } as never
    );

    expect(prisma.projectTemplateFile.create).toHaveBeenCalledWith({
      data: {
        projectTemplateId: "template-1",
        templateNodeId: "node-1000",
        code: "1000.7",
        title: "Client representation",
        fileName: "Client representation",
        originalName: "Client representation",
        fileUrl: "",
        fileSize: 0,
        mimeType: "application/octet-stream",
        placeholderType: "GENERIC",
        paperType: "WORKING_PAPER",
        sortOrder: 3,
      },
    });
  });

  it("adds published Smart Form references under a template folder", async () => {
    prisma.projectTemplate.findFirst.mockResolvedValue({
      id: "template-1",
      code: "CAS-EMPTY",
    });
    prisma.projectTemplateNode.findFirst.mockResolvedValue({
      id: "node-a1-1000",
      projectTemplateId: "template-1",
      code: "1100",
      title: "Cash",
      level: 3,
    });
    prisma.smartFormTemplateVersion.findFirst.mockResolvedValue({
      id: "sf-version-1",
      templateId: "sf-template-1",
      version: 1,
      template: {
        id: "sf-template-1",
        code: "INDEP",
        name: "Independence checklist",
      },
    });
    prisma.projectTemplateSmartForm.aggregate.mockResolvedValue({
      _max: { sortOrder: 2 },
    });
    prisma.projectTemplateFile.aggregate.mockResolvedValue({
      _max: { sortOrder: 5 },
    });
    prisma.projectTemplateSmartForm.create.mockResolvedValue({
      id: "template-smart-form-1",
      code: "1100.6",
      title: "Independence checklist",
      fileName: "Independence checklist.sf",
    });
    const service = new ProjectTemplatesService(
      prisma as never,
      storage as never
    );

    await service.createSmartFormReference(
      "template-1",
      "node-a1-1000",
      { smartFormTemplateVersionId: "sf-version-1" },
      { id: "admin-1", globalRole: "SUPER_ADMIN" } as never
    );

    expect(prisma.projectTemplateSmartForm.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectTemplateId: "template-1",
        templateNodeId: "node-a1-1000",
        smartFormTemplateId: "sf-template-1",
        smartFormTemplateVersionId: "sf-version-1",
        code: "1100.6",
        title: "Independence checklist",
        fileName: "Independence checklist.sf",
        sortOrder: 6,
      }),
      include: expect.any(Object),
    });
    expect(prisma.$executeRaw).toHaveBeenCalledOnce();
  });

  it("updates a template file numeric suffix under the folder lock", async () => {
    prisma.projectTemplate.findFirst.mockResolvedValue({ id: "template-1" });
    prisma.projectTemplateFile.findFirst
      .mockResolvedValueOnce({ templateNodeId: "node-3200" })
      .mockResolvedValueOnce({ id: "file-1" })
      .mockResolvedValueOnce(null);
    prisma.projectTemplateSmartForm.findFirst.mockResolvedValue(null);
    prisma.projectTemplateNode.findFirst.mockResolvedValue({
      id: "node-3200",
      code: "3200",
    });
    prisma.projectTemplateFile.update.mockResolvedValue({
      id: "file-1",
      code: "3200.8",
    });
    const service = new ProjectTemplatesService(
      prisma as never,
      storage as never
    );

    await service.updateFileCode("template-1", "file-1", { sequence: 8 }, {
      id: "admin-1",
      globalRole: "SUPER_ADMIN",
    } as never);

    expect(prisma.projectTemplateFile.update).toHaveBeenCalledWith({
      where: { id: "file-1" },
      data: { code: "3200.8" },
    });
    expect(prisma.$executeRaw).toHaveBeenCalledOnce();
  });

  it("rejects a Smart Form code already used by a file", async () => {
    prisma.projectTemplate.findFirst.mockResolvedValue({ id: "template-1" });
    prisma.projectTemplateSmartForm.findFirst
      .mockResolvedValueOnce({ templateNodeId: "node-3200" })
      .mockResolvedValueOnce({ id: "sf-1" })
      .mockResolvedValueOnce(null);
    prisma.projectTemplateFile.findFirst.mockResolvedValue({ id: "file-2" });
    prisma.projectTemplateNode.findFirst.mockResolvedValue({
      id: "node-3200",
      code: "3200",
    });
    const service = new ProjectTemplatesService(
      prisma as never,
      storage as never
    );

    await expect(
      service.updateSmartFormReferenceCode(
        "template-1",
        "sf-1",
        { sequence: 2 },
        { id: "admin-1", globalRole: "SUPER_ADMIN" } as never
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "DUPLICATE_CODE" }),
    });
  });

  it("reorders mixed template items with temporary then continuous codes", async () => {
    prisma.projectTemplate.findFirst.mockResolvedValue({ id: "template-1" });
    prisma.projectTemplateNode.findFirst.mockResolvedValue({
      id: "node-3200",
      code: "3200",
    });
    prisma.projectTemplateFile.findMany.mockResolvedValue([{ id: "file-1" }]);
    prisma.projectTemplateSmartForm.findMany.mockResolvedValue([
      { id: "sf-1" },
    ]);
    prisma.projectTemplateFile.update
      .mockResolvedValueOnce({ id: "file-1" })
      .mockResolvedValueOnce({ id: "file-1", code: "3200.2", sortOrder: 2 });
    prisma.projectTemplateSmartForm.update
      .mockResolvedValueOnce({ id: "sf-1" })
      .mockResolvedValueOnce({ id: "sf-1", code: "3200.1", sortOrder: 1 });
    const service = new ProjectTemplatesService(
      prisma as never,
      storage as never
    );

    const result = await service.reorderItems(
      "template-1",
      "node-3200",
      {
        items: [
          { type: "SMART_FORM", id: "sf-1" },
          { type: "FILE", id: "file-1" },
        ],
      },
      { id: "admin-1", globalRole: "SUPER_ADMIN" } as never
    );

    expect(result.items).toStrictEqual([
      expect.objectContaining({ type: "SMART_FORM", code: "3200.1" }),
      expect.objectContaining({ type: "FILE", code: "3200.2" }),
    ]);
    expect(prisma.projectTemplateSmartForm.update).toHaveBeenNthCalledWith(1, {
      where: { id: "sf-1" },
      data: { code: "__projectwing_order__sf-1" },
    });
  });

  it("rejects item reordering for a nonnumeric template folder", async () => {
    prisma.projectTemplate.findFirst.mockResolvedValue({ id: "template-1" });
    prisma.projectTemplateNode.findFirst.mockResolvedValue({
      id: "node-audit",
      code: "AUD",
    });
    const service = new ProjectTemplatesService(
      prisma as never,
      storage as never
    );

    await expect(
      service.reorderItems(
        "template-1",
        "node-audit",
        { items: [{ type: "FILE", id: "file-1" }] },
        { id: "admin-1", globalRole: "SUPER_ADMIN" } as never
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "PROJECT_TEMPLATE_INVALID" }),
    });
  });

  it("does not update folders on archived project templates", async () => {
    prisma.projectTemplate.findFirst.mockResolvedValue(null);
    prisma.projectTemplateNode.findFirst.mockResolvedValue({
      id: "node-a1-1000",
      projectTemplateId: "template-1",
      code: "A1-1000",
      title: "Cash",
      level: 3,
    });
    const service = new ProjectTemplatesService(
      prisma as never,
      storage as never
    );

    await expect(
      service.updateNode("template-1", "node-a1-1000", { code: "A1-2000" }, {
        id: "admin-1",
        globalRole: "SUPER_ADMIN",
      } as never)
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "PROJECT_TEMPLATE_NOT_FOUND" }),
    });
    expect(prisma.projectTemplateNode.update).not.toHaveBeenCalled();
  });

  it("does not delete folders on archived project templates", async () => {
    prisma.projectTemplate.findFirst.mockResolvedValue(null);
    prisma.projectTemplateNode.findFirst.mockResolvedValue({
      id: "node-a1-1000",
      projectTemplateId: "template-1",
      code: "A1-1000",
      title: "Cash",
      level: 3,
    });
    const service = new ProjectTemplatesService(
      prisma as never,
      storage as never
    );

    await expect(
      service.deleteNode("template-1", "node-a1-1000", {
        id: "admin-1",
        globalRole: "SUPER_ADMIN",
      } as never)
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "PROJECT_TEMPLATE_NOT_FOUND" }),
    });
    expect(prisma.projectTemplateNode.delete).not.toHaveBeenCalled();
  });

  it("returns a duplicate code error for duplicate sibling folders", async () => {
    prisma.projectTemplate.findFirst.mockResolvedValue({
      id: "template-1",
      code: "CAS-EMPTY",
    });
    prisma.projectTemplateNode.aggregate.mockResolvedValue({
      _max: { sortOrder: 1 },
    });
    prisma.projectTemplateNode.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    );
    const service = new ProjectTemplatesService(
      prisma as never,
      storage as never
    );

    await expect(
      service.createNode(
        "template-1",
        { parentId: "", code: "Planning", title: "Planning" },
        { id: "admin-1", globalRole: "SUPER_ADMIN" } as never
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "DUPLICATE_CODE" }),
    });
  });

  it("returns a duplicate code error for duplicate template files", async () => {
    prisma.projectTemplate.findFirst.mockResolvedValue({
      id: "template-1",
      code: "CAS-EMPTY",
    });
    prisma.projectTemplateNode.findFirst.mockResolvedValue({
      id: "node-a1-1000",
      projectTemplateId: "template-1",
      code: "A1-1000",
      title: "Cash",
      level: 3,
    });
    prisma.projectTemplateFile.aggregate.mockResolvedValue({
      _max: { sortOrder: 2 },
    });
    storage.putProjectTemplateFile.mockResolvedValue({
      fileName: "stored.xlsx",
      objectKey: "project-templates/template-1/node-a1-1000/stored.xlsx",
    });
    prisma.projectTemplateFile.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    );
    const service = new ProjectTemplatesService(
      prisma as never,
      storage as never
    );

    await expect(
      service.uploadFile(
        "template-1",
        "node-a1-1000",
        { code: "A1-1000-F003", title: "Bank confirmation.xlsx" },
        {
          originalname: "Bank confirmation.xlsx",
          mimetype:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          size: 4096,
          buffer: Buffer.from("xlsx"),
        },
        { id: "admin-1", globalRole: "SUPER_ADMIN" } as never
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "DUPLICATE_CODE" }),
    });
  });

  it("preserves the original file name when confirming a direct template file upload", async () => {
    prisma.projectTemplate.findFirst.mockResolvedValue({
      id: "template-1",
      code: "CAS-EMPTY",
    });
    prisma.projectTemplateNode.findFirst.mockResolvedValue({
      id: "node-a1-1000",
      projectTemplateId: "template-1",
      code: "1100",
      title: "Cash",
      level: 3,
    });
    prisma.projectTemplateFile.aggregate.mockResolvedValue({
      _max: { sortOrder: 0 },
    });
    storage.getObjectMetadata.mockResolvedValue({
      contentLength: 4096,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    prisma.projectTemplateFile.create.mockResolvedValue({
      id: "template-file-1",
    });
    const service = new ProjectTemplatesService(
      prisma as never,
      storage as never
    );

    await service.confirmFileUpload(
      "template-1",
      "node-a1-1000",
      {
        fileName: "Bank confirmation.xlsx",
        fileSize: 4096,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        objectKey:
          "project-templates/template-1/node-a1-1000/1781449969273-87910c38-7f13-45e6-8286-c951f9c43df9.xlsx",
      },
      { id: "admin-1", globalRole: "SUPER_ADMIN" } as never
    );

    expect(prisma.projectTemplateFile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: "1100.1",
        title: "Bank confirmation.xlsx",
        fileName: "Bank confirmation.xlsx",
        originalName: "Bank confirmation.xlsx",
        fileUrl:
          "project-templates/template-1/node-a1-1000/1781449969273-87910c38-7f13-45e6-8286-c951f9c43df9.xlsx",
      }),
    });
  });

  it("imports a new project template from a zip archive", async () => {
    const zip = new JSZip();
    zip.file("新阶段/A1/A1-1000/现金底稿.xlsx", Buffer.from("xlsx"));
    zip.file("新阶段/A1/A1-1000/银行询证函.pdf", Buffer.from("pdf"));
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    prisma.frameworkTemplate.findFirst.mockResolvedValue({
      id: "framework-cas",
    });
    prisma.projectTemplate.create.mockResolvedValue({
      id: "template-import",
      code: "TMP-IMPORT",
      name: "Imported template",
    });
    prisma.projectTemplateNode.create.mockImplementation(({ data }) => ({
      id: `node-${data.code}`,
      ...data,
    }));
    storage.putProjectTemplateFile.mockImplementation(
      (
        templateId: string,
        nodeId: string,
        originalName: string,
        body: Buffer
      ) => ({
        fileName: `stored-${originalName}`,
        objectKey: `project-templates/${templateId}/${nodeId}/stored-${originalName}`,
        fileSize: body.length,
      })
    );
    prisma.projectTemplateFile.create.mockImplementation(({ data }) => ({
      id: `file-${data.code}`,
      ...data,
    }));
    prisma.projectTemplate.findFirst.mockResolvedValue({
      id: "template-import",
      code: "TMP-IMPORT",
      name: "Imported template",
      nodes: [],
    });
    const service = new ProjectTemplatesService(
      prisma as never,
      storage as never
    );

    await service.importZip(
      {
        code: "TMP-IMPORT",
        name: "Imported template",
        language: "zh-CN",
        frameworkTemplateId: "framework-cas",
      },
      {
        originalname: "template.zip",
        mimetype: "application/zip",
        size: buffer.length,
        buffer,
      },
      { id: "admin-1", globalRole: "SUPER_ADMIN" } as never
    );

    expect(prisma.projectTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "TMP-IMPORT",
          name: "Imported template",
          language: "zh-CN",
          frameworkTemplateId: "framework-cas",
          status: "DRAFT",
          createdBy: "admin-1",
        }),
      })
    );
    expect(prisma.projectTemplateNode.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        projectTemplateId: "template-import",
        parentId: null,
        code: "新阶段",
        title: "新阶段",
        level: 1,
        nodeType: "PHASE",
        sortOrder: 1,
      }),
    });
    expect(prisma.projectTemplateNode.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        parentId: "node-新阶段",
        code: "A1",
        title: "A1",
        level: 2,
        nodeType: "ACCOUNT",
        sortOrder: 1,
      }),
    });
    expect(prisma.projectTemplateNode.create).toHaveBeenNthCalledWith(3, {
      data: expect.objectContaining({
        parentId: "node-A1",
        code: "A1-1000",
        title: "A1-1000",
        level: 3,
        nodeType: "WORKING_PAPER",
        sortOrder: 1,
      }),
    });
    expect(storage.putProjectTemplateFile).toHaveBeenCalledWith(
      "template-import",
      "node-A1-1000",
      "现金底稿.xlsx",
      Buffer.from("xlsx"),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(prisma.projectTemplateFile.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        projectTemplateId: "template-import",
        templateNodeId: "node-A1-1000",
        code: "A1-1000-F001",
        title: "现金底稿.xlsx",
        fileName: "现金底稿.xlsx",
        originalName: "现金底稿.xlsx",
        fileSize: 4,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        paperType: "WORKING_PAPER",
        sortOrder: 1,
      }),
    });
    expect(prisma.projectTemplateFile.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        code: "A1-1000-F002",
        title: "银行询证函.pdf",
        fileSize: 3,
        mimeType: "application/pdf",
        sortOrder: 2,
      }),
    });
  });

  it("wraps root-level archive files in an auto-created folder", async () => {
    const zip = new JSZip();
    zip.file("那文件的修改日期如何处理.docx", Buffer.from("docx"));
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    prisma.frameworkTemplate.findFirst.mockResolvedValue({
      id: "framework-cas",
    });
    prisma.projectTemplate.create.mockResolvedValue({
      id: "template-import",
      code: "TMP-IMPORT",
      name: "Imported template",
    });
    prisma.projectTemplateNode.create.mockImplementation(({ data }) => ({
      id: `node-${data.code}`,
      ...data,
    }));
    storage.putProjectTemplateFile.mockResolvedValue({
      fileName: "stored.docx",
      objectKey: "project-templates/template-import/node/that-file.docx",
      fileSize: 4,
    });
    prisma.projectTemplateFile.create.mockImplementation(({ data }) => ({
      id: `file-${data.code}`,
      ...data,
    }));
    prisma.projectTemplate.findFirst.mockResolvedValue({
      id: "template-import",
      code: "TMP-IMPORT",
      name: "Imported template",
      nodes: [],
    });
    const service = new ProjectTemplatesService(
      prisma as never,
      storage as never
    );

    await service.importZip(
      {
        code: "TMP-IMPORT",
        name: "Imported template",
        language: "zh-CN",
        frameworkTemplateId: "framework-cas",
      },
      {
        originalname: "template.zip",
        mimetype: "application/zip",
        size: buffer.length,
        buffer,
      },
      { id: "admin-1", globalRole: "SUPER_ADMIN" } as never
    );

    expect(prisma.projectTemplateNode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectTemplateId: "template-import",
        parentId: null,
        code: "Imported template",
        title: "Imported template",
        level: 1,
        nodeType: "PHASE",
        sortOrder: 1,
      }),
    });
    expect(prisma.projectTemplateFile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        templateNodeId: "node-Imported template",
        code: "Imported template-F001",
        title: "那文件的修改日期如何处理.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    });
  });

  it("imports an archive that contains folders without files", async () => {
    const zip = new JSZip();
    zip.folder("Planning");
    zip.folder("Planning/A1");
    zip.folder("Planning/A1/A1-1000");
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    prisma.frameworkTemplate.findFirst.mockResolvedValue({
      id: "framework-cas",
    });
    prisma.projectTemplate.create.mockResolvedValue({
      id: "template-import",
      code: "TMP-IMPORT",
      name: "Imported template",
    });
    prisma.projectTemplateNode.create.mockImplementation(({ data }) => ({
      id: `node-${data.code}`,
      ...data,
    }));
    prisma.projectTemplate.findFirst.mockResolvedValue({
      id: "template-import",
      code: "TMP-IMPORT",
      name: "Imported template",
      nodes: [],
    });
    const service = new ProjectTemplatesService(
      prisma as never,
      storage as never
    );

    await service.importZip(
      {
        code: "TMP-IMPORT",
        name: "Imported template",
        language: "zh-CN",
        frameworkTemplateId: "framework-cas",
      },
      {
        originalname: "template.zip",
        mimetype: "application/zip",
        size: buffer.length,
        buffer,
      },
      { id: "admin-1", globalRole: "SUPER_ADMIN" } as never
    );

    expect(prisma.projectTemplateNode.create).toHaveBeenCalledTimes(3);
    expect(prisma.projectTemplateNode.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        parentId: null,
        code: "Planning",
        title: "Planning",
        level: 1,
        nodeType: "PHASE",
      }),
    });
    expect(prisma.projectTemplateNode.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        parentId: "node-Planning",
        code: "A1",
        title: "A1",
        level: 2,
        nodeType: "ACCOUNT",
      }),
    });
    expect(prisma.projectTemplateNode.create).toHaveBeenNthCalledWith(3, {
      data: expect.objectContaining({
        parentId: "node-A1",
        code: "A1-1000",
        title: "A1-1000",
        level: 3,
        nodeType: "WORKING_PAPER",
      }),
    });
    expect(prisma.projectTemplateFile.create).not.toHaveBeenCalled();
    expect(storage.putProjectTemplateFile).not.toHaveBeenCalled();
  });

  it("keeps imported folder codes compact while storing descriptive titles", async () => {
    const zip = new JSZip();
    zip.folder("Planning");
    zip.folder("Planning/A1- Client acceptance or continuance");
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    prisma.frameworkTemplate.findFirst.mockResolvedValue({
      id: "framework-cas",
    });
    prisma.projectTemplate.create.mockResolvedValue({
      id: "template-import",
      code: "TMP-IMPORT",
      name: "Imported template",
    });
    prisma.projectTemplateNode.create.mockImplementation(({ data }) => ({
      id: `node-${data.code}`,
      ...data,
    }));
    prisma.projectTemplate.findFirst.mockResolvedValue({
      id: "template-import",
      code: "TMP-IMPORT",
      name: "Imported template",
      nodes: [],
    });
    const service = new ProjectTemplatesService(
      prisma as never,
      storage as never
    );

    await service.importZip(
      {
        code: "TMP-IMPORT",
        name: "Imported template",
        language: "en-US",
        frameworkTemplateId: "framework-cas",
      },
      {
        originalname: "template.zip",
        mimetype: "application/zip",
        size: buffer.length,
        buffer,
      },
      { id: "admin-1", globalRole: "SUPER_ADMIN" } as never
    );

    expect(prisma.projectTemplateNode.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        parentId: "node-Planning",
        code: "A1",
        title: "Client acceptance or continuance",
        level: 2,
        nodeType: "ACCOUNT",
      }),
    });
  });

  it("imports a new project template from a 7z archive", async () => {
    const tempDir = mkdtempSync(
      pathModule.join(tmpdir(), "projectwing-template-7z-")
    );
    try {
      const sourcePath = pathModule.join(tempDir, "现金底稿.xlsx");
      const archivePath = pathModule.join(tempDir, "template.7z");
      writeFileSync(sourcePath, Buffer.from("xlsx"));
      if (process.platform !== "win32") {
        chmodSync(path7za, 0o755);
      }
      execFileSync(path7za, ["a", "-t7z", archivePath, "现金底稿.xlsx"], {
        cwd: tempDir,
        stdio: "ignore",
      });
      const buffer = readFileSync(archivePath);
      prisma.frameworkTemplate.findFirst.mockResolvedValue({
        id: "framework-cas",
      });
      prisma.projectTemplate.create.mockResolvedValue({
        id: "template-import",
        code: "TMP-IMPORT",
        name: "Imported template",
      });
      prisma.projectTemplateNode.create.mockImplementation(({ data }) => ({
        id: `node-${data.code}`,
        ...data,
      }));
      storage.putProjectTemplateFile.mockResolvedValue({
        fileName: "stored.xlsx",
        objectKey: "project-templates/template-import/node/file.xlsx",
        fileSize: 4,
      });
      prisma.projectTemplateFile.create.mockImplementation(({ data }) => ({
        id: `file-${data.code}`,
        ...data,
      }));
      prisma.projectTemplate.findFirst.mockResolvedValue({
        id: "template-import",
        code: "TMP-IMPORT",
        name: "Imported template",
        nodes: [],
      });
      const service = new ProjectTemplatesService(
        prisma as never,
        storage as never
      );

      await service.importZip(
        {
          code: "TMP-IMPORT",
          name: "Imported template",
          language: "zh-CN",
          frameworkTemplateId: "framework-cas",
        },
        {
          originalname: "template.7z",
          mimetype: "application/x-7z-compressed",
          size: buffer.length,
          buffer,
        },
        { id: "admin-1", globalRole: "SUPER_ADMIN" } as never
      );

      expect(prisma.projectTemplateFile.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: "现金底稿.xlsx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it.each([false, true])(
    "applies selected template files as independent copies (existing: %s)",
    async (alreadyImported) => {
      access.requireProjectRole.mockResolvedValue({ projectRole: "PREPARER" });
      prisma.project.findUnique.mockResolvedValue({
        id: "project-1",
        language: "zh-CN",
      });
      prisma.projectTemplate.findFirst.mockResolvedValue({
        id: "template-1",
        code: "CAS-EMPTY",
        name: "CAS empty shell",
        language: "en-US",
        frameworkTemplateId: "framework-ifrs",
        nodes: [
          {
            id: "template-node-a1",
            projectTemplateId: "template-1",
            parentId: null,
            level: 4,
            code: "A1-1000-01",
            title: "Cash",
            sortOrder: 1,
            nodeType: "WORKING_PAPER",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            files: [
              {
                id: "template-file-1",
                projectTemplateId: "template-1",
                templateNodeId: "template-node-a1",
                code: "A1-1000-01-F001",
                title: "Bank confirmation.xlsx",
                fileName: "stored.xlsx",
                originalName: "Bank confirmation.xlsx",
                fileUrl:
                  "project-templates/template-1/template-node-a1/stored.xlsx",
                fileSize: 4096,
                mimeType:
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                paperType: "WORKING_PAPER",
                sortOrder: 1,
                templateItemId: "library-source-1",
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                updatedAt: new Date("2026-01-01T00:00:00.000Z"),
              },
            ],
          },
        ],
      });
      prisma.workflowNode.findFirst.mockResolvedValue({
        id: "node-a1-1000-01",
        code: "A1-1000-01",
        title: "Cash",
        level: 4,
        project: {
          id: "project-1",
          language: "zh-CN",
          frameworkTemplateId: "framework-cas",
        },
      });
      prisma.workingPaper.findMany.mockResolvedValue(
        alreadyImported
          ? [
              {
                id: "existing-paper",
                code: "A1-1000-01-F001",
                title: "Bank confirmation.xlsx",
                paperType: "WORKING_PAPER",
                bucket: "CURRENT",
                templateItemId: "library-source-1",
              },
            ]
          : []
      );
      prisma.workingPaper.create.mockResolvedValue({
        id: "paper-1",
        code: "A1-1000-01-F001",
        title: "Bank confirmation.xlsx",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
      });
      storage.copyObjectToWorkingPaper.mockResolvedValue({
        fileName: "copied.xlsx",
        objectKey: "projects/project-1/paper-1/copied.xlsx",
      });
      prisma.attachment.create.mockResolvedValue({ id: "attachment-1" });
      prisma.attachmentVersion.create.mockResolvedValue({ id: "version-1" });
      prisma.attachment.update.mockResolvedValue({
        id: "attachment-1",
        projectId: "project-1",
        workingPaperId: "paper-1",
        fileKind: "SUPPORTING",
        fileName: "copied.xlsx",
        originalName: "Bank confirmation.xlsx",
        fileUrl: "projects/project-1/paper-1/copied.xlsx",
        fileSize: 4096,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headVersionId: "version-1",
      });
      const service = new ProjectTemplatesService(
        prisma as never,
        storage as never,
        access as never,
        auditLogs as never
      );
      const result = await service.applyToProject(
        "project-1",
        "template-1",
        {
          workflowNodeId: "node-a1-1000-01",
          bucket: "CURRENT",
          selectedTemplateFileIds: ["template-file-1"],
          referenceCodeOverrides: [
            { itemId: "template-file-1", code: "A1-1000-01-F009" },
          ],
        },
        { id: "admin-1", globalRole: "SUPER_ADMIN" } as never
      );

      expect(access.requireProjectRole).toHaveBeenCalledWith(
        "project-1",
        "admin-1",
        "PREPARER"
      );
      expect(prisma.workingPaper.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: "project-1",
          workflowNodeId: "node-a1-1000-01",
          code: "A1-1000-01-F009",
          title: "Bank confirmation.xlsx",
          paperType: "WORKING_PAPER",
          bucket: "CURRENT",
          createdBy: "admin-1",
          templateItemId: null,
        }),
      });
      expect(storage.copyObjectToWorkingPaper).toHaveBeenCalledWith(
        "project-1",
        "paper-1",
        "Bank confirmation.xlsx",
        "project-templates/template-1/template-node-a1/stored.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      expect(prisma.attachment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: "project-1",
          workingPaperId: "paper-1",
          fileKind: "SUPPORTING",
          fileName: "copied.xlsx",
          originalName: "Bank confirmation.xlsx",
          fileUrl: "projects/project-1/paper-1/copied.xlsx",
          templateItemId: "library-source-1",
          fileSize: 4096,
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          uploadedBy: "admin-1",
        }),
        include: expect.any(Object),
      });
      expect(prisma.attachmentVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          attachmentId: "attachment-1",
          projectId: "project-1",
          version: 1,
          action: "INITIAL",
          isCurrent: true,
        }),
      });
      expect(result.plan.summary.create).toBe(1);
      expect(result.plan.summary.existing).toBe(0);
      expect(result.skippedTemplateFileIds).toStrictEqual([]);
      prisma.workingPaper.findMany.mockResolvedValue([{ code: "1000.4" }]);
      const numericPreview = await service.previewApplyToProject(
        "project-1",
        "template-1",
        {
          workflowNodeId: "node-a1-1000-01",
          selectedTemplateFileIds: ["template-file-1"],
          referenceCodeOverrides: [
            { itemId: "template-file-1", code: "1000.5" },
          ],
        },
        { id: "admin-1", globalRole: "SUPER_ADMIN" } as never
      );
      expect(numericPreview.plan.items[0].plannedCode).toBe("1000.5");
      prisma.workingPaper.findMany.mockResolvedValue([
        { code: "A1-1000-01-F001" },
      ]);
      await expect(
        service.previewApplyToProject(
          "project-1",
          "template-1",
          {
            workflowNodeId: "node-a1-1000-01",
            selectedTemplateFileIds: ["template-file-1"],
            referenceCodeOverrides: [
              { itemId: "template-file-1", code: "A1-1000-01-F001" },
            ],
          },
          { id: "admin-1", globalRole: "SUPER_ADMIN" } as never
        )
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "DUPLICATE_CODE" }),
      });
      expect(result.createdWorkingPapers).toHaveLength(1);
      expect(result.createdWorkingPapers[0]).toStrictEqual(
        expect.objectContaining({
          attachments: [
            expect.objectContaining({
              id: "attachment-1",
              workingPaperId: "paper-1",
              originalName: "Bank confirmation.xlsx",
            }),
          ],
        })
      );
    }
  );

  it("plans file and Smart Form reference codes in their unified sort order", async () => {
    prisma.projectTemplate.findFirst.mockResolvedValue({
      id: "template-1",
      nodes: [
        {
          id: "template-node-3200",
          files: [
            {
              id: "file-1",
              templateNodeId: "template-node-3200",
              code: "3200.2",
              title: "Audit programme",
              originalName: "Audit programme.xlsx",
              paperType: "WORKING_PAPER",
              sortOrder: 2,
            },
          ],
          smartForms: [
            {
              id: "sf-1",
              templateNodeId: "template-node-3200",
              smartFormTemplateVersionId: "sf-version-1",
              code: "3200.1",
              title: "Deferred income",
              fileName: "Deferred income.sf",
              sortOrder: 1,
            },
          ],
        },
      ],
    });
    prisma.workflowNode.findFirst.mockResolvedValue({
      id: "target-node-3200",
      code: "3200",
      title: "Deferred income",
      level: 3,
    });
    prisma.workingPaper.findMany.mockResolvedValue([]);
    const service = new ProjectTemplatesService(
      prisma as never,
      storage as never,
      access as never
    );

    const preview = await service.previewApplyToProject(
      "project-1",
      "template-1",
      {
        workflowNodeId: "target-node-3200",
        selectedTemplateFileIds: ["file-1"],
        selectedSmartFormReferenceIds: ["sf-1"],
      },
      { id: "admin-1", globalRole: "SUPER_ADMIN" } as never
    );

    expect(preview.plan.smartFormItems[0].plannedCode).toBe("3200.1");
    expect(preview.plan.items[0].plannedCode).toBe("3200.2");
  });

  it.each([false, true])(
    "applies Smart Form references as independent copies (existing: %s)",
    async (alreadyImported) => {
      access.requireProjectRole.mockResolvedValue({ projectRole: "PREPARER" });
      prisma.projectTemplate.findFirst.mockResolvedValue({
        id: "template-1",
        code: "CAS-EMPTY",
        name: "CAS empty shell",
        language: "en-US",
        frameworkTemplateId: "framework-ifrs",
        nodes: [
          {
            id: "template-node-a1",
            projectTemplateId: "template-1",
            parentId: null,
            level: 4,
            code: "A1-1000-01",
            title: "Cash",
            sortOrder: 1,
            nodeType: "WORKING_PAPER",
            files: [],
            smartForms: [
              {
                id: "template-smart-form-1",
                projectTemplateId: "template-1",
                templateNodeId: "template-node-a1",
                smartFormTemplateId: "sf-template-1",
                smartFormTemplateVersionId: "sf-version-1",
                code: "A1-1000-01-F001",
                title: "Independence checklist",
                fileName: "Independence checklist.sf",
                sortOrder: 1,
              },
            ],
          },
        ],
      });
      prisma.workflowNode.findFirst.mockResolvedValue({
        id: "node-a1-1000-01",
        code: "A1-1000-01",
        title: "Cash",
        level: 4,
      });
      prisma.workingPaper.findMany.mockResolvedValue(
        alreadyImported
          ? [
              {
                id: "existing-smart-form",
                code: "A1-1000-01-F001",
                title: "Independence checklist.sf",
                paperType: "WORKING_PAPER",
                bucket: "CURRENT",
                templateItemId: null,
              },
            ]
          : []
      );
      smartForms.createProjectSmartForm.mockResolvedValue({
        id: "smart-form-attachment-1",
        fileKind: "SMART_FORM",
        originalName: "Independence checklist.sf",
      });
      const service = new ProjectTemplatesService(
        prisma as never,
        storage as never,
        access as never,
        auditLogs as never,
        smartForms as never
      );
      const result = await service.applyToProject(
        "project-1",
        "template-1",
        {
          workflowNodeId: "node-a1-1000-01",
          selectedSmartFormReferenceIds: ["template-smart-form-1"],
        },
        { id: "admin-1", globalRole: "SUPER_ADMIN" } as never
      );

      expect(smartForms.createProjectSmartForm).toHaveBeenCalledWith(
        "project-1",
        "node-a1-1000-01",
        {
          smartFormTemplateVersionId: "sf-version-1",
          code: alreadyImported ? "A1-1000-01-F002" : "A1-1000-01-F001",
          title: "Independence checklist.sf",
          language: "zh-CN",
        },
        { id: "admin-1", globalRole: "SUPER_ADMIN" },
        undefined
      );
      expect(result.plan.summary).toStrictEqual(
        expect.objectContaining({
          total: 1,
          files: 0,
          smartForms: 1,
          create: 1,
          createSmartForms: 1,
          existing: 0,
        })
      );
      expect(result.createdSmartForms).toStrictEqual([
        expect.objectContaining({ id: "smart-form-attachment-1" }),
      ]);
    }
  );
});
