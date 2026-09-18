import { Reflector } from "@nestjs/core";

import { GLOBAL_ROLES_KEY } from "../auth/global-roles.decorator";
import { GlobalRolesGuard } from "../auth/global-roles.guard";
import { ApiForbiddenException } from "../common/api-error";
import { RolesController } from "./roles.controller";

const roles = {
  list: vi.fn(),
};

describe(RolesController, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("limits the role-permission directory to super administrators", () => {
    const requiredRoles = Reflect.getMetadata(
      GLOBAL_ROLES_KEY,
      RolesController
    );

    expect(requiredRoles).toStrictEqual(["SUPER_ADMIN"]);
  });

  it("lets the global role guard reject non-admin users for role permissions", () => {
    const guard = new GlobalRolesGuard(new Reflector());
    const context = createHttpContext({ globalRole: "PARTNER" });

    expect(() => guard.canActivate(context)).toThrow(ApiForbiddenException);
  });

  it("delegates role listing after guards pass", () => {
    roles.list.mockReturnValue([{ code: "SUPER_ADMIN" }]);
    const controller = new RolesController(roles as never);

    expect(controller.list()).toStrictEqual([{ code: "SUPER_ADMIN" }]);
    expect(roles.list).toHaveBeenCalledOnce();
  });
});

function createHttpContext(user: { globalRole: string }) {
  return {
    getHandler: () => RolesController.prototype.list,
    getClass: () => RolesController,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as never;
}
