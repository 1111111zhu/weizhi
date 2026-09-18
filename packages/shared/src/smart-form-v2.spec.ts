import { describe, expect, it } from "vitest";

import {
  SmartFormV2DefinitionSchema,
  SmartFormV2FieldDefinitionSchema,
  SmartFormV2FieldValueSchema,
  SmartFormV2ResponseSchema,
  SmartFormV2RichTextDocumentSchema,
} from "./smart-form-v2";

function richText(text: string, id: string) {
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

function localized(zh: string, en: string, id: string) {
  return {
    values: {
      "zh-CN": richText(zh, `${id}-zh`),
      "en-US": richText(en, `${id}-en`),
    },
  };
}

function choiceField(id: string) {
  return {
    value: {
      type: "choice" as const,
      cardinality: "one" as const,
      options: [
        {
          id: `${id}-yes`,
          value: "yes",
          label: localized("是", "Yes", `${id}-yes-label`),
        },
        {
          id: `${id}-no`,
          value: "no",
          label: localized("否", "No", `${id}-no-label`),
        },
      ],
    },
    required: true,
  };
}

function referenceRichTextField() {
  return {
    value: {
      type: "richText" as const,
      profile: {
        allowedBlocks: ["paragraph"] as const,
        allowedMarks: [] as const,
        allowedEntities: ["workingPaper"] as const,
        presentation: "reference-chips" as const,
      },
    },
  };
}

function makeDefinition() {
  return {
    kind: "smartForm" as const,
    schemaVersion: 2 as const,
    id: "deferred-income-v2",
    i18n: {
      defaultLocale: "zh-CN",
      supportedLocales: ["zh-CN", "en-US"],
      fallbackLocales: {
        "en-US": ["zh-CN"],
      },
      publishingPolicy: "all-supported-required" as const,
    },
    title: localized(
      "审计程序——递延收入",
      "Audit Programme — Deferred Income",
      "form-title"
    ),
    children: [
      {
        kind: "section" as const,
        id: "general-procedures",
        title: localized(
          "一般审计程序",
          "General Audit Procedures",
          "section-title"
        ),
        children: [
          {
            kind: "sheet" as const,
            id: "audit-procedure-sheet",
            title: localized(
              "审计程序表",
              "Audit Procedure Sheet",
              "sheet-title"
            ),
            columns: [
              {
                kind: "column" as const,
                id: "procedure",
                header: localized(
                  "审计程序",
                  "Audit Procedure",
                  "procedure-header"
                ),
                width: "42%",
                cell: { kind: "rowLabel" as const },
              },
              {
                kind: "column" as const,
                id: "test-required",
                header: localized(
                  "是否执行",
                  "Test Required",
                  "test-required-header"
                ),
                cell: {
                  kind: "field" as const,
                  field: choiceField("test-required"),
                },
              },
              {
                kind: "column" as const,
                id: "references",
                header: localized(
                  "底稿引用",
                  "Working Paper References",
                  "references-header"
                ),
                cell: {
                  kind: "field" as const,
                  field: referenceRichTextField(),
                },
              },
            ],
            rows: {
              mode: "fixed" as const,
              numbering: {
                enabled: true,
                style: "decimal" as const,
                child: {
                  enabled: true,
                  style: "lower-alpha" as const,
                  prefix: "(",
                  suffix: ")",
                },
              },
              items: [
                {
                  id: "procedure-1",
                  role: "data" as const,
                  label: localized(
                    "取得并检查本年度的主表",
                    "Obtain and check the current-year lead schedule",
                    "procedure-1-label"
                  ),
                },
                {
                  id: "procedure-2",
                  role: "group" as const,
                  label: localized(
                    "执行分析程序",
                    "Perform analytical procedures",
                    "procedure-2-label"
                  ),
                  children: [
                    {
                      id: "procedure-2-a",
                      role: "data" as const,
                      label: localized(
                        "将本期数据与以前期间的数据进行比较",
                        "Compare current-period data with prior periods",
                        "procedure-2-a-label"
                      ),
                    },
                    {
                      id: "procedure-2-b",
                      role: "data" as const,
                      label: localized(
                        "复核并比较关键比率或其他绩效指标",
                        "Review key ratios and other performance indicators",
                        "procedure-2-b-label"
                      ),
                    },
                  ],
                },
              ],
            },
            presentation: {
              density: "compact" as const,
              width: "full" as const,
              stickyHeader: true,
              showGridLines: true,
              responsive: "cards" as const,
            },
          },
          {
            kind: "component" as const,
            id: "conclusion-component-instance",
            componentId: "audit-conclusion",
            componentVersion: 1,
            props: {},
          },
        ],
      },
    ],
    componentLocks: [
      {
        componentId: "audit-conclusion",
        componentVersion: 1,
        digest: "a".repeat(64),
      },
    ],
  };
}

describe("smartForm V2 definition", () => {
  it("accepts a bilingual audit sheet with hierarchical procedure rows", () => {
    const result = SmartFormV2DefinitionSchema.safeParse(makeDefinition());

    expect(result.success).toBeTruthy();
    if (!result.success) {
      return;
    }
    const [section] = result.data.children;
    expect(section?.kind).toBe("section");
    if (section?.kind !== "section") {
      return;
    }
    const [sheet] = section.children;
    expect(sheet?.kind).toBe("sheet");
    if (sheet?.kind !== "sheet" || sheet.rows.mode !== "fixed") {
      return;
    }
    expect(sheet.rows.items[1]?.children?.map((row) => row.id)).toStrictEqual([
      "procedure-2-a",
      "procedure-2-b",
    ]);
    expect(sheet.rows.numbering?.child).toMatchObject({
      style: "lower-alpha",
      prefix: "(",
      suffix: ")",
    });
  });

  it("enforces native locale coverage and rejects fallback cycles", () => {
    const missingEnglish = makeDefinition();
    delete missingEnglish.title.values["en-US"];
    expect(
      SmartFormV2DefinitionSchema.safeParse(missingEnglish).success
    ).toBeFalsy();

    const unsupportedLocale = makeDefinition();
    assertPresentValue(unsupportedLocale.children[0]).title.values["fr-FR"] =
      richText("Procédures générales", "section-title-fr");
    expect(
      SmartFormV2DefinitionSchema.safeParse(unsupportedLocale).success
    ).toBeFalsy();

    const fallbackCycle = makeDefinition();
    fallbackCycle.i18n.fallbackLocales = {
      "zh-CN": ["en-US"],
      "en-US": ["zh-CN"],
    };
    expect(
      SmartFormV2DefinitionSchema.safeParse(fallbackCycle).success
    ).toBeFalsy();
  });

  it("rejects duplicate Sheet row and column identities", () => {
    const duplicateColumns = makeDefinition();
    const sheet = assertPresentValue(
      assertPresentValue(duplicateColumns.children[0]).children[0]
    );
    if (sheet.kind !== "sheet") {
      throw new Error("Expected Sheet fixture");
    }
    assertPresentValue(sheet.columns[1]).id = "procedure";
    expect(
      SmartFormV2DefinitionSchema.safeParse(duplicateColumns).success
    ).toBeFalsy();

    const duplicateRows = makeDefinition();
    const rowSheet = assertPresentValue(
      assertPresentValue(duplicateRows.children[0]).children[0]
    );
    if (rowSheet.kind !== "sheet" || rowSheet.rows.mode !== "fixed") {
      throw new Error("Expected fixed Sheet fixture");
    }
    assertPresentValue(
      assertPresentValue(assertPresentValue(rowSheet.rows.items[1]).children)[1]
    ).id = "procedure-2-a";
    expect(
      SmartFormV2DefinitionSchema.safeParse(duplicateRows).success
    ).toBeFalsy();
  });

  it("rejects fixed-row cell overrides for unknown columns", () => {
    const definition = makeDefinition();
    const sheet = assertPresentValue(
      assertPresentValue(definition.children[0]).children[0]
    );
    if (sheet.kind !== "sheet" || sheet.rows.mode !== "fixed") {
      throw new Error("Expected fixed Sheet fixture");
    }
    assertPresentValue(sheet.rows.items[0]).cells = {
      "missing-column": {
        kind: "empty",
      },
    };

    const result = SmartFormV2DefinitionSchema.safeParse(definition);

    expect(result.success).toBeFalsy();
    if (result.success) {
      return;
    }
    expect(
      result.error.issues.some((issue) =>
        issue.message.includes("existing column")
      )
    ).toBeTruthy();
  });

  it("requires every component instance to have an immutable version lock", () => {
    const definition = makeDefinition();
    definition.componentLocks = [];

    const result = SmartFormV2DefinitionSchema.safeParse(definition);

    expect(result.success).toBeFalsy();
    if (result.success) {
      return;
    }
    expect(
      result.error.issues.some((issue) =>
        issue.message.includes("matching version lock")
      )
    ).toBeTruthy();
  });

  it("allows per-locale answers only for Text and RichText fields", () => {
    const definition = makeDefinition();
    const sheet = assertPresentValue(
      assertPresentValue(definition.children[0]).children[0]
    );
    if (sheet.kind !== "sheet") {
      throw new Error("Expected Sheet fixture");
    }
    const choiceColumn = assertPresentValue(sheet.columns[1]);
    if (choiceColumn.kind !== "column" || choiceColumn.cell.kind !== "field") {
      throw new Error("Expected field column fixture");
    }
    Object.assign(choiceColumn.cell.field, {
      answerLocaleMode: "per-locale" as const,
    });

    const result = SmartFormV2DefinitionSchema.safeParse(definition);

    expect(result.success).toBeFalsy();
    if (result.success) {
      return;
    }
    expect(
      result.error.issues.some((issue) =>
        issue.message.includes("only supported for Text and RichText")
      )
    ).toBeTruthy();
  });
});

describe("smartForm V2 primitive fields", () => {
  it("supports seven bounded field definition types", () => {
    const definitions = [
      choiceField("bounded-choice").value,
      {
        type: "text",
        multiline: false,
        trim: true,
        minLength: 2,
        maxLength: 80,
      },
      {
        type: "richText",
        profile: {
          allowedBlocks: ["paragraph"],
          allowedMarks: ["bold"],
          allowedEntities: [],
          presentation: "compact",
        },
      },
      {
        type: "attachment",
        cardinality: "many",
        allowedMediaTypes: ["application/pdf", "image/png"],
        maxFiles: 5,
        maxFileSizeBytes: 20_000_000,
      },
      {
        type: "reference",
        cardinality: "many",
        targetTypes: [
          "projectWing.workingPaper",
          "projectWing.smartFormResponse",
        ],
        maxItems: 10,
      },
      {
        type: "date",
        precision: "day",
        min: "2020-01-01",
        max: "2030-12-31",
      },
      {
        type: "number",
        scale: 2,
        min: "-1000000.00",
        max: "1000000.00",
        format: "currency",
        currencyCode: "CNY",
        unit: localized("人民币", "Chinese yuan", "currency-unit"),
      },
    ];
    const results = definitions.map((definition) =>
      SmartFormV2FieldDefinitionSchema.safeParse(definition)
    );

    expect(results.every((result) => result.success)).toBeTruthy();
    expect(
      results.flatMap((result) => (result.success ? [result.data.type] : []))
    ).toStrictEqual([
      "choice",
      "text",
      "richText",
      "attachment",
      "reference",
      "date",
      "number",
    ]);
  });

  it("rejects contradictory type-specific constraints", () => {
    const invalidDefinitions = [
      {
        type: "text",
        minLength: 20,
        maxLength: 10,
      },
      {
        type: "attachment",
        cardinality: "one",
        maxFiles: 2,
      },
      {
        type: "reference",
        cardinality: "one",
        targetTypes: ["projectWing.workingPaper"],
        maxItems: 2,
      },
      {
        type: "date",
        precision: "month",
        min: "2026-07-01",
      },
      {
        type: "number",
        format: "currency",
      },
      {
        type: "number",
        min: "10.01",
        max: "10.001",
      },
    ];

    expect(
      invalidDefinitions.every(
        (definition) =>
          !SmartFormV2FieldDefinitionSchema.safeParse(definition).success
      )
    ).toBeTruthy();
  });
});

describe("smartForm V2 RichText", () => {
  it("supports narrative attachment and working-paper embeds", () => {
    const result = SmartFormV2RichTextDocumentSchema.safeParse({
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          id: "comment-paragraph",
          content: [
            {
              type: "text",
              text: "See ",
              marks: [{ type: "bold" }],
            },
            {
              type: "entityReference",
              id: "working-paper-reference",
              entityType: "workingPaper",
              entityId: "paper-3200-1",
              labelSnapshot: "3200.1 Pedorthic Technology Limited",
            },
          ],
        },
        {
          type: "embed",
          id: "attachment-reference",
          entityType: "attachment",
          entityId: "attachment-bank-confirmation",
          labelSnapshot: "Bank confirmation.pdf",
        },
      ],
    });

    expect(result.success).toBeTruthy();
  });

  it("rejects duplicate RichText node identities", () => {
    const result = SmartFormV2RichTextDocumentSchema.safeParse({
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          id: "duplicate-id",
          content: [],
        },
        {
          type: "embed",
          id: "duplicate-id",
          entityType: "attachment",
          entityId: "attachment-1",
        },
      ],
    });

    expect(result.success).toBeFalsy();
  });
});

describe("smartForm V2 response", () => {
  it("stores all seven primitive values in structured form", () => {
    const values = [
      {
        type: "choice",
        selectedOptionIds: ["yes"],
      },
      {
        type: "text",
        text: "Invoice reference 2026-001",
      },
      {
        type: "richText",
        document: richText("Narrative conclusion", "conclusion"),
      },
      {
        type: "attachment",
        attachments: [
          {
            attachmentId: "attachment-bank-confirmation",
            versionId: "attachment-version-2",
            fileNameSnapshot: "Bank confirmation.pdf",
            mediaTypeSnapshot: "application/pdf",
            sizeBytesSnapshot: 425_000,
          },
        ],
      },
      {
        type: "reference",
        references: [
          {
            targetType: "projectWing.workingPaper",
            targetId: "paper-3200-1",
            labelSnapshot: "3200.1 Pedorthic Technology Limited",
          },
        ],
      },
      {
        type: "date",
        value: "2026-07-31",
      },
      {
        type: "number",
        decimal: "1250000.25",
      },
    ];
    const results = values.map((value) =>
      SmartFormV2FieldValueSchema.safeParse(value)
    );

    expect(results.every((result) => result.success)).toBeTruthy();
  });

  it("rejects ambiguous scalar formats and duplicate entity identities", () => {
    const invalidValues = [
      {
        type: "date",
        value: "31/07/2026",
      },
      {
        type: "date",
        value: "2026-02-31",
      },
      {
        type: "number",
        decimal: 0.1,
      },
      {
        type: "number",
        decimal: "01.50",
      },
      {
        type: "attachment",
        attachments: [
          { attachmentId: "attachment-1" },
          { attachmentId: "attachment-1" },
        ],
      },
      {
        type: "reference",
        references: [
          {
            targetType: "projectWing.workingPaper",
            targetId: "paper-1",
          },
          {
            targetType: "projectWing.workingPaper",
            targetId: "paper-1",
          },
        ],
      },
    ];

    expect(
      invalidValues.every(
        (value) => !SmartFormV2FieldValueSchema.safeParse(value).success
      )
    ).toBeTruthy();
  });

  it("stores repeatable Sheet rows by stable row and column identities", () => {
    const first = {
      id: "sample-row-b",
      order: 1,
      cells: {
        comments: {
          type: "richText" as const,
          document: richText("Second row", "second-row-comment"),
        },
      },
    };
    const second = {
      id: "sample-row-a",
      order: 0,
      cells: {
        result: {
          type: "choice" as const,
          selectedOptionIds: ["satisfactory"],
        },
      },
    };
    const result = SmartFormV2ResponseSchema.safeParse({
      kind: "smartFormResponse",
      schemaVersion: 2,
      definitionVersionId: "definition-version-1",
      responseLocale: "zh-CN",
      updatedAt: "2026-07-31T01:00:00.000Z",
      fields: {},
      sheets: {
        samples: {
          rows: [first, second],
        },
      },
    });

    expect(result.success).toBeTruthy();
    if (!result.success) {
      return;
    }
    expect(result.data.sheets.samples?.rows.map((row) => row.id)).toStrictEqual(
      ["sample-row-b", "sample-row-a"]
    );
    expect(result.data.sheets.samples?.rows[1]?.order).toBe(0);
  });
});

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
