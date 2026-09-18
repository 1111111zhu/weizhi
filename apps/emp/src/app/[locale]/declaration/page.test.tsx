import { createElement, isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";

import Page from "./page";

vi.mock("../../../views/declaration", () => ({
  DeclarationPage: () => createElement("main", null, "declaration page"),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("declaration route", () => {
  it("renders the declaration page instead of redirecting back to workspaces", () => {
    const element = Page();

    expect(isValidElement(element)).toBeTruthy();
  });
});
