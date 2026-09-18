"use client";

import { ButtonGroup } from "@project-wing/ui";

import type {
  ReviewDecision,
  ReviewQueueItem,
} from "@/components/showroom/review-queue.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function decisionVariant(disposition: ReviewDecision) {
  if (disposition === "reject") {
    return "destructive" as const;
  }
  if (disposition === "candidate") {
    return "secondary" as const;
  }
  return "outline" as const;
}

function ReviewActionGroup({
  current,
  onChange,
}: {
  current: ReviewDecision;
  onChange: (decision: ReviewDecision) => void;
}) {
  return (
    <ButtonGroup aria-label="Review disposition">
      {[
        ["candidate", "Candidate"],
        ["technical-debt", "Debt"],
        ["reject", "Reject"],
      ].map(([decision, label]) => (
        <Button
          aria-pressed={current === decision}
          key={decision}
          onClick={() => onChange(decision as ReviewDecision)}
          size="sm"
          variant={current === decision ? "secondary" : "outline"}
        >
          {label}
        </Button>
      ))}
    </ButtonGroup>
  );
}

export function ReviewRow({
  decision,
  item,
  onChange,
}: {
  decision: ReviewDecision;
  item: ReviewQueueItem;
  onChange: (decision: ReviewDecision) => void;
}) {
  return (
    <article className="grid gap-4 border-b px-1 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:px-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium text-foreground">{item.family}</h3>
          <Badge variant={decisionVariant(decision)}>{decision}</Badge>
          <Badge variant="outline">{item.scope}</Badge>
          <Badge variant="outline">{item.kind}</Badge>
        </div>
        <p className="mt-2 font-mono text-xs break-all text-muted-foreground">
          {item.file}#{item.name}
        </p>
        <div className="mt-3 flex flex-col gap-1.5 text-sm text-muted-foreground">
          {item.reasons.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
          {item.replacement ? (
            <p>
              <span className="font-medium text-foreground">Replacement:</span>{" "}
              {item.replacement}
            </p>
          ) : null}
        </div>
        {item.libraries.length > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Libraries: {item.libraries.join(", ")}
          </p>
        ) : null}
      </div>
      <ReviewActionGroup current={decision} onChange={onChange} />
    </article>
  );
}
