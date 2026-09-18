/** EMP global settings inventory. Privilege is supplied by the authenticated caller, never the URL. */
export const mobileSettingsPages = {
  appearance: { title: "个性化", parent: "" },
  profile: { title: "账户资料", parent: "" },
  recycleBin: { title: "回收站", parent: "" },
  desktopAgent: { title: "Desktop Agent", parent: "" },
  agentCache: { title: "本地文件缓存", parent: "desktopAgent" },
  integrations: { title: "连接与集成", parent: "" },
  mail: { title: "企业邮箱", parent: "integrations" },
  systemConnections: { title: "系统连接", parent: "" },
  tracking: { title: "17TRACK", parent: "systemConnections" },
} as const;
export type MobileSettingsPage = keyof typeof mobileSettingsPages;
export function isMobileSettingsPage(
  value: string
): value is MobileSettingsPage {
  return Object.hasOwn(mobileSettingsPages, value);
}
export function canViewMobileSettingsPage(page: string, isSuperAdmin: boolean) {
  return (page !== "systemConnections" && page !== "tracking") || isSuperAdmin;
}
export function mobileSettingsParent(section: string) {
  return isMobileSettingsPage(section)
    ? mobileSettingsPages[section].parent
    : "";
}
export function mobileSettingsTitle(section: string) {
  return isMobileSettingsPage(section)
    ? mobileSettingsPages[section].title
    : "设置";
}
