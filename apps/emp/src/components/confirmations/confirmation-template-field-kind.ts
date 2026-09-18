import type { ConfirmationTemplateDesignField } from "@/api/client";

export const EDITABLE_CONFIRMATION_FIELD_KINDS = [
  "TEXT",
  "MULTILINE",
  "STATIC_TEXT",
  "RADIO",
  "NUMBER",
  "DATE",
] as const;

export function changeConfirmationTemplateFieldKind(
  field: ConfirmationTemplateDesignField,
  kind: (typeof EDITABLE_CONFIRMATION_FIELD_KINDS)[number],
  defaultOption: string
): ConfirmationTemplateDesignField {
  if (field.kind === kind) {
    return field;
  }
  const next = {
    ...field,
    kind,
    options:
      kind === "RADIO"
        ? field.options.length
          ? [...field.options]
          : [defaultOption]
        : [],
  };
  delete next.defaultChecked;
  delete next.required;
  const supportsAssociation = kind === "TEXT" || kind === "MULTILINE";
  if (!supportsAssociation) {
    delete next.binding;
    delete next.baseInformationBinding;
    delete next.informationLibraryBinding;
  }
  const source = next.defaultValueSource;
  if (source) {
    let compatible = supportsAssociation;
    if (source.source === "CUSTOM") {
      const value = source.value.trim();
      compatible = kind !== "STATIC_TEXT";
      if (kind === "NUMBER") {
        compatible = !value || /^-?(?:\d+|\d*\.\d+)$/u.test(value);
      } else if (kind === "DATE") {
        compatible =
          !value ||
          (/^\d{4}-\d{2}-\d{2}$/u.test(value) &&
            !Number.isNaN(Date.parse(value)));
      } else if (kind === "RADIO") {
        compatible =
          !value || next.options.some((option) => option.trim() === value);
      }
    } else if (source.source === "SYSTEM") {
      compatible = kind === "DATE";
    }
    if (!compatible) {
      delete next.defaultValueSource;
    }
  }
  return next;
}
