"use client";

import {
  Button,
  Checkbox,
  ColorInput,
  DateTimeInput,
  DEFAULT_COLOR_INPUT_VALUE,
  Field,
  FileUpload,
  Grid,
  Input,
  NumberInput,
  Progress,
  RadioGroup,
  SelectionCard,
  Slider,
  Stack,
  Switch,
  Textarea,
  ToggleButton,
} from "@project-wing/ui";
import { useState } from "react";

import { SpecimenSection } from "./specimen-section";

const source = {
  scope: "shared",
  library: "@project-wing/ui",
  detail: "form and choice control contracts",
} as const;
export function FormControlsSpecimen() {
  const [value, setValue] = useState("Draft / 草稿");
  const [choice, setChoice] = useState("a");
  const [checked, setChecked] = useState(false);
  const [number, setNumber] = useState<number | null>(2);
  const [scale, setScale] = useState(40);
  const [date, setDate] = useState("2026-09-13");
  const [color, setColor] = useState(DEFAULT_COLOR_INPUT_VALUE);
  const [files, setFiles] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  return (
    <Stack className="w-full max-w-5xl" gap="lg">
      <SpecimenSection
        id="core-fields"
        title="Field, Input and Textarea"
        description="Visible labels, required fields, existing helper IDs, errors, disabled and read-only values remain programmatically associated."
        source={source}
      >
        <Grid>
          <Field label="Confirmed">
            {(control) => (
              <Checkbox
                {...control}
                checked={checked}
                onCheckedChange={setChecked}
              />
            )}
          </Field>
          <Field label="Disabled confirmation" disabled>
            {(control) => (
              <Checkbox
                {...control}
                checked={checked}
                onCheckedChange={setChecked}
              />
            )}
          </Field>
          <Field
            label="Editable name"
            description="Changes are local to this catalog."
            required
          >
            {(control) => (
              <Input
                {...control}
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            )}
          </Field>
          <Field label="Read-only name" readOnly>
            {(control) => <Input {...control} value={value} />}
          </Field>
          <Field label="Disabled name" disabled>
            {(control) => <Input {...control} value={value} />}
          </Field>
          <Field
            label="Invalid name"
            error="Provide a value before continuing."
          >
            {(control) => <Input {...control} value="" onChange={() => {}} />}
          </Field>
          <Field
            label="Notes"
            description="Long content and line breaks remain editable."
          >
            {(control) => (
              <Textarea
                {...control}
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            )}
          </Field>
          <Field label="Read-only notes" readOnly>
            {(control) => <Textarea {...control} value={value} />}
          </Field>
        </Grid>
      </SpecimenSection>
      <SpecimenSection
        id="core-choices"
        title="Switch, RadioGroup and ToggleButton"
        description="Keyboard selection, native form values and disabled choices use the existing Base UI behavior through project-safe APIs."
        source={source}
        state={choice}
      >
        <Grid>
          <Stack>
            <Switch
              label="Notifications"
              checked={checked}
              onCheckedChange={setChecked}
            />
            <Switch
              label="Read-only notifications"
              checked={checked}
              readOnly
              onCheckedChange={setChecked}
            />
            <Switch
              label="Disabled notifications"
              checked={checked}
              disabled
              onCheckedChange={setChecked}
            />
          </Stack>
          <RadioGroup
            label="Category"
            value={choice}
            onValueChange={setChoice}
            options={[
              { value: "a", label: "Option A / 选项 A" },
              { value: "b", label: "A longer second choice / 较长的第二选项" },
              { value: "c", label: "Unavailable", disabled: true },
            ]}
          />
          <ToggleButton
            label="Compact mode"
            pressed={checked}
            onPressedChange={setChecked}
          />
          <ToggleButton
            label="Unavailable toggle"
            pressed={checked}
            disabled
            onPressedChange={setChecked}
          />
        </Grid>
      </SpecimenSection>
      <SpecimenSection
        id="core-numeric"
        title="NumberInput, Slider and DateTimeInput"
        description="Limits and decimal steps remain controlled. Local date strings are not converted to another timezone."
        source={source}
      >
        <Grid>
          <NumberInput
            label="Hours"
            min={0}
            max={8}
            step={0.5}
            value={number}
            onValueChange={setNumber}
            decrementLabel="Decrease hours"
            incrementLabel="Increase hours"
          />
          <NumberInput
            label="Read-only hours"
            value={number}
            onValueChange={setNumber}
            readOnly
            decrementLabel="Decrease read-only hours"
            incrementLabel="Increase read-only hours"
          />
          <Slider
            label="Scale"
            value={scale}
            onValueChange={setScale}
            step={10}
          />
          <Slider
            label="Disabled scale"
            value={scale}
            onValueChange={setScale}
            disabled
          />
          <Field label="Date">
            {(control) => (
              <DateTimeInput
                {...control}
                value={date}
                onValueChange={setDate}
              />
            )}
          </Field>
          <Field label="Read-only date" readOnly>
            {(control) => (
              <DateTimeInput
                {...control}
                value={date}
                onValueChange={setDate}
              />
            )}
          </Field>
          <Field label="Document color">
            {(control) => (
              <ColorInput {...control} value={color} onValueChange={setColor} />
            )}
          </Field>
        </Grid>
      </SpecimenSection>
      <SpecimenSection
        id="core-files"
        title="FileUpload and Progress"
        description="Files stay in the browser. This example reports selection and simulated progress without uploading any content."
        source={source}
        state={files.join(", ") || "No files selected"}
      >
        <FileUpload
          label="Evidence files"
          multiple
          onFilesChange={(next) => setFiles(next.map((file) => file.name))}
          loading={uploading}
          progress={uploading ? 40 : undefined}
        />
        <FileUpload
          label="Invalid selection"
          error="Select a supported document."
          onFilesChange={() => {}}
        />
        <Button variant="outline" onClick={() => setUploading(!uploading)}>
          {uploading ? "End simulated progress" : "Show simulated progress"}
        </Button>
        <Progress label="Indeterminate progress" />
        <Progress label="Completed progress" value={100} />
      </SpecimenSection>
      <SpecimenSection
        id="core-selection-cards"
        title="SelectionCard"
        description="A selectable card is a native button with controlled pressed state. Ordinary content cards do not invent click behavior."
        source={source}
      >
        <Grid columns={3}>
          <SelectionCard
            label="First option"
            description="Keyboard and pointer activation"
            selected={choice === "a"}
            onSelectedChange={() => setChoice("a")}
          />
          <SelectionCard
            label="Second option"
            description="A long localized description / 中文说明保持可读"
            selected={choice === "b"}
            onSelectedChange={() => setChoice("b")}
          />
          <SelectionCard
            label="Unavailable option"
            selected={false}
            disabled
            onSelectedChange={() => {}}
          />
        </Grid>
      </SpecimenSection>
    </Stack>
  );
}
