import { readFileSync } from "node:fs";
import { extname } from "node:path";

import { collectClassTokens, collectVariants } from "./provenance-ast.mjs";
import { collectStyles } from "./provenance-style.mjs";
import { CODE_EXTENSIONS, repoPath, sourceFile } from "./provenance-utils.mjs";

export function makeTokenRecord(file, rootDir) {
  const source = requireSource(file);
  const isCode = CODE_EXTENSIONS.has(extname(file).toLowerCase());
  const parsed = isCode ? sourceFile(file, source) : null;
  return {
    file: repoPath(rootDir, file),
    scope: null,
    kind: null,
    publicImport: null,
    publicExports: [],
    exports: [],
    implementationExports: [],
    reexports: [],
    imports: [],
    variants: parsed ? collectVariants(parsed) : [],
    classNameTokens: parsed ? collectClassTokens(parsed) : [],
    unresolvedImports: [],
    styles: collectStyles(repoPath(rootDir, file), source),
  };
}

function requireSource(file) {
  return readFileSync(file, "utf8");
}
