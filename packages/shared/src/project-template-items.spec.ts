import { describe, expect, it } from "vitest";

import {
  ReorderProjectTemplateItemsSchema,
  UpdateProjectTemplateItemCodeSchema,
} from "./index";

describe("project template item contracts", () => {
  it("accepts a positive integer suffix", () => {
    expect(
      UpdateProjectTemplateItemCodeSchema.parse({ sequence: 8 })
    ).toStrictEqual({ sequence: 8 });
    expect(
      UpdateProjectTemplateItemCodeSchema.safeParse({ sequence: 0 }).success
    ).toBeFalsy();
    expect(
      UpdateProjectTemplateItemCodeSchema.safeParse({ sequence: 1.5 }).success
    ).toBeFalsy();
  });

  it("accepts one complete mixed ordering without duplicate references", () => {
    const items = [
      { type: "FILE" as const, id: "file-1" },
      { type: "SMART_FORM" as const, id: "smart-form-1" },
    ];
    expect(ReorderProjectTemplateItemsSchema.parse({ items })).toStrictEqual({
      items,
    });
    expect(
      ReorderProjectTemplateItemsSchema.safeParse({
        items: [items[0], items[0]],
      }).success
    ).toBeFalsy();
  });
});
