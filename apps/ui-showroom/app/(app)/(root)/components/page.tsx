import { FamilyExplorer } from "@/components/showroom/family-explorer";
import type { FamilyListItem } from "@/components/showroom/family-explorer";
import { MetricStrip } from "@/components/showroom/metric-strip";
import { ShowroomPageHeader } from "@/components/showroom/page-header";
import { hasInteractiveSpecimen } from "@/components/showroom/specimens/specimen-families";
import { Badge } from "@/components/ui/badge";
import {
  getFamilySummaries,
  getProvenanceOverview,
} from "@/lib/showroom-provenance.server";

function familyListItems(): FamilyListItem[] {
  return getFamilySummaries().map((family) => ({
    implementations: family.implementationCount,
    interactive: hasInteractiveSpecimen(family.name),
    kinds: family.kinds,
    name: family.name,
    publicImplementations: family.publicImplementationCount,
    scopes: family.scopes,
  }));
}

export default function ComponentsPage() {
  const overview = getProvenanceOverview();
  const items = familyListItems();

  return (
    <main className="flex flex-col gap-10 pb-16">
      <ShowroomPageHeader
        actions={
          <Badge variant="outline">{items.length} traced families</Badge>
        }
        description="A source-first component catalog. Similar names are grouped as families without hiding application forks, registry copies, or custom variants."
        title="Components"
      />
      <MetricStrip
        items={[
          { label: "Families", value: overview.familyCount },
          { label: "Implementations", value: overview.summary.implementations },
          { label: "Public APIs", value: overview.publicImplementationCount },
          {
            label: "Interactive specimens",
            value: items.filter((item) => item.interactive).length,
          },
        ]}
      />
      <FamilyExplorer items={items} />
    </main>
  );
}
