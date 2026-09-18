"use client";

import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";

export type SpecimenSourceScope = "shared" | "showroom" | "unsupported";

export type SpecimenSource = {
  scope: SpecimenSourceScope;
  library: string;
  detail?: string;
};

const scopeLabels: Record<SpecimenSourceScope, string> = {
  shared: "shared design system",
  showroom: "showroom wrapper",
  unsupported: "unsupported",
};

function scopeVariant(scope: SpecimenSourceScope) {
  if (scope === "unsupported") {
    return "destructive" as const;
  }
  if (scope === "shared") {
    return "secondary" as const;
  }
  return "outline" as const;
}

export function SpecimenSourceLabel({ source }: { source: SpecimenSource }) {
  return (
    <div
      aria-label={`Source: ${scopeLabels[source.scope]}, ${source.library}`}
      className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
    >
      <span>Source</span>
      <Badge variant={scopeVariant(source.scope)}>
        {scopeLabels[source.scope]}
      </Badge>
      <span>{source.library}</span>
      {source.detail ? <span>· {source.detail}</span> : null}
    </div>
  );
}

export function UnsupportedSpecimen({
  name,
  reason,
}: {
  name: string;
  reason: string;
}) {
  return (
    <div
      aria-label={`${name} unsupported specimen`}
      className="flex flex-col gap-2 rounded-lg border border-dashed p-4 text-sm"
      role="note"
    >
      <SpecimenSourceLabel
        source={{
          scope: "unsupported",
          library: name,
          detail: "no safe import",
        }}
      />
      <p className="text-muted-foreground">{reason}</p>
    </div>
  );
}

export function SpecimenNote({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}
