import type { ConfirmationDraftTemplateCode } from "@project-wing/shared";

import type {
  ConfirmationTemplateDesignFieldBinding,
  ConfirmationTemplateDesignSchema,
} from "./confirmation-template-library.service";

type TextFieldInput = {
  binding: ConfirmationTemplateDesignFieldBinding;
  height: number;
  id: string;
  name: string;
  placeholder: string;
  width: number;
  x: number;
  y: number;
};

function textField(input: TextFieldInput) {
  return {
    ...input,
    kind: "TEXT" as const,
    options: [],
    page: 1,
  };
}

const STANDARD_HEADER_FIELDS = [
  textField({
    binding: "recipientName",
    height: 0.018,
    id: "confirmation-to-the-manager",
    name: "Recipient",
    placeholder: "To the Manager",
    width: 0.32,
    x: 0.122,
    y: 0.138,
  }),
  textField({
    binding: "bankName",
    height: 0.0135,
    id: "confirmation-bank-office",
    name: "Bank office",
    placeholder: "Bank Office",
    width: 0.292,
    x: 0.122,
    y: 0.1675,
  }),
  textField({
    binding: "officeDate",
    height: 0.0135,
    id: "confirmation-office-date",
    name: "Office date",
    placeholder: "Date",
    width: 0.328,
    x: 0.565,
    y: 0.1675,
  }),
  textField({
    binding: "referenceCode",
    height: 0.0135,
    id: "confirmation-reference-code",
    name: "Reference",
    placeholder: "Ref",
    width: 0.328,
    x: 0.565,
    y: 0.1825,
  }),
  textField({
    binding: "clientName",
    height: 0.018,
    id: "confirmation-client-name",
    name: "Client",
    placeholder: "Customer's name",
    width: 0.328,
    x: 0.564,
    y: 0.364,
  }),
] as const;
const HK_STANDARD_FIELDS = [
  ...STANDARD_HEADER_FIELDS,
  textField({
    binding: "salutation",
    height: 0.018,
    id: "confirmation-hk-salutation",
    name: "Salutation",
    placeholder: "Sir / Madam",
    width: 0.28,
    x: 0.16,
    y: 0.222,
  }),
  textField({
    binding: "reportDate",
    height: 0.018,
    id: "confirmation-report-date",
    name: "Report date",
    placeholder: "Report date",
    width: 0.134,
    x: 0.564,
    y: 0.402,
  }),
  textField({
    binding: "auditorName",
    height: 0.019,
    id: "confirmation-auditor-name-hk",
    name: "Auditor name",
    placeholder: "Auditor name",
    width: 0.31,
    x: 0.122,
    y: 0.5245,
  }),
  textField({
    binding: "auditorAddress",
    height: 0.019,
    id: "confirmation-auditor-address-hk",
    name: "Auditor address",
    placeholder: "Auditor address",
    width: 0.44,
    x: 0.122,
    y: 0.542,
  }),
  textField({
    binding: "authorizationAccount",
    height: 0.019,
    id: "confirmation-authorization-account",
    name: "Authorization account",
    placeholder: "Account number",
    width: 0.136,
    x: 0.758,
    y: 0.5705,
  }),
] as const;
const SECURITIES_TYPE_1_FIELDS = [
  textField({
    binding: "referenceCode",
    height: 0.022,
    id: "confirmation-securities-reference",
    name: "Reference",
    placeholder: "Reference",
    width: 0.25,
    x: 0.15,
    y: 0.084,
  }),
  textField({
    binding: "officeDate",
    height: 0.022,
    id: "confirmation-securities-date",
    name: "Date",
    placeholder: "Date",
    width: 0.25,
    x: 0.15,
    y: 0.112,
  }),
  textField({
    binding: "recipientName",
    height: 0.022,
    id: "confirmation-securities-recipient-name",
    name: "Recipient name",
    placeholder: "Recipient Name",
    width: 0.42,
    x: 0.16,
    y: 0.14,
  }),
  textField({
    binding: "recipientAddress",
    height: 0.022,
    id: "confirmation-securities-recipient-address",
    name: "Recipient address",
    placeholder: "Recipient Address",
    width: 0.58,
    x: 0.16,
    y: 0.169,
  }),
  textField({
    binding: "salutation",
    height: 0.022,
    id: "confirmation-securities-salutation",
    name: "Salutation",
    placeholder: "Sir / Madam",
    width: 0.35,
    x: 0.16,
    y: 0.226,
  }),
  textField({
    binding: "auditorName",
    height: 0.022,
    id: "confirmation-securities-auditor-name-intro",
    name: "Auditor name",
    placeholder: "Auditor Name",
    width: 0.16,
    x: 0.22,
    y: 0.301,
  }),
  textField({
    binding: "yearEndDate",
    height: 0.022,
    id: "confirmation-securities-year-end-date",
    name: "Year end date",
    placeholder: "Year end date",
    width: 0.16,
    x: 0.195,
    y: 0.32,
  }),
  textField({
    binding: "accountNumber",
    height: 0.022,
    id: "confirmation-securities-account-number",
    name: "Account number",
    placeholder: "Account number",
    width: 0.28,
    x: 0.34,
    y: 0.463,
  }),
  textField({
    binding: "auditorName",
    height: 0.022,
    id: "confirmation-securities-auditor-name-reply",
    name: "Auditor name",
    placeholder: "Auditor Name",
    width: 0.17,
    x: 0.515,
    y: 0.496,
  }),
  textField({
    binding: "auditorAddress",
    height: 0.022,
    id: "confirmation-securities-auditor-address",
    name: "Auditor address",
    placeholder: "Auditor Address",
    width: 0.23,
    x: 0.18,
    y: 0.524,
  }),
  textField({
    binding: "micName",
    height: 0.022,
    id: "confirmation-securities-mic-name",
    name: "MIC name",
    placeholder: "MIC Name",
    width: 0.2,
    x: 0.225,
    y: 0.553,
  }),
  textField({
    binding: "clientName",
    height: 0.022,
    id: "confirmation-securities-client-name",
    name: "Client name",
    placeholder: "Client Name",
    width: 0.22,
    x: 0.15,
    y: 0.748,
  }),
] as const;
const SECURITIES_TYPE_2_FIELDS = [
  ...SECURITIES_TYPE_1_FIELDS.slice(0, 5),
  textField({
    binding: "clientName",
    height: 0.022,
    id: "confirmation-securities-client-name-intro",
    name: "Client name",
    placeholder: "Client's Name",
    width: 0.14,
    x: 0.418,
    y: 0.197,
  }),
  textField({
    binding: "auditorName",
    height: 0.022,
    id: "confirmation-securities-auditor-name",
    name: "Auditor name",
    placeholder: "Auditor Name",
    width: 0.15,
    x: 0.22,
    y: 0.284,
  }),
  textField({
    binding: "auditorAddress",
    height: 0.022,
    id: "confirmation-securities-auditor-address-type-2",
    name: "Auditor address",
    placeholder: "Auditor Address",
    width: 0.17,
    x: 0.45,
    y: 0.284,
  }),
  textField({
    binding: "micEmail",
    height: 0.022,
    id: "confirmation-securities-mic-email",
    name: "MIC email",
    placeholder: "MIC Email",
    width: 0.12,
    x: 0.75,
    y: 0.284,
  }),
  textField({
    binding: "micNameAndInitial",
    height: 0.022,
    id: "confirmation-securities-mic-name-and-initial",
    name: "MIC name and initial",
    placeholder: "MIC Name and Initial",
    width: 0.2,
    x: 0.24,
    y: 0.303,
  }),
  textField({
    binding: "yearEndDate",
    height: 0.022,
    id: "confirmation-securities-year-end-date-type-2",
    name: "Year end date",
    placeholder: "Year end date",
    width: 0.14,
    x: 0.68,
    y: 0.303,
  }),
  textField({
    binding: "clientName",
    height: 0.022,
    id: "confirmation-securities-client-name-closing",
    name: "Client name",
    placeholder: "Client's Name",
    width: 0.14,
    x: 0.15,
    y: 0.644,
  }),
] as const;

export function getDefaultConfirmationTemplateDesign(
  code: ConfirmationDraftTemplateCode
): ConfirmationTemplateDesignSchema | null {
  const fields =
    code === "STANDARD_FINANCIAL_INSTITUTION"
      ? STANDARD_HEADER_FIELDS
      : code === "BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
        ? HK_STANDARD_FIELDS
        : code === "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1"
          ? SECURITIES_TYPE_1_FIELDS
          : code === "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2"
            ? SECURITIES_TYPE_2_FIELDS
            : null;
  return fields
    ? { version: 1, fields: fields.map((field) => ({ ...field })) }
    : null;
}
