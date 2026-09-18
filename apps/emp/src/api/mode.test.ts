import { describe, expect, it } from "vitest";

import { isMockApiMode, isRemoteVisualizationMode } from "./mode";

describe(isMockApiMode, () => {
  it("enables mock mode only", () => {
    expect(isMockApiMode("mock")).toBeTruthy();
    expect(isMockApiMode("MOCK")).toBeTruthy();
    expect(isMockApiMode("standalone")).toBeFalsy();
  });

  it("keeps live mode by default", () => {
    expect(isMockApiMode()).toBeFalsy();
    expect(isMockApiMode("live")).toBeFalsy();
  });
});

describe(isRemoteVisualizationMode, () => {
  it("only enables direct session validation for the development proxy", () => {
    expect(
      isRemoteVisualizationMode("http://localhost:3010", "development")
    ).toBeTruthy();
    expect(
      isRemoteVisualizationMode("http://localhost:3000", "development")
    ).toBeFalsy();
    expect(
      isRemoteVisualizationMode("http://localhost:3010", "production")
    ).toBeFalsy();
  });
});
