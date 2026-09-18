import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
// @vitest-environment jsdom

import { ConfirmationColumnFilter } from "./confirmation-column-filter";

const labels = {
  triggerLabel: "Filter",
  searchLabel: "Search",
  clearLabel: "Clear",
  emptyLabel: "No options",
};

describe(ConfirmationColumnFilter, () => {
  afterEach(cleanup);

  it("adds and removes individual values without discarding other selections", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ConfirmationColumnFilter
        label="Current status"
        labels={labels}
        options={[
          { value: "DRAFT", label: "Draft" },
          { value: "PREPARED", label: "Frozen" },
        ]}
        selectedValues={["DRAFT"]}
        onChange={onChange}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Filter Current status" })
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Frozen" }));
    expect(onChange).toHaveBeenLastCalledWith(["DRAFT", "PREPARED"]);

    rerender(
      <ConfirmationColumnFilter
        label="Current status"
        labels={labels}
        options={[
          { value: "DRAFT", label: "Draft" },
          { value: "PREPARED", label: "Frozen" },
        ]}
        selectedValues={["DRAFT", "PREPARED"]}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Draft" }));
    expect(onChange).toHaveBeenLastCalledWith(["PREPARED"]);
  });
});
