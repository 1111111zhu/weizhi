import { HealthController } from "./health.controller";

describe(HealthController, () => {
  it("reports that the API is healthy", () => {
    const controller = new HealthController();
    expect(controller.getHealth()).toStrictEqual({ ok: true });
  });
});
