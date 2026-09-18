import { describe, expect, it } from "vitest";

import { readProjectUrl, readProjectsUrl } from "./project-links";

describe("desktop agent project links", () => {
  it("opens the localized projects page", () => {
    expect(readProjectsUrl("zh-HK")).toBe(
      "https://emp.superfx.cn/zh-CN/engagement"
    );
    expect(readProjectsUrl("en-GB")).toBe(
      "https://emp.superfx.cn/en-US/engagement"
    );
  });

  it("encodes the project id in a localized project URL", () => {
    expect(readProjectUrl("project / 1", "zh-CN")).toBe(
      "https://emp.superfx.cn/zh-CN/engagement/project%20%2F%201"
    );
  });
});
