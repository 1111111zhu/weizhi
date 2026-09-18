import { z } from "zod";

import {
  SmartFormV2ComponentRegistry,
  defineSmartFormV2Component,
} from "./smart-form-v2-compiler.js";
import type {
  SmartFormV2FixedSheetRow,
  SmartFormV2LocalizedRichText,
  SmartFormV2Node,
} from "./smart-form-v2.js";
import {
  SmartFormV2LocalizedRichTextSchema,
  SmartFormV2ReferenceTargetTypeSchema,
  SmartFormV2SheetPresentationSchema,
} from "./smart-form-v2.js";

export const AUDIT_PROCEDURE_SHEET_COMPONENT_ID = "audit-procedure-sheet";
export const AUDIT_PROCEDURE_SHEET_COMPONENT_VERSION = 1;
export const AUDIT_PROCEDURE_SHEET_COMPONENT_DIGEST =
  "4eb614064d875b0e099afbca2eba2f277d9d84abaf8b4493eaa0a53a4f69de2f";

export type AuditProcedureSheetRow = {
  id: string;
  label: SmartFormV2LocalizedRichText;
  role?: "data" | "group";
  required?: boolean;
  children?: AuditProcedureSheetRow[];
};

const AuditProcedureSheetRowSchema: z.ZodType<AuditProcedureSheetRow> = z.lazy(
  () =>
    z
      .object({
        id: z.string().trim().min(1).max(160),
        label: SmartFormV2LocalizedRichTextSchema,
        role: z.enum(["data", "group"]).optional(),
        required: z.boolean().optional(),
        children: z.array(AuditProcedureSheetRowSchema).min(1).optional(),
      })
      .strict()
      .superRefine((row, context) => {
        if (row.role === "group" && !row.children?.length) {
          context.addIssue({
            code: "custom",
            message: "Audit procedure group rows require child rows",
            path: ["children"],
          });
        }
        if (row.role === "data" && row.children?.length) {
          context.addIssue({
            code: "custom",
            message: "Audit procedure data rows cannot contain child rows",
            path: ["children"],
          });
        }
      })
);
const AuditProcedureSheetHeadersSchema = z
  .object({
    procedure: SmartFormV2LocalizedRichTextSchema.optional(),
    testRequired: SmartFormV2LocalizedRichTextSchema.optional(),
    result: SmartFormV2LocalizedRichTextSchema.optional(),
    references: SmartFormV2LocalizedRichTextSchema.optional(),
    comments: SmartFormV2LocalizedRichTextSchema.optional(),
  })
  .strict();

export const AuditProcedureSheetPropsSchema = z
  .object({
    title: SmartFormV2LocalizedRichTextSchema.optional(),
    description: SmartFormV2LocalizedRichTextSchema.optional(),
    headers: AuditProcedureSheetHeadersSchema.optional(),
    procedures: z.array(AuditProcedureSheetRowSchema).min(1),
    referenceTargetTypes: z
      .array(SmartFormV2ReferenceTargetTypeSchema)
      .min(1)
      .refine(
        (targetTypes) => new Set(targetTypes).size === targetTypes.length,
        "Reference target types must be unique"
      )
      .default(["projectWing.workingPaper"]),
    presentation: SmartFormV2SheetPresentationSchema.optional(),
  })
  .strict();

export type AuditProcedureSheetProps = z.output<
  typeof AuditProcedureSheetPropsSchema
>;

export const AuditProcedureSheetComponent = defineSmartFormV2Component({
  componentId: AUDIT_PROCEDURE_SHEET_COMPONENT_ID,
  componentVersion: AUDIT_PROCEDURE_SHEET_COMPONENT_VERSION,
  digest: AUDIT_PROCEDURE_SHEET_COMPONENT_DIGEST,
  propsSchema: AuditProcedureSheetPropsSchema,
  compile: ({ instance, props }) => {
    const headers = {
      procedure:
        props.headers?.procedure ??
        localizedText("审计程序", "Audit procedure", "audit-procedure-header"),
      testRequired:
        props.headers?.testRequired ??
        localizedText(
          "是否执行",
          "Test required",
          "audit-test-required-header"
        ),
      result:
        props.headers?.result ??
        localizedText("执行结果", "Result", "audit-result-header"),
      references:
        props.headers?.references ??
        localizedText(
          "底稿引用",
          "Working-paper references",
          "audit-references-header"
        ),
      comments:
        props.headers?.comments ??
        localizedText("备注", "Comments", "audit-comments-header"),
    };

    return [
      {
        kind: "sheet",
        id: instance.id,
        visibleWhen: instance.visibleWhen,
        title: props.title,
        description: props.description,
        columns: [
          {
            kind: "column",
            id: "procedure",
            header: headers.procedure,
            width: "42%",
            minWidth: 320,
            align: "start",
            cell: { kind: "rowLabel" },
          },
          {
            kind: "column",
            id: "test-required",
            header: headers.testRequired,
            width: "13%",
            minWidth: 136,
            align: "start",
            cell: {
              kind: "field",
              field: {
                value: {
                  type: "choice",
                  cardinality: "one",
                  options: [
                    choiceOption("yes", "yes", "是", "Yes", "audit-test-yes"),
                    choiceOption("no", "no", "否", "No", "audit-test-no"),
                    choiceOption(
                      "not-applicable",
                      "not-applicable",
                      "不适用",
                      "N/A",
                      "audit-test-not-applicable"
                    ),
                  ],
                },
                required: true,
              },
            },
          },
          {
            kind: "column",
            id: "result",
            header: headers.result,
            width: "15%",
            minWidth: 156,
            align: "start",
            cell: {
              kind: "field",
              field: {
                value: {
                  type: "choice",
                  cardinality: "one",
                  options: [
                    choiceOption(
                      "satisfactory",
                      "satisfactory",
                      "满意",
                      "Satisfactory",
                      "audit-result-satisfactory"
                    ),
                    choiceOption(
                      "unsatisfactory",
                      "unsatisfactory",
                      "不满意",
                      "Unsatisfactory",
                      "audit-result-unsatisfactory"
                    ),
                    choiceOption(
                      "not-applicable",
                      "not-applicable",
                      "不适用",
                      "Not applicable",
                      "audit-result-not-applicable"
                    ),
                  ],
                },
                required: true,
              },
            },
          },
          {
            kind: "column",
            id: "working-paper-reference",
            header: headers.references,
            width: "15%",
            minWidth: 180,
            align: "start",
            cell: {
              kind: "field",
              field: {
                value: {
                  type: "reference",
                  cardinality: "many",
                  targetTypes: props.referenceTargetTypes,
                  maxItems: 20,
                },
              },
            },
          },
          {
            kind: "column",
            id: "comments",
            header: headers.comments,
            width: "15%",
            minWidth: 220,
            align: "start",
            cell: {
              kind: "field",
              field: {
                answerLocaleMode: "per-locale",
                value: {
                  type: "richText",
                  profile: {
                    allowedBlocks: [
                      "paragraph",
                      "bulletList",
                      "orderedList",
                      "blockquote",
                    ],
                    allowedMarks: ["bold", "italic", "underline", "strike"],
                    allowedEntities: [
                      "attachment",
                      "image",
                      "workingPaper",
                      "externalLink",
                    ],
                    presentation: "compact",
                  },
                },
              },
            },
          },
        ],
        rows: {
          mode: "fixed",
          numbering: {
            enabled: true,
            style: "decimal",
            child: {
              enabled: true,
              style: "lower-alpha",
              prefix: "(",
              suffix: ")",
            },
          },
          items: props.procedures.map(compileAuditProcedureRow),
        },
        presentation:
          props.presentation ??
          ({
            density: instance.presentation?.density ?? "compact",
            width: instance.presentation?.width === "auto" ? "fit" : "full",
            stickyHeader: true,
            showGridLines: true,
            stripedRows: false,
            responsive: "cards",
          } as const),
      },
    ] satisfies SmartFormV2Node[];
  },
});

export const STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY =
  new SmartFormV2ComponentRegistry([AuditProcedureSheetComponent]);

function compileAuditProcedureRow(
  row: AuditProcedureSheetRow
): SmartFormV2FixedSheetRow {
  const role = row.role ?? (row.children?.length ? "group" : "data");
  const cells =
    role === "group"
      ? {
          "test-required": { kind: "empty" as const },
          result: { kind: "empty" as const },
          "working-paper-reference": { kind: "empty" as const },
          comments: { kind: "empty" as const },
        }
      : row.required === false
        ? {
            "test-required": {
              kind: "field" as const,
              required: false,
            },
            result: {
              kind: "field" as const,
              required: false,
            },
          }
        : undefined;
  return {
    id: row.id,
    role,
    label: row.label,
    cells,
    children: row.children?.map(compileAuditProcedureRow),
  };
}

function choiceOption(
  id: string,
  value: string,
  zh: string,
  en: string,
  richTextId: string
) {
  return {
    id,
    value,
    label: localizedText(zh, en, richTextId),
  };
}

function localizedText(
  zh: string,
  en: string,
  id: string
): SmartFormV2LocalizedRichText {
  return {
    values: {
      "zh-CN": paragraphDocument(zh, `${id}-zh`),
      "en-US": paragraphDocument(en, `${id}-en`),
    },
  };
}

function paragraphDocument(text: string, id: string) {
  return {
    type: "doc" as const,
    version: 1 as const,
    content: [
      {
        type: "paragraph" as const,
        id,
        content: text ? [{ type: "text" as const, text }] : [],
      },
    ],
  };
}
