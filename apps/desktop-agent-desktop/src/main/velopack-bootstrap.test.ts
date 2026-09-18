import { describe, expect, it, vi } from "vitest";

import { createSafeMigrationCallback } from "./velopack-bootstrap";

describe(createSafeMigrationCallback, () => {
  it("contains migration failures at the Velopack FFI boundary", () => {
    const failure = new Error("legacy cleanup failed");
    const cleanup = vi.fn(() => {
      throw failure;
    });
    const reportFailure = vi.fn();

    const safeMigration = createSafeMigrationCallback(cleanup, reportFailure);

    expect(safeMigration()).toBeFalsy();
    expect(reportFailure).toHaveBeenCalledWith(failure);
  });

  it("reports successful cleanup without a failure record", () => {
    const cleanup = vi.fn();
    const reportFailure = vi.fn();

    const safeMigration = createSafeMigrationCallback(cleanup, reportFailure);

    expect(safeMigration()).toBeTruthy();
    expect(reportFailure).not.toHaveBeenCalled();
  });

  it("does not let diagnostic write failures cross the FFI boundary", () => {
    const cleanup = vi.fn(() => {
      throw new Error("legacy cleanup failed");
    });
    const reportFailure = vi.fn(() => {
      throw new Error("diagnostic write failed");
    });

    const safeMigration = createSafeMigrationCallback(cleanup, reportFailure);

    expect(safeMigration).not.toThrow();
    expect(safeMigration()).toBeFalsy();
  });
});
