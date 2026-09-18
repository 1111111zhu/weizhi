import { describe, expect, it } from "vitest";

import { changesAttachmentOrder } from "./workbench-file-reorder";

describe(changesAttachmentOrder, () => {
  const attachmentIds = ["first", "second", "third"];

  it("rejects both boundaries of the dragged file itself", () => {
    expect(
      changesAttachmentOrder({
        attachmentIds,
        sourceAttachmentId: "second",
        targetAttachmentId: "second",
        position: "before",
      })
    ).toBeFalsy();
    expect(
      changesAttachmentOrder({
        attachmentIds,
        sourceAttachmentId: "second",
        targetAttachmentId: "second",
        position: "after",
      })
    ).toBeFalsy();
  });

  it("rejects insertion gaps that keep the file in place", () => {
    expect(
      changesAttachmentOrder({
        attachmentIds,
        sourceAttachmentId: "second",
        targetAttachmentId: "third",
        position: "before",
      })
    ).toBeFalsy();
    expect(
      changesAttachmentOrder({
        attachmentIds,
        sourceAttachmentId: "second",
        targetAttachmentId: "first",
        position: "after",
      })
    ).toBeFalsy();
  });

  it("accepts insertion gaps that change the file order", () => {
    expect(
      changesAttachmentOrder({
        attachmentIds,
        sourceAttachmentId: "first",
        targetAttachmentId: "third",
        position: "after",
      })
    ).toBeTruthy();
    expect(
      changesAttachmentOrder({
        attachmentIds,
        sourceAttachmentId: "third",
        targetAttachmentId: "first",
        position: "before",
      })
    ).toBeTruthy();
  });
});
