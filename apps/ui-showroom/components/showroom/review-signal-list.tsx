import { ChevronDownIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ReviewSignal } from "@/lib/showroom-provenance.server";

const severityVariant = {
  high: "destructive",
  low: "outline",
  medium: "secondary",
} as const;

export function ReviewSignalList({ signals }: { signals: ReviewSignal[] }) {
  const visibleSignals = signals.slice(0, 8);
  const additionalSignals = signals.slice(8);

  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Review signals
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Machine-detected evidence routes work into review; it never grants
            aesthetic approval.
          </p>
        </div>
        <Badge variant="outline">{signals.length} signals</Badge>
      </div>
      <div className="mt-4 border-t">
        <SignalRows signals={visibleSignals} />
        {additionalSignals.length > 0 ? (
          <Collapsible>
            <CollapsibleContent>
              <SignalRows signals={additionalSignals} />
            </CollapsibleContent>
            <CollapsibleTrigger asChild>
              <Button className="mt-3" size="sm" variant="ghost">
                Show {additionalSignals.length} additional signals
                <ChevronDownIcon data-icon="inline-end" />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        ) : null}
      </div>
    </section>
  );
}

function SignalRows({ signals }: { signals: ReviewSignal[] }) {
  return signals.map((signal) => (
    <article
      className="grid gap-3 border-b py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      key={signal.id}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium text-foreground">{signal.title}</h3>
          <Badge variant={severityVariant[signal.severity]}>
            {signal.severity}
          </Badge>
        </div>
        <SignalEvidence signal={signal} />
      </div>
      <p className="text-sm text-muted-foreground tabular-nums">
        {signal.count} records · {signal.files.length} files
      </p>
    </article>
  ));
}

function EvidenceValues({
  label,
  values,
}: {
  label: string;
  values: string[];
}) {
  if (values.length === 0) {
    return null;
  }
  return (
    <div>
      <p className="text-xs font-medium text-foreground">{label}</p>
      <div className="mt-1 max-h-28 space-y-1 overflow-y-auto">
        {values.map((value) => (
          <code
            className="block text-xs break-all text-muted-foreground"
            key={value}
          >
            {value}
          </code>
        ))}
      </div>
    </div>
  );
}

function SignalEvidence({ signal }: { signal: ReviewSignal }) {
  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-3">
      <EvidenceValues label="Evidence" values={signal.evidence} />
      <EvidenceValues label="Source files" values={signal.files} />
      <EvidenceValues
        label="Implementations"
        values={signal.implementationIds}
      />
    </div>
  );
}
