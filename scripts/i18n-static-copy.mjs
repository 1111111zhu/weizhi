import { createHash } from "node:crypto";

import ts from "typescript";

const FRONTEND_APPS = ["emp", "cmp", "tms", "ib", "intranet"];
const SOURCE_EXTENSIONS = [".ts", ".tsx"];
const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx)$/;
// Synthetic response records (client names, addresses and task descriptions) are
// business fixture data, not translatable control copy. Do not exclude real API adapters.
const BUSINESS_FIXTURE_PROVIDERS = new Set([
  "apps/emp/src/api/mock-api.ts",
  "apps/emp/src/api/mock-data.ts",
]);
const USER_VISIBLE_PROPERTIES = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "description",
  "label",
  "placeholder",
  "title",
]);

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function isProductSource(filePath) {
  const file = normalizePath(filePath);
  return (
    FRONTEND_APPS.some((app) => file.startsWith(`apps/${app}/src/`)) &&
    SOURCE_EXTENSIONS.some((extension) => file.endsWith(extension)) &&
    !file.endsWith(".d.ts") &&
    !TEST_FILE_PATTERN.test(file) &&
    !BUSINESS_FIXTURE_PROVIDERS.has(file) &&
    !file.includes("/src/i18n/")
  );
}

function getSourceFile(file, source) {
  return ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
}

function getStringLiteral(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}

function getStaticString(node, constants) {
  const literal = getStringLiteral(node);
  if (literal !== null) {
    return literal;
  }
  if (ts.isParenthesizedExpression(node)) {
    return getStaticString(node.expression, constants);
  }
  if (ts.isIdentifier(node)) {
    return constants.get(node.text) ?? null;
  }
  return null;
}

function getPropertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) {
    return node.text;
  }
  return null;
}

function collectStaticConstants(sourceFile) {
  const constants = new Map();

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const value = getStringLiteral(node.initializer);
      if (value !== null) {
        constants.set(node.name.text, value);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return constants;
}

function createFinding(file, sourceFile, node, value, kind) {
  const copy = value.trim().replaceAll(/\s+/g, " ");
  const fingerprint = createHash("sha256")
    .update(`${file}\u0000${kind}\u0000${copy}`)
    .digest("hex");
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  const lineStart = sourceFile.getPositionOfLineAndCharacter(line, 0);
  const lineEnd = sourceFile.text.indexOf("\n", lineStart);

  return {
    file,
    fingerprint,
    rule: "i18n-static-copy",
    line: line + 1,
    copy,
    snippet: sourceFile.text
      .slice(lineStart, lineEnd === -1 ? undefined : lineEnd)
      .trim(),
  };
}

function isUserVisible(value) {
  return /\p{L}/u.test(value);
}

export function analyzeI18nStaticCopy(filePath, source) {
  const file = normalizePath(filePath);
  if (!isProductSource(file)) {
    return [];
  }

  const sourceFile = getSourceFile(file, source);
  const constants = collectStaticConstants(sourceFile);
  const findings = [];

  function add(node, value, kind) {
    if (value && isUserVisible(value)) {
      findings.push(createFinding(file, sourceFile, node, value, kind));
    }
  }

  function visit(node) {
    if (ts.isJsxText(node)) {
      add(node, node.text, "text");
    }

    if (ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent)) {
      add(
        node,
        node.expression && getStaticString(node.expression, constants),
        "expression"
      );
    }

    if (ts.isJsxAttribute(node)) {
      const name = node.name.text;
      if (USER_VISIBLE_PROPERTIES.has(name) && node.initializer) {
        const value = ts.isJsxExpression(node.initializer)
          ? node.initializer.expression &&
            getStaticString(node.initializer.expression, constants)
          : getStringLiteral(node.initializer);
        add(node, value, `attribute:${name}`);
      }
    }

    if (ts.isPropertyAssignment(node)) {
      const name = getPropertyName(node.name);
      if (name && USER_VISIBLE_PROPERTIES.has(name)) {
        add(
          node,
          getStaticString(node.initializer, constants),
          `property:${name}`
        );
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

export function createI18nStaticCopyBaseline(findings) {
  const files = {};

  for (const finding of findings) {
    files[finding.file] ??= {};
    files[finding.file][finding.fingerprint] =
      (files[finding.file][finding.fingerprint] ?? 0) + 1;
  }

  return {
    version: 1,
    files: Object.fromEntries(
      Object.entries(files)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([file, fingerprints]) => [
          file,
          Object.fromEntries(Object.entries(fingerprints).sort()),
        ])
    ),
  };
}

export function diffI18nStaticCopyAgainstBaseline(findings, baseline) {
  const current = createI18nStaticCopyBaseline(findings);
  const failures = [];

  for (const [file, fingerprints] of Object.entries(current.files)) {
    for (const [fingerprint, count] of Object.entries(fingerprints)) {
      const allowed = baseline.files?.[file]?.[fingerprint] ?? 0;
      if (count > allowed) {
        failures.push({ allowed, count, file, rule: "i18n-static-copy" });
      }
    }
  }

  return failures;
}
