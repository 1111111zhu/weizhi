import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";

import { DimensionList } from "@/components/showroom/dimension-list";
import { MetricStrip } from "@/components/showroom/metric-strip";
import { ShowroomPageHeader } from "@/components/showroom/page-header";
import { Badge } from "@/components/ui/badge";
import { ROUTES } from "@/constants/routes";
import { getProvenanceOverview } from "@/lib/showroom-provenance.server";

const entryPoints = [
  {
    description:
      "Inspect semantic tokens, conflicts, and every raw style source.",
    href: ROUTES.FOUNDATIONS,
    label: "Foundations",
  },
  {
    description:
      "Trace every detected family, implementation, variant, and consumer.",
    href: ROUTES.COMPONENTS,
    label: "Components",
  },
  {
    description:
      "Route unapproved implementations to candidate, debt, or rejection.",
    href: ROUTES.REVIEW,
    label: "Review",
  },
] as const;

type ProvenanceOverview = ReturnType<typeof getProvenanceOverview>;

function createOverviewMetrics(overview: ProvenanceOverview) {
  return [
    { label: "Implementations", value: overview.summary.implementations },
    { label: "Families", value: overview.summary.families },
    { label: "Consumers", value: overview.summary.consumers },
    { label: "Token conflicts", value: overview.summary.tokenConflicts },
  ];
}

function EntryPointGrid() {
  return (
    <section className="grid gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-3">
      {entryPoints.map((entry) => (
        <Link
          className="group flex min-h-44 flex-col justify-between bg-background p-5 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
          href={entry.href}
          key={entry.href}
        >
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {entry.label}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {entry.description}
            </p>
          </div>
          <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
            Open catalog
            <ArrowUpRightIcon
              aria-hidden="true"
              className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </span>
        </Link>
      ))}
    </section>
  );
}

function EvidenceDimensions({ overview }: { overview: ProvenanceOverview }) {
  return (
    <section className="grid gap-8 xl:grid-cols-3">
      <DimensionList
        items={overview.scopes.slice(0, 12).map((item) => ({
          label: item.value,
          publicCount: item.publicImplementationCount,
          value: item.implementationCount,
        }))}
        title="Implementation scopes"
      />
      <DimensionList
        items={overview.kinds.slice(0, 12).map((item) => ({
          label: item.value,
          publicCount: item.publicImplementationCount,
          value: item.implementationCount,
        }))}
        title="Source kinds"
      />
      <DimensionList
        items={overview.libraries.slice(0, 12).map((item) => ({
          detail: item.versions.join(", ") || "Workspace range",
          label: item.value,
          publicCount: item.publicImplementationCount,
          value: item.implementationCount,
        }))}
        title="UI dependencies"
      />
    </section>
  );
}

export default function OverviewPage() {
  const overview = getProvenanceOverview();

  return (
    <main className="flex flex-col gap-10 pb-16">
      <ShowroomPageHeader
        actions={<Badge variant="outline">Aesthetic status: unreviewed</Badge>}
        description="A code-derived workbench for tracing Project Wing UI, comparing real variants, and governing what returns to the accepted system."
        title="Design system evidence"
      />
      <MetricStrip items={createOverviewMetrics(overview)} />
      <EntryPointGrid />
      <EvidenceDimensions overview={overview} />
    </main>
  );
}
