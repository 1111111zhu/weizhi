import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";

import {
  ApiConflictException,
  ApiServiceUnavailableException,
} from "../common/api-error";
import { StorageService } from "./storage.service";

const {
  mockCompleteMultipartUpload,
  mockInitMultipartUpload,
  mockListParts,
  mockOssDelete,
  mockOssCopy,
  mockOssGet,
  mockOssHead,
  mockOssPut,
} = vi.hoisted(() => ({
  mockCompleteMultipartUpload: vi.fn(),
  mockInitMultipartUpload: vi.fn(),
  mockListParts: vi.fn(),
  mockOssDelete: vi.fn(),
  mockOssCopy: vi.fn(),
  mockOssGet: vi.fn(),
  mockOssHead: vi.fn(),
  mockOssPut: vi.fn(),
}));

vi.mock("ali-oss", () => ({
  default: vi.fn(
    class MockOss {
      signatureUrl: (
        objectKey: string,
        signOptions?: { subResource?: Record<string, unknown> }
      ) => string;
      put = mockOssPut;
      delete = mockOssDelete;
      get = mockOssGet;
      copy = mockOssCopy;
      head = mockOssHead;
      initMultipartUpload = mockInitMultipartUpload;
      listParts = mockListParts;
      completeMultipartUpload = mockCompleteMultipartUpload;

      constructor(options: Record<string, unknown>) {
        this.signatureUrl = (objectKey, signOptions) => {
          const url = new URL(
            `${String(options.endpoint ?? `https://${options.bucket}.public.example`)}/${objectKey}`
          );
          for (const [key, value] of Object.entries(
            signOptions?.subResource ?? {}
          )) {
            url.searchParams.set(key, String(value));
          }
          return url.toString();
        };
      }
    }
  ),
}));

describe(StorageService, () => {
  let uploadRoot: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockOssPut.mockReset();
    mockOssDelete.mockReset();
    mockOssCopy.mockReset();
    mockOssGet.mockReset();
    uploadRoot = await mkdtemp(
      pathModule.join(tmpdir(), "project-wing-storage-")
    );
    process.env.STORAGE_DRIVER = "local";
    process.env.UPLOAD_DIR = uploadRoot;
  });

  afterEach(async () => {
    await rm(uploadRoot, { force: true, recursive: true });
    delete process.env.STORAGE_DRIVER;
    delete process.env.UPLOAD_DIR;
    delete process.env.OSS_REGION;
    delete process.env.OSS_BUCKET;
    delete process.env.OSS_ENDPOINT;
    delete process.env.OSS_INTERNAL_ENDPOINT;
    delete process.env.OSS_USE_INTERNAL_ENDPOINT;
    delete process.env.OSS_ACCESS_KEY_ID;
    delete process.env.OSS_ACCESS_KEY_SECRET;
    delete process.env.OSS_DESKTOP_MULTIPART_THRESHOLD_BYTES;
    delete process.env.OSS_DESKTOP_MULTIPART_PART_SIZE_BYTES;
    delete process.env.OSS_DESKTOP_TRANSFER_URL_TTL_SECONDS;
  });

  it("stores local objects under a generated project object key", async () => {
    const storage = new StorageService();
    const stored = await storage.putObject(
      "project-1",
      "paper-1",
      "../trial balance.xlsx",
      Buffer.from("workpaper")
    );

    expect(stored.fileName).toMatch(/\.xlsx$/);
    expect(stored.objectKey).toMatch(
      /^working-papers\/project-1\/paper-1\/\d+-[0-9a-f-]+\.xlsx$/
    );
    await expect(
      storage.getObjectBuffer(stored.objectKey)
    ).resolves.toStrictEqual(Buffer.from("workpaper"));
  });

  it("copies local template bytes to independent objects without buffering", async () => {
    const storage = new StorageService();
    const source = await storage.putProjectTemplateFile(
      "template-1",
      "node-1",
      "source.xlsx",
      Buffer.from("template bytes")
    );
    const read = vi.spyOn(storage, "getObjectBuffer");
    const write = vi.spyOn(storage, "putObject");
    const first = await storage.copyObjectToWorkingPaper(
      "project-1",
      "paper-1",
      "copy.xlsx",
      source.objectKey
    );
    const second = await storage.copyObjectToWorkingPaper(
      "project-1",
      "paper-2",
      "copy.xlsx",
      source.objectKey
    );
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(first.objectKey).not.toBe(second.objectKey);
    await expect(
      storage.getObjectBuffer(first.objectKey)
    ).resolves.toStrictEqual(Buffer.from("template bytes"));
    await expect(
      storage.getObjectBuffer(second.objectKey)
    ).resolves.toStrictEqual(Buffer.from("template bytes"));
    await expect(
      storage.getObjectBuffer(source.objectKey)
    ).resolves.toStrictEqual(Buffer.from("template bytes"));
  });

  it("uses server-side OSS copy with source identity and MIME type, without relaying bytes", async () => {
    configureOss();
    mockOssHead.mockResolvedValue({
      res: { headers: { "content-length": "1024", etag: '"source-etag"' } },
    });
    mockOssCopy.mockResolvedValue({});
    const stored = await new StorageService().copyObjectToWorkingPaper(
      "project-1",
      "paper-1",
      "copy.xlsx",
      "project-templates/source.xlsx",
      "application/test"
    );
    expect(mockOssCopy).toHaveBeenCalledWith(
      stored.objectKey,
      "project-templates/source.xlsx",
      {
        headers: {
          "Content-Type": "application/test",
          "x-oss-forbid-overwrite": "true",
          "if-match": '"source-etag"',
        },
      }
    );
    expect(mockOssGet).not.toHaveBeenCalled();
    expect(mockOssPut).not.toHaveBeenCalled();
  });

  it("retains the existing transfer path for files beyond the simple-copy size limit", async () => {
    configureOss();
    mockOssHead.mockResolvedValue({
      res: { headers: { "content-length": String(1024 ** 3 + 1) } },
    });
    mockOssGet.mockResolvedValue({
      content: Buffer.from("synthetic large-file response"),
    });
    mockOssPut.mockResolvedValue({});
    await new StorageService().copyObjectToWorkingPaper(
      "project-1",
      "paper-1",
      "large.zip",
      "project-templates/large.zip"
    );
    expect(mockOssCopy).not.toHaveBeenCalled();
    expect(mockOssGet).toHaveBeenCalledWith("project-templates/large.zip");
    expect(mockOssPut).toHaveBeenCalledOnce();
  });

  it("does not hide OSS source or conditional-copy failures by retrying through GET/PUT", async () => {
    configureOss();
    mockOssHead.mockResolvedValue({
      res: { headers: { "content-length": "1024" } },
    });
    const failure = new Error("PreconditionFailed");
    mockOssCopy.mockRejectedValue(failure);
    await expect(
      new StorageService().copyObjectToWorkingPaper(
        "project-1",
        "paper-1",
        "copy.xlsx",
        "project-templates/source.xlsx"
      )
    ).rejects.toBe(failure);
    expect(mockOssGet).not.toHaveBeenCalled();
    expect(mockOssPut).not.toHaveBeenCalled();
  });

  it("resolves local objects from the workspace upload root when the API starts in its package directory", async () => {
    const originalCwd = process.cwd();
    const workspaceRoot = await mkdtemp(
      pathModule.join(tmpdir(), "project-wing-workspace-storage-")
    );
    const apiDirectory = pathModule.join(workspaceRoot, "apps", "api");
    const legacyObjectKey =
      "confirmation-response-library/legacy-response.docx";
    const objectKey = "confirmation-response-library/demo-response.docx";
    const objectBody = Buffer.from("workspace response");
    const legacyObjectBody = Buffer.from("legacy package response");

    try {
      await mkdir(
        pathModule.join(
          workspaceRoot,
          "uploads",
          "confirmation-response-library"
        ),
        {
          recursive: true,
        }
      );
      await mkdir(
        pathModule.join(
          apiDirectory,
          "uploads",
          "confirmation-response-library"
        ),
        {
          recursive: true,
        }
      );
      await writeFile(
        pathModule.join(workspaceRoot, "pnpm-workspace.yaml"),
        "packages: []\n"
      );
      await writeFile(
        pathModule.join(workspaceRoot, "uploads", objectKey),
        objectBody
      );
      await writeFile(
        pathModule.join(apiDirectory, "uploads", legacyObjectKey),
        legacyObjectBody
      );
      delete process.env.UPLOAD_DIR;
      process.chdir(apiDirectory);

      const storage = new StorageService();

      await expect(storage.getObjectBuffer(objectKey)).resolves.toStrictEqual(
        objectBody
      );
      await expect(
        storage.getObjectBuffer(legacyObjectKey)
      ).resolves.toStrictEqual(legacyObjectBody);
    } finally {
      process.chdir(originalCwd);
      await rm(workspaceRoot, { force: true, recursive: true });
    }
  });

  it("stores knowledge PDFs under their own local namespace", async () => {
    const storage = new StorageService();
    const stored = await storage.putKnowledgeDocument(
      "document-1",
      "technical update.pdf",
      Buffer.from("%PDF-1.7"),
      "application/pdf"
    );

    expect(stored.objectKey).toMatch(
      /^knowledge-documents\/document-1\/\d+-[0-9a-f-]+\.pdf$/
    );
    await expect(
      storage.getObjectBuffer(stored.objectKey)
    ).resolves.toStrictEqual(Buffer.from("%PDF-1.7"));
  });

  it("preserves an Office MIME type in OSS storage", async () => {
    process.env.STORAGE_DRIVER = "oss";
    process.env.OSS_REGION = "oss-cn-shenzhen";
    process.env.OSS_BUCKET = "superfx-project-wing-files";
    process.env.OSS_ENDPOINT = "https://oss-cn-shenzhen.aliyuncs.com";
    process.env.OSS_ACCESS_KEY_ID = "access-key";
    process.env.OSS_ACCESS_KEY_SECRET = "access-secret";
    mockOssPut.mockResolvedValue({});

    const stored = await new StorageService().putKnowledgeDocument(
      "document-1",
      "technical update.docx",
      Buffer.from("PK\u0003\u0004"),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    expect(stored.objectKey).toMatch(
      /^knowledge-documents\/document-1\/\d+-[0-9a-f-]+\.docx$/
    );
    expect(mockOssPut).toHaveBeenCalledWith(
      stored.objectKey,
      Buffer.from("PK\u0003\u0004"),
      {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      }
    );
  });

  it("stores local project archive packages under generated archive keys", async () => {
    const storage = new StorageService();
    const stored = await storage.putProjectArchive(
      "project-1",
      "ABC archive.zip",
      Buffer.from("archive-package"),
      "application/zip"
    );

    expect(stored.fileName).toMatch(/\.zip$/);
    expect(stored.objectKey).toMatch(
      /^project-archives\/project-1\/\d+-[0-9a-f-]+\.zip$/
    );
    await expect(
      storage.getObjectBuffer(stored.objectKey)
    ).resolves.toStrictEqual(Buffer.from("archive-package"));
  });

  it("deletes only the requested local cache prefix", async () => {
    const storage = new StorageService();
    const staleKey =
      "document-raster-previews/project-1/attachment-1/v1/page-1.png";
    const currentKey =
      "document-raster-previews/project-1/attachment-2/v1/page-1.png";
    await storage.putCacheObject(staleKey, Buffer.from("stale"));
    await storage.putCacheObject(currentKey, Buffer.from("current"));

    await storage.deleteCachePrefix(
      "document-raster-previews/project-1/attachment-1"
    );

    await expect(storage.getObjectBuffer(staleKey)).rejects.toThrow("ENOENT");
    await expect(storage.getObjectBuffer(currentKey)).resolves.toStrictEqual(
      Buffer.from("current")
    );
  });

  it("returns local download descriptors for local storage", async () => {
    const storage = new StorageService();
    const stored = await storage.putObject(
      "project-1",
      "paper-1",
      "support.pdf",
      Buffer.from("%PDF-1.4"),
      "application/pdf"
    );
    const download = storage.getDownloadObject(
      stored.objectKey,
      "support.pdf",
      "application/pdf"
    );

    expect(download).toStrictEqual({
      absolutePath: pathModule.join(uploadRoot, stored.objectKey),
      fileName: "support.pdf",
      mimeType: "application/pdf",
    });
  });

  it("stores deterministic local cache objects", async () => {
    const storage = new StorageService();

    await storage.putCacheObject(
      "document-raster-previews/project-1/attachment-1/v2/dpi-150/page-3.png",
      Buffer.from("page-image"),
      "image/png"
    );

    await expect(
      storage.getObjectBuffer(
        "document-raster-previews/project-1/attachment-1/v2/dpi-150/page-3.png"
      )
    ).resolves.toStrictEqual(Buffer.from("page-image"));
    expect(
      storage.getDownloadObject(
        "document-raster-previews/project-1/attachment-1/v2/dpi-150/page-3.png",
        "page-3.png",
        "image/png"
      )
    ).toStrictEqual({
      absolutePath: pathModule.join(
        uploadRoot,
        "document-raster-previews/project-1/attachment-1/v2/dpi-150/page-3.png"
      ),
      fileName: "page-3.png",
      mimeType: "image/png",
    });
  });

  it("reads optional cache objects without treating a cache miss as an error", async () => {
    const storage = new StorageService();
    const objectKey =
      "confirmation-preview-cache/project-1/confirmation-1/cache/document.pdf";

    await expect(storage.getCacheObjectBuffer(objectKey)).resolves.toBeNull();
    await storage.putCacheObject(objectKey, Buffer.from("%PDF-1.4 cached"));
    await expect(
      storage.getCacheObjectBuffer(objectKey)
    ).resolves.toStrictEqual(Buffer.from("%PDF-1.4 cached"));
  });

  it("does not hide non-missing storage failures during an optional cache read", async () => {
    const storage = new StorageService();
    const failure = Object.assign(new Error("access denied"), {
      code: "AccessDenied",
      status: 403,
    });
    vi.spyOn(storage, "getObjectBuffer").mockRejectedValue(failure);

    await expect(
      storage.getCacheObjectBuffer(
        "confirmation-preview-cache/project-1/confirmation-1/cache/document.pdf"
      )
    ).rejects.toBe(failure);
  });

  it("creates a local cache object once and keeps existing bytes for same or different input", async () => {
    const storage = new StorageService();
    const objectKey = "emp-import/project-1/job-1/archive.zip";
    const created = await storage.putCacheObjectIfAbsent(
      objectKey,
      Buffer.from("original-bytes"),
      "application/zip"
    );
    const sameBytes = await storage.putCacheObjectIfAbsent(
      objectKey,
      Buffer.from("original-bytes"),
      "application/zip"
    );
    const differentBytes = await storage.putCacheObjectIfAbsent(
      objectKey,
      Buffer.from("replacement-bytes"),
      "application/zip"
    );

    expect(created).toStrictEqual({
      created: true,
      fileName: "archive.zip",
      objectKey,
    });
    expect(sameBytes).toStrictEqual({
      created: false,
      fileName: "archive.zip",
      objectKey,
    });
    expect(differentBytes).toStrictEqual({
      created: false,
      fileName: "archive.zip",
      objectKey,
    });
    await expect(storage.getObjectBuffer(objectKey)).resolves.toStrictEqual(
      Buffer.from("original-bytes")
    );
  });

  it("wins exactly one local create-new race for a deterministic cache key", async () => {
    const storage = new StorageService();
    const objectKey = "emp-import/project-1/job-race/archive.zip";
    const attempts = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        storage.putCacheObjectIfAbsent(
          objectKey,
          Buffer.from(`race-${index}`),
          "application/zip"
        )
      )
    );

    expect(attempts.filter((result) => result.created)).toHaveLength(1);
    expect(attempts.filter((result) => !result.created)).toHaveLength(7);
    const persisted = await storage.getObjectBuffer(objectKey);
    expect(persisted.toString()).toMatch(/^race-[0-7]$/);
  });

  it("uses OSS forbid-overwrite and normalizes existing-key races without exposing error details", async () => {
    configureOss();
    mockOssPut.mockReset();
    let firstPut = true;
    const alreadyExists = Object.assign(
      new Error("internal secret object key"),
      { code: "FileAlreadyExists", status: 409 }
    );
    mockOssPut.mockImplementation(async () => {
      await Promise.resolve();
      if (firstPut) {
        firstPut = false;
        return {};
      }
      throw alreadyExists;
    });
    const storage = new StorageService();
    const objectKey = "emp-import/project-1/job-oss/archive.zip";
    const results = await Promise.all([
      storage.putCacheObjectIfAbsent(
        objectKey,
        Buffer.from("first-bytes"),
        "application/zip"
      ),
      storage.putCacheObjectIfAbsent(
        objectKey,
        Buffer.from("different-bytes"),
        "application/zip"
      ),
    ]);

    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(results.filter((result) => !result.created)).toHaveLength(1);
    expect(mockOssPut).toHaveBeenCalledTimes(2);
    expect(mockOssPut).toHaveBeenNthCalledWith(
      1,
      objectKey,
      Buffer.from("first-bytes"),
      {
        headers: {
          "Content-Type": "application/zip",
          "x-oss-forbid-overwrite": "true",
        },
      }
    );
    expect(JSON.stringify(results)).not.toContain("internal secret");
  });

  it("throws a safe error for a real OSS cache write failure", async () => {
    configureOss();
    mockOssPut.mockReset();
    mockOssPut.mockRejectedValue(
      Object.assign(new Error("AccessDenied for secret-cache-key"), {
        code: "AccessDenied",
        status: 403,
      })
    );
    const storage = new StorageService();
    const objectKey = "emp-import/project-1/job-failure/archive.zip";

    let thrown: unknown;
    try {
      await storage.putCacheObjectIfAbsent(
        objectKey,
        Buffer.from("bytes"),
        "application/zip"
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(String(thrown)).toContain("Unable to create cache object");
    expect(String(thrown)).not.toContain(objectKey);
    expect(String(thrown)).not.toContain("secret-cache-key");
  });

  it("deletes local objects if present and treats an absent object as success", async () => {
    const storage = new StorageService();
    const objectKey = "emp-import/project-1/job-delete/archive.zip";

    await expect(
      storage.deleteObjectIfPresent(objectKey)
    ).resolves.toBeUndefined();
    await storage.putCacheObject(objectKey, Buffer.from("bytes"));
    await expect(
      storage.deleteObjectIfPresent(objectKey)
    ).resolves.toBeUndefined();
    await expect(storage.getObjectBuffer(objectKey)).rejects.toThrow(/./);
  });

  it("normalizes OSS not-found deletion and throws a safe error for real deletion failures", async () => {
    configureOss();
    mockOssDelete.mockReset();
    mockOssDelete.mockRejectedValueOnce(
      Object.assign(new Error("NoSuchKey secret-delete-key"), {
        code: "NoSuchKey",
        status: 404,
      })
    );
    const storage = new StorageService();
    const objectKey = "emp-import/project-1/job-delete-oss/archive.zip";

    await expect(
      storage.deleteObjectIfPresent(objectKey)
    ).resolves.toBeUndefined();

    mockOssDelete.mockRejectedValue(
      Object.assign(new Error("network secret-delete-key"), {
        code: "AccessDenied",
        status: 403,
      })
    );
    let thrown: unknown;
    try {
      await storage.deleteObjectIfPresent(objectKey);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(String(thrown)).toContain("Unable to delete storage object");
    expect(String(thrown)).not.toContain(objectKey);
    expect(String(thrown)).not.toContain("secret-delete-key");
  });

  it.each([
    "../emp-import/project-1/archive.zip",
    "emp-import/project-1/../../archive.zip",
  ])(
    "keeps safe object-key validation for atomic cache operations: %s",
    async (objectKey) => {
      const storage = new StorageService();

      await expect(
        storage.putCacheObjectIfAbsent(objectKey, Buffer.from("bytes"))
      ).rejects.toThrow("Unsafe object key");
      await expect(storage.deleteObjectIfPresent(objectKey)).rejects.toThrow(
        "Unsafe object key"
      );
    }
  );

  it("rejects deterministic cache object keys that escape the upload root", async () => {
    const storage = new StorageService();

    await expect(
      storage.putCacheObject(
        "document-raster-previews/project-1/../escape.png",
        Buffer.from("page-image"),
        "image/png"
      )
    ).rejects.toThrow("Unsafe object key");
  });

  it("creates local upload grants with server-generated object keys", () => {
    const storage = new StorageService();
    const grant = storage.createUploadGrant(
      "project-1",
      "paper-1",
      "support.pdf",
      "application/pdf"
    );

    expect(grant.method).toBe("PUT");
    expect(grant.uploadUrl).toBe(`local://${grant.objectKey}`);
    expect(grant.headers).toStrictEqual({
      "Content-Type": "application/pdf",
      "x-oss-forbid-overwrite": "true",
    });
    expect(grant.objectKey).toMatch(
      /^working-papers\/project-1\/paper-1\/\d+-[0-9a-f-]+\.pdf$/
    );
  });

  it("uses fixed opaque roots for confirmation artifacts and packages", async () => {
    const storage = new StorageService();
    const artifact = await storage.putConfirmationArtifact(
      "project-1",
      "confirmation-1",
      "artifact-1",
      "pdf",
      Buffer.from("artifact"),
      "application/pdf"
    );
    const packageObject = await storage.putConfirmationPackage(
      "dispatch-1",
      "package-1",
      Buffer.from("package")
    );

    expect(artifact.objectKey).toBe(
      "confirmation-artifacts/project-1/confirmation-1/artifact-1/document.pdf"
    );
    expect(packageObject.objectKey).toBe(
      "confirmation-packages/dispatch-1/package-1/package.pdf"
    );
  });

  it.each([
    [
      "artifact",
      (storage: StorageService, body: Buffer) =>
        storage.putConfirmationArtifact(
          "project-1",
          "confirmation-1",
          "artifact-1",
          "pdf",
          body,
          "application/pdf"
        ),
      "confirmation-artifacts/project-1/confirmation-1/artifact-1/document.pdf",
    ],
    [
      "package",
      (storage: StorageService, body: Buffer) =>
        storage.putConfirmationPackage(
          "dispatch-1",
          "package-1",
          body,
          "application/pdf"
        ),
      "confirmation-packages/dispatch-1/package-1/package.pdf",
    ],
    [
      "response artifact",
      (storage: StorageService, body: Buffer) =>
        storage.putConfirmationResponseArtifact(
          "response-1",
          "artifact-1",
          "pdf",
          body,
          "application/pdf"
        ),
      "confirmation-response-artifacts/response-1/artifact-1/response.pdf",
    ],
  ])(
    "rejects a duplicate fixed %s key without replacing the original bytes",
    async (_label, put, objectKey) => {
      const storage = new StorageService();
      await put(storage, Buffer.from("original"));

      await expect(put(storage, Buffer.from("replacement"))).rejects.toThrow(
        /./
      );

      await expect(storage.getObjectBuffer(objectKey)).resolves.toStrictEqual(
        Buffer.from("original")
      );
    }
  );

  it("deletes only the addressed local fixed confirmation artifact", async () => {
    const storage = new StorageService();
    const stored = await storage.putConfirmationArtifact(
      "project-1",
      "confirmation-1",
      "artifact-1",
      "docx",
      Buffer.from("artifact")
    );

    await storage.deleteConfirmationArtifact(
      "project-1",
      "confirmation-1",
      "artifact-1",
      "docx"
    );

    await expect(storage.getObjectBuffer(stored.objectKey)).rejects.toThrow(
      /./
    );
    await expect(
      storage.deleteConfirmationArtifact(
        "../project-1",
        "confirmation-1",
        "artifact-1",
        "docx"
      )
    ).rejects.toThrow("Unsafe object segment");
  });

  it("forbids OSS overwrite and deletes the fixed key through OSS", async () => {
    process.env.STORAGE_DRIVER = "oss";
    process.env.OSS_REGION = "oss-cn-shenzhen";
    process.env.OSS_BUCKET = "project-wing";
    process.env.OSS_ENDPOINT = "https://oss-cn-shenzhen.aliyuncs.com";
    process.env.OSS_ACCESS_KEY_ID = "access-key";
    process.env.OSS_ACCESS_KEY_SECRET = "secret";
    const storage = new StorageService();

    await storage.putConfirmationArtifact(
      "project-1",
      "confirmation-1",
      "artifact-1",
      "pdf",
      Buffer.from("%PDF-1.4"),
      "application/pdf"
    );
    await storage.deleteConfirmationArtifact(
      "project-1",
      "confirmation-1",
      "artifact-1",
      "pdf"
    );

    const objectKey =
      "confirmation-artifacts/project-1/confirmation-1/artifact-1/document.pdf";
    expect(mockOssPut).toHaveBeenCalledWith(
      objectKey,
      Buffer.from("%PDF-1.4"),
      {
        headers: {
          "Content-Type": "application/pdf",
          "x-oss-forbid-overwrite": "true",
        },
      }
    );
    expect(mockOssDelete).toHaveBeenCalledWith(objectKey);
  });

  it("uses fixed opaque roots for response uploads and response artifacts", async () => {
    const storage = new StorageService();
    const grant = storage.createConfirmationResponseUploadGrant(
      "response-1",
      "upload-1",
      "application/pdf"
    );
    const artifact = await storage.putConfirmationResponseArtifact(
      "response-1",
      "artifact-1",
      "pdf",
      Buffer.from("response"),
      "application/pdf"
    );

    expect(grant.objectKey).toBe(
      "confirmation-response-uploads/response-1/upload-1/source.pdf"
    );
    expect(artifact.objectKey).toBe(
      "confirmation-response-artifacts/response-1/artifact-1/response.pdf"
    );
    expect(`${grant.objectKey}/${artifact.objectKey}`).not.toContain("client");
  });

  it.each([
    [
      "putConfirmationArtifact",
      () =>
        new StorageService().putConfirmationArtifact(
          "../project",
          "confirmation-1",
          "artifact-1",
          "pdf",
          Buffer.from("x")
        ),
    ],
    [
      "putConfirmationPackage",
      () =>
        new StorageService().putConfirmationPackage(
          "dispatch-1",
          "../package",
          Buffer.from("x")
        ),
    ],
    [
      "createConfirmationResponseUploadGrant",
      () =>
        new StorageService().createConfirmationResponseUploadGrant(
          "response-1",
          "../upload",
          "application/pdf"
        ),
    ],
    [
      "putConfirmationResponseArtifact",
      () =>
        new StorageService().putConfirmationResponseArtifact(
          "response-1",
          "../artifact",
          "pdf",
          Buffer.from("x")
        ),
    ],
  ])("rejects unsafe opaque IDs in %s", async (_method, call) => {
    await expect(Promise.resolve().then(call)).rejects.toThrow(
      "Unsafe object segment"
    );
  });

  it("rejects local object keys that escape the upload root", () => {
    const storage = new StorageService();

    expect(() =>
      storage.getDownloadObject(
        "working-papers/project-1/paper-1/../../../../package.json",
        "package.json",
        "application/json"
      )
    ).toThrow("Unsafe object key");
  });

  it.each([
    "C:/Windows/System32/drivers/etc/hosts",
    String.raw`C:\Windows\System32\drivers\etc\hosts`,
    "C:relative/object.docx",
  ])("rejects Windows drive-qualified object keys: %s", (objectKey) => {
    const storage = new StorageService();

    expect(() =>
      storage.getDownloadObject(
        objectKey,
        "object.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ).toThrow("Unsafe object key");
  });

  it("uses the public OSS endpoint for browser-facing signed URLs", () => {
    process.env.STORAGE_DRIVER = "oss";
    process.env.OSS_REGION = "oss-cn-shenzhen";
    process.env.OSS_BUCKET = "superfx-project-wing-files";
    process.env.OSS_ENDPOINT = "https://oss-cn-shenzhen.aliyuncs.com";
    process.env.OSS_INTERNAL_ENDPOINT =
      "https://oss-cn-shenzhen-internal.aliyuncs.com";
    process.env.OSS_USE_INTERNAL_ENDPOINT = "true";
    process.env.OSS_ACCESS_KEY_ID = "access-key";
    process.env.OSS_ACCESS_KEY_SECRET = "secret";

    const storage = new StorageService();
    const grant = storage.createUploadGrant(
      "project-1",
      "paper-1",
      "support.pdf",
      "application/pdf"
    );

    expect(grant.uploadUrl).toContain("https://oss-cn-shenzhen.aliyuncs.com");
    expect(grant.uploadUrl).not.toContain("internal");
  });

  it("returns proxy mode when direct transfer is unavailable locally", async () => {
    await expect(
      new StorageService().createResumableUploadGrant({
        objectKey: "desktop-master-check-ins/project/file.xlsx",
        contentType: "application/octet-stream",
        fileSize: 10,
        contentSha256: "a".repeat(64),
      })
    ).resolves.toStrictEqual({ ok: true, mode: "PROXY" });
  });

  it("returns a typed conflict when a direct upload object is missing", async () => {
    configureOss();
    mockOssHead.mockRejectedValue(
      Object.assign(new Error("Object not exists"), {
        name: "NoSuchKeyError",
        code: "NoSuchKey",
        status: 404,
      })
    );
    const storage = new StorageService();
    const verification = storage.assertUploadedObject(
      "desktop-master-check-ins/project/file.xlsx",
      10,
      "a".repeat(64)
    );

    await expect(verification).rejects.toBeInstanceOf(ApiConflictException);
    await expect(verification).rejects.toMatchObject({
      response: {
        code: "DIRECT_UPLOAD_NOT_FOUND",
      },
      status: 409,
    });
    expect(mockOssHead).toHaveBeenCalledTimes(3);
  });

  it.each([
    {
      label: "size",
      headers: {
        "content-length": "9",
        "content-type": "application/octet-stream",
        "x-oss-meta-sha256": "a".repeat(64),
      },
      code: "DIRECT_UPLOAD_SIZE_MISMATCH",
    },
    {
      label: "hash",
      headers: {
        "content-length": "10",
        "content-type": "application/octet-stream",
        "x-oss-meta-sha256": "b".repeat(64),
      },
      code: "DIRECT_UPLOAD_HASH_MISMATCH",
    },
    {
      label: "CRC64",
      headers: {
        "content-length": "10",
        "content-type": "application/octet-stream",
        "x-oss-meta-sha256": "a".repeat(64),
        "x-oss-hash-crc64ecma": "123",
      },
      expectedCrc64: "456",
      code: "DIRECT_UPLOAD_CRC64_MISMATCH",
    },
  ])(
    "returns a typed conflict for a direct upload $label mismatch",
    async ({ headers, expectedCrc64, code }) => {
      configureOss();
      mockOssHead.mockResolvedValueOnce({ res: { headers } });
      const storage = new StorageService();

      await expect(
        storage.assertUploadedObject(
          "desktop-master-check-ins/project/file.xlsx",
          10,
          "a".repeat(64),
          expectedCrc64
        )
      ).rejects.toMatchObject({
        response: { code },
        status: 409,
      });
    }
  );

  it("returns a typed unavailable error when OSS verification fails", async () => {
    configureOss();
    mockOssHead.mockRejectedValue(new Error("socket timeout"));
    const storage = new StorageService();
    const verification = storage.assertUploadedObject(
      "desktop-master-check-ins/project/file.xlsx",
      10,
      "a".repeat(64)
    );

    await expect(verification).rejects.toBeInstanceOf(
      ApiServiceUnavailableException
    );
    await expect(verification).rejects.toMatchObject({
      response: {
        code: "DIRECT_UPLOAD_VERIFY_UNAVAILABLE",
      },
      status: 503,
    });
    expect(mockOssHead).toHaveBeenCalledTimes(3);
  });

  it("absorbs a transient OSS HEAD failure without forcing a re-upload", async () => {
    configureOss();
    mockOssHead
      .mockRejectedValueOnce(new Error("socket timeout"))
      .mockResolvedValueOnce({
        res: {
          headers: {
            "content-length": "10",
            "content-type": "application/octet-stream",
            "x-oss-meta-sha256": "a".repeat(64),
          },
        },
      });

    await expect(
      new StorageService().assertUploadedObject(
        "desktop-master-check-ins/project/file.xlsx",
        10,
        "a".repeat(64)
      )
    ).resolves.toMatchObject({
      objectKey: "desktop-master-check-ins/project/file.xlsx",
    });
    expect(mockOssHead).toHaveBeenCalledTimes(2);
  });

  it("creates resumable signed OSS parts and completes them server-side", async () => {
    configureOss();
    process.env.OSS_DESKTOP_MULTIPART_THRESHOLD_BYTES = "4";
    process.env.OSS_DESKTOP_MULTIPART_PART_SIZE_BYTES = String(100 * 1024);
    mockOssHead
      .mockRejectedValueOnce(new Error("not found"))
      .mockRejectedValueOnce(new Error("not found"))
      .mockResolvedValueOnce({
        res: {
          headers: {
            "content-length": String(200 * 1024),
            "content-type": "application/octet-stream",
            "x-oss-meta-sha256": "b".repeat(64),
          },
        },
      });
    mockInitMultipartUpload.mockResolvedValue({ uploadId: "upload-1" });
    mockCompleteMultipartUpload.mockResolvedValue({});
    const storage = new StorageService();
    const grant = await storage.createResumableUploadGrant({
      objectKey: "desktop-master-check-ins/project/file.xlsx",
      contentType: "application/octet-stream",
      fileSize: 200 * 1024,
      contentSha256: "b".repeat(64),
    });

    expect(grant).toMatchObject({
      mode: "DIRECT_MULTIPART",
      uploadId: "upload-1",
      partSize: 100 * 1024,
      parts: [
        { partNumber: 1, uploadUrl: expect.stringContaining("partNumber=1") },
        { partNumber: 2, uploadUrl: expect.stringContaining("partNumber=2") },
      ],
    });
    await storage.completeResumableUpload({
      objectKey: "desktop-master-check-ins/project/file.xlsx",
      uploadId: "upload-1",
      parts: [
        { partNumber: 2, etag: '"etag-2"' },
        { partNumber: 1, etag: '"etag-1"' },
      ],
      fileSize: 200 * 1024,
      contentSha256: "b".repeat(64),
    });
    expect(mockCompleteMultipartUpload).toHaveBeenCalledWith(
      "desktop-master-check-ins/project/file.xlsx",
      "upload-1",
      [
        { number: 1, etag: '"etag-1"' },
        { number: 2, etag: '"etag-2"' },
      ]
    );
  });

  it("replaces an expired multipart upload id instead of signing it again", async () => {
    configureOss();
    process.env.OSS_DESKTOP_MULTIPART_THRESHOLD_BYTES = "4";
    mockOssHead.mockRejectedValueOnce(new Error("not found"));
    mockListParts.mockRejectedValueOnce(
      Object.assign(new Error("upload expired"), { code: "NoSuchUpload" })
    );
    mockInitMultipartUpload.mockResolvedValue({ uploadId: "upload-new" });

    const grant = await new StorageService().createResumableUploadGrant({
      objectKey: "desktop-master-check-ins/project/resume.bin",
      contentType: "application/octet-stream",
      fileSize: 200 * 1024,
      contentSha256: "d".repeat(64),
      resumeUploadId: "upload-expired",
    });

    expect(mockListParts).toHaveBeenCalledWith(
      "desktop-master-check-ins/project/resume.bin",
      "upload-expired"
    );
    expect(grant).toMatchObject({
      mode: "DIRECT_MULTIPART",
      uploadId: "upload-new",
      uploadedParts: [],
    });
  });

  it("returns authoritative OSS parts when resuming a multipart upload", async () => {
    configureOss();
    process.env.OSS_DESKTOP_MULTIPART_THRESHOLD_BYTES = "4";
    mockOssHead.mockRejectedValueOnce(new Error("not found"));
    mockListParts.mockResolvedValueOnce({
      parts: [{ number: 1, etag: '"etag-remote"' }],
    });

    const grant = await new StorageService().createResumableUploadGrant({
      objectKey: "desktop-master-check-ins/project/resume.bin",
      contentType: "application/octet-stream",
      fileSize: 200 * 1024,
      contentSha256: "e".repeat(64),
      resumeUploadId: "upload-live",
    });

    expect(grant).toMatchObject({
      mode: "DIRECT_MULTIPART",
      uploadId: "upload-live",
      uploadedParts: [{ partNumber: 1, etag: '"etag-remote"' }],
    });
    expect(mockInitMultipartUpload).not.toHaveBeenCalled();
  });

  it("does not treat a generic OSS 404 as an expired multipart upload", async () => {
    configureOss();
    process.env.OSS_DESKTOP_MULTIPART_THRESHOLD_BYTES = "4";
    mockOssHead.mockRejectedValueOnce(new Error("not found"));
    const endpointError = Object.assign(new Error("wrong endpoint"), {
      status: 404,
      statusCode: 404,
    });
    mockListParts.mockRejectedValueOnce(endpointError);

    await expect(
      new StorageService().createResumableUploadGrant({
        objectKey: "desktop-master-check-ins/project/resume.bin",
        contentType: "application/octet-stream",
        fileSize: 200 * 1024,
        contentSha256: "f".repeat(64),
        resumeUploadId: "upload-unknown",
      })
    ).rejects.toBe(endpointError);
    expect(mockInitMultipartUpload).not.toHaveBeenCalled();
  });

  it("extends desktop upload grants for large files on slow links", async () => {
    configureOss();
    mockOssHead.mockRejectedValueOnce(new Error("not found"));
    mockInitMultipartUpload.mockResolvedValue({ uploadId: "upload-large" });
    const before = Date.now();
    const grant = await new StorageService().createResumableUploadGrant({
      objectKey: "desktop-master-check-ins/project/large-file.bin",
      contentType: "application/octet-stream",
      fileSize: 1024 * 1024 * 1024,
      contentSha256: "c".repeat(64),
    });

    expect(grant.mode).toBe("DIRECT_MULTIPART");
    if (grant.mode !== "DIRECT_MULTIPART") {
      throw new Error("Expected a multipart upload grant.");
    }
    expect(Date.parse(grant.expiresAt) - before).toBeGreaterThan(
      4 * 60 * 60 * 1000
    );
  });
});

function configureOss() {
  process.env.STORAGE_DRIVER = "oss";
  process.env.OSS_REGION = "oss-cn-shenzhen";
  process.env.OSS_BUCKET = "superfx-project-wing-files";
  process.env.OSS_ENDPOINT = "https://oss-cn-shenzhen.aliyuncs.com";
  process.env.OSS_ACCESS_KEY_ID = "access-key";
  process.env.OSS_ACCESS_KEY_SECRET = "secret";
}
