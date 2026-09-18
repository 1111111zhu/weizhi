import { randomUUID } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import pathModule from "node:path";
import type { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";

import { Injectable } from "@nestjs/common";
import OSS from "ali-oss";

import {
  ApiConflictException,
  ApiServiceUnavailableException,
} from "../common/api-error";

type OssClient = {
  copy: (
    name: string,
    sourceName: string,
    options?: Record<string, unknown>
  ) => Promise<unknown>;
  signatureUrl: (name: string, options?: Record<string, unknown>) => string;
  put: (
    name: string,
    body: Buffer | string,
    options?: Record<string, unknown>
  ) => Promise<unknown>;
  get: (
    name: string,
    filePath?: string
  ) => Promise<{ content: Buffer | Uint8Array | string }>;
  getStream: (name: string) => Promise<{ stream: Readable }>;
  head: (
    name: string
  ) => Promise<{ res?: { headers?: Record<string, unknown> } }>;
  delete: (name: string) => Promise<unknown>;
  list: (query: {
    prefix: string;
    marker?: string;
    "max-keys"?: number;
  }) => Promise<{
    objects?: { name: string }[];
    nextMarker?: string;
    isTruncated?: boolean;
  }>;
  initMultipartUpload: (
    name: string,
    options?: Record<string, unknown>
  ) => Promise<{ uploadId: string }>;
  listParts: (
    name: string,
    uploadId: string,
    options?: Record<string, unknown>
  ) => Promise<{ parts?: { number: number; etag: string }[] }>;
  completeMultipartUpload: (
    name: string,
    uploadId: string,
    parts: { number: number; etag: string }[],
    options?: Record<string, unknown>
  ) => Promise<unknown>;
};

export type StoredObject = {
  fileName: string;
  objectKey: string;
};

export type PutCacheObjectIfAbsentResult = StoredObject & {
  created: boolean;
};

export type UploadGrant = {
  objectKey: string;
  fileName: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: string;
};

export type ObjectMetadata = {
  contentLength: number;
  contentType: string;
  contentSha256?: string;
  contentCrc64?: string;
};

export type ResumableUploadGrant =
  | { ok: true; mode: "PROXY" }
  | { ok: true; mode: "ALREADY_UPLOADED"; objectKey: string }
  | {
      ok: true;
      mode: "DIRECT_PUT";
      objectKey: string;
      uploadUrl: string;
      headers: Record<string, string>;
      expiresAt: string;
    }
  | {
      ok: true;
      mode: "DIRECT_MULTIPART";
      objectKey: string;
      uploadId: string;
      partSize: number;
      parts: { partNumber: number; uploadUrl: string }[];
      uploadedParts: { partNumber: number; etag: string }[];
      expiresAt: string;
    };

export type DownloadObject = {
  fileName: string;
  mimeType: string;
  body?: Buffer;
  absolutePath?: string;
  redirectUrl?: string;
};

@Injectable()
export class StorageService {
  private ossClient?: OssClient;
  private browserOssClient?: OssClient;

  supportsDirectTransfer() {
    return this.isOss();
  }

  async putObject(
    projectId: string,
    paperId: string,
    originalName: string,
    body: Buffer,
    contentType = "application/octet-stream"
  ): Promise<StoredObject> {
    const object = this.createObject(projectId, paperId, originalName);
    if (this.isOss()) {
      await this.getOssClient().put(object.objectKey, body, {
        headers: { "Content-Type": contentType },
      });
      return object;
    }

    const absolutePath = this.getLocalPath(object.objectKey);
    await mkdir(pathModule.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, body);
    return object;
  }

  async putKnowledgeDocument(
    documentId: string,
    originalName: string,
    body: Buffer,
    contentType = "application/octet-stream"
  ): Promise<StoredObject> {
    const object = this.createObjectInDirectory(
      pathModule.posix.join(
        "knowledge-documents",
        assertSafeObjectSegment(documentId)
      ),
      originalName
    );
    if (this.isOss()) {
      await this.getOssClient().put(object.objectKey, body, {
        headers: { "Content-Type": contentType },
      });
      return object;
    }

    const absolutePath = this.getLocalPath(object.objectKey);
    await mkdir(pathModule.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, body);
    return object;
  }

  async putCmpClientSearchDocument(
    clientId: string,
    documentId: string,
    originalName: string,
    body: Buffer,
    contentType = "application/octet-stream"
  ): Promise<StoredObject> {
    const object = this.createObjectInDirectory(
      pathModule.posix.join(
        "cmp-client-search-documents",
        assertSafeObjectSegment(clientId),
        assertSafeObjectSegment(documentId)
      ),
      originalName
    );
    if (this.isOss()) {
      await this.getOssClient().put(object.objectKey, body, {
        headers: { "Content-Type": contentType },
      });
      return object;
    }
    const absolutePath = this.getLocalPath(object.objectKey);
    await mkdir(pathModule.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, body);
    return object;
  }

  async putCmpBillingArtifact(
    engagementId: string,
    billingId: string,
    category: "invoices" | "client-payment-evidence" | "finance-receipts",
    artifactId: string,
    originalName: string,
    body: Buffer,
    contentType = "application/octet-stream"
  ): Promise<StoredObject> {
    const object = this.createObjectInDirectory(
      pathModule.posix.join(
        "cmp-billing",
        assertSafeObjectSegment(engagementId),
        assertSafeObjectSegment(billingId),
        category,
        assertSafeObjectSegment(artifactId)
      ),
      originalName
    );
    if (this.isOss()) {
      await this.getOssClient().put(object.objectKey, body, {
        headers: { "Content-Type": contentType },
      });
      return object;
    }
    const absolutePath = this.getLocalPath(object.objectKey);
    await mkdir(pathModule.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, body);
    return object;
  }

  async putConfirmationArtifact(
    projectId: string,
    confirmationId: string,
    artifactId: string,
    format: "docx" | "pdf",
    body: Buffer,
    contentType = "application/octet-stream"
  ): Promise<StoredObject> {
    await Promise.resolve();
    return this.putFixedObject(
      pathModule.posix.join(
        "confirmation-artifacts",
        assertSafeObjectSegment(projectId),
        assertSafeObjectSegment(confirmationId),
        assertSafeObjectSegment(artifactId),
        `document.${format}`
      ),
      body,
      contentType
    );
  }

  async deleteConfirmationArtifact(
    projectId: string,
    confirmationId: string,
    artifactId: string,
    format: "docx" | "pdf"
  ): Promise<void> {
    const objectKey = assertSafeObjectKey(
      pathModule.posix.join(
        "confirmation-artifacts",
        assertSafeObjectSegment(projectId),
        assertSafeObjectSegment(confirmationId),
        assertSafeObjectSegment(artifactId),
        `document.${format}`
      )
    );
    if (this.isOss()) {
      await this.getOssClient().delete(objectKey);
      return;
    }
    await rm(this.getLocalPath(objectKey), { force: true });
  }

  async putConfirmationPackage(
    dispatchId: string,
    packageId: string,
    body: Buffer,
    contentType = "application/pdf"
  ): Promise<StoredObject> {
    await Promise.resolve();
    return this.putFixedObject(
      pathModule.posix.join(
        "confirmation-packages",
        assertSafeObjectSegment(dispatchId),
        assertSafeObjectSegment(packageId),
        "package.pdf"
      ),
      body,
      contentType
    );
  }

  async putConfirmationDispatchAttachment(
    projectId: string,
    confirmationId: string,
    dispatchId: string,
    originalName: string,
    body: Buffer,
    contentType = "application/octet-stream"
  ): Promise<StoredObject> {
    const object = this.createObjectInDirectory(
      pathModule.posix.join(
        "confirmation-dispatch-attachments",
        assertSafeObjectSegment(projectId),
        assertSafeObjectSegment(confirmationId),
        assertSafeObjectSegment(dispatchId)
      ),
      originalName
    );
    if (this.isOss()) {
      await this.getOssClient().put(object.objectKey, body, {
        headers: { "Content-Type": contentType },
      });
      return object;
    }

    const absolutePath = this.getLocalPath(object.objectKey);
    await mkdir(pathModule.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, body);
    return object;
  }

  createConfirmationResponseUploadGrant(
    responseId: string,
    uploadId: string,
    contentType: string
  ): UploadGrant {
    const extension = extensionForContentType(contentType);
    const objectKey = pathModule.posix.join(
      "confirmation-response-uploads",
      assertSafeObjectSegment(responseId),
      assertSafeObjectSegment(uploadId),
      `source.${extension}`
    );
    return {
      objectKey,
      fileName: pathModule.basename(objectKey),
      ...this.createUploadUrlForObject(objectKey, contentType),
    };
  }

  async putConfirmationResponseArtifact(
    responseId: string,
    artifactId: string,
    format: "pdf" | "jpg" | "png",
    body: Buffer,
    contentType = "application/octet-stream"
  ): Promise<StoredObject> {
    await Promise.resolve();
    return this.putFixedObject(
      pathModule.posix.join(
        "confirmation-response-artifacts",
        assertSafeObjectSegment(responseId),
        assertSafeObjectSegment(artifactId),
        `response.${format}`
      ),
      body,
      contentType
    );
  }

  async putConfirmationResponseArtifactFile(
    responseId: string,
    artifactId: string,
    originalName: string,
    body: Buffer,
    contentType = "application/octet-stream"
  ): Promise<StoredObject> {
    await Promise.resolve();
    const extension =
      pathModule.extname(sanitizeFileName(originalName)) || ".bin";
    return this.putFixedObject(
      pathModule.posix.join(
        "confirmation-response-artifacts",
        assertSafeObjectSegment(responseId),
        assertSafeObjectSegment(artifactId),
        `response${extension.toLowerCase()}`
      ),
      body,
      contentType
    );
  }

  async deleteConfirmationResponseArtifact(
    responseId: string,
    artifactId: string,
    format: "pdf" | "jpg" | "png"
  ): Promise<void> {
    const objectKey = assertSafeObjectKey(
      pathModule.posix.join(
        "confirmation-response-artifacts",
        assertSafeObjectSegment(responseId),
        assertSafeObjectSegment(artifactId),
        `response.${format}`
      )
    );
    if (this.isOss()) {
      await this.getOssClient().delete(objectKey);
      return;
    }
    await rm(this.getLocalPath(objectKey), { force: true });
  }

  async deleteObject(objectKey: string): Promise<void> {
    const safeObjectKey = assertSafeObjectKey(objectKey);
    if (this.isOss()) {
      await this.getOssClient().delete(safeObjectKey);
      return;
    }
    await rm(this.getLocalPath(safeObjectKey), { force: true });
  }

  async deleteObjectIfPresent(objectKey: string): Promise<void> {
    const safeObjectKey = assertSafeObjectKey(objectKey);
    try {
      if (this.isOss()) {
        await this.getOssClient().delete(safeObjectKey);
        return;
      }
      await rm(this.getLocalPath(safeObjectKey), { force: true });
    } catch (error) {
      if (isObjectNotFoundError(error)) {
        return;
      }
      throw safeStorageOperationError("Unable to delete storage object.");
    }
  }

  async deleteCachePrefix(prefix: string): Promise<void> {
    const safePrefix = assertSafeObjectKey(prefix.replace(/\/+$/, ""));
    if (!this.isOss()) {
      await rm(this.getLocalPath(safePrefix), { force: true, recursive: true });
      return;
    }

    const objectPrefix = `${safePrefix}/`;
    let marker: string | undefined;
    do {
      const page = await this.getOssClient().list({
        prefix: objectPrefix,
        ...(marker ? { marker } : {}),
        "max-keys": 500,
      });
      const objectKeys = (page.objects ?? [])
        .map((object) => object.name)
        .filter((objectKey) => objectKey.startsWith(objectPrefix));
      await Promise.all(
        objectKeys.map((objectKey) => this.getOssClient().delete(objectKey))
      );
      marker = page.isTruncated ? page.nextMarker : undefined;
    } while (marker);
  }

  async putReviewQuestionImage(
    projectId: string,
    questionId: string,
    originalName: string,
    body: Buffer,
    contentType: string
  ): Promise<StoredObject> {
    const object = this.createObjectInDirectory(
      pathModule.posix.join("review-question-images", projectId, questionId),
      originalName
    );
    if (this.isOss()) {
      await this.getOssClient().put(object.objectKey, body, {
        headers: { "Content-Type": contentType },
      });
      return object;
    }

    const absolutePath = this.getLocalPath(object.objectKey);
    await mkdir(pathModule.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, body);
    return object;
  }

  async putZipDraftObject(
    projectId: string,
    sessionId: string,
    originalName: string,
    body: Buffer,
    contentType = "application/octet-stream"
  ): Promise<StoredObject> {
    const object = this.createObjectInDirectory(
      pathModule.posix.join("zip-master-drafts", projectId, sessionId),
      originalName
    );
    if (this.isOss()) {
      await this.getOssClient().put(object.objectKey, body, {
        headers: { "Content-Type": contentType },
      });
      return object;
    }

    const absolutePath = this.getLocalPath(object.objectKey);
    await mkdir(pathModule.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, body);
    return object;
  }

  async putZipCacheObject(
    projectId: string,
    attachmentId: string,
    attachmentVersion: number,
    originalName: string,
    body: Buffer,
    contentType = "application/octet-stream"
  ): Promise<StoredObject> {
    const object = this.createObjectInDirectory(
      pathModule.posix.join(
        "zip-archive-cache",
        projectId,
        attachmentId,
        `v${attachmentVersion}`
      ),
      originalName
    );
    if (this.isOss()) {
      await this.getOssClient().put(object.objectKey, body, {
        headers: { "Content-Type": contentType },
      });
      return object;
    }

    const absolutePath = this.getLocalPath(object.objectKey);
    await mkdir(pathModule.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, body);
    return object;
  }

  async putCacheObject(
    objectKey: string,
    body: Buffer,
    contentType = "application/octet-stream"
  ): Promise<StoredObject> {
    const safeObjectKey = assertSafeObjectKey(objectKey);
    if (this.isOss()) {
      await this.getOssClient().put(safeObjectKey, body, {
        headers: { "Content-Type": contentType },
      });
      return {
        fileName: pathModule.basename(safeObjectKey),
        objectKey: safeObjectKey,
      };
    }

    const absolutePath = this.getLocalPath(safeObjectKey);
    await mkdir(pathModule.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, body);
    return {
      fileName: pathModule.basename(safeObjectKey),
      objectKey: safeObjectKey,
    };
  }

  async putCacheObjectIfAbsent(
    objectKey: string,
    body: Buffer,
    contentType = "application/octet-stream"
  ): Promise<PutCacheObjectIfAbsentResult> {
    const safeObjectKey = assertSafeObjectKey(objectKey);
    const object = {
      fileName: pathModule.basename(safeObjectKey),
      objectKey: safeObjectKey,
    };
    try {
      if (this.isOss()) {
        await this.getOssClient().put(safeObjectKey, body, {
          headers: {
            "Content-Type": contentType,
            "x-oss-forbid-overwrite": "true",
          },
        });
      } else {
        const absolutePath = this.getLocalPath(safeObjectKey);
        await mkdir(pathModule.dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, body, { flag: "wx" });
      }
      return { ...object, created: true };
    } catch (error) {
      if (isStorageAlreadyExistsError(error)) {
        return { ...object, created: false };
      }
      throw safeStorageOperationError("Unable to create cache object.");
    }
  }

  async putProjectArchive(
    projectId: string,
    originalName: string,
    body: Buffer,
    contentType = "application/zip"
  ): Promise<StoredObject> {
    const object = this.createObjectInDirectory(
      pathModule.posix.join("project-archives", projectId),
      originalName
    );
    if (this.isOss()) {
      await this.getOssClient().put(object.objectKey, body, {
        headers: { "Content-Type": contentType },
      });
      return object;
    }

    const absolutePath = this.getLocalPath(object.objectKey);
    await mkdir(pathModule.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, body);
    return object;
  }

  async putProjectFileExport(
    projectId: string,
    jobId: string,
    originalName: string,
    sourcePath: string
  ): Promise<StoredObject & { fileSize: number }> {
    const object = this.getProjectFileExportObject(
      projectId,
      jobId,
      originalName
    );
    if (this.isOss()) {
      await this.getOssClient().put(object.objectKey, sourcePath, {
        headers: { "Content-Type": "application/zip" },
      });
    } else {
      const absolutePath = this.getLocalPath(object.objectKey);
      await mkdir(pathModule.dirname(absolutePath), { recursive: true });
      await copyFile(sourcePath, absolutePath);
    }
    const sourceStats = await stat(sourcePath);
    return { ...object, fileSize: sourceStats.size };
  }

  getProjectFileExportObject(
    projectId: string,
    jobId: string,
    originalName: string
  ): StoredObject {
    const fileName = sanitizeFileName(originalName);
    return {
      fileName,
      objectKey: pathModule.posix.join(
        "project-file-exports",
        projectId,
        jobId,
        fileName
      ),
    };
  }

  async downloadObjectToFile(objectKey: string, targetPath: string) {
    const safeObjectKey = assertSafeObjectKey(objectKey);
    await mkdir(pathModule.dirname(targetPath), { recursive: true });
    if (this.isOss()) {
      await this.getOssClient().get(safeObjectKey, targetPath);
      return;
    }
    await copyFile(this.getLocalPath(safeObjectKey), targetPath);
  }

  async putProjectTemplateFile(
    projectTemplateId: string,
    templateNodeId: string,
    originalName: string,
    body: Buffer,
    contentType = "application/octet-stream"
  ): Promise<StoredObject> {
    const object = this.createObjectInDirectory(
      pathModule.posix.join(
        "project-templates",
        projectTemplateId,
        templateNodeId
      ),
      originalName
    );
    if (this.isOss()) {
      await this.getOssClient().put(object.objectKey, body, {
        headers: { "Content-Type": contentType },
      });
      return object;
    }

    const absolutePath = this.getLocalPath(object.objectKey);
    await mkdir(pathModule.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, body);
    return object;
  }

  async putConfirmationTemplateLibraryFile(
    originalName: string,
    body: Buffer,
    contentType = "application/octet-stream"
  ): Promise<StoredObject> {
    const object = this.createObjectInDirectory(
      "confirmation-template-library",
      originalName
    );
    if (this.isOss()) {
      await this.getOssClient().put(object.objectKey, body, {
        headers: { "Content-Type": contentType },
      });
      return object;
    }

    const absolutePath = this.getLocalPath(object.objectKey);
    await mkdir(pathModule.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, body);
    return object;
  }

  async putConfirmationResponseLibraryFile(
    originalName: string,
    body: Buffer,
    contentType = "application/octet-stream"
  ): Promise<StoredObject> {
    const object = this.createObjectInDirectory(
      "confirmation-response-library",
      originalName
    );
    if (this.isOss()) {
      await this.getOssClient().put(object.objectKey, body, {
        headers: { "Content-Type": contentType },
      });
      return object;
    }

    const absolutePath = this.getLocalPath(object.objectKey);
    await mkdir(pathModule.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, body);
    return object;
  }

  async copyObjectToWorkingPaper(
    projectId: string,
    paperId: string,
    originalName: string,
    sourceObjectKey: string,
    contentType = "application/octet-stream"
  ): Promise<StoredObject> {
    const sourceKey = assertSafeObjectKey(sourceObjectKey);
    const object = this.createObject(projectId, paperId, originalName);
    if (this.isOss()) {
      const client = this.getOssClient();
      const source = await client.head(sourceKey);
      const headers = source.res?.headers ?? {};
      const size = Number(
        headers["content-length"] ?? headers["Content-Length"]
      );
      // Simple OSS copy is limited to 1 GiB. Keep the existing transfer path
      // for larger/unknown objects instead of introducing a new size limit.
      if (Number.isSafeInteger(size) && size >= 0 && size <= 1024 ** 3) {
        const etag = optionalHeader(headers, "etag", "ETag");
        await client.copy(object.objectKey, sourceKey, {
          headers: {
            "Content-Type": contentType,
            "x-oss-forbid-overwrite": "true",
            ...(etag ? { "if-match": etag } : {}),
          },
        });
        return object;
      }
      const body = await this.getObjectBuffer(sourceKey);
      return this.putObject(
        projectId,
        paperId,
        originalName,
        body,
        contentType
      );
    }
    const destination = this.getLocalPath(object.objectKey);
    await mkdir(pathModule.dirname(destination), { recursive: true });
    await copyFile(this.getLocalPath(sourceKey), destination);
    return object;
  }

  createUploadGrant(
    projectId: string,
    paperId: string,
    originalName: string,
    contentType: string
  ): UploadGrant {
    const object = this.createObject(projectId, paperId, originalName);
    return {
      ...object,
      ...this.createUploadUrlForObject(object.objectKey, contentType),
    };
  }

  createReviewQuestionImageUploadGrant(
    projectId: string,
    questionId: string,
    originalName: string,
    contentType: string
  ): UploadGrant {
    const object = this.createObjectInDirectory(
      pathModule.posix.join("review-question-images", projectId, questionId),
      originalName
    );
    return {
      ...object,
      ...this.createUploadUrlForObject(object.objectKey, contentType),
    };
  }

  createProjectTemplateFileUploadGrant(
    projectTemplateId: string,
    templateNodeId: string,
    originalName: string,
    contentType: string
  ): UploadGrant {
    const object = this.createObjectInDirectory(
      pathModule.posix.join(
        "project-templates",
        projectTemplateId,
        templateNodeId
      ),
      originalName
    );
    return {
      ...object,
      ...this.createUploadUrlForObject(object.objectKey, contentType),
    };
  }

  async getObjectMetadata(objectKey: string): Promise<ObjectMetadata> {
    if (this.isOss()) {
      const result = await this.getOssClient().head(
        assertSafeObjectKey(objectKey)
      );
      const headers = result.res?.headers ?? {};
      return {
        contentLength: Number(
          headers["content-length"] ?? headers["Content-Length"] ?? 0
        ),
        contentType: String(
          headers["content-type"] ??
            headers["Content-Type"] ??
            "application/octet-stream"
        ),
        contentSha256: optionalHeader(
          headers,
          "x-oss-meta-sha256",
          "X-Oss-Meta-Sha256"
        ),
        contentCrc64: optionalHeader(
          headers,
          "x-oss-hash-crc64ecma",
          "X-Oss-Hash-Crc64ecma"
        ),
      };
    }

    const absolutePath = this.getLocalPath(objectKey);
    return {
      contentLength: statSync(absolutePath).size,
      contentType: "application/octet-stream",
    };
  }

  async getObjectBuffer(objectKey: string): Promise<Buffer> {
    if (this.isOss()) {
      const result = await this.getOssClient().get(
        assertSafeObjectKey(objectKey)
      );
      return Buffer.isBuffer(result.content)
        ? result.content
        : Buffer.from(result.content);
    }
    return readFile(this.getLocalPath(objectKey));
  }

  async getCacheObjectBuffer(objectKey: string): Promise<Buffer | null> {
    try {
      return await this.getObjectBuffer(objectKey);
    } catch (error) {
      if (isObjectNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  getDownloadObject(
    objectKey: string,
    fileName: string,
    mimeType: string
  ): DownloadObject {
    if (this.isOss()) {
      return {
        fileName,
        mimeType,
        redirectUrl: this.createDownloadUrl(objectKey),
      };
    }
    return {
      fileName,
      mimeType,
      absolutePath: this.getLocalPath(objectKey),
    };
  }

  getLocalReadStream(objectKey: string) {
    return createReadStream(this.getLocalPath(objectKey));
  }

  async getObjectReadStream(objectKey: string): Promise<Readable> {
    const safeObjectKey = assertSafeObjectKey(objectKey);
    if (this.isOss()) {
      const objectStream = await this.getOssClient().getStream(safeObjectKey);
      return objectStream.stream;
    }
    return createReadStream(this.getLocalPath(safeObjectKey));
  }

  async createResumableUploadGrant(input: {
    objectKey: string;
    contentType: string;
    fileSize: number;
    contentSha256: string;
    contentCrc64?: string;
    resumeUploadId?: string;
  }): Promise<ResumableUploadGrant> {
    const objectKey = assertSafeObjectKey(input.objectKey);
    if (!this.isOss()) {
      return { ok: true, mode: "PROXY" };
    }

    const existing = await this.getObjectMetadata(objectKey).catch(() => null);
    if (
      existing?.contentLength === input.fileSize &&
      existing.contentSha256 === input.contentSha256 &&
      (!input.contentCrc64 || existing.contentCrc64 === input.contentCrc64)
    ) {
      return { ok: true, mode: "ALREADY_UPLOADED", objectKey };
    }

    const ttl = getDesktopTransferSignedUrlTtlSeconds(input.fileSize);
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    if (input.fileSize < getDesktopMultipartThresholdBytes()) {
      const headers = {
        "Content-Type": input.contentType || "application/octet-stream",
        "x-oss-meta-sha256": input.contentSha256,
        "x-oss-forbid-overwrite": "true",
      };
      return {
        ok: true,
        mode: "DIRECT_PUT",
        objectKey,
        uploadUrl: this.getBrowserOssClient().signatureUrl(objectKey, {
          method: "PUT",
          expires: ttl,
          ...headers,
        }),
        headers,
        expiresAt,
      };
    }

    const partSize = getDesktopMultipartPartSizeBytes(input.fileSize);
    let uploadId = input.resumeUploadId;
    let uploadedParts: { partNumber: number; etag: string }[] = [];
    if (uploadId) {
      try {
        const listed = await this.getOssClient().listParts(objectKey, uploadId);
        uploadedParts = (listed.parts ?? []).map((part) => ({
          partNumber: part.number,
          etag: part.etag,
        }));
      } catch (error) {
        if (!isNoSuchUploadError(error)) {
          throw error;
        }
        uploadId = undefined;
      }
    }
    if (!uploadId) {
      const initializedUpload = await this.getOssClient().initMultipartUpload(
        objectKey,
        {
          headers: {
            "Content-Type": input.contentType || "application/octet-stream",
            "x-oss-meta-sha256": input.contentSha256,
          },
        }
      );
      ({ uploadId } = initializedUpload);
    }
    const partCount = Math.ceil(input.fileSize / partSize);
    return {
      ok: true,
      mode: "DIRECT_MULTIPART",
      objectKey,
      uploadId,
      partSize,
      uploadedParts,
      parts: Array.from({ length: partCount }, (_, index) => {
        const partNumber = index + 1;
        return {
          partNumber,
          uploadUrl: this.getBrowserOssClient().signatureUrl(objectKey, {
            method: "PUT",
            expires: ttl,
            subResource: { partNumber, uploadId },
          }),
        };
      }),
      expiresAt,
    };
  }

  async completeResumableUpload(input: {
    objectKey: string;
    uploadId: string;
    parts: { partNumber: number; etag: string }[];
    fileSize: number;
    contentSha256: string;
    contentCrc64?: string;
  }) {
    const objectKey = assertSafeObjectKey(input.objectKey);
    if (!this.isOss()) {
      throw new Error("Direct multipart upload requires OSS storage.");
    }
    const existing = await this.getObjectMetadata(objectKey).catch(() => null);
    if (
      existing?.contentLength !== input.fileSize ||
      existing.contentSha256 !== input.contentSha256 ||
      (input.contentCrc64 && existing.contentCrc64 !== input.contentCrc64)
    ) {
      await this.getOssClient().completeMultipartUpload(
        objectKey,
        input.uploadId,
        [...input.parts]
          .sort((left, right) => left.partNumber - right.partNumber)
          .map((part) => ({ number: part.partNumber, etag: part.etag }))
      );
    }
    return this.assertUploadedObject(
      objectKey,
      input.fileSize,
      input.contentSha256,
      input.contentCrc64
    );
  }

  async assertUploadedObject(
    objectKey: string,
    fileSize: number,
    contentSha256: string,
    contentCrc64?: string
  ) {
    const safeObjectKey = assertSafeObjectKey(objectKey);
    let metadata: ObjectMetadata | undefined;
    let verificationError: unknown;
    for (let attempt = 0; ; attempt += 1) {
      try {
        metadata = await this.getObjectMetadata(safeObjectKey);
        break;
      } catch (error) {
        verificationError = error;
        if (attempt >= 2) {
          break;
        }
        await delay(100 * 2 ** attempt);
      }
    }
    if (!metadata) {
      if (isObjectNotFoundError(verificationError)) {
        throw new ApiConflictException(
          "DIRECT_UPLOAD_NOT_FOUND",
          "The direct upload object is not available yet."
        );
      }
      throw new ApiServiceUnavailableException(
        "DIRECT_UPLOAD_VERIFY_UNAVAILABLE",
        "Object storage could not verify the direct upload."
      );
    }
    if (metadata.contentLength !== fileSize) {
      throw new ApiConflictException(
        "DIRECT_UPLOAD_SIZE_MISMATCH",
        "The direct upload object size does not match the commit."
      );
    }
    if (this.isOss() && metadata.contentSha256 !== contentSha256) {
      throw new ApiConflictException(
        "DIRECT_UPLOAD_HASH_MISMATCH",
        "The direct upload object hash does not match the commit."
      );
    }
    if (
      this.isOss() &&
      contentCrc64 &&
      metadata.contentCrc64 !== contentCrc64
    ) {
      throw new ApiConflictException(
        "DIRECT_UPLOAD_CRC64_MISMATCH",
        "The object-storage CRC64 does not match the local upload."
      );
    }
    return { objectKey: safeObjectKey, metadata };
  }

  private createUploadUrlForObject(
    objectKey: string,
    contentType: string
  ): Pick<UploadGrant, "uploadUrl" | "method" | "headers" | "expiresAt"> {
    const ttl = getSignedUrlTtlSeconds();
    const headers = {
      "Content-Type": contentType || "application/octet-stream",
      "x-oss-forbid-overwrite": "true",
    };
    const uploadUrl = this.isOss()
      ? this.getBrowserOssClient().signatureUrl(
          assertSafeObjectKey(objectKey),
          {
            method: "PUT",
            expires: ttl,
            "Content-Type": headers["Content-Type"],
            "x-oss-forbid-overwrite": headers["x-oss-forbid-overwrite"],
          }
        )
      : this.createLocalUploadUrl(objectKey);
    return {
      uploadUrl,
      method: "PUT",
      headers,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    };
  }

  private async putFixedObject(
    objectKey: string,
    body: Buffer,
    contentType: string
  ): Promise<StoredObject> {
    const safeObjectKey = assertSafeObjectKey(objectKey);
    if (this.isOss()) {
      await this.getOssClient().put(safeObjectKey, body, {
        headers: {
          "Content-Type": contentType,
          "x-oss-forbid-overwrite": "true",
        },
      });
    } else {
      const absolutePath = this.getLocalPath(safeObjectKey);
      await mkdir(pathModule.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, body, { flag: "wx" });
    }
    return {
      fileName: pathModule.basename(safeObjectKey),
      objectKey: safeObjectKey,
    };
  }

  private createDownloadUrl(objectKey: string) {
    return this.getBrowserOssClient().signatureUrl(
      assertSafeObjectKey(objectKey),
      {
        method: "GET",
        expires: getSignedUrlTtlSeconds(),
      }
    );
  }

  private createObject(
    projectId: string,
    paperId: string,
    originalName: string
  ): StoredObject {
    return this.createObjectInDirectory(
      pathModule.posix.join("working-papers", projectId, paperId),
      originalName
    );
  }

  private createObjectInDirectory(
    directory: string,
    originalName: string
  ): StoredObject {
    const safeOriginalName = sanitizeFileName(originalName);
    const fileName = `${Date.now()}-${randomUUID()}${pathModule.extname(safeOriginalName)}`;
    return {
      fileName,
      objectKey: pathModule.posix.join(directory, fileName),
    };
  }

  private getLocalPath(objectKey: string) {
    const safeObjectKey = assertSafeObjectKey(objectKey);
    const primaryPath = pathModule.join(getUploadRoot(), safeObjectKey);
    if (process.env.UPLOAD_DIR || existsSync(primaryPath)) {
      return primaryPath;
    }

    const legacyPath = pathModule.join(process.cwd(), "uploads", safeObjectKey);
    return existsSync(legacyPath) ? legacyPath : primaryPath;
  }

  private createLocalUploadUrl(objectKey: string) {
    return `local://${objectKey}`;
  }

  private isOss() {
    return process.env.STORAGE_DRIVER === "oss";
  }

  private getOssClient(): OssClient {
    if (!this.ossClient) {
      this.ossClient = new OSS(
        this.createOssClientOptions("server")
      ) as unknown as OssClient;
    }
    return this.ossClient;
  }

  private getBrowserOssClient(): OssClient {
    if (!this.browserOssClient) {
      this.browserOssClient = new OSS(
        this.createOssClientOptions("browser")
      ) as unknown as OssClient;
    }
    return this.browserOssClient;
  }

  private createOssClientOptions(target: "server" | "browser") {
    const useInternal =
      target === "server" && process.env.OSS_USE_INTERNAL_ENDPOINT === "true";
    return {
      region: requireEnv("OSS_REGION"),
      bucket: requireEnv("OSS_BUCKET"),
      endpoint: useInternal
        ? (process.env.OSS_INTERNAL_ENDPOINT ?? process.env.OSS_ENDPOINT)
        : process.env.OSS_ENDPOINT,
      internal: useInternal,
      accessKeyId: requireEnv("OSS_ACCESS_KEY_ID"),
      accessKeySecret: requireEnv("OSS_ACCESS_KEY_SECRET"),
      secure: true,
    };
  }
}

function getUploadRoot() {
  if (process.env.UPLOAD_DIR) {
    return process.env.UPLOAD_DIR;
  }

  let directory = process.cwd();
  while (true) {
    if (existsSync(pathModule.join(directory, "pnpm-workspace.yaml"))) {
      return pathModule.join(directory, "uploads");
    }
    const parent = pathModule.dirname(directory);
    if (parent === directory) {
      return pathModule.join(process.cwd(), "uploads");
    }
    directory = parent;
  }
}

function getSignedUrlTtlSeconds() {
  const parsed = Number(process.env.OSS_SIGNED_URL_TTL_SECONDS ?? 300);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 300;
}

function getDesktopTransferSignedUrlTtlSeconds(fileSize: number) {
  const parsed = Number(
    process.env.OSS_DESKTOP_TRANSFER_URL_TTL_SECONDS ?? 3600
  );
  const configuredTtl =
    Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 3600;
  const sizeAwareTtl = Math.ceil(fileSize / (64 * 1024)) + 15 * 60;
  return Math.max(configuredTtl, Math.min(sizeAwareTtl, 6 * 60 * 60));
}

function getDesktopMultipartThresholdBytes() {
  return positiveIntegerEnv(
    "OSS_DESKTOP_MULTIPART_THRESHOLD_BYTES",
    32 * 1024 * 1024
  );
}

function getDesktopMultipartPartSizeBytes(fileSize: number) {
  return Math.max(
    100 * 1024,
    Math.ceil(fileSize / 10_000),
    positiveIntegerEnv("OSS_DESKTOP_MULTIPART_PART_SIZE_BYTES", 8 * 1024 * 1024)
  );
}

function positiveIntegerEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name] ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function optionalHeader(headers: Record<string, unknown>, ...names: string[]) {
  for (const name of names) {
    const value = headers[name];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
}

function isObjectNotFoundError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as {
    code?: unknown;
    name?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };
  return (
    candidate.code === "NoSuchKey" ||
    candidate.code === "ENOENT" ||
    candidate.name === "NoSuchKeyError" ||
    candidate.status === 404 ||
    candidate.statusCode === 404
  );
}

function isStorageAlreadyExistsError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as {
    code?: unknown;
    name?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };
  return (
    candidate.code === "EEXIST" ||
    candidate.code === "FileAlreadyExists" ||
    candidate.code === "ObjectAlreadyExists" ||
    candidate.code === "PreconditionFailed" ||
    candidate.name === "FileExistsError" ||
    candidate.status === 409 ||
    candidate.statusCode === 409
  );
}

function safeStorageOperationError(message: string) {
  const error = new Error(message);
  error.name = "StorageOperationError";
  return error;
}

function isNoSuchUploadError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as {
    code?: unknown;
    name?: unknown;
  };
  return (
    candidate.code === "NoSuchUpload" || candidate.name === "NoSuchUploadError"
  );
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for OSS storage`);
  }
  return value;
}

function sanitizeFileName(fileName: string) {
  return pathModule.basename(fileName).replaceAll(/[^a-zA-Z0-9._-]/g, "_");
}

function assertSafeObjectKey(objectKey: string) {
  if (
    !objectKey ||
    objectKey.startsWith("/") ||
    objectKey.includes("\\") ||
    /^[a-zA-Z]:/.test(objectKey) ||
    pathModule.posix.normalize(objectKey) !== objectKey ||
    objectKey.startsWith("../") ||
    objectKey === ".."
  ) {
    throw new Error("Unsafe object key");
  }
  return objectKey;
}

function assertSafeObjectSegment(value: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error("Unsafe object segment");
  }
  return value;
}

function extensionForContentType(contentType: string) {
  switch (contentType.toLowerCase()) {
    case "application/pdf": {
      return "pdf";
    }
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      return "docx";
    }
    case "image/jpeg": {
      return "jpg";
    }
    case "image/png": {
      return "png";
    }
    default: {
      return "bin";
    }
  }
}
