import { describe, expect, it } from "vitest";

import { getSessionStatusBadgeVariant } from "./tray-content";

describe(getSessionStatusBadgeVariant, () => {
  it.each([
    ["OPEN", "success-light"],
    ["CHECKING_IN", "info-light"],
    ["DIRTY_PENDING_CHECKIN", "warning-light"],
    ["LEASE_LOST", "destructive-light"],
    ["CLOSED", "secondary"],
  ] as const)("maps %s to %s", (status, expected) => {
    expect(getSessionStatusBadgeVariant(status)).toBe(expected);
  });
});
