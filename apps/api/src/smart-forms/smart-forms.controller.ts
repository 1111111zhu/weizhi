import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  CreateProjectSmartFormSchema,
  CreateSmartFormTemplateSchema,
  SaveSmartFormPackageSchema,
  SmartFormTemplateListQuerySchema,
  SmartFormV2DefinitionSchema,
  SmartFormV2LocaleTagSchema,
  SmartFormV2ResponseSchema,
  UpdateSmartFormTemplateSchema,
} from "@project-wing/shared";
import { z } from "zod";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditSource } from "../audit-logs/audit-source.decorator";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequireGlobalRoles } from "../auth/global-roles.decorator";
import { GlobalRolesGuard } from "../auth/global-roles.guard";
import type { RequestUser } from "../auth/request-user";
import { ApiBadRequestException } from "../common/api-error";
import { SmartFormV2PdfService } from "./smart-form-v2-pdf.service";
import { SmartFormsService } from "./smart-forms.service";

@UseGuards(AuthGuard)
@Controller()
export class SmartFormsController {
  constructor(
    private readonly smartForms: SmartFormsService,
    private readonly smartFormV2Pdf: SmartFormV2PdfService
  ) {}

  @Post("smart-form-v2/pdf")
  @Header("Content-Type", "application/pdf")
  @Header("Content-Disposition", "inline; filename=smartform-v2.pdf")
  async renderSmartFormV2Pdf(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = z
      .object({
        definition: SmartFormV2DefinitionSchema,
        response: SmartFormV2ResponseSchema.optional(),
        locale: SmartFormV2LocaleTagSchema.optional(),
        fileName: z.string().trim().max(255).optional(),
        documentVersion: z.union([z.string(), z.number()]).optional(),
        projectId: z.string().trim().min(1),
      })
      .strict()
      .safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "SmartForm V2 PDF payload is invalid"
      );
    }
    const { projectId, ...input } = parsed.data;
    const engagementDetails =
      await this.smartForms.getSmartFormV2PdfEngagementDetails(
        projectId,
        user,
        input.locale
      );
    return this.smartFormV2Pdf.renderSmartFormV2Pdf({
      ...input,
      engagementDetails,
    });
  }

  @Get("admin/smart-form-templates")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  adminList(@Query() query: unknown) {
    const parsed = SmartFormTemplateListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Smart Form template query is invalid"
      );
    }
    return this.smartForms.adminListTemplates(parsed.data);
  }

  @Post("admin/smart-form-templates")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  createTemplate(@Body() body: unknown, @CurrentUser() user: RequestUser) {
    const parsed = CreateSmartFormTemplateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Smart Form template payload is invalid"
      );
    }
    return this.smartForms.createTemplate(parsed.data, user);
  }

  @Patch("admin/smart-form-templates/:templateId")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  updateTemplate(
    @Param("templateId") templateId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = UpdateSmartFormTemplateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Smart Form template update is invalid"
      );
    }
    return this.smartForms.updateTemplate(templateId, parsed.data, user);
  }

  @Post("admin/smart-form-templates/:templateId/publish")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  publishTemplate(
    @Param("templateId") templateId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.smartForms.publishTemplate(templateId, user);
  }

  @Delete("admin/smart-form-templates/:templateId")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  archiveTemplate(
    @Param("templateId") templateId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.smartForms.archiveTemplate(templateId, user);
  }

  @Get("smart-form-templates")
  listPublishedTemplates(@Query() query: unknown) {
    const parsed = SmartFormTemplateListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Smart Form template query is invalid"
      );
    }
    return this.smartForms.listPublishedTemplates(parsed.data);
  }

  @Post("engagement/:projectId/workflow/nodes/:nodeId/smart-forms")
  createProjectSmartForm(
    @Param("projectId") projectId: string,
    @Param("nodeId") nodeId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CreateProjectSmartFormSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Smart Form creation payload is invalid"
      );
    }
    return this.smartForms.createProjectSmartForm(
      projectId,
      nodeId,
      parsed.data,
      user,
      source
    );
  }

  @Post(
    "engagement/:projectId/workflow/attachments/:attachmentId/smart-form/open"
  )
  openProjectSmartForm(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.smartForms.openMaster(projectId, attachmentId, user, source);
  }

  @Get("engagement/:projectId/workflow/attachments/:attachmentId/smart-form")
  readProjectSmartForm(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.smartForms.readOnly(projectId, attachmentId, user);
  }

  @Post(
    "engagement/:projectId/workflow/attachments/:attachmentId/smart-form/save"
  )
  saveProjectSmartForm(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = SaveSmartFormPackageSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Smart Form save payload is invalid"
      );
    }
    return this.smartForms.save(
      projectId,
      attachmentId,
      parsed.data,
      user,
      source
    );
  }

  @Post(
    "engagement/:projectId/workflow/attachments/:attachmentId/smart-form/close"
  )
  closeProjectSmartForm(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = SaveSmartFormPackageSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Smart Form close payload is invalid"
      );
    }
    return this.smartForms.close(
      projectId,
      attachmentId,
      parsed.data,
      user,
      source
    );
  }

  @Post(
    "engagement/:projectId/workflow/attachments/:attachmentId/smart-form/discard"
  )
  discardProjectSmartForm(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = z
      .object({ lockSessionId: z.string().trim().min(1) })
      .safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Smart Form discard payload is invalid"
      );
    }
    return this.smartForms.discard(
      projectId,
      attachmentId,
      parsed.data,
      user,
      source
    );
  }
}
