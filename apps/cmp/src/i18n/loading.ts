import type { CmpLocale } from "./settings";

const loadingCopy = {
  "en-US": {
    clientWorkspace: "Loading client workspace",
    engagementForm: "Loading engagement form",
  },
  "zh-CN": {
    clientWorkspace: "正在加载客户工作区",
    engagementForm: "正在加载业务表单",
  },
} as const;

export function getCmpLoadingCopy(locale: CmpLocale) {
  return loadingCopy[locale];
}
