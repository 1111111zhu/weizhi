import {
  knowledgeCategories,
  knowledgeDepartmentIds,
} from "./knowledge-catalog";
import type { KnowledgeDepartment, KnowledgeItem } from "./knowledge-catalog";

// Match the CSS < 768px boundary, including fractional CSS widths at browser zoom.
export const INTRANET_MOBILE_MAX_WIDTH = 767.98;

export type IntranetMobileLocation = {
  screen: "home" | "knowledge" | "items" | "recycle";
  department?: KnowledgeDepartment;
  category?: string;
  subcategory?: string;
};

/** Local previews share the browser's host alias; deployment destinations stay untouched. */
export function mobileSystemHref(href: string, hostname: string) {
  const loopback = ["localhost", "127.0.0.1", "10.0.2.2"];
  try {
    const url = new URL(href);
    if (loopback.includes(url.hostname) && loopback.includes(hostname)) {
      url.hostname = hostname;
    }
    return url.toString();
  } catch {
    return href;
  }
}

export function mobileLocationHash(location: IntranetMobileLocation) {
  if (location.screen === "home") {
    return "";
  }
  const params = new URLSearchParams();
  if (location.department) {
    params.set("department", location.department);
  }
  if (location.category) {
    params.set("category", location.category);
  }
  if (location.subcategory) {
    params.set("subcategory", location.subcategory);
  }
  if (location.screen === "items") {
    params.set("list", "1");
  }
  return `#${location.screen === "recycle" ? "recycle" : "knowledge"}${params.size ? `?${params}` : ""}`;
}

export function parseMobileLocation(hash: string): IntranetMobileLocation {
  const [screen, query] = hash.replace(/^#/, "").split("?");
  if (screen === "recycle") {
    return { screen: "recycle" };
  }
  if (screen !== "knowledge") {
    return { screen: "home" };
  }
  const result: IntranetMobileLocation = { screen: "knowledge" };
  const params = new URLSearchParams(query);
  const department = params.get("department") as KnowledgeDepartment;
  if (!knowledgeDepartmentIds.includes(department)) {
    return result;
  }
  result.department = department;
  if (department === "all" || department === "recent") {
    return { ...result, screen: "items" };
  }
  const category = knowledgeCategories[department].find(
    (item) => item.id === params.get("category")
  );
  if (category) {
    result.category = category.id;
    const subcategory = category.children?.find(
      (item) => item.id === params.get("subcategory")
    );
    if (subcategory) {
      result.subcategory = subcategory.id;
    }
    if (!category.children?.length || subcategory) {
      result.screen = "items";
    }
  }
  if (params.get("list") === "1") {
    result.screen = "items";
  }
  return result;
}

export function parentMobileLocation(
  location: IntranetMobileLocation
): IntranetMobileLocation {
  if (location.screen === "recycle") {
    return { screen: "knowledge" };
  }
  if (location.screen === "items" && !location.subcategory) {
    const { department } = location;
    if (department && department !== "all" && department !== "recent") {
      const category = knowledgeCategories[department].find(
        (item) => item.id === location.category
      );
      if (!location.category || category?.children?.length) {
        return { ...location, screen: "knowledge" };
      }
    }
  }
  if (location.subcategory) {
    return {
      screen: "knowledge",
      department: location.department,
      category: location.category,
    };
  }
  if (location.category) {
    return { screen: "knowledge", department: location.department };
  }
  if (location.department) {
    return { screen: "knowledge" };
  }
  return { screen: "home" };
}

export function filterMobileKnowledge(
  items: KnowledgeItem[],
  location: IntranetMobileLocation,
  query: string,
  now = new Date()
) {
  const normalized = query.trim().toLocaleLowerCase();
  const threshold = new Date(now);
  threshold.setMonth(threshold.getMonth() - 3);
  const matching = items.filter(
    (item) =>
      (!location.department ||
        location.department === "all" ||
        location.department === "recent" ||
        item.department === location.department) &&
      (!location.category || item.secondaryCategory === location.category) &&
      (!location.subcategory ||
        item.tertiaryCategory === location.subcategory) &&
      (location.department !== "recent" ||
        new Date(item.updatedAt) >= threshold) &&
      (!normalized ||
        [
          item.referenceCode,
          item.title,
          item.department,
          item.type,
          item.owner,
        ].some((value) => value?.toLocaleLowerCase().includes(normalized)))
  );
  return location.department === "recent" ? matching.slice(0, 30) : matching;
}
