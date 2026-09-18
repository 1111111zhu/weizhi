export const knowledgeDepartmentIds = [
  "recent",
  "all",
  "admin",
  "hr",
  "finance",
  "qm",
  "it",
] as const;

export const knowledgeTypeIds = [
  "all",
  "policy",
  "process",
  "form",
  "template",
  "technicalAlert",
  "training",
  "guide",
] as const;

export type KnowledgeDepartment = (typeof knowledgeDepartmentIds)[number];
export type KnowledgeType = (typeof knowledgeTypeIds)[number];

export type KnowledgeCategory = {
  id: string;
  children?: KnowledgeCategory[];
};

export const knowledgeCategories: Record<
  Exclude<KnowledgeDepartment, "recent" | "all">,
  KnowledgeCategory[]
> = {
  admin: [{ id: "policies" }, { id: "operations" }, { id: "forms" }],
  hr: [{ id: "people-policy" }, { id: "learning" }, { id: "staff-services" }],
  finance: [{ id: "finance-policy" }, { id: "expense" }, { id: "reporting" }],
  qm: [
    {
      id: "technical",
      children: [{ id: "audit" }, { id: "accounting" }, { id: "tax" }],
    },
    {
      id: "quality-management",
      children: [{ id: "methodology" }, { id: "monitoring" }],
    },
    { id: "risk-alerts" },
  ],
  it: [{ id: "security" }, { id: "systems" }, { id: "service" }],
};

export type KnowledgeItem = {
  id?: string;
  referenceCode?: string;
  title: string;
  department: Exclude<KnowledgeDepartment, "recent" | "all">;
  type: Exclude<KnowledgeType, "all">;
  owner: string;
  ownerAvatar?: string;
  ownerId?: string;
  updatedAt: string;
  kind?: "FILE" | "NOTICE";
  secondaryCategory?: string;
  tertiaryCategory?: string;
  body?: unknown;
  externalLink?: string;
  previewAllowed?: boolean;
  downloadAllowed?: boolean;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  fileName?: string;
  mimeType?: string;
  previewUrl?: string;
  previewVersion?: string;
  downloadUrl?: string;
};
