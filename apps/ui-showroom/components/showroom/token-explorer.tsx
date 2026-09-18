"use client";

import { SearchIcon } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface TokenDefinitionItem {
  file: string;
  kind: string;
  line: number;
  name: string;
  selector: string | null;
  value: string;
}

export interface TokenConflictItem {
  evidence: TokenDefinitionItem[];
  files: string[];
  name: string;
  values: string[];
}

export interface RawStyleItem {
  file: string;
  kind: string;
  line: number;
  value: string;
}

type TokenTab = "definitions" | "conflicts" | "raw";

const PAGE_SIZE = 100;

function searchableText(item: object) {
  return Object.values(item).flat().join(" ").toLocaleLowerCase();
}

function DefinitionRow({ item }: { item: TokenDefinitionItem }) {
  return (
    <div className="grid gap-2 border-b px-1 py-4 sm:grid-cols-[minmax(11rem,0.7fr)_minmax(0,1.3fr)] sm:px-3">
      <div>
        <code className="text-sm font-medium text-foreground">{item.name}</code>
        <p className="mt-1 text-xs text-muted-foreground">
          {item.selector || "Global scope"}
        </p>
      </div>
      <div className="min-w-0">
        <code className="block text-xs break-words text-foreground">
          {item.value}
        </code>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {item.file}:{item.line}
        </p>
      </div>
    </div>
  );
}

function ConflictRow({ item }: { item: TokenConflictItem }) {
  return (
    <div className="grid gap-3 border-b px-1 py-4 sm:grid-cols-[minmax(11rem,0.7fr)_minmax(0,1.3fr)] sm:px-3">
      <div>
        <code className="text-sm font-medium text-foreground">{item.name}</code>
        <div className="mt-2 flex flex-wrap gap-1">
          <Badge variant="outline">{item.files.length} files</Badge>
          <Badge variant="secondary">{item.values.length} values</Badge>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        {item.values.map((value) => (
          <code className="text-xs break-words text-foreground" key={value}>
            {value}
          </code>
        ))}
        <div className="mt-1 max-h-40 space-y-1 overflow-y-auto border-t pt-2">
          {item.evidence.map((evidence) => (
            <code
              className="block text-xs break-all text-muted-foreground"
              key={`${evidence.file}:${evidence.line}:${evidence.value}`}
            >
              {evidence.file}:{evidence.line} · {evidence.selector || "Global"}{" "}
              · {evidence.value}
            </code>
          ))}
        </div>
      </div>
    </div>
  );
}

function RawStyleRow({ item }: { item: RawStyleItem }) {
  return (
    <div className="grid gap-2 border-b px-1 py-4 sm:grid-cols-[minmax(11rem,0.7fr)_minmax(0,1.3fr)] sm:px-3">
      <div>
        <code className="text-sm font-medium break-words text-foreground">
          {item.value}
        </code>
        <p className="mt-1 text-xs text-muted-foreground">{item.kind}</p>
      </div>
      <p className="truncate text-xs text-muted-foreground sm:text-right">
        {item.file}:{item.line}
      </p>
    </div>
  );
}

function resultCount(tab: TokenTab, data: TokenExplorerData) {
  if (tab === "definitions") {
    return data.definitions.length;
  }
  if (tab === "conflicts") {
    return data.conflicts.length;
  }
  return data.rawValues.length;
}

interface TokenExplorerData {
  conflicts: TokenConflictItem[];
  definitions: TokenDefinitionItem[];
  rawValues: RawStyleItem[];
}

function TokenExplorerToolbar({
  onQueryChange,
  onTabChange,
  query,
  tab,
}: {
  onQueryChange: (query: string) => void;
  onTabChange: (tab: TokenTab) => void;
  query: string;
  tab: TokenTab;
}) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <Tabs
        onValueChange={(value) => onTabChange(value as TokenTab)}
        value={tab}
      >
        <TabsList>
          <TabsTrigger value="definitions">Definitions</TabsTrigger>
          <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
          <TabsTrigger value="raw">Raw styles</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="relative w-full xl:max-w-sm">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <label className="sr-only" htmlFor="token-search">
          Search tokens and style sources
        </label>
        <Input
          className="pl-9"
          id="token-search"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search token, value, selector, or file"
          value={query}
        />
      </div>
    </div>
  );
}

function TokenRows({ items, tab }: { items: object[]; tab: TokenTab }) {
  if (tab === "definitions") {
    return (items as TokenDefinitionItem[]).map((item) => (
      <DefinitionRow
        item={item}
        key={`${item.file}:${item.line}:${item.name}`}
      />
    ));
  }
  if (tab === "conflicts") {
    return (items as TokenConflictItem[]).map((item) => (
      <ConflictRow item={item} key={item.name} />
    ));
  }
  return (items as RawStyleItem[]).map((item) => (
    <RawStyleRow item={item} key={`${item.file}:${item.line}:${item.value}`} />
  ));
}

function useTokenExplorer(data: TokenExplorerData) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TokenTab>("definitions");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const filtered = useMemo(() => {
    const source =
      tab === "definitions"
        ? data.definitions
        : tab === "conflicts"
          ? data.conflicts
          : data.rawValues;
    return deferredQuery
      ? source.filter((item) => searchableText(item).includes(deferredQuery))
      : source;
  }, [data, deferredQuery, tab]);

  function handleTabChange(nextTab: TokenTab) {
    setLimit(PAGE_SIZE);
    setTab(nextTab);
  }

  function handleQueryChange(nextQuery: string) {
    setLimit(PAGE_SIZE);
    setQuery(nextQuery);
  }

  return {
    handleQueryChange,
    handleTabChange,
    filtered,
    handleLoadMore: () => setLimit((current) => current + PAGE_SIZE),
    query,
    tab,
    visible: filtered.slice(0, limit),
  };
}

export function TokenExplorer({ data }: { data: TokenExplorerData }) {
  const view = useTokenExplorer(data);
  const remaining = view.filtered.length - view.visible.length;

  return (
    <section className="flex flex-col gap-5">
      <TokenExplorerToolbar
        onQueryChange={view.handleQueryChange}
        onTabChange={view.handleTabChange}
        query={view.query}
        tab={view.tab}
      />
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {view.filtered.length} matching records, {resultCount(view.tab, data)}{" "}
        total in this view
      </p>
      <div className="border-t">
        <TokenRows items={view.visible} tab={view.tab} />
      </div>
      {remaining > 0 ? (
        <Button
          className="self-start"
          onClick={view.handleLoadMore}
          variant="outline"
        >
          Load {Math.min(PAGE_SIZE, remaining)} more
        </Button>
      ) : null}
    </section>
  );
}
