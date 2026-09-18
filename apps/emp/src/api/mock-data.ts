import { DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE } from "@project-wing/shared";

import {
  defaultInboxMessageTemplateCopy,
  defaultReviewQuestionPreviewCopy,
} from "../i18n/dictionaries";
import type {
  Attachment,
  AttachmentVersion,
  FrameworkTemplate,
  Project,
  ProjectMember,
  ProjectTemplate,
  SmartFormTemplate,
  User,
  WorkingPaperQuestion,
  WorkflowNode,
} from "./client";
import type { MockState } from "./mock-types";

export const defaultUsers: User[] = [
  {
    id: "user-admin",
    email: "admin@projectwing.local",
    name: "System Admin",
    globalRole: "SUPER_ADMIN",
    status: "ACTIVE",
    declarationAccepted: true,
    declarationAcceptedAt: "2026-05-28T09:00:00.000Z",
  },
  {
    id: "user-partner",
    email: "partner@projectwing.local",
    name: "Jony Ma",
    globalRole: "PARTNER",
    status: "ACTIVE",
    declarationAccepted: true,
    declarationAcceptedAt: "2026-05-28T09:30:00.000Z",
  },
  {
    id: "user-manager",
    email: "manager@projectwing.local",
    name: "Leo Li",
    globalRole: "MANAGER",
    status: "ACTIVE",
    declarationAccepted: true,
    declarationAcceptedAt: "2026-05-28T10:15:00.000Z",
  },
  {
    id: "user-senior",
    email: "senior@projectwing.local",
    name: "Sam Lu",
    globalRole: "SENIOR",
    status: "ACTIVE",
    declarationAccepted: false,
    declarationAcceptedAt: null,
  },
  {
    id: "user-staff",
    email: "staff@projectwing.local",
    name: "King Su",
    globalRole: "STAFF",
    status: "ACTIVE",
    declarationAccepted: false,
    declarationAcceptedAt: null,
  },
  {
    id: "user-senior-manager",
    email: "senior.manager@projectwing.local",
    name: "Eden Chan",
    globalRole: "MANAGER",
    status: "ACTIVE",
    declarationAccepted: true,
    declarationAcceptedAt: "2026-05-28T10:45:00.000Z",
  },
  {
    id: "user-principal",
    email: "principal@projectwing.local",
    name: "Edric Han",
    globalRole: "PRINCIPAL",
    status: "ACTIVE",
    declarationAccepted: true,
    declarationAcceptedAt: "2026-05-28T11:00:00.000Z",
  },
  {
    id: "user-tax",
    email: "tax@projectwing.local",
    name: "Yina Gao",
    globalRole: "TAX_EXPERT",
    status: "ACTIVE",
    declarationAccepted: true,
    declarationAcceptedAt: "2026-05-28T11:15:00.000Z",
  },
  {
    id: "user-confirmation-officer",
    email: "confirmation@projectwing.local",
    name: "Cathy Chan",
    globalRole: "CONFIRMATION_OFFICER",
    status: "ACTIVE",
    declarationAccepted: true,
    declarationAcceptedAt: "2026-05-28T11:30:00.000Z",
  },
];

export const mockCmpClients = [
  {
    id: "cmp-client-orchid",
    clientCode: "C-ORCHID",
    companyCode: "ORC-HK",
    companyIdentifierType: "COMPANY_REGISTRATION_NUMBER" as const,
    companyNumber: "7654321",
    nameZh: "兰花控股有限公司",
    nameEn: "Orchid Holdings Limited",
    status: "ACTIVE" as const,
    address: "18 Harbour Road, Hong Kong",
    addresses: [
      {
        id: "cmp-address-orchid-registered",
        type: "REGISTERED" as const,
        label: "注册办事处",
        address: "香港湾仔港湾道18号",
        sortOrder: 0,
      },
      {
        id: "cmp-address-orchid-principal",
        type: "PRINCIPAL" as const,
        label: "主要营业地点",
        address: "香港中环金融街8号",
        sortOrder: 1,
      },
    ],
    contacts: [
      {
        id: "cmp-contact-orchid-alice",
        name: "Alice Wong",
        position: "Finance Director",
        department: "Finance",
        officePhone: "+852 2123 4567",
        mobile: "+852 9123 4567",
        email: "alice@orchid.example",
        remarks: null,
        sortOrder: 0,
      },
    ],
    website: "https://orchid.example",
    yearEndDate: "2026-12-31",
    reportingGaap: "HKFRS",
    hsicSectionCode: "K" as const,
    industryOtherDescription: "Technology investment holding",
    placeOfIncorporation: "Hong Kong",
    incorporationYearMonth: "2018-05",
    listedOrPrivate: "LISTED",
    stockExchangeOrListingPlace: "HKEX",
    stockCode: "1234",
    groupName: "Orchid Group",
    group: {
      id: "cmp-group-orchid",
      groupCode: "GRP-ORCHID",
      nameZh: "兰花集团",
      nameEn: "Orchid Group",
      status: "ACTIVE" as const,
    },
    parentClientCode: "C-ORCHID-PARENT",
    parentHoldingCompanyName: "Orchid Global Holdings",
    subsidiariesOrAssociates: "Orchid Technology; Orchid Retail",
    clientPartnerPic: "Jony Ma",
    clientManagerMic: "Leo Li",
    updatedAt: "2026-09-02T09:30:00.000Z",
  },
  {
    id: "cmp-client-celadon",
    clientCode: "C-CELADON",
    nameZh: "青瓷制造有限公司",
    nameEn: "Celadon Manufacturing Limited",
    status: "ACTIVE" as const,
    clientPartnerPic: "Jony Ma",
    clientManagerMic: "Leo Li",
  },
  {
    id: "cmp-client-harbour",
    clientCode: "C-HBR-010",
    nameZh: "港湾零售有限公司",
    nameEn: "Harbour Retail Limited",
    status: "ACTIVE" as const,
    clientPartnerPic: "Edric Han",
    clientManagerMic: "Cathy Ho",
  },
  {
    id: "cmp-client-workshop",
    clientCode: "C-WKS-001",
    nameZh: "工坊有限公司",
    nameEn: "Workshop Company Limited",
    status: "ACTIVE" as const,
    clientPartnerPic: "Jony Ma",
    clientManagerMic: "Amy Chan",
  },
  {
    id: "cmp-client-zenith",
    clientCode: "C-ZTP-025",
    nameZh: "盛峰科技有限公司",
    nameEn: "Zenith Tech Private Limited",
    status: "ACTIVE" as const,
    clientPartnerPic: "Eden Chan",
    clientManagerMic: "Sam Lu",
  },
  {
    id: "cmp-client-sunrise",
    clientCode: "C-SMC-032",
    nameZh: "晨曦制造有限公司",
    nameEn: "Sunrise Manufacturing Company",
    status: "ACTIVE" as const,
    clientPartnerPic: "Edric Han",
    clientManagerMic: "Leo Li",
  },
];

export const mockCmpEngagements = [
  {
    id: "cmp-engagement-orchid-audit-2026",
    clientId: "cmp-client-orchid",
    client: mockCmpClients[0],
    engagementCode: "ORCHID-2026-AUD",
    serviceType: "AUDIT" as const,
    deliverables: [
      {
        key: "auditors-report",
        category: "ANNUAL_AUDIT" as const,
        code: "AUDITORS_REPORT" as const,
        sortOrder: 0,
      },
      {
        key: "management-letter",
        category: "OTHERS" as const,
        code: "CUSTOM" as const,
        description: "Management letter",
        sortOrder: 1,
      },
    ],
    otherServiceDescription: null,
    yearEndDate: "2026-12-31",
    reportDate: "2027-03-31",
    approvalReferenceNumber: "NCA-ORCHID-2026",
    engagementDate: "2026-11-15",
    picUserId: "user-partner",
    micUserId: "user-manager",
    pic: "Jony Ma",
    mic: "Leo Li",
    eqReviewer: "Eden Chan",
    status: "ACTIVE" as const,
    remarks: "Demo CMP engagement for EMS project creation.",
    codeAliases: [],
    updatedAt: "2026-09-02T10:00:00.000Z",
  },
  {
    id: "cmp-engagement-celadon-tax-2026",
    clientId: "cmp-client-celadon",
    client: mockCmpClients[1],
    engagementCode: "CELADON-2026-TAX",
    serviceType: "TAX" as const,
    yearEndDate: "2026-12-31",
    reportDate: "2027-04-30",
    approvalReferenceNumber: "NEA-CELADON-2026",
    engagementDate: "2026-12-02",
    picUserId: "user-partner",
    micUserId: "user-manager",
    pic: "Jony Ma",
    mic: "Leo Li",
    status: "ACTIVE" as const,
    remarks: "Demo CMP engagement for selection filtering.",
    codeAliases: [],
  },
  {
    id: "cmp-engagement-harbour-audit-2026",
    clientId: "cmp-client-harbour",
    client: mockCmpClients[2],
    engagementCode: "HBR-2026-AUD",
    serviceType: "AUDIT" as const,
    yearEndDate: "2026-03-31",
    reportDate: "2026-06-30",
    approvalReferenceNumber: "NEA-240379-AUD",
    engagementDate: "2026-02-12",
    pic: "Edric Han",
    mic: "Cathy Ho",
    status: "ACTIVE" as const,
    remarks: "Preview engagement for Harbour Retail Limited.",
    codeAliases: ["HBR-AUD-2026"],
  },
  {
    id: "cmp-engagement-harbour-accounting-2026",
    clientId: "cmp-client-harbour",
    client: mockCmpClients[2],
    engagementCode: "HBR-2026-ACC",
    serviceType: "ACCOUNTING" as const,
    yearEndDate: "2026-03-31",
    reportDate: "2026-06-30",
    approvalReferenceNumber: "NEA-240379-ACC",
    engagementDate: "2026-02-18",
    pic: "Edric Han",
    mic: "Leo Li",
    status: "ACTIVE" as const,
    remarks: "Second Harbour engagement for prefix matching tests.",
    codeAliases: [],
  },
  {
    id: "cmp-engagement-workshop-audit-2026",
    clientId: "cmp-client-workshop",
    client: mockCmpClients[3],
    engagementCode: "WKS-2026-AUD",
    serviceType: "AUDIT" as const,
    yearEndDate: "2026-10-31",
    reportDate: "2027-01-31",
    approvalReferenceNumber: "NEA-240377-AUD",
    engagementDate: "2026-09-08",
    pic: "Jony Ma",
    mic: "Amy Chan",
    status: "ACTIVE" as const,
    remarks: "Preview engagement for Workshop Company Limited.",
    codeAliases: [],
  },
  {
    id: "cmp-engagement-zenith-assurance-2026",
    clientId: "cmp-client-zenith",
    client: mockCmpClients[4],
    engagementCode: "ZTP-2026-CAS",
    serviceType: "OTHERS" as const,
    yearEndDate: "2026-12-31",
    reportDate: "2027-03-20",
    approvalReferenceNumber: "NEA-ZTP-2026",
    engagementDate: "2026-11-22",
    pic: "Eden Chan",
    mic: "Sam Lu",
    status: "ACTIVE" as const,
    remarks: "Preview assurance engagement.",
    codeAliases: [],
  },
  {
    id: "cmp-engagement-sunrise-review-2026",
    clientId: "cmp-client-sunrise",
    client: mockCmpClients[5],
    engagementCode: "SMC-2026-REV",
    serviceType: "RISK" as const,
    yearEndDate: "2026-12-31",
    reportDate: "2027-02-28",
    approvalReferenceNumber: "NEA-SMC-2026",
    engagementDate: "2026-10-30",
    pic: "Edric Han",
    mic: "Leo Li",
    status: "ACTIVE" as const,
    remarks: "Preview review engagement.",
    codeAliases: [],
  },
];

const primaryProject: Project = {
  id: "project-orchid-2026",
  projectNumber: 1_000_000,
  workspaceId: "workspace-orchid",
  name: "Orchid Holdings 2026 audit",
  projectCode: "AUD-2026-0001",
  cmpClientId: "cmp-client-orchid",
  cmpEngagementId: "cmp-engagement-orchid-audit-2026",
  cmpClient: mockCmpClients[0],
  cmpEngagement: mockCmpEngagements[0],
  language: "zh-CN",
  frameworkTemplateId: "framework-hkfrs",
  frameworkTemplate: {
    id: "framework-hkfrs",
    code: "HKFRS",
    name: "HKFRS audit framework",
    language: "zh-CN",
    description:
      "Default Hong Kong Financial Reporting Standards audit framework.",
    isActive: true,
  },
  reportingDate: "2026-12-31T00:00:00.000Z",
  yearEndDate: "2026-12-31T00:00:00.000Z",
  reportDate: "2027-03-31T00:00:00.000Z",
  archiveDeadline: "2027-06-29T00:00:00.000Z",
  status: "ACTIVE",
  notes:
    "Preview client demo data covering workspace, members, workflow, workpapers, and audit logs.",
};
const secondaryProject: Project = {
  id: "project-harbor-2026",
  projectNumber: 1_000_001,
  workspaceId: "workspace-orchid",
  name: "Harbor Trading 2026 audit",
  projectCode: "AUD-2026-0002",
  language: "zh-CN",
  frameworkTemplateId: "framework-cas",
  frameworkTemplate: {
    id: "framework-cas",
    code: "CAS",
    name: "Chinese Accounting Standards audit framework",
    language: "zh-CN",
    description: "Default Mainland China audit framework.",
    isActive: true,
  },
  reportingDate: "2026-12-31T00:00:00.000Z",
  yearEndDate: "2026-12-31T00:00:00.000Z",
  reportDate: "2027-03-31T00:00:00.000Z",
  archiveDeadline: "2027-06-29T00:00:00.000Z",
  status: "ARCHIVED",
};

export const defaultFrameworkTemplates: FrameworkTemplate[] = [
  {
    id: "framework-hkfrs",
    code: "HKFRS",
    name: "HKFRS audit framework",
    language: "zh-CN",
    description:
      "Default Hong Kong Financial Reporting Standards audit framework.",
    isActive: true,
  },
  {
    id: "framework-ifrs",
    code: "IFRS",
    name: "IFRS audit framework",
    language: "en-US",
    description:
      "Default International Financial Reporting Standards audit framework.",
    isActive: true,
  },
  {
    id: "framework-cas",
    code: "CAS",
    name: "CAS audit framework",
    language: "zh-CN",
    description: "Default China Accounting Standards audit framework.",
    isActive: true,
  },
];

export const defaultProjectTemplates: ProjectTemplate[] = [];

const deferredIncomeSmartFormDefinition =
  DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE;

export const defaultSmartFormTemplates: SmartFormTemplate[] = [
  {
    id: "smart-form-template-deferred-income",
    code: "SF-AUD-DEFERRED-INCOME",
    name: "Audit Programme — Deferred Income",
    frameworkTemplateId: "framework-hkfrs",
    frameworkTemplate: defaultFrameworkTemplates.find(
      (template) => template.id === "framework-hkfrs"
    ),
    status: "PUBLISHED",
    draftDefinitionJson: deferredIncomeSmartFormDefinition,
    currentPublishedVersionId: "smart-form-template-version-deferred-income-1",
    currentPublishedVersion: {
      id: "smart-form-template-version-deferred-income-1",
      templateId: "smart-form-template-deferred-income",
      version: 1,
      definitionJson: deferredIncomeSmartFormDefinition,
      definitionHash: "mock-smart-form-template-version-deferred-income-1",
      publishedBy: "user-admin",
      publishedAt: "2026-07-30T00:00:00.000Z",
    },
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
  },
];

const defaultMembers: ProjectMember[] = [
  {
    id: "member-partner",
    projectRole: "PARTNER",
    inChargeRole: "PARTNER_IN_CHARGE",
    allowedProjectRoles: ["PARTNER", "EQCR"],
    roleConsistent: true,
    declarationAccepted: true,
    declarationAcceptedAt: "2026-05-28T09:30:00.000Z",
    user: defaultUsers[1],
  },
  {
    id: "member-manager",
    projectRole: "PREPARER",
    inChargeRole: null,
    allowedProjectRoles: ["PREPARER"],
    roleConsistent: true,
    declarationAccepted: true,
    declarationAcceptedAt: "2026-05-28T10:15:00.000Z",
    user: defaultUsers[2],
  },
  {
    id: "member-senior",
    projectRole: "PREPARER",
    inChargeRole: null,
    allowedProjectRoles: ["PREPARER"],
    roleConsistent: true,
    declarationAccepted: false,
    declarationAcceptedAt: null,
    user: defaultUsers[3],
  },
];
const primaryProjectInboxContext = {
  id: primaryProject.id,
  projectCode: primaryProject.projectCode,
  name: primaryProject.name ?? primaryProject.projectCode,
  workspace: {
    id: "workspace-orchid",
    name: "Orchid Holdings audit Workspace",
    clientName: "Orchid Holdings",
  },
};
const cashPaperInboxContext = {
  id: "mock-paper-cash",
  code: "C-01",
  title: "Cash and bank",
};

function mockInboxContent(
  key: keyof typeof defaultInboxMessageTemplateCopy,
  params: Record<string, string | number>
) {
  const template = defaultInboxMessageTemplateCopy[key];
  return {
    title: interpolateMockInboxTemplate(template.title, params),
    body: interpolateMockInboxTemplate(template.body, params),
  };
}

function interpolateMockInboxTemplate(
  template: string,
  params: Record<string, string | number>
) {
  return template.replaceAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (_, key) =>
    String(params[key] ?? "")
  );
}

export const defaultWorkflow: WorkflowNode[] = [
  node("node-planning", "Planning", "Planning", 1, [
    node("node-a1", "A1", "Client acceptance or continuance", 2, [
      node("node-a1-1000", "A1-1000", "A1-1000", 3),
      node("node-a1-2000", "A1-2000", "A1-2000", 3),
    ]),
    node("node-a2", "A2", "A2", 2),
  ]),
  node("node-execution", "Execution", "Execution", 1),
  node("node-reporting", "Reporting", "Reporting", 1, [
    node("node-b1", "B1", "B1", 2, [
      node("node-b1-1000", "B1-1000", "B1-1000", 3),
      node("node-b1-2000", "B1-2000", "B1-2000", 3),
    ]),
    node("node-b2", "B2", "B2", 2),
  ]),
];

const primaryWorkflow = addPreviewPapersToWorkflow(defaultWorkflow, {
  "node-a1-1000": [
    mockWorkingPaper(
      primaryProject.id,
      "node-a1-1000",
      "mock-paper-current-cash",
      "C-01-F001",
      "Cash current year lead schedule.xlsx",
      "CURRENT",
      "SPREADSHEET",
      [
        { originalName: "Evidence archive.zip", fileKind: "SUPPORTING" },
        {
          originalName: "Preview bank confirmation.pdf",
          fileKind: "SUPPORTING",
        },
        {
          originalName: "Preview bank confirmation.docx",
          fileKind: "SUPPORTING",
        },
        { originalName: "Preview legacy document.doc", fileKind: "SUPPORTING" },
        { originalName: "Audit kickoff deck.pptx", fileKind: "SUPPORTING" },
        { originalName: "Preview legacy deck.ppt", fileKind: "SUPPORTING" },
        { originalName: "Cash exceptions.csv", fileKind: "SPREADSHEET" },
        { originalName: "Cash exceptions.tsv", fileKind: "SPREADSHEET" },
        { originalName: "Preview legacy table.xls", fileKind: "SPREADSHEET" },
        { originalName: "Preview macro table.xlsm", fileKind: "SPREADSHEET" },
        { originalName: "Preview binary table.xlsb", fileKind: "SPREADSHEET" },
        { originalName: "Evidence screenshot.png", fileKind: "SUPPORTING" },
        { originalName: "Email evidence.eml", fileKind: "SUPPORTING" },
        {
          originalName: "Audit Programme — Deferred Income.sf",
          fileKind: "SMART_FORM",
        },
        ...getPreviewFormatAttachments(),
      ],
      getPreviewReviewQuestions()
    ),
    mockWorkingPaper(
      primaryProject.id,
      "node-a1-1000",
      "mock-paper-prior-cash",
      "C-01-PY001",
      "Cash prior year lead schedule 2025.xlsx",
      "PRIOR"
    ),
  ],
  "node-a1-2000": [
    mockWorkingPaper(
      primaryProject.id,
      "node-a1-2000",
      "mock-paper-prior-bank",
      "C-02-PY001",
      "Bank confirmation summary 2025.pdf",
      "PRIOR",
      "SUPPORTING"
    ),
  ],
  "node-a2": [
    mockWorkingPaper(
      primaryProject.id,
      "node-a2",
      "mock-paper-temp-request-list",
      "TMP001",
      "Client request list - temporary.xlsx",
      "TEMPORARY"
    ),
    mockWorkingPaper(
      primaryProject.id,
      "node-a2",
      "mock-paper-temp-minutes",
      "TMP002",
      "Inventory count notes - temporary.docx",
      "TEMPORARY",
      "SUPPORTING"
    ),
  ],
});

function getPreviewFormatAttachments(): {
  originalName: string;
  fileKind: Attachment["fileKind"];
}[] {
  return [
    { originalName: "Preview archive.rar", fileKind: "SUPPORTING" },
    { originalName: "Preview archive.7z", fileKind: "SUPPORTING" },
    { originalName: "Preview archive.tar", fileKind: "SUPPORTING" },
    { originalName: "Preview archive.tgz", fileKind: "SUPPORTING" },
    { originalName: "Preview archive.gz", fileKind: "SUPPORTING" },
    { originalName: "Preview archive.tar.gz", fileKind: "SUPPORTING" },
    { originalName: "Preview archive.tbz", fileKind: "SUPPORTING" },
    { originalName: "Preview archive.tbz2", fileKind: "SUPPORTING" },
    { originalName: "Preview archive.bz2", fileKind: "SUPPORTING" },
    { originalName: "Preview archive.tar.bz2", fileKind: "SUPPORTING" },
    { originalName: "Preview archive.xz", fileKind: "SUPPORTING" },
    { originalName: "Preview archive.txz", fileKind: "SUPPORTING" },
    { originalName: "Preview archive.tar.xz", fileKind: "SUPPORTING" },
    { originalName: "Preview archive.cab", fileKind: "SUPPORTING" },
    { originalName: "Preview archive.ar", fileKind: "SUPPORTING" },
    { originalName: "Preview archive.cpio", fileKind: "SUPPORTING" },
    { originalName: "Preview archive.iso", fileKind: "SUPPORTING" },
    { originalName: "Preview image.avif", fileKind: "SUPPORTING" },
    { originalName: "Preview image.bmp", fileKind: "SUPPORTING" },
    { originalName: "Preview image.gif", fileKind: "SUPPORTING" },
    { originalName: "Preview image.jpg", fileKind: "SUPPORTING" },
    { originalName: "Preview image.jpeg", fileKind: "SUPPORTING" },
    { originalName: "Preview image.svg", fileKind: "SUPPORTING" },
    { originalName: "Preview image.webp", fileKind: "SUPPORTING" },
    { originalName: "Preview audio.aac", fileKind: "SUPPORTING" },
    { originalName: "Preview audio.flac", fileKind: "SUPPORTING" },
    { originalName: "Preview audio.m4a", fileKind: "SUPPORTING" },
    { originalName: "Preview video.mov", fileKind: "SUPPORTING" },
    { originalName: "Preview audio.mp3", fileKind: "SUPPORTING" },
    { originalName: "Preview video.mp4", fileKind: "SUPPORTING" },
    { originalName: "Preview audio.ogg", fileKind: "SUPPORTING" },
    { originalName: "Preview audio.wav", fileKind: "SUPPORTING" },
    { originalName: "Preview video.webm", fileKind: "SUPPORTING" },
    { originalName: "Preview script.cjs", fileKind: "SUPPORTING" },
    { originalName: "Preview stylesheet.css", fileKind: "SUPPORTING" },
    { originalName: "Preview page.html", fileKind: "SUPPORTING" },
    { originalName: "Preview page.htm", fileKind: "SUPPORTING" },
    { originalName: "Preview script.js", fileKind: "SUPPORTING" },
    { originalName: "Preview data.json", fileKind: "SUPPORTING" },
    { originalName: "Preview audit.log", fileKind: "SUPPORTING" },
    { originalName: "Preview notes.markdown", fileKind: "SUPPORTING" },
    { originalName: "Preview notes.md", fileKind: "SUPPORTING" },
    { originalName: "Preview notes.mdx", fileKind: "SUPPORTING" },
    { originalName: "Preview query.sql", fileKind: "SUPPORTING" },
    { originalName: "Preview script.ts", fileKind: "SUPPORTING" },
    { originalName: "Preview component.tsx", fileKind: "SUPPORTING" },
    { originalName: "Preview notes.txt", fileKind: "SUPPORTING" },
    { originalName: "Preview data.xml", fileKind: "SUPPORTING" },
    { originalName: "Preview config.yaml", fileKind: "SUPPORTING" },
    { originalName: "Preview config.yml", fileKind: "SUPPORTING" },
    { originalName: "Preview email.msg", fileKind: "SUPPORTING" },
  ];
}

function getPreviewReviewQuestions(): WorkingPaperQuestion[] {
  const workingPaperId = "mock-paper-current-cash";
  const common = {
    projectId: primaryProject.id,
    workingPaperId,
    attachmentId: null,
    smartFormNodeId: null,
    smartFormRowId: null,
    smartFormTargetLabel: null,
    assignedToId: "user-manager",
    createdById: "user-partner",
    assignedTo: defaultUsers[2],
    createdBy: defaultUsers[1],
    messages: [],
  };
  return [
    {
      ...common,
      id: "mock-review-question-today",
      attachmentId: `${workingPaperId}-attachment-1`,
      body: defaultReviewQuestionPreviewCopy.missingConfirmation,
      status: "OPEN",
      createdAt: "2026-08-25T07:40:00.000Z",
      updatedAt: "2026-08-25T07:40:00.000Z",
    },
    {
      ...common,
      id: "mock-review-question-yesterday",
      attachmentId: `${workingPaperId}-attachment-2`,
      body: defaultReviewQuestionPreviewCopy.explanationUpdated,
      status: "REPLIED",
      repliedById: "user-manager",
      replyBody: defaultReviewQuestionPreviewCopy.explanationUpdated,
      repliedAt: "2026-08-24T16:20:00.000Z",
      repliedBy: defaultUsers[2],
      createdAt: "2026-08-24T10:10:00.000Z",
      updatedAt: "2026-08-24T16:20:00.000Z",
    },
    {
      ...common,
      id: "mock-review-question-week",
      attachmentId: `${workingPaperId}-attachment-3`,
      body: defaultReviewQuestionPreviewCopy.sampleCleared,
      status: "CLEARED",
      clearedById: "user-manager",
      clearedAt: "2026-08-22T11:05:00.000Z",
      clearedBy: defaultUsers[2],
      createdAt: "2026-08-21T09:30:00.000Z",
      updatedAt: "2026-08-22T11:05:00.000Z",
    },
    {
      ...common,
      id: "mock-review-question-earlier",
      body: defaultReviewQuestionPreviewCopy.followUpRequired,
      status: "OPEN",
      createdAt: "2026-08-12T13:15:00.000Z",
      updatedAt: "2026-08-14T09:45:00.000Z",
    },
  ];
}

const resetHeadDemoAttachment: Attachment = {
  id: "attachment-reset-head-demo",
  workingPaperId: "paper-reset-head-demo",
  fileKind: "SPREADSHEET",
  fileName: "reset-head-demo-v4.xlsx",
  originalName: "Reset Head Demo.xlsx",
  fileUrl:
    "mock://working-papers/project-harbor-2026/paper-reset-head-demo/reset-head-demo-v4.xlsx",
  fileSize: 48_128,
  mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  version: 4,
  headVersionId: "version-reset-head-demo-4",
  workDate: "2026-06-12T00:00:00.000Z",
  lockedBy: null,
  lockedAt: null,
  lockExpiresAt: null,
  uploadedBy: "user-partner",
  deletedAt: null,
  deletedBy: null,
  restoredAt: null,
  restoredBy: null,
  lastModifiedBy: "user-partner",
  lastModifiedAt: "2026-06-12T17:45:30.000Z",
  uploader: defaultUsers[1],
  lockHolder: null,
  lastModifier: defaultUsers[1],
};
const resetHeadDemoPaper: WorkflowNode["workingPapers"][number] = {
  id: "paper-reset-head-demo",
  projectId: secondaryProject.id,
  workflowNodeId: "node-a1-1000",
  templateItemId: null,
  code: "A1-1000-F001",
  title: "Reset Head Demo.xlsx",
  paperType: "WORKING_PAPER",
  bucket: "CURRENT",
  preparerId: null,
  reviewerId: null,
  preparedAt: null,
  reviewedAt: null,
  returnedAt: null,
  reviewNote: null,
  preparer: null,
  reviewer: null,
  attachments: [resetHeadDemoAttachment],
  signoffs: [],
  reviewQuestions: [],
};
const harborWorkflow: WorkflowNode[] = defaultWorkflow.map((phase) =>
  phase.id === "node-planning"
    ? {
        ...phase,
        children: (phase.children ?? []).map((account) =>
          account.id === "node-a1"
            ? {
                ...account,
                children: (account.children ?? []).map((child) =>
                  child.id === "node-a1-1000"
                    ? {
                        ...child,
                        workingPapers: [
                          resetHeadDemoPaper,
                          ...(child.workingPapers ?? []),
                        ],
                      }
                    : child
                ),
              }
            : account
        ),
      }
    : phase
);
const resetHeadDemoVersions: AttachmentVersion[] = [
  {
    id: "version-reset-head-demo-1",
    attachmentId: resetHeadDemoAttachment.id,
    projectId: secondaryProject.id,
    version: 1,
    parentVersionId: null,
    sourceVersionId: null,
    fileKind: "SPREADSHEET",
    fileName: "reset-head-demo-v1.xlsx",
    originalName: "Reset Head Demo.xlsx",
    fileUrl:
      "mock://working-papers/project-harbor-2026/paper-reset-head-demo/reset-head-demo-v1.xlsx",
    fileSize: 42_112,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    workDate: "2026-06-10T00:00:00.000Z",
    uploadedBy: "user-senior",
    uploadedAt: "2026-06-10T09:12:05.000Z",
    archivedBy: "user-senior",
    action: "INITIAL",
    isCurrent: false,
    createdAt: "2026-06-10T09:12:05.000Z",
    uploadedByUser: defaultUsers[3],
    archivedByUser: defaultUsers[3],
  },
  {
    id: "version-reset-head-demo-2",
    attachmentId: resetHeadDemoAttachment.id,
    projectId: secondaryProject.id,
    version: 2,
    parentVersionId: "version-reset-head-demo-1",
    sourceVersionId: null,
    fileKind: "SPREADSHEET",
    fileName: "reset-head-demo-v2.xlsx",
    originalName: "Reset Head Demo.xlsx",
    fileUrl:
      "mock://working-papers/project-harbor-2026/paper-reset-head-demo/reset-head-demo-v2.xlsx",
    fileSize: 43_776,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    workDate: "2026-06-10T00:00:00.000Z",
    uploadedBy: "user-manager",
    uploadedAt: "2026-06-10T14:38:22.000Z",
    archivedBy: "user-manager",
    action: "CHECK_IN",
    isCurrent: false,
    createdAt: "2026-06-10T14:38:22.000Z",
    uploadedByUser: defaultUsers[2],
    archivedByUser: defaultUsers[2],
  },
  {
    id: "version-reset-head-demo-3",
    attachmentId: resetHeadDemoAttachment.id,
    projectId: secondaryProject.id,
    version: 3,
    parentVersionId: "version-reset-head-demo-2",
    sourceVersionId: null,
    fileKind: "SPREADSHEET",
    fileName: "reset-head-demo-v3.xlsx",
    originalName: "Reset Head Demo.xlsx",
    fileUrl:
      "mock://working-papers/project-harbor-2026/paper-reset-head-demo/reset-head-demo-v3.xlsx",
    fileSize: 46_336,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    workDate: "2026-06-11T00:00:00.000Z",
    uploadedBy: "user-staff",
    uploadedAt: "2026-06-11T11:06:44.000Z",
    archivedBy: "user-staff",
    action: "CHECK_IN",
    isCurrent: false,
    createdAt: "2026-06-11T11:06:44.000Z",
    uploadedByUser: defaultUsers[4],
    archivedByUser: defaultUsers[4],
  },
  {
    id: "version-reset-head-demo-4",
    attachmentId: resetHeadDemoAttachment.id,
    projectId: secondaryProject.id,
    version: 4,
    parentVersionId: "version-reset-head-demo-3",
    sourceVersionId: null,
    fileKind: "SPREADSHEET",
    fileName: "reset-head-demo-v4.xlsx",
    originalName: "Reset Head Demo.xlsx",
    fileUrl:
      "mock://working-papers/project-harbor-2026/paper-reset-head-demo/reset-head-demo-v4.xlsx",
    fileSize: 48_128,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    workDate: "2026-06-12T00:00:00.000Z",
    uploadedBy: "user-partner",
    uploadedAt: "2026-06-12T17:45:30.000Z",
    archivedBy: "user-partner",
    action: "CHECK_IN",
    isCurrent: true,
    createdAt: "2026-06-12T17:45:30.000Z",
    uploadedByUser: defaultUsers[1],
    archivedByUser: defaultUsers[1],
  },
];

export const initialState: MockState = {
  users: defaultUsers,
  frameworkTemplates: defaultFrameworkTemplates,
  projectTemplates: defaultProjectTemplates,
  smartFormTemplates: defaultSmartFormTemplates,
  workspaces: [
    {
      id: "workspace-orchid",
      name: "Orchid 闆嗗洟瀹¤ Workspace",
      clientName: "Orchid Holdings",
      ownerId: "user-partner",
      description: "Listed group annual audit demo data",
      projects: [
        { ...primaryProject, members: defaultMembers },
        { ...secondaryProject, members: defaultMembers.slice(0, 2) },
      ],
    },
    {
      id: "workspace-celadon",
      name: "Celadon Manufacturing Workspace",
      clientName: "Celadon Manufacturing",
      ownerId: "user-partner",
      description: "Private manufacturing client preview",
      projects: [],
    },
    {
      id: "workspace-staff",
      name: "Staff Personal Workspace",
      clientName: "Staff Preview",
      ownerId: "user-staff",
      description: "Personal preview workspace",
      projects: [],
    },
  ],
  desktopFolders: [
    {
      id: "desktop-folder-partner-default",
      ownerId: "user-partner",
      name: "Default",
      sortOrder: 0,
      isDefault: true,
      createdAt: "2026-05-28T09:00:00.000Z",
      updatedAt: "2026-05-28T09:00:00.000Z",
    },
  ],
  desktopPlacements: [
    {
      id: "desktop-placement-orchid-partner",
      userId: "user-partner",
      projectId: primaryProject.id,
      folderId: "desktop-folder-partner-default",
      desktopX: 24,
      desktopY: 24,
      sortOrder: 0,
      lastOpenedAt: null,
      createdAt: "2026-05-28T09:00:00.000Z",
      updatedAt: "2026-05-28T09:00:00.000Z",
    },
    {
      id: "desktop-placement-harbor-partner",
      userId: "user-partner",
      projectId: secondaryProject.id,
      folderId: "desktop-folder-partner-default",
      desktopX: 156,
      desktopY: 24,
      sortOrder: 1,
      lastOpenedAt: null,
      createdAt: "2026-05-28T09:00:00.000Z",
      updatedAt: "2026-05-28T09:00:00.000Z",
    },
  ],
  workflows: {
    "project-orchid-2026": primaryWorkflow,
    "project-harbor-2026": harborWorkflow,
  },
  deletedAttachments: {},
  attachmentVersions: {
    "project-harbor-2026": resetHeadDemoVersions,
  },
  declarations: { "project-orchid-2026": ["user-partner", "user-manager"] },
  messages: [
    {
      id: "message-invite-1",
      recipientId: "user-staff",
      senderId: "user-partner",
      projectId: primaryProject.id,
      workingPaperId: null,
      reviewQuestionId: null,
      type: "PROJECT_INVITATION",
      title: "Invitation to join Orchid audit project",
      body: "Jony Ma invited you to join the project as Preparer.",
      actionUrl: "/invitations/preview-token-orchid",
      readAt: null,
      createdAt: "2026-05-29T08:20:00.000Z",
      sender: defaultUsers[1],
      project: primaryProjectInboxContext,
      workingPaper: null,
      reviewQuestion: null,
      projectInvitation: {
        id: "invite-orchid",
        status: "PENDING",
        invitedRole: "PREPARER",
        expiresAt: "2026-06-30T00:00:00.000Z",
        project: primaryProjectInboxContext,
      },
    },
    {
      id: "message-review-question-1",
      recipientId: "user-staff",
      senderId: "user-manager",
      projectId: primaryProject.id,
      workingPaperId: cashPaperInboxContext.id,
      reviewQuestionId: "mock-question-cash-1",
      type: "REVIEW_QUESTION",
      title: "Review note needs reply: C-01",
      body: "Leo Li assigned you a review note for Cash and bank: please add bank confirmation variance explanation and subsequent receipt checks.",
      actionUrl: `/engagement/${primaryProject.id}`,
      readAt: null,
      createdAt: "2026-06-07T10:12:00.000Z",
      sender: defaultUsers[2],
      project: primaryProjectInboxContext,
      workingPaper: cashPaperInboxContext,
      reviewQuestion: {
        id: "mock-question-cash-1",
        status: "OPEN",
        body: "Please add bank confirmation variance explanation and subsequent receipt checks.",
        assignedTo: {
          id: "user-staff",
          name: "King Su",
          email: "staff@projectwing.local",
        },
        createdBy: {
          id: "user-manager",
          name: "Leo Li",
          email: "manager@projectwing.local",
        },
      },
      projectInvitation: null,
    },
    {
      id: "message-review-reply-1",
      recipientId: "user-partner",
      senderId: "user-manager",
      projectId: primaryProject.id,
      workingPaperId: cashPaperInboxContext.id,
      reviewQuestionId: "mock-question-cash-2",
      type: "REVIEW_REPLY",
      title: "Review note replied: C-01",
      body: "Leo Li replied to the Cash and bank review note: management explanation was added and workpaper references were updated.",
      actionUrl: `/engagement/${primaryProject.id}`,
      readAt: null,
      createdAt: "2026-06-07T14:35:00.000Z",
      sender: defaultUsers[2],
      project: primaryProjectInboxContext,
      workingPaper: cashPaperInboxContext,
      reviewQuestion: {
        id: "mock-question-cash-2",
        status: "REPLIED",
        body: "Please confirm whether the bank balance reconciliation covers all accounts.",
        assignedTo: {
          id: "user-manager",
          name: "Leo Li",
          email: "manager@projectwing.local",
        },
        createdBy: {
          id: "user-partner",
          name: "Jony Ma",
          email: "partner@projectwing.local",
        },
      },
      projectInvitation: null,
    },
    {
      id: "message-signoff-1",
      recipientId: "user-manager",
      senderId: "user-senior",
      projectId: primaryProject.id,
      workingPaperId: cashPaperInboxContext.id,
      reviewQuestionId: null,
      type: "SIGNOFF",
      title: "Workpaper prepared: C-01",
      body: "Sam Lu prepared and signed workpaper C-01 Cash and bank.",
      actionUrl: `/engagement/${primaryProject.id}`,
      readAt: "2026-06-07T16:00:00.000Z",
      createdAt: "2026-06-07T15:50:00.000Z",
      sender: defaultUsers[3],
      project: primaryProjectInboxContext,
      workingPaper: cashPaperInboxContext,
      reviewQuestion: null,
      projectInvitation: null,
    },
    {
      id: "message-sidebar-invitation",
      recipientId: "user-partner",
      senderId: "user-manager",
      projectId: primaryProject.id,
      workingPaperId: null,
      reviewQuestionId: null,
      type: "PROJECT_INVITATION",
      ...mockInboxContent("PROJECT_INVITATION", {
        actor: "Leo Li",
        projectCode: primaryProject.projectCode,
        projectName: primaryProject.name ?? primaryProject.projectCode,
        role: "Partner",
      }),
      contentKey: "PROJECT_INVITATION",
      contentParams: {
        actor: "Leo Li",
        projectCode: primaryProject.projectCode,
        projectName: primaryProject.name ?? primaryProject.projectCode,
        role: "PARTNER",
      },
      actionUrl: "/invitations/preview-token-orchid",
      readAt: null,
      createdAt: "2026-08-25T06:48:00.000Z",
      sender: defaultUsers[2],
      project: primaryProjectInboxContext,
      workingPaper: null,
      reviewQuestion: null,
      projectInvitation: {
        id: "invite-orchid-sidebar",
        status: "PENDING",
        invitedRole: "PARTNER",
        expiresAt: "2026-09-01T00:00:00.000Z",
        project: primaryProjectInboxContext,
      },
    },
    {
      id: "message-sidebar-archive-reminder",
      recipientId: "user-partner",
      senderId: null,
      projectId: primaryProject.id,
      workingPaperId: null,
      reviewQuestionId: null,
      type: "SYSTEM_NOTIFICATION",
      ...mockInboxContent("PROJECT_ARCHIVE_DEADLINE_REMINDER", {
        projectCode: primaryProject.projectCode,
        projectName: primaryProject.name ?? primaryProject.projectCode,
        deadline: "2026-08-31",
        days: 6,
      }),
      contentKey: "PROJECT_ARCHIVE_DEADLINE_REMINDER",
      contentParams: {
        projectCode: primaryProject.projectCode,
        projectName: primaryProject.name ?? primaryProject.projectCode,
        deadline: "2026-08-31",
        days: 6,
      },
      actionUrl: `/engagement/${primaryProject.id}`,
      readAt: null,
      createdAt: "2026-08-24T17:00:00.000Z",
      sender: null,
      project: primaryProjectInboxContext,
      workingPaper: null,
      reviewQuestion: null,
      projectInvitation: null,
    },
    {
      id: "message-sidebar-attachment-conflict",
      recipientId: "user-partner",
      senderId: null,
      projectId: primaryProject.id,
      workingPaperId: cashPaperInboxContext.id,
      reviewQuestionId: null,
      type: "ATTACHMENT_CONFLICT",
      ...mockInboxContent("ATTACHMENT_CONFLICT", {
        fileName: "Cash current year lead schedule.xlsx",
        candidateVersionId: "candidate-20260824-1635",
      }),
      contentKey: "ATTACHMENT_CONFLICT",
      contentParams: {
        fileName: "Cash current year lead schedule.xlsx",
        candidateVersionId: "candidate-20260824-1635",
      },
      actionUrl: `/engagement/${primaryProject.id}`,
      readAt: null,
      createdAt: "2026-08-24T16:35:00.000Z",
      sender: null,
      project: primaryProjectInboxContext,
      workingPaper: cashPaperInboxContext,
      reviewQuestion: null,
      projectInvitation: null,
    },
    {
      id: "message-sidebar-prepared",
      recipientId: "user-partner",
      senderId: "user-senior",
      projectId: primaryProject.id,
      workingPaperId: cashPaperInboxContext.id,
      reviewQuestionId: null,
      type: "SIGNOFF",
      ...mockInboxContent("WORKING_PAPER_PREPARED", {
        actor: "Sam Lu",
        paperCode: cashPaperInboxContext.code,
        paperTitle: cashPaperInboxContext.title,
      }),
      contentKey: "WORKING_PAPER_PREPARED",
      contentParams: {
        actor: "Sam Lu",
        paperCode: cashPaperInboxContext.code,
        paperTitle: cashPaperInboxContext.title,
      },
      actionUrl: `/engagement/${primaryProject.id}`,
      readAt: "2026-08-23T11:12:00.000Z",
      createdAt: "2026-08-23T11:10:00.000Z",
      sender: defaultUsers[3],
      project: primaryProjectInboxContext,
      workingPaper: cashPaperInboxContext,
      reviewQuestion: null,
      projectInvitation: null,
    },
    {
      id: "message-sidebar-reviewed",
      recipientId: "user-partner",
      senderId: "user-manager",
      projectId: primaryProject.id,
      workingPaperId: cashPaperInboxContext.id,
      reviewQuestionId: null,
      type: "SIGNOFF",
      ...mockInboxContent("WORKING_PAPER_REVIEWED", {
        actor: "Leo Li",
        paperCode: cashPaperInboxContext.code,
        paperTitle: cashPaperInboxContext.title,
      }),
      contentKey: "WORKING_PAPER_REVIEWED",
      contentParams: {
        actor: "Leo Li",
        paperCode: cashPaperInboxContext.code,
        paperTitle: cashPaperInboxContext.title,
      },
      actionUrl: `/engagement/${primaryProject.id}`,
      readAt: "2026-08-22T09:20:00.000Z",
      createdAt: "2026-08-22T09:18:00.000Z",
      sender: defaultUsers[2],
      project: primaryProjectInboxContext,
      workingPaper: cashPaperInboxContext,
      reviewQuestion: null,
      projectInvitation: null,
    },
    {
      id: "message-sidebar-archive-review",
      recipientId: "user-partner",
      senderId: null,
      projectId: primaryProject.id,
      workingPaperId: null,
      reviewQuestionId: null,
      type: "SYSTEM_NOTIFICATION",
      ...mockInboxContent("PROJECT_ARCHIVE_REVIEW_REQUESTED", {
        projectCode: primaryProject.projectCode,
        projectName: primaryProject.name ?? primaryProject.projectCode,
      }),
      contentKey: "PROJECT_ARCHIVE_REVIEW_REQUESTED",
      contentParams: {
        projectCode: primaryProject.projectCode,
        projectName: primaryProject.name ?? primaryProject.projectCode,
      },
      actionUrl: `/engagement/${primaryProject.id}`,
      readAt: "2026-08-21T14:10:00.000Z",
      createdAt: "2026-08-21T14:08:00.000Z",
      sender: null,
      project: primaryProjectInboxContext,
      workingPaper: null,
      reviewQuestion: null,
      projectInvitation: null,
    },
    {
      id: "message-sidebar-archive-completed",
      recipientId: "user-partner",
      senderId: null,
      projectId: primaryProject.id,
      workingPaperId: null,
      reviewQuestionId: null,
      type: "SYSTEM_NOTIFICATION",
      ...mockInboxContent("PROJECT_ARCHIVE_COMPLETED", {
        projectCode: primaryProject.projectCode,
        projectName: primaryProject.name ?? primaryProject.projectCode,
        packageFileName: "AUD-2026-0001-final-archive.zip",
      }),
      contentKey: "PROJECT_ARCHIVE_COMPLETED",
      contentParams: {
        projectCode: primaryProject.projectCode,
        projectName: primaryProject.name ?? primaryProject.projectCode,
        packageFileName: "AUD-2026-0001-final-archive.zip",
      },
      actionUrl: `/engagement/${primaryProject.id}`,
      readAt: "2026-08-14T18:02:00.000Z",
      createdAt: "2026-08-14T18:00:00.000Z",
      sender: null,
      project: primaryProjectInboxContext,
      workingPaper: null,
      reviewQuestion: null,
      projectInvitation: null,
    },
  ],
  confirmations: {
    "project-orchid-2026": [
      {
        id: "confirmation-orchid-bank-1",
        projectId: "project-orchid-2026",
        type: "BANK",
        status: "AWAITING_RESPONSE",
        clientName: "Orchid Holdings",
        confirmationCode: "YH-2026-1",
        auditPeriod: "2026",
        counterpartyName: "HSBC Hong Kong",
        respondingEntityName: "Orchid Holdings Limited",
        thirdPartyName: "HSBC Hong Kong",
        subjectName: "Cash",
        attachmentName: null,
        counterpartyContact: "Confirmation team",
        counterpartyAddress: "1 Queen's Road Central, Hong Kong",
        responsibleUserId: "user-manager",
        plannedSendDate: "2026-06-20T00:00:00.000Z",
        reportDeadline: "2026-07-15T00:00:00.000Z",
        currentArtifactId: "confirmation-orchid-bank-artifact-1",
        currentArtifact: {
          id: "confirmation-orchid-bank-artifact-1",
          confirmationId: "confirmation-orchid-bank-1",
          version: 1,
          disposition: "ACTIVE",
          templateCode: "STANDARD_FINANCIAL_INSTITUTION",
          templateVersion: "1.0",
          docxSize: 148_320,
          pdfSize: 96_214,
          pdfSha256:
            "b698f9af592f381e616733250adbda044aa73bc1bf8ce593e64f4d3e855638ef",
          submittedBy: "user-partner",
          submittedAt: "2026-06-18T09:12:00.000Z",
        },
        preparedDispatchMethod: "COURIER",
        preparedCourierName: "SF Express",
        preparedTrackingNumber: "SF123456789HK",
        preparedDispatchReadyBy: "user-partner",
        preparedDispatchReadyAt: "2026-06-18T09:12:00.000Z",
        teamConfirmStatus: "PENDING",
        teamConfirmedByName: null,
        teamConfirmedAt: null,
        differenceStatus: null,
        notes: "Cash balance confirmation",
        createdBy: "user-partner",
        createdAt: "2026-06-07T09:30:00.000Z",
        updatedAt: "2026-06-23T15:20:00.000Z",
        responsibleUser: defaultUsers[2],
        creator: defaultUsers[1],
        dispatches: [
          {
            id: "confirmation-orchid-bank-dispatch-1",
            confirmationId: "confirmation-orchid-bank-1",
            sequence: 1,
            method: "COURIER",
            sentAt: "2026-06-20T10:08:00.000Z",
            senderName: "Jony Ma",
            courierName: "SF Express",
            trackingNumber: "SF123456789HK",
            trackingProvider: "17TRACK",
            trackingCarrierName: "SF Express",
            trackingStatus: "InTransit",
            trackingDescription:
              "Shipment arrived at Hong Kong delivery station",
            trackingLocation: "Hong Kong",
            trackingEvents: [
              {
                at: "2026-06-22T08:42:00.000Z",
                description: "Shipment arrived at Hong Kong delivery station",
                location: "Hong Kong",
                stage: "InTransit",
              },
              {
                at: "2026-06-21T16:18:00.000Z",
                description: "Shipment departed from Shenzhen sorting center",
                location: "Shenzhen",
                stage: "InTransit",
              },
              {
                at: "2026-06-20T18:06:00.000Z",
                description: "Shipment picked up by carrier",
                location: "Shenzhen",
                stage: "InfoReceived",
              },
            ],
            trackingRegisteredAt: "2026-06-20T10:10:00.000Z",
            trackingLastEventAt: "2026-06-22T08:42:00.000Z",
            trackingUpdatedAt: "2026-06-22T08:45:00.000Z",
            createdBy: "user-partner",
            createdAt: "2026-06-20T10:08:00.000Z",
          },
        ],
        responses: [],
        followUpEvents: [
          {
            id: "confirmation-orchid-bank-follow-up-1",
            confirmationId: "confirmation-orchid-bank-1",
            eventType: "COUNTERPARTY_RECEIVED",
            actorId: "user-manager",
            source: "MANUAL",
            notes: "Counterparty confirmed receipt by phone.",
            occurredAt: "2026-06-23T15:20:00.000Z",
            createdAt: "2026-06-23T15:20:00.000Z",
          },
        ],
      },
    ],
  },
  auditLogs: {
    "project-orchid-2026": [
      {
        id: "log-1",
        action: "PROJECT_CREATED",
        targetType: "PROJECT",
        targetId: "project-orchid-2026",
        projectId: "project-orchid-2026",
        ipAddress: "preview",
        userAgent: "ProjectWing mock preview",
        description: "鍒涘缓椤圭洰 AUD-2026-0001",
        createdAt: "2026-05-28T09:00:00.000Z",
        actor: defaultUsers[1],
      },
    ],
  },
  invitations: {
    "preview-token-orchid": {
      projectId: primaryProject.id,
      invitedRole: "PREPARER",
    },
  },
};

function node(
  id: string,
  code: string,
  title: string,
  level: number,
  children: WorkflowNode[] = [],
  workingPapers: WorkflowNode["workingPapers"] = []
): WorkflowNode {
  return {
    id,
    parentId: null,
    code,
    title,
    level,
    nodeType: level === 1 ? "PHASE" : "CUSTOM",
    workingPapers,
    children,
  };
}

function addPreviewPapersToWorkflow(
  workflow: WorkflowNode[],
  papersByNodeId: Record<string, WorkflowNode["workingPapers"]>
): WorkflowNode[] {
  return workflow.map((item) => ({
    ...item,
    workingPapers: [
      ...((papersByNodeId[item.id] as WorkflowNode["workingPapers"]) ?? []),
      ...(item.workingPapers ?? []),
    ],
    children: addPreviewPapersToWorkflow(item.children ?? [], papersByNodeId),
  }));
}

function mockWorkingPaper(
  projectId: string,
  workflowNodeId: string,
  id: string,
  code: string,
  originalName: string,
  bucket: NonNullable<WorkflowNode["workingPapers"][number]["bucket"]>,
  fileKind: Attachment["fileKind"] = "SPREADSHEET",
  additionalAttachments: {
    originalName: string;
    fileKind: Attachment["fileKind"];
  }[] = [],
  reviewQuestions: WorkingPaperQuestion[] = []
): WorkflowNode["workingPapers"][number] {
  const attachments = [
    { originalName, fileKind },
    ...additionalAttachments,
  ].map((attachment, sortOrder) =>
    mockWorkingPaperAttachment({
      projectId,
      workingPaperId: id,
      workflowNodeId,
      bucket,
      code,
      sortOrder,
      ...attachment,
    })
  );

  return {
    id,
    projectId,
    workflowNodeId,
    templateItemId: null,
    code,
    title: originalName,
    paperType: "WORKING_PAPER",
    bucket,
    preparerId: null,
    reviewerId: null,
    preparedAt: null,
    reviewedAt: null,
    returnedAt: null,
    reviewNote: null,
    preparer: null,
    reviewer: null,
    attachments,
    signoffs: [],
    reviewQuestions,
  };
}

function mockWorkingPaperAttachment({
  projectId,
  workingPaperId,
  workflowNodeId,
  bucket,
  code,
  originalName,
  fileKind,
  sortOrder,
}: {
  projectId: string;
  workingPaperId: string;
  workflowNodeId: string;
  bucket: NonNullable<WorkflowNode["workingPapers"][number]["bucket"]>;
  code: string;
  originalName: string;
  fileKind: Attachment["fileKind"];
  sortOrder: number;
}): Attachment {
  const attachmentId = `${workingPaperId}-attachment-${sortOrder + 1}`;
  return {
    id: attachmentId,
    workingPaperId,
    workflowNodeId,
    bucket,
    code,
    title: originalName,
    fileKind,
    fileName: `${workingPaperId}-${originalName}`,
    originalName,
    fileUrl: `mock://working-papers/${projectId}/${workingPaperId}/${originalName}`,
    fileSize: getMockAttachmentFileSize(originalName, fileKind),
    mimeType: getMockAttachmentMimeType(originalName, fileKind),
    sortOrder,
    version: 1,
    headVersionId: `${attachmentId}-v1`,
    workDate: "2026-06-15T00:00:00.000Z",
    lockedBy: null,
    lockedAt: null,
    lockExpiresAt: null,
    uploadedBy: "user-partner",
    deletedAt: null,
    deletedBy: null,
    restoredAt: null,
    restoredBy: null,
    lastModifiedBy: "user-partner",
    lastModifiedAt: "2026-06-15T10:00:00.000Z",
    uploader: defaultUsers[1],
    lockHolder: null,
    lastModifier: defaultUsers[1],
  };
}

function getMockAttachmentMimeType(
  originalName: string,
  fileKind: Attachment["fileKind"]
) {
  const fileName = originalName.toLowerCase();

  if (fileName.endsWith(".zip")) {
    return "application/zip";
  }
  if (fileName.endsWith(".7z")) {
    return "application/x-7z-compressed";
  }
  if (fileName.endsWith(".rar")) {
    return "application/vnd.rar";
  }
  if (fileName.endsWith(".tar")) {
    return "application/x-tar";
  }
  if (/\.(tgz|gz)$/.test(fileName)) {
    return "application/gzip";
  }
  if (/\.(tbz2?|bz2)$/.test(fileName)) {
    return "application/x-bzip2";
  }
  if (/\.(txz|xz)$/.test(fileName)) {
    return "application/x-xz";
  }
  if (fileName.endsWith(".cab")) {
    return "application/vnd.ms-cab-compressed";
  }
  if (fileName.endsWith(".iso")) {
    return "application/octet-stream";
  }
  if (fileName.endsWith(".pdf")) {
    return "application/pdf";
  }
  if (fileName.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (fileName.endsWith(".ppt")) {
    return "application/vnd.ms-powerpoint";
  }
  if (fileName.endsWith(".csv")) {
    return "text/csv";
  }
  if (fileName.endsWith(".tsv")) {
    return "text/tab-separated-values";
  }
  if (fileName.endsWith(".doc")) {
    return "application/msword";
  }
  if (fileName.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (fileName.endsWith(".msg")) {
    return "application/vnd.ms-outlook";
  }
  if (fileName.endsWith(".eml")) {
    return "message/rfc822";
  }
  if (fileName.endsWith(".svg")) {
    return "image/svg+xml";
  }
  if (fileName.endsWith(".avif")) {
    return "image/avif";
  }
  if (fileName.endsWith(".bmp")) {
    return "image/bmp";
  }
  if (fileName.endsWith(".gif")) {
    return "image/gif";
  }
  if (/\.jpe?g$/.test(fileName)) {
    return "image/jpeg";
  }
  if (fileName.endsWith(".webp")) {
    return "image/webp";
  }
  if (/\.(aac|flac|m4a|mp3|ogg|wav)$/.test(fileName)) {
    return "audio/mpeg";
  }
  if (/\.(mov|mp4|webm)$/.test(fileName)) {
    return "video/mp4";
  }
  if (fileName.endsWith(".json")) {
    return "application/json";
  }
  if (fileName.endsWith(".xml")) {
    return "application/xml";
  }
  if (/\.(md|markdown|mdx)$/.test(fileName)) {
    return "text/markdown";
  }
  if (fileName.endsWith(".html") || fileName.endsWith(".htm")) {
    return "text/html";
  }
  if (fileName.endsWith(".css")) {
    return "text/css";
  }
  if (/\.(cjs|js)$/.test(fileName)) {
    return "text/javascript";
  }
  if (/\.(sql|ts|tsx|txt|log|yaml|yml)$/.test(fileName)) {
    return "text/plain";
  }
  if (fileKind === "SPREADSHEET") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }

  return "application/octet-stream";
}

function getMockAttachmentFileSize(
  originalName: string,
  fileKind: Attachment["fileKind"]
) {
  const fileName = originalName.toLowerCase();
  if (fileName.endsWith(".msg")) {
    return 3072;
  }
  if (/\.docx?$/.test(fileName)) {
    return 26_037;
  }
  if (/\.pptx?$/.test(fileName)) {
    return 39_387;
  }
  if (fileName.endsWith(".pdf")) {
    return 951;
  }
  if (
    /\.(zip|rar|7z|tar|tgz|gz|tbz2?|bz2|txz|xz|cab|ar|cpio|iso)$/.test(fileName)
  ) {
    return 256;
  }
  if (/\.(mp4|mov|webm)$/.test(fileName)) {
    return 1800;
  }
  if (/\.(aac|flac|m4a|mp3|ogg|wav)$/.test(fileName)) {
    return 256;
  }
  if (/\.(avif|bmp|gif|jpe?g|png|svg|webp)$/.test(fileName)) {
    return 512;
  }
  if (fileKind === "SPREADSHEET") {
    return 19_773;
  }
  return 256;
}
