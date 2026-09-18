"use client";

import {
  CMP_HSIC_SECTION_OPTIONS,
  CmpClientAcceptanceDraftPayloadSchema,
  classifyCmpRelationshipConflict,
  inferCmpOwnership,
  isCmpRelationshipEndpointCompatible,
} from "@project-wing/shared";
import type {
  CmpClient,
  CmpClientAcceptanceDraftPayload,
  CmpClientGroup,
  CmpCompanyIdentifierType,
  CmpEntityKind,
  CmpEntityRelationshipDraft,
  CmpGroupRelationshipDraft,
  CmpHsicSectionCode,
  CmpRelatedEntityDraft,
  CreateCmpClientInput,
} from "@project-wing/shared";
import type {
  CmpClientGraph,
  CmpCompanyIdentityMatch,
  CmpCompanyIdentityResolution,
} from "@project-wing/shared/cmp-entity-graph";
import type { CmpEntityMap } from "@project-wing/shared/cmp-entity-maps";
import {
  Badge,
  Button,
  ButtonGroup,
  Input,
  MemberDirectoryCompactIdentity,
  MotionButton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatefulMotionButton,
  projectWingToast as toast,
} from "@project-wing/ui";
import type { MotionButtonState } from "@project-wing/ui";
import { ArrowRight, Check, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FormEvent, ReactNode } from "react";

import type { DirectoryUser } from "../api/client";
import { api } from "../api/client";
import { clientRequiredFieldMessages, useCmpI18n } from "../i18n/client";
import type { CmpDictionary } from "../i18n/client";
import {
  AcceptanceFormAccordionSection,
  AcceptanceFormPreviewNavigationItem,
  AcceptanceFormSectionContent,
} from "./acceptance-form-accordion-section";
import type { AcceptanceFormAccordionStatusCopy } from "./acceptance-form-accordion-section";
import {
  AcceptanceFormHeader,
  AcceptanceFormWorkspace,
} from "./acceptance-form-workspace";
import { ClientAdditionalAddressDataGrid } from "./client-additional-address-data-grid";
import type { ClientAdditionalAddressFormRow } from "./client-additional-address-data-grid";
import { ClientContactDataGrid } from "./client-contact-data-grid";
import type { ClientContactFormRow } from "./client-contact-data-grid";
import { ClientDerivedUboDataGrid } from "./client-derived-ubo-data-grid";
import { ClientFormMemberActionDialog } from "./client-form-member-action-dialog";
import { ClientRelatedPartyDataGrid } from "./client-related-party-data-grid";
import { ClientRelationshipDataGrid } from "./client-relationship-data-grid";
import {
  relationshipRoleLabels,
  relationshipSupportsInterestDetails,
  relationshipTypeLabel,
  relationshipTypesForSourceKind,
} from "./client-relationship-semantics";
import { CmpAmlScreeningSection } from "./cmp-aml-screening-section";
import {
  CmpAsyncActionFeedback,
  useCmpAsyncActionFeedback,
} from "./cmp-async-action-feedback";
import { CmpDraftExitDialog } from "./cmp-draft-exit-dialog";
import { CmpEntityStructureGraph } from "./cmp-entity-structure-graph";
import { FormReviewPage, SearchSelect } from "./cmp-form-controls";
import type {
  CmpFormSectionStatus,
  FormWizardStep,
  ReviewSection,
} from "./cmp-form-controls";
import { CmpFormDraftDeleteAction } from "./cmp-form-draft-delete-action";
import {
  CmpGroupRelationshipEditor,
  type CmpGroupRelationshipEditorParticipant,
} from "./cmp-group-relationship-editor";
import { CompanyIdentityConflictDialog } from "./company-identity-conflict-dialog";
import {
  focusFirstInvalidField,
  schemaIssuesToErrors,
  validationErrorId,
} from "./form-validation";
import { Accordion } from "./ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { NativeSelect } from "./ui/native-select";
import { Textarea } from "./ui/textarea";

export type ClientMasterFormData = {
  clientCode: string;
  companyCode: string;
  companyIdentifierType: CmpCompanyIdentifierType;
  companyIdentityResolution?: CmpCompanyIdentityResolution;
  companyNumber: string;
  entityMapChoice: "" | "YES" | "NO";
  entityMapId: string;
  entityMapNodeId: string;
  relatedEntities: CmpRelatedEntityDraft[];
  relatedRelationships: CmpEntityRelationshipDraft[];
  relatedGroupRelationships: CmpGroupRelationshipDraft[];
  removedGroupRelationshipIds: string[];
  /** Legacy fields remain only to round-trip historical unfinished drafts. */
  groupMode: "NO_GROUP" | "HAS_GROUP";
  groupId: string;
  groupName: string;
  status: CmpClient["status"] | "";
  nameEn: string;
  nameZh: string;
  contactPerson: string;
  contacts: ClientContactFormRow[];
  telephone: string;
  email: string;
  website: string;
  yearEndDate: string;
  yearEndMonth: string;
  hsicSectionCode: string;
  industryOtherDescription: string;
  reportingGaap: string;
  address: string;
  registeredAddress: string;
  principalBusinessAddress: string;
  principalAddressSameAsRegistered: boolean;
  additionalAddresses: ClientAdditionalAddressFormRow[];
  contactPosition: string;
  contactDepartment: string;
  contactMobile: string;
  contactRemarks: string;
  placeOfIncorporation: string;
  incorporationYearMonth: string;
  listedOrPrivate: string;
  companyTypeOtherDescription: string;
  marketSegment: string;
  stockExchangeOrListingPlace: string;
  stockCode: string;
  regulatedEntities: string;
  regulatedBy: string;
  isSubsidiary: boolean;
  parentClientCode: string;
  parentHoldingCompanyName: string;
  hasSubsidiariesOrAssociates: boolean;
  subsidiariesOrAssociates: string;
  isUltimateParent: boolean;
  wasUltimateParent: boolean;
  groupRelationships: ClientRelationshipFormRow[];
  referredBy: string;
  clientPartnerPicId: string;
  clientPartnerPic: string;
  clientLeadingPartnerId: string;
  clientLeadingPartner: string;
  clientManagerMicId: string;
  clientManagerMic: string;
  alternativePartnerSecondMicId: string;
  alternativePartnerSecondMic: string;
  expectedJobOrEngagementType: string;
  serviceType: string;
  serviceLines: string;
  approvalReferenceNumber: string;
  approvalDate: string;
  taxServiceDetails: string;
  comSecServiceDetails: string;
  otherServiceDescription: string;
  remarks: string;
  micApproverId: string;
  picApproverId: string;
  itApproverId: string;
};

export type ClientRelationshipFormRow = {
  key: string;
  relationshipId: string;
  groupId?: string;
  action: "UPSERT" | "END";
  type: "SUBSIDIARY" | "ASSOCIATE" | "JOINT_VENTURE";
  direction: "FROM_CLIENT" | "TO_CLIENT";
  counterpartClientId: string;
  ownershipPercentage: string;
  effectiveFrom: string;
  effectiveTo: string;
  remarks: string;
};

type ClientMasterFormMode = "create-client" | "acceptance" | "edit-request";

const AUTO_SAVE_DELAY_MS = 500;
const SAVE_FEEDBACK_MINIMUM_MS = 400;

export type ClientMasterFormSubmit = {
  action: "draft" | "assign" | "submit";
  draftName?: string;
  payload: CmpClientAcceptanceDraftPayload;
  draftAssigneeId?: string;
  micApproverId?: string;
  picApproverId?: string;
  itApproverId?: string;
};

type FormErrors = Record<string, string | undefined>;

type ClientFormSectionId = "basic" | "relationships" | "aml" | "responsible";

export const CLIENT_FORM_SECTION_ORDER = [
  "basic",
  "relationships",
  "aml",
  "responsible",
] as const satisfies readonly ClientFormSectionId[];

type ClientFormWizardStepId = ClientFormSectionId | "review";

function titleCaseFormLabel(label: string) {
  return label.replaceAll(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

const CLIENT_FORM_SECTION_ERROR_KEYS: Record<ClientFormSectionId, string[]> = {
  basic: [
    "clientCode",
    "companyCode",
    "companyNumber",
    "status",
    "nameEn",
    "nameZh",
    "email",
    "yearEndMonth",
    "registeredAddress",
    "principalBusinessAddress",
    "placeOfIncorporation",
    "listedOrPrivate",
  ],
  relationships: ["groupId", "groupRelationships.", "isUltimateParent"],
  aml: [],
  responsible: [
    "clientLeadingPartnerId",
    "clientPartnerPicId",
    "clientManagerMicId",
    "serviceType",
    "expectedJobOrEngagementType",
  ],
};
const ClientFormErrorsContext = createContext<FormErrors>({});

export const CLIENT_SERVICE_TYPE_OPTIONS = [
  "Annual Audit",
  "Review",
  "Special audit for private co. (with audit opinion issued)",
  "Others",
] as const;

export type ClientServiceType =
  | (typeof CLIENT_SERVICE_TYPE_OPTIONS)[number]
  | "Audit"
  | "Tax"
  | "Risk"
  | "Accounting Service"
  | "Com Sec";

const CLIENT_SERVICE_TYPE_BY_NORMALIZED_VALUE: Record<
  string,
  ClientServiceType
> = {
  "annual audit": "Annual Audit",
  audit: "Audit",
  tax: "Tax",
  risk: "Risk",
  accounting: "Accounting Service",
  "accounting service": "Accounting Service",
  "com sec": "Com Sec",
  review: "Review",
  "special audit for private co. (with audit opinion issued)":
    "Special audit for private co. (with audit opinion issued)",
  others: "Others",
  other: "Others",
};

export function parseClientServiceTypes(
  serviceLines: string | null | undefined,
  fallbackServiceType?: string | null
): ClientServiceType[] {
  const source = serviceLines?.trim() ? serviceLines : fallbackServiceType;
  if (!source) {
    return [];
  }

  const selected = new Set<ClientServiceType>();
  for (const item of source.split(/[,;|]/)) {
    const normalized = item.trim().replaceAll(/\s+/g, " ").toLowerCase();
    const serviceType = CLIENT_SERVICE_TYPE_BY_NORMALIZED_VALUE[normalized];
    if (serviceType) {
      selected.add(serviceType);
    }
  }
  return [...selected];
}

function DraftEntityDialog({
  open,
  kind,
  entity,
  zh,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  kind: "COMPANY" | "PERSON";
  entity?: CmpRelatedEntityDraft;
  zh: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (entity: CmpRelatedEntityDraft) => void;
}) {
  const company = entity?.companyProfile;
  const person = entity?.personProfile;
  const [nameEn, setNameEn] = useState(
    entity?.nameEn || (kind === "COMPANY" ? entity?.displayName : "") || ""
  );
  const [nameZh, setNameZh] = useState(
    entity?.nameZh || (kind === "PERSON" ? entity?.displayName : "") || ""
  );
  const [companyCode, setCompanyCode] = useState(entity?.companyCode || "");
  const [jurisdiction, setJurisdiction] = useState(entity?.jurisdiction || "");
  const [identifierType, setIdentifierType] = useState(
    company?.identifierType ||
      person?.identifierType ||
      (kind === "COMPANY" ? "COMPANY_REGISTRATION_NUMBER" : "HKID")
  );
  const [identifierValue, setIdentifierValue] = useState(
    company?.identifierValue ||
      person?.identifierValue ||
      entity?.registrationNumber ||
      ""
  );
  const [date, setDate] = useState(
    company?.incorporationDate || person?.dateOfBirth || ""
  );
  const [companyType, setCompanyType] = useState(
    company?.companyType || "PRIVATE"
  );
  const [industry, setIndustry] = useState(
    company?.industryClassification || ""
  );
  const [registeredAddress, setRegisteredAddress] = useState(
    company?.registeredAddress || ""
  );
  const [principalAddress, setPrincipalAddress] = useState(
    company?.principalBusinessAddress || ""
  );
  const [nationality, setNationality] = useState(person?.nationality || "");
  const [residence, setResidence] = useState(
    person?.residenceJurisdiction || ""
  );
  const [correspondenceAddress, setCorrespondenceAddress] = useState(
    person?.correspondenceAddress || ""
  );
  const [status, setStatus] = useState<CmpRelatedEntityDraft["status"]>(
    entity?.status || "ACTIVE"
  );
  const [checkingIdentity, setCheckingIdentity] = useState(false);
  const [identityConflict, setIdentityConflict] = useState<{
    match: CmpCompanyIdentityMatch;
    draft: CmpRelatedEntityDraft;
  } | null>(null);
  const canSave =
    kind === "COMPANY"
      ? Boolean(
          (nameEn.trim() || nameZh.trim()) &&
          identifierType.trim() &&
          identifierValue.trim()
        )
      : Boolean(nameEn.trim() || nameZh.trim());
  const buildDraft = (
    resolution?: CmpCompanyIdentityResolution
  ): CmpRelatedEntityDraft => {
    const displayName = (nameZh || nameEn).trim();
    return {
      draftKey: entity?.draftKey || crypto.randomUUID(),
      existingEntityId: entity?.existingEntityId || null,
      kind,
      displayName,
      companyCode: kind === "COMPANY" ? cleanText(companyCode) : null,
      nameZh: cleanText(nameZh),
      nameEn: cleanText(nameEn),
      jurisdiction:
        kind === "COMPANY" ? cleanText(jurisdiction) : cleanText(residence),
      registrationNumber: cleanText(identifierValue),
      status,
      companyIdentityResolution: resolution,
      companyProfile:
        kind === "COMPANY"
          ? {
              identifierType: identifierType.trim(),
              identifierValue: identifierValue.trim(),
              incorporationDate: cleanText(date),
              companyType,
              industryClassification: cleanText(industry),
              registeredAddress: cleanText(registeredAddress),
              principalBusinessAddress: cleanText(principalAddress),
            }
          : null,
      personProfile:
        kind === "PERSON"
          ? {
              dateOfBirth: cleanText(date),
              identifierType: cleanText(identifierType),
              identifierValue: cleanText(identifierValue),
              nationality: cleanText(nationality),
              residenceJurisdiction: cleanText(residence),
              correspondenceAddress: cleanText(correspondenceAddress),
            }
          : null,
    };
  };
  const submit = async () => {
    if (!canSave || checkingIdentity) {
      return;
    }
    const draft = buildDraft(entity?.companyIdentityResolution);
    if (kind !== "COMPANY") {
      onSave(draft);
      return;
    }
    setCheckingIdentity(true);
    try {
      const { match } = await api.cmpCompanyIdentityMatch(
        identifierType,
        identifierValue.trim()
      );
      if (match && match.entity.id !== entity?.existingEntityId) {
        setIdentityConflict({ match, draft });
        return;
      }
      onSave({
        ...draft,
        companyIdentityResolution: undefined,
      });
    } catch {
      toast.error(
        zh
          ? "暂时无法核对公司编号，请重试。"
          : "Unable to check the company identifier. Please retry.",
        { duration: 5000 }
      );
    } finally {
      setCheckingIdentity(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {entity ? (zh ? "编辑" : "Edit ") : zh ? "新增" : "New "}
              {kind === "COMPANY"
                ? zh
                  ? "关联公司"
                  : "related company"
                : zh
                  ? "关联个人"
                  : "related individual"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <DraftDialogSection
              title={
                zh
                  ? kind === "COMPANY"
                    ? "基本信息"
                    : "身份信息"
                  : kind === "COMPANY"
                    ? "Basic information"
                    : "Identity information"
              }
            >
              <DraftField label={zh ? "英文名称" : "English name"}>
                <Input
                  value={nameEn}
                  onChange={(event) => setNameEn(event.target.value)}
                />
              </DraftField>
              <DraftField label={zh ? "中文名称" : "Chinese name"}>
                <Input
                  value={nameZh}
                  onChange={(event) => setNameZh(event.target.value)}
                />
              </DraftField>
              {kind === "COMPANY" ? (
                <>
                  <DraftField label={zh ? "公司代码" : "Company code"}>
                    <Input
                      value={companyCode}
                      onChange={(event) => setCompanyCode(event.target.value)}
                    />
                  </DraftField>
                  <DraftField label={zh ? "注册成立地" : "Jurisdiction"}>
                    <Input
                      value={jurisdiction}
                      onChange={(event) => setJurisdiction(event.target.value)}
                    />
                  </DraftField>
                  <DraftField label={`${zh ? "公司类型" : "Company type"} *`}>
                    <Select
                      value={companyType}
                      onValueChange={(value) => value && setCompanyType(value)}
                    >
                      <SelectTrigger>
                        <SelectValue>
                          {draftCompanyTypeLabel(companyType, zh)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {["PRIVATE", "LISTED", "OTHER"].map((value) => (
                          <SelectItem key={value} value={value}>
                            {draftCompanyTypeLabel(value, zh)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </DraftField>
                </>
              ) : null}
            </DraftDialogSection>
            <DraftDialogSection
              title={
                zh
                  ? kind === "COMPANY"
                    ? "注册编号"
                    : "身份证明"
                  : kind === "COMPANY"
                    ? "Registration identifier"
                    : "Identification"
              }
            >
              <DraftField label={zh ? "证件类型" : "Identifier type"}>
                <Select
                  value={identifierType}
                  onValueChange={(value) => value && setIdentifierType(value)}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {draftIdentifierTypeLabel(identifierType, kind, zh)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {draftIdentifierTypes(kind).map((value) => (
                      <SelectItem key={value} value={value}>
                        {draftIdentifierTypeLabel(value, kind, zh)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </DraftField>
              <DraftField
                label={`${zh ? "证件号码" : "Identifier number"}${kind === "COMPANY" ? " *" : ""}`}
              >
                <Input
                  value={identifierValue}
                  onChange={(event) => setIdentifierValue(event.target.value)}
                />
              </DraftField>
              <DraftField
                label={
                  kind === "COMPANY"
                    ? zh
                      ? "成立日期"
                      : "Incorporation date"
                    : zh
                      ? "出生日期"
                      : "Date of birth"
                }
              >
                <Input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </DraftField>
              <DraftStatusField
                kind={kind}
                value={status}
                zh={zh}
                onChange={setStatus}
              />
            </DraftDialogSection>
            {kind === "COMPANY" ? (
              <>
                <DraftDialogSection
                  title={zh ? "地址信息" : "Address information"}
                >
                  <DraftField
                    label={zh ? "公司注册地址" : "Registered address"}
                    className="sm:col-span-2"
                  >
                    <Textarea
                      value={registeredAddress}
                      onChange={(event) =>
                        setRegisteredAddress(event.target.value)
                      }
                    />
                  </DraftField>
                  <DraftField
                    label={zh ? "主要经营地址" : "Principal business address"}
                    className="sm:col-span-2"
                  >
                    <Textarea
                      value={principalAddress}
                      onChange={(event) =>
                        setPrincipalAddress(event.target.value)
                      }
                    />
                  </DraftField>
                </DraftDialogSection>
                <DraftDialogSection
                  title={zh ? "业务信息" : "Business information"}
                >
                  <DraftField
                    label={zh ? "行业分类" : "Industry classification"}
                  >
                    <Select
                      value={industry || "_NONE"}
                      onValueChange={(value) =>
                        value && setIndustry(value === "_NONE" ? "" : value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>
                          {industry
                            ? `${industry} · ${CMP_HSIC_SECTION_OPTIONS.find((option) => option.code === industry)?.[zh ? "zh" : "en"] ?? industry}`
                            : zh
                              ? "未指定"
                              : "Not specified"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_NONE">
                          {zh ? "未指定" : "Not specified"}
                        </SelectItem>
                        {CMP_HSIC_SECTION_OPTIONS.map((option) => (
                          <SelectItem key={option.code} value={option.code}>
                            {option.code} · {option[zh ? "zh" : "en"]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </DraftField>
                </DraftDialogSection>
              </>
            ) : (
              <DraftDialogSection title={zh ? "基础属性" : "Basic attributes"}>
                <DraftField label={zh ? "国籍" : "Nationality"}>
                  <Input
                    value={nationality}
                    onChange={(event) => setNationality(event.target.value)}
                  />
                </DraftField>
                <DraftField label={zh ? "居住地" : "Residence jurisdiction"}>
                  <Input
                    value={residence}
                    onChange={(event) => setResidence(event.target.value)}
                  />
                </DraftField>
                <DraftField
                  label={zh ? "通讯地址" : "Correspondence address"}
                  className="sm:col-span-2"
                >
                  <Textarea
                    value={correspondenceAddress}
                    onChange={(event) =>
                      setCorrespondenceAddress(event.target.value)
                    }
                  />
                </DraftField>
              </DraftDialogSection>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {zh ? "取消" : "Cancel"}
              </Button>
              <Button
                type="button"
                disabled={!canSave || checkingIdentity}
                onClick={() => void submit()}
              >
                {zh ? "保存主体" : "Save party"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {identityConflict ? (
        <CompanyIdentityConflictDialog
          open
          zh={zh}
          busy={checkingIdentity}
          match={identityConflict.match}
          current={{
            displayName: identityConflict.draft.displayName,
            nameEn: identityConflict.draft.nameEn,
            nameZh: identityConflict.draft.nameZh,
            identifierType,
            identifierValue,
            jurisdiction: identityConflict.draft.jurisdiction,
            incorporationDate:
              identityConflict.draft.companyProfile?.incorporationDate,
            companyType: identityConflict.draft.companyProfile?.companyType,
            registeredAddress:
              identityConflict.draft.companyProfile?.registeredAddress,
            principalBusinessAddress:
              identityConflict.draft.companyProfile?.principalBusinessAddress,
          }}
          onCancel={() => setIdentityConflict(null)}
          onResolve={(resolution) => {
            onSave({
              ...identityConflict.draft,
              existingEntityId: identityConflict.match.entity.id,
              companyIdentityResolution: resolution,
            });
            setIdentityConflict(null);
          }}
        />
      ) : null}
    </>
  );
}

function DraftDialogSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 border-b pb-2 text-sm font-semibold">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
function DraftField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`space-y-1.5 text-sm font-medium ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function DraftStatusField({
  kind,
  value,
  zh,
  onChange,
}: {
  kind: "COMPANY" | "PERSON";
  value: CmpRelatedEntityDraft["status"];
  zh: boolean;
  onChange: (value: CmpRelatedEntityDraft["status"]) => void;
}) {
  const options =
    kind === "COMPANY"
      ? ["ACTIVE", "INACTIVE", "DISSOLVED"]
      : ["ACTIVE", "INACTIVE", "DECEASED", "UNKNOWN"];
  return (
    <DraftField label={zh ? "状态" : "Status"}>
      <Select
        value={value}
        onValueChange={(next) => next && onChange(next as typeof value)}
      >
        <SelectTrigger>
          <SelectValue>{draftEntityStatusLabel(value, zh)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {draftEntityStatusLabel(option, zh)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </DraftField>
  );
}
function draftCompanyTypeLabel(value: string | null | undefined, zh: boolean) {
  return (
    (
      {
        PRIVATE: zh ? "私人公司" : "Private",
        LISTED: zh ? "上市公司" : "Listed",
        OTHER: zh ? "其他" : "Other",
      } as Record<string, string>
    )[value || ""] || "—"
  );
}
function draftIdentifierTypes(kind: "COMPANY" | "PERSON") {
  return kind === "COMPANY"
    ? ["BUSINESS_REGISTRATION_NUMBER", "COMPANY_REGISTRATION_NUMBER", "OTHER"]
    : ["PASSPORT", "NATIONAL_ID", "OTHER"];
}
function draftIdentifierTypeLabel(
  value: string,
  kind: "COMPANY" | "PERSON",
  zh: boolean
) {
  const labels: Record<string, string> =
    kind === "COMPANY"
      ? {
          BUSINESS_REGISTRATION_NUMBER: zh
            ? "商业登记号码"
            : "Business registration number",
          COMPANY_REGISTRATION_NUMBER: zh
            ? "公司注册编号"
            : "Company registration number",
          OTHER: zh ? "其他" : "Other",
        }
      : {
          PASSPORT: zh ? "护照" : "Passport",
          NATIONAL_ID: zh ? "身份证" : "National ID",
          OTHER: zh ? "其他" : "Other",
        };
  return labels[value] ?? value;
}
function draftEntityStatusLabel(value: string, zh: boolean) {
  return (
    (
      {
        ACTIVE: zh ? "存续" : "Active",
        INACTIVE: zh ? "非活跃" : "Inactive",
        DISSOLVED: zh ? "已解散" : "Dissolved",
        DECEASED: zh ? "已故" : "Deceased",
        UNKNOWN: zh ? "未知" : "Unknown",
      } as Record<string, string>
    )[value] || value
  );
}

function DraftRelationshipDialog({
  open,
  relationship,
  form,
  copy,
  entityName,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  relationship?: CmpEntityRelationshipDraft;
  form: ClientMasterFormData;
  copy: CmpDictionary["workspace"];
  entityName: (key: string) => string;
  onOpenChange: (open: boolean) => void;
  onSave: (relationship: CmpEntityRelationshipDraft) => void;
}) {
  const [fromKey, setFromKey] = useState(
    relationship ? relationshipRefKey(relationship.fromRef) : "ROOT"
  );
  const [toKey, setToKey] = useState(
    relationship
      ? relationshipRefKey(relationship.toRef)
      : form.relatedEntities[0]?.draftKey || ""
  );
  const [type, setType] = useState<CmpEntityRelationshipDraft["type"]>(
    relationship?.type ?? "OWNS"
  );
  const [percentage, setPercentage] = useState(
    relationship?.ownershipPercentage?.toString() ?? ""
  );
  const [effectiveFrom, setEffectiveFrom] = useState(
    relationship?.effectiveFrom ?? ""
  );
  const [remarks, setRemarks] = useState(relationship?.remarks ?? "");
  const partyKind = useCallback(
    (key: string): CmpEntityKind | undefined =>
      key === "ROOT"
        ? "COMPANY"
        : form.relatedEntities.find((entity) => entity.draftKey === key)?.kind,
    [form.relatedEntities]
  );
  const targetKindAllowed = (kind: CmpEntityKind) =>
    relationshipTargetKindAllowed(type, kind);
  const fromKind = partyKind(fromKey);
  const toKind = partyKind(toKey);
  const types = fromKind ? relationshipTypesForSourceKind(fromKind) : [];
  useEffect(() => {
    if (types.includes(type)) {
      return;
    }
    setType(types[0] ?? "OWNS");
  }, [type, types]);
  const endpointKindsValid = Boolean(
    fromKind &&
    toKind &&
    isCmpRelationshipEndpointCompatible(type, fromKind, toKind)
  );
  const roles = relationshipRoleLabels(type, copy);
  const supportsInterestDetails = relationshipSupportsInterestDetails(type);
  const percentageValid = (value: string) =>
    value === "" ||
    (Number.isFinite(Number(value)) &&
      Number(value) >= 0 &&
      Number(value) <= 100);
  const candidateRelationship = {
    fromEntityId: fromKey,
    toEntityId: toKey,
    type,
    ownershipPercentage:
      supportsInterestDetails && percentage !== "" ? Number(percentage) : null,
    effectiveFrom: effectiveFrom || null,
    effectiveTo: relationship?.effectiveTo ?? null,
  };
  const relationshipConflict = form.relatedRelationships.some(
    (existing) =>
      existing.draftKey !== relationship?.draftKey &&
      classifyCmpRelationshipConflict(candidateRelationship, {
        fromEntityId: relationshipRefKey(existing.fromRef),
        toEntityId: relationshipRefKey(existing.toRef),
        type: existing.type,
        ownershipPercentage: existing.ownershipPercentage,
        effectiveFrom: existing.effectiveFrom,
        effectiveTo: existing.effectiveTo,
      }) !== null
  );
  const valid = Boolean(
    toKey &&
    fromKey !== toKey &&
    endpointKindsValid &&
    percentageValid(percentage) &&
    !relationshipConflict
  );
  const save = () => {
    if (!valid) {
      return;
    }
    const ref = (key: string) =>
      key === "ROOT"
        ? ({ type: "ROOT" } as const)
        : ({ type: "DRAFT", draftKey: key } as const);
    onSave({
      draftKey: relationship?.draftKey ?? crypto.randomUUID(),
      fromRef: ref(fromKey),
      toRef: ref(toKey),
      type,
      ownershipPercentage:
        supportsInterestDetails && percentage !== ""
          ? Number(percentage)
          : null,
      effectiveFrom: cleanText(effectiveFrom),
      sourceDocument: relationship?.sourceDocument ?? null,
      remarks: cleanText(remarks),
    });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {relationship
              ? copy.clientFormEditRelationship
              : copy.clientFormNewPartyRelationship}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <DraftField label={roles[0]}>
            <PartyReferenceSelect
              value={fromKey}
              label={roles[0]}
              rootLabel={entityName("ROOT")}
              entities={form.relatedEntities.filter(
                (entity) =>
                  entity.kind === "COMPANY" || entity.kind === "PERSON"
              )}
              includeRoot
              onChange={setFromKey}
            />
          </DraftField>
          <DraftField label={copy.clientFormRelationshipType}>
            <Select
              value={type}
              onValueChange={(value) => value && setType(value as typeof type)}
            >
              <SelectTrigger>
                <SelectValue>{relationshipTypeLabel(type, copy)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {types.map((value) => (
                  <SelectItem key={value} value={value}>
                    {relationshipTypeLabel(value, copy)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DraftField>
          <DraftField label={roles[1]}>
            <PartyReferenceSelect
              value={toKey}
              label={roles[1]}
              rootLabel={entityName("ROOT")}
              entities={form.relatedEntities.filter((entity) =>
                targetKindAllowed(entity.kind)
              )}
              includeRoot={targetKindAllowed("COMPANY")}
              onChange={setToKey}
            />
          </DraftField>
          {supportsInterestDetails ? (
            <DraftField label={copy.clientFormOwnershipPercentage}>
              <Input
                type="number"
                min="0"
                max="100"
                value={percentage}
                onChange={(event) => setPercentage(event.target.value)}
              />
            </DraftField>
          ) : null}
          <DraftField label={copy.clientFormEffectiveDate}>
            <Input
              type="date"
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
            />
          </DraftField>
          <DraftField
            label={copy.clientFormRelationshipNotes}
            className="sm:col-span-2"
          >
            <Textarea
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
            />
          </DraftField>
          {relationshipConflict ? (
            <p className="text-sm text-destructive sm:col-span-2">
              {copy.clientFormRelationshipConflict}
            </p>
          ) : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {copy.cancel}
          </Button>
          <Button type="button" disabled={!valid} onClick={save}>
            {copy.clientFormSaveRelationship}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function groupRelationshipTypeLabel(
  type: CmpGroupRelationshipDraft["type"],
  copy: CmpDictionary["workspace"]
) {
  return type === "ASSOCIATE"
    ? copy.clientFormRelationAssociateOf
    : copy.clientFormRelationJointVentureWith;
}

function GroupRelationshipDraftTable({
  relationships,
  copy,
  entityName,
  relationshipRefKey: refKey,
  onAdd,
  onEdit,
  onRemove,
}: {
  relationships: CmpGroupRelationshipDraft[];
  copy: CmpDictionary["workspace"];
  entityName: (key: string) => string;
  relationshipRefKey: (ref: CmpGroupRelationshipDraft["targetRef"]) => string;
  onAdd: () => void;
  onEdit: (relationship: CmpGroupRelationshipDraft) => void;
  onRemove: (draftKey: string) => void;
}) {
  const participantSummary = (relationship: CmpGroupRelationshipDraft) =>
    relationship.participants
      .map((participant) => {
        const name = entityName(refKey(participant.entityRef));
        if (participant.method === "OTHER") {
          return `${name}: ${participant.otherDescription ?? copy.clientFormGroupMethodOther}`;
        }
        return participant.ownershipPercentage === null
          ? `${name}: ${copy.clientFormGroupMethodOwnership}`
          : `${name}: ${participant.ownershipPercentage}%`;
      })
      .join(" · ");

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">
            {copy.clientFormGroupRelationships}
          </h4>
          <span className="text-xs text-muted-foreground">
            {relationships.length}
          </span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          {copy.clientFormNewGroupRelationship}
        </Button>
      </div>
      {relationships.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">
                  {copy.clientFormRelationshipType}
                </th>
                <th className="px-3 py-2 font-medium">
                  {copy.clientFormGroupTargetCompany}
                </th>
                <th className="px-3 py-2 font-medium">
                  {copy.clientFormGroupParticipants}
                </th>
                <th className="px-3 py-2 font-medium">{copy.action}</th>
              </tr>
            </thead>
            <tbody>
              {relationships.map((relationship) => (
                <tr
                  key={relationship.draftKey}
                  className="border-b last:border-0"
                >
                  <td className="px-3 py-3 font-medium">
                    {groupRelationshipTypeLabel(relationship.type, copy)}
                  </td>
                  <td className="px-3 py-3">
                    {entityName(refKey(relationship.targetRef))}
                  </td>
                  <td className="max-w-[440px] px-3 py-3 text-muted-foreground">
                    <span
                      className="block truncate"
                      title={participantSummary(relationship)}
                    >
                      {participantSummary(relationship)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <ButtonGroup>
                      <Button
                        type="button"
                        variant="quiet"
                        size="sm"
                        onClick={() => onEdit(relationship)}
                      >
                        {copy.clientFormEditRelationship}
                      </Button>
                      <Button
                        type="button"
                        variant="quiet"
                        size="sm"
                        onClick={() => onRemove(relationship.draftKey)}
                      >
                        {copy.clientFormRemoveRelationship}
                      </Button>
                    </ButtonGroup>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
          {copy.clientFormRelationshipsEmpty}
        </p>
      )}
    </section>
  );
}

function DraftGroupRelationshipDialog({
  open,
  relationship,
  form,
  copy,
  entityName,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  relationship?: CmpGroupRelationshipDraft;
  form: ClientMasterFormData;
  copy: CmpDictionary["workspace"];
  entityName: (key: string) => string;
  onOpenChange: (open: boolean) => void;
  onSave: (relationship: CmpGroupRelationshipDraft) => void;
}) {
  const companies = form.relatedEntities.filter(
    (entity) => entity.kind === "COMPANY"
  );
  const [targetKey, setTargetKey] = useState(
    relationship ? relationshipRefKey(relationship.targetRef) : ""
  );
  const [type, setType] = useState<CmpGroupRelationshipDraft["type"]>(
    relationship?.type ?? "ASSOCIATE"
  );
  const [participants, setParticipants] = useState<
    CmpGroupRelationshipEditorParticipant[]
  >(
    relationship?.participants.map((participant) => ({
      entityId: relationshipRefKey(participant.entityRef),
      method: participant.method,
      ownershipPercentage:
        participant.ownershipPercentage === null
          ? ""
          : String(participant.ownershipPercentage),
      otherDescription: participant.otherDescription ?? "",
    })) ?? [
      {
        entityId: "ROOT",
        method: "OWNERSHIP" as const,
        ownershipPercentage: "",
        otherDescription: "",
      },
    ]
  );
  const [effectiveFrom, setEffectiveFrom] = useState(
    relationship?.effectiveFrom ?? ""
  );
  const [remarks, setRemarks] = useState(relationship?.remarks ?? "");
  const percentageValid = (value: string) =>
    value === "" ||
    (Number.isFinite(Number(value)) &&
      Number(value) >= 0 &&
      Number(value) <= 100);
  const participantKeys = participants.map(
    (participant) => participant.entityId
  );
  const valid = Boolean(
    targetKey &&
    participants.length > 0 &&
    participantKeys.every(Boolean) &&
    !participantKeys.includes(targetKey) &&
    new Set(participantKeys).size === participantKeys.length &&
    participants.every(
      (participant) =>
        (participant.method === "OWNERSHIP" &&
          percentageValid(participant.ownershipPercentage)) ||
        (participant.method === "OTHER" && participant.otherDescription.trim())
    )
  );
  const ref = (key: string) =>
    key === "ROOT"
      ? ({ type: "ROOT" } as const)
      : ({ type: "DRAFT", draftKey: key } as const);
  const save = () => {
    if (!valid) {
      return;
    }
    onSave({
      draftKey: relationship?.draftKey ?? crypto.randomUUID(),
      existingRelationshipId: relationship?.existingRelationshipId ?? null,
      targetRef: ref(targetKey),
      type,
      participants: participants.map((participant) => ({
        entityRef: ref(participant.entityId),
        method: participant.method,
        ownershipPercentage:
          participant.method === "OWNERSHIP" &&
          participant.ownershipPercentage !== ""
            ? Number(participant.ownershipPercentage)
            : null,
        otherDescription:
          participant.method === "OTHER"
            ? cleanText(participant.otherDescription)
            : null,
      })),
      effectiveFrom: cleanText(effectiveFrom),
      sourceDocument: relationship?.sourceDocument ?? null,
      remarks: cleanText(remarks),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {relationship
              ? copy.clientFormEditRelationship
              : copy.clientFormNewGroupRelationship}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <CmpGroupRelationshipEditor
            type={type}
            targetEntityId={targetKey}
            participants={participants}
            options={[
              { id: "ROOT", label: entityName("ROOT") },
              ...companies.map((entity) => ({
                id: entity.draftKey,
                label: entity.displayName,
              })),
            ]}
            copy={{
              relationshipType: copy.clientFormRelationshipType,
              associate: copy.clientFormRelationAssociateOf,
              jointVenture: copy.clientFormRelationJointVentureWith,
              targetCompany: copy.clientFormGroupTargetCompany,
              participants: copy.clientFormGroupParticipants,
              participant: copy.clientFormGroupParticipant,
              addParticipant: copy.clientFormAddGroupParticipant,
              ownership: copy.clientFormGroupMethodOwnership,
              other: copy.clientFormGroupMethodOther,
              ownershipPlaceholder: copy.clientFormOwnershipPercentage,
              otherPlaceholder: copy.clientFormGroupOtherDescription,
              removeParticipant: copy.clientFormRemoveRelationship,
            }}
            onTypeChange={setType}
            onTargetChange={setTargetKey}
            onParticipantsChange={setParticipants}
          />
          <DraftField label={copy.clientFormEffectiveDate}>
            <Input
              type="date"
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
            />
          </DraftField>
          <DraftField
            label={copy.clientFormRelationshipNotes}
            className="sm:col-span-2"
          >
            <Textarea
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
            />
          </DraftField>
          {!valid ? (
            <p className="text-sm text-destructive sm:col-span-2">
              {copy.clientFormGroupRelationshipInvalid}
            </p>
          ) : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {copy.cancel}
          </Button>
          <Button type="button" disabled={!valid} onClick={save}>
            {copy.clientFormSaveRelationship}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DerivedUboDraftSection({
  form,
  copy,
  entityName,
}: {
  form: ClientMasterFormData;
  copy: CmpDictionary["workspace"];
  entityName: (key: string) => string;
}) {
  const ownership = form.relatedRelationships.filter(
    (relationship) => relationship.type === "OWNS"
  );
  const recordedLegacy = form.relatedRelationships.filter(
    (relationship) => relationship.type === "BENEFICIAL_OWNER_OF"
  );
  const inference = inferCmpOwnership({
    targetEntityId: "ROOT",
    entities: [
      { id: "ROOT", kind: "COMPANY" },
      ...form.relatedEntities.map((entity) => ({
        id: entity.draftKey,
        kind: entity.kind,
      })),
    ],
    observations: ownership.map((relationship) => ({
      id: relationship.draftKey,
      ownerId: relationshipRefKey(relationship.fromRef),
      investeeId: relationshipRefKey(relationship.toRef),
      percentage: relationship.ownershipPercentage ?? null,
    })),
  });
  const rows = [
    ...inference.candidates.map((candidate) => ({
      key: `candidate-${candidate.personId}`,
      owner: entityName(candidate.personId),
      ownershipPercentage: candidate.ownershipPercentage,
      status: candidate.status,
      explanation: inference.isComplete
        ? copy.clientFormOwnershipExact
        : copy.clientFormOwnershipConfirmedPartial,
    })),
    ...inference.issues.map((issue, index) => ({
      key: `issue-${issue.code}-${index}`,
      owner: copy.clientFormOwnershipDataConflict,
      ownershipPercentage: null,
      status: "DATA_CONFLICT" as const,
      explanation: ownershipIssueMessage(issue.code, copy),
    })),
    ...recordedLegacy.map((relationship) => ({
      key: relationship.draftKey,
      owner: entityName(relationshipRefKey(relationship.fromRef)),
      ownershipPercentage: null,
      status: "LEGACY" as const,
      explanation: [
        entityName(relationshipRefKey(relationship.fromRef)),
        copy.clientFormLegacyBeneficialOwnerRecord,
        entityName(relationshipRefKey(relationship.toRef)),
      ].join(" → "),
    })),
  ];
  return <ClientDerivedUboDataGrid rows={rows} copy={copy} />;
}

function ownershipIssueMessage(code: string, copy: CmpDictionary["workspace"]) {
  return (
    (
      {
        TARGET_NOT_COMPANY: copy.clientFormOwnershipIssueTarget,
        INVALID_OWNERSHIP_OWNER: copy.clientFormOwnershipIssueOwner,
        INVALID_OWNERSHIP_TARGET: copy.clientFormOwnershipIssueTarget,
        INVALID_PERCENTAGE: copy.clientFormOwnershipIssuePercentage,
        OVERLAPPING_OBSERVATIONS: copy.clientFormOwnershipIssueOverlap,
        OWNERSHIP_EXCEEDS_100: copy.clientFormOwnershipIssueExceeds,
        NO_CAPACITY_FOR_UNSPECIFIED_EDGE:
          copy.clientFormOwnershipIssueNoCapacity,
      } as Record<string, string>
    )[code] ?? copy.clientFormOwnershipDataConflict
  );
}

export function serializeClientServiceTypes(
  serviceTypes: readonly ClientServiceType[]
) {
  return [...new Set(serviceTypes)].join(", ");
}

const CLIENT_FIELD_KEY_BY_LABEL: Partial<
  Record<string, keyof ClientMasterFormData>
> = {
  "Client Code": "clientCode",
  "Company Code": "companyCode",
  "Company Number": "companyNumber",
  "Group Code / No group": "groupMode",
  "Group Code": "groupId",
  "Group Name": "groupName",
  "Client Status": "status",
  "Company Name English": "nameEn",
  "Company Name Chinese": "nameZh",
  "Contact Person": "contactPerson",
  Telephone: "telephone",
  Email: "email",
  Website: "website",
  "YE Month / Year End": "yearEndMonth",
  Industry: "hsicSectionCode",
  "Other Industry Description": "industryOtherDescription",
  Address: "address",
  Remarks: "remarks",
  "Place of Incorporation": "placeOfIncorporation",
  "Date of Incorporation": "incorporationYearMonth",
  "Listed / Private Company": "listedOrPrivate",
  "Stock Exchange / Place of Listing": "stockExchangeOrListingPlace",
  "Stock Code": "stockCode",
  "Main Board / GEM / Others": "marketSegment",
  "Regulated Entities": "regulatedEntities",
  "Regulator / Regulated By": "regulatedBy",
  Subsidiary: "isSubsidiary",
  "Parent Client Code": "parentClientCode",
  "Parent / Holding Company Name": "parentHoldingCompanyName",
  "Has Subsidiaries / Associates": "hasSubsidiariesOrAssociates",
  "Subsidiaries / Associates list": "subsidiariesOrAssociates",
  "Referred By": "referredBy",
  "Client Partner / PIC": "clientPartnerPicId",
  "Client Manager / MIC": "clientManagerMicId",
  "Alternative Partner / 2nd MIC": "alternativePartnerSecondMicId",
  "Expected Job / Engagement Type": "expectedJobOrEngagementType",
};

export const EMPTY_CLIENT_MASTER_FORM: ClientMasterFormData = {
  clientCode: "",
  companyCode: "",
  companyIdentifierType: "COMPANY_REGISTRATION_NUMBER",
  companyNumber: "",
  entityMapChoice: "",
  entityMapId: "",
  entityMapNodeId: "",
  relatedEntities: [],
  relatedRelationships: [],
  relatedGroupRelationships: [],
  removedGroupRelationshipIds: [],
  groupMode: "NO_GROUP",
  groupId: "",
  groupName: "",
  status: "",
  nameEn: "",
  nameZh: "",
  contactPerson: "",
  contacts: [],
  telephone: "",
  email: "",
  website: "",
  yearEndDate: "",
  yearEndMonth: "",
  hsicSectionCode: "",
  industryOtherDescription: "",
  reportingGaap: "",
  address: "",
  registeredAddress: "",
  principalBusinessAddress: "",
  principalAddressSameAsRegistered: true,
  additionalAddresses: [],
  contactPosition: "",
  contactDepartment: "",
  contactMobile: "",
  contactRemarks: "",
  placeOfIncorporation: "",
  incorporationYearMonth: "",
  listedOrPrivate: "",
  companyTypeOtherDescription: "",
  marketSegment: "",
  stockExchangeOrListingPlace: "",
  stockCode: "",
  regulatedEntities: "No",
  regulatedBy: "",
  isSubsidiary: false,
  parentClientCode: "",
  parentHoldingCompanyName: "",
  hasSubsidiariesOrAssociates: false,
  subsidiariesOrAssociates: "",
  isUltimateParent: false,
  wasUltimateParent: false,
  groupRelationships: [],
  referredBy: "",
  clientPartnerPicId: "",
  clientPartnerPic: "",
  clientLeadingPartnerId: "",
  clientLeadingPartner: "",
  clientManagerMicId: "",
  clientManagerMic: "",
  alternativePartnerSecondMicId: "",
  alternativePartnerSecondMic: "",
  expectedJobOrEngagementType: "",
  serviceType: "",
  serviceLines: "",
  approvalReferenceNumber: "",
  approvalDate: "",
  taxServiceDetails: "",
  comSecServiceDetails: "",
  otherServiceDescription: "",
  remarks: "",
  micApproverId: "",
  picApproverId: "",
  itApproverId: "",
};

type ClientRequiredField =
  | "clientCode"
  | "companyCode"
  | "companyNumber"
  | "status"
  | "nameEn"
  | "yearEndMonth"
  | "registeredAddress"
  | "principalBusinessAddress"
  | "placeOfIncorporation"
  | "industryOtherDescription"
  | "listedOrPrivate"
  | "companyTypeOtherDescription"
  | "clientLeadingPartnerId"
  | "clientPartnerPicId"
  | "clientManagerMicId"
  | "expectedJobOrEngagementType"
  | "serviceType";

const CLIENT_REQUIRED_FIELDS_BY_SECTION: Record<
  ClientFormSectionId,
  readonly ClientRequiredField[]
> = {
  basic: [
    "clientCode",
    "companyCode",
    "companyNumber",
    "status",
    "nameEn",
    "yearEndMonth",
    "registeredAddress",
    "principalBusinessAddress",
    "placeOfIncorporation",
    "listedOrPrivate",
  ],
  relationships: [],
  aml: [],
  responsible: [
    "clientLeadingPartnerId",
    "clientPartnerPicId",
    "clientManagerMicId",
    "serviceType",
  ],
};

function monthLabel(value: string, locale: "en-US" | "zh-CN" = "en-US") {
  const month = Number(value);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return "";
  }
  return new Intl.DateTimeFormat(locale, { month: "long" }).format(
    new Date(Date.UTC(2024, month - 1, 1))
  );
}

function companyIdentifierTypeOptions(locale: "en-US" | "zh-CN") {
  const zh = locale === "zh-CN";
  return [
    {
      value: "COMPANY_REGISTRATION_NUMBER" as const,
      label: zh ? "公司注册编号" : "Company registration number",
    },
    {
      value: "BUSINESS_REGISTRATION_NUMBER" as const,
      label: zh ? "商业登记号码" : "Business registration number",
    },
    { value: "LEI" as const, label: zh ? "法人机构识别编码（LEI）" : "LEI" },
    { value: "OTHER" as const, label: zh ? "其他" : "Other" },
  ];
}

function legacyYearEndMonth(value: string | null | undefined) {
  const match = value?.trim().match(/^\d{4}[-/](\d{1,2})(?:[-/]\d{1,2})?$/);
  const month = Number(match?.[1]);
  return Number.isInteger(month) && month >= 1 && month <= 12
    ? String(month)
    : "";
}

function clientRequiredFields(
  sectionId: ClientFormSectionId,
  requiresRouting: boolean,
  form?: ClientMasterFormData
) {
  const fields = CLIENT_REQUIRED_FIELDS_BY_SECTION[sectionId].filter(
    (field) =>
      requiresRouting ||
      (field !== "clientLeadingPartnerId" &&
        field !== "clientPartnerPicId" &&
        field !== "clientManagerMicId")
  );
  if (sectionId === "basic" && form?.listedOrPrivate === "OTHER") {
    fields.push("companyTypeOtherDescription");
  }
  if (sectionId === "basic" && form?.hsicSectionCode === "OTHER") {
    fields.push("industryOtherDescription");
  }
  if (
    sectionId === "responsible" &&
    parseClientServiceTypes(form?.serviceLines, form?.serviceType).includes(
      "Others"
    )
  ) {
    fields.push("expectedJobOrEngagementType");
  }
  return fields;
}

function isClientRequiredFieldComplete(
  form: ClientMasterFormData,
  field: ClientRequiredField
) {
  if (field === "serviceType") {
    return (
      parseClientServiceTypes(form.serviceLines, form.serviceType).length > 0
    );
  }
  if (field === "nameEn") {
    return Boolean(form.nameEn.trim() || form.nameZh.trim());
  }
  return Boolean(form[field].trim());
}

function hasTextValue(...values: (string | null | undefined)[]) {
  return values.some((value) => Boolean(value?.trim()));
}

function hasClientSectionContent(
  form: ClientMasterFormData,
  sectionId: ClientFormSectionId
) {
  switch (sectionId) {
    case "basic": {
      return (
        hasTextValue(
          form.clientCode,
          form.companyCode,
          form.companyNumber,
          form.nameEn,
          form.nameZh,
          form.contactPerson,
          form.telephone,
          form.email,
          form.website,
          form.yearEndMonth,
          form.reportingGaap,
          form.referredBy,
          form.registeredAddress,
          form.principalBusinessAddress,
          form.contactPosition,
          form.contactDepartment,
          form.contactMobile,
          form.contactRemarks,
          form.remarks,
          form.placeOfIncorporation,
          form.incorporationYearMonth,
          form.marketSegment,
          form.stockExchangeOrListingPlace,
          form.stockCode,
          form.regulatedBy,
          form.companyTypeOtherDescription,
          form.industryOtherDescription
        ) ||
        form.contacts.some((contact) =>
          hasTextValue(
            contact.name,
            contact.position,
            contact.department,
            contact.officePhone,
            contact.mobile,
            contact.email,
            contact.remarks
          )
        ) ||
        form.status !== EMPTY_CLIENT_MASTER_FORM.status ||
        form.listedOrPrivate !== EMPTY_CLIENT_MASTER_FORM.listedOrPrivate ||
        form.regulatedEntities !== EMPTY_CLIENT_MASTER_FORM.regulatedEntities
      );
    }
    case "relationships": {
      return (
        hasTextValue(
          form.groupId,
          form.groupName,
          form.parentClientCode,
          form.parentHoldingCompanyName,
          form.subsidiariesOrAssociates
        ) ||
        form.groupMode !== EMPTY_CLIENT_MASTER_FORM.groupMode ||
        form.isSubsidiary ||
        form.hasSubsidiariesOrAssociates ||
        form.isUltimateParent ||
        form.wasUltimateParent ||
        form.groupRelationships.length > 0 ||
        form.relatedEntities.length > 0 ||
        form.relatedRelationships.length > 0
      );
    }
    case "aml": {
      return false;
    }
    case "responsible": {
      return hasTextValue(
        form.clientLeadingPartnerId,
        form.clientLeadingPartner,
        form.clientPartnerPicId,
        form.clientPartnerPic,
        form.clientManagerMicId,
        form.clientManagerMic,
        form.alternativePartnerSecondMicId,
        form.alternativePartnerSecondMic,
        form.expectedJobOrEngagementType,
        form.serviceType,
        form.serviceLines
      );
    }
    default: {
      return false;
    }
  }
}

const EMPTY_ARRAY: never[] = [];

function omitClientError<T extends object>(value: T, key: string): T {
  const { [key]: _removed, ...remaining } = value as Record<string, unknown>;
  return remaining as T;
}

export function ClientMasterForm({
  initialValue,
  groups: _groups,
  existingClients = EMPTY_ARRAY,
  excludeClientId,
  users,
  submitTargetUsers = EMPTY_ARRAY,
  mode,
  actionsPlacement = "footer",
  autoSaveDraft = false,
  title,
  isBusy,
  submitLabel,
  reviewLabel = "Review & submit",
  draftLabel = "Save Draft",
  draftOwnerLabel,
  initialDraftAssigneeId = "",
  initialDraftName = "",
  acceptanceDraftId,
  hasPersistedDraft = false,
  isDeletingDraft = false,
  canDelegateDraft = true,
  allowIncompleteSubmit = false,
  validateOnOpen = false,
  onCancel,
  onSubmit,
  onSubmitSuccess,
  onBusyChange,
  onDirtyChange,
  onDeleteDraft,
  showCloseButton = true,
}: {
  initialValue?: Partial<ClientMasterFormData>;
  groups: CmpClientGroup[];
  existingClients?: CmpClient[];
  excludeClientId?: string | null;
  users?: DirectoryUser[];
  submitTargetUsers?: DirectoryUser[];
  mode: ClientMasterFormMode;
  actionsPlacement?: "footer" | "header";
  autoSaveDraft?: boolean;
  title?: string;
  isBusy?: boolean;
  submitLabel: string;
  reviewLabel?: string;
  draftLabel?: string;
  draftOwnerLabel?: string;
  initialDraftAssigneeId?: string;
  initialDraftName?: string;
  acceptanceDraftId?: string | null;
  hasPersistedDraft?: boolean;
  isDeletingDraft?: boolean;
  canDelegateDraft?: boolean;
  allowIncompleteSubmit?: boolean;
  validateOnOpen?: boolean;
  onCancel: () => void;
  onSubmit: (result: ClientMasterFormSubmit) => Promise<unknown>;
  onSubmitSuccess?: (result: ClientMasterFormSubmit) => void;
  onBusyChange?: (isBusy: boolean) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onDeleteDraft?: () => Promise<unknown>;
  showCloseButton?: boolean;
}) {
  const { dictionary, locale } = useCmpI18n();
  const copy = dictionary.workspace;
  const shellCopy = dictionary.shell;
  const [form, setForm] = useState<ClientMasterFormData>({
    ...EMPTY_CLIENT_MASTER_FORM,
    ...initialValue,
    contacts: initialValue?.contacts ?? [],
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [activeSectionId, setActiveSectionId] =
    useState<ClientFormWizardStepId>("basic");
  const [openSectionIds, setOpenSectionIds] = useState<string[]>(["basic"]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [draftSaveState, setDraftSaveState] = useState<
    "Loading" | "Saved" | "Saving" | "Error"
  >("Saved");
  const [failedAction, setFailedAction] = useState<
    "draft" | "assign" | "submit" | null
  >(null);
  const [isSaveHovered, setIsSaveHovered] = useState(false);
  const [companyIdentityConflict, setCompanyIdentityConflict] = useState<{
    match: CmpCompanyIdentityMatch;
    submitAfterResolution: boolean;
  } | null>(null);
  const [draftAssigneeId, setDraftAssigneeId] = useState(
    initialDraftAssigneeId
  );
  const [draftName, setDraftName] = useState(initialDraftName);
  const [amlStepStatus, setAmlStepStatus] =
    useState<CmpFormSectionStatus>("not-started");
  const [amlReviewSummary, setAmlReviewSummary] = useState(
    locale === "zh-CN" ? "AML 尚未筛查" : "AML not screened"
  );
  const [draftNameError, setDraftNameError] = useState<string | null>(null);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [memberActionDialog, setMemberActionDialog] = useState<
    "assign" | "submit" | null
  >(null);
  const actionFeedback = useCmpAsyncActionFeedback();
  const isActionBusy = Boolean(isBusy || actionFeedback.isRunning);
  const formRef = useRef<HTMLFormElement>(null);
  const draftNameRef = useRef<HTMLInputElement>(null);
  const workspaceContentRef = useRef<HTMLElement>(null);
  const didValidateOnOpen = useRef(false);
  const draftSaveRequestRef = useRef(0);
  const draftSaveSnapshotRef = useRef<string | null>(null);
  const failedAutoSaveSnapshotRef = useRef<string | null>(null);
  const suppressedAutoSaveSnapshotRef = useRef<string | null>(null);
  const [cleanSnapshot, setCleanSnapshot] = useState(
    JSON.stringify({
      form: { ...EMPTY_CLIENT_MASTER_FORM, ...initialValue },
      draftAssigneeId: initialDraftAssigneeId,
      draftName: initialDraftName,
    })
  );

  useEffect(() => {
    onBusyChange?.(isActionBusy);
  }, [isActionBusy, onBusyChange]);

  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  const approvers = useMemo(
    () =>
      [...(users ?? [])].sort((left, right) =>
        left.name.localeCompare(right.name)
      ),
    [users]
  );
  const staffUsers = approvers.filter(
    (user) =>
      (!user.status || user.status === "ACTIVE") &&
      ["SENIOR", "STAFF", "ASSISTANT"].includes(user.globalRole)
  );
  const responsibleUsers = approvers.filter(
    (user) => user.status !== "DISABLED"
  );
  const visible = getVisibleClientFields(form);
  const selectedServiceTypes = useMemo(
    () => parseClientServiceTypes(form.serviceLines, form.serviceType),
    [form.serviceLines, form.serviceType]
  );
  const requiresRouting = mode !== "create-client";
  const usesHeaderActions = actionsPlacement === "header";
  const usesTmsDraftSave = usesHeaderActions && requiresRouting;
  const formTitle =
    title ??
    (mode === "edit-request"
      ? copy.clientChangeTitle
      : copy.newClientAcceptance);
  const formSections = useMemo(
    () =>
      CLIENT_FORM_SECTION_ORDER.map((id) => ({
        id,
        label: {
          basic: copy.clientFormInformation,
          relationships: copy.clientFormGroupRelationship,
          aml: locale === "zh-CN" ? "AML 筛查" : "AML screening",
          responsible: copy.clientFormResponsibleAndServices,
        }[id],
      })),
    [copy, locale]
  );
  const requiredChecks = formSections.flatMap((section) =>
    clientRequiredFields(section.id, requiresRouting, form).map((field) =>
      isClientRequiredFieldComplete(form, field)
    )
  );
  const requiredProgress = copy.clientFormRequiredProgress
    .replace("{completed}", String(requiredChecks.filter(Boolean).length))
    .replace("{total}", String(requiredChecks.length));
  const normalizedDraftName = draftName.trim();
  const currentSnapshot = JSON.stringify({
    form,
    draftAssigneeId,
    draftName: normalizedDraftName,
  });
  const isDirty = currentSnapshot !== cleanSnapshot;
  const canAutoSaveDraft =
    autoSaveDraft &&
    usesHeaderActions &&
    requiresRouting &&
    Boolean(normalizedDraftName);
  const isDraftSaving = usesTmsDraftSave
    ? draftSaveState === "Loading" || draftSaveState === "Saving"
    : actionFeedback.isRunningFor("draft");
  const isDraftSaved = usesTmsDraftSave
    ? draftSaveState === "Saved" &&
      !isDirty &&
      Boolean(hasPersistedDraft || savedAt)
    : Boolean(savedAt && !isDirty && !isDraftSaving);
  const saveButtonState: MotionButtonState = isDraftSaving
    ? "loading"
    : usesTmsDraftSave && draftSaveState === "Error"
      ? "error"
      : !usesTmsDraftSave && failedAction === "draft"
        ? "error"
        : isDraftSaved
          ? "success"
          : "idle";
  const saveLabel = isDraftSaving
    ? usesTmsDraftSave
      ? copy.formSaveStateSaving
      : copy.formSaving
    : usesTmsDraftSave && draftSaveState === "Error"
      ? copy.formRetrySave
      : !usesTmsDraftSave && failedAction === "draft"
        ? copy.retry
        : isDraftSaved && !isSaveHovered
          ? copy.formSaved
          : copy.formSave;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
  const clientStatusOptions = [
    { value: "ACTIVE", label: copy.clientStatusActive },
    { value: "INACTIVE", label: copy.clientStatusInactive },
    ...(mode === "edit-request"
      ? [{ value: "RESIGNED", label: copy.clientStatusResigned }]
      : []),
  ] as const;

  function sectionMissingCount(sectionId: ClientFormSectionId) {
    const requiredFieldCount = clientRequiredFields(
      sectionId,
      requiresRouting,
      form
    ).filter((field) => !isClientRequiredFieldComplete(form, field)).length;
    return requiredFieldCount;
  }

  function sectionStatus(sectionId: ClientFormSectionId): CmpFormSectionStatus {
    if (sectionId === "aml") {
      return amlStepStatus;
    }
    if (sectionHasErrors(sectionId)) {
      return "error";
    }
    if (sectionMissingCount(sectionId)) {
      return "incomplete";
    }
    return hasClientSectionContent(form, sectionId)
      ? "complete"
      : "not-started";
  }

  const scrollWorkspaceToStart = useCallback(() => {
    window.requestAnimationFrame(() => {
      const root = workspaceContentRef.current;
      if (!root) {
        return;
      }

      const prefersReducedMotion = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      if (root.scrollTo) {
        root.scrollTo({
          top: 0,
          behavior: prefersReducedMotion ? "auto" : "smooth",
        });
      } else {
        root.scrollTop = 0;
      }
    });
  }, []);

  const activateStep = useCallback(
    (stepId: ClientFormWizardStepId) => {
      setActiveSectionId(stepId);
      if (stepId === "review") {
        setIsPreviewOpen(true);
      } else {
        setOpenSectionIds([stepId]);
      }
      scrollWorkspaceToStart();
    },
    [scrollWorkspaceToStart]
  );

  function updateOpenSections(sectionIds: string[]) {
    const newlyOpenedSection = sectionIds.find(
      (sectionId) => !openSectionIds.includes(sectionId)
    ) as ClientFormSectionId | undefined;
    setOpenSectionIds(newlyOpenedSection ? [newlyOpenedSection] : []);
    if (newlyOpenedSection) {
      setActiveSectionId(newlyOpenedSection);
    }
  }

  function validateBlurredField(field: string, fieldValue?: string) {
    // Required fields are intentionally quiet until the user asks to advance
    // Or submit. On blur, only validate values the user has actually entered.
    // A partially completed additional-address row is the exception: its
    // Companion field makes the empty value an invalid entry rather than an
    // Untouched field.
    const additionalAddressMatch = field.match(
      /^additionalAddresses\.(\d+)\.(label|address)$/
    );
    const hasAdditionalAddressCompanion = additionalAddressMatch
      ? Boolean(
          form.additionalAddresses[Number(additionalAddressMatch[1])]?.[
            additionalAddressMatch[2] === "label" ? "address" : "label"
          ].trim()
        )
      : false;
    const shouldDeferRequiredError =
      typeof fieldValue === "string" &&
      !fieldValue.trim() &&
      !hasAdditionalAddressCompanion;

    if (shouldDeferRequiredError) {
      setErrors((current) => omitClientError(current, field));
      return;
    }

    const formToValidate =
      fieldValue !== undefined &&
      field in form &&
      typeof form[field as keyof ClientMasterFormData] === "string"
        ? ({ ...form, [field]: fieldValue } as ClientMasterFormData)
        : form;
    const validation = {
      ...validateClientDraftPayload(buildClientPayload(formToValidate)),
      ...validateClientForm(formToValidate, {
        requiresRouting,
        messages: copy.clientRequiredFieldMessages,
      }),
      ...validateClientIdentifiers(
        formToValidate,
        existingClients,
        excludeClientId
      ),
    };
    setErrors((current) => {
      const next = { ...current };
      const keys = [field];
      for (const key of keys) {
        if (validation[key]) {
          next[key] = validation[key];
        } else {
          return omitClientError(next, key);
        }
      }
      return next;
    });
  }

  function validateIdentifierOnBlur(
    field: "clientCode" | "companyCode" | "companyNumber",
    fieldValue: string
  ) {
    if (!fieldValue.trim()) {
      setErrors((current) => omitClientError(current, field));
      return;
    }
    const validation = validateClientIdentifiers(
      { ...form, [field]: fieldValue },
      existingClients,
      excludeClientId
    );
    setErrors((current) => {
      const next = { ...current };
      if (validation[field]) {
        next[field] = validation[field];
      } else {
        return omitClientError(next, field);
      }
      return next;
    });
  }

  const requestCancel = useCallback(() => {
    if (isBusy || actionFeedback.isRunning) {
      return;
    }
    if (!isDirty && !hasPersistedDraft) {
      return onCancel();
    }
    setExitDialogOpen(true);
  }, [actionFeedback.isRunning, hasPersistedDraft, isBusy, isDirty, onCancel]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { target } = event;
      if (
        !(target instanceof Node) ||
        !formRef.current?.contains(target) ||
        event.key !== "Escape"
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      requestCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [requestCancel]);

  const update = useCallback(
    <Key extends keyof ClientMasterFormData>(
      key: Key,
      value: ClientMasterFormData[Key]
    ) => {
      setForm((current) => ({
        ...current,
        [key]: value,
        ...(["companyIdentifierType", "companyNumber"].includes(key)
          ? { companyIdentityResolution: undefined }
          : {}),
      }));
      setErrors((current) => {
        const next = { ...current, [key]: undefined };
        return next;
      });
    },
    []
  );

  function toggleServiceType(serviceType: ClientServiceType) {
    setForm((current) => {
      const currentSelection = parseClientServiceTypes(
        current.serviceLines,
        current.serviceType
      );
      const nextSelection = currentSelection.includes(serviceType)
        ? currentSelection.filter((item) => item !== serviceType)
        : [...currentSelection, serviceType];
      const serviceLines = serializeClientServiceTypes(nextSelection);
      const normalizedSelection = parseClientServiceTypes(serviceLines);
      return {
        ...current,
        serviceLines,
        serviceType: normalizedSelection[0] ?? "",
      };
    });
  }

  function updateResponsibleUser(
    idKey:
      | "clientLeadingPartnerId"
      | "clientPartnerPicId"
      | "clientManagerMicId"
      | "alternativePartnerSecondMicId",
    nameKey:
      | "clientLeadingPartner"
      | "clientPartnerPic"
      | "clientManagerMic"
      | "alternativePartnerSecondMic",
    userId: string
  ) {
    const selected = responsibleUsers.find((user) => user.id === userId);
    setForm((current) => {
      const next = {
        ...current,
        [idKey]: userId,
        [nameKey]: selected?.name ?? "",
      };
      return next;
    });
    setErrors((current) => ({ ...current, [idKey]: undefined }));
  }

  function _addGroupRelationship() {
    setForm((current) => ({
      ...current,
      groupRelationships: [
        ...current.groupRelationships,
        {
          key: `new-${Date.now()}-${current.groupRelationships.length}`,
          relationshipId: "",
          groupId: current.groupId,
          action: "UPSERT",
          type: "SUBSIDIARY",
          direction: "TO_CLIENT",
          counterpartClientId: "",
          ownershipPercentage: "",
          effectiveFrom: "",
          effectiveTo: "",
          remarks: "",
        },
      ],
    }));
  }

  function _updateGroupRelationship(
    index: number,
    patch: Partial<ClientRelationshipFormRow>
  ) {
    setForm((current) => ({
      ...current,
      groupRelationships: current.groupRelationships.map(
        (relationship, itemIndex) =>
          itemIndex === index ? { ...relationship, ...patch } : relationship
      ),
    }));
    setErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([field]) => !field.startsWith(`groupRelationships.${index}.`)
        )
      )
    );
  }

  function _removeGroupRelationship(index: number) {
    setForm((current) => {
      const relationship = current.groupRelationships[index];
      if (!relationship) {
        return current;
      }
      if (relationship.relationshipId) {
        return {
          ...current,
          groupRelationships: current.groupRelationships.map(
            (item, itemIndex) =>
              itemIndex === index
                ? {
                    ...item,
                    action: "END",
                    effectiveTo:
                      item.effectiveTo || new Date().toISOString().slice(0, 10),
                  }
                : item
          ),
        };
      }
      return {
        ...current,
        groupRelationships: current.groupRelationships.filter(
          (_, itemIndex) => itemIndex !== index
        ),
      };
    });
  }

  async function submit(
    action: "draft" | "assign" | "submit",
    resolutionOverride?: CmpCompanyIdentityResolution,
    memberOverride?: {
      draftAssigneeId?: string;
      micApprover?: DirectoryUser;
    }
  ) {
    if (
      action === "draft" &&
      usesHeaderActions &&
      requiresRouting &&
      !normalizedDraftName
    ) {
      const message =
        locale === "zh-CN"
          ? "保存草稿前必须填写草稿名称。"
          : "A draft name is required before saving.";
      setDraftNameError(message);
      window.setTimeout(() => draftNameRef.current?.focus(), 0);
      throw new Error(message);
    }
    const submissionForm = memberOverride?.micApprover
      ? {
          ...form,
          clientManagerMicId: memberOverride.micApprover.id,
          clientManagerMic: memberOverride.micApprover.name,
        }
      : form;
    const payload = buildClientPayload({
      ...submissionForm,
      companyIdentityResolution:
        resolutionOverride ?? submissionForm.companyIdentityResolution,
    });
    const validation =
      action === "submit" && !allowIncompleteSubmit
        ? {
            ...validateClientDraftPayload(payload),
            ...validateClientGroupRelationships(submissionForm, false),
            ...validateClientForm(submissionForm, {
              requiresRouting,
              messages: copy.clientRequiredFieldMessages,
            }),
            ...validateClientIdentifiers(
              submissionForm,
              existingClients,
              excludeClientId
            ),
          }
        : {};
    setErrors(validation);
    if (Object.keys(validation).length) {
      const firstSectionWithError = formSections.find((section) =>
        Object.entries(validation).some(
          ([field, message]) =>
            Boolean(message) &&
            CLIENT_FORM_SECTION_ERROR_KEYS[section.id].some((key) =>
              key.endsWith(".") ? field.startsWith(key) : field === key
            )
        )
      );
      activateStep(firstSectionWithError?.id ?? "basic");
      window.setTimeout(() => focusFirstInvalidField(formRef.current), 0);
      return;
    }
    if (action === "submit" && submissionForm.companyNumber.trim()) {
      let match: CmpCompanyIdentityMatch | null;
      try {
        ({ match } = await api.cmpCompanyIdentityMatch(
          submissionForm.companyIdentifierType,
          submissionForm.companyNumber.trim()
        ));
      } catch {
        setErrors((current) => ({
          ...current,
          companyNumber:
            locale === "zh-CN"
              ? "暂时无法核对公司编号，请重试。"
              : "Unable to check the company identifier. Please retry.",
        }));
        activateStep("basic");
        return;
      }
      const isCurrentClientRoot = Boolean(
        excludeClientId &&
        match?.clients.some(
          (client) => client.id === excludeClientId && client.role === "ROOT"
        )
      );
      const resolution = payload.companyIdentityResolution;
      if (
        match &&
        !isCurrentClientRoot &&
        (resolution?.entityId !== match.entity.id ||
          resolution.expectedUpdatedAt !== match.entity.updatedAt)
      ) {
        setCompanyIdentityConflict({ match, submitAfterResolution: true });
        return;
      }
      if (!match || isCurrentClientRoot) {
        delete payload.companyIdentityResolution;
      }
    }
    const result: ClientMasterFormSubmit = {
      action,
      draftName: action === "submit" ? undefined : normalizedDraftName,
      payload,
      // Keep a selected assignee when the MIC saves a draft. Otherwise the
      // draft remains MIC-owned and the Staff member never receives edit access.
      draftAssigneeId:
        action === "submit"
          ? undefined
          : cleanText(memberOverride?.draftAssigneeId ?? draftAssigneeId),
      micApproverId: cleanText(submissionForm.clientManagerMicId),
      picApproverId: cleanText(submissionForm.picApproverId),
      itApproverId: cleanText(submissionForm.itApproverId),
    };
    const submittedSnapshot = JSON.stringify({
      form: submissionForm,
      draftAssigneeId: memberOverride?.draftAssigneeId ?? draftAssigneeId,
      draftName: normalizedDraftName,
    });
    setFailedAction(null);
    const isTmsDraftSave = action === "draft" && usesTmsDraftSave;
    const draftSaveRequestId = isTmsDraftSave
      ? draftSaveRequestRef.current
      : null;
    if (isTmsDraftSave) {
      setDraftSaveState("Saving");
    }
    const operation = () => onSubmit(result);
    const submission = isTmsDraftSave
      ? Promise.all([
          operation(),
          new Promise<void>((resolve) => {
            window.setTimeout(resolve, SAVE_FEEDBACK_MINIMUM_MS);
          }),
        ]).then(([response]) => response)
      : actionFeedback.run(
          {
            actionKey: action,
            pendingLabel:
              action === "assign"
                ? copy.assigningDraft
                : action === "submit"
                  ? copy.formSubmitting
                  : copy.formSaving,
            successLabel:
              action === "assign"
                ? copy.toastDraftAssigned
                : action === "submit"
                  ? copy.formSubmitSuccess
                  : copy.formSaved,
          },
          operation
        );
    return Promise.resolve(submission)
      .then(async (response) => {
        if (
          draftSaveRequestId !== null &&
          draftSaveRequestId !== draftSaveRequestRef.current
        ) {
          setDraftSaveState("Saved");
          return;
        }
        const requestId =
          response && typeof response === "object" && "id" in response
            ? String((response as { id?: string }).id ?? "")
            : "";
        if (
          action !== "submit" &&
          form.entityMapChoice === "YES" &&
          form.entityMapId &&
          !form.entityMapNodeId &&
          requestId &&
          form.clientCode.trim()
        ) {
          try {
            const map = await api.attachCmpEntityMapDraft(form.entityMapId, {
              acceptanceId: requestId,
              clientCode: form.clientCode.trim(),
              displayName:
                form.nameEn.trim() ||
                form.nameZh.trim() ||
                form.clientCode.trim(),
              companyNumber: form.companyNumber.trim() || undefined,
              jurisdiction: form.placeOfIncorporation.trim() || undefined,
            });
            const node = map.nodes.find(
              (item) => item.pendingAcceptanceId === requestId
            );
            if (node) {
              update("entityMapNodeId", node.id);
            }
          } catch {
            // A map is optional: retain the saved Client draft and allow retry.
          }
        }
        if (action !== "submit") {
          setCleanSnapshot(submittedSnapshot);
          failedAutoSaveSnapshotRef.current = null;
          setSavedAt(
            new Intl.DateTimeFormat(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date())
          );
        }
        if (isTmsDraftSave) {
          setDraftSaveState("Saved");
        }
        setFailedAction(null);
        onSubmitSuccess?.(result);
        return response;
      })
      .catch(() => {
        if (
          draftSaveRequestId !== null &&
          draftSaveRequestId !== draftSaveRequestRef.current
        ) {
          setDraftSaveState("Saved");
          return;
        }
        if (action === "assign") {
          setDraftAssigneeId(draftAssigneeId);
        }
        if (isTmsDraftSave) {
          failedAutoSaveSnapshotRef.current = submittedSnapshot;
          setDraftSaveState("Error");
        }
        setFailedAction(action);
        // The caller displays its mutation error and the form remains editable.
        return false;
      });
  }

  const submitEvent = useEffectEvent(submit);

  async function ensureDraftForAml() {
    const response = await submit("draft");
    if (response && typeof response === "object" && "id" in response) {
      return String((response as { id?: string }).id ?? "") || null;
    }
    return null;
  }

  function requestFormalSubmit() {
    if (submitTargetUsers.length > 0) {
      setMemberActionDialog("submit");
      return;
    }
    void submit("submit");
  }

  useEffect(() => {
    if (!canAutoSaveDraft) {
      return;
    }

    if (draftSaveSnapshotRef.current !== currentSnapshot) {
      draftSaveSnapshotRef.current = currentSnapshot;
      draftSaveRequestRef.current += 1;
    }

    if (
      suppressedAutoSaveSnapshotRef.current === currentSnapshot ||
      !isDirty ||
      (draftSaveState === "Error" &&
        failedAutoSaveSnapshotRef.current === currentSnapshot) ||
      isBusy ||
      actionFeedback.isRunning ||
      draftSaveState === "Saving"
    ) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void submitEvent("draft").catch(() => {
        // The inline draft state exposes the retry action.
      });
    }, AUTO_SAVE_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [
    actionFeedback.isRunning,
    canAutoSaveDraft,
    currentSnapshot,
    draftSaveState,
    isBusy,
    isDirty,
  ]);

  function sectionHasErrors(sectionId: ClientFormSectionId) {
    return Object.entries(errors).some(
      ([field, message]) =>
        Boolean(message) &&
        CLIENT_FORM_SECTION_ERROR_KEYS[sectionId].some((key) =>
          key.endsWith(".") ? field.startsWith(key) : field === key
        )
    );
  }

  function goToPreviousStep() {
    const steps: ClientFormWizardStepId[] = [
      ...formSections.map((section) => section.id),
      "review",
    ];
    const index = steps.indexOf(activeSectionId);
    if (index > 0) {
      activateStep(steps[index - 1]);
    }
  }

  function goToNextStep() {
    const steps: ClientFormWizardStepId[] = [
      ...formSections.map((section) => section.id),
      "review",
    ];
    const index = steps.indexOf(activeSectionId);
    if (index < steps.length - 1) {
      activateStep(steps[index + 1]);
    }
  }

  const reviewStructureGraph = useMemo(
    () => buildRelatedPartyStructureGraph(form, locale === "zh-CN"),
    [form, locale]
  );
  const reviewSections: ReviewSection[] = formSections.map((section) => {
    const itemsBySection: Record<
      ClientFormSectionId,
      { label: string; value?: ReactNode; wide?: boolean }[]
    > = {
      basic: [
        { label: copy.clientCode, value: form.clientCode },
        { label: copy.companyCode, value: form.companyCode },
        {
          label: copy.clientFormCompanyIdentifierType,
          value: companyIdentifierTypeOptions(locale).find(
            (option) => option.value === form.companyIdentifierType
          )?.label,
        },
        { label: copy.clientFormCompanyNumber, value: form.companyNumber },
        { label: copy.clientName, value: form.nameEn },
        { label: copy.chineseName, value: form.nameZh },
        { label: copy.status, value: form.status },
        { label: copy.clientFormCompanyType, value: form.listedOrPrivate },
        { label: copy.clientFormReferredBy, value: form.referredBy },
        {
          label: copy.clientFormRegisteredAddress,
          value: form.registeredAddress,
        },
        {
          label: copy.clientFormPrincipalBusinessAddress,
          value: form.principalBusinessAddress,
        },
        {
          label: copy.clientFormSameAsRegisteredAddress,
          value: form.principalAddressSameAsRegistered ? copy.yes : copy.no,
        },
        ...form.additionalAddresses.map((address, index) => ({
          label: `${copy.clientFormAdditionalAddresses} ${index + 1}: ${
            address.label || copy.clientFormNotProvided
          }`,
          value: address.address,
        })),
        ...form.contacts.map((contact, index) => ({
          label: `${copy.clientFormContactPerson} ${index + 1}`,
          value: [
            contact.name,
            contact.position,
            contact.department,
            contact.officePhone,
            contact.mobile,
            contact.email,
            contact.remarks,
          ]
            .filter(Boolean)
            .join(" · "),
        })),
        { label: copy.clientFormRemarks, value: form.remarks },
      ],
      relationships: [
        {
          label: copy.clientFormEntityStructure,
          wide: true,
          value: (
            <CmpEntityStructureGraph
              graph={reviewStructureGraph}
              zh={locale === "zh-CN"}
              className="h-[420px] border border-border/70"
            />
          ),
        },
      ],
      aml: [
        {
          label: locale === "zh-CN" ? "AML 筛查状态" : "AML screening status",
          value: amlReviewSummary,
          wide: true,
        },
      ],
      responsible: [
        {
          label: copy.clientFormClientLeadingPartner,
          value: form.clientLeadingPartner,
        },
        { label: copy.pic, value: form.clientPartnerPic },
        { label: copy.mic, value: form.clientManagerMic },
        {
          label: copy.alternativePartnerSecondMic,
          value: form.alternativePartnerSecondMic,
        },
        {
          label: copy.expectedJobOrEngagementType,
          value: form.expectedJobOrEngagementType,
        },
        {
          label: copy.serviceType,
          value: serializeClientServiceTypes(selectedServiceTypes),
        },
      ],
    };
    itemsBySection.basic.push(
      { label: copy.placeOfIncorporation, value: form.placeOfIncorporation },
      {
        label: copy.clientFormDateOfIncorporation,
        value: form.incorporationYearMonth,
      },
      {
        label: copy.clientFormIndustry,
        value:
          form.hsicSectionCode === "OTHER"
            ? copy.clientFormOther
            : CMP_HSIC_SECTION_OPTIONS.some(
                  (option) => option.code === form.hsicSectionCode
                )
              ? `${form.hsicSectionCode} - ${
                  locale === "zh-CN"
                    ? CMP_HSIC_SECTION_OPTIONS.find(
                        (option) => option.code === form.hsicSectionCode
                      )?.zh
                    : CMP_HSIC_SECTION_OPTIONS.find(
                        (option) => option.code === form.hsicSectionCode
                      )?.en
                }`
              : "",
      },
      { label: copy.clientFormReportingGaap, value: form.reportingGaap },
      {
        label: copy.clientFormOtherIndustryDescription,
        value:
          form.hsicSectionCode === "OTHER"
            ? form.industryOtherDescription
            : undefined,
      },
      {
        label: copy.clientFormYearEndMonth,
        value: monthLabel(form.yearEndMonth, locale),
      },
      {
        label: copy.clientFormOtherCompanyType,
        value:
          form.listedOrPrivate === "OTHER"
            ? form.companyTypeOtherDescription
            : undefined,
      },
      {
        label: copy.clientFormMarketSegment,
        value: visible.listing ? form.marketSegment : undefined,
      },
      {
        label: copy.clientFormStockExchangeOrListingPlace,
        value: visible.listing ? form.stockExchangeOrListingPlace : undefined,
      },
      {
        label: copy.clientFormStockCode,
        value: visible.listing ? form.stockCode : undefined,
      },
      { label: copy.regulatedEntities, value: form.regulatedEntities },
      {
        label: copy.clientFormRegulator,
        value: visible.regulatedBy ? form.regulatedBy : undefined,
      }
    );
    return {
      id: section.id,
      label: section.label,
      status: sectionStatus(section.id),
      items: itemsBySection[section.id],
    };
  });

  useEffect(() => {
    if (!validateOnOpen || didValidateOnOpen.current) {
      return;
    }
    didValidateOnOpen.current = true;
    const validation = {
      ...validateClientDraftPayload(buildClientPayload(form)),
      ...validateClientForm(form, {
        requiresRouting,
        messages: copy.clientRequiredFieldMessages,
      }),
      ...validateClientIdentifiers(form, existingClients, excludeClientId),
    };
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      const firstInvalidSection = formSections.find((section) =>
        Object.entries(validation).some(
          ([field, message]) =>
            Boolean(message) &&
            CLIENT_FORM_SECTION_ERROR_KEYS[section.id].some((key) =>
              key.endsWith(".") ? field.startsWith(key) : field === key
            )
        )
      );
      activateStep(firstInvalidSection?.id ?? "basic");
      requestAnimationFrame(() => focusFirstInvalidField(formRef.current));
    }
  }, [
    activateStep,
    copy.clientRequiredFieldMessages,
    excludeClientId,
    existingClients,
    form,
    formSections,
    requiresRouting,
    validateOnOpen,
  ]);

  const wizardSteps: FormWizardStep[] = [
    ...formSections.map((section) => ({
      id: section.id,
      label: section.label.replace(/^\d+\.\s*/, ""),
      status: sectionStatus(section.id),
      missingCount: sectionMissingCount(section.id),
    })),
    {
      id: "review",
      label: copy.clientFormPreview,
      status: requiredChecks.every(Boolean) ? "complete" : "incomplete",
      missingCount: requiredChecks.filter((complete) => !complete).length,
    },
  ];
  const accordionStatusCopy = {
    complete: copy.formComplete,
    error: copy.formHasErrors,
    incomplete: copy.formIncomplete,
    notStarted: copy.formNotStarted,
  };

  return (
    <form
      ref={formRef}
      className="cmp-client-form-shell cmp-client-form-workspace cmp-form-wizard-workspace"
      data-actions-placement={actionsPlacement}
      noValidate
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (allowIncompleteSubmit || activeSectionId === "review") {
          requestFormalSubmit();
        } else if (activeSectionId === "responsible") {
          activateStep("review");
        } else {
          goToNextStep();
        }
      }}
    >
      <AcceptanceFormHeader>
        <div className="cmp-form-workspace-title">
          <div
            className={
              usesHeaderActions
                ? "flex min-w-0 flex-wrap items-center gap-2"
                : "cmp-form-workspace-title-row"
            }
          >
            {usesHeaderActions ? (
              <h1 className="relative -top-px text-xl leading-7 font-semibold">
                {formTitle}
              </h1>
            ) : (
              <h3>{formTitle}</h3>
            )}
            {usesHeaderActions ? (
              <Badge
                className="h-7 min-h-7 rounded-md! px-2"
                radius="default"
                variant="info-outline"
              >
                {copy.clientFormDraftStatus}
              </Badge>
            ) : (
              <span className="cmp-form-status-badge">
                {copy.clientFormDraftStatus}
              </span>
            )}
            {!usesHeaderActions && savedAt ? (
              <span className="cmp-form-save-state">
                {copy.formSaved} {savedAt}
              </span>
            ) : null}
            {usesHeaderActions && requiresRouting ? (
              <div className="flex shrink-0 items-center gap-1">
                <label className="sr-only" htmlFor="cmp-client-draft-name">
                  {locale === "zh-CN" ? "草稿名称" : "Draft name"}
                </label>
                <Input
                  ref={draftNameRef}
                  id="cmp-client-draft-name"
                  aria-invalid={Boolean(draftNameError)}
                  className="h-7 w-40 text-xs sm:w-52"
                  maxLength={100}
                  placeholder={locale === "zh-CN" ? "草稿名称" : "Draft name"}
                  value={draftName}
                  onChange={(event) => {
                    setDraftName(event.target.value);
                    setDraftNameError(null);
                  }}
                />
                {onDeleteDraft ? (
                  <CmpFormDraftDeleteAction
                    copy={{
                      cancel: copy.cancel,
                      delete: copy.delete,
                      deleteDraft: copy.deleteDraft,
                      deleteDraftDescription: copy.deleteDraftDescription,
                      deleteDraftTitle: copy.deleteDraftTitle,
                      deletingDraft: copy.deletingDraft,
                    }}
                    disabled={!hasPersistedDraft || Boolean(isBusy)}
                    isDeleting={isDeletingDraft}
                    onDelete={onDeleteDraft}
                  />
                ) : null}
                <StatefulMotionButton
                  aria-label={saveLabel}
                  className="h-7 shrink-0 cursor-pointer px-2 text-xs! [&_.lucide-x]:text-destructive [&_svg]:size-3.5"
                  disabled={
                    Boolean(isBusy) ||
                    (actionFeedback.isRunning && !isDraftSaving)
                  }
                  size="sm"
                  variant="ghost"
                  state={saveButtonState}
                  loadingText={copy.formSaveStateSaving}
                  successIcon={
                    isSaveHovered ? (
                      <Check className="text-success" />
                    ) : undefined
                  }
                  successText={isSaveHovered ? copy.formSave : copy.formSaved}
                  errorText={copy.formRetrySave}
                  onBlur={() => setIsSaveHovered(false)}
                  onFocus={() => setIsSaveHovered(true)}
                  onMouseEnter={() => setIsSaveHovered(true)}
                  onMouseLeave={() => setIsSaveHovered(false)}
                  onClick={() => void submit("draft").catch(() => {})}
                >
                  {copy.formSave}
                </StatefulMotionButton>
              </div>
            ) : null}
          </div>
          {usesHeaderActions ? null : (
            <div className="cmp-form-required-progress-group">
              <span className="cmp-form-required-progress">
                {requiredProgress}
              </span>
              <progress
                className="cmp-form-required-progress-track"
                aria-label={requiredProgress}
                max={requiredChecks.length || 1}
                value={requiredChecks.filter(Boolean).length}
              />
            </div>
          )}
        </div>
        {usesHeaderActions ? (
          <ButtonGroup className="cmp-form-header-actions shrink-0 items-center gap-1.5">
            {requiresRouting && canDelegateDraft ? (
              <DraftAssignmentPanel
                compact
                controlsOnly
                assigneeId={draftAssigneeId}
                users={staffUsers}
                isBusy={isBusy || actionFeedback.isRunning}
                ownerLabel={draftOwnerLabel ?? copy.micOwnsDraft}
                onAssigneeChange={setDraftAssigneeId}
                onAssign={() => setMemberActionDialog("assign")}
              />
            ) : null}
            {allowIncompleteSubmit || activeSectionId === "review" ? (
              <MotionButton
                type="submit"
                className="h-7 cursor-pointer px-2.5 text-xs!"
                disabled={isBusy || actionFeedback.isRunning}
                size="sm"
                variant="secondary"
              >
                {isBusy || actionFeedback.isRunning
                  ? copy.formSaving
                  : submitLabel}
              </MotionButton>
            ) : (
              <MotionButton
                type="submit"
                aria-label={
                  activeSectionId === "responsible"
                    ? reviewLabel
                    : copy.formNext
                }
                className="size-7 cursor-pointer rounded-full! [&_svg]:size-3.5"
                disabled={isBusy || actionFeedback.isRunning}
                size="icon"
                variant="secondary"
              >
                <ArrowRight aria-hidden="true" />
              </MotionButton>
            )}
          </ButtonGroup>
        ) : requiresRouting && canDelegateDraft ? (
          <DraftAssignmentPanel
            compact
            assigneeId={draftAssigneeId}
            users={staffUsers}
            isBusy={isBusy || actionFeedback.isRunning}
            ownerLabel={draftOwnerLabel ?? copy.micOwnsDraft}
            onAssigneeChange={setDraftAssigneeId}
            onAssign={() => submit("assign")}
          />
        ) : null}
        {showCloseButton || usesHeaderActions ? (
          <Button
            type="button"
            className="cmp-icon-button cmp-form-close-button"
            aria-label={shellCopy.close}
            onClick={requestCancel}
          >
            <X aria-hidden="true" />
          </Button>
        ) : null}
      </AcceptanceFormHeader>
      <CmpDraftExitDialog
        draftName={draftName}
        isSaving={isDraftSaving || Boolean(isBusy)}
        open={exitDialogOpen}
        onDraftNameChange={(value) => {
          setDraftName(value);
          setDraftNameError(null);
        }}
        onKeepAndExit={() => {
          void submit("draft").then((saved) => {
            if (!saved) {
              return;
            }
            setExitDialogOpen(false);
            onCancel();
          });
        }}
        onOpenChange={setExitDialogOpen}
      />
      <AcceptanceFormWorkspace
        activeStepId={activeSectionId}
        contentRef={workspaceContentRef}
        framed={usesHeaderActions}
        stepperLabel={copy.clientFormSections}
        steps={wizardSteps}
        onStepChange={(stepId) =>
          activateStep(stepId as ClientFormWizardStepId)
        }
        onBlurCapture={(event) => {
          const target = event.target as unknown as
            | HTMLInputElement
            | HTMLSelectElement
            | HTMLTextAreaElement;
          const field = target.dataset.validationField;
          if (field) {
            const fieldValue = target.value;
            window.setTimeout(() => validateBlurredField(field, fieldValue), 0);
          }
        }}
      >
        {activeSectionId === "review" ? (
          <Accordion
            multiple
            value={isPreviewOpen ? ["review"] : []}
            className="cmp-client-form-accordion mx-auto w-full max-w-[82rem] overflow-hidden rounded-lg border border-border"
            onValueChange={(value) =>
              setIsPreviewOpen(value.includes("review"))
            }
          >
            <AcceptanceFormAccordionSection
              sectionId="review"
              title={titleCaseFormLabel(copy.clientFormPreview)}
              status={
                Object.values(errors).some(Boolean)
                  ? "error"
                  : requiredChecks.every(Boolean)
                    ? "complete"
                    : "incomplete"
              }
              statusCopy={accordionStatusCopy}
              onFocus={() => setActiveSectionId("review")}
            >
              <FormReviewPage
                sections={reviewSections}
                title={copy.clientFormPreview}
                showHeader={false}
                showSectionStatus={false}
                showEditActions={false}
                onEdit={(sectionId) =>
                  activateStep(sectionId as ClientFormSectionId)
                }
              />
            </AcceptanceFormAccordionSection>
          </Accordion>
        ) : (
          <Accordion
            multiple
            value={openSectionIds}
            className="cmp-client-form-accordion mx-auto w-full max-w-[82rem] overflow-hidden rounded-lg border border-border"
            onValueChange={updateOpenSections}
          >
            <ClientFormSection
              sectionId="basic"
              title={titleCaseFormLabel(copy.clientFormInformation)}
              status={sectionStatus("basic")}
              statusCopy={accordionStatusCopy}
              onFocus={() => setActiveSectionId("basic")}
              errors={errors}
            >
              <ClientFormSubsection
                title={copy.clientFormBasicInformation}
                description={copy.clientFormBasicDescription}
                className="cmp-form-subsection-first"
              >
                <div className="cmp-form-field-row cmp-form-span-full">
                  <TextField
                    label={copy.clientFormClientCode}
                    fieldId="clientCode"
                    value={form.clientCode}
                    error={errors.clientCode}
                    required
                    onChange={(value) => update("clientCode", value)}
                    onBlur={(value) =>
                      validateIdentifierOnBlur("clientCode", value)
                    }
                  />
                  <TextField
                    label={copy.companyCode}
                    fieldId="companyCode"
                    value={form.companyCode}
                    error={errors.companyCode}
                    required
                    onChange={(value) => update("companyCode", value)}
                    onBlur={(value) =>
                      validateIdentifierOnBlur("companyCode", value)
                    }
                  />
                  <TextField
                    label={copy.clientFormCompanyNameChinese}
                    fieldId="nameZh"
                    value={form.nameZh}
                    error={errors.nameZh}
                    requiredMark
                    onChange={(value) => update("nameZh", value)}
                  />
                </div>
                <div className="cmp-form-field-row cmp-form-span-full">
                  <TextField
                    label={copy.clientFormCompanyNameEnglish}
                    fieldId="nameEn"
                    value={form.nameEn}
                    error={errors.nameEn}
                    requiredMark
                    onChange={(value) => update("nameEn", value)}
                  />
                  <SelectField
                    label={copy.clientFormClientStatus}
                    fieldId="status"
                    value={form.status}
                    error={errors.status}
                    required
                    onBlur={() => validateBlurredField("status")}
                    onChange={(value) =>
                      update("status", value as ClientMasterFormData["status"])
                    }
                  >
                    <option value="">{copy.selectClientStatus}</option>
                    {clientStatusOptions.map((statusOption) => (
                      <option
                        key={statusOption.value}
                        value={statusOption.value}
                      >
                        {statusOption.label}
                      </option>
                    ))}
                  </SelectField>
                  <label htmlFor="cmp-place-of-incorporation">
                    <FieldLabel
                      label={copy.clientFormPlaceOfIncorporation}
                      required
                    />
                    <Input
                      id="cmp-place-of-incorporation"
                      aria-label={copy.clientFormPlaceOfIncorporation}
                      list="cmp-place-of-incorporation-options"
                      value={form.placeOfIncorporation}
                      required
                      data-validation-field="placeOfIncorporation"
                      onChange={(event) =>
                        update("placeOfIncorporation", event.target.value)
                      }
                    />
                    <datalist id="cmp-place-of-incorporation-options">
                      <option value="Hong Kong">
                        {copy.clientFormPlaceOfIncorporationHongKong}
                      </option>
                      <option value="Chinese Mainland">
                        {copy.clientFormPlaceOfIncorporationChineseMainland}
                      </option>
                      <option value="Cayman Islands">
                        {copy.clientFormPlaceOfIncorporationCaymanIslands}
                      </option>
                      <option value="BVI">
                        {copy.clientFormPlaceOfIncorporationBvi}
                      </option>
                    </datalist>
                  </label>
                </div>
              </ClientFormSubsection>

              <ClientFormSubsection title={copy.clientFormIncorporation}>
                <div className="cmp-form-field-row cmp-form-span-full">
                  <SelectField
                    label={copy.clientFormCompanyIdentifierType}
                    fieldId="companyIdentifierType"
                    value={form.companyIdentifierType}
                    required
                    onChange={(value) =>
                      update(
                        "companyIdentifierType",
                        value as CmpCompanyIdentifierType
                      )
                    }
                  >
                    {companyIdentifierTypeOptions(locale).map(
                      (identifierOption) => (
                        <option
                          key={identifierOption.value}
                          value={identifierOption.value}
                        >
                          {identifierOption.label}
                        </option>
                      )
                    )}
                  </SelectField>
                  <TextField
                    label={copy.clientFormCompanyNumber}
                    fieldId="companyNumber"
                    value={form.companyNumber}
                    required
                    onChange={(value) => update("companyNumber", value)}
                    onBlur={(value) =>
                      validateIdentifierOnBlur("companyNumber", value)
                    }
                  />
                  <TextField
                    label={copy.clientFormDateOfIncorporation}
                    type="date"
                    value={form.incorporationYearMonth}
                    onChange={(value) =>
                      update("incorporationYearMonth", value)
                    }
                  />
                </div>
                <div className="cmp-form-field-row cmp-form-span-full">
                  <SelectField
                    label={copy.clientFormCompanyType}
                    value={form.listedOrPrivate}
                    required
                    onChange={(value) => update("listedOrPrivate", value)}
                  >
                    <option value="">{copy.clientFormSelectCompanyType}</option>
                    <option value="PRIVATE">
                      {copy.clientFormCompanyTypePrivate}
                    </option>
                    <option value="OTHER">
                      {copy.clientFormCompanyTypeOther}
                    </option>
                    {form.listedOrPrivate === "LISTED" ? (
                      <option value="LISTED">
                        {copy.clientFormCompanyTypeListedLegacy}
                      </option>
                    ) : null}
                  </SelectField>
                  <SelectField
                    label={copy.clientFormIndustry}
                    fieldId="hsicSectionCode"
                    value={form.hsicSectionCode}
                    error={errors.hsicSectionCode}
                    onChange={(value) => {
                      update("hsicSectionCode", value);
                      if (value !== "OTHER") {
                        update("industryOtherDescription", "");
                      }
                    }}
                  >
                    <option value="">{copy.clientFormNotSet}</option>
                    {CMP_HSIC_SECTION_OPTIONS.map((industryOption) => (
                      <option
                        key={industryOption.code}
                        value={industryOption.code}
                      >
                        {industryOption.code} -{" "}
                        {locale === "zh-CN"
                          ? industryOption.zh
                          : industryOption.en}
                      </option>
                    ))}
                    <option value="OTHER">{copy.clientFormOther}</option>
                  </SelectField>
                  <TextField
                    label={copy.clientFormReportingGaap}
                    fieldId="reportingGaap"
                    value={form.reportingGaap}
                    onChange={(value) => update("reportingGaap", value)}
                  />
                </div>
                {form.hsicSectionCode === "OTHER" ? (
                  <TextAreaField
                    label={copy.clientFormOtherIndustryDescription}
                    fieldId="industryOtherDescription"
                    value={form.industryOtherDescription}
                    error={errors.industryOtherDescription}
                    required
                    onChange={(value) =>
                      update("industryOtherDescription", value)
                    }
                  />
                ) : null}

                <SelectField
                  label={copy.clientFormYearEndMonth}
                  fieldId="yearEndMonth"
                  value={form.yearEndMonth}
                  error={errors.yearEndMonth}
                  required
                  onChange={(value) => update("yearEndMonth", value)}
                >
                  <option value="">{copy.clientFormSelectMonth}</option>
                  {Array.from({ length: 12 }, (_, index) => index + 1).map(
                    (month) => (
                      <option key={month} value={String(month)}>
                        {monthLabel(String(month), locale)}
                      </option>
                    )
                  )}
                </SelectField>
                {form.listedOrPrivate === "OTHER" ? (
                  <TextAreaField
                    label={copy.clientFormOtherCompanyType}
                    value={form.companyTypeOtherDescription}
                    error={errors.companyTypeOtherDescription}
                    required
                    onChange={(value) =>
                      update("companyTypeOtherDescription", value)
                    }
                  />
                ) : null}
              </ClientFormSubsection>

              <ClientFormSubsection title={copy.clientFormListingRegulation}>
                <div className="cmp-form-subsection-grid">
                  {visible.listing ? (
                    <>
                      <SelectField
                        label={copy.clientFormMarketSegment}
                        value={form.marketSegment}
                        onChange={(value) => update("marketSegment", value)}
                      >
                        <option value="">{copy.clientFormNotSet}</option>
                        <option value="MAIN_BOARD">
                          {copy.clientFormMainBoard}
                        </option>
                        <option value="GEM">GEM</option>
                        <option value="OTHERS">{copy.clientFormOthers}</option>
                      </SelectField>
                      <TextField
                        label={copy.clientFormStockExchangeOrListingPlace}
                        value={form.stockExchangeOrListingPlace}
                        onChange={(value) =>
                          update("stockExchangeOrListingPlace", value)
                        }
                      />
                      <TextField
                        label={copy.clientFormStockCode}
                        value={form.stockCode}
                        onChange={(value) => update("stockCode", value)}
                      />
                    </>
                  ) : null}
                  <SelectField
                    label={copy.clientFormRegulatedEntities}
                    value={form.regulatedEntities}
                    onChange={(value) => update("regulatedEntities", value)}
                  >
                    <option value="No">{copy.no}</option>
                    <option value="Yes">{copy.yes}</option>
                    <option value="Unknown">{copy.clientFormUnknown}</option>
                  </SelectField>
                  {visible.regulatedBy ? (
                    <TextField
                      label={copy.clientFormRegulator}
                      value={form.regulatedBy}
                      onChange={(value) => update("regulatedBy", value)}
                    />
                  ) : null}
                </div>
              </ClientFormSubsection>

              <ClientFormSubsection
                title={copy.clientFormAddresses}
                description={copy.clientFormAddressesDescription}
                substepId="addresses"
              >
                <div className="cmp-form-subsection-grid cmp-form-subsection-grid-two">
                  <TextAreaField
                    label={copy.clientFormRegisteredAddress}
                    fieldId="registeredAddress"
                    value={form.registeredAddress}
                    error={errors.registeredAddress}
                    required
                    onChange={(value) => {
                      update("registeredAddress", value);
                      if (form.principalAddressSameAsRegistered) {
                        update("principalBusinessAddress", value);
                      }
                    }}
                  />
                  <PrincipalBusinessAddressField
                    label={copy.clientFormPrincipalBusinessAddress}
                    sameAddressLabel={copy.clientFormSameAsRegisteredAddress}
                    fieldId="principalBusinessAddress"
                    value={form.principalBusinessAddress}
                    error={errors.principalBusinessAddress}
                    required
                    sameAsRegistered={form.principalAddressSameAsRegistered}
                    onSameAsRegisteredChange={(checked) => {
                      update("principalAddressSameAsRegistered", checked);
                      if (checked) {
                        update(
                          "principalBusinessAddress",
                          form.registeredAddress
                        );
                      }
                    }}
                    onChange={(value) =>
                      update("principalBusinessAddress", value)
                    }
                  />
                </div>
                <ClientAdditionalAddressDataGrid
                  addresses={form.additionalAddresses}
                  copy={copy}
                  onChange={(addresses) =>
                    update("additionalAddresses", addresses)
                  }
                />
              </ClientFormSubsection>

              <ClientContactDataGrid
                contacts={form.contacts}
                copy={copy}
                onChange={(contacts) => update("contacts", contacts)}
              />

              <div className="cmp-form-span-full cmp-form-remarks-field">
                <div className="cmp-form-subsection-grid">
                  <TextField
                    label={copy.clientFormReferredBy}
                    fieldId="referredBy"
                    value={form.referredBy}
                    onChange={(value) => update("referredBy", value)}
                  />
                  <div className="cmp-form-span-full">
                    <TextAreaField
                      label={copy.clientFormRemarks}
                      fieldId="remarks"
                      value={form.remarks}
                      onChange={(value) => update("remarks", value)}
                    />
                  </div>
                </div>
              </div>
            </ClientFormSection>

            <ClientFormSection
              sectionId="relationships"
              title={titleCaseFormLabel(copy.clientFormGroupRelationship)}
              status={sectionStatus("relationships")}
              statusCopy={accordionStatusCopy}
              onFocus={() => setActiveSectionId("relationships")}
              errors={errors}
            >
              <RelatedPartiesDraftEditor form={form} onChange={update} />
            </ClientFormSection>

            <ClientFormSection
              sectionId="aml"
              title={locale === "zh-CN" ? "AML 筛查" : "AML Screening"}
              status={sectionStatus("aml")}
              statusCopy={accordionStatusCopy}
              onFocus={() => setActiveSectionId("aml")}
              errors={errors}
            >
              <CmpAmlScreeningSection
                acceptanceId={acceptanceDraftId}
                active={activeSectionId === "aml"}
                onEnsureDraft={ensureDraftForAml}
                onStatusChange={(status, summary) => {
                  setAmlStepStatus(status);
                  setAmlReviewSummary(summary);
                }}
              />
            </ClientFormSection>

            <ClientFormSection
              sectionId="responsible"
              title={titleCaseFormLabel(copy.clientFormResponsibleAndServices)}
              status={sectionStatus("responsible")}
              statusCopy={accordionStatusCopy}
              onFocus={() => setActiveSectionId("responsible")}
              errors={errors}
            >
              <ClientFormSubsection
                title={copy.clientFormClientOwnership}
                description={copy.clientFormResponsibleAndServicesDescription}
                className="cmp-form-subsection-first"
              >
                <div className="cmp-form-subsection-grid">
                  <ResponsibleUserSelect
                    label={copy.clientFormClientLeadingPartner}
                    fieldId="clientLeadingPartnerId"
                    users={responsibleUsers}
                    preferredRoles={["PARTNER", "PRINCIPAL"]}
                    value={form.clientLeadingPartnerId}
                    legacyValue={form.clientLeadingPartner}
                    error={errors.clientLeadingPartnerId}
                    required
                    onBlur={() =>
                      validateBlurredField("clientLeadingPartnerId")
                    }
                    onChange={(value) =>
                      updateResponsibleUser(
                        "clientLeadingPartnerId",
                        "clientLeadingPartner",
                        value
                      )
                    }
                  />
                  <ResponsibleUserSelect
                    label={copy.clientFormPic}
                    fieldId="clientPartnerPicId"
                    users={responsibleUsers}
                    preferredRoles={["PARTNER", "PRINCIPAL"]}
                    value={form.clientPartnerPicId}
                    legacyValue={form.clientPartnerPic}
                    error={errors.clientPartnerPicId}
                    required
                    onBlur={() => validateBlurredField("clientPartnerPicId")}
                    onChange={(value) =>
                      updateResponsibleUser(
                        "clientPartnerPicId",
                        "clientPartnerPic",
                        value
                      )
                    }
                  />
                  <ResponsibleUserSelect
                    label={copy.clientFormMic}
                    fieldId="clientManagerMicId"
                    users={responsibleUsers}
                    preferredRoles={["MANAGER"]}
                    value={form.clientManagerMicId}
                    legacyValue={form.clientManagerMic}
                    error={errors.clientManagerMicId}
                    required
                    onBlur={() => validateBlurredField("clientManagerMicId")}
                    onChange={(value) =>
                      updateResponsibleUser(
                        "clientManagerMicId",
                        "clientManagerMic",
                        value
                      )
                    }
                  />
                  <ResponsibleUserSelect
                    label={copy.clientFormSecondMic}
                    fieldId="alternativePartnerSecondMicId"
                    users={responsibleUsers}
                    preferredRoles={["PARTNER", "PRINCIPAL", "MANAGER"]}
                    value={form.alternativePartnerSecondMicId}
                    legacyValue={form.alternativePartnerSecondMic}
                    onBlur={() =>
                      validateBlurredField("alternativePartnerSecondMicId")
                    }
                    onChange={(value) =>
                      updateResponsibleUser(
                        "alternativePartnerSecondMicId",
                        "alternativePartnerSecondMic",
                        value
                      )
                    }
                  />
                </div>
              </ClientFormSubsection>
              <ClientFormSubsection title={copy.clientFormExpectedServices}>
                <ClientServiceTypeCheckboxGroup
                  selectedServiceTypes={selectedServiceTypes}
                  error={errors.serviceType}
                  required
                  onToggle={toggleServiceType}
                />
                {selectedServiceTypes.includes("Others") ? (
                  <TextAreaField
                    label={copy.clientFormExpectedEngagementType}
                    value={form.expectedJobOrEngagementType}
                    error={errors.expectedJobOrEngagementType}
                    required
                    onChange={(value) =>
                      update("expectedJobOrEngagementType", value)
                    }
                  />
                ) : null}
              </ClientFormSubsection>
            </ClientFormSection>
            <AcceptanceFormPreviewNavigationItem
              title={titleCaseFormLabel(copy.clientFormPreview)}
              status={
                Object.values(errors).some(Boolean)
                  ? "error"
                  : requiredChecks.every(Boolean)
                    ? "complete"
                    : "incomplete"
              }
              onSelect={() => activateStep("review")}
            />
          </Accordion>
        )}
      </AcceptanceFormWorkspace>

      {usesHeaderActions ? null : (
        <div className="cmp-form-actions">
          <span className="cmp-form-save-state">
            {savedAt ? `Draft saved at ${savedAt}` : copy.clientFormSaveState}
          </span>
          <ButtonGroup>
            <Button
              type="button"
              className="cmp-secondary-button"
              disabled={isBusy || actionFeedback.isRunning}
              onClick={requestCancel}
            >
              {copy.cancel}
            </Button>
            {requiresRouting ? (
              <Button
                type="button"
                className="cmp-secondary-button"
                disabled={isBusy || actionFeedback.isRunning}
                onClick={() => submit("draft")}
              >
                {draftLabel}
              </Button>
            ) : null}
            {activeSectionId === "basic" ? null : (
              <Button
                type="button"
                className="cmp-secondary-button"
                disabled={isBusy || actionFeedback.isRunning}
                onClick={goToPreviousStep}
              >
                {copy.formPrevious}
              </Button>
            )}
            <Button
              type="submit"
              className="cmp-primary-button"
              disabled={isBusy || actionFeedback.isRunning}
            >
              {isBusy || actionFeedback.isRunning
                ? "Saving..."
                : allowIncompleteSubmit
                  ? submitLabel
                  : activeSectionId === "review"
                    ? submitLabel
                    : activeSectionId === "responsible"
                      ? reviewLabel
                      : copy.formNext}
            </Button>
          </ButtonGroup>
        </div>
      )}
      {usesHeaderActions && memberActionDialog ? (
        <ClientFormMemberActionDialog
          open
          actionKind={memberActionDialog}
          isBusy={isBusy || actionFeedback.isRunning}
          users={
            memberActionDialog === "assign" ? staffUsers : submitTargetUsers
          }
          copy={{
            title:
              memberActionDialog === "assign"
                ? copy.assignDialogTitle
                : copy.submitDialogTitle,
            actionLabel:
              memberActionDialog === "assign"
                ? copy.assignAction
                : copy.submitAction,
            emptyLabel: copy.memberDialogNoResults,
            memberColumn: copy.memberDialogMemberColumn,
            rankColumn: copy.memberDialogRankColumn,
            roleColumn: copy.memberDialogRoleColumn,
            actionsColumn: copy.memberDialogActionsColumn,
            memberCountOne: copy.memberDialogMemberCountOne,
            memberCountOther: copy.memberDialogMemberCountOther,
            searchLabel: copy.memberDialogSearch,
          }}
          onOpenChange={(open) => {
            if (!open) {
              setMemberActionDialog(null);
            }
          }}
          onConfirm={(user) => {
            setMemberActionDialog(null);
            if (memberActionDialog === "assign") {
              suppressedAutoSaveSnapshotRef.current = JSON.stringify({
                form,
                draftAssigneeId: user.id,
                draftName: normalizedDraftName,
              });
              setDraftAssigneeId(user.id);
              void submit("assign", undefined, { draftAssigneeId: user.id });
              return;
            }
            setForm((current) => ({
              ...current,
              clientManagerMicId: user.id,
              clientManagerMic: user.name,
            }));
            void submit("submit", undefined, { micApprover: user });
          }}
        />
      ) : null}
      {companyIdentityConflict ? (
        <CompanyIdentityConflictDialog
          open
          zh={locale === "zh-CN"}
          busy={actionFeedback.isRunning}
          match={companyIdentityConflict.match}
          current={{
            displayName: form.nameEn || form.nameZh,
            nameEn: form.nameEn,
            nameZh: form.nameZh,
            identifierType: form.companyIdentifierType,
            identifierValue: form.companyNumber,
            jurisdiction: form.placeOfIncorporation,
            incorporationDate: form.incorporationYearMonth,
            companyType: form.listedOrPrivate,
            registeredAddress: form.registeredAddress,
            principalBusinessAddress: form.principalBusinessAddress,
          }}
          onCancel={() => setCompanyIdentityConflict(null)}
          onResolve={(resolution) => {
            const { submitAfterResolution } = companyIdentityConflict;
            setForm((current) => ({
              ...current,
              companyIdentityResolution: resolution,
            }));
            setCompanyIdentityConflict(null);
            if (submitAfterResolution) {
              void submit("submit", resolution);
            }
          }}
        />
      ) : null}
      <CmpAsyncActionFeedback feedback={actionFeedback.feedback} />
    </form>
  );
}

type ClientContactSource = {
  id?: string | null;
  name?: string | null;
  position?: string | null;
  department?: string | null;
  officePhone?: string | null;
  mobile?: string | null;
  email?: string | null;
  remarks?: string | null;
};

function clientContactFormRows(
  contacts: readonly ClientContactSource[] | undefined,
  legacy: ClientContactSource
): ClientContactFormRow[] {
  const source =
    contacts === undefined
      ? Object.values(legacy).some((value) => Boolean(value?.trim()))
        ? [legacy]
        : []
      : contacts;
  return source.map((contact, index) => ({
    id: contact.id ?? "",
    key: contact.id ?? `draft-contact-${index}`,
    name: contact.name ?? "",
    position: contact.position ?? "",
    department: contact.department ?? "",
    officePhone: contact.officePhone ?? "",
    mobile: contact.mobile ?? "",
    email: contact.email ?? "",
    remarks: contact.remarks ?? "",
  }));
}

export function clientMasterFormFromClient(
  client: CmpClient,
  routing?: Partial<ClientMasterFormData>
): ClientMasterFormData {
  const registeredAddress =
    client.addresses?.find((address) => address.type === "REGISTERED")
      ?.address ??
    client.address ??
    "";
  const principalBusinessAddress =
    client.addresses?.find((address) => address.type === "PRINCIPAL")
      ?.address ??
    client.address ??
    "";
  return {
    ...EMPTY_CLIENT_MASTER_FORM,
    clientCode: client.clientCode,
    companyCode: client.companyCode ?? "",
    companyIdentifierType:
      client.companyIdentifierType ?? "COMPANY_REGISTRATION_NUMBER",
    companyNumber: client.companyNumber ?? "",
    groupMode:
      client.groupId || client.groupMode === "HAS_GROUP"
        ? "HAS_GROUP"
        : "NO_GROUP",
    groupId: client.groupId ?? "",
    groupName: client.groupName ?? client.group?.nameZh ?? "",
    status: client.status,
    nameEn: client.nameEn ?? "",
    nameZh: client.nameZh ?? "",
    contactPerson: client.contactPerson ?? "",
    contacts: clientContactFormRows(
      client.contacts?.length ? client.contacts : undefined,
      {
        name: client.contactPerson,
        position: client.contactPosition,
        department: client.contactDepartment,
        officePhone: client.telephone,
        mobile: client.contactMobile,
        email: client.email,
        remarks: client.contactRemarks,
      }
    ),
    telephone: client.telephone ?? "",
    email: client.email ?? "",
    website: client.website ?? "",
    yearEndDate: client.yearEndDate ?? "",
    yearEndMonth: client.yearEndMonth
      ? String(client.yearEndMonth)
      : legacyYearEndMonth(client.yearEndDate),
    hsicSectionCode: client.hsicSectionCode ?? "",
    industryOtherDescription: client.industryOtherDescription ?? "",
    reportingGaap: client.reportingGaap ?? "",
    address: client.address ?? "",
    registeredAddress,
    principalBusinessAddress,
    principalAddressSameAsRegistered:
      client.principalAddressSameAsRegistered ??
      registeredAddress === principalBusinessAddress,
    additionalAddresses: (client.addresses ?? [])
      .filter((address) => address.type === "OTHER")
      .map((address) => ({
        id: address.id,
        key: address.id,
        label: address.label ?? "",
        address: address.address,
      })),
    contactPosition: client.contactPosition ?? "",
    contactDepartment: client.contactDepartment ?? "",
    contactMobile: client.contactMobile ?? "",
    contactRemarks: client.contactRemarks ?? "",
    placeOfIncorporation: client.placeOfIncorporation ?? "",
    incorporationYearMonth: client.incorporationYearMonth ?? "",
    listedOrPrivate: client.listedOrPrivate ?? "",
    companyTypeOtherDescription: client.companyTypeOtherDescription ?? "",
    marketSegment: client.marketSegment ?? "",
    stockExchangeOrListingPlace: client.stockExchangeOrListingPlace ?? "",
    stockCode: client.stockCode ?? "",
    regulatedEntities: client.regulatedEntities ?? "No",
    regulatedBy: client.regulatedBy ?? "",
    isSubsidiary: client.isSubsidiary ?? false,
    parentClientCode: client.parentClientCode ?? "",
    parentHoldingCompanyName: client.parentHoldingCompanyName ?? "",
    hasSubsidiariesOrAssociates: client.hasSubsidiariesOrAssociates ?? false,
    subsidiariesOrAssociates: client.subsidiariesOrAssociates ?? "",
    isUltimateParent: Boolean(client.isUltimateParentOfGroupId),
    wasUltimateParent: Boolean(client.isUltimateParentOfGroupId),
    groupRelationships: (client.relationships ?? []).map((relationship) => {
      const currentIsFrom = relationship.fromClientId === client.id;
      return {
        key: relationship.id,
        relationshipId: relationship.id,
        groupId: relationship.groupId,
        action: "UPSERT" as const,
        type: relationship.type,
        direction: currentIsFrom
          ? ("FROM_CLIENT" as const)
          : ("TO_CLIENT" as const),
        counterpartClientId: currentIsFrom
          ? relationship.toClientId
          : relationship.fromClientId,
        ownershipPercentage: relationship.ownershipPercentage?.toString() ?? "",
        effectiveFrom: relationship.effectiveFrom ?? "",
        effectiveTo: "",
        remarks: relationship.remarks ?? "",
      };
    }),
    referredBy:
      client.referredBy === "Not set" ? "" : (client.referredBy ?? ""),
    clientPartnerPicId: client.clientPartnerPicId ?? "",
    clientPartnerPic: client.clientPartnerPic ?? "",
    clientLeadingPartnerId: client.clientLeadingPartnerId ?? "",
    clientLeadingPartner: client.clientLeadingPartner ?? "",
    clientManagerMicId: client.clientManagerMicId ?? "",
    clientManagerMic: client.clientManagerMic ?? "",
    alternativePartnerSecondMicId: client.alternativePartnerSecondMicId ?? "",
    alternativePartnerSecondMic: client.alternativePartnerSecondMic ?? "",
    expectedJobOrEngagementType: client.expectedJobOrEngagementType ?? "",
    serviceType: client.serviceType ?? "",
    serviceLines: client.serviceLines ?? "",
    approvalReferenceNumber: client.approvalReferenceNumber ?? "",
    approvalDate: client.approvalDate ?? "",
    taxServiceDetails: client.taxServiceDetails ?? "",
    comSecServiceDetails: client.comSecServiceDetails ?? "",
    otherServiceDescription: client.otherServiceDescription ?? "",
    remarks: client.remarks ?? "",
    ...routing,
  };
}

export function clientMasterFormFromPayload(
  payload?:
    | CmpClientAcceptanceDraftPayload
    | Partial<CreateCmpClientInput>
    | null,
  routing?: Partial<ClientMasterFormData>,
  currentClient?: CmpClient
): ClientMasterFormData {
  const groupMode =
    payload?.groupMode === "HAS_GROUP" || payload?.groupId
      ? "HAS_GROUP"
      : "NO_GROUP";
  const groupStructure =
    payload && "groupStructure" in payload ? payload.groupStructure : undefined;
  const approvedUltimateParent = Boolean(
    currentClient?.isUltimateParentOfGroupId
  );
  const isUltimateParent =
    groupStructure?.ultimateParentAction === "SET_CURRENT"
      ? true
      : groupStructure?.ultimateParentAction === "CLEAR"
        ? false
        : approvedUltimateParent;
  const payloadContacts = payload?.contacts;
  return {
    ...EMPTY_CLIENT_MASTER_FORM,
    ...payload,
    yearEndMonth: payload?.yearEndMonth
      ? String(payload.yearEndMonth)
      : legacyYearEndMonth(payload?.yearEndDate),
    hsicSectionCode:
      payload?.hsicSectionCode ?? currentClient?.hsicSectionCode ?? "",
    industryOtherDescription:
      payload?.industryOtherDescription ??
      currentClient?.industryOtherDescription ??
      "",
    reportingGaap: payload?.reportingGaap ?? currentClient?.reportingGaap ?? "",
    incorporationYearMonth:
      payload?.incorporationYearMonth ??
      currentClient?.incorporationYearMonth ??
      "",
    registeredAddress:
      payload?.registeredAddress ??
      currentClient?.addresses?.find((address) => address.type === "REGISTERED")
        ?.address ??
      payload?.address ??
      currentClient?.address ??
      "",
    principalBusinessAddress:
      payload?.principalBusinessAddress ??
      currentClient?.addresses?.find((address) => address.type === "PRINCIPAL")
        ?.address ??
      payload?.address ??
      currentClient?.address ??
      "",
    principalAddressSameAsRegistered:
      payload?.principalAddressSameAsRegistered ??
      currentClient?.principalAddressSameAsRegistered ??
      Boolean(payload?.address ?? currentClient?.address),
    additionalAddresses: (
      payload?.additionalAddresses ??
      currentClient?.addresses?.filter((address) => address.type === "OTHER") ??
      []
    ).map((address, index) => ({
      id: address.id ?? "",
      key: address.id ?? `draft-address-${index}`,
      label: address.label ?? "",
      address: address.address ?? "",
    })),
    contacts: clientContactFormRows(
      payloadContacts === undefined
        ? currentClient?.contacts?.length
          ? currentClient.contacts
          : undefined
        : payloadContacts,
      {
        name: payload?.contactPerson ?? currentClient?.contactPerson,
        position: payload?.contactPosition ?? currentClient?.contactPosition,
        department:
          payload?.contactDepartment ?? currentClient?.contactDepartment,
        officePhone: payload?.telephone ?? currentClient?.telephone,
        mobile: payload?.contactMobile ?? currentClient?.contactMobile,
        email: payload?.email ?? currentClient?.email,
        remarks: payload?.contactRemarks ?? currentClient?.contactRemarks,
      }
    ),
    contactPosition:
      payload?.contactPosition ?? currentClient?.contactPosition ?? "",
    contactDepartment:
      payload?.contactDepartment ?? currentClient?.contactDepartment ?? "",
    contactMobile: payload?.contactMobile ?? currentClient?.contactMobile ?? "",
    contactRemarks:
      payload?.contactRemarks ?? currentClient?.contactRemarks ?? "",
    entityMapChoice: readEntityMap(payload)?.choice ?? "",
    entityMapId: readEntityMap(payload)?.mapId ?? "",
    entityMapNodeId: readEntityMap(payload)?.nodeId ?? "",
    relatedEntities:
      (payload as CmpClientAcceptanceDraftPayload | undefined)
        ?.relatedEntities ?? [],
    relatedRelationships:
      (payload as CmpClientAcceptanceDraftPayload | undefined)
        ?.relatedRelationships ?? [],
    relatedGroupRelationships:
      (payload as CmpClientAcceptanceDraftPayload | undefined)
        ?.relatedGroupRelationships ?? [],
    removedGroupRelationshipIds:
      (payload as CmpClientAcceptanceDraftPayload | undefined)
        ?.removedGroupRelationshipIds ?? [],
    groupMode,
    groupId: groupStructure?.primaryGroupId ?? payload?.groupId ?? "",
    isUltimateParent,
    wasUltimateParent: approvedUltimateParent,
    groupRelationships: (groupStructure?.relationships ?? []).map(
      (relationship, index) => ({
        key: relationship.relationshipId ?? `draft-${index}`,
        relationshipId: relationship.relationshipId ?? "",
        groupId: relationship.groupId,
        action: relationship.action,
        type: relationship.type ?? "SUBSIDIARY",
        direction: relationship.direction ?? "TO_CLIENT",
        counterpartClientId: relationship.counterpartClientId ?? "",
        ownershipPercentage: relationship.ownershipPercentage?.toString() ?? "",
        effectiveFrom: relationship.effectiveFrom ?? "",
        effectiveTo: relationship.effectiveTo ?? "",
        remarks: relationship.remarks ?? "",
      })
    ),
    status: payload?.status ?? currentClient?.status ?? "",
    listedOrPrivate:
      payload?.listedOrPrivate ?? currentClient?.listedOrPrivate ?? "",
    companyTypeOtherDescription:
      payload?.companyTypeOtherDescription ??
      currentClient?.companyTypeOtherDescription ??
      "",
    regulatedEntities: payload?.regulatedEntities ?? "No",
    remarks: payload?.remarks ?? "",
    referredBy:
      payload?.referredBy === "Not set"
        ? ""
        : (payload?.referredBy ?? currentClient?.referredBy ?? ""),
    ...routing,
  };
}

function ClientServiceTypeCheckboxGroup({
  selectedServiceTypes,
  error,
  required,
  disabled,
  onToggle,
}: {
  selectedServiceTypes: readonly ClientServiceType[];
  error?: string;
  required?: boolean;
  disabled?: boolean;
  onToggle: (serviceType: ClientServiceType) => void;
}) {
  const { dictionary } = useCmpI18n();
  const copy = dictionary.workspace;
  const errorId = error ? validationErrorId("serviceType") : undefined;
  return (
    <fieldset
      className={`cmp-service-type-field cmp-field-span-2${error ? " cmp-field-invalid" : ""}`}
      aria-describedby={errorId}
    >
      <legend>
        <FieldLabel label={copy.serviceType} required={required} />
      </legend>
      <div className="cmp-service-type-options">
        {CLIENT_SERVICE_TYPE_OPTIONS.map((serviceType, index) => {
          const checked = selectedServiceTypes.includes(serviceType);
          const serviceTypeLabel =
            serviceType === "Annual Audit"
              ? copy.clientFormServiceAnnualAudit
              : serviceType === "Review"
                ? copy.clientFormServiceReview
                : serviceType ===
                    "Special audit for private co. (with audit opinion issued)"
                  ? copy.clientFormServiceSpecialAudit
                  : copy.clientFormOthers;
          return (
            <label
              key={serviceType}
              className={`cmp-service-type-option${checked ? " is-selected" : ""}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                aria-invalid={Boolean(error)}
                data-validation-field={index === 0 ? "serviceType" : undefined}
                onChange={() => onToggle(serviceType)}
              />
              <span>{serviceTypeLabel}</span>
            </label>
          );
        })}
      </div>
      {error ? (
        <span className="cmp-field-error" id={errorId}>
          {error}
        </span>
      ) : null}
    </fieldset>
  );
}

function ClientFormSection({
  sectionId,
  title,
  status,
  statusCopy,
  errors,
  onFocus,
  children,
}: {
  sectionId: ClientFormSectionId;
  title: string;
  status: CmpFormSectionStatus;
  statusCopy: AcceptanceFormAccordionStatusCopy;
  errors: FormErrors;
  onFocus: () => void;
  children: ReactNode;
}) {
  return (
    <AcceptanceFormAccordionSection
      sectionId={sectionId}
      title={title}
      status={status}
      statusCopy={statusCopy}
      onFocus={onFocus}
    >
      <ClientFormErrorsContext.Provider value={errors}>
        <AcceptanceFormSectionContent>{children}</AcceptanceFormSectionContent>
      </ClientFormErrorsContext.Provider>
    </AcceptanceFormAccordionSection>
  );
}

function ClientFormSubsection({
  title,
  description,
  className,
  substepId,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  substepId?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`cmp-form-subsection cmp-form-span-full${className ? ` ${className}` : ""}`}
      data-client-form-substep={substepId}
    >
      <header className="cmp-form-subsection-heading">
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

function DraftAssignmentPanel({
  compact = false,
  controlsOnly = false,
  assigneeId,
  users,
  isBusy,
  ownerLabel,
  onAssigneeChange,
  onAssign,
}: {
  compact?: boolean;
  controlsOnly?: boolean;
  assigneeId: string;
  users: DirectoryUser[];
  isBusy?: boolean;
  ownerLabel: string;
  onAssigneeChange: (value: string) => void;
  onAssign: () => void;
}) {
  const { dictionary } = useCmpI18n();
  const copy = dictionary.workspace;
  const assignee = users.find((user) => user.id === assigneeId);
  if (controlsOnly) {
    return (
      <div className="cmp-header-assignment-controls flex shrink-0 items-center gap-1.5">
        <MotionButton
          type="button"
          aria-label={
            assignee
              ? `${copy.assignedToAction} ${assignee.name}`
              : copy.assignAction
          }
          className={`h-7 cursor-pointer px-2.5 text-xs! ${
            assignee
              ? "border-muted-foreground/10! bg-muted! text-foreground! shadow-none! hover:bg-muted/80!"
              : ""
          }`}
          disabled={isBusy}
          size="sm"
          variant="secondary"
          onClick={onAssign}
        >
          {assignee ? (
            <span className="inline-flex items-center gap-1.5 font-normal">
              <span className="text-muted-foreground">
                {copy.assignedToAction}
              </span>
              <MemberDirectoryCompactIdentity name={assignee.name} />
            </span>
          ) : (
            copy.assignAction
          )}
        </MotionButton>
      </div>
    );
  }
  return (
    <section
      className={`cmp-draft-assignment-panel${compact ? " cmp-header-assignment-panel" : ""}`}
    >
      <div className="cmp-draft-assignment-copy">
        <span className="cmp-workflow-label">{copy.draftAssignment}</span>
        <strong>
          {assignee
            ? copy.staffWillCompleteDraft.replace("{staff}", assignee.name)
            : ownerLabel}
        </strong>
        <p>{copy.draftAssignmentDescription}</p>
      </div>
      <label>
        <span>{copy.staffMember}</span>
        <NativeSelect
          value={assigneeId}
          onChange={(event) => onAssigneeChange(event.target.value)}
        >
          <option value="">{copy.selectStaff}</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </NativeSelect>
      </label>
      <Button
        type="button"
        className="cmp-secondary-button cmp-assignment-action"
        disabled={isBusy || !assigneeId}
        onClick={onAssign}
      >
        {copy.saveAndAssign}
      </Button>
    </section>
  );
}

function FieldLabel({
  label,
  required,
  requirement,
}: {
  label: string;
  required?: boolean;
  requirement?: string;
}) {
  return (
    <span className="cmp-field-label">
      <span>
        {label}
        {required ? (
          <span aria-hidden="true" className="cmp-required-mark">
            {" "}
            *
          </span>
        ) : null}
      </span>
      {requirement ? (
        <small aria-hidden="true" className="cmp-field-requirement">
          {requirement}
        </small>
      ) : null}
    </span>
  );
}

function useClientFieldValidation(
  label: string,
  fieldId?: string,
  explicitError?: string
) {
  const errors = useContext(ClientFormErrorsContext);
  const field = fieldId ?? CLIENT_FIELD_KEY_BY_LABEL[label] ?? label;
  const error = explicitError ?? errors[field];
  return {
    error,
    field,
    errorId: error ? validationErrorId(field) : undefined,
  };
}

function TextField({
  label,
  fieldId,
  value,
  onChange,
  onBlur,
  type = "text",
  placeholder,
  error,
  invalid,
  describedBy,
  required,
  requiredMark,
  requirement,
}: {
  label: string;
  fieldId?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  invalid?: boolean;
  describedBy?: string;
  required?: boolean;
  requiredMark?: boolean;
  requirement?: string;
}) {
  const validation = useClientFieldValidation(label, fieldId, error);
  const isInvalid = Boolean(validation.error || invalid);
  return (
    <label className={isInvalid ? "cmp-field-invalid" : undefined}>
      <FieldLabel
        label={label}
        required={required || requiredMark}
        requirement={requirement}
      />
      <Input
        aria-label={label}
        aria-describedby={
          [validation.errorId, describedBy].filter(Boolean).join(" ") ||
          undefined
        }
        aria-invalid={isInvalid}
        data-validation-field={validation.field}
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onBlur?.(event.currentTarget.value)}
      />
      {validation.error ? (
        <span className="cmp-field-error" id={validation.errorId}>
          {validation.error}
        </span>
      ) : null}
    </label>
  );
}

function _NumberField(props: Omit<Parameters<typeof TextField>[0], "type">) {
  return <TextField {...props} type="number" />;
}

function TextAreaField({
  label,
  fieldId,
  value,
  onChange,
  error,
  required,
  disabled,
}: {
  label: string;
  fieldId?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const validation = useClientFieldValidation(label, fieldId, error);
  return (
    <label
      className={`cmp-field-span-2${validation.error ? " cmp-field-invalid" : ""}`}
    >
      <FieldLabel label={label} required={required} />
      <Textarea
        aria-label={label}
        aria-describedby={validation.errorId}
        aria-invalid={Boolean(validation.error)}
        data-validation-field={validation.field}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      {validation.error ? (
        <span className="cmp-field-error" id={validation.errorId}>
          {validation.error}
        </span>
      ) : null}
    </label>
  );
}

function PrincipalBusinessAddressField({
  label,
  sameAddressLabel,
  fieldId,
  value,
  onChange,
  onSameAsRegisteredChange,
  error,
  required,
  sameAsRegistered,
}: {
  label: string;
  sameAddressLabel: string;
  fieldId: string;
  value: string;
  onChange: (value: string) => void;
  onSameAsRegisteredChange: (value: boolean) => void;
  error?: string;
  required?: boolean;
  sameAsRegistered: boolean;
}) {
  const validation = useClientFieldValidation(label, fieldId, error);
  return (
    <div
      className={`cmp-principal-address-field cmp-field-span-2${validation.error ? " cmp-field-invalid" : ""}`}
    >
      <div className="cmp-principal-address-heading">
        <FieldLabel label={label} required={required} />
        <label className="cmp-checkbox-field cmp-principal-address-toggle">
          <input
            type="checkbox"
            checked={sameAsRegistered}
            onChange={(event) => onSameAsRegisteredChange(event.target.checked)}
          />
          <span>{sameAddressLabel}</span>
        </label>
      </div>
      {sameAsRegistered ? null : (
        <>
          <Textarea
            aria-label={label}
            aria-describedby={validation.errorId}
            aria-invalid={Boolean(validation.error)}
            data-validation-field={validation.field}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          {validation.error ? (
            <span className="cmp-field-error" id={validation.errorId}>
              {validation.error}
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}

function SelectField({
  label,
  fieldId,
  value,
  onChange,
  error,
  required,
  disabled,
  onBlur,
  children,
}: {
  label: string;
  fieldId?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  onBlur?: () => void;
  children: ReactNode;
}) {
  const validation = useClientFieldValidation(label, fieldId, error);
  return (
    <label className={validation.error ? "cmp-field-invalid" : undefined}>
      <FieldLabel label={label} required={required} />
      <NativeSelect
        aria-label={label}
        aria-describedby={validation.errorId}
        aria-invalid={Boolean(validation.error)}
        data-validation-field={validation.field}
        value={value}
        required={required}
        disabled={disabled}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </NativeSelect>
      {validation.error ? (
        <span className="cmp-field-error" id={validation.errorId}>
          {validation.error}
        </span>
      ) : null}
    </label>
  );
}

function _BooleanSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <SelectField
      label={label}
      value={value ? "Yes" : "No"}
      onChange={(next) => onChange(next === "Yes")}
    >
      <option value="No">No</option>
      <option value="Yes">Yes</option>
    </SelectField>
  );
}

function _ApproverSelect({
  label,
  users,
  value,
  error,
  onChange,
}: {
  label: string;
  users: DirectoryUser[];
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <SelectField label={label} value={value} error={error} onChange={onChange}>
      <option value="">Select user</option>
      {users.map((user) => (
        <option key={user.id} value={user.id}>
          {user.name} / {user.globalRole.replaceAll("_", " ")}
        </option>
      ))}
    </SelectField>
  );
}

function ResponsibleUserSelect({
  label,
  fieldId,
  users,
  preferredRoles,
  value,
  legacyValue,
  error,
  required,
  disabled,
  onBlur,
  onChange,
}: {
  label: string;
  fieldId: string;
  users: DirectoryUser[];
  preferredRoles: DirectoryUser["globalRole"][];
  value: string;
  legacyValue?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  onBlur?: () => void;
  onChange: (value: string) => void;
}) {
  const { dictionary } = useCmpI18n();
  const copy = dictionary.workspace;
  const orderedUsers = [...users].sort((left, right) => {
    const leftPreferred = preferredRoles.includes(left.globalRole) ? 0 : 1;
    const rightPreferred = preferredRoles.includes(right.globalRole) ? 0 : 1;
    if (leftPreferred !== rightPreferred) {
      return leftPreferred - rightPreferred;
    }
    return left.name.localeCompare(right.name);
  });

  return (
    <SearchSelect
      label={label}
      fieldId={fieldId}
      value={value}
      required={required}
      disabled={disabled}
      error={error}
      hint={
        !value && legacyValue
          ? copy.clientFormLegacyResponsibleValue.replace("{name}", legacyValue)
          : undefined
      }
      placeholder={copy.selectStaff}
      searchPlaceholder="Search name or role..."
      options={orderedUsers.map((user) => ({
        value: user.id,
        label: user.name,
        description: user.globalRole.replaceAll("_", " "),
        keywords: `${user.name} ${user.globalRole}`,
      }))}
      onChange={onChange}
      onBlur={onBlur}
    />
  );
}

export function getVisibleClientFields(form: ClientMasterFormData) {
  return {
    group: form.groupMode === "HAS_GROUP",
    listing: form.listedOrPrivate === "LISTED",
    regulatedBy: form.regulatedEntities === "Yes",
    parent: form.isSubsidiary,
    subsidiaries: form.hasSubsidiariesOrAssociates,
    serviceType: true,
    auditApproval: false,
    approvalDate: false,
    taxDetails: false,
    comSecDetails: false,
    otherService: false,
  };
}

export function validateClientForm(
  form: ClientMasterFormData,
  options: {
    requiresRouting: boolean;
    messages?: Record<ClientRequiredField, string>;
  }
) {
  const errors: FormErrors = {};
  const messages = options.messages ?? clientRequiredFieldMessages["en-US"];
  (
    Object.keys(CLIENT_REQUIRED_FIELDS_BY_SECTION) as ClientFormSectionId[]
  ).forEach((sectionId) => {
    clientRequiredFields(sectionId, options.requiresRouting, form).forEach(
      (field) => {
        if (!isClientRequiredFieldComplete(form, field)) {
          errors[field] = messages[field];
        }
      }
    );
  });
  if (!form.nameEn.trim() && !form.nameZh.trim()) {
    errors.nameZh = messages.nameEn;
  }
  form.additionalAddresses.forEach((address, index) => {
    const hasLabel = Boolean(address.label.trim());
    const hasAddress = Boolean(address.address.trim());
    if (hasLabel !== hasAddress) {
      const field = hasLabel
        ? `additionalAddresses.${index}.address`
        : `additionalAddresses.${index}.label`;
      errors[field] = hasLabel
        ? "Enter the additional address."
        : "Enter an address label.";
    }
  });
  Object.assign(errors, validateClientGroupRelationships(form, true));
  return errors;
}

function validateClientGroupRelationships(
  form: ClientMasterFormData,
  requireComplete: boolean
) {
  const errors: FormErrors = {};
  if (
    form.groupMode === "HAS_GROUP" &&
    !form.groupId.trim() &&
    requireComplete
  ) {
    errors.groupId = "Select a primary Group before submitting.";
  }
  if (form.isUltimateParent && form.groupMode !== "HAS_GROUP") {
    errors.isUltimateParent =
      "An Ultimate Parent must belong to a primary Group.";
  }
  form.groupRelationships.forEach((relationship, index) => {
    const prefix = `groupRelationships.${index}`;
    if (relationship.action === "END") {
      if (requireComplete && !relationship.effectiveTo) {
        errors[`${prefix}.effectiveTo`] =
          "An end date is required for a relationship being ended.";
      } else if (isFutureDate(relationship.effectiveTo)) {
        errors[`${prefix}.effectiveTo`] =
          "Relationship end date cannot be in the future.";
      }
      return;
    }
    if (requireComplete && !relationship.counterpartClientId) {
      errors[`${prefix}.counterpartClientId`] = "Select a related Client.";
    }
    if (requireComplete && !relationship.effectiveFrom) {
      errors[`${prefix}.effectiveFrom`] = "Effective date is required.";
    } else if (isFutureDate(relationship.effectiveFrom)) {
      errors[`${prefix}.effectiveFrom`] =
        "Relationship effective date cannot be in the future.";
    }
    if (relationship.ownershipPercentage) {
      const ownership = Number(relationship.ownershipPercentage);
      if (!Number.isFinite(ownership) || ownership < 0 || ownership > 100) {
        errors[`${prefix}.ownershipPercentage`] =
          "Ownership percentage must be between 0 and 100.";
      }
    }
    if (
      relationship.type === "SUBSIDIARY" &&
      form.groupMode !== "HAS_GROUP" &&
      requireComplete
    ) {
      errors[`${prefix}.type`] =
        "Subsidiary relationships require a primary Group.";
    }
  });
  return errors;
}

function isFutureDate(value: string) {
  return Boolean(value && value > new Date().toISOString().slice(0, 10));
}

export function validateClientIdentifiers(
  form: Pick<ClientMasterFormData, "clientCode" | "companyNumber"> &
    Partial<Pick<ClientMasterFormData, "companyCode">> &
    Partial<Pick<ClientMasterFormData, "companyIdentifierType">>,
  clients: CmpClient[],
  excludeClientId?: string | null
): FormErrors {
  const errors: FormErrors = {};
  const clientCode = form.clientCode.trim().toLowerCase();
  const comparableClients = clients.filter(
    (client) => client.id !== excludeClientId
  );
  if (
    clientCode &&
    comparableClients.some(
      (client) => client.clientCode.trim().toLowerCase() === clientCode
    )
  ) {
    errors.clientCode = "This Client Code is already in use.";
  }
  const companyCode = form.companyCode?.trim().toLowerCase() ?? "";
  if (
    companyCode &&
    comparableClients.some(
      (client) => client.companyCode?.trim().toLowerCase() === companyCode
    )
  ) {
    errors.companyCode = "This Company Code is already in use.";
  }
  return errors;
}

function validateClientDraftPayload(
  payload: CmpClientAcceptanceDraftPayload
): FormErrors {
  const result = CmpClientAcceptanceDraftPayloadSchema.safeParse(payload);
  if (result.success) {
    return {};
  }
  return schemaIssuesToErrors<keyof FormErrors & string>(result.error.issues);
}

export function buildClientPayload(
  form: ClientMasterFormData
): CmpClientAcceptanceDraftPayload {
  const visible = getVisibleClientFields(form);
  const serviceTypes = parseClientServiceTypes(
    form.serviceLines,
    form.serviceType
  );
  const serviceLines = serializeClientServiceTypes(serviceTypes);
  const contacts = form.contacts.map((contact, index) => ({
    id: cleanText(contact.id),
    name: cleanText(contact.name),
    position: cleanText(contact.position),
    department: cleanText(contact.department),
    officePhone: cleanText(contact.officePhone),
    mobile: cleanText(contact.mobile),
    email: cleanText(contact.email),
    remarks: cleanText(contact.remarks),
    sortOrder: index,
  }));
  const [primaryContact] = contacts;
  const payload: CmpClientAcceptanceDraftPayload = {
    clientCode: form.clientCode.trim(),
    companyCode: cleanText(form.companyCode),
    companyIdentifierType: form.companyIdentifierType,
    companyNumber: cleanText(form.companyNumber),
    companyIdentityResolution: form.companyIdentityResolution,
    relatedEntities: form.relatedEntities,
    relatedRelationships: form.relatedRelationships,
    relatedGroupRelationships: form.relatedGroupRelationships,
    removedGroupRelationshipIds: form.removedGroupRelationshipIds,
    status: form.status || undefined,
    nameEn: cleanText(form.nameEn),
    nameZh: cleanText(form.nameZh),
    contactPerson: primaryContact?.name,
    telephone: primaryContact?.officePhone,
    email: primaryContact?.email,
    contacts,
    website: cleanText(form.website),
    yearEndDate: cleanText(form.yearEndDate),
    yearEndMonth: form.yearEndMonth ? Number(form.yearEndMonth) : undefined,
    hsicSectionCode:
      form.hsicSectionCode === "OTHER" ||
      CMP_HSIC_SECTION_OPTIONS.some(
        (option) => option.code === form.hsicSectionCode
      )
        ? (form.hsicSectionCode as CmpHsicSectionCode)
        : undefined,
    industryOtherDescription:
      form.hsicSectionCode === "OTHER"
        ? cleanText(form.industryOtherDescription)
        : undefined,
    reportingGaap: cleanText(form.reportingGaap),
    address: cleanText(form.registeredAddress),
    registeredAddress: cleanText(form.registeredAddress),
    principalBusinessAddress: cleanText(form.principalBusinessAddress),
    principalAddressSameAsRegistered: form.principalAddressSameAsRegistered,
    additionalAddresses: form.additionalAddresses.map((address, index) => ({
      id: cleanText(address.id),
      label: cleanText(address.label) ?? "",
      address: cleanText(address.address) ?? "",
      sortOrder: index,
    })),
    contactPosition: primaryContact?.position,
    contactDepartment: primaryContact?.department,
    contactMobile: primaryContact?.mobile,
    contactRemarks: primaryContact?.remarks,
    placeOfIncorporation: cleanText(form.placeOfIncorporation),
    incorporationYearMonth: cleanText(form.incorporationYearMonth),
    listedOrPrivate: cleanText(form.listedOrPrivate),
    companyTypeOtherDescription:
      form.listedOrPrivate === "OTHER"
        ? cleanText(form.companyTypeOtherDescription)
        : undefined,
    marketSegment: visible.listing ? cleanText(form.marketSegment) : undefined,
    stockExchangeOrListingPlace: visible.listing
      ? cleanText(form.stockExchangeOrListingPlace)
      : undefined,
    stockCode: visible.listing ? cleanText(form.stockCode) : undefined,
    regulatedEntities: form.regulatedEntities,
    regulatedBy: visible.regulatedBy ? cleanText(form.regulatedBy) : undefined,
    isSubsidiary: form.isSubsidiary,
    parentClientCode: visible.parent
      ? cleanText(form.parentClientCode)
      : undefined,
    parentHoldingCompanyName: visible.parent
      ? cleanText(form.parentHoldingCompanyName)
      : undefined,
    hasSubsidiariesOrAssociates: form.hasSubsidiariesOrAssociates,
    subsidiariesOrAssociates: visible.subsidiaries
      ? cleanText(form.subsidiariesOrAssociates)
      : undefined,
    referredBy: cleanText(form.referredBy),
    clientPartnerPicId: cleanText(form.clientPartnerPicId),
    clientPartnerPic: cleanText(form.clientPartnerPic),
    clientLeadingPartnerId: cleanText(form.clientLeadingPartnerId),
    clientLeadingPartner: cleanText(form.clientLeadingPartner),
    clientManagerMicId: cleanText(form.clientManagerMicId),
    clientManagerMic: cleanText(form.clientManagerMic),
    alternativePartnerSecondMicId: cleanText(
      form.alternativePartnerSecondMicId
    ),
    alternativePartnerSecondMic: cleanText(form.alternativePartnerSecondMic),
    expectedJobOrEngagementType: serviceTypes.includes("Others")
      ? cleanText(form.expectedJobOrEngagementType)
      : undefined,
    serviceType: visible.serviceType ? serviceTypes[0] : undefined,
    serviceLines: visible.serviceType ? cleanText(serviceLines) : undefined,
    approvalReferenceNumber: visible.auditApproval
      ? cleanText(form.approvalReferenceNumber)
      : undefined,
    approvalDate: visible.approvalDate
      ? cleanText(form.approvalDate)
      : undefined,
    taxServiceDetails: visible.taxDetails
      ? cleanText(form.taxServiceDetails)
      : undefined,
    comSecServiceDetails: visible.comSecDetails
      ? cleanText(form.comSecServiceDetails)
      : undefined,
    otherServiceDescription: visible.otherService
      ? cleanText(form.otherServiceDescription)
      : undefined,
    remarks: cleanText(form.remarks),
    preparedBy: undefined,
    approvedBy: undefined,
    micApproval: undefined,
    picApproval: undefined,
    itAdmin: undefined,
    signOffDate: undefined,
  };
  if (
    form.entityMapChoice === "YES" &&
    form.entityMapId &&
    form.entityMapNodeId
  ) {
    payload.entityMap = {
      choice: "YES",
      mapId: form.entityMapId,
      nodeId: form.entityMapNodeId,
    };
  }
  return payload;
}

function cleanText(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed || undefined;
}

function readEntityMap(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("entityMap" in payload)) {
    return;
  }
  const value = (
    payload as {
      entityMap?: {
        choice?: "YES" | "NO" | null;
        mapId?: string;
        nodeId?: string;
      };
    }
  ).entityMap;
  return value ?? undefined;
}

function RelatedPartiesDraftEditor({
  form,
  onChange,
}: {
  form: ClientMasterFormData;
  onChange: <K extends keyof ClientMasterFormData>(
    key: K,
    value: ClientMasterFormData[K]
  ) => void;
}) {
  const { locale, dictionary } = useCmpI18n();
  const zh = locale === "zh-CN";
  const copy = dictionary.workspace;
  const [editingEntity, setEditingEntity] = useState<{
    kind: "COMPANY" | "PERSON";
    entity?: CmpRelatedEntityDraft;
  } | null>(null);
  const [relationshipDialogOpen, setRelationshipDialogOpen] = useState(false);
  const [editingRelationship, setEditingRelationship] =
    useState<CmpEntityRelationshipDraft>();
  const [groupRelationshipDialogOpen, setGroupRelationshipDialogOpen] =
    useState(false);
  const [editingGroupRelationship, setEditingGroupRelationship] =
    useState<CmpGroupRelationshipDraft>();
  const entityName = (key: string) =>
    key === "ROOT"
      ? form.nameEn ||
        form.nameZh ||
        form.clientCode ||
        (zh ? "当前客户" : "Current client")
      : (form.relatedEntities.find((entity) => entity.draftKey === key)
          ?.displayName ?? key);
  const saveEntity = (entity: CmpRelatedEntityDraft) => {
    const exists = form.relatedEntities.some(
      (item) => item.draftKey === entity.draftKey
    );
    onChange(
      "relatedEntities",
      exists
        ? form.relatedEntities.map((item) =>
            item.draftKey === entity.draftKey ? entity : item
          )
        : [...form.relatedEntities, entity]
    );
    setEditingEntity(null);
  };
  const removeEntity = (draftKey: string) => {
    const removedGroupRelationshipIds = form.relatedGroupRelationships
      .filter((item) => draftGroupRelationshipReferences(item, draftKey))
      .flatMap((item) =>
        item.existingRelationshipId ? [item.existingRelationshipId] : []
      );
    onChange(
      "relatedEntities",
      form.relatedEntities.filter((item) => item.draftKey !== draftKey)
    );
    onChange(
      "relatedRelationships",
      form.relatedRelationships.filter(
        (item) => !draftRelationshipReferences(item, draftKey)
      )
    );
    onChange(
      "relatedGroupRelationships",
      form.relatedGroupRelationships.filter(
        (item) => !draftGroupRelationshipReferences(item, draftKey)
      )
    );
    if (removedGroupRelationshipIds.length > 0) {
      onChange("removedGroupRelationshipIds", [
        ...new Set([
          ...form.removedGroupRelationshipIds,
          ...removedGroupRelationshipIds,
        ]),
      ]);
    }
  };
  const companies = form.relatedEntities.filter(
    (entity) => entity.kind === "COMPANY"
  );
  const people = form.relatedEntities.filter(
    (entity) => entity.kind === "PERSON"
  );
  const legacy = form.relatedEntities.filter(
    (entity) => entity.kind !== "COMPANY" && entity.kind !== "PERSON"
  );
  const structureGraph = useMemo(
    () => buildRelatedPartyStructureGraph(form, zh),
    [form, zh]
  );

  return (
    <div className="col-span-full space-y-8">
      <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-5">
        <div>
          <div>
            <h3 className="text-base font-semibold">
              {copy.clientFormRelatedParties}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {copy.clientFormRelatedPartiesDescription}
            </p>
          </div>
        </div>
        <ClientRelatedPartyDataGrid
          kind="COMPANY"
          entities={companies}
          copy={copy}
          companyTypeLabel={(value) => draftCompanyTypeLabel(value, zh)}
          onAdd={() => setEditingEntity({ kind: "COMPANY" })}
          onEdit={(entity) => setEditingEntity({ kind: "COMPANY", entity })}
          onRemove={removeEntity}
        />
        <ClientRelatedPartyDataGrid
          kind="PERSON"
          entities={people}
          copy={copy}
          companyTypeLabel={(value) => draftCompanyTypeLabel(value, zh)}
          onAdd={() => setEditingEntity({ kind: "PERSON" })}
          onEdit={(entity) => setEditingEntity({ kind: "PERSON", entity })}
          onRemove={removeEntity}
        />
        {legacy.length > 0 ? (
          <div className="rounded-xl border p-4">
            <p className="mb-3 text-sm font-medium">
              {zh ? "历史主体（兼容数据）" : "Legacy parties"}
            </p>
            {legacy.map((entity) => (
              <div
                key={entity.draftKey}
                className="flex items-center justify-between border-t py-2 text-sm"
              >
                <span>{entity.displayName}</span>
                <span className="text-muted-foreground">
                  {entityKindLabel(entity.kind, zh)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-5">
        <ClientRelationshipDataGrid
          relationships={form.relatedRelationships}
          copy={copy}
          entityName={entityName}
          relationshipRefKey={relationshipRefKey}
          onAdd={() => {
            setEditingRelationship(undefined);
            setRelationshipDialogOpen(true);
          }}
          onEdit={(relationship) => {
            setEditingRelationship(relationship);
            setRelationshipDialogOpen(true);
          }}
          onRemove={(draftKey) =>
            onChange(
              "relatedRelationships",
              form.relatedRelationships.filter(
                (item) => item.draftKey !== draftKey
              )
            )
          }
        />
        <GroupRelationshipDraftTable
          relationships={form.relatedGroupRelationships}
          copy={copy}
          entityName={entityName}
          relationshipRefKey={relationshipRefKey}
          onAdd={() => {
            setEditingGroupRelationship(undefined);
            setGroupRelationshipDialogOpen(true);
          }}
          onEdit={(relationship) => {
            setEditingGroupRelationship(relationship);
            setGroupRelationshipDialogOpen(true);
          }}
          onRemove={(draftKey) => {
            const relationship = form.relatedGroupRelationships.find(
              (item) => item.draftKey === draftKey
            );
            onChange(
              "relatedGroupRelationships",
              form.relatedGroupRelationships.filter(
                (item) => item.draftKey !== draftKey
              )
            );
            if (relationship?.existingRelationshipId) {
              onChange("removedGroupRelationshipIds", [
                ...new Set([
                  ...form.removedGroupRelationshipIds,
                  relationship.existingRelationshipId,
                ]),
              ]);
            }
          }}
        />
        <DerivedUboDraftSection
          form={form}
          copy={copy}
          entityName={entityName}
        />
      </section>

      <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-5">
        <div>
          <h3 className="text-base font-semibold">
            {copy.clientFormEntityStructure}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {copy.clientFormEntityStructureDescription}
          </p>
        </div>
        <CmpEntityStructureGraph
          graph={structureGraph}
          zh={zh}
          className="h-[460px]"
        />
      </section>

      {editingEntity ? (
        <DraftEntityDialog
          open
          kind={editingEntity.kind}
          entity={editingEntity.entity}
          zh={zh}
          onOpenChange={(open) => !open && setEditingEntity(null)}
          onSave={saveEntity}
        />
      ) : null}
      {relationshipDialogOpen ? (
        <DraftRelationshipDialog
          open
          relationship={editingRelationship}
          form={form}
          copy={copy}
          entityName={entityName}
          onOpenChange={(open) => {
            if (open) {
              return;
            }
            setRelationshipDialogOpen(false);
            setEditingRelationship(undefined);
          }}
          onSave={(relationship) => {
            const exists = form.relatedRelationships.some(
              (item) => item.draftKey === relationship.draftKey
            );
            onChange(
              "relatedRelationships",
              exists
                ? form.relatedRelationships.map((item) =>
                    item.draftKey === relationship.draftKey
                      ? relationship
                      : item
                  )
                : [...form.relatedRelationships, relationship]
            );
            setRelationshipDialogOpen(false);
            setEditingRelationship(undefined);
          }}
        />
      ) : null}
      {groupRelationshipDialogOpen ? (
        <DraftGroupRelationshipDialog
          open
          relationship={editingGroupRelationship}
          form={form}
          copy={copy}
          entityName={entityName}
          onOpenChange={(open) => {
            if (open) {
              return;
            }
            setGroupRelationshipDialogOpen(false);
            setEditingGroupRelationship(undefined);
          }}
          onSave={(relationship) => {
            const exists = form.relatedGroupRelationships.some(
              (item) => item.draftKey === relationship.draftKey
            );
            onChange(
              "relatedGroupRelationships",
              exists
                ? form.relatedGroupRelationships.map((item) =>
                    item.draftKey === relationship.draftKey
                      ? relationship
                      : item
                  )
                : [...form.relatedGroupRelationships, relationship]
            );
            setGroupRelationshipDialogOpen(false);
            setEditingGroupRelationship(undefined);
          }}
        />
      ) : null}
    </div>
  );
}

function PartyReferenceSelect({
  value,
  label,
  rootLabel,
  entities,
  includeRoot = true,
  onChange,
}: {
  value: string;
  label: string;
  rootLabel: string;
  entities: CmpRelatedEntityDraft[];
  includeRoot?: boolean;
  onChange: (value: string) => void;
}) {
  const selectedLabel =
    value === "ROOT"
      ? rootLabel
      : entities.find((entity) => entity.draftKey === value)?.displayName;
  return (
    <Select
      value={value || null}
      onValueChange={(next) => onChange(next ?? "")}
    >
      <SelectTrigger className="w-full" aria-label={label}>
        <SelectValue placeholder={label}>{selectedLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {includeRoot ? <SelectItem value="ROOT">{rootLabel}</SelectItem> : null}
        {entities.map((entity) => (
          <SelectItem key={entity.draftKey} value={entity.draftKey}>
            {entity.displayName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function relationshipTargetKindAllowed(
  _type: CmpEntityRelationshipDraft["type"],
  kind: CmpEntityKind
) {
  return kind === "COMPANY";
}

function relationshipRefKey(ref: CmpEntityRelationshipDraft["fromRef"]) {
  return ref.type === "ROOT"
    ? "ROOT"
    : ref.type === "DRAFT"
      ? ref.draftKey
      : ref.entityId;
}

export function buildRelatedPartyStructureGraph(
  form: Pick<
    ClientMasterFormData,
    | "clientCode"
    | "nameEn"
    | "nameZh"
    | "relatedEntities"
    | "relatedRelationships"
    | "relatedGroupRelationships"
  >,
  zh: boolean
): CmpClientGraph {
  const rootId = "ROOT";
  const nodeIdByDraftKey = new Map(
    form.relatedEntities.map((entity) => [
      entity.draftKey,
      entity.existingEntityId ?? entity.draftKey,
    ])
  );
  const nodes: CmpClientGraph["nodes"] = [
    {
      id: rootId,
      kind: "COMPANY",
      displayName:
        form.nameEn ||
        form.nameZh ||
        form.clientCode ||
        (zh ? "当前客户" : "Current client"),
      nameZh: form.nameZh || null,
      nameEn: form.nameEn || null,
      jurisdiction: null,
      registrationNumber: null,
      status: "ACTIVE",
      role: "ROOT",
      isRoot: true,
      clientIds: [],
    },
    ...form.relatedEntities.map((entity) => ({
      id: nodeIdByDraftKey.get(entity.draftKey) ?? entity.draftKey,
      kind: entity.kind,
      displayName: entity.displayName,
      nameZh: entity.nameZh || null,
      nameEn: entity.nameEn || null,
      jurisdiction: entity.jurisdiction || null,
      registrationNumber: entity.registrationNumber || null,
      status: entity.status,
      role: "RELATED" as const,
      isRoot: false,
      clientIds: [],
    })),
  ];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const resolveRef = (ref: CmpEntityRelationshipDraft["fromRef"]) => {
    if (ref.type === "ROOT") {
      return rootId;
    }
    if (ref.type === "DRAFT") {
      return nodeIdByDraftKey.get(ref.draftKey) ?? ref.draftKey;
    }
    return ref.entityId;
  };
  const toDateTime = (value?: string | null) =>
    value ? `${value}T00:00:00.000Z` : null;
  const edges: CmpClientGraph["edges"] = form.relatedRelationships
    .map((relationship) => ({
      id: relationship.draftKey,
      fromEntityId: resolveRef(relationship.fromRef),
      toEntityId: resolveRef(relationship.toRef),
      type: relationship.type,
      ownershipPercentage: relationship.ownershipPercentage ?? null,
      effectiveFrom: toDateTime(relationship.effectiveFrom),
      effectiveTo: toDateTime(relationship.effectiveTo),
      remarks: relationship.remarks || null,
      sourceDocument: relationship.sourceDocument || null,
    }))
    .filter(
      (edge) =>
        edge.fromEntityId !== edge.toEntityId &&
        nodeIds.has(edge.fromEntityId) &&
        nodeIds.has(edge.toEntityId)
    );
  const groupRelationships: CmpClientGraph["groupRelationships"] =
    form.relatedGroupRelationships
      .map((relationship) => ({
        id: relationship.draftKey,
        targetEntityId: resolveRef(relationship.targetRef),
        type: relationship.type,
        effectiveFrom: toDateTime(relationship.effectiveFrom),
        effectiveTo: null,
        sourceDocument: relationship.sourceDocument || null,
        remarks: relationship.remarks || null,
        participants: relationship.participants.map((participant) => ({
          entityId: resolveRef(participant.entityRef),
          method: participant.method,
          ownershipPercentage: participant.ownershipPercentage ?? null,
          otherDescription: participant.otherDescription || null,
        })),
        createdAt: "1970-01-01T00:00:00.000Z",
        updatedAt: "1970-01-01T00:00:00.000Z",
      }))
      .filter(
        (relationship) =>
          nodeIds.has(relationship.targetEntityId) &&
          relationship.participants.length > 0 &&
          relationship.participants.every(
            (participant) =>
              participant.entityId !== relationship.targetEntityId &&
              nodeIds.has(participant.entityId)
          )
      );

  return {
    client: {
      id: form.clientCode || "draft-client",
      clientCode: form.clientCode || "DRAFT",
      rootEntityId: rootId,
    },
    asOf: "1970-01-01",
    nodes,
    edges,
    groupRelationships,
  };
}

function draftRelationshipReferences(
  relationship: CmpEntityRelationshipDraft,
  draftKey: string
) {
  return (
    (relationship.fromRef.type === "DRAFT" &&
      relationship.fromRef.draftKey === draftKey) ||
    (relationship.toRef.type === "DRAFT" &&
      relationship.toRef.draftKey === draftKey)
  );
}

function draftGroupRelationshipReferences(
  relationship: CmpGroupRelationshipDraft,
  draftKey: string
) {
  return (
    (relationship.targetRef.type === "DRAFT" &&
      relationship.targetRef.draftKey === draftKey) ||
    relationship.participants.some(
      (participant) =>
        participant.entityRef.type === "DRAFT" &&
        participant.entityRef.draftKey === draftKey
    )
  );
}

function entityKindLabel(kind: CmpRelatedEntityDraft["kind"], zh: boolean) {
  const labels = {
    COMPANY: zh ? "公司" : "Company",
    PERSON: zh ? "个人" : "Individual",
    TRUST: zh ? "信托" : "Trust",
    PARTNERSHIP: zh ? "合伙" : "Partnership",
    OTHER_ORGANISATION: zh ? "其他组织" : "Other organisation",
  };
  return labels[kind];
}

export function EntityMapRelationshipPicker({
  form,
  onChange,
}: {
  form: ClientMasterFormData;
  onChange: (
    key: "entityMapChoice" | "entityMapId" | "entityMapNodeId",
    value: string
  ) => void;
}) {
  const { dictionary } = useCmpI18n();
  const copy = dictionary.workspace;
  const [maps, setMaps] = useState<CmpEntityMap[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    let isActive = true;
    setLoading(true);
    void api
      .cmpEntityMaps()
      .then((result) => {
        if (isActive) {
          setMaps(result.maps);
        }
      })
      .catch(() => {
        if (isActive) {
          setMaps([]);
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });
    return () => {
      isActive = false;
    };
  }, []);
  const createMap = () => {
    const name = window.prompt(copy.clientFormMapName);
    if (!name?.trim()) {
      return;
    }
    setCreating(true);
    void api
      .createCmpEntityMap({ name: name.trim() })
      .then((map) => {
        setMaps((current) => [map, ...current]);
        onChange("entityMapId", map.id);
      })
      .finally(() => setCreating(false));
  };
  return (
    <div className="cmp-form-span-full space-y-4 rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold">
            {copy.clientFormGroupRelationshipMap}
          </p>
          <p className="text-xs text-muted-foreground">
            {copy.clientFormGroupRelationshipMapDescription}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => window.open("/maps", "_blank")}
        >
          {copy.clientFormOpenMaps}
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label={copy.clientFormHasRelationshipMap}
          value={form.entityMapChoice}
          onChange={(value) => {
            onChange("entityMapChoice", value);
            if (value !== "YES") {
              onChange("entityMapId", "");
              onChange("entityMapNodeId", "");
            }
          }}
        >
          <option value="">{copy.clientFormNotSet}</option>
          <option value="YES">{copy.yes}</option>
          <option value="NO">{copy.no}</option>
        </SelectField>
        {form.entityMapChoice === "YES" ? (
          <div className="space-y-1.5">
            <p className="text-sm font-semibold">
              {copy.clientFormRelationshipMap}
            </p>
            <div className="flex gap-2">
              <NativeSelect
                className="flex-1"
                value={form.entityMapId}
                onChange={(event) =>
                  onChange("entityMapId", event.target.value)
                }
              >
                <option value="">
                  {loading
                    ? copy.clientFormLoadingMaps
                    : copy.clientFormSelectMap}
                </option>
                {maps.map((map) => (
                  <option key={map.id} value={map.id}>
                    {map.name}
                  </option>
                ))}
              </NativeSelect>
              <Button
                type="button"
                variant="outline"
                disabled={creating}
                onClick={createMap}
              >
                {copy.clientFormNewMap}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      {form.entityMapChoice === "YES" && !form.entityMapId ? (
        <p className="text-xs text-muted-foreground">
          {copy.clientFormRelationshipMapOptional}
        </p>
      ) : null}
    </div>
  );
}
