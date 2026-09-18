import {
  getProjectWingBrowserEnvironmentPrefix,
  getProjectWingBrowserTitle,
} from "@project-wing/ui";
import { describe, expect, it } from "vitest";

describe("project Wing browser chrome", () => {
  it("marks local previews connected to the backend", () => {
    expect(
      getProjectWingBrowserEnvironmentPrefix({
        app: "TMS",
        environment: {
          apiBaseUrl: "http://localhost:3000",
          localBackend: true,
        },
        hostname: "localhost",
      })
    ).toBe("[Local]");
  });

  it("labels TMS localhost mode as local without an API mode", () => {
    expect(
      getProjectWingBrowserEnvironmentPrefix({
        app: "TMS",
        environment: { localBackend: true },
        hostname: "127.0.0.1",
      })
    ).toBe("[Local]");
  });

  it("names the EMP home and project routes explicitly", () => {
    expect(
      getProjectWingBrowserTitle({
        app: "EMP",
        environment: { apiMode: "mock", localBackend: true },
        hostname: "localhost",
        pathname: "/zh-CN/engagement",
      })
    ).toBe("[Mock] EMP · 项目面板");

    expect(
      getProjectWingBrowserTitle({
        app: "EMP",
        environment: { apiMode: "mock", localBackend: true },
        hostname: "localhost",
        pathname: "/zh-CN/engagement/project-1",
      })
    ).toBe("[Mock] EMP · 工作台");
  });
});
