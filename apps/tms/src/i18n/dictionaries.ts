import type {
  TmsApprovalProject,
  TmsApprovalRecord,
} from "@project-wing/shared";

import type { TmsLocale } from "@/i18n/settings";
import type {
  TimesheetDetails,
  TimesheetType,
  TimesheetWorkType,
} from "@/lib/timesheet";

const monthLabels = {
  "en-US": [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
  "zh-CN": [
    "1月",
    "2月",
    "3月",
    "4月",
    "5月",
    "6月",
    "7月",
    "8月",
    "9月",
    "10月",
    "11月",
    "12月",
  ],
} as const;
const typeLabels: Record<TmsLocale, Record<TimesheetType, string>> = {
  "en-US": {
    Chargeable: "Chargeable",
    "Non-Chargeable": "Non-Chargeable",
    Leave: "Leave",
  },
  "zh-CN": {
    Chargeable: "可收费",
    "Non-Chargeable": "不可收费",
    Leave: "休假",
  },
};
const workTypeLabels: Record<TmsLocale, Record<TimesheetWorkType, string>> = {
  "en-US": { Normal: "Normal", OT: "OT", Absent: "Absent" },
  "zh-CN": { Normal: "正常", OT: "加班", Absent: "缺勤" },
};
const detailLabels: Record<TmsLocale, Record<TimesheetDetails, string>> = {
  "en-US": {
    Normal: "Normal",
    OT: "OT",
    Absent: "Absent",
    "Internal Admin": "Internal Admin",
    "Business Development": "Business Development",
    "HR Function": "HR Function",
    "Idle or Unassigned": "Idle or Unassigned",
    "Internal Event": "Internal Event",
    "Technical & Training Dept Only": "Technical & Training Dept Only",
    Marketing: "Marketing",
    "Internal Training": "Internal Training",
    "Others PRC Training": "Others PRC Training",
    "PRC Training": "PRC Training",
    Resignation: "Resignation",
    Others: "Others",
    "Annual Leave": "Annual Leave",
    "Examination Leave": "Examination Leave",
    "O.T. Leave": "O.T. Leave",
    "No Pay Leave": "No Pay Leave",
    "Special Leave": "Special Leave",
    "Public Holiday": "Public Holiday",
    "Sick Leave": "Sick Leave",
    "Study Leave": "Study Leave",
  },
  "zh-CN": {
    Normal: "正常",
    OT: "加班",
    Absent: "缺勤",
    "Internal Admin": "内部行政",
    "Business Development": "业务拓展",
    "HR Function": "人力资源工作",
    "Idle or Unassigned": "闲置或未分配",
    "Internal Event": "内部活动",
    "Technical & Training Dept Only": "技术及培训部门专用",
    Marketing: "市场推广",
    "Internal Training": "内部培训",
    "Others PRC Training": "其他 PRC 培训",
    "PRC Training": "PRC 培训",
    Resignation: "离职",
    Others: "其他",
    "Annual Leave": "年假",
    "Examination Leave": "考试假",
    "O.T. Leave": "加班假",
    "No Pay Leave": "无薪假",
    "Special Leave": "特别假",
    "Public Holiday": "公众假期",
    "Sick Leave": "病假",
    "Study Leave": "进修假",
  },
};
const approvalStatusLabels: Record<
  TmsLocale,
  Record<TmsApprovalRecord["status"], string>
> = {
  "en-US": {
    NOT_SUBMITTED: "Not submitted",
    SUBMITTED: "Pending approval",
    RETURNED: "Returned",
    APPROVED: "Approved",
    PENDING_CONFIRMATION: "Pending confirmation",
  },
  "zh-CN": {
    NOT_SUBMITTED: "未提交",
    SUBMITTED: "待审批",
    RETURNED: "已退回",
    APPROVED: "已批准",
    PENDING_CONFIRMATION: "待确认",
  },
};
const projectStatusLabels: Record<
  TmsLocale,
  Record<TmsApprovalProject["status"], string>
> = {
  "en-US": {
    ACTIVE: "Active",
    INACTIVE: "Inactive",
    COMPLETED: "Completed",
    ARCHIVED: "Archived",
  },
  "zh-CN": {
    ACTIVE: "进行中",
    INACTIVE: "已暂停",
    COMPLETED: "已完成",
    ARCHIVED: "已归档",
  },
};

export const tmsRoleLabelsByLocale: Record<
  TmsLocale,
  Record<string, string>
> = {
  "zh-CN": {
    ADMIN: "管理员",
    HR: "人力资源",
    MANAGER: "经理",
    PARTNER: "合伙人",
    PRINCIPAL: "总监",
    STAFF: "员工",
    SUPER_ADMIN: "超级管理员",
  },
  "en-US": {
    ADMIN: "Admin",
    HR: "Human Resources",
    MANAGER: "Manager",
    PARTNER: "Partner",
    PRINCIPAL: "Principal",
    STAFF: "Staff",
    SUPER_ADMIN: "Super Admin",
  },
};

const baseCopy = {
  accountControls: "Account controls",
  add: "Add",
  all: "All",
  addRow: "Add row",
  addDescriptionPlaceholder: "Add a description",
  addRowDescription:
    "Choose a Type and Details, then add an optional Description. Chargeable rows also require an EMP project.",
  pendingLinkHint:
    "Leave the project search blank to save this Chargeable row as Pending link.",
  pendingLinkLabel: "Pending link",
  linkEmpProject: "Link EMP project",
  searchEmpProjectPlaceholder: "Search by EMP project code",
  searchEmpProjectHint: "Enter an EMP project code to search.",
  searchingEmpProjects: "Searching EMP projects…",
  noMatchingEmpProjects: "No matching EMP projects.",
  linkProjectError: "Unable to link the EMP project.",
  unlinkProject: "Unlink project",
  category: "Category",
  chargeable: "Chargeable",
  chooseDetails: "Choose Details",
  chooseType: "Choose Type",
  clearFilter: "Clear filter",
  collapse: "Collapse",
  description: "Description",
  delete: "Delete",
  deleteRows: "Delete rows",
  deleteSelectedRows: "Delete selected rows",
  details: "Details",
  filter: "Filter",
  filterBlankValue: "(Blank)",
  filterNoMatches: "No matches",
  filterSearch: "Search",
  hoursVerification: "Hours verification",
  hours: "Hours",
  hoursSuffix: "h",
  leave: "Leave",
  nonChargeable: "Non-Chargeable",
  matchingCmpEngagements: "Matching EMP projects",
  name: "Name",
  periodTotal: "Period Total",
  resizeChargeableNonChargeable: "Resize Chargeable and Non-Chargeable panels",
  resizeNonChargeableLeave: "Resize Non-Chargeable and Leave panels",
  resizeReviewDashboard: "Resize review dashboard height",
  retrySave: "Retry Save",
  save: "Save",
  saved: "Saved",
  saving: "Saving",
  expandFilteredEmployees: "Expand filtered employees",
  expand: "Expand",
  collapseFilteredEmployees: "Collapse filtered employees",
  returnedTimesheet: "Timesheet returned. Please update it and submit again.",
  returnReasonTitle: "Return reason",
  returnReasonDescription:
    "Tell the employee what needs to be corrected before resubmission.",
  returnReasonPlaceholder: "Enter the return reason…",
  returnReasonRequired: "A return reason is required.",
  viewReturnReason: "Return reason",
  submit: "Submit",
  submitFailed: "Submit failed",
  submitted: "Submitted",
  submitting: "Submitting",
  submitTryAgain: "Try Again",
  timesheetActions: "Timesheet actions",
  timesheetPeriodFilters: "Timesheet period filters",
  timesheetTitle: "Timesheet",
  timesheetTypeFilter: "Timesheet type filter",
  year: "Year",
  month: "Month",
  period: "Period",
  total: "Total",
  cancel: "Cancel",
  submitAnyway: "Submit anyway",
  openDatesRemain: "Open dates remain",
  openDatesRemainDescription:
    "Some workdays are below 8 hours. Review them before submitting, or continue anyway.",
  submittedSuccessful: "Submitted successfully",
  demoSubmitted: "Demo submitted (not server-persisted)",
  fillingProgress: "Filling progress",
  completed: "Completed",
  open: "Open",
  abnormal: "Abnormal",
  target: "Target",
  filled: "filled",
  engagementCode: "Business Code",
  projectCode: "EMP Project Code",
  projectName: "Project Name",
  selectedEmpProject: "Selected EMP project",
  clientName: "Client Name",
  type: "Type",
  normal: "Normal",
  ot: "OT",
  absent: "Absent",
  cmpMatch: "Business context",
  autoMatchedClient: "Auto matched client",
  clientCode: "Client Code",
  pic: "PIC",
  mic: "MIC",
  typeEngagementCode: "Type an EMP project code",
  searchingCmpEngagements: "Searching EMP projects…",
  noMatchingActiveEngagement: "No matching active EMP project.",
  validatingCmp: "Validating linkage…",
  selectRow: "Select row",
  descriptionForRow: "Description for row",
  openDates: "Open dates",
  missing: "Missing",
  employee: "Employee",
  employees: "employees",
  overview: "Overview",
  overviewTitle: "TMS overview",
  overviewDescription: "Review every employee's submitted hours and anomalies.",
  overviewLoadFailed: "Unable to load the TMS overview.",
  noOverviewData: "No active employees found.",
  dailyTotal: "Daily total",
  warning: "Warning",
  error: "Error",
  ok: "OK",
  refresh: "Refresh",
  submissionOverview: "Submission overview",
  exceptionDetails: "Exception details",
  allEmployeesSubmitted: "All employees have submitted.",
  noExceptionData: "No exception data",
  projectCount: "engagements",
  pendingCount: "Pending",
  returnedCount: "Returned",
  currentProject: "Current engagement",
  selectProject: "Select an engagement",
  selectEmpProject: "EMP Project",
  myProjects: "My engagements",
  searchProjectPlaceholder: "Search engagement, client or business code",
  searchEmpProjectDirectoryPlaceholder:
    "Search EMP project code, name, business or client",
  projectApprovalFilter: "Engagement approval filter",
  pendingOnly: "Pending only",
  noMatchingProjects: "No matching engagements",
  operation: "Actions",
  status: "Status",
  approvalTotal: "Total",
  approvalType: "Type",
  approve: "Approve",
  return: "Return",
  approveAll: "Approve all",
  undoApproval: "Undo approval",
  approving: "Approving…",
  undoing: "Undoing…",
  approvalNoEmployees: "No employees submitted for the current filters",
  syncingApproval: "Syncing CMP engagements and approval records…",
  approvalHorizontalScroll: "Approval horizontal scroll",
  projectPaneResize: "Resize engagement pane",
  resizeProjectPaneLegacy: "Resize engagement pane",
  notSubmittedCannotEdit: "Not submitted; approvers cannot edit",
  editHours: "Edit hours",
  finishEditing: "Confirm changes",
  approvalUnsaved: "Unsaved changes",
  approvalSaveFailedStatus: "Save failed",
  editHoursHint: "Click Edit before changing employee hours.",
  filteredStatusHalf:
    "This half-month is excluded by the current Status filter",
  back: "Back",
  query: "Query",
  timesheetFilters: "Timesheet filters",
  timesheetResults: "Timesheet results",
  staffName: "Staff Name",
  staffNo: "Staff No",
  timesheetStatus: "Timesheet Status",
  activeStatus: "Active Status",
  dateFrom: "Date From",
  dateTo: "Date To",
  timesheetDate: "Timesheet Date",
  rate: "Rate",
  netBudgetFee: "Net Budget Fee",
  orderBy: "Order By",
  search: "Search",
  select: "Select",
  reset: "Reset",
  exportExcel: "Export Excel",
  detail: "Detail",
  summary: "Summary",
  loading: "Loading…",
  noResults: "No results",
  dateFormatPlaceholder: "YYYY-MM-DD",
  allDates: "All dates",
  unableLoadTimesheet: "Unable to load timesheet.",
  unableSaveTimesheet: "Unable to save timesheet.",
  unableSubmitTimesheet: "Unable to submit timesheet.",
  unableLoadQuery: "Unable to load timesheet query.",
  unableExportQuery: "Unable to export timesheet query.",
  liveCmpValidationFailed:
    "Live integration validation failed. No entry was added.",
  chooseTimesheetType: "Choose a timesheet type.",
  chooseTypeForCategory: "Choose Type for the selected category.",
  chooseDetailsForType: "Choose Details for the selected Type.",
  chooseValidNonChargeableType: "Choose valid Non-Chargeable Type.",
  chooseValidNonChargeableDetails: "Choose valid Non-Chargeable Details.",
  leaveOnlyNormalType: "Leave only supports Normal Type.",
  chooseValidLeaveDetails: "Choose valid Leave Details.",
  chooseEngagement: "Choose an EMP Project from the search results.",
  noActiveCmpEngagement: "No active EMP project matches that code.",
  chooseValidChargeableType: "Choose valid Chargeable Type.",
  duplicateChargeableRow:
    "This EMP project already has a Chargeable row with Details: {details}.",
  fixBeforeSubmit: "Please fix the timesheet errors before submitting.",
  validationMissingHours: "Hours=0",
  validationIssueReason: "Normal+Leave>8H",
  timesheetAccessDenied: "Timesheet access denied: {reason}",
  approvalBatchPartial:
    "{action} {success} records; {failed} failed. Refresh and try again.",
  approvedAction: "Approved",
  undidAction: "Undid",
  approvalAutosaveBusy:
    "An employee's timesheet is being saved. Please try again shortly.",
  approvalActionFailed: "{action} failed",
  approvalAutosaveFailed: "Save failed. Please try again.",
  months: monthLabels["en-US"],
  firstHalf: "1st - 15th",
  secondHalf: "16th - end",
  firstHalfShort: "1st",
  secondHalfShort: "2nd",
  metadataDescription: "Timesheet management for Project Wing",
  statusNotSubmitted: "Not submitted",
  statusSubmitted: "Pending approval",
  statusReturned: "Returned",
  statusApproved: "Approved",
  statusPendingConfirmation: "Pending confirmation",
} as const;

export type TmsWorkspaceCopy = {
  [Key in keyof typeof baseCopy]: (typeof baseCopy)[Key] extends readonly string[]
    ? readonly string[]
    : string;
};

export const tmsSettingsCopyByLocale = {
  "zh-CN": {
    account: "当前账号",
    accountMenu: "账号菜单",
    appearance: "外观",
    approvals: "审批",
    day: "日间",
    developmentAccountsEmpty: "没有可用的开发账号。",
    developmentAccountsLoading: "正在加载开发账号…",
    fontSize: "字号",
    fontSizeOptions: { sm: "小", md: "中", lg: "大" },
    language: "语言",
    languageShortOptions: { "zh-CN": "简", "en-US": "EN" },
    night: "夜间",
    returnToPortal: "内网门户",
    overview: "总览",
    settings: "设置",
    close: "关闭",
    search: "搜索",
    signOut: "退出登录",
    signInFailed: "切换账号失败，请重试。",
    switchAccount: "切换账号",
    timesheet: "时间表",
    pendingApproval: "存在待审批",
  },
  "en-US": {
    account: "Current account",
    accountMenu: "Account menu",
    appearance: "Appearance",
    approvals: "Approval",
    day: "Day",
    developmentAccountsEmpty: "No development accounts are available.",
    developmentAccountsLoading: "Loading development accounts…",
    fontSize: "Font size",
    fontSizeOptions: { sm: "Small", md: "Medium", lg: "Large" },
    language: "Language",
    languageShortOptions: { "zh-CN": "简", "en-US": "EN" },
    night: "Night",
    returnToPortal: "Intranet",
    overview: "Overview",
    settings: "Setting",
    close: "Close",
    search: "Search",
    signOut: "Sign out",
    signInFailed: "Unable to switch account. Please try again.",
    switchAccount: "Switch account",
    timesheet: "Timesheet",
    pendingApproval: "Pending approval",
  },
} as const;

export type TmsSettingsCopy =
  (typeof tmsSettingsCopyByLocale)[keyof typeof tmsSettingsCopyByLocale];

const zhCopy: TmsWorkspaceCopy = {
  accountControls: "账号控制",
  add: "添加",
  all: "全部",
  addRow: "添加行",
  addDescriptionPlaceholder: "添加描述",
  addRowDescription:
    "选择类别和详情，可选填描述。可收费行还需要选择 EMP 项目。",
  pendingLinkHint: "项目搜索留空，可先保存为待关联的可收费行。",
  pendingLinkLabel: "待关联",
  linkEmpProject: "关联 EMP 项目",
  searchEmpProjectPlaceholder: "按 EMP 项目代码搜索",
  searchEmpProjectHint: "输入 EMP 项目代码后搜索。",
  searchingEmpProjects: "正在搜索 EMP 项目…",
  noMatchingEmpProjects: "没有匹配的 EMP 项目。",
  linkProjectError: "EMP 项目关联失败，请重试。",
  unlinkProject: "解除项目关联",
  category: "类别",
  chargeable: "可收费",
  chooseDetails: "选择详情",
  chooseType: "选择类型",
  clearFilter: "清除筛选",
  collapse: "收起",
  description: "描述",
  delete: "删除",
  deleteRows: "删除行",
  deleteSelectedRows: "删除已选行",
  details: "详情",
  filter: "筛选",
  filterBlankValue: "（空白）",
  filterNoMatches: "没有匹配项",
  filterSearch: "搜索",
  hoursVerification: "工时核对",
  hours: "工时",
  hoursSuffix: "h",
  leave: "休假",
  nonChargeable: "不可收费",
  matchingCmpEngagements: "匹配的 EMP 项目",
  name: "姓名",
  periodTotal: "期间合计",
  resizeChargeableNonChargeable: "调整可收费与不可收费面板大小",
  resizeNonChargeableLeave: "调整不可收费与休假面板大小",
  resizeReviewDashboard: "调整复核看板高度",
  retrySave: "重试保存",
  save: "保存",
  saved: "已保存",
  saving: "保存中",
  expandFilteredEmployees: "展开当前筛选员工",
  expand: "展开",
  collapseFilteredEmployees: "收起当前筛选员工",
  returnedTimesheet: "工时已退回，请修改后重新提交。",
  returnReasonTitle: "退回理由",
  returnReasonDescription: "请说明员工重新提交前需要修正的内容。",
  returnReasonPlaceholder: "填写退回理由…",
  returnReasonRequired: "退回时必须填写理由。",
  viewReturnReason: "退回理由",
  submit: "提交",
  submitFailed: "提交失败",
  submitted: "已提交",
  submitting: "提交中",
  submitTryAgain: "重试",
  timesheetActions: "时间表操作",
  timesheetPeriodFilters: "时间表期间筛选",
  timesheetTitle: "时间表",
  timesheetTypeFilter: "时间表类型筛选",
  year: "年份",
  month: "月份",
  period: "期间",
  total: "合计",
  cancel: "取消",
  submitAnyway: "仍然提交",
  openDatesRemain: "仍有未完成日期",
  openDatesRemainDescription:
    "部分工作日不足 8 小时，请检查后再提交，或选择继续提交。",
  submittedSuccessful: "提交成功",
  demoSubmitted: "演示数据已提交（未保存到服务器）",
  fillingProgress: "填写进度",
  completed: "已完成",
  open: "未完成",
  abnormal: "异常",
  target: "目标",
  filled: "已填写",
  engagementCode: "业务代码",
  projectCode: "EMP 项目代码",
  projectName: "项目名称",
  selectedEmpProject: "已选 EMP 项目",
  clientName: "客户名称",
  type: "类型",
  normal: "正常",
  ot: "加班",
  absent: "缺勤",
  cmpMatch: "业务归属",
  autoMatchedClient: "自动匹配客户",
  clientCode: "客户编号",
  pic: "PIC",
  mic: "MIC",
  typeEngagementCode: "输入 EMP 项目代码",
  searchingCmpEngagements: "正在搜索 EMP 项目…",
  noMatchingActiveEngagement: "没有匹配的有效 EMP 项目。",
  validatingCmp: "正在验证互联关系…",
  selectRow: "选择行",
  descriptionForRow: "行描述",
  openDates: "未完成日期",
  missing: "未交",
  employee: "员工",
  employees: "名员工",
  overview: "总览",
  overviewTitle: "TMS 总览",
  overviewDescription: "查看所有员工的工时填写情况及异常数据。",
  overviewLoadFailed: "无法加载 TMS 总览。",
  noOverviewData: "暂无在职员工。",
  dailyTotal: "每日合计",
  warning: "警示",
  error: "错误",
  ok: "正常",
  refresh: "刷新",
  submissionOverview: "提交概览",
  exceptionDetails: "异常明细",
  allEmployeesSubmitted: "所有员工均已提交。",
  noExceptionData: "暂无异常数据",
  projectCount: "项业务",
  pendingCount: "待审",
  returnedCount: "已退回",
  currentProject: "当前业务",
  selectProject: "请选择业务",
  selectEmpProject: "EMP 项目",
  myProjects: "我负责的业务",
  searchProjectPlaceholder: "搜索业务、客户或业务代码",
  searchEmpProjectDirectoryPlaceholder: "搜索 EMP 项目代码、名称、业务或客户",
  projectApprovalFilter: "业务审批筛选",
  pendingOnly: "仅待审批",
  noMatchingProjects: "没有匹配的负责业务",
  operation: "操作",
  status: "状态",
  approvalTotal: "合计",
  approvalType: "类型",
  approve: "批准",
  return: "退回",
  approveAll: "全部批准",
  undoApproval: "撤销批准",
  approving: "批准中…",
  undoing: "撤销中…",
  approvalNoEmployees: "当前筛选没有员工提交",
  syncingApproval: "正在同步 CMP 业务和审批记录…",
  approvalHorizontalScroll: "审批表格水平滚动",
  projectPaneResize: "调整业务面板大小",
  resizeProjectPaneLegacy: "拉动伸缩",
  notSubmittedCannotEdit: "未提交，审批者不能修改",
  editHours: "修改",
  finishEditing: "确认修改",
  approvalUnsaved: "待保存",
  approvalSaveFailedStatus: "保存失败",
  editHoursHint: "请先点击“修改”，再编辑员工工时。",
  filteredStatusHalf: "当前状态筛选未包含该半月",
  back: "返回",
  query: "查询",
  timesheetFilters: "时间表筛选",
  timesheetResults: "时间表结果",
  staffName: "员工姓名",
  staffNo: "员工编号",
  timesheetStatus: "时间表状态",
  activeStatus: "在职状态",
  dateFrom: "开始日期",
  dateTo: "结束日期",
  timesheetDate: "时间表日期",
  rate: "费率",
  netBudgetFee: "净预算费用",
  orderBy: "排序方式",
  search: "搜索",
  select: "选择",
  reset: "重置",
  exportExcel: "导出 Excel",
  detail: "明细",
  summary: "汇总",
  loading: "加载中…",
  noResults: "暂无结果",
  dateFormatPlaceholder: "YYYY-MM-DD",
  allDates: "全部日期",
  unableLoadTimesheet: "无法加载时间表。",
  unableSaveTimesheet: "无法保存时间表。",
  unableSubmitTimesheet: "无法提交时间表。",
  unableLoadQuery: "无法加载时间表查询。",
  unableExportQuery: "无法导出时间表查询。",
  liveCmpValidationFailed: "CMP 实时验证失败，未添加任何行。",
  chooseTimesheetType: "请选择时间表类型。",
  chooseTypeForCategory: "请选择该类别的类型。",
  chooseDetailsForType: "请选择该类型的详情。",
  chooseValidNonChargeableType: "请选择有效的不可收费类型。",
  chooseValidNonChargeableDetails: "请选择有效的不可收费详情。",
  leaveOnlyNormalType: "休假只支持正常类型。",
  chooseValidLeaveDetails: "请选择有效的休假详情。",
  chooseEngagement: "请从搜索结果中选择 EMP 项目。",
  noActiveCmpEngagement: "没有项目代码匹配的有效 EMP 项目。",
  chooseValidChargeableType: "请选择有效的可收费类型。",
  duplicateChargeableRow: "该 EMP 项目已存在详情为“{details}”的可收费行。",
  fixBeforeSubmit: "请修正时间表错误后再提交。",
  validationMissingHours: "Hours=0",
  validationIssueReason: "Normal+Leave>8H",
  timesheetAccessDenied: "时间表访问被拒绝：{reason}",
  approvalBatchPartial:
    "{action}{success}条记录，{failed}条失败，请刷新后重试。",
  approvedAction: "已批准",
  undidAction: "已撤销",
  approvalAutosaveBusy: "员工时间表正在保存，请稍后再试。",
  approvalActionFailed: "{action}失败",
  approvalAutosaveFailed: "保存失败，请重试。",
  months: monthLabels["zh-CN"],
  firstHalf: "1日 - 15日",
  secondHalf: "16日 - 月末",
  firstHalfShort: "上",
  secondHalfShort: "下",
  metadataDescription: "Project Wing 时间表管理系统",
  statusNotSubmitted: "未提交",
  statusSubmitted: "待审批",
  statusReturned: "已退回",
  statusApproved: "已批准",
  statusPendingConfirmation: "待确认",
};

export const tmsWorkspaceCopy = baseCopy;
export const tmsWorkspaceCopyByLocale: Record<TmsLocale, TmsWorkspaceCopy> = {
  "en-US": baseCopy,
  "zh-CN": zhCopy,
};

export function getTmsWorkspaceCopy(locale: TmsLocale = "en-US") {
  return tmsWorkspaceCopyByLocale[locale];
}

export function getTmsMonthLabels(locale: TmsLocale = "en-US") {
  return monthLabels[locale];
}

export function getTimesheetTypeLabel(
  type: TimesheetType,
  locale: TmsLocale = "en-US"
) {
  return typeLabels[locale][type];
}

export function getTimesheetWorkTypeLabel(
  type: TimesheetWorkType,
  locale: TmsLocale = "en-US"
) {
  return workTypeLabels[locale][type];
}

export function getTimesheetDetailsLabel(
  details: TimesheetDetails,
  locale: TmsLocale = "en-US"
) {
  return detailLabels[locale][details];
}

export function getApprovalStatusLabel(
  status: TmsApprovalRecord["status"],
  locale: TmsLocale = "en-US"
) {
  return approvalStatusLabels[locale][status];
}

export function getProjectStatusLabel(
  status: TmsApprovalProject["status"],
  locale: TmsLocale = "en-US"
) {
  return projectStatusLabels[locale][status];
}

export function getPeriodLabel(
  period: "all" | "first" | "second",
  locale: TmsLocale = "en-US"
) {
  const copy = getTmsWorkspaceCopy(locale);
  if (period === "all") {
    return copy.all;
  }
  return period === "first" ? copy.firstHalf : copy.secondHalf;
}

export function getTmsStatusLabel(status: string, locale: TmsLocale = "en-US") {
  const copy = getTmsWorkspaceCopy(locale);
  const normalized = status.replaceAll("-", "_");
  if (normalized === "DRAFT") {
    return locale === "zh-CN" ? "草稿" : "Draft";
  }
  if (normalized === "SUBMITTED") {
    return copy.statusSubmitted;
  }
  if (normalized === "APPROVED") {
    return copy.statusApproved;
  }
  if (normalized === "RETURNED") {
    return copy.statusReturned;
  }
  if (normalized === "ACTIVE") {
    return locale === "zh-CN" ? "在职" : "Active";
  }
  if (normalized === "OFF_LINE") {
    return locale === "zh-CN" ? "离线" : "Offline";
  }
  if (normalized === "LEAVE") {
    return copy.leave;
  }
  return normalized.replaceAll("_", "-");
}

export function translateTimesheetMessage(
  message: string,
  locale: TmsLocale = "en-US"
) {
  if (locale === "en-US") {
    return message;
  }
  return message
    .replace(
      /^(.*?) has ([\d.]+) counted hours\. A day cannot exceed 24 hours\.$/,
      "$1 已记录 $2 小时，单日不能超过 24 小时。"
    )
    .replace(
      /^(.*?) has ([\d.]+) counted hours\. Workdays need at least 8 hours before submission\.$/,
      "$1 已记录 $2 小时，工作日提交前至少需要 8 小时。"
    )
    .replace(
      /^(.*?) has ([\d.]+) counted hours\. Non-holiday workdays should have between 8 and 12 hours\.$/,
      "$1 已记录 $2 小时，非假日工作日应填写 8 至 12 小时。"
    )
    .replace(
      /^(.*?) Normal \+ Leave is ([\d.]+)\. Normal 工时和休假每天不能超过 8 小时，请将超出部分记入 OT。$/,
      "$1 的 Normal + 休假为 $2 小时，二者每天不能超过 8 小时，请将超出部分记入 OT。"
    );
}
