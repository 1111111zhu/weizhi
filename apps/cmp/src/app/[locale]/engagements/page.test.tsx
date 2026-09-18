import { describe, expect, it } from "vitest";

import CmpEngagementsPage from "./page";
import { CmpEngagementsClient } from "./page-client";

describe(CmpEngagementsPage, () => {
  it("opens the Client grouped view from query parameters", async () => {
    const page = await CmpEngagementsPage({
      searchParams: Promise.resolve({
        view: "client",
        clientId: "client-1",
      }),
    });

    expect(page.type).toBe(CmpEngagementsClient);
    expect(page.props).toMatchObject({
      initialView: "client",
      initialGroupedClientId: "client-1",
    });
  });

  it("does not treat a Client query as a new Engagement route", async () => {
    const page = await CmpEngagementsPage({
      searchParams: Promise.resolve({ clientId: "client-1" }),
    });

    expect(page.type).toBe(CmpEngagementsClient);
    expect(page.props).toMatchObject({
      initialView: "list",
      initialGroupedClientId: undefined,
    });
  });
});
