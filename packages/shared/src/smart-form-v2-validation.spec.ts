import { describe, expect, it } from "vitest";

import type {
  SmartFormV2CompiledDefinition,
  SmartFormV2CoreNode,
} from "./smart-form-v2-compiler.js";
import {
  CONDITIONAL_CONTENT_SMART_FORM_V2_COMPILED_FIXTURE,
  DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
  DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
} from "./smart-form-v2-fixtures.js";
import {
  resolveSmartFormV2ConditionalBranch,
  smartFormV2FieldIssueKey,
  smartFormV2SheetCellIssueKey,
  validateSmartFormV2Response,
} from "./smart-form-v2-validation.js";
import { SmartFormV2DefinitionSchema } from "./smart-form-v2.js";
import type {
  SmartFormV2BranchComparison,
  SmartFormV2BranchQuestion,
  SmartFormV2ConditionalNode,
  SmartFormV2Response,
} from "./smart-form-v2.js";

function responseFixture(): SmartFormV2Response {
  return structuredClone(DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE);
}

describe(validateSmartFormV2Response, () => {
  it("reports the intentionally incomplete Deferred Income response fixture", () => {
    const result = validateSmartFormV2Response(
      DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
      responseFixture()
    );

    expect(result.success).toBeFalsy();
    if (result.success) {
      return;
    }
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        key: smartFormV2SheetCellIssueKey(
          "deferred-income-general-procedures",
          "deferred-income-procedure-4-a",
          "test-required"
        ),
        code: "required",
      })
    );
  });

  it("rejects an empty required sheet cell", () => {
    const response = responseFixture();
    const row = response.sheets["deferred-income-general-procedures"].rows.find(
      (item) => item.sourceRowId === "deferred-income-procedure-1"
    );
    expect(row).toBeDefined();
    delete assertPresentValue(row).cells["test-required"];

    const result = validateSmartFormV2Response(
      DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
      response
    );

    expect(result.success).toBeFalsy();
    if (result.success) {
      return;
    }
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        key: smartFormV2SheetCellIssueKey(
          "deferred-income-general-procedures",
          "deferred-income-procedure-1",
          "test-required"
        ),
        code: "required",
      })
    );
  });

  it("rejects rich text content outside the configured profile", () => {
    const response = responseFixture();
    response.fields["deferred-income-final-conclusion-details"] = {
      type: "richText",
      document: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "heading",
            id: "invalid-profile-paragraph",
            level: 2,
            content: [
              {
                type: "text",
                text: "Unsupported heading",
              },
            ],
          },
        ],
      },
    };

    const result = validateSmartFormV2Response(
      DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
      response
    );

    expect(result.success).toBeFalsy();
    if (result.success) {
      return;
    }
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        key: smartFormV2FieldIssueKey(
          "deferred-income-final-conclusion-details"
        ),
        code: "profile",
      })
    );
  });

  it("resolves single-choice, multiple-choice, and number branches", () => {
    const single = conditionalFixture(choiceQuestion("one"), {
      type: "singleChoice",
      operator: "selected",
      optionId: "yes",
    });
    expect(
      resolveSmartFormV2ConditionalBranch(
        single.definition,
        conditionalResponse({
          "branch-question": { type: "choice", selectedOptionIds: [] },
        }),
        single.node
      )
    ).toStrictEqual({ type: "pending" });
    expect(
      resolveSmartFormV2ConditionalBranch(
        single.definition,
        conditionalResponse({
          "branch-question": { type: "choice", selectedOptionIds: ["yes"] },
        }),
        single.node
      )
    ).toStrictEqual({ type: "branch", branchId: "matched-branch" });

    const multiple = conditionalFixture(choiceQuestion("many"), {
      type: "multipleChoice",
      operator: "includesAll",
      optionIds: ["yes", "no"],
    });
    expect(
      resolveSmartFormV2ConditionalBranch(
        multiple.definition,
        conditionalResponse({
          "branch-question": {
            type: "choice",
            selectedOptionIds: ["yes", "no"],
          },
        }),
        multiple.node
      )
    ).toStrictEqual({ type: "branch", branchId: "matched-branch" });

    const number = conditionalFixture(numberQuestion(), {
      type: "number",
      operator: "gte",
      value: "10.00",
    });
    expect(
      resolveSmartFormV2ConditionalBranch(
        number.definition,
        conditionalResponse({
          "branch-question": { type: "number", decimal: "9.999" },
        }),
        number.node
      )
    ).toStrictEqual({ type: "otherwise", branchId: "otherwise-branch" });
    expect(
      resolveSmartFormV2ConditionalBranch(
        number.definition,
        conditionalResponse({
          "branch-question": { type: "number", decimal: "10" },
        }),
        number.node
      )
    ).toStrictEqual({ type: "branch", branchId: "matched-branch" });
  });

  it("validates only the active conditional branch", () => {
    const fixture = conditionalFixture(choiceQuestion("one"), {
      type: "singleChoice",
      operator: "selected",
      optionId: "yes",
    });
    const pending = validateSmartFormV2Response(
      fixture.definition,
      conditionalResponse({})
    );
    expect(pending.success).toBeFalsy();
    expect(pending.issues.map((issue) => issue.key)).toStrictEqual([
      smartFormV2FieldIssueKey("branch-question"),
    ]);

    const matched = validateSmartFormV2Response(
      fixture.definition,
      conditionalResponse({
        "branch-question": { type: "choice", selectedOptionIds: ["yes"] },
      })
    );
    expect(matched.success).toBeFalsy();
    expect(matched.issues.map((issue) => issue.key)).toContain(
      smartFormV2FieldIssueKey("matched-field")
    );
    expect(matched.issues.map((issue) => issue.key)).not.toContain(
      smartFormV2FieldIssueKey("otherwise-field")
    );

    const otherwise = validateSmartFormV2Response(
      fixture.definition,
      conditionalResponse({
        "branch-question": { type: "choice", selectedOptionIds: ["no"] },
      })
    );
    expect(otherwise.success).toBeFalsy();
    expect(otherwise.issues.map((issue) => issue.key)).toContain(
      smartFormV2FieldIssueKey("otherwise-field")
    );
    expect(otherwise.issues.map((issue) => issue.key)).not.toContain(
      smartFormV2FieldIssueKey("matched-field")
    );
  });

  it("allows an unanswered optional branch question", () => {
    const fixture = conditionalFixture(
      { ...choiceQuestion("one"), required: false },
      {
        type: "singleChoice",
        operator: "selected",
        optionId: "yes",
      }
    );

    expect(
      validateSmartFormV2Response(fixture.definition, conditionalResponse({}))
    ).toStrictEqual({ success: true, issues: [] });
  });

  it("resolves the first matching named branch in source order", () => {
    const [node] = CONDITIONAL_CONTENT_SMART_FORM_V2_COMPILED_FIXTURE.children;
    expect(node?.kind).toBe("conditional");
    if (node?.kind !== "conditional") {
      return;
    }
    const response = conditionalResponse({
      "inventory-applicability-question": {
        type: "choice",
        selectedOptionIds: ["uncertain"],
      },
    });
    response.definitionVersionId =
      CONDITIONAL_CONTENT_SMART_FORM_V2_COMPILED_FIXTURE.id;
    expect(
      resolveSmartFormV2ConditionalBranch(
        CONDITIONAL_CONTENT_SMART_FORM_V2_COMPILED_FIXTURE,
        response,
        node
      )
    ).toStrictEqual({
      type: "branch",
      branchId: "inventory-follow-up-branch",
    });
  });

  it("rejects a response owned by another definition or locale", () => {
    const response = responseFixture();
    response.definitionVersionId = "another-definition";
    response.responseLocale = "fr-FR";

    const result = validateSmartFormV2Response(
      DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
      response
    );

    expect(result.success).toBeFalsy();
    if (result.success) {
      return;
    }
    expect(result.issues).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "response.definitionVersionId" }),
        expect.objectContaining({ key: "response.responseLocale" }),
      ])
    );
  });

  it("rejects unknown response addresses and an answer locale envelope mismatch", () => {
    const definition = structuredClone(
      DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE
    );
    const response = responseFixture();
    const field = findField(
      definition,
      "deferred-income-final-conclusion-details"
    );
    field.answerLocaleMode = "per-locale";
    response.fields["deferred-income-final-conclusion-details"] = {
      type: "richText",
      document: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            id: "single-locale-answer",
            content: [{ type: "text", text: "Single locale" }],
          },
        ],
      },
    };
    response.fields["unknown-field"] = {
      type: "text",
      text: "orphaned value",
    };

    const result = validateSmartFormV2Response(definition, response);

    expect(result.success).toBeFalsy();
    if (result.success) {
      return;
    }
    expect(result.issues).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: smartFormV2FieldIssueKey("unknown-field"),
          code: "invalid-response",
        }),
        expect.objectContaining({
          key: smartFormV2FieldIssueKey(
            "deferred-income-final-conclusion-details"
          ),
          code: "type",
        }),
      ])
    );
  });

  it("rejects an embed entity excluded by the rich text profile", () => {
    const definition = structuredClone(
      DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE
    );
    const response = responseFixture();
    const field = findField(
      definition,
      "deferred-income-final-conclusion-details"
    );
    if (field.value.type !== "richText") {
      throw new Error("Fixture field must be RichText");
    }
    field.value.profile.allowedBlocks.push("embed");
    field.value.profile.allowedEntities = ["workingPaper"];
    response.fields["deferred-income-final-conclusion-details"] = {
      type: "richText",
      document: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "embed",
            id: "unsupported-embed",
            entityType: "image",
            entityId: "video-1",
            labelSnapshot: "Unsupported image embed",
          },
        ],
      },
    };

    const result = validateSmartFormV2Response(definition, response);

    expect(result.success).toBeFalsy();
    if (result.success) {
      return;
    }
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        key: smartFormV2FieldIssueKey(
          "deferred-income-final-conclusion-details"
        ),
        code: "profile",
      })
    );
  });
});

function findField(
  definition: SmartFormV2CompiledDefinition,
  fieldId: string
): Extract<SmartFormV2CoreNode, { kind: "field" }> {
  const visit = (
    nodes: SmartFormV2CoreNode[]
  ): Extract<SmartFormV2CoreNode, { kind: "field" }> | undefined => {
    for (const node of nodes) {
      if (node.kind === "field" && node.id === fieldId) {
        return node;
      }
      if (node.kind === "section" || node.kind === "group") {
        const found = visit(node.children);
        if (found) {
          return found;
        }
      }
    }
    return undefined;
  };
  const field = visit(definition.children);
  if (!field) {
    throw new Error(`Missing fixture field: ${fieldId}`);
  }
  return field;
}

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}

function conditionalFixture(
  branchQuestion: SmartFormV2BranchQuestion,
  comparison: SmartFormV2BranchComparison
) {
  const node: SmartFormV2ConditionalNode = {
    kind: "conditional",
    id: "branch-condition",
    branchQuestion,
    branches: [
      {
        id: "matched-branch",
        comparison,
        children: [requiredTextField("matched-field")],
      },
    ],
    otherwise: {
      id: "otherwise-branch",
      children: [requiredTextField("otherwise-field")],
    },
  };
  const definition = SmartFormV2DefinitionSchema.parse({
    kind: "smartForm",
    schemaVersion: 2,
    id: "conditional-definition",
    i18n: {
      defaultLocale: "en-US",
      supportedLocales: ["en-US"],
      publishingPolicy: "default-required",
    },
    title: localized("Conditional definition", "conditional-title"),
    children: [node],
  }) as SmartFormV2CompiledDefinition;
  return { definition, node };
}

function conditionalResponse(
  fields: SmartFormV2Response["fields"]
): SmartFormV2Response {
  return {
    kind: "smartFormResponse",
    schemaVersion: 2,
    definitionVersionId: "conditional-definition",
    responseLocale: "en-US",
    updatedAt: "2026-08-28T00:00:00.000Z",
    fields,
    sheets: {},
  };
}

function choiceQuestion(
  cardinality: "one" | "many"
): SmartFormV2BranchQuestion {
  return {
    kind: "field",
    id: "branch-question",
    label: localized("Does the condition apply?", "branch-question-label"),
    value: {
      type: "choice",
      cardinality,
      options: [
        { id: "yes", value: "yes", label: localized("Yes", "yes-label") },
        { id: "no", value: "no", label: localized("No", "no-label") },
      ],
    },
    required: true,
  };
}

function numberQuestion(): SmartFormV2BranchQuestion {
  return {
    kind: "field",
    id: "branch-question",
    label: localized("Expected misstatement", "number-question-label"),
    value: { type: "number", scale: 3 },
    required: true,
  };
}

function requiredTextField(id: string): SmartFormV2CoreNode {
  return {
    kind: "field",
    id,
    label: localized(id, `${id}-label`),
    value: { type: "text" },
    required: true,
  };
}

function localized(text: string, id: string) {
  return {
    values: {
      "en-US": {
        type: "doc" as const,
        version: 1 as const,
        content: [
          {
            type: "paragraph" as const,
            id,
            content: [{ type: "text" as const, text }],
          },
        ],
      },
    },
  };
}
