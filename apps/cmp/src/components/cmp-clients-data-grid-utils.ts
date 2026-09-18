import type { CmpClient } from "@project-wing/shared";

import { parseClientServiceTypes } from "./client-master-form";
import type { ClientServiceType } from "./client-master-form";

export function hasCmpClientServiceType(
  client: CmpClient,
  serviceType: ClientServiceType
) {
  return parseClientServiceTypes(
    client.serviceLines,
    client.serviceType
  ).includes(serviceType);
}

export type CmpClientCompanyType = "PRIVATE" | "LISTED" | "OTHER";

export function getCmpClientCompanyType(
  client: CmpClient
): CmpClientCompanyType | null {
  const value = client.listedOrPrivate?.trim().toUpperCase();
  return value === "PRIVATE" || value === "LISTED" || value === "OTHER"
    ? value
    : null;
}

const COUNTRY_CODES: Record<string, string> = {
  AUSTRALIA: "AU",
  BERMUDA: "BM",
  "BRITISH VIRGIN ISLANDS": "VG",
  BVI: "VG",
  CANADA: "CA",
  "CAYMAN ISLANDS": "KY",
  CHINA: "CN",
  "HONG KONG": "HK",
  JAPAN: "JP",
  MACAU: "MO",
  MACAO: "MO",
  MALAYSIA: "MY",
  PRC: "CN",
  SINGAPORE: "SG",
  TAIWAN: "TW",
  UK: "GB",
  "UNITED KINGDOM": "GB",
  US: "US",
  USA: "US",
  "UNITED STATES": "US",
};

export function getCmpClientCountryCode(client: CmpClient) {
  const value = client.placeOfIncorporation?.trim().toUpperCase();
  if (!value) {
    return null;
  }
  if (/^[A-Z]{2}$/.test(value)) {
    return value;
  }
  return COUNTRY_CODES[value] ?? null;
}

export function getCmpClientYearEndMonth(client: CmpClient) {
  if (client.yearEndMonth) {
    return client.yearEndMonth;
  }
  const legacyMonth = client.yearEndDate?.match(/^\d{4}-(\d{2})-/)?.[1];
  return legacyMonth ? Number(legacyMonth) : null;
}

export function formatCmpYearEndMonth(value: number | null) {
  if (!value || value < 1 || value > 12) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2020, value - 1, 1)));
}
