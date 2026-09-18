// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Tabs, TabsList, TabsTrigger } from "./tabs";

describe(Tabs, () => {
  it("passes vertical orientation through to the accessible tablist", () => {
    render(
      <Tabs defaultValue="all" orientation="vertical">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="review">Review</TabsTrigger>
        </TabsList>
      </Tabs>
    );

    const tablist = screen.getByRole("tablist");
    expect(tablist).toHaveAttribute("aria-orientation", "vertical");
    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute(
      "data-orientation",
      "vertical"
    );
  });
});
