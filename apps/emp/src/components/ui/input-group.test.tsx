// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "./input-group";

describe("InputGroupAddon interaction contract", () => {
  afterEach(cleanup);

  it("does not style an editable input as disabled just because its action is disabled", () => {
    const { container } = render(
      <InputGroup>
        <InputGroupInput aria-label="Amount" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton disabled>Apply</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    );
    expect(screen.getByRole("textbox", { name: "Amount" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    const group = container.querySelector('[data-slot="input-group"]');
    expect(group).toHaveClass(
      "has-[[data-slot=input-group-control]:disabled]:opacity-50"
    );
    expect(group).not.toHaveClass("has-disabled:opacity-50");
  });

  it("does not create a phantom button or steal a child action's keyboard event", async () => {
    const apply = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <InputGroup>
        <InputGroupInput aria-label="Amount" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton onClick={apply}>Apply</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    );
    expect(screen.getAllByRole("button", { name: "Apply" })).toHaveLength(1);
    expect(
      container.querySelector('[data-slot="input-group-addon"]')
    ).not.toHaveAttribute("role");
    expect(
      container.querySelector('[data-slot="input-group-addon"]')
    ).not.toHaveAttribute("tabindex");
    await user.tab();
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Apply" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(apply).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Apply" })).toHaveFocus();
  });

  it("lets pointer users focus the input from a decorative prefix", async () => {
    const user = userEvent.setup();
    render(
      <InputGroup>
        <InputGroupAddon>HK$</InputGroupAddon>
        <InputGroupInput aria-label="Amount" />
      </InputGroup>
    );
    await user.click(screen.getByText("HK$"));
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveFocus();
    expect(
      screen.queryByRole("button", { name: "HK$" })
    ).not.toBeInTheDocument();
  });
});
