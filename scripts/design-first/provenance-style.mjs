import { extname } from "node:path";

const RAW_COLOR =
  /(?:#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\([^)]*\)|\bcolor-mix\([^)]*\)|(?<![-A-Za-z0-9_])(?:red|blue|green|black|white|gray|grey|transparent)(?![-A-Za-z0-9_]))/g;
const CSS_VAR = /--[A-Za-z0-9_-]+/g;

function lineAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

function valueAfterColon(source, index) {
  const start = source.indexOf(":", index) + 1;
  let depth = 0;
  let stop = source.length;
  for (let cursor = start; cursor < source.length; cursor += 1) {
    const character = source[cursor];
    if (character === "(") depth += 1;
    if (character === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && /[;}\]]/.test(character)) {
      stop = cursor;
      break;
    }
  }
  return source.slice(start, stop).trim();
}

function selectorAt(source, index) {
  const open = source.lastIndexOf("{", index);
  if (open < 0) return ":root";
  const previousOpen = source.lastIndexOf("{", open - 1);
  const previousClose = source.lastIndexOf("}", open - 1);
  const previousStatement = source.lastIndexOf(";", open - 1);
  const start = Math.max(previousOpen, previousClose, previousStatement) + 1;
  return source.slice(start, open).trim() || ":root";
}

function isDefinition(source, index, name) {
  return /^\s*:/.test(source.slice(index + name.length));
}

export function collectStyles(file, source) {
  const definitions = [];
  const usages = [];
  const rawValues = [];
  const seen = new Set();
  const isCss = extname(file) === ".css";
  for (const match of source.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) {
    definitions.push({
      name: match[1],
      file,
      line: lineAt(source, match.index),
      value: valueAfterColon(source, match.index),
      selector: isCss ? selectorAt(source, match.index) : null,
      kind: "css-variable",
    });
  }
  for (const match of source.matchAll(CSS_VAR)) {
    const name = match[0];
    if (isDefinition(source, match.index, name)) continue;
    const line = lineAt(source, match.index);
    const key = `${name}:${line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    usages.push({ name, file, line, kind: "css-variable-use" });
  }
  for (const match of source.matchAll(RAW_COLOR)) {
    rawValues.push({
      value: match[0],
      file,
      line: lineAt(source, match.index),
      kind: isCss ? "css-color" : "source-color",
    });
  }
  return { definitions, usages, rawValues };
}
