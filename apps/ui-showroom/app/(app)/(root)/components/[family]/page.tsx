import { ArrowLeftIcon, ScaleIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ImplementationTrace } from "@/components/showroom/implementation-trace";
import { MetricStrip } from "@/components/showroom/metric-strip";
import { ShowroomPageHeader } from "@/components/showroom/page-header";
import { SpecimenFrame } from "@/components/showroom/specimen-frame";
import { hasInteractiveSpecimen } from "@/components/showroom/specimens/specimen-families";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { getFamilyDetail } from "@/lib/showroom-provenance.server";

type FamilyDetail = NonNullable<ReturnType<typeof getFamilyDetail>>;

function createFamilyMetrics(detail: FamilyDetail) {
  return [
    { label: "Implementations", value: detail.family.implementationCount },
    { label: "Public APIs", value: detail.family.publicImplementationCount },
    { label: "Consumers", value: detail.consumerFiles.length },
    {
      label: "Raw styles",
      value: detail.implementations.reduce(
        (total, item) => total + item.rawStyleCount,
        0
      ),
    },
    {
      label: "Token conflicts",
      value: detail.implementations.reduce(
        (total, item) => total + item.tokenConflictCount,
        0
      ),
    },
    { label: "Review signals", value: detail.family.reviewSignalKinds.length },
  ];
}

function FamilyBackLink() {
  return (
    <Link
      className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      href={ROUTES.COMPONENTS}
    >
      <ArrowLeftIcon aria-hidden="true" className="size-4" />
      All component families
    </Link>
  );
}

function FamilyHeader({ detail }: { detail: FamilyDetail }) {
  const reviewUrl = `${ROUTES.REVIEW}?family=${encodeURIComponent(detail.family.name)}`;

  return (
    <ShowroomPageHeader
      actions={
        <Button asChild variant="outline">
          <Link href={reviewUrl}>
            <ScaleIcon data-icon="inline-start" />
            Review evidence
          </Link>
        </Button>
      }
      description="Every detected implementation remains separate below, including its source scope, variant API, UI dependencies, style tokens, and consumers."
      title={detail.family.name}
    />
  );
}

function FamilySpecimen({ detail }: { detail: FamilyDetail }) {
  const interactive = hasInteractiveSpecimen(detail.family.name);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Specimen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The isolated preview prevents catalog chrome from changing the
            displayed component.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {detail.family.libraries.map((library) => (
            <Badge key={library} variant="outline">
              {library}
            </Badge>
          ))}
        </div>
      </div>
      {interactive ? (
        <SpecimenFrame family={detail.family.name} />
      ) : (
        <Alert>
          <AlertTitle>No fabricated preview</AlertTitle>
          <AlertDescription>
            This family has no verified safe specimen import yet. Its complete
            code provenance remains available below.
          </AlertDescription>
        </Alert>
      )}
    </section>
  );
}

function toTraceItem(item: FamilyDetail["implementations"][number]) {
  return {
    classNameTokens: item.classNameTokens,
    consumers: item.consumers,
    disposition: item.disposition,
    file: item.file,
    id: item.id,
    imports: item.imports,
    kind: item.kind ?? "unknown",
    libraries: item.libraries,
    lifecycle: item.lifecycle,
    name: item.name,
    public: item.public,
    publicImport: item.publicImport,
    rawStyleCount: item.rawStyleCount,
    reviewSignalKinds: item.reviewSignalKinds,
    scope: item.scope ?? "unknown",
    tokenConflictCount: item.tokenConflictCount,
    variants: item.variants,
  };
}

function FamilyProvenance({ detail }: { detail: FamilyDetail }) {
  return (
    <section>
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-foreground">
          Implementation provenance
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {detail.consumerFiles.length} unique consumer files traced across the
          family.
        </p>
      </div>
      <ImplementationTrace
        implementations={detail.implementations.map(toTraceItem)}
      />
    </section>
  );
}

function ComponentFamilyContent({ detail }: { detail: FamilyDetail }) {
  return (
    <main className="flex flex-col gap-10 pb-16">
      <FamilyBackLink />
      <FamilyHeader detail={detail} />
      <MetricStrip items={createFamilyMetrics(detail)} />
      <FamilySpecimen detail={detail} />
      <FamilyProvenance detail={detail} />
    </main>
  );
}

export default async function ComponentFamilyPage({
  params,
}: {
  params: Promise<{ family: string }>;
}) {
  const { family } = await params;
  const detail = getFamilyDetail(family);
  if (!detail) {
    notFound();
  }
  return <ComponentFamilyContent detail={detail} />;
}
