"use client";

import type { ReactNode } from "react";

import type { SpecimenSource } from "./specimen-meta";
import { SpecimenSourceLabel } from "./specimen-meta";

type SpecimenSectionProps = {
  id: string;
  title: string;
  description: string;
  source: SpecimenSource;
  children: ReactNode;
  state?: string;
};

export function SpecimenSection({
  id,
  title,
  description,
  source,
  children,
  state,
}: SpecimenSectionProps) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="@container flex flex-col gap-5 rounded-lg border bg-muted/20 p-5"
      id={id}
    >
      <div className="flex flex-col gap-3 @lg:flex-row @lg:items-start @lg:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold" id={`${id}-title`}>
            {title}
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        <SpecimenSourceLabel source={source} />
      </div>
      {state ? (
        <output className="text-xs text-muted-foreground">
          State: {state}
        </output>
      ) : null}
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}
