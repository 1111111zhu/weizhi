import type { SmartFormV2CompiledDefinition } from "./smart-form-v2-compiler.js";
import { compileSmartFormV2Definition } from "./smart-form-v2-compiler.js";
import type {
  AuditProcedureSheetProps,
  AuditProcedureSheetRow,
} from "./smart-form-v2-components.js";
import {
  AUDIT_PROCEDURE_SHEET_COMPONENT_DIGEST,
  AUDIT_PROCEDURE_SHEET_COMPONENT_ID,
  AUDIT_PROCEDURE_SHEET_COMPONENT_VERSION,
  STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY,
} from "./smart-form-v2-components.js";
import type {
  SmartFormV2Definition,
  SmartFormV2LocalizedRichText,
  SmartFormV2Response,
} from "./smart-form-v2.js";
import {
  SmartFormV2DefinitionSchema,
  SmartFormV2ResponseSchema,
} from "./smart-form-v2.js";

/**
 * Source: "Audit Programme_Loans and deferred income.xlsx",
 * worksheet "Deferred income", A1:H33.
 *
 * The source workbook is English-only. The Chinese copy below is the native
 * zh-CN authoring locale for the first production-shaped V2 fixture.
 */
export const DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE: SmartFormV2Definition =
  SmartFormV2DefinitionSchema.parse({
    kind: "smartForm",
    schemaVersion: 2,
    id: "audit-programme-deferred-income-v2",
    i18n: {
      defaultLocale: "zh-CN",
      supportedLocales: ["zh-CN", "en-US"],
      fallbackLocales: {
        "en-US": ["zh-CN"],
      },
      publishingPolicy: "all-supported-required",
    },
    title: localizedText(
      "审计程序——递延收入",
      "Audit Programme — Deferred Income",
      "deferred-income-title"
    ),
    description: localizedText(
      "由原始递延收入审计程序工作表转换而成的中英双语 SmartForm V2。",
      "Bilingual SmartForm V2 converted from the source deferred income audit programme worksheet.",
      "deferred-income-description"
    ),
    children: [
      auditObjectivesContent(
        "deferred-income-audit-objectives",
        [
          "确保递延收入已正确核算且记录完整。",
          "确认递延收入所需披露均已作出，且相关信息已得到适当列报和说明。",
        ],
        [
          "Ensure that deferred income has been correctly accounted for and is complete.",
          "Confirm that all necessary disclosures concerning deferred income have been made and that the information is appropriately presented and described.",
        ]
      ),
      auditProcedureSection({
        id: "deferred-income-general",
        titleZh: "一般审计程序",
        titleEn: "General",
        procedures: [
          procedure(
            "deferred-income-procedure-1",
            "取得并检查（或编制）本年度数据主表，并与总账核对。",
            "Obtain and check, or prepare, a lead schedule for the current year’s figures and reconcile this to the general ledger."
          ),
          procedureGroup(
            "deferred-income-procedure-2",
            "执行分析程序，例如：",
            "Carry out analytical procedures such as:",
            [
              procedure(
                "deferred-income-procedure-2-a",
                "将本期数据与以前期间数据进行比较；",
                "Compare the current figures with those of prior periods;"
              ),
              procedure(
                "deferred-income-procedure-2-b",
                "复核并比较关键比率或其他绩效指标。",
                "Review and compare key ratios or other performance indicators."
              ),
            ]
          ),
          procedure(
            "deferred-income-procedure-3",
            "复核超过执行重要性水平或其他异常的项目，并进行验证。",
            "Review for items above performance materiality or that are otherwise unusual and verify."
          ),
          procedureGroup(
            "deferred-income-procedure-4",
            "复核递延收入的递延基础：",
            "Review the basis for deferring income:",
            [
              procedure(
                "deferred-income-procedure-4-a",
                "核对支持性文件；",
                "Vouch to supporting documents; and"
              ),
              procedure(
                "deferred-income-procedure-4-b",
                "确保该基础有效、完整，并已按照与上年度一致的方法及适用会计准则正确应用。",
                "Ensure that it is valid, complete and has been correctly and consistently applied with the prior year and applicable accounting standards."
              ),
            ]
          ),
          procedure(
            "deferred-income-procedure-5",
            "确保被审计单位按照适用会计准则核算外币交易。",
            "Ensure the entity accounted for foreign currency transactions in accordance with applicable accounting standards."
          ),
          procedure(
            "deferred-income-procedure-6",
            "确认所有货币性负债均已按适当的期末汇率折算。",
            "Confirm that all monetary liabilities have been translated at an appropriate closing rate."
          ),
        ],
      }),
      auditProcedureSection({
        id: "deferred-income-presentation",
        titleZh: "列报与披露",
        titleEn: "Presentation and disclosure",
        descriptionZh:
          "评估递延收入相关列报和披露是否有充分、适当的审计证据支持。",
        descriptionEn:
          "Evaluate whether the presentation and disclosures relating to deferred income are supported by sufficient appropriate audit evidence.",
        procedures: [
          procedure(
            "deferred-income-procedure-7",
            "确保审计档案中有充分、适当的证据支持所有已作出的披露。",
            "Ensure that there is sufficient appropriate evidence on the file to support all disclosures made."
          ),
        ],
      }),
      auditProcedureSection({
        id: "deferred-income-bespoke",
        titleZh: "定制测试",
        titleEn: "Bespoke tests",
        descriptionZh: "记录并执行因本项目具体情况而需要的额外审计程序。",
        descriptionEn:
          "Document and perform additional audit procedures required by the specific circumstances of the engagement.",
        procedures: [
          procedure(
            "deferred-income-procedure-8",
            "如有需要，设计并执行必要的额外测试，并与相关工作底稿中的审计目标相互索引。",
            "Draft and perform any necessary additional tests if required and cross reference with the objectives on the relevant working paper."
          ),
        ],
      }),
      auditProcedureSection({
        id: "deferred-income-conclusion",
        titleZh: "结论程序",
        titleEn: "Conclusion",
        descriptionZh: "完成递延收入审计程序的收尾评估。",
        descriptionEn:
          "Complete the closing assessment for the deferred income audit programme.",
        procedures: [
          procedure(
            "deferred-income-procedure-9",
            "考虑是否存在需要纳入管理层声明书或向治理层报告的事项，并作适当记录。",
            "Consider whether there are any points which need to be included in a letter of representation or report to those charged with governance and record as appropriate."
          ),
          procedure(
            "deferred-income-procedure-10",
            "复核本领域对内部控制的计划依赖程度，并考虑该依赖程度是否仍然适当。",
            "Review the planned extent of reliance on internal controls in this area and consider whether this remains appropriate."
          ),
          procedure(
            "deferred-income-procedure-11",
            "根据已取得的审计证据，评估是否应修订初始重要性水平和／或风险评估。记录任何必要调整的详情，并考虑其对剩余审计工作及截至目前已执行工作的影响。",
            "Assess whether the initial materiality and/or risk assessment should be revised in view of the audit evidence obtained. Record details of any necessary adjustments. Consider the impact on the remainder of the audit work and on any work undertaken to date."
          ),
        ],
      }),
      {
        kind: "section",
        id: "deferred-income-final-conclusion",
        title: localizedText(
          "最终结论",
          "Final conclusion",
          "deferred-income-final-conclusion-title"
        ),
        description: localizedText(
          "请依据已执行的审计工作完成最终结论；如存在例外事项，请在后续文本框中说明。",
          "Complete the final conclusion based on the audit work performed. Describe any exceptions in the following field.",
          "deferred-income-final-conclusion-description"
        ),
        children: [
          {
            kind: "field",
            id: "deferred-income-final-conclusion-confirmation",
            label: localizedText(
              "最终结论",
              "Final conclusion",
              "deferred-income-final-conclusion-label"
            ),
            help: localizedText(
              "根据已执行的审计工作，我确认：已按照审计程序执行工作；已充分记录所执行的工作及取得的结果；已收集财务报表列报与披露所需的全部资料；已取得充分、适当的证据支持所达成的审计结论；并且在我看来，递延收入已得到公允列报（如未公允列报，请在下方说明）。",
              "From the audit work carried out, I confirm that: the work has been performed in accordance with the audit programme; the work performed and results obtained have been adequately documented; all necessary information has been collected for presentation and disclosure in the financial statements; sufficient appropriate evidence has been obtained to support the audit conclusion reached; and, in my opinion, deferred income is fairly stated (if not, describe below).",
              "deferred-income-final-conclusion-help"
            ),
            value: {
              type: "choice",
              cardinality: "one",
              options: [
                {
                  id: "confirmed",
                  value: "confirmed",
                  label: localizedText(
                    "确认，无例外事项",
                    "Confirmed without exception",
                    "deferred-income-confirmed-option"
                  ),
                },
                {
                  id: "exception",
                  value: "exception",
                  label: localizedText(
                    "存在例外事项",
                    "Exception noted",
                    "deferred-income-exception-option"
                  ),
                },
              ],
            },
            required: true,
          },
          {
            kind: "field",
            id: "deferred-income-final-conclusion-details",
            answerLocaleMode: "per-locale",
            label: localizedText(
              "例外事项或补充说明（可选）",
              "Exception details or additional notes (optional)",
              "deferred-income-final-conclusion-details-label"
            ),
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
                presentation: "document",
              },
            },
            required: false,
          },
        ],
      },
    ],
    componentLocks: [
      {
        componentId: AUDIT_PROCEDURE_SHEET_COMPONENT_ID,
        componentVersion: AUDIT_PROCEDURE_SHEET_COMPONENT_VERSION,
        digest: AUDIT_PROCEDURE_SHEET_COMPONENT_DIGEST,
      },
    ],
  });

export const DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE: SmartFormV2CompiledDefinition =
  compileSmartFormV2Definition(
    DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
    STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY
  );

export const CONDITIONAL_CONTENT_SMART_FORM_V2_AUTHORED_FIXTURE: SmartFormV2Definition =
  SmartFormV2DefinitionSchema.parse({
    kind: "smartForm",
    schemaVersion: 2,
    id: "conditional-content-smart-form-v2",
    i18n: {
      defaultLocale: "zh-CN",
      supportedLocales: ["zh-CN", "en-US"],
      fallbackLocales: { "en-US": ["zh-CN"] },
      publishingPolicy: "all-supported-required",
    },
    title: localizedText(
      "条件内容示例",
      "Conditional content example",
      "conditional-content-title"
    ),
    children: [
      {
        kind: "conditional",
        id: "inventory-applicability-condition",
        branchQuestion: {
          kind: "field",
          id: "inventory-applicability-question",
          label: localizedText(
            "客户业务是否包含存货？",
            "Does the client hold inventory?",
            "inventory-applicability-question-label"
          ),
          value: {
            type: "choice",
            cardinality: "one",
            options: [
              {
                id: "yes",
                value: "yes",
                label: localizedText(
                  "是",
                  "Yes",
                  "inventory-applicability-yes"
                ),
              },
              {
                id: "no",
                value: "no",
                label: localizedText("否", "No", "inventory-applicability-no"),
              },
              {
                id: "uncertain",
                value: "uncertain",
                label: localizedText(
                  "尚不确定",
                  "Not determined",
                  "inventory-applicability-uncertain"
                ),
              },
            ],
          },
          required: true,
        },
        branches: [
          {
            id: "inventory-program-branch",
            comparison: {
              type: "singleChoice",
              operator: "selected",
              optionId: "yes",
            },
            children: [
              {
                kind: "content",
                id: "inventory-matched-content",
                content: localizedText(
                  "执行存货监盘及计价测试。",
                  "Perform inventory attendance and valuation testing.",
                  "inventory-matched-content"
                ),
              },
            ],
          },
          {
            id: "inventory-follow-up-branch",
            comparison: {
              type: "singleChoice",
              operator: "selected",
              optionId: "uncertain",
            },
            children: [],
          },
        ],
        otherwise: {
          id: "inventory-skip-branch",
          children: [
            {
              kind: "content",
              id: "inventory-otherwise-content",
              content: localizedText(
                "记录不适用存货程序的理由。",
                "Document why inventory procedures do not apply.",
                "inventory-otherwise-content"
              ),
            },
          ],
        },
      },
    ],
  });

export const CONDITIONAL_CONTENT_SMART_FORM_V2_COMPILED_FIXTURE: SmartFormV2CompiledDefinition =
  compileSmartFormV2Definition(
    CONDITIONAL_CONTENT_SMART_FORM_V2_AUTHORED_FIXTURE,
    STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY
  );

/**
 * A production-shaped response used by the read-only renderer preview. It is
 * intentionally incomplete so the same page demonstrates both resolved values
 * and the neutral empty state.
 */
export const DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE: SmartFormV2Response =
  SmartFormV2ResponseSchema.parse({
    kind: "smartFormResponse",
    schemaVersion: 2,
    definitionVersionId: "audit-programme-deferred-income-v2",
    responseLocale: "zh-CN",
    updatedAt: "2026-07-31T00:00:00.000Z",
    fields: {
      "deferred-income-final-conclusion-confirmation": {
        type: "choice",
        selectedOptionIds: ["confirmed"],
      },
      "deferred-income-final-conclusion-details": richTextValue(
        "未发现需要在最终结论中说明的例外事项。",
        "No exceptions were identified for inclusion in the final conclusion.",
        "deferred-income-final-conclusion-answer"
      ),
    },
    sheets: {
      "deferred-income-general-procedures": {
        rows: [
          responseRow("deferred-income-procedure-1", 0, {
            "test-required": choiceValue("yes"),
            result: choiceValue("satisfactory"),
            "working-paper-reference": referenceValue(
              "working-paper-deferred-income-lead-schedule",
              "3200.1 Deferred income lead schedule"
            ),
            comments: richTextValue(
              "主表已与总账核对，无差异。",
              "The lead schedule was agreed to the general ledger with no differences.",
              "deferred-income-procedure-1-comment"
            ),
          }),
          responseRow("deferred-income-procedure-2-a", 1, {
            "test-required": choiceValue("yes"),
            result: choiceValue("satisfactory"),
            "working-paper-reference": referenceValue(
              "working-paper-deferred-income-analytics",
              "3200.2 Deferred income analytics"
            ),
            comments: richTextValue(
              "本期余额较上期增加 8.4%，变动与新增合同一致。",
              "The balance increased by 8.4%; the movement is consistent with new contracts.",
              "deferred-income-procedure-2-a-comment"
            ),
          }),
          responseRow("deferred-income-procedure-2-b", 2, {
            "test-required": choiceValue("yes"),
            result: choiceValue("satisfactory"),
            comments: richTextValue(
              "关键比率与预期一致。",
              "Key ratios were consistent with expectations.",
              "deferred-income-procedure-2-b-comment"
            ),
          }),
          responseRow("deferred-income-procedure-3", 3, {
            "test-required": choiceValue("yes"),
            result: choiceValue("not-applicable"),
            comments: richTextValue(
              "未发现超过执行重要性水平的异常项目。",
              "No unusual items above performance materiality were identified.",
              "deferred-income-procedure-3-comment"
            ),
          }),
        ],
      },
    },
  });

/** Reference choices used by the V2 preview and editor demonstration route. */
export const DEFERRED_INCOME_SMART_FORM_V2_REFERENCE_OPTIONS = [
  {
    targetType: "projectWing.workingPaper",
    targetId: "working-paper-deferred-income-lead-schedule",
    label: "3200.1 Deferred income lead schedule",
    path: "Execution / Deferred income",
  },
  {
    targetType: "projectWing.workingPaper",
    targetId: "working-paper-deferred-income-analytics",
    label: "3200.2 Deferred income analytics",
    path: "Execution / Deferred income",
  },
  {
    targetType: "projectWing.workingPaper",
    targetId: "working-paper-deferred-income-support",
    label: "3200.3 Deferred income supporting documents",
    path: "Execution / Deferred income",
  },
];

function auditProcedureSection(input: {
  id: string;
  titleZh: string;
  titleEn: string;
  descriptionZh?: string;
  descriptionEn?: string;
  procedures: AuditProcedureSheetRow[];
}) {
  const props: AuditProcedureSheetProps = {
    procedures: input.procedures,
    referenceTargetTypes: ["projectWing.workingPaper"],
  };
  return {
    kind: "section" as const,
    id: input.id,
    title: localizedText(input.titleZh, input.titleEn, `${input.id}-title`),
    ...(input.descriptionZh || input.descriptionEn
      ? {
          description: localizedText(
            input.descriptionZh ?? "",
            input.descriptionEn ?? "",
            `${input.id}-description`
          ),
        }
      : {}),
    children: [
      {
        kind: "component" as const,
        id: `${input.id}-procedures`,
        componentId: AUDIT_PROCEDURE_SHEET_COMPONENT_ID,
        componentVersion: AUDIT_PROCEDURE_SHEET_COMPONENT_VERSION,
        props,
      },
    ],
  };
}

function auditObjectivesContent(
  id: string,
  objectivesZh: string[],
  objectivesEn: string[]
) {
  return {
    kind: "content" as const,
    id,
    content: {
      values: {
        "zh-CN": auditObjectivesDocument("审计目标", objectivesZh, `${id}-zh`),
        "en-US": auditObjectivesDocument(
          "Audit objectives",
          objectivesEn,
          `${id}-en`
        ),
      },
    },
  };
}

function auditObjectivesDocument(
  title: string,
  objectives: string[],
  id: string
) {
  return {
    type: "doc" as const,
    version: 1 as const,
    content: [
      {
        type: "heading" as const,
        id: `${id}-title`,
        level: 2 as const,
        content: [{ type: "text" as const, text: title }],
      },
      {
        type: "orderedList" as const,
        id: `${id}-list`,
        items: objectives.map((objective, index) => ({
          id: `${id}-item-${index + 1}`,
          content: [
            {
              type: "paragraph" as const,
              id: `${id}-item-${index + 1}-paragraph`,
              content: [{ type: "text" as const, text: objective }],
            },
          ],
        })),
      },
    ],
  };
}

function procedure(id: string, zh: string, en: string): AuditProcedureSheetRow {
  return {
    id,
    role: "data",
    label: localizedText(zh, en, `${id}-label`),
  };
}

function procedureGroup(
  id: string,
  zh: string,
  en: string,
  children: AuditProcedureSheetRow[]
): AuditProcedureSheetRow {
  return {
    id,
    role: "group",
    label: localizedText(zh, en, `${id}-label`),
    children,
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

function choiceValue(optionId: string) {
  return {
    type: "choice" as const,
    selectedOptionIds: [optionId],
  };
}

function referenceValue(targetId: string, labelSnapshot: string) {
  return {
    type: "reference" as const,
    references: [
      {
        targetType: "projectWing.workingPaper",
        targetId,
        labelSnapshot,
      },
    ],
  };
}

function richTextValue(zh: string, en: string, id: string) {
  return {
    type: "localized" as const,
    values: {
      "zh-CN": {
        type: "richText" as const,
        document: paragraphDocument(zh, `${id}-zh`),
      },
      "en-US": {
        type: "richText" as const,
        document: paragraphDocument(en, `${id}-en`),
      },
    },
  };
}

function responseRow(
  sourceRowId: string,
  order: number,
  cells: Record<string, unknown>
) {
  return {
    id: `${sourceRowId}-response`,
    sourceRowId,
    order,
    cells,
  };
}
