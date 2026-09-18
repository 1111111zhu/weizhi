import type {
  KnowledgeDepartment,
  KnowledgeType,
} from "@/lib/knowledge-catalog";

export const intranetLanguages = ["zh-CN", "en-US"] as const;

export type IntranetLanguage = (typeof intranetLanguages)[number];

export type IntranetDictionary = {
  mobile: {
    home: string;
    applications: string;
    more: string;
    back: string;
    browseAll: string;
    recentNotices: string;
    loadMore: string;
    searchHere: string;
    applicationDescriptions: Record<string, string>;
    knowledgeDescription: string;
    updated: string;
  };
  account: {
    current: string;
    menu: string;
    signOut: string;
    developmentAccountsEmpty: string;
    developmentAccountsLoading: string;
    switchAccount: string;
  };
  metadata: { title: string; description: string };
  brand: {
    name: string;
    userInitials: string;
  };
  search: { label: string; placeholder: string };
  settings: {
    appearance: string;
    day: string;
    fontSize: string;
    fontSizeOptions: Record<"sm" | "md" | "lg", string>;
    language: string;
    languageShortOptions: Record<IntranetLanguage, string>;
    night: string;
    title: string;
  };
  systems: {
    title: string;
    navigationLabel: string;
    help: string;
    pendingApproval: string;
  };
  knowledge: {
    title: string;
    resultCount: string;
    noResults: string;
    navigation: {
      currentLocation: string;
      allContent: string;
      secondaryDirectory: string;
      tertiaryDirectory: string;
      collapseSystems: string;
      expandSystems: string;
      recycleBin: string;
      returnHome: string;
      categoryLabels: Record<string, string>;
    };
    actions: {
      title: string;
      preview: string;
      download: string;
      unavailable: string;
    };
    manage: {
      action: string;
      archive: string;
      archiveDescription: string;
      cancel: string;
      confirmDelete: string;
      delete: string;
      deleteDescription: string;
      department: string;
      directory: string;
      edit: string;
      editTitle: string;
      operationError: string;
      restore: string;
      subdirectory: string;
      title: string;
    };
    upload: {
      action: string;
      selectSection: string;
      title: string;
      description: string;
      section: string;
      chooseFile: string;
      noFileSelected: string;
      referenceCode: string;
      referenceCodePlaceholder: string;
      itemTitle: string;
      itemTitlePlaceholder: string;
      type: string;
      file: string;
      fileHelp: string;
      cancel: string;
      submit: string;
      uploading: string;
      uploadError: string;
    };
    notice: {
      action: string;
      title: string;
      description: string;
      body: string;
      bodyPlaceholder: string;
      link: string;
      linkText: string;
      linkTextPlaceholder: string;
      linkPlaceholder: string;
      confirmLink: string;
      attachment: string;
      submit: string;
      publishing: string;
      bold: string;
      italic: string;
      bulletList: string;
      paragraph: string;
      heading1: string;
      heading2: string;
      heading3: string;
      orderedList: string;
      quote: string;
      horizontalRule: string;
      removeLink: string;
      removeAttachment: string;
      undo: string;
      redo: string;
      close: string;
      openLink: string;
    };
    columns: {
      referenceCode: string;
      title: string;
      type: string;
      owner: string;
      updatedAt: string;
    };
  };
  departments: Record<KnowledgeDepartment, string>;
  types: Record<KnowledgeType, string>;
};

const zhCN: IntranetDictionary = {
  mobile: {
    home: "工作台",
    applications: "应用入口",
    more: "更多操作",
    back: "返回上一级",
    browseAll: "查看全部内容",
    recentNotices: "近期通知",
    loadMore: "显示更多",
    searchHere: "搜索当前分类",
    applicationDescriptions: {
      EMP: "项目管理",
      CMP: "客户管理",
      TMS: "工时管理",
    },
    knowledgeDescription: "制度与资料",
    updated: "更新于",
  },
  account: {
    current: "当前账号",
    menu: "账号菜单",
    signOut: "退出登录",
    developmentAccountsEmpty: "没有可用的开发账号。",
    developmentAccountsLoading: "正在加载开发账号…",
    switchAccount: "切换账号",
  },
  metadata: {
    title: "Project Wing Intranet",
    description: "Project Wing 系统入口与内部知识门户",
  },
  brand: {
    name: "Intranet",
    userInitials: "PW",
  },
  search: {
    label: "搜索知识中心",
    placeholder: "搜索制度、流程、模板、技术资料…",
  },
  settings: {
    appearance: "外观",
    day: "日间",
    fontSize: "字号",
    fontSizeOptions: { sm: "小", md: "中", lg: "大" },
    language: "语言",
    languageShortOptions: { "zh-CN": "简", "en-US": "EN" },
    night: "夜间",
    title: "设置",
  },
  systems: {
    title: "常用系统",
    navigationLabel: "Project Wing 系统",
    help: "业务数据仍由各系统负责；Intranet 只提供统一入口和知识检索。",
    pendingApproval: "存在待审批",
  },
  knowledge: {
    title: "知识中心",
    resultCount: "共 {count} 项",
    noResults: "没有找到匹配的知识条目",
    navigation: {
      currentLocation: "当前位置",
      allContent: "全部内容",
      secondaryDirectory: "目录",
      tertiaryDirectory: "子目录",
      collapseSystems: "收起系统导航",
      expandSystems: "展开系统导航",
      recycleBin: "回收站",
      returnHome: "返回主页",
      categoryLabels: {
        policies: "制度与治理",
        operations: "行政运营",
        forms: "表单与模板",
        "people-policy": "人事制度",
        learning: "培训与发展",
        "staff-services": "员工服务",
        "finance-policy": "财务制度",
        expense: "费用与报销",
        reporting: "管理报告",
        technical: "Technical",
        audit: "Audit",
        accounting: "Accounting",
        tax: "Tax",
        "quality-management": "质量管理",
        methodology: "方法论",
        monitoring: "监控与整改",
        "risk-alerts": "风险提示",
        security: "信息安全",
        systems: "系统指南",
        service: "IT 服务",
      },
    },
    actions: {
      title: "操作",
      preview: "预览资料",
      download: "下载资料",
      unavailable: "该格式暂不支持在线预览",
    },
    manage: {
      action: "管理条目",
      archive: "归档到回收站",
      archiveDescription: "条目将从知识中心移入回收站，可随时恢复。",
      cancel: "取消",
      confirmDelete: "确认从系统永久删除",
      delete: "从系统删除",
      deleteDescription: "此操作会永久删除条目及其文件，无法恢复。",
      department: "部门",
      directory: "目录",
      edit: "编辑",
      editTitle: "编辑知识条目",
      operationError: "操作失败，请稍后重试。",
      restore: "从回收站恢复",
      subdirectory: "子目录",
      title: "管理知识条目",
    },
    upload: {
      action: "上传资料",
      selectSection: "请先选择一个具体部门",
      title: "上传知识资料",
      description: "选择部门与目录后上传资料，由统一知识服务管理。",
      section: "所属 Section",
      chooseFile: "选择文件",
      noFileSelected: "未选择任何文件",
      referenceCode: "参考编号",
      referenceCodePlaceholder: "例如 IT-POL-005",
      itemTitle: "资料标题",
      itemTitlePlaceholder: "输入便于检索的资料名称",
      type: "资料类型",
      file: "资料文件",
      fileHelp:
        "支持 PDF、Word、Excel 和 PowerPoint。文件将在服务端完成格式检查、权限校验、存储和审计记录。",
      cancel: "取消",
      submit: "上传",
      uploading: "上传中…",
      uploadError: "上传失败，请检查资料内容或稍后重试。",
    },
    notice: {
      action: "发布通知",
      title: "发布知识通知",
      description: "选择部门与目录后发布通知，可附带链接或资料附件。",
      body: "通知正文",
      bodyPlaceholder: "输入通知内容…",
      link: "相关链接（可选）",
      linkText: "显示文本",
      linkTextPlaceholder: "输入链接文字",
      linkPlaceholder: "https://",
      confirmLink: "插入链接",
      attachment: "附件（可选）",
      submit: "发布",
      publishing: "发布中…",
      bold: "加粗",
      italic: "斜体",
      bulletList: "项目符号列表",
      paragraph: "正文",
      heading1: "一级标题",
      heading2: "二级标题",
      heading3: "三级标题",
      orderedList: "编号列表",
      quote: "引用",
      horizontalRule: "分隔线",
      removeLink: "移除链接",
      removeAttachment: "移除附件",
      undo: "撤销",
      redo: "重做",
      close: "关闭",
      openLink: "打开相关链接",
    },
    columns: {
      referenceCode: "参考编号",
      title: "标题",
      type: "类型",
      owner: "最近修改人",
      updatedAt: "更新时间",
    },
  },
  departments: {
    recent: "最近更新",
    all: "全部",
    admin: "Admin",
    hr: "HR",
    finance: "Finance",
    qm: "QM",
    it: "IT",
  },
  types: {
    all: "全部",
    policy: "制度",
    process: "流程",
    form: "表单",
    template: "模板",
    technicalAlert: "技术通告",
    training: "培训资料",
    guide: "指南",
  },
};
const enUS: IntranetDictionary = {
  ...zhCN,
  mobile: {
    home: "Workspace",
    applicationDescriptions: {
      EMP: "Projects",
      CMP: "Clients",
      TMS: "Timesheets",
    },
    knowledgeDescription: "Policies & guides",
    updated: "Updated",
    applications: "Applications",
    more: "More actions",
    back: "Back",
    browseAll: "View all content",
    recentNotices: "Recent notices",
    loadMore: "Show more",
    searchHere: "Search this category",
  },
  account: {
    current: "Current account",
    menu: "Account menu",
    signOut: "Sign out",
    developmentAccountsEmpty: "No development accounts are available.",
    developmentAccountsLoading: "Loading development accounts…",
    switchAccount: "Switch account",
  },
  metadata: {
    title: "Project Wing Intranet",
    description: "Project Wing systems and internal knowledge portal",
  },
  brand: { ...zhCN.brand },
  search: {
    label: "Search Knowledge Center",
    placeholder: "Search policies, procedures, templates, and technical notes…",
  },
  settings: {
    appearance: "Appearance",
    day: "Day",
    fontSize: "Font size",
    fontSizeOptions: { sm: "Small", md: "Medium", lg: "Large" },
    language: "Language",
    languageShortOptions: { "zh-CN": "简", "en-US": "EN" },
    night: "Night",
    title: "Setting",
  },
  systems: {
    title: "Frequently Used Systems",
    navigationLabel: "Project Wing Systems",
    help: "Business data remains in each source system. Intranet provides a unified entry point and knowledge search.",
    pendingApproval: "Pending approvals",
  },
  knowledge: {
    title: "Knowledge Center",
    resultCount: "{count} items",
    noResults: "No matching knowledge items were found.",
    navigation: {
      currentLocation: "Current location",
      allContent: "All content",
      secondaryDirectory: "Directory",
      tertiaryDirectory: "Subdirectory",
      collapseSystems: "Collapse system navigation",
      expandSystems: "Expand system navigation",
      recycleBin: "Recycle bin",
      returnHome: "Back to home",
      categoryLabels: {
        policies: "Policy & governance",
        operations: "Operations",
        forms: "Forms & templates",
        "people-policy": "People policies",
        learning: "Learning & development",
        "staff-services": "Staff services",
        "finance-policy": "Finance policies",
        expense: "Expense & reimbursement",
        reporting: "Management reporting",
        technical: "Technical",
        audit: "Audit",
        accounting: "Accounting",
        tax: "Tax",
        "quality-management": "Quality management",
        methodology: "Methodology",
        monitoring: "Monitoring",
        "risk-alerts": "Risk alerts",
        security: "Information security",
        systems: "System guides",
        service: "IT services",
      },
    },
    actions: {
      title: "Actions",
      preview: "Preview material",
      download: "Download material",
      unavailable: "Online preview is unavailable for this format.",
    },
    manage: {
      action: "Manage item",
      archive: "Move to recycle bin",
      archiveDescription:
        "The item will be hidden from the knowledge center and can be restored later.",
      cancel: "Cancel",
      confirmDelete: "Permanently delete from the system",
      delete: "Delete permanently",
      deleteDescription:
        "This permanently deletes the item and its file and cannot be undone.",
      department: "Department",
      directory: "Directory",
      edit: "Edit",
      editTitle: "Edit knowledge item",
      operationError: "The operation failed. Please try again.",
      restore: "Restore from recycle bin",
      subdirectory: "Subdirectory",
      title: "Manage knowledge item",
    },
    upload: {
      action: "Upload material",
      selectSection: "Select a specific department first",
      title: "Upload knowledge material",
      description:
        "Choose a department and directory, then upload the material to the unified knowledge service.",
      section: "Section",
      chooseFile: "Choose file",
      noFileSelected: "No file selected",
      referenceCode: "Reference code",
      referenceCodePlaceholder: "For example, IT-POL-005",
      itemTitle: "Title",
      itemTitlePlaceholder: "Enter a searchable title",
      type: "Material type",
      file: "File",
      fileHelp:
        "Supports PDF, Word, Excel, and PowerPoint. The server validates the format, authorization, storage, and audit record.",
      cancel: "Cancel",
      submit: "Upload",
      uploading: "Uploading…",
      uploadError: "Upload failed. Check the material and try again.",
    },
    notice: {
      action: "Publish notice",
      title: "Publish knowledge notice",
      description:
        "Choose a department and directory, then publish the notice with an optional link or attachment.",
      body: "Notice body",
      bodyPlaceholder: "Write the notice…",
      link: "Related link (optional)",
      linkText: "Display text",
      linkTextPlaceholder: "Enter link text",
      linkPlaceholder: "https://",
      confirmLink: "Insert link",
      attachment: "Attachment (optional)",
      submit: "Publish",
      publishing: "Publishing…",
      bold: "Bold",
      italic: "Italic",
      bulletList: "Bulleted list",
      paragraph: "Paragraph",
      heading1: "Heading 1",
      heading2: "Heading 2",
      heading3: "Heading 3",
      orderedList: "Numbered list",
      quote: "Quote",
      horizontalRule: "Divider",
      removeLink: "Remove link",
      removeAttachment: "Remove attachment",
      undo: "Undo",
      redo: "Redo",
      close: "Close",
      openLink: "Open related link",
    },
    columns: {
      referenceCode: "Reference Code",
      title: "Title",
      type: "Type",
      owner: "Last modified by",
      updatedAt: "Updated",
    },
  },
  departments: { ...zhCN.departments, recent: "Recent", all: "All" },
  types: {
    all: "All",
    policy: "Policy",
    process: "Procedure",
    form: "Form",
    template: "Template",
    technicalAlert: "Technical Alert",
    training: "Training",
    guide: "Guide",
  },
};

export const intranetDictionaries = { enUS, zhCN } as const;
