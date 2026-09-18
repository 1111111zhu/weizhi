import type { CmpBilling, CmpFeeNoteLocale } from "@project-wing/shared";

type BillingStatusCopy = {
  approved: string;
  clientPaid: string;
  draft: string;
  reconciled: string;
  sent: string;
  submitted: string;
};

export function billingMoney(
  amount: string,
  currency: string,
  locale: CmpFeeNoteLocale
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "code",
  }).format(Number(amount));
}

export function compactBillingMoney(
  amount: string,
  currency: string,
  locale: CmpFeeNoteLocale
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(amount));
}

export function formatBillingDate(value: string, locale: CmpFeeNoteLocale) {
  if (!value) {
    return "—";
  }
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

export function latestBillingReceiptDate(billing: CmpBilling) {
  return billing.financeReceipts.reduce(
    (latest, receipt) =>
      receipt.receiptDate > latest ? receipt.receiptDate : latest,
    ""
  );
}

export function billingStatusLabel(
  status: CmpBilling["status"],
  copy: BillingStatusCopy
) {
  if (status === "CLIENT_PAID") {
    return copy.clientPaid;
  }
  if (status === "RECONCILED") {
    return copy.reconciled;
  }
  return copy[
    status.toLowerCase() as "draft" | "submitted" | "approved" | "sent"
  ];
}

export function billingStatusTone(status: CmpBilling["status"]) {
  if (status === "RECONCILED") {
    return "success" as const;
  }
  if (status === "SENT") {
    return "warning" as const;
  }
  if (
    status === "SUBMITTED" ||
    status === "APPROVED" ||
    status === "CLIENT_PAID"
  ) {
    return "info" as const;
  }
  return "neutral" as const;
}

export function formatBillingEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}
