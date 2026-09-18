"use client";

import { Button, Input } from "@project-wing/ui";
import { useState } from "react";

import { SpecimenSection } from "./specimen-section";

function InputStates() {
  const [value, setValue] = useState("");
  const isValid = value.trim().length > 2;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="specimen-input-value">
          Project name
        </label>
        <Input
          aria-describedby="specimen-input-hint"
          aria-invalid={value.length > 0 && !isValid}
          id="specimen-input-value"
          onChange={(event) => setValue(event.target.value)}
          placeholder="Enter a project name"
          value={value}
        />
        <output
          className="text-xs text-muted-foreground"
          id="specimen-input-hint"
        >
          {isValid ? "Looks good." : "Use at least three characters."}
        </output>
      </div>
      <div className="flex flex-col gap-2">
        <label
          className="text-sm font-medium"
          htmlFor="specimen-input-disabled"
        >
          Read-only state
        </label>
        <Input
          disabled
          id="specimen-input-disabled"
          value="Inherited project setting"
          readOnly
        />
        <Button onClick={() => setValue("")} size="sm" variant="quiet">
          Clear editable value
        </Button>
      </div>
    </div>
  );
}

export function InputSpecimen() {
  return (
    <SpecimenSection
      description="The shared input contract with labelled editing, validation feedback, placeholder, and disabled states."
      id="input-specimen"
      source={{ scope: "shared", library: "@project-wing/ui", detail: "Input" }}
      title="Input"
    >
      <InputStates />
    </SpecimenSection>
  );
}
