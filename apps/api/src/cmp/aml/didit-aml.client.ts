import { Injectable, Optional } from "@nestjs/common";

import { DiditAmlError } from "./didit-aml.error";
import { CmpAmlConfigurationService } from "./cmp-aml-configuration.service";

export { DiditAmlError } from "./didit-aml.error";

export type DiditAmlRequest = {
  full_name: string;
  entity_type: "person" | "company";
  date_of_birth?: string;
  nationality?: string;
  document_number?: string;
  include_adverse_media: false;
  include_ongoing_monitoring: false;
  save_api_request: true;
  vendor_data: string;
  metadata: Record<string, string>;
};

export type DiditAmlHit = Record<string, unknown> & {
  id?: string;
  match_score?: number;
  risk_score?: number;
  review_status?: string;
};

export type DiditAmlResponse = {
  request_id: string;
  created_at?: string;
  aml: {
    status: "Approved" | "In Review" | "Declined";
    total_hits: number;
    score: number;
    hits: DiditAmlHit[];
    warnings: unknown[];
  };
};

@Injectable()
export class DiditAmlClient {
  constructor(
    @Optional()
    private readonly configuration?: CmpAmlConfigurationService
  ) {}

  get enabled() {
    return process.env.PROJECT_WING_DIDIT_AML_ENABLED === "true";
  }

  get configured() {
    return this.enabled && Boolean(this.apiKey);
  }

  async getStatus() {
    if (this.configuration) {
      return this.configuration.getStatus();
    }
    const apiKey = this.apiKey;
    return {
      enabled: this.enabled,
      configured: this.enabled && Boolean(apiKey),
      source: this.enabled && apiKey ? ("ENVIRONMENT" as const) : null,
      updatedAt: null,
      updatedBy: null,
      apiKey: this.enabled && apiKey ? apiKey : null,
    };
  }

  async screen(input: DiditAmlRequest, idempotencyKey: string) {
    const response = await this.request("/v3/aml/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(input),
    });
    return parseDiditAmlResponse(response);
  }

  async updateHitStatus(
    sessionId: string,
    hitId: string,
    reviewStatus: string
  ) {
    await this.request(
      `/v3/session/${encodeURIComponent(sessionId)}/update-aml-hit-status/`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hit_id: hitId, review_status: reviewStatus }),
      }
    );
  }

  async deleteSession(sessionId: string) {
    try {
      await this.request(
        `/v3/session/${encodeURIComponent(sessionId)}/delete/`,
        { method: "DELETE" }
      );
    } catch (error) {
      if (error instanceof DiditAmlError && error.status === 404) {
        return;
      }
      throw error;
    }
  }

  private get apiKey() {
    return process.env.PROJECT_WING_DIDIT_API_KEY?.trim() ?? "";
  }

  private get baseUrl() {
    return (
      process.env.PROJECT_WING_DIDIT_BASE_URL?.trim() ||
      "https://verification.didit.me"
    ).replace(/\/+$/, "");
  }

  private get timeoutMs() {
    const parsed = Number(process.env.PROJECT_WING_DIDIT_TIMEOUT_MS);
    return Number.isFinite(parsed) && parsed >= 1000 ? parsed : 30_000;
  }

  private async request(path: string, init: RequestInit) {
    const configuration = await this.getStatus();
    if (!configuration.configured || !configuration.apiKey) {
      throw new DiditAmlError(
        "DIDIT_NOT_CONFIGURED",
        "Didit AML screening is not configured"
      );
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(`${this.baseUrl}${path}`, {
          ...init,
          signal: controller.signal,
          headers: {
            ...init.headers,
            "x-api-key": configuration.apiKey,
          },
        });
        const text = await response.text();
        const body = parseJson(text);
        if (!response.ok) {
          const error = new DiditAmlError(
            `DIDIT_HTTP_${response.status}`,
            providerErrorMessage(body, response.status),
            response.status,
            response.status >= 500
          );
          if (error.retryable && attempt === 0) {
            lastError = error;
            await shortRetryDelay();
            continue;
          }
          throw error;
        }
        return body;
      } catch (error) {
        const normalized = normalizeNetworkError(error);
        if (normalized.retryable && attempt === 0) {
          lastError = normalized;
          await shortRetryDelay();
          continue;
        }
        throw normalized;
      } finally {
        clearTimeout(timeout);
      }
    }
    throw normalizeNetworkError(lastError);
  }
}

function parseDiditAmlResponse(value: unknown): DiditAmlResponse {
  const root = asRecord(value);
  const aml = asRecord(root.aml);
  const { status } = aml;
  if (
    typeof root.request_id !== "string" ||
    (status !== "Approved" &&
      status !== "In Review" &&
      status !== "Declined") ||
    !Array.isArray(aml.hits)
  ) {
    throw new DiditAmlError(
      "DIDIT_INVALID_RESPONSE",
      "Didit returned an invalid AML response"
    );
  }
  return {
    request_id: root.request_id,
    created_at:
      typeof root.created_at === "string" ? root.created_at : undefined,
    aml: {
      status,
      total_hits: numberOr(aml.total_hits, aml.hits.length),
      score: numberOr(aml.score, 0),
      hits: aml.hits.filter(isRecord),
      warnings: Array.isArray(aml.warnings) ? aml.warnings : [],
    },
  };
}

function parseJson(value: string): unknown {
  if (!value) {
    return {};
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return { detail: value.slice(0, 300) };
  }
}

function providerErrorMessage(value: unknown, status: number) {
  const body = asRecord(value);
  const detail = [body.detail, body.message, body.error].find(
    (item) => typeof item === "string" && item.trim()
  );
  return typeof detail === "string"
    ? detail.slice(0, 300)
    : `Didit AML request failed with status ${status}`;
}

function normalizeNetworkError(error: unknown) {
  if (error instanceof DiditAmlError) {
    return error;
  }
  if (error instanceof Error && error.name === "AbortError") {
    return new DiditAmlError(
      "DIDIT_TIMEOUT",
      "Didit AML request timed out",
      undefined,
      true
    );
  }
  return new DiditAmlError(
    "DIDIT_NETWORK_ERROR",
    "Didit AML request could not be completed",
    undefined,
    true
  );
}

function shortRetryDelay() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 150);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
