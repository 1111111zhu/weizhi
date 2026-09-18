import { cleanup, render, screen, waitFor } from "@testing-library/react";
// @vitest-environment jsdom
import userEvent from "@testing-library/user-event";
import { describe, afterEach, expect, it, vi } from "vitest";

import { ConfirmationReceivedDateField } from "./confirmation-received-date-field";

describe("confirmation behavior", () => {
  afterEach(cleanup);

  it("keeps the local time when choosing a date and the date when choosing an hour", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ConfirmationReceivedDateField
        id="received"
        label="Received at"
        locale="en-US"
        value="2026-09-08T23:06"
        onChange={onChange}
      />
    );
    await user.click(screen.getByRole("button", { name: "Received at" }));
    await user.click(
      screen.getByRole("button", { name: /September 9th, 2026/ })
    );
    expect(onChange).toHaveBeenLastCalledWith("2026-09-09T23:06");
    await user.click(screen.getByRole("combobox", { name: "Hour" }));
    await user.click(screen.getByRole("option", { name: /^08$/ }));
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith("2026-09-08T08:06")
    );
  });
});
