import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button, IconButton } from "./button";

describe("tinted action color contract", () => {
  it.each([
    ["success-light", "success", "P"],
    ["warning-light", "warning", "R"],
  ] as const)(
    "%s keeps its color and native disabled behavior",
    (variant, tone, label) => {
      const markup = renderToStaticMarkup(
        <Button variant={variant} aria-label={`${label} signoff`} disabled>
          {label}
        </Button>
      );
      expect(markup).toContain(`data-variant="${variant}"`);
      expect(markup).toContain(`bg-${tone}-subtle`);
      expect(markup).toContain("text-foreground");
      expect(markup).toContain(`aria-label="${label} signoff"`);
      expect(markup).toContain("disabled");
    }
  );
});

describe("signoff accent contract", () => {
  it.each(["success", "warning"] as const)(
    "%s preserves a vivid fill and readable label",
    (tone) => {
      const markup = renderToStaticMarkup(
        <Button variant={tone} aria-label="Sign off">
          Sign off
        </Button>
      );
      expect(markup).toContain(`bg-${tone}-accent`);
      expect(markup).toContain(`text-${tone}-accent-foreground`);
      expect(markup).toContain('aria-label="Sign off"');
    }
  );
});

describe(IconButton, () => {
  it("requires a stable accessible name", () => {
    const markup = renderToStaticMarkup(
      <IconButton icon={<span>+</span>} label="Add evidence" type="button" />
    );

    expect(markup).toContain('aria-label="Add evidence"');
    expect(markup).toContain("pw-icon-button");
  });
});
