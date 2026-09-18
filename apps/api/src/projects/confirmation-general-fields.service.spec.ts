import { describe, expect, it, vi } from "vitest";

import { ConfirmationGeneralFieldsController } from "./confirmation-general-fields.controller";
import { ConfirmationGeneralFieldsService } from "./confirmation-general-fields.service";

function setup() {
  const rows = [
    { id: "department", name: "Department", position: 0, isActive: true },
  ];
  const delegate = {
    findMany: vi.fn(async () =>
      rows.filter((row) => row.isActive).map(({ id, name }) => ({ id, name }))
    ),
    updateMany: vi.fn(async () => {
      rows.forEach((row) => {
        row.isActive = false;
      });
    }),
    upsert: vi.fn(async ({ where, create, update }) => {
      const row = rows.find((row) => row.id === where.id);
      if (row) Object.assign(row, update);
      else rows.push({ ...create, isActive: true });
    }),
  };
  const tx = { confirmationGeneralField: delegate };
  const prisma = {
    ...tx,
    $transaction: vi.fn(async (callback) => callback(tx)),
  };
  const audit = { logInTransaction: vi.fn() };
  const service = new ConfirmationGeneralFieldsService(
    prisma as never,
    audit as never
  );
  return { service, prisma, audit };
}

describe("global confirmation general fields", () => {
  it.each(["STAFF", "PARTNER", "CONFIRMATION_OFFICER", "HR"])(
    "rejects %s definition changes before writing",
    async (role) => {
      const { service, prisma } = setup();
      await expect(
        service.replace([], { id: "user", globalRole: role } as never, {})
      ).rejects.toThrow("Only super administrators");
      expect(prisma.$transaction).not.toHaveBeenCalled();
    }
  );

  it("renames one stable ID globally while keeping each project's content", async () => {
    const { service, audit } = setup();
    await service.replace(
      [
        { id: "department", name: "Contact team" },
        { id: "phone", name: "Phone" },
      ],
      { id: "admin", globalRole: "SUPER_ADMIN" } as never,
      {}
    );
    for (const value of ["Audit A", "Audit B"]) {
      expect(
        await service.projectValues([
          { id: "department", name: "Old name", value },
        ])
      ).toEqual([
        { id: "department", name: "Contact team", value },
        { id: "phone", name: "Phone", value: "" },
      ]);
    }
    expect(audit.logInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: "admin",
        action: "CONFIRMATION_GENERAL_FIELDS_UPDATED",
      })
    );
    await service.replace(
      [],
      { id: "admin", globalRole: "SUPER_ADMIN" } as never,
      {}
    );
    expect(await service.list()).toEqual([]);
  });

  it("blocks project-created IDs and ignores project attempts to rename global metadata", async () => {
    const { service, prisma } = setup();
    await expect(
      service.validateProjectValues([
        { id: "forged", name: "Forged", value: "x" },
      ])
    ).rejects.toThrow("Fields must be configured");
    expect(
      await service.validateProjectValues([
        { id: "department", name: "Forged name", value: "Local value" },
      ])
    ).toEqual([{ id: "department", name: "Department", value: "Local value" }]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects duplicate IDs and blank names at the API boundary", () => {
    const { service } = setup();
    const controller = new ConfirmationGeneralFieldsController(service);
    for (const fields of [
      [{ id: "x", name: " " }],
      [
        { id: "x", name: "A" },
        { id: "x", name: "B" },
      ],
    ]) {
      expect(() => controller.replace({ fields }, {} as never, {})).toThrow(
        "Invalid general information fields"
      );
    }
  });
});
