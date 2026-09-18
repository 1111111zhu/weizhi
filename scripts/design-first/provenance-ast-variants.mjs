import ts from "typescript";

import { literalText, sortStrings, staticName } from "./provenance-utils.mjs";

function objectEntries(node) {
  if (!node || !ts.isObjectLiteralExpression(node)) return [];
  return node.properties.flatMap((property) => {
    if (ts.isPropertyAssignment(property)) {
      const name = staticName(property.name);
      return name ? [{ name, value: property.initializer }] : [];
    }
    if (ts.isShorthandPropertyAssignment(property))
      return [{ name: property.name.text, value: property.name }];
    return [];
  });
}

function readVariantObject(node) {
  return objectEntries(node).flatMap((group) => {
    const values = objectEntries(group.value).map((entry) => entry.name);
    return values.length
      ? [{ name: group.name, values: sortStrings(values) }]
      : [];
  });
}

function dedupeVariants(values) {
  const map = new Map();
  for (const item of values) {
    const set = map.get(item.name) ?? new Set();
    item.values.forEach((value) => set.add(value));
    map.set(item.name, set);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, values]) => ({ name, values: sortStrings([...values]) }));
}

function unionValues(type) {
  if (!type || type.kind !== ts.SyntaxKind.UnionType) return [];
  return type.types.map(literalText).filter((value) => value !== null);
}

function callVariants(node) {
  if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression))
    return [];
  if (!/cva|variant/i.test(node.expression.text)) return [];
  const options = node.arguments.find((argument) =>
    ts.isObjectLiteralExpression(argument)
  );
  const property = objectEntries(options).find(
    (entry) => entry.name === "variants"
  );
  return property ? readVariantObject(property.value) : [];
}

function declarationVariants(node) {
  if (!ts.isVariableDeclaration(node) || !node.initializer) return [];
  return /variant/i.test(node.name.getText())
    ? readVariantObject(node.initializer)
    : [];
}

function typeVariants(node) {
  if (!ts.isTypeAliasDeclaration(node)) return [];
  const values = unionValues(node.type);
  return values.length
    ? [{ name: node.name.text, values: sortStrings(values) }]
    : [];
}

function propertyVariants(node) {
  if (!ts.isPropertySignature(node) && !ts.isPropertyDeclaration(node))
    return [];
  const values = unionValues(node.type);
  const name = staticName(node.name);
  return name && values.length ? [{ name, values: sortStrings(values) }] : [];
}

function variantsForNode(node) {
  return [
    ...callVariants(node),
    ...declarationVariants(node),
    ...typeVariants(node),
    ...propertyVariants(node),
  ];
}

export function collectVariants(sourceFile) {
  const values = [];
  function visit(node) {
    values.push(...variantsForNode(node));
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return dedupeVariants(values);
}
