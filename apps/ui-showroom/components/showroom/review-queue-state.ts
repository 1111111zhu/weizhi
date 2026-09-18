/* eslint-disable react/set-state-in-effect -- decisions are hydrated from localStorage after mount. */

"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";

import type {
  ReviewDecision,
  ReviewInventoryIdentity,
  ReviewQueueItem,
} from "@/components/showroom/review-queue.types";

export interface ResolvedReviewItem {
  decision: ReviewDecision;
  item: ReviewQueueItem;
}

interface StoredDecision {
  disposition: ReviewDecision;
  reviewedAt: string;
}

interface ReviewQueueStateOptions {
  identity: ReviewInventoryIdentity;
  initialFamily: string;
  items: ReviewQueueItem[];
}

const STORAGE_PREFIX = "project-wing-showroom-review-v2";
const PAGE_SIZE = 60;

function storageKey(identity: ReviewInventoryIdentity) {
  return `${STORAGE_PREFIX}:${identity.inventoryHash}`;
}

function readStoredDecisions(key: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "{}");
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, StoredDecision>)
      : {};
  } catch {
    return {};
  }
}

function matchesQuery(item: ReviewQueueItem, query: string) {
  if (!query) {
    return true;
  }
  return [
    item.family,
    item.name,
    item.file,
    item.scope,
    item.kind,
    ...item.libraries,
  ].some((value) => value.toLocaleLowerCase().includes(query));
}

function resolveReviewItems({
  decisions,
  familyScope,
  filter,
  items,
  query,
}: {
  decisions: Record<string, StoredDecision>;
  familyScope: string;
  filter: ReviewDecision | "all";
  items: ReviewQueueItem[];
  query: string;
}) {
  return items
    .map((item) => ({
      decision: decisions[item.id]?.disposition ?? item.suggestedDisposition,
      item,
    }))
    .filter(
      ({ decision, item }) =>
        (filter === "all" || decision === filter) &&
        (familyScope ? item.family === familyScope : matchesQuery(item, query))
    );
}

function useStoredReviewDecisions(identity: ReviewInventoryIdentity) {
  const [copied, setCopied] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, StoredDecision>>(
    {}
  );
  const [hydrated, setHydrated] = useState(false);
  const key = storageKey(identity);

  useEffect(() => {
    setDecisions(readStoredDecisions(key));
    setHydrated(true);
  }, [key]);
  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(key, JSON.stringify(decisions));
    }
  }, [decisions, hydrated, key]);

  function handleDecision(id: string, disposition: ReviewDecision) {
    setCopied(false);
    setDecisions((current) => ({
      ...current,
      [id]: { disposition, reviewedAt: new Date().toISOString() },
    }));
  }

  async function handleCopyReviewPacket() {
    const packet = {
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      ...identity,
      decisions,
    };
    await navigator.clipboard.writeText(JSON.stringify(packet, null, 2));
    setCopied(true);
  }

  return { copied, decisions, handleCopyReviewPacket, handleDecision };
}

function useReviewQueueFilters({
  decisions,
  initialFamily,
  items,
}: {
  decisions: Record<string, StoredDecision>;
  initialFamily: string;
  items: ReviewQueueItem[];
}) {
  const [filter, setFilter] = useState<ReviewDecision | "all">("all");
  const [familyScope, setFamilyScope] = useState(initialFamily);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [query, setQuery] = useState(initialFamily);
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const filtered = useMemo(
    () =>
      resolveReviewItems({
        decisions,
        familyScope,
        filter,
        items,
        query: deferredQuery,
      }),
    [decisions, deferredQuery, familyScope, filter, items]
  );

  function handleFilterChange(value: ReviewDecision | "all") {
    setFilter(value);
    setLimit(PAGE_SIZE);
  }

  function handleQueryChange(value: string) {
    setFamilyScope("");
    setQuery(value);
    setLimit(PAGE_SIZE);
  }

  return {
    handleFilterChange,
    handleQueryChange,
    filter,
    filtered,
    handleLoadMore: () => setLimit((current) => current + PAGE_SIZE),
    query,
    visible: filtered.slice(0, limit),
  };
}

export function useReviewQueueState(options: ReviewQueueStateOptions) {
  const review = useStoredReviewDecisions(options.identity);
  const view = useReviewQueueFilters({
    decisions: review.decisions,
    initialFamily: options.initialFamily,
    items: options.items,
  });
  return {
    ...review,
    ...view,
    remainingCount: view.filtered.length - view.visible.length,
    visibleCount: view.filtered.length,
  };
}

export function nextReviewPageSize(remainingCount: number) {
  return Math.min(PAGE_SIZE, remainingCount);
}
