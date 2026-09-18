import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  CmpFormRouteShell,
  CmpFormRouteUnavailable,
} from "./cmp-form-route-shell";

describe(CmpFormRouteShell, () => {
  it("uses the canonical quiet action for route navigation", () => {
    const onBack = vi.fn();
    render(
      <CmpFormRouteShell title="Create client" onBack={onBack}>
        <p>Form content</p>
      </CmpFormRouteShell>
    );

    const back = screen.getByRole("button", { name: "Back" });
    expect(back).toHaveAttribute("data-variant", "quiet");
    expect(back).not.toHaveAttribute("data-legacy-variant");

    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("uses the shared full-width primary action for unavailable routes", () => {
    const onBack = vi.fn();
    render(
      <CmpFormRouteUnavailable
        title="Client form unavailable"
        message="You do not have permission."
        backLabel="Back to list"
        onBack={onBack}
      />
    );

    const back = screen.getByRole("button", { name: "Back to list" });
    expect(back).toHaveAttribute("data-variant", "primary");
    expect(back).toHaveAttribute("data-size", "lg");
    expect(back).toHaveAttribute("data-full-width", "true");
    expect(back).not.toHaveClass("cmp-primary-button");

    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledOnce();
  });
});
