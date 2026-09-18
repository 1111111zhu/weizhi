"use client";

import { Button, ButtonGroup, IconButton } from "@project-wing/ui";
import {
  ArrowRightIcon,
  CheckIcon,
  LoaderCircleIcon,
  PlusIcon,
} from "lucide-react";
import { useState } from "react";

import { SpecimenSection } from "./specimen-section";

const variants = [
  "primary",
  "secondary",
  "outline",
  "quiet",
  "danger",
  "success",
  "warning",
  "success-light",
  "warning-light",
] as const;
const sizes = ["xs", "sm", "md", "lg"] as const;

function ButtonVariants() {
  return (
    <ButtonGroup className="flex-wrap">
      {variants.map((variant) => (
        <Button key={variant} size="sm" variant={variant}>
          {variant}
        </Button>
      ))}
    </ButtonGroup>
  );
}

function ButtonSizes() {
  return (
    <ButtonGroup className="flex-wrap">
      {sizes.map((size) => (
        <Button key={size} size={size} variant="outline">
          {size}
        </Button>
      ))}
    </ButtonGroup>
  );
}

function ButtonStates() {
  const [loading, setLoading] = useState(false);
  const runLoading = () => {
    setLoading(true);
    window.setTimeout(() => setLoading(false), 900);
  };

  return (
    <ButtonGroup className="flex-wrap">
      <Button
        iconEnd={<ArrowRightIcon data-icon="inline-end" />}
        onClick={runLoading}
        variant="primary"
      >
        Save changes
      </Button>
      <Button
        disabled
        iconStart={<CheckIcon data-icon="inline-start" />}
        variant="secondary"
      >
        Disabled
      </Button>
      <Button
        iconStart={
          <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
        }
        loading={loading}
        loadingLabel="Saving"
        onClick={runLoading}
        variant="outline"
      >
        Loading
      </Button>
      <IconButton icon={<PlusIcon />} label="Add" size="icon" variant="quiet" />
    </ButtonGroup>
  );
}

export function ButtonSpecimen() {
  return (
    <SpecimenSection
      description="The public shared Button contract, including semantic variants, sizes, icons, disabled, and loading states."
      id="button-specimen"
      source={{
        scope: "shared",
        library: "@project-wing/ui",
        detail: "Button",
      }}
      title="Button"
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Variants</p>
        <ButtonVariants />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Sizes</p>
        <ButtonSizes />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">States and affordances</p>
        <ButtonStates />
      </div>
    </SpecimenSection>
  );
}
