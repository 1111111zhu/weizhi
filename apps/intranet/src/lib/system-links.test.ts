import { describe, expect, test } from "vitest";

import { buildSystemLinks } from "./system-links";

describe("intranet system links", () => {
  test("supports configured local EMP and CMP services without changing their home paths", () => {
    const links = buildSystemLinks({
      empUrl: "http://127.0.0.1:3048",
      cmpUrl: "http://127.0.0.1:3052/old",
    });
    expect(links[0].href).toBe("http://127.0.0.1:3048/zh-CN/engagement");
    expect(links[1].href).toBe("http://127.0.0.1:3052/zh-CN/client");
  });

  test("uses the local TMS canonical home when no deploy domain is configured", () => {
    const links = buildSystemLinks({});

    expect(links.find((link) => link.name === "TMS")?.href).toBe(
      "http://localhost:3004/zh-CN/timesheet"
    );
  });

  test("uses the deployed TMS canonical home when a deploy domain is configured", () => {
    const links = buildSystemLinks({ domainSuffix: "superfx.cn" });

    expect(links.find((link) => link.name === "TMS")?.href).toBe(
      "https://tms.superfx.cn/zh-CN/timesheet"
    );
  });

  test("normalizes a custom TMS URL to its canonical home", () => {
    const links = buildSystemLinks({
      tmsUrl: "https://times.example.com/workspace?tenant=zenith",
    });

    expect(links.find((link) => link.name === "TMS")?.href).toBe(
      "https://times.example.com/zh-CN/timesheet"
    );
  });

  test("opens each local subsystem through its canonical home", () => {
    const links = buildSystemLinks({});

    expect(links.map((link) => link.name)).toStrictEqual(["EMP", "CMP", "TMS"]);
    expect(links.find((link) => link.name === "EMP")?.href).toBe(
      "http://localhost:3001/zh-CN/engagement"
    );
    expect(links.find((link) => link.name === "CMP")?.href).toBe(
      "http://localhost:3002/zh-CN/client"
    );
    expect(links.find((link) => link.name === "TMS")?.href).toBe(
      "http://localhost:3004/zh-CN/timesheet"
    );
  });

  test("opens the deployed EMP system through its canonical home", () => {
    const links = buildSystemLinks({ domainSuffix: "superfx.cn" });

    expect(links.find((link) => link.name === "EMP")?.href).toBe(
      "https://emp.superfx.cn/zh-CN/engagement"
    );
    expect(links.find((link) => link.name === "CMP")?.href).toBe(
      "https://cmp.superfx.cn/zh-CN/client"
    );
    expect(links.find((link) => link.name === "TMS")?.href).toBe(
      "https://tms.superfx.cn/zh-CN/timesheet"
    );
  });

  test("keeps subsystem destinations in the selected locale", () => {
    const links = buildSystemLinks({ locale: "en-US" });

    expect(links.find((link) => link.name === "EMP")?.href).toBe(
      "http://localhost:3001/en-US/engagement"
    );
    expect(links.find((link) => link.name === "CMP")?.href).toBe(
      "http://localhost:3002/en-US/client"
    );
    expect(links.find((link) => link.name === "TMS")?.href).toBe(
      "http://localhost:3004/en-US/timesheet"
    );
  });
});
