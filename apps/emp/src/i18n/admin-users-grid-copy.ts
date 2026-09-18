import type { Locale } from "./settings";

export type AdminUsersGridCopy = {
  user: string;
  globalRole: string;
  staffNo: string;
  rate: string;
  accountStatus: string;
  actions: string;
  userList: string;
  noUsers: string;
  findUsers: string;
  createUser: string;
  createUserDescription: string;
  cancel: string;
  pageTitle: string;
  pageDescription: string;
  allUsers: string;
  activeUsers: string;
  disabledUsers: string;
  passwordResetSuccess: string;
  currentAccount: string;
  enable: string;
  disable: string;
  resetPassword: string;
  allRoles: string;
  allStatuses: string;
  clearFilters: string;
  filters: string;
  email: string;
  name: string;
  initialPassword: string;
  autoAssigned: string;
  rateStandard: string;
};

export const adminUsersGridCopy: Record<Locale, AdminUsersGridCopy> = {
  "zh-CN": {
    user: "用户",
    globalRole: "全局职级",
    staffNo: "员工编号",
    rate: "费率",
    accountStatus: "账户状态",
    actions: "操作",
    userList: "用户列表",
    noUsers: "暂无用户",
    findUsers: "查找用户",
    createUser: "创建用户",
    createUserDescription: "创建具有初始密码和全局职级的账户。",
    cancel: "取消",
    pageTitle: "用户管理",
    pageDescription:
      "全局职级影响平台权限和未来邀请校验，但不会改写现有项目角色。",
    allUsers: "全部",
    activeUsers: "启用",
    disabledUsers: "停用",
    passwordResetSuccess: "密码已重置。",
    currentAccount: "当前账号",
    enable: "启用",
    disable: "停用",
    resetPassword: "重置密码",
    allRoles: "全部职级",
    allStatuses: "全部状态",
    clearFilters: "清除筛选",
    filters: "用户筛选",
    email: "邮箱",
    name: "姓名",
    initialPassword: "初始密码",
    autoAssigned: "自动分配",
    rateStandard: "标准费率",
  },
  "en-US": {
    user: "User",
    globalRole: "Global role",
    staffNo: "Staff No",
    rate: "Rate",
    accountStatus: "Account status",
    actions: "Actions",
    userList: "User list",
    noUsers: "No users",
    findUsers: "Find users",
    createUser: "Create user",
    createUserDescription:
      "Create an account with an initial password and global role.",
    cancel: "Cancel",
    pageTitle: "User management",
    pageDescription:
      "Global roles affect platform permissions and future invitation checks. They do not rewrite existing project roles.",
    allUsers: "All",
    activeUsers: "Active",
    disabledUsers: "Disabled",
    passwordResetSuccess: "Password reset.",
    currentAccount: "Current account",
    enable: "Enable",
    disable: "Disable",
    resetPassword: "Reset password",
    allRoles: "All roles",
    allStatuses: "All statuses",
    clearFilters: "Clear filters",
    filters: "User filters",
    email: "Email",
    name: "Name",
    initialPassword: "Initial password",
    autoAssigned: "Auto-assigned",
    rateStandard: "Rate standard",
  },
};
