export type ArchiveListItem = {
  id: string;
  engagementId: string;
  engagementCode: string;
  clientName: string;
  reportDate: string | null;
  pic: string | null;
  archivedAt: string;
  totals: {
    currency: string;
    budgetCost: string;
    actualCost: string;
  };
};

export type ArchiveSort = "archivedAt" | "engagementCode" | "clientName";

export function filterAndSortArchives(
  items: ArchiveListItem[],
  query: string,
  year: string,
  sort: ArchiveSort
) {
  const keyword = query.trim().toLowerCase();
  return items
    .filter((archive) => {
      if (
        year !== "all" &&
        String(new Date(archive.archivedAt).getFullYear()) !== year
      ) {
        return false;
      }
      if (!keyword) return true;
      return (
        archive.engagementCode.toLowerCase().includes(keyword) ||
        archive.clientName.toLowerCase().includes(keyword) ||
        (archive.pic ?? "").toLowerCase().includes(keyword)
      );
    })
    .sort((left, right) => {
      if (sort === "archivedAt") {
        return (
          new Date(right.archivedAt).getTime() -
          new Date(left.archivedAt).getTime()
        );
      }
      return left[sort].localeCompare(right[sort], undefined, {
        sensitivity: "base",
      });
    });
}

export function formatArchiveDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatArchiveMoney(value: string) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Number(value));
}
