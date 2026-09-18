import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditSource } from "../audit-logs/audit-source.decorator";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { SkipDeclarationGate } from "../auth/declaration-gate.decorator";
import { RequireGlobalRoles } from "../auth/global-roles.decorator";
import { GlobalRolesGuard } from "../auth/global-roles.guard";
import type { RequestUser } from "../auth/request-user";
import { KnowledgeService } from "./knowledge.service";
import type {
  CreateKnowledgeDocumentInput,
  UploadedKnowledgeDocumentFile,
} from "./knowledge.service";

@UseGuards(AuthGuard)
@SkipDeclarationGate()
@Controller("knowledge-documents")
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get()
  list() {
    return this.knowledge.list();
  }

  @Post()
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN", "PARTNER")
  @UseInterceptors(knowledgeFilesInterceptor())
  upload(
    @Body() body: CreateKnowledgeDocumentInput,
    @UploadedFiles() files:
      | KnowledgeUploadFiles
      | UploadedKnowledgeDocumentFile
      | undefined,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const normalized = normalizeKnowledgeUploadFiles(files);
    return normalized.attachments?.length
      ? this.knowledge.upload(
          body,
          normalized.file?.[0],
          user,
          source,
          normalized.attachments
        )
      : this.knowledge.upload(body, normalized.file?.[0], user, source);
  }

  @Get("archived")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN", "PARTNER")
  listArchived() {
    return this.knowledge.listArchived();
  }

  @Patch(":id")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN", "PARTNER")
  @UseInterceptors(knowledgeFilesInterceptor())
  update(
    @Param("id") id: string,
    @Body() body: CreateKnowledgeDocumentInput,
    @UploadedFiles() files:
      | KnowledgeUploadFiles
      | UploadedKnowledgeDocumentFile
      | undefined,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const normalized = normalizeKnowledgeUploadFiles(files);
    return normalized.attachments?.length
      ? this.knowledge.update(
          id,
          body,
          normalized.file?.[0],
          user,
          source,
          normalized.attachments
        )
      : this.knowledge.update(id, body, normalized.file?.[0], user, source);
  }

  @Post(":id/archive")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN", "PARTNER")
  archive(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.knowledge.archive(id, user, source);
  }

  @Post(":id/restore")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN", "PARTNER")
  restore(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.knowledge.restore(id, user, source);
  }

  @Delete(":id")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN", "PARTNER")
  remove(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.knowledge.remove(id, user, source);
  }

  @Get("attachments/:attachmentId/download")
  async downloadAttachment(
    @Param("attachmentId") attachmentId: string,
    @Res() response: Response
  ) {
    const file = await this.knowledge.getAttachment(attachmentId, "download");
    response.type(file.mimeType);
    response.setHeader("ETag", file.etag);
    response.setHeader(
      "Content-Disposition",
      contentDisposition("attachment", file.fileName)
    );
    return response.send(file.body);
  }

  @Get("attachments/:attachmentId/preview")
  async previewAttachment(
    @Param("attachmentId") attachmentId: string,
    @Res() response: Response
  ) {
    const file = await this.knowledge.getAttachment(attachmentId, "preview");
    response.type(file.mimeType);
    response.setHeader("ETag", file.etag);
    response.setHeader(
      "Content-Disposition",
      contentDisposition("inline", file.fileName)
    );
    return response.send(file.body);
  }

  @Get(":id/preview")
  async preview(@Param("id") id: string, @Res() response: Response) {
    await Promise.resolve();
    return this.sendFile(id, "inline", response);
  }

  @Get(":id/download")
  async download(@Param("id") id: string, @Res() response: Response) {
    await Promise.resolve();
    return this.sendFile(id, "attachment", response);
  }

  private async sendFile(
    id: string,
    disposition: "inline" | "attachment",
    response: Response
  ) {
    const file = await this.knowledge.getFile(
      id,
      disposition === "inline" ? "preview" : "download"
    );
    response.type(file.mimeType);
    response.setHeader("ETag", file.etag);
    response.setHeader(
      "Content-Disposition",
      contentDisposition(disposition, file.fileName)
    );
    return response.send(file.body);
  }
}

type KnowledgeUploadFiles = {
  file?: UploadedKnowledgeDocumentFile[];
  attachments?: UploadedKnowledgeDocumentFile[];
};

function knowledgeFilesInterceptor() {
  return FileFieldsInterceptor(
    [
      { name: "file", maxCount: 1 },
      { name: "attachments", maxCount: 20 },
    ],
    { limits: { fileSize: 20 * 1024 * 1024 } }
  );
}

function normalizeKnowledgeUploadFiles(
  files: KnowledgeUploadFiles | UploadedKnowledgeDocumentFile | undefined
): KnowledgeUploadFiles {
  if (!files) {
    return {};
  }
  if ("buffer" in files) {
    return { file: [files] };
  }
  return files;
}

function contentDisposition(
  disposition: "inline" | "attachment",
  fileName: string
) {
  const safeAsciiName = fileName
    .replaceAll(/[^\u0020-\u007E]/g, "_")
    .replaceAll(/["\\]/g, "_");
  return `${disposition}; filename="${safeAsciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
