import type { DesktopAgentTrayState } from "@project-wing/desktop-agent/tray";

export type DesktopAgentCopy = typeof englishCopy;

const englishCopy = {
  productName: "Project Wing",
  panelName: "Desktop Agent",
  activeSessions: "Active sessions",
  recentSessions: "Recently opened",
  noSessions: "No active files",
  noSessionsDetail: "Files opened from Project Wing appear here.",
  noActiveSessions: "No files are open right now.",
  openProjects: "Open Project Wing",
  openProject: "Open project",
  automaticSessionHint:
    "Opening a file creates an active session automatically.",
  refresh: "Refresh",
  minimizeWindow: "Minimize window",
  maximizeWindow: "Maximize window",
  restoreWindow: "Restore window",
  closeWindow: "Close Desktop Agent",
  closeConfirmTitle: "Exit Desktop Agent?",
  closeConfirmMessage:
    "Open files or background work may be interrupted. The Desktop Agent will stop completely.",
  cancel: "Cancel",
  close: "Close",
  retry: "Retry",
  checkIn: "Check in",
  release: "Release lock",
  recoverRelease: "Release safely",
  update: "Update",
  updating: "Updating…",
  attention: "Needs attention",
  version: "Version",
  pairHint: "Open Project Wing in your browser to pair this device.",
  offlineHint: "The local runtime is not responding. It may still be starting.",
  failedHint: "The runtime needs intervention before files can be managed.",
  actionFailed: "The action could not be completed.",
  lastUpdated: "Updated just now",
  states: {
    OFFLINE: "Offline",
    STARTING: "Starting",
    PAIR_REQUIRED: "Pair this device",
    PAIRING: "Pairing",
    READY: "Ready",
    UPDATING: "Updating",
    ATTENTION: "Attention required",
    FAILED: "Runtime failed",
  } satisfies Record<DesktopAgentTrayState, string>,
  statuses: {
    OPEN_UNCHANGED: "Open · unchanged",
    DIRTY_PENDING_CHECKIN: "Changes pending",
    CHECKING_IN: "Checking in",
    CHECKIN_FAILED: "Check-in failed",
    RELEASE_PENDING: "Release pending",
    RELEASING: "Releasing",
    RELEASE_FAILED: "Release failed",
    CLEANUP_PENDING: "Cleanup pending",
    CLEANUP_FAILED: "Cleanup failed",
    LOCAL_FILE_MISSING: "Local file missing",
    CONFLICT_RISK: "Conflict risk",
    LEASE_LOST: "Lease lost · changes preserved",
    LOCK_REVOKED: "Lock revoked",
    CLOSED: "Closed",
  },
  modes: { MASTER: "Master", READ_ONLY: "Read only" },
};
const chineseCopy: DesktopAgentCopy = {
  ...englishCopy,
  productName: "Project Wing",
  panelName: "桌面助手",
  activeSessions: "活动会话",
  recentSessions: "最近打开",
  noSessions: "暂无活动文件",
  noSessionsDetail: "从 Project Wing 打开的文件会显示在这里。",
  noActiveSessions: "当前没有打开的文件。",
  openProjects: "从 Project Wing 打开文件",
  openProject: "打开项目",
  automaticSessionHint: "打开文件后，助手会自动建立活动会话",
  refresh: "刷新",
  minimizeWindow: "最小化窗口",
  maximizeWindow: "最大化窗口",
  restoreWindow: "还原窗口",
  closeWindow: "关闭桌面助手",
  closeConfirmTitle: "退出桌面助手？",
  closeConfirmMessage: "打开的文件或后台操作可能会被中断，桌面助手将完全停止。",
  cancel: "取消",
  close: "关闭",
  retry: "重试",
  checkIn: "签入",
  release: "释放锁定",
  recoverRelease: "安全释放",
  update: "更新",
  updating: "正在更新…",
  attention: "需要处理",
  version: "版本",
  pairHint: "请在浏览器中打开 Project Wing 以配对此设备。",
  offlineHint: "本地运行时没有响应，可能仍在启动。",
  failedHint: "运行时需要处理后才能继续管理文件。",
  actionFailed: "操作未能完成。",
  lastUpdated: "刚刚更新",
  states: {
    OFFLINE: "离线",
    STARTING: "正在启动",
    PAIR_REQUIRED: "配对此设备",
    PAIRING: "正在配对",
    READY: "就绪",
    UPDATING: "正在更新",
    ATTENTION: "需要处理",
    FAILED: "运行时故障",
  },
  statuses: {
    OPEN_UNCHANGED: "已打开 · 未更改",
    DIRTY_PENDING_CHECKIN: "更改待签入",
    CHECKING_IN: "正在签入",
    CHECKIN_FAILED: "签入失败",
    RELEASE_PENDING: "等待释放",
    RELEASING: "正在释放",
    RELEASE_FAILED: "释放失败",
    CLEANUP_PENDING: "等待清理",
    CLEANUP_FAILED: "清理失败",
    LOCAL_FILE_MISSING: "本地文件缺失",
    CONFLICT_RISK: "存在冲突风险",
    LEASE_LOST: "租约已失效 · 修改已保留",
    LOCK_REVOKED: "锁定已撤销",
    CLOSED: "已关闭",
  },
  modes: { MASTER: "主文件", READ_ONLY: "只读" },
};

export function resolveDesktopAgentCopy(
  locale = readLocale()
): DesktopAgentCopy {
  return locale.toLowerCase().startsWith("zh") ? chineseCopy : englishCopy;
}

function readLocale() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return "en-US";
  }
}
