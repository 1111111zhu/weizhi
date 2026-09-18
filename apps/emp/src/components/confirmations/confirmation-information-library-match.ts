import type { ConfirmationDraftPayload } from "@project-wing/shared";

export type ConfirmationInformationLibraryMatchEntry = {
  requiresBankTemplate?: boolean;
  id: string;
  bankCode: string;
  bankNameEn: string;
  bankNameZh: string;
  bankType: string;
  businessAddress: string;
  mailingAddress: string | null;
  mailingAddressSameAsBusiness: boolean;
  contactName: string | null;
  attention: string | null;
  effectiveMailingAddress: string | null;
  historicalMailingAddress?: string | null;
};

export type ConfirmationInformationLibraryDraftPatch = {
  confirmationInformationLibraryEntryId: string;
  bankName: string;
  counterpartyAddress?: string;
  counterpartyAttention?: string;
  counterpartyContact?: string;
  recipientAddress?: string;
  recipientName?: string;
};

const ENGLISH_BANK_TEMPLATE_CODES = new Set([
  "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
  "SHINEWING_ENG_BANK",
  "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
  "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
]);
const INFORMATION_LIBRARY_TEMPLATE_CODES = new Set([
  "PRC_BANK_TEMPLATE_1",
  "PRC_BANK_TEMPLATE_2",
  "SHINEWING_ENG_BANK",
  "STANDARD_FINANCIAL_INSTITUTION",
  "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
  "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
  "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
]);

export function canUseConfirmationInformationLibrary(templateCode: string) {
  return INFORMATION_LIBRARY_TEMPLATE_CODES.has(templateCode);
}

export function clearConfirmationInformationLibraryDraftValuesForTemplate(
  draft: ConfirmationDraftPayload,
  _unused_templateCode: string
) {
  const next = { ...draft };
  if (!next.confirmationInformationLibraryEntryId) {
    return next;
  }

  const mappedAddress = next.counterpartyAddress?.trim();
  const mappedRecipientNames = [
    next.counterpartyAttention,
    next.counterpartyContact,
    next.bankName,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim());
  const recipientAddress = next.recipientAddress?.trim();
  const recipientName = next.recipientName?.trim();
  delete next.confirmationInformationLibraryEntryId;
  delete next.bankName;
  delete next.counterpartyAddress;
  delete next.counterpartyAttention;
  delete next.counterpartyContact;
  if (recipientAddress && recipientAddress === mappedAddress) {
    delete next.recipientAddress;
  }
  if (recipientName && mappedRecipientNames.includes(recipientName)) {
    delete next.recipientName;
  }
  return next;
}

export function matchesConfirmationInformationLibraryEntry(
  entry: ConfirmationInformationLibraryMatchEntry,
  query: string
) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return true;
  }

  return [
    entry.bankCode,
    entry.bankNameEn,
    entry.bankNameZh,
    entry.bankType,
    entry.businessAddress,
    entry.mailingAddress,
    entry.contactName,
    entry.attention,
  ].some((value) =>
    value ? normalizeSearchText(value).includes(normalizedQuery) : false
  );
}

export function buildConfirmationInformationLibraryDraftPatch(
  entry: ConfirmationInformationLibraryMatchEntry,
  templateCode: string,
  locale?: string
): ConfirmationInformationLibraryDraftPatch {
  const prefersEnglish = locale
    ? !locale.toLocaleLowerCase().startsWith("zh")
    : ENGLISH_BANK_TEMPLATE_CODES.has(templateCode);
  const bankName = prefersEnglish
    ? entry.bankNameEn.trim() || entry.bankNameZh.trim()
    : entry.bankNameZh.trim() || entry.bankNameEn.trim();
  const address = resolveEffectiveMailingAddress(entry);
  const contact = entry.contactName?.trim();
  const attention = entry.attention?.trim();
  const mappedAttention = attention || contact;
  const recipientName = contact || attention;

  return {
    confirmationInformationLibraryEntryId: entry.id,
    bankName,
    ...(address ? { counterpartyAddress: address } : {}),
    ...(mappedAttention ? { counterpartyAttention: mappedAttention } : {}),
    ...(contact ? { counterpartyContact: contact } : {}),
    ...(address ? { recipientAddress: address } : {}),
    ...(recipientName ? { recipientName } : {}),
  };
}

export function buildConfirmationInformationLibraryBindingChoices(
  entry: ConfirmationInformationLibraryMatchEntry,
  locale: string
) {
  const bankName = getConfirmationInformationLibraryDisplayName(entry, locale);
  const contact = entry.contactName?.trim() ?? "";
  const currentAddress = resolveEffectiveMailingAddress(entry);
  const historicalAddresses =
    entry.historicalMailingAddress
      ?.split(/\r?\n/u)
      .map((address) => address.trim())
      .filter(Boolean) ?? [];
  const uniqueAddresses = [
    ...new Set([currentAddress, ...historicalAddresses].filter(Boolean)),
  ];

  return {
    bankName: bankName ? [bankName] : [],
    recipientName: contact ? [contact] : [],
    recipientAddress: uniqueAddresses,
  };
}

export function getConfirmationInformationLibraryDisplayName(
  entry: Pick<
    ConfirmationInformationLibraryMatchEntry,
    "bankNameEn" | "bankNameZh"
  >,
  locale: string
) {
  return locale.toLocaleLowerCase().startsWith("zh")
    ? entry.bankNameZh.trim() || entry.bankNameEn.trim()
    : entry.bankNameEn.trim() || entry.bankNameZh.trim();
}

function resolveEffectiveMailingAddress(
  entry: ConfirmationInformationLibraryMatchEntry
) {
  const effective = entry.effectiveMailingAddress?.trim();
  if (effective) {
    return effective;
  }
  const mailing = entry.mailingAddress?.trim();
  if (mailing) {
    return mailing;
  }
  return entry.mailingAddressSameAsBusiness ? entry.businessAddress.trim() : "";
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replaceAll(/[\s()[\]{}（）【】.,，。·'’"“”\-_/\\]+/g, "");
}
