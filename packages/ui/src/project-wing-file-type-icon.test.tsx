// @vitest-environment happy-dom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  getProjectWingFileTypeIconUrl,
  ProjectWingFileTypeIcon,
} from "./project-wing-file-type-icon";

describe(ProjectWingFileTypeIcon, () => {
  it.each(["docx", "xlsx", "pdf", "pptx"])(
    "renders the Fluent %s file type icon",
    (extension) => {
      const iconUrl = getProjectWingFileTypeIconUrl(`workpaper.${extension}`);

      expect(iconUrl).toContain(`/assets/item-types/32/${extension}.svg`);
    }
  );

  it("uses the Fluent generic file icon for unknown extensions", () => {
    const iconUrl = getProjectWingFileTypeIconUrl("evidence.archive");

    expect(iconUrl).toContain("/assets/item-types/32/genericfile.svg");
  });

  it.each(["pdf", "xlsx", "docx", "pptx"])(
    "shares the desktop small %s artwork",
    (extension) => {
      expect(
        getProjectWingFileTypeIconUrl(
          `workpaper.${extension.toUpperCase()}`,
          "sm"
        )
      ).toContain(`/assets/item-types/16/${extension}.svg`);
    }
  );

  it("recognizes SmartForm by extension and preserves its dedicated glyph", () => {
    expect(
      getProjectWingFileTypeIconUrl("Audit Programme.SF", "sm")
    ).toBeNull();
    const markup = renderToStaticMarkup(
      <ProjectWingFileTypeIcon fileName="Audit Programme.SF" size="sm" />
    );
    expect(markup).toContain('data-testid="smart-form-file-icon"');
    expect(markup).not.toContain("<img");
  });

  it("renders an SSR-safe placeholder before browser hydration", () => {
    const markup = renderToStaticMarkup(
      <ProjectWingFileTypeIcon fileName="workpaper.xlsx" />
    );

    expect(markup).toMatch(/aria-hidden/);
    expect(markup).not.toMatch(/<img/);
  });
});
