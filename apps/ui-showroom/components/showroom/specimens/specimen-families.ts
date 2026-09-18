export const interactiveSpecimenFamilies = [
  "GuidedForm",
  "Settings",
  "Color",
  "DataWorkbench",
  "Button",
  "Badge",
  "Input",
  "Dialog",
  "ContextMenu",
  "Tabs",
  "Tooltip",
  "FormControls",
  "Field",
  "Textarea",
  "FileUpload",
  "FileInput",
  "DateTimeInput",
  "ColorInput",
  "NumberInput",
  "Switch",
  "RadioGroup",
  "Slider",
  "ToggleButton",
  "SelectionCard",
  "Progress",
  "LayoutPrimitives",
  "Surface",
  "Container",
  "Stack",
  "Inline",
  "Grid",
  "Card",
  "DescriptionList",
  "SectionHeader",
  "FilterBar",
  "ListPageLayout",
  "DetailPageLayout",
  "FormPageLayout",
] as const;

export type SpecimenFamily = (typeof interactiveSpecimenFamilies)[number];

const interactiveFamilies = new Set<string>(interactiveSpecimenFamilies);

export function hasInteractiveSpecimen(family: string) {
  return interactiveFamilies.has(family);
}
