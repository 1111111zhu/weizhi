import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SmartFormV2RequiredIndicator } from "./smart-form-v2-required-indicator";

// @vitest-environment jsdom

describe(SmartFormV2RequiredIndicator, () => {
  afterEach(() => cleanup());

  it("shows a red star only for required fields", () => {
    const view = render(
      <SmartFormV2RequiredIndicator
        required
        requiredLabel="Required"
        optionalLabel="Optional"
      />
    );

    expect(screen.getByTitle("Required")).toHaveTextContent("*");
    expect(screen.getByTitle("Required")).toHaveClass("text-destructive");

    view.rerender(
      <SmartFormV2RequiredIndicator
        required={false}
        requiredLabel="Required"
        optionalLabel="Optional"
      />
    );
    const optional = view.container.querySelector(
      '[data-smart-form-required-state="optional"]'
    );
    expect(optional).toHaveClass("sr-only");
    expect(optional).toHaveTextContent("Optional");
    expect(view.container.querySelectorAll('[title="Optional"]')).toHaveLength(
      0
    );
  });
});
