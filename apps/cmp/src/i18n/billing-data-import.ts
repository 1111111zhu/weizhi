import type { CmpLocale } from "./settings";

export function getBillingDataImportCopy(locale: CmpLocale, readOnly = false) {
  const zh = locale === "zh-CN";
  return zh
    ? {
        title: "代入资料",
        description: readOnly
          ? "查看账单资料的来源、当前值及可代入值。非草稿账单不可重新代入。"
          : "逐项确认资料来源、当前账单值及将带入的值。此处的修改仅会写入当前账单草稿。",
        cmp: "CMP 数据",
        general: "通用资料",
        client: "客户资料",
        recipient: "收件资料",
        engagement: "业务资料",
        firm: "事务所模板",
        bank: "银行模板",
        sources: "资料来源",
        sourceHint: "可同时选用 CMP 数据与通用模板；右侧仅会代入已勾选的字段。",
        source: "来源",
        current: "当前值",
        incoming: "将带入的值",
        selectFirm: "选择事务所模板",
        selectBank: "选择银行模板",
        none: "不代入",
        cancel: "取消",
        close: "关闭",
        apply: "应用到草稿",
        retry: "重试",
        loading: "正在读取可代入资料…",
        failed: "无法读取可代入资料。",
        empty: "没有可用模板。",
        templateHint: "启用后可选择模板并逐项调整带入值。",
        sourceCmp: "客户、业务及系统账单默认规则",
        sourceGeneral: "事务所与银行的共享模板",
        manage: "在设置中管理模板",
      }
    : {
        title: "Import data",
        description: readOnly
          ? "View the source, current bill value, and available incoming value. A non-draft bill cannot be re-imported."
          : "Confirm the source, current bill value, and incoming value field by field. Edits here apply only to this billing draft.",
        cmp: "CMP data",
        general: "Common data",
        client: "Client details",
        recipient: "Recipient details",
        engagement: "Engagement details",
        firm: "Firm template",
        bank: "Bank template",
        sources: "Data sources",
        sourceHint:
          "CMP data and shared templates can be combined. Only checked fields on the right will be imported.",
        source: "Source",
        current: "Current value",
        incoming: "Incoming value",
        selectFirm: "Select a firm template",
        selectBank: "Select a bank template",
        none: "Do not import",
        cancel: "Cancel",
        close: "Close",
        apply: "Apply to draft",
        retry: "Retry",
        loading: "Loading importable data…",
        failed: "Importable data could not be loaded.",
        empty: "No template is available.",
        templateHint:
          "Enable this source, select a template, and adjust individual values before applying.",
        sourceCmp: "Client, engagement, and system billing defaults",
        sourceGeneral: "Shared firm and bank templates",
        manage: "Manage templates in Settings",
      };
}
