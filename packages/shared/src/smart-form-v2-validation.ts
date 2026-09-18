import type {
  SmartFormV2CompiledDefinition,
  SmartFormV2CoreNode,
} from "./smart-form-v2-compiler.js";
import type {
  SmartFormV2ConditionalNode,
  SmartFormV2Expression,
  SmartFormV2FieldAnswer,
  SmartFormV2FieldDefinition,
  SmartFormV2FieldTemplate,
  SmartFormV2FieldValue,
  SmartFormV2FixedSheetRow,
  SmartFormV2Response,
  SmartFormV2RichTextBlock,
  SmartFormV2RichTextInline,
  SmartFormV2SheetLeafColumn,
  SmartFormV2SheetNode,
  SmartFormV2ValidationRule,
} from "./smart-form-v2.js";
import { SmartFormV2ResponseSchema } from "./smart-form-v2.js";

export type SmartFormV2ResponseValidationIssue = {
  key: string;
  code:
    | "invalid-response"
    | "required"
    | "type"
    | "choice"
    | "length"
    | "limit"
    | "range"
    | "precision"
    | "profile";
  message: string;
};

export type SmartFormV2ResponseValidationResult =
  | { success: true; issues: [] }
  | { success: false; issues: SmartFormV2ResponseValidationIssue[] };

export function smartFormV2FieldIssueKey(fieldId: string) {
  return `field:${fieldId}`;
}

export function smartFormV2SheetCellIssueKey(
  sheetId: string,
  rowId: string,
  columnId: string
) {
  return `sheet:${sheetId}:${rowId}:${columnId}`;
}

export function isSmartFormV2ExpressionTrue(
  definition: SmartFormV2CompiledDefinition,
  response: SmartFormV2Response,
  expression: SmartFormV2Expression | undefined
) {
  if (expression === undefined) {
    return true;
  }
  return isExpressionTrue(expression, {
    definition,
    response,
    issues: [],
  });
}

export type SmartFormV2ConditionalBranch =
  | { type: "branch"; branchId: string }
  | { type: "otherwise"; branchId: string }
  | { type: "pending" };

export function resolveSmartFormV2ConditionalBranch(
  definition: SmartFormV2CompiledDefinition,
  response: SmartFormV2Response,
  node: SmartFormV2ConditionalNode
): SmartFormV2ConditionalBranch {
  return resolveConditionalBranch(node, {
    definition,
    response,
    issues: [],
  });
}

export function validateSmartFormV2Response(
  definition: SmartFormV2CompiledDefinition,
  response: SmartFormV2Response
): SmartFormV2ResponseValidationResult {
  const structural = SmartFormV2ResponseSchema.safeParse(response);
  if (!structural.success) {
    return {
      success: false,
      issues: structural.error.issues.map((issue) => ({
        key: issue.path.join(".") || "response",
        code: "invalid-response" as const,
        message: issue.message,
      })),
    };
  }

  const issues: SmartFormV2ResponseValidationIssue[] = [];
  if (response.definitionVersionId !== definition.id) {
    issues.push({
      key: "response.definitionVersionId",
      code: "invalid-response",
      message: "The response belongs to a different definition version.",
    });
  }
  if (!definition.i18n.supportedLocales.includes(response.responseLocale)) {
    issues.push({
      key: "response.responseLocale",
      code: "invalid-response",
      message: "The response locale is not supported by this definition.",
    });
  }
  const context: ValidationContext = { definition, response, issues };
  validateResponseAddresses(context);
  definition.children.forEach((node) => validateNode(node, context));
  return issues.length > 0
    ? { success: false, issues }
    : { success: true, issues: [] };
}

type ValidationContext = {
  definition: SmartFormV2CompiledDefinition;
  response: SmartFormV2Response;
  issues: SmartFormV2ResponseValidationIssue[];
};

function validateNode(node: SmartFormV2CoreNode, context: ValidationContext) {
  if (
    node.visibleWhen !== undefined &&
    !isExpressionTrue(node.visibleWhen, context)
  ) {
    return;
  }
  if (node.kind === "section" || node.kind === "group") {
    node.children.forEach((child) => validateNode(child, context));
    return;
  }
  if (node.kind === "conditional") {
    const question = node.branchQuestion;
    const key = smartFormV2FieldIssueKey(question.id);
    const answer = context.response.fields[question.id];
    validateAnswerEnvelope(key, answer, undefined, context);
    validateField(
      key,
      question.value,
      question,
      resolveAnswerValue(
        answer,
        context.response.responseLocale,
        context.definition.i18n.defaultLocale,
        context.definition.i18n.fallbackLocales?.[
          context.response.responseLocale
        ]
      ),
      context
    );
    const branch = resolveConditionalBranch(node, context);
    if (branch.type === "branch") {
      node.branches
        .find((candidate) => candidate.id === branch.branchId)
        ?.children.forEach((child) => validateNode(child, context));
    } else if (branch.type === "otherwise") {
      node.otherwise.children.forEach((child) => validateNode(child, context));
    }
    return;
  }
  if (node.kind === "field") {
    const key = smartFormV2FieldIssueKey(node.id);
    validateAnswerEnvelope(
      key,
      context.response.fields[node.id],
      node.answerLocaleMode,
      context
    );
    validateField(
      key,
      node.value,
      node,
      resolveAnswerValue(
        context.response.fields[node.id],
        context.response.responseLocale,
        context.definition.i18n.defaultLocale,
        context.definition.i18n.fallbackLocales?.[
          context.response.responseLocale
        ]
      ),
      context
    );
    return;
  }
  if (node.kind === "sheet") {
    validateSheet(node, context);
  }
}

function validateSheet(
  sheet: SmartFormV2SheetNode,
  context: ValidationContext
) {
  const answerRows = context.response.sheets[sheet.id]?.rows ?? [];
  const columns = sheet.columns.flatMap(flattenColumns);

  if (sheet.rows.mode === "repeatable") {
    const count = answerRows.length;
    if (
      (sheet.rows.minRows !== undefined && count < sheet.rows.minRows) ||
      (sheet.rows.maxRows !== undefined && count > sheet.rows.maxRows)
    ) {
      context.issues.push({
        key: `sheet:${sheet.id}`,
        code: "limit",
        message: "Sheet row count is outside the configured limits.",
      });
    }
    answerRows.forEach((row) => {
      columns.forEach((column) => {
        if (column.cell.kind !== "field") {
          return;
        }
        validateAnswerEnvelope(
          smartFormV2SheetCellIssueKey(sheet.id, row.id, column.id),
          row.cells[column.id],
          column.cell.field.answerLocaleMode,
          context
        );
        validateField(
          smartFormV2SheetCellIssueKey(sheet.id, row.id, column.id),
          column.cell.field.value,
          column.cell.field,
          resolveAnswerValue(
            row.cells[column.id],
            context.response.responseLocale,
            context.definition.i18n.defaultLocale,
            context.definition.i18n.fallbackLocales?.[
              context.response.responseLocale
            ]
          ),
          context
        );
      });
    });
    return;
  }

  const answerRowsBySource = new Map(
    answerRows.map((row) => [row.sourceRowId ?? row.id, row])
  );
  flattenFixedRows(sheet.rows.items).forEach((row) => {
    const answerRow = answerRowsBySource.get(row.id);
    columns.forEach((column) => {
      if (column.cell.kind !== "field") {
        return;
      }
      const override = row.cells?.[column.id];
      if (override?.kind === "empty" || override?.kind === "content") {
        return;
      }
      if (
        override?.kind === "field" &&
        override.visibleWhen !== undefined &&
        !isExpressionTrue(override.visibleWhen, context)
      ) {
        return;
      }
      const template: SmartFormV2FieldTemplate = {
        ...column.cell.field,
        value:
          override?.kind === "field" &&
          override.profileOverride &&
          column.cell.field.value.type === "richText"
            ? {
                ...column.cell.field.value,
                profile: override.profileOverride,
              }
            : column.cell.field.value,
      };
      validateAnswerEnvelope(
        smartFormV2SheetCellIssueKey(sheet.id, row.id, column.id),
        answerRow?.cells[column.id],
        template.answerLocaleMode,
        context
      );
      validateField(
        smartFormV2SheetCellIssueKey(sheet.id, row.id, column.id),
        template.value,
        template,
        resolveAnswerValue(
          answerRow?.cells[column.id],
          context.response.responseLocale,
          context.definition.i18n.defaultLocale,
          context.definition.i18n.fallbackLocales?.[
            context.response.responseLocale
          ]
        ),
        context
      );
    });
  });
}

function validateField(
  key: string,
  definition: SmartFormV2FieldDefinition,
  behavior: Pick<
    SmartFormV2FieldTemplate,
    "required" | "requiredWhen" | "validations"
  >,
  value: SmartFormV2FieldValue | undefined,
  context: ValidationContext
) {
  const required =
    behavior.required === true ||
    isExpressionTrue(behavior.requiredWhen, context);
  if (isEmptyFieldValue(value)) {
    if (required) {
      context.issues.push({
        key,
        code: "required",
        message: "A required response is missing.",
      });
    }
    return;
  }
  if (!value || value.type !== definition.type) {
    context.issues.push({
      key,
      code: "type",
      message: "The response type does not match the field definition.",
    });
    return;
  }

  switch (definition.type) {
    case "choice": {
      if (value.type !== "choice") {
        return;
      }
      const allowed = new Set(definition.options.map((option) => option.id));
      if (
        (definition.cardinality === "one" &&
          value.selectedOptionIds.length > 1) ||
        value.selectedOptionIds.some((id) => !allowed.has(id))
      ) {
        addIssue(context, key, "choice", "The selected choice is not allowed.");
      }
      validateRules(key, behavior.validations, value, context);
      return;
    }
    case "text": {
      if (value.type !== "text") {
        return;
      }
      const text = definition.trim ? value.text.trim() : value.text;
      if (
        (definition.minLength !== undefined &&
          text.length < definition.minLength) ||
        (definition.maxLength !== undefined &&
          text.length > definition.maxLength)
      ) {
        addIssue(
          context,
          key,
          "length",
          "Text length is outside the configured limits."
        );
      }
      return;
    }
    case "richText": {
      if (value.type !== "richText") {
        return;
      }
      if (!richTextMatchesProfile(value.document.content, definition.profile)) {
        addIssue(
          context,
          key,
          "profile",
          "Rich text contains content that is not allowed by its profile."
        );
      }
      validateRules(key, behavior.validations, value, context);
      return;
    }
    case "attachment": {
      if (value.type !== "attachment") {
        return;
      }
      const maxFiles =
        definition.cardinality === "one" ? 1 : definition.maxFiles;
      if (
        (maxFiles !== undefined && value.attachments.length > maxFiles) ||
        value.attachments.some(
          (attachment) =>
            (definition.maxFileSizeBytes !== undefined &&
              attachment.sizeBytesSnapshot !== undefined &&
              attachment.sizeBytesSnapshot > definition.maxFileSizeBytes) ||
            (definition.allowedMediaTypes !== undefined &&
              attachment.mediaTypeSnapshot !== undefined &&
              !definition.allowedMediaTypes.includes(
                attachment.mediaTypeSnapshot
              ))
        )
      ) {
        addIssue(
          context,
          key,
          "limit",
          "An attachment violates the configured file limits."
        );
      }
      return;
    }
    case "reference": {
      if (value.type !== "reference") {
        return;
      }
      const maxItems =
        definition.cardinality === "one" ? 1 : definition.maxItems;
      if (
        (maxItems !== undefined && value.references.length > maxItems) ||
        value.references.some(
          (reference) => !definition.targetTypes.includes(reference.targetType)
        )
      ) {
        addIssue(
          context,
          key,
          "limit",
          "A reference violates the configured target or item limits."
        );
      }
      return;
    }
    case "date": {
      if (value.type !== "date") {
        return;
      }
      const pattern =
        definition.precision === "day"
          ? /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/
          : definition.precision === "month"
            ? /^\d{4}-(?:0[1-9]|1[0-2])$/
            : /^\d{4}$/;
      if (
        !pattern.test(value.value) ||
        (definition.min !== undefined && value.value < definition.min) ||
        (definition.max !== undefined && value.value > definition.max)
      ) {
        addIssue(
          context,
          key,
          "range",
          "Date is outside the configured range."
        );
      }
      return;
    }
    case "number": {
      if (value.type !== "number") {
        return;
      }
      const fraction = value.decimal.split(".")[1] ?? "";
      if (
        (definition.scale !== undefined &&
          fraction.length > definition.scale) ||
        (definition.min !== undefined &&
          compareDecimals(value.decimal, definition.min) < 0) ||
        (definition.max !== undefined &&
          compareDecimals(value.decimal, definition.max) > 0)
      ) {
        addIssue(
          context,
          key,
          definition.scale !== undefined && fraction.length > definition.scale
            ? "precision"
            : "range",
          "Number is outside the configured range or precision."
        );
      }
      break;
    }

    default: {
      break;
    }
  }
}

function validateAnswerEnvelope(
  key: string,
  answer: SmartFormV2FieldAnswer | undefined,
  answerLocaleMode: "single" | "per-locale" | undefined,
  context: ValidationContext
) {
  if (!answer) {
    return;
  }
  const expectsLocalized = answerLocaleMode === "per-locale";
  if (expectsLocalized !== (answer.type === "localized")) {
    context.issues.push({
      key,
      code: "type",
      message: expectsLocalized
        ? "This field requires per-locale response values."
        : "This field requires a single response value.",
    });
    return;
  }
  if (answer.type !== "localized") {
    return;
  }
  for (const locale of Object.keys(answer.values)) {
    if (!context.definition.i18n.supportedLocales.includes(locale)) {
      context.issues.push({
        key,
        code: "invalid-response",
        message: `Localized response value uses unsupported locale "${locale}".`,
      });
    }
  }
}

function validateResponseAddresses(context: ValidationContext) {
  const fields = new Set<string>();
  const sheets = new Map<
    string,
    {
      columns: Set<string>;
      fixedRows?: Set<string>;
    }
  >();
  const visit = (node: SmartFormV2CoreNode) => {
    if (node.kind === "section" || node.kind === "group") {
      node.children.forEach(visit);
      return;
    }
    if (node.kind === "conditional") {
      fields.add(node.branchQuestion.id);
      node.branches.forEach((branch) => branch.children.forEach(visit));
      node.otherwise.children.forEach(visit);
      return;
    }
    if (node.kind === "field") {
      fields.add(node.id);
      return;
    }
    if (node.kind !== "sheet") {
      return;
    }
    const columns = new Set(
      node.columns
        .flatMap(flattenColumns)
        .filter((column) => column.cell.kind === "field")
        .map((column) => column.id)
    );
    const fixedRows =
      node.rows.mode === "fixed"
        ? new Set(flattenFixedRows(node.rows.items).map((row) => row.id))
        : undefined;
    sheets.set(node.id, { columns, fixedRows });
  };
  context.definition.children.forEach(visit);

  for (const fieldId of Object.keys(context.response.fields)) {
    if (!fields.has(fieldId)) {
      context.issues.push({
        key: smartFormV2FieldIssueKey(fieldId),
        code: "invalid-response",
        message: "The response contains an unknown field address.",
      });
    }
  }
  for (const [sheetId, answer] of Object.entries(context.response.sheets)) {
    const definition = sheets.get(sheetId);
    if (!definition) {
      context.issues.push({
        key: `sheet:${sheetId}`,
        code: "invalid-response",
        message: "The response contains an unknown sheet address.",
      });
      continue;
    }
    for (const row of answer.rows) {
      const sourceRowId = row.sourceRowId ?? row.id;
      if (definition.fixedRows && !definition.fixedRows.has(sourceRowId)) {
        context.issues.push({
          key: `sheet:${sheetId}:${sourceRowId}`,
          code: "invalid-response",
          message: "The response contains an unknown fixed-row address.",
        });
      }
      for (const columnId of Object.keys(row.cells)) {
        if (!definition.columns.has(columnId)) {
          context.issues.push({
            key: smartFormV2SheetCellIssueKey(sheetId, sourceRowId, columnId),
            code: "invalid-response",
            message: "The response contains an unknown sheet-column address.",
          });
        }
      }
    }
  }
}

function resolveConditionalBranch(
  node: SmartFormV2ConditionalNode,
  context: ValidationContext
): SmartFormV2ConditionalBranch {
  const value = resolveAnswerValue(
    context.response.fields[node.branchQuestion.id],
    context.response.responseLocale,
    context.definition.i18n.defaultLocale,
    context.definition.i18n.fallbackLocales?.[context.response.responseLocale]
  );
  if (!value || value.type !== node.branchQuestion.value.type) {
    return { type: "pending" };
  }
  if (value.type === "choice") {
    if (value.selectedOptionIds.length === 0) {
      return { type: "pending" };
    }
    const matchedBranch = node.branches.find((branch) => {
      const { comparison } = branch;
      if (comparison.type === "singleChoice") {
        return value.selectedOptionIds.includes(comparison.optionId);
      }
      if (comparison.type === "multipleChoice") {
        return comparison.operator === "includesAll"
          ? comparison.optionIds.every((optionId) =>
              value.selectedOptionIds.includes(optionId)
            )
          : comparison.optionIds.some((optionId) =>
              value.selectedOptionIds.includes(optionId)
            );
      }
      return false;
    });
    return matchedBranch
      ? { type: "branch", branchId: matchedBranch.id }
      : { type: "otherwise", branchId: node.otherwise.id };
  }
  if (value.type !== "number") {
    return { type: "pending" };
  }
  const matchedBranch = node.branches.find((branch) => {
    if (branch.comparison.type !== "number") {
      return false;
    }
    const compared = compareDecimalTokens(
      value.decimal,
      branch.comparison.value
    );
    return branch.comparison.operator === "gt"
      ? compared > 0
      : branch.comparison.operator === "gte"
        ? compared >= 0
        : branch.comparison.operator === "eq"
          ? compared === 0
          : branch.comparison.operator === "lte"
            ? compared <= 0
            : compared < 0;
  });
  return matchedBranch
    ? { type: "branch", branchId: matchedBranch.id }
    : { type: "otherwise", branchId: node.otherwise.id };
}

function compareDecimalTokens(left: string, right: string) {
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

function validateRules(
  key: string,
  rules: SmartFormV2ValidationRule[] | undefined,
  value: SmartFormV2FieldValue,
  context: ValidationContext
) {
  rules?.forEach((rule) => {
    const count =
      rule.type === "choiceCount" && value.type === "choice"
        ? value.selectedOptionIds.length
        : rule.type === "richTextLength" && value.type === "richText"
          ? richTextPlainText(value.document.content).length
          : undefined;
    if (
      count !== undefined &&
      ((rule.min !== undefined && count < rule.min) ||
        (rule.max !== undefined && count > rule.max))
    ) {
      addIssue(
        context,
        key,
        "length",
        "The response does not satisfy its validation rule."
      );
    }
  });
}

function isExpressionTrue(
  expression: SmartFormV2Expression | undefined,
  context: ValidationContext
) {
  if (!expression) {
    return false;
  }
  return Boolean(evaluateExpression(expression, context));
}

function evaluateExpression(
  expression: SmartFormV2Expression,
  context: ValidationContext
): unknown {
  switch (expression.op) {
    case "literal": {
      return expression.value;
    }
    case "value": {
      const value = resolveAnswerValue(
        context.response.fields[expression.fieldId],
        context.response.responseLocale,
        context.definition.i18n.defaultLocale,
        context.definition.i18n.fallbackLocales?.[
          context.response.responseLocale
        ]
      );
      return comparableValue(value);
    }
    case "eq": {
      return (
        JSON.stringify(evaluateExpression(expression.left, context)) ===
        JSON.stringify(evaluateExpression(expression.right, context))
      );
    }
    case "neq": {
      return (
        JSON.stringify(evaluateExpression(expression.left, context)) !==
        JSON.stringify(evaluateExpression(expression.right, context))
      );
    }
    case "and": {
      return expression.operands.every((operand) =>
        Boolean(evaluateExpression(operand, context))
      );
    }
    case "or": {
      return expression.operands.some((operand) =>
        Boolean(evaluateExpression(operand, context))
      );
    }
    case "not": {
      return !evaluateExpression(expression.operand, context);
    }
    case "isEmpty": {
      return isComparableEmpty(evaluateExpression(expression.operand, context));
    }

    default: {
      break;
    }
  }
}

function resolveAnswerValue(
  answer: SmartFormV2FieldAnswer | undefined,
  locale: string,
  fallbackLocale: string,
  fallbackLocales: string[] = []
) {
  if (!answer) {
    return;
  }
  if (answer.type !== "localized") {
    return answer;
  }
  for (const candidate of [locale, ...fallbackLocales, fallbackLocale]) {
    const value = answer.values[candidate];
    if (value) {
      return value;
    }
  }
}

function comparableValue(value: SmartFormV2FieldValue | undefined): unknown {
  if (!value) {
    return null;
  }
  switch (value.type) {
    case "choice": {
      return value.selectedOptionIds.length <= 1
        ? (value.selectedOptionIds[0] ?? null)
        : value.selectedOptionIds;
    }
    case "text": {
      return value.text;
    }
    case "richText": {
      return richTextPlainText(value.document.content);
    }
    case "attachment": {
      return value.attachments.map((item) => item.attachmentId);
    }
    case "reference": {
      return value.references.map(
        (item) => `${item.targetType}:${item.targetId}`
      );
    }
    case "date": {
      return value.value;
    }
    case "number": {
      return Number(value.decimal);
    }

    default: {
      break;
    }
  }
}

function isComparableEmpty(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function isEmptyFieldValue(value: SmartFormV2FieldValue | undefined) {
  if (!value) {
    return true;
  }
  switch (value.type) {
    case "choice": {
      return value.selectedOptionIds.length === 0;
    }
    case "text": {
      return value.text.trim().length === 0;
    }
    case "richText": {
      return richTextPlainText(value.document.content).trim().length === 0;
    }
    case "attachment": {
      return value.attachments.length === 0;
    }
    case "reference": {
      return value.references.length === 0;
    }
    case "date": {
      return value.value.length === 0;
    }
    case "number": {
      return value.decimal.length === 0;
    }

    default: {
      break;
    }
  }
}

function richTextMatchesProfile(
  blocks: SmartFormV2RichTextBlock[],
  profile: Extract<SmartFormV2FieldDefinition, { type: "richText" }>["profile"]
) {
  const visitInline = (inline: SmartFormV2RichTextInline) => {
    if (
      inline.type === "entityReference" &&
      !profile.allowedEntities.includes(inline.entityType)
    ) {
      return false;
    }
    return (
      inline.type !== "text" ||
      (inline.marks ?? []).every((mark) =>
        profile.allowedMarks.includes(mark.type)
      )
    );
  };
  const visitBlock = (block: SmartFormV2RichTextBlock): boolean => {
    if (!profile.allowedBlocks.includes(block.type)) {
      return false;
    }
    if (
      block.type === "embed" &&
      !profile.allowedEntities.includes(block.entityType)
    ) {
      return false;
    }
    if (block.type === "paragraph" || block.type === "heading") {
      return block.content.every(visitInline);
    }
    if (block.type === "bulletList" || block.type === "orderedList") {
      return block.items.every((item) => item.content.every(visitBlock));
    }
    if (block.type === "blockquote") {
      return block.content.every(visitBlock);
    }
    if (block.type === "table") {
      return block.rows.every((row) =>
        row.cells.every((cell) => cell.content.every(visitBlock))
      );
    }
    return true;
  };
  return blocks.every(visitBlock);
}

function richTextPlainText(blocks: SmartFormV2RichTextBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "paragraph" || block.type === "heading") {
        return block.content.map(inlinePlainText).join("");
      }
      if (block.type === "bulletList" || block.type === "orderedList") {
        return block.items
          .map((item) => richTextPlainText(item.content))
          .join("\n");
      }
      if (block.type === "blockquote") {
        return richTextPlainText(block.content);
      }
      if (block.type === "table") {
        return block.rows
          .map((row) =>
            row.cells.map((cell) => richTextPlainText(cell.content)).join("\t")
          )
          .join("\n");
      }
      return block.type === "embed" ? (block.labelSnapshot ?? "") : "";
    })
    .join("\n");
}

function inlinePlainText(inline: SmartFormV2RichTextInline) {
  if (inline.type === "text") {
    return inline.text;
  }
  if (inline.type === "hardBreak") {
    return "\n";
  }
  return inline.labelSnapshot ?? inline.entityId;
}

function flattenColumns(
  column: SmartFormV2SheetNode["columns"][number]
): SmartFormV2SheetLeafColumn[] {
  return column.kind === "column"
    ? [column]
    : column.children.flatMap(flattenColumns);
}

function flattenFixedRows(
  rows: SmartFormV2FixedSheetRow[]
): SmartFormV2FixedSheetRow[] {
  return rows.flatMap((row) => [
    row,
    ...(row.children ? flattenFixedRows(row.children) : []),
  ]);
}

function addIssue(
  context: ValidationContext,
  key: string,
  code: SmartFormV2ResponseValidationIssue["code"],
  message: string
) {
  context.issues.push({ key, code, message });
}

function compareDecimals(left: string, right: string) {
  const parse = (value: string) => {
    const negative = value.startsWith("-");
    const unsigned = negative ? value.slice(1) : value;
    const [integer = "0", fraction = ""] = unsigned.split(".");
    return { negative, integer, fraction };
  };
  const leftParts = parse(left);
  const rightParts = parse(right);
  const scale = Math.max(leftParts.fraction.length, rightParts.fraction.length);
  const toInteger = (parts: ReturnType<typeof parse>) => {
    const magnitude = BigInt(
      `${parts.integer}${parts.fraction.padEnd(scale, "0")}`
    );
    return parts.negative ? -magnitude : magnitude;
  };
  const leftInteger = toInteger(leftParts);
  const rightInteger = toInteger(rightParts);
  return leftInteger < rightInteger ? -1 : leftInteger > rightInteger ? 1 : 0;
}
