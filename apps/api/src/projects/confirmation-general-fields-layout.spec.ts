import { describe, expect, it, vi } from "vitest";

import { ConfirmationGeneralFieldsController } from "./confirmation-general-fields.controller";
import { ConfirmationGeneralFieldsService } from "./confirmation-general-fields.service";

function setup(initialLayout: unknown = null) {
  const fieldRows = [
    { id: "legacy", name: "旧字段", position: 0, isActive: true },
  ];
  let layoutRow: { id: string; layout: unknown } | null = initialLayout
    ? { id: "default", layout: initialLayout }
    : null;
  const fieldDelegate = {
    findMany: vi.fn(async () =>
      fieldRows
        .filter((row) => row.isActive)
        .sort((left, right) => left.position - right.position)
        .map(({ id, name }) => ({ id, name }))
    ),
    updateMany: vi.fn(async () => {
      fieldRows.forEach((row) => {
        row.isActive = false;
      });
    }),
    upsert: vi.fn(async ({ where, create, update }) => {
      const row = fieldRows.find((item) => item.id === where.id);
      if (row) Object.assign(row, update);
      else fieldRows.push({ ...create, isActive: true });
    }),
  };
  const layoutDelegate = {
    findUnique: vi.fn(async () => layoutRow),
    upsert: vi.fn(async ({ create, update }) => {
      layoutRow = { id: "default", layout: update?.layout ?? create.layout };
      return layoutRow;
    }),
  };
  const tx = {
    confirmationGeneralField: fieldDelegate,
    confirmationGeneralFieldsLayout: layoutDelegate,
  };
  const prisma = {
    ...tx,
    $transaction: vi.fn(async (callback) => callback(tx)),
  };
  const audit = { logInTransaction: vi.fn() };
  const service = new ConfirmationGeneralFieldsService(
    prisma as never,
    audit as never
  );
  return { service, controller: new ConfirmationGeneralFieldsController(service), prisma, audit };
}

const admin = { id: "admin", globalRole: "SUPER_ADMIN" } as never;

describe("confirmation general fields layout", () => {
  it("returns four default sections with valid stable builtin bindings and legacy fields", async () => {
    const { service } = setup();

    const layout = await service.getLayout();

    expect(layout.sections.map((section) => section.id)).toEqual([
      "client",
      "reference",
      "bank",
      "general",
    ]);
    expect(layout.sections[0].fields).toContainEqual({
      id: "builtin-clientName",
      name: "客户名称",
      binding: "clientName",
    });
    expect(layout.sections[3].fields).toContainEqual({
      id: "legacy",
      name: "旧字段",
    });
    expect(
      layout.sections
        .flatMap((section) => section.fields)
        .filter((field) => field.binding)
        .map((field) => field.binding)
    ).toHaveLength(9);
  });

  it("round-trips renamed and deleted sections and fields while syncing only custom fields", async () => {
    const { service, prisma, audit } = setup();

    const layout = await service.replaceLayout(
      {
        sections: [
          {
            id: "client-renamed",
            name: "客户改名",
            fields: [
              { id: "builtin-clientName", name: "客户新名称", binding: "clientName" },
            ],
          },
          { id: "empty", name: "空区段", fields: [] },
          {
            id: "general",
            name: "通用信息",
            fields: [{ id: "new-custom", name: "新字段" }],
          },
        ],
      },
      admin,
      {}
    );

    expect(layout).toEqual({
      sections: [
        {
          id: "client-renamed",
          name: "客户改名",
          fields: [
            { id: "builtin-clientName", name: "客户新名称", binding: "clientName" },
          ],
        },
        { id: "empty", name: "空区段", fields: [] },
        {
          id: "general",
          name: "通用信息",
          fields: [{ id: "new-custom", name: "新字段" }],
        },
      ],
    });
    expect(prisma.confirmationGeneralField.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "new-custom" },
        create: { id: "new-custom", name: "新字段", position: 0 },
      })
    );
    expect(prisma.confirmationGeneralField.upsert).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "builtin-clientName" } })
    );
    expect(audit.logInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "CONFIRMATION_GENERAL_FIELDS_LAYOUT_UPDATED",
      })
    );
  });

  it("rejects the legacy flat PATCH once a layout is configured", async () => {
    const { service, prisma } = setup({
      sections: [
        {
          id: "general",
          name: "通用信息",
          fields: [
            { id: "builtin-clientName", name: "客户名称", binding: "clientName" },
            { id: "legacy", name: "旧字段" },
          ],
        },
      ],
    });

    await expect(
      service.replace([{ id: "flat-custom", name: "平面字段" }], admin, {})
    ).rejects.toThrow("Use the layout endpoint");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["duplicate section IDs", { sections: [{ id: "x", name: "A", fields: [] }, { id: "x", name: "B", fields: [] }] }],
    ["duplicate field IDs", { sections: [{ id: "x", name: "A", fields: [{ id: "f", name: "A" }] }, { id: "y", name: "B", fields: [{ id: "f", name: "B" }] }] }],
    ["unknown builtin binding", { sections: [{ id: "x", name: "A", fields: [{ id: "builtin-x", name: "X", binding: "notARealBinding" }] }] }],
    ["builtin binding on a custom ID", { sections: [{ id: "x", name: "A", fields: [{ id: "custom", name: "X", binding: "clientName" }] }] }],
  ])("rejects %s", async (_, body) => {
    const { controller } = setup();
    await expect(controller.replaceLayout(body, admin, {})).rejects.toThrow();
  });

  it("rejects layout writes from non-super administrators before opening a transaction", async () => {
    const { service, prisma } = setup();

    await expect(
      service.replaceLayout({ sections: [] }, { id: "staff", globalRole: "STAFF" } as never, {})
    ).rejects.toThrow("Only super administrators");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
