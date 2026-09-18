import type { ExecutionContext, INestApplication } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GlobalRolesGuard } from "../../auth/global-roles.guard";
import type { RequestUser } from "../../auth/request-user";
import { CmpAmlConfigurationController } from "./cmp-aml-configuration.controller";
import { CmpAmlConfigurationService } from "./cmp-aml-configuration.service";

vi.mock("../../auth/auth.guard", () => ({
  AuthGuard: class {
    canActivate() {
      return true;
    }
  },
}));

const staff: RequestUser = {
  id: "staff-1",
  email: "staff@example.com",
  name: "Staff",
  globalRole: "STAFF",
};
const superAdmin: RequestUser = { ...staff, globalRole: "SUPER_ADMIN" };

describe(CmpAmlConfigurationController, () => {
  let app: INestApplication;
  let requestUser: RequestUser = staff;
  const configuration = {
    getPublicStatus: vi.fn().mockResolvedValue({
      enabled: false,
      configured: false,
      source: null,
      updatedAt: null,
      updatedBy: null,
    }),
  };

  afterEach(async () => {
    await app?.close();
    vi.clearAllMocks();
    requestUser = staff;
  });

  async function createApp() {
    const module = await Test.createTestingModule({
      controllers: [CmpAmlConfigurationController],
      providers: [
        Reflector,
        GlobalRolesGuard,
        { provide: CmpAmlConfigurationService, useValue: configuration },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalGuards({
      canActivate(context: ExecutionContext) {
        context.switchToHttp().getRequest().user = requestUser;
        return true;
      },
    });
    await app.init();
  }

  it("returns HTTP 403 to a non-Super Admin and permits a Super Admin", async () => {
    await createApp();

    await request(app.getHttpServer()).get("/cmp/settings/aml").expect(403);

    requestUser = superAdmin;
    await request(app.getHttpServer())
      .get("/cmp/settings/aml")
      .expect(200)
      .expect({
        enabled: false,
        configured: false,
        source: null,
        updatedAt: null,
        updatedBy: null,
      });
    expect(configuration.getPublicStatus).toHaveBeenCalledOnce();
  });
});
