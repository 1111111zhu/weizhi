import type { CmpLocale } from "./settings";

export function getBillingScheduleCopy(locale: CmpLocale) {
  return locale === "zh-CN"
    ? {
        title: "开票／收费计划",
        viewBills: "查看账单",
        schedule: "收费计划",
        emptySchedule: "尚未建立收费期次。",
        liveCollections: "实时费用收回状况",
        loading: "正在加载账单资料…",
        emptyBills: "尚未建立账单。",
        agreedFee: "约定费用",
        period: "期次",
        periodLabel: (value: number) => `第 ${value} 期`,
        plannedDate: "计划开票日期",
        plannedAmount: "计划金额",
        number: "收费单编号",
        billNumber: "账单编号",
        issueDate: "开票日期",
        amount: "开票金额",
        received: "已收金额",
        outstanding: "未收余额",
        status: "状态",
        addPeriod: "新增期次",
        unscheduled: "未排期",
        receivedDate: "收款日期",
        draftPhase:
          "以下收费计划将随归档快照冻结；归档后开票与回款以实时账单数据展示。",
        frozenPhase:
          "以下收费计划为归档当刻的冻结版本；实时收回状况会随账单和财务回款更新。",
      }
    : {
        title: "Billing / fee schedule",
        viewBills: "View bills",
        schedule: "Fee schedule",
        emptySchedule: "No billing periods have been created.",
        liveCollections: "Live collections",
        loading: "Loading billing data…",
        emptyBills: "No bills have been created.",
        agreedFee: "Agreed fee",
        period: "Period",
        periodLabel: (value: number) => `Period ${value}`,
        plannedDate: "Planned issue date",
        plannedAmount: "Planned amount",
        number: "Fee note number",
        billNumber: "Bill number",
        issueDate: "Issue date",
        amount: "Billed amount",
        received: "Received",
        outstanding: "Outstanding",
        status: "Status",
        addPeriod: "Add period",
        unscheduled: "Unscheduled",
        receivedDate: "Received date",
        draftPhase:
          "This fee schedule will be frozen in the archive snapshot. Billing and collections will continue to show live data after archiving.",
        frozenPhase:
          "This fee schedule was frozen when archived. Live collections continue to reflect billing and receipt updates.",
      };
}
