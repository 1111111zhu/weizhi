import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DiditAmlClient } from "./didit-aml.client";

const request = {
  full_name: "Example Limited",
  entity_type: "company" as const,
  include_adverse_media: false as const,
  include_ongoing_monitoring: false as const,
  save_api_request: true as const,
  vendor_data: "acceptance-1",
  metadata: { project_wing_acceptance_id: "acceptance-1" },
};

function amlResponse(status = 200) {
  return Response.json(
    {
      request_id: "didit-request-1",
      aml: {
        status: "Approved",
        total_hits: 0,
        score: 0,
        hits: [],
        warnings: [],
      },
    },
    { status }
  );
}

describe(DiditAmlClient, () => {
  beforeEach(() => {
    vi.stubEnv("PROJECT_WING_DIDIT_AML_ENABLED", "true");
    vi.stubEnv("PROJECT_WING_DIDIT_API_KEY", "test-api-key");
    vi.stubEnv("PROJECT_WING_DIDIT_BASE_URL", "https://didit.example");
    vi.stubEnv("PROJECT_WING_DIDIT_TIMEOUT_MS", "1000");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("sends the API key, idempotency key and fixed AML request fields", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(amlResponse());

    const result = await new DiditAmlClient().screen(request, "key");

    expect(result.aml.status).toBe("Approved");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://didit.example/v3/aml/");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "key",
        "x-api-key": "test-api-key",
      },
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      include_adverse_media: false,
      include_ongoing_monitoring: false,
      save_api_request: true,
    });
  });

  it("retries one 5xx response with the same idempotency key", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({ detail: "temporary" }, { status: 503 })
      )
      .mockResolvedValueOnce(amlResponse());

    await new DiditAmlClient().screen(request, "stable-key");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.headers).toMatchObject({ "Idempotency-Key": "stable-key" });
      expect(init?.body).toBe(JSON.stringify(request));
    }
  });

  it("retries one network timeout with the same idempotency key", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new DOMException("Timed out", "AbortError"))
      .mockResolvedValueOnce(amlResponse());

    await new DiditAmlClient().screen(request, "timeout-stable-key");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.headers).toMatchObject({
        "Idempotency-Key": "timeout-stable-key",
      });
    }
  });

  it("does not retry a 4xx response", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        Response.json({ detail: "invalid request" }, { status: 400 })
      );

    await expect(
      new DiditAmlClient().screen(request, "key")
    ).rejects.toMatchObject({
      code: "DIDIT_HTTP_400",
      status: 400,
      retryable: false,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("updates hit status and treats an already-deleted session as success", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 404 }));
    const client = new DiditAmlClient();

    await client.updateHitStatus("session/id", "hit-1", "Confirmed Match");
    await client.deleteSession("session/id");

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://didit.example/v3/session/session%2Fid/update-aml-hit-status/"
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({
        hit_id: "hit-1",
        review_status: "Confirmed Match",
      }),
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://didit.example/v3/session/session%2Fid/delete/"
    );
  });
});
