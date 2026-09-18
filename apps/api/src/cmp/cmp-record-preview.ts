import type { CmpClient, CmpEngagement } from "@project-wing/shared";
import {
  CMP_ENGAGEMENT_DELIVERABLE_LABELS,
  CMP_ENGAGEMENT_FEE_PLAN_GRADE_LABELS,
  CMP_HSIC_SECTION_OPTIONS,
} from "@project-wing/shared";
import type { CmpClientGraph } from "@project-wing/shared/cmp-entity-graph";
import { CmpRecordPreviewDocumentSchema } from "@project-wing/shared/cmp-record-preview";
import type {
  CmpRecordPreviewDocument,
  CmpRecordPreviewField,
  CmpRecordPreviewLocale,
} from "@project-wing/shared/cmp-record-preview";

const EMPTY_VALUE = "—";
const COPY = {
  "en-US": {
    active: "Active",
    inactive: "Inactive",
    resigned: "Resigned",
    completed: "Completed",
    archived: "Archived",
    yes: "Yes",
    no: "No",
    clientSections: [
      "Client information",
      "Registration / regulation",
      "Group relationship / client source",
      "Responsible persons / expected services",
    ],
    engagementSections: ["Engagement Setup", "Budget", "Status and Remarks"],
  },
  "zh-CN": {
    active: "有效",
    inactive: "无效",
    resigned: "已辞任",
    completed: "已完成",
    archived: "已归档",
    yes: "是",
    no: "否",
    clientSections: [
      "客户信息",
      "注册／监管",
      "集团关系／客户来源",
      "负责人／预期服务",
    ],
    engagementSections: ["业务设置", "预算", "状态及备注"],
  },
} as const;

export function buildClientPreviewDocument(
  client: CmpClient,
  locale: CmpRecordPreviewLocale,
  graph?: CmpClientGraph
) {
  const copy = COPY[locale];
  const addresses = client.addresses ?? [];
  const registeredAddress =
    addresses.find((address) => address.type === "REGISTERED")?.address ??
    client.address;
  const principalAddress =
    addresses.find((address) => address.type === "PRINCIPAL")?.address ??
    client.address;
  const additionalAddresses = addresses
    .filter((address) => address.type === "OTHER")
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((address, index) =>
      [
        address.label ||
          label(
            locale,
            `Additional address ${index + 1}`,
            `附加地址 ${index + 1}`
          ),
        address.address,
      ].join(": ")
    )
    .join("\n");
  const relationships = (client.relationships ?? [])
    .map((relationship) => formatRelationship(client.id, relationship, locale))
    .join("\n");
  const graphEntityNames = new Map(
    (graph?.nodes ?? []).map((node) => [node.id, node.displayName])
  );
  const groupRelationships = (graph?.groupRelationships ?? [])
    .map((relationship) => {
      const participants = relationship.participants
        .map((participant) =>
          [
            graphEntityNames.get(participant.entityId) ?? participant.entityId,
            formatInterestDetails(participant, locale),
          ]
            .filter(Boolean)
            .join(" · ")
        )
        .join("; ");
      return [
        relationship.type === "ASSOCIATE"
          ? label(locale, "Associate", "联营")
          : label(locale, "Joint venture", "合营"),
        graphEntityNames.get(relationship.targetEntityId) ??
          relationship.targetEntityId,
        participants,
      ]
        .filter(Boolean)
        .join(" · ");
    })
    .join("\n");
  const hsic = CMP_HSIC_SECTION_OPTIONS.find(
    (option) => option.code === client.hsicSectionCode
  );

  return CmpRecordPreviewDocumentSchema.parse({
    kind: "CLIENT",
    recordId: client.id,
    code: client.clientCode,
    title: client.nameEn || client.nameZh || client.clientCode,
    status: clientStatusLabel(client.status, locale),
    updatedAt: normalizeDateTime(client.updatedAt),
    sections: [
      section("basic", copy.clientSections[0], [
        field(
          "clientCode",
          label(locale, "Client Code", "客户编号"),
          client.clientCode
        ),
        field(
          "companyCode",
          label(locale, "Company Code", "公司代码"),
          client.companyCode
        ),
        field(
          "companyIdentifierType",
          label(locale, "Company Identifier Type", "公司编号类型"),
          companyIdentifierTypeLabel(client.companyIdentifierType, locale)
        ),
        field(
          "companyNumber",
          label(locale, "Company Number", "公司编号"),
          client.companyNumber
        ),
        field(
          "nameEn",
          label(locale, "Company Name English", "公司英文名称"),
          client.nameEn
        ),
        field(
          "nameZh",
          label(locale, "Company Name Chinese", "公司中文名称"),
          client.nameZh
        ),
        field(
          "status",
          label(locale, "Client Status", "客户状态"),
          clientStatusLabel(client.status, locale)
        ),
        field("website", label(locale, "Website", "网站"), client.website),
        field(
          "yearEndMonth",
          label(locale, "Year End Month", "年结月份"),
          formatMonth(client.yearEndMonth, locale)
        ),
        field(
          "registeredAddress",
          label(locale, "Registered Address", "注册地址"),
          registeredAddress
        ),
        field(
          "principalAddressSameAsRegistered",
          label(
            locale,
            "Principal address same as registered",
            "主要营业地址与注册地址相同"
          ),
          booleanLabel(client.principalAddressSameAsRegistered, locale)
        ),
        field(
          "principalBusinessAddress",
          label(locale, "Principal Business Address", "主要营业地址"),
          principalAddress
        ),
        field(
          "additionalAddresses",
          label(locale, "Additional Addresses", "附加地址"),
          additionalAddresses
        ),
        field(
          "contactPerson",
          label(locale, "Contact Name", "联系人"),
          client.contactPerson
        ),
        field(
          "contactPosition",
          label(locale, "Position", "职位"),
          client.contactPosition
        ),
        field(
          "contactDepartment",
          label(locale, "Department", "部门"),
          client.contactDepartment
        ),
        field(
          "telephone",
          label(locale, "Office Telephone", "办公电话"),
          client.telephone
        ),
        field(
          "contactMobile",
          label(locale, "Mobile", "手机"),
          client.contactMobile
        ),
        field("email", label(locale, "Email", "电子邮箱"), client.email),
        field(
          "contactRemarks",
          label(locale, "Contact Notes", "联系人备注"),
          client.contactRemarks
        ),
        field("remarks", label(locale, "Remarks", "备注"), client.remarks),
      ]),
      section("registration", copy.clientSections[1], [
        field(
          "placeOfIncorporation",
          label(locale, "Place of Incorporation", "注册地"),
          client.placeOfIncorporation
        ),
        field(
          "incorporationYearMonth",
          label(locale, "Incorporation Month", "成立年月"),
          client.incorporationYearMonth
        ),
        field(
          "reportingGaap",
          label(locale, "Reporting GAAP", "报告会计准则"),
          client.reportingGaap
        ),
        field(
          "hsicSectionCode",
          label(locale, "Industry", "行业"),
          client.hsicSectionCode === "OTHER"
            ? label(locale, "Other", "其他")
            : hsic
              ? `${hsic.code} - ${locale === "zh-CN" ? hsic.zh : hsic.en}`
              : null
        ),
        field(
          "industryOtherDescription",
          label(locale, "Other Industry Description", "其他行业说明"),
          client.industryOtherDescription
        ),
        field(
          "listedOrPrivate",
          label(locale, "Company Type", "公司类型"),
          companyTypeLabel(client.listedOrPrivate, locale)
        ),
        field(
          "companyTypeOtherDescription",
          label(locale, "Other Company Type", "其他公司类型"),
          client.companyTypeOtherDescription
        ),
        field(
          "marketSegment",
          label(locale, "Main Board / GEM / Others", "主板／GEM／其他"),
          client.marketSegment
        ),
        field(
          "stockExchangeOrListingPlace",
          label(
            locale,
            "Stock Exchange / Place of Listing",
            "证券交易所／上市地点"
          ),
          client.stockExchangeOrListingPlace
        ),
        field(
          "stockCode",
          label(locale, "Stock Code", "股票代码"),
          client.stockCode
        ),
        field(
          "regulatedEntities",
          label(locale, "Regulated Entities", "受监管实体"),
          client.regulatedEntities
        ),
        field(
          "regulatedBy",
          label(locale, "Regulator / Regulated By", "监管机构"),
          client.regulatedBy
        ),
      ]),
      section("relationships", copy.clientSections[2], [
        field(
          "relationships",
          label(locale, "Client Relationships", "客户关系"),
          relationships
        ),
        field(
          "groupRelationships",
          label(locale, "Associates and joint ventures", "联营及合营关系"),
          groupRelationships
        ),
        field(
          "referredBy",
          label(locale, "Referred By", "推荐人"),
          client.referredBy
        ),
      ]),
      section("responsible-and-services", copy.clientSections[3], [
        field(
          "clientLeadingPartner",
          label(locale, "Client Leading Partner", "客户主管合伙人"),
          client.clientLeadingPartner
        ),
        field("clientPartnerPic", "PIC", client.clientPartnerPic),
        field("clientManagerMic", "MIC", client.clientManagerMic),
        field(
          "alternativePartnerSecondMic",
          label(locale, "2nd MIC", "第二 MIC"),
          client.alternativePartnerSecondMic
        ),
        field(
          "serviceLines",
          label(locale, "Service Type", "服务类型"),
          formatClientServiceLines(
            client.serviceLines ?? client.serviceType,
            locale
          )
        ),
        field(
          "expectedJobOrEngagementType",
          label(locale, "Expected Job / Engagement Type", "预期工作／业务类型"),
          client.expectedJobOrEngagementType
        ),
      ]),
    ],
  });
}

export function buildEngagementPreviewDocument(
  engagement: CmpEngagement,
  locale: CmpRecordPreviewLocale
) {
  const copy = COPY[locale];
  return CmpRecordPreviewDocumentSchema.parse({
    kind: "ENGAGEMENT",
    recordId: engagement.id,
    code: engagement.engagementCode,
    title: engagement.engagementCode,
    status: engagementStatusLabel(engagement.status, locale),
    updatedAt: normalizeDateTime(engagement.updatedAt),
    sections: [
      section("setup", copy.engagementSections[0], [
        field(
          "client",
          label(locale, "Client", "客户"),
          formatEngagementClient(engagement)
        ),
        field(
          "engagementCode",
          label(locale, "Engagement Code", "业务代码"),
          engagement.engagementCode
        ),
        field(
          "serviceType",
          label(locale, "Service Type", "服务类型"),
          serviceTypeLabel(engagement.serviceType, locale)
        ),
        field(
          "otherServiceDescription",
          label(locale, "Others Description", "其他服务说明"),
          engagement.otherServiceDescription
        ),
        field(
          "approvalReferenceNumber",
          label(locale, "Approval No.", "批准编号"),
          engagement.approvalReferenceNumber
        ),
        field(
          "engagementDate",
          label(locale, "Engagement Date", "业务日期"),
          formatDate(engagement.engagementDate, locale)
        ),
        field(
          "yearEndDate",
          label(locale, "Year End", "年结日"),
          formatDate(engagement.yearEndDate, locale)
        ),
        field(
          "reportDate",
          label(locale, "Estimated Report Date", "预计报告日期"),
          formatDate(engagement.reportDate, locale)
        ),
        field(
          "amlRiskClassification",
          label(locale, "AML / TF Risk", "反洗钱／恐怖融资风险"),
          engagement.amlRiskClassification === "HIGH"
            ? label(locale, "High", "高风险")
            : label(locale, "Not high", "非高风险")
        ),
        field(
          "engagementRiskClassification",
          label(locale, "Engagement Risk", "业务风险"),
          engagementRiskClassificationLabel(
            engagement.engagementRiskClassification,
            locale
          )
        ),
        field("pic", "PIC", engagement.pic),
        field("mic", "MIC", engagement.mic),
        field("eqReviewer", "EQR", engagement.eqReviewer),
        field(
          "deliverables",
          label(locale, "Selected deliverables", "已选交付物"),
          formatEngagementDeliverables(engagement.deliverables, locale)
        ),
      ]),
      section(
        "budget",
        copy.engagementSections[1],
        [
          field(
            "budgetedHours",
            label(locale, "Budgeted Hours", "预算工时"),
            engagement.budgetedHours
          ),
          field(
            "agreedFee",
            label(locale, "Agreed Fee", "约定费用"),
            formatMoney(engagement.agreedFee, engagement.feeCurrency, locale)
          ),
          field(
            "recoveryRate",
            label(locale, "Recovery Rate", "回收率"),
            engagement.recoveryRate ? `${engagement.recoveryRate}%` : null
          ),
          field(
            "feeCurrency",
            label(locale, "Currency", "币种"),
            engagement.feeCurrency
          ),
          field(
            "feeExchangeRate",
            label(
              locale,
              "Applied exchange rate (1 foreign currency = HKD)",
              "应用汇率（1 外币 = HKD）"
            ),
            engagement.feeCurrency === "HKD"
              ? "1.00000000"
              : engagement.feeExchangeRateHkdPerUnit
          ),
          field(
            "feeExchangeRateSource",
            label(locale, "Exchange rate source", "汇率来源"),
            engagement.feeExchangeRateSource === "MANUAL"
              ? label(locale, "Manual rate", "手工汇率")
              : label(locale, "System rate", "系统汇率")
          ),
          field(
            "agreedFeeHkd",
            label(locale, "HKD settlement agreed fee", "港币结算协定收费"),
            formatMoney(engagement.agreedFeeHkd, "HKD", locale)
          ),
        ],
        (engagement.feePlanningLines ?? []).length > 0
          ? [feePlanningPreviewTable(engagement, locale)]
          : []
      ),
      section("notes", copy.engagementSections[2], [
        field(
          "status",
          label(locale, "Status", "状态"),
          engagementStatusLabel(engagement.status, locale)
        ),
        field("remarks", label(locale, "Remarks", "备注"), engagement.remarks),
      ]),
    ],
  });
}

function engagementRiskClassificationLabel(
  value: CmpEngagement["engagementRiskClassification"],
  locale: CmpRecordPreviewLocale
) {
  if (value === "GREATER_THAN_NORMAL") {
    return label(locale, "Greater than normal", "高于正常");
  }
  return label(locale, "Normal (e.g. Private entity)", "正常（例如私人公司）");
}

function formatEngagementDeliverables(
  deliverables: CmpEngagement["deliverables"],
  locale: CmpRecordPreviewLocale
) {
  if (!deliverables?.length) {
    return null;
  }
  return [...deliverables]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item) => {
      const itemLabel =
        CMP_ENGAGEMENT_DELIVERABLE_LABELS[item.code]?.[
          locale === "zh-CN" ? "zh" : "en"
        ] ?? item.code;
      return item.description ? `${itemLabel}: ${item.description}` : itemLabel;
    })
    .join("\n");
}

export function buildCmpRecordPreviewPdfSource(
  document: CmpRecordPreviewDocument
) {
  const sections = document.sections
    .map(
      (sectionData) => `#heading(level: 2)[${typstText(sectionData.title)}]
#table(
  columns: (52mm, 1fr),
  stroke: rgb(217, 224, 232),
  inset: 2.2mm,
  ${sectionData.fields
    .map(
      (item) =>
        `[#text(weight: "bold")[${typstText(item.label)}]], [${typstText(item.value)}]`
    )
    .join(",\n  ")}
)
#v(4mm)
${(sectionData.tables ?? []).map((table) => previewTableTypst(table)).join("\n")}`
    )
    .join("\n");

  return `#set page(paper: "a4", margin: (x: 16mm, y: 15mm), numbering: "1 / 1")
#set text(size: 9pt)
#heading(level: 1)[${typstText(document.title)}]
#text(fill: rgb(93, 107, 130))[${typstText(document.code)}]
#v(5mm)
${sections}`;
}

function section(
  id: string,
  title: string,
  fields: CmpRecordPreviewField[],
  tables: NonNullable<
    CmpRecordPreviewDocument["sections"][number]["tables"]
  > = []
) {
  return { id, title, fields, tables };
}

function feePlanningPreviewTable(
  engagement: CmpEngagement,
  locale: CmpRecordPreviewLocale
) {
  const currency = engagement.feeCurrency;
  // Engagements created before fee planning did not carry this relation in
  // Serialized fixtures or cached payloads. Treat those records as having no
  // Optional fee-plan rows.
  const lines = engagement.feePlanningLines ?? [];
  const totalHours = lines.reduce(
    (sum, line) => sum + Number(line.budgetHours),
    0
  );
  const totalAmount = lines.reduce(
    (sum, line) => sum + Number(line.lineTotal),
    0
  );
  return {
    id: "fee-planning-lines",
    title: label(locale, "Budget details", "预算明细"),
    columns: [
      label(locale, "Firm Grade", "事务所职级"),
      label(locale, "Staff Name", "员工姓名"),
      label(locale, "Date (From)", "开始日期"),
      label(locale, "Date (To)", "结束日期"),
      label(locale, "Fixed Hourly Rate", "固定时薪"),
      label(locale, "Budget in Hours", "预算工时"),
      label(locale, "Total", "总额"),
    ],
    rows: lines.map((line) => [
      CMP_ENGAGEMENT_FEE_PLAN_GRADE_LABELS[line.grade][
        locale === "zh-CN" ? "zh" : "en"
      ],
      line.assignmentType === "STAFF"
        ? (line.staff?.name ?? EMPTY_VALUE)
        : "TBC",
      formatDate(line.dateFrom, locale) ?? EMPTY_VALUE,
      formatDate(line.dateTo, locale) ?? EMPTY_VALUE,
      formatMoney(line.hourlyRate, currency, locale) ?? "—",
      Number(line.budgetHours).toFixed(2),
      formatMoney(line.lineTotal, currency, locale) ?? "—",
    ]),
    footer: [
      label(locale, "Detail total hours", "明细总工时"),
      "",
      "",
      "",
      "",
      totalHours.toFixed(2),
      formatMoney(totalAmount.toFixed(2), currency, locale) ?? "—",
    ],
  };
}

function previewTableTypst(
  table: NonNullable<
    CmpRecordPreviewDocument["sections"][number]["tables"]
  >[number]
) {
  const cells = [
    ...table.columns.map(
      (column) => `[#text(weight: "bold")[${typstText(column)}]]`
    ),
    ...table.rows.flatMap((row) => row.map((cell) => `[${typstText(cell)}]`)),
    ...(table.footer
      ? table.footer.map(
          (cell) => `[#text(weight: "bold")[${typstText(cell)}]]`
        )
      : []),
  ];
  return `#text(weight: "bold")[${typstText(table.title)}]
#v(2mm)
#table(
  columns: (${table.columns.map(() => "1fr").join(", ")} ),
  stroke: rgb(217, 224, 232),
  inset: 2mm,
  ${cells.join(",\n  ")}
)
#v(4mm)`;
}

function field(id: string, fieldLabel: string, input: unknown) {
  return { id, label: fieldLabel, value: previewValue(input) };
}

function previewValue(input: unknown) {
  if (input === null || input === undefined || input === "") {
    return EMPTY_VALUE;
  }
  return String(input);
}

function label(locale: CmpRecordPreviewLocale, en: string, zh: string) {
  return locale === "zh-CN" ? zh : en;
}

function booleanLabel(
  input: boolean | null | undefined,
  locale: CmpRecordPreviewLocale
) {
  if (input === null || input === undefined) {
    return null;
  }
  return input ? COPY[locale].yes : COPY[locale].no;
}

function clientStatusLabel(
  status: CmpClient["status"],
  locale: CmpRecordPreviewLocale
) {
  if (status === "ACTIVE") {
    return COPY[locale].active;
  }
  if (status === "INACTIVE") {
    return COPY[locale].inactive;
  }
  return COPY[locale].resigned;
}

function engagementStatusLabel(
  status: CmpEngagement["status"],
  locale: CmpRecordPreviewLocale
) {
  if (status === "ACTIVE") {
    return COPY[locale].active;
  }
  if (status === "INACTIVE") {
    return COPY[locale].inactive;
  }
  if (status === "COMPLETED") {
    return COPY[locale].completed;
  }
  return COPY[locale].archived;
}

function companyIdentifierTypeLabel(
  value: CmpClient["companyIdentifierType"],
  locale: CmpRecordPreviewLocale
) {
  if (value === "BUSINESS_REGISTRATION_NUMBER") {
    return label(locale, "Business Registration Number", "商业登记证号码");
  }
  if (value === "COMPANY_REGISTRATION_NUMBER") {
    return label(locale, "Company Registration Number", "公司注册号码");
  }
  return value;
}

function companyTypeLabel(
  value: string | null | undefined,
  locale: CmpRecordPreviewLocale
) {
  const normalized = value?.trim().toUpperCase().replaceAll(" ", "_");
  if (normalized === "PRIVATE" || normalized === "PRIVATE_COMPANY") {
    return locale === "zh-CN" ? "私人公司" : "Private";
  }
  if (normalized === "OTHER" || normalized === "OTHERS") {
    return locale === "zh-CN" ? "其他" : "Others";
  }
  if (normalized === "LISTED" || normalized === "LISTED_COMPANY") {
    return locale === "zh-CN" ? "上市公司" : "Listed";
  }
  return value;
}

function formatClientServiceLines(
  value: string | null | undefined,
  locale: CmpRecordPreviewLocale
) {
  if (!value?.trim()) {
    return null;
  }
  const labels: Record<string, [string, string]> = {
    ANNUAL_AUDIT: ["Annual Audit", "年度审计"],
    REVIEW: ["Review", "审阅"],
    SPECIAL_AUDIT_PRIVATE_CO: [
      "Special audit for private co. (with audit opinion issued)",
      "私人公司专项审计（出具审计意见）",
    ],
    OTHERS: ["Others", "其他"],
    AUDIT: ["Audit", "审计"],
    TAX: ["Tax", "税务"],
    RISK: ["Risk", "风险"],
    ACCOUNTING: ["Accounting Service", "会计服务"],
    COM_SEC: ["Com Sec", "公司秘书"],
  };
  const normalizedLabels: Record<string, keyof typeof labels> = {
    "annual audit": "ANNUAL_AUDIT",
    review: "REVIEW",
    "special audit for private co. (with audit opinion issued)":
      "SPECIAL_AUDIT_PRIVATE_CO",
    others: "OTHERS",
    other: "OTHERS",
    audit: "AUDIT",
    tax: "TAX",
    risk: "RISK",
    accounting: "ACCOUNTING",
    "accounting service": "ACCOUNTING",
    "company secretarial": "COM_SEC",
    "com sec": "COM_SEC",
  };
  return value
    .split(/[,;|]+/)
    .map((item) => {
      const trimmed = item.trim();
      const key = labels[trimmed]
        ? trimmed
        : normalizedLabels[trimmed.toLowerCase()];
      return key
        ? assertPresentValue(labels[key])[locale === "zh-CN" ? 1 : 0]
        : trimmed;
    })
    .join(locale === "zh-CN" ? "、" : ", ");
}

function serviceTypeLabel(
  value: CmpEngagement["serviceType"],
  locale: CmpRecordPreviewLocale
) {
  const labels: Record<CmpEngagement["serviceType"], [string, string]> = {
    ANNUAL_AUDIT: ["Annual Audit", "年度审计"],
    REVIEW: ["Review", "审阅"],
    SPECIAL_AUDIT_PRIVATE_CO: [
      "Special audit for private co. (with audit opinion issued)",
      "私人公司专项审计（出具审计意见）",
    ],
    OTHERS: ["Others", "其他"],
    AUDIT: ["Audit", "审计"],
    TAX: ["Tax", "税务"],
    RISK: ["Risk", "风险"],
    ACCOUNTING: ["Accounting Service", "会计服务"],
    COM_SEC: ["Com Sec", "公司秘书"],
  };
  return labels[value][locale === "zh-CN" ? 1 : 0];
}

function formatEngagementClient(engagement: CmpEngagement) {
  const clientName = engagement.client.nameEn || engagement.client.nameZh;
  return clientName
    ? `${engagement.client.clientCode} - ${clientName}`
    : engagement.client.clientCode;
}

function formatMonth(
  month: number | null | undefined,
  locale: CmpRecordPreviewLocale
) {
  if (!month) {
    return null;
  }
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2020, month - 1, 1)));
}

function formatDate(
  input: string | null | undefined,
  locale: CmpRecordPreviewLocale
) {
  if (!input) {
    return null;
  }
  const parsed = new Date(`${input}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return input;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(parsed);
}

function formatMoney(
  input: string | null | undefined,
  currency: string,
  locale: CmpRecordPreviewLocale
) {
  if (input === null || input === undefined || input === "") {
    return null;
  }
  const number = Number(input);
  if (!Number.isFinite(number)) {
    return `${currency} ${input}`;
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(number);
}

function formatRelationship(
  clientId: string,
  relationship: NonNullable<CmpClient["relationships"]>[number],
  locale: CmpRecordPreviewLocale
) {
  const from = `${relationship.fromClient.clientCode} - ${relationship.fromClient.nameEn || relationship.fromClient.nameZh}`;
  const to = `${relationship.toClient.clientCode} - ${relationship.toClient.nameEn || relationship.toClient.nameZh}`;
  const type = relationshipTypeLabel(relationship.type, locale);
  const ownership =
    relationship.ownershipPercentage === null
      ? null
      : label(
          locale,
          `Ownership: ${relationship.ownershipPercentage}%`,
          `持股比例：${relationship.ownershipPercentage}%`
        );
  const direction =
    relationship.fromClientId === clientId
      ? `${from} → ${to}`
      : `${to} ← ${from}`;
  const effectiveFrom = relationship.effectiveFrom
    ? label(
        locale,
        `Effective from: ${formatDate(relationship.effectiveFrom, locale)}`,
        `生效日期：${formatDate(relationship.effectiveFrom, locale)}`
      )
    : null;
  const effectiveTo = relationship.effectiveTo
    ? label(
        locale,
        `Effective to: ${formatDate(relationship.effectiveTo, locale)}`,
        `结束日期：${formatDate(relationship.effectiveTo, locale)}`
      )
    : null;
  const remarks = relationship.remarks
    ? label(
        locale,
        `Remarks: ${relationship.remarks}`,
        `备注：${relationship.remarks}`
      )
    : null;
  return [type, direction, ownership, effectiveFrom, effectiveTo, remarks]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

function formatInterestDetails(
  value: {
    ownershipPercentage: number | null;
    otherDescription?: string | null;
  },
  locale: CmpRecordPreviewLocale
) {
  return [
    value.ownershipPercentage === null
      ? null
      : label(
          locale,
          `Ownership ${value.ownershipPercentage}%`,
          `持股 ${value.ownershipPercentage}%`
        ),
    value.otherDescription ?? null,
  ]
    .filter((item): item is string => Boolean(item))
    .join(" · ");
}

function relationshipTypeLabel(
  type: NonNullable<CmpClient["relationships"]>[number]["type"],
  locale: CmpRecordPreviewLocale
) {
  const labels = {
    SUBSIDIARY: ["Subsidiary", "子公司"],
    ASSOCIATE: ["Associate", "联营公司"],
    JOINT_VENTURE: ["Joint venture", "合营企业"],
  } as const;
  return labels[type][locale === "zh-CN" ? 1 : 0];
}

function normalizeDateTime(input: string) {
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime())
    ? new Date(0).toISOString()
    : parsed.toISOString();
}

function typstText(value: string) {
  return `#text(${JSON.stringify(value)})`;
}

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
