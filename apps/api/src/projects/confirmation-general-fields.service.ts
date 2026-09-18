import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { RequestUser } from "../auth/request-user";
import {
  ApiBadRequestException,
  ApiForbiddenException,
} from "../common/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { CONFIRMATION_TEMPLATE_FIELD_BINDINGS } from "./confirmation-template-library.service";

export type ConfirmationGeneralFieldInput = { id: string; name: string };
export type ConfirmationGeneralFieldValue = ConfirmationGeneralFieldInput & {
  value: string;
};

export type ConfirmationGeneralFieldsLayoutField = {
  id: string;
  name: string;
  binding?: string;
  colSpan?: 1 | 2;
};
export type ConfirmationGeneralFieldsLayoutSection = {
  id: string;
  name: string;
  fields: ConfirmationGeneralFieldsLayoutField[];
};
export type ConfirmationGeneralFieldsLayout = {
  sections: ConfirmationGeneralFieldsLayoutSection[];
};

const LAYOUT_ID = "default";
const ID_PATTERN = /^[a-zA-Z0-9-]{1,80}$/;
const DEFAULT_BINDINGS = [
  "clientName",
  "referenceCode",
  "bankName",
  "accountNumber",
  "recipientAddress",
  "officeDate",
  "picName",
  "micName",
  "reportDate",
] as const satisfies readonly (typeof CONFIRMATION_TEMPLATE_FIELD_BINDINGS)[number][];
const BUILTIN_BINDINGS = new Set<string>(DEFAULT_BINDINGS);

const DEFAULT_BUILTIN_FIELDS: Record<
  string,
  ConfirmationGeneralFieldsLayoutField
> = {
  clientName: {
    id: "builtin-clientName",
    name: "客户名称",
    binding: "clientName",
  },
  picName: { id: "builtin-picName", name: "PIC", binding: "picName" },
  micName: { id: "builtin-micName", name: "MIC", binding: "micName" },
  referenceCode: {
    id: "builtin-referenceCode",
    name: "Ref",
    binding: "referenceCode",
  },
  officeDate: {
    id: "builtin-officeDate",
    name: "事务所日期",
    binding: "officeDate",
  },
  reportDate: {
    id: "builtin-reportDate",
    name: "报告日期",
    binding: "reportDate",
  },
  recipientAddress: {
    id: "builtin-recipientAddress",
    name: "发函地址",
    binding: "recipientAddress",
  },
  bankName: { id: "builtin-bankName", name: "银行名称", binding: "bankName" },
  accountNumber: {
    id: "builtin-accountNumber",
    name: "银行账户",
    binding: "accountNumber",
  },
};

const DEFAULT_LAYOUT: ConfirmationGeneralFieldsLayout = {
  sections: [
    {
      id: "client",
      name: "客户名称",
      fields: [
        DEFAULT_BUILTIN_FIELDS.clientName,
      ],
    },
    {
      id: "reference",
      name: "Ref",
      fields: [
        DEFAULT_BUILTIN_FIELDS.referenceCode,
      ],
    },
    {
      id: "bank",
      name: "客户银行与发函地址",
      fields: [
        DEFAULT_BUILTIN_FIELDS.bankName,
        DEFAULT_BUILTIN_FIELDS.accountNumber,
        DEFAULT_BUILTIN_FIELDS.recipientAddress,
      ],
    },
    {
      id: "general",
      name: "通用填写",
      fields: [
        DEFAULT_BUILTIN_FIELDS.officeDate,
        DEFAULT_BUILTIN_FIELDS.picName,
        DEFAULT_BUILTIN_FIELDS.micName,
        DEFAULT_BUILTIN_FIELDS.reportDate,
      ],
    },
  ],
};

const BUILTIN_FIELD_BY_ID = new Map(
  DEFAULT_BINDINGS.map((binding) => [
    `builtin-${binding}`,
    binding,
  ])
);

@Injectable()
export class ConfirmationGeneralFieldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService
  ) {}

  list() {
    return this.prisma.confirmationGeneralField.findMany({
      where: { isActive: true },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    });
  }

  async getLayout(): Promise<ConfirmationGeneralFieldsLayout> {
    const row = await this.prisma.confirmationGeneralFieldsLayout.findUnique({
      where: { id: LAYOUT_ID },
      select: { layout: true },
    });
    if (row) {
      return validateLayout(row.layout);
    }

    const legacyFields = await this.list();
    const layout = cloneLayout(DEFAULT_LAYOUT);
    const general = layout.sections.find((section) => section.id === "general");
    if (general) {
      general.fields.push(
        ...legacyFields
          .filter((field) => !BUILTIN_FIELD_BY_ID.has(field.id))
          .map((field) => ({ id: field.id, name: field.name }))
      );
    }
    return layout;
  }

  async replaceLayout(
    layout: ConfirmationGeneralFieldsLayout,
    user: RequestUser,
    source: AuditLogSource
  ) {
    if (user.globalRole !== "SUPER_ADMIN") {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Only super administrators can manage general fields"
      );
    }
    const canonical = validateLayout(layout);
    await this.prisma.$transaction(async (tx) => {
      await tx.confirmationGeneralFieldsLayout.upsert({
        where: { id: LAYOUT_ID },
        create: {
          id: LAYOUT_ID,
          layout: canonical as unknown as Prisma.InputJsonValue,
        },
        update: { layout: canonical as unknown as Prisma.InputJsonValue },
      });
      await tx.confirmationGeneralField.updateMany({
        data: { isActive: false },
      });
      let position = 0;
      for (const section of canonical.sections) {
        for (const field of section.fields) {
          if (field.binding !== undefined) continue;
          await tx.confirmationGeneralField.upsert({
            where: { id: field.id },
            create: { id: field.id, name: field.name, position },
            update: { name: field.name, position, isActive: true },
          });
          position += 1;
        }
      }
      await this.auditLogs.logInTransaction(tx, {
        actorId: user.id,
        action: "CONFIRMATION_GENERAL_FIELDS_LAYOUT_UPDATED",
        targetType: "CONFIRMATION_GENERAL_FIELDS_LAYOUT",
        description: "Updated global confirmation general fields layout",
        source,
      });
    });
    return canonical;
  }

  async replace(
    fields: ConfirmationGeneralFieldInput[],
    user: RequestUser,
    source: AuditLogSource
  ) {
    if (user.globalRole !== "SUPER_ADMIN") {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Only super administrators can manage general fields"
      );
    }
    const layoutDelegate = (
      this.prisma as unknown as {
        confirmationGeneralFieldsLayout?: {
          findUnique(args: unknown): Promise<{ id: string } | null>;
        };
      }
    ).confirmationGeneralFieldsLayout;
    if (
      layoutDelegate &&
      (await layoutDelegate.findUnique({
        where: { id: LAYOUT_ID },
        select: { id: true },
      }))
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Use the layout endpoint after general information layout is configured"
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.confirmationGeneralField.updateMany({
        data: { isActive: false },
      });
      for (const [position, field] of fields.entries()) {
        await tx.confirmationGeneralField.upsert({
          where: { id: field.id },
          create: { ...field, position },
          update: { name: field.name, position, isActive: true },
        });
      }
      await this.auditLogs.logInTransaction(tx, {
        actorId: user.id,
        action: "CONFIRMATION_GENERAL_FIELDS_UPDATED",
        targetType: "CONFIRMATION_GENERAL_FIELDS",
        description: "Updated global confirmation general fields",
        source,
      });
    });
    return this.list();
  }

  async projectValues(values: ConfirmationGeneralFieldValue[] = []) {
    const fields = await this.list();
    return fields.map((field) => ({
      ...field,
      value: values.find((value) => value.id === field.id)?.value ?? "",
    }));
  }

  async validateProjectValues(values: ConfirmationGeneralFieldValue[]) {
    const fields = await this.list();
    if (
      values.some((value) => !fields.some((field) => field.id === value.id))
    ) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Fields must be configured in global general information settings"
      );
    }
    // Names are authoritative global metadata, never updated by a project write.
    return fields.map((field) => ({
      ...field,
      value: values.find((value) => value.id === field.id)?.value ?? "",
    }));
  }
}

function cloneLayout(layout: ConfirmationGeneralFieldsLayout) {
  return {
    sections: layout.sections.map((section) => ({
      id: section.id,
      name: section.name,
      fields: section.fields.map((field) => ({ ...field })),
    })),
  };
}

function validateLayout(value: unknown): ConfirmationGeneralFieldsLayout {
  if (!value || typeof value !== "object") {
    throw new ApiBadRequestException("VALIDATION_FAILED", "Invalid general information layout");
  }
  if (Object.keys(value).some((key) => key !== "sections")) {
    throw new ApiBadRequestException("VALIDATION_FAILED", "Invalid general information layout");
  }
  const candidate = value as { sections?: unknown };
  if (!Array.isArray(candidate.sections) || candidate.sections.length > 50) {
    throw new ApiBadRequestException("VALIDATION_FAILED", "Invalid general information layout");
  }
  const sectionIds = new Set<string>();
  const fieldIds = new Set<string>();
  const bindings = new Set<string>();
  let fieldCount = 0;
  const sections: ConfirmationGeneralFieldsLayoutSection[] = [];
  for (const sectionValue of candidate.sections) {
    if (!sectionValue || typeof sectionValue !== "object") {
      throw new ApiBadRequestException("VALIDATION_FAILED", "Invalid general information layout");
    }
    if (
      Object.keys(sectionValue).some(
        (key) => key !== "id" && key !== "name" && key !== "fields"
      )
    ) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "Invalid general information layout");
    }
    const section = sectionValue as {
      id?: unknown;
      name?: unknown;
      fields?: unknown;
    };
    if (
      typeof section.id !== "string" ||
      !ID_PATTERN.test(section.id) ||
      sectionIds.has(section.id) ||
      typeof section.name !== "string" ||
      !section.name.trim() ||
      section.name.trim().length > 100 ||
      !Array.isArray(section.fields) ||
      section.fields.length > 200
    ) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "Invalid general information layout");
    }
    sectionIds.add(section.id);
    const fields: ConfirmationGeneralFieldsLayoutField[] = [];
    for (const fieldValue of section.fields) {
      if (!fieldValue || typeof fieldValue !== "object") {
        throw new ApiBadRequestException("VALIDATION_FAILED", "Invalid general information layout");
      }
      if (
        Object.keys(fieldValue).some(
          (key) => key !== "id" && key !== "name" && key !== "binding" && key !== "colSpan"
        )
      ) {
        throw new ApiBadRequestException("VALIDATION_FAILED", "Invalid general information layout");
      }
      const field = fieldValue as {
        id?: unknown;
        name?: unknown;
        binding?: unknown;
        colSpan?: unknown;
      };
      if (
        typeof field.id !== "string" ||
        !ID_PATTERN.test(field.id) ||
        fieldIds.has(field.id) ||
        typeof field.name !== "string" ||
        !field.name.trim() ||
        field.name.trim().length > 100 ||
        (field.binding !== undefined && typeof field.binding !== "string") ||
        (field.colSpan !== undefined && field.colSpan !== 1 && field.colSpan !== 2)
      ) {
        throw new ApiBadRequestException("VALIDATION_FAILED", "Invalid general information layout");
      }
      const binding = field.binding?.trim();
      if (field.binding !== undefined && !binding) {
        throw new ApiBadRequestException("VALIDATION_FAILED", "Invalid general information layout");
      }
      const builtinBinding = binding;
      const expectedBinding = BUILTIN_FIELD_BY_ID.get(field.id);
      if (expectedBinding !== undefined) {
        if (builtinBinding !== expectedBinding) {
          throw new ApiBadRequestException("VALIDATION_FAILED", "Invalid general information layout");
        }
      } else if (field.id.startsWith("builtin-") || builtinBinding !== undefined) {
        if (
          builtinBinding === undefined ||
          !BUILTIN_BINDINGS.has(builtinBinding) ||
          field.id !== `builtin-${builtinBinding}`
        ) {
          throw new ApiBadRequestException("VALIDATION_FAILED", "Invalid general information layout");
        }
      }
      if (builtinBinding !== undefined) {
        if (bindings.has(builtinBinding)) {
          throw new ApiBadRequestException("VALIDATION_FAILED", "Invalid general information layout");
        }
        bindings.add(builtinBinding);
      }
      fieldIds.add(field.id);
      fieldCount += 1;
      if (fieldCount > 200) {
        throw new ApiBadRequestException("VALIDATION_FAILED", "Invalid general information layout");
      }
      fields.push({
        id: field.id,
        name: field.name.trim(),
        ...(builtinBinding === undefined ? {} : { binding: builtinBinding }),
        ...(field.colSpan === undefined ? {} : { colSpan: field.colSpan }),
      });
    }
    sections.push({ id: section.id, name: section.name.trim(), fields });
  }
  return { sections };
}
