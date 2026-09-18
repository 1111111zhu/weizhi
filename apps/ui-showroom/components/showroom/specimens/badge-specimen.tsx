"use client";

import { Badge, Button } from "@project-wing/ui";
import { useState } from "react";

import { SpecimenSection } from "./specimen-section";

const badgeVariants = [
  "default",
  "secondary",
  "info",
  "success",
  "warning",
  "destructive",
  "outline",
] as const;

function BadgeVariants() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {badgeVariants.map((variant) => (
        <Badge key={variant} size="sm" variant={variant}>
          {variant}
        </Badge>
      ))}
    </div>
  );
}

function BadgeState() {
  const [active, setActive] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge radius="full" variant={active ? "success" : "secondary"}>
        {active ? "Published" : "Draft"}
      </Badge>
      <Button
        onClick={() => setActive((value) => !value)}
        size="sm"
        variant="outline"
      >
        Toggle status
      </Button>
    </div>
  );
}

export function BadgeSpecimen() {
  return (
    <SpecimenSection
      description="Shared status labels with semantic variants, compact sizes, and a live state transition."
      id="badge-specimen"
      source={{ scope: "shared", library: "@project-wing/ui", detail: "Badge" }}
      title="Badge"
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Variants</p>
        <BadgeVariants />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Interactive status</p>
        <BadgeState />
      </div>
    </SpecimenSection>
  );
}
