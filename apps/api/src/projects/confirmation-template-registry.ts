import type {
  ConfirmationDraftPayload,
  ConfirmationDraftTemplateCode,
  ConfirmationType,
} from "@project-wing/shared";

export type ConfirmationTemplateDefinition = {
  confirmationType: ConfirmationType;
  typeCode: string;
  rendererVersion: string;
  requiredEditableFields: readonly ConfirmationTemplateFieldKey[];
  thirdPartyField: ConfirmationTemplateFieldKey;
  displayName?: string;
  fileName?: string;
  editableFields?: readonly ConfirmationTemplateFieldDefinition[];
};

export type ConfirmationTemplateFieldKey =
  | keyof ConfirmationDraftPayload
  | "recipientName"
  | "recipientAddress"
  | "yearEndDate"
  | "accountNumber"
  | "micName"
  | "micEmail"
  | "micNameAndInitial"
  | "salutation";

export type ConfirmationTemplateFieldDefinition = {
  key: ConfirmationTemplateFieldKey;
  prompt: string;
};

export type RegisteredConfirmationTemplateCode = ConfirmationDraftTemplateCode;

const HK_STANDARD_EDITABLE_FIELDS = [
  { key: "recipientName", prompt: "To The Manager" },
  { key: "bankName", prompt: "Bank Name" },
  { key: "officeDate", prompt: "Office Date" },
  { key: "referenceCode", prompt: "Reference Code" },
  { key: "clientName", prompt: "Client Name" },
  { key: "reportDate", prompt: "Report Date" },
  { key: "auditorName", prompt: "Auditor Name" },
  { key: "auditorAddress", prompt: "Auditor Address" },
  { key: "authorizationAccount", prompt: "Authorization Account Number" },
  { key: "salutation", prompt: "Salutation" },
] as const satisfies readonly ConfirmationTemplateFieldDefinition[];
const SECURITIES_TYPE_1_EDITABLE_FIELDS = [
  { key: "referenceCode", prompt: "Reference" },
  { key: "officeDate", prompt: "Date" },
  { key: "recipientName", prompt: "Recipient Name" },
  { key: "recipientAddress", prompt: "Recipient Address" },
  { key: "salutation", prompt: "Salutation" },
  { key: "clientName", prompt: "Client Name" },
  { key: "auditorName", prompt: "Auditor Name" },
  { key: "yearEndDate", prompt: "Year End Date" },
  { key: "accountNumber", prompt: "Account Number" },
  { key: "auditorAddress", prompt: "Auditor Address" },
  { key: "micName", prompt: "MIC Name" },
] as const satisfies readonly ConfirmationTemplateFieldDefinition[];
const SECURITIES_TYPE_2_EDITABLE_FIELDS = [
  { key: "referenceCode", prompt: "Reference" },
  { key: "officeDate", prompt: "Date" },
  { key: "recipientName", prompt: "Recipient Name" },
  { key: "recipientAddress", prompt: "Recipient Address" },
  { key: "salutation", prompt: "Salutation" },
  { key: "clientName", prompt: "Client Name" },
  { key: "auditorName", prompt: "Auditor Name" },
  { key: "auditorAddress", prompt: "Auditor Address" },
  { key: "micEmail", prompt: "MIC Email" },
  { key: "micNameAndInitial", prompt: "MIC Name and Initial" },
  { key: "yearEndDate", prompt: "Year End Date" },
] as const satisfies readonly ConfirmationTemplateFieldDefinition[];
const CONFIRMATION_TEMPLATE_DEFINITIONS: Record<
  RegisteredConfirmationTemplateCode,
  ConfirmationTemplateDefinition
> = {
  PRC_BANK_TEMPLATE_1: {
    confirmationType: "BANK",
    typeCode: "BANK",
    rendererVersion: "bank-prc-v1",
    requiredEditableFields: ["bankName"],
    thirdPartyField: "bankName",
  },
  PRC_BANK_TEMPLATE_2: {
    confirmationType: "BANK",
    typeCode: "BANK",
    rendererVersion: "bank-prc-v2",
    requiredEditableFields: ["bankName"],
    thirdPartyField: "bankName",
  },
  SHINEWING_ENG_BANK: {
    confirmationType: "BANK",
    typeCode: "BANK",
    rendererVersion: "bank-shinewing-eng-v1",
    requiredEditableFields: ["bankName"],
    thirdPartyField: "bankName",
  },
  STANDARD_FINANCIAL_INSTITUTION: {
    confirmationType: "BANK",
    typeCode: "BANK",
    rendererVersion: "financial-institution-hk-standard-v1",
    requiredEditableFields: ["bankName"],
    thirdPartyField: "bankName",
    editableFields: HK_STANDARD_EDITABLE_FIELDS,
  },
  BANK_CONFIRMATION_HK_STANDARD_ENGLISH: {
    confirmationType: "BANK",
    typeCode: "BANK",
    rendererVersion: "bank-confirmation-hk-standard-english-v1",
    requiredEditableFields: ["bankName"],
    thirdPartyField: "bankName",
    displayName: "Bank Confirmation - HK Standard (English)",
    fileName: "bank-confirmation-hk-standard-english.docx",
    editableFields: HK_STANDARD_EDITABLE_FIELDS,
  },
  SECURITIES_CONFIRMATION_ENGLISH_TYPE_1: {
    confirmationType: "INTERMEDIARY",
    typeCode: "INTERMEDIARY",
    rendererVersion: "securities-english-type-1-v1",
    requiredEditableFields: ["recipientName"],
    thirdPartyField: "recipientName",
    displayName: "Securities Confirmation - English - Type 1",
    fileName: "securities-confirmation-english-type-1.docx",
    editableFields: SECURITIES_TYPE_1_EDITABLE_FIELDS,
  },
  SECURITIES_CONFIRMATION_ENGLISH_TYPE_2: {
    confirmationType: "INTERMEDIARY",
    typeCode: "INTERMEDIARY",
    rendererVersion: "securities-english-type-2-v1",
    requiredEditableFields: ["recipientName"],
    thirdPartyField: "recipientName",
    displayName: "Securities Confirmation - English - Type 2",
    fileName: "securities-confirmation-english-type-2.docx",
    editableFields: SECURITIES_TYPE_2_EDITABLE_FIELDS,
  },
};
const ACTIVE_CONFIRMATION_TEMPLATE_CODES =
  new Set<RegisteredConfirmationTemplateCode>();

export function getConfirmationTemplateDefinition(
  code: RegisteredConfirmationTemplateCode
) {
  return CONFIRMATION_TEMPLATE_DEFINITIONS[code];
}

export function isConfirmationTemplateAvailableForNewDrafts(
  code: RegisteredConfirmationTemplateCode
) {
  return ACTIVE_CONFIRMATION_TEMPLATE_CODES.has(code);
}
