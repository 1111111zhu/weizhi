import { createHash, randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { ConfirmationDraftTemplateCode } from "@project-wing/shared";
import { isConfirmationCustomTemplateCode } from "@project-wing/shared";

import { ApiBadRequestException } from "../common/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import type { ConfirmationDerivedSnapshot } from "./confirmation-derived-data.service";
import { ConfirmationDocumentService } from "./confirmation-document.service";
import type { ConfirmationDocumentRecord } from "./confirmation-document.service";
import { getDefaultConfirmationTemplateDesign } from "./confirmation-template-design-defaults";
import { getConfirmationTemplateDefinition } from "./confirmation-template-registry";

const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const TEMPLATE_CODES: ConfirmationDraftTemplateCode[] = [
  "PRC_BANK_TEMPLATE_1",
  "PRC_BANK_TEMPLATE_2",
  "SHINEWING_ENG_BANK",
  "STANDARD_FINANCIAL_INSTITUTION",
  "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
  "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
  "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
];
const MANAGED_TEMPLATE_CODES = new Set<ConfirmationDraftTemplateCode>([
  "STANDARD_FINANCIAL_INSTITUTION",
  "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
  "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
  "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
]);

type ArtifactPersistenceClient = PrismaService | Prisma.TransactionClient;

type BuiltInTemplateOverrideClient = {
  findUnique: (args: unknown) => Promise<{
    designStatus: string;
    designSchema: unknown;
  } | null>;
};

export type CreateConfirmationArtifactInput = {
  confirmation: ConfirmationDocumentRecord;
  derivedSnapshot: ConfirmationDerivedSnapshot;
  version: number;
  submissionKey: string;
  submittedBy: string;
  submittedAt?: Date;
  artifactId?: string;
};

@Injectable()
export class ConfirmationArtifactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: ConfirmationDocumentService,
    private readonly storage: StorageService
  ) {}

  async create(
    input: CreateConfirmationArtifactInput,
    persistence: ArtifactPersistenceClient = this.prisma
  ) {
    if (input.submittedBy !== input.derivedSnapshot.contactUserId) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Submitter must match the authoritative project contact"
      );
    }
    const templateCode = requireTemplateCode(
      input.confirmation.draftTemplateCode
    );
    const renderingConfirmation = await attachLatestEnabledManagedDesign(
      persistence,
      input.confirmation,
      templateCode
    );
    const structuredSnapshot = deepCopyJson(renderingConfirmation.draftPayload);
    assertRequiredTemplateCheckboxes(structuredSnapshot);
    const derivedSnapshot = structuredClone(input.derivedSnapshot);
    const artifactId = input.artifactId ?? randomUUID();
    const rendered = await this.documents.renderArtifactFiles({
      confirmation: {
        ...renderingConfirmation,
        draftPayload: structuredSnapshot,
      },
      derivedSnapshot,
    });
    const writtenFormats: ("docx" | "pdf")[] = [];
    try {
      const docxObject = await this.storage.putConfirmationArtifact(
        input.confirmation.projectId,
        input.confirmation.id,
        artifactId,
        "docx",
        rendered.docx,
        DOCX_MIME_TYPE
      );
      writtenFormats.push("docx");
      const pdfObject = await this.storage.putConfirmationArtifact(
        input.confirmation.projectId,
        input.confirmation.id,
        artifactId,
        "pdf",
        rendered.pdf,
        "application/pdf"
      );
      writtenFormats.push("pdf");
      const pdfSha256 = createHash("sha256").update(rendered.pdf).digest("hex");
      const template = getConfirmationTemplateDefinition(templateCode);

      return await persistence.confirmationArtifact.create({
        data: {
          id: artifactId,
          confirmationId: input.confirmation.id,
          version: input.version,
          templateCode,
          templateVersion:
            template?.rendererVersion ?? `custom-${templateCode}`,
          docxObjectKey: docxObject.objectKey,
          docxSize: rendered.docx.byteLength,
          pdfObjectKey: pdfObject.objectKey,
          pdfSize: rendered.pdf.byteLength,
          pdfSha256,
          structuredSnapshot: structuredSnapshot as Prisma.InputJsonValue,
          derivedSnapshot: derivedSnapshot as unknown as Prisma.InputJsonValue,
          submissionKey: input.submissionKey,
          submittedBy: input.submittedBy,
          submittedAt: input.submittedAt ?? new Date(),
        },
      });
    } catch (error) {
      for (let index = writtenFormats.length - 1; index >= 0; index -= 1) {
        const format = writtenFormats[index];
        if (!format) {
          continue;
        }
        try {
          await this.storage.deleteConfirmationArtifact(
            input.confirmation.projectId,
            input.confirmation.id,
            artifactId,
            format
          );
        } catch {
          // Cleanup is best-effort; the triggering failure remains authoritative.
        }
      }
      throw error;
    }
  }

  async deleteStoredFiles(
    projectId: string,
    confirmationId: string,
    artifactId: string
  ) {
    for (const format of ["pdf", "docx"] as const) {
      try {
        await this.storage.deleteConfirmationArtifact(
          projectId,
          confirmationId,
          artifactId,
          format
        );
      } catch {
        // Compensation remains best-effort and must not replace the transaction failure.
      }
    }
  }
}

async function attachLatestEnabledManagedDesign(
  persistence: ArtifactPersistenceClient,
  confirmation: ConfirmationDocumentRecord,
  templateCode: ConfirmationDraftTemplateCode
): Promise<ConfirmationDocumentRecord> {
  if (!MANAGED_TEMPLATE_CODES.has(templateCode)) {
    return confirmation;
  }

  const override = await (
    persistence as unknown as {
      confirmationTemplateLibraryBuiltInOverride: BuiltInTemplateOverrideClient;
    }
  ).confirmationTemplateLibraryBuiltInOverride.findUnique({
    where: { templateCode },
    select: { designStatus: true, designSchema: true },
  });
  if (override && override.designStatus !== "ENABLED") {
    return confirmation;
  }

  const draftPayload = deepCopyJson(confirmation.draftPayload);
  return {
    ...confirmation,
    draftPayload: {
      ...draftPayload,
      templateDesignSchema:
        override?.designSchema ??
        getDefaultConfirmationTemplateDesign(templateCode),
    },
  };
}

function requireTemplateCode(value: string | null | undefined) {
  if (
    !TEMPLATE_CODES.includes(value as ConfirmationDraftTemplateCode) &&
    !isConfirmationCustomTemplateCode(value)
  ) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "A supported confirmation template is required"
    );
  }
  return value as ConfirmationDraftTemplateCode;
}

function deepCopyJson(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "A structured confirmation draft is required"
    );
  }
  return structuredClone(value) as Record<string, unknown>;
}

function assertRequiredTemplateCheckboxes(
  draftPayload: Record<string, unknown>
) {
  const design = draftPayload.templateDesignSchema;
  if (
    !design ||
    typeof design !== "object" ||
    Array.isArray(design) ||
    !Array.isArray((design as Record<string, unknown>).fields)
  ) {
    return;
  }
  const fieldValues =
    draftPayload.templateFieldValues &&
    typeof draftPayload.templateFieldValues === "object" &&
    !Array.isArray(draftPayload.templateFieldValues)
      ? (draftPayload.templateFieldValues as Record<string, unknown>)
      : {};
  for (const candidate of (design as { fields: unknown[] }).fields) {
    if (
      !candidate ||
      typeof candidate !== "object" ||
      Array.isArray(candidate)
    ) {
      continue;
    }
    const field = candidate as Record<string, unknown>;
    if (field.kind !== "CHECKBOX" || field.required !== true) {
      continue;
    }
    const value =
      typeof field.id === "string" ? fieldValues[field.id] : undefined;
    const checked =
      value === "true" ||
      (value === undefined && field.defaultChecked === true);
    if (checked) {
      continue;
    }
    const label =
      (typeof field.placeholder === "string" && field.placeholder.trim()) ||
      (typeof field.name === "string" && field.name.trim()) ||
      (typeof field.id === "string" && field.id) ||
      "required checkbox";
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      `Required checkbox “${label}” must be checked`
    );
  }
}
