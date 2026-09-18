import type { ConfirmationGeneralLayout } from "../../api/client";

type LayoutField =
  ConfirmationGeneralLayout["sections"][number]["fields"][number];

export function getGeneralFieldColSpan(field: LayoutField): 1 | 2 {
  return (
    field.colSpan ??
    (field.binding === "clientName" || field.binding === "referenceCode"
      ? 2
      : 1)
  );
}

export type GeneralLayoutDrag =
  | { kind: "section"; id: string }
  | { kind: "field"; id: string };

export function swapGeneralLayoutFields(
  layout: ConfirmationGeneralLayout,
  sectionId: string,
  sourceId: string,
  targetId: string
): ConfirmationGeneralLayout {
  return {
    sections: layout.sections.map((section) => {
      if (section.id !== sectionId) return section;
      const source = section.fields.find((field) => field.id === sourceId);
      const target = section.fields.find((field) => field.id === targetId);
      if (!source || !target) return section;
      return {
        ...section,
        fields: section.fields.map((field) =>
          field.id === sourceId
            ? target
            : field.id === targetId
              ? source
              : field
        ),
      };
    }),
  };
}

export function moveGeneralLayoutItem(
  layout: ConfirmationGeneralLayout,
  source: GeneralLayoutDrag,
  sectionId: string,
  fieldId?: string,
  after = false
): ConfirmationGeneralLayout {
  if (source.kind === "section") {
    if (source.id === sectionId) return layout;
    const section = layout.sections.find((item) => item.id === source.id);
    if (!section) return layout;
    const sections = layout.sections.filter((item) => item.id !== source.id);
    const index = sections.findIndex((item) => item.id === sectionId);
    if (index < 0) return layout;
    sections.splice(index + Number(after), 0, section);
    return { sections };
  }
  if (source.id === fieldId) return layout;
  const field = layout.sections
    .flatMap((section) => section.fields)
    .find((item) => item.id === source.id);
  const target = layout.sections.find((section) => section.id === sectionId);
  if (
    !field ||
    !target ||
    (fieldId && !target.fields.some((item) => item.id === fieldId))
  )
    return layout;
  return {
    sections: layout.sections.map((section) => {
      const fields = section.fields.filter((item) => item.id !== source.id);
      if (section.id === sectionId) {
        const index = fieldId
          ? fields.findIndex((item) => item.id === fieldId)
          : fields.length;
        if (index < 0) return section;
        fields.splice(index + (fieldId ? Number(after) : 0), 0, field);
      }
      return { ...section, fields };
    }),
  };
}
