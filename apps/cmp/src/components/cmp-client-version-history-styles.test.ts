import { readFileSync } from "node:fs";
import nodePath from "node:path";

import { describe, expect, it } from "vitest";

const { dirname, resolve } = nodePath;

function readReachableStyles(
  file: string,
  visited = new Set<string>()
): string {
  const path = resolve(file);
  if (visited.has(path)) {
    return "";
  }
  visited.add(path);
  const source = readFileSync(path, "utf-8");
  const imports = [...source.matchAll(/@import\s+["'](\.[^"']+)["']/g)];
  return [
    source,
    ...imports.map((match) =>
      readReachableStyles(resolve(dirname(path), match[1] ?? ""), visited)
    ),
  ].join("\n");
}

describe("cMP Client version history styles", () => {
  it("defines every page-specific class referenced by the component", () => {
    const component = readFileSync(
      "src/components/cmp-client-version-history-page.tsx",
      "utf-8"
    );
    const styles = readReachableStyles("src/app/styles.css");
    const classNames = new Set(
      [
        ...component.matchAll(/\bcmp-version-(?:\p{Letter}|\p{Number}|-)+/gu),
      ].map(([className]) => className)
    );

    expect(classNames.size).toBeGreaterThan(0);
    for (const className of classNames) {
      expect(styles, `${className} must have a stylesheet definition`).toMatch(
        new RegExp(`\\.${className}(?:[\\s,:>{.#]|$)`)
      );
    }
  });

  it("keeps the desktop workspace and narrow summary responsive", () => {
    const styles = readFileSync("src/app/styles.css", "utf-8");

    expect(styles).toMatch(
      /\.cmp-version-workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 18\.5rem;/
    );
    expect(styles).toMatch(
      /@media \(max-width: 40rem\)[\s\S]*?\.cmp-version-summary\s*\{[^}]*grid-template-columns:\s*1fr;/
    );
  });
});
