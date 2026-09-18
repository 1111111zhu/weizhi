import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type DesktopAgentLocale = "en-US" | "zh-CN";

export type DesktopAgentCopy = {
  recoveryHistory: string;
  missingHelp: string;
  leaseHelp: string;
  openProject: string;
  endTracking: string;
  processing: string;
  details: string;
  resolutionFailed: string;
  lastKnownFiles: string;
  unavailableActivity: string;
  fileRecoveryRequired: string;
  viewRetainedFiles: string;
  retainedFilesHelp: string;
  closeBeforeSync: string;
  accountMenu: string;
  actionsFor: (fileName: string) => string;
  activeFiles: string;
  appearance: string;
  checkForUpdates: string;
  checkingForUpdates: string;
  currentAccount: string;
  day: string;
  defaultAccountAvatar: string;
  downloadVersion: (version: string) => string;
  downloadingUpdate: string;
  fontSize: string;
  fontSizeOptions: Record<"sm" | "md" | "lg", string>;
  genericActionError: string;
  guest: string;
  language: string;
  languageShortOptions: Record<DesktopAgentLocale, string>;
  loadingActivity: string;
  loadingSettings: string;
  night: string;
  noActiveFiles: string;
  refresh: string;
  releaseFile: string;
  readOnlyFile: string;
  restartToUpdate: string;
  roleLabels: Record<string, string>;
  settings: string;
  signOut: string;
  statusLabels: Record<string, string>;
};

const roleLabelsEn = {
  SUPER_ADMIN: "Super Admin",
  HR: "HR",
  CONFIRMATION_OFFICER: "Confirmation Officer",
  EMPLOYEE: "Employee",
  PARTNER: "Partner",
  PRINCIPAL: "Principal",
  SENIOR_MANAGER: "Senior Manager",
  MANAGER: "Manager",
  SENIOR: "Senior",
  STAFF: "Staff",
  ASSISTANT: "Assistant",
  EQCR: "EQCR",
  TAX_EXPERT: "Tax Expert",
};

const statusLabelsEn = {
  LAUNCHING: "Launching",
  OPEN_NOT_OBSERVED: "Waiting for file",
  OPEN: "Open",
  OPEN_UNCHANGED: "Open",
  CLOSE_DETECTED: "Closing",
  CHECKING_IN: "Checking in",
  CHECKIN_FAILED: "Check-in failed",
  DIRTY_PENDING_CHECKIN: "Unsaved changes",
  LEASE_LOST: "Editing access expired",
  LOCK_REVOKED: "Editing access revoked",
  SERVER_FILE_REMOVED: "Removed from project",
  CLOSED: "Closed",
  CLEANUP_FAILED: "Cleanup failed",
  CLEANUP_PENDING: "Cleaning up",
  CONFLICT_RISK: "Conflict risk",
  LOCAL_FILE_MISSING: "Local file missing",
  RELEASE_PENDING: "Release pending",
  RELEASING: "Releasing",
  RELEASE_FAILED: "Release failed",
};

const dictionaries: Record<DesktopAgentLocale, DesktopAgentCopy> = {
  "en-US": {
    viewRetainedFiles: "View retained local files",
    retainedFilesHelp:
      "Open the retained-file folder and copy needed files to a safe location for review with support. Do not delete or overwrite files in this managed folder. Files are not automatically uploaded or reassociated.",
    fileRecoveryRequired:
      "Some file records require recovery. Local copies are preserved; service restart alone does not resolve these files.",
    closeBeforeSync:
      "Save and close the document to synchronize automatically. Local changes will not be discarded.",
    lastKnownFiles:
      "Connection interrupted. Showing last-known files; current sync status is unconfirmed. File actions are temporarily disabled.",
    unavailableActivity:
      "File status is unavailable. This does not mean there are no active files.",
    accountMenu: "Account menu",
    actionsFor: (fileName) => `Actions for ${fileName}`,
    activeFiles: "Active files",
    appearance: "Appearance",
    checkForUpdates: "Check for updates",
    checkingForUpdates: "Checking for updates",
    currentAccount: "Current account",
    day: "Day",
    defaultAccountAvatar: "Default account avatar",
    downloadVersion: (version) => `Download ${version}`,
    downloadingUpdate: "Downloading update",
    fontSize: "Font size",
    fontSizeOptions: { sm: "Small", md: "Medium", lg: "Large" },
    genericActionError:
      "Desktop Agent could not complete this action. Try again.",
    guest: "Guest",
    language: "Language",
    languageShortOptions: { "zh-CN": "简", "en-US": "EN" },
    loadingActivity: "Loading activity",
    loadingSettings: "Loading settings",
    night: "Night",
    noActiveFiles: "No active files",
    refresh: "Refresh",
    recoveryHistory: "Recovery history and saved copies",
    missingHelp:
      "The cached file is missing. Reopen from the project, or end this old record. Missing unuploaded edits cannot be restored by downloading again.",
    leaseHelp:
      "The old editing session expired. Preserve your copy, then reopen from the project for fresh access.",
    openProject: "Open project",
    endTracking: "End tracking…",
    processing: "Processing…",
    details: "Technical details",
    resolutionFailed:
      "Not completed. The record is retained; retry or share the details with project support.",
    releaseFile: "Retry sync and release",
    readOnlyFile: "Read-only · Check-in is unavailable",
    restartToUpdate: "Restart to update",
    roleLabels: roleLabelsEn,
    settings: "Settings",
    signOut: "Sign out",
    statusLabels: statusLabelsEn,
  },
  "zh-CN": {
    viewRetainedFiles: "查看保留的本地文件",
    retainedFilesHelp:
      "打开保留文件目录，将需要的文件复制到安全位置后与支持人员核对。请勿直接删除或覆盖受控目录中的文件；系统不会自动上传或重新关联这些文件。",
    fileRecoveryRequired:
      "部分文件记录需要恢复，本地副本已保留；仅重启服务不能解决这些文件的问题。",
    closeBeforeSync: "保存并关闭文档后将自动同步，不会丢弃本地修改。",
    lastKnownFiles:
      "连接中断，正在显示最后已知的文件；当前同步状态尚未确认，文件操作暂不可用。",
    unavailableActivity: "暂时无法读取文件状态，不代表没有正在处理的文件。",
    accountMenu: "账号菜单",
    actionsFor: (fileName) => `${fileName} 的操作`,
    activeFiles: "活动文件",
    appearance: "外观",
    checkForUpdates: "检查更新",
    checkingForUpdates: "正在检查更新",
    currentAccount: "当前账号",
    day: "日间",
    defaultAccountAvatar: "默认账号头像",
    downloadVersion: (version) => `下载 ${version}`,
    downloadingUpdate: "正在下载更新",
    fontSize: "字号",
    fontSizeOptions: { sm: "小", md: "中", lg: "大" },
    genericActionError: "Desktop Agent 无法完成此操作，请重试。",
    guest: "访客",
    language: "语言",
    languageShortOptions: { "zh-CN": "简", "en-US": "EN" },
    loadingActivity: "正在加载活动文件",
    loadingSettings: "正在加载设置",
    night: "夜间",
    noActiveFiles: "暂无活动文件",
    refresh: "刷新",
    recoveryHistory: "恢复历史与保留副本",
    missingHelp:
      "缓存文件找不到了。可从项目重新打开，或结束旧记录；重新下载无法找回未上传的修改。",
    leaseHelp:
      "原编辑会话已失效。请先保留本地副本，再从项目重新打开以获取编辑权限。",
    openProject: "打开项目",
    endTracking: "结束跟踪…",
    processing: "处理中…",
    details: "技术详情",
    resolutionFailed: "未完成，记录仍保留。可重试，或将详情交给项目支持人员。",
    releaseFile: "重试同步并释放",
    readOnlyFile: "只读文件 · 不支持签入",
    restartToUpdate: "重启并更新",
    roleLabels: {
      SUPER_ADMIN: "超级管理员",
      HR: "人力资源",
      CONFIRMATION_OFFICER: "询证函专员",
      EMPLOYEE: "员工",
      PARTNER: "合伙人",
      PRINCIPAL: "总监",
      SENIOR_MANAGER: "高级经理",
      MANAGER: "经理",
      SENIOR: "高级员工",
      STAFF: "员工",
      ASSISTANT: "助理",
      EQCR: "项目质量复核人",
      TAX_EXPERT: "税务专家",
    },
    settings: "设置",
    signOut: "退出登录",
    statusLabels: {
      LAUNCHING: "正在启动",
      OPEN_NOT_OBSERVED: "等待文件打开",
      OPEN: "已打开",
      OPEN_UNCHANGED: "已打开",
      CLOSE_DETECTED: "正在关闭",
      CHECKING_IN: "正在签入",
      CHECKIN_FAILED: "签入失败",
      DIRTY_PENDING_CHECKIN: "有未签入更改",
      LEASE_LOST: "编辑权限已失效",
      LOCK_REVOKED: "编辑权限已撤销",
      SERVER_FILE_REMOVED: "项目文件已删除",
      CLOSED: "已关闭",
      CLEANUP_FAILED: "清理失败",
      CLEANUP_PENDING: "正在清理",
      CONFLICT_RISK: "存在冲突风险",
      LOCAL_FILE_MISSING: "本地文件缺失",
      RELEASE_PENDING: "等待释放",
      RELEASING: "正在释放",
      RELEASE_FAILED: "释放失败",
    },
  },
};

const localeStorageKey = "project-wing:desktop-agent:locale";
const I18nContext = createContext<{
  copy: DesktopAgentCopy;
  locale: DesktopAgentLocale;
  setLocale: (locale: DesktopAgentLocale) => void;
} | null>(null);

export function normalizeDesktopAgentLocale(value?: string | null) {
  return value?.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
}

export function getDesktopAgentCopy(locale: DesktopAgentLocale) {
  return dictionaries[locale];
}

function getInitialLocale() {
  try {
    const stored = window.localStorage.getItem(localeStorageKey);
    return stored
      ? normalizeDesktopAgentLocale(stored)
      : normalizeDesktopAgentLocale(navigator.language);
  } catch {
    return normalizeDesktopAgentLocale(navigator.language);
  }
}

export function DesktopAgentI18nProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [locale, setLocale] = useState<DesktopAgentLocale>(getInitialLocale);
  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      window.localStorage.setItem(localeStorageKey, locale);
    } catch {
      // The active Electron session still retains the selected locale.
    }
  }, [locale]);
  const value = useMemo(
    () => ({ copy: getDesktopAgentCopy(locale), locale, setLocale }),
    [locale]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useDesktopAgentI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error(
      "useDesktopAgentI18n must be used within DesktopAgentI18nProvider"
    );
  }
  return context;
}

export function formatDesktopAgentStatus(
  status: string,
  copy: DesktopAgentCopy
) {
  return copy.statusLabels[status] ?? status.replaceAll("_", " ").toLowerCase();
}
