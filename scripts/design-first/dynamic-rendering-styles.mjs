import ts from "typescript";

// Document-authored typography and measured geometry are data, not app-theme overrides.
// Keep this classification tied to the actual rendering adapters and semantic sources.
const DOCUMENT_RENDERERS = new Set([
  "apps/emp/src/components/confirmations/confirmation-template-workbench.tsx",
  "apps/emp/src/components/confirmations/project-confirmation-editor.tsx",
]);
const DOCUMENT_VALUES = new Set([
  "geometry",
  "coverGeometry",
  "textStyle",
  "flexAlignmentStyle",
]);
const DOCUMENT_FUNCTIONS = new Set([
  "getConfirmationTemplateFieldTextStyleCss",
  "getConfirmationTemplateFlexAlignmentCss",
]);
const RECT_KEYS = new Set(["left", "top", "width", "height"]);

function unwrap(expression) {
  let node = expression;
  while (
    node &&
    (ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node))
  ) {
    node = node.expression;
  }
  return node;
}

function propertyName(node) {
  return node.name &&
    (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
    ? node.name.text
    : null;
}

function refersTo(node, names) {
  if (ts.isIdentifier(node) && names.has(node.text)) {
    return true;
  }
  let found = false;
  ts.forEachChild(node, (child) => {
    found ||= refersTo(child, names);
  });
  return found;
}

function documentValue(node) {
  const value = unwrap(node);
  return (
    value &&
    ((ts.isIdentifier(value) && DOCUMENT_VALUES.has(value.text)) ||
      (ts.isCallExpression(value) &&
        ts.isIdentifier(value.expression) &&
        DOCUMENT_FUNCTIONS.has(value.expression.text)))
  );
}

function documentObject(node) {
  let hasDocumentData = false;
  const valid = node.properties.every((property) => {
    if (ts.isSpreadAssignment(property)) {
      const allowed = documentValue(property.expression);
      hasDocumentData ||= allowed;
      return allowed;
    }
    if (!ts.isPropertyAssignment(property)) {
      return false;
    }
    const name = propertyName(property);
    const value = property.initializer;
    if (
      RECT_KEYS.has(name) &&
      ts.isTemplateExpression(value) &&
      refersTo(value, new Set(["field", "pageDrawingRect"]))
    ) {
      hasDocumentData = true;
      return true;
    }
    if (
      ["color", "backgroundColor"].includes(name) &&
      refersTo(value, new Set(["selectionTextStyle"]))
    ) {
      hasDocumentData = true;
      return true;
    }
    // Layout-neutral constraints are allowed only alongside document data.
    return (
      ts.isStringLiteral(value) &&
      ((name === "height" && value.text === "100%") ||
        (name === "lineHeight" && value.text === "normal"))
    );
  });
  return valid && hasDocumentData;
}

export function isDataDrivenRenderingStyle(file, componentName, expression) {
  const value = unwrap(expression);
  if (!value) {
    return false;
  }
  if (DOCUMENT_RENDERERS.has(file)) {
    if (documentValue(value)) {
      return true;
    }
    if (ts.isObjectLiteralExpression(value) && documentObject(value)) {
      return true;
    }
    if (
      file.endsWith("project-confirmation-editor.tsx") &&
      componentName === "LinkedTemplateFieldInput" &&
      ts.isIdentifier(value) &&
      ["style", "popupPosition"].includes(value.text)
    ) {
      return true;
    }
  }
  if (
    file ===
      "apps/emp/src/components/confirmations/confirmation-date-field.tsx" &&
    componentName === "ConfirmationDateField"
  ) {
    if (ts.isIdentifier(value) && value.text === "style") {
      return true;
    }
    if (ts.isObjectLiteralExpression(value) && value.properties.length === 2) {
      return value.properties.every((property) =>
        ts.isSpreadAssignment(property)
          ? ts.isIdentifier(property.expression) &&
            property.expression.text === "style"
          : ts.isPropertyAssignment(property) &&
            propertyName(property) === "height" &&
            ts.isStringLiteral(property.initializer) &&
            property.initializer.text === "100%"
      );
    }
  }
  const metrics = {
    "apps/emp/src/components/confirmations/confirmation-response-warehouse.tsx":
      ["minHeight", "minimumContentHeight"],
    "apps/emp/src/components/project-confirmations-panel.tsx": [
      "width",
      "categoryNavigationWidth",
    ],
    "apps/cmp/src/components/cmp-billing-page.tsx": ["flexGrow", "group"],
  };
  const metric = metrics[file];
  if (
    metric &&
    ts.isObjectLiteralExpression(value) &&
    value.properties.length === 1
  ) {
    const [property] = value.properties;
    if (
      ts.isPropertyAssignment(property) &&
      propertyName(property) === metric[0] &&
      refersTo(property.initializer, new Set([metric[1]]))
    ) {
      return true;
    }
    return (
      file.endsWith("cmp-billing-page.tsx") &&
      ts.isPropertyAssignment(property) &&
      propertyName(property) === "--cmp-billing-donut-offset" &&
      refersTo(property.initializer, new Set(["visualPercent"]))
    );
  }
  return false;
}
