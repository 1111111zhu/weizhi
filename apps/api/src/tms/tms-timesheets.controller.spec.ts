import { GLOBAL_ROLES_KEY } from "../auth/global-roles.decorator";
import { TmsTimesheetsController } from "./tms-timesheets.controller";

describe(TmsTimesheetsController, () => {
  it("passes the explicit owner and half to approval", async () => {
    const service = { approve: vi.fn().mockResolvedValue({}) };
    const controller = new TmsTimesheetsController(
      service as never,
      {} as never
    );
    const actor = { id: "manager-1", globalRole: "MANAGER" };

    await controller.approve(
      "member-1",
      "2026",
      "7",
      "FIRST_HALF",
      { expectedSubmittedRevision: 2 },
      actor as never
    );

    expect(service.approve).toHaveBeenCalledWith(
      actor,
      "member-1",
      2026,
      7,
      "FIRST_HALF",
      {
        expectedSubmittedRevision: 2,
      }
    );
  });

  it("parses and forwards Manager timesheet queries", async () => {
    const queryService = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    const controller = new TmsTimesheetsController(
      {} as never,
      queryService as never
    );
    const actor = { id: "manager-1", globalRole: "MANAGER" };

    await controller.queryTimesheets(
      { page: "1", pageSize: "50" },
      actor as never
    );

    expect(queryService.query).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        mode: "DETAIL",
        page: 1,
        pageSize: 50,
      })
    );
    expect(
      Reflect.getMetadata(
        GLOBAL_ROLES_KEY,
        TmsTimesheetsController.prototype.queryTimesheets
      )
    ).toStrictEqual(["PARTNER", "MANAGER"]);
  });

  it("allows the legacy approval endpoint only for Partner and Manager", () => {
    expect(
      Reflect.getMetadata(
        GLOBAL_ROLES_KEY,
        TmsTimesheetsController.prototype.approve
      )
    ).toStrictEqual(["PARTNER", "MANAGER"]);
  });
});
