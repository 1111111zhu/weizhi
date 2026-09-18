export function getConfirmationRegisterMobileCopy(locale: string) {
  return locale === "zh-CN"
    ? {
        status: "状态",
        statusCount: "{count} 种状态",
        allStatuses: "全部状态",
        activeFilters: "当前筛选条件",
        clearCondition: "清除条件",
        actions: "列表操作",
        loadMore: "加载更多",
        responseOutcomes: {
          PENDING: "回函待处理",
          MISMATCH: "回函不符",
          MATCHED: "回函相符",
          NONE: "暂无回函",
        },
        rename: "重命名",
        cancel: "取消",
        selected: "已选 {count} 项",
      }
    : {
        status: "Status",
        statusCount: "{count} statuses",
        allStatuses: "All statuses",
        activeFilters: "Active filters",
        clearCondition: "Clear filter",
        actions: "List actions",
        loadMore: "Load more",
        responseOutcomes: {
          PENDING: "Response pending",
          MISMATCH: "Response mismatch",
          MATCHED: "Response matched",
          NONE: "No response",
        },
        rename: "Rename",
        cancel: "Cancel",
        selected: "{count} selected",
      };
}
