// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { mockApi } from "./mock-api";
import { loadState } from "./mock-store";

const input = {
  bankCode: "1",
  bankNameEn: "Test Bank",
  bankNameZh: "测试银行",
  bankType: "Licensed",
  businessAddress: "Test business address",
  mailingAddress: null,
  mailingAddressSameAsBusiness: true,
  contactName: null,
  attention: null,
  notes: null,
  background: null,
  historicalMailingAddress: null,
  cautions: null,
};
describe("confirmation library Mock adapter", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it("provides default general fields and layout without missing query functions", async () => {
    await expect(mockApi.confirmationGeneralFields()).resolves.toStrictEqual(
      []
    );
    const layout = await mockApi.confirmationGeneralLayout();
    expect(layout.sections).toHaveLength(4);
    await expect(
      mockApi.confirmationInformationLibrary()
    ).resolves.toStrictEqual([]);
  });

  it("requires administrator permission for every library write", async () => {
    await mockApi.login("partner@projectwing.local", "");
    await expect(
      mockApi.createConfirmationInformationLibrary(input)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      mockApi.updateConfirmationGeneralFields([])
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      mockApi.updateConfirmationGeneralLayout({ sections: [] })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("persists valid edits, normalizes bank codes and records an audit trail", async () => {
    await mockApi.login("admin@projectwing.local", "");
    const entry = await mockApi.createConfirmationInformationLibrary(input);
    expect(entry.bankCode).toBe("001");
    expect(entry.effectiveMailingAddress).toBe(input.businessAddress);
    expect(entry.isReadyForDispatch).toBeTruthy();
    await expect(
      mockApi.createConfirmationInformationLibrary(input)
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await mockApi.updateConfirmationInformationLibrary(entry.id, {
      bankNameEn: "Updated bank",
    });
    const [updated] = await mockApi.confirmationInformationLibrary({
      query: "updated",
    });
    expect(updated.id).toBe(entry.id);
    await mockApi.deleteConfirmationInformationLibrary(entry.id);
    await expect(
      mockApi.confirmationInformationLibrary()
    ).resolves.toStrictEqual([]);
    await expect(
      mockApi.confirmationInformationLibrary({ includeInactive: true })
    ).resolves.toHaveLength(1);
    await mockApi.restoreConfirmationInformationLibrary(entry.id);
    await expect(
      mockApi.confirmationInformationLibrary()
    ).resolves.toHaveLength(1);
    expect(loadState().auditLogs["confirmation-library"]).toHaveLength(4);
  });

  it("validates and restores saved general-field layout", async () => {
    await mockApi.login("admin@projectwing.local", "");
    await expect(
      mockApi.updateConfirmationGeneralFields([{ id: "bad id", name: "Test" }])
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    const layout = {
      sections: [
        {
          id: "custom",
          name: "Custom",
          fields: [{ id: "custom-field", name: "Field" }],
        },
      ],
    };
    await mockApi.updateConfirmationGeneralLayout(layout);
    await expect(mockApi.confirmationGeneralLayout()).resolves.toStrictEqual(
      layout
    );
    await expect(mockApi.confirmationGeneralFields()).resolves.toStrictEqual([
      { id: "custom-field", name: "Field" },
    ]);
  });

  it("loads project defaults and denies business writes by a visibility-only administrator", async () => {
    await mockApi.login("admin@projectwing.local", "");
    const [project] = loadState().workspaces.flatMap(
      (workspace) => workspace.projects
    );
    const defaults = await mockApi.projectConfirmationDefaults(project.id);
    expect(defaults.projectId).toBe(project.id);
    expect(defaults.clientName).toBeNull();
    await expect(
      mockApi.updateProjectConfirmationDefaults(project.id, {
        clientName: "Client",
        confirmationDate: "",
        reference: "",
        pic: "",
        mic: "",
        reportDate: "",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
