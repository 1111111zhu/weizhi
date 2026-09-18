"use client";

import { ChevronDownIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export interface ImplementationLibrary {
  package: string;
  sources: string[];
  versions: string[];
}

export interface ImplementationVariant {
  name: string;
  values: string[];
}

export interface ImplementationTraceItem {
  classNameTokens: string[];
  consumers: string[];
  disposition: string;
  file: string;
  id: string;
  imports: string[];
  kind: string;
  libraries: ImplementationLibrary[];
  lifecycle: string;
  name: string;
  public: boolean;
  publicImport: string | null;
  rawStyleCount: number;
  reviewSignalKinds: string[];
  scope: string;
  tokenConflictCount: number;
  variants: ImplementationVariant[];
}

function VariantMatrix({ variants }: { variants: ImplementationVariant[] }) {
  if (variants.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No finite variant API detected.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {variants.map((variant) => (
        <div key={variant.name}>
          <p className="text-xs font-medium text-foreground">{variant.name}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {variant.values.map((value) => (
              <Badge key={value} variant="outline">
                {value}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LibraryMatrix({ libraries }: { libraries: ImplementationLibrary[] }) {
  if (libraries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No external UI dependency detected.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {libraries.map((library) => (
        <div
          className="grid gap-1 sm:grid-cols-[minmax(10rem,0.6fr)_minmax(0,1.4fr)]"
          key={library.package}
        >
          <code className="text-xs font-medium text-foreground">
            {library.package}
          </code>
          <p className="text-xs break-words text-muted-foreground">
            {library.versions.join(", ") || "Workspace range unavailable"}
            <br />
            {library.sources.join(", ")}
          </p>
        </div>
      ))}
    </div>
  );
}

function EvidenceList({
  empty,
  title,
  values,
}: {
  empty: string;
  title: string;
  values: string[];
}) {
  return (
    <div>
      <h4 className="text-sm font-medium text-foreground">
        {title} ({values.length})
      </h4>
      <div className="mt-3 flex max-h-72 flex-col gap-2 overflow-y-auto">
        {values.length ? (
          values.map((value) => (
            <code
              className="text-xs break-all text-muted-foreground"
              key={value}
            >
              {value}
            </code>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </div>
    </div>
  );
}

function EvidenceDisclosure({ item }: { item: ImplementationTraceItem }) {
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button size="sm" variant="ghost">
          Full source, style, and consumer evidence
          <ChevronDownIcon data-icon="inline-end" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 grid gap-6 border-t pt-4 xl:grid-cols-3">
        <EvidenceList
          empty="No class or selector tokens detected."
          title="Class and selector tokens"
          values={item.classNameTokens}
        />
        <EvidenceList
          empty="No imports detected."
          title="Imports"
          values={item.imports}
        />
        <EvidenceList
          empty="No consumers detected."
          title="Consumers"
          values={item.consumers}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

function ImplementationSignals({ item }: { item: ImplementationTraceItem }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant="outline">{item.lifecycle}</Badge>
      <Badge variant="outline">{item.disposition}</Badge>
      <Badge variant="outline">{item.rawStyleCount} raw styles</Badge>
      <Badge variant="outline">{item.tokenConflictCount} token conflicts</Badge>
      {item.reviewSignalKinds.map((kind) => (
        <Badge key={kind} variant="secondary">
          {kind}
        </Badge>
      ))}
    </div>
  );
}

function ImplementationRecord({ item }: { item: ImplementationTraceItem }) {
  return (
    <article className="border-b py-6 first:border-t">
      <div className="flex flex-col gap-5 px-1 sm:px-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-foreground">{item.name}</h3>
            <Badge variant="outline">{item.scope}</Badge>
            <Badge variant="outline">{item.kind}</Badge>
            {item.public ? <Badge variant="secondary">Public API</Badge> : null}
          </div>
          <code className="text-xs break-all text-muted-foreground">
            {item.file}
          </code>
          {item.publicImport ? (
            <p className="text-xs text-muted-foreground">
              Import through <code>{item.publicImport}</code>
            </p>
          ) : null}
          <ImplementationSignals item={item} />
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <div>
            <h4 className="mb-3 text-sm font-medium text-foreground">
              Variants
            </h4>
            <VariantMatrix variants={item.variants} />
          </div>
          <div>
            <h4 className="mb-3 text-sm font-medium text-foreground">
              Dependencies
            </h4>
            <LibraryMatrix libraries={item.libraries} />
          </div>
        </div>
        <EvidenceDisclosure item={item} />
      </div>
    </article>
  );
}

export function ImplementationTrace({
  implementations,
}: {
  implementations: ImplementationTraceItem[];
}) {
  return (
    <div>
      {implementations.map((item) => (
        <ImplementationRecord item={item} key={item.id} />
      ))}
    </div>
  );
}
