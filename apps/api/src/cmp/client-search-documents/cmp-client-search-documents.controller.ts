import { readFile } from "node:fs/promises";

import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { CmpClientSearchDocumentCategory } from "@prisma/client";
import type { Response } from "express";

import type { AuditLogSource } from "../../audit-logs/audit-log-source";
import { AuditSource } from "../../audit-logs/audit-source.decorator";
import { AuthGuard } from "../../auth/auth.guard";
import { CurrentUser } from "../../auth/current-user.decorator";
import { SkipDeclarationGate } from "../../auth/declaration-gate.decorator";
import type { RequestUser } from "../../auth/request-user";
import { ApiBadRequestException } from "../../common/api-error";
import { CmpClientSearchDocumentsService } from "./cmp-client-search-documents.service";
import type { UploadedCmpSearchDocument } from "./cmp-client-search-documents.service";

@Controller("cmp")
@UseGuards(AuthGuard)
@SkipDeclarationGate()
export class CmpClientSearchDocumentsController {
  constructor(private readonly documents: CmpClientSearchDocumentsService) {}

  @Get("clients/:clientId/search-documents")
  list(@Param("clientId") clientId: string, @Query("category") value: string) {
    return this.documents.list(clientId, parseCategory(value));
  }

  @Post("clients/:clientId/search-documents")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 50 * 1024 * 1024 } })
  )
  upload(
    @Param("clientId") clientId: string,
    @Query("category") value: string,
    @UploadedFile() file: UploadedCmpSearchDocument | undefined,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.documents.upload(
      clientId,
      parseCategory(value),
      file,
      user,
      source
    );
  }

  @Get("client-search-documents/:documentId/download")
  async download(
    @Param("documentId") documentId: string,
    @Res() response: Response
  ) {
    const { document, file } = await this.documents.download(documentId);
    response.type(document.mimeType);
    response.setHeader(
      "Content-Disposition",
      attachmentDisposition(document.originalName)
    );
    if (file.redirectUrl) {
      return response.redirect(302, file.redirectUrl);
    }
    if (!file.absolutePath) {
      throw new ApiBadRequestException("BAD_REQUEST", "File is unavailable");
    }
    return response.send(await readFile(file.absolutePath));
  }

  @Delete("client-search-documents/:documentId")
  remove(
    @Param("documentId") documentId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.documents.remove(documentId, user, source);
  }
}

function parseCategory(value: string): CmpClientSearchDocumentCategory {
  if (value === "AML_SEARCH" || value === "COMPANY_SEARCH") {
    return value;
  }
  throw new ApiBadRequestException(
    "VALIDATION_FAILED",
    "Search category is invalid"
  );
}

function attachmentDisposition(fileName: string) {
  return `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
