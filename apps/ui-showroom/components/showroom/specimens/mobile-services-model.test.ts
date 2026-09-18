import { describe, expect, it } from "vitest";

import {
  confirmationFormErrors,
  defaultMobilePreferences,
  emptyConfirmationForm,
  initialMobileConfirmations,
  mobileConfirmationSections,
  saveMobileConfirmationDraft,
} from "./mobile-services-model";
import type { MobileConfirmationForm } from "./mobile-services-model";
import {
  decodeMobileState,
  emptyMobileState,
  initialMobileRoute,
  mobileRouteHref,
  parseMobileRoute,
} from "./mobile-workspace-model";

const projects = ["orchid", "harbour", "workshop"];

describe("mobile confirmation center destinations", () => {
  it("opens the four-entry index before a list", () => {
    expect(parseMobileRoute("#confirmations")).toMatchObject({
      screen: "confirmations",
      section: "",
    });
    expect(mobileConfirmationSections.map((item) => item.label)).toStrictEqual([
      "全部函证",
      "函证模板库",
      "函证信息库",
      "回函仓库",
    ]);
  });

  it.each(mobileConfirmationSections)(
    "round-trips $id as a distinct destination",
    ({ id }) => {
      const route = {
        ...initialMobileRoute,
        screen: "confirmations" as const,
        section: id,
      };
      expect(parseMobileRoute(mobileRouteHref(route))).toStrictEqual(route);
    }
  );

  it("falls back to the index for an unknown section without changing detail links", () => {
    expect(parseMobileRoute("#confirmations?section=unknown").section).toBe("");
    expect(parseMobileRoute("#confirmation?id=cf-1")).toMatchObject({
      screen: "confirmation",
      confirmation: "cf-1",
    });
  });
});
const form: MobileConfirmationForm = {
  ...emptyConfirmationForm("orchid"),
  name: " 银行询证函 ",
  recipient: " 银行 ",
  date: "2026-12-31",
  email: " audit@example.test ",
};
const save = (data = form, id = "", newId = "new-letter") =>
  saveMobileConfirmationDraft(
    initialMobileConfirmations,
    data,
    id,
    newId,
    "2026-09-10T00:00:00Z",
    projects
  );

describe("mobile confirmation draft boundaries", () => {
  it("creates a draft, trims fields, and does not modify existing records or dispatch", () => {
    const result = save();
    expect(result.ok).toBeTruthy();
    if (!result.ok) {
      throw new Error("Expected saved draft");
    }
    expect(result.records[0]).toMatchObject({
      id: "new-letter",
      name: "银行询证函",
      recipient: "银行",
      email: "audit@example.test",
      status: "DRAFT",
    });
    expect(result.records.slice(1)).toStrictEqual(initialMobileConfirmations);
    expect(initialMobileConfirmations).toHaveLength(4);
  });

  it("edits the exact draft while retaining its identity and code", () => {
    const [original] = initialMobileConfirmations;
    const result = save(form, original.id);
    expect(result.ok).toBeTruthy();
    if (!result.ok) {
      throw new Error("Expected saved draft");
    }
    expect(result.records).toHaveLength(4);
    expect(result.records[0]).toMatchObject({
      id: original.id,
      code: original.code,
      status: "DRAFT",
      name: "银行询证函",
    });
    expect(result.records.slice(1)).toStrictEqual(
      initialMobileConfirmations.slice(1)
    );
  });

  it("validates required fields and rejects impossible calendar dates and malformed emails", () => {
    expect(
      Object.keys(confirmationFormErrors(emptyConfirmationForm(), projects))
    ).toStrictEqual(["projectId", "name", "recipient", "date"]);
    expect(
      confirmationFormErrors(
        { ...form, email: "invalid", date: "2026-02-30" },
        projects
      )
    ).toStrictEqual({
      email: "请填写有效邮箱",
      date: "请选择有效的函证基准日",
    });
    expect(
      confirmationFormErrors(
        { ...form, email: "", date: "2028-02-29" },
        projects
      )
    ).toStrictEqual({});
    expect(save({ ...form, notes: "x".repeat(2001) }).ok).toBeFalsy();
  });

  it("rejects unknown IDs, duplicate creation, reassignment, and edits of sent records", () => {
    expect(save(form, "missing").ok).toBeFalsy();
    expect(save(form, "", initialMobileConfirmations[0].id).ok).toBeFalsy();
    expect(
      save({ ...form, projectId: "harbour" }, initialMobileConfirmations[0].id)
        .ok
    ).toBeFalsy();
    for (const record of initialMobileConfirmations.filter(
      (item) => item.status !== "DRAFT"
    )) {
      expect(
        save({ ...form, projectId: record.projectId }, record.id).ok
      ).toBeFalsy();
    }
  });
});

describe("mobile service navigation and persistence", () => {
  it("upgrades existing version 2 data without losing replies or drafts", () => {
    const {
      preferences: _preferences,
      confirmations: _confirmations,
      confirmationDrafts: _drafts,
      confirmationFilters: _filters,
      ...old
    } = emptyMobileState();
    old.drafts["orchid:cash-program:q1"] = "Keep this reply";
    const decoded = decodeMobileState(JSON.stringify(old));
    expect(decoded.drafts).toStrictEqual(old.drafts);
    expect(decoded.preferences).toStrictEqual(defaultMobilePreferences);
    expect(decoded.confirmations).toStrictEqual(initialMobileConfirmations);
  });

  it("preserves appearance, filters, and an unfinished confirmation after reload", () => {
    const state = emptyMobileState();
    state.preferences = {
      theme: "dark",
      density: "default",
      textSize: "large",
    };
    state.confirmationDrafts.new = { ...form, name: "Incomplete", date: "" };
    state.confirmationFilters = {
      query: "银行",
      projectId: "orchid",
      status: "DRAFT",
    };
    expect(decodeMobileState(JSON.stringify(state))).toStrictEqual(state);
  });

  it("roundtrips exact service destinations", () => {
    for (const route of [
      {
        ...initialMobileRoute,
        screen: "settings" as const,
        section: "appearance",
      },
      {
        ...initialMobileRoute,
        screen: "confirmation" as const,
        confirmation: "cf-bank-orchid",
      },
      {
        ...initialMobileRoute,
        screen: "confirmation-edit" as const,
        confirmation: "cf-bank-orchid",
      },
      { ...initialMobileRoute, screen: "confirmation-edit" as const },
    ]) {
      expect(parseMobileRoute(mobileRouteHref(route))).toStrictEqual(route);
    }
    expect(parseMobileRoute("#confirmation?id=../../invalid").screen).toBe(
      "confirmations"
    );
  });
});
