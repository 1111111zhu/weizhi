import "dotenv/config";
import { createHash } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import type {
  Prisma,
  GlobalRole,
  RoleScope,
  WorkflowNodeType,
} from "@prisma/client";
import { DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE } from "@project-wing/shared";
import { hash } from "bcryptjs";

import { buildCmpDemoRelationships } from "../src/cmp/cmp-demo-relationships";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: assertPresentValue(process.env.DATABASE_URL),
  }),
});
const permissions = [
  ["users.manage", "用户管理", "创建、查找和重置用户"],
  ["projects.create", "项目创建", "创建审计项目"],
  ["projects.view", "项目查看", "查看项目"],
  ["members.manage", "成员管理", "管理项目成员和邀请"],
  ["invitations.create", "邀请链接生成", "生成项目邀请链接"],
  ["workflow.view", "目录查看", "查看审计目录"],
  ["workflow.create", "目录创建", "创建目录节点"],
  ["papers.create", "底稿文件创建", "创建底稿或补充资料文件"],
  ["papers.edit", "底稿文件编辑", "编辑底稿或补充资料文件"],
  ["audit_logs.view", "审计日志查看", "查看项目审计日志"],
] as const;
const roleDefinitions: {
  code: string;
  name: string;
  scope: RoleScope;
  permissions: string[];
}[] = [
  {
    code: "SUPER_ADMIN",
    name: "Super Admin",
    scope: "GLOBAL",
    permissions: ["users.manage", "audit_logs.view"],
  },
  {
    code: "CONFIRMATION_OFFICER",
    name: "Confirmation Officer",
    scope: "GLOBAL",
    permissions: ["projects.view", "audit_logs.view"],
  },
  {
    code: "HR",
    name: "Human Resources",
    scope: "GLOBAL",
    permissions: [],
  },
  {
    code: "PARTNER",
    name: "Partner",
    scope: "PROJECT",
    permissions: [
      "projects.create",
      "projects.view",
      "members.manage",
      "invitations.create",
      "workflow.view",
      "workflow.create",
      "papers.create",
      "papers.edit",
      "audit_logs.view",
    ],
  },
  {
    code: "REVIEWER",
    name: "Reviewer",
    scope: "PROJECT",
    permissions: [
      "projects.view",
      "members.manage",
      "invitations.create",
      "workflow.view",
      "workflow.create",
      "papers.create",
      "papers.edit",
      "audit_logs.view",
    ],
  },
  {
    code: "PREPARER",
    name: "Preparer",
    scope: "PROJECT",
    permissions: [
      "projects.view",
      "workflow.view",
      "workflow.create",
      "papers.create",
      "papers.edit",
    ],
  },
  {
    code: "EQCR",
    name: "EQR",
    scope: "PROJECT",
    permissions: ["projects.view", "workflow.view", "audit_logs.view"],
  },
  {
    code: "TAX_REVIEWER",
    name: "Expert",
    scope: "PROJECT",
    permissions: ["projects.view", "workflow.view", "audit_logs.view"],
  },
];
const frameworkTemplates = [
  {
    id: "framework-hkfrs",
    code: "HKFRS",
    name: "HKFRS audit framework",
    language: "zh-CN",
    description:
      "Default Hong Kong Financial Reporting Standards audit framework.",
  },
  {
    id: "framework-ifrs",
    code: "IFRS",
    name: "IFRS audit framework",
    language: "en-US",
    description:
      "Default International Financial Reporting Standards audit framework.",
  },
  {
    id: "framework-cas",
    code: "CAS",
    name: "CAS audit framework",
    language: "zh-CN",
    description: "Default China Accounting Standards audit framework.",
  },
];
const workpaperTemplates = [
  {
    code: "FA-AUDIT-PROGRAM",
    name: "Fixed assets audit program",
    subjectCode: "FIXED_ASSETS",
    subjectName: "Fixed assets",
    language: "en-US",
    description:
      "Core fixed assets workpapers covering roll-forward, additions, disposals, depreciation and impairment review.",
    items: [
      {
        itemCode: "FA-ROLLFORWARD",
        title: "Fixed assets roll-forward",
        description:
          "Reconcile opening balance, additions, disposals and closing balance.",
        sortOrder: 1,
      },
      {
        itemCode: "FA-ADDITIONS",
        title: "Additions testing",
        description:
          "Test significant additions to invoices, approvals and capitalization policy.",
        sortOrder: 2,
      },
      {
        itemCode: "FA-DEPRECIATION",
        title: "Depreciation reasonableness",
        description:
          "Recalculate depreciation and assess useful lives and residual values.",
        sortOrder: 3,
      },
      {
        itemCode: "FA-IMPAIRMENT",
        title: "Impairment indicator review",
        description:
          "Document impairment indicators and management's assessment.",
        sortOrder: 4,
      },
    ],
  },
  {
    code: "FA-AUDIT-PROGRAM-ZH",
    name: "固定资产审计程序",
    subjectCode: "FIXED_ASSETS",
    subjectName: "固定资产",
    language: "zh-CN",
    description:
      "覆盖固定资产期初衔接、本期增加、处置、折旧测算和减值迹象复核的基础底稿模板。",
    items: [
      {
        itemCode: "FA-ROLLFORWARD",
        title: "固定资产增减变动表",
        description:
          "核对期初余额、本期增加、处置和期末余额，并与总账及明细账勾稽。",
        sortOrder: 1,
      },
      {
        itemCode: "FA-ADDITIONS",
        title: "固定资产新增测试",
        description: "抽查重大新增资产的发票、审批、验收和资本化政策适用情况。",
        sortOrder: 2,
      },
      {
        itemCode: "FA-DEPRECIATION",
        title: "折旧合理性复核",
        description: "复核折旧测算、预计使用年限、残值率和折旧政策的一贯性。",
        sortOrder: 3,
      },
      {
        itemCode: "FA-IMPAIRMENT",
        title: "减值迹象复核",
        description: "记录固定资产减值迹象识别和管理层减值评估结论。",
        sortOrder: 4,
      },
    ],
  },
  {
    code: "IA-AUDIT-PROGRAM",
    name: "Intangible assets audit program",
    subjectCode: "INTANGIBLE_ASSETS",
    subjectName: "Intangible assets",
    language: "en-US",
    description:
      "Core intangible assets workpapers covering recognition, amortisation and impairment indicators.",
    items: [
      {
        itemCode: "IA-ROLLFORWARD",
        title: "Intangible assets roll-forward",
        description:
          "Reconcile movement schedule to the general ledger and prior year closing balance.",
        sortOrder: 1,
      },
      {
        itemCode: "IA-RECOGNITION",
        title: "Recognition and useful life assessment",
        description:
          "Evaluate recognition criteria, ownership evidence and useful life assumptions.",
        sortOrder: 2,
      },
      {
        itemCode: "IA-AMORTISATION",
        title: "Amortisation recalculation",
        description:
          "Recalculate amortisation and agree charge to the general ledger.",
        sortOrder: 3,
      },
      {
        itemCode: "IA-IMPAIRMENT",
        title: "Impairment indicator review",
        description:
          "Assess internal and external impairment indicators for intangible assets.",
        sortOrder: 4,
      },
    ],
  },
  {
    code: "IA-AUDIT-PROGRAM-ZH",
    name: "无形资产审计程序",
    subjectCode: "INTANGIBLE_ASSETS",
    subjectName: "无形资产",
    language: "zh-CN",
    description:
      "覆盖无形资产确认、摊销、权属证据和减值迹象复核的基础底稿模板。",
    items: [
      {
        itemCode: "IA-ROLLFORWARD",
        title: "无形资产增减变动表",
        description: "核对无形资产本期变动、期末余额与总账及明细账的一致性。",
        sortOrder: 1,
      },
      {
        itemCode: "IA-RECOGNITION",
        title: "确认条件与使用寿命评估",
        description: "评价确认条件、权属证据、预计使用寿命和摊销政策是否合理。",
        sortOrder: 2,
      },
      {
        itemCode: "IA-AMORTISATION",
        title: "摊销重新计算",
        description: "重新计算本期摊销金额，并与总账和费用分摊记录核对。",
        sortOrder: 3,
      },
      {
        itemCode: "IA-IMPAIRMENT",
        title: "减值迹象复核",
        description:
          "评估内外部减值迹象，并记录管理层减值测试或无需测试的依据。",
        sortOrder: 4,
      },
    ],
  },
];
const retiredSeededWorkpaperTemplateCodes = [
  "FA-AUDIT-PROGRAM",
  "FA-AUDIT-PROGRAM-ZH",
  "IA-AUDIT-PROGRAM",
  "IA-AUDIT-PROGRAM-ZH",
];
const retiredSeededProjectTemplateCodes = ["CAS-STANDARD-AUDIT"];

type SeedProjectTemplateNode = {
  code: string;
  title: string;
  level: number;
  nodeType: WorkflowNodeType;
  sortOrder: number;
  children?: SeedProjectTemplateNode[];
};

const projectTemplates: {
  code: string;
  name: string;
  language: string;
  frameworkCode: string;
  description: string;
  nodes: SeedProjectTemplateNode[];
}[] = [];

async function createProjectTemplateNodes(
  projectTemplateId: string,
  parentId: string | null,
  nodes: SeedProjectTemplateNode[]
) {
  for (const node of nodes) {
    const createdNode = await prisma.projectTemplateNode.create({
      data: {
        projectTemplateId,
        parentId,
        code: node.code,
        title: node.title,
        level: node.level,
        nodeType: node.nodeType,
        sortOrder: node.sortOrder,
      },
    });

    if (node.children?.length) {
      await createProjectTemplateNodes(
        projectTemplateId,
        createdNode.id,
        node.children
      );
    }
  }
}

async function upsertSeedCredentialUser(input: {
  email: string;
  globalRole: GlobalRole;
  name: string;
  password: string;
  update?: { globalRole?: GlobalRole; name?: string };
}) {
  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: input.update ?? {},
    create: {
      email: input.email,
      name: input.name,
      globalRole: input.globalRole,
    },
  });
  const credentialPasswordHash = await hash(input.password, 12);
  await prisma.authAccount.upsert({
    where: {
      providerId_accountId: {
        providerId: "credential",
        accountId: user.id,
      },
    },
    create: {
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: credentialPasswordHash,
    },
    update: {},
  });
  return user;
}

async function resolveCmpSeedGroup(input: {
  clientCode: string;
  fallbackGroupCode: string;
  nameZh: string;
  nameEn: string;
}) {
  const existingClient = await prisma.cmpClient.findUnique({
    where: { clientCode: input.clientCode },
    select: { groupId: true },
  });
  if (existingClient?.groupId) {
    return prisma.cmpClientGroup.findUniqueOrThrow({
      where: { id: existingClient.groupId },
    });
  }
  const group = await prisma.cmpClientGroup.upsert({
    where: { groupCode: input.fallbackGroupCode },
    update: {},
    create: {
      groupCode: input.fallbackGroupCode,
      nameZh: input.nameZh,
      nameEn: input.nameEn,
    },
  });
  if (existingClient) {
    await prisma.cmpClient.updateMany({
      where: { clientCode: input.clientCode, groupId: null },
      data: { groupId: group.id },
    });
  }
  return group;
}

async function seedCmpGroupExamples() {
  await prisma.$transaction(async (tx) => {
    const groupDefinitions = [
      ["seed-cmp-group-alpha", "DEMO-GROUP-ALPHA", "Alpha Demo Group"],
      ["seed-cmp-group-beta", "DEMO-GROUP-BETA", "Beta Demo Group"],
      ["seed-cmp-group-gamma", "DEMO-GROUP-GAMMA", "Gamma Demo Group"],
    ] as const;
    const groups = new Map<string, { id: string }>();
    for (const [id, groupCode, name] of groupDefinitions) {
      const group = await tx.cmpClientGroup.upsert({
        where: { groupCode },
        update: {},
        create: { id, groupCode, nameZh: name, nameEn: name },
      });
      groups.set(groupCode, group);
    }

    const clientDefinitions = [
      [
        "seed-cmp-client-alpha-parent",
        "DEMO-ALPHA-HOLD",
        "DEMO-A-001",
        "Alpha Holdings Limited",
        "DEMO-GROUP-ALPHA",
        "Investment holding",
      ],
      [
        "seed-cmp-client-alpha-ops",
        "DEMO-ALPHA-OPS",
        "DEMO-A-002",
        "Alpha Operations Limited",
        "DEMO-GROUP-ALPHA",
        "Logistics",
      ],
      [
        "seed-cmp-client-alpha-digital",
        "DEMO-ALPHA-DIGI",
        "DEMO-A-003",
        "Alpha Digital Services Limited",
        "DEMO-GROUP-ALPHA",
        "Technology services",
      ],
      [
        "seed-cmp-client-beta-parent",
        "DEMO-BETA-HOLD",
        "DEMO-B-001",
        "Beta Holdings Limited",
        "DEMO-GROUP-BETA",
        "Investment holding",
      ],
      [
        "seed-cmp-client-beta-cloud",
        "DEMO-BETA-CLOUD",
        "DEMO-B-002",
        "Beta Cloud Services Limited",
        "DEMO-GROUP-BETA",
        "Cloud services",
      ],
      [
        "seed-cmp-client-gamma-parent",
        "DEMO-GAMMA-HOLD",
        "DEMO-C-001",
        "Gamma Holdings Limited",
        "DEMO-GROUP-GAMMA",
        "Retail",
      ],
    ] as const;
    const clients = new Map<
      string,
      { id: string; groupId: string | null; status: string }
    >();
    for (const [
      id,
      clientCode,
      companyNumber,
      name,
      groupCode,
      industry,
    ] of clientDefinitions) {
      const group = assertPresentValue(groups.get(groupCode));
      const client = await tx.cmpClient.upsert({
        where: { clientCode },
        update: {
          clientPartnerPic: "Jony Ma",
          clientManagerMic: "Leo Li",
        },
        create: {
          id,
          clientCode,
          companyNumber,
          nameZh: name,
          nameEn: name,
          groupId: group.id,
          hsicSectionCode: industry === "Retail" ? "G" : "J",
          yearEndDate: new Date("2026-12-31T00:00:00.000Z"),
          placeOfIncorporation: "Hong Kong",
          listedOrPrivate: "PRIVATE",
          clientPartnerPic: "Jony Ma",
          clientManagerMic: "Leo Li",
          serviceLines: "Audit",
          approvalReferenceNumber: `NCA-${companyNumber}`,
          approvalDate: new Date("2026-01-15T00:00:00.000Z"),
        },
      });
      if (client.groupId !== group.id) {
        throw new Error(
          `Demo Client ${clientCode} belongs to a non-demo Group`
        );
      }
      clients.set(clientCode, client);
    }

    for (const [groupCode, clientCode] of [
      ["DEMO-GROUP-ALPHA", "DEMO-ALPHA-HOLD"],
      ["DEMO-GROUP-BETA", "DEMO-BETA-HOLD"],
      ["DEMO-GROUP-GAMMA", "DEMO-GAMMA-HOLD"],
    ] as const) {
      const ultimateParent = assertPresentValue(clients.get(clientCode));
      if (ultimateParent.status !== "ACTIVE") {
        continue;
      }
      await tx.cmpClientGroup.updateMany({
        where: {
          id: assertPresentValue(groups.get(groupCode)).id,
          ultimateParentClientId: null,
        },
        data: { ultimateParentClientId: ultimateParent.id },
      });
    }

    const relationships = buildCmpDemoRelationships(
      (clientCode) => assertPresentValue(clients.get(clientCode)).id
    );
    for (const [
      id,
      groupCode,
      fromClientId,
      toClientId,
      type,
      ownership,
      date,
      remarks,
    ] of relationships) {
      const existing = await tx.cmpClientRelationship.findFirst({
        where: { fromClientId, toClientId, type },
        select: { id: true },
      });
      if (!existing) {
        await tx.cmpClientRelationship.create({
          data: {
            id,
            groupId: assertPresentValue(groups.get(groupCode)).id,
            fromClientId,
            toClientId,
            type,
            ownershipPercentage: ownership,
            effectiveFrom: new Date(`${date}T00:00:00.000Z`),
            remarks,
          },
        });
      }
    }
  });
}

async function seedSmartFormV2(adminUserId: string) {
  const definition = structuredClone(
    DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE
  ) as Prisma.InputJsonValue;
  const definitionHash = createHash("sha256")
    .update(JSON.stringify(definition))
    .digest("hex");
  const templateId = "sft_audit_deferred_income_v2_20260731";
  const versionId = "sftv_audit_deferred_income_v2_20260731";
  const template = await prisma.smartFormTemplate.upsert({
    where: { code: "SF-AUD-DEFERRED-INCOME" },
    update: {
      name: "Audit Programme — Deferred Income",
      description:
        "Bilingual Deferred Income audit programme backed by the native SmartForm V2 AST.",
      status: "PUBLISHED",
      draftDefinitionJson: definition,
      updatedBy: adminUserId,
    },
    create: {
      id: templateId,
      code: "SF-AUD-DEFERRED-INCOME",
      name: "Audit Programme — Deferred Income",
      description:
        "Bilingual Deferred Income audit programme backed by the native SmartForm V2 AST.",
      status: "PUBLISHED",
      draftDefinitionJson: definition,
      createdBy: adminUserId,
      updatedBy: adminUserId,
    },
  });
  const version = await prisma.smartFormTemplateVersion.upsert({
    where: { id: versionId },
    update: {
      definitionJson: definition,
      definitionHash,
      publishedBy: adminUserId,
    },
    create: {
      id: versionId,
      templateId: template.id,
      version: 1,
      definitionJson: definition,
      definitionHash,
      publishedBy: adminUserId,
    },
  });
  await prisma.smartFormTemplate.update({
    where: { id: template.id },
    data: { currentPublishedVersionId: version.id },
  });
}

async function main() {
  await prisma.role.deleteMany({
    where: {
      code: { in: ["MANAGER", "SENIOR", "STAFF"] },
      scope: "PROJECT",
    },
  });

  for (const [code, name, description] of permissions) {
    await prisma.permission.upsert({
      where: { code },
      update: { name, description },
      create: { code, name, description },
    });
  }

  for (const definition of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: { code: definition.code },
      update: { name: definition.name, scope: definition.scope },
      create: {
        code: definition.code,
        name: definition.name,
        scope: definition.scope,
      },
    });
    for (const permissionCode of definition.permissions) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { code: permissionCode },
      });
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permission.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  for (const template of frameworkTemplates) {
    await prisma.frameworkTemplate.upsert({
      where: { code: template.code },
      update: {
        name: template.name,
        language: template.language,
        description: template.description,
        isActive: true,
      },
      create: template,
    });
  }

  await prisma.workpaperTemplate.updateMany({
    where: { code: { in: retiredSeededWorkpaperTemplateCodes } },
    data: { isActive: false },
  });

  for (const template of workpaperTemplates.filter(
    (candidateTemplate) =>
      !retiredSeededWorkpaperTemplateCodes.includes(candidateTemplate.code)
  )) {
    const saved = await prisma.workpaperTemplate.upsert({
      where: { code: template.code },
      update: {
        name: template.name,
        subjectCode: template.subjectCode,
        subjectName: template.subjectName,
        language: template.language,
        description: template.description,
        isActive: true,
      },
      create: {
        code: template.code,
        name: template.name,
        subjectCode: template.subjectCode,
        subjectName: template.subjectName,
        language: template.language,
        description: template.description,
        isActive: true,
      },
    });
    await prisma.workpaperTemplateItem.deleteMany({
      where: { templateId: saved.id },
    });
    await prisma.workpaperTemplateItem.createMany({
      data: template.items.map((item) => ({
        templateId: saved.id,
        itemCode: item.itemCode,
        title: item.title,
        description: item.description,
        sortOrder: item.sortOrder,
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
      })),
    });
  }

  await prisma.projectTemplate.updateMany({
    where: { code: { in: retiredSeededProjectTemplateCodes } },
    data: { status: "ARCHIVED" },
  });

  for (const template of projectTemplates) {
    const frameworkTemplate = await prisma.frameworkTemplate.findUniqueOrThrow({
      where: { code: template.frameworkCode },
    });
    const saved = await prisma.projectTemplate.upsert({
      where: { code: template.code },
      update: {
        name: template.name,
        language: template.language,
        frameworkTemplateId: frameworkTemplate.id,
        description: template.description,
        status: "PUBLISHED",
      },
      create: {
        code: template.code,
        name: template.name,
        language: template.language,
        frameworkTemplateId: frameworkTemplate.id,
        description: template.description,
        status: "PUBLISHED",
      },
    });
    await prisma.projectTemplateFile.deleteMany({
      where: { projectTemplateId: saved.id },
    });
    await prisma.projectTemplateNode.deleteMany({
      where: { projectTemplateId: saved.id },
    });
    await createProjectTemplateNodes(saved.id, null, template.nodes);
  }

  const adminUser = await upsertSeedCredentialUser({
    email: "admin@projectwing.local",
    name: "系统管理员",
    password: "Admin123!",
    globalRole: "SUPER_ADMIN",
  });
  await seedSmartFormV2(adminUser.id);

  await upsertSeedCredentialUser({
    email: "hr@projectwing.local",
    name: "人力资源专员",
    password: "Hr123456!",
    globalRole: "HR",
    update: { name: "人力资源专员", globalRole: "HR" },
  });

  const confirmationOfficer = await upsertSeedCredentialUser({
    email: "confirmation.officer@projectwing.local",
    name: "函证专员",
    password: "Officer123!",
    globalRole: "CONFIRMATION_OFFICER",
    update: { name: "函证专员", globalRole: "CONFIRMATION_OFFICER" },
  });
  const officerDeclaration = await prisma.independenceDeclaration.findFirst({
    where: {
      userId: confirmationOfficer.id,
      projectId: null,
      declarationVersion: "v1",
    },
  });
  if (!officerDeclaration) {
    await prisma.independenceDeclaration.create({
      data: {
        userId: confirmationOfficer.id,
        projectId: null,
        declarationVersion: "v1",
        source: "SEED",
      },
    });
  }

  const partnerUser = await upsertSeedCredentialUser({
    email: "partner@projectwing.local",
    name: "Jony Ma",
    password: "Partner123!",
    globalRole: "PARTNER",
    update: { name: "Jony Ma" },
  });
  const managerUser = await upsertSeedCredentialUser({
    email: "manager@projectwing.local",
    name: "Leo Li",
    password: "Manager123!",
    globalRole: "MANAGER",
    update: { name: "Leo Li" },
  });

  await upsertSeedCredentialUser({
    email: "senior@projectwing.local",
    name: "Sam Lu",
    password: "Senior123!",
    globalRole: "SENIOR",
    update: { name: "Sam Lu" },
  });

  await upsertSeedCredentialUser({
    email: "staff@projectwing.local",
    name: "King Su",
    password: "Staff123!",
    globalRole: "STAFF",
    update: { name: "King Su" },
  });

  const seniorManagerUser = await upsertSeedCredentialUser({
    email: "senior.manager@projectwing.local",
    name: "Eden Chan",
    password: "SeniorManager123!",
    globalRole: "MANAGER",
    update: { name: "Eden Chan" },
  });
  const principalUser = await upsertSeedCredentialUser({
    email: "principal@projectwing.local",
    name: "Edric Han",
    password: "Principal123!",
    globalRole: "PRINCIPAL",
    update: { name: "Edric Han" },
  });

  await upsertSeedCredentialUser({
    email: "tax@projectwing.local",
    name: "Yina Gao",
    password: "TaxExpert123!",
    globalRole: "TAX_EXPERT",
    update: { name: "Yina Gao" },
  });

  const workshopGroup = await resolveCmpSeedGroup({
    clientCode: "C-WKS-001",
    fallbackGroupCode: "G-WORKSHOP",
    nameZh: "Workshop Group",
    nameEn: "Workshop Group",
  });
  const orchidGroup = await resolveCmpSeedGroup({
    clientCode: "C-ORC-2026",
    fallbackGroupCode: "G-ORCHID",
    nameZh: "Orchid Holdings",
    nameEn: "Orchid Holdings",
  });
  const harbourGroup = await resolveCmpSeedGroup({
    clientCode: "C-HBR-010",
    fallbackGroupCode: "G-HARBOUR",
    nameZh: "Harbour Group",
    nameEn: "Harbour Group",
  });
  const workshopClient = await prisma.cmpClient.upsert({
    where: { clientCode: "C-WKS-001" },
    update: {
      clientPartnerPic: "Jony Ma",
      clientManagerMic: "Leo Li",
    },
    create: {
      clientCode: "C-WKS-001",
      companyNumber: "240377",
      nameZh: "Workshop Company Limited",
      nameEn: "Workshop Company Limited",
      groupId: workshopGroup.id,
      contactPerson: "Amy Chan",
      email: "amy@workshop.example",
      hsicSectionCode: "G",
      yearEndDate: new Date("2026-10-31T00:00:00.000Z"),
      placeOfIncorporation: "Hong Kong",
      listedOrPrivate: "PRIVATE",
      clientPartnerPic: "Jony Ma",
      clientManagerMic: "Leo Li",
      serviceLines: "Audit, Tax",
      approvalReferenceNumber: "NCA-240377",
      approvalDate: new Date("2026-01-10T00:00:00.000Z"),
      preparedBy: "King Su",
      approvedBy: "Leo Li",
    },
  });
  const orchidClient = await prisma.cmpClient.upsert({
    where: { clientCode: "C-ORC-2026" },
    update: {
      clientPartnerPic: "Jony Ma",
      clientManagerMic: "Eden Chan",
    },
    create: {
      clientCode: "C-ORC-2026",
      companyNumber: "240378",
      nameZh: "Orchid Technology Limited",
      nameEn: "Orchid Technology Limited",
      groupId: orchidGroup.id,
      contactPerson: "Ben Wong",
      email: "ben@orchid.example",
      hsicSectionCode: "J",
      yearEndDate: new Date("2026-12-31T00:00:00.000Z"),
      placeOfIncorporation: "Hong Kong",
      listedOrPrivate: "PRIVATE",
      clientPartnerPic: "Jony Ma",
      clientManagerMic: "Eden Chan",
      serviceLines: "Audit, Risk",
      approvalReferenceNumber: "NCA-240378",
      approvalDate: new Date("2026-02-18T00:00:00.000Z"),
      preparedBy: "Sam Lu",
      approvedBy: "Eden Chan",
    },
  });
  const harbourClient = await prisma.cmpClient.upsert({
    where: { clientCode: "C-HBR-010" },
    update: {
      clientPartnerPic: "Edric Han",
      clientManagerMic: "Leo Li",
    },
    create: {
      clientCode: "C-HBR-010",
      companyNumber: "240379",
      nameZh: "Harbour Retail Limited",
      nameEn: "Harbour Retail Limited",
      groupId: harbourGroup.id,
      contactPerson: "Cathy Ho",
      email: "cathy@harbour.example",
      hsicSectionCode: "G",
      yearEndDate: new Date("2026-03-31T00:00:00.000Z"),
      placeOfIncorporation: "Hong Kong",
      listedOrPrivate: "PRIVATE",
      clientPartnerPic: "Edric Han",
      clientManagerMic: "Leo Li",
      serviceLines: "Audit, Accounting",
      approvalReferenceNumber: "NCA-240379",
      approvalDate: new Date("2026-03-12T00:00:00.000Z"),
      preparedBy: "King Su",
      approvedBy: "Leo Li",
    },
  });

  await seedCmpGroupExamples();

  await prisma.cmpEngagement.upsert({
    where: { engagementCode: "WKS-2026-AUD" },
    update: {
      budgetedHours: "420.00",
      agreedFee: "180000.00",
      recoveryRate: null,
      feeCurrency: "HKD",
      picUserId: partnerUser.id,
      micUserId: managerUser.id,
      pic: partnerUser.name,
      mic: managerUser.name,
    },
    create: {
      clientId: workshopClient.id,
      engagementCode: "WKS-2026-AUD",
      serviceType: "AUDIT",
      yearEndDate: new Date("2026-10-31T00:00:00.000Z"),
      reportDate: new Date("2027-01-31T00:00:00.000Z"),
      approvalReferenceNumber: "NEA-240377-AUD",
      engagementDate: new Date("2026-01-20T00:00:00.000Z"),
      budgetedHours: "420.00",
      agreedFee: "180000.00",
      recoveryRate: null,
      feeCurrency: "HKD",
      picUserId: partnerUser.id,
      micUserId: managerUser.id,
      pic: "Jony Ma",
      mic: "Leo Li",
      remarks: "Demo annual audit engagement.",
    },
  });
  await prisma.cmpEngagement.upsert({
    where: { engagementCode: "ORC-2026-AUD" },
    update: {
      budgetedHours: "560.00",
      agreedFee: "240000.00",
      recoveryRate: null,
      feeCurrency: "HKD",
      picUserId: partnerUser.id,
      micUserId: seniorManagerUser.id,
      pic: partnerUser.name,
      mic: seniorManagerUser.name,
    },
    create: {
      clientId: orchidClient.id,
      engagementCode: "ORC-2026-AUD",
      serviceType: "AUDIT",
      yearEndDate: new Date("2026-12-31T00:00:00.000Z"),
      reportDate: new Date("2027-03-31T00:00:00.000Z"),
      approvalReferenceNumber: "NEA-240378-AUD",
      engagementDate: new Date("2026-02-25T00:00:00.000Z"),
      budgetedHours: "560.00",
      agreedFee: "240000.00",
      recoveryRate: null,
      feeCurrency: "HKD",
      picUserId: partnerUser.id,
      micUserId: seniorManagerUser.id,
      pic: "Jony Ma",
      mic: "Eden Chan",
      remarks: "Demo audit engagement.",
    },
  });
  await prisma.cmpEngagement.upsert({
    where: { engagementCode: "ORC-2026-RISK" },
    update: {
      budgetedHours: "180.00",
      agreedFee: "95000.00",
      recoveryRate: null,
      feeCurrency: "HKD",
      picUserId: principalUser.id,
      micUserId: seniorManagerUser.id,
      pic: principalUser.name,
      mic: seniorManagerUser.name,
    },
    create: {
      clientId: orchidClient.id,
      engagementCode: "ORC-2026-RISK",
      serviceType: "RISK",
      yearEndDate: new Date("2026-12-31T00:00:00.000Z"),
      reportDate: new Date("2027-02-28T00:00:00.000Z"),
      approvalReferenceNumber: "NEA-240378-RSK",
      engagementDate: new Date("2026-03-05T00:00:00.000Z"),
      budgetedHours: "180.00",
      agreedFee: "95000.00",
      recoveryRate: null,
      feeCurrency: "HKD",
      picUserId: principalUser.id,
      micUserId: seniorManagerUser.id,
      pic: "Edric Han",
      mic: "Eden Chan",
      remarks: "Demo risk service engagement.",
    },
  });
  const harbourEngagement = await prisma.cmpEngagement.upsert({
    where: { engagementCode: "HBR-2026-ACC" },
    update: {
      budgetedHours: "240.00",
      agreedFee: "120000.00",
      recoveryRate: null,
      feeCurrency: "HKD",
      picUserId: principalUser.id,
      micUserId: managerUser.id,
      pic: principalUser.name,
      mic: managerUser.name,
    },
    create: {
      clientId: harbourClient.id,
      engagementCode: "HBR-2026-ACC",
      serviceType: "ACCOUNTING",
      yearEndDate: new Date("2026-03-31T00:00:00.000Z"),
      reportDate: new Date("2026-06-30T00:00:00.000Z"),
      approvalReferenceNumber: "NEA-240379-ACC",
      engagementDate: new Date("2026-03-20T00:00:00.000Z"),
      budgetedHours: "240.00",
      agreedFee: "120000.00",
      recoveryRate: null,
      feeCurrency: "HKD",
      picUserId: principalUser.id,
      micUserId: managerUser.id,
      pic: "Edric Han",
      mic: "Leo Li",
      remarks: "Demo accounting service engagement.",
    },
  });

  for (const code of [
    "100204",
    "200118",
    "300672",
    "400091",
    "500314",
    "600527",
  ]) {
    await prisma.cmpEngagementCodeAlias.upsert({
      where: { normalizedCode: code },
      update: { engagementId: harbourEngagement.id, code },
      create: {
        engagementId: harbourEngagement.id,
        code,
        normalizedCode: code,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
