import ts from "typescript";

import {
  isPascalCase,
  literalText,
  sortBy,
  sortStrings,
  staticName,
} from "./provenance-utils.mjs";

export function exportNames(statement) {
  if (statement.exportClause && ts.isNamespaceExport(statement.exportClause))
    return [`* as ${statement.exportClause.name.text}`];
  if (statement.exportClause && ts.isNamedExports(statement.exportClause))
    return sortStrings(
      statement.exportClause.elements.map((element) => element.name.text)
    );
  return ["*"];
}

function localComponentNames(statement) {
  if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
    return isPascalCase(statement.name?.text) ? [statement.name.text] : [];
  }
  if (!ts.isVariableStatement(statement)) return [];
  return statement.declarationList.declarations
    .map((declaration) => staticName(declaration.name))
    .filter(isPascalCase);
}

function collectLocalComponents(sourceFile) {
  return new Set(sourceFile.statements.flatMap(localComponentNames));
}

function addExport(state, name, component = false) {
  if (!name) return;
  state.names.add(name);
  if (component && isPascalCase(name)) state.componentNames.add(name);
}

function isExported(statement) {
  return statement.modifiers?.some(
    (item) => item.kind === ts.SyntaxKind.ExportKeyword
  );
}

function collectReexport(statement, state) {
  const source = literalText(statement.moduleSpecifier);
  if (source) {
    const names = exportNames(statement);
    state.reexports.push({ source, names });
    for (const name of names) {
      if (name !== "*" && !name.startsWith("* as ")) addExport(state, name);
    }
    return;
  }
  for (const element of statement.exportClause?.elements ?? []) {
    addExport(
      state,
      element.name.text,
      state.localComponents.has(element.propertyName?.text ?? element.name.text)
    );
  }
}

function collectDeclarationExport(statement, state, shouldExport) {
  const isDeclaration =
    ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement);
  if (isDeclaration && shouldExport) {
    addExport(state, statement.name?.text, true);
  }
}

function collectVariableExports(statement, state, exported) {
  if (!ts.isVariableStatement(statement) || !exported) return;
  for (const declaration of statement.declarationList.declarations) {
    addExport(state, staticName(declaration.name), true);
  }
}

function collectTypeExport(statement, state, exported) {
  if (!exported) return;
  const isTypeDeclaration =
    ts.isTypeAliasDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isEnumDeclaration(statement);
  if (isTypeDeclaration) addExport(state, statement.name.text);
}

function collectAssignmentExport(statement, state) {
  if (!ts.isExportAssignment(statement) || statement.isExportEquals) return;
  if (!ts.isIdentifier(statement.expression)) return;
  addExport(
    state,
    statement.expression.text,
    state.localComponents.has(statement.expression.text)
  );
}

function collectStatementExport(statement, state) {
  const exported = isExported(statement);
  const defaultExport = statement.modifiers?.some(
    (item) => item.kind === ts.SyntaxKind.DefaultKeyword
  );
  collectDeclarationExport(statement, state, exported || defaultExport);
  collectVariableExports(statement, state, exported);
  collectTypeExport(statement, state, exported);
  if (ts.isExportDeclaration(statement)) collectReexport(statement, state);
  collectAssignmentExport(statement, state);
}

export function collectExports(sourceFile) {
  const state = {
    names: new Set(),
    componentNames: new Set(),
    reexports: [],
    localComponents: collectLocalComponents(sourceFile),
  };
  for (const statement of sourceFile.statements) {
    collectStatementExport(statement, state);
  }
  return {
    names: sortStrings([...state.names]),
    componentNames: sortStrings([...state.componentNames]),
    reexports: sortBy(state.reexports, "source"),
  };
}
