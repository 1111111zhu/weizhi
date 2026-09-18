import { describe, expect, it } from "vitest";

import {
  getDataGridToolbarAvailableWidth,
  shouldCollapseDataGridToolbarActions,
} from "./data-grid-toolbar";

describe("data grid toolbar measurement contract", () => {
  it("subtracts computed CSS pixel padding so overflow detection can run", () => {
    const availableWidth = getDataGridToolbarAvailableWidth(
      600,
      "16px",
      "16px"
    );
    expect(availableWidth).toBe(568);
    expect(
      shouldCollapseDataGridToolbarActions({
        availableWidth,
        actionsWidth: 450,
        titleWidth: 150,
        hasPersistentActions: false,
        persistentActionsWidth: 0,
      })
    ).toBeTruthy();
  });

  it("keeps actions inline when the toolbar has enough room", () => {
    expect(
      shouldCollapseDataGridToolbarActions({
        actionsWidth: 240,
        availableWidth: 720,
        hasPersistentActions: true,
        persistentActionsWidth: 280,
        titleWidth: 120,
      })
    ).toBeFalsy();
  });

  it("collapses overflowable actions before the toolbar wraps", () => {
    expect(
      shouldCollapseDataGridToolbarActions({
        actionsWidth: 240,
        availableWidth: 560,
        hasPersistentActions: true,
        persistentActionsWidth: 280,
        titleWidth: 120,
      })
    ).toBeTruthy();
  });

  it("caps long titles so search retains useful width", () => {
    expect(
      shouldCollapseDataGridToolbarActions({
        actionsWidth: 160,
        availableWidth: 720,
        hasPersistentActions: true,
        persistentActionsWidth: 280,
        titleWidth: 600,
      })
    ).toBeFalsy();
  });

  it("keeps actions inline until the toolbar has a measurable width", () => {
    expect(
      shouldCollapseDataGridToolbarActions({
        actionsWidth: 240,
        availableWidth: 0,
        hasPersistentActions: true,
        persistentActionsWidth: 280,
        titleWidth: 120,
      })
    ).toBeFalsy();
  });
});
