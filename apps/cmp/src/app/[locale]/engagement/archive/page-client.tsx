"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Archive,
  CheckCircle2,
  ChevronRight,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useMemo, useState } from "react";

import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCmpI18n } from "@/i18n/client";
import { getEngagementArchiveCopy } from "@/i18n/engagement-archive";

import {
  filterAndSortArchives,
  formatArchiveDate,
  formatArchiveMoney,
} from "./archive-list-utils";
import type { ArchiveListItem, ArchiveSort } from "./archive-list-utils";

export default function EngagementArchiveListRoute() {
  const { locale, localizedPath } = useCmpI18n();
  const copy = getEngagementArchiveCopy(locale).list;
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("all");
  const [sort, setSort] = useState<ArchiveSort>("archivedAt");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const archives = useQuery({
    queryKey: ["cmp-engagement-archives"],
    queryFn: api.cmpEngagementArchives,
  });
  const items: ArchiveListItem[] = archives.data?.archives ?? [];
  const years = useMemo(() => {
    const set = new Set<string>();
    for (const archive of items) {
      set.add(String(new Date(archive.archivedAt).getFullYear()));
    }
    return [...set].sort((a, b) => Number(b) - Number(a));
  }, [items]);
  const filtered = useMemo(
    () => filterAndSortArchives(items, query, year, sort),
    [items, query, sort, year]
  );
  const selected =
    filtered.find((archive) => archive.id === selectedId) ??
    filtered[0] ??
    null;
  const sortLabel =
    sort === "archivedAt"
      ? copy.sortRecent
      : sort === "engagementCode"
        ? copy.sortCode
        : copy.sortClient;

  if (archives.isLoading) {
    return (
      <main className="cmp-archive-workspace p-4 sm:p-6">
        <div className="mx-auto max-w-[112rem] animate-pulse space-y-5">
          <div className="h-16 max-w-xl rounded-lg bg-muted" />
          <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)_20rem]">
            <div className="h-[38rem] rounded-xl border bg-card" />
            <div className="h-[38rem] rounded-xl border bg-card" />
            <div className="h-[38rem] rounded-xl border bg-card" />
          </div>
          <p className="sr-only">{copy.loading}</p>
        </div>
      </main>
    );
  }
  if (archives.isError) {
    return (
      <main className="cmp-archive-workspace p-4 sm:p-6">
        <section className="mx-auto max-w-xl rounded-xl border bg-card p-8 text-center">
          <Archive className="mx-auto size-8 text-muted-foreground" />
          <h1 className="mt-4 text-lg font-semibold">{copy.unavailable}</h1>
          <Button
            className="mt-4 text-sm font-medium text-primary underline underline-offset-4"
            onClick={() => void archives.refetch()}
            variant="ghost"
          >
            {copy.retry}
          </Button>
        </section>
      </main>
    );
  }
  return (
    <main className="cmp-archive-workspace p-4 sm:p-6">
      <div className="mx-auto max-w-[112rem]">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b pb-5">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {copy.eyebrow}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              {copy.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {copy.description}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground tabular-nums">
              {copy.count.replace("{count}", String(filtered.length))}
            </span>
            <Button
              nativeButton={false}
              render={<a href={localizedPath("/engagement")} />}
              variant="outline"
            >
              <ArrowLeft className="size-4" />
              {copy.exit}
            </Button>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[14rem_minmax(0,1fr)_20rem]">
          <aside className="h-fit rounded-xl border bg-card p-3 xl:sticky xl:top-5">
            <p className="px-2 pb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {copy.directory}
            </p>
            <Button
              className={`cmp-archive-directory-item ${year === "all" ? "is-active" : ""}`}
              onClick={() => setYear("all")}
              variant="ghost"
            >
              <span>{copy.allArchives}</span>
              <span>{items.length}</span>
            </Button>
            {years.map((candidate) => (
              <Button
                className={`cmp-archive-directory-item ${year === candidate ? "is-active" : ""}`}
                key={candidate}
                onClick={() => setYear(candidate)}
                variant="ghost"
              >
                <span>{candidate}</span>
                <span>
                  {
                    items.filter(
                      (archive) =>
                        String(new Date(archive.archivedAt).getFullYear()) ===
                        candidate
                    ).length
                  }
                </span>
              </Button>
            ))}
          </aside>

          <section className="min-w-0 overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-wrap gap-2 border-b p-3">
              <div className="relative min-w-[14rem] flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={copy.searchPlaceholder}
                  type="search"
                  value={query}
                />
              </div>
              <Select
                onValueChange={(value) => setYear(value ?? "all")}
                value={year}
              >
                <SelectTrigger className="w-36">
                  <SlidersHorizontal className="mr-2 size-3.5" />
                  <SelectValue>
                    {year === "all" ? copy.allYears : year}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{copy.allYears}</SelectItem>
                  {years.map((candidate) => (
                    <SelectItem key={candidate} value={candidate}>
                      {candidate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                onValueChange={(value) => setSort(value as ArchiveSort)}
                value={sort}
              >
                <SelectTrigger className="w-40">
                  <SelectValue>{sortLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="archivedAt">{copy.sortRecent}</SelectItem>
                  <SelectItem value="engagementCode">
                    {copy.sortCode}
                  </SelectItem>
                  <SelectItem value="clientName">{copy.sortClient}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filtered.length ? (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[52rem] text-sm">
                    <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">
                          {copy.engagementCode}
                        </th>
                        <th className="px-3 py-3 font-medium">{copy.client}</th>
                        <th className="px-3 py-3 font-medium">
                          {copy.reportDate}
                        </th>
                        <th className="px-3 py-3 font-medium">{copy.pic}</th>
                        <th className="px-3 py-3 font-medium">
                          {copy.archivedAt}
                        </th>
                        <th className="px-3 py-3 text-right font-medium">
                          {copy.budgetActual}
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          {copy.variance}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((archive) => {
                        const variance =
                          Number(archive.totals.actualCost) -
                          Number(archive.totals.budgetCost);
                        const isSelected = selected?.id === archive.id;
                        return (
                          <tr
                            className={`cmp-archive-table-row ${isSelected ? "is-selected" : ""}`}
                            key={archive.id}
                            onClick={() => setSelectedId(archive.id)}
                          >
                            <td className="border-l-2 border-transparent px-4 py-3.5 font-medium">
                              <span className="block text-xs font-medium text-emerald-700">
                                {copy.archived}
                              </span>
                              {archive.engagementCode}
                            </td>
                            <td className="px-3 py-3.5">
                              {archive.clientName}
                            </td>
                            <td className="px-3 py-3.5 text-muted-foreground">
                              {archive.reportDate ?? "—"}
                            </td>
                            <td className="px-3 py-3.5">
                              {archive.pic ?? "—"}
                            </td>
                            <td className="px-3 py-3.5 text-muted-foreground">
                              {formatArchiveDate(archive.archivedAt, locale)}
                            </td>
                            <td className="px-3 py-3.5 text-right tabular-nums">
                              <span className="block">
                                {archive.totals.currency}{" "}
                                {formatArchiveMoney(archive.totals.budgetCost)}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {archive.totals.currency}{" "}
                                {formatArchiveMoney(archive.totals.actualCost)}
                              </span>
                            </td>
                            <td
                              className={`px-4 py-3.5 text-right font-medium tabular-nums ${variance > 0 ? "text-destructive" : "text-emerald-700"}`}
                            >
                              {variance > 0 ? "+" : ""}
                              {formatArchiveMoney(String(variance))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="divide-y md:hidden">
                  {filtered.map((archive) => {
                    const variance =
                      Number(archive.totals.actualCost) -
                      Number(archive.totals.budgetCost);
                    return (
                      <Button
                        className={`block w-full px-4 py-4 text-left ${selected?.id === archive.id ? "bg-primary/5" : ""}`}
                        key={archive.id}
                        onClick={() => setSelectedId(archive.id)}
                        variant="ghost"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="text-xs font-medium text-emerald-700">
                              {copy.archived}
                            </span>
                            <p className="mt-1 font-medium">
                              {archive.engagementCode}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {archive.clientName}
                            </p>
                          </div>
                          <ChevronRight className="mt-3 size-4 text-muted-foreground" />
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <span>
                            {formatArchiveDate(archive.archivedAt, locale)}
                          </span>
                          <span
                            className={
                              variance > 0
                                ? "text-destructive"
                                : "text-emerald-700"
                            }
                          >
                            {variance > 0 ? "+" : ""}
                            {formatArchiveMoney(String(variance))}
                          </span>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="p-10 text-center text-sm text-muted-foreground">
                {copy.empty}
              </div>
            )}
          </section>

          <aside className="h-fit rounded-xl border bg-card xl:sticky xl:top-5">
            {selected ? (
              <div className="p-5">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {copy.details}
                </p>
                <h2 className="mt-3 text-lg font-semibold">
                  {selected.engagementCode}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selected.clientName}
                </p>
                <dl className="mt-5 grid gap-3 border-y py-4 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{copy.reportDate}</dt>
                    <dd>{selected.reportDate ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{copy.pic}</dt>
                    <dd>{selected.pic ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{copy.archivedAt}</dt>
                    <dd className="text-right">
                      {formatArchiveDate(selected.archivedAt, locale)}
                    </dd>
                  </div>
                </dl>
                <section className="mt-5">
                  <h3 className="text-sm font-semibold">
                    {copy.archiveProgress}
                  </h3>
                  <ol className="cmp-archive-mini-progress mt-3">
                    {[copy.stepFill, copy.stepReview, copy.stepConfirm].map(
                      (step) => (
                        <li key={step}>
                          <CheckCircle2 className="size-4" />
                          <span>{step}</span>
                        </li>
                      )
                    )}
                  </ol>
                </section>
                <section className="mt-5 border-t pt-5">
                  <h3 className="text-sm font-semibold">
                    {copy.archiveChecks}
                  </h3>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span>{copy.passed}</span>
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  </div>
                </section>
                <a
                  className="mt-6 flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
                  href={localizedPath(
                    `/engagement/${selected.engagementId}/archive`
                  )}
                >
                  {copy.viewArchive}
                  <ChevronRight className="size-4" />
                </a>
              </div>
            ) : (
              <p className="p-5 text-sm text-muted-foreground">
                {copy.noSelection}
              </p>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
