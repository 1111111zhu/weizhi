// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input } from "./input";

describe(Input, () => {
  it("disables browser history suggestions by default", () => {
    render(<Input aria-label="Template name" />);

    expect(
      screen.getByRole("textbox", { name: "Template name" })
    ).toHaveAttribute("autocomplete", "off");
  });

  it("preserves an explicit autocomplete mode", () => {
    render(<Input aria-label="Email" autoComplete="email" />);

    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute(
      "autocomplete",
      "email"
    );
  });
});
