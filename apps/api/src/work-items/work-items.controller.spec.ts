import { describe, expect, it, vi } from "vitest";

import type { RequestUser } from "../auth/request-user";
import { WorkItemsController } from "./work-items.controller";
import type { WorkItemsService } from "./work-items.service";

const user: RequestUser = {
  id: "user-1",
  email: "user@example.com",
  name: "User",
  globalRole: "STAFF",
};

describe(WorkItemsController, () => {
  it("normalizes the legacy domain query to scope", () => {
    const list = vi.fn();
    const controller = new WorkItemsController({
      list,
    } as unknown as WorkItemsService);

    controller.list(user, {
      view: "PERSONAL",
      domain: "CMP",
      locale: "zh-CN",
    });

    expect(list).toHaveBeenCalledWith(user, {
      view: "PERSONAL",
      scope: "CMP",
      locale: "zh-CN",
    });
  });

  it("rejects conflicting scope and domain values", () => {
    const controller = new WorkItemsController({
      list: vi.fn(),
    } as unknown as WorkItemsService);

    expect(() =>
      controller.list(user, {
        view: "PERSONAL",
        scope: "EMP",
        domain: "CMP",
        locale: "zh-CN",
      })
    ).toThrow("Work item query is invalid");
  });
});
