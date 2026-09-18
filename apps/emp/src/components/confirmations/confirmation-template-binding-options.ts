import type { ConfirmationTemplateDesignFieldBinding } from "../../api/client";

export const CONFIRMATION_BASE_INFORMATION_BINDINGS = [
  "accountNumber",
  "auditorAddress",
  "bankName",
  "clientName",
  "officeDate",
  "picName",
  "referenceCode",
  "recipientAddress",
  "reportDate",
  "micName",
] as const satisfies readonly ConfirmationTemplateDesignFieldBinding[];

export const CONFIRMATION_INFORMATION_LIBRARY_BINDINGS = [
  "bankName",
  "recipientAddress",
  "recipientName",
] as const satisfies readonly ConfirmationTemplateDesignFieldBinding[];
