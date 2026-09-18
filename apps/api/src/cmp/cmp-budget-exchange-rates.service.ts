import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CmpSettingsExchangeRatesResponseSchema } from "@project-wing/shared";
import type {
  CmpBudgetCurrency,
  CmpBudgetExchangeRateSnapshot,
  CmpSettingsExchangeRatesResponse,
  UpdateCmpBudgetExchangeRateFallbackInput,
} from "@project-wing/shared";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { RequestUser } from "../auth/request-user";
import {
  ApiForbiddenException,
  ApiServiceUnavailableException,
} from "../common/api-error";
import { PrismaService } from "../prisma/prisma.service";

const HKMA_DAILY_EXCHANGE_RATE_URL =
  "https://api.hkma.gov.hk/public/market-data-and-statistics/monthly-statistical-bulletin/er-ir/er-eeri-daily?offset=0";
const HKMA_SOURCE_URL =
  "https://apidocs.hkma.gov.hk/documentation/market-data-and-statistics/monthly-statistical-bulletin/er-ir/er-eeri-daily/";
const HKMA_REQUEST_HEADERS = {
  Accept: "application/json",
  "User-Agent": "ProjectWing CMP exchange-rate updater/1.0",
};
const HKMA_REQUEST_TIMEOUT_MS = 8000;
const HKMA_CURL_TIMEOUT_SECONDS = "8";
const HKMA_CURL_CONNECT_TIMEOUT_SECONDS = "5";
const HKMA_CURL_RETRY_MAX_TIME_SECONDS = "10";
const HKMA_CURL_MAX_BUFFER_BYTES = 2 * 1024 * 1024;
const HKMA_CURL_COMMAND = process.env.CMP_HKMA_CURL_COMMAND ?? "curl";
const execFileAsync = promisify(execFile);
const CURRENCIES = [
  "HKD",
  "CNY",
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "SGD",
  "AUD",
  "CAD",
  "MYR",
  "VND",
  "THB",
] as const satisfies readonly CmpBudgetCurrency[];
const HKMA_CURRENCIES = CURRENCIES.filter(
  (currency): currency is Exclude<CmpBudgetCurrency, "HKD" | "VND"> =>
    currency !== "HKD" && currency !== "VND"
);
const REFRESH_ROLES = new Set(["PARTNER", "MANAGER", "SUPER_ADMIN"]);
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

type ExchangeRateBatchRecord = Prisma.CmpExchangeRateBatchGetPayload<{
  include: {
    snapshots: true;
    refreshedBy: { select: { id: true; name: true } };
  };
}>;

type HkmaDailyRecord = Record<string, unknown> & { end_of_day?: unknown };

@Injectable()
export class CmpBudgetExchangeRatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService
  ) {}

  async latest(): Promise<CmpBudgetExchangeRateSnapshot[]> {
    return this.formatRates(await this.currentBatch());
  }

  async settings(user: RequestUser): Promise<CmpSettingsExchangeRatesResponse> {
    return this.formatSettings(await this.currentBatch(), user);
  }

  async refresh(
    user: RequestUser,
    source?: AuditLogSource
  ): Promise<CmpSettingsExchangeRatesResponse> {
    if (!REFRESH_ROLES.has(user.globalRole)) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Only finance users and administrators can refresh CMP exchange rates"
      );
    }

    const sourceRecord = await this.fetchLatestHkmaRecord();
    const persisted = await this.persistHkmaBatch({
      ...sourceRecord,
      sourceDate: new Date(`${sourceRecord.sourceDate}T00:00:00.000Z`),
      userId: user.id,
    });

    await this.auditLogs.log({
      actorId: user.id,
      action: persisted.created
        ? "CMP_EXCHANGE_RATE_REFRESHED"
        : "CMP_EXCHANGE_RATE_REFRESH_CHECKED",
      targetType: "CMP_EXCHANGE_RATE_BATCH",
      targetId: persisted.batch.id,
      description: persisted.created
        ? `Refreshed CMP HKD exchange rates for ${sourceRecord.sourceDate}`
        : `Checked CMP HKD exchange rates for ${sourceRecord.sourceDate}; current batch already exists`,
      source,
    });
    return this.formatSettings(persisted.batch, user);
  }

  async updateFallback(
    user: RequestUser,
    input: UpdateCmpBudgetExchangeRateFallbackInput,
    source?: AuditLogSource
  ): Promise<CmpSettingsExchangeRatesResponse> {
    if (!REFRESH_ROLES.has(user.globalRole)) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Only finance users and administrators can maintain CMP fallback exchange rates"
      );
    }
    const rate = new Prisma.Decimal(input.hkdPerUnit).toDecimalPlaces(
      8,
      Prisma.Decimal.ROUND_HALF_UP
    );
    const batch = await this.prisma.$transaction(async (tx) => {
      await tx.cmpBudgetExchangeRateFallback.upsert({
        where: { currency: input.currency },
        create: {
          currency: input.currency,
          hkdPerUnit: rate,
          updatedById: user.id,
        },
        update: { hkdPerUnit: rate, updatedById: user.id },
      });
      const current = await tx.cmpExchangeRateBatch.findFirst({
        orderBy: [{ sourceDate: "desc" }, { fetchedAt: "desc" }],
        include: {
          snapshots: { orderBy: [{ currency: "asc" }, { fetchedAt: "desc" }] },
          refreshedBy: { select: { id: true, name: true } },
        },
      });
      if (!current) {
        throw new ApiServiceUnavailableException(
          "CMP_EXCHANGE_RATE_UNAVAILABLE",
          "CMP exchange rates have not been initialized"
        );
      }
      const snapshotByCurrency = new Map<string, (typeof current.snapshots)[number]>();
      for (const snapshot of current.snapshots) {
        if (!snapshotByCurrency.has(snapshot.currency)) {
          snapshotByCurrency.set(snapshot.currency, snapshot);
        }
      }
      const now = new Date();
      return tx.cmpExchangeRateBatch.create({
        data: {
          baseCurrency: "HKD",
          provider: `MANUAL_FALLBACK_${now.toISOString().replace(/[^0-9]/g, "")}`,
          sourceDate: now,
          sourceUrl: "CMP_MANUAL_FALLBACK_SETTINGS",
          fetchedAt: now,
          refreshedById: user.id,
          snapshots: {
            create: CURRENCIES.map((currency) => {
              const existing = snapshotByCurrency.get(currency);
              if (!existing && currency !== input.currency) {
                throw new ApiServiceUnavailableException(
                  "CMP_EXCHANGE_RATE_UNAVAILABLE",
                  `The current CMP exchange-rate batch is missing ${currency}`
                );
              }
              return {
                currency,
                hkdPerUnit:
                  currency === input.currency
                    ? rate
                    : (existing?.hkdPerUnit ?? new Prisma.Decimal(1)),
                periodStart: now,
                periodEnd: now,
                sourceUrl:
                  currency === input.currency
                    ? "CMP_MANUAL_FALLBACK_SETTINGS"
                    : (existing?.sourceUrl ?? "CMP_SYSTEM"),
                fetchedAt: now,
                source:
                  currency === input.currency
                    ? "FALLBACK"
                    : (existing?.source ?? "SYSTEM"),
              };
            }),
          },
        },
        include: {
          snapshots: true,
          refreshedBy: { select: { id: true, name: true } },
        },
      });
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "CMP_EXCHANGE_RATE_FALLBACK_UPDATED",
      targetType: "CMP_EXCHANGE_RATE_FALLBACK",
      targetId: input.currency,
      description: `Updated CMP ${input.currency} fallback rate to ${rate.toFixed(8)} HKD per unit`,
      source,
    });
    return this.formatSettings(batch, user);
  }

  async conversionForReceipt(
    receiptCurrency: CmpBudgetCurrency,
    billCurrency: CmpBudgetCurrency
  ) {
    const batch = await this.currentBatch();
    const rates = new Map(
      this.formatRates(batch).map((rate) => [rate.currency, rate])
    );
    const receiptRate = rates.get(receiptCurrency);
    const billRate = rates.get(billCurrency);
    if (!receiptRate || !billRate) {
      throw new ApiServiceUnavailableException(
        "CMP_EXCHANGE_RATE_UNAVAILABLE",
        "The current CMP exchange-rate batch is incomplete"
      );
    }
    const exchangeRateToBill =
      receiptCurrency === billCurrency
        ? new Prisma.Decimal(1)
        : new Prisma.Decimal(receiptRate.hkdPerUnit).div(
            new Prisma.Decimal(billRate.hkdPerUnit)
          );
    return {
      batchId: batch.id,
      sourceDate: batch.sourceDate.toISOString().slice(0, 10),
      provider: batch.provider,
      exchangeRateToBill: exchangeRateToBill.toDecimalPlaces(
        8,
        Prisma.Decimal.ROUND_HALF_UP
      ),
    };
  }

  private async currentBatch(): Promise<ExchangeRateBatchRecord> {
    const batch = await this.prisma.cmpExchangeRateBatch.findFirst({
      orderBy: [{ sourceDate: "desc" }, { fetchedAt: "desc" }],
      include: {
        snapshots: {
          where: { currency: { in: [...CURRENCIES] } },
          orderBy: { currency: "asc" },
        },
        refreshedBy: { select: { id: true, name: true } },
      },
    });
    if (!batch) {
      throw new ApiServiceUnavailableException(
        "CMP_EXCHANGE_RATE_UNAVAILABLE",
        "CMP exchange rates have not been initialized"
      );
    }
    return batch;
  }

  private formatSettings(
    batch: ExchangeRateBatchRecord,
    user: RequestUser
  ): CmpSettingsExchangeRatesResponse {
    const stale = this.isStale(batch);
    return CmpSettingsExchangeRatesResponseSchema.parse({
      batch: {
        id: batch.id,
        baseCurrency: "HKD",
        provider: batch.provider,
        sourceDate: batch.sourceDate.toISOString().slice(0, 10),
        sourceUrl: batch.sourceUrl,
        fetchedAt: batch.fetchedAt.toISOString(),
        refreshedBy: batch.refreshedBy,
        stale,
      },
      rates: this.formatRates(batch),
      canRefresh: REFRESH_ROLES.has(user.globalRole),
      canMaintainFallback: REFRESH_ROLES.has(user.globalRole),
    });
  }

  private formatRates(
    batch: ExchangeRateBatchRecord
  ): CmpBudgetExchangeRateSnapshot[] {
    const snapshotByCurrency = new Map<string, (typeof batch.snapshots)[number]>();
    for (const snapshot of batch.snapshots) {
      if (!snapshotByCurrency.has(snapshot.currency)) {
        snapshotByCurrency.set(snapshot.currency, snapshot);
      }
    }
    const stale = this.isStale(batch);
    return CURRENCIES.map((currency) => {
      const snapshot = snapshotByCurrency.get(currency);
      if (!snapshot && currency === "HKD") {
        return {
          id: `HKD-${batch.id}`,
          currency,
          hkdPerUnit: "1.00000000",
          periodStart: null,
          periodEnd: null,
          fetchedAt: batch.fetchedAt.toISOString(),
          source: "SYSTEM",
          stale,
        };
      }
      if (!snapshot) {
        throw new ApiServiceUnavailableException(
          "CMP_EXCHANGE_RATE_UNAVAILABLE",
          `The current CMP exchange-rate batch is missing ${currency}`
        );
      }
      return {
        id: snapshot.id,
        currency: snapshot.currency as CmpBudgetCurrency,
        hkdPerUnit: snapshot.hkdPerUnit.toFixed(8),
        periodStart: snapshot.periodStart.toISOString().slice(0, 10),
        periodEnd: snapshot.periodEnd.toISOString().slice(0, 10),
        fetchedAt: snapshot.fetchedAt.toISOString(),
        source:
          snapshot.source === "FALLBACK"
            ? "FALLBACK"
            : snapshot.source === "LEGACY"
              ? "LEGACY"
              : "SYSTEM",
        stale,
      };
    });
  }

  private async persistHkmaBatch(input: {
    sourceDate: Date;
    hkdPerUnit: Record<
      Exclude<CmpBudgetCurrency, "HKD" | "VND">,
      string
    >;
    userId: string;
  }) {
    const provider = "HKMA_DAILY";
    const existing = await this.findHkmaBatch(provider, input.sourceDate);
    if (existing) {
      return { batch: existing, created: false };
    }

    try {
      const fetchedAt = new Date();
      const fallback = await this.prisma.cmpBudgetExchangeRateFallback.findUnique({
        where: { currency: "VND" },
        select: { hkdPerUnit: true },
      });
      if (!fallback) {
        throw new ApiServiceUnavailableException(
          "CMP_EXCHANGE_RATE_UNAVAILABLE",
          "The VND fallback exchange rate has not been configured"
        );
      }
      const batch = await this.prisma.cmpExchangeRateBatch.create({
        data: {
          baseCurrency: "HKD",
          provider,
          sourceDate: input.sourceDate,
          sourceUrl: HKMA_SOURCE_URL,
          fetchedAt,
          refreshedById: input.userId,
          snapshots: {
            create: CURRENCIES.map((currency) => ({
              currency,
              hkdPerUnit:
                currency === "HKD"
                  ? "1.00000000"
                  : currency === "VND"
                    ? fallback.hkdPerUnit
                    : input.hkdPerUnit[currency],
              periodStart: input.sourceDate,
              periodEnd: input.sourceDate,
              sourceUrl: currency === "VND" ? "CMP_MANUAL_FALLBACK_SETTINGS" : HKMA_SOURCE_URL,
              fetchedAt,
              source: currency === "VND" ? "FALLBACK" : "SYSTEM",
            })),
          },
        },
        include: {
          snapshots: true,
          refreshedBy: { select: { id: true, name: true } },
        },
      });
      return { batch, created: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const batch = await this.findHkmaBatch(provider, input.sourceDate);
        if (batch) {
          return { batch, created: false };
        }
      }
      throw error;
    }
  }

  private findHkmaBatch(provider: string, sourceDate: Date) {
    return this.prisma.cmpExchangeRateBatch.findUnique({
      where: { provider_sourceDate: { provider, sourceDate } },
      include: {
        snapshots: {
          where: { currency: { in: [...CURRENCIES] } },
          orderBy: { currency: "asc" },
        },
        refreshedBy: { select: { id: true, name: true } },
      },
    });
  }

  private async fetchLatestHkmaRecord() {
    let responseBody: string;
    const proxyUrl = this.hkmaProxyUrl();
    if (proxyUrl) {
      try {
        // Node's native fetch does not honour the runtime proxy setting. A
        // configured proxy is therefore an explicit routing requirement, not
        // a best-effort fallback that could accidentally be bypassed.
        responseBody = await this.fetchHkmaResponseBodyWithCurl(proxyUrl);
      } catch {
        throw new ApiServiceUnavailableException(
          "CMP_EXCHANGE_RATE_PROVIDER_UNAVAILABLE",
          "The HKMA exchange-rate service is unavailable; existing CMP rates were retained"
        );
      }
    } else {
      try {
        responseBody = await this.fetchHkmaResponseBodyWithSession();
      } catch {
        try {
          // The upstream gateway can reject Node's TLS client while accepting
          // curl (the API runner image includes curl). Keep this as a narrow
          // transport fallback; both requests still use the same HKMA endpoint.
          responseBody = await this.fetchHkmaResponseBodyWithCurl();
        } catch {
          throw new ApiServiceUnavailableException(
            "CMP_EXCHANGE_RATE_PROVIDER_UNAVAILABLE",
            "The HKMA exchange-rate service is unavailable; existing CMP rates were retained"
          );
        }
      }
    }

    let payload: unknown;
    try {
      payload = JSON.parse(responseBody);
    } catch {
      throw new ApiServiceUnavailableException(
        "CMP_EXCHANGE_RATE_PROVIDER_INVALID",
        "The HKMA exchange-rate response is invalid"
      );
    }
    const valid = extractHkmaRecords(payload)
      .map((record) => {
        const sourceDate = normalizeDate(record.end_of_day);
        const hkdPerUnit = Object.fromEntries(
          HKMA_CURRENCIES.map((currency) => [
            currency,
            normalizeRate(record[currency.toLowerCase()]),
          ])
        ) as Record<Exclude<CmpBudgetCurrency, "HKD" | "VND">, string | null>;
        return sourceDate && Object.values(hkdPerUnit).every(Boolean)
          ? {
              sourceDate,
              hkdPerUnit: hkdPerUnit as Record<
                Exclude<CmpBudgetCurrency, "HKD" | "VND">,
                string
              >,
            }
          : null;
      })
      .filter(
        (
          value
        ): value is {
          sourceDate: string;
          hkdPerUnit: Record<
            Exclude<CmpBudgetCurrency, "HKD" | "VND">,
            string
          >;
        } => value !== null
      )
      .sort((left, right) => right.sourceDate.localeCompare(left.sourceDate));
    const latest = valid[0];
    if (!latest) {
      throw new ApiServiceUnavailableException(
        "CMP_EXCHANGE_RATE_PROVIDER_INVALID",
        "The HKMA exchange-rate response did not contain every configured system currency"
      );
    }
    return latest;
  }

  private async fetchHkmaResponseBodyWithSession(): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      HKMA_REQUEST_TIMEOUT_MS
    );
    try {
      const session = await fetch(HKMA_DAILY_EXCHANGE_RATE_URL, {
        method: "HEAD",
        headers: HKMA_REQUEST_HEADERS,
        signal: controller.signal,
      });
      if (!session.ok) {
        throw new Error("HKMA session request failed");
      }

      const headers = new Headers(HKMA_REQUEST_HEADERS);
      const sessionCookie = hkmaSessionCookie(session.headers);
      if (sessionCookie) {
        headers.set("Cookie", sessionCookie);
      }

      const response = await fetch(HKMA_DAILY_EXCHANGE_RATE_URL, {
        headers,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error("HKMA data request failed");
      }
      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  }

  private hkmaProxyUrl(): string | undefined {
    const configured = process.env.CMP_HKMA_PROXY_URL?.trim();
    if (!configured) {
      return undefined;
    }

    try {
      const parsed = new URL(configured);
      if (
        ![
          "http:",
          "https:",
          "socks4:",
          "socks4a:",
          "socks5:",
          "socks5h:",
        ].includes(parsed.protocol) ||
        !parsed.hostname
      ) {
        throw new Error("Unsupported proxy URL");
      }
      return configured;
    } catch {
      throw new ApiServiceUnavailableException(
        "CMP_EXCHANGE_RATE_PROVIDER_UNAVAILABLE",
        "CMP_HKMA_PROXY_URL is invalid; existing CMP rates were retained"
      );
    }
  }

  private async fetchHkmaResponseBodyWithCurl(
    proxyUrl?: string
  ): Promise<string> {
    const commonArgs = [
      "--fail",
      "--silent",
      "--show-error",
      "--location",
      "--http1.1",
      "--retry",
      "1",
      "--retry-all-errors",
      "--retry-delay",
      "1",
      "--retry-max-time",
      HKMA_CURL_RETRY_MAX_TIME_SECONDS,
      "--connect-timeout",
      HKMA_CURL_CONNECT_TIMEOUT_SECONDS,
      "--max-time",
      HKMA_CURL_TIMEOUT_SECONDS,
      "--header",
      "Accept: application/json",
      "--header",
      `User-Agent: ${HKMA_REQUEST_HEADERS["User-Agent"]}`,
      ...(proxyUrl ? ["--proxy", proxyUrl] : []),
    ];
    const options = {
      windowsHide: true,
      timeout: (Number(HKMA_CURL_RETRY_MAX_TIME_SECONDS) + 2) * 1000,
      maxBuffer: HKMA_CURL_MAX_BUFFER_BYTES,
    };
    const { stdout: sessionHeaders } = await execFileAsync(
      HKMA_CURL_COMMAND,
      [...commonArgs, "--head", HKMA_DAILY_EXCHANGE_RATE_URL],
      options
    );
    const sessionCookie = hkmaSessionCookieFromRawHeaders(sessionHeaders);
    const dataArgs = [
      ...commonArgs,
      ...(sessionCookie ? ["--header", `Cookie: ${sessionCookie}`] : []),
      HKMA_DAILY_EXCHANGE_RATE_URL,
    ];
    const { stdout } = await execFileAsync(
      HKMA_CURL_COMMAND,
      dataArgs,
      options
    );
    return stdout;
  }

  private isStale(batch: ExchangeRateBatchRecord) {
    return (
      batch.provider === "LEGACY_FIXED" ||
      Date.now() - batch.sourceDate.getTime() > STALE_AFTER_MS
    );
  }
}

function extractHkmaRecords(payload: unknown): HkmaDailyRecord[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const { result } = payload as { result?: unknown };
  if (!result || typeof result !== "object") {
    return [];
  }
  const { records } = result as { records?: unknown };
  return Array.isArray(records) ? (records as HkmaDailyRecord[]) : [];
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : value;
}

function normalizeRate(value: unknown) {
  const text = typeof value === "number" ? String(value) : value;
  if (typeof text !== "string" || !/^\d+(?:\.\d+)?$/.test(text.trim())) {
    return null;
  }
  const rate = new Prisma.Decimal(text);
  if (!rate.isFinite() || rate.lte(0)) {
    return null;
  }
  return rate.toDecimalPlaces(8, Prisma.Decimal.ROUND_HALF_UP).toFixed(8);
}

function hkmaSessionCookie(headers: Headers) {
  const cookieHeaders =
    (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ??
    [headers.get("set-cookie")].filter(Boolean);
  const cookies = cookieHeaders
    .map((header) => header.split(";", 1)[0]?.trim())
    .filter((cookie): cookie is string => Boolean(cookie));
  return cookies.length > 0 ? cookies.join("; ") : undefined;
}

function hkmaSessionCookieFromRawHeaders(headers: string) {
  const cookies = [...headers.matchAll(/^set-cookie:\s*([^;\r\n]+)/gim)]
    .map((match) => match[1]?.trim())
    .filter((cookie): cookie is string => Boolean(cookie));
  return cookies.length > 0 ? cookies.join("; ") : undefined;
}
