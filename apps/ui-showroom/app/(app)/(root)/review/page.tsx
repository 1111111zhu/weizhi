import { ShieldAlertIcon } from "lucide-react";

import { MetricStrip } from "@/components/showroom/metric-strip";
import { ShowroomPageHeader } from "@/components/showroom/page-header";
import { ReviewQueue } from "@/components/showroom/review-queue";
import { ReviewSignalList } from "@/components/showroom/review-signal-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  getProvenanceIdentity,
  getReviewSignals,
} from "@/lib/showroom-provenance.server";
import { getReviewQueueItems } from "@/lib/showroom-review-queue.server";

type ReviewItems = ReturnType<typeof getReviewQueueItems>;
type ReviewSignals = ReturnType<typeof getReviewSignals>;
type ProvenanceIdentity = ReturnType<typeof getProvenanceIdentity>;

function InventoryIdentity({ identity }: { identity: ProvenanceIdentity }) {
  return (
    <div
      aria-label="Review inventory identity"
      className="grid gap-3 border-y py-4 text-xs sm:grid-cols-2"
    >
      <p className="min-w-0 text-muted-foreground">
        Source revision{" "}
        <code className="break-all text-foreground">
          {identity.sourceRevision ?? "unversioned"}
        </code>
      </p>
      <p className="min-w-0 text-muted-foreground sm:text-right">
        Inventory SHA-256{" "}
        <code className="break-all text-foreground">
          {identity.inventoryHash}
        </code>
      </p>
    </div>
  );
}

function createReviewMetrics(items: ReviewItems, signals: ReviewSignals) {
  const debtCount = items.filter(
    (item) => item.suggestedDisposition === "technical-debt"
  ).length;
  const unresolvedImports =
    signals.find((signal) => signal.kind === "unresolved-import")?.count ?? 0;

  return [
    { label: "Implementations", value: items.length },
    { label: "Suggested debt", value: debtCount },
    { label: "Review signals", value: signals.length },
    { label: "Unresolved imports", value: unresolvedImports },
  ];
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ family?: string }>;
}) {
  const { family } = await searchParams;
  const items = getReviewQueueItems();
  const identity = getProvenanceIdentity();
  const signals = getReviewSignals();

  return (
    <main className="flex flex-col gap-10 pb-16">
      <ShowroomPageHeader
        actions={<Badge variant="outline">Local review workspace</Badge>}
        description="Triage traced implementations without silently accepting them. Keep strong candidates, mark migration debt, or reject aesthetic regressions."
        title="Review"
      />
      <Alert>
        <ShieldAlertIcon />
        <AlertTitle>Review decisions do not approve the system</AlertTitle>
        <AlertDescription>
          Suggested debt is evidence-based. Human decisions remain local until
          the exported packet is reviewed and committed through governance. Each
          packet is bound to the exact inventory hash.
        </AlertDescription>
      </Alert>
      <InventoryIdentity identity={identity} />
      <MetricStrip items={createReviewMetrics(items, signals)} />
      <ReviewSignalList signals={signals} />
      <section className="flex flex-col gap-5 border-t pt-8">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Implementation queue
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Candidate, Debt, and Reject are explicit reviewer choices. Rejected
            records stay visible so cleanup work remains traceable.
          </p>
        </div>
        <ReviewQueue
          identity={identity}
          initialFamily={family ?? ""}
          items={items}
        />
      </section>
    </main>
  );
}
