import ts from "typescript";

import { createFinding, lineAt, lineNumberAt } from "./boundary-finding.mjs";
import {
  normalizePath,
  shouldScanPath,
  shouldScanUiWrapperImports,
} from "./boundary-path-policy.mjs";
import { isDataDrivenRenderingStyle } from "./dynamic-rendering-styles.mjs";

export const RESTRICTED_UI_IMPORTS = [
  "@/components/ui/native-select",
  "@base-ui/react",
  "@base-ui/react/",
  "radix-ui",
  "radix-ui/",
  "@radix-ui/",
  "@mui/",
  "@chakra-ui/",
  "@headlessui/",
  "@heroicons/",
  "antd",
  "antd/",
  "react-icons",
  "react-icons/",
];

export const RESTRICTED_UI_DEPENDENCIES = [
  "radix-ui",
  "@radix-ui/",
  "@mui/",
  "@chakra-ui/",
  "@headlessui/",
  "@heroicons/",
  "antd",
  "react-icons",
];

const INLINE_STYLE_PATTERN = /\bstyle\s*=/g;
const RAW_HEX_COLOR_PATTERN = /#[0-9a-fA-F]{3,8}\b/g;
const NATIVE_CONTROL_RULE = "native-control";
const NATIVE_CONTROL_ELEMENTS = new Set([
  "button",
  "input",
  "select",
  "textarea",
]);
const CONFIRMATION_EDITABLE_OVERLAY_FILE =
  "apps/emp/src/components/confirmations/project-confirmation-editor.tsx";
const CONFIRMATION_EDITABLE_OVERLAY_COMPONENTS = new Set([
  "ConfirmationTemplateDesignOverlay",
  "StandardFinancialInstitutionPageOneFields",
  "SecuritiesConfirmationPageOneFields",
]);
const DYNAMIC_GEOMETRY_IDENTIFIERS = new Set(["geometry", "coverGeometry"]);
const DYNAMIC_GEOMETRY_KEYS = new Set([
  "left",
  "top",
  "width",
  "height",
  "transform",
]);
const IMPORT_SOURCE_PATTERN =
  /\b(?:import|export)\b(?:[\s\S]*?\bfrom\s*)?["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

function getStaticPropertyName(node) {
  if (!node?.name) {
    return null;
  }
  if (
    ts.isIdentifier(node.name) ||
    ts.isStringLiteral(node.name) ||
    ts.isNumericLiteral(node.name)
  ) {
    return node.name.text;
  }
  return null;
}

function isDynamicGeometryIdentifier(node) {
  return ts.isIdentifier(node) && DYNAMIC_GEOMETRY_IDENTIFIERS.has(node.text);
}

function isAllowedNullishGeometryExpression(expression) {
  if (!ts.isBinaryExpression(expression)) {
    return false;
  }
  if (expression.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken) {
    return false;
  }
  return (
    isDynamicGeometryIdentifier(expression.left) &&
    ts.isIdentifier(expression.right) &&
    expression.right.text === "undefined"
  );
}

function inspectGeometryProperty(property) {
  if (ts.isSpreadAssignment(property)) {
    return {
      allowed: isDynamicGeometryIdentifier(property.expression),
      geometrySource: true,
    };
  }
  const isProperty =
    ts.isPropertyAssignment(property) ||
    ts.isShorthandPropertyAssignment(property);
  return {
    allowed:
      isProperty && DYNAMIC_GEOMETRY_KEYS.has(getStaticPropertyName(property)),
    geometrySource: false,
  };
}

function isAllowedGeometryObject(expression) {
  if (!ts.isObjectLiteralExpression(expression)) {
    return false;
  }
  let hasGeometrySource = false;
  for (const property of expression.properties) {
    const result = inspectGeometryProperty(property);
    if (!result.allowed) {
      return false;
    }
    hasGeometrySource ||= result.geometrySource;
  }
  return hasGeometrySource;
}

function isAllowedDynamicGeometryExpression(expression) {
  if (!expression) {
    return false;
  }
  if (ts.isParenthesizedExpression(expression)) {
    return isAllowedDynamicGeometryExpression(expression.expression);
  }
  if (ts.isIdentifier(expression)) {
    return isDynamicGeometryIdentifier(expression);
  }
  if (isAllowedNullishGeometryExpression(expression)) {
    return true;
  }
  return isAllowedGeometryObject(expression);
}

function collectAllowedDynamicGeometryStyleStarts(file, source) {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const allowedStyleStarts = new Set();

  function visit(node, componentName = null) {
    const nextComponentName =
      ts.isFunctionDeclaration(node) && node.name
        ? node.name.text
        : componentName;
    const isAllowedStyle =
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "style" &&
      ts.isJsxExpression(node.initializer) &&
      ((file === CONFIRMATION_EDITABLE_OVERLAY_FILE &&
        CONFIRMATION_EDITABLE_OVERLAY_COMPONENTS.has(nextComponentName) &&
        isAllowedDynamicGeometryExpression(node.initializer.expression)) ||
        isDataDrivenRenderingStyle(
          file,
          nextComponentName,
          node.initializer.expression
        ));
    if (isAllowedStyle) {
      allowedStyleStarts.add(node.name.getStart(sourceFile));
    }
    ts.forEachChild(node, (child) => visit(child, nextComponentName));
  }

  visit(sourceFile);
  return allowedStyleStarts;
}

function collectInlineStyleFindings(file, source) {
  const allowedStyleStarts = collectAllowedDynamicGeometryStyleStarts(
    file,
    source
  );
  const matchedLines = new Set();
  const findings = [];

  for (const match of source.matchAll(INLINE_STYLE_PATTERN)) {
    if (allowedStyleStarts.has(match.index)) {
      continue;
    }
    const line = lineNumberAt(source, match.index);
    if (matchedLines.has(line)) {
      continue;
    }
    matchedLines.add(line);
    findings.push(
      createFinding({
        file,
        rule: "no-restricted-syntax",
        lineNumber: line,
        line: lineAt(source, match.index),
      })
    );
  }
  return findings;
}

function collectLinePatternFindings({ file, source, pattern, rule }) {
  const matchedLines = new Set();
  const findings = [];
  for (const match of source.matchAll(pattern)) {
    const line = lineNumberAt(source, match.index);
    if (matchedLines.has(line)) {
      continue;
    }
    matchedLines.add(line);
    findings.push(
      createFinding({
        file,
        rule,
        lineNumber: line,
        line: lineAt(source, match.index),
      })
    );
  }
  return findings;
}

function isRestrictedDependency(packageName) {
  return RESTRICTED_UI_DEPENDENCIES.some(
    (restrictedPackage) =>
      packageName === restrictedPackage ||
      packageName.startsWith(restrictedPackage)
  );
}

function isRestrictedImport(source) {
  return RESTRICTED_UI_IMPORTS.some(
    (restrictedSource) =>
      source === restrictedSource || source.startsWith(restrictedSource)
  );
}

function isAllowedWrapperImport(source) {
  return source === "@base-ui/react" || source.startsWith("@base-ui/react/");
}

function collectRestrictedImportFindings(file, source, allowBaseUi = false) {
  const findings = [];
  for (const match of source.matchAll(IMPORT_SOURCE_PATTERN)) {
    const importSource = match[1] ?? match[2];
    if (!importSource || !isRestrictedImport(importSource)) {
      continue;
    }
    if (allowBaseUi && isAllowedWrapperImport(importSource)) {
      continue;
    }
    findings.push(
      createFinding({
        file,
        rule: "no-restricted-imports",
        lineNumber: lineNumberAt(source, match.index),
        line: lineAt(source, match.index),
      })
    );
  }
  return findings;
}

export function analyzeSourceFile(filePath, source) {
  const file = normalizePath(filePath);
  if (!shouldScanPath(file)) {
    return [];
  }
  const findings = collectRestrictedImportFindings(file, source);
  findings.push(
    ...collectInlineStyleFindings(file, source),
    ...collectLinePatternFindings({
      file,
      source,
      pattern: RAW_HEX_COLOR_PATTERN,
      rule: "no-restricted-syntax",
    })
  );
  return findings;
}

export function analyzeUiWrapperImports(filePath, source) {
  const file = normalizePath(filePath);
  return shouldScanUiWrapperImports(file)
    ? collectRestrictedImportFindings(file, source, true)
    : [];
}

export function analyzeNativeControls(filePath, source) {
  const file = normalizePath(filePath);
  if (!shouldScanPath(file)) {
    return [];
  }
  return [...source.matchAll(/<\s*(button|input|select|textarea)(?=[\s/>])/g)]
    .filter((match) => NATIVE_CONTROL_ELEMENTS.has(match[1]))
    .map((match) =>
      createFinding({
        file,
        rule: NATIVE_CONTROL_RULE,
        lineNumber: lineNumberAt(source, match.index),
        line: `Use the shadcn/ui wrapper instead of native <${match[1]}>.`,
      })
    );
}

export function analyzePackageFile(filePath, manifest) {
  const file = normalizePath(filePath);
  const dependencies = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.peerDependencies,
  };
  return Object.keys(dependencies)
    .filter(isRestrictedDependency)
    .sort()
    .map((dependency) =>
      createFinding({
        file,
        rule: "restricted-ui-dependency",
        lineNumber: 1,
        line: dependency,
      })
    );
}
