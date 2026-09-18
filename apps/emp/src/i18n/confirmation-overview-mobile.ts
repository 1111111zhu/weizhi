export function getConfirmationOverviewMobileCopy(locale: string) {
  return locale === "zh-CN"
    ? {
        allCategories: "全部类别",
        displayMode: "显示方式",
        sentAging: "寄出账龄",
        receivedDetails: "回函明细",
        percentHint: "百分比以当前所选类别的函证总数为基数。",
        close: "关闭",
      }
    : {
        allCategories: "All categories",
        displayMode: "Display mode",
        sentAging: "Sent aging",
        receivedDetails: "Response details",
        percentHint: "Percentages use the total for the selected category.",
        close: "Close",
      };
}
