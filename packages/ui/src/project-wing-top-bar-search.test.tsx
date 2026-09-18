import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProjectWingTopBarSearch } from "./project-wing-top-bar-search";

describe(ProjectWingTopBarSearch, () => {
  it("makes the search scope visible as well as accessible by default", () => {
    const markup = renderToStaticMarkup(
      <ProjectWingTopBarSearch ariaLabel="搜索客户编号或名称" />
    );
    expect(markup).toContain('aria-label="搜索客户编号或名称"');
    expect(markup).toContain('placeholder="搜索客户编号或名称"');
    expect(markup).toContain('type="search"');
  });

  it("preserves a caller's deliberate placeholder and accessible name", () => {
    const markup = renderToStaticMarkup(
      <ProjectWingTopBarSearch
        ariaLabel="Find client records"
        placeholder="Name or code"
      />
    );
    expect(markup).toContain('aria-label="Find client records"');
    expect(markup).toContain('placeholder="Name or code"');
  });
});
