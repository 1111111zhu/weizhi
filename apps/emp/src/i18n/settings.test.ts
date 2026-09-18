import { describe, expect, it } from "vitest";

import { getPathnameLocale } from "./settings";

describe("i18n settings", () => {
  it("detects and strips locale path segments", () => {
    expect(getPathnameLocale("/en/workspaces")).toBeNull();
  });
});
