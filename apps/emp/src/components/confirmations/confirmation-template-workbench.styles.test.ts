import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("confirmation-template-workbench.tsx", import.meta.url),
  "utf-8"
);

describe("confirmation template workbench semantic colors", () => {
  it("uses EMP primary semantics instead of hard-coded blue field and guide classes", () => {
    expect(source).not.toMatch(/(?:border|bg|stroke)-blue-/u);
    expect(source).not.toContain("rgba(59,130,246,0.3)");
    expect(source).toContain("border-primary");
    expect(source).toContain("stroke-primary");
    expect(source).toContain(
      "shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_30%,transparent)]"
    );
  });
});
