import ts from "typescript";

import { sortStrings } from "./provenance-utils.mjs";

function collectClassValues(sourceFile) {
  const values = new Set();
  function add(value) {
    if (!value || (!/\s/.test(value) && !value.includes("-"))) return;
    value
      .split(/\s+/)
      .filter((token) => /^[A-Za-z0-9_:/.[\]-]+$/.test(token))
      .forEach((token) => values.add(token));
  }
  function expression(node) {
    if (ts.isStringLiteralLike(node)) add(node.text);
    if (ts.isTemplateExpression(node)) add(node.head.text);
    ts.forEachChild(node, expression);
  }
  function visit(node) {
    if (
      ts.isJsxAttribute(node) &&
      node.name.text === "className" &&
      node.initializer
    ) {
      if (ts.isStringLiteral(node.initializer)) add(node.initializer.text);
      if (ts.isJsxExpression(node.initializer) && node.initializer.expression)
        expression(node.initializer.expression);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      /^(cn|clsx|cva|classNames)$/.test(node.expression.text)
    )
      node.arguments.forEach(expression);
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return values;
}

export function collectClassTokens(sourceFile) {
  return sortStrings([...collectClassValues(sourceFile)]);
}
