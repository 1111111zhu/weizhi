// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";

import { measureTopBarLayoutMetrics } from "./project-wing-top-bar-measurement";

describe("top bar measurement", () => {
  it("does not count the responsive identity wrapper as a separate sibling", () => {
    const header = document.createElement("header");
    header.style.cssText = "padding:0px;gap:12px";
    header.innerHTML = `<div class="project-wing-top-bar-leading"><div data-top-bar-side-trigger="leading"><div class="project-wing-top-bar-context" style="column-gap:8px"><div data-brand></div><div data-responsive><div data-slot="constrained-top-bar-identity"><ol data-slot="breadcrumb" style="border:0px solid"><li data-identity-segment><span data-slot="breadcrumb-page" style="padding:0px;border:0px solid;gap:0px"><span data-identity-label>Harbour</span></span></li></ol></div></div></div></div></div>`;
    document.body.append(header);
    const wrapper = header.querySelector<HTMLElement>("[data-responsive]");
    const label = header.querySelector<HTMLElement>("[data-identity-label]");
    if (!wrapper || !label) {
      throw new Error("Expected the responsive identity wrapper and label");
    }
    Object.defineProperty(label, "scrollWidth", { value: 200 });
    vi.spyOn(wrapper, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 200, 32)
    );
    const before = measureTopBarLayoutMetrics(header);
    vi.mocked(wrapper.getBoundingClientRect).mockReturnValue(
      new DOMRect(0, 0, 600, 32)
    );
    const after = measureTopBarLayoutMetrics(header);
    expect(after.leadingCollapsedWidth).toBe(208);
    expect(after.leadingCollapsedWidth).toBe(before.leadingCollapsedWidth);
    header.remove();
  });
});
