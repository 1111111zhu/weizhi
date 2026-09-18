// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
afterEach(cleanup);
it("opens below the trigger and preserves selection and escape behavior", async () => {
  const change = vi.fn();
  const user = userEvent.setup();
  render(<Select defaultValue="first" onValueChange={change}><SelectTrigger aria-label="Sort"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="first">First</SelectItem><SelectItem value="second">Second</SelectItem></SelectContent></Select>);
  await user.click(screen.getByRole("combobox"));
  expect((await screen.findByRole("listbox")).closest("[data-slot=select-content]")).toHaveAttribute("data-align-trigger", "false");
  await user.click(screen.getByRole("option", {name:"Second"}));
  expect(change).toHaveBeenCalledWith("second", expect.anything());
  await waitFor(() => {
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
  await user.click(screen.getByRole("combobox"));
  await screen.findByRole("listbox");
  await user.keyboard("{Escape}");
  await waitFor(() => {
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveFocus();
  });
});
