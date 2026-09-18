import type {
  CmpAcceptanceChangeSummary,
  CmpAcceptanceChangeValue,
  CmpEngagementDeliverableCode,
} from "@project-wing/shared";
import { CMP_ENGAGEMENT_DELIVERABLE_LABELS } from "@project-wing/shared";
import { Button } from "@project-wing/ui";
import { ArrowRight, CircleAlert, RefreshCw } from "lucide-react";

type Locale = "en-US" | "zh-CN";

const SECTION_LABELS: Record<string, Record<Locale, string>> = {
  basicInformation: { "en-US": "Client information", "zh-CN": "客户信息" },
  incorporation: { "en-US": "Incorporation", "zh-CN": "注册信息" },
  listingAndRegulation: {
    "en-US": "Listing and regulation",
    "zh-CN": "上市与监管",
  },
  groupRelationship: {
    "en-US": "Related Parties",
    "zh-CN": "相关主体",
  },
  source: { "en-US": "Client source", "zh-CN": "客户来源" },
  responsiblePersons: {
    "en-US": "Responsible persons",
    "zh-CN": "负责人员",
  },
  engagementAndService: {
    "en-US": "Engagement and service",
    "zh-CN": "业务与服务",
  },
  engagementInformation: {
    "en-US": "Engagement information",
    "zh-CN": "业务信息",
  },
  commercialPlanning: {
    "en-US": "Budget",
    "zh-CN": "预算",
  },
  reportsAndDeliverables: {
    "en-US": "Reports & Deliverables",
    "zh-CN": "报告及交付物",
  },
  riskClassificationAndResponsiblePersons: {
    "en-US": "Risk classification and responsible persons",
    "zh-CN": "风险分类与负责人",
  },
};
const FIELD_LABELS: Record<string, Record<Locale, string>> = {
  client: { "en-US": "Client", "zh-CN": "客户" },
  clientCode: { "en-US": "Client Code", "zh-CN": "客户编号" },
  companyCode: { "en-US": "Company Code", "zh-CN": "公司代码" },
  companyNumber: { "en-US": "Company Number", "zh-CN": "公司编号" },
  nameEn: { "en-US": "Company Name English", "zh-CN": "公司英文名称" },
  nameZh: { "en-US": "Company Name Chinese", "zh-CN": "公司中文名称" },
  status: { "en-US": "Status", "zh-CN": "状态" },
  address: { "en-US": "Address", "zh-CN": "地址" },
  contacts: { "en-US": "Contacts", "zh-CN": "联系人" },
  contactPerson: { "en-US": "Contact Person", "zh-CN": "联系人" },
  contactPosition: { "en-US": "Position", "zh-CN": "职位" },
  contactDepartment: { "en-US": "Department", "zh-CN": "部门" },
  contactMobile: { "en-US": "Mobile", "zh-CN": "手机" },
  contactRemarks: { "en-US": "Contact Notes", "zh-CN": "联系人备注" },
  telephone: { "en-US": "Telephone", "zh-CN": "电话" },
  email: { "en-US": "Email", "zh-CN": "邮箱" },
  website: { "en-US": "Website", "zh-CN": "网站" },
  industryOrBusinessNature: {
    "en-US": "Industry / Business Nature",
    "zh-CN": "行业 / 业务性质",
  },
  yearEndDate: { "en-US": "Year End", "zh-CN": "年末日期" },
  yearEndMonth: { "en-US": "Year End Month", "zh-CN": "年结月份" },
  hsicSectionCode: {
    "en-US": "Industry Classification",
    "zh-CN": "行业分类",
  },
  industryBusinessNatureDetails: {
    "en-US": "Business Nature Details",
    "zh-CN": "业务性质详情",
  },
  registeredAddress: {
    "en-US": "Registered Address",
    "zh-CN": "公司注册地址",
  },
  principalBusinessAddress: {
    "en-US": "Principal Business Address",
    "zh-CN": "主要经营地址",
  },
  principalAddressSameAsRegistered: {
    "en-US": "Principal Address Same as Registered",
    "zh-CN": "经营地址同公司注册地址",
  },
  additionalAddresses: {
    "en-US": "Additional Addresses",
    "zh-CN": "备用地址",
  },
  reportDate: { "en-US": "Estimated Report Date", "zh-CN": "预计报告日期" },
  remarks: { "en-US": "Remarks", "zh-CN": "备注" },
  placeOfIncorporation: {
    "en-US": "Place of Incorporation",
    "zh-CN": "注册成立地",
  },
  dateOfIncorporation: {
    "en-US": "Date of Incorporation",
    "zh-CN": "注册日期",
  },
  countryOrDistrict: {
    "en-US": "Country / District",
    "zh-CN": "国家 / 地区",
  },
  listedOrPrivate: {
    "en-US": "Company Type",
    "zh-CN": "公司类型",
  },
  companyTypeOtherDescription: {
    "en-US": "Other Company Type",
    "zh-CN": "其他公司类型说明",
  },
  stockExchangeOrListingPlace: {
    "en-US": "Stock Exchange / Listing Place",
    "zh-CN": "证券交易所 / 上市地点",
  },
  stockCode: { "en-US": "Stock Code", "zh-CN": "股票代码" },
  marketSegment: { "en-US": "Market Segment", "zh-CN": "上市板块" },
  regulatedEntities: {
    "en-US": "Regulated Entities",
    "zh-CN": "受监管实体",
  },
  regulatedBy: { "en-US": "Regulated By", "zh-CN": "监管机构" },
  companyTypeOrSpecialIndustry: {
    "en-US": "Special Industry",
    "zh-CN": "特殊行业",
  },
  specialIndustryDetails: {
    "en-US": "Special Industry Details",
    "zh-CN": "特殊行业详情",
  },
  group: { "en-US": "Client Group", "zh-CN": "客户集团" },
  groupMode: { "en-US": "Group Mode", "zh-CN": "集团模式" },
  isSubsidiary: { "en-US": "Subsidiary", "zh-CN": "是否子公司" },
  parentClientCode: {
    "en-US": "Parent Client Code",
    "zh-CN": "母公司客户编号",
  },
  parentHoldingCompanyName: {
    "en-US": "Parent / Holding Company",
    "zh-CN": "母公司 / 控股公司",
  },
  hasSubsidiariesOrAssociates: {
    "en-US": "Has Subsidiaries / Associates",
    "zh-CN": "是否有子公司 / 联营公司",
  },
  subsidiariesOrAssociates: {
    "en-US": "Subsidiaries / Associates",
    "zh-CN": "子公司 / 联营公司",
  },
  referredBy: { "en-US": "Referred By", "zh-CN": "客户来源" },
  internalSource: { "en-US": "Internal Source", "zh-CN": "内部来源" },
  externalSource: { "en-US": "External Source", "zh-CN": "外部来源" },
  sourceDescription: {
    "en-US": "Source Description",
    "zh-CN": "来源说明",
  },
  clientPartnerPic: {
    "en-US": "PIC",
    "zh-CN": "PIC",
  },
  clientLeadingPartner: {
    "en-US": "Client Leading Partner",
    "zh-CN": "客户主导合伙人",
  },
  clientManagerMic: {
    "en-US": "MIC",
    "zh-CN": "MIC",
  },
  alternativePartnerSecondMic: {
    "en-US": "2nd MIC",
    "zh-CN": "第二 MIC",
  },
  engagementCode: { "en-US": "Engagement Code", "zh-CN": "业务代码" },
  serviceType: { "en-US": "Service Type", "zh-CN": "服务类型" },
  serviceLines: { "en-US": "Service Type", "zh-CN": "服务类型" },
  expectedJobOrEngagementType: {
    "en-US": "Expected Job / Engagement Type",
    "zh-CN": "预期业务类型",
  },
  taxServiceDetails: {
    "en-US": "Tax Service Details",
    "zh-CN": "税务服务详情",
  },
  comSecServiceDetails: {
    "en-US": "Company Secretarial Service Details",
    "zh-CN": "公司秘书服务详情",
  },
  otherServiceDescription: {
    "en-US": "Other Service Description",
    "zh-CN": "其他服务说明",
  },
  approvalReferenceNumber: {
    "en-US": "Approval Reference Number",
    "zh-CN": "审批编号",
  },
  engagementDate: { "en-US": "Engagement Date", "zh-CN": "业务日期" },
  budgetedHours: { "en-US": "Budgeted Hours", "zh-CN": "预算工时" },
  feePlanningLines: {
    "en-US": "Budget details",
    "zh-CN": "预算明细",
  },
  grade: { "en-US": "Firm Grade", "zh-CN": "事务所职级" },
  assignmentType: { "en-US": "Assignment", "zh-CN": "人员类型" },
  staffUserId: { "en-US": "Staff", "zh-CN": "人员" },
  hourlyRate: { "en-US": "Fixed Hourly Rate", "zh-CN": "固定时薪" },
  budgetHours: { "en-US": "Budget in Hours", "zh-CN": "预算工时" },
  dateFrom: { "en-US": "Date From", "zh-CN": "开始日期" },
  dateTo: { "en-US": "Date To", "zh-CN": "结束日期" },
  lineTotal: { "en-US": "Total", "zh-CN": "总额" },
  agreedFee: { "en-US": "Agreed Fee", "zh-CN": "协定收费" },
  recoveryRate: { "en-US": "Recovery Rate", "zh-CN": "回收率" },
  feeCurrency: { "en-US": "Currency", "zh-CN": "币种" },
  pic: { "en-US": "PIC", "zh-CN": "PIC" },
  mic: { "en-US": "MIC", "zh-CN": "MIC" },
  amlRiskClassification: {
    "en-US": "AML / TF Risk",
    "zh-CN": "反洗钱／恐怖融资风险",
  },
  engagementRiskClassification: {
    "en-US": "Engagement Risk",
    "zh-CN": "业务风险",
  },
  eqReviewer: { "en-US": "EQR", "zh-CN": "EQR" },
  establishmentName: {
    "en-US": "Establishment Name",
    "zh-CN": "机构名称",
  },
  registrationNumber: {
    "en-US": "Registration Number",
    "zh-CN": "注册编号",
  },
  establishmentType: {
    "en-US": "Establishment Type",
    "zh-CN": "机构类型",
  },
  operationStatus: {
    "en-US": "Operation Status",
    "zh-CN": "经营状态",
  },
  ownershipPercentage: {
    "en-US": "Ownership Percentage",
    "zh-CN": "持股比例",
  },
  effectiveDate: { "en-US": "Effective Date", "zh-CN": "生效日期" },
};

export function AcceptanceChangeComparison({
  summary,
  isLoading,
  error,
  locale,
  onRetry,
}: {
  summary?: CmpAcceptanceChangeSummary;
  isLoading: boolean;
  error: unknown;
  locale: Locale;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <section className="cmp-change-comparison-panel is-loading">
        <RefreshCw aria-hidden="true" className="cmp-spin" />
        <p>{locale === "zh-CN" ? "正在比较修改内容…" : "Comparing changes…"}</p>
      </section>
    );
  }
  if (error) {
    return (
      <section className="cmp-change-comparison-panel is-error">
        <Button
          type="button"
          className="cmp-secondary-button"
          onClick={onRetry}
        >
          {locale === "zh-CN" ? "重试" : "Retry"}
        </Button>
      </section>
    );
  }
  if (!summary || summary.status === "BASELINE_UNAVAILABLE") {
    return (
      <section className="cmp-change-comparison-panel is-warning">
        <CircleAlert aria-hidden="true" />
        <div>
          <strong>
            {locale === "zh-CN"
              ? "原始版本不可用"
              : "Original version unavailable"}
          </strong>
          <p>
            {locale === "zh-CN"
              ? "该申请创建于修改追踪启用之前，系统不会使用当前主档估算历史差异。"
              : "This request predates change tracking. Current master data is not used to estimate its history."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="cmp-change-comparison-panel">
      <div className="cmp-change-comparison-heading">
        <div>
          <span>{locale === "zh-CN" ? "修改对比" : "Change comparison"}</span>
          <strong>
            {locale === "zh-CN"
              ? `${summary.changedFieldCount} 项修改`
              : `${summary.changedFieldCount} ${summary.changedFieldCount === 1 ? "change" : "changes"}`}
          </strong>
        </div>
        {summary.baselineCapturedAt ? (
          <time dateTime={summary.baselineCapturedAt}>
            {locale === "zh-CN" ? "基准版本：" : "Baseline: "}
            {formatDateTime(summary.baselineCapturedAt, locale)}
          </time>
        ) : null}
      </div>
      {summary.staleMasterData ? <Warning locale={locale} stale /> : null}
      {summary.changedFieldCount ? (
        <div className="cmp-change-groups">
          {summary.groups.map((group) => (
            <section key={group.section} className="cmp-change-group">
              <h4>{labelFor(SECTION_LABELS, group.section, locale)}</h4>
              <div className="cmp-change-list">
                {group.changes.map((change) => (
                  <article key={change.field} className="cmp-change-row">
                    <div className="cmp-change-row-heading">
                      <strong>
                        {labelFor(FIELD_LABELS, change.field, locale)}
                      </strong>
                      <span
                        className={`cmp-change-kind is-${change.kind.toLowerCase()}`}
                      >
                        {kindLabel(change.kind, locale)}
                      </span>
                    </div>
                    <div className="cmp-change-values">
                      <ChangeValue
                        label={locale === "zh-CN" ? "修改前" : "Previous"}
                        value={change.before}
                        field={change.field}
                        locale={locale}
                        variant="before"
                      />
                      <ArrowRight aria-hidden="true" />
                      <ChangeValue
                        label={locale === "zh-CN" ? "修改后" : "Proposed"}
                        value={change.after}
                        field={change.field}
                        locale={locale}
                        variant="after"
                      />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Warning locale={locale} />
      )}
    </section>
  );
}

function Warning({
  locale,
  stale = false,
}: {
  locale: Locale;
  stale?: boolean;
}) {
  return (
    <output className="cmp-change-warning">
      <CircleAlert aria-hidden="true" />
      <span>
        {stale
          ? locale === "zh-CN"
            ? "主档在该申请创建后发生过其他变化，请在审批前再次核对。"
            : "Master data changed after this request was created. Review the values before approval."
          : locale === "zh-CN"
            ? "未检测到主档修改；该申请仍可继续审批。"
            : "No master-data changes were detected. This request may still continue."}
      </span>
    </output>
  );
}

function ChangeValue({
  label,
  value,
  field,
  locale,
  variant,
}: {
  label: string;
  value: CmpAcceptanceChangeValue;
  field: string;
  locale: Locale;
  variant: "before" | "after";
}) {
  return (
    <div className={`cmp-change-value is-${variant}`}>
      <span>{label}</span>
      {Array.isArray(value) ? (
        value.length > 0 ? (
          <div className="cmp-change-record-list">
            {value.map((record, index) =>
              field === "feePlanningLines" ? (
                <FeePlanChangeLine
                  key={`${field}-${index}`}
                  line={record}
                  locale={locale}
                />
              ) : (
                <dl key={`${field}-${index}`}>
                  {Object.entries(record).map(([key, nestedValue]) => (
                    <div key={key}>
                      <dt>{labelFor(FIELD_LABELS, key, locale)}</dt>
                      <dd>{formatValue(nestedValue, key, locale)}</dd>
                    </div>
                  ))}
                </dl>
              )
            )}
          </div>
        ) : (
          <strong>—</strong>
        )
      ) : (
        <strong>{formatValue(value, field, locale)}</strong>
      )}
    </div>
  );
}

function FeePlanChangeLine({
  line,
  locale,
}: {
  line: Record<string, string | number | boolean | null>;
  locale: Locale;
}) {
  const budgetHours = numericValue(line.budgetHours);
  const rate = numericValue(line.hourlyRate);
  const total = line.lineTotal ?? budgetHours * rate;
  const fields: [string, string | number | boolean | null][] = [
    ["grade", line.grade ?? null],
    ["assignmentType", line.assignmentType ?? null],
    ["staffUserId", line.staffUserId ?? null],
    ["dateFrom", line.dateFrom ?? null],
    ["dateTo", line.dateTo ?? null],
    ["hourlyRate", line.hourlyRate ?? null],
    ["budgetHours", budgetHours.toFixed(2)],
    ["lineTotal", total],
  ];

  return (
    <dl>
      {fields.map(([key, value]) => (
        <div key={key}>
          <dt>{labelFor(FIELD_LABELS, key, locale)}</dt>
          <dd>{formatValue(value, key, locale)}</dd>
        </div>
      ))}
    </dl>
  );
}

function numericValue(value: string | number | boolean | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function labelFor(
  labels: Record<string, Record<Locale, string>>,
  key: string,
  locale: Locale
) {
  if (key.startsWith("deliverables.")) {
    const identity = key.slice("deliverables.".length);
    if (identity.startsWith("CUSTOM:")) {
      return locale === "zh-CN" ? "自定义交付物" : "Custom deliverable";
    }
    return (
      CMP_ENGAGEMENT_DELIVERABLE_LABELS[
        identity as CmpEngagementDeliverableCode
      ]?.[locale === "zh-CN" ? "zh" : "en"] ?? humanizeField(identity)
    );
  }
  return labels[key]?.[locale] ?? humanizeField(key);
}

function kindLabel(kind: "ADDED" | "REMOVED" | "MODIFIED", locale: Locale) {
  if (locale === "zh-CN") {
    return { ADDED: "新增", REMOVED: "删除", MODIFIED: "修改" }[kind];
  }
  return { ADDED: "Added", REMOVED: "Removed", MODIFIED: "Modified" }[kind];
}

function formatValue(
  value: string | number | boolean | null,
  field: string,
  locale: Locale
) {
  if (value === null || value === "") {
    return "—";
  }
  if (typeof value === "boolean") {
    return value
      ? locale === "zh-CN"
        ? "是"
        : "Yes"
      : locale === "zh-CN"
        ? "否"
        : "No";
  }
  if (
    (field.endsWith("Date") || field === "dateFrom" || field === "dateTo") &&
    typeof value === "string"
  ) {
    const date = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat(locale).format(date);
    }
  }
  if (["agreedFee", "hourlyRate", "lineTotal"].includes(field)) {
    return `HKD ${String(value)}`;
  }
  return String(value);
}

function formatDateTime(value: string, locale: Locale) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function humanizeField(value: string) {
  return value
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());
}
