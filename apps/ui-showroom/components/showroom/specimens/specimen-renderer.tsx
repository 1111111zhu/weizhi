"use client";

import { BadgeSpecimen } from "./badge-specimen";
import { ButtonSpecimen } from "./button-specimen";
import { ColorSpecimen } from "./color-specimen";
import { ContextMenuSpecimen } from "./context-menu-specimen";
import { DataWorkbenchSpecimen } from "./data-workbench-specimen";
import { DialogSpecimen } from "./dialog-specimen";
import { FormControlsSpecimen } from "./form-controls-specimen";
import { GuidedFormSpecimen } from "./guided-form-specimen";
import { InputSpecimen } from "./input-specimen";
import { LayoutPrimitivesSpecimen } from "./layout-primitives-specimen";
import { SettingsSpecimen } from "./settings-specimen";
import { SpecimenSourceLabel, UnsupportedSpecimen } from "./specimen-meta";
import { SpecimenSection } from "./specimen-section";
import { TabsSpecimen } from "./tabs-specimen";
import { TooltipSpecimen } from "./tooltip-specimen";

export { hasInteractiveSpecimen } from "./specimen-families";

function UnsupportedFamily({ family }: { family: string }) {
  return (
    <UnsupportedSpecimen
      name={family}
      reason="This family has no safe shared or showroom wrapper import yet; the renderer intentionally does not fabricate an implementation."
    />
  );
}

export function SpecimenRenderer({ family }: { family: string }) {
  switch (family) {
    case "FormControls":
    case "Field":
    case "Textarea":
    case "FileUpload":
    case "FileInput":
    case "DateTimeInput":
    case "ColorInput":
    case "NumberInput":
    case "Switch":
    case "RadioGroup":
    case "Slider":
    case "ToggleButton":
    case "SelectionCard":
    case "Progress": {
      return <FormControlsSpecimen />;
    }
    case "LayoutPrimitives":
    case "Surface":
    case "Container":
    case "Stack":
    case "Inline":
    case "Grid":
    case "Card":
    case "DescriptionList":
    case "SectionHeader":
    case "FilterBar":
    case "ListPageLayout":
    case "DetailPageLayout":
    case "FormPageLayout": {
      return <LayoutPrimitivesSpecimen />;
    }
    case "GuidedForm": {
      return <GuidedFormSpecimen />;
    }
    case "Settings": {
      return <SettingsSpecimen />;
    }
    case "Color": {
      return <ColorSpecimen />;
    }
    case "DataWorkbench": {
      return <DataWorkbenchSpecimen />;
    }
    case "Button": {
      return <ButtonSpecimen />;
    }
    case "Badge": {
      return <BadgeSpecimen />;
    }
    case "Input": {
      return <InputSpecimen />;
    }
    case "Dialog": {
      return <DialogSpecimen />;
    }
    case "ContextMenu": {
      return <ContextMenuSpecimen />;
    }
    case "Tabs": {
      return <TabsSpecimen />;
    }
    case "Tooltip": {
      return <TooltipSpecimen />;
    }
    default: {
      return <UnsupportedFamily family={family} />;
    }
  }
}

export function SpecimenRendererSource() {
  return (
    <SpecimenSection
      description="Renderer entries use the inventory family name and preserve the source boundary for every specimen."
      id="specimen-renderer-source"
      source={{
        scope: "shared",
        library: "specimen renderer",
        detail: "source-aware",
      }}
      title="Source-aware renderer"
    >
      <SpecimenSourceLabel
        source={{
          scope: "shared",
          library: "@project-wing/ui",
          detail: "Button, Badge, Input",
        }}
      />
      <SpecimenSourceLabel
        source={{
          scope: "showroom",
          library: "local shadcn wrappers",
          detail: "Dialog, ContextMenu, Tabs, Tooltip",
        }}
      />
    </SpecimenSection>
  );
}
