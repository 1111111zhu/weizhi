import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
// @vitest-environment happy-dom
import "@testing-library/jest-dom/vitest";

import { HoursInput } from "./hours-input";

describe(HoursInput, () => {
  it("keeps direct typing intact after clearing the existing value", () => {
    const onChange = vi.fn();

    render(
      <HoursInput
        aria-label="Hours"
        disabled={false}
        onChange={onChange}
        value={0}
      />
    );

    const input = screen.getByRole("textbox", { name: "Hours" });
    expect(input).toHaveAttribute("type", "text");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.change(input, { target: { value: "12" } });

    expect(input).toHaveValue("12");
    expect(onChange).toHaveBeenLastCalledWith("12");

    fireEvent.blur(input);
    expect(input).toHaveValue("12.0");
  });
});
