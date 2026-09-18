import { z } from "zod";

const SMART_FORM_V2_DECIMAL_MAX_LENGTH = 100;
const SMART_FORM_V2_DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const SMART_FORM_V2_ID_MAX_LENGTH = 160;
const SMART_FORM_V2_RICH_TEXT_MAX_LENGTH = 200_000;
const SMART_FORM_V2_TEXT_MAX_LENGTH = 200_000;

export const SmartFormV2IdSchema = z
  .string()
  .trim()
  .min(1)
  .max(SMART_FORM_V2_ID_MAX_LENGTH);

export type SmartFormV2NodeId = string;
export type SmartFormV2FieldId = string;
export type SmartFormV2OptionId = string;
export type SmartFormV2SheetId = string;
export type SmartFormV2RowId = string;
export type SmartFormV2RowInstanceId = string;
export type SmartFormV2ColumnId = string;
export type SmartFormV2ComponentId = string;

export const SmartFormV2DecimalSchema = z
  .string()
  .trim()
  .min(1)
  .max(SMART_FORM_V2_DECIMAL_MAX_LENGTH)
  .regex(
    SMART_FORM_V2_DECIMAL_PATTERN,
    "Number must be a canonical base-10 decimal string"
  );

function isSmartFormV2DateTokenCalendarValid(value: string) {
  const parts = value.split("-").map(Number);
  if (parts.length < 3) {
    return true;
  }
  const [year = 0, month = 0, day = 0] = parts;
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    isLeapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= (daysInMonth[month - 1] ?? 0);
}

export const SmartFormV2DateTokenSchema = z
  .string()
  .regex(
    /^(?:\d{4}|\d{4}-(?:0[1-9]|1[0-2])|\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))$/,
    "Date must use YYYY, YYYY-MM, or YYYY-MM-DD"
  )
  .refine(isSmartFormV2DateTokenCalendarValid, "Date must exist");

export const SmartFormV2ReferenceTargetTypeSchema = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(
    /^[A-Za-z][A-Za-z0-9]*(?:[.:/][A-Za-z][A-Za-z0-9_-]*)+$/,
    "Reference target type must be namespaced"
  );

export const SmartFormV2LocaleTagSchema = z
  .string()
  .trim()
  .min(2)
  .max(35)
  .regex(
    /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/,
    "Locale must be a BCP 47 language tag"
  );

export type SmartFormV2LocaleTag = z.infer<typeof SmartFormV2LocaleTagSchema>;

export const SmartFormV2I18nConfigSchema = z
  .object({
    defaultLocale: SmartFormV2LocaleTagSchema,
    supportedLocales: z
      .array(SmartFormV2LocaleTagSchema)
      .min(1)
      .refine(
        (locales) => new Set(locales).size === locales.length,
        "Supported locales must be unique"
      ),
    fallbackLocales: z
      .record(SmartFormV2LocaleTagSchema, z.array(SmartFormV2LocaleTagSchema))
      .optional(),
    publishingPolicy: z.enum(["default-required", "all-supported-required"]),
  })
  .strict()
  .superRefine((config, context) => {
    const supportedLocales = new Set(config.supportedLocales);
    if (!supportedLocales.has(config.defaultLocale)) {
      context.addIssue({
        code: "custom",
        message: "Default locale must be supported",
        path: ["defaultLocale"],
      });
    }

    for (const [sourceLocale, fallbackLocales] of Object.entries(
      config.fallbackLocales ?? {}
    )) {
      if (!supportedLocales.has(sourceLocale)) {
        context.addIssue({
          code: "custom",
          message: "Fallback source locale must be supported",
          path: ["fallbackLocales", sourceLocale],
        });
      }
      for (const [fallbackIndex, fallbackLocale] of fallbackLocales.entries()) {
        if (!supportedLocales.has(fallbackLocale)) {
          context.addIssue({
            code: "custom",
            message: "Fallback target locale must be supported",
            path: ["fallbackLocales", sourceLocale, fallbackIndex],
          });
        }
      }
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (locale: string) => {
      if (visiting.has(locale)) {
        return true;
      }
      if (visited.has(locale)) {
        return false;
      }
      visiting.add(locale);
      for (const fallbackLocale of config.fallbackLocales?.[locale] ?? []) {
        if (visit(fallbackLocale)) {
          return true;
        }
      }
      visiting.delete(locale);
      visited.add(locale);
      return false;
    };

    for (const locale of config.supportedLocales) {
      if (visit(locale)) {
        context.addIssue({
          code: "custom",
          message: "Locale fallback graph must not contain a cycle",
          path: ["fallbackLocales"],
        });
        break;
      }
    }
  });

export type SmartFormV2I18nConfig = z.infer<typeof SmartFormV2I18nConfigSchema>;

function createSmartFormV2LocalizedSchema<T extends z.ZodType>(valueSchema: T) {
  return z
    .object({
      values: z
        .record(SmartFormV2LocaleTagSchema, valueSchema)
        .refine(
          (values) => Object.keys(values).length > 0,
          "At least one localized value is required"
        ),
    })
    .strict();
}

export const SmartFormV2RichTextMarkSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }).strict(),
  z.object({ type: z.literal("italic") }).strict(),
  z.object({ type: z.literal("underline") }).strict(),
  z.object({ type: z.literal("strike") }).strict(),
  z.object({ type: z.literal("code") }).strict(),
  z
    .object({
      type: z.literal("link"),
      href: z
        .url()
        .refine(
          (value) =>
            value.startsWith("https://") ||
            value.startsWith("http://") ||
            value.startsWith("mailto:"),
          "RichText links must use http, https, or mailto"
        ),
    })
    .strict(),
]);

export type SmartFormV2RichTextMark = z.infer<
  typeof SmartFormV2RichTextMarkSchema
>;

export const SmartFormV2EntityTypeSchema = z.enum([
  "attachment",
  "image",
  "workingPaper",
  "projectMember",
  "externalLink",
]);

export type SmartFormV2EntityType = z.infer<typeof SmartFormV2EntityTypeSchema>;

export type SmartFormV2RichTextInline =
  | {
      type: "text";
      text: string;
      marks?: SmartFormV2RichTextMark[];
    }
  | {
      type: "hardBreak";
    }
  | {
      type: "entityReference";
      id: SmartFormV2NodeId;
      entityType: SmartFormV2EntityType;
      entityId: string;
      labelSnapshot?: string;
    };

export const SmartFormV2RichTextInlineSchema: z.ZodType<SmartFormV2RichTextInline> =
  z.discriminatedUnion("type", [
    z
      .object({
        type: z.literal("text"),
        text: z.string().max(SMART_FORM_V2_RICH_TEXT_MAX_LENGTH),
        marks: z.array(SmartFormV2RichTextMarkSchema).optional(),
      })
      .strict(),
    z.object({ type: z.literal("hardBreak") }).strict(),
    z
      .object({
        type: z.literal("entityReference"),
        id: SmartFormV2IdSchema,
        entityType: SmartFormV2EntityTypeSchema,
        entityId: z.string().trim().min(1).max(500),
        labelSnapshot: z.string().trim().max(1000).optional(),
      })
      .strict(),
  ]);

export type SmartFormV2RichTextBlock =
  | {
      type: "paragraph";
      id: SmartFormV2NodeId;
      content: SmartFormV2RichTextInline[];
    }
  | {
      type: "heading";
      id: SmartFormV2NodeId;
      level: 1 | 2 | 3 | 4 | 5 | 6;
      content: SmartFormV2RichTextInline[];
    }
  | {
      type: "bulletList" | "orderedList";
      id: SmartFormV2NodeId;
      items: {
        id: SmartFormV2NodeId;
        content: SmartFormV2RichTextBlock[];
      }[];
    }
  | {
      type: "blockquote";
      id: SmartFormV2NodeId;
      content: SmartFormV2RichTextBlock[];
    }
  | {
      type: "table";
      id: SmartFormV2NodeId;
      rows: {
        id: SmartFormV2NodeId;
        cells: {
          id: SmartFormV2NodeId;
          content: SmartFormV2RichTextBlock[];
        }[];
      }[];
    }
  | {
      type: "embed";
      id: SmartFormV2NodeId;
      entityType: SmartFormV2EntityType;
      entityId: string;
      labelSnapshot?: string;
    };

export const SmartFormV2RichTextBlockSchema: z.ZodType<SmartFormV2RichTextBlock> =
  z.lazy(() =>
    z.discriminatedUnion("type", [
      z
        .object({
          type: z.literal("paragraph"),
          id: SmartFormV2IdSchema,
          content: z.array(SmartFormV2RichTextInlineSchema),
        })
        .strict(),
      z
        .object({
          type: z.literal("heading"),
          id: SmartFormV2IdSchema,
          level: z.union([
            z.literal(1),
            z.literal(2),
            z.literal(3),
            z.literal(4),
            z.literal(5),
            z.literal(6),
          ]),
          content: z.array(SmartFormV2RichTextInlineSchema),
        })
        .strict(),
      z
        .object({
          type: z.literal("bulletList"),
          id: SmartFormV2IdSchema,
          items: z
            .array(
              z
                .object({
                  id: SmartFormV2IdSchema,
                  content: z.array(SmartFormV2RichTextBlockSchema),
                })
                .strict()
            )
            .min(1),
        })
        .strict(),
      z
        .object({
          type: z.literal("orderedList"),
          id: SmartFormV2IdSchema,
          items: z
            .array(
              z
                .object({
                  id: SmartFormV2IdSchema,
                  content: z.array(SmartFormV2RichTextBlockSchema),
                })
                .strict()
            )
            .min(1),
        })
        .strict(),
      z
        .object({
          type: z.literal("blockquote"),
          id: SmartFormV2IdSchema,
          content: z.array(SmartFormV2RichTextBlockSchema).min(1),
        })
        .strict(),
      z
        .object({
          type: z.literal("table"),
          id: SmartFormV2IdSchema,
          rows: z
            .array(
              z
                .object({
                  id: SmartFormV2IdSchema,
                  cells: z
                    .array(
                      z
                        .object({
                          id: SmartFormV2IdSchema,
                          content: z.array(SmartFormV2RichTextBlockSchema),
                        })
                        .strict()
                    )
                    .min(1),
                })
                .strict()
            )
            .min(1),
        })
        .strict(),
      z
        .object({
          type: z.literal("embed"),
          id: SmartFormV2IdSchema,
          entityType: SmartFormV2EntityTypeSchema,
          entityId: z.string().trim().min(1).max(500),
          labelSnapshot: z.string().trim().max(1000).optional(),
        })
        .strict(),
    ])
  );

export const SmartFormV2RichTextDocumentSchema = z
  .object({
    type: z.literal("doc"),
    version: z.literal(1),
    content: z.array(SmartFormV2RichTextBlockSchema),
  })
  .strict()
  .superRefine((document, context) => {
    const ids = new Set<string>();
    const register = (id: string, path: (string | number)[]) => {
      if (ids.has(id)) {
        context.addIssue({
          code: "custom",
          message: "RichText node IDs must be unique",
          path,
        });
      }
      ids.add(id);
    };
    const visitInline = (
      inline: SmartFormV2RichTextInline,
      path: (string | number)[]
    ) => {
      if (inline.type === "entityReference") {
        register(inline.id, path);
      }
    };
    const visitBlock = (
      block: SmartFormV2RichTextBlock,
      path: (string | number)[]
    ) => {
      register(block.id, [...path, "id"]);
      if (block.type === "paragraph" || block.type === "heading") {
        block.content.forEach((inline, inlineIndex) =>
          visitInline(inline, [...path, "content", inlineIndex])
        );
        return;
      }
      if (block.type === "bulletList" || block.type === "orderedList") {
        block.items.forEach((item, itemIndex) => {
          register(item.id, [...path, "items", itemIndex, "id"]);
          item.content.forEach((child, childIndex) =>
            visitBlock(child, [
              ...path,
              "items",
              itemIndex,
              "content",
              childIndex,
            ])
          );
        });
        return;
      }
      if (block.type === "blockquote") {
        block.content.forEach((child, childIndex) =>
          visitBlock(child, [...path, "content", childIndex])
        );
        return;
      }
      if (block.type === "table") {
        block.rows.forEach((row, rowIndex) => {
          register(row.id, [...path, "rows", rowIndex, "id"]);
          row.cells.forEach((cell, cellIndex) => {
            register(cell.id, [
              ...path,
              "rows",
              rowIndex,
              "cells",
              cellIndex,
              "id",
            ]);
            cell.content.forEach((child, childIndex) =>
              visitBlock(child, [
                ...path,
                "rows",
                rowIndex,
                "cells",
                cellIndex,
                "content",
                childIndex,
              ])
            );
          });
        });
      }
    };
    document.content.forEach((block, blockIndex) =>
      visitBlock(block, ["content", blockIndex])
    );
  });

export type SmartFormV2RichTextDocument = z.infer<
  typeof SmartFormV2RichTextDocumentSchema
>;

export const SmartFormV2LocalizedRichTextSchema =
  createSmartFormV2LocalizedSchema(SmartFormV2RichTextDocumentSchema);

export type SmartFormV2LocalizedRichText = z.infer<
  typeof SmartFormV2LocalizedRichTextSchema
>;

export const SmartFormV2RichTextBlockTypeSchema = z.enum([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "blockquote",
  "table",
  "embed",
]);

export const SmartFormV2RichTextMarkTypeSchema = z.enum([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "link",
]);

export const SmartFormV2RichTextProfileSchema = z
  .object({
    allowedBlocks: z.array(SmartFormV2RichTextBlockTypeSchema),
    allowedMarks: z.array(SmartFormV2RichTextMarkTypeSchema),
    allowedEntities: z.array(SmartFormV2EntityTypeSchema),
    presentation: z.enum([
      "document",
      "compact",
      "single-line",
      "reference-chips",
    ]),
  })
  .strict();

export type SmartFormV2RichTextProfile = z.infer<
  typeof SmartFormV2RichTextProfileSchema
>;

export type SmartFormV2Expression =
  | { op: "value"; fieldId: SmartFormV2FieldId }
  | { op: "literal"; value: string | number | boolean | null }
  | {
      op: "eq" | "neq";
      left: SmartFormV2Expression;
      right: SmartFormV2Expression;
    }
  | { op: "and" | "or"; operands: SmartFormV2Expression[] }
  | { op: "not" | "isEmpty"; operand: SmartFormV2Expression };

export const SmartFormV2ExpressionSchema: z.ZodType<SmartFormV2Expression> =
  z.lazy(() =>
    z.discriminatedUnion("op", [
      z
        .object({
          op: z.literal("value"),
          fieldId: SmartFormV2IdSchema,
        })
        .strict(),
      z
        .object({
          op: z.literal("literal"),
          value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
        })
        .strict(),
      z
        .object({
          op: z.literal("eq"),
          left: SmartFormV2ExpressionSchema,
          right: SmartFormV2ExpressionSchema,
        })
        .strict(),
      z
        .object({
          op: z.literal("neq"),
          left: SmartFormV2ExpressionSchema,
          right: SmartFormV2ExpressionSchema,
        })
        .strict(),
      z
        .object({
          op: z.literal("and"),
          operands: z.array(SmartFormV2ExpressionSchema).min(2),
        })
        .strict(),
      z
        .object({
          op: z.literal("or"),
          operands: z.array(SmartFormV2ExpressionSchema).min(2),
        })
        .strict(),
      z
        .object({
          op: z.literal("not"),
          operand: SmartFormV2ExpressionSchema,
        })
        .strict(),
      z
        .object({
          op: z.literal("isEmpty"),
          operand: SmartFormV2ExpressionSchema,
        })
        .strict(),
    ])
  );

export const SmartFormV2NumberingRuleSchema: z.ZodType<SmartFormV2NumberingRule> =
  z.lazy(() =>
    z
      .object({
        enabled: z.boolean(),
        style: z.enum([
          "decimal",
          "lower-alpha",
          "upper-alpha",
          "lower-roman",
          "upper-roman",
        ]),
        prefix: z.string().max(20).optional(),
        suffix: z.string().max(20).optional(),
        separator: z.string().max(20).optional(),
        startAt: z.number().int().positive().optional(),
        child: SmartFormV2NumberingRuleSchema.optional(),
      })
      .strict()
  );

export type SmartFormV2NumberingRule = {
  enabled: boolean;
  style:
    | "decimal"
    | "lower-alpha"
    | "upper-alpha"
    | "lower-roman"
    | "upper-roman";
  prefix?: string;
  suffix?: string;
  separator?: string;
  startAt?: number;
  child?: SmartFormV2NumberingRule;
};

export const SmartFormV2ChoiceOptionSchema = z
  .object({
    id: SmartFormV2IdSchema,
    value: z.string().trim().min(1).max(500),
    label: SmartFormV2LocalizedRichTextSchema,
    help: SmartFormV2LocalizedRichTextSchema.optional(),
  })
  .strict();

export type SmartFormV2ChoiceOption = z.infer<
  typeof SmartFormV2ChoiceOptionSchema
>;

export const SmartFormV2ChoiceFieldDefinitionSchema = z
  .object({
    type: z.literal("choice"),
    cardinality: z.enum(["one", "many"]),
    options: z.array(SmartFormV2ChoiceOptionSchema).min(1),
  })
  .strict()
  .superRefine((definition, context) => {
    const optionIds = new Set<string>();
    const optionValues = new Set<string>();
    definition.options.forEach((option, optionIndex) => {
      if (optionIds.has(option.id)) {
        context.addIssue({
          code: "custom",
          message: "Choice option IDs must be unique",
          path: ["options", optionIndex, "id"],
        });
      }
      if (optionValues.has(option.value)) {
        context.addIssue({
          code: "custom",
          message: "Choice option values must be unique",
          path: ["options", optionIndex, "value"],
        });
      }
      optionIds.add(option.id);
      optionValues.add(option.value);
    });
  });

export const SmartFormV2RichTextFieldDefinitionSchema = z
  .object({
    type: z.literal("richText"),
    profile: SmartFormV2RichTextProfileSchema,
  })
  .strict();

export const SmartFormV2TextFieldDefinitionSchema = z
  .object({
    type: z.literal("text"),
    multiline: z.boolean().optional(),
    trim: z.boolean().optional(),
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().positive().optional(),
  })
  .strict()
  .refine(
    (definition) =>
      definition.minLength === undefined ||
      definition.maxLength === undefined ||
      definition.minLength <= definition.maxLength,
    "Text minimum length must not exceed maximum length"
  );

export const SmartFormV2AttachmentFieldDefinitionSchema = z
  .object({
    type: z.literal("attachment"),
    cardinality: z.enum(["one", "many"]),
    allowedMediaTypes: z
      .array(z.string().trim().min(1).max(255))
      .min(1)
      .refine(
        (mediaTypes) => new Set(mediaTypes).size === mediaTypes.length,
        "Allowed attachment media types must be unique"
      )
      .optional(),
    maxFiles: z.number().int().positive().optional(),
    maxFileSizeBytes: z.number().int().positive().safe().optional(),
  })
  .strict()
  .superRefine((definition, context) => {
    if (definition.cardinality === "one" && (definition.maxFiles ?? 1) !== 1) {
      context.addIssue({
        code: "custom",
        message: "Single attachment fields may contain at most one file",
        path: ["maxFiles"],
      });
    }
  });

export const SmartFormV2ReferenceFieldDefinitionSchema = z
  .object({
    type: z.literal("reference"),
    cardinality: z.enum(["one", "many"]),
    targetTypes: z
      .array(SmartFormV2ReferenceTargetTypeSchema)
      .min(1)
      .refine(
        (targetTypes) => new Set(targetTypes).size === targetTypes.length,
        "Reference target types must be unique"
      ),
    maxItems: z.number().int().positive().optional(),
  })
  .strict()
  .superRefine((definition, context) => {
    if (definition.cardinality === "one" && (definition.maxItems ?? 1) !== 1) {
      context.addIssue({
        code: "custom",
        message: "Single reference fields may contain at most one reference",
        path: ["maxItems"],
      });
    }
  });

const SMART_FORM_V2_DATE_PRECISION_PATTERNS = {
  year: /^\d{4}$/,
  month: /^\d{4}-(?:0[1-9]|1[0-2])$/,
  day: /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/,
} as const;

export const SmartFormV2DateFieldDefinitionSchema = z
  .object({
    type: z.literal("date"),
    precision: z.enum(["day", "month", "year"]),
    min: SmartFormV2DateTokenSchema.optional(),
    max: SmartFormV2DateTokenSchema.optional(),
  })
  .strict()
  .superRefine((definition, context) => {
    const precisionPattern =
      SMART_FORM_V2_DATE_PRECISION_PATTERNS[definition.precision];
    for (const bound of ["min", "max"] as const) {
      const value = definition[bound];
      if (value !== undefined && !precisionPattern.test(value)) {
        context.addIssue({
          code: "custom",
          message: `Date ${bound} must match ${definition.precision} precision`,
          path: [bound],
        });
      }
    }
    if (
      definition.min !== undefined &&
      definition.max !== undefined &&
      precisionPattern.test(definition.min) &&
      precisionPattern.test(definition.max) &&
      definition.min > definition.max
    ) {
      context.addIssue({
        code: "custom",
        message: "Date minimum must not exceed maximum",
        path: ["min"],
      });
    }
  });

function compareSmartFormV2Decimals(left: string, right: string) {
  const parse = (value: string) => {
    const negative = value.startsWith("-");
    const unsigned = negative ? value.slice(1) : value;
    const [integer = "0", fraction = ""] = unsigned.split(".");
    return { negative, integer, fraction };
  };
  const leftParts = parse(left);
  const rightParts = parse(right);
  const scale = Math.max(leftParts.fraction.length, rightParts.fraction.length);
  const toScaledInteger = (parts: ReturnType<typeof parse>) => {
    const digits = `${parts.integer}${parts.fraction.padEnd(scale, "0")}`;
    const magnitude = BigInt(digits);
    return parts.negative ? -magnitude : magnitude;
  };
  const leftInteger = toScaledInteger(leftParts);
  const rightInteger = toScaledInteger(rightParts);
  return leftInteger < rightInteger ? -1 : leftInteger > rightInteger ? 1 : 0;
}

export const SmartFormV2NumberFieldDefinitionSchema = z
  .object({
    type: z.literal("number"),
    scale: z.number().int().min(0).max(18).optional(),
    min: SmartFormV2DecimalSchema.optional(),
    max: SmartFormV2DecimalSchema.optional(),
    format: z.enum(["decimal", "currency", "percent"]).optional(),
    currencyCode: z
      .string()
      .regex(/^[A-Z]{3}$/, "Currency code must be ISO 4217-style")
      .optional(),
    unit: SmartFormV2LocalizedRichTextSchema.optional(),
  })
  .strict()
  .superRefine((definition, context) => {
    if (definition.format === "currency" && !definition.currencyCode) {
      context.addIssue({
        code: "custom",
        message: "Currency number fields require a currency code",
        path: ["currencyCode"],
      });
    }
    if (definition.format !== "currency" && definition.currencyCode) {
      context.addIssue({
        code: "custom",
        message: "Currency code is only valid for currency number fields",
        path: ["currencyCode"],
      });
    }
    if (
      definition.min !== undefined &&
      definition.max !== undefined &&
      compareSmartFormV2Decimals(definition.min, definition.max) > 0
    ) {
      context.addIssue({
        code: "custom",
        message: "Number minimum must not exceed maximum",
        path: ["min"],
      });
    }
  });

export const SmartFormV2FieldDefinitionSchema = z.discriminatedUnion("type", [
  SmartFormV2ChoiceFieldDefinitionSchema,
  SmartFormV2TextFieldDefinitionSchema,
  SmartFormV2RichTextFieldDefinitionSchema,
  SmartFormV2AttachmentFieldDefinitionSchema,
  SmartFormV2ReferenceFieldDefinitionSchema,
  SmartFormV2DateFieldDefinitionSchema,
  SmartFormV2NumberFieldDefinitionSchema,
]);

export type SmartFormV2FieldDefinition = z.infer<
  typeof SmartFormV2FieldDefinitionSchema
>;

export type SmartFormV2BranchQuestionFieldDefinition =
  | z.infer<typeof SmartFormV2ChoiceFieldDefinitionSchema>
  | z.infer<typeof SmartFormV2NumberFieldDefinitionSchema>;

export const SmartFormV2ValidationRuleSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("choiceCount"),
      min: z.number().int().nonnegative().optional(),
      max: z.number().int().positive().optional(),
    })
    .strict()
    .refine(
      (rule) =>
        rule.min === undefined ||
        rule.max === undefined ||
        rule.min <= rule.max,
      "Choice validation minimum must not exceed maximum"
    ),
  z
    .object({
      type: z.literal("richTextLength"),
      min: z.number().int().nonnegative().optional(),
      max: z.number().int().positive().optional(),
    })
    .strict()
    .refine(
      (rule) =>
        rule.min === undefined ||
        rule.max === undefined ||
        rule.min <= rule.max,
      "RichText validation minimum must not exceed maximum"
    ),
]);

export type SmartFormV2ValidationRule = z.infer<
  typeof SmartFormV2ValidationRuleSchema
>;

export const SmartFormV2NodePresentationSchema = z
  .object({
    width: z.enum(["auto", "full"]).optional(),
    density: z.enum(["compact", "comfortable"]).optional(),
  })
  .strict();

export type SmartFormV2NodePresentation = z.infer<
  typeof SmartFormV2NodePresentationSchema
>;

const SmartFormV2NodeBaseShape = {
  id: SmartFormV2IdSchema,
  visibleWhen: SmartFormV2ExpressionSchema.optional(),
  presentation: SmartFormV2NodePresentationSchema.optional(),
};
const SmartFormV2FieldBehaviorShape = {
  help: SmartFormV2LocalizedRichTextSchema.optional(),
  value: SmartFormV2FieldDefinitionSchema,
  required: z.boolean().optional(),
  requiredWhen: SmartFormV2ExpressionSchema.optional(),
  validations: z.array(SmartFormV2ValidationRuleSchema).optional(),
  answerLocaleMode: z.enum(["single", "per-locale"]).optional(),
};

export const SmartFormV2FieldTemplateSchema = z
  .object({
    ...SmartFormV2FieldBehaviorShape,
  })
  .strict();

export type SmartFormV2FieldTemplate = z.infer<
  typeof SmartFormV2FieldTemplateSchema
>;

export type SmartFormV2SectionNode = {
  kind: "section";
  id: SmartFormV2NodeId;
  visibleWhen?: SmartFormV2Expression;
  presentation?: SmartFormV2NodePresentation;
  title: SmartFormV2LocalizedRichText;
  description?: SmartFormV2LocalizedRichText;
  numbering?: SmartFormV2NumberingRule;
  children: SmartFormV2Node[];
};

export type SmartFormV2GroupNode = {
  kind: "group";
  id: SmartFormV2NodeId;
  visibleWhen?: SmartFormV2Expression;
  presentation?: SmartFormV2NodePresentation;
  title?: SmartFormV2LocalizedRichText;
  description?: SmartFormV2LocalizedRichText;
  numbering?: SmartFormV2NumberingRule;
  children: SmartFormV2Node[];
};

export type SmartFormV2ContentNode = {
  kind: "content";
  id: SmartFormV2NodeId;
  visibleWhen?: SmartFormV2Expression;
  presentation?: SmartFormV2NodePresentation;
  content: SmartFormV2LocalizedRichText;
};

export type SmartFormV2FieldNode = {
  kind: "field";
  id: SmartFormV2FieldId;
  visibleWhen?: SmartFormV2Expression;
  presentation?: SmartFormV2NodePresentation;
  label: SmartFormV2LocalizedRichText;
  help?: SmartFormV2LocalizedRichText;
  value: SmartFormV2FieldDefinition;
  required?: boolean;
  requiredWhen?: SmartFormV2Expression;
  validations?: SmartFormV2ValidationRule[];
  answerLocaleMode?: "single" | "per-locale";
};

export type SmartFormV2SheetCellTemplate =
  | { kind: "rowLabel" }
  | { kind: "field"; field: SmartFormV2FieldTemplate };

export type SmartFormV2SheetLeafColumn = {
  kind: "column";
  id: SmartFormV2ColumnId;
  header: SmartFormV2LocalizedRichText;
  width?: number | string;
  minWidth?: number;
  align?: "start" | "center" | "end";
  cell: SmartFormV2SheetCellTemplate;
};

export type SmartFormV2SheetColumnGroup = {
  kind: "columnGroup";
  id: SmartFormV2ColumnId;
  header: SmartFormV2LocalizedRichText;
  children: SmartFormV2SheetColumnNode[];
};

export type SmartFormV2SheetColumnNode =
  | SmartFormV2SheetLeafColumn
  | SmartFormV2SheetColumnGroup;

export const SmartFormV2SheetCellTemplateSchema: z.ZodType<SmartFormV2SheetCellTemplate> =
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("rowLabel") }).strict(),
    z
      .object({
        kind: z.literal("field"),
        field: SmartFormV2FieldTemplateSchema,
      })
      .strict(),
  ]);

export const SmartFormV2SheetColumnNodeSchema: z.ZodType<SmartFormV2SheetColumnNode> =
  z.lazy(() =>
    z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("column"),
          id: SmartFormV2IdSchema,
          header: SmartFormV2LocalizedRichTextSchema,
          width: z
            .union([
              z.number().positive(),
              z.string().regex(/^(?:100|\d{1,2}(?:\.\d+)?)%$/),
            ])
            .optional(),
          minWidth: z.number().positive().optional(),
          align: z.enum(["start", "center", "end"]).optional(),
          cell: SmartFormV2SheetCellTemplateSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("columnGroup"),
          id: SmartFormV2IdSchema,
          header: SmartFormV2LocalizedRichTextSchema,
          children: z.array(SmartFormV2SheetColumnNodeSchema).min(1),
        })
        .strict(),
    ])
  );

export const SmartFormV2SheetCellOverrideSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("empty") }).strict(),
  z
    .object({
      kind: z.literal("content"),
      content: SmartFormV2LocalizedRichTextSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("field"),
      required: z.boolean().optional(),
      requiredWhen: SmartFormV2ExpressionSchema.optional(),
      visibleWhen: SmartFormV2ExpressionSchema.optional(),
      profileOverride: SmartFormV2RichTextProfileSchema.optional(),
    })
    .strict(),
]);

export type SmartFormV2SheetCellOverride = z.infer<
  typeof SmartFormV2SheetCellOverrideSchema
>;

export type SmartFormV2FixedSheetRow = {
  id: SmartFormV2RowId;
  role?: "data" | "group";
  label?: SmartFormV2LocalizedRichText;
  cells?: Partial<Record<SmartFormV2ColumnId, SmartFormV2SheetCellOverride>>;
  children?: SmartFormV2FixedSheetRow[];
};

export const SmartFormV2FixedSheetRowSchema: z.ZodType<SmartFormV2FixedSheetRow> =
  z.lazy(() =>
    z
      .object({
        id: SmartFormV2IdSchema,
        role: z.enum(["data", "group"]).optional(),
        label: SmartFormV2LocalizedRichTextSchema.optional(),
        cells: z
          .record(SmartFormV2IdSchema, SmartFormV2SheetCellOverrideSchema)
          .optional(),
        children: z.array(SmartFormV2FixedSheetRowSchema).optional(),
      })
      .strict()
  );

export const SmartFormV2FixedSheetRowsSchema = z
  .object({
    mode: z.literal("fixed"),
    numbering: SmartFormV2NumberingRuleSchema.optional(),
    items: z.array(SmartFormV2FixedSheetRowSchema).min(1),
  })
  .strict();

export const SmartFormV2RepeatableSheetRowsSchema = z
  .object({
    mode: z.literal("repeatable"),
    minRows: z.number().int().nonnegative().optional(),
    maxRows: z.number().int().positive().optional(),
    initialRows: z.number().int().nonnegative().optional(),
    allowAdd: z.boolean(),
    allowDelete: z.boolean(),
    allowReorder: z.boolean().optional(),
  })
  .strict()
  .superRefine((rows, context) => {
    if (
      rows.minRows !== undefined &&
      rows.maxRows !== undefined &&
      rows.minRows > rows.maxRows
    ) {
      context.addIssue({
        code: "custom",
        message: "Minimum rows must not exceed maximum rows",
        path: ["minRows"],
      });
    }
    if (
      rows.initialRows !== undefined &&
      ((rows.minRows !== undefined && rows.initialRows < rows.minRows) ||
        (rows.maxRows !== undefined && rows.initialRows > rows.maxRows))
    ) {
      context.addIssue({
        code: "custom",
        message: "Initial rows must be within the configured row limits",
        path: ["initialRows"],
      });
    }
  });

export const SmartFormV2SheetPresentationSchema = z
  .object({
    density: z.enum(["compact", "comfortable"]),
    width: z.enum(["fit", "full", "scroll"]),
    stickyHeader: z.boolean().optional(),
    showGridLines: z.boolean().optional(),
    stripedRows: z.boolean().optional(),
    responsive: z.enum(["scroll", "cards"]),
  })
  .strict();

export type SmartFormV2SheetPresentation = z.infer<
  typeof SmartFormV2SheetPresentationSchema
>;

export type SmartFormV2SheetNode = {
  kind: "sheet";
  id: SmartFormV2SheetId;
  visibleWhen?: SmartFormV2Expression;
  presentation: SmartFormV2SheetPresentation;
  title?: SmartFormV2LocalizedRichText;
  description?: SmartFormV2LocalizedRichText;
  columns: SmartFormV2SheetColumnNode[];
  rows:
    | z.infer<typeof SmartFormV2FixedSheetRowsSchema>
    | z.infer<typeof SmartFormV2RepeatableSheetRowsSchema>;
};

export type SmartFormV2ComponentInstanceNode = {
  kind: "component";
  id: SmartFormV2NodeId;
  visibleWhen?: SmartFormV2Expression;
  presentation?: SmartFormV2NodePresentation;
  componentId: SmartFormV2ComponentId;
  componentVersion: number;
  props: Record<string, unknown>;
  slots?: Record<string, SmartFormV2Node[]>;
};

export type SmartFormV2BranchQuestion = {
  kind: "field";
  id: SmartFormV2FieldId;
  label: SmartFormV2LocalizedRichText;
  help?: SmartFormV2LocalizedRichText;
  value: SmartFormV2BranchQuestionFieldDefinition;
  required: boolean;
  validations?: SmartFormV2ValidationRule[];
};

export type SmartFormV2BranchComparison =
  | {
      type: "singleChoice";
      operator: "selected";
      optionId: SmartFormV2NodeId;
    }
  | {
      type: "multipleChoice";
      operator: "includesAny" | "includesAll";
      optionIds: SmartFormV2NodeId[];
    }
  | {
      type: "number";
      operator: "gt" | "gte" | "eq" | "lte" | "lt";
      value: string;
    };

export type SmartFormV2ConditionalArm = {
  id: SmartFormV2NodeId;
  comparison: SmartFormV2BranchComparison;
  children: SmartFormV2Node[];
};

export type SmartFormV2ConditionalOtherwiseArm = {
  id: SmartFormV2NodeId;
  children: SmartFormV2Node[];
};

export type SmartFormV2ConditionalNode = {
  kind: "conditional";
  id: SmartFormV2NodeId;
  visibleWhen?: SmartFormV2Expression;
  presentation?: SmartFormV2NodePresentation;
  branchQuestion: SmartFormV2BranchQuestion;
  branches: SmartFormV2ConditionalArm[];
  otherwise: SmartFormV2ConditionalOtherwiseArm;
};

export type SmartFormV2Node =
  | SmartFormV2SectionNode
  | SmartFormV2GroupNode
  | SmartFormV2ContentNode
  | SmartFormV2FieldNode
  | SmartFormV2SheetNode
  | SmartFormV2ConditionalNode
  | SmartFormV2ComponentInstanceNode;

export const SmartFormV2SectionNodeSchema: z.ZodType<SmartFormV2SectionNode> =
  z.lazy(() =>
    z
      .object({
        ...SmartFormV2NodeBaseShape,
        kind: z.literal("section"),
        title: SmartFormV2LocalizedRichTextSchema,
        description: SmartFormV2LocalizedRichTextSchema.optional(),
        numbering: SmartFormV2NumberingRuleSchema.optional(),
        children: z.array(SmartFormV2NodeSchema),
      })
      .strict()
  );

export const SmartFormV2GroupNodeSchema: z.ZodType<SmartFormV2GroupNode> =
  z.lazy(() =>
    z
      .object({
        ...SmartFormV2NodeBaseShape,
        kind: z.literal("group"),
        title: SmartFormV2LocalizedRichTextSchema.optional(),
        description: SmartFormV2LocalizedRichTextSchema.optional(),
        numbering: SmartFormV2NumberingRuleSchema.optional(),
        children: z.array(SmartFormV2NodeSchema),
      })
      .strict()
  );

export const SmartFormV2ContentNodeSchema: z.ZodType<SmartFormV2ContentNode> = z
  .object({
    ...SmartFormV2NodeBaseShape,
    kind: z.literal("content"),
    content: SmartFormV2LocalizedRichTextSchema,
  })
  .strict();

export const SmartFormV2FieldNodeSchema: z.ZodType<SmartFormV2FieldNode> = z
  .object({
    ...SmartFormV2NodeBaseShape,
    kind: z.literal("field"),
    label: SmartFormV2LocalizedRichTextSchema,
    ...SmartFormV2FieldBehaviorShape,
  })
  .strict();

export const SmartFormV2SheetNodeSchema: z.ZodType<SmartFormV2SheetNode> = z
  .object({
    ...SmartFormV2NodeBaseShape,
    kind: z.literal("sheet"),
    title: SmartFormV2LocalizedRichTextSchema.optional(),
    description: SmartFormV2LocalizedRichTextSchema.optional(),
    columns: z.array(SmartFormV2SheetColumnNodeSchema).min(1),
    rows: z.discriminatedUnion("mode", [
      SmartFormV2FixedSheetRowsSchema,
      SmartFormV2RepeatableSheetRowsSchema,
    ]),
    presentation: SmartFormV2SheetPresentationSchema,
  })
  .strict();

export const SmartFormV2ComponentInstanceNodeSchema: z.ZodType<SmartFormV2ComponentInstanceNode> =
  z.lazy(() =>
    z
      .object({
        ...SmartFormV2NodeBaseShape,
        kind: z.literal("component"),
        componentId: SmartFormV2IdSchema,
        componentVersion: z.number().int().positive(),
        props: z.record(z.string(), z.unknown()),
        slots: z
          .record(z.string().trim().min(1), z.array(SmartFormV2NodeSchema))
          .optional(),
      })
      .strict()
  );

export const SmartFormV2BranchQuestionSchema: z.ZodType<SmartFormV2BranchQuestion> =
  z
    .object({
      kind: z.literal("field"),
      id: SmartFormV2IdSchema,
      label: SmartFormV2LocalizedRichTextSchema,
      help: SmartFormV2LocalizedRichTextSchema.optional(),
      value: z.discriminatedUnion("type", [
        SmartFormV2ChoiceFieldDefinitionSchema,
        SmartFormV2NumberFieldDefinitionSchema,
      ]),
      required: z.boolean(),
      validations: z.array(SmartFormV2ValidationRuleSchema).optional(),
    })
    .strict();

export const SmartFormV2BranchComparisonSchema: z.ZodType<SmartFormV2BranchComparison> =
  z.discriminatedUnion("type", [
    z
      .object({
        type: z.literal("singleChoice"),
        operator: z.literal("selected"),
        optionId: SmartFormV2IdSchema,
      })
      .strict(),
    z
      .object({
        type: z.literal("multipleChoice"),
        operator: z.enum(["includesAny", "includesAll"]),
        optionIds: z
          .array(SmartFormV2IdSchema)
          .min(1)
          .refine(
            (optionIds) => new Set(optionIds).size === optionIds.length,
            "Conditional option IDs must be unique"
          ),
      })
      .strict(),
    z
      .object({
        type: z.literal("number"),
        operator: z.enum(["gt", "gte", "eq", "lte", "lt"]),
        value: SmartFormV2DecimalSchema,
      })
      .strict(),
  ]);

export const SmartFormV2ConditionalArmSchema: z.ZodType<SmartFormV2ConditionalArm> =
  z.lazy(() =>
    z
      .object({
        id: SmartFormV2IdSchema,
        comparison: SmartFormV2BranchComparisonSchema,
        children: z.array(SmartFormV2NodeSchema),
      })
      .strict()
  );

export const SmartFormV2ConditionalOtherwiseArmSchema: z.ZodType<SmartFormV2ConditionalOtherwiseArm> =
  z.lazy(() =>
    z
      .object({
        id: SmartFormV2IdSchema,
        children: z.array(SmartFormV2NodeSchema),
      })
      .strict()
  );

export const SmartFormV2ConditionalNodeSchema: z.ZodType<SmartFormV2ConditionalNode> =
  z.lazy(() =>
    z
      .object({
        ...SmartFormV2NodeBaseShape,
        kind: z.literal("conditional"),
        branchQuestion: SmartFormV2BranchQuestionSchema,
        branches: z.array(SmartFormV2ConditionalArmSchema).min(1).max(8),
        otherwise: SmartFormV2ConditionalOtherwiseArmSchema,
      })
      .strict()
      .superRefine((node, context) => {
        const { value } = node.branchQuestion;
        const armIds = [
          ...node.branches.map((branch) => branch.id),
          node.otherwise.id,
        ];
        if (new Set(armIds).size !== armIds.length) {
          context.addIssue({
            code: "custom",
            message: "Conditional branch IDs must be unique",
            path: ["branches"],
          });
        }
        const optionIds =
          value.type === "choice"
            ? new Set(value.options.map((option) => option.id))
            : undefined;
        const singleChoiceOptionIds = new Set<string>();
        node.branches.forEach((branch, branchIndex) => {
          const { comparison } = branch;
          const comparisonPath = ["branches", branchIndex, "comparison"];
          if (
            value.type === "choice" &&
            value.cardinality === "one" &&
            comparison.type !== "singleChoice"
          ) {
            context.addIssue({
              code: "custom",
              message:
                "Single-choice branch questions require selected comparisons",
              path: comparisonPath,
            });
            return;
          }
          if (
            value.type === "choice" &&
            value.cardinality === "many" &&
            comparison.type !== "multipleChoice"
          ) {
            context.addIssue({
              code: "custom",
              message:
                "Multiple-choice branch questions require inclusion comparisons",
              path: comparisonPath,
            });
            return;
          }
          if (value.type === "number" && comparison.type !== "number") {
            context.addIssue({
              code: "custom",
              message: "Number branch questions require numeric comparisons",
              path: comparisonPath,
            });
            return;
          }
          const comparedOptionIds =
            comparison.type === "singleChoice"
              ? [comparison.optionId]
              : comparison.type === "multipleChoice"
                ? comparison.optionIds
                : [];
          comparedOptionIds.forEach((optionId, optionIndex) => {
            if (!optionIds?.has(optionId)) {
              context.addIssue({
                code: "custom",
                message:
                  "Conditional comparison must reference an existing option",
                path: [
                  ...comparisonPath,
                  comparison.type === "singleChoice" ? "optionId" : "optionIds",
                  ...(comparison.type === "singleChoice" ? [] : [optionIndex]),
                ],
              });
            }
          });
          if (comparison.type === "singleChoice") {
            if (singleChoiceOptionIds.has(comparison.optionId)) {
              context.addIssue({
                code: "custom",
                message:
                  "A single-choice option can belong to only one conditional branch",
                path: [...comparisonPath, "optionId"],
              });
            }
            singleChoiceOptionIds.add(comparison.optionId);
          }
        });
      })
  );

export const SmartFormV2NodeSchema: z.ZodType<SmartFormV2Node> = z.lazy(() =>
  z.union([
    SmartFormV2SectionNodeSchema,
    SmartFormV2GroupNodeSchema,
    SmartFormV2ContentNodeSchema,
    SmartFormV2FieldNodeSchema,
    SmartFormV2SheetNodeSchema,
    SmartFormV2ConditionalNodeSchema,
    SmartFormV2ComponentInstanceNodeSchema,
  ])
);

export const SmartFormV2ComponentLockSchema = z
  .object({
    componentId: SmartFormV2IdSchema,
    componentVersion: z.number().int().positive(),
    digest: z
      .string()
      .trim()
      .regex(/^[a-f0-9]{64}$/, "Component digest must be a SHA-256 hex value"),
  })
  .strict();

export type SmartFormV2ComponentLock = z.infer<
  typeof SmartFormV2ComponentLockSchema
>;

const SmartFormV2DefinitionBaseSchema = z
  .object({
    kind: z.literal("smartForm"),
    schemaVersion: z.literal(2),
    id: SmartFormV2IdSchema,
    i18n: SmartFormV2I18nConfigSchema,
    title: SmartFormV2LocalizedRichTextSchema,
    description: SmartFormV2LocalizedRichTextSchema.optional(),
    children: z.array(SmartFormV2NodeSchema).min(1),
    componentLocks: z.array(SmartFormV2ComponentLockSchema).optional(),
  })
  .strict();

export const SmartFormV2DefinitionSchema =
  SmartFormV2DefinitionBaseSchema.superRefine((definition, context) => {
    validateSmartFormV2Definition(definition, context);
  });

export type SmartFormV2Definition = z.infer<typeof SmartFormV2DefinitionSchema>;

export const SmartFormV2ChoiceValueSchema = z
  .object({
    type: z.literal("choice"),
    selectedOptionIds: z
      .array(SmartFormV2IdSchema)
      .refine(
        (optionIds) => new Set(optionIds).size === optionIds.length,
        "Selected choice option IDs must be unique"
      ),
  })
  .strict();

export const SmartFormV2TextValueSchema = z
  .object({
    type: z.literal("text"),
    text: z.string().max(SMART_FORM_V2_TEXT_MAX_LENGTH),
  })
  .strict();

export const SmartFormV2RichTextValueSchema = z
  .object({
    type: z.literal("richText"),
    document: SmartFormV2RichTextDocumentSchema,
  })
  .strict();

export const SmartFormV2AttachmentReferenceSchema = z
  .object({
    attachmentId: SmartFormV2IdSchema,
    versionId: SmartFormV2IdSchema.optional(),
    fileNameSnapshot: z.string().max(1024).optional(),
    mediaTypeSnapshot: z.string().max(255).optional(),
    sizeBytesSnapshot: z.number().int().nonnegative().safe().optional(),
  })
  .strict();

export const SmartFormV2AttachmentValueSchema = z
  .object({
    type: z.literal("attachment"),
    attachments: z.array(SmartFormV2AttachmentReferenceSchema),
  })
  .strict()
  .superRefine((value, context) => {
    const attachmentIds = new Set<string>();
    value.attachments.forEach((attachment, attachmentIndex) => {
      if (attachmentIds.has(attachment.attachmentId)) {
        context.addIssue({
          code: "custom",
          message: "Attachment IDs must be unique within a field value",
          path: ["attachments", attachmentIndex, "attachmentId"],
        });
      }
      attachmentIds.add(attachment.attachmentId);
    });
  });

export const SmartFormV2StructuredReferenceSchema = z
  .object({
    targetType: SmartFormV2ReferenceTargetTypeSchema,
    targetId: SmartFormV2IdSchema,
    labelSnapshot: z.string().max(1024).optional(),
  })
  .strict();

export const SmartFormV2ReferenceValueSchema = z
  .object({
    type: z.literal("reference"),
    references: z.array(SmartFormV2StructuredReferenceSchema),
  })
  .strict()
  .superRefine((value, context) => {
    const referenceKeys = new Set<string>();
    value.references.forEach((reference, referenceIndex) => {
      const key = `${reference.targetType}\0${reference.targetId}`;
      if (referenceKeys.has(key)) {
        context.addIssue({
          code: "custom",
          message: "References must be unique within a field value",
          path: ["references", referenceIndex],
        });
      }
      referenceKeys.add(key);
    });
  });

export const SmartFormV2DateValueSchema = z
  .object({
    type: z.literal("date"),
    value: SmartFormV2DateTokenSchema,
  })
  .strict();

export const SmartFormV2NumberValueSchema = z
  .object({
    type: z.literal("number"),
    decimal: SmartFormV2DecimalSchema,
  })
  .strict();

export const SmartFormV2FieldValueSchema = z.discriminatedUnion("type", [
  SmartFormV2ChoiceValueSchema,
  SmartFormV2TextValueSchema,
  SmartFormV2RichTextValueSchema,
  SmartFormV2AttachmentValueSchema,
  SmartFormV2ReferenceValueSchema,
  SmartFormV2DateValueSchema,
  SmartFormV2NumberValueSchema,
]);

export type SmartFormV2FieldValue = z.infer<typeof SmartFormV2FieldValueSchema>;

export const SmartFormV2LocalizedFieldValueSchema = z
  .object({
    type: z.literal("localized"),
    values: z.record(SmartFormV2LocaleTagSchema, SmartFormV2FieldValueSchema),
  })
  .strict();

export const SmartFormV2FieldAnswerSchema = z.union([
  SmartFormV2FieldValueSchema,
  SmartFormV2LocalizedFieldValueSchema,
]);

export type SmartFormV2FieldAnswer = z.infer<
  typeof SmartFormV2FieldAnswerSchema
>;

export const SmartFormV2SheetAnswerRowSchema = z
  .object({
    id: SmartFormV2IdSchema,
    sourceRowId: SmartFormV2IdSchema.optional(),
    order: z.number().int().nonnegative(),
    cells: z.record(SmartFormV2IdSchema, SmartFormV2FieldAnswerSchema),
  })
  .strict();

export const SmartFormV2SheetAnswerSchema = z
  .object({
    rows: z.array(SmartFormV2SheetAnswerRowSchema),
  })
  .strict()
  .superRefine((sheet, context) => {
    const rowIds = new Set<string>();
    sheet.rows.forEach((row, rowIndex) => {
      if (rowIds.has(row.id)) {
        context.addIssue({
          code: "custom",
          message: "Sheet answer row IDs must be unique",
          path: ["rows", rowIndex, "id"],
        });
      }
      rowIds.add(row.id);
    });
  });

export const SmartFormV2ResponseSchema = z
  .object({
    kind: z.literal("smartFormResponse"),
    schemaVersion: z.literal(2),
    definitionVersionId: SmartFormV2IdSchema,
    responseLocale: SmartFormV2LocaleTagSchema,
    updatedAt: z.iso.datetime(),
    fields: z.record(SmartFormV2IdSchema, SmartFormV2FieldAnswerSchema),
    sheets: z.record(SmartFormV2IdSchema, SmartFormV2SheetAnswerSchema),
  })
  .strict();

export type SmartFormV2Response = z.infer<typeof SmartFormV2ResponseSchema>;

type SmartFormV2DefinitionInput = z.infer<
  typeof SmartFormV2DefinitionBaseSchema
>;

type LocalizedPath = {
  localized: SmartFormV2LocalizedRichText;
  path: (string | number)[];
};

function validateSmartFormV2Definition(
  definition: SmartFormV2DefinitionInput,
  context: z.RefinementCtx
) {
  const nodeIds = new Set<string>();
  const componentLocks = new Map<string, SmartFormV2ComponentLock>();
  const localizedValues: LocalizedPath[] = [
    { localized: definition.title, path: ["title"] },
  ];
  if (definition.description) {
    localizedValues.push({
      localized: definition.description,
      path: ["description"],
    });
  }

  for (const [lockIndex, lock] of (definition.componentLocks ?? []).entries()) {
    const key = `${lock.componentId}@${lock.componentVersion}`;
    if (componentLocks.has(key)) {
      context.addIssue({
        code: "custom",
        message: "Component locks must be unique",
        path: ["componentLocks", lockIndex],
      });
    }
    componentLocks.set(key, lock);
  }

  const registerNodeId = (
    id: string,
    path: (string | number)[],
    label = "Node"
  ) => {
    if (nodeIds.has(id)) {
      context.addIssue({
        code: "custom",
        message: `${label} IDs must be unique`,
        path,
      });
    }
    nodeIds.add(id);
  };
  const collectFieldLocalizedValues = (
    field: {
      help?: SmartFormV2LocalizedRichText;
      value: SmartFormV2FieldDefinition;
      answerLocaleMode?: "single" | "per-locale";
    },
    path: (string | number)[]
  ) => {
    if (field.help) {
      localizedValues.push({
        localized: field.help,
        path: [...path, "help"],
      });
    }
    if (field.value.type === "choice") {
      field.value.options.forEach((option, optionIndex) => {
        localizedValues.push({
          localized: option.label,
          path: [...path, "value", "options", optionIndex, "label"],
        });
        if (option.help) {
          localizedValues.push({
            localized: option.help,
            path: [...path, "value", "options", optionIndex, "help"],
          });
        }
      });
    }
    if (field.value.type === "number" && field.value.unit) {
      localizedValues.push({
        localized: field.value.unit,
        path: [...path, "value", "unit"],
      });
    }
    if (
      field.answerLocaleMode === "per-locale" &&
      field.value.type !== "text" &&
      field.value.type !== "richText"
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Per-locale answers are only supported for Text and RichText fields",
        path: [...path, "answerLocaleMode"],
      });
    }
  };
  const visitColumn = (
    column: SmartFormV2SheetColumnNode,
    columnPath: (string | number)[],
    columnIds: Set<string>
  ) => {
    if (columnIds.has(column.id)) {
      context.addIssue({
        code: "custom",
        message: "Sheet column IDs must be unique",
        path: [...columnPath, "id"],
      });
    }
    columnIds.add(column.id);
    localizedValues.push({
      localized: column.header,
      path: [...columnPath, "header"],
    });
    if (column.kind === "columnGroup") {
      column.children.forEach((child, childIndex) =>
        visitColumn(child, [...columnPath, "children", childIndex], columnIds)
      );
      return;
    }
    if (column.cell.kind === "field") {
      collectFieldLocalizedValues(column.cell.field, [
        ...columnPath,
        "cell",
        "field",
      ]);
    }
  };
  const visitRow = (
    row: SmartFormV2FixedSheetRow,
    rowPath: (string | number)[],
    rowIds: Set<string>,
    columnIds: Set<string>
  ) => {
    if (rowIds.has(row.id)) {
      context.addIssue({
        code: "custom",
        message: "Sheet row IDs must be unique",
        path: [...rowPath, "id"],
      });
    }
    rowIds.add(row.id);
    if (row.label) {
      localizedValues.push({
        localized: row.label,
        path: [...rowPath, "label"],
      });
    }
    for (const [columnId, cell] of Object.entries(row.cells ?? {})) {
      if (!columnIds.has(columnId)) {
        context.addIssue({
          code: "custom",
          message: "Sheet cell override must reference an existing column",
          path: [...rowPath, "cells", columnId],
        });
      }
      if (cell?.kind === "content") {
        localizedValues.push({
          localized: cell.content,
          path: [...rowPath, "cells", columnId, "content"],
        });
      }
    }
    row.children?.forEach((child, childIndex) =>
      visitRow(child, [...rowPath, "children", childIndex], rowIds, columnIds)
    );
  };
  const visitNode = (
    node: SmartFormV2Node,
    path: (string | number)[],
    conditionalDepth = 0
  ) => {
    registerNodeId(node.id, [...path, "id"]);
    if (node.kind === "section" || node.kind === "group") {
      if (node.title) {
        localizedValues.push({
          localized: node.title,
          path: [...path, "title"],
        });
      }
      if (node.description) {
        localizedValues.push({
          localized: node.description,
          path: [...path, "description"],
        });
      }
      node.children.forEach((child, childIndex) =>
        visitNode(child, [...path, "children", childIndex], conditionalDepth)
      );
      return;
    }
    if (node.kind === "conditional") {
      if (conditionalDepth >= 3) {
        context.addIssue({
          code: "custom",
          message: "Conditional blocks may be nested at most three levels",
          path,
        });
      }
      registerNodeId(
        node.branchQuestion.id,
        [...path, "branchQuestion", "id"],
        "Field"
      );
      localizedValues.push({
        localized: node.branchQuestion.label,
        path: [...path, "branchQuestion", "label"],
      });
      collectFieldLocalizedValues(node.branchQuestion, [
        ...path,
        "branchQuestion",
      ]);
      node.branches.forEach((branch, branchIndex) => {
        registerNodeId(branch.id, [...path, "branches", branchIndex, "id"]);
        branch.children.forEach((child, childIndex) =>
          visitNode(
            child,
            [...path, "branches", branchIndex, "children", childIndex],
            conditionalDepth + 1
          )
        );
      });
      registerNodeId(node.otherwise.id, [...path, "otherwise", "id"]);
      node.otherwise.children.forEach((child, childIndex) =>
        visitNode(
          child,
          [...path, "otherwise", "children", childIndex],
          conditionalDepth + 1
        )
      );
      return;
    }
    if (node.kind === "content") {
      localizedValues.push({
        localized: node.content,
        path: [...path, "content"],
      });
      return;
    }
    if (node.kind === "field") {
      localizedValues.push({
        localized: node.label,
        path: [...path, "label"],
      });
      collectFieldLocalizedValues(node, path);
      return;
    }
    if (node.kind === "sheet") {
      if (node.title) {
        localizedValues.push({
          localized: node.title,
          path: [...path, "title"],
        });
      }
      if (node.description) {
        localizedValues.push({
          localized: node.description,
          path: [...path, "description"],
        });
      }
      const columnIds = new Set<string>();
      node.columns.forEach((column, columnIndex) =>
        visitColumn(column, [...path, "columns", columnIndex], columnIds)
      );
      if (node.rows.mode === "fixed") {
        const rowIds = new Set<string>();
        node.rows.items.forEach((row, rowIndex) =>
          visitRow(row, [...path, "rows", "items", rowIndex], rowIds, columnIds)
        );
      }
      return;
    }

    const componentKey = `${node.componentId}@${node.componentVersion}`;
    if (!componentLocks.has(componentKey)) {
      context.addIssue({
        code: "custom",
        message: "Component instance must have a matching version lock",
        path,
      });
    }
    for (const [slotName, slotNodes] of Object.entries(node.slots ?? {})) {
      slotNodes.forEach((slotNode, slotNodeIndex) =>
        visitNode(
          slotNode,
          [...path, "slots", slotName, slotNodeIndex],
          conditionalDepth
        )
      );
    }
  };

  definition.children.forEach((node, nodeIndex) =>
    visitNode(node, ["children", nodeIndex])
  );

  const supportedLocales = new Set(definition.i18n.supportedLocales);
  for (const { localized, path } of localizedValues) {
    for (const locale of Object.keys(localized.values)) {
      if (!supportedLocales.has(locale)) {
        context.addIssue({
          code: "custom",
          message: "Localized content uses an unsupported locale",
          path: [...path, "values", locale],
        });
      }
    }
    const requiredLocales =
      definition.i18n.publishingPolicy === "all-supported-required"
        ? definition.i18n.supportedLocales
        : [definition.i18n.defaultLocale];
    for (const locale of requiredLocales) {
      if (!localized.values[locale]) {
        context.addIssue({
          code: "custom",
          message: `Localized content is required for ${locale}`,
          path: [...path, "values", locale],
        });
      }
    }
  }
}
