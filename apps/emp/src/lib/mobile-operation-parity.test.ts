import { PROJECT_PERMISSION_ACTIONS } from "@project-wing/shared";
import { describe, expect, it } from "vitest";

import {
  mobileContentRequirements,
  mobileDirectoryRequirements,
  mobileFileActionRequirements,
  mobilePermissionRequirements,
} from "./mobile-operation-parity";

describe("mobile functionality-parity obligations", () => {
  it("maps every current permission action without using viewport as authorization", () => {
    expect(Object.keys(mobilePermissionRequirements).sort()).toStrictEqual(
      [...PROJECT_PERMISSION_ACTIONS].sort()
    );
  });

  it("retains desktop-only interactions as explicit mobile flows rather than omitting them", () => {
    expect(mobileFileActionRequirements).toHaveProperty("MASTER");
    expect(mobileFileActionRequirements).toHaveProperty("PREVIEW_NEW_WINDOW");
    expect(mobileDirectoryRequirements).toHaveProperty("onCopyNodeToNode");
    expect(mobileDirectoryRequirements).toHaveProperty("onMoveNodeToNode");
    expect(mobileContentRequirements).toHaveProperty(
      "onPasteAttachmentClipboard"
    );
    expect(mobileContentRequirements).toHaveProperty("onCreateFromTemplate");
  });
});
