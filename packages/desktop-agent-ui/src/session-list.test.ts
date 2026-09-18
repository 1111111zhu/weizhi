import { describe, expect, it } from "vitest";

import { formatRecentOpenedAt } from "./session-list-utils";

describe("desktop agent recent session list", () => {
  it("formats the opened time with the selected locale", () => {
    const formatted = formatRecentOpenedAt("2026-08-03T08:30:00.000Z", "en-US");

    expect(formatted.length).toBeGreaterThan(0);
  });
});
