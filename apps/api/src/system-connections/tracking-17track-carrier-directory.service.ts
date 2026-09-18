import { Injectable, Logger } from "@nestjs/common";

const CARRIER_DIRECTORY_URL =
  "https://res.17track.net/asset/carrier/info/apicarrier.all.json";
const CARRIER_REQUIREMENTS_URL =
  "https://res.17track.net/asset/carrier/info/additional_parameters.json";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SEARCH_RESULT_LIMIT = 40;

type RawCarrier = {
  key?: unknown;
  _country_iso?: unknown;
  _name?: unknown;
  "_name_zh-cn"?: unknown;
};

type RawCarrierRequirement = {
  key?: unknown;
  name?: unknown;
  parameters?: unknown;
};

type RawCarrierRequirementParameter = {
  description?: unknown;
  options?: unknown;
  paramKey?: unknown;
  require?: unknown;
  sample?: unknown;
};

export type Tracking17TrackCarrier = {
  code: number;
  countryIso: string | null;
  name: string;
  nameZh: string;
  requirements: Tracking17TrackCarrierRequirement[];
};

export type Tracking17TrackCarrierRequirement = {
  key: string;
  description: string;
  options: Record<string, string> | null;
  required: boolean;
  sample: string | null;
};

@Injectable()
export class Tracking17TrackCarrierDirectoryService {
  private readonly logger = new Logger(
    Tracking17TrackCarrierDirectoryService.name
  );
  private cache:
    | { carriers: Tracking17TrackCarrier[]; expiresAt: number }
    | undefined;
  private requirementsCache:
    | {
        byCarrierCode: Map<number, Tracking17TrackCarrierRequirement[]>;
        expiresAt: number;
      }
    | undefined;

  async search(query: string) {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) {
      return [];
    }

    const [carriers, requirementsByCarrierCode] = await Promise.all([
      this.loadCarriers(),
      this.loadRequirements(),
    ]);
    return carriers
      .map((carrier) => ({
        carrier,
        score: matchScore(carrier, normalizedQuery),
      }))
      .filter((entry) => entry.score >= 0)
      .sort(
        (left, right) =>
          left.score - right.score ||
          left.carrier.nameZh.localeCompare(right.carrier.nameZh, "zh-CN")
      )
      .slice(0, SEARCH_RESULT_LIMIT)
      .map((entry) => ({
        ...entry.carrier,
        requirements: requirementsByCarrierCode.get(entry.carrier.code) ?? [],
      }));
  }

  async validateQueryParameters(
    carrierCode: number | undefined,
    input: Record<string, string> | undefined
  ) {
    const supplied = Object.entries(input ?? {}).filter(([, value]) =>
      Boolean(value.trim())
    );
    if (!carrierCode) {
      if (
        supplied.some(
          ([key, value]) =>
            key !== "phone_number_last_4" || !/^\d{4}$/.test(value.trim())
        )
      ) {
        throw new Error(
          "请填写四位数字的手机号后四位；其他查询信息需要选择运输商"
        );
      }
      return Object.fromEntries(
        supplied.map(([key, value]) => [key, value.trim()])
      );
    }

    const requirementsByCarrier = await this.loadRequirements();
    const requirements = requirementsByCarrier.get(carrierCode) ?? [];
    if (requirements.length === 0) {
      if (supplied.length > 0) {
        throw new Error("该运输商不接受额外查询信息");
      }
      return {};
    }

    const allowed = new Map(
      requirements.map((requirement) => [requirement.key, requirement])
    );
    for (const [key] of supplied) {
      if (!allowed.has(key)) {
        throw new Error("包含不受支持的运输商查询信息");
      }
    }
    for (const requirement of requirements) {
      if (requirement.required && !input?.[requirement.key]?.trim()) {
        throw new Error(`请填写 ${requirement.description || requirement.key}`);
      }
    }
    return Object.fromEntries(
      supplied.map(([key, value]) => [key, value.trim()])
    );
  }

  private async loadCarriers() {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache.carriers;
    }

    try {
      const response = await fetch(CARRIER_DIRECTORY_URL, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        throw new Error(`carrier directory responded with ${response.status}`);
      }
      const payload = (await response.json()) as unknown;
      if (!Array.isArray(payload)) {
        throw new TypeError("carrier directory response is not an array");
      }
      const carriers = payload
        .map(parseCarrier)
        .filter((carrier): carrier is Tracking17TrackCarrier =>
          Boolean(carrier)
        );
      if (carriers.length === 0) {
        throw new Error("carrier directory response is empty");
      }
      this.cache = {
        carriers,
        expiresAt: Date.now() + CACHE_TTL_MS,
      };
      return carriers;
    } catch (error) {
      if (this.cache) {
        this.logger.warn(
          `Using stale 17TRACK carrier directory: ${safeMessage(error)}`
        );
        return this.cache.carriers;
      }
      throw error;
    }
  }

  private async loadRequirements() {
    if (
      this.requirementsCache &&
      this.requirementsCache.expiresAt > Date.now()
    ) {
      return this.requirementsCache.byCarrierCode;
    }

    try {
      const response = await fetch(CARRIER_REQUIREMENTS_URL, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        throw new Error(
          `carrier requirements responded with ${response.status}`
        );
      }
      const payload = (await response.json()) as unknown;
      if (!Array.isArray(payload)) {
        throw new TypeError("carrier requirements response is not an array");
      }
      const byCarrierCode = new Map(
        payload
          .map(parseCarrierRequirements)
          .filter(
            (
              entry
            ): entry is {
              code: number;
              requirements: Tracking17TrackCarrierRequirement[];
            } => Boolean(entry)
          )
          .map((entry) => [entry.code, entry.requirements])
      );
      this.requirementsCache = {
        byCarrierCode,
        expiresAt: Date.now() + CACHE_TTL_MS,
      };
      return byCarrierCode;
    } catch (error) {
      if (this.requirementsCache) {
        this.logger.warn(
          `Using stale 17TRACK carrier requirements: ${safeMessage(error)}`
        );
        return this.requirementsCache.byCarrierCode;
      }
      this.logger.warn(
        `17TRACK carrier requirements unavailable: ${safeMessage(error)}`
      );
      return new Map<number, Tracking17TrackCarrierRequirement[]>();
    }
  }
}

function parseCarrier(value: unknown): Tracking17TrackCarrier | null {
  if (!isRecord(value)) {
    return null;
  }
  const raw = value as RawCarrier;
  const code = typeof raw.key === "number" ? raw.key : Number(raw.key);
  const name = stringOrNull(raw._name);
  if (!Number.isInteger(code) || code <= 0 || !name) {
    return null;
  }
  return {
    code,
    countryIso: stringOrNull(raw._country_iso),
    name,
    nameZh: stringOrNull(raw["_name_zh-cn"]) ?? name,
    requirements: [],
  };
}

function parseCarrierRequirements(
  value: unknown
): { code: number; requirements: Tracking17TrackCarrierRequirement[] } | null {
  if (!isRecord(value)) {
    return null;
  }
  const raw = value as RawCarrierRequirement;
  const code = typeof raw.key === "number" ? raw.key : Number(raw.key);
  if (!Number.isInteger(code) || code <= 0 || !Array.isArray(raw.parameters)) {
    return null;
  }
  const requirements = raw.parameters
    .map(parseCarrierRequirement)
    .filter((parameter): parameter is Tracking17TrackCarrierRequirement =>
      Boolean(parameter)
    );
  return requirements.length > 0 ? { code, requirements } : null;
}

function parseCarrierRequirement(
  value: unknown
): Tracking17TrackCarrierRequirement | null {
  if (!isRecord(value)) {
    return null;
  }
  const raw = value as RawCarrierRequirementParameter;
  const key = stringOrNull(raw.paramKey);
  if (!key || !/^[a-z][a-z0-9_]{0,63}$/.test(key)) {
    return null;
  }
  return {
    key,
    description: stringOrNull(raw.description) ?? key,
    options: parseOptions(raw.options),
    required: raw.require === true,
    sample: stringOrNull(raw.sample),
  };
}

function parseOptions(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }
  const entries = Object.entries(value)
    .filter(([, label]) => typeof label === "string" && label.trim())
    .map(([key, label]) => [key, (label as string).trim()] as const);
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function matchScore(carrier: Tracking17TrackCarrier, query: string) {
  const values = [
    carrier.code.toString(),
    normalize(carrier.nameZh),
    normalize(carrier.name),
    normalize(carrier.countryIso ?? ""),
  ];
  if (values.some((value) => value === query)) {
    return 0;
  }
  if (values.some((value) => value.startsWith(query))) {
    return 1;
  }
  if (values.some((value) => value.includes(query))) {
    return 2;
  }
  return -1;
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
