import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
// @vitest-environment jsdom

import type { ProjectConfirmation } from "../../api/client";
import { defaultConfirmationsCopy } from "../../i18n/dictionaries";
import { ConfirmationDetailPane } from "./confirmation-status-overview";

const confirmation: ProjectConfirmation = {
  id: "confirmation-1",
  projectId: "project-1",
  type: "BANK",
  status: "DRAFT",
  counterpartyName: "HSBC Hong Kong",
  confirmationCode: "HBR-2026-001",
  draftPayload: {},
  teamConfirmStatus: "PENDING",
  createdBy: "user-1",
  createdAt: "2026-07-28T08:00:00.000Z",
  updatedAt: "2026-07-29T08:00:00.000Z",
  dispatches: [],
  responses: [],
};

describe("lint test setup", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([false, true])("completes closing with reduced motion=%s", (reduced) => {
    vi.useFakeTimers();
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    vi.spyOn(window, "matchMedia").mockReturnValue({ ...media, matches: reduced });
    const onClose = vi.fn();
    render(
      <ConfirmationDetailPane
        title="Details"
        confirmations={[]}
        copy={defaultConfirmationsCopy}
        locale="en-US"
        onClose={onClose}
        onOpen={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("separator", { name: "Resize detail panel" }));
    expect(onClose).toHaveBeenCalledTimes(reduced ? 1 : 0);
    vi.runAllTimers();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the header on one row and resizes within the configured bounds", () => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    vi.spyOn(window, "matchMedia").mockReturnValue({ ...media, matches: false });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 1500,
      height: 900,
      top: 0,
      right: 1500,
      bottom: 900,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const onClose = vi.fn();

    render(
      <div>
        <ConfirmationDetailPane
          title="Harbour accounting support · Draft"
          confirmations={[confirmation]}
          copy={defaultConfirmationsCopy}
          locale="en-US"
          minWidth={520}
          defaultWidth={720}
          maxWidth={960}
          mainMinWidth={560}
          onClose={onClose}
          onOpen={vi.fn()}
        />
      </div>
    );

    const panel = screen.getByRole("complementary", {
      name: "Harbour accounting support · Draft",
    });
    expect(panel).toHaveStyle({ width: "720px", minWidth: "520px" });
    expect(
      screen.getByText("Harbour accounting support · Draft").parentElement
    ).toHaveClass("items-baseline");

    const handle = screen.getByRole("separator", {
      name: "Resize detail panel",
    });
    expect(handle).toHaveAttribute("data-slot", "splitter-rail");
    expect(handle).toHaveClass("bg-transparent");
    expect(handle).not.toHaveClass("border-transparent", "hover:bg-muted/60");
    expect(handle).toHaveAttribute("aria-orientation", "vertical");
    expect(handle).toHaveAttribute("aria-expanded", "true");
    expect(handle).toHaveAttribute("aria-valuemin", "520");
    expect(handle).toHaveAttribute("aria-valuemax", "940");
    expect(handle).toHaveAttribute("aria-valuenow", "720");
    expect(
      handle.querySelector('[data-slot="splitter-rail-grip"]')
    ).toHaveClass("bg-muted-foreground/35", "group-hover:bg-primary");
    const hitArea = screen.getByTestId("confirmation-detail-resize-hit-area");
    expect(hitArea).toHaveAttribute("aria-hidden", "true");
    fireEvent.pointerDown(handle, { button: 0, clientX: 900, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 1300, pointerId: 1 });
    expect(panel).toHaveStyle({ width: "520px" });
    fireEvent.pointerCancel(window, { pointerId: 1 });
    expect(panel).toHaveStyle({ width: "720px" });
    fireEvent.pointerMove(window, { clientX: 100, pointerId: 1 });
    expect(panel).toHaveStyle({ width: "720px" });

    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(panel).toHaveStyle({ width: "736px" });
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(panel).toHaveStyle({ width: "720px" });

    fireEvent.pointerDown(handle, { button: 0, clientX: 900, pointerId: 2 });
    fireEvent.pointerMove(window, { clientX: 100, pointerId: 2 });
    expect(panel).toHaveStyle({ width: "940px" });
    fireEvent.pointerUp(window, { pointerId: 2 });
    fireEvent.click(handle);
    expect(onClose).not.toHaveBeenCalled();
    expect(panel).toBeInTheDocument();

    Object.assign(handle, {
      setPointerCapture: vi.fn(),
      hasPointerCapture: vi.fn(() => false),
      releasePointerCapture: vi.fn(() => {
        throw new Error("pointer capture was not established");
      }),
    });
    expect(() => {
      fireEvent.pointerDown(handle, {
        button: 0,
        clientX: 900,
        pointerId: 2,
      });
      fireEvent.pointerUp(window, { button: 0, pointerId: 2 });
    }).not.toThrow();

    fireEvent.pointerDown(handle, {
      button: 2,
      clientX: 900,
      pointerId: 3,
    });
    fireEvent.pointerMove(window, { button: 2, clientX: 100, pointerId: 3 });
    fireEvent.pointerUp(window, { button: 2, pointerId: 3 });
    expect(panel).toHaveStyle({ width: "940px" });

    onClose.mockClear();
    fireEvent.click(hitArea);
    expect(onClose).not.toHaveBeenCalled();
    expect(panel).toHaveClass("emp-splitter-detail-closing");
    fireEvent.animationEnd(panel);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
