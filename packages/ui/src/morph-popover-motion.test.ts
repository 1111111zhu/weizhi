import { describe, expect, it } from "vitest";

import {
  getMorphPopoverPosition,
  getMorphPopoverVariants,
} from "./morph-popover-motion";

const layout = {
  trigger: { left: 300, top: 40, width: 32, height: 32 },
  content: { width: 240, height: 180 },
};

describe("morph popover motion", () => {
  it("anchors an end-aligned panel to the trigger edge", () => {
    expect(getMorphPopoverPosition(layout, "bottom", "end", 8)).toStrictEqual({
      left: 92,
      top: 80,
    });
  });

  it("uses the same trigger corner for hidden and visible states", () => {
    const variants = getMorphPopoverVariants(false, "bottom", "end", 10);

    expect(variants.clipVariants?.hidden).toMatchObject({
      clipPath: "inset(0% 0% 92% 92% round 10px)",
    });
    expect(variants.clipVariants?.show).toMatchObject({
      clipPath: "inset(0% 0% 0% 0% round 10px)",
    });
  });

  it("removes spatial motion when reduced motion is requested", () => {
    expect(getMorphPopoverVariants(true, "bottom", "end", 10)).toStrictEqual({
      clipVariants: undefined,
      wrapperVariants: undefined,
    });
  });
});
