"use client";

import { ClipboardCheckIcon, ClipboardIcon, SearchIcon } from "lucide-react";

import { ReviewRow } from "@/components/showroom/review-queue-row";
import {
  nextReviewPageSize,
  useReviewQueueState,
} from "@/components/showroom/review-queue-state";
import type { ResolvedReviewItem } from "@/components/showroom/review-queue-state";
import type {
  ReviewDecision,
  ReviewInventoryIdentity,
  ReviewQueueItem,
} from "@/components/showroom/review-queue.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type { ReviewDecision, ReviewQueueItem } from "./review-queue.types";

function ReviewFilterTabs({
  filter,
  onChange,
}: {
  filter: ReviewDecision | "all";
  onChange: (value: ReviewDecision | "all") => void;
}) {
  return (
    <Tabs
      onValueChange={(value) => onChange(value as ReviewDecision | "all")}
      value={filter}
    >
      <TabsList>
        <TabsTrigger value="all">All</TabsTrigger>
        <TabsTrigger value="unreviewed">Unreviewed</TabsTrigger>
        <TabsTrigger value="candidate">Candidates</TabsTrigger>
        <TabsTrigger value="technical-debt">Debt</TabsTrigger>
        <TabsTrigger value="reject">Rejected</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function ReviewToolbar({
  copied,
  filter,
  onCopy,
  onFilterChange,
  onQueryChange,
  query,
}: {
  copied: boolean;
  filter: ReviewDecision | "all";
  onCopy: () => void;
  onFilterChange: (value: ReviewDecision | "all") => void;
  onQueryChange: (value: string) => void;
  query: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <ReviewFilterTabs filter={filter} onChange={onFilterChange} />
        <Button onClick={onCopy} variant="outline">
          {copied ? (
            <ClipboardCheckIcon data-icon="inline-start" />
          ) : (
            <ClipboardIcon data-icon="inline-start" />
          )}
          {copied ? "Review packet copied" : "Copy review packet"}
        </Button>
      </div>
      <div className="relative w-full xl:max-w-md">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <label className="sr-only" htmlFor="review-search">
          Search review queue
        </label>
        <Input
          className="pl-9"
          id="review-search"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search family, source, scope, or library"
          value={query}
        />
      </div>
    </div>
  );
}

function ReviewRows({
  items,
  onDecision,
}: {
  items: ResolvedReviewItem[];
  onDecision: (id: string, decision: ReviewDecision) => void;
}) {
  return (
    <div className="border-t">
      {items.map(({ decision, item }) => (
        <ReviewRow
          decision={decision}
          item={item}
          key={item.id}
          onChange={(next) => onDecision(item.id, next)}
        />
      ))}
    </div>
  );
}

function LoadMoreReviews({
  count,
  onLoad,
}: {
  count: number;
  onLoad: () => void;
}) {
  if (count === 0) {
    return null;
  }
  return (
    <Button className="self-start" onClick={onLoad} variant="outline">
      Load {nextReviewPageSize(count)} more
    </Button>
  );
}

export function ReviewQueue({
  identity,
  initialFamily = "",
  items,
}: {
  identity: ReviewInventoryIdentity;
  initialFamily?: string;
  items: ReviewQueueItem[];
}) {
  const view = useReviewQueueState({
    identity,
    initialFamily,
    items,
  });

  return (
    <div className="flex flex-col gap-5">
      <ReviewToolbar
        copied={view.copied}
        filter={view.filter}
        onCopy={view.handleCopyReviewPacket}
        onFilterChange={view.handleFilterChange}
        onQueryChange={view.handleQueryChange}
        query={view.query}
      />
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {view.visibleCount} records in this view. Decisions stay local until the
        exported packet is reviewed and committed.
      </p>
      <ReviewRows items={view.visible} onDecision={view.handleDecision} />
      <LoadMoreReviews
        count={view.remainingCount}
        onLoad={view.handleLoadMore}
      />
    </div>
  );
}
