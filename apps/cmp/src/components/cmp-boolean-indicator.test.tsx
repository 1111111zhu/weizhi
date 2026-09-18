import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CmpBooleanIndicator } from "./cmp-boolean-indicator";

describe(CmpBooleanIndicator, () => {
  it.each([
    { value: true, expectedName: "Active: Yes" },
    { value: false, expectedName: "Active: No" },
  ])("exposes the $expectedName state", ({ expectedName, value }) => {
    render(
      <CmpBooleanIndicator
        label="Active"
        noLabel="No"
        value={value}
        yesLabel="Yes"
      />
    );

    expect(screen.getByRole("img", { name: expectedName })).toBeInTheDocument();
  });
});
