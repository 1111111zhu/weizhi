// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ConfirmationMobileDirectoryProvider,
  ConfirmationMobileHeading,
} from "./confirmation-mobile-heading";

describe("confirmation mobile heading", () => {
  afterEach(cleanup);

  it("keeps the directory action in the current heading rather than a separate row", () => {
    const onOpen = vi.fn();
    render(
      <ConfirmationMobileDirectoryProvider locale="zh-CN" onOpen={onOpen}>
        <ConfirmationMobileHeading title="全部函证" count={2} />
      </ConfirmationMobileDirectoryProvider>
    );
    const heading = screen.getByTestId("confirmation-mobile-heading");
    expect(
      within(heading).getByRole("heading", { name: "全部函证" })
    ).toBeVisible();
    expect(within(heading).getByText("2")).toBeVisible();
    const trigger = within(heading).getByRole("button", { name: "函证目录" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveTextContent("");
    fireEvent.click(trigger);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("does not add an inoperative directory button outside the mobile workspace", () => {
    const onOpen = vi.fn();
    const view = render(
      <ConfirmationMobileDirectoryProvider locale="en-US" onOpen={onOpen}>
        <ConfirmationMobileHeading title="Confirmation overview" />
      </ConfirmationMobileDirectoryProvider>
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledOnce();
    view.rerender(<ConfirmationMobileHeading title="Confirmation overview" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("heading")).toHaveTextContent(
      "Confirmation overview"
    );
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
