export type IntranetBranch = {
  id: string;
  label: string;
  description?: string;
  children?: readonly IntranetBranch[];
};

// Prototype fixture mirrors the existing Intranet taxonomy; it is not an API or permission source.
export const intranetTree: readonly IntranetBranch[] = [
  {
    id: "admin",
    label: "Admin",
    description: "行政管理",
    children: [
      { id: "policies", label: "制度与治理" },
      { id: "operations", label: "行政运营" },
      { id: "forms", label: "表单与模板" },
    ],
  },
  {
    id: "hr",
    label: "HR",
    description: "人力资源",
    children: [
      { id: "people-policy", label: "人事制度" },
      { id: "learning", label: "培训与发展" },
      { id: "staff-services", label: "员工服务" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    description: "财务管理",
    children: [
      { id: "finance-policy", label: "财务制度" },
      { id: "expense", label: "费用与报销" },
      { id: "reporting", label: "管理报告" },
    ],
  },
  {
    id: "qm",
    label: "QM",
    description: "质量与专业支持",
    children: [
      {
        id: "technical",
        label: "Technical",
        description: "专业技术",
        children: [
          { id: "audit", label: "Audit" },
          { id: "accounting", label: "Accounting" },
          { id: "tax", label: "Tax" },
        ],
      },
      {
        id: "quality-management",
        label: "质量管理",
        children: [
          { id: "methodology", label: "方法论" },
          { id: "monitoring", label: "监控与整改" },
        ],
      },
      { id: "risk-alerts", label: "风险提示" },
    ],
  },
  {
    id: "it",
    label: "IT",
    description: "信息技术",
    children: [
      { id: "security", label: "信息安全" },
      { id: "systems", label: "系统指南" },
      { id: "service", label: "IT 服务" },
    ],
  },
];

export type IntranetDocument = {
  id: string;
  title: string;
  path: string[];
  updated: string;
  kind: "file" | "notice";
  summary: string;
  archived?: boolean;
};
export const intranetDocuments: readonly IntranetDocument[] = [
  {
    id: "outlook",
    title: "Outlook 日历使用指南.pdf",
    path: ["it", "systems"],
    updated: "2026-09-10",
    kind: "file",
    summary:
      "了解共享日历、会议邀请与提醒设置。此内容用于演示手机端资料阅读入口。",
  },
  {
    id: "remote",
    title: "远程访问与账号安全指南.pdf",
    path: ["it", "security"],
    updated: "2026-09-09",
    kind: "file",
    summary: "远程办公时的账号保护与访问注意事项。",
  },
  {
    id: "maintenance",
    title: "周末系统维护通知",
    path: ["it", "systems"],
    updated: "2026-09-11",
    kind: "notice",
    summary:
      "这是一条演示通知，用于验证分类、搜索和阅读流程，不代表真实维护安排。",
  },
  {
    id: "expense",
    title: "费用报销申请表.xlsx",
    path: ["finance", "expense"],
    updated: "2026-09-08",
    kind: "file",
    summary: "费用报销表的演示资料。原型不提交或下载业务文件。",
  },
  {
    id: "audit",
    title: "审计工作底稿编制指引.pdf",
    path: ["qm", "technical", "audit"],
    updated: "2026-09-07",
    kind: "file",
    summary: "用于展示三级分类中的资料。实际接入时将使用现有文件预览器。",
  },
  {
    id: "welcome",
    title: "新员工入职指引.pdf",
    path: ["hr", "staff-services"],
    updated: "2026-09-06",
    kind: "file",
    summary: "入职流程与常用服务入口的演示内容。",
  },
  {
    id: "archive",
    title: "旧版行政流程.pdf",
    path: ["admin", "operations"],
    updated: "2026-08-01",
    kind: "file",
    summary: "已归档资料示例。原型不执行恢复或删除操作。",
    archived: true,
  },
];

export type IntranetRoute =
  | { kind: "home" }
  | { kind: "knowledge"; path: string[] }
  | { kind: "collection"; collection: "recent" | "all" | "recycle" }
  | { kind: "document"; id: string };
export function resolveIntranetPath(path: readonly string[]) {
  let children = intranetTree;
  const trail: IntranetBranch[] = [];
  for (const id of path) {
    const branch = children.find((item) => item.id === id);
    if (!branch) {
      return;
    }
    trail.push(branch);
    children = branch.children ?? [];
  }
  return { trail, children };
}
export function parseIntranetRoute(hash: string): IntranetRoute {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "knowledge" && resolveIntranetPath(parts.slice(1))) {
    return { kind: "knowledge", path: parts.slice(1) };
  }
  if (
    parts.length === 1 &&
    (parts[0] === "recent" || parts[0] === "all" || parts[0] === "recycle")
  ) {
    return { kind: "collection", collection: parts[0] };
  }
  if (
    parts[0] === "document" &&
    parts.length === 2 &&
    intranetDocuments.some((item) => item.id === parts[1])
  ) {
    return { kind: "document", id: parts[1] };
  }
  return { kind: "home" };
}
export function intranetHref(path: readonly string[]) {
  return `#/knowledge${path.length ? `/${path.join("/")}` : ""}`;
}
export function getIntranetDocuments(
  route: IntranetRoute,
  query: string
): IntranetDocument[] {
  if (route.kind !== "knowledge" && route.kind !== "collection") {
    return [];
  }
  const normalized = query.trim().toLocaleLowerCase();
  const matching = intranetDocuments.filter((item) => {
    const archive =
      route.kind === "collection" && route.collection === "recycle";
    if (Boolean(item.archived) !== archive) {
      return false;
    }
    if (
      route.kind === "knowledge" &&
      !route.path.every((id, index) => item.path[index] === id)
    ) {
      return false;
    }
    return (
      !normalized ||
      `${item.title} ${resolveIntranetPath(item.path)
        ?.trail.map((branch) => branch.label)
        .join(" ")}`
        .toLocaleLowerCase()
        .includes(normalized)
    );
  });
  return route.kind === "collection" && route.collection === "recent"
    ? matching
        .toSorted((a, b) => b.updated.localeCompare(a.updated))
        .slice(0, 5)
    : matching;
}
