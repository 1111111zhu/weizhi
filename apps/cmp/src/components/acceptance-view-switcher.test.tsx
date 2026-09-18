import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AcceptanceViewSwitcher } from "./acceptance-view-switcher";

const defaultProps = {
  canAccessApprovals: true,
  requestsLabel: "My Requests",
  approvalsLabel: "My Approvals",
  ariaLabel: "Acceptance workspace",
};

describe(AcceptanceViewSwitcher, () => {
  it("renders one button that switches to the other view", () => {
    const onTabChange = vi.fn();
    const { rerender } = render(
      <AcceptanceViewSwitcher
        {...defaultProps}
        activeTab="requests"
        onTabChange={onTabChange}
      />
    );
    const toggle = screen.getByRole("button", {
      name: "Acceptance workspace: My Approvals",
    });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveTextContent("My Approvals");

    fireEvent.click(toggle);
    expect(onTabChange).toHaveBeenCalledWith("approvals");

    rerender(
      <AcceptanceViewSwitcher
        {...defaultProps}
        activeTab="approvals"
        onTabChange={onTabChange}
      />
    );

    const requestsToggle = screen.getByRole("button", {
      name: "Acceptance workspace: My Requests",
    });
    expect(requestsToggle).toHaveAttribute("aria-pressed", "true");
    expect(requestsToggle).toHaveTextContent("My Requests");
  });

  it("does not render for a role without approval access", () => {
    render(
      <AcceptanceViewSwitcher
        {...defaultProps}
        activeTab="requests"
        canAccessApprovals={false}
        onTabChange={vi.fn()}
      />
    );

    expect(screen.queryByRole("button")).toBeNull();
  });
});
