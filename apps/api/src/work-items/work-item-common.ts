import {
  WorkItemListResponseSchema,
  WorkItemSchema,
} from "@project-wing/shared";
import type {
  WorkItem,
  WorkItemCategorySummary,
  WorkItemDomain,
  WorkItemListResponse,
} from "@project-wing/shared";

export type WorkItemLocale = "zh-CN" | "en-US";

export const TEAM_CATEGORY_LABELS: Record<string, [string, string]> = {
  PROJECT_PROCESS: ["项目流程", "Project process"],
  REVIEW: ["复核问题", "Review questions"],
  SIGNOFF: ["签核", "Sign-off"],
  SMART_FORM: ["SmartForm", "SmartForm"],
  FILE_VERSION: ["文件与版本", "Files and versions"],
  INSPECTION: ["检查异常", "Inspection failures"],
};

export function copy(locale: WorkItemLocale, zh: string, en: string) {
  return locale === "zh-CN" ? zh : en;
}

export function person(
  value: { id: string; name: string; email?: string | null } | null | undefined
) {
  return value
    ? { id: value.id, name: value.name, email: value.email ?? null }
    : null;
}

export function projectSummary(
  value: { id: string; projectCode: string; name: string } | null | undefined
) {
  return value
    ? { id: value.id, projectCode: value.projectCode, name: value.name }
    : null;
}

export function workItem(input: WorkItem) {
  return WorkItemSchema.parse(input);
}

export function finalizeWorkItems(
  items: WorkItem[],
  locale: WorkItemLocale
): WorkItemListResponse {
  const unique = new Map<string, WorkItem>();
  for (const item of items) {
    const current = unique.get(item.id);
    if (!current || item.updatedAt > current.updatedAt) {
      unique.set(item.id, item);
    }
  }
  const sorted = [...unique.values()].sort(compareWorkItems);
  const categoryMap = new Map<string, WorkItemCategorySummary>();
  for (const item of sorted) {
    const current = categoryMap.get(item.category);
    const earliest = current?.earliestOpenedAt;
    categoryMap.set(item.category, {
      category: item.category,
      label: categoryLabel(item.category, locale),
      total: (current?.total ?? 0) + 1,
      blockers:
        (current?.blockers ?? 0) + (item.severity === "BLOCKER" ? 1 : 0),
      earliestOpenedAt:
        !earliest || item.openedAt < earliest ? item.openedAt : earliest,
    });
  }
  const counts: Record<WorkItemDomain | "total", number> = {
    total: sorted.length,
    EMP: 0,
    PROJECT: 0,
    CMP: 0,
    TMS: 0,
    OPS: 0,
  };
  for (const item of sorted) {
    counts[item.domain] += 1;
  }
  return WorkItemListResponseSchema.parse({
    items: sorted,
    categories: [...categoryMap.values()].sort(
      (left, right) =>
        right.blockers - left.blockers || right.total - left.total
    ),
    counts,
  });
}

function categoryLabel(category: string, locale: WorkItemLocale) {
  const labels = TEAM_CATEGORY_LABELS[category];
  if (labels) {
    return locale === "zh-CN" ? labels[0] : labels[1];
  }
  return category
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (value) => value.toUpperCase());
}

function compareWorkItems(left: WorkItem, right: WorkItem) {
  const priority = { URGENT: 4, HIGH: 3, NORMAL: 2, LOW: 1 } as const;
  const severity = { BLOCKER: 3, ACTION_REQUIRED: 2, WARNING: 1 } as const;
  return (
    priority[right.priority] - priority[left.priority] ||
    severity[right.severity] - severity[left.severity] ||
    compareNullableDates(left.dueAt, right.dueAt) ||
    right.updatedAt.localeCompare(left.updatedAt)
  );
}

function compareNullableDates(left: string | null, right: string | null) {
  if (left === right) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return left.localeCompare(right);
}
