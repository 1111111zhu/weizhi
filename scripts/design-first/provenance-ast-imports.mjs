import ts from "typescript";

import { exportNames } from "./provenance-ast-exports.mjs";
import { lineOf, literalText, sortStrings } from "./provenance-utils.mjs";

function importSpecifiers(clause) {
  if (!clause) return [];
  const values = clause.name ? [`default:${clause.name.text}`] : [];
  if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings))
    values.push(`*:${clause.namedBindings.name.text}`);
  if (clause.namedBindings && ts.isNamedImports(clause.namedBindings))
    values.push(
      ...clause.namedBindings.elements.map((item) =>
        item.propertyName
          ? `${item.propertyName.text} as ${item.name.text}`
          : item.name.text
      )
    );
  return sortStrings(values);
}

function addImport(
  imports,
  sourceFile,
  { source, node, kind, specifiers = [] }
) {
  if (source)
    imports.push({
      source,
      line: lineOf(sourceFile, node.getStart(sourceFile)),
      kind,
      specifiers: sortStrings(specifiers),
    });
}

function collectStatementImports(sourceFile, imports) {
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement))
      addImport(imports, sourceFile, {
        source: literalText(statement.moduleSpecifier),
        node: statement,
        kind: "import",
        specifiers: importSpecifiers(statement.importClause),
      });
    else if (ts.isExportDeclaration(statement))
      addImport(imports, sourceFile, {
        source: literalText(statement.moduleSpecifier),
        node: statement,
        kind: "re-export",
        specifiers: exportNames(statement),
      });
  }
}

function collectDynamicImports(sourceFile, imports) {
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      ts.isIdentifier(node.expression)
    ) {
      const source = literalText(node.arguments[0]);
      if (source && node.expression.text === "require")
        addImport(imports, sourceFile, { source, node, kind: "require" });
    }
    if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const source = literalText(node.arguments[0]);
      if (source)
        addImport(imports, sourceFile, {
          source,
          node,
          kind: "dynamic-import",
        });
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

export function collectImports(sourceFile) {
  const imports = [];
  collectStatementImports(sourceFile, imports);
  collectDynamicImports(sourceFile, imports);
  return imports;
}
