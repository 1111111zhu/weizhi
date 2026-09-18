import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import {
  ApplyProjectTemplateSchema,
  ConfirmProjectTemplateFileUploadSchema,
  CreateProjectTemplateNodeSchema,
  CreateProjectTemplatePlaceholderSchema,
  CreateProjectTemplateSchema,
  CreateProjectTemplateSmartFormSchema,
  ImportProjectTemplateZipSchema,
  ProjectTemplateFileInputSchema,
  ProjectTemplateListQuerySchema,
  ReorderProjectTemplateItemsSchema,
  RequestProjectTemplateFileUploadUrlSchema,
  UpdateProjectTemplateItemCodeSchema,
  UpdateProjectTemplateNodeSchema,
  UpdateProjectTemplateSchema,
} from "@project-wing/shared";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditSource } from "../audit-logs/audit-source.decorator";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequireGlobalRoles } from "../auth/global-roles.decorator";
import { GlobalRolesGuard } from "../auth/global-roles.guard";
import type { RequestUser } from "../auth/request-user";
import { ApiBadRequestException } from "../common/api-error";
import { ProjectTemplatesService } from "./project-templates.service";
import type { UploadedProjectTemplateFile } from "./project-templates.service";

@UseGuards(AuthGuard)
@Controller()
export class ProjectTemplatesController {
  constructor(private readonly templates: ProjectTemplatesService) {}

  @Get("project-templates")
  list(@Query() query: unknown) {
    const parsed = ProjectTemplateListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Project template query is invalid"
      );
    }
    return this.templates.list(parsed.data);
  }

  @Get("project-templates/:templateId")
  get(@Param("templateId") templateId: string) {
    return this.templates.get(templateId);
  }

  @Post("engagement/:projectId/project-templates/:templateId/preview")
  previewApply(
    @Param("projectId") projectId: string,
    @Param("templateId") templateId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = ApplyProjectTemplateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Project template application target is invalid"
      );
    }
    return this.templates.previewApplyToProject(
      projectId,
      templateId,
      parsed.data,
      user
    );
  }

  @Post("engagement/:projectId/project-templates/:templateId/apply")
  apply(
    @Param("projectId") projectId: string,
    @Param("templateId") templateId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = ApplyProjectTemplateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Project template application target is invalid"
      );
    }
    return this.templates.applyToProject(
      projectId,
      templateId,
      parsed.data,
      user,
      source
    );
  }

  @Get("admin/project-templates")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  adminList(@Query() query: unknown) {
    const parsed = ProjectTemplateListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Project template query is invalid"
      );
    }
    return this.templates.list(parsed.data, { includeAllStatuses: true });
  }

  @Get("admin/project-templates/:templateId")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  adminGet(@Param("templateId") templateId: string) {
    return this.templates.get(templateId, { includeAllStatuses: true });
  }

  @Get("admin/project-templates/:templateId/files/:fileId/preview")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  async previewFile(
    @Param("templateId") templateId: string,
    @Param("fileId") fileId: string,
    @CurrentUser() user: RequestUser,
    @Res() response: Response
  ) {
    const file = await this.templates.previewFile(templateId, fileId, user);
    response.type(file.mimeType);
    response.setHeader("Content-Length", file.body.byteLength);
    response.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
    );
    return response.send(file.body);
  }

  @Post("admin/project-templates")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  create(@Body() body: unknown, @CurrentUser() user: RequestUser) {
    const parsed = CreateProjectTemplateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Project template payload is invalid"
      );
    }
    return this.templates.create(parsed.data, user);
  }

  @Post("admin/project-templates/import-zip")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  @UseInterceptors(FileInterceptor("file"))
  importZip(
    @Body() body: unknown,
    @UploadedFile() file: UploadedProjectTemplateFile,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = ImportProjectTemplateZipSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Project template import metadata is invalid"
      );
    }
    return this.templates.importZip(parsed.data, file, user);
  }

  @Patch("admin/project-templates/:templateId")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  update(
    @Param("templateId") templateId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = UpdateProjectTemplateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Project template update is invalid"
      );
    }
    return this.templates.update(templateId, parsed.data, user);
  }

  @Delete("admin/project-templates/:templateId")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  archive(
    @Param("templateId") templateId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.templates.archive(templateId, user);
  }

  @Post("admin/project-templates/:templateId/nodes")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  createNode(
    @Param("templateId") templateId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = CreateProjectTemplateNodeSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Project template folder payload is invalid"
      );
    }
    return this.templates.createNode(templateId, parsed.data, user);
  }

  @Patch("admin/project-templates/:templateId/nodes/:nodeId")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  updateNode(
    @Param("templateId") templateId: string,
    @Param("nodeId") nodeId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = UpdateProjectTemplateNodeSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Project template folder update is invalid"
      );
    }
    return this.templates.updateNode(templateId, nodeId, parsed.data, user);
  }

  @Delete("admin/project-templates/:templateId/nodes/:nodeId")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  deleteNode(
    @Param("templateId") templateId: string,
    @Param("nodeId") nodeId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.templates.deleteNode(templateId, nodeId, user);
  }

  @Post("admin/project-templates/:templateId/nodes/:nodeId/smart-forms")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  createSmartFormReference(
    @Param("templateId") templateId: string,
    @Param("nodeId") nodeId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = CreateProjectTemplateSmartFormSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Project template Smart Form payload is invalid"
      );
    }
    return this.templates.createSmartFormReference(
      templateId,
      nodeId,
      parsed.data,
      user
    );
  }

  @Post("admin/project-templates/:templateId/nodes/:nodeId/placeholders")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  createPlaceholder(
    @Param("templateId") templateId: string,
    @Param("nodeId") nodeId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = CreateProjectTemplatePlaceholderSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Project template leave-blank payload is invalid"
      );
    }
    return this.templates.createPlaceholder(
      templateId,
      nodeId,
      parsed.data,
      user
    );
  }

  @Delete("admin/project-templates/:templateId/smart-forms/:referenceId")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  deleteSmartFormReference(
    @Param("templateId") templateId: string,
    @Param("referenceId") referenceId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.templates.deleteSmartFormReference(
      templateId,
      referenceId,
      user
    );
  }

  @Patch("admin/project-templates/:templateId/smart-forms/:referenceId")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  updateSmartFormReferenceCode(
    @Param("templateId") templateId: string,
    @Param("referenceId") referenceId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = UpdateProjectTemplateItemCodeSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Project template Smart Form code update is invalid"
      );
    }
    return this.templates.updateSmartFormReferenceCode(
      templateId,
      referenceId,
      parsed.data,
      user
    );
  }

  @Put("admin/project-templates/:templateId/nodes/:nodeId/items/order")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  reorderItems(
    @Param("templateId") templateId: string,
    @Param("nodeId") nodeId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = ReorderProjectTemplateItemsSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Project template item order is invalid"
      );
    }
    return this.templates.reorderItems(templateId, nodeId, parsed.data, user);
  }

  @Post("admin/project-templates/:templateId/nodes/:nodeId/files/upload-url")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  createFileUploadGrant(
    @Param("templateId") templateId: string,
    @Param("nodeId") nodeId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = RequestProjectTemplateFileUploadUrlSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Project template file upload metadata is invalid"
      );
    }
    return this.templates.createFileUploadGrant(
      templateId,
      nodeId,
      parsed.data,
      user
    );
  }

  @Post("admin/project-templates/:templateId/nodes/:nodeId/files/confirm")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  confirmFileUpload(
    @Param("templateId") templateId: string,
    @Param("nodeId") nodeId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = ConfirmProjectTemplateFileUploadSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Project template file upload confirmation is invalid"
      );
    }
    return this.templates.confirmFileUpload(
      templateId,
      nodeId,
      parsed.data,
      user
    );
  }

  @Post("admin/project-templates/:templateId/nodes/:nodeId/files")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  @UseInterceptors(FileInterceptor("file"))
  uploadFile(
    @Param("templateId") templateId: string,
    @Param("nodeId") nodeId: string,
    @Body() body: unknown,
    @UploadedFile() file: UploadedProjectTemplateFile,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = ProjectTemplateFileInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Project template file payload is invalid"
      );
    }
    return this.templates.uploadFile(
      templateId,
      nodeId,
      parsed.data,
      file,
      user
    );
  }

  @Delete("admin/project-templates/:templateId/files/:fileId")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  deleteFile(
    @Param("templateId") templateId: string,
    @Param("fileId") fileId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.templates.deleteFile(templateId, fileId, user);
  }

  @Patch("admin/project-templates/:templateId/files/:fileId")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  updateFileCode(
    @Param("templateId") templateId: string,
    @Param("fileId") fileId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = UpdateProjectTemplateItemCodeSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Project template file code update is invalid"
      );
    }
    return this.templates.updateFileCode(templateId, fileId, parsed.data, user);
  }
}
