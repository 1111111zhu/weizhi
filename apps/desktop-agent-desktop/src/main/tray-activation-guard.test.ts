import { describe, expect, it } from "vitest";

import { TrayActivationGuard } from "./tray-activation-guard";

describe(TrayActivationGuard, () => {
  it("suppresses blur while a tray activation is being delivered", () => {
    let now = 1000;
    const guard = new TrayActivationGuard(() => now, 500);

    guard.beginActivation();
    expect(guard.shouldIgnoreBlur()).toBeTruthy();

    now = 1500;
    expect(guard.shouldIgnoreBlur()).toBeFalsy();
  });

  it("stops suppressing blur when the tray activation is consumed", () => {
    const guard = new TrayActivationGuard(() => 1000, 500);

    guard.beginActivation();
    guard.finishActivation();

    expect(guard.shouldIgnoreBlur()).toBeFalsy();
  });
});
