// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmationDateField } from "./confirmation-date-field";
afterEach(cleanup);
const props = {
  id: "date",
  label: "Date",
  locale: "en-US",
  placeholder: "Date",
  readOnly: false,
  style: {},
  chooseLabel: "Choose date",
  clearLabel: "Clear",
  todayLabel: "Today",
  value: "2026-07-29",
};
describe("ConfirmationDateField", () => {
  it("opens the themed calendar and commits a selected ISO date", async () => {
    const onCommit = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmationDateField {...props} onCommit={onCommit} />);
    expect(screen.getByLabelText("Date")).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Date: Choose date" }));
    expect(screen.getByTestId("confirmation-date-calendar")).toHaveClass(
      "bg-popover"
    );
    const day = document.querySelector('button[data-day="7/15/2026"]');
    expect(day).not.toBeNull();
    if (day) await user.click(day);
    expect(onCommit).toHaveBeenCalledWith("2026-07-15");
  });
  it("normalizes manual input and does not commit invalid dates", () => {
    const onCommit = vi.fn();
    render(<ConfirmationDateField {...props} onCommit={onCommit} />);
    const input = screen.getByLabelText("Date");
    fireEvent.change(input, { target: { value: "2026/8/3" } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenLastCalledWith("2026-08-03");
    onCommit.mockClear();
    fireEvent.change(input, { target: { value: "2026-02-31" } });
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue("2026-07-29");
  });
  it("clears dates and prevents opening a read-only calendar", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const { rerender } = render(
      <ConfirmationDateField {...props} onCommit={onCommit} />
    );
    await user.click(screen.getByRole("button", { name: "Date: Choose date" }));
    await user.click(
      screen.getByRole("button", { name: "Clear" })
    );
    expect(onCommit).toHaveBeenCalledWith("");
    rerender(<ConfirmationDateField {...props} readOnly onCommit={onCommit} />);
    expect(
      screen.getByRole("button", { name: "Date: Choose date" })
    ).toBeDisabled();
    expect(screen.getByLabelText("Date")).toHaveAttribute("readonly");
  });
});
