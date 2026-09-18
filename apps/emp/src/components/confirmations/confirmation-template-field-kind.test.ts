import { describe, expect, it } from "vitest";

import type { ConfirmationTemplateDesignField } from "@/api/client";

import { changeConfirmationTemplateFieldKind } from "./confirmation-template-field-kind";

const field: ConfirmationTemplateDesignField = {
  id: "recipient",
  kind: "TEXT",
  name: "Recipient",
  placeholder: "Recipient name",
  page: 2,
  x: 0.15,
  y: 0.25,
  width: 0.3,
  height: 0.04,
  options: [],
  textAlign: "right",
  baseInformationBinding: "clientName",
  informationLibraryBinding: "recipientName",
};

describe("changing an existing confirmation field type", () => {
  it("keeps identity, placement, alignment and associations between text types", () => {
    const next = changeConfirmationTemplateFieldKind(
      field,
      "MULTILINE",
      "Option 1"
    );
    expect(next).toStrictEqual({ ...field, kind: "MULTILINE" });
    expect(field.kind).toBe("TEXT");
  });

  it("removes text associations and invalid text defaults when changing to number", () => {
    const next = changeConfirmationTemplateFieldKind(
      {
        ...field,
        binding: "clientName",
        defaultValueSource: { source: "CUSTOM", value: "Acme" },
      },
      "NUMBER",
      "Option 1"
    );
    expect(next).toMatchObject({
      id: field.id,
      kind: "NUMBER",
      x: field.x,
      y: field.y,
      options: [],
    });
    expect(next).not.toHaveProperty("binding");
    expect(next).not.toHaveProperty("baseInformationBinding");
    expect(next).not.toHaveProperty("informationLibraryBinding");
    expect(next).not.toHaveProperty("defaultValueSource");
  });

  it("keeps a compatible numeric initial value", () => {
    const value = { source: "CUSTOM", value: "-12.50" } as const;
    expect(
      changeConfirmationTemplateFieldKind(
        { ...field, defaultValueSource: value },
        "NUMBER",
        "Option 1"
      ).defaultValueSource
    ).toStrictEqual(value);
  });

  it("initializes a radio option and removes obsolete checkbox flags", () => {
    const next = changeConfirmationTemplateFieldKind(
      { ...field, kind: "CHECKBOX", defaultChecked: true, required: true },
      "RADIO",
      "Option 1"
    );
    expect(next.options).toStrictEqual(["Option 1"]);
    expect(next).not.toHaveProperty("defaultChecked");
    expect(next).not.toHaveProperty("required");
  });

  it("keeps dropdown choices and a matching initial selection when converting to radio", () => {
    const value = { source: "CUSTOM", value: "No" } as const;
    const next = changeConfirmationTemplateFieldKind(
      {
        ...field,
        kind: "SELECT",
        options: ["Yes", " No "],
        defaultValueSource: value,
      },
      "RADIO",
      "Option 1"
    );
    expect(next.options).toStrictEqual(["Yes", " No "]);
    expect(next.defaultValueSource).toStrictEqual(value);
  });

  it("removes options and system date defaults on static text without losing its content", () => {
    const next = changeConfirmationTemplateFieldKind(
      {
        ...field,
        kind: "DATE",
        defaultValueSource: { source: "SYSTEM", value: "CURRENT_DATE" },
      },
      "STATIC_TEXT",
      "Option 1"
    );
    expect(next.placeholder).toBe(field.placeholder);
    expect(next.options).toStrictEqual([]);
    expect(next).not.toHaveProperty("defaultValueSource");
  });

  it.each(["not a date", "2026/09/06"])(
    "clears incompatible date default %s",
    (value) => {
      const next = changeConfirmationTemplateFieldKind(
        { ...field, defaultValueSource: { source: "CUSTOM", value } },
        "DATE",
        "Option 1"
      );
      expect(next).not.toHaveProperty("defaultValueSource");
    }
  );

  it("does not change a field when the existing kind is chosen again", () => {
    expect(changeConfirmationTemplateFieldKind(field, "TEXT", "Option 1")).toBe(
      field
    );
  });
});
