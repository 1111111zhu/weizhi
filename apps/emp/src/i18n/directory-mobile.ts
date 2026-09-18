export function getDirectoryMobileCopy(locale: string) {
  return locale.startsWith("zh")
    ? {
        root: "全部目录",
        back: "返回上一级",
        current: "当前目录",
        more: "目录操作",
        close: "关闭",
        openFiles: "查看本级文件",
        search: "搜索目录名称或编号",
        clear: "清除搜索",
        create: "新建目录",
        children: "{count} 个子目录",
        copied: "已复制",
        cut: "待移动",
        cancel: "取消",
        confirm: "创建目录",
      }
    : {
        root: "All directories",
        back: "Up one level",
        current: "Current directory",
        more: "Directory actions",
        close: "Close",
        openFiles: "Files in this directory",
        search: "Search directory names or codes",
        clear: "Clear search",
        create: "New directory",
        children: "{count} subdirectories",
        copied: "Copied",
        cut: "Ready to move",
        cancel: "Cancel",
        confirm: "Create directory",
      };
}
