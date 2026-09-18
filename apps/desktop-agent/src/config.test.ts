import { describe, expect, it } from "vitest";

import {
  DEFAULT_AGENT_FETCH_TIMEOUT_MS,
  DEFAULT_AGENT_WORKER_PORT,
  DEFAULT_PDF_MASTER_OPEN_OBSERVATION_TIMEOUT_MS,
  getAgentRuntimeRole,
  getAgentWorkerPort,
  getAllowedAuthOrigins,
  getAllowedDownloadOrigins,
  getAllowedWebOrigins,
  getAuthBaseUrl,
  getDesktopAgentFetchTimeoutMs,
  getPdfMasterOpenObservationTimeoutMs,
} from "./config.js";

describe("desktop agent config", () => {
  it("allows control-plane requests enough time for transient latency", () => {
    expect(getDesktopAgentFetchTimeoutMs({} as NodeJS.ProcessEnv)).toBe(
      DEFAULT_AGENT_FETCH_TIMEOUT_MS
    );
    expect(DEFAULT_AGENT_FETCH_TIMEOUT_MS).toBe(60_000);
  });

  it("uses the central auth host and permits an environment-specific override", () => {
    expect(getAuthBaseUrl({} as NodeJS.ProcessEnv)).toBe(
      "https://auth.superfx.cn"
    );
    expect(
      getAuthBaseUrl({
        PROJECT_WING_AGENT_AUTH_BASE_URL: "https://auth.wzcpa.hk/",
      } as NodeJS.ProcessEnv)
    ).toBe("https://auth.wzcpa.hk");
  });

  it("allows the deployed preview origin by default", () => {
    expect(getAllowedWebOrigins({})).toContain("https://wing.superfx.cn");
    expect(getAllowedDownloadOrigins({})).toContain("https://wing.superfx.cn");
    expect(getAllowedWebOrigins({})).toStrictEqual(
      expect.arrayContaining(["https://emp.superfx.cn", "https://emp.wzcpa.hk"])
    );
    expect(getAllowedDownloadOrigins({})).toStrictEqual(
      expect.arrayContaining(["https://emp.superfx.cn", "https://emp.wzcpa.hk"])
    );
  });

  it("allows only Project Wing auth origins by default", () => {
    expect(getAllowedAuthOrigins({})).toStrictEqual(
      expect.arrayContaining([
        "https://auth.superfx.cn",
        "https://auth.wzcpa.hk",
      ])
    );
    expect(getAllowedAuthOrigins({})).not.toContain(
      "https://auth.example.test"
    );
  });

  it("defaults to standalone agent runtime role", () => {
    expect(getAgentRuntimeRole({} as NodeJS.ProcessEnv)).toBe("standalone");
  });

  it("reads worker runtime role from the environment", () => {
    expect(
      getAgentRuntimeRole({
        PROJECT_WING_AGENT_RUNTIME_ROLE: "worker",
      } as NodeJS.ProcessEnv)
    ).toBe("worker");
  });

  it("falls back to the default worker port for invalid values", () => {
    expect(getAgentWorkerPort({} as NodeJS.ProcessEnv)).toBe(
      DEFAULT_AGENT_WORKER_PORT
    );
    expect(
      getAgentWorkerPort({
        PROJECT_WING_AGENT_WORKER_PORT: "abc",
      } as NodeJS.ProcessEnv)
    ).toBe(DEFAULT_AGENT_WORKER_PORT);
  });

  it("reads a valid worker port from the environment", () => {
    expect(
      getAgentWorkerPort({
        PROJECT_WING_AGENT_WORKER_PORT: "18080",
      } as NodeJS.ProcessEnv)
    ).toBe(18_080);
  });

  it("uses a longer PDF Master open observation timeout by default", () => {
    expect(getPdfMasterOpenObservationTimeoutMs({} as NodeJS.ProcessEnv)).toBe(
      DEFAULT_PDF_MASTER_OPEN_OBSERVATION_TIMEOUT_MS
    );
    expect(DEFAULT_PDF_MASTER_OPEN_OBSERVATION_TIMEOUT_MS).toBeGreaterThan(
      20_000
    );
  });

  it("reads a valid PDF Master open observation timeout from the environment", () => {
    expect(
      getPdfMasterOpenObservationTimeoutMs({
        PROJECT_WING_AGENT_PDF_OPEN_OBSERVATION_TIMEOUT_MS: "45000",
      } as NodeJS.ProcessEnv)
    ).toBe(45_000);
    expect(
      getPdfMasterOpenObservationTimeoutMs({
        PROJECT_WING_AGENT_PDF_OPEN_OBSERVATION_TIMEOUT_MS: "-1",
      } as NodeJS.ProcessEnv)
    ).toBe(DEFAULT_PDF_MASTER_OPEN_OBSERVATION_TIMEOUT_MS);
  });
});
