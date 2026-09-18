import { FoundationSamples } from "@/components/showroom/foundation-samples";
import { MetricStrip } from "@/components/showroom/metric-strip";
import { ShowroomPageHeader } from "@/components/showroom/page-header";
import { TokenExplorer } from "@/components/showroom/token-explorer";
import { Badge } from "@/components/ui/badge";
import {
  getProvenanceInventory,
  getTokenOverview,
} from "@/lib/showroom-provenance.server";

export default function FoundationsPage() {
  const inventory = getProvenanceInventory();
  const tokens = getTokenOverview();

  return (
    <main className="flex flex-col gap-10 pb-16">
      <ShowroomPageHeader
        actions={<Badge variant="outline">Code-derived</Badge>}
        description="Semantic foundations stay readable while the catalog exposes every definition, collision, and raw value back to its source file."
        title="Foundations"
      />
      <MetricStrip
        items={[
          { label: "Definitions", value: tokens.definitionCount },
          { label: "Usages", value: tokens.usageCount },
          { label: "Conflicts", value: tokens.conflictCount },
          { label: "Raw styles", value: tokens.rawValueCount },
        ]}
      />
      <FoundationSamples />
      <section className="flex flex-col gap-5 border-t pt-8">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Token evidence
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Search the complete inventory. Conflicts and raw values remain
            evidence until a reviewer reconciles them with accepted semantic
            roles.
          </p>
        </div>
        <TokenExplorer
          data={{
            conflicts: inventory.tokens.conflicts,
            definitions: inventory.tokens.definitions.map((item) => ({
              ...item,
              selector: item.selector ?? "",
            })),
            rawValues: inventory.tokens.rawValues,
          }}
        />
      </section>
    </main>
  );
}
