#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import ts from "typescript";

const TEST_FILE_PATTERN = /(?:^|[.-])(?:test|spec)\.(?:[cm]?[jt]sx?)$/;
const PRESENTATION_MATCHERS = new Set([
  "toBe",
  "toBeNull",
  "toContain",
  "toEqual",
  "toHaveAttribute",
  "toHaveClass",
  "toHaveStyle",
  "toHaveTextContent",
  "toMatchInlineSnapshot",
  "toMatchSnapshot",
  "toStrictEqual",
]);
const DIRECT_PRESENTATION_MATCHERS = new Set([
  "toHaveClass",
  "toHaveStyle",
  "toHaveTextContent",
]);
const SNAPSHOT_MATCHERS = new Set(["toMatchInlineSnapshot", "toMatchSnapshot"]);
const PRESENTATION_CONTEXT =
  /copy|i18n|locale|translation|label|title|text|layout|style|class|color|theme|font|width|height|spacing|sidebar|header|tooltip|panel|dialog|button|badge|avatar|render|visible|show|hide|display/i;
const PRESENTATION_VALUE =
  /(?:["'`](?:bg-|text-|border-|flex|grid|px-|py-|gap-|w-|h-|min-|max-|rounded|shadow|hidden|block|inline|fixed|absolute)|#[0-9a-f]{3,8}\b|\b(?:px|rem|vh|vw)\b)/i;
const PROTECTIVE_CONTEXT =
  /auth|permission|access|schema|contract|storage|workflow|api|service|controller|prisma|database|mail|security|encrypt|role|audit-log|route|proxy|server|endpoint|request|response|\burl\b|download|upload/i;

function scriptKind(filePath) {
  if (filePath.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }
  if (filePath.endsWith(".jsx")) {
    return ts.ScriptKind.JSX;
  }
  if (/\.[cm]?js$/.test(filePath)) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

function calleeSegments(expression) {
  if (ts.isIdentifier(expression)) {
    return [expression.text];
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return [...calleeSegments(expression.expression), expression.name.text];
  }
  if (ts.isCallExpression(expression)) {
    return calleeSegments(expression.expression);
  }
  return [];
}

function callbackFrom(call) {
  return [...call.arguments]
    .toReversed()
    .find(
      (argument) =>
        ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)
    );
}

function titleFrom(node, sourceFile) {
  return node?.getText(sourceFile) ?? "[dynamic title]";
}

function findExpectCall(expression) {
  if (
    ts.isCallExpression(expression) &&
    calleeSegments(expression.expression)[0] === "expect"
  ) {
    return expression;
  }
  if (
    ts.isPropertyAccessExpression(expression) ||
    ts.isCallExpression(expression)
  ) {
    return findExpectCall(expression.expression);
  }
  return null;
}

function expectedKind(node) {
  if (!node || node.kind === ts.SyntaxKind.NullKeyword) {
    return "null";
  }
  if (
    ts.isStringLiteralLike(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)
  ) {
    return "string";
  }
  if (ts.isNumericLiteral(node)) {
    return "number";
  }
  if (
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return "boolean";
  }
  return "expression";
}

function hasInteraction(callback, helperInteractions) {
  let interacted = false;
  const renderCounts = new Map();
  const visit = (node) => {
    if (ts.isTryStatement(node)) {
      visit(node.tryBlock);
      if (node.catchClause) {
        visit(node.catchClause);
      }
      // Cleanup alone is not an interaction or a lifecycle assertion.
      return;
    }
    if (ts.isCallExpression(node)) {
      const segments = calleeSegments(node.expression);
      if (segments.at(-1) === "render") {
        const owner = segments.join(".");
        const count = (renderCounts.get(owner) ?? 0) + 1;
        renderCounts.set(owner, count);
        if (count > 1) {
          interacted = true;
        }
      }
      if (helperInteractions.get(segments[0])) {
        interacted = true;
      }
      if (
        segments[0] === "fireEvent" ||
        segments[0] === "userEvent" ||
        segments[0] === "user" ||
        segments.some((segment) =>
          /^(click|type|selectOptions|upload|focus|blur|dispatchEvent|rerender|unmount|setFocused|advanceTimersByTime|advanceTimersByTimeAsync|runOnlyPendingTimers|runOnlyPendingTimersAsync)$/.test(
            segment
          )
        )
      ) {
        interacted = true;
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(callback, visit);
  return interacted;
}

function helperInteractionMap(sourceFile) {
  const helpers = new Map();
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      helpers.set(
        statement.name.text,
        hasInteraction(statement.body, new Map())
      );
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
          continue;
        }
        if (
          ts.isArrowFunction(declaration.initializer) ||
          ts.isFunctionExpression(declaration.initializer)
        ) {
          helpers.set(
            declaration.name.text,
            hasInteraction(declaration.initializer.body, new Map())
          );
        }
      }
    }
  }
  return helpers;
}

function presentationBindings(callback) {
  const bindings = new Set();
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const source = node.initializer.getText();
      if (
        /\b(?:renderToStaticMarkup|renderToString|getComputedStyle)\s*\(|\.(?:className|classList|textContent|innerText|innerHTML)\b/.test(
          source
        )
      ) {
        bindings.add(node.name.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(callback, visit);
  return bindings;
}

function isUnsafeMarkupRejection(actual, code, callbackSource) {
  return (
    /\.querySelector\(\s*["'](?:script|iframe|object|embed|a)["']\s*\)/.test(
      actual
    ) &&
    /\.toBeNull\(\)/.test(code) &&
    /<script\b|\bjavascript:|\bdata:text\/html|\bonerror\s*=/.test(
      callbackSource
    )
  );
}

function reasonFor(
  filePath,
  title,
  interacted,
  matcher,
  actual,
  expected,
  kind,
  code,
  bindings,
  callbackSource
) {
  const context = `${filePath} ${title}`;
  if (PROTECTIVE_CONTEXT.test(context) || interacted) {
    return null;
  }
  if (isUnsafeMarkupRejection(actual, code, callbackSource)) {
    return null;
  }
  if (
    matcher === "toHaveAttribute" &&
    /aria-|role|data-testid|\btype\b/i.test(code)
  ) {
    return null;
  }
  if (
    /\.getAttribute\(\s*["'](?:aria-[\w-]+|role|alt|href|type)["']/.test(actual)
  ) {
    return null;
  }
  if (
    /\.tagName\b/.test(actual) &&
    /^["'](?:STRONG|EM|UL|OL|LI|A|BUTTON|INPUT|SELECT|TEXTAREA|TIME|IMG)["']$/.test(
      expected
    )
  ) {
    return null;
  }
  const candidate =
    /className|classList|style\.|getComputedStyle|textContent|innerText|innerHTML|queryBy|querySelector|screen\.|width|height|spacing|opacity|class|style/i.test(
      actual
    ) ||
    (kind === "string" &&
      (PRESENTATION_CONTEXT.test(`${context} ${actual}`) ||
        PRESENTATION_VALUE.test(expected)));
  if (!candidate) {
    return null;
  }
  const directlyVisual =
    /className|classList|style\.|getComputedStyle|textContent|innerText|innerHTML|queryBy|querySelector|screen\./i.test(
      actual
    ) || /\.(?:width|height|spacing|opacity|className|style)\b/.test(actual);
  const binding = actual.match(/^([\w$]+)/)?.[1];
  const presentationContext =
    DIRECT_PRESENTATION_MATCHERS.has(matcher) ||
    bindings.has(binding) ||
    /^(?:[\w$]*(?:[Cc]opy|[Cc]lasses|[Ss]tyles|[Vv]ariants))\b/.test(actual) ||
    PRESENTATION_VALUE.test(expected);
  // Refine the existing candidate set rather than adding unrelated findings.
  // A filename or suite mentioning "copy", "showroom" or "header" is not
  // evidence of a visual assertion: it may protect bytes, routing or storage.
  if (!directlyVisual && !presentationContext) {
    return null;
  }
  if (DIRECT_PRESENTATION_MATCHERS.has(matcher)) {
    return "把具体展示实现写死";
  }
  if (SNAPSHOT_MATCHERS.has(matcher) && presentationContext) {
    return "快照会把整块展示实现固定下来";
  }
  if (matcher === "toHaveAttribute" && /class|style/i.test(code)) {
    return "把具体展示属性写死";
  }
  if (
    matcher === "toBeNull" &&
    /queryBy|querySelector|screen\./i.test(actual)
  ) {
    return "用元素缺失表达可见性或展示状态";
  }
  if (kind === "string") {
    return "把文案、样式或展示字符串写死";
  }
  if (kind === "number" || kind === "boolean") {
    return "把布局尺寸或展示状态写死";
  }
  return null;
}

function findingsForTest(
  filePath,
  sourceFile,
  testCall,
  title,
  helperInteractions
) {
  const callback = callbackFrom(testCall);
  if (!callback) {
    return [];
  }
  const interacted = hasInteraction(callback, helperInteractions);
  const bindings = presentationBindings(callback);
  const findings = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const matcher = node.expression.name.text;
      if (!PRESENTATION_MATCHERS.has(matcher)) {
        return ts.forEachChild(node, visit);
      }
      const expectCall = findExpectCall(node.expression.expression);
      if (expectCall) {
        const actual =
          expectCall.arguments[0]?.getText(sourceFile) ?? "[missing actual]";
        const [expectedNode] = node.arguments;
        const code = node.getText(sourceFile).replaceAll(/\s+/g, " ");
        const reason = reasonFor(
          filePath,
          title,
          interacted,
          matcher,
          actual,
          expectedNode?.getText(sourceFile) ?? "null",
          expectedKind(expectedNode),
          code,
          bindings,
          callback.getText(sourceFile)
        );
        if (reason) {
          findings.push({
            code,
            filePath,
            line:
              sourceFile.getLineAndCharacterOfPosition(node.getStart()).line +
              1,
            reason,
            title,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(callback, visit);
  return findings;
}

export function findVolatileTestAssertions(filePath, source) {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(filePath)
  );
  const findings = [];
  const helperInteractions = helperInteractionMap(sourceFile);
  const walk = (node, suites = []) => {
    if (ts.isCallExpression(node)) {
      const [base] = calleeSegments(node.expression);
      const callback = callbackFrom(node);
      if (base === "describe" || base === "suite") {
        if (callback && ts.isBlock(callback.body)) {
          const title = titleFrom(node.arguments[0], sourceFile);
          ts.forEachChild(callback.body, (child) =>
            walk(child, [...suites, title])
          );
        }
        return;
      }
      if (base === "it" || base === "test") {
        const title = [
          ...suites,
          titleFrom(node.arguments[0], sourceFile),
        ].join(" › ");
        findings.push(
          ...findingsForTest(
            filePath,
            sourceFile,
            node,
            title,
            helperInteractions
          )
        );
        return;
      }
    }
    ts.forEachChild(node, (child) => walk(child, suites));
  };
  walk(sourceFile);
  return findings;
}

export function scanTrackedTests(root = process.cwd()) {
  const files = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf-8",
  })
    .split("\0")
    .filter(
      (filePath) =>
        TEST_FILE_PATTERN.test(filePath) && existsSync(`${root}/${filePath}`)
    );
  return files.flatMap((filePath) =>
    findVolatileTestAssertions(
      filePath,
      readFileSync(`${root}/${filePath}`, "utf-8")
    )
  );
}

export function fingerprintFinding(finding) {
  return createHash("sha256")
    .update(JSON.stringify([finding.filePath, finding.code]))
    .digest("hex");
}

export function findingsBeyondBaseline(findings, baselineFingerprints = {}) {
  const remaining = new Map(Object.entries(baselineFingerprints));
  return findings.filter((finding) => {
    const fingerprint = fingerprintFinding(finding);
    const count = remaining.get(fingerprint) ?? 0;
    if (count > 0) {
      remaining.set(fingerprint, count - 1);
      return false;
    }
    return true;
  });
}

export function validateHistoricalBaseline(current, previous) {
  if (
    current.version !== 2 ||
    !/^[a-f0-9]{40}$/.test(current.sourceCommit ?? "")
  ) {
    throw new Error("Invalid historical assertion baseline provenance");
  }
  for (const [fingerprint, count] of Object.entries(
    current.fingerprints ?? {}
  )) {
    if (
      !/^[a-f0-9]{64}$/.test(fingerprint) ||
      !Number.isInteger(count) ||
      count < 1
    ) {
      throw new Error("Invalid historical assertion fingerprint count");
    }
    if (previous && count > (previous.fingerprints?.[fingerprint] ?? 0)) {
      throw new Error("Historical assertion allowances must not grow");
    }
  }
  if (previous && current.sourceCommit !== previous.sourceCommit) {
    throw new Error("Historical assertion baseline provenance must not change");
  }
}

if (process.argv[1] === import.meta.filename) {
  const baseline = JSON.parse(
    readFileSync(
      new URL("volatile-test-assertions-baseline.json", import.meta.url),
      "utf-8"
    )
  );
  const baselinePath = "scripts/volatile-test-assertions-baseline.json";
  const trackedBaseline = execFileSync(
    "git",
    ["ls-tree", "--name-only", "HEAD", "--", baselinePath],
    { encoding: "utf-8" }
  ).trim();
  const previousBaseline = trackedBaseline
    ? JSON.parse(
        execFileSync("git", ["show", `HEAD:${baselinePath}`], {
          encoding: "utf-8",
        })
      )
    : undefined;
  validateHistoricalBaseline(baseline, previousBaseline);
  const findings = findingsBeyondBaseline(
    scanTrackedTests(),
    baseline.fingerprints
  );
  if (findings.length === 0) {
    console.log("Volatile design assertion guardrail passed.");
  } else {
    console.error(
      `\nVolatile design assertion guardrail failed: ${findings.length} finding(s).`
    );
    for (const finding of findings) {
      console.error(
        `- ${finding.filePath}:${finding.line} — ${finding.reason}\n  ${finding.code}`
      );
    }
    process.exitCode = 1;
  }
}
