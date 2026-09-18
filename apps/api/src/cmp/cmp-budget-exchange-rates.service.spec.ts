import { Prisma } from "@prisma/client";
import { CMP_BUDGET_CURRENCIES } from "@project-wing/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

const execFileMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({ execFile: execFileMock }));

import type { RequestUser } from "../auth/request-user";
import { CmpBudgetExchangeRatesService } from "./cmp-budget-exchange-rates.service";

const manager = {
  id: "manager-1",
  email: "manager@example.test",
  name: "Finance manager",
  globalRole: "MANAGER",
} satisfies RequestUser;

const HKMA_TEST_RATES: Record<string, string> = {
  CNY: "1.12000000",
  USD: "7.80000000",
  EUR: "8.48000000",
  GBP: "9.93000000",
  JPY: "0.05400000",
  SGD: "5.80000000",
  AUD: "5.07000000",
  CAD: "5.67000000",
  MYR: "1.84000000",
  THB: "0.24200000",
};

function hkmaRecord(
  endOfDay: string,
  overrides: Record<string, string> = {}
) {
  return {
    end_of_day: endOfDay,
    ...Object.fromEntries(
      Object.entries({ ...HKMA_TEST_RATES, ...overrides }).map(
        ([currency, rate]) => [currency.toLowerCase(), rate]
      )
    ),
  };
}

function makeBatch(overrides: Record<string, unknown> = {}) {
  const sourceDate = new Date("2026-08-28T00:00:00.000Z");
  const fetchedAt = new Date("2026-08-28T12:00:00.000Z");
  return {
    id: "batch-1",
    baseCurrency: "HKD",
    provider: "HKMA_DAILY",
    sourceDate,
    sourceUrl: "https://apidocs.hkma.gov.hk/",
    fetchedAt,
    refreshedById: "manager-1",
    createdAt: fetchedAt,
    refreshedBy: { id: "manager-1", name: "Finance manager" },
    snapshots: CMP_BUDGET_CURRENCIES.map((currency) => ({
      id: `rate-${currency.toLowerCase()}`,
      currency,
      hkdPerUnit: new Prisma.Decimal(
        currency === "HKD"
          ? "1"
          : currency === "VND"
            ? "0.0003"
            : HKMA_TEST_RATES[currency]
      ),
      periodStart: sourceDate,
      periodEnd: sourceDate,
      sourceUrl:
        currency === "VND"
          ? "CMP_MANUAL_FALLBACK_SETTINGS"
          : "https://apidocs.hkma.gov.hk/",
      fetchedAt,
      source: currency === "VND" ? "FALLBACK" : "SYSTEM",
      createdAt: fetchedAt,
      exchangeRateBatchId: "batch-1",
    })),
    ...overrides,
  };
}

function makeService(batch = makeBatch()) {
  const prisma = {
    cmpExchangeRateBatch: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    cmpBudgetExchangeRateFallback: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ hkdPerUnit: new Prisma.Decimal("0.0003") }),
    },
  };
  const auditLogs = { log: vi.fn().mockResolvedValue(undefined) };
  return {
    prisma,
    auditLogs,
    service: new CmpBudgetExchangeRatesService(
      prisma as never,
      auditLogs as never
    ),
    batch,
  };
}

function stubHkmaFetch(payload: unknown) {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      headers: new Headers({
        "set-cookie": "acw_tc=hkma-session-token; Path=/; HttpOnly",
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      headers: new Headers(),
      text: async () => JSON.stringify(payload),
    });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  execFileMock.mockReset();
});

describe(CmpBudgetExchangeRatesService, () => {
  it("stores the newest valid HKMA CNY/USD record as one atomic HKD batch", async () => {
    const { prisma, auditLogs, service, batch } = makeService();
    prisma.cmpExchangeRateBatch.findUnique.mockResolvedValue(null);
    prisma.cmpExchangeRateBatch.create.mockResolvedValue(batch);
    const fetchMock = stubHkmaFetch({
      result: {
        records: [
          hkmaRecord("2026-08-27", { CNY: "1.110", USD: "7.790" }),
          hkmaRecord("2026-08-28", { CNY: "1.120", USD: "7.800" }),
        ],
      },
    });

    const result = await service.refresh(manager);

    expect(result).toMatchObject({
      canRefresh: true,
      batch: { provider: "HKMA_DAILY", id: "batch-1" },
      rates: expect.arrayContaining([
        expect.objectContaining({ currency: "HKD", hkdPerUnit: "1.00000000" }),
        expect.objectContaining({ currency: "CNY", hkdPerUnit: "1.12000000" }),
        expect.objectContaining({ currency: "USD", hkdPerUnit: "7.80000000" }),
      ]),
    });
    expect(prisma.cmpExchangeRateBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: "HKMA_DAILY",
          snapshots: {
            create: expect.arrayContaining([
              expect.objectContaining({
                currency: "HKD",
                hkdPerUnit: "1.00000000",
              }),
              expect.objectContaining({
                currency: "CNY",
                hkdPerUnit: "1.12000000",
              }),
              expect.objectContaining({
                currency: "USD",
                hkdPerUnit: "7.80000000",
              }),
            ]),
          },
        }),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CMP_EXCHANGE_RATE_REFRESHED" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.objectContaining({ method: "HEAD" })
    );
    const dataRequest = fetchMock.mock.calls[1]?.[1] as {
      headers: Headers;
    };
    expect(dataRequest.headers.get("cookie")).toBe("acw_tc=hkma-session-token");
  });

  it("keeps an existing same-day HKMA batch and reports the refresh as already current", async () => {
    const { prisma, auditLogs, service, batch } = makeService();
    prisma.cmpExchangeRateBatch.findUnique.mockResolvedValue(batch);
    stubHkmaFetch({
      result: {
        records: [hkmaRecord("2026-08-28", { CNY: "1.12", USD: "7.8" })],
      },
    });

    await service.refresh(manager);

    expect(prisma.cmpExchangeRateBatch.create).not.toHaveBeenCalled();
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CMP_EXCHANGE_RATE_REFRESH_CHECKED" })
    );
  });

  it("uses the curl session fallback when the Node transport is blocked by the HKMA gateway", async () => {
    const { prisma, service, batch } = makeService();
    prisma.cmpExchangeRateBatch.findUnique.mockResolvedValue(null);
    prisma.cmpExchangeRateBatch.create.mockResolvedValue(batch);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    execFileMock
      .mockImplementationOnce((...args: unknown[]) => {
        const callback = args.at(-1) as (
          error: Error | null,
          stdout: string,
          stderr: string
        ) => void;
        callback(
          null,
          {
            stdout:
              "HTTP/1.1 200 OK\r\nSet-Cookie: acw_tc=curl-session-token; Path=/; HttpOnly\r\n",
            stderr: "",
          } as unknown as string,
          ""
        );
      })
      .mockImplementationOnce((...args: unknown[]) => {
        const callback = args.at(-1) as (
          error: Error | null,
          stdout: string,
          stderr: string
        ) => void;
        callback(
          null,
          {
            stdout: JSON.stringify({
              result: {
                records: [
                  hkmaRecord("2026-08-28", { CNY: "1.120", USD: "7.800" }),
                ],
              },
            }),
            stderr: "",
          } as unknown as string,
          ""
        );
      });

    await expect(service.refresh(manager)).resolves.toMatchObject({
      batch: { id: "batch-1", provider: "HKMA_DAILY" },
    });
    expect(execFileMock).toHaveBeenCalledTimes(2);
    expect(execFileMock.mock.calls[1]?.[1]).toStrictEqual(
      expect.arrayContaining(["--header", "Cookie: acw_tc=curl-session-token"])
    );
  });

  it("uses the injected fixed proxy for both HKMA requests without trying direct fetch", async () => {
    const { prisma, service, batch } = makeService();
    prisma.cmpExchangeRateBatch.findUnique.mockResolvedValue(null);
    prisma.cmpExchangeRateBatch.create.mockResolvedValue(batch);
    vi.stubEnv(
      "CMP_HKMA_PROXY_URL",
      "socks5h://cmp-egress-proxy.internal:1080"
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    execFileMock
      .mockImplementationOnce((...args: unknown[]) => {
        const callback = args.at(-1) as (
          error: Error | null,
          stdout: string,
          stderr: string
        ) => void;
        callback(
          null,
          {
            stdout:
              "HTTP/1.1 200 OK\r\nSet-Cookie: acw_tc=curl-session-token; Path=/; HttpOnly\r\n",
            stderr: "",
          } as unknown as string,
          ""
        );
      })
      .mockImplementationOnce((...args: unknown[]) => {
        const callback = args.at(-1) as (
          error: Error | null,
          stdout: string,
          stderr: string
        ) => void;
        callback(
          null,
          {
            stdout: JSON.stringify({
              result: {
                records: [
                  hkmaRecord("2026-08-28", { CNY: "1.120", USD: "7.800" }),
                ],
              },
            }),
            stderr: "",
          } as unknown as string,
          ""
        );
      });

    await expect(service.refresh(manager)).resolves.toMatchObject({
      batch: { id: "batch-1", provider: "HKMA_DAILY" },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    for (const [, args] of execFileMock.mock.calls) {
      expect(args).toStrictEqual(
        expect.arrayContaining([
          "--proxy",
          "socks5h://cmp-egress-proxy.internal:1080",
        ])
      );
    }
  });

  it("uses the current batch for receipt conversion and never uses a client-supplied rate", async () => {
    const { prisma, service } = makeService();
    prisma.cmpExchangeRateBatch.findFirst.mockResolvedValue(makeBatch());

    const conversion = await service.conversionForReceipt("CNY", "USD");

    expect(conversion).toMatchObject({
      batchId: "batch-1",
      sourceDate: "2026-08-28",
      provider: "HKMA_DAILY",
    });
    expect(conversion.exchangeRateToBill.toFixed(8)).toBe("0.14358974");
  });

  it("rejects malformed HKMA data without creating a partial batch", async () => {
    const { prisma, service } = makeService();
    stubHkmaFetch({
      result: {
        records: [{ end_of_day: "2026-08-28", cny: "0", usd: null }],
      },
    });

    await expect(service.refresh(manager)).rejects.toMatchObject({
      status: 503,
    });
    expect(prisma.cmpExchangeRateBatch.create).not.toHaveBeenCalled();
  });

  it("allows all users to view rates but limits refresh to finance roles", async () => {
    const { prisma, service } = makeService();
    prisma.cmpExchangeRateBatch.findFirst.mockResolvedValue(makeBatch());

    await expect(
      service.settings({ ...manager, globalRole: "STAFF" } as RequestUser)
    ).resolves.toMatchObject({ canRefresh: false });
    await expect(
      service.refresh({ ...manager, globalRole: "STAFF" } as RequestUser)
    ).rejects.toMatchObject({ status: 403 });
  });
});
