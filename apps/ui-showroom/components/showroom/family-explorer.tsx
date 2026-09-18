"use client";

import { ArrowUpRightIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface FamilyListItem {
  implementations: number;
  interactive: boolean;
  kinds: string[];
  name: string;
  publicImplementations: number;
  scopes: string[];
}

type FamilyFilter = "all" | "shared" | "application" | "showroom";

function matchesFilter(item: FamilyListItem, filter: FamilyFilter) {
  if (filter === "all") {
    return true;
  }
  if (filter === "shared") {
    return item.scopes.includes("shared");
  }
  if (filter === "showroom") {
    return item.scopes.includes("showroom");
  }
  return item.scopes.some((scope) => !["shared", "showroom"].includes(scope));
}

function filterFamilies(
  items: FamilyListItem[],
  filter: FamilyFilter,
  query: string
) {
  return items.filter(
    (item) =>
      matchesFilter(item, filter) &&
      (!query ||
        item.name.toLocaleLowerCase().includes(query) ||
        item.scopes.some((scope) => scope.includes(query)) ||
        item.kinds.some((kind) => kind.includes(query)))
  );
}

function FamilyRow({ item }: { item: FamilyListItem }) {
  return (
    <Link
      className="group grid gap-3 border-b px-1 py-4 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-3"
      href={`/components/${encodeURIComponent(item.name)}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{item.name}</span>
          {item.interactive ? (
            <Badge variant="secondary">Interactive</Badge>
          ) : null}
          {item.publicImplementations > 0 ? (
            <Badge variant="outline">Public API</Badge>
          ) : null}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {item.scopes.join(", ")} · {item.kinds.join(", ")}
        </p>
      </div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="tabular-nums">
          {item.implementations} implementation
          {item.implementations === 1 ? "" : "s"}
        </span>
        <ArrowUpRightIcon
          aria-hidden="true"
          className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        />
      </div>
    </Link>
  );
}

function FamilyExplorerControls({
  filter,
  onFilterChange,
  onQueryChange,
  query,
}: {
  filter: FamilyFilter;
  onFilterChange: (filter: FamilyFilter) => void;
  onQueryChange: (query: string) => void;
  query: string;
}) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <Tabs
        onValueChange={(value) => onFilterChange(value as FamilyFilter)}
        value={filter}
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="shared">Shared</TabsTrigger>
          <TabsTrigger value="application">Applications</TabsTrigger>
          <TabsTrigger value="showroom">Showroom</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="relative w-full xl:max-w-sm">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <label className="sr-only" htmlFor="family-search">
          Search component families
        </label>
        <Input
          className="pl-9"
          id="family-search"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search family, scope, or source kind"
          value={query}
        />
      </div>
    </div>
  );
}

function NoMatchingFamily() {
  return (
    <div className="rounded-lg border border-dashed px-6 py-10 text-center">
      <p className="font-medium text-foreground">No matching family</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Try a component name such as Button, Dialog, or DataGrid.
      </p>
    </div>
  );
}

export function FamilyExplorer({ items }: { items: FamilyListItem[] }) {
  const [filter, setFilter] = useState<FamilyFilter>("all");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const filtered = useMemo(
    () => filterFamilies(items, filter, deferredQuery),
    [deferredQuery, filter, items]
  );

  return (
    <div className="flex flex-col gap-5">
      <FamilyExplorerControls
        filter={filter}
        onFilterChange={setFilter}
        onQueryChange={setQuery}
        query={query}
      />
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {filtered.length} of {items.length} families
      </p>
      <div className="border-t">
        {filtered.map((item) => (
          <FamilyRow item={item} key={item.name} />
        ))}
      </div>
      {filtered.length === 0 ? <NoMatchingFamily /> : null}
    </div>
  );
}
