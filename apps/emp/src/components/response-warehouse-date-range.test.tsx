import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResponseWarehouseDateRange } from "./response-warehouse-date-range";

// @vitest-environment jsdom

const DEFAULT_RANGE = { from: "2026-07-29", to: "2026-08-29" };

function renderRange(onChange = vi.fn(), values = DEFAULT_RANGE) {
  const result = render(
    <ResponseWarehouseDateRange
      clearLabel="Clear date range"
      from={values.from}
      fromLabel="From"
      locale="en-US"
      maximumDate={new Date(2026, 7, 29)}
      minimumDate={new Date(2026, 1, 28)}
      onChange={onChange}
      rangeLabel="Received date range"
      to={values.to}
      toLabel="To"
    />
  );
  return { ...result, onChange };
}

describe(ResponseWarehouseDateRange, () => {
  afterEach(cleanup);

  it("does not expose typed dates to browser form history", () => {
    renderRange();

    expect(screen.getByLabelText("From")).toHaveAttribute(
      "autocomplete",
      "off"
    );
    expect(screen.getByLabelText("To")).toHaveAttribute("autocomplete", "off");
  });

  it.each(["2026/8/1", "2026/08/01", "2026-8-1", "2026年8月1日"])(
    "accepts manual date format %s while opening the calendar on click",
    async (typedDate) => {
      const user = userEvent.setup();
      const { onChange } = renderRange();

      await user.click(screen.getByLabelText("From"));
      expect(
        screen.getByTestId("response-date-range-calendar")
      ).toHaveAttribute("data-open");

      await user.clear(screen.getByLabelText("From"));
      await user.type(screen.getByLabelText("From"), typedDate);

      expect(screen.getByLabelText("From")).toHaveValue(typedDate);
      expect(onChange).toHaveBeenCalledWith("2026-08-01", "2026-08-29");
      expect(
        screen.getByTestId("response-date-range-calendar")
      ).toHaveAttribute("data-open");
    }
  );

  it("does not pre-highlight today when the range is empty", () => {
    const { container } = renderRange(vi.fn(), { from: "", to: "" });

    fireEvent.click(
      screen.getByRole("button", { name: "Received date range" })
    );

    const today = container.ownerDocument.querySelector(
      'button[data-day="8/29/2026"]'
    ) as HTMLElement;
    expect(today.parentElement).not.toHaveClass("bg-muted");
  });

  it("clears both dates without opening the calendar", async () => {
    const user = userEvent.setup();
    const { onChange } = renderRange();

    await user.click(screen.getByRole("button", { name: "Clear date range" }));

    expect(onChange).toHaveBeenCalledWith("", "");
    expect(screen.queryByTestId("response-date-range-calendar")).toBeNull();
  });

  it("waits for the second calendar date before applying the range", async () => {
    const { container, onChange } = renderRange();
    fireEvent.click(
      screen.getByRole("button", { name: "Received date range" })
    );

    fireEvent.click(
      container.ownerDocument.querySelector('[data-day="7/1/2026"]') as Element
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("response-date-range-calendar")).toHaveAttribute(
      "data-open"
    );

    fireEvent.click(
      container.ownerDocument.querySelector('[data-day="7/2/2026"]') as Element
    );
    expect(onChange).toHaveBeenCalledWith("2026-07-01", "2026-07-02");
    await waitFor(() =>
      expect(screen.queryByTestId("response-date-range-calendar")).toBeNull()
    );
  });

  it("starts a fresh visual range when replacing existing dates", () => {
    const { container, onChange } = renderRange();
    fireEvent.click(
      screen.getByRole("button", { name: "Received date range" })
    );
    const day = (value: string) =>
      container.ownerDocument.querySelector(
        `button[data-day="${value}"]`
      ) as HTMLElement;

    fireEvent.click(day("7/10/2026"));

    expect(day("7/10/2026")).toHaveAttribute("data-range-start", "true");
    expect(day("7/11/2026")).not.toHaveAttribute(
      "data-selected-single",
      "true"
    );
    expect(day("7/20/2026")).not.toHaveAttribute(
      "data-selected-single",
      "true"
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("From")).toHaveValue("2026-07-29");
    expect(screen.getByLabelText("To")).toHaveValue("2026-08-29");
  });

  it("previews the full included range while choosing the end date", async () => {
    const user = userEvent.setup();
    const { container } = renderRange();
    fireEvent.click(
      screen.getByRole("button", { name: "Received date range" })
    );
    const day = (value: string) =>
      container.ownerDocument.querySelector(
        `button[data-day="${value}"]`
      ) as HTMLElement;

    fireEvent.click(day("7/1/2026"));
    await user.hover(day("7/5/2026"));

    await waitFor(() => {
      expect(day("7/1/2026")).toHaveAttribute("data-range-start", "true");
      expect(day("7/3/2026")).toHaveAttribute("data-range-middle", "true");
      expect(day("7/5/2026")).toHaveAttribute("data-range-end", "true");
    });

    await user.hover(day("7/3/2026"));
    await waitFor(() => {
      expect(day("7/3/2026")).toHaveAttribute("data-range-end", "true");
      expect(day("7/5/2026")).toHaveAttribute("data-range-end", "false");
    });
  });
});
