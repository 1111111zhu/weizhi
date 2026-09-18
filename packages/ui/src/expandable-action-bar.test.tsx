import { describe, expect, it } from "vitest";

import * as actionBarModule from "./expandable-action-bar";

describe("expandableActionBar motion", () => {
  it("keeps the collapsed label animation deterministic for reduced-motion hydration", () => {
    const getLabelAnimation = Reflect.get(
      actionBarModule,
      "getActionBarLabelAnimation"
    );

    expect(getLabelAnimation).toBeTypeOf("function");
    if (typeof getLabelAnimation !== "function") {
      return;
    }

    expect(getLabelAnimation(false, false)).toStrictEqual({
      width: 0,
      opacity: 0,
      x: -4,
      marginLeft: 0,
      filter: "blur(3px)",
    });
    expect(getLabelAnimation(false, true)).toStrictEqual({
      width: 0,
      opacity: 0,
      x: 0,
      marginLeft: 0,
      filter: "blur(0px)",
    });
  });

  it("uses a smooth ease-out transition for expand and collapse", () => {
    expect(Reflect.get(actionBarModule, "ACTION_BAR_TRANSITION")).toStrictEqual(
      {
        type: "tween",
        duration: 0.2,
        ease: [0.16, 1, 0.3, 1],
      }
    );
  });

  it("keeps a short visible transition when reduced motion is preferred", () => {
    expect(
      Reflect.get(actionBarModule, "REDUCED_ACTION_BAR_TRANSITION")
    ).toStrictEqual({
      type: "tween",
      duration: 0.12,
      ease: [0.16, 1, 0.3, 1],
    });
  });
});
