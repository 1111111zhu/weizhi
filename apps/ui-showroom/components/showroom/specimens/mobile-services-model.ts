import type {
  ConfirmationStatus,
  ConfirmationType,
} from "@project-wing/shared";
import { z } from "zod";

export const mobilePreferenceSchema = z.object({
  theme: z.enum(["system", "light", "dark"]),
  density: z.enum(["compact", "default"]),
  textSize: z.enum(["standard", "large"]),
});
export const defaultMobilePreferences = {
  theme: "system",
  density: "compact",
  textSize: "standard",
} as const;

export const confirmationStatusLabels: Record<ConfirmationStatus, string> = {
  DRAFT: "草稿",
  PREPARED: "已准备",
  AWAITING_RESPONSE: "待回函",
  RESPONSE_RECEIVED: "已收回函",
  CLOSED: "已完成",
  VOIDED: "已作废",
};
export const confirmationTypeLabels: Record<ConfirmationType, string> = {
  BANK: "银行",
  BALANCE: "往来余额",
  RELATED_PARTY: "关联方",
  LAWYER: "律师",
  INVENTORY: "存货",
  INTERMEDIARY: "中介机构",
  OTHER: "其他",
  UNCLASSIFIED: "待分类",
};
const typeSchema = z.custom<ConfirmationType>(
  (value) =>
    typeof value === "string" && Object.hasOwn(confirmationTypeLabels, value)
);
const statusSchema = z.custom<ConfirmationStatus>(
  (value) =>
    typeof value === "string" && Object.hasOwn(confirmationStatusLabels, value)
);
export const mobileConfirmationFormSchema = z.object({
  projectId: z.string().max(128),
  type: typeSchema,
  name: z.string().max(160),
  recipient: z.string().max(160),
  email: z.string().max(255),
  date: z.string().max(10),
  notes: z.string().max(2000),
});
export type MobileConfirmationForm = z.infer<
  typeof mobileConfirmationFormSchema
>;
export const mobileConfirmationSchema = mobileConfirmationFormSchema.extend({
  id: z.string().min(1).max(128),
  code: z.string().min(1).max(80),
  status: statusSchema,
  updatedAt: z.string(),
});
export type MobileConfirmation = z.infer<typeof mobileConfirmationSchema>;
export type MobileConfirmationErrors = Partial<
  Record<keyof MobileConfirmationForm | "form", string>
>;
export const initialMobileConfirmations: MobileConfirmation[] = [
  {
    id: "cf-bank-orchid",
    code: "CF-2026-001",
    projectId: "orchid",
    type: "BANK",
    name: "中国银行询证函",
    recipient: "中国银行",
    email: "",
    date: "2026-12-31",
    notes: "核对本期银行账户余额及其他银行事项。",
    status: "DRAFT",
    updatedAt: "2026-09-10T02:00:00Z",
  },
  {
    id: "cf-balance-orchid",
    code: "CF-2026-002",
    projectId: "orchid",
    type: "BALANCE",
    name: "Harbour 往来余额询证函",
    recipient: "Harbour Trading Limited",
    email: "finance@example.test",
    date: "2026-12-31",
    notes: "应收账款余额核对。",
    status: "AWAITING_RESPONSE",
    updatedAt: "2026-09-09T02:00:00Z",
  },
  {
    id: "cf-bank-harbour",
    code: "CF-2026-003",
    projectId: "harbour",
    type: "BANK",
    name: "HSBC 银行询证函",
    recipient: "HSBC",
    email: "",
    date: "2026-12-31",
    notes: "回函已收取，待核对内容。",
    status: "RESPONSE_RECEIVED",
    updatedAt: "2026-09-08T02:00:00Z",
  },
  {
    id: "cf-lawyer-workshop",
    code: "CF-2026-004",
    projectId: "workshop",
    type: "LAWYER",
    name: "年度律师询证函",
    recipient: "外聘法律顾问",
    email: "legal@example.test",
    date: "2026-12-31",
    notes: "核对诉讼、索赔及或有事项。",
    status: "PREPARED",
    updatedAt: "2026-09-08T01:00:00Z",
  },
];
export function emptyConfirmationForm(projectId = ""): MobileConfirmationForm {
  return {
    projectId,
    type: "BANK",
    name: "",
    recipient: "",
    email: "",
    date: "",
    notes: "",
  };
}
export function confirmationFormErrors(
  form: MobileConfirmationForm,
  projectIds: readonly string[]
): MobileConfirmationErrors {
  const errors: MobileConfirmationErrors = {};
  if (!projectIds.includes(form.projectId)) {
    errors.projectId = "请选择项目";
  }
  if (!form.name.trim()) {
    errors.name = "请填写函证名称";
  }
  if (!form.recipient.trim()) {
    errors.recipient = "请填写被询证方";
  }
  if (!Object.hasOwn(confirmationTypeLabels, form.type)) {
    errors.type = "请选择函证类型";
  }
  if (form.email.trim() && !z.email().safeParse(form.email.trim()).success) {
    errors.email = "请填写有效邮箱";
  }
  const parsedDate = new Date(`${form.date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(form.date) ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== form.date
  ) {
    errors.date = "请选择有效的函证基准日";
  }
  return errors;
}
export type SaveMobileConfirmationResult =
  | { ok: true; records: MobileConfirmation[]; id: string }
  | { ok: false; errors: MobileConfirmationErrors };
/** Preview-store draft save only. Never dispatches a letter or changes a sent status. */
export function saveMobileConfirmationDraft(
  records: MobileConfirmation[],
  form: MobileConfirmationForm,
  existingId: string,
  newId: string,
  updatedAt: string,
  projectIds: readonly string[]
): SaveMobileConfirmationResult {
  const parsed = mobileConfirmationFormSchema.safeParse(form);
  if (!parsed.success) {
    return { ok: false, errors: { form: "请检查输入内容及长度" } };
  }
  const errors = confirmationFormErrors(parsed.data, projectIds);
  if (Object.keys(errors).length) {
    return { ok: false, errors };
  }
  const existing = records.find((record) => record.id === existingId);
  if (existingId && !existing) {
    return { ok: false, errors: { form: "未找到这份函证，请返回列表刷新" } };
  }
  if (existing && existing.status !== "DRAFT") {
    return {
      ok: false,
      errors: { form: "这份函证已不是草稿，不能通过草稿入口修改" },
    };
  }
  if (existing && existing.projectId !== form.projectId) {
    return { ok: false, errors: { projectId: "已创建的函证不能更换关联项目" } };
  }
  if (!existing && records.some((record) => record.id === newId)) {
    return { ok: false, errors: { form: "保存请求重复，请返回列表查看" } };
  }
  const saved: MobileConfirmation = {
    ...parsed.data,
    name: form.name.trim(),
    recipient: form.recipient.trim(),
    email: form.email.trim(),
    notes: form.notes.trim(),
    id: existing?.id ?? newId,
    code:
      existing?.code ??
      `CF-2026-${String(records.length + 1).padStart(3, "0")}`,
    status: "DRAFT",
    updatedAt,
  };
  return {
    ok: true,
    id: saved.id,
    records: existing
      ? records.map((record) => (record.id === existing.id ? saved : record))
      : [saved, ...records],
  };
}
export const mobileConfirmationSections = [
  { id: "all", label: "全部函证" },
  { id: "templates", label: "函证模板库" },
  { id: "information", label: "函证信息库" },
  { id: "replies", label: "回函仓库" },
] as const;
