import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const scopes = [
  "apps/emp",
  "apps/cmp",
  "apps/tms",
  "apps/intranet",
  "apps/ib",
  "apps/ui-showroom",
  "packages/ui",
  "packages/document-viewer",
];
const ignored = new Set([
  "node_modules",
  ".next",
  ".next-mobile-smartform",
  ".source",
  "dist",
  "build",
  "coverage",
  "public",
  "bin",
  "obj",
]);
function walk(folder) {
  return readdirSync(path.join(root, folder), { withFileTypes: true }).flatMap(
    (entry) => {
      const name = `${folder}/${entry.name}`;
      if (entry.isDirectory()) {
        return ignored.has(entry.name) || entry.name.startsWith(".next")
          ? []
          : walk(name);
      }
      return /\.(tsx?|css|mjs|json)$/.test(name) &&
        !/\.(test|spec|d)\./.test(name)
        ? [name]
        : [];
    }
  );
}
const details = scopes.map((scope) => {
  const files = walk(scope).map((file) => {
    const source = readFileSync(path.join(root, file), "utf-8");
    const colors = [
      ...source.matchAll(
        /#[\da-fA-F]{3,8}\b|(?:rgba?|hsla?|oklch|lab)\([^\n;]+?\)/g
      ),
    ].map((match) => match[0]);
    const uiImports = [...source.matchAll(/from\s+["']([^"']+)["']/g)]
      .map((match) => match[1])
      .filter((value) =>
        /(?:components\/(?:ui|extend\/ui)|@project-wing\/ui|@base-ui|@fluentui|sonner|@tanstack\/react-table)/.test(
          value
        )
      );
    const declarations = file.endsWith(".css")
      ? [
          ...source.matchAll(
            /(?:^|[;{\n])\s*((?:font-size|font-family|font-weight|border-radius|box-shadow|gap|padding|margin|transition|--[\w-]+)\s*:\s*[^;{}]+);/g
          ),
        ].map((match) => match[1].replaceAll(/\s+/g, " ").trim())
      : [];
    return {
      file,
      lines: source.split("\n").length,
      colors,
      uiImports,
      declarations,
      route: /(?:page|layout)\.tsx$/.test(file),
    };
  });
  const manifest = JSON.parse(
    readFileSync(path.join(root, scope, "package.json"), "utf-8")
  );
  return {
    scope,
    package: manifest.name,
    scripts: manifest.scripts,
    dependencies: manifest.dependencies,
    files,
  };
});
const declarationOwners = new Map();
for (const scope of details) {
  for (const file of scope.files) {
    for (const declaration of new Set(file.declarations)) {
      const owners = declarationOwners.get(declaration) ?? [];
      owners.push(file.file);
      declarationOwners.set(declaration, owners);
    }
  }
}
const duplicateDeclarations = [...declarationOwners]
  .filter(([, owners]) => owners.length > 1)
  .map(([declaration, files]) => ({ declaration, files }));
const summary = details.map((scope) => ({
  scope: scope.scope,
  sourceFiles: scope.files.length,
  routesAndLayouts: scope.files.filter((file) => file.route).length,
  cssFiles: scope.files.filter((file) => file.file.endsWith(".css")).length,
  rawColorOccurrences: scope.files.reduce(
    (total, file) => total + file.colors.length,
    0
  ),
  rawColorFiles: scope.files.filter((file) => file.colors.length).length,
  largestStyleFiles: scope.files
    .filter((file) => file.file.endsWith(".css"))
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 5)
    .map((file) => ({ file: file.file, lines: file.lines })),
}));
console.log(
  JSON.stringify(
    process.argv.includes("--summary")
      ? { summary, repeatedDeclarations: duplicateDeclarations.length }
      : { schemaVersion: 1, summary, details, duplicateDeclarations },
    null,
    2
  )
);
