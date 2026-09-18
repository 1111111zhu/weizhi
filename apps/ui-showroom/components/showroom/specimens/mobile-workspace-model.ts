import { z } from "zod";

import {
  defaultMobilePreferences,
  mobileConfirmationSections,
  initialMobileConfirmations,
  mobileConfirmationFormSchema,
  mobileConfirmationSchema,
  mobilePreferenceSchema,
} from "./mobile-services-model";
import { isMobileSettingsPage } from "./mobile-settings-model";
import { mobileSignoffSchema } from "./mobile-signoff-model";

export const mobileProjects = [
  {
    id: "orchid",
    name: "Orchid 2026 年度审计",
    code: "AUD-2026-018",
    client: "Orchid Technology Limited",
  },
  {
    id: "harbour",
    name: "Harbour 财务报表审计",
    code: "AUD-2026-021",
    client: "Harbour Retail Limited",
  },
  {
    id: "workshop",
    name: "Workshop 年度审计",
    code: "AUD-2026-026",
    client: "Workshop Company Limited",
  },
  {
    id: "origin",
    name: "Origin 集团及附属公司合并财务报表审计",
    code: "AUD-2026-032",
    client: "Origin Biotech Group",
  },
] as const;
export const mobileFolders = [
  { id: "planning", code: "P", name: "计划与风险评估" },
  { id: "cash", code: "A", name: "现金及银行" },
  { id: "receivables", code: "B", name: "应收账款" },
  { id: "deferred-income", code: "D", name: "递延收入" },
] as const;
export const mobileFiles = [
  {
    id: "deferred-income",
    folder: "deferred-income",
    code: "D-01",
    name: "审计程序——递延收入.sf",
    kind: "SmartForm",
    questions: 0,
  },
  {
    id: "planning",
    folder: "planning",
    code: "P-01",
    name: "总体审计策略",
    kind: "SmartForm",
    questions: 1,
  },
  {
    id: "planning-risk",
    folder: "planning",
    code: "P-02",
    name: "风险评估汇总表",
    kind: "SmartForm",
    questions: 0,
  },
  {
    id: "cash-program",
    folder: "cash",
    code: "A-01",
    name: "银行存款审计程序",
    kind: "SmartForm",
    questions: 3,
  },
  {
    id: "reconciliation",
    folder: "cash",
    code: "A-02",
    name: "银行余额调节表.xlsx",
    kind: "XLSX",
    questions: 1,
  },
  {
    id: "bank-reply",
    folder: "cash",
    code: "A-03",
    name: "银行回函.pdf",
    kind: "PDF",
    questions: 0,
  },
  {
    id: "bank-statement",
    folder: "cash",
    code: "A-04",
    name: "十二月份银行对账单.pdf",
    kind: "PDF",
    questions: 0,
  },
  {
    id: "restricted-cash",
    folder: "cash",
    code: "A-05",
    name: "受限资金及定期存款明细.xlsx",
    kind: "XLSX",
    questions: 0,
  },
  {
    id: "receivable-program",
    folder: "receivables",
    code: "B-01",
    name: "应收账款审计程序",
    kind: "SmartForm",
    questions: 1,
  },
  {
    id: "receivable-aging",
    folder: "receivables",
    code: "B-02",
    name: "应收账款账龄分析.xlsx",
    kind: "XLSX",
    questions: 0,
  },
] as const;
export type MobileFile = (typeof mobileFiles)[number];
export function mobileHasEvidenceImage(file: MobileFile, questionId: string) {
  return file.id === "cash-program" && questionId === "q1";
}
export const importedSmartFormPdf = "/mobile-smartforms/deferred-income.pdf";
export function isImportedMobileSmartForm(file: MobileFile) {
  return file.id === "deferred-income";
}
export function canEditMobileFile(file: MobileFile) {
  return file.kind === "SmartForm" && !isImportedMobileSmartForm(file);
}
export const mobileDefaultFile =
  mobileFiles.find((file) => file.id === "cash-program") ?? mobileFiles[0];
export const mobileQuestions = [
  {
    id: "q1",
    title: "年度余额核对",
    text: "请说明本年银行存款余额与上期的差异，并补充对应的银行回函。",
  },
  {
    id: "q2",
    title: "受限资金披露",
    text: "请确认受限资金的金额和使用限制，并核对财务报表披露。",
  },
  {
    id: "q3",
    title: "调节项目后续结清",
    text: "请补充未达账项在期后结清的证据及检查结果。",
  },
] as const;
export const mobileProcedures = [
  {
    id: "balance",
    title: "核对账面余额",
    detail: "将银行存款明细与总账余额核对。",
    result: "一致",
  },
  {
    id: "confirmation",
    title: "检查银行回函",
    detail: "核对回函余额及其他银行事项。",
    result: "已取得",
  },
  {
    id: "reconciling",
    title: "检查调节项目",
    detail: "检查未达账项及其期后结清情况。",
    result: "待补充",
  },
] as const;

type MobileDocumentProfile = {
  heading: string;
  summary: string;
  questions: readonly { id: string; title: string; text: string }[];
  procedures: readonly {
    id: string;
    title: string;
    detail: string;
    result: string;
  }[];
  referenceId: MobileFile["id"];
};
const mobileProfiles: Record<string, MobileDocumentProfile> = {
  "deferred-income": {
    heading: "递延收入",
    summary: "",
    questions: [],
    procedures: [],
    referenceId: "deferred-income",
  },
  planning: {
    heading: "审计范围与重点",
    summary:
      "明确本期审计范围、重要性水平和重大错报风险，并据此安排审计程序与人员。",
    questions: [
      {
        id: "q1",
        title: "重要性与审计范围",
        text: "请补充本期重要性水平的确定依据，并说明重大风险如何影响审计范围。",
      },
    ],
    procedures: [
      {
        id: "materiality",
        title: "确定重要性水平",
        detail: "记录基准、比例及判断依据。",
        result: "待补充",
      },
      {
        id: "risk",
        title: "识别重大风险",
        detail: "将主要风险与拟执行的审计程序关联。",
        result: "已识别",
      },
      {
        id: "resources",
        title: "安排审计资源",
        detail: "确认时间安排、人员分工与专家需求。",
        result: "已安排",
      },
    ],
    referenceId: "planning-risk",
  },
  receivables: {
    heading: "应收账款核对",
    summary:
      "核对应收账款明细与总账，检查账龄、期后回款及预期信用损失的判断依据。",
    questions: [
      {
        id: "q1",
        title: "账龄与期后回款",
        text: "请核对账龄分析，并补充逾期应收款的期后回款证据及减值判断。",
      },
    ],
    procedures: [
      {
        id: "ledger",
        title: "核对明细与总账",
        detail: "核对应收账款明细合计与总账。",
        result: "一致",
      },
      {
        id: "aging",
        title: "检查账龄分类",
        detail: "抽查账龄分组及逾期款项。",
        result: "待补充",
      },
      {
        id: "collection",
        title: "检查期后回款",
        detail: "检查期后回款记录和减值依据。",
        result: "已检查",
      },
    ],
    referenceId: "receivable-aging",
  },
  cash: {
    heading: "核对记录",
    summary:
      "核对银行存款账面金额与外部证据，并记录差异原因和后续处理。相关依据与讨论保留在此底稿的批注中。",
    questions: mobileQuestions,
    procedures: mobileProcedures,
    referenceId: "bank-reply",
  },
};
export function mobileDocumentProfile(file: MobileFile): MobileDocumentProfile {
  const profile = mobileProfiles[file.folder] ?? mobileProfiles.cash;
  return { ...profile, questions: profile.questions.slice(0, file.questions) };
}

export function mobileProcedureResultOptions(row: {
  id: string;
  result: string;
}) {
  const choices: Record<string, string[]> = {
    balance: ["一致", "有差异", "待补充", "不适用"],
    ledger: ["一致", "有差异", "待补充", "不适用"],
    confirmation: ["已取得", "未取得", "待补充", "不适用"],
    materiality: ["已确定", "待补充", "不适用"],
    risk: ["已识别", "待补充", "不适用"],
    resources: ["已安排", "待补充", "不适用"],
  };
  return [
    ...new Set([
      row.result,
      ...(choices[row.id] ?? ["已检查", "待补充", "不适用"]),
    ]),
  ];
}

export type PendingMobileReply = { questionKey: string; id: string };
export function shouldRevealMobileReply(
  pending: PendingMobileReply | null,
  questionKey: string,
  replies: readonly { id: string }[] = []
) {
  return Boolean(
    pending &&
    pending.questionKey === questionKey &&
    replies.some((reply) => reply.id === pending.id)
  );
}

export type MobileRoute = {
  screen:
    | "projects"
    | "tasks"
    | "emp-work-items"
    | "account"
    | "files"
    | "document"
    | "settings"
    | "confirmations"
    | "confirmation"
    | "confirmation-edit";
  project: string;
  folder: string;
  file: string;
  mode: "read" | "notes" | "edit";
  question: string;
  section: string;
  confirmation: string;
};
export const initialMobileRoute: MobileRoute = {
  screen: "projects",
  project: "orchid",
  folder: "",
  file: "cash-program",
  mode: "read",
  question: "",
  section: "",
  confirmation: "",
};
export function parseMobileRoute(hash: string): MobileRoute {
  const [screen, query] = hash.replace(/^#/, "").split("?");
  const params = new URLSearchParams(query);
  const route = { ...initialMobileRoute };
  if (mobileProjects.some((project) => project.id === params.get("project"))) {
    route.project = params.get("project") ?? route.project;
  }
  if (mobileFolders.some((folder) => folder.id === params.get("folder"))) {
    route.folder = params.get("folder") ?? "";
  }
  if (
    [
      "projects",
      "tasks",
      "emp-work-items",
      "account",
      "files",
      "document",
      "settings",
      "confirmations",
      "confirmation",
      "confirmation-edit",
    ].includes(screen)
  ) {
    route.screen = screen as MobileRoute["screen"];
  }
  if (
    screen === "settings" &&
    isMobileSettingsPage(params.get("section") ?? "")
  ) {
    route.section = params.get("section") ?? "";
  }
  if (
    screen === "confirmations" &&
    mobileConfirmationSections.some((item) => item.id === params.get("section"))
  ) {
    route.section = params.get("section") ?? "";
  }
  if (
    ["confirmation", "confirmation-edit"].includes(screen) &&
    params.has("id")
  ) {
    const id = params.get("id") ?? "";
    if (!/^[a-zA-Z0-9-]{1,128}$/.test(id)) {
      return { ...route, screen: "confirmations" };
    }
    route.confirmation = id;
  }
  if (["notes", "preview", "attachment"].includes(screen)) {
    route.screen = "document";
    route.mode = screen === "notes" ? "notes" : "read";
    route.question = screen === "notes" ? "q1" : "";
    route.file = screen === "attachment" ? "bank-reply" : route.file;
  }
  if (params.has("file")) {
    if (!mobileFiles.some((file) => file.id === params.get("file"))) {
      return { ...route, screen: "files", folder: "" };
    }
    route.file = params.get("file") ?? route.file;
  }
  const file =
    mobileFiles.find((item) => item.id === route.file) ?? mobileDefaultFile;
  if (params.get("mode") === "notes") {
    route.mode = "notes";
  }
  if (params.get("mode") === "edit" && canEditMobileFile(file)) {
    route.mode = "edit";
  }
  const question = params.get("q");
  if (
    mobileDocumentProfile(file).questions.some((item) => item.id === question)
  ) {
    route.question = question ?? "";
  }
  if (!file.questions) {
    route.question = "";
  }
  return route;
}
export function mobileRouteHref(route: MobileRoute) {
  const params = new URLSearchParams();
  if (["settings", "confirmations"].includes(route.screen) && route.section) {
    params.set("section", route.section);
  }
  if (
    ["confirmation", "confirmation-edit"].includes(route.screen) &&
    route.confirmation
  ) {
    params.set("id", route.confirmation);
  }
  if (route.screen === "files" || route.screen === "document") {
    params.set("project", route.project);
  }
  if (route.screen === "files" && route.folder) {
    params.set("folder", route.folder);
  }
  if (route.screen === "document") {
    params.set("file", route.file);
    params.set("mode", route.mode);
    if (route.mode === "notes" && route.question) {
      params.set("q", route.question);
    }
  }
  return `#${route.screen}${params.size ? `?${params}` : ""}`;
}
export const mobileFileKey = (project: string, file: string) =>
  `${project}:${file}`;
export const mobileQuestionKey = (route: MobileRoute) =>
  `${mobileFileKey(route.project, route.file)}:${route.question}`;
const strings = z.record(z.string(), z.string().max(10_000));
const stateSchema = z.object({
  version: z.literal(2),
  drafts: strings,
  replies: z.record(
    z.string(),
    z.array(
      z.object({
        id: z.string(),
        text: z.string().max(10_000),
        createdAt: z.string().datetime().optional(),
      })
    )
  ),
  resolved: z.array(z.string()),
  reviewed: z.array(z.string()),
  signoffs: z.array(mobileSignoffSchema).default([]),
  folders: strings,
  editDrafts: z.record(z.string(), strings),
  savedEdits: z.record(z.string(), strings),
  scroll: z.record(z.string(), z.number().finite().nonnegative()),
  search: z.string(),
  storageLimited: z.boolean(),
  preferences: mobilePreferenceSchema.default(() => ({
    ...defaultMobilePreferences,
  })),
  confirmations: z
    .array(mobileConfirmationSchema)
    .default(() => initialMobileConfirmations.map((record) => ({ ...record }))),
  confirmationDrafts: z
    .record(z.string(), mobileConfirmationFormSchema)
    .default({}),
  confirmationFilters: z
    .object({ query: z.string(), projectId: z.string(), status: z.string() })
    .default({ query: "", projectId: "", status: "" }),
});
export type MobileDemoState = z.infer<typeof stateSchema>;
export type MobileNavigationTrail = { entries: string[]; index: number };
export function advanceMobileTrail(
  trail: MobileNavigationTrail,
  renderedKey: string,
  browserKey: string
): MobileNavigationTrail {
  if (
    renderedKey !== browserKey ||
    trail.entries[trail.index] === renderedKey
  ) {
    return trail;
  }
  if (trail.index > 0 && trail.entries[trail.index - 1] === renderedKey) {
    return { ...trail, index: trail.index - 1 };
  }
  if (trail.entries[trail.index + 1] === renderedKey) {
    return { ...trail, index: trail.index + 1 };
  }
  const entries = trail.entries.length
    ? [...trail.entries.slice(0, trail.index + 1), renderedKey]
    : [renderedKey];
  return { entries, index: entries.length - 1 };
}
export function emptyMobileState(): MobileDemoState {
  return {
    version: 2,
    drafts: {},
    replies: {},
    resolved: [],
    reviewed: [],
    signoffs: [],
    folders: {},
    editDrafts: {},
    savedEdits: {},
    scroll: {},
    search: "",
    storageLimited: false,
    preferences: { ...defaultMobilePreferences },
    confirmations: initialMobileConfirmations.map((record) => ({ ...record })),
    confirmationDrafts: {},
    confirmationFilters: { query: "", projectId: "", status: "" },
  };
}
export function decodeMobileState(raw: string): MobileDemoState {
  try {
    const parsed = stateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : emptyMobileState();
  } catch {
    return emptyMobileState();
  }
}
export function effectiveFolder(
  state: MobileDemoState,
  project: string,
  file: MobileFile
) {
  const override = state.folders[mobileFileKey(project, file.id)];
  return mobileFolders.some((folder) => folder.id === override)
    ? override
    : file.folder;
}
export function sendMobileReply(
  state: MobileDemoState,
  route: MobileRoute,
  id: string,
  createdAt?: string
) {
  const key = mobileQuestionKey(route);
  const text = state.drafts[key]?.trim();
  const file = mobileFiles.find((item) => item.id === route.file);
  if (
    !text ||
    !file ||
    !mobileDocumentProfile(file).questions.some(
      (question) => question.id === route.question
    )
  ) {
    return state;
  }
  return {
    ...state,
    drafts: { ...state.drafts, [key]: "" },
    replies: {
      ...state.replies,
      [key]: [
        ...(state.replies[key] ?? []),
        { id, text, ...(createdAt ? { createdAt } : {}) },
      ],
    },
  };
}
export function moveMobileFiles(
  state: MobileDemoState,
  project: string,
  source: string,
  target: string,
  selectedIds: string[]
) {
  if (
    !mobileProjects.some((item) => item.id === project) ||
    !mobileFolders.some((item) => item.id === target) ||
    source === target
  ) {
    return state;
  }
  const folders = { ...state.folders };
  for (const file of mobileFiles) {
    if (
      selectedIds.includes(file.id) &&
      effectiveFolder(state, project, file) === source
    ) {
      folders[mobileFileKey(project, file.id)] = target;
    }
  }
  return { ...state, folders };
}
