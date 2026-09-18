export function getArchiveMobileCopy(locale: string) {
  return locale.startsWith("zh")
    ? {
        deadlineHint: "根据报告日期自动计算",
        idleHint:
          "提交前将检查签署、复核问题及项目文件；检查通过后再确认归档。",
        failed: "文件检查未完成",
        retryHint: "暂时无法取得完整检查结果，请重试。",
        retry: "重新检查",
        group: "检查分类",
        viewProgress: "查看归档进度",
      }
    : {
        deadlineHint: "Calculated from the report date",
        idleHint:
          "Signoffs, review questions and project files are checked before you confirm archiving.",
        failed: "File check did not complete",
        retryHint:
          "The complete check result is unavailable. Please try again.",
        retry: "Retry check",
        group: "Check category",
        viewProgress: "View archive progress",
      };
}
